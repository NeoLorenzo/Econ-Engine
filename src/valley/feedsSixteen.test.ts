import { describe, expect, it } from 'vitest'
import { capacityExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

describe('Life 5 experiment 5: how many the valley feeds, with a band of 16', () => {
  const result = capacityExperiment(seeds, [16], [])

  it('loses most of a band of 16', () => {
    expect(result.valley[0]!.row.meanSurvivors).toBeLessThan(8)
  })
})
