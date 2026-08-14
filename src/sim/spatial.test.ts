import { describe, expect, it } from 'vitest'
import { createSimulation, stepSimulation } from './engine'
import { deriveSpatialSeed, generateSpatialLayout, manhattanDistance, transportQuote } from './spatial'

describe('seeded spatial primitives', () => {
  it('reproduces layouts for one seed and can vary across seeds', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `e${i}`)
    expect(generateSpatialLayout(12, 20, 20, ids)).toEqual(generateSpatialLayout(12, 20, 20, ids))
    expect(generateSpatialLayout(12, 20, 20, ids)).not.toEqual(generateSpatialLayout(13, 20, 20, ids))
  })
  it('keeps all coordinates unique and in bounds', () => {
    const layout = generateSpatialLayout(9, 20, 20, Array.from({ length: 12 }, (_, i) => `e${i}`))
    expect(new Set(Object.values(layout).map(({ x, y }) => `${x},${y}`)).size).toBe(12)
    expect(Object.values(layout).every(({ x, y }) => x >= 0 && x < 20 && y >= 0 && y < 20)).toBe(true)
  })
  it('calculates Manhattan distance, round trips, and integer transport fees', () => {
    expect(manhattanDistance({ x: 1, y: 8 }, { x: 6, y: 2 })).toBe(11)
    expect(transportQuote({ x: 0, y: 0 }, { x: 3, y: 5 }, 2)).toEqual({ oneWayDistance: 8, roundTripTiles: 16, transportFeeCents: 32 })
  })
  it('derives spatial state without advancing runtime market RNG', () => {
    const first = createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed: 44 })
    expect(first.spatialSeed).toBe(deriveSpatialSeed(44))
    expect(first.rngState).toBe(44)
    const wider = createSimulation({ ...first.config, gridWidth: 30, gridHeight: 30 })
    expect(wider.rngState).toBe(first.rngState)
  })
  it('uses seeded randomness for exact delivered-cost ties', () => {
    const make = () => { const s = createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed: 91, firmStartingPricesCents: { 'firm-entertainment-a': 400, 'firm-entertainment-b': 400 } }); const firms = s.firms.filter((f) => f.industryId === 'entertainment'); firms[0].coordinate = { x: 0, y: 0 }; firms[1].coordinate = { x: 2, y: 0 }; s.households.forEach((h) => { h.coordinate = { x: 1, y: 0 } }); return stepSimulation(s) }
    expect(make()).toEqual(make())
  })
  it('never calls Math.random during spatial generation or a full day', () => {
    const original = Math.random; Math.random = () => { throw new Error('forbidden') }
    try { expect(() => stepSimulation(createSimulation())).not.toThrow() } finally { Math.random = original }
  })
})
