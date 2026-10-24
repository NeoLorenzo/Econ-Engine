import { describe, expect, it, vi } from 'vitest'
import { createSurveyedValley, addTestLake } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { buildBanks } from './banks'
import * as bankGeometry from './banks'
import { GROUND_AREA } from './mesh'
import {
  buildNav,
  knownRoute,
  NEAR_CM,
  positionAlong,
  segmentKcal,
  segmentMinutes,
  triangleDistanceSq,
  type Knowledge,
} from './routes'
import { deriveWater } from './water'
import type { ValleyState } from './types'

function fixture(water = false) {
  const state = createSurveyedValley(FLAT_LAND)
  if (water) addTestLake(state)
  const knowledge = state.foragers[0]!.knowledge
  const route = (from: { x: number; y: number }, to: { x: number; y: number }) =>
    knownRoute(state.layout.nav, knowledge, state.config, 0, from, to)
  return { state, knowledge, route }
}

/** Forgets every triangle whose centroid passes `test`. */
function forget(state: ValleyState, knowledge: Knowledge, test: (x: number, y: number) => boolean) {
  const { mesh } = state.layout.nav
  for (let t = 0; t < mesh.triangles; t++)
    if (test(mesh.cx[t]!, mesh.cy[t]!)) knowledge.triangles[t >> 3]! &= ~(1 << (t & 7))
  knowledge.revision += 1
}

describe('known routes over the ground mesh', () => {
  it('reuses bank points without shoreline tests during route searches', () => {
    const { route } = fixture(true)
    const from = { x: 250, y: 750 },
      to = { x: 23_000, y: 750 }
    expect(route(from, to)).not.toBeNull()
    const spy = vi.spyOn(bankGeometry, 'bankSegmentWet')
    try {
      expect(route(from, to)).not.toBeNull()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
  it('bends round a known lake without entering water', () => {
    const { state, route } = fixture(true)
    const { mesh } = state.layout.nav
    const path = route({ x: 250, y: 750 }, { x: 23_000, y: 750 })!
    expect(path).not.toBeNull()
    expect(path.segments.length).toBeGreaterThan(1)
    for (const s of path.segments) {
      expect(mesh.area[s.triangle]).toBe(GROUND_AREA)
      // The path may run along the shore, never inside the lake's cells.
      const mid = { x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2 }
      expect(mid.x > 501 && mid.x < 20_499 && mid.y > 501 && mid.y < 999).toBe(false)
    }
  })
  it('bends round a 5 m pond only by about its width', () => {
    const state = createSurveyedValley(FLAT_LAND)
    const terrain = state.layout.terrain
    const bed = new Int32Array(terrain.cells ** 2)
    bed[40 * terrain.cells + 40] = -100
    const water = deriveWater(
      terrain.cells,
      terrain.cellCm,
      bed,
      state.config.riverCatchmentM2,
      state.config.riverDepthCm,
    )
    water.shore = buildBanks(water, terrain.height)
    const wet = { ...terrain, water }
    state.layout = { ...state.layout, terrain: wet, nav: buildNav(state.config, wet, state.layout.ground) }
    const path = knownRoute(
      state.layout.nav,
      state.foragers[0]!.knowledge,
      state.config,
      0,
      {
        x: 10_000,
        y: 20_250,
      },
      { x: 30_000, y: 20_250 },
    )!
    const length = path.segments.reduce((sum, s) => sum + s.lengthCm, 0)
    expect(length).toBeGreaterThan(20_000)
    expect(length).toBeLessThan(20_000 + 600)
  })
  it('does not use unseen ground', () => {
    const { state, route, knowledge } = fixture()
    forget(state, knowledge, () => true)
    expect(route({ x: 1_000, y: 1_000 }, { x: 21_000, y: 1_000 })).toBeNull()
    knowledge.triangles.fill(255)
    knowledge.revision += 1
    expect(route({ x: 1_000, y: 1_000 }, { x: 21_000, y: 1_000 })).not.toBeNull()
  })
  it('takes a shorter crossing only after seeing it', () => {
    const { state, route, knowledge } = fixture()
    forget(state, knowledge, (x, y) => x > 9_000 && x < 11_000 && y > 12_000 && y < 70_000)
    const before = route({ x: 1_000, y: 30_000 }, { x: 21_000, y: 30_000 })!
    knowledge.triangles.fill(255)
    knowledge.revision += 1
    const after = route({ x: 1_000, y: 30_000 }, { x: 21_000, y: 30_000 })!
    expect(after.minutes).toBeLessThan(before.minutes)
  })
  it('cuts a walk into joined pieces, each inside its own triangle', () => {
    const { state, route } = fixture(true)
    const { mesh } = state.layout.nav
    const path = route({ x: 250, y: 750 }, { x: 61_000, y: 41_000 })!
    for (const [i, s] of path.segments.entries()) {
      expect(triangleDistanceSq(mesh, s.triangle, s.x0, s.y0)).toBeLessThanOrEqual(NEAR_CM ** 2)
      expect(triangleDistanceSq(mesh, s.triangle, s.x1, s.y1)).toBeLessThanOrEqual(NEAR_CM ** 2)
      if (i > 0) expect([s.x0, s.y0]).toEqual([path.segments[i - 1]!.x1, path.segments[i - 1]!.y1])
    }
  })
  it('times segments and costs walking by slope class', () => {
    const { state } = fixture()
    const c = state.config
    expect(segmentMinutes(c, 12_500, 0, false, 0, 125)).toBe(2)
    expect(segmentMinutes(c, 12_500, 1, true, 0, 125)).toBe(3)
    expect(segmentMinutes(c, 12_500, 2, true, 0, 125)).toBe(4)
    expect(segmentKcal(c, 60, 1, true)).toBe(375)
    expect(segmentKcal(c, 60, 2, false)).toBe(250)
  })
  it('keeps the configured pace across many triangles', () => {
    const { route } = fixture()
    const path = route({ x: 1_000, y: 1_000 }, { x: 61_000, y: 1_000 })!
    expect(path.minutes).toBe(10)
  })
  it('places a walker on its polyline with exact endpoints', () => {
    const { route } = fixture(true)
    const path = route({ x: 250, y: 750 }, { x: 23_000, y: 750 })!
    expect(positionAlong(path, 0)).toEqual({ x: 250, y: 750 })
    expect(positionAlong(path, path.minutes)).toEqual({ x: 23_000, y: 750 })
    for (let m = 0; m < path.minutes; m += 0.1) {
      const point = positionAlong(path, m)
      const distance = Math.min(
        ...path.segments.map((s) => {
          const dx = s.x1 - s.x0,
            dy = s.y1 - s.y0
          const t = Math.max(0, Math.min(1, ((point.x - s.x0) * dx + (point.y - s.y0) * dy) / (dx * dx + dy * dy)))
          return Math.hypot(point.x - s.x0 - t * dx, point.y - s.y0 - t * dy)
        }),
      )
      expect(distance).toBeLessThanOrEqual(1)
    }
  })
})

it('keeps forward and return paths exact after unrelated searches and load changes', () => {
  const s = createSurveyedValley(FLAT_LAND),
    nav = s.layout.nav,
    p = s.foragers[0]!,
    a = { x: 1000, y: 1000 },
    b = { x: 61000, y: 21000 }
  const run = (load: number, reverse: boolean) =>
    knownRoute(nav, p.knowledge, s.config, load, reverse ? b : a, reverse ? a : b)
  for (const load of [0, 30, 0])
    for (const reverse of [false, true]) {
      const first = run(load, reverse)
      run(load, !reverse)
      expect(run(load, reverse)).toEqual(first)
    }
})
