import { palette } from '../ui/theme'
import type { ValleyConfig } from '../valley/types'

/** Decoration never consumes a simulation stream. */
export function decorPoints(place: { id: number; x: number; y: number; radiusCm: number }, count: number) {
  const hash = (value: number) => {
    let word = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
    word = Math.imul(word ^ (word >>> 16), 0x45d9f3b)
    return (word ^ (word >>> 16)) >>> 0
  }
  return Array.from({ length: count }, (_, index) => {
    const seed = hash(Math.imul(place.id + 1, 65_537) + index)
    const angle = (seed / 0x1_0000_0000) * 2 * Math.PI
    const radius = Math.max(0, place.radiusCm - 1) * Math.sqrt(hash(seed + 1) / 0x1_0000_0000)
    return { x: place.x + Math.round(radius * Math.cos(angle)), y: place.y + Math.round(radius * Math.sin(angle)) }
  })
}

// What the observer shows of time, people and what wood costs them.

export function clockLabel(hours: number) {
  const day = Math.floor(hours / 24)
  const minutes = Math.floor((hours - day * 24) * 60)
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `Day ${day + 1} · ${hh}:${mm}`
}

/**
 * 0 at night, 1 in full daylight, easing over the half hour either side of dawn and dusk. Only the picture fades; the
 * simulation's night still starts exactly at dusk.
 */
export function daylightAt(hourOfDay: number, dawnHour: number, duskHour: number) {
  const smooth = (edge: number, t: number) => {
    const x = Math.min(1, Math.max(0, (t - (edge - 0.5)) / 1))
    return x * x * (3 - 2 * x)
  }
  return Math.min(smooth(dawnHour, hourOfDay), 1 - smooth(duskHour, hourOfDay))
}

/** The sun's height (−1 to 1) and direction, rising at dawn in the east and setting at dusk in the west. */
export function sunAt(hourOfDay: number, dawnHour: number, duskHour: number) {
  const angle = ((hourOfDay - dawnHour) / (duskHour - dawnHour)) * Math.PI
  return { elevation: Math.sin(angle), azimuth: Math.cos(angle) }
}

/** Forager IDs count from 0; people count from 1. */
export const foragerName = (foragerId: number) => `Forager ${foragerId + 1}`

export function formatHours(hours: number) {
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest ? `${days} d ${rest} h` : `${days} d`
}

export const formatKcal = (kcal: number) => `${Math.round(kcal).toLocaleString('en-US')} kcal`

/** What the colour scale of own terms needs to know of a configuration. */
export type TermsConfig = Pick<
  ValleyConfig,
  'berryKcalPerHour' | 'woodPerHour' | 'skillFloorPercent' | 'skillCeilingPercent'
>

/** A forager's rates, all the colour scale reads of it. */
export interface Rates {
  forageRate: number
  woodRate: number
}

/** The lowest, usual and highest own terms skills allow, in kcal a kilogram of wood. */
export function ownTermsRange(config: TermsConfig) {
  const base = config.berryKcalPerHour / config.woodPerHour
  const ratio = config.skillCeilingPercent / config.skillFloorPercent
  return { low: base / ratio, base, high: base * ratio }
}

/** Where a forager's own terms fall in that range, on a log scale: 0 at the lowest, 1 at the highest, ½ at 100%. */
export function ownTermsPosition(config: TermsConfig, forager: Rates) {
  const { low, high } = ownTermsRange(config)
  if (high === low) return 0.5
  const terms = forager.forageRate / forager.woodRate
  const position = (Math.log(terms) - Math.log(low)) / (Math.log(high) - Math.log(low))
  return Math.min(1, Math.max(0, position))
}

const mix = (from: string, to: string, t: number) => {
  const channel = (color: string, at: number) => parseInt(color.slice(at, at + 2), 16)
  const value = (at: number) => Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * t)
  return `#${[1, 3, 5].map((at) => value(at).toString(16).padStart(2, '0')).join('')}`
}

/** Foragers relatively good at gathering wear the cool colour, those relatively good at foraging the warm one. */
export const TERMS_COLORS = { gatherer: palette.firmA, forager: palette.warning }

export const foragerColor = (config: TermsConfig, forager: Rates) =>
  mix(TERMS_COLORS.gatherer, TERMS_COLORS.forager, ownTermsPosition(config, forager))
