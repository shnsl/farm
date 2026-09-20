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
import type { FuelEvent } from '../../types'

export const createFuelSchema = z.object({
  doneAt: z.string().trim().min(1, 'Alım zamanı gerekli'),
  liters: z.coerce.number().positive('Litre 0’dan büyük olmalı'),
  unitPrice: z.coerce.number().min(0, 'Birim fiyat 0 veya daha büyük olmalı'),
  source: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
})

export type CreateFuelInput = z.infer<typeof createFuelSchema>

export function fuelTotalCost(input: {
  liters: number
  unitPrice: number
}): number {
  return Number((input.liters * input.unitPrice).toFixed(2))
}

export function fuelPurchaseSummary(events: FuelEvent[]): {
  purchased: number
  spend: number
  count: number
} {
  let purchased = 0
  let spend = 0
  let count = 0
  for (const e of events) {
    if (e.kind !== 'purchase') continue
    purchased += e.liters
    spend += e.totalCost ?? 0
    count += 1
  }
  return {
    purchased: Number(purchased.toFixed(2)),
    spend: Number(spend.toFixed(2)),
    count,
  }
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

function mapFuel(id: string, data: Record<string, unknown>): FuelEvent {
  const liters = Number(data.liters ?? 0)
  const rawKind = String(data.kind ?? 'purchase')
  const kind = rawKind === 'consumption' ? 'consumption' : 'purchase'
  const unitPrice = optionalNumber(data.unitPrice)
  const storedTotal = optionalNumber(data.totalCost)
  const doneAt = String(data.doneAt ?? data.purchasedAt ?? '')

  return {
    id,
    kind,
    doneAt,
    liters,
    unitPrice: kind === 'purchase' ? (unitPrice ?? 0) : undefined,
    totalCost:
      kind === 'purchase'
        ? storedTotal !== undefined
          ? storedTotal
          : fuelTotalCost({ liters, unitPrice: unitPrice ?? 0 })
        : undefined,
    source: data.source ? String(data.source) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

/** Çiftlik geneli yakıt alımları: farms/{farmId}/fuelEvents */
export function subscribeFuelEvents(
  farmId: string,
  onData: (events: FuelEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'fuelEvents'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => mapFuel(d.id, d.data()))
      onData(all.filter((e) => e.kind === 'purchase'))
    },
    (err) => onError?.(err),
  )
}

export async function createFuelEvent(
  farmId: string,
  input: CreateFuelInput,
  createdBy: string,
): Promise<string> {
  const parsed = createFuelSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, 'farms', farmId, 'fuelEvents'), {
    kind: 'purchase',
    doneAt: parsed.doneAt,
    liters: parsed.liters,
    unitPrice: parsed.unitPrice,
    totalCost: fuelTotalCost({
      liters: parsed.liters,
      unitPrice: parsed.unitPrice,
    }),
    source: parsed.source || null,
    notes: parsed.notes || null,
    createdBy,
    createdAt: serverTimestamp(),
    createdAtIso: now,
  })
  return ref.id
}

export async function updateFuelEvent(
  farmId: string,
  eventId: string,
  input: CreateFuelInput,
): Promise<void> {
  const parsed = createFuelSchema.parse(input)
  await updateDoc(doc(db, 'farms', farmId, 'fuelEvents', eventId), {
    kind: 'purchase',
    doneAt: parsed.doneAt,
    liters: parsed.liters,
    unitPrice: parsed.unitPrice,
    totalCost: fuelTotalCost({
      liters: parsed.liters,
      unitPrice: parsed.unitPrice,
    }),
    source: parsed.source || null,
    notes: parsed.notes || null,
  })
}

export async function deleteFuelEvent(
  farmId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'farms', farmId, 'fuelEvents', eventId))
}
