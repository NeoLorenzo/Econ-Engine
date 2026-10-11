import { mixSeed, normalizeSeed, randomInt, seededShuffle } from '../sim/rng'
import type { LifeConfig, Patch, Tile } from './types'

const LAYOUT_STREAM_SALT = 0x4c49_4645

/** The layout is the only random draw in Life 0, so it has the only stream. */
export const deriveLayoutSeed = (seed: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ LAYOUT_STREAM_SALT) >>> 0))

export function generateLayout(config: LifeConfig): { patches: Patch[]; start: Tile } {
  const tiles: Tile[] = []
  for (let y = 0; y < config.gridHeight; y += 1) for (let x = 0; x < config.gridWidth; x += 1) tiles.push({ x, y })
  const shuffled = seededShuffle(tiles, deriveLayoutSeed(config.seed))
  const patches = shuffled.values.slice(0, config.patchCount).map((tile, id) => ({
    id,
    tile,
    stockKcal: config.initialPatchStockKcal,
  }))
  // Drawn from every tile, so the forager may start on a patch; on a one-tile world it always does.
  const start = tiles[randomInt(shuffled.state, tiles.length).value]!
  return { patches, start }
}

export const isDaylight = (config: LifeConfig, tick: number) => {
  const hour = tick % 24
  return hour >= config.dawnHour && hour < config.duskHour
}

export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y

export const manhattan = (a: Tile, b: Tile) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export const patchAt = (patches: readonly Patch[], tile: Tile) => patches.find((patch) => sameTile(patch.tile, tile))

/** Moves up to `steps` tiles towards `target`, along x first and then y, stopping on arrival. Returns every tile entered. */
export function walkPath(from: Tile, target: Tile, steps: number): Tile[] {
  const path: Tile[] = []
  let { x, y } = from
  for (let step = 0; step < steps && (x !== target.x || y !== target.y); step += 1) {
    if (x !== target.x) x += target.x > x ? 1 : -1
    else y += target.y > y ? 1 : -1
    path.push({ x, y })
  }
  return path
}
