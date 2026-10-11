import type { LifeConfig } from './types'

/**
 * What the foragers' rules imply. On a single patch a forager never walks, sleeps every night hour and rests every
 * daylight hour it does not forage. Experiments compare measured behaviour with these; foragers never use them.
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
  const dailyRegrowthKcal = 24 * config.patchCount * config.patchRegrowthKcalPerHour
  /** A day spent walking through every daylight hour, `N·s + L·τ`. */
  const searchingDailyCostKcal = night * config.sleepKcalPerHour + daylight * config.travelKcalPerHour
  return {
    daylightHours: daylight,
    nightHours: night,
    fixedDailyCostKcal,
    forageHoursPerDay,
    dailyNeedKcal,
    singlePatchThresholdKcalPerHour,
    /** No forager, however well informed, survives below this rate per patch; walking only adds cost. */
    lowerBoundPerPatchKcalPerHour: singlePatchThresholdKcalPerHour / config.patchCount,
    /** The most foragers the land can feed for long, however they behave: everything that regrows, `24·n·r` a day. */
    carryingCapacity: dailyRegrowthKcal / dailyNeedKcal,
    searchingDailyCostKcal,
    /** How many foragers the land could feed if every one of them walked through every daylight hour. */
    searchCapacity: dailyRegrowthKcal / searchingDailyCostKcal,
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
    /** The chance an hour of foraging succeeds and takes a full harvest. */
    harvestSuccessProbability: g / config.harvestKcal,
    triesPerHungrySpell: triesPerHungrySpell(config),
    /**
     * A lone forager on a patch that always holds a full harvest starves in a hungry spell if every try fails:
     * `(1 − p)ⁿ`, between the most and the fewest tries a spell allows.
     */
    starvationPerSpell(probability = g / config.harvestKcal) {
      const { min, max } = triesPerHungrySpell(config)
      return { low: (1 - probability) ** max, high: (1 - probability) ** min }
    },
    /** A forager that has just become hungry can eat at least this much of a windfall at once. */
    roomWhenHungryKcal: config.reserveMaxKcal - config.hungryBelowKcal,
    /**
     * With a full reserve a forager eats what it carries as fast as it burns energy resting and sleeping, `F / 24` an
     * hour, so over a shelf life it can use about this much of what it carries. A keeper's surplus beyond it spoils.
     */
    usableCarriedKcal: (shelfLifeHours: number) => (fixedDailyCostKcal / 24) * shelfLifeHours,
  }
}

/**
 * How many hours a lone forager can try once it becomes hungry, trying every daylight hour and sleeping every night
 * hour, before its reserve runs out. Hunger begins at the start of a turn with the reserve below `hungryBelowKcal`,
 * at most one hour's cost below it, at any hour of the day; the result spans every such start.
 */
function triesPerHungrySpell(config: LifeConfig) {
  const highestCost = Math.max(
    config.sleepKcalPerHour,
    config.restKcalPerHour,
    config.forageCostKcalPerHour,
    config.travelKcalPerHour,
  )
  // A forager that spends nothing trying or sleeping never runs out.
  if (config.forageCostKcalPerHour === 0 && config.sleepKcalPerHour === 0) return { min: Infinity, max: Infinity }
  let min = Infinity
  let max = 0
  for (let hour = 0; hour < 24; hour += 1) {
    for (const start of [config.hungryBelowKcal - highestCost, config.hungryBelowKcal - 1]) {
      let reserve = start
      let tries = 0
      for (let tick = hour; reserve > 0; tick += 1) {
        const daylight = tick % 24 >= config.dawnHour && tick % 24 < config.duskHour
        if (daylight) tries += 1
        reserve -= daylight ? config.forageCostKcalPerHour : config.sleepKcalPerHour
      }
      min = Math.min(min, tries)
      max = Math.max(max, tries)
    }
  }
  return { min, max }
}
