import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../sim/config'
import { createSimulation } from '../sim/engine'
import { buildMarketTerritory, buildWorldEntities, householdWealthHeight, worldPoint } from './worldViewModel'

describe('3D world observer model', () => {
  it('maps the canonical simulation to 100 households and 8 spatial firms', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const entities = buildWorldEntities(state)

    expect(entities.filter(({ kind }) => kind === 'household')).toHaveLength(100)
    expect(entities.filter(({ kind }) => kind === 'firm')).toHaveLength(8)
    expect(entities.some(({ id }) => id === 'firm-transport')).toBe(false)
  })

  it('centres authoritative grid coordinates without mutating them', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const household = state.households[0]!
    const original = { ...household.coordinate }
    const point = worldPoint(household.coordinate, state.config.gridWidth ?? 20, state.config.gridHeight ?? 20)
    const descriptor = buildWorldEntities(state).find(({ id }) => id === household.id)!

    expect({ x: descriptor.x, z: descriptor.z }).toEqual(point)
    expect(household.coordinate).toEqual(original)
  })

  it('classifies delivered-cost territory cells with deterministic ties', () => {
    const base = createSimulation({ seed: DEFAULT_SEED })
    const state = {
      ...base,
      config: { ...base.config, gridWidth: 3, gridHeight: 1, transportCostPerTileCents: 2 },
      firms: base.firms.map((firm) => {
        if (firm.id === 'firm-food-a') return { ...firm, coordinate: { x: 0, y: 0 }, postedPriceCents: 200 }
        if (firm.id === 'firm-food-b') return { ...firm, coordinate: { x: 2, y: 0 }, postedPriceCents: 200 }
        return firm
      }),
    }

    const territory = buildMarketTerritory(state, 'food')

    expect(territory.cells).toHaveLength(3)
    expect(territory.cells.map(({ ownerFirmId }) => ownerFirmId)).toEqual(['firm-food-a', 'firm-food-a', 'firm-food-b'])
    expect(territory.cells[1]).toMatchObject({
      coordinate: { x: 1, y: 0 },
      deliveredCostCents: 204,
      competingDeliveredCostCents: 204,
      tie: true,
    })
    expect(territory.tieCount).toBe(1)
    expect(territory.cellCounts).toEqual({ 'firm-food-a': 2, 'firm-food-b': 1 })
  })

  it('moves territory when an authoritative posted price changes', () => {
    const base = createSimulation({ seed: DEFAULT_SEED })
    const state = {
      ...base,
      config: { ...base.config, gridWidth: 3, gridHeight: 1, transportCostPerTileCents: 2 },
      firms: base.firms.map((firm) => {
        if (firm.id === 'firm-food-a') return { ...firm, coordinate: { x: 0, y: 0 }, postedPriceCents: 200 }
        if (firm.id === 'firm-food-b') return { ...firm, coordinate: { x: 2, y: 0 }, postedPriceCents: 190 }
        return firm
      }),
    }

    const territory = buildMarketTerritory(state, 'food')
    expect(territory.cells.every(({ ownerFirmId }) => ownerFirmId === 'firm-food-b')).toBe(true)
    expect(territory.cells[0]?.deliveredCostCents).toBe(198)
  })

  it('encodes household cash monotonically with bounded pillar height', () => {
    expect(householdWealthHeight(0)).toBe(0.18)
    expect(householdWealthHeight(2_500)).toBeLessThan(householdWealthHeight(5_000))
    expect(householdWealthHeight(5_000)).toBeLessThan(householdWealthHeight(10_000))
    expect(householdWealthHeight(1_000_000)).toBe(6)
  })
})
