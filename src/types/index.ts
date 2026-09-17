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

export interface PlowEvent {
  id: string
  doneAt: string
  direction: PlowDirection
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

export interface FuelEvent {
  id: string
  /** Yakıt alım zamanı */
  purchasedAt: string
  /** Litre */
  liters: number
  /** Birim fiyat (₺/lt) */
  unitPrice: number
  /** Toplam tutar (lt × birim fiyat) */
  totalCost: number
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

export interface CareStandard {
  type: CareType
  label: string
  /** Varsayılan tekrar aralığı (gün) */
  intervalDays: number
  notes?: string
}
