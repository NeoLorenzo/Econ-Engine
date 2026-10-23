import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from '../valley/config'
import { cloneValley, runValley, stepValley } from '../valley/engine'
import { createSurveyedValley } from '../valley/ruleFixtures'
import { advancePlayback, type DisplayPair } from './valleyViewModel'

const startPair = (): DisplayPair => {
  const previous = createSurveyedValley({ ...FLAT_LAND, founders: 1 })
  return { previous, next: stepValley(previous), alpha: 0 }
}

const clock = (...values: number[]) => {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]!
}

describe('responsive Life playback', () => {
  it('ends an overloaded batch between real minutes and preserves its exact simulation prefix', () => {
    const pair = startPair()
    const unchanged = cloneValley(pair.next)
    const advanced = advancePlayback(pair, 300, 0.25, 2, clock(0, 7, 8, 10))
    const previous = runValley(pair.next, 1, { recordEvents: false })
    expect(advanced.pair.previous).toEqual(previous)
    expect(advanced.pair.next).toEqual(stepValley(previous))
    expect(advanced.pair.alpha).toBe(0.25)
    expect(advanced.lastStepMs).toBe(2)
    expect(pair.next).toEqual(unchanged)
  })

  it('runs just one minute after a slow tick instead of blocking on hundreds more', () => {
    const pair = startPair()
    const advanced = advancePlayback(pair, 300, 0.5, 20, clock(0, 1, 21))
    expect(advanced.pair.previous).toBe(pair.next)
    expect(advanced.pair.next).toEqual(stepValley(pair.next))
    expect(advanced.pair.next.minute - advanced.pair.previous.minute).toBe(1)
  })

  it('completes affordable batches and advances only interpolation when no minute is due', () => {
    const pair = startPair()
    let elapsed = 0
    const advanced = advancePlayback(pair, 4, 0.75, 1, () => elapsed++)
    const previous = runValley(pair.next, 3, { recordEvents: false })
    expect(advanced.pair.previous).toEqual(previous)
    expect(advanced.pair.next).toEqual(stepValley(previous))
    const interpolated = advancePlayback(advanced.pair, 0, 0.9, advanced.lastStepMs)
    expect(interpolated.pair.previous).toBe(advanced.pair.previous)
    expect(interpolated.pair.next).toBe(advanced.pair.next)
    expect(interpolated.pair.alpha).toBe(0.9)
  })
})
