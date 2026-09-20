import { useEffect, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  format?: (n: number) => string
  /** ms — varsayılan hızlı yükseliş */
  duration?: number
  className?: string
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Hedef değere 1’den (veya 0 ise 0’dan) hızlı yükselerek sayar.
 */
export function AnimatedNumber({
  value,
  format = (n) =>
    n.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
  duration = 1700,
  className,
}: AnimatedNumberProps) {
  const startFrom = value <= 0 ? 0 : Math.min(1, value)
  const [display, setDisplay] = useState(startFrom)

  useEffect(() => {
    if (value <= 0) {
      setDisplay(0)
      return
    }

    const from = Math.min(1, value)
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const next = from + (value - from) * easeOutCubic(t)
      setDisplay(t >= 1 ? value : next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    setDisplay(from)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return (
    <span className={className} aria-label={format(value)}>
      {format(display)}
    </span>
  )
}
