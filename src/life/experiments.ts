import { createLife, stepLife } from './engine'
import { assertLifeInvariants } from './invariants'
import { lifeTheory } from './theory'
import type { ActionHours, LifeConfig } from './types'
import { patchAt } from './world'

export const EXPERIMENT_DAYS = 400
/** Days 1–20 are a warm-up; measured averages and trends start at day 21. */
export const WARMUP_DAYS = 20
export const EXPERIMENT_SEEDS = [20260813, 1, 2, 3, 4, 5, 6, 7]
/**
 * A reserve losing more than this many kilocalories a day is declining. A well-fed forager's reserve cycles between
 * the hunger thresholds, so its measured slope wanders by about 1 kcal a day either side of zero.
 */
export const DECLINE_TOLERANCE_KCAL_PER_DAY = 2
/** Alive at the end, with a reserve that is not declining. */
export const isSustained = (result: LifeRunResult) =>
  result.survived && result.reserveTrendKcalPerDay! >= -DECLINE_TOLERANCE_KCAL_PER_DAY

/** The single-patch benchmark: one tile, one patch that starts empty, so the forager stands on it from tick 0. */
export const SINGLE_PATCH_WORLD: Partial<LifeConfig> = {
  gridWidth: 1,
  gridHeight: 1,
  patchCount: 1,
  initialPatchStockKcal: 0,
}

export interface LifeRunResult {
  regrowthKcalPerHour: number
  seed: number
  survived: boolean
  /** Fractional days from the start, `deathTick / 24`. */
  deathDay: number | null
  /** Least-squares slope of the end-of-day reserve over the measured days, or null if the forager died. */
  reserveTrendKcalPerDay: number | null
  /** Mean hours per day on each action over the measured days the forager was alive. */
  meanHours: ActionHours
  /** Walks that reached their target patch, and how many found it holding less than a full hour's harvest. */
  arrivals: number
  emptyArrivals: number
}

function slope(values: readonly number[]) {
  const n = values.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = values.reduce((sum, value) => sum + value, 0) / n
  let numerator = 0
  let denominator = 0
  for (const [index, value] of values.entries()) {
    numerator += (index - meanX) * (value - meanY)
    denominator += (index - meanX) ** 2
  }
  return numerator / denominator
}

/** Runs one configuration headless, checking every invariant after every hour. */
export function runLife(overrides: Partial<LifeConfig>, days = EXPERIMENT_DAYS): LifeRunResult {
  let state = createLife(overrides)
  assertLifeInvariants(state)
  let arrivals = 0
  let emptyArrivals = 0
  for (let hour = 0; hour < days * 24; hour += 1) {
    state = stepLife(state)
    assertLifeInvariants(state)
    const event = state.lastEvent
    // A walk clears its target exactly when it arrives.
    if (event?.action === 'walk' && event.targetPatchId === null) {
      arrivals += 1
      const patch = patchAt(state.patches, event.position)
      if (!patch || patch.stockKcal < state.config.forageKcalPerHour) emptyArrivals += 1
    }
  }
  const measured = state.days.slice(WARMUP_DAYS).filter((day) => day.alive)
  const meanHours: ActionHours = { sleep: 0, rest: 0, forage: 0, walk: 0 }
  for (const day of measured)
    for (const action of Object.keys(meanHours) as (keyof ActionHours)[]) meanHours[action] += day.hours[action]
  for (const action of Object.keys(meanHours) as (keyof ActionHours)[])
    meanHours[action] = measured.length ? meanHours[action] / measured.length : 0
  const survived = state.forager.alive
  return {
    regrowthKcalPerHour: state.config.patchRegrowthKcalPerHour,
    seed: state.config.seed,
    survived,
    deathDay: state.forager.deathTick === null ? null : state.forager.deathTick / 24,
    reserveTrendKcalPerDay: survived ? slope(state.days.slice(WARMUP_DAYS).map((day) => day.endEnergyKcal)) : null,
    meanHours,
    arrivals,
    emptyArrivals,
  }
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index)

/** Experiment 1: survival around the single-patch threshold, at every integer rate from 0.5 to 1.5 times it. */
export function singlePatchThresholdExperiment(rates?: readonly number[]) {
  const theory = lifeTheory(createLife(SINGLE_PATCH_WORLD).config)
  const threshold = theory.singlePatchThresholdKcalPerHour
  const sweep = rates ?? range(Math.ceil(threshold * 0.5), Math.floor(threshold * 1.5))
  const rows = sweep.map((rate) => {
    const result = runLife({ ...SINGLE_PATCH_WORLD, patchRegrowthKcalPerHour: rate })
    const config = createLife({ ...SINGLE_PATCH_WORLD, patchRegrowthKcalPerHour: rate }).config
    return { ...result, deathDayWindow: lifeTheory(config).deathDayWindow(rate, config.initialReserveKcal) }
  })
  const declining = rows.filter((row) => !isSustained(row)).map((row) => row.regrowthKcalPerHour)
  const sustained = rows.filter(isSustained).map((row) => row.regrowthKcalPerHour)
  return {
    threshold,
    rows,
    /** The highest rate at which the reserve still declines, and the lowest at which it does not. */
    lastDeclining: declining.length ? Math.max(...declining) : null,
    firstSustained: sustained.length ? Math.min(...sustained) : null,
  }
}

/** Experiment 2: working hours on one patch as food becomes more abundant. */
export function leisureExperiment(rates: readonly number[] = [100, 200, 400, 800]) {
  const theory = lifeTheory(createLife(SINGLE_PATCH_WORLD).config)
  return {
    expectedForageHoursPerDay: theory.forageHoursPerDay,
    rows: rates.map((rate) => runLife({ ...SINGLE_PATCH_WORLD, patchRegrowthKcalPerHour: rate })),
  }
}

/**
 * Experiment 3: the canonical four-patch world across seeds and per-patch rates. The frontier is the lowest rate at
 * which the forager survives with a reserve that is not declining; its ratio to the lower bound is the cost of travel
 * and out-of-date knowledge.
 */
export function localKnowledgeExperiment(seeds: readonly number[] = EXPERIMENT_SEEDS, rates = range(20, 91)) {
  const lowerBound = lifeTheory(createLife().config).lowerBoundPerPatchKcalPerHour
  const perSeed = seeds.map((seed) => {
    const rows = rates.map((rate) => runLife({ seed, patchRegrowthKcalPerHour: rate }))
    const sustained = rows.find(isSustained)
    const frontier = sustained?.regrowthKcalPerHour ?? null
    return { seed, rows, frontier, frontierRatio: frontier === null ? null : frontier / lowerBound }
  })
  return { lowerBound, perSeed }
}
