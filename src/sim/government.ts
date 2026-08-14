import { giniCoefficient } from './analytics'
import { normalizeSeed, randomInt, seededShuffle } from './rng'
import type { Government, GovernmentExperimentType, GovernmentPolicyMode, Household } from './types'

export interface GovernmentCandidate { rateBps: number; type: GovernmentExperimentType }

export function deriveGovernmentPolicySeed(masterSeed: number) {
  return normalizeSeed((masterSeed ^ 0x9e37_79b9) >>> 0)
}

export function buildGovernmentExperimentCatalog(incumbentBps: number, mode?: GovernmentPolicyMode): GovernmentCandidate[] {
  const local: Array<[number, GovernmentExperimentType]> = [
    [100, 'local_up_1pp'], [-100, 'local_down_1pp'], [500, 'local_up_5pp'], [-500, 'local_down_5pp'],
    [1_000, 'local_up_10pp'], [-1_000, 'local_down_10pp'], [2_000, 'local_up_20pp'], [-2_000, 'local_down_20pp'],
  ]
  const anchors: Array<[number, GovernmentExperimentType]> = [[0, 'anchor_0'], [2_500, 'anchor_25'], [5_000, 'anchor_50'], [7_500, 'anchor_75'], [10_000, 'anchor_100']]
  const seen = new Set<number>([incumbentBps])
  const result: GovernmentCandidate[] = []
  for (const [value, type] of [...local.map(([delta, kind]) => [Math.max(0, Math.min(10_000, incumbentBps + delta)), kind] as [number, GovernmentExperimentType]), ...anchors]) {
    const directionAllowed = mode === undefined || (mode === 'equalizing' ? value > incumbentBps : value < incumbentBps)
    if (directionAllowed && !seen.has(value)) { seen.add(value); result.push({ rateBps: value, type }) }
  }
  return result
}

export function chooseGovernmentExperiment(incumbentBps: number, mode: GovernmentPolicyMode, rngState: number) {
  const catalog = buildGovernmentExperimentCatalog(incumbentBps, mode)
  if (!catalog.length) return { candidate: null, rngState }
  const draw = randomInt(rngState, catalog.length)
  return { candidate: catalog[draw.value], rngState: draw.state }
}

export function isEffectivelyEqual(cashCents: readonly number[]) {
  return cashCents.length === 0 || Math.max(...cashCents) - Math.min(...cashCents) <= 1
}

export function shouldAdoptGovernmentExperiment(mode: GovernmentPolicyMode, experimentalGini: number, referenceGini: number, experimentalEquality: boolean) {
  return mode === 'minimizing_tax' ? experimentalEquality : experimentalEquality || experimentalGini < referenceGini
}

/** Floor is the statutory cent-rounding rule: tax = floor(cash * bps / 10,000). */
export function taxForWealth(taxableWealthCents: number, rateBps: number) {
  return Math.floor(taxableWealthCents * rateBps / 10_000)
}

export function collectWealthTax(households: Household[], government: Government, rateBps: number) {
  let total = 0
  for (const household of households) {
    household.preTaxCashCents = household.cashCents
    const tax = taxForWealth(household.cashCents, rateBps)
    household.cashCents -= tax; government.cashCents += tax
    household.taxPaidTodayCents = tax; household.cumulativeTaxPaidCents += tax
    total += tax
  }
  government.taxCollectedTodayCents = total
  return total
}

/** Integer water filling; seeded order allocates indivisible cents among the tied poorest group. */
export function redistributeByWaterFilling(households: Household[], government: Government, rngState: number) {
  const transfers = new Map(households.map(({ id }) => [id, 0]))
  const ordered = [...households].sort((a, b) => a.cashCents - b.cashCents || a.id.localeCompare(b.id))
  let pool = government.cashCents
  let groupSize = 1
  while (pool > 0 && groupSize < ordered.length) {
    const level = ordered[groupSize - 1].cashCents + transfers.get(ordered[groupSize - 1].id)!
    const nextLevel = ordered[groupSize].cashCents
    const cost = (nextLevel - level) * groupSize
    if (cost <= pool) {
      for (let index = 0; index < groupSize; index++) transfers.set(ordered[index].id, transfers.get(ordered[index].id)! + nextLevel - level)
      pool -= cost; groupSize += 1
    } else break
  }
  if (pool > 0) {
    const base = Math.floor(pool / groupSize), remainder = pool % groupSize
    for (let index = 0; index < groupSize; index++) transfers.set(ordered[index].id, transfers.get(ordered[index].id)! + base)
    const shuffled = seededShuffle(ordered.slice(0, groupSize), rngState); rngState = shuffled.state
    for (let index = 0; index < remainder; index++) transfers.set(shuffled.values[index].id, transfers.get(shuffled.values[index].id)! + 1)
    pool = 0
  }
  for (const household of households) {
    const transfer = transfers.get(household.id)!
    government.cashCents -= transfer; household.cashCents += transfer
    household.transferReceivedTodayCents = transfer; household.cumulativeTransfersReceivedCents += transfer
    household.netFiscalTransferTodayCents = transfer - household.taxPaidTodayCents
    household.cumulativeNetFiscalPositionCents += household.netFiscalTransferTodayCents
    household.postFiscalCashCents = household.cashCents
  }
  government.redistributedTodayCents = [...transfers.values()].reduce((sum, value) => sum + value, 0)
  return { transfers, rngState }
}

export const householdCashGini = (households: readonly Household[]) => giniCoefficient(households.map(({ cashCents }) => cashCents))
