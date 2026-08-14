import { DEFAULT_SEED } from './config'
import { createSimulation, runDays } from './engine'

export interface SpatialCompetitionResult {
  seed: number
  coordinates: Record<string, { x: number; y: number }>
  firmAIncumbentCents: number
  firmBIncumbentCents: number
  firmAFinalShare: number
  firmBFinalShare: number
  firmAAverageDistance: number
  firmBAverageDistance: number
  finalTransportRevenueCents: number
  averageDailyTransportRevenueCents: number
  priceTrajectories: Record<string, number[]>
}

export function runSpatialCompetitionExperiment(seeds: number[] = [DEFAULT_SEED, 7, 42, 99], days = 300): SpatialCompetitionResult[] {
  return seeds.map((seed) => {
    const state = runDays(createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed }), days)
    const entertainment = state.firms.filter((firm) => firm.industryId === 'entertainment')
    const latest = state.metrics.at(-1)!
    const a = latest.markets.find((market) => market.firmId === entertainment[0].id)!
    const b = latest.markets.find((market) => market.firmId === entertainment[1].id)!
    return {
      seed,
      coordinates: Object.fromEntries([...state.households, ...entertainment].map((entity) => [entity.id, entity.coordinate!])),
      firmAIncumbentCents: entertainment[0].pricing.incumbentPriceCents,
      firmBIncumbentCents: entertainment[1].pricing.incumbentPriceCents,
      firmAFinalShare: a.marketShare, firmBFinalShare: b.marketShare,
      firmAAverageDistance: a.averageCustomerDistance, firmBAverageDistance: b.averageCustomerDistance,
      finalTransportRevenueCents: latest.totalTransportRevenueCents,
      averageDailyTransportRevenueCents: state.metrics.reduce((sum, metric) => sum + metric.totalTransportRevenueCents, 0) / state.metrics.length,
      priceTrajectories: Object.fromEntries(entertainment.map((firm) => [firm.id, state.metrics.map((metric) => metric.markets.find((market) => market.firmId === firm.id)!.postedPriceCents)])),
    }
  })
}
