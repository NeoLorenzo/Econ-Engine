import { createSimulation, stepSimulation } from './engine'
import type { IndustryId, PricingState } from './types'

export const COMPETITION_GRID_STARTS_CENTS = [100, 200, 300, 400, 500, 600, 800, 1_000] as const
export const COMPETITION_GRID_HORIZON_DAYS = 300

const CONTROL_STARTS_CENTS: Partial<Record<IndustryId, number>> = {
  food: 100,
  utilities: 200,
  transport: 500,
  healthcare: 1_500,
}

export interface CompetitionGridOptions {
  startingPricesCents?: readonly number[]
  horizonDays?: number
  seed?: number
}

export interface CompetitionGridResult {
  firmAStartCents: number
  firmBStartCents: number
  firmAEndpointCents: number | null
  firmBEndpointCents: number | null
  firmAConvergenceDay: number | null
  firmBConvergenceDay: number | null
  bothConverged: boolean
  finalMarketShares: [number, number]
  finalDailyProfitsCents: [number, number]
  finalPricingStates: [PricingState, PricingState]
  controlEndpointsCents: Record<'food' | 'utilities' | 'transport' | 'healthcare', number | null>
}

export interface CompetitionGridSuite {
  startingPricesCents: number[]
  horizonDays: number
  results: CompetitionGridResult[]
}

export function runCompetitionStartingPriceGrid(options: CompetitionGridOptions = {}): CompetitionGridSuite {
  const startingPricesCents = [...(options.startingPricesCents ?? COMPETITION_GRID_STARTS_CENTS)].map((value) => Math.max(1, Math.round(value)))
  const horizonDays = Math.max(0, Math.round(options.horizonDays ?? COMPETITION_GRID_HORIZON_DAYS))
  const results: CompetitionGridResult[] = []

  for (const firmAStartCents of startingPricesCents) for (const firmBStartCents of startingPricesCents) {
    let state = createSimulation({
      startingPriceCents: 200,
      initialStepCents: 100,
      dailySupplyPerIndustry: 10,
      industryStartingPricesCents: CONTROL_STARTS_CENTS,
      firmStartingPricesCents: { 'firm-entertainment-a': firmAStartCents, 'firm-entertainment-b': firmBStartCents },
      seed: options.seed,
    })
    const convergenceDays = new Map<string, number>()
    while (state.day < horizonDays) {
      state = stepSimulation(state)
      state.firms.forEach((firm) => { if (firm.pricing.converged && !convergenceDays.has(firm.id)) convergenceDays.set(firm.id, state.day) })
    }
    const entertainment = state.firms.filter(({ industryId }) => industryId === 'entertainment')
    const latestMarkets = state.metrics.at(-1)?.markets ?? []
    const controlEndpoint = (industryId: 'food' | 'utilities' | 'transport' | 'healthcare') => {
      const firm = state.firms.find((candidate) => candidate.industryId === industryId)!
      return firm.pricing.locallySettled ? firm.pricing.incumbentPriceCents : null
    }
    results.push({
      firmAStartCents, firmBStartCents,
      firmAEndpointCents: entertainment[0].pricing.locallySettled ? entertainment[0].pricing.incumbentPriceCents : null,
      firmBEndpointCents: entertainment[1].pricing.locallySettled ? entertainment[1].pricing.incumbentPriceCents : null,
      firmAConvergenceDay: convergenceDays.get(entertainment[0].id) ?? null,
      firmBConvergenceDay: convergenceDays.get(entertainment[1].id) ?? null,
      bothConverged: entertainment.every((firm) => firm.pricing.locallySettled),
      finalMarketShares: entertainment.map((firm) => latestMarkets.find((market) => market.firmId === firm.id)?.marketShare ?? 0) as [number, number],
      finalDailyProfitsCents: entertainment.map((firm) => firm.preTaxProfitTodayCents) as [number, number],
      finalPricingStates: entertainment.map((firm) => structuredClone(firm.pricing)) as [PricingState, PricingState],
      controlEndpointsCents: { food: controlEndpoint('food'), utilities: controlEndpoint('utilities'), transport: controlEndpoint('transport'), healthcare: controlEndpoint('healthcare') },
    })
  }
  return { startingPricesCents, horizonDays, results }
}
