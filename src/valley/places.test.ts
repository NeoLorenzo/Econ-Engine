import { describe, expect, it } from 'vitest'
import { dailyShare } from './calendar'
import { FLAT_LAND } from './config'
import { createValley } from './engine'
import { placesWithin, regrowPlaces, takeFrom } from './places'
import { fishGrowth } from './fish'
import { decorPoints } from '../valleyView/display'

describe('resource places', () => {
  it('holds one stock per site with the summed capacity', () => {
    const state = createValley(FLAT_LAND)
    expect(state.layout.places.count).toBe(80)
    expect(state.foodStock[0]).toBe(3_120)
    expect(state.logStock[64]).toBe(36)
    expect(state.stoneStock[76]).toBe(60)
  })
  it('applies exact daily shares, capped at each place capacity', () => {
    for (const daysPerYear of [8, 90, 365]) {
      const state = createValley({ ...FLAT_LAND, daysPerYear })
      let total = 0
      for (let day = 0; day < daysPerYear; day += 1) {
        state.foodStock.fill(0)
        total += regrowPlaces(state, day * 1_440).kcal
      }
      let expected = 0
      for (let day = 0; day < daysPerYear; day += 1)
        expected +=
          32 * Math.min(3_120, dailyShare(54_000, day, daysPerYear)) +
          32 * Math.min(75_000, dailyShare(150_000, day, daysPerYear))
      expect(total).toBe(expected)
    }
  })
  it('finds nearby places in id order', () => {
    const state = createValley(FLAT_LAND)
    const { x, y } = state.layout.camp
    const ids = placesWithin(state.layout, x, y, 20_000)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    for (const id of ids)
      expect(Math.hypot(state.layout.places.x[id]! - x, state.layout.places.y[id]! - y)).toBeLessThanOrEqual(20_000)
  })
  it('caps takes at the remaining stock', () => {
    const stock = Int32Array.of(3_120)
    expect(takeFrom(stock, 0, 1_200)).toBe(1_200)
    expect(takeFrom(stock, 0, 3_000)).toBe(1_920)
    expect(takeFrom(stock, 0, 1)).toBe(0)
  })
  it('restores an emptied stand after twenty years', () => {
    const state = createValley({ ...FLAT_LAND, daysPerYear: 8 })
    state.logStock[64] = 0
    state.felledMinute[64] = 0
    regrowPlaces(state, 159 * 1_440)
    expect(state.logStock[64]).toBe(0)
    regrowPlaces(state, 160 * 1_440)
    expect(state.logStock[64]).toBe(36)
  })
  it('does not destroy crown wood above the deadfall capacity', () => {
    const state = createValley(FLAT_LAND)
    state.woodStock[64] = 310
    regrowPlaces(state, 1_440)
    expect(state.woodStock[64]).toBe(310)
  })
  it('spreads fish growth over the configured periods', () => {
    expect(fishGrowth(1_000, 500, 0, 20, 1).grown).toBe(50)
    expect(fishGrowth(1_000, 0, 0, 20, 90).grown).toBe(0)
  })
  it('scatters deterministic decoration inside the place', () => {
    const place = { id: 7, x: 0, y: 0, radiusCm: 1_000 }
    const points = decorPoints(place, 60)
    expect(points).toEqual(decorPoints(place, 60))
    for (const p of points) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1_000)
  })
})
