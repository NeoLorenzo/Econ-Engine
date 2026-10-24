import Constrainautor from '@kninnug/constrainautor'
import Delaunator from 'delaunator'
import { bankWaterHeight, type BankGeometry } from './banks'
import { heightAt, type Terrain } from './terrain'
import type { Point } from './types'

/** Area types: walking uses ground alone in this step. */
export const GROUND_AREA = 0
export const LAKE_AREA = 1
export const RIVER_AREA = 2
export type AreaType = typeof GROUND_AREA | typeof LAKE_AREA | typeof RIVER_AREA

export interface MeshSettings {
  valleySizeCm: number
  meshMaxEdgeCm: number
  meshHeightToleranceCm: number
  shoreToleranceCm: number
  chunkCm: number
}

/** One triangle mesh of land and water, built once per terrain and never changed by a run. */
export interface GroundMesh {
  sizeCm: number
  vertices: number
  vx: Int32Array
  vy: Int32Array
  /** Ground height, or the water's surface for a vertex inside water; shore vertices carry their water's level. */
  vh: Int32Array
  /** Water depth below `vh`, zero on land and on the shore. */
  vdepth: Int32Array
  triangles: number
  /** Three vertices per triangle, counter-clockwise. Edge `i` runs from vertex `i` to vertex `i + 1`. */
  tv: Int32Array
  /** The triangle across each edge, or -1 at the valley's edge. */
  tn: Int32Array
  /** 1 where an edge is a shore constraint. */
  shore: Uint8Array
  area: Uint8Array
  /** Index into the hydrology's bodies, or -1 for ground. */
  body: Int32Array
  ground: Uint8Array
  /** Centroids, rounded down. */
  cx: Int32Array
  cy: Int32Array
  /** Twice each triangle's area in square centimetres. */
  area2: Float64Array
  chunkCm: number
  chunkCells: number
  chunk: Int32Array
  /** Triangles by chunk, as offsets into `chunkTriangles`. */
  chunkStart: Int32Array
  chunkTriangles: Int32Array
  bucketCm: number
  buckets: number
  bucketStart: Int32Array
  bucketTriangles: Int32Array
  /** Walkable region of each ground triangle, named by its lowest triangle id; -1 for water. */
  region: Int32Array
  regionArea2: Map<number, number>
  mainRegion: number
  /** Shore edges kept after simplification, as vertex pairs, and those the triangulation could not keep. */
  shoreEdges: Int32Array
  constraintFailures: number
}

const crossXY = (ax: number, ay: number, bx: number, by: number, x: number, y: number) =>
  (bx - ax) * (y - ay) - (by - ay) * (x - ax)
function segmentDistanceSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay,
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
}
const between = (a: number, b: number, v: number) => Math.min(a, b) <= v && v <= Math.max(a, b)
function onSegment(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
  return crossXY(ax, ay, bx, by, x, y) === 0 && between(ax, bx, x) && between(ay, by, y)
}
/** Exact on integer coordinates: two edges that cross, touch or overlap, other than at one shared end. */
function edgesConflict(a: number[], b: number[]) {
  const [ax, ay, bx, by] = a as [number, number, number, number],
    [cx, cy, dx, dy] = b as [number, number, number, number]
  const sameA = (ax === cx && ay === cy) || (ax === dx && ay === dy),
    sameB = (bx === cx && by === cy) || (bx === dx && by === dy)
  if (sameA && sameB) return false
  if (sameA || sameB) {
    const [ox, oy] = sameA ? [bx, by] : [ax, ay],
      [qx, qy] = (sameA ? ax === cx && ay === cy : bx === cx && by === cy) ? [dx, dy] : [cx, cy]
    return onSegment(ax, ay, bx, by, qx, qy) || onSegment(cx, cy, dx, dy, ox, oy)
  }
  if (
    Math.max(ax, bx) < Math.min(cx, dx) ||
    Math.max(cx, dx) < Math.min(ax, bx) ||
    Math.max(ay, by) < Math.min(cy, dy) ||
    Math.max(cy, dy) < Math.min(ay, by)
  )
    return false
  const d1 = crossXY(ax, ay, bx, by, cx, cy),
    d2 = crossXY(ax, ay, bx, by, dx, dy),
    d3 = crossXY(cx, cy, dx, dy, ax, ay),
    d4 = crossXY(cx, cy, dx, dy, bx, by)
  if (d1 === 0 && between(ax, bx, cx) && between(ay, by, cy)) return true
  if (d2 === 0 && between(ax, bx, dx) && between(ay, by, dy)) return true
  if (d3 === 0 && between(cx, dx, ax) && between(cy, dy, ay)) return true
  if (d4 === 0 && between(cx, dx, bx) && between(cy, dy, by)) return true
  return Math.sign(d1) * Math.sign(d2) < 0 && Math.sign(d3) * Math.sign(d4) < 0
}

interface Chain {
  /** Point keys in order; a loop repeats its first key at the end. */
  keys: number[]
  /** The hydrology segment between each pair of consecutive keys. */
  edges: number[]
  loop: boolean
}
/** Joins the hydrology's shore segments into polylines between vertices that do not have exactly two segments. */
function chainShores(shore: BankGeometry, sizeCm: number) {
  const key = (x: number, y: number) => y * (sizeCm + 1) + x
  const points = new Map<number, { x: number; y: number; level: number }>(),
    links = new Map<number, number[]>(),
    pairs = new Set<string>()
  const edges: [number, number][] = [],
    bodies: number[] = []
  for (const segment of [...shore.segments.values()].sort((a, b) => a.id - b.id)) {
    const ka = key(segment.a.x, segment.a.y),
      kb = key(segment.b.x, segment.b.y)
    if (ka === kb) continue
    const pair = ka < kb ? `${ka}:${kb}` : `${kb}:${ka}`
    if (pairs.has(pair)) continue
    pairs.add(pair)
    for (const p of [segment.a, segment.b]) {
      const k = key(p.x, p.y)
      if (!points.has(k)) points.set(k, { x: p.x, y: p.y, level: p.level })
    }
    const id = edges.length
    edges.push([ka, kb])
    bodies.push(segment.body)
    for (const k of [ka, kb]) {
      const list = links.get(k)
      if (list) list.push(id)
      else links.set(k, [id])
    }
  }
  const used = new Uint8Array(edges.length),
    chains: Chain[] = []
  const walk = (start: number, edge: number) => {
    const keys = [start],
      path: number[] = []
    let at = start
    while (edge >= 0 && !used[edge]) {
      used[edge] = 1
      path.push(edge)
      const [a, b] = edges[edge]!
      at = a === at ? b : a
      keys.push(at)
      const next = links.get(at)!
      if (next.length !== 2) break
      edge = next[0] === edge ? next[1]! : next[0]!
    }
    return { keys, path }
  }
  for (const [k, list] of links)
    if (list.length !== 2)
      for (const edge of list)
        if (!used[edge]) {
          const { keys, path } = walk(k, edge)
          chains.push({ keys, edges: path, loop: false })
        }
  for (let edge = 0; edge < edges.length; edge++) {
    if (used[edge]) continue
    // A loop is anchored at its lowest point by y, then x.
    const { keys: loopKeys, path } = walk(edges[edge]![0], edge)
    let lowest = 0
    for (let i = 1; i < loopKeys.length - 1; i++) if (loopKeys[i]! < loopKeys[lowest]!) lowest = i
    const keys = [...loopKeys.slice(lowest, -1), ...loopKeys.slice(0, lowest), loopKeys[lowest]!]
    chains.push({ keys, edges: [...path.slice(lowest), ...path.slice(0, lowest)], loop: true })
  }
  return { points, chains, bodies }
}

/** Douglas–Peucker, with any edge that crosses or touches another shore edge split again at its farthest point. */
function simplifyShores(
  points: Map<number, { x: number; y: number; level: number }>,
  chains: Chain[],
  toleranceCm: number,
) {
  const tolSq = toleranceCm * toleranceCm
  const keep = chains.map((c) => new Uint8Array(c.keys.length))
  const at = (c: number, i: number) => points.get(chains[c]!.keys[i]!)!
  const farthest = (c: number, i: number, j: number) => {
    const a = at(c, i),
      b = at(c, j)
    let best = -1,
      bestSq = -1
    for (let k = i + 1; k < j; k++) {
      const p = at(c, k),
        d = segmentDistanceSq(p.x, p.y, a.x, a.y, b.x, b.y)
      if (d > bestSq) {
        bestSq = d
        best = k
      }
    }
    return { best, bestSq }
  }
  const dp = (c: number, i: number, j: number) => {
    const stack = [[i, j]]
    while (stack.length) {
      const [s, e] = stack.pop()!
      const { best, bestSq } = farthest(c, s!, e!)
      if (best < 0 || bestSq <= tolSq) continue
      keep[c]![best] = 1
      stack.push([s!, best], [best, e!])
    }
  }
  for (let c = 0; c < chains.length; c++) {
    const n = chains[c]!.keys.length
    keep[c]![0] = 1
    keep[c]![n - 1] = 1
    if (chains[c]!.loop) {
      // A loop keeps its anchor, the point farthest from it, and one more on each side if needed for three.
      const a = at(c, 0)
      let far = 1,
        farSq = -1
      for (let k = 1; k < n - 1; k++) {
        const p = at(c, k),
          d = (p.x - a.x) ** 2 + (p.y - a.y) ** 2
        if (d > farSq) {
          farSq = d
          far = k
        }
      }
      keep[c]![far] = 1
      dp(c, 0, far)
      dp(c, far, n - 1)
      let count = 0
      for (let k = 0; k < n - 1; k++) count += keep[c]![k]!
      if (count < 3) {
        const side = farthest(c, 0, far).best >= 0 ? farthest(c, 0, far) : farthest(c, far, n - 1)
        if (side.best >= 0) keep[c]![side.best] = 1
      }
    } else dp(c, 0, n - 1)
  }
  const bucketCm = 2_000
  for (let round = 0; round < 64; round++) {
    const spans: [number, number, number][] = []
    for (let c = 0; c < chains.length; c++) {
      let prev = 0
      for (let k = 1; k < chains[c]!.keys.length; k++)
        if (keep[c]![k]) {
          spans.push([c, prev, k])
          prev = k
        }
    }
    const coords = spans.map(([c, i, j]) => {
      const a = at(c, i),
        b = at(c, j)
      return [a.x, a.y, b.x, b.y]
    })
    const grid = new Map<number, number[]>()
    for (let s = 0; s < spans.length; s++) {
      const [ax, ay, bx, by] = coords[s] as [number, number, number, number]
      for (let y = Math.floor(Math.min(ay, by) / bucketCm); y <= Math.floor(Math.max(ay, by) / bucketCm); y++)
        for (let x = Math.floor(Math.min(ax, bx) / bucketCm); x <= Math.floor(Math.max(ax, bx) / bucketCm); x++) {
          const k = y * 100_000 + x,
            list = grid.get(k)
          if (list) list.push(s)
          else grid.set(k, [s])
        }
    }
    const bad = new Uint8Array(spans.length)
    for (const list of grid.values())
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!,
            b = list[j]!
          if ((bad[a] && bad[b]) || !edgesConflict(coords[a]!, coords[b]!)) continue
          bad[a] = 1
          bad[b] = 1
        }
    let split = 0
    for (let s = 0; s < spans.length; s++) {
      if (!bad[s]) continue
      const [c, i, j] = spans[s]!,
        { best } = farthest(c, i, j)
      if (best >= 0) {
        keep[c]![best] = 1
        split++
      }
    }
    if (!split) return { spans, coords }
  }
  throw new Error('Shoreline simplification did not settle')
}

/** Relief vertices: corners of a quadtree of squares, split while the bilinear blend strays beyond the tolerance. */
function reliefPoints(terrain: Terrain, settings: MeshSettings) {
  const { cells, height, water } = terrain,
    points = cells + 1,
    step = settings.meshMaxEdgeCm / terrain.cellCm
  const marked = new Uint8Array(points * points)
  const wetPoint = (i: number, j: number) => {
    for (const [ci, cj] of [
      [i - 1, j - 1],
      [i, j - 1],
      [i - 1, j],
      [i, j],
    ] as const)
      if (ci >= 0 && cj >= 0 && ci < cells && cj < cells && water.body[cj * cells + ci]! < 0) return false
    return true
  }
  const square = (i0: number, j0: number, k: number) => {
    const h = (i: number, j: number) => height[j * points + i]!
    const a = h(i0, j0),
      b = h(i0 + k, j0),
      c = h(i0, j0 + k),
      d = h(i0 + k, j0 + k)
    let split = false
    if (k > 1)
      for (let j = 0; j <= k && !split; j++)
        for (let i = 0; i <= k; i++) {
          if (wetPoint(i0 + i, j0 + j)) continue
          // Either diagonal may be chosen by the triangulation, so both must fit.
          const main = i >= j ? a + ((b - a) * i + (d - b) * j) / k : a + ((c - a) * j + (d - c) * i) / k,
            anti = i + j <= k ? a + ((b - a) * i + (c - a) * j) / k : d + ((c - d) * (k - i) + (b - d) * (k - j)) / k,
            actual = h(i0 + i, j0 + j)
          if (Math.max(Math.abs(main - actual), Math.abs(anti - actual)) > settings.meshHeightToleranceCm) {
            split = true
            break
          }
        }
    if (!split) {
      marked[j0 * points + i0] = 1
      marked[j0 * points + i0 + k] = 1
      marked[(j0 + k) * points + i0] = 1
      marked[(j0 + k) * points + i0 + k] = 1
      return
    }
    const half = k / 2
    square(i0, j0, half)
    square(i0 + half, j0, half)
    square(i0, j0 + half, half)
    square(i0 + half, j0 + half, half)
  }
  for (let j = 0; j < cells; j += step) for (let i = 0; i < cells; i += step) square(i, j, step)
  return marked
}

const meshCache = new WeakMap<Terrain, Map<string, GroundMesh>>()
/** The mesh of a terrain and its settings, built once and kept; it holds no simulation state. */
export function meshOf(terrain: Terrain, settings: MeshSettings) {
  let byTerrain = meshCache.get(terrain)
  if (!byTerrain) {
    byTerrain = new Map()
    meshCache.set(terrain, byTerrain)
  }
  const key = `${settings.valleySizeCm}:${settings.meshMaxEdgeCm}:${settings.meshHeightToleranceCm}:${settings.shoreToleranceCm}:${settings.chunkCm}`
  let mesh = byTerrain.get(key)
  if (!mesh) {
    mesh = buildMesh(terrain, settings)
    byTerrain.set(key, mesh)
  }
  return mesh
}

export function buildMesh(terrain: Terrain, settings: MeshSettings): GroundMesh {
  const sizeCm = settings.valleySizeCm,
    shore = terrain.water.shore,
    water = terrain.water
  const vertexKey = (x: number, y: number) => y * (sizeCm + 1) + x
  // 1. Shorelines.
  const kept = new Map<number, { x: number; y: number; h: number; depth: number }>()
  let shoreSpans: number[][] = []
  /** Per kept shore edge: +1 when water lies left of its direction, -1 right, 0 unknown; and its body. */
  const spanSide: number[] = [],
    spanBody: number[] = []
  if (shore) {
    const { points, chains, bodies } = chainShores(shore, sizeCm)
    const { coords, spans } = simplifyShores(points, chains, settings.shoreToleranceCm)
    shoreSpans = coords
    const wetAt = (x: number, y: number) => bankWaterHeight(shore, { x, y }, water.level) !== null
    for (const [c, i, j] of spans) {
      for (const k of [chains[c]!.keys[i]!, chains[c]!.keys[j]!]) {
        const p = points.get(k)!
        kept.set(k, { x: p.x, y: p.y, h: p.level, depth: 0 })
      }
      // The hydrology's own segments in the span say which side is water, probed just off each one.
      let vote = 0
      for (let k = i; k < j; k++) {
        const a = points.get(chains[c]!.keys[k]!)!,
          b = points.get(chains[c]!.keys[k + 1]!)!,
          length = Math.hypot(b.x - a.x, b.y - a.y),
          mx = (a.x + b.x) / 2,
          my = (a.y + b.y) / 2,
          nx = (-(b.y - a.y) / length) * 2,
          ny = ((b.x - a.x) / length) * 2
        const left = wetAt(mx + nx, my + ny),
          right = wetAt(mx - nx, my - ny)
        if (left !== right) vote += left ? length : -length
      }
      spanSide.push(Math.sign(vote))
      spanBody.push(bodies[chains[c]!.edges[i]!]!)
    }
  }
  // 2. Relief vertices, dropped where they would lie within the tolerance of a kept shore edge.
  const marked = reliefPoints(terrain, settings),
    latticePoints = terrain.cells + 1,
    bucketCm = 2_000,
    near = new Map<number, number[]>()
  for (let s = 0; s < shoreSpans.length; s++) {
    const [ax, ay, bx, by] = shoreSpans[s] as [number, number, number, number],
      r = settings.shoreToleranceCm
    for (let y = Math.floor((Math.min(ay, by) - r) / bucketCm); y <= Math.floor((Math.max(ay, by) + r) / bucketCm); y++)
      for (
        let x = Math.floor((Math.min(ax, bx) - r) / bucketCm);
        x <= Math.floor((Math.max(ax, bx) + r) / bucketCm);
        x++
      ) {
        const k = y * 100_000 + x,
          list = near.get(k)
        if (list) list.push(s)
        else near.set(k, [s])
      }
  }
  const tolSq = settings.shoreToleranceCm ** 2
  /** Refinement may add a point near a shore, never on one. */
  const addRelief = (id: number, refining = false) => {
    const x = (id % latticePoints) * terrain.cellCm,
      y = Math.floor(id / latticePoints) * terrain.cellCm,
      k = vertexKey(x, y)
    if (kept.has(k)) return false
    const corner = (x === 0 || x === sizeCm) && (y === 0 || y === sizeCm)
    const list = near.get(Math.floor(y / bucketCm) * 100_000 + Math.floor(x / bucketCm)) ?? []
    if (
      list.some((s) => {
        const [ax, ay, bx, by] = shoreSpans[s] as [number, number, number, number]
        return corner || refining ? onSegment(ax, ay, bx, by, x, y) : segmentDistanceSq(x, y, ax, ay, bx, by) <= tolSq
      })
    )
      return false
    const surface = shore ? bankWaterHeight(shore, { x, y }, water.level) : null
    const ground = heightAt(terrain, x, y)
    kept.set(
      k,
      surface === null
        ? { x, y, h: ground, depth: 0 }
        : { x, y, h: Math.floor(surface), depth: Math.max(0, Math.floor(surface) - ground) },
    )
    return true
  }
  for (let id = 0; id < marked.length; id++) if (marked[id]) addRelief(id)
  // 3. Triangulation, vertices sorted by y then x; dry lattice points still beyond the height tolerance are
  // added and the triangulation repeated, since triangles may join squares of different sizes.
  const dryLattice = new Uint8Array(marked.length)
  for (let id = 0; id < marked.length; id++) {
    const x = (id % latticePoints) * terrain.cellCm,
      y = Math.floor(id / latticePoints) * terrain.cellCm
    dryLattice[id] = !shore || bankWaterHeight(shore, { x, y }, water.level) === null ? 1 : 0
  }
  const triangulate = () => {
    const keys = [...kept.keys()].sort((a, b) => a - b),
      vertices = keys.length
    const index = new Map<number, number>()
    const vx = new Int32Array(vertices),
      vy = new Int32Array(vertices),
      vh = new Int32Array(vertices),
      vdepth = new Int32Array(vertices),
      coords = new Float64Array(2 * vertices)
    for (let i = 0; i < vertices; i++) {
      const p = kept.get(keys[i]!)!
      index.set(keys[i]!, i)
      vx[i] = p.x
      vy[i] = p.y
      vh[i] = p.h
      vdepth[i] = p.depth
      coords[2 * i] = p.x
      coords[2 * i + 1] = p.y
    }
    const delaunay = new Delaunator(coords),
      constrained = new Constrainautor(delaunay)
    const shoreEdges = new Int32Array(2 * shoreSpans.length)
    let constraintFailures = 0
    for (let s = 0; s < shoreSpans.length; s++) {
      const [ax, ay, bx, by] = shoreSpans[s] as [number, number, number, number]
      const a = index.get(vertexKey(ax, ay))!,
        b = index.get(vertexKey(bx, by))!
      shoreEdges[2 * s] = a
      shoreEdges[2 * s + 1] = b
      try {
        constrained.constrainOne(a, b)
      } catch {
        constraintFailures++
      }
    }
    return { vertices, vx, vy, vh, vdepth, delaunay, constrained, shoreEdges, constraintFailures }
  }
  let built = triangulate()
  for (let round = 0; round < 8; round++) {
    const { vx, vy, vh, delaunay } = built,
      t3 = delaunay.triangles,
      c = terrain.cellCm,
      worst: number[] = []
    for (let t = 0; t < t3.length; t += 3) {
      const a = t3[t]!,
        b = t3[t + 1]!,
        d = t3[t + 2]!
      const total = crossXY(vx[a]!, vy[a]!, vx[b]!, vy[b]!, vx[d]!, vy[d]!)
      if (!total) continue
      for (let j = Math.ceil(Math.min(vy[a]!, vy[b]!, vy[d]!) / c); j * c <= Math.max(vy[a]!, vy[b]!, vy[d]!); j++)
        for (let i = Math.ceil(Math.min(vx[a]!, vx[b]!, vx[d]!) / c); i * c <= Math.max(vx[a]!, vx[b]!, vx[d]!); i++) {
          const id = j * latticePoints + i,
            x = i * c,
            y = j * c
          if (!dryLattice[id]) continue
          const u = crossXY(x, y, vx[b]!, vy[b]!, vx[d]!, vy[d]!) / total,
            v = crossXY(vx[a]!, vy[a]!, x, y, vx[d]!, vy[d]!) / total,
            w = crossXY(vx[a]!, vy[a]!, vx[b]!, vy[b]!, x, y) / total
          if (u < 0 || v < 0 || w < 0) continue
          const h = Math.floor(u * vh[a]! + v * vh[b]! + w * vh[d]!)
          if (Math.abs(h - heightAt(terrain, x, y)) > settings.meshHeightToleranceCm) worst.push(id)
        }
    }
    let added = 0
    for (const id of worst.sort((p, q) => p - q)) if (addRelief(id, true)) added++
    if (!added) break
    built = triangulate()
  }
  const { vertices, vx, vy, vh, vdepth, delaunay, constrained, shoreEdges, constraintFailures } = built
  const raw = delaunay.triangles,
    halfedges = delaunay.halfedges,
    rawCount = raw.length / 3
  // Counter-clockwise order, renumbered by centroid y then x so ids follow the land.
  const order: number[] = []
  const rcx = new Float64Array(rawCount),
    rcy = new Float64Array(rawCount)
  for (let t = 0; t < rawCount; t++) {
    const a = raw[3 * t]!,
      b = raw[3 * t + 1]!,
      c = raw[3 * t + 2]!
    if (crossXY(vx[a]!, vy[a]!, vx[b]!, vy[b]!, vx[c]!, vy[c]!) === 0) continue
    rcx[t] = (vx[a]! + vx[b]! + vx[c]!) / 3
    rcy[t] = (vy[a]! + vy[b]! + vy[c]!) / 3
    order.push(t)
  }
  order.sort((p, q) => Math.floor(rcy[p]!) - Math.floor(rcy[q]!) || Math.floor(rcx[p]!) - Math.floor(rcx[q]!) || p - q)
  const triangles = order.length,
    renumber = new Int32Array(rawCount).fill(-1)
  for (let i = 0; i < triangles; i++) renumber[order[i]!] = i
  const tv = new Int32Array(3 * triangles),
    tn = new Int32Array(3 * triangles).fill(-1),
    shoreFlag = new Uint8Array(3 * triangles),
    cx = new Int32Array(triangles),
    cy = new Int32Array(triangles),
    area2 = new Float64Array(triangles)
  for (let i = 0; i < triangles; i++) {
    const t = order[i]!,
      a = raw[3 * t]!,
      b = raw[3 * t + 1]!,
      c = raw[3 * t + 2]!
    const ccw = crossXY(vx[a]!, vy[a]!, vx[b]!, vy[b]!, vx[c]!, vy[c]!) > 0
    // Raw edge e runs from raw[e] to raw[next(e)]; reversed order maps new edges 0, 1, 2 to raw 2, 1, 0.
    const verts = ccw ? [a, b, c] : [a, c, b],
      rawEdge = ccw ? [0, 1, 2] : [2, 1, 0]
    for (let e = 0; e < 3; e++) {
      tv[3 * i + e] = verts[e]!
      const h = 3 * t + rawEdge[e]!,
        opposite = halfedges[h]!
      if (opposite >= 0) tn[3 * i + e] = renumber[Math.floor(opposite / 3)]!
      if (constrained.isConstrained(h)) shoreFlag[3 * i + e] = 1
    }
    cx[i] = Math.floor(rcx[t]!)
    cy[i] = Math.floor(rcy[t]!)
    area2[i] = Math.abs(crossXY(vx[a]!, vy[a]!, vx[b]!, vy[b]!, vx[c]!, vy[c]!))
  }
  // 4. Area types, by the hydrology at each centroid.
  const area = new Uint8Array(triangles),
    body = new Int32Array(triangles).fill(-1),
    ground = new Uint8Array(triangles)
  for (let i = 0; i < triangles; i++) {
    const p = { x: (vx[tv[3 * i]!]! + vx[tv[3 * i + 1]!]! + vx[tv[3 * i + 2]!]!) / 3, y: 0 }
    p.y = (vy[tv[3 * i]!]! + vy[tv[3 * i + 1]!]! + vy[tv[3 * i + 2]!]!) / 3
    const cell =
      Math.min(water.cells - 1, Math.floor(p.y / water.cellCm)) * water.cells +
      Math.min(water.cells - 1, Math.floor(p.x / water.cellCm))
    ground[i] = terrain.ground[cell]!
    if (!shore || bankWaterHeight(shore, p, water.level) === null) continue
    const b = shore.patches.get(cell)?.body ?? water.body[cell]!
    if (b < 0) continue
    body[i] = b
    area[i] = water.bodies[b]!.kind === 'lake' ? LAKE_AREA : RIVER_AREA
  }
  // A triangle on a shore edge takes the side the hydrology gives that edge.
  const spanOf = new Map<number, number>()
  for (let s = 0; s < spanSide.length; s++) spanOf.set(shoreEdges[2 * s]! * vertices + shoreEdges[2 * s + 1]!, s)
  for (let i = 0; i < triangles; i++)
    for (let e = 0; e < 3; e++) {
      if (!shoreFlag[3 * i + e]) continue
      const a = tv[3 * i + e]!,
        b = tv[3 * i + ((e + 1) % 3)]!,
        forward = spanOf.get(a * vertices + b),
        s = forward ?? spanOf.get(b * vertices + a)
      if (s === undefined || !spanSide[s]) continue
      // The triangle lies left of its own counter-clockwise edge.
      const wet = forward !== undefined ? spanSide[s] > 0 : spanSide[s]! < 0
      if (wet === (area[i] !== GROUND_AREA)) continue
      body[i] = wet ? spanBody[s]! : -1
      area[i] = !wet ? GROUND_AREA : water.bodies[spanBody[s]!]!.kind === 'lake' ? LAKE_AREA : RIVER_AREA
    }
  // An edge is a shore exactly when it parts ground from water, constrained or not, so each such edge gets a bank;
  // a constrained edge the hydrology leaves with one type on both sides is not a shore.
  for (let i = 0; i < triangles; i++)
    for (let e = 0; e < 3; e++) {
      const n = tn[3 * i + e]!
      shoreFlag[3 * i + e] = n >= 0 && (area[i] === GROUND_AREA) !== (area[n] === GROUND_AREA) ? 1 : 0
    }
  // 5. Index: chunks and 20 m buckets.
  const chunkCells = Math.floor(sizeCm / settings.chunkCm) + 1,
    chunk = new Int32Array(triangles)
  for (let i = 0; i < triangles; i++)
    chunk[i] = Math.floor(cy[i]! / settings.chunkCm) * chunkCells + Math.floor(cx[i]! / settings.chunkCm)
  const byChunk = csr(chunkCells * chunkCells, triangles, (i, add) => add(chunk[i]!))
  const buckets = Math.ceil(sizeCm / bucketCm),
    byBucket = csr(buckets * buckets, triangles, (i, add) => {
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity
      for (let e = 0; e < 3; e++) {
        const v = tv[3 * i + e]!
        x0 = Math.min(x0, vx[v]!)
        x1 = Math.max(x1, vx[v]!)
        y0 = Math.min(y0, vy[v]!)
        y1 = Math.max(y1, vy[v]!)
      }
      for (let y = Math.floor(y0 / bucketCm); y <= Math.min(buckets - 1, Math.floor(y1 / bucketCm)); y++)
        for (let x = Math.floor(x0 / bucketCm); x <= Math.min(buckets - 1, Math.floor(x1 / bucketCm)); x++)
          add(y * buckets + x)
    })
  // 6. Walkable regions.
  const region = new Int32Array(triangles).fill(-1),
    regionArea2 = new Map<number, number>()
  let mainRegion = -1
  for (let root = 0; root < triangles; root++) {
    if (area[root] !== GROUND_AREA || region[root]! >= 0) continue
    region[root] = root
    const todo = [root]
    let total = 0
    for (let k = 0; k < todo.length; k++) {
      const t = todo[k]!
      total += area2[t]!
      for (let e = 0; e < 3; e++) {
        const n = tn[3 * t + e]!
        if (n >= 0 && area[n] === GROUND_AREA && region[n]! < 0) {
          region[n] = root
          todo.push(n)
        }
      }
    }
    regionArea2.set(root, total)
    if (mainRegion < 0 || total > regionArea2.get(mainRegion)!) mainRegion = root
  }
  return {
    sizeCm,
    vertices,
    vx,
    vy,
    vh,
    vdepth,
    triangles,
    tv,
    tn,
    shore: shoreFlag,
    area,
    body,
    ground,
    cx,
    cy,
    area2,
    chunkCm: settings.chunkCm,
    chunkCells,
    chunk,
    chunkStart: byChunk.start,
    chunkTriangles: byChunk.items,
    bucketCm,
    buckets,
    bucketStart: byBucket.start,
    bucketTriangles: byBucket.items,
    region,
    regionArea2,
    mainRegion,
    shoreEdges,
    constraintFailures,
  }
}

/** Compressed lists: items added in ascending triangle order stay ascending within each list. */
function csr(lists: number, count: number, each: (i: number, add: (list: number) => void) => void) {
  const start = new Int32Array(lists + 1)
  for (let i = 0; i < count; i++) each(i, (list) => start[list + 1]!++)
  for (let l = 0; l < lists; l++) start[l + 1]! += start[l]!
  const fill = start.slice(0, lists),
    items = new Int32Array(start[lists]!)
  for (let i = 0; i < count; i++) each(i, (list) => (items[fill[list]!++] = i))
  return { start, items }
}

function contains(mesh: GroundMesh, t: number, x: number, y: number) {
  const a = mesh.tv[3 * t]!,
    b = mesh.tv[3 * t + 1]!,
    c = mesh.tv[3 * t + 2]!
  return (
    crossXY(mesh.vx[a]!, mesh.vy[a]!, mesh.vx[b]!, mesh.vy[b]!, x, y) >= 0 &&
    crossXY(mesh.vx[b]!, mesh.vy[b]!, mesh.vx[c]!, mesh.vy[c]!, x, y) >= 0 &&
    crossXY(mesh.vx[c]!, mesh.vy[c]!, mesh.vx[a]!, mesh.vy[a]!, x, y) >= 0
  )
}
/** The lowest-numbered triangle holding a point, or -1 outside the valley. */
export function triangleAt(mesh: GroundMesh, x: number, y: number) {
  if (x < 0 || y < 0 || x > mesh.sizeCm || y > mesh.sizeCm) return -1
  const bucket =
    Math.min(mesh.buckets - 1, Math.floor(y / mesh.bucketCm)) * mesh.buckets +
    Math.min(mesh.buckets - 1, Math.floor(x / mesh.bucketCm))
  for (let k = mesh.bucketStart[bucket]!; k < mesh.bucketStart[bucket + 1]!; k++) {
    const t = mesh.bucketTriangles[k]!
    if (contains(mesh, t, x, y)) return t
  }
  return -1
}
/** The plane of a triangle at a point, from its vertices' heights; `bed` subtracts the water's depth. */
export function planeHeight(mesh: GroundMesh, t: number, x: number, y: number, bed = false) {
  const a = mesh.tv[3 * t]!,
    b = mesh.tv[3 * t + 1]!,
    c = mesh.tv[3 * t + 2]!
  const ax = mesh.vx[a]!,
    ay = mesh.vy[a]!,
    bx = mesh.vx[b]!,
    by = mesh.vy[b]!,
    cxv = mesh.vx[c]!,
    cyv = mesh.vy[c]!
  const ha = mesh.vh[a]! - (bed ? mesh.vdepth[a]! : 0),
    hb = mesh.vh[b]! - (bed ? mesh.vdepth[b]! : 0),
    hc = mesh.vh[c]! - (bed ? mesh.vdepth[c]! : 0)
  const total = crossXY(ax, ay, bx, by, cxv, cyv)
  return Math.floor(
    (crossXY(x, y, bx, by, cxv, cyv) * ha + crossXY(ax, ay, x, y, cxv, cyv) * hb + crossXY(ax, ay, bx, by, x, y) * hc) /
      total,
  )
}
/** Height of the mesh's surface at a point: ground on land, the water's surface on water. */
export function meshHeight(mesh: GroundMesh, x: number, y: number) {
  const t = triangleAt(mesh, Math.max(0, Math.min(mesh.sizeCm, x)), Math.max(0, Math.min(mesh.sizeCm, y)))
  return t < 0 ? 0 : planeHeight(mesh, t, x, y)
}
export const walkable = (mesh: GroundMesh, t: number) => t >= 0 && mesh.area[t] === GROUND_AREA
export const walkableAt = (mesh: GroundMesh, p: Point) => walkable(mesh, triangleAt(mesh, p.x, p.y))

const violationCache = new WeakMap<GroundMesh, string[]>()
/** Independent checks of an immutable mesh against the terrain and hydrology it was built from, run once per mesh. */
export function meshViolations(mesh: GroundMesh, terrain: Terrain, settings: MeshSettings): string[] {
  const saved = violationCache.get(mesh)
  if (saved) return saved
  const errors: string[] = []
  const { tv, tn, vx, vy, vh } = mesh
  let total = 0
  for (let t = 0; t < mesh.triangles; t++) {
    const a = tv[3 * t]!,
      b = tv[3 * t + 1]!,
      c = tv[3 * t + 2]!
    const area = crossXY(vx[a]!, vy[a]!, vx[b]!, vy[b]!, vx[c]!, vy[c]!)
    if (area <= 0) errors.push(`Triangle ${t} is not counter-clockwise`)
    total += area
    for (let e = 0; e < 3; e++) {
      const n = tn[3 * t + e]!,
        from = tv[3 * t + e]!,
        to = tv[3 * t + ((e + 1) % 3)]!
      if (n < 0) {
        const onEdge =
          (vx[from] === vx[to] && (vx[from] === 0 || vx[from] === mesh.sizeCm)) ||
          (vy[from] === vy[to] && (vy[from] === 0 || vy[from] === mesh.sizeCm))
        if (!onEdge) errors.push(`Triangle ${t} has no neighbour inside the valley`)
        continue
      }
      let mutual = false
      for (let f = 0; f < 3; f++)
        if (tn[3 * n + f] === t && tv[3 * n + f] === to && tv[3 * n + ((f + 1) % 3)] === from) mutual = true
      if (!mutual) errors.push(`Triangles ${t} and ${n} are not mutual neighbours`)
      if (mesh.shore[3 * t + e] && (mesh.area[t] === GROUND_AREA) === (mesh.area[n] === GROUND_AREA))
        errors.push(`Shore edge of triangle ${t} does not part water from ground`)
      if (!mesh.shore[3 * t + e] && mesh.area[t] === GROUND_AREA && mesh.area[n] !== GROUND_AREA)
        errors.push(`Ground triangle ${t} meets water across an edge that is not a shore`)
    }
    if (mesh.area[t] !== GROUND_AREA && mesh.body[t]! < 0) errors.push(`Water triangle ${t} has no body`)
  }
  if (total !== 2 * mesh.sizeCm ** 2) errors.push('Triangle areas do not sum to the valley')
  // Heights: at every dry terrain point the mesh's ground is within the tolerance of the terrain's.
  const shore = terrain.water.shore,
    c = terrain.cellCm
  let worst = 0
  for (let y = 0; y <= mesh.sizeCm; y += c)
    for (let x = 0; x <= mesh.sizeCm; x += c) {
      if (shore && bankWaterHeight(shore, { x, y }, terrain.water.level) !== null) continue
      const t = triangleAt(mesh, x, y)
      if (t < 0 || mesh.area[t] !== GROUND_AREA) continue
      worst = Math.max(worst, Math.abs(planeHeight(mesh, t, x, y) - heightAt(terrain, x, y)))
    }
  if (worst > settings.meshHeightToleranceCm) errors.push(`Mesh heights stray ${worst} cm from the terrain`)
  // Shores: every point of the hydrology's shoreline lies within the tolerance of a kept shore edge.
  if (shore) {
    const bucketCm = 2_000,
      grid = new Map<number, number[]>(),
      r = settings.shoreToleranceCm
    for (let s = 0; s < mesh.shoreEdges.length / 2; s++) {
      const a = mesh.shoreEdges[2 * s]!,
        b = mesh.shoreEdges[2 * s + 1]!
      for (
        let gy = Math.floor((Math.min(vy[a]!, vy[b]!) - r) / bucketCm);
        gy <= Math.floor((Math.max(vy[a]!, vy[b]!) + r) / bucketCm);
        gy++
      )
        for (
          let gx = Math.floor((Math.min(vx[a]!, vx[b]!) - r) / bucketCm);
          gx <= Math.floor((Math.max(vx[a]!, vx[b]!) + r) / bucketCm);
          gx++
        ) {
          const k = gy * 100_000 + gx,
            list = grid.get(k)
          if (list) list.push(s)
          else grid.set(k, [s])
        }
    }
    let far = 0
    for (const segment of shore.segments.values())
      for (const p of [segment.a, segment.b]) {
        const list = grid.get(Math.floor(p.y / bucketCm) * 100_000 + Math.floor(p.x / bucketCm)) ?? []
        if (
          !list.some((s) => {
            const a = mesh.shoreEdges[2 * s]!,
              b = mesh.shoreEdges[2 * s + 1]!
            return segmentDistanceSq(p.x, p.y, vx[a]!, vy[a]!, vx[b]!, vy[b]!) <= r * r
          })
        )
          far++
      }
    if (far) errors.push(`${far} shore points lie beyond shoreToleranceCm of the mesh's shore`)
    for (let s = 0; s < mesh.shoreEdges.length / 2; s++) {
      const a = mesh.shoreEdges[2 * s]!
      if (mesh.vdepth[a] !== 0) errors.push(`Shore vertex ${a} lies under water`)
    }
  }
  void vh
  violationCache.set(mesh, errors)
  return errors
}
