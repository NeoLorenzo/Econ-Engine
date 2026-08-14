import { DEFAULT_SEED } from './config'
import { createSimulation, stepSimulation } from './engine'

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
  experimentCategories: string[]
  experimentsStarted: number
  experimentsAdopted: number
  experimentsRejected: number
}

export function runSpatialCompetitionExperiment(seeds: number[] = [DEFAULT_SEED, 7, 42, 99], days = 300, startingPricesCents?: [number, number]): SpatialCompetitionResult[] {
  return seeds.map((seed) => {
    let state = createSimulation({ startingPriceCents: 200, initialStepCents: 100, dailySupplyPerIndustry: 10, seed,
      firmStartingPricesCents: startingPricesCents ? { 'firm-entertainment-a': startingPricesCents[0], 'firm-entertainment-b': startingPricesCents[1] } : undefined })
    const experimentEvents: typeof state.events = []
    for (let day = 0; day < days; day += 1) {
      state = stepSimulation(state)
      experimentEvents.push(...state.events.filter((event) => event.day === state.day && event.type.startsWith('PRICE_EXPERIMENT_')))
    }
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
      experimentCategories: [...new Set(experimentEvents.filter(({ type, industryId }) => type === 'PRICE_EXPERIMENT_STARTED' && industryId === 'entertainment').map(({ experimentType }) => experimentType!).filter(Boolean))],
      experimentsStarted: experimentEvents.filter(({ type, industryId }) => type === 'PRICE_EXPERIMENT_STARTED' && industryId === 'entertainment').length,
      experimentsAdopted: experimentEvents.filter(({ type, industryId }) => type === 'PRICE_EXPERIMENT_ADOPTED' && industryId === 'entertainment').length,
      experimentsRejected: experimentEvents.filter(({ type, industryId }) => type === 'PRICE_EXPERIMENT_REJECTED' && industryId === 'entertainment').length,
    }
  })
}
