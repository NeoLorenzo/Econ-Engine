import { describe, expect, it } from 'vitest'
import {
  LIFE0_WORLD,
  LIFE1_WORLD,
  LIFE2_WORLD,
  LIFE_DEFAULT_CONFIG,
  lifeConfigErrors,
  resolveLifeConfig,
} from './config'
import type { LifeConfig } from './types'

const errorsFor = (overrides: Partial<LifeConfig>) => lifeConfigErrors({ ...LIFE_DEFAULT_CONFIG, ...overrides })

describe('Life configuration', () => {
  it('accepts the canonical defaults', () => {
    expect(lifeConfigErrors(LIFE_DEFAULT_CONFIG)).toEqual([])
    expect(resolveLifeConfig()).toEqual(LIFE_DEFAULT_CONFIG)
    expect(resolveLifeConfig(LIFE0_WORLD)).toMatchObject({ bandSize: 1, perceptionRadiusTiles: 0, patchCount: 4 })
    expect(resolveLifeConfig(LIFE1_WORLD)).toMatchObject({ bandSize: 40, hasCamp: false, harvestKcal: 1_200 })
    expect(resolveLifeConfig(LIFE0_WORLD)).toMatchObject({ hasCamp: false, sharers: 0, reciprocators: 0 })
    expect(resolveLifeConfig(LIFE2_WORLD)).toMatchObject({ bandSize: 12, harvestKcal: 6_000, groveCount: 0 })
    expect(resolveLifeConfig(LIFE1_WORLD)).toMatchObject({ groveCount: 0, swapping: false, skillMaxPercent: 100 })
  })

  it('refuses each broken rule', () => {
    expect(errorsFor({ forageKcalPerHour: 1.5 })).toEqual(['forageKcalPerHour must be an integer'])
    expect(errorsFor({ gridWidth: 0 })).toContain('The grid must be at least 1 × 1')
    expect(errorsFor({ patchCount: 0 })[0]).toMatch(/patchCount/)
    expect(errorsFor({ gridWidth: 1, gridHeight: 1, patchCount: 2 })[0]).toMatch(/patchCount/)
    // The fastest forager's harvest is 1.5 × 17,000, more than a patch holds.
    expect(errorsFor({ forageKcalPerHour: 17_000 })[0]).toMatch(/A patch must hold the largest harvest/)
    expect(errorsFor({ harvestKcal: 30_000 })[0]).toMatch(/A patch must hold the largest harvest/)
    expect(errorsFor({ harvestKcal: 0 })).toEqual(['harvestKcal must be at least 1'])
    expect(errorsFor({ initialPatchStockKcal: 25_000 })[0]).toMatch(/initialPatchStockKcal/)
    expect(errorsFor({ dawnHour: 18, duskHour: 6 })[0]).toMatch(/dawnHour < duskHour/)
    expect(errorsFor({ duskHour: 25 })[0]).toMatch(/duskHour ≤ 24/)
    expect(errorsFor({ tilesPerHour: 0 })).toContain('tilesPerHour must be at least 1')
    expect(errorsFor({ patchRegrowthKcalPerHour: 0 })).toContain('Capacities and rates must be positive')
    expect(errorsFor({ travelKcalPerHour: -1 })).toContain('Costs must not be negative')
    expect(errorsFor({ hungryBelowKcal: 18_000 })[0]).toMatch(/hungryBelowKcal < satiatedAtKcal/)
    expect(errorsFor({ satiatedAtKcal: 21_000 })[0]).toMatch(/satiatedAtKcal ≤ reserveMaxKcal/)
    expect(errorsFor({ initialReserveKcal: 0 })[0]).toMatch(/initialReserveKcal/)
    expect(errorsFor({ bandSize: 0, sharers: 0, reciprocators: 0 })).toEqual(['bandSize must be at least 1'])
    expect(errorsFor({ perceptionRadiusTiles: -1 })).toEqual(['perceptionRadiusTiles must not be negative'])
    expect(errorsFor({ bandSize: 2.5 })).toEqual(['bandSize must be an integer'])
    expect(errorsFor({ shelfLifeHours: -1 })).toEqual(['shelfLifeHours must not be negative'])
    expect(errorsFor({ sharers: -1 })[0]).toMatch(/sharers and reciprocators/)
    expect(errorsFor({ sharers: 8, reciprocators: 5 })[0]).toMatch(/must not exceed bandSize/)
    expect(errorsFor({ sharers: 4, reciprocators: 4 })).toEqual([])
    expect(errorsFor({ hasCamp: 1 as unknown as boolean })).toEqual(['hasCamp must be true or false'])
    expect(errorsFor({ swapping: 1 as unknown as boolean })).toEqual(['swapping must be true or false'])
    expect(errorsFor({ quotes: 0 as unknown as boolean })).toEqual(['quotes must be true or false'])
  })

  it('refuses each broken rule of wood and skill', () => {
    expect(errorsFor({ groveCount: 140 })[0]).toMatch(/patchCount \+ groveCount/)
    expect(errorsFor({ groveCount: -1 })[0]).toMatch(/patchCount \+ groveCount/)
    expect(errorsFor({ initialGroveWood: 201 })).toEqual(['initialGroveWood must be between 0 and groveCapacityWood'])
    expect(errorsFor({ groveRegrowthWoodPerHour: -1 })).toEqual(['groveRegrowthWoodPerHour must not be negative'])
    expect(errorsFor({ fireWoodPerHour: 0 })).toEqual(['fireWoodPerHour must be at least 1'])
    expect(errorsFor({ coldSleepKcalPerHour: 59 })).toEqual(['coldSleepKcalPerHour must be at least sleepKcalPerHour'])
    expect(errorsFor({ skillMinPercent: 0 })[0]).toMatch(/1 ≤ skillMinPercent ≤ skillMaxPercent/)
    expect(errorsFor({ skillMinPercent: 160 })[0]).toMatch(/1 ≤ skillMinPercent ≤ skillMaxPercent/)
    // At 4%, a forager gathers floor(24 × 4 / 100) = 0 units an hour.
    expect(errorsFor({ skillMinPercent: 4 })).toEqual(['The lowest foraging and wood rates must be at least 1'])
    expect(errorsFor({ groveCapacityWood: 30, initialGroveWood: 30 })[0]).toMatch(/A grove must hold/)
    expect(errorsFor({ groveCount: 0, groveCapacityWood: 30, initialGroveWood: 30 })).toEqual([])
    expect(errorsFor({ woodStockNights: 0 })).toEqual(['woodStockNights must be at least 1'])
    expect(errorsFor({ termsMemoryHours: -1 })).toEqual(['termsMemoryHours must not be negative'])
  })

  it('throws with every error when resolving an invalid configuration', () => {
    expect(() => resolveLifeConfig({ tilesPerHour: 0, travelKcalPerHour: -1 })).toThrow(
      /tilesPerHour must be at least 1; Costs must not be negative/,
    )
  })
})
