import { carriedKcal } from '../life/food'
import { distance, distanceSq, walkSeconds } from './geometry'
import { forEachPlantWithin, nearestPlant } from './layout'
import { SECONDS_PER_HOUR } from './practice'
import { buyingPays, knownTerms, sellingPays, spareWood, wantedWood } from './trade'
import type { ActionReason, Forager, Good, Plants, PlantIndex, PlantMemory, ValleyConfig, ValleyLayout } from './types'

export const MINUTES_PER_DAY = 1_440

export const minuteOfDay = (minute: number) => minute % MINUTES_PER_DAY

export const isDaylight = (config: ValleyConfig, minute: number) => {
  const m = minuteOfDay(minute)
  return m >= 60 * config.dawnHour && m < 60 * config.duskHour
}

/** Daylight seconds left from the start of minute `minute`, or 0 at night. */
export const daylightSecondsLeft = (config: ValleyConfig, minute: number) =>
  isDaylight(config, minute) ? SECONDS_PER_HOUR * config.duskHour - 60 * minuteOfDay(minute) : 0

/** A minute's work at an hourly rate: the most whole units a minute of it can take. */
export const minuteOfWork = (rate: number) => Math.ceil(rate / 60)

export const atHearth = (forager: Forager) => forager.x === forager.hearth.x && forager.y === forager.hearth.y

/** Hunger with hysteresis, as in Life 0. */
export function nextHungry(config: ValleyConfig, energyKcal: number, hungry: boolean) {
  if (energyKcal < config.hungryBelowKcal) return true
  if (energyKcal >= config.satiatedAtKcal) return false
  return hungry
}

/**
 * The plants of one kind within the perception radius of a point. A forager standing still sees the same plants, so
 * lists are kept by position; the cache is per layout and holds no simulation state.
 */
const viewCache = new WeakMap<PlantIndex, Map<number, Int32Array>>()
const VIEW_CACHE_LIMIT = 50_000

export function plantsInView(config: ValleyConfig, index: PlantIndex, plants: Plants, x: number, y: number) {
  let cache = viewCache.get(index)
  if (!cache) viewCache.set(index, (cache = new Map()))
  const key = x * (config.valleySizeCm + 1) + y
  let view = cache.get(key)
  if (!view) {
    const ids: number[] = []
    forEachPlantWithin(index, plants, x, y, config.perceptionRadiusCm, (id) => ids.push(id))
    view = Int32Array.from(ids)
    if (cache.size >= VIEW_CACHE_LIMIT) cache.clear()
    cache.set(key, view)
  }
  return view
}

/** Records the stock of every plant in view, and the minute. */
export function observe(memory: PlantMemory, view: Int32Array, stocks: Int32Array, minute: number) {
  for (const id of view) {
    memory.stock[id] = stocks[id]!
    memory.seen[id] = minute
  }
}

export type Work = { good: Good; forTrade: boolean; trip: Forager['trip'] } | 'wait' | null

/**
 * Life 3's choice of work, with loads: a forager neither hungry nor short of wood that is filling a load keeps working
 * for wood. `hungry` and `shortOfWood` must already be updated.
 */
export function chooseWork(config: ValleyConfig, forager: Forager, minute: number): Work {
  if (!forager.hungry && fillingLoad(config, forager)) return { good: 'wood', forTrade: false, trip: null }
  if (!forager.hungry && !forager.shortOfWood) return null
  const terms = knownTerms(config, forager, minute)
  const carried = carriedKcal(forager.carried)
  if (forager.hungry) {
    if (terms !== null && sellingPays(forager, terms)) {
      const spare = spareWood(config, forager)
      if (forager.trip && spare < forager.trip.goalSpareWood)
        return { good: 'wood', forTrade: true, trip: forager.trip }
      if (spare === 0) {
        const request = Math.max(0, config.satiatedAtKcal - forager.energyKcal - carried)
        const goalSpareWood = Math.ceil(request / terms)
        if (goalSpareWood > 0) return { good: 'wood', forTrade: true, trip: { goalSpareWood } }
      }
    }
    return { good: 'food', forTrade: false, trip: null }
  }
  if (terms !== null && buyingPays(forager, terms)) {
    if (carried < wantedWood(config, forager) * terms) return { good: 'food', forTrade: true, trip: null }
    return 'wait'
  }
  return { good: 'wood', forTrade: false, trip: null }
}

/** Rule 3: it has gathered some wood since it left its hearth, but less than a load. */
export const fillingLoad = (config: ValleyConfig, forager: Forager) =>
  forager.tripWood > 0 && forager.tripWood < config.woodLoad

/** Whether a plant can be reached, worked for a minute, and left for the hearth before dusk. */
export function reachableInTime(config: ValleyConfig, forager: Forager, px: number, py: number, daylightLeft: number) {
  const there = walkSeconds(distance(forager.x, forager.y, px, py), config.walkCmPerSecond)
  const home = walkSeconds(distance(px, py, forager.hearth.x, forager.hearth.y), config.walkCmPerSecond)
  return there + 60 + home <= daylightLeft
}

/** Away from its hearth, and it is night or walking home takes every daylight second left. */
export function mustGoHome(config: ValleyConfig, forager: Forager, minute: number) {
  if (atHearth(forager)) return false
  const left = daylightSecondsLeft(config, minute)
  if (!left) return true
  const home = walkSeconds(distance(forager.x, forager.y, forager.hearth.x, forager.hearth.y), config.walkCmPerSecond)
  return home >= left
}

/**
 * The plant a forager working for `good` heads for or works this minute: its target, unless it has just seen it
 * holding less than a minute's work or cannot reach it in time; otherwise the nearest plant remembered as holding a
 * minute's work; otherwise, with `fallback`, the one seen longest ago. Only plants it has seen and can reach in time
 * are considered.
 */
export function choosePlant(
  config: ValleyConfig,
  layout: ValleyLayout,
  forager: Forager,
  good: Good,
  minute: number,
  fallback = true,
): number | null {
  const plants = good === 'food' ? layout.bushes : layout.trees
  const index = good === 'food' ? layout.bushIndex : layout.treeIndex
  const memory = good === 'food' ? forager.bushMemory : forager.treeMemory
  const threshold = minuteOfWork(good === 'food' ? forager.forageRate : forager.woodRate)
  const left = daylightSecondsLeft(config, minute)
  const reachable = (id: number) => reachableInTime(config, forager, plants.x[id]!, plants.y[id]!, left)
  const target = good === 'food' ? forager.targetBushId : forager.targetTreeId
  if (target !== null && reachable(target) && (memory.seen[target] !== minute || memory.stock[target]! >= threshold))
    return target
  const nearest = nearestPlant(
    index,
    plants,
    forager.x,
    forager.y,
    (id) => memory.stock[id]! >= threshold && reachable(id),
  )
  if (nearest !== null || !fallback) return nearest
  let chosen: number | null = null
  let chosenSeen = Infinity
  let chosenSq = Infinity
  for (let id = 0; id < plants.count; id += 1) {
    const seen = memory.seen[id]!
    if (seen < 0 || seen === minute || seen > chosenSeen) continue
    const sq = distanceSq(plants.x[id]!, plants.y[id]!, forager.x, forager.y)
    if (seen === chosenSeen && sq >= chosenSq) continue
    if (!reachable(id)) continue
    chosen = id
    chosenSeen = seen
    chosenSq = sq
  }
  return chosen
}

/** The reason recorded when no plant of the good can be reached: too late in the day, or nothing worth the walk. */
export function idleReason(config: ValleyConfig, forager: Forager, plants: Plants, minute: number): ActionReason {
  if (!plants.count) return 'waiting for regrowth'
  const left = daylightSecondsLeft(config, minute)
  for (let id = 0; id < plants.count; id += 1)
    if (reachableInTime(config, forager, plants.x[id]!, plants.y[id]!, left)) return 'waiting for regrowth'
  return 'too late to set out'
}
