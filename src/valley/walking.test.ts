import { describe, expect, it } from 'vitest'
import { valleySeeds, walkingExperiment } from './experiments'

const seeds = valleySeeds(8)
// Checking settles into its daily round within days, so 100 days suffice. Life 6's walking is tested in
// `knowing.test.ts`.
const DAYS = 100

describe('Life 7 experiment 2: walking and checking', () => {
  const result = walkingExperiment(seeds, DAYS, false)

  it('keeps every band intact, exploring or not', () => {
    for (const row of [result.canonical, result.noExplore]) expect(row.runs.every((run) => run.survived)).toBe(true)
  })

  it('walks less than an hour and a half a day, and under half an hour without exploring', () => {
    expect(result.canonical.walkHoursPerDay).toBeLessThan(1.5)
    expect(result.noExplore.walkHoursPerDay).toBeLessThan(0.5)
  })

  it('works the hours the time-use prediction gives with the walking measured, within 5%', () => {
    expect(Math.abs(result.canonical.workHoursPerDay / result.predictedWorkHours - 1)).toBeLessThan(0.05)
  })

  it('has seen every place by the end of its first day', () => {
    for (const run of result.canonical.runs) expect(run.allSeenDays.every((day) => day === 0)).toBe(true)
  })
})
