import { INITIAL_HOUSEHOLD_CASH_CENTS, firmSlot } from '../sim/config'
import { transportQuote } from '../sim/spatial'
import type { Coordinate, IndustryId, SimulationState } from '../sim/types'

export type WorldEntityKind = 'household' | 'firm'
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
  height: number
  industryId?: IndustryId
  /** A consumer firm's position in its market (0 is Firm A); undefined for households and Transport. */
  firmSlot?: number
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

/** Which household cash figure sets pillar height: before or after Government's tax and transfers. */
export type CashMeasure = 'before' | 'after'

/** Which relationship lines the map draws: who a household bought from, or who works where. */
export type LinkMode = 'purchases' | 'jobs'

export function buildWorldEntities(state: SimulationState, measure: CashMeasure = 'after'): WorldEntity[] {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  const targetCashCents = INITIAL_HOUSEHOLD_CASH_CENTS

  const households: WorldEntity[] = state.households.map((household) => {
    const point = worldPoint(household.coordinate, width, height)
    return {
      id: household.id,
      kind: 'household',
      x: point.x,
      z: point.z,
      height: householdWealthHeight(
        measure === 'before' ? household.preTaxCashCents : household.postFiscalCashCents,
        targetCashCents,
      ),
    }
  })

  const firms: WorldEntity[] = state.firms.map((firm) => {
    if (!firm.coordinate && firm.industryId !== 'transport') {
      throw new Error(`Spatial consumer firm ${firm.id} is missing its authoritative coordinate`)
    }
    const point = firm.coordinate ? worldPoint(firm.coordinate, width, height) : { x: -(width / 2) - 1.6, z: 0 }

    return {
      id: firm.id,
      kind: 'firm',
      x: point.x,
      z: point.z,
      height: firm.industryId === 'transport' ? 2.8 : 2.4,
      industryId: firm.industryId,
      firmSlot: firmSlot(firm.id) ?? undefined,
    }
  })

  return [...households, ...firms]
}

export function buildMarketTerritory(state: SimulationState, industryId: CompetitiveIndustryId): MarketTerritory {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  const transportRateCents = state.config.transportCostPerTileCents ?? 0
  const firms = state.firms
    .filter(
      (firm): firm is typeof firm & { industryId: CompetitiveIndustryId; coordinate: Coordinate } =>
        firm.industryId === industryId && firm.coordinate !== undefined,
    )
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
          cost:
            firm.postedPriceCents + transportQuote(coordinate, firm.coordinate, transportRateCents).transportFeeCents,
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
