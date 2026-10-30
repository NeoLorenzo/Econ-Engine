import { randomInt } from '../sim/rng'
import { isqrt } from './geometry'
import type { EnergyRateKey, Forager, PersonNature, Personality, TraitRule, ValleyConfig } from './types'

export const TRAITS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const
const clamp = (n: number, low = -3000, high = 3000) => Math.max(low, Math.min(high, n))
export const traitFactor = (rule: TraitRule, z: number) =>
  clamp(Math.floor(rule.base + (rule.effect * z) / 1000), rule.low, rule.high)
export class NatureDraws {
  constructor(public state: number) {}
  int(n: number) {
    const d = randomInt(this.state, n)
    this.state = d.state
    return d.value
  }
  normal() {
    let z = -5994
    for (let i = 0; i < 12; i++) z += this.int(1000)
    return clamp(z)
  }
}
export function correlationMatrix(size: number, pairs: readonly number[]) {
  if (pairs.length !== (size * (size - 1)) / 2) throw new Error('Wrong number of correlations')
  const matrix: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_value, j) => (i === j ? 1000 : 0)),
  )
  let k = 0
  for (let i = 0; i < size; i++)
    for (let j = i + 1; j < size; j++) {
      const v = pairs[k++]!
      if (!Number.isSafeInteger(v) || Math.abs(v) > 999)
        throw new Error('Correlations must be integers from -999 to 999')
      matrix[i]![j] = v
      matrix[j]![i] = v
    }
  return matrix
}
export function integerCholesky(c: number[][]) {
  const l = c.map((row) => row.map(() => 0))
  for (let i = 0; i < c.length; i++)
    for (let j = 0; j <= i; j++) {
      let n = 1000 * c[i]![j]!
      for (let k = 0; k < j; k++) n -= l[i]![k]! * l[j]![k]!
      if (i === j) {
        if (n <= 0) throw new Error('Correlation matrix must be positive definite')
        l[i]![j] = isqrt(n)
        if (!l[i]![j]) throw new Error('Correlation matrix must be positive definite')
      } else l[i]![j] = Math.trunc(n / l[j]![j]!)
    }
  return l
}
export const bodyFactor = (c: ValleyConfig) =>
  integerCholesky(correlationMatrix(3, [c.heightWeightPerMille, c.heightGripPerMille, c.weightGripPerMille]))
export const personalityFactor = (c: ValleyConfig) => integerCholesky(correlationMatrix(5, c.traitCorrelationsPerMille))
export function correlated(draws: NatureDraws, factor: number[][]) {
  const z = factor.map(() => draws.normal())
  return factor.map((row, i) => clamp(Math.trunc(row.slice(0, i + 1).reduce((n, v, j) => n + v * z[j]!, 0) / 1000)))
}
export function deriveNature(
  c: ValleyConfig,
  body: Pick<PersonNature, 'sex' | 'heightCm' | 'weightKg' | 'gripKg' | 'traits'>,
): PersonNature {
  const { weightKg, gripKg, traits } = body
  const f = traitFactor(c.conscientiousnessRule, traits.conscientiousness)
  const night = (24 - c.duskHour + c.dawnHour) * c.fireWoodPerHour
  const keys = [
    'walkKcalPerHour',
    'pickKcalPerHour',
    'gatherKcalPerHour',
    'chopKcalPerHour',
    'makeKcalPerHour',
    'restKcalPerHour',
    'sleepKcalPerHour',
    'fireSleepKcalPerHour',
    'hutSleepKcalPerHour',
    'coldSleepKcalPerHour',
  ] as const
  const rates = {} as Record<EnergyRateKey, number>
  for (const key of keys) rates[key] = Math.floor((c[key] * weightKg) / c.referenceBodyKg)
  rates.moderateWalkKcalPerHour = Math.floor((c.walkKcalPerHour * 3 * weightKg) / (2 * c.referenceBodyKg))
  rates.steepWalkKcalPerHour = Math.floor((c.walkKcalPerHour * 2 * weightKg) / c.referenceBodyKg)
  return {
    sex: body.sex,
    heightCm: body.heightCm,
    weightKg: body.weightKg,
    gripKg: body.gripKg,
    traits: body.traits,
    loadCapacityKg: Math.floor((c.woodLoad * (gripKg + c.referenceGripKg)) / (2 * c.referenceGripKg)),
    rates,
    thirstThresholds: {
      thirsty: weightKg * c.thirstBodyPerMille,
      urgent: weightKg * c.urgentThirstBodyPerMille,
      fatal: weightKg * c.fatalWaterLossBodyPerMille,
    },
    companyRadiusCm: Math.min(
      c.sightRadiusCm,
      Math.floor((c.companyRadiusCm * traitFactor(c.extraversionRule, traits.extraversion)) / 1000),
    ),
    sellerShareInput: traits.agreeableness,
    giveGoodwillPerMille: traitFactor(c.agreeablenessGiveRule, traits.agreeableness),
    woodStockTarget: Math.max(night + 1, Math.floor((c.woodStockNights * night * f) / 1000)),
    satiationKcal: Math.min(
      c.reserveMaxKcal,
      c.hungryBelowKcal + Math.floor(((c.satiatedAtKcal - c.hungryBelowKcal) * f) / 1000),
    ),
    duskMarginMinutes: Math.max(
      1,
      Math.floor((c.duskMarginMinutes * traitFactor(c.neuroticismRule, traits.neuroticism)) / 1000),
    ),
    exploringRangeCm: Math.floor((c.exploreRangeCm * traitFactor(c.opennessRule, traits.openness)) / 1000),
    expectedStockPerMille: traitFactor(c.opennessExpectRule, traits.openness),
    opennessInvent: traitFactor(c.opennessInventRule, traits.openness),
    conscientiousnessPractice: traitFactor(c.conscientiousnessPracticeRule, traits.conscientiousness),
  }
}
export function drawNature(
  c: ValleyConfig,
  bodies: NatureDraws,
  traits: NatureDraws,
  bf = bodyFactor(c),
  tf = personalityFactor(c),
): PersonNature {
  const sex = bodies.int(2) as 0 | 1,
    b = correlated(bodies, bf),
    t = correlated(traits, tf)
  return deriveNature(c, {
    sex,
    heightCm: (sex ? c.manHeightCm : c.womanHeightCm) + Math.floor((c.heightSdCm * b[0]!) / 1000),
    weightKg: (sex ? c.manWeightKg : c.womanWeightKg) + Math.floor((c.weightSdKg * b[1]!) / 1000),
    gripKg: (sex ? c.manGripKg : c.womanGripKg) + Math.floor((c.gripSdKg * b[2]!) / 1000),
    traits: Object.fromEntries(TRAITS.map((key, i) => [key, t[i]!])) as unknown as Personality,
  })
}
/** A cached personal view of configuration for shared task/route helpers. Never stored as run settings. */
const personalConfigs = new WeakMap<ValleyConfig, WeakMap<PersonNature['rates'], ValleyConfig>>()
export function personConfig(c: ValleyConfig, p: PersonNature): ValleyConfig {
  let people = personalConfigs.get(c)
  if (!people) {
    people = new WeakMap()
    personalConfigs.set(c, people)
  }
  let result = people.get(p.rates)
  if (!result) {
    result = {
      ...c,
      ...p.rates,
      referenceBodyKg: p.weightKg,
      woodLoad: p.loadCapacityKg,
      satiatedAtKcal: p.satiationKcal,
    }
    people.set(p.rates, result)
  }
  return result
}
export function natureViolations(c: ValleyConfig, p: Forager) {
  const errors: string[] = []
  if (p.sex !== 0 && p.sex !== 1) errors.push('Invalid sex')
  for (const [key, woman, man, sd] of [
    ['heightCm', 'womanHeightCm', 'manHeightCm', 'heightSdCm'],
    ['weightKg', 'womanWeightKg', 'manWeightKg', 'weightSdKg'],
    ['gripKg', 'womanGripKg', 'manGripKg', 'gripSdKg'],
  ] as const) {
    const mean = c[p.sex ? man : woman]
    if (!Number.isSafeInteger(p[key]) || Math.abs(p[key] - mean) > 3 * c[sd]) errors.push(`Invalid ${key}`)
  }
  if (TRAITS.some((key) => !Number.isSafeInteger(p.traits[key]) || Math.abs(p.traits[key]) > 3000))
    errors.push('Invalid trait score')
  const expected = deriveNature(c, p)
  for (const key of Object.keys(expected) as (keyof PersonNature)[])
    if (JSON.stringify(expected[key]) !== JSON.stringify(p[key])) errors.push(`Incorrect personal ${key}`)
  return errors
}
export function natureConfigErrors(c: ValleyConfig) {
  const errors: string[] = []
  for (const [woman, man, sd] of [
    ['womanHeightCm', 'manHeightCm', 'heightSdCm'],
    ['womanWeightKg', 'manWeightKg', 'weightSdKg'],
    ['womanGripKg', 'manGripKg', 'gripSdKg'],
  ] as const)
    if (
      ![c[woman], c[man], c[sd]].every(Number.isSafeInteger) ||
      c[sd] <= 0 ||
      Math.min(c[woman], c[man]) - 3 * c[sd] <= 0
    )
      errors.push(`Invalid body means or spread: ${sd}`)
  for (const key of [
    'referenceBodyKg',
    'referenceGripKg',
    'companyRadiusCm',
    'duskMarginMinutes',
    'exploreRangeCm',
  ] as const)
    if (!Number.isSafeInteger(c[key]) || c[key] <= 0) errors.push(`${key} must be positive`)
  for (const key of [
    'extraversionRule',
    'agreeablenessRule',
    'agreeablenessGiveRule',
    'conscientiousnessRule',
    'neuroticismRule',
    'opennessRule',
    'opennessExpectRule',
    'opennessInventRule',
    'conscientiousnessPracticeRule',
  ] as const) {
    const rule = c[key]
    if (
      !rule ||
      !['base', 'effect', 'low', 'high'].every((k) => Number.isSafeInteger(rule[k as keyof TraitRule])) ||
      rule.low < 0 ||
      rule.low > rule.high ||
      !Number.isSafeInteger(rule.effect * (key === 'agreeablenessRule' ? 6000 : 3000))
    )
      errors.push(`Invalid ${key}`)
    else
      for (const magnitude of [
        c.companyRadiusCm,
        c.exploreRangeCm,
        c.duskMarginMinutes,
        c.woodStockNights * 24 * c.fireWoodPerHour,
        c.reserveMaxKcal,
      ])
        if (!Number.isSafeInteger(magnitude * rule.high)) errors.push(`Unsafe product for ${key}`)
  }
  try {
    bodyFactor(c)
    personalityFactor(c)
  } catch (e) {
    errors.push(String(e))
  }
  for (const [woman, man, sd] of [
    ['womanHeightCm', 'manHeightCm', 'heightSdCm'],
    ['womanWeightKg', 'manWeightKg', 'weightSdKg'],
    ['womanGripKg', 'manGripKg', 'gripSdKg'],
  ] as const) {
    if (
      !Number.isSafeInteger((c[sd] * 3000) ** 2) ||
      !Number.isSafeInteger((Math.max(c[woman], c[man]) + 3 * c[sd]) * 1000)
    )
      errors.push(`Unsafe body product: ${sd}`)
  }
  if (
    !Number.isSafeInteger(c.woodLoad * (Math.max(c.womanGripKg, c.manGripKg) + 3 * c.gripSdKg + c.referenceGripKg)) ||
    !Number.isSafeInteger(2 * c.referenceGripKg)
  )
    errors.push('Unsafe carrying capacity product')
  for (const [range, rule] of [
    [c.companyRadiusCm, c.extraversionRule],
    [c.exploreRangeCm, c.opennessRule],
  ] as const)
    if (rule && !Number.isSafeInteger(Math.floor((range * rule.high) / 1000) ** 2))
      errors.push('Unsafe personal distance')
  const maxForage = (c.berryKcalPerHour * c.skillCeilingPercent) / 100
  const maxWood = (c.woodPerHour * c.skillCeilingPercent) / 100
  if (
    !Number.isSafeInteger(c.berryKcalPerHour * c.skillCeilingPercent) ||
    !Number.isSafeInteger(c.woodPerHour * c.skillCeilingPercent) ||
    !Number.isSafeInteger(2 * Math.ceil(maxForage) * Math.ceil(maxWood) * 1000) ||
    !Number.isSafeInteger(Math.ceil(maxWood) ** 2 * 1000)
  )
    errors.push('Unsafe agreeableness price product')
  const maxWeight = Math.max(c.womanWeightKg, c.manWeightKg) + 3 * c.weightSdKg
  const minWeight = Math.min(c.womanWeightKg, c.manWeightKg) - 3 * c.weightSdKg
  const minGrip = Math.min(c.womanGripKg, c.manGripKg) - 3 * c.gripSdKg
  const maxGrip = Math.max(c.womanGripKg, c.manGripKg) + 3 * c.gripSdKg
  const maxLoad =
    Math.floor((c.woodLoad * (maxGrip + c.referenceGripKg)) / (2 * c.referenceGripKg)) +
    Math.ceil(c.reserveMaxKcal / Math.min(c.berryKcalPerKg, c.nutKcalPerKg, c.fishKcalPerKg)) +
    c.logKg
  if (
    !Number.isSafeInteger(c.loadSlowdownPerMille * maxLoad) ||
    !Number.isSafeInteger(c.walkCmPerSecond * 1000 * maxWeight) ||
    !Number.isSafeInteger(c.walkCmPerSecond * c.loadSlowdownPerMille * maxLoad)
  )
    errors.push('Unsafe personal walking product')
  if (Math.floor((c.woodLoad * (minGrip + c.referenceGripKg)) / (2 * c.referenceGripKg)) < 1)
    errors.push('Minimum personal load must be positive')
  for (const rate of [
    c.walkKcalPerHour * 2,
    c.chopKcalPerHour,
    c.gatherKcalPerHour,
    c.pickKcalPerHour,
    c.makeKcalPerHour,
    c.restKcalPerHour,
    c.coldSleepKcalPerHour,
  ])
    if (
      !Number.isSafeInteger(rate * maxWeight) ||
      !Number.isSafeInteger(
        Math.floor((rate * maxWeight) / c.referenceBodyKg) * 60000 * 1440 * Math.max(1, c.waterExtraMlPerKcal),
      )
    )
      errors.push('Unsafe personal energy rate')
  for (const rate of [c.pickKcalPerHour, c.gatherKcalPerHour, c.chopKcalPerHour, c.makeKcalPerHour])
    if (
      Math.floor((rate * minWeight) / c.referenceBodyKg) <=
      Math.floor((c.restKcalPerHour * minWeight) / c.referenceBodyKg)
    )
      errors.push('Personal work must cost more than resting')
  return errors
}

/** Fixed run-level summaries, in thousandths, so statistics remain integer records. */
export function founderMetrics(people: readonly PersonNature[]) {
  return ([0, 1] as const).map((sex) => {
    const group = people.filter((p) => p.sex === sex)
    const fields = ['heightCm', 'weightKg', 'gripKg', ...TRAITS] as const
    const statistics = Object.fromEntries(
      fields.map((key) => {
        const values = group.map((p) =>
          key === 'heightCm' || key === 'weightKg' || key === 'gripKg' ? p[key] : p.traits[key],
        )
        if (!values.length) return [key, { meanPerMille: 0, sdPerMille: 0 }]
        const total = values.reduce((a, b) => a + BigInt(b), 0n),
          squares = values.reduce((a, b) => a + BigInt(b) * BigInt(b), 0n),
          n = BigInt(values.length)
        return [
          key,
          {
            meanPerMille: Number((total * 1000n) / n),
            sdPerMille: isqrt(Number(((squares * n - total * total) * 1000000n) / (n * n))),
          },
        ]
      }),
    )
    return { sex, count: group.length, statistics }
  })
}
