import { DEFAULT_CONFIG, HOUSEHOLD_COUNT, INITIAL_HOUSEHOLD_CASH_CENTS, MAX_EVENTS, MAX_HISTORY } from './config'
import { countAffordableAtPrice, summarizeCashDistribution } from './analytics'
import { totalMoney, validateState } from './invariants'
import { createPricingState, decideTomorrowPrice } from './pricingStrategy'
import type { DayMetrics, SimulationConfig, SimulationEvent, SimulationEventType, SimulationState } from './types'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

function pushEvent(state: SimulationState, type: SimulationEventType, description: string, details: Partial<SimulationEvent> = {}) {
  state.events.push({ id: state.nextEventId++, day: state.day, type, description, ...details })
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS)
}

export function createSimulation(config: SimulationConfig = DEFAULT_CONFIG): SimulationState {
  const safeConfig = {
    startingPriceCents: Math.max(1, Math.round(config.startingPriceCents)),
    initialStepCents: Math.max(1, Math.round(config.initialStepCents)),
    dailyFoodSupply: Math.max(0, Math.round(config.dailyFoodSupply)),
  }
  const state: SimulationState = {
    day: 0,
    config: safeConfig,
    households: Array.from({ length: HOUSEHOLD_COUNT }, (_, index) => ({
      id: `household-${index + 1}`,
      cashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      purchasedToday: false,
      spentTodayCents: 0,
      purchaseOutcomeToday: null,
      lifetimeUnitsPurchased: 0,
      lifetimeStockoutFailures: 0,
      lifetimeAffordabilityFailures: 0,
    })),
    firm: { id: 'firm-1', cashCents: 0, postedPriceCents: safeConfig.startingPriceCents, unitsSoldToday: 0, revenueTodayCents: 0, preTaxProfitTodayCents: 0, availableFoodToday: 0, unitsExpiredToday: 0, soldOutToday: false },
    government: { id: 'government-1', cashCents: 0, taxCollectedTodayCents: 0, redistributedTodayCents: 0 },
    pricing: createPricingState(safeConfig.startingPriceCents, safeConfig.initialStepCents),
    metrics: [],
    events: [],
    latestDecisionReason: 'The first price is set by the run configuration.',
    latestDecisionAction: 'hold',
    nextEventId: 1,
  }
  validateState(state)
  return state
}

export function stepSimulation(previous: SimulationState): SimulationState {
  const state = structuredClone(previous)
  state.day += 1
  state.firm.unitsSoldToday = 0
  state.firm.revenueTodayCents = 0
  state.firm.preTaxProfitTodayCents = 0
  state.firm.availableFoodToday = state.config.dailyFoodSupply
  state.firm.unitsExpiredToday = 0
  state.firm.soldOutToday = false
  state.government.taxCollectedTodayCents = 0
  state.government.redistributedTodayCents = 0
  state.households.forEach((household) => { household.purchasedToday = false; household.spentTodayCents = 0; household.purchaseOutcomeToday = null })

  const price = state.firm.postedPriceCents
  const marketOpenCash = state.households.map((household) => household.cashCents)
  const marketOpenDistribution = summarizeCashDistribution(marketOpenCash)
  const householdsAffordableAtMarketOpen = countAffordableAtPrice(marketOpenCash, price)
  pushEvent(state, 'DAY_STARTED', `Day ${state.day} began.`)
  pushEvent(state, 'FOOD_SUPPLY_RECEIVED', `${state.config.dailyFoodSupply} units of exogenous food supply arrived for today's market.`, { actorId: state.firm.id, quantity: state.config.dailyFoodSupply })
  pushEvent(state, 'PRICE_POSTED', `Firm posted ${dollars(price)} for one unit of food.`, { actorId: state.firm.id, priceCents: price })

  const firstHouseholdIndex = (state.day - 1) % HOUSEHOLD_COUNT
  const purchasingOrder = Array.from({ length: HOUSEHOLD_COUNT }, (_, offset) =>
    state.households[(firstHouseholdIndex + offset) % HOUSEHOLD_COUNT])

  for (const household of purchasingOrder) {
    if (household.cashCents < price) {
      household.purchaseOutcomeToday = 'insufficient_funds'
      household.lifetimeAffordabilityFailures += 1
      pushEvent(state, 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS', `${household.id.replace('-', ' ')} could not afford food at ${dollars(price)}.`, { actorId: household.id, counterpartyId: state.firm.id, priceCents: price })
    } else if (state.firm.availableFoodToday === 0) {
      household.purchaseOutcomeToday = 'stockout'
      household.lifetimeStockoutFailures += 1
      pushEvent(state, 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT', `${household.id.replace('-', ' ')} could afford food at ${dollars(price)}, but no stock remained.`, { actorId: household.id, counterpartyId: state.firm.id, priceCents: price })
    } else {
      household.cashCents -= price
      state.firm.cashCents += price
      state.firm.availableFoodToday -= 1
      household.purchasedToday = true
      household.spentTodayCents = price
      household.purchaseOutcomeToday = 'purchased'
      household.lifetimeUnitsPurchased += 1
      state.firm.unitsSoldToday += 1
      pushEvent(state, 'HOUSEHOLD_PURCHASE', `${household.id.replace('-', ' ')} purchased food for ${dollars(price)}.`, { actorId: household.id, counterpartyId: state.firm.id, amountCents: price, quantity: 1 })
    }
  }

  state.firm.unitsExpiredToday = state.firm.availableFoodToday
  state.firm.availableFoodToday = 0
  state.firm.soldOutToday = state.firm.unitsSoldToday === state.config.dailyFoodSupply
  pushEvent(state, 'FOOD_EXPIRED', `${state.firm.unitsExpiredToday} unsold food unit${state.firm.unitsExpiredToday === 1 ? '' : 's'} expired; no food carries into tomorrow.`, { actorId: state.firm.id, quantity: state.firm.unitsExpiredToday })

  const revenue = state.firm.unitsSoldToday * price
  if (state.firm.cashCents !== revenue) throw new Error('Firm cash does not equal today\'s zero-cost revenue')
  state.firm.revenueTodayCents = revenue
  state.firm.preTaxProfitTodayCents = revenue
  pushEvent(state, 'FIRM_DAY_RESULT', `Firm sold ${state.firm.unitsSoldToday}/${state.config.dailyFoodSupply} supplied units and realized ${dollars(revenue)} pre-tax profit.`, { actorId: state.firm.id, amountCents: revenue, quantity: state.firm.unitsSoldToday })

  const decision = decideTomorrowPrice(state.pricing, price, state.firm.unitsSoldToday, revenue)
  state.pricing = decision.state
  state.latestDecisionReason = decision.reason
  state.latestDecisionAction = decision.action
  state.firm.postedPriceCents = decision.nextPriceCents
  pushEvent(state, 'FIRM_PRICE_DECISION', `Firm will post ${dollars(decision.nextPriceCents)} tomorrow. ${decision.reason}`, { actorId: state.firm.id, priceCents: decision.nextPriceCents })
  if (decision.justConverged) pushEvent(state, 'PRICE_DISCOVERY_CONVERGED', `Price discovery converged at ${dollars(state.pricing.bestPriceCents)}.`, { actorId: state.firm.id, priceCents: state.pricing.bestPriceCents })

  const firmCashBeforeTax = state.firm.cashCents
  state.firm.cashCents -= firmCashBeforeTax
  state.government.cashCents += firmCashBeforeTax
  state.government.taxCollectedTodayCents = firmCashBeforeTax
  pushEvent(state, 'TAX_PAID', `Government collected ${dollars(firmCashBeforeTax)} from the firm.`, { actorId: state.firm.id, counterpartyId: state.government.id, amountCents: firmCashBeforeTax })

  const governmentCashBeforeRedistribution = state.government.cashCents
  const quotient = Math.floor(governmentCashBeforeRedistribution / HOUSEHOLD_COUNT)
  const remainder = governmentCashBeforeRedistribution % HOUSEHOLD_COUNT
  state.households.forEach((household, index) => {
    const amount = quotient + (index < remainder ? 1 : 0)
    state.government.cashCents -= amount
    household.cashCents += amount
    pushEvent(state, 'TRANSFER_RECEIVED', `${household.id.replace('-', ' ')} received ${dollars(amount)} from the government.`, { actorId: state.government.id, counterpartyId: household.id, amountCents: amount })
  })
  state.government.redistributedTodayCents = governmentCashBeforeRedistribution
  const endOfDayDistribution = summarizeCashDistribution(state.households.map((household) => household.cashCents))

  const metrics: DayMetrics = {
    day: state.day,
    postedPriceCents: price,
    bestKnownPriceCents: state.pricing.bestPriceCents,
    priceStepSizeCents: state.pricing.stepSizeCents,
    searchDirection: state.pricing.direction,
    unitsSold: state.firm.unitsSoldToday,
    foodSupplied: state.config.dailyFoodSupply,
    unitsExpired: state.firm.unitsExpiredToday,
    stockoutFailures: state.households.filter((household) => household.purchaseOutcomeToday === 'stockout').length,
    affordabilityFailures: state.households.filter((household) => household.purchaseOutcomeToday === 'insufficient_funds').length,
    soldOut: state.firm.soldOutToday,
    householdsAffordableAtMarketOpen,
    householdCashMinimumAtMarketOpenCents: marketOpenDistribution.minimumCents,
    householdCashMedianAtMarketOpenCents: marketOpenDistribution.medianCents,
    householdCashMaximumAtMarketOpenCents: marketOpenDistribution.maximumCents,
    householdCashGiniAtMarketOpen: marketOpenDistribution.gini,
    householdCashMinimumCents: endOfDayDistribution.minimumCents,
    householdCashMedianCents: endOfDayDistribution.medianCents,
    householdCashMaximumCents: endOfDayDistribution.maximumCents,
    householdCashGini: endOfDayDistribution.gini,
    revenueCents: revenue,
    preTaxProfitCents: revenue,
    totalHouseholdCashCents: state.households.reduce((sum, household) => sum + household.cashCents, 0),
    firmCashBeforeTaxCents: firmCashBeforeTax,
    firmCashAfterTaxCents: state.firm.cashCents,
    governmentCashBeforeRedistributionCents: governmentCashBeforeRedistribution,
    governmentCashAfterRedistributionCents: state.government.cashCents,
    totalMoneyCents: totalMoney(state),
    converged: state.pricing.converged,
  }
  state.metrics.push(metrics)
  if (state.metrics.length > MAX_HISTORY) state.metrics.shift()
  validateState(state, true)
  pushEvent(state, 'DAY_ENDED', `Day ${state.day} ended with exactly ${dollars(metrics.totalMoneyCents)} in the closed circuit.`)
  return state
}

export function runDays(state: SimulationState, days: number) {
  let result = state
  for (let index = 0; index < days; index += 1) result = stepSimulation(result)
  return result
}
