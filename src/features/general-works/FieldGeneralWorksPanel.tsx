import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import { IconNotebook } from '../../components/Icons'
import { confirmDelete } from '../../lib/confirmDelete'
import type { GeneralWorkEvent } from '../../types'
import {
  createGeneralWork,
  createGeneralWorkSchema,
  deleteGeneralWork,
  subscribeFieldGeneralWorks,
  updateGeneralWork,
} from './api'

interface FieldGeneralWorksPanelProps {
  farmId: string
  fieldId: string
  userId: string
}

const PREVIEW_LIMIT = 6

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

export function FieldGeneralWorksPanel({
  farmId,
  fieldId,
  userId,
}: FieldGeneralWorksPanelProps) {
  const [events, setEvents] = useState<GeneralWorkEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [doneAt, setDoneAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [work, setWork] = useState('')
  const [cost, setCost] = useState(0)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDoneAt, setEditDoneAt] = useState('')
  const [editWork, setEditWork] = useState('')
  const [editCost, setEditCost] = useState(0)

  useEffect(() => {
    return subscribeFieldGeneralWorks(
      farmId,
      fieldId,
      setEvents,
      (err) => setError(err.message),
    )
  }, [farmId, fieldId])

  const preview = useMemo(() => events.slice(0, PREVIEW_LIMIT), [events])
  const latest = events[0] ?? null

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createGeneralWorkSchema.safeParse({
      doneAt,
      work,
      cost,
      fieldId,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createGeneralWork(farmId, parsed.data, userId)
      setWork('')
      setCost(0)
      setInfo('Genel iş kaydı eklendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(item: GeneralWorkEvent) {
    setEditingId(item.id)
    setEditDoneAt(item.doneAt.slice(0, 10))
    setEditWork(item.work)
    setEditCost(item.cost)
    setError(null)
    setInfo(null)
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    setError(null)
    setInfo(null)
    const parsed = createGeneralWorkSchema.safeParse({
      doneAt: editDoneAt,
      work: editWork,
      cost: editCost,
      fieldId,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await updateGeneralWork(farmId, editingId, parsed.data)
      setEditingId(null)
      setInfo('Genel iş kaydı güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  function renderItem(item: GeneralWorkEvent) {
    if (editingId === item.id) {
      return (
        <li key={item.id} className="fertilize-edit-item">
          <form className="form-grid" onSubmit={onSaveEdit}>
            <label>
              Tarih
              <input
                type="date"
                value={editDoneAt}
                onChange={(e) => setEditDoneAt(e.target.value)}
                required
              />
            </label>
            <label>
              İşlem
              <input
                value={editWork}
                onChange={(e) => setEditWork(e.target.value)}
                placeholder="Veri girmek için dokunun.."
                required
              />
            </label>
            <label>
              Masraf (₺)
              <input
                type="number"
                min={0}
                step={0.01}
                value={editCost}
                onChange={(e) => setEditCost(Number(e.target.value))}
                required
              />
            </label>
            <div className="bulk-actions span-2">
              <button className="btn primary" type="submit" disabled={saving}>
                Kaydet
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setEditingId(null)}
              >
                İptal
              </button>
            </div>
          </form>
        </li>
      )
    }

    return (
      <li key={item.id}>
        <span>
          {item.doneAt.slice(0, 10)} · {item.work} · {formatMoney(item.cost)}
        </span>
        <div className="bulk-actions">
          <button
            type="button"
            className="btn ghost btn-compact"
            disabled={saving}
            onClick={() => startEdit(item)}
          >
            Düzenle
          </button>
          <button
            type="button"
            className="btn ghost btn-compact"
            disabled={saving}
            onClick={() => {
              if (
                !confirmDelete(
                  'Bu genel iş kaydı silinsin mi? Bu işlem geri alınamaz.',
                )
              ) {
                return
              }
              void deleteGeneralWork(farmId, item.id).catch((err) =>
                setError(err instanceof Error ? err.message : 'Silinemedi'),
              )
            }}
          >
            Sil
          </button>
        </div>
      </li>
    )
  }

  return (
    <CollapseSection
      title="Genel İşler"
      icon={<IconNotebook />}
      tone="amber"
      bodyClassName="stack"
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && <p className="success">{info}</p>}

      <div className="info-summary stack">
        <strong>Son genel iş</strong>
        {latest ? (
          <dl className="summary-list">
            <dt>Tarih</dt>
            <dd>{latest.doneAt.slice(0, 10)}</dd>
            <dt>İşlem</dt>
            <dd>{latest.work}</dd>
            <dt>Masraf</dt>
            <dd>{formatMoney(latest.cost)}</dd>
          </dl>
        ) : (
          <p className="muted small">Bu tarlaya ait genel iş kaydı yok.</p>
        )}
      </div>

      <form className="form-grid" onSubmit={onAdd}>
        <label>
          Tarih
          <input
            type="date"
            value={doneAt}
            onChange={(e) => setDoneAt(e.target.value)}
            required
          />
        </label>
        <label>
          İşlem
          <input
            value={work}
            onChange={(e) => setWork(e.target.value)}
            placeholder="Veri girmek için dokunun.."
            required
          />
        </label>
        <label>
          Masraf (₺)
          <input
            type="number"
            min={0}
            step={0.01}
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
            required
          />
        </label>
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Genel iş ekle'}
        </button>
      </form>

      {events.length > 0 && (
        <ul className="stack-gap">{preview.map(renderItem)}</ul>
      )}
      {events.length > PREVIEW_LIMIT && (
        <p className="muted small">
          Son {PREVIEW_LIMIT} kayıt gösteriliyor ({events.length} toplam).
        </p>
      )}
    </CollapseSection>
  )
}
