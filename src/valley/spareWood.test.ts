import { describe, expect, it } from 'vitest'
import { spareWoodExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
const DAYS = 100

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
