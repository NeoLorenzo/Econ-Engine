import { describe, expect, it } from 'vitest'
import { countAffordableAtPrice, giniCoefficient, median, summarizeCashDistribution } from './analytics'
import { createSimulation, stepSimulation } from './engine'

describe('scarcity observer analytics', () => {
  it('calculates median correctly for ten households', () => {
    expect(median([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(5.5)
  })

  it('returns zero Gini for equal or all-zero balances', () => {
    expect(giniCoefficient(Array(10).fill(1_000))).toBe(0)
    expect(giniCoefficient(Array(10).fill(0))).toBe(0)
  })

  it('matches a known unequal Gini distribution', () => {
    expect(giniCoefficient([0, 100])).toBe(0.5)
    expect(giniCoefficient([0, 0, 0, 100])).toBe(0.75)
  })

  it('summarizes minimum, median, maximum, and Gini from balances only', () => {
    expect(summarizeCashDistribution([800, 800, 800, 800, 800, 800, 800, 800, 1_800, 1_800])).toEqual({
      minimumCents: 800,
      medianCents: 800,
      maximumCents: 1_800,
      gini: 0.16,
    })
  })

  it('counts affordability independently of queue order', () => {
    const balances = [200, 800, 1_000, 1_200, 50, 999, 2_000, 700, 1_001, 0]
    expect(countAffordableAtPrice(balances, 1_000)).toBe(4)
    expect(countAffordableAtPrice([...balances].reverse(), 1_000)).toBe(4)
  })

  it('captures market-open affordability and both pre- and post-market distributions', () => {
    const dayOne = stepSimulation(createSimulation({ startingPriceCents: 1_000, initialStepCents: 100, dailyFoodSupply: 8 }))
    expect(dayOne.metrics[0]).toMatchObject({
      householdsAffordableAtMarketOpen: 10,
      householdCashMinimumAtMarketOpenCents: 1_000,
      householdCashMedianAtMarketOpenCents: 1_000,
      householdCashMaximumAtMarketOpenCents: 1_000,
      householdCashGiniAtMarketOpen: 0,
      householdCashMinimumCents: 800,
      householdCashMedianCents: 800,
      householdCashMaximumCents: 1_800,
      householdCashGini: 0.16,
    })

    const dayTwo = stepSimulation(dayOne)
    expect(dayTwo.metrics[1].householdsAffordableAtMarketOpen).toBe(2)
    expect(dayTwo.metrics[1].householdCashMinimumAtMarketOpenCents).toBe(dayOne.metrics[0].householdCashMinimumCents)
    expect(dayTwo.metrics[1].householdCashMedianAtMarketOpenCents).toBe(dayOne.metrics[0].householdCashMedianCents)
    expect(dayTwo.metrics[1].householdCashMaximumAtMarketOpenCents).toBe(dayOne.metrics[0].householdCashMaximumCents)
  })

  it('increments cumulative outcomes from actual daily outcomes and retains them across days', () => {
    const config = { startingPriceCents: 1, initialStepCents: 1, dailyFoodSupply: 8 }
    const dayTwo = stepSimulation(stepSimulation(createSimulation(config)))
    expect(dayTwo.households[0]).toMatchObject({ lifetimeUnitsPurchased: 1, lifetimeStockoutFailures: 1, lifetimeAffordabilityFailures: 0 })
    expect(dayTwo.households[1]).toMatchObject({ lifetimeUnitsPurchased: 2, lifetimeStockoutFailures: 0, lifetimeAffordabilityFailures: 0 })
    expect(dayTwo.households[9]).toMatchObject({ lifetimeUnitsPurchased: 0, lifetimeStockoutFailures: 2, lifetimeAffordabilityFailures: 0 })
    expect(dayTwo.households.every((household) => household.lifetimeUnitsPurchased + household.lifetimeStockoutFailures + household.lifetimeAffordabilityFailures === 2)).toBe(true)
  })

  it('increments affordability failures and resets every cumulative counter', () => {
    const failed = stepSimulation(createSimulation({ startingPriceCents: 1_001, initialStepCents: 100, dailyFoodSupply: 8 }))
    expect(failed.households.every((household) => household.lifetimeAffordabilityFailures === 1)).toBe(true)
    const reset = createSimulation(failed.config)
    expect(reset.households.every((household) => household.lifetimeUnitsPurchased === 0 && household.lifetimeStockoutFailures === 0 && household.lifetimeAffordabilityFailures === 0)).toBe(true)
  })
})
