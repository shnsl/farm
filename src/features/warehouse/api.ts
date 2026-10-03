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
  type DocumentData,
  type QueryDocumentSnapshot,
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

/** Türkçe büyük/küçük harf duyarsız ürün anahtarı (Buğday = buğday) */
export function normalizeSpeciesKey(species: string): string {
  return species.trim().toLocaleLowerCase('tr-TR')
}

export function sameSpecies(a: string, b: string): boolean {
  return normalizeSpeciesKey(a) === normalizeSpeciesKey(b)
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

type StockDocSnap = QueryDocumentSnapshot<DocumentData>

function stockData(data: DocumentData | undefined): Record<string, unknown> {
  return (data ?? {}) as Record<string, unknown>
}

async function listStockDocsBySpeciesKey(
  farmId: string,
  species: string,
): Promise<StockDocSnap[]> {
  const key = normalizeSpeciesKey(species)
  if (!key) return []
  const snap = await getDocs(
    collection(db, 'farms', farmId, 'warehouseStock'),
  )
  return snap.docs.filter(
    (d) =>
      normalizeSpeciesKey(String(stockData(d.data()).species ?? '')) === key,
  )
}

function pickDisplaySpecies(
  matches: StockDocSnap[],
  fallback: string,
): string {
  if (matches.length === 0) return fallback.trim()
  // Mevcut kayıt adını koru (kullanıcının ilk yazımı)
  const named = matches
    .map((d) => String(stockData(d.data()).species ?? '').trim())
    .find((s) => s.length > 0)
  return named || fallback.trim()
}

function earlierDate(
  a?: string | null,
  b?: string | null,
): string | undefined {
  const left = a?.trim().slice(0, 10) || ''
  const right = b?.trim().slice(0, 10) || ''
  if (left && right) return left < right ? left : right
  return left || right || undefined
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
          .map((d) => mapStock(d.id, stockData(d.data())))
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
    (snap) =>
      onData(snap.docs.map((d) => mapSale(d.id, stockData(d.data())))),
    (err) => onError?.(err),
  )
}

/** Aynı çeşit için kararlı doküman kimliği (büyük/küçük harf duyarsız). */
function warehouseStockDocId(species: string): string {
  return `s_${encodeURIComponent(normalizeSpeciesKey(species)).replace(/%/g, '_')}`
}

/**
 * Aynı ürünün farklı yazımlarını (Buğday / buğday) tek satırda birleştirir.
 */
export async function consolidateWarehouseStockCaseDuplicates(
  farmId: string,
): Promise<void> {
  const snap = await getDocs(
    collection(db, 'farms', farmId, 'warehouseStock'),
  )
  const groups = new Map<string, StockDocSnap[]>()
  for (const d of snap.docs) {
    const key = normalizeSpeciesKey(
      String(stockData(d.data()).species ?? ''),
    )
    if (!key) continue
    const list = groups.get(key)
    if (list) list.push(d)
    else groups.set(key, [d])
  }

  const now = new Date().toISOString()
  for (const [, docs] of groups) {
    if (docs.length <= 1) continue
    const firstSpecies = String(
      stockData(docs[0]!.data()).species ?? '',
    )
    const preferredId = warehouseStockDocId(firstSpecies)
    const preferredRef = doc(
      db,
      'farms',
      farmId,
      'warehouseStock',
      preferredId,
    )
    const displayName = pickDisplaySpecies(docs, firstSpecies)
    let totalKg = 0
    let startedAt: string | undefined
    let notes = ''
    let source: string | undefined
    let createdBy: string | undefined

    for (const d of docs) {
      const data = stockData(d.data())
      totalKg += Number(data.kg ?? 0)
      startedAt = earlierDate(
        startedAt,
        data.startedAt ? String(data.startedAt) : null,
      )
      const n = data.notes ? String(data.notes) : ''
      if (n && !notes.includes(n)) {
        notes = [notes, n].filter(Boolean).join(' · ')
      }
      if (!source && data.source) source = String(data.source)
      if (!createdBy && data.createdBy) createdBy = String(data.createdBy)
    }

    await runTransaction(db, async (transaction) => {
      const fresh = await transaction.get(preferredRef)
      for (const d of docs) {
        if (d.id !== preferredId) {
          transaction.delete(d.ref)
        }
      }
      const payload: Record<string, unknown> = {
        species: displayName,
        kg: Number(Math.max(0, totalKg).toFixed(2)),
        updatedAt: serverTimestamp(),
        updatedAtIso: now,
      }
      if (startedAt) payload.startedAt = startedAt
      if (notes) payload.notes = notes
      if (source) payload.source = source
      if (createdBy) payload.createdBy = createdBy
      if (fresh.exists()) transaction.update(preferredRef, payload)
      else transaction.set(preferredRef, payload)
    })
  }
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
  const matches = await listStockDocsBySpeciesKey(farmId, name)
  const displayName = pickDisplaySpecies(matches, name)
  const now = new Date().toISOString()
  const preferredRef = doc(
    db,
    'farms',
    farmId,
    'warehouseStock',
    warehouseStockDocId(name),
  )
  const extras = matches.filter((d) => d.id !== preferredRef.id)

  await runTransaction(db, async (transaction) => {
    const fresh = await transaction.get(preferredRef)
    const extraSnaps = await Promise.all(
      extras.map((d) => transaction.get(d.ref)),
    )
    let mergedKg = 0
    let mergedStarted: string | undefined
    for (const snap of extraSnaps) {
      if (!snap.exists()) continue
      const data = stockData(snap.data())
      mergedKg += Number(data.kg ?? 0)
      mergedStarted = earlierDate(
        mergedStarted,
        data.startedAt ? String(data.startedAt) : null,
      )
    }

    if (!fresh.exists()) {
      const next = Number((mergedKg + deltaKg).toFixed(2))
      if (next < -0.001) {
        throw new Error(`Depoda “${displayName}” stoğu yok`)
      }
      for (const d of extras) transaction.delete(d.ref)
      if (next <= 0 && extras.length === 0) {
        if (deltaKg < 0) throw new Error(`Depoda “${displayName}” stoğu yok`)
        return
      }
      transaction.set(preferredRef, {
        species: displayName,
        kg: Math.max(0, next),
        ...(harvestStartedAt || mergedStarted
          ? { startedAt: earlierDate(mergedStarted, harvestStartedAt) }
          : {}),
        source: 'harvest',
        updatedAt: serverTimestamp(),
        updatedAtIso: now,
      })
      return
    }

    const data = stockData(fresh.data())
    const current = Number(data.kg ?? 0) + mergedKg
    const next = Number((current + deltaKg).toFixed(2))
    if (next < -0.001) {
      const unit = stockUnitLabel(displayName)
      throw new Error(
        `Depoda yeterli “${displayName}” yok (mevcut: ${current.toLocaleString('tr-TR')} ${unit})`,
      )
    }

    for (const d of extras) transaction.delete(d.ref)

    const patch: Record<string, unknown> = {
      species: displayName,
      kg: Math.max(0, next),
      updatedAt: serverTimestamp(),
      updatedAtIso: now,
    }

    if (deltaKg > 0 && harvestStartedAt) {
      const existingStarted = earlierDate(
        data.startedAt ? String(data.startedAt) : null,
        mergedStarted,
      )
      patch.startedAt = earlierDate(existingStarted, harvestStartedAt)
      if (!data.source) patch.source = 'harvest'
    } else if (mergedStarted && !data.startedAt) {
      patch.startedAt = mergedStarted
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
  const matches = await listStockDocsBySpeciesKey(farmId, name)
  const displayName = pickDisplaySpecies(matches, name)
  const preferredRef = doc(
    db,
    'farms',
    farmId,
    'warehouseStock',
    warehouseStockDocId(name),
  )
  const extras = matches.filter((d) => d.id !== preferredRef.id)

  await runTransaction(db, async (transaction) => {
    const fresh = await transaction.get(preferredRef)
    for (const d of extras) {
      await transaction.get(d.ref)
    }
    for (const d of extras) transaction.delete(d.ref)

    if (!fresh.exists()) {
      if (nextKg <= 0) return
      transaction.set(preferredRef, {
        species: displayName,
        kg: nextKg,
        updatedAt: serverTimestamp(),
        updatedAtIso: now,
      })
      return
    }
    transaction.update(preferredRef, {
      species: displayName,
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
        const key = normalizeSpeciesKey(delta.species)
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
      const earliest = earliestBySpecies.get(normalizeSpeciesKey(species))
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
 * Elle depo ürünü ekler (ör. buğday). Aynı ürün adı (büyük/küçük harf duyarsız)
 * varsa kiloyu biriktirir; başlangıç tarihini en erken değerde tutar.
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
  const matches = await listStockDocsBySpeciesKey(farmId, name)
  const displayName = pickDisplaySpecies(matches, name)
  const preferredRef = doc(
    db,
    'farms',
    farmId,
    'warehouseStock',
    warehouseStockDocId(name),
  )
  const extras = matches.filter((d) => d.id !== preferredRef.id)

  await runTransaction(db, async (transaction) => {
    const fresh = await transaction.get(preferredRef)
    const extraSnaps = await Promise.all(
      extras.map((d) => transaction.get(d.ref)),
    )
    let mergedKg = 0
    let mergedStarted: string | undefined
    let mergedNotes = ''
    for (const snap of extraSnaps) {
      if (!snap.exists()) continue
      const data = stockData(snap.data())
      mergedKg += Number(data.kg ?? 0)
      mergedStarted = earlierDate(
        mergedStarted,
        data.startedAt ? String(data.startedAt) : null,
      )
      const n = data.notes ? String(data.notes) : ''
      if (n && !mergedNotes.includes(n)) {
        mergedNotes = [mergedNotes, n].filter(Boolean).join(' · ')
      }
    }
    for (const d of extras) transaction.delete(d.ref)

    if (!fresh.exists()) {
      const notes =
        [mergedNotes, parsed.notes].filter(Boolean).join(' · ') || null
      transaction.set(preferredRef, {
        species: displayName,
        kg: Number((mergedKg + addKg).toFixed(2)),
        startedAt: earlierDate(mergedStarted, parsed.startedAt) ?? parsed.startedAt,
        notes,
        source: 'manual',
        createdBy,
        updatedAt: serverTimestamp(),
        updatedAtIso: now,
        createdAt: serverTimestamp(),
        createdAtIso: now,
      })
      return
    }

    const data = stockData(fresh.data())
    const current = Number(data.kg ?? 0) + mergedKg
    const next = Number((current + addKg).toFixed(2))
    const startedAt =
      earlierDate(
        earlierDate(
          data.startedAt ? String(data.startedAt) : null,
          mergedStarted,
        ),
        parsed.startedAt,
      ) ?? parsed.startedAt
    const existingNotes = data.notes ? String(data.notes) : ''
    const notes =
      [existingNotes, mergedNotes, parsed.notes]
        .filter(Boolean)
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .join(' · ') || null

    transaction.update(preferredRef, {
      species: displayName,
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
