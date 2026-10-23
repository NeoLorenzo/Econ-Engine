import { bankWaterHeight, bankCircleWet } from './banks'
import { ringOffset } from './config'
import { routeFor } from './forager'
import { routeNode } from './routes'
import { distanceSq } from './geometry'
import { cellOf } from './terrain'
import type { DissolveEvent, Forager, Group, GroupEvent, Point, ValleyConfig, ValleyLayout, ValleyState } from './types'

export function nearestOther(forager: Forager, foragers: readonly Forager[], radius: number) {
  let best: Forager | null = null
  let bestSq = radius * radius
  for (const other of foragers) {
    if (!other.alive || other.id === forager.id) continue
    const sq = distanceSq(forager.x, forager.y, other.x, other.y)
    if (sq < bestSq || (sq === bestSq && (best === null || other.id < best.id))) {
      best = other
      bestSq = sq
    }
  }
  return best
}

/** Slot `slot` of the rings round a flag, where a member's hut stands and it sleeps, moved to the valley's edge if needed. */
export function hearthAround(config: ValleyConfig, flag: Point, slot: number): Point {
  const offset = ringOffset(config, slot)
  const clamp = (value: number) => Math.max(0, Math.min(config.valleySizeCm, value))
  return { x: clamp(flag.x + offset.x), y: clamp(flag.y + offset.y) }
}

/** A group just founded at `flag`, with no members yet and an empty, unlit fire. */
export const newGroup = (id: number, flag: Point, minute: number): Group => ({
  id,
  flag: { ...flag },
  foundedMinute: minute,
  dissolvedMinute: null,
  members: [],
  hearthSlots: [],
  fireWood: 0,
  fireLit: false,
  given: [],
  fireBurned: 0,
  litHours: 0,
  darkHours: 0,
})

/** The groups a band starts with: none when scattered, otherwise the whole band as one group around the camp. */
export function startingGroups(config: ValleyConfig, layout: ValleyLayout, foragers: Forager[]): Group[] {
  if (config.scattered) return []
  for (const forager of foragers) {
    forager.groupId = 0
    forager.joinedMinute = 0
    forager.knownFlags = [0]
  }
  return [
    {
      ...newGroup(0, layout.camp, 0),
      members: foragers.map((f) => f.id),
      hearthSlots: foragers.map((f) => f.id),
      given: foragers.map(() => 0),
    },
  ]
}

function availableSlot(state: ValleyState, group: Group, forager: Forager) {
  const config = state.config
  const maximumRing = Math.ceil(config.perceptionRadiusCm / config.hutRingCm)
  const maximumSlots = 4 * maximumRing * (maximumRing + 1)
  for (let slot = 0; slot < maximumSlots; slot += 1) {
    if (group.hearthSlots.includes(slot)) continue
    const point = hearthAround(config, group.flag, slot)
    if (!bankCircleWet(state.layout.lattice.banks, point, 100) && routeFor(state, forager, point)) return slot
  }
  return null
}

const join = (config: ValleyConfig, group: Group, forager: Forager, minute: number, slot: number) => {
  forager.groupId = group.id
  forager.joinedMinute = minute
  forager.hearth = hearthAround(config, group.flag, slot)
  group.hearthSlots = [...group.hearthSlots, slot]
  group.members = [...group.members, forager.id]
  group.given = [...group.given, 0]
  if (!forager.knownFlags.includes(group.id)) forager.knownFlags = [...forager.knownFlags, group.id]
}

/**
 * A forager without a group meets the nearest living forager within talking distance, if any: it joins a member's
 * group, or founds a new group with another forager without one, with the flag at their midpoint. Changes the state's
 * working copies in place.
 */
export function meet(state: ValleyState, forager: Forager, minute: number): Exclude<GroupEvent, DissolveEvent> | null {
  const { config } = state
  if (forager.groupId !== null) return null
  const seen = state.foragers
    .filter((person) => forager.metMinute[person.id] === minute)
    .map((person) => ({ ...person, ...forager.metPosition.get(person.id)! }))
  const nearest = nearestOther(forager, seen, config.talkRadiusCm)
  const other = nearest ? state.foragers[nearest.id]! : null
  if (!other) return null
  if (other.groupId !== null) {
    const group = state.groups[other.groupId]!
    const slot = availableSlot(state, group, forager)
    if (slot === null) return null
    join(config, group, forager, minute, slot)
    return {
      kind: 'join',
      minute,
      groupId: other.groupId,
      foragerId: forager.id,
      metId: other.id,
      hearth: forager.hearth,
    }
  }
  const observed = forager.metPosition.get(other.id)!
  const flag = { x: Math.floor((forager.x + observed.x) / 2), y: Math.floor((forager.y + observed.y) / 2) }
  const water = state.layout.terrain.water
  if (
    water.shore
      ? bankWaterHeight(water.shore, flag, water.level) !== null
      : water.body[cellOf(state.layout.terrain, flag.x, flag.y)]! >= 0
  )
    return null
  const group = newGroup(state.groups.length, flag, minute)
  if (
    bankCircleWet(state.layout.lattice.banks, flag, 100) ||
    routeNode(state.layout.lattice, forager.knowledge, flag) < 0 ||
    routeNode(state.layout.lattice, other.knowledge, flag) < 0
  )
    return null
  const firstSlot = availableSlot(state, group, forager)
  if (firstSlot === null) return null
  group.hearthSlots = [firstSlot]
  const otherSlot = availableSlot(state, group, other)
  group.hearthSlots = []
  if (otherSlot === null) return null
  state.groups.push(group)
  join(config, group, forager, minute, firstSlot)
  join(config, group, other, minute, otherSlot)
  return {
    kind: 'found',
    minute,
    groupId: group.id,
    flag: group.flag,
    founderIds: [forager.id, other.id],
    hearths: [forager.hearth, other.hearth],
  }
}

/** The members of a group still alive and in it. */
export const livingMembers = (state: Pick<ValleyState, 'foragers'>, group: Group) =>
  group.members.filter((id) => {
    const member = state.foragers[id]!
    return member.alive && member.groupId === group.id
  })

/**
 * Dissolves a group left with one living member or none: its flag comes down and the survivor is without a group. The
 * survivor takes back the wood in the group's fire; with no survivor, it stays in the cold fire.
 */
export function dissolveIfAlone(state: ValleyState, groupId: number, minute: number): DissolveEvent | null {
  const group = state.groups[groupId]!
  if (group.dissolvedMinute !== null) return null
  const living = livingMembers(state, group)
  if (living.length > 1) return null
  group.dissolvedMinute = minute
  group.fireLit = false
  for (const id of living) {
    state.foragers[id]!.groupId = null
    state.foragers[id]!.joinedMinute = null
  }
  const survivor = living.length ? state.foragers[living[0]!]! : null
  const fireWood = survivor ? group.fireWood : 0
  if (survivor) {
    survivor.wood += fireWood
    group.fireWood = 0
  }
  return { kind: 'dissolve', minute, groupId, survivorId: survivor?.id ?? null, fireWood }
}
