import type { Industry, SimulationConfig } from './types'

export const HOUSEHOLD_COUNT = 10
export const INITIAL_HOUSEHOLD_CASH_CENTS = 5_000
export const TOTAL_MONEY_CENTS = 50_000
export const MIN_PRICE_CENTS = 1
export const MAX_HISTORY = 400
export const MAX_EVENTS = 600

export const DEFAULT_INDUSTRIES: Industry[] = [
  { id: 'food', name: 'Food', householdBudgetCents: 1_500 },
  { id: 'utilities', name: 'Utilities', householdBudgetCents: 1_200 },
  { id: 'transport', name: 'Transport', householdBudgetCents: 800 },
  { id: 'healthcare', name: 'Healthcare', householdBudgetCents: 1_000 },
  { id: 'entertainment', name: 'Entertainment', householdBudgetCents: 500 },
]

export const DEFAULT_CONFIG: SimulationConfig = {
  startingPriceCents: 200,
  initialStepCents: 100,
  dailySupplyPerIndustry: 10,
}
