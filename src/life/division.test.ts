import { describe, expect, it } from 'vitest'
import { life2Seeds, practiceAndExchangeExperiment, practiceRangeExperiment } from './experiments'
import type { LifeRunResult } from './experiments'

// Life 4's ensembles are split across files so they run in parallel. Every run checks every invariant every hour. The
// tests use the first 16 seeds; the experiments' reported numbers use 32.
const seeds = life2Seeds(16)

/** The share of a run's wood gathered by the two foragers that gathered the most. */
const topTwo = (run: LifeRunResult) => {
  const gathered = [...run.gatheredWoodById].sort((a, b) => b - a)
  return (gathered[0]! + gathered[1]!) / gathered.reduce((sum, wood) => sum + wood, 0)
}

describe('Life 4 experiment 3: practice and exchange', () => {
  const result = practiceAndExchangeExperiment(seeds)

  it('swaps nothing without practice, as in Life 3', () => {
    expect(result.withoutPractice.swapsPerRun).toBe(0)
  })

  it('swaps nothing without telling terms, hour for hour the same as without swapping', () => {
    expect(result.noQuotes.swapsPerRun).toBe(0)
    expect(result.noQuotesIdentical.every(Boolean)).toBe(true)
  })

  it('divides every band once practice and swaps work together', () => {
    for (const run of result.swaps.runs) {
      expect(run.firstSwapDay!).toBeLessThan(30)
      expect(run.termsSpread[100]!).toBeGreaterThan(1.3)
      expect(topTwo(run)).toBeGreaterThan(0.4)
    }
    for (const run of result.noSwaps.runs) expect(topTwo(run)).toBeLessThanOrEqual(0.3)
  })

  it('keeps every band intact', () => {
    expect(result.swaps.runs.every((run) => run.survived)).toBe(true)
  })
})

describe('Life 4 experiment 5: how much practice matters', () => {
  const rows = practiceRangeExperiment(seeds)

  it('divides every band at every range of practice', () => {
    for (const { swaps } of rows) {
      for (const run of swaps.runs) {
        expect(run.swaps).toBeGreaterThan(0)
        expect(topTwo(run)).toBeGreaterThan(0.3)
      }
    }
  })

  it('spreads own terms wider the more practice matters', () => {
    const spreads = rows.map(({ swaps }) => swaps.termsSpread[100]!)
    expect(spreads[0]!).toBeLessThan(spreads[1]!)
    expect(spreads[1]!).toBeLessThan(spreads[2]!)
  })
})
