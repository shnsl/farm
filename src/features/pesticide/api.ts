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
import type { PesticideExpenseEvent, PesticideStockItem } from '../../types'

export const createPesticideStockSchema = z.object({
  name: z.string().trim().min(1, 'İlaç adı gerekli').max(80),
  expiresAt: z.string().trim().min(1, 'Miat tarihi gerekli'),
  quantityPieces: z.coerce
    .number()
    .int()
    .min(0, 'Tane 0 veya daha büyük olmalı'),
  quantityMl: z.coerce.number().min(0, 'Mililitre 0 veya daha büyük olmalı'),
  treeSpecies: z.string().trim().min(1, 'Ağaç çeşidi gerekli').max(80),
  doseWaterLiters: z.coerce
    .number()
    .positive('Kullanım dozu 0’dan büyük olmalı'),
  notes: z.string().trim().max(500).optional(),
})

export const createPesticideExpenseSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  pesticideName: z.string().trim().max(80).optional(),
  cost: z.coerce.number().min(0, 'Masraf 0 veya daha büyük olmalı'),
  notes: z.string().trim().max(500).optional(),
})

export type CreatePesticideStockInput = z.infer<
  typeof createPesticideStockSchema
>
export type CreatePesticideExpenseInput = z.infer<
  typeof createPesticideExpenseSchema
>

function mapStock(
  id: string,
  data: Record<string, unknown>,
): PesticideStockItem {
  return {
    id,
    name: String(data.name ?? ''),
    expiresAt: String(data.expiresAt ?? ''),
    quantityPieces: Number(data.quantityPieces ?? 0),
    quantityMl: Number(data.quantityMl ?? 0),
    treeSpecies: String(data.treeSpecies ?? ''),
    doseWaterLiters: Number(data.doseWaterLiters ?? 0),
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

function mapExpense(
  id: string,
  data: Record<string, unknown>,
): PesticideExpenseEvent {
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    pesticideName: data.pesticideName
      ? String(data.pesticideName)
      : undefined,
    cost: Number(data.cost ?? 0),
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

export function subscribePesticideStock(
  farmId: string,
  onData: (items: PesticideStockItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'pesticideStock'),
    orderBy('name', 'asc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapStock(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

export function subscribePesticideExpenses(
  farmId: string,
  onData: (events: PesticideExpenseEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'pesticideExpenses'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapExpense(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

export async function createPesticideStock(
  farmId: string,
  input: CreatePesticideStockInput,
  createdBy: string,
): Promise<string> {
  const parsed = createPesticideStockSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(
    collection(db, 'farms', farmId, 'pesticideStock'),
    {
      name: parsed.name,
      expiresAt: parsed.expiresAt,
      quantityPieces: parsed.quantityPieces,
      quantityMl: parsed.quantityMl,
      treeSpecies: parsed.treeSpecies,
      doseWaterLiters: parsed.doseWaterLiters,
      notes: parsed.notes || null,
      createdBy,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    },
  )
  return ref.id
}

export async function updatePesticideStock(
  farmId: string,
  itemId: string,
  input: CreatePesticideStockInput,
): Promise<void> {
  const parsed = createPesticideStockSchema.parse(input)
  await updateDoc(doc(db, 'farms', farmId, 'pesticideStock', itemId), {
    name: parsed.name,
    expiresAt: parsed.expiresAt,
    quantityPieces: parsed.quantityPieces,
    quantityMl: parsed.quantityMl,
    treeSpecies: parsed.treeSpecies,
    doseWaterLiters: parsed.doseWaterLiters,
    notes: parsed.notes || null,
  })
}

export async function deletePesticideStock(
  farmId: string,
  itemId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'farms', farmId, 'pesticideStock', itemId))
}

export async function createPesticideExpense(
  farmId: string,
  input: CreatePesticideExpenseInput,
  createdBy: string,
): Promise<string> {
  const parsed = createPesticideExpenseSchema.parse(input)
  const now = new Date().toISOString()
  const ref = await addDoc(
    collection(db, 'farms', farmId, 'pesticideExpenses'),
    {
      doneAt: parsed.doneAt,
      pesticideName: parsed.pesticideName || null,
      cost: parsed.cost,
      notes: parsed.notes || null,
      createdBy,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    },
  )
  return ref.id
}

export async function updatePesticideExpense(
  farmId: string,
  eventId: string,
  input: CreatePesticideExpenseInput,
): Promise<void> {
  const parsed = createPesticideExpenseSchema.parse(input)
  await updateDoc(doc(db, 'farms', farmId, 'pesticideExpenses', eventId), {
    doneAt: parsed.doneAt,
    pesticideName: parsed.pesticideName || null,
    cost: parsed.cost,
    notes: parsed.notes || null,
  })
}

export async function deletePesticideExpense(
  farmId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'farms', farmId, 'pesticideExpenses', eventId))
}
