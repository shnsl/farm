import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Field } from '../../types'
import { pruneLaborCost } from '../prune/api'

export interface SpeciesCount {
  species: string
  count: number
}

export interface YearSpendStat {
  year: string
  fertilize: number
  prune: number
  harvest: number
  hoe: number
  fuel: number
  pesticide: number
  generalWork: number
  total: number
}

export interface FarmStats {
  fieldCount: number
  totalDonum: number
  emptyFieldCount: number
  emptyDonum: number
  totalTrees: number
  /** Bu yılın yakıt alım masrafı (₺) */
  currentYearFuelSpend: number
  bySpecies: SpeciesCount[]
  byYear: YearSpendStat[]
}

const STATS_CACHE_TTL_MS = 60_000
const statsCache = new Map<
  string,
  { at: number; fieldIdsKey: string; stats: FarmStats }
>()

function yearOf(doneAt: string): string | null {
  const y = doneAt.slice(0, 4)
  return /^\d{4}$/.test(y) ? y : null
}

type SpendKey =
  | 'fertilize'
  | 'prune'
  | 'harvest'
  | 'hoe'
  | 'fuel'
  | 'pesticide'
  | 'generalWork'

function emptyYearRow(year: string): YearSpendStat {
  return {
    year,
    fertilize: 0,
    prune: 0,
    harvest: 0,
    hoe: 0,
    fuel: 0,
    pesticide: 0,
    generalWork: 0,
    total: 0,
  }
}

function addSpend(
  map: Map<string, YearSpendStat>,
  year: string,
  key: SpendKey,
  amount: number,
) {
  if (!amount) return
  const row = map.get(year) ?? emptyYearRow(year)
  row[key] += amount
  row.total += amount
  map.set(year, row)
}

/** Tarla dokümanlarından anlık özet (ağaç/harcama okumadan). */
export function buildInstantFarmStats(fields: Field[]): Omit<
  FarmStats,
  'byYear' | 'currentYearFuelSpend'
> & { byYear: YearSpendStat[]; currentYearFuelSpend: number } {
  let totalTrees = 0
  let totalDonum = 0
  let fieldCount = 0
  let emptyFieldCount = 0
  let emptyDonum = 0
  const speciesMap = new Map<string, number>()

  for (const field of fields) {
    const active = field.activeTreeCount ?? 0
    if (active > 0) {
      fieldCount += 1
      totalDonum += field.donum ?? 0
      totalTrees += active
    } else {
      emptyFieldCount += 1
      emptyDonum += field.donum ?? 0
    }
    if (field.speciesCounts) {
      for (const [species, count] of Object.entries(field.speciesCounts)) {
        if (!species.trim() || count <= 0) continue
        speciesMap.set(species, (speciesMap.get(species) ?? 0) + count)
      }
    }
  }

  const bySpecies = [...speciesMap.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.species.localeCompare(b.species, 'tr'),
    )

  return {
    fieldCount,
    totalDonum,
    emptyFieldCount,
    emptyDonum,
    totalTrees,
    currentYearFuelSpend: 0,
    bySpecies,
    byYear: [],
  }
}

/** Yıllık harcama + (gerekirse) çeşit sayımı. */
export async function loadFarmStats(
  farmId: string,
  fields: Field[],
): Promise<FarmStats> {
  const fieldIdsKey = fields.map((f) => f.id).join('|')
  const cached = statsCache.get(farmId)
  if (
    cached &&
    cached.fieldIdsKey === fieldIdsKey &&
    Date.now() - cached.at < STATS_CACHE_TTL_MS
  ) {
    return cached.stats
  }

  const base = buildInstantFarmStats(fields)
  const spendMap = new Map<string, YearSpendStat>()
  const needTreeScan = fields.some(
    (f) => f.speciesCounts === undefined || f.activeTreeCount === undefined,
  )
  const speciesMap = new Map(
    base.bySpecies.map((row) => [row.species, row.count] as const),
  )

  const fieldJobs = fields.map(async (field) => {
    const reads: Promise<Awaited<ReturnType<typeof getDocs>>>[] = [
      getDocs(
        collection(db, 'farms', farmId, 'fields', field.id, 'fertilizeEvents'),
      ),
      getDocs(
        collection(db, 'farms', farmId, 'fields', field.id, 'pruneEvents'),
      ),
      getDocs(
        collection(db, 'farms', farmId, 'fields', field.id, 'harvestEvents'),
      ),
      getDocs(collection(db, 'farms', farmId, 'fields', field.id, 'hoeEvents')),
    ]
    if (
      needTreeScan &&
      (field.speciesCounts === undefined || field.activeTreeCount === undefined)
    ) {
      reads.push(
        getDocs(collection(db, 'farms', farmId, 'fields', field.id, 'trees')),
      )
    }
    const snaps = await Promise.all(reads)
    return { field, snaps }
  })

  const farmJobs = Promise.all([
    getDocs(collection(db, 'farms', farmId, 'fuelEvents')),
    getDocs(collection(db, 'farms', farmId, 'pesticideExpenses')),
    getDocs(collection(db, 'farms', farmId, 'generalWorks')),
  ])

  const [fieldResults, [fuelSnap, pesticideSnap, generalSnap]] =
    await Promise.all([Promise.all(fieldJobs), farmJobs])

  let totalTrees = base.totalTrees
  let fieldCount = base.fieldCount
  let totalDonum = base.totalDonum
  let emptyFieldCount = base.emptyFieldCount
  let emptyDonum = base.emptyDonum

  for (const { field, snaps } of fieldResults) {
    const [fertSnap, pruneSnap, harvestSnap, hoeSnap, treesSnap] = snaps

    if (treesSnap) {
      let activeInField = 0
      for (const d of treesSnap.docs) {
        const data = d.data()
        if (String(data.status ?? 'active') !== 'active') continue
        activeInField += 1
        const species = String(data.species ?? '').trim()
        if (!species) continue
        speciesMap.set(species, (speciesMap.get(species) ?? 0) + 1)
      }
      // Sayaç yokken özet kartları tree scan ile düzelt
      if (field.activeTreeCount === undefined) {
        totalTrees += activeInField
        if (activeInField > 0) {
          fieldCount += 1
          totalDonum += field.donum ?? 0
          emptyFieldCount = Math.max(0, emptyFieldCount - 1)
          emptyDonum = Math.max(0, emptyDonum - (field.donum ?? 0))
        }
      }
    }

    for (const d of fertSnap.docs) {
      const data = d.data()
      const year = yearOf(String(data.doneAt ?? ''))
      if (!year) continue
      addSpend(spendMap, year, 'fertilize', Number(data.cost ?? 0))
    }

    for (const d of pruneSnap.docs) {
      const data = d.data()
      const year = yearOf(String(data.doneAt ?? ''))
      if (!year) continue
      addSpend(
        spendMap,
        year,
        'prune',
        pruneLaborCost({
          workerCount: Number(data.workerCount ?? 0),
          dailyWage: Number(data.dailyWage ?? 0),
          durationDays: Number(data.durationDays ?? 0),
        }),
      )
    }

    for (const d of harvestSnap.docs) {
      const data = d.data()
      const year = yearOf(String(data.doneAt ?? ''))
      if (!year) continue
      addSpend(spendMap, year, 'harvest', Number(data.totalPaid ?? 0))
    }

    for (const d of hoeSnap.docs) {
      const data = d.data()
      const year = yearOf(String(data.doneAt ?? ''))
      if (!year) continue
      addSpend(spendMap, year, 'hoe', Number(data.totalPaid ?? 0))
    }
  }

  for (const d of fuelSnap.docs) {
    const data = d.data()
    if (String(data.kind ?? 'purchase') === 'consumption') continue
    const year = yearOf(String(data.doneAt ?? data.purchasedAt ?? ''))
    if (!year) continue
    const liters = Number(data.liters ?? 0)
    const unitPrice = Number(data.unitPrice ?? 0)
    const total =
      data.totalCost !== undefined && data.totalCost !== null
        ? Number(data.totalCost)
        : Number((liters * unitPrice).toFixed(2))
    addSpend(spendMap, year, 'fuel', total)
  }

  for (const d of pesticideSnap.docs) {
    const data = d.data()
    const year = yearOf(String(data.doneAt ?? ''))
    if (!year) continue
    addSpend(spendMap, year, 'pesticide', Number(data.cost ?? 0))
  }

  for (const d of generalSnap.docs) {
    const data = d.data()
    const year = yearOf(String(data.doneAt ?? ''))
    if (!year) continue
    addSpend(spendMap, year, 'generalWork', Number(data.cost ?? 0))
  }

  const bySpecies = [...speciesMap.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.species.localeCompare(b.species, 'tr'),
    )

  const byYear = [...spendMap.values()].sort((a, b) =>
    b.year.localeCompare(a.year),
  )

  const currentYear = String(new Date().getFullYear())
  const currentYearFuelSpend = spendMap.get(currentYear)?.fuel ?? 0

  const stats: FarmStats = {
    fieldCount,
    totalDonum,
    emptyFieldCount,
    emptyDonum,
    totalTrees,
    currentYearFuelSpend,
    bySpecies,
    byYear,
  }

  statsCache.set(farmId, { at: Date.now(), fieldIdsKey, stats })
  return stats
}

export function invalidateFarmStatsCache(farmId?: string) {
  if (farmId) statsCache.delete(farmId)
  else statsCache.clear()
}
