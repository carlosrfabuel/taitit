// Design tokens shared by the app and the admin.
// Placeholder brand values (TAITIT's site is black/white, minimal) until the client sends final branding.
export const colors = {
  primary: '#111111',
  onPrimary: '#FFFFFF',
  accent: '#1F7A8C',
  background: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEFEC',
  text: '#1B1B1B',
  muted: '#6B6B6B',
  border: '#E4E4E0',
  focus: '#1F7A8C',
  danger: '#C2263A',
  success: '#2E9E6B',
  warning: '#C9971C',
  overlay: 'rgba(0,0,0,0.45)',
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

/** Order status chip colors, keyed like OrderStatus. */
export const statusColors = {
  received: '#2350C8',
  in_production: '#C9971C',
  ready: '#2E9E6B',
  delivered: '#6B6B6B',
} as const;
