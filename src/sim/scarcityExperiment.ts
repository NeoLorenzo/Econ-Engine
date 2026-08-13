import { summarizeCashDistribution } from './analytics'
import { createSimulation, stepSimulation } from './engine'

export const SCARCITY_EXPERIMENT_STARTING_PRICES_CENTS = [100, 200, 400, 600, 800, 900, 950, 1_000, 1_100, 1_500, 2_000] as const
export const SCARCITY_EXPERIMENT_HORIZON_DAYS = 300

export interface ScarcityExperimentOptions {
  startingPricesCents?: readonly number[]
  initialStepCents?: number
  dailyFoodSupply?: number
  horizonDays?: number
}

export interface StartingPriceExperimentResult {
  startingPriceCents: number
  convergedPriceCents: number | null
  daysToConvergence: number | null
  finalHouseholdCashMinimumCents: number
  finalHouseholdCashMedianCents: number
  finalHouseholdCashMaximumCents: number
  finalHouseholdCashGini: number
  householdsAffordableAtFinalPrice: number
  cumulativeFoodConsumptionByHousehold: number[]
  cumulativeStockoutFailuresByHousehold: number[]
  cumulativeAffordabilityFailuresByHousehold: number[]
}

export interface ScarcityExperimentSuite {
  initialStepCents: number
  dailyFoodSupply: number
  horizonDays: number
  results: StartingPriceExperimentResult[]
}

export function runStartingPriceExperiments(options: ScarcityExperimentOptions = {}): ScarcityExperimentSuite {
  const startingPricesCents = options.startingPricesCents ?? SCARCITY_EXPERIMENT_STARTING_PRICES_CENTS
  const initialStepCents = Math.max(1, Math.round(options.initialStepCents ?? 100))
  const dailyFoodSupply = Math.max(0, Math.round(options.dailyFoodSupply ?? 10))
  const horizonDays = Math.max(0, Math.round(options.horizonDays ?? SCARCITY_EXPERIMENT_HORIZON_DAYS))

  const results = startingPricesCents.map((startingPriceCents): StartingPriceExperimentResult => {
    let state = createSimulation({ startingPriceCents, initialStepCents, dailyFoodSupply })
    while (!state.pricing.converged && state.day < horizonDays) state = stepSimulation(state)

    const distribution = summarizeCashDistribution(state.households.map((household) => household.cashCents))
    return {
      startingPriceCents,
      convergedPriceCents: state.pricing.converged ? state.pricing.bestPriceCents : null,
      daysToConvergence: state.pricing.converged ? state.day : null,
      finalHouseholdCashMinimumCents: distribution.minimumCents,
      finalHouseholdCashMedianCents: distribution.medianCents,
      finalHouseholdCashMaximumCents: distribution.maximumCents,
      finalHouseholdCashGini: distribution.gini,
      householdsAffordableAtFinalPrice: state.households.filter((household) => household.cashCents >= state.firm.postedPriceCents).length,
      cumulativeFoodConsumptionByHousehold: state.households.map((household) => household.lifetimeUnitsPurchased),
      cumulativeStockoutFailuresByHousehold: state.households.map((household) => household.lifetimeStockoutFailures),
      cumulativeAffordabilityFailuresByHousehold: state.households.map((household) => household.lifetimeAffordabilityFailures),
    }
  })

  return { initialStepCents, dailyFoodSupply, horizonDays, results }
}
