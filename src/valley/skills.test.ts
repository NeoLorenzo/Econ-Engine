import { describe, expect, it } from 'vitest'
import { attemptOf, beginAxe, bestTechnique, practiceTechnique, workAxe, worthTo } from './axes'
import { VALLEY_DEFAULT_CONFIG as c } from './config'
import { cloneValley, stepValley } from './engine'
import { ValleyChecker } from './invariants'
import { deriveNature } from './nature'
import { chooseTask } from './forager'
import { bandAt, giveHut } from './ruleTestFixtures'
import {
  SECONDS_PER_HOUR,
  experienceDay,
  founderExperience,
  gainIdea,
  inventAfter,
  inventChance,
  learnOf,
  practiceBudget,
  proficiencyOf,
  skillOf,
  successOf,
} from './skills'

const none = [0, 0, 0, 0, 0]
const average = { forage: 1_000, wood: 1_000, craft: 1_000 }
const fresh = (experience: number[]) => ({
  experience,
  fadeRemainder: experience.map(() => 0),
  gainRemainder: experience.map(() => 0),
})

describe('Life 17 skills', () => {
  it('follows the power law of practice: floor, half way, never the ceiling, each block adding less', () => {
    expect(skillOf(c, 0, 300)).toBe(50)
    expect(skillOf(c, 300 * SECONDS_PER_HOUR, 300)).toBe(100)
    expect(skillOf(c, 1e12, 300)).toBeLessThan(150)
    const gains = [0, 1, 2, 3].map(
      (block) =>
        skillOf(c, (block + 1) * 300 * SECONDS_PER_HOUR, 300) - skillOf(c, block * 300 * SECONDS_PER_HOUR, 300),
    )
    for (let i = 1; i < gains.length; i += 1) expect(gains[i]).toBeLessThan(gains[i - 1]!)
  })

  it.each([90, 365])('halves unused experience in ten years at %i days a year', (daysPerYear) => {
    const config = { ...c, daysPerYear }
    let day = fresh([1e9, 0, 0, 0, 0])
    for (let d = 0; d < 10 * daysPerYear; d += 1) day = experienceDay(config, day, none, average)
    expect(day.experience[0]! / 1e9).toBeCloseTo(0.5, 2)
  })

  it('anchors experience to the year and scales it by talent', () => {
    const worked = [SECONDS_PER_HOUR, 0, 0, 0, 0]
    const gain = (daysPerYear: number, learn = average) =>
      experienceDay({ ...c, daysPerYear }, fresh(none), worked, learn).experience[0]!
    expect(gain(90) / gain(365)).toBeCloseTo(365 / 90, 2)
    const talented = learnOf(c, { forage: 1_000, wood: 0, craft: 0 })
    expect(talented.forage).toBe(1_250)
    expect(gain(365, talented)).toBe(Math.floor((gain(365) * 5) / 4))
    expect(founderExperience(c, talented, 1).experience[0]).toBe(
      (founderExperience(c, average, 1).experience[0]! * 5) / 4,
    )
  })

  it('carries a share of other technique experience into a newly learnt one', () => {
    const hours = 200 * SECONDS_PER_HOUR
    const fromGround = proficiencyOf(c, [0, 0, 0, 0, hours], 1)
    expect(fromGround).toBeGreaterThan(proficiencyOf(c, none, 1))
    expect(fromGround).toBeLessThan(proficiencyOf(c, [0, 0, 0, hours, 0], 1))
  })

  it('makes an attempt work more often with proficiency, and a broken one still teaches', () => {
    expect(successOf(c, 50)).toBe(0)
    expect(successOf(c, 63)).toBe(428)
    expect(successOf(c, 120)).toBe(956)
    const s = bandAt(),
      p = s.foragers[0]!
    p.known = 1
    p.ideas = 1
    gainIdea(s.config, p, 1)
    p.stone = 1
    beginAxe(s, p, 600, true)
    const making = p.making!
    expect(making).toMatchObject({ technique: 1, practice: true, beganMinute: 600 })
    expect(attemptOf(s.config, p, 1, making.proficiency, 600)).toEqual({
      needed: making.needed,
      draw: making.draw,
      breakAt: making.breakAt,
    })
    // A break 100 seconds in: the stone is lost, the wood returned, and the seconds count as experience.
    p.making = { ...making, breakAt: 100 }
    const wood = p.wood
    const broke = workAxe(s, p, 500, 700)
    expect(broke).toMatchObject({ worked: 100, made: null, broke: { technique: 1, worked: 100, practice: true } })
    expect([p.making, p.stone, p.wood, p.craftToday[1]]).toEqual([null, 0, wood + 1, 100])
    // The first attempt that works makes the technique known.
    p.stone = 1
    beginAxe(s, p, 800, true)
    p.making = { ...p.making!, breakAt: -1 }
    expect(workAxe(s, p, p.making.needed, 900).learnt).toEqual({
      kind: 'learnt',
      minute: 900,
      foragerId: p.id,
      technique: 1,
    })
    expect(p.known).toBe(3)
  })

  it('thinks of a technique while working, more often the more open, never without what it needs', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    const sure = { ...s.config, inventPerMillionPerHour: 1_000_000 }
    p.known = 1
    p.ideas = 1
    expect(inventAfter(sure, p, 3_600, 600).map((e) => [e.technique, e.how])).toEqual([
      [1, 'invented'],
      [2, 'invented'],
    ])
    expect([p.ideas, p.known]).toEqual([7, 1])
    expect(p.proficiency[2]).toBe(proficiencyOf(c, p.experience, 2))
    const [flaked, tranchet, ground] = c.axeTechniques
    const chain = { ...sure, axeTechniques: [flaked!, tranchet!, { ...ground!, needs: 1 }] }
    const q = { ...p, ideas: 1 }
    expect(inventAfter(chain, q, 3_600, 600).map((e) => e.technique)).toEqual([1])
    const chance = (opennessInvent: number) => inventChance(c, { opennessInvent }, 3_600)
    expect(Math.abs(chance(2_000) - 2 * chance(1_000))).toBeLessThanOrEqual(1)
    const nature = (openness: number, conscientiousness: number) =>
      deriveNature(c, {
        sex: 1,
        heightCm: 165,
        weightKg: 60,
        gripKg: 31,
        traits: { openness, conscientiousness, extraversion: 0, agreeableness: 0, neuroticism: 0 },
      })
    expect([nature(-1_000, 0).opennessInvent, nature(0, 0).opennessInvent, nature(1_000, 0).opennessInvent]).toEqual([
      0, 1_000, 2_000,
    ])
    expect(practiceBudget(c, nature(0, 1_000))).toBe(105)
    expect(practiceBudget(c, nature(0, -2_000))).toBe(0)
  })

  it("practises in free time, an untried idea first, up to the day's budget", () => {
    const s = bandAt(),
      p = s.foragers[0]!
    giveHut(s, p)
    p.x = p.hearth.x
    p.y = p.hearth.y
    p.known = 1
    p.ideas = 1
    gainIdea(s.config, p, 1)
    p.stone = 1
    expect(chooseTask(s, p, 600)).toMatchObject({ kind: 'make', reason: 'practising', practice: true })
    expect(practiceTechnique(s, p)).toBe(1)
    p.practicedToday = practiceBudget(s.config, p)
    expect(chooseTask(s, p, 600).reason).not.toBe('practising')
    p.practicedToday = 0
    p.hungry = true
    expect(chooseTask(s, p, 600).reason).not.toBe('practising')
  })

  it('takes a practice axe apart when both hands are full, and still learns from it', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    const held = { id: 90, technique: 0, quality: 60, logsLeft: 10, makerId: 0, madeMinute: 0 }
    p.axe = held
    p.spareAxe = { ...held, id: 91 }
    p.known = 1
    p.ideas = 1
    gainIdea(s.config, p, 1)
    p.stone = 1
    const { stonesWorked, axeWood, axesMade } = s.totals
    beginAxe(s, p, 600, true)
    p.making = { ...p.making!, breakAt: -1 }
    const wood = p.wood
    const result = workAxe(s, p, p.making.needed, 900)
    expect(result.made).toBeNull()
    expect(result.dismantled).toMatchObject({ kind: 'dismantled', technique: 1, foragerId: p.id })
    expect(result.learnt).toMatchObject({ technique: 1 })
    expect([p.stone, p.wood, p.axe.id, p.spareAxe.id, p.known]).toEqual([1, wood + s.config.axeWood, 90, 91, 3])
    expect([s.totals.stonesWorked, s.totals.axeWood, s.totals.axesMade]).toEqual([stonesWorked, axeWood, axesMade])
  })

  it('weighs the chance an attempt works when choosing a technique', () => {
    const p = bandAt().foragers[0]!
    p.known = 3
    p.ideas = 3
    p.proficiency = [70, 60, 0]
    // Without failures the tranchet axe costs less work per log; with them, the surer flaked axe.
    expect(bestTechnique(c, p)).toBe(0)
    expect(bestTechnique({ ...c, attemptHalfPercent: 1 }, p)).toBe(1)
  })

  it('values a long-lived axe above a short-lived one', () => {
    const p = bandAt().foragers[0]!
    expect(worthTo(c, p, 150)).toBeGreaterThan(worthTo(c, p, 8))
  })

  it('catches skills, experience, ideas, attempts and axes that disagree with the rules', () => {
    const base = bandAt(1_430),
      first = base.foragers[0]!
    first.known = 1
    first.ideas = 1
    first.proficiency = first.proficiency.map((value, t) => (t === 0 ? value : 0))
    const after = stepValley(base, 1_441)
    const checker = () => new ValleyChecker(base)
    expect(checker().check(after)).toEqual([])
    const broken = (change: (state: typeof after) => void) => {
      const state = cloneValley(after)
      change(state)
      return checker().check(state)
    }
    expect(broken((s) => (s.foragers[0]!.forageSkill += 1))).toContain('person 0: forageSkill differs from experience')
    expect(
      broken((s) => (s.foragers[0]!.experience = s.foragers[0]!.experience.map((e, i) => (i === 0 ? e + 3_600 : e)))),
    ).toContain('person 0: experience differs from the skills rule')
    expect(broken((s) => (s.foragers[0]!.known = 4))).toContain('person 0: impossible ideas or techniques known')
    expect(
      broken((s) => {
        const p = s.foragers[0]!
        p.ideas = 3
        p.known = 3
        gainIdea(s.config, p, 1)
      }),
    ).toEqual(
      expect.arrayContaining([
        'person 0: techniques known differ from their records',
        'person 0: ideas differ from their records',
      ]),
    )
    expect(
      broken((s) => {
        const p = s.foragers[0]!
        gainIdea(s.config, p, 2)
        s.lastInterval.push({
          kind: 'idea',
          minute: 1_440,
          foragerId: 0,
          technique: 2,
          how: 'invented',
          fromId: -1,
          seconds: 60,
          chance: inventChance(s.config, p, 60),
          draw: 999_999,
        })
      }),
    ).toContain('An idea thought of differs from its draw')
    expect(broken((s) => (s.foragers[0]!.practicedToday = 1_441))).toContain(
      'person 0: practised more than their budget',
    )
    const p0 = after.foragers[0]!
    const making = {
      technique: 0,
      worked: 0,
      forSale: false,
      beganMinute: 1_440,
      proficiency: p0.proficiency[0]!,
      practice: false,
      ...attemptOf(after.config, p0, 0, p0.proficiency[0]!, 1_440),
    }
    expect(broken((s) => (s.foragers[0]!.making = { ...making, draw: (making.draw + 1) % 1_000 }))).toContain(
      'person 0: an axe in progress differs from its attempt draw',
    )
    expect(broken((s) => (s.foragers[0]!.making = { ...making, technique: 2 }))).toContain(
      'person 0: making an axe by a technique not among their ideas',
    )
    expect(
      broken(
        (s) => (s.foragers[0]!.axe = { id: 99, technique: 0, quality: 151, logsLeft: 1, makerId: 0, madeMinute: 0 }),
      ),
    ).toContain('Impossible or duplicated axe')
  })
})
