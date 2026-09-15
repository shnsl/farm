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
import {
  defaultPlowWindows,
  defaultTimesPerYear,
} from '../../config/plowWindows'
import type { Field, PlowStandard } from '../../types'
import { db } from '../../lib/firebase'
import { fillEmptyCellsWithSpecies } from '../trees/api'

export const createFieldSchema = z.object({
  name: z.string().trim().min(1, 'Tarla adı gerekli').max(80),
  rowCount: z.coerce.number().int().min(1).max(26),
  colCount: z.coerce.number().int().min(1).max(200),
  species: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  /** Çeşit varsa tüm hücrelere o çeşit ile ağaç ekle */
  fillGrid: z.boolean().optional().default(false),
})

export type CreateFieldInput = z.infer<typeof createFieldSchema>

function mapField(id: string, data: Record<string, unknown>): Field {
  const plow = (data.plowStandard as PlowStandard | undefined) ?? {
    timesPerYear: defaultTimesPerYear,
    windows: defaultPlowWindows,
  }

  return {
    id,
    name: String(data.name ?? ''),
    rowCount: Number(data.rowCount ?? 1),
    colCount: Number(data.colCount ?? 1),
    species: data.species ? String(data.species) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    plowStandard: plow,
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
      onData(mapField(snap.id, snap.data()))
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
    species,
    notes: parsed.notes || null,
    plowStandard: {
      timesPerYear: defaultTimesPerYear,
      windows: defaultPlowWindows,
    },
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
  await updateDoc(doc(db, 'farms', farmId, 'fields', fieldId), {
    ...patch,
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
