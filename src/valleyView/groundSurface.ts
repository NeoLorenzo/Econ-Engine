import type { Terrain } from '../valley/terrain'

/**
 * The observer's sampled version of the immutable terrain. The same samples build the mesh and answer every visual
 * ground-contact query, so an object cannot be positioned against detail that the visible mesh does not contain.
 */
export interface GroundSurface {
  water: Terrain['water']
  columns: readonly number[]
  heights: Int32Array
  along: number
  cellCm: number
  cells: number
  sizeCm: number
}

export function groundSurface(terrain: Terrain, maximumSquares: number): GroundSurface {
  const stride = Math.max(1, Math.ceil(terrain.cells / maximumSquares))
  const columns: number[] = []
  for (let cell = 0; cell < terrain.cells; cell += stride) columns.push(cell)
  columns.push(terrain.cells)
  const along = columns.length
  const sourcePoints = terrain.cells + 1
  const heights = new Int32Array(along * along)
  for (const [row, j] of columns.entries())
    for (const [column, i] of columns.entries()) heights[row * along + column] = terrain.height[j * sourcePoints + i]!
  return {
    water: terrain.water,
    columns,
    heights,
    along,
    cellCm: terrain.cellCm,
    cells: terrain.cells,
    sizeCm: terrain.cells * terrain.cellCm,
  }
}

function interval(columns: readonly number[], coordinate: number) {
  let low = 0
  let high = columns.length - 1
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (columns[middle]! <= coordinate) low = middle
    else high = middle
  }
  return Math.min(columns.length - 2, low)
}

/** Bilinear height of the visible mesh at simulation coordinates, in centimetres. */
export function surfaceHeightAt(surface: GroundSurface, x: number, y: number) {
  const cell =
    Math.min(surface.cells - 1, Math.max(0, Math.floor(y / surface.cellCm))) * surface.cells +
    Math.min(surface.cells - 1, Math.max(0, Math.floor(x / surface.cellCm)))
  if (surface.water.body[cell]! >= 0) return surface.water.bed[cell]!
  const px = Math.max(0, Math.min(surface.sizeCm, x))
  const py = Math.max(0, Math.min(surface.sizeCm, y))
  const cellX = px / surface.cellCm
  const cellY = py / surface.cellCm
  const i = interval(surface.columns, cellX)
  const j = interval(surface.columns, cellY)
  const x0 = surface.columns[i]!
  const x1 = surface.columns[i + 1]!
  const y0 = surface.columns[j]!
  const y1 = surface.columns[j + 1]!
  const fx = (cellX - x0) / (x1 - x0)
  const fy = (cellY - y0) / (y1 - y0)
  const a = surface.heights[j * surface.along + i]!
  const b = surface.heights[j * surface.along + i + 1]!
  const c = surface.heights[(j + 1) * surface.along + i]!
  const d = surface.heights[(j + 1) * surface.along + i + 1]!
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
}
