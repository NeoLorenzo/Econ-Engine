import { describe, expect, it } from 'vitest'
import { fireSizeExperiment, spareWoodExperiment, valleySeeds } from './experiments'

// Life 8's experiments 2 and 3 share the canonical valley's runs, so they run in one file.
const seeds = valleySeeds(8)
const DAYS = 100

describe('Life 8 experiment 2: how big a fire', () => {
  const { rows, campfireNightWood } = fireSizeExperiment(seeds, ['canonical', 'perMember', 'ownFires'], DAYS)
  const { canonical, perMember, ownFires } = rows as Required<typeof rows>

  it('burns 12 kg a night for a whole group', () => {
    expect(campfireNightWood).toBe(12)
  })

  it('burns less wood a member with one fire per group than with one fire per forager', () => {
    expect(canonical.burnedWoodPerDay).toBeLessThan(ownFires.burnedWoodPerDay / 2)
  })

  it('saves nothing with a fire that burns a kilogram for each member', () => {
    expect(Math.abs(perMember.burnedWoodPerDay - ownFires.burnedWoodPerDay) / ownFires.burnedWoodPerDay).toBeLessThan(
      0.1,
    )
  })

  it('leaves members fewer hours of gathering', () => {
    expect(canonical.gatherHoursPerDay).toBeLessThan(ownFires.gatherHoursPerDay)
  })
})

describe('Life 8 experiment 3: spare wood and exchange', () => {
  const result = spareWoodExperiment(seeds, DAYS)

  it('keeps every band intact', () => {
    expect(result.canonical.runs.every((run) => run.survived)).toBe(true)
    expect(result.lowOnly.runs.every((run) => run.survived)).toBe(true)
  })

  it('buys more of its wood when members give only to a low fire', () => {
    expect(result.lowOnly.boughtShare).toBeGreaterThan(result.canonical.boughtShare)
  })

  it('gives only from stock to a low fire when spare wood is kept', () => {
    expect(result.lowOnly.spareGivenShare).toBe(0)
    expect(result.canonical.spareGivenShare).toBeGreaterThan(0)
  })
})
