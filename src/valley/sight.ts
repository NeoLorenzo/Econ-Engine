import { isDaylight } from './forager'
import { distance, distanceSq } from './geometry'
import { observeGround } from './waterKnowledge'
import { forEachPlantWithin } from './layout'
import { siteGeometry } from './sites'
import { observePlaces, placeBounds, placeCount, placesPerSide } from './social'
import { heightAt, cellOf, type Terrain } from './terrain'
import type { Forager, Plants, Point, ValleyConfig, ValleyLayout, ValleyState } from './types'

// Long sight over the land. Hills block it: by day a forager sees, within `sightRadiusCm` of the centre of the place it
// stands in, only what lies in places visible from that place. Place `q` is visible from place `p` when the line from
// `eyeHeightCm` above the ground at `p`'s centre to `eyeHeightCm` above the ground at `q`'s stays above the ground at
// every `sightStepCm` along it. What each place sees is worked out the first time someone stands in it by day, and
// kept outside the state for the run. Close sight is never blocked.

/** Water surfaces, rather than submerged beds, are the visible surface crossed by sight rays. */
function sightHeightAt(terrain: Terrain, x: number, y: number) {
  const cell = cellOf(terrain, x, y)
  return terrain.water.body[cell]! >= 0 ? terrain.water.level[cell]! : heightAt(terrain, x, y)
}
/** The place holding a point. */
export function placeOf(config: ValleyConfig, x: number, y: number) {
  const n = placesPerSide(config)
  const column = Math.max(0, Math.min(n - 1, Math.floor(x / config.placeCm)))
  const row = Math.max(0, Math.min(n - 1, Math.floor(y / config.placeCm)))
  return row * n + column
}

/** A place's centre: the midpoint of its corners, rounded down. */
export function placeCentreOf(config: ValleyConfig, place: number): Point {
  const { x0, y0, x1, y1 } = placeBounds(config, place)
  return { x: Math.floor((x0 + x1) / 2), y: Math.floor((y0 + y1) / 2) }
}

/** Whether the line of sight between two points, each `eyeHeightCm` above the ground, clears the ground between them. */
export function lineClear(config: ValleyConfig, terrain: Terrain, from: Point, to: Point) {
  const d = distance(from.x, from.y, to.x, to.y)
  const steps = Math.ceil(d / config.sightStepCm)
  if (steps <= 1) return true
  const h0 = sightHeightAt(terrain, from.x, from.y) + config.eyeHeightCm
  const h1 = sightHeightAt(terrain, to.x, to.y) + config.eyeHeightCm
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dh = h1 - h0
  for (let k = 1; k < steps; k += 1) {
    const x = from.x + Math.trunc((dx * k) / steps)
    const y = from.y + Math.trunc((dy * k) / steps)
    if (sightHeightAt(terrain, x, y) > h0 + Math.floor((dh * k) / steps)) return false
  }
  return true
}

/** Whether place `q` is visible from place `p`. */
export const placeVisible = (config: ValleyConfig, terrain: Terrain, p: number, q: number) =>
  p === q || lineClear(config, terrain, placeCentreOf(config, p), placeCentreOf(config, q))

/** What a forager sees by long sight from one place. Every list is sorted. */
export interface PlaceView {
  place: number
  /** Places with a point within `sightRadiusCm` of its centre that are visible from it. */
  visible: Int32Array
  /** Of those, the places wholly within sight: all four corners within `sightRadiusCm`. */
  whole: Int32Array
  /** Sites, trees and stone spots within sight in visible places. */
  sites: Int32Array
  trees: Int32Array
  stones: Int32Array
  /** Whether a point of the lake's shore is within sight in a visible place. */
}

/** The things of one kind in each place, as offsets into one list of IDs. */
interface PlaceLists {
  start: Int32Array
  ids: Int32Array
}

function listsOf(config: ValleyConfig, points: Plants): PlaceLists {
  const places = placeCount(config)
  const start = new Int32Array(places + 1)
  const placeOfId = new Int32Array(points.count)
  for (let id = 0; id < points.count; id += 1) {
    const place = placeOf(config, points.x[id]!, points.y[id]!)
    placeOfId[id] = place
    start[place + 1]! += 1
  }
  for (let place = 0; place < places; place += 1) start[place + 1]! += start[place]!
  const fill = start.slice(0, places)
  const ids = new Int32Array(points.count)
  for (let id = 0; id < points.count; id += 1) ids[fill[placeOfId[id]!]!++] = id
  return { start, ids }
}

interface SightCache {
  sites: PlaceLists
  trees: PlaceLists
  stones: PlaceLists
  views: Map<number, PlaceView>
  /** Places marked by the rays of the view being worked out; cleared as it is read. */
  seen: Uint8Array
}

const caches = new WeakMap<ValleyLayout, SightCache>()
/** Views kept at once; the one used longest ago goes first. */
const VIEW_LIMIT = 4_096

function cacheOf(config: ValleyConfig, layout: ValleyLayout): SightCache {
  let cache = caches.get(layout)
  if (!cache) {
    cache = {
      sites: listsOf(config, layout.sitePoints),
      trees: listsOf(config, layout.trees),
      stones: listsOf(config, layout.stones),
      views: new Map(),
      seen: new Uint8Array(placeCount(config)),
    }
    caches.set(layout, cache)
  }
  return cache
}

/** What a forager standing in `place` sees by day. */
export function viewFrom(config: ValleyConfig, layout: ValleyLayout, place: number): PlaceView {
  const cache = cacheOf(config, layout)
  const known = cache.views.get(place)
  if (known) {
    cache.views.delete(place)
    cache.views.set(place, known)
    return known
  }
  const view = computeView(config, layout, cache, place)
  if (cache.views.size >= VIEW_LIMIT) cache.views.delete(cache.views.keys().next().value!)
  cache.views.set(place, view)
  return view
}

/**
 * Marks every place a ray from a viewer's eye reaches: rays run from the centre of its place towards each point of the
 * square of place centres twice its sight away, and are sampled every `sightStepCm` out to `sightRadiusCm`. A sample
 * `d` along a ray is seen when an eye there, `eyeHeightCm` above the ground, lies at or above the steepest line from
 * the viewer's eye over the ground sampled before it; its place is then visible.
 */
function castRays(config: ValleyConfig, terrain: Terrain, cache: SightCache, centre: Point) {
  const seen = cache.seen
  const n = placesPerSide(config)
  const step = config.sightStepCm
  const r = config.sightRadiusCm
  const size = config.valleySizeCm
  const eye = config.eyeHeightCm
  const h0 = sightHeightAt(terrain, centre.x, centre.y) + eye
  const reach = Math.ceil(r / config.placeCm) + 1
  const span = reach * config.placeCm
  const steps = Math.floor(r / step)
  const ray = (ex: number, ey: number) => {
    const dx = ex - centre.x
    const dy = ey - centre.y
    const length = distance(centre.x, centre.y, ex, ey)
    // The steepest rise of the ground seen so far, as a fraction: `rise / run`.
    let rise = 0
    let run = 0
    for (let k = 1; k <= steps; k += 1) {
      const d = k * step
      let x = centre.x + Math.trunc((dx * d) / length)
      let y = centre.y + Math.trunc((dy * d) / length)
      // A ray leaving the land takes one last sample where it crosses the edge, so the edge's places are reached.
      const leaving = x < 0 || y < 0 || x > size || y > size
      if (leaving) {
        const over = Math.max(-x, -y, x - size, y - size, 0)
        const along = Math.max(Math.abs(dx), Math.abs(dy))
        x -= Math.trunc((dx * over) / along)
        y -= Math.trunc((dy * over) / along)
        x = Math.max(0, Math.min(size, x))
        y = Math.max(0, Math.min(size, y))
      }
      const ground = sightHeightAt(terrain, x, y)
      if (run === 0 || (ground + eye - h0) * run >= rise * d) seen[placeOf(config, x, y)] = 1
      if (run === 0 || (ground - h0) * run > rise * d) {
        rise = ground - h0
        run = d
      }
      if (leaving) return
    }
  }
  for (let offset = -reach; offset < reach; offset += 1) {
    const along = offset * config.placeCm
    ray(centre.x + along, centre.y - span)
    ray(centre.x + span, centre.y + along)
    ray(centre.x - along, centre.y + span)
    ray(centre.x - span, centre.y - along)
  }
  if (seen.length !== n * n) throw new Error('A sight cache must cover every place')
  return seen
}

function computeView(config: ValleyConfig, layout: ValleyLayout, cache: SightCache, place: number): PlaceView {
  const { terrain } = layout
  const r = config.sightRadiusCm
  const r2 = r * r
  const centre = placeCentreOf(config, place)
  const n = placesPerSide(config)
  const reach = Math.ceil(r / config.placeCm) + 1
  const column = place % n
  const row = Math.floor(place / n)
  const visible: number[] = []
  const whole: number[] = []
  const sites: number[] = []
  const trees: number[] = []
  const stones: number[] = []
  const collect = (lists: PlaceLists, points: Plants, q: number, into: number[]) => {
    for (let k = lists.start[q]!; k < lists.start[q + 1]!; k += 1) {
      const id = lists.ids[k]!
      if (distanceSq(points.x[id]!, points.y[id]!, centre.x, centre.y) <= r2) into.push(id)
    }
  }
  const seen = castRays(config, terrain, cache, centre)
  for (let qr = Math.max(0, row - reach); qr <= Math.min(n - 1, row + reach); qr += 1)
    for (let qc = Math.max(0, column - reach); qc <= Math.min(n - 1, column + reach); qc += 1) {
      const q = qr * n + qc
      if (!seen[q] && q !== place) continue
      seen[q] = 0
      const bounds = placeBounds(config, q)
      // A place with no point within sight holds nothing to see.
      const nx = Math.max(bounds.x0, Math.min(bounds.x1, centre.x))
      const ny = Math.max(bounds.y0, Math.min(bounds.y1, centre.y))
      if (distanceSq(nx, ny, centre.x, centre.y) > r2) continue
      visible.push(q)
      const fx = Math.max(Math.abs(bounds.x0 - centre.x), Math.abs(bounds.x1 - centre.x))
      const fy = Math.max(Math.abs(bounds.y0 - centre.y), Math.abs(bounds.y1 - centre.y))
      if (fx * fx + fy * fy <= r2) whole.push(q)
      collect(cache.sites, layout.sitePoints, q, sites)
      collect(cache.trees, layout.trees, q, trees)
      collect(cache.stones, layout.stones, q, stones)
      // The nearest point of the shore in a place of the first row lies straight north of the centre, or at a corner.
    }
  const sorted = (ids: number[]) => Int32Array.from(ids).sort()
  return {
    place,
    visible: sorted(visible),
    whole: sorted(whole),
    sites: sorted(sites),
    trees: sorted(trees),
    stones: sorted(stones),
  }
}

/** Whether a sorted list holds a value. */
export function holds(list: Int32Array, value: number) {
  let low = 0
  let high = list.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const at = list[middle]!
    if (at === value) return true
    if (at < value) low = middle + 1
    else high = middle - 1
  }
  return false
}

/**
 * A forager's observation of everything but the food and wood on plants. Every minute, by close sight: the logs on
 * trees and stones on stone spots, sites, places wholly in view, and the shore within `perceptionRadiusCm`, and the
 * sites it stands close enough to check. By day, by long sight from its place, whenever it stands in a new place and
 * at least every hour: the logs on every tree and the stones on every stone spot it sees, every site it sees, every
 * place wholly in sight, and the shore. Every minute, the standing flags it sees, and the known flags whose spot it
 * sees holding none.
 */
export function observeAround(state: ValleyState, forager: Forager, minute: number) {
  const { config, layout } = state
  const { x, y } = forager
  const close = config.perceptionRadiusCm
  const recordTree = (id: number) => {
    forager.logMemory.stock[id] = state.treeLogs[id]!
    forager.logMemory.seen[id] = minute
  }
  const recordStone = (id: number) => {
    forager.stoneMemory.stock[id] = state.stoneStock[id]!
    forager.stoneMemory.seen[id] = minute
  }
  forEachPlantWithin(layout.treeIndex, layout.trees, x, y, close, recordTree)
  forEachPlantWithin(layout.stoneIndex, layout.stones, x, y, close, recordStone)
  const { checkSq } = siteGeometry(config, layout)
  forEachPlantWithin(layout.siteIndex, layout.sitePoints, x, y, close, (site) => {
    forager.siteKnown[site] = 1
    if (distanceSq(x, y, layout.sitePoints.x[site]!, layout.sitePoints.y[site]!) <= checkSq[site]!)
      forager.siteChecked[site] = minute
  })
  observePlaces(config, forager, minute)
  observeGround(config, layout, forager, minute, forager, close, () => true)
  const day = isDaylight(config, minute)
  if (!day) forager.farPlace = -1
  else {
    const place = placeOf(config, x, y)
    if (place !== forager.farPlace || minute - forager.farMinute >= 60) {
      const view = viewFrom(config, layout, place)
      for (const id of view.trees) recordTree(id)
      for (const id of view.stones) recordStone(id)
      for (const site of view.sites) forager.siteKnown[site] = 1
      for (const seen of view.whole)
        if (forager.placeSeen[seen]! < 0) {
          forager.placeSeen[seen] = minute
          forager.placesSeen += 1
        }
      const visiblePlaces = new Set(view.visible)
      observeGround(
        config,
        layout,
        forager,
        minute,
        placeCentreOf(config, place),
        config.sightRadiusCm,
        (point) => visiblePlaces.has(placeOf(config, point.x, point.y)),
        true,
      )
      forager.farPlace = place
      forager.farMinute = minute
    }
  }
  for (const group of state.groups) {
    if (!seesPoint(config, layout, x, y, group.flag.x, group.flag.y, day)) continue
    const known = forager.knownFlags.includes(group.id)
    if (group.dissolvedMinute === null && !known) forager.knownFlags = [...forager.knownFlags, group.id]
    if (group.dissolvedMinute !== null && known) forager.knownFlags = forager.knownFlags.filter((id) => id !== group.id)
  }
}

/** The nearest other living forager a forager sees, ties to the lowest ID, or null. */
export function nearestSeen(state: ValleyState, forager: Forager, minute: number) {
  const { config, layout } = state
  const day = isDaylight(config, minute)
  let best: Forager | null = null
  let bestSq = Infinity
  for (const other of state.foragers) {
    if (!other.alive || other.id === forager.id) continue
    const sq = distanceSq(forager.x, forager.y, other.x, other.y)
    if (sq > bestSq || (sq === bestSq && best !== null && other.id > best.id)) continue
    if (!seesPoint(config, layout, forager.x, forager.y, other.x, other.y, day)) continue
    best = other
    bestSq = sq
  }
  return best
}

/**
 * Whether a forager at `(x, y)` sees a point: within close sight, or by day within long sight of its place's centre in
 * a place visible from its own.
 */
export function seesPoint(
  config: ValleyConfig,
  layout: ValleyLayout,
  x: number,
  y: number,
  px: number,
  py: number,
  day: boolean,
) {
  if (distanceSq(x, y, px, py) <= config.perceptionRadiusCm ** 2) return true
  if (!day) return false
  const place = placeOf(config, x, y)
  const centre = placeCentreOf(config, place)
  if (distanceSq(px, py, centre.x, centre.y) > config.sightRadiusCm ** 2) return false
  const target = placeOf(config, px, py)
  return holds(viewFrom(config, layout, place).visible, target)
}
