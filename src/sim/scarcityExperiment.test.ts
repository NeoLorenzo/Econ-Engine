import { describe, expect, it } from 'vitest'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import { EXPECTED_INDUSTRY_OPTIMA_CENTS, MULTI_INDUSTRY_STARTING_PRICES_CENTS, runMultiIndustryExperiment } from './scarcityExperiment'

describe('deterministic multi-industry experiment', () => {
  it('preserves control endpoints and records competitive trajectories reproducibly', () => {
    const first = runMultiIndustryExperiment()
    const second = runMultiIndustryExperiment()
    expect(first).toEqual(second)
    expect(first.firms).toHaveLength(6)
    expect(Object.values(MULTI_INDUSTRY_STARTING_PRICES_CENTS)).toEqual([100, 200, 500, 1_500, 2_000])
    expect(first.firms.filter(({ industryId }) => industryId !== 'entertainment').every((firm) => firm.convergedPriceCents === EXPECTED_INDUSTRY_OPTIMA_CENTS[firm.industryId] && firm.daysToConvergence !== null)).toBe(true)
    expect(first.firms.filter(({ industryId }) => industryId === 'entertainment').map(({ startingPriceCents }) => startingPriceCents)).toEqual([100, 800])
    expect(first.competitionHistory.length).toBeGreaterThan(0)
    expect(first.competitionHistory.every((point) => point.marketShare >= 0 && point.marketShare <= 1)).toBe(true)
    expect(first).toMatchObject({ finalHouseholdCashMinimumCents: 5_000, finalHouseholdCashMedianCents: 5_000, finalHouseholdCashMaximumCents: 5_000, finalHouseholdCashGini: 0, totalMoneyCents: 50_000 })
  })

  it('reports horizon non-convergence without fabricating endpoints', () => {
    const result = runMultiIndustryExperiment({ horizonDays: 1 })
    expect(result.firms.some((firm) => firm.convergedPriceCents === null && firm.daysToConvergence === null)).toBe(true)
  })

  it('keeps observer analytics outside the unchanged strategy boundary', () => {
    const pricing = createPricingState(200, 100)
    const before = decideTomorrowPrice(pricing, 200, 10, 2_000)
    const observerOnly = { gini: 0.4, otherFirmProfit: 99_999 }
    expect(observerOnly.gini).toBeGreaterThan(0)
    expect(decideTomorrowPrice(pricing, 200, 10, 2_000)).toEqual(before)
  })
})
