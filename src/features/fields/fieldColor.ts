/** Kayıtlı tarla kartı renk grupları (isim eşlemesi). */

export type FieldColorTone =
  | 'bazinta'
  | 'selmincik'
  | 'cat'
  | 'buldum'
  | 'dag'
  | 'other'

interface FieldColorGroup {
  tone: FieldColorTone
  /** Liste sırası (küçük önce) */
  order: number
  /** Normalize edilmiş tam isim eşlemeleri */
  names: string[]
}

function normalizeFieldName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, ' ')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

const FIELD_COLOR_GROUPS: FieldColorGroup[] = [
  {
    tone: 'bazinta',
    order: 0,
    names: ['bazinta', 'muska', 'hiltanli'],
  },
  {
    tone: 'selmincik',
    order: 1,
    names: [
      'boz tarla',
      'selmincik alt',
      'selmincik ust',
      'caade alti',
      'cade alti',
    ],
  },
  {
    tone: 'cat',
    order: 2,
    names: [
      'cat kanal alti',
      'cat kanal ustu',
      'cat kanal ust',
      'sinir dogu',
      'kutuk',
    ],
  },
  {
    tone: 'buldum',
    order: 3,
    names: [
      'buldum',
      'incecik',
      'sekep yolu alt',
      'sekep yolu ust',
      'sekep yolu alti',
      'sekep yolu ustu',
    ],
  },
  {
    tone: 'dag',
    order: 4,
    names: ['dag'],
  },
]

const OTHER_ORDER = 100

export function fieldColorOrder(name: string): number {
  const key = normalizeFieldName(name)
  for (const group of FIELD_COLOR_GROUPS) {
    if (group.names.includes(key)) return group.order
  }
  return OTHER_ORDER
}

export function fieldColorTone(name: string): FieldColorTone {
  const key = normalizeFieldName(name)
  for (const group of FIELD_COLOR_GROUPS) {
    if (group.names.includes(key)) return group.tone
  }
  return 'other'
}

export function fieldColorClass(name: string): string {
  return `field-tone-${fieldColorTone(name)}`
}
