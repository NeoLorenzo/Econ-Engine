import { describe, expect, it } from 'vitest'
import { dayOf } from './calendar'
import { resolveValleyConfig } from './config'
import { cloneValley, createValley, stepValley } from './engine'
import { chooseTask, familyFoodNeed, inRange, speedForLoad } from './forager'
import { ageMilli, ageYears, rangeAt } from './growth'
import { ValleyChecker } from './invariants'
import { carrierOf, relatedness } from './kin'
import { drawBirthMinutes } from './layout'
import { birthDue, canConceive, deliver, natureAt, pregnancyDays, setNature } from './lifecycle'
import { personConfig } from './nature'
import { feedChildren, milkOnly, wantsFeed } from './nursing'
import { bandAt } from './ruleTestFixtures'
import { familyDayKcal } from './stores'
import { startTask } from './tasks'
import { goodwillCovers, mostFamiliarMate, NO_TIE, pairAt } from './ties'
import type { Forager, ValleyEvent, ValleyState } from './types'

const DAY = 1_440
const YEAR = (s: ValleyState) => s.config.daysPerYear * DAY
const NO_DEATHS = { deathPerMillionByAge: Array(111).fill(0) as number[] }

/** Sets a person's birth minute for an age in thousandths of a year and grows their body to it. */
function aged(s: ValleyState, p: Forager, milli: number) {
  p.birthMinute = s.minute - (s.minute % DAY) - Math.ceil((milli * YEAR(s)) / 1_000)
  setNature(p, natureAt(s.config, p, s.minute), s.minute)
  p.energyKcal = Math.min(p.energyKcal, p.reserveMaxKcal)
}

/** A woman of 25 and her partner of 27 at one hearth, both standing at it, with no deaths drawn. */
function family(people = 2, minute = 10 * DAY + 600) {
  const s = bandAt(minute, { ...NO_DEATHS, founders: people })
  const [mom, dad] = s.foragers as [Forager, Forager]
  mom.sex = 0
  dad.sex = 1
  for (const p of s.foragers) {
    aged(s, p, 25_000 + 2_000 * p.id)
    p.x = mom.hearth.x
    p.y = mom.hearth.y
  }
  mom.partnerId = dad.id
  dad.partnerId = mom.id
  return s
}

/** A child of the first two born now, then aged to `milli`. */
function child(s: ValleyState, milli: number) {
  const mom = s.foragers[0]!
  const task = mom.task
  mom.task = null
  mom.pregnancy = { day: dayOf(s.minute), fatherId: 1 }
  deliver(s, mom, s.minute)
  mom.task = task
  const kid = s.foragers.at(-1)!
  aged(s, kid, milli)
  kid.lastFedMinute = -1
  return kid
}

/** The yearly death hazard of the !Kung Siler fit, per million, averaged over the year from age `t`. */
function silerYear(t: number) {
  const [a1, b1, a2, a3, b3] = [0.34, 0.913, 0.01, 3.31e-4, 0.077]
  return (
    1e6 *
    ((a1 / b1) * (Math.exp(-b1 * t) - Math.exp(-b1 * (t + 1))) +
      a2 +
      (a3 / b3) * (Math.exp(b3 * (t + 1)) - Math.exp(b3 * t)))
  )
}

describe('ages', () => {
  it('reads a birth minute as an age at 90, 365 and 8 days a year', () => {
    for (const daysPerYear of [90, 365, 8]) {
      const c = resolveValleyConfig({ daysPerYear })
      const birth = -(2 * daysPerYear + Math.floor(daysPerYear / 4)) * DAY
      expect(ageMilli(c, birth, 0)).toBe(2_000 + Math.floor((1_000 * Math.floor(daysPerYear / 4)) / daysPerYear))
      expect(ageYears(ageMilli(c, birth, 0))).toBe(2)
    }
  })
  it('gives founders ages in range, replayed from the age stream', () => {
    const s = createValley({})
    const [first, last] = s.config.founderAgeYears
    expect(s.foragers.map((p) => p.birthMinute)).toEqual(drawBirthMinutes(s.config))
    for (const p of s.foragers) {
      const years = ageYears(ageMilli(s.config, p.birthMinute, 0))
      expect(years).toBeGreaterThanOrEqual(first)
      expect(years).toBeLessThanOrEqual(last)
    }
  })
})

describe('the death table', () => {
  const c = resolveValleyConfig({})
  it('stores the Siler fit year by year', () => {
    for (let t = 0; t <= 110; t++) expect(Math.abs(c.deathPerMillionByAge[t]! - silerYear(t))).toBeLessThanOrEqual(1)
  })
  it('keeps survival under the daily rule at 90 days a year within a point of the fit', () => {
    // The exact chance a life drawn day by day survives, against the fit's continuous survival.
    let survive = 1,
      cumulative = 0
    for (let t = 0; t < 70; t++) {
      survive *= (1 - c.deathPerMillionByAge[t]! / (1e6 * c.daysPerYear)) ** c.daysPerYear
      cumulative += silerYear(t) / 1e6
      if ([1, 5, 15, 45, 70].includes(t + 1)) expect(Math.abs(survive - Math.exp(-cumulative))).toBeLessThan(0.01)
    }
  })
})

describe('growth', () => {
  it('grows a child by the tables and changes the body only at midnight', () => {
    const s = family()
    const kid = child(s, 0)
    for (const years of [0, 5, 12]) {
      aged(s, kid, years * 1_000)
      const w = s.config.growthByAge.weight[years]!
      expect(kid.weightKg).toBe(Math.max(1, Math.floor((kid.adultWeightKg * w) / 1_000)))
      expect(kid.reserveMaxKcal).toBe(Math.floor((s.config.reserveMaxKcal * w) / 1_000))
      expect(kid.loadCapacityKg).toBeLessThan(s.foragers[0]!.loadCapacityKg)
    }
    // At noon the body is the one grown at the last midnight.
    const noon = s.minute - (s.minute % DAY) + 720
    expect(natureAt(s.config, kid, noon)).toEqual(natureAt(s.config, kid, noon - 720))
  })
  it("leaves an adult's body as Life 18's", () => {
    const s = family()
    const mom = s.foragers[0]!
    const body = (minute: number) => ({ ...natureAt(s.config, mom, minute), ageMilli: 0 })
    expect(body(s.minute + 10 * YEAR(s))).toEqual(body(s.minute))
  })
})

describe('feeding', () => {
  function hungryBaby(months = 3) {
    const s = family()
    const kid = child(s, Math.floor((months * 1_000) / 12))
    kid.energyKcal = kid.hungryBelowKcal - 1
    kid.hungry = true
    kid.task = null
    kid.lastWakeMinute = s.minute
    s.foragers[0]!.task = null
    return { s, mom: s.foragers[0]!, kid }
  }
  it('moves kcal and water from mother to baby exactly', () => {
    const { s, mom, kid } = hungryBaby()
    kid.waterDeficitMl = 200
    const [m, k, mw, kw] = [mom.energyKcal, kid.energyKcal, mom.waterDeficitMl, kid.waterDeficitMl]
    expect(wantsFeed(s, kid, s.minute)).toBe(true)
    const { events } = feedChildren(s, mom, s.minute)
    const fed = events[0]!
    expect(fed.kcal).toBeGreaterThan(0)
    expect(mom.energyKcal + kid.energyKcal).toBe(m + k)
    expect(mom.waterDeficitMl + kid.waterDeficitMl).toBe(mw + kw)
    expect(kid.energyKcal - k).toBe(fed.kcal)
  })
  it('does not feed a baby whose mother is away or dead, or who is weaned', () => {
    let { s, mom, kid } = hungryBaby()
    mom.x += 10 * s.config.talkRadiusCm
    expect(wantsFeed(s, kid, s.minute)).toBe(false)
    ;({ s, mom, kid } = hungryBaby())
    mom.alive = false
    expect(wantsFeed(s, kid, s.minute)).toBe(false)
    ;({ s, mom, kid } = hungryBaby(12 * 4))
    expect(wantsFeed(s, kid, s.minute)).toBe(false)
  })
  it('never lets a baby on milk eat or drink at a bank', () => {
    const { s, kid } = hungryBaby(2)
    kid.waterDeficitMl = personConfig(s.config, kid).initialReserveKcal
    kid.thirsty = true
    expect(milkOnly(s, kid, s.minute)).toBe(true)
    expect(['drink', 'eat store']).not.toContain(chooseTask(s, kid, s.minute).kind)
  })
})

describe('carrying', () => {
  it('names the mother, then the father, then an older sibling as carrier', () => {
    const s = family()
    const older = child(s, 12_000)
    const baby = child(s, 300)
    expect(carrierOf(s, baby)?.id).toBe(0)
    s.foragers[0]!.alive = false
    expect(carrierOf(s, baby)?.id).toBe(1)
    s.foragers[1]!.alive = false
    expect(carrierOf(s, baby)?.id).toBe(older.id)
  })
  it("slows the carrier by the baby's weight", () => {
    const s = family()
    const mom = s.foragers[0]!
    const baby = child(s, 300)
    const c = personConfig(s.config, mom)
    expect(speedForLoad(c, baby.weightKg)).toBeLessThan(speedForLoad(c, 0))
  })
  it('carries a baby beside the mother on her walks, and leaves one out of talking distance behind', () => {
    const near = family()
    const baby = child(near, 300)
    const carried = (s: ValleyState) =>
      s.lastInterval.filter((e) => e.kind === 'carried' && e.foragerId === baby.id && e.carrierId === 0)
    let after = near,
      rides = 0
    const checker = new ValleyChecker(near)
    for (let h = 0; h < 8; h++) {
      after = stepValley(after, after.minute + 60)
      expect(checker.check(after)).toEqual([])
      rides += carried(after).length
    }
    expect(rides).toBeGreaterThan(0)
    // Every ride ends where the mother's walk ends.
    expect(
      after.foragers[baby.id]!.task?.kind === 'carried' || after.foragers[baby.id]!.x === after.foragers[0]!.x,
    ).toBe(true)
    const far = family()
    const left = child(far, 300)
    left.x += 3 * far.config.talkRadiusCm
    left.hearth = { x: left.x, y: left.y }
    const next = stepValley(far, far.minute + 120)
    expect(carried(next).length).toBe(0)
  })
})

describe("children's choices", () => {
  it('limits a five-year-old to their range and not a twelve-year-old', () => {
    const s = family()
    const five = child(s, 5_000),
      twelve = child(s, 12_000)
    expect(five.rangeCm).toBe(rangeAt(s.config, 5_000))
    expect(twelve.rangeCm).toBe(-1)
    const beyond = { x: five.hearth.x + five.rangeCm + 100, y: five.hearth.y }
    expect(inRange(five, beyond)).toBe(false)
    expect(inRange(twelve, beyond)).toBe(true)
  })
  it('lets a parent with no familiarity give where a stranger refuses', () => {
    const s = family()
    const tie = { ...NO_TIE, credit: 50 }
    expect(goodwillCovers(s, s.foragers[0]!, tie, 500)).toBe(true)
    expect(goodwillCovers(s, s.foragers[0]!, tie, 0)).toBe(false)
  })
})

describe('provisioning', () => {
  it("targets the young children's food at home, less as they work, none for children elsewhere", () => {
    const s = family()
    const mom = s.foragers[0]!
    const a = child(s, 2_000),
      b = child(s, 4_000)
    const young = familyDayKcal(s, mom, s.minute, false, false)
    expect(young).toBeGreaterThan(0)
    expect(familyFoodNeed(s, mom, s.minute)).toBe(young)
    aged(s, a, 12_000)
    aged(s, b, 14_000)
    expect(familyDayKcal(s, mom, s.minute, false, false)).toBeLessThan(young)
    a.hearth = { x: a.hearth.x + 1_000, y: a.hearth.y }
    b.hearth = a.hearth
    expect(familyDayKcal(s, mom, s.minute, false, false)).toBe(0)
  })
})

describe('pairing', () => {
  function four() {
    const s = family(4)
    for (const p of s.foragers) p.partnerId = null
    s.foragers[2]!.sex = 0
    s.foragers[3]!.sex = 1
    const know = (a: number, b: number, minutes: number) => {
      s.foragers[a]!.ties.set(b, { ...NO_TIE, familiarity: minutes })
      s.foragers[b]!.ties.set(a, { ...NO_TIE, familiarity: minutes })
    }
    return { s, know }
  }
  it('pairs two who are each other’s most familiar, and not when a third is closer', () => {
    let { s, know } = four()
    know(0, 1, s.config.pairFamiliarityMinutes)
    expect(pairAt(s, s.foragers[0]!, [1], s.minute)).toHaveLength(1)
    expect(s.foragers[1]!.partnerId).toBe(0)
    ;({ s, know } = four())
    know(0, 1, s.config.pairFamiliarityMinutes)
    know(1, 2, s.config.pairFamiliarityMinutes + 1)
    expect(pairAt(s, s.foragers[0]!, [1], s.minute)).toHaveLength(0)
  })
  it('never pairs kin, one sex, a fourteen-year-old or someone paired', () => {
    let { s, know } = four()
    const kid = child(s, 16_000)
    kid.sex = 1
    know(0, kid.id, 10 * s.config.pairFamiliarityMinutes)
    s.foragers[1]!.ties.clear()
    expect(mostFamiliarMate(s, s.foragers[0]!, s.minute)?.id).not.toBe(kid.id)
    ;({ s, know } = four())
    know(0, 2, s.config.pairFamiliarityMinutes)
    expect(mostFamiliarMate(s, s.foragers[0]!, s.minute)).toBeNull()
    ;({ s, know } = four())
    aged(s, s.foragers[1]!, 14_900)
    know(0, 1, s.config.pairFamiliarityMinutes)
    expect(pairAt(s, s.foragers[0]!, [1], s.minute)).toHaveLength(0)
    ;({ s, know } = four())
    know(0, 1, s.config.pairFamiliarityMinutes)
    s.foragers[1]!.partnerId = 2
    expect(pairAt(s, s.foragers[0]!, [1], s.minute)).toHaveLength(0)
  })
})

describe('kin and conception', () => {
  it('reads relatedness from recorded parents', () => {
    const f = (id: number, motherId: number | null, fatherId: number | null) => ({ id, motherId, fatherId })
    // 0 and 1 have 2 and 3; 0 and 4 have 5; 2 and 6 have 7; 3 and 8 have 9.
    const people = [
      f(0, null, null),
      f(1, null, null),
      f(2, 0, 1),
      f(3, 0, 1),
      f(4, null, null),
      f(5, 0, 4),
      f(6, null, null),
      f(7, 6, 2),
      f(8, null, null),
      f(9, 8, 3),
    ]
    const r = (a: number, b: number) => relatedness(people, people[a]!, people[b]!)
    expect([r(0, 2), r(2, 3), r(2, 5), r(0, 7), r(3, 7), r(7, 9), r(1, 4)]).toEqual([500, 500, 250, 250, 250, 125, 0])
  })
  function sleeping(s: ValleyState) {
    for (const p of [s.foragers[0]!, s.foragers[1]!]) {
      p.task = startTask(s.config, p, 'sleep', s.minute, s.minute + 300, -1, -1, 'night')
      p.energyKcal = p.reserveMaxKcal
      p.task.startEnergyKcal = p.energyKcal
    }
    return s
  }
  it('lets a well-fed paired woman asleep by her partner conceive, and no one else', () => {
    const midnight = 20 * DAY
    let s = sleeping(family(2, midnight))
    const mom = s.foragers[0]!
    expect(canConceive(s, mom, midnight)).toBe(true)
    mom.pregnancy = { day: dayOf(midnight), fatherId: 1 }
    expect(canConceive(s, mom, midnight)).toBe(false)
    s = sleeping(family(2, midnight))
    child(s, 500).lastFedMinute = midnight - 60
    expect(canConceive(s, s.foragers[0]!, midnight)).toBe(false)
    s = sleeping(family(2, midnight))
    s.foragers[0]!.task!.startEnergyKcal = s.foragers[0]!.fecundReserveKcal - 1
    expect(canConceive(s, s.foragers[0]!, midnight)).toBe(false)
    s = sleeping(family(2, midnight))
    s.foragers[1]!.x += 3 * s.config.talkRadiusCm
    expect(canConceive(s, s.foragers[0]!, midnight)).toBe(false)
    s = sleeping(family(2, midnight))
    aged(s, s.foragers[0]!, s.config.lastBirthYears * 1_000)
    s.foragers[0]!.task!.startEnergyKcal = s.foragers[0]!.reserveMaxKcal
    expect(canConceive(s, s.foragers[0]!, midnight)).toBe(false)
  })
  it("brings a pregnancy to term after its days, the newborn's energy leaving the mother", () => {
    const s = family(2, 20 * DAY)
    const mom = s.foragers[0]!
    mom.pregnancy = { day: 20, fatherId: 1 }
    const due = (20 + pregnancyDays(s.config)) * DAY
    expect(birthDue(s.config, mom, due - DAY)).toBe(false)
    expect(birthDue(s.config, mom, due)).toBe(true)
    const before = mom.energyKcal
    mom.task = null
    const born = deliver(s, mom, s.minute)
    expect(mom.energyKcal).toBe(before - born.kcal)
    expect(s.foragers[born.foragerId]!.energyKcal).toBe(born.kcal)
    expect(mom.pregnancy).toBeNull()
  })
})

describe('the checker', () => {
  /** A day of a family with a baby of three months and a mother due at the coming midnight. */
  function day() {
    const s = family(2, 30 * DAY + 600)
    const baby = child(s, 250)
    const mom = s.foragers[0]!
    mom.pregnancy = { day: 30 - pregnancyDays(s.config) + 1, fatherId: 1 }
    setNature(mom, natureAt(s.config, mom, s.minute), s.minute)
    const before = cloneValley(s)
    const after = stepValley(s, 31 * DAY + 600)
    return { before, after, baby }
  }
  const errorsOf = (before: ValleyState, after: ValleyState) => new ValleyChecker(cloneValley(before)).check(after)
  const withEvents = (s: ValleyState, change: (events: ValleyEvent[]) => ValleyEvent[]) => ({
    ...s,
    lastInterval: change(s.lastInterval.map((e) => structuredClone(e))),
  })
  const { before, after, baby } = day()
  const some = (kind: string, errors: string[]) => expect(errors.join('\n')).toMatch(kind)

  it('accepts the day as run', () => {
    expect(errorsOf(before, after)).toEqual([])
    expect(after.lastInterval.some((e) => e.kind === 'born')).toBe(true)
    expect(after.lastInterval.some((e) => e.kind === 'fed')).toBe(true)
  })
  it('rejects a feed that creates energy, or by someone not the mother', () => {
    some(
      'impossible feed',
      errorsOf(
        before,
        withEvents(after, (events) => events.map((e) => (e.kind === 'fed' ? { ...e, kcal: -5 } : e))),
      ),
    )
    some(
      'impossible feed',
      errorsOf(
        before,
        withEvents(after, (events) => events.map((e) => (e.kind === 'fed' ? { ...e, motherId: 1 } : e))),
      ),
    )
  })
  it('rejects a baby who ate, a carried person off their carrier’s walk, and a child grown wrongly', () => {
    some(
      'a baby on milk ate',
      errorsOf(
        before,
        withEvents(after, (events) =>
          events.map((e) => (e.kind === 'task-end' && e.foragerId === baby.id ? { ...e, ateKcal: 10 } : e)),
        ),
      ),
    )
    const carried = after.lastInterval.find((e) => e.kind === 'task-start' && e.task.kind === 'carried')
    if (carried)
      some(
        "carried away from their carrier's walk",
        errorsOf(
          before,
          withEvents(after, (events) =>
            events.map((e) =>
              e.kind === 'task-start' && e.task.kind === 'carried' ? { ...e, task: { ...e.task, routeId: 0 } } : e,
            ),
          ),
        ),
      )
    const grown = cloneValley(after)
    grown.foragers = grown.foragers.map((p) => (p.id === baby.id ? { ...p, ageMilli: p.ageMilli + 1_000 } : p))
    some('grown body differs', errorsOf(before, grown))
  })
  it('rejects work beyond a child’s range, a pairing of kin, a birth with no pregnancy and a nursing conception', () => {
    const at = after.minute - 60
    const start = after.lastInterval.find((e) => e.kind === 'task-start' && e.foragerId === 0)!
    if (start.kind !== 'task-start') throw new Error('no task')
    some(
      'impossible pairing',
      errorsOf(
        before,
        withEvents(after, (events) => [...events, { kind: 'paired', minute: at, foragerId: 0, otherId: baby.id }]),
      ),
    )
    const notPregnant = cloneValley(before)
    notPregnant.foragers = notPregnant.foragers.map((p) => (p.id === 0 ? { ...p, pregnancy: null } : p))
    some('birth with no pregnancy', errorsOf(notPregnant, after))
    some(
      'impossible conception',
      errorsOf(
        before,
        withEvents(after, (events) => [
          ...events,
          { kind: 'conceived', minute: 31 * DAY, foragerId: 0, fatherId: 1, draw: 0 },
        ]),
      ),
    )
    some(
      'worked beyond their range',
      errorsOf(
        before,
        withEvents(after, (events) => [
          ...events,
          {
            ...start,
            minute: at,
            foragerId: baby.id,
            position: { x: start.position.x + 1_000_000, y: start.position.y },
            task: { ...start.task, kind: 'pick' },
          },
        ]),
      ),
    )
  })
  it('rejects an illness death whose draw does not replay', () => {
    some(
      'Wrong death minute or cause',
      errorsOf(
        before,
        withEvents(after, (events) => [
          ...events,
          { kind: 'death', minute: 31 * DAY, foragerId: 1, cause: 'illness', draw: 1, ageMilli: 27_000 } as ValleyEvent,
        ]),
      ),
    )
  })
})
