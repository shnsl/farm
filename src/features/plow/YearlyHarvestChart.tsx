import { useMemo } from 'react'
import { harvestProductValue } from './api'
import type { HarvestEvent } from '../../types'

export interface YearHarvestStat {
  year: string
  estimatedKg: number
  totalPaid: number
  productValue: number
  avgPricePerKg: number
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
      productValue: 0,
      avgPricePerKg: 0,
      workerCount: 0,
      count: 0,
    }
    current.estimatedKg += h.estimatedKg ?? 0
    current.totalPaid += h.totalPaid
    current.productValue += harvestProductValue(h)
    current.workerCount += h.workerCount
    current.count += 1
    map.set(year, current)
  }
  return [...map.values()]
    .map((s) => ({
      ...s,
      avgPricePerKg:
        s.estimatedKg > 0
          ? Number((s.productValue / s.estimatedKg).toFixed(2))
          : 0,
    }))
    .sort((a, b) => a.year.localeCompare(b.year))
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
  const maxValue = Math.max(...stats.map((s) => s.productValue), 1)
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
  const barW = Math.min(16, groupW * 0.22)

  return (
    <div className="harvest-chart">
      <p className="muted small harvest-chart-legend">
        <span className="legend-swatch legend-kg" /> Tahmini kg
        <span className="legend-swatch legend-value" /> Ürün tutarı
        <span className="legend-swatch legend-paid" /> İşçi ödemesi
      </p>
      <div className="harvest-chart-scroll">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          width={chartW}
          height={chartH}
          role="img"
          aria-label="Yıllara göre Hasat istatistikleri"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + plotH * (1 - t)
            return (
              <line
                key={t}
                x1={padL}
                x2={chartW - padR}
                y1={y}
                y2={y}
                className="chart-grid"
              />
            )
          })}
          {stats.map((s, i) => {
            const cx = padL + groupW * i + groupW / 2
            const kgH = (s.estimatedKg / maxKg) * plotH
            const valueH = (s.productValue / maxValue) * plotH
            const paidH = (s.totalPaid / maxPaid) * plotH
            return (
              <g key={s.year}>
                <rect
                  className="chart-bar chart-bar-kg"
                  x={cx - barW * 1.5 - 3}
                  y={padT + plotH - kgH}
                  width={barW}
                  height={Math.max(kgH, s.estimatedKg > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {s.year}: {formatNum(s.estimatedKg)} kg
                  </title>
                </rect>
                <rect
                  className="chart-bar chart-bar-value"
                  x={cx - barW / 2}
                  y={padT + plotH - valueH}
                  width={barW}
                  height={Math.max(valueH, s.productValue > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {s.year}: {formatNum(s.productValue)} ürün tutarı
                  </title>
                </rect>
                <rect
                  className="chart-bar chart-bar-paid"
                  x={cx + barW / 2 + 3}
                  y={padT + plotH - paidH}
                  width={barW}
                  height={Math.max(paidH, s.totalPaid > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {s.year}: {formatNum(s.totalPaid)} işçi ödemesi
                  </title>
                </rect>
                <text
                  x={cx}
                  y={chartH - 12}
                  textAnchor="middle"
                  className="chart-label"
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
            <span>
              {formatNum(s.avgPricePerKg)} ₺/kg · {formatNum(s.productValue)}{' '}
              ürün
            </span>
            <span>{formatNum(s.totalPaid)} ödeme</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
