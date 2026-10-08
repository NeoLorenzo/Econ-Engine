import { INITIAL_HOUSEHOLD_CASH_CENTS, firmSlot } from '../sim/config'
import { transportQuote } from '../sim/spatial'
import type { Coordinate, IndustryId, Plot, SimulationState } from '../sim/types'

export type WorldEntityKind = 'household' | 'firm' | 'government'
export type CompetitiveIndustryId = Exclude<IndustryId, 'transport'>

export interface MarketTerritoryCell {
  coordinate: Coordinate
  x: number
  z: number
  ownerFirmId: string
  deliveredCostCents: number
  competingDeliveredCostCents: number
  tie: boolean
}

export interface HouseholdChoiceObservation {
  householdId: string
  industryId: CompetitiveIndustryId
  outcome: 'not_run' | 'purchased' | 'insufficient_funds' | 'stockout'
  chosenFirmId: string | null
  productPriceCents: number | null
  oneWayDistance: number | null
  roundTripTiles: number | null
  transportFeeCents: number | null
  deliveredCostCents: number | null
  /** One-way distance to every firm in the industry, keyed by firm ID; null before the market has run. */
  distancesByFirmId: Record<string, number> | null
}

export interface MarketTerritory {
  industryId: CompetitiveIndustryId
  /** Every firm in the market, in slot order (Firm A first). */
  firmIds: string[]
  cells: MarketTerritoryCell[]
  cellCounts: Record<string, number>
  tieCount: number
}

export interface WorldEntity {
  id: string
  kind: WorldEntityKind
  x: number
  z: number
  /** Tiles covered along x (width) and along z (depth): 1 × 1 for a house, the plot's size otherwise. */
  footprint: { width: number; depth: number }
  height: number
  industryId?: IndustryId
  /** A consumer firm's position in its market (0 is Firm A); undefined for households and Transport. */
  firmSlot?: number
  /** A household's house: 0 shack, 1 cottage, 2 two-storey house, 3 villa. Undefined for firms and Government. */
  tier?: HouseTier
}

export interface EmploymentNetworkObservation {
  selectedEntityId: string
  firmId: string
  workerIds: string[]
  selectedHouseholdId: string | null
}

export function worldPoint(coordinate: Coordinate, gridWidth: number, gridHeight: number) {
  return {
    x: coordinate.x - (gridWidth - 1) / 2,
    z: coordinate.y - (gridHeight - 1) / 2,
  }
}

/** Cubic in cash relative to the starting amount, so the few-dollar gaps typical of this economy stay visible. */
export function householdWealthHeight(cashCents: number, targetCashCents = 5_000) {
  const safeTarget = Math.max(1, targetCashCents)
  const ratio = Math.max(0, cashCents) / safeTarget
  return Math.min(6, Math.max(0.18, 0.18 + ratio ** 3 * 1.52))
}

export type HouseTier = 0 | 1 | 2 | 3

/**
 * Discrete wealth tiers for the town's houses, relative to starting cash: below 85%, from 85%, from 95% and from
 * 105%. Each lower bound is inclusive. Household cash in this economy stays within a few dollars of the start (about
 * 80–115% before tax, and 100% after Government evens it out), so the bands sit close around 100% to keep those gaps
 * visible. The overlay pillars show exact cash; tiers keep the town readable.
 */
export function houseTier(cashCents: number, startingCashCents = INITIAL_HOUSEHOLD_CASH_CENTS): HouseTier {
  // Whole percentages of the starting cash, compared exactly.
  const percent = cashCents * 100
  const start = Math.max(1, startingCashCents)
  if (percent >= start * 105) return 3
  if (percent >= start * 95) return 2
  if (percent >= start * 85) return 1
  return 0
}

/** Which household cash figure sets pillar height and house tier: before or after Government's tax and transfers. */
export type CashMeasure = 'before' | 'after'

/** Which relationship lines the map draws: who a household bought from, or who works where. */
export type LinkMode = 'purchases' | 'jobs'

/** The world point at the centre of a plot. */
export function plotCentre(plot: Plot, gridWidth: number, gridHeight: number) {
  return {
    x: plot.x + (plot.width - 1) / 2 - (gridWidth - 1) / 2,
    z: plot.y + (plot.height - 1) / 2 - (gridHeight - 1) / 2,
  }
}

/** Households that received a Government transfer today, in household order. */
export function getTransferRecipientIds(state: SimulationState) {
  return state.households.filter(({ transferReceivedTodayCents }) => transferReceivedTodayCents > 0).map(({ id }) => id)
}

export function buildWorldEntities(state: SimulationState, measure: CashMeasure = 'after'): WorldEntity[] {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  const targetCashCents = INITIAL_HOUSEHOLD_CASH_CENTS
  const onPlot = (plot: Plot) => ({
    ...plotCentre(plot, width, height),
    footprint: { width: plot.width, depth: plot.height },
  })

  const households: WorldEntity[] = state.households.map((household) => {
    const point = worldPoint(household.coordinate, width, height)
    const cashCents = measure === 'before' ? household.preTaxCashCents : household.postFiscalCashCents
    return {
      id: household.id,
      kind: 'household',
      x: point.x,
      z: point.z,
      footprint: { width: 1, depth: 1 },
      height: householdWealthHeight(cashCents, targetCashCents),
      tier: houseTier(cashCents, targetCashCents),
    }
  })

  const firms: WorldEntity[] = state.firms.map((firm) => ({
    id: firm.id,
    kind: 'firm',
    ...onPlot(firm.plot),
    height: firm.industryId === 'transport' ? 2.8 : 2.4,
    industryId: firm.industryId,
    firmSlot: firmSlot(firm.id) ?? undefined,
  }))

  const government: WorldEntity = {
    id: state.government.id,
    kind: 'government',
    ...onPlot(state.government.plot),
    height: 3.2,
  }

  return [...households, ...firms, government]
}

export function buildMarketTerritory(state: SimulationState, industryId: CompetitiveIndustryId): MarketTerritory {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  const transportRateCents = state.config.transportCostPerTileCents ?? 0
  const firms = state.firms
    .filter((firm): firm is typeof firm & { industryId: CompetitiveIndustryId } => firm.industryId === industryId)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (firms.length === 0) throw new Error(`Market territory requires at least one spatial firm for ${industryId}`)

  const cellCounts: Record<string, number> = Object.fromEntries(firms.map((firm) => [firm.id, 0]))
  let tieCount = 0
  const cells: MarketTerritoryCell[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const coordinate = { x, y }
      // Cheapest delivered cost owns the tile; an exact tie goes to the earlier slot and is flagged.
      const costs = firms
        .map((firm) => ({
          firm,
          cost: firm.postedPriceCents + transportQuote(coordinate, firm.plot, transportRateCents).transportFeeCents,
        }))
        .sort((left, right) => left.cost - right.cost)
      const [owner, runnerUp] = costs
      const tie = runnerUp !== undefined && runnerUp.cost === owner!.cost
      if (tie) tieCount += 1
      cellCounts[owner!.firm.id] += 1
      const point = worldPoint(coordinate, width, height)
      cells.push({
        coordinate,
        x: point.x,
        z: point.z,
        ownerFirmId: owner!.firm.id,
        deliveredCostCents: owner!.cost,
        competingDeliveredCostCents: runnerUp?.cost ?? owner!.cost,
        tie,
      })
    }
  }

  return {
    industryId,
    firmIds: firms.map(({ id }) => id),
    cells,
    cellCounts,
    tieCount,
  }
}

export function getHouseholdChoiceObservation(
  state: SimulationState,
  householdId: string,
  industryId: CompetitiveIndustryId,
): HouseholdChoiceObservation {
  const household = state.households.find(({ id }) => id === householdId)
  if (!household) throw new Error(`Unknown household ${householdId}`)

  const outcome = household.industryOutcomes[industryId]
  const spatial = household.spatialPurchasesToday[industryId]
  const normalizedOutcome = outcome.purchaseOutcomeToday ?? 'not_run'

  if (!spatial) {
    return {
      householdId,
      industryId,
      outcome: normalizedOutcome,
      chosenFirmId: null,
      productPriceCents: null,
      oneWayDistance: null,
      roundTripTiles: null,
      transportFeeCents: null,
      deliveredCostCents: null,
      distancesByFirmId: null,
    }
  }

  return {
    householdId,
    industryId,
    outcome: normalizedOutcome,
    chosenFirmId: spatial.chosenFirmId,
    productPriceCents: spatial.chosenFirmId ? spatial.productPriceCents : null,
    oneWayDistance: spatial.chosenOneWayDistance,
    roundTripTiles: spatial.chosenFirmId ? spatial.roundTripTiles : null,
    transportFeeCents: spatial.chosenFirmId ? spatial.transportFeeCents : null,
    deliveredCostCents: spatial.chosenFirmId ? spatial.deliveredCostCents : null,
    distancesByFirmId: spatial.distancesByFirmId,
  }
}

export function getEmploymentNetworkObservation(
  state: SimulationState,
  selectedEntityId: string,
): EmploymentNetworkObservation {
  const firm = state.firms.find(({ id }) => id === selectedEntityId)
  if (firm) {
    return {
      selectedEntityId,
      firmId: firm.id,
      workerIds: [...firm.employeeIds],
      selectedHouseholdId: null,
    }
  }

  const household = state.households.find(({ id }) => id === selectedEntityId)
  if (!household) throw new Error(`Unknown employment-network entity ${selectedEntityId}`)

  const employer = state.firms.find(({ id }) => id === household.employerFirmId)
  if (!employer) throw new Error(`Unknown employer ${household.employerFirmId} for ${household.id}`)

  return {
    selectedEntityId,
    firmId: employer.id,
    workerIds: [household.id],
    selectedHouseholdId: household.id,
  }
}
