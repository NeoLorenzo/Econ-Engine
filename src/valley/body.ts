import type { TaskRecord, ValleyConfig } from './types'

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

/** Structural contract shared with routes; no dependency on the route search or its caches. */
export interface BodyRoute {
  segments: { minutes: number; energyPerHour: number }[]
}

function forRates(
  task: TaskRecord,
  minute: number,
  routes: readonly BodyRoute[] | undefined,
  visit: (minutes: number, energyPerHour: number) => void,
) {
  let left = Math.max(0, Math.min(minute, task.endMinute) - task.startMinute)
  if (task.kind !== 'walk') {
    visit(left, task.energyPerHour)
    return
  }
  const route = routes?.[task.routeId]
  if (!route) throw new Error('A walking body requires its recorded route')
  for (const segment of route.segments) {
    const elapsed = Math.min(left, segment.minutes)
    visit(elapsed, segment.energyPerHour)
    left -= elapsed
    if (left <= 0) break
  }
}

export function energyAt(task: TaskRecord, minute: number, routes?: readonly BodyRoute[]) {
  let owed = task.startEnergyRemainder
  forRates(task, minute, routes, (minutes, rate) => {
    owed += minutes * rate
  })
  return { kcal: task.startEnergyKcal - Math.floor(owed / 60), remainder: owed % 60 }
}

export function waterAt(task: TaskRecord, minute: number, routes?: readonly BodyRoute[]) {
  let base = task.startWaterRemainder
  let activity = task.startWaterActivityRemainder
  let elapsed = 0
  forRates(task, minute, routes, (minutes, rate) => {
    elapsed += minutes
    base += minutes * task.waterBaseMlPerDay
    activity += minutes * task.waterExtraMlPerKcal * Math.max(0, rate - task.restKcalPerHour)
  })
  const loss = Math.floor(base / 1_440) + Math.floor(activity / 60)
  const drink = task.kind === 'drink' ? Math.min(task.startWaterMl + loss, elapsed * task.drinkMlPerMinute) : 0
  return {
    ml: task.startWaterMl + loss - drink,
    remainder: base % 1_440,
    activityRemainder: activity % 60,
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
