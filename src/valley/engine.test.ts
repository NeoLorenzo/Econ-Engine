import { FLAT_LAND } from './config'
import { describe, expect, it } from 'vitest'
import { LAKE_ID, takeOldest } from './food'
import { lakeCapacityKcal } from './config'
import { cloneValley, createValley, eatCarried, lastEventOf, runValley, stepValley } from './engine'
import { choosePlant } from './forager'
import { distance } from './geometry'
import { ValleyChecker } from './invariants'
import { swap } from './trade'
import type { Forager, ValleyState } from './types'

/** A copy of the valley with the band as one group around the camp at minute `minute`, forager 0 changed by `change`. */
function valleyAt(minute: number, change: (forager: Forager, state: ValleyState) => void = () => {}) {
  const state = cloneValley(createValley({ ...FLAT_LAND, scattered: false }))
  state.minute = minute
  change(state.foragers[0]!, state)
  return state
}

/** Puts a forager `offset` centimetres to the left of a plant. */
const placeBeside = (forager: Forager, x: number, y: number, offset: number) => {
  forager.x = x - offset
  forager.y = y
}

const TEN_AM = 600
const NIGHT = 1_200

describe('a forager’s minute', () => {
  it('keeps gathering to fill a load once it has started, though it holds its target', () => {
    const state = valleyAt(TEN_AM, (forager, valley) => {
      placeBeside(forager, valley.layout.trees.x[0]!, valley.layout.trees.y[0]!, 50)
      forager.wood = 30
      forager.tripWood = 5
      forager.shortOfWood = false
      forager.energyKcal = 67_000
      forager.hungry = false
    })
    const event = lastEventOf(stepValley(state), 0)!
    expect(event.reason).toBe('filling a load')
    expect(event.action).toBe('gather')
    expect(event.workSeconds).toBe(60)
  })

  it('leaves a load unfinished when hunger calls it to food', () => {
    const state = valleyAt(TEN_AM, (forager, valley) => {
      placeBeside(forager, valley.layout.trees.x[0]!, valley.layout.trees.y[0]!, 50)
      forager.tripWood = 5
      forager.energyKcal = 63_000
    })
    expect(lastEventOf(stepValley(state), 0)!.workedFor).toBe('food')
  })

  it('stops counting a load once it is home', () => {
    const state = valleyAt(NIGHT, (forager) => {
      forager.tripWood = 12
    })
    expect(stepValley(state).foragers[0]!.tripWood).toBe(0)
  })

  it('walks to a bush and picks it in the same minute', () => {
    const state = valleyAt(TEN_AM, (forager, valley) => {
      placeBeside(forager, valley.layout.bushes.x[0]!, valley.layout.bushes.y[0]!, 300)
      forager.energyKcal = 63_000
      forager.hungry = true
      // Only bush 0 holds berries, so it is the one worth walking to.
      valley.foodStock.fill(0)
      valley.foodStock[0] = 400
    })
    const next = stepValley(state)
    const event = lastEventOf(next, 0)!
    expect(event.action).toBe('forage')
    expect(event.walkSeconds).toBe(2)
    expect(event.workSeconds).toBe(58)
    expect(event.plantId).toBe(0)
    const forager = next.foragers[0]!
    expect(distance(forager.x, forager.y, next.layout.bushes.x[0]!, next.layout.bushes.y[0]!)).toBeLessThanOrEqual(100)
  })

  it('sleeps at its own hearth at night without a group, warm while it has wood and cold without', () => {
    const alone = (wood: number) => {
      const state = cloneValley(createValley(FLAT_LAND))
      state.minute = NIGHT
      state.foragers[0]!.wood = wood
      return lastEventOf(stepValley(state), 0)!
    }
    expect(alone(5)).toMatchObject({ action: 'sleep', burnedWood: 1, sleptCold: false })
    expect(alone(0)).toMatchObject({ action: 'sleep', burnedWood: 0, sleptCold: true })
  })
})

describe('choosing a plant', () => {
  const setUp = () =>
    valleyAt(TEN_AM, (forager, valley) => {
      forager.x = valley.layout.camp.x
      forager.y = valley.layout.camp.y
      forager.foodMemory.stock.fill(0)
      forager.foodMemory.seen.fill(5)
    })

  /** Food plants of one kind, nearest the camp first. */
  const nearestFirst = (state: ValleyState, from: number, to: number) => {
    const { foodPlants, camp } = state.layout
    const near = (id: number) => distance(foodPlants.x[id]!, foodPlants.y[id]!, camp.x, camp.y)
    return Array.from({ length: to - from }, (_, index) => from + index).sort((a, b) => near(a) - near(b))
  }

  it('chooses the nearer of two sources that would bring the same food an hour', () => {
    const state = setUp()
    const forager = state.foragers[0]!
    const byDistance = nearestFirst(state, 0, state.layout.bushes.count)
    forager.foodMemory.stock[byDistance[10]!] = state.config.bushCapacityKcal
    forager.foodMemory.stock[byDistance[500]!] = state.config.bushCapacityKcal
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute)).toBe(byDistance[10])
  })

  it('walks further for a full hazel than it would stay at a thin bush, and leaves a bush not worth working', () => {
    const state = setUp()
    const forager = state.foragers[0]!
    const { bushes, foodPlants } = state.layout
    const bush = nearestFirst(state, 0, bushes.count)[0]!
    const hazel = nearestFirst(state, bushes.count, foodPlants.count)[0]!
    // A thin bush, still worth working: at any skill, 15 kcal of 52 gives more than the 200 an hour picking costs.
    forager.foodMemory.stock[bush] = 15
    forager.foodMemory.stock[hazel] = state.config.hazelCapacityKcal
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute)).toBe(hazel)
    forager.foodMemory.stock[hazel] = 0
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute)).toBe(bush)
    // With 5 kcal of 52 left, an hour at the bush would bring less than it costs even the quickest picker.
    forager.foodMemory.stock[bush] = 5
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute, false)).toBeNull()
  })

  it('goes to fish once it knows the lake, expecting it full, when it remembers no better food', () => {
    const state = setUp()
    const forager = state.foragers[0]!
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute, false)).toBeNull()
    forager.lakeKnown = true
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute, false)).toBe(LAKE_ID)
    // Having fished it down to a quarter, it no longer finds it worth working.
    forager.lakeStock = lakeCapacityKcal(state.config) / 4
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute, false)).toBeNull()
  })

  it('otherwise chooses the bush seen longest ago', () => {
    const state = setUp()
    const forager = state.foragers[0]!
    forager.foodMemory.seen[1_000] = 1
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute)).toBe(1_000)
  })

  it('keeps its target while it remembers it holding a minute’s work', () => {
    const state = setUp()
    const forager = state.foragers[0]!
    forager.foodMemory.stock[1_500] = 400
    forager.foodMemory.stock[3] = 400
    forager.targetFoodId = 1_500
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute)).toBe(1_500)
    forager.foodMemory.seen[1_500] = state.minute
    forager.foodMemory.stock[1_500] = 0
    expect(choosePlant(state.config, state.layout, forager, 'food', state.minute)).not.toBe(1_500)
  })
})

describe('exchange', () => {
  const pair = (apart: number) => {
    const state = valleyAt(TEN_AM)
    const [seller, buyer] = state.foragers as [Forager, Forager]
    Object.assign(seller, { x: 10_000, y: 10_000, forageRate: 1_000, woodRate: 30, wood: 40, energyKcal: 65_000 })
    Object.assign(buyer, { x: 10_000 + apart, y: 10_000, forageRate: 1_400, woodRate: 14, wood: 0, energyKcal: 69_000 })
    buyer.carried = [{ food: 'berries' as const, kcal: 2_000, harvestTick: TEN_AM }]
    return { state, seller, buyer }
  }

  it('swaps within talking distance', () => {
    const { state, seller } = pair(1_500)
    const { swaps } = swap(state.config, seller, state.foragers, state.minute)
    expect(swaps).toHaveLength(1)
    expect(swaps[0]!.kcalPerWood).toBe(Math.floor((1_000 * 14 + 1_400 * 30) / (2 * 30 * 14)))
  })

  it('does not swap beyond it', () => {
    const { state, seller } = pair(2_500)
    expect(swap(state.config, seller, state.foragers, state.minute).swaps).toHaveLength(0)
  })
})

describe('the engine', () => {
  it('eats carried food exactly as Life’s takeOldest does', () => {
    const lots = [
      { food: 'berries' as const, kcal: 30, harvestTick: 1 },
      { food: 'berries' as const, kcal: 5, harvestTick: 2 },
      { food: 'berries' as const, kcal: 40, harvestTick: 2 },
      { food: 'berries' as const, kcal: 12, harvestTick: 9 },
    ]
    for (let room = -1; room <= 90; room += 1) {
      const expected = takeOldest(lots, room)
      const eaten = eatCarried(lots, room)
      expect(eaten.takenKcal).toBe(expected.takenKcal)
      expect(eaten.rest).toEqual(expected.rest)
    }
    expect(eatCarried([], 50)).toEqual({ rest: [], takenKcal: 0 })
  })

  const fingerprint = (state: ValleyState) =>
    JSON.stringify({
      minute: state.minute,
      bushes: Array.from(state.foodStock),
      trees: Array.from(state.woodStock),
      foragers: state.foragers.map((forager) => ({
        ...forager,
        foodMemory: Array.from(forager.foodMemory.stock),
        woodMemory: Array.from(forager.woodMemory.stock),
      })),
      totals: state.totals,
      days: state.days,
      today: state.today,
      events: state.eventDays,
    })

  it('is deterministic, and running n minutes equals n single steps', () => {
    const start = createValley(FLAT_LAND)
    let stepped = start
    for (let minute = 0; minute < 1_600; minute += 1) stepped = stepValley(stepped)
    expect(fingerprint(runValley(start, 1_600))).toBe(fingerprint(stepped))
    expect(fingerprint(runValley(createValley(FLAT_LAND), 1_600))).toBe(fingerprint(stepped))
  })

  it('never changes the state it is given', () => {
    const start = runValley(createValley(FLAT_LAND), 700)
    const before = fingerprint(start)
    stepValley(start)
    runValley(start, 100)
    expect(fingerprint(start)).toBe(before)
  })

  it('keeps every invariant through two days, and the checker catches what breaks them', () => {
    const start = createValley(FLAT_LAND)
    const checker = new ValleyChecker(start)
    const ran = runValley(start, 2 * 1_440, { onMinute: (state) => checker.assert(state) })
    expect(ran.minute).toBe(2_880)

    /** Runs to `minutes`, then on until a minute satisfies `ready`, damages that minute, and checks it. */
    const breaking = (
      minutes: number,
      damage: (state: ValleyState) => void,
      ready: (state: ValleyState) => boolean = () => true,
    ) => {
      const base = createValley(FLAT_LAND)
      const check = new ValleyChecker(base)
      let after = stepValley(runValley(base, minutes, { onMinute: (state) => check.assert(state) }))
      while (!ready(after)) {
        check.assert(after)
        after = stepValley(after)
      }
      damage(after)
      return check.check(after).join('\n')
    }
    const someoneWorked = (state: ValleyState) => state.lastEvents.some((event) => event.workSeconds > 0)
    expect(breaking(10, (state) => (state.foragers[0]!.energyKcal -= 1))).toMatch('energy is not conserved')
    expect(breaking(420, (state) => (state.foodStock[5]! -= 1))).toMatch('changed without a record')
    expect(
      breaking(500, (state) => {
        const event = state.lastEvents[0]!
        event.position = { x: event.from.x + 20_000, y: event.from.y }
      }),
    ).toMatch('moved further than it walked')
    expect(
      breaking(
        400,
        (state) => {
          const event = state.lastEvents.find((candidate) => candidate.workSeconds > 0)!
          event.position = { x: event.position.x + 500, y: event.position.y }
        },
        someoneWorked,
      ),
    ).toMatch('worked a plant out of reach')
    expect(
      breaking(1_300, (state) => {
        state.lastEvents[0]!.from = { x: 0, y: 0 }
      }),
    ).toMatch('slept away from its hearth')
  })
})
