import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED, MAX_HISTORY, TOTAL_MONEY_CENTS } from './config'
import { createSimulation, runDays, stepSimulation } from './engine'
import { totalMoney, validateState } from './invariants'
import { runPopulationScale, runPopulationScaleComparison } from './populationScaleExperiment'

describe('[MVP8-Population_Scaling-010]', () => {
  it('creates the canonical 100-household employment and production scale', () => {
    const state = stepSimulation(createSimulation({ seed: 2_026_0813 }))
    expect(state.households).toHaveLength(100)
    expect(new Set(state.firms.flatMap(({ employeeIds }) => employeeIds))).toHaveProperty('size', 100)
    expect(state.firms.filter(({ industryId }) => industryId !== 'transport').every((firm) => firm.employeeIds.length === 10 && firm.unitsProducedToday === 50 && firm.contractualPayrollTodayCents === 10_000)).toBe(true)
    expect(state.firms.find(({ industryId }) => industryId === 'transport')).toMatchObject({ contractualPayrollTodayCents: 20_000 })
    expect(totalMoney(state)).toBe(TOTAL_MONEY_CENTS)
    expect(() => validateState(state, true)).not.toThrow()
  })

  it('supports proportionally equivalent N=10 and N=100 configurations reproducibly', () => {
    const first = runPopulationScaleComparison(2_026_0813, 30)
    const again = runPopulationScaleComparison(2_026_0813, 30)
    expect({ ...first, n10: { ...first.n10, terminalState: undefined }, n100: { ...first.n100, terminalState: undefined } }).toEqual({ ...again, n10: { ...again.n10, terminalState: undefined }, n100: { ...again.n100, terminalState: undefined } })
    expect(first.n10.totalMoneyCents).toBe(50_000); expect(first.n100.totalMoneyCents).toBe(500_000)
    expect(first.n10.firms.filter(({ firmId }) => firmId !== 'firm-transport').every(({ workers }) => workers === 1)).toBe(true)
    expect(first.n100.firms.filter(({ firmId }) => firmId !== 'firm-transport').every(({ workers }) => workers === 10)).toBe(true)
  }, 30_000)

  it('retains canonical closure over a long run', () => {
    const state = runDays(createSimulation({ seed: 123 }), 1_000)
    expect(totalMoney(state)).toBe(500_000); expect(state.firms.every(({ cashCents }) => cashCents === 0)).toBe(true); expect(state.government.cashCents).toBe(0)
  }, 30_000)

  it('reports transport revenue across the full horizon after history retention truncates', () => {
    const householdCount = 10
    const horizonDays = MAX_HISTORY + 25
    const seed = DEFAULT_SEED
    let state = createSimulation({ seed, householdCount })
    let fullHorizonTransportRevenueCents = 0

    for (let index = 0; index < horizonDays; index++) {
      state = stepSimulation(state)
      const metric = state.metrics.at(-1)!
      fullHorizonTransportRevenueCents += metric.totalTransportRevenueCents
    }

    const expectedFullHorizon = fullHorizonTransportRevenueCents / horizonDays / householdCount
    expect(state.metrics).toHaveLength(MAX_HISTORY)
    const retainedWindowValue = state.metrics.reduce(
      (sum, metric) => sum + metric.totalTransportRevenueCents,
      0,
    ) / state.metrics.length / householdCount
    expect(expectedFullHorizon).not.toBe(retainedWindowValue)

    const result = runPopulationScale(seed, householdCount, horizonDays)
    expect(result.terminalState.metrics).toHaveLength(MAX_HISTORY)
    expect(result.normalized.transportRevenuePerHouseholdCents).toBe(expectedFullHorizon)
  }, 30_000)
})
