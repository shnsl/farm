import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  IconCell,
  IconFields,
  IconGrid,
  IconInfo,
  IconMap,
  IconPencil,
  IconSelect,
  PageTitle,
  SectionTitle,
} from '../components/Icons'
import { CollapseSection } from '../components/CollapseSection'
import {
  subscribeField,
  updateField,
  updateFieldSpecies,
} from '../features/fields/api'
import { FieldMapImagePanel } from '../features/fields/FieldMapImagePanel'
import {
  bulkClearTreeDetails,
  bulkDeleteTrees,
  bulkUpdateTreeDetails,
  bulkUpdateTreeSpecies,
  createTree,
  createTreesInCells,
  createTreeSchema,
  deleteTree,
  fillEmptyCellsWithSpecies,
  subscribeTrees,
  TREE_HEALTH_LABELS,
  updateTreeDetails,
  updateTreeSchema,
} from '../features/trees/api'
import { FieldCarePanel } from '../features/care/FieldCarePanel'
import { FieldGeneralWorksPanel } from '../features/general-works/FieldGeneralWorksPanel'
import { FieldHoePanel } from '../features/hoe/FieldHoePanel'
import { FieldPrunePanel } from '../features/prune/FieldPrunePanel'
import { FieldPlowPanel } from '../features/plow/FieldPlowPanel'
import { TreeGrid } from '../features/trees/TreeGrid'
import { formatCell, letterToRowIndex, rowIndexToLetter } from '../lib/cells'
import { useAuth } from '../lib/auth'
import { confirmDelete } from '../lib/confirmDelete'
import { formatTreeAge } from '../lib/treeAge'
import type { Field, Tree, TreeHealth } from '../types'

export function FieldDetailPage() {
  const { fieldId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { farmId, user } = useAuth()
  const [field, setField] = useState<Field | null>(null)
  const [trees, setTrees] = useState<Tree[]>([])
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [multiSelect, setMultiSelect] = useState(false)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(() => new Set())
  const [species, setSpecies] = useState('')
  const [notes, setNotes] = useState('')
  const [editSpecies, setEditSpecies] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editPlantedAt, setEditPlantedAt] = useState('')
  const [editHealth, setEditHealth] = useState<TreeHealth | ''>('')
  const [editNotes, setEditNotes] = useState('')
  const [bulkArea, setBulkArea] = useState('')
  const [bulkName, setBulkName] = useState('')
  const [bulkSpecies, setBulkSpecies] = useState('')
  const [bulkDonum, setBulkDonum] = useState('')
  const [bulkRowCount, setBulkRowCount] = useState(12)
  const [bulkColCount, setBulkColCount] = useState(80)
  const [applySpecies, setApplySpecies] = useState(true)
  const [applyLabel, setApplyLabel] = useState(false)
  const [applyPlantedAt, setApplyPlantedAt] = useState(false)
  const [applyHealth, setApplyHealth] = useState(false)
  const [applyNotes, setApplyNotes] = useState(false)
  const [multiSpecies, setMultiSpecies] = useState('')
  const [multiLabel, setMultiLabel] = useState('')
  const [multiPlantedAt, setMultiPlantedAt] = useState('')
  const [multiHealth, setMultiHealth] = useState<TreeHealth | ''>('')
  const [multiNotes, setMultiNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingTree, setEditingTree] = useState(false)
  const [editingBulkSpecies, setEditingBulkSpecies] = useState(false)
  const [editingFieldNotes, setEditingFieldNotes] = useState(false)
  const [fieldNotesDraft, setFieldNotesDraft] = useState('')
  const [editingMultiForm, setEditingMultiForm] = useState(true)

  useEffect(() => {
    if (!farmId || !fieldId) return
    return subscribeField(
      farmId,
      fieldId,
      setField,
      (err) => setError(err.message),
    )
  }, [farmId, fieldId])

  useEffect(() => {
    if (!farmId || !fieldId) return
    return subscribeTrees(
      farmId,
      fieldId,
      setTrees,
      (err) => setError(err.message),
    )
  }, [farmId, fieldId])

  useEffect(() => {
    if (!field) return
    setBulkArea(field.area ?? '')
    setBulkName(field.name)
    setBulkDonum(field.donum !== undefined ? String(field.donum) : '')
    setBulkRowCount(field.rowCount)
    setBulkColCount(field.colCount)
    if (field.species) {
      setBulkSpecies(field.species)
      setMultiSpecies(field.species)
    }
  }, [field])

  useEffect(() => {
    const cell = searchParams.get('cell')
    if (cell && !multiSelect) {
      setSelectedCell(cell.toUpperCase())
    }
  }, [searchParams, multiSelect])

  const treeByCell = useMemo(() => {
    const map = new Map<string, Tree>()
    for (const tree of trees) {
      if (tree.status === 'active') {
        map.set(tree.cell, tree)
      }
    }
    return map
  }, [trees])

  const activeTrees = useMemo(
    () => trees.filter((t) => t.status === 'active'),
    [trees],
  )

  const emptyCellCount = field
    ? field.rowCount * field.colCount - treeByCell.size
    : 0

  const selectedTree = selectedCell ? treeByCell.get(selectedCell) : undefined

  const multiFilled = useMemo(() => {
    const list: Tree[] = []
    for (const cell of multiSelected) {
      const tree = treeByCell.get(cell)
      if (tree) list.push(tree)
    }
    return list
  }, [multiSelected, treeByCell])

  const multiEmpty = useMemo(() => {
    const list: string[] = []
    for (const cell of multiSelected) {
      if (!treeByCell.has(cell)) list.push(cell)
    }
    return list
  }, [multiSelected, treeByCell])

  useEffect(() => {
    if (!selectedCell || selectedTree || multiSelect) return
    setSpecies(field?.species ?? '')
  }, [selectedCell, selectedTree, field?.species, multiSelect])

  useEffect(() => {
    if (!selectedTree || multiSelect) return
    setEditSpecies(selectedTree.species ?? '')
    setEditLabel(selectedTree.label ?? '')
    setEditPlantedAt(selectedTree.plantedAt ?? '')
    setEditHealth(selectedTree.health ?? '')
    setEditNotes(selectedTree.notes ?? '')
    const hasInfo = Boolean(
      selectedTree.species ||
        selectedTree.label ||
        selectedTree.plantedAt ||
        selectedTree.health ||
        selectedTree.notes,
    )
    setEditingTree(!hasInfo)
  }, [selectedTree, multiSelect])

  function selectCell(cell: string) {
    setSelectedCell(cell)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('cell', cell)
        return next
      },
      { replace: true },
    )
  }

  function toggleMulti(cell: string) {
    setMultiSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cell)) next.delete(cell)
      else next.add(cell)
      return next
    })
  }

  function enableMultiSelect() {
    setMultiSelect(true)
    setSelectedCell(null)
    setMultiSelected(new Set())
    setEditingMultiForm(true)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('cell')
        return next
      },
      { replace: true },
    )
  }

  function disableMultiSelect() {
    setMultiSelect(false)
    setMultiSelected(new Set())
  }

  function selectAllTrees() {
    setMultiSelected(new Set(activeTrees.map((t) => t.cell)))
  }

  function selectAllCells() {
    if (!field) return
    const next = new Set<string>()
    for (let r = 0; r < field.rowCount; r += 1) {
      const row = rowIndexToLetter(r)
      for (let col = 1; col <= field.colCount; col += 1) {
        next.add(formatCell(row, col))
      }
    }
    setMultiSelected(next)
  }

  function clearMulti() {
    setMultiSelected(new Set())
  }

  async function onAddTree(event: FormEvent) {
    event.preventDefault()
    if (!farmId || !field || !selectedCell) return
    setError(null)
    setInfo(null)

    const parsed = createTreeSchema.safeParse({
      cell: selectedCell,
      species,
      notes,
      status: 'active',
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }

    if (treeByCell.has(selectedCell)) {
      setError('Bu hücrede zaten aktif bir ağaç var')
      return
    }

    setSaving(true)
    try {
      await createTree(farmId, field.id, parsed.data, {
        rowCount: field.rowCount,
        colCount: field.colCount,
      })
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ağaç eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveTree(event: FormEvent) {
    event.preventDefault()
    if (!farmId || !field || !selectedTree) return
    setError(null)
    setInfo(null)

    const parsed = updateTreeSchema.safeParse({
      species: editSpecies,
      label: editLabel,
      plantedAt: editPlantedAt,
      health: editHealth || null,
      notes: editNotes,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Form hatalı')
      return
    }

    setSaving(true)
    try {
      await updateTreeDetails(farmId, field.id, selectedTree.id, parsed.data)
      setEditingTree(false)
      setInfo(`${selectedTree.cell} bilgileri kaydedildi.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız')
    } finally {
      setSaving(false)
    }
  }

  async function onRemoveTree() {
    if (!farmId || !field || !selectedTree) return
    const ok = confirmDelete(
      `${selectedTree.cell} hücresindeki ağaç kaldırılsın mı? Bu işlem geri alınamaz.`,
    )
    if (!ok) return

    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      await deleteTree(farmId, field.id, selectedTree.id)
      setSelectedCell(null)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('cell')
          return next
        },
        { replace: true },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ağaç silinemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveFieldNotes(event: FormEvent) {
    event.preventDefault()
    if (!farmId || !field) return
    setError(null)
    setInfo(null)
    setSaving(true)
    try {
      await updateField(farmId, field.id, { notes: fieldNotesDraft })
      setEditingFieldNotes(false)
      setInfo('Tarla notu kaydedildi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Not kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onBulkSpecies(event: FormEvent) {
    event.preventDefault()
    if (!farmId || !field) return
    setError(null)
    setInfo(null)

    const nextName = bulkName.trim()
    const nextSpecies = bulkSpecies.trim()
    const nextRowCount = Number(bulkRowCount)
    const nextColCount = Number(bulkColCount)
    if (!nextName) {
      setError('Tarla adı gerekli')
      return
    }
    if (!nextSpecies) {
      setError('Çeşit adı gerekli')
      return
    }
    if (
      !Number.isInteger(nextRowCount) ||
      nextRowCount < 1 ||
      nextRowCount > 26
    ) {
      setError('En (satır) 1–26 arasında olmalı')
      return
    }
    if (
      !Number.isInteger(nextColCount) ||
      nextColCount < 1 ||
      nextColCount > 200
    ) {
      setError('Boy (sütun) 1–200 arasında olmalı')
      return
    }

    const outside = activeTrees.filter((tree) => {
      const rowIndex = letterToRowIndex(tree.row)
      return (
        rowIndex < 0 ||
        rowIndex >= nextRowCount ||
        tree.col < 1 ||
        tree.col > nextColCount
      )
    })
    if (outside.length > 0) {
      const ok = confirmDelete(
        `Yeni en/boy dışında ${outside.length} ağaç kalacak (grid’de görünmez). Devam edilsin mi?`,
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      await updateField(farmId, field.id, {
        area: bulkArea.trim(),
        name: nextName,
        species: nextSpecies,
        donum: bulkDonum === '' ? undefined : Number(bulkDonum),
        rowCount: nextRowCount,
        colCount: nextColCount,
      })
      const count = await bulkUpdateTreeSpecies(
        farmId,
        field.id,
        activeTrees.map((t) => t.id),
        nextSpecies,
      )
      setInfo(
        count > 0
          ? `Tarla bilgileri güncellendi (${count} ağaç).`
          : 'Tarla bilgileri kaydedildi. Henüz ağaç yok.',
      )
      setEditingBulkSpecies(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilgiler güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onFillEmpty() {
    if (!farmId || !field) return
    setError(null)
    setInfo(null)

    const next = (bulkSpecies.trim() || field.species || '').trim()
    if (!next) {
      setError('Önce bir çeşit yaz')
      return
    }

    setSaving(true)
    try {
      await updateFieldSpecies(farmId, field.id, next)
      const created = await fillEmptyCellsWithSpecies(
        farmId,
        field.id,
        {
          rowCount: field.rowCount,
          colCount: field.colCount,
          species: next,
        },
        new Set(treeByCell.keys()),
      )
      setInfo(
        created > 0
          ? `${created} boş hücreye “${next}” eklendi.`
          : 'Eklenecek boş hücre yok.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toplu ekleme başarısız')
    } finally {
      setSaving(false)
    }
  }

  async function onApplyMulti(event: FormEvent) {
    event.preventDefault()
    if (!farmId || !field) return
    setError(null)
    setInfo(null)

    if (
      !applySpecies &&
      !applyLabel &&
      !applyPlantedAt &&
      !applyHealth &&
      !applyNotes
    ) {
      setError('Uygulanacak en az bir alanı işaretle')
      return
    }

    if (multiSelected.size === 0) {
      setError('Önce grid’den hücre seç')
      return
    }

    const patch: {
      species?: string | null
      label?: string | null
      plantedAt?: string | null
      health?: TreeHealth | null
      notes?: string | null
    } = {}

    if (applySpecies) patch.species = multiSpecies.trim() || null
    if (applyLabel) patch.label = multiLabel.trim() || null
    if (applyPlantedAt) patch.plantedAt = multiPlantedAt.trim() || null
    if (applyHealth) patch.health = multiHealth || null
    if (applyNotes) patch.notes = multiNotes.trim() || null

    setSaving(true)
    try {
      let updated = 0
      let created = 0

      if (multiFilled.length > 0) {
        updated = await bulkUpdateTreeDetails(
          farmId,
          field.id,
          multiFilled.map((t) => t.id),
          patch,
        )
      }

      if (multiEmpty.length > 0) {
        created = await createTreesInCells(farmId, field.id, multiEmpty, {
          species: applySpecies ? multiSpecies.trim() || undefined : undefined,
          label: applyLabel ? multiLabel.trim() || undefined : undefined,
          plantedAt: applyPlantedAt
            ? multiPlantedAt.trim() || undefined
            : undefined,
          health: applyHealth && multiHealth ? multiHealth : undefined,
          notes: applyNotes ? multiNotes.trim() || undefined : undefined,
        })
      }

      setInfo(
        [
          updated > 0 ? `${updated} ağaç güncellendi` : null,
          created > 0 ? `${created} yeni ağaç eklendi` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Değişiklik yok',
      )
      setEditingMultiForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toplu işlem başarısız')
    } finally {
      setSaving(false)
    }
  }

  async function onClearMultiInfo() {
    if (!farmId || !field || multiFilled.length === 0) return
    const ok = confirmDelete(
      `${multiFilled.length} seçili ağacın bilgileri temizlensin mi? Bu işlem geri alınamaz.`,
    )
    if (!ok) return

    setError(null)
    setInfo(null)
    setSaving(true)
    try {
      const count = await bulkClearTreeDetails(
        farmId,
        field.id,
        multiFilled.map((t) => t.id),
      )
      setInfo(`${count} ağacın bilgileri temizlendi.`)
      setEditingMultiForm(false)
      setApplySpecies(true)
      setApplyLabel(true)
      setApplyPlantedAt(true)
      setApplyHealth(true)
      setApplyNotes(true)
      setMultiSpecies('')
      setMultiLabel('')
      setMultiPlantedAt('')
      setMultiHealth('')
      setMultiNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilgiler temizlenemedi')
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteMultiTrees() {
    if (!farmId || !field || multiFilled.length === 0) return
    const ok = confirmDelete(
      `${multiFilled.length} seçili ağaç kaldırılsın mı? Bu işlem geri alınamaz.`,
    )
    if (!ok) return

    setError(null)
    setInfo(null)
    setSaving(true)
    try {
      const count = await bulkDeleteTrees(
        farmId,
        field.id,
        multiFilled.map((t) => t.id),
      )
      setMultiSelected((prev) => {
        const next = new Set(prev)
        for (const tree of multiFilled) {
          next.delete(tree.cell)
        }
        return next
      })
      setInfo(`${count} ağaç kaldırıldı.`)
      setEditingMultiForm(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ağaçlar silinemedi')
    } finally {
      setSaving(false)
    }
  }

  if (!field) {
    return (
      <div className="page">
        <p className="muted">{error ? error : 'Tarla yükleniyor…'}</p>
        <Link to="/">← Tarlalara dön</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/" className="muted small">
            ← Tarlalar
          </Link>
          <PageTitle icon={<IconFields />} tone="green">
            {field.name}
          </PageTitle>
          <p className="field-summary-line">
            {[
              field.area?.trim() || null,
              field.name,
              field.species?.trim() || null,
              field.donum !== undefined
                ? `${field.donum.toLocaleString('tr-TR')} dönüm`
                : null,
              `${activeTrees.length} ağaç`,
            ]
              .filter(Boolean)
              .join(' → ')}
          </p>
          {editingFieldNotes ? (
            <form className="field-notes-edit" onSubmit={onSaveFieldNotes}>
              <label>
                Tarla Notu
                <textarea
                  rows={3}
                  value={fieldNotesDraft}
                  onChange={(e) => setFieldNotesDraft(e.target.value)}
                  placeholder="Veri girmek için dokunun.."
                />
              </label>
              <div className="bulk-actions">
                <button className="btn primary" type="submit" disabled={saving}>
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setEditingFieldNotes(false)}
                >
                  İptal
                </button>
              </div>
            </form>
          ) : (
            <div className="field-notes-view">
              <button
                type="button"
                className="btn ghost btn-icon"
                aria-label="Notu düzenle"
                title="Notu düzenle"
                onClick={() => {
                  setFieldNotesDraft(field.notes ?? '')
                  setEditingFieldNotes(true)
                }}
              >
                <IconPencil />
              </button>
              {field.notes?.trim() ? (
                <p className="field-general-notes">{field.notes.trim()}</p>
              ) : (
                <p className="muted small">Tarla Notu yok.</p>
              )}
            </div>
          )}
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && <p className="success">{info}</p>}

      {farmId && user && (
        <FieldPlowPanel
          farmId={farmId}
          fieldId={field.id}
          userId={user.uid}
          defaultSpecies={field.species ?? ''}
        />
      )}

      {farmId && user && (
        <FieldCarePanel
          farmId={farmId}
          fieldId={field.id}
          userId={user.uid}
        />
      )}

      {farmId && user && (
        <FieldPrunePanel
          farmId={farmId}
          fieldId={field.id}
          userId={user.uid}
        />
      )}

      {farmId && user && (
        <FieldHoePanel
          farmId={farmId}
          fieldId={field.id}
          userId={user.uid}
        />
      )}

      {farmId && user && (
        <FieldGeneralWorksPanel
          farmId={farmId}
          fieldId={field.id}
          userId={user.uid}
        />
      )}

      {multiSelect && (
        <CollapseSection
          title={`Seçime bilgi uygula · ${multiSelected.size} hücre`}
          icon={<IconSelect />}
          tone="sky"
          defaultOpen
          bodyClassName="stack"
        >
          <p className="muted small">
            {multiFilled.length} dolu · {multiEmpty.length} boş seçili. Grid
            üzerindeki araç çubuğundan seçimi değiştir.
          </p>
          <div className="bulk-actions">
            <button
              type="button"
              className="btn ghost"
              disabled={saving || multiFilled.length === 0}
              onClick={() => void onClearMultiInfo()}
            >
              Bilgileri temizle ({multiFilled.length})
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={saving || multiFilled.length === 0}
              onClick={() => void onDeleteMultiTrees()}
            >
              Ağaçları kaldır ({multiFilled.length})
            </button>
          </div>

          {!editingMultiForm ? (
            <div className="info-summary stack">
              <dl className="summary-list">
                {applySpecies && (
                  <>
                    <dt>Çeşit</dt>
                    <dd>{multiSpecies.trim() || '—'}</dd>
                  </>
                )}
                {applyLabel && (
                  <>
                    <dt>Etiket</dt>
                    <dd>{multiLabel.trim() || '—'}</dd>
                  </>
                )}
                {applyPlantedAt && (
                  <>
                    <dt>Dikim</dt>
                    <dd>{multiPlantedAt || '—'}</dd>
                  </>
                )}
                {applyHealth && (
                  <>
                    <dt>Sağlık</dt>
                    <dd>
                      {multiHealth
                        ? TREE_HEALTH_LABELS[multiHealth]
                        : 'Belirtilmedi'}
                    </dd>
                  </>
                )}
                {applyNotes && (
                  <>
                    <dt>Not</dt>
                    <dd>{multiNotes.trim() || '—'}</dd>
                  </>
                )}
              </dl>
              <button
                type="button"
                className="btn primary"
                onClick={() => setEditingMultiForm(true)}
              >
                Bilgileri düzenle
              </button>
            </div>
          ) : (
            <form className="stack" onSubmit={onApplyMulti}>
              <p className="muted small">
                İşaretlediğin alanlar uygulanır. Alanı işaretleyip boş
                bırakırsan o bilgi silinir. Tüm bilgileri silmek için üstteki
                “Bilgileri temizle”yi kullan.
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={applySpecies}
                  onChange={(e) => setApplySpecies(e.target.checked)}
                />
                <span>Çeşit</span>
              </label>
              {applySpecies && (
                <input
                  value={multiSpecies}
                  onChange={(e) => setMultiSpecies(e.target.value)}
                  placeholder="Veri girmek için dokunun.."
                />
              )}

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={applyLabel}
                  onChange={(e) => setApplyLabel(e.target.checked)}
                />
                <span>Etiket / kod</span>
              </label>
              {applyLabel && (
                <input
                  value={multiLabel}
                  onChange={(e) => setMultiLabel(e.target.value)}
                  placeholder="Veri girmek için dokunun.."
                />
              )}

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={applyPlantedAt}
                  onChange={(e) => setApplyPlantedAt(e.target.checked)}
                />
                <span>Dikim tarihi</span>
              </label>
              {applyPlantedAt && (
                <input
                  type="date"
                  value={multiPlantedAt}
                  onChange={(e) => setMultiPlantedAt(e.target.value)}
                />
              )}

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={applyHealth}
                  onChange={(e) => setApplyHealth(e.target.checked)}
                />
                <span>Sağlık</span>
              </label>
              {applyHealth && (
                <select
                  value={multiHealth}
                  onChange={(e) =>
                    setMultiHealth((e.target.value || '') as TreeHealth | '')
                  }
                >
                  <option value="">Belirtilmedi</option>
                  {(Object.keys(TREE_HEALTH_LABELS) as TreeHealth[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {TREE_HEALTH_LABELS[key]}
                      </option>
                    ),
                  )}
                </select>
              )}

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={applyNotes}
                  onChange={(e) => setApplyNotes(e.target.checked)}
                />
                <span>Notlar</span>
              </label>
              {applyNotes && (
                <textarea
                  rows={3}
                  value={multiNotes}
                  onChange={(e) => setMultiNotes(e.target.value)}
                  placeholder="Veri girmek için dokunun.."
                />
              )}

              <button
                className="btn primary"
                type="submit"
                disabled={saving || multiSelected.size === 0}
              >
                {saving
                  ? 'Uygulanıyor…'
                  : `Seçime uygula (${multiSelected.size})`}
              </button>
            </form>
          )}
        </CollapseSection>
      )}

      {!multiSelect && (
        <CollapseSection
          title="Tarla Bilgileri"
          icon={<IconInfo />}
          tone="olive"
          bodyClassName="stack"
        >
          {!editingBulkSpecies ? (
            <div className="info-summary stack">
              <dl className="summary-list">
                {field.area?.trim() && (
                  <>
                    <dt>Yer</dt>
                    <dd>{field.area}</dd>
                  </>
                )}
                <dt>Tarla</dt>
                <dd>{field.name}</dd>
                {field.species?.trim() && (
                  <>
                    <dt>Çeşit</dt>
                    <dd>{field.species}</dd>
                  </>
                )}
                {field.donum !== undefined && (
                  <>
                    <dt>Dönüm</dt>
                    <dd>{field.donum.toLocaleString('tr-TR')}</dd>
                  </>
                )}
                <dt>En</dt>
                <dd>
                  {field.rowCount} satır (A–
                  {rowIndexToLetter(Math.max(0, field.rowCount - 1))})
                </dd>
                <dt>Boy</dt>
                <dd>
                  {field.colCount} sütun (1–{field.colCount})
                </dd>
                <dt>Ağaç</dt>
                <dd>{activeTrees.length}</dd>
              </dl>
              <div className="bulk-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setBulkArea(field.area ?? '')
                    setBulkName(field.name)
                    setBulkSpecies(field.species ?? '')
                    setBulkDonum(
                      field.donum !== undefined ? String(field.donum) : '',
                    )
                    setBulkRowCount(field.rowCount)
                    setBulkColCount(field.colCount)
                    setEditingBulkSpecies(true)
                  }}
                >
                  Bilgileri düzenle
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={saving || emptyCellCount === 0}
                  onClick={() => void onFillEmpty()}
                >
                  Boş hücreleri doldur ({emptyCellCount})
                </button>
              </div>
            </div>
          ) : (
            <form className="bulk-species-form form-grid" onSubmit={onBulkSpecies}>
              <label>
                Yer
                <input
                  value={bulkArea}
                  onChange={(e) => setBulkArea(e.target.value)}
                  placeholder="Veri girmek için dokunun.."
                />
              </label>
              <label>
                Tarla adı
                <input
                  value={bulkName}
                  onChange={(e) => setBulkName(e.target.value)}
                  placeholder="Veri girmek için dokunun.."
                  required
                />
              </label>
              <label>
                Çeşit
                <input
                  value={bulkSpecies}
                  onChange={(e) => setBulkSpecies(e.target.value)}
                  placeholder="Veri girmek için dokunun.."
                  required
                />
              </label>
              <label>
                Dönüm
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={bulkDonum}
                  onChange={(e) => setBulkDonum(e.target.value)}
                  placeholder="Veri girmek için dokunun.."
                />
              </label>
              <label>
                En (satır — harfler)
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={bulkRowCount}
                  onChange={(e) => setBulkRowCount(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Boy (sütun — numaralar)
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={bulkColCount}
                  onChange={(e) => setBulkColCount(Number(e.target.value))}
                  required
                />
              </label>
              <p className="muted small span-2">
                En/boy değiştirmek Tarla İçeriği grid’ini büyütür veya küçültür.
              </p>
              <div className="bulk-actions span-2">
                <button className="btn primary" type="submit" disabled={saving}>
                  {saving
                    ? 'İşleniyor…'
                    : `Kaydet ve ağaçlara uygula (${activeTrees.length})`}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={saving || emptyCellCount === 0}
                  onClick={() => void onFillEmpty()}
                >
                  Boş hücreleri doldur ({emptyCellCount})
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={saving}
                  onClick={() => setEditingBulkSpecies(false)}
                >
                  İptal
                </button>
              </div>
            </form>
          )}
        </CollapseSection>
      )}

      <CollapseSection
        title="Tarla İçeriği"
        icon={<IconGrid />}
        tone="green"
        className={multiSelect ? 'multi-mode' : undefined}
      >
        <div className="field-layout">
          <TreeGrid
            rowCount={field.rowCount}
            colCount={field.colCount}
            treeByCell={treeByCell}
            selectedCell={selectedCell}
            onSelectCell={selectCell}
            multiSelect={multiSelect}
            multiSelected={multiSelected}
            onToggleMulti={toggleMulti}
            onEnableMulti={enableMultiSelect}
            onDisableMulti={disableMultiSelect}
            activeTreeCount={activeTrees.length}
            onSelectAllTrees={selectAllTrees}
            onSelectAllCells={selectAllCells}
            onClearMulti={clearMulti}
          />

          <aside className="cell-panel sticky-panel">
            {multiSelect ? (
              <>
                <SectionTitle icon={<IconSelect />} tone="sky">
                  Seçim özeti
                </SectionTitle>
                <p className="muted">
                  {multiSelected.size === 0
                    ? 'Grid’den dokunarak seçim yap.'
                    : `${multiFilled.length} ağaç güncellenecek, ${multiEmpty.length} boş hücreye ağaç eklenebilir.`}
                </p>
              </>
            ) : (
              <>
                <SectionTitle icon={<IconCell />} tone="green">
                  Hücre
                </SectionTitle>
                {!selectedCell ? (
                  <p className="muted">
                    Tek hücre için dokun. Çoklu düzenleme için “Çoklu seçim”e
                    geç.
                  </p>
                ) : selectedTree ? (
                  editingTree ? (
                    <form className="stack" onSubmit={onSaveTree}>
                      <p>
                        Seçili hücre: <strong>{selectedTree.cell}</strong>
                      </p>
                      <label>
                        Çeşit
                        <input
                          value={editSpecies}
                          onChange={(e) => setEditSpecies(e.target.value)}
                          placeholder="Veri girmek için dokunun.."
                        />
                      </label>
                      <label>
                        Etiket / kod
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Veri girmek için dokunun.."
                        />
                      </label>
                      <label>
                        Dikim tarihi
                        <input
                          type="date"
                          value={editPlantedAt}
                          onChange={(e) => setEditPlantedAt(e.target.value)}
                        />
                      </label>
                      {formatTreeAge(editPlantedAt) && (
                        <p className="muted small">
                          Yaş: <strong>{formatTreeAge(editPlantedAt)}</strong>
                        </p>
                      )}
                      <label>
                        Sağlık
                        <select
                          value={editHealth}
                          onChange={(e) =>
                            setEditHealth(
                              (e.target.value || '') as TreeHealth | '',
                            )
                          }
                        >
                          <option value="">Belirtilmedi</option>
                          {(
                            Object.keys(TREE_HEALTH_LABELS) as TreeHealth[]
                          ).map((key) => (
                            <option key={key} value={key}>
                              {TREE_HEALTH_LABELS[key]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Notlar
                        <textarea
                          rows={4}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Veri girmek için dokunun.."
                        />
                      </label>
                      <button
                        className="btn primary"
                        type="submit"
                        disabled={saving}
                      >
                        {saving ? 'Kaydediliyor…' : 'Bilgileri kaydet'}
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setEditingTree(false)}
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={saving}
                        onClick={() => void onRemoveTree()}
                      >
                        Ağacı kaldır
                      </button>
                    </form>
                  ) : (
                    <div className="info-summary stack">
                      <p>
                        Seçili hücre: <strong>{selectedTree.cell}</strong>
                      </p>
                      <dl className="summary-list">
                        <dt>Çeşit</dt>
                        <dd>{selectedTree.species || '—'}</dd>
                        <dt>Etiket</dt>
                        <dd>{selectedTree.label || '—'}</dd>
                        <dt>Dikim</dt>
                        <dd>{selectedTree.plantedAt || '—'}</dd>
                        <dt>Yaş</dt>
                        <dd>{formatTreeAge(selectedTree.plantedAt) || '—'}</dd>
                        <dt>Sağlık</dt>
                        <dd>
                          {selectedTree.health
                            ? TREE_HEALTH_LABELS[selectedTree.health]
                            : '—'}
                        </dd>
                        <dt>Not</dt>
                        <dd>{selectedTree.notes || '—'}</dd>
                      </dl>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => setEditingTree(true)}
                      >
                        Bilgileri düzenle
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={saving}
                        onClick={() => void onRemoveTree()}
                      >
                        Ağacı kaldır
                      </button>
                    </div>
                  )
                ) : (
                  <form className="stack" onSubmit={onAddTree}>
                    <p>
                      Seçili hücre: <strong>{selectedCell}</strong>
                    </p>
                    <label>
                      Tür / çeşit
                      <input
                        value={species}
                        onChange={(e) => setSpecies(e.target.value)}
                        placeholder="Veri girmek için dokunun.."
                      />
                    </label>
                    <label>
                      Not
                      <input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Veri girmek için dokunun.."
                      />
                    </label>
                    <button
                      className="btn primary"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? 'Kaydediliyor…' : 'Ağaç ekle'}
                    </button>
                  </form>
                )}
              </>
            )}
          </aside>
        </div>
      </CollapseSection>

      {farmId && (
        <CollapseSection title="Tarla Haritası" icon={<IconMap />} tone="teal">
          <FieldMapImagePanel
            farmId={farmId}
            fieldId={field.id}
            mapImageDataUrl={field.mapImageDataUrl}
            mapFileName={field.mapFileName}
            mapUpdatedAt={field.mapUpdatedAt}
          />
        </CollapseSection>
      )}
    </div>
  )
}
