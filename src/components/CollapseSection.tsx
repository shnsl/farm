import { useState, type ReactNode } from 'react'
import { HeadingIcon, type IconTone } from './Icons'

export function CollapseSection({
  title,
  icon,
  tone = 'green',
  defaultOpen = false,
  className,
  bodyClassName,
  children,
}: {
  title: string
  icon: ReactNode
  tone?: IconTone
  defaultOpen?: boolean
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={[
        'collapse-section',
        open ? 'is-open' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
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
      {open && (
        <div
          className={['collapse-body', bodyClassName ?? '']
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      )}
    </div>
  )
}
