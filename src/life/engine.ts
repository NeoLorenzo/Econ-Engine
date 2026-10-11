import { resolveLifeConfig } from './config'
import { decide, nextHungerMode, observe, walkTarget } from './forager'
import { generateLayout, sameTile, turnOrder, walkPath } from './world'
import type { ActionEvent, ActionHours, DaySummary, Forager, LifeConfig, LifeEvent, LifeState, Patch } from './types'

/** The observer shows the last 30 days of events; experiments read daily summaries instead. */
export const EVENT_HISTORY_DAYS = 30

const noHours = (): ActionHours => ({ sleep: 0, rest: 0, forage: 0, walk: 0 })

const totalStock = (patches: readonly Patch[]) => patches.reduce((sum, patch) => sum + patch.stockKcal, 0)

const countAlive = (foragers: readonly Forager[]) => foragers.reduce((sum, forager) => sum + (forager.alive ? 1 : 0), 0)

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
    },
    lastEvents: [],
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
 * One forager's turn: observation, decision, action, metabolism. `patches` are this hour's copies; foraging takes from
 * them, so later turns see what this one left.
 */
function takeTurn(config: LifeConfig, previous: Forager, patches: Patch[], tick: number) {
  const memory = observe(config, previous, patches, tick)
  const hungry = nextHungerMode(config, previous.energyKcal, previous.hungry)
  const forager = { ...previous, memory, hungry }
  const { action, reason } = decide(config, forager, patches, tick)
  const from = forager.position
  let energyKcal = forager.energyKcal
  let position = forager.position
  let targetPatchId = forager.targetPatchId
  let patchId: number | null = null
  let gathered = 0

  if (action === 'forage') {
    const patch = patches.find((candidate) => sameTile(candidate.tile, position))!
    gathered = Math.min(config.forageKcalPerHour, patch.stockKcal, config.reserveMaxKcal - energyKcal)
    patch.stockKcal -= gathered
    energyKcal += gathered
    patchId = patch.id
  } else if (action === 'walk') {
    const target = walkTarget(config, forager, patches, tick)!
    const path = walkPath(position, target.tile, config.tilesPerHour)
    position = path.at(-1) ?? position
    targetPatchId = sameTile(position, target.tile) ? null : target.id
  }

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
    gatheredKcal: gathered,
    spentKcal: spent,
    energyAfterKcal: energyKcal,
  }
  return {
    forager: { ...forager, energyKcal, position, targetPatchId, alive, deathTick: alive ? null : tick },
    event,
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
  const newEvents: LifeEvent[] = []
  const hours = { ...previous.today.hours }
  let gathered = 0
  let spent = 0
  let deaths = 0

  for (const id of turnOrder(config.seed, tick, foragers.length)) {
    if (!foragers[id]!.alive) continue
    const turn = takeTurn(config, foragers[id]!, patches, tick)
    foragers[id] = turn.forager
    lastEvents.push(turn.event)
    newEvents.push(turn.event)
    hours[turn.event.action] += 1
    gathered += turn.event.gatheredKcal
    spent += turn.event.spentKcal
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
    },
    lastEvents,
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
