// ─── Brand Colors ─────────────────────────────────────
// Primary: Deep indigo (contrasts well with blue logos)
export const brand = {
  primary: '#1e293b',       // Dark slate — header, buttons
  primaryGradient: ['#0f172a', '#1e293b'],  // Header gradient
  accent: '#2563eb',        // Blue — links, highlights, active states
  accentLight: '#dbeafe',   // Blue light bg
  surface: '#ffffff',
  background: '#f8fafc',
  card: '#ffffff',
};

export const colors = {
  primary: brand.accent,
  primaryLight: brand.accentLight,
  primaryDark: '#1d4ed8',
  secondary: '#8b5cf6',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  teal: '#14b8a6',

  white: '#ffffff',
  black: '#000000',
  background: brand.background,
  surface: brand.surface,
  surfaceVariant: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  text: '#0f172a',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  textInverse: '#ffffff',

  sent: '#e2e8f0',
  received: brand.accent,
  online: '#22c55e',
  offline: '#94a3b8',

  skeleton: '#e2e8f0',
  overlay: 'rgba(0,0,0,0.5)',
  shadow: 'rgba(15,23,42,0.08)',

  // Header specific — dark slate so blue logos pop
  headerBg: brand.primary,
  headerText: '#ffffff',
  headerGradient: brand.primaryGradient,
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const radius = {
  sm: 6, md: 10, lg: 16, xl: 20, xxl: 28, full: 999,
};

export const fontSize = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32,
};
