import { describe, expect, it } from 'vitest'
import { LIFE1_WORLD, LIFE2_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import { createLife, runLifeDays, stepLife } from './engine'
import { decide, walkTarget } from './forager'
import type { Forager, LifeConfig, Patch, Tile } from './types'
import { campTile, generateLayout, isDaylight, mustGoHome, reachableInTime, sameTile, strategyOf } from './world'

// The canonical world: a 12 × 12 grid with the camp at (6, 6), walking 3 tiles an hour, dusk at 18.
const config: LifeConfig = { ...LIFE_DEFAULT_CONFIG, ...LIFE2_WORLD }
const camp = { x: 6, y: 6 }

const patch = (id: number, x: number, y: number, stockKcal = 24_000): Patch => ({ id, tile: { x, y }, stockKcal })

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
  foragingSkill: 100,
  woodSkill: 100,
  forageRate: 1_200,
  woodRate: 24,
  practiceLog: { forage: [], gather: [] },
  hoursToday: { forage: 0, gather: 0 },
  loggedHours: { forage: 0, gather: 0 },
  wood: 0,
  shortOfWood: false,
  targetGroveId: null,
  groveMemory: [],
  heardTerms: null,
  trip: null,
  swapTotals: { woodSold: 0, woodBought: 0, kcalReceived: 0, kcalPaid: 0 },
  hoursWorked: { forage: 0, gather: 0 },
  ...overrides,
})

describe('the camp', () => {
  it('is the middle tile, and only with a camp', () => {
    expect(campTile(config)).toEqual(camp)
    expect(campTile({ ...config, gridWidth: 5, gridHeight: 1 })).toEqual({ x: 2, y: 0 })
    expect(campTile({ ...config, hasCamp: false })).toBeNull()
  })

  it('is where every forager starts; without one, starting tiles are Life 1’s', () => {
    expect(generateLayout(config).starts).toEqual(Array.from({ length: 12 }, () => camp))
    const life1 = { ...config, ...LIFE1_WORLD }
    expect(generateLayout(life1).starts).toHaveLength(40)
    expect(new Set(generateLayout(life1).starts.map((tile) => `${tile.x},${tile.y}`)).size).toBeGreaterThan(20)
    // Patches are laid out the same way with or without the camp.
    expect(generateLayout({ ...config, hasCamp: false }).patches).toEqual(generateLayout(config).patches)
  })

  it('assigns keepers, then sharers, then reciprocators by ID', () => {
    expect(Array.from({ length: 12 }, (_, id) => strategyOf(config, id))).toEqual([
      ...Array(4).fill('keeper'),
      ...Array(4).fill('sharer'),
      ...Array(4).fill('reciprocator'),
    ])
  })
})

describe('going home', () => {
  it('starts exactly when the walk home takes every daylight hour left', () => {
    // From (0, 0) home is 12 tiles, 4 hours' walk: at 13:00 five hours remain, at 14:00 four.
    expect(mustGoHome(config, { x: 0, y: 0 }, 13)).toBe(false)
    expect(mustGoHome(config, { x: 0, y: 0 }, 14)).toBe(true)
    // One tile away, it leaves in the last hour of daylight.
    expect(mustGoHome(config, { x: 6, y: 5 }, 16)).toBe(false)
    expect(mustGoHome(config, { x: 6, y: 5 }, 17)).toBe(true)
    expect(mustGoHome(config, camp, 17)).toBe(false)
    // Away at night, it goes home; without a camp it never must.
    expect(mustGoHome(config, { x: 6, y: 5 }, 22)).toBe(true)
    expect(mustGoHome({ ...config, hasCamp: false }, { x: 0, y: 0 }, 17)).toBe(false)
  })

  it('comes before sleeping and foraging', () => {
    const patches = [patch(0, 0, 0)]
    expect(decide(config, forager({ x: 0, y: 0 }), patches, [], 14)).toMatchObject({
      action: 'walk',
      reason: 'going home',
    })
    expect(decide(config, forager({ x: 0, y: 0 }), patches, [], 13)).toMatchObject({
      action: 'forage',
      reason: 'foraging',
    })
    expect(decide(config, forager({ x: 6, y: 5 }), patches, [], 2)).toMatchObject({
      action: 'walk',
      reason: 'going home',
    })
    expect(decide(config, forager(camp), patches, [], 2)).toMatchObject({ action: 'sleep', reason: 'night' })
    expect(walkTarget(config, forager({ x: 0, y: 0 }), patches, [], 14, 'food')).toEqual({
      tile: camp,
      patch: null,
      grove: null,
    })
  })

  it('brings every living forager home by nightfall, every night', () => {
    let state = createLife(LIFE2_WORLD)
    for (let hour = 0; hour < 24 * 30; hour += 1) {
      state = stepLife(state)
      if (!isDaylight(config, state.tick - 1))
        for (const living of state.foragers.filter((f) => f.alive)) expect(living.position).toEqual(camp)
    }
    expect(state.lastEvents.length).toBeGreaterThan(0)
  })
})

describe('setting out', () => {
  // (0, 0) is 12 tiles from camp, 4 hours' walk each way.
  const far = patch(1, 0, 0)

  it('goes only where it can forage an hour and still walk home by dusk', () => {
    // From camp at 8:00: 4 hours out, 1 foraging, 4 back = 9 hours, and 10 remain.
    expect(reachableInTime(config, camp, far.tile, 8)).toBe(true)
    expect(reachableInTime(config, camp, far.tile, 9)).toBe(true)
    expect(reachableInTime(config, camp, far.tile, 10)).toBe(false)
    expect(reachableInTime({ ...config, hasCamp: false }, camp, far.tile, 17)).toBe(true)
  })

  it('rests at camp when it is too late to set out', () => {
    const patches = [patch(0, 6, 6, 0), far]
    expect(decide(config, forager(camp), patches, [], 9)).toMatchObject({ action: 'walk', reason: 'seeking food' })
    expect(decide(config, forager(camp), patches, [], 10)).toMatchObject({
      action: 'rest',
      reason: 'too late to set out',
    })
    expect(decide(config, forager(camp), [patch(0, 6, 6, 0)], [], 10)).toMatchObject({
      action: 'rest',
      reason: 'waiting for regrowth',
    })
  })

  it('drops a target it can no longer reach in time, and chooses among those it can', () => {
    const near = patch(0, 6, 3)
    const memory = [
      { stockKcal: 6_000, observedTick: 0 },
      { stockKcal: 24_000, observedTick: 0 },
    ]
    const walking = forager({ x: 6, y: 4 }, { targetPatchId: 1, memory })
    // At 9:00 the far patch is still in reach and kept; at 12:00 it is not, so it takes the near one.
    expect(walkTarget(config, walking, [near, far], [], 9, 'food')?.patch?.id).toBe(1)
    expect(walkTarget(config, walking, [near, far], [], 12, 'food')?.patch?.id).toBe(0)
  })
})

describe('a camp band', () => {
  it('sleeps at camp and forages by day', () => {
    const state = runLifeDays(createLife(LIFE2_WORLD), 10)
    expect(state.days.every((day) => day.hours.sleep >= day.alive * 12)).toBe(true)
    expect(state.totals.gatheredKcal).toBeGreaterThan(0)
    expect(state.foragers.every((f) => !f.alive || sameTile(f.position, camp))).toBe(true)
  })
})
