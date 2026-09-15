import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { subscribeFields } from '../features/fields/api'
import {
  searchFarmTrees,
  TREE_HEALTH_LABELS,
  type TreeSearchHit,
} from '../features/trees/api'
import { useAuth } from '../lib/auth'
import type { Field } from '../types'

export function SearchPage() {
  const { farmId } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(initialQ)
  const [fields, setFields] = useState<Field[]>([])
  const [hits, setHits] = useState<TreeSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!farmId) return
    return subscribeFields(farmId, setFields, (err) => setError(err.message))
  }, [farmId])

  useEffect(() => {
    setQuery(initialQ)
  }, [initialQ])

  useEffect(() => {
    if (!farmId || !initialQ.trim()) {
      setHits([])
      setSearched(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void searchFarmTrees(
      farmId,
      fields.map((f) => ({ id: f.id, name: f.name })),
      initialQ,
    )
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
  }, [farmId, fields, initialQ])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = query.trim()
    setSearchParams(next ? { q: next } : {})
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Ara</h1>
          <p className="muted">
            Tüm tarlalarda hücre, çeşit, etiket, not veya sağlık bilgisine göre ara.
          </p>
        </div>
      </header>

      <form className="panel search-page-form" onSubmit={onSubmit}>
        <label>
          Arama
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Örn. A-12, Gemlik, hasta…"
            autoFocus
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
          <h2>
            Sonuçlar{' '}
            <span className="muted small">({hits.length})</span>
          </h2>
          {hits.length === 0 ? (
            <p className="muted">Eşleşen kayıt yok.</p>
          ) : (
            <ul className="field-list">
              {hits.map((hit) => (
                <li key={`${hit.fieldId}-${hit.tree.id}`}>
                  <button
                    type="button"
                    className="field-card search-hit"
                    onClick={() =>
                      navigate(
                        `/fields/${hit.fieldId}?cell=${encodeURIComponent(hit.tree.cell)}`,
                      )
                    }
                  >
                    <strong>
                      {hit.fieldName} · {hit.tree.cell}
                    </strong>
                    <span className="muted">
                      {[
                        hit.tree.species,
                        hit.tree.label,
                        hit.tree.health
                          ? TREE_HEALTH_LABELS[hit.tree.health]
                          : null,
                        hit.tree.plantedAt,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Detay yok'}
                    </span>
                    {hit.tree.notes && (
                      <span className="muted small search-hit-notes">
                        {hit.tree.notes}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
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
