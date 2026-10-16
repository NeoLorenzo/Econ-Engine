import { describe, expect, it } from 'vitest'
import { valleySeeds, whoFeedsExperiment } from './experiments'

const seeds = valleySeeds(8)
const DAYS = 100

describe('Life 8 experiment 1: who feeds the fire', () => {
  const result = whoFeedsExperiment(seeds, DAYS)

  it('has every member of every standing group give wood to its fire', () => {
    for (const row of [result.groups, result.together])
      for (const run of row.runs) {
        expect(run.giveLeads.length).toBeGreaterThan(0)
        expect(run.fireGivenById.every((given, id) => given > 0 || !run.alive[id])).toBe(true)
      }
  })

  it('has members give in proportion to what they gather', () => {
    expect(result.groups.giveGatherCorrelation).toBeGreaterThan(0.9)
    expect(result.together.giveGatherCorrelation).toBeGreaterThan(0.9)
  })
})
