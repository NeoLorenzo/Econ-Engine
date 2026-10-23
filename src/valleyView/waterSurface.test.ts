import { expect, it } from 'vitest'
import type { GroundSurface } from './groundSurface'
import { waterSurface } from './waterSurface'

function fixture(body: number[], levels: number[]): GroundSurface {
  return {
    columns: [0, 1, 2],
    heights: new Int32Array(9).fill(300),
    along: 3,
    cellCm: 500,
    cells: 2,
    sizeCm: 1000,
    water: {
      cells: 2,
      cellCm: 500,
      body: new Int32Array(body),
      level: new Int32Array(levels),
      bed: new Int32Array(4).fill(-200),
      parent: new Int32Array(4),
      rank: new Int32Array(4),
      order: new Int32Array(4),
      catchmentM2: new Float64Array(4),
      bodies: [],
    },
  }
}

it('closes river steps with water faces and maps every surface face to its body', () => {
  const mesh = waterSurface(fixture([7, 8, -1, -1], [100, 50, 0, 0]))
  // Two tops and one shared vertical connector; no extra surface crosses dry ground.
  expect(mesh.vertices.length / 9).toBe(6)
  expect(mesh.waterBodyByFace).toEqual([7, 7, 7, 7, 8, 8])
  const connector = mesh.vertices.slice(18, 36)
  for (let index = 0; index < connector.length; index += 3) {
    expect(connector[index]).toBe(0)
    expect([0.5, 1]).toContain(connector[index + 1])
    expect([-5, 0]).toContain(connector[index + 2])
  }
})

it('builds full-height banks at wet-owned corners and does not wrap neighbours across rows', () => {
  const mesh = waterSurface(fixture([-1, 0, 1, -1], [0, 100, 100, 0]))
  // The two diagonal wet squares each need four banks, even at the row boundary.
  expect(mesh.bedVertices.length / 18).toBe(10)
  for (let cell = 0; cell < 2; cell += 1) {
    const banks = mesh.bedVertices.slice(cell * 90 + 18, (cell + 1) * 90)
    const heights = banks.filter((_, index) => index % 3 === 1)
    expect(heights.filter((height) => height === 3)).toHaveLength(12)
    expect(heights.every((height) => height === 3 || height === -2)).toBe(true)
  }
})
