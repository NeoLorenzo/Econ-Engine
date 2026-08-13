import { describe, expect, it } from 'vitest'
import { DEFAULT_INDUSTRIES, INDUSTRY_BUDGET_CENTS, TOTAL_MONEY_CENTS } from './config'
import { createSimulation, runDays, stepSimulation } from './engine'
import { totalMoney, validateState } from './invariants'
import type { IndustryId, SimulationConfig } from './types'

const config = (price = 1_000, supply = 10, extra: Partial<SimulationConfig> = {}): SimulationConfig => ({ startingPriceCents: price, initialStepCents: 100, dailySupplyPerIndustry: supply, ...extra })
const market = (state: ReturnType<typeof stepSimulation>, id: IndustryId) => state.metrics.at(-1)!.markets.find((item) => item.industryId === id)!

describe('Econ-Engine MVP 2 multi-industry economy', () => {
  it('creates exactly five named industries and one independent firm per industry', () => {
    const state = createSimulation()
    expect(state.industries).toEqual(DEFAULT_INDUSTRIES)
    expect(state.firms).toHaveLength(5)
    expect(state.firms.map(({ industryId }) => industryId)).toEqual(DEFAULT_INDUSTRIES.map(({ id }) => id))
    expect(new Set(state.firms.map(({ pricing }) => pricing)).size).toBe(5)
  })

  it('gives every household $50 cash plus five $10 behavioral budgets without creating money', () => {
    const state = createSimulation()
    expect(state.households.every((household) => household.cashCents === 5_000)).toBe(true)
    expect(state.households.every((household) => Object.values(household.industryOutcomes).length === 5)).toBe(true)
    expect(state.households.every((household) => Object.values(household.industryOutcomes).every(({ budgetCents }) => budgetCents === INDUSTRY_BUDGET_CENTS))).toBe(true)
    expect(totalMoney(state)).toBe(TOTAL_MONEY_CENTS)
  })

  it('supplies ten units and permits one purchase in every industry', () => {
    const state = stepSimulation(createSimulation(config()))
    expect(state.firms.every((firm) => firm.unitsSoldToday === 10 && firm.unitsExpiredToday === 0)).toBe(true)
    expect(state.metrics[0].markets.every((item) => item.unitsSupplied === 10 && item.stockoutFailures === 0)).toBe(true)
    expect(state.households.every((household) => Object.values(household.industryOutcomes).filter(({ purchasedToday }) => purchasedToday).length === 5)).toBe(true)
  })

  it('keeps each industry budget independent while reducing one real cash balance', () => {
    const state = stepSimulation(createSimulation(config(900)))
    expect(state.households.every((household) => household.cashCents === 5_000)).toBe(true)
    expect(state.households.every((household) => Object.values(household.industryOutcomes).every((outcome) => outcome.spentTodayCents === 900 && outcome.budgetCents === 1_000))).toBe(true)
  })

  it('rejects $10.01 by the relevant industry constraint without blocking affordable industries', () => {
    const state = stepSimulation(createSimulation(config(1_000, 10, { industryStartingPricesCents: { food: 1_001 } })))
    expect(market(state, 'food')).toMatchObject({ unitsSold: 0, affordabilityFailures: 10, stockoutFailures: 0, unitsExpired: 10 })
    expect(state.metrics[0].markets.filter(({ industryId }) => industryId !== 'food').every(({ unitsSold }) => unitsSold === 10)).toBe(true)
    expect(state.households.every((household) => household.cashCents === 5_000)).toBe(true)
  })

  it('accounts for finite stock independently in every market', () => {
    let state = createSimulation(config(500, 8))
    for (let day = 0; day < 25; day += 1) {
      state = stepSimulation(state)
      for (const firm of state.firms) {
        expect(firm.unitsSoldToday).toBeLessThanOrEqual(8)
        expect(firm.unitsSoldToday + firm.unitsExpiredToday).toBe(8)
        expect(firm.availableUnitsToday).toBe(0)
      }
      expect(() => validateState(state, true)).not.toThrow()
    }
  })

  it('preserves affordability versus stockout causes in lower-supply scenarios', () => {
    const state = stepSimulation(createSimulation(config(1_000, 8, { industryStartingPricesCents: { food: 1_001 } })))
    expect(market(state, 'food')).toMatchObject({ affordabilityFailures: 10, stockoutFailures: 0 })
    expect(market(state, 'utilities')).toMatchObject({ unitsSold: 8, affordabilityFailures: 0, stockoutFailures: 2 })
    expect(state.events.filter(({ type }) => type === 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT').length).toBeGreaterThan(0)
  })

  it('collects all firm taxes into one pool and redistributes every cent', () => {
    const state = stepSimulation(createSimulation(config(500, 2)))
    expect(state.firms.every(({ revenueTodayCents, cashCents }) => revenueTodayCents === 1_000 && cashCents === 0)).toBe(true)
    expect(state.government).toMatchObject({ taxCollectedTodayCents: 5_000, redistributedTodayCents: 5_000, cashCents: 0 })
    expect(totalMoney(state)).toBe(50_000)
  })

  it('holds $50 balances and zero Gini at the converged benchmark', () => {
    const state = runDays(createSimulation(config()), 1_000)
    expect(state.firms.every((firm) => firm.pricing.converged && firm.pricing.bestPriceCents === 1_000 && firm.postedPriceCents === 1_000)).toBe(true)
    expect(state.households.every(({ cashCents }) => cashCents === 5_000)).toBe(true)
    expect(state.metrics.every(({ householdCashGini, totalMoneyCents }) => householdCashGini === 0 && totalMoneyCents === 50_000)).toBe(true)
  }, 15_000)

  it('keeps firm learners isolated from each other', () => {
    const state = stepSimulation(createSimulation(config(200, 10, { industryStartingPricesCents: { food: 2_000 } })))
    const food = state.firms.find(({ industryId }) => industryId === 'food')!
    const utilities = state.firms.find(({ industryId }) => industryId === 'utilities')!
    expect(food.latestDecisionAction).toBe('decrease')
    expect(utilities.latestDecisionAction).toBe('increase')
    expect(food.pricing).not.toEqual(utilities.pricing)
  })

  it('is fully deterministic including metrics, events, and cumulative outcomes', () => {
    const first = runDays(createSimulation(config(347, 8)), 80)
    const second = runDays(createSimulation(config(347, 8)), 80)
    expect(first).toEqual(second)
  })

  it('makes canonical baseline results independent of industry processing order', () => {
    const forward = runDays(createSimulation(config(1_000)), 30)
    const reverseOrder = [...DEFAULT_INDUSTRIES.map(({ id }) => id)].reverse()
    const reverse = runDays(createSimulation(config(1_000, 10, { industryProcessingOrder: reverseOrder })), 30)
    expect(reverse.households).toEqual(forward.households)
    const normalize = (state: typeof forward) => state.firms.map((firm) => ({ industryId: firm.industryId, price: firm.postedPriceCents, pricing: firm.pricing, sold: firm.unitsSoldToday, revenue: firm.revenueTodayCents }))
    expect(normalize(reverse)).toEqual(normalize(forward))
  })

  it('retains cumulative counters independently for each household and industry', () => {
    const state = runDays(createSimulation(config(1, 8)), 10)
    for (const household of state.households) for (const outcome of Object.values(household.industryOutcomes)) {
      expect(outcome.lifetimeUnitsPurchased + outcome.lifetimeStockoutFailures + outcome.lifetimeAffordabilityFailures).toBe(10)
    }
    expect(state.households.some((household) => household.industryOutcomes.food.lifetimeStockoutFailures > 0)).toBe(true)
  })

  it('resets all multi-market daily and cumulative state', () => {
    const ran = runDays(createSimulation(config(500, 8)), 3)
    const reset = createSimulation(ran.config)
    expect(reset.day).toBe(0)
    expect(reset.firms.every((firm) => firm.unitsSoldToday === 0 && firm.cashCents === 0)).toBe(true)
    expect(reset.households.every((household) => Object.values(household.industryOutcomes).every((outcome) => outcome.lifetimeUnitsPurchased === 0 && outcome.purchaseOutcomeToday === null))).toBe(true)
  })

  it('bounds histories and retains firm/industry identity in records and events', () => {
    const state = runDays(createSimulation(config()), 450)
    expect(state.metrics).toHaveLength(400)
    expect(state.events.length).toBeLessThanOrEqual(600)
    expect(state.metrics.every(({ markets }) => markets.length === 5 && markets.every(({ firmId, industryId }) => firmId === `firm-${industryId}`))).toBe(true)
    expect(state.events.filter(({ type }) => type === 'FIRM_DAY_RESULT').every(({ firmId, industryId }) => Boolean(firmId && industryId))).toBe(true)
  })

  it('sanitizes common supply and preserves explicit zero supply', () => {
    expect(createSimulation(config(200, -3)).config.dailySupplyPerIndustry).toBe(0)
    expect(createSimulation(config(200, 4.6)).config.dailySupplyPerIndustry).toBe(5)
    expect(stepSimulation(createSimulation(config(200, 0))).firms.every((firm) => firm.unitsSoldToday === 0 && firm.unitsExpiredToday === 0)).toBe(true)
  })
})
