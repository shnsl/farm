import type { PlowWindow } from '../types'

/**
 * Sürme tarih pencereleri — MM-DD formatında.
 * Tarla oluştururken plowStandard.windows olarak kopyalanır; sonra tarla bazında değiştirilebilir.
 */
export const defaultPlowWindows: PlowWindow[] = [
  {
    id: 'spring',
    label: 'İlkbahar sürümü',
    startMonthDay: '03-01',
    endMonthDay: '04-15',
  },
  {
    id: 'autumn',
    label: 'Sonbahar sürümü',
    startMonthDay: '09-15',
    endMonthDay: '11-01',
  },
]

export const defaultTimesPerYear = defaultPlowWindows.length
