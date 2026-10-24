import { describe, expect, it } from 'vitest'
import { createSurveyedValley, addTestLake } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { GROUND_AREA, LAKE_AREA, meshViolations, planeHeight } from './mesh'
import { meshSettings } from './routes'

describe('the ground mesh', () => {
  it('covers flat land with 40 m triangles and passes its checks', () => {
    const state = createSurveyedValley(FLAT_LAND)
    const { mesh } = state.layout.nav
    expect(mesh.vertices).toBe(21 ** 2)
    expect(mesh.triangles).toBe(2 * 20 ** 2)
    expect(meshViolations(mesh, state.layout.terrain, meshSettings(state.config))).toEqual([])
  })
  it('lays a lake flat at its level, walled by shore edges with water on their wet side', () => {
    const state = createSurveyedValley(FLAT_LAND)
    addTestLake(state)
    const { mesh } = state.layout.nav
    const water = state.layout.terrain.water
    expect(meshViolations(mesh, state.layout.terrain, meshSettings(state.config))).toEqual([])
    let lake = 0
    for (let t = 0; t < mesh.triangles; t++) {
      if (mesh.area[t] !== LAKE_AREA) continue
      lake++
      const level = water.bodies[mesh.body[t]!]!.kind === 'lake' ? mesh.vh[mesh.tv[3 * t]!] : -1
      for (let e = 0; e < 3; e++) expect(mesh.vh[mesh.tv[3 * t + e]!]).toBe(level)
      for (let e = 0; e < 3; e++) {
        const n = mesh.tn[3 * t + e]!
        if (n >= 0 && mesh.area[n] === GROUND_AREA) expect(mesh.shore[3 * t + e]).toBe(1)
      }
    }
    expect(lake).toBeGreaterThan(0)
  })
  it('meets its vertices exactly and is linear within a triangle', () => {
    const state = createSurveyedValley()
    const { mesh } = state.layout.nav
    for (let t = 0; t < mesh.triangles; t += 997) {
      const [a, b] = [mesh.tv[3 * t]!, mesh.tv[3 * t + 1]!]
      expect(planeHeight(mesh, t, mesh.vx[a]!, mesh.vy[a]!)).toBe(mesh.vh[a])
      if ((mesh.vx[a]! + mesh.vx[b]!) % 2 || (mesh.vy[a]! + mesh.vy[b]!) % 2) continue
      const mid = planeHeight(mesh, t, (mesh.vx[a]! + mesh.vx[b]!) / 2, (mesh.vy[a]! + mesh.vy[b]!) / 2)
      expect(Math.abs(mid - (mesh.vh[a]! + mesh.vh[b]!) / 2)).toBeLessThanOrEqual(1)
    }
  })
})
