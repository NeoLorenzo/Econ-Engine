import { describe, expect, it } from 'vitest'
import { DEFAULT_INDUSTRIES, TOTAL_MONEY_CENTS } from './config'
import { createSimulation, runDays, stepSimulation } from './engine'
import { totalMoney, validateState } from './invariants'
import type { SimulationConfig } from './types'

const config = (extra: Partial<SimulationConfig> = {}): SimulationConfig => ({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, ...extra })

describe('MVP4 spatial Entertainment engine', () => {
  it('keeps three non-spatial consumer controls, two Entertainment firms, and one derived Transport firm', () => {
    const state = createSimulation()
    expect(state.industries).toEqual(DEFAULT_INDUSTRIES)
    expect(state.firms).toHaveLength(6)
    expect(state.firms.filter((firm) => firm.industryId === 'entertainment')).toHaveLength(2)
    expect(state.firms.filter((firm) => ['food', 'utilities', 'healthcare'].includes(firm.industryId))).toHaveLength(3)
  })

  it('does not create an abstract Transport purchase outcome', () => {
    const state = stepSimulation(createSimulation(config({ firmStartingPricesCents: { 'firm-entertainment-a': 100, 'firm-entertainment-b': 100 } })))
    expect(state.households.every((h) => h.industryOutcomes.transport.purchaseOutcomeToday === null)).toBe(true)
    expect(state.events.some((e) => e.type === 'HOUSEHOLD_PURCHASE' && e.industryId === 'transport')).toBe(false)
    expect(state.events.filter((e) => e.type === 'TRANSPORT_SERVICE_PURCHASED')).toHaveLength(10)
  })

  it('separates product and travel transfers and records causal spatial fields', () => {
    const state = createSimulation(config({ firmStartingPricesCents: { 'firm-entertainment-a': 100, 'firm-entertainment-b': 900 } }))
    state.households[0].coordinate = { x: 0, y: 0 }; state.firms.find((f) => f.id === 'firm-entertainment-a')!.coordinate = { x: 3, y: 1 }
    const day = stepSimulation(state)
    const purchase = day.events.find((e) => e.day === 1 && e.type === 'HOUSEHOLD_PURCHASE' && e.householdId === 'household-1' && e.industryId === 'entertainment')!
    const travel = day.events.find((e) => e.day === 1 && e.type === 'TRANSPORT_SERVICE_PURCHASED' && e.householdId === 'household-1')!
    expect(purchase).toMatchObject({ firmId: 'firm-entertainment-a', amountCents: 100, oneWayDistance: 4, roundTripTiles: 8, transportFeeCents: 16, deliveredCostCents: 116 })
    expect(travel).toMatchObject({ firmId: 'firm-transport', amountCents: 16 })
  })

  it('chooses delivered cost rather than sticker price', () => {
    const state = createSimulation(config({ firmStartingPricesCents: { 'firm-entertainment-a': 450, 'firm-entertainment-b': 420 } }))
    const h = state.households[0]; h.coordinate = { x: 0, y: 0 }
    state.firms.find((f) => f.id === 'firm-entertainment-a')!.coordinate = { x: 1, y: 0 }
    state.firms.find((f) => f.id === 'firm-entertainment-b')!.coordinate = { x: 10, y: 0 }
    const day = stepSimulation(state)
    expect(day.households[0].entertainmentToday?.chosenFirmId).toBe('firm-entertainment-a')
    expect(day.households[0].entertainmentToday?.deliveredCostCents).toBe(454)
  })

  it('applies the Entertainment budget to the full delivered cost', () => {
    const state = createSimulation(config({ firmStartingPricesCents: { 'firm-entertainment-a': 499, 'firm-entertainment-b': 900 } }))
    state.households.forEach((h) => { h.coordinate = { x: 0, y: 0 } })
    state.firms.find((f) => f.id === 'firm-entertainment-a')!.coordinate = { x: 1, y: 0 }
    const day = stepSimulation(state)
    expect(day.firms.filter((f) => f.industryId === 'entertainment').reduce((s, f) => s + f.unitsSoldToday, 0)).toBe(0)
    expect(day.households.every((h) => h.industryOutcomes.entertainment.purchaseOutcomeToday === 'insufficient_funds')).toBe(true)
  })

  it('uses proximity priority and fallback without double purchasing', () => {
    const state = createSimulation(config({ dailySupplyPerIndustry: 1, firmStartingPricesCents: { 'firm-entertainment-a': 100, 'firm-entertainment-b': 110 } }))
    const a = state.firms.find((f) => f.id === 'firm-entertainment-a')!; const b = state.firms.find((f) => f.id === 'firm-entertainment-b')!
    a.coordinate = { x: 0, y: 0 }; b.coordinate = { x: 19, y: 19 }
    state.households.forEach((h, i) => { h.coordinate = { x: Math.min(19, i + 1), y: 0 } })
    const day = stepSimulation(state)
    expect(day.events.filter((e) => e.type === 'HOUSEHOLD_PURCHASE' && e.industryId === 'entertainment')).toHaveLength(2)
    expect(day.households[0].entertainmentToday?.chosenFirmId).toBe('firm-entertainment-a')
    expect(day.households.every((h) => h.industryOutcomes.entertainment.lifetimeUnitsPurchased <= 1)).toBe(true)
  })

  it('taxes Transport and restores every household through explicit parity events', () => {
    const day = stepSimulation(createSimulation())
    const transport = day.firms.find((f) => f.industryId === 'transport')!
    expect(transport.revenueTodayCents).toBeGreaterThan(0)
    expect(day.events.find((e) => e.type === 'TAX_PAID' && e.firmId === transport.id)?.amountCents).toBe(transport.revenueTodayCents)
    expect(day.events.filter((e) => e.type === 'PARITY_TRANSFER_RECEIVED')).toHaveLength(10)
    expect(day.households.every((h) => h.cashCents === 5_000)).toBe(true)
    expect(day.government.cashCents).toBe(0)
    expect(day.firms.every((f) => f.cashCents === 0)).toBe(true)
    expect(totalMoney(day)).toBe(TOTAL_MONEY_CENTS)
  })

  it('preserves exact stock flows and bounded household Entertainment demand', () => {
    const day = stepSimulation(createSimulation(config({ dailySupplyPerIndustry: 8 })))
    day.firms.filter((f) => f.industryId !== 'transport').forEach((f) => expect(f.unitsSoldToday + f.unitsExpiredToday).toBe(8))
    expect(day.firms.filter((f) => f.industryId === 'entertainment').reduce((s, f) => s + f.unitsSoldToday, 0)).toBeLessThanOrEqual(10)
    expect(() => validateState(day, true)).not.toThrow()
  })

  it('is fully reproducible and keeps histories bounded', () => {
    const first = runDays(createSimulation(config({ seed: 77 })), 450)
    const second = runDays(createSimulation(config({ seed: 77 })), 450)
    expect(first).toEqual(second)
    expect(first.metrics).toHaveLength(400)
    expect(first.events.length).toBeLessThanOrEqual(600)
  }, 15_000)

  it('remains invariant-safe for 1,000 days and retains control benchmarks', () => {
    const state = runDays(createSimulation(config()), 1_000)
    for (const id of ['food', 'utilities', 'healthcare'] as const) {
      const firm = state.firms.find((f) => f.industryId === id)!
      expect(firm.pricing.incumbentPriceCents).toBe(state.industries.find((i) => i.id === id)!.householdBudgetCents)
    }
    expect(state.metrics.every((m) => m.totalMoneyCents === 50_000 && m.householdCashGini === 0)).toBe(true)
    expect(state.households.every((h) => h.cashCents === 5_000)).toBe(true)
  }, 20_000)
})
