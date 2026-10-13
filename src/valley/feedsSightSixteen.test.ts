import { describe, expect, it } from 'vitest'
import { sightCapacityExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
// Life 6's band of 16 has lost most of its members by day 100; a band that walks less keeps more of them.
const DAYS = 100

describe('Life 7 experiment 6: how many the valley feeds, with a band of 16', () => {
  const result = sightCapacityExperiment(seeds, [16], DAYS)

  it('keeps more of a band of 16 than Life 6 does', () => {
    expect(result.canonical[0]!.row.meanSurvivors).toBeGreaterThan(result.life6[0]!.row.meanSurvivors)
  })
})
