import { describe, expect, it } from 'vitest'
import { LIFE0_WORLD, LIFE2_WORLD, LIFE_DEFAULT_CONFIG } from '../life/config'
import { createLife, lastEventOf, runLifeHours, stepLife } from '../life/engine'
import type { LifeConfig, LifeState } from '../life/types'
import {
  advanceClock,
  aliveCount,
  BERRIES_PER_BUSH,
  berryFills,
  bundleScale,
  clockLabel,
  currentGifts,
  currentSwaps,
  daylightAt,
  describeActivity,
  fireSaving,
  displayedCarried,
  displayedStock,
  displayedWood,
  fillInTurn,
  foragerColor,
  foragerName,
  foragerPose,
  foragerSummary,
  giftArcPoint,
  giftEnds,
  groveInspection,
  hearthAt,
  isCamp,
  logScale,
  MAX_FRAME_SECONDS,
  ownTermsPosition,
  pairOffsets,
  patchInspection,
  perceptionOutline,
  SITE_RADIUS,
  sitePlants,
  specializationPoints,
  STAND_TREES,
  standingOffsets,
  stepFollowed,
  STRATEGY_COLORS,
  swapEnds,
  TERMS_COLORS,
  THICKET_BUSHES,
  tradeSummary,
  treeFills,
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

  it('carry their food as berries, picked bush by bush from the outside in', () => {
    const berries = THICKET_BUSHES * BERRIES_PER_BUSH
    expect(berryFills(24_000, 24_000)).toEqual(Array(berries).fill(1))
    expect(berryFills(0, 24_000)).toEqual(Array(berries).fill(0))
    const half = berryFills(12_000, 24_000)
    expect(half.slice(0, berries / 2)).toEqual(Array(berries / 2).fill(1))
    expect(half.slice(berries / 2)).toEqual(Array(berries / 2).fill(0))
  })
})

describe('sites', () => {
  it('stand inside their tile, the same in every run, and differ between kinds and IDs', () => {
    for (const kind of ['patch', 'grove'] as const)
      for (const id of [0, 1, 7, 31]) {
        const plants = sitePlants(kind, id, 6)
        expect(plants).toHaveLength(6)
        expect(sitePlants(kind, id, 6)).toEqual(plants)
        for (const plant of plants) expect(Math.hypot(plant.x, plant.z)).toBeLessThanOrEqual(SITE_RADIUS)
      }
    expect(sitePlants('patch', 1, 6)).not.toEqual(sitePlants('patch', 0, 6))
    expect(sitePlants('grove', 0, 6)).not.toEqual(sitePlants('patch', 0, 6))
  })

  it('share an amount out part by part, adding up to its share of capacity', () => {
    expect(fillInTurn(50, 100, 4)).toEqual([1, 1, 0, 0])
    expect(fillInTurn(-5, 100, 3)).toEqual([0, 0, 0])
    expect(fillInTurn(500, 100, 3)).toEqual([1, 1, 1])
    const fills = fillInTurn(2_900, 8_000, 7)
    expect(fills.reduce((sum, fill) => sum + fill, 0)).toBeCloseTo((2_900 / 8_000) * 7, 9)
  })
})

describe('words', () => {
  it('describes what the forager is doing', () => {
    expect(describeActivity(pairAt(hungryAtDusk(), 0.5), 0)).toBe('Walking to patch 2')
    expect(describeActivity(pairAt(createLife(LIFE2_WORLD), 0.5), 7)).toBe('Sleeping through the night')
    // A Life 3 band starts with no wood, so its first night is cold.
    expect(describeActivity(pairAt(createLife(), 0.5), 7)).toBe('Sleeping cold, with no wood to burn')
    expect(foragerName(0)).toBe('Forager 1')
  })

  it('says what a night’s fire burns and saves, only where nights are cold and wood grows', () => {
    // 12 hours of night at 1 unit an hour, each hour 150 − 60 kcal cheaper than sleeping cold.
    expect(fireSaving(createLife().config)).toEqual({ wood: 12, kcal: 1_080 })
    expect(fireSaving(createLife(LIFE2_WORLD).config)).toBeNull()
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

describe('sharing on screen', () => {
  /** The canonical band at midnight: forager 4, a sharer, carries 3,000 kcal with a full reserve; forager 0 is hungry. */
  function campWithFood(): LifeState {
    const state = createLife(LIFE2_WORLD)
    const foragers = state.foragers.map((forager) =>
      forager.id === 4
        ? { ...forager, energyKcal: 20_000, hungry: false, carried: [{ kcal: 3_000, harvestTick: 0 }] }
        : forager.id === 0
          ? { ...forager, energyKcal: 9_000, hungry: true }
          : forager,
    )
    const initialKcal = state.totals.initialKcal - 16_000 * 2 + 20_000 + 3_000 + 9_000
    return { ...state, foragers, totals: { ...state.totals, initialKcal } }
  }

  it('draws a bundle sized by what a forager carries, and none when it carries nothing', () => {
    expect(bundleScale(0, 6_000)).toBe(0)
    expect(bundleScale(1_500, 6_000)).toBeCloseTo(0.75, 9)
    expect(bundleScale(60_000, 6_000)).toBe(1)
  })

  it('shows the gifts of the hour being drawn, moving along an arc that peaks halfway', () => {
    const pair = pairAt(campWithFood(), 0.5)
    const gifts = currentGifts(pair)
    expect(gifts).toHaveLength(1)
    expect(gifts[0]).toMatchObject({ giverId: 4, recipientId: 0, kcal: 3_000 })
    expect(displayedCarried(pair, 4)).toBe(1_500)
    expect(displayedCarried(pair, 4, false)).toBe(0)
    expect(currentGifts(pairAt(pair.next, 0.5))).toEqual([])
    // The arc runs between the two on the camp tile, where the gift was made.
    const { from, to } = giftEnds(gifts[0]!, pairOffsets(pair))
    expect(Math.hypot(from.x - 6, from.y - 6)).toBeLessThan(0.5)
    expect(Math.hypot(to.x - 6, to.y - 6)).toBeLessThan(0.5)
    expect(from).not.toEqual(to)
    const middle = giftArcPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.5)
    expect(middle.x).toBe(0.5)
    expect(middle.height).toBeGreaterThan(giftArcPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, 0).height)
  })

  it('summarizes a forager’s strategy, food and gifts', () => {
    const state = stepLife(campWithFood())
    expect(foragerSummary(state, 4)).toMatchObject({
      strategy: 'Sharer',
      rule: 'gives to anyone hungry',
      carriedKcal: 0,
      spoilsInHours: null,
      givenKcal: 3_000,
    })
    // Forager 0 received the gift. If its turn came after the gift it has eaten it; if before, it carries it until its
    // next turn, and the food, harvested at tick 0, keeps for 47 more hours.
    const recipient = foragerSummary(state, 0)
    expect(recipient).toMatchObject({ strategy: 'Keeper', receivedKcal: 3_000 })
    if (recipient.carriedKcal) expect(recipient).toMatchObject({ carriedKcal: 3_000, spoilsInHours: 47 })
    else expect(state.lastEvents.find((event) => event.foragerId === 0)!.eatenKcal).toBe(3_000)
    expect(STRATEGY_COLORS.sharer).not.toBe(STRATEGY_COLORS.keeper)
  })

  it('knows the camp, and describes the walk home', () => {
    const state = createLife(LIFE2_WORLD)
    expect(isCamp(state, { x: 6, y: 6 })).toBe(true)
    expect(isCamp(state, { x: 0, y: 0 })).toBe(false)
    expect(isCamp(createLife(LIFE0_WORLD), { x: 6, y: 6 })).toBe(false)
    const away = {
      ...state,
      tick: 17,
      foragers: state.foragers.map((forager) => ({ ...forager, position: { x: 6, y: 5 } })),
    }
    expect(describeActivity(pairAt(away, 0.5), 0)).toBe('Walking home to camp')
    expect(LIFE_DEFAULT_CONFIG.hasCamp).toBe(true)
  })
})

describe('specialization on screen', () => {
  /** The canonical band at 20:00: forager 0 holds spare wood and forager 1 wants wood and carries food to pay. */
  function campReadyToSwap(): LifeState {
    const state = createLife()
    const [seller, buyer] = [...state.foragers]
      .sort((a, b) => a.forageRate * b.woodRate - b.forageRate * a.woodRate)
      .filter((_, index, sorted) => index === 0 || index === sorted.length - 1)
    const foragers = state.foragers.map((forager) =>
      forager.id === seller!.id
        ? { ...forager, wood: 60, energyKcal: 15_000 }
        : forager.id === buyer!.id
          ? { ...forager, wood: 0, energyKcal: 20_000, carried: [{ kcal: 4_000, harvestTick: 19 }] }
          : { ...forager, wood: 24 },
    )
    return { ...state, tick: 20, foragers }
  }

  it('fells trees to stumps one at a time, and sizes log stacks, which never vanish while there is wood', () => {
    expect(treeFills(200, 200)).toEqual(Array(STAND_TREES).fill(1))
    expect(treeFills(0, 200)).toEqual(Array(STAND_TREES).fill(0))
    expect(treeFills(120, 200)).toEqual([1, 1, 1, 0, 0])
    expect(logScale(0, 24)).toBe(0)
    expect(logScale(6, 24)).toBeCloseTo(0.725, 9)
    expect(logScale(100, 24)).toBe(1)
  })

  it('colours foragers by own terms, from gatherers to foragers', () => {
    const { config, foragers } = createLife()
    const at = (forageRate: number, woodRate: number) =>
      ownTermsPosition(config, { ...foragers[0]!, forageRate, woodRate })
    expect(at(600, 36)).toBe(0)
    expect(at(1_800, 12)).toBe(1)
    expect(at(1_200, 24)).toBeCloseTo(0.5, 9)
    expect(ownTermsPosition({ ...config, skillMinPercent: 100, skillMaxPercent: 100 }, foragers[0]!)).toBe(0.5)
    expect(foragerColor(config, { ...foragers[0]!, forageRate: 600, woodRate: 36 })).toBe(TERMS_COLORS.gatherer)
    expect(foragerColor(config, { ...foragers[0]!, forageRate: 1_800, woodRate: 12 })).toBe(TERMS_COLORS.forager)
  })

  it('shows the swaps of the hour being drawn, between the two on the swap’s tile', () => {
    const before = campReadyToSwap()
    const pair = pairAt(before, 0.5)
    const swaps = currentSwaps(pair)
    expect(swaps.length).toBeGreaterThan(0)
    const { from, to } = swapEnds(swaps[0]!, pairOffsets(pair))
    expect(Math.hypot(from.x - 6, from.y - 6)).toBeLessThan(0.5)
    expect(Math.hypot(to.x - 6, to.y - 6)).toBeLessThan(0.5)
    expect(from).not.toEqual(to)
    const seller = swaps[0]!.sellerId
    // The seller burns a unit for the night and sells; the display is halfway between.
    const after = pair.next.foragers[seller]!.wood
    expect(displayedWood(pair, seller)).toBeCloseTo((60 + after) / 2, 9)
    expect(currentSwaps(pairAt(pair.next, 0.5)).every((made) => made.tick === pair.next.tick)).toBe(true)
  })

  it('lights a hearth while a forager burns wood, and leaves it dark when it sleeps cold', () => {
    const state = campReadyToSwap()
    const pair = pairAt(state, 0.5)
    const lit = state.foragers.find((forager) => forager.wood > 0)!.id
    expect(hearthAt(pair, lit)).toBe('lit')
    const cold = { ...state, foragers: state.foragers.map((forager) => ({ ...forager, wood: 0 })) }
    expect(hearthAt(pairAt(cold, 0.5), 0)).toBe('cold')
    expect(describeActivity(pairAt(cold, 0.5), 0)).toBe('Sleeping cold, with no wood to burn')
    expect(describeActivity(pair, lit)).toBe('Sleeping warm by its fire')
    const noon = { ...state, tick: 12 }
    expect(hearthAt(pairAt(noon, 0.5), 0)).toBeNull()
  })

  it('summarizes a forager’s skills, wood and swaps, and plots its share of work', () => {
    let state = createLife()
    state = runLifeHours(state, 24 * 6)
    const summary = tradeSummary(state, 0)
    expect(summary.forageRate).toBe(state.foragers[0]!.forageRate)
    expect(summary.ownTerms).toBeCloseTo(state.foragers[0]!.forageRate / state.foragers[0]!.woodRate, 9)
    expect(summary.woodTarget).toBe(24)
    const sold = state.foragers.reduce((sum, forager) => sum + tradeSummary(state, forager.id).woodSold, 0)
    const bought = state.foragers.reduce((sum, forager) => sum + tradeSummary(state, forager.id).woodBought, 0)
    expect(sold).toBe(state.totals.swappedWood)
    expect(bought).toBe(sold)
    const points = specializationPoints(state)
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) {
      expect(point.woodShare).toBeGreaterThanOrEqual(0)
      expect(point.woodShare).toBeLessThanOrEqual(1)
    }
  })

  it('inspects a grove: what it holds against what the followed forager remembers', () => {
    expect(groveInspection(createLife(), 2, 0)).toMatchObject({
      name: 'Grove 3',
      wood: 200,
      capacity: 200,
      rememberedWood: 200,
      seen: 'at the start',
      difference: 0,
    })
  })
})
