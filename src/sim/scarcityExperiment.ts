import { summarizeCashDistribution } from './analytics'
import { createSimulation, stepSimulation } from './engine'
import type { IndustryId } from './types'

export const MULTI_INDUSTRY_STARTING_PRICES_CENTS: Record<IndustryId, number> = {
  food: 100,
  utilities: 200,
  transport: 500,
  healthcare: 1_500,
  entertainment: 2_000,
}
export const MULTI_INDUSTRY_EXPERIMENT_HORIZON_DAYS = 300

export interface MultiIndustryExperimentOptions {
  startingPricesCents?: Partial<Record<IndustryId, number>>
  initialStepCents?: number
  dailySupplyPerIndustry?: number
  horizonDays?: number
}

export interface FirmExperimentResult {
  industryId: IndustryId
  firmId: string
  startingPriceCents: number
  convergedPriceCents: number | null
  daysToConvergence: number | null
}

export interface MultiIndustryExperimentResult {
  initialStepCents: number
  dailySupplyPerIndustry: number
  horizonDays: number
  daysRun: number
  firms: FirmExperimentResult[]
  finalHouseholdCashMinimumCents: number
  finalHouseholdCashMedianCents: number
  finalHouseholdCashMaximumCents: number
  finalHouseholdCashGini: number
  totalMoneyCents: number
}

export function runMultiIndustryExperiment(options: MultiIndustryExperimentOptions = {}): MultiIndustryExperimentResult {
  const initialStepCents = Math.max(1, Math.round(options.initialStepCents ?? 100))
  const dailySupplyPerIndustry = Math.max(0, Math.round(options.dailySupplyPerIndustry ?? 10))
  const horizonDays = Math.max(0, Math.round(options.horizonDays ?? MULTI_INDUSTRY_EXPERIMENT_HORIZON_DAYS))
  const startingPrices = { ...MULTI_INDUSTRY_STARTING_PRICES_CENTS, ...options.startingPricesCents }
  let state = createSimulation({ startingPriceCents: 200, initialStepCents, dailySupplyPerIndustry, industryStartingPricesCents: startingPrices })
  const convergenceDays = new Map<IndustryId, number>()
  while (!state.firms.every((firm) => firm.pricing.converged) && state.day < horizonDays) {
    state = stepSimulation(state)
    state.firms.forEach((firm) => { if (firm.pricing.converged && !convergenceDays.has(firm.industryId)) convergenceDays.set(firm.industryId, state.day) })
  }
  const distribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  return {
    initialStepCents, dailySupplyPerIndustry, horizonDays, daysRun: state.day,
    firms: state.firms.map((firm) => ({
      industryId: firm.industryId, firmId: firm.id, startingPriceCents: startingPrices[firm.industryId],
      convergedPriceCents: firm.pricing.converged ? firm.pricing.bestPriceCents : null,
      daysToConvergence: convergenceDays.get(firm.industryId) ?? null,
    })),
    finalHouseholdCashMinimumCents: distribution.minimumCents, finalHouseholdCashMedianCents: distribution.medianCents,
    finalHouseholdCashMaximumCents: distribution.maximumCents, finalHouseholdCashGini: distribution.gini,
    totalMoneyCents: state.metrics.at(-1)?.totalMoneyCents ?? state.households.reduce((sum, household) => sum + household.cashCents, 0),
  }
}
