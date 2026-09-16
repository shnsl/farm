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
import { db } from '../../lib/firebase'
import type { FertilizeEvent } from '../../types'

export const createFertilizeSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  fertilizerType: z.string().trim().min(1, 'Gübre cinsi gerekli').max(120),
  cost: z.coerce.number().min(0, 'Masraf 0 veya daha büyük olmalı'),
  notes: z.string().trim().max(500).optional(),
})

export type CreateFertilizeInput = z.infer<typeof createFertilizeSchema>

function mapFertilize(
  id: string,
  data: Record<string, unknown>,
): FertilizeEvent {
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    fertilizerType: String(data.fertilizerType ?? ''),
    cost: Number(data.cost ?? 0),
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

export function subscribeFertilizeEvents(
  farmId: string,
  fieldId: string,
  onData: (events: FertilizeEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'fields', fieldId, 'fertilizeEvents'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapFertilize(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

export async function createFertilizeEvent(
  farmId: string,
  fieldId: string,
  input: CreateFertilizeInput,
  createdBy: string,
): Promise<string> {
  const parsed = createFertilizeSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(
    collection(db, 'farms', farmId, 'fields', fieldId, 'fertilizeEvents'),
    {
      doneAt: parsed.doneAt,
      fertilizerType: parsed.fertilizerType,
      cost: parsed.cost,
      notes: parsed.notes || null,
      createdBy,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    },
  )
  return ref.id
}

export async function updateFertilizeEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
  input: CreateFertilizeInput,
): Promise<void> {
  const parsed = createFertilizeSchema.parse(input)
  await updateDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'fertilizeEvents', eventId),
    {
      doneAt: parsed.doneAt,
      fertilizerType: parsed.fertilizerType,
      cost: parsed.cost,
      notes: parsed.notes || null,
    },
  )
}

export async function deleteFertilizeEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'fertilizeEvents', eventId),
  )
}
