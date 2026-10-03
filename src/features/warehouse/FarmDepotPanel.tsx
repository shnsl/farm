import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import { IconArea, IconTrash, IconWallet } from '../../components/Icons'
import { WheelSelect } from '../../components/WheelSelect'
import { WheelDateSelect } from '../../components/WheelDateSelect'
import {
  focusDomId,
  HighlightText,
  useFocusNav,
} from '../../lib/focusNav'
import type { SaleEvent, WarehouseStockItem } from '../../types'
import {
  addManualWarehouseStock,
  consolidateWarehouseStockCaseDuplicates,
  createManualStockSchema,
  createSale,
  createSaleSchema,
  deleteSale,
  deleteWarehouseStock,
  ensureFistikWarehouseSplit,
  normalizeSpeciesKey,
  saleEarnings,
  sameSpecies,
  subscribeSales,
  subscribeWarehouseStock,
  syncHarvestStockStartedAt,
} from './api'
import {
  formatStockAmount,
  isOliveOilStock,
  splitOliveOilTeneke,
  TENEKE_LITERS,
  tenekeToLiters,
} from './harvestProducts'

interface FarmDepotPanelProps {
  farmId: string
  userId: string
}

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function formatQty(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function formatSaleLine(
  item: Pick<SaleEvent, 'species' | 'soldKg' | 'unitPrice' | 'earnings'>,
): string {
  if (isOliveOilStock(item.species)) {
    const soldTeneke = item.soldKg / TENEKE_LITERS
    return `${formatQty(soldTeneke)} teneke · ${formatMoney(item.unitPrice)} ₺/teneke · ${formatMoney(item.earnings)} ₺`
  }
  return `${formatQty(item.soldKg)} kg · ${formatMoney(item.unitPrice)} ₺/kg · ${formatMoney(item.earnings)} ₺`
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

export function FarmDepotPanel({ farmId, userId }: FarmDepotPanelProps) {
  const [stock, setStock] = useState<WarehouseStockItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const focus = useFocusNav()

  const [doneAt, setDoneAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [species, setSpecies] = useState('')
  const [soldQty, setSoldQty] = useState(0)
  const [unitPrice, setUnitPrice] = useState(0)
  const [notes, setNotes] = useState('')
  const [pendingDeleteStock, setPendingDeleteStock] =
    useState<WarehouseStockItem | null>(null)
  const [deletingStock, setDeletingStock] = useState(false)

  const [manualName, setManualName] = useState('')
  const [manualKg, setManualKg] = useState(0)
  const [manualStartedAt, setManualStartedAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [manualNotes, setManualNotes] = useState('')
  const [savingManual, setSavingManual] = useState(false)

  useEffect(() => {
    return subscribeWarehouseStock(
      farmId,
      setStock,
      (err) => setError(err.message),
    )
  }, [farmId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await ensureFistikWarehouseSplit(farmId)
        await consolidateWarehouseStockCaseDuplicates(farmId)
        await syncHarvestStockStartedAt(farmId)
      } catch (err: unknown) {
        if (!cancelled) {
          console.error(err)
          setError(
            err instanceof Error
              ? err.message
              : 'Depo stok tarihleri güncellenemedi',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [farmId])

  const available = useMemo(() => {
    const merged = new Map<string, WarehouseStockItem>()
    for (const item of stock) {
      if (item.kg <= 0) continue
      const key = normalizeSpeciesKey(item.species)
      if (!key) continue
      const prev = merged.get(key)
      if (!prev) {
        merged.set(key, item)
        continue
      }
      const prevStarted = prev.startedAt?.slice(0, 10) || ''
      const nextStarted = item.startedAt?.slice(0, 10) || ''
      merged.set(key, {
        ...prev,
        kg: Number((prev.kg + item.kg).toFixed(2)),
        startedAt:
          prevStarted && nextStarted
            ? prevStarted < nextStarted
              ? prev.startedAt
              : item.startedAt
            : prev.startedAt || item.startedAt,
      })
    }
    return [...merged.values()].sort((a, b) =>
      a.species.localeCompare(b.species, 'tr'),
    )
  }, [stock])

  const selectedStock = available.find((s) => sameSpecies(s.species, species))
  const sellingOil = isOliveOilStock(species)
  const oilStock = sellingOil
    ? splitOliveOilTeneke(selectedStock?.kg ?? 0)
    : null
  const soldLitersOrKg = sellingOil ? tenekeToLiters(soldQty) : soldQty
  const earningsPreview = saleEarnings({
    soldKg: soldLitersOrKg,
    unitPrice,
    species,
  })

  useEffect(() => {
    if (available.length === 0) {
      setSpecies('')
      return
    }
    if (!available.some((s) => sameSpecies(s.species, species))) {
      setSpecies(available[0].species)
    }
  }, [available, species])

  async function onSell(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)

    const soldKg = sellingOil ? tenekeToLiters(soldQty) : soldQty
    const parsed = createSaleSchema.safeParse({
      doneAt,
      species,
      soldKg,
      unitPrice,
      notes: notes || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    if (sellingOil && oilStock && soldQty > oilStock.teneke) {
      setError(
        `Depoda yalnızca ${oilStock.teneke} teneke satılabilir (kalan ${formatQty(oilStock.remainderLt)} lt teneke doldurmuyor)`,
      )
      return
    }
    if (selectedStock && parsed.data.soldKg > selectedStock.kg + 0.001) {
      setError(
        sellingOil
          ? `Depoda yalnızca ${formatQty(oilStock?.teneke ?? 0)} teneke “${selectedStock.species}” var`
          : `Depoda yalnızca ${formatQty(selectedStock.kg)} kg “${selectedStock.species}” var`,
      )
      return
    }
    setSaving(true)
    try {
      await createSale(farmId, parsed.data, userId)
      setSoldQty(0)
      setUnitPrice(0)
      setNotes('')
      setInfo('Satış kaydedildi; stok güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Satış kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteStock() {
    if (!pendingDeleteStock) return
    setDeletingStock(true)
    setError(null)
    try {
      await deleteWarehouseStock(farmId, pendingDeleteStock.id)
      setInfo(`“${pendingDeleteStock.species}” depodan silindi.`)
      setPendingDeleteStock(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stok silinemedi')
    } finally {
      setDeletingStock(false)
    }
  }

  async function onAddManual(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createManualStockSchema.safeParse({
      species: manualName,
      kg: manualKg,
      startedAt: manualStartedAt,
      notes: manualNotes || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSavingManual(true)
    try {
      await addManualWarehouseStock(farmId, parsed.data, userId)
      setManualName('')
      setManualKg(0)
      setManualNotes('')
      setInfo(`“${parsed.data.species}” depoya eklendi; satıştan seçilebilir.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Depo ürünü eklenemedi')
    } finally {
      setSavingManual(false)
    }
  }

  return (
    <CollapseSection
      title="Depo"
      icon={<IconArea />}
      tone="olive"
      sectionId="depot"
      bodyClassName="stack"
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && <p className="success">{info}</p>}

      <p className="muted small">
        Hasattan gelen ürünler otomatik birikir. Ayrıca buğday gibi ürünleri elle
        ekleyebilirsin; hepsi aşağıdaki satış formundan satılabilir. Zeytinyağı
        hasat kaydındaki tane kg ÷ verim ile litredir; depoda aşağı yuvarlanmış
        teneke + kalan lt ve toplam lt gösterilir (1 teneke = {TENEKE_LITERS}{' '}
        lt).
      </p>

      <form className="form-grid" onSubmit={onAddManual}>
        <label className="span-2">
          Ürün adı
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Örn. Buğday"
            required
          />
        </label>
        <label>
          Tahmini stok (kg)
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={manualKg || ''}
            onChange={(e) => setManualKg(Number(e.target.value))}
            required
          />
        </label>
        <label>
          Stok başlangıç tarihi
          <WheelDateSelect
              title="Tarih"
              value={manualStartedAt}
              onChange={setManualStartedAt}
              required
            />
        </label>
        <label className="span-2">
          Not
          <input
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="Opsiyonel"
          />
        </label>
        <button
          className="btn primary"
          type="submit"
          disabled={savingManual}
        >
          {savingManual ? 'Ekleniyor…' : 'Depoya ekle'}
        </button>
      </form>

      {available.length === 0 ? (
        <p className="muted small">Depoda bekleyen ürün yok.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Stok</th>
                <th>Başlangıç</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {available.map((item) => (
                <tr
                  key={item.id}
                  data-focus-id={focusDomId('warehouseStock', item.id)}
                >
                  <td>
                    <HighlightText
                      text={item.species}
                      query={focus?.highlight}
                      active={focus?.isTarget('warehouseStock', item.id)}
                    />
                    {item.source === 'manual' ? (
                      <span className="muted small"> · elle</span>
                    ) : null}
                  </td>
                  <td>
                    <HighlightText
                      text={formatStockAmount(item.species, item.kg)}
                      query={focus?.highlight}
                      active={focus?.isTarget('warehouseStock', item.id)}
                    />
                  </td>
                  <td>
                    {item.startedAt ? (
                      <HighlightText
                        text={item.startedAt.slice(0, 10)}
                        query={focus?.highlight}
                        active={focus?.isTarget('warehouseStock', item.id)}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="table-row-actions">
                      <button
                        type="button"
                        className="btn ghost btn-icon"
                        aria-label={`${item.species} sil`}
                        title="Sil"
                        onClick={() => setPendingDeleteStock(item)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDeleteStock && (
        <Modal
          title="Depo ürünü silinsin mi?"
          onClose={() => setPendingDeleteStock(null)}
        >
          <div className="stack">
            <p>
              {pendingDeleteStock.species} ·{' '}
              {formatStockAmount(
                pendingDeleteStock.species,
                pendingDeleteStock.kg,
              )}
            </p>
            <p className="muted small">Bu işlem geri alınamaz.</p>
            <div className="bulk-actions">
              <button
                type="button"
                className="btn danger"
                disabled={deletingStock}
                onClick={() => void confirmDeleteStock()}
              >
                {deletingStock ? 'Siliniyor…' : 'Sil'}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={deletingStock}
                onClick={() => setPendingDeleteStock(null)}
              >
                İptal
              </button>
            </div>
          </div>
        </Modal>
      )}

      {available.length > 0 && (
        <form className="form-grid" onSubmit={onSell}>
          <label>
            Tarih
            <WheelDateSelect
              title="Tarih"
              value={doneAt}
              onChange={setDoneAt}
              required
            />
          </label>
          <label>
            Çeşit
            <WheelSelect
              title="Çeşit"
              value={species}
              required
              onChange={(v) => {
                setSpecies(v)
                setSoldQty(0)
              }}
              options={available.map((item) => ({
                value: item.species,
                label: `${item.species} (${formatStockAmount(item.species, item.kg)})`,
              }))}
            />
          </label>
          {sellingOil ? (
            <>
              <label>
                Satılan teneke
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={soldQty || ''}
                  onChange={(e) => setSoldQty(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Birim fiyat (₺/teneke)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Satılan kilo
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={soldQty || ''}
                  onChange={(e) => setSoldQty(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Birim fiyat (₺/kg)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  required
                />
              </label>
            </>
          )}
          <p className="muted small span-2">
            Satış: {formatMoney(earningsPreview)} ₺
            {selectedStock
              ? ` · depoda ${formatStockAmount(selectedStock.species, selectedStock.kg)}`
              : ''}
            {sellingOil && soldQty > 0
              ? ` · ${formatQty(tenekeToLiters(soldQty))} lt`
              : ''}
          </p>
          <label className="span-2">
            Not
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Satış kaydet'}
          </button>
        </form>
      )}
    </CollapseSection>
  )
}

interface FarmEarningsPanelProps {
  farmId: string
}

export function FarmEarningsPanel({ farmId }: FarmEarningsPanelProps) {
  const [sales, setSales] = useState<SaleEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SaleEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const focus = useFocusNav()

  useEffect(() => {
    return subscribeSales(farmId, setSales, (err) => setError(err.message))
  }, [farmId])

  const totalEarnings = useMemo(
    () => sales.reduce((sum, s) => sum + s.earnings, 0),
    [sales],
  )

  const byYear = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      const year = s.doneAt.slice(0, 4)
      if (!/^\d{4}$/.test(year)) continue
      map.set(year, (map.get(year) ?? 0) + s.earnings)
    }
    return [...map.entries()]
      .map(([year, earnings]) => ({ year, earnings }))
      .sort((a, b) => b.year.localeCompare(a.year))
  }, [sales])

  async function confirmDeleteSale(restoreToDepot: boolean) {
    if (!pendingDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteSale(farmId, pendingDelete.id, { restoreToDepot })
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <CollapseSection
      title="Satışlar"
      icon={<IconWallet />}
      tone="amber"
      sectionId="sales"
      bodyClassName="stack"
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="info-summary stack">
        <strong>Toplam satış</strong>
        <p>{formatMoney(totalEarnings)} ₺</p>
      </div>

      {byYear.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Yıl</th>
                <th>Satış (₺)</th>
              </tr>
            </thead>
            <tbody>
              {byYear.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{formatMoney(row.earnings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sales.length === 0 ? (
        <p className="muted small">Henüz satış kaydı yok.</p>
      ) : (
        <ul className="stack-gap">
          {(focus?.kind === 'sale' && focus.entityId
            ? sales
            : sales.slice(0, 12)
          ).map((item) => {
            const line = [
              item.doneAt.slice(0, 10),
              item.species,
              formatSaleLine(item),
              item.notes,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={item.id} data-focus-id={focusDomId('sale', item.id)}>
                <span>
                  <HighlightText
                    text={line}
                    query={focus?.highlight}
                    active={focus?.isTarget('sale', item.id)}
                  />
                </span>
                <div className="bulk-actions">
                  <button
                    type="button"
                    className="btn ghost btn-compact"
                    onClick={() => setPendingDelete(item)}
                  >
                    Sil
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {pendingDelete && (
        <Modal title="Satış silinsin mi?" onClose={() => setPendingDelete(null)}>
          <div className="stack">
            <p>
              {pendingDelete.doneAt.slice(0, 10)} · {pendingDelete.species} ·{' '}
              {formatSaleLine(pendingDelete)}
            </p>
            <p className="muted small">
              Silinen miktar depoya geri eklensin mi?
            </p>
            <div className="bulk-actions">
              <button
                type="button"
                className="btn primary"
                disabled={deleting}
                onClick={() => void confirmDeleteSale(true)}
              >
                {deleting ? 'Siliniyor…' : 'Depoya ekle ve sil'}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={deleting}
                onClick={() => void confirmDeleteSale(false)}
              >
                Sadece sil
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                İptal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </CollapseSection>
  )
}
