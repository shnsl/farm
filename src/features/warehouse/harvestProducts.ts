/** Ağaç çeşidi "Fıstık" kalır; hasat / depo ürünleri ayrıdır. */
export const BOZ_FISTIK = 'Boz Fıstık'
export const BEN_FISTIK = 'Ben Fıstık'

export const FISTIK_HARVEST_PRODUCTS = [BOZ_FISTIK, BEN_FISTIK] as const

/** Ağaç "Zeytin"; hasat tane, depo zeytinyağı (lt / teneke). */
export const TANE_ZEYTIN = 'Tane Zeytin'
export const ZEYTINYAGI = 'Zeytinyağı'
/** Bir teneke zeytinyağı kapasitesi (litre). */
export const TENEKE_LITERS = 17

export const ZEYTIN_HARVEST_PRODUCTS = [TANE_ZEYTIN] as const

function normalizeSpecies(species: string): string {
  return species.trim().toLocaleLowerCase('tr-TR')
}

/** Tarla / ağaç çeşidi düz "Fıstık" mi? (hasat ürünü değil) */
export function isFistikTreeSpecies(species?: string | null): boolean {
  const s = normalizeSpecies(species ?? '')
  return s === 'fıstık' || s === 'fistik'
}

/** Düz "Fıstık" depo satırı (eski stok) — Boz/Ben değil */
export function isPlainFistikStock(species?: string | null): boolean {
  return isFistikTreeSpecies(species)
}

export function isOliveTreeSpecies(species?: string | null): boolean {
  const s = normalizeSpecies(species ?? '')
  return s === 'zeytin'
}

export function isOliveFruitHarvest(species?: string | null): boolean {
  const s = normalizeSpecies(species ?? '')
  return s === 'tane zeytin'
}

export function isOliveOilStock(species?: string | null): boolean {
  const s = normalizeSpecies(species ?? '')
  return s === 'zeytinyağı' || s === 'zeytinyagi'
}

/** Hasat kilosu doğrudan aynı çeşit adıyla depoya mı yazılsın? */
export function harvestAddsToWarehouse(species?: string | null): boolean {
  if (!species?.trim()) return false
  if (isOliveFruitHarvest(species)) return false
  return true
}

/** kg tane / verim = litre zeytinyağı */
export function oliveOilLitersFromHarvest(kg: number, verim: number): number {
  if (!(kg > 0) || !(verim > 0)) return 0
  return Number((kg / verim).toFixed(2))
}

/**
 * Hasat kaydının depoya etkisi.
 * Tane zeytin → Zeytinyağı (lt); diğer ürünler → kendi çeşidi (kg).
 */
export function warehouseDeltaFromHarvest(
  species: string | null | undefined,
  kg: number,
  verim?: number | null,
): { species: string; delta: number } | null {
  const name = species?.trim() || ''
  if (!name || !(kg > 0)) return null
  if (isOliveFruitHarvest(name)) {
    const liters = oliveOilLitersFromHarvest(kg, verim ?? 0)
    if (!(liters > 0)) return null
    return { species: ZEYTINYAGI, delta: liters }
  }
  if (harvestAddsToWarehouse(name)) {
    return { species: name, delta: kg }
  }
  return null
}

export function tenekeToLiters(teneke: number): number {
  return Number((teneke * TENEKE_LITERS).toFixed(2))
}

export function litersToTeneke(liters: number): number {
  return Number((liters / TENEKE_LITERS).toFixed(4))
}

export function splitOliveOilTeneke(liters: number): {
  teneke: number
  remainderLt: number
  totalLt: number
} {
  const totalLt = Math.max(0, Number(liters.toFixed(2)))
  const teneke = Math.floor(totalLt / TENEKE_LITERS)
  const remainderLt = Number((totalLt - teneke * TENEKE_LITERS).toFixed(2))
  return { teneke, remainderLt, totalLt }
}

/** Ağaç çeşidine göre hasatta seçilecek ürün listesi; yoksa serbest metin. */
export function harvestProductsForTreeSpecies(
  treeSpecies?: string | null,
): string[] | null {
  if (isFistikTreeSpecies(treeSpecies)) {
    return [...FISTIK_HARVEST_PRODUCTS]
  }
  if (isOliveTreeSpecies(treeSpecies)) {
    return [...ZEYTIN_HARVEST_PRODUCTS]
  }
  return null
}

/** Hasat formu varsayılanı. */
export function defaultHarvestSpecies(treeSpecies?: string | null): string {
  if (isOliveTreeSpecies(treeSpecies)) return TANE_ZEYTIN
  if (isFistikTreeSpecies(treeSpecies)) return ''
  return treeSpecies?.trim() ?? ''
}

export function stockUnitLabel(species?: string | null): 'kg' | 'lt' {
  return isOliveOilStock(species) ? 'lt' : 'kg'
}

export function formatStockAmount(species: string, qty: number): string {
  if (isOliveOilStock(species)) {
    const { teneke, remainderLt, totalLt } = splitOliveOilTeneke(qty)
    const totalText = totalLt.toLocaleString('tr-TR', {
      maximumFractionDigits: 2,
    })
    const remText = remainderLt.toLocaleString('tr-TR', {
      maximumFractionDigits: 2,
    })
    if (remainderLt > 0.001) {
      return `${teneke} teneke + ${remText} lt · toplam ${totalText} lt`
    }
    return `${teneke} teneke · toplam ${totalText} lt`
  }
  return `${qty.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} kg`
}
