import { describe, expect, it } from 'vitest'
import { groupsCapacityExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
// Life 5's band of 16 is still whole at day 100, while exploring has already cost Life 6's band most of its members.
const DAYS = 100

describe('Life 6 experiment 5: how many the valley feeds, with a band of 16', () => {
  const result = groupsCapacityExperiment(seeds, [16], DAYS)
  const groups = result.groups[0]!.row

  it('loses more of a band of 16 than Life 5 does', () => {
    expect(groups.meanSurvivors).toBeLessThan(result.life5[0]!.row.meanSurvivors)
  })

  // That no group ever stands with fewer than two living members is checked every minute by the invariants.
  it('dissolves groups as their members die', () => {
    expect(groups.dissolutions).toBeGreaterThan(0)
  })
})
