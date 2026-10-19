import { SECONDS_PER_HOUR } from './practice'
import { woodMatters } from './trade'
import type { Good, HutTask, ValleyConfig, Warmth, Forager } from './types'

export const HOURS_PER_YEAR = 8_760
export const HOURS_PER_DECADE = 10 * HOURS_PER_YEAR

/**
 * Hour `hour`'s share of an amount spread evenly over a period of `periodHours`, in whole units, with hours counted
 * from minute 0: the shares of a whole period add up to the amount exactly.
 */
export function hourlyShare(amount: number, hour: number, periodHours: number) {
  const h = hour % periodHours
  return Math.floor((amount * (h + 1)) / periodHours) - Math.floor((amount * h) / periodHours)
}

/** The hour's regrowth of berries on a bush, of dead branches under a standing tree, and of sticks on a bush. */
export const regrowthOf = (config: ValleyConfig, hour: number) => ({
  berries: hourlyShare(config.bushRegrowthKcalPerYear, hour, HOURS_PER_YEAR),
  branches: hourlyShare(config.treeDeadfallWoodPerYear, hour, HOURS_PER_YEAR),
  sticks: hourlyShare(config.bushRegrowthWoodPerDecade, hour, HOURS_PER_DECADE),
})

/** What an hour of a task costs: picking, gathering wood or fetching a stone, cutting a log, or making an axe. */
export function workCostOf(config: ValleyConfig, good: Good | null, task: HutTask | null) {
  if (task === 'cut') return config.chopKcalPerHour
  if (task === 'make') return config.makeKcalPerHour
  if (task === 'stone' || good === 'wood') return config.gatherKcalPerHour
  return config.pickKcalPerHour
}

/**
 * `seconds` of work at hourly rate `rate` with a remainder in 3,600ths: the whole units now due, and the remainder
 * left. An hour of work at rate `r` is due exactly `r` units.
 */
export function workSeconds(remainder: number, rate: number, seconds: number) {
  const owed = remainder + rate * seconds
  const units = Math.floor(owed / SECONDS_PER_HOUR)
  return { units, remainder: owed - units * SECONDS_PER_HOUR }
}

/** The seconds a forager spent on each kind of time this minute, which decide what it costs. */
export interface MinuteSeconds {
  walk: number
  work: number
  stand: number
  sleep: number
}

/** How warm a forager sleeps, by whether a fire warms it and whether it lies in its whole hut. */
export const warmthOf = (fire: boolean, hut: boolean): Warmth =>
  fire ? (hut ? 'fire and hut' : 'fire') : hut ? 'hut' : 'cold'

/** What an hour asleep costs at a warmth: a fire warms more than a hut, and both together most. */
export function sleepCostOf(config: ValleyConfig, warmth: Warmth | null) {
  if (warmth === 'fire') return config.fireSleepKcalPerHour
  if (warmth === 'hut') return config.hutSleepKcalPerHour
  if (warmth === 'cold') return config.coldSleepKcalPerHour
  return config.sleepKcalPerHour
}

/**
 * The minute's cost in 3,600ths of a kilocalorie: each second at its hourly cost, walking at `walkKcalPerHour` for the
 * load carried, work at `workKcalPerHour` for its task, and sleep at its warmth.
 */
export function minuteCost(
  config: ValleyConfig,
  seconds: MinuteSeconds,
  warmth: Warmth | null,
  walkKcalPerHour: number,
  workKcalPerHour: number,
) {
  const sleepCost = sleepCostOf(config, warmth)
  return (
    seconds.walk * walkKcalPerHour +
    seconds.work * workKcalPerHour +
    seconds.stand * config.restKcalPerHour +
    seconds.sleep * sleepCost
  )
}

/**
 * The fire for the hour of minute `minute`, decided in the first minute of each hour a forager sleeps in: it burns
 * `fireWoodPerHour` and sleeps warm if wood matters and it holds that much; otherwise it sleeps cold. Changes the
 * forager in place and returns the wood burned.
 */
export function tendFire(config: ValleyConfig, forager: Forager, minute: number) {
  const hour = Math.floor(minute / 60)
  if (forager.fireHour === hour) return 0
  forager.fireHour = hour
  if (woodMatters(config) && forager.wood >= config.fireWoodPerHour) {
    forager.wood -= config.fireWoodPerHour
    forager.warm = true
    return config.fireWoodPerHour
  }
  forager.warm = false
  return 0
}

/** Whether an hour asleep with neither fire nor hut costs more than the warmest. */
export const coldMatters = (config: ValleyConfig) => config.coldSleepKcalPerHour > config.sleepKcalPerHour
