import { describe, expect, it } from 'vitest'
import { createValley } from './engine'
import { FLAT_LAND } from './config'
import { fishCapacity, fishGrowth, fishRate } from './fish'
import { rateAtStock, spoil, spoilsIn } from './food'
import { HOURS_PER_YEAR } from './work'
describe('the lake', () => {
  const { config } = createValley(FLAT_LAND)
  const capacity = fishCapacity(300_000, 1_000, config.fishKgPerHectare, config.fishKcalPerKg)

  it('holds 30 hectares of fish at 100 kg a hectare and 600 kcal a kilogram', () => {
    expect(capacity).toBe(1_800_000)
  })

  it('grows nothing full or empty, most at half, and loses nothing to rounding', () => {
    expect(fishGrowth(capacity, capacity, 0, config.fishGrowthPercentPerYear).grown).toBe(0)
    expect(fishGrowth(capacity, 0, 0, config.fishGrowthPercentPerYear).grown).toBe(0)
    const yearFrom = (start: number) => {
      let stock = start
      let remainder = 0
      for (let hour = 0; hour < HOURS_PER_YEAR; hour += 1) {
        const grown = fishGrowth(capacity, stock, remainder, config.fishGrowthPercentPerYear)
        stock += grown.grown
        remainder = grown.remainder
      }
      return stock - start
    }
    // From half, a year gives a little under 40% of a quarter of a full lake, 180,000 kcal, as it grows past half.
    const half = yearFrom(capacity / 2)
    expect(half).toBeGreaterThan(175_000)
    expect(half).toBeLessThanOrEqual(180_000)
    expect(yearFrom(capacity / 10)).toBeLessThan(half)
    expect(yearFrom((9 * capacity) / 10)).toBeLessThan(half)
  })
})

describe('carried food', () => {
  it('spoils by its own shelf life: fish in a day, berries in two, nuts in half a year', () => {
    const { config } = createValley(FLAT_LAND)
    const lots = [
      { food: 'nuts' as const, kcal: 100, harvestTick: 0 },
      { food: 'fish' as const, kcal: 50, harvestTick: 0 },
      { food: 'berries' as const, kcal: 30, harvestTick: 0 },
    ]
    expect(spoilsIn(config, lots, 0)).toBe(24 * 60)
    expect(spoil(config, lots, 24 * 60)).toMatchObject({ spoiledKcal: 50 })
    expect(spoil(config, lots, 48 * 60).spoiledKcal).toBe(80)
    expect(spoil(config, lots, 4_380 * 60).lots).toEqual([])
  })
})

it('retains the stock-dependent thicket slowdown', () => {
  const { config } = createValley(FLAT_LAND)
  expect(rateAtStock(config, 1200, 'berries', 3120)).toBe(1200)
  expect(rateAtStock(config, 1200, 'berries', 1560)).toBe(600)
  expect(rateAtStock(config, 3500, 'nuts', 75000)).toBe(3500)
  expect(fishRate(600, 900000, 1800000)).toBe(300)
})
