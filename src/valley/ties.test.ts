import { describe, expect, it } from 'vitest'
import { WakeQueue } from './clock'
import { FLAT_LAND } from './config'
import { createValley, stepValley } from './engine'
import { reindexPeople } from './perception'
import { startTask } from './tasks'
import { NO_TIE, ask, countTogether, fadeValue, putTie, replayTies, tieOf, tieViolations } from './ties'
import type { Forager, Tie, ValleyConfig, ValleyEvent, ValleyState } from './types'

/** People a metre apart on flat land at 10:00, each resting since then. */
function band(founders = 2, overrides: Partial<ValleyConfig> = {}) {
  const s = createValley({ ...FLAT_LAND, scattered: false, founders, ...overrides })
  s.minute = 600
  s.queue = new WakeQueue()
  for (const p of s.foragers) {
    p.x = 40_000 + p.id * 100
    p.y = 40_000
    p.energyKcal = 66_000
    p.hungry = false
    p.carried = []
    p.giveGoodwillPerMille = 1_000
    p.knowledge.triangles.fill(255)
    p.task = startTask(s.config, p, 'rest', 600, 660, -1, -1, 'satiated')
  }
  return s
}
const tie = (fields: Partial<Tie>): Tie => ({ ...NO_TIE, ...fields })
const know = (s: ValleyState, a: number, b: number, fields: Partial<Tie> = {}) =>
  putTie(s.foragers[a]!.ties, s.config.tiesRemembered, b, tie({ familiarity: 600, ...fields }))
const hungry = (p: Forager) => {
  p.hungry = true
  p.energyKcal = 60_000
  p.carried = []
}
const berries = (p: Forager, kcal: number) => {
  p.carried = [{ food: 'berries', kcal, harvestTick: 600 }]
}

describe('time together', () => {
  it('counts minutes spent standing within talking distance, once, in both ties', () => {
    const s = band()
    const [a, b] = s.foragers as [Forager, Forager]
    const ended = startTask(s.config, a, 'rest', 540, 600, -1, -1, 'satiated')
    b.task = startTask(s.config, b, 'rest', 560, 660, -1, -1, 'satiated')
    expect(countTogether(s, a, ended, [1], 600)).toMatchObject([{ minutes: 40 }])
    expect(tieOf(a, 1).familiarity).toBe(40)
    expect(tieOf(b, 0).familiarity).toBe(40)
    // Later, only the minutes since are added.
    const again = startTask(s.config, a, 'rest', 600, 630, -1, -1, 'satiated')
    expect(countTogether(s, a, again, [1], 630)).toMatchObject([{ minutes: 30 }])
    expect(countTogether(s, b, b.task, [0], 630)).toEqual([])
    expect(tieOf(b, 0).familiarity).toBe(70)
  })
  it('counts nothing for a walker, or after a walk', () => {
    const s = band()
    const [a, b] = s.foragers as [Forager, Forager]
    b.task = { ...b.task!, kind: 'walk' }
    expect(countTogether(s, a, startTask(s.config, a, 'rest', 540, 600, -1, -1, 'satiated'), [1], 600)).toEqual([])
    b.task = startTask(s.config, b, 'rest', 560, 660, -1, -1, 'satiated')
    expect(countTogether(s, a, { ...a.task!, kind: 'walk', startMinute: 540 }, [1], 600)).toEqual([])
    expect(a.ties.size).toBe(0)
  })
  it('counts nobody beyond talking distance at a wake-up', () => {
    const s = band()
    s.foragers[1]!.x = 42_500
    s.queue.schedule({ minute: 660, phase: 1, id: 0, kind: 'end' })
    s.foragers[1]!.task = startTask(s.config, s.foragers[1]!, 'rest', 600, 720, -1, -1, 'satiated')
    reindexPeople(s, 600)
    const next = stepValley(s, 660)
    expect(next.lastInterval.some((event) => event.kind === 'together')).toBe(false)
  })
})

describe('fading and forgetting', () => {
  it('halves a tie in 180 days and forgets one that fades to nothing', () => {
    let value = { value: 1_000_000, remainder: 0 }
    for (let day = 0; day < 180; day++) value = fadeValue(value.value, value.remainder, 3_844)
    expect(Math.abs(value.value - 500_000)).toBeLessThan(5_000)
    let debt = { value: -1_000_000, remainder: 0 }
    for (let day = 0; day < 180; day++) debt = fadeValue(debt.value, debt.remainder, 3_844)
    expect(debt.value).toBe(-value.value)
    let small = { value: 3, remainder: 0 }
    for (let day = 0; day < 2_000; day++) small = fadeValue(small.value, small.remainder, 3_844)
    expect(small.value).toBe(0)
  })
  it('forgets the least familiar tie when full', () => {
    const ties = new Map<number, Tie>()
    putTie(ties, 2, 1, tie({ familiarity: 50 }))
    putTie(ties, 2, 2, tie({ familiarity: 10 }))
    putTie(ties, 2, 3, tie({ familiarity: 20 }))
    expect([...ties.keys()]).toEqual([1, 3])
  })
})

describe('asking and giving', () => {
  it('gives a hungry person food up to their satiation, oldest first, and records credit both ways', () => {
    const s = band()
    const [asker, giver] = s.foragers as [Forager, Forager]
    hungry(asker)
    berries(giver, 3_000)
    giver.energyKcal = 70_000
    giver.task = startTask(s.config, giver, 'rest', 600, 660, -1, -1, 'satiated')
    know(s, 0, 1)
    know(s, 1, 0)
    const energy = asker.energyKcal
    const { events, ateKcal } = ask(s, asker, [1], 600)
    const gift = events[0]!
    expect(gift).toMatchObject({ kind: 'gift', giverId: 1, receiverId: 0, good: 'food' })
    if (gift.kind !== 'gift') throw new Error('expected a gift')
    expect(gift.amount).toBe(Math.min(3_000, asker.satiationKcal - energy))
    expect(ateKcal).toBe(gift.amount)
    expect(asker.energyKcal).toBe(energy + gift.amount)
    expect(tieOf(giver, 0).credit).toBe(Math.floor((gift.amount * 60) / giver.forageRate))
    expect(tieOf(asker, 1).credit).toBe(-Math.floor((gift.amount * 60) / asker.forageRate))
  })
  it('asks nobody it does not know, the closest tie first, and nobody twice a day', () => {
    const s = band(4)
    const [asker] = s.foragers as [Forager]
    hungry(asker)
    for (const p of s.foragers.slice(1)) berries(p, 100)
    know(s, 0, 2, { familiarity: 600, grievance: 300 })
    know(s, 0, 3, { familiarity: 500 })
    const first = ask(s, asker, [1, 2, 3], 600).events
    expect(first.map((event) => (event.kind === 'refusal' ? event.foragerId : -1))).toEqual([3, 2])
    hungry(asker)
    expect(ask(s, asker, [1, 2, 3], 700).events).toEqual([])
    hungry(asker)
    expect(ask(s, asker, [1, 2, 3], 1_440 + 600).events).toHaveLength(2)
  })
  it('refuses when goodwill does not cover the debt, adding grievance; refuses with nothing to spare, adding none', () => {
    const s = band(3)
    const [asker, owed, poor] = s.foragers as [Forager, Forager, Forager]
    hungry(asker)
    berries(owed, 3_000)
    hungry(poor)
    berries(poor, 1_000)
    know(s, 0, 1)
    know(s, 0, 2, { familiarity: 100 })
    know(s, 1, 0, { credit: 100 })
    know(s, 2, 0)
    const events = ask(s, asker, [1, 2], 600).events
    expect(events).toMatchObject([
      { kind: 'refusal', foragerId: 1, reason: 'goodwill', grievance: 60 },
      { kind: 'refusal', foragerId: 2, reason: 'spare', grievance: 0 },
    ])
    expect(tieOf(asker, 1).grievance).toBe(60)
    expect(tieOf(asker, 2).grievance).toBe(0)
  })
  it('gives more readily to someone it owes', () => {
    for (const [credit, kind] of [
      [0, 'refusal'],
      [-30, 'gift'],
    ] as const) {
      const s = band()
      hungry(s.foragers[0]!)
      berries(s.foragers[1]!, 3_000)
      know(s, 0, 1)
      know(s, 1, 0, { familiarity: 100, grievance: 30, credit })
      expect(ask(s, s.foragers[0]!, [1], 600).events[0]!.kind).toBe(kind)
    }
  })
  it('gives on the same tie when agreeable and refuses when not', () => {
    for (const [goodwill, kind] of [
      [1_500, 'gift'],
      [500, 'refusal'],
    ] as const) {
      const s = band()
      hungry(s.foragers[0]!)
      berries(s.foragers[1]!, 3_000)
      s.foragers[1]!.giveGoodwillPerMille = goodwill
      know(s, 0, 1)
      know(s, 1, 0, { credit: 80 })
      expect(ask(s, s.foragers[0]!, [1], 600).events[0]!.kind).toBe(kind)
    }
  })
  it('asks nobody once an exchange has met the need', () => {
    const s = band()
    const [seller, buyer] = s.foragers as [Forager, Forager]
    seller.forageRate = 600
    seller.woodRate = 20
    seller.wood = 40
    seller.energyKcal = 60_000
    buyer.forageRate = 1_200
    buyer.woodRate = 10
    buyer.wood = 0
    buyer.shortOfWood = true
    buyer.energyKcal = 70_000
    buyer.task = startTask(s.config, buyer, 'rest', 600, 660, -1, -1, 'satiated')
    buyer.carried = [{ food: 'nuts', kcal: 20_000, harvestTick: 100 }]
    s.groups = []
    for (const p of s.foragers) p.groupId = 0
    s.groups.push({ ...createValley({ ...FLAT_LAND, scattered: false, founders: 2 }).groups[0]!, members: [0, 1] })
    know(s, 1, 0)
    know(s, 0, 1)
    s.queue.schedule({ minute: 600, phase: 1, id: 1, kind: 'end' })
    reindexPeople(s, 600)
    const next = stepValley(s, 601)
    expect(next.lastInterval.some((event) => event.kind === 'exchange')).toBe(true)
    const askedBy = (event: ValleyEvent) =>
      event.kind === 'gift' ? event.receiverId : event.kind === 'refusal' ? event.askerId : -1
    expect(next.lastInterval.some((event) => askedBy(event) === 1)).toBe(false)
  })
})

describe('the checker on ties', () => {
  const after = (before: ValleyState, events: ValleyEvent[]): ValleyState => ({
    ...before,
    foragers: before.foragers.map((p) => ({ ...p, ties: new Map(p.ties) })),
    lastInterval: events,
  })
  it('rejects a tie to oneself, too many ties, and unequal time together', () => {
    const s = band(3, { tiesRemembered: 1 })
    s.foragers[0]!.ties.set(0, tie({ familiarity: 5 }))
    s.foragers[1]!.ties.set(0, tie({ familiarity: 5 }))
    s.foragers[1]!.ties.set(2, tie({ familiarity: 5 }))
    s.foragers[2]!.ties.set(1, tie({ familiarity: 6 }))
    const errors = tieViolations(s).join('; ')
    expect(errors).toContain('a tie to an impossible person')
    expect(errors).toContain('too many ties')
    expect(errors).toContain('time together differs')
  })
  it('rejects a gift without goodwill, a refusal with the wrong grievance, and a second ask in a day', () => {
    const s = band()
    know(s, 0, 1)
    know(s, 1, 0, { credit: 1_000 })
    const gift: ValleyEvent = {
      kind: 'gift',
      minute: 600,
      giverId: 1,
      receiverId: 0,
      good: 'food',
      amount: 100,
      giverCredit: Math.floor(6_000 / s.foragers[1]!.forageRate),
      receiverCredit: -Math.floor(6_000 / s.foragers[0]!.forageRate),
    }
    const refusal: ValleyEvent = {
      kind: 'refusal',
      minute: 610,
      foragerId: 1,
      askerId: 0,
      good: 'food',
      reason: 'goodwill',
      grievance: 10,
    }
    const errors = replayTies(s, after(s, [gift, refusal])).join('; ')
    expect(errors).toContain('gave without enough goodwill')
    expect(errors).toContain('a refusal differs from the giving rule')
    expect(errors).toContain('asked person 1 twice in a day')
    expect(errors).toContain('ties differ from their records')
  })
})
