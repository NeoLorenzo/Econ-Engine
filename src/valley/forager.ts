import { carriedByFood, foodKg } from './food'
import { MINUTES_PER_DAY, minuteOfDay } from './calendar'
import { knownRoute, type Route } from './routes'
import type { ActionReason, Forager, Point, TaskKind, ValleyConfig, ValleyState } from './types'
export { MINUTES_PER_DAY, minuteOfDay } from './calendar'
export const isDaylight = (config: ValleyConfig, minute: number) =>
  minuteOfDay(minute) >= config.dawnHour * 60 && minuteOfDay(minute) < config.duskHour * 60
export const atHearth = (person: Forager) => person.x === person.hearth.x && person.y === person.hearth.y
export interface Load {
  wood: number
  berriesKcal: number
  nutsKcal: number
  fishKcal: number
  log: number
}

/** What a forager carries: the wood of its trip, of which it can hold no more than it has, its food and its log. */
export function loadOf(forager: Forager): Load {
  const food = carriedByFood(forager.carried)
  return {
    wood: Math.min(forager.tripWood, forager.wood),
    berriesKcal: food.berries,
    nutsKcal: food.nuts,
    fishKcal: food.fish,
    log: forager.log,
  }
}

/** A load in whole kilograms: its wood, its food rounded down once over the three foods, and its log at `logKg`. */
export const loadKg = (config: ValleyConfig, load: Load) =>
  load.wood + foodKg(config, load.berriesKcal, load.nutsKcal, load.fishKcal) + load.log * config.logKg

/**
 * Walking speed under a load of `kg`, in centimetres a second: it falls by `loadSlowdownPerMille` thousandths for each
 * body mass carried, `floor(walkCmPerSecond · (1,000 · bodyKg − loadSlowdownPerMille · kg) / (1,000 · bodyKg))`, never
 * below 1. Walkers barely slow under a load; it costs them energy instead (see `walkCostForLoad`).
 */
export const speedForLoad = (config: ValleyConfig, kg: number) =>
  Math.max(
    1,
    Math.floor(
      (config.walkCmPerSecond * (1_000 * config.bodyKg - config.loadSlowdownPerMille * kg)) / (1_000 * config.bodyKg),
    ),
  )

export function nextHungry(config: ValleyConfig, energyKcal: number, hungry: boolean) {
  if (energyKcal < config.hungryBelowKcal) return true
  if (energyKcal >= config.satiatedAtKcal) return false
  return hungry
}

export const walkSpeed = (config: ValleyConfig, person: Forager) => speedForLoad(config, loadKg(config, loadOf(person)))
export const routeKey = (state: ValleyState, person: Forager, target: Point) =>
  `${person.x},${person.y}:${target.x},${target.y}:${person.knowledge.revision}:${loadKg(state.config, loadOf(person))}`
export function routeFor(state: ValleyState, person: Forager, target: Point): Route | null {
  const key = routeKey(state, person, target),
    saved = person.routeCache.get(key)
  if (saved !== undefined) return state.routes[saved]!
  const lattice = state.layout.lattice
  return knownRoute(
    lattice,
    person.knowledge,
    state.layout.terrain,
    state.layout.ground,
    lattice.banks,
    state.config,
    loadKg(state.config, loadOf(person)),
    person,
    target,
  )
}
export interface TaskChoice {
  kind: TaskKind
  placeId: number
  target: Point | null
  reason: ActionReason
}
export const restChoice = (reason: ActionReason = 'satiated'): TaskChoice => ({
  kind: 'rest',
  placeId: -1,
  target: null,
  reason,
})
export function mustGoHome(state: ValleyState, person: Forager, minute: number) {
  if (atHearth(person)) return false
  if (!isDaylight(state.config, minute)) return true
  const home = routeFor(state, person, person.hearth)
  return home !== null && home.minutes >= state.config.duskHour * 60 - minuteOfDay(minute)
}
export function chooseTask(state: ValleyState, person: Forager, minute: number): TaskChoice {
  if (mustGoHome(state, person, minute))
    return { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home' }
  if (!isDaylight(state.config, minute)) return { kind: 'sleep', placeId: -1, target: null, reason: 'night' }
  return restChoice()
}
