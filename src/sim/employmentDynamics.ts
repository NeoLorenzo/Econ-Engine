import { giniCoefficient, median } from './analytics'
import { DEFAULT_SEED, TOTAL_MONEY_CENTS } from './config'
import { createSimulation, stepSimulation } from './engine'
import type { IndustryId, SimulationState } from './types'

export const CONSUMER_INDUSTRIES = ['food', 'utilities', 'healthcare', 'entertainment'] as const
export const LOW_CASH_THRESHOLDS_CENTS = [100, 500, 1_000] as const
export type ConsumerIndustryId = typeof CONSUMER_INDUSTRIES[number]
export type FailureCause = 'cash' | 'category_budget' | 'inventory'

export interface DailyHouseholdObservation {
  householdId: string; employerFirmId: string; openingCashCents: number; endCashCents: number; wageCents: number; spendingCents: number; netCashChangeCents: number
  outcomes: Record<ConsumerIndustryId, 'purchased' | FailureCause>
}
export interface DailyFirmObservation { firmId: string; industryId: IndustryId; employeeIds: string[]; produced: number; sold: number; expired: number; operatingEarningsCents: number; wagesCents: number }
export interface EmploymentDayObservation { day: number; households: DailyHouseholdObservation[]; firms: DailyFirmObservation[] }
export interface SpellSummary { days: number; fraction: number; spells: number; meanSpellDays: number; longestSpellDays: number }
export interface HouseholdDynamics {
  householdId: string; employerFirmId: string; meanCashCents: number; medianCashCents: number; minimumCashCents: number; maximumCashCents: number; day1CashCents: number; terminalCashCents: number
  meanDailyCashChangeCents: number; cumulativePositiveCashChangeCents: number; cumulativeNegativeCashChangeCents: number
  meanWageCents: number; medianWageCents: number; minimumWageCents: number; maximumWageCents: number; cumulativeWagesCents: number; wageShare: number
  meanWealthRank: number; wealthRankChanges: number; richestDays: number; poorestDays: number; top3Fraction: number; bottom3Fraction: number
  highestPaidFraction: number; lowestPaidFraction: number; daysAboveMeanWage: number; daysBelowMeanWage: number; longestAboveMeanWageSpell: number; longestBelowMeanWageSpell: number
  lowCash: Record<number, SpellSummary>; desiredPurchases: number; successfulPurchases: number; purchaseCompletionFraction: number
  completionByIndustry: Record<ConsumerIndustryId, number>; failures: Record<FailureCause, number>; failuresByIndustry: Record<ConsumerIndustryId, Record<FailureCause, number>>
}
export interface FirmDynamics { firmId: string; industryId: IndustryId; workerIds: string[]; cumulativeProduction: number; cumulativeSales: number; cumulativeExpiration: number; sellThroughRate: number; expirationRate: number; meanDailyProduction: number; meanDailySales: number; cumulativeOperatingEarningsCents: number; cumulativeWagesCents: number; meanDailyOperatingEarningsCents: number; meanEmployeeWageCents: number }
export interface ConcentrationSummary { mean: number; maximum: number; terminal: number }
export interface EmploymentDynamicsReport {
  seed: number; horizonDays: number; observations: EmploymentDayObservation[]
  economy: { meanCashGini: number; minimumCashGini: number; maximumCashGini: number; day1CashGini: number; terminalCashGini: number; meanWageGini: number; maximumWageGini: number; terminalWageGini: number; richest1: ConcentrationSummary; richest2: ConcentrationSummary; richest3: ConcentrationSummary; purchaseCompletionFraction: number; failureTotals: Record<FailureCause, number>; totalHouseholdCashCents: number }
  households: HouseholdDynamics[]; firms: FirmDynamics[]
  cashBins: Array<{ label: string; observations: number; meanNextDayCompletion: number | null }>
  cumulativeWageMeanCashPearson: number | null
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
export const concentrationShare = (values: number[], count: number) => { const total = values.reduce((sum, value) => sum + value, 0); return total === 0 ? 0 : [...values].sort((a, b) => b - a).slice(0, count).reduce((sum, value) => sum + value, 0) / total }
export const summarizeSeries = (values: number[]) => ({ mean: mean(values), minimum: Math.min(...values), maximum: Math.max(...values) })
export function fractionalRanks(values: number[]) { return values.map((value) => 1 + values.filter((other) => other > value).length + (values.filter((other) => other === value).length - 1) / 2) }
export function spellSummary(flags: boolean[]): SpellSummary { const lengths: number[] = []; let current = 0; for (const flag of flags) { if (flag) current += 1; else if (current) { lengths.push(current); current = 0 } } if (current) lengths.push(current); const days = lengths.reduce((sum, value) => sum + value, 0); return { days, fraction: flags.length ? days / flags.length : 0, spells: lengths.length, meanSpellDays: lengths.length ? days / lengths.length : 0, longestSpellDays: lengths.length ? Math.max(...lengths) : 0 } }
const longest = (flags: boolean[]) => spellSummary(flags).longestSpellDays
const pearson = (xs: number[], ys: number[]) => { const mx = mean(xs), my = mean(ys); const numerator = xs.reduce((sum, x, index) => sum + (x - mx) * (ys[index] - my), 0); const denominator = Math.sqrt(xs.reduce((sum, x) => sum + (x - mx) ** 2, 0) * ys.reduce((sum, y) => sum + (y - my) ** 2, 0)); return denominator === 0 ? null : numerator / denominator }

export function collectEmploymentObservations(initial: SimulationState, days: number) {
  let state = initial; const observations: EmploymentDayObservation[] = []
  for (let index = 0; index < days; index += 1) {
    const opening = Object.fromEntries(state.households.map(({ id, cashCents }) => [id, cashCents]))
    state = stepSimulation(state)
    const failures = new Map(state.events.filter(({ day, type }) => day === state.day && (type.includes('PURCHASE_FAILED'))).map((event) => {
      const cause: FailureCause = event.type.endsWith('STOCKOUT') ? 'inventory' : event.minimumDeliveredCostCents! > event.categoryBudgetCents! ? 'category_budget' : 'cash'
      return [`${event.householdId}:${event.industryId}`, cause]
    }))
    observations.push({ day: state.day, households: state.households.map((household) => ({ householdId: household.id, employerFirmId: household.employerFirmId, openingCashCents: opening[household.id], endCashCents: household.cashCents, wageCents: household.wageTodayCents, spendingCents: household.spendingTodayCents, netCashChangeCents: household.netCashChangeTodayCents, outcomes: Object.fromEntries(CONSUMER_INDUSTRIES.map((industryId) => [industryId, household.industryOutcomes[industryId].purchasedToday ? 'purchased' : failures.get(`${household.id}:${industryId}`)!])) as DailyHouseholdObservation['outcomes'] })), firms: state.firms.map((firm) => ({ firmId: firm.id, industryId: firm.industryId, employeeIds: [...firm.employeeIds], produced: firm.unitsProducedToday, sold: firm.unitsSoldToday, expired: firm.unitsExpiredToday, operatingEarningsCents: firm.revenueTodayCents, wagesCents: firm.wagesPaidTodayCents })) })
  }
  return { state, observations }
}

export function analyzeEmploymentDynamics(seed: number, observations: EmploymentDayObservation[]): EmploymentDynamicsReport {
  const horizonDays = observations.length; if (!horizonDays) throw new Error('Employment dynamics requires at least one day')
  const householdIds = observations[0].households.map(({ householdId }) => householdId)
  const cashGinis = observations.map((day) => giniCoefficient(day.households.map(({ endCashCents }) => endCashCents)))
  const wageGinis = observations.map((day) => giniCoefficient(day.households.map(({ wageCents }) => wageCents)))
  const concentrations = (count: number) => observations.map((day) => concentrationShare(day.households.map(({ endCashCents }) => endCashCents), count))
  const rankByDay = observations.map((day) => fractionalRanks(day.households.map(({ endCashCents }) => endCashCents)))
  const totalWages = observations.reduce((sum, day) => sum + day.households.reduce((subtotal, household) => subtotal + household.wageCents, 0), 0)
  const households = householdIds.map((householdId, householdIndex): HouseholdDynamics => {
    const series = observations.map((day) => day.households.find((household) => household.householdId === householdId)!), cash = series.map(({ endCashCents }) => endCashCents), wages = series.map(({ wageCents }) => wageCents), changes = series.map(({ netCashChangeCents }) => netCashChangeCents), ranks = rankByDay.map((day) => day[householdIndex])
    const dailyMeans = observations.map((day) => mean(day.households.map(({ wageCents }) => wageCents))), maxWages = observations.map((day) => Math.max(...day.households.map(({ wageCents }) => wageCents))), minWages = observations.map((day) => Math.min(...day.households.map(({ wageCents }) => wageCents)))
    const failuresByIndustry = Object.fromEntries(CONSUMER_INDUSTRIES.map((industryId) => [industryId, { cash: 0, category_budget: 0, inventory: 0 }])) as HouseholdDynamics['failuresByIndustry']; let successfulPurchases = 0
    for (const day of series) for (const industryId of CONSUMER_INDUSTRIES) day.outcomes[industryId] === 'purchased' ? successfulPurchases++ : failuresByIndustry[industryId][day.outcomes[industryId] as FailureCause]++
    const failures = { cash: 0, category_budget: 0, inventory: 0 }; for (const industry of Object.values(failuresByIndustry)) for (const cause of Object.keys(failures) as FailureCause[]) failures[cause] += industry[cause]
    return { householdId, employerFirmId: series[0].employerFirmId, meanCashCents: mean(cash), medianCashCents: median(cash), minimumCashCents: Math.min(...cash), maximumCashCents: Math.max(...cash), day1CashCents: cash[0], terminalCashCents: cash.at(-1)!, meanDailyCashChangeCents: mean(changes), cumulativePositiveCashChangeCents: changes.filter((value) => value > 0).reduce((sum, value) => sum + value, 0), cumulativeNegativeCashChangeCents: changes.filter((value) => value < 0).reduce((sum, value) => sum + value, 0), meanWageCents: mean(wages), medianWageCents: median(wages), minimumWageCents: Math.min(...wages), maximumWageCents: Math.max(...wages), cumulativeWagesCents: wages.reduce((sum, value) => sum + value, 0), wageShare: totalWages ? wages.reduce((sum, value) => sum + value, 0) / totalWages : 0, meanWealthRank: mean(ranks), wealthRankChanges: ranks.slice(1).filter((rank, index) => rank !== ranks[index]).length, richestDays: ranks.filter((rank) => rank === 1).length, poorestDays: ranks.filter((rank) => rank === Math.max(...rankByDay[0])).length, top3Fraction: ranks.filter((rank) => rank <= 3).length / horizonDays, bottom3Fraction: ranks.filter((rank) => rank >= householdIds.length - 2).length / horizonDays, highestPaidFraction: wages.filter((wage, index) => wage === maxWages[index]).length / horizonDays, lowestPaidFraction: wages.filter((wage, index) => wage === minWages[index]).length / horizonDays, daysAboveMeanWage: wages.filter((wage, index) => wage > dailyMeans[index]).length, daysBelowMeanWage: wages.filter((wage, index) => wage < dailyMeans[index]).length, longestAboveMeanWageSpell: longest(wages.map((wage, index) => wage > dailyMeans[index])), longestBelowMeanWageSpell: longest(wages.map((wage, index) => wage < dailyMeans[index])), lowCash: Object.fromEntries(LOW_CASH_THRESHOLDS_CENTS.map((threshold) => [threshold, spellSummary(cash.map((value) => value < threshold))])), desiredPurchases: horizonDays * 4, successfulPurchases, purchaseCompletionFraction: successfulPurchases / (horizonDays * 4), completionByIndustry: Object.fromEntries(CONSUMER_INDUSTRIES.map((industryId) => [industryId, series.filter((day) => day.outcomes[industryId] === 'purchased').length / horizonDays])) as HouseholdDynamics['completionByIndustry'], failures, failuresByIndustry }
  })
  const firmIds = observations[0].firms.map(({ firmId }) => firmId)
  const firms = firmIds.map((firmId): FirmDynamics => { const series = observations.map((day) => day.firms.find((firm) => firm.firmId === firmId)!), production = series.reduce((sum, firm) => sum + firm.produced, 0), sales = series.reduce((sum, firm) => sum + firm.sold, 0), expiration = series.reduce((sum, firm) => sum + firm.expired, 0), earnings = series.reduce((sum, firm) => sum + firm.operatingEarningsCents, 0), wages = series.reduce((sum, firm) => sum + firm.wagesCents, 0); return { firmId, industryId: series[0].industryId, workerIds: series[0].employeeIds, cumulativeProduction: production, cumulativeSales: sales, cumulativeExpiration: expiration, sellThroughRate: production ? sales / production : 0, expirationRate: production ? expiration / production : 0, meanDailyProduction: production / horizonDays, meanDailySales: sales / horizonDays, cumulativeOperatingEarningsCents: earnings, cumulativeWagesCents: wages, meanDailyOperatingEarningsCents: earnings / horizonDays, meanEmployeeWageCents: wages / horizonDays / series[0].employeeIds.length } })
  const failureTotals = { cash: 0, category_budget: 0, inventory: 0 }; households.forEach((household) => (Object.keys(failureTotals) as FailureCause[]).forEach((cause) => failureTotals[cause] += household.failures[cause]))
  const binDefs = [{ label: '<$1', min: -Infinity, max: 100 }, { label: '$1–$5', min: 100, max: 500 }, { label: '$5–$10', min: 500, max: 1_000 }, { label: '$10–$25', min: 1_000, max: 2_500 }, { label: '$25–$50', min: 2_500, max: 5_000 }, { label: '>$50', min: 5_000, max: Infinity }]
  const binValues = binDefs.map(() => [] as number[]); observations.forEach((day) => day.households.forEach((household) => { const completion = Object.values(household.outcomes).filter((outcome) => outcome === 'purchased').length / 4; const index = binDefs.findIndex(({ min, max }, binIndex) => household.openingCashCents >= min && (binIndex === binDefs.length - 1 ? household.openingCashCents > min : household.openingCashCents < max)); if (index >= 0) binValues[index].push(completion) }))
  const summary = (values: number[]): ConcentrationSummary => ({ mean: mean(values), maximum: Math.max(...values), terminal: values.at(-1)! })
  return { seed, horizonDays, observations, economy: { meanCashGini: mean(cashGinis), minimumCashGini: Math.min(...cashGinis), maximumCashGini: Math.max(...cashGinis), day1CashGini: cashGinis[0], terminalCashGini: cashGinis.at(-1)!, meanWageGini: mean(wageGinis), maximumWageGini: Math.max(...wageGinis), terminalWageGini: wageGinis.at(-1)!, richest1: summary(concentrations(1)), richest2: summary(concentrations(2)), richest3: summary(concentrations(3)), purchaseCompletionFraction: households.reduce((sum, household) => sum + household.successfulPurchases, 0) / (horizonDays * householdIds.length * 4), failureTotals, totalHouseholdCashCents: observations.at(-1)!.households.reduce((sum, household) => sum + household.endCashCents, 0) }, households, firms, cashBins: binDefs.map(({ label }, index) => ({ label, observations: binValues[index].length, meanNextDayCompletion: binValues[index].length ? mean(binValues[index]) : null })), cumulativeWageMeanCashPearson: pearson(households.map(({ cumulativeWagesCents }) => cumulativeWagesCents), households.map(({ meanCashCents }) => meanCashCents)) }
}

export function runEmploymentDynamics(seed = DEFAULT_SEED, days = 1_000) { const collected = collectEmploymentObservations(createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed }), days); if (collected.state.households.reduce((sum, household) => sum + household.cashCents, 0) !== TOTAL_MONEY_CENTS) throw new Error('Employment dynamics ended outside the closed circuit'); return analyzeEmploymentDynamics(seed, collected.observations) }
