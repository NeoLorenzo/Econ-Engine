import { beginAxe, cutAt, exchangeAxes, planHut, workAxe } from './axes'
import { carriedKcal, foodOfSource, fullRateOf, rateAtStock, spoil, worthWorking } from './food'
import { resolveValleyConfig } from './config'
import { fishCapacity, fishGrowth, fishRate } from './fish'
import { newHydration, updateThirst, waterSecond, waterThresholds } from './hydration'
import { cloneGroundKnowledge, knownRoute } from './routes'
import { frontier, observeGround, nearestKnownBanks } from './waterKnowledge'
import { observeAround } from './sight'
import { cellOf, gradeOf, heightAt, speedOnGrade, terrainPercentOf, walkCost } from './terrain'
import {
  MINUTES_PER_DAY,
  daylightSecondsLeft,
  estimateKnownWalk,
  reachableAndBack,
  atHearth,
  carryingFullLoad,
  choosePlant,
  chooseWork,
  fillingLoad,
  foodGoal,
  idleReason,
  isDaylight,
  loadKg,
  loadOf,
  minuteOfWork,
  mustGoHome,
  nextHungry,
  observe,
  plantsInViewOf,
  sourcePoint,
  speedForLoad,
} from './forager'
import { distance, distanceSq, distanceUp, stepTowards, walkSeconds } from './geometry'
import { burnFires, feedFire, sleepsByGroupFire } from './fire'
import { hutWhole, layLog, leaveHutIfMoved, regrowTrees, wantsLogs, weatherHuts } from './huts'
import { drawCraftSkills, drawSkills, generateLayout, layoutError, turnOrder } from './layout'
import { craftOf, noTaskSeconds, practiceDay, ratesOf, startingLog } from './practice'
import { choosePlace, dissolveIfAlone, idleGoal, meet, placeCentre, placeCount, startingGroups } from './social'
import { chooseSite, siteCentre, siteCount, sitesCheckedSince, sitesKnown } from './sites'
import { nextShortOfWood, swap, woodMatters } from './trade'
import { coldMatters, regrowthOf, tendFire, warmthOf, workSeconds, type MinuteSeconds, sleepCostOf } from './work'
import type {
  ActionEvent,
  ActionReason,
  AxeEvent,
  DaySummary,
  DeathEvent,
  FeedEvent,
  FireEvent,
  FoodKind,
  FoodLot,
  Forager,
  ForagerAction,
  Good,
  GroupEvent,
  HutEvent,
  HutTask,
  PracticeEvent,
  QuoteEvent,
  SwapEvent,
  ValleyConfig,
  ValleyEvent,
  ValleyState,
  Warmth,
  MovementSegment,
  BodySecond,
  BankMemory,
  WaterEvent,
} from './types'

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
    sitesKnownById: foragers.map(sitesKnown),
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
  const unplaceable = layoutError(config)
  if (unplaceable) throw new Error(`Invalid valley configuration: ${unplaceable}`)
  const layout = generateLayout(config)
  // Food plants are the bushes, holding berries, then the hazels, holding nuts.
  const foodStock = new Int32Array(layout.foodPlants.count)
    .fill(config.initialBushKcal, 0, layout.bushes.count)
    .fill(config.initialHazelKcal, layout.bushes.count)
  const fish = layout.terrain.water.bodies.map((body) => {
    const capacity = fishCapacity(body.areaM2, config.fishMinAreaM2, config.fishKgPerHectare, config.fishKcalPerKg)
    return { bodyId: body.id, capacity, stock: capacity, remainder: 0, grown: 0, caught: 0 }
  })
  const fishKcal = fish.reduce((total, body) => total + body.stock, 0)
  // Wood plants are the trees, holding branches, then the bushes, holding sticks.
  const woodStock = new Int32Array(layout.woodPlants.count)
    .fill(config.initialTreeWood, 0, layout.trees.count)
    .fill(config.initialBushWood, layout.trees.count)
  const treeLogs = new Int32Array(layout.trees.count).fill(config.logsPerTree)
  const treeFelledMinute = new Int32Array(layout.trees.count).fill(-1)
  const stoneStock = new Int32Array(layout.stones.count).fill(config.stonesPerSpot)
  const skills = drawSkills(config)
  const craftSkills = drawCraftSkills(config)
  const places = placeCount(config)
  const unknown = (stocks: Int32Array) => ({
    stock: new Int32Array(stocks.length),
    seen: new Int32Array(stocks.length).fill(-1),
  })
  const foragers: Forager[] = layout.hearths.map((hearth, id) => {
    const practiceLog = startingLog(config)
    const born = skills[id]!
    return {
      ...newHydration(config),
      waterObservations: [],
      groundKnowledge: {
        cells: layout.terrain.cells,
        cellCm: layout.terrain.cellCm,
        observed: new Uint8Array(layout.terrain.cells ** 2),
        heights: new Int32Array(layout.terrain.cells ** 2),
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
  for (const person of foragers) observeGround(config, layout, person, 0, person, config.perceptionRadiusCm, () => true)
  const groups = startingGroups(config, layout, foragers)
  const partial = { foragers, foodStock, layout, fishKcal, woodStock, groups, huts: [], config }
  return {
    fish,
    waterWithdrawals: new Map(),
    config,
    layout,
    minute: 0,
    foodStock,
    woodStock,
    fishKcal,
    treeLogs,
    treeFelledMinute,
    stoneStock,
    foragers,
    groups,
    huts: [],
    totals: {
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

const cloneForager = (forager: Forager): Forager => ({
  ...forager,
  waterObservations: [...forager.waterObservations],
  groundKnowledge: cloneGroundKnowledge(forager.groundKnowledge),
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
})

const cloneDay = (day: DaySummary): DaySummary => ({
  ...day,
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
    fish: state.fish.map((stock) => ({ ...stock })),
    waterWithdrawals: new Map(state.waterWithdrawals),
    foodStock: state.foodStock.slice(),
    woodStock: state.woodStock.slice(),
    treeLogs: state.treeLogs.slice(),
    treeFelledMinute: state.treeFelledMinute.slice(),
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

interface TurnResult {
  event: ActionEvent
  swaps: SwapEvent[]
  quotes: QuoteEvent[]
  met: GroupEvent | null
  fed: FeedEvent | null
  axeEvents: AxeEvent[]
  hutEvents: HutEvent[]
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
    rest[0] = { food: lot.food, kcal: lot.kcal - (room - takenKcal), harvestTick: lot.harvestTick }
    return { rest, takenKcal: room }
  }
  return { rest: index ? lots.slice(index) : lots, takenKcal }
}

const actionOf = (
  seconds: MinuteSeconds,
  good: Good | null,
  task: HutTask | null,
  sleeping: boolean,
): ForagerAction => {
  if (seconds.work && task) return task === 'cut' ? 'cut' : 'make'
  if (seconds.work) return good === 'food' ? 'forage' : 'gather'
  if (seconds.walk) return 'walk'
  return sleeping ? 'sleep' : 'rest'
}

/** One forager's minute, changing the working copies in `state` in place. */
function takeTurn(state: ValleyState, forager: Forager, minute: number): TurnResult {
  const { config, layout } = state
  forager.waterObservations = []
  const waterDeficitBeforeMl = forager.waterDeficitMl
  const spoiled = spoil(config, forager.carried, minute)
  const eaten = eatCarried(spoiled.lots, config.reserveMaxKcal - forager.energyKcal)
  forager.energyKcal += eaten.takenKcal
  forager.carried = eaten.rest
  observe(
    forager.foodMemory,
    plantsInViewOf(config, forager.foodMemory, layout.foodIndex, layout.foodPlants, forager.x, forager.y),
    state.foodStock,
    minute,
  )
  observe(
    forager.woodMemory,
    plantsInViewOf(config, forager.woodMemory, layout.woodIndex, layout.woodPlants, forager.x, forager.y),
    state.woodStock,
    minute,
  )
  observeAround(state, forager, minute)
  forager.hungry = nextHungry(config, forager.energyKcal, forager.hungry)
  forager.shortOfWood = nextShortOfWood(config, forager.wood, forager.shortOfWood)
  const hutEvents: HutEvent[] = []
  const axeEvents: AxeEvent[] = []
  const abandoned = leaveHutIfMoved(state, forager, minute)
  if (abandoned) hutEvents.push(abandoned)
  // What it carries as it sets out decides how fast it walks this minute.
  const load = loadOf(forager)
  const kg = loadKg(config, load)
  const speed = speedForLoad(config, kg)
  // Where it walks this minute sets its grade, and the grade its speed; the ground it sets out from, the walk's cost.
  const { terrain } = layout
  const terrainPercent = terrainPercentOf(config, layout.ground[cellOf(terrain, forager.x, forager.y)]!)
  let grade = 0
  let walkingSpeed = speed
  let walkTarget: { x: number; y: number } | null = null

  const from = { x: forager.x, y: forager.y }
  const seconds: MinuteSeconds = { walk: 0, work: 0, stand: 0, sleep: 0 }
  let reason: ActionReason
  let good: Good | null = null
  let forTrade = false
  let targetId: number | null = null
  let plantId: number | null = null
  let food: FoodKind | null = null
  let sourceStockBefore = 0
  let placeId: number | null = null
  let siteId: number | null = null
  let gatheredKcal = 0
  let gatheredWood = 0
  let burnedWood = 0
  let sleeping = false
  let sleptCold = false
  let warmth: Warmth | null = null
  let fireGroupId: number | null = null
  let task: HutTask | null = null
  let treeId: number | null = null
  let stoneId: number | null = null
  let cutLog = false
  let felled = false
  let tookStone = false
  let inHut = false
  const segments: MovementSegment[] = []
  const bodySeconds: BodySecond[] = []
  let spent = 0
  let waterLostMl = 0
  let waterDrunkMl = 0
  let drinkBank: BankMemory | null = null
  let drinkingSeconds = 0
  let fishBodyId: number | null = null
  let fishBankId: number | null = null
  let fishExpectedRate = 0
  let routeFailed = false
  const chargeSeconds = (requested: number, rate: number, produce: () => void = () => {}, drinking = false) => {
    let completed = 0
    while (completed < requested && bodySeconds.length < 60 && forager.alive) {
      produce()
      const water = waterSecond(config, forager, rate, drinking)
      const owed = forager.costRemainder + rate
      const paid = Math.min(forager.energyKcal, Math.floor(owed / 3_600))
      forager.costRemainder = owed % 3_600
      forager.energyKcal -= paid
      spent += paid
      waterLostMl += water.loss
      waterDrunkMl += water.drink
      bodySeconds.push({
        rate,
        spent: paid,
        drink: water.drink,
        loss: water.loss,
        deficitMl: forager.waterDeficitMl,
        thirsty: forager.thirsty,
      })
      completed += 1
      if (water.fatal || forager.energyKcal <= 0) {
        forager.alive = false
        forager.deathMinute = minute
        forager.deathSecond = bodySeconds.length - 1
        forager.deathCauses = [
          ...(forager.energyKcal <= 0 ? ['starvation' as const] : []),
          ...(water.fatal ? ['dehydration' as const] : []),
        ]
      }
    }
    return completed
  }

  /**
   * Walks towards a point for up to the whole minute, at its speed on the grade ahead: the rise to where a minute at
   * its speed on the flat would take it, or to the point if nearer. Returns the seconds left after arriving.
   */
  const walkTo = (x: number, y: number) => {
    walkTarget = { x, y }
    const completeRoute = knownRoute(forager.groundKnowledge, forager, walkTarget, forager.hearth)
    routeFailed = completeRoute === null
    const route = completeRoute ?? frontier(forager, walkTarget)
    forager.route = route ? route.map((point) => ({ ...point })) : []
    forager.routeRevision = forager.groundKnowledge.revision
    if (!route) {
      reason = 'no known route'
      return 60
    }
    for (const [routeIndex, target] of route.entries()) {
      if (!forager.alive || bodySeconds.length === 60) break
      const origin = { x: forager.x, y: forager.y }
      const run = distance(origin.x, origin.y, target.x, target.y)
      if (!run) {
        forager.route = route.slice(routeIndex + 1)
        continue
      }
      const ahead = stepTowards(origin, target, (60 - bodySeconds.length) * speed)
      grade = gradeOf(
        heightAt(terrain, ahead.x, ahead.y) - heightAt(terrain, origin.x, origin.y),
        distance(origin.x, origin.y, ahead.x, ahead.y),
      )
      walkingSpeed = speedOnGrade(speed, grade)
      const ground = terrainPercentOf(config, layout.ground[cellOf(terrain, origin.x, origin.y)]!)
      const rate = walkCost(config, kg, walkingSpeed, grade, ground)
      const needed = walkSeconds(run, walkingSpeed)
      let walked = 0
      const completed = chargeSeconds(needed, rate, () => {
        walked += 1
        const next = stepTowards(origin, target, walked * walkingSpeed)
        forager.x = next.x
        forager.y = next.y
      })
      seconds.walk += completed
      segments.push({
        target,
        from: origin,
        to: { x: forager.x, y: forager.y },
        seconds: completed,
        grade,
        speed: walkingSpeed,
        terrainPercent: ground,
        rate,
      })
      forager.route = route.slice(routeIndex + (forager.x === target.x && forager.y === target.y ? 1 : 0))
    }
    return 60 - seconds.walk
  }

  /** Walks to the point `reachCm` short of a plant or stone spot on the straight line from here, if not within reach. */
  const approach = (px: number, py: number) => {
    if (distanceSq(forager.x, forager.y, px, py) <= config.reachCm ** 2) return 60
    // Dividing by the distance rounded up keeps the point within reach.
    const d = distanceUp(forager.x, forager.y, px, py)
    return walkTo(
      px - Math.trunc(((px - forager.x) * config.reachCm) / d),
      py - Math.trunc(((py - forager.y) * config.reachCm) / d),
    )
  }
  const withinReach = (px: number, py: number) => distanceSq(forager.x, forager.y, px, py) <= config.reachCm ** 2

  updateThirst(config, forager)
  const urgent = forager.waterDeficitMl >= waterThresholds(config).urgent
  if (urgent || (forager.thirsty && isDaylight(config, minute) && !mustGoHome(config, forager, minute))) {
    reason = 'seeking water'
    let bestDistance = Infinity
    const drinkingTime = Math.ceil((forager.waterDeficitMl - config.drinkStopMl) / config.drinkMlPerSecond)
    for (const bank of nearestKnownBanks(
      forager,
      () =>
        Math.min(bestDistance, urgent ? Infinity : Math.max(0, daylightSecondsLeft(config, minute) - drinkingTime)) *
        speed,
    )) {
      const length = estimateKnownWalk(config, forager, forager, bank, speed)
      if (!Number.isFinite(length)) continue
      if (
        !urgent &&
        length +
          Math.ceil((forager.waterDeficitMl - config.drinkStopMl) / config.drinkMlPerSecond) +
          estimateKnownWalk(config, forager, bank, forager.hearth, speed) >
          daylightSecondsLeft(config, minute)
      )
        continue
      if (
        length < bestDistance ||
        (length === bestDistance &&
          (bank.bodyId < drinkBank!.bodyId || (bank.bodyId === drinkBank!.bodyId && bank.id < drinkBank!.id)))
      ) {
        drinkBank = bank
        bestDistance = length
      }
    }
    if (drinkBank) {
      walkTo(drinkBank.x, drinkBank.y)
      if (forager.alive && forager.x === drinkBank.x && forager.y === drinkBank.y) {
        reason = 'drinking'
        while (bodySeconds.length < 60 && forager.alive && forager.waterDeficitMl > config.drinkStopMl) {
          drinkingSeconds += chargeSeconds(1, config.restKcalPerHour, () => {}, true)
        }
        if (waterDrunkMl > 0) {
          const withdrawn = state.waterWithdrawals.get(drinkBank.bodyId) ?? 0
          state.waterWithdrawals.set(drinkBank.bodyId, withdrawn + waterDrunkMl)
        }
      }
    } else {
      const route = frontier(
        forager,
        forager,
        (point) => urgent || reachableAndBack(config, forager, point.x, point.y, minute, speed),
      )
      if (route?.length) {
        const target = route[route.length - 1]!
        walkTo(target.x, target.y)
      } else reason = 'no known route'
    }
    seconds.stand = 60 - seconds.walk
  } else if (mustGoHome(config, forager, minute)) {
    forager.trip = null
    reason = 'going home'
    seconds.stand = walkTo(forager.hearth.x, forager.hearth.y)
  } else if (!isDaylight(config, minute)) {
    forager.trip = null
    reason = 'night'
    sleeping = true
    inHut = atHearth(forager) && hutWhole(state, forager)
    if (inHut) forager.hutSleepMinutes += 1
    if (sleepsByGroupFire(forager)) {
      // A member sleeps in the ring round its group's fire, warmed by it if it is lit this hour, and burns no wood of
      // its own.
      fireGroupId = forager.groupId
      const lit = state.groups[fireGroupId!]!.fireLit
      if (lit) forager.warmByFireMinutes += 1
      forager.warm = lit
    } else burnedWood = tendFire(config, forager, minute)
    // A fire warms more than a hut, and both together most.
    warmth = warmthOf(forager.warm, inHut)
    sleptCold = warmth === 'cold' && coldMatters(config)
    seconds.sleep = 60
  } else if (forager.log) {
    // Rule 3: it takes a log home before anything else.
    forager.trip = null
    reason = 'taking a log home'
    seconds.stand = walkTo(forager.hearth.x, forager.hearth.y)
  } else if (!forager.hungry && carryingFullLoad(config, forager)) {
    // Rule 4: not hungry, it takes a full load home and sets it down before anything else.
    forager.trip = null
    reason = 'taking a load home'
    seconds.stand = walkTo(forager.hearth.x, forager.hearth.y)
  } else {
    const filling = !forager.hungry && fillingLoad(config, forager)
    let work = chooseWork(config, forager, minute)
    const member = forager.groupId !== null
    // Rule 8: a member whose hut needs logs and who holds no axe takes up its spare.
    if (work === null && member && wantsLogs(state, forager) && !forager.axe && forager.spareAxe) {
      forager.axe = forager.spareAxe
      forager.spareAxe = null
    }
    // Rules 7 to 10, the hut, come after a member's needs and before exploring.
    const plan = work === null && member ? planHut(state, forager, minute, speed) : null
    const buying = plan?.kind === 'buy food'
    if (buying) work = { good: 'food', forTrade: true, trip: null }
    const goal = work === null && plan === null ? idleGoal(state, forager, minute) : null
    if (plan && !buying) {
      forager.trip = null
      if (plan.kind === 'make') {
        task = 'make'
        const left = walkTo(forager.hearth.x, forager.hearth.y)
        reason = 'going home to make an axe'
        if (left > 0 && atHearth(forager)) {
          if (!forager.making && forager.stone >= 1 && forager.wood >= config.axeWood) beginAxe(state, forager)
          if (forager.making) {
            while (forager.making && forager.alive && bodySeconds.length < 60) {
              seconds.work += chargeSeconds(1, config.makeKcalPerHour, () => {
                const done = workAxe(state, forager, 1, minute)
                if (done.made) axeEvents.push(done.made)
              })
            }
            seconds.stand = left - seconds.work
            reason = 'making an axe'
          } else seconds.stand = left
        } else seconds.stand = left
      } else if (plan.kind === 'cut') {
        task = 'cut'
        treeId = plan.treeId
        const tx = layout.trees.x[treeId]!
        const ty = layout.trees.y[treeId]!
        const left = approach(tx, ty)
        if (left > 0 && withinReach(tx, ty) && state.treeLogs[treeId]! > 0) {
          while (!forager.log && forager.axe && forager.alive && bodySeconds.length < 60) {
            seconds.work += chargeSeconds(1, config.chopKcalPerHour, () => {
              const done = cutAt(state, forager, treeId!, 1, minute)
              if (done.cut) {
                cutLog = true
                felled = done.cut.felled
                axeEvents.push(done.cut)
              }
              if (done.worn) axeEvents.push(done.worn)
            })
          }
          seconds.stand = left - seconds.work
          reason = 'cutting a log'
        } else {
          seconds.stand = left
          reason = 'seeking a tree'
        }
      } else if (plan.kind === 'stone') {
        task = 'stone'
        stoneId = plan.stoneId
        const sx = layout.stones.x[stoneId]!
        const sy = layout.stones.y[stoneId]!
        const left = approach(sx, sy)
        if (left > 0 && withinReach(sx, sy) && state.stoneStock[stoneId]! > 0) {
          seconds.work = chargeSeconds(left, config.gatherKcalPerHour, () => {
            if (tookStone) return
            state.stoneStock[stoneId!]! -= 1
            forager.stone += 1
            tookStone = true
          })
          reason = 'picking up a stone'
        } else {
          seconds.stand = left
          reason = 'fetching a stone'
        }
      } else {
        // Waiting at its hearth for an axe being made, or with the food to buy one.
        const made = plan.kind === 'await sale'
        if (atHearth(forager)) {
          seconds.stand = 60
          reason = made ? 'waiting to buy an axe' : 'waiting for an axe being made'
        } else {
          seconds.stand = walkTo(forager.hearth.x, forager.hearth.y)
          reason = made ? 'taking food home to buy an axe' : 'going home to wait for an axe'
        }
      }
    } else if (goal) {
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
      const forFood = good === 'food'
      const plants = forFood ? layout.foodPlants : layout.woodPlants
      // Working for food, a thicket it has spotted and never checked competes with the sources it remembers. Rule 14:
      // remembering no source worth working, it searches a site of the good it has never checked, then ground it has
      // never seen, before it revisits.
      const foodTarget = forFood ? foodGoal(config, layout, forager, minute, false) : null
      let chosen = forFood ? (foodTarget?.source ?? null) : choosePlant(config, layout, forager, good, minute, false)
      const siteSearch =
        foodTarget?.site ?? (chosen === null ? chooseSite(config, layout, forager, minute, 'search', good) : null)
      const search =
        chosen === null && siteSearch === null && forager.placesSeen < placeCount(config)
          ? choosePlace(config, forager, minute)
          : null
      if (chosen === null && search === null && siteSearch === null)
        chosen = choosePlant(config, layout, forager, good, minute)
      if (forFood) forager.targetFoodId = chosen
      else forager.targetWoodId = chosen
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
        const route = frontier(forager, forager, (point) =>
          reachableAndBack(config, forager, point.x, point.y, minute, speed),
        )
        const point = route?.at(-1)
        if (point) {
          reason = 'searching'
          seconds.stand = walkTo(point.x, point.y)
        } else {
          reason = idleReason(config, forager, plants, forFood ? layout.foodChunks : layout.woodChunks, minute)
          seconds.stand = 60
        }
      } else if (forFood) {
        targetId = chosen
        food = foodOfSource(layout, chosen)
        const lake = chosen < 0
        const point = sourcePoint(layout, forager, chosen)
        const left = lake ? walkTo(point.x, point.y) : approach(point.x, point.y)
        const bank = lake ? forager.knownBanks.get(-chosen - 1) : undefined
        const fishStock = bank ? state.fish.find((stock) => stock.bodyId === bank.bodyId) : undefined
        sourceStockBefore = lake ? fishStock!.stock : state.foodStock[chosen]!
        // Food comes more slowly as a source thins: the rate is set by the stock as it begins.
        const rate = lake
          ? fishRate(forager.fishRate, sourceStockBefore, fishStock!.capacity)
          : rateAtStock(config, fullRateOf(forager, food), food, sourceStockBefore)
        // A fisher learns the lake by fishing it: at the shore it finds the stock, worth working or not.
        if (lake && left > 0 && withinReach(point.x, point.y)) {
          fishBodyId = bank!.bodyId
          fishBankId = bank!.id
          const memory = forager.fishMemory.get(bank!.bodyId)
          fishExpectedRate = memory ? fishRate(forager.fishRate, memory.stock, memory.capacity) : forager.fishRate
          forager.fishMemory.set(bank!.bodyId, { stock: sourceStockBefore, capacity: fishStock!.capacity, minute })
        }
        if (
          left > 0 &&
          withinReach(point.x, point.y) &&
          (worthWorking(config, rate) || (lake && worthWorking(config, fishExpectedRate)))
        ) {
          plantId = chosen
          seconds.work = chargeSeconds(worthWorking(config, rate) ? left : 1, config.pickKcalPerHour, () => {
            const due = workSeconds(forager.pickRemainder, rate, 1)
            forager.pickRemainder = due.remainder
            const caught = Math.min(due.units, lake ? fishStock!.stock : state.foodStock[chosen]!)
            gatheredKcal += caught
            if (lake) {
              fishStock!.stock -= caught
              fishStock!.caught += caught
              state.fishKcal -= caught
            } else state.foodStock[chosen]! -= caught
            const eat = Math.min(caught, config.reserveMaxKcal - forager.energyKcal)
            forager.energyKcal += eat
            if (caught > eat)
              forager.carried = [...forager.carried, { food: food!, kcal: caught - eat, harvestTick: minute }]
          })
          forager.secondsToday.forage += seconds.work
          forager.secondsWorked.forage += seconds.work
          seconds.stand = left - seconds.work
        } else seconds.stand = left
        if (buying) reason = 'picking food to buy an axe'
        else if (!seconds.work) reason = 'seeking food'
        else reason = food === 'berries' ? 'foraging' : food === 'nuts' ? 'gathering nuts' : 'fishing'
      } else {
        targetId = chosen
        const px = plants.x[chosen]!
        const py = plants.y[chosen]!
        const left = approach(px, py)
        const rate = forager.woodRate
        if (left > 0 && withinReach(px, py) && state.woodStock[chosen]! >= minuteOfWork(rate)) {
          plantId = chosen
          seconds.work = chargeSeconds(left, config.gatherKcalPerHour, () => {
            const due = workSeconds(forager.gatherRemainder, rate, 1)
            forager.gatherRemainder = due.remainder
            gatheredWood += due.units
            state.woodStock[chosen]! -= due.units
            forager.wood += due.units
            forager.tripWood += due.units
          })
          forager.secondsToday.gather += seconds.work
          forager.secondsWorked.gather += seconds.work
        } else seconds.stand = left
        if (filling) reason = 'filling a load'
        else if (seconds.work) reason = 'gathering'
        else reason = 'seeking wood'
      }
    }
  }
  if (seconds.sleep) seconds.sleep = chargeSeconds(seconds.sleep, sleepCostOf(config, warmth))
  seconds.stand = drinkingSeconds + chargeSeconds(60 - bodySeconds.length, config.restKcalPerHour)
  if (atHearth(forager)) forager.tripWood = 0
  const met = forager.alive ? meet(state, forager, minute) : null

  const traded = forager.alive ? swap(config, forager, state.foragers, minute) : { swaps: [], quotes: [] }
  if (forager.alive) axeEvents.push(...exchangeAxes(state, forager, minute))
  // Having swapped, a member at its hearth feeds its group's fire.
  const fed =
    forager.alive && sleepsByGroupFire(forager) && atHearth(forager)
      ? feedFire(state, state.groups[forager.groupId!]!, forager, minute)
      : null
  // Then it lays any log it carries in its hut, which stays where it was begun if its hearth has moved.
  const moved = forager.alive ? leaveHutIfMoved(state, forager, minute) : null
  if (moved) hutEvents.push(moved)
  const laidLog = forager.alive && layLog(state, forager, minute)
  const eatenAgain = eatCarried(forager.carried, forager.alive ? config.reserveMaxKcal - forager.energyKcal : 0)
  forager.energyKcal += eatenAgain.takenKcal
  forager.carried = eatenAgain.rest

  const climbCm = segments.reduce(
    (total, segment) =>
      total +
      Math.max(0, heightAt(terrain, segment.to.x, segment.to.y) - heightAt(terrain, segment.from.x, segment.from.y)),
    0,
  )
  forager.climbedCm += climbCm
  const event: ActionEvent = {
    fishBodyId,
    fishBankId,
    fishExpectedRate,
    waterDeficitBeforeMl,
    waterDeficitAfterMl: forager.waterDeficitMl,
    drinkSeconds: drinkingSeconds,
    observations: forager.waterObservations,
    routeFailed,
    segments,
    bodySeconds,
    drinkBankId: drinkBank?.id ?? null,
    waterLostMl,
    waterDrunkMl,
    inactiveSeconds: 60 - bodySeconds.length,
    kind: 'action',
    foragerId: forager.id,
    minute,
    action: actionOf(seconds, good, task, sleeping),
    reason,
    from,
    position: { x: forager.x, y: forager.y },
    workedFor: good,
    forTrade,
    targetId,
    plantId,
    food,
    sourceStockBefore,
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
    warmth,
    groupId: forager.groupId,
    placeId,
    siteId,
    loadWood: load.wood,
    loadBerriesKcal: load.berriesKcal,
    loadNutsKcal: load.nutsKcal,
    loadFishKcal: load.fishKcal,
    walkTarget,
    loadSpeedCmPerSecond: speed,
    speedCmPerSecond: walkingSpeed,
    gradePercent: grade,
    terrainPercent,
    climbCm,
    fireGroupId,
    loadLog: load.log,
    task,
    treeId,
    stoneId,
    cutLog,
    felled,
    tookStone,
    laidLog,
    inHut,
  }
  return { event, swaps: traded.swaps, quotes: traded.quotes, met, fed, axeEvents, hutEvents }
}

/**
 * Hour `hour`'s regrowth of food, with hours counted from minute 0: berries on every bush and nuts on every hazel,
 * each up to its capacity. Returns the food regrown.
 */
export function regrowFood(state: Pick<ValleyState, 'config' | 'foodStock' | 'layout'>, hour: number) {
  const { config, foodStock } = state
  const bushes = state.layout.bushes.count
  const { berries, nuts } = regrowthOf(config, hour)
  let regrown = 0
  const grow = (from: number, to: number, amount: number, capacity: number) => {
    if (!amount) return
    for (let id = from; id < to; id += 1) {
      const before = foodStock[id]!
      const after = Math.min(capacity, before + amount)
      foodStock[id] = after
      regrown += after - before
    }
  }
  grow(0, bushes, berries, config.bushCapacityKcal)
  grow(bushes, foodStock.length, nuts, config.hazelCapacityKcal)
  return regrown
}

/**
 * Hour `hour`'s regrowth of wood, with hours counted from minute 0: dead branches falling under every standing tree and
 * sticks on every bush, each up to its capacity. A felled tree gains no dead branches, and a crown above capacity keeps
 * what it has. Returns the wood regrown.
 */
export function regrowWood(state: Pick<ValleyState, 'config' | 'woodStock' | 'treeFelledMinute'>, hour: number) {
  const { config, woodStock, treeFelledMinute } = state
  const trees = treeFelledMinute.length
  let regrown = 0
  const { branches, sticks } = regrowthOf(config, hour)
  if (branches)
    for (let id = 0; id < trees; id += 1) {
      if (treeFelledMinute[id]! >= 0) continue
      const before = woodStock[id]!
      const after = Math.max(before, Math.min(config.treeCapacityWood, before + branches))
      woodStock[id] = after
      regrown += after - before
    }
  if (sticks)
    for (let id = trees; id < woodStock.length; id += 1) {
      const before = woodStock[id]!
      const after = Math.min(config.bushCapacityWood, before + sticks)
      woodStock[id] = after
      regrown += after - before
    }
  return regrown
}

/**
 * Runs one minute on `state` in place: practice at the start of every day after the first, regrowth at the start of
 * every hour after the first, the minute's turn order, each living forager's turn, and the record. Only the engine's
 * own copies may be passed here.
 */
function advance(state: ValleyState, recordEvents = true) {
  const { config, minute } = state
  const lastPractice: PracticeEvent[] = []
  const lastHutEvents: HutEvent[] = []
  const lastAxeEvents: AxeEvent[] = []
  if (minute > 0 && minute % MINUTES_PER_DAY === 0) {
    for (const forager of state.foragers) if (forager.alive) lastPractice.push(practiceDay(config, forager, minute))
    lastHutEvents.push(...weatherHuts(state, minute))
    state.totals.regrownLogs += regrowTrees(state, minute)
  }
  let regrownKcal = 0
  let fishGrownKcal = 0
  let regrownWood = 0
  if (minute > 0 && minute % 60 === 0) {
    const hour = minute / 60
    regrownKcal += regrowFood(state, hour)
    for (const stock of state.fish) {
      const grown = fishGrowth(stock.capacity, stock.stock, stock.remainder, config.fishGrowthPercentPerYear)
      stock.stock += grown.grown
      stock.grown += grown.grown
      stock.remainder = grown.remainder
      state.fishKcal += grown.grown
      fishGrownKcal += grown.grown
    }
    regrownWood += regrowWood(state, hour)
  }

  // The fires burn, or go out, at the start of every hour, before anyone acts.
  const lastFires: FireEvent[] = minute % 60 === 0 ? burnFires(state, minute) : []
  const lastFeeds: FeedEvent[] = []
  const lastEvents: ActionEvent[] = []
  const lastWaterEvents: WaterEvent[] = []
  const lastSwaps: SwapEvent[] = []
  const lastQuotes: QuoteEvent[] = []
  const lastDeaths: DeathEvent[] = []
  const lastGroupEvents: GroupEvent[] = []
  // Experiments keep no event history, so they build none.
  const newEvents: ValleyEvent[] = recordEvents ? [...lastPractice, ...lastHutEvents, ...lastFires] : []
  const today = state.today
  for (const fire of lastFires) {
    today.burnedWood += fire.burned
    today.campfireBurnedWood += fire.burned
    if (fire.lit) today.fireLitHours += 1
    else today.fireDarkHours += 1
    state.totals.burnedWood += fire.burned
  }
  for (const id of turnOrder(config.seed, minute, state.foragers.length)) {
    const forager = state.foragers[id]!
    if (!forager.alive) continue
    const turn = takeTurn(state, forager, minute)
    const { event } = turn
    const waterEvents: WaterEvent[] = [...event.observations]
    if (event.waterDrunkMl > 0) {
      const bank = forager.knownBanks.get(event.drinkBankId!)!
      waterEvents.push({
        kind: 'drink',
        minute,
        foragerId: id,
        bankId: bank.id,
        bodyId: bank.bodyId,
        seconds: event.drinkSeconds,
        volumeMl: event.waterDrunkMl,
        deficitBeforeMl: event.waterDeficitBeforeMl,
        deficitAfterMl: event.waterDeficitAfterMl,
        lossMl: event.waterLostMl,
      })
    }
    if (event.routeFailed && event.walkTarget)
      waterEvents.push({
        kind: 'route failure',
        minute,
        foragerId: id,
        destination: event.walkTarget,
        knowledgeRevision: forager.routeRevision,
      })
    lastWaterEvents.push(...waterEvents)
    if (recordEvents) newEvents.push(...waterEvents)
    today.drinkingMlById[id]! += event.waterDrunkMl
    today.waterLossMlById[id]! += event.waterLostMl
    today.endDeficitMlById[id] = forager.waterDeficitMl
    today.drinkingSecondsById[id]! += event.drinkSeconds
    if (event.reason === 'seeking water' || event.reason === 'drinking')
      today.seekingWaterSecondsById[id]! += event.walkSeconds
    for (const second of event.bodySeconds) {
      today.maxDeficitMlById[id] = Math.max(today.maxDeficitMlById[id]!, second.deficitMl)
      if (second.thirsty) today.thirstySecondsById[id]! += 1
    }
    if (event.fishBodyId !== null && event.gatheredKcal)
      today.fishCatchByBody[event.fishBodyId] = (today.fishCatchByBody[event.fishBodyId] ?? 0) + event.gatheredKcal
    lastEvents.push(event)
    lastSwaps.push(...turn.swaps)
    lastQuotes.push(...turn.quotes)
    if (recordEvents) newEvents.push(event, ...turn.swaps, ...turn.quotes)
    if (turn.fed) {
      lastFeeds.push(turn.fed)
      if (recordEvents) newEvents.push(turn.fed)
      today.fireGivenById[id]! += turn.fed.wood
    }
    if (turn.axeEvents.length) {
      lastAxeEvents.push(...turn.axeEvents)
      if (recordEvents) newEvents.push(...turn.axeEvents)
      for (const made of turn.axeEvents) {
        if (made.kind === 'cut') {
          today.logsCut += 1
          today.logsCutById[made.foragerId]! += 1
        } else if (made.kind === 'made') {
          today.axesMade += 1
          if (made.forSale) today.axesMadeForSale += 1
          today.axesMadeById[made.foragerId]! += 1
        } else if (made.kind === 'worn') today.axesWornOut += 1
        else if (made.kind === 'sale') {
          today.axesSold += 1
          today.axesSoldById[made.sellerId]! += 1
          today.axesBoughtById[made.buyerId]! += 1
        }
      }
    }
    if (turn.hutEvents.length) {
      lastHutEvents.push(...turn.hutEvents)
      if (recordEvents) newEvents.push(...turn.hutEvents)
    }
    if (event.inHut) today.hutSleepMinutes += 1
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
    if (event.task === 'cut') {
      time.cut += event.workSeconds
      today.cutSecondsById[id]! += event.workSeconds
    } else if (event.task) {
      time.make += event.workSeconds
      today.makeSecondsById[id]! += event.workSeconds
    } else if (event.workedFor === 'food') {
      time.forage += event.workSeconds
      today.forageSecondsById[id]! += event.workSeconds
    } else {
      time.gather += event.workSeconds
      today.gatherSecondsById[id]! += event.workSeconds
    }
    today.walkSecondsById[id]! += event.walkSeconds
    const carriedLoad = {
      wood: event.loadWood,
      berriesKcal: event.loadBerriesKcal,
      nutsKcal: event.loadNutsKcal,
      fishKcal: event.loadFishKcal,
      log: 0,
    }
    if (loadKg(config, carriedLoad) > 0) today.loadedWalkSecondsById[id]! += event.walkSeconds
    today.climbedCmById[id]! += event.climbCm
    if (event.walkSeconds) {
      const kg = loadKg(config, { ...carriedLoad, log: event.loadLog })
      const rate = walkCost(config, kg, event.speedCmPerSecond, event.gradePercent, event.terrainPercent)
      today.walkKcalById[id]! += Math.floor((event.walkSeconds * rate) / 3_600)
    }
    today.gatheredWoodById[id]! += event.gatheredWood
    today.gatheredKcal += event.gatheredKcal
    if (event.food === 'berries') today.gatheredBerriesKcal += event.gatheredKcal
    else if (event.food === 'nuts') today.gatheredNutsKcal += event.gatheredKcal
    else if (event.food === 'fish') today.gatheredFishKcal += event.gatheredKcal
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
      if (forager.deathCauses.includes('dehydration')) today.dehydrationDeaths += 1
      if (forager.deathCauses.includes('starvation')) today.starvationDeaths += 1
      const death: DeathEvent = {
        kind: 'death',
        foragerId: id,
        minute,
        cause: forager.deathCauses.length > 1 ? 'starvation and dehydration' : forager.deathCauses[0]!,
        second: forager.deathSecond!,
      }
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
  state.totals.fishGrownKcal += fishGrownKcal
  state.totals.regrownWood += regrownWood
  if (lastPractice.length) {
    today.forageRates = state.foragers.map((forager) => forager.forageRate)
    today.woodRates = state.foragers.map((forager) => forager.woodRate)
    today.craftById = state.foragers.map((forager) => forager.craft)
  }
  for (const forager of state.foragers) {
    if (!forager.alive || forager.groupId === null) continue
    today.memberMinutes += 1
    if (hutWhole(state, forager)) today.hutWholeMinutes += 1
  }

  state.lastEvents = lastEvents
  state.lastWaterEvents = lastWaterEvents
  state.lastSwaps = lastSwaps
  state.lastQuotes = lastQuotes
  state.lastPractice = lastPractice
  state.lastDeaths = lastDeaths
  state.lastGroupEvents = lastGroupEvents
  state.lastFires = lastFires
  state.lastFeeds = lastFeeds
  state.lastAxeEvents = lastAxeEvents
  state.lastHutEvents = lastHutEvents
  for (const event of newEvents) state.eventDays[state.eventDays.length - 1]!.push(event)

  const next = minute + 1
  if (next % MINUTES_PER_DAY === 0) {
    Object.assign(today, foodStocks(state))
    today.fishKcal = state.fishKcal
    today.woodStock = sum(state.woodStock)
    today.endEnergyKcal = state.foragers.map((forager) => forager.energyKcal)
    today.carriedKcal = state.foragers.reduce((total, forager) => total + carriedKcal(forager.carried), 0)
    Object.assign(today, groupCounts(state))
    today.placesSeenById = state.foragers.map((forager) => forager.placesSeen)
    today.sitesKnownById = state.foragers.map(sitesKnown)
    today.sitesCheckedById = state.foragers.map((forager) => sitesCheckedSince(forager, today.day * MINUTES_PER_DAY))
    today.hutsWhole = hutsWholeNow(state)
    today.hutLogsById = hutLogsById(state)
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
