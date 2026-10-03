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
import type { DebtAssetType, DebtDirection, DebtEvent } from '../../types'
import {
  debtNeedsMarketRate,
  fetchMarketRatesAsOf,
  todayIsoIstanbul,
  unitTryRate,
} from './marketRates'

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  receivable: 'Alacaklarım',
  payable: 'Vereceklerim',
}

export const DEBT_ASSET_TYPE_LABELS: Record<DebtAssetType, string> = {
  currency: 'Döviz',
  cash: 'Nakit',
  gold: 'Altın',
  other: 'Diğer',
}

/** Formda görünen sıra: Döviz, Nakit, Altın, Diğer */
export const DEBT_ASSET_TYPES: DebtAssetType[] = [
  'currency',
  'cash',
  'gold',
  'other',
]

export const DEBT_CURRENCY_OPTIONS = [
  'TRY',
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'SAR',
  'AED',
] as const

export const DEBT_GOLD_TYPE_OPTIONS = [
  'Gram',
  'Çeyrek',
  'Yarım',
  'Tam',
  'Ata',
  'Cumhuriyet',
  'Reşat',
  'Gremse',
] as const

export function debtCounterpartyLabel(direction: DebtDirection): string {
  return direction === 'receivable' ? 'Kimden' : 'Kime'
}

export function debtTakenAtLabel(direction: DebtDirection): string {
  return direction === 'receivable'
    ? 'Borç Verim Zamanı'
    : 'Borç Alım Zamanı'
}

export function debtPaidAtLabel(direction: DebtDirection): string {
  return direction === 'receivable'
    ? 'Ödenme Zamanı'
    : 'Borç Ödeme Zamanı'
}

export const createDebtSchema = z
  .object({
    direction: z.enum(['receivable', 'payable']),
    assetType: z.enum(['cash', 'currency', 'gold', 'other']),
    amount: z.coerce.number().positive('Miktar 0’dan büyük olmalı'),
    unit: z.string().trim().max(80).optional(),
    counterparty: z.string().trim().max(120).optional(),
    takenAt: z.string().trim().min(1, 'Tarih gerekli'),
    paidAt: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.assetType === 'cash' || data.assetType === 'currency') &&
      !data.unit?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['unit'],
        message: 'Döviz türü gerekli',
      })
    }
    if (data.assetType === 'gold' && !data.unit?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['unit'],
        message: 'Altın türü gerekli',
      })
    }
  })

export type CreateDebtInput = z.infer<typeof createDebtSchema>

export const updateDebtSchema = z
  .object({
    assetType: z.enum(['cash', 'currency', 'gold', 'other']).optional(),
    amount: z.coerce.number().positive('Miktar 0’dan büyük olmalı').optional(),
    unit: z.string().trim().max(80).optional(),
    counterparty: z.string().trim().max(120).optional(),
    takenAt: z.string().trim().min(1, 'Tarih gerekli').optional(),
    paidAt: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(500).optional(),
  })

export type UpdateDebtInput = z.infer<typeof updateDebtSchema>

function emptyToUndefined(value?: string | null): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function mapDebt(id: string, data: Record<string, unknown>): DebtEvent {
  const directionRaw = String(data.direction ?? 'receivable')
  const direction: DebtDirection =
    directionRaw === 'payable' ? 'payable' : 'receivable'
  const assetRaw = String(data.assetType ?? 'cash')
  const assetType: DebtAssetType =
    assetRaw === 'currency' ||
    assetRaw === 'gold' ||
    assetRaw === 'other' ||
    assetRaw === 'cash'
      ? assetRaw
      : 'other'

  const rateAtTaken =
    data.rateAtTakenTry != null ? Number(data.rateAtTakenTry) : NaN
  const rateAtPaid =
    data.rateAtPaidTry != null ? Number(data.rateAtPaidTry) : NaN

  return {
    id,
    direction,
    assetType,
    amount: Number(data.amount ?? 0),
    unit: data.unit ? String(data.unit) : undefined,
    counterparty: data.counterparty ? String(data.counterparty) : undefined,
    takenAt: String(data.takenAt ?? ''),
    dueAt: data.dueAt ? String(data.dueAt) : undefined,
    paidAt: data.paidAt ? String(data.paidAt) : undefined,
    rateAtTakenTry: Number.isFinite(rateAtTaken) ? rateAtTaken : undefined,
    rateAtPaidTry: Number.isFinite(rateAtPaid) ? rateAtPaid : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

async function lookupUnitRateTry(
  assetType: DebtAssetType,
  unit: string | undefined,
  direction: DebtDirection,
  asOfDate: string,
): Promise<number | null> {
  if (!debtNeedsMarketRate(assetType, unit)) return null
  try {
    const rates = await fetchMarketRatesAsOf(asOfDate.slice(0, 10))
    return unitTryRate(rates, assetType, unit, direction)
  } catch {
    return null
  }
}

function ratesDiffer(a: number | null | undefined, b: number | null): boolean {
  if (b == null) return false
  if (a == null || !Number.isFinite(a)) return true
  return Math.abs(a - b) > 0.01
}

function fmtTryAmount(value: number): string {
  return `${value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`
}

export type DebtRateSummary = {
  kind: 'entry' | 'diff'
  entryUnit: number
  entryTotal: number
  paidUnit?: number
  paidTotal?: number
  diff?: number
}

export function debtRateSummary(item: DebtEvent): DebtRateSummary | null {
  if (
    item.rateAtTakenTry == null ||
    !debtNeedsMarketRate(item.assetType, item.unit)
  ) {
    return null
  }
  const qty =
    item.assetType === 'gold' ? Math.round(item.amount) : item.amount
  const entryUnit = item.rateAtTakenTry
  const entryTotal = Number((qty * entryUnit).toFixed(2))
  if (item.rateAtPaidTry == null) {
    return { kind: 'entry', entryUnit, entryTotal }
  }
  const paidUnit = item.rateAtPaidTry
  const paidTotal = Number((qty * paidUnit).toFixed(2))
  const diff = Number((paidTotal - entryTotal).toFixed(2))
  return { kind: 'diff', entryUnit, entryTotal, paidUnit, paidTotal, diff }
}

export function formatDebtRateDiff(item: DebtEvent): string | null {
  const s = debtRateSummary(item)
  if (!s || s.kind !== 'diff' || s.paidTotal == null || s.diff == null) {
    return null
  }
  const sign = s.diff > 0 ? '+' : ''
  return `Giriş ${fmtTryAmount(s.entryTotal)} · Ödeme ${fmtTryAmount(s.paidTotal)} · Fark ${sign}${fmtTryAmount(s.diff)}`
}

export function formatDebtEntryRate(item: DebtEvent): string | null {
  const s = debtRateSummary(item)
  if (!s) return null
  return `Giriş kuru ${fmtTryAmount(s.entryUnit)}/birim · ≈ ${fmtTryAmount(s.entryTotal)}`
}

export function formatDebtAmount(
  item: Pick<DebtEvent, 'amount' | 'unit' | 'assetType'>,
): string {
  if (item.assetType === 'gold') {
    const qty = Math.round(item.amount).toLocaleString('tr-TR')
    const kind = item.unit?.trim() || 'altın'
    return `${qty} adet ${kind}`
  }
  const qty = item.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
  if (item.unit?.trim()) return `${qty} ${item.unit.trim()}`
  if (item.assetType === 'cash') return `${qty} TRY`
  return qty
}

export function subscribeDebtEvents(
  farmId: string,
  onData: (items: DebtEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'debtEvents'),
    orderBy('takenAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapDebt(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

export async function createDebtEvent(
  farmId: string,
  input: CreateDebtInput,
  createdBy: string,
): Promise<string> {
  const parsed = createDebtSchema.parse(input)
  const now = new Date().toISOString()
  const amount =
    parsed.assetType === 'gold'
      ? Math.round(parsed.amount)
      : Number(parsed.amount.toFixed(2))
  const paidAt = emptyToUndefined(parsed.paidAt) || null

  let rateAtTakenTry: number | null = null
  let rateAtPaidTry: number | null = null
  if (debtNeedsMarketRate(parsed.assetType, parsed.unit)) {
    rateAtTakenTry = await lookupUnitRateTry(
      parsed.assetType,
      parsed.unit,
      parsed.direction,
      parsed.takenAt,
    )
    if (paidAt) {
      rateAtPaidTry = await lookupUnitRateTry(
        parsed.assetType,
        parsed.unit,
        parsed.direction,
        paidAt,
      )
    }
  }

  const ref = await addDoc(collection(db, 'farms', farmId, 'debtEvents'), {
    direction: parsed.direction,
    assetType: parsed.assetType,
    amount,
    unit: emptyToUndefined(parsed.unit) || null,
    counterparty: emptyToUndefined(parsed.counterparty) || null,
    takenAt: parsed.takenAt,
    dueAt: null,
    paidAt,
    rateAtTakenTry,
    rateAtPaidTry,
    notes: emptyToUndefined(parsed.notes) || null,
    createdBy,
    createdAt: serverTimestamp(),
    createdAtIso: now,
  })
  return ref.id
}

export async function updateDebtEvent(
  farmId: string,
  eventId: string,
  input: UpdateDebtInput,
  /** Kur hesabı için mevcut kayıt */
  current?: Pick<
    DebtEvent,
    | 'assetType'
    | 'unit'
    | 'direction'
    | 'takenAt'
    | 'paidAt'
    | 'rateAtTakenTry'
    | 'rateAtPaidTry'
  >,
): Promise<void> {
  const parsed = updateDebtSchema.parse(input)
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedAtIso: new Date().toISOString(),
    dueAt: null,
  }
  if (parsed.assetType !== undefined) patch.assetType = parsed.assetType
  if (parsed.amount !== undefined) {
    const assetType = parsed.assetType ?? current?.assetType
    patch.amount =
      assetType === 'gold'
        ? Math.round(parsed.amount)
        : Number(parsed.amount.toFixed(2))
  }
  if (parsed.unit !== undefined) {
    patch.unit = emptyToUndefined(parsed.unit) || null
  }
  if (parsed.counterparty !== undefined) {
    patch.counterparty = emptyToUndefined(parsed.counterparty) || null
  }
  if (parsed.takenAt !== undefined) patch.takenAt = parsed.takenAt
  if (parsed.paidAt !== undefined) {
    patch.paidAt = emptyToUndefined(parsed.paidAt) || null
  }
  if (parsed.notes !== undefined) {
    patch.notes = emptyToUndefined(parsed.notes) || null
  }

  const assetType = parsed.assetType ?? current?.assetType
  const unit = parsed.unit !== undefined ? parsed.unit : current?.unit
  const direction = current?.direction
  const takenAt = parsed.takenAt ?? current?.takenAt
  const nextPaid =
    parsed.paidAt !== undefined
      ? emptyToUndefined(parsed.paidAt) || null
      : current?.paidAt ?? null

  const entryFieldsChanged =
    parsed.takenAt !== undefined ||
    parsed.assetType !== undefined ||
    parsed.unit !== undefined

  if (
    assetType &&
    direction &&
    takenAt &&
    debtNeedsMarketRate(assetType, unit)
  ) {
    if (entryFieldsChanged || current?.rateAtTakenTry == null) {
      const entryRate = await lookupUnitRateTry(
        assetType,
        unit,
        direction,
        takenAt,
      )
      if (entryRate != null) patch.rateAtTakenTry = entryRate
    }

    if (!nextPaid) {
      if (parsed.paidAt !== undefined) patch.rateAtPaidTry = null
    } else if (
      parsed.paidAt !== undefined ||
      entryFieldsChanged ||
      current?.rateAtPaidTry == null
    ) {
      const paidRate = await lookupUnitRateTry(
        assetType,
        unit,
        direction,
        nextPaid,
      )
      if (paidRate != null) patch.rateAtPaidTry = paidRate
    }
  } else if (parsed.paidAt !== undefined && !nextPaid) {
    patch.rateAtPaidTry = null
  }

  await updateDoc(doc(db, 'farms', farmId, 'debtEvents', eventId), patch)
}

export async function markDebtPaid(
  farmId: string,
  item: Pick<
    DebtEvent,
    'id' | 'assetType' | 'unit' | 'direction' | 'paidAt' | 'rateAtTakenTry'
  >,
  paidAt = todayIsoIstanbul(),
): Promise<void> {
  const patch: Record<string, unknown> = {
    paidAt,
    updatedAt: serverTimestamp(),
    updatedAtIso: new Date().toISOString(),
  }

  if (debtNeedsMarketRate(item.assetType, item.unit)) {
    const paidRate = await lookupUnitRateTry(
      item.assetType,
      item.unit,
      item.direction,
      paidAt,
    )
    if (paidRate != null) patch.rateAtPaidTry = paidRate
  }

  await updateDoc(doc(db, 'farms', farmId, 'debtEvents', item.id), patch)
}

/**
 * Eski kayıtlardaki “bugünün kuru”nu takenAt / paidAt tarihsel kuruyla düzeltir.
 */
export async function backfillDebtHistoricalRates(
  farmId: string,
  items: DebtEvent[],
): Promise<number> {
  let updated = 0
  for (const item of items) {
    if (!debtNeedsMarketRate(item.assetType, item.unit)) continue
    if (!item.takenAt) continue

    const patch: Record<string, unknown> = {}
    const entryRate = await lookupUnitRateTry(
      item.assetType,
      item.unit,
      item.direction,
      item.takenAt,
    )
    if (ratesDiffer(item.rateAtTakenTry, entryRate)) {
      patch.rateAtTakenTry = entryRate
    }

    if (item.paidAt) {
      const paidRate = await lookupUnitRateTry(
        item.assetType,
        item.unit,
        item.direction,
        item.paidAt,
      )
      if (ratesDiffer(item.rateAtPaidTry, paidRate)) {
        patch.rateAtPaidTry = paidRate
      }
    }

    if (Object.keys(patch).length === 0) continue
    patch.updatedAt = serverTimestamp()
    patch.updatedAtIso = new Date().toISOString()
    await updateDoc(doc(db, 'farms', farmId, 'debtEvents', item.id), patch)
    updated += 1
  }
  return updated
}

/** Yanlışlıkla “Ödendi” işaretini geri alır */
export async function markDebtUnpaid(
  farmId: string,
  eventId: string,
): Promise<void> {
  await updateDebtEvent(farmId, eventId, { paidAt: '' })
}

export async function deleteDebtEvent(
  farmId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'farms', farmId, 'debtEvents', eventId))
}
