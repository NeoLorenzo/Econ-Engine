import { describe, expect, it } from 'vitest'
import { fireCapacityExperiment, valleySeeds } from './experiments'

// Experiment 5's eight seeds of 400 days are the longest runs in the suite, so they are split across two files that
// run in parallel: this one has the first four.
const seeds = valleySeeds(8).slice(0, 4)

describe('Life 8 experiment 5: how many the valley feeds with shared fires, first four seeds', () => {
  const [twelve] = fireCapacityExperiment(seeds, [12], undefined, false).canonical

  it('keeps a band of 12 intact at day 400 on every seed', () => {
    expect(twelve!.row.runs.every((run) => run.survived)).toBe(true)
  })
})
