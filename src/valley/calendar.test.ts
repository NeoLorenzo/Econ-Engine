import { describe, expect, it } from 'vitest'
import { dailyShare, dayOf, dayOfYear, minuteOfDay, seasonOf, yearOf, yearsToDays } from './calendar'
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
    const config = resolveValleyConfig({ daysPerYear: 8 })
    expect(dayOf(1_439)).toBe(0)
    expect(minuteOfDay(1_441)).toBe(1)
    expect(yearOf(config, 8 * 1_440)).toBe(1)
    expect(dayOfYear(config, 9 * 1_440)).toBe(1)
    expect(seasonOf(config, 2 * 1_440)).toBe(1)
    expect(seasonOf(config, 7 * 1_440)).toBe(3)
  })
  it('rounds the first three season boundaries down', () => {
    const config = resolveValleyConfig({ daysPerYear: 9 })
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((day) => seasonOf(config, day * 1_440))).toEqual([0, 1, 1, 2, 2, 3, 3, 3])
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
