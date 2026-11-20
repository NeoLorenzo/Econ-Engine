import { MINUTES_PER_DAY, atHearth } from './forager'
import type { AbandonEvent, Forager, Hut, ValleyState, WeatherEvent } from './types'

// Life 9's huts: each member wants a whole hut of `hutLogs` logs at its hearth, its slot on the rings round its
// group's fire. Logs are laid one at a time by their builder, and every hut loses a log to the weather every
// `hutLogDays` days. A tree is felled whole, cut up where it lies, and grows back from its stump.

/** A forager's hut, while it stands at its hearth. */
export const hutOf = (state: Pick<ValleyState, 'huts'>, forager: Forager): Hut | null =>
  forager.hutId === null ? null : state.huts[forager.hutId]!

/** Whether a forager's hut stands at its hearth with every log. */
export function hutWhole(
  state: Pick<ValleyState, 'huts' | 'config'> & Partial<Pick<ValleyState, 'foragers'>>,
  forager: Forager,
): boolean {
  const hut = hutOf(state, forager)
  if (hut !== null && hut.logs >= state.config.hutLogs && hut.x === forager.hearth.x && hut.y === forager.hearth.y)
    return true
  // Life 19: a person without a whole hut of their own shelters in a living parent's at the same hearth.
  if (!state.foragers) return false
  for (const parentId of [forager.motherId, forager.fatherId]) {
    if (parentId === null || parentId === undefined) continue
    const parent = state.foragers[parentId]!
    if (parent.alive && parent.hearth.x === forager.hearth.x && parent.hearth.y === forager.hearth.y)
      if (hutWhole({ huts: state.huts, config: state.config }, parent)) return true
  }
  return false
}

/**
 * The people whose whole hut may shelter a person at a minute (Life 19): themselves, and each parent still living then.
 * For the checker, which reads deaths from the interval's records.
 */
export function shelterers(state: Pick<ValleyState, 'foragers' | 'lastInterval'>, id: number, minute: number) {
  const person = state.foragers[id]!
  const living = (other: number) => {
    const death = state.lastInterval.find((e) => e.kind === 'death' && e.foragerId === other)
    return death ? death.minute > minute : state.foragers[other]!.alive
  }
  return [id, ...[person.motherId, person.fatherId].filter((p): p is number => p !== null && living(p))]
}

/** Whether a whole hut shelters a sleeper where they lie: at their hearth, under their own or a parent's (Life 19). */
export const shelteredAt = (state: Pick<ValleyState, 'huts' | 'config' | 'foragers'>, forager: Forager) =>
  forager.x === forager.hearth.x && forager.y === forager.hearth.y && hutWhole(state, forager)

/** The drive for shelter: a member whose hut is not whole wants logs for it. */
export const wantsLogs = (state: Pick<ValleyState, 'huts' | 'config'>, forager: Forager) =>
  forager.groupId !== null && !hutWhole(state, forager)

/**
 * A hut stands where it was begun. If its builder's hearth has moved away from it, the hut is abandoned there and the
 * builder has none. Changes the working copies in place; returns the event, or null.
 */
export function leaveHutIfMoved(state: ValleyState, forager: Forager, minute: number): AbandonEvent | null {
  const hut = hutOf(state, forager)
  if (!hut || (hut.x === forager.hearth.x && hut.y === forager.hearth.y)) return null
  state.huts[hut.id] = { ...hut, abandonedMinute: minute }
  forager.hutId = null
  return { kind: 'abandon', minute, hutId: hut.id, foragerId: forager.id, logs: hut.logs }
}

/**
 * A forager at its hearth carrying a log lays it in its hut, beginning one there if it has none. Changes the working
 * copies in place; returns whether it laid a log.
 */
export function layLog(state: ValleyState, forager: Forager, minute: number) {
  if (!forager.log || !atHearth(forager)) return false
  let hut = hutOf(state, forager)
  if (!hut) {
    hut = {
      id: state.huts.length,
      builderId: forager.id,
      x: forager.hearth.x,
      y: forager.hearth.y,
      logs: 0,
      begunMinute: minute,
      abandonedMinute: null,
    }
    state.huts.push(hut)
    forager.hutId = hut.id
  }
  state.huts[hut.id] = { ...hut, logs: hut.logs + forager.log }
  forager.log = 0
  return true
}

/** Whether hut `hut` weathers on day `day`: its builder's ID staggers the days. */
export const weathersOn = (state: Pick<ValleyState, 'config'>, hut: Hut, day: number) =>
  (day + hut.builderId) % state.config.hutLogDays === 0

/** Midnight: every hut, standing or abandoned, whose day has come loses a log. Returns the events. */
export function weatherHuts(state: ValleyState, minute: number): WeatherEvent[] {
  const day = minute / MINUTES_PER_DAY
  const events: WeatherEvent[] = []
  for (const hut of state.huts) {
    if (hut.logs <= 0 || !weathersOn(state, hut, day)) continue
    state.huts[hut.id] = { ...hut, logs: hut.logs - 1 }
    state.totals.rottedLogs += 1
    events.push({ kind: 'weather', minute, hutId: hut.id, logsAfter: hut.logs - 1 })
  }
  return events
}
