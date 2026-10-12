import { describe, expect, it } from 'vitest'
import { noSurplusExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
// No surplus is possible at any horizon, so 100 days suffice.
const DAYS = 100

describe('Life 5 experiment 2: no surplus, no exchange', () => {
  const result = noSurplusExperiment(seeds, DAYS)

  it('leaves no forager with spare wood, so nothing is swapped or quoted, in a band born equal or unequal', () => {
    for (const row of [result.equal, result.born]) {
      for (const run of row.runs) {
        expect(run.maxSpareWood).toBe(0)
        expect(run.totalSwaps).toBe(0)
        expect(run.totalQuotes).toBe(0)
      }
    }
  })
})
