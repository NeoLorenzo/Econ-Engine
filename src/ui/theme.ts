/**
 * JS mirror of the CSS tokens in app.css, for Recharts and Three.js, which cannot read CSS variables.
 * Firm A and Firm B keep the same two colours in every industry, so "A vs B" reads identically everywhere.
 */
export const palette = {
  bg: '#0a0d0c',
  surface: '#111614',
  surface2: '#171d1a',
  border: '#232b27',
  grid: '#1d2421',
  text: '#eef2f0',
  text2: '#b3bdb8',
  text3: '#8e9a94',
  accent: '#d4f36a',
  firmA: '#5ec9d8',
  firmB: '#f39c74',
  positive: '#6fd39b',
  warning: '#e9b45f',
  negative: '#f07f6f',
  government: '#ab96f6',
  household: '#e6dab7',
  neutral: '#56625c',
} as const

export const firmColor = (variant: 'a' | 'b' | null) =>
  variant === 'b' ? palette.firmB : variant === 'a' ? palette.firmA : palette.government

export const hex = (color: string) => Number.parseInt(color.slice(1), 16)
