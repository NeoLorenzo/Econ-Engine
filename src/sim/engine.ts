import { countAffordableAtPrice, summarizeCashDistribution } from './analytics'
import { DEFAULT_CONFIG, DEFAULT_FIRM_IDS_BY_INDUSTRY, DEFAULT_INDUSTRIES, DEFAULT_PROBE_PROBABILITY, DEFAULT_SEED, HOUSEHOLD_COUNT, INITIAL_HOUSEHOLD_CASH_CENTS, MAX_EVENTS, MAX_HISTORY } from './config'
import { totalMoney, validateState } from './invariants'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import { normalizeSeed, probabilityCheck, randomInt, seededShuffle } from './rng'
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

export function createSimulation(config: SimulationConfig = DEFAULT_CONFIG): SimulationState {
  const safeConfig: SimulationConfig = {
    startingPriceCents: Math.max(1, Math.round(config.startingPriceCents)),
    initialStepCents: Math.max(1, Math.round(config.initialStepCents)),
    dailySupplyPerIndustry: Math.max(0, Math.round(config.dailySupplyPerIndustry)),
    industryStartingPricesCents: config.industryStartingPricesCents,
    firmStartingPricesCents: config.firmStartingPricesCents,
    industryProcessingOrder: safeProcessingOrder(config),
    seed: normalizeSeed(config.seed ?? DEFAULT_SEED),
    probeProbability: Math.max(0, Math.min(1, config.probeProbability ?? DEFAULT_PROBE_PROBABILITY)),
  }
  const industries = structuredClone(DEFAULT_INDUSTRIES)
  const firms: Firm[] = industries.flatMap((industry) => DEFAULT_FIRM_IDS_BY_INDUSTRY[industry.id].map((firmId) => {
    const price = Math.max(1, Math.round(safeConfig.firmStartingPricesCents?.[firmId] ?? safeConfig.industryStartingPricesCents?.[industry.id] ?? safeConfig.startingPriceCents))
    return {
      id: firmId, industryId: industry.id, cashCents: 0, postedPriceCents: price,
      unitsSoldToday: 0, revenueTodayCents: 0, preTaxProfitTodayCents: 0, availableUnitsToday: 0,
      unitsExpiredToday: 0, soldOutToday: false, pricing: createPricingState(price, safeConfig.initialStepCents),
      latestDecisionReason: 'The first price is set by the run configuration.', latestDecisionAction: 'hold',
    }
  }))
  const state: SimulationState = {
    day: 0,
    config: safeConfig,
    industries,
    households: Array.from({ length: HOUSEHOLD_COUNT }, (_, index) => ({
      id: `household-${index + 1}`,
      cashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      industryOutcomes: Object.fromEntries(industries.map(({ id, householdBudgetCents }) => [id, {
        budgetCents: householdBudgetCents, purchasedToday: false, spentTodayCents: 0, purchaseOutcomeToday: null,
        lifetimeUnitsPurchased: 0, lifetimeStockoutFailures: 0, lifetimeAffordabilityFailures: 0,
      }])) as SimulationState['households'][number]['industryOutcomes'],
    })),
    firms,
    government: { id: 'government-1', cashCents: 0, taxCollectedTodayCents: 0, redistributedTodayCents: 0 },
    metrics: [], events: [], nextEventId: 1, rngState: normalizeSeed(safeConfig.seed ?? DEFAULT_SEED),
  }
  validateState(state)
  return state
}

export function stepSimulation(previous: SimulationState): SimulationState {
  const state = structuredClone(previous)
  state.day += 1
  state.government.taxCollectedTodayCents = 0
  state.government.redistributedTodayCents = 0
  state.firms.forEach((firm) => {
    Object.assign(firm, { unitsSoldToday: 0, revenueTodayCents: 0, preTaxProfitTodayCents: 0, availableUnitsToday: state.config.dailySupplyPerIndustry, unitsExpiredToday: 0, soldOutToday: false })
  })
  state.households.forEach((household) => Object.values(household.industryOutcomes).forEach((outcome) => {
    Object.assign(outcome, { purchasedToday: false, spentTodayCents: 0, purchaseOutcomeToday: null })
  }))

  const openingDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  pushEvent(state, 'DAY_STARTED', `Day ${state.day} began.`)
  const marketMetrics: MarketMetrics[] = []

  for (const industryId of state.config.industryProcessingOrder ?? safeProcessingOrder(state.config)) {
    const industry = state.industries.find(({ id }) => id === industryId)!
    const industryFirms = state.firms.filter((candidate) => candidate.industryId === industryId).sort((left, right) => left.id.localeCompare(right.id))
    const minimumPostedPrice = Math.min(...industryFirms.map(({ postedPriceCents }) => postedPriceCents))
    const shuffled = seededShuffle(state.households, state.rngState)
    state.rngState = shuffled.state
    const purchasingOrder = shuffled.values
    const affordableAtOpen = countAffordableAtPrice(state.households.map((household) => Math.min(household.cashCents, household.industryOutcomes[industryId].budgetCents)), minimumPostedPrice)
    for (const firm of industryFirms) {
      pushEvent(state, 'SUPPLY_RECEIVED', `${firm.id} received ${state.config.dailySupplyPerIndustry} exogenous ${industry.name.toLowerCase()} units.`, { actorId: firm.id, firmId: firm.id, industryId, quantity: state.config.dailySupplyPerIndustry })
      pushEvent(state, 'PRICE_POSTED', `${firm.id} posted ${dollars(firm.postedPriceCents)} in ${industry.name}.`, { actorId: firm.id, firmId: firm.id, industryId, priceCents: firm.postedPriceCents })
    }

    for (const household of purchasingOrder) {
      const outcome = household.industryOutcomes[industryId]
      const affordable = industryFirms.filter((firm) => firm.postedPriceCents <= outcome.budgetCents && firm.postedPriceCents <= household.cashCents)
      const available = affordable.filter((firm) => firm.availableUnitsToday > 0)
      if (affordable.length === 0) {
        outcome.purchaseOutcomeToday = 'insufficient_funds'; outcome.lifetimeAffordabilityFailures += 1
        pushEvent(state, 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS', `${household.id} could not afford any ${industry.name} firm within its ${dollars(outcome.budgetCents)} industry budget.`, { actorId: household.id, householdId: household.id, industryId, priceCents: minimumPostedPrice })
      } else if (available.length === 0) {
        outcome.purchaseOutcomeToday = 'stockout'; outcome.lifetimeStockoutFailures += 1
        pushEvent(state, 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT', `${household.id} could afford ${industry.name}, but no affordable firm had stock.`, { actorId: household.id, householdId: household.id, industryId, priceCents: minimumPostedPrice })
      } else {
        const cheapestPrice = Math.min(...available.map(({ postedPriceCents }) => postedPriceCents))
        const tied = available.filter(({ postedPriceCents }) => postedPriceCents === cheapestPrice)
        const selection = randomInt(state.rngState, tied.length)
        state.rngState = selection.state
        const firm = tied[selection.value]
        const price = firm.postedPriceCents
        const details = { actorId: household.id, counterpartyId: firm.id, householdId: household.id, firmId: firm.id, industryId, priceCents: price }
        household.cashCents -= price; firm.cashCents += price; firm.availableUnitsToday -= 1; firm.unitsSoldToday += 1
        Object.assign(outcome, { purchasedToday: true, spentTodayCents: price, purchaseOutcomeToday: 'purchased' }); outcome.lifetimeUnitsPurchased += 1
        pushEvent(state, 'HOUSEHOLD_PURCHASE', `${household.id} purchased ${industry.name} for ${dollars(price)}.`, { ...details, amountCents: price, quantity: 1 })
      }
    }

    const totalIndustryUnitsSold = industryFirms.reduce((sum, firm) => sum + firm.unitsSoldToday, 0)
    for (const firm of industryFirms) {
      const testedPrice = firm.postedPriceCents
      firm.unitsExpiredToday = firm.availableUnitsToday; firm.availableUnitsToday = 0
      firm.soldOutToday = firm.unitsSoldToday === state.config.dailySupplyPerIndustry
      pushEvent(state, 'GOODS_EXPIRED', `${firm.unitsExpiredToday} unsold ${industry.name.toLowerCase()} units expired at ${firm.id}.`, { actorId: firm.id, firmId: firm.id, industryId, quantity: firm.unitsExpiredToday })
      const revenue = firm.unitsSoldToday * testedPrice
      if (firm.cashCents !== revenue) throw new Error(`${firm.id} cash does not equal today's zero-cost revenue`)
      firm.revenueTodayCents = revenue; firm.preTaxProfitTodayCents = revenue
      pushEvent(state, 'FIRM_DAY_RESULT', `${firm.id} sold ${firm.unitsSoldToday}/${state.config.dailySupplyPerIndustry} units and realised ${dollars(revenue)} profit.`, { actorId: firm.id, firmId: firm.id, industryId, amountCents: revenue, quantity: firm.unitsSoldToday })
      let shouldProbe = false
      let probeDirection: 'up' | 'down' = 'up'
      if (firm.pricing.locallySettled && !firm.pricing.probing) {
        const probeDraw = probabilityCheck(state.rngState, state.config.probeProbability ?? DEFAULT_PROBE_PROBABILITY)
        state.rngState = probeDraw.state
        shouldProbe = probeDraw.value
        if (shouldProbe) {
          const directionDraw = randomInt(state.rngState, 2)
          state.rngState = directionDraw.state
          probeDirection = directionDraw.value === 0 ? 'down' : 'up'
        }
      }
      const decision = decideTomorrowPrice(firm.pricing, testedPrice, firm.unitsSoldToday, revenue, { shouldProbe, direction: probeDirection })
      firm.pricing = decision.state; firm.latestDecisionReason = decision.reason; firm.latestDecisionAction = decision.action; firm.postedPriceCents = decision.nextPriceCents
      pushEvent(state, 'FIRM_PRICE_DECISION', `${firm.id} will post ${dollars(decision.nextPriceCents)} tomorrow. ${decision.reason}`, { actorId: firm.id, firmId: firm.id, industryId, priceCents: decision.nextPriceCents })
      if (decision.justConverged) pushEvent(state, 'PRICE_DISCOVERY_CONVERGED', `${firm.id} became locally settled at ${dollars(firm.pricing.incumbentPriceCents)}.`, { actorId: firm.id, firmId: firm.id, industryId, priceCents: firm.pricing.incumbentPriceCents })
      if (decision.probeEvent) {
        const type = decision.probeEvent === 'started' ? 'PRICE_PROBE_STARTED' : decision.probeEvent === 'adopted' ? 'PRICE_PROBE_ADOPTED' : 'PRICE_PROBE_REJECTED'
        pushEvent(state, type, `${firm.id}: ${decision.reason}`, { actorId: firm.id, firmId: firm.id, industryId, priceCents: decision.nextPriceCents })
      }
      marketMetrics.push({
        industryId, firmId: firm.id, postedPriceCents: testedPrice, nextPriceCents: decision.nextPriceCents,
        bestKnownPriceCents: firm.pricing.bestPriceCents, priceStepSizeCents: firm.pricing.stepSizeCents, searchDirection: firm.pricing.direction,
        unitsSold: firm.unitsSoldToday, unitsSupplied: state.config.dailySupplyPerIndustry, unitsExpired: firm.unitsExpiredToday,
        stockoutFailures: state.households.filter((h) => h.industryOutcomes[industryId].purchaseOutcomeToday === 'stockout').length,
        affordabilityFailures: state.households.filter((h) => h.industryOutcomes[industryId].purchaseOutcomeToday === 'insufficient_funds').length,
        soldOut: firm.soldOutToday, householdsAffordableAtMarketOpen: affordableAtOpen, revenueCents: revenue, preTaxProfitCents: revenue, converged: firm.pricing.converged,
        locallySettled: firm.pricing.locallySettled, probing: firm.pricing.probing, incumbentPriceCents: firm.pricing.incumbentPriceCents,
        marketShare: totalIndustryUnitsSold === 0 ? 0 : firm.unitsSoldToday / totalIndustryUnitsSold,
        totalIndustryUnitsSold, transactionPricesCents: firm.unitsSoldToday > 0 ? [testedPrice] : [],
      })
    }
  }

  const totalFirmCashBeforeTax = state.firms.reduce((sum, firm) => sum + firm.cashCents, 0)
  for (const firm of state.firms) {
    const tax = firm.cashCents; firm.cashCents = 0; state.government.cashCents += tax
    pushEvent(state, 'TAX_PAID', `${firm.id} paid ${dollars(tax)} tax.`, { actorId: firm.id, counterpartyId: state.government.id, firmId: firm.id, industryId: firm.industryId, amountCents: tax })
  }
  state.government.taxCollectedTodayCents = totalFirmCashBeforeTax
  const governmentCashBeforeRedistribution = state.government.cashCents
  const quotient = Math.floor(governmentCashBeforeRedistribution / HOUSEHOLD_COUNT)
  const remainder = governmentCashBeforeRedistribution % HOUSEHOLD_COUNT
  state.households.forEach((household, index) => {
    const amount = quotient + (index < remainder ? 1 : 0); state.government.cashCents -= amount; household.cashCents += amount
    pushEvent(state, 'TRANSFER_RECEIVED', `${household.id} received ${dollars(amount)} from pooled taxes.`, { actorId: state.government.id, counterpartyId: household.id, householdId: household.id, amountCents: amount })
  })
  state.government.redistributedTodayCents = governmentCashBeforeRedistribution
  const endingDistribution = summarizeCashDistribution(state.households.map(({ cashCents }) => cashCents))
  const metric: DayMetrics = {
    day: state.day, markets: marketMetrics,
    householdCashMinimumAtMarketOpenCents: openingDistribution.minimumCents, householdCashMedianAtMarketOpenCents: openingDistribution.medianCents,
    householdCashMaximumAtMarketOpenCents: openingDistribution.maximumCents, householdCashGiniAtMarketOpen: openingDistribution.gini,
    householdCashMinimumCents: endingDistribution.minimumCents, householdCashMedianCents: endingDistribution.medianCents,
    householdCashMaximumCents: endingDistribution.maximumCents, householdCashGini: endingDistribution.gini,
    totalRevenueCents: totalFirmCashBeforeTax, totalPreTaxProfitCents: totalFirmCashBeforeTax,
    totalHouseholdCashCents: state.households.reduce((sum, household) => sum + household.cashCents, 0), totalFirmCashBeforeTaxCents: totalFirmCashBeforeTax,
    totalFirmCashAfterTaxCents: state.firms.reduce((sum, firm) => sum + firm.cashCents, 0), governmentCashBeforeRedistributionCents: governmentCashBeforeRedistribution,
    governmentCashAfterRedistributionCents: state.government.cashCents, totalMoneyCents: totalMoney(state), allFirmsConverged: state.firms.every((firm) => firm.pricing.converged),
    allFirmsLocallySettled: state.firms.every((firm) => firm.pricing.locallySettled),
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
