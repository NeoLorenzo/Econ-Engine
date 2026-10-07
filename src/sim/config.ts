import type { Industry, IndustryId, SimulationConfig } from './types'

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
export const DEFAULT_INDUSTRY_BUDGET_SHARES_BPS = {
  food: 1_290,
  utilities: 600,
  healthcare: 790,
  entertainment: 460,
} as const

export const DEFAULT_INDUSTRIES: Industry[] = [
  { id: 'food', name: 'Food', householdBudgetCents: 0, budgetShareBps: 1_290 },
  { id: 'utilities', name: 'Utilities', householdBudgetCents: 0, budgetShareBps: 600 },
  { id: 'transport', name: 'Transport', householdBudgetCents: 0 },
  { id: 'healthcare', name: 'Healthcare', householdBudgetCents: 0, budgetShareBps: 790 },
  { id: 'entertainment', name: 'Entertainment', householdBudgetCents: 0, budgetShareBps: 460 },
]

export const TRANSPORT_FIRM_ID = 'firm-transport'
/** Competing firms in each consumer industry in the canonical economy. */
export const DEFAULT_FIRMS_PER_INDUSTRY = 2
/** Transport workers in each employment block, alongside one worker per consumer firm. */
export const TRANSPORT_WORKERS_PER_BLOCK = 2
const MAX_FIRMS_PER_INDUSTRY = 26

/** `firm-food-a`, `firm-food-b`, …: a consumer firm's ID encodes its industry and its position (slot) in that market. */
export const consumerFirmId = (industryId: Exclude<IndustryId, 'transport'>, slot: number) =>
  `firm-${industryId}-${String.fromCharCode(97 + slot)}`

/** A consumer firm's 0-based position in its industry's roster, or null for Transport and unknown IDs. */
export function firmSlot(firmId: string): number | null {
  const match = /^firm-[a-z]+-([a-z])$/.exec(firmId)
  return match ? match[1]!.charCodeAt(0) - 97 : null
}

/** "A", "B", "C", … for a firm slot. */
export const firmLetter = (slot: number) => String.fromCharCode(65 + slot)

/** Firm IDs in every industry, in slot order; Transport is a single monopoly. */
export function firmRoster(firmsPerIndustry = DEFAULT_FIRMS_PER_INDUSTRY): Record<IndustryId, string[]> {
  return Object.fromEntries(
    DEFAULT_INDUSTRIES.map(({ id }) => [
      id,
      id === 'transport'
        ? [TRANSPORT_FIRM_ID]
        : Array.from({ length: firmsPerIndustry }, (_, slot) => consumerFirmId(id, slot)),
    ]),
  ) as Record<IndustryId, string[]>
}

export const DEFAULT_FIRM_IDS_BY_INDUSTRY = firmRoster()

/** Every consumer firm in processing order of the default industry list. */
export const consumerFirmIds = (roster: Record<IndustryId, string[]>) =>
  DEFAULT_INDUSTRIES.filter(({ id }) => id !== 'transport').flatMap(({ id }) => roster[id])

/** Households per employment block: one worker for each consumer firm and two for Transport (10 in the canonical economy). */
export const employmentBlockSize = (firmsPerIndustry = DEFAULT_FIRMS_PER_INDUSTRY) =>
  consumerFirmIds(firmRoster(firmsPerIndustry)).length + TRANSPORT_WORKERS_PER_BLOCK

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

/** Rejects an impossible market structure, population or grid before any agents are built, naming the offending field. */
export function validatePopulationConfig({
  householdCount,
  gridWidth,
  gridHeight,
  firmsPerIndustry,
}: {
  householdCount: number
  gridWidth: number
  gridHeight: number
  firmsPerIndustry: number
}) {
  if (!Number.isInteger(firmsPerIndustry) || firmsPerIndustry < 1 || firmsPerIndustry > MAX_FIRMS_PER_INDUSTRY)
    throw new Error(
      `firmsPerIndustry must be a whole number from 1 to ${MAX_FIRMS_PER_INDUSTRY}; received ${firmsPerIndustry}`,
    )
  const blockSize = employmentBlockSize(firmsPerIndustry)
  if (!Number.isInteger(householdCount) || householdCount < blockSize || householdCount % blockSize !== 0) {
    throw new Error(
      `householdCount must be a whole multiple of ${blockSize} (complete employment blocks) and at least ${blockSize}; received ${householdCount}`,
    )
  }
  for (const [field, value] of [
    ['gridWidth', gridWidth],
    ['gridHeight', gridHeight],
  ] as const) {
    if (!Number.isInteger(value) || value < 1)
      throw new Error(`${field} must be a whole number of at least 1; received ${value}`)
  }
  const consumerFirmCount = consumerFirmIds(firmRoster(firmsPerIndustry)).length
  if (gridWidth * gridHeight < householdCount + consumerFirmCount) {
    throw new Error(
      `gridWidth × gridHeight is ${gridWidth} × ${gridHeight} = ${gridWidth * gridHeight} cells, too few for ${householdCount} households and ${consumerFirmCount} consumer firms on unique cells`,
    )
  }
}

export const deriveIndustryBudgetCents = (dailyExpenditureBudgetCents: number, shareBps: number) =>
  Math.round((dailyExpenditureBudgetCents * shareBps) / 10_000)
