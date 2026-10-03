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
  const touchActiveRef = useRef(false)
  const interactingRef = useRef(false)
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
  /** Görsel vurgu: kaydırırken parent’a yazmadan güncellenir */
  const [paintIndex, setPaintIndex] = useState(index)
  const paintIndexRef = useRef(paintIndex)
  paintIndexRef.current = paintIndex

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
          if (Math.abs(el.scrollTop - top) > 1) {
            el.scrollTop = top
          }
          suppressScrollRef.current = false
        },
        behavior === 'auto' ? 60 : 180,
      )
    },
    [],
  )

  const expectedVisual = useCallback((logical: number) => {
    const n = optionsRef.current.length
    if (n <= 0) return 0
    const i = mod(logical, n)
    return loopingRef.current ? midBaseRef.current + i : i
  }, [])

  /** Programatik hizalama — kullanıcı dokunurken çağrılmaz */
  const syncScrollToValue = useCallback(
    (force = false) => {
      if (!force && (touchActiveRef.current || interactingRef.current)) return
      const root = rootRef.current
      const el = scrollerRef.current
      const n = optionsRef.current.length
      if (!el || n <= 0) return
      if (root) {
        const measured = readItemH(root)
        if (measured > 0) itemHRef.current = measured
      }
      const logical = mod(indexRef.current, n)
      const target = expectedVisual(logical)
      const step = itemHRef.current || DEFAULT_ITEM_H
      const visual = Math.round(el.scrollTop / step)
      // Zaten doğru değerde ve orta banttaysa dokunma
      if (loopingRef.current) {
        const copy = Math.floor(visual / n)
        if (
          mod(visual, n) === logical &&
          copy > 0 &&
          copy < LOOP_COPIES - 1 &&
          Math.abs(el.scrollTop - visual * step) < 2
        ) {
          setPaintIndex(logical)
          return
        }
      } else if (visual === logical && Math.abs(el.scrollTop - target * step) < 2) {
        setPaintIndex(logical)
        return
      }
      setPaintIndex(logical)
      scrollToVisual(target, 'auto')
    },
    [expectedVisual, scrollToVisual],
  )

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
    }
    measure()
    const ro = new ResizeObserver(() => {
      measure()
      syncScrollToValue(true)
    })
    ro.observe(root)
    return () => ro.disconnect()
  }, [syncScrollToValue])

  // Dışarıdan value / seçenek değişince hizala (kullanıcı kaydırmıyorsa)
  useLayoutEffect(() => {
    setPaintIndex(index)
    syncScrollToValue()
  }, [index, options.length, pad, itemH, looping, syncScrollToValue])

  // Açılış animasyonu sonrası bir kez sabitle
  useEffect(() => {
    const t1 = window.setTimeout(() => syncScrollToValue(true), 50)
    const t2 = window.setTimeout(() => syncScrollToValue(true), 280)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [options.length, looping, syncScrollToValue])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let frame = 0
    let settleTimer = 0
    let idleRaf = 0
    let wheelAcc = 0
    let wheelLock = false
    let wheelUnlockTimer = 0
    /** px/ms — scrollTop artış yönü pozitif */
    let releaseVelocity = 0
    let sampleScroll = el.scrollTop
    let sampleTime = 0
    let liveVelocity = 0

    function maxVisual() {
      const n = optionsRef.current.length
      return loopingRef.current
        ? Math.max(0, LOOP_COPIES * n - 1)
        : Math.max(0, n - 1)
    }

    function visualFromScroll() {
      const step = itemHRef.current || DEFAULT_ITEM_H
      return clamp(Math.round(el!.scrollTop / step), 0, maxVisual())
    }

    /** Bırakış hızına göre hedef satır (hızlı fırlatmada yönü tercih eder) */
    function targetVisualFromVelocity(velPxPerMs: number) {
      const step = itemHRef.current || DEFAULT_ITEM_H
      const raw = el!.scrollTop / step
      const abs = Math.abs(velPxPerMs)
      // ~80–180ms coast tahmini; hızlıysa daha uzağa projekte et
      const coastMs = abs > 0.8 ? 180 : abs > 0.35 ? 130 : 0
      const projected = raw + (velPxPerMs * coastMs) / step
      if (abs > 0.35) {
        // Yönlü yuvarlama: arada kalmayı azalt
        const biased =
          velPxPerMs > 0 ? Math.ceil(projected - 0.15) : Math.floor(projected + 0.15)
        return clamp(biased, 0, maxVisual())
      }
      return clamp(Math.round(projected), 0, maxVisual())
    }

    function logicalFromVisual(visual: number) {
      const n = optionsRef.current.length
      if (n <= 0) return 0
      return mod(visual, n)
    }

    function commitLogical(logical: number) {
      const val = optionsRef.current[logical]?.value
      if (val !== undefined && val !== optionsRef.current[indexRef.current]?.value) {
        onChangeRef.current(val)
      }
      indexRef.current = logical
      setPaintIndex(logical)
    }

    /** Native momentum’u kesip satıra kilitle */
    function snapHard(visual: number) {
      const step = itemHRef.current || DEFAULT_ITEM_H
      const top = visual * step
      suppressScrollRef.current = true
      window.clearTimeout(suppressTimerRef.current)
      const prevOverflow = el!.style.overflow
      el!.style.overflow = 'hidden'
      el!.scrollTop = top
      // Bir frame sonra overflow geri — momentum ölür
      window.requestAnimationFrame(() => {
        el!.style.overflow = prevOverflow
        el!.scrollTop = top
        suppressTimerRef.current = window.setTimeout(() => {
          if (Math.abs(el!.scrollTop - top) > 1) el!.scrollTop = top
          suppressScrollRef.current = false
        }, 48)
      })
    }

    function settle(vel = releaseVelocity) {
      if (suppressScrollRef.current || touchActiveRef.current) return
      const n = optionsRef.current.length
      if (n <= 0) return
      const visual = targetVisualFromVelocity(vel)
      const logical = logicalFromVisual(visual)
      commitLogical(logical)
      releaseVelocity = 0

      if (loopingRef.current) {
        const copy = Math.floor(visual / n)
        if (copy <= 0 || copy >= LOOP_COPIES - 1) {
          snapHard(midBaseRef.current + logical)
        } else {
          snapHard(visual)
        }
      } else {
        snapHard(logical)
      }
      interactingRef.current = false
    }

    function cancelIdleWatch() {
      window.clearTimeout(settleTimer)
      window.cancelAnimationFrame(idleRaf)
    }

    /** Momentum bitene kadar bekle, sonra hız yönlü fokus */
    function waitIdleThenSettle() {
      cancelIdleWatch()
      let lastTop = el!.scrollTop
      let stableFrames = 0
      const started = performance.now()

      function tick() {
        if (touchActiveRef.current) return
        const now = performance.now()
        const top = el!.scrollTop
        const dt = Math.max(1, now - sampleTime)
        if (sampleTime > 0) {
          liveVelocity = (top - sampleScroll) / dt
        }
        sampleScroll = top
        sampleTime = now

        if (Math.abs(top - lastTop) < 0.6) {
          stableFrames += 1
        } else {
          stableFrames = 0
          lastTop = top
        }

        // Duruldu veya uzun sürdü — odakla
        if (stableFrames >= 3 || now - started > 420) {
          settle(Math.abs(releaseVelocity) > 0.12 ? releaseVelocity : liveVelocity)
          return
        }
        idleRaf = window.requestAnimationFrame(tick)
      }

      // Momentum’un başlaması için kısa gecikme
      settleTimer = window.setTimeout(() => {
        lastTop = el!.scrollTop
        sampleScroll = lastTop
        sampleTime = performance.now()
        idleRaf = window.requestAnimationFrame(tick)
      }, 32)
    }

    function onScroll() {
      if (suppressScrollRef.current) return
      interactingRef.current = true
      const now = performance.now()
      if (sampleTime > 0) {
        const dt = Math.max(1, now - sampleTime)
        liveVelocity = (el!.scrollTop - sampleScroll) / dt
      }
      sampleScroll = el!.scrollTop
      sampleTime = now

      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (suppressScrollRef.current) return
        const logical = logicalFromVisual(visualFromScroll())
        if (logical !== paintIndexRef.current) setPaintIndex(logical)
      })
      // Dokunma yoksa (momentum / trackpad): idle sonrası snap
      if (!touchActiveRef.current) waitIdleThenSettle()
    }

    function onTouchStart() {
      touchActiveRef.current = true
      interactingRef.current = true
      cancelIdleWatch()
      releaseVelocity = 0
      liveVelocity = 0
      sampleScroll = el!.scrollTop
      sampleTime = performance.now()
    }

    function onTouchMove() {
      const now = performance.now()
      const top = el!.scrollTop
      if (sampleTime > 0) {
        const dt = Math.max(1, now - sampleTime)
        liveVelocity = (top - sampleScroll) / dt
      }
      sampleScroll = top
      sampleTime = now
    }

    function onTouchEnd() {
      releaseVelocity = liveVelocity
      touchActiveRef.current = false
      waitIdleThenSettle()
    }

    /** Fare tekerleği / trackpad: her adımda tek seçenek */
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
      const next = loopingRef.current
        ? mod(indexRef.current + dir, n)
        : clamp(indexRef.current + dir, 0, n - 1)
      commitLogical(next)
      scrollToVisual(expectedVisual(next), 'smooth')
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(idleRaf)
      window.clearTimeout(settleTimer)
      window.clearTimeout(wheelUnlockTimer)
      window.clearTimeout(suppressTimerRef.current)
    }
  }, [expectedVisual, scrollToVisual])

  const visualActive = looping ? midBase + paintIndex : paintIndex

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
          const active = visual === visualActive
          return (
            <div
              key={`${opt.value}-${visual}`}
              role="option"
              aria-selected={active}
              className={`wheel-item${active ? ' is-active' : ''}`}
              style={{
                transform: `translateZ(0) scale(${scale}) rotateX(${visual < visualActive ? rotate : -rotate}deg)`,
                opacity,
              }}
              onClick={() => {
                if (touchActiveRef.current) return
                const logical = looping
                  ? mod(visual, options.length)
                  : visual
                onChange(opt.value)
                indexRef.current = logical
                setPaintIndex(logical)
                scrollToVisual(expectedVisual(logical), 'smooth')
              }}
            >
              {opt.label}
            </div>
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
    // Arka plan kaymasını kilitle
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
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
