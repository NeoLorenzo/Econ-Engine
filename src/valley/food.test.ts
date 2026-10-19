import { FLAT_LAND } from './config'
import { describe, expect, it } from 'vitest'
import { lakeCapacityKcal } from './config'
import { cloneValley, createValley, lastEventOf, stepValley } from './engine'
import { LAKE_ID, rateAtStock, spoil, spoilsIn } from './food'
import { ValleyChecker } from './invariants'
import { lakeGrowth } from './lake'
import { HOURS_PER_YEAR } from './work'
import type { Forager, ValleyState } from './types'

const TEN_AM = 600

/** The band as one group around the camp at ten in the morning, forager 0 hungry and changed by `change`. */
function hungryAt(change: (forager: Forager, state: ValleyState) => void) {
  const state = cloneValley(createValley({ ...FLAT_LAND, scattered: false }))
  state.minute = TEN_AM
  const forager = state.foragers[0]!
  forager.energyKcal = 60_000
  forager.hungry = true
  forager.foodMemory.seen.fill(5)
  forager.foodMemory.stock.fill(0)
  // It has checked every site, so it searches nowhere.
  forager.siteKnown.fill(1)
  forager.siteChecked.fill(5)
  state.totals.initialKcal -= 6_000
  change(forager, state)
  return state
}

/** Forager 0 on the shore, knowing the lake and remembering no food on any plant. */
const onTheShore = () =>
  hungryAt((forager) => {
    forager.y = 50
    forager.lakeKnown = true
  })

describe('the lake', () => {
  const { config } = createValley(FLAT_LAND)
  const capacity = lakeCapacityKcal(config)

  it('holds 30 hectares of fish at 100 kg a hectare and 600 kcal a kilogram', () => {
    expect(capacity).toBe(1_800_000)
  })

  it('grows nothing full or empty, most at half, and loses nothing to rounding', () => {
    expect(lakeGrowth(config, capacity, 0).grown).toBe(0)
    expect(lakeGrowth(config, 0, 0).grown).toBe(0)
    const yearFrom = (start: number) => {
      let stock = start
      let remainder = 0
      for (let hour = 0; hour < HOURS_PER_YEAR; hour += 1) {
        const grown = lakeGrowth(config, stock, remainder)
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

describe('food that comes more slowly as a source thins', () => {
  it('gives a rate in proportion to what is left', () => {
    const { config } = createValley(FLAT_LAND)
    expect(rateAtStock(config, 1_200, 'berries', 52)).toBe(1_200)
    expect(rateAtStock(config, 1_200, 'berries', 26)).toBe(600)
    expect(rateAtStock(config, 3_500, 'nuts', 1_875)).toBe(3_500)
    expect(rateAtStock(config, 600, 'fish', 900_000)).toBe(300)
  })

  it('picks a thin bush at its slower rate', () => {
    const state = hungryAt((forager, valley) => {
      const { bushes } = valley.layout
      forager.x = bushes.x[0]! - 50
      forager.y = bushes.y[0]!
      // Every other food plant bare, and the lake found fished out, so the thin bush is the best it can find.
      forager.lakeStock = 0
      for (const stock of valley.foodStock) valley.totals.initialKcal -= stock
      valley.foodStock.fill(0)
      valley.totals.initialKcal += 20
      valley.foodStock[0] = 20
      forager.foodMemory.stock[0] = 20
    })
    const forager = state.foragers[0]!
    const rate = Math.floor((forager.forageRate * 20) / state.config.bushCapacityKcal)
    const event = lastEventOf(stepValley(state), 0)!
    expect(event).toMatchObject({ reason: 'foraging', food: 'berries', plantId: 0, sourceStockBefore: 20 })
    expect(event.gatheredKcal).toBe(Math.floor((rate * event.workSeconds) / 3_600))
  })

  it('fishes from the shore, takes the fish from the lake, and remembers the stock it found', () => {
    const state = onTheShore()
    const forager = state.foragers[0]!
    const after = stepValley(state)
    const event = lastEventOf(after, 0)!
    expect(event).toMatchObject({ reason: 'fishing', food: 'fish', plantId: LAKE_ID, position: { y: 50 } })
    expect(event.gatheredKcal).toBe(Math.floor((forager.fishRate * 60) / 3_600))
    expect(after.lakeKcal).toBe(state.lakeKcal - event.gatheredKcal)
    expect(after.foragers[0]!).toMatchObject({ lakeStock: state.lakeKcal, lakeFishedMinute: TEN_AM })
  })

  it('does not fish a lake it has found too thin to be worth it', () => {
    const state = onTheShore()
    state.foragers[0]!.lakeStock = lakeCapacityKcal(state.config) / 10
    expect(lastEventOf(stepValley(state), 0)!.food).not.toBe('fish')
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

describe('the checker', () => {
  function damaged(base: ValleyState, damage: (after: ValleyState) => void) {
    const checker = new ValleyChecker(base)
    const after = stepValley(base)
    damage(after)
    return checker.check(after).join('\n')
  }

  it('finds nothing wrong with a minute of fishing', () => {
    expect(damaged(onTheShore(), () => {})).toBe('')
  })

  it('catches fish made from nothing, food taken too fast and a forager on the water', () => {
    expect(
      damaged(onTheShore(), (after) => {
        after.lakeKcal += 5
      }),
    ).toContain('the lake holds')
    expect(
      damaged(onTheShore(), (after) => {
        after.lastEvents.find((event) => event.foragerId === 0)!.gatheredKcal += 100
      }),
    ).toContain('took food faster than the source allows')
    expect(
      damaged(onTheShore(), (after) => {
        after.lastEvents.find((event) => event.foragerId === 0)!.position.y = -10
      }),
    ).toContain('left the valley')
  })
})
