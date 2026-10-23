import { bankApproach } from './banks'
import { waterThresholds } from './body'
import { placesWithin, placeAt } from './places'
import { chunkOf, nodePoint, TIME_UNITS_PER_MINUTE, type Route, type RouteLattice } from './routes'
import { heightAt } from './terrain'
import { positionAt } from './tasks'
import type { BankMemory, Forager, Point, ValleyState } from './types'

export interface ObservationEvent {
  kind: 'observe'
  minute: number
  foragerId: number
  origin: Point
  places: number[]
  nodes: number[]
  banks: BankMemory[]
  people: number[]
  stock: { placeId: number; food: number; wood: number; logs: number; stones: number } | null
}
export const peopleInChunk = (state: ValleyState, chunk: number): number[] => [...(state.peopleByChunk[chunk] ?? [])]
export function reindexPeople(state: ValleyState, minute: number): void {
  const buckets: number[][] = Array.from({ length: state.layout.lattice.chunkCells ** 2 }, () => [])
  for (const person of state.foragers)
    if (person.alive) {
      const point = positionAt(state, person, minute)
      buckets[chunkOf(state.layout.lattice, point)]!.push(person.id)
    }
  state.peopleByChunk = buckets.map((ids) => Int32Array.from(ids))
}
const bankCache = new WeakMap<ValleyState['layout'], { banks: BankMemory[]; chunks: Map<number, BankMemory[]> }>()
function banksOf(state: ValleyState) {
  let cached = bankCache.get(state.layout)
  if (cached) return cached
  const { lattice, terrain } = state.layout,
    { config } = state
  const banks: BankMemory[] = [],
    chunks = new Map<number, BankMemory[]>()
  for (const segment of lattice.banks.segments.values()) {
    const bank = bankApproach(
      lattice.banks,
      segment,
      config.reachCm,
      config.drinkBankHeightCm,
      (x, y) => heightAt(terrain, x, y),
      terrain.water.bodies[segment.body]!.id,
      0,
    )
    if (!bank) continue
    banks.push(bank)
    const chunk = chunkOf(lattice, bank),
      list = chunks.get(chunk) ?? []
    list.push(bank)
    chunks.set(chunk, list)
  }
  cached = { banks, chunks }
  bankCache.set(state.layout, cached)
  return cached
}
export function observeAt(state: ValleyState, person: Forager, minute: number): ObservationEvent {
  const { layout, config } = state,
    { lattice } = layout
  const origin = positionAt(state, person, minute),
    radius = config.sightRadiusCm,
    sq = radius ** 2
  const observation: ObservationEvent = {
    kind: 'observe',
    minute,
    foragerId: person.id,
    origin,
    places: placesWithin(layout, origin.x, origin.y, radius),
    nodes: [],
    banks: [],
    people: [],
    stock: null,
  }
  for (const id of observation.places) person.knownPlaces[id] = minute
  const placeId = placeAt(layout, origin.x, origin.y)
  if (placeId >= 0) {
    const kind = layout.places.kind[placeId]
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
  const full = (person.knowledge.fullyKnown ??= new Uint8Array(lattice.chunkCells ** 2))
  const banks = banksOf(state)
  for (
    let cy = Math.max(0, Math.floor((origin.y - radius) / lattice.chunkCm));
    cy <= Math.min(lattice.chunkCells - 1, Math.floor((origin.y + radius) / lattice.chunkCm));
    cy += 1
  )
    for (
      let cx = Math.max(0, Math.floor((origin.x - radius) / lattice.chunkCm));
      cx <= Math.min(lattice.chunkCells - 1, Math.floor((origin.x + radius) / lattice.chunkCm));
      cx += 1
    ) {
      const chunk = cy * lattice.chunkCells + cx
      for (const bank of banks.chunks.get(chunk) ?? [])
        if (!person.knownBanks.has(bank.id) && (bank.x - origin.x) ** 2 + (bank.y - origin.y) ** 2 <= sq) {
          const memory = { ...bank, minute }
          person.knownBanks.set(bank.id, memory)
          observation.banks.push(memory)
        }
      if (full[chunk]) continue
      const firstX = (cx * lattice.chunkCm) / lattice.cellCm,
        firstY = (cy * lattice.chunkCm) / lattice.cellCm
      const lastX = Math.min(lattice.cells, firstX + lattice.chunkCm / lattice.cellCm),
        lastY = Math.min(lattice.cells, firstY + lattice.chunkCm / lattice.cellCm)
      let complete = true
      for (let y = firstY; y < lastY; y += 1)
        for (let x = firstX; x < lastX; x += 1) {
          const id = y * lattice.cells + x
          if (person.knowledge.nodes[id]) continue
          const point = nodePoint(lattice, id)
          if ((point.x - origin.x) ** 2 + (point.y - origin.y) ** 2 <= sq) {
            person.knowledge.nodes[id] = 1
            observation.nodes.push(id)
          } else complete = false
        }
      if (complete) full[chunk] = 1
    }
  if (observation.nodes.length) person.knowledge.revision += 1
  // The index records each person's last wake-up; route entry notifications keep moving entries local.
  const talk = config.talkRadiusCm
  const candidates = new Set<number>()
  for (
    let y = Math.max(0, Math.floor((origin.y - talk) / lattice.chunkCm));
    y <= Math.min(lattice.chunkCells - 1, Math.floor((origin.y + talk) / lattice.chunkCm));
    y += 1
  )
    for (
      let x = Math.max(0, Math.floor((origin.x - talk) / lattice.chunkCm));
      x <= Math.min(lattice.chunkCells - 1, Math.floor((origin.x + talk) / lattice.chunkCm));
      x += 1
    )
      for (const id of state.peopleByChunk[y * lattice.chunkCells + x] ?? []) candidates.add(id)
  for (const id of [...candidates].sort((a, b) => a - b)) {
    const other = state.foragers[id]!
    if (id === person.id || !other.alive) continue
    const point = positionAt(state, other, minute)
    if ((point.x - origin.x) ** 2 + (point.y - origin.y) ** 2 > talk ** 2) continue
    person.metMinute[id] = minute
    person.metPosition.set(id, point)
    observation.people.push(id)
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
export function chunksOfRoute(lattice: RouteLattice, route: Route): { chunk: number; minute: number }[] {
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
        let line = (Math.floor(Math.min(a!, b!) / lattice.chunkCm) + 1) * lattice.chunkCm;
        line < Math.max(a!, b!);
        line += lattice.chunkCm
      )
        cuts.push((line - a!) / (b! - a!))
    }
    cuts.sort((a, b) => a - b)
    add(chunkOf(lattice, { x: segment.x0, y: segment.y0 }), units)
    for (let i = 1; i < cuts.length; i += 1) {
      const t = (cuts[i - 1]! + cuts[i]!) / 2
      add(
        chunkOf(lattice, { x: segment.x0 + t * dx, y: segment.y0 + t * dy }),
        units + cuts[i - 1]! * segment.timeUnits,
      )
    }
    units += segment.timeUnits
    add(chunkOf(lattice, { x: segment.x1, y: segment.y1 }), units)
  }
  return result
}
export function scheduleArrivals(state: ValleyState, walkerId: number, route: Route, startMinute: number): void {
  const walker = state.foragers[walkerId]!,
    fatal = waterThresholds(state.config).urgent
  for (const entry of chunksOfRoute(state.layout.lattice, route)) {
    const minute = startMinute + entry.minute
    state.queue.schedule({
      minute,
      phase: 1,
      id: walkerId,
      kind: 'arrival',
      walkerId,
      chunk: entry.chunk,
      routeId: walker.task?.routeId ?? -1,
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
      })
    }
  }
}
