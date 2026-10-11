import { describe, expect, it } from 'vitest'
import { LIFE1_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import { choosePatch, decide, nextHungerMode, observe, walkTarget } from './forager'
import type { Forager, LifeConfig, Patch, Tile } from './types'

// Life 1's world: no camp and steady harvests. The camp's rules are tested in camp.test.ts.
const config: LifeConfig = { ...LIFE_DEFAULT_CONFIG, ...LIFE1_WORLD }
const NOON = 12
const MIDNIGHT = 0

const patch = (id: number, x: number, y: number, stockKcal = 8_000): Patch => ({ id, tile: { x, y }, stockKcal })

const forager = (position: Tile, overrides: Partial<Forager> = {}): Forager => ({
  id: 0,
  position,
  energyKcal: 10_000,
  hungry: true,
  targetPatchId: null,
  memory: [],
  alive: true,
  deathTick: null,
  strategy: 'keeper',
  carried: [],
  ledger: [],
  ...overrides,
})

describe('hunger', () => {
  it('starts below the hunger threshold and lasts until the satiation threshold', () => {
    expect(nextHungerMode(config, 13_999, false)).toBe(true)
    expect(nextHungerMode(config, 14_000, false)).toBe(false)
    expect(nextHungerMode(config, 17_999, true)).toBe(true)
    expect(nextHungerMode(config, 18_000, true)).toBe(false)
  })
})

describe('observation', () => {
  const patches = [patch(0, 0, 0, 500), patch(1, 3, 3, 7_000)]
  const memory = [
    { stockKcal: 8_000, observedTick: 0 },
    { stockKcal: 8_000, observedTick: 0 },
  ]
  const radius = (perceptionRadiusTiles: number) => ({ ...config, perceptionRadiusTiles })

  it('at radius 0, records only the patch the forager stands on', () => {
    expect(observe(radius(0), forager({ x: 0, y: 0 }, { memory }), patches, 30)).toEqual([
      { stockKcal: 500, observedTick: 30 },
      { stockKcal: 8_000, observedTick: 0 },
    ])
    expect(observe(radius(0), forager({ x: 1, y: 1 }, { memory }), patches, 30)).toBe(memory)
  })

  it('sees a patch exactly at the radius, and none beyond it', () => {
    // Patch 1 is 4 tiles from (1, 1) and 6 from (0, 0).
    expect(observe(radius(4), forager({ x: 1, y: 1 }, { memory }), patches, 30)).toEqual([
      { stockKcal: 500, observedTick: 30 },
      { stockKcal: 7_000, observedTick: 30 },
    ])
    expect(observe(radius(5), forager({ x: 0, y: 0 }, { memory }), patches, 30)[1]).toBe(memory[1])
  })
})

describe('decision rules', () => {
  const patches = [patch(0, 0, 0, 1_200), patch(1, 5, 5)]

  it('sleeps at night, whatever else holds', () => {
    expect(decide(config, forager({ x: 0, y: 0 }), patches, MIDNIGHT)).toEqual({ action: 'sleep', reason: 'night' })
    expect(decide(config, forager({ x: 0, y: 0 }), patches, 5)).toEqual({ action: 'sleep', reason: 'night' })
    expect(decide(config, forager({ x: 0, y: 0 }), patches, 18)).toEqual({ action: 'sleep', reason: 'night' })
  })

  it('rests in daylight once satiated', () => {
    expect(decide(config, forager({ x: 0, y: 0 }, { hungry: false }), patches, NOON)).toEqual({
      action: 'rest',
      reason: 'satiated',
    })
  })

  it('forages only where a full hour’s harvest is available', () => {
    expect(decide(config, forager({ x: 0, y: 0 }), patches, 6)).toEqual({ action: 'forage', reason: 'foraging' })
    const thin = [patch(0, 0, 0, 1_199), patch(1, 5, 5)]
    expect(decide(config, forager({ x: 0, y: 0 }), thin, NOON)).toEqual({ action: 'walk', reason: 'seeking food' })
  })

  it('walks from open ground, and waits on a lone thin patch', () => {
    expect(decide(config, forager({ x: 2, y: 2 }), patches, NOON).action).toBe('walk')
    expect(decide(config, forager({ x: 0, y: 0 }), [patch(0, 0, 0, 100)], NOON)).toEqual({
      action: 'rest',
      reason: 'waiting for regrowth',
    })
  })
})

describe('the walking target', () => {
  const patches = [patch(0, 0, 0, 4_000), patch(1, 4, 0, 0)]
  const memory = (targetSeenAt: number, targetStock: number) => [
    { stockKcal: 4_000, observedTick: 0 },
    { stockKcal: targetStock, observedTick: targetSeenAt },
  ]

  it('is kept until reached, unless it was just seen holding less than a full hour’s harvest', () => {
    const walking = (targetSeenAt: number, targetStock: number) =>
      forager({ x: 2, y: 0 }, { targetPatchId: 1, memory: memory(targetSeenAt, targetStock) })
    // Seen empty before this hour, or seen full this hour: it walks on.
    expect(walkTarget(config, walking(5, 0), patches, 12)?.patch?.id).toBe(1)
    expect(walkTarget(config, walking(12, 1_200), patches, 12)?.patch?.id).toBe(1)
    // Seen empty this hour: it chooses again.
    expect(walkTarget(config, walking(12, 1_199), patches, 12)?.patch?.id).toBe(0)
  })

  it('is chosen afresh with no target or on arrival', () => {
    const fresh = forager({ x: 2, y: 0 }, { memory: memory(0, 0) })
    expect(walkTarget(config, fresh, patches, 12)?.patch?.id).toBe(0)
    const arrived = forager({ x: 4, y: 0 }, { targetPatchId: 1, memory: memory(12, 0) })
    expect(walkTarget(config, arrived, patches, 12)?.patch?.id).toBe(0)
  })
})

describe('choosing a patch', () => {
  const remembered = (...entries: [number, number][]) =>
    entries.map(([stockKcal, observedTick]) => ({ stockKcal, observedTick }))

  it('prefers the fullest remembered patch, then the nearest, then the lowest ID', () => {
    const patches = [patch(0, 0, 0), patch(1, 4, 0), patch(2, 1, 0), patch(3, 2, 0)]
    expect(
      choosePatch(config, { x: 0, y: 0 }, patches, remembered([0, 0], [5_000, 0], [3_000, 0], [5_000, 0]), NOON)?.id,
    ).toBe(3)
    expect(
      choosePatch(config, { x: 3, y: 0 }, patches, remembered([0, 0], [5_000, 0], [3_000, 0], [5_000, 0]), NOON)?.id,
    ).toBe(1)
    const tied = [patch(0, 9, 9), patch(1, 2, 0), patch(2, 0, 2)]
    expect(choosePatch(config, { x: 0, y: 0 }, tied, remembered([0, 0], [4_000, 0], [4_000, 0]), NOON)?.id).toBe(1)
  })

  it('falls back to the patch seen longest ago when none is remembered as worth foraging', () => {
    const patches = [patch(0, 0, 0), patch(1, 4, 0), patch(2, 1, 0)]
    expect(choosePatch(config, { x: 0, y: 0 }, patches, remembered([0, 50], [100, 30], [1_199, 40]), NOON)?.id).toBe(1)
    expect(choosePatch(config, { x: 0, y: 0 }, patches, remembered([0, 50], [100, 30], [1_199, 30]), NOON)?.id).toBe(2)
  })

  it('never chooses the patch underfoot, and has no choice on a lone patch', () => {
    const patches = [patch(0, 0, 0), patch(1, 4, 0)]
    expect(choosePatch(config, { x: 0, y: 0 }, patches, remembered([8_000, 0], [0, 0]), NOON)?.id).toBe(1)
    expect(choosePatch(config, { x: 0, y: 0 }, [patch(0, 0, 0)], remembered([0, 0]), NOON)).toBeNull()
  })
})
