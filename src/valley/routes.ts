import { indexBanks, type BankIndex } from './bankSearch'
import { bankApproach, bankCircleWet, bankSegmentWet, buildBanks, type BankGeometry } from './banks'
import { CellHeap } from './water'
import { cellOf, heightAt, terrainPercentOf, type Ground, type Terrain } from './terrain'
import { distance, distanceSq } from './geometry'
import type { BankMemory, Point, ValleyConfig } from './types'

/** Fixed-point duration, not a second simulation clock. Only wake-up minutes advance state. */
export const TIME_UNITS_PER_MINUTE = 60_000
export interface RouteLattice {
  cellCm: number
  cells: number
  chunkCm: number
  chunkCells: number
  dry: Uint8Array
  edges: Uint8Array
  banks: BankGeometry
  accessBanks: BankMemory[]
  bankChunks: Map<number, BankMemory[]>
  bankIndex: BankIndex
  components: Int32Array
}
export interface Knowledge {
  nodes: Uint8Array
  revision: number
  fullyKnown?: Uint8Array
  banksKnown?: Uint8Array
  views?: Set<string>
}
export type SlopeClass = 0 | 1 | 2
export interface RouteSegment {
  x0: number
  y0: number
  x1: number
  y1: number
  lengthCm: number
  slope: SlopeClass
  uphill: boolean
  ground: Ground
  timeUnits: number
  minutes: number
  kcal: number
  energyPerHour: number
}
export interface Route {
  segments: RouteSegment[]
  minutes: number
  timeUnits: number
  kcal: number
}
const directions = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const
export const nodePoint = (lattice: RouteLattice, id: number): Point => ({
  x: ((id % lattice.cells) + 0.5) * lattice.cellCm,
  y: (Math.floor(id / lattice.cells) + 0.5) * lattice.cellCm,
})
export const chunkOf = (lattice: RouteLattice, point: Point) =>
  Math.floor(point.y / lattice.chunkCm) * lattice.chunkCells + Math.floor(point.x / lattice.chunkCm)

function drySegment(banks: BankGeometry, a: Point, b: Point): boolean {
  if (bankCircleWet(banks, a, 1) || bankCircleWet(banks, b, 1) || bankSegmentWet(banks, a, b)) return false
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    if (bankSegmentWet(banks, { x: a.x + dx!, y: a.y + dy! }, { x: b.x + dx!, y: b.y + dy! })) return false
  return true
}

export function buildLattice(
  config: ValleyConfig,
  terrain: Terrain,
  banks = terrain.water.shore ?? buildBanks(terrain.water, terrain.height),
): RouteLattice {
  const cells = Math.ceil(config.valleySizeCm / config.routeCellCm)
  const lattice: RouteLattice = {
    cellCm: config.routeCellCm,
    cells,
    chunkCm: config.chunkCm,
    chunkCells: Math.floor(config.valleySizeCm / config.chunkCm) + 1,
    dry: new Uint8Array(cells * cells),
    edges: new Uint8Array(cells * cells),
    banks,
    bankIndex: { all: null, bodies: new Map() },
    accessBanks: [],
    bankChunks: new Map(),
    components: new Int32Array(cells * cells).fill(-1),
  }
  for (let id = 0; id < lattice.dry.length; id += 1) {
    const p = nodePoint(lattice, id),
      half = lattice.cellCm / 2
    lattice.dry[id] =
      p.x + half <= config.valleySizeCm && p.y + half <= config.valleySizeCm && !bankCircleWet(banks, p, half) ? 1 : 0
  }
  for (let id = 0; id < lattice.dry.length; id += 1) {
    if (!lattice.dry[id]) continue
    const x = id % cells,
      y = Math.floor(id / cells),
      a = nodePoint(lattice, id)
    for (const [d, [dx, dy]] of directions.entries()) {
      const nx = x + dx,
        ny = y + dy,
        next = ny * cells + nx
      if (nx < 0 || ny < 0 || nx >= cells || ny >= cells || !lattice.dry[next]) continue
      if (dx && dy && (!lattice.dry[y * cells + nx] || !lattice.dry[ny * cells + x])) continue
      if (drySegment(banks, a, nodePoint(lattice, next))) lattice.edges[id] |= 1 << d
    }
  }
  let component = 0
  for (let root = 0; root < lattice.dry.length; root++) {
    if (!lattice.dry[root] || lattice.components[root]! >= 0) continue
    const todo = [root]
    lattice.components[root] = component
    for (let i = 0; i < todo.length; i++) {
      const id = todo[i]!
      for (let d = 0; d < directions.length; d++)
        if (lattice.edges[id]! & (1 << d)) {
          const [dx, dy] = directions[d]!,
            next = id + dy * cells + dx
          if (lattice.components[next]! < 0) {
            lattice.components[next] = component
            todo.push(next)
          }
        }
    }
    component++
  }
  const all = { nodes: lattice.dry, revision: 0 }
  for (const segment of banks.segments.values()) {
    const point = bankApproach(
      banks,
      segment,
      config.reachCm,
      config.drinkBankHeightCm,
      (x, y) => cachedHeight(terrain, x, y),
      terrain.water.bodies[segment.body]!.id,
      0,
    )
    if (!point) continue
    const connectorNode = routeNode(lattice, all, point)
    if (connectorNode < 0) continue
    const bank = { ...point, connectorNode }
    lattice.accessBanks.push(bank)
    const chunk = chunkOf(lattice, bank),
      list = lattice.bankChunks.get(chunk) ?? []
    list.push(bank)
    lattice.bankChunks.set(chunk, list)
  }
  lattice.bankIndex = indexBanks(lattice.accessBanks, terrain)
  return lattice
}

export function slopeClassOf(
  _config: ValleyConfig,
  terrain: Terrain,
  a: Point,
  b: Point,
): { slope: SlopeClass; uphill: boolean } {
  const rise = cachedHeight(terrain, b.x, b.y) - cachedHeight(terrain, a.x, a.y)
  const length = Math.max(1, distance(a.x, a.y, b.x, b.y))
  const slope: SlopeClass = Math.abs(rise) * 100 < length * 10 ? 0 : Math.abs(rise) * 100 <= length * 30 ? 1 : 2
  return { slope, uphill: rise > 0 }
}
function segmentTimeUnits(
  config: ValleyConfig,
  lengthCm: number,
  slope: SlopeClass,
  uphill: boolean,
  ground: Ground,
  speed: number,
) {
  let slowdown = 1_000
  if (slope === 1 && uphill) slowdown = config.moderateSlowdownPerMille
  if (slope === 2) slowdown = uphill ? 2_000 : config.steepDownSlowdownPerMille
  return Math.ceil((lengthCm * terrainPercentOf(config, ground) * slowdown) / (speed * 100))
}
export const segmentMinutes = (
  config: ValleyConfig,
  lengthCm: number,
  slope: SlopeClass,
  uphill: boolean,
  ground: Ground,
  speed: number,
) => Math.ceil(segmentTimeUnits(config, lengthCm, slope, uphill, ground, speed) / TIME_UNITS_PER_MINUTE)
export const segmentEnergyRate = (config: ValleyConfig, slope: SlopeClass, uphill: boolean) =>
  slope && uphill ? Math.floor((config.walkKcalPerHour * (slope === 1 ? 3 : 4)) / 2) : config.walkKcalPerHour
export const segmentKcal = (config: ValleyConfig, minutes: number, slope: SlopeClass, uphill: boolean) =>
  Math.floor((segmentEnergyRate(config, slope, uphill) * minutes) / 60)
export const estimateMinutes = (
  config: ValleyConfig,
  from: Point,
  to: Point,
  speedCmPerMinute: number,
  climbCm: number,
) =>
  Math.ceil(distance(from.x, from.y, to.x, to.y) / speedCmPerMinute) +
  Math.ceil((config.climbMinutesPerMetre * Math.max(0, climbCm)) / 100)

const heightCache = new WeakMap<Terrain, Map<number, number>>()
export function cachedHeight(terrain: Terrain, x: number, y: number) {
  let cache = heightCache.get(terrain)
  if (!cache) {
    cache = new Map()
    heightCache.set(terrain, cache)
  }
  const key = x * (terrain.cells * terrain.cellCm + 1) + y
  let value = cache.get(key)
  if (value === undefined) {
    value = heightAt(terrain, x, y)
    cache.set(key, value)
  }
  return value
}
const connectors = new WeakMap<RouteLattice, Map<string, { ids: number[]; dry: Map<number, boolean> }>>()
/** Geometry is immutable; knowledge filters cached connectors without changing them. */
export function routeNode(
  lattice: RouteLattice,
  knowledge: Knowledge,
  point: Point & { connectorNode?: number },
): number {
  if (point.connectorNode !== undefined) return knowledge.nodes[point.connectorNode] ? point.connectorNode : -1
  const col = Math.floor(point.x / lattice.cellCm),
    row = Math.floor(point.y / lattice.cellCm)
  const centre = row * lattice.cells + col
  if (point.x === (col + 0.5) * lattice.cellCm && point.y === (row + 0.5) * lattice.cellCm && lattice.dry[centre])
    return knowledge.nodes[centre] ? centre : -1
  let cache = connectors.get(lattice)
  if (!cache) {
    cache = new Map()
    connectors.set(lattice, cache)
  }
  const key = `${point.x},${point.y}`
  let record = cache.get(key)
  if (!record) {
    const ids: number[] = []
    for (let y = Math.max(0, row - 1); y <= Math.min(lattice.cells - 1, row + 1); y++)
      for (let x = Math.max(0, col - 1); x <= Math.min(lattice.cells - 1, col + 1); x++)
        if (lattice.dry[y * lattice.cells + x]) ids.push(y * lattice.cells + x)
    ids.sort((a, b) => {
      const pa = nodePoint(lattice, a),
        pb = nodePoint(lattice, b)
      return distanceSq(point.x, point.y, pa.x, pa.y) - distanceSq(point.x, point.y, pb.x, pb.y) || a - b
    })
    record = { ids, dry: new Map() }
    cache.set(key, record)
  }
  for (const id of record.ids) {
    if (!knowledge.nodes[id]) continue
    let dry = record.dry.get(id)
    if (dry === undefined) {
      dry = drySegment(lattice.banks, point, nodePoint(lattice, id))
      record.dry.set(id, dry)
    }
    if (dry) return id
  }
  return -1
}
const searchBuffers = new WeakMap<
  RouteLattice,
  { costs: Float64Array; parents: Int32Array; seen: Uint32Array; closed: Uint32Array; stamp: number }
>()
export function knownRoute(
  lattice: RouteLattice,
  knowledge: Knowledge,
  terrain: Terrain,
  ground: Uint8Array,
  _banks: BankGeometry,
  config: ValleyConfig,
  loadKg: number,
  from: Point,
  to: Point,
): Route | null {
  const first = routeNode(lattice, knowledge, from),
    last = routeNode(lattice, knowledge, to)
  if (first < 0 || last < 0) return null
  if (from.x === to.x && from.y === to.y) return { segments: [], minutes: 0, timeUnits: 0, kcal: 0 }
  let buffers = searchBuffers.get(lattice)
  if (!buffers) {
    const n = lattice.dry.length
    buffers = {
      costs: new Float64Array(n),
      parents: new Int32Array(n),
      seen: new Uint32Array(n),
      closed: new Uint32Array(n),
      stamp: 0,
    }
    searchBuffers.set(lattice, buffers)
  }
  const { costs, parents, seen, closed } = buffers,
    stamp = ++buffers.stamp
  const heap = new CellHeap(),
    n = lattice.cells,
    diagonal = Math.floor(Math.sqrt(2 * lattice.cellCm ** 2))
  const heuristic = (id: number) => {
    const dx = Math.abs((id % n) - (last % n)),
      dy = Math.abs(Math.floor(id / n) - Math.floor(last / n)),
      common = Math.min(dx, dy)
    return common * diagonal + (Math.max(dx, dy) - common) * lattice.cellCm
  }
  costs[first] = 0
  seen[first] = stamp
  heap.push(first, heuristic(first))
  while (heap.length) {
    const id = heap.popId()
    if (closed[id] === stamp) continue
    closed[id] = stamp
    if (id === last) break
    for (const [direction, [dx, dy]] of directions.entries()) {
      if (!(lattice.edges[id]! & (1 << direction))) continue
      const next = id + dy * n + dx
      if (dx && dy && (!knowledge.nodes[id + dx] || !knowledge.nodes[id + dy * n])) continue
      if (!knowledge.nodes[next] || closed[next] === stamp) continue
      const cost = costs[id]! + (dx && dy ? diagonal : lattice.cellCm)
      if (seen[next] !== stamp || cost < costs[next]! || (cost === costs[next] && id < parents[next]!)) {
        costs[next] = cost
        seen[next] = stamp
        parents[next] = id
        heap.push(next, cost + heuristic(next))
      }
    }
  }
  if (closed[last] !== stamp) return null
  const nodes = [last]
  while (nodes[nodes.length - 1] !== first) nodes.push(parents[nodes[nodes.length - 1]!]!)
  nodes.reverse()
  const points = [from, ...nodes.map((id) => nodePoint(lattice, id)), to]
  const speed = Math.max(
    1,
    Math.floor(
      (config.walkCmPerSecond * (1_000 * config.bodyKg - config.loadSlowdownPerMille * loadKg)) /
        (1_000 * config.bodyKg),
    ),
  )
  const segments: RouteSegment[] = []
  let timeUnits = 0,
    energy = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!,
      b = points[i]!,
      lengthCm = distance(a.x, a.y, b.x, b.y)
    if (!lengthCm) continue
    const { slope, uphill } = slopeClassOf(config, terrain, a, b)
    const groundClass = ground[cellOf(terrain, a.x, a.y)]! as Ground
    const duration = segmentTimeUnits(config, lengthCm, slope, uphill, groundClass, speed)
    const energyPerHour = segmentEnergyRate(config, slope, uphill)
    segments.push({
      x0: a.x,
      y0: a.y,
      x1: b.x,
      y1: b.y,
      lengthCm,
      slope,
      uphill,
      ground: groundClass,
      timeUnits: duration,
      minutes: duration / TIME_UNITS_PER_MINUTE,
      energyPerHour,
      kcal: Math.floor((energyPerHour * duration) / (60 * TIME_UNITS_PER_MINUTE)),
    })
    timeUnits += duration
    energy += energyPerHour * duration
  }
  return {
    segments,
    timeUnits,
    minutes: Math.ceil(timeUnits / TIME_UNITS_PER_MINUTE),
    kcal: Math.floor(energy / (60 * TIME_UNITS_PER_MINUTE)),
  }
}
export function positionAlong(route: Route, elapsedMinutes: number): Point {
  const first = route.segments[0],
    last = route.segments.at(-1)
  if (!first || !last) throw new Error('An empty route has no position')
  let left = Math.max(0, elapsedMinutes) * TIME_UNITS_PER_MINUTE
  for (const segment of route.segments) {
    if (left <= segment.timeUnits) {
      const t = left / segment.timeUnits
      return {
        x: Math.round(segment.x0 + t * (segment.x1 - segment.x0)),
        y: Math.round(segment.y0 + t * (segment.y1 - segment.y0)),
      }
    }
    left -= segment.timeUnits
  }
  return { x: last.x1, y: last.y1 }
}
const frontierCache = new WeakMap<Knowledge, Map<string, Point | null>>()
export function nearestFrontier(lattice: RouteLattice, knowledge: Knowledge, from: Point): Point | null {
  let cache = frontierCache.get(knowledge)
  if (!cache) {
    cache = new Map()
    frontierCache.set(knowledge, cache)
  }
  const key = `${from.x},${from.y}:${knowledge.revision}`
  if (cache.has(key)) return cache.get(key)!
  const first = routeNode(lattice, knowledge, from)
  if (first < 0) return null
  const seen = new Uint8Array(lattice.dry.length),
    pending = [first]
  let best = -1,
    bestSq = Infinity
  seen[first] = 1
  for (let index = 0; index < pending.length; index += 1) {
    const id = pending[index]!,
      x = id % lattice.cells,
      y = Math.floor(id / lattice.cells)
    let frontier = false
    for (const [direction, [dx, dy]] of directions.entries()) {
      const nx = x + dx,
        ny = y + dy,
        next = ny * lattice.cells + nx
      if (nx < 0 || ny < 0 || nx >= lattice.cells || ny >= lattice.cells) continue
      if (!knowledge.nodes[next]) frontier = true
      if (dx && dy && (!knowledge.nodes[id + dx] || !knowledge.nodes[id + dy * lattice.cells])) continue
      if (lattice.edges[id]! & (1 << direction) && knowledge.nodes[next] && !seen[next]) {
        seen[next] = 1
        pending.push(next)
      }
    }
    if (frontier) {
      const p = nodePoint(lattice, id),
        sq = distanceSq(p.x, p.y, from.x, from.y)
      if (sq > 0 && (sq < bestSq || (sq === bestSq && id < best))) {
        bestSq = sq
        best = id
      }
    }
  }
  const result = best < 0 ? null : nodePoint(lattice, best)
  cache.set(key, result)
  return result
}
