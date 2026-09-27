import type { DebtAssetType, DebtDirection, DebtEvent } from '../../types'

/** Birim fiyat: 1 birim varlık → TRY */
export interface MarketRates {
  updatedAt: string
  source: string
  /** Döviz kodu → TRY (alış / satış) */
  currency: Record<string, { buy: number; sell: number }>
  /** Altın türü (normalize) → TRY / adet veya gram */
  gold: Record<string, { buy: number; sell: number }>
}

const TRUNCGIL_URL = 'https://finans.truncgil.com/v4/today.json'
const TURKPIDYA_GOLD_URL =
  'https://turkpidya.com/wp-json/turkpidya-data/v1/gold'
const TURKPIDYA_FX_URL = 'https://turkpidya.com/wp-json/turkpidya-data/v1/fx'

const CACHE_TTL_MS = 5 * 60 * 1000
let cache: { at: number; rates: MarketRates } | null = null

const GOLD_ALIASES: Record<string, string[]> = {
  gram: ['gram', 'gra', 'gramaltin', 'gram altın', 'gramaltın'],
  ceyrek: ['çeyrek', 'ceyrek', 'ceyrekaltin', 'çeyrek altın'],
  yarim: ['yarım', 'yarim', 'yarimaltin', 'yarım altın'],
  tam: ['tam', 'tamaltin', 'tam altın'],
  ata: ['ata', 'ataaltin', 'ata altın'],
  cumhuriyet: [
    'cumhuriyet',
    'cumhuriyetaltini',
    'cumhuriyet altını',
    'cumhuriyetaltın',
  ],
  resat: ['reşat', 'resat', 'resataltin', 'reşat altın'],
  gremse: ['gremse', 'gremsealtin', 'gremse altın'],
}

const TRUNCGIL_GOLD_KEYS: Record<string, string> = {
  gram: 'GRA',
  ceyrek: 'CEYREKALTIN',
  yarim: 'YARIMALTIN',
  tam: 'TAMALTIN',
  ata: 'ATAALTIN',
  cumhuriyet: 'CUMHURIYETALTINI',
  resat: 'RESATALTIN',
  gremse: 'GREMSEALTIN',
}

const TURKPIDYA_GOLD_TYPES: Record<string, string> = {
  gram: 'gram_24k',
  ceyrek: 'ceyrek',
  yarim: 'yarim',
  tam: 'tam',
  ata: 'ata',
  cumhuriyet: 'cumhuriyet',
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function resolveGoldKey(unit: string): string | null {
  const n = normalizeKey(unit)
  for (const [canonical, aliases] of Object.entries(GOLD_ALIASES)) {
    if (aliases.some((a) => normalizeKey(a) === n)) return canonical
  }
  return null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function parseTruncgil(data: Record<string, unknown>): MarketRates {
  const currency: MarketRates['currency'] = {
    TRY: { buy: 1, sell: 1 },
  }
  const gold: MarketRates['gold'] = {}

  for (const [code, raw] of Object.entries(data)) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const type = String(row.Type ?? '')
    const buy = num(row.Buying)
    const sell = num(row.Selling)
    if (buy === null && sell === null) continue
    const b = buy ?? sell ?? 0
    const s = sell ?? buy ?? 0

    if (type === 'Currency') {
      currency[code.toUpperCase()] = { buy: b, sell: s }
    }
  }

  for (const [canonical, apiKey] of Object.entries(TRUNCGIL_GOLD_KEYS)) {
    const row = data[apiKey]
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const buy = num(r.Buying)
    const sell = num(r.Selling)
    if (buy === null && sell === null) continue
    gold[canonical] = {
      buy: buy ?? sell ?? 0,
      sell: sell ?? buy ?? 0,
    }
  }

  return {
    updatedAt: String(data.Update_Date ?? new Date().toISOString()),
    source: 'Truncgil Finans (açık JSON)',
    currency,
    gold,
  }
}

async function fetchTurkpidya(): Promise<MarketRates> {
  const [goldRes, fxRes] = await Promise.all([
    fetch(TURKPIDYA_GOLD_URL),
    fetch(TURKPIDYA_FX_URL),
  ])
  if (!goldRes.ok || !fxRes.ok) {
    throw new Error('Turkpidya kurları alınamadı')
  }
  const goldJson = (await goldRes.json()) as {
    last_updated?: string
    prices?: Array<{
      type: string
      buy: number
      sell: number
    }>
  }
  const fxJson = (await fxRes.json()) as {
    last_updated?: string
    rates?: Array<{
      code: string
      unit: number
      forex_buying: number | null
      forex_selling: number | null
    }>
  }

  const currency: MarketRates['currency'] = {
    TRY: { buy: 1, sell: 1 },
  }
  for (const r of fxJson.rates ?? []) {
    const unit = r.unit > 0 ? r.unit : 1
    const buy = r.forex_buying != null ? r.forex_buying / unit : null
    const sell = r.forex_selling != null ? r.forex_selling / unit : null
    if (buy === null && sell === null) continue
    currency[r.code.toUpperCase()] = {
      buy: buy ?? sell ?? 0,
      sell: sell ?? buy ?? 0,
    }
  }

  const gold: MarketRates['gold'] = {}
  const byType = new Map((goldJson.prices ?? []).map((p) => [p.type, p]))
  for (const [canonical, type] of Object.entries(TURKPIDYA_GOLD_TYPES)) {
    const p = byType.get(type)
    if (!p) continue
    gold[canonical] = { buy: p.buy, sell: p.sell }
  }

  return {
    updatedAt: goldJson.last_updated ?? fxJson.last_updated ?? '',
    source: 'Turkpidya (TCMB + altın, ücretsiz API)',
    currency,
    gold,
  }
}

export async function fetchMarketRates(
  force = false,
): Promise<MarketRates> {
  if (
    !force &&
    cache &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.rates
  }

  try {
    const res = await fetch(TRUNCGIL_URL)
    if (!res.ok) throw new Error(`Truncgil HTTP ${res.status}`)
    const data = (await res.json()) as Record<string, unknown>
    const rates = parseTruncgil(data)
    cache = { at: Date.now(), rates }
    return rates
  } catch {
    const rates = await fetchTurkpidya()
    cache = { at: Date.now(), rates }
    return rates
  }
}

/** Alacak: alış; verecek: satış fiyatı (TL’ye çevirirken) */
function priceSide(direction: DebtDirection): 'buy' | 'sell' {
  return direction === 'receivable' ? 'buy' : 'sell'
}

export function unitTryRate(
  rates: MarketRates,
  assetType: DebtAssetType,
  unit: string | undefined,
  direction: DebtDirection,
): number | null {
  const side = priceSide(direction)

  if (assetType === 'cash' || assetType === 'currency') {
    const code = (unit?.trim() || (assetType === 'cash' ? 'TRY' : '')).toUpperCase()
    if (!code) return null
    if (code === 'TRY' || code === 'TL') return 1
    const row = rates.currency[code]
    if (!row) return null
    return row[side]
  }

  if (assetType === 'gold') {
    const key = resolveGoldKey(unit ?? '')
    if (!key) return null
    const row = rates.gold[key]
    if (!row) return null
    return row[side]
  }

  return null
}

export function debtItemTryValue(
  item: DebtEvent,
  rates: MarketRates,
): number | null {
  const rate = unitTryRate(
    rates,
    item.assetType,
    item.unit,
    item.direction,
  )
  if (rate === null) return null
  const amount =
    item.assetType === 'gold' ? Math.round(item.amount) : item.amount
  return Number((amount * rate).toFixed(2))
}

/** Açık borçların TL toplamı; çevrilemeyenler hariç */
export function sumOpenDebtsTry(
  items: DebtEvent[],
  rates: MarketRates,
): { totalTry: number; converted: number; skipped: number } {
  let totalTry = 0
  let converted = 0
  let skipped = 0
  for (const item of items) {
    if (item.paidAt) continue
    const value = debtItemTryValue(item, rates)
    if (value === null) {
      skipped += 1
      continue
    }
    totalTry += value
    converted += 1
  }
  return {
    totalTry: Number(totalTry.toFixed(2)),
    converted,
    skipped,
  }
}

export function formatTry(value: number): string {
  return `${value.toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ₺`
}
