import { DEFAULT_SEED } from './config'
import { createSimulation, stepSimulation } from './engine'
import type { IndustryId } from './types'

export interface FirmWageProfitTrajectory {
  firmId: string
  industryId: IndustryId
  contractualPayrollCents: number
  wagesPaidCents: number
  unpaidWagesCents: number
  payrollFulfillmentRate: number
  fullPayrollFraction: number
  partialPayrollFraction: number
  longestIncompletePayrollSpell: number
  residualProfitCents: number
  corporateTaxCents: number
  positiveProfitFraction: number
}

export function runWagesProfitsExperiment(seed = DEFAULT_SEED, horizonDays = 1_000) {
  let state = createSimulation({ seed })
  const firmSeries = new Map<string, Array<{ owed: number; paid: number; unpaid: number; profit: number; tax: number }>>()
  let contractualPayrollCents = 0, wagesPaidCents = 0, unpaidWagesCents = 0, residualProfitCents = 0, corporateTaxCents = 0, wealthTaxCents = 0, redistributionCents = 0
  let equalityDays = 0, consumption = 0, cashGiniTotal = 0, wageGiniTotal = 0
  const wealthTaxRatesBps: number[] = []
  for (let day = 0; day < horizonDays; day++) {
    state = stepSimulation(state)
    const metric = state.metrics.at(-1)!
    contractualPayrollCents += metric.totalContractualPayrollCents; wagesPaidCents += metric.totalWagesPaidCents; unpaidWagesCents += metric.totalUnpaidWagesCents
    residualProfitCents += metric.totalResidualFirmProfitCents; corporateTaxCents += metric.totalCorporateProfitTaxCents; wealthTaxCents += metric.totalWealthTaxCollectedCents; redistributionCents += metric.totalMeansTestedTransfersCents
    equalityDays += Number(metric.effectiveEquality); wealthTaxRatesBps.push(metric.appliedWealthTaxRateBps); cashGiniTotal += metric.householdCashGini; wageGiniTotal += metric.wageIncomeGini
    consumption += state.households.reduce((sum, household) => sum + Object.values(household.industryOutcomes).filter(({ purchasedToday }) => purchasedToday).length, 0)
    state.firms.forEach((firm) => { const series = firmSeries.get(firm.id) ?? []; series.push({ owed: firm.contractualPayrollTodayCents, paid: firm.wagesPaidTodayCents, unpaid: firm.unpaidWagesTodayCents, profit: firm.residualProfitTodayCents, tax: firm.corporateProfitTaxTodayCents }); firmSeries.set(firm.id, series) })
  }
  const longest = (values: boolean[]) => values.reduce(({ best, run }, value) => ({ run: value ? run + 1 : 0, best: Math.max(best, value ? run + 1 : 0) }), { best: 0, run: 0 }).best
  const firms: FirmWageProfitTrajectory[] = state.firms.map((firm) => { const series = firmSeries.get(firm.id)!; const owed = series.reduce((sum, day) => sum + day.owed, 0), paid = series.reduce((sum, day) => sum + day.paid, 0), profit = series.reduce((sum, day) => sum + day.profit, 0); return { firmId: firm.id, industryId: firm.industryId, contractualPayrollCents: owed, wagesPaidCents: paid, unpaidWagesCents: owed - paid, payrollFulfillmentRate: owed ? paid / owed : 1, fullPayrollFraction: series.filter((day) => day.unpaid === 0).length / horizonDays, partialPayrollFraction: series.filter((day) => day.unpaid > 0).length / horizonDays, longestIncompletePayrollSpell: longest(series.map((day) => day.unpaid > 0)), residualProfitCents: profit, corporateTaxCents: series.reduce((sum, day) => sum + day.tax, 0), positiveProfitFraction: series.filter((day) => day.profit > 0).length / horizonDays } })
  const byIndustry = Object.fromEntries(state.industries.map(({ id }) => [id, { residualProfitCents: firms.filter((firm) => firm.industryId === id).reduce((sum, firm) => sum + firm.residualProfitCents, 0), corporateTaxCents: firms.filter((firm) => firm.industryId === id).reduce((sum, firm) => sum + firm.corporateTaxCents, 0) }]))
  return { seed, horizonDays, contractualPayrollCents, meanDailyContractualPayrollCents: contractualPayrollCents / horizonDays, wagesPaidCents, unpaidWagesCents, payrollFulfillmentRate: wagesPaidCents / contractualPayrollCents, residualProfitCents, meanDailyResidualProfitCents: residualProfitCents / horizonDays, corporateTaxCents, meanDailyCorporateTaxCents: corporateTaxCents / horizonDays, wealthTaxCents, redistributionCents, corporateRedistributionShare: redistributionCents ? corporateTaxCents / redistributionCents : 0, wealthTaxRedistributionShare: redistributionCents ? wealthTaxCents / redistributionCents : 0, effectiveEqualityOccupancy: equalityDays / horizonDays, consumptionCompletionFraction: consumption / (horizonDays * state.households.length * 4), meanCashGini: cashGiniTotal / horizonDays, meanWageGini: wageGiniTotal / horizonDays, wealthTaxRatesBps, firms, byIndustry, terminalState: state }
}
