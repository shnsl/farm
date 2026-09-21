import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { z } from 'zod'
import type { Field } from '../../types'
import { db } from '../../lib/firebase'
import { fillEmptyCellsWithSpecies } from '../trees/api'

export const createFieldSchema = z.object({
  name: z.string().trim().min(1, 'Tarla adı gerekli').max(80),
  rowCount: z.coerce.number().int().min(1).max(26),
  colCount: z.coerce.number().int().min(1).max(200),
  area: z.string().trim().max(80).optional(),
  donum: z.coerce.number().min(0, 'Dönüm 0 veya daha büyük olmalı').optional(),
  species: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  /** Çeşit varsa tüm hücrelere o çeşit ile ağaç ekle */
  fillGrid: z.boolean().optional().default(false),
})

export type CreateFieldInput = z.infer<typeof createFieldSchema>

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

function mapSpeciesCounts(
  raw: unknown,
): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value)
    if (!key.trim() || Number.isNaN(n) || n <= 0) continue
    out[key] = n
  }
  return Object.keys(out).length > 0 ? out : {}
}

function mapField(
  id: string,
  data: Record<string, unknown>,
  options?: { includeMap?: boolean },
): Field {
  const includeMap = options?.includeMap ?? false
  return {
    id,
    name: String(data.name ?? ''),
    rowCount: Number(data.rowCount ?? 1),
    colCount: Number(data.colCount ?? 1),
    area: data.area ? String(data.area) : undefined,
    donum: optionalNumber(data.donum),
    species: data.species ? String(data.species) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    activeTreeCount:
      data.activeTreeCount === undefined || data.activeTreeCount === null
        ? undefined
        : Number(data.activeTreeCount),
    speciesCounts:
      data.speciesCounts === undefined
        ? undefined
        : mapSpeciesCounts(data.speciesCounts),
    mapImageDataUrl:
      includeMap && data.mapImageDataUrl
        ? String(data.mapImageDataUrl)
        : undefined,
    mapFileName:
      includeMap && data.mapFileName ? String(data.mapFileName) : undefined,
    mapUpdatedAt:
      includeMap && data.mapUpdatedAt ? String(data.mapUpdatedAt) : undefined,
    plowStandard: {
      timesPerYear: 0,
      windows: [],
    },
    createdAt: String(data.createdAtIso ?? ''),
    updatedAt: String(data.updatedAtIso ?? ''),
  }
}

export function subscribeFields(
  farmId: string,
  onData: (fields: Field[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'fields'),
    orderBy('name'),
  )

  return onSnapshot(
    q,
    (snap) => {
      const fields = snap.docs.map((d) => mapField(d.id, d.data()))
      onData(fields)
    },
    (err) => onError?.(err),
  )
}

export function subscribeField(
  farmId: string,
  fieldId: string,
  onData: (field: Field | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'farms', farmId, 'fields', fieldId),
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData(mapField(snap.id, snap.data(), { includeMap: true }))
    },
    (err) => onError?.(err),
  )
}

export async function createField(
  farmId: string,
  input: CreateFieldInput,
): Promise<string> {
  const parsed = createFieldSchema.parse(input)
  const now = new Date().toISOString()
  const species = parsed.species || null
  const ref = await addDoc(collection(db, 'farms', farmId, 'fields'), {
    name: parsed.name,
    rowCount: parsed.rowCount,
    colCount: parsed.colCount,
    area: parsed.area || null,
    donum: parsed.donum === undefined ? null : parsed.donum,
    species,
    notes: parsed.notes || null,
    activeTreeCount: 0,
    speciesCounts: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAtIso: now,
    updatedAtIso: now,
  })

  if (parsed.fillGrid && species) {
    await fillEmptyCellsWithSpecies(
      farmId,
      ref.id,
      {
        rowCount: parsed.rowCount,
        colCount: parsed.colCount,
        species,
      },
      new Set(),
    )
  }

  return ref.id
}

export async function updateFieldSpecies(
  farmId: string,
  fieldId: string,
  species: string,
): Promise<void> {
  const trimmed = species.trim()
  if (!trimmed) {
    throw new Error('Çeşit adı gerekli')
  }
  const now = new Date().toISOString()
  await updateDoc(doc(db, 'farms', farmId, 'fields', fieldId), {
    species: trimmed,
    updatedAt: serverTimestamp(),
    updatedAtIso: now,
  })
}

export async function updateField(
  farmId: string,
  fieldId: string,
  patch: Partial<Omit<CreateFieldInput, 'fillGrid'>>,
): Promise<void> {
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedAtIso: now,
  }
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.rowCount !== undefined) payload.rowCount = patch.rowCount
  if (patch.colCount !== undefined) payload.colCount = patch.colCount
  if (patch.area !== undefined) payload.area = patch.area.trim() || null
  if (Object.prototype.hasOwnProperty.call(patch, 'donum')) {
    const value = patch.donum
    payload.donum =
      value === undefined || value === null || Number.isNaN(Number(value))
        ? null
        : Number(value)
  }
  if (patch.species !== undefined) payload.species = patch.species.trim() || null
  if (patch.notes !== undefined) payload.notes = patch.notes.trim() || null

  await updateDoc(doc(db, 'farms', farmId, 'fields', fieldId), payload)
}

export async function updateFieldMapImage(
  farmId: string,
  fieldId: string,
  input: {
    mapImageDataUrl: string | null
    mapFileName?: string | null
  },
): Promise<void> {
  const now = new Date().toISOString()
  const dataUrl = input.mapImageDataUrl?.trim() || null
  if (dataUrl && dataUrl.length > 1_200_000) {
    throw new Error('Fotoğraf çok büyük; daha küçük bir görsel dene')
  }
  if (dataUrl && !/^data:image\/(jpeg|jpg|png);base64,/i.test(dataUrl)) {
    throw new Error('Geçersiz görsel formatı')
  }
  await updateDoc(doc(db, 'farms', farmId, 'fields', fieldId), {
    mapImageDataUrl: dataUrl,
    mapFileName: dataUrl ? input.mapFileName?.trim() || 'tarla.jpg' : null,
    mapUpdatedAt: dataUrl ? now : null,
    kmlContent: null,
    kmlFileName: null,
    kmlUpdatedAt: null,
    updatedAt: serverTimestamp(),
    updatedAtIso: now,
  })
}

export async function deleteField(
  farmId: string,
  fieldId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'farms', farmId, 'fields', fieldId))
}
