import { mixSeed, normalizeSeed, randomInt } from '../sim/rng'
import { distanceSq } from './geometry'
import type { ValleyConfig } from './types'
import { deriveWater, cardinalCells, type WaterGrid } from './water'

// The immutable young-moraine landscape. Its landforms share an ice-flow field and occur in coherent zones rather
// than as unrelated geometric bumps. All simulation heights remain whole centimetres.

const TERRAIN_STREAM_SALT = 0x5445_5252
const BROAD_STREAM_SALT = 0x4252_4f41
const FLOW_STREAM_SALT = 0x464c_4f57
const ZONE_STREAM_SALT = 0x5a4f_4e45
const MORAINE_STREAM_SALT = 0x4d4f_5241
const DRUMLIN_STREAM_SALT = 0x4452_554d
const KAME_STREAM_SALT = 0x4b41_4d45
const HUMMOCK_STREAM_SALT = 0x4855_4d4d
const KETTLE_STREAM_SALT = 0x4b45_5454
const VALLEY_STREAM_SALT = 0x5641_4c4c
const MICRO_COARSE_STREAM_SALT = 0x4d43_524f
const MICRO_FINE_STREAM_SALT = 0x4d46_494e

export const deriveTerrainSeed = (seed: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ TERRAIN_STREAM_SALT) >>> 0))

export const deriveTerrainStreamSeed = (seed: number, salt: number) =>
  normalizeSeed(mixSeed((deriveTerrainSeed(seed) ^ salt) >>> 0))

/** The three surfaces of the grassland, by code. */
export const GRASS = 0
export const DIRT = 1
export const STONE = 2
export type Ground = typeof GRASS | typeof DIRT | typeof STONE
export const GROUND_NAMES = ['grass', 'dirt', 'stone'] as const

export interface LandformLobe {
  x: number
  y: number
  radiusX: number
  radiusY: number
  height: number
  direction: number
}

export interface MoraineSegment {
  fromX: number
  fromY: number
  toX: number
  toY: number
  leftWidth: number
  rightWidth: number
  height: number
  gap: boolean
}

export interface Drumlin {
  x: number
  y: number
  length: number
  width: number
  height: number
  direction: number
}

export interface Kettle {
  x: number
  y: number
  radius: number
  depth: number
  lobes: LandformLobe[]
}

export interface TerrainZone {
  kind: 'drumlin-field' | 'dead-ice' | 'till-plain'
  x: number
  y: number
  radiusX: number
  radiusY: number
}

export interface TunnelValley {
  segments: MoraineSegment[]
}

/** The land's heights and ground. It never changes during a run. */
export interface Terrain {
  water: WaterGrid
  cellCm: number
  /** Cells along each side; lattice points along each side are one more. */
  cells: number
  /** Heights at the lattice points, row by row, in whole centimetres above the lake. */
  height: Int32Array
  /** The ground of each cell, row by row, before outcrops are laid on it. */
  ground: Uint8Array
  flowDirections: Uint8Array
  flowColumns: number
  zones: TerrainZone[]
  moraines: MoraineSegment[][]
  drumlins: Drumlin[]
  kames: LandformLobe[][]
  hummocks: LandformLobe[]
  kettles: Kettle[]
  tunnelValleys: TunnelValley[]
}

/** The configuration that decides the terrain; two configurations that agree on these share one terrain. */
const TERRAIN_KEYS = [
  'riverCatchmentM2',
  'riverDepthCm',
  'seed',
  'valleySizeCm',
  'terrainCellCm',
  'reliefCm',
  'reliefWavelengthCm',
  'iceFlowControlCm',
  'iceFlowTurnSteps',
  'moraineBeltCount',
  'moraineMinHalfWidthCm',
  'moraineMaxHalfWidthCm',
  'moraineMinHeightCm',
  'moraineMaxHeightCm',
  'moraineMinControlCm',
  'moraineMaxControlCm',
  'drumlinCount',
  'drumlinMinLengthCm',
  'drumlinMaxLengthCm',
  'drumlinMinWidthCm',
  'drumlinMaxWidthCm',
  'drumlinMinHeightCm',
  'drumlinMaxHeightCm',
  'drumlinMinAspectPerMille',
  'kameCount',
  'kameMinRadiusCm',
  'kameMaxRadiusCm',
  'kameMinHeightCm',
  'kameMaxHeightCm',
  'hummockClusterCount',
  'hummockCount',
  'hummockMinWidthCm',
  'hummockMaxWidthCm',
  'hummockMinHeightCm',
  'hummockMaxHeightCm',
  'smallKettleCount',
  'largeKettleCount',
  'kettleDepthPerMille',
  'smallKettleMinRadiusCm',
  'smallKettleMaxRadiusCm',
  'largeKettleMinRadiusCm',
  'largeKettleMaxRadiusCm',
  'kettleMaxDepthCm',
  'tunnelValleyCount',
  'tunnelValleyMinWidthCm',
  'tunnelValleyMaxWidthCm',
  'tunnelValleyMinDepthCm',
  'tunnelValleyMaxDepthCm',
  'tunnelValleyMinControlCm',
  'tunnelValleyMaxControlCm',
  'microCoarseWavelengthCm',
  'microCoarseAmplitudeCm',
  'microFineWavelengthCm',
  'microFineAmplitudeCm',
  'dirtSlopePercent',
  'stoneSlopePercent',
  'dirtCurvatureCm',
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
function valueNoise(
  next: (max: number) => number,
  points: number,
  wavelength: number,
  amplitude: number,
  centred = false,
  smooth = true,
) {
  const lattice = Math.ceil((points - 1) / wavelength) + 1
  const values = new Int32Array(lattice * lattice)
  for (let index = 0; index < values.length; index += 1)
    values[index] = centred ? next(2 * amplitude + 1) - amplitude : next(amplitude + 1)
  const denominator = smooth ? wavelength ** 3 : wavelength
  const step = new Float64Array(wavelength + 1)
  for (let t = 0; t <= wavelength; t += 1) step[t] = smooth ? t * t * (3 * wavelength - 2 * t) : t
  const lerp = (a: number, b: number, t: number) => a + Math.floor(((b - a) * step[t]!) / denominator)
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

function randomSource(seed: number, salt: number) {
  let state = deriveTerrainStreamSeed(seed, salt)
  return (max: number) => {
    const draw = randomInt(state, max)
    state = draw.state
    return draw.value
  }
}

const drawBetween = (next: (max: number) => number, min: number, max: number) => min + next(max - min + 1)

/** Squared distance from a point to a segment. All inputs are integer centimetres. */
function segmentDistanceSq(x: number, y: number, segment: MoraineSegment) {
  const dx = segment.toX - segment.fromX
  const dy = segment.toY - segment.fromY
  const lengthSq = dx * dx + dy * dy
  const projection = (x - segment.fromX) * dx + (y - segment.fromY) * dy
  if (projection <= 0) return distanceSq(x, y, segment.fromX, segment.fromY)
  if (projection >= lengthSq) return distanceSq(x, y, segment.toX, segment.toY)
  const nearestX = segment.fromX + (projection * dx) / lengthSq
  const nearestY = segment.fromY + (projection * dy) / lengthSq
  return distanceSq(x, y, nearestX, nearestY)
}

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1024, 0],
  [946, 392],
  [724, 724],
  [392, 946],
  [0, 1024],
  [-392, 946],
  [-724, 724],
  [-946, 392],
  [-1024, 0],
  [-946, -392],
  [-724, -724],
  [-392, -946],
  [0, -1024],
  [392, -946],
  [724, -724],
  [946, -392],
]

const inZone = (zone: TerrainZone, x: number, y: number) => {
  const dx = (x - zone.x) / zone.radiusX
  const dy = (y - zone.y) / zone.radiusY
  return dx * dx + dy * dy <= 1
}

function paintLobe(field: Int32Array, points: number, cellCm: number, lobe: LandformLobe, combine: 'max' | 'add') {
  const [ux, uy] = DIRECTIONS[lobe.direction]!
  const reach = Math.max(lobe.radiusX, lobe.radiusY)
  const cells = points - 1
  const i0 = Math.max(0, Math.ceil((lobe.x - reach) / cellCm))
  const i1 = Math.min(cells, Math.floor((lobe.x + reach) / cellCm))
  const j0 = Math.max(0, Math.ceil((lobe.y - reach) / cellCm))
  const j1 = Math.min(cells, Math.floor((lobe.y + reach) / cellCm))
  for (let j = j0; j <= j1; j += 1)
    for (let i = i0; i <= i1; i += 1) {
      const dx = i * cellCm - lobe.x
      const dy = j * cellCm - lobe.y
      const along = (dx * ux + dy * uy) / 1024
      const across = (-dx * uy + dy * ux) / 1024
      const q = (along * along) / (lobe.radiusX * lobe.radiusX) + (across * across) / (lobe.radiusY * lobe.radiusY)
      if (q >= 1) continue
      const contribution = Math.floor(lobe.height * (1 - q) ** 2)
      const index = j * points + i
      field[index] = combine === 'max' ? Math.max(field[index]!, contribution) : field[index]! + contribution
    }
}

/** A streamlined hill with a short blunt head and a tail twice as long down-flow. */
function paintDrumlin(field: Int32Array, points: number, cellCm: number, drumlin: Drumlin) {
  const [ux, uy] = DIRECTIONS[drumlin.direction]!
  const cells = points - 1
  const reach = drumlin.length
  const head = Math.floor(drumlin.length / 3)
  const tail = Math.floor((2 * drumlin.length) / 3)
  const halfWidth = drumlin.width / 2
  const i0 = Math.max(0, Math.ceil((drumlin.x - reach) / cellCm))
  const i1 = Math.min(cells, Math.floor((drumlin.x + reach) / cellCm))
  const j0 = Math.max(0, Math.ceil((drumlin.y - reach) / cellCm))
  const j1 = Math.min(cells, Math.floor((drumlin.y + reach) / cellCm))
  for (let j = j0; j <= j1; j += 1)
    for (let i = i0; i <= i1; i += 1) {
      const dx = i * cellCm - drumlin.x
      const dy = j * cellCm - drumlin.y
      const along = (dx * ux + dy * uy) / 1024
      const across = (-dx * uy + dy * ux) / 1024
      const radius = along < 0 ? head : tail
      const q = (along * along) / (radius * radius) + (across * across) / (halfWidth * halfWidth)
      if (q >= 1) continue
      const contribution = Math.floor(drumlin.height * (1 - q) ** 2)
      const index = j * points + i
      field[index] = Math.max(field[index]!, contribution)
    }
}

function paintSegments(
  field: Int32Array,
  points: number,
  cellCm: number,
  segments: MoraineSegment[],
  subtract = false,
) {
  const cells = points - 1
  for (const segment of segments) {
    if (segment.gap) continue
    const reach = Math.max(segment.leftWidth, segment.rightWidth)
    const i0 = Math.max(0, Math.ceil((Math.min(segment.fromX, segment.toX) - reach) / cellCm))
    const i1 = Math.min(cells, Math.floor((Math.max(segment.fromX, segment.toX) + reach) / cellCm))
    const j0 = Math.max(0, Math.ceil((Math.min(segment.fromY, segment.toY) - reach) / cellCm))
    const j1 = Math.min(cells, Math.floor((Math.max(segment.fromY, segment.toY) + reach) / cellCm))
    const dx = segment.toX - segment.fromX
    const dy = segment.toY - segment.fromY
    for (let j = j0; j <= j1; j += 1)
      for (let i = i0; i <= i1; i += 1) {
        const x = i * cellCm
        const y = j * cellCm
        const side = dx * (y - segment.fromY) - dy * (x - segment.fromX)
        const width = side >= 0 ? segment.leftWidth : segment.rightWidth
        const d2 = segmentDistanceSq(x, y, segment)
        if (d2 >= width * width) continue
        const q = Math.sqrt(d2) / width
        const profile = subtract ? (1 - q) ** 2 : side >= 0 ? (1 - q) ** 2 : (1 - q) ** 3
        const contribution = Math.floor(segment.height * profile)
        const index = j * points + i
        field[index] = Math.max(field[index]!, contribution)
      }
  }
}

/** Generates one coherent glacial assemblage, then derives exposed dirt and stone from its relief. */
export function generateTerrain(config: ValleyConfig): Terrain {
  const cellCm = config.terrainCellCm
  const cells = config.valleySizeCm / cellCm
  const points = cells + 1
  const broad = valueNoise(
    randomSource(config.seed, BROAD_STREAM_SALT),
    points,
    config.reliefWavelengthCm / cellCm,
    config.reliefCm,
  )
  const size = config.valleySizeCm
  const camp = Math.floor(size / 2)
  const flowColumns = Math.ceil(size / config.iceFlowControlCm) + 1
  const flowDirections = new Uint8Array(flowColumns * flowColumns)
  const nextFlow = randomSource(config.seed, FLOW_STREAM_SALT)
  const baseDirection = nextFlow(16)
  for (let index = 0; index < flowDirections.length; index += 1)
    flowDirections[index] =
      (baseDirection + nextFlow(2 * config.iceFlowTurnSteps + 1) - config.iceFlowTurnSteps + 16) % 16
  const directionAt = (x: number, y: number) => {
    const column = Math.min(flowColumns - 1, Math.floor(x / config.iceFlowControlCm))
    const row = Math.min(flowColumns - 1, Math.floor(y / config.iceFlowControlCm))
    return flowDirections[row * flowColumns + column]!
  }

  const nextZone = randomSource(config.seed, ZONE_STREAM_SALT)
  const zones: TerrainZone[] = [
    {
      kind: 'till-plain',
      x: (39 * size) / 50,
      y: (39 * size) / 50,
      radiusX: (21 * size) / 50,
      radiusY: (3 * size) / 10,
    },
  ]
  zones.push({ kind: 'drumlin-field', x: size / 2, y: size / 2, radiusX: size / 3, radiusY: size / 4 })
  for (let id = 1; id < 2; id += 1)
    zones.push({
      kind: 'drumlin-field',
      x: nextZone(size + 1),
      y: nextZone(size + 1),
      radiusX: size / 4,
      radiusY: size / 5,
    })
  for (let id = 0; id < config.hummockClusterCount; id += 1)
    zones.push({ kind: 'dead-ice', x: nextZone(size + 1), y: nextZone(size + 1), radiusX: size / 8, radiusY: size / 8 })
  const tillPlain = zones[0]!
  const allowed = (x: number, y: number, kind: TerrainZone['kind']) =>
    !inZone(tillPlain, x, y) && zones.some((z) => z.kind === kind && inZone(z, x, y))

  const moraines: MoraineSegment[][] = []
  const nextMoraine = randomSource(config.seed, MORAINE_STREAM_SALT)
  for (let belt = 0; belt < config.moraineBeltCount; belt += 1) {
    const direction = (baseDirection + 4 + nextMoraine(3) - 1 + 16) % 16
    const [ux, uy] = DIRECTIONS[direction]!
    const [vx, vy] = [-uy, ux]
    const offset = nextMoraine(Math.floor((2 * size) / 3) + 1) - Math.floor(size / 3)
    const spacing = drawBetween(nextMoraine, config.moraineMinControlCm, config.moraineMaxControlCm)
    const controls = Math.ceil((3 * size) / spacing)
    const vertices: { x: number; y: number }[] = []
    let bend = 0
    for (let k = 0; k <= controls; k += 1) {
      const along = -size + Math.floor((3 * size * k) / controls)
      bend += nextMoraine(Math.floor(spacing / 2) + 1) - Math.floor(spacing / 4)
      bend = Math.max(-size / 8, Math.min(size / 8, bend))
      vertices.push({
        x: Math.floor(size / 2 + (ux * along + vx * (offset + bend)) / 1024),
        y: Math.floor(size / 2 + (uy * along + vy * (offset + bend)) / 1024),
      })
    }
    const segments: MoraineSegment[] = []
    for (let k = 0; k < vertices.length - 1; k += 1) {
      const half = drawBetween(nextMoraine, config.moraineMinHalfWidthCm, config.moraineMaxHalfWidthCm)
      segments.push({
        ...vertices[k]!,
        toX: vertices[k + 1]!.x,
        toY: vertices[k + 1]!.y,
        fromX: vertices[k]!.x,
        fromY: vertices[k]!.y,
        leftWidth: half,
        rightWidth: Math.max(cellCm, Math.floor(half * 0.55)),
        height: drawBetween(nextMoraine, config.moraineMinHeightCm, config.moraineMaxHeightCm),
        gap: nextMoraine(5) === 0,
      })
    }
    moraines.push(segments)
  }

  const drumlins: Drumlin[] = []
  const nextDrumlin = randomSource(config.seed, DRUMLIN_STREAM_SALT)
  const addDrumlin = (x: number, y: number) => {
    const length = drawBetween(nextDrumlin, config.drumlinMinLengthCm, config.drumlinMaxLengthCm)
    const maxWidth = Math.min(config.drumlinMaxWidthCm, Math.floor((length * 1_000) / config.drumlinMinAspectPerMille))
    const width = drawBetween(nextDrumlin, config.drumlinMinWidthCm, Math.max(config.drumlinMinWidthCm, maxWidth))
    drumlins.push({
      x,
      y,
      length,
      width,
      height: drawBetween(nextDrumlin, config.drumlinMinHeightCm, config.drumlinMaxHeightCm),
      direction: directionAt(x, y),
    })
  }
  // A real drumlin field is a train, not a bag of independently scattered mounds. Seed an offset, flow-aligned train
  // across the inhabited centre before filling the rest of both field masks. This also means the first observer view
  // reliably contains readable relief instead of occasionally landing in a chance gap between landforms.
  const centralDirection = directionAt(camp, camp)
  const [centralU, centralV] = DIRECTIONS[centralDirection]!
  const centralCount = Math.min(12, config.drumlinCount)
  for (let id = 0; id < centralCount; id += 1) {
    const along = (Math.floor(id / 3) - 1.5) * 18_000
    const across = ((id % 3) - 1) * 16_000 + (Math.floor(id / 3) % 2) * 4_000
    const x = Math.floor(camp + (centralU * along - centralV * across) / 1024)
    const y = Math.floor(camp + (centralV * along + centralU * across) / 1024)
    addDrumlin(x, y)
  }
  for (let attempts = 0; drumlins.length < config.drumlinCount && attempts < 100_000; attempts += 1) {
    const x = nextDrumlin(size + 1),
      y = nextDrumlin(size + 1)
    if (!allowed(x, y, 'drumlin-field')) continue
    addDrumlin(x, y)
  }
  if (drumlins.length < config.drumlinCount) throw new TerrainError('The drumlins cannot all be placed')

  const makeIrregular = (
    next: (max: number) => number,
    x: number,
    y: number,
    radius: number,
    height: number,
    count: number,
  ) => {
    const lobes: LandformLobe[] = []
    for (let l = 0; l < count; l += 1)
      lobes.push({
        x: x + next(radius) - Math.floor(radius / 2),
        y: y + next(radius) - Math.floor(radius / 2),
        radiusX: Math.floor((radius * (65 + next(51))) / 100),
        radiusY: Math.floor((radius * (65 + next(51))) / 100),
        height: Math.floor((height * (70 + next(31))) / 100),
        direction: next(16),
      })
    return lobes
  }
  const kames: LandformLobe[][] = []
  const nextKame = randomSource(config.seed, KAME_STREAM_SALT)
  for (let attempts = 0; kames.length < config.kameCount && attempts < 100_000; attempts += 1) {
    const x = nextKame(size + 1),
      y = nextKame(size + 1)
    if (!allowed(x, y, 'dead-ice')) continue
    kames.push(
      makeIrregular(
        nextKame,
        x,
        y,
        drawBetween(nextKame, config.kameMinRadiusCm, config.kameMaxRadiusCm),
        drawBetween(nextKame, config.kameMinHeightCm, config.kameMaxHeightCm),
        3 + nextKame(3),
      ),
    )
  }
  const hummocks: LandformLobe[] = []
  const nextHummock = randomSource(config.seed, HUMMOCK_STREAM_SALT)
  for (let attempts = 0; hummocks.length < config.hummockCount && attempts < 200_000; attempts += 1) {
    const x = nextHummock(size + 1),
      y = nextHummock(size + 1)
    if (!allowed(x, y, 'dead-ice')) continue
    const width = drawBetween(nextHummock, config.hummockMinWidthCm, config.hummockMaxWidthCm)
    hummocks.push({
      x,
      y,
      radiusX: width,
      radiusY: Math.floor((width * (65 + nextHummock(36))) / 100),
      height: drawBetween(nextHummock, config.hummockMinHeightCm, config.hummockMaxHeightCm),
      direction: nextHummock(16),
    })
  }
  const kettles: Kettle[] = []
  const nextKettle = randomSource(config.seed, KETTLE_STREAM_SALT)
  const addKettles = (count: number, min: number, max: number) => {
    for (let attempts = 0, added = 0; added < count && attempts < 100_000; attempts += 1) {
      const x = nextKettle(size + 1)
      const y = nextKettle(size + 1)
      const radius = drawBetween(nextKettle, min, max)
      if (!allowed(x, y, 'dead-ice') || distanceSq(x, y, camp, camp) < (config.campClearingCm + radius) ** 2) continue
      const depth = Math.min(config.kettleMaxDepthCm, Math.floor((radius * config.kettleDepthPerMille) / 1_000))
      kettles.push({ x, y, radius, depth, lobes: makeIrregular(nextKettle, x, y, radius, depth, 2 + nextKettle(2)) })
      added += 1
    }
  }
  addKettles(config.smallKettleCount, config.smallKettleMinRadiusCm, config.smallKettleMaxRadiusCm)
  addKettles(config.largeKettleCount, config.largeKettleMinRadiusCm, config.largeKettleMaxRadiusCm)

  const tunnelValleys: TunnelValley[] = []
  const nextValley = randomSource(config.seed, VALLEY_STREAM_SALT)
  for (let id = 0; id < config.tunnelValleyCount; id += 1) {
    const segments: MoraineSegment[] = []
    const x0 = nextValley(size + 1),
      controls = 10 + nextValley(6)
    let previous = { x: x0, y: -Math.floor(size / 10) }
    for (let k = 1; k <= controls; k += 1) {
      const next = {
        x: Math.max(
          -size / 4,
          Math.min((5 * size) / 4, previous.x + nextValley(Math.floor(size / 5)) - Math.floor(size / 10)),
        ),
        y: Math.floor(-size / 10 + (1.2 * size * k) / controls),
      }
      const width = drawBetween(nextValley, config.tunnelValleyMinWidthCm, config.tunnelValleyMaxWidthCm)
      segments.push({
        fromX: previous.x,
        fromY: previous.y,
        toX: next.x,
        toY: next.y,
        leftWidth: width,
        rightWidth: Math.floor((width * (70 + nextValley(31))) / 100),
        height: drawBetween(nextValley, config.tunnelValleyMinDepthCm, config.tunnelValleyMaxDepthCm),
        gap: false,
      })
      previous = next
    }
    tunnelValleys.push({ segments })
  }

  const moraineHeight = new Int32Array(points * points)
  for (const belt of moraines) paintSegments(moraineHeight, points, cellCm, belt)
  const drumlinHeight = new Int32Array(points * points)
  for (const drumlin of drumlins) paintDrumlin(drumlinHeight, points, cellCm, drumlin)
  const localHeight = new Int32Array(points * points)
  for (const kame of kames) for (const lobe of kame) paintLobe(localHeight, points, cellCm, lobe, 'max')
  for (const hummock of hummocks) paintLobe(localHeight, points, cellCm, hummock, 'max')
  const kettleDepth = new Int32Array(points * points)
  for (const kettle of kettles) for (const lobe of kettle.lobes) paintLobe(kettleDepth, points, cellCm, lobe, 'max')
  const valleyDepth = new Int32Array(points * points)
  for (const valley of tunnelValleys) paintSegments(valleyDepth, points, cellCm, valley.segments, true)
  const microCoarse = valueNoise(
    randomSource(config.seed, MICRO_COARSE_STREAM_SALT),
    points,
    config.microCoarseWavelengthCm / cellCm,
    config.microCoarseAmplitudeCm,
    true,
    false,
  )
  const microFine = valueNoise(
    randomSource(config.seed, MICRO_FINE_STREAM_SALT),
    points,
    config.microFineWavelengthCm / cellCm,
    config.microFineAmplitudeCm,
    true,
    false,
  )
  const height = new Int32Array(points * points)
  for (let j = 0; j < points; j += 1) {
    for (let i = 0; i < points; i += 1) {
      const index = j * points + i
      height[index] = Math.floor(
        broad[index]! +
          moraineHeight[index]! +
          drumlinHeight[index]! +
          localHeight[index]! +
          microCoarse[index]! +
          microFine[index]! -
          kettleDepth[index]! -
          valleyDepth[index]!,
      )
    }
  }
  const centres = new Int32Array(cells * cells)
  for (let j = 0; j < cells; j += 1)
    for (let i = 0; i < cells; i += 1)
      centres[j * cells + i] = Math.floor(
        (height[j * points + i]! +
          height[j * points + i + 1]! +
          height[(j + 1) * points + i]! +
          height[(j + 1) * points + i + 1]!) /
          4,
      )
  const ground = new Uint8Array(cells * cells)
  for (let j = 0; j < cells; j += 1)
    for (let i = 0; i < cells; i += 1) {
      const a = height[j * points + i]!
      const b = height[j * points + i + 1]!
      const c = height[(j + 1) * points + i]!
      const d = height[(j + 1) * points + i + 1]!
      const slope = cellSlopePercent(cellCm, a, b, c, d)
      const centre = centres[j * cells + i]!
      const left = centres[j * cells + Math.max(0, i - 1)]!
      const right = centres[j * cells + Math.min(cells - 1, i + 1)]!
      const up = centres[Math.max(0, j - 1) * cells + i]!
      const down = centres[Math.min(cells - 1, j + 1) * cells + i]!
      const curvature = Math.abs(centre - Math.floor((left + right + up + down) / 4))
      let kind: Ground = GRASS
      if (slope >= config.stoneSlopePercent) kind = STONE
      else if (slope >= config.dirtSlopePercent || curvature >= config.dirtCurvatureCm) kind = DIRT
      ground[j * cells + i] = kind
    }
  const water = deriveWater(cells, cellCm, centres, config.riverCatchmentM2, config.riverDepthCm)
  for (let id = 0; id < centres.length; id += 1) {
    if (water.body[id]! >= 0) continue
    const adjacent = cardinalCells(cells, id)
    if (!adjacent.some((next) => water.body[next]! >= 0)) continue
    const bankSlope = adjacent.reduce(
      (slope, next) => Math.max(slope, Math.floor((100 * Math.abs(centres[id]! - water.bed[next]!)) / cellCm)),
      0,
    )
    const curvature = Math.abs(
      centres[id]! - Math.floor(adjacent.reduce((sum, next) => sum + water.bed[next]!, 0) / adjacent.length),
    )
    if (bankSlope >= config.stoneSlopePercent) ground[id] = STONE
    else if (bankSlope >= config.dirtSlopePercent || curvature >= config.dirtCurvatureCm)
      ground[id] = Math.max(ground[id]!, DIRT)
  }
  return {
    water,
    cellCm,
    cells,
    height,
    ground,
    flowDirections,
    flowColumns,
    zones,
    moraines,
    drumlins,
    kames,
    hummocks,
    kettles,
    tunnelValleys,
  }
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
  if (terrain.water.body[j * cells + i]! >= 0) return terrain.water.bed[j * cells + i]!
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
  if (ground === DIRT) return config.dirtTerrainPercent
  if (ground === STONE) return config.stoneTerrainPercent
  return config.grassTerrainPercent
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
