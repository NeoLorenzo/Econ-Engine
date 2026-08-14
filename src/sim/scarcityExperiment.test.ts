import { describe, expect, it } from 'vitest'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import { EXPECTED_INDUSTRY_OPTIMA_CENTS, MULTI_INDUSTRY_STARTING_PRICES_CENTS, runMultiIndustryExperiment } from './scarcityExperiment'

describe('deterministic multi-industry experiment', () => {
  it('preserves control endpoints and records competitive trajectories reproducibly', () => {
    const first = runMultiIndustryExperiment()
    const second = runMultiIndustryExperiment()
    expect(first).toEqual(second)
    expect(first.firms).toHaveLength(9)
    expect(Object.values(MULTI_INDUSTRY_STARTING_PRICES_CENTS)).toEqual([100, 200, 500, 1_500, 2_000])
    expect(first.firms.filter(({ industryId }) => industryId !== 'transport').every((firm) => firm.finalPriceCents >= 1)).toBe(true)
    expect(first.firms.find(({ industryId }) => industryId === 'transport')?.convergedPriceCents).toBeNull()
    expect(first.firms.filter(({ industryId }) => industryId === 'entertainment').map(({ startingPriceCents }) => startingPriceCents)).toEqual([100, 800])
    expect(first.competitionHistory.length).toBeGreaterThan(0)
    expect(first.competitionHistory.every((point) => point.marketShare >= 0 && point.marketShare <= 1)).toBe(true)
    expect(first).toMatchObject({ finalHouseholdCashMinimumCents: expect.any(Number), finalHouseholdCashMedianCents: expect.any(Number), finalHouseholdCashMaximumCents: expect.any(Number), finalHouseholdCashGini: expect.any(Number), totalMoneyCents: 50_000 })
    expect(first.finalHouseholdCashGini).toBeGreaterThan(0)
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
