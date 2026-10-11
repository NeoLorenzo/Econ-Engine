import type { LifeConfig } from './types'

/**
 * The canonical Life 2 world: a band of 12 with a camp, on land that carries a band of 12 with steady harvests, where
 * harvests come as windfalls of 6,000 kcal and carried food keeps for two days. A third of the band keeps, a third
 * shares and a third reciprocates.
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
  bandSize: 12,
  perceptionRadiusTiles: 2,
  hasCamp: true,
  harvestKcal: 6_000,
  shelfLifeHours: 48,
  sharers: 4,
  reciprocators: 4,
}

/** The overrides that give back Life 1: a band of 40 keepers with no camp and steady harvests, on Life 1's world. */
export const LIFE1_WORLD: Partial<LifeConfig> = {
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

/** Returns every rule the configuration breaks, in the order the specification lists them. */
export function lifeConfigErrors(config: LifeConfig): string[] {
  const errors: string[] = []
  for (const [key, value] of Object.entries(config)) {
    if (key === 'hasCamp') {
      if (typeof value !== 'boolean') errors.push('hasCamp must be true or false')
    } else if (!Number.isInteger(value)) errors.push(`${key} must be an integer`)
  }
  if (errors.length) return errors
  const tiles = config.gridWidth * config.gridHeight
  if (config.gridWidth < 1 || config.gridHeight < 1) errors.push('The grid must be at least 1 × 1')
  if (config.patchCount < 1 || config.patchCount > tiles)
    errors.push(`patchCount must be between 1 and the number of tiles (${Math.max(0, tiles)})`)
  if (config.harvestKcal < config.forageKcalPerHour || config.harvestKcal > config.patchCapacityKcal)
    errors.push('Harvests must satisfy forageKcalPerHour ≤ harvestKcal ≤ patchCapacityKcal, so a patch can hold one')
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
  return errors
}

export function resolveLifeConfig(overrides: Partial<LifeConfig> = {}): LifeConfig {
  const config = { ...LIFE_DEFAULT_CONFIG, ...overrides }
  const errors = lifeConfigErrors(config)
  if (errors.length) throw new Error(`Invalid Life configuration: ${errors.join('; ')}`)
  return config
}
