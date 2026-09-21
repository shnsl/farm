export type TreeStatus = 'active' | 'removed' | 'dead'

export type CareType =
  | 'prune'
  | 'spray'
  | 'fertilize'
  | 'water'
  | 'inspect'
  | 'other'

export type CareScope = 'tree' | 'field'

export interface UserProfile {
  email: string
  displayName?: string
  farmId: string
  createdAt: string
}

export interface Farm {
  name: string
  ownerUid: string
  createdAt: string
}

export interface PlowWindow {
  id: string
  label: string
  /** MM-DD */
  startMonthDay: string
  /** MM-DD */
  endMonthDay: string
}

export interface PlowStandard {
  timesPerYear: number
  windows: PlowWindow[]
}

export interface Field {
  id: string
  name: string
  /** Satır sayısı (A, B, C...) — enindeki ağaç sayısı */
  rowCount: number
  /** Sütun sayısı (1..N) — boyundaki ağaç sayısı */
  colCount: number
  /** Yer / bölge (örn. Buldum Fıstık) */
  area?: string
  /** Tarla büyüklüğü (dönüm) */
  donum?: number
  /** Tarlanın varsayılan / toplu ağaç çeşidi */
  species?: string
  notes?: string
  /** Tarla alanı harita fotoğrafı (sıkıştırılmış JPEG data URL) */
  mapImageDataUrl?: string
  /** Yüklenen harita dosya adı */
  mapFileName?: string
  /** Harita fotoğrafı son güncelleme (ISO) */
  mapUpdatedAt?: string
  plowStandard: PlowStandard
  createdAt: string
  updatedAt: string
}

export type TreeHealth = 'good' | 'weak' | 'sick'

export interface Tree {
  id: string
  cell: string
  row: string
  col: number
  species?: string
  /** Kısa etiket / kod */
  label?: string
  plantedAt?: string
  health?: TreeHealth
  status: TreeStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CareEvent {
  id: string
  treeId?: string
  scope: CareScope
  type: CareType
  doneAt?: string
  dueAt?: string
  notes?: string
  createdBy: string
  createdAt: string
}

export type PlowDirection = 'enine' | 'boyuna'

export const PLOW_EQUIPMENT_OPTIONS = [
  'Kültivator',
  'Dizgaro',
  'Alabora',
  'Toztapan',
  'Silindir',
  'Beşli',
  'Köten',
] as const

export type PlowEquipmentPreset = (typeof PLOW_EQUIPMENT_OPTIONS)[number]

export interface PlowEvent {
  id: string
  doneAt: string
  direction: PlowDirection
  /** Sürüm ekipmanı (listeden veya elle girilen) */
  equipment?: string
  notes?: string
  createdBy: string
  createdAt: string
}

export interface HarvestEvent {
  id: string
  doneAt: string
  /** O seneki hasatta çalışan işçi sayısı */
  workerCount: number
  /** Günlük yevmiye (birim para) */
  dailyWage: number
  /** İşçilere ödenen toplam tutar */
  totalPaid: number
  /** Tahmini hasat edilen kilo */
  estimatedKg?: number
  /** Ürün ortalama fiyatı (birim / kg) */
  avgPricePerKg?: number
  notes?: string
  createdBy: string
  createdAt: string
}

export type FuelKind = 'purchase' | 'consumption'

export interface FuelEvent {
  id: string
  /** Alım (eski tüketim kayıtları okunabilir) */
  kind: FuelKind
  /** Alım tarihi */
  doneAt: string
  /** Litre */
  liters: number
  /** Birim fiyat (₺/lt) */
  unitPrice?: number
  /** Toplam tutar */
  totalCost?: number
  /** Nereden alındığı (istasyon / satıcı) */
  source?: string
  notes?: string
  createdBy: string
  createdAt: string
}

export interface FertilizeEvent {
  id: string
  /** Gübreleme tarihi */
  doneAt: string
  /** Gübre cinsi */
  fertilizerType: string
  /** Gübreleme masrafı */
  cost: number
  notes?: string
  createdBy: string
  createdAt: string
}

export interface PruneEvent {
  id: string
  /** Budama tarihi */
  doneAt: string
  /** İşçi sayısı */
  workerCount: number
  /** Elçi (ustabaşı) adı */
  foremanName: string
  /** Elçi telefonu */
  foremanPhone: string
  /** İşçi başı yevmiye */
  dailyWage: number
  /** Budama süresi (gün) */
  durationDays: number
  notes?: string
  createdBy: string
  createdAt: string
}

export interface HoeEvent {
  id: string
  /** Çapalama tarihi */
  doneAt: string
  /** İşçi sayısı */
  workerCount: number
  /** İşçi başı yevmiye */
  dailyWage: number
  /** Toplam harcama */
  totalPaid: number
  notes?: string
  createdBy: string
  createdAt: string
}

/** Depoda bekleyen tarım ilacı stoku (çiftlik geneli) */
export interface PesticideStockItem {
  id: string
  /** İlaç adı */
  name: string
  /** Son kullanma / miat tarihi */
  expiresAt: string
  /** Adet (tane) */
  quantityPieces: number
  /** Miktar (ml) */
  quantityMl: number
  /** Hangi ağaç çeşidi için */
  treeSpecies: string
  /** Kullanım dozu: kaç litre suya */
  doseWaterLiters: number
  notes?: string
  createdBy: string
  createdAt: string
}

/** Yıllık ilaçlama masrafı kaydı (çiftlik geneli; isteğe bağlı tarla) */
export interface PesticideExpenseEvent {
  id: string
  doneAt: string
  /** İlaç adı (opsiyonel) */
  pesticideName?: string
  /** Masraf */
  cost: number
  /** Hızlı giriş / tarlaya bağlı ilaçlama */
  fieldId?: string
  notes?: string
  createdBy: string
  createdAt: string
}

export interface CareStandard {
  type: CareType
  label: string
  /** Varsayılan tekrar aralığı (gün) */
  intervalDays: number
  notes?: string
}
