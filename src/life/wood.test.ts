import { describe, expect, it } from 'vitest'
import { LIFE2_WORLD, LIFE3_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import { createLife, stepLife } from './engine'
import { life2Seeds, woodAndColdExperiment } from './experiments'
import { decide } from './forager'
import { lifeInvariantViolations } from './invariants'
import type { Forager, Grove, LifeConfig, Tile } from './types'
import { nextShortOfWood, nightWood, sleepHour, spareWood, wantedWood, woodMatters, woodTarget } from './wood'
import { ratesOf, startingLog } from './practice'
import { drawSkills, forageSucceeds, generateLayout, harvestOf } from './world'

// Life 3's world: 12 night hours, so a night's wood is 12 units and the target 24.
const config: LifeConfig = { ...LIFE_DEFAULT_CONFIG, ...LIFE3_WORLD }
const camp = { x: 6, y: 6 }

const forager = (position: Tile, overrides: Partial<Forager> = {}): Forager => ({
  id: 0,
  position,
  energyKcal: 16_000,
  hungry: false,
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
  shortOfWood: true,
  targetGroveId: null,
  groveMemory: [],
  heardTerms: null,
  trip: null,
  swapTotals: { woodSold: 0, woodBought: 0, kcalReceived: 0, kcalPaid: 0 },
  hoursWorked: { forage: 0, gather: 0 },
  ...overrides,
})

const grove = (id: number, x: number, y: number, wood = 200): Grove => ({ id, tile: { x, y }, wood })

describe('wood need', () => {
  it('matters only with groves and cold nights', () => {
    expect(woodMatters(config)).toBe(true)
    expect(woodMatters({ ...config, groveCount: 0 })).toBe(false)
    expect(woodMatters({ ...config, coldSleepKcalPerHour: config.sleepKcalPerHour })).toBe(false)
    expect(nightWood(config)).toBe(12)
    expect(woodTarget(config)).toBe(24)
  })

  it('starts below a night’s wood and lasts until the target', () => {
    expect(nextShortOfWood(config, 11, false)).toBe(true)
    expect(nextShortOfWood(config, 12, false)).toBe(false)
    expect(nextShortOfWood(config, 23, true)).toBe(true)
    expect(nextShortOfWood(config, 24, true)).toBe(false)
    expect(nextShortOfWood({ ...config, groveCount: 0 }, 0, true)).toBe(false)
  })

  it('counts spare wood above the target and wanted wood below it', () => {
    expect(spareWood(config, forager(camp, { wood: 30 }))).toBe(6)
    expect(wantedWood(config, forager(camp, { wood: 30 }))).toBe(0)
    expect(spareWood(config, forager(camp, { wood: 10 }))).toBe(0)
    expect(wantedWood(config, forager(camp, { wood: 10 }))).toBe(14)
  })
})

describe('sleeping', () => {
  it('is warm while a forager burns a fire’s worth, and cold without it', () => {
    expect(sleepHour(config, 1)).toEqual({ burnedWood: 1, sleptCold: false, costKcal: 60 })
    expect(sleepHour(config, 0)).toEqual({ burnedWood: 0, sleptCold: true, costKcal: 150 })
    expect(sleepHour({ ...config, fireWoodPerHour: 2 }, 1)).toEqual({ burnedWood: 0, sleptCold: true, costKcal: 150 })
    // With warm nights there is nothing to burn and nothing to fear.
    const life2 = { ...config, ...LIFE2_WORLD }
    expect(sleepHour(life2, 5)).toEqual({ burnedWood: 0, sleptCold: false, costKcal: 60 })
  })

  it('burns a unit an hour through the night, and costs more once the wood runs out', () => {
    let state = createLife({ ...LIFE3_WORLD, bandSize: 1 })
    state = { ...state, tick: 18, foragers: [{ ...state.foragers[0]!, wood: 5, shortOfWood: false }] }
    for (let hour = 0; hour < 12; hour += 1) state = stepLife(state)
    const nights = state.eventDays.flat().filter((event) => event.kind === 'action' && event.action === 'sleep')
    expect(nights.map((event) => event.kind === 'action' && event.burnedWood)).toEqual([
      ...Array(5).fill(1),
      ...Array(7).fill(0),
    ])
    expect(nights.map((event) => event.kind === 'action' && event.spentKcal)).toEqual([
      ...Array(5).fill(60),
      ...Array(7).fill(150),
    ])
    expect(state.foragers[0]!.wood).toBe(0)
  })
})

describe('groves and skills', () => {
  it('take the tiles after the patches, so no patch moves', () => {
    const { patches, groves } = generateLayout(config)
    expect(groves).toHaveLength(8)
    expect(generateLayout({ ...config, groveCount: 0 }).patches).toEqual(patches)
    const tiles = new Set([...patches, ...groves].map(({ tile }) => `${tile.x},${tile.y}`))
    expect(tiles.size).toBe(40)
    expect(groves.every((one) => one.wood === 200)).toBe(true)
  })

  it('are drawn from their own stream, within range, and 100% gives the base rates', () => {
    const skills = drawSkills(config)
    expect(drawSkills(config)).toEqual(skills)
    expect(drawSkills({ ...config, seed: 2 })).not.toEqual(skills)
    const rates = skills.map(({ foragingSkill, woodSkill }) =>
      ratesOf(config, foragingSkill, woodSkill, startingLog(config)),
    )
    for (const { forageRate, woodRate } of rates) {
      expect(forageRate).toBeGreaterThanOrEqual(600)
      expect(forageRate).toBeLessThanOrEqual(1_800)
      expect(woodRate).toBeGreaterThanOrEqual(12)
      expect(woodRate).toBeLessThanOrEqual(36)
    }
    expect(new Set(rates.map((rate) => rate.forageRate)).size).toBeGreaterThan(1)
    const equal = drawSkills({ ...config, skillMinPercent: 100, skillMaxPercent: 100 })
    expect(equal.every((skill) => skill.foragingSkill === 100 && skill.woodSkill === 100)).toBe(true)
    expect(createLife(LIFE3_WORLD).foragers.map(({ forageRate, woodRate }) => ({ forageRate, woodRate }))).toEqual(
      rates,
    )
  })

  it('give each forager its own harvest, which is steady when its rate reaches harvestKcal', () => {
    expect(harvestOf(config, 600)).toBe(600)
    expect(harvestOf(config, 1_500)).toBe(1_500)
    expect(harvestOf({ ...config, harvestKcal: 6_000 }, 1_500)).toBe(6_000)
    for (let tick = 0; tick < 200; tick += 1) expect(forageSucceeds(config, tick, 3, 600)).toBe(true)
    let successes = 0
    for (let tick = 0; tick < 20_000; tick += 1)
      if (forageSucceeds({ ...config, harvestKcal: 6_000 }, tick, 1, 1_500)) successes += 1
    expect(Math.abs(successes / 20_000 - 0.25)).toBeLessThan(0.01)
  })
})

describe('gathering', () => {
  const groves = [grove(0, 6, 6), grove(1, 0, 0)]

  it('happens only on a grove holding an hour’s wood, for a forager short of wood', () => {
    expect(decide(config, forager(camp), [], groves, 9)).toMatchObject({ action: 'gather', good: 'wood' })
    expect(decide(config, forager(camp), [], [grove(0, 6, 6, 23), grove(1, 0, 0)], 9)).toMatchObject({
      action: 'walk',
      reason: 'seeking wood',
    })
    expect(decide(config, forager(camp, { shortOfWood: false }), [], groves, 9)).toMatchObject({ reason: 'satiated' })
  })

  it('sets out only for a grove it can gather at and return from before dusk', () => {
    // (0, 0) is 4 hours' walk from camp each way.
    expect(decide(config, forager(camp), [], [grove(0, 6, 6, 0), grove(1, 0, 0)], 9)).toMatchObject({ action: 'walk' })
    expect(decide(config, forager(camp), [], [grove(0, 6, 6, 0), grove(1, 0, 0)], 10)).toMatchObject({
      action: 'rest',
      reason: 'too late to set out',
    })
  })

  it('takes exactly the forager’s rate from the grove, and wood is conserved', () => {
    let state = createLife({ ...LIFE3_WORLD, bandSize: 1, skillMinPercent: 100, skillMaxPercent: 100 })
    const first = state.groves[0]!
    state = { ...state, tick: 9, foragers: [{ ...state.foragers[0]!, position: first.tile, energyKcal: 16_000 }] }
    state = stepLife(state)
    expect(state.lastEvents[0]).toMatchObject({ action: 'gather', gatheredWood: 24, patchId: 0, woodAfter: 24 })
    expect(state.groves[0]!.wood).toBe(200 - 24)
    expect(lifeInvariantViolations(state)).toEqual([])
    const leaked = { ...state, foragers: [{ ...state.foragers[0]!, wood: 25 }] }
    expect(lifeInvariantViolations(leaked).join()).toMatch(/Wood is not conserved/)
  })
})

describe('a canonical Life 3 band', () => {
  it('holds every invariant every hour, gathers and burns wood, and swaps', () => {
    let state = createLife(LIFE3_WORLD)
    for (let hour = 0; hour < 24 * 30; hour += 1) {
      state = stepLife(state)
      expect(lifeInvariantViolations(state)).toEqual([])
    }
    expect(state.totals.burnedWood).toBeGreaterThan(0)
    expect(state.totals.swappedWood).toBeGreaterThan(0)
    expect(state.days.some((day) => day.hours.gather > 0)).toBe(true)
  })
})

describe('Life 3 experiment 2: wood and cold', () => {
  const result = woodAndColdExperiment(life2Seeds(8))

  it('swaps and quotes nothing with equal skills, hour for hour the same as without swapping', () => {
    expect(result.on.swapsPerRun).toBe(0)
    expect(result.on.quotesPerRun).toBe(0)
    expect(result.identical.every(Boolean)).toBe(true)
  })

  it('keeps the band intact, sleeping cold in fewer than a quarter of its night hours', () => {
    for (const run of result.on.runs) expect(run.survived).toBe(true)
    expect(result.on.coldShare).toBeLessThan(0.25)
  })
})
