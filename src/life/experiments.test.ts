import { describe, expect, it } from 'vitest'
import {
  EXPERIMENT_SEEDS,
  isSustained,
  leisureExperiment,
  localKnowledgeExperiment,
  runLife,
  singlePatchThresholdExperiment,
} from './experiments'
import { lifeTheory } from './theory'
import { LIFE_DEFAULT_CONFIG } from './config'

describe('theory', () => {
  it('derives the canonical predictions', () => {
    const theory = lifeTheory(LIFE_DEFAULT_CONFIG)
    expect(theory.fixedDailyCostKcal).toBe(1_800)
    expect(theory.forageHoursPerDay).toBeCloseTo(1.818, 3)
    expect(theory.dailyNeedKcal).toBeCloseTo(2_181.8, 1)
    expect(theory.singlePatchThresholdKcalPerHour).toBeCloseTo(90.91, 2)
    expect(theory.lowerBoundPerPatchKcalPerHour).toBeCloseTo(22.73, 2)
    expect(theory.dailyDeficitKcal(theory.singlePatchThresholdKcalPerHour)).toBeCloseTo(0, 9)
    expect(theory.deathDayWindow(100, 16_000)).toBeNull()
  })
})

// Every run below checks every invariant, including exact energy conservation, after every hour.
describe('experiment 1: the single-patch threshold', () => {
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

describe('experiment 2: leisure', () => {
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

describe('experiment 3: the cost of local knowledge', () => {
  it('dies on every seed below the lower bound, as physics requires', () => {
    for (const seed of EXPERIMENT_SEEDS) expect(runLife({ seed, patchRegrowthKcalPerHour: 20 }).survived).toBe(false)
  })

  it('survives on every seed at the canonical rate', () => {
    for (const seed of EXPERIMENT_SEEDS) expect(isSustained(runLife({ seed }))).toBe(true)
  })

  it('finds a frontier between the lower bound and the canonical rate on every seed', () => {
    const { lowerBound, perSeed } = localKnowledgeExperiment(EXPERIMENT_SEEDS, [20, 22, 23, 24, 25, 26, 30, 40, 50])
    for (const { frontier } of perSeed) {
      expect(frontier).not.toBeNull()
      expect(frontier!).toBeGreaterThan(lowerBound)
      expect(frontier!).toBeLessThanOrEqual(50)
    }
  })
})
