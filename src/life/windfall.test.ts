import { describe, expect, it } from 'vitest'
import { badLuckExperiment, life2Seeds, windfallRiskExperiment } from './experiments'

// Life 2's ensembles are split across files so they run in parallel. Every run checks every invariant every hour. The
// tests use the first 16 seeds; the experiments' reported numbers use 32.
describe('experiment 2: bad luck on a single patch', () => {
  const result = badLuckExperiment()

  it('succeeds in the expected share of foraging hours', () => {
    expect(Math.abs(result.successRate - result.probability)).toBeLessThan(3 * result.successRateStandardError)
  })

  it('starves in the share of hungry spells that a run of failures predicts', () => {
    expect(result.tries).toEqual({ min: 37, max: 40 })
    expect(result.spells).toBeGreaterThan(2_000)
    const margin = 3 * result.starvationRateStandardError
    expect(result.starvationRate).toBeGreaterThan(result.expected.low - margin)
    expect(result.starvationRate).toBeLessThan(result.expected.high + margin)
  })
})

describe('experiment 3: windfalls bring risk', () => {
  const rows = windfallRiskExperiment(life2Seeds(16))

  it('keeps a band of keepers intact with steady harvests, carrying nothing', () => {
    const [steady] = rows
    for (const run of steady!.runs) expect(run.survived).toBe(true)
    expect(steady!.carried).toBe(false)
  })

  it('leaves fewer keepers alive the larger the windfall', () => {
    for (let index = 1; index < rows.length; index += 1)
      expect(rows[index]!.meanSurvivors).toBeLessThan(rows[index - 1]!.meanSurvivors)
  })
})
