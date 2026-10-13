import { describe, expect, it } from 'vitest'
import { carryingExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)

// That no forager explores, checks or seeks company with a full load is checked every minute by the invariants.
describe('Life 7 experiment 3: taking loads home, with loads of 20 kg', () => {
  const result = carryingExperiment(seeds, ['load20', 'load20NoHome'])
  const { load20, load20NoHome } = result.rows as Required<typeof result.rows>

  it('starts exchange in more runs when foragers take their loads home', () => {
    expect(load20.swappingRuns).toBeGreaterThan(load20NoHome.swappingRuns)
  })
})
