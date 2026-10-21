import { describe, expect, it } from 'vitest'
import { FLAT_LAND, resolveValleyConfig } from '../valley/config'
import { terrainOf } from '../valley/terrain'
import { groundSurface, surfaceHeightAt } from './groundSurface'

describe('the observer ground surface', () => {
  const terrain = terrainOf(resolveValleyConfig({ ...FLAT_LAND, reliefCm: 2_000, microCoarseAmplitudeCm: 400 }))
  const surface = groundSurface(terrain, 40)

  it('uses exact dry mesh heights and recorded wet-cell beds', () => {
    const points = terrain.cells + 1
    for (const j of surface.columns)
      for (const i of surface.columns) {
        const cell = Math.min(j, terrain.cells - 1) * terrain.cells + Math.min(i, terrain.cells - 1)
        const expected = terrain.water.body[cell]! >= 0 ? terrain.water.bed[cell] : terrain.height[j * points + i]
        expect(surfaceHeightAt(surface, i * terrain.cellCm, j * terrain.cellCm)).toBe(expected)
      }
  })

  it('interpolates within the four visible vertices around a point', () => {
    const x = 31_337
    const y = 42_251
    const height = surfaceHeightAt(surface, x, y)
    expect(height).toBeGreaterThanOrEqual(Math.min(...surface.heights))
    expect(height).toBeLessThanOrEqual(Math.max(...surface.heights))
  })
})
