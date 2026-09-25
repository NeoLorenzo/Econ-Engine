import type { Coordinate, IndustryId, SimulationState } from '../sim/types'

export type WorldEntityKind = 'household' | 'firm'

export interface WorldEntity {
  id: string
  kind: WorldEntityKind
  x: number
  z: number
  height: number
  industryId?: Exclude<IndustryId, 'transport'>
  firmVariant?: 'a' | 'b'
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

  const firms: WorldEntity[] = state.firms
    .filter((firm): firm is typeof firm & { industryId: Exclude<IndustryId, 'transport'>; coordinate: Coordinate } => firm.industryId !== 'transport' && firm.coordinate !== undefined)
    .map((firm) => {
      const point = worldPoint(firm.coordinate, width, height)
      return {
        id: firm.id,
        kind: 'firm',
        x: point.x,
        z: point.z,
        height: 2.4,
        industryId: firm.industryId,
        firmVariant: firm.id.endsWith('-b') ? 'b' : 'a',
      }
    })

  return [...households, ...firms]
}
