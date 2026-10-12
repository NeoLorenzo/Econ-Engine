import { describe, expect, it } from 'vitest'
import { cloneValley, createValley, stepValley } from '../valley/engine'
import type { ValleyState } from '../valley/types'
import {
  CAMERA_LIMITS,
  advanceClock,
  clampDistance,
  closeTilt,
  describeActivity,
  displayedLoad,
  fillInTurn,
  foragerPose,
  plantInspection,
  type DisplayPair,
} from './valleyViewModel'

/** The canonical valley at ten in the morning, with forager 0 hungry three metres from a bush that alone holds food. */
function pairBesideBush(): DisplayPair {
  const state: ValleyState = cloneValley(createValley())
  state.minute = 600
  const forager = state.foragers[0]!
  forager.x = state.layout.bushes.x[0]! - 300
  forager.y = state.layout.bushes.y[0]!
  forager.energyKcal = 13_000
  forager.hungry = true
  state.bushKcal.fill(0)
  state.bushKcal[0] = 400
  return { previous: state, next: stepValley(state), alpha: 0 }
}

describe('drawing between two minutes', () => {
  it('walks the walking seconds along a straight line, then picks', () => {
    const pair = pairBesideBush()
    const start = foragerPose({ ...pair, alpha: 0 }, 0)
    expect(start).toMatchObject({ x: pair.previous.foragers[0]!.x, gesture: 'walk' })
    // Two seconds of walking out of sixty: halfway through them at one-sixtieth of the minute.
    const halfway = foragerPose({ ...pair, alpha: 1 / 60 }, 0)
    expect(halfway.gesture).toBe('walk')
    expect(halfway.x).toBeCloseTo((pair.previous.foragers[0]!.x + pair.next.foragers[0]!.x) / 2, 5)
    const working = foragerPose({ ...pair, alpha: 0.5 }, 0)
    expect(working).toMatchObject({ x: pair.next.foragers[0]!.x, y: pair.next.foragers[0]!.y, gesture: 'pick' })
    expect(describeActivity(pair, 0)).toBe('Picking berries from a bush in thicket 1')
  })

  it('lays a sleeper down and draws only whole minutes at the fastest speed', () => {
    const state = cloneValley(createValley())
    state.minute = 1_200
    const pair = { previous: state, next: stepValley(state), alpha: 0.5 }
    expect(foragerPose(pair, 0)).toMatchObject({ gesture: 'sleep', lying: 1 })
    expect(foragerPose(pair, 0, false).x).toBe(pair.next.foragers[0]!.x)
  })

  it('puts the wood of the trip on the forager’s back and the rest by its hearth', () => {
    const pair = pairBesideBush()
    for (const state of [pair.previous, pair.next]) {
      state.foragers[0]!.wood = 30
      state.foragers[0]!.tripWood = 12
    }
    expect(displayedLoad(pair, 0)).toMatchObject({ onBack: 12, atHearth: 18 })
  })

  it('advances whole minutes and keeps the remainder, never more than a quarter second at once', () => {
    expect(advanceClock(0.5, 1, 1)).toEqual({ steps: 0, alpha: 0.75 })
    expect(advanceClock(0, 0.1, 60)).toEqual({ steps: 6, alpha: expect.closeTo(0, 9) })
  })
})

describe('plants and the camera', () => {
  it('shares a bush’s berries out one by one, the last emptying first', () => {
    expect(fillInTurn(400, 400, 10)).toEqual(Array.from({ length: 10 }, () => 1))
    expect(fillInTurn(100, 400, 4)).toEqual([1, 0, 0, 0])
    expect(fillInTurn(0, 400, 3)).toEqual([0, 0, 0])
  })

  it('compares a plant’s true stock with what the followed forager remembers', () => {
    const state = cloneValley(createValley())
    state.bushKcal[7] = 120
    const inspection = plantInspection(state, 'bush', 7, 0)
    expect(inspection).toMatchObject({ stock: 120, remembered: 400, difference: -280, seen: 'at the start' })
  })

  it('keeps the camera between a person and the whole valley, tilting towards eye level close in', () => {
    expect(clampDistance(1)).toBe(CAMERA_LIMITS.nearest)
    expect(clampDistance(10_000)).toBe(CAMERA_LIMITS.farthest)
    expect(closeTilt(CAMERA_LIMITS.nearest)).toBeCloseTo(0.6)
    expect(closeTilt(60)).toBe(0)
    expect(closeTilt(15)).toBeGreaterThan(0)
  })
})
