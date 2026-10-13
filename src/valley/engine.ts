import { carriedKcal, spoil } from '../life/food'
import { resolveValleyConfig } from './config'
import {
  MINUTES_PER_DAY,
  atHearth,
  carryingFullLoad,
  choosePlant,
  chooseWork,
  fillingLoad,
  idleReason,
  isDaylight,
  loadKg,
  loadOf,
  minuteOfWork,
  mustGoHome,
  nextHungry,
  observe,
  plantsInView,
  speedForLoad,
} from './forager'
import { distance, distanceSq, distanceUp, stepTowards, walkSeconds } from './geometry'
import { drawSkills, generateLayout, layoutError, turnOrder } from './layout'
import { noTaskSeconds, practiceDay, ratesOf, startingLog } from './practice'
import {
  choosePlace,
  dissolveIfAlone,
  idleGoal,
  meet,
  observeFlags,
  observePlaces,
  placeCentre,
  placeCount,
  startingGroups,
} from './social'
import { chooseSite, observeSites, siteCentre, siteCount, sitesCheckedSince, sitesKnown } from './sites'
import { nextShortOfWood, swap, woodMatters } from './trade'
import { coldMatters, hourlyShare, minuteCost, tendFire, workSeconds, type MinuteSeconds } from './work'
import type {
  ActionEvent,
  ActionReason,
  DaySummary,
  DeathEvent,
  FoodLot,
  Forager,
  ForagerAction,
  Good,
  GroupEvent,
  PracticeEvent,
  QuoteEvent,
  SwapEvent,
  ValleyConfig,
  ValleyEvent,
  ValleyState,
} from './types'

/** The observer shows the last 3 days of events; experiments read daily summaries instead. */
export const EVENT_HISTORY_DAYS = 3

const sum = (values: Int32Array) => {
  let total = 0
  for (const value of values) total += value
  return total
}

const zeros = (n: number) => Array.from({ length: n }, () => 0)

/** Groups standing, and living foragers without a group. */
function groupCounts(state: Pick<ValleyState, 'foragers' | 'groups'>) {
  return {
    groupsStanding: state.groups.filter((group) => group.dissolvedMinute === null).length,
    loners: state.foragers.filter((forager) => forager.alive && forager.groupId === null).length,
  }
}

function emptyDay(day: number, state: Pick<ValleyState, 'foragers' | 'bushKcal' | 'treeWood' | 'groups'>): DaySummary {
  const { foragers } = state
  return {
    day,
    seconds: { sleep: 0, rest: 0, walk: 0, forage: 0, gather: 0 },
    gatheredKcal: 0,
    spentKcal: 0,
    alive: foragers.filter((forager) => forager.alive).length,
    deaths: 0,
    bushStockKcal: sum(state.bushKcal),
    treeWood: sum(state.treeWood),
    endEnergyKcal: foragers.map((forager) => forager.energyKcal),
    spoiledKcal: 0,
    carriedKcal: foragers.reduce((total, forager) => total + carriedKcal(forager.carried), 0),
    gatheredWood: 0,
    burnedWood: 0,
    sleepMinutes: 0,
    coldSleepMinutes: 0,
    swaps: 0,
    quotes: 0,
    swappedWood: 0,
    swappedKcal: 0,
    forageRates: foragers.map((forager) => forager.forageRate),
    woodRates: foragers.map((forager) => forager.woodRate),
    forageSecondsById: zeros(foragers.length),
    gatherSecondsById: zeros(foragers.length),
    walkSecondsById: zeros(foragers.length),
    gatheredWoodById: zeros(foragers.length),
    ...groupCounts(state),
    foundings: 0,
    joinings: 0,
    dissolutions: 0,
    placesSeenById: foragers.map((forager) => forager.placesSeen),
    loadedWalkSecondsById: zeros(foragers.length),
    sitesKnownById: foragers.map(sitesKnown),
    sitesCheckedById: zeros(foragers.length),
  }
}

/** Creates the valley at minute 0. Throws on a configuration that breaks a rule or whose layout cannot be drawn. */
export function createValley(overrides: Partial<ValleyConfig> = {}): ValleyState {
  const config = resolveValleyConfig(overrides)
  const unplaceable = layoutError(config)
  if (unplaceable) throw new Error(`Invalid valley configuration: ${unplaceable}`)
  const layout = generateLayout(config)
  const bushKcal = new Int32Array(layout.bushes.count).fill(config.initialBushKcal)
  const treeWood = new Int32Array(layout.trees.count).fill(config.initialTreeWood)
  const skills = drawSkills(config)
  const places = placeCount(config)
  const known = (stocks: Int32Array) =>
    config.knowValley
      ? { stock: Int32Array.from(stocks), seen: new Int32Array(stocks.length) }
      : { stock: new Int32Array(stocks.length), seen: new Int32Array(stocks.length).fill(-1) }
  const foragers: Forager[] = layout.hearths.map((hearth, id) => {
    const practiceLog = startingLog(config)
    const born = skills[id]!
    return {
      id,
      x: hearth.x,
      y: hearth.y,
      hearth,
      energyKcal: config.initialReserveKcal,
      hungry: config.initialReserveKcal < config.hungryBelowKcal,
      alive: true,
      deathMinute: null,
      carried: [],
      wood: 0,
      shortOfWood: woodMatters(config),
      tripWood: 0,
      targetBushId: null,
      targetTreeId: null,
      // Knowing the valley, as in Life 5, a forager has seen every plant and place at minute 0. Otherwise it has seen
      // nothing yet, and sees what is around it in its first turn.
      bushMemory: known(bushKcal),
      treeMemory: known(treeWood),
      groupId: null,
      joinedMinute: null,
      placeSeen: new Int32Array(places).fill(config.knowValley ? 0 : -1),
      placesSeen: config.knowValley ? places : 0,
      knownFlags: [],
      exploreTarget: null,
      // Knowing the valley, it has also spotted and checked every site at minute 0.
      siteKnown: new Uint8Array(siteCount(config)).fill(config.knowValley ? 1 : 0),
      siteChecked: new Int32Array(siteCount(config)).fill(config.knowValley ? 0 : -1),
      ...born,
      ...ratesOf(config, born.foragingSkill, born.woodSkill, practiceLog),
      practiceLog,
      secondsToday: noTaskSeconds(),
      loggedSeconds: noTaskSeconds(),
      secondsWorked: noTaskSeconds(),
      heardTerms: null,
      trip: null,
      pickRemainder: 0,
      gatherRemainder: 0,
      costRemainder: 0,
      fireHour: -1,
      warm: false,
      swapTotals: { woodSold: 0, woodBought: 0, kcalReceived: 0, kcalPaid: 0 },
    }
  })
  const groups = startingGroups(config, layout, foragers)
  const partial = { foragers, bushKcal, treeWood, groups }
  return {
    config,
    layout,
    minute: 0,
    bushKcal,
    treeWood,
    foragers,
    groups,
    totals: {
      initialKcal: sum(bushKcal) + foragers.reduce((total, forager) => total + forager.energyKcal, 0),
      regrownKcal: 0,
      metabolizedKcal: 0,
      gatheredKcal: 0,
      spoiledKcal: 0,
      initialWood: sum(treeWood),
      regrownWood: 0,
      gatheredWood: 0,
      burnedWood: 0,
      swappedWood: 0,
      swappedKcal: 0,
      firstSwapMinute: null,
    },
    lastEvents: [],
    lastSwaps: [],
    lastQuotes: [],
    lastPractice: [],
    lastDeaths: [],
    lastGroupEvents: [],
    eventDays: [[]],
    days: [],
    today: emptyDay(0, partial),
  }
}

const cloneForager = (forager: Forager): Forager => ({
  ...forager,
  carried: [...forager.carried],
  bushMemory: { stock: forager.bushMemory.stock.slice(), seen: forager.bushMemory.seen.slice() },
  treeMemory: { stock: forager.treeMemory.stock.slice(), seen: forager.treeMemory.seen.slice() },
  practiceLog: { forage: [...forager.practiceLog.forage], gather: [...forager.practiceLog.gather] },
  secondsToday: { ...forager.secondsToday },
  loggedSeconds: { ...forager.loggedSeconds },
  secondsWorked: { ...forager.secondsWorked },
  swapTotals: { ...forager.swapTotals },
  placeSeen: forager.placeSeen.slice(),
  knownFlags: [...forager.knownFlags],
  siteKnown: forager.siteKnown.slice(),
  siteChecked: forager.siteChecked.slice(),
})

const cloneDay = (day: DaySummary): DaySummary => ({
  ...day,
  seconds: { ...day.seconds },
  endEnergyKcal: [...day.endEnergyKcal],
  forageRates: [...day.forageRates],
  woodRates: [...day.woodRates],
  forageSecondsById: [...day.forageSecondsById],
  gatherSecondsById: [...day.gatherSecondsById],
  walkSecondsById: [...day.walkSecondsById],
  gatheredWoodById: [...day.gatheredWoodById],
  placesSeenById: [...day.placesSeenById],
  loadedWalkSecondsById: [...day.loadedWalkSecondsById],
  sitesKnownById: [...day.sitesKnownById],
  sitesCheckedById: [...day.sitesCheckedById],
})

/** A copy that shares nothing mutable with `state`. The layout and finished days never change, so they are shared. */
export function cloneValley(state: ValleyState): ValleyState {
  return {
    ...state,
    bushKcal: state.bushKcal.slice(),
    treeWood: state.treeWood.slice(),
    foragers: state.foragers.map(cloneForager),
    groups: state.groups.map((group) => ({ ...group })),
    totals: { ...state.totals },
    days: [...state.days],
    eventDays: state.eventDays.map((day, index) => (index === state.eventDays.length - 1 ? [...day] : day)),
    today: cloneDay(state.today),
  }
}

interface TurnResult {
  event: ActionEvent
  swaps: SwapEvent[]
  quotes: QuoteEvent[]
  met: GroupEvent | null
}

/**
 * Eats from carried lots, oldest first, up to `room`: what `takeOldest` leaves, without building the lots taken. Whole
 * lots eaten are dropped, a lot eaten in part is replaced by what is left of it, and the rest are kept as they are.
 */
export function eatCarried(lots: FoodLot[], room: number) {
  if (!lots.length || room <= 0) return { rest: lots, takenKcal: 0 }
  let takenKcal = 0
  let index = 0
  while (index < lots.length && takenKcal + lots[index]!.kcal <= room) takenKcal += lots[index++]!.kcal
  if (index < lots.length && takenKcal < room) {
    const lot = lots[index]!
    const rest = lots.slice(index)
    rest[0] = { kcal: lot.kcal - (room - takenKcal), harvestTick: lot.harvestTick }
    return { rest, takenKcal: room }
  }
  return { rest: index ? lots.slice(index) : lots, takenKcal }
}

const actionOf = (seconds: MinuteSeconds, good: Good | null, sleeping: boolean): ForagerAction => {
  if (seconds.work) return good === 'food' ? 'forage' : 'gather'
  if (seconds.walk) return 'walk'
  return sleeping ? 'sleep' : 'rest'
}

/** One forager's minute, changing the working copies in `state` in place. */
function takeTurn(state: ValleyState, forager: Forager, minute: number): TurnResult {
  const { config, layout } = state
  // Lots are kept oldest first, so nothing spoils while the oldest is still fresh.
  const oldest = forager.carried[0]
  const fresh = !oldest || config.shelfLifeHours === 0 || oldest.harvestTick > minute - 60 * config.shelfLifeHours
  const spoiled = fresh
    ? { lots: forager.carried, spoiledKcal: 0 }
    : spoil(forager.carried, minute, 60 * config.shelfLifeHours)
  const eaten = eatCarried(spoiled.lots, config.reserveMaxKcal - forager.energyKcal)
  forager.energyKcal += eaten.takenKcal
  forager.carried = eaten.rest
  observe(
    forager.bushMemory,
    plantsInView(config, layout.bushIndex, layout.bushes, forager.x, forager.y),
    state.bushKcal,
    minute,
  )
  observe(
    forager.treeMemory,
    plantsInView(config, layout.treeIndex, layout.trees, forager.x, forager.y),
    state.treeWood,
    minute,
  )
  observePlaces(config, forager, minute)
  observeFlags(config, forager, state.groups, minute)
  observeSites(config, layout, forager, minute)
  forager.hungry = nextHungry(config, forager.energyKcal, forager.hungry)
  forager.shortOfWood = nextShortOfWood(config, forager.wood, forager.shortOfWood)
  // What it carries as it sets out decides how fast it walks this minute.
  const load = loadOf(forager)
  const speed = speedForLoad(config, loadKg(config, load.wood, load.berriesKcal))

  const from = { x: forager.x, y: forager.y }
  const seconds: MinuteSeconds = { walk: 0, work: 0, stand: 0, sleep: 0 }
  let reason: ActionReason
  let good: Good | null = null
  let forTrade = false
  let targetId: number | null = null
  let plantId: number | null = null
  let placeId: number | null = null
  let siteId: number | null = null
  let gatheredKcal = 0
  let gatheredWood = 0
  let burnedWood = 0
  let sleeping = false
  let sleptCold = false
  const stride = 60 * speed

  /** Walks towards a point for up to the whole minute, at its speed; returns the seconds left after arriving. */
  const walkTo = (x: number, y: number) => {
    const needed = walkSeconds(distance(forager.x, forager.y, x, y), speed)
    const next = stepTowards(forager, { x, y }, stride)
    forager.x = next.x
    forager.y = next.y
    seconds.walk = Math.min(60, needed)
    return 60 - seconds.walk
  }

  if (mustGoHome(config, forager, minute)) {
    forager.trip = null
    reason = 'going home'
    seconds.stand = walkTo(forager.hearth.x, forager.hearth.y)
  } else if (!isDaylight(config, minute)) {
    forager.trip = null
    reason = 'night'
    sleeping = true
    burnedWood = tendFire(config, forager, minute)
    sleptCold = !forager.warm && coldMatters(config)
    seconds.sleep = 60
  } else if (config.loadHome && !forager.hungry && carryingFullLoad(config, forager)) {
    // Rule 4: not hungry, it takes a full load home and sets it down before anything else.
    forager.trip = null
    reason = 'taking a load home'
    seconds.stand = walkTo(forager.hearth.x, forager.hearth.y)
  } else {
    const filling = !forager.hungry && fillingLoad(config, forager)
    const work = chooseWork(config, forager, minute)
    const goal = work === null ? idleGoal(state, forager, minute) : null
    if (goal) {
      // Rules 5 and 6: seeking company, exploring or checking.
      forager.trip = null
      reason = goal.reason
      placeId = goal.placeId
      siteId = goal.siteId
      seconds.stand = forager.x === goal.x && forager.y === goal.y ? 60 : walkTo(goal.x, goal.y)
    } else if (work === null || work === 'wait') {
      forager.trip = null
      reason = work === null ? 'satiated' : 'waiting to swap'
      seconds.stand = 60
    } else {
      forager.trip = work.trip
      good = work.good
      forTrade = work.forTrade
      const food = good === 'food'
      const plants = food ? layout.bushes : layout.trees
      // Rule 9: remembering no plant worth a minute's work, it searches a site of the good it has never checked, then
      // ground it has never seen, before it revisits.
      let chosen = choosePlant(config, layout, forager, good, minute, false)
      const siteSearch =
        chosen === null && config.checkSites ? chooseSite(config, layout, forager, minute, 'search', good) : null
      const search =
        chosen === null && siteSearch === null && forager.placesSeen < placeCount(config)
          ? choosePlace(config, forager, minute, 'search')
          : null
      if (chosen === null && search === null && siteSearch === null)
        chosen = choosePlant(config, layout, forager, good, minute)
      if (food) forager.targetBushId = chosen
      else forager.targetTreeId = chosen
      if (siteSearch !== null) {
        const centre = siteCentre(config, layout, siteSearch)
        reason = 'searching'
        siteId = siteSearch
        seconds.stand = walkTo(centre.x, centre.y)
      } else if (search !== null) {
        const centre = placeCentre(config, search)
        reason = 'searching'
        placeId = search
        seconds.stand = walkTo(centre.x, centre.y)
      } else if (chosen === null) {
        reason = idleReason(config, forager, plants, minute)
        seconds.stand = 60
      } else {
        targetId = chosen
        const px = plants.x[chosen]!
        const py = plants.y[chosen]!
        let left = 60
        if (distanceSq(forager.x, forager.y, px, py) > config.reachCm ** 2) {
          // The point `reachCm` short of the plant on the straight line from here. Dividing by the distance rounded up
          // keeps it within reach.
          const d = distanceUp(forager.x, forager.y, px, py)
          const x = px - Math.trunc(((px - forager.x) * config.reachCm) / d)
          const y = py - Math.trunc(((py - forager.y) * config.reachCm) / d)
          left = walkTo(x, y)
        }
        const stock = food ? state.bushKcal : state.treeWood
        const rate = food ? forager.forageRate : forager.woodRate
        if (left > 0 && stock[chosen]! >= minuteOfWork(rate)) {
          seconds.work = left
          plantId = chosen
          if (food) {
            const due = workSeconds(forager.pickRemainder, rate, left)
            forager.pickRemainder = due.remainder
            gatheredKcal = due.units
            stock[chosen]! -= due.units
            const eat = Math.min(due.units, config.reserveMaxKcal - forager.energyKcal)
            forager.energyKcal += eat
            if (due.units > eat)
              // Picked this minute, it is the newest lot, so it goes last, as `addLots` would put it.
              forager.carried = [...forager.carried, { kcal: due.units - eat, harvestTick: minute }]
            forager.secondsToday.forage += left
            forager.secondsWorked.forage += left
          } else {
            const due = workSeconds(forager.gatherRemainder, rate, left)
            forager.gatherRemainder = due.remainder
            gatheredWood = due.units
            stock[chosen]! -= due.units
            forager.wood += due.units
            forager.tripWood += due.units
            forager.secondsToday.gather += left
            forager.secondsWorked.gather += left
          }
        } else seconds.stand = left
        if (filling) reason = 'filling a load'
        else if (seconds.work) reason = food ? 'foraging' : 'gathering'
        else reason = food ? 'seeking food' : 'seeking wood'
      }
    }
  }
  if (atHearth(forager)) forager.tripWood = 0
  const met = meet(state, forager, minute)

  const traded = swap(config, forager, state.foragers, minute)
  const eatenAgain = eatCarried(forager.carried, config.reserveMaxKcal - forager.energyKcal)
  forager.energyKcal += eatenAgain.takenKcal
  forager.carried = eatenAgain.rest

  const owed = forager.costRemainder + minuteCost(config, seconds, !forager.warm && sleeping)
  const due = Math.floor(owed / 3_600)
  forager.costRemainder = owed - due * 3_600
  const spent = Math.min(forager.energyKcal, due)
  forager.energyKcal -= spent
  if (forager.energyKcal <= 0) {
    forager.alive = false
    forager.deathMinute = minute
  }
  const event: ActionEvent = {
    kind: 'action',
    foragerId: forager.id,
    minute,
    action: actionOf(seconds, good, sleeping),
    reason,
    from,
    position: { x: forager.x, y: forager.y },
    workedFor: good,
    forTrade,
    targetId,
    plantId,
    walkSeconds: seconds.walk,
    workSeconds: seconds.work,
    standSeconds: seconds.stand,
    sleepSeconds: seconds.sleep,
    gatheredKcal,
    gatheredWood,
    spoiledKcal: spoiled.spoiledKcal,
    eatenKcal: eaten.takenKcal + eatenAgain.takenKcal,
    spentKcal: spent,
    energyAfterKcal: forager.energyKcal,
    carriedAfterKcal: carriedKcal(forager.carried),
    woodAfter: forager.wood,
    tripWoodAfter: forager.tripWood,
    burnedWood,
    sleptCold,
    groupId: forager.groupId,
    placeId,
    siteId,
    loadWood: load.wood,
    loadBerriesKcal: load.berriesKcal,
    speedCmPerSecond: speed,
  }
  return { event, swaps: traded.swaps, quotes: traded.quotes, met }
}

/**
 * Runs one minute on `state` in place: practice at the start of every day after the first, regrowth at the start of
 * every hour after the first, the minute's turn order, each living forager's turn, and the record. Only the engine's
 * own copies may be passed here.
 */
function advance(state: ValleyState, recordEvents = true) {
  const { config, minute } = state
  const lastPractice: PracticeEvent[] = []
  if (minute > 0 && minute % MINUTES_PER_DAY === 0)
    for (const forager of state.foragers) if (forager.alive) lastPractice.push(practiceDay(config, forager, minute))
  let regrownKcal = 0
  let regrownWood = 0
  if (minute > 0 && minute % 60 === 0) {
    const hour = (minute / 60) % 24
    const berries = hourlyShare(config.bushRegrowthKcalPerDay, hour)
    if (berries) {
      for (let id = 0; id < state.bushKcal.length; id += 1) {
        const before = state.bushKcal[id]!
        const after = Math.min(config.bushCapacityKcal, before + berries)
        state.bushKcal[id] = after
        regrownKcal += after - before
      }
    }
    const deadwood = hourlyShare(config.treeRegrowthWoodPerDay, hour)
    if (deadwood) {
      for (let id = 0; id < state.treeWood.length; id += 1) {
        const before = state.treeWood[id]!
        const after = Math.min(config.treeCapacityWood, before + deadwood)
        state.treeWood[id] = after
        regrownWood += after - before
      }
    }
  }

  const lastEvents: ActionEvent[] = []
  const lastSwaps: SwapEvent[] = []
  const lastQuotes: QuoteEvent[] = []
  const lastDeaths: DeathEvent[] = []
  const lastGroupEvents: GroupEvent[] = []
  // Experiments keep no event history, so they build none.
  const newEvents: ValleyEvent[] = recordEvents ? [...lastPractice] : []
  const today = state.today
  for (const id of turnOrder(config.seed, minute, state.foragers.length)) {
    const forager = state.foragers[id]!
    if (!forager.alive) continue
    const turn = takeTurn(state, forager, minute)
    const { event } = turn
    lastEvents.push(event)
    lastSwaps.push(...turn.swaps)
    lastQuotes.push(...turn.quotes)
    if (recordEvents) newEvents.push(event, ...turn.swaps, ...turn.quotes)
    if (turn.met) {
      lastGroupEvents.push(turn.met)
      if (recordEvents) newEvents.push(turn.met)
      if (turn.met.kind === 'found') today.foundings += 1
      else today.joinings += 1
    }
    const time = today.seconds
    time.walk += event.walkSeconds
    time.sleep += event.sleepSeconds
    time.rest += event.standSeconds
    if (event.workedFor === 'food') time.forage += event.workSeconds
    else time.gather += event.workSeconds
    if (event.workedFor === 'food') today.forageSecondsById[id]! += event.workSeconds
    else today.gatherSecondsById[id]! += event.workSeconds
    today.walkSecondsById[id]! += event.walkSeconds
    if (loadKg(config, event.loadWood, event.loadBerriesKcal) > 0) today.loadedWalkSecondsById[id]! += event.walkSeconds
    today.gatheredWoodById[id]! += event.gatheredWood
    today.gatheredKcal += event.gatheredKcal
    today.gatheredWood += event.gatheredWood
    today.spentKcal += event.spentKcal
    today.spoiledKcal += event.spoiledKcal
    today.burnedWood += event.burnedWood
    if (event.sleepSeconds) today.sleepMinutes += 1
    if (event.sleptCold) today.coldSleepMinutes += 1
    state.totals.gatheredKcal += event.gatheredKcal
    state.totals.gatheredWood += event.gatheredWood
    state.totals.metabolizedKcal += event.spentKcal
    state.totals.spoiledKcal += event.spoiledKcal
    state.totals.burnedWood += event.burnedWood
    if (!forager.alive) {
      const death: DeathEvent = { kind: 'death', foragerId: id, minute, cause: 'starvation' }
      lastDeaths.push(death)
      if (recordEvents) newEvents.push(death)
      today.deaths += 1
      today.alive -= 1
      const dissolved = forager.groupId === null ? null : dissolveIfAlone(state, forager.groupId, minute)
      if (dissolved) {
        lastGroupEvents.push(dissolved)
        if (recordEvents) newEvents.push(dissolved)
        today.dissolutions += 1
      }
    }
  }
  for (const made of lastSwaps) {
    today.swaps += 1
    today.swappedWood += made.wood
    today.swappedKcal += made.kcal
    state.totals.swappedWood += made.wood
    state.totals.swappedKcal += made.kcal
  }
  today.quotes += lastQuotes.length
  if (state.totals.firstSwapMinute === null && lastSwaps.length) state.totals.firstSwapMinute = minute
  state.totals.regrownKcal += regrownKcal
  state.totals.regrownWood += regrownWood
  if (lastPractice.length) {
    today.forageRates = state.foragers.map((forager) => forager.forageRate)
    today.woodRates = state.foragers.map((forager) => forager.woodRate)
  }

  state.lastEvents = lastEvents
  state.lastSwaps = lastSwaps
  state.lastQuotes = lastQuotes
  state.lastPractice = lastPractice
  state.lastDeaths = lastDeaths
  state.lastGroupEvents = lastGroupEvents
  for (const event of newEvents) state.eventDays[state.eventDays.length - 1]!.push(event)

  const next = minute + 1
  if (next % MINUTES_PER_DAY === 0) {
    today.bushStockKcal = sum(state.bushKcal)
    today.treeWood = sum(state.treeWood)
    today.endEnergyKcal = state.foragers.map((forager) => forager.energyKcal)
    today.carriedKcal = state.foragers.reduce((total, forager) => total + carriedKcal(forager.carried), 0)
    Object.assign(today, groupCounts(state))
    today.placesSeenById = state.foragers.map((forager) => forager.placesSeen)
    today.sitesKnownById = state.foragers.map(sitesKnown)
    today.sitesCheckedById = state.foragers.map((forager) => sitesCheckedSince(forager, today.day * MINUTES_PER_DAY))
    state.days.push(today)
    state.today = emptyDay(today.day + 1, state)
    state.eventDays.push([])
    if (state.eventDays.length > EVENT_HISTORY_DAYS) state.eventDays.shift()
  }
  state.minute = next
  return state
}

/** Runs one minute. It never changes `previous`: it copies it and advances the copy. */
export const stepValley = (previous: ValleyState) => advance(cloneValley(previous))

export interface RunOptions {
  /** Called after every minute with the state as it then stands, which the caller must not keep or change. */
  onMinute?: (state: ValleyState) => void
  /** Stop early once every forager is dead. */
  stopWhenAllDead?: boolean
  /**
   * Keep the event history the observer reads, as `stepValley` does; on by default. Experiments read daily summaries
   * and turn it off, which leaves `eventDays` as it was.
   */
  recordEvents?: boolean
}

/**
 * Runs `minutes` minutes. It never changes `state`: it copies it once and advances the copy minute by minute, so the
 * result is the same as `minutes` calls to `stepValley`.
 */
export function runValley(state: ValleyState, minutes: number, options: RunOptions = {}) {
  const current = cloneValley(state)
  for (let step = 0; step < minutes; step += 1) {
    if (options.stopWhenAllDead && !current.foragers.some((forager) => forager.alive)) break
    advance(current, options.recordEvents ?? true)
    options.onMinute?.(current)
  }
  return current
}

export const runValleyDays = (state: ValleyState, days: number) => runValley(state, days * MINUTES_PER_DAY)

/** The action a forager took in the last minute run, or null if it took no turn. */
export const lastEventOf = (state: ValleyState, foragerId: number) =>
  state.lastEvents.find((event) => event.foragerId === foragerId) ?? null
