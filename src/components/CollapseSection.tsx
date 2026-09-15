import { useState, type ReactNode } from 'react'
import { HeadingIcon, type IconTone } from './Icons'

export function CollapseSection({
  title,
  icon,
  tone = 'green',
  defaultOpen = false,
  children,
}: {
  title: string
  icon: ReactNode
  tone?: IconTone
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`collapse-section${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="collapse-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapse-toggle-label">
          <HeadingIcon tone={tone}>{icon}</HeadingIcon>
          <span>{title}</span>
        </span>
        <span className="collapse-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  )
}
