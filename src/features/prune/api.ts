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
import type { PruneEvent } from '../../types'

export const createPruneSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  workerCount: z.coerce.number().int().min(1, 'En az 1 işçi olmalı'),
  foremanName: z.string().trim().min(1, 'Elçi adı gerekli').max(120),
  foremanPhone: z.string().trim().min(1, 'Telefon gerekli').max(40),
  dailyWage: z.coerce.number().min(0, 'Yevmiye 0 veya daha büyük olmalı'),
  durationDays: z.coerce.number().min(0.5, 'Süre en az yarım gün olmalı'),
  notes: z.string().trim().max(500).optional(),
})

export type CreatePruneInput = z.infer<typeof createPruneSchema>

function mapPrune(id: string, data: Record<string, unknown>): PruneEvent {
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    workerCount: Number(data.workerCount ?? 0),
    foremanName: String(data.foremanName ?? ''),
    foremanPhone: String(data.foremanPhone ?? ''),
    dailyWage: Number(data.dailyWage ?? 0),
    durationDays: Number(data.durationDays ?? 0),
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

export function subscribePruneEvents(
  farmId: string,
  fieldId: string,
  onData: (events: PruneEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'fields', fieldId, 'pruneEvents'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapPrune(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

export async function createPruneEvent(
  farmId: string,
  fieldId: string,
  input: CreatePruneInput,
  createdBy: string,
): Promise<string> {
  const parsed = createPruneSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(
    collection(db, 'farms', farmId, 'fields', fieldId, 'pruneEvents'),
    {
      doneAt: parsed.doneAt,
      workerCount: parsed.workerCount,
      foremanName: parsed.foremanName,
      foremanPhone: parsed.foremanPhone,
      dailyWage: parsed.dailyWage,
      durationDays: parsed.durationDays,
      notes: parsed.notes || null,
      createdBy,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    },
  )
  return ref.id
}

export async function updatePruneEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
  input: CreatePruneInput,
): Promise<void> {
  const parsed = createPruneSchema.parse(input)
  await updateDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'pruneEvents', eventId),
    {
      doneAt: parsed.doneAt,
      workerCount: parsed.workerCount,
      foremanName: parsed.foremanName,
      foremanPhone: parsed.foremanPhone,
      dailyWage: parsed.dailyWage,
      durationDays: parsed.durationDays,
      notes: parsed.notes || null,
    },
  )
}

export async function deletePruneEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'pruneEvents', eventId),
  )
}

export function pruneLaborCost(event: {
  workerCount: number
  dailyWage: number
  durationDays: number
}): number {
  return event.workerCount * event.dailyWage * event.durationDays
}
