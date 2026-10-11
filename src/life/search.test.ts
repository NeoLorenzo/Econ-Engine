import { describe, expect, it } from 'vitest'
import { knowledgeInABandExperiment, searchCostExperiment } from './experiments'

// Band experiments are split across files so they run in parallel. Every run checks every invariant every hour.
describe('experiment 3: the cost of local knowledge in a band', () => {
  const { perRadius, searchCapacity } = knowledgeInABandExperiment()
  const at = (radius: number) => perRadius.find((entry) => entry.perceptionRadiusTiles === radius)!.perSeed

  it('sends foragers seeing only their own tile to patches others have emptied', () => {
    for (const { small } of at(0)) {
      expect(small.survived).toBe(true)
      expect(small.emptyArrivals).toBeGreaterThan(0)
    }
  })

  it('sends no forager to an empty patch with full information', () => {
    for (const { small, large } of perRadius.at(-1)!.perSeed) {
      expect(small.emptyArrivals).toBe(0)
      expect(large.emptyArrivals).toBe(0)
    }
  })

  it('does not prevent the collapse with full information', () => {
    for (const { large } of perRadius.at(-1)!.perSeed) expect(large.survivors).toBeLessThanOrEqual(searchCapacity)
  })
})

describe('experiment 4: the cost of searching', () => {
  const rows = searchCostExperiment()

  it('saves foragers when walking is cheaper', () => {
    const [costly, , cheap] = rows
    for (const [index, run] of cheap!.perSeed.entries())
      expect(run.survivors).toBeGreaterThan(costly!.perSeed[index]!.survivors)
  })

  it('leaves no more survivors than the land could feed searching at that cost', () => {
    for (const row of rows) {
      const bound = Math.min(row.carryingCapacity, row.searchCapacity)
      for (const run of row.perSeed) expect(run.survivors).toBeLessThanOrEqual(bound)
    }
  })
})
