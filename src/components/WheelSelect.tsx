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
const LOOP_COPIES = 3

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

/** Görsel satırı viewport ortasına getiren scrollTop (transform’dan bağımsız) */
function scrollTopForVisual(
  scroller: HTMLElement,
  visual: number,
  fallbackStep: number,
) {
  const items = scroller.querySelectorAll<HTMLElement>('.wheel-item')
  const target = items[visual]
  if (target) {
    return Math.round(
      target.offsetTop - (scroller.clientHeight - target.offsetHeight) / 2,
    )
  }
  return Math.round(visual * fallbackStep)
}

/** Viewport ortasına en yakın satır indeksi */
function nearestVisual(scroller: HTMLElement, fallbackStep: number, maxVis: number) {
  const items = scroller.querySelectorAll<HTMLElement>('.wheel-item')
  if (items.length === 0) {
    return clamp(Math.round(scroller.scrollTop / fallbackStep), 0, maxVis)
  }
  const viewCenter = scroller.scrollTop + scroller.clientHeight / 2
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!
    const center = item.offsetTop + item.offsetHeight / 2
    const d = Math.abs(center - viewCenter)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return clamp(best, 0, maxVis)
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
  /** Mantıksal seçim (0..n-1) */
  const [paintIndex, setPaintIndex] = useState(index)
  const paintIndexRef = useRef(paintIndex)
  paintIndexRef.current = paintIndex
  /**
   * Gerçek kaydırılan satır indeksi (kopya dahil).
   * midBase+logical kullanılırsa 2./3. listede aktif stil yanlış satıra biner
   * ve ara değerde kalmış gibi görünür.
   */
  const [paintVisual, setPaintVisual] = useState(() =>
    looping ? midBase + index : index,
  )
  const paintVisualRef = useRef(paintVisual)
  paintVisualRef.current = paintVisual

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
      const top = scrollTopForVisual(el, visual, step)
      suppressScrollRef.current = true
      window.clearTimeout(suppressTimerRef.current)
      if (behavior === 'auto') el.scrollTop = top
      else el.scrollTo({ top, behavior })
      suppressTimerRef.current = window.setTimeout(
        () => {
          const again = scrollTopForVisual(el, visual, step)
          if (Math.abs(el.scrollTop - again) > 0.5) el.scrollTop = again
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
      const ideal = scrollTopForVisual(el, target, step)
      setPaintIndex(logical)
      setPaintVisual(target)
      if (Math.abs(el.scrollTop - ideal) < 1.5) return
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
    setPaintVisual(looping ? midBase + index : index)
    syncScrollToValue()
  }, [index, options.length, pad, itemH, looping, midBase, syncScrollToValue])

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
    let correctRaf = 0
    let wheelAcc = 0
    let wheelLock = false
    let wheelUnlockTimer = 0
    /** px/ms — scrollTop artış yönü pozitif */
    let releaseVelocity = 0
    let liveVelocity = 0
    /** Dokunmayı elle yönet — native momentum arada bırakmasın */
    let dragging = false
    let dragStartY = 0
    let dragStartScroll = 0
    let lastTouchY = 0
    let lastTouchT = 0
    let velSamples: number[] = []

    function maxVisual() {
      const n = optionsRef.current.length
      return loopingRef.current
        ? Math.max(0, LOOP_COPIES * n - 1)
        : Math.max(0, n - 1)
    }

    function visualFromScroll() {
      const step = itemHRef.current || DEFAULT_ITEM_H
      return nearestVisual(el!, step, maxVisual())
    }

    /** Bırakış: en yakın satır + hafif hız ofseti (tam satır adımı) */
    function targetVisualFromVelocity(velPxPerMs: number) {
      const step = itemHRef.current || DEFAULT_ITEM_H
      let visual = nearestVisual(el!, step, maxVisual())
      const abs = Math.abs(velPxPerMs)
      if (abs > 0.35) {
        const extra = Math.round(
          (velPxPerMs * (abs > 1 ? 140 : 90)) / step,
        )
        visual = clamp(visual + extra, 0, maxVisual())
      }
      return visual
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

    function paintFromScroll() {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (suppressScrollRef.current && !dragging) return
        const visual = visualFromScroll()
        const logical = logicalFromVisual(visual)
        if (logical !== paintIndexRef.current) setPaintIndex(logical)
        if (visual !== paintVisualRef.current) setPaintVisual(visual)
      })
    }

    /** Momentum’u öldürüp satırı ortala; birkaç kare geometrik düzelt */
    function snapHard(visual: number) {
      const root = rootRef.current
      if (root) {
        const measured = readItemH(root)
        if (measured > 0) itemHRef.current = measured
      }
      const step = itemHRef.current || DEFAULT_ITEM_H
      suppressScrollRef.current = true
      window.clearTimeout(suppressTimerRef.current)
      window.cancelAnimationFrame(correctRaf)

      el!.style.overflowY = 'hidden'
      const apply = () => {
        el!.scrollTop = scrollTopForVisual(el!, visual, step)
      }
      apply()

      let frames = 0
      const maxFrames = 16
      function correct() {
        apply()
        frames += 1
        if (frames < maxFrames) {
          correctRaf = window.requestAnimationFrame(correct)
          return
        }
        apply()
        // overflow kapalı kalsın — ara değere kaymayı engeller
        suppressTimerRef.current = window.setTimeout(() => {
          apply()
          el!.style.overflowY = ''
          // Son kontrol: hâlâ ofset varsa tekrar kilitle
          const ideal = scrollTopForVisual(el!, visual, step)
          if (Math.abs(el!.scrollTop - ideal) > 0.5) {
            el!.style.overflowY = 'hidden'
            el!.scrollTop = ideal
            window.setTimeout(() => {
              el!.scrollTop = ideal
              el!.style.overflowY = ''
              suppressScrollRef.current = false
              interactingRef.current = false
            }, 40)
            return
          }
          suppressScrollRef.current = false
          interactingRef.current = false
        }, 100)
      }
      correctRaf = window.requestAnimationFrame(correct)
    }

    function settle(vel = releaseVelocity) {
      if (touchActiveRef.current) return
      const n = optionsRef.current.length
      if (n <= 0) return
      // Önce hangi satırda olduğumuzu bul, sonra sonsuz döngü için orta kopyaya kilitle
      const approx = targetVisualFromVelocity(vel)
      const logical = logicalFromVisual(approx)
      const visual = loopingRef.current
        ? midBaseRef.current + logical
        : approx
      releaseVelocity = 0
      setPaintVisual(visual)
      snapHard(visual)
      commitLogical(logical)
    }

    function cancelIdleWatch() {
      window.clearTimeout(settleTimer)
      window.cancelAnimationFrame(idleRaf)
    }

    /** Masaüstü trackpad / native scroll sonrası */
    function waitIdleThenSettle() {
      if (dragging) return
      cancelIdleWatch()
      let lastTop = el!.scrollTop
      let stableFrames = 0
      const started = performance.now()

      function tick() {
        if (touchActiveRef.current || dragging) return
        const now = performance.now()
        const top = el!.scrollTop
        if (Math.abs(top - lastTop) < 0.5) stableFrames += 1
        else {
          stableFrames = 0
          lastTop = top
        }
        if (stableFrames >= 4 || now - started > 500) {
          settle(0)
          return
        }
        idleRaf = window.requestAnimationFrame(tick)
      }

      settleTimer = window.setTimeout(() => {
        lastTop = el!.scrollTop
        idleRaf = window.requestAnimationFrame(tick)
      }, 48)
    }

    function onScroll() {
      if (suppressScrollRef.current || dragging) return
      interactingRef.current = true
      paintFromScroll()
      if (!touchActiveRef.current) waitIdleThenSettle()
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const t = e.touches[0]!
      touchActiveRef.current = true
      interactingRef.current = true
      dragging = true
      cancelIdleWatch()
      window.cancelAnimationFrame(correctRaf)
      window.clearTimeout(suppressTimerRef.current)
      suppressScrollRef.current = false
      el!.style.overflowY = 'hidden'

      dragStartY = t.clientY
      dragStartScroll = el!.scrollTop
      lastTouchY = t.clientY
      lastTouchT = performance.now()
      liveVelocity = 0
      releaseVelocity = 0
      velSamples = []
    }

    function onTouchMove(e: TouchEvent) {
      if (!dragging || e.touches.length !== 1) return
      e.preventDefault()
      const t = e.touches[0]!
      const now = performance.now()
      const y = t.clientY
      const dt = Math.max(1, now - lastTouchT)
      const instant = (lastTouchY - y) / dt
      velSamples.push(instant)
      if (velSamples.length > 5) velSamples.shift()
      liveVelocity =
        velSamples.reduce((a, b) => a + b, 0) / velSamples.length
      lastTouchY = y
      lastTouchT = now

      const step = itemHRef.current || DEFAULT_ITEM_H
      const maxTop = scrollTopForVisual(el!, maxVisual(), step)
      el!.scrollTop = clamp(dragStartScroll + (dragStartY - y), 0, Math.max(0, maxTop))
      paintFromScroll()
    }

    function onTouchEnd() {
      if (!dragging) {
        touchActiveRef.current = false
        return
      }
      dragging = false
      releaseVelocity = liveVelocity
      touchActiveRef.current = false
      // Native momentum yok — hemen hız yönlü fokus
      settle(releaseVelocity)
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
      const target = expectedVisual(next)
      setPaintVisual(target)
      scrollToVisual(target, 'smooth')
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
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
      window.cancelAnimationFrame(correctRaf)
      window.clearTimeout(settleTimer)
      window.clearTimeout(wheelUnlockTimer)
      window.clearTimeout(suppressTimerRef.current)
      el.style.overflowY = ''
    }
  }, [expectedVisual, scrollToVisual])

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
          const dist = Math.abs(visual - paintVisual)
          const scale = clamp(1 - dist * 0.12, 0.72, 1)
          const opacity = clamp(1 - dist * 0.28, 0.22, 1)
          const rotate = clamp(dist * 18, 0, 54)
          const active = visual === paintVisual
          return (
            <div
              key={`${opt.value}-${visual}`}
              role="option"
              aria-selected={active}
              className={`wheel-item${active ? ' is-active' : ''}`}
              style={{
                transform: `translateZ(0) scale(${scale}) rotateX(${visual < paintVisual ? rotate : -rotate}deg)`,
                opacity,
              }}
              onClick={() => {
                if (touchActiveRef.current) return
                const logical = looping
                  ? mod(visual, options.length)
                  : visual
                const target = expectedVisual(logical)
                onChange(opt.value)
                indexRef.current = logical
                setPaintIndex(logical)
                setPaintVisual(target)
                scrollToVisual(target, 'smooth')
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
