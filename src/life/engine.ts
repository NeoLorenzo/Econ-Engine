import { resolveLifeConfig } from './config'
import { addLots, carriedKcal, spoil, takeOldest } from './food'
import { decide, nextHungerMode, observe, observeGroves, walkTarget } from './forager'
import { noTaskHours, practiceDay, ratesOf, startingLog } from './practice'
import { emptyLedger, recipientsInOrder, recordGift, requestKcal } from './sharing'
import { swap } from './trade'
import { nextShortOfWood, sleepHour, woodMatters } from './wood'
import {
  drawSkills,
  forageSucceeds,
  generateLayout,
  harvestOf,
  sameTile,
  strategyOf,
  turnOrder,
  walkPath,
} from './world'
import type {
  ActionEvent,
  ActionHours,
  DaySummary,
  Forager,
  GiftEvent,
  Grove,
  LifeConfig,
  LifeEvent,
  LifeState,
  Patch,
  PracticeEvent,
  QuoteEvent,
  Strategy,
  SwapEvent,
} from './types'

/** The observer shows the last 30 days of events; experiments read daily summaries instead. */
export const EVENT_HISTORY_DAYS = 30

const noHours = (): ActionHours => ({ sleep: 0, rest: 0, forage: 0, walk: 0, gather: 0 })

const totalStock = (patches: readonly Patch[]) => patches.reduce((sum, patch) => sum + patch.stockKcal, 0)

const totalWood = (groves: readonly Grove[]) => groves.reduce((sum, grove) => sum + grove.wood, 0)

const countAlive = (foragers: readonly Forager[]) => foragers.reduce((sum, forager) => sum + (forager.alive ? 1 : 0), 0)

const totalCarried = (foragers: readonly Forager[]) =>
  foragers.reduce((sum, forager) => sum + carriedKcal(forager.carried), 0)

function aliveByStrategy(foragers: readonly Forager[]): Record<Strategy, number> {
  const alive: Record<Strategy, number> = { keeper: 0, sharer: 0, reciprocator: 0 }
  for (const forager of foragers) if (forager.alive) alive[forager.strategy] += 1
  return alive
}

function emptyDay(day: number, foragers: readonly Forager[], patches: readonly Patch[]): DaySummary {
  return {
    day,
    hours: noHours(),
    gatheredKcal: 0,
    spentKcal: 0,
    alive: countAlive(foragers),
    deaths: 0,
    totalPatchStockKcal: totalStock(patches),
    endEnergyKcal: foragers.map((forager) => forager.energyKcal),
    givenKcal: 0,
    spoiledKcal: 0,
    carriedKcal: totalCarried(foragers),
    aliveByStrategy: aliveByStrategy(foragers),
    gatheredWood: 0,
    burnedWood: 0,
    coldSleepHours: 0,
    swaps: 0,
    swappedWood: 0,
    swappedKcal: 0,
    forageRates: foragers.map((forager) => forager.forageRate),
    woodRates: foragers.map((forager) => forager.woodRate),
  }
}

export function createLife(overrides: Partial<LifeConfig> = {}): LifeState {
  const config = resolveLifeConfig(overrides)
  const { patches, groves, starts } = generateLayout(config)
  const skills = drawSkills(config)
  const practiceLog = startingLog(config)
  const foragers: Forager[] = starts.map((position, id) => ({
    id,
    position,
    energyKcal: config.initialReserveKcal,
    hungry: config.initialReserveKcal < config.hungryBelowKcal,
    targetPatchId: null,
    // Every forager knows its home range: where every patch and grove is and what each held at the start.
    memory: patches.map((patch) => ({ stockKcal: patch.stockKcal, observedTick: 0 })),
    alive: true,
    deathTick: null,
    strategy: strategyOf(config, id),
    carried: [],
    ledger: emptyLedger(config.bandSize),
    ...skills[id]!,
    ...ratesOf(config, skills[id]!.foragingSkill, skills[id]!.woodSkill, practiceLog),
    practiceLog,
    hoursToday: noTaskHours(),
    loggedHours: noTaskHours(),
    wood: 0,
    shortOfWood: woodMatters(config),
    targetGroveId: null,
    groveMemory: groves.map((grove) => ({ wood: grove.wood, observedTick: 0 })),
    heardTerms: null,
    trip: null,
    swapTotals: { woodSold: 0, woodBought: 0, kcalReceived: 0, kcalPaid: 0 },
    hoursWorked: { forage: 0, gather: 0 },
  }))
  return {
    config,
    tick: 0,
    patches,
    groves,
    foragers,
    totals: {
      initialKcal: totalStock(patches) + foragers.reduce((sum, forager) => sum + forager.energyKcal, 0),
      regrownKcal: 0,
      metabolizedKcal: 0,
      gatheredKcal: 0,
      spoiledKcal: 0,
      givenKcal: 0,
      initialWood: totalWood(groves),
      regrownWood: 0,
      burnedWood: 0,
      swappedWood: 0,
      swappedKcal: 0,
    },
    lastEvents: [],
    lastGifts: [],
    lastSwaps: [],
    lastQuotes: [],
    lastPractice: [],
    eventDays: [[]],
    days: [],
    today: emptyDay(0, foragers, patches),
  }
}

function costOf(config: LifeConfig, action: ActionEvent['action']) {
  if (action === 'sleep') return config.sleepKcalPerHour
  if (action === 'rest') return config.restKcalPerHour
  if (action === 'forage' || action === 'gather') return config.forageCostKcalPerHour
  return config.travelKcalPerHour
}

/**
 * The giver hands carried food to the foragers on its tile that ask, in the order its strategy serves them, each gift
 * the smaller of what it carries and what was asked. `foragers` are this hour's copies; recipients are updated in it.
 */
function give(config: LifeConfig, giver: Forager, foragers: Forager[], tick: number) {
  let current = giver
  const gifts: GiftEvent[] = []
  if (!carriedKcal(current.carried)) return { giver: current, gifts }
  for (const { id } of recipientsInOrder(config, current, foragers)) {
    const recipient = foragers[id]!
    const request = requestKcal(config, recipient)
    const { taken, rest, takenKcal } = takeOldest(current.carried, request)
    if (!takenKcal) break
    const { giverLedger, recipientLedger } = recordGift(current, recipient, takenKcal)
    current = { ...current, carried: rest, ledger: giverLedger }
    foragers[id] = { ...recipient, carried: addLots(recipient.carried, taken), ledger: recipientLedger }
    gifts.push({
      kind: 'gift',
      tick,
      giverId: current.id,
      recipientId: id,
      tile: { ...current.position },
      requestKcal: request,
      kcal: takenKcal,
    })
  }
  return { giver: current, gifts }
}

/**
 * One forager's turn: spoilage, eating, observation, decision, action, exchange, eating again and metabolism.
 * `patches`, `groves` and `foragers` are this hour's copies; working and exchanging change them, so later turns see
 * what this one left.
 */
function takeTurn(
  config: LifeConfig,
  previous: Forager,
  patches: Patch[],
  groves: Grove[],
  foragers: Forager[],
  tick: number,
) {
  const spoiled = spoil(previous.carried, tick, config.shelfLifeHours)
  const eaten = takeOldest(spoiled.lots, config.reserveMaxKcal - previous.energyKcal)
  let energyKcal = previous.energyKcal + eaten.takenKcal
  let carried = eaten.rest
  const memory = observe(config, previous, patches, tick)
  const groveMemory = observeGroves(config, previous, groves, tick)
  const hungry = nextHungerMode(config, energyKcal, previous.hungry)
  const shortOfWood = nextShortOfWood(config, previous.wood, previous.shortOfWood)
  const forager = { ...previous, energyKcal, carried, memory, groveMemory, hungry, shortOfWood }
  const decision = decide(config, forager, patches, groves, tick)
  const { action, reason } = decision
  const from = forager.position
  let position = forager.position
  let targetPatchId = forager.targetPatchId
  let targetGroveId = forager.targetGroveId
  let wood = forager.wood
  let patchId: number | null = null
  let succeeded: boolean | null = null
  let gathered = 0
  let gatheredWood = 0
  let cost = costOf(config, action)
  let burnedWood = 0
  let sleptCold = false

  if (action === 'forage') {
    const patch = patches.find((candidate) => sameTile(candidate.tile, position))!
    patchId = patch.id
    succeeded = forageSucceeds(config, tick, forager.id, forager.forageRate)
    if (succeeded) {
      // The patch holds at least a full harvest, or the forager would not have started.
      gathered = harvestOf(config, forager.forageRate)
      patch.stockKcal -= gathered
      const eat = Math.min(gathered, config.reserveMaxKcal - energyKcal)
      energyKcal += eat
      if (gathered > eat) carried = addLots(carried, [{ kcal: gathered - eat, harvestTick: tick }])
    }
  } else if (action === 'gather') {
    // The grove holds at least an hour's gathering, or the forager would not have started.
    const grove = groves.find((candidate) => sameTile(candidate.tile, position))!
    patchId = grove.id
    gatheredWood = forager.woodRate
    grove.wood -= gatheredWood
    wood += gatheredWood
  } else if (action === 'walk') {
    const target = walkTarget(config, forager, patches, groves, tick, decision.good)!
    const path = walkPath(position, target.tile, config.tilesPerHour)
    position = path.at(-1) ?? position
    // Going home keeps the targets for the morning.
    if (target.patch) targetPatchId = sameTile(position, target.tile) ? null : target.patch.id
    if (target.grove) targetGroveId = sameTile(position, target.tile) ? null : target.grove.id
  } else if (action === 'sleep') {
    const hour = sleepHour(config, wood)
    burnedWood = hour.burnedWood
    sleptCold = hour.sleptCold
    cost = hour.costKcal
    wood -= burnedWood
  }

  const acted: Forager = {
    ...forager,
    energyKcal,
    carried,
    position,
    targetPatchId,
    targetGroveId,
    wood,
    trip: decision.trip,
    hoursWorked:
      action === 'forage' || action === 'gather'
        ? { ...forager.hoursWorked, [action]: forager.hoursWorked[action] + 1 }
        : forager.hoursWorked,
    hoursToday:
      action === 'forage' || action === 'gather'
        ? { ...forager.hoursToday, [action]: forager.hoursToday[action] + 1 }
        : forager.hoursToday,
  }
  const traded = swap(config, acted, foragers, tick)
  const { giver, gifts } = give(config, traded.trader, foragers, tick)
  // Food received in a swap fits in the reserve and is eaten at once. Otherwise a forager that still carries food has a
  // full reserve here, so nothing more is eaten.
  const eatenAgain = takeOldest(giver.carried, config.reserveMaxKcal - energyKcal)
  energyKcal += eatenAgain.takenKcal

  const spent = Math.min(energyKcal, cost)
  energyKcal -= spent
  const alive = energyKcal > 0
  const event: ActionEvent = {
    kind: 'action',
    foragerId: forager.id,
    tick,
    action,
    reason,
    from,
    position,
    targetPatchId,
    patchId,
    succeeded,
    gatheredKcal: gathered,
    spoiledKcal: spoiled.spoiledKcal,
    eatenKcal: eaten.takenKcal + eatenAgain.takenKcal,
    spentKcal: spent,
    energyAfterKcal: energyKcal,
    carriedAfterKcal: carriedKcal(eatenAgain.rest),
    gatheredWood,
    burnedWood,
    sleptCold,
    workedFor: decision.good,
    forTrade: decision.forTrade,
    woodAfter: giver.wood,
  }
  return {
    forager: { ...giver, carried: eatenAgain.rest, energyKcal, alive, deathTick: alive ? null : tick },
    event,
    gifts,
    swaps: traded.swaps,
    quotes: traded.quotes,
  }
}

/**
 * Runs one hour: practice at the start of every day after the first, regrowth, the hour's turn order, then each living
 * forager's turn in that order, and the record.
 */
export function stepLife(previous: LifeState): LifeState {
  const { config, tick } = previous
  const lastPractice: PracticeEvent[] = []
  const foragers = previous.foragers.map((forager) => {
    if (tick === 0 || tick % 24 !== 0 || !forager.alive) return forager
    const practised = practiceDay(config, forager, tick)
    lastPractice.push(practised.event)
    return practised.forager
  })
  let regrown = 0
  const patches = previous.patches.map((patch) => {
    const stockKcal = Math.min(config.patchCapacityKcal, patch.stockKcal + config.patchRegrowthKcalPerHour)
    regrown += stockKcal - patch.stockKcal
    return { ...patch, stockKcal }
  })
  let regrownWood = 0
  const groves = previous.groves.map((grove) => {
    const wood = Math.min(config.groveCapacityWood, grove.wood + config.groveRegrowthWoodPerHour)
    regrownWood += wood - grove.wood
    return { ...grove, wood }
  })

  const lastEvents: ActionEvent[] = []
  const lastGifts: GiftEvent[] = []
  const lastSwaps: SwapEvent[] = []
  const lastQuotes: QuoteEvent[] = []
  const newEvents: LifeEvent[] = [...lastPractice]
  const hours = { ...previous.today.hours }
  let gathered = 0
  let spent = 0
  let spoiled = 0
  let given = 0
  let deaths = 0
  let gatheredWood = 0
  let burnedWood = 0
  let coldSleepHours = 0
  let swappedWood = 0
  let swappedKcal = 0

  for (const id of turnOrder(config.seed, tick, foragers.length)) {
    if (!foragers[id]!.alive) continue
    const turn = takeTurn(config, foragers[id]!, patches, groves, foragers, tick)
    foragers[id] = turn.forager
    lastEvents.push(turn.event)
    lastGifts.push(...turn.gifts)
    lastSwaps.push(...turn.swaps)
    lastQuotes.push(...turn.quotes)
    newEvents.push(turn.event, ...turn.swaps, ...turn.quotes, ...turn.gifts)
    hours[turn.event.action] += 1
    gathered += turn.event.gatheredKcal
    spent += turn.event.spentKcal
    spoiled += turn.event.spoiledKcal
    gatheredWood += turn.event.gatheredWood
    burnedWood += turn.event.burnedWood
    if (turn.event.sleptCold) coldSleepHours += 1
    for (const gift of turn.gifts) given += gift.kcal
    for (const made of turn.swaps) {
      swappedWood += made.wood
      swappedKcal += made.kcal
    }
    if (!turn.forager.alive) {
      deaths += 1
      newEvents.push({ kind: 'death', foragerId: id, tick, cause: 'starvation' })
    }
  }

  const today: DaySummary = {
    ...previous.today,
    hours,
    gatheredKcal: previous.today.gatheredKcal + gathered,
    spentKcal: previous.today.spentKcal + spent,
    alive: previous.today.alive - deaths,
    deaths: previous.today.deaths + deaths,
    totalPatchStockKcal: totalStock(patches),
    endEnergyKcal: foragers.map((forager) => forager.energyKcal),
    givenKcal: previous.today.givenKcal + given,
    spoiledKcal: previous.today.spoiledKcal + spoiled,
    carriedKcal: totalCarried(foragers),
    aliveByStrategy: deaths ? aliveByStrategy(foragers) : previous.today.aliveByStrategy,
    gatheredWood: previous.today.gatheredWood + gatheredWood,
    burnedWood: previous.today.burnedWood + burnedWood,
    coldSleepHours: previous.today.coldSleepHours + coldSleepHours,
    swaps: previous.today.swaps + lastSwaps.length,
    swappedWood: previous.today.swappedWood + swappedWood,
    swappedKcal: previous.today.swappedKcal + swappedKcal,
    forageRates: lastPractice.length ? foragers.map((forager) => forager.forageRate) : previous.today.forageRates,
    woodRates: lastPractice.length ? foragers.map((forager) => forager.woodRate) : previous.today.woodRates,
  }

  const eventDays = [...previous.eventDays]
  eventDays[eventDays.length - 1] = [...eventDays.at(-1)!, ...newEvents]

  const nextTick = tick + 1
  const dayEnds = nextTick % 24 === 0
  let days = previous.days
  let nextToday = today
  if (dayEnds) {
    days = [...days, today]
    nextToday = emptyDay(today.day + 1, foragers, patches)
    eventDays.push([])
    if (eventDays.length > EVENT_HISTORY_DAYS) eventDays.shift()
  }

  return {
    config,
    tick: nextTick,
    patches,
    groves,
    foragers,
    totals: {
      initialKcal: previous.totals.initialKcal,
      regrownKcal: previous.totals.regrownKcal + regrown,
      metabolizedKcal: previous.totals.metabolizedKcal + spent,
      gatheredKcal: previous.totals.gatheredKcal + gathered,
      spoiledKcal: previous.totals.spoiledKcal + spoiled,
      givenKcal: previous.totals.givenKcal + given,
      initialWood: previous.totals.initialWood,
      regrownWood: previous.totals.regrownWood + regrownWood,
      burnedWood: previous.totals.burnedWood + burnedWood,
      swappedWood: previous.totals.swappedWood + swappedWood,
      swappedKcal: previous.totals.swappedKcal + swappedKcal,
    },
    lastEvents,
    lastGifts,
    lastSwaps,
    lastQuotes,
    lastPractice,
    eventDays,
    days,
    today: nextToday,
  }
}

/** The action a forager took in the last tick run, or null if it took no turn. */
export const lastEventOf = (state: LifeState, foragerId: number) =>
  state.lastEvents.find((event) => event.foragerId === foragerId) ?? null

/**
 * The stock of a patch when the `index`-th turn of the last hour began. Foraging in that turn and in later turns has
 * since taken from it; nothing else changes a stock within an hour after regrowth.
 */
export function stockAtTurn(state: LifeState, index: number, patchId: number) {
  let stock = state.patches[patchId]!.stockKcal
  for (let later = index; later < state.lastEvents.length; later += 1) {
    const event = state.lastEvents[later]!
    if (event.action === 'forage' && event.patchId === patchId) stock += event.gatheredKcal
  }
  return stock
}

/** The wood of a grove when the `index`-th turn of the last hour began, as `stockAtTurn` does for patches. */
export function woodAtTurn(state: LifeState, index: number, groveId: number) {
  let wood = state.groves[groveId]!.wood
  for (let later = index; later < state.lastEvents.length; later += 1) {
    const event = state.lastEvents[later]!
    if (event.action === 'gather' && event.patchId === groveId) wood += event.gatheredWood
  }
  return wood
}

export function runLifeHours(state: LifeState, hours: number) {
  let current = state
  for (let hour = 0; hour < hours; hour += 1) current = stepLife(current)
  return current
}

export const runLifeDays = (state: LifeState, days: number) => runLifeHours(state, days * 24)
