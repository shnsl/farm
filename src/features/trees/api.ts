import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { z } from 'zod'
import {
  cellSchema,
  formatCell,
  letterToRowIndex,
  parseCell,
  rowIndexToLetter,
} from '../../lib/cells'
import { db } from '../../lib/firebase'
import type { Tree, TreeHealth, TreeStatus } from '../../types'
import { adjustFieldTreeStats } from '../fields/treeStats'

const BATCH_LIMIT = 450

export const TREE_HEALTH_LABELS: Record<TreeHealth, string> = {
  good: 'İyi',
  weak: 'Zayıf',
  sick: 'Hasta',
}

export const createTreeSchema = z.object({
  cell: cellSchema,
  species: z.string().trim().max(80).optional(),
  label: z.string().trim().max(80).optional(),
  plantedAt: z.string().trim().max(32).optional(),
  health: z.enum(['good', 'weak', 'sick']).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'removed', 'dead']).default('active'),
})

export const updateTreeSchema = z.object({
  species: z.string().trim().max(80).optional(),
  label: z.string().trim().max(80).optional(),
  plantedAt: z.string().trim().max(32).optional(),
  health: z.enum(['good', 'weak', 'sick']).optional().nullable(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'removed', 'dead']).optional(),
})

export type CreateTreeInput = z.infer<typeof createTreeSchema>
export type UpdateTreeInput = z.infer<typeof updateTreeSchema>

export interface TreeSearchHit {
  tree: Tree
  fieldId: string
  fieldName: string
}

function mapTree(id: string, data: Record<string, unknown>): Tree {
  return {
    id,
    cell: String(data.cell ?? ''),
    row: String(data.row ?? ''),
    col: Number(data.col ?? 0),
    species: data.species ? String(data.species) : undefined,
    label: data.label ? String(data.label) : undefined,
    plantedAt: data.plantedAt ? String(data.plantedAt) : undefined,
    health: (data.health as TreeHealth | undefined) || undefined,
    status: (data.status as TreeStatus) ?? 'active',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: String(data.createdAtIso ?? ''),
    updatedAt: String(data.updatedAtIso ?? ''),
  }
}

export function subscribeTrees(
  farmId: string,
  fieldId: string,
  onData: (trees: Tree[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'fields', fieldId, 'trees'),
    orderBy('cell'),
  )

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapTree(d.id, d.data())))
    },
    (err) => onError?.(err),
  )
}

/** Her tarla için aktif ağaç sayısı — denormalize sayaç yoksa tarar. */
export async function countActiveTreesByFields(
  farmId: string,
  fields: { id: string; activeTreeCount?: number }[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    fields.map(async (field) => {
      if (field.activeTreeCount !== undefined) {
        return [field.id, field.activeTreeCount] as const
      }
      const snap = await getDocs(
        collection(db, 'farms', farmId, 'fields', field.id, 'trees'),
      )
      const count = snap.docs.filter(
        (d) => String(d.data().status ?? 'active') === 'active',
      ).length
      return [field.id, count] as const
    }),
  )
  return Object.fromEntries(entries)
}

export async function createTree(
  farmId: string,
  fieldId: string,
  input: CreateTreeInput,
  bounds: { rowCount: number; colCount: number },
): Promise<string> {
  const parsed = createTreeSchema.parse(input)
  const { row, col } = parseCell(parsed.cell)
  const rowIndex = letterToRowIndex(row)

  if (rowIndex < 0 || rowIndex >= bounds.rowCount) {
    throw new Error(`Satır ${row} tarla sınırları dışında`)
  }
  if (col < 1 || col > bounds.colCount) {
    throw new Error(`Sütun ${col} tarla sınırları dışında`)
  }

  const cell = formatCell(row, col)
  const now = new Date().toISOString()
  const ref = await addDoc(
    collection(db, 'farms', farmId, 'fields', fieldId, 'trees'),
    {
      cell,
      row,
      col,
      species: parsed.species || null,
      label: parsed.label || null,
      plantedAt: parsed.plantedAt || null,
      health: parsed.health || null,
      notes: parsed.notes || null,
      status: parsed.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAtIso: now,
      updatedAtIso: now,
    },
  )
  if (parsed.status === 'active') {
    const species = parsed.species?.trim() || ''
    await adjustFieldTreeStats(
      farmId,
      fieldId,
      1,
      species ? [{ species, delta: 1 }] : undefined,
    )
  }
  return ref.id
}

export async function updateTreeDetails(
  farmId: string,
  fieldId: string,
  treeId: string,
  input: UpdateTreeInput,
): Promise<void> {
  const parsed = updateTreeSchema.parse(input)
  const treeRef = doc(db, 'farms', farmId, 'fields', fieldId, 'trees', treeId)
  const prevSnap = await getDoc(treeRef)
  const prev = prevSnap.exists() ? mapTree(treeId, prevSnap.data()) : null
  const now = new Date().toISOString()
  await updateDoc(treeRef, {
    species: parsed.species?.trim() ? parsed.species.trim() : null,
    label: parsed.label?.trim() ? parsed.label.trim() : null,
    plantedAt: parsed.plantedAt?.trim() ? parsed.plantedAt.trim() : null,
    health: parsed.health ?? null,
    notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
    ...(parsed.status ? { status: parsed.status } : {}),
    updatedAt: serverTimestamp(),
    updatedAtIso: now,
  })

  if (!prev) return

  const nextStatus = parsed.status ?? prev.status
  const nextSpecies =
    parsed.species !== undefined
      ? parsed.species.trim() || ''
      : prev.species?.trim() || ''
  const prevActive = prev.status === 'active'
  const nextActive = nextStatus === 'active'
  const prevSpecies = prev.species?.trim() || ''

  const deltas: { species: string; delta: number }[] = []
  if (prevActive && prevSpecies) deltas.push({ species: prevSpecies, delta: -1 })
  if (nextActive && nextSpecies) deltas.push({ species: nextSpecies, delta: 1 })

  let deltaActive = 0
  if (prevActive && !nextActive) deltaActive = -1
  if (!prevActive && nextActive) deltaActive = 1

  await adjustFieldTreeStats(farmId, fieldId, deltaActive, deltas)
}

function matchesQuery(tree: Tree, fieldName: string, needle: string): boolean {
  const haystack = [
    tree.cell,
    tree.row,
    String(tree.col),
    tree.species,
    tree.label,
    tree.plantedAt,
    tree.notes,
    tree.health ? TREE_HEALTH_LABELS[tree.health] : '',
    tree.health,
    fieldName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr')

  return haystack.includes(needle)
}

/** Tüm tarlalardaki ağaçlarda metin araması (hücre, çeşit, not, etiket…). */
export async function searchFarmTrees(
  farmId: string,
  fields: { id: string; name: string }[],
  rawQuery: string,
): Promise<TreeSearchHit[]> {
  const needle = rawQuery.trim().toLocaleLowerCase('tr')
  if (!needle || fields.length === 0) {
    return []
  }

  const results = await Promise.all(
    fields.map(async (field) => {
      const snap = await getDocs(
        query(
          collection(db, 'farms', farmId, 'fields', field.id, 'trees'),
          orderBy('cell'),
        ),
      )
      return snap.docs
        .map((d) => mapTree(d.id, d.data()))
        .filter((tree) => tree.status === 'active')
        .filter((tree) => matchesQuery(tree, field.name, needle))
        .map((tree) => ({
          tree,
          fieldId: field.id,
          fieldName: field.name,
        }))
    }),
  )

  return results.flat().sort((a, b) => {
    const byField = a.fieldName.localeCompare(b.fieldName, 'tr')
    if (byField !== 0) return byField
    return a.tree.cell.localeCompare(b.tree.cell, 'tr')
  })
}

/** Boş hücrelere verilen çeşit ile ağaç ekler (mevcut dolu hücrelere dokunmaz). */
export async function fillEmptyCellsWithSpecies(
  farmId: string,
  fieldId: string,
  bounds: { rowCount: number; colCount: number; species: string },
  occupiedCells: Set<string>,
): Promise<number> {
  const species = bounds.species.trim()
  if (!species) {
    throw new Error('Çeşit adı gerekli')
  }

  const treesCol = collection(db, 'farms', farmId, 'fields', fieldId, 'trees')
  const now = new Date().toISOString()
  let batch = writeBatch(db)
  let ops = 0
  let created = 0

  async function flush() {
    if (ops === 0) return
    await batch.commit()
    batch = writeBatch(db)
    ops = 0
  }

  for (let r = 0; r < bounds.rowCount; r += 1) {
    const row = rowIndexToLetter(r)
    for (let col = 1; col <= bounds.colCount; col += 1) {
      const cell = formatCell(row, col)
      if (occupiedCells.has(cell)) continue

      const ref = doc(treesCol)
      batch.set(ref, {
        cell,
        row,
        col,
        species,
        notes: null,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAtIso: now,
        updatedAtIso: now,
      })
      ops += 1
      created += 1

      if (ops >= BATCH_LIMIT) {
        await flush()
      }
    }
  }

  await flush()
  if (created > 0) {
    await adjustFieldTreeStats(farmId, fieldId, created, [
      { species, delta: created },
    ])
  }
  return created
}
export async function bulkUpdateTreeSpecies(
  farmId: string,
  fieldId: string,
  treeIds: string[],
  species: string,
): Promise<number> {
  const trimmed = species.trim()
  if (!trimmed) {
    throw new Error('Çeşit adı gerekli')
  }
  if (treeIds.length === 0) {
    return 0
  }

  const prevSnaps = await Promise.all(
    treeIds.map((id) =>
      getDoc(doc(db, 'farms', farmId, 'fields', fieldId, 'trees', id)),
    ),
  )

  const now = new Date().toISOString()
  let batch = writeBatch(db)
  let ops = 0
  let updated = 0
  const speciesDeltas = new Map<string, number>()

  async function flush() {
    if (ops === 0) return
    await batch.commit()
    batch = writeBatch(db)
    ops = 0
  }

  for (const snap of prevSnaps) {
    if (!snap.exists()) continue
    const prev = mapTree(snap.id, snap.data())
    if (prev.status !== 'active') {
      const ref = doc(db, 'farms', farmId, 'fields', fieldId, 'trees', snap.id)
      batch.update(ref, {
        species: trimmed,
        updatedAt: serverTimestamp(),
        updatedAtIso: now,
      })
      ops += 1
      updated += 1
      if (ops >= BATCH_LIMIT) await flush()
      continue
    }
    const oldSpecies = prev.species?.trim() || ''
    if (oldSpecies !== trimmed) {
      if (oldSpecies) {
        speciesDeltas.set(oldSpecies, (speciesDeltas.get(oldSpecies) ?? 0) - 1)
      }
      speciesDeltas.set(trimmed, (speciesDeltas.get(trimmed) ?? 0) + 1)
    }
    const ref = doc(db, 'farms', farmId, 'fields', fieldId, 'trees', snap.id)
    batch.update(ref, {
      species: trimmed,
      updatedAt: serverTimestamp(),
      updatedAtIso: now,
    })
    ops += 1
    updated += 1
    if (ops >= BATCH_LIMIT) {
      await flush()
    }
  }

  await flush()
  await adjustFieldTreeStats(
    farmId,
    fieldId,
    0,
    [...speciesDeltas.entries()].map(([s, delta]) => ({ species: s, delta })),
  )
  return updated
}

export type BulkTreePatch = {
  species?: string | null
  label?: string | null
  plantedAt?: string | null
  health?: TreeHealth | null
  notes?: string | null
}

/** Seçili ağaçlara yalnızca işaretlenen alanları uygular. */
export async function bulkUpdateTreeDetails(
  farmId: string,
  fieldId: string,
  treeIds: string[],
  patch: BulkTreePatch,
): Promise<number> {
  if (treeIds.length === 0) {
    return 0
  }

  const data: Record<string, unknown> = {}
  if ('species' in patch) data.species = patch.species?.trim() || null
  if ('label' in patch) data.label = patch.label?.trim() || null
  if ('plantedAt' in patch) data.plantedAt = patch.plantedAt?.trim() || null
  if ('health' in patch) data.health = patch.health ?? null
  if ('notes' in patch) data.notes = patch.notes?.trim() || null

  if (Object.keys(data).length === 0) {
    throw new Error('Uygulanacak en az bir alan seç')
  }

  const now = new Date().toISOString()
  data.updatedAt = serverTimestamp()
  data.updatedAtIso = now

  const speciesChanging = 'species' in patch
  const nextSpecies = speciesChanging
    ? String(patch.species ?? '').trim()
    : ''
  const prevSnaps = speciesChanging
    ? await Promise.all(
        treeIds.map((id) =>
          getDoc(doc(db, 'farms', farmId, 'fields', fieldId, 'trees', id)),
        ),
      )
    : []

  let batch = writeBatch(db)
  let ops = 0
  let updated = 0
  const speciesDeltas = new Map<string, number>()

  async function flush() {
    if (ops === 0) return
    await batch.commit()
    batch = writeBatch(db)
    ops = 0
  }

  if (speciesChanging) {
    for (const snap of prevSnaps) {
      if (!snap.exists()) continue
      const prev = mapTree(snap.id, snap.data())
      if (prev.status === 'active') {
        const oldSpecies = prev.species?.trim() || ''
        if (oldSpecies !== nextSpecies) {
          if (oldSpecies) {
            speciesDeltas.set(
              oldSpecies,
              (speciesDeltas.get(oldSpecies) ?? 0) - 1,
            )
          }
          if (nextSpecies) {
            speciesDeltas.set(
              nextSpecies,
              (speciesDeltas.get(nextSpecies) ?? 0) + 1,
            )
          }
        }
      }
      batch.update(
        doc(db, 'farms', farmId, 'fields', fieldId, 'trees', snap.id),
        data,
      )
      ops += 1
      updated += 1
      if (ops >= BATCH_LIMIT) await flush()
    }
  } else {
    for (const treeId of treeIds) {
      const ref = doc(db, 'farms', farmId, 'fields', fieldId, 'trees', treeId)
      batch.update(ref, data)
      ops += 1
      updated += 1
      if (ops >= BATCH_LIMIT) {
        await flush()
      }
    }
  }

  await flush()
  if (speciesChanging) {
    await adjustFieldTreeStats(
      farmId,
      fieldId,
      0,
      [...speciesDeltas.entries()].map(([s, delta]) => ({
        species: s,
        delta,
      })),
    )
  }
  return updated
}

/** Seçili boş hücrelere ağaç oluşturur (bilgi alanlarıyla). */
export async function createTreesInCells(
  farmId: string,
  fieldId: string,
  cells: string[],
  details: {
    species?: string
    label?: string
    plantedAt?: string
    health?: TreeHealth
    notes?: string
  },
): Promise<number> {
  if (cells.length === 0) return 0

  const treesCol = collection(db, 'farms', farmId, 'fields', fieldId, 'trees')
  const now = new Date().toISOString()
  let batch = writeBatch(db)
  let ops = 0
  let created = 0

  async function flush() {
    if (ops === 0) return
    await batch.commit()
    batch = writeBatch(db)
    ops = 0
  }

  for (const raw of cells) {
    const { row, col } = parseCell(raw)
    const cell = formatCell(row, col)
    const ref = doc(treesCol)
    batch.set(ref, {
      cell,
      row,
      col,
      species: details.species?.trim() || null,
      label: details.label?.trim() || null,
      plantedAt: details.plantedAt?.trim() || null,
      health: details.health || null,
      notes: details.notes?.trim() || null,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAtIso: now,
      updatedAtIso: now,
    })
    ops += 1
    created += 1
    if (ops >= BATCH_LIMIT) {
      await flush()
    }
  }

  await flush()
  if (created > 0) {
    const species = details.species?.trim() || ''
    await adjustFieldTreeStats(
      farmId,
      fieldId,
      created,
      species ? [{ species, delta: created }] : undefined,
    )
  }
  return created
}

export async function updateTreeStatus(
  farmId: string,
  fieldId: string,
  treeId: string,
  status: TreeStatus,
): Promise<void> {
  const treeRef = doc(db, 'farms', farmId, 'fields', fieldId, 'trees', treeId)
  const prevSnap = await getDoc(treeRef)
  const prev = prevSnap.exists() ? mapTree(treeId, prevSnap.data()) : null
  const now = new Date().toISOString()
  await updateDoc(treeRef, {
    status,
    updatedAt: serverTimestamp(),
    updatedAtIso: now,
  })
  if (!prev || prev.status === status) return
  const species = prev.species?.trim() || ''
  const wasActive = prev.status === 'active'
  const nowActive = status === 'active'
  let deltaActive = 0
  const deltas: { species: string; delta: number }[] = []
  if (wasActive && !nowActive) {
    deltaActive = -1
    if (species) deltas.push({ species, delta: -1 })
  } else if (!wasActive && nowActive) {
    deltaActive = 1
    if (species) deltas.push({ species, delta: 1 })
  }
  await adjustFieldTreeStats(farmId, fieldId, deltaActive, deltas)
}

export async function deleteTree(
  farmId: string,
  fieldId: string,
  treeId: string,
): Promise<void> {
  const treeRef = doc(db, 'farms', farmId, 'fields', fieldId, 'trees', treeId)
  const prevSnap = await getDoc(treeRef)
  const prev = prevSnap.exists() ? mapTree(treeId, prevSnap.data()) : null
  await deleteDoc(treeRef)
  if (prev?.status === 'active') {
    const species = prev.species?.trim() || ''
    await adjustFieldTreeStats(
      farmId,
      fieldId,
      -1,
      species ? [{ species, delta: -1 }] : undefined,
    )
  }
}

/** Seçili ağaçları toplu siler. */
export async function bulkDeleteTrees(
  farmId: string,
  fieldId: string,
  treeIds: string[],
): Promise<number> {
  if (treeIds.length === 0) return 0

  const prevSnaps = await Promise.all(
    treeIds.map((id) =>
      getDoc(doc(db, 'farms', farmId, 'fields', fieldId, 'trees', id)),
    ),
  )

  let batch = writeBatch(db)
  let ops = 0
  let deleted = 0
  let deltaActive = 0
  const speciesDeltas = new Map<string, number>()

  async function flush() {
    if (ops === 0) return
    await batch.commit()
    batch = writeBatch(db)
    ops = 0
  }

  for (const snap of prevSnaps) {
    if (!snap.exists()) continue
    const prev = mapTree(snap.id, snap.data())
    if (prev.status === 'active') {
      deltaActive -= 1
      const species = prev.species?.trim() || ''
      if (species) {
        speciesDeltas.set(species, (speciesDeltas.get(species) ?? 0) - 1)
      }
    }
    batch.delete(doc(db, 'farms', farmId, 'fields', fieldId, 'trees', snap.id))
    ops += 1
    deleted += 1
    if (ops >= BATCH_LIMIT) {
      await flush()
    }
  }

  await flush()
  await adjustFieldTreeStats(
    farmId,
    fieldId,
    deltaActive,
    [...speciesDeltas.entries()].map(([species, delta]) => ({ species, delta })),
  )
  return deleted
}

/** Seçili ağaçların bilgi alanlarını temizler (ağaç kalır). */
export async function bulkClearTreeDetails(
  farmId: string,
  fieldId: string,
  treeIds: string[],
): Promise<number> {
  return bulkUpdateTreeDetails(farmId, fieldId, treeIds, {
    species: null,
    label: null,
    plantedAt: null,
    health: null,
    notes: null,
  })
}
