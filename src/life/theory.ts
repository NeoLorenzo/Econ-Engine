import type { LifeConfig } from './types'

/**
 * What the forager's rules imply on a single patch, where it never walks, sleeps every night hour and rests every
 * daylight hour it does not forage. Experiments compare measured behaviour with these; the forager never uses them.
 */
export function lifeTheory(config: LifeConfig) {
  const daylight = config.duskHour - config.dawnHour
  const night = 24 - daylight
  const g = config.forageKcalPerHour
  const netPerForageHour = g - config.forageCostKcalPerHour + config.restKcalPerHour
  /** Sleeping every night hour and resting every daylight hour. */
  const fixedDailyCostKcal = night * config.sleepKcalPerHour + daylight * config.restKcalPerHour
  /** Each foraging hour replaces an hour of rest, adding `φ − ρ` to the day's cost. */
  const forageHoursPerDay = fixedDailyCostKcal / netPerForageHour
  const dailyNeedKcal = forageHoursPerDay * g
  /** Below this regrowth rate a single patch cannot feed the forager, which eats all of it, `24·r` a day. */
  const singlePatchThresholdKcalPerHour = dailyNeedKcal / 24
  return {
    daylightHours: daylight,
    nightHours: night,
    fixedDailyCostKcal,
    forageHoursPerDay,
    dailyNeedKcal,
    singlePatchThresholdKcalPerHour,
    /** No forager, however well informed, survives below this rate per patch; walking only adds cost. */
    lowerBoundPerPatchKcalPerHour: singlePatchThresholdKcalPerHour / config.patchCount,
    dailyDeficitKcal: (regrowthKcalPerHour: number) =>
      fixedDailyCostKcal - (24 * regrowthKcalPerHour * netPerForageHour) / g,
    /**
     * Starting from `reserveKcal` and an empty patch below the threshold. The forager dies before the upper bound
     * because, at death, the patch may still hold food it never ate: up to one hour's harvest it was waiting for, plus
     * one night's regrowth if it dies in its sleep.
     */
    deathDayWindow(regrowthKcalPerHour: number, reserveKcal: number) {
      const deficit = fixedDailyCostKcal - (24 * regrowthKcalPerHour * netPerForageHour) / g
      if (deficit <= 0) return null
      return { earliest: (reserveKcal - g - night * regrowthKcalPerHour) / deficit, latest: reserveKcal / deficit }
    },
  }
}
