import { describe, expect, it } from 'vitest'
import { loadsExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

// Loads of 30 kg, the canonical load, are tested with experiment 4 in `exchange.test.ts`.
describe('Life 5 experiment 3: loads, in a band born equal', () => {
  // A band born equal with small loads never holds spare wood, so 100 days show it as well as 400.
  const [small] = loadsExperiment(seeds, [24], ['equal'], 100)
  const [large] = loadsExperiment(seeds, [40], ['equal'])

  it('never swaps with loads no larger than the wood a forager keeps', () => {
    expect(small!.equal!.runs.every((run) => run.totalSwaps === 0)).toBe(true)
  })

  it('swaps in every run with loads of 40 kg', () => {
    expect(large!.equal!.runs.every((run) => run.totalSwaps > 0)).toBe(true)
  })
})
