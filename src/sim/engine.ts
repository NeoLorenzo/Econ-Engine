import { summarizeCashDistribution } from './analytics'
import {
  CONTRACTUAL_WAGE_CENTS,
  DEFAULT_CONFIG,
  DEFAULT_DAILY_EXPENDITURE_BUDGET_CENTS,
  DEFAULT_FIRMS_PER_INDUSTRY,
  DEFAULT_GOVERNMENT_EXPERIMENT_PROBABILITY,
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  DEFAULT_INDUSTRIES,
  DEFAULT_INDUSTRY_BUDGET_SHARES_BPS,
  DEFAULT_LABOR_PRODUCTIVITY,
  DEFAULT_PROBE_PROBABILITY,
  DEFAULT_SEED,
  DEFAULT_TRANSPORT_COST_PER_TILE_CENTS,
  HOUSEHOLD_COUNT,
  INITIAL_HOUSEHOLD_CASH_CENTS,
  MAX_EVENTS,
  MAX_HISTORY,
  TRANSPORT_FIRM_ID,
  consumerFirmIds as rosterConsumerFirmIds,
  deriveIndustryBudgetCents,
  firmRoster,
  validatePopulationConfig,
} from './config'
import { assignEmployment, deriveEmploymentSeed, payrollOrder } from './employment'
import {
  chooseGovernmentExperiment,
  collectWealthTax,
  deriveGovernmentPolicySeed,
  householdCashGini,
  isEffectivelyEqual,
  redistributeByWaterFilling,
  shouldAdoptGovernmentExperiment,
} from './government'
import { totalMoney, validateState } from './invariants'
import {
  buildPriceExperimentCatalog,
  createPricingState,
  decideTomorrowPrice,
  type PriceExperimentCandidate,
} from './pricingStrategy'
import { normalizeSeed, probabilityCheck, randomInt, seededShuffle } from './rng'
import { deriveSpatialSeed, generateSpatialLayout, transportQuote } from './spatial'
import type {
  DayMetrics,
  Firm,
  Industry,
  IndustryId,
  MarketMetrics,
  PriceDecision,
  PricingState,
  SimulationConfig,
  SimulationEvent,
  SimulationEventType,
  SimulationState,
} from './types'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

function pushEvent(
  state: SimulationState,
  type: SimulationEventType,
  description: string,
  details: Partial<SimulationEvent> = {},
) {
  state.events.push({ id: state.nextEventId++, day: state.day, type, description, ...details })
}

/** Keeps only the newest MAX_EVENTS events. Called once per state transition rather than per push, so trimming costs amortized O(1) per event. */
function trimEvents(state: SimulationState) {
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS)
}

function safeProcessingOrder(config: SimulationConfig): IndustryId[] {
  const defaults = DEFAULT_INDUSTRIES.map(({ id }) => id)
  const proposed = config.industryProcessingOrder
  return proposed?.length === defaults.length &&
    new Set(proposed).size === defaults.length &&
    defaults.every((id) => proposed.includes(id))
    ? [...proposed]
    : defaults
}

function countHouseholdsAffordableAtMarketOpen(
  households: SimulationState['households'],
  industryId: IndustryId,
  industryFirms: Firm[],
  transportCostPerTileCents: number,
): number {
  return households.filter((household) => {
    const { budgetCents } = household.industryOutcomes[industryId]
    return industryFirms.some((firm) => {
      const deliveredCostCents =
        firm.postedPriceCents +
        transportQuote(household.coordinate, firm.coordinate!, transportCostPerTileCents).transportFeeCents
      return deliveredCostCents <= budgetCents && deliveredCostCents <= household.cashCents
    })
  }).length
}

export function createSimulation(config: Partial<SimulationConfig> = DEFAULT_CONFIG): SimulationState {
  const safeConfig: SimulationConfig = {
    startingPriceCents: Math.max(1, Math.round(config.startingPriceCents ?? DEFAULT_CONFIG.startingPriceCents)),
    householdCount: config.householdCount ?? HOUSEHOLD_COUNT,
    initialStepCents: Math.max(1, Math.round(config.initialStepCents ?? DEFAULT_CONFIG.initialStepCents)),
    laborProductivityUnitsPerWorker: Math.max(
      0,
      Math.round(config.laborProductivityUnitsPerWorker ?? DEFAULT_LABOR_PRODUCTIVITY),
    ),
    adaptiveGovernmentEnabled: config.adaptiveGovernmentEnabled ?? true,
    governmentExperimentProbability: Math.max(
      0,
      Math.min(1, config.governmentExperimentProbability ?? DEFAULT_GOVERNMENT_EXPERIMENT_PROBABILITY),
    ),
    industryStartingPricesCents: config.industryStartingPricesCents,
    firmStartingPricesCents: config.firmStartingPricesCents,
    industryProcessingOrder: safeProcessingOrder(config as SimulationConfig),
    seed: normalizeSeed(config.seed ?? DEFAULT_SEED),
    probeProbability: Math.max(0, Math.min(1, config.probeProbability ?? DEFAULT_PROBE_PROBABILITY)),
    gridWidth: Math.max(1, Math.round(config.gridWidth ?? DEFAULT_GRID_WIDTH)),
    gridHeight: Math.max(1, Math.round(config.gridHeight ?? DEFAULT_GRID_HEIGHT)),
    transportCostPerTileCents: Math.max(
      0,
      Math.round(config.transportCostPerTileCents ?? DEFAULT_TRANSPORT_COST_PER_TILE_CENTS),
    ),
    dailyExpenditureBudgetCents: Math.max(
      0,
      Math.round(config.dailyExpenditureBudgetCents ?? DEFAULT_DAILY_EXPENDITURE_BUDGET_CENTS),
    ),
    industryBudgetSharesBps: Object.fromEntries(
      Object.entries(DEFAULT_INDUSTRY_BUDGET_SHARES_BPS).map(([id, defaultBps]) => [
        id,
        Math.max(
          0,
          Math.min(
            10_000,
            Math.round(
              config.industryBudgetSharesBps?.[id as keyof typeof DEFAULT_INDUSTRY_BUDGET_SHARES_BPS] ?? defaultBps,
            ),
          ),
        ),
      ]),
    ),
    firmsPerIndustry: config.firmsPerIndustry ?? DEFAULT_FIRMS_PER_INDUSTRY,
  }
  validatePopulationConfig({
    householdCount: safeConfig.householdCount!,
    gridWidth: safeConfig.gridWidth!,
    gridHeight: safeConfig.gridHeight!,
    firmsPerIndustry: safeConfig.firmsPerIndustry!,
  })
  const roster = firmRoster(safeConfig.firmsPerIndustry)
  const industries = DEFAULT_INDUSTRIES.map((industry) =>
    industry.id === 'transport'
      ? { ...industry }
      : {
          ...industry,
          budgetShareBps: safeConfig.industryBudgetSharesBps![industry.id],
          householdBudgetCents: deriveIndustryBudgetCents(
            safeConfig.dailyExpenditureBudgetCents!,
            safeConfig.industryBudgetSharesBps![industry.id]!,
          ),
        },
  )
  const consumerFirmIds = rosterConsumerFirmIds(roster)
  const householdCount = safeConfig.householdCount!
  const spatialIds = [
    ...Array.from({ length: householdCount }, (_, index) => `household-${index + 1}`),
    ...consumerFirmIds,
  ]
  const layout = generateSpatialLayout(safeConfig.seed!, safeConfig.gridWidth!, safeConfig.gridHeight!, spatialIds)
  const householdIds = Array.from({ length: householdCount }, (_, index) => `household-${index + 1}`)
  const employment = assignEmployment(safeConfig.seed!, householdIds, [...consumerFirmIds, TRANSPORT_FIRM_ID])
  const firms: Firm[] = industries.flatMap((industry) =>
    roster[industry.id].map((firmId) => {
      const price = Math.max(
        1,
        Math.round(
          safeConfig.firmStartingPricesCents?.[firmId] ??
            safeConfig.industryStartingPricesCents?.[industry.id] ??
            safeConfig.startingPriceCents,
        ),
      )
      return {
        id: firmId,
        industryId: industry.id,
        cashCents: 0,
        postedPriceCents: price,
        unitsSoldToday: 0,
        revenueTodayCents: 0,
        preTaxProfitTodayCents: 0,
        availableUnitsToday: 0,
        unitsExpiredToday: 0,
        soldOutToday: false,
        pricing: createPricingState(price, safeConfig.initialStepCents),
        latestDecisionReason:
          industry.id === 'transport'
            ? 'Transport charges the configured exogenous per-tile rate.'
            : 'The first price is set by the run configuration.',
        latestDecisionAction: 'hold',
        coordinate: layout[firmId],
        employeeIds: householdIds.filter((id) => employment[id] === firmId),
        productivityPerWorker: industry.id === 'transport' ? null : safeConfig.laborProductivityUnitsPerWorker!,
        unitsProducedToday: 0,
        wagePoolTodayCents: 0,
        contractualWageCents: CONTRACTUAL_WAGE_CENTS,
        contractualPayrollTodayCents: 0,
        wagesPaidTodayCents: 0,
        unpaidWagesTodayCents: 0,
        payrollFulfillmentRate: 1,
        residualProfitTodayCents: 0,
        corporateProfitTaxTodayCents: 0,
        meanWageTodayCents: 0,
      }
    }),
  )
  const state: SimulationState = {
    day: 0,
    config: safeConfig,
    industries,
    households: Array.from({ length: householdCount }, (_, index) => ({
      id: `household-${index + 1}`,
      cashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      coordinate: layout[`household-${index + 1}`],
      spatialPurchasesToday: {},
      employerFirmId: employment[`household-${index + 1}`],
      contractualWageTodayCents: CONTRACTUAL_WAGE_CENTS,
      wageTodayCents: 0,
      unpaidWageTodayCents: 0,
      cumulativeWagesCents: 0,
      spendingTodayCents: 0,
      netCashChangeTodayCents: 0,
      preTaxCashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      taxPaidTodayCents: 0,
      transferReceivedTodayCents: 0,
      netFiscalTransferTodayCents: 0,
      postFiscalCashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      cumulativeTaxPaidCents: 0,
      cumulativeTransfersReceivedCents: 0,
      cumulativeNetFiscalPositionCents: 0,
      industryOutcomes: Object.fromEntries(
        industries.map(({ id, householdBudgetCents }) => [
          id,
          {
            budgetCents: householdBudgetCents,
            purchasedToday: false,
            spentTodayCents: 0,
            purchaseOutcomeToday: null,
            lifetimeUnitsPurchased: 0,
            lifetimeStockoutFailures: 0,
            lifetimeAffordabilityFailures: 0,
          },
        ]),
      ) as SimulationState['households'][number]['industryOutcomes'],
    })),
    firms,
    government: {
      id: 'government-1',
      cashCents: 0,
      taxCollectedTodayCents: 0,
      corporateTaxCollectedTodayCents: 0,
      wealthTaxCollectedTodayCents: 0,
      totalReceiptsTodayCents: 0,
      redistributedTodayCents: 0,
      incumbentWealthTaxRateBps: 0,
      appliedWealthTaxRateBps: 0,
      policyStatus: 'incumbent',
      incumbentReferenceGini: null,
      experimentRateBps: null,
      experimentType: null,
      lastExperimentOutcome: null,
      lastReferenceGini: null,
      lastExperimentalGini: null,
      preFiscalCashGini: 0,
      postFiscalCashGini: 0,
      giniReduction: 0,
      householdsPayingTax: 0,
      householdsReceivingTransfers: 0,
      meanTransferCents: 0,
      maximumTransferCents: 0,
      policyMode: 'minimizing_tax',
      effectiveEquality: true,
      postFiscalCashMinimumCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      postFiscalCashMaximumCents: INITIAL_HOUSEHOLD_CASH_CENTS,
    },
    metrics: [],
    events: [],
    nextEventId: 1,
    rngState: normalizeSeed(safeConfig.seed ?? DEFAULT_SEED),
    spatialSeed: deriveSpatialSeed(safeConfig.seed ?? DEFAULT_SEED),
    employmentSeed: deriveEmploymentSeed(safeConfig.seed ?? DEFAULT_SEED),
    governmentPolicyRngState: deriveGovernmentPolicySeed(safeConfig.seed ?? DEFAULT_SEED),
  }
  state.households.forEach((household) =>
    pushEvent(state, 'EMPLOYMENT_ASSIGNED', `${household.id} was assigned to ${household.employerFirmId}.`, {
      actorId: household.id,
      householdId: household.id,
      counterpartyId: household.employerFirmId,
      firmId: household.employerFirmId,
    }),
  )
  trimEvents(state)
  validateState(state)
  return state
}

function copyStateForStep(previous: SimulationState): SimulationState {
  return {
    ...previous,
    households: previous.households.map((household) => ({
      ...household,
      coordinate: household.coordinate,
      spatialPurchasesToday: Object.fromEntries(
        Object.entries(household.spatialPurchasesToday).map(([id, outcome]) => [id, { ...outcome }]),
      ) as typeof household.spatialPurchasesToday,
      industryOutcomes: Object.fromEntries(
        Object.entries(household.industryOutcomes).map(([industryId, outcome]) => [industryId, { ...outcome }]),
      ) as typeof household.industryOutcomes,
    })),
    firms: previous.firms.map((firm) => ({ ...firm, coordinate: firm.coordinate, pricing: { ...firm.pricing } })),
    government: { ...previous.government },
    metrics: [...previous.metrics],
    events: [...previous.events],
  }
}

type PurchaseFailuresByCause = DayMetrics['purchaseFailuresByCause']
type CashDistribution = ReturnType<typeof summarizeCashDistribution>

interface MarketsResult {
  marketMetrics: MarketMetrics[]
  purchaseFailuresByCause: PurchaseFailuresByCause
}

interface AfterMarketsSnapshot {
  transportTrips: number
  totalTilesTravelled: number
  totalTransportRevenueCents: number
  totalFirmCashBeforeTaxCents: number
  distribution: CashDistribution
}

interface FiscalResult {
  preFiscalDistribution: CashDistribution
  governmentCashBeforeRedistributionCents: number
  effectiveEquality: boolean
  postFiscalCashRangeCents: number
}

/**
 * Advances the economy by one day. The phases run in a fixed causal order (SIMULATION_DESIGN_RULES 7 and 8), and the
 * market RNG is drawn in the same sequence on every run: each industry's shuffle, preference ties and purchase ties, then
 * that industry's price-probe draws, before the next industry opens.
 */
export function stepSimulation(previous: SimulationState): SimulationState {
  const state = copyStateForStep(previous)
  startDay(state)
  const openingDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  produce(state)
  const markets = runMarkets(state)
  const afterMarkets = summarizeAfterMarkets(state)
  runPayroll(state)
  const fiscal = runFiscalPhase(state)
  const metric = buildDayMetrics(state, openingDistribution, markets, afterMarkets, fiscal)
  closeDay(state, metric)
  return state
}

/** Clears every daily field so nothing from yesterday leaks into today's flows. */
function startDay(state: SimulationState) {
  state.day += 1
  state.government.taxCollectedTodayCents = 0
  state.government.corporateTaxCollectedTodayCents = 0
  state.government.wealthTaxCollectedTodayCents = 0
  state.government.totalReceiptsTodayCents = 0
  state.government.redistributedTodayCents = 0
  Object.assign(state.government, {
    policyStatus: 'incumbent',
    appliedWealthTaxRateBps: state.government.incumbentWealthTaxRateBps,
    experimentRateBps: null,
    experimentType: null,
    householdsPayingTax: 0,
    householdsReceivingTransfers: 0,
    meanTransferCents: 0,
    maximumTransferCents: 0,
  })
  state.firms.forEach((firm) => {
    Object.assign(firm, {
      unitsSoldToday: 0,
      revenueTodayCents: 0,
      preTaxProfitTodayCents: 0,
      unitsExpiredToday: 0,
      soldOutToday: false,
      wagePoolTodayCents: 0,
      contractualPayrollTodayCents: firm.employeeIds.length * CONTRACTUAL_WAGE_CENTS,
      wagesPaidTodayCents: 0,
      unpaidWagesTodayCents: 0,
      payrollFulfillmentRate: 1,
      residualProfitTodayCents: 0,
      corporateProfitTaxTodayCents: 0,
      meanWageTodayCents: 0,
    })
  })
  state.households.forEach((household) => {
    Object.values(household.industryOutcomes).forEach((outcome) => {
      Object.assign(outcome, { purchasedToday: false, spentTodayCents: 0, purchaseOutcomeToday: null })
    })
    household.spatialPurchasesToday = {}
    household.contractualWageTodayCents = CONTRACTUAL_WAGE_CENTS
    household.wageTodayCents = 0
    household.unpaidWageTodayCents = 0
    household.spendingTodayCents = 0
    household.netCashChangeTodayCents = 0
    household.taxPaidTodayCents = 0
    household.transferReceivedTodayCents = 0
    household.netFiscalTransferTodayCents = 0
  })
  pushEvent(state, 'DAY_STARTED', `Day ${state.day} began.`)
}

/** Consumer firms produce from labor; Transport sells trips, not stocked units. */
function produce(state: SimulationState) {
  for (const firm of state.firms) {
    const produced =
      firm.industryId === 'transport' ? 0 : firm.employeeIds.length * state.config.laborProductivityUnitsPerWorker!
    firm.unitsProducedToday = produced
    firm.availableUnitsToday = produced
  }
  for (const firm of state.firms.filter(({ industryId }) => industryId !== 'transport'))
    pushEvent(
      state,
      'FIRM_PRODUCED',
      `${firm.id} produced ${firm.unitsProducedToday} units from ${firm.employeeIds.length} worker × ${firm.productivityPerWorker} productivity.`,
      {
        actorId: firm.id,
        firmId: firm.id,
        industryId: firm.industryId,
        quantity: firm.unitsProducedToday,
        workerCount: firm.employeeIds.length,
        productivityPerWorker: firm.productivityPerWorker!,
        unitsProduced: firm.unitsProducedToday,
      },
    )
}

/** Opens each consumer market in turn: clear it, then let its firms settle the day and choose tomorrow's price. */
function runMarkets(state: SimulationState): MarketsResult {
  const marketMetrics: MarketMetrics[] = []
  const purchaseFailuresByCause: PurchaseFailuresByCause = { cash: 0, category_budget: 0, inventory: 0 }
  for (const industryId of state.config.industryProcessingOrder ?? safeProcessingOrder(state.config)) {
    if (industryId === 'transport') continue
    const industry = state.industries.find(({ id }) => id === industryId)!
    const industryFirms = state.firms
      .filter((candidate) => candidate.industryId === industryId)
      .sort((left, right) => left.id.localeCompare(right.id))
    // Firms learn from the prices rivals advertised this morning, not the ones they post for tomorrow.
    const advertisedPrices = new Map(industryFirms.map((firm) => [firm.id, firm.postedPriceCents]))
    const affordableAtOpen = clearMarket(state, industry, industryFirms, purchaseFailuresByCause)
    marketMetrics.push(...decidePrices(state, industry, industryFirms, advertisedPrices, affordableAtOpen))
  }
  return { marketMetrics, purchaseFailuresByCause }
}

/**
 * Orders households for one market and executes their purchases. Households are shuffled, then each is assigned its
 * cheapest delivered-cost firm (seeded tie-break). At each firm the nearest households buy first, up to its stock; the
 * overflow follows, ordered by distance to its next-best alternative. Returns how many households could afford a
 * firm when the market opened.
 */
function clearMarket(
  state: SimulationState,
  industry: Industry,
  industryFirms: Firm[],
  purchaseFailuresByCause: PurchaseFailuresByCause,
): number {
  const industryId = industry.id as Exclude<IndustryId, 'transport'>
  const transportRate = state.config.transportCostPerTileCents!
  const minimumPostedPrice = Math.min(...industryFirms.map(({ postedPriceCents }) => postedPriceCents))
  const shuffled = seededShuffle(state.households, state.rngState)
  state.rngState = shuffled.state
  const priority = shuffled.values.map((household) => {
    const ranked = industryFirms
      .map((firm) => ({ firm, ...transportQuote(household.coordinate, firm.coordinate!, transportRate) }))
      .sort(
        (left, right) =>
          left.firm.postedPriceCents + left.transportFeeCents - (right.firm.postedPriceCents + right.transportFeeCents),
      )
    const lowest = ranked[0].firm.postedPriceCents + ranked[0].transportFeeCents
    const tied = ranked.filter((item) => item.firm.postedPriceCents + item.transportFeeCents === lowest)
    const draw = randomInt(state.rngState, tied.length)
    state.rngState = draw.state
    const preferred = tied[draw.value]
    const tie = randomInt(state.rngState, 0x7fff_ffff)
    state.rngState = tie.state
    // The cheapest firm other than the preferred one; with two firms, simply the other firm.
    const alternative = ranked.find((item) => item !== preferred)
    return {
      household,
      preferredFirmId: preferred.firm.id,
      distance: preferred.oneWayDistance,
      alternativeDistance: alternative?.oneWayDistance ?? 0,
      tie: tie.value,
    }
  })
  const primary: typeof priority = []
  const fallback: typeof priority = []
  for (const firm of industryFirms) {
    const queue = priority
      .filter(({ preferredFirmId }) => preferredFirmId === firm.id)
      .sort((left, right) => left.distance - right.distance || left.tie - right.tie)
    primary.push(...queue.slice(0, firm.availableUnitsToday))
    fallback.push(...queue.slice(firm.availableUnitsToday))
  }
  fallback.sort((left, right) => left.alternativeDistance - right.alternativeDistance || left.tie - right.tie)
  const purchasingOrder = [...primary, ...fallback].map(({ household }) => household)

  const affordableAtOpen = countHouseholdsAffordableAtMarketOpen(
    state.households,
    industryId,
    industryFirms,
    transportRate,
  )
  for (const firm of industryFirms)
    pushEvent(state, 'PRICE_POSTED', `${firm.id} posted ${dollars(firm.postedPriceCents)} in ${industry.name}.`, {
      actorId: firm.id,
      firmId: firm.id,
      industryId,
      priceCents: firm.postedPriceCents,
    })

  const transportFirm = state.firms.find(({ industryId: id }) => id === 'transport')!
  for (const household of purchasingOrder) {
    const outcome = household.industryOutcomes[industryId]
    const quote = (firm: Firm) => transportQuote(household.coordinate, firm.coordinate!, transportRate)
    const delivered = (firm: Firm) => firm.postedPriceCents + quote(firm).transportFeeCents
    const distancesByFirmId = Object.fromEntries(industryFirms.map((firm) => [firm.id, quote(firm).oneWayDistance]))
    household.spatialPurchasesToday[industryId] = {
      chosenFirmId: null,
      distancesByFirmId,
      chosenOneWayDistance: null,
      roundTripTiles: 0,
      productPriceCents: 0,
      transportFeeCents: 0,
      deliveredCostCents: 0,
    }
    const affordable = industryFirms.filter(
      (firm) => delivered(firm) <= outcome.budgetCents && delivered(firm) <= household.cashCents,
    )
    const available = affordable.filter((firm) => firm.availableUnitsToday > 0)
    if (affordable.length === 0) {
      outcome.purchaseOutcomeToday = 'insufficient_funds'
      outcome.lifetimeAffordabilityFailures += 1
      const minimumDeliveredCostCents = Math.min(...industryFirms.map(delivered))
      purchaseFailuresByCause[minimumDeliveredCostCents > outcome.budgetCents ? 'category_budget' : 'cash'] += 1
      pushEvent(
        state,
        'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS',
        `${household.id} could not afford any ${industry.name} firm within its category limit and actual cash.`,
        {
          actorId: household.id,
          householdId: household.id,
          industryId,
          priceCents: minimumPostedPrice,
          householdCashAvailableCents: household.cashCents,
          categoryBudgetCents: outcome.budgetCents,
          minimumDeliveredCostCents,
        },
      )
      continue
    }
    if (available.length === 0) {
      outcome.purchaseOutcomeToday = 'stockout'
      outcome.lifetimeStockoutFailures += 1
      purchaseFailuresByCause.inventory += 1
      pushEvent(
        state,
        'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT',
        `${household.id} could afford ${industry.name}, but no affordable firm had stock.`,
        { actorId: household.id, householdId: household.id, industryId, priceCents: minimumPostedPrice },
      )
      continue
    }
    const cheapestPrice = Math.min(...available.map((firm) => delivered(firm)))
    const tied = available.filter((firm) => delivered(firm) === cheapestPrice)
    const selection = randomInt(state.rngState, tied.length)
    state.rngState = selection.state
    const firm = tied[selection.value]
    const price = firm.postedPriceCents
    const travel = quote(firm)
    const total = price + travel.transportFeeCents
    const details = {
      actorId: household.id,
      counterpartyId: firm.id,
      householdId: household.id,
      firmId: firm.id,
      industryId,
      priceCents: price,
      oneWayDistance: travel.oneWayDistance,
      roundTripTiles: travel.roundTripTiles,
      transportFeeCents: travel.transportFeeCents,
      deliveredCostCents: total,
    }
    household.cashCents -= total
    household.spendingTodayCents += total
    firm.cashCents += price
    firm.availableUnitsToday -= 1
    firm.unitsSoldToday += 1
    transportFirm.cashCents += travel.transportFeeCents
    transportFirm.unitsSoldToday += 1
    transportFirm.revenueTodayCents += travel.transportFeeCents
    transportFirm.preTaxProfitTodayCents += travel.transportFeeCents
    household.spatialPurchasesToday[industryId] = {
      chosenFirmId: firm.id,
      distancesByFirmId,
      chosenOneWayDistance: travel.oneWayDistance,
      roundTripTiles: travel.roundTripTiles,
      productPriceCents: price,
      transportFeeCents: travel.transportFeeCents,
      deliveredCostCents: total,
    }
    pushEvent(
      state,
      'TRANSPORT_SERVICE_PURCHASED',
      `${household.id} paid ${dollars(travel.transportFeeCents)} to Transport for ${travel.roundTripTiles} tiles of ${industry.name} travel.`,
      {
        ...details,
        counterpartyId: transportFirm.id,
        firmId: transportFirm.id,
        amountCents: travel.transportFeeCents,
        quantity: travel.roundTripTiles,
      },
    )
    Object.assign(outcome, { purchasedToday: true, spentTodayCents: total, purchaseOutcomeToday: 'purchased' })
    outcome.lifetimeUnitsPurchased += 1
    pushEvent(
      state,
      'HOUSEHOLD_PURCHASE',
      `${household.id} purchased ${industry.name} from ${firm.id} for ${dollars(price)} (${dollars(total)} delivered).`,
      { ...details, amountCents: price, quantity: 1 },
    )
  }
  return affordableAtOpen
}

/**
 * Expires unsold stock, books each firm's revenue, and runs its pricing strategy for tomorrow. A settled firm may draw a
 * price experiment; its only view of rivals is the lowest price they advertised this morning.
 */
function decidePrices(
  state: SimulationState,
  industry: Industry,
  industryFirms: Firm[],
  advertisedPrices: Map<string, number>,
  affordableAtOpen: number,
): MarketMetrics[] {
  const industryId = industry.id as Exclude<IndustryId, 'transport'>
  const totalIndustryUnitsSold = industryFirms.reduce((sum, firm) => sum + firm.unitsSoldToday, 0)
  // One pass over households gathers the industry's failure counts and each firm's customer totals.
  let stockoutFailures = 0
  let affordabilityFailures = 0
  const customers = new Map(industryFirms.map((firm) => [firm.id, { distance: 0, deliveredCost: 0, transportFee: 0 }]))
  for (const household of state.households) {
    const outcome = household.industryOutcomes[industryId].purchaseOutcomeToday
    if (outcome === 'stockout') stockoutFailures++
    else if (outcome === 'insufficient_funds') affordabilityFailures++
    const purchase = household.spatialPurchasesToday[industryId]
    const totals = purchase?.chosenFirmId ? customers.get(purchase.chosenFirmId) : undefined
    if (!purchase || !totals) continue
    totals.distance += purchase.chosenOneWayDistance!
    totals.deliveredCost += purchase.deliveredCostCents
    totals.transportFee += purchase.transportFeeCents
  }
  const average = (total: number, units: number) => (units > 0 ? total / units : 0)

  return industryFirms.map((firm): MarketMetrics => {
    const testedPrice = firm.postedPriceCents
    firm.unitsExpiredToday = firm.availableUnitsToday
    firm.availableUnitsToday = 0
    firm.soldOutToday = firm.unitsSoldToday === firm.unitsProducedToday
    pushEvent(
      state,
      'GOODS_EXPIRED',
      `${firm.unitsExpiredToday} unsold ${industry.name.toLowerCase()} units expired at ${firm.id}.`,
      { actorId: firm.id, firmId: firm.id, industryId, quantity: firm.unitsExpiredToday },
    )
    const revenue = firm.unitsSoldToday * testedPrice
    if (firm.cashCents !== revenue) throw new Error(`${firm.id} cash does not equal today's zero-cost revenue`)
    firm.revenueTodayCents = revenue
    firm.preTaxProfitTodayCents = revenue
    pushEvent(
      state,
      'FIRM_DAY_RESULT',
      `${firm.id} sold ${firm.unitsSoldToday}/${firm.unitsProducedToday} produced units and realised ${dollars(revenue)} operating earnings.`,
      { actorId: firm.id, firmId: firm.id, industryId, amountCents: revenue, quantity: firm.unitsSoldToday },
    )
    let shouldProbe = false
    let probeDirection: 'up' | 'down' = 'up'
    let experimentCandidate: PriceExperimentCandidate | undefined
    if (firm.pricing.locallySettled && !firm.pricing.probing) {
      const probeDraw = probabilityCheck(state.rngState, state.config.probeProbability ?? DEFAULT_PROBE_PROBABILITY)
      state.rngState = probeDraw.state
      shouldProbe = probeDraw.value
      if (shouldProbe) {
        const rivalPrices = industryFirms.filter(({ id }) => id !== firm.id).map(({ id }) => advertisedPrices.get(id)!)
        const catalog = buildPriceExperimentCatalog(
          firm.pricing.incumbentPriceCents,
          rivalPrices.length > 0 ? Math.min(...rivalPrices) : undefined,
          firm.soldOutToday,
        )
        if (catalog.length > 0) {
          const candidateDraw = randomInt(state.rngState, catalog.length)
          state.rngState = candidateDraw.state
          experimentCandidate = catalog[candidateDraw.value]
          probeDirection = experimentCandidate.priceCents >= firm.pricing.incumbentPriceCents ? 'up' : 'down'
        } else shouldProbe = false
      }
    }
    const priorPricing = firm.pricing
    const decision = decideTomorrowPrice(firm.pricing, testedPrice, firm.unitsSoldToday, revenue, {
      shouldProbe,
      direction: probeDirection,
      candidate: experimentCandidate,
    })
    firm.pricing = decision.state
    firm.latestDecisionReason = decision.reason
    firm.latestDecisionAction = decision.action
    firm.postedPriceCents = decision.nextPriceCents
    pushEvent(
      state,
      'FIRM_PRICE_DECISION',
      `${firm.id} will post ${dollars(decision.nextPriceCents)} tomorrow. ${decision.reason}`,
      { actorId: firm.id, firmId: firm.id, industryId, priceCents: decision.nextPriceCents },
    )
    if (decision.justConverged)
      pushEvent(
        state,
        'PRICE_DISCOVERY_CONVERGED',
        `${firm.id} became locally settled at ${dollars(firm.pricing.incumbentPriceCents)}.`,
        { actorId: firm.id, firmId: firm.id, industryId, priceCents: firm.pricing.incumbentPriceCents },
      )
    if (decision.probeEvent)
      recordPriceExperiment(state, firm, industryId, decision, priorPricing, testedPrice, revenue)
    const totals = customers.get(firm.id)!
    return {
      industryId,
      firmId: firm.id,
      postedPriceCents: testedPrice,
      nextPriceCents: decision.nextPriceCents,
      bestKnownPriceCents: firm.pricing.bestPriceCents,
      priceStepSizeCents: firm.pricing.stepSizeCents,
      searchDirection: firm.pricing.direction,
      unitsSold: firm.unitsSoldToday,
      unitsSupplied: firm.unitsProducedToday,
      unitsProduced: firm.unitsProducedToday,
      unitsExpired: firm.unitsExpiredToday,
      stockoutFailures,
      affordabilityFailures,
      soldOut: firm.soldOutToday,
      householdsAffordableAtMarketOpen: affordableAtOpen,
      revenueCents: revenue,
      preTaxProfitCents: revenue,
      converged: firm.pricing.converged,
      locallySettled: firm.pricing.locallySettled,
      probing: firm.pricing.probing,
      incumbentPriceCents: firm.pricing.incumbentPriceCents,
      marketShare: totalIndustryUnitsSold === 0 ? 0 : firm.unitsSoldToday / totalIndustryUnitsSold,
      totalIndustryUnitsSold,
      transactionPricesCents: firm.unitsSoldToday > 0 ? [testedPrice] : [],
      averageCustomerDistance: average(totals.distance, firm.unitsSoldToday),
      averageDeliveredCostCents: average(totals.deliveredCost, firm.unitsSoldToday),
      averageTransportFeeCents: average(totals.transportFee, firm.unitsSoldToday),
    }
  })
}

function recordPriceExperiment(
  state: SimulationState,
  firm: Firm,
  industryId: IndustryId,
  decision: PriceDecision,
  priorPricing: PricingState,
  testedPrice: number,
  revenue: number,
) {
  const started = decision.probeEvent === 'started'
  const type = started
    ? 'PRICE_PROBE_STARTED'
    : decision.probeEvent === 'adopted'
      ? 'PRICE_PROBE_ADOPTED'
      : 'PRICE_PROBE_REJECTED'
  pushEvent(state, type, `${firm.id}: ${decision.reason}`, {
    actorId: firm.id,
    firmId: firm.id,
    industryId,
    priceCents: decision.nextPriceCents,
  })
  const experimentType = started ? decision.state.experimentType : priorPricing.experimentType
  const competitorPriceObservedCents = started
    ? decision.state.competitorPriceObservedCents
    : priorPricing.competitorPriceObservedCents
  const experimentEventType = started
    ? 'PRICE_EXPERIMENT_STARTED'
    : decision.probeEvent === 'adopted'
      ? 'PRICE_EXPERIMENT_ADOPTED'
      : 'PRICE_EXPERIMENT_REJECTED'
  const experimentalPrice = started ? decision.nextPriceCents : testedPrice
  pushEvent(
    state,
    experimentEventType,
    `${firm.id} ${decision.probeEvent} ${experimentType ?? 'price'} experiment at ${dollars(experimentalPrice)}.`,
    {
      actorId: firm.id,
      firmId: firm.id,
      industryId,
      incumbentPriceCents: priorPricing.incumbentPriceCents,
      experimentalPriceCents: experimentalPrice,
      experimentType: experimentType ?? undefined,
      competitorPriceObservedCents: competitorPriceObservedCents ?? undefined,
      referenceProfitCents: started ? revenue : priorPricing.incumbentProfitCents,
      experimentalProfitCents: started ? undefined : revenue,
    },
  )
}

/** Totals fixed once markets close and before any wage is paid. */
function summarizeAfterMarkets(state: SimulationState): AfterMarketsSnapshot {
  const transportFirm = state.firms.find(({ industryId }) => industryId === 'transport')!
  return {
    transportTrips: transportFirm.unitsSoldToday,
    totalTilesTravelled: state.households.reduce(
      (sum, household) =>
        sum +
        Object.values(household.spatialPurchasesToday).reduce(
          (subtotal, purchase) => subtotal + (purchase?.roundTripTiles ?? 0),
          0,
        ),
      0,
    ),
    totalTransportRevenueCents: transportFirm.cashCents,
    totalFirmCashBeforeTaxCents: state.firms.reduce((sum, firm) => sum + firm.cashCents, 0),
    distribution: summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents)),
  }
}

/** Each firm pays contractual wages from its revenue (pro rata if short), then pays all residual profit as tax. */
function runPayroll(state: SimulationState) {
  const householdsById = new Map(state.households.map((household) => [household.id, household]))
  for (const firm of state.firms) {
    const contractualPayroll = firm.employeeIds.length * CONTRACTUAL_WAGE_CENTS
    const pool = Math.min(firm.cashCents, contractualPayroll)
    firm.contractualPayrollTodayCents = contractualPayroll
    firm.wagePoolTodayCents = pool
    pushEvent(
      state,
      'PAYROLL_OBLIGATION_RECORDED',
      `${firm.id} owed ${dollars(contractualPayroll)} and had ${dollars(firm.cashCents)} available.`,
      { actorId: firm.id, firmId: firm.id, industryId: firm.industryId, contractualPayrollCents: contractualPayroll },
    )
    const ordered = payrollOrder(state.config.seed!, state.day, firm.id, firm.employeeIds)
    const baseWage = Math.floor(pool / ordered.length)
    const remainder = pool % ordered.length
    ordered.forEach((householdId, index) => {
      const wage = baseWage + (index < remainder ? 1 : 0)
      const household = householdsById.get(householdId)!
      firm.cashCents -= wage
      household.cashCents += wage
      household.wageTodayCents += wage
      household.cumulativeWagesCents += wage
      household.unpaidWageTodayCents = CONTRACTUAL_WAGE_CENTS - household.wageTodayCents
      pushEvent(state, 'WAGE_PAID', `${firm.id} paid ${dollars(wage)} to ${household.id}.`, {
        actorId: firm.id,
        counterpartyId: household.id,
        firmId: firm.id,
        householdId: household.id,
        industryId: firm.industryId,
        amountCents: wage,
        wageCents: wage,
        employerDailyRevenue: pool,
        employeeCount: ordered.length,
      })
    })
    firm.wagesPaidTodayCents = pool
    firm.unpaidWagesTodayCents = contractualPayroll - pool
    firm.payrollFulfillmentRate = contractualPayroll ? pool / contractualPayroll : 1
    firm.meanWageTodayCents = pool / ordered.length
    firm.residualProfitTodayCents = firm.cashCents
    firm.corporateProfitTaxTodayCents = firm.residualProfitTodayCents
    if (firm.corporateProfitTaxTodayCents > 0)
      pushEvent(
        state,
        'CORPORATE_PROFIT_TAX_PAID',
        `${firm.id} paid ${dollars(firm.corporateProfitTaxTodayCents)} corporate profit tax.`,
        {
          actorId: firm.id,
          counterpartyId: state.government.id,
          firmId: firm.id,
          industryId: firm.industryId,
          amountCents: firm.corporateProfitTaxTodayCents,
          taxCents: firm.corporateProfitTaxTodayCents,
          residualProfitCents: firm.residualProfitTodayCents,
          taxRateBps: 10_000,
        },
      )
    firm.cashCents -= firm.corporateProfitTaxTodayCents
    state.government.cashCents += firm.corporateProfitTaxTodayCents
    state.government.corporateTaxCollectedTodayCents += firm.corporateProfitTaxTodayCents
  }
  state.households.forEach((household) => {
    household.netCashChangeTodayCents = household.wageTodayCents - household.spendingTodayCents
  })
}

/**
 * Government may trial a new wealth-tax rate, collects the tax, redistributes everything it holds by water-filling, and
 * then judges the trial against the post-fiscal Gini.
 */
function runFiscalPhase(state: SimulationState): FiscalResult {
  const preFiscalDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  state.government.preFiscalCashGini = preFiscalDistribution.gini
  if (state.config.adaptiveGovernmentEnabled && state.government.incumbentReferenceGini !== null) {
    const experimentDraw = probabilityCheck(
      state.governmentPolicyRngState,
      state.config.governmentExperimentProbability!,
    )
    state.governmentPolicyRngState = experimentDraw.state
    if (experimentDraw.value) {
      const selection = chooseGovernmentExperiment(
        state.government.incumbentWealthTaxRateBps,
        state.government.policyMode,
        state.governmentPolicyRngState,
      )
      state.governmentPolicyRngState = selection.rngState
      if (selection.candidate) {
        Object.assign(state.government, {
          policyStatus: 'experiment',
          appliedWealthTaxRateBps: selection.candidate.rateBps,
          experimentRateBps: selection.candidate.rateBps,
          experimentType: selection.candidate.type,
        })
        pushEvent(
          state,
          'GOVERNMENT_POLICY_EXPERIMENT_STARTED',
          `Government started ${selection.candidate.type} at ${(selection.candidate.rateBps / 100).toFixed(2)}% while ${state.government.policyMode}.`,
          {
            actorId: state.government.id,
            taxRateBps: selection.candidate.rateBps,
            incumbentTaxRateBps: state.government.incumbentWealthTaxRateBps,
            governmentExperimentType: selection.candidate.type,
            governmentPolicyMode: state.government.policyMode,
            effectiveEqualityBefore: state.government.policyMode === 'minimizing_tax',
            preFiscalGini: preFiscalDistribution.gini,
            referenceGini: state.government.incumbentReferenceGini,
          },
        )
      }
    }
  }
  if (!state.config.adaptiveGovernmentEnabled) state.government.appliedWealthTaxRateBps = 0
  collectWealthTax(state.households, state.government, state.government.appliedWealthTaxRateBps)
  state.government.totalReceiptsTodayCents =
    state.government.corporateTaxCollectedTodayCents + state.government.wealthTaxCollectedTodayCents
  state.government.taxCollectedTodayCents = state.government.totalReceiptsTodayCents
  for (const household of state.households.filter(({ taxPaidTodayCents }) => taxPaidTodayCents > 0))
    pushEvent(state, 'WEALTH_TAX_PAID', `${household.id} paid ${dollars(household.taxPaidTodayCents)} wealth tax.`, {
      actorId: household.id,
      counterpartyId: state.government.id,
      householdId: household.id,
      amountCents: household.taxPaidTodayCents,
      taxCents: household.taxPaidTodayCents,
      taxRateBps: state.government.appliedWealthTaxRateBps,
      preFiscalGini: preFiscalDistribution.gini,
    })
  const governmentCashBeforeRedistributionCents = state.government.cashCents
  const redistribution = redistributeByWaterFilling(state.households, state.government, state.governmentPolicyRngState)
  state.governmentPolicyRngState = redistribution.rngState
  for (const household of state.households.filter(({ transferReceivedTodayCents }) => transferReceivedTodayCents > 0))
    pushEvent(
      state,
      'MEANS_TESTED_TRANSFER_PAID',
      `Government paid ${dollars(household.transferReceivedTodayCents)} to ${household.id}.`,
      {
        actorId: state.government.id,
        counterpartyId: household.id,
        householdId: household.id,
        amountCents: household.transferReceivedTodayCents,
        transferCents: household.transferReceivedTodayCents,
        taxRateBps: state.government.appliedWealthTaxRateBps,
        preFiscalGini: preFiscalDistribution.gini,
      },
    )
  const postFiscalGini = householdCashGini(state.households)
  const postFiscalCash = state.households.map(({ cashCents }) => cashCents)
  const effectiveEquality = isEffectivelyEqual(postFiscalCash)
  const postFiscalCashMinimumCents = Math.min(...postFiscalCash)
  const postFiscalCashMaximumCents = Math.max(...postFiscalCash)
  state.households.forEach((household) => {
    household.netCashChangeTodayCents =
      household.wageTodayCents - household.spendingTodayCents + household.netFiscalTransferTodayCents
  })
  const householdsPayingTax = state.households.filter(({ taxPaidTodayCents }) => taxPaidTodayCents > 0).length
  const householdsReceivingTransfers = state.households.filter(
    ({ transferReceivedTodayCents }) => transferReceivedTodayCents > 0,
  ).length
  Object.assign(state.government, {
    postFiscalCashGini: postFiscalGini,
    giniReduction: preFiscalDistribution.gini - postFiscalGini,
    effectiveEquality,
    postFiscalCashMinimumCents,
    postFiscalCashMaximumCents,
    householdsPayingTax,
    householdsReceivingTransfers,
    meanTransferCents: householdsReceivingTransfers
      ? state.government.redistributedTodayCents / householdsReceivingTransfers
      : 0,
    maximumTransferCents: Math.max(
      ...state.households.map(({ transferReceivedTodayCents }) => transferReceivedTodayCents),
    ),
  })
  if (state.government.policyStatus === 'experiment')
    judgeGovernmentExperiment(state, preFiscalDistribution.gini, postFiscalGini, effectiveEquality)
  else {
    state.government.incumbentReferenceGini = postFiscalGini
    state.government.policyMode = effectiveEquality ? 'minimizing_tax' : 'equalizing'
  }
  return {
    preFiscalDistribution,
    governmentCashBeforeRedistributionCents,
    effectiveEquality,
    postFiscalCashRangeCents: postFiscalCashMaximumCents - postFiscalCashMinimumCents,
  }
}

function judgeGovernmentExperiment(
  state: SimulationState,
  preFiscalGini: number,
  postFiscalGini: number,
  effectiveEquality: boolean,
) {
  const reference = state.government.incumbentReferenceGini!
  const experimentMode = state.government.policyMode
  const adopted = shouldAdoptGovernmentExperiment(experimentMode, postFiscalGini, reference, effectiveEquality)
  state.government.lastReferenceGini = reference
  state.government.lastExperimentalGini = postFiscalGini
  state.government.lastExperimentOutcome = adopted ? 'adopted' : 'rejected'
  const eventType = adopted ? 'GOVERNMENT_POLICY_EXPERIMENT_ADOPTED' : 'GOVERNMENT_POLICY_EXPERIMENT_REJECTED'
  const reason =
    experimentMode === 'minimizing_tax'
      ? effectiveEquality
        ? 'lower tax maintained effective equality'
        : 'lower tax broke effective equality'
      : effectiveEquality
        ? 'higher tax achieved effective equality'
        : adopted
          ? 'higher tax reduced Gini'
          : 'higher tax did not reduce Gini'
  pushEvent(
    state,
    eventType,
    `Government ${adopted ? 'adopted' : 'rejected'} ${state.government.experimentType} at ${(state.government.appliedWealthTaxRateBps / 100).toFixed(2)}%: ${reason}.`,
    {
      actorId: state.government.id,
      taxRateBps: state.government.appliedWealthTaxRateBps,
      incumbentTaxRateBps: state.government.incumbentWealthTaxRateBps,
      governmentExperimentType: state.government.experimentType!,
      governmentPolicyMode: experimentMode,
      effectiveEqualityBefore: experimentMode === 'minimizing_tax',
      effectiveEqualityAfter: effectiveEquality,
      preFiscalGini,
      postFiscalGini,
      referenceGini: reference,
    },
  )
  if (adopted) {
    state.government.incumbentWealthTaxRateBps = state.government.appliedWealthTaxRateBps
    state.government.incumbentReferenceGini = postFiscalGini
    state.government.policyMode = effectiveEquality ? 'minimizing_tax' : 'equalizing'
  }
}

function buildDayMetrics(
  state: SimulationState,
  openingDistribution: CashDistribution,
  { marketMetrics, purchaseFailuresByCause }: MarketsResult,
  afterMarkets: AfterMarketsSnapshot,
  fiscal: FiscalResult,
): DayMetrics {
  const endingDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  const { transportTrips, totalTransportRevenueCents, totalFirmCashBeforeTaxCents } = afterMarkets
  const { preFiscalDistribution } = fiscal
  return {
    day: state.day,
    markets: marketMetrics,
    householdCashMinimumAtMarketOpenCents: openingDistribution.minimumCents,
    householdCashMedianAtMarketOpenCents: openingDistribution.medianCents,
    householdCashMaximumAtMarketOpenCents: openingDistribution.maximumCents,
    householdCashGiniAtMarketOpen: openingDistribution.gini,
    householdCashMinimumCents: endingDistribution.minimumCents,
    householdCashMedianCents: endingDistribution.medianCents,
    householdCashMaximumCents: endingDistribution.maximumCents,
    householdCashGini: endingDistribution.gini,
    householdCashGiniAfterMarkets: afterMarkets.distribution.gini,
    totalRevenueCents: totalFirmCashBeforeTaxCents,
    totalPreTaxProfitCents: totalFirmCashBeforeTaxCents,
    totalHouseholdCashCents: state.households.reduce((sum, household) => sum + household.cashCents, 0),
    totalFirmCashBeforeTaxCents,
    totalFirmCashAfterTaxCents: state.firms.reduce((sum, firm) => sum + firm.cashCents, 0),
    governmentCashBeforeRedistributionCents: fiscal.governmentCashBeforeRedistributionCents,
    governmentCashAfterRedistributionCents: state.government.cashCents,
    totalMoneyCents: totalMoney(state),
    allFirmsConverged: state.firms.every((firm) => firm.pricing.converged),
    allFirmsLocallySettled: state.firms
      .filter((firm) => firm.industryId !== 'transport')
      .every((firm) => firm.pricing.locallySettled),
    transportTrips,
    totalTilesTravelled: afterMarkets.totalTilesTravelled,
    totalTransportRevenueCents,
    purchaseFailuresByCause,
    averageTransportFeeCents: transportTrips === 0 ? 0 : totalTransportRevenueCents / transportTrips,
    transportRevenueByIndustryCents: Object.fromEntries(
      DEFAULT_INDUSTRIES.filter(({ id }) => id !== 'transport').map(({ id }) => [
        id,
        state.households.reduce(
          (sum, household) =>
            sum + (household.spatialPurchasesToday[id as Exclude<IndustryId, 'transport'>]?.transportFeeCents ?? 0),
          0,
        ),
      ]),
    ),
    totalWagesPaidCents: state.firms.reduce((sum, firm) => sum + firm.wagesPaidTodayCents, 0),
    totalContractualPayrollCents: state.firms.reduce((sum, firm) => sum + firm.contractualPayrollTodayCents, 0),
    totalUnpaidWagesCents: state.firms.reduce((sum, firm) => sum + firm.unpaidWagesTodayCents, 0),
    payrollFulfillmentRate:
      state.firms.reduce((sum, firm) => sum + firm.wagesPaidTodayCents, 0) /
      state.firms.reduce((sum, firm) => sum + firm.contractualPayrollTodayCents, 0),
    totalResidualFirmProfitCents: state.firms.reduce((sum, firm) => sum + firm.residualProfitTodayCents, 0),
    totalCorporateProfitTaxCents: state.government.corporateTaxCollectedTodayCents,
    meanDailyWageCents:
      state.households.reduce((sum, household) => sum + household.wageTodayCents, 0) / state.households.length,
    wageIncomeGini: summarizeCashDistribution(state.households.map(({ wageTodayCents }) => wageTodayCents)).gini,
    householdSpendingCents: state.households.reduce((sum, household) => sum + household.spendingTodayCents, 0),
    preFiscalCashGini: preFiscalDistribution.gini,
    postFiscalCashGini: endingDistribution.gini,
    giniReduction: preFiscalDistribution.gini - endingDistribution.gini,
    incumbentWealthTaxRateBps: state.government.incumbentWealthTaxRateBps,
    appliedWealthTaxRateBps: state.government.appliedWealthTaxRateBps,
    governmentPolicyStatus: state.government.policyStatus,
    governmentExperimentType: state.government.experimentType,
    totalWealthTaxCollectedCents: state.government.wealthTaxCollectedTodayCents,
    totalGovernmentReceiptsCents: state.government.totalReceiptsTodayCents,
    totalMeansTestedTransfersCents: state.government.redistributedTodayCents,
    householdsPayingWealthTax: state.government.householdsPayingTax,
    householdsReceivingTransfers: state.government.householdsReceivingTransfers,
    meanTransferCents: state.government.meanTransferCents,
    maximumTransferCents: state.government.maximumTransferCents,
    governmentPolicyMode: state.government.policyMode,
    effectiveEquality: fiscal.effectiveEquality,
    postFiscalCashRangeCents: fiscal.postFiscalCashRangeCents,
  }
}

/** Records the day's metrics within the bounded history, checks every invariant, and closes the event ledger. */
function closeDay(state: SimulationState, metric: DayMetrics) {
  state.metrics.push(metric)
  if (state.metrics.length > MAX_HISTORY) state.metrics.shift()
  validateState(state, true)
  pushEvent(
    state,
    'DAY_ENDED',
    `Day ${state.day} ended with exactly ${dollars(metric.totalMoneyCents)} in the closed circuit.`,
  )
  trimEvents(state)
}

export function runDays(state: SimulationState, days: number) {
  let result = state
  for (let index = 0; index < days; index += 1) result = stepSimulation(result)
  return result
}
