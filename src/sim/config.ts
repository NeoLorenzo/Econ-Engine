import type { Industry, SimulationConfig } from './types'

export const HOUSEHOLD_COUNT = 10
export const INITIAL_HOUSEHOLD_CASH_CENTS = 5_000
export const INDUSTRY_BUDGET_CENTS = 1_000
export const TOTAL_MONEY_CENTS = 50_000
export const MIN_PRICE_CENTS = 1
export const MAX_HISTORY = 400
export const MAX_EVENTS = 600

export const DEFAULT_INDUSTRIES: Industry[] = [
  { id: 'food', name: 'Food' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'transport', name: 'Transport' },
  { id: 'healthcare', name: 'Healthcare' },
  { id: 'entertainment', name: 'Entertainment' },
]

export const DEFAULT_CONFIG: SimulationConfig = {
  startingPriceCents: 200,
  initialStepCents: 100,
  dailySupplyPerIndustry: 10,
}
