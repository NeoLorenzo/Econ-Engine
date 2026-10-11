import { describe, expect, it } from 'vitest'
import { createLife, runLifeHours, stepLife } from '../life/engine'
import type { LifeState } from '../life/types'
import {
  advanceClock,
  bushScale,
  clockLabel,
  daylightAt,
  describeActivity,
  displayedStock,
  foragerPose,
  MAX_FRAME_SECONDS,
  patchInspection,
  type DisplayPair,
} from './lifeViewModel'

const pairAt = (previous: LifeState, alpha: number): DisplayPair => ({ previous, next: stepLife(previous), alpha })

/** A forager at the west end of a 12 × 1 strip at 17:00, hungry, with food only at the east end. */
function hungryAtDusk() {
  const state = createLife({ gridWidth: 12, gridHeight: 1, patchCount: 2, initialReserveKcal: 10_000, seed: 3 })
  return {
    ...state,
    tick: 17,
    patches: [
      { id: 0, tile: { x: 0, y: 0 }, stockKcal: 0 },
      { id: 1, tile: { x: 11, y: 0 }, stockKcal: 8_000 },
    ],
    forager: { ...state.forager, position: { x: 0, y: 0 } },
  }
}

describe('the display clock', () => {
  it('runs whole hours and carries the remainder', () => {
    expect(advanceClock(0.5, 0.2, 6)).toEqual({ steps: 1, alpha: expect.closeTo(0.7, 9) })
    expect(advanceClock(0, 0.1, 1 / 3).steps).toBe(0)
  })

  it('treats a long gap between frames as a short one', () => {
    expect(advanceClock(0, 60, 1)).toEqual({ steps: 0, alpha: MAX_FRAME_SECONDS })
    expect(advanceClock(0, -1, 1)).toEqual({ steps: 0, alpha: 0 })
  })

  it('labels the day and time', () => {
    expect(clockLabel(0)).toBe('Day 1 · 00:00')
    expect(clockLabel(30.5)).toBe('Day 2 · 06:30')
  })
})

describe('light', () => {
  it('is full by day, dark by night, and fades across dawn and dusk', () => {
    expect(daylightAt(12, 6, 18)).toBe(1)
    expect(daylightAt(0, 6, 18)).toBe(0)
    expect(daylightAt(6, 6, 18)).toBeCloseTo(0.5, 9)
    expect(daylightAt(18, 6, 18)).toBeCloseTo(0.5, 9)
    expect(daylightAt(17.5, 6, 18)).toBe(1)
    expect(daylightAt(18.5, 6, 18)).toBe(0)
  })
})

describe('the forager on screen', () => {
  it('walks the simulated path at walking speed, only between real states', () => {
    const previous = hungryAtDusk()
    expect(foragerPose(pairAt(previous, 0))).toMatchObject({ x: 0, y: 0, walking: true })
    expect(foragerPose(pairAt(previous, 0.5))).toMatchObject({ x: 1.5, y: 0, walking: true })
    expect(foragerPose(pairAt(previous, 1))).toMatchObject({ x: 3, y: 0, walking: false })
    expect(foragerPose(pairAt(previous, 0.5)).heading).toBeCloseTo(Math.PI / 2, 9)
  })

  it('ends a short walk early and stands for the rest of the hour', () => {
    const near = { ...hungryAtDusk(), patches: [...hungryAtDusk().patches] }
    near.patches[1] = { id: 1, tile: { x: 1, y: 0 }, stockKcal: 8_000 }
    expect(foragerPose(pairAt(near, 0.5))).toMatchObject({ x: 1, y: 0, walking: false })
  })

  it('draws the end of the hour when interpolation is off', () => {
    expect(foragerPose(pairAt(hungryAtDusk(), 0.2), false)).toMatchObject({ x: 3, y: 0 })
  })

  it('lies down as night falls and gets up at dawn', () => {
    const dusk = runLifeHours(hungryAtDusk(), 1)
    expect(foragerPose(pairAt(dusk, 0)).lying).toBe(0)
    expect(foragerPose(pairAt(dusk, 0.125)).lying).toBeCloseTo(0.5, 9)
    expect(foragerPose(pairAt(dusk, 0.5)).lying).toBe(1)
    const night = runLifeHours(dusk, 5)
    expect(foragerPose(pairAt(night, 0.5)).lying).toBe(1)
    const lastNightHour = runLifeHours(dusk, 12)
    expect(foragerPose(pairAt(lastNightHour, 0)).lying).toBe(1)
    expect(foragerPose(pairAt(lastNightHour, 0.5)).lying).toBe(0)
  })
})

describe('bushes', () => {
  it('shrink while the forager gathers, in step with the simulation', () => {
    const state = runLifeHours(
      createLife({ gridWidth: 1, gridHeight: 1, patchCount: 1, initialReserveKcal: 10_000 }),
      6,
    )
    const pair = pairAt(state, 0.5)
    expect(pair.next.lastEvent?.action).toBe('forage')
    const before = state.patches[0]!.stockKcal
    const after = pair.next.patches[0]!.stockKcal
    expect(displayedStock(pair, 0)).toBe((before + after) / 2)
    expect(displayedStock(pair, 0, false)).toBe(after)
  })

  it('never vanish', () => {
    expect(bushScale(0, 8_000)).toBeCloseTo(0.3, 9)
    expect(bushScale(8_000, 8_000)).toBe(1)
  })
})

describe('words', () => {
  it('describes what the forager is doing', () => {
    expect(describeActivity(pairAt(hungryAtDusk(), 0.5))).toBe('Walking to patch 2')
    expect(describeActivity(pairAt(createLife(), 0.5))).toBe('Sleeping through the night')
  })

  it('compares a patch with what the forager remembers of it', () => {
    const state = runLifeHours(createLife(), 30)
    const inspection = patchInspection(state, 0)
    expect(inspection.trueStockKcal).toBe(state.patches[0]!.stockKcal)
    expect(inspection.rememberedStockKcal).toBe(state.forager.memory[0]!.stockKcal)
    expect(inspection.differenceKcal).toBe(inspection.trueStockKcal - inspection.rememberedStockKcal)
    expect(patchInspection(createLife(), 0).seen).toBe('at the start')
  })
})
