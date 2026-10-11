import { describe, expect, it } from 'vitest'
import { createLife, EVENT_HISTORY_DAYS, runLifeDays, runLifeHours, stepLife } from './engine'
import { assertLifeInvariants, lifeInvariantViolations } from './invariants'
import type { LifeState } from './types'
import { deriveLayoutSeed, generateLayout, walkPath } from './world'
import { LIFE_DEFAULT_CONFIG } from './config'

const hoursUntil = (state: LifeState, predicate: (state: LifeState) => boolean, limit = 24 * 400) => {
  let current = state
  for (let hour = 0; hour < limit && !predicate(current); hour += 1) current = stepLife(current)
  return current
}

describe('layout', () => {
  it('is deterministic for a seed and puts each patch on its own tile', () => {
    const a = generateLayout(LIFE_DEFAULT_CONFIG)
    expect(generateLayout(LIFE_DEFAULT_CONFIG)).toEqual(a)
    expect(new Set(a.patches.map((patch) => `${patch.tile.x},${patch.tile.y}`)).size).toBe(4)
    expect(a.patches.map((patch) => patch.id)).toEqual([0, 1, 2, 3])
    expect(generateLayout({ ...LIFE_DEFAULT_CONFIG, seed: 1 })).not.toEqual(a)
    expect(deriveLayoutSeed(LIFE_DEFAULT_CONFIG.seed)).not.toBe(LIFE_DEFAULT_CONFIG.seed)
  })

  it('lets the forager start anywhere, including on a patch', () => {
    const lone = generateLayout({ ...LIFE_DEFAULT_CONFIG, gridWidth: 1, gridHeight: 1, patchCount: 1 })
    expect(lone.start).toEqual(lone.patches[0]!.tile)
    const starts = new Set(
      Array.from({ length: 40 }, (_, seed) => {
        const { start } = generateLayout({ ...LIFE_DEFAULT_CONFIG, seed, gridWidth: 2, gridHeight: 1, patchCount: 1 })
        return start.x
      }),
    )
    expect(starts).toEqual(new Set([0, 1]))
  })
})

describe('movement', () => {
  it('walks x first, then y, at most the allowed tiles, stopping on arrival', () => {
    expect(walkPath({ x: 0, y: 0 }, { x: 2, y: 3 }, 3)).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ])
    expect(walkPath({ x: 2, y: 2 }, { x: 1, y: 2 }, 3)).toEqual([{ x: 1, y: 2 }])
    expect(walkPath({ x: 1, y: 1 }, { x: 1, y: 1 }, 3)).toEqual([])
  })

  it('keeps its target through the night and resumes at dawn', () => {
    // Patch 1 far away and the forager hungry at dusk, standing on an empty patch.
    let state = createLife({ gridWidth: 12, gridHeight: 1, patchCount: 2, initialReserveKcal: 10_000, seed: 3 })
    state = {
      ...state,
      tick: 17,
      patches: [
        { id: 0, tile: { x: 0, y: 0 }, stockKcal: 0 },
        { id: 1, tile: { x: 11, y: 0 }, stockKcal: 8_000 },
      ],
      forager: { ...state.forager, position: { x: 0, y: 0 } },
    }
    state = stepLife(state)
    expect(state.lastEvent).toMatchObject({ action: 'walk', position: { x: 3, y: 0 }, targetPatchId: 1 })
    state = runLifeHours(state, 12)
    expect(state.lastEvent).toMatchObject({ action: 'sleep', position: { x: 3, y: 0 } })
    expect(state.forager.targetPatchId).toBe(1)
    state = stepLife(state)
    expect(state.lastEvent).toMatchObject({ tick: 30, action: 'walk', position: { x: 6, y: 0 }, targetPatchId: 1 })
  })
})

describe('the hourly step', () => {
  it('regrows patches up to their capacity and records only what was added', () => {
    const state = createLife({ gridWidth: 1, gridHeight: 1, patchCount: 1, initialPatchStockKcal: 7_980 })
    const next = stepLife(state)
    expect(next.patches[0]!.stockKcal).toBe(8_000)
    expect(next.totals.regrownKcal).toBe(20)
  })

  it('forages a full hour, eats it at once and pays for the hour', () => {
    let state = createLife({ gridWidth: 1, gridHeight: 1, patchCount: 1, initialReserveKcal: 10_000 })
    state = runLifeHours(state, 6)
    expect(state.lastEvent).toMatchObject({ action: 'sleep', spentKcal: 60 })
    const before = state.forager.energyKcal
    state = stepLife(state)
    expect(state.lastEvent).toMatchObject({ action: 'forage', reason: 'foraging', gatheredKcal: 1_200, spentKcal: 300 })
    expect(state.forager.energyKcal).toBe(before + 900)
  })

  it('starves when its reserve cannot cover an hour, and stays dead', () => {
    let state = createLife({ gridWidth: 1, gridHeight: 1, patchCount: 1, initialPatchStockKcal: 0 })
    // Fifty kilocalories cannot pay for an hour's sleep.
    state = { ...state, forager: { ...state.forager, energyKcal: 50 }, totals: { ...state.totals, initialKcal: 50 } }
    state = stepLife(state)
    expect(state.forager).toMatchObject({ alive: false, energyKcal: 0, deathTick: 0 })
    expect(state.lastEvent).toMatchObject({ action: 'sleep', spentKcal: 50, energyAfterKcal: 0 })
    expect(state.eventDays.at(-1)!.at(-1)).toEqual({ kind: 'death', tick: 0, cause: 'starvation' })
    const later = runLifeHours(state, 30)
    expect(later.lastEvent).toBeNull()
    expect(later.forager.energyKcal).toBe(0)
    expect(later.patches[0]!.stockKcal).toBe(31 * LIFE_DEFAULT_CONFIG.patchRegrowthKcalPerHour)
    assertLifeInvariants(later)
  })

  it('summarizes each day and keeps 30 days of events', () => {
    const state = runLifeDays(createLife(), 40)
    expect(state.days).toHaveLength(40)
    expect(state.today.day).toBe(40)
    for (const day of state.days) expect(Object.values(day.hours).reduce((a, b) => a + b, 0)).toBe(24)
    expect(state.days[0]!.hours.sleep).toBe(12)
    expect(state.eventDays).toHaveLength(EVENT_HISTORY_DAYS)
    expect(state.eventDays.at(-1)).toEqual([])
    expect(state.eventDays[0]).toHaveLength(24)
  })

  it('is deterministic', () => {
    expect(runLifeDays(createLife(), 20)).toEqual(runLifeDays(createLife(), 20))
  })

  it('holds every invariant every hour of a canonical run', () => {
    let state = createLife()
    for (let hour = 0; hour < 24 * 60; hour += 1) {
      state = stepLife(state)
      expect(lifeInvariantViolations(state)).toEqual([])
    }
  })

  it('reports a broken energy balance', () => {
    const state = stepLife(createLife())
    const broken = { ...state, forager: { ...state.forager, energyKcal: state.forager.energyKcal + 1 } }
    expect(lifeInvariantViolations(broken)[0]).toMatch(/Energy is not conserved/)
  })

  it('walks to food when hungry and the patch underfoot is empty', () => {
    const state = hoursUntil(
      createLife({ initialReserveKcal: 13_000 }),
      (current) => current.lastEvent?.action === 'forage',
    )
    expect(state.lastEvent?.tick).toBeGreaterThanOrEqual(6)
    expect(state.days.length).toBe(0)
  })
})
