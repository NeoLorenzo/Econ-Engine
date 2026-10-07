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

export const firmVariant = (firmId: string): 'a' | 'b' | null =>
  firmId.endsWith('-a') ? 'a' : firmId.endsWith('-b') ? 'b' : null

/** "Food · Firm A", or "Transport" for the monopoly. */
export function firmName(firmId: string, industryId?: IndustryId) {
  const industry = industryId ?? (Object.keys(INDUSTRY_NAMES) as IndustryId[]).find((id) => firmId.includes(`-${id}`))
  const variant = firmVariant(firmId)
  const name = industry ? INDUSTRY_NAMES[industry] : firmId.replace('firm-', '')
  return variant ? `${name} · Firm ${variant.toUpperCase()}` : name
}

export const firmShortName = (firmId: string) => {
  const variant = firmVariant(firmId)
  return variant ? `Firm ${variant.toUpperCase()}` : firmName(firmId)
}

export const householdNumber = (householdId: string) => householdId.replace('household-', '')
export const householdName = (householdId: string) => `Household ${householdNumber(householdId)}`

export function entityName(id: string) {
  return id.startsWith('household-') ? householdName(id) : firmName(id)
}
