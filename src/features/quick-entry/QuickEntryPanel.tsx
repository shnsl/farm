import { useEffect, useState, type FormEvent } from 'react'
import { CollapseSection } from '../../components/CollapseSection'
import { IconClipboard } from '../../components/Icons'
import {
  createFertilizeEvent,
  createFertilizeSchema,
} from '../care/api'
import {
  createGeneralWork,
  createGeneralWorkSchema,
} from '../general-works/api'
import {
  createHoeEvent,
  createHoeSchema,
} from '../hoe/api'
import {
  createPesticideExpense,
  createPesticideExpenseSchema,
} from '../pesticide/api'
import {
  createHarvestEvent,
  createHarvestSchema,
  createPlowEvent,
  createPlowSchema,
  PLOW_DIRECTION_LABELS,
} from '../plow/api'
import {
  createPruneEvent,
  createPruneSchema,
} from '../prune/api'
import {
  defaultHarvestSpecies,
  HarvestSpeciesInput,
} from '../warehouse/HarvestSpeciesInput'
import {
  isOliveTreeSpecies,
  oliveOilLitersFromHarvest,
} from '../warehouse/harvestProducts'
import type { Field, PlowDirection } from '../../types'
import { PLOW_EQUIPMENT_OPTIONS } from '../../types'

type QuickOp =
  | 'plow'
  | 'spray'
  | 'fertilize'
  | 'hoe'
  | 'prune'
  | 'harvest'
  | 'general'

const OP_LABELS: Record<QuickOp, string> = {
  plow: 'Sürüm',
  spray: 'İlaçlama',
  fertilize: 'Gübreleme',
  hoe: 'Çapalama',
  prune: 'Budama',
  harvest: 'Hasat',
  general: 'Genel İşler',
}

const EQUIPMENT_OTHER = '__other__'

interface QuickEntryPanelProps {
  farmId: string
  userId: string
  fields: Field[]
}

export function QuickEntryPanel({
  farmId,
  userId,
  fields,
}: QuickEntryPanelProps) {
  const [fieldId, setFieldId] = useState('')
  const [op, setOp] = useState<QuickOp>('plow')
  const [doneAt, setDoneAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Sürüm
  const [direction, setDirection] = useState<PlowDirection>('enine')
  const [equipmentChoice, setEquipmentChoice] = useState<string>(
    PLOW_EQUIPMENT_OPTIONS[0],
  )
  const [equipmentOther, setEquipmentOther] = useState('')
  const [plowNotes, setPlowNotes] = useState('')

  // İlaçlama
  const [pesticideName, setPesticideName] = useState('')
  const [sprayCost, setSprayCost] = useState(0)
  const [sprayNotes, setSprayNotes] = useState('')

  // Gübreleme
  const [fertilizerType, setFertilizerType] = useState('')
  const [fertCost, setFertCost] = useState(0)
  const [fertNotes, setFertNotes] = useState('')

  // Çapalama
  const [workerCount, setWorkerCount] = useState(1)
  const [dailyWage, setDailyWage] = useState(0)
  const [totalPaid, setTotalPaid] = useState(0)
  const [totalEdited, setTotalEdited] = useState(false)
  const [hoeNotes, setHoeNotes] = useState('')

  // Budama
  const [pruneWorkers, setPruneWorkers] = useState(1)
  const [foremanName, setForemanName] = useState('')
  const [foremanPhone, setForemanPhone] = useState('')
  const [pruneWage, setPruneWage] = useState(0)
  const [durationDays, setDurationDays] = useState(1)
  const [pruneNotes, setPruneNotes] = useState('')

  // Hasat
  const [harvestWorkers, setHarvestWorkers] = useState(0)
  const [harvestWage, setHarvestWage] = useState(0)
  const [harvestTotal, setHarvestTotal] = useState(0)
  const [harvestTotalEdited, setHarvestTotalEdited] = useState(false)
  const [estimatedKg, setEstimatedKg] = useState('')
  const [harvestVerim, setHarvestVerim] = useState('')
  const [harvestSpecies, setHarvestSpecies] = useState('')
  const [harvestNotes, setHarvestNotes] = useState('')

  // Genel işler
  const [generalWork, setGeneralWork] = useState('')
  const [generalCost, setGeneralCost] = useState(0)

  useEffect(() => {
    if (!totalEdited) setTotalPaid(workerCount * dailyWage)
  }, [workerCount, dailyWage, totalEdited])

  useEffect(() => {
    if (!harvestTotalEdited) {
      setHarvestTotal(harvestWorkers * harvestWage)
    }
  }, [harvestWorkers, harvestWage, harvestTotalEdited])

  useEffect(() => {
    if (fields.length === 0) {
      setFieldId('')
      return
    }
    if (!fields.some((f) => f.id === fieldId)) {
      setFieldId(fields[0].id)
    }
  }, [fields, fieldId])

  useEffect(() => {
    const field = fields.find((f) => f.id === fieldId)
    setHarvestSpecies(defaultHarvestSpecies(field?.species))
    setHarvestVerim('')
  }, [fieldId, fields])

  const selectedField = fields.find((f) => f.id === fieldId)
  const isOliveField = isOliveTreeSpecies(selectedField?.species)
  const harvestOilPreview =
    isOliveField && estimatedKg !== '' && harvestVerim !== ''
      ? oliveOilLitersFromHarvest(Number(estimatedKg), Number(harvestVerim))
      : 0

  function resetEntries() {
    setDoneAt(new Date().toISOString().slice(0, 10))
    setDirection('enine')
    setEquipmentChoice(PLOW_EQUIPMENT_OPTIONS[0])
    setEquipmentOther('')
    setPlowNotes('')
    setPesticideName('')
    setSprayCost(0)
    setSprayNotes('')
    setFertilizerType('')
    setFertCost(0)
    setFertNotes('')
    setWorkerCount(1)
    setDailyWage(0)
    setTotalPaid(0)
    setTotalEdited(false)
    setHoeNotes('')
    setPruneWorkers(1)
    setForemanName('')
    setForemanPhone('')
    setPruneWage(0)
    setDurationDays(1)
    setPruneNotes('')
    setHarvestWorkers(0)
    setHarvestWage(0)
    setHarvestTotal(0)
    setHarvestTotalEdited(false)
    setEstimatedKg('')
    setHarvestVerim('')
    setHarvestSpecies(defaultHarvestSpecies(selectedField?.species))
    setHarvestNotes('')
    setGeneralWork('')
    setGeneralCost(0)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)

    if (!fieldId || !selectedField) {
      setError('Tarla seç')
      return
    }

    if (op === 'plow') {
      const parsed = createPlowSchema.safeParse({
        doneAt,
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
        resetEntries()
        setInfo(
          `${selectedField.name}: ${PLOW_DIRECTION_LABELS[parsed.data.direction]} sürüm kaydı eklendi.`,
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
      } finally {
        setSaving(false)
      }
      return
    }

    if (op === 'spray') {
      const parsed = createPesticideExpenseSchema.safeParse({
        doneAt,
        pesticideName,
        cost: sprayCost,
        fieldId,
        notes: sprayNotes,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
        return
      }
      setSaving(true)
      try {
        await createPesticideExpense(farmId, parsed.data, userId)
        resetEntries()
        setInfo(`${selectedField.name}: ilaçlama kaydı eklendi.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
      } finally {
        setSaving(false)
      }
      return
    }

    if (op === 'fertilize') {
      const parsed = createFertilizeSchema.safeParse({
        doneAt,
        fertilizerType,
        cost: fertCost,
        notes: fertNotes,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
        return
      }
      setSaving(true)
      try {
        await createFertilizeEvent(farmId, fieldId, parsed.data, userId)
        resetEntries()
        setInfo(`${selectedField.name}: gübreleme kaydı eklendi.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
      } finally {
        setSaving(false)
      }
      return
    }

    if (op === 'hoe') {
      const parsed = createHoeSchema.safeParse({
        doneAt,
        workerCount,
        dailyWage,
        totalPaid,
        notes: hoeNotes || undefined,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
        return
      }
      setSaving(true)
      try {
        await createHoeEvent(farmId, fieldId, parsed.data, userId)
        resetEntries()
        setInfo(`${selectedField.name}: çapalama kaydı eklendi.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
      } finally {
        setSaving(false)
      }
      return
    }

    if (op === 'prune') {
      const parsed = createPruneSchema.safeParse({
        doneAt,
        workerCount: pruneWorkers,
        foremanName,
        foremanPhone,
        dailyWage: pruneWage,
        durationDays,
        notes: pruneNotes || undefined,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
        return
      }
      setSaving(true)
      try {
        await createPruneEvent(farmId, fieldId, parsed.data, userId)
        resetEntries()
        setInfo(`${selectedField.name}: budama kaydı eklendi.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
      } finally {
        setSaving(false)
      }
      return
    }

    if (op === 'harvest') {
      const parsed = createHarvestSchema.safeParse({
        doneAt,
        workerCount: harvestWorkers,
        dailyWage: harvestWage,
        totalPaid: harvestTotal,
        estimatedKg: estimatedKg === '' ? undefined : Number(estimatedKg),
        verim:
          isOliveField && harvestVerim !== ''
            ? Number(harvestVerim)
            : undefined,
        species: harvestSpecies || undefined,
        notes: harvestNotes || undefined,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
        return
      }
      setSaving(true)
      try {
        await createHarvestEvent(farmId, fieldId, parsed.data, userId)
        resetEntries()
        setInfo(`${selectedField.name}: hasat kaydı eklendi.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
      } finally {
        setSaving(false)
      }
      return
    }

    const parsed = createGeneralWorkSchema.safeParse({
      doneAt,
      work: generalWork,
      cost: generalCost,
      fieldId,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }
    setSaving(true)
    try {
      await createGeneralWork(farmId, parsed.data, userId)
      resetEntries()
      setInfo(`${selectedField.name}: genel iş kaydı eklendi.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapseSection
      title="Hızlı Giriş"
      icon={<IconClipboard />}
      tone="sky"
      bodyClassName="stack"
    >
      {fields.length === 0 ? (
        <p className="muted">Önce bir tarla ekle; sonra buradan işlem girebilirsin.</p>
      ) : (
        <>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {info && <p className="success">{info}</p>}

          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Tarla
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                required
              >
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              İşlem
              <select
                value={op}
                onChange={(e) => setOp(e.target.value as QuickOp)}
              >
                {(Object.keys(OP_LABELS) as QuickOp[]).map((key) => (
                  <option key={key} value={key}>
                    {OP_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tarih
              <input
                type="date"
                value={doneAt}
                onChange={(e) => setDoneAt(e.target.value)}
                required
              />
            </label>

            {op === 'plow' && (
              <>
                <label>
                  Yön
                  <select
                    value={direction}
                    onChange={(e) =>
                      setDirection(e.target.value as PlowDirection)
                    }
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
              </>
            )}

            {op === 'spray' && (
              <>
                <label>
                  İlaç adı
                  <input
                    value={pesticideName}
                    onChange={(e) => setPesticideName(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </label>
                <label>
                  Masraf (₺)
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={sprayCost}
                    onChange={(e) => setSprayCost(Number(e.target.value))}
                    required
                  />
                </label>
                <label className="span-2">
                  Not
                  <input
                    value={sprayNotes}
                    onChange={(e) => setSprayNotes(e.target.value)}
                    placeholder="Veri girmek için dokunun.."
                  />
                </label>
              </>
            )}

            {op === 'fertilize' && (
              <>
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
                    value={fertCost}
                    onChange={(e) => setFertCost(Number(e.target.value))}
                    required
                  />
                </label>
                <label className="span-2">
                  Not
                  <input
                    value={fertNotes}
                    onChange={(e) => setFertNotes(e.target.value)}
                    placeholder="Veri girmek için dokunun.."
                  />
                </label>
              </>
            )}

            {op === 'hoe' && (
              <>
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
                    value={hoeNotes}
                    onChange={(e) => setHoeNotes(e.target.value)}
                    placeholder="Veri girmek için dokunun.."
                  />
                </label>
                <p className="muted small span-2">
                  Toplam harcama varsayılan olarak işçi × yevmiye; istersen elle
                  değiştirebilirsin.
                </p>
              </>
            )}

            {op === 'prune' && (
              <>
                <label>
                  İşçi sayısı
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={pruneWorkers}
                    onChange={(e) => setPruneWorkers(Number(e.target.value))}
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
                    value={pruneWage}
                    onChange={(e) => setPruneWage(Number(e.target.value))}
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
                    value={pruneNotes}
                    onChange={(e) => setPruneNotes(e.target.value)}
                    placeholder="Veri girmek için dokunun.."
                  />
                </label>
              </>
            )}

            {op === 'harvest' && (
              <>
                <label>
                  İşçi sayısı
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={harvestWorkers}
                    onChange={(e) => {
                      setHarvestTotalEdited(false)
                      setHarvestWorkers(Number(e.target.value))
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
                    value={harvestWage}
                    onChange={(e) => {
                      setHarvestTotalEdited(false)
                      setHarvestWage(Number(e.target.value))
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
                    value={harvestTotal}
                    onChange={(e) => {
                      setHarvestTotalEdited(true)
                      setHarvestTotal(Number(e.target.value))
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
                  treeSpecies={selectedField?.species}
                  value={harvestSpecies}
                  onChange={setHarvestSpecies}
                />
                {isOliveField && harvestOilPreview > 0 && (
                  <p className="muted small span-2">
                    Yaklaşık yağ:{' '}
                    {harvestOilPreview.toLocaleString('tr-TR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    lt depoya eklenecek (kg ÷ verim).
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
                  değiştirebilirsin. Fıstıkta kilo + çeşit depoya eklenir.
                  Zeytinde tane kg ÷ verim = litre yağ olarak depoya işlenir.
                </p>
              </>
            )}

            {op === 'general' && (
              <>
                <label>
                  İşlem
                  <input
                    value={generalWork}
                    onChange={(e) => setGeneralWork(e.target.value)}
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
                    value={generalCost}
                    onChange={(e) => setGeneralCost(Number(e.target.value))}
                    required
                  />
                </label>
              </>
            )}

            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? 'Kaydediliyor…' : `${OP_LABELS[op]} ekle`}
            </button>
          </form>
        </>
      )}
    </CollapseSection>
  )
}
