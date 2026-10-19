import { askOf } from './axes'
import { lakeCapacityKcal } from './config'
import { speedForLoad } from './forager'
import { placeCount } from './social'
import { siteCount } from './sites'
import { GROUND_NAMES, cellSlopePercent, speedOnGrade, walkCost as landWalkCost } from './terrain'
import { nightHours, nightWood, woodTarget } from './trade'
import type { ValleyConfig, ValleyLayout } from './types'

/**
 * The generated land, measured: its lowest and highest ground, the share of its area of each ground, the share steeper
 * than 5%, 10% and 20%, and its kettles' radii and depths. Validation compares these with real young moraine country.
 */
export function landStats(layout: ValleyLayout) {
  const { terrain, ground } = layout
  const { cells, cellCm, height } = terrain
  const points = cells + 1
  let lowest = Infinity
  let highest = -Infinity
  for (const h of height) {
    lowest = Math.min(lowest, h)
    highest = Math.max(highest, h)
  }
  const counts = [0, 0, 0, 0]
  for (const kind of ground) counts[kind]! += 1
  const steeper = [0, 0, 0]
  for (let j = 0; j < cells; j += 1)
    for (let i = 0; i < cells; i += 1) {
      const slope = cellSlopePercent(
        cellCm,
        height[j * points + i]!,
        height[j * points + i + 1]!,
        height[(j + 1) * points + i]!,
        height[(j + 1) * points + i + 1]!,
      )
      if (slope >= 5) steeper[0]! += 1
      if (slope >= 10) steeper[1]! += 1
      if (slope >= 20) steeper[2]! += 1
    }
  const area = cells * cells
  return {
    lowestCm: lowest,
    highestCm: highest,
    groundShares: Object.fromEntries(GROUND_NAMES.map((name, kind) => [name, counts[kind]! / area])),
    steeperThan5: steeper[0]! / area,
    steeperThan10: steeper[1]! / area,
    steeperThan20: steeper[2]! / area,
    kettles: terrain.kettles.map((kettle) => ({ radiusCm: kettle.radius, depthCm: kettle.depth })),
  }
}

/**
 * What the valley's rules imply. Experiments compare measured behaviour with these; foragers never use them.
 */
export function valleyTheory(config: ValleyConfig) {
  const night = nightHours(config)
  const daylight = 24 - night
  /** What an hour of walking under `kg` costs on the flat on soil. */
  const walkCost = (kg: number) => walkCostOnGrade(kg, 0)
  /** Speed and cost of walking under `kg` on a grade of `grade` percent over ground of `terrainPercent`. */
  const walkOnGrade = (kg: number, grade: number, terrainPercent = config.soilTerrainPercent) => {
    const speed = speedOnGrade(speedForLoad(config, kg), grade)
    return { speed, kcalPerHour: landWalkCost(config, kg, speed, grade, terrainPercent) }
  }
  const walkCostOnGrade = (kg: number, grade: number) => walkOnGrade(kg, grade).kcalPerHour
  const pickDelta = config.pickKcalPerHour - config.restKcalPerHour
  const gatherDelta = config.gatherKcalPerHour - config.restKcalPerHour
  const travelDelta = walkCost(0) - config.restKcalPerHour
  /** Sleeping warm every night hour and resting every daylight hour. */
  const fixedDailyCostKcal = night * config.sleepKcalPerHour + daylight * config.restKcalPerHour
  /**
   * Hours of foraging a day at hourly rate `g`, given `gatherHours` of gathering and `walkHours` of walking: each hour
   * of work or walking replaces an hour of rest, and foraging must pay for the whole day.
   */
  const forageHoursPerDay = (g: number, gatherHours: number, walkHours: number) =>
    (fixedDailyCostKcal + gatherHours * gatherDelta + walkHours * travelDelta) / (g - pickDelta)
  /** The food a forager eats in a day at rate `g`, which is its daily need. */
  const dailyNeedKcal = (g: number, gatherHours: number, walkHours: number) =>
    g * forageHoursPerDay(g, gatherHours, walkHours)
  const yearlyBerriesKcal = config.thicketCount * config.bushesPerThicket * config.bushRegrowthKcalPerYear
  const yearlyNutsKcal = config.hazelThicketCount * config.hazelsPerThicket * config.hazelRegrowthKcalPerYear
  /** The lake's fish grow fastest at half its stock: `lakeGrowthPercentPerYear / 400` of a full lake a year. */
  const yearlyFishKcal = (lakeCapacityKcal(config) * config.lakeGrowthPercentPerYear) / 400
  /** What the valley can give every year: berries, nuts, and the lake's fish held at its most productive stock. */
  const yearlyRegrowthKcal = yearlyBerriesKcal + yearlyNutsKcal + yearlyFishKcal
  const dailyRegrowthKcal = yearlyRegrowthKcal / 365
  /**
   * Below these shares of its capacity a source is no longer worth working to a forager of full rate `full`: an hour
   * there brings no more than it costs.
   */
  const worthWorkingBelow = (full: number) => config.pickKcalPerHour / full
  /** Wood gathered for one's own fires a day: a night's wood at rate `w`. */
  const gatherHoursPerDay = (w: number) => nightWood(config) / w
  /** The most spare wood a forager can hold after a trip for itself: `max(0, nightWood − 1 + woodLoad − woodTarget)`. */
  const maxSpareAfterTrip = Math.max(0, nightWood(config) - 1 + config.woodLoad - woodTarget(config))
  /** Loads no larger than this can never leave a forager with spare wood, so nothing is ever swapped or quoted. */
  const largestLoadWithoutSurplus = woodTarget(config) - nightWood(config) + 1
  /** Hours to walk from place centre to place centre across the whole valley once, about `placeCm` per place. */
  const sweepHours = (placeCount(config) * config.placeCm) / config.walkCmPerSecond / 3_600
  /** Seconds to walk `cm` centimetres under a load of `kg`. */
  const loadedWalkSeconds = (cm: number, kg: number) => Math.ceil(cm / speedForLoad(config, kg))
  /** What walking `cm` centimetres under a load of `kg` costs beyond walking it unloaded, in kilocalories. */
  const carryCostKcal = (cm: number, kg: number) =>
    (loadedWalkSeconds(cm, kg) * walkCost(kg) - loadedWalkSeconds(cm, 0) * walkCost(0)) / 3_600
  /**
   * The shortest tour through every site, about `0.7124 · √(n · A)` for `n` points spread over an area `A`
   * (Beardwood, Halton and Hammersley, 1959), with site centres in the square inside the margins; in hours of walking.
   */
  const siteSpan = config.valleySizeCm - 2 * config.siteMarginCm
  const shortestCheckTourHours =
    (0.7124 * Math.sqrt(siteCount(config) * siteSpan * siteSpan)) / config.walkCmPerSecond / 3_600
  return {
    nightHours: night,
    daylightHours: daylight,
    fixedDailyCostKcal,
    forageHoursPerDay,
    dailyNeedKcal,
    gatherHoursPerDay,
    yearlyBerriesKcal,
    yearlyNutsKcal,
    yearlyFishKcal,
    yearlyRegrowthKcal,
    dailyRegrowthKcal,
    worthWorkingBelow,
    /** Food the valley starts with: berries on the bushes, nuts on the hazels and fish in the lake. */
    initialFoodKcal:
      config.thicketCount * config.bushesPerThicket * config.initialBushKcal +
      config.hazelThicketCount * config.hazelsPerThicket * config.initialHazelKcal +
      lakeCapacityKcal(config),
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
    speedForLoad: (kg: number) => speedForLoad(config, kg),
    /** What an hour of walking under a load of `kg` costs on the flat, by the Pandolf equation. */
    walkCost,
    /** Speed and hourly cost on a slope, by Tobler's function and the Pandolf equation with Santee's correction. */
    walkOnGrade,
    /** A forager's estimate of walking `cm` on the flat while climbing `climbCm`, by Naismith's rule. */
    estimateSeconds: (cm: number, climbCm: number) =>
      Math.ceil(cm / config.walkCmPerSecond) + Math.ceil((config.climbSecondsPerMetre * Math.max(0, climbCm)) / 100),
    loadedWalkSeconds,
    carryCostKcal,
    shortestCheckTourHours,
    /** The wood a group's fire burns in a night, whatever the group's size. */
    campfireNightWood: night * config.campfireWoodPerHour,
    /** The wood each member of a group of `n` needs a night with one shared fire. */
    campfireWoodPerMember: (n: number) => (night * config.campfireWoodPerHour) / n,
    /** Hours of gathering a day for a member of a group of `n` at rate `w`, its share of the fire's night. */
    campfireGatherHoursPerDay: (n: number, w: number) => (night * config.campfireWoodPerHour) / n / w,
    /** What an axe costs to make at craft `craft`: its hours times the extra energy of making, `3,000 · 100 / craft`. */
    axeAsk: (craft: number) => askOf(config, craft),
    /** A first axe is made at half one's born craft: `2 · axeHours` hours at craft 100%. */
    firstAxeHours: (config.axeHours * 100) / Math.floor((100 * config.practiceMinPercent) / 100),
    /** Hours of cutting for a hut's logs with an axe of quality `quality`. */
    hutCutHours: (quality: number) => (config.hutLogs * config.logChopMinutes * 100) / quality / 60,
    /**
     * Logs every tree holds standing, and the most they can regrow a day: every tree felled, cut up at once and grown
     * back after `treeRegrowthDays`.
     */
    logsOnOffer: config.standCount * config.treesPerStand * config.logsPerTree,
    logsRegrownPerDay: (config.standCount * config.treesPerStand * config.logsPerTree) / config.treeRegrowthDays,
    /** Sticks and dead branches the valley starts with, and the most it adds in a year. */
    woodOnOffer:
      config.standCount * config.treesPerStand * config.initialTreeWood +
      config.thicketCount * config.bushesPerThicket * config.initialBushWood,
    woodRegrownPerYear:
      config.standCount * config.treesPerStand * config.treeDeadfallWoodPerYear +
      (config.thicketCount * config.bushesPerThicket * config.bushRegrowthWoodPerDecade) / 10,
    /** Logs a whole hut loses to the weather each day, which its builder must replace. */
    hutLogsPerMemberDay: 1 / config.hutLogDays,
  }
}
