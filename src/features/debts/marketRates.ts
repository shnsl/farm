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
/** YYYY-MM-DD → tarihsel kur önbelleği */
const histCache = new Map<string, MarketRates>()

const TCMB_HIST_URL = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `https://www.tcmb.gov.tr/kurlar/${y}${m}/${d}${m}${y}.xml`
}

const XAU_HIST_URL = (iso: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${iso}/v1/currencies/xau.json`
const XAU_LATEST_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json'

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

async function fetchTurkpidya(force = false): Promise<MarketRates> {
  const [goldRes, fxRes] = await Promise.all([
    fetchJson(TURKPIDYA_GOLD_URL, force),
    fetchJson(TURKPIDYA_FX_URL, force),
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

function withBust(url: string, force: boolean) {
  if (!force) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}_=${Date.now()}`
}

async function fetchJson(
  url: string,
  force: boolean,
): Promise<Response> {
  return fetch(withBust(url, force), {
    // Truncgil max-age ~10 yıl verdiği için her istekte HTTP önbelleğini atla
    cache: 'no-store',
  })
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

  if (force) cache = null

  try {
    const res = await fetchJson(TRUNCGIL_URL, force)
    if (!res.ok) throw new Error(`Truncgil HTTP ${res.status}`)
    const data = (await res.json()) as Record<string, unknown>
    const rates = parseTruncgil(data)
    cache = { at: Date.now(), rates }
    return rates
  } catch {
    const rates = await fetchTurkpidya(force)
    cache = { at: Date.now(), rates }
    return rates
  }
}

/** İstanbul takvimine göre bugünün YYYY-MM-DD değeri */
export function todayIsoIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function shiftIsoDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return dt.toISOString().slice(0, 10)
}

function parseTcmbXml(xml: string): MarketRates['currency'] {
  const currency: MarketRates['currency'] = { TRY: { buy: 1, sell: 1 } }
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const nodes = doc.querySelectorAll('Currency')
  for (const node of nodes) {
    const code = (node.getAttribute('CurrencyCode') ?? '').toUpperCase()
    if (!code || code === 'XDR') continue
    const unit = num(node.querySelector('Unit')?.textContent) ?? 1
    const buyRaw = num(node.querySelector('ForexBuying')?.textContent)
    const sellRaw = num(node.querySelector('ForexSelling')?.textContent)
    if (buyRaw === null && sellRaw === null) continue
    const buy = (buyRaw ?? sellRaw ?? 0) / (unit > 0 ? unit : 1)
    const sell = (sellRaw ?? buyRaw ?? 0) / (unit > 0 ? unit : 1)
    currency[code] = { buy, sell }
  }
  return currency
}

async function fetchTcmbCurrencyAsOf(
  dateIso: string,
): Promise<{ asOf: string; currency: MarketRates['currency'] } | null> {
  let cursor = dateIso.slice(0, 10)
  for (let i = 0; i < 14; i += 1) {
    try {
      const res = await fetch(TCMB_HIST_URL(cursor), { cache: 'no-store' })
      if (res.ok) {
        const xml = await res.text()
        return { asOf: cursor, currency: parseTcmbXml(xml) }
      }
    } catch {
      /* sonraki iş günü */
    }
    cursor = shiftIsoDate(cursor, -1)
  }
  return null
}

async function fetchXauTryAsOf(dateIso: string): Promise<number | null> {
  let cursor = dateIso.slice(0, 10)
  for (let i = 0; i < 14; i += 1) {
    try {
      const res = await fetch(XAU_HIST_URL(cursor), { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as { xau?: { try?: number } }
        const v = num(data.xau?.try)
        if (v != null && v > 0) return v
      }
    } catch {
      /* sonraki gün */
    }
    cursor = shiftIsoDate(cursor, -1)
  }
  return null
}

async function fetchLatestXauTry(): Promise<number | null> {
  try {
    const res = await fetch(XAU_LATEST_URL, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { xau?: { try?: number } }
    return num(data.xau?.try)
  } catch {
    return null
  }
}

/**
 * Belirli bir takvim gününün kurları.
 * Bugün / gelecek → canlı Truncgil; geçmiş → TCMB döviz + XAU oranıyla ölçeklenmiş altın.
 */
export async function fetchMarketRatesAsOf(
  dateIso: string,
): Promise<MarketRates> {
  const day = dateIso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return fetchMarketRates(true)
  }

  const today = todayIsoIstanbul()
  if (day >= today) {
    return fetchMarketRates(true)
  }

  const cached = histCache.get(day)
  if (cached) return cached

  const live = await fetchMarketRates(true)
  const tcmb = await fetchTcmbCurrencyAsOf(day)
  const histXau = await fetchXauTryAsOf(day)
  const liveXau = await fetchLatestXauTry()

  const currency = tcmb?.currency ?? { ...live.currency }
  if (!currency.TRY) currency.TRY = { buy: 1, sell: 1 }

  let gold = { ...live.gold }
  const ratio =
    histXau != null && liveXau != null && liveXau > 0
      ? histXau / liveXau
      : null
  if (ratio != null && Number.isFinite(ratio) && ratio > 0) {
    gold = {}
    for (const [key, row] of Object.entries(live.gold)) {
      gold[key] = {
        buy: Number((row.buy * ratio).toFixed(4)),
        sell: Number((row.sell * ratio).toFixed(4)),
      }
    }
  }

  const rates: MarketRates = {
    updatedAt: tcmb?.asOf ?? day,
    source:
      tcmb != null
        ? `TCMB arşiv (${tcmb.asOf})` +
          (ratio != null ? ' + XAU ölçekli altın' : '')
        : `Tarihsel yaklaşık (${day})`,
    currency,
    gold,
  }
  histCache.set(day, rates)
  return rates
}

/** Alacak: alış; verecek: satış fiyatı (TL’ye çevirirken) */
function priceSide(direction: DebtDirection): 'buy' | 'sell' {
  return direction === 'receivable' ? 'buy' : 'sell'
}

/** TL dışı döviz / altın için kur kaydı gerekir */
export function debtNeedsMarketRate(
  assetType: DebtAssetType,
  unit?: string,
): boolean {
  if (assetType === 'other') return false
  if (assetType === 'gold') return true
  const code = (
    unit?.trim() || (assetType === 'cash' ? 'TRY' : '')
  ).toUpperCase()
  if (!code) return false
  return code !== 'TRY' && code !== 'TL'
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

export type DebtRateQuote = {
  key: string
  label: string
  kind: 'currency' | 'gold'
  buy: number | null
  sell: number | null
}

const GOLD_LABELS: Record<string, string> = {
  gram: 'Gram altın',
  ceyrek: 'Çeyrek altın',
  yarim: 'Yarım altın',
  tam: 'Tam altın',
  ata: 'Ata altın',
  cumhuriyet: 'Cumhuriyet altını',
  resat: 'Reşat altın',
  gremse: 'Gremse altın',
}

/**
 * Açık borçlardaki döviz / altın birimleri için alış–satış (TRY).
 * Yalnızca kayıtlarında geçen türler; nakit TRY ve “Diğer” hariç.
 */
export function openDebtRateQuotes(
  items: DebtEvent[],
  rates: MarketRates,
): DebtRateQuote[] {
  const seen = new Map<string, DebtRateQuote>()

  for (const item of items) {
    if (item.paidAt) continue

    if (item.assetType === 'currency') {
      const code = (item.unit?.trim() || '').toUpperCase()
      if (!code || code === 'TRY' || code === 'TL') continue
      const key = `fx:${code}`
      if (seen.has(key)) continue
      const row = rates.currency[code]
      seen.set(key, {
        key,
        label: code,
        kind: 'currency',
        buy: row?.buy ?? null,
        sell: row?.sell ?? null,
      })
      continue
    }

    if (item.assetType === 'gold') {
      const canonical = resolveGoldKey(item.unit ?? '')
      if (!canonical) continue
      const key = `au:${canonical}`
      if (seen.has(key)) continue
      const row = rates.gold[canonical]
      seen.set(key, {
        key,
        label: GOLD_LABELS[canonical] ?? item.unit ?? canonical,
        kind: 'gold',
        buy: row?.buy ?? null,
        sell: row?.sell ?? null,
      })
    }
  }

  return [...seen.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'tr'),
  )
}
