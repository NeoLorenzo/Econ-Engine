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
  })
  assertIntegerMoney('firm cash', state.firm.cashCents)
  assertIntegerMoney('government cash', state.government.cashCents)
  assertIntegerMoney('posted price', state.firm.postedPriceCents)
  assertIntegerMoney('price step', state.pricing.stepSizeCents)
  if (state.firm.postedPriceCents < 1) throw new Error('Firm price must be at least one cent')
  if (state.pricing.stepSizeCents < 1) throw new Error('Price-search step must be at least one cent')
  if (state.firm.unitsSoldToday < 0 || state.firm.unitsSoldToday > HOUSEHOLD_COUNT) throw new Error('Units sold is outside the valid range')
  if (totalMoney(state) !== TOTAL_MONEY_CENTS) throw new Error(`Money conservation failed: expected ${TOTAL_MONEY_CENTS} cents, found ${totalMoney(state)}`)
  if (endOfDay && state.firm.cashCents !== 0) throw new Error('Firm cash must be zero after taxation')
  if (endOfDay && state.government.cashCents !== 0) throw new Error('Government cash must be zero after redistribution')
}
