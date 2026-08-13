import { describe, expect, it } from 'vitest'
import { createSimulation, runDays, stepSimulation } from './engine'
import { totalMoney, validateState } from './invariants'
import type { SimulationConfig } from './types'

const config = (startingPriceCents: number, initialStepCents = 100, dailyFoodSupply = 8): SimulationConfig => ({
  startingPriceCents,
  initialStepCents,
  dailyFoodSupply,
})

describe('Econ-Engine MVP 1 finite supply', () => {
  it('defaults to ten exogenous food units per day', () => {
    const state = createSimulation()
    expect(state.config.dailyFoodSupply).toBe(10)
    expect(state.firm.availableFoodToday).toBe(0)
  })

  it.each([
    [999, 8, 7_992, 2],
    [1_000, 8, 8_000, 2],
    [1_001, 0, 0, 0],
  ])('matches the finite-supply benchmark at %i cents', (price, sales, revenue, stockouts) => {
    const state = stepSimulation(createSimulation(config(price)))
    const metric = state.metrics[0]
    expect(state.firm.unitsSoldToday).toBe(sales)
    expect(state.firm.revenueTodayCents).toBe(revenue)
    expect(metric.stockoutFailures).toBe(stockouts)
    expect(metric.affordabilityFailures).toBe(price === 1_001 ? 10 : 0)
  })

  it('prevents sales above finite supply and never makes inventory negative', () => {
    let state = createSimulation(config(100, 25, 3))
    for (let day = 0; day < 80; day += 1) {
      state = stepSimulation(state)
      expect(state.firm.unitsSoldToday).toBeLessThanOrEqual(3)
      expect(state.firm.availableFoodToday).toBe(0)
      expect(() => validateState(state, true)).not.toThrow()
    }
  })

  it('sells exactly eight affordable units and categorizes two stockouts', () => {
    const state = stepSimulation(createSimulation(config(500)))
    expect(state.households.filter((household) => household.purchaseOutcomeToday === 'purchased')).toHaveLength(8)
    expect(state.households.filter((household) => household.purchaseOutcomeToday === 'stockout')).toHaveLength(2)
    expect(state.households.filter((household) => household.purchaseOutcomeToday === 'insufficient_funds')).toHaveLength(0)
  })

  it('expires unsold food and conserves the daily food stock-flow exactly', () => {
    const state = stepSimulation(createSimulation(config(500, 100, 12)))
    const metric = state.metrics[0]
    expect(metric.foodSupplied).toBe(12)
    expect(metric.unitsSold).toBe(10)
    expect(metric.unitsExpired).toBe(2)
    expect(metric.foodSupplied).toBe(metric.unitsSold + metric.unitsExpired)
    expect(state.events.find((event) => event.type === 'FOOD_EXPIRED')?.quantity).toBe(2)
  })

  it('records a supply source and explicit zero-quantity expiration when sold out', () => {
    const state = stepSimulation(createSimulation(config(500)))
    expect(state.events.find((event) => event.type === 'FOOD_SUPPLY_RECEIVED')?.quantity).toBe(8)
    expect(state.events.find((event) => event.type === 'FOOD_EXPIRED')?.quantity).toBe(0)
    expect(state.metrics[0].soldOut).toBe(true)
  })

  it('does not carry food between days', () => {
    const dayOne = stepSimulation(createSimulation(config(1_001, 100, 8)))
    expect(dayOne.firm.unitsExpiredToday).toBe(8)
    expect(dayOne.firm.availableFoodToday).toBe(0)
    const dayTwo = stepSimulation(dayOne)
    expect(dayTwo.metrics[1].foodSupplied).toBe(8)
    expect(dayTwo.metrics[1].unitsSold + dayTwo.metrics[1].unitsExpired).toBe(8)
    expect(dayTwo.firm.availableFoodToday).toBe(0)
  })

  it('distinguishes affordability failures from stockout failures', () => {
    const unaffordable = stepSimulation(createSimulation(config(1_001)))
    const scarce = stepSimulation(createSimulation(config(1_000)))
    expect(unaffordable.metrics[0]).toMatchObject({ unitsSold: 0, affordabilityFailures: 10, stockoutFailures: 0, unitsExpired: 8 })
    expect(scarce.metrics[0]).toMatchObject({ unitsSold: 8, affordabilityFailures: 0, stockoutFailures: 2, unitsExpired: 0 })
    expect(unaffordable.events.filter((event) => event.type === 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS')).toHaveLength(10)
    expect(scarce.events.filter((event) => event.type === 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT')).toHaveLength(2)
  })

  it('accounts for one and only one outcome per household', () => {
    const state = stepSimulation(createSimulation(config(500, 100, 4)))
    const metric = state.metrics[0]
    expect(metric.unitsSold + metric.affordabilityFailures + metric.stockoutFailures).toBe(10)
    expect(state.households.every((household) => household.purchaseOutcomeToday !== null)).toBe(true)
  })

  it('rotates purchasing priority deterministically across days', () => {
    let state = createSimulation(config(1, 1, 8))
    const failedByDay: string[][] = []
    for (let day = 0; day < 10; day += 1) {
      state = stepSimulation(state)
      failedByDay.push(state.households.filter((household) => household.purchaseOutcomeToday === 'stockout').map((household) => household.id))
    }
    expect(failedByDay[0]).toEqual(['household-9', 'household-10'])
    expect(failedByDay[1]).toEqual(['household-1', 'household-10'])
    const failureCounts = state.households.map((household) => failedByDay.flat().filter((id) => id === household.id).length)
    expect(failureCounts).toEqual(Array(10).fill(2))
  })

  it('is deterministic, including allocation and failure causes', () => {
    const first = runDays(createSimulation(config(347, 83)), 80)
    const second = runDays(createSimulation(config(347, 83)), 80)
    expect(first).toEqual(second)
  })

  it('conserves money and clears firm/government balances across many days', () => {
    let state = createSimulation()
    for (let day = 0; day < 250; day += 1) {
      state = stepSimulation(state)
      expect(totalMoney(state)).toBe(10_000)
      expect(state.firm.cashCents).toBe(0)
      expect(state.government.cashCents).toBe(0)
      expect(state.households.every((household) => household.cashCents >= 0)).toBe(true)
    }
  })

  it('preserves exact taxation and redistribution', () => {
    const state = stepSimulation(createSimulation(config(500, 100, 2)))
    expect(state.firm.revenueTodayCents).toBe(1_000)
    expect(state.government.taxCollectedTodayCents).toBe(1_000)
    expect(state.government.redistributedTodayCents).toBe(1_000)
    expect(state.households.map((household) => household.cashCents)).toEqual([600, 600, 1_100, 1_100, 1_100, 1_100, 1_100, 1_100, 1_100, 1_100])
  })

  it('preserves historical finite-supply snapshots independently of current state', () => {
    const state = runDays(createSimulation(config(500, 100, 12)), 2)
    expect(state.metrics[0]).toMatchObject({ foodSupplied: 12, unitsSold: 10, unitsExpired: 2, stockoutFailures: 0, affordabilityFailures: 0, soldOut: false })
    expect(state.metrics[1].foodSupplied).toBe(12)
    expect(state.metrics[0]).not.toBe(state.metrics[1])
  })

  it('sanitizes and resets daily-supply configuration', () => {
    expect(createSimulation(config(200, 100, -3)).config.dailyFoodSupply).toBe(0)
    expect(createSimulation(config(200, 100, 4.6)).config.dailyFoodSupply).toBe(5)
    expect(stepSimulation(createSimulation(config(200, 100, 0))).metrics[0]).toMatchObject({ foodSupplied: 0, unitsSold: 0, unitsExpired: 0 })
  })

  it('snapshots the actual historical pricing step each day', () => {
    const state = runDays(createSimulation(config(200)), 20)
    const steps = state.metrics.map((metric) => metric.priceStepSizeCents)
    expect(steps[0]).toBe(100)
    expect(steps).toContain(50)
    expect(steps.every(Number.isInteger)).toBe(true)
  })

  it('exposes structured pricing actions without adding stockout rules', () => {
    const increasing = stepSimulation(createSimulation(config(200)))
    const decreasing = stepSimulation(createSimulation(config(2_000)))
    expect(increasing.latestDecisionAction).toBe('increase')
    expect(increasing.firm.postedPriceCents).toBe(300)
    expect(decreasing.latestDecisionAction).toBe('decrease')
    expect(decreasing.firm.postedPriceCents).toBe(1_900)
  })

  it('keeps the historical eight-unit path deterministic for scarcity analysis', () => {
    const state = runDays(createSimulation(config(200, 100, 8)), 140)
    expect(state.pricing.converged).toBe(true)
    expect(state.pricing.bestPriceCents).toBe(670)
    expect(state.firm.postedPriceCents).toBe(670)
  })

  it('stabilizes the default ten-unit path at the analytical benchmark', () => {
    const state = runDays(createSimulation(), 140)
    expect(state.pricing.converged).toBe(true)
    expect(state.pricing.bestPriceCents).toBe(1_000)
    expect(state.households.every((household) => household.cashCents === 1_000)).toBe(true)
  })

  it('escapes a zero-sales region and converges to the $10.00 benchmark from above', () => {
    const state = runDays(createSimulation(config(2_000)), 180)
    expect(state.pricing.foundPositiveProfit).toBe(true)
    expect(state.pricing.converged).toBe(true)
    expect(state.pricing.bestPriceCents).toBe(1_000)
  })

  it('tests both one-cent neighbors before stopping', () => {
    const state = runDays(createSimulation(config(200)), 140)
    expect(state.pricing.stepSizeCents).toBe(1)
    expect(state.pricing.testedLowerAtOneCent).toBe(true)
    expect(state.pricing.testedUpperAtOneCent).toBe(true)
  })
})
