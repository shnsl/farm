import type { ReactNode } from 'react'
import {
  defaultHarvestSpecies,
  harvestProductsForTreeSpecies,
} from './harvestProducts'

interface HarvestSpeciesInputProps {
  treeSpecies?: string | null
  value: string
  onChange: (value: string) => void
  /** Düzenlemede listede olmayan eski değer (ör. “Fıstık”) */
  allowExtraValue?: boolean
  label?: ReactNode
}

export function HarvestSpeciesInput({
  treeSpecies,
  value,
  onChange,
  allowExtraValue = false,
  label = 'Çeşit',
}: HarvestSpeciesInputProps) {
  const options = harvestProductsForTreeSpecies(treeSpecies)
  const extra =
    allowExtraValue &&
    value.trim() &&
    options &&
    !options.includes(value.trim())
      ? value.trim()
      : null

  if (options) {
    return (
      <label>
        {label}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Seç…</option>
          {extra && (
            <option value={extra}>
              {extra} (eski)
            </option>
          )}
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Depoya işlenecek çeşit"
      />
    </label>
  )
}

export { defaultHarvestSpecies, harvestProductsForTreeSpecies }
