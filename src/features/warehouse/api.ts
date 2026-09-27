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
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { z } from 'zod'
import { db } from '../../lib/firebase'
import type { SaleEvent, WarehouseStockItem } from '../../types'
import {
  BEN_FISTIK,
  BOZ_FISTIK,
  isOliveOilStock,
  isPlainFistikStock,
  litersToTeneke,
  stockUnitLabel,
  warehouseDeltaFromHarvest,
} from './harvestProducts'

function normalizeSpeciesKey(species: string): string {
  return species.trim().toLocaleLowerCase('tr-TR')
}

/** Depoda hasattan gelen fıstık / zeytinyağı satırları */
function isHarvestDepotSpecies(species?: string | null): boolean {
  if (!species?.trim()) return false
  if (isOliveOilStock(species) || isPlainFistikStock(species)) return true
  const s = normalizeSpeciesKey(species)
  return (
    s === normalizeSpeciesKey(BOZ_FISTIK) ||
    s === normalizeSpeciesKey(BEN_FISTIK) ||
    s.includes('fıstık') ||
    s.includes('fistik')
  )
}

export const createSaleSchema = z.object({
  doneAt: z.string().trim().min(1, 'Tarih gerekli'),
  species: z.string().trim().min(1, 'Çeşit gerekli').max(80),
  soldKg: z.coerce.number().positive('Satılan kilo 0’dan büyük olmalı'),
  unitPrice: z.coerce.number().min(0, 'Birim fiyat 0 veya daha büyük olmalı'),
  notes: z.string().trim().max(500).optional(),
})

export type CreateSaleInput = z.infer<typeof createSaleSchema>

export const createManualStockSchema = z.object({
  species: z.string().trim().min(1, 'Ürün adı gerekli').max(80),
  kg: z.coerce.number().positive('Stok kilosu 0’dan büyük olmalı'),
  startedAt: z.string().trim().min(1, 'Başlangıç tarihi gerekli'),
  notes: z.string().trim().max(500).optional(),
})

export type CreateManualStockInput = z.infer<typeof createManualStockSchema>

export function saleEarnings(input: {
  soldKg: number
  unitPrice: number
  species?: string
}): number {
  if (isOliveOilStock(input.species)) {
    const teneke = litersToTeneke(input.soldKg)
    return Number((teneke * input.unitPrice).toFixed(2))
  }
  return Number((input.soldKg * input.unitPrice).toFixed(2))
}

function mapStock(
  id: string,
  data: Record<string, unknown>,
): WarehouseStockItem {
  const source =
    data.source === 'manual' || data.source === 'harvest'
      ? data.source
      : undefined
  return {
    id,
    species: String(data.species ?? ''),
    kg: Number(data.kg ?? 0),
    updatedAt: String(data.updatedAtIso ?? ''),
    startedAt: data.startedAt ? String(data.startedAt) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    source,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  }
}

function mapSale(id: string, data: Record<string, unknown>): SaleEvent {
  const soldKg = Number(data.soldKg ?? 0)
  const unitPrice = Number(data.unitPrice ?? 0)
  const stored = data.earnings !== undefined && data.earnings !== null
    ? Number(data.earnings)
    : saleEarnings({ soldKg, unitPrice, species: String(data.species ?? '') })
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

/** Aynı çeşit için kararlı doküman kimliği (çok cihazlı yarışı azaltır). */
function warehouseStockDocId(species: string): string {
  return `s_${encodeURIComponent(species.trim()).replace(/%/g, '_')}`
}

/** Hasat girişi / düzeltme / silme / satış için depo kilosunu günceller. */
export async function adjustWarehouseStock(
  farmId: string,
  species: string,
  deltaKg: number,
  options?: { startedAt?: string },
): Promise<void> {
  const name = species.trim()
  if (!name || !deltaKg) return

  const harvestStartedAt = options?.startedAt?.trim().slice(0, 10) || undefined

  const q = query(
    collection(db, 'farms', farmId, 'warehouseStock'),
    where('species', '==', name),
  )
  const snap = await getDocs(q)
  const now = new Date().toISOString()
  const preferredRef = snap.empty
    ? doc(db, 'farms', farmId, 'warehouseStock', warehouseStockDocId(name))
    : snap.docs[0].ref

  await runTransaction(db, async (transaction) => {
    const fresh = await transaction.get(preferredRef)
    if (!fresh.exists()) {
      if (deltaKg < 0) {
        throw new Error(`Depoda “${name}” stoğu yok`)
      }
      transaction.set(preferredRef, {
        species: name,
        kg: Number(deltaKg.toFixed(2)),
        ...(harvestStartedAt ? { startedAt: harvestStartedAt } : {}),
        source: 'harvest',
        updatedAt: serverTimestamp(),
        updatedAtIso: now,
      })
      return
    }

    const data = fresh.data() ?? {}
    const current = Number(data.kg ?? 0)
    const next = Number((current + deltaKg).toFixed(2))
    if (next < -0.001) {
      const unit = stockUnitLabel(name)
      throw new Error(
        `Depoda yeterli “${name}” yok (mevcut: ${current.toLocaleString('tr-TR')} ${unit})`,
      )
    }

    const patch: Record<string, unknown> = {
      kg: Math.max(0, next),
      updatedAt: serverTimestamp(),
      updatedAtIso: now,
    }

    // Hasattan gelen pozitif stok: başlangıç = en erken hasat tarihi
    if (deltaKg > 0 && harvestStartedAt) {
      const existingStarted = data.startedAt
        ? String(data.startedAt).slice(0, 10)
        : ''
      patch.startedAt =
        existingStarted && existingStarted < harvestStartedAt
          ? existingStarted
          : harvestStartedAt
      if (!data.source) patch.source = 'harvest'
    }

    transaction.update(preferredRef, patch)
  })
}

/** Depo kilosunu mutlak değer olarak yazar (yoksa oluşturur). */
export async function setWarehouseStockKg(
  farmId: string,
  species: string,
  kg: number,
): Promise<void> {
  const name = species.trim()
  if (!name) return
  const nextKg = Math.max(0, Number(kg.toFixed(2)))
  const now = new Date().toISOString()

  const q = query(
    collection(db, 'farms', farmId, 'warehouseStock'),
    where('species', '==', name),
  )
  const snap = await getDocs(q)
  const preferredRef = snap.empty
    ? doc(db, 'farms', farmId, 'warehouseStock', warehouseStockDocId(name))
    : snap.docs[0].ref

  await runTransaction(db, async (transaction) => {
    const fresh = await transaction.get(preferredRef)
    if (!fresh.exists()) {
      if (nextKg <= 0) return
      transaction.set(preferredRef, {
        species: name,
        kg: nextKg,
        updatedAt: serverTimestamp(),
        updatedAtIso: now,
      })
      return
    }
    transaction.update(preferredRef, {
      kg: nextKg,
      updatedAt: serverTimestamp(),
      updatedAtIso: now,
    })
  })
}

/**
 * Eski tek satır “Fıstık” stoğunu Boz (450 kg) + Ben (15 kg) olarak ayırır.
 * Bir kez çalışır (farms/{id}/config/migrations).
 */
export async function ensureFistikWarehouseSplit(farmId: string): Promise<void> {
  const flagRef = doc(db, 'farms', farmId, 'config', 'migrations')
  const flagSnap = await getDoc(flagRef)
  if (flagSnap.exists() && flagSnap.data()?.fistikHarvestSplit === true) {
    return
  }

  const stockSnap = await getDocs(
    collection(db, 'farms', farmId, 'warehouseStock'),
  )
  const plainDocs = stockSnap.docs.filter((d) =>
    isPlainFistikStock(String(d.data().species ?? '')),
  )

  if (plainDocs.length > 0) {
    await setWarehouseStockKg(farmId, BOZ_FISTIK, 450)
    await setWarehouseStockKg(farmId, BEN_FISTIK, 15)
    await Promise.all(plainDocs.map((d) => deleteDoc(d.ref)))
  }

  await setDoc(
    flagRef,
    {
      fistikHarvestSplit: true,
      fistikHarvestSplitAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/**
 * Fıstık / zeytinyağı depo satırlarının stok başlangıcını en erken hasat
 * tarihine çeker (eksik veya daha geç olanları günceller).
 */
export async function syncHarvestStockStartedAt(farmId: string): Promise<void> {
  const fieldsSnap = await getDocs(collection(db, 'farms', farmId, 'fields'))
  const earliestBySpecies = new Map<string, string>()

  await Promise.all(
    fieldsSnap.docs.map(async (fieldDoc) => {
      const harvestSnap = await getDocs(
        collection(
          db,
          'farms',
          farmId,
          'fields',
          fieldDoc.id,
          'harvestEvents',
        ),
      )
      for (const h of harvestSnap.docs) {
        const data = h.data()
        const doneAt = String(data.doneAt ?? '').slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(doneAt)) continue
        const species = data.species ? String(data.species) : ''
        const kg = Number(data.estimatedKg ?? 0)
        const verim =
          data.verim === null || data.verim === undefined
            ? undefined
            : Number(data.verim)
        const delta = warehouseDeltaFromHarvest(species, kg, verim)
        if (!delta || !isHarvestDepotSpecies(delta.species)) continue
        const key = delta.species
        const prev = earliestBySpecies.get(key)
        if (!prev || doneAt < prev) earliestBySpecies.set(key, doneAt)
      }
    }),
  )

  if (earliestBySpecies.size === 0) return

  const stockSnap = await getDocs(
    collection(db, 'farms', farmId, 'warehouseStock'),
  )
  const now = new Date().toISOString()
  await Promise.all(
    stockSnap.docs.map(async (d) => {
      const species = String(d.data().species ?? '')
      if (!isHarvestDepotSpecies(species)) return
      const earliest = earliestBySpecies.get(species)
      if (!earliest) return
      const current = d.data().startedAt
        ? String(d.data().startedAt).slice(0, 10)
        : ''
      if (current && current <= earliest) return
      await setDoc(
        d.ref,
        {
          startedAt: earliest,
          updatedAt: serverTimestamp(),
          updatedAtIso: now,
        },
        { merge: true },
      )
    }),
  )
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

/**
 * Elle depo ürünü ekler (ör. buğday). Aynı ürün adı varsa kiloyu biriktirir;
 * başlangıç tarihini en erken değerde tutar. Satış ekranında seçilebilir.
 */
export async function addManualWarehouseStock(
  farmId: string,
  input: CreateManualStockInput,
  createdBy: string,
): Promise<string> {
  const parsed = createManualStockSchema.parse(input)
  const name = parsed.species
  const addKg = Number(parsed.kg.toFixed(2))
  const now = new Date().toISOString()

  const q = query(
    collection(db, 'farms', farmId, 'warehouseStock'),
    where('species', '==', name),
  )
  const snap = await getDocs(q)
  const preferredRef = snap.empty
    ? doc(db, 'farms', farmId, 'warehouseStock', warehouseStockDocId(name))
    : snap.docs[0].ref

  await runTransaction(db, async (transaction) => {
    const fresh = await transaction.get(preferredRef)
    if (!fresh.exists()) {
      transaction.set(preferredRef, {
        species: name,
        kg: addKg,
        startedAt: parsed.startedAt,
        notes: parsed.notes || null,
        source: 'manual',
        createdBy,
        updatedAt: serverTimestamp(),
        updatedAtIso: now,
        createdAt: serverTimestamp(),
        createdAtIso: now,
      })
      return
    }

    const data = fresh.data() ?? {}
    const current = Number(data.kg ?? 0)
    const next = Number((current + addKg).toFixed(2))
    const existingStarted = data.startedAt ? String(data.startedAt) : ''
    const startedAt =
      existingStarted && existingStarted < parsed.startedAt
        ? existingStarted
        : parsed.startedAt
    const existingNotes = data.notes ? String(data.notes) : ''
    const notes =
      parsed.notes && parsed.notes !== existingNotes
        ? [existingNotes, parsed.notes].filter(Boolean).join(' · ') || null
        : existingNotes || parsed.notes || null

    transaction.update(preferredRef, {
      kg: next,
      startedAt,
      notes,
      ...(data.source ? {} : { source: 'manual' }),
      updatedAt: serverTimestamp(),
      updatedAtIso: now,
    })
  })

  return preferredRef.id
}

/** Yanlış eklenen depo satırını tamamen siler. */
export async function deleteWarehouseStock(
  farmId: string,
  stockId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'farms', farmId, 'warehouseStock', stockId))
}
