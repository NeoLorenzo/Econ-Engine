import { describe, expect, it } from 'vitest'
import { createValley } from './engine'
import { FLAT_LAND } from './config'
import { energyAt, firstThresholdMinute, waterAt } from './body'
import { startTask } from './tasks'

describe('lazy bodies', () => {
  const state = createValley(FLAT_LAND)
  const person = state.foragers[0]!
  it('integrates short route edges exactly and charges standing after arrival', () => {
    const task = startTask(state.config, person, 'walk', 0, 2, -1, 0, 'going home')
    const routes = [
      {
        segments: [
          { minutes: 1 / 3, timeUnits: 20_000, energyPerHour: 375 },
          { minutes: 7 / 6, timeUnits: 70_000, energyPerHour: 250 },
        ],
      },
    ]
    expect(energyAt(task, 2, routes)).toEqual({ kcal: 65_993, remainder: 41, timeRemainder: 40_000 })
    expect(waterAt(task, 2, routes)).toMatchObject({ ml: 6, activityRemainder: 41, timeRemainder: 40_000 })
  })
  it('equals minute accumulation including existing remainders', () => {
    const task = { ...startTask(state.config, person, 'pick', 0, 600, 0, -1, 'foraging'), startEnergyRemainder: 17 }
    let kcal = 66_000,
      remainder = 17
    for (let minute = 1; minute <= 600; minute += 1) {
      const owed = 200 + remainder
      kcal -= Math.floor(owed / 60)
      remainder = owed % 60
      expect(energyAt(task, minute)).toEqual({ kcal, remainder })
    }
  })
  it('finds the exact first threshold minute', () => {
    const task = { ...startTask(state.config, person, 'pick', 0, 60, 0, -1, 'foraging'), startEnergyKcal: 64_010 }
    expect(firstThresholdMinute(state.config, task)?.minute).toBe(4)
  })
  it('records both fatal causes when they coincide', () => {
    const task = {
      ...startTask(state.config, person, 'rest', 0, 60, -1, -1, 'satiated'),
      startEnergyKcal: 30,
      energyPerHour: 60,
      startWaterMl: 5_970,
      waterBaseMlPerDay: 1_440,
      waterExtraMlPerKcal: 0,
    }
    expect(firstThresholdMinute(state.config, task)).toMatchObject({
      minute: 30,
      causes: ['fatal energy', 'fatal water'],
    })
  })
  it('loses exactly 2,000 ml in a resting day', () => {
    const task = startTask(state.config, person, 'rest', 0, 1_440, -1, -1, 'satiated')
    expect(waterAt(task, 1_440).ml).toBe(2_000)
  })
  it('carries base and activity fractions independently', () => {
    const task = startTask(state.config, person, 'pick', 0, 600, 0, -1, 'foraging')
    for (let minute = 1; minute <= 600; minute += 1)
      expect(waterAt(task, minute).ml).toBe(Math.floor((2_000 * minute) / 1_440) + Math.floor((110 * minute) / 60))
  })
})

it('adds 440 millilitres for four hours picking to the two-litre resting day', () => {
  const s = createValley(FLAT_LAND),
    p = s.foragers[0]!,
    task = startTask(s.config, p, 'pick', 0, 240, 0, -1, 'foraging'),
    first = waterAt(task, 240)
  p.waterDeficitMl = first.ml
  p.waterBaseRemainder = first.remainder
  p.waterActivityRemainder = first.activityRemainder
  p.waterTimeRemainder = first.timeRemainder
  const rest = startTask(s.config, p, 'rest', 240, 1440, -1, -1, 'satiated')
  expect(waterAt(rest, 1440).ml).toBe(2440)
})
