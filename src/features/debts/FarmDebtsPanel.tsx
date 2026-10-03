import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import {
  IconClipboard,
  IconPencil,
  IconTrash,
  IconWallet,
} from '../../components/Icons'
import { WheelSelect } from '../../components/WheelSelect'
import { WheelDateSelect } from '../../components/WheelDateSelect'
import { confirmDelete } from '../../lib/confirmDelete'
import {
  focusDomId,
  HighlightText,
  useFocusNav,
} from '../../lib/focusNav'
import type { DebtAssetType, DebtDirection, DebtEvent } from '../../types'
import {
  backfillDebtHistoricalRates,
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
  debtRateSummary,
  formatDebtAmount,
  markDebtPaid,
  markDebtUnpaid,
  subscribeDebtEvents,
  updateDebtEvent,
} from './api'
import {
  fetchMarketRates,
  formatTry,
  openDebtRateQuotes,
  sumOpenDebtsTry,
  todayIsoIstanbul,
  type MarketRates,
} from './marketRates'

interface FarmDebtsPanelProps {
  farmId: string
  userId: string
}

function todayIso(): string {
  return todayIsoIstanbul()
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
        <WheelSelect
          title="Borç türü"
          value={state.assetType}
          required
          onChange={(v) => {
            const next = v as DebtAssetType
            onChange('assetType', next)
            onChange('unit', defaultUnit(next))
          }}
          options={DEBT_ASSET_TYPES.map((type) => ({
            value: type,
            label: DEBT_ASSET_TYPE_LABELS[type],
          }))}
        />
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
            <WheelSelect
              title="Döviz türü"
              value={state.unit}
              required
              onChange={(v) => onChange('unit', v)}
              options={[
                ...DEBT_CURRENCY_OPTIONS.map((code) => ({
                  value: code,
                  label: code,
                })),
                ...(state.unit &&
                !(DEBT_CURRENCY_OPTIONS as readonly string[]).includes(
                  state.unit,
                )
                  ? [{ value: state.unit, label: state.unit }]
                  : []),
              ]}
            />
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
                onChange(
                  'amount',
                  Math.max(0, Math.round(Number(e.target.value))),
                )
              }
              required
            />
          </label>
          <label>
            Altın türü
            <WheelSelect
              title="Altın türü"
              value={state.unit}
              required
              onChange={(v) => onChange('unit', v)}
              options={[
                ...DEBT_GOLD_TYPE_OPTIONS.map((kind) => ({
                  value: kind,
                  label: kind,
                })),
                ...(state.unit &&
                !(DEBT_GOLD_TYPE_OPTIONS as readonly string[]).includes(
                  state.unit,
                )
                  ? [{ value: state.unit, label: state.unit }]
                  : []),
              ]}
            />
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
        <WheelDateSelect
          title="Tarih"
          value={state.takenAt}
          onChange={(v) => onChange('takenAt', v)}
          required
        />
      </label>
      <label>
        {debtPaidAtLabel(direction)}
        <WheelDateSelect
          title="Tarih"
          value={state.paidAt}
          onChange={(v) => onChange('paidAt', v)}
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

function personDisplay(item: DebtEvent): string {
  return item.counterparty?.trim() || 'Belirtilmedi'
}

/** Türkçe büyük/küçük harf duyarsız kişi anahtarı */
function personKey(item: DebtEvent): string {
  const display = personDisplay(item)
  if (display === 'Belirtilmedi') return display
  return display.toLocaleLowerCase('tr-TR')
}

function totalKey(item: DebtEvent): string {
  const unit = (item.unit ?? '').trim()
  const unitKey =
    item.assetType === 'gold'
      ? unit.toLocaleLowerCase('tr-TR')
      : unit.toLocaleUpperCase('tr-TR')
  return `${item.assetType}|${unitKey}`
}

/** Kart rengi: altın / USD / EUR / TL */
function debtToneClass(
  assetType: DebtAssetType,
  unit?: string | null,
): string {
  const parts = [`debt-type-${assetType}`]
  if (assetType === 'gold') {
    parts.push('debt-unit-gold')
    return parts.join(' ')
  }
  if (assetType !== 'cash' && assetType !== 'currency') {
    return parts.join(' ')
  }
  const code = (unit ?? '').trim().toLocaleUpperCase('tr-TR')
  if (code === 'USD') parts.push('debt-unit-usd')
  else if (code === 'EUR') parts.push('debt-unit-eur')
  else if (code === 'TRY' || code === 'TL') parts.push('debt-unit-try')
  return parts.join(' ')
}

function groupByPerson(items: DebtEvent[]): Array<{
  person: string
  items: DebtEvent[]
}> {
  const map = new Map<string, { person: string; items: DebtEvent[] }>()
  for (const item of items) {
    const key = personKey(item)
    const display = personDisplay(item)
    const group = map.get(key)
    if (group) {
      group.items.push(item)
      // Görünen ad: daha “düzgün” yazımı tercih et (küçük harf olmayan)
      if (
        display !== 'Belirtilmedi' &&
        group.person === group.person.toLocaleLowerCase('tr-TR') &&
        display !== display.toLocaleLowerCase('tr-TR')
      ) {
        group.person = display
      }
    } else {
      map.set(key, { person: display, items: [item] })
    }
  }
  return [...map.values()]
    .map((group) => ({
      person: group.person,
      items: [...group.items].sort((a, b) =>
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
      const current = items.find((i) => i.id === editingId)
      await updateDebtEvent(
        farmId,
        editingId,
        {
          assetType: parsed.data.assetType,
          amount: parsed.data.amount,
          unit: editForm.unit,
          counterparty: editForm.counterparty,
          takenAt: parsed.data.takenAt,
          paidAt: editForm.paidAt,
          notes: editForm.notes,
        },
        current,
      )
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
        <li key={item.id} className="debt-item debt-item--editing">
          <form className="form-grid debt-edit-form" onSubmit={onSaveEdit}>
            <DebtFields
              state={editForm}
              direction={direction}
              onChange={(key, value) =>
                setEditForm((prev) => ({ ...prev, [key]: value }))
              }
            />
            <div className="debt-item-actions span-2">
              <button
                className="debt-action debt-action--ok debt-action--label"
                type="submit"
                disabled={saving}
              >
                Kaydet
              </button>
              <button
                className="debt-action debt-action--label"
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
          debtToneClass(item.assetType, item.unit),
          item.paidAt ? 'is-paid' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-focus-id={focusDomId('debt', item.id)}
      >
        <div className="debt-item-main">
          <div className="debt-item-body">
            <div className="debt-item-topline">
              <span className="debt-type-badge">
                {DEBT_ASSET_TYPE_LABELS[item.assetType]}
              </span>
              <span
                className={`debt-status-chip${item.paidAt ? ' is-paid' : ' is-open'}`}
              >
                {item.paidAt
                  ? `Ödendi ${item.paidAt.slice(0, 10)}`
                  : 'Açık'}
              </span>
            </div>
            <span className="debt-item-text">
              <HighlightText
                text={[
                  formatDebtAmount(item),
                  item.takenAt.slice(0, 10),
                  item.notes,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                query={focus?.highlight}
                active={focus?.isTarget('debt', item.id)}
              />
            </span>
            {(() => {
              const summary = debtRateSummary(item)
              if (!summary) return null
              if (summary.kind === 'entry') {
                return (
                  <div className="debt-rate-diff">
                    <span>
                      Giriş kuru{' '}
                      <strong>
                        {summary.entryUnit.toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        ₺
                      </strong>
                      /birim
                    </span>
                    <span>
                      ≈{' '}
                      <strong>
                        {summary.entryTotal.toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        ₺
                      </strong>
                    </span>
                  </div>
                )
              }
              const diff = summary.diff ?? 0
              const sign = diff > 0 ? '+' : ''
              return (
                <div
                  className={`debt-rate-diff debt-rate-diff--paid${
                    diff > 0 ? ' is-gain' : diff < 0 ? ' is-loss' : ''
                  }`}
                >
                  <span>
                    Giriş{' '}
                    <strong>
                      {summary.entryTotal.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₺
                    </strong>
                    <span className="debt-rate-diff-unit">
                      (
                      {summary.entryUnit.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₺/birim)
                    </span>
                  </span>
                  <span>
                    Ödeme{' '}
                    <strong>
                      {(summary.paidTotal ?? 0).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₺
                    </strong>
                    <span className="debt-rate-diff-unit">
                      (
                      {(summary.paidUnit ?? 0).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₺/birim)
                    </span>
                  </span>
                  <span className="debt-rate-diff-fark">
                    Fark{' '}
                    <strong>
                      {sign}
                      {diff.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₺
                    </strong>
                  </span>
                </div>
              )
            })()}
          </div>
          <div className="debt-item-actions" role="group" aria-label="İşlemler">
            {!item.paidAt ? (
              <button
                type="button"
                className="debt-action debt-action--ok debt-action--label"
                disabled={saving}
                onClick={() => {
                  void markDebtPaid(farmId, item)
                    .then(() =>
                      onInfo(
                        'Ödendi olarak işaretlendi; kur farkı kaydedildi.',
                      ),
                    )
                    .catch((err) =>
                      onError(
                        err instanceof Error ? err.message : 'İşaretlenemedi',
                      ),
                    )
                }}
              >
                Ödendi
              </button>
            ) : (
              <button
                type="button"
                className="debt-action debt-action--label"
                disabled={saving}
                onClick={() => {
                  void markDebtUnpaid(farmId, item.id)
                    .then(() => onInfo('Ödeme işareti geri alındı.'))
                    .catch((err) =>
                      onError(
                        err instanceof Error
                          ? err.message
                          : 'Geri alınamadı',
                      ),
                    )
                }}
              >
                Geri al
              </button>
            )}
            <div className="debt-item-icon-actions">
              <button
                type="button"
                className="debt-action debt-action--icon"
                disabled={saving}
                aria-label="Düzenle"
                title="Düzenle"
                onClick={() => {
                  setEditingId(item.id)
                  setEditForm(formFromEvent(item))
                }}
              >
                <IconPencil />
              </button>
              <button
                type="button"
                className="debt-action debt-action--icon debt-action--danger"
                disabled={saving}
                aria-label="Sil"
                title="Sil"
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
                <IconTrash />
              </button>
            </div>
          </div>
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
      <header className="debts-list-col-head">
        <h3 className="debts-list-col-title">{title}</h3>
        <span className="debts-list-col-count">
          {items.length} kayıt
        </span>
      </header>

      {items.length === 0 ? (
        <p className="muted small debts-list-empty">Henüz kayıt yok.</p>
      ) : (
        <div className="debt-person-stack">
          {groups.map((group) => (
            <div key={group.person} className="debt-person-block">
              <div className="debt-person-head">
                <h4 className="debt-person-name">{group.person}</h4>
                <span className="debt-person-count">
                  {group.items.length}
                </span>
              </div>
              <ul className="event-list debt-person-items">
                {group.items.map(renderItem)}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="debt-totals">
        <div className="debt-totals-head">
          <strong>Toplam {title}</strong>
          <span className="muted small">yalnızca açık</span>
        </div>
        {totals.length === 0 ? (
          <p className="muted small">Açık borç yok.</p>
        ) : (
          <ul className="debt-totals-list">
            {totals.map((row) => (
              <li
                key={`${row.assetType}-${row.unit}`}
                className={`debt-total-row ${debtToneClass(row.assetType, row.unit)}`}
              >
                <span className="debt-type-badge">
                  {DEBT_ASSET_TYPE_LABELS[row.assetType]}
                </span>
                <span className="debt-total-label">{row.label}</span>
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
  const backfillDoneFor = useRef<string | null>(null)

  useEffect(() => {
    backfillDoneFor.current = null
    return subscribeDebtEvents(
      farmId,
      setItems,
      (err) => setError(err.message),
    )
  }, [farmId])

  useEffect(() => {
    if (items.length === 0) return
    if (backfillDoneFor.current === farmId) return
    backfillDoneFor.current = farmId
    void backfillDebtHistoricalRates(farmId, items).catch(() => {
      /* sessiz: canlı kur paneli yine çalışır */
    })
  }, [farmId, items])

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

  const debtRateQuotes = useMemo(
    () => (rates ? openDebtRateQuotes(items, rates) : []),
    [items, rates],
  )

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
              {debtRateQuotes.length > 0 && (
                <ul className="debt-rate-quotes">
                  {debtRateQuotes.map((q) => (
                    <li key={q.key}>
                      <span className="debt-rate-quotes-label">{q.label}</span>
                      <span className="debt-rate-quotes-prices">
                        {q.buy != null ? (
                          <>
                            Alış <strong>{formatTry(q.buy)}</strong>
                          </>
                        ) : (
                          <span className="muted">Alış —</span>
                        )}
                        <span className="debt-rate-quotes-sep" aria-hidden>
                          ·
                        </span>
                        {q.sell != null ? (
                          <>
                            Satış <strong>{formatTry(q.sell)}</strong>
                          </>
                        ) : (
                          <span className="muted">Satış —</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="debt-action"
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
