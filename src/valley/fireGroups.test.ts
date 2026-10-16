import { describe, expect, it } from 'vitest'
import { fireGroupsExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
const DAYS = 100

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
