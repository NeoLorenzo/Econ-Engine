import { segmentEnergyRate } from './routes'
import { askOf } from './axes'
import { fishCapacityKcal } from './config'
import { speedForLoad } from './forager'
import { GROUND_NAMES, cellSlopePercent } from './terrain'
import { nightHours, nightWood, woodTarget } from './trade'
import type { ValleyConfig, ValleyLayout } from './types'

/** Measurements of fixed water geography; none of these aggregates drives decisions. */
export function waterStats(layout: ValleyLayout) {
  const water = layout.terrain.water
  const lakes = water.bodies.filter((body) => body.kind === 'lake')
  const rivers = water.bodies.filter((body) => body.kind === 'river')
  const riverLengthM = rivers.reduce((sum, body) => sum + (body.cells.length * water.cellCm) / 100, 0)
  return {
    areaM2: water.bodies.reduce((sum, body) => sum + body.areaM2, 0),
    lakes: lakes.length,
    lakeAreasM2: lakes.map((body) => body.areaM2),
    lakeDepthsCm: lakes.map((body) => body.maxDepthCm),
    riverReaches: rivers.length,
    riverLengthM,
    drainageDensityMPerKm2: riverLengthM / ((water.cells * water.cellCm) / 100_000) ** 2,
    boundaryExits: water.parent.reduce((sum, parent, id) => sum + (parent === -1 && water.body[id]! >= 0 ? 1 : 0), 0),
    representedChannelWidthCm: water.cellCm,
  }
}

/**
 * The generated land, measured at several scales: relief, surface shares, slopes, roughness and landform dimensions.
 * Validation compares these with official elevation data for young-moraine country.
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
  const roughnessAt = (step: number) => {
    let total = 0
    let samples = 0
    for (let j = 0; j + step < points; j += step)
      for (let i = 0; i + step < points; i += step) {
        const here = height[j * points + i]!
        total += Math.abs(height[j * points + i + step]! - here)
        total += Math.abs(height[(j + step) * points + i]! - here)
        samples += 2
      }
    return samples ? total / samples : 0
  }
  return {
    lowestCm: lowest,
    highestCm: highest,
    groundShares: Object.fromEntries(GROUND_NAMES.map((name, kind) => [name, counts[kind]! / area])),
    steeperThan5: steeper[0]! / area,
    steeperThan10: steeper[1]! / area,
    steeperThan20: steeper[2]! / area,
    roughnessCm: {
      at15m: roughnessAt(Math.max(1, Math.round(1_500 / cellCm))),
      at60m: roughnessAt(Math.max(1, Math.round(6_000 / cellCm))),
      at240m: roughnessAt(Math.max(1, Math.round(24_000 / cellCm))),
    },
    landforms: {
      moraineBelts: terrain.moraines.length,
      drumlins: terrain.drumlins.length,
      kames: terrain.kames.length,
      hummocks: terrain.hummocks.length,
      tunnelValleys: terrain.tunnelValleys.length,
    },
    kettles: terrain.kettles.map((kettle) => ({ radiusCm: kettle.radius, depthCm: kettle.depth })),
  }
}

/**
 * What the valley's rules imply. Experiments compare measured behaviour with these; foragers never use them.
 */
export function valleyTheory(config: ValleyConfig) {
  const night = nightHours(config),
    daylight = 24 - night
  const fixedDailyCostKcal = night * config.sleepKcalPerHour + daylight * config.restKcalPerHour
  const yearlyBerriesKcal = config.thicketCount * config.berryThicketRegrowthKcalPerYear
  const yearlyNutsKcal = config.hazelThicketCount * config.hazelThicketRegrowthKcalPerYear
  const yearlyFishKcal = (fishCapacityKcal(config) * config.fishGrowthPercentPerYear) / 400
  const yearlyRegrowthKcal = yearlyBerriesKcal + yearlyNutsKcal + yearlyFishKcal,
    dailyRegrowthKcal = yearlyRegrowthKcal / config.daysPerYear
  const forageHoursPerDay = (rate: number, gatherHours: number, walkHours: number) =>
    (fixedDailyCostKcal +
      gatherHours * (config.gatherKcalPerHour - config.restKcalPerHour) +
      walkHours * (config.walkKcalPerHour - config.restKcalPerHour)) /
    (rate - (config.pickKcalPerHour - config.restKcalPerHour))
  return {
    nightHours: night,
    daylightHours: daylight,
    fixedDailyCostKcal,
    yearlyBerriesKcal,
    yearlyNutsKcal,
    yearlyFishKcal,
    yearlyRegrowthKcal,
    dailyRegrowthKcal,
    initialFoodKcal:
      config.thicketCount * config.berryThicketCapacityKcal +
      config.hazelThicketCount * config.hazelThicketCapacityKcal +
      fishCapacityKcal(config),
    forageHoursPerDay,
    dailyNeedKcal: (rate: number, gatherHours: number, walkHours: number) =>
      rate * forageHoursPerDay(rate, gatherHours, walkHours),
    carryingCapacity: (need: number) => dailyRegrowthKcal / need,
    campfireNightWood: night * config.campfireWoodPerHour,
    campfireWoodPerMember: (people: number) => (night * config.campfireWoodPerHour) / people,
    campfireGatherHoursPerDay: (people: number, rate: number) => (night * config.campfireWoodPerHour) / people / rate,
    nightWood: nightWood(config),
    woodTarget: woodTarget(config),
    axeAsk: (craft: number) => askOf(config, craft),
    logsOnOffer: config.standCount * config.standLogs,
    logsRegrownPerDay: (config.standCount * config.standLogs) / (config.treeRegrowthYears * config.daysPerYear),
    woodOnOffer: config.standCount * config.standWoodKg + config.thicketCount * config.berryThicketWoodKg,
    woodRegrownPerYear:
      config.standCount * config.standDeadfallKgPerYear +
      config.thicketCount * config.berryThicketWoodRegrowthKgPerYear,
    estimateMinutes: (cm: number, climbCm: number) =>
      Math.ceil(cm / (config.walkCmPerSecond * 60)) +
      Math.ceil((config.climbMinutesPerMetre * Math.max(0, climbCm)) / 100),
    lazyRestDay: { kcal: 24 * config.restKcalPerHour, waterMl: config.waterBaseMlPerDay },
    lazyPickingFourHours: {
      kcal: 4 * config.pickKcalPerHour,
      extraWaterMl: 4 * Math.max(0, config.pickKcalPerHour - config.restKcalPerHour) * config.waterExtraMlPerKcal,
    },
    walkCostOnClass: (slope: 0 | 1 | 2, uphill: boolean) => segmentEnergyRate(config, slope, uphill),
    speedForLoad: (kg: number) => speedForLoad(config, kg),
  }
}
