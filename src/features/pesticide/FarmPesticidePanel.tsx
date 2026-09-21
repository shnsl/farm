import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import { IconSpray, SectionTitle } from '../../components/Icons'
import { confirmDelete } from '../../lib/confirmDelete'
import type {
  Field,
  PesticideExpenseEvent,
  PesticideStockItem,
} from '../../types'
import {
  createPesticideExpense,
  createPesticideExpenseSchema,
  createPesticideStock,
  createPesticideStockSchema,
  deletePesticideExpense,
  deletePesticideStock,
  subscribePesticideExpenses,
  subscribePesticideStock,
  updatePesticideExpense,
  updatePesticideStock,
} from './api'
import { YearlyPesticideChart } from './YearlyPesticideChart'

interface FarmPesticidePanelProps {
  farmId: string
  userId: string
  fields?: Field[]
}

const PREVIEW_LIMIT = 6

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function formatQty(value: number): string {
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

export function FarmPesticidePanel({
  farmId,
  userId,
  fields = [],
}: FarmPesticidePanelProps) {
  const [stock, setStock] = useState<PesticideStockItem[]>([])
  const [expenses, setExpenses] = useState<PesticideExpenseEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [quantityPieces, setQuantityPieces] = useState(0)
  const [quantityMl, setQuantityMl] = useState(0)
  const [treeSpecies, setTreeSpecies] = useState('')
  const [doseWaterLiters, setDoseWaterLiters] = useState(0)
  const [stockNotes, setStockNotes] = useState('')

  const [expenseAt, setExpenseAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [expenseName, setExpenseName] = useState('')
  const [expenseCost, setExpenseCost] = useState(0)
  const [expenseNotes, setExpenseNotes] = useState('')

  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editPieces, setEditPieces] = useState(0)
  const [editMl, setEditMl] = useState(0)
  const [editSpecies, setEditSpecies] = useState('')
  const [editDose, setEditDose] = useState(0)
  const [editStockNotes, setEditStockNotes] = useState('')

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editExpenseAt, setEditExpenseAt] = useState('')
  const [editExpenseName, setEditExpenseName] = useState('')
  const [editExpenseCost, setEditExpenseCost] = useState(0)
  const [editExpenseNotes, setEditExpenseNotes] = useState('')
  const [editExpenseFieldId, setEditExpenseFieldId] = useState<
    string | undefined
  >(undefined)

  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)

  useEffect(() => {
    const unsubStock = subscribePesticideStock(
      farmId,
      setStock,
      (err) => setError(err.message),
    )
    const unsubExp = subscribePesticideExpenses(
      farmId,
      setExpenses,
      (err) => setError(err.message),
    )
    return () => {
      unsubStock()
      unsubExp()
    }
  }, [farmId])

  const totalExpense = useMemo(
    () => expenses.reduce((sum, e) => sum + e.cost, 0),
    [expenses],
  )

  async function onAddStock(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createPesticideStockSchema.safeParse({
      name,
      expiresAt,
      quantityPieces,
      quantityMl,
      treeSpecies,
      doseWaterLiters,
      notes: stockNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createPesticideStock(farmId, parsed.data, userId)
      setName('')
      setExpiresAt('')
      setQuantityPieces(0)
      setQuantityMl(0)
      setTreeSpecies('')
      setDoseWaterLiters(0)
      setStockNotes('')
      setInfo('İlaç stoğa eklendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stok eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onAddExpense(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createPesticideExpenseSchema.safeParse({
      doneAt: expenseAt,
      pesticideName: expenseName,
      cost: expenseCost,
      notes: expenseNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createPesticideExpense(farmId, parsed.data, userId)
      setExpenseName('')
      setExpenseCost(0)
      setExpenseNotes('')
      setInfo('İlaçlama masrafı eklendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Masraf eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  function startEditStock(item: PesticideStockItem) {
    setEditingStockId(item.id)
    setEditName(item.name)
    setEditExpiresAt(item.expiresAt.slice(0, 10))
    setEditPieces(item.quantityPieces)
    setEditMl(item.quantityMl)
    setEditSpecies(item.treeSpecies)
    setEditDose(item.doseWaterLiters)
    setEditStockNotes(item.notes ?? '')
  }

  async function onSaveStockEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingStockId) return
    setError(null)
    setInfo(null)
    const parsed = createPesticideStockSchema.safeParse({
      name: editName,
      expiresAt: editExpiresAt,
      quantityPieces: editPieces,
      quantityMl: editMl,
      treeSpecies: editSpecies,
      doseWaterLiters: editDose,
      notes: editStockNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await updatePesticideStock(farmId, editingStockId, parsed.data)
      setEditingStockId(null)
      setInfo('Stok kaydı güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  function startEditExpense(item: PesticideExpenseEvent) {
    setEditingExpenseId(item.id)
    setEditExpenseAt(item.doneAt.slice(0, 10))
    setEditExpenseName(item.pesticideName ?? '')
    setEditExpenseCost(item.cost)
    setEditExpenseNotes(item.notes ?? '')
    setEditExpenseFieldId(item.fieldId)
  }

  async function onSaveExpenseEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingExpenseId) return
    setError(null)
    setInfo(null)
    const parsed = createPesticideExpenseSchema.safeParse({
      doneAt: editExpenseAt,
      pesticideName: editExpenseName,
      cost: editExpenseCost,
      fieldId: editExpenseFieldId,
      notes: editExpenseNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await updatePesticideExpense(farmId, editingExpenseId, parsed.data)
      setEditingExpenseId(null)
      setEditExpenseFieldId(undefined)
      setInfo('Masraf kaydı güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  function renderStockItem(item: PesticideStockItem) {
    if (editingStockId === item.id) {
      return (
        <li key={item.id} className="fertilize-edit-item">
          <form className="form-grid" onSubmit={onSaveStockEdit}>
            <label>
              İlaç adı
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </label>
            <label>
              Miat
              <input
                type="date"
                value={editExpiresAt}
                onChange={(e) => setEditExpiresAt(e.target.value)}
                required
              />
            </label>
            <label>
              Tane
              <input
                type="number"
                min={0}
                step={1}
                value={editPieces}
                onChange={(e) => setEditPieces(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Mililitre (ml)
              <input
                type="number"
                min={0}
                step={0.01}
                value={editMl}
                onChange={(e) => setEditMl(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Ağaç çeşidi
              <input
                value={editSpecies}
                onChange={(e) => setEditSpecies(e.target.value)}
                required
              />
            </label>
            <label>
              Doz (lt su)
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={editDose}
                onChange={(e) => setEditDose(Number(e.target.value))}
                required
              />
            </label>
            <label className="span-2">
              Not
              <input
                value={editStockNotes}
                onChange={(e) => setEditStockNotes(e.target.value)}
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
                onClick={() => setEditingStockId(null)}
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
          <strong>{item.name}</strong>
          {' · '}
          miat {item.expiresAt.slice(0, 10)}
          {' · '}
          {formatQty(item.quantityPieces)} tane
          {' · '}
          {formatQty(item.quantityMl)} ml
          {' · '}
          {item.treeSpecies}
          {' · '}
          {formatQty(item.doseWaterLiters)} lt suya
          {item.notes ? ` · ${item.notes}` : ''}
        </span>
        <div className="bulk-actions">
          <button
            type="button"
            className="btn ghost btn-compact"
            disabled={saving}
            onClick={() => startEditStock(item)}
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
                  'Bu ilaç stoğu silinsin mi? Bu işlem geri alınamaz.',
                )
              ) {
                return
              }
              void deletePesticideStock(farmId, item.id).catch((err) =>
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

  function renderExpenseItem(item: PesticideExpenseEvent) {
    if (editingExpenseId === item.id) {
      return (
        <li key={item.id} className="fertilize-edit-item">
          <form className="form-grid" onSubmit={onSaveExpenseEdit}>
            <label>
              Tarih
              <input
                type="date"
                value={editExpenseAt}
                onChange={(e) => setEditExpenseAt(e.target.value)}
                required
              />
            </label>
            <label>
              İlaç adı
              <input
                value={editExpenseName}
                onChange={(e) => setEditExpenseName(e.target.value)}
                placeholder="Opsiyonel"
              />
            </label>
            <label>
              Masraf (₺)
              <input
                type="number"
                min={0}
                step={0.01}
                value={editExpenseCost}
                onChange={(e) => setEditExpenseCost(Number(e.target.value))}
                required
              />
            </label>
            <label className="span-2">
              Not
              <input
                value={editExpenseNotes}
                onChange={(e) => setEditExpenseNotes(e.target.value)}
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
                onClick={() => setEditingExpenseId(null)}
              >
                İptal
              </button>
            </div>
          </form>
        </li>
      )
    }

    const fieldName = item.fieldId
      ? fields.find((f) => f.id === item.fieldId)?.name
      : undefined

    return (
      <li key={item.id}>
        <span>
          {item.doneAt.slice(0, 10)}
          {fieldName ? ` · ${fieldName}` : ''}
          {item.pesticideName ? ` · ${item.pesticideName}` : ''}
          {' · '}
          {formatMoney(item.cost)}
          {item.notes ? ` · ${item.notes}` : ''}
        </span>
        <div className="bulk-actions">
          <button
            type="button"
            className="btn ghost btn-compact"
            disabled={saving}
            onClick={() => startEditExpense(item)}
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
                  'Bu ilaçlama masrafı silinsin mi? Bu işlem geri alınamaz.',
                )
              ) {
                return
              }
              void deletePesticideExpense(farmId, item.id).catch((err) =>
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

  const stockPreview = stock.slice(0, PREVIEW_LIMIT)
  const expensePreview = expenses.slice(0, PREVIEW_LIMIT)

  return (
    <CollapseSection
      title="Tarım İlaçları"
      icon={<IconSpray />}
      tone="teal"
      bodyClassName="stack"
    >
      <p className="muted small">
        Depoda bekleyen ilaç stoku ve yıllık ilaçlama masrafları. Çiftlik
        genelinde tutulur.
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
            <dt>Stok kalemi</dt>
            <dd>
              <strong>{stock.length}</strong>
            </dd>
            <dt>Toplam ilaçlama masrafı</dt>
            <dd>{formatMoney(totalExpense)}</dd>
          </dl>
        </div>
      </div>

      <CollapseSection title="Depo Stoğu" icon={<IconSpray />} tone="olive">
        <form className="form-grid" onSubmit={onAddStock}>
          <label>
            İlaç adı
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Bakır sülfat"
              required
            />
          </label>
          <label>
            Miat
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          </label>
          <label>
            Tane
            <input
              type="number"
              min={0}
              step={1}
              value={quantityPieces}
              onChange={(e) => setQuantityPieces(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Mililitre (ml)
            <input
              type="number"
              min={0}
              step={0.01}
              value={quantityMl}
              onChange={(e) => setQuantityMl(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Ağaç çeşidi
            <input
              value={treeSpecies}
              onChange={(e) => setTreeSpecies(e.target.value)}
              placeholder="Örn. Zeytin"
              required
            />
          </label>
          <label>
            Kullanım dozu (lt su)
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={doseWaterLiters}
              onChange={(e) => setDoseWaterLiters(Number(e.target.value))}
              required
            />
          </label>
          <label className="span-2">
            Not
            <input
              value={stockNotes}
              onChange={(e) => setStockNotes(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Stoğa ekle'}
          </button>
        </form>

        <div>
          <SectionTitle as="h3" icon={<IconSpray />} tone="olive">
            Eldeki İlaçlar
          </SectionTitle>
          {stock.length > PREVIEW_LIMIT && (
            <button
              type="button"
              className="btn ghost btn-compact"
              onClick={() => setStockModalOpen(true)}
            >
              Eski stok ({stock.length - PREVIEW_LIMIT})
            </button>
          )}
          {stock.length === 0 ? (
            <p className="muted small">Henüz depoda ilaç yok.</p>
          ) : (
            <ul className="event-list event-list-preview">
              {stockPreview.map(renderStockItem)}
            </ul>
          )}
        </div>
      </CollapseSection>

      <CollapseSection
        title="İlaçlama Masrafları"
        icon={<IconSpray />}
        tone="amber"
      >
        <form className="form-grid" onSubmit={onAddExpense}>
          <label>
            Tarih
            <input
              type="date"
              value={expenseAt}
              onChange={(e) => setExpenseAt(e.target.value)}
              required
            />
          </label>
          <label>
            İlaç adı
            <input
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder="Opsiyonel"
            />
          </label>
          <label>
            Masraf (₺)
            <input
              type="number"
              min={0}
              step={0.01}
              value={expenseCost}
              onChange={(e) => setExpenseCost(Number(e.target.value))}
              required
            />
          </label>
          <label className="span-2">
            Not
            <input
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Masraf ekle'}
          </button>
        </form>

        <YearlyPesticideChart events={expenses} />

        <div>
          <SectionTitle as="h3" icon={<IconSpray />} tone="amber">
            Masraf Kayıtları
          </SectionTitle>
          {expenses.length > PREVIEW_LIMIT && (
            <button
              type="button"
              className="btn ghost btn-compact"
              onClick={() => setExpenseModalOpen(true)}
            >
              Eski kayıtlar ({expenses.length - PREVIEW_LIMIT})
            </button>
          )}
          {expenses.length === 0 ? (
            <p className="muted small">Henüz ilaçlama masrafı yok.</p>
          ) : (
            <ul className="event-list event-list-preview">
              {expensePreview.map(renderExpenseItem)}
            </ul>
          )}
        </div>
      </CollapseSection>

      {stockModalOpen && (
        <Modal title="Eski İlaç Stoğu" onClose={() => setStockModalOpen(false)}>
          <ul className="event-list event-list-modal">
            {stock.slice(PREVIEW_LIMIT).map(renderStockItem)}
          </ul>
        </Modal>
      )}

      {expenseModalOpen && (
        <Modal
          title="Eski İlaçlama Masrafları"
          onClose={() => setExpenseModalOpen(false)}
        >
          <ul className="event-list event-list-modal">
            {expenses.slice(PREVIEW_LIMIT).map(renderExpenseItem)}
          </ul>
        </Modal>
      )}
    </CollapseSection>
  )
}
