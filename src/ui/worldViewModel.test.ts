import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../sim/config'
import { createSimulation } from '../sim/engine'
import { buildWorldEntities, householdWealthHeight, worldPoint } from './worldViewModel'

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

  it('encodes household cash monotonically with bounded pillar height', () => {
    expect(householdWealthHeight(0)).toBe(0.18)
    expect(householdWealthHeight(2_500)).toBeLessThan(householdWealthHeight(5_000))
    expect(householdWealthHeight(5_000)).toBeLessThan(householdWealthHeight(10_000))
    expect(householdWealthHeight(1_000_000)).toBe(6)
  })
})
