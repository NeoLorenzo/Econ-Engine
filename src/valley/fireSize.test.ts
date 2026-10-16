import { describe, expect, it } from 'vitest'
import { fireSizeExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
const DAYS = 100

describe('Life 8 experiment 2: how big a fire', () => {
  const { rows, campfireNightWood } = fireSizeExperiment(seeds, ['canonical', 'perMember', 'life7'], DAYS)
  const { canonical, perMember, life7 } = rows as Required<typeof rows>

  it('burns 12 kg a night for a whole group', () => {
    expect(campfireNightWood).toBe(12)
  })

  it('burns less wood a member with one fire per group than with one fire per forager', () => {
    expect(canonical.burnedWoodPerDay).toBeLessThan(life7.burnedWoodPerDay / 2)
  })

  it('saves nothing with a fire that burns a kilogram for each member', () => {
    expect(Math.abs(perMember.burnedWoodPerDay - life7.burnedWoodPerDay) / life7.burnedWoodPerDay).toBeLessThan(0.1)
  })

  it('leaves members fewer hours of gathering', () => {
    expect(canonical.gatherHoursPerDay).toBeLessThan(life7.gatherHoursPerDay)
  })
})
