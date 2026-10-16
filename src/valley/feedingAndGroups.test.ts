import { describe, expect, it } from 'vitest'
import { fireGroupsExperiment, valleySeeds, whoFeedsExperiment } from './experiments'

// Life 8's experiments 1 and 4 share their runs, the canonical valley and the band as one group from the start, so
// they run in one file.
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

describe('Life 8 experiment 4: groups', () => {
  const result = fireGroupsExperiment(seeds, DAYS, false)

  it('burns less wood a member in a band that starts as one group than in scattered groups', () => {
    expect(result.together.burnedWoodPerDay).toBeLessThan(result.groups.burnedWoodPerDay)
  })

  it('keeps its fires lit almost every night hour', () => {
    expect(result.groups.litShare).toBeGreaterThan(0.9)
    expect(result.together.litShare).toBeGreaterThan(0.9)
  })
})
