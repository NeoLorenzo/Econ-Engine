import { DEFAULT_SEED } from './config'
import { createSimulation, stepSimulation } from './engine'
import type { IndustryId, MarketMetrics } from './types'

export const COMPETITIVE_ANALYSIS_HORIZON_DAYS = 1_000
const CONSUMER_IDS = ['food', 'utilities', 'healthcare', 'entertainment'] as const
type ConsumerIndustryId = Exclude<IndustryId, 'transport'>
type Leader = 'A' | 'B' | 'tie'

export interface CompetitiveFirmObservation {
  marketShare: number
  unitsSold: number
  postedPriceCents: number
  incumbentPriceCents: number
  profitCents: number
}

export interface CompetitiveDayObservation {
  a: CompetitiveFirmObservation
  b: CompetitiveFirmObservation
}

export interface SpellAnalytics {
  count: number
  longestDays: number
  averageDays: number
}

export interface FirmTemporalAnalytics {
  daysLeading: number
  fractionDaysLeading: number
  meanDailyMarketShare: number
  totalUnitsSold: number
  cumulativeSalesShare: number
  leadingSpells: SpellAnalytics
  daysAtFullShare: number
  fractionDaysAtFullShare: number
  fullShareSpells: SpellAnalytics
  meanPostedPriceCents: number
  minimumPostedPriceCents: number
  maximumPostedPriceCents: number
  meanIncumbentPriceCents: number
  minimumIncumbentPriceCents: number
  maximumIncumbentPriceCents: number
  cumulativeProfitCents: number
  meanDailyProfitCents: number
  fractionIndustryProfit: number
}

export interface CompetitiveTemporalAnalytics {
  horizonDays: number
  tieDays: number
  fractionDaysTied: number
  leadershipChanges: number
  firmA: FirmTemporalAnalytics
  firmB: FirmTemporalAnalytics
  terminalSnapshot: {
    day: number
    marketShares: [number, number]
    postedPricesCents: [number, number]
    incumbentPricesCents: [number, number]
  }
}

export interface GeneralizedIndustryResult {
  industryId: ConsumerIndustryId
  firmLocations: Record<string, { x: number; y: number }>
  analytics: CompetitiveTemporalAnalytics
  averageCustomerDistancesAtHorizon: [number, number]
  averageDeliveredCostsCentsAtHorizon: [number, number]
  transportRevenueCentsAtHorizon: number
  priceTrajectories: Record<string, number[]>
}

export interface GeneralizedSpatialResult {
  seed: number
  householdLocations: Record<string, { x: number; y: number }>
  industries: GeneralizedIndustryResult[]
  totalTransportRevenueCentsAtHorizon: number
  totalTripsAtHorizon: number
  totalTilesAtHorizon: number
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

function spells(matches: boolean[]): SpellAnalytics {
  const lengths: number[] = []
  let current = 0
  for (const matchesToday of matches) {
    if (matchesToday) current += 1
    else if (current > 0) { lengths.push(current); current = 0 }
  }
  if (current > 0) lengths.push(current)
  return { count: lengths.length, longestDays: Math.max(0, ...lengths), averageDays: lengths.length === 0 ? 0 : mean(lengths) }
}

function leader(day: CompetitiveDayObservation): Leader {
  if (day.a.marketShare > day.b.marketShare) return 'A'
  if (day.b.marketShare > day.a.marketShare) return 'B'
  return 'tie'
}

export function analyzeCompetitiveTrajectory(days: readonly CompetitiveDayObservation[]): CompetitiveTemporalAnalytics {
  if (days.length === 0) throw new Error('Competitive trajectory requires at least one observed day.')
  const leaders = days.map(leader)
  const daysALeads = leaders.filter((value) => value === 'A').length
  const daysBLeads = leaders.filter((value) => value === 'B').length
  const tieDays = leaders.filter((value) => value === 'tie').length
  let leadershipChanges = 0
  let previousNonTie: Exclude<Leader, 'tie'> | undefined
  for (const value of leaders) {
    if (value === 'tie') continue
    if (previousNonTie !== undefined && previousNonTie !== value) leadershipChanges += 1
    previousNonTie = value
  }
  const totalUnits = days.reduce((sum, day) => sum + day.a.unitsSold + day.b.unitsSold, 0)
  const totalProfit = days.reduce((sum, day) => sum + day.a.profitCents + day.b.profitCents, 0)
  const buildFirm = (key: 'a' | 'b', designation: Exclude<Leader, 'tie'>): FirmTemporalAnalytics => {
    const observations = days.map((day) => day[key])
    const totalUnitsSold = observations.reduce((sum, day) => sum + day.unitsSold, 0)
    const cumulativeProfitCents = observations.reduce((sum, day) => sum + day.profitCents, 0)
    const postedPrices = observations.map(({ postedPriceCents }) => postedPriceCents)
    const incumbentPrices = observations.map(({ incumbentPriceCents }) => incumbentPriceCents)
    const daysLeading = designation === 'A' ? daysALeads : daysBLeads
    return {
      daysLeading,
      fractionDaysLeading: daysLeading / days.length,
      meanDailyMarketShare: mean(observations.map(({ marketShare }) => marketShare)),
      totalUnitsSold,
      cumulativeSalesShare: totalUnits === 0 ? 0 : totalUnitsSold / totalUnits,
      leadingSpells: spells(leaders.map((value) => value === designation)),
      daysAtFullShare: observations.filter(({ marketShare }) => marketShare === 1).length,
      fractionDaysAtFullShare: observations.filter(({ marketShare }) => marketShare === 1).length / days.length,
      fullShareSpells: spells(observations.map(({ marketShare }) => marketShare === 1)),
      meanPostedPriceCents: mean(postedPrices),
      minimumPostedPriceCents: Math.min(...postedPrices),
      maximumPostedPriceCents: Math.max(...postedPrices),
      meanIncumbentPriceCents: mean(incumbentPrices),
      minimumIncumbentPriceCents: Math.min(...incumbentPrices),
      maximumIncumbentPriceCents: Math.max(...incumbentPrices),
      cumulativeProfitCents,
      meanDailyProfitCents: cumulativeProfitCents / days.length,
      fractionIndustryProfit: totalProfit === 0 ? 0 : cumulativeProfitCents / totalProfit,
    }
  }
  const terminal = days.at(-1)!
  return {
    horizonDays: days.length,
    tieDays,
    fractionDaysTied: tieDays / days.length,
    leadershipChanges,
    firmA: buildFirm('a', 'A'),
    firmB: buildFirm('b', 'B'),
    terminalSnapshot: {
      day: days.length,
      marketShares: [terminal.a.marketShare, terminal.b.marketShare],
      postedPricesCents: [terminal.a.postedPriceCents, terminal.b.postedPriceCents],
      incumbentPricesCents: [terminal.a.incumbentPriceCents, terminal.b.incumbentPriceCents],
    },
  }
}

function observation(market: MarketMetrics): CompetitiveFirmObservation {
  return { marketShare: market.marketShare, unitsSold: market.unitsSold, postedPriceCents: market.postedPriceCents, incumbentPriceCents: market.incumbentPriceCents, profitCents: market.preTaxProfitCents }
}

export function runGeneralizedSpatialExperiment(seeds = [DEFAULT_SEED, 7, 42], days = COMPETITIVE_ANALYSIS_HORIZON_DAYS): GeneralizedSpatialResult[] {
  if (!Number.isInteger(days) || days < 1) throw new Error('Experiment horizon must be a positive integer.')
  return seeds.map((seed) => {
    let state = createSimulation({ startingPriceCents: 100, initialStepCents: 100, dailySupplyPerIndustry: 10, seed })
    const trajectories = Object.fromEntries(CONSUMER_IDS.map((id) => [id, [] as CompetitiveDayObservation[]])) as Record<ConsumerIndustryId, CompetitiveDayObservation[]>
    const priceTrajectories: Record<string, number[]> = {}
    for (let day = 0; day < days; day += 1) {
      state = stepSimulation(state)
      const latest = state.metrics.at(-1)!
      for (const industryId of CONSUMER_IDS) {
        const markets = latest.markets.filter((market) => market.industryId === industryId)
        trajectories[industryId].push({ a: observation(markets[0]), b: observation(markets[1]) })
        for (const market of markets) (priceTrajectories[market.firmId] ??= []).push(market.postedPriceCents)
      }
    }
    const latest = state.metrics.at(-1)!
    return {
      seed,
      householdLocations: Object.fromEntries(state.households.map(({ id, coordinate }) => [id, coordinate])),
      industries: CONSUMER_IDS.map((industryId) => {
        const firms = state.firms.filter((firm) => firm.industryId === industryId)
        const markets = firms.map((firm) => latest.markets.find((market) => market.firmId === firm.id)!)
        return {
          industryId,
          firmLocations: Object.fromEntries(firms.map(({ id, coordinate }) => [id, coordinate!])),
          analytics: analyzeCompetitiveTrajectory(trajectories[industryId]),
          averageCustomerDistancesAtHorizon: markets.map(({ averageCustomerDistance }) => averageCustomerDistance) as [number, number],
          averageDeliveredCostsCentsAtHorizon: markets.map(({ averageDeliveredCostCents }) => averageDeliveredCostCents) as [number, number],
          transportRevenueCentsAtHorizon: latest.transportRevenueByIndustryCents[industryId] ?? 0,
          priceTrajectories: Object.fromEntries(firms.map((firm) => [firm.id, priceTrajectories[firm.id]])),
        }
      }),
      totalTransportRevenueCentsAtHorizon: latest.totalTransportRevenueCents,
      totalTripsAtHorizon: latest.entertainmentTrips,
      totalTilesAtHorizon: latest.totalTilesTravelled,
    }
  })
}
