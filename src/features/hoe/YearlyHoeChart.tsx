import { useMemo } from 'react'
import type { HoeEvent } from '../../types'

export interface YearHoeStat {
  year: string
  avgDailyWage: number
  totalPaid: number
  workerDays: number
  count: number
}

export function aggregateHoeByYear(events: HoeEvent[]): YearHoeStat[] {
  const map = new Map<
    string,
    {
      year: string
      wageSum: number
      totalPaid: number
      workerDays: number
      count: number
    }
  >()

  for (const e of events) {
    const year = e.doneAt.slice(0, 4)
    if (!year) continue
    const current = map.get(year) ?? {
      year,
      wageSum: 0,
      totalPaid: 0,
      workerDays: 0,
      count: 0,
    }
    current.wageSum += e.dailyWage
    current.totalPaid += e.totalPaid
    current.workerDays += e.workerCount
    current.count += 1
    map.set(year, current)
  }

  return [...map.values()]
    .map(({ wageSum, ...rest }) => ({
      year: rest.year,
      avgDailyWage: rest.count > 0 ? wageSum / rest.count : 0,
      totalPaid: rest.totalPaid,
      workerDays: rest.workerDays,
      count: rest.count,
    }))
    .sort((a, b) => a.year.localeCompare(b.year))
}

function formatNum(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
}

export function YearlyHoeChart({ events }: { events: HoeEvent[] }) {
  const stats = useMemo(() => aggregateHoeByYear(events), [events])

  if (stats.length === 0) {
    return <p className="muted small">Grafik için Çapalama kaydı yok.</p>
  }

  const maxWage = Math.max(...stats.map((s) => s.avgDailyWage), 1)
  const maxPaid = Math.max(...stats.map((s) => s.totalPaid), 1)
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
        <span className="legend-swatch legend-hoe-wage" /> Ort. yevmiye
        <span className="legend-swatch legend-hoe-paid" /> Toplam harcama
      </p>
      <div className="harvest-chart-scroll">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          width={chartW}
          height={chartH}
          role="img"
          aria-label="Yıllara göre Çapalama kıyası"
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
            const wageH = (s.avgDailyWage / maxWage) * plotH
            const paidH = (s.totalPaid / maxPaid) * plotH
            return (
              <g key={s.year}>
                <rect
                  className="chart-bar chart-bar-hoe-wage"
                  x={cx - barW - 2}
                  y={padT + plotH - wageH}
                  width={barW}
                  height={Math.max(wageH, s.avgDailyWage > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {s.year}: {formatNum(s.avgDailyWage)} yevmiye
                  </title>
                </rect>
                <rect
                  className="chart-bar chart-bar-hoe-paid"
                  x={cx + 2}
                  y={padT + plotH - paidH}
                  width={barW}
                  height={Math.max(paidH, s.totalPaid > 0 ? 2 : 0)}
                  rx={3}
                >
                  <title>
                    {s.year}: {formatNum(s.totalPaid)} harcama
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
            <span>{formatNum(s.avgDailyWage)} yevmiye</span>
            <span>{formatNum(s.totalPaid)} harcama</span>
            <span>{s.count} kayıt</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
