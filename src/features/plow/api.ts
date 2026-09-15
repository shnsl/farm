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
import type { HarvestEvent, PlowDirection, PlowEvent } from '../../types'

export const PLOW_DIRECTION_LABELS: Record<PlowDirection, string> = {
  enine: 'Enine',
  boyuna: 'Boyuna',
}

export const createPlowSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  direction: z.enum(['enine', 'boyuna']),
  notes: z.string().trim().max(500).optional(),
})

export const createHarvestSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  workerCount: z.coerce.number().int().min(0, 'İşçi sayısı 0 veya daha büyük olmalı'),
  dailyWage: z.coerce.number().min(0, 'Yevmiye 0 veya daha büyük olmalı'),
  totalPaid: z.coerce.number().min(0, 'Toplam ödeme 0 veya daha büyük olmalı'),
  estimatedKg: z.coerce
    .number()
    .min(0, 'Tahmini kilo 0 veya daha büyük olmalı')
    .optional(),
  avgPricePerKg: z.coerce
    .number()
    .min(0, 'Ortalama fiyat 0 veya daha büyük olmalı')
    .optional(),
  notes: z.string().trim().max(500).optional(),
})

export type CreatePlowInput = z.infer<typeof createPlowSchema>
export type CreateHarvestInput = z.infer<typeof createHarvestSchema>

export function harvestProductValue(h: {
  estimatedKg?: number
  avgPricePerKg?: number
}): number {
  const kg = h.estimatedKg ?? 0
  const price = h.avgPricePerKg ?? 0
  return Number((kg * price).toFixed(2))
}

function mapPlow(id: string, data: Record<string, unknown>): PlowEvent {
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    direction: (data.direction as PlowDirection) || 'enine',
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

function mapHarvest(id: string, data: Record<string, unknown>): HarvestEvent {
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    workerCount: Number(data.workerCount ?? 0),
    dailyWage: Number(data.dailyWage ?? 0),
    totalPaid: Number(data.totalPaid ?? 0),
    estimatedKg: optionalNumber(data.estimatedKg),
    avgPricePerKg: optionalNumber(data.avgPricePerKg),
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

export function subscribePlowEvents(
  farmId: string,
  fieldId: string,
  onData: (events: PlowEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'fields', fieldId, 'plowEvents'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapPlow(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

export function subscribeHarvestEvents(
  farmId: string,
  fieldId: string,
  onData: (events: HarvestEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'fields', fieldId, 'harvestEvents'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapHarvest(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

export async function createPlowEvent(
  farmId: string,
  fieldId: string,
  input: CreatePlowInput,
  createdBy: string,
): Promise<string> {
  const parsed = createPlowSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(
    collection(db, 'farms', farmId, 'fields', fieldId, 'plowEvents'),
    {
      doneAt: parsed.doneAt,
      direction: parsed.direction,
      notes: parsed.notes || null,
      createdBy,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    },
  )
  return ref.id
}

export async function createHarvestEvent(
  farmId: string,
  fieldId: string,
  input: CreateHarvestInput,
  createdBy: string,
): Promise<string> {
  const parsed = createHarvestSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(
    collection(db, 'farms', farmId, 'fields', fieldId, 'harvestEvents'),
    {
      doneAt: parsed.doneAt,
      workerCount: parsed.workerCount,
      dailyWage: parsed.dailyWage,
      totalPaid: parsed.totalPaid,
      estimatedKg:
        parsed.estimatedKg === undefined ? null : parsed.estimatedKg,
      avgPricePerKg:
        parsed.avgPricePerKg === undefined ? null : parsed.avgPricePerKg,
      notes: parsed.notes || null,
      createdBy,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    },
  )
  return ref.id
}

export async function updateHarvestEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
  input: CreateHarvestInput,
): Promise<void> {
  const parsed = createHarvestSchema.parse(input)
  await updateDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'harvestEvents', eventId),
    {
      doneAt: parsed.doneAt,
      workerCount: parsed.workerCount,
      dailyWage: parsed.dailyWage,
      totalPaid: parsed.totalPaid,
      estimatedKg:
        parsed.estimatedKg === undefined ? null : parsed.estimatedKg,
      avgPricePerKg:
        parsed.avgPricePerKg === undefined ? null : parsed.avgPricePerKg,
      notes: parsed.notes || null,
    },
  )
}

export async function deletePlowEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'plowEvents', eventId),
  )
}

export async function deleteHarvestEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, 'farms', farmId, 'fields', fieldId, 'harvestEvents', eventId),
  )
}

export interface PlowStats {
  label: string
  from: string | null
  to: string | null
  enine: number
  boyuna: number
  demir: number
  total: number
}

function dayKey(isoOrDate: string): string {
  return isoOrDate.slice(0, 10)
}

/** from inclusive, to exclusive (to = hasat günü ise o gün hariç) */
export function computePlowStats(
  plows: PlowEvent[],
  from: string | null,
  to: string | null,
  label: string,
): PlowStats {
  const fromKey = from ? dayKey(from) : null
  const toKey = to ? dayKey(to) : null

  const inRange = plows.filter((p) => {
    const d = dayKey(p.doneAt)
    if (fromKey && d < fromKey) return false
    if (toKey && d >= toKey) return false
    return true
  })

  const enine = inRange.filter((p) => p.direction === 'enine').length
  const boyuna = inRange.filter((p) => p.direction === 'boyuna').length

  return {
    label,
    from: fromKey,
    to: toKey,
    enine,
    boyuna,
    demir: Math.min(enine, boyuna),
    total: inRange.length,
  }
}

/** Son hasattan bugüne + varsa önceki iki hasat arası */
export function buildPlowStatPeriods(
  plows: PlowEvent[],
  harvests: HarvestEvent[],
): PlowStats[] {
  const sortedHarvests = [...harvests].sort((a, b) =>
    dayKey(a.doneAt).localeCompare(dayKey(b.doneAt)),
  )
  const periods: PlowStats[] = []

  if (sortedHarvests.length === 0) {
    periods.push(computePlowStats(plows, null, null, 'Tüm kayıtlar'))
    return periods
  }

  const last = sortedHarvests[sortedHarvests.length - 1]
  periods.push(
    computePlowStats(
      plows,
      last.doneAt,
      null,
      `Son hasattan bu yana (${dayKey(last.doneAt)})`,
    ),
  )

  if (sortedHarvests.length >= 2) {
    const prev = sortedHarvests[sortedHarvests.length - 2]
    periods.push(
      computePlowStats(
        plows,
        prev.doneAt,
        last.doneAt,
        `Hasat aralığı (${dayKey(prev.doneAt)} → ${dayKey(last.doneAt)})`,
      ),
    )
  }

  return periods
}
