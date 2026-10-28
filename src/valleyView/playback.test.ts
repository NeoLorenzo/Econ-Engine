import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from '../valley/config'
import { stepValley } from '../valley/engine'
import { createSurveyedValley } from '../valley/ruleFixtures'
import {
  advancePlayback,
  changeSpeed,
  foragerPose,
  LEAD_SECONDS,
  mapSpeedMinutesPerSecond,
  receiveState,
  routePoints,
  startPlayback,
  stepPlayback,
  strideOf,
  VALLEY_SPEEDS,
  type Playback,
  type ValleySpeed,
} from './valleyViewModel'
import type { ValleyState } from '../valley/types'

const first = () => createSurveyedValley({ ...FLAT_LAND, founders: 2 })

/** The engine's thread, answering at once: it runs to the goal, sending a state every `stride` minutes. */
function answer(playback: Playback, engine: { state: ValleyState }, stride: number) {
  while (engine.state.minute < playback.goal) {
    engine.state = stepValley(engine.state, Math.min(playback.goal, engine.state.minute + stride))
    playback = receiveState(playback, engine.state)
  }
  return playback
}

/** Plays frames of `elapsed` seconds at `speed`, as the page does, with an engine that keeps up. */
function* play(state: ValleyState, speed: Pick<ValleySpeed, 'minutesPerSecond'>, frames: Iterable<number>) {
  const engine = { state }
  let playback = startPlayback(state)
  for (const elapsed of frames) {
    const advanced = advancePlayback(playback, elapsed, speed, true)
    playback = answer(advanced.playback, engine, strideOf(speed))
    yield { display: advanced.display, playback: advanced.playback }
  }
}

/** The distance from `point` to the nearest segment of the polyline `points`. */
function distanceToPath(point: { x: number; y: number }, points: readonly { x: number; y: number }[]) {
  let best = Infinity
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!,
      b = points[i]!
    const dx = b.x - a.x,
      dy = b.y - a.y
    const length = dx * dx + dy * dy
    const t = length === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length))
    best = Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)))
  }
  return best
}

describe('drawing people from task records', () => {
  it('draws within the minute after the state drawn, never goes back, and asks only the lead ahead', () => {
    for (const minutesPerSecond of [10, 60, 1_440]) {
      let before = 0
      for (const { display, playback } of play(
        first(),
        { minutesPerSecond },
        [0.016, 0.1, 0.25, 3, 0.033, 0.2, 0.016],
      )) {
        expect(display.minute).toBeGreaterThanOrEqual(before)
        expect(display.state.minute).toBeLessThanOrEqual(display.minute)
        expect(display.minute).toBeLessThan(display.state.minute + 1)
        expect(playback.goal).toBeLessThanOrEqual(Math.floor(playback.clock + LEAD_SECONDS * minutesPerSecond))
        before = display.minute
      }
      // With an engine that keeps up and frames at 60 a second, the clock runs at the speed shown.
      // Only the first frame, before the engine has run ahead, waits within the first minute.
      const frames = [...play(first(), { minutesPerSecond }, Array(61).fill(1 / 60))]
      expect(frames.at(-1)!.playback.clock - frames[0]!.playback.clock).toBeCloseTo(minutesPerSecond, 2)
    }
  })

  it('positions lie on the recorded route at every displayed minute', () => {
    let walked = 0
    // Three-tenths of a minute a frame, from midnight through the first morning's walks.
    for (const { display } of play(first(), { minutesPerSecond: 3 }, Array(6_000).fill(0.1))) {
      if (walked >= 40) break
      for (const id of [0, 1]) {
        const task = display.state.foragers[id]!.task
        if (task?.kind !== 'walk' || display.minute < task.startMinute) continue
        const points = routePoints(display.state, id)
        expect(distanceToPath(foragerPose(display, id), points)).toBeLessThanOrEqual(1)
        walked += 1
      }
    }
    expect(walked).toBeGreaterThan(0)
  })

  it('waits within the newest state while the engine is behind, and steps once it has run', () => {
    const state = first()
    let playback = startPlayback(state)
    // No answer: the clock stops short of the next minute.
    for (let frame = 0; frame < 10; frame++)
      playback = advancePlayback(playback, 0.25, { minutesPerSecond: 60 }, true).playback
    expect(playback.clock).toBeLessThan(state.minute + 1)
    expect(playback.goal).toBeGreaterThan(state.minute)
    const engine = { state }
    playback = answer(playback, engine, 1)
    const { playback: moved, display } = advancePlayback(playback, 0.1, { minutesPerSecond: 60 }, true)
    expect(display.state.minute).toBeGreaterThan(state.minute)
    // Paused, Step shows the next minute only once the engine sends it.
    let paused = stepPlayback(moved)
    const wanted = paused.stepTo!
    expect(paused.goal).toBeGreaterThanOrEqual(wanted)
    paused = answer(paused, engine, 1)
    const stepped = advancePlayback(paused, 1, { minutesPerSecond: 60 }, false)
    expect(stepped.display.minute).toBe(wanted)
    expect(stepped.display.state.minute).toBe(wanted)
    // A new speed moves the clock on to the newest state, dropping those sent apart for the old one.
    const changed = changeSpeed(receiveState(stepped.playback, stepValley(engine.state, engine.state.minute + 30)))
    expect(changed.states).toHaveLength(1)
    expect(changed.clock).toBe(changed.states[0]!.minute)
  })

  it('stops drawing people from map speeds up', () => {
    for (const speed of VALLEY_SPEEDS) expect(speed.map).toBe(speed.minutesPerSecond >= mapSpeedMinutesPerSecond)
    expect(VALLEY_SPEEDS.at(-1)!.map).toBe(true)
    expect(VALLEY_SPEEDS[0]!.map).toBe(false)
  })
})
