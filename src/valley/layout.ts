import { mixSeed, normalizeSeed, randomInt } from '../sim/rng'
import { spiralOffsets } from './config'
import { distanceSq } from './geometry'
import type { PlantIndex, Plants, Point, ValleyConfig, ValleyLayout } from './types'

const LAYOUT_STREAM_SALT = 0x5641_4c4c
const SKILL_STREAM_SALT = 0x534b_494c
const TURN_ORDER_STREAM_SALT = 0x5455_524e
const START_STREAM_SALT = 0x5354_5254

/** A site or plant that has not found a place after this many draws makes the layout impossible. */
export const PLACEMENT_DRAWS = 10_000

export const deriveLayoutSeed = (seed: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ LAYOUT_STREAM_SALT) >>> 0))

export const deriveStartSeed = (seed: number) => normalizeSeed(mixSeed((normalizeSeed(seed) ^ START_STREAM_SALT) >>> 0))

export const deriveSkillSeed = (seed: number) => normalizeSeed(mixSeed((normalizeSeed(seed) ^ SKILL_STREAM_SALT) >>> 0))

/** The turn order of minute `minute`, from a stream of its own, so any minute's order stands alone. */
export const deriveTurnOrderSeed = (seed: number, minute: number) =>
  normalizeSeed(mixSeed((normalizeSeed(seed) ^ TURN_ORDER_STREAM_SALT ^ mixSeed(minute)) >>> 0))

/**
 * A seeded shuffle of the band's IDs, draw for draw the shuffle `seededShuffle` makes with `randomInt`, written out so
 * that a minute's order allocates nothing but the order itself.
 */
export function turnOrder(seed: number, minute: number, bandSize: number) {
  const order: number[] = []
  for (let id = 0; id < bandSize; id += 1) order.push(id)
  let state = deriveTurnOrderSeed(seed, minute)
  for (let index = order.length - 1; index > 0; index -= 1) {
    state = normalizeSeed(state)
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    const selected = Math.floor((state / 0x1_0000_0000) * (index + 1))
    const swap = order[index]!
    order[index] = order[selected]!
    order[selected] = swap
  }
  return order
}

/** Every forager's born skills, by ID: its foraging skill, then its wood skill, from the skill stream. */
export function drawSkills(config: ValleyConfig): { foragingSkill: number; woodSkill: number }[] {
  const span = config.skillMaxPercent - config.skillMinPercent + 1
  let state = deriveSkillSeed(config.seed)
  const skills = []
  for (let id = 0; id < config.bandSize; id += 1) {
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

class LayoutError extends Error {}

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
 * Scattered starts, from a stream of their own so the plants stand where Life 5 put them: points drawn uniformly over
 * the valley in forager ID order, each at least `startSpacingCm` from the earlier ones.
 */
export function drawStarts(config: ValleyConfig): Point[] {
  const draws = new Draws(deriveStartSeed(config.seed))
  const starts: Point[] = []
  let failed = 0
  while (starts.length < config.bandSize) {
    const x = draws.int(config.valleySizeCm + 1)
    const y = draws.int(config.valleySizeCm + 1)
    if (starts.every((other) => distanceSq(x, y, other.x, other.y) >= config.startSpacingCm ** 2)) {
      starts.push({ x, y })
      failed = 0
    } else if ((failed += 1) >= PLACEMENT_DRAWS) throw new LayoutError('The foragers’ starts cannot all be placed')
  }
  return starts
}

/** Plants drawn uniformly in the square around `centre`, kept within `radius` and `spacing` from the site's others. */
function scatter(draws: Draws, count: number, centre: Point, radius: number, spacing: number, what: string) {
  const placed: Point[] = []
  let failed = 0
  while (placed.length < count) {
    const x = centre.x + draws.int(2 * radius + 1) - radius
    const y = centre.y + draws.int(2 * radius + 1) - radius
    const fits =
      distanceSq(x, y, centre.x, centre.y) <= radius * radius &&
      placed.every((other) => distanceSq(x, y, other.x, other.y) >= spacing * spacing)
    if (fits) {
      placed.push({ x, y })
      failed = 0
    } else if ((failed += 1) >= PLACEMENT_DRAWS) throw new LayoutError(`${what} cannot all be placed`)
  }
  return placed
}

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

export function buildIndex(plants: Plants, cellCm: number, valleySizeCm: number): PlantIndex {
  const cells = Math.floor(valleySizeCm / cellCm) + 1
  const lists: number[][] = Array.from({ length: cells * cells }, () => [])
  for (let id = 0; id < plants.count; id += 1)
    lists[Math.floor(plants.y[id]! / cellCm) * cells + Math.floor(plants.x[id]! / cellCm)]!.push(id)
  return { cellCm, cells, buckets: lists.map((list) => Int32Array.from(list)) }
}

/**
 * The layout of the [specification](../../docs/LIFE5_SPEC.md#layout): site centres, then each thicket's bushes and
 * each stand's trees, then the starting hearths: scattered (Life 6) or on a spiral around the camp (Life 5). Throws if a
 * site, plant or start cannot be placed.
 */
export function generateLayout(config: ValleyConfig): ValleyLayout {
  const draws = new Draws(deriveLayoutSeed(config.seed))
  const size = config.valleySizeCm
  const camp = { x: Math.floor(size / 2), y: Math.floor(size / 2) }
  const centres: Point[] = []
  const span = size - 2 * config.siteMarginCm + 1
  let failed = 0
  while (centres.length < config.thicketCount + config.standCount) {
    const x = config.siteMarginCm + draws.int(span)
    const y = config.siteMarginCm + draws.int(span)
    const fits =
      distanceSq(x, y, camp.x, camp.y) >= config.campClearingCm ** 2 &&
      centres.every((other) => distanceSq(x, y, other.x, other.y) >= config.siteSpacingCm ** 2)
    if (fits) {
      centres.push({ x, y })
      failed = 0
    } else if ((failed += 1) >= PLACEMENT_DRAWS) throw new LayoutError('The thickets and stands cannot all be placed')
  }
  const thickets = centres.slice(0, config.thicketCount)
  const stands = centres.slice(config.thicketCount)
  const bushSites = thickets.map((centre, id) =>
    scatter(
      draws,
      config.bushesPerThicket,
      centre,
      config.thicketRadiusCm,
      config.bushSpacingCm,
      `Thicket ${id}'s bushes`,
    ),
  )
  const treeSites = stands.map((centre, id) =>
    scatter(draws, config.treesPerStand, centre, config.standRadiusCm, config.treeSpacingCm, `Stand ${id}'s trees`),
  )
  const bushes = plantsOf(bushSites)
  const trees = plantsOf(treeSites)
  const hearths = config.scattered
    ? drawStarts(config)
    : spiralOffsets(config.bandSize).map(([x, y]) => ({
        x: camp.x + x * config.hearthSpacingCm,
        y: camp.y + y * config.hearthSpacingCm,
      }))
  return {
    camp,
    thickets,
    stands,
    bushes,
    trees,
    hearths,
    bushIndex: buildIndex(bushes, config.perceptionRadiusCm, size),
    treeIndex: buildIndex(trees, config.perceptionRadiusCm, size),
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
): number | null {
  const { cellCm, cells } = index
  const cx = Math.min(cells - 1, Math.max(0, Math.floor(x / cellCm)))
  const cy = Math.min(cells - 1, Math.max(0, Math.floor(y / cellCm)))
  let best: number | null = null
  let bestSq = Infinity
  const consider = (cell: number) => {
    for (const id of index.buckets[cell]!) {
      const sq = distanceSq(plants.x[id]!, plants.y[id]!, x, y)
      if ((sq < bestSq || (sq === bestSq && id < best!)) && accept(id)) {
        best = id
        bestSq = sq
      }
    }
  }
  for (let ring = 0; ring < cells; ring += 1) {
    // Every plant in ring `ring` lies at least `(ring − 1) · cellCm` away.
    const floor = Math.max(0, (ring - 1) * cellCm)
    if (floor * floor > bestSq) break
    for (let row = cy - ring; row <= cy + ring; row += 1) {
      if (row < 0 || row >= cells) continue
      const edge = row === cy - ring || row === cy + ring
      for (let column = cx - ring; column <= cx + ring; column += edge ? 1 : 2 * ring) {
        if (column >= 0 && column < cells) consider(row * cells + column)
        if (ring === 0) break
      }
    }
  }
  return best
}
