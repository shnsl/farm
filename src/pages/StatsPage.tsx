import { useEffect, useState } from 'react'
import {
  IconCompare,
  IconFields,
  IconLeaf,
  IconTree,
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
              <p className="stats-summary-value">{formatNum(stats.fieldCount)}</p>
              <p className="muted small">Kayıtlı tarla</p>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconFields />} tone="olive">
                Dönüm
              </SectionTitle>
              <p className="stats-summary-value">
                {formatNum(stats.totalDonum)}
              </p>
              <p className="muted small">Toplam alan</p>
            </div>
            <div className="panel stats-summary-card">
              <SectionTitle as="h3" icon={<IconTree />} tone="green">
                Ağaç
              </SectionTitle>
              <p className="stats-summary-value">{formatNum(stats.totalTrees)}</p>
              <p className="muted small">Aktif ağaç</p>
            </div>
          </section>

          <section className="panel stack">
            <SectionTitle icon={<IconTree />} tone="green">
              Çeşitlere Göre Ağaç
            </SectionTitle>
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
                          <td>{formatNum(row.count)}</td>
                          <td>
                            <div className="stats-share">
                              <span className="stats-share-bar" aria-hidden>
                                <span
                                  className="stats-share-fill"
                                  style={{ width: `${share}%` }}
                                />
                              </span>
                              <span className="muted small">
                                %{share.toLocaleString('tr-TR', {
                                  maximumFractionDigits: 1,
                                })}
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
          </section>

          <section className="panel stack">
            <SectionTitle icon={<IconLeaf />} tone="amber">
              Yıllara Göre Harcama
            </SectionTitle>
            <p className="muted small">
              Gübreleme + Budama + Hasat + Çapalama harcamaları.
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
                        {formatMoney(row.total)}
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
                        <th>Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byYear.map((row) => (
                        <tr key={row.year}>
                          <td>{row.year}</td>
                          <td>{formatMoney(row.fertilize)}</td>
                          <td>{formatMoney(row.prune)}</td>
                          <td>{formatMoney(row.harvest)}</td>
                          <td>{formatMoney(row.hoe)}</td>
                          <td>
                            <strong>{formatMoney(row.total)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
