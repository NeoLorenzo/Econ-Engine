import { describe, expect, it } from 'vitest'
import { VALLEY_DEFAULT_CONFIG, spiralOffsets, valleyConfigErrors } from './config'
import { createValley } from './engine'
import type { ValleyConfig } from './types'

const errorsWith = (overrides: Partial<ValleyConfig>) => valleyConfigErrors({ ...VALLEY_DEFAULT_CONFIG, ...overrides })

describe('valley configuration', () => {
  it('accepts the canonical valley', () => {
    expect(valleyConfigErrors(VALLEY_DEFAULT_CONFIG)).toEqual([])
  })

  it('refuses values that are not integers, and switches that are not booleans', () => {
    expect(errorsWith({ reachCm: 1.5 })).toContain('reachCm must be an integer')
    expect(errorsWith({ swapping: 1 as unknown as boolean })).toContain('swapping must be true or false')
  })

  it('refuses sizes, counts and speeds that are not positive, and amounts that are negative', () => {
    expect(errorsWith({ walkCmPerSecond: 0 })).toContain('walkCmPerSecond must be positive')
    expect(errorsWith({ thicketCount: 0 })).toContain('thicketCount must be positive')
    expect(errorsWith({ woodLoad: -1 })).toContain('woodLoad must not be negative')
    expect(errorsWith({ travelKcalPerHour: -1 })).toContain('travelKcalPerHour must not be negative')
  })

  it('refuses a reach as long as sight', () => {
    expect(errorsWith({ reachCm: 2_500 })).toContain('reachCm must be less than perceptionRadiusCm')
  })

  it('refuses starting stocks above capacity', () => {
    expect(errorsWith({ initialBushKcal: 401 })).toContain('initialBushKcal must be between 0 and bushCapacityKcal')
    expect(errorsWith({ initialTreeWood: 26 })).toContain('initialTreeWood must be between 0 and treeCapacityWood')
  })

  it('refuses hours, thresholds and costs out of order', () => {
    expect(errorsWith({ dawnHour: 18 })).toContain('Hours must satisfy 0 ≤ dawnHour < duskHour ≤ 24')
    expect(errorsWith({ hungryBelowKcal: 18_000 })).toContain(
      'Thresholds must satisfy 0 < hungryBelowKcal < satiatedAtKcal ≤ reserveMaxKcal',
    )
    expect(errorsWith({ coldSleepKcalPerHour: 50 })).toContain('coldSleepKcalPerHour must be at least sleepKcalPerHour')
  })

  it('refuses skill and practice ranges out of order, and rates that round to nothing', () => {
    expect(errorsWith({ skillMinPercent: 120 })).toContain('Skills must satisfy 1 ≤ skillMinPercent ≤ skillMaxPercent')
    expect(errorsWith({ practiceMinPercent: 0 })).toContain(
      'Practice must satisfy 1 ≤ practiceMinPercent ≤ practiceMaxPercent',
    )
    expect(errorsWith({ woodPerHour: 1, practiceMinPercent: 10 })).toContain(
      'The lowest picking and gathering rates must be at least 1',
    )
  })

  it('refuses plants that cannot hold a minute of work at the fastest rate', () => {
    expect(errorsWith({ bushCapacityKcal: 20, initialBushKcal: 20 })).toContain(
      'A bush must hold a minute of picking at the fastest rate',
    )
  })

  it('refuses a band whose hearths would not fit in the camp’s clearing', () => {
    expect(errorsWith({ bandSize: 200 })).toContain('The band’s hearths must fit inside the camp’s clearing')
  })

  it('refuses a layout that cannot be drawn', () => {
    expect(() => createValley({ valleySizeCm: 20_000, thicketCount: 40 })).toThrow('cannot all be placed')
  })

  it('lays hearths on a square spiral, ring by ring', () => {
    const points = spiralOffsets(9)
    expect(points.slice(0, 8)).toEqual([
      [-1, -1],
      [0, -1],
      [1, -1],
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
    ])
    expect(points[8]).toEqual([-2, -2])
  })
})
