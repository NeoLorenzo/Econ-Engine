import type { WaterGrid } from './water'
import type { Point } from './types'

export interface BankVertex extends Point {
  h: number
  level: number
  bodies?: readonly number[]
}
export interface ShoreSegment {
  id: number
  cell: number
  wetCell: number
  body: number
  a: BankVertex
  b: BankVertex
}
export interface BankPatch {
  /** Triangles packed as x, map-y, height, in centimetres. */
  ground: Int32Array
  water: Int32Array
  body: number
  segments: ShoreSegment[]
}
export interface BankGeometry {
  cells: number
  cellCm: number
  body: Int32Array
  patchMask: Uint8Array
  patches: Map<number, BankPatch>
  segments: Map<number, ShoreSegment>
  /** Twice polygon area in square centimetres: half-square-centimetre triangles remain exact. */
  area2: Float64Array
  blocked: Map<number, number>
}

export const PATCH_RING = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
  [1, 2],
  [0, 2],
  [0, 1],
] as const
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
function triangles(polygon: BankVertex[], into: number[], surface = false) {
  let area2 = 0
  for (let i = 1; i + 1 < polygon.length; i++) {
    const points = [polygon[0]!, polygon[i]!, polygon[i + 1]!]
    const area = Math.abs(cross(points[0]!, points[1]!, points[2]!))
    if (!area) continue
    area2 += area
    for (const p of points) into.push(p.x, p.y, surface ? p.level : p.h)
  }
  return area2
}
function clipped(points: BankVertex[], wet: boolean, intersections: Map<string, BankVertex>) {
  const output: BankVertex[] = []
  const inside = (p: BankVertex) => (wet ? p.h <= p.level : p.h >= p.level)
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!
    if (inside(a)) output.push(a)
    if (inside(a) === inside(b)) continue
    const ka = `${a.x},${a.y},${a.h},${a.level}`,
      kb = `${b.x},${b.y},${b.h},${b.level}`
    const key = ka < kb ? `${ka}:${kb}` : `${kb}:${ka}`
    let p = intersections.get(key)
    if (!p) {
      // Snap along the shared edge, not independently in x and y; diagonals stay on their edge.
      const from = ka < kb ? a : b,
        to = ka < kb ? b : a
      let t = (from.level - from.h) / (to.h - to.level - (from.h - from.level))
      const dx = to.x - from.x,
        dy = to.y - from.y
      let x: number, y: number
      if (Math.abs(dx) >= Math.abs(dy)) {
        x = Math.round(from.x + dx * t)
        t = dx ? (x - from.x) / dx : 0
        y = Math.round(from.y + dy * t)
      } else {
        y = Math.round(from.y + dy * t)
        t = (y - from.y) / dy
        x = Math.round(from.x + dx * t)
      }
      const level = Math.round(from.level + (to.level - from.level) * t)
      p = { x, y, h: level, level }
      intersections.set(key, p)
    }
    output.push(p)
  }
  return output.filter((p, i) => i === 0 || p.x !== output[i - 1]!.x || p.y !== output[i - 1]!.y)
}

/** Construct once from hydrology samples. Every bank contour, contact and collision uses these same triangles. */
export function buildBanks(water: WaterGrid, corners: Int32Array): BankGeometry {
  const { cells, cellCm, body } = water,
    half = cellCm / 2,
    points = cells + 1
  const patches = new Map<number, BankPatch>(),
    segments = new Map<number, ShoreSegment>()
  const area2 = new Float64Array(water.bodies.length),
    blocked = new Map<number, number>()
  const geometry: BankGeometry = {
    cells,
    cellCm,
    body,
    patchMask: new Uint8Array(body.length),
    patches,
    segments,
    area2,
    blocked,
  }
  const candidates = new Set<number>()
  for (let id = 0; id < body.length; id++) {
    if (body[id]! < 0) continue
    const x = id % cells,
      y = Math.floor(id / cells)
    let boundary = water.bodies[body[id]!]!.kind === 'river'
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy
        if (nx < 0 || ny < 0 || nx >= cells || ny >= cells || body[ny * cells + nx]! < 0) boundary = true
      }
    if (!boundary) {
      area2[body[id]!]! += 2 * cellCm * cellCm
      continue
    }
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < cells && ny < cells) candidates.add(ny * cells + nx)
      }
  }
  // Interior wet cells included by a neighbour are accounted through their patches instead.
  for (const id of candidates)
    if (body[id]! >= 0) {
      const x = id % cells,
        y = Math.floor(id / cells)
      let boundary = water.bodies[body[id]!]!.kind === 'river'
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy
          if (nx < 0 || ny < 0 || nx >= cells || ny >= cells || body[ny * cells + nx]! < 0) boundary = true
        }
      if (!boundary) area2[body[id]!]! -= 2 * cellCm * cellCm
    }
  const nodeCache = new Map<number, BankVertex>()
  const node = (gx: number, gy: number): BankVertex => {
    const key = gy * (2 * cells + 1) + gx
    const saved = nodeCache.get(key)
    if (saved) return saved
    const x = gx * half,
      y = gy * half,
      i = Math.floor(gx / 2),
      j = Math.floor(gy / 2)
    const ix = Math.min(cells - 1, i),
      jy = Math.min(cells - 1, j),
      fx = gx / 2 - ix,
      fy = gy / 2 - jy
    let h = Math.floor(
      corners[jy * points + ix]! * (1 - fx) * (1 - fy) +
        corners[jy * points + ix + 1]! * fx * (1 - fy) +
        corners[(jy + 1) * points + ix]! * (1 - fx) * fy +
        corners[(jy + 1) * points + ix + 1]! * fx * fy,
    )
    const incident: number[] = []
    const xs = gx % 2 ? [i] : [i - 1, i],
      ys = gy % 2 ? [j] : [j - 1, j]
    for (const cy of ys)
      for (const cx of xs)
        if (cx >= 0 && cy >= 0 && cx < cells && cy < cells && body[cy * cells + cx]! >= 0)
          incident.push(cy * cells + cx)
    let level = h
    if (incident.length) {
      const lake = incident.find((id) => water.bodies[body[id]!]!.kind === 'lake')
      level =
        lake === undefined
          ? Math.floor(incident.reduce((s, id) => s + water.level[id]!, 0) / incident.length)
          : water.level[lake]!
      // Bed centres and shared submerged edges preserve connected channels and confluences.
      if ((gx % 2 && gy % 2) || incident.length === xs.length * ys.length)
        h = Math.min(level - 1, Math.floor(incident.reduce((s, id) => s + water.bed[id]!, 0) / incident.length))
    }
    const result = { x, y, h, level, bodies: incident.map((id) => body[id]!) }
    nodeCache.set(key, result)
    return result
  }
  const intersections = new Map<string, BankVertex>()
  for (const cell of [...candidates].sort((a, b) => a - b)) {
    geometry.patchMask[cell] = 1
    const x = cell % cells,
      y = Math.floor(cell / cells)
    let source = body[cell]! >= 0 ? cell : -1,
      best = Infinity
    if (source < 0)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy,
            id = ny * cells + nx
          if (nx < 0 || ny < 0 || nx >= cells || ny >= cells || body[id]! < 0) continue
          const d = dx * dx + dy * dy
          if (d < best || (d === best && id < source)) {
            source = id
            best = d
          }
        }
    const owner = body[source]!,
      lake = water.bodies[owner]!.kind === 'lake'
    const ring = PATCH_RING.map(([dx, dy]) => node(2 * x + dx, 2 * y + dy)),
      centre = node(2 * x + 1, 2 * y + 1)
    const ground: number[] = [],
      wet: number[] = [],
      shore: ShoreSegment[] = []
    for (let i = 0; i < 8; i++) {
      let triangle = [centre, ring[i]!, ring[(i + 1) % 8]!]
      // Lake contours are clipped against their single physical spill plane.
      if (lake) triangle = triangle.map((p) => ({ ...p, level: water.level[source]! }))
      const connected = body[cell]! >= 0 || triangle.some((p) => p.h < p.level && p.bodies?.includes(owner))
      const anyWet = triangle.some((p) => p.h < p.level)
      if (!anyWet) {
        triangles(triangle, ground)
        continue
      }
      const submerged = clipped(triangle, true, intersections),
        dry = clipped(triangle, false, intersections)
      if (connected) area2[owner]! += triangles(submerged, wet, true)
      triangles(submerged, ground)
      triangles(dry, ground)
      if (!connected) continue
      const edge = submerged.filter((p) => p.h === p.level)
      if (edge.length >= 2) {
        const a = edge[0]!,
          b = edge.at(-1)!
        if (a.x !== b.x || a.y !== b.y) {
          const segment = { id: cell * 8 + i, cell, wetCell: source, body: owner, a, b }
          shore.push(segment)
          segments.set(segment.id, segment)
        }
      }
    }
    patches.set(cell, { ground: new Int32Array(ground), water: new Int32Array(wet), body: owner, segments: shore })
  }
  // Static centre-to-centre edge safety is independent of what any person has learned.
  for (const cell of candidates) {
    if (
      bankWaterHeight(
        geometry,
        { x: ((cell % cells) + 0.5) * cellCm, y: (Math.floor(cell / cells) + 0.5) * cellCm },
        water.level,
      ) !== null
    )
      continue
    const x = cell % cells,
      y = Math.floor(cell / cells),
      a = { x: (x + 0.5) * cellCm, y: (y + 0.5) * cellCm }
    let mask = 0
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx,
          ny = y + dy
        if (nx < 0 || ny < 0 || nx >= cells || ny >= cells || body[ny * cells + nx]! >= 0) continue
        if (
          [-1, 0, 1].some((ox) =>
            [-1, 0, 1].some((oy) =>
              bankSegmentWet(
                geometry,
                { x: a.x + ox, y: a.y + oy },
                { x: (nx + 0.5) * cellCm + ox, y: (ny + 0.5) * cellCm + oy },
              ),
            ),
          )
        )
          mask |= 1 << ((dy + 1) * 3 + dx + 1)
      }
    if (mask) blocked.set(cell, mask)
  }
  for (const [cell, mask] of blocked) {
    const x = cell % cells,
      y = Math.floor(cell / cells)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!(mask & (1 << ((dy + 1) * 3 + dx + 1)))) continue
        const nx = x + dx,
          ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < cells && ny < cells) {
          const other = ny * cells + nx
          blocked.set(other, (blocked.get(other) ?? 0) | (1 << ((1 - dy) * 3 + 1 - dx)))
        }
      }
  }
  return geometry
}

const crossXY = (ax: number, ay: number, bx: number, by: number, x: number, y: number) =>
  (bx - ax) * (y - ay) - (by - ay) * (x - ax)
function inTriangle(data: Int32Array, i: number, p: Point) {
  const ax = data[i]!,
    ay = data[i + 1]!,
    bx = data[i + 3]!,
    by = data[i + 4]!,
    cx = data[i + 6]!,
    cy = data[i + 7]!
  const s = crossXY(ax, ay, bx, by, p.x, p.y),
    t = crossXY(bx, by, cx, cy, p.x, p.y),
    u = crossXY(cx, cy, ax, ay, p.x, p.y)
  return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0)
}
export function triangleHeight(data: Int32Array, x: number, y: number): number | null {
  const p = { x, y }
  for (let i = 0; i < data.length; i += 9) {
    if (!inTriangle(data, i, p)) continue
    const ax = data[i]!,
      ay = data[i + 1]!,
      bx = data[i + 3]!,
      by = data[i + 4]!,
      cx = data[i + 6]!,
      cy = data[i + 7]!
    const total = crossXY(ax, ay, bx, by, cx, cy)
    if (!total) continue
    return (
      (crossXY(x, y, bx, by, cx, cy) * data[i + 2]! +
        crossXY(ax, ay, x, y, cx, cy) * data[i + 5]! +
        crossXY(ax, ay, bx, by, x, y) * data[i + 8]!) /
      total
    )
  }
  return null
}
function cellAt(g: BankGeometry, p: Point) {
  return (
    Math.min(g.cells - 1, Math.max(0, Math.floor(p.y / g.cellCm))) * g.cells +
    Math.min(g.cells - 1, Math.max(0, Math.floor(p.x / g.cellCm)))
  )
}
export function bankWaterHeight(g: BankGeometry, p: Point, levels?: Int32Array): number | null {
  const cell = cellAt(g, p),
    patch = g.patches.get(cell)
  if (patch) return triangleHeight(patch.water, p.x, p.y)
  return g.body[cell]! >= 0 ? (levels?.[cell] ?? 0) : null
}
function intersects(a: Point, b: Point, cx: number, cy: number, dx: number, dy: number) {
  if (
    Math.max(a.x, b.x) < Math.min(cx, dx) ||
    Math.max(cx, dx) < Math.min(a.x, b.x) ||
    Math.max(a.y, b.y) < Math.min(cy, dy) ||
    Math.max(cy, dy) < Math.min(a.y, b.y)
  )
    return false
  return (
    crossXY(a.x, a.y, b.x, b.y, cx, cy) * crossXY(a.x, a.y, b.x, b.y, dx, dy) <= 0 &&
    crossXY(cx, cy, dx, dy, a.x, a.y) * crossXY(cx, cy, dx, dy, b.x, b.y) <= 0
  )
}
function wetInCell(g: BankGeometry, cell: number, a: Point, b: Point) {
  if (!g.patchMask[cell]) return g.body[cell]! >= 0
  const data = g.patches.get(cell)!.water
  for (let i = 0; i < data.length; i += 9) {
    if (inTriangle(data, i, a) || inTriangle(data, i, b)) return true
    for (let e = 0; e < 3; e++) {
      const j = i + 3 * e,
        k = i + 3 * ((e + 1) % 3)
      if (intersects(a, b, data[j]!, data[j + 1]!, data[k]!, data[k + 1]!)) return true
    }
  }
  return false
}
/** Supercover traversal tests only the water triangles in cells touched by the segment. */
export function bankSegmentWet(g: BankGeometry, a: Point, b: Point) {
  const c = g.cellCm,
    dx = b.x - a.x,
    dy = b.y - a.y,
    sx = Math.sign(dx),
    sy = Math.sign(dy),
    ax = Math.abs(dx),
    ay = Math.abs(dy)
  let x = Math.floor(a.x / c),
    y = Math.floor(a.y / c)
  const ex = Math.floor(b.x / c),
    ey = Math.floor(b.y / c)
  let tx = sx > 0 ? (x + 1) * c - a.x : a.x - x * c,
    ty = sy > 0 ? (y + 1) * c - a.y : a.y - y * c
  const wet = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < g.cells && j < g.cells && wetInCell(g, j * g.cells + i, a, b)
  for (let steps = 0; steps <= 2 * g.cells + 2; steps++) {
    if (wet(x, y) || (!dx && a.x % c === 0 && wet(x - 1, y)) || (!dy && a.y % c === 0 && wet(x, y - 1))) return true
    if (x === ex && y === ey) return false
    const px = dx ? tx * ay : Infinity,
      py = dy ? ty * ax : Infinity
    if (px === py) {
      if (wet(x + sx, y) || wet(x, y + sy)) return true
      x += sx
      y += sy
      tx += c
      ty += c
    } else if (px < py) {
      x += sx
      tx += c
    } else {
      y += sy
      ty += c
    }
  }
  return true
}
function pointSegmentXY(p: Point, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay,
    t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1)))
  return (p.x - ax - t * dx) ** 2 + (p.y - ay - t * dy) ** 2
}
function pointSegmentSq(p: Point, a: Point, b: Point) {
  return pointSegmentXY(p, a.x, a.y, b.x, b.y)
}
export function bankCircleWet(g: BankGeometry, p: Point, r: number) {
  const c = g.cellCm
  for (let y = Math.max(0, Math.ceil((p.y - r) / c) - 1); y <= Math.min(g.cells - 1, Math.floor((p.y + r) / c)); y++)
    for (
      let x = Math.max(0, Math.ceil((p.x - r) / c) - 1);
      x <= Math.min(g.cells - 1, Math.floor((p.x + r) / c));
      x++
    ) {
      const cell = y * g.cells + x
      if (!g.patchMask[cell]) {
        if (g.body[cell]! >= 0) {
          const dx = p.x - Math.max(x * c, Math.min((x + 1) * c, p.x)),
            dy = p.y - Math.max(y * c, Math.min((y + 1) * c, p.y))
          if (dx * dx + dy * dy <= r * r) return true
        }
        continue
      }
      const data = g.patches.get(cell)!.water
      for (let i = 0; i < data.length; i += 9) {
        if (inTriangle(data, i, p)) return true
        for (let e = 0; e < 3; e++) {
          const j = i + 3 * e,
            k = i + 3 * ((e + 1) % 3)
          if (pointSegmentXY(p, data[j]!, data[j + 1]!, data[k]!, data[k + 1]!) <= r * r) return true
        }
      }
    }
  return false
}

/** A dry approach to a real contour, not the old perimeter of its generating cell. */
export function bankApproach(
  g: BankGeometry,
  segment: ShoreSegment,
  reachCm: number,
  maximumHeightCm: number,
  height: (x: number, y: number) => number,
  bodyId: number,
  minute: number,
) {
  const dx = segment.b.x - segment.a.x,
    dy = segment.b.y - segment.a.y,
    length = Math.hypot(dx, dy)
  if (!length || reachCm <= 0) return null
  const inset = Math.min(50, reachCm),
    mx = (segment.a.x + segment.b.x) / 2,
    my = (segment.a.y + segment.b.y) / 2
  const level = (segment.a.level + segment.b.level) / 2
  for (const sign of [1, -1]) {
    const x = Math.round(mx - ((sign * dy) / length) * inset),
      y = Math.round(my + ((sign * dx) / length) * inset)
    if (x < 0 || y < 0 || x >= g.cells * g.cellCm || y >= g.cells * g.cellCm) continue
    if (
      bankCircleWet(g, { x, y }, 1) ||
      pointSegmentSq({ x, y }, segment.a, segment.b) > reachCm ** 2 ||
      height(x, y) - level > maximumHeightCm
    )
      continue
    return {
      id: segment.id,
      segmentId: segment.id,
      bodyId,
      wetCell: segment.wetCell,
      dryCell: cellAt(g, { x, y }),
      x,
      y,
      minute,
    }
  }
  return null
}

/** Independent immutable-record checks, run once by the minute checker. */
export function bankViolations(g: BankGeometry, water: WaterGrid) {
  const errors: string[] = [],
    areas = new Float64Array(water.bodies.length)
  for (let cell = 0; cell < g.body.length; cell++) {
    const patch = g.patches.get(cell)
    if (!patch) {
      if (g.body[cell]! >= 0) areas[g.body[cell]!]! += 2 * g.cellCm ** 2
      continue
    }
    if (patch.body < 0 || patch.body >= areas.length) {
      errors.push('Invalid bank body')
      continue
    }
    const x = (cell % g.cells) * g.cellCm,
      y = Math.floor(cell / g.cells) * g.cellCm
    for (const data of [patch.ground, patch.water]) {
      if (data.length % 9) errors.push('Incomplete bank triangle')
      for (let i = 0; i < data.length; i += 3)
        if (data[i]! < x || data[i]! > x + g.cellCm || data[i + 1]! < y || data[i + 1]! > y + g.cellCm)
          errors.push('Bank triangle outside its patch')
    }
    for (let i = 0; i < patch.water.length; i += 9) {
      const d = patch.water,
        a = { x: d[i]!, y: d[i + 1]! },
        b = { x: d[i + 3]!, y: d[i + 4]! },
        c = { x: d[i + 6]!, y: d[i + 7]! }
      const area = Math.abs(cross(a, b, c))
      if (!area) errors.push('Degenerate wet triangle')
      areas[patch.body]! += area
      if (water.bodies[patch.body]!.kind === 'lake')
        for (const offset of [2, 5, 8])
          if (d[i + offset] !== water.level[water.bodies[patch.body]!.cells[0]!]) errors.push('Uneven lake contour')
    }
    for (const segment of patch.segments) {
      if (
        g.segments.get(segment.id) !== segment ||
        segment.cell !== cell ||
        segment.id < cell * 8 ||
        segment.id >= cell * 8 + 8 ||
        water.body[segment.wetCell] !== patch.body
      )
        errors.push('Invalid shore segment identity')
      for (const p of [segment.a, segment.b])
        if (triangleHeight(patch.ground, p.x, p.y) !== p.level)
          errors.push(
            `Shore ${segment.id} at ${p.x},${p.y}: ground ${triangleHeight(patch.ground, p.x, p.y)}, water ${p.level}`,
          )
    }
  }
  for (let body = 0; body < areas.length; body++)
    if (areas[body] !== g.area2[body] || water.bodies[body]!.areaM2 !== Math.floor(areas[body]! / 20000))
      errors.push('Invalid continuous water area')
  return errors
}
