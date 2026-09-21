import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { z } from 'zod'
import { db } from '../../lib/firebase'
import type { SaleEvent, WarehouseStockItem } from '../../types'

export const createSaleSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  species: z.string().trim().min(1, 'Çeşit gerekli').max(80),
  soldKg: z.coerce.number().positive('Satılan kilo 0’dan büyük olmalı'),
  unitPrice: z.coerce.number().min(0, 'Birim fiyat 0 veya daha büyük olmalı'),
  notes: z.string().trim().max(500).optional(),
})

export type CreateSaleInput = z.infer<typeof createSaleSchema>

export function saleEarnings(input: {
  soldKg: number
  unitPrice: number
}): number {
  return Number((input.soldKg * input.unitPrice).toFixed(2))
}

function mapStock(
  id: string,
  data: Record<string, unknown>,
): WarehouseStockItem {
  return {
    id,
    species: String(data.species ?? ''),
    kg: Number(data.kg ?? 0),
    updatedAt: String(data.updatedAtIso ?? ''),
  }
}

function mapSale(id: string, data: Record<string, unknown>): SaleEvent {
  const soldKg = Number(data.soldKg ?? 0)
  const unitPrice = Number(data.unitPrice ?? 0)
  const stored = data.earnings !== undefined && data.earnings !== null
    ? Number(data.earnings)
    : saleEarnings({ soldKg, unitPrice })
  return {
    id,
    doneAt: String(data.doneAt ?? ''),
    species: String(data.species ?? ''),
    soldKg,
    unitPrice,
    earnings: stored,
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAtIso ?? ''),
  }
}

export function subscribeWarehouseStock(
  farmId: string,
  onData: (items: WarehouseStockItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'warehouseStock'),
    orderBy('species', 'asc'),
  )
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => mapStock(d.id, d.data()))
          .filter((i) => i.kg > 0 || i.species),
      ),
    (err) => onError?.(err),
  )
}

export function subscribeSales(
  farmId: string,
  onData: (events: SaleEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'farms', farmId, 'salesEvents'),
    orderBy('doneAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapSale(d.id, d.data()))),
    (err) => onError?.(err),
  )
}

/** Hasat girişi / düzeltme / silme için depo kilosunu günceller. */
export async function adjustWarehouseStock(
  farmId: string,
  species: string,
  deltaKg: number,
): Promise<void> {
  const name = species.trim()
  if (!name || !deltaKg) return

  const q = query(
    collection(db, 'farms', farmId, 'warehouseStock'),
    where('species', '==', name),
  )
  const snap = await getDocs(q)
  const now = new Date().toISOString()

  if (snap.empty) {
    if (deltaKg < 0) {
      throw new Error(`Depoda “${name}” stoğu yok`)
    }
    await addDoc(collection(db, 'farms', farmId, 'warehouseStock'), {
      species: name,
      kg: Number(deltaKg.toFixed(2)),
      updatedAt: serverTimestamp(),
      updatedAtIso: now,
    })
    return
  }

  const ref = snap.docs[0].ref
  const current = Number(snap.docs[0].data().kg ?? 0)
  const next = Number((current + deltaKg).toFixed(2))
  if (next < -0.001) {
    throw new Error(
      `Depoda yeterli “${name}” yok (mevcut: ${current.toLocaleString('tr-TR')} kg)`,
    )
  }
  await updateDoc(ref, {
    kg: Math.max(0, next),
    updatedAt: serverTimestamp(),
    updatedAtIso: now,
  })
}

export async function createSale(
  farmId: string,
  input: CreateSaleInput,
  createdBy: string,
): Promise<string> {
  const parsed = createSaleSchema.parse(input)
  const earnings = saleEarnings(parsed)

  await adjustWarehouseStock(farmId, parsed.species, -parsed.soldKg)

  const now = new Date().toISOString()
  try {
    const ref = await addDoc(collection(db, 'farms', farmId, 'salesEvents'), {
      doneAt: parsed.doneAt,
      species: parsed.species,
      soldKg: parsed.soldKg,
      unitPrice: parsed.unitPrice,
      earnings,
      notes: parsed.notes || null,
      createdBy,
      createdAt: serverTimestamp(),
      createdAtIso: now,
    })
    return ref.id
  } catch (err) {
    // Satış kaydı yazılamazsa stoğu geri koy
    await adjustWarehouseStock(farmId, parsed.species, parsed.soldKg)
    throw err
  }
}

export async function deleteSale(
  farmId: string,
  eventId: string,
  options?: { restoreToDepot?: boolean },
): Promise<void> {
  const restoreToDepot = options?.restoreToDepot ?? false
  const ref = doc(db, 'farms', farmId, 'salesEvents', eventId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const species = String(data.species ?? '')
  const soldKg = Number(data.soldKg ?? 0)
  await deleteDoc(ref)
  if (restoreToDepot && species && soldKg) {
    await adjustWarehouseStock(farmId, species, soldKg)
  }
}
