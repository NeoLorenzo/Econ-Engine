import { describe, expect, it } from 'vitest'
import { giniCoefficient, median, summarizeCashDistribution } from './analytics'
import { createSimulation, stepSimulation } from './engine'
import { randomInt } from './rng'

describe('multi-industry observer analytics', () => {
  it('calculates median and known Gini values', () => {
    expect(median([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(5.5)
    expect(giniCoefficient(Array(10).fill(5_000))).toBe(0)
    expect(giniCoefficient([0, 100])).toBe(0.5)
  })

  it('summarizes balances without mutating or controlling the economy', () => {
    const values = [800, 800, 800, 800, 800, 800, 800, 800, 1_800, 1_800]
    expect(summarizeCashDistribution(values)).toEqual({
      minimumCents: 800,
      medianCents: 800,
      maximumCents: 1_800,
      gini: 0.16,
    })
    expect(values[0]).toBe(800)
  })

  it('records economy-wide and per-market historical boundaries', () => {
    const state = stepSimulation(createSimulation({ startingPriceCents: 100, initialStepCents: 100 }))
    expect(state.metrics[0]).toMatchObject({
      householdCashMinimumAtMarketOpenCents: 5_000,
      householdCashMedianAtMarketOpenCents: 5_000,
      householdCashMaximumAtMarketOpenCents: 5_000,
      householdCashGiniAtMarketOpen: 0,
      totalHouseholdCashCents: 500_000,
      totalWagesPaidCents: expect.any(Number),
    })
    expect(state.metrics[0].householdCashGini).toBeGreaterThan(0)
    expect(state.metrics[0].markets).toHaveLength(8)
    expect(
      state.metrics[0].markets.every(
        ({ householdsAffordableAtMarketOpen }) => householdsAffordableAtMarketOpen === 100,
      ),
    ).toBe(true)
  })
})

describe('sorted Gini (#37)', () => {
  const pairwiseGini = (values: number[]) => {
    const total = values.reduce((sum, value) => sum + value, 0)
    if (values.length === 0 || total === 0) return 0
    let absoluteDifferenceSum = 0
    for (const left of values) for (const right of values) absoluteDifferenceSum += Math.abs(left - right)
    return absoluteDifferenceSum / (2 * values.length * total)
  }

  it('returns exactly the pairwise double-loop value for integer cash vectors', () => {
    let rng = 2_026_1007
    for (let trial = 0; trial < 300; trial += 1) {
      const length = (trial % 120) + 1
      const values = Array.from({ length }, () => {
        const draw = randomInt(rng, trial % 3 === 0 ? 3 : 1_000_000)
        rng = draw.state
        return draw.value
      })
      expect(giniCoefficient(values)).toBe(pairwiseGini(values))
    }
    expect(giniCoefficient([0, 0, 0])).toBe(0)
    expect(giniCoefficient([])).toBe(0)
  })
})
