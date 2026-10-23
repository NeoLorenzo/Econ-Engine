import { describe, expect, it } from 'vitest'
import { deriveWater, waterViolations } from './water'
import { fishCapacity, fishGrowth } from './fish'
describe('terrain water and fish', () => {
  it('fills a bowl to its spill, with acyclic drainage and unique water area', () => {
    const heights = Int32Array.from([
      10, 10, 10, 10, 10, 10, 2, 2, 2, 10, 10, 2, 0, 2, 5, 10, 2, 2, 2, 10, 10, 10, 10, 10, 10,
    ])
    const grid = deriveWater(5, 500, heights, 100_000, 50)
    expect(waterViolations(grid)).toEqual([])
    expect(grid.bodies).toHaveLength(1)
    expect(grid.bodies[0]).toMatchObject({ id: 6, kind: 'lake', areaM2: 225, maxDepthCm: 5 })
    expect(grid.level[12]).toBe(5)
    expect(deriveWater(5, 500, heights, 100_000, 50)).toEqual(grid)
    const corrupt = { ...grid, parent: grid.parent.slice() }
    corrupt.parent[12] = 12
    expect(waterViolations(corrupt)).toContain('Invalid downstream edge 12')
  })

  it('keeps slopes and flats dry below the threshold and partitions a confluence without overlap', () => {
    const flat = new Int32Array(25)
    expect(deriveWater(5, 500, flat, 100_000, 50).bodies).toEqual([])
    const slope = Int32Array.from({ length: 25 }, (_, id) => Math.floor(id / 5) * 100)
    const grid = deriveWater(5, 500, slope, 50, 50)
    expect(waterViolations(grid)).toEqual([])
    expect(grid.bodies.length).toBeGreaterThan(0)
    expect(grid.bodies.every((body) => body.kind === 'river')).toBe(true)
    expect(grid.bodies.reduce((area, body) => area + body.areaM2, 0)).toBe(
      grid.body.filter((id) => id >= 0).length * 25,
    )
  })

  it('uses exact fish growth even when the multiplication exceeds safe number arithmetic', () => {
    const capacity = fishCapacity(1_000_000, 1_000, 100, 600)
    const half = capacity / 2
    const result = fishGrowth(capacity, half, 0, 40)
    const unit = BigInt(capacity) * 876_000n
    const owed = 40n * BigInt(half) ** 2n
    expect(result).toEqual({ grown: Number(owed / unit), remainder: Number(owed % unit) })
    expect(fishGrowth(0, 0, 0, 40)).toEqual({ grown: 0, remainder: 0 })
    expect(fishGrowth(capacity, 0, 0, 40)).toEqual({ grown: 0, remainder: 0 })
    expect(fishCapacity(975, 1_000, 100, 600)).toBe(0)
  })
})
