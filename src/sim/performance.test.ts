import { describe, expect, it } from 'vitest'
import { MAX_EVENTS, MAX_HISTORY } from './config'
import { createSimulation, runDays, stepSimulation } from './engine'
import { totalMoney, validateState } from './invariants'
import engineSource from './engine.ts?raw'

describe('MVP4 006.2 structurally shared simulation steps', () => {
  it('removes whole-state structuredClone from the daily hot path', () => {
    expect(engineSource).not.toContain('structuredClone(previous)')
  })

  it('does not mutate the supplied state and shares immutable historical records', () => {
    const previous = runDays(createSimulation(), 3)
    const snapshot = JSON.stringify(previous)
    const previousMetric = previous.metrics[0]
    const previousEvent = previous.events.at(-1)!
    const next = stepSimulation(previous)

    expect(JSON.stringify(previous)).toBe(snapshot)
    expect(next).not.toBe(previous)
    expect(next.households).not.toBe(previous.households)
    expect(next.households[0]).not.toBe(previous.households[0])
    expect(next.households[0].industryOutcomes).not.toBe(previous.households[0].industryOutcomes)
    expect(next.households[0].industryOutcomes.food).not.toBe(previous.households[0].industryOutcomes.food)
    expect(next.firms[0]).not.toBe(previous.firms[0])
    expect(next.firms[0].pricing).not.toBe(previous.firms[0].pricing)
    expect(next.government).not.toBe(previous.government)
    expect(next.metrics).not.toBe(previous.metrics)
    expect(next.events).not.toBe(previous.events)
    expect(next.metrics[0]).toBe(previousMetric)
    expect(next.events.find(({ id }) => id === previousEvent.id)).toBe(previousEvent)
    expect(next.config).toBe(previous.config)
    expect(next.industries).toBe(previous.industries)
    expect(next.households[0].coordinate).toBe(previous.households[0].coordinate)
  })

  it('runs 10,000 days with bounded histories and exact terminal invariants', () => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed: 2_026_0813 }), 10_000)
    expect(state.day).toBe(10_000)
    expect(state.metrics).toHaveLength(MAX_HISTORY)
    expect(state.events.length).toBeLessThanOrEqual(MAX_EVENTS)
    expect(state.households.reduce((sum, { cashCents }) => sum + cashCents, 0)).toBe(500_000)
    expect(state.firms.every(({ cashCents }) => cashCents === 0)).toBe(true)
    expect(state.government.cashCents).toBe(0)
    expect(totalMoney(state)).toBe(500_000)
    expect(() => validateState(state, true)).not.toThrow()
  }, 180_000)

  it('reproduces the complete 1,000-day state exactly', () => {
    const config = { startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed: 61 }
    expect(runDays(createSimulation(config), 1_000)).toEqual(runDays(createSimulation(config), 1_000))
  }, 30_000)
})
