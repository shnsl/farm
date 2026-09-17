import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import {
  IconHoe,
  IconNotebook,
  IconPie,
  IconSoil,
  SectionTitle,
} from '../../components/Icons'
import { confirmDelete } from '../../lib/confirmDelete'
import type { HoeEvent } from '../../types'
import {
  createHoeEvent,
  createHoeSchema,
  deleteHoeEvent,
  subscribeHoeEvents,
  updateHoeEvent,
} from './api'
import { aggregateHoeByYear, YearlyHoeChart } from './YearlyHoeChart'

interface FieldHoePanelProps {
  farmId: string
  fieldId: string
  userId: string
}

const PREVIEW_LIMIT = 4

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

export function FieldHoePanel({
  farmId,
  fieldId,
  userId,
}: FieldHoePanelProps) {
  const [events, setEvents] = useState<HoeEvent[]>([])
  const [doneAt, setDoneAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [workerCount, setWorkerCount] = useState(1)
  const [dailyWage, setDailyWage] = useState(0)
  const [totalPaid, setTotalPaid] = useState(0)
  const [totalEdited, setTotalEdited] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDoneAt, setEditDoneAt] = useState('')
  const [editWorkerCount, setEditWorkerCount] = useState(1)
  const [editDailyWage, setEditDailyWage] = useState(0)
  const [editTotalPaid, setEditTotalPaid] = useState(0)
  const [editTotalEdited, setEditTotalEdited] = useState(true)
  const [editNotes, setEditNotes] = useState('')
  const [chartModalOpen, setChartModalOpen] = useState(false)

  useEffect(() => {
    return subscribeHoeEvents(
      farmId,
      fieldId,
      setEvents,
      (err) => setError(err.message),
    )
  }, [farmId, fieldId])

  useEffect(() => {
    if (!totalEdited) setTotalPaid(workerCount * dailyWage)
  }, [workerCount, dailyWage, totalEdited])

  useEffect(() => {
    if (!editTotalEdited) {
      setEditTotalPaid(editWorkerCount * editDailyWage)
    }
  }, [editWorkerCount, editDailyWage, editTotalEdited])

  const latest = events[0] ?? null
  const preview = useMemo(() => events.slice(0, PREVIEW_LIMIT), [events])
  const byYear = useMemo(() => aggregateHoeByYear(events), [events])

  function startEdit(event: HoeEvent) {
    setEditingId(event.id)
    setEditDoneAt(event.doneAt.slice(0, 10))
    setEditWorkerCount(event.workerCount)
    setEditDailyWage(event.dailyWage)
    setEditTotalPaid(event.totalPaid)
    setEditTotalEdited(true)
    setEditNotes(event.notes ?? '')
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = createHoeSchema.safeParse({
      doneAt,
      workerCount,
      dailyWage,
      totalPaid,
      notes: notes || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Geçersiz form')
      return
    }
    setSaving(true)
    try {
      await createHoeEvent(farmId, fieldId, parsed.data, userId)
      setWorkerCount(1)
      setDailyWage(0)
      setTotalPaid(0)
      setTotalEdited(false)
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setError(null)
    const parsed = createHoeSchema.safeParse({
      doneAt: editDoneAt,
      workerCount: editWorkerCount,
      dailyWage: editDailyWage,
      totalPaid: editTotalPaid,
      notes: editNotes || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Geçersiz form')
      return
    }
    setSaving(true)
    try {
      await updateHoeEvent(farmId, fieldId, editingId, parsed.data)
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapseSection
      title="Çapalama"
      icon={<IconHoe />}
      tone="amber"
      bodyClassName="stack"
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="info-summary stack">
        <strong>Son Çapalama</strong>
        {latest ? (
          <dl className="summary-list">
            <dt>Tarih</dt>
            <dd>{latest.doneAt.slice(0, 10)}</dd>
            <dt>İşçi</dt>
            <dd>{latest.workerCount}</dd>
            <dt>Yevmiye</dt>
            <dd>{formatMoney(latest.dailyWage)}</dd>
            <dt>Toplam</dt>
            <dd>{formatMoney(latest.totalPaid)}</dd>
          </dl>
        ) : (
          <p className="muted small">Henüz Çapalama kaydı yok.</p>
        )}
      </div>

      <CollapseSection title="Çapalama Kaydı" icon={<IconSoil />} tone="olive">
        <form className="form-grid" onSubmit={onAdd}>
          <label>
            Çapalama tarihi
            <input
              type="date"
              value={doneAt}
              onChange={(e) => setDoneAt(e.target.value)}
              required
            />
          </label>
          <label>
            İşçi sayısı
            <input
              type="number"
              min={0}
              step={1}
              value={workerCount}
              onChange={(e) => {
                setTotalEdited(false)
                setWorkerCount(Number(e.target.value))
              }}
              required
            />
          </label>
          <label>
            Yevmiye
            <input
              type="number"
              min={0}
              step={0.01}
              value={dailyWage}
              onChange={(e) => {
                setTotalEdited(false)
                setDailyWage(Number(e.target.value))
              }}
              required
            />
          </label>
          <label>
            Toplam harcama
            <input
              type="number"
              min={0}
              step={0.01}
              value={totalPaid}
              onChange={(e) => {
                setTotalEdited(true)
                setTotalPaid(Number(e.target.value))
              }}
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
          <p className="muted small span-2">
            Toplam harcama varsayılan olarak işçi × yevmiye; istersen elle
            değiştirebilirsin.
          </p>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Çapalama ekle'}
          </button>
        </form>
      </CollapseSection>

      {byYear.length > 0 && (
        <CollapseSection
          title="Çapalama Kıyası (Yıllara Göre)"
          icon={<IconPie />}
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
                  <th>Ort. yevmiye</th>
                  <th>Toplam harcama</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...byYear].reverse().map((row) => (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <td>{row.count}</td>
                    <td>{formatMoney(row.avgDailyWage)}</td>
                    <td>{formatMoney(row.totalPaid)}</td>
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
        <SectionTitle as="h3" icon={<IconNotebook />} tone="olive">
          Çapalama Kayıtları
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
                      İşçi
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={editWorkerCount}
                        onChange={(e) => {
                          setEditTotalEdited(false)
                          setEditWorkerCount(Number(e.target.value))
                        }}
                        required
                      />
                    </label>
                    <label>
                      Yevmiye
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editDailyWage}
                        onChange={(e) => {
                          setEditTotalEdited(false)
                          setEditDailyWage(Number(e.target.value))
                        }}
                        required
                      />
                    </label>
                    <label>
                      Toplam
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editTotalPaid}
                        onChange={(e) => {
                          setEditTotalEdited(true)
                          setEditTotalPaid(Number(e.target.value))
                        }}
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
                    {item.doneAt.slice(0, 10)} · {item.workerCount} işçi ·{' '}
                    {formatMoney(item.dailyWage)} yevmiye · toplam{' '}
                    {formatMoney(item.totalPaid)}
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
                            'Bu Çapalama kaydı silinsin mi? Bu işlem geri alınamaz.',
                          )
                        ) {
                          return
                        }
                        void deleteHoeEvent(farmId, fieldId, item.id).catch(
                          (err) =>
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
          title="Çapalama Kıyası (Yıllara Göre)"
          onClose={() => setChartModalOpen(false)}
        >
          <YearlyHoeChart events={events} />
        </Modal>
      )}
    </CollapseSection>
  )
}
