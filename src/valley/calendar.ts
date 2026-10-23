import type { ValleyConfig } from './types'

export const MINUTES_PER_DAY = 1_440
type CalendarConfig = Pick<ValleyConfig, 'daysPerYear'>

export const dayOf = (minute: number): number => Math.floor(minute / MINUTES_PER_DAY)
export const minuteOfDay = (minute: number): number => minute % MINUTES_PER_DAY
export const yearOf = (config: CalendarConfig, minute: number): number => Math.floor(dayOf(minute) / config.daysPerYear)
export const dayOfYear = (config: CalendarConfig, minute: number): number => dayOf(minute) % config.daysPerYear

export function seasonOf(config: CalendarConfig, minute: number): 0 | 1 | 2 | 3 {
  const day = dayOfYear(config, minute)
  for (const season of [1, 2, 3] as const)
    if (day < Math.floor((season * config.daysPerYear) / 4)) return (season - 1) as 0 | 1 | 2
  return 3
}

/** Divide the yearly amount exactly, without rounding away fractional daily growth. */
export const dailyShare = (amountPerYear: number, day: number, daysPerYear: number): number =>
  Math.floor((amountPerYear * (day + 1)) / daysPerYear) - Math.floor((amountPerYear * day) / daysPerYear)

export const yearsToDays = (config: CalendarConfig, years: number): number => Math.max(1, years * config.daysPerYear)
