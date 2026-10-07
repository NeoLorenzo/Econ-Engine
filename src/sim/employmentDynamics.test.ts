import { describe, expect, it } from 'vitest'
import { createSimulation, stepSimulation } from './engine'
import { analyzeEmploymentDynamics, CASH_BINS, cashBinIndex, collectEmploymentObservations, concentrationShare, fractionalRanks, runEmploymentDynamics, spellSummary, summarizeSeries, type EmploymentDayObservation } from './employmentDynamics'
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
    expect(Object.values(report.economy.failureTotals).reduce((sum, value) => sum + value, 0) + report.households.reduce((sum, household) => sum + household.successfulPurchases, 0)).toBe(20 * 100 * 4)
    report.firms.forEach((firm) => expect(firm.cumulativeOperatingEarningsCents).toBeGreaterThanOrEqual(firm.cumulativeWagesCents))
    const transport = report.firms.find(({ industryId }) => industryId === 'transport')!
    expect(report.households.filter(({ employerFirmId }) => employerFirmId === transport.firmId).reduce((sum, household) => sum + household.cumulativeWagesCents, 0)).toBe(transport.cumulativeWagesCents)
    report.firms.filter(({ industryId }) => industryId !== 'transport').forEach((firm) => expect(report.households.filter(({ householdId }) => firm.workerIds.includes(householdId)).reduce((sum, household) => sum + household.cumulativeWagesCents, 0)).toBe(firm.cumulativeWagesCents))
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

  it('reproduces exact 1,000-day reports for the same seed', () => expect(runEmploymentDynamics(77, 1_000)).toEqual(runEmploymentDynamics(77, 1_000)), 60_000)

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

type Outcome = EmploymentDayObservation['households'][number]['outcomes']['food']
const syntheticDay = (day: number, households: Array<{ opening: number; end: number; purchased?: number }>): EmploymentDayObservation => ({
  day,
  households: households.map(({ opening, end, purchased = 4 }, index) => {
    const outcome = (slot: number): Outcome => (slot < purchased ? 'purchased' : 'cash')
    return { householdId: `h${index}`, employerFirmId: `f${index}`, openingCashCents: opening, endCashCents: end, wageCents: 0, spendingCents: 0, netCashChangeCents: 0, outcomes: { food: outcome(0), utilities: outcome(1), healthcare: outcome(2), entertainment: outcome(3) } }
  }),
  firms: households.map((_, index) => ({ firmId: `f${index}`, industryId: 'food' as const, employeeIds: [`h${index}`], produced: 0, sold: 0, expired: 0, operatingEarningsCents: 0, wagesCents: 0 })),
})
const flat = (day: number, cash: number[]) => syntheticDay(day, cash.map((value) => ({ opening: value, end: value })))

describe('[MVP8] prior-cash bins partition every household-day (#14)', () => {
  it('assigns each boundary to exactly one half-open bin', () => {
    const cases: Array<[number, string]> = [[-1, '<$1'], [0, '<$1'], [99, '<$1'], [100, '$1–$4.99'], [499, '$1–$4.99'], [500, '$5–$9.99'], [999, '$5–$9.99'], [1_000, '$10–$24.99'], [2_499, '$10–$24.99'], [2_500, '$25–$49.99'], [4_999, '$25–$49.99'], [5_000, '$50+'], [1_000_000, '$50+']]
    for (const [cents, label] of cases) {
      expect(CASH_BINS[cashBinIndex(cents)]?.label).toBe(label)
      expect(CASH_BINS.filter(({ min, max }) => cents >= min && cents < max)).toHaveLength(1)
    }
  })

  it('counts every observation once and averages completion within each bin', () => {
    const report = analyzeEmploymentDynamics(1, [
      syntheticDay(1, [{ opening: 99, end: 0, purchased: 0 }, { opening: 100, end: 0, purchased: 1 }, { opening: 500, end: 0, purchased: 2 }, { opening: 1_000, end: 0, purchased: 3 }, { opening: 2_500, end: 0, purchased: 4 }, { opening: 5_000, end: 0, purchased: 4 }]),
      syntheticDay(2, [{ opening: 4_999, end: 0, purchased: 2 }, { opening: 5_000, end: 0, purchased: 2 }, { opening: 0, end: 0, purchased: 4 }, { opening: 2_499, end: 0, purchased: 1 }, { opening: 999, end: 0, purchased: 0 }, { opening: 499, end: 0, purchased: 3 }]),
    ])
    expect(report.cashBins.reduce((sum, { observations }) => sum + observations, 0)).toBe(2 * 6)
    expect(report.cashBins.map(({ label, observations, meanNextDayCompletion }) => [label, observations, meanNextDayCompletion])).toEqual([
      ['<$1', 2, .5], ['$1–$4.99', 2, .5], ['$5–$9.99', 2, .25], ['$10–$24.99', 2, .5], ['$25–$49.99', 2, .75], ['$50+', 2, .75],
    ])
  })

  it("includes the canonical economy's 100 opening $50 observations on day 1", () => {
    const { observations } = collectEmploymentObservations(createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 44 }), 1)
    expect(observations[0].households.every(({ openingCashCents }) => openingCashCents === 5_000)).toBe(true)
    const report = analyzeEmploymentDynamics(44, observations)
    expect(report.cashBins.find(({ label }) => label === '$50+')?.observations).toBe(100)
    expect(report.cashBins.reduce((sum, { observations: count }) => sum + count, 0)).toBe(100)
  })
})

describe('[MVP8] richest and poorest day counts under ties (#15)', () => {
  const days = (report: ReturnType<typeof analyzeEmploymentDynamics>) => Object.fromEntries(report.households.map(({ householdId, richestDays, poorestDays }) => [householdId, [richestDays, poorestDays]]))

  it('counts every household tied for the highest balance as richest', () => {
    expect(days(analyzeEmploymentDynamics(1, [flat(1, [100, 100, 20, 0])]))).toEqual({ h0: [1, 0], h1: [1, 0], h2: [0, 0], h3: [0, 1] })
  })

  it("compares each day with that day's lowest balance when tie groups change", () => {
    const report = analyzeEmploymentDynamics(1, [flat(1, [100, 80, 0, 0]), flat(2, [100, 80, 20, 0]), flat(3, [50, 50, 50, 50])])
    expect(days(report)).toEqual({ h0: [3, 1], h1: [1, 1], h2: [1, 2], h3: [1, 3] })
  })

  it('keeps fractional ranks for mean-rank analysis', () => {
    const report = analyzeEmploymentDynamics(1, [flat(1, [100, 100, 20, 0])])
    expect(report.households.map(({ meanWealthRank }) => meanWealthRank)).toEqual([1.5, 1.5, 3, 4])
  })
})
