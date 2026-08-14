import { DEFAULT_SEED } from './config'
import { concentrationShare } from './employmentDynamics'
import { createSimulation, stepSimulation } from './engine'
import { GINI_EQUALITY_TOLERANCE } from './government'
import type { GovernmentExperimentType, SimulationConfig } from './types'

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

export interface GovernmentDayObservation {
  day: number; incumbentRateBps: number; appliedRateBps: number; experimenting: boolean; experimentType: GovernmentExperimentType | null; experimentOutcome: 'adopted' | 'rejected' | null; experimentReferenceGini: number | null; priorIncumbentRateBps: number | null
  preGini: number; postGini: number; taxCents: number; transfersCents: number; preConcentration: [number, number, number]; postConcentration: [number, number, number]
  purchases: number; cashFailures: number; budgetFailures: number; inventoryFailures: number; unitsProduced: number; unitsSold: number; operatingRevenueCents: number; wagesCents: number
}

export interface GovernmentTrajectorySummary {
  seed: number; horizonDays: number; observations: GovernmentDayObservation[]
  government: { meanIncumbentRateBps: number; meanAppliedRateBps: number; minimumAppliedRateBps: number; maximumAppliedRateBps: number; experimentFraction: number; experiments: number; adopted: number; rejected: number; lowerTaxTieBreakAdoptions: number; categories: Record<string, number>; rateOccupancy: Record<'0-10' | '10-25' | '25-50' | '50-75' | '75-100', number>; taxRateChanges: number; longestIncumbentSpellDays: number; meanIncumbentSpellDays: number }
  distribution: { meanPreGini: number; meanPostGini: number; maximumPreGini: number; maximumPostGini: number; meanGiniReduction: number; meanTaxCents: number; meanTransfersCents: number; richest1Pre: number; richest1Post: number; richest2Pre: number; richest2Post: number; richest3Pre: number; richest3Post: number }
  consumption: { completionFraction: number; cashFailureFraction: number; cashFailures: number; categoryBudgetFailures: number; inventoryFailures: number }
  firms: { sellThrough: number; meanDailyOperatingRevenueCents: number; meanDailyWagesCents: number }
}

function summarize(seed: number, days: GovernmentDayObservation[]): GovernmentTrajectorySummary {
  const rates = days.map(({ incumbentRateBps }) => incumbentRateBps), spells: number[] = []; let spell = 0, previous: number | undefined
  for (const rate of rates) { if (rate === previous) spell++; else { if (spell) spells.push(spell); spell = 1; previous = rate } } if (spell) spells.push(spell)
  const experiments = days.filter(({ experimenting }) => experimenting)
  const occupancy = { '0-10': 0, '10-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 }
  for (const rate of days.map(({ appliedRateBps }) => appliedRateBps)) rate < 1_000 ? occupancy['0-10']++ : rate < 2_500 ? occupancy['10-25']++ : rate < 5_000 ? occupancy['25-50']++ : rate < 7_500 ? occupancy['50-75']++ : occupancy['75-100']++
  const attempts = days.length * 10 * 4, purchases = days.reduce((sum, day) => sum + day.purchases, 0), produced = days.reduce((sum, day) => sum + day.unitsProduced, 0), sold = days.reduce((sum, day) => sum + day.unitsSold, 0)
  return { seed, horizonDays: days.length, observations: days,
    government: { meanIncumbentRateBps: mean(rates), meanAppliedRateBps: mean(days.map(({ appliedRateBps }) => appliedRateBps)), minimumAppliedRateBps: Math.min(...days.map(({ appliedRateBps }) => appliedRateBps)), maximumAppliedRateBps: Math.max(...days.map(({ appliedRateBps }) => appliedRateBps)), experimentFraction: experiments.length / days.length, experiments: experiments.length, adopted: experiments.filter(({ experimentOutcome }) => experimentOutcome === 'adopted').length, rejected: experiments.filter(({ experimentOutcome }) => experimentOutcome === 'rejected').length, lowerTaxTieBreakAdoptions: experiments.filter((day) => day.experimentOutcome === 'adopted' && day.priorIncumbentRateBps !== null && day.appliedRateBps < day.priorIncumbentRateBps && day.experimentReferenceGini !== null && Math.abs(day.postGini - day.experimentReferenceGini) <= GINI_EQUALITY_TOLERANCE).length, categories: Object.fromEntries([...new Set(experiments.map(({ experimentType }) => experimentType!))].map((type) => [type, experiments.filter(({ experimentType }) => experimentType === type).length])), rateOccupancy: Object.fromEntries(Object.entries(occupancy).map(([key, count]) => [key, count / days.length])) as typeof occupancy, taxRateChanges: rates.slice(1).filter((rate, index) => rate !== rates[index]).length, longestIncumbentSpellDays: Math.max(...spells), meanIncumbentSpellDays: mean(spells) },
    distribution: { meanPreGini: mean(days.map(({ preGini }) => preGini)), meanPostGini: mean(days.map(({ postGini }) => postGini)), maximumPreGini: Math.max(...days.map(({ preGini }) => preGini)), maximumPostGini: Math.max(...days.map(({ postGini }) => postGini)), meanGiniReduction: mean(days.map((day) => day.preGini - day.postGini)), meanTaxCents: mean(days.map(({ taxCents }) => taxCents)), meanTransfersCents: mean(days.map(({ transfersCents }) => transfersCents)), richest1Pre: mean(days.map(({ preConcentration }) => preConcentration[0])), richest1Post: mean(days.map(({ postConcentration }) => postConcentration[0])), richest2Pre: mean(days.map(({ preConcentration }) => preConcentration[1])), richest2Post: mean(days.map(({ postConcentration }) => postConcentration[1])), richest3Pre: mean(days.map(({ preConcentration }) => preConcentration[2])), richest3Post: mean(days.map(({ postConcentration }) => postConcentration[2])) },
    consumption: { completionFraction: purchases / attempts, cashFailureFraction: days.reduce((sum, day) => sum + day.cashFailures, 0) / attempts, cashFailures: days.reduce((sum, day) => sum + day.cashFailures, 0), categoryBudgetFailures: days.reduce((sum, day) => sum + day.budgetFailures, 0), inventoryFailures: days.reduce((sum, day) => sum + day.inventoryFailures, 0) },
    firms: { sellThrough: produced ? sold / produced : 0, meanDailyOperatingRevenueCents: mean(days.map(({ operatingRevenueCents }) => operatingRevenueCents)), meanDailyWagesCents: mean(days.map(({ wagesCents }) => wagesCents)) } }
}

export function runGovernmentExperiment(seed = DEFAULT_SEED, horizonDays = 1_000, adaptiveGovernmentEnabled = true, overrides: Partial<SimulationConfig> = {}) {
  let state = createSimulation({ ...overrides, startingPriceCents: overrides.startingPriceCents ?? 200, initialStepCents: overrides.initialStepCents ?? 100, seed, adaptiveGovernmentEnabled })
  const observations: GovernmentDayObservation[] = []
  for (let index = 0; index < horizonDays; index++) {
    state = stepSimulation(state); const metric = state.metrics.at(-1)!, pre = state.households.map(({ preTaxCashCents }) => preTaxCashCents), post = state.households.map(({ cashCents }) => cashCents)
    const failureEvents = state.events.filter(({ day, type }) => day === state.day && type.includes('PURCHASE_FAILED'))
    const policyOutcome = [...state.events].reverse().find(({ day, type }) => day === state.day && (type === 'GOVERNMENT_POLICY_EXPERIMENT_ADOPTED' || type === 'GOVERNMENT_POLICY_EXPERIMENT_REJECTED'))
    observations.push({ day: state.day, incumbentRateBps: metric.incumbentWealthTaxRateBps, appliedRateBps: metric.appliedWealthTaxRateBps, experimenting: metric.governmentPolicyStatus === 'experiment', experimentType: metric.governmentExperimentType, experimentOutcome: policyOutcome?.type.endsWith('ADOPTED') ? 'adopted' : policyOutcome ? 'rejected' : null, experimentReferenceGini: policyOutcome?.referenceGini ?? null, priorIncumbentRateBps: policyOutcome?.incumbentTaxRateBps ?? null, preGini: metric.preFiscalCashGini, postGini: metric.postFiscalCashGini, taxCents: metric.totalWealthTaxCollectedCents, transfersCents: metric.totalMeansTestedTransfersCents, preConcentration: [concentrationShare(pre, 1), concentrationShare(pre, 2), concentrationShare(pre, 3)], postConcentration: [concentrationShare(post, 1), concentrationShare(post, 2), concentrationShare(post, 3)], purchases: state.households.reduce((sum, household) => sum + ['food', 'utilities', 'healthcare', 'entertainment'].filter((id) => household.industryOutcomes[id as keyof typeof household.industryOutcomes].purchasedToday).length, 0), cashFailures: failureEvents.filter((event) => event.minimumDeliveredCostCents! <= event.categoryBudgetCents! && event.householdCashAvailableCents! < event.minimumDeliveredCostCents!).length, budgetFailures: failureEvents.filter((event) => event.minimumDeliveredCostCents! > event.categoryBudgetCents!).length, inventoryFailures: failureEvents.filter(({ type }) => type.endsWith('STOCKOUT')).length, unitsProduced: metric.markets.reduce((sum, market) => sum + market.unitsProduced, 0), unitsSold: metric.markets.reduce((sum, market) => sum + market.unitsSold, 0), operatingRevenueCents: metric.totalRevenueCents, wagesCents: metric.totalWagesPaidCents })
  }
  return summarize(seed, observations)
}

export function runGovernmentBaselineComparison(seed = DEFAULT_SEED, horizonDays = 1_000) {
  return { adaptive: runGovernmentExperiment(seed, horizonDays, true), baseline: runGovernmentExperiment(seed, horizonDays, false) }
}
