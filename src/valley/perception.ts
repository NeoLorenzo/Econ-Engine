import { placesWithin, placeAt } from './places'
import {
  carryComponents,
  chunkOf,
  knows,
  learnTriangle,
  TIME_UNITS_PER_MINUTE,
  type Knowledge,
  type NavMap,
  type Route,
} from './routes'
import { positionAt } from './tasks'
import type { BankMemory, Forager, Point, ValleyState } from './types'

export interface ObservationEvent {
  kind: 'observe'
  minute: number
  foragerId: number
  origin: Point
  places: number[]
  triangles: number[]
  banks: BankMemory[]
  people: number[]
  seenPeople: { id: number; position: Point }[]
  stock: { placeId: number; food: number; wood: number; logs: number; stones: number } | null
}
/**
 * Bank memories hold tens of thousands of banks and only grow, so a clone shares its original's map instead of copying
 * it every step. A shared map is copied once, here, before the first bank its holder learns.
 */
const sharedBankMemories = new WeakSet<Map<number, BankMemory>>()
export function shareBankMemory(banks: Map<number, BankMemory>) {
  sharedBankMemories.add(banks)
  return banks
}
export function learnBank(person: Forager, memory: BankMemory) {
  if (sharedBankMemories.has(person.knownBanks)) person.knownBanks = new Map(person.knownBanks)
  person.knownBanks.set(memory.id, memory)
}
/** Route caches only grow too, and are shared and copied the same way, before their holder remembers a new route. */
const sharedRouteCaches = new WeakSet<Map<string, number>>()
export function shareRouteCache(cache: Map<string, number>) {
  sharedRouteCaches.add(cache)
  return cache
}
export function rememberRoute(person: Forager, key: string, routeId: number) {
  if (sharedRouteCaches.has(person.routeCache)) person.routeCache = new Map(person.routeCache)
  person.routeCache.set(key, routeId)
}
/**
 * Triangle knowledge is shared with the previous state in the same way, and copied once before its holder learns a
 * triangle, a chunk seen whole or a chunk of known banks.
 */
const sharedKnowledge = new WeakSet<Knowledge>()
export function shareKnowledge(knowledge: Knowledge) {
  sharedKnowledge.add(knowledge)
  return knowledge
}
export function ownKnowledge(person: Forager) {
  const k = person.knowledge
  if (sharedKnowledge.has(k))
    person.knowledge = {
      triangles: k.triangles.slice(),
      revision: k.revision,
      fullyKnown: k.fullyKnown?.slice(),
      banksKnown: k.banksKnown?.slice(),
    }
  return person.knowledge
}
/** Views already taken from a point: a cache, so its warmth never changes what is learnt. */
const viewsSeen = new WeakMap<Knowledge, Set<string>>()
export const peopleInChunk = (state: ValleyState, chunk: number): number[] => [...(state.peopleByChunk[chunk] ?? [])]
export function reindexPeople(state: ValleyState, minute: number): void {
  const buckets: number[][] = Array.from({ length: state.layout.nav.chunkCells ** 2 }, () => [])
  for (const person of state.foragers)
    if (person.alive) {
      const point = positionAt(state, person, minute)
      buckets[chunkOf(state.layout.nav, point)]!.push(person.id)
    }
  state.peopleByChunk = buckets.map((ids) => Int32Array.from(ids))
}
export function observeAt(state: ValleyState, person: Forager, minute: number): ObservationEvent {
  const { layout, config } = state,
    { nav } = layout,
    { mesh } = nav,
    before = person.knowledge
  const origin = positionAt(state, person, minute),
    radius = config.sightRadiusCm,
    sq = radius ** 2
  const observation: ObservationEvent = {
    kind: 'observe',
    minute,
    foragerId: person.id,
    origin,
    places: placesWithin(layout, origin.x, origin.y, radius),
    triangles: [],
    banks: [],
    people: [],
    seenPeople: [],
    stock: null,
  }
  for (const id of observation.places) person.knownPlaces[id] = minute
  const placeId = placeAt(layout, origin.x, origin.y)
  if (placeId >= 0) {
    const kind = layout.places.kind[placeId]
    person.placeCheckedMinute[placeId] = minute
    person.placeStock[placeId] =
      kind === 0 || kind === 1
        ? state.foodStock[placeId]!
        : kind === 2
          ? state.woodStock[placeId]!
          : state.stoneStock[placeId]!
    person.placeWood[placeId] = state.woodStock[placeId]!
    person.placeLogs[placeId] = state.logStock[placeId]!
    observation.stock = {
      placeId,
      food: state.foodStock[placeId]!,
      wood: state.woodStock[placeId]!,
      logs: state.logStock[placeId]!,
      stones: state.stoneStock[placeId]!,
    }
  }
  const viewKey = `${origin.x},${origin.y}:${radius}`
  if (!viewsSeen.get(person.knowledge)?.has(viewKey))
    for (
      let cy = Math.max(0, Math.floor((origin.y - radius) / nav.chunkCm));
      cy <= Math.min(nav.chunkCells - 1, Math.floor((origin.y + radius) / nav.chunkCm));
      cy += 1
    )
      for (
        let cx = Math.max(0, Math.floor((origin.x - radius) / nav.chunkCm));
        cx <= Math.min(nav.chunkCells - 1, Math.floor((origin.x + radius) / nav.chunkCm));
        cx += 1
      ) {
        const chunk = cy * nav.chunkCells + cx
        if (!person.knowledge.banksKnown?.[chunk])
          for (const bank of nav.bankChunks.get(chunk) ?? [])
            if (!person.knownBanks.has(bank.id) && (bank.x - origin.x) ** 2 + (bank.y - origin.y) ** 2 <= sq) {
              const memory = { ...bank, minute }
              learnBank(person, memory)
              observation.banks.push(memory)
            }
        const dx = Math.max(
          Math.abs(cx * nav.chunkCm - origin.x),
          Math.abs(Math.min(config.valleySizeCm, (cx + 1) * nav.chunkCm) - origin.x),
        )
        const dy = Math.max(
          Math.abs(cy * nav.chunkCm - origin.y),
          Math.abs(Math.min(config.valleySizeCm, (cy + 1) * nav.chunkCm) - origin.y),
        )
        const whole = dx * dx + dy * dy <= sq
        if (whole && !person.knowledge.banksKnown?.[chunk])
          (ownKnowledge(person).banksKnown ??= new Uint8Array(nav.chunkCells ** 2))[chunk] = 1
        if (person.knowledge.fullyKnown?.[chunk]) continue
        // A chunk wholly in sight is marked at once; otherwise each triangle by its centroid.
        let complete = true
        for (let k = mesh.chunkStart[chunk]!; k < mesh.chunkStart[chunk + 1]!; k++) {
          const t = mesh.chunkTriangles[k]!
          if (knows(person.knowledge, t)) continue
          if (whole || (mesh.cx[t]! - origin.x) ** 2 + (mesh.cy[t]! - origin.y) ** 2 <= sq) {
            learnTriangle(ownKnowledge(person), t)
            observation.triangles.push(t)
          } else complete = false
        }
        if (complete) (ownKnowledge(person).fullyKnown ??= new Uint8Array(nav.chunkCells ** 2))[chunk] = 1
      }
  if (observation.triangles.length) person.knowledge.revision += 1
  if (person.knowledge !== before || observation.triangles.length)
    carryComponents(nav, before, person.knowledge, observation.triangles)
  let views = viewsSeen.get(person.knowledge)
  if (!views) viewsSeen.set(person.knowledge, (views = new Set()))
  views.add(viewKey)
  // The index records each person's last wake-up; route entry notifications keep moving entries local.
  const talk = config.sightRadiusCm
  const candidates = new Set<number>()
  for (
    let y = Math.max(0, Math.floor((origin.y - talk) / nav.chunkCm));
    y <= Math.min(nav.chunkCells - 1, Math.floor((origin.y + talk) / nav.chunkCm));
    y += 1
  )
    for (
      let x = Math.max(0, Math.floor((origin.x - talk) / nav.chunkCm));
      x <= Math.min(nav.chunkCells - 1, Math.floor((origin.x + talk) / nav.chunkCm));
      x += 1
    )
      for (const id of state.peopleByChunk[y * nav.chunkCells + x] ?? []) candidates.add(id)
  for (const id of [...candidates].sort((a, b) => a - b)) {
    const other = state.foragers[id]!
    if (id === person.id || !other.alive) continue
    const point = positionAt(state, other, minute)
    if ((point.x - origin.x) ** 2 + (point.y - origin.y) ** 2 > talk ** 2) continue
    observation.seenPeople.push({ id, position: point })
    person.seenMinute[id] = minute
    person.metPosition.set(id, point)
    if ((point.x - origin.x) ** 2 + (point.y - origin.y) ** 2 <= config.talkRadiusCm ** 2) {
      person.metMinute[id] = minute
      observation.people.push(id)
    }
  }
  for (const group of state.groups)
    if (
      group.dissolvedMinute === null &&
      (group.flag.x - origin.x) ** 2 + (group.flag.y - origin.y) ** 2 <= sq &&
      !person.knownFlags.includes(group.id)
    )
      person.knownFlags.push(group.id)
  return observation
}
export function chunksOfRoute(nav: NavMap, route: Route): { chunk: number; minute: number }[] {
  const result: { chunk: number; minute: number }[] = [],
    seen = new Set<number>()
  let units = 0
  const add = (chunk: number, at: number) => {
    if (!seen.has(chunk)) {
      seen.add(chunk)
      result.push({ chunk, minute: Math.floor(at / TIME_UNITS_PER_MINUTE) })
    }
  }
  for (const segment of route.segments) {
    const cuts = [0, 1],
      dx = segment.x1 - segment.x0,
      dy = segment.y1 - segment.y0
    for (const [a, b] of [
      [segment.x0, segment.x1],
      [segment.y0, segment.y1],
    ]) {
      if (a === b) continue
      for (
        let line = (Math.floor(Math.min(a!, b!) / nav.chunkCm) + 1) * nav.chunkCm;
        line < Math.max(a!, b!);
        line += nav.chunkCm
      )
        cuts.push((line - a!) / (b! - a!))
    }
    cuts.sort((a, b) => a - b)
    add(chunkOf(nav, { x: segment.x0, y: segment.y0 }), units)
    for (let i = 1; i < cuts.length; i += 1) {
      const t = (cuts[i - 1]! + cuts[i]!) / 2
      add(chunkOf(nav, { x: segment.x0 + t * dx, y: segment.y0 + t * dy }), units + cuts[i - 1]! * segment.timeUnits)
    }
    units += segment.timeUnits
    add(chunkOf(nav, { x: segment.x1, y: segment.y1 }), units)
  }
  return result
}
export function scheduleArrivals(state: ValleyState, walkerId: number, route: Route, startMinute: number): void {
  const walker = state.foragers[walkerId]!,
    fatal = walker.thirstThresholds.urgent
  // The first entry is the chunk the walk starts in: the walker is already there, so it enters nothing.
  for (const entry of chunksOfRoute(state.layout.nav, route).slice(1)) {
    const minute = startMinute + entry.minute
    state.queue.schedule({
      minute,
      phase: 1,
      id: walkerId,
      kind: 'arrival',
      walkerId,
      chunk: entry.chunk,
      routeId: walker.task?.routeId ?? -1,
      walkStartMinute: startMinute,
    })
    for (const id of peopleInChunk(state, entry.chunk)) {
      if (id === walkerId) continue
      const person = state.foragers[id]!
      if (!person.alive || (person.task?.kind === 'sleep' && person.waterDeficitMl < fatal)) continue
      state.queue.schedule({
        minute,
        phase: 1,
        id,
        kind: 'arrival',
        walkerId,
        chunk: entry.chunk,
        routeId: walker.task?.routeId ?? -1,
        walkStartMinute: startMinute,
      })
    }
  }
}
