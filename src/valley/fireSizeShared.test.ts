import { describe, expect, it } from 'vitest'
import { fireSizeExperiment, valleySeeds } from './experiments'

// Life 8's experiment 2, against own fires: the shared fire's saving. Its other half is in `fireSizePerMember`.
const seeds = valleySeeds(8)
const DAYS = 100

describe('Life 8 experiment 2: how big a fire, the shared fire against own fires', () => {
  const { rows, campfireNightWood } = fireSizeExperiment(seeds, ['canonical', 'ownFires'], DAYS)
  const { canonical, ownFires } = rows as Required<typeof rows>

  it('burns 12 kg a night for a whole group', () => {
    expect(campfireNightWood).toBe(12)
  })

  it('burns less wood a member with one fire per group than with one fire per forager', () => {
    expect(canonical.burnedWoodPerDay).toBeLessThan(ownFires.burnedWoodPerDay / 2)
  })

  it('leaves members fewer hours of gathering', () => {
    expect(canonical.gatherHoursPerDay).toBeLessThan(ownFires.gatherHoursPerDay)
  })
})
