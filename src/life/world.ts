import { mixSeed, normalizeSeed, randomInt, seededShuffle } from '../sim/rng'
import type { LifeConfig, Patch, Tile } from './types'

const LAYOUT_STREAM_SALT = 0x4c49_4645
const TURN_ORDER_STREAM_SALT = 0x5455_524e

/** Patches and starting tiles. */
export const deriveLayoutSeed = (seed: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ LAYOUT_STREAM_SALT) >>> 0))

/** The turn order of hour `tick`. It depends on the hour, not on earlier draws, so any hour's order stands alone. */
export const deriveTurnOrderSeed = (seed: number, tick: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ TURN_ORDER_STREAM_SALT ^ mixSeed(tick)) >>> 0))

/** Every forager ID in the order they take their turns in hour `tick`. Dead foragers are skipped by the caller. */
export const turnOrder = (seed: number, tick: number, bandSize: number) =>
  seededShuffle(
    Array.from({ length: bandSize }, (_, id) => id),
    deriveTurnOrderSeed(seed, tick),
  ).values

export function generateLayout(config: LifeConfig): { patches: Patch[]; starts: Tile[] } {
  const tiles: Tile[] = []
  for (let y = 0; y < config.gridHeight; y += 1) for (let x = 0; x < config.gridWidth; x += 1) tiles.push({ x, y })
  const shuffled = seededShuffle(tiles, deriveLayoutSeed(config.seed))
  const patches = shuffled.values.slice(0, config.patchCount).map((tile, id) => ({
    id,
    tile,
    stockKcal: config.initialPatchStockKcal,
  }))
  // Drawn from every tile, one forager after another, so foragers may start on a patch or on the same tile. Forager 0
  // is drawn first and starts where Life 0's forager did.
  const starts: Tile[] = []
  let state = shuffled.state
  for (let id = 0; id < config.bandSize; id += 1) {
    const draw = randomInt(state, tiles.length)
    state = draw.state
    starts.push(tiles[draw.value]!)
  }
  return { patches, starts }
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
