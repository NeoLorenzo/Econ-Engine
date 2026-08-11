import { describe, expect, it } from 'vitest'
import { createSimulation, stepSimulation } from '../sim/engine'
import type { SimulationEvent } from '../sim/types'
import { groupEventsForDisplay } from './groupEventsForDisplay'

describe('event display grouping', () => {
  it('groups a full market while preserving granular raw purchase events', () => {
    const state = stepSimulation(createSimulation({ startingPriceCents: 800, initialStepCents: 100 }))
    const rawPurchases = state.events.filter((event) => event.type === 'HOUSEHOLD_PURCHASE')
    const displayed = groupEventsForDisplay(state.events)
    const market = displayed.find((event) => event.key === 'market-1')

    expect(rawPurchases).toHaveLength(10)
    expect(market?.details).toHaveLength(10)
    expect(market?.description).toBe('10 of 10 households bought 1 food each at $8.00. Total spending: $80.00.')
    expect(displayed.filter((event) => event.type === 'HOUSEHOLD PURCHASES')).toHaveLength(1)
  })

  it('summarizes a completely unaffordable market', () => {
    const state = stepSimulation(createSimulation({ startingPriceCents: 1_001, initialStepCents: 100 }))
    const market = groupEventsForDisplay(state.events).find((event) => event.key === 'market-1')
    expect(state.events.filter((event) => event.type === 'HOUSEHOLD_PURCHASE_FAILED')).toHaveLength(10)
    expect(market?.type).toBe('PURCHASES FAILED')
    expect(market?.description).toBe('0 of 10 households could afford food at $10.01.')
  })

  it('summarizes a mixed market without mutating its input', () => {
    const events: SimulationEvent[] = [
      { id: 1, day: 2, type: 'HOUSEHOLD_PURCHASE', actorId: 'household-1', amountCents: 950, description: 'purchase' },
      { id: 2, day: 2, type: 'HOUSEHOLD_PURCHASE_FAILED', actorId: 'household-2', priceCents: 950, description: 'failed' },
    ]
    const original = structuredClone(events)
    const market = groupEventsForDisplay(events)[0]
    expect(market.description).toBe('1 of 2 households bought 1 food each at $9.50. 1 purchase failed. Total spending: $9.50.')
    expect(events).toEqual(original)
  })
})
