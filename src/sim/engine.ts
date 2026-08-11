import { DEFAULT_CONFIG, HOUSEHOLD_COUNT, INITIAL_HOUSEHOLD_CASH_CENTS, MAX_EVENTS, MAX_HISTORY } from './config'
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
  }
  const state: SimulationState = {
    day: 0,
    config: safeConfig,
    households: Array.from({ length: HOUSEHOLD_COUNT }, (_, index) => ({
      id: `household-${index + 1}`,
      cashCents: INITIAL_HOUSEHOLD_CASH_CENTS,
      purchasedToday: false,
      spentTodayCents: 0,
    })),
    firm: { id: 'firm-1', cashCents: 0, postedPriceCents: safeConfig.startingPriceCents, unitsSoldToday: 0, revenueTodayCents: 0, preTaxProfitTodayCents: 0 },
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
  state.government.taxCollectedTodayCents = 0
  state.government.redistributedTodayCents = 0
  state.households.forEach((household) => { household.purchasedToday = false; household.spentTodayCents = 0 })

  const price = state.firm.postedPriceCents
  pushEvent(state, 'DAY_STARTED', `Day ${state.day} began.`)
  pushEvent(state, 'PRICE_POSTED', `Firm posted ${dollars(price)} for one unit of food.`, { actorId: state.firm.id, priceCents: price })

  for (const household of state.households) {
    if (household.cashCents >= price) {
      household.cashCents -= price
      state.firm.cashCents += price
      household.purchasedToday = true
      household.spentTodayCents = price
      state.firm.unitsSoldToday += 1
      pushEvent(state, 'HOUSEHOLD_PURCHASE', `${household.id.replace('-', ' ')} purchased food for ${dollars(price)}.`, { actorId: household.id, counterpartyId: state.firm.id, amountCents: price, quantity: 1 })
    } else {
      pushEvent(state, 'HOUSEHOLD_PURCHASE_FAILED', `${household.id.replace('-', ' ')} could not afford food at ${dollars(price)}.`, { actorId: household.id, counterpartyId: state.firm.id, priceCents: price })
    }
  }

  const revenue = state.firm.unitsSoldToday * price
  if (state.firm.cashCents !== revenue) throw new Error('Firm cash does not equal today\'s zero-cost revenue')
  state.firm.revenueTodayCents = revenue
  state.firm.preTaxProfitTodayCents = revenue
  pushEvent(state, 'FIRM_DAY_RESULT', `Firm sold ${state.firm.unitsSoldToday}/10 units and realized ${dollars(revenue)} pre-tax profit.`, { actorId: state.firm.id, amountCents: revenue, quantity: state.firm.unitsSoldToday })

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

  const metrics: DayMetrics = {
    day: state.day,
    postedPriceCents: price,
    bestKnownPriceCents: state.pricing.bestPriceCents,
    priceStepSizeCents: state.pricing.stepSizeCents,
    searchDirection: state.pricing.direction,
    unitsSold: state.firm.unitsSoldToday,
    failedPurchases: HOUSEHOLD_COUNT - state.firm.unitsSoldToday,
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
