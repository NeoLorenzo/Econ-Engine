import { describe, expect, it } from 'vitest'
import { cloneValley, createValley, stepValley } from '../valley/engine'
import { meet, placeCount } from '../valley/social'
import type { ValleyState } from '../valley/types'
import {
  CAMERA_LIMITS,
  advanceClock,
  campfireAt,
  clearView,
  contributionNote,
  daysOfFoodLeft,
  groupContributions,
  hearthAt,
  pinPlacement,
  clampDistance,
  closeTilt,
  describeActivity,
  displayedLoad,
  fillInTurn,
  foragerPose,
  foragerSummary,
  groupFrame,
  groupInspection,
  groupName,
  knowledgeShades,
  plantInspection,
  siteRings,
  towardFire,
  treeShape,
  type DisplayPair,
} from './valleyViewModel'

/** The canonical valley at ten in the morning, with forager 0 hungry three metres from a bush that alone holds food. */
function pairBesideBush(): DisplayPair {
  const state: ValleyState = cloneValley(createValley())
  state.minute = 600
  const forager = state.foragers[0]!
  forager.x = state.layout.bushes.x[0]! - 300
  forager.y = state.layout.bushes.y[0]!
  forager.energyKcal = 63_000
  forager.hungry = true
  state.bushKcal.fill(0)
  state.bushKcal[0] = 400
  return { previous: state, next: stepValley(state), alpha: 0 }
}

describe('drawing between two minutes', () => {
  it('walks the walking seconds along a straight line, then picks', () => {
    const pair = pairBesideBush()
    const start = foragerPose({ ...pair, alpha: 0 }, 0)
    expect(start).toMatchObject({ x: pair.previous.foragers[0]!.x, gesture: 'walk' })
    // Two seconds of walking out of sixty: halfway through them at one-sixtieth of the minute.
    const halfway = foragerPose({ ...pair, alpha: 1 / 60 }, 0)
    expect(halfway.gesture).toBe('walk')
    expect(halfway.x).toBeCloseTo((pair.previous.foragers[0]!.x + pair.next.foragers[0]!.x) / 2, 5)
    const working = foragerPose({ ...pair, alpha: 0.5 }, 0)
    expect(working).toMatchObject({ x: pair.next.foragers[0]!.x, y: pair.next.foragers[0]!.y, gesture: 'pick' })
    expect(describeActivity(pair, 0)).toBe('Picking berries from a bush in thicket 1')
  })

  it('lays a sleeper down and draws only whole minutes at the fastest speed', () => {
    const state = cloneValley(createValley())
    state.minute = 1_200
    const pair = { previous: state, next: stepValley(state), alpha: 0.5 }
    expect(foragerPose(pair, 0)).toMatchObject({ gesture: 'sleep', lying: 1 })
    expect(foragerPose(pair, 0, false).x).toBe(pair.next.foragers[0]!.x)
  })

  it('puts the wood of the trip on the forager’s back and the rest by its hearth', () => {
    const pair = pairBesideBush()
    for (const state of [pair.previous, pair.next]) {
      state.foragers[0]!.wood = 30
      state.foragers[0]!.tripWood = 12
    }
    expect(displayedLoad(pair, 0)).toMatchObject({ onBack: 12, atHearth: 18 })
  })

  it('advances whole minutes and keeps the remainder, never more than a quarter second at once', () => {
    expect(advanceClock(0.5, 1, 1)).toEqual({ steps: 0, alpha: 0.75 })
    expect(advanceClock(0, 0.1, 60)).toEqual({ steps: 6, alpha: expect.closeTo(0, 9) })
  })
})

describe('plants and the camera', () => {
  it('shares a bush’s berries out one by one, the last emptying first', () => {
    expect(fillInTurn(400, 400, 10)).toEqual(Array.from({ length: 10 }, () => 1))
    expect(fillInTurn(100, 400, 4)).toEqual([1, 0, 0, 0])
    expect(fillInTurn(0, 400, 3)).toEqual([0, 0, 0])
  })

  it('compares a plant’s true stock with what the followed forager remembers, or says it has never seen it', () => {
    const known = cloneValley(createValley())
    known.minute = 30
    known.foragers[0]!.bushMemory.stock[7] = 400
    known.foragers[0]!.bushMemory.seen[7] = 5
    known.bushKcal[7] = 120
    expect(plantInspection(known, 'bush', 7, 0)).toMatchObject({
      stock: 120,
      remembered: 400,
      difference: -280,
      seen: '24 min ago',
    })
    const state = cloneValley(createValley())
    expect(plantInspection(state, 'bush', 7, 0)).toMatchObject({ remembered: null, seen: 'never' })
  })

  it('keeps the camera between a person and the whole valley, tilting towards eye level close in', () => {
    expect(clampDistance(1)).toBe(CAMERA_LIMITS.nearest)
    expect(clampDistance(10_000)).toBe(CAMERA_LIMITS.farthest)
    expect(closeTilt(CAMERA_LIMITS.nearest)).toBeCloseTo(0.6)
    expect(closeTilt(60)).toBe(0)
    expect(closeTilt(15)).toBeGreaterThan(0)
  })
})

describe('days of food left', () => {
  it('divides the reserve by what it lost a day over the last days, and says nothing while it holds steady', () => {
    const state = cloneValley(createValley())
    expect(daysOfFoodLeft(state, 0)).toBeNull()
    const end = (kcal: number) => ({ endEnergyKcal: state.foragers.map(() => kcal) }) as ValleyState['days'][number]
    state.days = [end(66_000), end(64_000), end(62_000)]
    state.foragers[0]!.energyKcal = 62_000
    expect(daysOfFoodLeft(state, 0)).toBeCloseTo(31, 10)
    state.days = [end(60_000), end(62_000)]
    expect(daysOfFoodLeft(state, 0)).toBeNull()
  })
})

describe('trees and huts', () => {
  it('draws a standing tree upright over its dead branches, and a felled one lying, shorter for each log cut', () => {
    const state = cloneValley(createValley())
    const standing = treeShape({ previous: state, next: state, alpha: 1 }, 0)
    expect(standing).toMatchObject({ felled: false, trunk: 1, crown: 1, deadwood: 1 })
    state.woodStock[0] = 5
    expect(treeShape({ previous: state, next: state, alpha: 1 }, 0).deadwood).toBeCloseTo(5 / 25, 10)
    state.treeFelledMinute[0] = 0
    state.treeLogs[0] = 1
    state.woodStock[0] = 15
    const felled = treeShape({ previous: state, next: state, alpha: 1 }, 0)
    expect(felled.felled).toBe(true)
    expect(felled.trunk).toBeCloseTo(1 / 3, 10)
    expect(felled.crown).toBeCloseTo(15 / 35, 10)
    expect(felled.deadwood).toBe(0)
  })

  it('turns a member’s hut, and the member asleep in it, towards its group’s fire', () => {
    const state = cloneValley(createValley({ scattered: false }))
    const hearth = state.foragers[3]!.hearth
    // Slot 3 lies due east of the flag, so the fire is due west.
    const toward = towardFire(state, 3, hearth.x, hearth.y)!
    expect(toward.x).toBeCloseTo(-1, 10)
    expect(toward.z).toBeCloseTo(0, 10)
    expect(towardFire(cloneValley(createValley()), 0, 100, 100)).toBeNull()
  })
})

describe('groups and what a forager knows', () => {
  /** Foragers 0 and 1 meet at ten in the morning and found Group A. */
  function founded(overrides = {}) {
    const state = cloneValley(createValley(overrides))
    state.minute = 601
    const [first, second] = state.foragers as [ValleyState['foragers'][0], ValleyState['foragers'][0]]
    second.x = first.x + 500
    second.y = first.y
    meet(state, first, 600)
    return state
  }

  it('names groups by letter in order of founding', () => {
    expect(groupName(0)).toBe('Group A')
    expect(groupName(25)).toBe('Group Z')
    expect(groupName(26)).toBe('Group A2')
  })

  it('shows a forager’s group, its fellows and when it joined, and its group with what each member is doing', () => {
    const state = founded()
    expect(foragerSummary(state, 0)).toMatchObject({ groupId: 0, fellows: ['Forager 2'], joinedMinutesAgo: 0 })
    expect(foragerSummary(state, 2)).toMatchObject({ groupId: null, fellows: [], joinedMinutesAgo: null })
    state.foragers[1]!.tripWood = 12
    state.foragers[1]!.wood = 20
    const pair = { previous: state, next: stepValley(state), alpha: 0.5 }
    const group = groupInspection(pair, 0)
    expect(group).toMatchObject({ name: 'Group A', dissolved: false, joinedEver: 2, swapsLastDay: 0 })
    expect(group.members.map((member) => member.name)).toEqual(['Forager 1', 'Forager 2'])
    expect(group.members[1]!.loadKg).toBe(12)
    expect(group.members[0]!.activity).toBe(describeActivity(pair, 0))
    const frame = groupFrame(pair.next, 0)
    const flag = pair.next.groups[0]!.flag
    for (const id of [0, 1]) {
      const member = pair.next.foragers[id]!
      expect(Math.hypot(member.x - frame.x, member.y - frame.y)).toBeLessThanOrEqual(frame.radiusCm)
    }
    expect(Math.hypot(flag.x - frame.x, flag.y - frame.y)).toBeLessThanOrEqual(frame.radiusCm)
  })

  it('shows what a forager carries and how fast it walks, and the sites it knows', () => {
    const state = founded()
    const forager = state.foragers[0]!
    forager.tripWood = 30
    forager.wood = 30
    expect(foragerSummary(state, 0)).toMatchObject({ loadKg: 30, speedKmh: 4.32, sitesKnown: 0 })
    forager.siteKnown[3] = 1
    forager.siteKnown[35] = 1
    forager.siteChecked[3] = 590
    expect(foragerSummary(state, 0)).toMatchObject({ sitesKnown: 2, sitesCheckedLately: 1, sitesTotal: 48 })
    expect(siteRings(state, 0).map((ring) => [ring.site, ring.fresh])).toEqual([
      [3, true],
      [35, false],
    ])
  })

  it('shades ground never seen dark and ground seen at any time clear', () => {
    const checking = founded()
    checking.minute = 2_001
    checking.foragers[0]!.placeSeen.fill(-1)
    checking.foragers[0]!.placeSeen[1] = 2_000 - 24 * 60
    const known = knowledgeShades(checking, 0)
    expect(known).toHaveLength(placeCount(checking.config))
    expect([known[0], known[1]]).toEqual([150, 0])
  })

  it('describes exploring and looking for company', () => {
    const pair = pairBesideBush()
    const event = pair.next.lastEvents.find((made) => made.foragerId === 0)!
    for (const [reason, action, text] of [
      ['exploring', 'walk', 'Exploring ground it has never seen'],
      ['seeking company', 'walk', 'Looking for company'],
      ['waiting for company', 'rest', 'Waiting for company at a flag'],
    ] as const) {
      Object.assign(event, { reason, action, workSeconds: 0, workedFor: null })
      expect(describeActivity(pair, 0)).toBe(text)
    }
  })

  it('describes checking, searching a site and taking a load home', () => {
    const pair = pairBesideBush()
    const event = pair.next.lastEvents.find((made) => made.foragerId === 0)!
    for (const [change, text] of [
      [{ reason: 'checking', action: 'walk', siteId: 3 }, 'Walking to thicket 4 to see what it holds'],
      [{ reason: 'checking', action: 'rest', siteId: 33 }, 'Looking over stand 2'],
      [{ reason: 'searching', action: 'walk', siteId: 34, workedFor: 'wood' }, 'Searching stand 3 for firewood'],
      [{ reason: 'searching', action: 'walk', siteId: null, workedFor: 'food' }, 'Searching new ground for berries'],
      [{ reason: 'taking a load home', action: 'walk', loadWood: 30 }, 'Taking 30 kg of firewood home'],
    ] as const) {
      Object.assign(event, { workSeconds: 0, workedFor: null, ...change })
      expect(describeActivity(pair, 0)).toBe(text)
    }
  })
})

describe('a group’s fire and what each member gives', () => {
  /** The band as one group around the camp at minute `minute`, with `fireWood` in its fire and member 0 holding 30. */
  function together(minute: number, fireWood: number) {
    const state = cloneValley(createValley({ scattered: false }))
    state.minute = minute
    state.groups[0]!.fireWood = fireWood
    state.groups[0]!.given = state.groups[0]!.given.map((given, slot) => (slot === 1 ? fireWood : given))
    state.foragers[1]!.fireGiven = fireWood
    state.foragers[0]!.wood = 30
    return { previous: state, next: stepValley(state), alpha: 0.5 }
  }

  it('draws the fire burning at night, banked by day while it holds wood, and out otherwise', () => {
    expect(campfireAt(together(20 * 60, 12), 0)).toMatchObject({ look: 'burning' })
    expect(campfireAt(together(600, 12), 0)).toMatchObject({ look: 'banked' })
    const out = together(600, 0)
    out.next.groups[0]!.fireWood = 0
    expect(campfireAt(out, 0)).toMatchObject({ look: 'out' })
    expect(campfireAt(together(20 * 60 + 1, 0), 0)?.look).toBe('out')
  })

  it('lights no member’s own hearth while it sleeps by its group’s fire', () => {
    const pair = together(20 * 60, 12)
    expect(hearthAt(pair, 3)).toBeNull()
    expect(describeActivity(pair, 3)).toBe('Sleeping warm by its group’s fire')
    expect(describeActivity(together(20 * 60 + 1, 0), 3)).toBe('Sleeping cold: its group’s fire is out')
  })

  it('lists what each member has given the fire, its share, and says who gave most', () => {
    const pair = together(20 * 60 + 1, 3)
    const rows = groupContributions(pair.next, 0)
    expect(rows).toHaveLength(8)
    expect(rows[0]).toMatchObject({ name: 'Forager 1', given: 6, givenToday: 6, member: true })
    expect(rows[1]).toMatchObject({ given: 3 })
    expect(rows[0]!.share).toBeCloseTo(2 / 3, 10)
    expect(contributionNote(rows)).toBe(
      'Forager 1 has given the most, 67% of its wood (5.3 times an even share). Forager 3, Forager 4, Forager 5, Forager 6, Forager 7, Forager 8 have given nothing.',
    )
    expect(groupInspection(pair, 0).fire).toMatchObject({ wood: 9, lit: false, burnPerHour: 1 })
  })
})

describe('pins over a selected group', () => {
  const view = { width: 1000, height: 800 }
  const clear = { left: 300, top: 24, right: 700, bottom: 776 }

  it('leaves the clear part of the view between tall cards at the sides, and short or wide ones above and below', () => {
    const cards = [
      { left: 16, top: 60, right: 356, bottom: 760 },
      { left: 648, top: 72, right: 1008, bottom: 680 },
      { left: 608, top: 693, right: 1008, bottom: 752 },
    ]
    expect(clearView(1024, 768, cards)).toEqual({ left: 380, top: 24, right: 624, bottom: 669 })
    // A phone: one card across the top, one across the bottom.
    // A phone: one card across the top and one across the bottom leave too little between them, so the middle third
    // of the view's height is kept.
    const phone = [
      { left: 16, top: 68, right: 359, bottom: 474 },
      { left: 16, top: 520, right: 359, bottom: 796 },
    ]
    expect(clearView(375, 812, phone)).toEqual({ left: 24, top: 812 / 3 + 24, right: 351, bottom: (2 * 812) / 3 - 24 })
  })

  it('puts a pin where its member is while it is in the clear part, and holds it at the edge towards it otherwise', () => {
    expect(pinPlacement(500, 400, false, clear, view)).toEqual({ x: 500, y: 400, edge: false, angle: 0 })
    const right = pinPlacement(900, 400, false, clear, view)
    expect(right).toMatchObject({ x: 700, y: 400, edge: true, angle: 0 })
    const below = pinPlacement(500, 1_200, false, clear, view)
    expect(below).toMatchObject({ x: 500, y: 776, edge: true })
    expect(below.angle).toBeCloseTo(Math.PI / 2, 10)
    // Behind the camera, a point projected to the right lies to the left.
    expect(pinPlacement(900, 400, true, clear, view)).toMatchObject({ x: 300, edge: true })
  })
})
