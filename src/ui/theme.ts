/**
 * JS mirror of the CSS tokens in app.css, for Recharts and Three.js, which cannot read CSS variables.
 * Firm A, Firm B, … keep the same colour in every industry, so "A vs B" reads identically everywhere.
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

/** Colours by firm slot. The canonical economy uses only A and B; further slots exist for other market structures. */
const FIRM_COLORS = [palette.firmA, palette.firmB, '#d98ad6', '#8fb0ff']

/** A consumer firm's colour from its slot (A = 0), or a neutral grey for Transport, leaving purple to Government. */
export const firmColor = (slot: number | null) =>
  slot === null ? palette.text2 : FIRM_COLORS[slot % FIRM_COLORS.length]!

export const hex = (color: string) => Number.parseInt(color.slice(1), 16)
