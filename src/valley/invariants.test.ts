import { describe, it, expect } from 'vitest'
import { ValleyChecker } from './invariants'
import { createValley, stepValley, cloneValley } from './engine'
import { bandAt, giveHut, testAxe } from './ruleTestFixtures'
import { addTestLake } from './ruleFixtures'
import type { ValleyState } from './types'
const damaged = (base: ValleyState, damage: (s: ValleyState) => void, to = base.minute + 60) => {
  const checker = new ValleyChecker(base),
    after = stepValley(base, to)
  expect(new ValleyChecker(base).check(after)).toEqual([])
  damage(after)
  return checker.check(after)
}
describe('interval checker', () => {
  it('accepts thirty canonical days with all founders alive', () => {
    let s = createValley()
    const checker = new ValleyChecker(s)
    for (let day = 1; day <= 30; day++) {
      s = stepValley(s, day * 1440)
      expect(checker.check(s)).toEqual([])
    }
    expect(s.foragers.every((p) => p.alive)).toBe(true)
  }, 120000)
  it('catches fabricated task production', () => {
    expect(
      damaged(bandAt(), (s) => {
        const e = s.lastInterval.find((record) => record.kind === 'task-end')!
        if (e.kind === 'task-end') e.produced!.kcal++
      }),
    ).not.toEqual([])
  })
  it('catches a person moved into water', () => {
    const s = bandAt()
    addTestLake(s)
    expect(
      damaged(s, (a) => {
        a.foragers[0]!.x = 750
        a.foragers[0]!.y = 750
      }),
    ).not.toEqual([])
  })
  it('catches a route segment entering water', () => {
    const s = bandAt()
    addTestLake(s)
    s.foragers[0]!.x -= 10000
    s.foragers[0]!.log = 1
    s.logStock[64]!--
    s.totals.logsCut++
    expect(
      damaged(
        s,
        (a) => {
          const r = a.routes[0]!
          r.segments[0]!.x1 = 750
          r.segments[0]!.y1 = 750
        },
        601,
      ),
    ).not.toEqual([])
  })
  it('catches a queued wake-up in the past', () => {
    expect(damaged(bandAt(), (s) => s.queue.schedule({ minute: 1, phase: 1, id: 0, kind: 'end' }))).not.toEqual([])
  })
  it('catches an unobserved place stock memory', () => {
    const s = bandAt()
    s.foragers[0]!.knownPlaces.fill(-1)
    expect(
      damaged(s, (a) => {
        a.foragers[0]!.knownPlaces[0] = -1
        a.foragers[0]!.placeStock[0] = 123
      }),
    ).not.toEqual([])
  })
  it('catches stock above capacity', () => {
    expect(damaged(bandAt(), (s) => (s.foodStock[0] = s.config.berryThicketCapacityKcal + 1))).not.toEqual([])
  })
  it.each(['food', 'wood', 'logs', 'stones', 'axe'] as const)('catches %s made or lost without a record', (kind) => {
    expect(
      damaged(bandAt(), (s) => {
        if (kind === 'food') s.foodStock[0]!--
        if (kind === 'wood') s.groups[0]!.fireWood++
        if (kind === 'logs') s.logStock[64]!--
        if (kind === 'stones') s.stoneStock[76]!--
        if (kind === 'axe') s.foragers[0]!.axe = testAxe(10000)
      }),
    ).not.toEqual([])
  })
  it('catches a hut growing without a delivery', () => {
    const s = bandAt()
    giveHut(s, s.foragers[0]!, 3)
    expect(damaged(s, (a) => a.huts[0]!.logs++)).not.toEqual([])
  })
  it('catches a wrong body charge', () => {
    expect(
      damaged(bandAt(), (a) => {
        const e = a.lastInterval.find((record) => record.kind === 'task-end')!
        if (e.kind === 'task-end') e.paid!.kcal++
      }),
    ).not.toEqual([])
  })
  it('catches an unrecorded or impossible death', () => {
    expect(
      damaged(bandAt(), (a) => {
        a.foragers[0]!.alive = false
        a.foragers[0]!.deathMinute = 601
        a.foragers[0]!.deathCauses = ['dehydration']
      }),
    ).not.toEqual([])
  })
  it.each(['missing group', 'wrong hearth', 'singleton'] as const)('catches %s', (kind) => {
    expect(
      damaged(bandAt(), (a) => {
        if (kind === 'missing group') a.foragers[0]!.groupId = 99
        if (kind === 'wrong hearth') a.foragers[0]!.hearth.x++
        if (kind === 'singleton') a.groups[0]!.members = [0]
      }),
    ).not.toEqual([])
  })
  it('does not modify the checked state', () => {
    const s = bandAt(),
      checker = new ValleyChecker(s),
      n = stepValley(s, 660),
      before = cloneValley(n)
    expect(checker.check(n)).toEqual([])
    expect(n).toEqual(before)
  })
})

describe('ported Life 11 corruption cases', () => {
  it.each(['gift amount', 'gift location', 'fire amount', 'warmth'] as const)('catches a corrupted %s', (kind) => {
    const base = bandAt(1080)
    base.groups[0]!.fireWood = 5
    base.totals.initialWood += 5
    const checker = new ValleyChecker(base),
      after = stepValley(base, 1140)
    expect(new ValleyChecker(base).check(after)).toEqual([])
    if (kind === 'gift amount') {
      const feed = after.lastInterval.find((e) => e.kind === 'feed')!
      if (feed.kind === 'feed') feed.spareWood++
    }
    if (kind === 'gift location') {
      const feed = after.lastInterval.find((e) => e.kind === 'task-start')!
      if (feed.kind === 'task-start') feed.position.x += 10000
    }
    if (kind === 'fire amount') {
      const fire = after.lastInterval.find((e) => e.kind === 'fire' && 'groupId' in e)!
      if (fire.kind === 'fire') fire.burned++
    }
    if (kind === 'warmth') {
      const event = after.lastInterval.find((e) => e.kind === 'task-start')!
      if (event.kind === 'task-start') event.task.energyPerHour = 999
    }
    expect(checker.check(after)).not.toEqual([])
  })
  it.each(['sight', 'stock check', 'unseen route'] as const)('catches a corrupted %s observation', (kind) => {
    expect(
      damaged(bandAt(), (s) => {
        const observe = s.lastInterval.find((e) => e.kind === 'observe')!
        if (observe.kind !== 'observe') return
        if (kind === 'sight') observe.origin = { x: -1000000, y: -1000000 }
        if (kind === 'stock check') observe.stock = { placeId: 0, food: 123, wood: 1, logs: 0, stones: 0 }
        if (kind === 'unseen route') {
          observe.nodes = []
          s.foragers[0]!.knowledge.nodes.fill(0)
        }
      }),
    ).not.toEqual([])
  })
  it('catches altered route grades and load speeds', () => {
    const base = bandAt()
    base.foragers[0]!.x -= 20000
    base.foragers[0]!.log = 1
    base.logStock[64]!--
    base.totals.logsCut++
    for (const field of ['slope', 'duration'] as const) {
      const checker = new ValleyChecker(base),
        s = stepValley(base, 601)
      expect(new ValleyChecker(base).check(s)).toEqual([])
      if (field === 'slope') s.routes[0]!.segments[0]!.slope = 2
      else s.routes[0]!.segments[0]!.timeUnits = 1
      expect(checker.check(s)).not.toEqual([])
    }
  })
  it.each(['volume', 'body', 'fish remainder', 'death'] as const)('catches a corrupted water %s record', (kind) => {
    const base = bandAt(600, { founders: 1, scattered: true }),
      bank = addTestLake(base),
      p = base.foragers[0]!
    p.x = bank.x
    p.y = bank.y
    p.hearth = { x: p.x, y: p.y }
    p.waterDeficitMl = 700
    p.thirsty = true
    expect(
      damaged(
        base,
        (s) => {
          const drink = s.lastInterval.find((e) => e.kind === 'drink')!
          if (kind === 'volume' && drink.kind === 'drink') drink.volumeMl++
          if (kind === 'body' && drink.kind === 'drink') drink.bodyId = 9999
          if (kind === 'fish remainder') s.fish[0]!.remainder++
          if (kind === 'death') {
            s.foragers[0]!.alive = false
            s.foragers[0]!.deathCauses = ['dehydration']
          }
        },
        605,
      ),
    ).not.toEqual([])
  })
})

it('rejects a fire burned during daylight', () => {
  expect(
    damaged(
      bandAt(),
      (s) => s.lastInterval.push({ kind: 'fire', minute: 600, groupId: 0, burned: 1, lit: true, fireWoodAfter: 0 }),
      601,
    ),
  ).not.toEqual([])
})
