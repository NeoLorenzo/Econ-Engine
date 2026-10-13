import { describe, expect, it } from 'vitest'
import { sightCapacityExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

// A band of 8 is tested with experiment 4 in `sightExchange.test.ts`, and a band of 16 in `feedsSightSixteen.test.ts`.
describe('Life 7 experiment 6: how many the valley feeds', () => {
  const [twelve] = sightCapacityExperiment(seeds, [12], undefined, false).canonical

  it('keeps a band of 12 intact', () => {
    expect(twelve!.row.runs.every((run) => run.survived)).toBe(true)
  })
})
