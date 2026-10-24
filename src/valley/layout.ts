import { buildNav, circleWalkable, meshSettings, onWalkableGround, walkableTriangle } from './routes'
import { buildPlaces } from './places'
import { meshOf, type GroundMesh } from './mesh'
import { mixSeed, normalizeSeed, randomInt } from '../sim/rng'
import { ringOffset } from './config'
import { distanceSq } from './geometry'
import { DIRT, GRASS, STONE, cellOf, terrainOf, type Terrain } from './terrain'
import type { PlantIndex, Plants, Point, ValleyConfig, ValleyLayout } from './types'

const LAYOUT_STREAM_SALT = 0x5641_4c4c
const SKILL_STREAM_SALT = 0x534b_494c
const START_STREAM_SALT = 0x5354_5254
const CRAFT_STREAM_SALT = 0x4352_4146
const AXE_STREAM_SALT = 0x4158_4553

/** A site or plant that has not found a place after this many draws makes the layout impossible. */
export const PLACEMENT_DRAWS = 10_000

export const deriveLayoutSeed = (seed: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ LAYOUT_STREAM_SALT) >>> 0))

export const deriveStartSeed = (seed: number, foragerId = 0) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ START_STREAM_SALT ^ mixSeed(foragerId + 1)) >>> 0))

export const deriveSkillSeed = (seed: number) => normalizeSeed(mixSeed((normalizeSeed(seed) ^ SKILL_STREAM_SALT) >>> 0))

export const deriveCraftSeed = (seed: number) => normalizeSeed(mixSeed((normalizeSeed(seed) ^ CRAFT_STREAM_SALT) >>> 0))

/** The axe stream for one forager and minute, which draws the quality of an axe it finishes then. */
export const deriveAxeSeed = (seed: number, minute: number, foragerId: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ AXE_STREAM_SALT ^ mixSeed(minute * 1_024 + foragerId)) >>> 0))

/** Every forager's born skills, by ID: its foraging skill, then its wood skill, from the skill stream. */
export function drawSkills(config: ValleyConfig): { foragingSkill: number; woodSkill: number }[] {
  const span = config.skillMaxPercent - config.skillMinPercent + 1
  let state = deriveSkillSeed(config.seed)
  const skills = []
  for (let id = 0; id < config.founders; id += 1) {
    const forage = randomInt(state, span)
    const wood = randomInt(forage.state, span)
    state = wood.state
    skills.push({
      foragingSkill: config.skillMinPercent + forage.value,
      woodSkill: config.skillMinPercent + wood.value,
    })
  }
  return skills
}

/** Every forager's born craft skill, by ID, from a stream of its own so the other skills are drawn as before. */
export function drawCraftSkills(config: ValleyConfig): number[] {
  const span = config.craftSkillMaxPercent - config.craftSkillMinPercent + 1
  let state = deriveCraftSeed(config.seed)
  const skills = []
  for (let id = 0; id < config.founders; id += 1) {
    const draw = randomInt(state, span)
    state = draw.state
    skills.push(config.craftSkillMinPercent + draw.value)
  }
  return skills
}

export class LayoutError extends Error {}

/** Draws whole centimetres from the layout stream, in order. */
class Draws {
  constructor(private state: number) {}
  int(maximumExclusive: number) {
    const draw = randomInt(this.state, maximumExclusive)
    this.state = draw.state
    return draw.value
  }
}

/**
 * Scattered starts, from a stream of their own so the plants stand where they would without them: points drawn
 * uniformly over the square `startAreaCm` wide round the land's centre in forager ID order, each at least
 * `startSpacingCm` from the earlier ones and always on grass or dirt.
 */
export function drawStarts(config: ValleyConfig, ground: Uint8Array = terrainOf(config).ground): Point[] {
  let draws = new Draws(deriveStartSeed(config.seed, 0))
  const terrain = terrainOf(config),
    mesh = meshOf(terrain, meshSettings(config))
  const origin = Math.floor((config.valleySizeCm - config.startAreaCm) / 2)
  const starts: Point[] = []
  let failed = 0
  while (starts.length < config.founders) {
    const x = origin + draws.int(config.startAreaCm + 1)
    const y = origin + draws.int(config.startAreaCm + 1)
    const habitable = circleOnGround(terrain, mesh, ground, x, y, 40, BUSH_GROUNDS)
    const connected = onMainLand(mesh, { x, y })
    if (
      habitable &&
      connected &&
      starts.every((other) => distanceSq(x, y, other.x, other.y) >= config.startSpacingCm ** 2)
    ) {
      starts.push({ x, y })
      draws = new Draws(deriveStartSeed(config.seed, starts.length))
      failed = 0
    } else if ((failed += 1) >= PLACEMENT_DRAWS) throw new LayoutError('The foragers’ starts cannot all be placed')
  }
  return starts
}

/** The grounds a kind of site and its plants grow on, as one bit for each ground. */
const grows = (...grounds: number[]) => grounds.reduce((bits, ground) => bits | (1 << ground), 0)
export const BUSH_GROUNDS = grows(GRASS, DIRT)
export const HAZEL_GROUNDS = grows(GRASS, DIRT)
export const TREE_GROUNDS = grows(GRASS, DIRT)
export const OUTCROP_GROUNDS = grows(GRASS, DIRT, STONE)

/** Whether a point stands in the mesh's largest walkable region. */
export const onMainLand = (mesh: GroundMesh, p: Point) => {
  const t = walkableTriangle(mesh, null, p)
  return t >= 0 && mesh.region[t] === mesh.mainRegion
}
/** Whether a point is on walkable ground of the mesh and its terrain cell's ground is one of `grounds`. */
export const onGround = (
  terrain: Terrain,
  mesh: GroundMesh,
  ground: Uint8Array,
  x: number,
  y: number,
  grounds: number,
) => onWalkableGround(mesh, { x, y }) && ((grounds >> ground[cellOf(terrain, x, y)]!) & 1) === 1

/** Whether the cell holding a point, and every cell whose centre lies within `radius` of it, is one of `grounds`. */
export function circleOnGround(
  terrain: Terrain,
  mesh: GroundMesh,
  ground: Uint8Array,
  x: number,
  y: number,
  radius: number,
  grounds: number,
) {
  const size = terrain.cells * terrain.cellCm
  if (x - radius < 0 || y - radius < 0 || x + radius > size || y + radius > size) return false
  if (!onGround(terrain, mesh, ground, x, y, grounds) || !circleWalkable(mesh, { x, y }, radius)) return false
  const { cellCm, cells } = terrain
  const i0 = Math.max(0, Math.floor((x - radius) / cellCm))
  const i1 = Math.min(cells - 1, Math.floor((x + radius) / cellCm))
  const j0 = Math.max(0, Math.floor((y - radius) / cellCm))
  const j1 = Math.min(cells - 1, Math.floor((y + radius) / cellCm))
  for (let j = j0; j <= j1; j += 1)
    for (let i = i0; i <= i1; i += 1)
      if (
        distanceSq(
          Math.max(i * cellCm, Math.min((i + 1) * cellCm, x)),
          Math.max(j * cellCm, Math.min((j + 1) * cellCm, y)),
          x,
          y,
        ) <=
        radius * radius
      )
        if (((grounds >> ground[j * cells + i]!) & 1) === 0) return false
  return true
}

/** Two kinds of plant as one list, the first by ID then the second, each keeping its site. */
export function joinPlants(first: Plants, second: Plants): Plants {
  const count = first.count + second.count
  const plants: Plants = { count, x: new Int32Array(count), y: new Int32Array(count), site: new Int32Array(count) }
  plants.x.set(first.x)
  plants.x.set(second.x, first.count)
  plants.y.set(first.y)
  plants.y.set(second.y, first.count)
  plants.site.set(first.site)
  plants.site.set(second.site, first.count)
  return plants
}

/** Every plant that holds wood: the trees, then the bushes, in ID order, each keeping its site. */
export const woodPlantsOf = (trees: Plants, bushes: Plants) => joinPlants(trees, bushes)

/** Every plant that holds food: the bushes, then the hazels, in ID order, each keeping its site. */
export const foodPlantsOf = (bushes: Plants, hazels: Plants) => joinPlants(bushes, hazels)
function plantsOf(sites: readonly Point[][]): Plants {
  const count = sites.reduce((sum, site) => sum + site.length, 0)
  const plants: Plants = { count, x: new Int32Array(count), y: new Int32Array(count), site: new Int32Array(count) }
  let id = 0
  for (const [site, points] of sites.entries()) {
    for (const point of points) {
      plants.x[id] = point.x
      plants.y[id] = point.y
      plants.site[id] = site
      id += 1
    }
  }
  return plants
}

/** An index of the plants with IDs from `from` up to, not including, `to`; by default every plant. */
export function buildIndex(
  plants: Pick<Plants, 'count' | 'x' | 'y'>,
  cellCm: number,
  valleySizeCm: number,
  from = 0,
  to = plants.count,
): PlantIndex {
  const cells = Math.floor(valleySizeCm / cellCm) + 1
  const lists: number[][] = Array.from({ length: cells * cells }, () => [])
  for (let id = from; id < to; id += 1)
    lists[Math.floor(plants.y[id]! / cellCm) * cells + Math.floor(plants.x[id]! / cellCm)]!.push(id)
  return { cellCm, cells, buckets: lists.map((list) => Int32Array.from(list)) }
}

/**
 * The valley's layout: site centres, then each thicket's bushes, each hazel thicket's hazels, each stand's trees and each outcrop's stone spots,
 * then the starting hearths: scattered, or on the rings round the camp for a band that starts as one group. Throws if
 * a site, plant, stone spot or start cannot be placed.
 */
export function generateLayout(config: ValleyConfig): ValleyLayout {
  const draws = new Draws(deriveLayoutSeed(config.seed))
  const terrain = terrainOf(config)
  const mesh = meshOf(terrain, meshSettings(config))
  const base = terrain.ground
  const size = config.valleySizeCm
  let camp = { x: Math.floor(size / 2), y: Math.floor(size / 2) }
  if (!config.scattered) {
    const candidates = Array.from({ length: terrain.cells ** 2 }, (_, id) => id)
    const point = (id: number) => ({
      x: (id % terrain.cells) * terrain.cellCm + terrain.cellCm / 2,
      y: Math.floor(id / terrain.cells) * terrain.cellCm + terrain.cellCm / 2,
    })
    candidates.sort((a, b) => {
      const pa = point(a)
      const pb = point(b)
      return distanceSq(pa.x, pa.y, camp.x, camp.y) - distanceSq(pb.x, pb.y, camp.x, camp.y) || a - b
    })
    const valid = candidates.find((id) => {
      const p = point(id)
      return (
        onMainLand(mesh, p) &&
        circleOnGround(
          terrain,
          mesh,
          base,
          p.x,
          p.y,
          config.hutRingCm * Math.ceil(Math.sqrt(config.founders)) + 200,
          BUSH_GROUNDS,
        )
      )
    })
    if (valid === undefined) throw new LayoutError('No dry camp with room for the initial hearth slots')
    camp = point(valid)
  }
  const centres: Point[] = []
  const span = size - 2 * config.siteMarginCm + 1
  let failed = 0
  const kinds = [config.thicketCount, config.hazelThicketCount, config.standCount, config.outcropCount]
  const kindGrounds = [BUSH_GROUNDS, HAZEL_GROUNDS, TREE_GROUNDS, OUTCROP_GROUNDS]
  const total = kinds.reduce((sum, count) => sum + count, 0)
  const kindRadii = [config.thicketRadiusCm, config.hazelThicketRadiusCm, config.standRadiusCm, config.outcropRadiusCm]
  /** Whether every cell whose centre lies within the next site's radius of a point is ground its kind grows on. */
  const groundFitsNext = (x: number, y: number) => {
    let index = centres.length
    let kind = 0
    while (kind < kinds.length - 1 && index >= kinds[kind]!) index -= kinds[kind++]!
    return circleOnGround(terrain, mesh, base, x, y, kindRadii[kind]!, kindGrounds[kind]!)
  }
  // A grid of cells `siteSpacingCm` wide holds every earlier centre too close to a draw in the nine cells round it.
  const spacing = config.siteSpacingCm
  const gridCells = Math.floor(size / spacing) + 1
  const grid: Point[][] = Array.from({ length: gridCells * gridCells }, () => [])
  const clearOfOthers = (x: number, y: number) => {
    const gx = Math.floor(x / spacing)
    const gy = Math.floor(y / spacing)
    for (let row = Math.max(0, gy - 1); row <= Math.min(gridCells - 1, gy + 1); row += 1)
      for (let column = Math.max(0, gx - 1); column <= Math.min(gridCells - 1, gx + 1); column += 1)
        for (const other of grid[row * gridCells + column]!)
          if (distanceSq(x, y, other.x, other.y) < spacing ** 2) return false
    return true
  }
  while (centres.length < total) {
    const x = config.siteMarginCm + draws.int(span)
    const y = config.siteMarginCm + draws.int(span)
    const fits =
      distanceSq(x, y, camp.x, camp.y) >= config.campClearingCm ** 2 && groundFitsNext(x, y) && clearOfOthers(x, y)
    if (fits) {
      centres.push({ x, y })
      grid[Math.floor(y / spacing) * gridCells + Math.floor(x / spacing)]!.push({ x, y })
      failed = 0
    } else if ((failed += 1) >= PLACEMENT_DRAWS)
      throw new LayoutError('The thickets, hazel thickets, stands and outcrops cannot all be placed')
  }
  let next = 0
  const [thickets, hazelThickets, stands, outcrops] = kinds.map((count) => centres.slice(next, (next += count)))
  if (!thickets || !hazelThickets || !stands || !outcrops) throw new Error('Every kind of site has centres')
  const bushSites = thickets.map((centre) => [centre])
  const hazelSites = hazelThickets.map((centre) => [centre])
  const treeSites = stands.map((centre) => [centre])
  const stoneSites = outcrops.map((centre) => [centre])
  const ground = base.slice()
  const half = Math.floor(terrain.cellCm / 2)
  for (const centre of outcrops) {
    const r = config.outcropRadiusCm
    const i0 = Math.max(0, Math.floor((centre.x - r) / terrain.cellCm))
    const i1 = Math.min(terrain.cells - 1, Math.floor((centre.x + r) / terrain.cellCm))
    const j0 = Math.max(0, Math.floor((centre.y - r) / terrain.cellCm))
    const j1 = Math.min(terrain.cells - 1, Math.floor((centre.y + r) / terrain.cellCm))
    for (let j = j0; j <= j1; j += 1)
      for (let i = i0; i <= i1; i += 1)
        if (distanceSq(i * terrain.cellCm + half, j * terrain.cellCm + half, centre.x, centre.y) <= r * r)
          ground[j * terrain.cells + i] = STONE
  }
  // A stone near the edge of its outcrop may lie in a cell whose centre is outside it; that cell is stone too.
  for (const points of stoneSites) for (const stone of points) ground[cellOf(terrain, stone.x, stone.y)] = STONE
  // A band configured to begin together has already cleared and worked its camp ring. Do this only after all natural
  // sites have been placed, so the clearing cannot move a site or alter any scattered-start layout.
  if (!config.scattered)
    for (let j = 0; j < terrain.cells; j += 1)
      for (let i = 0; i < terrain.cells; i += 1) {
        const index = j * terrain.cells + i
        if (
          ground[index] === STONE &&
          !stoneSites.some((spots) => spots.some((stone) => cellOf(terrain, stone.x, stone.y) === index)) &&
          distanceSq(
            i * terrain.cellCm + terrain.cellCm / 2,
            j * terrain.cellCm + terrain.cellCm / 2,
            camp.x,
            camp.y,
          ) <=
            config.campClearingCm ** 2
        )
          ground[index] = DIRT
      }
  const bushes = plantsOf(bushSites)
  const hazels = plantsOf(hazelSites)
  const foodPlants = foodPlantsOf(bushes, hazels)
  const trees = plantsOf(treeSites)
  const stones = plantsOf(stoneSites)
  const woodPlants = woodPlantsOf(trees, bushes)
  const nav = buildNav(config, terrain, ground)
  const hearths = config.scattered
    ? drawStarts(config, ground)
    : Array.from({ length: config.founders }, (_, slot) => {
        const offset = ringOffset(config, slot)
        return { x: camp.x + offset.x, y: camp.y + offset.y }
      })
  const sitePoints = plantsOf([...thickets, ...hazelThickets, ...stands, ...outcrops].map((centre) => [centre]))
  const places = buildPlaces(config, [thickets, hazelThickets, stands, outcrops])
  const placeIndex = buildIndex(places, config.chunkCm, size)
  return {
    places,
    nav,
    placeIndex,
    placeChunks: placeIndex.buckets,
    camp,
    terrain,
    ground,
    sitePoints,
    siteIndex: buildIndex(sitePoints, config.perceptionRadiusCm, size),
    foodChunks: buildIndex(foodPlants, config.chunkCm, size),
    woodChunks: buildIndex(woodPlants, config.chunkCm, size),
    treeChunks: buildIndex(trees, config.chunkCm, size),
    stoneChunks: buildIndex(stones, config.chunkCm, size),
    thickets,
    hazelThickets,
    stands,
    outcrops,
    bushes,
    hazels,
    foodPlants,
    trees,
    stones,
    woodPlants,
    hearths,
    bushIndex: buildIndex(foodPlants, config.perceptionRadiusCm, size, 0, bushes.count),
    hazelIndex: buildIndex(foodPlants, config.perceptionRadiusCm, size, bushes.count),
    foodIndex: buildIndex(foodPlants, config.perceptionRadiusCm, size),
    treeIndex: buildIndex(trees, config.perceptionRadiusCm, size),
    woodIndex: buildIndex(woodPlants, config.perceptionRadiusCm, size),
    stoneIndex: buildIndex(stones, config.perceptionRadiusCm, size),
  }
}

/** The reason a configuration's layout cannot be drawn, or null if it can. */
export function layoutError(config: ValleyConfig) {
  try {
    generateLayout(config)
    return null
  } catch (error) {
    if (error instanceof LayoutError) return error.message
    throw error
  }
}

/** Calls `visit` with every plant within `radius` of a point, cell by cell. */
export function forEachPlantWithin(
  index: PlantIndex,
  plants: Plants,
  x: number,
  y: number,
  radius: number,
  visit: (id: number) => void,
) {
  const { cellCm, cells } = index
  const x0 = Math.max(0, Math.floor((x - radius) / cellCm))
  const x1 = Math.min(cells - 1, Math.floor((x + radius) / cellCm))
  const y0 = Math.max(0, Math.floor((y - radius) / cellCm))
  const y1 = Math.min(cells - 1, Math.floor((y + radius) / cellCm))
  const r2 = radius * radius
  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) {
      for (const id of index.buckets[cy * cells + cx]!) {
        if (distanceSq(plants.x[id]!, plants.y[id]!, x, y) <= r2) visit(id)
      }
    }
  }
}

/**
 * The nearest plant to a point that passes `accept`, ties to the lowest ID, or null. It searches rings of cells
 * outwards and stops once no nearer plant can remain.
 */
export function nearestPlant(
  index: PlantIndex,
  plants: Plants,
  x: number,
  y: number,
  accept: (id: number) => boolean,
  range = Infinity,
): number | null {
  let best: number | null = null
  let bestSq = Infinity
  const consider = (id: number) => {
    const sq = distanceSq(plants.x[id]!, plants.y[id]!, x, y)
    if ((sq < bestSq || (sq === bestSq && id < best!)) && sq <= range * range && accept(id)) {
      best = id
      bestSq = sq
    }
  }
  forEachRingOutwards(index, x, y, (floor) => floor <= range && floor * floor <= bestSq, consider)
  return best
}

/**
 * Visits every plant in an index ring by ring of cells outwards from the cell holding a point, while `goOn` allows the
 * next ring, given the least distance from the point to any plant in it: every plant in ring `ring` lies at least
 * `(ring − 1) · cellCm` away.
 */
export function forEachRingOutwards(
  index: PlantIndex,
  x: number,
  y: number,
  goOn: (floor: number) => boolean,
  visit: (id: number) => void,
) {
  const { cellCm, cells, buckets } = index
  const cx = Math.min(cells - 1, Math.max(0, Math.floor(x / cellCm)))
  const cy = Math.min(cells - 1, Math.max(0, Math.floor(y / cellCm)))
  const rings = Math.max(cx, cy, cells - 1 - cx, cells - 1 - cy)
  for (let ring = 0; ring <= rings; ring += 1) {
    if (!goOn(Math.max(0, (ring - 1) * cellCm))) break
    for (let row = cy - ring; row <= cy + ring; row += 1) {
      if (row < 0 || row >= cells) continue
      const edge = row === cy - ring || row === cy + ring
      for (let column = cx - ring; column <= cx + ring; column += edge ? 1 : 2 * ring) {
        if (column >= 0 && column < cells) for (const id of buckets[row * cells + column]!) visit(id)
        if (ring === 0) break
      }
    }
  }
}
