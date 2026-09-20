import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import { IconFuel, SectionTitle } from '../../components/Icons'
import { confirmDelete } from '../../lib/confirmDelete'
import type { FuelEvent } from '../../types'
import {
  createFuelEvent,
  createFuelSchema,
  deleteFuelEvent,
  fuelPurchaseSummary,
  fuelTotalCost,
  subscribeFuelEvents,
  updateFuelEvent,
} from './api'
import { FuelPurchaseChart } from './FuelPurchaseChart'

interface FarmFuelPanelProps {
  farmId: string
  userId: string
}

const PREVIEW_LIMIT = 6

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function formatLiters(value: number): string {
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

export function FarmFuelPanel({ farmId, userId }: FarmFuelPanelProps) {
  const [events, setEvents] = useState<FuelEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [purchaseAt, setPurchaseAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [purchaseLiters, setPurchaseLiters] = useState(0)
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState(0)
  const [purchaseSource, setPurchaseSource] = useState('')
  const [purchaseNotes, setPurchaseNotes] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDoneAt, setEditDoneAt] = useState('')
  const [editLiters, setEditLiters] = useState(0)
  const [editUnitPrice, setEditUnitPrice] = useState(0)
  const [editSource, setEditSource] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    return subscribeFuelEvents(
      farmId,
      setEvents,
      (err) => setError(err.message),
    )
  }, [farmId])

  const summary = useMemo(() => fuelPurchaseSummary(events), [events])
  const purchasePreview = useMemo(
    () =>
      fuelTotalCost({
        liters: purchaseLiters,
        unitPrice: purchaseUnitPrice,
      }),
    [purchaseLiters, purchaseUnitPrice],
  )
  const editPreview = useMemo(
    () =>
      fuelTotalCost({ liters: editLiters, unitPrice: editUnitPrice }),
    [editLiters, editUnitPrice],
  )

  async function onAddPurchase(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createFuelSchema.safeParse({
      doneAt: purchaseAt,
      liters: purchaseLiters,
      unitPrice: purchaseUnitPrice,
      source: purchaseSource,
      notes: purchaseNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createFuelEvent(farmId, parsed.data, userId)
      setPurchaseLiters(0)
      setPurchaseUnitPrice(0)
      setPurchaseSource('')
      setPurchaseNotes('')
      setInfo('Yakıt alımı eklendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Alım eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(e: FuelEvent) {
    setEditingId(e.id)
    setEditDoneAt(e.doneAt.slice(0, 10))
    setEditLiters(e.liters)
    setEditUnitPrice(e.unitPrice ?? 0)
    setEditSource(e.source ?? '')
    setEditNotes(e.notes ?? '')
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    setError(null)
    setInfo(null)
    const parsed = createFuelSchema.safeParse({
      doneAt: editDoneAt,
      liters: editLiters,
      unitPrice: editUnitPrice,
      source: editSource,
      notes: editNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await updateFuelEvent(farmId, editingId, parsed.data)
      setEditingId(null)
      setInfo('Yakıt kaydı güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  function renderItem(e: FuelEvent) {
    if (editingId === e.id) {
      return (
        <li key={e.id} className="fertilize-edit-item">
          <form className="form-grid" onSubmit={onSaveEdit}>
            <label>
              Tarih
              <input
                type="date"
                value={editDoneAt}
                onChange={(ev) => setEditDoneAt(ev.target.value)}
                required
              />
            </label>
            <label>
              Litre (lt)
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={editLiters}
                onChange={(ev) => setEditLiters(Number(ev.target.value))}
                required
              />
            </label>
            <label>
              Birim fiyat (₺/lt)
              <input
                type="number"
                min={0}
                step={0.01}
                value={editUnitPrice}
                onChange={(ev) => setEditUnitPrice(Number(ev.target.value))}
                required
              />
            </label>
            <p className="muted small">Toplam: {formatMoney(editPreview)}</p>
            <label className="span-2">
              Nereden alındı
              <input
                value={editSource}
                onChange={(ev) => setEditSource(ev.target.value)}
                placeholder="Örn. Petrol Ofisi / istasyon adı"
              />
            </label>
            <label className="span-2">
              Not
              <input
                value={editNotes}
                onChange={(ev) => setEditNotes(ev.target.value)}
                placeholder="Veri girmek için dokunun.."
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
      <li key={e.id}>
        <span>
          {e.doneAt.slice(0, 10)} · {formatLiters(e.liters)} lt ·{' '}
          {formatMoney(e.unitPrice ?? 0)} ₺/lt · {formatMoney(e.totalCost ?? 0)}
          {e.source ? ` · ${e.source}` : ''}
          {e.notes ? ` · ${e.notes}` : ''}
        </span>
        <div className="bulk-actions">
          <button
            type="button"
            className="btn ghost btn-compact"
            disabled={saving}
            onClick={() => startEdit(e)}
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
                  'Bu yakıt kaydı silinsin mi? Bu işlem geri alınamaz.',
                )
              ) {
                return
              }
              void deleteFuelEvent(farmId, e.id).catch((err) =>
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

  const preview = events.slice(0, PREVIEW_LIMIT)

  return (
    <CollapseSection
      title="Yakıt"
      icon={<IconFuel />}
      tone="rose"
      bodyClassName="stack"
    >
      <p className="muted small">
        Tüm tarlalar için ortak yakıt alımları. Alım tarihine göre miktar ve
        fiyat karşılaştırması grafikte görülür.
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && <p className="success">{info}</p>}

      <div className="plow-stats-grid">
        <div className="plow-stat-card">
          <strong>Özet</strong>
          <dl className="summary-list">
            <dt>Alım sayısı</dt>
            <dd>{summary.count}</dd>
            <dt>Toplam litre</dt>
            <dd>
              <strong>{formatLiters(summary.purchased)} lt</strong>
            </dd>
            <dt>Toplam masraf</dt>
            <dd>{formatMoney(summary.spend)}</dd>
          </dl>
        </div>
      </div>

      <CollapseSection title="Yakıt Alımı" icon={<IconFuel />} tone="amber">
        <form className="form-grid" onSubmit={onAddPurchase}>
          <label>
            Alım zamanı
            <input
              type="date"
              value={purchaseAt}
              onChange={(e) => setPurchaseAt(e.target.value)}
              required
            />
          </label>
          <label>
            Litre (lt)
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={purchaseLiters}
              onChange={(e) => setPurchaseLiters(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Birim fiyat (₺/lt)
            <input
              type="number"
              min={0}
              step={0.01}
              value={purchaseUnitPrice}
              onChange={(e) => setPurchaseUnitPrice(Number(e.target.value))}
              required
            />
          </label>
          <p className="muted small">
            Toplam tutar: {formatMoney(purchasePreview)}
          </p>
          <label className="span-2">
            Nereden alındı
            <input
              value={purchaseSource}
              onChange={(e) => setPurchaseSource(e.target.value)}
              placeholder="Örn. Petrol Ofisi / istasyon adı"
            />
          </label>
          <label className="span-2">
            Not
            <input
              value={purchaseNotes}
              onChange={(e) => setPurchaseNotes(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Alım ekle'}
          </button>
        </form>
      </CollapseSection>

      <FuelPurchaseChart events={events} />

      <div>
        <SectionTitle as="h3" icon={<IconFuel />} tone="rose">
          Yakıt Alımları
        </SectionTitle>
        {events.length > PREVIEW_LIMIT && (
          <button
            type="button"
            className="btn ghost btn-compact"
            onClick={() => setModalOpen(true)}
          >
            Eski kayıtlar ({events.length - PREVIEW_LIMIT})
          </button>
        )}
        {events.length === 0 ? (
          <p className="muted small">Henüz yakıt alımı yok.</p>
        ) : (
          <ul className="event-list event-list-preview">
            {preview.map(renderItem)}
          </ul>
        )}
      </div>

      {modalOpen && (
        <Modal title="Eski Yakıt Alımları" onClose={() => setModalOpen(false)}>
          <ul className="event-list event-list-modal">
            {events.slice(PREVIEW_LIMIT).map(renderItem)}
          </ul>
        </Modal>
      )}
    </CollapseSection>
  )
}
