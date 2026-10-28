import { personConfig } from './nature'
import { GROUND_AREA } from './mesh'
import { corridorRoute, knows, planCorridor, routeTriangle, type Route } from './routes'
import type { Forager, Point, ValleyState, WalkPlan, Way } from './types'

/** A walk's route and how it was found; `drop` is a way the walk forgets, `way` one it walks. */
export interface WalkFound {
  route: Route
  plan: WalkPlan
  corridor: readonly number[] | null
  way: Way | null
  drop: Way | null
  rechecked: boolean
  habitual: boolean
  from: Point
  target: Point
}
const same = (p: Point, q: Point) => p.x === q.x && p.y === q.y
/** The remembered way a walk from triangle `first` to `target` would take: most recently used first, ties by number. */
export function wayTo(person: Forager, first: number, target: Point): Way | null {
  let best: Way | null = null
  for (const way of person.ways) {
    if (!same(way.a, target) && !same(way.b, target)) continue
    if (best && (way.usedMinute < best.usedMinute || (way.usedMinute === best.usedMinute && way.id > best.id))) continue
    if (way.corridor.includes(first)) best = way
  }
  return best
}
/** The part of a way from triangle `first` to the end at `target`. */
export function wayPart(way: Way, first: number, target: Point): number[] {
  const at = way.corridor.indexOf(first)
  return same(way.b, target) ? [...way.corridor.subarray(at)] : [...way.corridor.subarray(0, at + 1)].reverse()
}
/**
 * The corridor of a walk to `target`: a remembered way, or the rest of one the walker stands on, unless it is due a
 * recheck; otherwise a straight or steered plan. Only walks to places, banks and home (`habitual`) use ways.
 */
export function findWalk(
  state: ValleyState,
  person: Forager,
  target: Point,
  habitual: boolean,
  loadKg: number,
): WalkFound | null {
  const nav = state.layout.nav,
    knowledge = person.knowledge,
    from = { x: person.x, y: person.y }
  const first = routeTriangle(nav, knowledge, person),
    last = routeTriangle(nav, knowledge, target)
  if (first < 0 || last < 0) return null
  const config = personConfig(state.config, person)
  const found = (
    corridor: readonly number[] | null,
    plan: WalkPlan,
    way: Way | null,
    drop: Way | null,
    rechecked = false,
  ): WalkFound => ({
    route: corridor
      ? corridorRoute(nav, config, loadKg, corridor, from, target)
      : { segments: [], minutes: 0, timeUnits: 0, kcal: 0 },
    plan,
    corridor,
    way,
    drop,
    rechecked,
    habitual,
    from,
    target,
  })
  if (same(from, target)) return found(null, 'straight', null, null)
  let drop: Way | null = null,
    rechecked = false
  const way = habitual ? wayTo(person, first, target) : null
  if (way) {
    const valid = wayValid(state, person, way)
    rechecked =
      valid && state.minute - way.plannedMinute >= state.config.wayRecheckMinutes && way.revision !== knowledge.revision
    if (!valid || rechecked) drop = way
    else {
      const start = same(way.b, target) ? way.a : way.b
      return found(wayPart(way, first, target), same(from, start) ? 'way' : 'joined', way, null)
    }
  }
  const plan = planCorridor(nav, knowledge, first, last, from, target)
  return plan && found(plan.corridor, plan.plan, null, drop, rechecked)
}
/** Every triangle of the way still walkable and known to the person. */
export function wayValid(state: ValleyState, person: Forager, way: Way) {
  const mesh = state.layout.nav.mesh
  for (const t of way.corridor) if (mesh.area[t] !== GROUND_AREA || !knows(person.knowledge, t)) return false
  return true
}
/** Records a walk in the person's ways: a used way is marked used, a new plan to a place, bank or home remembered. */
export function rememberWalk(state: ValleyState, person: Forager, walk: WalkFound, minute: number) {
  let ways = person.ways
  if (walk.drop) ways = ways.filter((w) => w !== walk.drop)
  if (walk.way) ways = ways.map((w) => (w === walk.way ? { ...w, usedMinute: minute } : w))
  else if (walk.habitual && walk.corridor && (walk.plan === 'straight' || walk.plan === 'steered')) {
    const { from: a, target: b } = walk
    ways = ways.filter((w) => !((same(w.a, a) && same(w.b, b)) || (same(w.a, b) && same(w.b, a))))
    ways = [
      ...ways,
      {
        id: person.nextWayId++,
        a,
        b,
        corridor: Int32Array.from(walk.corridor),
        plannedMinute: minute,
        revision: person.knowledge.revision,
        usedMinute: minute,
      },
    ]
    while (ways.length > state.config.waysRemembered) {
      let stalest = ways[0]!
      for (const w of ways)
        if (w.usedMinute < stalest.usedMinute || (w.usedMinute === stalest.usedMinute && w.id < stalest.id)) stalest = w
      ways = ways.filter((w) => w !== stalest)
    }
  }
  if (ways !== person.ways) person.ways = ways
}
