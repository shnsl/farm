import { useEffect, useState, type FormEvent } from 'react'
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
import { useAuth } from '../lib/auth'
import { confirmDelete } from '../lib/confirmDelete'
import type { Field } from '../types'

export function DashboardPage() {
  const { farmId } = useAuth()
  const [fields, setFields] = useState<Field[]>([])
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

      <CollapseSection
        title="Kayıtlı Tarlalar"
        icon={<IconTree />}
        tone="olive"
        defaultOpen
        bodyClassName="stack"
      >
        {fields.length === 0 ? (
          <p className="muted">Henüz tarla yok. Yukarıdan ilk tarlayı ekle.</p>
        ) : (
          <ul className="field-list">
            {fields.map((field) => (
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
        )}
      </CollapseSection>
    </div>
  )
}
