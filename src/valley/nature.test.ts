import { addTestLake, createSurveyedValley } from './ruleFixtures'
import { learnTriangle, nearestFrontier, walkableTriangle } from './routes'
import founders from './life13-founders.json'
import { describe, expect, it } from 'vitest'
import {
  NatureDraws,
  bodyFactor,
  drawNature,
  correlationMatrix,
  deriveNature,
  integerCholesky,
  natureConfigErrors,
  natureViolations,
  personalityFactor,
  personConfig,
  TRAITS,
} from './nature'
import { VALLEY_DEFAULT_CONFIG as c, FLAT_LAND } from './config'
import { drawNatures, drawStarts, drawTalents } from './layout'
import { bandAt } from './ruleTestFixtures'
import { chooseTask, foodGoal, mustGoHome, walkSpeed } from './forager'
import { bothGain, pairTerms, sellerShare, swap } from './trade'
import { meet } from './social'
import { startTask } from './tasks'
import { ValleyChecker } from './invariants'
import { cloneValley, stepValley } from './engine'
import { applySkills, skillsOf } from './skills'
import type { Forager, Personality, PersonNature, ValleyConfig } from './types'
const neutral: Personality = { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 }
const stats = (values: number[]) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return { mean, sd: Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) }
}
const correlation = (a: number[], b: number[]) => {
  const x = stats(a),
    y = stats(b)
  return a.reduce((n, v, i) => n + (v - x.mean) * (b[i]! - y.mean), 0) / (a.length * x.sd * y.sd)
}
/** Sets a person's foraging and wood experience, and the skills and rates that follow. */
function withExperience(config: ValleyConfig, p: Forager, forage: number, wood: number) {
  p.experience = p.experience.map((seconds, slot) => (slot === 0 ? forage : slot === 1 ? wood : seconds))
  applySkills(p, skillsOf(config, p.experience, p.known))
}
const setNature = (p: Forager, traits: Partial<Personality> = {}, weightKg = 60, gripKg = 31) =>
  Object.assign(p, deriveNature(c, { sex: 1, heightCm: 165, weightKg, gripKg, traits: { ...neutral, ...traits } }))

let sampled: { people: PersonNature[]; bySex: [PersonNature[], PersonNature[]] } | undefined
function samplePeople() {
  if (sampled) return sampled
  const bodies = new NatureDraws(514),
    traits = new NatureDraws(814),
    bf = bodyFactor(c),
    tf = personalityFactor(c)
  const people: PersonNature[] = [],
    bySex: [PersonNature[], PersonNature[]] = [[], []]
  while (bySex.some((group) => group.length < 10000)) {
    const p = drawNature(c, bodies, traits, bf, tf)
    people.push(p)
    if (bySex[p.sex].length < 10000) bySex[p.sex].push(p)
  }
  sampled = { people, bySex }
  return sampled
}

describe('Life 14 bodies and personality', () => {
  it('draws bounded integer normals with the specified mean and spread', () => {
    const stream = new NatureDraws(20260813),
      values = Array.from({ length: 10000 }, () => stream.normal())
    const { mean, sd } = stats(values)
    expect(Math.abs(mean)).toBeLessThan(30)
    expect(Math.abs(sd - 1000)).toBeLessThan(30)
    expect(values.every((v) => Number.isInteger(v) && Math.abs(v) <= 3000)).toBe(true)
  })
  it('factors the specified matrices with integer arithmetic and rejects indefinite matrices', () => {
    expect(bodyFactor(c)).toEqual([
      [1000, 0, 0],
      [550, 835, 0],
      [350, 248, 903],
    ])
    const expected = [
      [1000, 0, 0, 0, 0],
      [200, 979, 0, 0, 0],
      [430, 208, 878, 0, 0],
      [210, 396, 99, 888, 0],
      [-170, -404, -231, -159, 854],
    ]
    const actual = personalityFactor(c)
    actual.forEach((row, i) => row.forEach((v, j) => expect(Math.abs(v - expected[i]![j]!)).toBeLessThanOrEqual(1)))
    expect(() => integerCholesky(correlationMatrix(3, [900, 900, -900]))).toThrow('positive definite')
    expect(
      natureConfigErrors({ ...c, traitCorrelationsPerMille: [999, 999, -999, 0, 0, 0, 0, 0, 0, 0] }).length,
    ).toBeGreaterThan(0)
    expect(
      natureConfigErrors({ ...c, opennessRule: { ...c.opennessRule, effect: Number.MAX_SAFE_INTEGER } }),
    ).not.toEqual([])
    expect(natureConfigErrors({ ...c, womanWeightKg: 18 })).not.toEqual([])
  })
  it('matches within-sex body magnitudes and correlations over 10,000 draws per sex', () => {
    for (const sex of [0, 1] as const) {
      const columns = ['heightCm', 'weightKg', 'gripKg'].map((key) =>
        samplePeople().bySex[sex].map((p) => p[key as 'heightCm' | 'weightKg' | 'gripKg']),
      )
      const means = sex ? [165, 62, 38] : [154, 52, 24]
      columns.forEach((values, i) => {
        const s = stats(values)
        expect(Math.abs(s.mean - means[i]!)).toBeLessThan(1)
        expect(Math.abs(s.sd - 6)).toBeLessThan(0.5)
      })
      for (const [i, j, target] of [
        [0, 1, 0.55],
        [0, 2, 0.35],
        [1, 2, 0.4],
      ])
        expect(Math.abs(correlation(columns[i!]!, columns[j!]!) - target!)).toBeLessThan(0.05)
    }
  })
  it('matches all ten measured trait correlations over 10,000 draws', () => {
    const values = samplePeople()
      .people.slice(0, 10000)
      .map((p) => TRAITS.map((key) => p.traits[key]))
    let k = 0
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++)
        expect(
          Math.abs(
            correlation(
              values.map((v) => v[i]!),
              values.map((v) => v[j]!),
            ) -
              c.traitCorrelationsPerMille[k++]! / 1000,
          ),
        ).toBeLessThan(0.05)
  })
  it('makes heavy bodies faster under load, more costly to feed and slower to become thirsty; strong bodies carry more', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    setNature(p, {}, 45, 20)
    p.tripWood = 10
    p.wood = 10
    const speed = walkSpeed(s.config, p),
      rate = p.rates.pickKcalPerHour,
      thirst = p.thirstThresholds.urgent,
      load = p.loadCapacityKg
    setNature(p, {}, 70, 40)
    expect(walkSpeed(s.config, p)).toBeGreaterThan(speed)
    expect(p.rates.pickKcalPerHour).toBeGreaterThan(rate)
    expect(p.thirstThresholds.urgent).toBeGreaterThan(thirst)
    expect(p.loadCapacityKg).toBeGreaterThan(load)
    expect(startTask(s.config, p, 'pick', 600, 660, 0, -1, 'foraging').energyPerHour).toBe(p.rates.pickKcalPerHour)
    expect(personConfig(s.config, p).referenceBodyKg).toBe(70)
  })
  it('lets extraverts approach distant company while introverts still meet someone nearby', () => {
    const s = bandAt(),
      p = s.foragers[0]!,
      other = s.foragers[1]!
    p.groupId = null
    other.groupId = null
    p.metPosition.set(1, { x: p.x + 30000, y: p.y })
    p.seenMinute[1] = 600
    p.knownFlags = []
    setNature(p, { extraversion: -2000 })
    expect(chooseTask(s, p, 600).reason).not.toBe('seeking company')
    setNature(p, { extraversion: 1000 })
    expect(chooseTask(s, p, 600).reason).toBe('seeking company')
    other.x = p.x
    other.y = p.y
    setNature(p, { extraversion: -2000 })
    p.metMinute[1] = 600
    p.metPosition.set(1, { x: p.x, y: p.y })
    expect(meet(s, p, 600)).not.toBeNull()
  })
  it('leaves a more agreeable seller less gain and refuses a price with no mutual gain', () => {
    const s = bandAt(),
      seller = s.foragers[0]!,
      buyer = s.foragers[1]!
    setNature(seller)
    setNature(buyer)
    seller.forageRate = 600
    seller.woodRate = 20
    buyer.forageRate = 1800
    buyer.woodRate = 10
    expect(pairTerms(seller, buyer)).toBe(105)
    expect(sellerShare(seller, buyer)).toBe(500)
    setNature(seller, { agreeableness: 1000 })
    expect(pairTerms(seller, buyer)).toBeLessThan(105)
    expect(bothGain(seller, buyer, pairTerms(seller, buyer))).toBe(true)
    seller.forageRate = buyer.forageRate
    seller.woodRate = buyer.woodRate
    expect(swap(s.config, seller, s.foragers, 600).swaps).toEqual([])
  })
  it('plans larger stocks and satiation with conscientiousness and never targets just one night', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    setNature(p, { conscientiousness: -3000 })
    const wood = p.woodStockTarget,
      energy = p.satiationKcal
    expect(wood).toBeGreaterThan(12)
    setNature(p, { conscientiousness: 2000 })
    expect(p.woodStockTarget).toBeGreaterThan(wood)
    expect(p.satiationKcal).toBeGreaterThan(energy)
  })
  it('turns home earlier with neuroticism and ignores the margin for severe thirst', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.x -= 10000
    setNature(p, { neuroticism: -2000 })
    expect(mustGoHome(s, p, 1030)).toBe(false)
    setNature(p, { neuroticism: 2000 })
    expect(mustGoHome(s, p, 1030)).toBe(true)
    addTestLake(s)
    p.waterDeficitMl = p.thirstThresholds.urgent
    expect(chooseTask(s, p, 1030).reason).toBe('seeking water')
  })
  it('changes unfamiliar stock expectations with openness and limits idle exploration to home range', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    setNature(p, { openness: -2000 })
    const range = p.exploringRangeCm,
      share = p.expectedStockPerMille
    expect(range).toBeLessThan(100000)
    // Equal places, one never checked and one half full. Lower ID wins ties.
    s.layout = {
      ...s.layout,
      places: { ...s.layout.places, x: s.layout.places.x.slice(), y: s.layout.places.y.slice() },
    }
    const places = s.layout.places
    p.knownPlaces.fill(-1)
    p.knownPlaces[0] = 0
    p.knownPlaces[1] = 0
    const originalX = places.x[1]!,
      originalY = places.y[1]!
    places.x[1] = places.x[0]!
    places.y[1] = places.y[0]!
    p.placeStock[0] = -1
    p.placeStock[1] = Math.floor(s.config.berryThicketCapacityKcal / 2)
    expect(foodGoal(s, p, 600)?.placeId).toBe(1)
    setNature(p, { openness: 1000 })
    expect(p.exploringRangeCm).toBeGreaterThan(100000)
    expect(p.expectedStockPerMille).toBeGreaterThan(share)
    expect(foodGoal(s, p, 600)?.placeId).toBe(0)
    places.x[1] = originalX
    places.y[1] = originalY
  })
  it('recomputes every stored derived quantity and rejects corrupted immutable bodies and loads', () => {
    const base = bandAt(),
      after = stepValley(base, 601)
    expect(new ValleyChecker(base).check(after)).toEqual([])
    for (const damage of [
      (p: Forager) => (p.weightKg = 200),
      (p: Forager) => p.loadCapacityKg++,
      (p: Forager) => (p.tripWood = p.loadCapacityKg + 1),
      (p: Forager) => p.companyRadiusCm++,
    ]) {
      const broken = cloneValley(after)
      damage(broken.foragers[0]!)
      expect(new ValleyChecker(base).check(broken)).not.toEqual([])
    }
    expect(natureViolations(base.config, base.foragers[0]!)).toEqual([])
  })
  it('keeps a stronger gatherer working until their larger load is full', () => {
    const fixture = (grip: number) => {
      const state = bandAt(),
        p = state.foragers[0]!
      state.foragers[1]!.alive = false
      p.groupId = null
      setNature(p, {}, 60, grip)
      p.x = state.layout.places.x[0]!
      p.y = state.layout.places.y[0]!
      p.hearth = { x: p.x, y: p.y }
      p.wood = 0
      p.tripWood = 0
      p.shortOfWood = true
      return stepValley(state, 601).foragers[0]!.task!
    }
    const weak = fixture(20),
      strong = fixture(49)
    expect(weak.kind).toBe('gather')
    expect(strong.kind).toBe('gather')
    expect(strong.endMinute).toBeGreaterThan(weak.endMinute)
  })
  it('explores an idle frontier a kilometre from home only with enough openness', () => {
    const state = createSurveyedValley({ ...FLAT_LAND, valleySizeCm: 200000, founders: 1 }),
      p = state.foragers[0]!
    state.minute = 600
    p.x = 110000
    p.y = 100000
    p.hearth = { x: 10000, y: 100000 }
    p.wood = 24
    p.shortOfWood = false
    p.hungry = false
    p.knownPlaces.fill(-1)
    p.knowledge.triangles.fill(0)
    p.knowledge.revision++
    learnTriangle(p.knowledge, walkableTriangle(state.layout.nav.mesh, null, p))
    const frontier = nearestFrontier(state.layout.nav, p.knowledge, p)!
    expect(Math.hypot(frontier.x - p.hearth.x, frontier.y - p.hearth.y)).toBeGreaterThan(95000)
    setNature(p, { openness: -2000 })
    expect(chooseTask(state, p, 600).reason).not.toBe('exploring')
    setNature(p, { openness: 1000 })
    expect(chooseTask(state, p, 600).reason).toBe('exploring')
  })
  it('rejects a charge using the reference rate and an exchange off its agreed price', () => {
    const base = bandAt(),
      seller = base.foragers[0]!,
      buyer = base.foragers[1]!
    setNature(seller, {}, 70, 40)
    // The seller is a novice forager and a master at wood, the buyer the reverse.
    withExperience(base.config, seller, 0, 1e9)
    withExperience(base.config, buyer, 1e9, 0)
    seller.wood = 60
    buyer.wood = 0
    base.totals.initialWood += 12
    buyer.carried = [{ food: 'nuts', kcal: 20000, harvestTick: 600 }]
    base.totals.initialKcal += 20000
    const after = stepValley(base, 601)
    expect(new ValleyChecker(base).check(after)).toEqual([])
    const badPrice = cloneValley(after)
    badPrice.lastInterval = after.lastInterval.map((e) =>
      e.kind === 'exchange' ? { ...e, kcalPerWood: e.kcalPerWood + 1 } : e,
    )
    expect(badPrice.lastInterval.some((e) => e.kind === 'exchange')).toBe(true)
    expect(new ValleyChecker(base).check(badPrice)).toContain('Exchange differs from agreeableness price')
    const badRate = cloneValley(after)
    badRate.lastInterval = after.lastInterval.map((e) =>
      e.kind === 'task-start' && e.foragerId === 0
        ? { ...e, task: { ...e.task, energyPerHour: base.config.restKcalPerHour } }
        : e,
    )
    expect(new ValleyChecker(base).check(badRate)).not.toEqual([])
  })
  it('keeps bodies, traits and talents on separate repeatable streams without changing founder places', () => {
    expect(drawNatures(c)).toEqual(drawNatures(c))
    expect(drawNatures({ ...c, founders: 8 })).toEqual(drawNatures(c).slice(0, 8))
    // These are frozen Life 13 streams: adding body draws must not consume any of them.
    expect(drawTalents({ ...c, founders: 3 })).toEqual(drawTalents(c).slice(0, 3))
    for (const row of founders) {
      const config = { ...c, seed: row.seed }
      expect(drawStarts(config)).toEqual(row.starts)
      expect(drawTalents(config)).toEqual(row.talents)
    }
    expect(TRAITS).toHaveLength(5)
    expect(FLAT_LAND.founders).toBe(8)
  }, 180_000)
})
