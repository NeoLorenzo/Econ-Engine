import { resolveLifeConfig } from './config'
import { addLots, carriedKcal, spoil, takeOldest } from './food'
import { decide, nextHungerMode, observe, walkTarget } from './forager'
import { emptyLedger, recipientsInOrder, recordGift, requestKcal } from './sharing'
import { forageSucceeds, generateLayout, sameTile, strategyOf, turnOrder, walkPath } from './world'
import type {
  ActionEvent,
  ActionHours,
  DaySummary,
  Forager,
  GiftEvent,
  LifeConfig,
  LifeEvent,
  LifeState,
  Patch,
  Strategy,
} from './types'

/** The observer shows the last 30 days of events; experiments read daily summaries instead. */
export const EVENT_HISTORY_DAYS = 30

const noHours = (): ActionHours => ({ sleep: 0, rest: 0, forage: 0, walk: 0 })

const totalStock = (patches: readonly Patch[]) => patches.reduce((sum, patch) => sum + patch.stockKcal, 0)

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
  }
}

export function createLife(overrides: Partial<LifeConfig> = {}): LifeState {
  const config = resolveLifeConfig(overrides)
  const { patches, starts } = generateLayout(config)
  const foragers: Forager[] = starts.map((position, id) => ({
    id,
    position,
    energyKcal: config.initialReserveKcal,
    hungry: config.initialReserveKcal < config.hungryBelowKcal,
    targetPatchId: null,
    // Every forager knows its home range: where every patch is and what each held at the start.
    memory: patches.map((patch) => ({ stockKcal: patch.stockKcal, observedTick: 0 })),
    alive: true,
    deathTick: null,
    strategy: strategyOf(config, id),
    carried: [],
    ledger: emptyLedger(config.bandSize),
  }))
  return {
    config,
    tick: 0,
    patches,
    foragers,
    totals: {
      initialKcal: totalStock(patches) + foragers.reduce((sum, forager) => sum + forager.energyKcal, 0),
      regrownKcal: 0,
      metabolizedKcal: 0,
      gatheredKcal: 0,
      spoiledKcal: 0,
      givenKcal: 0,
    },
    lastEvents: [],
    lastGifts: [],
    eventDays: [[]],
    days: [],
    today: emptyDay(0, foragers, patches),
  }
}

function costOf(config: LifeConfig, action: ActionEvent['action']) {
  if (action === 'sleep') return config.sleepKcalPerHour
  if (action === 'rest') return config.restKcalPerHour
  if (action === 'forage') return config.forageCostKcalPerHour
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
 * One forager's turn: spoilage, eating, observation, decision, action, giving and metabolism. `patches` and
 * `foragers` are this hour's copies; foraging and giving change them, so later turns see what this one left.
 */
function takeTurn(config: LifeConfig, previous: Forager, patches: Patch[], foragers: Forager[], tick: number) {
  const spoiled = spoil(previous.carried, tick, config.shelfLifeHours)
  const eaten = takeOldest(spoiled.lots, config.reserveMaxKcal - previous.energyKcal)
  let energyKcal = previous.energyKcal + eaten.takenKcal
  let carried = eaten.rest
  const memory = observe(config, previous, patches, tick)
  const hungry = nextHungerMode(config, energyKcal, previous.hungry)
  const forager = { ...previous, energyKcal, carried, memory, hungry }
  const { action, reason } = decide(config, forager, patches, tick)
  const from = forager.position
  let position = forager.position
  let targetPatchId = forager.targetPatchId
  let patchId: number | null = null
  let succeeded: boolean | null = null
  let gathered = 0

  if (action === 'forage') {
    const patch = patches.find((candidate) => sameTile(candidate.tile, position))!
    patchId = patch.id
    succeeded = forageSucceeds(config, tick, forager.id)
    if (succeeded) {
      // The patch holds at least a full harvest, or the forager would not have started.
      gathered = config.harvestKcal
      patch.stockKcal -= gathered
      const eat = Math.min(gathered, config.reserveMaxKcal - energyKcal)
      energyKcal += eat
      if (gathered > eat) carried = addLots(carried, [{ kcal: gathered - eat, harvestTick: tick }])
    }
  } else if (action === 'walk') {
    const target = walkTarget(config, forager, patches, tick)!
    const path = walkPath(position, target.tile, config.tilesPerHour)
    position = path.at(-1) ?? position
    // Going home keeps the patch target for the morning.
    if (target.patch) targetPatchId = sameTile(position, target.tile) ? null : target.patch.id
  }

  const { giver, gifts } = give(config, { ...forager, energyKcal, carried, position, targetPatchId }, foragers, tick)

  const spent = Math.min(energyKcal, costOf(config, action))
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
    eatenKcal: eaten.takenKcal,
    spentKcal: spent,
    energyAfterKcal: energyKcal,
    carriedAfterKcal: carriedKcal(giver.carried),
  }
  return {
    forager: { ...giver, energyKcal, alive, deathTick: alive ? null : tick },
    event,
    gifts,
  }
}

/** Runs one hour: regrowth, the hour's turn order, then each living forager's turn in that order, and the record. */
export function stepLife(previous: LifeState): LifeState {
  const { config, tick } = previous
  let regrown = 0
  const patches = previous.patches.map((patch) => {
    const stockKcal = Math.min(config.patchCapacityKcal, patch.stockKcal + config.patchRegrowthKcalPerHour)
    regrown += stockKcal - patch.stockKcal
    return { ...patch, stockKcal }
  })

  const foragers = [...previous.foragers]
  const lastEvents: ActionEvent[] = []
  const lastGifts: GiftEvent[] = []
  const newEvents: LifeEvent[] = []
  const hours = { ...previous.today.hours }
  let gathered = 0
  let spent = 0
  let spoiled = 0
  let given = 0
  let deaths = 0

  for (const id of turnOrder(config.seed, tick, foragers.length)) {
    if (!foragers[id]!.alive) continue
    const turn = takeTurn(config, foragers[id]!, patches, foragers, tick)
    foragers[id] = turn.forager
    lastEvents.push(turn.event)
    lastGifts.push(...turn.gifts)
    newEvents.push(turn.event, ...turn.gifts)
    hours[turn.event.action] += 1
    gathered += turn.event.gatheredKcal
    spent += turn.event.spentKcal
    spoiled += turn.event.spoiledKcal
    for (const gift of turn.gifts) given += gift.kcal
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
    foragers,
    totals: {
      initialKcal: previous.totals.initialKcal,
      regrownKcal: previous.totals.regrownKcal + regrown,
      metabolizedKcal: previous.totals.metabolizedKcal + spent,
      gatheredKcal: previous.totals.gatheredKcal + gathered,
      spoiledKcal: previous.totals.spoiledKcal + spoiled,
      givenKcal: previous.totals.givenKcal + given,
    },
    lastEvents,
    lastGifts,
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
    if (event.patchId === patchId) stock += event.gatheredKcal
  }
  return stock
}

export function runLifeHours(state: LifeState, hours: number) {
  let current = state
  for (let hour = 0; hour < hours; hour += 1) current = stepLife(current)
  return current
}

export const runLifeDays = (state: LifeState, days: number) => runLifeHours(state, days * 24)
