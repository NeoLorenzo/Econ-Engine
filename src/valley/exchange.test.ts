import { describe, expect, it } from 'vitest'
import { life5, topTwo, valleyRow, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

// The same band without swaps is tested with experiment 1 in `time.test.ts`.
describe('Life 5 experiment 4: practice and exchange at real scale', () => {
  const swaps = valleyRow(seeds, life5())

  it('divides every band born equal once practice and swaps work together, with loads of 30 kg', () => {
    for (const run of swaps.runs) {
      expect(run.totalSwaps).toBeGreaterThan(0)
      expect(topTwo(run)).toBeGreaterThan(0.3)
    }
  })

  it('keeps every band intact', () => {
    expect(swaps.runs.every((run) => run.survived)).toBe(true)
  })
})
