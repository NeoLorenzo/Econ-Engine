import { describe, expect, it } from 'vitest'
import { createSimulation, stepSimulation } from './engine'
import { analyzeEmploymentDynamics, collectEmploymentObservations, concentrationShare, fractionalRanks, runEmploymentDynamics, spellSummary, summarizeSeries, type EmploymentDayObservation } from './employmentDynamics'
import { giniCoefficient } from './analytics'

describe('[MVP5-Employment-007.1] pure trajectory primitives', () => {
  it('calculates cash/wage Gini, concentration, and tied concentration without order assumptions', () => {
    expect(giniCoefficient([0, 100])).toBe(.5)
    expect(giniCoefficient([0, 0])).toBe(0)
    expect(concentrationShare([40, 30, 20, 10], 1)).toBe(.4)
    expect(concentrationShare([40, 30, 20, 10], 2)).toBe(.7)
    expect(concentrationShare([40, 30, 20, 10], 3)).toBe(.9)
    expect(concentrationShare([25, 25, 25, 25], 2)).toBe(.5)
    expect(summarizeSeries([.2, .4, .6])).toMatchObject({ minimum: .2, maximum: .6 })
    expect(summarizeSeries([.2, .4, .6]).mean).toBeCloseTo(.4)
  })

  it('uses fractional analytical ranks for exact ties', () => {
    expect(fractionalRanks([100, 100, 50, 0])).toEqual([1.5, 1.5, 3, 4])
    expect(fractionalRanks([0, 50, 100, 100])).toEqual([4, 3, 1.5, 1.5])
  })

  it('measures strict low-cash occupancy and contiguous spells at threshold boundaries', () => {
    expect(spellSummary([true, true, false, true, false])).toEqual({ days: 3, fraction: .6, spells: 2, meanSpellDays: 1.5, longestSpellDays: 2 })
    expect([99, 100, 499, 500, 999, 1000].map((cash) => cash < 100)).toEqual([true, false, false, false, false, false])
    expect([99, 100, 499, 500, 999, 1000].map((cash) => cash < 500)).toEqual([true, true, true, false, false, false])
    expect([99, 100, 499, 500, 999, 1000].map((cash) => cash < 1000)).toEqual([true, true, true, true, true, false])
  })
})

describe('[MVP5-Employment-007.1] report isolation and accounting', () => {
  it('collects all requested days, classifies failures separately, and reconciles payroll', () => {
    const report = runEmploymentDynamics(91, 20)
    expect(report.observations).toHaveLength(20)
    expect(report.observations[0].day).toBe(1); expect(report.observations.at(-1)?.day).toBe(20)
    expect(Object.values(report.economy.failureTotals).reduce((sum, value) => sum + value, 0) + report.households.reduce((sum, household) => sum + household.successfulPurchases, 0)).toBe(20 * 10 * 4)
    report.firms.forEach((firm) => expect(firm.cumulativeOperatingEarningsCents).toBeGreaterThanOrEqual(firm.cumulativeWagesCents))
    const transport = report.firms.find(({ industryId }) => industryId === 'transport')!
    expect(report.households.filter(({ employerFirmId }) => employerFirmId === transport.firmId).reduce((sum, household) => sum + household.cumulativeWagesCents, 0)).toBe(transport.cumulativeWagesCents)
    report.firms.filter(({ industryId }) => industryId !== 'transport').forEach((firm) => expect(report.households.find(({ householdId }) => householdId === firm.workerIds[0])!.cumulativeWagesCents).toBe(firm.cumulativeWagesCents))
  })

  it('consumes no RNG, mutates no state, and cannot alter continuation', () => {
    const initial = createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 44 })
    const snapshot = JSON.stringify(initial); const rng = initial.rngState
    const collected = collectEmploymentObservations(initial, 12)
    const beforeAnalysis = JSON.stringify(collected.observations)
    analyzeEmploymentDynamics(44, collected.observations)
    expect(initial.rngState).toBe(rng); expect(JSON.stringify(initial)).toBe(snapshot); expect(JSON.stringify(collected.observations)).toBe(beforeAnalysis)
    expect(stepSimulation(collected.state)).toEqual(stepSimulation(collectEmploymentObservations(initial, 12).state))
  })

  it('reproduces exact 1,000-day reports for the same seed', () => expect(runEmploymentDynamics(77, 1_000)).toEqual(runEmploymentDynamics(77, 1_000)))

  it('does not classify a terminal rank or balance as the whole trajectory', () => {
    const households = (cash: number[], day: number) => cash.map((endCashCents, index) => ({ householdId: `h${index}`, employerFirmId: `f${index}`, openingCashCents: endCashCents, endCashCents, wageCents: 0, spendingCents: 0, netCashChangeCents: 0, outcomes: { food: 'purchased', utilities: 'purchased', healthcare: 'purchased', entertainment: 'purchased' } as const }))
    const firms = (day: number) => [0, 1, 2, 3].map((index) => ({ firmId: `f${index}`, industryId: 'food' as const, employeeIds: [`h${index}`], produced: 0, sold: 0, expired: 0, operatingEarningsCents: 0, wagesCents: 0 }))
    const observations: EmploymentDayObservation[] = [[100, 80, 20, 0], [0, 80, 20, 100], [0, 80, 20, 100]].map((cash, index) => ({ day: index + 1, households: households(cash, index + 1), firms: firms(index + 1) }))
    const report = analyzeEmploymentDynamics(1, observations)
    const terminalRichest = report.households.find(({ householdId }) => householdId === 'h3')!
    expect(terminalRichest.terminalCashCents).toBe(100); expect(terminalRichest.richestDays).toBe(2)
    expect(terminalRichest.lowCash[100].fraction).toBe(1 / 3)
  })
})
