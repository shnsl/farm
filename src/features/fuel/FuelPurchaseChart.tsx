import { useMemo } from 'react'
import type { FuelEvent } from '../../types'

export interface FuelPurchasePoint {
  id: string
  label: string
  doneAt: string
  liters: number
  unitPrice: number
  totalCost: number
  source?: string
}

export function purchasesForChart(events: FuelEvent[]): FuelPurchasePoint[] {
  return events
    .filter((e) => e.kind === 'purchase')
    .map((e) => ({
      id: e.id,
      doneAt: e.doneAt,
      label: e.doneAt.slice(0, 10),
      liters: e.liters,
      unitPrice: e.unitPrice ?? 0,
      totalCost: e.totalCost ?? 0,
      source: e.source,
    }))
    .sort((a, b) => a.doneAt.localeCompare(b.doneAt))
}

function formatNum(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function shortLabel(date: string): string {
  // YYYY-MM-DD → DD.MM
  if (date.length >= 10) {
    return `${date.slice(8, 10)}.${date.slice(5, 7)}`
  }
  return date
}

export function FuelPurchaseChart({ events }: { events: FuelEvent[] }) {
  const points = useMemo(() => purchasesForChart(events), [events])

  if (points.length === 0) {
    return <p className="muted small">Grafik için yakıt alımı yok.</p>
  }

  const maxLiters = Math.max(...points.map((p) => p.liters), 1)
  const maxPrice = Math.max(...points.map((p) => p.unitPrice), 1)
  const chartW = Math.max(320, points.length * 72)
  const chartH = 220
  const padL = 36
  const padR = 12
  const padT = 16
  const padB = 40
  const plotW = chartW - padL - padR
  const plotH = chartH - padT - padB
  const groupW = plotW / points.length
  const barW = Math.min(18, groupW * 0.3)

  return (
    <div className="harvest-chart">
      <p className="muted small harvest-chart-legend">
        <span className="legend-swatch legend-fuel-liters" /> Miktar (lt)
        <span className="legend-swatch legend-fuel-price" /> Birim fiyat (₺/lt)
      </p>
      <div className="harvest-chart-scroll">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          width={chartW}
          height={chartH}
          role="img"
          aria-label="Alım tarihine göre yakıt miktar ve fiyat karşılaştırması"
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
          {points.map((p, i) => {
            const cx = padL + groupW * i + groupW / 2
            const litersH = (p.liters / maxLiters) * plotH
            const priceH = (p.unitPrice / maxPrice) * plotH
            return (
              <g key={p.id}>
                <rect
                  className="chart-bar chart-bar-fuel-liters"
                  x={cx - barW - 2}
                  y={padT + plotH - litersH}
                  width={barW}
                  height={Math.max(litersH, p.liters > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {p.label}: {formatNum(p.liters)} lt
                  </title>
                </rect>
                <rect
                  className="chart-bar chart-bar-fuel-price"
                  x={cx + 2}
                  y={padT + plotH - priceH}
                  width={barW}
                  height={Math.max(priceH, p.unitPrice > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {p.label}: {formatNum(p.unitPrice)} ₺/lt
                  </title>
                </rect>
                <text
                  x={cx}
                  y={chartH - 14}
                  textAnchor="middle"
                  className="chart-label"
                >
                  {shortLabel(p.label)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="harvest-chart-summary">
        {points.map((p) => (
          <li key={p.id}>
            <strong>{p.label}</strong>
            <span>{formatNum(p.liters)} lt</span>
            <span>{formatNum(p.unitPrice)} ₺/lt</span>
            <span>{formatNum(p.totalCost)} toplam</span>
            <span>{p.source || '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
