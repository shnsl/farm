export type AccentId =
  | 'green'
  | 'teal'
  | 'blue'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'olive'

export type ThemeMode = 'light' | 'dark'

export type AccentPalette = {
  brand: string
  brandStrong: string
  filled: string
  bg: string
  bgAccent: string
  surface: string
  ink: string
  muted: string
  line: string
  cellEmpty: string
  cellEmptyBorder: string
  successBg: string
  successBorder: string
  glow: string
  bgTop: string
  bgBottom: string
  swatch: string
}

export type AccentOption = {
  id: AccentId
  label: string
  light: AccentPalette
  dark: AccentPalette
}

export const DEFAULT_ACCENT_ID: AccentId = 'green'

export const APP_ACCENTS: AccentOption[] = [
  {
    id: 'green',
    label: 'Yeşil',
    light: {
      brand: '#2f5d3a',
      brandStrong: '#23482c',
      filled: '#3f7a4c',
      bg: '#eef3ea',
      bgAccent: '#d9e6d0',
      surface: '#fbfcf8',
      ink: '#1c2a1f',
      muted: '#5b6b5e',
      line: '#c5d2bf',
      cellEmpty: '#edf2e9',
      cellEmptyBorder: '#d5e0cf',
      successBg: '#e8f3ea',
      successBorder: '#b9d4be',
      glow: 'rgba(63, 122, 76, 0.14)',
      bgTop: '#f5f8f2',
      bgBottom: '#e7efe2',
      swatch: '#3f7a4c',
    },
    dark: {
      brand: '#6faf7d',
      brandStrong: '#8ec79a',
      filled: '#3d8f55',
      bg: '#121a14',
      bgAccent: '#1e2c22',
      surface: '#1a2420',
      ink: '#e6efe6',
      muted: '#9bb09e',
      line: '#2f4035',
      cellEmpty: '#243029',
      cellEmptyBorder: '#355040',
      successBg: '#1d3224',
      successBorder: '#3d6a4a',
      glow: 'rgba(111, 175, 125, 0.14)',
      bgTop: '#152019',
      bgBottom: '#0f1611',
      swatch: '#6faf7d',
    },
  },
  {
    id: 'teal',
    label: 'Turkuaz',
    light: {
      brand: '#0f6568',
      brandStrong: '#0a4d50',
      filled: '#1a8588',
      bg: '#eaf5f5',
      bgAccent: '#cfe6e6',
      surface: '#f7fcfc',
      ink: '#163032',
      muted: '#4f6e70',
      line: '#b9d4d4',
      cellEmpty: '#e6f2f2',
      cellEmptyBorder: '#c5dddd',
      successBg: '#e4f4f4',
      successBorder: '#a9d4d4',
      glow: 'rgba(26, 133, 136, 0.14)',
      bgTop: '#f2fafa',
      bgBottom: '#ddeeee',
      swatch: '#1a8588',
    },
    dark: {
      brand: '#4eb8bb',
      brandStrong: '#6ecacc',
      filled: '#2a8f92',
      bg: '#101a1b',
      bgAccent: '#1a2c2e',
      surface: '#172426',
      ink: '#e4f2f2',
      muted: '#8fb3b5',
      line: '#2c4244',
      cellEmpty: '#203234',
      cellEmptyBorder: '#355052',
      successBg: '#1a3335',
      successBorder: '#356568',
      glow: 'rgba(78, 184, 187, 0.14)',
      bgTop: '#142022',
      bgBottom: '#0d1516',
      swatch: '#4eb8bb',
    },
  },
  {
    id: 'blue',
    label: 'Mavi',
    light: {
      brand: '#2a5085',
      brandStrong: '#1e3a62',
      filled: '#3d6aad',
      bg: '#eef2f8',
      bgAccent: '#d5e0ef',
      surface: '#f8fafc',
      ink: '#1a2438',
      muted: '#55657a',
      line: '#c2cede',
      cellEmpty: '#e8eef6',
      cellEmptyBorder: '#c8d4e4',
      successBg: '#e6eef8',
      successBorder: '#b4c8e0',
      glow: 'rgba(61, 106, 173, 0.14)',
      bgTop: '#f4f7fb',
      bgBottom: '#e3eaf4',
      swatch: '#3d6aad',
    },
    dark: {
      brand: '#6b9fd4',
      brandStrong: '#8bb5e0',
      filled: '#3d74b0',
      bg: '#121722',
      bgAccent: '#1c2636',
      surface: '#182030',
      ink: '#e6eef8',
      muted: '#95a8c0',
      line: '#2e3c52',
      cellEmpty: '#222c3e',
      cellEmptyBorder: '#364860',
      successBg: '#1c2c40',
      successBorder: '#3a5474',
      glow: 'rgba(107, 159, 212, 0.14)',
      bgTop: '#161d2a',
      bgBottom: '#0e131c',
      swatch: '#6b9fd4',
    },
  },
  {
    id: 'amber',
    label: 'Amber',
    light: {
      brand: '#8a5a1c',
      brandStrong: '#6b4514',
      filled: '#b07a28',
      bg: '#f7f1e8',
      bgAccent: '#eadcc8',
      surface: '#fcfaf6',
      ink: '#2c2114',
      muted: '#6e5b45',
      line: '#d8c8b0',
      cellEmpty: '#f3ebe0',
      cellEmptyBorder: '#dfd0ba',
      successBg: '#f3ebdf',
      successBorder: '#d4c0a0',
      glow: 'rgba(176, 122, 40, 0.14)',
      bgTop: '#faf6f0',
      bgBottom: '#efe4d4',
      swatch: '#b07a28',
    },
    dark: {
      brand: '#d4a05c',
      brandStrong: '#e0b878',
      filled: '#b8863a',
      bg: '#1a1610',
      bgAccent: '#2c2418',
      surface: '#241e16',
      ink: '#f3ebe0',
      muted: '#b5a288',
      line: '#433828',
      cellEmpty: '#32281c',
      cellEmptyBorder: '#4a3e2c',
      successBg: '#322818',
      successBorder: '#5c4a2e',
      glow: 'rgba(212, 160, 92, 0.14)',
      bgTop: '#211c14',
      bgBottom: '#14100c',
      swatch: '#d4a05c',
    },
  },
  {
    id: 'rose',
    label: 'Gül',
    light: {
      brand: '#8b3a4a',
      brandStrong: '#6e2d3a',
      filled: '#a84d5e',
      bg: '#f6eef0',
      bgAccent: '#e8d4d9',
      surface: '#fcf8f9',
      ink: '#2c1a20',
      muted: '#6e525a',
      line: '#d8c0c6',
      cellEmpty: '#f2e6e9',
      cellEmptyBorder: '#e0ccd1',
      successBg: '#f2e6ea',
      successBorder: '#d4b4bc',
      glow: 'rgba(168, 77, 94, 0.14)',
      bgTop: '#faf4f6',
      bgBottom: '#eedfe3',
      swatch: '#a84d5e',
    },
    dark: {
      brand: '#d48494',
      brandStrong: '#e0a0ac',
      filled: '#b85a6c',
      bg: '#1a1216',
      bgAccent: '#2c1e24',
      surface: '#24181e',
      ink: '#f4e8ec',
      muted: '#b898a0',
      line: '#443038',
      cellEmpty: '#322028',
      cellEmptyBorder: '#4a3440',
      successBg: '#322028',
      successBorder: '#5c3848',
      glow: 'rgba(212, 132, 148, 0.14)',
      bgTop: '#21161a',
      bgBottom: '#140e12',
      swatch: '#d48494',
    },
  },
  {
    id: 'violet',
    label: 'Mor',
    light: {
      brand: '#5a3d7a',
      brandStrong: '#452e5e',
      filled: '#6f4f96',
      bg: '#f2eef6',
      bgAccent: '#ddd2ea',
      surface: '#faf8fc',
      ink: '#24182f',
      muted: '#655575',
      line: '#cdc0da',
      cellEmpty: '#ece6f4',
      cellEmptyBorder: '#d4c8e2',
      successBg: '#ece4f4',
      successBorder: '#c8b4dc',
      glow: 'rgba(111, 79, 150, 0.14)',
      bgTop: '#f7f4fa',
      bgBottom: '#e8e0f0',
      swatch: '#6f4f96',
    },
    dark: {
      brand: '#a88cc8',
      brandStrong: '#bfa6d8',
      filled: '#7a5aa0',
      bg: '#16121c',
      bgAccent: '#261e32',
      surface: '#1e1828',
      ink: '#eee6f6',
      muted: '#a898b8',
      line: '#3a3048',
      cellEmpty: '#2a2238',
      cellEmptyBorder: '#403050',
      successBg: '#2a2038',
      successBorder: '#4a3860',
      glow: 'rgba(168, 140, 200, 0.14)',
      bgTop: '#1c1624',
      bgBottom: '#100e16',
      swatch: '#a88cc8',
    },
  },
  {
    id: 'olive',
    label: 'Zeytin',
    light: {
      brand: '#5c6b2f',
      brandStrong: '#465322',
      filled: '#738a3a',
      bg: '#f2f3ea',
      bgAccent: '#dde0cb',
      surface: '#fafbf6',
      ink: '#24281a',
      muted: '#62684f',
      line: '#ccd1b6',
      cellEmpty: '#eef0e4',
      cellEmptyBorder: '#d6dabe',
      successBg: '#ecefdc',
      successBorder: '#c8d0a8',
      glow: 'rgba(115, 138, 58, 0.14)',
      bgTop: '#f6f7f0',
      bgBottom: '#e6e9d8',
      swatch: '#738a3a',
    },
    dark: {
      brand: '#a8b86a',
      brandStrong: '#bcc78a',
      filled: '#7a8f42',
      bg: '#161810',
      bgAccent: '#262a1a',
      surface: '#1e2216',
      ink: '#eef0e4',
      muted: '#a8b090',
      line: '#3a402c',
      cellEmpty: '#2a3020',
      cellEmptyBorder: '#424830',
      successBg: '#2a301c',
      successBorder: '#4a5434',
      glow: 'rgba(168, 184, 106, 0.14)',
      bgTop: '#1c2014',
      bgBottom: '#10140c',
      swatch: '#a8b86a',
    },
  },
]

export function isAccentId(value: string | null | undefined): value is AccentId {
  return APP_ACCENTS.some((accent) => accent.id === value)
}

export function getAccentOption(id: AccentId): AccentOption {
  return APP_ACCENTS.find((accent) => accent.id === id) ?? APP_ACCENTS[0]
}

export function getAccentPalette(
  id: AccentId,
  mode: ThemeMode,
): AccentPalette {
  return getAccentOption(id)[mode]
}
