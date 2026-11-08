import { describe, expect, it } from 'vitest'
import { runDayOf } from './calendar'
import { resolveValleyConfig } from './config'
import { cloneValley, stepValley } from './engine'
import { chooseTask, expectedFoodStock, foodGoal, hasStoreNeed } from './forager'
import { ValleyChecker } from './invariants'
import { cropOf, harvestOf, thicketCapacity } from './places'
import { bandAt } from './ruleTestFixtures'
import { carriedKcal } from './food'
import { storeKcal, storeTarget } from './stores'
import { ask, NO_TIE, putTie } from './ties'
import type { Forager, ValleyState } from './types'

const DAY = 1_440
/** At the default 90 days a year the run's days 11 to 22 are the nut window, and days 0 to 10 the berry window. */
const NUT_DAY = 12,
  LEAN_DAY = 40
let HAZEL = -1

/** Books hand-set bodies, stocks and stores as the run's initial food, so the checker sees energy conserved. */
function settle(s: ValleyState) {
  const t = s.totals
  const energy =
    s.foragers.reduce((sum, p) => sum + p.energyKcal + carriedKcal(p.carried) + carriedKcal(p.store), 0) +
    s.foodStock.reduce((sum, kcal) => sum + kcal, 0) +
    s.fishKcal
  t.initialKcal = energy - t.regrownKcal - t.fishGrownKcal + t.metabolizedKcal + t.spoiledKcal + t.lostKcal
  return s
}

/** A person who wants nothing but a store: fed, with wood, standing at their hearth near a hazel thicket. */
function storer(minute = NUT_DAY * DAY + 600) {
  const s = bandAt(minute)
  const p = s.foragers[0]!
  const { places } = s.layout
  HAZEL = -1
  for (let id = 0; id < places.count; id++)
    if (
      places.kind[id] === 1 &&
      (HAZEL < 0 ||
        Math.hypot(places.x[id]! - p.hearth.x, places.y[id]! - p.hearth.y) <
          Math.hypot(places.x[HAZEL]! - p.hearth.x, places.y[HAZEL]! - p.hearth.y))
    )
      HAZEL = id
  p.energyKcal = 67_000
  p.hungry = false
  p.x = p.hearth.x
  p.y = p.hearth.y
  p.knownPlaces.fill(-1)
  p.knownPlaces[HAZEL] = 0
  s.foodStock[HAZEL] = thicketCapacity(s.config, 1)
  p.placeStock[HAZEL] = s.foodStock[HAZEL]!
  p.placeCheckedMinute[HAZEL] = minute
  return settle(s)
}
const nuts = (kcal: number, harvestTick: number) => ({ food: 'nuts' as const, kcal, harvestTick })

describe('expected stock by the calendar', () => {
  const c = resolveValleyConfig({}),
    hazel = thicketCapacity(c, 1)
  // A normal year's crop grown by the end of a window's day `i`: the berry window has 11 days, the nut window 12.
  const berriesBy = (i: number) => Math.floor((cropOf(c, 0, 1_000) * (i + 1)) / 11),
    nutsBy = (i: number) => Math.floor((cropOf(c, 1, 1_000) * (i + 1)) / 12)
  it('expects an unseen thicket empty outside its window and at the openness share of a normal crop inside it', () => {
    // Run day 0 is the berry window's first day; run day 12 the nut window's second.
    expect(expectedFoodStock(c, 0, -1, -1, 750, 600)).toBe(Math.floor((berriesBy(0) * 750) / 1_000))
    expect(expectedFoodStock(c, 0, -1, -1, 750, LEAN_DAY * DAY)).toBe(0)
    expect(expectedFoodStock(c, 1, -1, -1, 750, 600)).toBe(0)
    expect(expectedFoodStock(c, 1, -1, -1, 750, NUT_DAY * DAY)).toBe(Math.floor((nutsBy(1) * 750) / 1_000))
  })
  it('forgets a stock seen before the window began, and grows one seen since by a normal crop', () => {
    // Seen full on arrival, before the nut window: expected empty once it has passed.
    expect(expectedFoodStock(c, 1, hazel, 600, 750, LEAN_DAY * DAY)).toBe(0)
    // Seen in the window: as seen plus a normal year's growth since, in it, and as last expected after it.
    expect(expectedFoodStock(c, 1, 1_234, NUT_DAY * DAY, 750, NUT_DAY * DAY + 600)).toBe(1_234)
    expect(expectedFoodStock(c, 1, 1_234, NUT_DAY * DAY, 750, (NUT_DAY + 3) * DAY)).toBe(1_234 + nutsBy(4) - nutsBy(1))
    expect(expectedFoodStock(c, 1, 1_234, NUT_DAY * DAY, 750, LEAN_DAY * DAY)).toBe(1_234)
    // A year on, the next window has begun since it was seen.
    const nextYear = runDayOf(c, 1, 45) * DAY
    expect(expectedFoodStock(c, 1, 1_234, NUT_DAY * DAY, 750, nextYear)).toBe(Math.floor((nutsBy(5) * 750) / 1_000))
  })
})

describe('the store target', () => {
  const c = resolveValleyConfig({})
  const person = (weightKg: number, conscientiousness: number) =>
    ({ weightKg, traits: { conscientiousness } }) as unknown as Pick<Forager, 'weightKg' | 'traits'>
  it('grows with the days to the next berry season, weight and conscientiousness', () => {
    const average = person(c.referenceBodyKg, 0)
    expect(storeTarget(c, average, NUT_DAY * DAY)).toBeGreaterThan(storeTarget(c, average, LEAN_DAY * DAY))
    expect(storeTarget(c, average, LEAN_DAY * DAY)).toBe(Math.floor((c.storeKcalPerDay * ((29 - 69 + 90) % 90)) / 1))
    expect(storeTarget(c, person(80, 0), LEAN_DAY * DAY)).toBeGreaterThan(storeTarget(c, average, LEAN_DAY * DAY))
    expect(storeTarget(c, person(c.referenceBodyKg, 1_000), LEAN_DAY * DAY)).toBeGreaterThan(
      storeTarget(c, average, LEAN_DAY * DAY),
    )
  })
  it('gives the least conscientious half the average target', () => {
    const average = storeTarget(c, person(c.referenceBodyKg, 0), LEAN_DAY * DAY)
    expect(storeTarget(c, person(c.referenceBodyKg, -3_000), LEAN_DAY * DAY)).toBe(average / 2)
  })
})

describe('storing nuts', () => {
  it('gathers a load for the store, carries it home and stores it, then stops at the target', () => {
    let s = storer()
    const start = s.minute
    expect(hasStoreNeed(s, s.foragers[0]!, start)).toBe(true)
    const checker = new ValleyChecker(s)
    let stored = 0,
      loads = 0
    for (let minute = start + 60; minute <= start + 6 * 60 && !stored; minute += 60) {
      s = stepValley(s, minute)
      expect(checker.check(s)).toEqual([])
      for (const event of s.lastInterval) {
        if (event.kind === 'task-start' && event.foragerId === 0 && event.task.kind === 'store') {
          loads += 1
          expect(event.task.reason).toBe('gathering nuts for the store')
          expect(event.task.storeTarget).toBe(storeTarget(s.config, s.foragers[0]!, event.minute))
        }
        if (event.kind === 'stored' && event.foragerId === 0) stored = event.storeKcal
      }
    }
    const p = s.foragers[0]!
    expect(loads).toBeGreaterThan(0)
    expect(stored).toBeGreaterThan(0)
    // At most a load: the person's load capacity in nuts.
    expect(stored).toBeLessThanOrEqual(p.loadCapacityKg * s.config.nutKcalPerKg)
    expect(storeKcal(p)).toBe(stored)
    expect(p.carried.some((lot) => lot.food === 'nuts')).toBe(false)
    // At the target, they stop.
    p.store = [nuts(storeTarget(s.config, p, s.minute), s.minute)]
    expect(hasStoreNeed(s, p, s.minute)).toBe(false)
  })
  it('gathers nothing for the store outside the nut season with no nuts expected', () => {
    const s = storer(LEAN_DAY * DAY + 600)
    const p = s.foragers[0]!
    p.placeCheckedMinute[HAZEL] = 600
    expect(hasStoreNeed(s, p, s.minute)).toBe(false)
    expect(chooseTask(s, p, s.minute).kind).not.toBe('store')
  })
})

describe('eating from the store', () => {
  const hungryAtHome = (s: ValleyState) => {
    const p = s.foragers[0]!
    p.energyKcal = 60_000
    p.hungry = true
    p.knownPlaces.fill(-1)
    p.knownBanks.clear()
    p.fishMemory.clear()
    p.store = [nuts(20_000, s.minute - DAY)]
    settle(s)
    return p
  }
  it('walks home and eats from the store with no fresh food worth working', () => {
    const s = storer(LEAN_DAY * DAY + 600)
    const p = hungryAtHome(s)
    p.x -= 3_000
    expect(chooseTask(s, p, s.minute)).toMatchObject({ kind: 'walk', reason: 'going home to eat from the store' })
    p.x = p.hearth.x
    expect(chooseTask(s, p, s.minute)).toMatchObject({ kind: 'eat store', reason: 'eating from the store' })
    const checker = new ValleyChecker(s)
    const next = stepValley(s, s.minute + 60)
    expect(checker.check(next)).toEqual([])
    const taken = next.lastInterval.filter((event) => event.kind === 'fromStore')
    expect(taken.length).toBeGreaterThan(0)
    expect(next.foragers[0]!.energyKcal).toBeGreaterThan(60_000)
    expect(next.today.eatenStoreKcal).toBeGreaterThan(0)
  })
  it('never takes food to pay with from the store', () => {
    const s = storer(LEAN_DAY * DAY + 600)
    const p = hungryAtHome(s)
    p.x = p.hearth.x
    expect(foodGoal(s, p, s.minute)).toMatchObject({ kind: 'eat store' })
    expect(foodGoal(s, p, s.minute, false, true)?.kind).not.toBe('eat store')
  })
  it('eats at a full ripe thicket beside them rather than walk home', () => {
    // Stored nuts cracked slower than berries are picked: the thicket wins wherever the hearth is.
    const s = bandAt(600, { storeKcalPerHour: 1_000 })
    const p = hungryAtHome(s)
    p.x = s.layout.places.x[0]!
    p.y = s.layout.places.y[0]!
    p.knownPlaces[0] = 0
    s.foodStock[0] = thicketCapacity(s.config, 0)
    p.placeStock[0] = s.foodStock[0]!
    p.placeCheckedMinute[0] = 600
    expect(chooseTask(s, p, 600)).toMatchObject({ kind: 'pick', placeId: 0 })
  })
  it('spoils stored nuts after their shelf life', () => {
    const s = storer(LEAN_DAY * DAY + 600)
    const p = s.foragers[0]!
    const spoilsAt = (LEAN_DAY + 1) * DAY
    p.store = [nuts(5_000, spoilsAt - s.config.nutShelfLifeHours * 60), nuts(3_000, s.minute)]
    settle(s)
    const checker = new ValleyChecker(s)
    const next = stepValley(s, spoilsAt)
    expect(checker.check(next)).toEqual([])
    expect(next.lastInterval).toContainEqual({ kind: 'storeSpoiled', minute: spoilsAt, foragerId: 0, kcal: 5_000 })
    expect(next.foragers[0]!.store.some((lot) => lot.kcal === 5_000)).toBe(false)
  })
  it('counts nuts from a store as such, also when given on, and sums eaten food to what was eaten', () => {
    const s = bandAt(600)
    const [a, b] = s.foragers as [Forager, Forager]
    a.hungry = true
    a.energyKcal = 60_000
    a.carried = []
    b.carried = [{ ...nuts(3_000, 0), fromStore: true }]
    b.giveGoodwillPerMille = 1_000
    putTie(a.ties, s.config.tiesRemembered, 1, { ...NO_TIE, familiarity: 600 })
    putTie(b.ties, s.config.tiesRemembered, 0, { ...NO_TIE, familiarity: 600 })
    const result = ask(s, a, [1], 600)
    expect(result.events.some((event) => event.kind === 'gift')).toBe(true)
    expect(result.ateKcal).toBeGreaterThan(0)
    expect(s.today.eatenStoreKcal).toBe(result.ateKcal)
    // Over a day of the canonical band, the day's eaten food by source is what the living ate.
    let run = bandAt(600)
    run = stepValley(run, DAY)
    const day = run.days.at(-1)!
    const ate = run.eventDays
      .flat()
      .filter((event) => event.minute >= 600 && event.minute < DAY)
      .reduce((total, event) => total + ('ateKcal' in event ? (event.ateKcal ?? 0) : 0), 0)
    expect(day.eatenBerriesKcal + day.eatenNutsKcal + day.eatenStoreKcal + day.eatenFishKcal).toBe(ate)
  })
})

describe('giving', () => {
  it('gives only from what is carried, never from a store', () => {
    const s = bandAt(600)
    const [a, b] = s.foragers as [Forager, Forager]
    a.hungry = true
    a.energyKcal = 60_000
    a.carried = []
    b.carried = []
    b.store = [nuts(20_000, 0)]
    b.giveGoodwillPerMille = 1_000
    putTie(a.ties, s.config.tiesRemembered, 1, { ...NO_TIE, familiarity: 600 })
    putTie(b.ties, s.config.tiesRemembered, 0, { ...NO_TIE, familiarity: 600 })
    const result = ask(s, a, [1], 600)
    expect(result.events.some((event) => event.kind === 'gift')).toBe(false)
    expect(storeKcal(b)).toBe(20_000)
  })
})

describe('the checker on seasons and stores', () => {
  const checked = (damage: (s: ValleyState) => void, base = storer(), to = base.minute + 60) => {
    const after = stepValley(base, to)
    expect(new ValleyChecker(base).check(after)).toEqual([])
    const broken = cloneValley(after)
    damage(broken)
    return new ValleyChecker(base).check(broken)
  }
  const overnight = () => storer(NUT_DAY * DAY + 1_380)
  it('rejects a stock that grew outside its window or by more than its share', () => {
    const lean = storer(LEAN_DAY * DAY + 1_380)
    expect(
      checked(
        (s) => {
          s.foodStock[0]! += 1
          s.totals.regrownKcal += 1
        },
        lean,
        (LEAN_DAY + 1) * DAY + 60,
      ),
    ).not.toEqual([])
    expect(
      checked(
        (s) => {
          s.foodStock[HAZEL]! += 1
          s.totals.regrownKcal += 1
        },
        overnight(),
        (NUT_DAY + 1) * DAY + 60,
      ),
    ).not.toEqual([])
  })
  it('rejects a loss that does not follow the rule', () => {
    expect(
      checked(
        (s) => {
          const event = s.lastInterval.find((e) => e.kind === 'regrowth' && e.placeId === HAZEL)
          if (event?.kind === 'regrowth') event.lost += 1
          s.foodStock[HAZEL]! -= 1
          s.totals.lostKcal += 1
        },
        overnight(),
        (NUT_DAY + 1) * DAY + 60,
      ),
    ).not.toEqual([])
  })
  it('rejects a crop class that does not replay from its stream', () => {
    const base = storer(runDayOf(resolveValleyConfig({}), 1, 0) * DAY - 60)
    expect(
      checked(
        (s) => {
          const event = s.lastInterval.find((e) => e.kind === 'harvest')
          if (event?.kind === 'harvest') event.hazel = harvestOf(s.config, 1).hazel === 'poor' ? 'good' : 'poor'
        },
        base,
        base.minute + 120,
      ),
    ).not.toEqual([])
  })
  it('rejects a store holding food never put in, or taken from another person’s store', () => {
    expect(
      checked((s) => {
        s.foragers[1]!.store = [nuts(100, s.minute)]
        s.totals.initialKcal += 100
      }),
    ).not.toEqual([])
    const base = storer()
    base.foragers[1]!.store = [nuts(5_000, base.minute)]
    settle(base)
    expect(
      checked((s) => {
        s.foragers[1]!.store = [nuts(4_000, base.minute)]
        s.foragers[0]!.carried = [...s.foragers[0]!.carried, nuts(1_000, base.minute)]
      }, base),
    ).not.toEqual([])
  })
  it('rejects a stored lot past its shelf life', () => {
    expect(
      checked((s) => {
        const old = s.minute - s.config.nutShelfLifeHours * 60 - DAY
        s.foragers[1]!.store = [nuts(100, old)]
        s.totals.initialKcal += 100
      }),
    ).not.toEqual([])
  })
})
