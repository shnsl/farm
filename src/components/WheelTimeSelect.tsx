import { useEffect, useMemo, useState } from 'react'
import {
  WheelColumn,
  WheelPickerShell,
  WheelSelectTrigger,
  type WheelOption,
} from './WheelSelect'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function parseTime(value: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function nowParts() {
  const d = new Date()
  return { hour: d.getHours(), minute: d.getMinutes() }
}

function formatTimeLabel(value: string) {
  const p = parseTime(value)
  if (!p) return value
  return `${pad2(p.hour)}:${pad2(p.minute)}`
}

export function WheelTimeSelect({
  value,
  onChange,
  title = 'Saat',
  placeholder = 'Saat seç…',
  required = false,
  disabled = false,
  minuteStep = 1,
}: {
  value: string
  onChange: (value: string) => void
  title?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  /** Dakika adımı (1 veya 5 gibi) */
  minuteStep?: number
}) {
  const [open, setOpen] = useState(false)
  const step = minuteStep > 0 ? minuteStep : 1
  const now = nowParts()

  const [hour, setHour] = useState(pad2(now.hour))
  const [minute, setMinute] = useState(pad2(now.minute))

  useEffect(() => {
    if (!open) return
    const p = parseTime(value) ?? nowParts()
    setHour(pad2(p.hour))
    const snapped = Math.round(p.minute / step) * step
    setMinute(pad2(Math.min(59, snapped)))
  }, [open, value, step])

  const hourOptions = useMemo<WheelOption[]>(() => {
    const list: WheelOption[] = []
    for (let h = 0; h < 24; h += 1) {
      list.push({ value: pad2(h), label: pad2(h) })
    }
    return list
  }, [])

  const minuteOptions = useMemo<WheelOption[]>(() => {
    const list: WheelOption[] = []
    for (let m = 0; m < 60; m += step) {
      list.push({ value: pad2(m), label: pad2(m) })
    }
    return list
  }, [step])

  const label = value ? formatTimeLabel(value) : placeholder

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
          onChange(`${hour}:${minute}`)
          setOpen(false)
        }}
      >
        <div className="wheel-sheet-columns wheel-sheet-columns--time">
          <WheelColumn options={hourOptions} value={hour} onChange={setHour} />
          <div className="wheel-time-sep" aria-hidden>
            :
          </div>
          <WheelColumn
            options={minuteOptions}
            value={minute}
            onChange={setMinute}
          />
        </div>
      </WheelPickerShell>
    </>
  )
}
