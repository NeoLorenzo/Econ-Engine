import { describe, expect, it } from 'vitest'
import { fireSizeExperiment, valleySeeds } from './experiments'

// Life 8's experiment 2, against own fires: a fire that burns for each member. Its other half is in `fireSizeShared`.
const seeds = valleySeeds(8)
const DAYS = 100

describe('Life 8 experiment 2: how big a fire, a fire for each member against own fires', () => {
  const { rows } = fireSizeExperiment(seeds, ['perMember', 'ownFires'], DAYS)
  const { perMember, ownFires } = rows as Required<typeof rows>

  it('saves nothing with a fire that burns a kilogram for each member', () => {
    expect(Math.abs(perMember.burnedWoodPerDay - ownFires.burnedWoodPerDay) / ownFires.burnedWoodPerDay).toBeLessThan(
      0.1,
    )
  })
})
