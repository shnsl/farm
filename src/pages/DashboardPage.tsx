import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CollapseSection } from '../components/CollapseSection'
import {
  HeadingIcon,
  IconFields,
  IconPlus,
  IconTrash,
  IconTree,
  PageTitle,
} from '../components/Icons'
import {
  createField,
  createFieldSchema,
  deleteField,
  subscribeFields,
} from '../features/fields/api'
import { FarmFuelPanel } from '../features/fuel/FarmFuelPanel'
import { FarmPesticidePanel } from '../features/pesticide/FarmPesticidePanel'
import { countActiveTreesByFields } from '../features/trees/api'
import { useAuth } from '../lib/auth'
import { confirmDelete } from '../lib/confirmDelete'
import type { Field } from '../types'

type FieldSortMode = 0 | 1 | 2 | 3

const FIELD_SORT_LABELS: Record<FieldSortMode, string> = {
  0: 'İsim A→Z',
  1: 'İsim Z→A',
  2: 'Dönüm azalan',
  3: 'Dönüm artan',
}

function nextSortMode(mode: FieldSortMode): FieldSortMode {
  return ((mode + 1) % 4) as FieldSortMode
}

function sortFields(list: Field[], mode: FieldSortMode): Field[] {
  const copy = [...list]
  copy.sort((a, b) => {
    if (mode === 0) return a.name.localeCompare(b.name, 'tr')
    if (mode === 1) return b.name.localeCompare(a.name, 'tr')
    const da = a.donum ?? 0
    const db = b.donum ?? 0
    if (mode === 2) return db - da || a.name.localeCompare(b.name, 'tr')
    return da - db || a.name.localeCompare(b.name, 'tr')
  })
  return copy
}

export function DashboardPage() {
  const { farmId, user } = useAuth()
  const [fields, setFields] = useState<Field[]>([])
  const [treeCounts, setTreeCounts] = useState<Record<string, number>>({})
  const [countsReady, setCountsReady] = useState(false)
  const [plantedSort, setPlantedSort] = useState<FieldSortMode>(0)
  const [emptySort, setEmptySort] = useState<FieldSortMode>(0)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [rowCount, setRowCount] = useState(12)
  const [colCount, setColCount] = useState(80)
  const [species, setSpecies] = useState('')
  const [donum, setDonum] = useState('')
  const [fillGrid, setFillGrid] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!farmId) return
    return subscribeFields(
      farmId,
      setFields,
      (err) => setError(err.message),
    )
  }, [farmId])

  useEffect(() => {
    if (!farmId) return
    let cancelled = false
    setCountsReady(false)
    void countActiveTreesByFields(farmId, fields)
      .then((counts) => {
        if (!cancelled) {
          setTreeCounts(counts)
          setCountsReady(true)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Ağaç sayıları yüklenemedi',
          )
          setCountsReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [farmId, fields])

  const { plantedFields, emptyFields } = useMemo(() => {
    const planted: Field[] = []
    const empty: Field[] = []
    for (const field of fields) {
      if ((treeCounts[field.id] ?? 0) > 0) planted.push(field)
      else empty.push(field)
    }
    return {
      plantedFields: sortFields(planted, plantedSort),
      emptyFields: sortFields(empty, emptySort),
    }
  }, [fields, treeCounts, plantedSort, emptySort])

  async function onDeleteField(field: Field) {
    if (!farmId) return
    const ok = confirmDelete(
      `“${field.name}” tarlasını silmek istediğine emin misin? Bu işlem geri alınamaz.`,
    )
    if (!ok) return

    setError(null)
    setDeletingId(field.id)
    try {
      await deleteField(farmId, field.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tarla silinemedi')
    } finally {
      setDeletingId(null)
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!farmId) return
    setError(null)

    const parsed = createFieldSchema.safeParse({
      name,
      rowCount,
      colCount,
      species,
      donum: donum === '' ? undefined : Number(donum),
      notes,
      fillGrid: Boolean(species.trim()) && fillGrid,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }

    setSaving(true)
    try {
      await createField(farmId, parsed.data)
      setName('')
      setSpecies('')
      setDonum('')
      setNotes('')
      setFillGrid(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tarla oluşturulamadı')
    } finally {
      setSaving(false)
    }
  }

  function renderFieldList(list: Field[]) {
    return (
      <ul className="field-list">
        {list.map((field) => (
          <li key={field.id} className="field-list-item">
            <Link to={`/fields/${field.id}`} className="field-card">
              <span className="field-card-icon">
                <HeadingIcon tone="green">
                  <IconFields />
                </HeadingIcon>
              </span>
              <strong>{field.name}</strong>
              <span className="muted">
                {[
                  field.area?.trim() || null,
                  field.species?.trim() || null,
                  field.donum !== undefined
                    ? `${field.donum.toLocaleString('tr-TR')} dönüm`
                    : null,
                  `${field.rowCount}×${field.colCount}`,
                  countsReady
                    ? `${(treeCounts[field.id] ?? 0).toLocaleString('tr-TR')} ağaç`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </Link>
            <button
              type="button"
              className="btn danger btn-icon field-delete-btn"
              disabled={deletingId === field.id}
              aria-label={
                deletingId === field.id ? 'Siliniyor' : 'Tarlayı sil'
              }
              title="Tarlayı sil"
              onClick={() => void onDeleteField(field)}
            >
              <IconTrash />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  function renderGroup(
    title: string,
    list: Field[],
    sortMode: FieldSortMode,
    onCycleSort: () => void,
  ) {
    return (
      <div className="field-group">
        <div className="field-group-header">
          <h3 className="field-group-title">
            {title}
            <span className="muted small"> ({list.length})</span>
          </h3>
          <button
            type="button"
            className="btn ghost btn-compact"
            onClick={onCycleSort}
            title="Sıralamayı değiştir"
          >
            Sırala: {FIELD_SORT_LABELS[sortMode]}
          </button>
        </div>
        {list.length === 0 ? (
          <p className="muted small">Bu grupta tarla yok.</p>
        ) : (
          renderFieldList(list)
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <PageTitle icon={<IconFields />} tone="green">
            Tarlalar
          </PageTitle>
          <p className="muted">
            Her tarla satır (A…) × sütun (1…) hücre grid’i ile takip edilir.
          </p>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <CollapseSection title="Yeni Tarla" icon={<IconPlus />} tone="teal">
        <form className="form-grid" onSubmit={onCreate}>
          <label>
            Tarla adı
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Veri girmek için dokunun.."
              required
            />
          </label>
          <label>
            Çeşit
            <input
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <label>
            Dönüm
            <input
              type="number"
              min={0}
              step={0.1}
              value={donum}
              onChange={(e) => setDonum(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <label>
            Satır (en — harfler)
            <input
              type="number"
              min={1}
              max={26}
              value={rowCount}
              onChange={(e) => setRowCount(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Sütun (boy — numaralar)
            <input
              type="number"
              min={1}
              max={200}
              value={colCount}
              onChange={(e) => setColCount(Number(e.target.value))}
              required
            />
          </label>
          <label className="span-2 checkbox-label">
            <input
              type="checkbox"
              checked={fillGrid}
              onChange={(e) => setFillGrid(e.target.checked)}
              disabled={!species.trim()}
            />
            <span>
              Çeşit yazıldıysa tüm hücrelere bu çeşit ile ağaç ekle
              {species.trim()
                ? ` (${rowCount * colCount} ağaç)`
                : ' (önce çeşit gir)'}
            </span>
          </label>
          <label className="span-2">
            Not
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving
              ? fillGrid && species.trim()
                ? 'Tarla ve ağaçlar oluşturuluyor…'
                : 'Kaydediliyor…'
              : 'Tarla ekle'}
          </button>
        </form>
      </CollapseSection>

      {farmId && user && (
        <FarmFuelPanel farmId={farmId} userId={user.uid} />
      )}

      {farmId && user && (
        <FarmPesticidePanel farmId={farmId} userId={user.uid} />
      )}

      <CollapseSection
        title="Kayıtlı Tarlalar"
        icon={<IconTree />}
        tone="olive"
        defaultOpen
        bodyClassName="stack"
      >
        {fields.length === 0 ? (
          <p className="muted">Henüz tarla yok. Yukarıdan ilk tarlayı ekle.</p>
        ) : !countsReady ? (
          <p className="muted small">Tarlalar gruplanıyor…</p>
        ) : (
          <>
            {renderGroup(
              'Ağaç ekili tarlalar',
              plantedFields,
              plantedSort,
              () => setPlantedSort((m) => nextSortMode(m)),
            )}
            {renderGroup(
              'Boş tarlalar',
              emptyFields,
              emptySort,
              () => setEmptySort((m) => nextSortMode(m)),
            )}
          </>
        )}
      </CollapseSection>
    </div>
  )
}
