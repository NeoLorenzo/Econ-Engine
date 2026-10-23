import { reindexPeople } from './perception'
import { measureTask } from './summary'
import { WakeQueue } from './clock'
import { MINUTES_PER_DAY, dayOf } from './calendar'
import { resolveValleyConfig } from './config'
import { fishCapacity } from './fish'
import { newHydration } from './body'
import { drawCraftSkills, drawSkills, generateLayout, LayoutError } from './layout'
import { craftOf, noTaskSeconds, ratesOf, startingLog } from './practice'
import { startingGroups } from './social'
import { siteCount } from './sites'
import { woodMatters } from './trade'
import { hutWhole } from './huts'
import { energyAt, waterAt } from './body'
import { worldWake } from './world'
import { carriedKcal } from './food'
import { personWake, arrival } from './wake'
export { personWake } from './wake'
import type { DaySummary, Forager, ValleyConfig, ValleyEvent, ValleyState } from './types'

/** The observer shows the last 3 days of events; experiments read daily summaries instead. */
export const EVENT_HISTORY_DAYS = 3

const sum = (values: Int32Array, from = 0, to = values.length) => {
  let total = 0
  for (let id = from; id < to; id += 1) total += values[id]!
  return total
}

/** Berries on every bush and nuts on every hazel: bushes come first among food plants. */
const foodStocks = (state: Pick<ValleyState, 'foodStock' | 'layout'>) => ({
  bushStockKcal: sum(state.foodStock, 0, state.layout.bushes.count),
  hazelStockKcal: sum(state.foodStock, state.layout.bushes.count),
})

const zeros = (n: number) => Array.from({ length: n }, () => 0)

/** Groups standing, and living foragers without a group. */
function groupCounts(state: Pick<ValleyState, 'foragers' | 'groups'>) {
  return {
    groupsStanding: state.groups.filter((group) => group.dissolvedMinute === null).length,
    loners: state.foragers.filter((forager) => forager.alive && forager.groupId === null).length,
  }
}

/** Living members with a hut whole at their hearth. */
const hutsWholeNow = (state: Pick<ValleyState, 'foragers' | 'huts' | 'config'>) =>
  state.foragers.filter((forager) => forager.alive && forager.groupId !== null && hutWhole(state, forager)).length

const hutLogsById = (state: Pick<ValleyState, 'foragers' | 'huts'>) =>
  state.foragers.map((forager) => (forager.hutId === null ? 0 : state.huts[forager.hutId]!.logs))

function emptyDay(
  day: number,
  state: Pick<
    ValleyState,
    'foragers' | 'foodStock' | 'layout' | 'fishKcal' | 'woodStock' | 'groups' | 'huts' | 'config'
  >,
): DaySummary {
  const { foragers } = state
  return {
    day,
    wakeUpsById: zeros(foragers.length),
    drinkingMlById: zeros(foragers.length),
    waterLossMlById: zeros(foragers.length),
    maxDeficitMlById: foragers.map((person) => person.waterDeficitMl),
    endDeficitMlById: foragers.map((person) => person.waterDeficitMl),
    thirstySecondsById: zeros(foragers.length),
    seekingWaterSecondsById: zeros(foragers.length),
    drinkingSecondsById: zeros(foragers.length),
    dehydrationDeaths: 0,
    starvationDeaths: 0,
    fishCatchByBody: {},
    seconds: { sleep: 0, rest: 0, walk: 0, forage: 0, gather: 0, cut: 0, make: 0 },
    gatheredKcal: 0,
    spentKcal: 0,
    alive: foragers.filter((forager) => forager.alive).length,
    deaths: 0,
    ...foodStocks(state),
    fishKcal: state.fishKcal,
    gatheredBerriesKcal: 0,
    gatheredNutsKcal: 0,
    gatheredFishKcal: 0,
    woodStock: sum(state.woodStock),
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
    climbedCmById: zeros(foragers.length),
    walkKcalById: zeros(foragers.length),
    ...groupCounts(state),
    foundings: 0,
    joinings: 0,
    dissolutions: 0,
    placesSeenById: foragers.map((forager) => forager.placesSeen),
    loadedWalkSecondsById: zeros(foragers.length),
    sitesKnownById: foragers.map((p) => [...p.knownPlaces].filter((m) => m >= 0).length),
    sitesCheckedById: zeros(foragers.length),
    fireGivenById: zeros(foragers.length),
    campfireBurnedWood: 0,
    fireLitHours: 0,
    fireDarkHours: 0,
    logsCut: 0,
    axesMade: 0,
    axesMadeForSale: 0,
    axesSold: 0,
    axesWornOut: 0,
    memberMinutes: 0,
    hutWholeMinutes: 0,
    hutSleepMinutes: 0,
    hutsWhole: hutsWholeNow(state),
    cutSecondsById: zeros(foragers.length),
    makeSecondsById: zeros(foragers.length),
    logsCutById: zeros(foragers.length),
    axesMadeById: zeros(foragers.length),
    axesSoldById: zeros(foragers.length),
    axesBoughtById: zeros(foragers.length),
    craftById: foragers.map((forager) => forager.craft),
    hutLogsById: hutLogsById(state),
  }
}

/** Creates the valley at minute 0. Throws on a configuration that breaks a rule or whose layout cannot be drawn. */
export function createValley(overrides: Partial<ValleyConfig> = {}): ValleyState {
  const config = resolveValleyConfig(overrides)
  let layout
  try {
    layout = generateLayout(config)
  } catch (error) {
    if (error instanceof LayoutError)
      throw new Error(`Invalid valley configuration: ${error.message}`, { cause: error })
    throw error
  }
  const foodStock = new Int32Array(layout.places.count)
  const woodStock = new Int32Array(layout.places.count)
  const treeLogs = new Int32Array(layout.places.count)
  const treeFelledMinute = new Int32Array(layout.places.count).fill(-1)
  const stoneStock = new Int32Array(layout.places.count)
  for (let id = 0; id < layout.places.count; id += 1) {
    const kind = layout.places.kind[id]
    if (kind === 0) {
      foodStock[id] = config.berryThicketCapacityKcal
      woodStock[id] = config.berryThicketWoodKg
    }
    if (kind === 1) foodStock[id] = config.hazelThicketCapacityKcal
    if (kind === 2) {
      woodStock[id] = config.standWoodKg
      treeLogs[id] = config.standLogs
    }
    if (kind === 3) stoneStock[id] = config.outcropStones
  }
  const fish = layout.terrain.water.bodies.map((body) => {
    const capacity = fishCapacity(body.areaM2, config.fishMinAreaM2, config.fishKgPerHectare, config.fishKcalPerKg)
    return { bodyId: body.id, capacity, stock: capacity, remainder: 0, grown: 0, caught: 0 }
  })
  const fishKcal = fish.reduce((total, body) => total + body.stock, 0)
  const skills = drawSkills(config)
  const craftSkills = drawCraftSkills(config)
  const places = 0
  const unknown = (stocks: Int32Array) => ({
    stock: new Int32Array(stocks.length),
    seen: new Int32Array(stocks.length).fill(-1),
  })
  const foragers: Forager[] = layout.hearths.map((hearth, id) => {
    const practiceLog = startingLog(config)
    const born = skills[id]!
    return {
      ...newHydration(config),
      task: null,
      knownPlaces: new Int32Array(layout.places.count).fill(-1),
      placeCheckedMinute: new Int32Array(layout.places.count).fill(-1),
      seenMinute: new Int32Array(config.bandSize).fill(-1),
      placeStock: new Int32Array(layout.places.count).fill(-1),
      placeWood: new Int32Array(layout.places.count).fill(-1),
      placeLogs: new Int32Array(layout.places.count).fill(-1),
      metMinute: new Int32Array(config.bandSize).fill(-1),
      metPosition: new Map(),
      arrivalFrom: new Int32Array(config.bandSize).fill(-1),
      knowledge: { nodes: new Uint8Array(layout.lattice.dry.length), revision: 0 },
      routeCache: new Map(),
      energyTimeRemainder: 0,
      waterTimeRemainder: 0,
      lastWakeMinute: 0,
      energyRemainder: 0,
      waterObservations: [],
      groundKnowledge: {
        shore: layout.terrain.water.shore,
        cells: layout.terrain.cells,
        cellCm: layout.terrain.cellCm,
        observed: new Uint8Array(0),
        heights: new Int32Array(0),
        revision: 0,
      },
      knownBanks: new Map(),
      fishMemory: new Map(),
      route: [],
      routeRevision: 0,
      deathSecond: null,
      deathCauses: [],
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
      targetFoodId: null,
      targetWoodId: null,
      // A forager has seen nothing yet, and sees what is around it in its first turn.
      foodMemory: unknown(foodStock),
      woodMemory: unknown(woodStock),
      logMemory: unknown(treeLogs),
      stoneMemory: unknown(stoneStock),
      groupId: null,
      joinedMinute: null,
      placeSeen: new Int32Array(places).fill(-1),
      placesSeen: 0,
      knownFlags: [],
      exploreTarget: null,
      siteKnown: new Uint8Array(siteCount(config)),
      siteChecked: new Int32Array(siteCount(config)).fill(-1),
      ...born,
      ...ratesOf(config, born.foragingSkill, born.woodSkill, practiceLog),
      craftSkill: craftSkills[id]!,
      craft: craftOf(config, craftSkills[id]!, practiceLog),
      log: 0,
      stone: 0,
      hutId: null,
      axe: null,
      spareAxe: null,
      making: null,
      chopRemainder: 0,
      promised: false,
      heardAsk: null,
      axeTotals: {
        madeOwn: 0,
        madeForSale: 0,
        sold: 0,
        bought: 0,
        wornOut: 0,
        kcalReceived: 0,
        kcalPaid: 0,
        logsCut: 0,
      },
      hutSleepMinutes: 0,
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
      fireGiven: 0,
      warmByFireMinutes: 0,
      swapTotals: { woodSold: 0, woodBought: 0, kcalReceived: 0, kcalPaid: 0 },
      farPlace: -1,
      farMinute: -1,
      climbedCm: 0,
    }
  })
  const groups = startingGroups(config, layout, foragers)
  const queue = new WakeQueue()
  for (const person of foragers) queue.schedule({ minute: 0, phase: 1, id: person.id, kind: 'end' })
  queue.schedule({ minute: 60, phase: 0, id: 0, kind: 'world' })
  const partial = { foragers, foodStock, layout, fishKcal, woodStock, groups, huts: [], config }
  return {
    fish,
    queue,
    routes: [],
    peopleByChunk: Array.from({ length: layout.lattice.chunkCells ** 2 }, (_, chunk) =>
      Int32Array.from(
        foragers
          .filter(
            (p) =>
              Math.floor(p.y / config.chunkCm) * layout.lattice.chunkCells + Math.floor(p.x / config.chunkCm) === chunk,
          )
          .map((p) => p.id),
      ),
    ),
    lastInterval: [],
    waterWithdrawals: new Map(),
    config,
    layout,
    minute: 0,
    foodStock,
    woodStock,
    fishKcal,
    treeLogs,
    treeFelledMinute,
    logStock: treeLogs,
    felledMinute: treeFelledMinute,
    logRegrowth: new Map(),
    stoneStock,
    foragers,
    groups,
    huts: [],
    totals: {
      wakeUps: 0,
      initialKcal: sum(foodStock) + fishKcal + foragers.reduce((total, forager) => total + forager.energyKcal, 0),
      regrownKcal: 0,
      fishGrownKcal: 0,
      metabolizedKcal: 0,
      gatheredKcal: 0,
      spoiledKcal: 0,
      initialWood: sum(woodStock),
      regrownWood: 0,
      gatheredWood: 0,
      burnedWood: 0,
      swappedWood: 0,
      swappedKcal: 0,
      firstSwapMinute: null,
      fellenWood: 0,
      initialLogs: sum(treeLogs),
      regrownLogs: 0,
      logsCut: 0,
      rottedLogs: 0,
      initialStones: sum(stoneStock),
      stonesWorked: 0,
      axeWood: 0,
      axesMade: 0,
      axesWornOut: 0,
      axeSales: 0,
      axeSalesKcal: 0,
    },
    lastEvents: [],
    lastWaterEvents: [],
    lastSwaps: [],
    lastQuotes: [],
    lastPractice: [],
    lastDeaths: [],
    lastGroupEvents: [],
    lastFires: [],
    lastFeeds: [],
    lastAxeEvents: [],
    lastHutEvents: [],
    eventDays: [[]],
    days: [],
    today: emptyDay(0, partial),
  }
}

const cloneForager = (forager: Forager): Forager => {
  const groundKnowledge = {
    ...forager.groundKnowledge,
    observed: forager.groundKnowledge.observed.slice(),
    heights: forager.groundKnowledge.heights.slice(),
  }
  return {
    ...forager,
    task: forager.task
      ? { ...forager.task, rateChanges: forager.task.rateChanges?.map((change) => ({ ...change })) }
      : null,
    knownPlaces: forager.knownPlaces.slice(),
    placeCheckedMinute: forager.placeCheckedMinute.slice(),
    seenMinute: forager.seenMinute.slice(),
    placeStock: forager.placeStock.slice(),
    placeWood: forager.placeWood.slice(),
    placeLogs: forager.placeLogs.slice(),
    metMinute: forager.metMinute.slice(),
    metPosition: new Map(forager.metPosition),
    arrivalFrom: forager.arrivalFrom.slice(),
    knowledge: {
      ...forager.knowledge,
      nodes: forager.knowledge.nodes.slice(),
      fullyKnown: forager.knowledge.fullyKnown?.slice(),
      banksKnown: forager.knowledge.banksKnown?.slice(),
      views: forager.knowledge.views ? new Set(forager.knowledge.views) : undefined,
    },
    routeCache: new Map(forager.routeCache),
    waterObservations: [...forager.waterObservations],
    groundKnowledge,
    knownBanks: new Map(forager.knownBanks),
    fishMemory: new Map(forager.fishMemory),
    route: [...forager.route],
    deathCauses: [...forager.deathCauses],
    carried: [...forager.carried],
    foodMemory: { stock: forager.foodMemory.stock.slice(), seen: forager.foodMemory.seen.slice() },
    woodMemory: { stock: forager.woodMemory.stock.slice(), seen: forager.woodMemory.seen.slice() },
    logMemory: { stock: forager.logMemory.stock.slice(), seen: forager.logMemory.seen.slice() },
    stoneMemory: { stock: forager.stoneMemory.stock.slice(), seen: forager.stoneMemory.seen.slice() },
    practiceLog: {
      forage: [...forager.practiceLog.forage],
      gather: [...forager.practiceLog.gather],
      make: [...forager.practiceLog.make],
    },
    axeTotals: { ...forager.axeTotals },
    secondsToday: { ...forager.secondsToday },
    loggedSeconds: { ...forager.loggedSeconds },
    secondsWorked: { ...forager.secondsWorked },
    swapTotals: { ...forager.swapTotals },
    placeSeen: forager.placeSeen.slice(),
    knownFlags: [...forager.knownFlags],
    siteKnown: forager.siteKnown.slice(),
    siteChecked: forager.siteChecked.slice(),
  }
}

const cloneDay = (day: DaySummary): DaySummary => ({
  ...day,
  wakeUpsById: [...day.wakeUpsById],
  drinkingMlById: [...day.drinkingMlById],
  waterLossMlById: [...day.waterLossMlById],
  maxDeficitMlById: [...day.maxDeficitMlById],
  endDeficitMlById: [...day.endDeficitMlById],
  thirstySecondsById: [...day.thirstySecondsById],
  seekingWaterSecondsById: [...day.seekingWaterSecondsById],
  drinkingSecondsById: [...day.drinkingSecondsById],
  fishCatchByBody: { ...day.fishCatchByBody },
  seconds: { ...day.seconds },
  endEnergyKcal: [...day.endEnergyKcal],
  forageRates: [...day.forageRates],
  woodRates: [...day.woodRates],
  forageSecondsById: [...day.forageSecondsById],
  gatherSecondsById: [...day.gatherSecondsById],
  walkSecondsById: [...day.walkSecondsById],
  gatheredWoodById: [...day.gatheredWoodById],
  climbedCmById: [...day.climbedCmById],
  walkKcalById: [...day.walkKcalById],
  placesSeenById: [...day.placesSeenById],
  loadedWalkSecondsById: [...day.loadedWalkSecondsById],
  sitesKnownById: [...day.sitesKnownById],
  sitesCheckedById: [...day.sitesCheckedById],
  fireGivenById: [...day.fireGivenById],
  cutSecondsById: [...day.cutSecondsById],
  makeSecondsById: [...day.makeSecondsById],
  logsCutById: [...day.logsCutById],
  axesMadeById: [...day.axesMadeById],
  axesSoldById: [...day.axesSoldById],
  axesBoughtById: [...day.axesBoughtById],
  craftById: [...day.craftById],
  hutLogsById: [...day.hutLogsById],
})

/** A copy that shares nothing mutable with `state`. The layout and finished days never change, so they are shared. */
export function cloneValley(state: ValleyState): ValleyState {
  return {
    ...state,
    queue: state.queue.clone(),
    routes: [...state.routes],
    peopleByChunk: [...state.peopleByChunk],
    lastInterval: [...state.lastInterval],
    fish: state.fish.map((stock) => ({ ...stock })),
    waterWithdrawals: new Map(state.waterWithdrawals),
    foodStock: state.foodStock.slice(),
    woodStock: state.woodStock.slice(),
    treeLogs: state.treeLogs.slice(),
    treeFelledMinute: state.treeFelledMinute.slice(),
    logStock: state.logStock.slice(),
    felledMinute: state.felledMinute.slice(),
    logRegrowth: new Map([...state.logRegrowth].map(([id, minutes]) => [id, [...minutes]])),
    stoneStock: state.stoneStock.slice(),
    foragers: state.foragers.map(cloneForager),
    groups: state.groups.map((group) => ({ ...group })),
    huts: [...state.huts],
    totals: { ...state.totals },
    days: [...state.days],
    eventDays: state.eventDays.map((day, index) => (index === state.eventDays.length - 1 ? [...day] : day)),
    today: cloneDay(state.today),
  }
}

export { eatCarried } from './food'
function record(state: ValleyState, events: ValleyEvent[]) {
  state.lastInterval.push(...events)
  state.eventDays[state.eventDays.length - 1]!.push(...events)
}
function finishDay(state: ValleyState, minute: number) {
  for (const person of state.foragers) if (person.alive) measureTask(state, person, minute)
  const day = state.today
  day.endEnergyKcal = state.foragers.map((p) =>
    p.task ? Math.max(0, energyAt(p.task, minute, state.routes).kcal) : p.energyKcal,
  )
  day.endDeficitMlById = state.foragers.map((p) =>
    p.task ? waterAt(p.task, minute, state.routes).ml : p.waterDeficitMl,
  )
  day.alive = state.foragers.filter((p) => p.alive).length
  day.carriedKcal = state.foragers.reduce((total, p) => total + carriedKcal(p.carried), 0)
  Object.assign(day, foodStocks(state), groupCounts(state))
  day.fishKcal = state.fishKcal
  day.woodStock = sum(state.woodStock)
  day.hutsWhole = hutsWholeNow(state)
  day.hutLogsById = hutLogsById(state)
  day.forageRates = state.foragers.map((p) => p.forageRate)
  day.woodRates = state.foragers.map((p) => p.woodRate)
  day.craftById = state.foragers.map((p) => p.craft)
  day.sitesKnownById = state.foragers.map((p) => [...p.knownPlaces].filter((m) => m >= 0).length)
  day.placesSeenById = [...day.sitesKnownById]
  state.days.push(day)
  state.today = emptyDay(dayOf(minute), state)
  state.eventDays.push([])
  if (state.eventDays.length > EVENT_HISTORY_DAYS) state.eventDays.shift()
}
export function stepValley(previous: ValleyState, toMinute = previous.minute + 1): ValleyState {
  if (!Number.isSafeInteger(toMinute) || toMinute < previous.minute)
    throw new Error('Target minute must be a safe integer at or after the current minute')
  const state = cloneValley(previous)
  state.lastInterval = []
  if (toMinute === previous.minute) return state
  while (state.queue.peek() && state.queue.peek()!.minute <= toMinute) {
    const entry = state.queue.pop()!
    if (entry.minute < previous.minute) throw new Error('A wake-up cannot be in the past')
    state.minute = entry.minute
    if (entry.phase === 0) {
      if (entry.minute % MINUTES_PER_DAY === 0) finishDay(state, entry.minute)
      record(state, worldWake(state, entry.minute))
      state.queue.schedule({ minute: entry.minute + 60, phase: 0, id: 0, kind: 'world' })
    } else if (entry.kind !== 'arrival' || arrival(state, entry))
      record(state, personWake(state, entry.id, entry.minute, entry.kind))
  }
  state.minute = toMinute
  reindexPeople(state, toMinute)
  return state
}
export interface RunOptions {
  onMinute?: (state: ValleyState) => void
  stopAfterMinute?: () => boolean
  stopWhenAllDead?: boolean
  recordEvents?: boolean
}
export function runValley(state: ValleyState, minutes: number, options: RunOptions = {}) {
  const result = stepValley(state, state.minute + minutes)
  options.onMinute?.(result)
  return result
}
export const runValleyDays = (state: ValleyState, days: number) => runValley(state, days * MINUTES_PER_DAY)
export const lastEventOf = (state: ValleyState, id: number) =>
  state.lastInterval.filter((e) => 'foragerId' in e && e.foragerId === id).at(-1) ?? null
