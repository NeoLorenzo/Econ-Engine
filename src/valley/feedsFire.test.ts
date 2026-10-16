import { describe, expect, it } from 'vitest'
import { fireCapacityExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

describe('Life 8 experiment 6: how many the valley feeds with shared fires', () => {
  const [twelve] = fireCapacityExperiment(seeds, [12], undefined, false).canonical

  it('keeps a band of 12 intact at day 400 on every seed', () => {
    expect(twelve!.row.runs.every((run) => run.survived)).toBe(true)
  })
})
