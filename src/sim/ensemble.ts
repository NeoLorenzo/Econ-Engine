import { runGeneralizedSpatialExperiment } from './generalizedSpatialExperiment'
import { runGovernmentBaselineComparison } from './governmentExperiment'
import { runPopulationScaleComparison } from './populationScaleExperiment'
import { mixSeed } from './rng'

/**
 * Multi-seed ensembles. Each seed runs a research harness from its own fresh economy, so an ensemble never touches a
 * live simulation or its RNG. Results are keyed by seed and always reported in ascending seed order, so the order in
 * which seeds are supplied (or finish, when run in parallel) cannot change any per-seed value or summary.
 */

export const ENSEMBLE_METRICS = {
  population: [
    'n10Completion',
    'n100Completion',
    'completionGap',
    'n10MeanCashGini',
    'n100MeanCashGini',
    'n10MeanWealthTaxRateBps',
    'n100MeanWealthTaxRateBps',
    'n10ShareVolatility',
    'n100ShareVolatility',
  ],
  government: [
    'adaptiveMeanTaxRateBps',
    'adaptiveEqualityFraction',
    'adaptiveMeanPostGini',
    'baselineMeanPostGini',
    'adaptiveCompletion',
    'baselineCompletion',
    'adaptiveTaxRateChanges',
  ],
  competition: ['meanLeadershipChanges', 'meanTiedDayFraction', 'meanFirmAShare', 'meanShareAsymmetry'],
} as const

export type EnsembleKind = keyof typeof ENSEMBLE_METRICS
export type EnsembleMetric<K extends EnsembleKind> = (typeof ENSEMBLE_METRICS)[K][number]
export type EnsembleSeedMetrics<K extends EnsembleKind> = Record<EnsembleMetric<K>, number>

export interface MetricSummary {
  /** Number of seeds. */
  count: number
  mean: number
  /** Sample standard deviation (n − 1 denominator); 0 for a single seed. */
  standardDeviation: number
  minimum: number
  maximum: number
  /** Percentiles use linear interpolation between closest ranks (the common "type 7" definition). */
  p10: number
  median: number
  p90: number
}

export interface EnsembleResult<K extends EnsembleKind> {
  kind: K
  /** Seeds in ascending order. */
  seeds: number[]
  horizonDays: number
  perSeed: { seed: number; metrics: EnsembleSeedMetrics<K> }[]
  summary: Record<EnsembleMetric<K>, MetricSummary>
}

const MAXIMUM_SEED = 0xffff_ffff
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * A deterministic seed set of `count` distinct seeds. The first is `base` itself, so an ensemble always includes the
 * single-seed run it extends; the rest pass `base + i` through the Murmur3 finalizer so neighbouring seeds do not feed
 * nearly identical states to the linear xorshift market generator.
 */
export function ensembleSeeds(base: number, count: number): number[] {
  if (!Number.isInteger(base) || base < 1 || base > MAXIMUM_SEED)
    throw new Error(`Ensemble base seed must be a whole number from 1 to ${MAXIMUM_SEED}; received ${base}`)
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`Ensemble size must be a positive whole number; received ${count}`)
  const seeds = [base]
  for (let offset = 1; seeds.length < count; offset += 1) {
    const candidate = mixSeed((base + offset) >>> 0)
    if (candidate !== 0 && !seeds.includes(candidate)) seeds.push(candidate)
  }
  return seeds
}

/** Validates a seed set and returns it in canonical ascending order. */
export function canonicalSeeds(seeds: readonly number[]): number[] {
  if (seeds.length === 0) throw new Error('An ensemble needs at least one seed')
  for (const seed of seeds)
    if (!Number.isInteger(seed) || seed < 1 || seed > MAXIMUM_SEED)
      throw new Error(`Ensemble seeds must be whole numbers from 1 to ${MAXIMUM_SEED}; received ${seed}`)
  if (new Set(seeds).size !== seeds.length) throw new Error('Ensemble seeds must be distinct')
  return [...seeds].sort((a, b) => a - b)
}

/** The decision-relevant outcomes of one seed's run of a harness. Pure: builds its own economies from the seed. */
export function ensembleSeedMetrics<K extends EnsembleKind>(
  kind: K,
  seed: number,
  horizonDays = 1_000,
): EnsembleSeedMetrics<K> {
  const metrics: { [Kind in EnsembleKind]: () => EnsembleSeedMetrics<Kind> } = {
    population: () => {
      const { n10, n100 } = runPopulationScaleComparison(seed, horizonDays)
      return {
        n10Completion: n10.normalized.purchaseCompletionRate,
        n100Completion: n100.normalized.purchaseCompletionRate,
        completionGap: n100.normalized.purchaseCompletionRate - n10.normalized.purchaseCompletionRate,
        n10MeanCashGini: n10.normalized.meanCashGini,
        n100MeanCashGini: n100.normalized.meanCashGini,
        n10MeanWealthTaxRateBps: n10.normalized.meanWealthTaxRateBps,
        n100MeanWealthTaxRateBps: n100.normalized.meanWealthTaxRateBps,
        n10ShareVolatility: n10.normalized.marketShareVolatility,
        n100ShareVolatility: n100.normalized.marketShareVolatility,
      }
    },
    government: () => {
      const { adaptive, baseline } = runGovernmentBaselineComparison(seed, horizonDays)
      return {
        adaptiveMeanTaxRateBps: adaptive.government.meanAppliedRateBps,
        adaptiveEqualityFraction: adaptive.government.effectiveEqualityFraction,
        adaptiveMeanPostGini: adaptive.distribution.meanPostGini,
        baselineMeanPostGini: baseline.distribution.meanPostGini,
        adaptiveCompletion: adaptive.consumption.completionFraction,
        baselineCompletion: baseline.consumption.completionFraction,
        adaptiveTaxRateChanges: adaptive.government.taxRateChanges,
      }
    },
    competition: () => {
      const { industries } = runGeneralizedSpatialExperiment([seed], horizonDays)[0]!
      const analytics = industries.map((industry) => industry.analytics)
      return {
        meanLeadershipChanges: mean(analytics.map(({ leadershipChanges }) => leadershipChanges)),
        meanTiedDayFraction: mean(analytics.map(({ fractionDaysTied }) => fractionDaysTied)),
        meanFirmAShare: mean(analytics.map(({ firmA }) => firmA.meanDailyMarketShare)),
        meanShareAsymmetry: mean(
          analytics.map(({ firmA, firmB }) => Math.abs(firmA.meanDailyMarketShare - firmB.meanDailyMarketShare)),
        ),
      }
    },
  }
  return metrics[kind]() as EnsembleSeedMetrics<K>
}

function percentile(sorted: number[], fraction: number) {
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
}

/** Summary statistics over values supplied in a fixed (ascending-seed) order. */
export function summarizeMetric(values: number[]): MetricSummary {
  if (values.length === 0) throw new Error('Cannot summarize an empty ensemble')
  const average = mean(values)
  const sorted = [...values].sort((a, b) => a - b)
  const variance =
    values.length > 1 ? values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1) : 0
  return {
    count: values.length,
    mean: average,
    standardDeviation: Math.sqrt(variance),
    minimum: sorted[0]!,
    maximum: sorted.at(-1)!,
    p10: percentile(sorted, 0.1),
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
  }
}

/** Combines per-seed metrics (in any order) into an ensemble result in canonical seed order. */
export function summarizeEnsemble<K extends EnsembleKind>(
  kind: K,
  horizonDays: number,
  perSeed: readonly { seed: number; metrics: EnsembleSeedMetrics<K> }[],
): EnsembleResult<K> {
  const seeds = canonicalSeeds(perSeed.map(({ seed }) => seed))
  const ordered = seeds.map((seed) => perSeed.find((entry) => entry.seed === seed)!)
  const summary = Object.fromEntries(
    ENSEMBLE_METRICS[kind].map((metric) => [
      metric,
      summarizeMetric(ordered.map(({ metrics }) => metrics[metric as EnsembleMetric<K>])),
    ]),
  ) as Record<EnsembleMetric<K>, MetricSummary>
  return { kind, seeds, horizonDays, perSeed: ordered, summary }
}

/** Runs a harness for every seed in an explicit set, sequentially, and summarizes the outcomes. */
export function runEnsemble<K extends EnsembleKind>(
  kind: K,
  seeds: readonly number[],
  horizonDays = 1_000,
): EnsembleResult<K> {
  return summarizeEnsemble(
    kind,
    horizonDays,
    canonicalSeeds(seeds).map((seed) => ({ seed, metrics: ensembleSeedMetrics(kind, seed, horizonDays) })),
  )
}
