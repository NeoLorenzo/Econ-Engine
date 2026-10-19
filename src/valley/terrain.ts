import { mixSeed, normalizeSeed, randomInt } from '../sim/rng'
import { distanceSq } from './geometry'
import type { ValleyConfig } from './types'

// The land's shape: a height field in whole centimetres above the lake, generated once from the terrain stream as the
// sum of a broad rise and fall, hummocks and kettle hollows, falling to the lake along the north edge; and its ground,
// wet, rock, sand or soil. Slopes set a walker's speed by Tobler's hiking function and its cost by the Pandolf equation
// with its grade term, corrected downhill by Santee.

const TERRAIN_STREAM_SALT = 0x5445_5252

export const deriveTerrainSeed = (seed: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ TERRAIN_STREAM_SALT) >>> 0))

/** The four kinds of ground, by code. */
export const SOIL = 0
export const SAND = 1
export const ROCK = 2
export const WET = 3
export type Ground = typeof SOIL | typeof SAND | typeof ROCK | typeof WET
export const GROUND_NAMES = ['soil', 'sand', 'rock', 'wet'] as const

export interface Kettle {
  x: number
  y: number
  radius: number
  depth: number
}

/** The land's heights and ground. It never changes during a run. */
export interface Terrain {
  cellCm: number
  /** Cells along each side; lattice points along each side are one more. */
  cells: number
  /** Heights at the lattice points, row by row, in whole centimetres above the lake. */
  height: Int32Array
  /** The ground of each cell, row by row, before outcrops are laid on it. */
  ground: Uint8Array
  kettles: Kettle[]
}

/** The configuration that decides the terrain; two configurations that agree on these share one terrain. */
const TERRAIN_KEYS = [
  'seed',
  'valleySizeCm',
  'terrainCellCm',
  'reliefCm',
  'reliefWavelengthCm',
  'hummockCm',
  'hummockWavelengthCm',
  'kettleCount',
  'kettleDepthPerMille',
  'kettleMinRadiusCm',
  'kettleMaxRadiusCm',
  'shoreRampCm',
  'shoreWetCm',
  'sandBelowCm',
  'rockSlopePercent',
  'campClearingCm',
] as const satisfies readonly (keyof ValleyConfig)[]

const byConfig = new WeakMap<ValleyConfig, Terrain>()
const byKey = new Map<string, Terrain>()
const TERRAIN_CACHE_LIMIT = 16

class TerrainError extends Error {}

/** The terrain of a configuration, generated once and kept; it holds no simulation state. */
export function terrainOf(config: ValleyConfig): Terrain {
  let terrain = byConfig.get(config)
  if (terrain) return terrain
  const key = TERRAIN_KEYS.map((name) => config[name]).join(',')
  terrain = byKey.get(key)
  if (!terrain) {
    terrain = generateTerrain(config)
    if (byKey.size >= TERRAIN_CACHE_LIMIT) byKey.delete(byKey.keys().next().value!)
    byKey.set(key, terrain)
  }
  byConfig.set(config, terrain)
  return terrain
}

/** The reason a configuration's terrain cannot be drawn, or null. */
export function terrainError(config: ValleyConfig) {
  try {
    terrainOf(config)
    return null
  } catch (error) {
    if (error instanceof TerrainError) return error.message
    throw error
  }
}

/**
 * Value noise in whole centimetres: values drawn at lattice points `wavelength` cells apart, interpolated by the
 * smoothstep `3t² − 2t³`, first along x, rounded down, then along y, rounded down. Returns the field at every terrain
 * lattice point.
 */
function valueNoise(next: (max: number) => number, points: number, wavelength: number, amplitude: number) {
  const lattice = Math.ceil((points - 1) / wavelength) + 1
  const values = new Int32Array(lattice * lattice)
  for (let index = 0; index < values.length; index += 1) values[index] = next(amplitude + 1)
  const cube = wavelength ** 3
  // The smoothstep's numerator over `wavelength³` for each offset within a wavelength.
  const step = new Float64Array(wavelength + 1)
  for (let t = 0; t <= wavelength; t += 1) step[t] = t * t * (3 * wavelength - 2 * t)
  const lerp = (a: number, b: number, t: number) => a + Math.floor(((b - a) * step[t]!) / cube)
  const field = new Int32Array(points * points)
  for (let j = 0; j < points; j += 1) {
    const gy = Math.min(lattice - 2, Math.floor(j / wavelength))
    const ty = j - gy * wavelength
    for (let i = 0; i < points; i += 1) {
      const gx = Math.min(lattice - 2, Math.floor(i / wavelength))
      const tx = i - gx * wavelength
      const top = lerp(values[gy * lattice + gx]!, values[gy * lattice + gx + 1]!, tx)
      const bottom = lerp(values[(gy + 1) * lattice + gx]!, values[(gy + 1) * lattice + gx + 1]!, tx)
      field[j * points + i] = lerp(top, bottom, ty)
    }
  }
  return field
}

/** Generates the terrain: broad relief, hummocks and kettles from the terrain stream, then the ground of each cell. */
export function generateTerrain(config: ValleyConfig): Terrain {
  const cellCm = config.terrainCellCm
  const cells = config.valleySizeCm / cellCm
  const points = cells + 1
  let state = deriveTerrainSeed(config.seed)
  const next = (max: number) => {
    const draw = randomInt(state, max)
    state = draw.state
    return draw.value
  }
  const broad = valueNoise(next, points, config.reliefWavelengthCm / cellCm, config.reliefCm)
  const hummocks = valueNoise(next, points, config.hummockWavelengthCm / cellCm, config.hummockCm)
  const size = config.valleySizeCm
  const camp = Math.floor(size / 2)
  const kettles: Kettle[] = []
  let failed = 0
  const radii = config.kettleMaxRadiusCm - config.kettleMinRadiusCm + 1
  while (kettles.length < config.kettleCount) {
    const x = next(size + 1)
    const y = next(size + 1)
    const radius = config.kettleMinRadiusCm + next(radii)
    if (distanceSq(x, y, camp, camp) >= (config.campClearingCm + radius) ** 2) {
      kettles.push({ x, y, radius, depth: Math.floor((radius * config.kettleDepthPerMille) / 1_000) })
      failed = 0
    } else if ((failed += 1) >= 10_000) throw new TerrainError('The kettles cannot all be placed')
  }
  const height = new Int32Array(points * points)
  for (let j = 0; j < points; j += 1) {
    const y = j * cellCm
    const ramp = Math.min(y, config.shoreRampCm)
    for (let i = 0; i < points; i += 1) {
      const index = j * points + i
      height[index] = Math.floor(((broad[index]! + hummocks[index]!) * ramp) / config.shoreRampCm)
    }
  }
  for (const kettle of kettles) {
    const r2 = kettle.radius ** 2
    const i0 = Math.max(0, Math.ceil((kettle.x - kettle.radius) / cellCm))
    const i1 = Math.min(cells, Math.floor((kettle.x + kettle.radius) / cellCm))
    const j0 = Math.max(0, Math.ceil((kettle.y - kettle.radius) / cellCm))
    const j1 = Math.min(cells, Math.floor((kettle.y + kettle.radius) / cellCm))
    for (let j = j0; j <= j1; j += 1)
      for (let i = i0; i <= i1; i += 1) {
        const s2 = distanceSq(i * cellCm, j * cellCm, kettle.x, kettle.y)
        if (s2 < r2) height[j * points + i]! -= Math.floor((kettle.depth * (r2 - s2)) / r2)
      }
  }
  for (let index = 0; index < height.length; index += 1) if (height[index]! < 0) height[index] = 0
  const ground = new Uint8Array(cells * cells)
  const half = Math.floor(cellCm / 2)
  // The inner half of every kettle is wet.
  const wet = new Uint8Array(cells * cells)
  for (const kettle of kettles) {
    const reach = Math.ceil(kettle.radius / 2)
    const i0 = Math.max(0, Math.floor((kettle.x - reach) / cellCm))
    const i1 = Math.min(cells - 1, Math.floor((kettle.x + reach) / cellCm))
    const j0 = Math.max(0, Math.floor((kettle.y - reach) / cellCm))
    const j1 = Math.min(cells - 1, Math.floor((kettle.y + reach) / cellCm))
    for (let j = j0; j <= j1; j += 1)
      for (let i = i0; i <= i1; i += 1)
        if (distanceSq(i * cellCm + half, j * cellCm + half, kettle.x, kettle.y) * 4 < kettle.radius ** 2)
          wet[j * cells + i] = 1
  }
  for (let j = 0; j < cells; j += 1)
    for (let i = 0; i < cells; i += 1) {
      const cy = j * cellCm + half
      const a = height[j * points + i]!
      const b = height[j * points + i + 1]!
      const c = height[(j + 1) * points + i]!
      const d = height[(j + 1) * points + i + 1]!
      let kind: Ground = SOIL
      if (cy < config.shoreWetCm || wet[j * cells + i]) kind = WET
      else if (cellSlopePercent(cellCm, a, b, c, d) >= config.rockSlopePercent) kind = ROCK
      else {
        const low =
          broad[j * points + i]! +
          broad[j * points + i + 1]! +
          broad[(j + 1) * points + i]! +
          broad[(j + 1) * points + i + 1]!
        if (Math.floor(low / 4) < config.sandBelowCm) kind = SAND
      }
      ground[j * cells + i] = kind
    }
  return { cellCm, cells, height, ground, kettles }
}

/** A cell's slope in whole percent: the larger of its mean rises along x and along y, over its width. */
export function cellSlopePercent(cellCm: number, a: number, b: number, c: number, d: number) {
  const alongX = Math.abs(b + d - a - c)
  const alongY = Math.abs(c + d - a - b)
  return Math.floor((100 * Math.max(alongX, alongY)) / (2 * cellCm))
}

/** The ground's height at a point, by bilinear interpolation between the four lattice points round it, rounded down. */
export function heightAt(terrain: Terrain, x: number, y: number) {
  const { cellCm, cells, height } = terrain
  const size = cells * cellCm
  const px = x < 0 ? 0 : x > size ? size : x
  const py = y < 0 ? 0 : y > size ? size : y
  const i = Math.min(cells - 1, Math.floor(px / cellCm))
  const j = Math.min(cells - 1, Math.floor(py / cellCm))
  const fx = px - i * cellCm
  const fy = py - j * cellCm
  const points = cells + 1
  const a = height[j * points + i]!
  const b = height[j * points + i + 1]!
  const c = height[(j + 1) * points + i]!
  const d = height[(j + 1) * points + i + 1]!
  const gx = cellCm - fx
  const gy = cellCm - fy
  return Math.floor((a * gx * gy + b * fx * gy + c * gx * fy + d * fx * fy) / (cellCm * cellCm))
}

/** The terrain cell holding a point. */
export function cellOf(terrain: Terrain, x: number, y: number) {
  const i = Math.max(0, Math.min(terrain.cells - 1, Math.floor(x / terrain.cellCm)))
  const j = Math.max(0, Math.min(terrain.cells - 1, Math.floor(y / terrain.cellCm)))
  return j * terrain.cells + i
}

/** The slope of the cell holding a point, in whole percent. */
export function slopeAt(terrain: Terrain, x: number, y: number) {
  const cell = cellOf(terrain, x, y)
  const points = terrain.cells + 1
  const i = cell % terrain.cells
  const j = Math.floor(cell / terrain.cells)
  const h = terrain.height
  return cellSlopePercent(
    terrain.cellCm,
    h[j * points + i]!,
    h[j * points + i + 1]!,
    h[(j + 1) * points + i]!,
    h[(j + 1) * points + i + 1]!,
  )
}

/** The Pandolf terrain factor of a ground, in percent. */
export function terrainPercentOf(config: ValleyConfig, ground: number) {
  if (ground === SAND) return config.sandTerrainPercent
  if (ground === ROCK) return config.rockTerrainPercent
  if (ground === WET) return config.wetTerrainPercent
  return config.soilTerrainPercent
}

/** Grades are held between these, in whole percent. */
export const MAX_GRADE_PERCENT = 60

/**
 * Tobler's hiking function, in whole thousandths of the speed on the flat, for each whole percent of grade from −60 to
 * 60: `round(1,000 · exp(−3.5 · |G / 100 + 0.05| + 0.175))`. It is written out so that it is the same on every machine.
 */
// prettier-ignore
export const TOBLER_PER_MILLE: readonly number[] = [
  174, 180, 186, 193, 200, 207, 214, 222, 230, 238, 247, 255, 264, 274, 284, 294, 304, 315, 326, 338, 350, 362, 375,
  389, 403, 417, 432, 447, 463, 480, 497, 514, 533, 552, 571, 592, 613, 634, 657, 680, 705, 730, 756, 783, 811, 839,
  869, 900, 932, 966, 1000, 1036, 1073, 1111, 1150, 1191, 1150, 1111, 1073, 1036, 1000, 966, 932, 900, 869, 839, 811,
  783, 756, 730, 705, 680, 657, 634, 613, 592, 571, 552, 533, 514, 497, 480, 463, 447, 432, 417, 403, 389, 375, 362,
  350, 338, 326, 315, 304, 294, 284, 274, 264, 255, 247, 238, 230, 222, 214, 207, 200, 193, 186, 180, 174, 168, 162,
  156, 151, 146, 141, 136, 131, 127, 122,
]

export const toblerPerMille = (grade: number) => TOBLER_PER_MILLE[grade + MAX_GRADE_PERCENT]!

/** A grade in whole percent towards zero from a rise over a run, held between −60 and 60; 0 for no run. */
export function gradeOf(rise: number, run: number) {
  if (run <= 0) return 0
  const grade = Math.trunc((100 * rise) / run)
  return Math.max(-MAX_GRADE_PERCENT, Math.min(MAX_GRADE_PERCENT, grade))
}

/** Speed on a grade: the speed on the flat for a load times Tobler's curve, rounded down, at least 1. */
export const speedOnGrade = (loadSpeed: number, grade: number) =>
  Math.max(1, Math.floor((loadSpeed * toblerPerMille(grade)) / 1_000))

const walkCosts = new WeakMap<ValleyConfig, Map<number, number>>()

/**
 * What an hour of walking costs, in whole kilocalories rounded down, never less than standing: the Pandolf equation
 * (Pandolf, Givoni and Goldman, 1977) for body mass `W`, load `L`, speed `V` in m/s, grade `G` in percent and terrain
 * factor `η` = `terrainPercent` / 100, `M = 1.5 W + 2 (W + L) (L / W)² + η (W + L) (1.5 V² + 0.35 V G)` watts, less
 * Santee's correction `η (G (W + L) V / 3.5 − (W + L) (G + 6)² / W + 25 − V²)` for a descent, at 0.86 kcal a
 * watt-hour. It is computed exactly over the common denominator `14,000,000 · W²`.
 */
export function walkCost(config: ValleyConfig, kg: number, speed: number, grade: number, terrainPercent: number) {
  let costs = walkCosts.get(config)
  if (!costs) walkCosts.set(config, (costs = new Map()))
  const key = ((kg * 2_048 + speed) * 128 + grade + MAX_GRADE_PERCENT) * 1_024 + terrainPercent
  const known = costs.get(key)
  if (known !== undefined) return known
  const W = BigInt(config.bodyKg)
  const L = BigInt(kg)
  const v = BigInt(speed)
  const G = BigInt(grade)
  const T = BigInt(terrainPercent)
  const WL = W + L
  let numerator =
    21_000_000n * W * W * W + 28_000_000n * WL * L * L + 21n * T * WL * v * v * W * W + 490n * T * WL * v * G * W * W
  if (grade < 0)
    numerator -=
      400n * T * G * WL * v * W * W -
      140_000n * T * WL * (G + 6n) ** 2n * W +
      3_500_000n * T * W * W -
      14n * T * v * v * W * W
  const raw = numerator < 0n ? 0 : Number((86n * numerator) / (100n * 14_000_000n * W * W))
  const cost = Math.max(config.restKcalPerHour, raw)
  costs.set(key, cost)
  return cost
}
