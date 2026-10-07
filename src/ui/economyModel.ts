import type { DayMetrics, Firm, IndustryId, PriceExperimentType, SimulationEvent, SimulationState } from '../sim/types'
import { bps, firmName, firmVariant, INDUSTRY_NAMES, money } from './format'
import type { CompetitiveIndustryId } from './worldViewModel'

/** Read-only derivations for the observer UI. Nothing here feeds back into the simulation. */

export const CONSUMER_INDUSTRIES: CompetitiveIndustryId[] = ['food', 'utilities', 'healthcare', 'entertainment']

const consumerMarkets = (metric: DayMetrics) => metric.markets.filter(({ industryId }) => industryId !== 'transport')

/** Share of all desired consumer purchases (one per household per industry) that completed. */
export function completionRate(metric: DayMetrics | undefined, householdCount: number) {
  if (!metric) return 0
  const sold = consumerMarkets(metric).reduce((sum, market) => sum + market.unitsSold, 0)
  return sold / Math.max(1, householdCount * CONSUMER_INDUSTRIES.length)
}

export interface MoneyFlows {
  spendingCents: number
  transportSpendingCents: number
  wagesCents: number
  corporateTaxCents: number
  wealthTaxCents: number
  transfersCents: number
}

export function dailyFlows(metric: DayMetrics | undefined): MoneyFlows {
  return {
    spendingCents: metric?.householdSpendingCents ?? 0,
    transportSpendingCents: metric?.totalTransportRevenueCents ?? 0,
    wagesCents: metric?.totalWagesPaidCents ?? 0,
    corporateTaxCents: metric?.totalCorporateProfitTaxCents ?? 0,
    wealthTaxCents: metric?.totalWealthTaxCollectedCents ?? 0,
    transfersCents: metric?.totalMeansTestedTransfersCents ?? 0,
  }
}

export interface CashStep { label: string; amountCents: number; kind: 'start' | 'in' | 'out' | 'end' }

/** A household's day as a ledger: opening cash, wage in, shopping out, wealth tax out, transfer in, closing cash. */
export function householdCashSteps(household: SimulationState['households'][number]): CashStep[] {
  return [
    { label: 'Started the day', amountCents: household.postFiscalCashCents - household.netCashChangeTodayCents, kind: 'start' },
    { label: 'Wage', amountCents: household.wageTodayCents, kind: 'in' },
    { label: 'Shopping & transport', amountCents: household.spendingTodayCents, kind: 'out' },
    { label: 'Wealth tax', amountCents: household.taxPaidTodayCents, kind: 'out' },
    { label: 'Government transfer', amountCents: household.transferReceivedTodayCents, kind: 'in' },
    { label: 'Ended the day', amountCents: household.postFiscalCashCents, kind: 'end' },
  ]
}

/** Notes when the bounded live history no longer starts at day 1. */
export function historyNote(state: SimulationState) {
  const first = state.metrics[0]?.day ?? 1
  return first > 1 ? ` · days ${first}–${state.day}` : ''
}

export type FirmStatusTone = 'testing' | 'settled' | 'searching' | 'fixed'
export interface FirmStatus { tone: FirmStatusTone; label: string; detail: string }

const EXPERIMENT_LABELS: Record<PriceExperimentType, string> = {
  local_up_1c: '1¢ increase',
  local_down_1c: '1¢ cut',
  local_up_5pct: '5% increase',
  local_down_5pct: '5% cut',
  local_up_10pct: '10% increase',
  local_down_10pct: '10% cut',
  local_down_20pct: '20% cut',
  competitor_match: 'matching the rival',
  competitor_up_1c: 'pricing 1¢ above the rival',
  competitor_down_1c: 'undercutting the rival by 1¢',
  competitor_up_5pct: 'pricing 5% above the rival',
  competitor_down_5pct: 'undercutting the rival by 5%',
}

export const experimentLabel = (type: PriceExperimentType | null | undefined) => type ? EXPERIMENT_LABELS[type] : 'price test'

/** Plain-language description of where a firm's price learner is. */
export function firmStatus(firm: Firm): FirmStatus {
  const { pricing } = firm
  if (firm.industryId === 'transport') return { tone: 'fixed', label: 'Fixed rate', detail: 'Transport charges a set fee per tile travelled.' }
  if (pricing.probing) {
    const what = pricing.experimentPriceCents !== null ? experimentLabel(pricing.experimentType) : `1¢ ${pricing.probeDirection === 'down' ? 'cut' : 'increase'}`
    return { tone: 'testing', label: `Testing ${money(firm.postedPriceCents)}`, detail: `Trying a ${what} against its usual ${money(pricing.incumbentPriceCents)}. It keeps the new price only if earnings improve.` }
  }
  if (pricing.locallySettled) {
    const last = pricing.lastExperimentOutcome === 'adopted' ? ' Its last test was kept.' : pricing.lastExperimentOutcome === 'rejected' ? ' Its last test was dropped.' : ''
    return { tone: 'settled', label: `Settled at ${money(pricing.incumbentPriceCents)}`, detail: `Holding its best-known price and occasionally testing alternatives.${last}` }
  }
  return { tone: 'searching', label: 'Searching', detail: `Still searching for its most profitable price, moving in ${money(pricing.stepSizeCents)} steps.` }
}

export interface FirmSnapshot {
  id: string
  variant: 'a' | 'b'
  name: string
  todayPriceCents: number | null
  nextPriceCents: number
  share: number
  sold: number
  produced: number
  expired: number
  earningsCents: number
  workers: number
  payrollRate: number
  status: FirmStatus
}

export interface IndustrySnapshot {
  industryId: CompetitiveIndustryId
  name: string
  budgetShare: number
  firms: [FirmSnapshot, FirmSnapshot]
  sold: number
  produced: number
  expired: number
  householdsServed: number
}

export function industrySnapshot(state: SimulationState, industryId: CompetitiveIndustryId): IndustrySnapshot {
  const latest = state.metrics.at(-1)
  const industry = state.industries.find(({ id }) => id === industryId)
  const firms = state.firms
    .filter((firm) => firm.industryId === industryId)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((firm): FirmSnapshot => {
      const market = latest?.markets.find(({ firmId }) => firmId === firm.id)
      return {
        id: firm.id,
        variant: firmVariant(firm.id) ?? 'a',
        name: firmName(firm.id, firm.industryId),
        todayPriceCents: market?.postedPriceCents ?? null,
        nextPriceCents: firm.postedPriceCents,
        share: market?.marketShare ?? 0,
        sold: market?.unitsSold ?? 0,
        produced: market?.unitsProduced ?? 0,
        expired: market?.unitsExpired ?? 0,
        earningsCents: market?.preTaxProfitCents ?? 0,
        workers: firm.employeeIds.length,
        payrollRate: firm.payrollFulfillmentRate,
        status: firmStatus(firm),
      }
    }) as [FirmSnapshot, FirmSnapshot]
  const sold = firms.reduce((sum, firm) => sum + firm.sold, 0)
  return {
    industryId,
    name: INDUSTRY_NAMES[industryId],
    budgetShare: (industry?.budgetShareBps ?? 0) / 10_000,
    firms,
    sold,
    produced: firms.reduce((sum, firm) => sum + firm.produced, 0),
    expired: firms.reduce((sum, firm) => sum + firm.expired, 0),
    householdsServed: sold / Math.max(1, state.households.length),
  }
}

/** One row per day with Firm A / Firm B values for an industry. */
export function firmSeries(state: SimulationState, industryId: IndustryId, pick: (market: DayMetrics['markets'][number]) => number) {
  return state.metrics.map((metric) => {
    const row: { day: number; a?: number; b?: number } = { day: metric.day }
    for (const market of metric.markets) {
      if (market.industryId !== industryId) continue
      const variant = firmVariant(market.firmId)
      if (variant) row[variant] = pick(market)
    }
    return row
  })
}

export interface Highlight {
  key: string
  day: number
  tone: 'positive' | 'negative' | 'neutral' | 'policy'
  title: string
  detail?: string
  industryId?: IndustryId
}

const FAILURE_TYPES = new Set(['HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS', 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT'])

/**
 * Turns the raw event ledger into a short, newest-first feed of things worth noticing:
 * price tests that were kept or dropped, Government policy changes, and households that went without.
 */
export function buildHighlights(events: SimulationEvent[], limit = 14): Highlight[] {
  const highlights: Highlight[] = []
  const failures = new Map<string, { day: number; industryId: IndustryId; cash: number; stock: number }>()

  for (const event of events) {
    if (FAILURE_TYPES.has(event.type) && event.industryId) {
      const key = `${event.day}-${event.industryId}`
      const entry = failures.get(key) ?? { day: event.day, industryId: event.industryId, cash: 0, stock: 0 }
      if (event.type === 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT') entry.stock += 1
      else entry.cash += 1
      failures.set(key, entry)
      continue
    }

    const firm = event.firmId ? firmName(event.firmId, event.industryId) : ''
    if (event.type === 'PRICE_EXPERIMENT_ADOPTED') {
      highlights.push({ key: `e${event.id}`, day: event.day, tone: 'positive', industryId: event.industryId, title: `${firm} moved to ${money(event.experimentalPriceCents ?? 0)}`, detail: `A ${experimentLabel(event.experimentType)} raised its earnings, so it kept the new price.` })
    } else if (event.type === 'PRICE_EXPERIMENT_REJECTED') {
      highlights.push({ key: `e${event.id}`, day: event.day, tone: 'neutral', industryId: event.industryId, title: `${firm} went back to ${money(event.incumbentPriceCents ?? 0)}`, detail: `A ${experimentLabel(event.experimentType)} to ${money(event.experimentalPriceCents ?? 0)} didn't improve earnings.` })
    } else if (event.type === 'PRICE_DISCOVERY_CONVERGED') {
      highlights.push({ key: `e${event.id}`, day: event.day, tone: 'positive', industryId: event.industryId, title: `${firm} settled at ${money(event.priceCents ?? 0)}`, detail: 'Its initial price search has finished.' })
    } else if (event.type === 'GOVERNMENT_POLICY_EXPERIMENT_ADOPTED') {
      highlights.push({ key: `e${event.id}`, day: event.day, tone: 'policy', title: `Wealth tax changed to ${bps(event.taxRateBps ?? 0)}`, detail: `Previously ${bps(event.incumbentTaxRateBps ?? 0)}. ${event.effectiveEqualityAfter ? 'Households stayed effectively equal.' : 'Inequality fell.'}` })
    } else if (event.type === 'GOVERNMENT_POLICY_EXPERIMENT_REJECTED') {
      highlights.push({ key: `e${event.id}`, day: event.day, tone: 'neutral', title: `Government kept the wealth tax at ${bps(event.incumbentTaxRateBps ?? 0)}`, detail: `A trial at ${bps(event.taxRateBps ?? 0)} ${event.governmentPolicyMode === 'minimizing_tax' ? 'would have broken equality' : 'did not reduce inequality'}.` })
    }
  }

  const byDay = new Map<number, { cash: number; stock: number; parts: string[] }>()
  for (const entry of failures.values()) {
    const day = byDay.get(entry.day) ?? { cash: 0, stock: 0, parts: [] }
    day.cash += entry.cash
    day.stock += entry.stock
    const reasons = [entry.cash ? `${entry.cash} couldn't afford` : '', entry.stock ? `${entry.stock} sold out` : ''].filter(Boolean).join(', ')
    day.parts.push(`${INDUSTRY_NAMES[entry.industryId]}: ${reasons}`)
    byDay.set(entry.day, day)
  }
  for (const [day, entry] of byDay) {
    const total = entry.cash + entry.stock
    highlights.push({ key: `missed-${day}`, day, tone: 'negative', title: `${total} ${total === 1 ? 'purchase' : 'purchases'} missed`, detail: entry.parts.join(' · ') })
  }

  return highlights.sort((a, b) => b.day - a.day).slice(0, limit)
}
