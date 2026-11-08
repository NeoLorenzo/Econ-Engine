import { describe, expect, it } from 'vitest'
import { runDayOf, windowDayIndex } from './calendar'
import { FLAT_LAND, resolveValleyConfig } from './config'
import { createValley } from './engine'
import { cropClassOf, cropOf, harvestOf, placesWithin, regrowPlaces, takeFrom, thicketCapacity } from './places'
import { fishGrowth } from './fish'
import { decorPoints } from '../valleyView/display'

describe('resource places', () => {
  it('holds one stock per site, thickets starting with the arrival day’s crop', () => {
    const state = createValley(FLAT_LAND),
      c = state.config
    expect(state.layout.places.count).toBe(80)
    const crop = cropOf(c, 0, c.berryYearPerMille[state.harvest.berries]),
      { days } = windowDayIndex(c, c.berrySeason, 0)
    expect(state.foodStock[0]).toBe(Math.floor(crop / days))
    expect(state.foodStock[32]).toBe(0)
    expect(thicketCapacity(c, 0)).toBe(cropOf(c, 0, c.berryYearPerMille.good))
    expect(state.logStock[64]).toBe(36)
    expect(state.stoneStock[76]).toBe(60)
  })
  it('delivers each year’s crop over its window and nothing outside it', () => {
    for (const daysPerYear of [8, 90, 365]) {
      const state = createValley({ ...FLAT_LAND, daysPerYear, berryLossPerMille: 0, nutLossPerMille: 0 }),
        c = state.config
      state.foodStock.fill(0)
      const grown = [0, 0],
        first = runDayOf(c, 1, 0)
      // Calendar year 1, day by day: each window falls once in it.
      for (let day = first; day < first + daysPerYear; day += 1) {
        const before = state.foodStock.slice()
        const growth = regrowPlaces(state, day * 1_440)
        grown[0] += growth.crop[0]!
        grown[1] += growth.crop[1]!
        const open = [c.berrySeason, c.nutSeason].map((w) => windowDayIndex(c, w, day * 1_440).index >= 0)
        if (!open[0]) expect(state.foodStock[0]).toBe(before[0])
        if (!open[1]) expect(state.foodStock[32]).toBe(before[32])
      }
      const year = harvestOf(c, 1)
      expect(grown[0]).toBe(32 * cropOf(c, 0, c.berryYearPerMille[year.berries]))
      expect(grown[1]).toBe(32 * cropOf(c, 1, c.hazelYearPerMille[year.hazel]))
    }
  })
  it('anchors the crop to days: a 90-day year bears 90/365 of a full year’s', () => {
    const short = resolveValleyConfig({ daysPerYear: 90 }),
      long = resolveValleyConfig({ daysPerYear: 365 })
    const shortCrop = cropOf(short, 1, 1_000),
      longCrop = cropOf(long, 1, 1_000)
    expect(Math.abs(shortCrop - Math.floor((longCrop * 90) / 365))).toBeLessThanOrEqual(1)
    // A window day grows about as much at either length.
    const day = (c: typeof short) => cropOf(c, 1, 1_000) / windowDayIndex(c, c.nutSeason, 0).days
    expect(Math.abs(day(short) - day(long)) / day(long)).toBeLessThan(0.05)
  })
  it('draws the year’s classes from their own stream', () => {
    const c = resolveValleyConfig({})
    expect(cropClassOf(c, c.poorYearPerMille - 1)).toBe('poor')
    expect(cropClassOf(c, c.poorYearPerMille)).toBe('normal')
    expect(cropClassOf(c, 999 - c.goodYearPerMille)).toBe('normal')
    expect(cropClassOf(c, 1_000 - c.goodYearPerMille)).toBe('good')
    const years = Array.from({ length: 12 }, (_, year) => harvestOf(c, year))
    expect(years).toEqual(Array.from({ length: 12 }, (_, year) => harvestOf({ ...c }, year)))
    expect(new Set(years.map((h) => h.hazel)).size).toBeGreaterThan(1)
  })
  it('loses half of what lies on a thicket in fourteen days', () => {
    const state = createValley(FLAT_LAND)
    state.foodStock[32] = thicketCapacity(state.config, 1)
    const start = state.foodStock[32]!
    // Run days 23 to 36 are days 52 to 65 of the year, after both windows.
    for (let day = 23; day <= 36; day += 1) regrowPlaces(state, day * 1_440)
    expect(Math.abs(state.foodStock[32]! / start - 0.5)).toBeLessThan(0.01)
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
  it('restores harvested bundles independently after twenty years', () => {
    const state = createValley({ ...FLAT_LAND, daysPerYear: 8 })
    state.logStock[64] = 30
    state.logRegrowth.set(64, [0, 1_440])
    regrowPlaces(state, 159 * 1_440)
    expect(state.logStock[64]).toBe(30)
    regrowPlaces(state, 160 * 1_440)
    expect(state.logStock[64]).toBe(33)
    regrowPlaces(state, 161 * 1_440)
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
