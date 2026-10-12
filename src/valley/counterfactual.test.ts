import { describe, expect, it } from 'vitest'
import { valleyRow, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
// Both expectations hold at every horizon, so 100 days suffice.
const DAYS = 100

describe('Life 5 experiment 4: the counterfactuals', () => {
  const noQuotes = valleyRow(seeds, { quotes: false }, DAYS)
  const noSwaps = valleyRow(seeds, { swapping: false }, DAYS)
  const noPractice = valleyRow(seeds, { practice: false }, DAYS)

  it('swaps nothing without telling terms, day for day the same as without swapping', () => {
    expect(noQuotes.swapsPerRun).toBe(0)
    for (const [index, run] of noQuotes.runs.entries()) expect(run.fingerprint).toBe(noSwaps.runs[index]!.fingerprint)
  })

  it('swaps nothing without practice, in a band born equal', () => {
    expect(noPractice.swapsPerRun).toBe(0)
  })
})
