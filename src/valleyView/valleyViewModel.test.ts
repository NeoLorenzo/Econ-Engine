import { createSurveyedValley as createValley } from '../valley/ruleFixtures'
import { FLAT_LAND } from '../valley/config'
import { describe, expect, it } from 'vitest'
import { cloneValley, stepValley } from '../valley/engine'
import { meet } from '../valley/social'
import type { ValleyState } from '../valley/types'
import {
  BUSHES_PER_THICKET,
  CAMERA_LIMITS,
  campfireAt,
  clampDistance,
  clearView,
  closeTilt,
  contributionNote,
  daysOfFoodLeft,
  decorOf,
  describeActivity,
  foragerSummary,
  groupContributions,
  groupFrame,
  groupInspection,
  groupName,
  knowledgeShades,
  pinPlacement,
  plantFill,
  plantInspection,
  siteRings,
  startDisplay,
  taskSummary,
  towardFire,
} from './valleyViewModel'

describe('plants drawn from place stocks', () => {
  it('shares a thicket’s berries out among its bushes, the last emptying first', () => {
    const state = cloneValley(createValley(FLAT_LAND))
    const { bushes } = decorOf(state)
    const first = Array.from({ length: bushes.count }, (_, id) => id).filter((id) => bushes.site[id] === 0)
    expect(first).toHaveLength(BUSHES_PER_THICKET)
    const capacity = state.foodStock[0]!
    state.foodStock[0] = Math.round(capacity / 4)
    const fills = first.map((id) => plantFill(startDisplay(state), 'bush', id)).sort((a, b) => b - a)
    expect(fills.slice(0, 3).every((fill) => fill === 1)).toBe(true)
    expect(fills.at(-1)).toBe(0)
    expect(fills.reduce((total, fill) => total + fill, 0)).toBeCloseTo(BUSHES_PER_THICKET / 4, 1)
  })

  it('compares a place’s true stock with what the followed forager remembers, or says it has never seen it', () => {
    const state = cloneValley(createValley(FLAT_LAND))
    expect(plantInspection(state, 'bush', 7, 0)).toMatchObject({ remembered: null, seen: 'never' })
  })
})

describe('the camera', () => {
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
    const state = cloneValley(createValley(FLAT_LAND))
    expect(daysOfFoodLeft(state, 0)).toBeNull()
    const end = (kcal: number) => ({ endEnergyKcal: state.foragers.map(() => kcal) }) as ValleyState['days'][number]
    state.days = [end(66_000), end(64_000), end(62_000)]
    state.foragers[0]!.energyKcal = 62_000
    expect(daysOfFoodLeft(state, 0)).toBeCloseTo(31, 10)
    state.days = [end(60_000), end(62_000)]
    expect(daysOfFoodLeft(state, 0)).toBeNull()
  })
})

describe('what a person is doing', () => {
  it('describes the task under way and when its holder next wakes', () => {
    const state = stepValley(createValley(FLAT_LAND), 1)
    const task = state.foragers[0]!.task!
    Object.assign(task, { kind: 'gather', reason: 'foraging', placeId: 3 })
    expect(describeActivity(startDisplay(state), 0)).toBe('Picking berries at thicket 4')
    Object.assign(task, { kind: 'walk', reason: 'exploring' })
    expect(describeActivity(startDisplay(state), 0)).toBe('Exploring ground it has never seen')
    const summary = taskSummary(state, 0)!
    expect(summary).toMatchObject({ kind: 'walk', reason: 'exploring', startMinute: task.startMinute })
    expect(summary.nextWake!.minute).toBeGreaterThanOrEqual(state.minute)
  })
})

describe('groups and what a forager knows', () => {
  /** Foragers 0 and 1 meet at ten in the morning and found Group A. */
  function founded(overrides = {}) {
    const state = cloneValley(createValley({ ...FLAT_LAND, ...overrides }))
    state.minute = 601
    const [first, second] = state.foragers as [ValleyState['foragers'][0], ValleyState['foragers'][0]]
    second.x = first.x + 500
    second.y = first.y
    first.metMinute[second.id] = 600
    first.metPosition.set(second.id, { x: second.x, y: second.y })
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
    expect(foragerSummary(state, 0)).toMatchObject({ groupId: 0, fellows: ['Forager 2'], joinedMinutesAgo: 1 })
    expect(foragerSummary(state, 2)).toMatchObject({ groupId: null, fellows: [], joinedMinutesAgo: null })
    state.foragers[1]!.tripWood = 12
    state.foragers[1]!.wood = 20
    const display = startDisplay(state)
    const group = groupInspection(display, 0)
    expect(group).toMatchObject({ name: 'Group A', dissolved: false, joinedEver: 2, swapsLastDay: 0 })
    expect(group.members.map((member) => member.name)).toEqual(['Forager 1', 'Forager 2'])
    expect(group.members[1]!.loadKg).toBe(12)
    expect(group.members[0]!.activity).toBe(describeActivity(display, 0))
    const frame = groupFrame(state, 0)
    for (const id of [0, 1]) {
      const member = state.foragers[id]!
      expect(Math.hypot(member.x - frame.x, member.y - frame.y)).toBeLessThanOrEqual(frame.radiusCm)
    }
  })

  it('shows the places a forager knows, ringing those it checked lately', () => {
    const state = founded()
    const forager = state.foragers[0]!
    forager.knownPlaces.fill(-1)
    forager.knownPlaces[3] = 0
    forager.knownPlaces[5] = 1
    forager.placeCheckedMinute[3] = 590
    forager.placeCheckedMinute[5] = -1
    expect(foragerSummary(state, 0)).toMatchObject({
      sitesKnown: 2,
      sitesCheckedLately: 1,
      sitesTotal: state.layout.places.count,
    })
    expect(siteRings(state, 0).map((ring) => [ring.site, ring.fresh])).toEqual([
      [3, true],
      [5, false],
    ])
  })

  it('shades ground never seen dark and ground seen at any time clear', () => {
    const state = founded()
    const nodes = state.foragers[0]!.knowledge.nodes
    nodes.fill(0)
    nodes[0] = 1
    const shades = knowledgeShades(state, 0)
    expect(shades).toHaveLength(state.layout.terrain.cells ** 2)
    expect(shades[0]).toBe(0)
    expect(shades.at(-1)).toBe(150)
  })
})

describe('a group’s fire and what each member gives', () => {
  /** The band as one group around the camp at minute `minute`, with `fireWood` in its fire and member 0 holding 30. */
  function together(minute: number, fireWood: number) {
    const state = cloneValley(createValley({ ...FLAT_LAND, scattered: false }))
    state.minute = minute
    state.groups[0]!.fireWood = fireWood
    state.groups[0]!.given = state.groups[0]!.given.map((given, slot) => (slot === 1 ? fireWood : given))
    state.foragers[1]!.fireGiven = fireWood
    state.foragers[0]!.wood = 30
    return startDisplay(state)
  }

  it('turns a member’s hut, and the member asleep in it, towards its group’s fire', () => {
    const state = together(600, 0).state
    const hearth = state.foragers[3]!.hearth
    // Slot 3 lies due east of the flag, so the fire is due west.
    const toward = towardFire(state, 3, hearth.x, hearth.y)!
    expect(toward.x).toBeCloseTo(-1, 10)
    expect(toward.z).toBeCloseTo(0, 10)
    expect(towardFire(cloneValley(createValley(FLAT_LAND)), 0, 100, 100)).toBeNull()
  })

  it('draws the fire banked by day while it holds wood, and out otherwise', () => {
    expect(campfireAt(together(600, 12), 0)).toMatchObject({ look: 'banked' })
    expect(campfireAt(together(600, 0), 0)).toMatchObject({ look: 'out' })
  })

  it('lists what each member has given the fire, its share, and says who gave most', () => {
    const display = together(20 * 60 + 1, 3)
    const rows = groupContributions(display.state, 0)
    expect(rows).toHaveLength(display.state.foragers.length)
    expect(rows[1]).toMatchObject({ given: 3, member: true })
    expect(contributionNote(rows)).toContain('Forager 2 has given the most')
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
