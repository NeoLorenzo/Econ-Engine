import type { TaskRecord, ValleyConfig, Hydration, HydrationConfig } from './types'
import { TIME_UNITS_PER_MINUTE } from './routes'

export const waterThresholds = (
  config: Pick<
    ValleyConfig,
    'bodyKg' | 'thirstBodyPerMille' | 'urgentThirstBodyPerMille' | 'fatalWaterLossBodyPerMille'
  >,
) => ({
  thirsty: Math.floor(config.bodyKg * config.thirstBodyPerMille),
  urgent: Math.floor(config.bodyKg * config.urgentThirstBodyPerMille),
  fatal: Math.floor(config.bodyKg * config.fatalWaterLossBodyPerMille),
})

/** Route times retain integer fractions of a minute, so lattice resolution cannot slow a walk. */
export interface BodyRoute {
  segments: { minutes: number; timeUnits?: number; energyPerHour: number }[]
}
function integral(task: TaskRecord, minute: number, routes: readonly BodyRoute[] | undefined) {
  let left = Math.max(0, Math.min(minute, task.endMinute) - task.startMinute) * TIME_UNITS_PER_MINUTE
  let energy = 0,
    activity = 0
  const charge = (units: number, rate: number) => {
    energy += units * rate
    activity += units * task.waterExtraMlPerKcal * Math.max(0, rate - task.restKcalPerHour)
    left -= units
  }
  if (task.kind === 'walk') {
    const route = routes?.[task.routeId]
    if (!route) throw new Error('A walking body requires its recorded route')
    for (const segment of route.segments) {
      charge(
        Math.min(left, segment.timeUnits ?? Math.round(segment.minutes * TIME_UNITS_PER_MINUTE)),
        segment.energyPerHour,
      )
      if (left <= 0) break
    }
    // Arrival is rounded to an integer wake-up minute. The fraction after arrival is spent standing.
    if (left > 0) charge(left, task.restKcalPerHour)
  } else if (task.kind === 'sleep' && task.rateChanges?.length) {
    let cursor = task.startMinute,
      rate = task.energyPerHour
    const until = Math.min(minute, task.endMinute)
    for (const change of task.rateChanges) {
      if (change.minute > until) break
      charge(Math.max(0, change.minute - cursor) * TIME_UNITS_PER_MINUTE, rate)
      cursor = change.minute
      rate = change.energyPerHour
    }
    if (left > 0) charge(left, rate)
  } else charge(left, task.energyPerHour)
  return { energy, activity }
}
export function energyAt(task: TaskRecord, minute: number, routes?: readonly BodyRoute[]) {
  const unit = 60 * TIME_UNITS_PER_MINUTE
  const owed =
    task.startEnergyRemainder * TIME_UNITS_PER_MINUTE +
    (task.startEnergyTimeRemainder ?? 0) +
    integral(task, minute, routes).energy
  const timeRemainder = owed % TIME_UNITS_PER_MINUTE
  return {
    kcal: task.startEnergyKcal - Math.floor(owed / unit),
    remainder: Math.floor((owed % unit) / TIME_UNITS_PER_MINUTE),
    ...(timeRemainder ? { timeRemainder } : {}),
  }
}
export function waterAt(task: TaskRecord, minute: number, routes?: readonly BodyRoute[]) {
  const elapsed = Math.max(0, Math.min(minute, task.endMinute) - task.startMinute)
  const base = task.startWaterRemainder + elapsed * task.waterBaseMlPerDay
  const activity =
    task.startWaterActivityRemainder * TIME_UNITS_PER_MINUTE +
    (task.startWaterTimeRemainder ?? 0) +
    integral(task, minute, routes).activity
  const unit = 60 * TIME_UNITS_PER_MINUTE
  const loss = Math.floor(base / 1_440) + Math.floor(activity / unit)
  const drink = task.kind === 'drink' ? Math.min(task.startWaterMl + loss, elapsed * task.drinkMlPerMinute) : 0
  return {
    ml: task.startWaterMl + loss - drink,
    remainder: base % 1_440,
    activityRemainder: Math.floor((activity % unit) / TIME_UNITS_PER_MINUTE),
    timeRemainder: activity % TIME_UNITS_PER_MINUTE,
    loss,
    drink,
  }
}

export type Crossing = 'hungry' | 'thirsty' | 'severe' | 'fatal energy' | 'fatal water'

export function firstThresholdMinute(config: ValleyConfig, task: TaskRecord, routes?: readonly BodyRoute[]) {
  const water = waterThresholds(config)
  const predicates: [Crossing, (minute: number) => boolean][] = [
    ['fatal energy', (m) => energyAt(task, m, routes).kcal <= 0],
    ['fatal water', (m) => waterAt(task, m, routes).ml >= water.fatal],
    ['severe', (m) => waterAt(task, m, routes).ml >= water.urgent],
  ]
  if (task.kind !== 'sleep')
    predicates.push(
      ['hungry', (m) => energyAt(task, m, routes).kcal < config.hungryBelowKcal],
      ['thirsty', (m) => waterAt(task, m, routes).ml >= water.thirsty],
    )
  let first = Infinity
  let crossing: Crossing = 'hungry'
  const causes: Crossing[] = []
  for (const [name, crossed] of predicates) {
    if (crossed(task.startMinute) || !crossed(task.endMinute)) continue
    let low = task.startMinute + 1,
      high = task.endMinute
    while (low < high) {
      const mid = low + Math.floor((high - low) / 2)
      if (crossed(mid)) high = mid
      else low = mid + 1
    }
    if (low < first) {
      first = low
      crossing = name
      causes.length = 0
    }
    if (low === first && name.startsWith('fatal')) causes.push(name)
  }
  return Number.isFinite(first) ? { minute: first, crossing, causes } : null
}

export function newHydration(config: HydrationConfig): Hydration {
  return {
    waterDeficitMl: config.initialWaterDeficitMl,
    waterBaseRemainder: 0,
    waterActivityRemainder: 0,
    waterLostMl: 0,
    waterDrunkMl: 0,
    thirsty: false,
  }
}
