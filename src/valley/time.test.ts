import { describe, expect, it } from 'vitest'
import { timeAtRealScaleExperiment, topTwo, valleySeeds, woodShares } from './experiments'

// Life 5's experiments are tests in their own files, so they run in parallel. Every run checks every invariant every
// minute. The tests use the first 8 seeds; the experiments' reported numbers use 32 over 400 days. Expectations that
// hold at any horizon are tested over shorter runs, which keeps the tests to a few minutes.
const seeds = valleySeeds(8)
const DAYS = 100

describe('Life 5 experiment 1: time at real scale', () => {
  const result = timeAtRealScaleExperiment(seeds, DAYS)

  it('keeps every band intact', () => {
    expect(result.valley.runs.every((run) => run.survived)).toBe(true)
  })

  it('works the hours the time-use prediction gives, within 5%', () => {
    expect(Math.abs(result.valley.workHoursPerDay / result.predictedWorkHours - 1)).toBeLessThan(0.05)
  })

  it('walks under half an hour a day, against hours in Life 4', () => {
    expect(result.valley.walkHoursPerDay).toBeLessThan(0.5)
    expect(result.life4.walkHoursPerDay).toBeGreaterThan(2)
  })

  // Experiment 4's band without swaps is this one.
  it('leaves a band born equal undivided without swaps', () => {
    for (const run of result.valley.runs) {
      const shares = woodShares(run).filter((share) => share !== null)
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThan(0.05)
      expect(run.termsSpread[100]!).toBeLessThan(1.25)
      expect(topTwo(run)).toBeLessThanOrEqual(0.26)
    }
  })
})
