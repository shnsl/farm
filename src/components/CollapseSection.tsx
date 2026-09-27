import { useEffect, useState, type ReactNode } from 'react'
import { useFocusNav } from '../lib/focusNav'
import { HeadingIcon, type IconTone } from './Icons'

export function CollapseSection({
  title,
  icon,
  tone = 'green',
  defaultOpen = false,
  sectionId,
  className,
  bodyClassName,
  children,
}: {
  title: string
  icon: ReactNode
  tone?: IconTone
  defaultOpen?: boolean
  /** Arama odağında otomatik açılacak bölüm kimliği */
  sectionId?: string
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  const focus = useFocusNav()
  const forceOpen = Boolean(
    sectionId && focus?.openSections.has(sectionId),
  )
  const [open, setOpen] = useState(defaultOpen || forceOpen)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen, focus?.token])

  return (
    <div
      className={[
        'collapse-section',
        open ? 'is-open' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-section-id={sectionId || undefined}
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
