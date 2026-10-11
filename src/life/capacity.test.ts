import { describe, expect, it } from 'vitest'
import { carryingCapacityExperiment, isSustained, survivorsSustained } from './experiments'

// Band experiments are split across files so they run in parallel. Every run checks every invariant every hour.
describe('experiment 2: carrying capacity', () => {
  const result = carryingCapacityExperiment()

  it('builds the bands around the capacities', () => {
    expect([result.smallBand, result.fullBand, result.largeBand]).toEqual([10, 20, 40])
  })

  it('keeps a band at the search capacity intact on every seed', () => {
    for (const { small } of result.perSeed) expect(isSustained(small)).toBe(true)
  })

  it('loses foragers from a band just above the carrying capacity on every seed', () => {
    for (const { full } of result.perSeed) expect(full.survived).toBe(false)
  })

  it('keeps no band intact above the carrying capacity, and every band up to the search capacity', () => {
    for (const { largestIntact } of result.perSeed) {
      expect(largestIntact!).toBeGreaterThanOrEqual(result.searchCapacity)
      expect(largestIntact!).toBeLessThan(result.carryingCapacity)
    }
  })

  it('collapses a large band below the search capacity within weeks, and the survivors then do well', () => {
    for (const { large } of result.perSeed) {
      expect(large.lastDeathDay!).toBeLessThan(30)
      expect(large.survivors).toBeGreaterThan(0)
      expect(large.survivors).toBeLessThanOrEqual(result.searchCapacity)
      expect(survivorsSustained(large)).toBe(true)
    }
  })
})
