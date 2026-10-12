import type { LifeConfig } from './types'

/**
 * The canonical Life 4 world: Life 3's land with cold nights and eight groves of wood, and a band of 8 keepers born with
 * the same skills, who get better at what they do and worse at what they stop doing. Every harvest is steady, and
 * foragers may swap wood for food, telling each other the terms they would accept.
 */
export const LIFE_DEFAULT_CONFIG: LifeConfig = {
  seed: 20260813,
  gridWidth: 12,
  gridHeight: 12,
  patchCount: 32,
  patchCapacityKcal: 24_000,
  patchRegrowthKcalPerHour: 50,
  initialPatchStockKcal: 24_000,
  dawnHour: 6,
  duskHour: 18,
  tilesPerHour: 3,
  forageKcalPerHour: 1_200,
  sleepKcalPerHour: 60,
  restKcalPerHour: 90,
  forageCostKcalPerHour: 300,
  travelKcalPerHour: 300,
  reserveMaxKcal: 20_000,
  initialReserveKcal: 16_000,
  hungryBelowKcal: 14_000,
  satiatedAtKcal: 18_000,
  bandSize: 8,
  perceptionRadiusTiles: 2,
  hasCamp: true,
  harvestKcal: 600,
  shelfLifeHours: 48,
  sharers: 0,
  reciprocators: 0,
  groveCount: 8,
  groveCapacityWood: 200,
  initialGroveWood: 200,
  groveRegrowthWoodPerHour: 2,
  woodPerHour: 24,
  fireWoodPerHour: 1,
  coldSleepKcalPerHour: 150,
  woodStockNights: 2,
  skillMinPercent: 100,
  skillMaxPercent: 100,
  swapping: true,
  quotes: true,
  termsMemoryHours: 24,
  practice: true,
  practiceDays: 30,
  practiceHalfHours: 60,
  practiceMinPercent: 50,
  practiceMaxPercent: 150,
  startPracticeHoursPerDay: 2,
}

/** The overrides that give back Life 3: born skills from half to one and a half times the usual, and no practice. */
export const LIFE3_WORLD: Partial<LifeConfig> = {
  skillMinPercent: 50,
  skillMaxPercent: 150,
  practice: false,
}

/**
 * The overrides that give back Life 2: a band of 12, a third each keepers, sharers and reciprocators, with windfalls of
 * 6,000 kcal, warm nights, no groves, equal skills and no swapping.
 */
export const LIFE2_WORLD: Partial<LifeConfig> = {
  ...LIFE3_WORLD,
  bandSize: 12,
  harvestKcal: 6_000,
  sharers: 4,
  reciprocators: 4,
  groveCount: 0,
  coldSleepKcalPerHour: 60,
  skillMinPercent: 100,
  skillMaxPercent: 100,
  swapping: false,
}

/** The overrides that give back Life 1: a band of 40 keepers with no camp and steady harvests, on Life 1's world. */
export const LIFE1_WORLD: Partial<LifeConfig> = {
  ...LIFE2_WORLD,
  gridWidth: 24,
  gridHeight: 24,
  patchCount: 36,
  patchCapacityKcal: 8_000,
  initialPatchStockKcal: 8_000,
  bandSize: 40,
  hasCamp: false,
  harvestKcal: 1_200,
  sharers: 0,
  reciprocators: 0,
}

/** The overrides that give back Life 0: one forager, seeing only its own tile, on Life 0's world. */
export const LIFE0_WORLD: Partial<LifeConfig> = {
  ...LIFE1_WORLD,
  gridWidth: 12,
  gridHeight: 12,
  patchCount: 4,
  bandSize: 1,
  perceptionRadiusTiles: 0,
}

const BOOLEAN_KEYS = new Set(['hasCamp', 'swapping', 'quotes', 'practice'])

/** Returns every rule the configuration breaks, in the order the specification lists them. */
export function lifeConfigErrors(config: LifeConfig): string[] {
  const errors: string[] = []
  for (const [key, value] of Object.entries(config)) {
    if (BOOLEAN_KEYS.has(key)) {
      if (typeof value !== 'boolean') errors.push(`${key} must be true or false`)
    } else if (!Number.isInteger(value)) errors.push(`${key} must be an integer`)
  }
  if (errors.length) return errors
  const tiles = config.gridWidth * config.gridHeight
  if (config.gridWidth < 1 || config.gridHeight < 1) errors.push('The grid must be at least 1 × 1')
  if (config.patchCount < 1 || config.patchCount > tiles)
    errors.push(`patchCount must be between 1 and the number of tiles (${Math.max(0, tiles)})`)
  if (config.initialPatchStockKcal < 0 || config.initialPatchStockKcal > config.patchCapacityKcal)
    errors.push('initialPatchStockKcal must be between 0 and patchCapacityKcal')
  if (config.dawnHour < 0 || config.dawnHour >= config.duskHour || config.duskHour > 24)
    errors.push('Hours must satisfy 0 ≤ dawnHour < duskHour ≤ 24')
  if (config.tilesPerHour < 1) errors.push('tilesPerHour must be at least 1')
  if (config.patchCapacityKcal <= 0 || config.patchRegrowthKcalPerHour <= 0 || config.forageKcalPerHour <= 0)
    errors.push('Capacities and rates must be positive')
  if (
    config.sleepKcalPerHour < 0 ||
    config.restKcalPerHour < 0 ||
    config.forageCostKcalPerHour < 0 ||
    config.travelKcalPerHour < 0
  )
    errors.push('Costs must not be negative')
  if (
    config.hungryBelowKcal <= 0 ||
    config.hungryBelowKcal >= config.satiatedAtKcal ||
    config.satiatedAtKcal > config.reserveMaxKcal
  )
    errors.push('Thresholds must satisfy 0 < hungryBelowKcal < satiatedAtKcal ≤ reserveMaxKcal')
  if (config.initialReserveKcal <= 0 || config.initialReserveKcal > config.reserveMaxKcal)
    errors.push('initialReserveKcal must be between 1 and reserveMaxKcal')
  if (config.bandSize < 1) errors.push('bandSize must be at least 1')
  if (config.perceptionRadiusTiles < 0) errors.push('perceptionRadiusTiles must not be negative')
  if (config.shelfLifeHours < 0) errors.push('shelfLifeHours must not be negative')
  if (config.sharers < 0 || config.reciprocators < 0 || config.sharers + config.reciprocators > config.bandSize)
    errors.push('sharers and reciprocators must not be negative, and together must not exceed bandSize')
  if (config.groveCount < 0 || config.patchCount + config.groveCount > tiles)
    errors.push(`patchCount + groveCount must be at most the number of tiles (${Math.max(0, tiles)})`)
  if (config.initialGroveWood < 0 || config.initialGroveWood > config.groveCapacityWood)
    errors.push('initialGroveWood must be between 0 and groveCapacityWood')
  if (config.groveRegrowthWoodPerHour < 0) errors.push('groveRegrowthWoodPerHour must not be negative')
  if (config.fireWoodPerHour < 1) errors.push('fireWoodPerHour must be at least 1')
  if (config.coldSleepKcalPerHour < config.sleepKcalPerHour)
    errors.push('coldSleepKcalPerHour must be at least sleepKcalPerHour')
  if (config.practiceDays < 1) errors.push('practiceDays must be at least 1')
  if (config.practiceHalfHours < 1) errors.push('practiceHalfHours must be at least 1')
  if (config.startPracticeHoursPerDay < 0 || config.startPracticeHoursPerDay > 24)
    errors.push('startPracticeHoursPerDay must be between 0 and 24')
  const practiceRangeOk = config.practiceMinPercent >= 1 && config.practiceMinPercent <= config.practiceMaxPercent
  if (!practiceRangeOk) errors.push('Practice must satisfy 1 ≤ practiceMinPercent ≤ practiceMaxPercent')
  // With practice on, the lowest and highest rates include the practice range; with it off, practice is 100%.
  const lowPractice = config.practice ? config.practiceMinPercent : 100
  const highPractice = config.practice ? config.practiceMaxPercent : 100
  const lowest = (base: number) => Math.floor((base * config.skillMinPercent * lowPractice) / 10_000)
  const highest = (base: number) => Math.floor((base * config.skillMaxPercent * highPractice) / 10_000)
  const skillRangeOk = config.skillMinPercent >= 1 && config.skillMinPercent <= config.skillMaxPercent
  if (!skillRangeOk) errors.push('Skills must satisfy 1 ≤ skillMinPercent ≤ skillMaxPercent')
  else if (practiceRangeOk && (lowest(config.forageKcalPerHour) < 1 || lowest(config.woodPerHour) < 1))
    errors.push('The lowest foraging and wood rates must be at least 1')
  if (config.harvestKcal < 1) errors.push('harvestKcal must be at least 1')
  else if (Math.max(config.harvestKcal, highest(config.forageKcalPerHour)) > config.patchCapacityKcal)
    errors.push('A patch must hold the largest harvest: max(harvestKcal, the fastest rate) ≤ patchCapacityKcal')
  if (config.groveCount > 0 && highest(config.woodPerHour) > config.groveCapacityWood)
    errors.push('A grove must hold the largest hour of gathering: the fastest wood rate ≤ groveCapacityWood')
  if (config.woodStockNights < 1) errors.push('woodStockNights must be at least 1')
  if (config.termsMemoryHours < 0) errors.push('termsMemoryHours must not be negative')
  return errors
}

export function resolveLifeConfig(overrides: Partial<LifeConfig> = {}): LifeConfig {
  const config = { ...LIFE_DEFAULT_CONFIG, ...overrides }
  const errors = lifeConfigErrors(config)
  if (errors.length) throw new Error(`Invalid Life configuration: ${errors.join('; ')}`)
  return config
}
