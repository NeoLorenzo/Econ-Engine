import { describe, expect, it } from 'vitest'
import { createSimulation, runDays, stepSimulation } from './engine'
import { buildGovernmentExperimentCatalog, collectWealthTax, compareGovernmentPolicies, redistributeByWaterFilling, taxForWealth } from './government'
import { totalMoney, validateState } from './invariants'
import governmentSource from './government.ts?raw'

const synthetic = (cash: number[]) => {
  const state = createSimulation({ adaptiveGovernmentEnabled: false })
  state.households.forEach((household, index) => { household.cashCents = cash[index] ?? 0; household.preTaxCashCents = household.cashCents; household.postFiscalCashCents = household.cashCents })
  return state
}

describe('[MVP6-Government-008] wealth tax and redistribution', () => {
  it('collects zero at 0%, all cash at 100%, and floors deterministic fractional cents', () => {
    expect(taxForWealth(101, 0)).toBe(0); expect(taxForWealth(101, 10_000)).toBe(101); expect(taxForWealth(101, 5_000)).toBe(50)
    const state = synthetic([101, 200, 300, 400, 500, 600, 700, 800, 900, 1_000])
    const before = totalMoney(state); collectWealthTax(state.households, state.government, 10_000)
    expect(state.households.every(({ cashCents }) => cashCents === 0)).toBe(true)
    expect(state.government.cashCents).toBe(5_501); expect(totalMoney(state)).toBe(before)
  })

  it('applies one flat statutory rate and never taxes beyond cash', () => {
    const state = synthetic([101, 201, 301, 401, 501, 601, 701, 801, 901, 1_001])
    collectWealthTax(state.households, state.government, 2_500)
    expect(state.households.map(({ taxPaidTodayCents }) => taxPaidTodayCents)).toEqual([25, 50, 75, 100, 125, 150, 175, 200, 225, 250])
    expect(state.households.every((h) => h.taxPaidTodayCents <= h.preTaxCashCents)).toBe(true)
  })

  it('water-fills poorest tiers and conserves partial/remainder cents reproducibly', () => {
    const run = () => { const state = synthetic([100, 300, 600, 2_000, 2_000, 2_000, 2_000, 2_000, 2_000, 2_000]); state.government.cashCents = 801; const result = redistributeByWaterFilling(state.households, state.government, 77); return { cash: state.households.map(({ cashCents }) => cashCents), transfers: [...result.transfers.values()], government: state.government } }
    const first = run(), again = run()
    expect([...first.cash.slice(0, 3)].sort((a, b) => a - b)).toEqual([600, 600, 601]); expect(first.transfers.reduce((a, b) => a + b, 0)).toBe(801)
    expect(first.government.cashCents).toBe(0); expect(first).toEqual(again)
  })

  it('100% taxation reaches ordinary exact equality without a hidden reset', () => {
    const state = synthetic([1, 3, 6, 20, 30, 40, 50, 60, 90, 200])
    collectWealthTax(state.households, state.government, 10_000); redistributeByWaterFilling(state.households, state.government, 1)
    expect(new Set(state.households.map(({ cashCents }) => cashCents))).toEqual(new Set([50]))
    expect(state.government.taxCollectedTodayCents).toBe(500); expect(state.government.redistributedTodayCents).toBe(500)
  })
})

describe('[MVP6-Government-008] bounded policy learner', () => {
  it('starts at 0% and supplies deduplicated bounded local pp moves plus anchors', () => {
    const state = createSimulation(); expect(state.government.incumbentWealthTaxRateBps).toBe(0)
    const catalog = buildGovernmentExperimentCatalog(5_000)
    expect(catalog.map(({ rateBps }) => rateBps)).toEqual(expect.arrayContaining([4_900, 5_100, 4_500, 5_500, 4_000, 6_000, 3_000, 7_000, 0, 2_500, 7_500, 10_000]))
    expect(new Set(catalog.map(({ rateBps }) => rateBps)).size).toBe(catalog.length)
    expect(catalog.every(({ rateBps }) => rateBps >= 0 && rateBps <= 10_000 && rateBps !== 5_000)).toBe(true)
  })

  it('uses lower Gini first and lower tax only within documented equality tolerance', () => {
    expect(compareGovernmentPolicies(.1, 5_000, .2, 0)).toBe(true)
    expect(compareGovernmentPolicies(.2, 5_000, .1, 0)).toBe(false)
    expect(compareGovernmentPolicies(.2, 2_500, .2, 5_000)).toBe(true)
    expect(compareGovernmentPolicies(.2, 7_500, .2, 5_000)).toBe(false)
  })

  it('selects an exact same-seed experiment history and allows different valid histories', () => {
    const sequence = (seed: number) => runDays(createSimulation({ seed, governmentExperimentProbability: 1 }), 30).events.filter(({ type }) => type === 'GOVERNMENT_POLICY_EXPERIMENT_STARTED').map(({ taxRateBps, governmentExperimentType }) => [taxRateBps, governmentExperimentType])
    expect(sequence(77)).toEqual(sequence(77)); expect(sequence(77)).not.toEqual(sequence(78)); expect(governmentSource).not.toContain('Math.random')
  })

  it('adopts improvements, rejects worse policies, refreshes references, and keeps experimenting', () => {
    const state = runDays(createSimulation({ seed: 91, governmentExperimentProbability: 1 }), 20)
    const outcomes = state.events.filter(({ type }) => type.startsWith('GOVERNMENT_POLICY_EXPERIMENT_'))
    expect(outcomes.some(({ type }) => type.endsWith('REJECTED'))).toBe(true)
    expect(outcomes.filter(({ type }) => type.endsWith('STARTED')).length).toBeGreaterThan(0)
    expect(state.government.incumbentReferenceGini).not.toBeNull()
  })
})

describe('[MVP6-Government-008] lifecycle accounting and observation', () => {
  it('captures pre-fiscal Gini before explicit taxes and post-fiscal Gini after transfers', () => {
    const day = stepSimulation(createSimulation({ governmentExperimentProbability: 0 }))
    expect(day.metrics[0].preFiscalCashGini).toBeGreaterThan(0); expect(day.metrics[0].postFiscalCashGini).toBe(day.metrics[0].preFiscalCashGini)
    expect(day.metrics[0].giniReduction).toBe(0)
    const taxed = runDays(createSimulation({ governmentExperimentProbability: 1 }), 2)
    expect(taxed.events.some(({ type }) => type === 'WEALTH_TAX_PAID')).toBe(true); expect(taxed.events.some(({ type }) => type === 'MEANS_TESTED_TRANSFER_PAID')).toBe(true)
  })

  it('reconciles every fiscal stock and flow over 1,000 days', () => {
    const state = runDays(createSimulation({ seed: 123 }), 1_000), metric = state.metrics.at(-1)!
    expect(state.government.cashCents).toBe(0); expect(state.firms.every(({ cashCents }) => cashCents === 0)).toBe(true)
    expect(state.households.reduce((sum, h) => sum + h.cashCents, 0)).toBe(50_000); expect(totalMoney(state)).toBe(50_000)
    expect(metric.totalWealthTaxCollectedCents).toBe(metric.totalMeansTestedTransfersCents); expect(() => validateState(state, true)).not.toThrow()
  }, 30_000)
})
