import { describe, expect, it } from 'vitest'
import { countAffordableAtPrice, giniCoefficient, median, summarizeCashDistribution } from './analytics'
import { createSimulation, stepSimulation } from './engine'

describe('multi-industry observer analytics', () => {
  it('calculates median and known Gini values', () => {
    expect(median([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(5.5)
    expect(giniCoefficient(Array(10).fill(5_000))).toBe(0)
    expect(giniCoefficient([0, 100])).toBe(0.5)
  })

  it('summarizes balances without mutating or controlling the economy', () => {
    const values = [800, 800, 800, 800, 800, 800, 800, 800, 1_800, 1_800]
    expect(summarizeCashDistribution(values)).toEqual({ minimumCents: 800, medianCents: 800, maximumCents: 1_800, gini: 0.16 })
    expect(values[0]).toBe(800)
  })

  it('counts affordability from the effective cash/budget constraint independently of order', () => {
    const effective = [200, 800, 1_000, 1_000, 50, 999, 1_000, 700, 1_000, 0]
    expect(countAffordableAtPrice(effective, 1_000)).toBe(4)
    expect(countAffordableAtPrice([...effective].reverse(), 1_000)).toBe(4)
  })

  it('records economy-wide and per-market historical boundaries', () => {
    const state = stepSimulation(createSimulation({ startingPriceCents: 100, initialStepCents: 100, dailySupplyPerIndustry: 10 }))
    expect(state.metrics[0]).toMatchObject({ householdCashMinimumAtMarketOpenCents: 5_000, householdCashMedianAtMarketOpenCents: 5_000, householdCashMaximumAtMarketOpenCents: 5_000, householdCashGiniAtMarketOpen: 0, totalHouseholdCashCents: 500_000, totalWagesPaidCents: expect.any(Number) })
    expect(state.metrics[0].householdCashGini).toBeGreaterThan(0)
    expect(state.metrics[0].markets).toHaveLength(8)
    expect(state.metrics[0].markets.every(({ householdsAffordableAtMarketOpen }) => householdsAffordableAtMarketOpen === 100)).toBe(true)
  })
})
