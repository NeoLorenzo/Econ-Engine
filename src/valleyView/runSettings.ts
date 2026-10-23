import { VALLEY_DEFAULT_CONFIG, valleyConfigErrors } from '../valley/config'
import { layoutError } from '../valley/layout'
import type { ValleyConfig } from '../valley/types'

/** The settings a run is started with, read from the Life page before the first minute and fixed after it. */
export interface RunSettings {
  seed: number
  daysPerYear: number
  worldKm: number
  founders: number
  scattered: boolean
}

type NumericSetting = Exclude<keyof RunSettings, 'scattered'>

/** Each numeric setting with its range; `min` and `max` are absent where any integer will do. */
export const RUN_SETTING_FIELDS: { key: NumericSetting; label: string; min?: number; max?: number }[] = [
  { key: 'seed', label: 'Seed' },
  { key: 'daysPerYear', label: 'Days per year', min: 8, max: 365 },
  { key: 'worldKm', label: 'World size, km', min: 1, max: 10 },
  { key: 'founders', label: 'Founders', min: 1, max: 100 },
]

const CM_PER_KM = 100_000

/** The default configuration's world size, at which every count of places and landforms is the configured one. */
const DEFAULT_WORLD_KM = VALLEY_DEFAULT_CONFIG.valleySizeCm / CM_PER_KM

/** Counts of places and landforms, which a world of another size scales by its area. */
const AREA_COUNTS = [
  'thicketCount',
  'hazelThicketCount',
  'standCount',
  'outcropCount',
  'moraineBeltCount',
  'drumlinCount',
  'kameCount',
  'hummockClusterCount',
  'hummockCount',
  'smallKettleCount',
  'largeKettleCount',
  'tunnelValleyCount',
] as const satisfies readonly (keyof ValleyConfig)[]

export const defaultRunSettings = (): RunSettings => ({
  seed: VALLEY_DEFAULT_CONFIG.seed,
  daysPerYear: VALLEY_DEFAULT_CONFIG.daysPerYear,
  worldKm: DEFAULT_WORLD_KM,
  founders: VALLEY_DEFAULT_CONFIG.founders,
  scattered: VALLEY_DEFAULT_CONFIG.scattered,
})

/**
 * The configuration a run with these settings starts from. A world of the default size is exactly the default
 * configuration; another size keeps the density of places and landforms, with at least one of each.
 */
export function configOfSettings(settings: RunSettings): Partial<ValleyConfig> {
  const { seed, daysPerYear, worldKm, founders, scattered } = settings
  const config: Partial<ValleyConfig> = { seed, daysPerYear, founders, scattered }
  if (worldKm === DEFAULT_WORLD_KM) return config
  config.valleySizeCm = worldKm * CM_PER_KM
  for (const key of AREA_COUNTS)
    config[key] = Math.max(1, Math.round((VALLEY_DEFAULT_CONFIG[key] * worldKm * worldKm) / DEFAULT_WORLD_KM ** 2))
  return config
}

/** The first thing wrong with the settings: the page's ranges, then the configuration's rules, then the layout. */
export function runSettingsError(settings: RunSettings): string | null {
  for (const { key, label, min, max } of RUN_SETTING_FIELDS) {
    const value = settings[key]
    if (!Number.isSafeInteger(value)) return `${label} must be a whole number`
    if ((min !== undefined && value < min) || (max !== undefined && value > max))
      return `${label} must be from ${min} to ${max}`
  }
  const config = { ...VALLEY_DEFAULT_CONFIG, ...configOfSettings(settings) }
  return valleyConfigErrors(config)[0] ?? layoutError(config)
}
