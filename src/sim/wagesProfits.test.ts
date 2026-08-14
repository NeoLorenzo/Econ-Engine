import { describe, expect, it } from 'vitest'
import { createSimulation, runDays, stepSimulation } from './engine'
import { MAX_EVENTS, TOTAL_MONEY_CENTS } from './config'
import { totalMoney, validateState } from './invariants'
import { runWagesProfitsExperiment } from './wagesProfitsExperiment'

describe('[MVP7-Wages_Profits-009]', () => {
  it('settles fixed cash-constrained payroll, residual profit, tax, and one redistribution pool', () => {
    const state = stepSimulation(createSimulation({ seed: 91, startingPriceCents: 500 }))
    for (const firm of state.firms) {
      expect(firm.contractualWageCents).toBe(1_000)
      expect(firm.contractualPayrollTodayCents).toBe(firm.employeeIds.length * 1_000)
      expect(firm.wagesPaidTodayCents).toBeLessThanOrEqual(firm.contractualPayrollTodayCents)
      expect(firm.unpaidWagesTodayCents).toBe(firm.contractualPayrollTodayCents - firm.wagesPaidTodayCents)
      expect(firm.corporateProfitTaxTodayCents).toBe(firm.residualProfitTodayCents)
      expect(firm.cashCents).toBe(0)
    }
    expect(state.government.totalReceiptsTodayCents).toBe(state.government.corporateTaxCollectedTodayCents + state.government.wealthTaxCollectedTodayCents)
    expect(state.government.redistributedTodayCents).toBe(state.government.totalReceiptsTodayCents)
    expect(state.government.cashCents).toBe(0)
    expect(totalMoney(state)).toBe(TOTAL_MONEY_CENTS)
    expect(state.events.some(({ type, actorId, counterpartyId }) => type === 'CORPORATE_PROFIT_TAX_PAID' && actorId?.startsWith('firm-') && counterpartyId === 'government-1')).toBe(true)
  })

  it('allocates Transport payroll deterministically without exceeding either contract', () => {
    const first = stepSimulation(createSimulation({ seed: 123, transportCostPerTileCents: 1 }))
    const again = stepSimulation(createSimulation({ seed: 123, transportCostPerTileCents: 1 }))
    const transport = first.firms.find(({ industryId }) => industryId === 'transport')!
    expect(first.households.map(({ wageTodayCents }) => wageTodayCents)).toEqual(again.households.map(({ wageTodayCents }) => wageTodayCents))
    transport.employeeIds.forEach((id) => expect(first.households.find((household) => household.id === id)!.wageTodayCents).toBeLessThanOrEqual(1_000))
  })

  it('preserves exact closure for 10,000 days and bounded interactive history', () => {
    const state = runDays(createSimulation({ seed: 2_026_0813 }), 10_000)
    expect(totalMoney(state)).toBe(TOTAL_MONEY_CENTS)
    expect(state.firms.every(({ cashCents }) => cashCents === 0)).toBe(true)
    expect(state.government.cashCents).toBe(0)
    expect(state.households.every(({ cashCents }) => cashCents >= 0)).toBe(true)
    expect(state.metrics.length).toBeLessThanOrEqual(400)
    expect(state.events.length).toBeLessThanOrEqual(MAX_EVENTS)
    expect(() => validateState(state, true)).not.toThrow()
  }, 180_000)

  it('reproduces complete 1,000-day wage/profit trajectory analytics', () => {
    const first = runWagesProfitsExperiment(2_026_0813, 1_000)
    const again = runWagesProfitsExperiment(2_026_0813, 1_000)
    expect({ ...first, terminalState: undefined }).toEqual({ ...again, terminalState: undefined })
    expect(first.contractualPayrollCents).toBe(first.wagesPaidCents + first.unpaidWagesCents)
    expect(first.corporateTaxCents + first.wealthTaxCents).toBe(first.redistributionCents)
    expect(first.firms).toHaveLength(9)
  }, 30_000)
})
