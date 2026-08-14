export type Direction = 'up' | 'down'
export type PriceDecisionAction = 'increase' | 'decrease' | 'refine' | 'hold' | 'locally_settled' | 'probe_started' | 'probe_adopted' | 'probe_rejected'
export type PriceExperimentType =
  | 'local_up_1c' | 'local_down_1c' | 'local_up_5pct' | 'local_down_5pct'
  | 'local_up_10pct' | 'local_down_10pct' | 'local_down_20pct'
  | 'competitor_match' | 'competitor_up_1c' | 'competitor_down_1c'
  | 'competitor_up_5pct' | 'competitor_down_5pct'

export type IndustryId = 'food' | 'utilities' | 'transport' | 'healthcare' | 'entertainment'

export interface Industry {
  id: IndustryId
  name: string
  householdBudgetCents: number
  budgetShareBps?: number
}

export interface SimulationConfig {
  startingPriceCents: number
  initialStepCents: number
  /** @deprecated MVP5 production is derived from employment. Accepted only for legacy callers. */
  dailySupplyPerIndustry?: number
  laborProductivityUnitsPerWorker?: number
  firmTaxRateBps?: number
  householdParityEnabled?: boolean
  adaptiveGovernmentEnabled?: boolean
  governmentExperimentProbability?: number
  industryStartingPricesCents?: Partial<Record<IndustryId, number>>
  firmStartingPricesCents?: Record<string, number>
  industryProcessingOrder?: IndustryId[]
  seed?: number
  probeProbability?: number
  gridWidth?: number
  gridHeight?: number
  transportCostPerTileCents?: number
  targetHouseholdCashCents?: number
  dailyExpenditureBudgetCents?: number
  industryBudgetSharesBps?: Partial<Record<Exclude<IndustryId, 'transport'>, number>>
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
  coordinate: Coordinate
  entertainmentToday: HouseholdEntertainmentMetrics | null
  spatialPurchasesToday: Partial<Record<Exclude<IndustryId, 'transport'>, HouseholdEntertainmentMetrics>>
  employerFirmId: string
  wageTodayCents: number
  contractualWageTodayCents: number
  unpaidWageTodayCents: number
  cumulativeWagesCents: number
  spendingTodayCents: number
  netCashChangeTodayCents: number
  preTaxCashCents: number
  taxPaidTodayCents: number
  transferReceivedTodayCents: number
  netFiscalTransferTodayCents: number
  postFiscalCashCents: number
  cumulativeTaxPaidCents: number
  cumulativeTransfersReceivedCents: number
  cumulativeNetFiscalPositionCents: number
}

export interface Coordinate { x: number; y: number }
export interface HouseholdEntertainmentMetrics {
  chosenFirmId: string | null
  distanceToA: number
  distanceToB: number
  chosenOneWayDistance: number | null
  roundTripTiles: number
  productPriceCents: number
  transportFeeCents: number
  deliveredCostCents: number
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
  incumbentPriceCents: number
  incumbentProfitCents: number
  locallySettled: boolean
  probing: boolean
  probeDirection: Direction | null
  experimentType: PriceExperimentType | null
  experimentPriceCents: number | null
  competitorPriceObservedCents: number | null
  lastExperimentOutcome: 'adopted' | 'rejected' | null
  lastExperimentalProfitCents: number | null
  lastReferenceProfitCents: number | null
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
  coordinate?: Coordinate
  employeeIds: string[]
  productivityPerWorker: number | null
  unitsProducedToday: number
  wagePoolTodayCents: number
  contractualWageCents: number
  contractualPayrollTodayCents: number
  wagesPaidTodayCents: number
  unpaidWagesTodayCents: number
  payrollFulfillmentRate: number
  residualProfitTodayCents: number
  corporateProfitTaxTodayCents: number
  meanWageTodayCents: number
}

export interface Government {
  id: 'government-1'
  cashCents: number
  taxCollectedTodayCents: number
  corporateTaxCollectedTodayCents: number
  wealthTaxCollectedTodayCents: number
  totalReceiptsTodayCents: number
  redistributedTodayCents: number
  incumbentWealthTaxRateBps: number
  appliedWealthTaxRateBps: number
  policyStatus: 'incumbent' | 'experiment'
  incumbentReferenceGini: number | null
  experimentRateBps: number | null
  experimentType: GovernmentExperimentType | null
  lastExperimentOutcome: 'adopted' | 'rejected' | null
  lastReferenceGini: number | null
  lastExperimentalGini: number | null
  preFiscalCashGini: number
  postFiscalCashGini: number
  giniReduction: number
  householdsPayingTax: number
  householdsReceivingTransfers: number
  meanTransferCents: number
  maximumTransferCents: number
  policyMode: GovernmentPolicyMode
  effectiveEquality: boolean
  postFiscalCashMinimumCents: number
  postFiscalCashMaximumCents: number
}

export type GovernmentPolicyMode = 'equalizing' | 'minimizing_tax'

export type GovernmentExperimentType = 'local_up_1pp' | 'local_down_1pp' | 'local_up_5pp' | 'local_down_5pp' | 'local_up_10pp' | 'local_down_10pp' | 'local_up_20pp' | 'local_down_20pp' | 'anchor_0' | 'anchor_25' | 'anchor_50' | 'anchor_75' | 'anchor_100'

export interface PriceDecision {
  nextPriceCents: number
  reason: string
  action: PriceDecisionAction
  state: PricingState
  justConverged: boolean
  probeEvent?: 'started' | 'adopted' | 'rejected'
}

export type SimulationEventType =
  | 'DAY_STARTED'
  | 'SUPPLY_RECEIVED'
  | 'EMPLOYMENT_ASSIGNED'
  | 'FIRM_PRODUCED'
  | 'WAGE_PAID'
  | 'PAYROLL_OBLIGATION_RECORDED'
  | 'CORPORATE_PROFIT_TAX_PAID'
  | 'PRICE_POSTED'
  | 'HOUSEHOLD_PURCHASE'
  | 'TRANSPORT_SERVICE_PURCHASED'
  | 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS'
  | 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT'
  | 'GOODS_EXPIRED'
  | 'FIRM_DAY_RESULT'
  | 'FIRM_PRICE_DECISION'
  | 'TAX_PAID'
  | 'TRANSFER_RECEIVED'
  | 'PARITY_TRANSFER_RECEIVED'
  | 'PRICE_DISCOVERY_CONVERGED'
  | 'PRICE_PROBE_STARTED'
  | 'PRICE_PROBE_ADOPTED'
  | 'PRICE_PROBE_REJECTED'
  | 'PRICE_EXPERIMENT_STARTED'
  | 'PRICE_EXPERIMENT_ADOPTED'
  | 'PRICE_EXPERIMENT_REJECTED'
  | 'GOVERNMENT_POLICY_EXPERIMENT_STARTED'
  | 'WEALTH_TAX_PAID'
  | 'MEANS_TESTED_TRANSFER_PAID'
  | 'GOVERNMENT_POLICY_EXPERIMENT_ADOPTED'
  | 'GOVERNMENT_POLICY_EXPERIMENT_REJECTED'
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
  oneWayDistance?: number
  roundTripTiles?: number
  transportFeeCents?: number
  deliveredCostCents?: number
  incumbentPriceCents?: number
  experimentalPriceCents?: number
  experimentType?: PriceExperimentType
  competitorPriceObservedCents?: number
  referenceProfitCents?: number
  experimentalProfitCents?: number
  workerCount?: number
  productivityPerWorker?: number
  unitsProduced?: number
  wageCents?: number
  contractualPayrollCents?: number
  unpaidWagesCents?: number
  residualProfitCents?: number
  employerDailyRevenue?: number
  employeeCount?: number
  householdCashAvailableCents?: number
  categoryBudgetCents?: number
  minimumDeliveredCostCents?: number
  taxRateBps?: number
  incumbentTaxRateBps?: number
  taxCents?: number
  transferCents?: number
  preFiscalGini?: number
  postFiscalGini?: number
  referenceGini?: number
  governmentExperimentType?: GovernmentExperimentType
  governmentPolicyMode?: GovernmentPolicyMode
  effectiveEqualityBefore?: boolean
  effectiveEqualityAfter?: boolean
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
  unitsProduced: number
  unitsExpired: number
  stockoutFailures: number
  affordabilityFailures: number
  soldOut: boolean
  householdsAffordableAtMarketOpen: number
  revenueCents: number
  preTaxProfitCents: number
  converged: boolean
  locallySettled: boolean
  probing: boolean
  incumbentPriceCents: number
  marketShare: number
  totalIndustryUnitsSold: number
  transactionPricesCents: number[]
  averageCustomerDistance: number
  averageDeliveredCostCents: number
  averageTransportFeeCents: number
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
  householdCashGiniBeforeParity: number
  totalRevenueCents: number
  totalPreTaxProfitCents: number
  totalHouseholdCashCents: number
  totalFirmCashBeforeTaxCents: number
  totalFirmCashAfterTaxCents: number
  governmentCashBeforeRedistributionCents: number
  governmentCashAfterRedistributionCents: number
  totalMoneyCents: number
  allFirmsConverged: boolean
  allFirmsLocallySettled: boolean
  entertainmentTrips: number
  totalTilesTravelled: number
  totalTransportRevenueCents: number
  averageTransportFeeCents: number
  transportRevenueByIndustryCents: Partial<Record<Exclude<IndustryId, 'transport'>, number>>
  totalWagesPaidCents: number
  totalContractualPayrollCents: number
  totalUnpaidWagesCents: number
  payrollFulfillmentRate: number
  totalResidualFirmProfitCents: number
  totalCorporateProfitTaxCents: number
  meanDailyWageCents: number
  wageIncomeGini: number
  householdSpendingCents: number
  preFiscalCashGini: number
  postFiscalCashGini: number
  giniReduction: number
  incumbentWealthTaxRateBps: number
  appliedWealthTaxRateBps: number
  governmentPolicyStatus: 'incumbent' | 'experiment'
  governmentExperimentType: GovernmentExperimentType | null
  totalWealthTaxCollectedCents: number
  totalGovernmentReceiptsCents: number
  totalMeansTestedTransfersCents: number
  householdsPayingWealthTax: number
  householdsReceivingTransfers: number
  meanTransferCents: number
  maximumTransferCents: number
  governmentPolicyMode: GovernmentPolicyMode
  effectiveEquality: boolean
  postFiscalCashRangeCents: number
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
  rngState: number
  spatialSeed: number
  employmentSeed: number
  governmentPolicyRngState: number
}
