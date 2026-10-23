import { describe, expect, it } from 'vitest'
import { createValley, stepValley } from './engine'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'
import { worldWake } from './world'
import { energyAt } from './body'
import { feedAmount, nightHoursLeft } from './fire'

describe('fires on their hourly cadence', () => {
  it('burns shared wood once per night hour and none by day', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 })
    state.groups[0]!.fireWood = 3
    worldWake(state, 1_080)
    expect(state.groups[0]!.fireWood).toBe(2)
    worldWake(state, 1_140)
    expect(state.groups[0]!.fireWood).toBe(1)
    worldWake(state, 360)
    expect(state.groups[0]!.fireWood).toBe(1)
    expect(state.groups[0]!.fireLit).toBe(false)
    expect(state.totals.burnedWood).toBe(2)
  })
  it('changes sleeping energy at the fire boundary without hourly person wake-ups', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 })
    state.minute = 1_080
    state.queue = new WakeQueue()
    state.groups[0]!.fireWood = 1
    state.queue.schedule({ minute: 1_080, phase: 0, id: 0, kind: 'world' })
    for (const person of state.foragers) state.queue.schedule({ minute: 1_080, phase: 1, id: person.id, kind: 'end' })
    const next = stepValley(state, 1_200),
      task = next.foragers[0]!.task!
    expect(task.kind).toBe('sleep')
    expect(energyAt(task, 1_200, next.routes).kcal).toBe(66_000 - 70 - 90)
    expect(next.totals.wakeUps).toBe(2)
  })
  it('keeps the existing contribution rule and night-hour counts', () => {
    const { config } = createValley(FLAT_LAND)
    expect(nightHoursLeft(config, 600)).toBe(12)
    expect(nightHoursLeft(config, 1_080)).toBe(11)
    expect(feedAmount(config, 30, 12, 1, 600).wood).toBe(6)
    expect(feedAmount(config, 10, 0, 1, 600).wood).toBe(10)
  })
})
