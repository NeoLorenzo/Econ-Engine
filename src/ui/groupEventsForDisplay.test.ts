import { describe, expect, it } from 'vitest'
import { createSimulation, stepSimulation } from '../sim/engine'
import { groupEventsForDisplay } from './groupEventsForDisplay'

describe('multi-market event display grouping', () => {
  it('groups each market separately while preserving all granular events', () => {
    const state = stepSimulation(createSimulation({ startingPriceCents: 100, initialStepCents: 100, dailySupplyPerIndustry: 10 }))
    const displayed = groupEventsForDisplay(state.events)
    const markets = displayed.filter(({ key }) => key.startsWith('market-'))
    expect(markets).toHaveLength(4)
    expect(markets.every(({ details }) => details.length === 10)).toBe(true)
    expect(markets.find(({ key }) => key === 'market-1-food')?.description).toContain('10 purchased')
    expect(state.events.filter(({ type }) => type === 'HOUSEHOLD_PURCHASE')).toHaveLength(40)
  })

  it('distinguishes unaffordable and scarce markets in grouped summaries', () => {
    const state = stepSimulation(createSimulation({ startingPriceCents: 100, initialStepCents: 100, dailySupplyPerIndustry: 4, industryStartingPricesCents: { food: 1_501 } }))
    const displayed = groupEventsForDisplay(state.events)
    expect(displayed.find(({ key }) => key === 'market-1-food')?.description).toContain('10 affordability')
    expect(displayed.find(({ key }) => key === 'market-1-utilities')?.description).toContain('0 stockout failures')
  })

  it('groups explicit payroll without altering source events', () => {
    const state = stepSimulation(createSimulation({
      startingPriceCents: 500,
      initialStepCents: 100,
      dailySupplyPerIndustry: 10,
      industryStartingPricesCents: { food: 1_500, utilities: 1_200, healthcare: 1_000, transport: 800, entertainment: 500 },
    }))
    const original = structuredClone(state.events)
    const group = groupEventsForDisplay(state.events).find(({ key }) => key === 'payroll-1')
    expect(group?.details).toHaveLength(10)
    expect(group?.description).toContain('explicit wages across 10 workers')
    expect(state.events).toEqual(original)
  })

  it('groups competitive Entertainment purchases while preserving actual firm counterparties', () => {
    const state = stepSimulation(createSimulation({
      startingPriceCents: 200,
      initialStepCents: 100,
      dailySupplyPerIndustry: 10,
      firmStartingPricesCents: { 'firm-entertainment-a': 100, 'firm-entertainment-b': 100 },
    }))
    const group = groupEventsForDisplay(state.events).find(({ key }) => key === 'market-1-entertainment')
    expect(group?.details).toHaveLength(10)
    expect(group?.description).toContain('10 purchased')
    const a = group?.details.filter(({ firmId }) => firmId === 'firm-entertainment-a').length ?? 0
    const b = group?.details.filter(({ firmId }) => firmId === 'firm-entertainment-b').length ?? 0
    expect(a + b).toBe(10)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
  })
})
