import { DEFAULT_SEED } from './config'
import { createSimulation, stepSimulation } from './engine'
import type { IndustryId } from './types'

export interface EmploymentExperimentResult {
  seed: number
  horizonDays: number
  cashGiniTrajectory: number[]
  meanCashTrajectoryCents: number[]
  minimumCashTrajectoryCents: number[]
  maximumCashTrajectoryCents: number[]
  households: Array<{ householdId: string; employerFirmId: string; averageCashCents: number; cumulativeWagesCents: number; purchaseSuccessFraction: number; affordabilityFailures: number }>
  firms: Array<{ firmId: string; cumulativeProduction: number; cumulativeSales: number; cumulativeExpiration: number; cumulativeOperatingEarningsCents: number; cumulativeWagesCents: number }>
  totalMoneyCents: number
}

export function runEmploymentExperiment(seed = DEFAULT_SEED, horizonDays = 1_000): EmploymentExperimentResult {
  let state = createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed })
  const cashSums = Object.fromEntries(state.households.map(({ id }) => [id, 0])) as Record<string, number>
  const firmTotals = Object.fromEntries(state.firms.map(({ id }) => [id, { production: 0, sales: 0, expiration: 0, earnings: 0, wages: 0 }]))
  const cashGiniTrajectory: number[] = [], meanCashTrajectoryCents: number[] = [], minimumCashTrajectoryCents: number[] = [], maximumCashTrajectoryCents: number[] = []
  for (let day = 0; day < horizonDays; day += 1) {
    state = stepSimulation(state)
    const metric = state.metrics.at(-1)!
    cashGiniTrajectory.push(metric.householdCashGini); meanCashTrajectoryCents.push(metric.totalHouseholdCashCents / state.households.length)
    minimumCashTrajectoryCents.push(metric.householdCashMinimumCents); maximumCashTrajectoryCents.push(metric.householdCashMaximumCents)
    state.households.forEach(({ id, cashCents }) => { cashSums[id] += cashCents })
    state.firms.forEach((firm) => { const total = firmTotals[firm.id]; total.production += firm.unitsProducedToday; total.sales += firm.unitsSoldToday; total.expiration += firm.unitsExpiredToday; total.earnings += firm.revenueTodayCents; total.wages += firm.wagesPaidTodayCents })
  }
  const consumerIds: IndustryId[] = ['food', 'utilities', 'healthcare', 'entertainment']
  return {
    seed, horizonDays, cashGiniTrajectory, meanCashTrajectoryCents, minimumCashTrajectoryCents, maximumCashTrajectoryCents,
    households: state.households.map((household) => { const outcomes = consumerIds.map((id) => household.industryOutcomes[id]); const successes = outcomes.reduce((sum, outcome) => sum + outcome.lifetimeUnitsPurchased, 0); const failures = outcomes.reduce((sum, outcome) => sum + outcome.lifetimeAffordabilityFailures, 0); return { householdId: household.id, employerFirmId: household.employerFirmId, averageCashCents: cashSums[household.id] / horizonDays, cumulativeWagesCents: household.cumulativeWagesCents, purchaseSuccessFraction: successes / (horizonDays * consumerIds.length), affordabilityFailures: failures } }),
    firms: state.firms.map((firm) => ({ firmId: firm.id, cumulativeProduction: firmTotals[firm.id].production, cumulativeSales: firmTotals[firm.id].sales, cumulativeExpiration: firmTotals[firm.id].expiration, cumulativeOperatingEarningsCents: firmTotals[firm.id].earnings, cumulativeWagesCents: firmTotals[firm.id].wages })),
    totalMoneyCents: state.households.reduce((sum, household) => sum + household.cashCents, 0),
  }
}
