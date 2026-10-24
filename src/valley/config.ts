import { isqrt } from './geometry'
import { waterThresholds } from './body'
import { terrainOf } from './terrain'
import { fishCapacity } from './fish'
import type { Point, ValleyConfig } from './types'

/**
 * The canonical Life 13 land: 4 km square of young moraine country in Mesolithic northern Europe, a broad rise and
 * fall of up to 30 m with broken moraine fronts, drumlins, kames, clustered hummocks, kettle hollows and tunnel
 * valleys, lakes in hollows and connected downhill river reaches. Its grassland surface is grass, dirt or stone.
 * Resources are places with one stock each: 800 berry thickets, 800 hazel thickets, 300 stands of 36 logs and 100
 * outcrops of 60 stones. Forty founders born with foraging skills from 75% to 125% start scattered over the middle
 * 800 m. Slopes fall into three classes that slow walking and raise its cost; the ground sets its terrain factor.
 * Every member wants a hut of 23 logs, cut from felled trees with a ground stone axe it makes or buys. A year has
 * `daysPerYear` days. Measurements and explicit estimates are sourced in docs/CALIBRATION.md.
 */
export const VALLEY_DEFAULT_CONFIG: ValleyConfig = {
  daysPerYear: 90,
  meshMaxEdgeCm: 4_000,
  meshHeightToleranceCm: 100,
  shoreToleranceCm: 100,
  walkKcalPerHour: 250,
  moderateSlowdownPerMille: 1_300,
  steepDownSlowdownPerMille: 1_300,
  climbMinutesPerMetre: 1,
  berryThicketCapacityKcal: 3_120,
  berryThicketRegrowthKcalPerYear: 54_000,
  berryThicketWoodKg: 120,
  berryThicketWoodRegrowthKgPerYear: 12,
  hazelThicketCapacityKcal: 75_000,
  hazelThicketRegrowthKcalPerYear: 150_000,
  standWoodKg: 300,
  standDeadfallKgPerYear: 60,
  standLogs: 36,
  outcropStones: 60,
  treeRegrowthYears: 20,
  riverCatchmentM2: 250_000,
  riverDepthCm: 50,
  drinkBankHeightCm: 100,
  fishMinAreaM2: 1_000,
  fishKgPerHectare: 100,
  fishGrowthPercentPerYear: 40,
  waterBaseMlPerDay: 2_000,
  waterExtraMlPerKcal: 1,
  thirstBodyPerMille: 10,
  urgentThirstBodyPerMille: 30,
  fatalWaterLossBodyPerMille: 100,
  initialWaterDeficitMl: 0,
  drinkStopMl: 100,
  drinkMlPerSecond: 10,
  seed: 20260813,
  valleySizeCm: 400_000,
  terrainCellCm: 500,
  chunkCm: 20_000,
  reliefCm: 3_500,
  reliefWavelengthCm: 120_000,
  iceFlowControlCm: 100_000,
  iceFlowTurnSteps: 2,
  moraineBeltCount: 3,
  moraineMinHalfWidthCm: 5_000,
  moraineMaxHalfWidthCm: 18_000,
  moraineMinHeightCm: 800,
  moraineMaxHeightCm: 2_200,
  moraineMinControlCm: 15_000,
  moraineMaxControlCm: 30_000,
  drumlinCount: 56,
  drumlinMinLengthCm: 20_000,
  drumlinMaxLengthCm: 70_000,
  drumlinMinWidthCm: 5_000,
  drumlinMaxWidthCm: 18_000,
  drumlinMinHeightCm: 500,
  drumlinMaxHeightCm: 1_800,
  drumlinMinAspectPerMille: 3_000,
  kameCount: 18,
  kameMinRadiusCm: 4_000,
  kameMaxRadiusCm: 12_000,
  kameMinHeightCm: 500,
  kameMaxHeightCm: 1_500,
  hummockClusterCount: 4,
  hummockCount: 240,
  hummockMinWidthCm: 1_500,
  hummockMaxWidthCm: 5_000,
  hummockMinHeightCm: 200,
  hummockMaxHeightCm: 700,
  smallKettleCount: 64,
  largeKettleCount: 12,
  smallKettleMinRadiusCm: 1_500,
  smallKettleMaxRadiusCm: 5_500,
  largeKettleMinRadiusCm: 6_000,
  largeKettleMaxRadiusCm: 20_000,
  kettleDepthPerMille: 125,
  kettleMaxDepthCm: 1_200,
  tunnelValleyCount: 2,
  tunnelValleyMinWidthCm: 12_000,
  tunnelValleyMaxWidthCm: 35_000,
  tunnelValleyMinDepthCm: 600,
  tunnelValleyMaxDepthCm: 2_000,
  tunnelValleyMinControlCm: 20_000,
  tunnelValleyMaxControlCm: 40_000,
  microCoarseWavelengthCm: 6_000,
  microCoarseAmplitudeCm: 250,
  microFineWavelengthCm: 1_500,
  microFineAmplitudeCm: 70,
  dirtSlopePercent: 10,
  stoneSlopePercent: 30,
  dirtCurvatureCm: 40,
  startAreaCm: 80_000,
  thicketCount: 800,
  thicketRadiusCm: 1_200,
  hazelThicketCount: 800,
  hazelThicketRadiusCm: 2_000,
  nutKcalPerHour: 3_500,
  nutKcalPerKg: 2_500,
  nutShelfLifeHours: 4_380,
  fishKcalPerHour: 600,
  fishKcalPerKg: 600,
  fishShelfLifeHours: 24,
  standCount: 300,
  standRadiusCm: 1_500,
  fellWood: 10,
  siteSpacingCm: 5_000,
  siteMarginCm: 3_000,
  campClearingCm: 4_000,
  hutRingCm: 700,
  walkCmPerSecond: 125,
  reachCm: 100,
  perceptionRadiusCm: 2_500,
  talkRadiusCm: 2_000,
  dawnHour: 6,
  duskHour: 18,
  berryKcalPerHour: 1_200,
  woodPerHour: 15,
  sleepKcalPerHour: 60,
  restKcalPerHour: 90,
  pickKcalPerHour: 200,
  gatherKcalPerHour: 250,
  chopKcalPerHour: 360,
  makeKcalPerHour: 150,
  grassTerrainPercent: 120,
  dirtTerrainPercent: 120,
  stoneTerrainPercent: 150,
  loadSlowdownPerMille: 75,
  reserveMaxKcal: 70_000,
  initialReserveKcal: 66_000,
  hungryBelowKcal: 64_000,
  satiatedAtKcal: 68_000,
  founders: 40,
  berryShelfLifeHours: 48,
  fireWoodPerHour: 1,
  fireSleepKcalPerHour: 70,
  hutSleepKcalPerHour: 75,
  coldSleepKcalPerHour: 90,
  woodStockNights: 2,
  woodLoad: 30,
  skillMinPercent: 75,
  skillMaxPercent: 125,
  termsMemoryHours: 24,
  practiceDays: 30,
  practiceHalfHours: 60,
  practiceMinPercent: 50,
  practiceMaxPercent: 150,
  startPracticeHoursPerDay: 2,
  scattered: true,
  startSpacingCm: 5_000,
  exploreAfterHours: 24,
  sightRadiusCm: 100_000,
  bodyKg: 60,
  berryKcalPerKg: 600,
  campfireWoodPerHour: 1,
  outcropCount: 100,
  outcropRadiusCm: 1_000,
  logsPerTree: 3,
  logKg: 35,
  logChopMinutes: 30,
  hutLogs: 23,
  hutLogDays: 60,
  axeHours: 50,
  axeLogs: 200,
  axeWood: 1,
  craftSkillMinPercent: 100,
  craftSkillMaxPercent: 100,
  axeTrade: true,
  craftPractice: true,
}

/**
 * A flat grassy land the size of Life 9.7's valley, 800 m square with its sites and lake: no relief or landforms.
 * Tests of rules that do not need the terrain run on it, with Life 11's eight founders.
 */
export const FLAT_LAND: Partial<ValleyConfig> = {
  founders: 8,
  valleySizeCm: 80_000,
  thicketCount: 32,
  hazelThicketCount: 32,
  standCount: 12,
  outcropCount: 4,
  reliefCm: 0,
  moraineBeltCount: 0,
  drumlinCount: 0,
  kameCount: 0,
  hummockClusterCount: 0,
  hummockCount: 0,
  smallKettleCount: 0,
  largeKettleCount: 0,
  tunnelValleyCount: 0,
  microCoarseAmplitudeCm: 0,
  microFineAmplitudeCm: 0,
  startAreaCm: 80_000,
  reliefWavelengthCm: 80_000,
}

const BOOLEAN_KEYS = new Set(['scattered', 'axeTrade', 'craftPractice'])

/** The most fish the lake holds, in kilocalories: its area times its fish a hectare. */
export const fishCapacityKcal = (config: ValleyConfig) =>
  terrainOf(config).water.bodies.reduce(
    (sum, body) => sum + fishCapacity(body.areaM2, config.fishMinAreaM2, config.fishKgPerHectare, config.fishKcalPerKg),
    0,
  )

/** The points of the square spiral around the camp: the 8 of the first ring, then the 16 of the second, and so on. */
export function spiralOffsets(count: number) {
  return spiralPrefix(count).slice(0, count)
}

/** The spiral's points computed so far; every longer spiral starts with every shorter one. */
let spiral: [number, number][] = []

/** Point `index` of the spiral, from 0. */
export const spiralOffset = (index: number) => spiralPrefix(index + 1)[index]!

/** The ring that slot `slot` round a flag lies on, from 1: the square spiral's ring. */
export function ringOf(slot: number) {
  const [dx, dy] = spiralOffset(slot)
  return Math.max(Math.abs(dx), Math.abs(dy))
}

/**
 * Slot `slot` round a flag, as an offset in whole centimetres: point `slot` of the square spiral, on ring `k`, moved
 * along its direction from the flag onto the circle `k · hutRingCm` from it. Ring `k` holds `8k` huts, the first
 * ring's evenly round the fire. Integer square roots keep it exact on every machine.
 */
export function ringOffset(config: Pick<ValleyConfig, 'hutRingCm'>, slot: number): Point {
  const [dx, dy] = spiralOffset(slot)
  const radius = ringOf(slot) * config.hutRingCm
  // The length of (dx, dy) in ten-thousandths, rounded down.
  const length = isqrt((dx * dx + dy * dy) * 100_000_000)
  return { x: Math.trunc((dx * radius * 10_000) / length), y: Math.trunc((dy * radius * 10_000) / length) }
}

function spiralPrefix(count: number) {
  if (spiral.length < count) spiral = computeSpiral(Math.max(count, 2 * spiral.length, 64))
  return spiral
}

function computeSpiral(count: number) {
  const points: [number, number][] = []
  for (let ring = 1; points.length < count; ring += 1) {
    for (let x = -ring; x <= ring; x += 1) points.push([x, -ring])
    for (let y = -ring + 1; y <= ring; y += 1) points.push([ring, y])
    for (let x = ring - 1; x >= -ring; x -= 1) points.push([x, ring])
    for (let y = ring - 1; y >= -ring + 1; y -= 1) points.push([-ring, y])
  }
  return points.slice(0, count)
}

/** Returns every rule the configuration breaks, except whether its layout can be drawn, which `createValley` finds. */
export function valleyConfigErrors(config: ValleyConfig): string[] {
  const calendarErrors =
    Number.isInteger(config.daysPerYear) && config.daysPerYear >= 8 && config.daysPerYear <= 365
      ? []
      : ['daysPerYear must be an integer from 8 to 365']
  const errors: string[] = [...calendarErrors]
  for (const [key, value] of Object.entries(config)) {
    if (BOOLEAN_KEYS.has(key)) {
      if (typeof value !== 'boolean') errors.push(`${key} must be true or false`)
    } else if (!Number.isInteger(value)) errors.push(`${key} must be an integer`)
    else if (!Number.isSafeInteger(value)) errors.push(`${key} must be a safe integer`)
  }
  if (errors.length) return errors
  const thresholds = waterThresholds(config)
  if (Object.values(thresholds).some((value) => !Number.isSafeInteger(value)))
    errors.push('Body water thresholds exceed safe integer limits')
  const maxFish =
    (BigInt(config.valleySizeCm) ** 2n * BigInt(Math.max(0, config.fishKgPerHectare)) * BigInt(config.fishKcalPerKg)) /
    100_000_000n
  if (maxFish * 876_000n > BigInt(Number.MAX_SAFE_INTEGER))
    errors.push('Fish capacity exceeds supported stock/remainder limits')
  if (!(
    0 <= config.initialWaterDeficitMl &&
    config.initialWaterDeficitMl < thresholds.thirsty &&
    0 <= config.drinkStopMl &&
    config.drinkStopMl < thresholds.thirsty &&
    thresholds.thirsty < thresholds.urgent &&
    thresholds.urgent < thresholds.fatal
  ))
    errors.push('Water deficit and rounded body thresholds must be ordered')
  for (const key of [
    'riverCatchmentM2',
    'riverDepthCm',
    'fishMinAreaM2',
    'waterBaseMlPerDay',
    'drinkMlPerSecond',
  ] as const)
    if (config[key] <= 0) errors.push(`${key} must be positive`)
  for (const key of [
    'drinkBankHeightCm',
    'fishKgPerHectare',
    'fishGrowthPercentPerYear',
    'waterExtraMlPerKcal',
  ] as const)
    if (config[key] < 0) errors.push(`${key} must not be negative`)
  if (config.terrainCellCm % 100 !== 0 || config.valleySizeCm / config.terrainCellCm > 2_000)
    errors.push('Water grids support whole-metre cells and at most 2000 cells per side')
  const positive: (keyof ValleyConfig)[] = [
    'valleySizeCm',
    'thicketCount',
    'thicketRadiusCm',
    'berryThicketCapacityKcal',
    'hazelThicketRadiusCm',
    'hazelThicketCapacityKcal',
    'standWoodKg',
    'standLogs',
    'walkKcalPerHour',
    'moderateSlowdownPerMille',
    'steepDownSlowdownPerMille',
    'treeRegrowthYears',
    'nutKcalPerHour',
    'nutKcalPerKg',
    'fishKcalPerHour',
    'fishKcalPerKg',
    'standRadiusCm',
    'siteSpacingCm',
    'campClearingCm',
    'hutRingCm',
    'walkCmPerSecond',
    'reachCm',
    'perceptionRadiusCm',
    'talkRadiusCm',
    'berryKcalPerHour',
    'woodPerHour',
    'founders',
    'fireWoodPerHour',
    'woodStockNights',
    'practiceDays',
    'practiceHalfHours',
    'startSpacingCm',
    'exploreAfterHours',
    'sightRadiusCm',
    'bodyKg',
    'berryKcalPerKg',
    'campfireWoodPerHour',
    'outcropRadiusCm',
    'logsPerTree',
    'logKg',
    'logChopMinutes',
    'hutLogs',
    'hutLogDays',
    'axeHours',
    'axeLogs',
    'pickKcalPerHour',
    'gatherKcalPerHour',
    'chopKcalPerHour',
    'makeKcalPerHour',
    'terrainCellCm',
    'chunkCm',
    'meshMaxEdgeCm',
    'meshHeightToleranceCm',
    'shoreToleranceCm',
    'reliefWavelengthCm',
    'iceFlowControlCm',
    'moraineMinHalfWidthCm',
    'moraineMaxHalfWidthCm',
    'moraineMinHeightCm',
    'moraineMaxHeightCm',
    'moraineMinControlCm',
    'moraineMaxControlCm',
    'drumlinMinLengthCm',
    'drumlinMaxLengthCm',
    'drumlinMinWidthCm',
    'drumlinMaxWidthCm',
    'drumlinMinHeightCm',
    'drumlinMaxHeightCm',
    'drumlinMinAspectPerMille',
    'kameMinRadiusCm',
    'kameMaxRadiusCm',
    'kameMinHeightCm',
    'kameMaxHeightCm',
    'hummockMinWidthCm',
    'hummockMaxWidthCm',
    'hummockMinHeightCm',
    'hummockMaxHeightCm',
    'smallKettleMinRadiusCm',
    'smallKettleMaxRadiusCm',
    'largeKettleMinRadiusCm',
    'largeKettleMaxRadiusCm',
    'kettleMaxDepthCm',
    'tunnelValleyMinWidthCm',
    'tunnelValleyMaxWidthCm',
    'tunnelValleyMinDepthCm',
    'tunnelValleyMaxDepthCm',
    'tunnelValleyMinControlCm',
    'tunnelValleyMaxControlCm',
    'microCoarseWavelengthCm',
    'microFineWavelengthCm',
    'startAreaCm',
  ]
  for (const key of positive) if ((config[key] as number) <= 0) errors.push(`${key} must be positive`)
  const notNegative: (keyof ValleyConfig)[] = [
    'berryThicketRegrowthKcalPerYear',
    'berryThicketWoodKg',
    'berryThicketWoodRegrowthKgPerYear',
    'hazelThicketCount',
    'hazelThicketRegrowthKcalPerYear',
    'nutShelfLifeHours',
    'fishShelfLifeHours',
    'standCount',
    'standDeadfallKgPerYear',
    'outcropStones',
    'climbMinutesPerMetre',
    'fellWood',
    'siteMarginCm',
    'sleepKcalPerHour',
    'restKcalPerHour',
    'berryShelfLifeHours',
    'woodLoad',
    'termsMemoryHours',
    'outcropCount',
    'axeWood',
    'loadSlowdownPerMille',
    'reliefCm',
    'iceFlowTurnSteps',
    'moraineBeltCount',
    'drumlinCount',
    'kameCount',
    'hummockClusterCount',
    'hummockCount',
    'smallKettleCount',
    'largeKettleCount',
    'tunnelValleyCount',
    'microCoarseAmplitudeCm',
    'microFineAmplitudeCm',
    'kettleDepthPerMille',
    'dirtSlopePercent',
    'stoneSlopePercent',
    'dirtCurvatureCm',
  ]
  for (const key of notNegative) if ((config[key] as number) < 0) errors.push(`${key} must not be negative`)
  if (errors.length) return errors
  if (config.reachCm >= config.perceptionRadiusCm) errors.push('reachCm must be less than perceptionRadiusCm')
  if (config.founders > 1_000) errors.push('founders must be from 1 to 1,000')
  if (config.standLogs % config.logsPerTree !== 0) errors.push('standLogs must be a whole number of logsPerTree')
  if (config.dawnHour < 0 || config.dawnHour >= config.duskHour || config.duskHour > 24)
    errors.push('Hours must satisfy 0 ≤ dawnHour < duskHour ≤ 24')
  if (
    config.hungryBelowKcal <= 0 ||
    config.hungryBelowKcal >= config.satiatedAtKcal ||
    config.satiatedAtKcal > config.reserveMaxKcal
  )
    errors.push('Thresholds must satisfy 0 < hungryBelowKcal < satiatedAtKcal ≤ reserveMaxKcal')
  if (config.initialReserveKcal <= 0 || config.initialReserveKcal > config.reserveMaxKcal)
    errors.push('initialReserveKcal must be between 1 and reserveMaxKcal')
  // A fire warms more than a hut, and both together most.
  if (
    config.fireSleepKcalPerHour < config.sleepKcalPerHour ||
    config.hutSleepKcalPerHour < config.fireSleepKcalPerHour ||
    config.coldSleepKcalPerHour < config.hutSleepKcalPerHour
  )
    errors.push(
      'Sleep must satisfy sleepKcalPerHour ≤ fireSleepKcalPerHour ≤ hutSleepKcalPerHour ≤ coldSleepKcalPerHour',
    )
  // Every task costs more than resting; an axe costs the extra energy of making instead of resting.
  for (const key of ['pickKcalPerHour', 'gatherKcalPerHour', 'chopKcalPerHour', 'makeKcalPerHour'] as const)
    if (config[key] <= config.restKcalPerHour) errors.push(`${key} must be more than restKcalPerHour`)
  for (const key of ['grassTerrainPercent', 'dirtTerrainPercent', 'stoneTerrainPercent'] as const)
    if (config[key] < 100) errors.push(`${key} must be at least 100`)
  if (config.valleySizeCm % config.terrainCellCm !== 0)
    errors.push('The land must be a whole number of terrain cells: valleySizeCm divisible by terrainCellCm')
  for (const key of [
    'reliefWavelengthCm',
    'iceFlowControlCm',
    'microCoarseWavelengthCm',
    'microFineWavelengthCm',
  ] as const)
    if (config[key] % config.terrainCellCm !== 0) errors.push(`${key} must be a whole number of terrain cells`)
  for (const [min, max] of [
    ['moraineMinHalfWidthCm', 'moraineMaxHalfWidthCm'],
    ['moraineMinHeightCm', 'moraineMaxHeightCm'],
    ['moraineMinControlCm', 'moraineMaxControlCm'],
    ['drumlinMinLengthCm', 'drumlinMaxLengthCm'],
    ['drumlinMinWidthCm', 'drumlinMaxWidthCm'],
    ['drumlinMinHeightCm', 'drumlinMaxHeightCm'],
    ['kameMinRadiusCm', 'kameMaxRadiusCm'],
    ['kameMinHeightCm', 'kameMaxHeightCm'],
    ['hummockMinWidthCm', 'hummockMaxWidthCm'],
    ['hummockMinHeightCm', 'hummockMaxHeightCm'],
    ['smallKettleMinRadiusCm', 'smallKettleMaxRadiusCm'],
    ['largeKettleMinRadiusCm', 'largeKettleMaxRadiusCm'],
    ['tunnelValleyMinWidthCm', 'tunnelValleyMaxWidthCm'],
    ['tunnelValleyMinDepthCm', 'tunnelValleyMaxDepthCm'],
    ['tunnelValleyMinControlCm', 'tunnelValleyMaxControlCm'],
  ] as const)
    if (config[min] > config[max]) errors.push(`${min} must not exceed ${max}`)
  if (config.iceFlowTurnSteps > 4) errors.push('iceFlowTurnSteps must be at most 4')
  if (config.drumlinMinAspectPerMille < 1_000) errors.push('drumlinMinAspectPerMille must be at least 1,000')
  if (config.kettleDepthPerMille > 1_000) errors.push('kettleDepthPerMille must be at most 1,000')
  if (config.dirtSlopePercent > config.stoneSlopePercent)
    errors.push('dirtSlopePercent must not exceed stoneSlopePercent')
  if (config.startAreaCm > config.valleySizeCm) errors.push('startAreaCm must not exceed the land’s width')
  // Points at least startSpacingCm apart in a square startAreaCm wide: at most one per spacing cell, corners included.
  const startRoom = (Math.floor(config.startAreaCm / config.startSpacingCm) + 1) ** 2
  if (config.scattered && config.founders > startRoom)
    errors.push(`founders: the start area holds at most ${startRoom} people at startSpacingCm`)
  // Heights times the lattice's interpolation weights must stay exact integers.
  const highestTerrain =
    config.reliefCm +
    config.moraineMaxHeightCm +
    config.drumlinMaxHeightCm +
    config.kameMaxHeightCm +
    config.hummockMaxHeightCm +
    config.microCoarseAmplitudeCm +
    config.microFineAmplitudeCm
  if (highestTerrain * config.terrainCellCm ** 2 > 2 ** 52)
    errors.push('The terrain is too high to be computed exactly')
  const depthBound =
    config.kettleMaxDepthCm +
    config.tunnelValleyMaxDepthCm +
    config.microCoarseAmplitudeCm +
    config.microFineAmplitudeCm +
    config.riverDepthCm
  if (highestTerrain > 2_147_483_647 || depthBound > 2_147_483_647)
    errors.push('Terrain or channel heights exceed Int32 limits')
  if (config.reliefCm * (config.reliefWavelengthCm / config.terrainCellCm) ** 3 > 2 ** 52)
    errors.push('The broad relief is too high or too long to be computed exactly')
  const logSpeed =
    (config.walkCmPerSecond * (1_000 * config.bodyKg - config.loadSlowdownPerMille * config.logKg)) /
    (1_000 * config.bodyKg)
  if (Math.floor(logSpeed) < 1) errors.push('A forager must be able to carry a log at 1 cm a second')
  if (config.startPracticeHoursPerDay < 0 || config.startPracticeHoursPerDay > 24)
    errors.push('startPracticeHoursPerDay must be between 0 and 24')
  const practiceRangeOk = config.practiceMinPercent >= 1 && config.practiceMinPercent <= config.practiceMaxPercent
  if (!practiceRangeOk) errors.push('Practice must satisfy 1 ≤ practiceMinPercent ≤ practiceMaxPercent')
  const skillRangeOk = config.skillMinPercent >= 1 && config.skillMinPercent <= config.skillMaxPercent
  if (!skillRangeOk) errors.push('Skills must satisfy 1 ≤ skillMinPercent ≤ skillMaxPercent')
  if (config.craftSkillMinPercent < 1 || config.craftSkillMinPercent > config.craftSkillMaxPercent)
    errors.push('Craft must satisfy 1 ≤ craftSkillMinPercent ≤ craftSkillMaxPercent')
  if (practiceRangeOk && skillRangeOk) {
    const low = config.practiceMinPercent
    const high = config.practiceMaxPercent
    const lowest = (base: number) => Math.floor((base * config.skillMinPercent * low) / 10_000)
    const highest = (base: number) => Math.floor((base * config.skillMaxPercent * high) / 10_000)
    if (lowest(config.woodPerHour) < 1) errors.push('The lowest gathering rate must be at least 1')
    // A full source must be worth working even to the slowest forager, who would otherwise never eat that food.
    for (const key of ['berryKcalPerHour', 'nutKcalPerHour', 'fishKcalPerHour'] as const)
      if (lowest(config[key]) <= config.pickKcalPerHour)
        errors.push(`${key} at the lowest skill and practice must be more than pickKcalPerHour`)
    // A minute's work at the fastest rate must fit in a full place, or no full place could ever be worked.
    if (Math.ceil(highest(config.woodPerHour) / 60) > config.standWoodKg)
      errors.push('A stand must hold a minute of gathering at the fastest rate')
    if (config.berryThicketWoodKg > 0 && Math.ceil(highest(config.woodPerHour) / 60) > config.berryThicketWoodKg)
      errors.push('A thicket that holds sticks must hold a minute of gathering at the fastest rate')
  }
  // A band that starts around the camp must have its huts in the camp's clearing, clear of every plant.
  if (!config.scattered) {
    const outer = ringOf(config.founders - 1) * config.hutRingCm
    const clear =
      config.campClearingCm -
      Math.max(config.thicketRadiusCm, config.hazelThicketRadiusCm, config.standRadiusCm, config.outcropRadiusCm)
    if (outer > clear) errors.push('The band’s huts must fit inside the camp’s clearing')
    if (config.founders < 2) errors.push('A band that starts as one group needs at least two foragers')
  }
  if (config.sightRadiusCm < config.perceptionRadiusCm)
    errors.push('Long sight must reach at least as far as close sight: sightRadiusCm ≥ perceptionRadiusCm')
  // A site is checked from within perceptionRadiusCm − its radius of its centre, which must leave room to stand.
  if (
    config.perceptionRadiusCm <=
    Math.max(config.thicketRadiusCm, config.hazelThicketRadiusCm, config.standRadiusCm, config.outcropRadiusCm)
  )
    errors.push('A site must fit in close sight to be checked: perceptionRadiusCm > every site radius')
  if (2 * config.siteMarginCm >= config.valleySizeCm) errors.push('siteMarginCm must leave room for sites')
  if (config.valleySizeCm > Math.floor(Math.sqrt(2 ** 51)))
    errors.push('Land coordinates exceed exact squared-distance limits')
  if (config.thicketCount + config.hazelThicketCount + config.standCount + config.outcropCount > 2_000_000)
    errors.push('Place allocations exceed the supported two million records')
  for (const key of [
    'berryThicketCapacityKcal',
    'berryThicketRegrowthKcalPerYear',
    'hazelThicketCapacityKcal',
    'hazelThicketRegrowthKcalPerYear',
    'standWoodKg',
    'standLogs',
    'outcropStones',
    'logsPerTree',
  ] as const)
    if (config[key] > 2_147_483_647) errors.push(`${key} exceeds Int32 stock limits`)
  const waterActivityBound =
    config.waterExtraMlPerKcal *
    Math.max(
      1_000_000,
      config.pickKcalPerHour,
      config.gatherKcalPerHour,
      config.chopKcalPerHour,
      config.makeKcalPerHour,
    )
  if (
    !Number.isSafeInteger(waterActivityBound) ||
    waterActivityBound > Number.MAX_SAFE_INTEGER - 3599 ||
    config.waterBaseMlPerDay > Number.MAX_SAFE_INTEGER - 86_399
  )
    errors.push('Water-loss numerators exceed supported exact integer limits')
  // Relief squares halve down to one terrain cell and tile the land; chunks hold whole squares.
  const squares = config.meshMaxEdgeCm / config.terrainCellCm
  if (!Number.isInteger(squares) || squares < 1 || (squares & (squares - 1)) !== 0)
    errors.push('meshMaxEdgeCm must be terrainCellCm times a power of two')
  if (config.valleySizeCm % config.meshMaxEdgeCm !== 0) errors.push('meshMaxEdgeCm must divide valleySizeCm')
  if (config.chunkCm % config.meshMaxEdgeCm !== 0) errors.push('chunkCm must be a multiple of meshMaxEdgeCm')
  return errors
}

export function resolveValleyConfig(overrides: Partial<ValleyConfig> = {}): ValleyConfig {
  const config = { ...VALLEY_DEFAULT_CONFIG, ...overrides }
  const errors = valleyConfigErrors(config)
  if (errors.length) throw new Error(`Invalid valley configuration: ${errors.join('; ')}`)
  return config
}
