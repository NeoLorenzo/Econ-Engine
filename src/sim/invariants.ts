import { DEFAULT_FIRM_IDS_BY_INDUSTRY, DEFAULT_INDUSTRIES, HOUSEHOLD_COUNT, TOTAL_MONEY_CENTS } from './config'
import type { SimulationState } from './types'

const assertIntegerMoney = (label: string, value: number) => {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be non-negative integer cents; received ${value}`)
}

export function totalMoney(state: Pick<SimulationState, 'households' | 'firms' | 'government'>) {
  return state.households.reduce((sum, household) => sum + household.cashCents, 0)
    + state.firms.reduce((sum, firm) => sum + firm.cashCents, 0)
    + state.government.cashCents
}

export function validateState(state: SimulationState, endOfDay = false) {
  if (state.industries.length !== DEFAULT_INDUSTRIES.length) throw new Error('Expected exactly five industries')
  if (state.firms.length !== 6) throw new Error('Expected six firms')
  if (state.households.length !== HOUSEHOLD_COUNT) throw new Error(`Expected ${HOUSEHOLD_COUNT} households`)
  const industryIds = state.industries.map(({ id }) => id)
  if (new Set(industryIds).size !== industryIds.length) throw new Error('Industry IDs must be unique')
  for (const industryId of industryIds) {
    const expected = DEFAULT_FIRM_IDS_BY_INDUSTRY[industryId]
    const actual = state.firms.filter((firm) => firm.industryId === industryId).map(({ id }) => id).sort()
    if (actual.join('|') !== [...expected].sort().join('|')) throw new Error(`${industryId} firm membership is invalid`)
  }
  if (!Number.isInteger(state.config.dailySupplyPerIndustry) || state.config.dailySupplyPerIndustry < 0) throw new Error('Daily supply must be a non-negative integer')
  if (!Number.isInteger(state.rngState) || state.rngState < 0 || state.rngState > 0xffff_ffff) throw new Error('RNG state must be an unsigned 32-bit integer')
  if ((state.config.probeProbability ?? 0) < 0 || (state.config.probeProbability ?? 0) > 1) throw new Error('Probe probability must be between zero and one')

  state.households.forEach((household) => {
    assertIntegerMoney(`${household.id} cash`, household.cashCents)
    for (const industryId of industryIds.filter((id) => id !== 'transport')) {
      const outcome = household.industryOutcomes[industryId]
      if (!outcome) throw new Error(`${household.id} is missing ${industryId} budget/outcome state`)
      assertIntegerMoney(`${household.id}/${industryId} budget`, outcome.budgetCents)
      assertIntegerMoney(`${household.id}/${industryId} spent`, outcome.spentTodayCents)
      const cumulative = outcome.lifetimeUnitsPurchased + outcome.lifetimeStockoutFailures + outcome.lifetimeAffordabilityFailures
      if (![outcome.lifetimeUnitsPurchased, outcome.lifetimeStockoutFailures, outcome.lifetimeAffordabilityFailures].every((value) => Number.isInteger(value) && value >= 0)) throw new Error(`${household.id}/${industryId} cumulative outcomes must be non-negative integers`)
      if (cumulative !== state.day) throw new Error(`${household.id}/${industryId} cumulative outcomes must account for every day`)
      if (endOfDay && outcome.purchaseOutcomeToday === null) throw new Error(`${household.id}/${industryId} requires one causal outcome`)
      if (endOfDay && outcome.purchasedToday !== (outcome.purchaseOutcomeToday === 'purchased')) throw new Error(`${household.id}/${industryId} purchase flag disagrees with outcome`)
      if (endOfDay && outcome.spentTodayCents > outcome.budgetCents) throw new Error(`${household.id}/${industryId} exceeded its behavioral budget`)
    }
  })

  state.firms.forEach((firm) => {
    assertIntegerMoney(`${firm.id} cash`, firm.cashCents)
    assertIntegerMoney(`${firm.id} price`, firm.postedPriceCents)
    assertIntegerMoney(`${firm.id} step`, firm.pricing.stepSizeCents)
    assertIntegerMoney(`${firm.id} incumbent price`, firm.pricing.incumbentPriceCents)
    if (firm.pricing.probing && !firm.pricing.locallySettled) throw new Error(`${firm.id} cannot probe before local settlement`)
    if (firm.postedPriceCents < 1 || firm.pricing.stepSizeCents < 1) throw new Error(`${firm.id} price and step must be positive`)
    if (![firm.availableUnitsToday, firm.unitsExpiredToday, firm.unitsSoldToday].every((value) => Number.isInteger(value) && value >= 0)) throw new Error(`${firm.id} goods fields must be non-negative integers`)
    if (firm.industryId !== 'transport' && firm.unitsSoldToday > Math.min(HOUSEHOLD_COUNT, state.config.dailySupplyPerIndustry)) throw new Error(`${firm.id} sold above finite supply`)
    if (endOfDay && firm.cashCents !== 0) throw new Error(`${firm.id} cash must be zero after taxation`)
    if (endOfDay && firm.availableUnitsToday !== 0) throw new Error(`${firm.id} goods cannot carry over`)
    if (endOfDay && firm.industryId !== 'transport' && state.config.dailySupplyPerIndustry !== firm.unitsSoldToday + firm.unitsExpiredToday) throw new Error(`${firm.id} stock-flow accounting failed`)
    if (endOfDay && firm.industryId !== 'transport' && firm.soldOutToday !== (firm.unitsSoldToday === state.config.dailySupplyPerIndustry)) throw new Error(`${firm.id} sold-out status is inconsistent`)
    const saleEventType = firm.industryId === 'transport' ? 'TRANSPORT_SERVICE_PURCHASED' : 'HOUSEHOLD_PURCHASE'
    if (endOfDay && state.events.filter((event) => event.day === state.day && event.type === saleEventType && event.firmId === firm.id).length !== firm.unitsSoldToday) throw new Error(`${firm.id} sales do not match purchase events`)
  })

  if (endOfDay) for (const industryId of industryIds.filter((id) => id !== 'transport')) {
    const sales = state.firms.filter((firm) => firm.industryId === industryId).reduce((sum, firm) => sum + firm.unitsSoldToday, 0)
    const purchases = state.households.filter((household) => household.industryOutcomes[industryId].purchasedToday).length
    if (sales !== purchases || sales > HOUSEHOLD_COUNT) throw new Error(`${industryId} total sales exceed or disagree with household demand`)
  }

  if (totalMoney(state) !== TOTAL_MONEY_CENTS) throw new Error(`Money conservation failed: expected ${TOTAL_MONEY_CENTS} cents, found ${totalMoney(state)}`)
  if (endOfDay && state.government.cashCents !== 0) throw new Error('Government cash must be zero after redistribution')
  if (endOfDay && state.households.some((household) => household.cashCents !== state.config.targetHouseholdCashCents)) throw new Error('Household parity restoration failed')
}
