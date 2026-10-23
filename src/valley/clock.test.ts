import { describe, expect, it } from 'vitest'
import { WakeQueue, type WakeEntry } from './clock'
import { createValley, stepValley } from './engine'
import { FLAT_LAND } from './config'

describe('wake-up queue', () => {
  const entries: WakeEntry[] = [
    { minute: 5, phase: 1, id: 3, kind: 'end' },
    { minute: 5, phase: 0, id: 0, kind: 'world' },
    { minute: 5, phase: 1, id: 3, kind: 'threshold' },
    { minute: 4, phase: 1, id: 7, kind: 'end' },
  ]
  const drain = (queue: WakeQueue) => {
    const result: WakeEntry[] = []
    while (queue.size) result.push(queue.pop()!)
    return result
  }
  it('orders by minute, phase, id and kind, regardless of insertion order', () => {
    const a = new WakeQueue()
    const b = new WakeQueue()
    entries.forEach((entry) => a.schedule(entry))
    entries.toReversed().forEach((entry) => b.schedule(entry))
    const expected = [entries[3], entries[1], entries[0], entries[2]]
    expect(drain(a)).toEqual(expected)
    expect(drain(b)).toEqual(expected)
    expect(a.peek()).toBeNull()
  })
  it('cancels only the requested person and optionally kind', () => {
    const queue = new WakeQueue()
    entries.forEach((entry) => queue.schedule(entry))
    queue.cancelPerson(3, 'threshold')
    expect(queue.entriesOf(3)).toEqual([entries[0]])
    queue.cancelPerson(3)
    expect(drain(queue)).toEqual([entries[3], entries[1]])
  })
  it('clones without sharing mutable records', () => {
    const queue = new WakeQueue()
    queue.schedule(entries[0]!)
    const copy = queue.clone()
    copy.pop()!.minute = 100
    expect(queue.peek()!.minute).toBe(5)
  })
  it('advancing zero minutes changes nothing and never mutates its input', () => {
    const state = createValley(FLAT_LAND)
    const before = JSON.stringify(state)
    const same = stepValley(state, state.minute)
    expect(same.lastInterval).toEqual([])
    expect(JSON.stringify(same)).toBe(before)
    expect(JSON.stringify(state)).toBe(before)
  })
})
