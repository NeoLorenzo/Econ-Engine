import { describe, expect, it } from 'vitest'
import { createSimulation, runDays, stepSimulation } from './engine'
import { totalMoney, validateState } from './invariants'
import engineSource from './engine.ts?raw'
import employmentSource from './employment.ts?raw'

describe('[MVP5-Employment-007]', () => {
  it('assigns exactly one fixed seeded job per household with canonical slot counts', () => {
    const first = createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 77 })
    const again = createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 77 })
    const alternate = createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 78 })
    expect(first.households.map(({ employerFirmId }) => employerFirmId)).toEqual(again.households.map(({ employerFirmId }) => employerFirmId))
    expect(first.households.map(({ employerFirmId }) => employerFirmId)).not.toEqual(alternate.households.map(({ employerFirmId }) => employerFirmId))
    expect(new Set(first.firms.flatMap(({ employeeIds }) => employeeIds)).size).toBe(10)
    expect(first.firms.filter(({ industryId }) => industryId !== 'transport').every(({ employeeIds }) => employeeIds.length === 1)).toBe(true)
    expect(first.firms.find(({ industryId }) => industryId === 'transport')!.employeeIds).toHaveLength(2)
    expect(runDays(first, 20).households.map(({ employerFirmId }) => employerFirmId)).toEqual(first.households.map(({ employerFirmId }) => employerFirmId))
    expect(employmentSource).not.toContain('Math.random')
  })

  it('produces explicitly from labor, expires goods, and excludes Transport production', () => {
    const day = stepSimulation(createSimulation())
    day.firms.filter(({ industryId }) => industryId !== 'transport').forEach((firm) => { expect(firm.unitsProducedToday).toBe(5); expect(firm.unitsSoldToday + firm.unitsExpiredToday).toBe(5) })
    expect(day.firms.find(({ industryId }) => industryId === 'transport')!.unitsProducedToday).toBe(0)
    const productionEvents = day.events.filter(({ day: eventDay, type }) => eventDay === 1 && type === 'FIRM_PRODUCED')
    expect(productionEvents).toHaveLength(8)
    expect(Math.max(...productionEvents.map(({ id }) => id))).toBeLessThan(Math.min(...day.events.filter(({ day: eventDay, type }) => eventDay === 1 && type === 'HOUSEHOLD_PURCHASE').map(({ id }) => id)))
  })

  it('pays contractual wages, taxes residual profit, and preserves the learner signal', () => {
    const day = stepSimulation(createSimulation({ startingPriceCents: 101, initialStepCents: 100, seed: 9 }))
    day.firms.forEach((firm) => { expect(firm.cashCents).toBe(0); expect(firm.wagesPaidTodayCents).toBe(firm.wagePoolTodayCents) })
    expect(day.events.filter(({ day: eventDay, type }) => eventDay === 1 && type === 'WAGE_PAID')).toHaveLength(10)
    expect(day.firms.every((firm) => firm.wagesPaidTodayCents <= firm.contractualPayrollTodayCents && firm.corporateProfitTaxTodayCents === firm.residualProfitTodayCents)).toBe(true)
    expect(engineSource).toContain('decideTomorrowPrice')
  })

  it('keeps Government inactive, permits divergence, and conserves the closed circuit long-run', () => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 91, adaptiveGovernmentEnabled: false }), 1_000)
    expect(state.config.firmTaxRateBps).toBe(0); expect(state.config.householdParityEnabled).toBe(false)
    expect(state.events.some(({ type }) => type === 'TAX_PAID' || type === 'PARITY_TRANSFER_RECEIVED')).toBe(false)
    expect(state.households.every(({ cashCents }) => cashCents >= 0)).toBe(true)
    expect(state.households.every(({ cashCents }) => cashCents >= 0)).toBe(true)
    expect(state.firms.every(({ cashCents }) => cashCents === 0)).toBe(true)
    expect(state.government.cashCents).toBe(0); expect(totalMoney(state)).toBe(50_000)
    expect(() => validateState(state, true)).not.toThrow()
  }, 30_000)
})
