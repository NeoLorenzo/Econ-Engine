import { describe, expect, it } from 'vitest'
import { loadsExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
// Born differences start exchange within days, so 30 days suffice.
const DAYS = 30

describe('Life 5 experiment 3: loads, in Life 3’s band born unequal', () => {
  const rows = loadsExperiment(seeds, [26, 30], ['born'], DAYS)

  it('swaps in every run from loads of 26 kg, within the first days', () => {
    for (const row of rows) {
      for (const run of row.born!.runs) {
        expect(run.totalSwaps).toBeGreaterThan(0)
        expect(run.firstSwapDay!).toBeLessThan(10)
      }
    }
  })
})
