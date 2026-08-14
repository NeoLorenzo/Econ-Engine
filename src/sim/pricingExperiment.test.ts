import { describe, expect, it } from 'vitest'
import { createSimulation, runDays } from './engine'
import { buildPriceExperimentCatalog, createPricingState, decideTomorrowPrice } from './pricingStrategy'
import pricingSource from './pricingStrategy.ts?raw'

describe('MVP4 006.1 price experiment catalogs', () => {
  it('builds the required incumbent-anchored catalog with integer rounding', () => {
    expect(buildPriceExperimentCatalog(333).map(({ priceCents, type }) => [type, priceCents])).toEqual([
      ['local_up_1c', 334], ['local_down_1c', 332], ['local_up_5pct', 350], ['local_down_5pct', 316],
      ['local_up_10pct', 366], ['local_down_10pct', 300], ['local_down_20pct', 266],
    ])
  })

  it('adds public competitor match, adjacent, and percentage candidates', () => {
    const catalog = buildPriceExperimentCatalog(500, 420)
    expect(catalog).toEqual(expect.arrayContaining([
      { type: 'competitor_match', priceCents: 420, competitorPriceObservedCents: 420 },
      { type: 'competitor_up_1c', priceCents: 421, competitorPriceObservedCents: 420 },
      { type: 'competitor_down_1c', priceCents: 419, competitorPriceObservedCents: 420 },
      { type: 'competitor_up_5pct', priceCents: 441, competitorPriceObservedCents: 420 },
      { type: 'competitor_down_5pct', priceCents: 399, competitorPriceObservedCents: 420 },
    ]))
  })

  it('deduplicates rounded prices, excludes the incumbent, and respects one cent', () => {
    const catalog = buildPriceExperimentCatalog(1, 1)
    expect(new Set(catalog.map(({ priceCents }) => priceCents)).size).toBe(catalog.length)
    expect(catalog.every(({ priceCents }) => priceCents >= 1 && priceCents !== 1)).toBe(true)
  })

  it('gives monopoly catalogs no fabricated competitor category', () => {
    expect(buildPriceExperimentCatalog(500).every(({ type, competitorPriceObservedCents }) => !type.startsWith('competitor_') && competitorPriceObservedCents === null)).toBe(true)
  })

  it('masks every price deduction after a full-stock sellout while retaining upward experiments', () => {
    const catalog = buildPriceExperimentCatalog(500, 420, true)
    expect(catalog.every(({ priceCents }) => priceCents > 500)).toBe(true)
    expect(catalog.map(({ type }) => type)).toEqual(expect.arrayContaining(['local_up_1c', 'local_up_5pct', 'local_up_10pct']))
    expect(catalog.some(({ type }) => type.startsWith('competitor_'))).toBe(false)
  })

  it('continues allowing price deductions when the firm did not sell out', () => {
    const catalog = buildPriceExperimentCatalog(500, 420, false)
    expect(catalog.some(({ priceCents }) => priceCents < 500)).toBe(true)
    expect(catalog.some(({ type }) => type === 'competitor_match')).toBe(true)
  })

  it('refreshes a settled incumbent reference before beginning an experiment', () => {
    const settled = { ...createPricingState(500, 100), converged: true, locallySettled: true, incumbentPriceCents: 500, incumbentProfitCents: 9_999 }
    const candidate = { type: 'local_down_20pct' as const, priceCents: 400, competitorPriceObservedCents: null }
    const started = decideTomorrowPrice(settled, 500, 4, 2_000, { shouldProbe: true, direction: 'down', candidate })
    expect(started.state.incumbentProfitCents).toBe(2_000)
    const adopted = decideTomorrowPrice(started.state, 400, 6, 2_400)
    expect(adopted).toMatchObject({ action: 'probe_adopted', nextPriceCents: 400 })
  })

  it('strictly rejects an unprofitable experiment and restores the incumbent', () => {
    const settled = { ...createPricingState(500, 100), converged: true, locallySettled: true, incumbentPriceCents: 500, incumbentProfitCents: 2_000 }
    const started = decideTomorrowPrice(settled, 500, 4, 2_000, { shouldProbe: true, direction: 'up', candidate: { type: 'local_up_10pct', priceCents: 550, competitorPriceObservedCents: null } })
    expect(decideTomorrowPrice(started.state, 550, 3, 1_650)).toMatchObject({ action: 'probe_rejected', nextPriceCents: 500 })
  })

  it('selects reproducible seeded experiment sequences and permits alternate sequences', () => {
    const events = (seed: number) => runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed, probeProbability: 1 }), 120).events
      .filter(({ type }) => type === 'PRICE_EXPERIMENT_STARTED').map(({ firmId, experimentalPriceCents, experimentType }) => [firmId, experimentalPriceCents, experimentType])
    expect(events(31)).toEqual(events(31))
    expect(events(31)).not.toEqual(events(32))
    expect(new Set(events(31).map((event) => event[2])).size).toBeGreaterThan(2)
  }, 15_000)

  it('exposes only competitor advertised price to the strategy boundary', () => {
    expect(pricingSource).not.toMatch(/competitorProfit|competitorSales|marketShare|coordinate|household/)
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed: 18, probeProbability: 1 }), 100)
    const competitive = state.events.filter(({ type, industryId }) => type === 'PRICE_EXPERIMENT_STARTED' && industryId === 'entertainment')
    const monopoly = state.events.filter(({ type, industryId }) => type === 'PRICE_EXPERIMENT_STARTED' && industryId === 'food')
    expect(competitive.some(({ competitorPriceObservedCents }) => competitorPriceObservedCents !== undefined)).toBe(true)
    expect(monopoly.every(({ competitorPriceObservedCents, experimentType }) => competitorPriceObservedCents === undefined && !experimentType?.startsWith('competitor_'))).toBe(true)
  })
})
