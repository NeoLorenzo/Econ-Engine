import { describe, expect, it } from 'vitest'
import { FLAT_LAND, VALLEY_DEFAULT_CONFIG, spiralOffsets, valleyConfigErrors } from './config'
import { createValley } from './engine'
import type { ValleyConfig } from './types'

const errorsWith = (overrides: Partial<ValleyConfig>) => valleyConfigErrors({ ...VALLEY_DEFAULT_CONFIG, ...overrides })

describe('valley configuration', () => {
  it('accepts the canonical valley', () => {
    expect(valleyConfigErrors(VALLEY_DEFAULT_CONFIG)).toEqual([])
  })

  it('refuses values that are not integers, and switches that are not booleans', () => {
    expect(errorsWith({ reachCm: 1.5 })).toContain('reachCm must be an integer')
    expect(errorsWith({ scattered: 1 as unknown as boolean })).toContain('scattered must be true or false')
  })

  it('refuses sizes, counts and speeds that are not positive, and amounts that are negative', () => {
    expect(errorsWith({ walkCmPerSecond: 0 })).toContain('walkCmPerSecond must be positive')
    expect(errorsWith({ thicketCount: 0 })).toContain('thicketCount must be positive')
    expect(errorsWith({ woodLoad: -1 })).toContain('woodLoad must not be negative')
    expect(errorsWith({ loadSlowdownPerMille: -1 })).toContain('loadSlowdownPerMille must not be negative')
    expect(errorsWith({ stoneTerrainPercent: 90 })).toContain('stoneTerrainPercent must be at least 100')
    expect(errorsWith({ smallKettleCount: -1 })).toContain('smallKettleCount must not be negative')
    expect(errorsWith({ terrainCellCm: 0 })).toContain('terrainCellCm must be positive')
  })

  it('refuses a terrain that does not fit its lattice or its land', () => {
    expect(errorsWith({ terrainCellCm: 700 })).toContain(
      'The land must be a whole number of terrain cells: valleySizeCm divisible by terrainCellCm',
    )
    expect(errorsWith({ microCoarseWavelengthCm: 20_100 })).toContain(
      'microCoarseWavelengthCm must be a whole number of terrain cells',
    )
    expect(errorsWith({ microFineWavelengthCm: 20_100 })).toContain(
      'microFineWavelengthCm must be a whole number of terrain cells',
    )
    expect(errorsWith({ drumlinMinLengthCm: 80_000 })).toContain(
      'drumlinMinLengthCm must not exceed drumlinMaxLengthCm',
    )
    expect(errorsWith({ kameMinRadiusCm: 13_000 })).toContain('kameMinRadiusCm must not exceed kameMaxRadiusCm')
    expect(errorsWith({ dirtSlopePercent: 31 })).toContain('dirtSlopePercent must not exceed stoneSlopePercent')
    expect(errorsWith({ smallKettleMinRadiusCm: 7_000 })).toContain(
      'smallKettleMinRadiusCm must not exceed smallKettleMaxRadiusCm',
    )
    expect(errorsWith({ kettleDepthPerMille: 1_001 })).toContain('kettleDepthPerMille must be at most 1,000')
    expect(errorsWith({ shoreRampCm: 500_000 })).toContain('shoreRampCm must not exceed the land’s width')
    expect(errorsWith({ sightStepCm: 4_000 })).toContain('sightStepCm must not exceed placeCm')
    expect(errorsWith({ startAreaCm: 500_000 })).toContain('startAreaCm must not exceed the land’s width')
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
    expect(errorsWith({ hungryBelowKcal: 68_000 })).toContain(
      'Thresholds must satisfy 0 < hungryBelowKcal < satiatedAtKcal ≤ reserveMaxKcal',
    )
    const sleepOrder =
      'Sleep must satisfy sleepKcalPerHour ≤ fireSleepKcalPerHour ≤ hutSleepKcalPerHour ≤ coldSleepKcalPerHour'
    expect(errorsWith({ coldSleepKcalPerHour: 74 })).toContain(sleepOrder)
    // A hut must not warm more than a fire.
    expect(errorsWith({ hutSleepKcalPerHour: 65 })).toContain(sleepOrder)
  })

  it('refuses skill and practice ranges out of order, and rates that round to nothing', () => {
    expect(errorsWith({ skillMinPercent: 130 })).toContain('Skills must satisfy 1 ≤ skillMinPercent ≤ skillMaxPercent')
    expect(errorsWith({ practiceMinPercent: 0 })).toContain(
      'Practice must satisfy 1 ≤ practiceMinPercent ≤ practiceMaxPercent',
    )
    expect(errorsWith({ woodPerHour: 1, practiceMinPercent: 10 })).toContain(
      'The lowest gathering rate must be at least 1',
    )
  })

  it('refuses a food that would not be worth working even full, to the slowest forager', () => {
    // At 75% skill and 50% practice, 600 kcal of fish an hour is 225, just more than the 200 an hour costs.
    expect(errorsWith({})).toEqual([])
    expect(errorsWith({ fishKcalPerHour: 530 })).toContain(
      'fishKcalPerHour at the lowest skill and practice must be more than pickKcalPerHour',
    )
    expect(errorsWith({ nutKcalPerHour: 500 })).toContain(
      'nutKcalPerHour at the lowest skill and practice must be more than pickKcalPerHour',
    )
  })

  it('refuses hazels that start above capacity, and a lake too large to count its growth exactly', () => {
    expect(errorsWith({ initialHazelKcal: 2_000 })).toContain(
      'initialHazelKcal must be between 0 and hazelCapacityKcal',
    )
    expect(errorsWith({ lakeHectares: 3_000 })).toContain('The lake is too large for its growth to be counted exactly')
    expect(errorsWith({ lakeHectares: 0 })).toContain('lakeHectares must be positive')
  })

  it('refuses plants that cannot hold a minute of work at the fastest rate', () => {
    expect(errorsWith({ treeCapacityWood: 1, initialTreeWood: 1, woodPerHour: 60 })).toContain(
      'A tree must hold a minute of gathering at the fastest rate',
    )
  })

  it('refuses a band around the camp whose huts would not fit in the camp’s clearing', () => {
    expect(errorsWith({ scattered: false, bandSize: 200 })).toContain(
      'The band’s huts must fit inside the camp’s clearing',
    )
    expect(errorsWith({ bandSize: 200 })).not.toContain('The band’s huts must fit inside the camp’s clearing')
  })

  it('refuses a band of one that starts as one group', () => {
    expect(errorsWith({ scattered: false, bandSize: 1 })).toContain(
      'A band that starts as one group needs at least two foragers',
    )
    expect(errorsWith({ bandSize: 1 })).toEqual([])
  })

  it('refuses spacing and checking times that are not positive', () => {
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
    expect(() =>
      createValley({
        ...FLAT_LAND,
        valleySizeCm: 20_000,
        shoreRampCm: 20_000,
        startAreaCm: 20_000,
        reliefWavelengthCm: 20_000,
        thicketCount: 40,
      }),
    ).toThrow('cannot all be placed')
    expect(() => createValley({ ...FLAT_LAND, bandSize: 200 })).toThrow('The foragers’ starts cannot all be placed')
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

describe('sight and loads', () => {
  it('refuses a body, berries or sight that are not positive', () => {
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

  it('refuses sites too wide to check', () => {
    const message = 'A site must fit in close sight to be checked: perceptionRadiusCm > every site radius'
    expect(errorsWith({ standRadiusCm: 2_500 })).toContain(message)
    expect(errorsWith({ hazelThicketRadiusCm: 2_500 })).toContain(message)
    expect(errorsWith({ outcropRadiusCm: 2_500 })).toContain(message)
  })
})

describe('the shared fire', () => {
  it('refuses a fire that burns nothing', () => {
    expect(errorsWith({ campfireWoodPerHour: 0 })).toContain('campfireWoodPerHour must be positive')
    expect(errorsWith({ campfireWoodPerHour: 1.5 })).toContain('campfireWoodPerHour must be an integer')
  })
})

describe('huts and axes', () => {
  it('refuses switches that are not booleans', () => {
    expect(errorsWith({ axeTrade: 1 as unknown as boolean })).toContain('axeTrade must be true or false')
    expect(errorsWith({ craftPractice: 'no' as unknown as boolean })).toContain('craftPractice must be true or false')
  })

  it('refuses sizes and times that are not positive, and counts that are negative', () => {
    for (const key of [
      'logKg',
      'logChopMinutes',
      'hutLogs',
      'hutLogDays',
      'axeHours',
      'axeLogs',
      'logsPerTree',
      'treeRegrowthDays',
      'hutRingCm',
    ] as const)
      expect(errorsWith({ [key]: 0 })).toContain(`${key} must be positive`)
    for (const key of ['outcropCount', 'stonesPerOutcrop', 'stonesPerSpot', 'axeWood', 'fellWood'] as const)
      expect(errorsWith({ [key]: -1 })).toContain(`${key} must not be negative`)
    expect(errorsWith({ initialBushWood: 3 })).toContain('initialBushWood must be between 0 and bushCapacityWood')
    // Bushes may hold no sticks at all, but sticks they hold must be worth a minute's gathering.
    expect(errorsWith({ bushCapacityWood: 0, initialBushWood: 0 })).toEqual([])
    expect(errorsWith({ woodPerHour: 200 })).toContain(
      'A bush that holds sticks must hold a minute of gathering at the fastest rate',
    )
  })

  it('refuses craft out of order, and working that costs no more than resting', () => {
    expect(errorsWith({ craftSkillMinPercent: 0 })).toContain(
      'Craft must satisfy 1 ≤ craftSkillMinPercent ≤ craftSkillMaxPercent',
    )
    expect(errorsWith({ craftSkillMinPercent: 120, craftSkillMaxPercent: 110 })).toContain(
      'Craft must satisfy 1 ≤ craftSkillMinPercent ≤ craftSkillMaxPercent',
    )
    for (const key of ['pickKcalPerHour', 'gatherKcalPerHour', 'chopKcalPerHour', 'makeKcalPerHour'] as const)
      expect(errorsWith({ [key]: 90 })).toContain(`${key} must be more than restKcalPerHour`)
  })

  it('refuses a log too heavy to carry', () => {
    expect(errorsWith({ logKg: 10_000 })).toContain('A forager must be able to carry a log at 1 cm a second')
  })
})
