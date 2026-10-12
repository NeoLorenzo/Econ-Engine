import { describe, expect, it } from 'vitest'
import { capacityExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

// A band of 8, the canonical band, is tested with experiment 4 in `exchange.test.ts`, and a band of 16 in
// `feedsSixteen.test.ts`.
describe('Life 5 experiment 5: how many the valley feeds', () => {
  const result = capacityExperiment(seeds, [12], [12])

  it('keeps a band of 12 intact', () => {
    expect(result.valley[0]!.row.runs.every((run) => run.survived)).toBe(true)
  })

  it('carries a band of 12 that Life 4’s land cannot', () => {
    expect(result.life4[0]!.row.meanSurvivors).toBeLessThan(12)
  })
})
