import { describe, expect, it } from 'vitest'
import { filterAndSortHouseholds } from '../App'
import { DEFAULT_SEED } from '../sim/config'
import { createSimulation, stepSimulation } from '../sim/engine'

describe('MVP8.1 observer presentation', () => {
  it('keeps every household available before filtering and filters by ID or employer', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    expect(filterAndSortHouseholds(state.households, '', 'household', true)).toHaveLength(100)
    expect(filterAndSortHouseholds(state.households, 'household-100', 'household', true).map(({ id }) => id)).toEqual(['household-100'])
    const employer = state.households[0]!.employerFirmId
    expect(filterAndSortHouseholds(state.households, employer, 'household', true).every((household) => household.employerFirmId === employer)).toBe(true)
  })

  it('sorts deterministically without mutating simulation order', () => {
    const state = stepSimulation(createSimulation({ seed: DEFAULT_SEED }))
    const original = state.households.map(({ id }) => id)
    const sorted = filterAndSortHouseholds(state.households, '', 'cash', false)
    expect(sorted.map(({ postFiscalCashCents }) => postFiscalCashCents)).toEqual([...sorted.map(({ postFiscalCashCents }) => postFiscalCashCents)].sort((a, b) => b - a))
    expect(state.households.map(({ id }) => id)).toEqual(original)
  })

  it('retains all nine semantically selected firm rows, including the fifth firm and Transport', () => {
    const rows = createSimulation({ seed: DEFAULT_SEED }).firms.map(({ id }) => id)
    expect(rows).toHaveLength(9)
    expect(rows[4]).toBe('firm-transport')
    expect(rows).toContain('firm-transport')
  })

  it('preserves the canonical deterministic trajectory through the UI configuration values', () => {
    const uiConfig = { startingPriceCents: 200, initialStepCents: 100, laborProductivityUnitsPerWorker: 5, seed: DEFAULT_SEED, transportCostPerTileCents: 2, dailyExpenditureBudgetCents: 5_000 }
    let direct = createSimulation(uiConfig), throughUi = createSimulation({ ...uiConfig })
    for (let day = 0; day < 20; day++) { direct = stepSimulation(direct); throughUi = stepSimulation(throughUi) }
    expect(throughUi).toEqual(direct)
  })
})
