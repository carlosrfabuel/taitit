// Design tokens shared by the app and the admin (admin copy: admin/src/index.css @theme).
// Palette "Black" (2026-10-23, Carlos: black instead of dark green, like the logo): near-black for
// main actions and what is selected, a soft off-white ground and warm greys, so the frames' own
// colours are the only colour on screen; warm yellow stays for notes and highlights, green and red
// only for success and errors. Every text colour has at least 4.5:1 contrast on the backgrounds it
// is used on (success text: not on highlight).
export const colors = {
  primary: '#111111',
  onPrimary: '#FFFFFF',
  accent: '#111111',
  background: '#F7F6F2',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEDE8',
  text: '#141414',
  muted: '#5E5E5A',
  border: '#E3E0D8',
  focus: '#111111',
  danger: '#B3261E',
  success: '#2E7D4F',
  warning: '#8A6200',
  overlay: 'rgba(17,17,17,0.45)',
  /** Light warm grey: selected chips, "approved" badges. */
  selected: '#ECEAE4',
  onSelected: '#111111',
  selectedBorder: '#CFCBC1',
  /** Light warm yellow: notes, "ordering as", "waiting for approval". */
  highlight: '#FBE7A1',
  onHighlight: '#4A3A08',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

// Readable on real phones (2026-10-22): the two smallest sizes 1 px larger than before (13 / 11).
export const typography = {
  title: 26,
  heading: 20,
  subheading: 17,
  body: 16,
  small: 14,
  tiny: 12,
} as const;

export const lineHeight = {
  title: 32,
  heading: 26,
  subheading: 22,
  body: 22,
  small: 20,
  tiny: 16,
} as const;

export const weight = {
  regular: '400',
  medium: '600',
  bold: '700',
  heavy: '800',
} as const;

/** Minimum touch target (Apple HIG / Material). */
export const touch = { minSize: 44 } as const;

/** Swatch sizes used by the customizer palette and lists. */
export const swatch = { lg: 44, md: 32, sm: 22 } as const;
