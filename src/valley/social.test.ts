import { FLAT_LAND } from './config'
import { observeAround } from './sight'
import { describe, expect, it } from 'vitest'
import { cloneValley, createValley, lastEventOf, runValley, stepValley } from './engine'
import { ValleyChecker } from './invariants'
import {
  choosePlace,
  dissolveIfAlone,
  hearthAround,
  meet,
  observePlaces,
  placeCentre,
  placeCount,
  placeInView,
  placesPerSide,
} from './social'
import { swap } from './trade'
import type { Forager, ValleyState } from './types'

const TEN_AM = 600

// Places, meeting and groups, with sight as short as close sight so that what a forager sees stays near it; long
// sight and sites are tested in `sites.test.ts`.
const SHORT_SIGHT = { sightRadiusCm: 2_500 }

/** A copy of the valley with short sight at minute `minute`, with every forager changed by `change`. */
function valleyAt(minute: number, change: (state: ValleyState) => void = () => {}) {
  const state = cloneValley(createValley({ ...FLAT_LAND, ...SHORT_SIGHT }))
  state.minute = minute
  change(state)
  return state
}

const put = (forager: Forager, x: number, y: number) => {
  forager.x = x
  forager.y = y
}

describe('places', () => {
  const { config } = createValley({ ...FLAT_LAND, ...SHORT_SIGHT })

  it('divides the valley into 729 places of 30 m, the last row and column cut at the edge', () => {
    expect(placesPerSide(config)).toBe(27)
    expect(placeCount(config)).toBe(729)
    expect(placeCentre(config, 0)).toEqual({ x: 1_500, y: 1_500 })
    expect(placeCentre(config, 28)).toEqual({ x: 4_500, y: 4_500 })
  })

  it('counts a place seen only when all of it lies in view, as it does from its centre', () => {
    expect(placeInView(config, 28, 4_500, 4_500)).toBe(true)
    // 21.2 m to the far corners from the centre; 6 m off centre, the far corners lie beyond 25 m.
    expect(placeInView(config, 28, 5_100, 4_500)).toBe(false)
    const forager = createValley({ ...FLAT_LAND, ...SHORT_SIGHT }).foragers[0]!
    put(forager, 4_500, 4_500)
    observePlaces(config, forager, 7)
    expect(forager.placeSeen[28]).toBe(7)
    expect(forager.placeSeen[29]).toBe(-1)
    expect(forager.placesSeen).toBe(1)
  })

  it('explores the nearest place never seen, ties to the lowest ID, and keeps it as its target', () => {
    const state = valleyAt(TEN_AM)
    const forager = state.foragers[0]!
    put(forager, 4_500, 3_000)
    forager.placeSeen.fill(TEN_AM - 10)
    forager.placesSeen = placeCount(state.config) - 2
    // Places 1 and 28 are equally near and never seen; 1 has the lower ID.
    forager.placeSeen[1] = -1
    forager.placeSeen[28] = -1
    expect(choosePlace(state.config, forager, TEN_AM)).toBe(1)
    forager.placeSeen[250] = -1
    forager.placesSeen -= 1
    put(forager, 30_000, 37_000)
    expect(choosePlace(state.config, forager, TEN_AM)).toBe(1)
    forager.placeSeen[1] = TEN_AM
    forager.placesSeen += 1
    expect(choosePlace(state.config, forager, TEN_AM)).toBe(250)
    const seenAll = valleyAt(TEN_AM).foragers[0]!
    seenAll.placeSeen.fill(TEN_AM - 10)
    seenAll.placesSeen = placeCount(state.config)
    expect(choosePlace(state.config, seenAll, TEN_AM)).toBeNull()
  })

  it('searches only places never seen, and none it could not reach and leave before dusk', () => {
    const state = valleyAt(TEN_AM)
    const forager = state.foragers[0]!
    forager.placeSeen.fill(0)
    forager.placesSeen = placeCount(state.config) - 1
    forager.placeSeen[728] = -1
    forager.placeSeen[0] = 0
    put(forager, 1_500, 1_500)
    forager.hearth = { x: 1_500, y: 1_500 }
    expect(choosePlace(state.config, forager, TEN_AM)).toBe(728)
    // Ten minutes before dusk, the far corner of the valley is out of reach.
    forager.exploreTarget = null
    expect(choosePlace(state.config, forager, 18 * 60 - 10)).toBeNull()
  })
})

describe('searching', () => {
  it('searches ground it has never seen before it goes back to bushes it found bare', () => {
    const state = valleyAt(TEN_AM, (valley) => {
      const forager = valley.foragers[0]!
      put(forager, valley.layout.camp.x, valley.layout.camp.y)
      forager.energyKcal = 63_000
      forager.hungry = true
      forager.foodMemory.seen.fill(5)
      forager.foodMemory.stock.fill(0)
    })
    const searching = lastEventOf(stepValley(state), 0)!
    expect(searching.reason).toBe('searching')
    expect(state.foragers[0]!.placeSeen[searching.placeId!]).toBe(-1)

    state.foragers[0]!.placeSeen.fill(5)
    state.foragers[0]!.placesSeen = placeCount(state.config)
    state.foragers[0]!.foodMemory.seen[1_000] = 1
    const revisiting = lastEventOf(stepValley(state), 0)!
    expect(revisiting.reason).toBe('seeking food')
    expect(revisiting.targetId).toBe(1_000)
  })
})

describe('meeting', () => {
  const pair = (apart: number) =>
    valleyAt(TEN_AM, (valley) => {
      valley.foragers.forEach((forager, id) => put(forager, 5_000 + 6_000 * id, 50_000))
      put(valley.foragers[0]!, 20_000, 20_000)
      put(valley.foragers[1]!, 20_000 + apart, 20_001)
    })

  it('makes two foragers without a group within talking distance found one, with the flag between them', () => {
    const state = pair(1_801)
    const event = meet(state, state.foragers[0]!, TEN_AM)!
    expect(event).toMatchObject({ kind: 'found', groupId: 0, flag: { x: 20_900, y: 20_000 }, founderIds: [0, 1] })
    const flag = state.groups[0]!.flag
    expect(state.foragers[0]!.hearth).toEqual(hearthAround(state.config, flag, 0))
    expect(state.foragers[1]!.hearth).toEqual(hearthAround(state.config, flag, 1))
    expect(state.foragers[0]!.hearth).toEqual({ x: flag.x - 494, y: flag.y - 494 })
    expect(state.groups[0]!.members).toEqual([0, 1])
  })

  it('leaves the survivor of a group founded and dissolved in the same minute at its slot, keeping every invariant', () => {
    const state = pair(1_000)
    // Both asleep where they lie, at night, and forager 1 with a kilocalorie left, so it starves in its turn.
    state.minute = 20 * 60
    for (const forager of state.foragers) forager.hearth = { x: forager.x, y: forager.y }
    const dying = state.foragers[1]!
    state.totals.initialKcal -= dying.energyKcal - 1
    dying.energyKcal = 1
    const checker = new ValleyChecker(state)
    const after = stepValley(state)
    expect(after.lastGroupEvents.map((made) => made.kind)).toEqual(['found', 'dissolve'])
    expect(after.foragers[0]!.groupId).toBeNull()
    expect(after.foragers[0]!.hearth).toEqual(hearthAround(after.config, after.groups[0]!.flag, 0))
    expect(checker.check(after)).toEqual([])
  })

  it('does not meet beyond talking distance', () => {
    const state = pair(2_001)
    expect(meet(state, state.foragers[0]!, TEN_AM)).toBeNull()
  })

  it('joins the group of the nearest forager it meets, and a member never changes group', () => {
    const state = pair(1_000)
    meet(state, state.foragers[0]!, TEN_AM)
    const loner = state.foragers[2]!
    put(loner, 20_000, 21_500)
    // Forager 3, without a group, is further from forager 2 than member 0 is.
    put(state.foragers[3]!, 20_000, 23_400)
    const event = meet(state, loner, TEN_AM)!
    expect(event).toMatchObject({ kind: 'join', groupId: 0, foragerId: 2, metId: 0 })
    expect(loner.hearth).toEqual(hearthAround(state.config, state.groups[0]!.flag, 2))
    expect(meet(state, loner, TEN_AM)).toBeNull()
    // A second group, founded beside a member of the first, does not take it in.
    put(state.foragers[4]!, 21_000, 21_000)
    put(state.foragers[5]!, 21_500, 21_000)
    meet(state, state.foragers[4]!, TEN_AM)
    expect(state.groups).toHaveLength(2)
    expect(meet(state, state.foragers[1]!, TEN_AM)).toBeNull()
    expect(state.foragers[1]!.groupId).toBe(0)
  })

  it('swaps and tells terms only within a group', () => {
    const state = pair(1_000)
    const [seller, buyer] = state.foragers as [Forager, Forager]
    Object.assign(seller, { forageRate: 1_000, woodRate: 30, wood: 40, energyKcal: 65_000 })
    Object.assign(buyer, { forageRate: 1_400, woodRate: 14, wood: 0, energyKcal: 69_000 })
    buyer.carried = [{ food: 'berries' as const, kcal: 2_000, harvestTick: TEN_AM }]
    expect(swap(state.config, seller, state.foragers, TEN_AM).swaps).toHaveLength(0)
    meet(state, seller, TEN_AM)
    expect(swap(state.config, seller, state.foragers, TEN_AM).swaps).toHaveLength(1)
  })

  it('dissolves a group left with one living member, who keeps its hearth and seeks company again', () => {
    const state = pair(1_000)
    meet(state, state.foragers[0]!, TEN_AM)
    const survivor = state.foragers[1]!
    const hearth = survivor.hearth
    state.foragers[0]!.alive = false
    expect(dissolveIfAlone(state, 0, TEN_AM)).toMatchObject({ kind: 'dissolve', groupId: 0, survivorId: 1 })
    expect(survivor.groupId).toBeNull()
    expect(survivor.hearth).toBe(hearth)
    expect(survivor.knownFlags).toEqual([0])
    observeAround(state, survivor, TEN_AM)
    expect(survivor.knownFlags).toEqual([])
  })
})

describe('groups in a run', () => {
  /** Runs the valley with short sight and the checker to `minutes`, then on until `ready`, damages that minute and checks. */
  const breaking = (
    minutes: number,
    damage: (state: ValleyState) => void,
    ready: (state: ValleyState) => boolean = () => true,
  ) => {
    const base = createValley({ ...FLAT_LAND, ...SHORT_SIGHT })
    const check = new ValleyChecker(base)
    let after = stepValley(runValley(base, minutes, { onMinute: (state) => check.assert(state) }))
    while (!ready(after)) {
      check.assert(after)
      after = stepValley(after)
    }
    damage(after)
    return check.check(after).join('\n')
  }
  const grouped = (state: ValleyState) => state.groups.length > 0

  it('lets a band without groups form them, keeping every invariant', () => {
    const start = createValley({ ...FLAT_LAND, ...SHORT_SIGHT })
    const checker = new ValleyChecker(start)
    const end = runValley(start, 1_440, { onMinute: (state) => checker.assert(state) })
    expect(end.groups.length).toBeGreaterThan(0)
    expect(end.groups.length).toBeLessThanOrEqual(4)
  })

  it('catches a member without a standing group, a hearth off its slot, and a group of one', () => {
    const member = (state: ValleyState) => state.foragers.find((forager) => forager.groupId !== null)!
    expect(breaking(0, (state) => (state.groups[0]!.dissolvedMinute = state.minute - 1), grouped)).toMatch(
      'belongs to a dissolved group',
    )
    expect(breaking(0, (state) => (member(state).hearth = { x: 0, y: 0 }), grouped)).toMatch('not its slot')
    expect(
      breaking(
        0,
        (state) => {
          const [first] = state.groups[0]!.members
          state.foragers[first!]!.groupId = null
        },
        grouped,
      ),
    ).toMatch(/changed group without meeting|left a group|stands with 1 living members/)
  })

  it('catches a swap between groups and a forager without a group left beside another', () => {
    expect(
      breaking(
        0,
        (state) => {
          const seller = state.foragers.find((forager) => forager.groupId !== null)!
          const buyer = state.foragers.find((forager) => forager.groupId !== seller.groupId)!
          state.lastSwaps = [
            {
              kind: 'swap',
              minute: state.minute - 1,
              position: { x: seller.x, y: seller.y },
              sellerId: seller.id,
              buyerId: buyer.id,
              wood: 1,
              kcal: 50,
              kcalPerWood: 50,
              sellerWoodBefore: 1,
              sellerRoomKcal: 50,
              buyerWoodBefore: 0,
              buyerCarriedKcal: 50,
            },
          ]
        },
        (state) => grouped(state) && state.foragers.some((forager) => forager.groupId === null),
      ),
    ).toMatch('crossed groups')
    expect(
      breaking(5, (state) => {
        const [first, second] = state.lastEvents as [(typeof state.lastEvents)[0], (typeof state.lastEvents)[0]]
        first.position = { ...second.from }
        first.groupId = null
      }),
    ).toMatch('without a group beside another forager')
  })
})
