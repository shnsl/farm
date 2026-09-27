import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  HeadingIcon,
  IconSearch,
  IconVariety,
  PageTitle,
  SectionTitle,
} from '../components/Icons'
import { subscribeFields } from '../features/fields/api'
import {
  SEARCH_KIND_LABELS,
  searchFarm,
  type FarmSearchHit,
  type SearchHitKind,
} from '../features/search/api'
import { useAuth } from '../lib/auth'
import type { Field } from '../types'

export function SearchPage() {
  const { farmId } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(initialQ)
  const [fields, setFields] = useState<Field[]>([])
  const [fieldsReady, setFieldsReady] = useState(false)
  const [hits, setHits] = useState<FarmSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

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
    setQuery(initialQ)
  }, [initialQ])

  useEffect(() => {
    if (!farmId || !initialQ.trim() || !fieldsReady) {
      if (!initialQ.trim()) {
        setHits([])
        setSearched(false)
      }
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void searchFarm(farmId, fields, initialQ)
      .then((result) => {
        if (cancelled) return
        setHits(result)
        setSearched(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Arama başarısız')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [farmId, fields, fieldsReady, initialQ])

  const grouped = useMemo(() => {
    const map = new Map<SearchHitKind, FarmSearchHit[]>()
    for (const hit of hits) {
      const list = map.get(hit.kind) ?? []
      list.push(hit)
      map.set(hit.kind, list)
    }
    return map
  }, [hits])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = query.trim()
    setSearchParams(next ? { q: next } : {})
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <PageTitle icon={<IconSearch />} tone="sky">
            Ara
          </PageTitle>
          <p className="muted">
            Tarla, ağaç, genel iş, hasat, sürüm, gübre, çapa, budama, yakıt,
            ilaç, depo ve satış kayıtlarında ara.
          </p>
        </div>
      </header>

      <form className="panel search-page-form" onSubmit={onSubmit}>
        <label>
          Arama
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Veri girmek için dokunun.."
          />
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Aranıyor…' : 'Ara'}
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {searched && !loading && (
        <section className="stack-gap">
          <SectionTitle icon={<IconVariety />} tone="teal">
            Sonuçlar{' '}
            <span className="muted small">({hits.length})</span>
          </SectionTitle>
          {hits.length === 0 ? (
            <p className="muted">Eşleşen kayıt yok.</p>
          ) : (
            [...grouped.entries()].map(([kind, list]) => (
              <div key={kind} className="stack">
                <h3 className="muted small">
                  {SEARCH_KIND_LABELS[kind]} ({list.length})
                </h3>
                <ul className="field-list">
                  {list.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="field-card search-hit"
                        onClick={() => navigate(hit.href)}
                      >
                        <span className="field-card-icon">
                          <HeadingIcon tone="olive">
                            <IconSearch />
                          </HeadingIcon>
                        </span>
                        <strong>{hit.title}</strong>
                        <span className="muted">{hit.subtitle}</span>
                        {hit.detail && (
                          <span className="muted small search-hit-notes">
                            {hit.detail}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}

      {!searched && !loading && (
        <p className="muted">
          Üstteki arama çubuğundan veya buradan yazıp Enter’a bas.
          <Link to="/"> Tarlalara dön</Link>
        </p>
      )}
    </div>
  )
}
