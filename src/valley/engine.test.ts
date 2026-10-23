import { describe, expect, it } from 'vitest'
import { createValley, stepValley, cloneValley } from './engine'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'

function at(minute: number) {
  const state = createValley({ ...FLAT_LAND, bandSize: 1 })
  state.minute = minute
  state.queue = new WakeQueue()
  state.queue.schedule({ minute, phase: 1, id: 0, kind: 'end' })
  state.queue.schedule({ minute: (Math.floor(minute / 60) + 1) * 60, phase: 0, id: 0, kind: 'world' })
  state.foragers[0]!.knowledge.nodes.fill(1)
  return state
}
describe('wake-up engine', () => {
  it('sleeps from dusk to dawn as one task', () => {
    const state = at(1_080)
    const asleep = stepValley(state, 1_081)
    expect(asleep.foragers[0]!.task).toMatchObject({ kind: 'sleep', startMinute: 1_080, endMinute: 1_800 })
    const night = stepValley(asleep, 1_799)
    expect(night.foragers[0]!.task).toEqual(asleep.foragers[0]!.task)
    expect(night.totals.wakeUps).toBe(1)
  })
  it('walks home as one task and arrives at its recorded minute', () => {
    const state = at(1_080),
      person = state.foragers[0]!
    person.x = person.hearth.x - 6_000
    const walking = stepValley(state, 1_081)
    const task = walking.foragers[0]!.task!
    expect(task.kind).toBe('walk')
    const arrived = stepValley(walking, task.endMinute)
    expect(arrived.foragers[0]!.x).toBe(person.hearth.x)
    expect(arrived.foragers[0]!.y).toBe(person.hearth.y)
    expect(arrived.lastInterval).toContainEqual(expect.objectContaining({ kind: 'task-end', minute: task.endMinute }))
  })
  it('midnight regrowth leaves person queue entries unchanged', () => {
    const state = stepValley(at(1_080), 1_439)
    const pending = state.queue.entriesOf(0)
    const after = stepValley(state, 1_440)
    expect(after.queue.entriesOf(0)).toEqual(pending)
  })
  it('advancing a day at once equals advancing minute by minute and preserves its input', () => {
    const state = createValley({ ...FLAT_LAND, bandSize: 1 }),
      before = cloneValley(state)
    const batch = stepValley(state, 1_440)
    let single = state
    for (let minute = 1; minute <= 1_440; minute += 1) single = stepValley(single, minute)
    batch.lastInterval = []
    single.lastInterval = []
    expect(batch).toEqual(single)
    expect(state).toEqual(before)
  })
})
