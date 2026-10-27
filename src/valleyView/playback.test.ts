import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from '../valley/config'
import { stepValley } from '../valley/engine'
import { createSurveyedValley } from '../valley/ruleFixtures'
import {
  advanceDisplay,
  foragerPose,
  mapSpeedMinutesPerSecond,
  routePoints,
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

  it('runs the engine until the frame budget is spent, and at least one wake-up minute a frame', () => {
    const ticking = (ms: number) => {
      let t = 0
      return () => (t += ms)
    }
    const first = start()
    const wakeUpsTo = (minute: number) => stepValley(first.state, minute).totals.wakeUps
    // Each clock reading is 100 ms later, past the budget at once: the frame runs only the first wake-up minute after
    // the one it starts at.
    let display: Display = advanceDisplay(first, 0.25, { minutesPerSecond: 1_440 }, 40, ticking(100))
    expect(display.minute).toBeGreaterThan(first.minute)
    // Wake-ups due at the starting minute itself run in the next step.
    expect(wakeUpsTo(display.minute - 1)).toBe(wakeUpsTo(first.minute + 1))
    expect(display.state.minute).toBe(display.minute)
    // Each reading is 10 ms later: the step stops between wake-ups, short of the minute wanted.
    const before = display.minute
    display = advanceDisplay(display, 0.25, { minutesPerSecond: 1_440 }, 40, ticking(10))
    expect(display.minute).toBeGreaterThan(before)
    expect(display.minute).toBeLessThan(before + 360)
    expect(display.state.minute).toBe(display.minute)
    // With time to spare, the frame reaches the minute wanted, and matches a step there in one go.
    const reached = display.minute
    display = advanceDisplay(display, 0.1, { minutesPerSecond: 1_440 }, 40, ticking(0))
    expect(display.minute).toBeCloseTo(reached + 144)
    expect(display.state.minute).toBe(Math.floor(display.minute))
    const direct = stepValley(first.state, display.state.minute)
    expect(display.state.foragers.map((p) => [p.x, p.y, p.energyKcal])).toEqual(
      direct.foragers.map((p) => [p.x, p.y, p.energyKcal]),
    )
  })

  it('stops drawing people from map speeds up', () => {
    for (const speed of VALLEY_SPEEDS) expect(speed.map).toBe(speed.minutesPerSecond >= mapSpeedMinutesPerSecond)
    expect(VALLEY_SPEEDS.at(-1)!.map).toBe(true)
    expect(VALLEY_SPEEDS[0]!.map).toBe(false)
  })
})
