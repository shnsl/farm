import { useEffect, useMemo, useState } from 'react'
import {
  WheelColumn,
  WheelPickerShell,
  WheelSelectTrigger,
  type WheelOption,
} from './WheelSelect'

const MONTHS_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function parseDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!year || month < 1 || month > 12 || day < 1) return null
  const max = daysInMonth(year, month)
  return { year, month, day: Math.min(day, max) }
}

function todayParts() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

function toValue(year: number, month: number, day: number) {
  const max = daysInMonth(year, month)
  return `${year}-${pad2(month)}-${pad2(Math.min(day, max))}`
}

function formatDateLabel(value: string) {
  const p = parseDate(value)
  if (!p) return value
  return `${p.day} ${MONTHS_TR[p.month - 1]} ${p.year}`
}

export function WheelDateSelect({
  value,
  onChange,
  title = 'Tarih',
  placeholder = 'Tarih seç…',
  required = false,
  disabled = false,
  minYear,
  maxYear,
}: {
  value: string
  onChange: (value: string) => void
  title?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  minYear?: number
  maxYear?: number
}) {
  const [open, setOpen] = useState(false)
  const now = todayParts()
  const yMin = minYear ?? now.year - 80
  const yMax = maxYear ?? now.year + 10

  const [year, setYear] = useState(String(now.year))
  const [month, setMonth] = useState(pad2(now.month))
  const [day, setDay] = useState(pad2(now.day))

  useEffect(() => {
    if (!open) return
    const p = parseDate(value) ?? todayParts()
    setYear(String(Math.min(yMax, Math.max(yMin, p.year))))
    setMonth(pad2(p.month))
    setDay(pad2(p.day))
  }, [open, value, yMin, yMax])

  const yearOptions = useMemo<WheelOption[]>(() => {
    const list: WheelOption[] = []
    for (let y = yMax; y >= yMin; y -= 1) {
      list.push({ value: String(y), label: String(y) })
    }
    return list
  }, [yMin, yMax])

  const monthOptions = useMemo<WheelOption[]>(
    () =>
      MONTHS_TR.map((label, i) => ({
        value: pad2(i + 1),
        label,
      })),
    [],
  )

  const dayOptions = useMemo<WheelOption[]>(() => {
    const max = daysInMonth(Number(year), Number(month))
    const list: WheelOption[] = []
    for (let d = 1; d <= max; d += 1) {
      list.push({ value: pad2(d), label: String(d) })
    }
    return list
  }, [year, month])

  useEffect(() => {
    if (Number(day) > dayOptions.length) {
      setDay(pad2(dayOptions.length))
    }
  }, [day, dayOptions.length])

  const label = value ? formatDateLabel(value) : placeholder

  return (
    <>
      <WheelSelectTrigger
        label={label}
        placeholder={placeholder}
        disabled={disabled}
        open={open}
        onOpen={() => setOpen(true)}
        required={required}
        value={value}
      />
      <WheelPickerShell
        open={open}
        title={title}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onChange(toValue(Number(year), Number(month), Number(day)))
          setOpen(false)
        }}
      >
        <div className="wheel-sheet-columns">
          <WheelColumn options={dayOptions} value={day} onChange={setDay} />
          <WheelColumn
            options={monthOptions}
            value={month}
            onChange={setMonth}
          />
          <WheelColumn options={yearOptions} value={year} onChange={setYear} />
        </div>
      </WheelPickerShell>
    </>
  )
}
