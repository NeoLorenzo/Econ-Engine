import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from '../valley/config'
import { createSurveyedValley } from '../valley/ruleFixtures'
import {
  advanceDisplay,
  foragerPose,
  mapSpeedMinutesPerSecond,
  routePoints,
  SIMULATION_SLICE_MINUTES,
  startDisplay,
  VALLEY_SPEEDS,
  type Display,
} from './valleyViewModel'

const start = () => startDisplay(createSurveyedValley({ ...FLAT_LAND, founders: 2 }))

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
  it('draws within the minute the state has reached, and never goes back', () => {
    let display: Display = start()
    for (const elapsed of [0.016, 0.1, 0.25, 3, 0.033, 0.2]) {
      const before = display.minute
      display = advanceDisplay(display, elapsed, { minutesPerSecond: 10 })
      expect(display.minute).toBeGreaterThanOrEqual(before)
      expect(display.state.minute).toBe(Math.floor(display.minute))
    }
  })

  it('positions lie on the recorded route at every displayed minute', () => {
    let display: Display = start()
    let walked = 0
    for (let frame = 0; frame < 6_000 && walked < 40; frame += 1) {
      // Three-tenths of a minute a frame, from midnight through the first morning's walks.
      display = advanceDisplay(display, 0.1, { minutesPerSecond: 3 })
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

  it('runs the engine in hour steps until the frame budget is spent, and at least one step a frame', () => {
    const ticking = (ms: number) => {
      let t = 0
      return () => (t += ms)
    }
    const start0 = start().state.minute
    // Each clock reading is 10 ms later: four steps fit within 40 ms, and the clock stops at the last one finished.
    let display: Display = advanceDisplay(start(), 0.25, { minutesPerSecond: 1_440 }, 40, ticking(10))
    expect(display.minute).toBe(start0 + 4 * SIMULATION_SLICE_MINUTES)
    expect(display.state.minute).toBe(display.minute)
    display = advanceDisplay(display, 0.25, { minutesPerSecond: 1_440 }, 40, ticking(100))
    expect(display.minute).toBe(start0 + 5 * SIMULATION_SLICE_MINUTES)
    // With time to spare, the frame reaches the minute wanted.
    display = advanceDisplay(display, 0.1, { minutesPerSecond: 1_440 }, 40, ticking(0))
    expect(display.minute).toBeCloseTo(start0 + 5 * SIMULATION_SLICE_MINUTES + 144)
    expect(display.state.minute).toBe(Math.floor(display.minute))
  })

  it('stops drawing people from map speeds up', () => {
    for (const speed of VALLEY_SPEEDS) expect(speed.map).toBe(speed.minutesPerSecond >= mapSpeedMinutesPerSecond)
    expect(VALLEY_SPEEDS.at(-1)!.map).toBe(true)
    expect(VALLEY_SPEEDS[0]!.map).toBe(false)
  })
})
