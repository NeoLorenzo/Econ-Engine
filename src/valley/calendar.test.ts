import { describe, expect, it } from 'vitest'
import {
  arrivalDay,
  dailyShare,
  dayOf,
  dayOfYear,
  daysToWindow,
  minuteOfDay,
  seasonOf,
  windowDays,
  yearOf,
  yearsToDays,
} from './calendar'
import { resolveValleyConfig, valleyConfigErrors, VALLEY_DEFAULT_CONFIG } from './config'

describe('minute calendar', () => {
  it('sums daily shares exactly to the yearly amount', () => {
    for (const days of [8, 90, 365]) {
      let total = 0
      for (let day = 0; day < days; day += 1) total += dailyShare(54_001, day, days)
      expect(total).toBe(54_001)
    }
  })
  it('derives day, year and season from the minute', () => {
    const config = resolveValleyConfig({ daysPerYear: 8, arrivalPerMille: 0 })
    expect(dayOf(1_439)).toBe(0)
    expect(minuteOfDay(1_441)).toBe(1)
    expect(yearOf(config, 8 * 1_440)).toBe(1)
    expect(dayOfYear(config, 9 * 1_440)).toBe(1)
    expect(seasonOf(config, 2 * 1_440)).toBe(1)
    expect(seasonOf(config, 7 * 1_440)).toBe(3)
  })
  it('rounds the first three season boundaries down', () => {
    const config = resolveValleyConfig({ daysPerYear: 9, arrivalPerMille: 0 })
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((day) => seasonOf(config, day * 1_440))).toEqual([0, 1, 1, 2, 2, 3, 3, 3])
  })
  it('counts the year from the spring equinox, with the founders arriving on the first day of berries', () => {
    const at = (daysPerYear: number) => {
      const config = resolveValleyConfig({ daysPerYear })
      return {
        arrival: arrivalDay(config),
        berries: windowDays(config, config.berrySeason),
        nuts: windowDays(config, config.nutSeason),
      }
    }
    expect(at(90)).toEqual({ arrival: 29, berries: { start: 29, end: 40 }, nuts: { start: 40, end: 52 } })
    expect(at(365)).toEqual({ arrival: 120, berries: { start: 120, end: 164 }, nuts: { start: 164, end: 211 } })
    expect(at(8)).toEqual({ arrival: 2, berries: { start: 2, end: 3 }, nuts: { start: 3, end: 4 } })
    const config = resolveValleyConfig({ daysPerYear: 90 })
    expect(dayOfYear(config, 0)).toBe(29)
    expect(yearOf(config, 60 * 1_440)).toBe(0)
    expect(yearOf(config, 61 * 1_440)).toBe(1)
    expect(dayOfYear(config, 61 * 1_440)).toBe(0)
  })
  it('keeps every window at least a day long', () => {
    const config = resolveValleyConfig({ daysPerYear: 8 })
    expect(windowDays(config, { startPerMille: 500, endPerMille: 501 })).toEqual({ start: 4, end: 5 })
  })
  it('counts the days to the next berry window from any day', () => {
    const config = resolveValleyConfig({ daysPerYear: 90 })
    // The run's day 0 is the window's first day; the next is a year on.
    const days = Array.from({ length: 90 }, (_, day) => daysToWindow(config, config.berrySeason, day * 1_440))
    expect(days[0]).toBe(0)
    expect(days[1]).toBe(89)
    expect(days[60]).toBe(30)
    expect(days[89]).toBe(1)
  })
  it('never converts years to fewer than one day', () => {
    const config = resolveValleyConfig({ daysPerYear: 8 })
    expect(yearsToDays(config, 0)).toBe(1)
    expect(yearsToDays(config, 20)).toBe(160)
  })
  it('rejects invalid year lengths', () => {
    for (const daysPerYear of [7, 366, 8.5, NaN, Infinity])
      expect(valleyConfigErrors({ ...VALLEY_DEFAULT_CONFIG, daysPerYear })).toContain(
        'daysPerYear must be an integer from 8 to 365',
      )
    for (const daysPerYear of [8, 90, 365]) expect(resolveValleyConfig({ daysPerYear }).daysPerYear).toBe(daysPerYear)
  })
})
