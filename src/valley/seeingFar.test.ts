import { describe, expect, it } from 'vitest'
import { seeingFarExperiment, valleySeeds } from './experiments'

// Life 7's experiments are tests in their own files, so they run in parallel, and every run checks every invariant
// every minute. Groups form on the first morning, so 30 days suffice here; the sweep of shorter sight is reported.
const seeds = valleySeeds(8)
const DAYS = 30

describe('Life 7 experiment 1: seeing far', () => {
  const result = seeingFarExperiment(seeds, DAYS, [])

  it('puts every forager in a group by the end of day 1', () => {
    for (const day of result.allGroupedDays) {
      expect(day).not.toBeNull()
      expect(day!).toBeLessThanOrEqual(1)
    }
  })

  it('splits the band into more groups than Life 6 does, and founds no more than two to a group allows', () => {
    expect(result.canonical.meanGroups).toBeGreaterThan(result.life6.meanGroups)
    for (const run of result.canonical.runs) expect(run.groupsFounded).toBeLessThanOrEqual(result.mostGroups)
  })
})
