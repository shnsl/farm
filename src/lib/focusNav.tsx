import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SearchHitKind } from '../features/search/api'

export type FocusKind = SearchHitKind

/** Hangi collapse bölümleri açılacak */
export const FOCUS_SECTIONS: Record<FocusKind, string[]> = {
  field: ['fields-list', 'field-info'],
  tree: ['field-grid'],
  generalWork: ['general-works'],
  plow: ['plow', 'plow-records'],
  harvest: ['plow', 'harvest', 'harvest-stats'],
  fertilize: ['care', 'fertilize-records'],
  hoe: ['hoe', 'hoe-records'],
  prune: ['prune', 'prune-records'],
  fuel: ['fuel'],
  pesticideExpense: ['pesticide', 'pesticide-expenses'],
  pesticideStock: ['pesticide', 'pesticide-stock'],
  warehouseStock: ['depot'],
  sale: ['sales'],
  debt: ['debts-list'],
}

interface FocusNavValue {
  kind: FocusKind | null
  entityId: string | null
  highlight: string
  openSections: Set<string>
  /** Değişince scroll/highlight yeniden çalışır */
  token: string
  isTarget: (kind: FocusKind, entityId: string) => boolean
  clearFocus: () => void
}

const FocusNavContext = createContext<FocusNavValue | null>(null)

export function useFocusNav(): FocusNavValue | null {
  return useContext(FocusNavContext)
}

export function buildFocusHref(options: {
  path: string
  kind: FocusKind
  entityId: string
  highlight?: string
  cell?: string
}): string {
  const params = new URLSearchParams()
  params.set('focus', options.kind)
  params.set('fid', options.entityId)
  if (options.highlight?.trim()) {
    params.set('hl', options.highlight.trim())
  }
  if (options.cell) {
    params.set('cell', options.cell)
  }
  const q = params.toString()
  return q ? `${options.path}?${q}` : options.path
}

export function focusDomId(kind: FocusKind, entityId: string): string {
  return `${kind}:${entityId}`
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function FocusNavProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const kind = (params.get('focus') as FocusKind | null) || null
  const entityId = params.get('fid')
  const highlight = params.get('hl') ?? ''
  const token = `${kind ?? ''}|${entityId ?? ''}|${highlight}`

  const openSections = useMemo(() => {
    if (!kind) return new Set<string>()
    return new Set(FOCUS_SECTIONS[kind] ?? [])
  }, [kind])

  const value = useMemo<FocusNavValue>(
    () => ({
      kind,
      entityId,
      highlight,
      openSections,
      token,
      isTarget: (k, id) => kind === k && entityId === id,
      clearFocus: () => {
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('focus')
            next.delete('fid')
            next.delete('hl')
            return next
          },
          { replace: true },
        )
      },
    }),
    [kind, entityId, highlight, openSections, token, setParams],
  )

  useEffect(() => {
    if (!kind || !entityId) return
    const domId = focusDomId(kind, entityId)
    let cancelled = false

    void (async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        if (cancelled) return
        await sleep(attempt === 0 ? 80 : 120)
        if (cancelled) return
        const el = document.querySelector(
          `[data-focus-id="${CSS.escape(domId)}"]`,
        ) as HTMLElement | null
        if (!el) continue

        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.remove('is-focus-target')
        // retrigger animation
        void el.offsetWidth
        el.classList.add('is-focus-target')
        window.setTimeout(() => {
          el.classList.remove('is-focus-target')
        }, 3200)
        return
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, kind, entityId])

  return (
    <FocusNavContext.Provider value={value}>{children}</FocusNavContext.Provider>
  )
}

/** Metindeki arama eşleşmesini yanıp sönen mark ile gösterir */
export function HighlightText({
  text,
  query,
  active = true,
}: {
  text: string
  query?: string
  active?: boolean
}) {
  const q = (query ?? '').trim()
  if (!active || !q || !text) return <>{text}</>

  const lowerText = text.toLocaleLowerCase('tr')
  const lowerQ = q.toLocaleLowerCase('tr')
  const parts: Array<{ text: string; hit: boolean }> = []
  let cursor = 0
  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQ, cursor)
    if (idx === -1) {
      parts.push({ text: text.slice(cursor), hit: false })
      break
    }
    if (idx > cursor) {
      parts.push({ text: text.slice(cursor, idx), hit: false })
    }
    parts.push({ text: text.slice(idx, idx + q.length), hit: true })
    cursor = idx + q.length
  }

  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className="focus-mark">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}
