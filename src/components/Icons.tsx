import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconFields(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 19h18" />
      <path d="M5 19V9l7-5 7 5v10" />
      <path d="M9 19v-6h6v6" />
    </Svg>
  )
}

export function IconTree(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21v-7" />
      <path d="M12 14c-3.5 0-5.5-2.2-5.5-4.8 0-2.2 1.5-3.7 3.2-4.5C10.2 3.2 11 2.5 12 2.5s1.8.7 2.3 2.2c1.7.8 3.2 2.3 3.2 4.5 0 2.6-2 4.8-5.5 4.8Z" />
      <path d="M9.5 11.5c.8.6 1.7.9 2.5.9s1.7-.3 2.5-.9" />
    </Svg>
  )
}

export function IconPlow(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 17h10" />
      <path d="M4 17c0-3 2-5 5-5h2" />
      <path d="M13 12v5" />
      <path d="M13 12l5-5" />
      <path d="M16 7h5v2" />
      <circle cx="18.5" cy="17" r="2" />
    </Svg>
  )
}

export function IconHarvest(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 10c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <path d="M6.5 10h11l-1.2 8.2a2 2 0 0 1-2 1.8h-4.6a2 2 0 0 1-2-1.8L6.5 10Z" />
      <path d="M12 6V3" />
      <path d="M10 3.5c1-.8 3-.8 4 0" />
    </Svg>
  )
}

export function IconCompare(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19V9" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
      <path d="M3 19h18" />
    </Svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.5 16.5 21 21" />
    </Svg>
  )
}

export function IconZoomOut(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="5.75" />
      <path d="M15.2 15.2 20 20" />
      <path d="M8 10.5h5" />
    </Svg>
  )
}

export function IconZoomIn(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="5.75" />
      <path d="M15.2 15.2 20 20" />
      <path d="M10.5 8v5M8 10.5h5" />
    </Svg>
  )
}

export function IconZoomReset(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9V5h4" />
      <path d="M20 9V5h-4" />
      <path d="M4 15v4h4" />
      <path d="M20 15v4h-4" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </Svg>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.1l1.6 1.5M17.5 15.4l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 16.9l1.6-1.5M17.5 8.6l1.6-1.5" />
    </Svg>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}

export function IconLeaf(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19c8-1 12-6 14-14-8 2-13 6-14 14Z" />
      <path d="M5 19c2-4 6-7 11-9" />
    </Svg>
  )
}

export function IconPrune(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="7" cy="17" r="2.5" />
      <path d="M9.2 8.5 20 17" />
      <path d="M9.2 15.5 20 7" />
      <path d="M7 9.5v5" />
    </Svg>
  )
}

export function IconHoe(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 21 14 8" />
      <path d="M12.5 10.5 19 7l1.5 3-6 4.5" />
      <path d="M4 19h8" />
    </Svg>
  )
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 9 4.2-1.2 7-4.5 7-9V6l-7-3Z" />
      <path d="M9.5 12.2 11.2 14l3.3-3.5" />
    </Svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </Svg>
  )
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </Svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16.5 14.5A6.5 6.5 0 0 1 9.2 5.8 7 7 0 1 0 16.5 14.5Z" />
    </Svg>
  )
}

export function IconList(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 7h12M8 12h12M8 17h12" />
      <path d="M4 7h.01M4 12h.01M4 17h.01" />
    </Svg>
  )
}

export function IconPencil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m14.5 4.5 5 5L9 20H4v-5L14.5 4.5Z" />
      <path d="m12.5 6.5 5 5" />
    </Svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  )
}

export type IconTone =
  | 'green'
  | 'amber'
  | 'sky'
  | 'rose'
  | 'violet'
  | 'teal'
  | 'olive'

export function HeadingIcon({
  tone = 'green',
  children,
}: {
  tone?: IconTone
  children: ReactNode
}) {
  return <span className={`heading-icon tone-${tone}`}>{children}</span>
}

export function PageTitle({
  icon,
  tone = 'green',
  children,
}: {
  icon: ReactNode
  tone?: IconTone
  children: ReactNode
}) {
  return (
    <h1 className="page-title-with-icon">
      <HeadingIcon tone={tone}>{icon}</HeadingIcon>
      <span>{children}</span>
    </h1>
  )
}

export function SectionTitle({
  icon,
  tone = 'green',
  as: Tag = 'h2',
  children,
}: {
  icon: ReactNode
  tone?: IconTone
  as?: 'h2' | 'h3'
  children: ReactNode
}) {
  return (
    <Tag className="section-title-with-icon">
      <HeadingIcon tone={tone}>{icon}</HeadingIcon>
      <span>{children}</span>
    </Tag>
  )
}
