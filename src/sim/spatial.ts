import { normalizeSeed, randomInt } from './rng'
import type { Coordinate, Plot } from './types'

export const deriveSpatialSeed = (masterSeed: number) => normalizeSeed((normalizeSeed(masterSeed) ^ 0x9e3779b9) >>> 0)

export function manhattanDistance(a: Coordinate, b: Coordinate) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/** Manhattan distance from a tile to the nearest tile of a plot: 0 on the plot, 1 next to an edge. */
export function plotDistance(coordinate: Coordinate, plot: Plot) {
  const dx = Math.max(0, plot.x - coordinate.x, coordinate.x - (plot.x + plot.width - 1))
  const dy = Math.max(0, plot.y - coordinate.y, coordinate.y - (plot.y + plot.height - 1))
  return dx + dy
}

/** The fee for a round trip from a household's tile to the nearest tile of a firm's plot and back. */
export function transportQuote(coordinate: Coordinate, plot: Plot, rateCents: number) {
  const oneWayDistance = plotDistance(coordinate, plot)
  const roundTripTiles = oneWayDistance * 2
  return { oneWayDistance, roundTripTiles, transportFeeCents: roundTripTiles * rateCents }
}

/** Whether two plots leave at least one empty tile between them. */
export function plotsSeparated(a: Plot, b: Plot) {
  return a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y
}

export function plotContains(plot: Plot, { x, y }: Coordinate) {
  return x >= plot.x && x < plot.x + plot.width && y >= plot.y && y < plot.y + plot.height
}

export interface TownLayout {
  households: Record<string, Coordinate>
  plots: Record<string, Plot>
}

const tooSmall = (width: number, height: number, what: string) =>
  new Error(`gridWidth × gridHeight is ${width} × ${height} = ${width * height} cells, too few to place ${what}`)

/**
 * Lays out the town from the spatial seed, which no other random stream shares:
 * 1. Government's plot is centred.
 * 2. Firm plots go in descending area, then by ID. A plot that is not square first draws its orientation, then a
 *    position drawn uniformly from every one that keeps a one-tile gap from the plots already placed. If the drawn
 *    orientation fits nowhere, the other is tried.
 * 3. Households are shuffled onto the tiles no plot covers. A house may stand right beside a plot.
 */
export function generateTownLayout(
  seed: number,
  width: number,
  height: number,
  {
    householdIds,
    plots,
    centred,
  }: {
    householdIds: readonly string[]
    plots: readonly { id: string; width: number; height: number }[]
    centred: { id: string; width: number; height: number }
  },
): TownLayout {
  let state = deriveSpatialSeed(seed)
  const placed: Record<string, Plot> = {}
  // Tiles a new plot may not use: every placed plot and the one-tile gap around it.
  const blocked = new Uint8Array(width * height)
  const covered = new Uint8Array(width * height)
  const claim = (id: string, plot: Plot) => {
    placed[id] = plot
    for (let y = plot.y - 1; y <= plot.y + plot.height; y += 1)
      for (let x = plot.x - 1; x <= plot.x + plot.width; x += 1)
        if (x >= 0 && x < width && y >= 0 && y < height) blocked[y * width + x] = 1
    for (let y = plot.y; y < plot.y + plot.height; y += 1)
      for (let x = plot.x; x < plot.x + plot.width; x += 1) covered[y * width + x] = 1
  }
  const fits = (x: number, y: number, w: number, h: number) => {
    for (let row = y; row < y + h; row += 1)
      for (let column = x; column < x + w; column += 1) if (blocked[row * width + column]) return false
    return true
  }
  const positions = (w: number, h: number) => {
    const found: Coordinate[] = []
    for (let y = 0; y + h <= height; y += 1)
      for (let x = 0; x + w <= width; x += 1) if (fits(x, y, w, h)) found.push({ x, y })
    return found
  }

  if (centred.width > width || centred.height > height) throw tooSmall(width, height, `the ${centred.id} plot`)
  claim(centred.id, {
    x: Math.floor((width - centred.width) / 2),
    y: Math.floor((height - centred.height) / 2),
    width: centred.width,
    height: centred.height,
  })

  const ordered = [...plots].sort(
    (left, right) => right.width * right.height - left.width * left.height || left.id.localeCompare(right.id),
  )
  for (const plot of ordered) {
    let [w, h] = [plot.width, plot.height]
    if (w !== h) {
      const turn = randomInt(state, 2)
      state = turn.state
      if (turn.value === 1) [w, h] = [h, w]
    }
    let candidates = positions(w, h)
    if (!candidates.length && w !== h) {
      ;[w, h] = [h, w]
      candidates = positions(w, h)
    }
    if (!candidates.length) throw tooSmall(width, height, `the ${plot.id} plot with a one-tile gap around every plot`)
    const draw = randomInt(state, candidates.length)
    state = draw.state
    claim(plot.id, { ...candidates[draw.value]!, width: w, height: h })
  }

  const cells: number[] = []
  for (let index = 0; index < width * height; index += 1) if (!covered[index]) cells.push(index)
  if (cells.length < householdIds.length)
    throw tooSmall(width, height, `${householdIds.length} households beside the plots`)
  for (let index = 0; index < householdIds.length; index += 1) {
    const draw = randomInt(state, cells.length - index)
    state = draw.state
    const selected = index + draw.value
    ;[cells[index], cells[selected]] = [cells[selected]!, cells[index]!]
  }
  return {
    households: Object.fromEntries(
      householdIds.map((id, index) => [id, { x: cells[index]! % width, y: Math.floor(cells[index]! / width) }]),
    ),
    plots: placed,
  }
}
