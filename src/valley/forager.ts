import { carriedByFood, carriedKcal, foodKg, foodOfSource, fullRateOf, rateAtStock, worthWorking } from './food'
import { fishRate } from './fish'
import { knownWalkSeconds, routeCell } from './routes'
import { knownBanksInChunks } from './waterKnowledge'
import { nearestKnownSite, siteCentre, siteKind, type SiteKind } from './sites'
import { distance, distanceSq, walkSeconds } from './geometry'
import { forEachPlantWithin, forEachRingOutwards } from './layout'
import { heightAt, terrainOf } from './terrain'
import { SECONDS_PER_HOUR } from './practice'
import { buyingPays, knownTerms, sellingPays, spareWood, wantedWood } from './trade'
import type {
  ActionReason,
  Forager,
  Good,
  Plants,
  PlantIndex,
  PlantMemory,
  Point,
  ValleyConfig,
  ValleyLayout,
} from './types'

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

/** What a forager carries: wood, its food of each kind in kilocalories, and its log. */
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

/**
 * A forager's estimate of a walk, by Naismith's rule: the seconds to walk the straight distance at `speed` on the flat,
 * plus `climbSecondsPerMetre` for every metre its end lies above its start, rounded up.
 */
export function estimateWalk(config: ValleyConfig, ax: number, ay: number, bx: number, by: number, speed: number) {
  const flat = walkSeconds(distance(ax, ay, bx, by), speed)
  if (!config.climbSecondsPerMetre) return flat
  const terrain = terrainOf(config)
  const climb = heightAt(terrain, bx, by) - heightAt(terrain, ax, ay)
  return climb > 0 ? flat + Math.ceil((config.climbSecondsPerMetre * climb) / 100) : flat
}

/** A forager's walking speed for what it carries now. */
export function walkSpeed(config: ValleyConfig, forager: Forager) {
  return speedForLoad(config, loadKg(config, loadOf(forager)))
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
  return canWalkAndReturn(config, forager, { x: px, y: py }, daylightLeft - 60, speed)
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
  return canWalkAndReturn(config, forager, { x, y }, daylightSecondsLeft(config, minute), speed)
}

/** Every integer route segment costs at least its Chebyshev displacement divided by speed. */
export const walkLowerBound = (from: Point, to: Point, speed: number) =>
  Math.ceil(Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) / speed)

function canWalkAndReturn(config: ValleyConfig, forager: Forager, point: Point, seconds: number, speed: number) {
  if (forager.groundKnowledge.observed[routeCell(forager.groundKnowledge, point)] !== 1) return false
  const homeFloor = walkLowerBound(point, forager.hearth, speed)
  const outwardFloor = walkLowerBound(forager, point, speed)
  if (outwardFloor + homeFloor > seconds) return false
  const home = estimateKnownWalk(config, forager, point, forager.hearth, speed, seconds - outwardFloor)
  if (!Number.isFinite(home) || outwardFloor + home > seconds) return false
  const there = estimateKnownWalk(config, forager, forager, point, speed, seconds - home)
  return there + home <= seconds
}

interface WalkEstimateCache {
  revision: number
  terrain: ReturnType<typeof terrainOf>
  times: Map<string, { seconds: number; rejectedThrough: number }>
}
const walkEstimates = new WeakMap<Forager['groundKnowledge'], WalkEstimateCache>()

/** Immutable scalar results remain valid on a cloned knowledge snapshot. */
export function cloneWalkEstimates(from: Forager['groundKnowledge'], to: Forager['groundKnowledge']) {
  const cached = walkEstimates.get(from)
  if (cached) walkEstimates.set(to, cached)
  const idle = idleReachability.get(from)
  if (idle) idleReachability.set(to, new Map(idle))
}

/** Exact estimates and budget rejection proofs depend on endpoints, load, ascent and observed ground. */
export function estimateKnownWalk(
  config: ValleyConfig,
  person: Pick<Forager, 'groundKnowledge' | 'hearth'>,
  from: Point,
  to: Point,
  speed: number,
  maxSeconds = Infinity,
) {
  const terrain = terrainOf(config)
  const grid = person.groundKnowledge
  let cached = walkEstimates.get(grid)
  if (cached?.revision !== grid.revision || cached.terrain !== terrain) {
    cached = { revision: grid.revision, terrain, times: new Map() }
    walkEstimates.set(grid, cached)
  }
  const key = `${from.x},${from.y}:${to.x},${to.y}:${person.hearth.x},${person.hearth.y}:${speed}:${config.climbSecondsPerMetre}`
  const previous = cached.times.get(key)
  if (previous && (Number.isFinite(previous.seconds) || maxSeconds <= previous.rejectedThrough)) return previous.seconds
  const seconds = knownWalkSeconds(
    person.groundKnowledge,
    from,
    to,
    speed,
    config.climbSecondsPerMetre,
    (point) => heightAt(terrain, point.x, point.y),
    person.hearth,
    maxSeconds,
  )
  if (!previous && cached.times.size >= 4096) cached.times.delete(cached.times.keys().next().value!)
  cached.times.set(key, { seconds, rejectedThrough: maxSeconds })
  return seconds
}

export function mustGoHome(config: ValleyConfig, forager: Forager, minute: number) {
  if (atHearth(forager)) return false
  const left = daylightSecondsLeft(config, minute)
  if (!left) return true
  const home = estimateKnownWalk(config, forager, forager, forager.hearth, walkSpeed(config, forager))
  return home >= left
}

/**
 * The plant a forager working for `good` heads for or works this minute. For food, see `chooseFood`. For wood: its
 * target, unless it has just seen it holding less than a minute's work or cannot reach it in time; otherwise the
 * nearest felled crown, then the nearest plant, remembered as holding a minute's work; otherwise, with `fallback`, the
 * one seen longest ago. Only plants it has seen and can reach in time are considered.
 */
export function choosePlant(
  config: ValleyConfig,
  layout: ValleyLayout,
  forager: Forager,
  good: Good,
  minute: number,
  fallback = true,
): number | null {
  if (good === 'food') return chooseFood(config, layout, forager, minute, fallback)
  const plants = layout.woodPlants
  const memory = forager.woodMemory
  const threshold = minuteOfWork(forager.woodRate)
  const left = daylightSecondsLeft(config, minute)
  const speed = walkSpeed(config, forager)
  const reachable = (id: number) => reachableInTime(config, forager, plants.x[id]!, plants.y[id]!, left, speed)
  const target = forager.targetWoodId
  if (target !== null && reachable(target) && (memory.seen[target] !== minute || memory.stock[target]! >= threshold))
    return target
  // It clears the crown of a felled tree before it takes from a plant still growing: a tree it saw from afar holding
  // fewer than every log is down, and trees come first among wood plants.
  const nearestByRoute = (points: Plants, chunks: PlantIndex, wanted: (id: number) => boolean) => {
    let best: number | null = null
    let bestSeconds = Infinity
    forEachRingOutwards(
      chunks,
      forager.x,
      forager.y,
      (floor) => floor <= left * speed && Math.ceil(floor / speed) <= bestSeconds,
      (id) => {
        if (!wanted(id)) return
        const point = { x: points.x[id]!, y: points.y[id]! }
        const budget = Math.min(bestSeconds, left - 60 - walkLowerBound(point, forager.hearth, speed))
        const time = estimateKnownWalk(config, forager, forager, point, speed, budget)
        if (time > bestSeconds || (time === bestSeconds && best !== null && id >= best) || !reachable(id)) return
        best = id
        bestSeconds = time
      },
    )
    return best
  }
  const fallen = nearestByRoute(
    layout.trees,
    layout.treeChunks,
    (id) =>
      forager.logMemory.seen[id]! >= 0 &&
      forager.logMemory.stock[id]! < config.logsPerTree &&
      memory.stock[id]! >= threshold,
  )
  if (fallen !== null) return fallen
  const nearest = nearestByRoute(plants, layout.woodChunks, (id) => memory.stock[id]! >= threshold)
  if (nearest !== null || !fallback) return nearest
  return seenLongestAgo(config, forager, plants, layout.woodChunks, memory, minute)
}

/**
 * With nothing left to search, the plant of a kind it saw longest ago that it can reach in time, nearest first, ties to
 * the lowest ID. Only plants within the walk the daylight left allows can be reached, so only their chunks are searched.
 */
function seenLongestAgo(
  config: ValleyConfig,
  forager: Forager,
  plants: Plants,
  chunks: PlantIndex,
  memory: PlantMemory,
  minute: number,
) {
  const left = daylightSecondsLeft(config, minute)
  const speed = walkSpeed(config, forager)
  const reachable = (id: number) => reachableInTime(config, forager, plants.x[id]!, plants.y[id]!, left, speed)
  let chosen: number | null = null
  let chosenSeen = Infinity
  let chosenSq = Infinity
  forEachPlantWithin(chunks, plants, forager.x, forager.y, left * speed, (id) => {
    const seen = memory.seen[id]!
    if (seen < 0 || seen === minute || seen > chosenSeen) return
    const sq = distanceSq(plants.x[id]!, plants.y[id]!, forager.x, forager.y)
    if (seen === chosenSeen && (sq > chosenSq || (sq === chosenSq && id > chosen!))) return
    if (!reachable(id)) return
    chosen = id
    chosenSeen = seen
    chosenSq = sq
  })
  return chosen
}

/** Where a forager works a food source: a food plant where it stands, or the shore straight north of it. */
export const sourcePoint = (layout: ValleyLayout, forager: Forager, source: number): Point =>
  source < 0
    ? forager.knownBanks.get(-source - 1)!
    : { x: layout.foodPlants.x[source]!, y: layout.foodPlants.y[source]! }

/** What a forager remembers a food source holding: a food plant as it last saw it, the lake as it last fished it. */
export function rememberedStock(config: ValleyConfig, forager: Forager, source: number) {
  if (source >= 0) return forager.foodMemory.stock[source]!
  const bank = forager.knownBanks.get(-source - 1)!
  return forager.fishMemory.get(bank.bodyId)?.stock ?? -1
}

/** The hourly rate a forager expects at a food source, from what it remembers there. */
export function expectedRate(config: ValleyConfig, layout: ValleyLayout, forager: Forager, source: number) {
  if (source < 0) {
    const bank = forager.knownBanks.get(-source - 1)!
    const memory = forager.fishMemory.get(bank.bodyId)
    return memory ? fishRate(forager.fishRate, memory.stock, memory.capacity) : forager.fishRate
  }
  const food = foodOfSource(layout, source)
  return rateAtStock(config, fullRateOf(forager, food), food, rememberedStock(config, forager, source))
}

/**
 * The food source a forager working for food heads for or works this minute, a food plant or a negative encoded bank ID: its target
 * while it remembers it worth working and can reach it in time. Otherwise the nearest bush and the nearest hazel it
 * remembers as worth working, ties to the lowest ID, and the lake if it knows it, remembers it worth working and can
 * reach the shore; of these, the one that promises most food for the time, an hour there at its expected rate over
 * the walk there plus that hour, ties to berries, then nuts, then fish. With none, and with `fallback`, the bush or
 * hazel it saw longest ago.
 */
export function chooseFood(
  config: ValleyConfig,
  layout: ValleyLayout,
  forager: Forager,
  minute: number,
  fallback = true,
): number | null {
  const goal = foodGoal(config, layout, forager, minute, fallback)
  return goal?.source ?? null
}

/** Where a forager working for food goes: a source to work, or a thicket it has spotted but never checked. */
export type FoodGoal = { source: number; site?: undefined } | { site: number; source?: undefined }

/**
 * As `chooseFood`, but a thicket or hazel thicket it has spotted and never checked is a candidate too, which it
 * expects to find full, as it expects the lake before it has fished: the nearest of each kind it can reach and return
 * from before dusk, by its centre, at its full rate for that food.
 */
export function foodGoal(
  config: ValleyConfig,
  layout: ValleyLayout,
  forager: Forager,
  minute: number,
  fallback = true,
): FoodGoal | null {
  const left = daylightSecondsLeft(config, minute)
  const speed = walkSpeed(config, forager)
  const reachable = (source: number) => {
    const point = sourcePoint(layout, forager, source)
    return reachableInTime(config, forager, point.x, point.y, left, speed)
  }
  const worth = (source: number) => worthWorking(config, expectedRate(config, layout, forager, source))
  const target = forager.targetFoodId
  if (target !== null && (target >= 0 || forager.knownBanks.has(-target - 1)) && worth(target) && reachable(target))
    return { source: target }
  const plants = layout.foodPlants
  let best = null as FoodGoal | null
  let bestRate = 0
  let bestTime = 1
  const priority = (goal: FoodGoal): number[] => {
    if (goal.site !== undefined) return [1, goal.site, 0]
    if (goal.source >= 0) return [0, goal.source, 0]
    const bank = forager.knownBanks.get(-goal.source - 1)!
    return [2, bank.bodyId, bank.id]
  }
  const earlier = (goal: FoodGoal, previous: FoodGoal) => {
    const a = priority(goal)
    const b = priority(previous)
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i]! < b[i]!
    return false
  }
  /** Food for the time is `3,600 · rate / time`; comparing by multiplying across keeps it exact. Ties keep the first. */
  const consider = (goal: FoodGoal, point: Point, rate: number) => {
    const lowerBound =
      Math.ceil(Math.max(Math.abs(forager.x - point.x), Math.abs(forager.y - point.y)) / speed) + SECONDS_PER_HOUR
    if (
      best !== null &&
      (rate * bestTime < bestRate * lowerBound || (rate * bestTime === bestRate * lowerBound && !earlier(goal, best)))
    )
      return
    const budget = Math.min(
      left - 60 - walkLowerBound(point, forager.hearth, speed),
      best === null ? Infinity : Math.ceil((rate * bestTime) / bestRate) - SECONDS_PER_HOUR,
    )
    const time = estimateKnownWalk(config, forager, forager, point, speed, budget) + SECONDS_PER_HOUR
    if (
      best !== null &&
      (rate * bestTime < bestRate * time || (rate * bestTime === bestRate * time && !earlier(goal, best)))
    )
      return
    if (!reachableInTime(config, forager, point.x, point.y, left, speed)) return
    best = goal
    bestRate = rate
    bestTime = time
  }
  // In the order of ties: every bush, then every hazel, by ID; a thicket and a hazel thicket never checked; the lake.
  // Plants are searched chunk by chunk outwards, and among them the lowest ID wins a tie, as a search by ID would find.
  const fullBerries = fullRateOf(forager, 'berries')
  const fullNuts = fullRateOf(forager, 'nuts')
  const topRate = Math.max(fullBerries, fullNuts)
  let bestPlant = -1
  const considerPlant = (id: number) => {
    const berries = id < layout.bushes.count
    const rate = rateAtStock(
      config,
      berries ? fullBerries : fullNuts,
      berries ? 'berries' : 'nuts',
      forager.foodMemory.stock[id]!,
    )
    if (!worthWorking(config, rate)) return
    const x = plants.x[id]!
    const y = plants.y[id]!
    const lowerBound = Math.ceil(Math.max(Math.abs(forager.x - x), Math.abs(forager.y - y)) / speed) + SECONDS_PER_HOUR
    if (best !== null && rate * bestTime < bestRate * lowerBound) return
    const point = { x, y }
    const budget = Math.min(
      left - 60 - walkLowerBound(point, forager.hearth, speed),
      best === null ? Infinity : Math.ceil((rate * bestTime) / bestRate) - SECONDS_PER_HOUR,
    )
    const time = estimateKnownWalk(config, forager, forager, point, speed, budget) + SECONDS_PER_HOUR
    if (best !== null) {
      const ours = rate * bestTime
      const theirs = bestRate * time
      if (ours < theirs || (ours === theirs && id > bestPlant)) return
    }
    if (!reachableInTime(config, forager, x, y, left, speed)) return
    best = { source: id }
    bestPlant = id
    bestRate = rate
    bestTime = time
  }
  // Nothing further than it can walk in the daylight left can be reached in time; and once even its best rate over the
  // walk to a ring is worse than the best found, nothing in that ring or beyond can win or tie.
  forEachRingOutwards(
    layout.foodChunks,
    forager.x,
    forager.y,
    (floor) => {
      if (floor > left * speed) return false
      return best === null || topRate * bestTime >= bestRate * (Math.ceil(floor / speed) + SECONDS_PER_HOUR)
    },
    considerPlant,
  )
  for (const [kind, food] of [
    ['thicket', 'berries'],
    ['hazel', 'nuts'],
  ] as const) {
    const site = uncheckedSite(config, layout, forager, minute, kind)
    if (site !== null) consider({ site }, siteCentre(config, layout, site), fullRateOf(forager, food))
  }
  const fullFishRate = fullRateOf(forager, 'fish')
  for (const bank of knownBanksInChunks(
    forager,
    (floor) =>
      floor <= left * speed &&
      (best === null || fullFishRate * bestTime >= bestRate * (Math.ceil(floor / speed) + SECONDS_PER_HOUR)),
  )) {
    const source = -bank.id - 1
    if (worth(source)) consider({ source }, bank, expectedRate(config, layout, forager, source))
  }
  if (best !== null || !fallback) return best
  const longAgo = seenLongestAgo(config, forager, plants, layout.foodChunks, forager.foodMemory, minute)
  return longAgo === null ? null : { source: longAgo }
}

/**
 * The nearest site of a kind a forager has spotted and never checked, that it can reach and return home from before
 * dusk, by the distance to its centre, ties to the lowest ID; or null.
 */
function uncheckedSite(config: ValleyConfig, layout: ValleyLayout, forager: Forager, minute: number, kind: SiteKind) {
  return nearestKnownSite(
    config,
    layout,
    forager,
    minute,
    (site) => forager.siteChecked[site]! < 0 && siteKind(config, site) === kind,
  )
}

const idleReachability = new WeakMap<
  Forager['groundKnowledge'],
  Map<
    Plants,
    {
      revision: number
      terrain: object
      key: string
      rejectedThrough: number
      witness: number | null
    }
  >
>()

/** The reason recorded when no plant of the good can be reached: too late in the day, or nothing worth the walk. */
export function idleReason(
  config: ValleyConfig,
  forager: Forager,
  plants: Plants,
  chunks: PlantIndex,
  minute: number,
): ActionReason {
  if (!plants.count) return 'waiting for regrowth'
  const left = daylightSecondsLeft(config, minute)
  const speed = walkSpeed(config, forager)
  const reachable = (id: number) => reachableInTime(config, forager, plants.x[id]!, plants.y[id]!, left, speed)
  let some = false
  let cache = idleReachability.get(forager.groundKnowledge)
  if (!cache) idleReachability.set(forager.groundKnowledge, (cache = new Map()))
  const key = `${forager.x}:${forager.y}:${forager.hearth.x}:${forager.hearth.y}:${speed}:${config.climbSecondsPerMetre}`
  const terrain = terrainOf(config)
  const previous = cache.get(plants)
  if (previous?.revision === forager.groundKnowledge.revision && previous.terrain === terrain && previous.key === key) {
    if (left <= previous.rejectedThrough) return 'too late to set out'
    if (previous.witness !== null && reachable(previous.witness)) return 'waiting for regrowth'
  }
  let witness: number | null = null
  const range = left * speed
  forEachRingOutwards(
    chunks,
    forager.x,
    forager.y,
    (floor) => !some && floor <= range,
    (id) => {
      if (!some && distanceSq(plants.x[id]!, plants.y[id]!, forager.x, forager.y) <= range * range && reachable(id)) {
        some = true
        witness = id
      }
    },
  )
  cache.set(plants, {
    revision: forager.groundKnowledge.revision,
    terrain,
    key,
    rejectedThrough: some ? -1 : left,
    witness,
  })
  return some ? 'waiting for regrowth' : 'too late to set out'
}
