import { WakeQueue, type WakeEntry } from '../valley/clock'
import { cloneValley, type Memory } from '../valley/engine'
import type { Route } from '../valley/routes'
import type { Forager, ValleyEvent, ValleyState } from '../valley/types'

/**
 * The engine runs in a worker, and the page draws from view copies of its states. A view copy holds what the page
 * reads: the state as the engine left it, less what the page never reads and would cost seconds to copy between
 * threads. Only the routes of tasks under way, each person's next wake-up in place of the wake-up queue, exchanges,
 * walk records, gifts and refusals among the events, everyone's ties and the followed person's memory are kept up to
 * date.
 *
 * Between threads a copy travels as its changes from the last copy sent, which both sides keep. The worker sends
 * a `Change`; the page applies it to its own last copy. Parts the engine left alone, or recopied unchanged, are not
 * sent, and keep their identity on the page.
 */

/** A view copy as it travels: the wake-up queue is a list of each person's next wake-up. */
export type Wire = Omit<ValleyState, 'queue'> & { queue: (WakeEntry | null)[] }

/**
 * A person's memory, which the page reads only for the person followed. For anyone else a copy keeps the memory the
 * last copy held, so it is not resent; what the page holds of it is stale, and never read.
 */
const MEMORY = [
  'knowledge',
  'ways',
  'knownBanks',
  'knownPlaces',
  'placeCheckedMinute',
  'placeStock',
  'placeWood',
  'placeLogs',
  'fishMemory',
  'metPosition',
] as const satisfies readonly (keyof Memory)[]

/**
 * What a copy holds of a person's memory: the last copy's, or, for the person followed and in the first copy, a copy
 * that shares nothing with the engine's state, which the worker runs on in place. Banks are only ever added, so a
 * bank memory of the same size is the same and is kept.
 */
function viewMemory(person: Forager, followedId: number, last: Forager | undefined): Memory {
  // Everyone's ties are kept current for the relationship graph. A tie is replaced, never changed, so a map holding
  // the same ties is the same, and is kept.
  const ties = last && sameMap(last.ties, person.ties) ? last.ties : new Map(person.ties)
  if (person.id !== followedId && last) {
    const kept = { ties } as Record<(typeof MEMORY)[number] | 'ties', unknown>
    for (const key of MEMORY) kept[key] = last[key]
    return kept as Memory
  }
  const k = person.knowledge
  return {
    knowledge: {
      triangles: k.triangles.slice(),
      revision: k.revision,
      fullyKnown: k.fullyKnown?.slice(),
      banksKnown: k.banksKnown?.slice(),
    },
    ways: person.ways,
    knownBanks: last && last.knownBanks.size === person.knownBanks.size ? last.knownBanks : new Map(person.knownBanks),
    knownPlaces: person.knownPlaces.slice(),
    placeCheckedMinute: person.placeCheckedMinute.slice(),
    placeStock: person.placeStock.slice(),
    placeWood: person.placeWood.slice(),
    placeLogs: person.placeLogs.slice(),
    fishMemory: new Map(person.fishMemory),
    metPosition: new Map(person.metPosition),
    ties,
  }
}

const VIEW_EVENTS = new Set<ValleyEvent['kind']>(['exchange', 'walk', 'gift', 'refusal'])
/** Finished days never change, so each is filtered once. */
const filteredDays = new WeakMap<ValleyEvent[], ValleyEvent[]>()
const viewEvents = (events: ValleyEvent[]) => events.filter((e) => VIEW_EVENTS.has(e.kind))
function viewDay(events: ValleyEvent[], finished: boolean) {
  if (!finished) return viewEvents(events)
  let filtered = filteredDays.get(events)
  if (!filtered) filteredDays.set(events, (filtered = viewEvents(events)))
  return filtered
}

/** The view copy of `state`, with `followedId`'s memory and everyone else's from `previous`, the copy before. */
export function wireOf(state: ValleyState, followedId: number, previous: Wire | null = null): Wire {
  const copy = cloneValley(state, (person) => viewMemory(person, followedId, previous?.foragers[person.id]))
  const routes: Route[] = []
  for (const person of state.foragers) {
    const id = person.task?.routeId ?? -1
    if (id >= 0) routes[id] = state.routes[id]!
  }
  const last = state.eventDays.length - 1
  return {
    ...copy,
    queue: state.foragers.map((person) => state.queue.entriesOf(person.id)[0] ?? null),
    routes,
    lastInterval: state.lastInterval.filter((e) => e.kind === 'exchange'),
    eventDays: state.eventDays.map((day, index) => viewDay(day, index < last)),
  }
}

/** The page's state from a copy: its wake-up queue holds each person's next wake-up. */
const states = new WeakMap<Wire, ValleyState>()
export function stateOf(wire: Wire): ValleyState {
  let state = states.get(wire)
  if (!state) {
    const queue = new WakeQueue()
    for (const entry of wire.queue) if (entry) queue.schedule(entry)
    states.set(wire, (state = { ...wire, queue }))
  }
  return state
}

/**
 * How a value differs from the last one sent: `v` replaces it whole; `p` changes some of its keys (`n`, an array's new
 * length; `d`, keys an object lost). A key missing from `p` is unchanged.
 */
export type Change = { v: unknown } | { p: Record<string, Change>; n?: number; d?: string[] }

const isPlain = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function sameView(a: ArrayBufferView, b: ArrayBufferView) {
  if (a.constructor !== b.constructor || a.byteLength !== b.byteLength) return false
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength),
    y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false
  return true
}

function sameMap(a: Map<unknown, unknown>, b: Map<unknown, unknown>) {
  if (a.size !== b.size) return false
  for (const [key, value] of a) if (!b.has(key) || !Object.is(b.get(key), value)) return false
  return true
}

/** How `next` differs from `prev`, or null if the page's copy of `prev` already equals it. */
export function changeOf(next: unknown, prev: unknown): Change | null {
  if (Object.is(next, prev)) return null
  if (ArrayBuffer.isView(next) && ArrayBuffer.isView(prev)) return sameView(next, prev) ? null : { v: next }
  if (next instanceof Map && prev instanceof Map) return sameMap(next, prev) ? null : { v: next }
  if (Array.isArray(next) && Array.isArray(prev)) {
    const p: Record<string, Change> = {}
    let changed = next.length !== prev.length
    for (let i = 0; i < next.length; i++) {
      const change = changeOf(next[i], prev[i])
      if (change) {
        p[i] = change
        changed = true
      }
    }
    return changed ? { p, n: next.length } : null
  }
  if (isPlain(next) && isPlain(prev)) {
    const p: Record<string, Change> = {}
    let changed = false
    // A key missing and a key set to undefined read the same.
    for (const key in next) {
      const change = changeOf(next[key], prev[key])
      if (change) {
        p[key] = change
        changed = true
      }
    }
    const d = Object.keys(prev).filter((key) => !(key in next) && prev[key] !== undefined)
    if (d.length) return { p, d }
    return changed ? { p } : null
  }
  const kept = (value: unknown) =>
    typeof value !== 'object' || value === null || Array.isArray(value) || isPlain(value) || ArrayBuffer.isView(value)
  if (!kept(next) && !(next instanceof Map))
    throw new Error(`A view copy cannot carry a ${(next as object).constructor.name}`)
  return { v: next }
}

/** `prev` with `change` applied; parts the change leaves alone keep their identity. */
export function applyChange<T>(prev: T, change: Change | null): T {
  if (!change) return prev
  if ('v' in change) return change.v as T
  if (Array.isArray(prev)) {
    const next = prev.slice(0, change.n ?? prev.length)
    next.length = change.n ?? prev.length
    for (const key in change.p) next[Number(key)] = applyChange(prev[Number(key)], change.p[key]!)
    return next as T
  }
  const next: Record<string, unknown> = { ...(prev as Record<string, unknown>) }
  for (const key of change.d ?? []) delete next[key]
  for (const key in change.p) next[key] = applyChange((prev as Record<string, unknown>)[key], change.p[key]!)
  return next as T
}
