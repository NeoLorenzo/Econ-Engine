import { describe, expect, it } from 'vitest'
import { LIFE2_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import { createLife, stepLife } from './engine'
import { carriedKcal } from './food'
import { assertLifeInvariants, lifeInvariantViolations } from './invariants'
import { emptyLedger, owesNothing, recipientsInOrder, recordGift, requestKcal } from './sharing'
import type { Forager, LifeState, Strategy, Tile } from './types'

const config = { ...LIFE_DEFAULT_CONFIG, ...LIFE2_WORLD }
const camp = { x: 6, y: 6 }

const forager = (id: number, overrides: Partial<Forager> = {}): Forager => ({
  id,
  position: camp,
  energyKcal: 10_000,
  hungry: true,
  targetPatchId: null,
  memory: [],
  alive: true,
  deathTick: null,
  strategy: 'keeper',
  carried: [],
  ledger: emptyLedger(4),
  forageRate: 1_200,
  woodRate: 24,
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

const giver = (strategy: Strategy, overrides: Partial<Forager> = {}) =>
  forager(0, { strategy, energyKcal: 20_000, hungry: false, carried: [{ kcal: 10_000, harvestTick: 0 }], ...overrides })

describe('asking', () => {
  it('asks for what would satiate it, counting what it carries, and only when hungry', () => {
    expect(requestKcal(config, forager(1))).toBe(8_000)
    expect(requestKcal(config, forager(1, { carried: [{ kcal: 3_000, harvestTick: 0 }] }))).toBe(5_000)
    expect(requestKcal(config, forager(1, { hungry: false }))).toBe(0)
    expect(requestKcal(config, forager(1, { energyKcal: 17_000, carried: [{ kcal: 2_000, harvestTick: 0 }] }))).toBe(0)
    expect(requestKcal(config, forager(1, { alive: false }))).toBe(0)
  })
})

describe('strategies', () => {
  const hungry = (id: number, energyKcal: number, position: Tile = camp) => forager(id, { energyKcal, position })

  it('a keeper serves no one', () => {
    expect(recipientsInOrder(config, giver('keeper'), [giver('keeper'), hungry(1, 9_000)])).toEqual([])
  })

  it('a sharer serves every hungry forager on its tile, the lowest reserve first, then the lowest ID', () => {
    const band = [giver('sharer'), hungry(1, 9_000), hungry(2, 5_000), hungry(3, 5_000, { x: 0, y: 0 })]
    expect(recipientsInOrder(config, band[0]!, band).map((f) => f.id)).toEqual([2, 1])
    const fed = [giver('sharer'), forager(1, { hungry: false, energyKcal: 15_000 })]
    expect(recipientsInOrder(config, fed[0]!, fed)).toEqual([])
  })

  it('a reciprocator gives a stranger a first gift, refuses it until it gives back, then gives again', () => {
    let reciprocator = giver('reciprocator')
    let other = hungry(1, 9_000)
    expect(recipientsInOrder(config, reciprocator, [reciprocator, other]).map((f) => f.id)).toEqual([1])
    ;({ giverLedger: reciprocator.ledger, recipientLedger: other.ledger } = recordGift(reciprocator, other, 4_000))
    expect(owesNothing(reciprocator, 1)).toBe(false)
    expect(recipientsInOrder(config, reciprocator, [reciprocator, other])).toEqual([])
    // Repaid in part, it still owes; repaid in full, it is served again.
    const repay = (kcal: number) => {
      const back = recordGift(other, reciprocator, kcal)
      other = { ...other, ledger: back.giverLedger }
      reciprocator = { ...reciprocator, ledger: back.recipientLedger }
    }
    repay(3_000)
    expect(recipientsInOrder(config, reciprocator, [reciprocator, other])).toEqual([])
    repay(1_000)
    expect(recipientsInOrder(config, reciprocator, [reciprocator, other]).map((f) => f.id)).toEqual([1])
  })

  it('a reciprocator serves those that have given it most first', () => {
    let reciprocator = giver('reciprocator')
    const band = [reciprocator, hungry(1, 5_000), hungry(2, 9_000)]
    const fromTwo = recordGift(band[2]!, reciprocator, 2_000)
    reciprocator = { ...reciprocator, ledger: fromTwo.recipientLedger }
    expect(recipientsInOrder(config, reciprocator, band).map((f) => f.id)).toEqual([2, 1])
  })
})

/** A band of three at camp at midnight: forager 0 carries food with a full reserve, 1 and 2 are as given. */
function campAtNight(strategy: Strategy, others: Partial<Forager>[]): LifeState {
  const state = createLife({ ...LIFE2_WORLD, bandSize: 3, sharers: 0, reciprocators: 0 })
  const foragers = state.foragers.map((f, id) =>
    id === 0
      ? { ...f, strategy, energyKcal: 20_000, hungry: false, carried: [{ kcal: 10_000, harvestTick: 0 }] }
      : { ...f, ...others[id - 1] },
  )
  const initialKcal =
    state.patches.reduce((sum, p) => sum + p.stockKcal, 0) +
    foragers.reduce((sum, f) => sum + f.energyKcal + carriedKcal(f.carried), 0)
  return { ...state, foragers, totals: { ...state.totals, initialKcal } }
}

describe('giving at camp', () => {
  it('a sharer gives each hungry forager what it asks, as far as its food goes; the fed get nothing', () => {
    const next = stepLife(
      campAtNight('sharer', [
        { energyKcal: 9_000, hungry: true },
        { energyKcal: 15_000, hungry: false },
      ]),
    )
    expect(next.lastGifts).toHaveLength(1)
    const [gift] = next.lastGifts
    expect(gift).toMatchObject({ giverId: 0, recipientId: 1, tile: camp, kcal: gift!.requestKcal })
    // The recipient asked in its own turn's state: 9,000, or 8,940 if its turn came first.
    expect([9_000, 9_060]).toContain(gift!.requestKcal)
    expect(next.foragers[0]!.ledger[1]).toEqual({ givenKcal: gift!.kcal, receivedKcal: 0 })
    expect(next.foragers[1]!.ledger[0]).toEqual({ givenKcal: 0, receivedKcal: gift!.kcal })
    expect(next.foragers[2]!.carried).toEqual([])
    assertLifeInvariants(next)
    // The recipient eats the gift at the start of its next turn.
    const after = stepLife(next)
    expect(after.lastEvents.find((event) => event.foragerId === 1)!.eatenKcal).toBe(gift!.kcal)
    assertLifeInvariants(after)
  })

  it('gives no more than it carries, oldest food first', () => {
    const next = stepLife(
      campAtNight('sharer', [
        { energyKcal: 1_000, hungry: true },
        { energyKcal: 2_000, hungry: true },
      ]),
    )
    expect(next.lastGifts.reduce((sum, gift) => sum + gift.kcal, 0)).toBe(10_000)
    expect(next.foragers[0]!.carried).toEqual([])
    assertLifeInvariants(next)
  })

  it('a keeper gives nothing, and its food stays with it', () => {
    const next = stepLife(campAtNight('keeper', [{ energyKcal: 9_000, hungry: true }, {}]))
    expect(next.lastGifts).toEqual([])
    expect(carriedKcal(next.foragers[0]!.carried)).toBe(10_000)
    assertLifeInvariants(next)
  })

  it('reports a keeper’s gift and ledgers that disagree', () => {
    const next = stepLife(campAtNight('sharer', [{ energyKcal: 9_000, hungry: true }, {}]))
    const keeper = next.foragers.map((f) => (f.id === 0 ? { ...f, strategy: 'keeper' as const } : f))
    expect(lifeInvariantViolations({ ...next, foragers: keeper }).join()).toMatch(/made by a keeper/)
    const forged = next.foragers.map((f) =>
      f.id === 1 ? { ...f, ledger: f.ledger.map((entry) => ({ ...entry, receivedKcal: entry.receivedKcal + 1 })) } : f,
    )
    expect(lifeInvariantViolations({ ...next, foragers: forged }).join()).toMatch(/disagree/)
  })
})
