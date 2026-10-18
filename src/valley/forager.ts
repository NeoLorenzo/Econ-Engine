import { carriedKcal } from './food'
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

/** What a forager carries: the wood of its trip, of which it can hold no more than it has, its berries and its log. */
export const loadOf = (forager: Forager) => ({
  wood: Math.min(forager.tripWood, forager.wood),
  berriesKcal: carriedKcal(forager.carried),
  log: forager.log,
})

/** A load in whole kilograms: its wood, its berries at `berryKcalPerKg`, rounded down, and its logs at `logKg`. */
export const loadKg = (config: ValleyConfig, wood: number, berriesKcal: number, logs = 0) =>
  wood + Math.floor(berriesKcal / config.berryKcalPerKg) + logs * config.logKg

/**
 * Walking speed under a load of `kg`, in centimetres a second: `floor(walkCmPerSecond · bodyKg / (bodyKg + kg))`,
 * never below 1. Each second still costs `travelKcalPerHour`, so each metre costs `(bodyKg + kg) / bodyKg` times as
 * much.
 */
export const speedForLoad = (config: ValleyConfig, kg: number) =>
  Math.max(1, Math.floor((config.walkCmPerSecond * config.bodyKg) / (config.bodyKg + kg)))

/** A forager's walking speed for what it carries now. */
export function walkSpeed(config: ValleyConfig, forager: Forager) {
  const load = loadOf(forager)
  return speedForLoad(config, loadKg(config, load.wood, load.berriesKcal, load.log))
}

/** Hunger with hysteresis: hungry below `hungryBelowKcal`, until satiated at `satiatedAtKcal`. */
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

/** The last view each forager's memory looked up, and where from, so a forager standing still skips the lookup. */
const lastViews = new WeakMap<PlantMemory, { x: number; y: number; view: Int32Array }>()

/** The plants of one kind in view of a forager, from its memory of them: the last lookup's when it has not moved. */
export function plantsInViewOf(
  config: ValleyConfig,
  memory: PlantMemory,
  index: PlantIndex,
  plants: Plants,
  x: number,
  y: number,
) {
  const last = lastViews.get(memory)
  if (last && last.x === x && last.y === y) return last.view
  const view = plantsInView(config, index, plants, x, y)
  lastViews.set(memory, { x, y, view })
  return view
}

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

/**
 * Records the stock of everything of one kind within `radius` of a point, and the minute: the logs on trees and the
 * stones on stone spots, which a forager sees as far as its long sight. A radius that reaches every corner of the
 * valley sees everything.
 */
export function observeFar(
  config: ValleyConfig,
  memory: PlantMemory,
  index: PlantIndex,
  plants: Plants,
  stocks: Int32Array,
  x: number,
  y: number,
  radius: number,
  minute: number,
) {
  const far = Math.max(x, config.valleySizeCm - x) ** 2 + Math.max(y, config.valleySizeCm - y) ** 2
  if (radius * radius >= far) {
    memory.stock.set(stocks)
    memory.seen.fill(minute)
    return
  }
  forEachPlantWithin(index, plants, x, y, radius, (id) => {
    memory.stock[id] = stocks[id]!
    memory.seen[id] = minute
  })
}

export type Work = { good: Good; forTrade: boolean; trip: Forager['trip'] } | 'wait' | null

/**
 * The choice of work, with loads: a forager neither hungry nor short of wood that is filling a load keeps working
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

/** Rule 4: it has gathered a full load since it left its hearth. */
export const carryingFullLoad = (config: ValleyConfig, forager: Forager) =>
  config.woodLoad > 0 && forager.tripWood >= config.woodLoad

/** Whether a plant can be reached, worked for a minute, and left for the hearth before dusk, at speed `speed`. */
export function reachableInTime(
  config: ValleyConfig,
  forager: Forager,
  px: number,
  py: number,
  daylightLeft: number,
  speed = walkSpeed(config, forager),
) {
  const there = walkSeconds(distance(forager.x, forager.y, px, py), speed)
  const home = walkSeconds(distance(px, py, forager.hearth.x, forager.hearth.y), speed)
  return there + 60 + home <= daylightLeft
}

/** Whether a point can be walked to and home from before dusk, from the start of minute `minute`, at speed `speed`. */
export function reachableAndBack(
  config: ValleyConfig,
  forager: Forager,
  x: number,
  y: number,
  minute: number,
  speed = walkSpeed(config, forager),
) {
  const there = walkSeconds(distance(forager.x, forager.y, x, y), speed)
  const home = walkSeconds(distance(x, y, forager.hearth.x, forager.hearth.y), speed)
  return there + home <= daylightSecondsLeft(config, minute)
}

/** Away from its hearth, and it is night or walking home takes every daylight second left. */
export function mustGoHome(config: ValleyConfig, forager: Forager, minute: number) {
  if (atHearth(forager)) return false
  const left = daylightSecondsLeft(config, minute)
  if (!left) return true
  const home = walkSeconds(
    distance(forager.x, forager.y, forager.hearth.x, forager.hearth.y),
    walkSpeed(config, forager),
  )
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
  const speed = walkSpeed(config, forager)
  const reachable = (id: number) => reachableInTime(config, forager, plants.x[id]!, plants.y[id]!, left, speed)
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
  const speed = walkSpeed(config, forager)
  for (let id = 0; id < plants.count; id += 1)
    if (reachableInTime(config, forager, plants.x[id]!, plants.y[id]!, left, speed)) return 'waiting for regrowth'
  return 'too late to set out'
}
