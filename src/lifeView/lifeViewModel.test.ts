import { describe, expect, it } from 'vitest'
import { LIFE0_WORLD } from '../life/config'
import { createLife, lastEventOf, runLifeHours, stepLife } from '../life/engine'
import type { LifeConfig, LifeState } from '../life/types'
import {
  advanceClock,
  aliveCount,
  bushScale,
  clockLabel,
  daylightAt,
  describeActivity,
  displayedStock,
  foragerName,
  foragerPose,
  MAX_FRAME_SECONDS,
  patchInspection,
  perceptionOutline,
  standingOffsets,
  stepFollowed,
  type DisplayPair,
} from './lifeViewModel'

const life0 = (overrides: Partial<LifeConfig> = {}) => createLife({ ...LIFE0_WORLD, ...overrides })

const pairAt = (previous: LifeState, alpha: number): DisplayPair => ({ previous, next: stepLife(previous), alpha })

/** A forager at the west end of a 12 × 1 strip at 17:00, hungry, with food only at the east end. */
function hungryAtDusk() {
  const state = life0({ gridWidth: 12, gridHeight: 1, patchCount: 2, initialReserveKcal: 10_000, seed: 3 })
  return {
    ...state,
    tick: 17,
    patches: [
      { id: 0, tile: { x: 0, y: 0 }, stockKcal: 0 },
      { id: 1, tile: { x: 11, y: 0 }, stockKcal: 8_000 },
    ],
    foragers: [{ ...state.foragers[0]!, position: { x: 0, y: 0 } }],
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
    expect(foragerPose(pairAt(previous, 0), 0)).toMatchObject({ x: 0, y: 0, walking: true })
    expect(foragerPose(pairAt(previous, 0.5), 0)).toMatchObject({ x: 1.5, y: 0, walking: true })
    expect(foragerPose(pairAt(previous, 1), 0)).toMatchObject({ x: 3, y: 0, walking: false })
    expect(foragerPose(pairAt(previous, 0.5), 0).heading).toBeCloseTo(Math.PI / 2, 9)
  })

  it('ends a short walk early and stands for the rest of the hour', () => {
    const near = { ...hungryAtDusk(), patches: [...hungryAtDusk().patches] }
    near.patches[1] = { id: 1, tile: { x: 1, y: 0 }, stockKcal: 8_000 }
    expect(foragerPose(pairAt(near, 0.5), 0)).toMatchObject({ x: 1, y: 0, walking: false })
  })

  it('draws the end of the hour when interpolation is off', () => {
    expect(foragerPose(pairAt(hungryAtDusk(), 0.2), 0, false)).toMatchObject({ x: 3, y: 0 })
  })

  it('lies down as night falls and gets up at dawn', () => {
    const dusk = runLifeHours(hungryAtDusk(), 1)
    expect(foragerPose(pairAt(dusk, 0), 0).lying).toBe(0)
    expect(foragerPose(pairAt(dusk, 0.125), 0).lying).toBeCloseTo(0.5, 9)
    expect(foragerPose(pairAt(dusk, 0.5), 0).lying).toBe(1)
    const night = runLifeHours(dusk, 5)
    expect(foragerPose(pairAt(night, 0.5), 0).lying).toBe(1)
    const lastNightHour = runLifeHours(dusk, 12)
    expect(foragerPose(pairAt(lastNightHour, 0), 0).lying).toBe(1)
    expect(foragerPose(pairAt(lastNightHour, 0.5), 0).lying).toBe(0)
  })
})

describe('bushes', () => {
  it('shrink while the forager gathers, in step with the simulation', () => {
    const state = runLifeHours(life0({ gridWidth: 1, gridHeight: 1, patchCount: 1, initialReserveKcal: 10_000 }), 6)
    const pair = pairAt(state, 0.5)
    expect(lastEventOf(pair.next, 0)?.action).toBe('forage')
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
    expect(describeActivity(pairAt(hungryAtDusk(), 0.5), 0)).toBe('Walking to patch 2')
    expect(describeActivity(pairAt(createLife(), 0.5), 7)).toBe('Sleeping through the night')
    expect(foragerName(0)).toBe('Forager 1')
  })

  it('compares a patch with what the followed forager remembers of it', () => {
    const state = runLifeHours(createLife(), 30)
    for (const followed of [0, 5]) {
      const inspection = patchInspection(state, 0, followed)
      expect(inspection.trueStockKcal).toBe(state.patches[0]!.stockKcal)
      expect(inspection.rememberedStockKcal).toBe(state.foragers[followed]!.memory[0]!.stockKcal)
      expect(inspection.differenceKcal).toBe(inspection.trueStockKcal - inspection.rememberedStockKcal)
    }
    expect(patchInspection(createLife(), 0, 3).seen).toBe('at the start')
  })
})

describe('the band on screen', () => {
  it('stands foragers sharing a tile apart, and a lone forager beside its bush', () => {
    const state = createLife({ ...LIFE0_WORLD, bandSize: 3 })
    const together = {
      ...state,
      foragers: state.foragers.map((forager, id) => ({ ...forager, position: { x: id === 2 ? 5 : 1, y: 1 } })),
    }
    const [a, b, lone] = standingOffsets(together)
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(0.5)
    expect(lone!.x).toBeCloseTo(0.3, 2)
    expect(lone!.y).toBeCloseTo(0.3, 2)
  })

  it('moves a forager between its standing places only as the hour passes', () => {
    const previous = createLife()
    const pair = pairAt(previous, 0.5)
    const before = standingOffsets(previous)[4]!
    const after = standingOffsets(pair.next)[4]!
    const pose = foragerPose(pair, 4)
    expect(pose.offsetX).toBeCloseTo((before.x + after.x) / 2, 9)
    expect(pose.offsetY).toBeCloseTo((before.y + after.y) / 2, 9)
  })

  it('steps through the living band, wrapping around, and through everyone once all are dead', () => {
    const state = createLife({ ...LIFE0_WORLD, bandSize: 4 })
    const someDead = {
      ...state,
      foragers: state.foragers.map((forager) => ({ ...forager, alive: forager.id !== 1 && forager.id !== 3 })),
    }
    expect(aliveCount(someDead)).toBe(2)
    expect(stepFollowed(someDead, 0, 1)).toBe(2)
    expect(stepFollowed(someDead, 2, 1)).toBe(0)
    expect(stepFollowed(someDead, 0, -1)).toBe(2)
    const allDead = { ...state, foragers: state.foragers.map((forager) => ({ ...forager, alive: false })) }
    expect(stepFollowed(allDead, 3, 1)).toBe(0)
  })

  it('outlines exactly the tiles within the perception radius', () => {
    expect(perceptionOutline(0)).toEqual([
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
      [-0.5, -0.5],
    ])
    const outline = perceptionOutline(2)
    expect(outline).toHaveLength(20)
    expect(Math.max(...outline.map(([x]) => x))).toBe(2.5)
    expect(Math.max(...outline.map(([, y]) => y))).toBe(2.5)
  })
})
