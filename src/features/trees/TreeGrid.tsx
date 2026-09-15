import { useState } from 'react'
import { buildRowLetters, formatCell } from '../../lib/cells'
import { formatTreeAge } from '../../lib/treeAge'
import type { Tree } from '../../types'

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
  const [gridVisible, setGridVisible] = useState(false)
  const rows = buildRowLetters(rowCount)
  const cols = Array.from({ length: colCount }, (_, i) => i + 1)

  return (
    <div className={`grid-wrap panel${multiSelect ? ' multi-mode' : ''}`}>
      <div className="grid-toolbar">
        <button
          type="button"
          className="btn ghost btn-compact"
          onClick={() => setGridVisible((v) => !v)}
          aria-pressed={gridVisible}
        >
          {gridVisible ? 'Gizle' : 'Göster'}
        </button>
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

      {gridVisible ? (
        <>
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
          <p className="muted small grid-hint">
            {multiSelect
              ? 'Çoklu seçim açık: dokunarak seç / kaldır.'
              : 'Yatay kaydırarak boyundaki sütunları gez.'}
          </p>
        </>
      ) : (
        <p className="muted small grid-hint">
          Grid gizli. Açmak için Göster’e bas.
        </p>
      )}
    </div>
  )
}
