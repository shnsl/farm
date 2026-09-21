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
import type { GeneralWorkEvent } from '../../types'

export const createGeneralWorkSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  work: z.string().trim().min(1, 'Yapılan iş gerekli').max(200),
  cost: z.coerce.number().min(0, 'Masraf 0 veya daha büyük olmalı'),
  fieldId: z.string().trim().min(1).optional(),
})

export type CreateGeneralWorkInput = z.infer<typeof createGeneralWorkSchema>

function mapGeneralWork(
  id: string,
  data: Record<string, unknown>,
): GeneralWorkEvent {
  const fieldId = data.fieldId ? String(data.fieldId).trim() : undefined
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    work: String(data.work ?? ''),
    cost: Number(data.cost ?? 0),
    fieldId: fieldId || undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

/** Çiftlik geneli işler: farms/{farmId}/generalWorks */
export function subscribeGeneralWorks(
  farmId: string,
  onData: (events: GeneralWorkEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'generalWorks'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapGeneralWork(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

/** Belirli tarlaya bağlı genel işler */
export function subscribeFieldGeneralWorks(
  farmId: string,
  fieldId: string,
  onData: (events: GeneralWorkEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeGeneralWorks(
    farmId,
    (events) => onData(events.filter((e) => e.fieldId === fieldId)),
    onError,
  )
}

export async function createGeneralWork(
  farmId: string,
  input: CreateGeneralWorkInput,
  createdBy: string,
): Promise<string> {
  const parsed = createGeneralWorkSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, 'farms', farmId, 'generalWorks'), {
    doneAt: parsed.doneAt,
    work: parsed.work,
    cost: parsed.cost,
    fieldId: parsed.fieldId || null,
    createdBy,
    createdAt: serverTimestamp(),
    createdAtIso: now,
  })
  return ref.id
}

export async function updateGeneralWork(
  farmId: string,
  eventId: string,
  input: CreateGeneralWorkInput,
): Promise<void> {
  const parsed = createGeneralWorkSchema.parse(input)
  await updateDoc(doc(db, 'farms', farmId, 'generalWorks', eventId), {
    doneAt: parsed.doneAt,
    work: parsed.work,
    cost: parsed.cost,
    fieldId: parsed.fieldId || null,
  })
}

export async function deleteGeneralWork(
  farmId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'farms', farmId, 'generalWorks', eventId))
}
