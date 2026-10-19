import { describe, expect, it } from 'vitest'
import { cloneValley, createValley, lastEventOf, stepValley } from './engine'
import { ValleyChecker } from './invariants'
import { chooseSite, observeSites, siteCentre, siteCount, siteHolds, siteKind, sightOf, siteWanted } from './sites'
import { choosePlace, idleGoal, observePlaces, placeCount, placeWanted } from './social'
import type { Forager, ValleyState } from './types'

const TEN_AM = 600
const NIGHT = 1_200

/** A copy of the canonical valley at minute `minute`, changed by `change`. */
function valleyAt(minute: number, change: (state: ValleyState) => void = () => {}) {
  const state = cloneValley(createValley())
  state.minute = minute
  change(state)
  return state
}

const put = (forager: Forager, x: number, y: number) => {
  forager.x = x
  forager.y = y
}

/** A forager whose needs are met, in a group, so that it explores or checks when idle. */
function idle(forager: Forager) {
  forager.energyKcal = 69_000
  forager.hungry = false
  forager.wood = 24
  forager.shortOfWood = false
  forager.groupId = 0
}

describe('sight', () => {
  const state = valleyAt(TEN_AM)
  const { config, layout } = state

  it('numbers thickets first, then hazel thickets, then stands, then outcrops', () => {
    expect(siteCount(config)).toBe(80)
    expect(siteKind(config, 0)).toBe('thicket')
    expect(siteKind(config, 32)).toBe('hazel')
    expect(siteCentre(config, layout, 32)).toEqual(layout.hazelThickets[0])
    expect(siteKind(config, 64)).toBe('stand')
    expect(siteCentre(config, layout, 64)).toEqual(layout.stands[0])
    expect(siteKind(config, 76)).toBe('outcrop')
    expect(siteCentre(config, layout, 76)).toEqual(layout.outcrops[0])
    // Food is searched for in both kinds of thicket, and wood in stands and in berry thickets whose bushes hold sticks.
    expect(siteHolds(config, 32, 'food') && siteHolds(config, 0, 'food') && !siteHolds(config, 64, 'food')).toBe(true)
    expect(siteHolds(config, 0, 'wood') && !siteHolds(config, 32, 'wood')).toBe(true)
  })

  it('sees across the valley by day and only close by at night', () => {
    expect(sightOf(config, TEN_AM)).toBe(100_000)
    expect(sightOf(config, NIGHT)).toBe(2_500)
    const day = state.foragers[0]!
    put(day, config.valleySizeCm / 2, config.valleySizeCm / 2)
    observeSites(config, layout, day, TEN_AM)
    expect([...day.siteKnown].every((known) => known === 1)).toBe(true)
    const night = valleyAt(NIGHT).foragers[0]!
    const thicket = layout.thickets[0]!
    put(night, thicket.x + 2_500, thicket.y)
    observeSites(config, layout, night, NIGHT)
    expect(night.siteKnown[0]).toBe(1)
    expect(night.siteKnown.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('checks a site only from close enough to see every plant in it', () => {
    const forager = valleyAt(TEN_AM).foragers[0]!
    const thicket = layout.thickets[0]!
    // Close sight is 25 m and a thicket 12 m in radius, so it is checked from within 13 m of its centre.
    put(forager, thicket.x + 1_301, thicket.y)
    observeSites(config, layout, forager, TEN_AM)
    expect(forager.siteChecked[0]).toBe(-1)
    put(forager, thicket.x + 1_300, thicket.y)
    observeSites(config, layout, forager, TEN_AM)
    expect(forager.siteChecked[0]).toBe(TEN_AM)
  })

  it('marks every place within sight seen, and keeps the minute it first saw it', () => {
    const forager = valleyAt(TEN_AM).foragers[0]!
    put(forager, 30_000, 30_000)
    observePlaces(config, forager, TEN_AM)
    expect(forager.placesSeen).toBe(placeCount(config))
    observePlaces(config, forager, TEN_AM + 1)
    expect(forager.placeSeen[0]).toBe(TEN_AM)
    // Seen ground never needs exploring again.
    expect(placeWanted(forager, 0)).toBe(false)
  })

  it('walks towards another forager seen 300 m away to seek company', () => {
    const valley = valleyAt(TEN_AM, (s) => {
      s.foragers.forEach((forager, id) => put(forager, 1_000 + 7_000 * id, 59_000))
      put(s.foragers[0]!, 10_000, 10_000)
      put(s.foragers[1]!, 40_000, 10_000)
    })
    const goal = idleGoal(valley, valley.foragers[0]!, TEN_AM)
    expect(goal).toMatchObject({ x: 40_000, y: 10_000, reason: 'seeking company' })
  })
})

describe('exploring and checking', () => {
  it('explores the nearest place never seen first, then checks the nearest site not checked for a day', () => {
    const state = valleyAt(TEN_AM)
    const { config, layout } = state
    const forager = state.foragers[0]!
    idle(forager)
    forager.siteKnown.fill(1)
    forager.siteChecked.fill(TEN_AM - 60)
    forager.placeSeen.fill(TEN_AM - 10)
    forager.placesSeen = placeCount(config) - 1
    forager.placeSeen[399] = -1
    expect(idleGoal(state, forager, TEN_AM)).toMatchObject({ reason: 'exploring', placeId: 399, siteId: null })
    forager.placeSeen[399] = TEN_AM - 10
    forager.placesSeen = placeCount(config)
    forager.exploreTarget = null
    expect(choosePlace(config, forager, TEN_AM)).toBeNull()
    // Every site was checked an hour ago, so none is worth checking yet; then two go a day unchecked.
    expect(idleGoal(state, forager, TEN_AM)).toBeNull()
    forager.siteChecked[3] = TEN_AM - 24 * 60
    forager.siteChecked[35] = TEN_AM - 30 * 60
    const near = siteCentre(config, layout, 3)
    put(forager, near.x + 500, near.y)
    expect(idleGoal(state, forager, TEN_AM)).toMatchObject({ ...near, reason: 'checking', siteId: 3 })
    const far = siteCentre(config, layout, 35)
    put(forager, far.x, far.y + 500)
    expect(idleGoal(state, forager, TEN_AM)).toMatchObject({ ...far, reason: 'checking', siteId: 35 })
  })

  it('checks only sites it knows, and none it could not reach and leave before dusk', () => {
    const state = valleyAt(TEN_AM)
    const { config, layout } = state
    const forager = state.foragers[0]!
    expect(chooseSite(config, layout, forager, TEN_AM, 'check', null)).toBeNull()
    forager.siteKnown[5] = 1
    expect(chooseSite(config, layout, forager, TEN_AM, 'check', null)).toBe(5)
    const centre = siteCentre(config, layout, 5)
    put(forager, centre.x, centre.y)
    forager.hearth = { x: centre.x > 30_000 ? 0 : 60_000, y: centre.y > 30_000 ? 0 : 60_000 }
    put(forager, forager.hearth.x, forager.hearth.y)
    expect(chooseSite(config, layout, forager, 18 * 60 - 5, 'check', null)).toBeNull()
  })
})

describe('searching', () => {
  it('searches the nearest thicket it has never checked before unseen ground, and both before revisiting', () => {
    const state = valleyAt(TEN_AM, (valley) => {
      const forager = valley.foragers[0]!
      put(forager, valley.layout.camp.x, valley.layout.camp.y)
      forager.energyKcal = 63_000
      forager.hungry = true
      forager.siteKnown.fill(1)
      forager.siteChecked.fill(5)
      forager.siteChecked[7] = -1
      // A stand never checked is no use to a forager looking for food.
      forager.siteChecked[65] = -1
    })
    const searching = lastEventOf(stepValley(state), 0)!
    expect(searching).toMatchObject({ reason: 'searching', siteId: 7, placeId: null, workedFor: 'food' })
    expect(siteWanted(state.config, state.foragers[0]!, 7, TEN_AM, 'search')).toBe(true)

    // Every thicket checked, it searches the places it has never seen; with none left, it goes back to the bushes.
    state.foragers[0]!.siteChecked[7] = 5
    state.foragers[0]!.foodMemory.seen.fill(5)
    state.foragers[0]!.foodMemory.stock.fill(0)
    state.foragers[0]!.foodMemory.seen[1_000] = 1
    // It has fished the lake and found it empty.
    state.foragers[0]!.lakeKnown = true
    state.foragers[0]!.lakeStock = 0
    const ground = lastEventOf(stepValley(state), 0)!
    expect(ground.reason).toBe('seeking food')
    expect(ground.targetId).toBe(1_000)
  })
})

describe('the checker', () => {
  /** Steps one minute from a prepared valley at ten in the morning, damages the result and checks it. */
  function damaged(prepare: (state: ValleyState) => void, damage: (after: ValleyState) => void) {
    const base = valleyAt(TEN_AM, prepare)
    const checker = new ValleyChecker(base)
    const after = stepValley(base)
    damage(after)
    return checker.check(after).join('\n')
  }

  it('finds nothing wrong in a sound minute', () => {
    expect(
      damaged(
        () => {},
        () => {},
      ),
    ).toBe('')
  })

  it('catches a site checked from too far, and a site spotted beyond sight', () => {
    expect(
      damaged(
        () => {},
        (after) => {
          const forager = after.foragers[0]!
          const far = [...Array(siteCount(after.config)).keys()].find((site) => {
            const centre = siteCentre(after.config, after.layout, site)
            return Math.hypot(centre.x - forager.x, centre.y - forager.y) > 5_000
          })!
          forager.siteChecked[far] = TEN_AM
        },
      ),
    ).toMatch('does not match where it stood')
    const night = valleyAt(NIGHT)
    const checker = new ValleyChecker(night)
    const after = stepValley(night)
    const forager = after.foragers[0]!
    const far = [...Array(siteCount(after.config)).keys()].find((site) => {
      const centre = siteCentre(after.config, after.layout, site)
      return Math.hypot(centre.x - forager.x, centre.y - forager.y) > 5_000
    })!
    forager.siteKnown[far] = 1
    expect(checker.check(after).join('\n')).toMatch('spotted site')
  })

  it('catches exploring towards ground already seen', () => {
    expect(
      damaged(
        () => {},
        (after) => {
          const event = after.lastEvents.find((made) => made.foragerId === 0)!
          event.reason = 'exploring'
          event.placeId = 0
        },
      ),
    ).toMatch('a place it did not need to see')
  })
})
