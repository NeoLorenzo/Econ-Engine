import { HOUSEHOLD_COUNT, TOTAL_MONEY_CENTS } from './config'
import type { SimulationState } from './types'

const assertIntegerMoney = (label: string, value: number) => {
  if (!Number.isInteger(value)) throw new Error(`${label} must be integer cents; received ${value}`)
  if (value < 0) throw new Error(`${label} cannot be negative; received ${value}`)
}

export function totalMoney(state: Pick<SimulationState, 'households' | 'firm' | 'government'>) {
  return state.households.reduce((sum, household) => sum + household.cashCents, 0)
    + state.firm.cashCents
    + state.government.cashCents
}

export function validateState(state: SimulationState, endOfDay = false) {
  if (state.households.length !== HOUSEHOLD_COUNT) throw new Error(`Expected ${HOUSEHOLD_COUNT} households`)
  state.households.forEach((household) => {
    assertIntegerMoney(`${household.id} cash`, household.cashCents)
    assertIntegerMoney(`${household.id} spent`, household.spentTodayCents)
    if (![household.lifetimeUnitsPurchased, household.lifetimeStockoutFailures, household.lifetimeAffordabilityFailures].every((value) => Number.isInteger(value) && value >= 0)) throw new Error(`${household.id} cumulative outcomes must be non-negative integers`)
    if (household.lifetimeUnitsPurchased + household.lifetimeStockoutFailures + household.lifetimeAffordabilityFailures !== state.day) throw new Error(`${household.id} cumulative outcomes must account for every completed or active day`)
  })
  assertIntegerMoney('firm cash', state.firm.cashCents)
  assertIntegerMoney('government cash', state.government.cashCents)
  assertIntegerMoney('posted price', state.firm.postedPriceCents)
  assertIntegerMoney('price step', state.pricing.stepSizeCents)
  if (state.firm.postedPriceCents < 1) throw new Error('Firm price must be at least one cent')
  if (state.pricing.stepSizeCents < 1) throw new Error('Price-search step must be at least one cent')
  if (!Number.isInteger(state.config.dailyFoodSupply) || state.config.dailyFoodSupply < 0) throw new Error('Daily food supply must be a non-negative integer')
  if (!Number.isInteger(state.firm.availableFoodToday) || state.firm.availableFoodToday < 0) throw new Error('Available food must be a non-negative integer')
  if (!Number.isInteger(state.firm.unitsExpiredToday) || state.firm.unitsExpiredToday < 0) throw new Error('Expired food must be a non-negative integer')
  if (state.firm.unitsSoldToday < 0 || state.firm.unitsSoldToday > Math.min(HOUSEHOLD_COUNT, state.config.dailyFoodSupply)) throw new Error('Units sold is outside the finite-supply range')
  if (totalMoney(state) !== TOTAL_MONEY_CENTS) throw new Error(`Money conservation failed: expected ${TOTAL_MONEY_CENTS} cents, found ${totalMoney(state)}`)
  if (endOfDay && state.firm.cashCents !== 0) throw new Error('Firm cash must be zero after taxation')
  if (endOfDay && state.government.cashCents !== 0) throw new Error('Government cash must be zero after redistribution')
  if (endOfDay && state.firm.availableFoodToday !== 0) throw new Error('Food cannot carry into the next day')
  if (endOfDay && state.config.dailyFoodSupply !== state.firm.unitsSoldToday + state.firm.unitsExpiredToday) throw new Error('Daily food stock-flow accounting failed')
  if (endOfDay && state.households.filter((household) => household.purchasedToday).length !== state.firm.unitsSoldToday) throw new Error('Household purchases do not match firm sales')
  if (endOfDay && state.households.some((household) => household.purchaseOutcomeToday === null)) throw new Error('Every household must have a causal purchase outcome')
  if (endOfDay && state.households.some((household) => household.purchasedToday !== (household.purchaseOutcomeToday === 'purchased'))) throw new Error('Household purchase flags and outcomes disagree')
  if (endOfDay && state.households.filter((household) => household.purchaseOutcomeToday !== null).length !== HOUSEHOLD_COUNT) throw new Error('Daily household outcomes do not account for every household')
  if (endOfDay && state.households.some((household) => household.spentTodayCents !== (household.purchasedToday ? state.metrics.at(-1)?.postedPriceCents : 0))) throw new Error('Each household may purchase at most one unit at the tested price')
  if (endOfDay && state.firm.soldOutToday !== (state.firm.unitsSoldToday === state.config.dailyFoodSupply)) throw new Error('Firm sold-out status does not match its completed market result')
}
