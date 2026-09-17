import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import {
  IconClipboard,
  IconDrop,
  IconFertilizer,
  IconTrend,
  SectionTitle,
} from '../../components/Icons'
import {
  createFertilizeEvent,
  createFertilizeSchema,
  deleteFertilizeEvent,
  subscribeFertilizeEvents,
  updateFertilizeEvent,
} from './api'
import {
  aggregateFertilizeByYear,
  YearlyFertilizeChart,
} from './YearlyFertilizeChart'
import { confirmDelete } from '../../lib/confirmDelete'
import type { FertilizeEvent } from '../../types'

interface FieldCarePanelProps {
  farmId: string
  fieldId: string
  userId: string
}

const PREVIEW_LIMIT = 4

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
  })
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

export function FieldCarePanel({
  farmId,
  fieldId,
  userId,
}: FieldCarePanelProps) {
  const [events, setEvents] = useState<FertilizeEvent[]>([])
  const [doneAt, setDoneAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [fertilizerType, setFertilizerType] = useState('')
  const [cost, setCost] = useState(0)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDoneAt, setEditDoneAt] = useState('')
  const [editType, setEditType] = useState('')
  const [editCost, setEditCost] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  const [chartModalOpen, setChartModalOpen] = useState(false)

  useEffect(() => {
    return subscribeFertilizeEvents(
      farmId,
      fieldId,
      setEvents,
      (err) => setError(err.message),
    )
  }, [farmId, fieldId])

  const latest = events[0] ?? null
  const preview = useMemo(() => events.slice(0, PREVIEW_LIMIT), [events])
  const byYear = useMemo(() => aggregateFertilizeByYear(events), [events])

  function startEdit(event: FertilizeEvent) {
    setEditingId(event.id)
    setEditDoneAt(event.doneAt.slice(0, 10))
    setEditType(event.fertilizerType)
    setEditCost(event.cost)
    setEditNotes(event.notes ?? '')
    setError(null)
    setInfo(null)
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createFertilizeSchema.safeParse({
      doneAt,
      fertilizerType,
      cost,
      notes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createFertilizeEvent(farmId, fieldId, parsed.data, userId)
      setFertilizerType('')
      setCost(0)
      setNotes('')
      setInfo('Gübreleme kaydı eklendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    setError(null)
    setInfo(null)
    const parsed = createFertilizeSchema.safeParse({
      doneAt: editDoneAt,
      fertilizerType: editType,
      cost: editCost,
      notes: editNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await updateFertilizeEvent(farmId, fieldId, editingId, parsed.data)
      setEditingId(null)
      setInfo('Gübreleme kaydı güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapseSection
      title="Gübreleme ve Bakım"
      icon={<IconFertilizer />}
      tone="teal"
      bodyClassName="stack"
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && <p className="success">{info}</p>}

      <div className="plow-stat-card">
        <strong>Son Gübreleme</strong>
        {latest ? (
          <dl className="summary-list">
            <dt>Tarih</dt>
            <dd>{latest.doneAt.slice(0, 10)}</dd>
            <dt>Cins</dt>
            <dd>{latest.fertilizerType}</dd>
            <dt>Masraf</dt>
            <dd>{formatMoney(latest.cost)}</dd>
          </dl>
        ) : (
          <p className="muted small">Henüz Gübreleme kaydı yok.</p>
        )}
      </div>

      <CollapseSection title="Gübreleme Kaydı" icon={<IconDrop />} tone="green">
        <form className="form-grid" onSubmit={onAdd}>
          <label>
            Gübreleme tarihi
            <input
              type="date"
              value={doneAt}
              onChange={(e) => setDoneAt(e.target.value)}
              required
            />
          </label>
          <label>
            Gübre cinsi
            <input
              value={fertilizerType}
              onChange={(e) => setFertilizerType(e.target.value)}
              placeholder="Veri girmek için dokunun.."
              required
            />
          </label>
          <label>
            Gübreleme masrafı
            <input
              type="number"
              min={0}
              step={0.01}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              required
            />
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
            {saving ? 'Kaydediliyor…' : 'Gübreleme ekle'}
          </button>
        </form>
      </CollapseSection>

      {byYear.length > 0 && (
        <CollapseSection
          title="Gübreleme Kıyası (Yıllara Göre)"
          icon={<IconTrend />}
          tone="sky"
        >
          <div className="bulk-actions" style={{ marginBottom: '0.65rem' }}>
            <button
              type="button"
              className="btn ghost btn-compact"
              onClick={() => setChartModalOpen(true)}
            >
              Grafikte gör
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Yıl</th>
                  <th>Kayıt</th>
                  <th>Toplam masraf</th>
                  <th>Gübre cinsleri</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...byYear].reverse().map((row) => (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <td>{row.count}</td>
                    <td>{formatMoney(row.cost)}</td>
                    <td>{row.types.join(', ') || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn ghost btn-compact"
                        onClick={() => setChartModalOpen(true)}
                      >
                        Grafikte gör
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapseSection>
      )}

      <div>
        <SectionTitle as="h3" icon={<IconClipboard />} tone="olive">
          Gübreleme Kayıtları
        </SectionTitle>
        {events.length === 0 ? (
          <p className="muted small">Henüz kayıt yok.</p>
        ) : (
          <ul className="event-list event-list-preview">
            {preview.map((item) =>
              editingId === item.id ? (
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
                      Cins
                      <input
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Masraf
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editCost}
                        onChange={(e) => setEditCost(Number(e.target.value))}
                        required
                      />
                    </label>
                    <label className="span-2">
                      Not
                      <input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                      />
                    </label>
                    <div className="bulk-actions span-2">
                      <button
                        className="btn primary"
                        type="submit"
                        disabled={saving}
                      >
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
              ) : (
                <li key={item.id}>
                  <span>
                    {item.doneAt.slice(0, 10)} · {item.fertilizerType} ·{' '}
                    {formatMoney(item.cost)}
                    {item.notes ? ` · ${item.notes}` : ''}
                  </span>
                  <div className="table-row-actions">
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
                            'Bu Gübreleme kaydı silinsin mi? Bu işlem geri alınamaz.',
                          )
                        ) {
                          return
                        }
                        void deleteFertilizeEvent(
                          farmId,
                          fieldId,
                          item.id,
                        ).catch((err) =>
                          setError(
                            err instanceof Error ? err.message : 'Silinemedi',
                          ),
                        )
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        {events.length > PREVIEW_LIMIT && (
          <p className="muted small">
            Son {PREVIEW_LIMIT} kayıt gösteriliyor · toplam {events.length}
          </p>
        )}
      </div>

      {chartModalOpen && (
        <Modal
          title="Gübreleme Kıyası (Yıllara Göre)"
          onClose={() => setChartModalOpen(false)}
        >
          <YearlyFertilizeChart events={events} />
        </Modal>
      )}
    </CollapseSection>
  )
}
