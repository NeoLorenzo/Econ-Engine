import { normalizeSeed, randomInt } from './rng'
import type { Coordinate } from './types'

export const deriveSpatialSeed = (masterSeed: number) => normalizeSeed((normalizeSeed(masterSeed) ^ 0x9e3779b9) >>> 0)

export function manhattanDistance(a: Coordinate, b: Coordinate) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function transportQuote(a: Coordinate, b: Coordinate, rateCents: number) {
  const oneWayDistance = manhattanDistance(a, b)
  const roundTripTiles = oneWayDistance * 2
  return { oneWayDistance, roundTripTiles, transportFeeCents: roundTripTiles * rateCents }
}

export function generateSpatialLayout(seed: number, width: number, height: number, entityIds: readonly string[]) {
  if (width * height < entityIds.length) throw new Error('Spatial grid has too few unique cells')
  let state = deriveSpatialSeed(seed)
  const cells = Array.from({ length: width * height }, (_, index) => index)
  for (let index = 0; index < entityIds.length; index += 1) {
    const draw = randomInt(state, cells.length - index)
    state = draw.state
    const selected = index + draw.value
    ;[cells[index], cells[selected]] = [cells[selected], cells[index]]
  }
  return Object.fromEntries(entityIds.map((id, index) => [id, { x: cells[index] % width, y: Math.floor(cells[index] / width) }])) as Record<string, Coordinate>
}
