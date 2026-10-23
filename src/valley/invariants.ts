import { askOf, axeLife, salePrice, worthTo } from './axes'
import { feedAmount } from './fire'
import { FOODS, capacityOf, foodOfSource, fullRateOf, rateAtStock, spoiledBy, worthWorking } from './food'
import { MINUTES_PER_DAY, isDaylight, loadKg, minuteOfWork, plantsInView, speedForLoad } from './forager'
import { distance, distanceSq, stepTowards } from './geometry'
import { regrowsAt, weathersOn } from './huts'
import { fishGrowth, fishRate, type FishStock } from './fish'
import { waterViolations } from './water'
import { waterSecond, type Hydration } from './hydration'
import { knownDrySegment, knownDryFootprint } from './legacyRoutes'
import { WaterKnowledgeChecker } from './waterKnowledgeChecker'
import { BUSH_GROUNDS, HAZEL_GROUNDS, TREE_GROUNDS, forEachPlantWithin, onGround } from './layout'
import { craftOf, ratesOf } from './practice'
import { placeOf, viewFrom, type PlaceView } from './sight'
import { hearthAround, livingMembers, placeCount, placeInView, placeWanted, placesPerSide } from './social'
import { siteGeometry, siteHolds, siteWanted } from './sites'
import { STONE, cellOf, gradeOf, heightAt, speedOnGrade, terrainPercentOf, walkCost } from './terrain'
import { bothGain } from './trade'
import { coldMatters, sleepCostOf, regrowthOf, warmthOf, workCostOf } from './work'
import type { ActionReason, Axe, CutEvent, Hut, Point, ValleyState } from './types'

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

/** Every way the layout breaks the ground's rules: a site's centre, plant or stone off its ground, or a start on stone. */
export function layoutViolations(state: ValleyState): string[] {
  const { config, layout } = state
  const { terrain, ground } = layout
  const violations: string[] = []
  const kinds = [
    [layout.thickets, layout.bushes, BUSH_GROUNDS, 'berry bush'],
    [layout.hazelThickets, layout.hazels, HAZEL_GROUNDS, 'hazel'],
    [layout.stands, layout.trees, TREE_GROUNDS, 'tree'],
  ] as const
  for (const [centres, plants, grounds, name] of kinds) {
    for (const [id, centre] of centres.entries())
      if (!onGround(terrain, ground, centre.x, centre.y, grounds))
        violations.push(`The site of ${name} ${id} lies on the wrong ground`)
    for (let id = 0; id < plants.count; id += 1)
      if (!onGround(terrain, ground, plants.x[id]!, plants.y[id]!, grounds))
        violations.push(`A ${name}, ${id}, grows on the wrong ground`)
  }
  for (let id = 0; id < layout.stones.count; id += 1)
    if (ground[cellOf(terrain, layout.stones.x[id]!, layout.stones.y[id]!)] !== STONE)
      violations.push(`Stone spot ${id} lies off stone`)
  if (config.outcropCount && !layout.outcrops.every((centre) => ground[cellOf(terrain, centre.x, centre.y)] === STONE))
    violations.push('An outcrop does not lie on stone')
  for (const [id, hearth] of layout.hearths.entries())
    if (ground[cellOf(terrain, hearth.x, hearth.y)] === STONE) violations.push(`Forager ${id} starts on stone`)
  return violations
}

/**
 * Checks every invariant of the specification after every minute of a run. It keeps its own copy of every plant's
 * stock and replays each minute's regrowth and recorded work onto it, so a stock that changed without a record, or a
 * record that does not match the stock, is caught: the plants worked are compared every minute and every plant every
 * hour. Plants in a forager's view are checked against its memory in full in the first minute of every hour, and the
 * plant it worked or walked towards every minute.
 */
export class ValleyChecker {
  private knowledge: WaterKnowledgeChecker
  private withdrawals: Map<number, number>
  private fishMemories: ValleyState['foragers'][number]['fishMemory'][]
  private fish: Map<number, FishStock>
  private waterBefore: Hydration[]
  /** Every food plant's berries or nuts, every wood plant's wood, and the lake's fish and growth owed, replayed. */
  private food: Int32Array
  private trees: Int32Array
  private foodTotal: number
  private treeTotal: number
  private lake: number
  private aliveBefore: boolean[]
  private burnHour: number[]
  /** Each forager's rates at full sources the minute before: berries, nuts, fish and wood. */
  private rates: [number, number, number, number][]
  private turns: Int32Array
  private practised: Int32Array
  /** Each forager's group and hearth at the end of the minute before. */
  private groupBefore: (number | null)[]
  private hearthBefore: Point[]
  /** Each forager's trip wood, places seen and sites known at the end of the minute before. */
  private tripWoodBefore: number[]
  /** Each forager's remainder of energy owed, in 3,600ths, at the end of the minute before. */
  private costRemainderBefore: number[]
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
  /** Every tree's logs and the minute it was felled, and every stone spot's stones, replayed from regrowth and work. */
  private treeLogs: Int32Array
  private felled: Int32Array
  private stones: Int32Array
  /** Each forager's log, craft, axe and spare at the end of the minute before, and every hut. */
  private logBefore: number[]
  private craftBefore: number[]
  private axeBefore: (Axe | null)[]
  private spareBefore: (Axe | null)[]
  private hutsBefore: Hut[]
  /** Each forager's place and minute it last looked round from by long sight, at the end of the minute before. */
  private farPlaceBefore: number[]
  private farMinuteBefore: number[]
  /** Sites seen by long sight in the turn being checked, marked by ID. */
  private farSites = new Uint8Array(0)
  /** Breaches of the layout's rules, found once and reported at the first check. */
  private layoutViolations: string[]

  constructor(state: ValleyState) {
    this.knowledge = new WaterKnowledgeChecker(state)
    this.withdrawals = new Map(state.waterWithdrawals)
    this.fishMemories = state.foragers.map((person) => new Map(person.fishMemory))
    this.fish = new Map(state.fish.map((stock) => [stock.bodyId, { ...stock }]))
    this.waterBefore = state.foragers.map((person) => ({ ...person }))
    this.farPlaceBefore = state.foragers.map((forager) => forager.farPlace)
    this.farMinuteBefore = state.foragers.map((forager) => forager.farMinute)
    this.layoutViolations = [...layoutViolations(state), ...waterViolations(state.layout.terrain.water)]
    this.food = state.foodStock.slice()
    this.trees = state.woodStock.slice()
    this.foodTotal = sum(this.food)
    this.lake = state.fishKcal
    this.treeTotal = sum(this.trees)
    this.aliveBefore = state.foragers.map((forager) => forager.alive)
    this.burnHour = state.foragers.map(() => -1)
    this.rates = state.foragers.map((forager) => [
      forager.forageRate,
      forager.nutRate,
      forager.fishRate,
      forager.woodRate,
    ])
    this.turns = new Int32Array(state.foragers.length)
    this.practised = new Int32Array(state.foragers.length)
    this.groupBefore = state.foragers.map((forager) => forager.groupId)
    this.hearthBefore = state.foragers.map((forager) => forager.hearth)
    this.tripWoodBefore = state.foragers.map((forager) => forager.tripWood)
    this.costRemainderBefore = state.foragers.map((forager) => forager.costRemainder)
    this.placesSeenBefore = state.foragers.map((forager) => forager.placesSeen)
    this.siteKnownBefore = state.foragers.map((forager) => forager.siteKnown.slice())
    this.fireWoodBefore = state.groups.map((group) => group.fireWood)
    this.givenBefore = state.foragers.map((forager) => forager.fireGiven)
    this.litNow = state.groups.map((group) => group.fireLit)
    this.startingGroups = state.minute === 0 ? state.groups.length : 0
    this.treeLogs = state.treeLogs.slice()
    this.felled = state.treeFelledMinute.slice()
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

    // At midnight, a stump felled long enough ago stands again whole.
    if (minute > 0 && minute % MINUTES_PER_DAY === 0)
      for (let id = 0; id < this.treeLogs.length; id += 1)
        if (regrowsAt(config, this.felled[id]!, this.treeLogs[id]!, minute)) {
          this.treeLogs[id] = config.logsPerTree
          this.felled[id] = -1
        }

    if (minute > 0 && minute % 60 === 0) {
      const { berries, nuts, branches, sticks } = regrowthOf(config, minute / 60)
      // Food plants: berries on bushes, then nuts on hazels, each up to its capacity; and the lake's fish.
      const bushes = layout.bushes.count
      for (let id = 0; id < this.food.length; id += 1) {
        const after =
          id < bushes
            ? Math.min(config.bushCapacityKcal, this.food[id]! + berries)
            : Math.min(config.hazelCapacityKcal, this.food[id]! + nuts)
        this.foodTotal += after - this.food[id]!
        this.food[id] = after
      }
      for (const stock of this.fish.values()) {
        const grown = fishGrowth(stock.capacity, stock.stock, stock.remainder, config.fishGrowthPercentPerYear)
        stock.stock += grown.grown
        stock.remainder = grown.remainder
        stock.grown += grown.grown
        this.lake += grown.grown
      }
      // Wood plants: branches on standing trees, where a crown above capacity keeps what it has, then sticks on bushes.
      const trees = layout.trees.count
      for (let id = 0; id < this.trees.length; id += 1) {
        const before = this.trees[id]!
        let after = before
        if (id >= trees) after = Math.min(config.bushCapacityWood, before + sticks)
        else if (this.felled[id]! < 0 && before < config.treeCapacityWood)
          after = Math.min(config.treeCapacityWood, before + branches)
        this.treeTotal += after - before
        this.trees[id] = after
      }
    }

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
    const touchedFood: number[] = []
    const touchedTrees: number[] = []
    const fullView = minute % 60 === 0
    const daylight = isDaylight(config, minute)
    const reach2 = config.reachCm ** 2
    const hearthAtTurn = this.hearthsAtTurns(state)
    const cuts = new Map<number, CutEvent>()
    for (const made of state.lastAxeEvents) if (made.kind === 'cut') cuts.set(made.foragerId, made)
    for (const event of state.lastEvents) {
      const forager = state.foragers[event.foragerId]!
      this.knowledge.check(state, event, fail)
      const { from, position } = event
      const total =
        event.walkSeconds + event.workSeconds + event.standSeconds + event.sleepSeconds + event.inactiveSeconds
      if (total !== 60) fail(`forager ${forager.id}'s seconds add up to ${total}`)
      if (position.x < 0 || position.y < 0 || position.x > config.valleySizeCm || position.y > config.valleySizeCm)
        fail(`forager ${forager.id} left the valley`)
      // It walks at the speed its load allows as it sets out, and its load is no more than the wood of its trip.
      const tripWood = this.tripWoodBefore[forager.id]!
      const logBefore = this.logBefore[forager.id]!
      const load = {
        wood: event.loadWood,
        berriesKcal: event.loadBerriesKcal,
        nutsKcal: event.loadNutsKcal,
        fishKcal: event.loadFishKcal,
        log: event.loadLog,
      }
      if (
        load.wood < 0 ||
        load.wood > tripWood ||
        load.berriesKcal < 0 ||
        load.nutsKcal < 0 ||
        load.fishKcal < 0 ||
        load.log !== logBefore
      )
        fail(`forager ${forager.id} carries a load it did not have`)
      const kg = loadKg(config, load)
      const loadSpeed = speedForLoad(config, kg)
      if (event.loadSpeedCmPerSecond !== loadSpeed)
        fail(`forager ${forager.id} walks at a speed its load does not allow`)
      const { terrain } = layout
      let previous = from
      let elapsed = 0
      let climb = 0
      let energyOwed = this.costRemainderBefore[forager.id]!
      for (const segment of event.segments) {
        const ahead = stepTowards(segment.from, segment.target, (60 - elapsed) * loadSpeed)
        const grade = gradeOf(
          heightAt(terrain, ahead.x, ahead.y) - heightAt(terrain, segment.from.x, segment.from.y),
          distance(segment.from.x, segment.from.y, ahead.x, ahead.y),
        )
        const expectedGround = terrainPercentOf(config, layout.ground[cellOf(terrain, segment.from.x, segment.from.y)]!)
        const endpoint = stepTowards(segment.from, segment.target, segment.seconds * segment.speed)
        if (
          previous.x !== segment.from.x ||
          previous.y !== segment.from.y ||
          endpoint.x !== segment.to.x ||
          endpoint.y !== segment.to.y ||
          !Number.isInteger(segment.seconds) ||
          segment.seconds <= 0 ||
          segment.grade !== grade ||
          segment.speed !== speedOnGrade(loadSpeed, grade) ||
          segment.terrainPercent !== expectedGround ||
          segment.rate !== walkCost(config, kg, segment.speed, grade, expectedGround) ||
          !knownDrySegment(forager.groundKnowledge, segment.from, segment.to)
        )
          fail(
            `forager ${forager.id} has an invalid movement segment or paid for a minute that cost a different amount`,
          )
        for (let second = elapsed; second < elapsed + segment.seconds; second += 1)
          if (event.bodySeconds[second]?.rate !== segment.rate) fail('Walking seconds have the wrong energy rate')
        elapsed += segment.seconds
        climb += Math.max(
          0,
          heightAt(terrain, segment.to.x, segment.to.y) - heightAt(terrain, segment.from.x, segment.from.y),
        )
        previous = segment.to
      }
      if (
        elapsed !== event.walkSeconds ||
        previous.x !== position.x ||
        previous.y !== position.y ||
        climb !== event.climbCm
      )
        fail(`forager ${forager.id}'s movement does not match its segments: moved further than it walked`)
      const lastSegment = event.segments.at(-1)
      if (
        event.gradePercent !== (lastSegment?.grade ?? 0) ||
        event.speedCmPerSecond !== (lastSegment?.speed ?? loadSpeed)
      )
        fail(`forager ${forager.id} walks at a grade or speed the land does not give`)
      const body = { ...this.waterBefore[forager.id]! }
      let loss = 0
      let drunk = 0
      let paid = 0
      let fatalSecond = -1
      for (const [second, record] of event.bodySeconds.entries()) {
        if (fatalSecond >= 0) fail('A dead person continued losing water')
        const expectedRate =
          second < event.walkSeconds
            ? record.rate
            : second < event.walkSeconds + event.workSeconds
              ? workCostOf(config, event.workedFor, event.task)
              : event.sleepSeconds
                ? sleepCostOf(config, event.warmth)
                : config.restKcalPerHour
        if (record.rate !== expectedRate) fail('Action second has the wrong energy rate')
        const replay = waterSecond(config, body, expectedRate, record.drink > 0)
        if (record.deficitMl !== body.waterDeficitMl || record.thirsty !== body.thirsty)
          fail('Invalid second-resolved water state')
        if (record.drink !== replay.drink || record.loss !== replay.loss) fail('Invalid drinking or water-loss record')
        if (record.drink) {
          const bank = event.drinkBankId === null ? undefined : forager.knownBanks.get(event.drinkBankId)
          if (
            !bank ||
            second < event.walkSeconds ||
            event.workSeconds ||
            distanceSq(position.x, position.y, bank.x, bank.y) > config.reachCm ** 2 ||
            state.layout.terrain.water.bodies[state.layout.terrain.water.body[bank.wetCell]!]!.id !== bank.bodyId
          )
            fail('Drinking without bank access')
        }
        if (replay.fatal) fatalSecond = second
        energyOwed += expectedRate
        loss += record.loss
        drunk += record.drink
        paid += record.spent
      }
      if (
        event.bodySeconds.length !== 60 - event.inactiveSeconds ||
        event.waterLostMl !== loss ||
        event.waterDrunkMl !== drunk ||
        paid !== event.spentKcal ||
        forager.costRemainder !== energyOwed % 3600 ||
        (forager.alive && paid !== Math.floor(energyOwed / 3600))
      )
        fail('Invalid body time or accounting: paid for a minute that cost a different amount')
      for (const key of [
        'waterDeficitMl',
        'waterBaseRemainder',
        'waterActivityRemainder',
        'waterLostMl',
        'waterDrunkMl',
        'thirsty',
      ] as const)
        if (body[key] !== forager[key]) fail(`Body water mismatch: ${key}`)
      if (
        fatalSecond >= 0 &&
        (forager.alive || forager.deathSecond !== fatalSecond || !forager.deathCauses.includes('dehydration'))
      )
        fail('Invalid dehydration death record')
      this.waterBefore[forager.id] = body
      if (
        event.waterDeficitBeforeMl + event.waterLostMl - event.waterDrunkMl !== event.waterDeficitAfterMl ||
        event.waterDeficitAfterMl !== forager.waterDeficitMl
      )
        fail('Invalid turn water balance')
      if (!forager.alive) {
        const death = state.lastDeaths.find((record) => record.foragerId === forager.id)
        if (
          !death ||
          death.minute !== minute ||
          death.second !== event.bodySeconds.length - 1 ||
          death.second !== forager.deathSecond ||
          forager.deathMinute !== minute ||
          death.cause !== forager.deathCauses.join(' and ') ||
          forager.deathCauses.includes('dehydration') !== fatalSecond >= 0 ||
          forager.deathCauses.includes('starvation') !== (forager.energyKcal === 0)
        )
          fail('Invalid body death record')
      } else if (
        event.inactiveSeconds ||
        forager.deathMinute !== null ||
        forager.deathSecond !== null ||
        forager.deathCauses.length
      )
        fail('A living person has a death record or inactive seconds')
      if (event.waterDrunkMl) {
        const bank = forager.knownBanks.get(event.drinkBankId!)
        if (bank) this.withdrawals.set(bank.bodyId, (this.withdrawals.get(bank.bodyId) ?? 0) + event.waterDrunkMl)
      }
      // Not hungry, a forager with a full load takes it home before anything else; and only then does it say so.
      const fullLoad = config.woodLoad > 0 && tripWood >= config.woodLoad
      if (event.reason === 'taking a load home') {
        if (!fullLoad) fail(`forager ${forager.id} took home a load it was not carrying`)
      } else if (fullLoad && !forager.hungry && (IDLE_REASONS.has(event.reason) || HUT_REASONS.has(event.reason)))
        fail(`forager ${forager.id} is ${event.reason} with a full load`)
      // A forager carrying a log takes it home before anything else.
      if (event.reason === 'taking a log home') {
        if (!logBefore) fail(`forager ${forager.id} took home a log it was not carrying`)
      } else if (
        logBefore &&
        daylight &&
        forager.alive &&
        !['going home', 'seeking water', 'drinking', 'no known route'].includes(event.reason)
      )
        fail(`forager ${forager.id} is ${event.reason} carrying a log`)
      const forFood = event.workedFor === 'food'
      const plants = forFood ? layout.foodPlants : layout.woodPlants
      const stocks = forFood ? this.food : this.trees
      const memory = forFood ? forager.foodMemory : forager.woodMemory
      // What it remembers matches what it saw at the start of its turn, before its own work. Fish cannot be seen.
      const target = event.targetId
      if (
        target !== null &&
        target >= 0 &&
        (plants.x[target]! - from.x) ** 2 + (plants.y[target]! - from.y) ** 2 <= config.perceptionRadiusCm ** 2 &&
        (memory.seen[target] !== minute || memory.stock[target] !== stocks[target])
      )
        fail(`forager ${forager.id}'s memory of its target does not match what it saw`)
      if (fullView) {
        for (const [kindPlants, kindIndex, kindStocks, kindMemory] of [
          [layout.foodPlants, layout.foodIndex, this.food, forager.foodMemory],
          [layout.woodPlants, layout.woodIndex, this.trees, forager.woodMemory],
        ] as const) {
          for (const id of plantsInView(config, kindIndex, kindPlants, from.x, from.y)) {
            if (kindMemory.seen[id] !== minute || kindMemory.stock[id] !== kindStocks[id])
              fail(`forager ${forager.id}'s memory of a plant in view does not match what it saw`)
          }
        }
      }
      // Logs and stones are seen every minute by close sight, and by long sight from its place when it looks round.
      const view = this.lookedRound(state, forager.id, from, minute, fail)
      for (const [kindPlants, kindIndex, kindStocks, kindMemory, far] of [
        [layout.trees, layout.treeIndex, this.treeLogs, forager.logMemory, view?.trees],
        [layout.stones, layout.stoneIndex, this.stones, forager.stoneMemory, view?.stones],
      ] as const) {
        const matches = (id: number) => {
          if (kindMemory.seen[id] !== minute || kindMemory.stock[id] !== kindStocks[id])
            fail(`forager ${forager.id}'s memory of logs or stones in sight does not match what it saw`)
        }
        forEachPlantWithin(kindIndex, kindPlants, from.x, from.y, config.perceptionRadiusCm, matches)
        if (far) for (const id of far) matches(id)
      }
      if (event.task) {
        if (event.workSeconds && !daylight) fail(`forager ${forager.id} worked at night`)
        if (event.plantId !== null || event.gatheredKcal || event.gatheredWood)
          fail(`forager ${forager.id} picked or gathered while working for its hut`)
        const cut = cuts.get(forager.id)
        const cutTree = cut?.treeId
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
          if (cut) {
            // The first log cut from a standing tree fells it, bringing its crown's branches down.
            const standing = this.felled[cut.treeId]! < 0
            if (cut.felled !== standing || event.felled !== cut.felled)
              fail(`forager ${forager.id}'s cut felled a tree that was down, or left one standing`)
            if (standing && this.treeLogs[cut.treeId] !== config.logsPerTree)
              fail(`tree ${cut.treeId} stood without every log`)
            if (standing) {
              this.felled[cut.treeId] = minute
              this.trees[cut.treeId]! += config.fellWood
              this.treeTotal += config.fellWood
              touchedTrees.push(cut.treeId)
            }
            this.treeLogs[cut.treeId]! -= 1
          } else if (event.felled) fail(`forager ${forager.id} felled a tree without cutting a log`)
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
      } else if (event.cutLog || event.felled || event.tookStone || cuts.has(forager.id))
        fail(`forager ${forager.id} cut a log or took a stone without working for its hut`)
      else if (event.workSeconds) {
        if (!daylight) fail(`forager ${forager.id} worked at night`)
        if (event.plantId === null) fail(`forager ${forager.id} worked no plant`)
        else if (forFood) this.checkFoodWork(state, event, minute, fail, touchedFood)
        else {
          const id = event.plantId
          if ((plants.x[id]! - position.x) ** 2 + (plants.y[id]! - position.y) ** 2 > reach2)
            fail(`forager ${forager.id} worked a plant out of reach`)
          if (stocks[id]! < minuteOfWork(forager.woodRate))
            fail(`forager ${forager.id} worked a plant holding less than a minute's work`)
          const taken = event.gatheredWood
          if (event.gatheredKcal || taken > stocks[id]!) fail(`forager ${forager.id} took more than the plant held`)
          stocks[id]! -= taken
          this.treeTotal -= taken
          touchedTrees.push(id)
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
        // How warm it slept names its hut, and it slept cold only with neither fire nor hut.
        if (event.warmth === null || (event.warmth === 'fire and hut' || event.warmth === 'hut') !== event.inHut)
          fail(`forager ${forager.id}'s warmth does not match its hut`)
        if (event.sleptCold !== (event.warmth === 'cold' && coldMatters(config)))
          fail(`forager ${forager.id} slept cold at another warmth`)
        if (event.burnedWood && event.warmth !== 'fire' && event.warmth !== 'fire and hut')
          fail(`forager ${forager.id} burned wood and slept without its fire`)
      } else if (event.inHut || event.warmth !== null) fail(`forager ${forager.id} is in its hut, or warm, awake`)
      if (
        !daylight &&
        forager.alive &&
        event.reason !== 'going home' &&
        event.reason !== 'night' &&
        !['seeking water', 'drinking', 'no known route'].includes(event.reason)
      )
        fail(`forager ${forager.id} is up at night`)
      if (event.fireGroupId !== null) {
        // A member asleep by its group's fire burns no wood of its own, and is warm exactly when the fire is lit or it
        // sleeps in its whole hut.
        if (!event.sleepSeconds) fail(`forager ${forager.id} slept by a group's fire it could not`)
        // It may have been met by a founder at an earlier turn of the minute, or joined at its own.
        if (this.groupBefore[forager.id] !== event.fireGroupId && forager.groupId !== event.fireGroupId)
          fail(`forager ${forager.id} slept by another group's fire`)
        if (event.burnedWood) fail(`forager ${forager.id} burned its own wood beside its group's fire`)
        if (event.warmth !== warmthOf(this.litNow[event.fireGroupId] ?? false, event.inHut))
          fail(`forager ${forager.id}'s warmth does not match its group's fire and its hut`)
      } else if (event.sleepSeconds && this.groupBefore[forager.id] !== null) {
        if (this.groupBefore[forager.id] === forager.groupId)
          fail(`forager ${forager.id} slept by its own fire while in a group`)
      }
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
    for (let id = 0; id < this.treeLogs.length; id += 1) {
      if (state.treeLogs[id] !== this.treeLogs[id])
        fail(`tree ${id} holds ${state.treeLogs[id]} logs, not ${this.treeLogs[id]}`)
      if (state.treeFelledMinute[id] !== this.felled[id]) fail(`tree ${id} fell or stood again without a record`)
    }
    for (let id = 0; id < this.stones.length; id += 1)
      if (state.stoneStock[id] !== this.stones[id]) fail(`stone spot ${id} holds the wrong stones`)
    for (const id of touchedFood)
      if (state.foodStock[id] !== this.food[id])
        fail(`food plant ${id} holds ${state.foodStock[id]}, not ${this.food[id]}`)
    if (state.fishKcal !== this.lake) fail(`Fish total holds ${state.fishKcal} kcal, not ${this.lake}`)
    for (const stock of state.fish) {
      const expected = this.fish.get(stock.bodyId)
      if (
        !expected ||
        stock.stock !== expected.stock ||
        stock.remainder !== expected.remainder ||
        stock.grown !== expected.grown ||
        stock.caught !== expected.caught ||
        stock.capacity !== expected.capacity ||
        stock.capacity + stock.grown - stock.caught !== stock.stock
      )
        fail(`Invalid fish stock ${stock.bodyId}`)
    }
    if (state.fish.length !== this.fish.size) fail('Missing or duplicated fish bodies')
    if (state.waterWithdrawals.size !== this.withdrawals.size) fail('Unrecorded water source withdrawal')
    for (const [body, volume] of this.withdrawals)
      if (state.waterWithdrawals.get(body) !== volume) fail('Water withdrawals do not match their recorded source')
    if (
      [...state.waterWithdrawals.values()].reduce((a, b) => a + b, 0) !==
      state.foragers.reduce((a, b) => a + b.waterDrunkMl, 0)
    )
      fail('External water withdrawals do not match drinking')
    // Work only ever takes, and regrowth stops at capacity, so every stock the replay holds stays in range.
    for (const id of touchedTrees)
      if (state.woodStock[id] !== this.trees[id]) fail(`tree ${id} holds ${state.woodStock[id]}, not ${this.trees[id]}`)
    if (minute % 60 === 0) {
      for (let id = 0; id < this.food.length; id += 1)
        if (state.foodStock[id] !== this.food[id]) fail(`food plant ${id} changed without a record`)
      for (let id = 0; id < this.trees.length; id += 1)
        if (state.woodStock[id] !== this.trees[id]) fail(`tree ${id} changed without a record`)
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
    const held = this.foodTotal + this.lake + reserves + carried + totals.metabolizedKcal + totals.spoiledKcal
    const supplied = totals.initialKcal + totals.regrownKcal + totals.fishGrownKcal
    if (held !== supplied) fail(`energy is not conserved: ${held} held, ${supplied} supplied`)
    let fireWood = 0
    for (const group of state.groups) fireWood += group.fireWood
    if (
      this.treeTotal + wood + fireWood + totals.burnedWood + totals.axeWood !==
      totals.initialWood + totals.regrownWood + totals.fellenWood
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
      if (config.initialWaterDeficitMl + forager.waterLostMl - forager.waterDrunkMl !== forager.waterDeficitMl)
        fail('Body water is not conserved')
      for (const amount of [forager.waterDeficitMl, forager.waterLostMl, forager.waterDrunkMl])
        if (!Number.isSafeInteger(amount) || amount < 0) fail('Body water exceeds supported integer limits')
      if (!forager.alive && forager.energyKcal !== 0 && !forager.deathCauses.includes('dehydration'))
        fail(`forager ${forager.id} is dead but has a reserve without dehydration`)
      if (!inRemainderRange(forager.pickRemainder) || !inRemainderRange(forager.gatherRemainder))
        fail(`forager ${forager.id} has a remainder out of range`)
      if (!inRemainderRange(forager.costRemainder)) fail(`forager ${forager.id} has a remainder out of range`)
      if (!Number.isInteger(forager.wood) || forager.wood < 0) fail(`forager ${forager.id} holds ${forager.wood} wood`)
      // Carried lots are checked one by one every hour, and every minute at their ends: the oldest must not have
      // spoiled and the newest must not be from the future.
      const lots = forager.carried
      if (lots.length) {
        for (const lot of fullView ? lots : [lots[0]!, lots[lots.length - 1]!]) {
          if (!Number.isInteger(lot.kcal) || lot.kcal <= 0 || !FOODS.includes(lot.food))
            fail(`forager ${forager.id} carries a lot of ${lot.kcal} kcal of ${lot.food}`)
          if (lot.harvestTick > minute) fail(`forager ${forager.id} carries food picked in the future`)
          if (forager.alive && spoiledBy(config, lot, minute))
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
          if (
            expected.forageRate !== forager.forageRate ||
            expected.nutRate !== forager.nutRate ||
            expected.fishRate !== forager.fishRate ||
            expected.woodRate !== forager.woodRate
          )
            fail(`forager ${forager.id}'s rates do not follow from its skills and practice`)
          if (forager.craft !== craftOf(config, forager.craftSkill, log))
            fail(`forager ${forager.id}'s craft does not follow from its skill and practice`)
        }
      } else if (
        forager.forageRate !== rates[0] ||
        forager.nutRate !== rates[1] ||
        forager.fishRate !== rates[2] ||
        forager.woodRate !== rates[3]
      )
        fail(`forager ${forager.id}'s rates changed mid-day`)
      else if (forager.craft !== this.craftBefore[forager.id]) fail(`forager ${forager.id}'s craft changed mid-day`)
      rates[0] = forager.forageRate
      rates[1] = forager.nutRate
      rates[2] = forager.fishRate
      rates[3] = forager.woodRate
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
    this.costRemainderBefore = state.foragers.map((forager) => forager.costRemainder)
    this.placesSeenBefore = state.foragers.map((forager) => forager.placesSeen)
    for (const forager of state.foragers) this.siteKnownBefore[forager.id]!.set(forager.siteKnown)
    this.fireWoodBefore = state.groups.map((group) => group.fireWood)
    this.givenBefore = state.foragers.map((forager) => forager.fireGiven)
    this.logBefore = state.foragers.map((forager) => forager.log)
    this.craftBefore = state.foragers.map((forager) => forager.craft)
    this.axeBefore = state.foragers.map((forager) => forager.axe)
    this.spareBefore = state.foragers.map((forager) => forager.spareAxe)
    this.hutsBefore = [...state.huts]
    this.farPlaceBefore = state.foragers.map((forager) => forager.farPlace)
    this.farMinuteBefore = state.foragers.map((forager) => forager.farMinute)
    if (this.layoutViolations.length) {
      violations.push(...this.layoutViolations)
      this.layoutViolations = []
    }
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
    let lying = 0
    for (const stones of state.stoneStock) lying += stones
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
    if (lying + heldStones + totals.stonesWorked !== totals.initialStones) fail('stones are not conserved')
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
   * Work for food at a bush, a hazel or the shore: within reach of it, while it is worth working at the rate its stock
   * gives, taking no more than that rate allows over the seconds worked, with the remainder carried, and no more than
   * the source holds. The source's stock is replayed.
   */
  private checkFoodWork(
    state: ValleyState,
    event: ValleyState['lastEvents'][number],
    minute: number,
    fail: (message: string) => void,
    touchedFood: number[],
  ) {
    const { config, layout } = state
    const forager = state.foragers[event.foragerId]!
    const id = event.plantId!
    const lake = id < 0
    const bank = lake ? forager.knownBanks.get(-id - 1) : undefined
    const fish = bank ? this.fish.get(bank.bodyId) : undefined
    const food = foodOfSource(layout, id)
    const { position } = event
    const reach2 = config.reachCm ** 2
    const sq = lake
      ? bank
        ? distanceSq(position.x, position.y, bank.x, bank.y)
        : Infinity
      : (layout.foodPlants.x[id]! - position.x) ** 2 + (layout.foodPlants.y[id]! - position.y) ** 2
    if (sq > reach2) fail(`forager ${forager.id} worked for food out of reach`)
    if (event.food !== food) fail(`forager ${forager.id} took ${event.food} from a source of ${food}`)
    const stock = lake ? (fish?.stock ?? 0) : this.food[id]!
    if (event.sourceStockBefore !== stock) fail(`forager ${forager.id} found a stock that was not there`)
    const rate = lake
      ? fishRate(forager.fishRate, stock, fish?.capacity ?? 0)
      : rateAtStock(config, fullRateOf(forager, food), food, stock)
    if (
      !worthWorking(config, rate) &&
      !(lake && event.workSeconds === 1 && worthWorking(config, event.fishExpectedRate))
    )
      fail(`forager ${forager.id} worked a source not worth working`)
    if (lake && bank && fish) {
      const previous = this.fishMemories[forager.id]!.get(bank.bodyId)
      const expected = previous ? fishRate(forager.fishRate, previous.stock, previous.capacity) : forager.fishRate
      if (event.fishExpectedRate !== expected || event.fishBodyId !== bank.bodyId || event.fishBankId !== bank.id)
        fail('A fishing attempt used hidden stock or the wrong body')
      const memory = forager.fishMemory.get(bank.bodyId)
      if (!memory || memory.stock !== stock || memory.capacity !== fish.capacity || memory.minute !== minute)
        fail('Fish memory did not come from the attempted body')
      this.fishMemories[forager.id]!.set(bank.bodyId, { stock, capacity: fish.capacity, minute })
    }
    if (stock > (lake ? (fish?.capacity ?? 0) : capacityOf(config, food)))
      fail(`a source of ${food} holds more than it can`)
    const taken = event.gatheredKcal
    if (event.gatheredWood || taken > stock || taken > Math.floor((3_599 + rate * event.workSeconds) / 3_600))
      fail(`forager ${forager.id} took food faster than the source allows`)
    if (lake) {
      if (!fish) fail('Unknown fish body')
      else {
        fish.stock -= taken
        fish.caught += taken
      }
      this.lake -= taken
    } else {
      this.food[id]! -= taken
      this.foodTotal -= taken
      touchedFood.push(id)
    }
  }

  /**
   * Whether a forager looked round by long sight this minute, and what it saw if it did: by day it must when it stands
   * in a new place or has not looked round for an hour, and never otherwise; at night it never does.
   */
  private lookedRound(state: ValleyState, id: number, from: Point, minute: number, fail: (message: string) => void) {
    const { config, layout } = state
    const forager = state.foragers[id]!
    if (!isDaylight(config, minute)) {
      if (forager.farPlace !== -1) fail(`forager ${id} looked round by long sight at night`)
      return null
    }
    const place = placeOf(config, from.x, from.y)
    const due = place !== this.farPlaceBefore[id] || minute - this.farMinuteBefore[id]! >= 60
    if (!due) {
      if (forager.farPlace !== this.farPlaceBefore[id] || forager.farMinute !== this.farMinuteBefore[id])
        fail(`forager ${id} looked round by long sight when it was not due`)
      return null
    }
    if (forager.farPlace !== place || forager.farMinute !== minute)
      fail(`forager ${id} did not look round by long sight from a new place or after an hour`)
    return viewFrom(config, layout, place)
  }

  /**
   * What a forager knows: places are marked seen this minute exactly when they lay wholly within close sight, or wholly
   * within long sight of a place it looked round from, and stay seen; sites in sight are known, and are checked exactly
   * when it stood close enough to see all of them; a place or site it walked towards was worth exploring, checking or
   * searching; and, in full at midnight, plants never seen say so and its count of places seen is right.
   */
  private checkKnowledge(state: ValleyState, minute: number, full: boolean, fail: (message: string) => void) {
    const { config, layout } = state
    const n = placesPerSide(config)
    const r = config.perceptionRadiusCm
    for (const event of state.lastEvents) {
      const forager = state.foragers[event.foragerId]!
      const { from } = event
      const view =
        isDaylight(config, minute) && forager.farMinute === minute
          ? viewFrom(config, state.layout, placeOf(config, from.x, from.y))
          : null
      this.checkSites(state, minute, event, view, fail)
      // Every place it marked this minute lay in sight, and every place in sight is seen; its count grew by those
      // marked, so no place out of sight was marked.
      let marked = 0
      const visit = (place: number, inView: boolean) => {
        const seen = forager.placeSeen[place]!
        if (inView && (seen < 0 || seen > minute))
          fail(`forager ${forager.id}'s memory of place ${place} does not match what it saw`)
        if (seen === minute && inView) marked += 1
      }
      const counted = new Set<number>()
      const far = new Set(view?.whole ?? [])
      const column0 = Math.max(0, Math.floor((from.x - r) / config.placeCm))
      const column1 = Math.min(n - 1, Math.floor((from.x + r) / config.placeCm))
      const row0 = Math.max(0, Math.floor((from.y - r) / config.placeCm))
      const row1 = Math.min(n - 1, Math.floor((from.y + r) / config.placeCm))
      for (let row = row0; row <= row1; row += 1)
        for (let column = column0; column <= column1; column += 1) {
          const place = row * n + column
          counted.add(place)
          visit(place, far.has(place) || placeInView(config, place, from.x, from.y, r))
        }
      if (view)
        for (const place of view.whole)
          if (!counted.has(place)) {
            counted.add(place)
            visit(place, true)
          }
      if (forager.placesSeen - this.placesSeenBefore[forager.id]! !== marked)
        fail(`forager ${forager.id} marked a place out of sight as seen`)
      if (event.placeId !== null) {
        if (!placeWanted(forager, event.placeId)) fail(`forager ${forager.id} walked to a place it did not need to see`)
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
        [layout.foodPlants, forager.foodMemory],
        [layout.woodPlants, forager.woodMemory],
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
    view: PlaceView | null,
    fail: (message: string) => void,
  ) {
    const { config, layout } = state
    const forager = state.foragers[event.foragerId]!
    const { from } = event
    const closeSq = config.perceptionRadiusCm ** 2
    const before = this.siteKnownBefore[forager.id]!
    const { x, y, checkSq } = siteGeometry(config, layout)
    if (this.farSites.length !== x.length) this.farSites = new Uint8Array(x.length)
    const far = this.farSites
    if (view) for (const site of view.sites) far[site] = 1
    const checkSite = (site: number) => {
      const dx = from.x - x[site]!
      const dy = from.y - y[site]!
      const sq = dx * dx + dy * dy
      const inSight = sq <= closeSq || far[site] === 1
      if (inSight && !forager.siteKnown[site]) fail(`forager ${forager.id} did not spot site ${site} in sight`)
      if (!inSight && forager.siteKnown[site] && !before[site])
        fail(`forager ${forager.id} spotted site ${site} out of sight`)
      if ((forager.siteChecked[site] === minute) !== sq <= checkSq[site]!)
        fail(`forager ${forager.id}'s check of site ${site} does not match where it stood`)
    }
    // Every site is checked once an hour, those in close sight and seen from afar every minute.
    if (minute % 60 === 0) for (let site = 0; site < x.length; site += 1) checkSite(site)
    else {
      forEachPlantWithin(layout.siteIndex, layout.sitePoints, from.x, from.y, config.perceptionRadiusCm, checkSite)
      if (view) for (const site of view.sites) checkSite(site)
    }
    if (view) for (const site of view.sites) far[site] = 0
    if (event.siteId === null) return
    const why = event.reason === 'searching' ? 'search' : 'check'
    if (event.reason !== 'searching' && event.reason !== 'checking' && event.reason !== 'seeking company')
      fail(`forager ${forager.id} walked to a site ${event.reason}`)
    if (!siteWanted(config, forager, event.siteId, minute, why))
      fail(`forager ${forager.id} walked to a site it did not need to ${why}`)
    if (why === 'search' && (event.workedFor === null || !siteHolds(config, event.siteId, event.workedFor)))
      fail(`forager ${forager.id} searched a site of the wrong kind`)
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
    // Foragers who joined or founded a group this minute, whose hearth moved to its slot even if it dissolved again.
    const joined = new Set<number>()
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
      joined.add(id)
      if (made.kind === 'found') joined.add(met)
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
          const hearth = hearthAround(config, group.flag, group.hearthSlots[group.members.indexOf(forager.id)]!)
          if (forager.hearth.x !== hearth.x || forager.hearth.y !== hearth.y)
            fail(`forager ${forager.id}'s hearth is not its slot around the flag`)
          if (!knownDryFootprint(forager.groundKnowledge, forager.hearth))
            fail('A hearth or hut is not on known dry ground')
        }
      } else if (before === null && !joined.has(forager.id) && forager.hearth !== this.hearthBefore[forager.id])
        fail(`forager ${forager.id} moved its hearth without joining a group`)
    }
    for (const group of state.groups) {
      if (
        group.hearthSlots.length !== group.members.length ||
        new Set(group.hearthSlots).size !== group.hearthSlots.length ||
        group.hearthSlots.some((slot) => !Number.isInteger(slot) || slot < 0)
      )
        fail('Invalid group hearth slots')
      const living = livingMembers(state, group).length
      if (group.dissolvedMinute === null) {
        if (living < 2) fail(`group ${group.id} stands with ${living} living members`)
        for (const id of group.members) if (state.foragers[id]!.groupId !== group.id) fail(`forager ${id} left a group`)
      } else if (living > 0) fail(`dissolved group ${group.id} still has living members`)
    }
    // Meeting can be deferred when the observed ground has no dry, reachable hut slots.
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
        const hearth = hearthAround(config, group.flag, group.hearthSlots[slot]!)
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
