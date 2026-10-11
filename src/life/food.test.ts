import { describe, expect, it } from 'vitest'
import { LIFE2_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import { createLife, lastEventOf, stepLife } from './engine'
import { addLots, carriedKcal, spoil, takeOldest } from './food'
import { assertLifeInvariants } from './invariants'
import type { Forager, LifeState } from './types'
import { deriveLuckSeed, forageSucceeds } from './world'

/** Replaces foragers' fields, keeping the energy balance exact by restating what the run started with. */
function arrange(state: LifeState, foragers: Partial<Forager>[]): LifeState {
  const placed = state.foragers.map((forager, id) => ({ ...forager, ...foragers[id] }))
  const initialKcal =
    state.patches.reduce((sum, patch) => sum + patch.stockKcal, 0) +
    placed.reduce((sum, forager) => sum + forager.energyKcal + carriedKcal(forager.carried), 0)
  return { ...state, foragers: placed, totals: { ...state.totals, initialKcal } }
}

describe('carried food', () => {
  const lots = [
    { kcal: 500, harvestTick: 10 },
    { kcal: 2_000, harvestTick: 20 },
  ]

  it('spoils exactly the shelf life after its harvest, and never with a shelf life of 0', () => {
    expect(spoil(lots, 57, 48)).toEqual({ lots, spoiledKcal: 0 })
    expect(spoil(lots, 58, 48)).toEqual({ lots: [lots[1]], spoiledKcal: 500 })
    expect(spoil(lots, 68, 48)).toEqual({ lots: [], spoiledKcal: 2_500 })
    expect(spoil(lots, 10_000, 0)).toEqual({ lots, spoiledKcal: 0 })
  })

  it('is taken oldest first, splitting a lot without losing its harvest tick', () => {
    expect(takeOldest(lots, 800)).toEqual({
      taken: [
        { kcal: 500, harvestTick: 10 },
        { kcal: 300, harvestTick: 20 },
      ],
      rest: [{ kcal: 1_700, harvestTick: 20 }],
      takenKcal: 800,
    })
    expect(takeOldest(lots, 0)).toEqual({ taken: [], rest: lots, takenKcal: 0 })
    expect(takeOldest(lots, 9_999).takenKcal).toBe(2_500)
  })

  it('stays oldest first when lots are added', () => {
    expect(addLots(lots, [{ kcal: 7, harvestTick: 15 }]).map((lot) => lot.harvestTick)).toEqual([10, 15, 20])
  })
})

describe('luck', () => {
  it('is deterministic for a seed, hour and forager, and differs across them', () => {
    expect(deriveLuckSeed(1, 7, 2)).toBe(deriveLuckSeed(1, 7, 2))
    expect(deriveLuckSeed(1, 7, 2)).not.toBe(deriveLuckSeed(1, 8, 2))
    expect(deriveLuckSeed(1, 7, 2)).not.toBe(deriveLuckSeed(1, 7, 3))
    expect(deriveLuckSeed(1, 7, 2)).not.toBe(deriveLuckSeed(2, 7, 2))
  })

  it('always succeeds when a harvest is one hour’s food, and otherwise at the expected rate', () => {
    const life2 = { ...LIFE_DEFAULT_CONFIG, ...LIFE2_WORLD }
    const steady = { ...life2, harvestKcal: life2.forageKcalPerHour }
    for (let tick = 0; tick < 500; tick += 1) expect(forageSucceeds(steady, tick, 0, 1_200)).toBe(true)
    let successes = 0
    const draws = 40_000
    for (let tick = 0; tick < draws; tick += 1) if (forageSucceeds(life2, tick, tick % 12, 1_200)) successes += 1
    // p = 0.2; the standard error over 40,000 draws is 0.002.
    expect(Math.abs(successes / draws - 0.2)).toBeLessThan(0.006)
  })
})

describe('eating and harvesting', () => {
  // A lone forager with no camp on a patch holding windfalls, hungry at 9 in the morning.
  const lone = {
    ...LIFE2_WORLD,
    gridWidth: 1,
    gridHeight: 1,
    patchCount: 1,
    bandSize: 1,
    sharers: 0,
    reciprocators: 0,
    hasCamp: false,
    initialReserveKcal: 10_000,
  }
  const at = (tick: number) => ({ ...createLife({ ...lone }), tick })

  const firstTick = (succeeds: boolean) => {
    for (let tick = 9; tick < 18 * 24; tick += 24)
      if (forageSucceeds(at(0).config, tick, 0, 1_200) === succeeds) return tick
    throw new Error('no such hour')
  }

  it('takes a full harvest on success, eats what its reserve has room for and carries the rest', () => {
    const tick = firstTick(true)
    const next = stepLife(at(tick))
    expect(lastEventOf(next, 0)).toMatchObject({ action: 'forage', succeeded: true, gatheredKcal: 6_000 })
    // 10,000 + 6,000 fits within the 20,000 reserve: nothing is carried.
    expect(next.foragers[0]!.carried).toEqual([])
    const nearlyFull = stepLife(arrange(at(tick), [{ energyKcal: 17_000 }]))
    expect(nearlyFull.foragers[0]!.carried).toEqual([{ kcal: 3_000, harvestTick: tick }])
    expect(nearlyFull.foragers[0]!.energyKcal).toBe(20_000 - 300)
    assertLifeInvariants(nearlyFull)
  })

  it('takes nothing on failure, and pays for the hour', () => {
    const tick = firstTick(false)
    const next = stepLife(at(tick))
    expect(lastEventOf(next, 0)).toMatchObject({ action: 'forage', succeeded: false, gatheredKcal: 0, spentKcal: 300 })
    expect(next.patches[0]!.stockKcal).toBe(24_000)
    assertLifeInvariants(next)
  })

  it('eats what it carries at the start of its turn, oldest first, up to a full reserve', () => {
    const carried = [
      { kcal: 1_000, harvestTick: 1 },
      { kcal: 4_000, harvestTick: 2 },
    ]
    const next = stepLife(arrange(at(3), [{ energyKcal: 17_000, carried }]))
    expect(lastEventOf(next, 0)).toMatchObject({ action: 'sleep', eatenKcal: 3_000, carriedAfterKcal: 2_000 })
    expect(next.foragers[0]!.carried).toEqual([{ kcal: 2_000, harvestTick: 2 }])
    assertLifeInvariants(next)
  })

  it('loses carried food to spoilage before eating it', () => {
    const state = arrange(at(60), [{ energyKcal: 17_000, carried: [{ kcal: 5_000, harvestTick: 12 }] }])
    const next = stepLife(state)
    expect(lastEventOf(next, 0)).toMatchObject({ spoiledKcal: 5_000, eatenKcal: 0 })
    expect(next.totals.spoiledKcal).toBe(5_000)
    assertLifeInvariants(next)
  })
})
