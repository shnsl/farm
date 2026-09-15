import type { CareStandard } from '../types'

/**
 * Bakım standartları — değerleri kendi takvimine göre düzenle.
 * Firestore `farms/{farmId}/config/careStandards` ile senkron ileride eklenebilir.
 */
export const careStandards: CareStandard[] = [
  {
    type: 'prune',
    label: 'Budama',
    intervalDays: 365,
    notes: 'Yıllık budama penceresi (örnek)',
  },
  {
    type: 'spray',
    label: 'İlaçlama',
    intervalDays: 45,
    notes: 'Zararlı / hastalık durumuna göre kısaltılabilir',
  },
  {
    type: 'fertilize',
    label: 'Gübreleme',
    intervalDays: 180,
  },
  {
    type: 'water',
    label: 'Sulama',
    intervalDays: 14,
  },
  {
    type: 'inspect',
    label: 'Kontrol',
    intervalDays: 30,
  },
]
