import { describe, expect, it } from 'vitest'
import { FLAT_LAND, resolveValleyConfig } from '../valley/config'
import { heightAt, terrainOf } from '../valley/terrain'
import { drySurfaceHeightAt, groundSurface, surfaceHeightAt } from './groundSurface'

describe('the observer ground surface', () => {
  const terrain = terrainOf(resolveValleyConfig({ ...FLAT_LAND, reliefCm: 2_000, microCoarseAmplitudeCm: 400 }))
  const surface = groundSurface(terrain, 40)

  it('uses exact dry mesh heights and recorded wet-cell beds', () => {
    const points = terrain.cells + 1
    for (const j of surface.columns)
      for (const i of surface.columns) {
        const cell = Math.min(j, terrain.cells - 1) * terrain.cells + Math.min(i, terrain.cells - 1)
        const expected = terrain.water.shore?.patches.has(cell)
          ? heightAt(terrain, i * terrain.cellCm, j * terrain.cellCm)
          : terrain.water.body[cell]! >= 0
            ? terrain.water.bed[cell]
            : terrain.height[j * points + i]
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

  it('keeps a bank lip on the dry lattice even when the boundary belongs to a wet cell', () => {
    const bank = {
      ...surface,
      columns: [0, 1, 2],
      cells: 2,
      along: 3,
      sizeCm: 1000,
      cellCm: 500,
      heights: new Int32Array(9).fill(300),
      water: {
        ...surface.water,
        shore: undefined,
        body: new Int32Array([-1, 0, -1, 0]),
        bed: new Int32Array([300, -200, 300, -200]),
      },
    }
    expect(surfaceHeightAt(bank, 500, 250)).toBe(-200)
    expect(drySurfaceHeightAt(bank, 500, 250)).toBe(300)
    expect(drySurfaceHeightAt(bank, 500, 500)).toBe(300)
  })
})
