import { describe, expect, it } from 'vitest'
import { LIFE_DEFAULT_CONFIG } from './config'
import { choosePatch, decide, nextHungerMode, observe } from './forager'
import type { Forager, Patch, Tile } from './types'

const config = LIFE_DEFAULT_CONFIG
const NOON = 12
const MIDNIGHT = 0

const patch = (id: number, x: number, y: number, stockKcal = 8_000): Patch => ({ id, tile: { x, y }, stockKcal })

const forager = (position: Tile, overrides: Partial<Forager> = {}): Forager => ({
  position,
  energyKcal: 10_000,
  hungry: true,
  targetPatchId: null,
  memory: [],
  alive: true,
  deathTick: null,
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
  it('records only the patch the forager stands on', () => {
    const patches = [patch(0, 0, 0, 500), patch(1, 3, 3, 7_000)]
    const memory = [
      { stockKcal: 8_000, observedTick: 0 },
      { stockKcal: 8_000, observedTick: 0 },
    ]
    expect(observe(forager({ x: 0, y: 0 }, { memory }), patches, 30)).toEqual([
      { stockKcal: 500, observedTick: 30 },
      { stockKcal: 8_000, observedTick: 0 },
    ])
    expect(observe(forager({ x: 1, y: 1 }, { memory }), patches, 30)).toBe(memory)
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

describe('choosing a patch', () => {
  const remembered = (...entries: [number, number][]) =>
    entries.map(([stockKcal, observedTick]) => ({ stockKcal, observedTick }))

  it('prefers the fullest remembered patch, then the nearest, then the lowest ID', () => {
    const patches = [patch(0, 0, 0), patch(1, 4, 0), patch(2, 1, 0), patch(3, 2, 0)]
    expect(
      choosePatch(config, { x: 0, y: 0 }, patches, remembered([0, 0], [5_000, 0], [3_000, 0], [5_000, 0]))?.id,
    ).toBe(3)
    expect(
      choosePatch(config, { x: 3, y: 0 }, patches, remembered([0, 0], [5_000, 0], [3_000, 0], [5_000, 0]))?.id,
    ).toBe(1)
    const tied = [patch(0, 9, 9), patch(1, 2, 0), patch(2, 0, 2)]
    expect(choosePatch(config, { x: 0, y: 0 }, tied, remembered([0, 0], [4_000, 0], [4_000, 0]))?.id).toBe(1)
  })

  it('falls back to the patch seen longest ago when none is remembered as worth foraging', () => {
    const patches = [patch(0, 0, 0), patch(1, 4, 0), patch(2, 1, 0)]
    expect(choosePatch(config, { x: 0, y: 0 }, patches, remembered([0, 50], [100, 30], [1_199, 40]))?.id).toBe(1)
    expect(choosePatch(config, { x: 0, y: 0 }, patches, remembered([0, 50], [100, 30], [1_199, 30]))?.id).toBe(2)
  })

  it('never chooses the patch underfoot, and has no choice on a lone patch', () => {
    const patches = [patch(0, 0, 0), patch(1, 4, 0)]
    expect(choosePatch(config, { x: 0, y: 0 }, patches, remembered([8_000, 0], [0, 0]))?.id).toBe(1)
    expect(choosePatch(config, { x: 0, y: 0 }, [patch(0, 0, 0)], remembered([0, 0]))).toBeNull()
  })
})
