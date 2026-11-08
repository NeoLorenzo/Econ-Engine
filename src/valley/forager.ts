import { personConfig } from './nature'
import { bodyDistanceBound, bodyGrid, bodyMinutesBound, nearestBanks, knownBodySet } from './bankSearch'
import { planHut, salePrice, worthTo } from './axes'
import { waterThresholds } from './body'
import { capacityOf, fullRateOf, carriedKcal } from './food'
import { knownTerms, buyingPays, sellingPays, wantedWood, spareWood } from './trade'
import { nearestFrontier, estimateMinutes, knownComponents, routeTriangle } from './routes'
import { cachedHeight } from './routes'
import { carriedByFood, foodKg } from './food'
import { lastWindowStartMinute, MINUTES_PER_DAY, minuteOfDay, windowDayIndex } from './calendar'
import { cropOf, thicketCapacity } from './places'
import { storeKcal, storeTarget } from './stores'
import { findWalk, type WalkFound } from './ways'
import { distance } from './geometry'
import { practiceBudget } from './skills'
import type { ActionReason, Forager, Good, Point, TaskKind, ValleyConfig, ValleyState } from './types'
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
 * body mass carried, `floor(walkCmPerSecond · (1,000 · referenceBodyKg − loadSlowdownPerMille · kg) / (1,000 · referenceBodyKg))`, never
 * below 1. Walkers barely slow under a load; it costs them energy instead (see `walkCostForLoad`).
 */
export const speedForLoad = (config: ValleyConfig, kg: number) =>
  Math.max(
    1,
    Math.floor(
      (config.walkCmPerSecond * (1_000 * config.referenceBodyKg - config.loadSlowdownPerMille * kg)) /
        (1_000 * config.referenceBodyKg),
    ),
  )

export function nextHungry(config: ValleyConfig, energyKcal: number, hungry: boolean) {
  if (energyKcal < config.hungryBelowKcal) return true
  if (energyKcal >= config.satiatedAtKcal) return false
  return hungry
}

export const walkSpeed = (config: ValleyConfig, person: Forager) =>
  speedForLoad(personConfig(config, person), loadKg(config, loadOf(person)))
/** A walk to a target, by a remembered way where `habitual` and one serves, else by a new plan. */
export function routeFor(state: ValleyState, person: Forager, target: Point, habitual = false): WalkFound | null {
  return findWalk(state, person, target, habitual, loadKg(state.config, loadOf(person)))
}
/**
 * The stock a person expects at a berry or hazel place, by the calendar. Nobody knows the year's crop, so inside a
 * window a person expects a normal year's crop grown day by day: what they last saw, plus what a normal year grows on
 * the window's days since, if they saw it since the window's start; else the openness share of what a normal year
 * has grown by today. Outside the window they expect what they saw there since its start, else nothing.
 */
export function expectedFoodStock(
  config: ValleyConfig,
  kind: 0 | 1,
  seen: number,
  seenMinute: number,
  sharePerMille: number,
  minute: number,
) {
  return stockExpectation(config, kind, minute)(seen, seenMinute, sharePerMille)
}
/** `expectedFoodStock` for one kind at one minute, with what does not depend on the place worked out once. */
function stockExpectation(config: ValleyConfig, kind: 0 | 1, minute: number) {
  const window = kind === 0 ? config.berrySeason : config.nutSeason
  const { index, days } = windowDayIndex(config, window, minute)
  const normal = cropOf(config, kind, (kind === 0 ? config.berryYearPerMille : config.hazelYearPerMille).normal)
  // A normal year's crop grown by the end of window day `i`; nothing before the window's first day.
  const grown = (i: number) => (i < 0 ? 0 : Math.floor((normal * (i + 1)) / days))
  const capacity = thicketCapacity(config, kind)
  const start = lastWindowStartMinute(config, window, minute)
  return (seen: number, seenMinute: number, sharePerMille: number) => {
    if (seen >= 0 && seenMinute >= start) {
      if (index < 0) return seen
      const since = windowDayIndex(config, window, seenMinute).index
      return Math.min(capacity, seen + grown(index) - grown(since))
    }
    return index < 0 ? 0 : Math.floor((Math.min(capacity, grown(index)) * sharePerMille) / 1000)
  }
}
/** Expected stock at a person's remembered places at one minute, by place id. */
function stockExpecter(state: ValleyState, person: Forager, minute: number) {
  const byKind = [stockExpectation(state.config, 0, minute), stockExpectation(state.config, 1, minute)] as const
  return (id: number) =>
    byKind[state.layout.places.kind[id] as 0 | 1](
      person.placeStock[id]!,
      person.placeCheckedMinute[id]!,
      person.expectedStockPerMille,
    )
}
export const expectedStockAt = (state: ValleyState, person: Forager, id: number, minute: number) =>
  stockExpecter(state, person, minute)(id)
/** Whether a person expects nuts at some hazel place they remember. */
export function expectsNuts(state: ValleyState, person: Forager, minute: number) {
  const expected = stockExpecter(state, person, minute)
  for (let id = 0; id < state.layout.places.count; id += 1)
    if (person.knownPlaces[id]! >= 0 && state.layout.places.kind[id] === 1 && expected(id) > 0) return true
  return false
}
/** A store need: the store holds less than its target, and nuts are expected somewhere remembered. */
export const hasStoreNeed = (state: ValleyState, person: Forager, minute: number) =>
  storeKcal(person) < storeTarget(state.config, person, minute) && expectsNuts(state, person, minute)
/** The nuts a person could still carry, in kilocalories: their load capacity in nuts less the nuts in hand. */
export const nutRoomKcal = (config: ValleyConfig, person: Forager) =>
  Math.max(0, person.loadCapacityKg * config.nutKcalPerKg - carriedByFood(person.carried).nuts)
export interface TaskChoice {
  walk?: WalkFound
  productionPerHour?: number
  expectedStock?: number
  desiredCarriedKcal?: number
  kind: TaskKind
  placeId: number
  target: Point | null
  reason: ActionReason
  /** For making an axe: whether it is a stint of practice. */
  practice?: boolean
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
  const home = estimate(state, person, person.hearth)
  return home >= state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)
}
const placeHeightCache = new WeakMap<ValleyState['layout']['places'], Float64Array>()
/** Every place's ground height, by place id, worked out once per layout. */
function placeHeights(state: ValleyState) {
  const places = state.layout.places
  let heights = placeHeightCache.get(places)
  if (!heights) {
    heights = new Float64Array(places.count)
    for (let id = 0; id < places.count; id += 1)
      heights[id] = cachedHeight(state.layout.nav.mesh, places.x[id]!, places.y[id]!)
    placeHeightCache.set(places, heights)
  }
  return heights
}
/** Bodies by bound, then id, nearest first. */
class BodyHeap {
  private items: { bodyId: number; bound: number }[] = []
  get size() {
    return this.items.length
  }
  peek() {
    return this.items[0]!
  }
  private before(i: number, j: number) {
    const a = this.items[i]!,
      b = this.items[j]!
    return a.bound < b.bound || (a.bound === b.bound && a.bodyId < b.bodyId)
  }
  private swap(i: number, j: number) {
    const t = this.items[i]!
    this.items[i] = this.items[j]!
    this.items[j] = t
  }
  push(item: { bodyId: number; bound: number }) {
    this.items.push(item)
    for (let i = this.items.length - 1; i > 0;) {
      const up = (i - 1) >> 1
      if (!this.before(i, up)) break
      this.swap(i, up)
      i = up
    }
  }
  pop() {
    const top = this.items[0]!,
      last = this.items.pop()!
    if (this.items.length) {
      this.items[0] = last
      for (let i = 0; ;) {
        const l = 2 * i + 1,
          r = l + 1
        let least = i
        if (l < this.items.length && this.before(l, least)) least = l
        if (r < this.items.length && this.before(r, least)) least = r
        if (least === i) break
        this.swap(i, least)
        i = least
      }
    }
    return top
  }
}
interface PlaceGrid {
  x0: number
  y0: number
  sizeCm: number
  columns: number
  /** The berry and hazel places in each cell, row by row, by place id. */
  cells: number[][]
}
const foodGridCache = new WeakMap<ValleyState['layout']['places'], PlaceGrid>()
/** The berry and hazel places on a square grid of 24 by 24 cells over them, worked out once per layout. */
function foodPlaceGrid(places: ValleyState['layout']['places']) {
  let grid = foodGridCache.get(places)
  if (grid) return grid
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (let id = 0; id < places.count; id += 1) {
    if (places.kind[id] !== 0 && places.kind[id] !== 1) continue
    x0 = Math.min(x0, places.x[id]!)
    y0 = Math.min(y0, places.y[id]!)
    x1 = Math.max(x1, places.x[id]!)
    y1 = Math.max(y1, places.y[id]!)
  }
  const columns = 24
  if (x0 > x1) {
    grid = { x0: 0, y0: 0, sizeCm: 1, columns, cells: [] }
  } else {
    const sizeCm = Math.max(1, Math.ceil((Math.max(x1 - x0, y1 - y0) + 1) / columns))
    grid = { x0, y0, sizeCm, columns, cells: Array.from({ length: columns * columns }, () => []) }
    for (let id = 0; id < places.count; id += 1) {
      if (places.kind[id] !== 0 && places.kind[id] !== 1) continue
      const column = Math.floor((places.x[id]! - x0) / sizeCm),
        row = Math.floor((places.y[id]! - y0) / sizeCm)
      grid.cells[row * columns + column]!.push(id)
    }
  }
  foodGridCache.set(places, grid)
  return grid
}
function estimate(state: ValleyState, person: Forager, point: Point) {
  return estimateMinutes(
    state.config,
    person,
    point,
    walkSpeed(state.config, person) * 60,
    cachedHeight(state.layout.nav.mesh, point.x, point.y) - cachedHeight(state.layout.nav.mesh, person.x, person.y),
  )
}
function canVisit(state: ValleyState, person: Forager, point: Point, minute: number) {
  return (
    estimate(state, person, point) +
      estimateMinutes(state.config, point, person.hearth, walkSpeed(state.config, person) * 60, 0) +
      1 <
    state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)
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
function explore(state: ValleyState, person: Forager, reason: ActionReason, ignoreMargin = false): TaskChoice {
  const point = nearestFrontier(state.layout.nav, person.knowledge, person)
  if (point && (ignoreMargin || canVisit(state, person, point, state.minute)))
    return { kind: 'walk', placeId: -1, target: point, reason }
  return !ignoreMargin && !atHearth(person)
    ? { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home' }
    : restChoice('no known route')
}
function waterGoal(state: ValleyState, person: Forager, minute: number, severe: boolean): TaskChoice {
  const banks = nearestBanks(state.layout.nav, state.config, person, walkSpeed(state.config, person) * 60, 3)
  let searches = 0
  for (const { bank, minutes } of banks) {
    const here = (person.x - bank.x) ** 2 + (person.y - bank.y) ** 2 <= state.config.reachCm ** 2
    if (here) return workAt(state, person, bank.id, 'drink', 'drinking', 0, 0)
    if (
      !severe &&
      minutes + estimateMinutes(state.config, bank, person.hearth, walkSpeed(state.config, person) * 60, 0) + 1 >
        state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)
    )
      continue
    if (searches++ >= 3) break
    const walk = routeFor(state, person, bank, true)
    if (!walk) continue
    return { ...workAt(state, person, bank.id, 'drink', 'seeking water', 0, 0), walk }
  }
  return explore(state, person, 'seeking water', severe)
}
/** Whether a point is on the same piece of known ground as the person; the person's own piece is found once. */
function reachability(state: ValleyState, person: Forager) {
  const nav = state.layout.nav
  let first: number | undefined, componentOf: ((t: number) => number) | undefined
  return (point: Point) => {
    first ??= routeTriangle(nav, person.knowledge, person)
    const last = routeTriangle(nav, person.knowledge, point)
    if (first < 0 || last < 0) return false
    componentOf ??= knownComponents(nav, person.knowledge)
    return componentOf(first) === componentOf(last)
  }
}
/**
 * The best remembered food source by one hour's expected food after the walk: thickets at their expected stock,
 * fish, and the person's own store at home. For a store load (`forStore`), only hazel places expected to hold nuts;
 * food to pay with (`toPay`) is gathered, never taken from the store.
 */
export function foodGoal(
  state: ValleyState,
  person: Forager,
  minute: number,
  forStore = false,
  toPay = false,
): TaskChoice | null {
  let best: TaskChoice | null = null,
    bestScore = -1,
    bestId = Infinity
  const reachable = reachability(state, person)
  // Nothing about the person changes while they choose, so their speed and ground height are worked out once.
  const speed = walkSpeed(state.config, person) * 60,
    mesh = state.layout.nav.mesh,
    personHeight = cachedHeight(mesh, person.x, person.y),
    daylight = state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)
  const consider = (
    id: number,
    kind: 'pick' | 'nuts' | 'fish' | 'store' | 'eat store',
    target: Point,
    rate: number,
    stock: number,
  ) => {
    if (rate <= person.rates.pickKcalPerHour || rate < bestScore) return
    const lowerTravel = estimateMinutes(state.config, person, target, speed, 0)
    if ((3600 * rate) / (lowerTravel * 60 + 3600) < bestScore) return
    const travel = estimateMinutes(
      state.config,
      person,
      target,
      speed,
      cachedHeight(mesh, target.x, target.y) - personHeight,
    )
    const home = estimateMinutes(state.config, target, person.hearth, speed, 0)
    if (travel + home + 1 > daylight) return
    const score = (3_600 * rate) / (travel * 60 + 3_600)
    if ((score > bestScore || (score === bestScore && id < bestId)) && reachable(target)) {
      bestScore = score
      bestId = id
      best =
        kind === 'eat store'
          ? atHearth(person)
            ? {
                kind,
                placeId: -1,
                target: null,
                reason: 'eating from the store',
                productionPerHour: rate,
                expectedStock: stock,
              }
            : { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home to eat from the store' }
          : workAt(
              state,
              person,
              id,
              kind,
              kind === 'pick'
                ? 'foraging'
                : kind === 'nuts'
                  ? 'gathering nuts'
                  : kind === 'store'
                    ? 'gathering nuts for the store'
                    : 'fishing',
              rate,
              stock,
            )
    }
  }
  // The rate a person expects fishing a body: the share of its stock they last saw, else their usual expectation.
  const fishRateAt = (bodyId: number) => {
    const remembered = person.fishMemory.get(bodyId)
    return remembered
      ? remembered.capacity
        ? Math.floor((person.fishRate * remembered.stock) / remembered.capacity)
        : 0
      : Math.floor((person.fishRate * person.expectedStockPerMille) / 1000)
  }
  const nav = state.layout.nav,
    stored = forStore || toPay ? 0 : storeKcal(person)
  // A floor under the best score: the score of the store and of fishing the body of the nearest known bank, each a
  // real candidate that passes every test of `consider`, so the choice scores at least the floor. A candidate whose
  // best possible score is below the floor cannot be chosen, and is passed over unseen: places by grid cell, when even
  // a full place at the cell's nearest corner would score below it, and bodies the same way by the box around their
  // banks. Every comparison in `consider` is strict with ties to the lower id, so the order places are looked at in does
  // not change the choice. Passing over only candidates that score below the choice leaves the best so far unchanged
  // from the first candidate at or above the floor on, so the gates on fishing below decide every such candidate as
  // they would with nothing passed over.
  let floor = -1
  if (!forStore) {
    const scoreOf = (target: Point, rate: number) => {
      if (rate <= person.rates.pickKcalPerHour) return -1
      const travel = estimateMinutes(
        state.config,
        person,
        target,
        speed,
        cachedHeight(mesh, target.x, target.y) - personHeight,
      )
      if (travel + estimateMinutes(state.config, target, person.hearth, speed, 0) + 1 > daylight) return -1
      return reachable(target) ? (3_600 * rate) / (travel * 60 + 3_600) : -1
    }
    if (stored > 0) floor = scoreOf(person.hearth, state.config.storeKcalPerHour)
    const nearestBody =
      person.fishRate > person.rates.pickKcalPerHour && nearestBanks(nav, state.config, person, speed, 1)[0]
    if (nearestBody) {
      const bodyId = nearestBody.bank.bodyId,
        candidate = nearestBanks(nav, state.config, person, speed, 1, bodyId)[0]
      if (candidate) floor = Math.max(floor, scoreOf(candidate.bank, fishRateAt(bodyId)))
    }
  }
  const fullBerries = fullRateOf(person, 'berries'),
    fullNuts = fullRateOf(person, 'nuts'),
    fullest = forStore ? fullNuts : Math.max(fullBerries, fullNuts),
    grid = foodPlaceGrid(state.layout.places),
    places = state.layout.places,
    berryCapacity = capacityOf(state.config, 'berries'),
    nutCapacity = capacityOf(state.config, 'nuts'),
    expectBerries = stockExpectation(state.config, 0, minute),
    expectNuts = stockExpectation(state.config, 1, minute)
  for (let cell = 0; cell < grid.cells.length; cell += 1) {
    const ids = grid.cells[cell]!
    if (!ids.length) continue
    const x0 = grid.x0 + (cell % grid.columns) * grid.sizeCm,
      y0 = grid.y0 + Math.floor(cell / grid.columns) * grid.sizeCm
    const nearest = distance(
      person.x,
      person.y,
      Math.max(x0, Math.min(x0 + grid.sizeCm, person.x)),
      Math.max(y0, Math.min(y0 + grid.sizeCm, person.y)),
    )
    if ((3_600 * fullest) / (Math.ceil(nearest / speed) * 60 + 3_600) < Math.max(floor, bestScore)) continue
    for (const id of ids) {
      if (person.knownPlaces[id]! < 0) continue
      const kind = places.kind[id]
      if (forStore && kind !== 1) continue
      const stock = (kind === 0 ? expectBerries : expectNuts)(
        person.placeStock[id]!,
        person.placeCheckedMinute[id]!,
        person.expectedStockPerMille,
      )
      if (forStore && stock <= 0) continue
      // `rateAtStock`, and the first test of `consider`, before anything is built for a place most often passed over.
      const rate = Math.floor(
        ((kind === 0 ? fullBerries : fullNuts) * stock) / (kind === 0 ? berryCapacity : nutCapacity),
      )
      if (rate <= person.rates.pickKcalPerHour || rate < bestScore) continue
      consider(
        id,
        kind === 0 ? 'pick' : forStore ? 'store' : 'nuts',
        { x: places.x[id]!, y: places.y[id]! },
        rate,
        stock,
      )
    }
  }
  if (forStore) return best
  if (stored > 0) consider(state.layout.places.count, 'eat store', person.hearth, state.config.storeKcalPerHour, stored)
  if (person.fishRate > bestScore) {
    // Nearest bodies first, so that far ones are skipped once a near one scores. No bank of a body can score above the
    // best when even its nearest corner cannot.
    const least = Math.max(floor, bestScore),
      known = knownBodySet(person.knownBanks)
    // Every body never fished is expected at the same rate; none is expected above `topRate`.
    const unfished = Math.floor((person.fishRate * person.expectedStockPerMille) / 1000)
    let topRate = unfished
    for (const bodyId of person.fishMemory.keys())
      if (known.has(bodyId)) topRate = Math.max(topRate, fishRateAt(bodyId))
    // Bodies are taken in order of `bodyMinutesBound`, then id, working out the bound only for those that could come
    // next: a body is put in hand once the straight-line minutes to the box around its banks, a lower bound on its
    // bound, are no more than the nearest bound in hand. A body that would score below the floor even at that lower
    // bound is passed over, and so is one `consider` would turn down whichever bank it is: at a rate no better than
    // picking, or with no time to walk there and home before dusk even at the lower bounds on both walks. Once even the
    // highest rate at the nearest bound left fails the tests below, every body left fails them.
    const ready = new BodyHeap()
    const offer = (bodyId: number) => {
      const rate = fishRateAt(bodyId)
      if (rate < least || rate <= person.rates.pickKcalPerHour) return
      const minutes = Math.ceil(bodyDistanceBound(nav, person, bodyId) / speed)
      if ((3_600 * rate) / (minutes * 60 + 3_600) < least) return
      if (minutes + Math.ceil(bodyDistanceBound(nav, person.hearth, bodyId) / speed) + 1 > daylight) return
      ready.push({ bodyId, bound: bodyMinutesBound(nav, state.config, person, speed, bodyId) })
    }
    const nearest = () => (ready.size ? ready.peek().bound : Infinity)
    let pull: () => void
    if (unfished < least) {
      // Only remembered bodies can pass, so they alone are looked at, by the straight-line minutes to their box.
      const pending = [...person.fishMemory.keys()]
        .filter((bodyId) => known.has(bodyId) && fishRateAt(bodyId) > person.rates.pickKcalPerHour)
        .map((bodyId) => ({ bodyId, minutes: Math.ceil(bodyDistanceBound(nav, person, bodyId) / speed) }))
        .sort((a, b) => a.minutes - b.minutes)
      let next = 0
      pull = () => {
        while (next < pending.length && pending[next]!.minutes <= nearest()) offer(pending[next++]!.bodyId)
      }
    } else {
      // Else bodies are looked at by rings of grid cells around the person: no body first met in ring `r` lies nearer
      // than `r − 1` cells.
      const waters = bodyGrid(nav),
        taken = new Set<number>()
      const column = Math.max(0, Math.min(waters.columns - 1, Math.floor((person.x - waters.x0) / waters.sizeCm))),
        row = Math.max(0, Math.min(waters.columns - 1, Math.floor((person.y - waters.y0) / waters.sizeCm)))
      const lastRing = Math.max(column, waters.columns - 1 - column, row, waters.columns - 1 - row)
      const ringMinutes = (ring: number) => Math.ceil((Math.max(0, ring - 1) * waters.sizeCm) / speed)
      const take = (c: number, r: number) => {
        if (c < 0 || r < 0 || c >= waters.columns || r >= waters.columns) return
        for (const bodyId of waters.cells[r * waters.columns + c]!) {
          if (taken.has(bodyId)) continue
          taken.add(bodyId)
          if (known.has(bodyId)) offer(bodyId)
        }
      }
      let ring = 0
      pull = () => {
        while (ring <= lastRing && ringMinutes(ring) <= nearest()) {
          if (
            (3_600 * topRate) / (ringMinutes(ring) * 60 + 3_600) < least ||
            topRate <= person.rates.pickKcalPerHour ||
            ringMinutes(ring) + 1 > daylight
          ) {
            ring = lastRing + 1
            break
          }
          if (ring === 0) take(column, row)
          else {
            for (let c = column - ring; c <= column + ring; c += 1) {
              take(c, row - ring)
              take(c, row + ring)
            }
            for (let r = row - ring + 1; r <= row + ring - 1; r += 1) {
              take(column - ring, r)
              take(column + ring, r)
            }
          }
          ring += 1
        }
      }
    }
    for (;;) {
      pull()
      if (!ready.size) break
      const { bodyId, bound } = ready.pop()
      if (topRate <= bestScore || (3_600 * topRate) / (bound * 60 + 3_600) < bestScore) break
      const possibleRate = fishRateAt(bodyId)
      if (possibleRate <= bestScore || (3_600 * possibleRate) / (bound * 60 + 3_600) < bestScore) continue
      const candidate = nearestBanks(state.layout.nav, state.config, person, speed, 1, bodyId)[0]
      if (!candidate) continue
      const bank = candidate.bank,
        memory = person.fishMemory.get(bodyId)
      const rate = memory
        ? memory.capacity
          ? Math.floor((person.fishRate * memory.stock) / memory.capacity)
          : 0
        : Math.floor((person.fishRate * person.expectedStockPerMille) / 1000)
      consider(bank.id, 'fish', bank, rate, memory?.stock ?? Math.floor(rate / 60))
    }
  }
  return best
}
function woodGoal(state: ValleyState, person: Forager, minute: number): TaskChoice | null {
  let best = -1,
    bestMinutes = Infinity,
    bestStock = 0
  const reachable = reachability(state, person),
    speed = walkSpeed(state.config, person) * 60,
    mesh = state.layout.nav.mesh,
    personHeight = cachedHeight(mesh, person.x, person.y),
    heights = placeHeights(state),
    daylight = state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)
  for (let id = 0; id < state.layout.places.count; id += 1) {
    if (person.knownPlaces[id]! < 0) continue
    const kind = state.layout.places.kind[id]
    if (kind !== 0 && kind !== 2) continue
    const stock =
      person.placeWood[id]! < 0
        ? kind === 0
          ? Math.floor((state.config.berryThicketWoodKg * person.expectedStockPerMille) / 1000)
          : Math.floor((state.config.standWoodKg * person.expectedStockPerMille) / 1000)
        : person.placeWood[id]!
    if (stock <= 0) continue
    const target = { x: state.layout.places.x[id]!, y: state.layout.places.y[id]! },
      travel = estimateMinutes(state.config, person, target, speed, heights[id]! - personHeight)
    // Only a nearer place can win, so the costlier tests come after this one.
    if (travel >= bestMinutes || !reachable(target)) continue
    if (travel + estimateMinutes(state.config, target, person.hearth, speed, 0) + 1 > daylight) continue
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
  const severe = person.waterDeficitMl >= waterThresholds(personConfig(state.config, person)).urgent
  if (severe) return waterGoal(state, person, minute, true)
  if (mustGoHome(state, person, minute))
    return { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home' }
  if (!isDaylight(state.config, minute)) return { kind: 'sleep', placeId: -1, target: null, reason: 'night' }
  if (minuteOfDay(minute) >= state.config.duskHour * 60 - person.duskMarginMinutes)
    return restChoice('too late to set out')
  if (person.thirsty) return waterGoal(state, person, minute, false)
  if (person.log && !atHearth(person))
    return { kind: 'walk', placeId: -1, target: person.hearth, reason: 'taking a log home' }
  if (!person.hungry && person.tripWood >= person.loadCapacityKg && !atHearth(person))
    return { kind: 'walk', placeId: -1, target: person.hearth, reason: 'taking a load home' }
  if (!person.hungry && person.tripWood > 0 && person.tripWood < person.loadCapacityKg)
    return woodGoal(state, person, minute) ?? explore(state, person, 'seeking wood')
  if (!person.hungry && person.storeTrip && !atHearth(person)) {
    const home: TaskChoice = { kind: 'walk', placeId: -1, target: person.hearth, reason: 'taking nuts home to store' }
    return nutRoomKcal(state.config, person) <= 0 ? home : (foodGoal(state, person, minute, true) ?? home)
  }
  const storeChoice =
    !person.hungry && !person.shortOfWood && hasStoreNeed(state, person, minute)
      ? foodGoal(state, person, minute, true)
      : null
  if (!person.hungry && !person.shortOfWood && !storeChoice) {
    if (person.groupId === null) {
      const seen = [...person.metPosition.entries()]
        .filter(
          ([id, point]) =>
            person.seenMinute[id] === minute &&
            state.foragers[id]!.alive &&
            (point.x - person.x) ** 2 + (point.y - person.y) ** 2 <= person.companyRadiusCm ** 2 &&
            canVisit(state, person, point, minute),
        )
        .sort(
          (a, b) =>
            (a[1].x - person.x) ** 2 +
              (a[1].y - person.y) ** 2 -
              ((b[1].x - person.x) ** 2 + (b[1].y - person.y) ** 2) || a[0] - b[0],
        )
      const company = seen.find(
        ([, point]) => (point.x - person.x) ** 2 + (point.y - person.y) ** 2 > state.config.talkRadiusCm ** 2,
      )
      if (company) return { kind: 'walk', placeId: -1, target: company[1], reason: 'seeking company' }
      const flags = person.knownFlags
        .map((id) => state.groups[id])
        .filter(
          (g) =>
            g &&
            g.dissolvedMinute === null &&
            (g.flag.x - person.x) ** 2 + (g.flag.y - person.y) ** 2 <= person.companyRadiusCm ** 2 &&
            canVisit(state, person, g.flag, minute),
        )
        .map((g) => ({ group: g!, minutes: estimate(state, person, g!.flag) }))
        .sort((a, b) => a.minutes - b.minutes || a.group.id - b.group.id)
      if (flags.length) {
        const flag = flags[0]!.group.flag
        return person.x === flag.x && person.y === flag.y
          ? restChoice('waiting for company')
          : { kind: 'walk', placeId: -1, target: flag, reason: 'seeking company' }
      }
    } else {
      if (!person.axe && person.spareAxe) {
        person.axe = person.spareAxe
        person.spareAxe = null
      }
      const plan = planHut(state, person, minute)
      if (plan?.kind === 'make')
        return atHearth(person)
          ? { kind: 'make', placeId: -1, target: null, reason: 'making an axe' }
          : { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home to make an axe' }
      if (plan?.kind === 'cut') return workAt(state, person, plan.treeId, 'cut', 'cutting a log', 0, 0)
      if (plan?.kind === 'stone') return workAt(state, person, plan.stoneId, 'gather', 'picking up a stone', 60, 1)
      if (plan?.kind === 'buy food') {
        const choice = foodGoal(state, person, minute, false, true)
        if (choice && person.heardAsk) {
          choice.desiredCarriedKcal = salePrice(
            person.heardAsk.price,
            worthTo(state.config, person, person.heardAsk.logs),
          )
          choice.reason = 'picking food to buy an axe'
        }
        return choice ?? restChoice('waiting to buy an axe')
      }
      if (plan?.kind === 'await axe' || plan?.kind === 'await sale')
        return atHearth(person)
          ? restChoice('waiting for an axe being made')
          : { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home to wait for an axe' }
    }
    const frontier = nearestFrontier(state.layout.nav, person.knowledge, person)
    if (
      frontier &&
      (frontier.x - person.hearth.x) ** 2 + (frontier.y - person.hearth.y) ** 2 <= person.exploringRangeCm ** 2 &&
      estimate(state, person, frontier) +
        estimateMinutes(state.config, frontier, person.hearth, walkSpeed(state.config, person) * 60, 0) +
        1 <
        state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)
    )
      return { kind: 'walk', placeId: -1, target: frontier, reason: 'exploring' }
    const practice = practiceChoice(state, person, minute)
    if (practice) return practice
    if (!atHearth(person)) return { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home to rest' }
    const walk = leisureWalk(state, person, minute)
    if (walk) return walk
  }
  if (person.hungry || person.shortOfWood) {
    const work = chooseWork(state.config, person, minute)
    if (work === 'wait') return restChoice('waiting to swap')
    if (work) {
      person.trip = work.trip
      const good = work.good === 'wood' && person.tripWood >= person.loadCapacityKg ? 'food' : work.good
      const choice =
        (good === 'food'
          ? foodGoal(state, person, minute, false, work.forTrade && !person.hungry)
          : woodGoal(state, person, minute)) ??
        explore(state, person, good === 'food' ? 'seeking food' : 'seeking wood')
      if (work.forTrade && good === 'food')
        choice.desiredCarriedKcal = wantedWood(state.config, person) * (knownTerms(state.config, person, minute) ?? 0)
      return choice
    }
  }
  if (storeChoice) {
    person.storeTrip = true
    return storeChoice
  }
  return restChoice()
}
/**
 * Practice in free time while today's budget lasts: continue a practice axe, or begin one with a stone and wood in hand,
 * fetching a stone first from the nearest remembered outcrop within exploring range that leaves time to return home
 * before dusk. Null when the budget is spent or nothing can be practised, so the walk or rest decides.
 */
function practiceChoice(state: ValleyState, person: Forager, minute: number): TaskChoice | null {
  const { config, layout } = state
  if (person.practicedToday >= practiceBudget(config, person)) return null
  const home = (reason: ActionReason, practice: boolean): TaskChoice =>
    atHearth(person)
      ? { kind: 'make', placeId: -1, target: null, reason, practice }
      : { kind: 'walk', placeId: -1, target: person.hearth, reason: 'going home to practise' }
  if (person.making) return person.making.practice ? home('practising', true) : null
  if (person.wood < config.axeWood) return null
  if (person.stone >= 1) return home('practising', true)
  const speed = Math.max(1, walkSpeed(config, person) * 60)
  let best = -1,
    bestCm = Infinity
  for (let id = 0; id < layout.places.count; id += 1) {
    if (person.knownPlaces[id]! < 0 || layout.places.kind[id] !== 3 || person.placeStock[id] === 0) continue
    const x = layout.places.x[id]!,
      y = layout.places.y[id]!,
      cm = distance(person.x, person.y, x, y),
      back = distance(x, y, person.hearth.x, person.hearth.y)
    if (back > person.exploringRangeCm) continue
    if ((cm + back) / speed + 1 > config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)) continue
    if (cm < bestCm) {
      best = id
      bestCm = cm
    }
  }
  return best < 0 ? null : workAt(state, person, best, 'gather', 'fetching a stone to practise', 60, 1)
}
/**
 * At most once in `leisureWalkDays` days, a walk out along the remembered way from home used longest ago whose far end
 * leaves time to return before dusk.
 */
const pointEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y
function leisureWalk(state: ValleyState, person: Forager, minute: number): TaskChoice | null {
  if (
    person.leisureMinute >= 0 &&
    Math.floor(minute / MINUTES_PER_DAY) - Math.floor(person.leisureMinute / MINUTES_PER_DAY) <
      state.config.leisureWalkDays
  )
    return null
  const left = state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute),
    speed = walkSpeed(state.config, person) * 60
  const home = person.hearth
  const ways = person.ways
    .filter((w) => pointEqual(w.a, home) || pointEqual(w.b, home))
    .sort((a, b) => a.usedMinute - b.usedMinute || a.id - b.id)
  for (const way of ways) {
    const far = pointEqual(way.a, home) ? way.b : way.a
    if (2 * estimateMinutes(state.config, home, far, speed, 0) + 1 >= left) continue
    const walk = routeFor(state, person, far, true)
    return walk ? { kind: 'walk', placeId: -1, target: far, reason: 'out for a walk', walk } : null
  }
  return null
}
export const fillingLoad = (_config: ValleyConfig, person: Forager) =>
  person.tripWood > 0 && person.tripWood < person.loadCapacityKg
export const carryingFullLoad = (_config: ValleyConfig, person: Forager) =>
  person.loadCapacityKg > 0 && person.tripWood >= person.loadCapacityKg

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
        const request = Math.max(0, forager.satiationKcal - forager.energyKcal - carried)
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
