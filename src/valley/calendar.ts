import type { SeasonWindow, ValleyConfig } from './types'

export const MINUTES_PER_DAY = 1_440
type CalendarConfig = Pick<ValleyConfig, 'daysPerYear' | 'arrivalPerMille'>

export const dayOf = (minute: number): number => Math.floor(minute / MINUTES_PER_DAY)
export const minuteOfDay = (minute: number): number => minute % MINUTES_PER_DAY
/** The day of the year, counted from the spring equinox, on which the founders arrive: the run's day 0. */
export const arrivalDay = (config: CalendarConfig): number =>
  Math.floor((config.arrivalPerMille * config.daysPerYear) / 1_000)
export const yearOf = (config: CalendarConfig, minute: number): number =>
  Math.floor((dayOf(minute) + arrivalDay(config)) / config.daysPerYear)
export const dayOfYear = (config: CalendarConfig, minute: number): number =>
  (dayOf(minute) + arrivalDay(config)) % config.daysPerYear
/** The run's day on which day `day` of year `year` falls; negative before the founders arrived. */
export const runDayOf = (config: CalendarConfig, year: number, day: number): number =>
  year * config.daysPerYear + day - arrivalDay(config)

export function seasonOf(config: CalendarConfig, minute: number): 0 | 1 | 2 | 3 {
  const day = dayOfYear(config, minute)
  for (const season of [1, 2, 3] as const)
    if (day < Math.floor((season * config.daysPerYear) / 4)) return (season - 1) as 0 | 1 | 2
  return 3
}

/** A window's days of the year, `[start, end)`, at least one day. */
export function windowDays(config: Pick<ValleyConfig, 'daysPerYear'>, window: SeasonWindow) {
  const start = Math.floor((window.startPerMille * config.daysPerYear) / 1_000)
  return { start, end: Math.max(start + 1, Math.floor((window.endPerMille * config.daysPerYear) / 1_000)) }
}

/** The day's place in a window, from 0, or -1 outside it; and the window's length in days. */
export function windowDayIndex(config: CalendarConfig, window: SeasonWindow, minute: number) {
  const { start, end } = windowDays(config, window),
    day = dayOfYear(config, minute)
  return { index: day >= start && day < end ? day - start : -1, days: end - start }
}

export const inWindow = (config: CalendarConfig, window: SeasonWindow, minute: number) =>
  windowDayIndex(config, window, minute).index >= 0

/** Days from the day of `minute` to the next first day of a window: 0 on that day itself. */
export function daysToWindow(config: CalendarConfig, window: SeasonWindow, minute: number) {
  const { start } = windowDays(config, window)
  return (start - dayOfYear(config, minute) + config.daysPerYear) % config.daysPerYear
}

/** The first minute of the window's most recent start at or before `minute`; negative if before the run began. */
export function lastWindowStartMinute(config: CalendarConfig, window: SeasonWindow, minute: number) {
  const { start } = windowDays(config, window),
    year = yearOf(config, minute) - (dayOfYear(config, minute) >= start ? 0 : 1)
  return runDayOf(config, year, start) * MINUTES_PER_DAY
}

/** Divide the yearly amount exactly, without rounding away fractional daily growth. */
export const dailyShare = (amountPerYear: number, day: number, daysPerYear: number): number =>
  Math.floor((amountPerYear * (day + 1)) / daysPerYear) - Math.floor((amountPerYear * day) / daysPerYear)

export const yearsToDays = (config: Pick<ValleyConfig, 'daysPerYear'>, years: number): number =>
  Math.max(1, years * config.daysPerYear)
