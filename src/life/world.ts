import { mixSeed, normalizeSeed, randomInt, seededShuffle } from '../sim/rng'
import type { LifeConfig, Patch, Strategy, Tile } from './types'

const LAYOUT_STREAM_SALT = 0x4c49_4645
const TURN_ORDER_STREAM_SALT = 0x5455_524e
const LUCK_STREAM_SALT = 0x4c55_434b

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

/**
 * Whether forager `foragerId`'s hour of foraging in hour `tick` succeeds. Its seed depends only on the hour and the
 * forager, so any forager's luck in any hour stands alone, and no other stream is disturbed.
 */
export const deriveLuckSeed = (seed: number, tick: number, foragerId: number) =>
  normalizeSeed(
    mixSeed(
      (normalizeSeed(seed) ^ LUCK_STREAM_SALT ^ mixSeed(tick) ^ mixSeed(Math.imul(foragerId + 1, 0x9e37_79b9))) >>> 0,
    ),
  )

/** An hour succeeds with probability `forageKcalPerHour / harvestKcal`; when the two are equal, always. */
export const forageSucceeds = (config: LifeConfig, tick: number, foragerId: number) =>
  randomInt(deriveLuckSeed(config.seed, tick, foragerId), config.harvestKcal).value < config.forageKcalPerHour

/** The camp tile in the middle of the grid, or null without a camp. */
export const campTile = (config: LifeConfig): Tile | null =>
  config.hasCamp ? { x: Math.floor(config.gridWidth / 2), y: Math.floor(config.gridHeight / 2) } : null

/** Keepers first, then sharers, then reciprocators, by ID. */
export function strategyOf(config: LifeConfig, foragerId: number): Strategy {
  const keepers = config.bandSize - config.sharers - config.reciprocators
  if (foragerId < keepers) return 'keeper'
  return foragerId < keepers + config.sharers ? 'sharer' : 'reciprocator'
}

export function generateLayout(config: LifeConfig): { patches: Patch[]; starts: Tile[] } {
  const tiles: Tile[] = []
  for (let y = 0; y < config.gridHeight; y += 1) for (let x = 0; x < config.gridWidth; x += 1) tiles.push({ x, y })
  const shuffled = seededShuffle(tiles, deriveLayoutSeed(config.seed))
  const patches = shuffled.values.slice(0, config.patchCount).map((tile, id) => ({
    id,
    tile,
    stockKcal: config.initialPatchStockKcal,
  }))
  // With a camp the whole band starts there and nothing is drawn.
  const camp = campTile(config)
  if (camp) return { patches, starts: Array.from({ length: config.bandSize }, () => ({ ...camp })) }
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

/** Whole hours of walking to cover a Manhattan distance. */
export const walkHours = (config: LifeConfig, tiles: number) => Math.ceil(tiles / config.tilesPerHour)

/** Daylight hours left from the start of hour `tick`, or 0 at night. */
export const daylightLeft = (config: LifeConfig, tick: number) =>
  isDaylight(config, tick) ? config.duskHour - (tick % 24) : 0

/**
 * With a camp, a forager away from it must walk home now if it is night, or if walking home takes every daylight hour
 * left. Without a camp it never must.
 */
export function mustGoHome(config: LifeConfig, position: Tile, tick: number) {
  const camp = campTile(config)
  if (!camp || sameTile(position, camp)) return false
  return !isDaylight(config, tick) || walkHours(config, manhattan(position, camp)) >= daylightLeft(config, tick)
}

/**
 * With a camp, a forager at `from` in hour `tick` sets out only for a patch it can reach, forage for an hour, and walk
 * home from before dusk. Without a camp every patch can be reached.
 */
export function reachableInTime(config: LifeConfig, from: Tile, target: Tile, tick: number) {
  const camp = campTile(config)
  if (!camp) return true
  const hours = walkHours(config, manhattan(from, target)) + 1 + walkHours(config, manhattan(target, camp))
  return hours <= daylightLeft(config, tick)
}

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
