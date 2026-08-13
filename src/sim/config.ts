import type { SimulationConfig } from './types'

export const HOUSEHOLD_COUNT = 10
export const INITIAL_HOUSEHOLD_CASH_CENTS = 1_000
export const TOTAL_MONEY_CENTS = 10_000
export const MIN_PRICE_CENTS = 1
export const MAX_HISTORY = 400
export const MAX_EVENTS = 160

export const DEFAULT_CONFIG: SimulationConfig = {
  startingPriceCents: 200,
  initialStepCents: 100,
  dailyFoodSupply: 10,
}
