import { collection, getDocs, orderBy, query } from 'firebase/firestore'
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
  total: number
}

export interface FarmStats {
  fieldCount: number
  totalDonum: number
  totalTrees: number
  bySpecies: SpeciesCount[]
  byYear: YearSpendStat[]
}

function yearOf(doneAt: string): string | null {
  const y = doneAt.slice(0, 4)
  return /^\d{4}$/.test(y) ? y : null
}

function addSpend(
  map: Map<string, YearSpendStat>,
  year: string,
  key: 'fertilize' | 'prune' | 'harvest' | 'hoe' | 'fuel',
  amount: number,
) {
  if (!amount) return
  const row = map.get(year) ?? {
    year,
    fertilize: 0,
    prune: 0,
    harvest: 0,
    hoe: 0,
    fuel: 0,
    total: 0,
  }
  row[key] += amount
  row.total += amount
  map.set(year, row)
}

/** Tüm tarlalardan özet istatistik: çeşit sayıları, dönüm, yıllık harcama. */
export async function loadFarmStats(
  farmId: string,
  fields: Field[],
): Promise<FarmStats> {
  const speciesMap = new Map<string, number>()
  const spendMap = new Map<string, YearSpendStat>()
  let totalTrees = 0
  let totalDonum = 0

  for (const field of fields) {
    totalDonum += field.donum ?? 0
  }

  await Promise.all(
    fields.map(async (field) => {
      const [treesSnap, fertSnap, pruneSnap, harvestSnap, hoeSnap, fuelSnap] =
        await Promise.all([
          getDocs(
            query(
              collection(db, 'farms', farmId, 'fields', field.id, 'trees'),
              orderBy('cell'),
            ),
          ),
          getDocs(
            collection(db, 'farms', farmId, 'fields', field.id, 'fertilizeEvents'),
          ),
          getDocs(
            collection(db, 'farms', farmId, 'fields', field.id, 'pruneEvents'),
          ),
          getDocs(
            collection(db, 'farms', farmId, 'fields', field.id, 'harvestEvents'),
          ),
          getDocs(
            collection(db, 'farms', farmId, 'fields', field.id, 'hoeEvents'),
          ),
          getDocs(
            collection(db, 'farms', farmId, 'fields', field.id, 'fuelEvents'),
          ),
        ])

      for (const d of treesSnap.docs) {
        const data = d.data()
        if (String(data.status ?? 'active') !== 'active') continue
        totalTrees += 1
        const species =
          String(data.species ?? '').trim() || 'Belirtilmedi'
        speciesMap.set(species, (speciesMap.get(species) ?? 0) + 1)
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

      for (const d of fuelSnap.docs) {
        const data = d.data()
        const year = yearOf(String(data.purchasedAt ?? ''))
        if (!year) continue
        const liters = Number(data.liters ?? 0)
        const unitPrice = Number(data.unitPrice ?? 0)
        const total =
          data.totalCost !== undefined && data.totalCost !== null
            ? Number(data.totalCost)
            : Number((liters * unitPrice).toFixed(2))
        addSpend(spendMap, year, 'fuel', total)
      }
    }),
  )

  const bySpecies = [...speciesMap.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count || a.species.localeCompare(b.species, 'tr'))

  const byYear = [...spendMap.values()].sort((a, b) =>
    b.year.localeCompare(a.year),
  )

  return {
    fieldCount: fields.length,
    totalDonum,
    totalTrees,
    bySpecies,
    byYear,
  }
}
