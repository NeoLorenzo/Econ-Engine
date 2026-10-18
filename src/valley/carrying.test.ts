import { describe, expect, it } from 'vitest'
import { cloneValley, createValley, lastEventOf, stepValley } from './engine'
import { loadKg, loadOf, mustGoHome, reachableInTime, speedForLoad, walkSpeed } from './forager'
import { distance } from './geometry'
import { ValleyChecker } from './invariants'
import { valleyTheory } from './theory'
import { minuteCost } from './work'
import type { Forager, ValleyState } from './types'

const TEN_AM = 600

/** A copy of the canonical valley at minute `minute`, with forager 0 changed by `change`. */
function valleyAt(minute: number, change: (forager: Forager, state: ValleyState) => void = () => {}) {
  const state = cloneValley(createValley())
  state.minute = minute
  change(state.foragers[0]!, state)
  return state
}

/** Forager 0 beside the first tree, not hungry, with a full load gathered on this trip. */
const withFullLoad = (forager: Forager, state: ValleyState) => {
  forager.x = state.layout.trees.x[0]! - 50
  forager.y = state.layout.trees.y[0]!
  forager.energyKcal = 17_000
  forager.hungry = false
  forager.wood = 30
  forager.tripWood = 30
  forager.shortOfWood = false
  forager.groupId = 0
}

describe('a load', () => {
  const { config } = createValley()

  it('is the wood of the trip, no more than it holds, and its berries at 500 kcal a kilogram', () => {
    const forager = valleyAt(TEN_AM).foragers[0]!
    forager.tripWood = 12
    forager.wood = 20
    forager.carried = [{ kcal: 1_200, harvestTick: TEN_AM }]
    expect(loadOf(forager)).toEqual({ wood: 12, berriesKcal: 1_200, log: 0 })
    expect(loadKg(config, 12, 1_200)).toBe(14)
    forager.wood = 5
    expect(loadOf(forager).wood).toBe(5)
  })

  it('slows the walk: 4.5 km/h unloaded, about 3.9 with 10 kg and 3.0 with 30 kg', () => {
    expect(speedForLoad(config, 0)).toBe(125)
    expect(speedForLoad(config, 10)).toBe(107)
    expect(speedForLoad(config, 30)).toBe(83)
    const theory = valleyTheory(config)
    expect(theory.loadedWalkSeconds(15_000, 30)).toBe(181)
    expect(theory.carryCostKcal(15_000, 30)).toBeCloseTo(5.08, 2)
  })

  it('costs the same each second of walking, so each metre costs more', () => {
    const minute = { walk: 60, work: 0, stand: 0, sleep: 0 }
    expect(minuteCost(config, minute, null)).toBe(60 * config.travelKcalPerHour)
  })

  it('counts in what can be reached before dusk and when it must set out for home', () => {
    const state = valleyAt(TEN_AM)
    const forager = state.foragers[0]!
    forager.hearth = { x: 0, y: 0 }
    forager.x = 0
    forager.y = 0
    // 300 m out and back: 480 s unloaded with a minute's work, 783 s with 30 kg.
    expect(reachableInTime(config, forager, 30_000, 0, 600)).toBe(true)
    forager.tripWood = 30
    forager.wood = 30
    expect(walkSpeed(config, forager)).toBe(83)
    expect(reachableInTime(config, forager, 30_000, 0, 600)).toBe(false)
    forager.x = 30_000
    // 300 m home is 240 s unloaded and 362 s with the load; 18:00 less 5 minutes leaves 300.
    const late = 18 * 60 - 5
    expect(mustGoHome(config, forager, late)).toBe(true)
    forager.tripWood = 0
    expect(mustGoHome(config, forager, late)).toBe(false)
  })
})

describe('taking a load home', () => {
  it('walks home with a full load at the speed the load allows, before doing anything else', () => {
    const state = valleyAt(TEN_AM, withFullLoad)
    const forager = state.foragers[0]!
    const after = stepValley(state)
    const event = lastEventOf(after, 0)!
    expect(event).toMatchObject({ reason: 'taking a load home', loadWood: 30, speedCmPerSecond: 83, walkSeconds: 60 })
    const walked = distance(event.from.x, event.from.y, event.position.x, event.position.y)
    expect(walked).toBeLessThanOrEqual(60 * 83)
    expect(walked).toBeGreaterThan(60 * 82)
    const before = distance(forager.x, forager.y, forager.hearth.x, forager.hearth.y)
    const now = after.foragers[0]!
    expect(distance(now.x, now.y, now.hearth.x, now.hearth.y)).toBeLessThan(before)
  })

  it('works for food first when hungry, load and all', () => {
    const state = valleyAt(TEN_AM, (forager, valley) => {
      withFullLoad(forager, valley)
      forager.energyKcal = 13_000
      forager.hungry = true
    })
    const event = lastEventOf(stepValley(state), 0)!
    expect(['seeking food', 'foraging', 'searching']).toContain(event.reason)
    expect(event.speedCmPerSecond).toBe(83)
  })
})

describe('the checker', () => {
  /** Forager 0 with a full load, its reserve and wood added to the valley's starting totals so both stay balanced. */
  const balanced = (tripWood: number) =>
    valleyAt(TEN_AM, (forager, state) => {
      const { energyKcal, wood } = forager
      withFullLoad(forager, state)
      forager.tripWood = tripWood
      // Without a group of its own, since none stands yet.
      forager.groupId = null
      state.totals.initialKcal += forager.energyKcal - energyKcal
      state.totals.initialWood += forager.wood - wood
    })

  function damaged(damage: (after: ValleyState) => void) {
    const base = balanced(30)
    const checker = new ValleyChecker(base)
    const after = stepValley(base)
    damage(after)
    return checker.check(after).join('\n')
  }
  const own = (after: ValleyState) => after.lastEvents.find((event) => event.foragerId === 0)!

  it('finds nothing wrong in a sound minute', () => {
    expect(damaged(() => {})).toBe('')
  })

  it('judges a walk home by the hearth it walked to, though meeting someone on the way moves it', () => {
    const base = balanced(30)
    const [carrier, other] = base.foragers as [Forager, Forager]
    // Forager 1 stands 10 m away, so the two meet and found a group, and the carrier's hearth moves to the flag.
    other.x = carrier.x + 1_000
    other.y = carrier.y
    const checker = new ValleyChecker(base)
    const after = stepValley(base)
    expect(after.groups).toHaveLength(1)
    expect(after.foragers[0]!.hearth).not.toEqual(carrier.hearth)
    expect(checker.check(after).join('\n')).toBe('')
  })

  it('catches a walk faster than the load allows', () => {
    expect(damaged((after) => (own(after).speedCmPerSecond = 125))).toMatch('a speed its load does not allow')
    expect(
      damaged((after) => {
        const event = own(after)
        event.position = { x: event.from.x + 60 * 100, y: event.from.y }
      }),
    ).toMatch('moved further than it walked')
    expect(damaged((after) => (own(after).loadWood = 31))).toMatch('a load it did not have')
  })

  it('catches exploring with a full load, and taking home a load it did not carry', () => {
    expect(damaged((after) => (own(after).reason = 'checking'))).toMatch('checking with a full load')
    const base = balanced(10)
    const checker = new ValleyChecker(base)
    const after = stepValley(base)
    own(after).reason = 'taking a load home'
    expect(checker.check(after).join('\n')).toMatch('took home a load it was not carrying')
  })
})
