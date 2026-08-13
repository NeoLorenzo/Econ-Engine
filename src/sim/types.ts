export type Direction = 'up' | 'down'
export type PriceDecisionAction = 'increase' | 'decrease' | 'refine' | 'hold' | 'converged'

export type IndustryId = 'food' | 'utilities' | 'transport' | 'healthcare' | 'entertainment'

export interface Industry {
  id: IndustryId
  name: string
  householdBudgetCents: number
}

export interface SimulationConfig {
  startingPriceCents: number
  initialStepCents: number
  dailySupplyPerIndustry: number
  industryStartingPricesCents?: Partial<Record<IndustryId, number>>
  industryProcessingOrder?: IndustryId[]
}

export type HouseholdPurchaseOutcome = 'purchased' | 'insufficient_funds' | 'stockout' | null

export interface HouseholdIndustryOutcome {
  budgetCents: number
  purchasedToday: boolean
  spentTodayCents: number
  purchaseOutcomeToday: HouseholdPurchaseOutcome
  lifetimeUnitsPurchased: number
  lifetimeStockoutFailures: number
  lifetimeAffordabilityFailures: number
}

export interface Household {
  id: string
  cashCents: number
  industryOutcomes: Record<IndustryId, HouseholdIndustryOutcome>
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

export interface Firm {
  id: string
  industryId: IndustryId
  cashCents: number
  postedPriceCents: number
  unitsSoldToday: number
  revenueTodayCents: number
  preTaxProfitTodayCents: number
  availableUnitsToday: number
  unitsExpiredToday: number
  soldOutToday: boolean
  pricing: PricingState
  latestDecisionReason: string
  latestDecisionAction: PriceDecisionAction
}

export interface Government {
  id: 'government-1'
  cashCents: number
  taxCollectedTodayCents: number
  redistributedTodayCents: number
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
  | 'SUPPLY_RECEIVED'
  | 'PRICE_POSTED'
  | 'HOUSEHOLD_PURCHASE'
  | 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS'
  | 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT'
  | 'GOODS_EXPIRED'
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
  industryId?: IndustryId
  firmId?: string
  householdId?: string
  amountCents?: number
  priceCents?: number
  quantity?: number
  description: string
}

export interface MarketMetrics {
  industryId: IndustryId
  firmId: string
  postedPriceCents: number
  nextPriceCents: number
  bestKnownPriceCents: number
  priceStepSizeCents: number
  searchDirection: Direction
  unitsSold: number
  unitsSupplied: number
  unitsExpired: number
  stockoutFailures: number
  affordabilityFailures: number
  soldOut: boolean
  householdsAffordableAtMarketOpen: number
  revenueCents: number
  preTaxProfitCents: number
  converged: boolean
}

export interface DayMetrics {
  day: number
  markets: MarketMetrics[]
  householdCashMinimumAtMarketOpenCents: number
  householdCashMedianAtMarketOpenCents: number
  householdCashMaximumAtMarketOpenCents: number
  householdCashGiniAtMarketOpen: number
  householdCashMinimumCents: number
  householdCashMedianCents: number
  householdCashMaximumCents: number
  householdCashGini: number
  totalRevenueCents: number
  totalPreTaxProfitCents: number
  totalHouseholdCashCents: number
  totalFirmCashBeforeTaxCents: number
  totalFirmCashAfterTaxCents: number
  governmentCashBeforeRedistributionCents: number
  governmentCashAfterRedistributionCents: number
  totalMoneyCents: number
  allFirmsConverged: boolean
}

export interface SimulationState {
  day: number
  config: SimulationConfig
  industries: Industry[]
  households: Household[]
  firms: Firm[]
  government: Government
  metrics: DayMetrics[]
  events: SimulationEvent[]
  nextEventId: number
}
