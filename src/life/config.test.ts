import { describe, expect, it } from 'vitest'
import { LIFE_DEFAULT_CONFIG, lifeConfigErrors, resolveLifeConfig } from './config'
import type { LifeConfig } from './types'

const errorsFor = (overrides: Partial<LifeConfig>) => lifeConfigErrors({ ...LIFE_DEFAULT_CONFIG, ...overrides })

describe('Life configuration', () => {
  it('accepts the canonical defaults', () => {
    expect(lifeConfigErrors(LIFE_DEFAULT_CONFIG)).toEqual([])
    expect(resolveLifeConfig()).toEqual(LIFE_DEFAULT_CONFIG)
  })

  it('refuses each broken rule', () => {
    expect(errorsFor({ forageKcalPerHour: 1.5 })).toEqual(['forageKcalPerHour must be an integer'])
    expect(errorsFor({ gridWidth: 0 })).toContain('The grid must be at least 1 × 1')
    expect(errorsFor({ patchCount: 0 })[0]).toMatch(/patchCount/)
    expect(errorsFor({ gridWidth: 1, gridHeight: 1, patchCount: 2 })[0]).toMatch(/patchCount/)
    expect(errorsFor({ forageKcalPerHour: 9_000 })[0]).toMatch(/could ever be foraged/)
    expect(errorsFor({ initialPatchStockKcal: 9_000 })[0]).toMatch(/initialPatchStockKcal/)
    expect(errorsFor({ dawnHour: 18, duskHour: 6 })[0]).toMatch(/dawnHour < duskHour/)
    expect(errorsFor({ duskHour: 25 })[0]).toMatch(/duskHour ≤ 24/)
    expect(errorsFor({ tilesPerHour: 0 })).toContain('tilesPerHour must be at least 1')
    expect(errorsFor({ patchRegrowthKcalPerHour: 0 })).toContain('Capacities and rates must be positive')
    expect(errorsFor({ travelKcalPerHour: -1 })).toContain('Costs must not be negative')
    expect(errorsFor({ hungryBelowKcal: 18_000 })[0]).toMatch(/hungryBelowKcal < satiatedAtKcal/)
    expect(errorsFor({ satiatedAtKcal: 21_000 })[0]).toMatch(/satiatedAtKcal ≤ reserveMaxKcal/)
    expect(errorsFor({ initialReserveKcal: 0 })[0]).toMatch(/initialReserveKcal/)
  })

  it('throws with every error when resolving an invalid configuration', () => {
    expect(() => resolveLifeConfig({ tilesPerHour: 0, travelKcalPerHour: -1 })).toThrow(
      /tilesPerHour must be at least 1; Costs must not be negative/,
    )
  })
})
