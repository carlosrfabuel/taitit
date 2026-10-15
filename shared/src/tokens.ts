// Placeholder brand tokens until the client sends final branding.
export const colors = {
  primary: '#111111',
  accent: '#1F7A8C',
  background: '#F7F7F5',
  surface: '#FFFFFF',
  text: '#1B1B1B',
  muted: '#6B6B6B',
  border: '#E4E4E0',
  danger: '#C2263A',
  success: '#2E9E6B',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const typography = {
  title: 26,
  heading: 20,
  body: 16,
  small: 13,
} as const;
