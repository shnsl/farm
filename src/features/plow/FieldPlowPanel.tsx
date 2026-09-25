import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import {
  HeadingIcon,
  IconChart,
  IconFurrows,
  IconHarvest,
  IconList,
  IconPlow,
} from '../../components/Icons'
import {
  buildPlowStatPeriods,
  createHarvestEvent,
  createHarvestSchema,
  createPlowEvent,
  createPlowSchema,
  deleteHarvestEvent,
  deletePlowEvent,
  PLOW_DIRECTION_LABELS,
  subscribeHarvestEvents,
  subscribePlowEvents,
  updateHarvestEvent,
} from './api'
import { YearlyHarvestChart } from './YearlyHarvestChart'
import {
  defaultHarvestSpecies,
  HarvestSpeciesInput,
} from '../warehouse/HarvestSpeciesInput'
import {
  isOliveTreeSpecies,
  oliveOilLitersFromHarvest,
} from '../warehouse/harvestProducts'
import { confirmDelete } from '../../lib/confirmDelete'
import type {
  HarvestEvent,
  PlowDirection,
  PlowEvent,
} from '../../types'
import { PLOW_EQUIPMENT_OPTIONS } from '../../types'

const EQUIPMENT_OTHER = '__other__'

interface FieldPlowPanelProps {
  farmId: string
  fieldId: string
  userId: string
  /** Tarla varsayılan çeşidi (hasat / depo) */
  defaultSpecies?: string
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
          <button type="button" className="btn ghost btn-compact" onClick={onClose}>
            Kapat
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function FieldPlowPanel({
  farmId,
  fieldId,
  userId,
  defaultSpecies = '',
}: FieldPlowPanelProps) {
  const [plows, setPlows] = useState<PlowEvent[]>([])
  const [harvests, setHarvests] = useState<HarvestEvent[]>([])
  const [plowDate, setPlowDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [direction, setDirection] = useState<PlowDirection>('enine')
  const [equipmentChoice, setEquipmentChoice] = useState<string>(
    PLOW_EQUIPMENT_OPTIONS[0],
  )
  const [equipmentOther, setEquipmentOther] = useState('')
  const [plowNotes, setPlowNotes] = useState('')
  const [harvestDate, setHarvestDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [workerCount, setWorkerCount] = useState(0)
  const [dailyWage, setDailyWage] = useState(0)
  const [totalPaid, setTotalPaid] = useState(0)
  const [totalEdited, setTotalEdited] = useState(false)
  const [estimatedKg, setEstimatedKg] = useState('')
  const [harvestVerim, setHarvestVerim] = useState('')
  const [harvestSpecies, setHarvestSpecies] = useState(() =>
    defaultHarvestSpecies(defaultSpecies),
  )
  const [harvestNotes, setHarvestNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingHarvestId, setEditingHarvestId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editWorkers, setEditWorkers] = useState(0)
  const [editWage, setEditWage] = useState(0)
  const [editTotal, setEditTotal] = useState(0)
  const [editTotalEdited, setEditTotalEdited] = useState(true)
  const [editKg, setEditKg] = useState('')
  const [editVerim, setEditVerim] = useState('')
  const [editSpecies, setEditSpecies] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [plowModalOpen, setPlowModalOpen] = useState(false)
  const [harvestModalOpen, setHarvestModalOpen] = useState(false)
  const [chartModalOpen, setChartModalOpen] = useState(false)

  useEffect(() => {
    setHarvestSpecies(defaultHarvestSpecies(defaultSpecies))
  }, [defaultSpecies])

  useEffect(() => {
    const unsubPlow = subscribePlowEvents(
      farmId,
      fieldId,
      setPlows,
      (err) => setError(err.message),
    )
    const unsubHarvest = subscribeHarvestEvents(
      farmId,
      fieldId,
      setHarvests,
      (err) => setError(err.message),
    )
    return () => {
      unsubPlow()
      unsubHarvest()
    }
  }, [farmId, fieldId])

  useEffect(() => {
    if (totalEdited) return
    setTotalPaid(Number((workerCount * dailyWage).toFixed(2)))
  }, [workerCount, dailyWage, totalEdited])

  useEffect(() => {
    if (editTotalEdited) return
    setEditTotal(Number((editWorkers * editWage).toFixed(2)))
  }, [editWorkers, editWage, editTotalEdited])

  const periods = useMemo(
    () => buildPlowStatPeriods(plows, harvests),
    [plows, harvests],
  )

  const isOliveField = isOliveTreeSpecies(defaultSpecies)
  const harvestOilPreview = useMemo(() => {
    if (!isOliveField) return 0
    const kg = Number(estimatedKg)
    const verim = Number(harvestVerim)
    return oliveOilLitersFromHarvest(kg, verim)
  }, [isOliveField, estimatedKg, harvestVerim])

  const harvestByYear = useMemo(() => {
    return [...harvests].sort((a, b) => b.doneAt.localeCompare(a.doneAt))
  }, [harvests])

  function startEditHarvest(h: HarvestEvent) {
    setEditingHarvestId(h.id)
    setEditDate(h.doneAt.slice(0, 10))
    setEditWorkers(h.workerCount)
    setEditWage(h.dailyWage)
    setEditTotal(h.totalPaid)
    setEditTotalEdited(true)
    setEditKg(h.estimatedKg !== undefined ? String(h.estimatedKg) : '')
    setEditVerim(h.verim !== undefined ? String(h.verim) : '')
    setEditSpecies(h.species ?? defaultHarvestSpecies(defaultSpecies))
    setEditNotes(h.notes ?? '')
    setError(null)
    setInfo(null)
  }

  function cancelEditHarvest() {
    setEditingHarvestId(null)
  }

  async function onAddPlow(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createPlowSchema.safeParse({
      doneAt: plowDate,
      direction,
      equipment:
        equipmentChoice === EQUIPMENT_OTHER
          ? equipmentOther
          : equipmentChoice,
      notes: plowNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createPlowEvent(farmId, fieldId, parsed.data, userId)
      setPlowNotes('')
      setEquipmentOther('')
      setEquipmentChoice(PLOW_EQUIPMENT_OPTIONS[0])
      setInfo(
        `${PLOW_DIRECTION_LABELS[parsed.data.direction]} sürüm kaydı eklendi.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sürüm eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onAddHarvest(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    const parsed = createHarvestSchema.safeParse({
      doneAt: harvestDate,
      workerCount,
      dailyWage,
      totalPaid,
      estimatedKg: estimatedKg === '' ? undefined : Number(estimatedKg),
      verim:
        isOliveField && harvestVerim !== ''
          ? Number(harvestVerim)
          : undefined,
      species: harvestSpecies || undefined,
      notes: harvestNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createHarvestEvent(farmId, fieldId, parsed.data, userId)
      setHarvestNotes('')
      setEstimatedKg('')
      setHarvestVerim('')
      setHarvestSpecies(defaultHarvestSpecies(defaultSpecies))
      setWorkerCount(0)
      setDailyWage(0)
      setTotalPaid(0)
      setTotalEdited(false)
      setInfo(
        isOliveField
          ? 'Hasat kaydı eklendi; zeytinyağı depoya işlendi.'
          : 'Hasat kaydı eklendi; kilo depoya işlendi.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hasat eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveHarvestEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingHarvestId) return
    setError(null)
    setInfo(null)
    const parsed = createHarvestSchema.safeParse({
      doneAt: editDate,
      workerCount: editWorkers,
      dailyWage: editWage,
      totalPaid: editTotal,
      estimatedKg: editKg === '' ? undefined : Number(editKg),
      verim:
        isOliveField && editVerim !== '' ? Number(editVerim) : undefined,
      species: editSpecies || undefined,
      notes: editNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await updateHarvestEvent(farmId, fieldId, editingHarvestId, parsed.data)
      setEditingHarvestId(null)
      setInfo('Hasat kaydı güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hasat güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  function renderPlowItem(p: PlowEvent) {
    return (
      <li key={p.id}>
        <span>
          {p.doneAt.slice(0, 10)} · {PLOW_DIRECTION_LABELS[p.direction]}
          {p.equipment ? ` · ${p.equipment}` : ''}
          {p.notes ? ` · ${p.notes}` : ''}
        </span>
        <button
          type="button"
          className="btn ghost btn-compact"
          disabled={saving}
          onClick={() => {
            if (
              !confirmDelete(
                'Bu Sürüm kaydı silinsin mi? Bu işlem geri alınamaz.',
              )
            ) {
              return
            }
            void deletePlowEvent(farmId, fieldId, p.id).catch((err) =>
              setError(err instanceof Error ? err.message : 'Silinemedi'),
            )
          }}
        >
          Sil
        </button>
      </li>
    )
  }

  function renderHarvestItem(h: HarvestEvent) {
    return (
      <li key={h.id}>
        <span>
          {h.doneAt.slice(0, 10)} · {h.workerCount} işçi · yevmiye{' '}
          {formatMoney(h.dailyWage)} · toplam {formatMoney(h.totalPaid)}
          {h.species ? ` · ${h.species}` : ''}
          {h.estimatedKg !== undefined
            ? ` · ~${formatMoney(h.estimatedKg)} kg`
            : ''}
          {h.verim !== undefined ? ` · verim ${formatMoney(h.verim)}` : ''}
          {h.estimatedKg !== undefined &&
          h.verim !== undefined &&
          h.verim > 0
            ? ` · ~${formatMoney(oliveOilLitersFromHarvest(h.estimatedKg, h.verim))} lt yağ`
            : ''}
          {h.notes ? ` · ${h.notes}` : ''}
        </span>
        <button
          type="button"
          className="btn ghost btn-compact"
          disabled={saving}
          onClick={() => {
            if (
              !confirmDelete(
                'Bu Hasat kaydı silinsin mi? Bu işlem geri alınamaz.',
              )
            ) {
              return
            }
            void deleteHarvestEvent(farmId, fieldId, h.id).catch((err) =>
              setError(err instanceof Error ? err.message : 'Silinemedi'),
            )
          }}
        >
          Sil
        </button>
      </li>
    )
  }

  return (
    <CollapseSection
      title="Sürüm ve Hasat"
      icon={<IconPlow />}
      tone="amber"
      bodyClassName="stack"
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && <p className="success">{info}</p>}

      <div className="plow-stats-grid">
        {periods.map((period) => (
          <div key={period.label} className="plow-stat-card">
            <strong>{period.label}</strong>
            <dl className="summary-list">
              <dt>Enine</dt>
              <dd>{period.enine}</dd>
              <dt>Boyuna</dt>
              <dd>{period.boyuna}</dd>
              <dt>Demir</dt>
              <dd>{period.demir}</dd>
              <dt>Toplam giriş</dt>
              <dd>{period.total}</dd>
            </dl>
          </div>
        ))}
      </div>

      <CollapseSection title="Sürüm Kaydı" icon={<IconFurrows />} tone="olive">
        <form className="form-grid" onSubmit={onAddPlow}>
          <label>
            Tarih
            <input
              type="date"
              value={plowDate}
              onChange={(e) => setPlowDate(e.target.value)}
              required
            />
          </label>
          <label>
            Yön
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as PlowDirection)}
            >
              <option value="enine">Enine</option>
              <option value="boyuna">Boyuna</option>
            </select>
          </label>
          <label>
            Ekipman
            <select
              value={equipmentChoice}
              onChange={(e) => setEquipmentChoice(e.target.value)}
              required
            >
              {PLOW_EQUIPMENT_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value={EQUIPMENT_OTHER}>Diğer</option>
            </select>
          </label>
          {equipmentChoice === EQUIPMENT_OTHER && (
            <label>
              Ekipman adı
              <input
                value={equipmentOther}
                onChange={(e) => setEquipmentOther(e.target.value)}
                placeholder="Ekipman adını yazın"
                required
              />
            </label>
          )}
          <label className="span-2">
            Not
            <input
              value={plowNotes}
              onChange={(e) => setPlowNotes(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Sürüm ekle'}
          </button>
        </form>
      </CollapseSection>

      <CollapseSection title="Hasat Kaydı" icon={<IconHarvest />} tone="olive">
        <form className="form-grid" onSubmit={onAddHarvest}>
          <label>
            Tarih
            <input
              type="date"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
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
            Toplam ödeme
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
          <label>
            Tahmini kilo
            <input
              type="number"
              min={0}
              step={0.1}
              value={estimatedKg}
              onChange={(e) => setEstimatedKg(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          {isOliveField && (
            <label>
              Verim
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={harvestVerim}
                onChange={(e) => setHarvestVerim(e.target.value)}
                placeholder="Örn. 5"
                required={estimatedKg !== '' && Number(estimatedKg) > 0}
              />
            </label>
          )}
          <HarvestSpeciesInput
            treeSpecies={defaultSpecies}
            value={harvestSpecies}
            onChange={setHarvestSpecies}
          />
          {isOliveField && harvestOilPreview > 0 && (
            <p className="muted small span-2">
              Yaklaşık yağ: {formatMoney(harvestOilPreview)} lt depoya
              eklenecek (kg ÷ verim).
            </p>
          )}
          <label className="span-2">
            Not
            <input
              value={harvestNotes}
              onChange={(e) => setHarvestNotes(e.target.value)}
              placeholder="Veri girmek için dokunun.."
            />
          </label>
          <p className="muted small span-2">
            Toplam ödeme varsayılan olarak işçi × yevmiye; istersen elle
            değiştirebilirsin. Fıstıkta kilo + çeşit depoya eklenir. Zeytinde
            tane kg ÷ verim = litre yağ olarak depoya işlenir.
          </p>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Hasat ekle'}
          </button>
        </form>
      </CollapseSection>

      {harvestByYear.length > 0 && (
        <CollapseSection
          title="Hasat İstatistikleri"
          icon={<IconChart />}
          tone="sky"
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Yıl</th>
                  <th>Tarih</th>
                  <th>İşçi</th>
                  <th>Yevmiye</th>
                  <th>Toplam ödeme</th>
                  <th>Çeşit</th>
                  <th>Tahmini kg</th>
                  {isOliveField && <th>Verim</th>}
                  {isOliveField && <th>Yağ (lt)</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {harvestByYear.map((h) =>
                  editingHarvestId === h.id ? (
                    <tr key={h.id} className="harvest-edit-row">
                      <td colSpan={isOliveField ? 10 : 8}>
                        <form
                          className="form-grid harvest-edit-form"
                          onSubmit={onSaveHarvestEdit}
                        >
                          <label>
                            Tarih
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              required
                            />
                          </label>
                          <label>
                            İşçi
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={editWorkers}
                              onChange={(e) => {
                                setEditTotalEdited(false)
                                setEditWorkers(Number(e.target.value))
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
                              value={editWage}
                              onChange={(e) => {
                                setEditTotalEdited(false)
                                setEditWage(Number(e.target.value))
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
                              value={editTotal}
                              onChange={(e) => {
                                setEditTotalEdited(true)
                                setEditTotal(Number(e.target.value))
                              }}
                              required
                            />
                          </label>
                          <HarvestSpeciesInput
                            treeSpecies={defaultSpecies}
                            value={editSpecies}
                            onChange={setEditSpecies}
                            allowExtraValue
                          />
                          <label>
                            Tahmini kg
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={editKg}
                              onChange={(e) => setEditKg(e.target.value)}
                            />
                          </label>
                          {isOliveField && (
                            <label>
                              Verim
                              <input
                                type="number"
                                min={0.01}
                                step={0.01}
                                value={editVerim}
                                onChange={(e) => setEditVerim(e.target.value)}
                              />
                            </label>
                          )}
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
                              {saving ? 'Kaydediliyor…' : 'Kaydet'}
                            </button>
                            <button
                              className="btn ghost"
                              type="button"
                              onClick={cancelEditHarvest}
                            >
                              İptal
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={h.id}>
                      <td>{h.doneAt.slice(0, 4)}</td>
                      <td>{h.doneAt.slice(0, 10)}</td>
                      <td>{h.workerCount}</td>
                      <td>{formatMoney(h.dailyWage)}</td>
                      <td>{formatMoney(h.totalPaid)}</td>
                      <td>{h.species?.trim() || '—'}</td>
                      <td>
                        {h.estimatedKg !== undefined
                          ? formatMoney(h.estimatedKg)
                          : '—'}
                      </td>
                      {isOliveField && (
                        <td>
                          {h.verim !== undefined ? formatMoney(h.verim) : '—'}
                        </td>
                      )}
                      {isOliveField && (
                        <td>
                          {h.estimatedKg !== undefined &&
                          h.verim !== undefined &&
                          h.verim > 0
                            ? formatMoney(
                                oliveOilLitersFromHarvest(
                                  h.estimatedKg,
                                  h.verim,
                                ),
                              )
                            : '—'}
                        </td>
                      )}
                      <td>
                        <div className="table-row-actions">
                          <button
                            type="button"
                            className="btn ghost btn-compact"
                            disabled={saving}
                            onClick={() => startEditHarvest(h)}
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            className="btn ghost btn-compact"
                            onClick={() => setChartModalOpen(true)}
                          >
                            Grafikte gör
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </CollapseSection>
      )}

      <div className="plow-lists">
        <div>
          <button
            type="button"
            className={`section-title-button${plows.length > PREVIEW_LIMIT ? ' is-clickable' : ''}`}
            onClick={() => {
              if (plows.length > PREVIEW_LIMIT) setPlowModalOpen(true)
            }}
            disabled={plows.length <= PREVIEW_LIMIT}
            aria-label={
              plows.length > PREVIEW_LIMIT
                ? 'Eski Sürüm kayıtlarını aç'
                : 'Son Sürümler'
            }
          >
            <span className="section-title-with-icon">
              <HeadingIcon tone="olive">
                <IconList />
              </HeadingIcon>
              <span>
                Son Sürümler
                {plows.length > PREVIEW_LIMIT && (
                  <span className="muted small title-more-hint">
                    {' '}
                    · eski kayıtlar
                  </span>
                )}
              </span>
            </span>
          </button>
          {plows.length === 0 ? (
            <p className="muted small">Henüz Sürüm yok.</p>
          ) : (
            <ul className="event-list event-list-preview">
              {plows.slice(0, PREVIEW_LIMIT).map(renderPlowItem)}
            </ul>
          )}
        </div>
        <div>
          <button
            type="button"
            className={`section-title-button${harvests.length > PREVIEW_LIMIT ? ' is-clickable' : ''}`}
            onClick={() => {
              if (harvests.length > PREVIEW_LIMIT) setHarvestModalOpen(true)
            }}
            disabled={harvests.length <= PREVIEW_LIMIT}
            aria-label={
              harvests.length > PREVIEW_LIMIT
                ? 'Eski Hasat kayıtlarını aç'
                : 'Hasatlar'
            }
          >
            <span className="section-title-with-icon">
              <HeadingIcon tone="olive">
                <IconHarvest />
              </HeadingIcon>
              <span>
                Hasatlar
                {harvests.length > PREVIEW_LIMIT && (
                  <span className="muted small title-more-hint">
                    {' '}
                    · eski kayıtlar
                  </span>
                )}
              </span>
            </span>
          </button>
          {harvests.length === 0 ? (
            <p className="muted small">Henüz Hasat yok.</p>
          ) : (
            <ul className="event-list event-list-preview">
              {harvests.slice(0, PREVIEW_LIMIT).map(renderHarvestItem)}
            </ul>
          )}
        </div>
      </div>

      {chartModalOpen && (
        <Modal
          title="Hasat İstatistikleri (Yıllara Göre)"
          onClose={() => setChartModalOpen(false)}
        >
          <YearlyHarvestChart harvests={harvestByYear} />
        </Modal>
      )}

      {plowModalOpen && (
        <Modal title="Eski Sürümler" onClose={() => setPlowModalOpen(false)}>
          <ul className="event-list event-list-modal">
            {plows.slice(PREVIEW_LIMIT).map(renderPlowItem)}
          </ul>
        </Modal>
      )}

      {harvestModalOpen && (
        <Modal title="Eski Hasatlar" onClose={() => setHarvestModalOpen(false)}>
          <ul className="event-list event-list-modal">
            {harvests.slice(PREVIEW_LIMIT).map(renderHarvestItem)}
          </ul>
        </Modal>
      )}
    </CollapseSection>
  )
}
