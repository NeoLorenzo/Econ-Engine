import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../sim/config'
import { createSimulation, stepSimulation } from '../sim/engine'
import { buildMarketTerritory, buildWorldEntities, getEmploymentNetworkObservation, getHouseholdChoiceObservation, householdWealthHeight, worldPoint } from './worldViewModel'

describe('3D world observer model', () => {
  it('maps the canonical simulation to 100 households, 8 consumer firms, and Transport', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const entities = buildWorldEntities(state)
    const firmEntities = entities.filter(({ kind }) => kind === 'firm')

    expect(entities.filter(({ kind }) => kind === 'household')).toHaveLength(100)
    expect(firmEntities).toHaveLength(9)
    expect(firmEntities.filter(({ industryId }) => industryId !== 'transport')).toHaveLength(8)
    expect(firmEntities.some(({ id }) => id === 'firm-transport')).toBe(true)
    expect(buildMarketTerritory(state, 'food').cells).toHaveLength(400)
  })

  it('centres authoritative grid coordinates without mutating them', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const household = state.households[0]!
    const original = { ...household.coordinate }
    const point = worldPoint(household.coordinate, state.config.gridWidth ?? 20, state.config.gridHeight ?? 20)
    const descriptor = buildWorldEntities(state).find(({ id }) => id === household.id)!

    expect({ x: descriptor.x, z: descriptor.z }).toEqual(point)
    expect(household.coordinate).toEqual(original)
  })

  it('classifies delivered-cost territory cells with deterministic ties', () => {
    const base = createSimulation({ seed: DEFAULT_SEED })
    const state = {
      ...base,
      config: { ...base.config, gridWidth: 3, gridHeight: 1, transportCostPerTileCents: 2 },
      firms: base.firms.map((firm) => {
        if (firm.id === 'firm-food-a') return { ...firm, coordinate: { x: 0, y: 0 }, postedPriceCents: 200 }
        if (firm.id === 'firm-food-b') return { ...firm, coordinate: { x: 2, y: 0 }, postedPriceCents: 200 }
        return firm
      }),
    }

    const territory = buildMarketTerritory(state, 'food')

    expect(territory.cells).toHaveLength(3)
    expect(territory.cells.map(({ ownerFirmId }) => ownerFirmId)).toEqual(['firm-food-a', 'firm-food-a', 'firm-food-b'])
    expect(territory.cells[1]).toMatchObject({
      coordinate: { x: 1, y: 0 },
      deliveredCostCents: 204,
      competingDeliveredCostCents: 204,
      tie: true,
    })
    expect(territory.tieCount).toBe(1)
    expect(territory.cellCounts).toEqual({ 'firm-food-a': 2, 'firm-food-b': 1 })
  })

  it('moves territory when an authoritative posted price changes', () => {
    const base = createSimulation({ seed: DEFAULT_SEED })
    const state = {
      ...base,
      config: { ...base.config, gridWidth: 3, gridHeight: 1, transportCostPerTileCents: 2 },
      firms: base.firms.map((firm) => {
        if (firm.id === 'firm-food-a') return { ...firm, coordinate: { x: 0, y: 0 }, postedPriceCents: 200 }
        if (firm.id === 'firm-food-b') return { ...firm, coordinate: { x: 2, y: 0 }, postedPriceCents: 190 }
        return firm
      }),
    }

    const territory = buildMarketTerritory(state, 'food')
    expect(territory.cells.every(({ ownerFirmId }) => ownerFirmId === 'firm-food-b')).toBe(true)
    expect(territory.cells[0]?.deliveredCostCents).toBe(198)
  })


  it('reads a purchased household choice directly from authoritative current-day state', () => {
    const state = stepSimulation(createSimulation({ seed: DEFAULT_SEED }))
    const household = state.households.find(({ industryOutcomes }) => industryOutcomes.food.purchaseOutcomeToday === 'purchased')!
    const spatial = household.spatialPurchasesToday.food!

    const observation = getHouseholdChoiceObservation(state, household.id, 'food')

    expect(observation).toEqual({
      householdId: household.id,
      industryId: 'food',
      outcome: 'purchased',
      chosenFirmId: spatial.chosenFirmId,
      productPriceCents: spatial.productPriceCents,
      oneWayDistance: spatial.chosenOneWayDistance,
      roundTripTiles: spatial.roundTripTiles,
      transportFeeCents: spatial.transportFeeCents,
      deliveredCostCents: spatial.deliveredCostCents,
      distanceToA: spatial.distanceToA,
      distanceToB: spatial.distanceToB,
    })
  })

  it('represents a failed purchase without inventing a firm or transaction values', () => {
    const state = stepSimulation(createSimulation({ seed: DEFAULT_SEED }))
    const household = state.households[0]!
    const failedState = {
      ...state,
      households: state.households.map((candidate) => candidate.id === household.id ? {
        ...candidate,
        industryOutcomes: {
          ...candidate.industryOutcomes,
          food: { ...candidate.industryOutcomes.food, purchasedToday: false, purchaseOutcomeToday: 'stockout' as const, spentTodayCents: 0 },
        },
        spatialPurchasesToday: {
          ...candidate.spatialPurchasesToday,
          food: {
            chosenFirmId: null,
            distanceToA: 3,
            distanceToB: 7,
            chosenOneWayDistance: null,
            roundTripTiles: 0,
            productPriceCents: 0,
            transportFeeCents: 0,
            deliveredCostCents: 0,
          },
        },
      } : candidate),
    }

    expect(getHouseholdChoiceObservation(failedState, household.id, 'food')).toEqual({
      householdId: household.id,
      industryId: 'food',
      outcome: 'stockout',
      chosenFirmId: null,
      productPriceCents: null,
      oneWayDistance: null,
      roundTripTiles: null,
      transportFeeCents: null,
      deliveredCostCents: null,
      distanceToA: 3,
      distanceToB: 7,
    })
  })

  it('represents an unprocessed day without inventing spatial choice data', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const household = state.households[0]!
    expect(getHouseholdChoiceObservation(state, household.id, 'food')).toMatchObject({
      outcome: 'not_run',
      chosenFirmId: null,
      productPriceCents: null,
      deliveredCostCents: null,
    })
  })

  it('maps a selected firm to its authoritative worker set', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const transport = state.firms.find(({ id }) => id === 'firm-transport')!
    const observation = getEmploymentNetworkObservation(state, transport.id)

    expect(observation.firmId).toBe(transport.id)
    expect(observation.workerIds).toEqual(transport.employeeIds)
    expect(observation.workerIds).toHaveLength(20)
    expect(observation.selectedHouseholdId).toBeNull()
  })

  it('maps a selected household to its authoritative employer only', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const household = state.households[0]!
    const observation = getEmploymentNetworkObservation(state, household.id)

    expect(observation).toEqual({
      selectedEntityId: household.id,
      firmId: household.employerFirmId,
      workerIds: [household.id],
      selectedHouseholdId: household.id,
    })
  })

  it('preserves canonical employment cardinality across all firms', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const workerIds = state.firms.flatMap((firm) => getEmploymentNetworkObservation(state, firm.id).workerIds)

    expect(workerIds).toHaveLength(100)
    expect(new Set(workerIds).size).toBe(100)
    expect(state.firms.filter(({ industryId }) => industryId !== 'transport').every(({ employeeIds }) => employeeIds.length === 10)).toBe(true)
    expect(state.firms.find(({ id }) => id === 'firm-transport')?.employeeIds).toHaveLength(20)
  })

  it('encodes household cash monotonically with bounded pillar height', () => {
    expect(householdWealthHeight(0)).toBe(0.18)
    expect(householdWealthHeight(2_500)).toBeLessThan(householdWealthHeight(5_000))
    expect(householdWealthHeight(5_000)).toBeLessThan(householdWealthHeight(10_000))
    expect(householdWealthHeight(1_000_000)).toBe(6)
  })
})
