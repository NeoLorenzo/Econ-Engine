import { woodMatters } from './trade'
import type { ValleyConfig, Warmth, Forager } from './types'

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
