import { FLAT_LAND } from './config'
import { describe, expect, it } from 'vitest'
import { cloneValley, createValley, lastEventOf, stepValley } from './engine'
import { feedAmount, nightHoursLeft } from './fire'
import { ValleyChecker } from './invariants'
import { dissolveIfAlone } from './social'
import { valleyTheory } from './theory'
import type { ValleyConfig, ValleyState } from './types'

const TEN_AM = 600
const DUSK = 18 * 60
const EIGHT_PM = 20 * 60

/**
 * The band as one group around the camp at minute `minute`, every member at its hearth, with `fireWood` in the
 * group's fire, given by member 1, and member 0 holding `wood`. The wood added goes into the valley's starting totals,
 * so both stay balanced.
 */
function together(minute: number, fireWood: number, wood = 0, overrides: Partial<ValleyConfig> = {}) {
  const state = cloneValley(createValley({ ...FLAT_LAND, scattered: false, ...overrides }))
  state.minute = minute
  state.groups[0]!.fireWood = fireWood
  state.groups[0]!.given = state.groups[0]!.given.map((given, slot) => (slot === 1 ? fireWood : given))
  state.foragers[1]!.fireGiven = fireWood
  state.foragers[0]!.wood = wood
  state.totals.initialWood += fireWood + wood
  return state
}

describe('a shared fire', () => {
  it('burns its hour of wood at the start of every night hour, and is lit for it', () => {
    const after = stepValley(together(DUSK, 5))
    expect(after.lastFires).toEqual([
      { kind: 'fire', minute: DUSK, groupId: 0, burned: 1, lit: true, fireWoodAfter: 4 },
    ])
    expect(after.groups[0]).toMatchObject({ fireLit: true, fireBurned: 1, litHours: 1, darkHours: 0 })
    expect(stepValley(after).lastFires).toEqual([])
  })

  it('never burns by day', () => {
    const after = stepValley(together(TEN_AM, 5))
    expect(after.lastFires).toEqual([])
    expect(after.groups[0]!.fireLit).toBe(false)
  })

  it('goes out with less than an hour of wood, and is relit once it holds an hour', () => {
    const out = stepValley(together(EIGHT_PM, 0))
    expect(out.lastFires[0]).toMatchObject({ lit: false, burned: 0 })
    expect(out.groups[0]).toMatchObject({ fireLit: false, darkHours: 1 })
    const fed = cloneValley(out)
    fed.minute = EIGHT_PM + 60
    fed.groups[0]!.fireWood = 3
    fed.totals.initialWood += 3
    expect(stepValley(fed).lastFires[0]).toMatchObject({ lit: true, burned: 1, fireWoodAfter: 2 })
  })

  it('saves wood: 12 kg a night for the whole group, 1.5 kg a member in a group of 8', () => {
    const theory = valleyTheory(createValley(FLAT_LAND).config)
    expect(theory.campfireNightWood).toBe(12)
    expect(theory.campfireWoodPerMember(8)).toBe(1.5)
    expect(theory.campfireGatherHoursPerDay(3, 24)).toBeCloseTo(1 / 6, 10)
  })
})

describe('warmth', () => {
  it('warms every member asleep by a lit fire, whether or not it gave, and they burn nothing of their own', () => {
    const after = stepValley(together(EIGHT_PM, 12))
    // Member 1 gave the fire's wood; the others gave nothing.
    for (const event of after.lastEvents)
      expect(event).toMatchObject({ reason: 'night', fireGroupId: 0, burnedWood: 0, sleptCold: false, warmth: 'fire' })
    expect(after.foragers.filter((forager) => forager.fireGiven === 0)).toHaveLength(7)
  })

  it('leaves every member cold by a fire that is out', () => {
    const after = stepValley(together(EIGHT_PM, 0))
    expect(after.lastEvents.every((event) => event.sleptCold)).toBe(true)
  })

  it('leaves a forager without a group to tend its own fire', () => {
    const state = cloneValley(createValley(FLAT_LAND))
    state.minute = EIGHT_PM
    state.foragers[0]!.wood = 5
    state.totals.initialWood += 5
    const event = lastEventOf(stepValley(state), 0)!
    expect(event).toMatchObject({ reason: 'night', fireGroupId: null, burnedWood: 1, sleptCold: false, warmth: 'fire' })
  })
})

describe('feeding', () => {
  const config = createValley(FLAT_LAND).config

  it('counts the night hours left: a whole night by day, those after the current hour at night', () => {
    expect(nightHoursLeft(config, TEN_AM)).toBe(12)
    expect(nightHoursLeft(config, EIGHT_PM + 1)).toBe(9)
    expect(nightHoursLeft(config, 5 * 60)).toBe(0)
  })

  it('gives spare wood above two nights, and from its stock what a low fire lacks', () => {
    expect(feedAmount(config, 40, 20, 1, EIGHT_PM + 1)).toEqual({ wood: 16, spareWood: 16, low: false })
    expect(feedAmount(config, 10, 3, 1, EIGHT_PM + 1)).toEqual({ wood: 6, spareWood: 0, low: true })
    expect(feedAmount(config, 30, 0, 1, EIGHT_PM + 1)).toEqual({ wood: 9, spareWood: 6, low: true })
    expect(feedAmount(config, 4, 0, 1, EIGHT_PM + 1)).toEqual({ wood: 4, spareWood: 0, low: true })
    expect(feedAmount(config, 20, 20, 1, TEN_AM)).toEqual({ wood: 0, spareWood: 0, low: false })
  })

  it('puts a member’s wood into its group’s fire at its hearth, and records who gave it', () => {
    // Its 6 kg above two nights are spare, which is also what the fire lacks for the 9 night hours left.
    const after = stepValley(together(EIGHT_PM + 1, 3, 30))
    expect(after.lastFeeds).toEqual([
      {
        kind: 'feed',
        minute: EIGHT_PM + 1,
        groupId: 0,
        foragerId: 0,
        wood: 6,
        spareWood: 6,
        low: true,
        woodBefore: 30,
        burnPerHour: 1,
        fireWoodBefore: 3,
        fireWoodAfter: 9,
      },
    ])
    expect(after.foragers[0]).toMatchObject({ wood: 24, fireGiven: 6 })
    expect(after.groups[0]!.fireWood).toBe(9)
    expect(after.groups[0]!.given).toEqual([6, 3, 0, 0, 0, 0, 0, 0])
    expect(after.today.fireGivenById[0]).toBe(6)
  })

  it('takes from its stock what a low fire lacks beyond its spare wood', () => {
    const feed = stepValley(together(EIGHT_PM + 1, 0, 30)).lastFeeds[0]!
    expect(feed).toMatchObject({ wood: 9, spareWood: 6, low: true, fireWoodAfter: 9 })
  })

  it('gives nothing away from its hearth', () => {
    const state = together(EIGHT_PM + 1, 0, 30)
    state.foragers[0]!.x += 20_000
    const after = stepValley(state)
    expect(lastEventOf(after, 0)!.reason).toBe('going home')
    expect(after.lastFeeds).toEqual([])
  })
})

describe('a group that dissolves', () => {
  it('gives the wood in its fire back to its survivor', () => {
    const state = together(TEN_AM, 7, 2)
    for (const forager of state.foragers.slice(1)) {
      forager.alive = false
      forager.energyKcal = 0
    }
    const made = dissolveIfAlone(state, 0, TEN_AM)
    expect(made).toMatchObject({ kind: 'dissolve', survivorId: 0, fireWood: 7 })
    expect(state.foragers[0]!.wood).toBe(9)
    expect(state.groups[0]!.fireWood).toBe(0)
  })
})

describe('the checker', () => {
  function damaged(base: ValleyState, damage: (after: ValleyState) => void) {
    const checker = new ValleyChecker(base)
    const after = stepValley(base)
    damage(after)
    return checker.check(after).join('\n')
  }

  it('finds nothing wrong in sound minutes', () => {
    expect(damaged(together(DUSK, 5), () => {})).toBe('')
    expect(damaged(together(EIGHT_PM + 1, 3, 30), () => {})).toBe('')
    expect(damaged(together(EIGHT_PM, 0), () => {})).toBe('')
  })

  it('catches wood lost from a fire', () => {
    const found = damaged(together(DUSK, 5), (after) => (after.groups[0]!.fireWood -= 1))
    expect(found).toMatch('wood is not conserved')
    expect(found).toMatch('changed without a record')
  })

  it('catches a fire burning by day, or burning the wrong amount', () => {
    expect(
      damaged(together(TEN_AM, 5), (after) => {
        after.lastFires = [{ kind: 'fire', minute: TEN_AM, groupId: 0, burned: 0, lit: false, fireWoodAfter: 5 }]
      }),
    ).toMatch('outside the start of a night hour')
    expect(damaged(together(DUSK, 5), (after) => (after.lastFires[0]!.lit = false))).toMatch('burned the wrong amount')
  })

  it('catches a member warm by a dark fire', () => {
    expect(damaged(together(EIGHT_PM, 0), (after) => (after.lastEvents[0]!.warmth = 'fire'))).toMatch(
      'warmth does not match',
    )
    expect(damaged(together(EIGHT_PM, 0), (after) => (after.lastEvents[0]!.sleptCold = false))).toMatch(
      'slept cold at another warmth',
    )
  })

  it('catches a gift away from the hearth, or of the wrong amount', () => {
    const base = together(EIGHT_PM + 1, 3, 30)
    expect(
      damaged(base, (after) => {
        const event = lastEventOf(after, 0)!
        event.position = { x: event.position.x + 100, y: event.position.y }
      }),
    ).toMatch('away from its hearth')
    expect(damaged(base, (after) => (after.lastFeeds[0]!.spareWood = 0))).toMatch('the wrong amount')
  })
})
