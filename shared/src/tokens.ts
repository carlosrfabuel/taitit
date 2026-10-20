// Design tokens shared by the app and the admin (admin copy: admin/src/index.css @theme).
// Palette "Garden" (chosen 2026-10-20): warm light-yellow ground, deep green for main actions,
// light green for what is selected, warm yellow for notes and highlights. Every text colour has at
// least 4.5:1 contrast on the backgrounds it is used on (success text: not on highlight).
export const colors = {
  primary: '#2F6B47',
  onPrimary: '#FFFFFF',
  accent: '#2F6B47',
  background: '#FBF8EE',
  surface: '#FFFFFF',
  surfaceMuted: '#F3EED9',
  text: '#1D2620',
  muted: '#5D675F',
  border: '#E6E0CB',
  focus: '#2F6B47',
  danger: '#B3261E',
  success: '#2E7D4F',
  warning: '#8A6200',
  overlay: 'rgba(29,38,32,0.45)',
  /** Light green: selected chips, "approved" badges. */
  selected: '#DDEFD9',
  onSelected: '#1E4D31',
  selectedBorder: '#B9DDB2',
  /** Light warm yellow: notes, "ordering as", "waiting for approval". */
  highlight: '#FBE7A1',
  onHighlight: '#4A3A08',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const typography = {
  title: 26,
  heading: 20,
  subheading: 17,
  body: 16,
  small: 13,
  tiny: 11,
} as const;

export const lineHeight = {
  title: 32,
  heading: 26,
  subheading: 22,
  body: 22,
  small: 18,
  tiny: 14,
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
