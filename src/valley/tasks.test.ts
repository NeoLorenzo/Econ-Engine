import { loadOf, loadKg, speedForLoad } from './forager'
import { describe, expect, it } from 'vitest'
import { createSurveyedValley as createValley } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { startTask, taskRates } from './tasks'

describe('tasks', () => {
  const state = createValley(FLAT_LAND)
  const person = state.foragers[0]!
  it('assigns each task its existing hourly energy cost', () => {
    for (const [kind, expected] of [
      ['rest', 90],
      ['drink', 90],
      ['pick', 200],
      ['nuts', 200],
      ['fish', 200],
      ['gather', 250],
      ['cut', 360],
      ['make', 150],
      ['walk', 250],
    ] as const)
      expect(taskRates(state.config, person, kind, 'cold').energyPerHour).toBe(expected)
    expect(taskRates(state.config, person, 'sleep', 'fire and hut').energyPerHour).toBe(60)
    expect(taskRates(state.config, person, 'sleep', 'cold').energyPerHour).toBe(90)
  })
  it('counts the current trip load, food and log without counting home wood', () => {
    const loaded = {
      ...person,
      wood: 4,
      tripWood: 9,
      log: 1,
      carried: [
        { food: 'berries' as const, kcal: 1_200, harvestTick: 0 },
        { food: 'nuts' as const, kcal: 2_500, harvestTick: 0 },
        { food: 'fish' as const, kcal: 600, harvestTick: 0 },
      ],
    }
    expect(loadOf(loaded).wood).toBe(4)
    expect(loadKg(state.config, loadOf(loaded))).toBe(43)
    expect(speedForLoad(state.config, 30)).toBe(120)
    expect(speedForLoad(state.config, 35)).toBe(119)
  })
  it('captures the body without mutating its owner', () => {
    const before = JSON.stringify(person)
    const task = startTask(state.config, person, 'rest', 5, 65, -1, -1, 'satiated')
    expect(task).toMatchObject({ startMinute: 5, endMinute: 65, startEnergyKcal: 66_000 })
    expect(JSON.stringify(person)).toBe(before)
  })
})
