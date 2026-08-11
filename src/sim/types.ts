export type Direction = 'up' | 'down'
export type PriceDecisionAction = 'increase' | 'decrease' | 'refine' | 'hold' | 'converged'

export interface SimulationConfig {
  startingPriceCents: number
  initialStepCents: number
}

export interface Household {
  id: string
  cashCents: number
  purchasedToday: boolean
  spentTodayCents: number
}

export interface Firm {
  id: 'firm-1'
  cashCents: number
  postedPriceCents: number
  unitsSoldToday: number
  revenueTodayCents: number
  preTaxProfitTodayCents: number
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
  | 'PRICE_POSTED'
  | 'HOUSEHOLD_PURCHASE'
  | 'HOUSEHOLD_PURCHASE_FAILED'
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
  failedPurchases: number
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
