import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED, employmentBlockSize } from '../sim/config'
import { createSimulation, stepSimulation } from '../sim/engine'
import {
  buildHighlights,
  completionRate,
  CONSUMER_INDUSTRIES,
  dailyFlows,
  firmChartSeries,
  firmSeries,
  firmStatus,
  historyNote,
  householdCashSteps,
  industrySnapshot,
} from './economyModel'
import { firmName, firmShortName, money } from './format'
import { buildMarketTerritory, buildWorldEntities, householdWealthHeight } from './worldViewModel'

const run = (days: number) => {
  let state = createSimulation({ seed: DEFAULT_SEED })
  for (let day = 0; day < days; day++) state = stepSimulation(state)
  return state
}

describe('observer economy model', () => {
  const state = run(60)
  const latest = state.metrics.at(-1)!

  it('reports completion as consumer units sold over one desired purchase per household per industry', () => {
    const sold = latest.markets
      .filter(({ industryId }) => industryId !== 'transport')
      .reduce((sum, market) => sum + market.unitsSold, 0)
    expect(completionRate(latest, state.households.length)).toBeCloseTo(sold / (state.households.length * 4))
    expect(completionRate(undefined, 100)).toBe(0)
  })

  it('balances the daily money circuit: firms and Government both end the day with nothing left over', () => {
    const flows = dailyFlows(latest)
    expect(flows.spendingCents).toBe(latest.totalRevenueCents)
    expect(flows.wagesCents + flows.corporateTaxCents).toBe(flows.spendingCents)
    expect(flows.corporateTaxCents + flows.wealthTaxCents).toBe(flows.transfersCents)
  })

  it('builds a two-firm snapshot for every consumer industry, Firm A first', () => {
    for (const industryId of CONSUMER_INDUSTRIES) {
      const snapshot = industrySnapshot(state, industryId)
      expect(snapshot.firms.map(({ slot, label }) => [slot, label])).toEqual([
        [0, 'Firm A'],
        [1, 'Firm B'],
      ])
      expect(snapshot.sold).toBe(snapshot.firms[0].sold + snapshot.firms[1].sold)
    }
  })

  it('aligns firm series to the bounded metric history', () => {
    const series = firmSeries(state, 'food', (market) => market.postedPriceCents)
    expect(series).toHaveLength(state.metrics.length)
    expect(series.every((row) => row['firm-food-a'] !== undefined && row['firm-food-b'] !== undefined)).toBe(true)
  })

  it('describes every firm in plain language', () => {
    for (const firm of state.firms) {
      const status = firmStatus(firm)
      expect(status.label.length).toBeGreaterThan(0)
      if (firm.industryId === 'transport') expect(status.tone).toBe('fixed')
      if (firm.pricing.locallySettled && !firm.pricing.probing)
        expect(status.label).toBe(`Settled at ${money(firm.pricing.incumbentPriceCents)}`)
    }
  })

  it('turns the ledger into a short newest-first feed', () => {
    const highlights = buildHighlights(state.events, 10)
    expect(highlights.length).toBeLessThanOrEqual(10)
    expect(highlights.map(({ day }) => day)).toEqual(highlights.map(({ day }) => day).sort((a, b) => b - a))
    expect(buildHighlights([])).toEqual([])
  })

  it('reconciles each household cash ledger from opening to closing cash', () => {
    for (const household of state.households) {
      const [start, wage, shopping, tax, transfer, end] = householdCashSteps(household)
      expect(start.amountCents + wage.amountCents - shopping.amountCents).toBe(household.preTaxCashCents)
      expect(start.amountCents + wage.amountCents - shopping.amountCents - tax.amountCents + transfer.amountCents).toBe(
        end.amountCents,
      )
    }
  })

  it("opens each ledger with the previous day's closing cash", () => {
    const next = stepSimulation(state)
    next.households.forEach((household, index) =>
      expect(householdCashSteps(household)[0].amountCents).toBe(state.households[index].postFiscalCashCents),
    )
  })

  it('only notes the history window once the bounded history has dropped early days', () => {
    expect(historyNote(state)).toBe('')
    expect(historyNote({ ...state, metrics: state.metrics.slice(10) })).toBe(
      ` · days ${state.metrics[10].day}–${state.day}`,
    )
  })

  it('sizes pillars from cash before or after redistribution', () => {
    const before = buildWorldEntities(state, 'before').filter(({ kind }) => kind === 'household')
    const after = buildWorldEntities(state, 'after').filter(({ kind }) => kind === 'household')
    state.households.forEach((household, index) => {
      expect(before[index].height).toBe(householdWealthHeight(household.preTaxCashCents))
      expect(after[index].height).toBe(householdWealthHeight(household.postFiscalCashCents))
    })
  })

  it('names firms consistently', () => {
    expect(firmName('firm-food-a')).toBe('Food · Firm A')
    expect(firmName('firm-transport')).toBe('Transport')
  })
})

describe('observer models for markets with more than two firms (#36)', () => {
  let state = createSimulation({ seed: DEFAULT_SEED, firmsPerIndustry: 3, householdCount: employmentBlockSize(3) * 7 })
  for (let day = 0; day < 20; day++) state = stepSimulation(state)
  const ids = ['firm-food-a', 'firm-food-b', 'firm-food-c']

  it('names, colours and charts every firm by its slot', () => {
    const snapshot = industrySnapshot(state, 'food')
    expect(snapshot.firms.map(({ id, slot, label }) => [id, slot, label])).toEqual([
      [ids[0], 0, 'Firm A'],
      [ids[1], 1, 'Firm B'],
      [ids[2], 2, 'Firm C'],
    ])
    expect(new Set(snapshot.firms.map(({ color }) => color)).size).toBe(3)
    expect(snapshot.sold).toBe(snapshot.firms.reduce((sum, firm) => sum + firm.sold, 0))
    expect(firmChartSeries(state, 'food').map(({ key, name }) => [key, name])).toEqual(
      ids.map((id) => [id, firmShortName(id)]),
    )
    expect(firmSeries(state, 'food', (market) => market.marketShare).every((row) => ids.every((id) => id in row))).toBe(
      true,
    )
    expect(firmName('firm-food-c')).toBe('Food · Firm C')
  })

  it('gives each tile to the cheapest of all firms and counts every tile once', () => {
    const territory = buildMarketTerritory(state, 'food')
    expect(territory.firmIds).toEqual(ids)
    expect(Object.values(territory.cellCounts).reduce((sum, count) => sum + count, 0)).toBe(territory.cells.length)
    for (const cell of territory.cells) {
      expect(cell.deliveredCostCents).toBeLessThanOrEqual(cell.competingDeliveredCostCents)
      expect(cell.tie).toBe(cell.deliveredCostCents === cell.competingDeliveredCostCents)
    }
    expect(
      buildWorldEntities(state)
        .filter(({ industryId }) => industryId === 'food')
        .map(({ firmSlot }) => firmSlot)
        .sort(),
    ).toEqual([0, 1, 2])
  })
})
