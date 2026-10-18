import { MINUTES_PER_DAY, atHearth } from './forager'
import type { AbandonEvent, Forager, Hut, ValleyState, WeatherEvent } from './types'

// Life 9's huts: each member wants a whole hut of `hutLogs` logs at its hearth, its slot on the rings round its
// group's fire. Logs are laid one at a time by their builder, and every hut loses a log to the weather every
// `hutLogDays` days. A tree is felled whole, cut up where it lies, and grows back from its stump.

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

/** Whether a tree felled at `felledMinute` with `logs` left grows back at midnight `minute`. */
export const regrowsAt = (config: ValleyState['config'], felledMinute: number, logs: number, minute: number) =>
  felledMinute >= 0 && logs === 0 && minute - felledMinute >= config.treeRegrowthDays * MINUTES_PER_DAY

/**
 * Midnight: every felled tree with no logs left, felled at least `treeRegrowthDays` ago, stands again whole, with
 * `logsPerTree` logs; branches still lying there become its crown's. Returns the logs regrown.
 */
export function regrowTrees(state: ValleyState, minute: number) {
  let regrown = 0
  for (let id = 0; id < state.treeLogs.length; id += 1) {
    if (!regrowsAt(state.config, state.treeFelledMinute[id]!, state.treeLogs[id]!, minute)) continue
    state.treeLogs[id] = state.config.logsPerTree
    state.treeFelledMinute[id] = -1
    regrown += state.config.logsPerTree
  }
  return regrown
}

/** Whether a tree stands: it holds every log until it is felled. */
export const treeStands = (state: Pick<ValleyState, 'treeFelledMinute'>, id: number) => state.treeFelledMinute[id]! < 0
