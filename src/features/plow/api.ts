import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { z } from 'zod'
import { db } from '../../lib/firebase'
import type {
  HarvestEvent,
  PlowDirection,
  PlowEvent,
} from '../../types'
import { adjustWarehouseStock } from '../warehouse/api'

export const PLOW_DIRECTION_LABELS: Record<PlowDirection, string> = {
  enine: 'Enine',
  boyuna: 'Boyuna',
}

export const createPlowSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  direction: z.enum(['enine', 'boyuna']),
  equipment: z.string().trim().min(1, 'Ekipman gerekli').max(80),
  notes: z.string().trim().max(500).optional(),
})

export const createHarvestSchema = z
  .object({
    doneAt: z.string().trim().min(1, 'Tarih gerekli'),
    workerCount: z.coerce
      .number()
      .int()
      .min(0, 'İşçi sayısı 0 veya daha büyük olmalı'),
    dailyWage: z.coerce.number().min(0, 'Yevmiye 0 veya daha büyük olmalı'),
    totalPaid: z.coerce
      .number()
      .min(0, 'Toplam ödeme 0 veya daha büyük olmalı'),
    estimatedKg: z.coerce
      .number()
      .min(0, 'Tahmini kilo 0 veya daha büyük olmalı')
      .optional(),
    species: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.estimatedKg ?? 0) > 0 && !data.species?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kilo girildiyse çeşit gerekli',
        path: ['species'],
      })
    }
  })

export type CreatePlowInput = z.infer<typeof createPlowSchema>
export type CreateHarvestInput = z.infer<typeof createHarvestSchema>

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

function mapPlow(id: string, data: Record<string, unknown>): PlowEvent {
  const equipment = data.equipment ? String(data.equipment).trim() : undefined
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    direction: (data.direction as PlowDirection) || 'enine',
    equipment: equipment || undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

function mapHarvest(id: string, data: Record<string, unknown>): HarvestEvent {
  const species = data.species ? String(data.species).trim() : undefined
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    workerCount: Number(data.workerCount ?? 0),
    dailyWage: Number(data.dailyWage ?? 0),
    totalPaid: Number(data.totalPaid ?? 0),
    estimatedKg: optionalNumber(data.estimatedKg),
    species: species || undefined,
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
      equipment: parsed.equipment,
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
  const kg = parsed.estimatedKg ?? 0
  const species = parsed.species?.trim() || ''

  if (kg > 0 && species) {
    await adjustWarehouseStock(farmId, species, kg)
  }

  try {
    const ref = await addDoc(
      collection(db, 'farms', farmId, 'fields', fieldId, 'harvestEvents'),
      {
        doneAt: parsed.doneAt,
        workerCount: parsed.workerCount,
        dailyWage: parsed.dailyWage,
        totalPaid: parsed.totalPaid,
        estimatedKg: parsed.estimatedKg === undefined ? null : parsed.estimatedKg,
        species: species || null,
        notes: parsed.notes || null,
        createdBy,
        createdAt: serverTimestamp(),
        createdAtIso: now,
      },
    )
    return ref.id
  } catch (err) {
    if (kg > 0 && species) {
      await adjustWarehouseStock(farmId, species, -kg)
    }
    throw err
  }
}

export async function updateHarvestEvent(
  farmId: string,
  fieldId: string,
  eventId: string,
  input: CreateHarvestInput,
): Promise<void> {
  const parsed = createHarvestSchema.parse(input)
  const ref = doc(db, 'farms', farmId, 'fields', fieldId, 'harvestEvents', eventId)
  const prevSnap = await getDoc(ref)
  const prev = prevSnap.exists() ? mapHarvest(eventId, prevSnap.data()) : null

  const oldKg = prev?.estimatedKg ?? 0
  const oldSpecies = prev?.species?.trim() || ''
  const newKg = parsed.estimatedKg ?? 0
  const newSpecies = parsed.species?.trim() || ''

  if (oldKg > 0 && oldSpecies) {
    await adjustWarehouseStock(farmId, oldSpecies, -oldKg)
  }
  try {
    if (newKg > 0 && newSpecies) {
      await adjustWarehouseStock(farmId, newSpecies, newKg)
    }
  } catch (err) {
    if (oldKg > 0 && oldSpecies) {
      await adjustWarehouseStock(farmId, oldSpecies, oldKg)
    }
    throw err
  }

  try {
    await updateDoc(ref, {
      doneAt: parsed.doneAt,
      workerCount: parsed.workerCount,
      dailyWage: parsed.dailyWage,
      totalPaid: parsed.totalPaid,
      estimatedKg: parsed.estimatedKg === undefined ? null : parsed.estimatedKg,
      species: newSpecies || null,
      notes: parsed.notes || null,
    })
  } catch (err) {
    if (newKg > 0 && newSpecies) {
      await adjustWarehouseStock(farmId, newSpecies, -newKg)
    }
    if (oldKg > 0 && oldSpecies) {
      await adjustWarehouseStock(farmId, oldSpecies, oldKg)
    }
    throw err
  }
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
  const ref = doc(db, 'farms', farmId, 'fields', fieldId, 'harvestEvents', eventId)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const h = mapHarvest(eventId, snap.data())
    const kg = h.estimatedKg ?? 0
    const species = h.species?.trim() || ''
    if (kg > 0 && species) {
      await adjustWarehouseStock(farmId, species, -kg)
    }
  }
  await deleteDoc(ref)
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
