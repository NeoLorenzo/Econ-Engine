import { describe, expect, it } from 'vitest'
import { bornDifferencesExperiment, life2Seeds } from './experiments'

// Every run checks every invariant every hour. The tests use the first 16 seeds; the reported numbers use 32.
describe('Life 4 experiment 6: practice and born differences', () => {
  const { swaps, practiceSwaps } = bornDifferencesExperiment(life2Seeds(16))

  it('keeps specialization aligned with born advantage', () => {
    expect(swaps.correlation!).toBeLessThan(0)
    expect(practiceSwaps.correlation!).toBeLessThan(0)
  })

  it('spreads own terms wider with practice', () => {
    expect(practiceSwaps.termsSpread[100]!).toBeGreaterThan(swaps.termsSpread[100]!)
  })

  it('keeps at least as many alive with practice', () => {
    expect(practiceSwaps.meanSurvivors).toBeGreaterThanOrEqual(swaps.meanSurvivors)
  })
})
