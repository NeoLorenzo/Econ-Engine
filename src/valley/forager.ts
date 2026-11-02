import { personConfig } from './nature'
import { nearestBanks, knownBodies } from './bankSearch'
import { planHut, salePrice, worthTo } from './axes'
import { waterThresholds } from './body'
import { capacityOf as foodCapacity, fullRateOf, rateAtStock, carriedKcal } from './food'
import { knownTerms, buyingPays, sellingPays, wantedWood, spareWood } from './trade'
import { nearestFrontier, estimateMinutes, knownComponents, routeTriangle } from './routes'
import { cachedHeight } from './routes'
import { carriedByFood, foodKg } from './food'
import { MINUTES_PER_DAY, minuteOfDay } from './calendar'
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
export function foodGoal(state: ValleyState, person: Forager, minute: number): TaskChoice | null {
  let best: TaskChoice | null = null,
    bestScore = -1,
    bestId = Infinity
  const reachable = reachability(state, person)
  const consider = (id: number, kind: 'pick' | 'nuts' | 'fish', target: Point, rate: number, stock: number) => {
    if (rate <= person.rates.pickKcalPerHour || rate < bestScore) return
    const lowerTravel = estimateMinutes(state.config, person, target, walkSpeed(state.config, person) * 60, 0)
    if ((3600 * rate) / (lowerTravel * 60 + 3600) < bestScore) return
    const travel = estimate(state, person, target)
    const home = estimateMinutes(state.config, target, person.hearth, walkSpeed(state.config, person) * 60, 0)
    if (travel + home + 1 > state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)) return
    const score = (3_600 * rate) / (travel * 60 + 3_600)
    if ((score > bestScore || (score === bestScore && id < bestId)) && reachable(target)) {
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
      stock =
        person.placeStock[id]! < 0
          ? Math.floor((foodCapacity(state.config, food) * person.expectedStockPerMille) / 1000)
          : person.placeStock[id]!
    consider(
      id,
      kind === 0 ? 'pick' : 'nuts',
      { x: state.layout.places.x[id]!, y: state.layout.places.y[id]! },
      rateAtStock(state.config, fullRateOf(person, food), food, stock),
      stock,
    )
  }
  if (person.fishRate > bestScore)
    for (const bodyId of knownBodies(person.knownBanks)) {
      const remembered = person.fishMemory.get(bodyId)
      const possibleRate = remembered
        ? remembered.capacity
          ? Math.floor((person.fishRate * remembered.stock) / remembered.capacity)
          : 0
        : Math.floor((person.fishRate * person.expectedStockPerMille) / 1000)
      if (possibleRate <= bestScore) continue
      const candidate = nearestBanks(
        state.layout.nav,
        state.config,
        person,
        walkSpeed(state.config, person) * 60,
        1,
        bodyId,
      )[0]
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
  return best
}
function woodGoal(state: ValleyState, person: Forager, minute: number): TaskChoice | null {
  let best = -1,
    bestMinutes = Infinity,
    bestStock = 0
  const reachable = reachability(state, person)
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
      travel = estimate(state, person, target)
    // Only a nearer place can win, so the costlier tests come after this one.
    if (travel >= bestMinutes || !reachable(target)) continue
    if (
      travel + estimateMinutes(state.config, target, person.hearth, walkSpeed(state.config, person) * 60, 0) + 1 >
      state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute)
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
  if (!person.hungry && !person.shortOfWood) {
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
        const choice = foodGoal(state, person, minute)
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
        (good === 'food' ? foodGoal(state, person, minute) : woodGoal(state, person, minute)) ??
        explore(state, person, good === 'food' ? 'seeking food' : 'seeking wood')
      if (work.forTrade && good === 'food')
        choice.desiredCarriedKcal = wantedWood(state.config, person) * (knownTerms(state.config, person, minute) ?? 0)
      return choice
    }
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
