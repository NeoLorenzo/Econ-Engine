import { describe, expect, it } from 'vitest'
import { LIFE0_WORLD, LIFE1_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import {
  bandOfOneExperiment,
  EXPERIMENT_SEEDS,
  isSustained,
  leisureExperiment,
  life1ReproducedExperiment,
  localKnowledgeExperiment,
  runLife,
  singlePatchThresholdExperiment,
} from './experiments'
import { lifeTheory } from './theory'

describe('theory', () => {
  it('derives Life 0’s predictions on Life 0’s world', () => {
    const theory = lifeTheory({ ...LIFE_DEFAULT_CONFIG, ...LIFE0_WORLD })
    expect(theory.fixedDailyCostKcal).toBe(1_800)
    expect(theory.forageHoursPerDay).toBeCloseTo(1.818, 3)
    expect(theory.dailyNeedKcal).toBeCloseTo(2_181.8, 1)
    expect(theory.singlePatchThresholdKcalPerHour).toBeCloseTo(90.91, 2)
    expect(theory.lowerBoundPerPatchKcalPerHour).toBeCloseTo(22.73, 2)
    expect(theory.dailyDeficitKcal(theory.singlePatchThresholdKcalPerHour)).toBeCloseTo(0, 9)
    expect(theory.deathDayWindow(100, 16_000)).toBeNull()
  })

  it('derives the band’s capacities on Life 1’s world', () => {
    const theory = lifeTheory({ ...LIFE_DEFAULT_CONFIG, ...LIFE1_WORLD })
    expect(theory.carryingCapacity).toBeCloseTo(19.8, 1)
    expect(theory.searchingDailyCostKcal).toBe(4_320)
    expect(theory.searchCapacity).toBe(10)
    expect(theory.harvestSuccessProbability).toBe(1)
    expect(theory.starvationPerSpell()).toEqual({ low: 0, high: 0 })
  })

  it('derives the risk of windfalls on the canonical Life 2 world', () => {
    const theory = lifeTheory(LIFE_DEFAULT_CONFIG)
    expect(theory.carryingCapacity).toBeCloseTo(17.6, 1)
    expect(theory.searchCapacity).toBeCloseTo(8.9, 1)
    expect(theory.harvestSuccessProbability).toBe(0.2)
    expect(theory.triesPerHungrySpell).toEqual({ min: 37, max: 40 })
    const bigWindfall = lifeTheory({ ...LIFE_DEFAULT_CONFIG, harvestKcal: 24_000 }).starvationPerSpell()
    expect(bigWindfall.low).toBeCloseTo(0.1285, 4)
    expect(bigWindfall.high).toBeCloseTo(0.1499, 4)
    expect(theory.roomWhenHungryKcal).toBe(6_000)
    expect(theory.usableCarriedKcal(48)).toBe(3_600)
    expect(theory.usableCarriedKcal(12)).toBe(900)
  })
})

// Every run below checks every invariant, including exact energy conservation, after every hour.
describe('Life 0 experiment 1: the single-patch threshold', () => {
  const result = singlePatchThresholdExperiment()

  it('sweeps 0.5 to 1.5 times the threshold', () => {
    expect(result.rows[0]!.regrowthKcalPerHour).toBe(46)
    expect(result.rows.at(-1)!.regrowthKcalPerHour).toBe(136)
  })

  it('starves at 0.9 times the threshold or less, inside the predicted window', () => {
    for (const row of result.rows.filter((candidate) => candidate.regrowthKcalPerHour <= 81)) {
      expect(row.survived).toBe(false)
      expect(row.deathDay!).toBeGreaterThanOrEqual(row.deathDayWindow!.earliest)
      expect(row.deathDay!).toBeLessThanOrEqual(row.deathDayWindow!.latest)
    }
  })

  it('survives at 1.1 times the threshold or more', () => {
    for (const row of result.rows.filter((candidate) => candidate.regrowthKcalPerHour >= 100))
      expect(row.survived).toBe(true)
  })

  it('declines below the threshold and at no rate above it', () => {
    expect(result.lastDeclining).toBe(90)
    expect(result.firstSustained).toBe(91)
    for (const row of result.rows) expect(isSustained(row)).toBe(row.regrowthKcalPerHour > result.threshold)
  })
})

describe('Life 0 experiment 2: leisure', () => {
  const { expectedForageHoursPerDay, rows } = leisureExperiment()

  it('forages the hours its needs require, however abundant the food', () => {
    for (const row of rows) {
      expect(Math.abs(row.meanHours.forage / expectedForageHoursPerDay - 1)).toBeLessThan(0.02)
      expect(row.meanHours.rest + row.meanHours.forage).toBeCloseTo(12, 9)
      expect(row.meanHours.sleep).toBe(12)
      expect(row.meanHours.walk).toBe(0)
    }
  })
})

describe('Life 0 experiment 3: the cost of local knowledge', () => {
  it('dies on every seed below the lower bound, as physics requires', () => {
    for (const seed of EXPERIMENT_SEEDS)
      expect(runLife({ ...LIFE0_WORLD, seed, patchRegrowthKcalPerHour: 20 }).survived).toBe(false)
  })

  it('survives on every seed at the canonical rate', () => {
    for (const seed of EXPERIMENT_SEEDS) expect(isSustained(runLife({ ...LIFE0_WORLD, seed }))).toBe(true)
  })

  it('finds a frontier between the lower bound and the canonical rate on every seed', () => {
    const { lowerBound, perSeed } = localKnowledgeExperiment(EXPERIMENT_SEEDS, [20, 22, 23, 24, 25, 26, 30, 40, 50])
    for (const { frontier } of perSeed) {
      expect(frontier).not.toBeNull()
      expect(frontier!).toBeGreaterThan(lowerBound)
      expect(frontier!).toBeLessThanOrEqual(50)
    }
  })

  it('never walks to a patch too empty to forage', () => {
    for (const seed of EXPERIMENT_SEEDS) expect(runLife({ ...LIFE0_WORLD, seed }).emptyArrivals).toBe(0)
  })
})

describe('Life 1 experiment 1: a band of one is Life 0', () => {
  it('reproduces Life 0’s checksums, starving runs included', () => {
    for (const { actual, expected } of bandOfOneExperiment()) expect(actual).toBe(expected)
  })
})

describe('experiment 1: Life 1 reproduced', () => {
  it('reproduces Life 1’s checksums on Life 1’s world', () => {
    for (const { actual, expected } of life1ReproducedExperiment()) expect(actual).toBe(expected)
  })
})
