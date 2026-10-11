import { describe, expect, it } from 'vitest'
import { LIFE0_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import { createLife, EVENT_HISTORY_DAYS, lastEventOf, runLifeDays, runLifeHours, stepLife } from './engine'
import { assertLifeInvariants, lifeInvariantViolations } from './invariants'
import type { Forager, LifeConfig, LifeState, Patch } from './types'
import { deriveLayoutSeed, deriveTurnOrderSeed, generateLayout, turnOrder, walkPath } from './world'

const LIFE0_CONFIG: LifeConfig = { ...LIFE_DEFAULT_CONFIG, ...LIFE0_WORLD }

const hoursUntil = (state: LifeState, predicate: (state: LifeState) => boolean, limit = 24 * 400) => {
  let current = state
  for (let hour = 0; hour < limit && !predicate(current); hour += 1) current = stepLife(current)
  return current
}

/** Replaces the world's patches and the foragers' positions and reserves, keeping the energy balance exact. */
function arrange(state: LifeState, patches: Patch[], foragers: Partial<Forager>[]): LifeState {
  const placed = state.foragers.map((forager, id) => ({
    ...forager,
    memory: patches.map((patch) => ({ stockKcal: patch.stockKcal, observedTick: 0 })),
    ...foragers[id],
  }))
  const initialKcal =
    patches.reduce((sum, patch) => sum + patch.stockKcal, 0) + placed.reduce((sum, f) => sum + f.energyKcal, 0)
  return { ...state, patches, foragers: placed, totals: { ...state.totals, initialKcal } }
}

describe('layout', () => {
  it('is deterministic for a seed and puts each patch on its own tile', () => {
    const a = generateLayout(LIFE0_CONFIG)
    expect(generateLayout(LIFE0_CONFIG)).toEqual(a)
    expect(new Set(a.patches.map((patch) => `${patch.tile.x},${patch.tile.y}`)).size).toBe(4)
    expect(a.patches.map((patch) => patch.id)).toEqual([0, 1, 2, 3])
    expect(generateLayout({ ...LIFE0_CONFIG, seed: 1 })).not.toEqual(a)
    expect(deriveLayoutSeed(LIFE0_CONFIG.seed)).not.toBe(LIFE0_CONFIG.seed)
  })

  it('lets the forager start anywhere, including on a patch', () => {
    const lone = generateLayout({ ...LIFE0_CONFIG, gridWidth: 1, gridHeight: 1, patchCount: 1 })
    expect(lone.starts).toEqual([lone.patches[0]!.tile])
    const startColumns = new Set(
      Array.from({ length: 40 }, (_, seed) => {
        const { starts } = generateLayout({ ...LIFE0_CONFIG, seed, gridWidth: 2, gridHeight: 1, patchCount: 1 })
        return starts[0]!.x
      }),
    )
    expect(startColumns).toEqual(new Set([0, 1]))
  })

  it('starts forager 0 where Life 0’s forager started, and lets foragers share a tile', () => {
    const band = generateLayout({ ...LIFE0_CONFIG, bandSize: 30 })
    expect(band.patches).toEqual(generateLayout(LIFE0_CONFIG).patches)
    expect(band.starts[0]).toEqual(generateLayout(LIFE0_CONFIG).starts[0])
    expect(band.starts).toHaveLength(30)
    expect(generateLayout({ ...LIFE0_CONFIG, bandSize: 30 })).toEqual(band)
    const crowded = generateLayout({ ...LIFE0_CONFIG, gridWidth: 2, gridHeight: 1, patchCount: 1, bandSize: 5 })
    expect(new Set(crowded.starts.map((tile) => tile.x)).size).toBeLessThan(5)
  })
})

describe('turn order', () => {
  it('is deterministic for a seed and hour, and differs across hours', () => {
    expect(turnOrder(1, 7, 10)).toEqual(turnOrder(1, 7, 10))
    expect([...turnOrder(1, 7, 10)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(turnOrder(1, 7, 10)).not.toEqual(turnOrder(1, 8, 10))
    expect(turnOrder(1, 7, 10)).not.toEqual(turnOrder(2, 7, 10))
    expect(deriveTurnOrderSeed(1, 0)).not.toBe(deriveLayoutSeed(1))
  })

  it('lets every forager act first in time', () => {
    const firsts = new Set(Array.from({ length: 200 }, (_, tick) => turnOrder(LIFE_DEFAULT_CONFIG.seed, tick, 10)[0]))
    expect(firsts.size).toBe(10)
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
    let state = createLife({ ...LIFE0_WORLD, gridWidth: 12, gridHeight: 1, patchCount: 2, initialReserveKcal: 10_000 })
    state = {
      ...arrange(
        state,
        [
          { id: 0, tile: { x: 0, y: 0 }, stockKcal: 0 },
          { id: 1, tile: { x: 11, y: 0 }, stockKcal: 8_000 },
        ],
        [{ position: { x: 0, y: 0 } }],
      ),
      tick: 17,
    }
    state = stepLife(state)
    expect(lastEventOf(state, 0)).toMatchObject({ action: 'walk', position: { x: 3, y: 0 }, targetPatchId: 1 })
    state = runLifeHours(state, 12)
    expect(lastEventOf(state, 0)).toMatchObject({ action: 'sleep', position: { x: 3, y: 0 } })
    expect(state.foragers[0]!.targetPatchId).toBe(1)
    state = stepLife(state)
    expect(lastEventOf(state, 0)).toMatchObject({
      tick: 30,
      action: 'walk',
      position: { x: 6, y: 0 },
      targetPatchId: 1,
    })
  })
})

describe('the hourly step', () => {
  const lone = { ...LIFE0_WORLD, gridWidth: 1, gridHeight: 1, patchCount: 1 }

  it('regrows patches up to their capacity and records only what was added', () => {
    const state = createLife({ ...lone, initialPatchStockKcal: 7_980 })
    const next = stepLife(state)
    expect(next.patches[0]!.stockKcal).toBe(8_000)
    expect(next.totals.regrownKcal).toBe(20)
  })

  it('forages a full hour, eats it at once and pays for the hour', () => {
    let state = createLife({ ...lone, initialReserveKcal: 10_000 })
    state = runLifeHours(state, 6)
    expect(lastEventOf(state, 0)).toMatchObject({ action: 'sleep', spentKcal: 60 })
    const before = state.foragers[0]!.energyKcal
    state = stepLife(state)
    expect(lastEventOf(state, 0)).toMatchObject({
      action: 'forage',
      reason: 'foraging',
      gatheredKcal: 1_200,
      spentKcal: 300,
    })
    expect(state.foragers[0]!.energyKcal).toBe(before + 900)
  })

  it('starves when its reserve cannot cover an hour, and stays dead', () => {
    let state = createLife({ ...lone, initialPatchStockKcal: 0 })
    // Fifty kilocalories cannot pay for an hour's sleep.
    state = arrange(state, state.patches, [{ energyKcal: 50 }])
    state = stepLife(state)
    expect(state.foragers[0]).toMatchObject({ alive: false, energyKcal: 0, deathTick: 0 })
    expect(lastEventOf(state, 0)).toMatchObject({ action: 'sleep', spentKcal: 50, energyAfterKcal: 0 })
    expect(state.eventDays.at(-1)!.at(-1)).toEqual({ kind: 'death', foragerId: 0, tick: 0, cause: 'starvation' })
    const later = runLifeHours(state, 30)
    expect(later.lastEvents).toEqual([])
    expect(later.foragers[0]!.energyKcal).toBe(0)
    expect(later.patches[0]!.stockKcal).toBe(31 * LIFE_DEFAULT_CONFIG.patchRegrowthKcalPerHour)
    assertLifeInvariants(later)
  })

  it('summarizes each day and keeps 30 days of events', () => {
    const state = runLifeDays(createLife(LIFE0_WORLD), 40)
    expect(state.days).toHaveLength(40)
    expect(state.today.day).toBe(40)
    for (const day of state.days) expect(Object.values(day.hours).reduce((a, b) => a + b, 0)).toBe(24)
    expect(state.days[0]!.hours.sleep).toBe(12)
    expect(state.days[0]).toMatchObject({ alive: 1, deaths: 0, endEnergyKcal: [expect.any(Number)] })
    expect(state.eventDays).toHaveLength(EVENT_HISTORY_DAYS)
    expect(state.eventDays.at(-1)).toEqual([])
    expect(state.eventDays[0]).toHaveLength(24)
  })

  it('walks to food when hungry and the patch underfoot is empty', () => {
    const state = hoursUntil(
      createLife({ ...LIFE0_WORLD, initialReserveKcal: 13_000 }),
      (current) => lastEventOf(current, 0)?.action === 'forage',
    )
    expect(lastEventOf(state, 0)?.tick).toBeGreaterThanOrEqual(6)
    expect(state.days.length).toBe(0)
  })
})

describe('a band', () => {
  // Two hungry foragers at noon on a patch holding exactly one hour's harvest.
  function sharedPatch(perceptionRadiusTiles = 0) {
    const state = createLife({
      ...LIFE0_WORLD,
      gridWidth: 6,
      gridHeight: 1,
      patchCount: 2,
      bandSize: 2,
      perceptionRadiusTiles,
      initialReserveKcal: 10_000,
      // Regrowth would refill the patch within the hour; this test is about who gets the food.
      patchRegrowthKcalPerHour: 1,
    })
    return {
      ...arrange(
        state,
        [
          { id: 0, tile: { x: 0, y: 0 }, stockKcal: 1_199 },
          { id: 1, tile: { x: 5, y: 0 }, stockKcal: 8_000 },
        ],
        [{ position: { x: 0, y: 0 } }, { position: { x: 0, y: 0 } }],
      ),
      tick: 12,
    }
  }

  it('gives the food to the first in turn order; the second sees it gone and walks on', () => {
    const state = sharedPatch()
    const next = stepLife(state)
    const [first, second] = turnOrder(state.config.seed, 12, 2)
    expect(lastEventOf(next, first!)).toMatchObject({ action: 'forage', gatheredKcal: 1_200 })
    expect(lastEventOf(next, second!)).toMatchObject({ action: 'walk', reason: 'seeking food', targetPatchId: 1 })
    expect(next.foragers[second!]!.memory[0]).toEqual({ stockKcal: 0, observedTick: 12 })
    expect(next.lastEvents.map((event) => event.foragerId)).toEqual([first, second])
    assertLifeInvariants(next)
  })

  it('perceives patches within the radius, and none beyond it', () => {
    const near = stepLife(sharedPatch(4))
    const far = stepLife(sharedPatch(5))
    const forager = (state: LifeState) => state.foragers.find((f) => lastEventOf(state, f.id)?.action === 'forage')!
    expect(forager(near).memory[1]!.observedTick).toBe(0)
    expect(forager(far).memory[1]).toEqual({ stockKcal: 8_000, observedTick: 12 })
  })

  it('chooses again when it sees its target emptied, and walks on when it cannot see it', () => {
    function walkingToEmptied(perceptionRadiusTiles: number) {
      const state = createLife({
        ...LIFE0_WORLD,
        gridWidth: 9,
        gridHeight: 1,
        patchCount: 3,
        perceptionRadiusTiles,
        initialReserveKcal: 10_000,
      })
      return {
        ...arrange(
          state,
          [
            { id: 0, tile: { x: 0, y: 0 }, stockKcal: 4_000 },
            { id: 1, tile: { x: 4, y: 0 }, stockKcal: 0 },
            { id: 2, tile: { x: 8, y: 0 }, stockKcal: 0 },
          ],
          [{ position: { x: 2, y: 0 }, targetPatchId: 1 }],
        ),
        tick: 12,
      }
    }
    // Remembered as full, it turns back towards patch 0 the moment it sees patch 1 is empty.
    const seeing = stepLife(walkingToEmptied(2))
    expect(lastEventOf(seeing, 0)).toMatchObject({ action: 'walk', position: { x: 0, y: 0 }, targetPatchId: null })
    const blind = stepLife(walkingToEmptied(0))
    expect(lastEventOf(blind, 0)).toMatchObject({ action: 'walk', position: { x: 4, y: 0 }, targetPatchId: null })
  })

  it('takes no more turns from the dead, and the others carry on', () => {
    let state = createLife({ ...LIFE0_WORLD, bandSize: 3 })
    state = arrange(state, state.patches, [{ energyKcal: 50 }])
    state = stepLife(state)
    expect(state.foragers.map((forager) => forager.alive)).toEqual([false, true, true])
    expect(state.lastEvents).toHaveLength(3)
    expect(state.today).toMatchObject({ alive: 2, deaths: 1 })
    state = stepLife(state)
    expect(state.lastEvents.map((event) => event.foragerId).sort()).toEqual([1, 2])
    assertLifeInvariants(state)
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
    expect(state.days.at(-1)!.alive).toBeLessThan(LIFE_DEFAULT_CONFIG.bandSize)
  })

  it('reports a broken energy balance, a stale memory and a missing turn', () => {
    const state = stepLife(createLife())
    const foragers = [...state.foragers]
    foragers[0] = { ...foragers[0]!, energyKcal: foragers[0]!.energyKcal + 1 }
    expect(lifeInvariantViolations({ ...state, foragers })[0]).toMatch(/Energy is not conserved/)
    const actor = state.lastEvents[0]!
    const stale = [...state.foragers]
    stale[actor.foragerId] = {
      ...stale[actor.foragerId]!,
      memory: stale[actor.foragerId]!.memory.map((memory) => ({ ...memory, observedTick: -1 })),
    }
    const near = state.patches.some((patch) => {
      const { x, y } = actor.from
      return Math.abs(patch.tile.x - x) + Math.abs(patch.tile.y - y) <= state.config.perceptionRadiusTiles
    })
    if (near) expect(lifeInvariantViolations({ ...state, foragers: stale }).join()).toMatch(/does not match/)
    expect(lifeInvariantViolations({ ...state, lastEvents: state.lastEvents.slice(1) }).join()).toMatch(/turns/)
  })
})
