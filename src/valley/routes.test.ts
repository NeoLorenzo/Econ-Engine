import { describe, expect, it } from 'vitest'
import { createSurveyedValley, addTestLake } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { bankSegmentWet } from './banks'
import { buildLattice, knownRoute, positionAlong, segmentMinutes, segmentKcal, type Knowledge } from './routes'

describe('known route lattice', () => {
  function fixture(water = false) {
    const state = createSurveyedValley(FLAT_LAND)
    if (water) addTestLake(state)
    const { terrain, ground } = state.layout
    const lattice = buildLattice(state.config, terrain)
    const knowledge: Knowledge = { nodes: new Uint8Array(lattice.dry.length).fill(1), revision: 1 }
    const route = (from: { x: number; y: number }, to: { x: number; y: number }) =>
      knownRoute(lattice, knowledge, terrain, ground, lattice.banks, state.config, 0, from, to)
    return { state, lattice, knowledge, route }
  }
  it('bends around a known lake without crossing water', () => {
    const { lattice, route } = fixture(true)
    const path = route({ x: 250, y: 750 }, { x: 23_000, y: 750 })!
    expect(path).not.toBeNull()
    expect(path.segments.some((s) => s.y0 > 1_000 || s.y1 > 1_000)).toBe(true)
    for (const s of path.segments)
      expect(bankSegmentWet(lattice.banks, { x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 })).toBe(false)
  })
  it('does not use unseen dry nodes', () => {
    const { route, knowledge } = fixture()
    knowledge.nodes.fill(0)
    expect(route({ x: 1_000, y: 1_000 }, { x: 21_000, y: 1_000 })).toBeNull()
    knowledge.nodes.fill(1)
    knowledge.revision += 1
    expect(route({ x: 1_000, y: 1_000 }, { x: 21_000, y: 1_000 })).not.toBeNull()
  })
  it('does not cut diagonally across unseen adjoining ground', () => {
    const { route, knowledge, lattice } = fixture()
    knowledge.nodes.fill(0)
    knowledge.nodes[0] = 1
    knowledge.nodes[lattice.cells + 1] = 1
    expect(route({ x: 1_000, y: 1_000 }, { x: 3_000, y: 3_000 })).toBeNull()
  })
  it('takes a shorter crossing only after observing it', () => {
    const { route, knowledge, lattice } = fixture()
    for (let row = 0; row < lattice.cells - 1; row += 1) knowledge.nodes[row * lattice.cells + 5] = 0
    const before = route({ x: 1_000, y: 1_000 }, { x: 21_000, y: 1_000 })!
    knowledge.nodes[5] = 1
    knowledge.revision += 1
    const after = route({ x: 1_000, y: 1_000 }, { x: 21_000, y: 1_000 })!
    expect(after.minutes).toBeLessThan(before.minutes)
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
  it('preserves configured pace across many lattice edges', () => {
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
