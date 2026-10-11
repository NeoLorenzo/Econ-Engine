import { resolveLifeConfig } from './config'
import { choosePatch, decide, nextHungerMode, observe } from './forager'
import { generateLayout, sameTile, walkPath } from './world'
import type { ActionEvent, ActionHours, DaySummary, Forager, LifeConfig, LifeEvent, LifeState, Patch } from './types'

/** The observer shows the last 30 days of events; experiments read daily summaries instead. */
export const EVENT_HISTORY_DAYS = 30

const noHours = (): ActionHours => ({ sleep: 0, rest: 0, forage: 0, walk: 0 })

const totalStock = (patches: readonly Patch[]) => patches.reduce((sum, patch) => sum + patch.stockKcal, 0)

function emptyDay(day: number, energyKcal: number, patches: readonly Patch[], alive: boolean): DaySummary {
  return {
    day,
    hours: noHours(),
    gatheredKcal: 0,
    spentKcal: 0,
    endEnergyKcal: energyKcal,
    totalPatchStockKcal: totalStock(patches),
    alive,
  }
}

export function createLife(overrides: Partial<LifeConfig> = {}): LifeState {
  const config = resolveLifeConfig(overrides)
  const { patches, start } = generateLayout(config)
  const forager: Forager = {
    position: start,
    energyKcal: config.initialReserveKcal,
    hungry: config.initialReserveKcal < config.hungryBelowKcal,
    targetPatchId: null,
    // The forager knows its home range: where every patch is and what each held at the start.
    memory: patches.map((patch) => ({ stockKcal: patch.stockKcal, observedTick: 0 })),
    alive: true,
    deathTick: null,
  }
  return {
    config,
    tick: 0,
    patches,
    forager,
    totals: {
      initialKcal: totalStock(patches) + forager.energyKcal,
      regrownKcal: 0,
      metabolizedKcal: 0,
      gatheredKcal: 0,
    },
    lastEvent: null,
    eventDays: [[]],
    days: [],
    today: emptyDay(0, forager.energyKcal, patches, true),
  }
}

function costOf(config: LifeConfig, action: ActionEvent['action']) {
  if (action === 'sleep') return config.sleepKcalPerHour
  if (action === 'rest') return config.restKcalPerHour
  if (action === 'forage') return config.forageCostKcalPerHour
  return config.travelKcalPerHour
}

/** Runs one hour: regrowth, observation, decision, action, metabolism, record. */
export function stepLife(previous: LifeState): LifeState {
  const { config, tick } = previous
  let regrown = 0
  const patches = previous.patches.map((patch) => {
    const stockKcal = Math.min(config.patchCapacityKcal, patch.stockKcal + config.patchRegrowthKcalPerHour)
    regrown += stockKcal - patch.stockKcal
    return { ...patch, stockKcal }
  })

  let forager = previous.forager
  let event: ActionEvent | null = null
  const newEvents: LifeEvent[] = []
  let gathered = 0
  let spent = 0

  if (forager.alive) {
    const memory = observe(forager, patches, tick)
    const hungry = nextHungerMode(config, forager.energyKcal, forager.hungry)
    forager = { ...forager, memory, hungry }
    const { action, reason } = decide(config, forager, patches, tick)
    const from = forager.position
    let energyKcal = forager.energyKcal
    let position = forager.position
    let targetPatchId = forager.targetPatchId
    let patchId: number | null = null

    if (action === 'forage') {
      const patch = patches.find((candidate) => sameTile(candidate.tile, position))!
      gathered = Math.min(config.forageKcalPerHour, patch.stockKcal, config.reserveMaxKcal - energyKcal)
      patch.stockKcal -= gathered
      energyKcal += gathered
      patchId = patch.id
    } else if (action === 'walk') {
      const current = targetPatchId === null ? null : patches[targetPatchId]!
      const target =
        current && !sameTile(current.tile, position) ? current : choosePatch(config, position, patches, memory)!
      const path = walkPath(position, target.tile, config.tilesPerHour)
      position = path.at(-1) ?? position
      targetPatchId = sameTile(position, target.tile) ? null : target.id
    }

    spent = Math.min(energyKcal, costOf(config, action))
    energyKcal -= spent
    const alive = energyKcal > 0
    forager = { ...forager, energyKcal, position, targetPatchId, alive, deathTick: alive ? null : tick }
    event = {
      kind: 'action',
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
    newEvents.push(event)
    if (!alive) newEvents.push({ kind: 'death', tick, cause: 'starvation' })
  }

  const hours = event
    ? { ...previous.today.hours, [event.action]: previous.today.hours[event.action] + 1 }
    : previous.today.hours
  const today: DaySummary = {
    ...previous.today,
    hours,
    gatheredKcal: previous.today.gatheredKcal + gathered,
    spentKcal: previous.today.spentKcal + spent,
    endEnergyKcal: forager.energyKcal,
    totalPatchStockKcal: totalStock(patches),
    alive: forager.alive,
  }

  const eventDays = [...previous.eventDays]
  eventDays[eventDays.length - 1] = [...eventDays.at(-1)!, ...newEvents]

  const nextTick = tick + 1
  const dayEnds = nextTick % 24 === 0
  let days = previous.days
  let nextToday = today
  if (dayEnds) {
    days = [...days, today]
    nextToday = emptyDay(today.day + 1, forager.energyKcal, patches, forager.alive)
    eventDays.push([])
    if (eventDays.length > EVENT_HISTORY_DAYS) eventDays.shift()
  }

  return {
    config,
    tick: nextTick,
    patches,
    forager,
    totals: {
      initialKcal: previous.totals.initialKcal,
      regrownKcal: previous.totals.regrownKcal + regrown,
      metabolizedKcal: previous.totals.metabolizedKcal + spent,
      gatheredKcal: previous.totals.gatheredKcal + gathered,
    },
    lastEvent: event,
    eventDays,
    days,
    today: nextToday,
  }
}

export function runLifeHours(state: LifeState, hours: number) {
  let current = state
  for (let hour = 0; hour < hours; hour += 1) current = stepLife(current)
  return current
}

export const runLifeDays = (state: LifeState, days: number) => runLifeHours(state, days * 24)
