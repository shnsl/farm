import { useMemo, type CSSProperties } from 'react'
import { buildRowLetters, formatCell } from '../../lib/cells'
import { formatTreeAge } from '../../lib/treeAge'
import type { Tree } from '../../types'
import { speciesColor } from './speciesColor'

function treeHasInfo(tree: Tree): boolean {
  return Boolean(
    tree.species?.trim() ||
      tree.label?.trim() ||
      tree.plantedAt?.trim() ||
      tree.health ||
      tree.notes?.trim(),
  )
}

interface TreeGridProps {
  rowCount: number
  colCount: number
  treeByCell: Map<string, Tree>
  selectedCell: string | null
  onSelectCell: (cell: string) => void
  multiSelect: boolean
  multiSelected: Set<string>
  onToggleMulti: (cell: string) => void
  onEnableMulti: () => void
  onDisableMulti: () => void
  activeTreeCount: number
  onSelectAllTrees: () => void
  onSelectAllCells: () => void
  onClearMulti: () => void
}

export function TreeGrid({
  rowCount,
  colCount,
  treeByCell,
  selectedCell,
  onSelectCell,
  multiSelect,
  multiSelected,
  onToggleMulti,
  onEnableMulti,
  onDisableMulti,
  activeTreeCount,
  onSelectAllTrees,
  onSelectAllCells,
  onClearMulti,
}: TreeGridProps) {
  const rows = buildRowLetters(rowCount)
  const cols = Array.from({ length: colCount }, (_, i) => i + 1)

  const legend = useMemo(() => {
    const counts = new Map<string, { label: string; color: string; count: number }>()
    for (const tree of treeByCell.values()) {
      if (tree.status !== 'active') continue
      const label = tree.species?.trim() || 'Belirtilmedi'
      const current = counts.get(label)
      if (current) current.count += 1
      else {
        counts.set(label, {
          label,
          color: speciesColor(tree.species),
          count: 1,
        })
      }
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr'),
    )
  }, [treeByCell])

  return (
    <div className="grid-column">
      <div className="grid-toolbar">
        {multiSelect ? (
          <>
            <button
              type="button"
              className="btn ghost btn-compact"
              onClick={onDisableMulti}
            >
              Tekli seçim
            </button>
            <button
              type="button"
              className="btn ghost btn-compact"
              onClick={onSelectAllTrees}
            >
              Tüm ağaçlar ({activeTreeCount})
            </button>
            <button
              type="button"
              className="btn ghost btn-compact"
              onClick={onSelectAllCells}
            >
              Tüm hücreler
            </button>
            <button
              type="button"
              className="btn ghost btn-compact"
              onClick={onClearMulti}
              disabled={multiSelected.size === 0}
            >
              Temizle ({multiSelected.size})
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn primary btn-compact"
            onClick={onEnableMulti}
          >
            Çoklu seçim
          </button>
        )}
      </div>

      {legend.length > 0 && (
        <ul className="species-legend" aria-label="Çeşit renkleri">
          {legend.map((item) => (
            <li key={item.label}>
              <span
                className="species-legend-swatch"
                style={{ background: item.color }}
                aria-hidden
              />
              <span>
                {item.label}{' '}
                <span className="muted">({item.count})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid-wrap">
        <div
          className="tree-grid"
          style={{
            gridTemplateColumns: `2.5rem repeat(${colCount}, minmax(1.75rem, 2.25rem))`,
          }}
        >
          <div className="corner" aria-hidden />
          {cols.map((col) => (
            <div key={`h-${col}`} className="col-head">
              {col}
            </div>
          ))}

          {rows.flatMap((row) => [
            <div key={`r-${row}`} className="row-head">
              {row}
            </div>,
            ...cols.map((col) => {
              const cell = formatCell(row, col)
              const tree = treeByCell.get(cell)
              const hasInfo = tree ? treeHasInfo(tree) : false
              const selected = multiSelect
                ? multiSelected.has(cell)
                : selectedCell === cell
              const color = tree ? speciesColor(tree.species) : undefined
              return (
                <button
                  key={cell}
                  type="button"
                  className={[
                    'cell',
                    tree ? 'filled' : 'empty',
                    hasInfo ? 'has-info' : '',
                    selected
                      ? multiSelect
                        ? 'multi-selected'
                        : 'selected'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    color
                      ? ({ ['--species']: color } as CSSProperties)
                      : undefined
                  }
                  title={
                    tree
                      ? [
                          cell,
                          tree.species || tree.label || 'ağaç',
                          formatTreeAge(tree.plantedAt),
                        ]
                          .filter(Boolean)
                          .join(' — ')
                      : cell
                  }
                  aria-label={cell}
                  aria-pressed={selected}
                  onClick={() =>
                    multiSelect ? onToggleMulti(cell) : onSelectCell(cell)
                  }
                />
              )
            }),
          ])}
        </div>
      </div>
      <p className="muted small grid-hint">
        {multiSelect
          ? 'Çoklu seçim açık: dokunarak seç / kaldır.'
          : 'Yatay kaydırarak boyundaki sütunları gez.'}
      </p>
    </div>
  )
}
