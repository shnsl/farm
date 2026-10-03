import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type WheelOption = {
  value: string
  label: string
}

const DEFAULT_ITEM_H = 40
/** Sonsuz döngü için seçenek listesi kopya sayısı (ortadaki bantta kalınır) */
const LOOP_COPIES = 5

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function mod(n: number, m: number) {
  if (m <= 0) return 0
  return ((n % m) + m) % m
}

function readItemH(root: HTMLElement) {
  const item = root.querySelector<HTMLElement>('.wheel-item')
  // offsetHeight: transform (scale/rotate) hariç gerçek satır yüksekliği
  if (item && item.offsetHeight > 0) return item.offsetHeight
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;height:var(--item-h)'
  root.appendChild(probe)
  const h = probe.offsetHeight
  probe.remove()
  return h > 0 ? h : DEFAULT_ITEM_H
}

export function WheelColumn({
  options,
  value,
  onChange,
  loop = true,
}: {
  options: WheelOption[]
  value: string
  onChange: (value: string) => void
  /** Sona gelince başa / başa gelince sona döner */
  loop?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const itemHRef = useRef(DEFAULT_ITEM_H)
  const suppressScrollRef = useRef(false)
  const suppressTimerRef = useRef(0)
  const [pad, setPad] = useState(2)
  const [itemH, setItemH] = useState(DEFAULT_ITEM_H)
  const looping = loop && options.length > 1
  const loopingRef = useRef(looping)
  loopingRef.current = looping
  const midBase = Math.floor(LOOP_COPIES / 2) * options.length
  const midBaseRef = useRef(midBase)
  midBaseRef.current = midBase
  const found = options.findIndex((o) => o.value === value)
  const index = found >= 0 ? found : 0
  const indexRef = useRef(index)
  indexRef.current = index
  const optionsRef = useRef(options)
  optionsRef.current = options
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const renderOptions = useMemo(() => {
    if (!looping) return options.map((opt, i) => ({ opt, visual: i }))
    const list: Array<{ opt: WheelOption; visual: number }> = []
    for (let c = 0; c < LOOP_COPIES; c += 1) {
      for (let i = 0; i < options.length; i += 1) {
        list.push({ opt: options[i]!, visual: c * options.length + i })
      }
    }
    return list
  }, [looping, options])

  const scrollToVisual = useCallback(
    (visual: number, behavior: ScrollBehavior = 'smooth') => {
      const el = scrollerRef.current
      if (!el) return
      const step = itemHRef.current || DEFAULT_ITEM_H
      const top = visual * step
      suppressScrollRef.current = true
      window.clearTimeout(suppressTimerRef.current)
      if (behavior === 'auto') el.scrollTop = top
      else el.scrollTo({ top, behavior })
      suppressTimerRef.current = window.setTimeout(
        () => {
          if (behavior === 'auto' && Math.abs(el.scrollTop - top) > 1) {
            el.scrollTop = top
          }
          suppressScrollRef.current = false
        },
        behavior === 'auto' ? 80 : 160,
      )
    },
    [],
  )

  const scrollToLogical = useCallback(
    (logical: number, behavior: ScrollBehavior = 'smooth') => {
      const n = optionsRef.current.length
      if (n <= 0) return
      const i = mod(logical, n)
      const visual = loopingRef.current ? midBaseRef.current + i : i
      scrollToVisual(visual, behavior)
    },
    [scrollToVisual],
  )

  const syncScrollToValue = useCallback(() => {
    const root = rootRef.current
    const el = scrollerRef.current
    const n = optionsRef.current.length
    if (!el || n <= 0) return
    if (root) {
      const measured = readItemH(root)
      if (measured > 0) itemHRef.current = measured
    }
    const expected = loopingRef.current
      ? midBaseRef.current + mod(indexRef.current, n)
      : clamp(indexRef.current, 0, n - 1)
    // Her zaman hedef satıra kilitle (açılışta scrollTop=0 iken soluk/kesik görünmeyi önler)
    scrollToVisual(expected, 'auto')
  }, [scrollToVisual])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    function measure() {
      const h = root!.clientHeight
      const nextItemH = readItemH(root!)
      itemHRef.current = nextItemH
      setItemH(nextItemH)
      const visible = Math.max(3, Math.floor(h / nextItemH))
      const odd = visible % 2 === 0 ? visible - 1 : visible
      setPad(Math.max(1, Math.floor(odd / 2)))
      // Ölçüm sonrası seçili satırı ortala (açılışta kesik görünmeyi önler)
      syncScrollToValue()
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    return () => ro.disconnect()
  }, [syncScrollToValue])

  // Boyama öncesi hizala; sheet animasyonu sonrası bir kez daha sabitle
  useLayoutEffect(() => {
    syncScrollToValue()
  }, [index, options.length, pad, itemH, looping, syncScrollToValue])

  useEffect(() => {
    const t1 = window.setTimeout(syncScrollToValue, 40)
    const t2 = window.setTimeout(syncScrollToValue, 180)
    const t3 = window.setTimeout(syncScrollToValue, 320)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [index, options.length, pad, itemH, looping, syncScrollToValue])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let frame = 0
    let settleTimer = 0
    let wheelAcc = 0
    let wheelLock = false
    let wheelUnlockTimer = 0

    function visualFromScroll() {
      const step = itemHRef.current || DEFAULT_ITEM_H
      const n = optionsRef.current.length
      const maxVisual = loopingRef.current
        ? Math.max(0, LOOP_COPIES * n - 1)
        : Math.max(0, n - 1)
      return clamp(Math.round(el!.scrollTop / step), 0, maxVisual)
    }

    function logicalFromVisual(visual: number) {
      const n = optionsRef.current.length
      if (n <= 0) return 0
      return mod(visual, n)
    }

    function emitLogical(logical: number) {
      const val = optionsRef.current[logical]?.value
      if (val !== undefined) onChangeRef.current(val)
    }

    function selectLogical(logical: number, behavior: ScrollBehavior = 'smooth') {
      const n = optionsRef.current.length
      if (n <= 0) return
      const next = loopingRef.current
        ? mod(logical, n)
        : clamp(logical, 0, n - 1)
      emitLogical(next)
      scrollToLogical(next, behavior)
    }

    function onScroll() {
      if (suppressScrollRef.current) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (suppressScrollRef.current) return
        emitLogical(logicalFromVisual(visualFromScroll()))
      })
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        if (suppressScrollRef.current) return
        const visual = visualFromScroll()
        const logical = logicalFromVisual(visual)
        emitLogical(logical)
        if (loopingRef.current) {
          const n = optionsRef.current.length
          const copy = Math.floor(visual / n)
          if (copy <= 0 || copy >= LOOP_COPIES - 1) {
            // Kenar kopyadaysa ortadaki banda sessizce dön
            scrollToVisual(midBaseRef.current + logical, 'auto')
          } else {
            scrollToVisual(visual, 'smooth')
          }
        } else {
          scrollToLogical(logical, 'smooth')
        }
      }, 80)
    }

    /** Fare tekerleği / trackpad: her adımda tek seçenek (döngülü) */
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      e.stopPropagation()
      if (wheelLock) return

      wheelAcc += e.deltaY
      if (Math.abs(wheelAcc) < 8) return

      const dir = wheelAcc > 0 ? 1 : -1
      wheelAcc = 0
      wheelLock = true
      window.clearTimeout(wheelUnlockTimer)
      wheelUnlockTimer = window.setTimeout(() => {
        wheelLock = false
      }, 90)

      const n = optionsRef.current.length
      if (n <= 0) return
      if (loopingRef.current) {
        selectLogical(indexRef.current + dir, 'smooth')
      } else {
        selectLogical(
          clamp(indexRef.current + dir, 0, n - 1),
          'smooth',
        )
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      window.cancelAnimationFrame(frame)
      window.clearTimeout(settleTimer)
      window.clearTimeout(wheelUnlockTimer)
      window.clearTimeout(suppressTimerRef.current)
    }
  }, [scrollToLogical, scrollToVisual])

  const visualActive = looping ? midBase + index : index

  return (
    <div ref={rootRef} className="wheel-column">
      <div className="wheel-column-mask" aria-hidden />
      <div className="wheel-column-highlight" aria-hidden />
      <div
        ref={scrollerRef}
        className="wheel-column-scroller"
        data-no-swipe
      >
        <div style={{ height: pad * itemH }} aria-hidden />
        {renderOptions.map(({ opt, visual }) => {
          const dist = Math.abs(visual - visualActive)
          const scale = clamp(1 - dist * 0.12, 0.72, 1)
          const opacity = clamp(1 - dist * 0.28, 0.22, 1)
          const rotate = clamp(dist * 18, 0, 54)
          return (
            <button
              key={`${opt.value}-${visual}`}
              type="button"
              className={`wheel-item${visual === visualActive ? ' is-active' : ''}`}
              style={{
                transform: `translateZ(0) scale(${scale}) rotateX(${visual < visualActive ? rotate : -rotate}deg)`,
                opacity,
              }}
              onClick={() => {
                onChange(opt.value)
                if (looping) {
                  scrollToVisual(midBase + mod(visual, options.length), 'smooth')
                } else {
                  scrollToVisual(visual, 'smooth')
                }
              }}
            >
              {opt.label}
            </button>
          )
        })}
        <div style={{ height: pad * itemH }} aria-hidden />
      </div>
    </div>
  )
}

export function WheelPickerShell({
  open,
  title,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean
  title: string
  onCancel: () => void
  onConfirm: () => void
  children: ReactNode
}) {
  const uid = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="wheel-sheet-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="wheel-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wheel-sheet-header">
          <button
            type="button"
            className="btn ghost btn-compact"
            onClick={onCancel}
          >
            İptal
          </button>
          <strong id={`${uid}-title`}>{title}</strong>
          <button
            type="button"
            className="btn primary btn-compact"
            onClick={onConfirm}
          >
            Tamam
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function WheelSelectTrigger({
  label,
  placeholder,
  disabled,
  open,
  onOpen,
  required,
  value,
}: {
  label: string
  placeholder?: string
  disabled?: boolean
  open: boolean
  onOpen: () => void
  required?: boolean
  value: string
}) {
  const empty = !value
  return (
    <>
      <button
        type="button"
        className={`wheel-select-trigger${disabled ? ' is-disabled' : ''}${empty ? ' is-placeholder' : ''}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) onOpen()
        }}
      >
        <span>{empty ? placeholder || 'Seç…' : label}</span>
        <span className="wheel-select-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          className="wheel-select-required"
          value={value}
          onChange={() => undefined}
          required
        />
      )}
    </>
  )
}

export function WheelSelect({
  value,
  onChange,
  options,
  placeholder = 'Seç…',
  required = false,
  disabled = false,
  title,
}: {
  value: string
  onChange: (value: string) => void
  options: WheelOption[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  /** Sheet başlığı */
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value)
    if (hit) return hit.label
    if (!value) return placeholder
    return value
  }, [options, placeholder, value])

  useEffect(() => {
    if (open) setDraft(value || options[0]?.value || '')
  }, [open, options, value])

  return (
    <>
      <WheelSelectTrigger
        label={selectedLabel}
        placeholder={placeholder}
        disabled={disabled}
        open={open}
        onOpen={() => setOpen(true)}
        required={required}
        value={value}
      />
      <WheelPickerShell
        open={open}
        title={title || 'Seç'}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onChange(draft)
          setOpen(false)
        }}
      >
        {options.length === 0 ? (
          <p className="muted small wheel-sheet-empty">Seçenek yok.</p>
        ) : (
          <WheelColumn options={options} value={draft} onChange={setDraft} />
        )}
      </WheelPickerShell>
    </>
  )
}
