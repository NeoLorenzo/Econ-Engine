import { describe, expect, it } from 'vitest'
import { createSurveyedValley } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { coarseBand, corridorRoute, planCorridor, routeTriangle, trianglePoint, type Knowledge } from './routes'
import { findWalk, rememberWalk } from './ways'
import { observeAt } from './perception'
import { stepValley } from './engine'
import { ValleyChecker } from './invariants'
import type { Forager, Point, ValleyState } from './types'

function fixture() {
  const state = createSurveyedValley(FLAT_LAND)
  const person = state.foragers[0]!
  const walk = (to: Point, habitual = true) => findWalk(state, person, to, habitual, 0)!
  const go = (to: Point, habitual = true) => {
    const found = walk(to, habitual)
    rememberWalk(state, person, found, state.minute)
    return found
  }
  return { state, person, walk, go }
}
const place = (person: Forager, p: Point) => Object.assign(person, { x: p.x, y: p.y })
/** Forgets every triangle whose centroid passes `test`. */
function forget(state: ValleyState, knowledge: Knowledge, test: (x: number, y: number) => boolean) {
  const { mesh } = state.layout.nav
  for (let t = 0; t < mesh.triangles; t++)
    if (test(mesh.cx[t]!, mesh.cy[t]!)) knowledge.triangles[t >> 3]! &= ~(1 << (t & 7))
  knowledge.revision += 1
  knowledge.fullyKnown = undefined
  knowledge.banksKnown = undefined
}
const home = { x: 1_000, y: 30_000 },
  thicket = { x: 61_000, y: 30_000 }

describe('remembered ways', () => {
  it('walks a remembered way again, and back the other way', () => {
    const { person, go } = fixture()
    place(person, home)
    const first = go(thicket)
    expect(first.plan).toBe('coarse')
    expect(person.ways).toHaveLength(1)
    const again = go(thicket)
    expect(again.plan).toBe('way')
    expect(again.corridor).toEqual(first.corridor)
    place(person, thicket)
    const back = go(home)
    expect(back.plan).toBe('way')
    expect(back.corridor).toEqual([...first.corridor!].reverse())
    expect(person.ways).toHaveLength(1)
  })
  it('joins a way part-way, but plans afresh from off it', () => {
    const { state, person, go, walk } = fixture()
    const mesh = state.layout.nav.mesh
    place(person, home)
    const corridor = go(thicket).corridor!
    const middle = corridor[corridor.length >> 1]!
    place(person, trianglePoint(mesh, middle))
    const joined = walk(thicket)
    expect(joined.plan).toBe('joined')
    expect(joined.corridor).toEqual(corridor.slice(corridor.indexOf(middle)))
    const off = [0, 1, 2].map((e) => mesh.tn[3 * middle + e]!).find((t) => t >= 0 && !corridor.includes(t))!
    place(person, trianglePoint(mesh, off))
    expect(['coarse', 'full']).toContain(walk(thicket).plan)
  })
  it('keeps a way until a day has passed and new ground was seen', () => {
    const { state, person, go, walk } = fixture()
    forget(state, person.knowledge, (x, y) => x > 29_000 && x < 31_000 && y > 12_000 && y < 50_000)
    place(person, home)
    const long = go(thicket)
    person.knowledge.triangles.fill(255)
    person.knowledge.revision += 1
    state.minute += 600
    expect(walk(thicket).plan).toBe('way')
    state.minute += 840
    const rechecked = go(thicket)
    expect(rechecked.rechecked).toBe(true)
    expect(rechecked.route.minutes).toBeLessThan(long.route.minutes)
    expect(person.ways).toHaveLength(1)
    state.minute += 2_000
    expect(walk(thicket).plan).toBe('way')
  })
  it('forgets the way used longest ago, and replaces a way between the same ends', () => {
    const { state, person, go } = fixture()
    state.config = { ...state.config, waysRemembered: 2 }
    place(person, home)
    const targets = [thicket, { x: 61_000, y: 60_000 }, { x: 30_000, y: 70_000 }]
    for (const target of targets) {
      go(target)
      state.minute += 10
    }
    expect(person.ways.map((w) => w.b)).toEqual(targets.slice(1))
    go(targets[1]!, true)
    place(person, targets[2]!)
    state.minute += 2_000
    person.knowledge.revision += 1
    go(home)
    expect(person.ways).toHaveLength(2)
  })
  it('keeps the same corridor under a load, at a slower pace', () => {
    const { state, person, go } = fixture()
    place(person, home)
    const { corridor } = go(thicket)
    const light = corridorRoute(state.layout.nav, state.config, 0, corridor!, home, thicket),
      heavy = corridorRoute(state.layout.nav, state.config, 25, corridor!, home, thicket)
    expect(heavy.segments.map((s) => s.triangle)).toEqual(light.segments.map((s) => s.triangle))
    expect(heavy.timeUnits).toBeGreaterThan(light.timeUnits)
  })
})

describe('coarse planning', () => {
  it('keeps a coarse plan inside the band of its chunk chain', () => {
    const { state, person } = fixture()
    const nav = state.layout.nav,
      k = person.knowledge
    const first = routeTriangle(nav, k, home),
      last = routeTriangle(nav, k, thicket)
    const band = coarseBand(nav, k, first, last)!
    const plan = planCorridor(nav, k, first, last, home, thicket)!
    expect(plan.plan).toBe('coarse')
    for (const t of plan.corridor) expect(band[nav.mesh.chunk[t]!]).toBe(1)
  })
  it('falls back to a full plan when the band holds no path', () => {
    const { state, person } = fixture()
    // A wall inside the first column of chunks, open only far outside the band of the straight chain.
    forget(state, person.knowledge, (x, y) => x > 9_000 && x < 11_000 && y < 70_000)
    const nav = state.layout.nav,
      k = person.knowledge
    const from = { x: 1_000, y: 10_000 },
      to = { x: 30_000, y: 10_000 }
    const plan = planCorridor(nav, k, routeTriangle(nav, k, from), routeTriangle(nav, k, to), from, to)!
    expect(plan.plan).toBe('full')
  })
  it('links chunks only across ground known on both sides', () => {
    const { state, person } = fixture()
    forget(state, person.knowledge, (x) => x > 14_000 && x < 26_000)
    const nav = state.layout.nav,
      k = person.knowledge
    expect(coarseBand(nav, k, routeTriangle(nav, k, home), routeTriangle(nav, k, thicket))).toBeNull()
  })
})

describe('surveys', () => {
  it('surveys the still landscape again only after moving 100 m', () => {
    const { state, person } = fixture()
    place(person, home)
    expect(observeAt(state, person, 0).surveyed).toBe(true)
    forget(state, person.knowledge, (x, y) => (x - 1_000) ** 2 + (y - 30_000) ** 2 < 20_000 ** 2)
    place(person, { x: 9_000, y: 30_000 })
    const near = observeAt(state, person, 1)
    expect(near.surveyed).toBe(false)
    expect(near.triangles).toEqual([])
    place(person, { x: 11_000, y: 30_000 })
    const far = observeAt(state, person, 2)
    expect(far.surveyed).toBe(true)
    expect(far.triangles.length).toBeGreaterThan(0)
  })
})

describe('the checker on ways', () => {
  const run = (damage: (s: ValleyState) => void) => {
    const base = createSurveyedValley(FLAT_LAND)
    const after = stepValley(base, 600)
    expect(new ValleyChecker(base).check(after)).toEqual([])
    damage(after)
    return new ValleyChecker(base).check(after)
  }
  const someWay = (s: ValleyState) => s.foragers.find((p) => p.ways.length)!
  it('rejects a way through unknown ground', () => {
    const errors = run((s) => {
      const p = someWay(s)
      p.knowledge = { ...p.knowledge, triangles: p.knowledge.triangles.slice() }
      const t = p.ways[0]!.corridor[1]!
      p.knowledge.triangles[t >> 3]! &= ~(1 << (t & 7))
    })
    expect(errors.some((e) => e.includes('crosses unknown or wet ground'))).toBe(true)
  })
  it('rejects a way with a gap, too many ways and a survey against the rule', () => {
    const gap = run((s) => {
      const p = someWay(s),
        w = p.ways[0]!
      p.ways = [{ ...w, corridor: Int32Array.from([w.corridor[0]!, ...w.corridor.subarray(2)]) }]
    })
    expect(gap.some((e) => e.includes('has a gap') || e.includes('does not hold its ends'))).toBe(true)
    const many = run((s) => {
      const p = someWay(s)
      s.config = { ...s.config, waysRemembered: 0 }
      p.ways = [...p.ways]
    })
    expect(many.some((e) => e.includes('too many ways'))).toBe(true)
    const survey = run((s) => {
      const e = s.lastInterval.find((r) => r.kind === 'observe' && r.surveyed)!
      if (e.kind === 'observe') e.surveyed = false
    })
    expect(survey.some((e) => e.includes('survey taken against the rule'))).toBe(true)
  })
})
