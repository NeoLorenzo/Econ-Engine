import { describe, expect, it } from 'vitest'
import { VALLEY_DEFAULT_CONFIG } from '../valley/config'
import { BIRCH, BILBERRY, dayLengthHours, foliageAt, grassTint, sunAt, yearFraction } from './seasonLook'

const config = VALLEY_DEFAULT_CONFIG
/** The run's minute of a given hour on the day at this fraction of the year, from the spring equinox. */
const minuteAt = (fraction: number, hour: number) => Math.round(fraction * config.daysPerYear) * 1_440 + hour * 60

describe('the sun through the year', () => {
  it('counts the year from the spring equinox, where the run starts', () => {
    expect(yearFraction(config, 0)).toBe(0)
    expect(yearFraction(config, minuteAt(0.75, 0))).toBeCloseTo(
      Math.round(0.75 * config.daysPerYear) / config.daysPerYear,
      9,
    )
  })

  it('stands highest at the summer solstice and lowest at the winter one', () => {
    const summer = sunAt(config, minuteAt(0.25, 12))
    const equinox = sunAt(config, minuteAt(0.5, 12))
    const winter = sunAt(config, minuteAt(0.75, 12))
    expect(Math.asin(summer.up) * (180 / Math.PI)).toBeCloseTo(61.4, 0)
    // Half a day past the equinox, the declination is already about 1° south.
    expect(Math.abs(Math.asin(equinox.up) * (180 / Math.PI) - 38)).toBeLessThan(1.5)
    expect(Math.asin(winter.up) * (180 / Math.PI)).toBeCloseTo(14.6, 0)
    // At noon the sun is due south.
    expect(winter.north).toBeLessThan(0)
    expect(Math.abs(winter.east)).toBeLessThan(1e-9)
  })

  it('rises in the east, and keeps longer days in summer', () => {
    expect(sunAt(config, minuteAt(0.5, 8)).east).toBeGreaterThan(0)
    expect(dayLengthHours(config, 0.25)).toBeCloseTo(16.5, 0)
    expect(dayLengthHours(config, 0.5)).toBeCloseTo(12, 5)
    expect(dayLengthHours(config, 0.75)).toBeCloseTo(7.5, 0)
    expect(sunAt(config, minuteAt(0.25, 20)).light).toBeGreaterThan(0.5)
    expect(sunAt(config, minuteAt(0.75, 16.5)).light).toBe(0)
  })
})

describe('leaves through the year', () => {
  it('are green in summer, turning in autumn and bare in winter', () => {
    expect(foliageAt(BIRCH, 0.3)).toMatchObject({ colour: BIRCH.summer, cover: 1 })
    expect(foliageAt(BIRCH, 0.3).scale).toBeCloseTo(1, 9)
    expect(foliageAt(BIRCH, 0.56).colour).toBe(BIRCH.turning)
    expect(foliageAt(BIRCH, 0.85)).toMatchObject({ colour: BIRCH.bare, cover: 0 })
    expect(foliageAt(BIRCH, 0.85).scale).toBeCloseTo(BIRCH.bareScale, 9)
    expect(foliageAt(BILBERRY, 0.02).colour).toBe(BILBERRY.bare)
  })

  it('blend smoothly from one day to the next, across the year end', () => {
    for (let step = 0; step < 1_000; step += 1) {
      const before = foliageAt(BIRCH, step / 1_000)
      const after = foliageAt(BIRCH, (step + 1) / 1_000)
      expect(Math.abs(before.cover - after.cover)).toBeLessThan(0.05)
    }
  })

  it('leave the grass as drawn in summer and duller in winter', () => {
    expect(grassTint(0.35)).toEqual([1, 1, 1])
    expect(grassTint(0.85)[1]).toBeLessThan(1)
  })
})
