import { DEFAULT_FIRM_IDS_BY_INDUSTRY, DEFAULT_INDUSTRIES, HOUSEHOLD_COUNT, TOTAL_MONEY_CENTS, deriveIndustryBudgetCents } from './config'
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
  if (state.firms.length !== 9) throw new Error('Expected eight consumer firms and one Transport firm')
  if (state.households.length !== HOUSEHOLD_COUNT) throw new Error(`Expected ${HOUSEHOLD_COUNT} households`)
  const industryIds = state.industries.map(({ id }) => id)
  if (new Set(industryIds).size !== industryIds.length) throw new Error('Industry IDs must be unique')
  for (const industryId of industryIds) {
    const expected = DEFAULT_FIRM_IDS_BY_INDUSTRY[industryId]
    const actual = state.firms.filter((firm) => firm.industryId === industryId).map(({ id }) => id).sort()
    if (actual.join('|') !== [...expected].sort().join('|')) throw new Error(`${industryId} firm membership is invalid`)
  }
  if (!Number.isInteger(state.config.laborProductivityUnitsPerWorker) || state.config.laborProductivityUnitsPerWorker! < 0) throw new Error('Labor productivity must be a non-negative integer')
  if (state.config.firmTaxRateBps !== 0 || state.config.householdParityEnabled !== false) throw new Error('Legacy firm tax and parity policy must remain inactive')
  if ((state.config.governmentExperimentProbability ?? 0) < 0 || (state.config.governmentExperimentProbability ?? 0) > 1) throw new Error('Government experiment probability must be between zero and one')
  if (!Number.isInteger(state.governmentPolicyRngState) || state.governmentPolicyRngState < 0 || state.governmentPolicyRngState > 0xffff_ffff) throw new Error('Government policy RNG state must be an unsigned 32-bit integer')
  if (!Number.isInteger(state.rngState) || state.rngState < 0 || state.rngState > 0xffff_ffff) throw new Error('RNG state must be an unsigned 32-bit integer')
  if ((state.config.probeProbability ?? 0) < 0 || (state.config.probeProbability ?? 0) > 1) throw new Error('Probe probability must be between zero and one')
  for (const industry of state.industries.filter(({ id }) => id !== 'transport')) {
    const share = state.config.industryBudgetSharesBps?.[industry.id as Exclude<typeof industry.id, 'transport'>]
    if (!Number.isInteger(share) || share! < 0 || share! > 10_000) throw new Error(`${industry.id} expenditure share must be integer basis points`)
    if (industry.householdBudgetCents !== deriveIndustryBudgetCents(state.config.dailyExpenditureBudgetCents!, share!)) throw new Error(`${industry.id} derived budget is inconsistent`)
  }
  const spatialEntities = [...state.households.map(({ id, coordinate }) => ({ id, coordinate })), ...state.firms.filter(({ industryId }) => industryId !== 'transport').map(({ id, coordinate }) => ({ id, coordinate: coordinate! }))]
  if (new Set(spatialEntities.map(({ coordinate }) => `${coordinate.x},${coordinate.y}`)).size !== spatialEntities.length) throw new Error('Spatial entity coordinates must be unique')
  if (spatialEntities.some(({ coordinate }) => coordinate.x < 0 || coordinate.x >= state.config.gridWidth! || coordinate.y < 0 || coordinate.y >= state.config.gridHeight!)) throw new Error('Spatial entity coordinate is outside grid bounds')

  state.households.forEach((household) => {
    assertIntegerMoney(`${household.id} cash`, household.cashCents)
    if (!state.firms.some(({ id }) => id === household.employerFirmId)) throw new Error(`${household.id} employer is invalid`)
    ;['wageTodayCents', 'cumulativeWagesCents', 'spendingTodayCents', 'preTaxCashCents', 'taxPaidTodayCents', 'transferReceivedTodayCents', 'postFiscalCashCents', 'cumulativeTaxPaidCents', 'cumulativeTransfersReceivedCents'].forEach((field) => assertIntegerMoney(`${household.id} ${field}`, household[field as 'wageTodayCents']))
    if (household.taxPaidTodayCents > household.preTaxCashCents) throw new Error(`${household.id} tax exceeded taxable wealth`)
    if (household.netFiscalTransferTodayCents !== household.transferReceivedTodayCents - household.taxPaidTodayCents) throw new Error(`${household.id} net fiscal transfer is inconsistent`)
    if (household.postFiscalCashCents !== household.cashCents) throw new Error(`${household.id} post-fiscal cash is stale`)
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
    const expectedWorkers = firm.industryId === 'transport' ? 2 : 1
    if (firm.employeeIds.length !== expectedWorkers || firm.employeeIds.some((id) => state.households.find(({ id: householdId }) => householdId === id)?.employerFirmId !== firm.id)) throw new Error(`${firm.id} employment relation is inconsistent`)
    if (state.day > 0 && firm.industryId !== 'transport' && firm.unitsProducedToday !== firm.employeeIds.length * state.config.laborProductivityUnitsPerWorker!) throw new Error(`${firm.id} production is not labor-derived`)
    if (firm.industryId === 'transport' && firm.unitsProducedToday !== 0) throw new Error('Transport must not use consumer production units')
    if (firm.industryId !== 'transport' && firm.unitsSoldToday > Math.min(HOUSEHOLD_COUNT, firm.unitsProducedToday)) throw new Error(`${firm.id} sold above finite production`)
    if (endOfDay && firm.cashCents !== 0) throw new Error(`${firm.id} cash must be zero after payroll`)
    if (endOfDay && firm.availableUnitsToday !== 0) throw new Error(`${firm.id} goods cannot carry over`)
    if (endOfDay && firm.industryId !== 'transport' && firm.unitsProducedToday !== firm.unitsSoldToday + firm.unitsExpiredToday) throw new Error(`${firm.id} stock-flow accounting failed`)
    if (endOfDay && firm.industryId !== 'transport' && firm.soldOutToday !== (firm.unitsSoldToday === firm.unitsProducedToday)) throw new Error(`${firm.id} sold-out status is inconsistent`)
    if (endOfDay && firm.wagesPaidTodayCents !== firm.wagePoolTodayCents) throw new Error(`${firm.id} payroll did not distribute its entire pool`)
    const saleEventType = firm.industryId === 'transport' ? 'TRANSPORT_SERVICE_PURCHASED' : 'HOUSEHOLD_PURCHASE'
    if (endOfDay && state.events.filter((event) => event.day === state.day && event.type === saleEventType && event.firmId === firm.id).length !== firm.unitsSoldToday) throw new Error(`${firm.id} sales do not match purchase events`)
  })

  if (endOfDay) for (const industryId of industryIds.filter((id) => id !== 'transport')) {
    const sales = state.firms.filter((firm) => firm.industryId === industryId).reduce((sum, firm) => sum + firm.unitsSoldToday, 0)
    const purchases = state.households.filter((household) => household.industryOutcomes[industryId].purchasedToday).length
    if (sales !== purchases || sales > HOUSEHOLD_COUNT) throw new Error(`${industryId} total sales exceed or disagree with household demand`)
  }

  if (totalMoney(state) !== TOTAL_MONEY_CENTS) throw new Error(`Money conservation failed: expected ${TOTAL_MONEY_CENTS} cents, found ${totalMoney(state)}`)
  ;['cashCents', 'taxCollectedTodayCents', 'redistributedTodayCents'].forEach((field) => assertIntegerMoney(`Government ${field}`, state.government[field as 'cashCents']))
  if (state.government.incumbentWealthTaxRateBps < 0 || state.government.incumbentWealthTaxRateBps > 10_000 || state.government.appliedWealthTaxRateBps < 0 || state.government.appliedWealthTaxRateBps > 10_000) throw new Error('Government tax rates must remain within 0–100%')
  if (!['equalizing', 'minimizing_tax'].includes(state.government.policyMode)) throw new Error('Government policy mode is invalid')
  if (state.government.effectiveEquality !== (state.government.postFiscalCashMaximumCents - state.government.postFiscalCashMinimumCents <= 1)) throw new Error('Government effective-equality state is inconsistent')
  if (endOfDay && state.government.cashCents !== 0) throw new Error('Government must redistribute its complete tax pool')
  if (endOfDay && state.government.taxCollectedTodayCents !== state.government.redistributedTodayCents) throw new Error('Government taxes and transfers must reconcile')
  if (endOfDay && state.households.reduce((sum, household) => sum + household.taxPaidTodayCents, 0) !== state.government.taxCollectedTodayCents) throw new Error('Household tax events do not reconcile with Government receipts')
  if (endOfDay && state.households.reduce((sum, household) => sum + household.transferReceivedTodayCents, 0) !== state.government.redistributedTodayCents) throw new Error('Household transfers do not reconcile with Government outlays')
  if (endOfDay && state.households.reduce((sum, household) => sum + household.cashCents, 0) !== TOTAL_MONEY_CENTS) throw new Error('Completed fiscal phase must return all money to households')
}
