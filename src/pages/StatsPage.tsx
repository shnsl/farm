import { useEffect, useMemo, useState } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { CollapseSection } from '../components/CollapseSection'
import {
  IconArea,
  IconCompare,
  IconFields,
  IconFuel,
  IconTree,
  IconVariety,
  IconWallet,
  PageTitle,
  SectionTitle,
} from '../components/Icons'
import { subscribeFields } from '../features/fields/api'
import { backfillMissingTreeStats } from '../features/fields/treeStats'
import {
  buildInstantFarmStats,
  loadFarmStats,
  type FarmStats,
  type YearSpendStat,
} from '../features/stats/api'
import {
  FarmDepotPanel,
  FarmEarningsPanel,
} from '../features/warehouse/FarmDepotPanel'
import { useAuth } from '../lib/auth'
import type { Field } from '../types'

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function formatNum(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function formatInt(value: number): string {
  return Math.round(value).toLocaleString('tr-TR')
}

function formatPct(value: number): string {
  return `%${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`
}

const SPEND_SEGMENTS: {
  key: Exclude<keyof YearSpendStat, 'year' | 'total'>
  label: string
  className: string
}[] = [
  { key: 'fertilize', label: 'Gübreleme', className: 'stats-spend-fertilize' },
  { key: 'prune', label: 'Budama', className: 'stats-spend-prune' },
  { key: 'harvest', label: 'Hasat', className: 'stats-spend-harvest' },
  { key: 'hoe', label: 'Çapalama', className: 'stats-spend-hoe' },
  { key: 'fuel', label: 'Yakıt', className: 'stats-spend-fuel' },
  { key: 'pesticide', label: 'İlaçlama', className: 'stats-spend-pesticide' },
  {
    key: 'generalWork',
    label: 'Genel İşler',
    className: 'stats-spend-general',
  },
]

export function StatsPage() {
  const { farmId, user } = useAuth()
  const [fields, setFields] = useState<Field[]>([])
  const [fieldsReady, setFieldsReady] = useState(false)
  const [stats, setStats] = useState<FarmStats | null>(null)
  const [spendLoading, setSpendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!farmId) return
    setFieldsReady(false)
    return subscribeFields(
      farmId,
      (next) => {
        setFields(next)
        setFieldsReady(true)
      },
      (err) => setError(err.message),
    )
  }, [farmId])

  useEffect(() => {
    if (!farmId || !fieldsReady || fields.length === 0) return
    const missing = fields.filter(
      (f) => f.activeTreeCount === undefined || f.speciesCounts === undefined,
    )
    if (missing.length === 0) return
    let cancelled = false
    void backfillMissingTreeStats(farmId, missing).catch((err: unknown) => {
      if (!cancelled) {
        setError(
          err instanceof Error ? err.message : 'Ağaç sayaçları güncellenemedi',
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [farmId, fieldsReady, fields])

  const instant = useMemo(() => buildInstantFarmStats(fields), [fields])
  const display: FarmStats = stats ?? {
    ...instant,
    currentYearFuelSpend: 0,
    byYear: [],
  }

  const fieldIdsKey = useMemo(
    () => fields.map((f) => f.id).join('|'),
    [fields],
  )

  useEffect(() => {
    if (!farmId || !fieldsReady) return
    let cancelled = false
    setSpendLoading(true)
    setError(null)
    void loadFarmStats(farmId, fields)
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'İstatistikler yüklenemedi',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setSpendLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aynı tarla setinde tekrar yükleme
  }, [farmId, fieldsReady, fieldIdsKey])

  const maxSpend = Math.max(...(display.byYear.map((y) => y.total) ?? [0]), 1)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <PageTitle icon={<IconCompare />} tone="sky">
            İstatistikler
          </PageTitle>
          <p className="muted">
            Tüm tarlalardaki ağaç çeşitleri, dönüm ve masraflar.
          </p>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!fieldsReady ? (
        <p className="muted">İstatistikler yükleniyor…</p>
      ) : (
        <>
          <section className="stats-summary-grid">
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconFields />} tone="teal">
                Tarla
              </SectionTitle>
              <div className="stats-summary-body">
                <p className="stats-summary-value">
                  <AnimatedNumber
                    value={display.fieldCount}
                    format={formatInt}
                  />
                </p>
                <p className="muted small">Ağaç ekili tarla</p>
              </div>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconFields />} tone="amber">
                Boş Tarla
              </SectionTitle>
              <div className="stats-summary-body">
                <p className="stats-summary-value">
                  <AnimatedNumber
                    value={display.emptyFieldCount}
                    format={formatInt}
                  />
                </p>
                <p className="muted small">Ağaçsız tarla</p>
              </div>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconTree />} tone="green">
                Toplam Ağaç
              </SectionTitle>
              <div className="stats-summary-body">
                <p className="stats-summary-value">
                  <AnimatedNumber
                    value={display.totalTrees}
                    format={formatInt}
                  />
                </p>
                <p className="muted small">Aktif ağaç</p>
              </div>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconArea />} tone="olive">
                Dönüm
              </SectionTitle>
              <div className="stats-summary-body">
                <p className="stats-summary-value">
                  <AnimatedNumber
                    value={display.totalDonum}
                    format={formatNum}
                  />
                </p>
                <p className="muted small">Ekili alan</p>
              </div>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconArea />} tone="rose">
                Boş Dönüm
              </SectionTitle>
              <div className="stats-summary-body">
                <p className="stats-summary-value">
                  <AnimatedNumber
                    value={display.emptyDonum}
                    format={formatNum}
                  />
                </p>
                <p className="muted small">Boş tarla alanı</p>
              </div>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconFuel />} tone="sky">
                Yakıt
              </SectionTitle>
              <div className="stats-summary-body">
                <p className="stats-summary-value">
                  <AnimatedNumber
                    value={display.currentYearFuelSpend}
                    format={formatMoney}
                  />
                </p>
                <p className="muted small">
                  {new Date().getFullYear()} alım (₺)
                </p>
              </div>
            </div>
          </section>

          <CollapseSection
            title="Çeşitlere Göre Ağaç"
            icon={<IconVariety />}
            tone="green"
            bodyClassName="stack"
          >
            {display.bySpecies.length === 0 ? (
              <p className="muted small">Henüz aktif ağaç yok.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Çeşit</th>
                      <th>Adet</th>
                      <th>Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {display.bySpecies.map((row) => {
                      const share =
                        display.totalTrees > 0
                          ? (row.count / display.totalTrees) * 100
                          : 0
                      return (
                        <tr key={row.species}>
                          <td>{row.species}</td>
                          <td>
                            <AnimatedNumber
                              value={row.count}
                              format={formatInt}
                            />
                          </td>
                          <td>
                            <div className="stats-share">
                              <span className="stats-share-bar" aria-hidden>
                                <span
                                  className="stats-share-fill"
                                  style={{ width: `${share}%` }}
                                />
                              </span>
                              <span className="muted small">
                                <AnimatedNumber
                                  value={share}
                                  format={formatPct}
                                />
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CollapseSection>

          <CollapseSection
            title="Masraflar"
            icon={<IconWallet />}
            tone="amber"
            bodyClassName="stack"
          >
            <p className="muted small">
              Gübreleme + Budama + Hasat + Çapalama + Yakıt + İlaçlama + Genel
              İşler masrafları.
            </p>
            {spendLoading && display.byYear.length === 0 ? (
              <p className="muted small">Masraflar yükleniyor…</p>
            ) : display.byYear.length === 0 ? (
              <p className="muted small">Henüz masraf kaydı yok.</p>
            ) : (
              <>
                <p className="muted small harvest-chart-legend" aria-hidden>
                  {SPEND_SEGMENTS.map((seg) => (
                    <span key={seg.key}>
                      <span
                        className={`legend-swatch ${seg.className}`}
                      />
                      {seg.label}
                    </span>
                  ))}
                </p>
                <ul className="stats-year-bars" aria-label="Yıllık masraf">
                  {[...display.byYear].reverse().map((row) => (
                    <li key={row.year}>
                      <span className="stats-year-label">{row.year}</span>
                      <span
                        className="stats-year-track stats-year-track-stack"
                        aria-hidden
                      >
                        {SPEND_SEGMENTS.map((seg) => {
                          const value = row[seg.key]
                          if (!value) return null
                          return (
                            <span
                              key={seg.key}
                              className={`stats-year-seg ${seg.className}`}
                              style={{
                                width: `${(value / maxSpend) * 100}%`,
                              }}
                              title={`${seg.label}: ${formatMoney(value)} ₺`}
                            />
                          )
                        })}
                      </span>
                      <span className="stats-year-total">
                        <AnimatedNumber
                          value={row.total}
                          format={formatMoney}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Yıl</th>
                        <th>Gübreleme</th>
                        <th>Budama</th>
                        <th>Hasat</th>
                        <th>Çapalama</th>
                        <th>Yakıt</th>
                        <th>İlaçlama</th>
                        <th>Genel İşler</th>
                        <th>Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {display.byYear.map((row) => (
                        <tr key={row.year}>
                          <td>{row.year}</td>
                          <td>
                            <AnimatedNumber
                              value={row.fertilize}
                              format={formatMoney}
                            />
                          </td>
                          <td>
                            <AnimatedNumber
                              value={row.prune}
                              format={formatMoney}
                            />
                          </td>
                          <td>
                            <AnimatedNumber
                              value={row.harvest}
                              format={formatMoney}
                            />
                          </td>
                          <td>
                            <AnimatedNumber
                              value={row.hoe}
                              format={formatMoney}
                            />
                          </td>
                          <td>
                            <AnimatedNumber
                              value={row.fuel}
                              format={formatMoney}
                            />
                          </td>
                          <td>
                            <AnimatedNumber
                              value={row.pesticide}
                              format={formatMoney}
                            />
                          </td>
                          <td>
                            <AnimatedNumber
                              value={row.generalWork}
                              format={formatMoney}
                            />
                          </td>
                          <td>
                            <strong>
                              <AnimatedNumber
                                value={row.total}
                                format={formatMoney}
                              />
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CollapseSection>

          {farmId && user && (
            <FarmDepotPanel farmId={farmId} userId={user.uid} />
          )}

          {farmId && <FarmEarningsPanel farmId={farmId} />}
        </>
      )}
    </div>
  )
}
