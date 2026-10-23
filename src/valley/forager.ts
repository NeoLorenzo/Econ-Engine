import { waterThresholds } from './body'
import { capacityOf as foodCapacity, fullRateOf, rateAtStock, carriedKcal } from './food'
import { knownTerms, buyingPays, sellingPays, wantedWood, spareWood } from './trade'
import { nearestFrontier, estimateMinutes } from './routes'
import { heightAt } from './terrain'
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
  productionPerHour?: number
  expectedStock?: number
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
function estimate(state: ValleyState, person: Forager, point: Point) {
  return estimateMinutes(
    state.config,
    person,
    point,
    walkSpeed(state.config, person) * 60,
    heightAt(state.layout.terrain, point.x, point.y) - heightAt(state.layout.terrain, person.x, person.y),
  )
}
function workAt(
  state: ValleyState,
  person: Forager,
  id: number,
  kind: TaskKind,
  reason: ActionReason,
  rate: number,
  stock: number,
): TaskChoice {
  const target =
    kind === 'drink' || kind === 'fish'
      ? person.knownBanks.get(id)!
      : { x: state.layout.places.x[id]!, y: state.layout.places.y[id]! }
  const reach = kind === 'drink' || kind === 'fish' ? state.config.reachCm : state.layout.places.radiusCm[id]!
  const here = (person.x - target.x) ** 2 + (person.y - target.y) ** 2 <= reach ** 2
  return {
    kind: here ? kind : 'walk',
    placeId: id,
    target: here ? null : target,
    reason,
    productionPerHour: rate,
    expectedStock: stock,
  }
}
function explore(state: ValleyState, person: Forager, reason: ActionReason): TaskChoice {
  const point = nearestFrontier(state.layout.lattice, person.knowledge, person)
  return point ? { kind: 'walk', placeId: -1, target: point, reason } : restChoice('no known route')
}
function waterGoal(state: ValleyState, person: Forager, minute: number, severe: boolean): TaskChoice {
  const banks = [...person.knownBanks.values()].sort(
    (a, b) => estimate(state, person, a) - estimate(state, person, b) || a.id - b.id,
  )
  for (const bank of banks) {
    const here = (person.x - bank.x) ** 2 + (person.y - bank.y) ** 2 <= state.config.reachCm ** 2
    if (here) return workAt(state, person, bank.id, 'drink', 'drinking', 0, 0)
    const route = routeFor(state, person, bank)
    if (!route) continue
    if (
      !severe &&
      route.minutes + estimateMinutes(state.config, bank, person.hearth, walkSpeed(state.config, person) * 60, 0) + 1 >
        state.config.duskHour * 60 - minuteOfDay(minute)
    )
      continue
    return workAt(state, person, bank.id, 'drink', 'seeking water', 0, 0)
  }
  return explore(state, person, 'seeking water')
}
export function foodGoal(state: ValleyState, person: Forager, minute: number): TaskChoice | null {
  let best: TaskChoice | null = null,
    bestScore = -1,
    bestId = Infinity
  const consider = (id: number, kind: 'pick' | 'nuts' | 'fish', target: Point, rate: number, stock: number) => {
    if (rate <= state.config.pickKcalPerHour) return
    const travel = estimate(state, person, target)
    const home = estimateMinutes(state.config, target, person.hearth, walkSpeed(state.config, person) * 60, 0)
    if (travel + home + 1 > state.config.duskHour * 60 - minuteOfDay(minute)) return
    const score = (3_600 * rate) / (travel * 60 + 3_600)
    if (score > bestScore || (score === bestScore && id < bestId)) {
      bestScore = score
      bestId = id
      best = workAt(
        state,
        person,
        id,
        kind,
        kind === 'pick' ? 'foraging' : kind === 'nuts' ? 'gathering nuts' : 'fishing',
        rate,
        stock,
      )
    }
  }
  for (let id = 0; id < state.layout.places.count; id += 1) {
    if (person.knownPlaces[id]! < 0) continue
    const kind = state.layout.places.kind[id]
    if (kind !== 0 && kind !== 1) continue
    const food = kind === 0 ? 'berries' : 'nuts',
      stock = person.placeStock[id]! < 0 ? foodCapacity(state.config, food) : person.placeStock[id]!
    consider(
      id,
      kind === 0 ? 'pick' : 'nuts',
      { x: state.layout.places.x[id]!, y: state.layout.places.y[id]! },
      rateAtStock(state.config, fullRateOf(person, food), food, stock),
      stock,
    )
  }
  for (const bank of person.knownBanks.values()) {
    const memory = person.fishMemory.get(bank.bodyId)
    const rate = memory
      ? memory.capacity
        ? Math.floor((person.fishRate * memory.stock) / memory.capacity)
        : 0
      : person.fishRate
    consider(bank.id, 'fish', bank, rate, memory?.stock ?? Math.floor(rate / 60))
  }
  return best
}
function woodGoal(state: ValleyState, person: Forager, minute: number): TaskChoice | null {
  let best = -1,
    bestMinutes = Infinity,
    bestStock = 0
  for (let id = 0; id < state.layout.places.count; id += 1) {
    if (person.knownPlaces[id]! < 0) continue
    const kind = state.layout.places.kind[id]
    if (kind !== 0 && kind !== 2) continue
    const stock =
      person.placeWood[id]! < 0
        ? kind === 0
          ? state.config.berryThicketWoodKg
          : state.config.standWoodKg
        : person.placeWood[id]!
    if (stock <= 0) continue
    const target = { x: state.layout.places.x[id]!, y: state.layout.places.y[id]! },
      travel = estimate(state, person, target)
    if (
      travel + estimateMinutes(state.config, target, person.hearth, walkSpeed(state.config, person) * 60, 0) + 1 >
      state.config.duskHour * 60 - minuteOfDay(minute)
    )
      continue
    if (travel < bestMinutes) {
      best = id
      bestMinutes = travel
      bestStock = stock
    }
  }
  return best < 0
    ? null
    : workAt(
        state,
        person,
        best,
        'gather',
        person.tripWood > 0 ? 'filling a load' : 'gathering',
        person.woodRate,
        bestStock,
      )
}
export function chooseTask(state: ValleyState, person: Forager, minute: number): TaskChoice {
  const severe = person.waterDeficitMl >= waterThresholds(state.config).urgent
  if (severe) return waterGoal(state, person, minute, true)
  if (mustGoHome(state, person, minute))
    return { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home' }
  if (!isDaylight(state.config, minute)) return { kind: 'sleep', placeId: -1, target: null, reason: 'night' }
  if (person.thirsty) return waterGoal(state, person, minute, false)
  if (person.log && !atHearth(person))
    return { kind: 'walk', placeId: -1, target: person.hearth, reason: 'taking a log home' }
  if (!person.hungry && person.tripWood >= state.config.woodLoad && !atHearth(person))
    return { kind: 'walk', placeId: -1, target: person.hearth, reason: 'taking a load home' }
  if (!person.hungry && person.tripWood > 0 && person.tripWood < state.config.woodLoad)
    return woodGoal(state, person, minute) ?? explore(state, person, 'seeking wood')
  if (person.hungry || person.shortOfWood) {
    const terms = knownTerms(state.config, person, minute)
    if (person.hungry && terms !== null && sellingPays(person, terms) && spareWood(state.config, person) > 0)
      return restChoice('waiting to swap')
    if (
      !person.hungry &&
      terms !== null &&
      buyingPays(person, terms) &&
      carriedKcal(person.carried) < wantedWood(state.config, person) * terms
    )
      return foodGoal(state, person, minute) ?? explore(state, person, 'seeking food')
    return (
      (person.hungry ? foodGoal(state, person, minute) : woodGoal(state, person, minute)) ??
      explore(state, person, person.hungry ? 'seeking food' : 'seeking wood')
    )
  }
  return restChoice()
}
export const fillingLoad = (config: ValleyConfig, person: Forager) =>
  person.tripWood > 0 && person.tripWood < config.woodLoad
export const carryingFullLoad = (config: ValleyConfig, person: Forager) =>
  config.woodLoad > 0 && person.tripWood >= config.woodLoad
