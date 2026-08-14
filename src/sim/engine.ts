import { countAffordableAtPrice, summarizeCashDistribution } from './analytics'
import { DEFAULT_CONFIG, DEFAULT_DAILY_EXPENDITURE_BUDGET_CENTS, DEFAULT_FIRM_IDS_BY_INDUSTRY, DEFAULT_GOVERNMENT_EXPERIMENT_PROBABILITY, DEFAULT_GRID_HEIGHT, DEFAULT_GRID_WIDTH, DEFAULT_INDUSTRIES, DEFAULT_INDUSTRY_BUDGET_SHARES_BPS, DEFAULT_LABOR_PRODUCTIVITY, DEFAULT_PROBE_PROBABILITY, DEFAULT_SEED, DEFAULT_TRANSPORT_COST_PER_TILE_CENTS, HOUSEHOLD_COUNT, INITIAL_HOUSEHOLD_CASH_CENTS, MAX_EVENTS, MAX_HISTORY, deriveIndustryBudgetCents } from './config'
import { assignEmployment, deriveEmploymentSeed, payrollOrder } from './employment'
import { chooseGovernmentExperiment, collectWealthTax, compareGovernmentPolicies, deriveGovernmentPolicySeed, householdCashGini, redistributeByWaterFilling } from './government'
import { totalMoney, validateState } from './invariants'
import { buildPriceExperimentCatalog, createPricingState, decideTomorrowPrice, type PriceExperimentCandidate } from './pricingStrategy'
import { normalizeSeed, probabilityCheck, randomInt, seededShuffle } from './rng'
import { deriveSpatialSeed, generateSpatialLayout, transportQuote } from './spatial'
import type { DayMetrics, Firm, IndustryId, MarketMetrics, SimulationConfig, SimulationEvent, SimulationEventType, SimulationState } from './types'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

function pushEvent(state: SimulationState, type: SimulationEventType, description: string, details: Partial<SimulationEvent> = {}) {
  state.events.push({ id: state.nextEventId++, day: state.day, type, description, ...details })
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS)
}

function safeProcessingOrder(config: SimulationConfig): IndustryId[] {
  const defaults = DEFAULT_INDUSTRIES.map(({ id }) => id)
  const proposed = config.industryProcessingOrder
  return proposed?.length === defaults.length && new Set(proposed).size === defaults.length && defaults.every((id) => proposed.includes(id)) ? [...proposed] : defaults
}

export function createSimulation(config: Partial<SimulationConfig> = DEFAULT_CONFIG): SimulationState {
  const safeConfig: SimulationConfig = {
    startingPriceCents: Math.max(1, Math.round(config.startingPriceCents ?? DEFAULT_CONFIG.startingPriceCents)),
    initialStepCents: Math.max(1, Math.round(config.initialStepCents ?? DEFAULT_CONFIG.initialStepCents)),
    laborProductivityUnitsPerWorker: Math.max(0, Math.round(config.laborProductivityUnitsPerWorker ?? DEFAULT_LABOR_PRODUCTIVITY)),
    firmTaxRateBps: 0,
    householdParityEnabled: false,
    adaptiveGovernmentEnabled: config.adaptiveGovernmentEnabled ?? true,
    governmentExperimentProbability: Math.max(0, Math.min(1, config.governmentExperimentProbability ?? DEFAULT_GOVERNMENT_EXPERIMENT_PROBABILITY)),
    industryStartingPricesCents: config.industryStartingPricesCents,
    firmStartingPricesCents: config.firmStartingPricesCents,
    industryProcessingOrder: safeProcessingOrder(config as SimulationConfig),
    seed: normalizeSeed(config.seed ?? DEFAULT_SEED),
    probeProbability: Math.max(0, Math.min(1, config.probeProbability ?? DEFAULT_PROBE_PROBABILITY)),
    gridWidth: Math.max(1, Math.round(config.gridWidth ?? DEFAULT_GRID_WIDTH)),
    gridHeight: Math.max(1, Math.round(config.gridHeight ?? DEFAULT_GRID_HEIGHT)),
    transportCostPerTileCents: Math.max(0, Math.round(config.transportCostPerTileCents ?? DEFAULT_TRANSPORT_COST_PER_TILE_CENTS)),
    targetHouseholdCashCents: Math.max(0, Math.round(config.targetHouseholdCashCents ?? INITIAL_HOUSEHOLD_CASH_CENTS)),
    dailyExpenditureBudgetCents: Math.max(0, Math.round(config.dailyExpenditureBudgetCents ?? DEFAULT_DAILY_EXPENDITURE_BUDGET_CENTS)),
    industryBudgetSharesBps: Object.fromEntries(Object.entries(DEFAULT_INDUSTRY_BUDGET_SHARES_BPS).map(([id, defaultBps]) => [id, Math.max(0, Math.min(10_000, Math.round(config.industryBudgetSharesBps?.[id as keyof typeof DEFAULT_INDUSTRY_BUDGET_SHARES_BPS] ?? defaultBps)))])),
  }
  const industries = DEFAULT_INDUSTRIES.map((industry) => industry.id === 'transport' ? { ...industry } : { ...industry, budgetShareBps: safeConfig.industryBudgetSharesBps![industry.id], householdBudgetCents: deriveIndustryBudgetCents(safeConfig.dailyExpenditureBudgetCents!, safeConfig.industryBudgetSharesBps![industry.id]!) })
  const consumerFirmIds = DEFAULT_INDUSTRIES.filter(({ id }) => id !== 'transport').flatMap(({ id }) => DEFAULT_FIRM_IDS_BY_INDUSTRY[id])
  const spatialIds = [...Array.from({ length: HOUSEHOLD_COUNT }, (_, index) => `household-${index + 1}`), ...consumerFirmIds]
  const layout = generateSpatialLayout(safeConfig.seed!, safeConfig.gridWidth!, safeConfig.gridHeight!, spatialIds)
  const householdIds = Array.from({ length: HOUSEHOLD_COUNT }, (_, index) => `household-${index + 1}`)
  const employment = assignEmployment(safeConfig.seed!, householdIds, [...consumerFirmIds, 'firm-transport'])
  const firms: Firm[] = industries.flatMap((industry) => DEFAULT_FIRM_IDS_BY_INDUSTRY[industry.id].map((firmId) => {
    const price = Math.max(1, Math.round(safeConfig.firmStartingPricesCents?.[firmId] ?? safeConfig.industryStartingPricesCents?.[industry.id] ?? safeConfig.startingPriceCents))
    return {
      id: firmId, industryId: industry.id, cashCents: 0, postedPriceCents: price,
      unitsSoldToday: 0, revenueTodayCents: 0, preTaxProfitTodayCents: 0, availableUnitsToday: 0,
      unitsExpiredToday: 0, soldOutToday: false, pricing: createPricingState(price, safeConfig.initialStepCents),
      latestDecisionReason: industry.id === 'transport' ? 'Transport charges the configured exogenous per-tile rate.' : 'The first price is set by the run configuration.', latestDecisionAction: 'hold',
      coordinate: layout[firmId],
      employeeIds: householdIds.filter((id) => employment[id] === firmId), productivityPerWorker: industry.id === 'transport' ? null : safeConfig.laborProductivityUnitsPerWorker!,
      unitsProducedToday: 0, wagePoolTodayCents: 0, wagesPaidTodayCents: 0, meanWageTodayCents: 0,
    }
  }))
  const state: SimulationState = {
    day: 0,
    config: safeConfig,
    industries,
    households: Array.from({ length: HOUSEHOLD_COUNT }, (_, index) => ({
      id: `household-${index + 1}`,
      cashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      coordinate: layout[`household-${index + 1}`],
      entertainmentToday: null,
      spatialPurchasesToday: {},
      employerFirmId: employment[`household-${index + 1}`], wageTodayCents: 0, cumulativeWagesCents: 0, spendingTodayCents: 0, netCashChangeTodayCents: 0,
      preTaxCashCents: INITIAL_HOUSEHOLD_CASH_CENTS, taxPaidTodayCents: 0, transferReceivedTodayCents: 0, netFiscalTransferTodayCents: 0, postFiscalCashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      cumulativeTaxPaidCents: 0, cumulativeTransfersReceivedCents: 0, cumulativeNetFiscalPositionCents: 0,
      industryOutcomes: Object.fromEntries(industries.map(({ id, householdBudgetCents }) => [id, {
        budgetCents: householdBudgetCents, purchasedToday: false, spentTodayCents: 0, purchaseOutcomeToday: null,
        lifetimeUnitsPurchased: 0, lifetimeStockoutFailures: 0, lifetimeAffordabilityFailures: 0,
      }])) as SimulationState['households'][number]['industryOutcomes'],
    })),
    firms,
    government: { id: 'government-1', cashCents: 0, taxCollectedTodayCents: 0, redistributedTodayCents: 0, incumbentWealthTaxRateBps: 0, appliedWealthTaxRateBps: 0, policyStatus: 'incumbent', incumbentReferenceGini: null, experimentRateBps: null, experimentType: null, lastExperimentOutcome: null, lastReferenceGini: null, lastExperimentalGini: null, preFiscalCashGini: 0, postFiscalCashGini: 0, giniReduction: 0, householdsPayingTax: 0, householdsReceivingTransfers: 0, meanTransferCents: 0, maximumTransferCents: 0 },
    metrics: [], events: [], nextEventId: 1, rngState: normalizeSeed(safeConfig.seed ?? DEFAULT_SEED), spatialSeed: deriveSpatialSeed(safeConfig.seed ?? DEFAULT_SEED), employmentSeed: deriveEmploymentSeed(safeConfig.seed ?? DEFAULT_SEED), governmentPolicyRngState: deriveGovernmentPolicySeed(safeConfig.seed ?? DEFAULT_SEED),
  }
  state.households.forEach((household) => pushEvent(state, 'EMPLOYMENT_ASSIGNED', `${household.id} was assigned to ${household.employerFirmId}.`, { actorId: household.id, householdId: household.id, counterpartyId: household.employerFirmId, firmId: household.employerFirmId }))
  validateState(state)
  return state
}

function copyStateForStep(previous: SimulationState): SimulationState {
  return {
    ...previous,
    households: previous.households.map((household) => ({
      ...household,
      coordinate: household.coordinate,
      entertainmentToday: household.entertainmentToday ? { ...household.entertainmentToday } : null,
      spatialPurchasesToday: Object.fromEntries(Object.entries(household.spatialPurchasesToday).map(([id, outcome]) => [id, { ...outcome }])) as typeof household.spatialPurchasesToday,
      industryOutcomes: Object.fromEntries(Object.entries(household.industryOutcomes).map(([industryId, outcome]) => [industryId, { ...outcome }])) as typeof household.industryOutcomes,
    })),
    firms: previous.firms.map((firm) => ({ ...firm, coordinate: firm.coordinate, pricing: { ...firm.pricing } })),
    government: { ...previous.government },
    metrics: [...previous.metrics],
    events: [...previous.events],
  }
}

export function stepSimulation(previous: SimulationState): SimulationState {
  const state = copyStateForStep(previous)
  state.day += 1
  state.government.taxCollectedTodayCents = 0
  state.government.redistributedTodayCents = 0
  Object.assign(state.government, { policyStatus: 'incumbent', appliedWealthTaxRateBps: state.government.incumbentWealthTaxRateBps, experimentRateBps: null, experimentType: null, householdsPayingTax: 0, householdsReceivingTransfers: 0, meanTransferCents: 0, maximumTransferCents: 0 })
  state.firms.forEach((firm) => {
    const produced = firm.industryId === 'transport' ? 0 : firm.employeeIds.length * state.config.laborProductivityUnitsPerWorker!
    Object.assign(firm, { unitsSoldToday: 0, revenueTodayCents: 0, preTaxProfitTodayCents: 0, unitsProducedToday: produced, availableUnitsToday: produced, unitsExpiredToday: 0, soldOutToday: false, wagePoolTodayCents: 0, wagesPaidTodayCents: 0, meanWageTodayCents: 0 })
  })
  state.households.forEach((household) => Object.values(household.industryOutcomes).forEach((outcome) => {
    Object.assign(outcome, { purchasedToday: false, spentTodayCents: 0, purchaseOutcomeToday: null })
  }))
  state.households.forEach((household) => { household.entertainmentToday = null })
  state.households.forEach((household) => { household.spatialPurchasesToday = {} })
  state.households.forEach((household) => { household.wageTodayCents = 0; household.spendingTodayCents = 0; household.netCashChangeTodayCents = 0; household.taxPaidTodayCents = 0; household.transferReceivedTodayCents = 0; household.netFiscalTransferTodayCents = 0 })

  const openingDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  pushEvent(state, 'DAY_STARTED', `Day ${state.day} began.`)
  state.firms.filter(({ industryId }) => industryId !== 'transport').forEach((firm) => pushEvent(state, 'FIRM_PRODUCED', `${firm.id} produced ${firm.unitsProducedToday} units from ${firm.employeeIds.length} worker × ${firm.productivityPerWorker} productivity.`, { actorId: firm.id, firmId: firm.id, industryId: firm.industryId, quantity: firm.unitsProducedToday, workerCount: firm.employeeIds.length, productivityPerWorker: firm.productivityPerWorker!, unitsProduced: firm.unitsProducedToday }))
  const marketMetrics: MarketMetrics[] = []

  for (const industryId of state.config.industryProcessingOrder ?? safeProcessingOrder(state.config)) {
    if (industryId === 'transport') continue
    const industry = state.industries.find(({ id }) => id === industryId)!
    const industryFirms = state.firms.filter((candidate) => candidate.industryId === industryId).sort((left, right) => left.id.localeCompare(right.id))
    const advertisedPrices = new Map(industryFirms.map((firm) => [firm.id, firm.postedPriceCents]))
    const minimumPostedPrice = Math.min(...industryFirms.map(({ postedPriceCents }) => postedPriceCents))
    const shuffled = seededShuffle(state.households, state.rngState)
    state.rngState = shuffled.state
    let purchasingOrder = shuffled.values
    {
      const priority = purchasingOrder.map((household) => {
        const ranked = industryFirms.map((firm) => ({ firm, ...transportQuote(household.coordinate, firm.coordinate!, state.config.transportCostPerTileCents!) }))
          .sort((left, right) => (left.firm.postedPriceCents + left.transportFeeCents) - (right.firm.postedPriceCents + right.transportFeeCents))
        const lowest = ranked[0].firm.postedPriceCents + ranked[0].transportFeeCents
        const tied = ranked.filter((item) => item.firm.postedPriceCents + item.transportFeeCents === lowest)
        const draw = randomInt(state.rngState, tied.length); state.rngState = draw.state
        const preferred = tied[draw.value]
        const tie = randomInt(state.rngState, 0x7fff_ffff); state.rngState = tie.state
        return { household, preferredFirmId: preferred.firm.id, distance: preferred.oneWayDistance, tie: tie.value }
      })
      const primary: typeof priority = []
      const fallback: typeof priority = []
      for (const firm of industryFirms) {
        const queue = priority.filter(({ preferredFirmId }) => preferredFirmId === firm.id).sort((left, right) => left.distance - right.distance || left.tie - right.tie)
        primary.push(...queue.slice(0, firm.availableUnitsToday))
        fallback.push(...queue.slice(firm.availableUnitsToday))
      }
      fallback.sort((left, right) => {
        const leftAlternative = industryFirms.find((firm) => firm.id !== left.preferredFirmId)!
        const rightAlternative = industryFirms.find((firm) => firm.id !== right.preferredFirmId)!
        return transportQuote(left.household.coordinate, leftAlternative.coordinate!, 0).oneWayDistance - transportQuote(right.household.coordinate, rightAlternative.coordinate!, 0).oneWayDistance || left.tie - right.tie
      })
      purchasingOrder = [...primary, ...fallback].map(({ household }) => household)
    }
    const affordableAtOpen = countAffordableAtPrice(state.households.map((household) => Math.min(household.cashCents, household.industryOutcomes[industryId].budgetCents)), minimumPostedPrice)
    for (const firm of industryFirms) {
      pushEvent(state, 'PRICE_POSTED', `${firm.id} posted ${dollars(firm.postedPriceCents)} in ${industry.name}.`, { actorId: firm.id, firmId: firm.id, industryId, priceCents: firm.postedPriceCents })
    }

    for (const household of purchasingOrder) {
      const outcome = household.industryOutcomes[industryId]
      const quote = (firm: Firm) => transportQuote(household.coordinate, firm.coordinate!, state.config.transportCostPerTileCents!)
      const delivered = (firm: Firm) => firm.postedPriceCents + quote(firm).transportFeeCents
      household.spatialPurchasesToday[industryId] = {
        chosenFirmId: null,
        distanceToA: quote(industryFirms[0]).oneWayDistance,
        distanceToB: quote(industryFirms[1]).oneWayDistance,
        chosenOneWayDistance: null, roundTripTiles: 0, productPriceCents: 0, transportFeeCents: 0, deliveredCostCents: 0,
      }
      const affordable = industryFirms.filter((firm) => delivered(firm) <= outcome.budgetCents && delivered(firm) <= household.cashCents)
      const available = affordable.filter((firm) => firm.availableUnitsToday > 0)
      if (affordable.length === 0) {
        outcome.purchaseOutcomeToday = 'insufficient_funds'; outcome.lifetimeAffordabilityFailures += 1
        const minimumDeliveredCostCents = Math.min(...industryFirms.map(delivered))
        pushEvent(state, 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS', `${household.id} could not afford any ${industry.name} firm within its category limit and actual cash.`, { actorId: household.id, householdId: household.id, industryId, priceCents: minimumPostedPrice, householdCashAvailableCents: household.cashCents, categoryBudgetCents: outcome.budgetCents, minimumDeliveredCostCents })
      } else if (available.length === 0) {
        outcome.purchaseOutcomeToday = 'stockout'; outcome.lifetimeStockoutFailures += 1
        pushEvent(state, 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT', `${household.id} could afford ${industry.name}, but no affordable firm had stock.`, { actorId: household.id, householdId: household.id, industryId, priceCents: minimumPostedPrice })
      } else {
        const cheapestPrice = Math.min(...available.map((firm) => delivered(firm)))
        const tied = available.filter((firm) => delivered(firm) === cheapestPrice)
        const selection = randomInt(state.rngState, tied.length)
        state.rngState = selection.state
        const firm = tied[selection.value]
        const price = firm.postedPriceCents
        const travel = quote(firm)
        const total = price + travel.transportFeeCents
        const details = { actorId: household.id, counterpartyId: firm.id, householdId: household.id, firmId: firm.id, industryId, priceCents: price, oneWayDistance: travel.oneWayDistance, roundTripTiles: travel.roundTripTiles, transportFeeCents: travel.transportFeeCents, deliveredCostCents: total }
        household.cashCents -= total; household.spendingTodayCents += total; firm.cashCents += price; firm.availableUnitsToday -= 1; firm.unitsSoldToday += 1
        {
          const transportFirm = state.firms.find(({ industryId: id }) => id === 'transport')!
          transportFirm.cashCents += travel.transportFeeCents
          transportFirm.unitsSoldToday += 1
          transportFirm.revenueTodayCents += travel.transportFeeCents
          transportFirm.preTaxProfitTodayCents += travel.transportFeeCents
          const spatialResult = { chosenFirmId: firm.id, distanceToA: transportQuote(household.coordinate, industryFirms[0].coordinate!, 0).oneWayDistance, distanceToB: transportQuote(household.coordinate, industryFirms[1].coordinate!, 0).oneWayDistance, chosenOneWayDistance: travel.oneWayDistance, roundTripTiles: travel.roundTripTiles, productPriceCents: price, transportFeeCents: travel.transportFeeCents, deliveredCostCents: total }
          household.spatialPurchasesToday[industryId] = spatialResult
          if (industryId === 'entertainment') household.entertainmentToday = spatialResult
          pushEvent(state, 'TRANSPORT_SERVICE_PURCHASED', `${household.id} paid ${dollars(travel.transportFeeCents)} to Transport for ${travel.roundTripTiles} tiles of Entertainment travel.`, { ...details, counterpartyId: transportFirm.id, firmId: transportFirm.id, amountCents: travel.transportFeeCents, quantity: travel.roundTripTiles })
        }
        Object.assign(outcome, { purchasedToday: true, spentTodayCents: total, purchaseOutcomeToday: 'purchased' }); outcome.lifetimeUnitsPurchased += 1
        pushEvent(state, 'HOUSEHOLD_PURCHASE', `${household.id} purchased ${industry.name} from ${firm.id} for ${dollars(price)} (${dollars(total)} delivered).`, { ...details, amountCents: price, quantity: 1 })
      }
    }

    const totalIndustryUnitsSold = industryFirms.reduce((sum, firm) => sum + firm.unitsSoldToday, 0)
    for (const firm of industryFirms) {
      const testedPrice = firm.postedPriceCents
      firm.unitsExpiredToday = firm.availableUnitsToday; firm.availableUnitsToday = 0
      firm.soldOutToday = firm.unitsSoldToday === firm.unitsProducedToday
      pushEvent(state, 'GOODS_EXPIRED', `${firm.unitsExpiredToday} unsold ${industry.name.toLowerCase()} units expired at ${firm.id}.`, { actorId: firm.id, firmId: firm.id, industryId, quantity: firm.unitsExpiredToday })
      const revenue = firm.unitsSoldToday * testedPrice
      if (firm.cashCents !== revenue) throw new Error(`${firm.id} cash does not equal today's zero-cost revenue`)
      firm.revenueTodayCents = revenue; firm.preTaxProfitTodayCents = revenue
      pushEvent(state, 'FIRM_DAY_RESULT', `${firm.id} sold ${firm.unitsSoldToday}/${firm.unitsProducedToday} produced units and realised ${dollars(revenue)} operating earnings.`, { actorId: firm.id, firmId: firm.id, industryId, amountCents: revenue, quantity: firm.unitsSoldToday })
      let shouldProbe = false
      let probeDirection: 'up' | 'down' = 'up'
      let experimentCandidate: PriceExperimentCandidate | undefined
      if (firm.pricing.locallySettled && !firm.pricing.probing) {
        const probeDraw = probabilityCheck(state.rngState, state.config.probeProbability ?? DEFAULT_PROBE_PROBABILITY)
        state.rngState = probeDraw.state
        shouldProbe = probeDraw.value
        if (shouldProbe) {
          const competitor = industryFirms.length > 1 ? industryFirms.find(({ id }) => id !== firm.id) : undefined
          const catalog = buildPriceExperimentCatalog(firm.pricing.incumbentPriceCents, competitor ? advertisedPrices.get(competitor.id) : undefined, firm.soldOutToday)
          if (catalog.length > 0) {
            const candidateDraw = randomInt(state.rngState, catalog.length)
            state.rngState = candidateDraw.state
            experimentCandidate = catalog[candidateDraw.value]
            probeDirection = experimentCandidate.priceCents >= firm.pricing.incumbentPriceCents ? 'up' : 'down'
          } else shouldProbe = false
        }
      }
      const priorPricing = firm.pricing
      const decision = decideTomorrowPrice(firm.pricing, testedPrice, firm.unitsSoldToday, revenue, { shouldProbe, direction: probeDirection, candidate: experimentCandidate })
      firm.pricing = decision.state; firm.latestDecisionReason = decision.reason; firm.latestDecisionAction = decision.action; firm.postedPriceCents = decision.nextPriceCents
      pushEvent(state, 'FIRM_PRICE_DECISION', `${firm.id} will post ${dollars(decision.nextPriceCents)} tomorrow. ${decision.reason}`, { actorId: firm.id, firmId: firm.id, industryId, priceCents: decision.nextPriceCents })
      if (decision.justConverged) pushEvent(state, 'PRICE_DISCOVERY_CONVERGED', `${firm.id} became locally settled at ${dollars(firm.pricing.incumbentPriceCents)}.`, { actorId: firm.id, firmId: firm.id, industryId, priceCents: firm.pricing.incumbentPriceCents })
      if (decision.probeEvent) {
        const type = decision.probeEvent === 'started' ? 'PRICE_PROBE_STARTED' : decision.probeEvent === 'adopted' ? 'PRICE_PROBE_ADOPTED' : 'PRICE_PROBE_REJECTED'
        pushEvent(state, type, `${firm.id}: ${decision.reason}`, { actorId: firm.id, firmId: firm.id, industryId, priceCents: decision.nextPriceCents })
        const experimentType = decision.probeEvent === 'started' ? decision.state.experimentType : priorPricing.experimentType
        const competitorPriceObservedCents = decision.probeEvent === 'started' ? decision.state.competitorPriceObservedCents : priorPricing.competitorPriceObservedCents
        const experimentEventType = decision.probeEvent === 'started' ? 'PRICE_EXPERIMENT_STARTED' : decision.probeEvent === 'adopted' ? 'PRICE_EXPERIMENT_ADOPTED' : 'PRICE_EXPERIMENT_REJECTED'
        const describedExperimentPrice = decision.probeEvent === 'started' ? decision.nextPriceCents : testedPrice
        pushEvent(state, experimentEventType, `${firm.id} ${decision.probeEvent} ${experimentType ?? 'price'} experiment at ${dollars(describedExperimentPrice)}.`, {
          actorId: firm.id, firmId: firm.id, industryId, incumbentPriceCents: priorPricing.incumbentPriceCents,
          experimentalPriceCents: decision.probeEvent === 'started' ? decision.nextPriceCents : testedPrice,
          experimentType: experimentType ?? undefined, competitorPriceObservedCents: competitorPriceObservedCents ?? undefined,
          referenceProfitCents: decision.probeEvent === 'started' ? revenue : priorPricing.incumbentProfitCents,
          experimentalProfitCents: decision.probeEvent === 'started' ? undefined : revenue,
        })
      }
      marketMetrics.push({
        industryId, firmId: firm.id, postedPriceCents: testedPrice, nextPriceCents: decision.nextPriceCents,
        bestKnownPriceCents: firm.pricing.bestPriceCents, priceStepSizeCents: firm.pricing.stepSizeCents, searchDirection: firm.pricing.direction,
        unitsSold: firm.unitsSoldToday, unitsSupplied: firm.unitsProducedToday, unitsProduced: firm.unitsProducedToday, unitsExpired: firm.unitsExpiredToday,
        stockoutFailures: state.households.filter((h) => h.industryOutcomes[industryId].purchaseOutcomeToday === 'stockout').length,
        affordabilityFailures: state.households.filter((h) => h.industryOutcomes[industryId].purchaseOutcomeToday === 'insufficient_funds').length,
        soldOut: firm.soldOutToday, householdsAffordableAtMarketOpen: affordableAtOpen, revenueCents: revenue, preTaxProfitCents: revenue, converged: firm.pricing.converged,
        locallySettled: firm.pricing.locallySettled, probing: firm.pricing.probing, incumbentPriceCents: firm.pricing.incumbentPriceCents,
        marketShare: totalIndustryUnitsSold === 0 ? 0 : firm.unitsSoldToday / totalIndustryUnitsSold,
        totalIndustryUnitsSold, transactionPricesCents: firm.unitsSoldToday > 0 ? [testedPrice] : [],
        averageCustomerDistance: firm.unitsSoldToday > 0
          ? state.households.filter((household) => household.spatialPurchasesToday[industryId]?.chosenFirmId === firm.id).reduce((sum, household) => sum + household.spatialPurchasesToday[industryId]!.chosenOneWayDistance!, 0) / firm.unitsSoldToday
          : 0,
        averageDeliveredCostCents: firm.unitsSoldToday > 0 ? state.households.filter((household) => household.spatialPurchasesToday[industryId]?.chosenFirmId === firm.id).reduce((sum, household) => sum + household.spatialPurchasesToday[industryId]!.deliveredCostCents, 0) / firm.unitsSoldToday : 0,
        averageTransportFeeCents: firm.unitsSoldToday > 0 ? state.households.filter((household) => household.spatialPurchasesToday[industryId]?.chosenFirmId === firm.id).reduce((sum, household) => sum + household.spatialPurchasesToday[industryId]!.transportFeeCents, 0) / firm.unitsSoldToday : 0,
      })
    }
  }

  const transportFirm = state.firms.find(({ industryId }) => industryId === 'transport')!
  const entertainmentTrips = transportFirm.unitsSoldToday
  const totalTilesTravelled = state.households.reduce((sum, household) => sum + Object.values(household.spatialPurchasesToday).reduce((subtotal, purchase) => subtotal + (purchase?.roundTripTiles ?? 0), 0), 0)
  const totalTransportRevenueCents = transportFirm.cashCents
  const totalFirmCashBeforeTax = state.firms.reduce((sum, firm) => sum + firm.cashCents, 0)
  const beforeParityDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  for (const firm of state.firms) {
    const pool = firm.cashCents
    firm.wagePoolTodayCents = pool
    const ordered = payrollOrder(state.config.seed!, state.day, firm.id, firm.employeeIds)
    const baseWage = Math.floor(pool / ordered.length)
    const remainder = pool % ordered.length
    ordered.forEach((householdId, index) => {
      const wage = baseWage + (index < remainder ? 1 : 0)
      const household = state.households.find(({ id }) => id === householdId)!
      firm.cashCents -= wage; household.cashCents += wage; household.wageTodayCents += wage; household.cumulativeWagesCents += wage
      pushEvent(state, 'WAGE_PAID', `${firm.id} paid ${dollars(wage)} to ${household.id}.`, { actorId: firm.id, counterpartyId: household.id, firmId: firm.id, householdId: household.id, industryId: firm.industryId, amountCents: wage, wageCents: wage, employerDailyRevenue: pool, employeeCount: ordered.length })
    })
    firm.wagesPaidTodayCents = pool; firm.meanWageTodayCents = pool / ordered.length
  }
  state.households.forEach((household) => { household.netCashChangeTodayCents = household.wageTodayCents - household.spendingTodayCents })
  const preFiscalDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  state.government.preFiscalCashGini = preFiscalDistribution.gini
  if (state.config.adaptiveGovernmentEnabled && state.government.incumbentReferenceGini !== null) {
    const experimentDraw = probabilityCheck(state.governmentPolicyRngState, state.config.governmentExperimentProbability!); state.governmentPolicyRngState = experimentDraw.state
    if (experimentDraw.value) {
      const selection = chooseGovernmentExperiment(state.government.incumbentWealthTaxRateBps, state.governmentPolicyRngState); state.governmentPolicyRngState = selection.rngState
      Object.assign(state.government, { policyStatus: 'experiment', appliedWealthTaxRateBps: selection.candidate.rateBps, experimentRateBps: selection.candidate.rateBps, experimentType: selection.candidate.type })
      pushEvent(state, 'GOVERNMENT_POLICY_EXPERIMENT_STARTED', `Government started ${selection.candidate.type} at ${(selection.candidate.rateBps / 100).toFixed(2)}%.`, { actorId: state.government.id, taxRateBps: selection.candidate.rateBps, incumbentTaxRateBps: state.government.incumbentWealthTaxRateBps, governmentExperimentType: selection.candidate.type, preFiscalGini: preFiscalDistribution.gini, referenceGini: state.government.incumbentReferenceGini })
    }
  }
  if (!state.config.adaptiveGovernmentEnabled) state.government.appliedWealthTaxRateBps = 0
  collectWealthTax(state.households, state.government, state.government.appliedWealthTaxRateBps)
  for (const household of state.households.filter(({ taxPaidTodayCents }) => taxPaidTodayCents > 0)) pushEvent(state, 'WEALTH_TAX_PAID', `${household.id} paid ${dollars(household.taxPaidTodayCents)} wealth tax.`, { actorId: household.id, counterpartyId: state.government.id, householdId: household.id, amountCents: household.taxPaidTodayCents, taxCents: household.taxPaidTodayCents, taxRateBps: state.government.appliedWealthTaxRateBps, preFiscalGini: preFiscalDistribution.gini })
  const governmentCashBeforeRedistribution = state.government.cashCents
  const redistribution = redistributeByWaterFilling(state.households, state.government, state.governmentPolicyRngState); state.governmentPolicyRngState = redistribution.rngState
  for (const household of state.households.filter(({ transferReceivedTodayCents }) => transferReceivedTodayCents > 0)) pushEvent(state, 'MEANS_TESTED_TRANSFER_PAID', `Government paid ${dollars(household.transferReceivedTodayCents)} to ${household.id}.`, { actorId: state.government.id, counterpartyId: household.id, householdId: household.id, amountCents: household.transferReceivedTodayCents, transferCents: household.transferReceivedTodayCents, taxRateBps: state.government.appliedWealthTaxRateBps, preFiscalGini: preFiscalDistribution.gini })
  const postFiscalGini = householdCashGini(state.households)
  state.households.forEach((household) => { household.netCashChangeTodayCents = household.wageTodayCents - household.spendingTodayCents + household.netFiscalTransferTodayCents })
  const householdsPayingTax = state.households.filter(({ taxPaidTodayCents }) => taxPaidTodayCents > 0).length
  const householdsReceivingTransfers = state.households.filter(({ transferReceivedTodayCents }) => transferReceivedTodayCents > 0).length
  Object.assign(state.government, { postFiscalCashGini: postFiscalGini, giniReduction: preFiscalDistribution.gini - postFiscalGini, householdsPayingTax, householdsReceivingTransfers, meanTransferCents: householdsReceivingTransfers ? state.government.redistributedTodayCents / householdsReceivingTransfers : 0, maximumTransferCents: Math.max(...state.households.map(({ transferReceivedTodayCents }) => transferReceivedTodayCents)) })
  if (state.government.policyStatus === 'experiment') {
    const reference = state.government.incumbentReferenceGini!
    const adopted = compareGovernmentPolicies(postFiscalGini, state.government.appliedWealthTaxRateBps, reference, state.government.incumbentWealthTaxRateBps)
    state.government.lastReferenceGini = reference; state.government.lastExperimentalGini = postFiscalGini; state.government.lastExperimentOutcome = adopted ? 'adopted' : 'rejected'
    const eventType = adopted ? 'GOVERNMENT_POLICY_EXPERIMENT_ADOPTED' : 'GOVERNMENT_POLICY_EXPERIMENT_REJECTED'
    pushEvent(state, eventType, `Government ${adopted ? 'adopted' : 'rejected'} ${state.government.experimentType} at ${(state.government.appliedWealthTaxRateBps / 100).toFixed(2)}%.`, { actorId: state.government.id, taxRateBps: state.government.appliedWealthTaxRateBps, incumbentTaxRateBps: state.government.incumbentWealthTaxRateBps, governmentExperimentType: state.government.experimentType!, preFiscalGini: preFiscalDistribution.gini, postFiscalGini, referenceGini: reference })
    if (adopted) { state.government.incumbentWealthTaxRateBps = state.government.appliedWealthTaxRateBps; state.government.incumbentReferenceGini = postFiscalGini }
  } else state.government.incumbentReferenceGini = postFiscalGini
  const endingDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  const metric: DayMetrics = {
    day: state.day, markets: marketMetrics,
    householdCashMinimumAtMarketOpenCents: openingDistribution.minimumCents, householdCashMedianAtMarketOpenCents: openingDistribution.medianCents,
    householdCashMaximumAtMarketOpenCents: openingDistribution.maximumCents, householdCashGiniAtMarketOpen: openingDistribution.gini,
    householdCashMinimumCents: endingDistribution.minimumCents, householdCashMedianCents: endingDistribution.medianCents,
    householdCashMaximumCents: endingDistribution.maximumCents, householdCashGini: endingDistribution.gini,
    householdCashGiniBeforeParity: beforeParityDistribution.gini,
    totalRevenueCents: totalFirmCashBeforeTax, totalPreTaxProfitCents: totalFirmCashBeforeTax,
    totalHouseholdCashCents: state.households.reduce((sum, household) => sum + household.cashCents, 0), totalFirmCashBeforeTaxCents: totalFirmCashBeforeTax,
    totalFirmCashAfterTaxCents: state.firms.reduce((sum, firm) => sum + firm.cashCents, 0), governmentCashBeforeRedistributionCents: governmentCashBeforeRedistribution,
    governmentCashAfterRedistributionCents: state.government.cashCents, totalMoneyCents: totalMoney(state), allFirmsConverged: state.firms.every((firm) => firm.pricing.converged),
    allFirmsLocallySettled: state.firms.filter((firm) => firm.industryId !== 'transport').every((firm) => firm.pricing.locallySettled),
    entertainmentTrips, totalTilesTravelled, totalTransportRevenueCents,
    averageTransportFeeCents: entertainmentTrips === 0 ? 0 : totalTransportRevenueCents / entertainmentTrips,
    transportRevenueByIndustryCents: Object.fromEntries(DEFAULT_INDUSTRIES.filter(({ id }) => id !== 'transport').map(({ id }) => [id, state.households.reduce((sum, household) => sum + (household.spatialPurchasesToday[id as Exclude<IndustryId, 'transport'>]?.transportFeeCents ?? 0), 0)])),
    totalWagesPaidCents: state.firms.reduce((sum, firm) => sum + firm.wagesPaidTodayCents, 0),
    meanDailyWageCents: state.households.reduce((sum, household) => sum + household.wageTodayCents, 0) / state.households.length,
    wageIncomeGini: summarizeCashDistribution(state.households.map(({ wageTodayCents }) => wageTodayCents)).gini,
    householdSpendingCents: state.households.reduce((sum, household) => sum + household.spendingTodayCents, 0),
    preFiscalCashGini: preFiscalDistribution.gini, postFiscalCashGini: endingDistribution.gini, giniReduction: preFiscalDistribution.gini - endingDistribution.gini,
    incumbentWealthTaxRateBps: state.government.incumbentWealthTaxRateBps, appliedWealthTaxRateBps: state.government.appliedWealthTaxRateBps,
    governmentPolicyStatus: state.government.policyStatus, governmentExperimentType: state.government.experimentType,
    totalWealthTaxCollectedCents: state.government.taxCollectedTodayCents, totalMeansTestedTransfersCents: state.government.redistributedTodayCents,
    householdsPayingWealthTax: state.government.householdsPayingTax, householdsReceivingTransfers: state.government.householdsReceivingTransfers,
    meanTransferCents: state.government.meanTransferCents, maximumTransferCents: state.government.maximumTransferCents,
  }
  state.metrics.push(metric); if (state.metrics.length > MAX_HISTORY) state.metrics.shift()
  validateState(state, true)
  pushEvent(state, 'DAY_ENDED', `Day ${state.day} ended with exactly ${dollars(metric.totalMoneyCents)} in the closed circuit.`)
  return state
}

export function runDays(state: SimulationState, days: number) {
  let result = state
  for (let index = 0; index < days; index += 1) result = stepSimulation(result)
  return result
}
