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
}
export const WAKE_ORDER: readonly WakeKind[] = ['world', 'end', 'threshold', 'arrival', 'address']

const compare = (a: WakeEntry, b: WakeEntry) =>
  a.minute - b.minute || a.phase - b.phase || a.id - b.id || WAKE_ORDER.indexOf(a.kind) - WAKE_ORDER.indexOf(b.kind)

export class WakeQueue {
  private heap: WakeEntry[] = []
  get size() {
    return this.heap.length
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
    return this.heap[0] ?? null
  }
  pop(): WakeEntry | null {
    if (!this.heap.length) return null
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
    const kept = this.heap.filter(
      (entry) => entry.phase !== 1 || entry.id !== id || (kind !== undefined && entry.kind !== kind),
    )
    this.heap = []
    for (const entry of kept) this.schedule(entry)
  }
  entriesOf(id: number): WakeEntry[] {
    return this.heap
      .filter((entry) => entry.phase === 1 && entry.id === id)
      .map((entry) => ({ ...entry }))
      .sort(compare)
  }
  clone(): WakeQueue {
    const queue = new WakeQueue()
    queue.heap = this.heap.map((entry) => ({ ...entry }))
    return queue
  }
}
