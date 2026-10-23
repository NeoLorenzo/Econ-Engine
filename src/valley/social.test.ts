import { startTask } from './tasks'
import { describe, expect, it } from 'vitest'
import { createValley, stepValley } from './engine'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'
import { reindexPeople } from './perception'
import { swap } from './trade'

describe('meetings and exchange at wake-ups', () => {
  it('wakes a counterparty in the same minute when an exchange changes its load', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 })
    state.minute = 600
    state.queue = new WakeQueue()
    const [seller, buyer] = state.foragers
    seller!.forageRate = 600
    seller!.woodRate = 20
    seller!.wood = 40
    seller!.energyKcal = 60_000
    buyer!.forageRate = 1_200
    buyer!.woodRate = 10
    buyer!.wood = 0
    buyer!.energyKcal = 69_000
    buyer!.carried = [{ food: 'nuts', kcal: 5_000, harvestTick: 100 }]
    for (const person of state.foragers) person.knowledge.nodes.fill(1)
    buyer!.lastWakeMinute = 590
    buyer!.task = startTask(state.config, buyer!, 'rest', 590, 650, -1, -1, 'waiting to swap')
    state.queue.schedule({ minute: 600, phase: 1, id: 0, kind: 'end' })
    state.queue.schedule({ minute: 650, phase: 1, id: 1, kind: 'end' })
    const next = stepValley(state, 601)
    expect(next.lastInterval.some((event) => event.kind === 'exchange')).toBe(true)
    expect(next.totals.wakeUps).toBeGreaterThan(1)
    expect(next.foragers[1]!.lastWakeMinute).toBe(600)
    expect(next.foragers[0]!.lastWakeMinute).toBe(600)
  })
  it('founds a group through a meeting without moving either person', () => {
    const state = createValley({ ...FLAT_LAND, bandSize: 2 })
    state.minute = 600
    state.queue = new WakeQueue()
    for (const person of state.foragers) {
      person.x = 40_000 + person.id * 1_000
      person.y = 40_000
      person.wood = 24
      person.shortOfWood = false
      person.knowledge.nodes.fill(1)
      state.queue.schedule({ minute: 600, phase: 1, id: person.id, kind: 'end' })
    }
    reindexPeople(state, 600)
    const next = stepValley(state, 601)
    expect(next.groups).toHaveLength(1)
    expect(next.groups[0]!.flag).toEqual({ x: 40_500, y: 40_000 })
    expect(next.groups[0]!.members).toEqual([0, 1])
    expect(next.foragers.map((p) => [p.x, p.y])).toEqual([
      [40_000, 40_000],
      [41_000, 40_000],
    ])
    expect(next.lastInterval.some((event) => event.kind === 'group-founded')).toBe(true)
  })
  it('dissolves after a death and returns fire wood to the survivor', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 })
    state.minute = 600
    state.queue = new WakeQueue()
    state.groups[0]!.fireWood = 5
    state.foragers[1]!.energyKcal = 0
    state.queue.schedule({ minute: 600, phase: 1, id: 1, kind: 'end' })
    const next = stepValley(state, 601)
    expect(next.groups[0]!.dissolvedMinute).toBe(600)
    expect(next.foragers[0]!.groupId).toBeNull()
    expect(next.foragers[0]!.wood).toBe(5)
  })
  it('conserves wood and timestamped food in a mutually worthwhile swap', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 }),
      [seller, buyer] = state.foragers
    seller!.forageRate = 600
    seller!.woodRate = 20
    seller!.wood = 40
    seller!.energyKcal = 60_000
    buyer!.forageRate = 1_200
    buyer!.woodRate = 10
    buyer!.wood = 0
    buyer!.carried = [{ food: 'nuts', kcal: 5_000, harvestTick: 100 }]
    const result = swap(state.config, seller!, state.foragers, 600)
    expect(result.swaps).toHaveLength(1)
    expect(seller!.wood + buyer!.wood).toBe(40)
    expect([...seller!.carried, ...buyer!.carried].reduce((sum, lot) => sum + lot.kcal, 0)).toBe(5_000)
    expect(seller!.carried[0]!.harvestTick).toBe(100)
  })
})
