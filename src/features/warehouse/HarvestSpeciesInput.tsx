import type { ReactNode } from 'react'
import { WheelSelect } from '../../components/WheelSelect'
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
  const valueKey = value.trim().toLocaleLowerCase('tr-TR')
  const knownOption = options?.find(
    (opt) => opt.toLocaleLowerCase('tr-TR') === valueKey,
  )
  const extra =
    allowExtraValue &&
    value.trim() &&
    options &&
    !knownOption
      ? value.trim()
      : null

  if (options) {
    const wheelOptions = [
      { value: '', label: 'Seç…' },
      ...(extra ? [{ value: extra, label: `${extra} (eski)` }] : []),
      ...options.map((opt) => ({ value: opt, label: opt })),
    ]
    return (
      <label>
        {label}
        <WheelSelect
          title="Çeşit"
          value={knownOption ?? value}
          onChange={onChange}
          options={wheelOptions}
          placeholder="Seç…"
        />
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
