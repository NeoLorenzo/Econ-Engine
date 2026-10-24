import { describe, expect, it } from 'vitest'
import { bankViolations, buildBanks, bankCircleWet, bankSegmentWet, bankWaterHeight, triangleHeight } from './banks'
import { deriveWater } from './water'

function bowl() {
  const cells = 5,
    cellCm = 500
  const corners = new Int32Array(36).fill(200)
  corners[2] = 0
  for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) corners[y * 6 + x] = -200
  const centres = new Int32Array(25)
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++)
      centres[y * 5 + x] = Math.floor(
        (corners[y * 6 + x]! + corners[y * 6 + x + 1]! + corners[(y + 1) * 6 + x]! + corners[(y + 1) * 6 + x + 1]!) / 4,
      )
  const water = deriveWater(cells, cellCm, centres, 1000000, 80)
  return { water, corners, shore: buildBanks(water, corners) }
}
describe('continuous water banks', () => {
  it('clips a level lake to sloping ground with diagonal, shared centimetre contours', () => {
    const { water, corners, shore } = bowl()
    expect(buildBanks(water, corners)).toEqual(shore)
    expect(shore.segments.size).toBeGreaterThan(0)
    expect([...shore.segments.values()].some((s) => s.a.x !== s.b.x && s.a.y !== s.b.y)).toBe(true)
    for (const [cell, patch] of shore.patches) {
      const level = water.level[water.bodies[patch.body]!.cells[0]!]!
      for (let i = 2; i < patch.water.length; i += 3) expect(patch.water[i]).toBe(level)
      for (const segment of patch.segments) {
        expect(triangleHeight(patch.ground, segment.a.x, segment.a.y)).toBe(segment.a.h)
        expect(segment.a.h).toBe(segment.a.level)
        expect(Number.isInteger(segment.a.x) && Number.isInteger(segment.a.y)).toBe(true)
        expect(segment.id).toBeGreaterThanOrEqual(cell * 8)
      }
    }
  })
  it('uses the same water for point, segment and footprint collision', () => {
    const { shore } = bowl()
    expect(bankWaterHeight(shore, { x: 1250, y: 1250 })).not.toBeNull()
    expect(bankSegmentWet(shore, { x: 0, y: 1250 }, { x: 2500, y: 1250 })).toBe(true)
    expect(bankSegmentWet(shore, { x: 10, y: 10 }, { x: 2490, y: 10 })).toBe(false)
    expect(bankCircleWet(shore, { x: 1250, y: 1250 }, 1)).toBe(true)
    expect(bankCircleWet(shore, { x: 10, y: 10 }, 1)).toBe(false)
  })
  it('checks polygon areas and rejects broken contour records', () => {
    const { water, shore } = bowl()
    for (let body = 0; body < water.bodies.length; body++)
      water.bodies[body]!.areaM2 = Math.floor(shore.area2[body]! / 20000)
    expect(bankViolations(shore, water)).toEqual([])
    const patch = [...shore.patches.values()].find((p) => p.water.length)!
    patch.water[0]! += 10000
    expect(bankViolations(shore, water).some((error) => error.includes('outside its patch'))).toBe(true)
  })
  it('keeps a cut river connected through a right-angle junction and an open outlet', () => {
    const cells = 5,
      bed = new Int32Array(25)
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) bed[y * 5 + x] = (4 - y) * 50 + (x === 2 ? 0 : 100)
    const water = deriveWater(cells, 500, bed, 50, 80),
      corners = new Int32Array(36)
    for (let y = 0; y <= 5; y++)
      for (let x = 0; x <= 5; x++) corners[y * 6 + x] = bed[Math.min(4, y) * 5 + Math.min(4, x)]!
    const shore = buildBanks(water, corners)
    expect(water.bodies.some((body) => body.kind === 'river')).toBe(true)
    let connections = 0
    for (let id = 0; id < 25; id++) {
      if (water.body[id]! < 0) continue
      const p = { x: ((id % 5) + 0.5) * 500, y: (Math.floor(id / 5) + 0.5) * 500 }
      expect(bankWaterHeight(shore, p)).not.toBeNull()
      const next = water.parent[id]!
      if (next >= 0 && water.body[next]! >= 0) {
        const q = { x: ((next % 5) + 0.5) * 500, y: (Math.floor(next / 5) + 0.5) * 500 }
        for (const t of [0.25, 0.5, 0.75])
          expect(bankWaterHeight(shore, { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })).not.toBeNull()
        connections++
      }
    }
    expect(connections).toBeGreaterThan(0)
  })
})
