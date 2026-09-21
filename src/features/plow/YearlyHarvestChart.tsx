import { useMemo } from 'react'
import type { HarvestEvent } from '../../types'

export interface YearHarvestStat {
  year: string
  estimatedKg: number
  totalPaid: number
  workerCount: number
  count: number
}

export function aggregateHarvestByYear(
  harvests: HarvestEvent[],
): YearHarvestStat[] {
  const map = new Map<string, YearHarvestStat>()
  for (const h of harvests) {
    const year = h.doneAt.slice(0, 4)
    if (!year) continue
    const current = map.get(year) ?? {
      year,
      estimatedKg: 0,
      totalPaid: 0,
      workerCount: 0,
      count: 0,
    }
    current.estimatedKg += h.estimatedKg ?? 0
    current.totalPaid += h.totalPaid
    current.workerCount += h.workerCount
    current.count += 1
    map.set(year, current)
  }
  return [...map.values()].sort((a, b) => a.year.localeCompare(b.year))
}

function formatNum(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
}

export function YearlyHarvestChart({ harvests }: { harvests: HarvestEvent[] }) {
  const stats = useMemo(() => aggregateHarvestByYear(harvests), [harvests])

  if (stats.length === 0) {
    return <p className="muted small">Grafik için Hasat kaydı yok.</p>
  }

  const maxKg = Math.max(...stats.map((s) => s.estimatedKg), 1)
  const maxPaid = Math.max(...stats.map((s) => s.totalPaid), 1)
  const chartW = Math.max(360, stats.length * 88)
  const chartH = 220
  const padL = 36
  const padR = 12
  const padT = 16
  const padB = 36
  const plotW = chartW - padL - padR
  const plotH = chartH - padT - padB
  const groupW = plotW / stats.length
  const barW = Math.min(22, groupW * 0.32)

  return (
    <div className="harvest-chart">
      <p className="muted small harvest-chart-legend">
        <span className="legend-swatch legend-kg" /> Tahmini kg
        <span className="legend-swatch legend-paid" /> İşçi ödemesi
      </p>
      <div className="harvest-chart-scroll">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          width={chartW}
          height={chartH}
          role="img"
          aria-label="Yıllara göre hasat"
        >
          {stats.map((s, i) => {
            const cx = padL + groupW * i + groupW / 2
            const kgH = (s.estimatedKg / maxKg) * plotH
            const paidH = (s.totalPaid / maxPaid) * plotH
            return (
              <g key={s.year}>
                <rect
                  className="harvest-bar-kg"
                  x={cx - barW - 2}
                  y={padT + plotH - kgH}
                  width={barW}
                  height={Math.max(kgH, s.estimatedKg > 0 ? 2 : 0)}
                >
                  <title>
                    {s.year}: {formatNum(s.estimatedKg)} kg
                  </title>
                </rect>
                <rect
                  className="harvest-bar-paid"
                  x={cx + 2}
                  y={padT + plotH - paidH}
                  width={barW}
                  height={Math.max(paidH, s.totalPaid > 0 ? 2 : 0)}
                >
                  <title>
                    {s.year}: {formatNum(s.totalPaid)} ödeme
                  </title>
                </rect>
                <text
                  x={cx}
                  y={chartH - 12}
                  textAnchor="middle"
                  className="harvest-chart-label"
                >
                  {s.year}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="harvest-chart-summary">
        {stats.map((s) => (
          <li key={s.year}>
            <strong>{s.year}</strong>
            <span>{formatNum(s.estimatedKg)} kg</span>
            <span>{formatNum(s.totalPaid)} ödeme</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
