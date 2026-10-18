import { askOf, axeLife, salePrice, worthTo } from './axes'
import { feedAmount } from './fire'
import { MINUTES_PER_DAY, isDaylight, loadKg, minuteOfWork, plantsInView, speedForLoad } from './forager'
import { distance, distanceSq } from './geometry'
import { weathersOn } from './huts'
import { forEachPlantWithin } from './layout'
import { craftOf, ratesOf } from './practice'
import { hearthAround, livingMembers, placeCentre, placeCount, placeInView, placeWanted, placesPerSide } from './social'
import { siteCentre, siteGeometry, siteGood, siteWanted, sightOf } from './sites'
import { bothGain } from './trade'
import { coldMatters, hourlyShare } from './work'
import type { ActionReason, Axe, Hut, Point, ValleyState } from './types'

/** What a forager not hungry does when idle, which a full load must wait for. */
const IDLE_REASONS = new Set<ActionReason>([
  'exploring',
  'checking',
  'seeking company',
  'waiting for company',
  'satiated',
  'waiting to swap',
])

/** Work for a hut, which a forager carrying a log, or not hungry with a full load, must leave until it is home. */
const HUT_REASONS = new Set<ActionReason>([
  'making an axe',
  'going home to make an axe',
  'cutting a log',
  'seeking a tree',
  'waiting for an axe being made',
  'going home to wait for an axe',
  'picking food to buy an axe',
  'taking food home to buy an axe',
  'waiting to buy an axe',
  'fetching a stone',
  'picking up a stone',
])

const sameAxe = (a: Axe | null, b: Axe | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.id === b.id &&
    a.quality === b.quality &&
    a.logsLeft === b.logsLeft &&
    a.makerId === b.makerId &&
    a.madeMinute === b.madeMinute)

const inRemainderRange = (remainder: number) => Number.isInteger(remainder) && remainder >= 0 && remainder < 3_600

const sum = (values: Int32Array) => {
  let total = 0
  for (const value of values) total += value
  return total
}

/**
 * Checks every invariant of the specification after every minute of a run. It keeps its own copy of every plant's
 * stock and replays each minute's regrowth and recorded work onto it, so a stock that changed without a record, or a
 * record that does not match the stock, is caught: the plants worked are compared every minute and every plant every
 * hour. Plants in a forager's view are checked against its memory in full in the first minute of every hour, and the
 * plant it worked or walked towards every minute.
 */
export class ValleyChecker {
  private bushes: Int32Array
  private trees: Int32Array
  private bushTotal: number
  private treeTotal: number
  private aliveBefore: boolean[]
  private burnHour: number[]
  private rates: [number, number][]
  private turns: Int32Array
  private practised: Int32Array
  /** Each forager's group and hearth at the end of the minute before. */
  private groupBefore: (number | null)[]
  private hearthBefore: Point[]
  /** Each forager's trip wood, places seen and sites known at the end of the minute before. */
  private tripWoodBefore: number[]
  private placesSeenBefore: number[]
  private siteKnownBefore: Uint8Array[]
  /** Each group's fire wood at the end of the minute before, each forager's gifts to fires, and each fire's hour. */
  private fireWoodBefore: number[]
  private givenBefore: number[]
  private litNow: boolean[]
  /** The groups a band starts with, which stand from before minute 0. */
  private startingGroups: number
  /** Each forager's turn in the minute being checked, by ID, or −1 if it took none. */
  private turnAt = new Int32Array(0)
  /** Every tree's logs and every stone spot's stones, replayed from regrowth and recorded work. */
  private treeLogs: Int32Array
  private stones: Int32Array
  /** Each forager's log, craft, axe and spare at the end of the minute before, and every hut. */
  private logBefore: number[]
  private craftBefore: number[]
  private axeBefore: (Axe | null)[]
  private spareBefore: (Axe | null)[]
  private hutsBefore: Hut[]

  constructor(state: ValleyState) {
    this.bushes = state.bushKcal.slice()
    this.trees = state.treeWood.slice()
    this.bushTotal = sum(this.bushes)
    this.treeTotal = sum(this.trees)
    this.aliveBefore = state.foragers.map((forager) => forager.alive)
    this.burnHour = state.foragers.map(() => -1)
    this.rates = state.foragers.map((forager) => [forager.forageRate, forager.woodRate])
    this.turns = new Int32Array(state.foragers.length)
    this.practised = new Int32Array(state.foragers.length)
    this.groupBefore = state.foragers.map((forager) => forager.groupId)
    this.hearthBefore = state.foragers.map((forager) => forager.hearth)
    this.tripWoodBefore = state.foragers.map((forager) => forager.tripWood)
    this.placesSeenBefore = state.foragers.map((forager) => forager.placesSeen)
    this.siteKnownBefore = state.foragers.map((forager) => forager.siteKnown.slice())
    this.fireWoodBefore = state.groups.map((group) => group.fireWood)
    this.givenBefore = state.foragers.map((forager) => forager.fireGiven)
    this.litNow = state.groups.map((group) => group.fireLit)
    this.startingGroups = state.minute === 0 ? state.groups.length : 0
    this.treeLogs = state.treeLogs.slice()
    this.stones = state.stoneStock.slice()
    this.logBefore = state.foragers.map((forager) => forager.log)
    this.craftBefore = state.foragers.map((forager) => forager.craft)
    this.axeBefore = state.foragers.map((forager) => forager.axe)
    this.spareBefore = state.foragers.map((forager) => forager.spareAxe)
    this.hutsBefore = [...state.huts]
  }

  /** Every invariant the minute just run breaks; an empty list means it is sound. */
  check(state: ValleyState): string[] {
    const { config, layout, totals } = state
    const minute = state.minute - 1
    const violations: string[] = []
    const fail = (message: string) => violations.push(`Minute ${minute}: ${message}`)
    // Each forager's turn in the minute, by ID, which several checks need.
    if (this.turnAt.length !== state.foragers.length) this.turnAt = new Int32Array(state.foragers.length)
    this.turnAt.fill(-1)
    for (const [index, event] of state.lastEvents.entries()) this.turnAt[event.foragerId] = index

    if (minute > 0 && minute % 60 === 0) {
      const hour = (minute / 60) % 24
      const berries = hourlyShare(config.bushRegrowthKcalPerDay, hour)
      const deadwood = hourlyShare(config.treeRegrowthWoodPerDay, hour)
      for (let id = 0; id < this.bushes.length; id += 1) {
        const after = Math.min(config.bushCapacityKcal, this.bushes[id]! + berries)
        this.bushTotal += after - this.bushes[id]!
        this.bushes[id] = after
      }
      for (let id = 0; id < this.trees.length; id += 1) {
        const after = Math.min(config.treeCapacityWood, this.trees[id]! + deadwood)
        this.treeTotal += after - this.trees[id]!
        this.trees[id] = after
      }
    }

    // Logs regrow at midnight on every `logRegrowthDays`-th day.
    if (minute > 0 && minute % MINUTES_PER_DAY === 0 && (minute / MINUTES_PER_DAY) % config.logRegrowthDays === 0)
      for (let id = 0; id < this.treeLogs.length; id += 1)
        if (this.treeLogs[id]! < config.logsPerTree) this.treeLogs[id]! += 1

    // Whether each group's fire is lit this hour, decided at its start.
    if (minute % 60 === 0)
      this.litNow = state.groups.map((group) => state.lastFires.find((fire) => fire.groupId === group.id)?.lit ?? false)
    // Practice happens in the first minute of a day after the first, once for each forager alive at its start, and
    // every forager alive at the start of a minute takes exactly one turn in it.
    const midnight = minute > 0 && minute % MINUTES_PER_DAY === 0
    const turns = this.turns.fill(0)
    const practised = this.practised.fill(0)
    for (const event of state.lastEvents) turns[event.foragerId]! += 1
    for (const event of state.lastPractice) practised[event.foragerId]! += 1
    for (let id = 0; id < this.aliveBefore.length; id += 1) {
      const alive = this.aliveBefore[id]!
      if (turns[id] !== (alive ? 1 : 0)) fail(`forager ${id} did not take exactly one turn`)
      if (practised[id] !== (alive && midnight ? 1 : 0)) fail(`forager ${id} did not practise exactly once at midnight`)
    }

    // The plants worked this minute, compared with the replay once every event has been applied.
    const touchedBushes: number[] = []
    const touchedTrees: number[] = []
    const fullView = minute % 60 === 0
    const daylight = isDaylight(config, minute)
    const reach2 = config.reachCm ** 2
    const hearthAtTurn = this.hearthsAtTurns(state)
    const cuts = new Map<number, number>()
    for (const made of state.lastAxeEvents) if (made.kind === 'cut') cuts.set(made.foragerId, made.treeId)
    const sight = sightOf(config, minute)
    for (const event of state.lastEvents) {
      const forager = state.foragers[event.foragerId]!
      const { from, position } = event
      const total = event.walkSeconds + event.workSeconds + event.standSeconds + event.sleepSeconds
      if (total !== 60) fail(`forager ${forager.id}'s seconds add up to ${total}`)
      if (position.x < 0 || position.y < 0 || position.x > config.valleySizeCm || position.y > config.valleySizeCm)
        fail(`forager ${forager.id} left the valley`)
      // It walks at the speed its load allows as it sets out, and its load is no more than the wood of its trip.
      const tripWood = this.tripWoodBefore[forager.id]!
      const logBefore = this.logBefore[forager.id]!
      if (event.loadWood < 0 || event.loadWood > tripWood || event.loadBerriesKcal < 0 || event.loadLog !== logBefore)
        fail(`forager ${forager.id} carries a load it did not have`)
      const kg = loadKg(config, event.loadWood, event.loadBerriesKcal, event.loadLog)
      if (event.speedCmPerSecond !== speedForLoad(config, kg))
        fail(`forager ${forager.id} walks at a speed its load does not allow`)
      if (distance(from.x, from.y, position.x, position.y) > event.walkSeconds * event.speedCmPerSecond)
        fail(`forager ${forager.id} moved further than it walked`)
      // Not hungry, a forager with a full load takes it home before anything else; and only then does it say so.
      const fullLoad = config.woodLoad > 0 && tripWood >= config.woodLoad
      if (event.reason === 'taking a load home') {
        if (!fullLoad) fail(`forager ${forager.id} took home a load it was not carrying`)
        const home = hearthAtTurn[forager.id]!
        const hearthSq = (point: Point) => distanceSq(point.x, point.y, home.x, home.y)
        if (hearthSq(position) > hearthSq(from)) fail(`forager ${forager.id} walked away from home with its load`)
      } else if (fullLoad && !forager.hungry && (IDLE_REASONS.has(event.reason) || HUT_REASONS.has(event.reason)))
        fail(`forager ${forager.id} is ${event.reason} with a full load`)
      // A forager carrying a log takes it home before anything else.
      if (event.reason === 'taking a log home') {
        if (!logBefore) fail(`forager ${forager.id} took home a log it was not carrying`)
        const home = hearthAtTurn[forager.id]!
        const hearthSq = (point: Point) => distanceSq(point.x, point.y, home.x, home.y)
        if (hearthSq(event.position) > hearthSq(from)) fail(`forager ${forager.id} walked away from home with its log`)
      } else if (logBefore && daylight && forager.alive && event.reason !== 'going home')
        fail(`forager ${forager.id} is ${event.reason} carrying a log`)
      const food = event.workedFor === 'food'
      const plants = food ? layout.bushes : layout.trees
      const stocks = food ? this.bushes : this.trees
      const memory = food ? forager.bushMemory : forager.treeMemory
      // What it remembers matches what it saw at the start of its turn, before its own work.
      const target = event.targetId
      if (
        target !== null &&
        (plants.x[target]! - from.x) ** 2 + (plants.y[target]! - from.y) ** 2 <= config.perceptionRadiusCm ** 2 &&
        (memory.seen[target] !== minute || memory.stock[target] !== stocks[target])
      )
        fail(`forager ${forager.id}'s memory of its target does not match what it saw`)
      if (fullView) {
        for (const [kindPlants, kindIndex, kindStocks, kindMemory] of [
          [layout.bushes, layout.bushIndex, this.bushes, forager.bushMemory],
          [layout.trees, layout.treeIndex, this.trees, forager.treeMemory],
        ] as const) {
          for (const id of plantsInView(config, kindIndex, kindPlants, from.x, from.y)) {
            if (kindMemory.seen[id] !== minute || kindMemory.stock[id] !== kindStocks[id])
              fail(`forager ${forager.id}'s memory of a plant in view does not match what it saw`)
          }
        }
        // Logs and stones are seen as far as long sight.
        for (const [kindPlants, kindIndex, kindStocks, kindMemory] of [
          [layout.trees, layout.treeIndex, this.treeLogs, forager.logMemory],
          [layout.stones, layout.stoneIndex, this.stones, forager.stoneMemory],
        ] as const)
          forEachPlantWithin(kindIndex, kindPlants, from.x, from.y, sight, (id) => {
            if (kindMemory.seen[id] !== minute || kindMemory.stock[id] !== kindStocks[id])
              fail(`forager ${forager.id}'s memory of logs or stones in sight does not match what it saw`)
          })
      }
      if (event.task) {
        if (event.workSeconds && !daylight) fail(`forager ${forager.id} worked at night`)
        if (event.plantId !== null || event.gatheredKcal || event.gatheredWood)
          fail(`forager ${forager.id} picked or gathered while working for its hut`)
        const cutTree = cuts.get(forager.id)
        if (event.task === 'cut') {
          const id = event.treeId
          if (id === null) fail(`forager ${forager.id} cut no tree`)
          else if (event.workSeconds) {
            if ((layout.trees.x[id]! - position.x) ** 2 + (layout.trees.y[id]! - position.y) ** 2 > reach2)
              fail(`forager ${forager.id} cut a tree out of reach`)
            if (this.treeLogs[id]! < 1) fail(`forager ${forager.id} cut at a tree with no logs`)
            // It may have bought its axe at an earlier turn of the minute.
            const bought = state.lastAxeEvents.some((made) => made.kind === 'sale' && made.buyerId === forager.id)
            if (!this.axeBefore[forager.id] && !this.spareBefore[forager.id] && !bought)
              fail(`forager ${forager.id} cut without an axe`)
          }
          if (event.cutLog !== (cutTree !== undefined) || (cutTree !== undefined && cutTree !== id))
            fail(`forager ${forager.id}'s cut does not match its record`)
          if (cutTree !== undefined) this.treeLogs[cutTree]! -= 1
        } else if (cutTree !== undefined || event.cutLog) fail(`forager ${forager.id} cut a log without cutting`)
        if (event.task === 'stone') {
          const id = event.stoneId
          if (id === null) fail(`forager ${forager.id} fetched no stone`)
          else if (event.tookStone) {
            if ((layout.stones.x[id]! - position.x) ** 2 + (layout.stones.y[id]! - position.y) ** 2 > reach2)
              fail(`forager ${forager.id} picked up a stone out of reach`)
            if (this.stones[id]! < 1) fail(`forager ${forager.id} picked up a stone that was not there`)
            this.stones[id]! -= 1
          }
          if (event.tookStone !== event.workSeconds > 0) fail(`forager ${forager.id} worked at stones without one`)
        } else if (event.tookStone) fail(`forager ${forager.id} picked up a stone without fetching one`)
        if (event.task === 'make' && event.workSeconds) {
          const home = hearthAtTurn[forager.id]!
          if (position.x !== home.x || position.y !== home.y) fail(`forager ${forager.id} made an axe away from home`)
        }
      } else if (event.cutLog || event.tookStone || cuts.has(forager.id))
        fail(`forager ${forager.id} cut a log or took a stone without working for its hut`)
      else if (event.workSeconds) {
        if (!daylight) fail(`forager ${forager.id} worked at night`)
        if (event.plantId === null) fail(`forager ${forager.id} worked no plant`)
        else {
          const id = event.plantId
          if ((plants.x[id]! - position.x) ** 2 + (plants.y[id]! - position.y) ** 2 > reach2)
            fail(`forager ${forager.id} worked a plant out of reach`)
          const rate = food ? forager.forageRate : forager.woodRate
          if (stocks[id]! < minuteOfWork(rate))
            fail(`forager ${forager.id} worked a plant holding less than a minute's work`)
          const taken = food ? event.gatheredKcal : event.gatheredWood
          if (taken > stocks[id]!) fail(`forager ${forager.id} took more than the plant held`)
          stocks[id]! -= taken
          if (food) {
            this.bushTotal -= taken
            touchedBushes.push(id)
          } else {
            this.treeTotal -= taken
            touchedTrees.push(id)
          }
        }
      } else if (event.gatheredKcal || event.gatheredWood)
        fail(`forager ${forager.id} took from a plant without working`)
      const hearth = hearthAtTurn[forager.id]!
      if (event.sleepSeconds) {
        if (daylight) fail(`forager ${forager.id} slept in daylight`)
        if (from.x !== hearth.x || from.y !== hearth.y) fail(`forager ${forager.id} slept away from its hearth`)
        // Asleep in its hut exactly when the hut at its hearth holds every log. A forager met later in the minute by
        // one that founds a group with it leaves its hut behind after its turn.
        const hut = state.huts.find(
          (made) =>
            made.builderId === forager.id &&
            made.x === hearth.x &&
            made.y === hearth.y &&
            (made.abandonedMinute === null || made.abandonedMinute === minute),
        )
        const whole = hut !== undefined && hut.logs - (event.laidLog ? 1 : 0) >= config.hutLogs
        if (event.inHut !== whole)
          fail(`forager ${forager.id} slept in a hut that is not whole, or outside a whole one`)
      } else if (event.inHut) fail(`forager ${forager.id} is in its hut awake`)
      if (!daylight && forager.alive && event.reason !== 'going home' && event.reason !== 'night')
        fail(`forager ${forager.id} is up at night`)
      if (event.fireGroupId !== null) {
        // A member asleep by its group's fire burns no wood of its own, and is warm exactly when the fire is lit or it
        // sleeps in its whole hut.
        if (!event.sleepSeconds) fail(`forager ${forager.id} slept by a group's fire it could not`)
        // It may have been met by a founder at an earlier turn of the minute, or joined at its own.
        if (this.groupBefore[forager.id] !== event.fireGroupId && forager.groupId !== event.fireGroupId)
          fail(`forager ${forager.id} slept by another group's fire`)
        if (event.burnedWood) fail(`forager ${forager.id} burned its own wood beside its group's fire`)
        if (coldMatters(config) && event.sleptCold === ((this.litNow[event.fireGroupId] ?? false) || event.inHut))
          fail(`forager ${forager.id}'s warmth does not match its group's fire and its hut`)
      } else if (event.sleepSeconds && this.groupBefore[forager.id] !== null) {
        if (this.groupBefore[forager.id] === forager.groupId)
          fail(`forager ${forager.id} slept by its own fire while in a group`)
      } else if (event.inHut && (event.burnedWood || event.sleptCold))
        fail(`forager ${forager.id} burned wood or slept cold in its whole hut`)
      if (event.burnedWood) {
        const hour = Math.floor(minute / 60)
        if (!event.sleepSeconds) fail(`forager ${forager.id} burned wood awake`)
        if (this.burnHour[forager.id] === hour) fail(`forager ${forager.id} burned wood twice in an hour`)
        if (event.burnedWood !== config.fireWoodPerHour) fail(`forager ${forager.id} burned the wrong amount of wood`)
        this.burnHour[forager.id] = hour
      }
      if (position.x === hearth.x && position.y === hearth.y && event.tripWoodAfter !== 0)
        fail(`forager ${forager.id} is at its hearth with a load still counted`)
      if (event.reason === 'filling a load') {
        const before = event.tripWoodAfter - event.gatheredWood
        if (before <= 0 || before >= config.woodLoad) fail(`forager ${forager.id} filled a load it was not carrying`)
      }
    }
    for (let id = 0; id < this.treeLogs.length; id += 1)
      if (state.treeLogs[id] !== this.treeLogs[id])
        fail(`tree ${id} holds ${state.treeLogs[id]} logs, not ${this.treeLogs[id]}`)
    for (let id = 0; id < this.stones.length; id += 1)
      if (state.stoneStock[id] !== this.stones[id]) fail(`stone spot ${id} holds the wrong stones`)
    for (const id of touchedBushes)
      if (state.bushKcal[id] !== this.bushes[id]) fail(`bush ${id} holds ${state.bushKcal[id]}, not ${this.bushes[id]}`)
    // Work only ever takes, and regrowth stops at capacity, so every stock the replay holds stays in range.
    for (const id of touchedTrees)
      if (state.treeWood[id] !== this.trees[id]) fail(`tree ${id} holds ${state.treeWood[id]}, not ${this.trees[id]}`)
    if (minute % 60 === 0) {
      for (let id = 0; id < this.bushes.length; id += 1)
        if (state.bushKcal[id] !== this.bushes[id]) fail(`bush ${id} changed without a record`)
      for (let id = 0; id < this.trees.length; id += 1)
        if (state.treeWood[id] !== this.trees[id]) fail(`tree ${id} changed without a record`)
    }

    // One pass over the band sums what the balances need.
    let reserves = 0
    let carried = 0
    let wood = 0
    let woodSold = 0
    let woodBought = 0
    let kcalReceived = 0
    let kcalPaid = 0
    for (const forager of state.foragers) {
      reserves += forager.energyKcal
      for (const lot of forager.carried) carried += lot.kcal
      wood += forager.wood
      woodSold += forager.swapTotals.woodSold
      woodBought += forager.swapTotals.woodBought
      kcalReceived += forager.swapTotals.kcalReceived
      kcalPaid += forager.swapTotals.kcalPaid
    }
    const held = this.bushTotal + reserves + carried + totals.metabolizedKcal + totals.spoiledKcal
    if (held !== totals.initialKcal + totals.regrownKcal)
      fail(`energy is not conserved: ${held} held, ${totals.initialKcal + totals.regrownKcal} supplied`)
    let fireWood = 0
    for (const group of state.groups) fireWood += group.fireWood
    if (
      this.treeTotal + wood + fireWood + totals.burnedWood + totals.axeWood !==
      totals.initialWood + totals.regrownWood
    )
      fail('wood is not conserved')
    this.checkLogsAndAxes(state, minute, midnight, fail)
    if (
      woodSold !== totals.swappedWood ||
      woodBought !== totals.swappedWood ||
      kcalReceived !== totals.swappedKcal ||
      kcalPaid !== totals.swappedKcal
    )
      fail('swap totals disagree')

    const minuteInDay = minute % MINUTES_PER_DAY
    const agreed =
      state.lastSwaps.length || state.lastQuotes.length
        ? [...state.lastSwaps, ...state.lastQuotes].map((made) => made.kcalPerWood)
        : []
    // Every swap and quote is between members of one group, and terms are heard only within it. A group
    // may dissolve later in the minute of a swap, and a forager may join one earlier in it, so two foragers share a
    // group if they shared one at the start of the minute or share one at its end.
    const agreedByGroup = new Map<number, number[]>()
    const groupsOf = (id: number) => [this.groupBefore[id] ?? null, state.foragers[id]!.groupId]
    for (const made of [...state.lastSwaps, ...state.lastQuotes]) {
      const [sellerBefore, sellerAfter] = groupsOf(made.sellerId)
      const [buyerBefore, buyerAfter] = groupsOf(made.buyerId)
      const shared =
        sellerBefore !== null && sellerBefore === buyerBefore
          ? sellerBefore
          : sellerAfter !== null && sellerAfter === buyerAfter
            ? sellerAfter
            : null
      if (shared === null) fail('a swap or quote crossed groups')
      else agreedByGroup.set(shared, [...(agreedByGroup.get(shared) ?? []), made.kcalPerWood])
    }
    for (const forager of state.foragers) {
      if (forager.energyKcal < 0 || forager.energyKcal > config.reserveMaxKcal)
        fail(`forager ${forager.id}'s reserve is out of range`)
      if (!forager.alive && forager.energyKcal !== 0) fail(`forager ${forager.id} is dead but has a reserve`)
      if (!inRemainderRange(forager.pickRemainder) || !inRemainderRange(forager.gatherRemainder))
        fail(`forager ${forager.id} has a remainder out of range`)
      if (!inRemainderRange(forager.costRemainder)) fail(`forager ${forager.id} has a remainder out of range`)
      if (!Number.isInteger(forager.wood) || forager.wood < 0) fail(`forager ${forager.id} holds ${forager.wood} wood`)
      // Carried lots are checked one by one every hour, and every minute at their ends: the oldest must not have
      // spoiled and the newest must not be from the future.
      const lots = forager.carried
      if (lots.length) {
        for (const lot of fullView ? lots : [lots[0]!, lots[lots.length - 1]!]) {
          if (!Number.isInteger(lot.kcal) || lot.kcal <= 0)
            fail(`forager ${forager.id} carries a lot of ${lot.kcal} kcal`)
          if (lot.harvestTick > minute) fail(`forager ${forager.id} carries food picked in the future`)
          if (config.shelfLifeHours > 0 && lot.harvestTick <= minute - 60 * config.shelfLifeHours)
            fail(`forager ${forager.id} carries food that should have spoiled`)
        }
        if (fullView)
          for (let index = 1; index < lots.length; index += 1)
            if (lots[index]!.harvestTick < lots[index - 1]!.harvestTick)
              fail(`forager ${forager.id}'s lots are out of order`)
      }
      const heard = forager.heardTerms
      if (heard && heard.minute > minute) fail(`forager ${forager.id} remembers terms from the future`)
      if (heard?.minute === minute && !agreed.includes(heard.kcalPerWood))
        fail(`forager ${forager.id} remembers terms no one agreed this minute`)
      if (heard?.minute === minute) {
        const ownGroup = groupsOf(forager.id).some(
          (group) => group !== null && (agreedByGroup.get(group) ?? []).includes(heard.kcalPerWood),
        )
        if (!ownGroup) fail(`forager ${forager.id} heard terms from outside its group`)
      }
      const log = forager.practiceLog
      const today = forager.secondsToday
      if (forager.alive && today.forage + today.gather > 60 * (minuteInDay + 1))
        fail(`forager ${forager.id} worked more seconds today than have passed`)
      if (forager.loggedSeconds.forage + today.forage !== forager.secondsWorked.forage)
        fail(`forager ${forager.id}'s practice lost or invented seconds at foraging`)
      if (forager.loggedSeconds.gather + today.gather !== forager.secondsWorked.gather)
        fail(`forager ${forager.id}'s practice lost or invented seconds at gathering`)
      if (forager.loggedSeconds.make + today.make !== forager.secondsWorked.make)
        fail(`forager ${forager.id}'s practice lost or invented seconds at making axes`)
      // Logs and rates change only at midnight: they are checked in full then, and for change every other minute.
      const rates = this.rates[forager.id]!
      if (midnight || minute === 0) {
        if (
          log.forage.length !== config.practiceDays ||
          log.gather.length !== config.practiceDays ||
          log.make.length !== config.practiceDays
        )
          fail(`forager ${forager.id}'s practice log has the wrong length`)
        for (const seconds of [...log.forage, ...log.gather, ...log.make])
          if (!Number.isInteger(seconds) || seconds < 0 || seconds > 86_400)
            fail(`forager ${forager.id}'s practice log is out of range`)
        if (forager.alive) {
          const expected = ratesOf(config, forager.foragingSkill, forager.woodSkill, log)
          if (expected.forageRate !== forager.forageRate || expected.woodRate !== forager.woodRate)
            fail(`forager ${forager.id}'s rates do not follow from its skills and practice`)
          if (forager.craft !== craftOf(config, forager.craftSkill, log))
            fail(`forager ${forager.id}'s craft does not follow from its skill and practice`)
        }
      } else if (forager.forageRate !== rates[0] || forager.woodRate !== rates[1])
        fail(`forager ${forager.id}'s rates changed mid-day`)
      else if (forager.craft !== this.craftBefore[forager.id]) fail(`forager ${forager.id}'s craft changed mid-day`)
      rates[0] = forager.forageRate
      rates[1] = forager.woodRate
    }
    for (const made of state.lastSwaps) {
      const seller = state.foragers[made.sellerId]!
      const buyer = state.foragers[made.buyerId]!
      if (!bothGain(seller, buyer, made.kcalPerWood)) fail('a swap did not pay both sides')
      if (made.kcal !== made.wood * made.kcalPerWood || made.wood < 1) fail('a swap does not add up')
    }
    this.checkKnowledge(state, minute, midnight || minute === 0, fail)
    this.checkGroups(state, fail)
    this.checkFires(state, minute, fail)
    for (const forager of state.foragers) this.aliveBefore[forager.id] = forager.alive
    this.groupBefore = state.foragers.map((forager) => forager.groupId)
    this.hearthBefore = state.foragers.map((forager) => forager.hearth)
    this.tripWoodBefore = state.foragers.map((forager) => forager.tripWood)
    this.placesSeenBefore = state.foragers.map((forager) => forager.placesSeen)
    for (const forager of state.foragers) this.siteKnownBefore[forager.id]!.set(forager.siteKnown)
    this.fireWoodBefore = state.groups.map((group) => group.fireWood)
    this.givenBefore = state.foragers.map((forager) => forager.fireGiven)
    this.logBefore = state.foragers.map((forager) => forager.log)
    this.craftBefore = state.foragers.map((forager) => forager.craft)
    this.axeBefore = state.foragers.map((forager) => forager.axe)
    this.spareBefore = state.foragers.map((forager) => forager.spareAxe)
    this.hutsBefore = [...state.huts]
    return violations
  }

  /**
   * Logs, stones, huts and axes: each is conserved; a hut changes only by its builder laying a log at it, by weather on
   * its day, or by being left behind; and every axe made, cut with, worn out, promised and sold follows its rules.
   */
  private checkLogsAndAxes(state: ValleyState, minute: number, midnight: boolean, fail: (message: string) => void) {
    const { config, totals } = state
    let onTrees = 0
    for (const logs of state.treeLogs) onTrees += logs
    let onGround = 0
    for (const stones of state.stoneStock) onGround += stones
    let carriedLogs = 0
    let heldStones = 0
    let axesHeld = 0
    let making = 0
    for (const forager of state.foragers) {
      if (forager.log !== 0 && forager.log !== 1) fail(`forager ${forager.id} carries ${forager.log} logs`)
      if (forager.stone < 0) fail(`forager ${forager.id} holds ${forager.stone} stones`)
      carriedLogs += forager.log
      heldStones += forager.stone
      axesHeld += (forager.axe ? 1 : 0) + (forager.spareAxe ? 1 : 0)
      if (forager.making) making += 1
    }
    let inHuts = 0
    for (const hut of state.huts) inHuts += hut.logs
    if (onTrees + carriedLogs + inHuts + totals.rottedLogs !== totals.initialLogs + totals.regrownLogs)
      fail('logs are not conserved')
    if (onTrees !== totals.initialLogs + totals.regrownLogs - totals.logsCut) fail('logs cut do not add up')
    if (onGround + heldStones + totals.stonesWorked !== totals.initialStones) fail('stones are not conserved')
    if (totals.stonesWorked !== totals.axesMade + making) fail('stones worked do not match axes made and begun')
    if (axesHeld + totals.axesWornOut !== totals.axesMade) fail('axes are not conserved')
    if (totals.axeWood !== totals.stonesWorked * config.axeWood) fail('wood in axes does not match axes begun')

    // Huts: replayed from the minute before through weather, laying and abandonment.
    const huts = [...this.hutsBefore]
    const day = minute / MINUTES_PER_DAY
    for (const made of state.lastHutEvents) {
      if (made.kind === 'weather') {
        const hut = huts[made.hutId]!
        if (!midnight || !weathersOn(state, hut, day)) fail(`hut ${made.hutId} weathered out of its day`)
        huts[made.hutId] = { ...hut, logs: hut.logs - 1 }
        if (made.logsAfter !== hut.logs - 1) fail(`hut ${made.hutId} weathered the wrong amount`)
      } else {
        const hut = huts[made.hutId]
        if (!hut || hut.builderId !== made.foragerId || hut.abandonedMinute !== null)
          fail(`hut ${made.hutId} was left behind by someone else`)
        else huts[made.hutId] = { ...hut, abandonedMinute: minute }
      }
    }
    if (midnight)
      for (const hut of this.hutsBefore)
        if (hut.logs > 0 && weathersOn(state, hut, day) && !state.lastHutEvents.some((made) => made.hutId === hut.id))
          fail(`hut ${hut.id} did not weather on its day`)
    for (const event of state.lastEvents) {
      if (!event.laidLog) continue
      const forager = state.foragers[event.foragerId]!
      if (!this.logBefore[forager.id] && !event.cutLog) fail(`forager ${forager.id} laid a log it did not carry`)
      const id = forager.hutId
      if (id === null) {
        fail(`forager ${forager.id} laid a log in no hut`)
        continue
      }
      const hut = huts[id] ?? {
        id,
        builderId: forager.id,
        x: event.position.x,
        y: event.position.y,
        logs: 0,
        begunMinute: minute,
        abandonedMinute: null,
      }
      if (hut.builderId !== forager.id || hut.x !== event.position.x || hut.y !== event.position.y)
        fail(`forager ${forager.id} laid a log away from its own hut`)
      if (event.position.x !== forager.hearth.x || event.position.y !== forager.hearth.y)
        fail(`forager ${forager.id} laid a log away from its hearth`)
      huts[id] = { ...hut, logs: hut.logs + 1 }
    }
    if (huts.length !== state.huts.length) fail('a hut appeared or vanished without a record')
    for (const hut of state.huts) {
      const replayed = huts[hut.id]
      if (!replayed || replayed.logs !== hut.logs || replayed.abandonedMinute !== hut.abandonedMinute)
        fail(`hut ${hut.id} changed without a record`)
      if (hut.logs < 0 || hut.logs > config.hutLogs) fail(`hut ${hut.id} holds ${hut.logs} logs`)
    }

    // Axes: made at the quality its maker's craft allows, worn by one log at each cut, and sold on the terms of both.
    const madeNow = new Set<number>()
    let nextId = totals.axesMade - state.lastAxeEvents.filter((made) => made.kind === 'made').length
    for (const made of state.lastAxeEvents) {
      if (made.kind === 'made') {
        const { axe } = made
        const craft = state.foragers[made.foragerId]!.craft
        if (axe.id !== nextId++) fail(`axe ${axe.id} is out of order`)
        if (made.craft !== craft || axe.quality < Math.max(1, Math.floor(craft / 2)) || axe.quality > craft)
          fail(`axe ${axe.id}'s quality is out of its maker's range`)
        if (
          axe.logsLeft !== axeLife(config, axe.quality) ||
          axe.makerId !== made.foragerId ||
          axe.madeMinute !== minute
        )
          fail(`axe ${axe.id} was made wrong`)
        madeNow.add(axe.id)
      } else if (made.kind === 'cut') {
        if (made.axeLogsLeft < 0 || made.treeLogsAfter < 0) fail(`a cut left a negative count`)
      } else if (made.kind === 'sale') {
        const seller = state.foragers[made.sellerId]!
        const buyer = state.foragers[made.buyerId]!
        const shares =
          (this.groupBefore[seller.id] ?? -1) === this.groupBefore[buyer.id] || seller.groupId === buyer.groupId
        if (!shares || seller.groupId === null) fail('an axe was sold across groups')
        if (made.ask !== askOf(config, seller.craft) || made.worth !== worthTo(config, buyer, made.axe.quality))
          fail('a sale is not at the two sides’ terms')
        if (made.worth <= made.ask || made.price !== salePrice(made.ask, made.worth))
          fail('a sale did not pay both sides')
        const fromSpare = sameAxe(this.spareBefore[seller.id] ?? null, made.axe) || madeNow.has(made.axe.id)
        if (!fromSpare) fail(`forager ${seller.id} sold an axe it did not hold as a spare`)
        if (this.axeBefore[buyer.id] && !madeNow.has(made.axe.id) && this.axeBefore[buyer.id]!.logsLeft > 0)
          if (sameAxe(buyer.axe, this.axeBefore[buyer.id]!)) fail(`forager ${buyer.id} bought an axe it did not take`)
      } else if (made.kind === 'promise') {
        const promiser = state.foragers[made.promiserId]!
        if (promiser.groupId === null || promiser.groupId !== state.foragers[made.askerId]!.groupId)
          if ((this.groupBefore[made.promiserId] ?? -1) !== this.groupBefore[made.askerId])
            fail('a promise crossed groups')
      }
    }
    // An axe a forager keeps changes only by cutting with it.
    for (const forager of state.foragers) {
      const before = this.axeBefore[forager.id]
      const axe = forager.axe
      if (!before || !axe || before.id !== axe.id) continue
      const cut = state.lastAxeEvents.find((made) => made.kind === 'cut' && made.foragerId === forager.id)
      const expected = cut ? before.logsLeft - 1 : before.logsLeft
      if (axe.logsLeft !== expected || axe.quality !== before.quality)
        fail(`forager ${forager.id}'s axe changed by itself`)
    }
  }

  /**
   * What a forager knows: places near where it stood are marked seen this minute exactly when they lay wholly within
   * sight, and stay seen; sites within sight are known, and are checked exactly when it stood close
   * enough to see all of them; a place or site it walked towards was worth exploring, checking or searching; and, in
   * full at midnight, plants never seen say so and its count of places seen is right.
   */
  private checkKnowledge(state: ValleyState, minute: number, full: boolean, fail: (message: string) => void) {
    const { config, layout } = state
    const n = placesPerSide(config)
    const r = sightOf(config, minute)
    for (const event of state.lastEvents) {
      const forager = state.foragers[event.foragerId]!
      const { from } = event
      this.checkSites(state, minute, event, fail)
      // A forager that had seen every place has nothing left to mark.
      const allSeen = this.placesSeenBefore[forager.id] === placeCount(config)
      const column0 = Math.max(0, Math.floor((from.x - r) / config.placeCm))
      const column1 = Math.min(n - 1, Math.floor((from.x + r) / config.placeCm))
      const row0 = Math.max(0, Math.floor((from.y - r) / config.placeCm))
      const row1 = Math.min(n - 1, Math.floor((from.y + r) / config.placeCm))
      if (!allSeen)
        for (let row = row0; row <= row1; row += 1)
          for (let column = column0; column <= column1; column += 1) {
            const place = row * n + column
            const inView = placeInView(config, place, from.x, from.y, r)
            const seen = forager.placeSeen[place]!
            const matches = (seen === minute ? inView : true) && (!inView || (seen >= 0 && seen <= minute))
            if (!matches) fail(`forager ${forager.id}'s memory of place ${place} does not match what it saw`)
          }
      if (event.placeId !== null) {
        if (!placeWanted(forager, event.placeId)) fail(`forager ${forager.id} walked to a place it did not need to see`)
        const centre = placeCentre(config, event.placeId)
        const before = distanceSq(from.x, from.y, centre.x, centre.y)
        if (distanceSq(event.position.x, event.position.y, centre.x, centre.y) > before)
          fail(`forager ${forager.id} walked away from the place it set out to see`)
      }
    }
    if (!full) return
    for (const forager of state.foragers) {
      for (const checked of forager.siteChecked)
        if (checked > minute || checked < -1) fail(`forager ${forager.id} remembers checking a site out of time`)
      let seenPlaces = 0
      for (const seen of forager.placeSeen) {
        if (seen > minute || seen < -1) fail(`forager ${forager.id} remembers a place out of time`)
        if (seen >= 0) seenPlaces += 1
      }
      if (seenPlaces !== forager.placesSeen || forager.placesSeen > placeCount(config))
        fail(`forager ${forager.id}'s count of places seen is wrong`)
      for (const [plants, memory] of [
        [layout.bushes, forager.bushMemory],
        [layout.trees, forager.treeMemory],
      ] as const)
        for (let id = 0; id < plants.count; id += 1) {
          const seen = memory.seen[id]!
          if (seen > minute || seen < -1 || (seen < 0 && memory.stock[id] !== 0))
            fail(`forager ${forager.id}'s memory of a plant it has never seen is not empty`)
        }
    }
  }

  /**
   * Each forager's hearth while it acted. A forager that joins or founds a group moves its hearth only after its own
   * action; one met by a forager without a group that founds a group at an earlier turn of the minute has its hearth
   * moved before it acts. The minute's foundings are replayed in turn order to find which.
   */
  private hearthsAtTurns(state: ValleyState): Point[] {
    const hearths = [...this.hearthBefore]
    const turnAt = this.turnAt
    for (const made of state.lastGroupEvents) {
      if (made.kind !== 'found') continue
      const [actor, met] = made.founderIds
      if (turnAt[actor]! < turnAt[met]!) hearths[met] = made.hearths[1]
    }
    return hearths
  }

  /**
   * Sites, for one forager's turn: every site whose centre lay within sight of where it stood is known, and only those
   * or sites known before; a site is marked checked this minute exactly when it stood within `checkRadius` of its
   * centre; and a site it walked towards was worth checking or searching, of the good it worked for, and it walked no
   * further from its centre.
   */
  private checkSites(
    state: ValleyState,
    minute: number,
    event: ValleyState['lastEvents'][number],
    fail: (message: string) => void,
  ) {
    const { config, layout } = state
    const forager = state.foragers[event.foragerId]!
    const { from } = event
    const sightSq = sightOf(config, minute) ** 2
    const before = this.siteKnownBefore[forager.id]!
    const { x, y, checkSq } = siteGeometry(config, layout)
    for (let site = 0; site < x.length; site += 1) {
      const dx = from.x - x[site]!
      const dy = from.y - y[site]!
      const sq = dx * dx + dy * dy
      const inSight = sq <= sightSq
      if (inSight && !forager.siteKnown[site]) fail(`forager ${forager.id} did not spot site ${site} in sight`)
      if (!inSight && forager.siteKnown[site] && !before[site])
        fail(`forager ${forager.id} spotted site ${site} out of sight`)
      if ((forager.siteChecked[site] === minute) !== sq <= checkSq[site]!)
        fail(`forager ${forager.id}'s check of site ${site} does not match where it stood`)
    }
    if (event.siteId === null) return
    const why = event.reason === 'searching' ? 'search' : 'check'
    if (event.reason !== 'searching' && event.reason !== 'checking' && event.reason !== 'seeking company')
      fail(`forager ${forager.id} walked to a site ${event.reason}`)
    if (!siteWanted(config, forager, event.siteId, minute, why))
      fail(`forager ${forager.id} walked to a site it did not need to ${why}`)
    if (why === 'search' && siteGood(config, event.siteId) !== event.workedFor)
      fail(`forager ${forager.id} searched a site of the wrong kind`)
    const centre = siteCentre(config, layout, event.siteId)
    const startSq = distanceSq(from.x, from.y, centre.x, centre.y)
    if (distanceSq(event.position.x, event.position.y, centre.x, centre.y) > startSq)
      fail(`forager ${forager.id} walked away from the site it set out for`)
  }

  /**
   * Groups: who belongs to which, how they met, where their hearths lie, and that no forager without a group is left
   * within talking distance of another at the end of its turn.
   */
  private checkGroups(state: ValleyState, fail: (message: string) => void) {
    const { config } = state
    // Where each forager stood at each turn of the minute, or null if it was dead: after its own turn once it has had
    // one, and where it started the minute before.
    const turnAt = this.turnAt
    const died = new Set(state.lastDeaths.map((death) => death.foragerId))
    const standing = (id: number, atTurn: number) => {
      const index = turnAt[id]!
      if (index < 0) return null
      const event = state.lastEvents[index]!
      if (index < atTurn) return died.has(id) ? null : event.position
      return event.from
    }
    const nearestAt = (id: number, atTurn: number, at: Point) => {
      let best: number | null = null
      let bestSq = config.talkRadiusCm ** 2
      for (const other of state.foragers) {
        if (other.id === id) continue
        const spot = standing(other.id, atTurn)
        if (!spot) continue
        const sq = distanceSq(at.x, at.y, spot.x, spot.y)
        if (sq < bestSq || (sq === bestSq && (best === null || other.id < best))) {
          best = other.id
          bestSq = sq
        }
      }
      return best
    }
    // The minute's foundings, joinings and dissolutions, replayed in order from each forager's group the minute before.
    const current = [...this.groupBefore]
    for (const made of state.lastGroupEvents) {
      if (made.kind === 'dissolve') {
        if (made.survivorId !== null) {
          if (current[made.survivorId] !== made.groupId) fail(`forager ${made.survivorId} survived a group not its own`)
          current[made.survivorId] = null
        }
        continue
      }
      const id = made.kind === 'found' ? made.founderIds[0] : made.foragerId
      const met = made.kind === 'found' ? made.founderIds[1] : made.metId
      const index = turnAt[id]!
      const at = state.lastEvents[index]!.position
      if (nearestAt(id, index, at) !== met)
        fail(`forager ${id} did not meet the nearest forager within talking distance`)
      if (current[id] !== null) fail(`forager ${id} joined a group though it had one`)
      current[id] = made.groupId
      if (made.kind === 'found') {
        const other = standing(met, index)!
        const flag = { x: Math.floor((at.x + other.x) / 2), y: Math.floor((at.y + other.y) / 2) }
        if (made.flag.x !== flag.x || made.flag.y !== flag.y)
          fail(`group ${made.groupId}'s flag is not at the midpoint`)
        if (current[met] !== null) fail(`forager ${met} founded a group though it had one`)
        current[met] = made.groupId
      } else if (current[met] !== made.groupId) fail(`forager ${id} joined a group the forager it met was not in`)
    }
    for (const forager of state.foragers) {
      const before = this.groupBefore[forager.id]
      if (current[forager.id] !== forager.groupId)
        fail(`forager ${forager.id} changed group without meeting or dissolving`)
      if (forager.groupId !== null) {
        const group = state.groups[forager.groupId]
        if (!group || !group.members.includes(forager.id)) fail(`forager ${forager.id} names a group it is not in`)
        else if (forager.alive) {
          if (group.dissolvedMinute !== null) fail(`forager ${forager.id} belongs to a dissolved group`)
          const hearth = hearthAround(config, group.flag, group.members.indexOf(forager.id))
          if (forager.hearth.x !== hearth.x || forager.hearth.y !== hearth.y)
            fail(`forager ${forager.id}'s hearth is not its slot around the flag`)
        }
      } else if (before === null && forager.hearth !== this.hearthBefore[forager.id])
        fail(`forager ${forager.id} moved its hearth without joining a group`)
    }
    for (const group of state.groups) {
      const living = livingMembers(state, group).length
      if (group.dissolvedMinute === null) {
        if (living < 2) fail(`group ${group.id} stands with ${living} living members`)
        for (const id of group.members) if (state.foragers[id]!.groupId !== group.id) fail(`forager ${id} left a group`)
      } else if (living > 0) fail(`dissolved group ${group.id} still has living members`)
    }
    // At the end of its turn, a forager without a group stands within talking distance of no living forager.
    for (const [index, event] of state.lastEvents.entries()) {
      if (event.groupId !== null || died.has(event.foragerId)) continue
      if (nearestAt(event.foragerId, index + 1, event.position) !== null)
        fail(`forager ${event.foragerId} is without a group beside another forager`)
    }
  }

  /**
   * Shared fires: each standing fire burns at the start of every night hour, exactly its hour's wood and only if it
   * held that much, and never by day; each gift comes from a member at its hearth, into its own group's fire, in the
   * amount the rule gives; the wood in every fire follows from its burning, its gifts and a dissolution's take-back;
   * and what groups and foragers record as given matches the gifts.
   */
  private checkFires(state: ValleyState, minute: number, fail: (message: string) => void) {
    const { config } = state
    const fireWood = state.groups.map((_, id) => this.fireWoodBefore[id] ?? 0)
    const hourStart = minute % 60 === 0
    const night = !isDaylight(config, minute)
    const burned = new Set<number>()
    for (const fire of state.lastFires) {
      if (!hourStart || !night) fail(`group ${fire.groupId}'s fire burned outside the start of a night hour`)
      if (burned.has(fire.groupId)) fail(`group ${fire.groupId}'s fire burned twice`)
      burned.add(fire.groupId)
      const before = fireWood[fire.groupId]!
      const burn = config.campfireWoodPerHour
      if (fire.lit !== before >= burn || fire.burned !== (fire.lit ? burn : 0))
        fail(`group ${fire.groupId}'s fire burned the wrong amount`)
      fireWood[fire.groupId] = before - fire.burned
      if (fire.fireWoodAfter !== fireWood[fire.groupId]) fail(`group ${fire.groupId}'s fire holds the wrong wood`)
    }
    if (hourStart && night)
      for (const group of state.groups) {
        const founded = group.foundedMinute < minute || group.id < this.startingGroups
        const stood = founded && (group.dissolvedMinute === null || group.dissolvedMinute >= minute)
        if (stood && !burned.has(group.id)) fail(`group ${group.id}'s fire was not tended this hour`)
        if (!stood && burned.has(group.id)) fail(`group ${group.id}'s fire burned while the group did not stand`)
      }
    // Gifts, in turn order, and then the dissolutions that followed deaths.
    const turnAt = this.turnAt
    const given = [...this.givenBefore]
    for (const feed of state.lastFeeds) {
      const event = state.lastEvents[turnAt[feed.foragerId]!]
      const group = state.groups[feed.groupId]!
      const slot = group.members.indexOf(feed.foragerId)
      if (!event || event.groupId !== feed.groupId || slot < 0)
        fail(`forager ${feed.foragerId} fed a fire not its group's`)
      else {
        const hearth = hearthAround(config, group.flag, slot)
        if (event.position.x !== hearth.x || event.position.y !== hearth.y)
          fail(`forager ${feed.foragerId} fed a fire away from its hearth`)
      }
      if (feed.fireWoodBefore !== fireWood[feed.groupId]) fail(`group ${feed.groupId}'s fire held other wood when fed`)
      if (feed.burnPerHour !== config.campfireWoodPerHour)
        fail(`group ${feed.groupId}'s fire burns the wrong amount an hour`)
      const amount = feedAmount(config, feed.woodBefore, feed.fireWoodBefore, feed.burnPerHour, minute)
      const right =
        feed.wood >= 1 &&
        feed.wood <= feed.woodBefore &&
        feed.wood === amount.wood &&
        feed.spareWood === amount.spareWood &&
        feed.low === amount.low
      if (!right) fail(`forager ${feed.foragerId} gave its fire the wrong amount`)
      fireWood[feed.groupId]! += feed.wood
      if (feed.fireWoodAfter !== fireWood[feed.groupId]) fail(`group ${feed.groupId}'s fire holds the wrong wood`)
      given[feed.foragerId]! += feed.wood
    }
    for (const made of state.lastGroupEvents) {
      if (made.kind !== 'dissolve') continue
      if (made.survivorId === null ? made.fireWood !== 0 : made.fireWood !== fireWood[made.groupId])
        fail(`group ${made.groupId}'s survivor took back other wood than its fire held`)
      if (made.survivorId !== null) fireWood[made.groupId] = 0
    }
    for (const group of state.groups) {
      if (group.fireWood !== fireWood[group.id]) fail(`group ${group.id}'s fire wood changed without a record`)
      if (group.given.length !== group.members.length) fail(`group ${group.id}'s record of gifts has the wrong length`)
      const total = group.given.reduce((a, b) => a + b, 0)
      if (group.dissolvedMinute === null && total !== group.fireBurned + group.fireWood)
        fail(`group ${group.id}'s record of gifts does not match its fire`)
    }
    for (const forager of state.foragers)
      if (forager.fireGiven !== given[forager.id]) fail(`forager ${forager.id}'s gifts to fires do not add up`)
  }

  /** Checks the minute just run and throws on the first violations found. */
  assert(state: ValleyState) {
    const violations = this.check(state)
    if (violations.length) throw new Error(`Valley invariants violated: ${violations.slice(0, 5).join('; ')}`)
  }
}
