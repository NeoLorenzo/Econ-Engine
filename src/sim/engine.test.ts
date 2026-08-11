import { describe, expect, it } from 'vitest'
import { createSimulation, runDays, stepSimulation } from './engine'
import { totalMoney } from './invariants'

describe('Econ-Engine MVP 0', () => {
  it('conserves money and clears firm/government balances across many days', () => {
    let state = createSimulation()
    for (let day = 0; day < 250; day += 1) {
      state = stepSimulation(state)
      expect(totalMoney(state)).toBe(10_000)
      expect(state.firm.cashCents).toBe(0)
      expect(state.government.cashCents).toBe(0)
      expect(state.households.every((household) => household.cashCents >= 0)).toBe(true)
    }
  })

  it.each([
    [500, 10, 5_000],
    [999, 10, 9_990],
    [1_000, 10, 10_000],
    [1_001, 0, 0],
  ])('accounts for purchases at %i cents', (price, sales, revenue) => {
    const state = stepSimulation(createSimulation({ startingPriceCents: price, initialStepCents: 100 }))
    expect(state.firm.unitsSoldToday).toBe(sales)
    expect(state.firm.revenueTodayCents).toBe(revenue)
  })

  it('converges to the benchmark from below without knowing it', () => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100 }), 100)
    expect(state.pricing.converged).toBe(true)
    expect(state.pricing.bestPriceCents).toBe(1_000)
    expect(state.firm.postedPriceCents).toBe(1_000)
  })

  it('escapes a zero-sales region and converges from above', () => {
    const state = runDays(createSimulation({ startingPriceCents: 2_000, initialStepCents: 100 }), 120)
    expect(state.pricing.foundPositiveProfit).toBe(true)
    expect(state.pricing.converged).toBe(true)
    expect(state.pricing.bestPriceCents).toBe(1_000)
  })

  it('is deterministic', () => {
    const first = runDays(createSimulation({ startingPriceCents: 347, initialStepCents: 83 }), 80)
    const second = runDays(createSimulation({ startingPriceCents: 347, initialStepCents: 83 }), 80)
    expect(first.metrics).toEqual(second.metrics)
    expect(first.events).toEqual(second.events)
  })

  it('tests both one-cent neighbors before stopping oscillation', () => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100 }), 100)
    expect(state.pricing.stepSizeCents).toBe(1)
    expect(state.pricing.testedLowerAtOneCent).toBe(true)
    expect(state.pricing.testedUpperAtOneCent).toBe(true)
    const held = stepSimulation(state)
    expect(held.firm.postedPriceCents).toBe(1_000)
    expect(held.pricing.converged).toBe(true)
  })

  it('snapshots the actual historical pricing step each day', () => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100 }), 20)
    const steps = state.metrics.map((metric) => metric.priceStepSizeCents)
    expect(steps[0]).toBe(100)
    expect(steps).toContain(50)
    expect(steps).toContain(25)
    expect(steps.every(Number.isInteger)).toBe(true)
  })

  it('exposes structured pricing actions without changing decisions', () => {
    const increasing = stepSimulation(createSimulation({ startingPriceCents: 200, initialStepCents: 100 }))
    const decreasing = stepSimulation(createSimulation({ startingPriceCents: 2_000, initialStepCents: 100 }))
    const refining = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100 }), 10)

    expect(increasing.latestDecisionAction).toBe('increase')
    expect(increasing.firm.postedPriceCents).toBe(300)
    expect(decreasing.latestDecisionAction).toBe('decrease')
    expect(decreasing.firm.postedPriceCents).toBe(1_900)
    expect(refining.latestDecisionAction).toBe('refine')
    expect(refining.pricing.stepSizeCents).toBe(50)

    let converging = createSimulation({ startingPriceCents: 200, initialStepCents: 100 })
    while (!converging.pricing.converged) converging = stepSimulation(converging)
    expect(converging.latestDecisionAction).toBe('converged')
    expect(converging.firm.postedPriceCents).toBe(1_000)
  })
})
