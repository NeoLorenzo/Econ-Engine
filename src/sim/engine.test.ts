import { describe, expect, it } from 'vitest'
import { DEFAULT_INDUSTRY_BUDGET_SHARES_BPS, MAX_EVENTS, MAX_HISTORY, deriveIndustryBudgetCents } from './config'
import { createSimulation, runDays, stepSimulation } from './engine'
import { totalMoney, validateState } from './invariants'
import type { IndustryId } from './types'
import { manhattanDistance, transportQuote } from './spatial'

const consumerIds = ['food', 'utilities', 'healthcare', 'entertainment'] as const
const base = { startingPriceCents: 100, initialStepCents: 100, dailySupplyPerIndustry: 10, seed: 20260813 }

describe('MVP4 full spatial competition', () => {
  it('creates two firms in every consumer industry and one derived Transport monopoly', () => {
    const state = createSimulation(base)
    expect(state.firms).toHaveLength(9)
    consumerIds.forEach((id) => expect(state.firms.filter((firm) => firm.industryId === id).map(({ id }) => id)).toEqual([`firm-${id}-a`, `firm-${id}-b`]))
    expect(state.firms.filter(({ industryId }) => industryId === 'transport')).toHaveLength(1)
  })

  it('uses integer basis-point shares and deterministic half-up cent rounding', () => {
    const state = createSimulation(base)
    expect(state.config.industryBudgetSharesBps).toEqual(DEFAULT_INDUSTRY_BUDGET_SHARES_BPS)
    expect(Object.values(DEFAULT_INDUSTRY_BUDGET_SHARES_BPS).reduce((sum, value) => sum + value, 0)).toBe(3_140)
    expect(deriveIndustryBudgetCents(5_000, 1_290)).toBe(645)
    expect(deriveIndustryBudgetCents(5_000, 600)).toBe(300)
    expect(deriveIndustryBudgetCents(5_000, 790)).toBe(395)
    expect(deriveIndustryBudgetCents(5_000, 460)).toBe(230)
    expect(state.industries.find(({ id }) => id === 'transport')?.budgetShareBps).toBeUndefined()
  })

  it('places 100 households and eight consumer firms on unique in-bounds cells', () => {
    const state = createSimulation(base)
    const entities = [...state.households, ...state.firms.filter(({ industryId }) => industryId !== 'transport')]
    expect(entities).toHaveLength(108)
    expect(new Set(entities.map(({ coordinate }) => `${coordinate!.x},${coordinate!.y}`)).size).toBe(108)
    expect(entities.every(({ coordinate }) => coordinate!.x >= 0 && coordinate!.x < 20 && coordinate!.y >= 0 && coordinate!.y < 20)).toBe(true)
    expect(state.firms.find(({ industryId }) => industryId === 'transport')?.coordinate).toBeUndefined()
  })

  it('routes every consumer purchase product payment and travel payment separately', () => {
    const day = stepSimulation(createSimulation(base))
    expect(day.events.filter(({ type }) => type === 'HOUSEHOLD_PURCHASE').length).toBe(400)
    expect(day.events.filter(({ type }) => type === 'TRANSPORT_SERVICE_PURCHASED').length).toBe(400)
    expect(day.households.every((household) => consumerIds.every((id) => household.industryOutcomes[id].purchasedToday))).toBe(true)
    expect(day.households.every((household) => household.industryOutcomes.transport.purchaseOutcomeToday === null)).toBe(true)
    expect(day.metrics[0].entertainmentTrips).toBe(400)
    expect(Object.keys(day.metrics[0].transportRevenueByIndustryCents).sort()).toEqual([...consumerIds].sort())
  })

  it.each(consumerIds)('uses delivered cost and derived affordability in %s', (industryId) => {
    const state = createSimulation(base)
    const firms = state.firms.filter((firm) => firm.industryId === industryId)
    const household = state.households.find((candidate) => manhattanDistance(candidate.coordinate, firms[0].coordinate!) !== manhattanDistance(candidate.coordinate, firms[1].coordinate!))!
    const [closer, farther] = [...firms].sort((left, right) => manhattanDistance(household.coordinate, left.coordinate!) - manhattanDistance(household.coordinate, right.coordinate!))
    closer.postedPriceCents = 101; farther.postedPriceCents = 100
    const day = stepSimulation(state)
    expect(day.households.find(({ id }) => id === household.id)!.spatialPurchasesToday[industryId]?.chosenFirmId).toBe(closer.id)
  })

  it('excludes a household when sticker price fits but every delivered food cost exceeds its opening limits', () => {
    const state = createSimulation({ ...base, transportCostPerTileCents: 100 })
    const industryId = 'food'
    const firms = state.firms.filter((firm) => firm.industryId === industryId)
    const household = state.households[0]
    const postedPriceCents = 100
    firms.forEach((firm) => { firm.postedPriceCents = postedPriceCents })
    const cheapestDeliveredCostCents = Math.min(...firms.map((firm) => postedPriceCents + transportQuote(household.coordinate, firm.coordinate!, state.config.transportCostPerTileCents!).transportFeeCents))
    const openingLimitCents = cheapestDeliveredCostCents - 1
    state.households.forEach((candidate) => {
      candidate.cashCents = 0
      candidate.industryOutcomes[industryId].budgetCents = 0
    })
    household.cashCents = openingLimitCents
    household.industryOutcomes[industryId].budgetCents = openingLimitCents
    state.households.find((candidate) => candidate.id !== household.id)!.cashCents = 500_000 - openingLimitCents

    const day = stepSimulation(state)
    const affordable = day.metrics[0].markets.filter((metric) => metric.industryId === industryId).map((metric) => metric.householdsAffordableAtMarketOpen)

    expect(postedPriceCents).toBeLessThanOrEqual(openingLimitCents)
    expect(cheapestDeliveredCostCents).toBeGreaterThan(openingLimitCents)
    expect(affordable).toEqual([0, 0])
  })

  it('counts a household once when exactly one of two different delivered food costs fits its opening cash and budget', () => {
    const state = createSimulation({ ...base, transportCostPerTileCents: 100 })
    const industryId = 'food'
    const firms = state.firms.filter((firm) => firm.industryId === industryId)
    const household = state.households.find((candidate) => {
      const fees = firms.map((firm) => transportQuote(candidate.coordinate, firm.coordinate!, state.config.transportCostPerTileCents!).transportFeeCents)
      return fees[0] !== fees[1]
    })!
    firms.forEach((firm) => { firm.postedPriceCents = 100 })
    const deliveredCosts = firms.map((firm) => firm.postedPriceCents + transportQuote(household.coordinate, firm.coordinate!, state.config.transportCostPerTileCents!).transportFeeCents)
    const openingLimitCents = Math.min(...deliveredCosts)
    state.households.forEach((candidate) => {
      candidate.cashCents = 0
      candidate.industryOutcomes[industryId].budgetCents = 0
    })
    household.cashCents = openingLimitCents
    household.industryOutcomes[industryId].budgetCents = openingLimitCents
    state.households.find((candidate) => candidate.id !== household.id)!.cashCents = 500_000 - openingLimitCents

    const day = stepSimulation(state)
    const affordable = day.metrics[0].markets.filter((metric) => metric.industryId === industryId).map((metric) => metric.householdsAffordableAtMarketOpen)

    expect(new Set(deliveredCosts).size).toBe(2)
    expect(deliveredCosts.filter((cost) => cost <= openingLimitCents)).toHaveLength(1)
    expect(affordable).toEqual([1, 1])
  })

  it('keeps category boundaries behavioral and leaves unused cash in the single persistent household balance', () => {
    const day = stepSimulation(createSimulation(base))
    expect(day.households.reduce((sum, { cashCents }) => sum + cashCents, 0)).toBe(500_000)
    expect(day.households.every((household) => !('wallets' in household))).toBe(true)
    expect(day.events.filter(({ type }) => type === 'PARITY_TRANSFER_RECEIVED')).toHaveLength(0)
  })

  it('preserves payroll, money, and production stock flows', () => {
    const day = stepSimulation(createSimulation(base))
    expect(day.firms.every(({ cashCents }) => cashCents === 0)).toBe(true)
    expect(day.government.cashCents).toBe(0)
    expect(new Set(day.households.map(({ cashCents }) => cashCents)).size).toBeGreaterThan(1)
    expect(totalMoney(day)).toBe(500_000)
    day.firms.filter(({ industryId }) => industryId !== 'transport').forEach((firm) => expect(firm.unitsSoldToday + firm.unitsExpiredToday).toBe(50))
    expect(() => validateState(day, true)).not.toThrow()
  })

  it('reproduces full runs, bounds histories, and remains invariant-safe for 1,000 days', () => {
    const first = runDays(createSimulation({ ...base, seed: 77 }), 1_000)
    const second = runDays(createSimulation({ ...base, seed: 77 }), 1_000)
    expect(first).toEqual(second)
    expect(first.metrics).toHaveLength(MAX_HISTORY)
    expect(first.events.length).toBeLessThanOrEqual(MAX_EVENTS)
    expect(first.metrics.every(({ totalMoneyCents }) => totalMoneyCents === 500_000)).toBe(true)
  }, 30_000)
})
