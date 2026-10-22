import { describe, expect, it } from 'vitest'
import { CellHeap } from './water'

describe('cell priority queue', () => {
  it('preserves priority and cell-ID ordering through growth, duplicates, reuse and reprioritization', () => {
    const heap = new CellHeap()
    const entries = Array.from({ length: 701 }, (_, index) => ({ id: index % 97, priority: ((index * 31) % 101) - 50 }))
    const sorted = [...entries].sort((a, b) => a.priority - b.priority || a.id - b.id)
    for (const entry of entries) heap.push(entry.id, entry.priority)
    for (const expected of sorted) {
      expect(heap.minPriority).toBe(expected.priority)
      expect(heap.popId()).toBe(expected.id)
    }
    expect(heap.length).toBe(0)
    expect(heap.minPriority).toBe(Infinity)
    for (const entry of entries) heap.push(entry.id, entry.priority)
    heap.reprioritize((id) => (id % 3 ? (id % 7) - 4 : undefined))
    const reprioritized = [...new Set(entries.map((entry) => entry.id))]
      .filter((id) => id % 3)
      .map((id) => ({ id, priority: (id % 7) - 4 }))
      .sort((a, b) => a.priority - b.priority || a.id - b.id)
    for (const expected of reprioritized) expect(heap.pop()).toEqual(expected)
    for (const entry of entries) heap.push(entry.id, entry.priority)
    heap.clear()
    heap.push(17, -100)
    expect(heap.pop()).toEqual({ id: 17, priority: -100 })
    expect(heap.length).toBe(0)
  })
})
