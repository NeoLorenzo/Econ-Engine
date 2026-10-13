import { describe, expect, it } from 'vitest'
import { sightExchangeExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

describe('Life 7 experiment 4: groups and exchange', () => {
  const result = sightExchangeExperiment(seeds)

  it('keeps every band intact', () => {
    expect(result.groups.runs.every((run) => run.survived)).toBe(true)
    expect(result.together.runs.every((run) => run.survived)).toBe(true)
  })

  it('buys a smaller share of its wood in scattered groups than as one group from the start', () => {
    expect(result.groups.boughtShare).toBeLessThan(result.together.boughtShare)
  })

  it('divides work less in scattered groups than as one group from the start', () => {
    expect(result.groups.groupLead).toBeLessThan(result.together.groupLead)
  })
})
