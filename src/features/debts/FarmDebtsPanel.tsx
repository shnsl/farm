import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import { IconClipboard, IconWallet } from '../../components/Icons'
import { confirmDelete } from '../../lib/confirmDelete'
import {
  focusDomId,
  HighlightText,
  useFocusNav,
} from '../../lib/focusNav'
import type { DebtAssetType, DebtDirection, DebtEvent } from '../../types'
import {
  createDebtEvent,
  createDebtSchema,
  debtCounterpartyLabel,
  debtPaidAtLabel,
  debtTakenAtLabel,
  DEBT_ASSET_TYPE_LABELS,
  DEBT_ASSET_TYPES,
  DEBT_CURRENCY_OPTIONS,
  DEBT_DIRECTION_LABELS,
  DEBT_GOLD_TYPE_OPTIONS,
  deleteDebtEvent,
  formatDebtAmount,
  markDebtPaid,
  subscribeDebtEvents,
  updateDebtEvent,
} from './api'
import {
  fetchMarketRates,
  formatTry,
  sumOpenDebtsTry,
  type MarketRates,
} from './marketRates'

interface FarmDebtsPanelProps {
  farmId: string
  userId: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultUnit(assetType: DebtAssetType): string {
  if (assetType === 'cash') return 'TRY'
  if (assetType === 'currency') return 'USD'
  if (assetType === 'gold') return 'Çeyrek'
  return ''
}

interface DebtFormState {
  assetType: DebtAssetType
  amount: number
  unit: string
  counterparty: string
  takenAt: string
  paidAt: string
  notes: string
}

function emptyForm(): DebtFormState {
  return {
    assetType: 'currency',
    amount: 0,
    unit: defaultUnit('currency'),
    counterparty: '',
    takenAt: todayIso(),
    paidAt: '',
    notes: '',
  }
}

function formFromEvent(item: DebtEvent): DebtFormState {
  return {
    assetType: item.assetType,
    amount: item.amount,
    unit: item.unit ?? defaultUnit(item.assetType),
    counterparty: item.counterparty ?? '',
    takenAt: item.takenAt.slice(0, 10),
    paidAt: item.paidAt?.slice(0, 10) ?? '',
    notes: item.notes ?? '',
  }
}

function DebtFields({
  state,
  direction,
  onChange,
}: {
  state: DebtFormState
  direction: DebtDirection
  onChange: <K extends keyof DebtFormState>(
    key: K,
    value: DebtFormState[K],
  ) => void
}) {
  const moneyLike =
    state.assetType === 'cash' || state.assetType === 'currency'
  const isGold = state.assetType === 'gold'
  const isOther = state.assetType === 'other'

  return (
    <>
      <label>
        Borç türü
        <select
          value={state.assetType}
          onChange={(e) => {
            const next = e.target.value as DebtAssetType
            onChange('assetType', next)
            onChange('unit', defaultUnit(next))
          }}
          required
        >
          {DEBT_ASSET_TYPES.map((type) => (
            <option key={type} value={type}>
              {DEBT_ASSET_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      {moneyLike && (
        <>
          <label>
            Miktar
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={state.amount || ''}
              onChange={(e) => onChange('amount', Number(e.target.value))}
              required
            />
          </label>
          <label>
            Döviz türü
            <select
              value={state.unit}
              onChange={(e) => onChange('unit', e.target.value)}
              required
            >
              {DEBT_CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
              {state.unit &&
                !(DEBT_CURRENCY_OPTIONS as readonly string[]).includes(
                  state.unit,
                ) && <option value={state.unit}>{state.unit}</option>}
            </select>
          </label>
        </>
      )}

      {isGold && (
        <>
          <label>
            Adet
            <input
              type="number"
              min={1}
              step={1}
              value={state.amount || ''}
              onChange={(e) =>
                onChange('amount', Math.max(0, Math.round(Number(e.target.value))))
              }
              required
            />
          </label>
          <label>
            Altın türü
            <select
              value={state.unit}
              onChange={(e) => onChange('unit', e.target.value)}
              required
            >
              {DEBT_GOLD_TYPE_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
              {state.unit &&
                !(DEBT_GOLD_TYPE_OPTIONS as readonly string[]).includes(
                  state.unit,
                ) && <option value={state.unit}>{state.unit}</option>}
            </select>
          </label>
        </>
      )}

      {isOther && (
        <>
          <label>
            Miktar
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={state.amount || ''}
              onChange={(e) => onChange('amount', Number(e.target.value))}
              required
            />
          </label>
          <label>
            Tür / açıklama
            <input
              value={state.unit}
              onChange={(e) => onChange('unit', e.target.value)}
              placeholder="Örn. mal, hizmet"
            />
          </label>
        </>
      )}

      <label>
        {debtCounterpartyLabel(direction)}
        <input
          value={state.counterparty}
          onChange={(e) => onChange('counterparty', e.target.value)}
          placeholder="İsim / kurum"
        />
      </label>
      <label>
        {debtTakenAtLabel(direction)}
        <input
          type="date"
          value={state.takenAt}
          onChange={(e) => onChange('takenAt', e.target.value)}
          required
        />
      </label>
      <label>
        {debtPaidAtLabel(direction)}
        <input
          type="date"
          value={state.paidAt}
          onChange={(e) => onChange('paidAt', e.target.value)}
        />
      </label>
      <label className="span-2">
        Notlar
        <input
          value={state.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          placeholder="Opsiyonel"
        />
      </label>
    </>
  )
}

function DebtEntryForm({
  farmId,
  userId,
  direction,
  onError,
  onInfo,
}: {
  farmId: string
  userId: string
  direction: DebtDirection
  onError: (message: string | null) => void
  onInfo: (message: string | null) => void
}) {
  const [form, setForm] = useState<DebtFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const title = DEBT_DIRECTION_LABELS[direction]

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    onError(null)
    onInfo(null)
    const parsed = createDebtSchema.safeParse({
      direction,
      assetType: form.assetType,
      amount: form.amount,
      unit: form.unit || undefined,
      counterparty: form.counterparty || undefined,
      takenAt: form.takenAt,
      paidAt: form.paidAt || undefined,
      notes: form.notes || undefined,
    })
    if (!parsed.success) {
      onError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createDebtEvent(farmId, parsed.data, userId)
      setForm(emptyForm())
      onInfo(`${title} kaydı eklendi.`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapseSection
      title={title}
      icon={<IconWallet />}
      tone={direction === 'receivable' ? 'green' : 'amber'}
      sectionId={
        direction === 'receivable'
          ? 'debts-entry-receivable'
          : 'debts-entry-payable'
      }
      bodyClassName="stack"
    >
      <form className="form-grid" onSubmit={onCreate}>
        <DebtFields
          state={form}
          direction={direction}
          onChange={(key, value) =>
            setForm((prev) => ({ ...prev, [key]: value }))
          }
        />
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>
    </CollapseSection>
  )
}

function personKey(item: DebtEvent): string {
  return item.counterparty?.trim() || 'Belirtilmedi'
}

function totalKey(item: DebtEvent): string {
  return `${item.assetType}|${(item.unit ?? '').trim()}`
}

function groupByPerson(items: DebtEvent[]): Array<{
  person: string
  items: DebtEvent[]
}> {
  const map = new Map<string, DebtEvent[]>()
  for (const item of items) {
    const key = personKey(item)
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  return [...map.entries()]
    .map(([person, groupItems]) => ({
      person,
      items: [...groupItems].sort((a, b) =>
        b.takenAt.localeCompare(a.takenAt),
      ),
    }))
    .sort((a, b) => a.person.localeCompare(b.person, 'tr'))
}

/** Açık (ödenmemiş) kayıtları aynı tür+birim içinde toplar */
function buildTypeTotals(items: DebtEvent[]): Array<{
  assetType: DebtAssetType
  unit: string
  amount: number
  label: string
}> {
  const open = items.filter((i) => !i.paidAt)
  const map = new Map<
    string,
    { assetType: DebtAssetType; unit: string; amount: number }
  >()
  for (const item of open) {
    const key = totalKey(item)
    const add =
      item.assetType === 'gold' ? Math.round(item.amount) : item.amount
    const current = map.get(key)
    if (current) current.amount += add
    else {
      map.set(key, {
        assetType: item.assetType,
        unit: (item.unit ?? '').trim(),
        amount: add,
      })
    }
  }
  return [...map.values()]
    .map((row) => {
      const amount =
        row.assetType === 'gold'
          ? Math.round(row.amount)
          : Number(row.amount.toFixed(2))
      return {
        ...row,
        amount,
        label: formatDebtAmount({
          amount,
          unit: row.unit || undefined,
          assetType: row.assetType,
        }),
      }
    })
    .sort((a, b) => {
      const byType =
        DEBT_ASSET_TYPES.indexOf(a.assetType) -
        DEBT_ASSET_TYPES.indexOf(b.assetType)
      if (byType !== 0) return byType
      return a.unit.localeCompare(b.unit, 'tr')
    })
}

function DebtDirectionColumn({
  farmId,
  direction,
  items,
  onError,
  onInfo,
}: {
  farmId: string
  direction: DebtDirection
  items: DebtEvent[]
  onError: (message: string | null) => void
  onInfo: (message: string | null) => void
}) {
  const focus = useFocusNav()
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<DebtFormState>(emptyForm)
  const title = DEBT_DIRECTION_LABELS[direction]
  const groups = useMemo(() => groupByPerson(items), [items])
  const totals = useMemo(() => buildTypeTotals(items), [items])

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    onError(null)
    onInfo(null)
    const parsed = createDebtSchema.safeParse({
      direction,
      assetType: editForm.assetType,
      amount: editForm.amount,
      unit: editForm.unit || undefined,
      counterparty: editForm.counterparty || undefined,
      takenAt: editForm.takenAt,
      paidAt: editForm.paidAt || undefined,
      notes: editForm.notes || undefined,
    })
    if (!parsed.success) {
      onError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await updateDebtEvent(farmId, editingId, {
        assetType: parsed.data.assetType,
        amount: parsed.data.amount,
        unit: editForm.unit,
        counterparty: editForm.counterparty,
        takenAt: parsed.data.takenAt,
        paidAt: editForm.paidAt,
        notes: editForm.notes,
      })
      setEditingId(null)
      onInfo('Borç kaydı güncellendi.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  function renderItem(item: DebtEvent) {
    if (editingId === item.id) {
      return (
        <li key={item.id} className="debt-item fertilize-edit-item">
          <form className="form-grid" onSubmit={onSaveEdit}>
            <DebtFields
              state={editForm}
              direction={direction}
              onChange={(key, value) =>
                setEditForm((prev) => ({ ...prev, [key]: value }))
              }
            />
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
      <li
        key={item.id}
        className={[
          'debt-item',
          `debt-type-${item.assetType}`,
          item.paidAt ? 'is-paid' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-focus-id={focusDomId('debt', item.id)}
      >
        <span className="debt-item-body">
          <span className="debt-type-badge">
            {DEBT_ASSET_TYPE_LABELS[item.assetType]}
          </span>
          <HighlightText
            text={[
              formatDebtAmount(item),
              item.takenAt.slice(0, 10),
              item.paidAt ? `ödendi ${item.paidAt.slice(0, 10)}` : 'açık',
              item.notes,
            ]
              .filter(Boolean)
              .join(' · ')}
            query={focus?.highlight}
            active={focus?.isTarget('debt', item.id)}
          />
        </span>
        <div className="bulk-actions">
          {!item.paidAt && (
            <button
              type="button"
              className="btn ghost btn-compact"
              disabled={saving}
              onClick={() => {
                void markDebtPaid(farmId, item.id).catch((err) =>
                  onError(
                    err instanceof Error ? err.message : 'İşaretlenemedi',
                  ),
                )
              }}
            >
              Ödendi
            </button>
          )}
          <button
            type="button"
            className="btn ghost btn-compact"
            disabled={saving}
            onClick={() => {
              setEditingId(item.id)
              setEditForm(formFromEvent(item))
            }}
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
                  'Bu borç kaydı silinsin mi? Bu işlem geri alınamaz.',
                )
              ) {
                return
              }
              void deleteDebtEvent(farmId, item.id).catch((err) =>
                onError(err instanceof Error ? err.message : 'Silinemedi'),
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
    <section
      className={`debts-list-col debts-list-col-${direction}`}
      data-section-id={
        direction === 'receivable'
          ? 'debts-list-receivable'
          : 'debts-list-payable'
      }
    >
      <h3 className="debts-list-col-title">{title}</h3>
      <p className="muted small debts-list-col-hint">
        {direction === 'receivable' ? 'Kime göre' : 'Kimden göre'}
      </p>

      {items.length === 0 ? (
        <p className="muted small">Henüz kayıt yok.</p>
      ) : (
        <div className="debt-person-stack">
          {groups.map((group) => (
            <div key={group.person} className="debt-person-block">
              <h4 className="debt-person-name">{group.person}</h4>
              <ul className="event-list debt-person-items">
                {group.items.map(renderItem)}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="debt-totals">
        <strong>Toplam {title}</strong>
        {totals.length === 0 ? (
          <p className="muted small">Açık borç yok.</p>
        ) : (
          <ul className="debt-totals-list">
            {totals.map((row) => (
              <li
                key={`${row.assetType}-${row.unit}`}
                className={`debt-total-row debt-type-${row.assetType}`}
              >
                <span className="debt-type-badge">
                  {DEBT_ASSET_TYPE_LABELS[row.assetType]}
                </span>
                <span>{row.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function FarmDebtsPanel({ farmId, userId }: FarmDebtsPanelProps) {
  const [items, setItems] = useState<DebtEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [rates, setRates] = useState<MarketRates | null>(null)
  const [ratesError, setRatesError] = useState<string | null>(null)
  const [ratesLoading, setRatesLoading] = useState(false)

  useEffect(() => {
    return subscribeDebtEvents(
      farmId,
      setItems,
      (err) => setError(err.message),
    )
  }, [farmId])

  useEffect(() => {
    let cancelled = false
    setRatesLoading(true)
    void fetchMarketRates()
      .then((next) => {
        if (!cancelled) {
          setRates(next)
          setRatesError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRatesError(
            err instanceof Error
              ? err.message
              : 'Güncel kur / altın fiyatı alınamadı',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const receivables = useMemo(
    () => items.filter((i) => i.direction === 'receivable'),
    [items],
  )
  const payables = useMemo(
    () => items.filter((i) => i.direction === 'payable'),
    [items],
  )

  const receivableTry = useMemo(
    () => (rates ? sumOpenDebtsTry(receivables, rates) : null),
    [rates, receivables],
  )
  const payableTry = useMemo(
    () => (rates ? sumOpenDebtsTry(payables, rates) : null),
    [rates, payables],
  )
  const netTry =
    receivableTry && payableTry
      ? Number((receivableTry.totalTry - payableTry.totalTry).toFixed(2))
      : null

  return (
    <>
      <CollapseSection
        title="Borç Girişi"
        icon={<IconWallet />}
        tone="rose"
        sectionId="debts-entry"
        bodyClassName="stack"
      >
        <p className="muted small">
          Yeni alacak veya verecek kaydı ekle. Kayıtlar Borçlar Listesi’nde
          görünür.
        </p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {info && <p className="success">{info}</p>}

        <DebtEntryForm
          farmId={farmId}
          userId={userId}
          direction="receivable"
          onError={setError}
          onInfo={setInfo}
        />
        <DebtEntryForm
          farmId={farmId}
          userId={userId}
          direction="payable"
          onError={setError}
          onInfo={setInfo}
        />
      </CollapseSection>

      <CollapseSection
        title="Borçlar Listesi"
        icon={<IconClipboard />}
        tone="olive"
        sectionId="debts-list"
        defaultOpen
        bodyClassName="stack"
      >
        <p className="muted small">
          Alacak ve verecekler kişiye göre gruplanır. Toplamlar açık (ödenmemiş)
          kayıtların aynı türlerini birleştirir. TL karşılıkları güncel döviz /
          altın fiyatından hesaplanır.
        </p>

        <div className="debts-list-grid">
          <DebtDirectionColumn
            farmId={farmId}
            direction="receivable"
            items={receivables}
            onError={setError}
            onInfo={setInfo}
          />
          <DebtDirectionColumn
            farmId={farmId}
            direction="payable"
            items={payables}
            onError={setError}
            onInfo={setInfo}
          />
        </div>

        <div className="debt-tl-summary">
          <h3 className="debt-tl-summary-title">TL cinsinden açık borçlar</h3>
          {ratesLoading && !rates ? (
            <p className="muted small">Güncel kurlar yükleniyor…</p>
          ) : ratesError && !rates ? (
            <p className="error" role="alert">
              {ratesError}
            </p>
          ) : rates && receivableTry && payableTry ? (
            <>
              <ul className="debt-tl-summary-grid">
                <li className="debt-tl-card debt-tl-receivable">
                  <span className="muted small">Alacaklarım</span>
                  <strong>{formatTry(receivableTry.totalTry)}</strong>
                </li>
                <li className="debt-tl-card debt-tl-payable">
                  <span className="muted small">Vereceklerim</span>
                  <strong>{formatTry(payableTry.totalTry)}</strong>
                </li>
                <li className="debt-tl-card debt-tl-net">
                  <span className="muted small">Net (alacak − verecek)</span>
                  <strong
                    className={
                      netTry !== null && netTry < 0 ? 'is-negative' : undefined
                    }
                  >
                    {formatTry(netTry ?? 0)}
                  </strong>
                </li>
              </ul>
              <p className="muted small">
                Kaynak: {rates.source}
                {rates.updatedAt
                  ? ` · güncelleme ${rates.updatedAt}`
                  : ''}
                . Alacak alış, verecek satış fiyatıyla çevrilir. “Diğer” türü
                ve fiyatı bulunamayan kalemler TL toplamına dahil edilmez
                {receivableTry.skipped + payableTry.skipped > 0
                  ? ` (${receivableTry.skipped + payableTry.skipped} kalem atlandı)`
                  : ''}
                .
              </p>
              <button
                type="button"
                className="btn ghost btn-compact"
                disabled={ratesLoading}
                onClick={() => {
                  setRatesLoading(true)
                  void fetchMarketRates(true)
                    .then((next) => {
                      setRates(next)
                      setRatesError(null)
                    })
                    .catch((err: unknown) =>
                      setRatesError(
                        err instanceof Error
                          ? err.message
                          : 'Kurlar yenilenemedi',
                      ),
                    )
                    .finally(() => setRatesLoading(false))
                }}
              >
                {ratesLoading ? 'Yenileniyor…' : 'Kurları yenile'}
              </button>
            </>
          ) : (
            <p className="muted small">TL özeti için kur bekleniyor…</p>
          )}
        </div>
      </CollapseSection>
    </>
  )
}
