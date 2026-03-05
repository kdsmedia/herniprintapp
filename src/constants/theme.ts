export const COLORS = {
  primary: '#4f46e5',
  primaryLight: '#818cf8',
  primaryDark: '#3730a3',
  secondary: '#ec4899',
  secondaryLight: '#f472b6',
  bgDark: '#0f172a',
  bgDarker: '#020617',
  bgCard: 'rgba(255,255,255,0.08)',
  bgCardBorder: 'rgba(255,255,255,0.15)',
  bgInput: 'rgba(0,0,0,0.3)',
  text: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  white: '#ffffff',
  black: '#000000',
} as const;

export const FONTS = {
  regular: 'System',
  bold: 'System',
  mono: 'monospace',
} as const;

// Thermal printer specs
export const PAPER = {
  58: { widthMM: 58, widthPx: 384, widthDots: 384 },
  80: { widthMM: 80, widthPx: 576, widthDots: 576 },
} as const;

export type PaperWidth = 58 | 80;
