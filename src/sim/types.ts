export type Direction = 'up' | 'down'
export type PriceDecisionAction = 'increase' | 'decrease' | 'refine' | 'hold' | 'converged'

export interface SimulationConfig {
  startingPriceCents: number
  initialStepCents: number
  dailyFoodSupply: number
}

export type HouseholdPurchaseOutcome = 'purchased' | 'insufficient_funds' | 'stockout' | null

export interface Household {
  id: string
  cashCents: number
  purchasedToday: boolean
  spentTodayCents: number
  purchaseOutcomeToday: HouseholdPurchaseOutcome
  lifetimeUnitsPurchased: number
  lifetimeStockoutFailures: number
  lifetimeAffordabilityFailures: number
}

export interface Firm {
  id: 'firm-1'
  cashCents: number
  postedPriceCents: number
  unitsSoldToday: number
  revenueTodayCents: number
  preTaxProfitTodayCents: number
  availableFoodToday: number
  unitsExpiredToday: number
  soldOutToday: boolean
}

export interface Government {
  id: 'government-1'
  cashCents: number
  taxCollectedTodayCents: number
  redistributedTodayCents: number
}

export interface PricingState {
  bestPriceCents: number
  bestProfitCents: number
  stepSizeCents: number
  direction: Direction
  converged: boolean
  foundPositiveProfit: boolean
  testedLowerAtOneCent: boolean
  testedUpperAtOneCent: boolean
}

export interface PriceDecision {
  nextPriceCents: number
  reason: string
  action: PriceDecisionAction
  state: PricingState
  justConverged: boolean
}

export type SimulationEventType =
  | 'DAY_STARTED'
  | 'FOOD_SUPPLY_RECEIVED'
  | 'PRICE_POSTED'
  | 'HOUSEHOLD_PURCHASE'
  | 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS'
  | 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT'
  | 'FOOD_EXPIRED'
  | 'FIRM_DAY_RESULT'
  | 'FIRM_PRICE_DECISION'
  | 'TAX_PAID'
  | 'TRANSFER_RECEIVED'
  | 'PRICE_DISCOVERY_CONVERGED'
  | 'DAY_ENDED'

export interface SimulationEvent {
  id: number
  day: number
  type: SimulationEventType
  actorId?: string
  counterpartyId?: string
  amountCents?: number
  priceCents?: number
  quantity?: number
  description: string
}

export interface DayMetrics {
  day: number
  postedPriceCents: number
  bestKnownPriceCents: number
  priceStepSizeCents: number
  searchDirection: Direction
  unitsSold: number
  foodSupplied: number
  unitsExpired: number
  stockoutFailures: number
  affordabilityFailures: number
  soldOut: boolean
  householdsAffordableAtMarketOpen: number
  householdCashMinimumAtMarketOpenCents: number
  householdCashMedianAtMarketOpenCents: number
  householdCashMaximumAtMarketOpenCents: number
  householdCashGiniAtMarketOpen: number
  householdCashMinimumCents: number
  householdCashMedianCents: number
  householdCashMaximumCents: number
  householdCashGini: number
  revenueCents: number
  preTaxProfitCents: number
  totalHouseholdCashCents: number
  firmCashBeforeTaxCents: number
  firmCashAfterTaxCents: number
  governmentCashBeforeRedistributionCents: number
  governmentCashAfterRedistributionCents: number
  totalMoneyCents: number
  converged: boolean
}

export interface SimulationState {
  day: number
  config: SimulationConfig
  households: Household[]
  firm: Firm
  government: Government
  pricing: PricingState
  metrics: DayMetrics[]
  events: SimulationEvent[]
  latestDecisionReason: string
  latestDecisionAction: PriceDecisionAction
  nextEventId: number
}
