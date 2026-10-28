import { indexBanks, type BankIndex } from './bankSearch'
import { CellHeap } from './water'
import { terrainPercentOf, type Ground, type Terrain } from './terrain'
import { distance, distanceSq } from './geometry'
import { GROUND_AREA, meshOf, planeHeight, triangleAt, type GroundMesh } from './mesh'
import type { BankMemory, Point, ValleyConfig } from './types'

/** Fixed-point duration, not a second simulation clock. Only wake-up minutes advance state. */
export const TIME_UNITS_PER_MINUTE = 60_000
/** The mesh as people walk it: the layout's ground classes per triangle and the bank points along its shores. */
export interface NavMap {
  mesh: GroundMesh
  chunkCm: number
  chunkCells: number
  /** Ground class of each triangle, from the layout's ground, outcrops included, at its centroid. */
  ground: Uint8Array
  accessBanks: BankMemory[]
  bankChunks: Map<number, BankMemory[]>
  bankIndex: BankIndex
  links: ChunkLinks
}
/**
 * The walkable edges between triangles of different chunks: for chunk `c`, its neighbours are
 * `chunk[start[c]..start[c+1])`, and the triangle pairs crossing to neighbour `k` are `pairs[2j], pairs[2j+1]` for
 * `j` in `pairStart[k]..pairStart[k+1]`, the first in `c`.
 */
export interface ChunkLinks {
  start: Int32Array
  chunk: Int32Array
  pairStart: Int32Array
  pairs: Int32Array
}
/** Triangles seen, one bit each; chunks seen whole; chunks whose bank points are all known. */
export interface Knowledge {
  triangles: Uint8Array
  revision: number
  fullyKnown?: Uint8Array
  banksKnown?: Uint8Array
}
export const knowledgeBytes = (mesh: GroundMesh) => (mesh.triangles + 7) >> 3
export const knows = (knowledge: Knowledge, t: number) => (knowledge.triangles[t >> 3]! >> (t & 7)) & 1
export function learnTriangle(knowledge: Knowledge, t: number) {
  knowledge.triangles[t >> 3]! |= 1 << (t & 7)
}
export type SlopeClass = 0 | 1 | 2
export interface RouteSegment {
  x0: number
  y0: number
  x1: number
  y1: number
  /** The flat triangle this piece lies in. */
  triangle: number
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
export const chunkOf = (nav: NavMap, point: Point) =>
  Math.floor(point.y / nav.chunkCm) * nav.chunkCells + Math.floor(point.x / nav.chunkCm)

export const meshSettings = (config: ValleyConfig) => ({
  valleySizeCm: config.valleySizeCm,
  meshMaxEdgeCm: config.meshMaxEdgeCm,
  meshHeightToleranceCm: config.meshHeightToleranceCm,
  shoreToleranceCm: config.shoreToleranceCm,
  chunkCm: config.chunkCm,
})

const crossXY = (ax: number, ay: number, bx: number, by: number, x: number, y: number) =>
  (bx - ax) * (y - ay) - (by - ay) * (x - ax)
function segmentDistanceSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay,
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
}
/** Zero inside the closed triangle, else the squared distance to its nearest edge. */
export function triangleDistanceSq(mesh: GroundMesh, t: number, x: number, y: number) {
  const { tv, vx, vy } = mesh
  let inside = true,
    best = Infinity
  for (let e = 0; e < 3; e++) {
    const a = tv[3 * t + e]!,
      b = tv[3 * t + ((e + 1) % 3)]!
    if (crossXY(vx[a]!, vy[a]!, vx[b]!, vy[b]!, x, y) < 0) inside = false
    best = Math.min(best, segmentDistanceSq(x, y, vx[a]!, vy[a]!, vx[b]!, vy[b]!))
  }
  return inside ? 0 : best
}
/** People are points rounded to whole centimetres, so a point within this of a walkable triangle stands on it. */
export const NEAR_CM = 1
/**
 * The lowest-numbered walkable triangle holding a point, known to `knowledge` when one is given; failing that, the
 * lowest within `NEAR_CM`. -1 when there is none.
 */
export function walkableTriangle(mesh: GroundMesh, knowledge: Knowledge | null, p: Point) {
  const { bucketCm, buckets } = mesh
  let best = -1,
    bestNear = -1
  for (
    let by = Math.max(0, Math.floor((p.y - NEAR_CM) / bucketCm));
    by <= Math.min(buckets - 1, Math.floor((p.y + NEAR_CM) / bucketCm));
    by++
  )
    for (
      let bx = Math.max(0, Math.floor((p.x - NEAR_CM) / bucketCm));
      bx <= Math.min(buckets - 1, Math.floor((p.x + NEAR_CM) / bucketCm));
      bx++
    ) {
      const bucket = by * buckets + bx
      for (let k = mesh.bucketStart[bucket]!; k < mesh.bucketStart[bucket + 1]!; k++) {
        const t = mesh.bucketTriangles[k]!
        if ((best >= 0 && t >= best) || mesh.area[t] !== GROUND_AREA) continue
        if (knowledge && !knows(knowledge, t)) continue
        const d = triangleDistanceSq(mesh, t, p.x, p.y)
        if (d === 0) best = t
        else if (d <= NEAR_CM * NEAR_CM && (bestNear < 0 || t < bestNear)) bestNear = t
      }
    }
  return best >= 0 ? best : bestNear
}
export const onWalkableGround = (mesh: GroundMesh, p: Point) => walkableTriangle(mesh, null, p) >= 0
/** The known walkable triangle a person or place stands on, or -1. */
export function routeTriangle(nav: NavMap, knowledge: Knowledge, point: Point & { triangle?: number }): number {
  if (point.triangle !== undefined) return knows(knowledge, point.triangle) ? point.triangle : -1
  const { mesh } = nav
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) return walkableTriangle(mesh, knowledge, point)
  // The same as `walkableTriangle`: the lowest known triangle holding the point, else the lowest known one near it.
  const { inside, near } = groundAt(mesh, point)
  for (const t of inside) if (knows(knowledge, t)) return t
  for (const t of near) if (knows(knowledge, t)) return t
  return -1
}
const groundCache = new WeakMap<GroundMesh, Map<number, { inside: number[]; near: number[] }>>()
/** The walkable triangles holding a whole-centimetre point, and those within `NEAR_CM` of it, each in id order. */
function groundAt(mesh: GroundMesh, p: Point) {
  let cache = groundCache.get(mesh)
  if (!cache) {
    cache = new Map()
    groundCache.set(mesh, cache)
  }
  const key = p.x * (mesh.sizeCm + 1) + p.y
  let found = cache.get(key)
  if (!found) {
    found = { inside: [], near: [] }
    const { bucketCm, buckets } = mesh
    for (
      let by = Math.max(0, Math.floor((p.y - NEAR_CM) / bucketCm));
      by <= Math.min(buckets - 1, Math.floor((p.y + NEAR_CM) / bucketCm));
      by++
    )
      for (
        let bx = Math.max(0, Math.floor((p.x - NEAR_CM) / bucketCm));
        bx <= Math.min(buckets - 1, Math.floor((p.x + NEAR_CM) / bucketCm));
        bx++
      ) {
        const bucket = by * buckets + bx
        for (let k = mesh.bucketStart[bucket]!; k < mesh.bucketStart[bucket + 1]!; k++) {
          const t = mesh.bucketTriangles[k]!
          if (mesh.area[t] !== GROUND_AREA) continue
          const d = triangleDistanceSq(mesh, t, p.x, p.y)
          if (d === 0) found.inside.push(t)
          else if (d <= NEAR_CM * NEAR_CM) found.near.push(t)
        }
      }
    found.inside = [...new Set(found.inside)].sort((a, b) => a - b)
    found.near = [...new Set(found.near)].sort((a, b) => a - b)
    // People stop at many points; a bounded cache keeps a long run's memory flat.
    if (cache.size >= 500_000) cache.clear()
    cache.set(key, found)
  }
  return found
}
/** No water within `radiusCm` of the point, and the point inside the valley. */
export function circleWalkable(mesh: GroundMesh, p: Point, radiusCm: number) {
  if (p.x - radiusCm < 0 || p.y - radiusCm < 0 || p.x + radiusCm > mesh.sizeCm || p.y + radiusCm > mesh.sizeCm)
    return false
  if (!onWalkableGround(mesh, p)) return false
  const { bucketCm, buckets } = mesh
  for (let by = Math.floor((p.y - radiusCm) / bucketCm); by <= Math.floor((p.y + radiusCm) / bucketCm); by++)
    for (let bx = Math.floor((p.x - radiusCm) / bucketCm); bx <= Math.floor((p.x + radiusCm) / bucketCm); bx++) {
      if (bx < 0 || by < 0 || bx >= buckets || by >= buckets) continue
      const bucket = by * buckets + bx
      for (let k = mesh.bucketStart[bucket]!; k < mesh.bucketStart[bucket + 1]!; k++) {
        const t = mesh.bucketTriangles[k]!
        if (mesh.area[t] !== GROUND_AREA && triangleDistanceSq(mesh, t, p.x, p.y) <= radiusCm * radiusCm) return false
      }
    }
  return true
}
/** A point inside a triangle in whole centimetres: its centroid, or failing that its first vertex. */
export function trianglePoint(mesh: GroundMesh, t: number): Point {
  if (triangleDistanceSq(mesh, t, mesh.cx[t]!, mesh.cy[t]!) === 0) return { x: mesh.cx[t]!, y: mesh.cy[t]! }
  const v = mesh.tv[3 * t]!
  return { x: mesh.vx[v]!, y: mesh.vy[v]! }
}

const linkCache = new WeakMap<GroundMesh, ChunkLinks>()
/** Lists, once per mesh, every edge between walkable triangles of different chunks, by chunk and neighbour. */
function linksOf(mesh: GroundMesh): ChunkLinks {
  const saved = linkCache.get(mesh)
  if (saved) return saved
  const byChunk = new Map<number, Map<number, number[]>>()
  for (let t = 0; t < mesh.triangles; t++) {
    if (mesh.area[t] !== GROUND_AREA) continue
    for (let e = 0; e < 3; e++) {
      const u = mesh.tn[3 * t + e]!
      if (u < 0 || mesh.area[u] !== GROUND_AREA || mesh.chunk[u] === mesh.chunk[t]) continue
      let neighbours = byChunk.get(mesh.chunk[t]!)
      if (!neighbours) byChunk.set(mesh.chunk[t]!, (neighbours = new Map()))
      const pairs = neighbours.get(mesh.chunk[u]!)
      if (pairs) pairs.push(t, u)
      else neighbours.set(mesh.chunk[u]!, [t, u])
    }
  }
  const chunks = mesh.chunkCells * mesh.chunkCells,
    start = new Int32Array(chunks + 1),
    chunk: number[] = [],
    pairStart: number[] = [0],
    pairs: number[] = []
  for (let c = 0; c < chunks; c++) {
    start[c] = chunk.length
    for (const [other, list] of [...(byChunk.get(c) ?? [])].sort((a, b) => a[0] - b[0])) {
      chunk.push(other)
      pairs.push(...list)
      pairStart.push(pairs.length / 2)
    }
  }
  start[chunks] = chunk.length
  const links = {
    start,
    chunk: Int32Array.from(chunk),
    pairStart: Int32Array.from(pairStart),
    pairs: Int32Array.from(pairs),
  }
  linkCache.set(mesh, links)
  return links
}

/** The nav map of a layout; the mesh itself is shared by every layout of the same terrain and settings. */
export function buildNav(config: ValleyConfig, terrain: Terrain, layoutGround: Uint8Array): NavMap {
  const mesh = meshOf(terrain, meshSettings(config))
  const ground = new Uint8Array(mesh.triangles)
  for (let t = 0; t < mesh.triangles; t++) {
    const cell =
      Math.min(terrain.cells - 1, Math.floor(mesh.cy[t]! / terrain.cellCm)) * terrain.cells +
      Math.min(terrain.cells - 1, Math.floor(mesh.cx[t]! / terrain.cellCm))
    ground[t] = layoutGround[cell]!
  }
  const nav: NavMap = {
    mesh,
    chunkCm: config.chunkCm,
    chunkCells: mesh.chunkCells,
    ground,
    accessBanks: [],
    bankChunks: new Map(),
    bankIndex: { all: null, bodies: new Map() },
    links: linksOf(mesh),
  }
  // Each shore edge gives at most one bank point, set back into its walkable triangle by Life 11's approach rule.
  const inset = Math.min(50, config.reachCm)
  for (let t = 0; t < mesh.triangles; t++) {
    if (mesh.area[t] !== GROUND_AREA) continue
    for (let e = 0; e < 3; e++) {
      const other = mesh.tn[3 * t + e]!
      if (!mesh.shore[3 * t + e] || other < 0 || mesh.area[other] === GROUND_AREA) continue
      const a = mesh.tv[3 * t + e]!,
        b = mesh.tv[3 * t + ((e + 1) % 3)]!
      const ax = mesh.vx[a]!,
        ay = mesh.vy[a]!,
        dx = mesh.vx[b]! - ax,
        dy = mesh.vy[b]! - ay,
        length = Math.sqrt(dx * dx + dy * dy)
      if (!length || inset <= 0) continue
      // The triangle lies left of its counter-clockwise edge.
      const point = {
        x: Math.round(ax + dx / 2 - (dy / length) * inset),
        y: Math.round(ay + dy / 2 + (dx / length) * inset),
      }
      const at = triangleAt(mesh, point.x, point.y)
      if (at < 0 || mesh.area[at] !== GROUND_AREA) continue
      const level = Math.floor((mesh.vh[a]! + mesh.vh[b]!) / 2)
      if (
        planeHeight(mesh, at, point.x, point.y) - level > config.drinkBankHeightCm ||
        segmentDistanceSq(point.x, point.y, ax, ay, ax + dx, ay + dy) > config.reachCm ** 2
      )
        continue
      const bank: BankMemory = {
        id: 3 * t + e,
        bodyId: terrain.water.bodies[mesh.body[other]!]!.id,
        x: point.x,
        y: point.y,
        minute: 0,
        triangle: at,
      }
      nav.accessBanks.push(bank)
      const chunk = chunkOf(nav, bank),
        list = nav.bankChunks.get(chunk)
      if (list) list.push(bank)
      else nav.bankChunks.set(chunk, [bank])
    }
  }
  nav.bankIndex = indexBanks(nav.accessBanks, mesh)
  return nav
}

export function slopeClass(rise: number, lengthCm: number): { slope: SlopeClass; uphill: boolean } {
  const length = Math.max(1, lengthCm)
  const slope: SlopeClass = Math.abs(rise) * 100 < length * 10 ? 0 : Math.abs(rise) * 100 <= length * 30 ? 1 : 2
  return { slope, uphill: rise > 0 }
}
/** A piece's slope from its triangle's plane along its direction. */
export function segmentSlope(mesh: GroundMesh, segment: Pick<RouteSegment, 'x0' | 'y0' | 'x1' | 'y1' | 'triangle'>) {
  const rise =
    planeHeight(mesh, segment.triangle, segment.x1, segment.y1) -
    planeHeight(mesh, segment.triangle, segment.x0, segment.y0)
  return slopeClass(rise, distance(segment.x0, segment.y0, segment.x1, segment.y1))
}
export function segmentTimeUnits(
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
export const segmentEnergyRate = (
  config: ValleyConfig & { moderateWalkKcalPerHour?: number; steepWalkKcalPerHour?: number },
  slope: SlopeClass,
  uphill: boolean,
) =>
  slope && uphill
    ? (config[slope === 1 ? 'moderateWalkKcalPerHour' : 'steepWalkKcalPerHour'] ??
      Math.floor((config.walkKcalPerHour * (slope === 1 ? 3 : 4)) / 2))
    : config.walkKcalPerHour
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
export const loadedSpeed = (config: ValleyConfig, loadKg: number) =>
  Math.max(
    1,
    Math.floor(
      (config.walkCmPerSecond * (1_000 * config.referenceBodyKg - config.loadSlowdownPerMille * loadKg)) /
        (1_000 * config.referenceBodyKg),
    ),
  )

const heightCache = new WeakMap<GroundMesh, Map<number, number>>()
/** The mesh's surface height at a point, remembered per point. */
export function cachedHeight(mesh: GroundMesh, x: number, y: number) {
  let cache = heightCache.get(mesh)
  if (!cache) {
    cache = new Map()
    heightCache.set(mesh, cache)
  }
  const key = x * (mesh.sizeCm + 1) + y
  let value = cache.get(key)
  if (value === undefined) {
    const t = walkableTriangle(mesh, null, { x, y })
    value = t >= 0 ? planeHeight(mesh, t, x, y) : planeHeight(mesh, Math.max(0, triangleAt(mesh, x, y)), x, y)
    cache.set(key, value)
  }
  return value
}

interface SearchBuffers {
  costs: Float64Array
  parents: Int32Array
  px: Float64Array
  py: Float64Array
  seen: Uint32Array
  closed: Uint32Array
  heap: CellHeap
  stamp: number
}
/** Reusable per-triangle search arrays: one set for the fine search, one for the chain of pieces. */
const searchBuffers = new WeakMap<GroundMesh, SearchBuffers>(),
  chainBuffers = new WeakMap<GroundMesh, SearchBuffers>()
function buffersOf(cache: WeakMap<GroundMesh, SearchBuffers>, mesh: GroundMesh) {
  let buffers = cache.get(mesh)
  if (!buffers) {
    const n = mesh.triangles
    buffers = {
      costs: new Float64Array(n),
      parents: new Int32Array(n),
      px: new Float64Array(n),
      py: new Float64Array(n),
      seen: new Uint32Array(n),
      closed: new Uint32Array(n),
      heap: new CellHeap(),
      stamp: 0,
    }
    cache.set(mesh, buffers)
  }
  buffers.heap.clear()
  return buffers
}
const length2 = (ax: number, ay: number, bx: number, by: number) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
/**
 * A* over known walkable triangles between their shared edges' midpoints, ties by triangle id. Returns the
 * corridor of triangles from `first` to `last`, or null. With `within`, only triangles of that one piece are crossed.
 */
export function corridorOf(
  mesh: GroundMesh,
  knowledge: Knowledge,
  first: number,
  last: number,
  from: Point,
  to: Point,
  within?: PieceOf,
): number[] | null {
  const buffers = buffersOf(searchBuffers, mesh)
  const { costs, parents, px, py, seen, closed, heap } = buffers,
    stamp = ++buffers.stamp
  const { tv, tn, vx, vy, area } = mesh
  costs[first] = 0
  parents[first] = -1
  px[first] = from.x
  py[first] = from.y
  seen[first] = stamp
  heap.push(first, length2(from.x, from.y, to.x, to.y))
  while (heap.length) {
    const t = heap.popId()
    if (closed[t] === stamp) continue
    closed[t] = stamp
    if (t === last) break
    for (let e = 0; e < 3; e++) {
      const next = tn[3 * t + e]!
      if (next < 0 || area[next] !== GROUND_AREA || closed[next] === stamp || !knows(knowledge, next)) continue
      if (within && (mesh.chunk[next] !== within.chunk || within.labels[within.slots[next]!] !== within.id)) continue
      const a = tv[3 * t + e]!,
        b = tv[3 * t + ((e + 1) % 3)]!,
        mx = (vx[a]! + vx[b]!) / 2,
        my = (vy[a]! + vy[b]!) / 2
      const cost = costs[t]! + length2(px[t]!, py[t]!, mx, my)
      if (seen[next] !== stamp || cost < costs[next]! || (cost === costs[next] && t < parents[next]!)) {
        costs[next] = cost
        seen[next] = stamp
        parents[next] = t
        px[next] = mx
        py[next] = my
        heap.push(next, cost + length2(mx, my, to.x, to.y))
      }
    }
  }
  if (closed[last] !== stamp) return null
  const corridor = [last]
  while (corridor[corridor.length - 1] !== first) corridor.push(parents[corridor[corridor.length - 1]!]!)
  return corridor.reverse()
}
/** The shared edge from each corridor triangle to the next, as its left and right ends seen walking forward. */
function portalsOf(mesh: GroundMesh, corridor: ArrayLike<number>) {
  const portals: [number, number][] = []
  for (let i = 0; i + 1 < corridor.length; i++) {
    const t = corridor[i]!,
      next = corridor[i + 1]!
    for (let e = 0; e < 3; e++)
      if (mesh.tn[3 * t + e] === next) {
        // Leaving a counter-clockwise triangle across edge a→b, b is on the left and a on the right.
        portals.push([mesh.tv[3 * t + ((e + 1) % 3)]!, mesh.tv[3 * t + e]!])
        break
      }
  }
  return portals
}
/** The simple stupid funnel algorithm (Mononen): the shortest polyline within the corridor, turning at its vertices. */
export function funnel(mesh: GroundMesh, portals: [number, number][], from: Point, to: Point): Point[] {
  const { vx, vy } = mesh
  const pts: { l: Point; r: Point }[] = [{ l: from, r: from }]
  for (const [l, r] of portals) pts.push({ l: { x: vx[l]!, y: vy[l]! }, r: { x: vx[r]!, y: vy[r]! } })
  pts.push({ l: to, r: to })
  // Positive when c lies left of the ray a→b.
  const side = (a: Point, b: Point, c: Point) => crossXY(a.x, a.y, b.x, b.y, c.x, c.y)
  const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y
  const path: Point[] = [from]
  let apex = from,
    left = from,
    right = from,
    apexIndex = 0,
    leftIndex = 0,
    rightIndex = 0
  for (let i = 1; i < pts.length; i++) {
    const { l, r } = pts[i]!
    // Tighten the right side: the new right end must not lie right of the current right.
    if (side(apex, right, r) >= 0) {
      if (same(apex, right) || side(apex, left, r) < 0) {
        right = r
        rightIndex = i
      } else {
        if (!same(path[path.length - 1]!, left)) path.push(left)
        apex = left
        apexIndex = leftIndex
        left = right = apex
        leftIndex = rightIndex = apexIndex
        i = apexIndex
        continue
      }
    }
    if (side(apex, left, l) <= 0) {
      if (same(apex, left) || side(apex, right, l) > 0) {
        left = l
        leftIndex = i
      } else {
        if (!same(path[path.length - 1]!, right)) path.push(right)
        apex = right
        apexIndex = rightIndex
        left = right = apex
        leftIndex = rightIndex = apexIndex
        i = apexIndex
        continue
      }
    }
  }
  if (!same(path[path.length - 1]!, to)) path.push(to)
  return path
}
/**
 * Cuts the path wherever it crosses a corridor edge, so each piece lies in one flat triangle. Cut points are rounded
 * to whole centimetres and kept at least 1 cm from the ends of their edge.
 */
export function cutPath(
  mesh: GroundMesh,
  corridor: ArrayLike<number>,
  portals: [number, number][],
  path: Point[],
): { x0: number; y0: number; x1: number; y1: number; triangle: number }[] {
  const { vx, vy } = mesh
  const pieces: { x0: number; y0: number; x1: number; y1: number; triangle: number }[] = []
  let ci = 0,
    cur = path[0]!
  const emit = (p: Point) => {
    if (p.x !== cur.x || p.y !== cur.y) pieces.push({ x0: cur.x, y0: cur.y, x1: p.x, y1: p.y, triangle: corridor[ci]! })
    cur = p
  }
  for (let k = 1; k < path.length; k++) {
    const target = path[k]!
    while (ci + 1 < corridor.length && triangleDistanceSq(mesh, corridor[ci]!, target.x, target.y) > 0) {
      const [l, r] = portals[ci]!,
        ax = vx[r]!,
        ay = vy[r]!,
        bx = vx[l]!,
        by = vy[l]!
      const da = crossXY(cur.x, cur.y, target.x, target.y, ax, ay),
        db = crossXY(cur.x, cur.y, target.x, target.y, bx, by),
        edge = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
      let s = da === db ? 0.5 : da / (da - db)
      if (edge >= 2) s = Math.max(1 / edge, Math.min(1 - 1 / edge, s))
      else s = 0.5
      emit({ x: Math.round(ax + s * (bx - ax)), y: Math.round(ay + s * (by - ay)) })
      ci++
    }
    emit(target)
  }
  return pieces
}
/**
 * A person's pieces of known ground within chunks: for each chunk worked out, the piece of each of its triangles,
 * numbered by the lowest triangle id in it, or -1 where the triangle is unknown or not walkable. Chunks are worked out
 * when needed, and carried forward as triangles are learnt by dropping only the chunks those lie in.
 */
interface Pieces {
  revision: number
  chunks: Map<number, Int32Array>
}
const pieceCache = new WeakMap<Knowledge, Pieces>()
const slotCache = new WeakMap<GroundMesh, Int32Array>()
/** Each triangle's position in its chunk's list. */
function slotsOf(mesh: GroundMesh) {
  let slots = slotCache.get(mesh)
  if (!slots) {
    slots = new Int32Array(mesh.triangles)
    for (let c = 0; c < mesh.chunkCells ** 2; c++)
      for (let k = mesh.chunkStart[c]!; k < mesh.chunkStart[c + 1]!; k++)
        slots[mesh.chunkTriangles[k]!] = k - mesh.chunkStart[c]!
    slotCache.set(mesh, slots)
  }
  return slots
}
function piecesOf(knowledge: Knowledge) {
  let saved = pieceCache.get(knowledge)
  if (saved?.revision !== knowledge.revision) {
    saved = { revision: knowledge.revision, chunks: new Map() }
    pieceCache.set(knowledge, saved)
  }
  return saved
}
/** The pieces of one chunk: known walkable triangles of the chunk sharing an edge are one piece. */
function chunkPieces(mesh: GroundMesh, knowledge: Knowledge, pieces: Pieces, c: number) {
  const saved = pieces.chunks.get(c)
  if (saved) return saved
  const start = mesh.chunkStart[c]!,
    labels = new Int32Array(mesh.chunkStart[c + 1]! - start).fill(-1),
    slots = slotsOf(mesh),
    todo: number[] = []
  const open = (t: number) => mesh.area[t] === GROUND_AREA && knows(knowledge, t) === 1
  // Triangles are listed in id order, so each piece's first triangle is its lowest.
  for (let i = 0; i < labels.length; i++) {
    const root = mesh.chunkTriangles[start + i]!
    if (labels[i]! >= 0 || !open(root)) continue
    labels[i] = root
    todo.length = 0
    todo.push(root)
    while (todo.length) {
      const t = todo.pop()!
      for (let e = 0; e < 3; e++) {
        const next = mesh.tn[3 * t + e]!
        if (next < 0 || mesh.chunk[next] !== c || labels[slots[next]!]! >= 0 || !open(next)) continue
        labels[slots[next]!] = root
        todo.push(next)
      }
    }
  }
  pieces.chunks.set(c, labels)
  return labels
}
/** The piece of known walkable ground in its chunk that a triangle belongs to, or -1. */
export function pieceOf(nav: NavMap, knowledge: Knowledge, t: number) {
  const mesh = nav.mesh
  return chunkPieces(mesh, knowledge, piecesOf(knowledge), mesh.chunk[t]!)[slotsOf(mesh)[t]!]!
}
/** Carries a person's pieces forward to `after`, which knows `added` besides: only the chunks of `added` are dropped. */
export function carryPieces(nav: NavMap, before: Knowledge, after: Knowledge, added: readonly number[]) {
  const saved = pieceCache.get(before)
  if (!saved || saved.revision + (added.length ? 1 : 0) !== after.revision) return
  const chunks = before === after ? saved.chunks : new Map(saved.chunks)
  for (const t of added) chunks.delete(nav.mesh.chunk[t]!)
  pieceCache.set(after, { revision: after.revision, chunks })
}
/** The one piece a search keeps to: its chunk's piece labels by slot, and its number. */
export interface PieceOf {
  chunk: number
  labels: Int32Array
  slots: Int32Array
  id: number
}
/** A person's pieces: the labels of a chunk by slot, and the piece of a triangle. */
function pieceLookup(nav: NavMap, knowledge: Knowledge) {
  const mesh = nav.mesh,
    pieces = piecesOf(knowledge),
    slots = slotsOf(mesh),
    labels = (c: number) => chunkPieces(mesh, knowledge, pieces, c)
  return { labels, slots, piece: (t: number) => labels(mesh.chunk[t]!)[slots[t]!]! }
}
/**
 * The coarse plan: A* over the person's linked pieces, costed between their chunks' centres, ties by piece number.
 * Returns the chain of pieces from the first triangle's to the last's, or null if no chain is known.
 */
export function pieceChain(nav: NavMap, knowledge: Knowledge, first: number, last: number): number[] | null {
  const { mesh, links } = nav,
    cells = mesh.chunkCells,
    { labels, slots, piece } = pieceLookup(nav, knowledge)
  const from = piece(first),
    to = piece(last)
  if (from < 0 || to < 0) return null
  if (from === to) return [from]
  const gap = (a: number, b: number) =>
    Math.sqrt(((a % cells) - (b % cells)) ** 2 + (Math.floor(a / cells) - Math.floor(b / cells)) ** 2)
  // Pieces are numbered by one of their triangles, so the per-triangle arrays serve.
  const buffers = buffersOf(chainBuffers, mesh)
  const { costs, parents, seen, closed, heap } = buffers,
    stamp = ++buffers.stamp
  const goal = mesh.chunk[to]!
  costs[from] = 0
  parents[from] = -1
  seen[from] = stamp
  heap.push(from, gap(mesh.chunk[from]!, goal))
  while (heap.length) {
    const p = heap.popId()
    if (closed[p] === stamp) continue
    closed[p] = stamp
    if (p === to) break
    const c = mesh.chunk[p]!,
      here = labels(c)
    for (let k = links.start[c]!; k < links.start[c + 1]!; k++) {
      const n = links.chunk[k]!,
        there = labels(n),
        cost = costs[p]! + gap(c, n)
      for (let j = links.pairStart[k]!; j < links.pairStart[k + 1]!; j++) {
        if (here[slots[links.pairs[2 * j]!]!] !== p) continue
        const q = there[slots[links.pairs[2 * j + 1]!]!]!
        if (q < 0 || closed[q] === stamp) continue
        if (seen[q] !== stamp || cost < costs[q]! || (cost === costs[q] && p < parents[q]!)) {
          costs[q] = cost
          seen[q] = stamp
          parents[q] = p
          heap.push(q, cost + gap(n, goal))
        }
      }
    }
  }
  if (closed[to] !== stamp) return null
  const chain: number[] = []
  for (let p = to; p >= 0; p = parents[p]!) chain.push(p)
  return chain.reverse()
}
/**
 * The triangles the straight line from `from` to `to` crosses, starting in `first` and ending in `last`, each one
 * passing `open`; null if one does not, if either point lies outside its triangle, or if the line passes exactly
 * through a vertex. Coordinates are whole or half centimetres, so the side tests are exact.
 */
export function lineCorridor(
  mesh: GroundMesh,
  first: number,
  last: number,
  from: Point,
  to: Point,
  open: (t: number) => boolean,
): number[] | null {
  const { tv, tn, vx, vy } = mesh
  if (triangleDistanceSq(mesh, first, from.x, from.y) > 0) return null
  const corridor = [first]
  let t = first
  while (triangleDistanceSq(mesh, t, to.x, to.y) > 0) {
    // Leaving a counter-clockwise triangle across edge a→b, a lies right of the line and b left.
    let next = -1
    for (let e = 0; e < 3; e++) {
      const a = tv[3 * t + e]!,
        b = tv[3 * t + ((e + 1) % 3)]!
      if (
        crossXY(from.x, from.y, to.x, to.y, vx[a]!, vy[a]!) < 0 &&
        crossXY(from.x, from.y, to.x, to.y, vx[b]!, vy[b]!) > 0
      ) {
        next = tn[3 * t + e]!
        break
      }
    }
    if (next < 0 || !open(next)) return null
    corridor.push((t = next))
  }
  return t === last ? corridor : null
}
/** The midpoint of the edge `t` shares with its neighbour `u`. */
function sharedMidpoint(mesh: GroundMesh, t: number, u: number): Point {
  const { tv, tn, vx, vy } = mesh
  let e = 0
  while (tn[3 * t + e] !== u) e++
  const a = tv[3 * t + e]!,
    b = tv[3 * t + ((e + 1) % 3)]!
  return { x: (vx[a]! + vx[b]!) / 2, y: (vy[a]! + vy[b]!) / 2 }
}
/**
 * A steered corridor along a chain of pieces: in each piece, from where the walker enters it to the crossing into the
 * next piece whose midpoint is nearest the line on to the target, straight where the line stays in the piece and
 * otherwise by the fine A* within the piece alone. The last piece's stretch ends at the target.
 */
export function steeredCorridor(
  nav: NavMap,
  knowledge: Knowledge,
  chain: readonly number[],
  first: number,
  last: number,
  from: Point,
  to: Point,
): number[] {
  const { mesh, links } = nav,
    { labels, slots } = pieceLookup(nav, knowledge)
  const corridor: number[] = []
  let entry = from,
    entryTriangle = first
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i]!,
      c = mesh.chunk[id]!,
      here = labels(c)
    let exit = to,
      exitTriangle = last,
      across = -1
    if (i + 1 < chain.length) {
      const next = chain[i + 1]!,
        n = mesh.chunk[next]!,
        there = labels(n)
      let best = Infinity
      for (let k = links.start[c]!; k < links.start[c + 1]!; k++) {
        if (links.chunk[k] !== n) continue
        for (let j = links.pairStart[k]!; j < links.pairStart[k + 1]!; j++) {
          const t = links.pairs[2 * j]!,
            u = links.pairs[2 * j + 1]!
          if (here[slots[t]!] !== id || there[slots[u]!] !== next) continue
          const m = sharedMidpoint(mesh, t, u),
            d = segmentDistanceSq(m.x, m.y, entry.x, entry.y, to.x, to.y)
          if (d < best || (d === best && t < exitTriangle)) {
            best = d
            exit = m
            exitTriangle = t
            across = u
          }
        }
      }
    }
    const stretch =
      lineCorridor(
        mesh,
        entryTriangle,
        exitTriangle,
        entry,
        exit,
        (t) => mesh.chunk[t] === c && here[slots[t]!] === id,
      ) ?? corridorOf(mesh, knowledge, entryTriangle, exitTriangle, entry, exit, { chunk: c, labels: here, slots, id })!
    for (const t of stretch) corridor.push(t)
    entry = exit
    entryTriangle = across
  }
  return corridor
}
export type PlanKind = 'straight' | 'steered'
/**
 * A new corridor over known ground: the straight line if it crosses only known walkable ground, else a corridor
 * steered along the coarse chain of pieces. Null when the two points are on separate pieces of known ground.
 */
export function planCorridor(
  nav: NavMap,
  knowledge: Knowledge,
  first: number,
  last: number,
  from: Point,
  to: Point,
): { corridor: number[]; plan: PlanKind } | null {
  // A plan between separate pieces of known ground could never arrive.
  const componentOf = knownComponents(nav, knowledge)
  if (componentOf(first) !== componentOf(last)) return null
  const mesh = nav.mesh
  const straight = lineCorridor(
    mesh,
    first,
    last,
    from,
    to,
    (t) => mesh.area[t] === GROUND_AREA && knows(knowledge, t) === 1,
  )
  if (straight) return { corridor: straight, plan: 'straight' }
  const chain = pieceChain(nav, knowledge, first, last)
  return chain && { corridor: steeredCorridor(nav, knowledge, chain, first, last, from, to), plan: 'steered' }
}
/** The shortest route over everything the person knows, without a coarse plan. */
export function knownRoute(
  nav: NavMap,
  knowledge: Knowledge,
  config: ValleyConfig,
  loadKg: number,
  from: Point & { triangle?: number },
  to: Point & { triangle?: number },
): Route | null {
  const first = routeTriangle(nav, knowledge, from),
    last = routeTriangle(nav, knowledge, to)
  if (first < 0 || last < 0) return null
  if (from.x === to.x && from.y === to.y) return { segments: [], minutes: 0, timeUnits: 0, kcal: 0 }
  const componentOf = knownComponents(nav, knowledge)
  if (componentOf(first) !== componentOf(last)) return null
  const corridor = corridorOf(nav.mesh, knowledge, first, last, from, to)
  return corridor && corridorRoute(nav, config, loadKg, corridor, from, to)
}
/** The path pulled tight along a corridor from one point to another, cut into timed pieces for a load. */
export function corridorRoute(
  nav: NavMap,
  config: ValleyConfig,
  loadKg: number,
  corridor: ArrayLike<number>,
  from: Point,
  to: Point,
): Route {
  const mesh = nav.mesh
  if (from.x === to.x && from.y === to.y) return { segments: [], minutes: 0, timeUnits: 0, kcal: 0 }
  const portals = portalsOf(mesh, corridor),
    path = funnel(mesh, portals, from, to),
    speed = loadedSpeed(config, loadKg)
  const segments: RouteSegment[] = []
  let timeUnits = 0,
    energy = 0
  for (const piece of cutPath(mesh, corridor, portals, path)) {
    const lengthCm = distance(piece.x0, piece.y0, piece.x1, piece.y1)
    if (!lengthCm) continue
    const { slope, uphill } = segmentSlope(mesh, piece)
    const groundClass = nav.ground[piece.triangle]! as Ground
    const duration = segmentTimeUnits(config, lengthCm, slope, uphill, groundClass, speed)
    const energyPerHour = segmentEnergyRate(config, slope, uphill)
    segments.push({
      ...piece,
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
/**
 * The connected pieces of known walkable triangles as a union-find (-1 for a triangle not known walkable), and the
 * known walkable triangles that border an unknown one. Built once per knowledge, then carried forward as triangles
 * are learnt.
 */
interface Components {
  revision: number
  parent: Int32Array
  frontier: Set<number>
}
const componentCache = new WeakMap<Knowledge, Components>()
function rootOf(parent: Int32Array, t: number) {
  while (parent[t] !== t) {
    parent[t] = parent[parent[t]!]!
    t = parent[t]!
  }
  return t
}
function borders(mesh: GroundMesh, knowledge: Knowledge, t: number) {
  for (let e = 0; e < 3; e++) {
    const next = mesh.tn[3 * t + e]!
    if (next >= 0 && !knows(knowledge, next)) return true
  }
  return false
}
function componentsOf(nav: NavMap, knowledge: Knowledge) {
  const saved = componentCache.get(knowledge)
  if (saved?.revision === knowledge.revision) return saved
  const { mesh } = nav,
    parent = new Int32Array(mesh.triangles).fill(-1),
    frontier = new Set<number>()
  const todo: number[] = []
  for (let root = 0; root < mesh.triangles; root++) {
    if (parent[root]! >= 0 || mesh.area[root] !== GROUND_AREA || !knows(knowledge, root)) continue
    parent[root] = root
    todo.length = 0
    todo.push(root)
    for (let i = 0; i < todo.length; i++) {
      const t = todo[i]!
      if (borders(mesh, knowledge, t)) frontier.add(t)
      for (let e = 0; e < 3; e++) {
        const next = mesh.tn[3 * t + e]!
        if (next < 0 || parent[next]! >= 0 || mesh.area[next] !== GROUND_AREA || !knows(knowledge, next)) continue
        parent[next] = root
        todo.push(next)
      }
    }
  }
  const value = { revision: knowledge.revision, parent, frontier }
  componentCache.set(knowledge, value)
  return value
}
/** The piece of known walkable ground a triangle belongs to, as a number equal only within one piece; -1 if none. */
export function knownComponents(nav: NavMap, knowledge: Knowledge) {
  const { parent } = componentsOf(nav, knowledge)
  return (t: number) => (t < 0 || parent[t]! < 0 ? -1 : rootOf(parent, t))
}
/**
 * Carries the pieces of `before` forward to `after`, which knows `added` besides, instead of rebuilding them: new
 * walkable triangles join their known walkable neighbours, and the frontier is rechecked around what was added.
 */
export function carryComponents(nav: NavMap, before: Knowledge, after: Knowledge, added: readonly number[]) {
  const saved = componentCache.get(before)
  if (!saved || saved.revision + (added.length ? 1 : 0) !== after.revision) return
  const { mesh } = nav,
    parent = before === after ? saved.parent : saved.parent.slice(),
    frontier = before === after ? saved.frontier : new Set(saved.frontier)
  for (const t of added) if (mesh.area[t] === GROUND_AREA) parent[t] = t
  for (const t of added) {
    if (parent[t]! < 0) continue
    for (let e = 0; e < 3; e++) {
      const next = mesh.tn[3 * t + e]!
      if (next < 0 || parent[next]! < 0) continue
      const a = rootOf(parent, t),
        b = rootOf(parent, next)
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b)
    }
  }
  const recheck = (t: number) => {
    if (parent[t]! < 0) return
    if (borders(mesh, after, t)) frontier.add(t)
    else frontier.delete(t)
  }
  for (const t of added) {
    recheck(t)
    for (let e = 0; e < 3; e++) {
      const next = mesh.tn[3 * t + e]!
      if (next >= 0) recheck(next)
    }
  }
  componentCache.set(after, { revision: after.revision, parent, frontier })
}
const frontierCache = new WeakMap<Knowledge, Map<string, Point | null>>()
/** The nearest known walkable triangle, reachable through known ground, with an unknown neighbour. */
export function nearestFrontier(nav: NavMap, knowledge: Knowledge, from: Point): Point | null {
  let cache = frontierCache.get(knowledge)
  if (!cache) {
    cache = new Map()
    frontierCache.set(knowledge, cache)
  }
  const key = `${from.x},${from.y}:${knowledge.revision}`
  if (cache.has(key)) return cache.get(key)!
  const mesh = nav.mesh,
    first = routeTriangle(nav, knowledge, from)
  if (first < 0) return null
  const { parent, frontier } = componentsOf(nav, knowledge),
    label = rootOf(parent, first)
  let best: Point | null = null,
    bestSq = Infinity,
    bestId = -1
  for (const t of frontier) {
    if (rootOf(parent, t) !== label) continue
    const p = trianglePoint(mesh, t),
      sq = distanceSq(p.x, p.y, from.x, from.y)
    if (sq > 0 && (sq < bestSq || (sq === bestSq && t < bestId))) {
      bestSq = sq
      bestId = t
      best = p
    }
  }
  cache.set(key, best)
  return best
}
