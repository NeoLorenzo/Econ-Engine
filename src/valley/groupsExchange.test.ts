import { describe, expect, it } from 'vitest'
import { groupsAndExchangeExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

// Swaps between members and their absence everywhere else are checked every minute of every run by the invariants.
describe('Life 6 experiment 3: groups and exchange', () => {
  const result = groupsAndExchangeExperiment(seeds, ['groups', 'together'])
  const groups = result.groups!
  const together = result.together!

  it('keeps every band intact', () => {
    expect(groups.runs.every((run) => run.survived)).toBe(true)
    expect(together.runs.every((run) => run.survived)).toBe(true)
  })

  it('buys a smaller share of its wood in scattered groups than as one group from the start', () => {
    expect(groups.boughtShare).toBeLessThan(together.boughtShare)
  })

  it('divides work less in scattered groups than as one group from the start', () => {
    expect(groups.groupLead).toBeLessThan(together.groupLead)
  })
})
