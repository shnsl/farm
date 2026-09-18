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

export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4.5 3.5 7v12.5L9 17l6 2.5 5.5-2.5V4.5L15 7 9 4.5Z" />
      <path d="M9 4.5v12.5M15 7v12.5" />
    </Svg>
  )
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  )
}

export function IconCell(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 14h16M10 4v16M14 4v16" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconFurrows(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7h18" />
      <path d="M3 12h18" />
      <path d="M3 17h18" />
      <path d="M6 5v4M12 10v4M18 15v4" />
    </Svg>
  )
}

export function IconFertilizer(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 8h8l1.5 12H6.5L8 8Z" />
      <path d="M9 8V6.5A3 3 0 0 1 12 3.5 3 3 0 0 1 15 6.5V8" />
      <path d="M10 13h4M10 16h4" />
    </Svg>
  )
}

export function IconDrop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5c3.5 4.2 6 7.2 6 10a6 6 0 0 1-12 0c0-2.8 2.5-5.8 6-10Z" />
      <path d="M10 15.5c.5 1.2 1.5 2 2.5 2" />
    </Svg>
  )
}

export function IconBranch(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 20V9" />
      <path d="M6 12h5a3 3 0 0 0 3-3V5" />
      <path d="M6 16h7a3 3 0 0 1 3 3v1" />
      <circle cx="15" cy="4.5" r="1.5" />
      <circle cx="17.5" cy="20" r="1.5" />
    </Svg>
  )
}

export function IconSoil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 16c2-2 4-3 6-3s4 1 6 3 4 3 6 3" />
      <path d="M3 20h18" />
      <path d="M8 13c.5-2 1.5-4 4-7 2.5 3 3.5 5 4 7" />
      <path d="M10 9.5h4" />
    </Svg>
  )
}

export function IconChart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19h16" />
      <path d="M7 16V10" />
      <path d="M12 16V6" />
      <path d="M17 16v-4" />
    </Svg>
  )
}

export function IconTrend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 18 10 12l4 3 6-8" />
      <path d="M15 7h5v5" />
    </Svg>
  )
}

export function IconGraph(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7 14c2-3 4-5 5-5s3 3 5 1 2-4 3-4" />
    </Svg>
  )
}

export function IconPie(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5V12l6 6" />
    </Svg>
  )
}

export function IconFont(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 18 10 6h2l5 12" />
      <path d="M7.5 13h7" />
      <path d="M16 18h3" />
    </Svg>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M8 14h3M13 14h3M8 17h3" />
    </Svg>
  )
}

export function IconArea(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7h14v10H5Z" />
      <path d="M5 7 3 5M19 7l2-2M5 17l-2 2M19 17l2 2" />
      <path d="M9 11h6v4H9Z" />
    </Svg>
  )
}

export function IconVariety(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 20v-5" />
      <path d="M7 15c-2 0-3.5-1.5-3.5-3.2S5 8.5 7 8.5s3.5 1.3 3.5 3.3S9 15 7 15Z" />
      <path d="M16 20v-6" />
      <path d="M16 14c-2.4 0-4-1.7-4-3.6S13.6 7 16 7s4 1.5 4 3.4S18.4 14 16 14Z" />
      <path d="M11.5 9.5c.8-.8 1.8-1.2 2.8-1.3" />
    </Svg>
  )
}

export function IconWallet(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17V8.5Z" />
      <path d="M16 13.5h4" />
      <circle cx="16.5" cy="13.5" r="1" />
    </Svg>
  )
}

export function IconSelect(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <path d="m5.8 7.5 1.4 1.4 2.5-2.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <path d="m5.8 16.5 1.4 1.4 2.5-2.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Svg>
  )
}

export function IconClipboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="5" width="12" height="16" rx="2" />
      <path d="M9 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
      <path d="M9 11h6M9 15h6" />
    </Svg>
  )
}

export function IconHistory(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 5.5v4h4" />
      <path d="M12 8v4.5l3 1.5" />
    </Svg>
  )
}

export function IconNotebook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4h11a2 2 0 0 1 2 2v14H9a2 2 0 0 0-2 2" />
      <path d="M7 4a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h11" />
      <path d="M10 9h6M10 13h6" />
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

export function IconFuel(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16" />
      <path d="M5 21h12" />
      <path d="M9 8h4" />
      <path d="M15 10h2.5a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2" />
      <path d="M21.5 18v-2" />
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

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="9" r="3.2" />
      <circle cx="15.5" cy="7.5" r="2.6" />
      <circle cx="16" cy="14.5" r="3" />
      <circle cx="8.5" cy="16" r="2.4" />
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

export function IconLogout(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M15 8l4 4-4 4" />
      <path d="M10 12h9" />
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
