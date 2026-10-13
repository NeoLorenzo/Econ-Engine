import { describe, expect, it } from 'vitest'
import { groupsCapacityExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

// A band of 8 is tested with experiment 3 in `groupsExchange.test.ts`, and a band of 16 in `feedsGroupsSixteen.test.ts`.
describe('Life 6 experiment 5: how many the valley feeds', () => {
  const [twelve] = groupsCapacityExperiment(seeds, [12], undefined, false).groups

  it('keeps a band of 12 intact', () => {
    expect(twelve!.row.runs.every((run) => run.survived)).toBe(true)
  })
})
