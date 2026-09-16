import { useMemo } from 'react'
import type { FertilizeEvent } from '../../types'

export interface YearFertilizeStat {
  year: string
  cost: number
  count: number
  types: string[]
}

export function aggregateFertilizeByYear(
  events: FertilizeEvent[],
): YearFertilizeStat[] {
  const map = new Map<string, YearFertilizeStat & { typeSet: Set<string> }>()
  for (const e of events) {
    const year = e.doneAt.slice(0, 4)
    if (!year) continue
    const current = map.get(year) ?? {
      year,
      cost: 0,
      count: 0,
      types: [],
      typeSet: new Set<string>(),
    }
    current.cost += e.cost
    current.count += 1
    if (e.fertilizerType.trim()) current.typeSet.add(e.fertilizerType.trim())
    map.set(year, current)
  }
  return [...map.values()]
    .map(({ typeSet, ...rest }) => ({
      ...rest,
      types: [...typeSet],
    }))
    .sort((a, b) => a.year.localeCompare(b.year))
}

function formatNum(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
}

export function YearlyFertilizeChart({
  events,
}: {
  events: FertilizeEvent[]
}) {
  const stats = useMemo(() => aggregateFertilizeByYear(events), [events])

  if (stats.length === 0) {
    return <p className="muted small">Grafik için Gübreleme kaydı yok.</p>
  }

  const maxCost = Math.max(...stats.map((s) => s.cost), 1)
  const maxCount = Math.max(...stats.map((s) => s.count), 1)
  const chartW = Math.max(320, stats.length * 80)
  const chartH = 220
  const padL = 36
  const padR = 12
  const padT = 16
  const padB = 36
  const plotW = chartW - padL - padR
  const plotH = chartH - padT - padB
  const groupW = plotW / stats.length
  const barW = Math.min(20, groupW * 0.3)

  return (
    <div className="harvest-chart">
      <p className="muted small harvest-chart-legend">
        <span className="legend-swatch legend-fert-cost" /> Toplam masraf
        <span className="legend-swatch legend-fert-count" /> Gübreleme sayısı
      </p>
      <div className="harvest-chart-scroll">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          width={chartW}
          height={chartH}
          role="img"
          aria-label="Yıllara göre Gübreleme kıyası"
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
            const costH = (s.cost / maxCost) * plotH
            const countH = (s.count / maxCount) * plotH
            return (
              <g key={s.year}>
                <rect
                  className="chart-bar chart-bar-fert-cost"
                  x={cx - barW - 2}
                  y={padT + plotH - costH}
                  width={barW}
                  height={Math.max(costH, s.cost > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {s.year}: {formatNum(s.cost)} masraf
                  </title>
                </rect>
                <rect
                  className="chart-bar chart-bar-fert-count"
                  x={cx + 2}
                  y={padT + plotH - countH}
                  width={barW}
                  height={Math.max(countH, s.count > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {s.year}: {s.count} gübreleme
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
            <span>{formatNum(s.cost)} masraf</span>
            <span>{s.count} kayıt</span>
            <span>{s.types.join(', ') || '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
