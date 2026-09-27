import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { buildFocusHref } from '../../lib/focusNav'
import { PLOW_DIRECTION_LABELS } from '../plow/api'
import {
  DEBT_ASSET_TYPE_LABELS,
  DEBT_DIRECTION_LABELS,
  formatDebtAmount,
} from '../debts/api'
import { TREE_HEALTH_LABELS } from '../trees/api'
import type {
  DebtAssetType,
  DebtDirection,
  Field,
  PlowDirection,
  TreeHealth,
  TreeStatus,
} from '../../types'

export type SearchHitKind =
  | 'field'
  | 'tree'
  | 'generalWork'
  | 'plow'
  | 'harvest'
  | 'fertilize'
  | 'hoe'
  | 'prune'
  | 'fuel'
  | 'pesticideExpense'
  | 'pesticideStock'
  | 'warehouseStock'
  | 'sale'
  | 'debt'

export const SEARCH_KIND_LABELS: Record<SearchHitKind, string> = {
  field: 'Tarla',
  tree: 'Ağaç',
  generalWork: 'Genel iş',
  plow: 'Sürüm',
  harvest: 'Hasat',
  fertilize: 'Gübreleme',
  hoe: 'Çapalama',
  prune: 'Budama',
  fuel: 'Yakıt',
  pesticideExpense: 'İlaçlama masrafı',
  pesticideStock: 'İlaç stoğu',
  warehouseStock: 'Depo',
  sale: 'Satış',
  debt: 'Borç',
}

export interface FarmSearchHit {
  id: string
  kind: SearchHitKind
  title: string
  subtitle: string
  detail?: string
  href: string
  fieldId?: string
  fieldName?: string
}

function needleOf(raw: string): string {
  return raw.trim().toLocaleLowerCase('tr')
}

function matches(needle: string, ...parts: unknown[]): boolean {
  if (!needle) return false
  const haystack = parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '')
    .map((p) => String(p))
    .join(' ')
    .toLocaleLowerCase('tr')
  return haystack.includes(needle)
}

function money(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function snapData(data: unknown): Record<string, unknown> {
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
}

function fieldHref(fieldId?: string): string {
  return fieldId ? `/fields/${fieldId}` : '/'
}

function hrefFor(
  kind: SearchHitKind,
  entityId: string,
  highlight: string,
  path: string,
  cell?: string,
): string {
  return buildFocusHref({ path, kind, entityId, highlight, cell })
}

/** Tüm kullanıcı kayıtlarında metin araması (ağaç, tarla, işler, depo…). */
export async function searchFarm(
  farmId: string,
  fields: Field[],
  rawQuery: string,
): Promise<FarmSearchHit[]> {
  const needle = needleOf(rawQuery)
  const highlight = rawQuery.trim()
  if (!needle) return []

  const fieldById = new Map(fields.map((f) => [f.id, f]))
  const hits: FarmSearchHit[] = []

  for (const field of fields) {
    if (
      matches(
        needle,
        field.name,
        field.area,
        field.species,
        field.notes,
        field.donum,
        'tarla',
      )
    ) {
      hits.push({
        id: `field-${field.id}`,
        kind: 'field',
        title: field.name,
        subtitle: [
          field.area,
          field.species,
          field.donum !== undefined ? `${money(field.donum)} dönüm` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Tarla',
        detail: field.notes,
        href: hrefFor('field', field.id, highlight, `/fields/${field.id}`),
        fieldId: field.id,
        fieldName: field.name,
      })
    }
  }

  const fieldJobs = fields.map(async (field) => {
    const [
      treesSnap,
      plowSnap,
      harvestSnap,
      fertSnap,
      hoeSnap,
      pruneSnap,
    ] = await Promise.all([
      getDocs(
        query(
          collection(db, 'farms', farmId, 'fields', field.id, 'trees'),
          orderBy('cell'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'farms', farmId, 'fields', field.id, 'plowEvents'),
          orderBy('doneAt', 'desc'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'farms', farmId, 'fields', field.id, 'harvestEvents'),
          orderBy('doneAt', 'desc'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'farms', farmId, 'fields', field.id, 'fertilizeEvents'),
          orderBy('doneAt', 'desc'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'farms', farmId, 'fields', field.id, 'hoeEvents'),
          orderBy('doneAt', 'desc'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'farms', farmId, 'fields', field.id, 'pruneEvents'),
          orderBy('doneAt', 'desc'),
        ),
      ),
    ])

    const local: FarmSearchHit[] = []

    for (const d of treesSnap.docs) {
      const data = snapData(d.data())
      const status = (String(data.status ?? 'active') as TreeStatus) || 'active'
      const health = data.health as TreeHealth | undefined
      const cell = String(data.cell ?? '')
      const species = data.species ? String(data.species) : undefined
      const label = data.label ? String(data.label) : undefined
      const plantedAt = data.plantedAt ? String(data.plantedAt) : undefined
      const notes = data.notes ? String(data.notes) : undefined
      if (
        !matches(
          needle,
          cell,
          data.row,
          data.col,
          species,
          label,
          plantedAt,
          notes,
          health,
          health ? TREE_HEALTH_LABELS[health] : '',
          status,
          field.name,
        )
      ) {
        continue
      }
      local.push({
        id: `tree-${field.id}-${d.id}`,
        kind: 'tree',
        title: `${field.name} · ${cell}`,
        subtitle: [species, label, health ? TREE_HEALTH_LABELS[health] : null, plantedAt]
          .filter(Boolean)
          .join(' · ') || 'Ağaç',
        detail: notes,
        href: hrefFor(
          'tree',
          d.id,
          highlight,
          `/fields/${field.id}`,
          cell,
        ),
        fieldId: field.id,
        fieldName: field.name,
      })
    }

    for (const d of plowSnap.docs) {
      const data = snapData(d.data())
      const doneAt = String(data.doneAt ?? '')
      const direction = (data.direction as PlowDirection) || 'enine'
      const equipment = data.equipment ? String(data.equipment) : undefined
      const notes = data.notes ? String(data.notes) : undefined
      const dirLabel = PLOW_DIRECTION_LABELS[direction] ?? direction
      if (
        !matches(
          needle,
          doneAt,
          direction,
          dirLabel,
          equipment,
          notes,
          field.name,
          'sürüm',
          'surum',
        )
      ) {
        continue
      }
      local.push({
        id: `plow-${field.id}-${d.id}`,
        kind: 'plow',
        title: `${field.name} · Sürüm`,
        subtitle: [doneAt.slice(0, 10), dirLabel, equipment]
          .filter(Boolean)
          .join(' · '),
        detail: notes,
        href: hrefFor('plow', d.id, highlight, fieldHref(field.id)),
        fieldId: field.id,
        fieldName: field.name,
      })
    }

    for (const d of harvestSnap.docs) {
      const data = snapData(d.data())
      const doneAt = String(data.doneAt ?? '')
      const species = data.species ? String(data.species) : undefined
      const notes = data.notes ? String(data.notes) : undefined
      const estimatedKg = data.estimatedKg != null ? Number(data.estimatedKg) : undefined
      const verim = data.verim != null ? Number(data.verim) : undefined
      const totalPaid = Number(data.totalPaid ?? 0)
      if (
        !matches(
          needle,
          doneAt,
          species,
          notes,
          estimatedKg,
          verim,
          totalPaid,
          data.workerCount,
          data.dailyWage,
          field.name,
          'hasat',
        )
      ) {
        continue
      }
      local.push({
        id: `harvest-${field.id}-${d.id}`,
        kind: 'harvest',
        title: `${field.name} · Hasat`,
        subtitle: [
          doneAt.slice(0, 10),
          species,
          estimatedKg !== undefined ? `${money(estimatedKg)} kg` : null,
          verim !== undefined ? `verim ${money(verim)}` : null,
          `${money(totalPaid)} ₺`,
        ]
          .filter(Boolean)
          .join(' · '),
        detail: notes,
        href: hrefFor('harvest', d.id, highlight, fieldHref(field.id)),
        fieldId: field.id,
        fieldName: field.name,
      })
    }

    for (const d of fertSnap.docs) {
      const data = snapData(d.data())
      const doneAt = String(data.doneAt ?? '')
      const fertilizerType = String(data.fertilizerType ?? '')
      const cost = Number(data.cost ?? 0)
      const notes = data.notes ? String(data.notes) : undefined
      if (
        !matches(
          needle,
          doneAt,
          fertilizerType,
          cost,
          notes,
          field.name,
          'gübre',
          'gubre',
          'gübreleme',
        )
      ) {
        continue
      }
      local.push({
        id: `fertilize-${field.id}-${d.id}`,
        kind: 'fertilize',
        title: `${field.name} · Gübreleme`,
        subtitle: [doneAt.slice(0, 10), fertilizerType, `${money(cost)} ₺`]
          .filter(Boolean)
          .join(' · '),
        detail: notes,
        href: hrefFor('fertilize', d.id, highlight, fieldHref(field.id)),
        fieldId: field.id,
        fieldName: field.name,
      })
    }

    for (const d of hoeSnap.docs) {
      const data = snapData(d.data())
      const doneAt = String(data.doneAt ?? '')
      const notes = data.notes ? String(data.notes) : undefined
      const totalPaid = Number(data.totalPaid ?? 0)
      if (
        !matches(
          needle,
          doneAt,
          notes,
          totalPaid,
          data.workerCount,
          data.dailyWage,
          field.name,
          'çapa',
          'capa',
          'çapalama',
        )
      ) {
        continue
      }
      local.push({
        id: `hoe-${field.id}-${d.id}`,
        kind: 'hoe',
        title: `${field.name} · Çapalama`,
        subtitle: [
          doneAt.slice(0, 10),
          `${data.workerCount ?? 0} işçi`,
          `${money(totalPaid)} ₺`,
        ].join(' · '),
        detail: notes,
        href: hrefFor('hoe', d.id, highlight, fieldHref(field.id)),
        fieldId: field.id,
        fieldName: field.name,
      })
    }

    for (const d of pruneSnap.docs) {
      const data = snapData(d.data())
      const doneAt = String(data.doneAt ?? '')
      const foremanName = String(data.foremanName ?? '')
      const foremanPhone = String(data.foremanPhone ?? '')
      const notes = data.notes ? String(data.notes) : undefined
      if (
        !matches(
          needle,
          doneAt,
          foremanName,
          foremanPhone,
          notes,
          data.workerCount,
          data.dailyWage,
          data.durationDays,
          field.name,
          'budama',
        )
      ) {
        continue
      }
      local.push({
        id: `prune-${field.id}-${d.id}`,
        kind: 'prune',
        title: `${field.name} · Budama`,
        subtitle: [
          doneAt.slice(0, 10),
          foremanName,
          foremanPhone,
          `${data.workerCount ?? 0} işçi`,
        ]
          .filter(Boolean)
          .join(' · '),
        detail: notes,
        href: hrefFor('prune', d.id, highlight, fieldHref(field.id)),
        fieldId: field.id,
        fieldName: field.name,
      })
    }

    return local
  })

  const farmJobs = Promise.all([
    getDocs(
      query(
        collection(db, 'farms', farmId, 'generalWorks'),
        orderBy('doneAt', 'desc'),
      ),
    ),
    getDocs(
      query(
        collection(db, 'farms', farmId, 'fuelEvents'),
        orderBy('doneAt', 'desc'),
      ),
    ),
    getDocs(
      query(
        collection(db, 'farms', farmId, 'pesticideExpenses'),
        orderBy('doneAt', 'desc'),
      ),
    ),
    getDocs(collection(db, 'farms', farmId, 'pesticideStock')),
    getDocs(
      query(
        collection(db, 'farms', farmId, 'warehouseStock'),
        orderBy('species', 'asc'),
      ),
    ),
    getDocs(
      query(
        collection(db, 'farms', farmId, 'salesEvents'),
        orderBy('doneAt', 'desc'),
      ),
    ),
    getDocs(
      query(
        collection(db, 'farms', farmId, 'debtEvents'),
        orderBy('takenAt', 'desc'),
      ),
    ),
  ])

  const [fieldResults, farmSnaps] = await Promise.all([
    Promise.all(fieldJobs),
    farmJobs,
  ])

  hits.push(...fieldResults.flat())

  const [
    generalSnap,
    fuelSnap,
    pestExpSnap,
    pestStockSnap,
    warehouseSnap,
    salesSnap,
    debtSnap,
  ] = farmSnaps

  for (const d of generalSnap.docs) {
    const data = snapData(d.data())
    const doneAt = String(data.doneAt ?? '')
    const work = String(data.work ?? '')
    const cost = Number(data.cost ?? 0)
    const fieldId = data.fieldId ? String(data.fieldId) : undefined
    const fieldName = fieldId ? fieldById.get(fieldId)?.name : undefined
    if (
      !matches(
        needle,
        doneAt,
        work,
        cost,
        fieldName,
        'genel iş',
        'genel is',
        'masraf',
      )
    ) {
      continue
    }
    hits.push({
      id: `generalWork-${d.id}`,
      kind: 'generalWork',
      title: work || 'Genel iş',
      subtitle: [
        doneAt.slice(0, 10),
        fieldName ?? 'Çiftlik geneli',
        `${money(cost)} ₺`,
      ].join(' · '),
      href: hrefFor(
        'generalWork',
        d.id,
        highlight,
        fieldHref(fieldId),
      ),
      fieldId,
      fieldName,
    })
  }

  for (const d of fuelSnap.docs) {
    const data = snapData(d.data())
    const doneAt = String(data.doneAt ?? '')
    const source = data.source ? String(data.source) : undefined
    const notes = data.notes ? String(data.notes) : undefined
    const liters = Number(data.liters ?? 0)
    const totalCost = data.totalCost != null ? Number(data.totalCost) : undefined
    if (
      !matches(
        needle,
        doneAt,
        source,
        notes,
        liters,
        totalCost,
        data.unitPrice,
        'yakıt',
        'yakit',
      )
    ) {
      continue
    }
    hits.push({
      id: `fuel-${d.id}`,
      kind: 'fuel',
      title: source ? `Yakıt · ${source}` : 'Yakıt alımı',
      subtitle: [
        doneAt.slice(0, 10),
        `${money(liters)} lt`,
        totalCost !== undefined ? `${money(totalCost)} ₺` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      detail: notes,
      href: hrefFor('fuel', d.id, highlight, '/'),
    })
  }

  for (const d of pestExpSnap.docs) {
    const data = snapData(d.data())
    const doneAt = String(data.doneAt ?? '')
    const pesticideName = data.pesticideName
      ? String(data.pesticideName)
      : undefined
    const notes = data.notes ? String(data.notes) : undefined
    const cost = Number(data.cost ?? 0)
    const fieldId = data.fieldId ? String(data.fieldId) : undefined
    const fieldName = fieldId ? fieldById.get(fieldId)?.name : undefined
    if (
      !matches(
        needle,
        doneAt,
        pesticideName,
        notes,
        cost,
        fieldName,
        'ilaç',
        'ilac',
        'ilaçlama',
      )
    ) {
      continue
    }
    hits.push({
      id: `pesticideExpense-${d.id}`,
      kind: 'pesticideExpense',
      title: pesticideName
        ? `İlaçlama · ${pesticideName}`
        : 'İlaçlama masrafı',
      subtitle: [
        doneAt.slice(0, 10),
        fieldName,
        `${money(cost)} ₺`,
      ]
        .filter(Boolean)
        .join(' · '),
      detail: notes,
      href: hrefFor(
        'pesticideExpense',
        d.id,
        highlight,
        fieldId ? fieldHref(fieldId) : '/',
      ),
      fieldId,
      fieldName,
    })
  }

  for (const d of pestStockSnap.docs) {
    const data = snapData(d.data())
    const name = String(data.name ?? '')
    const treeSpecies = String(data.treeSpecies ?? '')
    const notes = data.notes ? String(data.notes) : undefined
    if (
      !matches(
        needle,
        name,
        treeSpecies,
        notes,
        data.expiresAt,
        data.quantityPieces,
        data.quantityMl,
        data.doseWaterLiters,
        'ilaç stok',
        'ilac stok',
      )
    ) {
      continue
    }
    hits.push({
      id: `pesticideStock-${d.id}`,
      kind: 'pesticideStock',
      title: name || 'İlaç stoğu',
      subtitle: [
        treeSpecies,
        data.expiresAt ? String(data.expiresAt).slice(0, 10) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      detail: notes,
      href: hrefFor('pesticideStock', d.id, highlight, '/'),
    })
  }

  for (const d of warehouseSnap.docs) {
    const data = snapData(d.data())
    const species = String(data.species ?? '')
    const kg = Number(data.kg ?? 0)
    const startedAt = data.startedAt ? String(data.startedAt) : undefined
    const notes = data.notes ? String(data.notes) : undefined
    const source = data.source === 'manual' ? 'manual' : undefined
    if (kg <= 0 && !matches(needle, species)) continue
    if (!matches(needle, species, kg, startedAt, notes, 'depo', 'stok', 'elle'))
      continue
    hits.push({
      id: `warehouse-${d.id}`,
      kind: 'warehouseStock',
      title: species || 'Depo stoğu',
      subtitle: [
        `${money(kg)} (kg/lt)`,
        startedAt ? `başlangıç ${startedAt.slice(0, 10)}` : null,
        source === 'manual' ? 'elle' : null,
      ]
        .filter(Boolean)
        .join(' · '),
      detail: notes,
      href: hrefFor('warehouseStock', d.id, highlight, '/assets'),
    })
  }

  for (const d of salesSnap.docs) {
    const data = snapData(d.data())
    const doneAt = String(data.doneAt ?? '')
    const species = String(data.species ?? '')
    const notes = data.notes ? String(data.notes) : undefined
    const soldKg = Number(data.soldKg ?? 0)
    const unitPrice = Number(data.unitPrice ?? 0)
    const earnings = Number(data.earnings ?? soldKg * unitPrice)
    if (
      !matches(
        needle,
        doneAt,
        species,
        notes,
        soldKg,
        unitPrice,
        earnings,
        'satış',
        'satis',
      )
    ) {
      continue
    }
    hits.push({
      id: `sale-${d.id}`,
      kind: 'sale',
      title: `Satış · ${species}`,
      subtitle: [
        doneAt.slice(0, 10),
        `${money(soldKg)}`,
        `${money(earnings)} ₺`,
      ].join(' · '),
      detail: notes,
      href: hrefFor('sale', d.id, highlight, '/assets'),
    })
  }

  for (const d of debtSnap.docs) {
    const data = snapData(d.data())
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
    const amount = Number(data.amount ?? 0)
    const unit = data.unit ? String(data.unit) : undefined
    const counterparty = data.counterparty
      ? String(data.counterparty)
      : undefined
    const takenAt = String(data.takenAt ?? '')
    const dueAt = data.dueAt ? String(data.dueAt) : undefined
    const paidAt = data.paidAt ? String(data.paidAt) : undefined
    const notes = data.notes ? String(data.notes) : undefined
    const dirLabel = DEBT_DIRECTION_LABELS[direction]
    const typeLabel = DEBT_ASSET_TYPE_LABELS[assetType]
    if (
      !matches(
        needle,
        dirLabel,
        typeLabel,
        amount,
        unit,
        counterparty,
        takenAt,
        dueAt,
        paidAt,
        notes,
        'borç',
        'borc',
        'alacak',
        'verecek',
      )
    ) {
      continue
    }
    hits.push({
      id: `debt-${d.id}`,
      kind: 'debt',
      title: `${dirLabel} · ${typeLabel}`,
      subtitle: [
        formatDebtAmount({ amount, unit, assetType }),
        counterparty,
        takenAt.slice(0, 10),
        paidAt ? `ödendi ${paidAt.slice(0, 10)}` : 'açık',
      ]
        .filter(Boolean)
        .join(' · '),
      detail: notes,
      href: hrefFor('debt', d.id, highlight, '/assets'),
    })
  }

  const kindOrder = Object.keys(SEARCH_KIND_LABELS) as SearchHitKind[]
  return hits.sort((a, b) => {
    const byKind = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind)
    if (byKind !== 0) return byKind
    return a.title.localeCompare(b.title, 'tr')
  })
}
