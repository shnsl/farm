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
  return direction === 'receivable' ? 'Kime' : 'Kimden'
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
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
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
  const ref = await addDoc(collection(db, 'farms', farmId, 'debtEvents'), {
    direction: parsed.direction,
    assetType: parsed.assetType,
    amount,
    unit: emptyToUndefined(parsed.unit) || null,
    counterparty: emptyToUndefined(parsed.counterparty) || null,
    takenAt: parsed.takenAt,
    dueAt: null,
    paidAt: emptyToUndefined(parsed.paidAt) || null,
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
): Promise<void> {
  const parsed = updateDebtSchema.parse(input)
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedAtIso: new Date().toISOString(),
    dueAt: null,
  }
  if (parsed.assetType !== undefined) patch.assetType = parsed.assetType
  if (parsed.amount !== undefined) {
    const assetType = parsed.assetType
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
  await updateDoc(doc(db, 'farms', farmId, 'debtEvents', eventId), patch)
}

export async function markDebtPaid(
  farmId: string,
  eventId: string,
  paidAt = new Date().toISOString().slice(0, 10),
): Promise<void> {
  await updateDebtEvent(farmId, eventId, { paidAt })
}

export async function deleteDebtEvent(
  farmId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'farms', farmId, 'debtEvents', eventId))
}
