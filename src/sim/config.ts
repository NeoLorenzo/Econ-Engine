import type { Industry, SimulationConfig } from './types'

export const HOUSEHOLD_COUNT = 10
export const INITIAL_HOUSEHOLD_CASH_CENTS = 5_000
export const TOTAL_MONEY_CENTS = 50_000
export const MIN_PRICE_CENTS = 1
export const MAX_HISTORY = 400
export const MAX_EVENTS = 600
export const DEFAULT_SEED = 2_026_0813
export const DEFAULT_PROBE_PROBABILITY = 0.1
export const DEFAULT_GOVERNMENT_EXPERIMENT_PROBABILITY = 0.1
export const DEFAULT_GRID_WIDTH = 20
export const DEFAULT_GRID_HEIGHT = 20
export const DEFAULT_TRANSPORT_COST_PER_TILE_CENTS = 2
export const DEFAULT_DAILY_EXPENDITURE_BUDGET_CENTS = 5_000
export const DEFAULT_LABOR_PRODUCTIVITY = 5
export const DEFAULT_INDUSTRY_BUDGET_SHARES_BPS = { food: 1_290, utilities: 600, healthcare: 790, entertainment: 460 } as const

export const DEFAULT_INDUSTRIES: Industry[] = [
  { id: 'food', name: 'Food', householdBudgetCents: 0, budgetShareBps: 1_290 },
  { id: 'utilities', name: 'Utilities', householdBudgetCents: 0, budgetShareBps: 600 },
  { id: 'transport', name: 'Transport', householdBudgetCents: 0 },
  { id: 'healthcare', name: 'Healthcare', householdBudgetCents: 0, budgetShareBps: 790 },
  { id: 'entertainment', name: 'Entertainment', householdBudgetCents: 0, budgetShareBps: 460 },
]

export const DEFAULT_FIRM_IDS_BY_INDUSTRY: Record<Industry['id'], string[]> = {
  food: ['firm-food-a', 'firm-food-b'],
  utilities: ['firm-utilities-a', 'firm-utilities-b'],
  transport: ['firm-transport'],
  healthcare: ['firm-healthcare-a', 'firm-healthcare-b'],
  entertainment: ['firm-entertainment-a', 'firm-entertainment-b'],
}

export const DEFAULT_CONFIG: SimulationConfig = {
  startingPriceCents: 200,
  initialStepCents: 100,
  laborProductivityUnitsPerWorker: DEFAULT_LABOR_PRODUCTIVITY,
  firmTaxRateBps: 0,
  householdParityEnabled: false,
  adaptiveGovernmentEnabled: true,
  governmentExperimentProbability: DEFAULT_GOVERNMENT_EXPERIMENT_PROBABILITY,
  seed: DEFAULT_SEED,
  probeProbability: DEFAULT_PROBE_PROBABILITY,
  gridWidth: DEFAULT_GRID_WIDTH,
  gridHeight: DEFAULT_GRID_HEIGHT,
  transportCostPerTileCents: DEFAULT_TRANSPORT_COST_PER_TILE_CENTS,
  targetHouseholdCashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
  dailyExpenditureBudgetCents: DEFAULT_DAILY_EXPENDITURE_BUDGET_CENTS,
  industryBudgetSharesBps: DEFAULT_INDUSTRY_BUDGET_SHARES_BPS,
}

export const deriveIndustryBudgetCents = (dailyExpenditureBudgetCents: number, shareBps: number) => Math.round(dailyExpenditureBudgetCents * shareBps / 10_000)
