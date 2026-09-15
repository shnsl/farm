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
  /** Tarlanın varsayılan / toplu ağaç çeşidi */
  species?: string
  notes?: string
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

export interface PlowEvent {
  id: string
  windowId: string
  doneAt: string
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
