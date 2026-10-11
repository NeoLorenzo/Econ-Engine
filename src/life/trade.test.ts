import { describe, expect, it } from 'vitest'
import { LIFE_DEFAULT_CONFIG } from './config'
import { createLife, stepLife } from './engine'
import { chooseWork } from './forager'
import { lifeInvariantViolations } from './invariants'
import { bothGain, buyingPays, knownTerms, pairTerms, sellingPays, swap, tradePartners } from './trade'
import type { Forager, LifeConfig, LifeState } from './types'

// The canonical Life 3 world: a wood target of 24 units, satiated at 18,000 kcal.
const config: LifeConfig = LIFE_DEFAULT_CONFIG
const camp = { x: 6, y: 6 }

const forager = (id: number, overrides: Partial<Forager> = {}): Forager => ({
  id,
  position: camp,
  energyKcal: 16_000,
  hungry: false,
  targetPatchId: null,
  memory: [],
  alive: true,
  deathTick: null,
  strategy: 'keeper',
  carried: [],
  ledger: [],
  forageRate: 1_200,
  woodRate: 24,
  wood: 24,
  shortOfWood: false,
  targetGroveId: null,
  groveMemory: [],
  heardTerms: null,
  trip: null,
  swapTotals: { woodSold: 0, woodBought: 0, kcalReceived: 0, kcalPaid: 0 },
  hoursWorked: { forage: 0, gather: 0 },
  ...overrides,
})

// A gatherer whose wood costs it 20 kcal a unit, and a forager to whom it costs 100.
const gatherer = (id: number, overrides: Partial<Forager> = {}) =>
  forager(id, { forageRate: 600, woodRate: 30, wood: 40, ...overrides })
const buyer = (id: number, overrides: Partial<Forager> = {}) =>
  forager(id, { forageRate: 1_800, woodRate: 18, wood: 4, carried: [{ kcal: 5_000, harvestTick: 10 }], ...overrides })

describe('terms', () => {
  it('are the midpoint of two foragers’ own terms, rounded down, strictly between them', () => {
    expect(pairTerms(gatherer(0), buyer(1))).toBe(60)
    expect(bothGain(gatherer(0), buyer(1), 60)).toBe(true)
    expect(bothGain(gatherer(0), buyer(1), 20)).toBe(false)
    expect(bothGain(gatherer(0), buyer(1), 100)).toBe(false)
    // Own terms of 50 and 51 have no whole number strictly between them once rounded down.
    const close = forager(1, { forageRate: 1_224 })
    expect(pairTerms(forager(0), close)).toBe(50)
    expect(bothGain(forager(0), close, 50)).toBe(false)
  })

  it('pay the seller to gather and the buyer to forage', () => {
    expect(sellingPays(gatherer(0), 60)).toBe(true)
    expect(sellingPays(gatherer(0), 20)).toBe(false)
    expect(buyingPays(buyer(1), 60)).toBe(true)
    expect(buyingPays(buyer(1), 100)).toBe(false)
  })

  it('are remembered for termsMemoryHours, and only with swapping on', () => {
    const heard = forager(0, { heardTerms: { kcalPerWood: 60, tick: 100 } })
    expect(knownTerms(config, heard, 124)).toBe(60)
    expect(knownTerms(config, heard, 125)).toBeNull()
    expect(knownTerms({ ...config, swapping: false }, heard, 110)).toBeNull()
  })
})

describe('partners', () => {
  it('are served best terms first: a seller the highest own terms, a buyer the lowest', () => {
    const band = [gatherer(0), buyer(1, { forageRate: 1_200 }), buyer(2), forager(3, { wood: 0 })]
    // Forager 3's own terms equal 50, still above the seller's 20.
    expect(tradePartners(config, band[0]!, band).partners.map((f) => f.id)).toEqual([2, 1, 3])
    const sellers = [buyer(0), gatherer(1), gatherer(2, { woodRate: 20 }), forager(3, { wood: 30, forageRate: 2_400 })]
    expect(tradePartners(config, sellers[0]!, sellers).partners.map((f) => f.id)).toEqual([1, 2])
  })

  it('must share the tile, be alive and want what the trader has', () => {
    const band = [
      gatherer(0),
      buyer(1, { position: { x: 0, y: 0 } }),
      buyer(2, { alive: false }),
      buyer(3, { wood: 24 }),
    ]
    expect(tradePartners(config, band[0]!, band).partners).toEqual([])
    // With equal skills no one has lower or higher own terms.
    const equal = [forager(0, { wood: 40 }), forager(1, { wood: 0, carried: [{ kcal: 5_000, harvestTick: 0 }] })]
    expect(tradePartners(config, equal[0]!, equal).partners).toEqual([])
  })
})

describe('swapping', () => {
  it('swaps as much as spare wood, want, the buyer’s food and the seller’s room allow', () => {
    // Spare 16, want 20, food for 83 units, room for 66: 16 units for 960 kcal.
    const band = [gatherer(0), buyer(1)]
    const made = swap(config, band[0]!, band, 40)
    expect(made.swaps).toEqual([
      {
        kind: 'swap',
        tick: 40,
        tile: camp,
        sellerId: 0,
        buyerId: 1,
        wood: 16,
        kcal: 960,
        kcalPerWood: 60,
        sellerWoodBefore: 40,
        sellerRoomKcal: 4_000,
        buyerWoodBefore: 4,
        buyerCarriedKcal: 5_000,
      },
    ])
    expect(made.trader).toMatchObject({ wood: 24, carried: [{ kcal: 960, harvestTick: 10 }] })
    expect(band[1]).toMatchObject({ wood: 20, carried: [{ kcal: 4_040, harvestTick: 10 }] })
    // The buyer's food limits it: 100 kcal pays for one unit.
    const poor = [gatherer(0), buyer(1, { carried: [{ kcal: 100, harvestTick: 10 }] })]
    expect(swap(config, poor[0]!, poor, 40).swaps[0]).toMatchObject({ wood: 1, kcal: 60 })
    // So does the seller's room: 59 kcal fits no unit at 60.
    const full = [gatherer(0, { energyKcal: 19_941 }), buyer(1)]
    expect(swap(config, full[0]!, full, 40).swaps).toEqual([])
  })

  it('lets everyone on the tile hear a swap, but only the pair hear a quote', () => {
    const band = [gatherer(0), buyer(1), forager(2, { wood: 24 }), forager(3, { position: { x: 0, y: 0 } })]
    const made = swap(config, band[0]!, band, 40)
    expect(made.trader.heardTerms).toEqual({ kcalPerWood: 60, tick: 40 })
    expect(band.map((f) => f.heardTerms)).toEqual([
      null,
      { kcalPerWood: 60, tick: 40 },
      { kcalPerWood: 60, tick: 40 },
      null,
    ])

    // A buyer with no food to pay: the pair agree terms but nothing changes hands.
    const broke = [gatherer(0), buyer(1, { carried: [] }), forager(2, { wood: 24 })]
    const quoted = swap(config, broke[0]!, broke, 41)
    expect(quoted.swaps).toEqual([])
    expect(quoted.quotes).toEqual([{ kind: 'quote', tick: 41, sellerId: 0, buyerId: 1, kcalPerWood: 60 }])
    expect(quoted.trader.heardTerms).toEqual({ kcalPerWood: 60, tick: 41 })
    expect(broke[1]!.heardTerms).toEqual({ kcalPerWood: 60, tick: 41 })
    expect(broke[2]!.heardTerms).toBeNull()

    // With quotes off, a failed match teaches nothing.
    const silent = [gatherer(0), buyer(1, { carried: [] })]
    const unheard = swap({ ...config, quotes: false }, silent[0]!, silent, 41)
    expect(unheard.quotes).toEqual([])
    expect(unheard.trader.heardTerms).toBeNull()
  })

  it('does nothing with swapping off', () => {
    const band = [gatherer(0), buyer(1)]
    expect(swap({ ...config, swapping: false }, band[0]!, band, 40)).toMatchObject({ swaps: [], quotes: [] })
  })

  it('lets the seller eat what it received at once, in the engine', () => {
    let state = createLife({ bandSize: 2, skillMinPercent: 100, skillMaxPercent: 100 })
    state = {
      ...state,
      tick: 20,
      foragers: [gatherer(0, { energyKcal: 15_000 }), buyer(1)].map(
        ({ forageRate, woodRate, wood, carried, energyKcal }, id) => ({
          ...state.foragers[id]!,
          forageRate,
          woodRate,
          wood,
          carried,
          energyKcal,
        }),
      ),
    }
    const next = stepLife(state)
    const [made] = next.lastSwaps
    expect(made).toMatchObject({ sellerId: 0, buyerId: 1, kcalPerWood: 60 })
    expect(next.foragers[0]!.carried).toEqual([])
    // The test gave the two foragers food and wood from nowhere, so only conservation is broken.
    expect(lifeInvariantViolations(next).filter((violation) => !/not conserved/.test(violation))).toEqual([])
  })
})

describe('choosing work', () => {
  const at = (overrides: Partial<Forager>) => chooseWork(config, forager(0, overrides), 100)
  const heard = { kcalPerWood: 60, tick: 90 }

  it('works for what it needs when it knows no terms', () => {
    expect(at({ hungry: true })).toEqual({ good: 'food', forTrade: false, trip: null })
    expect(at({ shortOfWood: true, wood: 0 })).toEqual({ good: 'wood', forTrade: false, trip: null })
    expect(at({})).toBeNull()
  })

  it('gathers to sell when hungry only if selling pays and all spare wood is sold', () => {
    const seller = { forageRate: 600, woodRate: 30, hungry: true, energyKcal: 13_000, heardTerms: heard }
    // It asks for 5,000 kcal: 84 units at 60.
    expect(at(seller)).toEqual({ good: 'wood', forTrade: true, trip: { goalSpareWood: 84 } })
    expect(at({ ...seller, wood: 30 })).toEqual({ good: 'food', forTrade: false, trip: null })
    expect(at({ ...seller, wood: 30, trip: { goalSpareWood: 84 } })).toMatchObject({ good: 'wood', forTrade: true })
    expect(at({ ...seller, wood: 108, trip: { goalSpareWood: 84 } })).toMatchObject({ good: 'food' })
    // At terms of 20 an hour of gathering buys no more than an hour of foraging.
    expect(at({ ...seller, heardTerms: { kcalPerWood: 20, tick: 90 } })).toMatchObject({ good: 'food' })
    // Terms heard more than a day ago are forgotten.
    expect(at({ ...seller, heardTerms: { kcalPerWood: 60, tick: 75 } })).toMatchObject({ good: 'food' })
  })

  it('forages to buy wood when short only if buying pays, and waits once it can pay', () => {
    const short = { forageRate: 1_800, woodRate: 18, shortOfWood: true, wood: 4, energyKcal: 20_000, heardTerms: heard }
    expect(at(short)).toEqual({ good: 'food', forTrade: true, trip: null })
    // 20 units at 60 cost 1,200 kcal.
    expect(at({ ...short, carried: [{ kcal: 1_200, harvestTick: 99 }] })).toBe('wait')
    expect(at({ ...short, heardTerms: { kcalPerWood: 100, tick: 90 } })).toMatchObject({ good: 'wood' })
  })
})

describe('the invariants of swapping', () => {
  it('catch a swap outside the two own terms', () => {
    let state: LifeState = createLife()
    while (!state.lastSwaps.length) state = stepLife(state)
    expect(lifeInvariantViolations(state)).toEqual([])
    const [made] = state.lastSwaps
    const forged = {
      ...state,
      lastSwaps: [{ ...made!, kcalPerWood: made!.kcalPerWood + 1000, kcal: made!.wood * (made!.kcalPerWood + 1000) }],
    }
    expect(lifeInvariantViolations(forged).join()).toMatch(/midpoint of their own terms/)
  })
})
