import type { Industry, SimulationConfig } from './types'

export const HOUSEHOLD_COUNT = 100
export const INITIAL_HOUSEHOLD_CASH_CENTS = 5_000
export const TOTAL_MONEY_CENTS = HOUSEHOLD_COUNT * INITIAL_HOUSEHOLD_CASH_CENTS
export const expectedTotalMoneyCents = (householdCount: number) => householdCount * INITIAL_HOUSEHOLD_CASH_CENTS
export const MIN_PRICE_CENTS = 1
export const MAX_HISTORY = 400
export const MAX_EVENTS = 1_600
export const DEFAULT_SEED = 2_026_0813
export const DEFAULT_PROBE_PROBABILITY = 0.1
export const DEFAULT_GOVERNMENT_EXPERIMENT_PROBABILITY = 0.1
export const DEFAULT_GRID_WIDTH = 20
export const DEFAULT_GRID_HEIGHT = 20
export const DEFAULT_TRANSPORT_COST_PER_TILE_CENTS = 2
export const DEFAULT_DAILY_EXPENDITURE_BUDGET_CENTS = 5_000
export const DEFAULT_LABOR_PRODUCTIVITY = 5
export const CONTRACTUAL_WAGE_CENTS = 1_000
export const CORPORATE_PROFIT_TAX_RATE_BPS = 10_000
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
  householdCount: HOUSEHOLD_COUNT,
  startingPriceCents: 200,
  initialStepCents: 100,
  laborProductivityUnitsPerWorker: DEFAULT_LABOR_PRODUCTIVITY,
  adaptiveGovernmentEnabled: true,
  governmentExperimentProbability: DEFAULT_GOVERNMENT_EXPERIMENT_PROBABILITY,
  seed: DEFAULT_SEED,
  probeProbability: DEFAULT_PROBE_PROBABILITY,
  gridWidth: DEFAULT_GRID_WIDTH,
  gridHeight: DEFAULT_GRID_HEIGHT,
  transportCostPerTileCents: DEFAULT_TRANSPORT_COST_PER_TILE_CENTS,
  dailyExpenditureBudgetCents: DEFAULT_DAILY_EXPENDITURE_BUDGET_CENTS,
  industryBudgetSharesBps: DEFAULT_INDUSTRY_BUDGET_SHARES_BPS,
}

/** Households per employment block: one worker for each of the eight consumer firms and two for Transport. */
export const EMPLOYMENT_BLOCK_SIZE = 10

/** Rejects an impossible population or grid before any agents are built, naming the offending field. */
export function validatePopulationConfig({ householdCount, gridWidth, gridHeight }: { householdCount: number; gridWidth: number; gridHeight: number }) {
  if (!Number.isInteger(householdCount) || householdCount < EMPLOYMENT_BLOCK_SIZE || householdCount % EMPLOYMENT_BLOCK_SIZE !== 0) {
    throw new Error(`householdCount must be a whole multiple of ${EMPLOYMENT_BLOCK_SIZE} (complete employment blocks) and at least ${EMPLOYMENT_BLOCK_SIZE}; received ${householdCount}`)
  }
  for (const [field, value] of [['gridWidth', gridWidth], ['gridHeight', gridHeight]] as const) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a whole number of at least 1; received ${value}`)
  }
  const consumerFirmCount = DEFAULT_INDUSTRIES.filter(({ id }) => id !== 'transport').reduce((sum, { id }) => sum + DEFAULT_FIRM_IDS_BY_INDUSTRY[id].length, 0)
  if (gridWidth * gridHeight < householdCount + consumerFirmCount) {
    throw new Error(`gridWidth × gridHeight is ${gridWidth} × ${gridHeight} = ${gridWidth * gridHeight} cells, too few for ${householdCount} households and ${consumerFirmCount} consumer firms on unique cells`)
  }
}

export const deriveIndustryBudgetCents = (dailyExpenditureBudgetCents: number, shareBps: number) => Math.round(dailyExpenditureBudgetCents * shareBps / 10_000)
