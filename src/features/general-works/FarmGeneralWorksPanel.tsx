import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import {
  IconNotebook,
  IconPencil,
  IconTrash,
} from '../../components/Icons'
import { confirmDelete } from '../../lib/confirmDelete'
import type { GeneralWorkEvent } from '../../types'
import {
  createGeneralWork,
  createGeneralWorkSchema,
  deleteGeneralWork,
  subscribeGeneralWorks,
  updateGeneralWork,
} from './api'

interface FarmGeneralWorksPanelProps {
  farmId: string
  userId: string
}

const PREVIEW_LIMIT = 3

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="btn ghost btn-compact"
            onClick={onClose}
          >
            Kapat
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function FarmGeneralWorksPanel({
  farmId,
  userId,
}: FarmGeneralWorksPanelProps) {
  const [events, setEvents] = useState<GeneralWorkEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listOpen, setListOpen] = useState(false)

  const [doneAt, setDoneAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [work, setWork] = useState('')
  const [cost, setCost] = useState(0)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDoneAt, setEditDoneAt] = useState('')
  const [editWork, setEditWork] = useState('')
  const [editCost, setEditCost] = useState(0)
  const [editFieldId, setEditFieldId] = useState<string | undefined>(undefined)

  useEffect(() => {
    return subscribeGeneralWorks(
      farmId,
      setEvents,
      (err) => setError(err.message),
    )
  }, [farmId])

  const preview = useMemo(() => events.slice(0, PREVIEW_LIMIT), [events])
  const totalCost = useMemo(
    () => events.reduce((sum, e) => sum + e.cost, 0),
    [events],
  )

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createGeneralWorkSchema.safeParse({ doneAt, work, cost })
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
    setEditFieldId(item.fieldId)
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
      fieldId: editFieldId,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await updateGeneralWork(farmId, editingId, parsed.data)
      setEditingId(null)
      setEditFieldId(undefined)
      setInfo('Genel iş kaydı güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  function onDelete(item: GeneralWorkEvent) {
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
              Yapılan iş
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
      <li key={item.id} className="list-row-actions">
        <span className="list-row-actions-main">
          {item.doneAt.slice(0, 10)} · {item.work} · {formatMoney(item.cost)} ₺
        </span>
        <div className="table-row-actions">
          <button
            type="button"
            className="btn ghost btn-icon"
            disabled={saving}
            aria-label="Düzenle"
            title="Düzenle"
            onClick={() => startEdit(item)}
          >
            <IconPencil />
          </button>
          <button
            type="button"
            className="btn ghost btn-icon"
            disabled={saving}
            aria-label="Sil"
            title="Sil"
            onClick={() => onDelete(item)}
          >
            <IconTrash />
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
        <strong>Toplam genel iş masrafı</strong>
        <p>{formatMoney(totalCost)}</p>
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
          Yapılan iş
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

      {events.length === 0 ? (
        <p className="muted small">Henüz genel iş kaydı yok.</p>
      ) : (
        <>
          <ul className="stack-gap">{preview.map(renderItem)}</ul>
          {events.length > PREVIEW_LIMIT && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => setListOpen(true)}
            >
              Tümünü gör ({events.length})
            </button>
          )}
        </>
      )}

      {listOpen && (
        <Modal title="Tüm genel işler" onClose={() => setListOpen(false)}>
          <ul className="stack-gap">{events.map(renderItem)}</ul>
        </Modal>
      )}
    </CollapseSection>
  )
}
