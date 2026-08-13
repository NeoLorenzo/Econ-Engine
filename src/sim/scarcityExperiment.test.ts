import { describe, expect, it } from 'vitest'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import { runStartingPriceExperiments, SCARCITY_EXPERIMENT_STARTING_PRICES_CENTS } from './scarcityExperiment'

describe('controlled starting-price experiments', () => {
  it('is reproducible and includes the required price grid', () => {
    const first = runStartingPriceExperiments()
    const second = runStartingPriceExperiments()
    expect(first).toEqual(second)
    expect(first.results.map((result) => result.startingPriceCents)).toEqual([...SCARCITY_EXPERIMENT_STARTING_PRICES_CENTS])
  })

  it('stabilizes every sampled default-supply run at $10.00 with equal wealth', () => {
    const suite = runStartingPriceExperiments()
    expect(suite.dailyFoodSupply).toBe(10)
    expect(suite.results.every((result) => result.convergedPriceCents === 1_000)).toBe(true)
    expect(suite.results.every((result) => result.finalHouseholdCashMinimumCents === 1_000
      && result.finalHouseholdCashMedianCents === 1_000
      && result.finalHouseholdCashMaximumCents === 1_000
      && result.finalHouseholdCashGini === 0)).toBe(true)
  })

  it('varies only starting price across otherwise identical run configuration', () => {
    const suite = runStartingPriceExperiments({ startingPricesCents: [100, 200], initialStepCents: 73, dailyFoodSupply: 6, horizonDays: 25 })
    expect(suite).toMatchObject({ initialStepCents: 73, dailyFoodSupply: 6, horizonDays: 25 })
    expect(suite.results.map((result) => result.startingPriceCents)).toEqual([100, 200])
  })

  it('reports non-convergence at the horizon without fabricating a result', () => {
    const [result] = runStartingPriceExperiments({ startingPricesCents: [200], horizonDays: 1 }).results
    expect(result.convergedPriceCents).toBeNull()
    expect(result.daysToConvergence).toBeNull()
    expect(result.cumulativeFoodConsumptionByHousehold.reduce((sum, units) => sum + units, 0)).toBe(10)
  })

  it('collects a complete household outcome history independent of bounded events', () => {
    const suite = runStartingPriceExperiments({ startingPricesCents: [200], horizonDays: 300 })
    const result = suite.results[0]
    const days = result.daysToConvergence ?? suite.horizonDays
    result.cumulativeFoodConsumptionByHousehold.forEach((purchased, index) => {
      expect(purchased + result.cumulativeStockoutFailuresByHousehold[index] + result.cumulativeAffordabilityFailuresByHousehold[index]).toBe(days)
    })
  })

  it('leaves strategy decisions dependent only on their existing inputs', () => {
    const pricing = createPricingState(200, 100)
    const beforeObserverAnalytics = decideTomorrowPrice(pricing, 200, 8, 1_600)
    const observerOnlyMetrics = { gini: 0.37, affordableHouseholds: 3, medianCashCents: 412 }
    expect(observerOnlyMetrics.gini).toBeGreaterThan(0)
    const afterObserverAnalytics = decideTomorrowPrice(pricing, 200, 8, 1_600)
    expect(afterObserverAnalytics).toEqual(beforeObserverAnalytics)
    expect(afterObserverAnalytics.nextPriceCents).toBe(300)
  })
})
