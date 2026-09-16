import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import {
  IconCompare,
  IconList,
  IconPrune,
  SectionTitle,
} from '../../components/Icons'
import {
  createPruneEvent,
  createPruneSchema,
  deletePruneEvent,
  pruneLaborCost,
  subscribePruneEvents,
  updatePruneEvent,
} from './api'
import { aggregatePruneByYear, YearlyPruneChart } from './YearlyPruneChart'
import { confirmDelete } from '../../lib/confirmDelete'
import type { PruneEvent } from '../../types'

interface FieldPrunePanelProps {
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

function formatDays(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
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

export function FieldPrunePanel({
  farmId,
  fieldId,
  userId,
}: FieldPrunePanelProps) {
  const [events, setEvents] = useState<PruneEvent[]>([])
  const [doneAt, setDoneAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [workerCount, setWorkerCount] = useState(1)
  const [foremanName, setForemanName] = useState('')
  const [foremanPhone, setForemanPhone] = useState('')
  const [dailyWage, setDailyWage] = useState(0)
  const [durationDays, setDurationDays] = useState(1)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDoneAt, setEditDoneAt] = useState('')
  const [editWorkerCount, setEditWorkerCount] = useState(1)
  const [editForemanName, setEditForemanName] = useState('')
  const [editForemanPhone, setEditForemanPhone] = useState('')
  const [editDailyWage, setEditDailyWage] = useState(0)
  const [editDurationDays, setEditDurationDays] = useState(1)
  const [editNotes, setEditNotes] = useState('')
  const [chartModalOpen, setChartModalOpen] = useState(false)

  useEffect(() => {
    return subscribePruneEvents(
      farmId,
      fieldId,
      setEvents,
      (err) => setError(err.message),
    )
  }, [farmId, fieldId])

  const latest = events[0] ?? null
  const preview = useMemo(() => events.slice(0, PREVIEW_LIMIT), [events])
  const byYear = useMemo(() => aggregatePruneByYear(events), [events])

  function startEdit(event: PruneEvent) {
    setEditingId(event.id)
    setEditDoneAt(event.doneAt.slice(0, 10))
    setEditWorkerCount(event.workerCount)
    setEditForemanName(event.foremanName)
    setEditForemanPhone(event.foremanPhone)
    setEditDailyWage(event.dailyWage)
    setEditDurationDays(event.durationDays)
    setEditNotes(event.notes ?? '')
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = createPruneSchema.safeParse({
      doneAt,
      workerCount,
      foremanName,
      foremanPhone,
      dailyWage,
      durationDays,
      notes: notes || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Geçersiz form')
      return
    }
    setSaving(true)
    try {
      await createPruneEvent(farmId, fieldId, parsed.data, userId)
      setForemanName('')
      setForemanPhone('')
      setDailyWage(0)
      setDurationDays(1)
      setWorkerCount(1)
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
    const parsed = createPruneSchema.safeParse({
      doneAt: editDoneAt,
      workerCount: editWorkerCount,
      foremanName: editForemanName,
      foremanPhone: editForemanPhone,
      dailyWage: editDailyWage,
      durationDays: editDurationDays,
      notes: editNotes || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Geçersiz form')
      return
    }
    setSaving(true)
    try {
      await updatePruneEvent(farmId, fieldId, editingId, parsed.data)
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel stack">
      <SectionTitle icon={<IconPrune />} tone="violet">
        Budama
      </SectionTitle>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="info-summary stack">
        <strong>Son Budama</strong>
        {latest ? (
          <dl className="summary-list">
            <dt>Tarih</dt>
            <dd>{latest.doneAt.slice(0, 10)}</dd>
            <dt>İşçi</dt>
            <dd>{latest.workerCount}</dd>
            <dt>Elçi</dt>
            <dd>
              {latest.foremanName}
              {latest.foremanPhone ? ` · ${latest.foremanPhone}` : ''}
            </dd>
            <dt>Yevmiye</dt>
            <dd>{formatMoney(latest.dailyWage)}</dd>
            <dt>Süre</dt>
            <dd>{formatDays(latest.durationDays)} gün</dd>
            <dt>Toplam</dt>
            <dd>{formatMoney(pruneLaborCost(latest))}</dd>
          </dl>
        ) : (
          <p className="muted small">Henüz Budama kaydı yok.</p>
        )}
      </div>

      <CollapseSection title="Budama Kaydı" icon={<IconPrune />} tone="violet">
        <form className="form-grid" onSubmit={onAdd}>
          <label>
            Budama tarihi
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
              min={1}
              step={1}
              value={workerCount}
              onChange={(e) => setWorkerCount(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Elçi adı
            <input
              value={foremanName}
              onChange={(e) => setForemanName(e.target.value)}
              placeholder="Veri girmek için dokunun.."
              required
            />
          </label>
          <label>
            Elçi telefonu
            <input
              type="tel"
              value={foremanPhone}
              onChange={(e) => setForemanPhone(e.target.value)}
              placeholder="Veri girmek için dokunun.."
              required
            />
          </label>
          <label>
            Yevmiye (işçi başı)
            <input
              type="number"
              min={0}
              step={0.01}
              value={dailyWage}
              onChange={(e) => setDailyWage(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Süre (gün)
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
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
            {saving ? 'Kaydediliyor…' : 'Budama ekle'}
          </button>
        </form>
      </CollapseSection>

      {byYear.length > 0 && (
        <CollapseSection
          title="Budama Kıyası (Yıllara Göre)"
          icon={<IconCompare />}
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
                  <th>Toplam gün</th>
                  <th>Toplam maliyet</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...byYear].reverse().map((row) => (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <td>{row.count}</td>
                    <td>{formatMoney(row.avgDailyWage)}</td>
                    <td>{formatDays(row.totalDays)}</td>
                    <td>{formatMoney(row.totalCost)}</td>
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
        <SectionTitle as="h3" icon={<IconList />} tone="olive">
          Budama Kayıtları
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
                        min={1}
                        step={1}
                        value={editWorkerCount}
                        onChange={(e) =>
                          setEditWorkerCount(Number(e.target.value))
                        }
                        required
                      />
                    </label>
                    <label>
                      Elçi
                      <input
                        value={editForemanName}
                        onChange={(e) => setEditForemanName(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Telefon
                      <input
                        type="tel"
                        value={editForemanPhone}
                        onChange={(e) => setEditForemanPhone(e.target.value)}
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
                        onChange={(e) =>
                          setEditDailyWage(Number(e.target.value))
                        }
                        required
                      />
                    </label>
                    <label>
                      Süre (gün)
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={editDurationDays}
                        onChange={(e) =>
                          setEditDurationDays(Number(e.target.value))
                        }
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
                    {item.foremanName} ({item.foremanPhone}) ·{' '}
                    {formatMoney(item.dailyWage)} yevmiye ·{' '}
                    {formatDays(item.durationDays)} gün · toplam{' '}
                    {formatMoney(pruneLaborCost(item))}
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
                            'Bu Budama kaydı silinsin mi? Bu işlem geri alınamaz.',
                          )
                        ) {
                          return
                        }
                        void deletePruneEvent(farmId, fieldId, item.id).catch(
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
          title="Budama Kıyası (Yıllara Göre)"
          onClose={() => setChartModalOpen(false)}
        >
          <YearlyPruneChart events={events} />
        </Modal>
      )}
    </section>
  )
}
