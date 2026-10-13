import { describe, expect, it } from 'vitest'
import { groupsFromScatteredExperiment, valleySeeds } from './experiments'

// Life 6's experiments are tests in their own files, so they run in parallel, and every run checks every invariant
// every minute. Groups form within the first days, so 30 days suffice here.
const seeds = valleySeeds(8)
const DAYS = 30

describe('Life 6 experiment 1: groups from a scattered start', () => {
  const result = groupsFromScatteredExperiment(seeds, DAYS)

  it('puts every forager in a group by the end of day 2', () => {
    for (const day of result.allGroupedDays) {
      expect(day).not.toBeNull()
      expect(day!).toBeLessThanOrEqual(2)
    }
  })

  it('founds no more groups than two to a group allows, and dissolves none', () => {
    for (const run of result.row.runs) {
      expect(run.groupsFounded).toBeGreaterThanOrEqual(1)
      expect(run.groupsFounded).toBeLessThanOrEqual(result.mostGroups)
      expect(run.dissolutions).toBe(0)
    }
  })
})
