import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  APP_ACCENTS,
  DEFAULT_ACCENT_ID,
  getAccentOption,
  getAccentPalette,
  isAccentId,
  type AccentId,
  type AccentOption,
} from './accents'
import { useTheme } from './theme'

interface AccentContextValue {
  accentId: AccentId
  accent: AccentOption
  accents: AccentOption[]
  setAccentId: (id: AccentId) => void
}

const STORAGE_KEY = 'farm-accent'
const AccentContext = createContext<AccentContextValue | null>(null)

function applyBrowserChromeColor(color: string) {
  const head = document.head
  let meta = head.querySelector(
    'meta[name="theme-color"]:not([media])',
  ) as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    head.appendChild(meta)
  }
  meta.content = color

  // Tercih edilen renk şemasına bağlı sabit meta'lar çakışmasın
  head
    .querySelectorAll('meta[name="theme-color"][media]')
    .forEach((el) => el.remove())

  let tile = head.querySelector(
    'meta[name="msapplication-TileColor"]',
  ) as HTMLMetaElement | null
  if (!tile) {
    tile = document.createElement('meta')
    tile.name = 'msapplication-TileColor'
    head.appendChild(tile)
  }
  tile.content = color
}

function applyAccent(id: AccentId, mode: 'light' | 'dark') {
  const palette = getAccentPalette(id, mode)
  const root = document.documentElement
  root.setAttribute('data-accent', id)
  root.style.setProperty('--brand', palette.brand)
  root.style.setProperty('--brand-strong', palette.brandStrong)
  root.style.setProperty('--filled', palette.filled)
  root.style.setProperty('--bg', palette.bg)
  root.style.setProperty('--bg-accent', palette.bgAccent)
  root.style.setProperty('--surface', palette.surface)
  root.style.setProperty('--ink', palette.ink)
  root.style.setProperty('--muted', palette.muted)
  root.style.setProperty('--line', palette.line)
  root.style.setProperty('--cell-empty', palette.cellEmpty)
  root.style.setProperty('--cell-empty-border', palette.cellEmptyBorder)
  root.style.setProperty('--success-bg', palette.successBg)
  root.style.setProperty('--success-border', palette.successBorder)
  root.style.setProperty('--glow', palette.glow)
  root.style.setProperty('--bg-top', palette.bgTop)
  root.style.setProperty('--bg-bottom', palette.bgBottom)
  root.style.setProperty(
    '--input-bg',
    mode === 'dark' ? palette.bg : '#ffffff',
  )
  // Android / PWA durum çubuğu seçilen tema rengine uyumlanır
  applyBrowserChromeColor(palette.brand)
}

function readStoredAccent(): AccentId {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (isAccentId(stored)) return stored
  return DEFAULT_ACCENT_ID
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const [accentId, setAccentIdState] = useState<AccentId>(() => {
    if (typeof window === 'undefined') return DEFAULT_ACCENT_ID
    const initial = readStoredAccent()
    applyAccent(initial, readStoredThemeMode())
    return initial
  })

  useEffect(() => {
    applyAccent(accentId, theme)
    localStorage.setItem(STORAGE_KEY, accentId)
  }, [accentId, theme])

  const setAccentId = useCallback((id: AccentId) => {
    setAccentIdState(id)
  }, [])

  const value = useMemo(
    () => ({
      accentId,
      accent: getAccentOption(accentId),
      accents: APP_ACCENTS,
      setAccentId,
    }),
    [accentId, setAccentId],
  )

  return (
    <AccentContext.Provider value={value}>{children}</AccentContext.Provider>
  )
}

function readStoredThemeMode(): 'light' | 'dark' {
  const stored = localStorage.getItem('farm-theme')
  if (stored === 'dark' || stored === 'light') return stored
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

export function useAccent(): AccentContextValue {
  const ctx = useContext(AccentContext)
  if (!ctx) {
    throw new Error('useAccent yalnızca AccentProvider içinde kullanılabilir')
  }
  return ctx
}
