import { describe, expect, it } from 'vitest'
import { carryingExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
const DAYS = 100

describe('Life 7 experiment 3: carrying, with and without its cost', () => {
  const result = carryingExperiment(seeds, ['canonical', 'noCarry'], DAYS)
  const { canonical, noCarry } = result.rows as Required<typeof result.rows>

  it('slows a forager with a full load to 83 cm a second', () => {
    expect(result.speedWithLoad).toBe(83)
  })

  it('changes walking by less than a tenth of an hour a day', () => {
    expect(Math.abs(canonical.walkHoursPerDay - noCarry.walkHoursPerDay)).toBeLessThan(0.1)
  })
})
