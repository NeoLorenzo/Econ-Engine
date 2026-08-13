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
export const ENTERTAINMENT_COMPETITOR_STARTS_CENTS = {
  'firm-entertainment-a': 100,
  'firm-entertainment-b': 800,
} as const
export const MULTI_INDUSTRY_EXPERIMENT_HORIZON_DAYS = 300
export const EXPECTED_INDUSTRY_OPTIMA_CENTS: Record<IndustryId, number> = {
  food: 1_500,
  utilities: 1_200,
  transport: 800,
  healthcare: 1_000,
  entertainment: 500,
}

export interface MultiIndustryExperimentOptions {
  startingPricesCents?: Partial<Record<IndustryId, number>>
  initialStepCents?: number
  dailySupplyPerIndustry?: number
  horizonDays?: number
  seed?: number
}

export interface FirmExperimentResult {
  industryId: IndustryId
  firmId: string
  startingPriceCents: number
  convergedPriceCents: number | null
  daysToConvergence: number | null
  finalPriceCents: number
  finalUnitsSold: number
  finalProfitCents: number
  finalMarketShare: number
  finalPricingState: import('./types').PricingState
}

export interface CompetitionHistoryPoint {
  day: number
  firmId: string
  testedPriceCents: number
  nextPriceCents: number
  unitsSold: number
  profitCents: number
  marketShare: number
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
  competitionHistory: CompetitionHistoryPoint[]
}

export function runMultiIndustryExperiment(options: MultiIndustryExperimentOptions = {}): MultiIndustryExperimentResult {
  const initialStepCents = Math.max(1, Math.round(options.initialStepCents ?? 100))
  const dailySupplyPerIndustry = Math.max(0, Math.round(options.dailySupplyPerIndustry ?? 10))
  const horizonDays = Math.max(0, Math.round(options.horizonDays ?? MULTI_INDUSTRY_EXPERIMENT_HORIZON_DAYS))
  const startingPrices = { ...MULTI_INDUSTRY_STARTING_PRICES_CENTS, ...options.startingPricesCents }
  let state = createSimulation({ startingPriceCents: 200, initialStepCents, dailySupplyPerIndustry, industryStartingPricesCents: startingPrices, firmStartingPricesCents: ENTERTAINMENT_COMPETITOR_STARTS_CENTS, seed: options.seed })
  const convergenceDays = new Map<string, number>()
  while (state.day < horizonDays) {
    state = stepSimulation(state)
    state.firms.forEach((firm) => { if (firm.pricing.converged && !convergenceDays.has(firm.id)) convergenceDays.set(firm.id, state.day) })
  }
  const distribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  return {
    initialStepCents, dailySupplyPerIndustry, horizonDays, daysRun: state.day,
    firms: state.firms.map((firm) => ({
      industryId: firm.industryId, firmId: firm.id, startingPriceCents: ENTERTAINMENT_COMPETITOR_STARTS_CENTS[firm.id as keyof typeof ENTERTAINMENT_COMPETITOR_STARTS_CENTS] ?? startingPrices[firm.industryId],
      convergedPriceCents: firm.pricing.locallySettled ? firm.pricing.incumbentPriceCents : null,
      daysToConvergence: convergenceDays.get(firm.id) ?? null,
      finalPriceCents: firm.postedPriceCents,
      finalUnitsSold: firm.unitsSoldToday,
      finalProfitCents: firm.preTaxProfitTodayCents,
      finalMarketShare: state.metrics.at(-1)?.markets.find((market) => market.firmId === firm.id)?.marketShare ?? 0,
      finalPricingState: structuredClone(firm.pricing),
    })),
    finalHouseholdCashMinimumCents: distribution.minimumCents, finalHouseholdCashMedianCents: distribution.medianCents,
    finalHouseholdCashMaximumCents: distribution.maximumCents, finalHouseholdCashGini: distribution.gini,
    totalMoneyCents: state.metrics.at(-1)?.totalMoneyCents ?? state.households.reduce((sum, household) => sum + household.cashCents, 0),
    competitionHistory: state.metrics.flatMap((metric) => metric.markets.filter(({ industryId }) => industryId === 'entertainment').map((market) => ({
      day: metric.day, firmId: market.firmId, testedPriceCents: market.postedPriceCents, nextPriceCents: market.nextPriceCents,
      unitsSold: market.unitsSold, profitCents: market.preTaxProfitCents, marketShare: market.marketShare,
    }))),
  }
}
