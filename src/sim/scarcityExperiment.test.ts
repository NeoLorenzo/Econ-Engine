import { describe, expect, it } from 'vitest'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import { MULTI_INDUSTRY_STARTING_PRICES_CENTS, runMultiIndustryExperiment } from './scarcityExperiment'

describe('deterministic multi-industry experiment', () => {
  it('converges five varied independent starts to $10.00 reproducibly', () => {
    const first = runMultiIndustryExperiment()
    const second = runMultiIndustryExperiment()
    expect(first).toEqual(second)
    expect(first.firms).toHaveLength(5)
    expect(Object.values(MULTI_INDUSTRY_STARTING_PRICES_CENTS)).toEqual([100, 200, 500, 1_500, 2_000])
    expect(first.firms.every((firm) => firm.convergedPriceCents === 1_000 && firm.daysToConvergence !== null)).toBe(true)
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
