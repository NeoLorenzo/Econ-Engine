import type { LifeConfig } from './types'

export const LIFE_DEFAULT_CONFIG: LifeConfig = {
  seed: 20260813,
  gridWidth: 12,
  gridHeight: 12,
  patchCount: 4,
  patchCapacityKcal: 8_000,
  patchRegrowthKcalPerHour: 50,
  initialPatchStockKcal: 8_000,
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
}

/** Returns every rule the configuration breaks, in the order the specification lists them. */
export function lifeConfigErrors(config: LifeConfig): string[] {
  const errors: string[] = []
  for (const [key, value] of Object.entries(config)) {
    if (!Number.isInteger(value)) errors.push(`${key} must be an integer`)
  }
  if (errors.length) return errors
  const tiles = config.gridWidth * config.gridHeight
  if (config.gridWidth < 1 || config.gridHeight < 1) errors.push('The grid must be at least 1 × 1')
  if (config.patchCount < 1 || config.patchCount > tiles)
    errors.push(`patchCount must be between 1 and the number of tiles (${Math.max(0, tiles)})`)
  if (config.forageKcalPerHour > config.patchCapacityKcal)
    errors.push('forageKcalPerHour must not exceed patchCapacityKcal, or no patch could ever be foraged')
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
  return errors
}

export function resolveLifeConfig(overrides: Partial<LifeConfig> = {}): LifeConfig {
  const config = { ...LIFE_DEFAULT_CONFIG, ...overrides }
  const errors = lifeConfigErrors(config)
  if (errors.length) throw new Error(`Invalid Life configuration: ${errors.join('; ')}`)
  return config
}
