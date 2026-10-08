import { firmLetter, firmSlot } from '../sim/config'
import type { IndustryId } from '../sim/types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const compactCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const money = (cents: number) => currency.format(cents / 100)
/** Whole dollars for large flow figures, where cents are noise. */
export const moneyWhole = (cents: number) => compactCurrency.format(Math.round(cents / 100))
export const percent = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`
export const bps = (basisPoints: number, digits = 0) => `${(basisPoints / 100).toFixed(digits)}%`
export const gini = (value: number) => value.toFixed(3)

export const INDUSTRY_NAMES: Record<IndustryId, string> = {
  food: 'Food',
  utilities: 'Utilities',
  transport: 'Transport',
  healthcare: 'Healthcare',
  entertainment: 'Entertainment',
}

export { firmSlot }

/** "Food · Firm A", or "Transport" for the monopoly. */
export function firmName(firmId: string, industryId?: IndustryId) {
  const industry = industryId ?? (Object.keys(INDUSTRY_NAMES) as IndustryId[]).find((id) => firmId.includes(`-${id}`))
  const slot = firmSlot(firmId)
  const name = industry ? INDUSTRY_NAMES[industry] : firmId.replace('firm-', '')
  return slot === null ? name : `${name} · Firm ${firmLetter(slot)}`
}

/** "Firm A", or the full name for Transport. */
export const firmShortName = (firmId: string) => {
  const slot = firmSlot(firmId)
  return slot === null ? firmName(firmId) : `Firm ${firmLetter(slot)}`
}

export const householdNumber = (householdId: string) => householdId.replace('household-', '')
export const householdName = (householdId: string) => `Household ${householdNumber(householdId)}`

export function entityName(id: string) {
  if (id.startsWith('government-')) return 'Government'
  return id.startsWith('household-') ? householdName(id) : firmName(id)
}
