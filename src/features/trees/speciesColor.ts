/** Bilinen çeşitler için sabit renkler (Türkçe eş anlamlılar dahil). */
const KNOWN_SPECIES_COLORS: Record<string, string> = {
  fistık: '#3f7a4c',
  fistik: '#3f7a4c',
  antepfistigi: '#3f7a4c',
  antepfıstığı: '#3f7a4c',
  pistache: '#3f7a4c',
  pistachio: '#3f7a4c',
  incir: '#7a4ea8',
  fig: '#7a4ea8',
  zeytin: '#6b7a3a',
  olive: '#6b7a3a',
  uzum: '#8a3a5c',
  üzüm: '#8a3a5c',
  grape: '#8a3a5c',
  elma: '#c45c3a',
  apple: '#c45c3a',
  armıt: '#b08a2e',
  armut: '#b08a2e',
  pear: '#b08a2e',
  seftali: '#d17a4a',
  şeftali: '#d17a4a',
  peach: '#d17a4a',
  kayısı: '#d4a017',
  kayisi: '#d4a017',
  apricot: '#d4a017',
  badem: '#8b6914',
  almond: '#8b6914',
  ceviz: '#6b4f2a',
  walnut: '#6b4f2a',
  nar: '#b33a3a',
  pomegranate: '#b33a3a',
  limon: '#c9b22e',
  lemon: '#c9b22e',
  portakal: '#d4782a',
  orange: '#d4782a',
  erik: '#6a4a8a',
  plum: '#6a4a8a',
  kiraz: '#a83248',
  cherry: '#a83248',
  dut: '#5a3a6a',
  mulberry: '#5a3a6a',
}

const PALETTE = [
  '#2f6b8a',
  '#8a5a2b',
  '#3d7a8c',
  '#9a4a6a',
  '#4a6b3a',
  '#6b4ea0',
  '#a05a2e',
  '#2a7a6a',
  '#7a3a4a',
  '#4a5a8a',
]

const DEFAULT_FILLED = '#3f7a4c'

function normalizeSpeciesKey(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9ğüşıöç]/gi, '')
    .replace(/\s+/g, '')
}

function hashHue(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  }
  return h
}

/** Çeşit adına göre kararlı hücre rengi. Fıstık yeşil, incir mor vb. */
export function speciesColor(species?: string | null): string {
  const trimmed = species?.trim()
  if (!trimmed) return DEFAULT_FILLED

  const key = normalizeSpeciesKey(trimmed)
  if (KNOWN_SPECIES_COLORS[key]) return KNOWN_SPECIES_COLORS[key]

  // Kısmi eşleşme (örn. "Antep fıstığı")
  for (const [known, color] of Object.entries(KNOWN_SPECIES_COLORS)) {
    if (key.includes(known) || known.includes(key)) return color
  }

  const hash = hashHue(key)
  return PALETTE[hash % PALETTE.length]
}
