export type WakePhase = 0 | 1
export type WakeKind = 'world' | 'end' | 'threshold' | 'arrival' | 'address'
export interface WakeEntry {
  minute: number
  phase: WakePhase
  id: number
  kind: WakeKind
  walkerId?: number
  chunk?: number
  routeId?: number
  walkStartMinute?: number
}
export const WAKE_ORDER: readonly WakeKind[] = ['world', 'end', 'threshold', 'arrival', 'address']

const compare = (a: WakeEntry, b: WakeEntry) =>
  a.minute - b.minute ||
  a.phase - b.phase ||
  a.id - b.id ||
  WAKE_ORDER.indexOf(a.kind) - WAKE_ORDER.indexOf(b.kind) ||
  (a.walkerId ?? -1) - (b.walkerId ?? -1) ||
  (a.chunk ?? -1) - (b.chunk ?? -1) ||
  (a.routeId ?? -1) - (b.routeId ?? -1) ||
  (a.walkStartMinute ?? -1) - (b.walkStartMinute ?? -1)

/**
 * Cancelling marks entries instead of rebuilding the heap, which every wake-up did; a marked entry is dropped when it
 * reaches the front, or when marked entries outnumber the rest. Live entries leave in the same order either way.
 */
export class WakeQueue {
  private heap: WakeEntry[] = []
  private cancelled = new Set<WakeEntry>()
  get size() {
    return this.heap.length - this.cancelled.size
  }
  schedule(entry: WakeEntry): void {
    if (!Number.isSafeInteger(entry.minute) || entry.minute < 0 || !Number.isSafeInteger(entry.id) || entry.id < 0)
      throw new Error('Wake-ups require nonnegative safe integer minutes and ids')
    const value = { ...entry }
    let index = this.heap.length
    this.heap.push(value)
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (compare(this.heap[parent]!, value) <= 0) break
      this.heap[index] = this.heap[parent]!
      index = parent
    }
    this.heap[index] = value
  }
  peek(): WakeEntry | null {
    while (this.heap.length && this.cancelled.has(this.heap[0]!)) {
      this.cancelled.delete(this.heap[0]!)
      this.removeFirst()
    }
    return this.heap[0] ?? null
  }
  pop(): WakeEntry | null {
    return this.peek() ? this.removeFirst() : null
  }
  private removeFirst(): WakeEntry {
    const first = this.heap[0]!
    const last = this.heap.pop()!
    if (this.heap.length) {
      let index = 0
      while (2 * index + 1 < this.heap.length) {
        let child = 2 * index + 1
        if (child + 1 < this.heap.length && compare(this.heap[child + 1]!, this.heap[child]!) < 0) child += 1
        if (compare(last, this.heap[child]!) <= 0) break
        this.heap[index] = this.heap[child]!
        index = child
      }
      this.heap[index] = last
    }
    return first
  }
  cancelPerson(id: number, kind?: WakeKind): void {
    for (const entry of this.heap)
      if (entry.phase === 1 && entry.id === id && (kind === undefined || entry.kind === kind)) this.cancelled.add(entry)
    if (this.cancelled.size > this.heap.length / 2) {
      const kept = this.live()
      this.heap = []
      this.cancelled.clear()
      for (const entry of kept) this.schedule(entry)
    }
  }
  private live() {
    return this.cancelled.size ? this.heap.filter((entry) => !this.cancelled.has(entry)) : this.heap
  }
  entriesOf(id: number): WakeEntry[] {
    return this.live()
      .filter((entry) => entry.phase === 1 && entry.id === id)
      .map((entry) => ({ ...entry }))
      .sort(compare)
  }
  clone(): WakeQueue {
    // The copy keeps the heap's layout and marks, so a copy runs on exactly as its original would.
    const queue = new WakeQueue()
    queue.heap = this.heap.map((entry) => {
      const copy = { ...entry }
      if (this.cancelled.has(entry)) queue.cancelled.add(copy)
      return copy
    })
    return queue
  }
}
