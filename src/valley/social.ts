import { spiralOffsets } from './config'
import { daylightSecondsLeft } from './forager'
import { distance, distanceSq, walkSeconds } from './geometry'
import type {
  ActionReason,
  DissolveEvent,
  Forager,
  Group,
  GroupEvent,
  Point,
  ValleyConfig,
  ValleyLayout,
  ValleyState,
} from './types'

// Life 6: places a forager has seen, exploring and searching, flags, and meeting, founding, joining and dissolving.

/** Places along each side of the valley; the last row and column are cut at the valley's edge. */
export const placesPerSide = (config: ValleyConfig) => Math.ceil(config.valleySizeCm / config.placeCm)

export const placeCount = (config: ValleyConfig) => placesPerSide(config) ** 2

/** The corners of place `place`: column `place mod n`, row `floor(place / n)`. */
export function placeBounds(config: ValleyConfig, place: number) {
  const n = placesPerSide(config)
  const x0 = (place % n) * config.placeCm
  const y0 = Math.floor(place / n) * config.placeCm
  return {
    x0,
    y0,
    x1: Math.min(config.valleySizeCm, x0 + config.placeCm),
    y1: Math.min(config.valleySizeCm, y0 + config.placeCm),
  }
}

/** Every place's corners and centre, by ID, kept per configuration; they hold no simulation state. */
interface PlaceGrid {
  x0: Int32Array
  y0: Int32Array
  x1: Int32Array
  y1: Int32Array
  cx: Int32Array
  cy: Int32Array
}

const grids = new WeakMap<ValleyConfig, PlaceGrid>()

function gridOf(config: ValleyConfig): PlaceGrid {
  let grid = grids.get(config)
  if (!grid) {
    const count = placeCount(config)
    grid = {
      x0: new Int32Array(count),
      y0: new Int32Array(count),
      x1: new Int32Array(count),
      y1: new Int32Array(count),
      cx: new Int32Array(count),
      cy: new Int32Array(count),
    }
    for (let place = 0; place < count; place += 1) {
      const { x0, y0, x1, y1 } = placeBounds(config, place)
      grid.x0[place] = x0
      grid.y0[place] = y0
      grid.x1[place] = x1
      grid.y1[place] = y1
      grid.cx[place] = Math.floor((x0 + x1) / 2)
      grid.cy[place] = Math.floor((y0 + y1) / 2)
    }
    grids.set(config, grid)
  }
  return grid
}

/** The midpoint of a place's corners, rounded down. */
export function placeCentre(config: ValleyConfig, place: number): Point {
  const grid = gridOf(config)
  return { x: grid.cx[place]!, y: grid.cy[place]! }
}

/** Whether all four corners of a place lie within the perception radius of a point. */
export function placeInView(config: ValleyConfig, place: number, x: number, y: number) {
  const grid = gridOf(config)
  const dx = Math.max(Math.abs(grid.x0[place]! - x), Math.abs(grid.x1[place]! - x))
  const dy = Math.max(Math.abs(grid.y0[place]! - y), Math.abs(grid.y1[place]! - y))
  return dx * dx + dy * dy <= config.perceptionRadiusCm ** 2
}

/** Calls `visit` with every place that could lie wholly within the perception radius of a point. */
function forEachPlaceNear(config: ValleyConfig, x: number, y: number, visit: (place: number) => void) {
  const n = placesPerSide(config)
  const r = config.perceptionRadiusCm
  const column0 = Math.max(0, Math.floor((x - r) / config.placeCm))
  const column1 = Math.min(n - 1, Math.floor((x + r) / config.placeCm))
  const row0 = Math.max(0, Math.floor((y - r) / config.placeCm))
  const row1 = Math.min(n - 1, Math.floor((y + r) / config.placeCm))
  for (let row = row0; row <= row1; row += 1)
    for (let column = column0; column <= column1; column += 1) visit(row * n + column)
}

/** Marks every place wholly in view as seen this minute. */
export function observePlaces(config: ValleyConfig, forager: Forager, minute: number) {
  forEachPlaceNear(config, forager.x, forager.y, (place) => {
    if (!placeInView(config, place, forager.x, forager.y)) return
    if (forager.placeSeen[place]! < 0) forager.placesSeen += 1
    forager.placeSeen[place] = minute
  })
}

/** Learns every standing flag in view, and forgets every known flag whose spot is in view and holds none. */
export function observeFlags(config: ValleyConfig, forager: Forager, groups: readonly Group[]) {
  const r2 = config.perceptionRadiusCm ** 2
  for (const group of groups) {
    if (distanceSq(forager.x, forager.y, group.flag.x, group.flag.y) > r2) continue
    const known = forager.knownFlags.includes(group.id)
    if (group.dissolvedMinute === null && !known) forager.knownFlags = [...forager.knownFlags, group.id]
    if (group.dissolvedMinute !== null && known) forager.knownFlags = forager.knownFlags.filter((id) => id !== group.id)
  }
}

/** Whether a point can be walked to and home from before dusk, from the start of minute `minute`. */
export function reachableAndBack(config: ValleyConfig, forager: Forager, x: number, y: number, minute: number) {
  const there = walkSeconds(distance(forager.x, forager.y, x, y), config.walkCmPerSecond)
  const home = walkSeconds(distance(x, y, forager.hearth.x, forager.hearth.y), config.walkCmPerSecond)
  return there + home <= daylightSecondsLeft(config, minute)
}

/** Exploring goes to places not seen for `exploreAfterHours` or never; searching only to places never seen. */
export type PlaceSearch = 'explore' | 'search'

export function placeWanted(config: ValleyConfig, forager: Forager, place: number, minute: number, why: PlaceSearch) {
  const seen = forager.placeSeen[place]!
  if (seen < 0) return true
  return why === 'explore' && minute - seen >= 60 * config.exploreAfterHours
}

/**
 * The place a forager saw longest ago, and when, kept by its memory of places, so a copied forager looks again. Places
 * are only ever seen again later, so it stays the oldest until it is seen again. It holds no simulation state.
 */
const oldestPlaces = new WeakMap<Int32Array, { place: number; seen: number }>()

/** Whether no place can be wanted this minute, without looking at every place. */
function nothingWanted(config: ValleyConfig, forager: Forager, minute: number, why: PlaceSearch) {
  if (forager.placesSeen < placeCount(config)) return false
  if (why === 'search') return true
  const memory = forager.placeSeen
  let oldest = oldestPlaces.get(memory)
  if (!oldest || memory[oldest.place] !== oldest.seen) {
    oldest = { place: 0, seen: memory[0]! }
    for (let place = 1; place < memory.length; place += 1)
      if (memory[place]! < oldest.seen) oldest = { place, seen: memory[place]! }
    oldestPlaces.set(memory, oldest)
  }
  return minute - oldest.seen < 60 * config.exploreAfterHours
}

/**
 * The place a forager walks to explore or search: its target while that is still wanted and reachable, otherwise the
 * nearest wanted place it can reach and return home from before dusk, by the distance to its centre, ties to the lowest
 * ID; or null. It searches rings of places outwards and stops once no nearer place can remain. Sets the target.
 */
export function choosePlace(config: ValleyConfig, forager: Forager, minute: number, why: PlaceSearch): number | null {
  const grid = gridOf(config)
  const wanted = (place: number) => placeWanted(config, forager, place, minute, why)
  const reachable = (place: number) => reachableAndBack(config, forager, grid.cx[place]!, grid.cy[place]!, minute)
  const target = forager.exploreTarget
  if (target !== null && wanted(target) && reachable(target)) return target
  if (nothingWanted(config, forager, minute, why)) {
    forager.exploreTarget = null
    return null
  }
  const n = placesPerSide(config)
  const cx = Math.min(n - 1, Math.max(0, Math.floor(forager.x / config.placeCm)))
  const cy = Math.min(n - 1, Math.max(0, Math.floor(forager.y / config.placeCm)))
  let best: number | null = null
  let bestSq = Infinity
  // Nothing further than it can walk in the daylight left can be reached and left in time.
  const range = daylightSecondsLeft(config, minute) * config.walkCmPerSecond
  for (let ring = 0; ring < n; ring += 1) {
    // Every place in ring `ring` has its centre at least `(ring − 1) · placeCm` away.
    const floor = Math.max(0, (ring - 1) * config.placeCm)
    if (floor * floor > bestSq || floor > range) break
    for (let row = cy - ring; row <= cy + ring; row += 1) {
      if (row < 0 || row >= n) continue
      const edge = row === cy - ring || row === cy + ring
      for (let column = cx - ring; column <= cx + ring; column += edge ? 1 : 2 * ring) {
        if (column >= 0 && column < n) {
          const place = row * n + column
          if (wanted(place)) {
            const sq = distanceSq(forager.x, forager.y, grid.cx[place]!, grid.cy[place]!)
            if ((sq < bestSq || (sq === bestSq && place < best!)) && reachable(place)) {
              best = place
              bestSq = sq
            }
          }
        }
        if (ring === 0) break
      }
    }
  }
  forager.exploreTarget = best
  return best
}

/** The nearest other living forager within `radius`, ties to the lowest ID, or null. */
export function nearestOther(forager: Forager, foragers: readonly Forager[], radius: number) {
  let best: Forager | null = null
  let bestSq = radius * radius
  for (const other of foragers) {
    if (!other.alive || other.id === forager.id) continue
    const sq = distanceSq(forager.x, forager.y, other.x, other.y)
    if (sq < bestSq || (sq === bestSq && (best === null || other.id < best.id))) {
      best = other
      bestSq = sq
    }
  }
  return best
}

/** Slot `slot` of the square spiral around a flag, `hearthSpacingCm` apart, moved to the valley's edge if needed. */
export function hearthAround(config: ValleyConfig, flag: Point, slot: number): Point {
  const [dx, dy] = spiralOffsets(slot + 1).at(-1)!
  const clamp = (value: number) => Math.max(0, Math.min(config.valleySizeCm, value))
  return { x: clamp(flag.x + dx * config.hearthSpacingCm), y: clamp(flag.y + dy * config.hearthSpacingCm) }
}

/** The groups a band starts with: none when scattered, otherwise the whole band as one group around the camp. */
export function startingGroups(config: ValleyConfig, layout: ValleyLayout, foragers: Forager[]): Group[] {
  if (!config.groups || config.scattered) return []
  for (const forager of foragers) {
    forager.groupId = 0
    forager.joinedMinute = 0
    forager.knownFlags = [0]
  }
  return [
    { id: 0, flag: { ...layout.camp }, foundedMinute: 0, dissolvedMinute: null, members: foragers.map((f) => f.id) },
  ]
}

const join = (config: ValleyConfig, group: Group, forager: Forager, minute: number) => {
  forager.groupId = group.id
  forager.joinedMinute = minute
  forager.hearth = hearthAround(config, group.flag, group.members.length)
  group.members = [...group.members, forager.id]
  if (!forager.knownFlags.includes(group.id)) forager.knownFlags = [...forager.knownFlags, group.id]
}

/**
 * A forager without a group meets the nearest living forager within talking distance, if any: it joins a member's
 * group, or founds a new group with another forager without one, with the flag at their midpoint. Changes the state's
 * working copies in place.
 */
export function meet(state: ValleyState, forager: Forager, minute: number): GroupEvent | null {
  const { config } = state
  if (!config.groups || forager.groupId !== null) return null
  const other = nearestOther(forager, state.foragers, config.talkRadiusCm)
  if (!other) return null
  if (other.groupId !== null) {
    join(config, state.groups[other.groupId]!, forager, minute)
    return {
      kind: 'join',
      minute,
      groupId: other.groupId,
      foragerId: forager.id,
      metId: other.id,
      hearth: forager.hearth,
    }
  }
  const group: Group = {
    id: state.groups.length,
    flag: { x: Math.floor((forager.x + other.x) / 2), y: Math.floor((forager.y + other.y) / 2) },
    foundedMinute: minute,
    dissolvedMinute: null,
    members: [],
  }
  state.groups.push(group)
  join(config, group, forager, minute)
  join(config, group, other, minute)
  return {
    kind: 'found',
    minute,
    groupId: group.id,
    flag: group.flag,
    founderIds: [forager.id, other.id],
    hearths: [forager.hearth, other.hearth],
  }
}

/** The members of a group still alive and in it. */
export const livingMembers = (state: Pick<ValleyState, 'foragers'>, group: Group) =>
  group.members.filter((id) => {
    const member = state.foragers[id]!
    return member.alive && member.groupId === group.id
  })

/** Dissolves a group left with one living member or none: its flag comes down and the survivor is without a group. */
export function dissolveIfAlone(state: ValleyState, groupId: number, minute: number): DissolveEvent | null {
  const group = state.groups[groupId]!
  if (group.dissolvedMinute !== null) return null
  const living = livingMembers(state, group)
  if (living.length > 1) return null
  group.dissolvedMinute = minute
  for (const id of living) {
    state.foragers[id]!.groupId = null
    state.foragers[id]!.joinedMinute = null
  }
  return { kind: 'dissolve', minute, groupId, survivorId: living[0] ?? null }
}

export interface Goal {
  x: number
  y: number
  reason: ActionReason
  placeId: number | null
}

/**
 * Rules 4 and 5 for a forager whose needs are met: without a group, it walks towards the nearest forager it sees, or
 * to the nearest flag it knows and can reach and return from before dusk, or explores; with exploring on, it explores.
 * Null when there is nothing to do but rest.
 */
export function idleGoal(state: ValleyState, forager: Forager, minute: number): Goal | null {
  const { config } = state
  if (config.groups && forager.groupId === null) {
    const seen = nearestOther(forager, state.foragers, config.perceptionRadiusCm)
    if (seen) return { x: seen.x, y: seen.y, reason: 'seeking company', placeId: null }
    let flag: Point | null = null
    let flagSq = Infinity
    for (const id of forager.knownFlags) {
      const spot = state.groups[id]!.flag
      const sq = distanceSq(forager.x, forager.y, spot.x, spot.y)
      if (sq < flagSq && reachableAndBack(config, forager, spot.x, spot.y, minute)) {
        flag = spot
        flagSq = sq
      }
    }
    if (flag) return { ...flag, reason: flagSq === 0 ? 'waiting for company' : 'seeking company', placeId: null }
    const place = choosePlace(config, forager, minute, 'explore')
    return place === null ? null : { ...placeCentre(config, place), reason: 'seeking company', placeId: place }
  }
  if (!config.explore) return null
  const place = choosePlace(config, forager, minute, 'explore')
  return place === null ? null : { ...placeCentre(config, place), reason: 'exploring', placeId: place }
}
