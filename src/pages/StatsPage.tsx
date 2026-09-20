import { useEffect, useState } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { CollapseSection } from '../components/CollapseSection'
import {
  IconArea,
  IconCompare,
  IconFields,
  IconTree,
  IconVariety,
  IconWallet,
  PageTitle,
  SectionTitle,
} from '../components/Icons'
import { subscribeFields } from '../features/fields/api'
import { loadFarmStats, type FarmStats } from '../features/stats/api'
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

export function StatsPage() {
  const { farmId } = useAuth()
  const [fields, setFields] = useState<Field[]>([])
  const [stats, setStats] = useState<FarmStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!farmId) return
    return subscribeFields(farmId, setFields, (err) => setError(err.message))
  }, [farmId])

  useEffect(() => {
    if (!farmId) return
    let cancelled = false
    setLoading(true)
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
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [farmId, fields])

  const maxSpend = Math.max(...(stats?.byYear.map((y) => y.total) ?? [0]), 1)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <PageTitle icon={<IconCompare />} tone="sky">
            İstatistikler
          </PageTitle>
          <p className="muted">
            Tüm tarlalardaki ağaç çeşitleri, dönüm ve yıllara göre harcamalar.
          </p>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && !stats ? (
        <p className="muted">İstatistikler yükleniyor…</p>
      ) : stats ? (
        <>
          <section className="stats-summary-grid">
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconFields />} tone="teal">
                Tarla
              </SectionTitle>
              <p className="stats-summary-value">
                <AnimatedNumber value={stats.fieldCount} format={formatInt} />
              </p>
              <p className="muted small">Kayıtlı tarla</p>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconArea />} tone="olive">
                Dönüm
              </SectionTitle>
              <p className="stats-summary-value">
                <AnimatedNumber value={stats.totalDonum} format={formatNum} />
              </p>
              <p className="muted small">Toplam alan</p>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconTree />} tone="green">
                Ağaç
              </SectionTitle>
              <p className="stats-summary-value">
                <AnimatedNumber value={stats.totalTrees} format={formatInt} />
              </p>
              <p className="muted small">Aktif ağaç</p>
            </div>
          </section>

          <CollapseSection
            title="Çeşitlere Göre Ağaç"
            icon={<IconVariety />}
            tone="green"
            bodyClassName="stack"
          >
            {stats.bySpecies.length === 0 ? (
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
                    {stats.bySpecies.map((row) => {
                      const share =
                        stats.totalTrees > 0
                          ? (row.count / stats.totalTrees) * 100
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
            title="Yıllara Göre Harcama"
            icon={<IconWallet />}
            tone="amber"
            bodyClassName="stack"
          >
            <p className="muted small">
              Gübreleme + Budama + Hasat + Çapalama + Yakıt + İlaçlama
              harcamaları.
            </p>
            {stats.byYear.length === 0 ? (
              <p className="muted small">Henüz harcama kaydı yok.</p>
            ) : (
              <>
                <ul className="stats-year-bars" aria-label="Yıllık harcama">
                  {[...stats.byYear].reverse().map((row) => (
                    <li key={row.year}>
                      <span className="stats-year-label">{row.year}</span>
                      <span className="stats-year-track" aria-hidden>
                        <span
                          className="stats-year-fill"
                          style={{
                            width: `${(row.total / maxSpend) * 100}%`,
                          }}
                        />
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
                        <th>Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byYear.map((row) => (
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
        </>
      ) : null}
    </div>
  )
}
