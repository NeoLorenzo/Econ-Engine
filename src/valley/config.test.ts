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

  it('refuses a band around the camp whose hearths would not fit in the camp’s clearing', () => {
    expect(errorsWith({ scattered: false, bandSize: 200 })).toContain(
      'The band’s hearths must fit inside the camp’s clearing',
    )
    expect(errorsWith({ bandSize: 200 })).not.toContain('The band’s hearths must fit inside the camp’s clearing')
  })

  it('refuses a band of one that starts as one group', () => {
    expect(errorsWith({ scattered: false, bandSize: 1 })).toContain(
      'A band that starts as one group needs at least two foragers',
    )
    expect(errorsWith({ bandSize: 1 })).toEqual([])
  })

  it('refuses Life 6’s switches that are not booleans, and sizes that are not positive', () => {
    expect(errorsWith({ groups: 'yes' as unknown as boolean })).toContain('groups must be true or false')
    expect(errorsWith({ knowValley: 0 as unknown as boolean })).toContain('knowValley must be true or false')
    expect(errorsWith({ startSpacingCm: 0 })).toContain('startSpacingCm must be positive')
    expect(errorsWith({ exploreAfterHours: 0 })).toContain('exploreAfterHours must be positive')
  })

  it('refuses places too large to see whole from their centre', () => {
    expect(errorsWith({ placeCm: 3_536 })).toContain(
      'A place must fit in a forager’s view: placeCm² ≤ 2 · perceptionRadiusCm²',
    )
    expect(errorsWith({ placeCm: 3_535 })).toEqual([])
  })

  it('refuses a layout that cannot be drawn, or starts that cannot be placed', () => {
    expect(() => createValley({ valleySizeCm: 20_000, thicketCount: 40 })).toThrow('cannot all be placed')
    expect(() => createValley({ bandSize: 200 })).toThrow('The foragers’ starts cannot all be placed')
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

describe('Life 7 configuration', () => {
  it('refuses switches that are not booleans, and a body, berries or sight that are not positive', () => {
    expect(errorsWith({ checkSites: 1 as unknown as boolean })).toContain('checkSites must be true or false')
    expect(errorsWith({ carryCost: 'yes' as unknown as boolean })).toContain('carryCost must be true or false')
    expect(errorsWith({ loadHome: 0 as unknown as boolean })).toContain('loadHome must be true or false')
    expect(errorsWith({ bodyKg: 0 })).toContain('bodyKg must be positive')
    expect(errorsWith({ berryKcalPerKg: 0 })).toContain('berryKcalPerKg must be positive')
    expect(errorsWith({ sightRadiusCm: 0 })).toContain('sightRadiusCm must be positive')
  })

  it('refuses long sight shorter than close sight', () => {
    expect(errorsWith({ sightRadiusCm: 2_499 })).toContain(
      'Long sight must reach at least as far as close sight: sightRadiusCm ≥ perceptionRadiusCm',
    )
    expect(errorsWith({ sightRadiusCm: 2_500 })).toEqual([])
  })

  it('refuses sites too wide to check, but only when checking them', () => {
    const message =
      'A site must fit in close sight to be checked: perceptionRadiusCm > thicketRadiusCm and standRadiusCm'
    expect(errorsWith({ standRadiusCm: 2_500 })).toContain(message)
    expect(errorsWith({ standRadiusCm: 2_500, checkSites: false })).not.toContain(message)
  })
})

describe('Life 8 configuration', () => {
  it('refuses switches that are not booleans, and a fire that burns nothing', () => {
    expect(errorsWith({ sharedFire: 1 as unknown as boolean })).toContain('sharedFire must be true or false')
    expect(errorsWith({ campfirePerMember: 'no' as unknown as boolean })).toContain(
      'campfirePerMember must be true or false',
    )
    expect(errorsWith({ feedSpare: 0 as unknown as boolean })).toContain('feedSpare must be true or false')
    expect(errorsWith({ campfireWoodPerHour: 0 })).toContain('campfireWoodPerHour must be positive')
    expect(errorsWith({ campfireWoodPerHour: 1.5 })).toContain('campfireWoodPerHour must be an integer')
  })
})
