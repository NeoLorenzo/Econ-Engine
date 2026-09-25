import { transportQuote } from '../sim/spatial'
import type { Coordinate, IndustryId, SimulationState } from '../sim/types'

export type WorldEntityKind = 'household' | 'firm'
export type CompetitiveIndustryId = Exclude<IndustryId, 'transport'>

export interface MarketTerritoryCell {
  coordinate: Coordinate
  x: number
  z: number
  ownerFirmId: string
  ownerVariant: 'a' | 'b'
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
  distanceToA: number | null
  distanceToB: number | null
}

export interface MarketTerritory {
  industryId: CompetitiveIndustryId
  firmIds: [string, string]
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
  firmVariant?: 'a' | 'b'
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

export function householdWealthHeight(cashCents: number, targetCashCents = 5_000) {
  const safeTarget = Math.max(1, targetCashCents)
  const ratio = Math.max(0, cashCents) / safeTarget
  return Math.min(6, Math.max(0.18, 0.18 + ratio * 1.52))
}

export function buildWorldEntities(state: SimulationState): WorldEntity[] {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  const targetCashCents = state.config.targetHouseholdCashCents ?? 5_000

  const households: WorldEntity[] = state.households.map((household) => {
    const point = worldPoint(household.coordinate, width, height)
    return {
      id: household.id,
      kind: 'household',
      x: point.x,
      z: point.z,
      height: householdWealthHeight(household.postFiscalCashCents, targetCashCents),
    }
  })

  const firms: WorldEntity[] = state.firms.map((firm) => {
    if (!firm.coordinate && firm.industryId !== 'transport') {
      throw new Error(`Spatial consumer firm ${firm.id} is missing its authoritative coordinate`)
    }
    const point = firm.coordinate
      ? worldPoint(firm.coordinate, width, height)
      : { x: -(width / 2) - 1.6, z: 0 }

    return {
      id: firm.id,
      kind: 'firm',
      x: point.x,
      z: point.z,
      height: firm.industryId === 'transport' ? 2.8 : 2.4,
      industryId: firm.industryId,
      firmVariant: firm.industryId === 'transport' ? undefined : firm.id.endsWith('-b') ? 'b' : 'a',
    }
  })

  return [...households, ...firms]
}

export function buildMarketTerritory(state: SimulationState, industryId: CompetitiveIndustryId): MarketTerritory {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  const transportRateCents = state.config.transportCostPerTileCents ?? 0
  const firms = state.firms
    .filter((firm): firm is typeof firm & { industryId: CompetitiveIndustryId; coordinate: Coordinate } => firm.industryId === industryId && firm.coordinate !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (firms.length !== 2) throw new Error(`Market territory requires exactly two spatial firms for ${industryId}`)

  const [firmA, firmB] = firms
  const cellCounts: Record<string, number> = { [firmA.id]: 0, [firmB.id]: 0 }
  let tieCount = 0
  const cells: MarketTerritoryCell[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const coordinate = { x, y }
      const aCost = firmA.postedPriceCents + transportQuote(coordinate, firmA.coordinate, transportRateCents).transportFeeCents
      const bCost = firmB.postedPriceCents + transportQuote(coordinate, firmB.coordinate, transportRateCents).transportFeeCents
      const tie = aCost === bCost
      const owner = aCost <= bCost ? firmA : firmB
      const competingCost = owner.id === firmA.id ? bCost : aCost
      if (tie) tieCount += 1
      cellCounts[owner.id] += 1
      const point = worldPoint(coordinate, width, height)
      cells.push({
        coordinate,
        x: point.x,
        z: point.z,
        ownerFirmId: owner.id,
        ownerVariant: owner.id === firmA.id ? 'a' : 'b',
        deliveredCostCents: Math.min(aCost, bCost),
        competingDeliveredCostCents: competingCost,
        tie,
      })
    }
  }

  return {
    industryId,
    firmIds: [firmA.id, firmB.id],
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
      distanceToA: null,
      distanceToB: null,
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
    distanceToA: spatial.distanceToA,
    distanceToB: spatial.distanceToB,
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
