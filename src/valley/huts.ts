import { MINUTES_PER_DAY, atHearth } from './forager'
import type { AbandonEvent, Forager, Hut, ValleyState, WeatherEvent } from './types'

// Life 9's huts: each member wants a whole hut of `hutLogs` logs at its hearth. Logs are laid one at a time by their
// builder, and every hut loses a log to the weather every `hutLogDays` days. Trees regrow their logs slowly.

/** A forager's hut, while it stands at its hearth. */
export const hutOf = (state: Pick<ValleyState, 'huts'>, forager: Forager): Hut | null =>
  forager.hutId === null ? null : state.huts[forager.hutId]!

/** Whether a forager's hut stands at its hearth with every log. */
export function hutWhole(state: Pick<ValleyState, 'huts' | 'config'>, forager: Forager) {
  const hut = hutOf(state, forager)
  return hut !== null && hut.logs >= state.config.hutLogs && hut.x === forager.hearth.x && hut.y === forager.hearth.y
}

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

/** Midnight on every `logRegrowthDays`-th day: each tree short of logs regrows one. Returns the logs regrown. */
export function regrowLogs(state: ValleyState, minute: number) {
  const day = minute / MINUTES_PER_DAY
  if (day % state.config.logRegrowthDays !== 0) return 0
  let regrown = 0
  for (let id = 0; id < state.treeLogs.length; id += 1) {
    if (state.treeLogs[id]! >= state.config.logsPerTree) continue
    state.treeLogs[id]! += 1
    regrown += 1
  }
  return regrown
}
