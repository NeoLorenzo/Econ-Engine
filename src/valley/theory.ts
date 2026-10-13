import { placeCount } from './social'
import { nightHours, nightWood, woodTarget } from './trade'
import type { ValleyConfig } from './types'

/**
 * What the valley's rules imply. Experiments compare measured behaviour with these; foragers never use them.
 */
export function valleyTheory(config: ValleyConfig) {
  const night = nightHours(config)
  const daylight = 24 - night
  const restDelta = config.forageCostKcalPerHour - config.restKcalPerHour
  const travelDelta = config.travelKcalPerHour - config.restKcalPerHour
  /** Sleeping warm every night hour and resting every daylight hour, Life 0's `F`. */
  const fixedDailyCostKcal = night * config.sleepKcalPerHour + daylight * config.restKcalPerHour
  /**
   * Hours of foraging a day at hourly rate `g`, given `gatherHours` of gathering and `walkHours` of walking: each hour
   * of work or walking replaces an hour of rest, and foraging must pay for the whole day.
   */
  const forageHoursPerDay = (g: number, gatherHours: number, walkHours: number) =>
    (fixedDailyCostKcal + gatherHours * restDelta + walkHours * travelDelta) / (g - restDelta)
  /** The food a forager eats in a day at rate `g`, which is its daily need. */
  const dailyNeedKcal = (g: number, gatherHours: number, walkHours: number) =>
    g * forageHoursPerDay(g, gatherHours, walkHours)
  const dailyRegrowthKcal = config.thicketCount * config.bushesPerThicket * config.bushRegrowthKcalPerDay
  /** Wood gathered for one's own fires a day: a night's wood at rate `w`. */
  const gatherHoursPerDay = (w: number) => nightWood(config) / w
  /** The most spare wood a forager can hold after a trip for itself: `max(0, nightWood − 1 + woodLoad − woodTarget)`. */
  const maxSpareAfterTrip = Math.max(0, nightWood(config) - 1 + config.woodLoad - woodTarget(config))
  /** Loads no larger than this can never leave a forager with spare wood, so nothing is ever swapped or quoted. */
  const largestLoadWithoutSurplus = woodTarget(config) - nightWood(config) + 1
  /** Hours to walk from place centre to place centre across the whole valley once, about `placeCm` per place. */
  const sweepHours = (placeCount(config) * config.placeCm) / config.walkCmPerSecond / 3_600
  return {
    nightHours: night,
    daylightHours: daylight,
    fixedDailyCostKcal,
    forageHoursPerDay,
    dailyNeedKcal,
    gatherHoursPerDay,
    dailyRegrowthKcal,
    /** How many foragers the valley could feed if each needed `need` kilocalories a day. */
    carryingCapacity: (need: number) => dailyRegrowthKcal / need,
    nightWood: nightWood(config),
    woodTarget: woodTarget(config),
    maxSpareAfterTrip,
    largestLoadWithoutSurplus,
    /**
     * A forager whose rates never exceed 60 an hour gathers at most a unit a minute, so it stops exactly where it set
     * out to: with a load of at most `largestLoadWithoutSurplus`, no surplus, no quote and no swap is possible.
     */
    noSurplus: (fastestWoodRate: number) => fastestWoodRate <= 60 && config.woodLoad <= largestLoadWithoutSurplus,
    /** Every standing group has at least two living members, so at most this many stand among `living` foragers. */
    mostGroups: (living: number) => Math.floor(living / 2),
    sweepHours,
    /** What walking instead of resting costs over a sweep of the valley. */
    sweepCostKcal: sweepHours * travelDelta,
  }
}
