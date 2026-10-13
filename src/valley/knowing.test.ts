import { describe, expect, it } from 'vitest'
import { knowingExperiment, valleySeeds } from './experiments'

const seeds = valleySeeds(8)
// Exploring settles into its daily round within days, so 100 days suffice.
const DAYS = 100

describe('Life 6 experiment 2: knowing and exploring', () => {
  const result = knowingExperiment(seeds, DAYS)

  it('keeps every band intact, exploring or not', () => {
    for (const row of [result.explore, result.noExplore, result.slowExplore])
      expect(row.runs.every((run) => run.survived)).toBe(true)
  })

  it('walks more than two hours a day exploring, and under half an hour without', () => {
    expect(result.explore.walkHoursPerDay).toBeGreaterThan(2)
    expect(result.noExplore.walkHoursPerDay).toBeLessThan(0.5)
  })

  it('works the hours the time-use prediction gives with the walking measured, within 5%', () => {
    expect(Math.abs(result.explore.workHoursPerDay / result.predictedWorkHours - 1)).toBeLessThan(0.05)
  })
})
