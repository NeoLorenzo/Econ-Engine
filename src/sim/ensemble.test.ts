import { describe, expect, it } from 'vitest'
import {
  ENSEMBLE_METRICS,
  canonicalSeeds,
  ensembleSeedMetrics,
  ensembleSeeds,
  runEnsemble,
  summarizeEnsemble,
  summarizeMetric,
  type EnsembleKind,
} from './ensemble'
import { createSimulation, runDays, stepSimulation } from './engine'
import { runGovernmentBaselineComparison } from './governmentExperiment'
import { runPopulationScaleComparison } from './populationScaleExperiment'

const HORIZON = 25
const KINDS: EnsembleKind[] = ['population', 'government', 'competition']

describe('ensemble summary statistics (#3)', () => {
  it('computes mean, sample standard deviation, range and interpolated percentiles', () => {
    const summary = summarizeMetric([4, 1, 3, 2])
    expect(summary).toMatchObject({ count: 4, mean: 2.5, minimum: 1, maximum: 4, median: 2.5 })
    expect(summary.standardDeviation).toBeCloseTo(Math.sqrt(5 / 3), 12)
    expect(summary.p10).toBeCloseTo(1.3, 12)
    expect(summary.p90).toBeCloseTo(3.7, 12)
    expect(summarizeMetric([7])).toEqual({
      count: 1,
      mean: 7,
      standardDeviation: 0,
      minimum: 7,
      maximum: 7,
      p10: 7,
      median: 7,
      p90: 7,
    })
    expect(() => summarizeMetric([])).toThrow()
  })

  it('builds a deterministic set of distinct seeds that starts with the base seed', () => {
    const seeds = ensembleSeeds(20260813, 16)
    expect(seeds).toHaveLength(16)
    expect(seeds[0]).toBe(20260813)
    expect(new Set(seeds).size).toBe(16)
    expect(seeds.every((seed) => Number.isInteger(seed) && seed >= 1 && seed <= 0xffff_ffff)).toBe(true)
    expect(ensembleSeeds(20260813, 16)).toEqual(seeds)
    expect(ensembleSeeds(20260813, 4)).toEqual(seeds.slice(0, 4))
    expect(() => ensembleSeeds(0, 4)).toThrow(/base seed/)
    expect(() => ensembleSeeds(1, 0)).toThrow(/size/)
  })

  it('rejects empty, duplicate and out-of-range seed sets', () => {
    expect(canonicalSeeds([30, 10, 20])).toEqual([10, 20, 30])
    expect(() => canonicalSeeds([])).toThrow()
    expect(() => canonicalSeeds([5, 5])).toThrow(/distinct/)
    expect(() => canonicalSeeds([0])).toThrow()
    expect(() => canonicalSeeds([1.5])).toThrow()
  })
})

describe.each(KINDS)('%s ensemble (#3)', (kind) => {
  const seeds = [91, 7, 20260813]
  const result = runEnsemble(kind, seeds, HORIZON)

  it('reports every seed in ascending order with a summary for every metric', () => {
    expect(result.seeds).toEqual([7, 91, 20260813])
    expect(result.perSeed.map(({ seed }) => seed)).toEqual(result.seeds)
    expect(Object.keys(result.summary).sort()).toEqual([...ENSEMBLE_METRICS[kind]].sort())
    for (const metric of ENSEMBLE_METRICS[kind]) {
      const values = result.perSeed.map(({ metrics }) => (metrics as Record<string, number>)[metric]!)
      const summary = (result.summary as Record<string, ReturnType<typeof summarizeMetric>>)[metric]!
      expect(summary).toEqual(summarizeMetric(values))
      expect(values.every(Number.isFinite)).toBe(true)
    }
  })

  it('replays exactly, and seed order cannot change any per-seed value or summary', () => {
    expect(runEnsemble(kind, seeds, HORIZON)).toEqual(result)
    expect(runEnsemble(kind, [20260813, 91, 7], HORIZON)).toEqual(result)
    expect(summarizeEnsemble(kind, HORIZON, [...result.perSeed].reverse())).toEqual(result)
    for (const { seed, metrics } of result.perSeed) expect(ensembleSeedMetrics(kind, seed, HORIZON)).toEqual(metrics)
  })
})

describe('ensemble provenance and isolation (#3)', () => {
  it('matches the single-seed harnesses it summarizes', () => {
    const population = ensembleSeedMetrics('population', 7, HORIZON)
    const single = runPopulationScaleComparison(7, HORIZON)
    expect(population.n10Completion).toBe(single.n10.normalized.purchaseCompletionRate)
    expect(population.n100MeanCashGini).toBe(single.n100.normalized.meanCashGini)
    const government = ensembleSeedMetrics('government', 7, HORIZON)
    const comparison = runGovernmentBaselineComparison(7, HORIZON)
    expect(government.adaptiveMeanPostGini).toBe(comparison.adaptive.distribution.meanPostGini)
    expect(government.baselineCompletion).toBe(comparison.baseline.consumption.completionFraction)
  })

  it('never mutates or advances a live simulation', () => {
    const live = runDays(createSimulation({ seed: 7 }), 5)
    const snapshot = JSON.stringify(live)
    const expectedNext = stepSimulation(JSON.parse(snapshot))
    for (const kind of KINDS) runEnsemble(kind, [7, 8], HORIZON)
    expect(JSON.stringify(live)).toBe(snapshot)
    expect(stepSimulation(live)).toEqual(expectedNext)
  })
})
