import { mustGoHome } from './forager'
import { eatCarried } from './food'
import { addTestLake } from './ruleFixtures'
import { bandAt } from './ruleTestFixtures'
import { stepValley } from './engine'
import { chooseTask, foodGoal, chooseWork, loadOf, loadKg, speedForLoad } from './forager'
import { observeAt } from './perception'
import { describe, expect, it } from 'vitest'
import { createValley } from './engine'
import { FLAT_LAND } from './config'
import { fishCapacity, fishGrowth, fishRate } from './fish'
import { rateAtStock, spoil, spoilsIn } from './food'
describe('the lake', () => {
  const { config } = createValley(FLAT_LAND)
  const capacity = fishCapacity(300_000, 1_000, config.fishKgPerHectare, config.fishKcalPerKg)

  it('holds 30 hectares of fish at 100 kg a hectare and 600 kcal a kilogram', () => {
    expect(capacity).toBe(1_800_000)
  })

  it('grows nothing full or empty, most at half, and loses nothing to rounding', () => {
    expect(fishGrowth(capacity, capacity, 0, config.fishGrowthPercentPerYear, config.daysPerYear).grown).toBe(0)
    expect(fishGrowth(capacity, 0, 0, config.fishGrowthPercentPerYear, config.daysPerYear).grown).toBe(0)
    const yearFrom = (start: number) => {
      let stock = start
      let remainder = 0
      for (let hour = 0; hour < config.daysPerYear; hour += 1) {
        const grown = fishGrowth(capacity, stock, remainder, config.fishGrowthPercentPerYear, config.daysPerYear)
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

describe('ported food and load choices', () => {
  it('picks a thin thicket at the remembered stock-dependent rate', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.x = s.layout.places.x[0]!
    p.y = s.layout.places.y[0]!
    p.energyKcal = 59000
    p.hungry = true
    p.foragingSkill = 100
    p.forageRate = 1200
    s.foodStock.fill(0)
    s.foodStock[0] = 1560
    p.placeStock.set(s.foodStock)
    observeAt(s, p, 600)
    const n = stepValley(s, 601)
    expect(n.foragers[0]!.task).toMatchObject({ kind: 'pick', productionPerHour: 600 })
    const end = n.foragers[0]!.task!.endMinute
    const after = stepValley(n, end)
    expect(after.totals.gatheredKcal).toBeGreaterThan(0)
    expect(after.foodStock[0]).toBeGreaterThanOrEqual(0)
  })
  it('does not fish remembered stock too thin to be worth working', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.knownPlaces.fill(-1)
    const bank = addTestLake(s)
    p.fishMemory.set(bank.bodyId, { stock: 1, capacity: 10000, minute: 600 })
    expect(foodGoal(s, p, 600)).toBeNull()
  })
  it('fills a started wood load despite holding its stock target', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.wood = 25
    p.tripWood = 1
    p.hungry = false
    p.shortOfWood = false
    expect(chooseWork(s.config, p, 600)).toMatchObject({ good: 'wood', forTrade: false })
  })
  it('leaves an unfinished wood load when hungry', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.tripWood = 15
    p.hungry = true
    expect(chooseWork(s.config, p, 600)).toMatchObject({ good: 'food' })
  })
  it('stops counting a load once home', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.tripWood = 15
    expect(stepValley(s, 601).foragers[0]!.tripWood).toBe(0)
  })
  it('counts trip wood, all foods and the carried log in load mass', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.wood = 40
    p.tripWood = 3
    p.log = 1
    p.carried = [{ food: 'berries', kcal: 600, harvestTick: 0 }]
    expect(loadKg(s.config, loadOf(p))).toBe(3 + 1 + s.config.logKg)
    expect(speedForLoad(s.config, 24)).toBeGreaterThan(s.config.walkCmPerSecond * 0.95)
    expect(speedForLoad(s.config, 24)).toBeLessThan(s.config.walkCmPerSecond)
  })
  it('prioritises food while hungry even with a full load', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.hungry = true
    p.energyKcal = 59000
    p.tripWood = 30
    p.wood = 30
    expect(chooseTask(s, p, 600).reason).not.toBe('taking a load home')
    expect(chooseWork(s.config, p, 600)).toMatchObject({ good: 'food' })
  })
  it('chooses the nearer source at equal hourly returns and leaves sources below work cost', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.knownPlaces.fill(-1)
    p.knownPlaces[0] = 0
    p.knownPlaces[1] = 0
    p.x = s.layout.places.x[0]!
    p.y = s.layout.places.y[0]!
    expect(foodGoal(s, p, 600)?.placeId).toBe(0)
    p.placeStock[0] = 1
    p.placeStock[1] = 0
    expect(foodGoal(s, p, 600)).toBeNull()
  })
})

it('fishes an observed lake optimistically, withdraws its stock and remembers it', () => {
  const s = bandAt(600, { fishMinAreaM2: 1 }),
    p = s.foragers[0]!,
    bank = addTestLake(s)
  p.knownPlaces.fill(-1)
  p.placeStock.fill(0)
  p.x = bank.x
  p.y = bank.y
  p.energyKcal = 59000
  p.hungry = true
  expect(foodGoal(s, p, 600)?.kind).toBe('fish')
  const next = stepValley(s, 602)
  expect(next.totals.gatheredKcal).toBeGreaterThan(0)
  expect(next.foragers[0]!.fishMemory.get(bank.bodyId)?.stock).toBeLessThan(next.fish[0]!.capacity)
})

it('walks farther for full hazels rather than staying at a thin berry thicket', () => {
  const s = bandAt(),
    p = s.foragers[0]!
  p.knownPlaces.fill(-1)
  p.knownPlaces[0] = 0
  p.knownPlaces[32] = 0
  p.placeStock[0] = 1560
  p.placeStock[32] = 75000
  p.x = s.layout.places.x[0]!
  p.y = s.layout.places.y[0]!
  expect(foodGoal(s, p, 600)).toMatchObject({ kind: 'walk', placeId: 32 })
})
it('eats the oldest timestamped food up to reserve room without changing the lots supplied', () => {
  const lots = [
    { food: 'berries' as const, kcal: 100, harvestTick: 10 },
    { food: 'nuts' as const, kcal: 200, harvestTick: 20 },
  ]
  expect(eatCarried(lots, 150)).toEqual({ takenKcal: 150, rest: [{ food: 'nuts', kcal: 150, harvestTick: 20 }] })
  expect(lots[0]!.kcal).toBe(100)
})
it('includes the carried load when judging the departure deadline', () => {
  const s = bandAt(),
    p = s.foragers[0]!
  p.hearth = { x: 10000, y: 40000 }
  p.x = 70000
  p.y = 40000
  p.wood = 30
  p.tripWood = 0
  expect(mustGoHome(s, p, 1071 - p.duskMarginMinutes)).toBe(false)
  p.tripWood = 30
  expect(mustGoHome(s, p, 1071 - p.duskMarginMinutes)).toBe(true)
})
