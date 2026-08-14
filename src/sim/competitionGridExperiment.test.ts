import { describe, expect, it } from 'vitest'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import { COMPETITION_GRID_STARTS_CENTS, runCompetitionStartingPriceGrid } from './competitionGridExperiment'

describe('Entertainment starting-price grid experiment', () => {
  it('runs the full deterministic Cartesian grid', () => {
    const first = runCompetitionStartingPriceGrid({ horizonDays: 10 })
    const second = runCompetitionStartingPriceGrid({ horizonDays: 10 })
    expect(first).toEqual(second)
    expect(first.startingPricesCents).toEqual([...COMPETITION_GRID_STARTS_CENTS])
    expect(first.results).toHaveLength(64)
  }, 20_000)

  it('records both orientations of swapped starts under seeded sampling', () => {
    const suite = runCompetitionStartingPriceGrid({ startingPricesCents: [100, 200, 300], horizonDays: 100 })
    for (const xy of suite.results) {
      const yx = suite.results.find((result) => result.firmAStartCents === xy.firmBStartCents && result.firmBStartCents === xy.firmAStartCents)!
      expect(yx).toBeDefined()
      expect(xy.bothConverged).toBe(true)
      expect(yx.bothConverged).toBe(true)
    }
  }, 30_000)

  it('reports non-convergence at a short horizon and does not mutate options', () => {
    const options = { startingPricesCents: [100, 800] as const, horizonDays: 1 }
    const original = structuredClone(options)
    const suite = runCompetitionStartingPriceGrid(options)
    expect(suite.results.some((result) => !result.bothConverged && result.firmAEndpointCents === null && result.firmBEndpointCents === null)).toBe(true)
    expect(options).toEqual(original)
  })

  it('keeps all non-Transport firms inside valid competitive pricing state', () => {
    const suite = runCompetitionStartingPriceGrid({ startingPricesCents: [100, 1_000], horizonDays: 100 })
    expect(suite.results.every(({ controlEndpointsCents }) => Object.entries(controlEndpointsCents).every(([id, price]) => id === 'transport' ? price === null : price === null || price >= 1))).toBe(true)
  }, 20_000)

  it('keeps observer results outside the pricing boundary', () => {
    const state = createPricingState(200, 100)
    const before = decideTomorrowPrice(state, 200, 5, 1_000)
    const observerOnly = { competitorEndpoint: 400, marketShare: 0.5, gridCell: '4/4' }
    expect(observerOnly.marketShare).toBe(0.5)
    expect(decideTomorrowPrice(state, 200, 5, 1_000)).toEqual(before)
  })
})
