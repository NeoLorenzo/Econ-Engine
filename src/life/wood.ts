import type { Forager, LifeConfig } from './types'

/** Wood matters when there are groves and a night without a fire costs more than one with it. */
export const woodMatters = (config: LifeConfig) =>
  config.groveCount > 0 && config.coldSleepKcalPerHour > config.sleepKcalPerHour

export const nightHours = (config: LifeConfig) => 24 - (config.duskHour - config.dawnHour)

/** The wood a forager burns to sleep warm through one night. */
export const nightWood = (config: LifeConfig) => nightHours(config) * config.fireWoodPerHour

/** A forager short of wood gathers until it holds this much. It wants wood up to it and can spare what is above it. */
export const woodTarget = (config: LifeConfig) => config.woodStockNights * nightWood(config)

export const spareWood = (config: LifeConfig, forager: Forager) => Math.max(0, forager.wood - woodTarget(config))

export const wantedWood = (config: LifeConfig, forager: Forager) => Math.max(0, woodTarget(config) - forager.wood)

/**
 * Wood need with hysteresis, like hunger: a forager becomes short of wood below one night's wood and stays short until
 * it holds its target. Where wood does not matter it is never short.
 */
export function nextShortOfWood(config: LifeConfig, wood: number, shortOfWood: boolean) {
  if (!woodMatters(config)) return false
  if (wood < nightWood(config)) return true
  if (wood >= woodTarget(config)) return false
  return shortOfWood
}

/** An hour of sleep: warm if wood matters and the forager holds a fire's worth, which it burns; otherwise cold. */
export function sleepHour(config: LifeConfig, wood: number) {
  if (woodMatters(config) && wood >= config.fireWoodPerHour)
    return { burnedWood: config.fireWoodPerHour, sleptCold: false, costKcal: config.sleepKcalPerHour }
  const sleptCold = config.coldSleepKcalPerHour > config.sleepKcalPerHour
  return { burnedWood: 0, sleptCold, costKcal: config.coldSleepKcalPerHour }
}
