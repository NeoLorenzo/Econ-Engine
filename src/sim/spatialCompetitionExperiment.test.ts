import { describe, expect, it } from 'vitest'
import { runSpatialCompetitionExperiment } from './spatialCompetitionExperiment'

describe('spatial competition experiment', () => {
  it('records reproducible layouts, trajectories, local shares, distances, and Transport revenue across seeds', () => {
    const first = runSpatialCompetitionExperiment([7, 42], 30)
    expect(first).toEqual(runSpatialCompetitionExperiment([7, 42], 30))
    expect(first).toHaveLength(2)
    expect(first.every((result) => result.priceTrajectories['firm-entertainment-a'].length === 30 && result.finalTransportRevenueCents > 0)).toBe(true)
  }, 10_000)
})
