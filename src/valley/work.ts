import { SECONDS_PER_HOUR } from './practice'
import { woodMatters } from './trade'
import type { Forager, ValleyConfig, Warmth } from './types'

/** Hour `hour`'s share of a daily amount, in whole units: the shares of a day add up to the amount exactly. */
export const hourlyShare = (perDay: number, hour: number) =>
  Math.floor((perDay * (hour + 1)) / 24) - Math.floor((perDay * hour) / 24)

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

/** The minute's cost in 3,600ths of a kilocalorie: each second at its hourly cost, sleep at its warmth. */
export function minuteCost(config: ValleyConfig, seconds: MinuteSeconds, warmth: Warmth | null) {
  const sleepCost = sleepCostOf(config, warmth)
  return (
    seconds.walk * config.travelKcalPerHour +
    seconds.work * config.forageCostKcalPerHour +
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
