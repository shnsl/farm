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
import type { HoeEvent } from '../../types'

export const createHoeSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  workerCount: z.coerce.number().int().min(0, 'İşçi sayısı 0 veya daha büyük olmalı'),
  dailyWage: z.coerce.number().min(0, 'Yevmiye 0 veya daha büyük olmalı'),
  totalPaid: z.coerce.number().min(0, 'Toplam harcama 0 veya daha büyük olmalı'),
  notes: z.string().trim().max(500).optional(),
})

export type CreateHoeInput = z.infer<typeof createHoeSchema>

function mapHoe(id: string, data: Record<string, unknown>): HoeEvent {
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    workerCount: Number(data.workerCount ?? 0),
    dailyWage: Number(data.dailyWage ?? 0),
    totalPaid: Number(data.totalPaid ?? 0),
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

export function subscribeHoeEvents(
  farmId: string,
  fieldId: string,
  onData: (events: HoeEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'fields', fieldId, 'hoeEvents'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapHoe(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

export async function createHoeEvent(
  farmId: string,
  fieldId: string,
  input: CreateHoeInput,
  createdBy: string,
): Promise<string> {
  const parsed = createHoeSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(
    collection(db, 'farms', farmId, 'fields', fieldId, 'hoeEvents'),
    {
      doneAt: parsed.doneAt,
      workerCount: parsed.workerCount,
      dailyWage: parsed.dailyWage,
      totalPaid: parsed.totalPaid,
      notes: parsed.notes || null,
      createdBy,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    },
  )
  return ref.id
}

export async function updateHoeEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
  input: CreateHoeInput,
): Promise<void> {
  const parsed = createHoeSchema.parse(input)
  await updateDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'hoeEvents', eventId),
    {
      doneAt: parsed.doneAt,
      workerCount: parsed.workerCount,
      dailyWage: parsed.dailyWage,
      totalPaid: parsed.totalPaid,
      notes: parsed.notes || null,
    },
  )
}

export async function deleteHoeEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'hoeEvents', eventId),
  )
}
