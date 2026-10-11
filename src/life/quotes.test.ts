import { describe, expect, it } from 'vitest'
import { life2Seeds, quotesExperiment } from './experiments'

// Life 3's ensembles are split across files so they run in parallel. Every run checks every invariant every hour. The
// tests use the first 16 seeds; the experiments' reported numbers use 32.
describe('Life 3 experiment 5: telling terms', () => {
  const { steady, windfall } = quotesExperiment(life2Seeds(16))

  it('never starts exchange with steady harvests when no one tells terms', () => {
    expect(steady.noQuotes.swapsPerRun).toBe(0)
    expect(steady.noQuotes.quotesPerRun).toBe(0)
    expect(steady.identical.every(Boolean)).toBe(true)
  })

  it('starts exchange from carried windfalls even without telling terms', () => {
    expect(windfall.noQuotes.swapsPerRun).toBeGreaterThan(0)
  })
})
