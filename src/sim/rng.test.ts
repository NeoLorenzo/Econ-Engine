import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SEED } from './config'
import { deriveEmploymentSeed } from './employment'
import { createSimulation, runDays } from './engine'
import { deriveGovernmentPolicySeed } from './government'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import { mixSeed, normalizeSeed, seededShuffle } from './rng'
import { deriveSpatialSeed } from './spatial'

describe('independent derived RNG streams', () => {
  const streams = (seed: number) => ({ market: normalizeSeed(seed), spatial: deriveSpatialSeed(seed), employment: deriveEmploymentSeed(seed), government: deriveGovernmentPolicySeed(seed) })
  const generatedSeeds = Array.from({ length: 500 }, (_, index) => Math.imul(index + 1, 0x2545_f491) >>> 0)
  const sampleSeeds = [DEFAULT_SEED, 0, 1, 2, 42, 61, 0x9e37_79b9, 0x85eb_ca6b, 0x632b_e5ab, 0xffff_ffff, ...generatedSeeds]

  it('derives pairwise-distinct market, spatial, employment, and Government seeds', () => {
    for (const seed of sampleSeeds) expect(new Set(Object.values(streams(seed))).size, `seed ${seed}`).toBe(4)
    const state = createSimulation({ seed: DEFAULT_SEED })
    expect(new Set([state.rngState, state.spatialSeed, state.employmentSeed, state.governmentPolicyRngState]).size).toBe(4)
    expect(state.governmentPolicyRngState).toBe(deriveGovernmentPolicySeed(DEFAULT_SEED))
  })

  it('does not derive the Government stream as a fixed XOR offset of another stream', () => {
    // xorshift is linear over GF(2): a constant seed offset would persist as a constant offset in every later draw.
    for (const other of ['market', 'spatial', 'employment'] as const) {
      const offsets = new Set(generatedSeeds.map((seed) => (streams(seed).government ^ streams(seed)[other]) >>> 0))
      expect(offsets.size, other).toBeGreaterThan(generatedSeeds.length / 2)
    }
  })

  it('mixes seeds as a deterministic 32-bit bijection sample', () => {
    const mixed = sampleSeeds.map(mixSeed)
    expect(mixed.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff)).toBe(true)
    expect(new Set(mixed).size).toBe(new Set(sampleSeeds).size)
    expect(sampleSeeds.map(mixSeed)).toEqual(mixed)
  })
})

describe('seeded randomness and persistent probes', () => {
  it('replays the same seed exactly and permits different seeded paths', () => {
    const config = { startingPriceCents: 200, initialStepCents: 100, seed: 42 }
    expect(runDays(createSimulation(config), 100)).toEqual(runDays(createSimulation(config), 100))
    const first = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 42)
    const second = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 43)
    expect(second.values).not.toEqual(first.values)
  })

  it('routes simulation randomness through the seeded utilities', () => {
    // Every stochastic mechanism is forced on: geography, employment, arrival order, ties, price probes, and Government trials.
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Simulation code called Math.random') })
    try {
      runDays(createSimulation({ seed: DEFAULT_SEED, probeProbability: 1, governmentExperimentProbability: 1 }), 60)
      expect(random).not.toHaveBeenCalled()
    } finally { random.mockRestore() }
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
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 7, probeProbability: 1 }), 100)
    expect(state.firms.filter(({ industryId }) => industryId !== 'transport').every(({ pricing }) => pricing.locallySettled)).toBe(true)
    expect(state.events.some(({ type }) => type === 'PRICE_PROBE_STARTED')).toBe(true)
    expect(state.events.some(({ type }) => type === 'PRICE_PROBE_REJECTED' || type === 'PRICE_PROBE_ADOPTED')).toBe(true)
  })

  it('does not freeze a symmetric $5/$5 Entertainment start', () => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 2_026_0813, firmStartingPricesCents: { 'firm-entertainment-a': 500, 'firm-entertainment-b': 500 } }), 300)
    const incumbents = state.firms.filter(({ industryId }) => industryId === 'entertainment').map(({ pricing }) => pricing.incumbentPriceCents)
    expect(incumbents).not.toEqual([500, 500])
    expect(state.firms.every(({ pricing }) => pricing.incumbentPriceCents >= 1)).toBe(true)
  }, 10_000)
})

function stepEvents(seed: number) {
  return runDays(createSimulation({ startingPriceCents: 100, initialStepCents: 100, seed, firmStartingPricesCents: { 'firm-entertainment-a': 100, 'firm-entertainment-b': 100 } }), 1).events
}
