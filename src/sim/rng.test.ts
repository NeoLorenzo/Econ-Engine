import { describe, expect, it } from 'vitest'
import { createSimulation, runDays } from './engine'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import { seededShuffle } from './rng'
import engineSource from './engine.ts?raw'
import rngSource from './rng.ts?raw'

describe('seeded randomness and persistent probes', () => {
  it('replays the same seed exactly and permits different seeded paths', () => {
    const config = { startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 8, seed: 42 }
    expect(runDays(createSimulation(config), 100)).toEqual(runDays(createSimulation(config), 100))
    const first = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 42)
    const second = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 43)
    expect(second.values).not.toEqual(first.values)
  })

  it('routes simulation randomness through the seeded utilities', () => {
    expect(engineSource).not.toContain('Math.random')
    expect(rngSource).not.toContain('Math.random')
    const arrivals = (seed: number) => stepEvents(seed).filter(({ type, industryId }) => type === 'HOUSEHOLD_PURCHASE' && industryId === 'food').map(({ householdId }) => householdId)
    expect(arrivals(1)).not.toEqual(arrivals(2))
    const ties = (seed: number) => stepEvents(seed).filter(({ type, industryId }) => type === 'HOUSEHOLD_PURCHASE' && industryId === 'entertainment').map(({ firmId }) => firmId)
    expect(ties(1)).not.toEqual(ties(2))
  })

  it('starts, adopts, and rejects independent one-cent probes against the incumbent reference', () => {
    const settled = { ...createPricingState(500, 100), converged: true, locallySettled: true, bestPriceCents: 500, bestProfitCents: 2_500, incumbentPriceCents: 500, incumbentProfitCents: 2_500 }
    const started = decideTomorrowPrice(settled, 500, 5, 2_500, { shouldProbe: true, direction: 'down' })
    expect(started).toMatchObject({ nextPriceCents: 499, action: 'probe_started', probeEvent: 'started' })
    const adopted = decideTomorrowPrice(started.state, 499, 10, 4_990)
    expect(adopted).toMatchObject({ nextPriceCents: 499, action: 'probe_adopted', probeEvent: 'adopted' })
    expect(adopted.state).toMatchObject({ incumbentPriceCents: 499, incumbentProfitCents: 4_990, probing: false })
    const nextProbe = decideTomorrowPrice(adopted.state, 499, 10, 4_990, { shouldProbe: true, direction: 'up' })
    const rejected = decideTomorrowPrice(nextProbe.state, 500, 5, 2_500)
    expect(rejected).toMatchObject({ nextPriceCents: 499, action: 'probe_rejected', probeEvent: 'rejected' })
  })

  it('continues sampling explicit probes after local settlement', () => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed: 7, probeProbability: 1 }), 100)
    expect(state.firms.filter(({ industryId }) => industryId !== 'transport').every(({ pricing }) => pricing.locallySettled)).toBe(true)
    expect(state.events.some(({ type }) => type === 'PRICE_PROBE_STARTED')).toBe(true)
    expect(state.events.some(({ type }) => type === 'PRICE_PROBE_REJECTED' || type === 'PRICE_PROBE_ADOPTED')).toBe(true)
  })

  it('does not freeze a symmetric $5/$5 Entertainment start', () => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed: 2_026_0813, firmStartingPricesCents: { 'firm-entertainment-a': 500, 'firm-entertainment-b': 500 } }), 300)
    const incumbents = state.firms.filter(({ industryId }) => industryId === 'entertainment').map(({ pricing }) => pricing.incumbentPriceCents)
    expect(incumbents).not.toEqual([500, 500])
    expect(state.firms.every(({ pricing }) => pricing.incumbentPriceCents >= 1)).toBe(true)
  }, 10_000)
})

function stepEvents(seed: number) {
  return runDays(createSimulation({ startingPriceCents: 100, initialStepCents: 100, dailySupplyPerIndustry: 10, seed, firmStartingPricesCents: { 'firm-entertainment-a': 100, 'firm-entertainment-b': 100 } }), 1).events
}
