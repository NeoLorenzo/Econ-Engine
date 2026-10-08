import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../sim/config'
import { createSimulation, stepSimulation } from '../sim/engine'
import {
  buildMarketTerritory,
  buildWorldEntities,
  getEmploymentNetworkObservation,
  getHouseholdChoiceObservation,
  getTransferRecipientIds,
  householdWealthHeight,
  houseTier,
  institutionTiles,
  worldPoint,
} from './worldViewModel'

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

  it('places Government and Transport on the free tiles nearest the centre without giving them coordinates', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    const width = state.config.gridWidth ?? 20
    const height = state.config.gridHeight ?? 20
    const tiles = institutionTiles(state)
    const occupied = new Set(
      [
        ...state.households.map(({ coordinate }) => coordinate),
        ...state.firms.flatMap(({ coordinate }) => coordinate ?? []),
      ].map(({ x, y }) => `${x},${y}`),
    )
    const centreDistance = ({ x, y }: { x: number; y: number }) =>
      (x - (width - 1) / 2) ** 2 + (y - (height - 1) / 2) ** 2
    const freeDistances = Array.from({ length: width * height }, (_, index) => ({
      x: index % width,
      y: Math.floor(index / width),
    }))
      .filter(({ x, y }) => !occupied.has(`${x},${y}`))
      .map(centreDistance)
      .sort((a, b) => a - b)

    expect(tiles.government).not.toBeNull()
    expect(tiles.transport).not.toBeNull()
    expect(tiles.government).not.toEqual(tiles.transport)
    for (const tile of [tiles.government!, tiles.transport!]) expect(occupied.has(`${tile.x},${tile.y}`)).toBe(false)
    expect(centreDistance(tiles.government!)).toBe(freeDistances[0])
    expect(centreDistance(tiles.transport!)).toBe(freeDistances[1])

    const entities = buildWorldEntities(state)
    const government = entities.find(({ id }) => id === state.government.id)!
    const transport = entities.find(({ id }) => id === 'firm-transport')!
    expect(government.kind).toBe('government')
    expect({ x: government.x, z: government.z }).toEqual(worldPoint(tiles.government!, width, height))
    expect({ x: transport.x, z: transport.z }).toEqual(worldPoint(tiles.transport!, width, height))
    // The tiles are for display only: the simulation still gives neither a location.
    expect(state.firms.find(({ id }) => id === 'firm-transport')!.coordinate).toBeUndefined()
  })

  it('puts Government and Transport beside the grid when no tile is free', () => {
    const base = createSimulation({ seed: DEFAULT_SEED })
    const state = {
      ...base,
      config: { ...base.config, gridWidth: 2, gridHeight: 1 },
      households: base.households.slice(0, 1).map((household) => ({ ...household, coordinate: { x: 0, y: 0 } })),
      firms: base.firms
        .filter(({ id }) => id === 'firm-food-a' || id === 'firm-transport')
        .map((firm) => (firm.id === 'firm-food-a' ? { ...firm, coordinate: { x: 1, y: 0 } } : firm)),
    }
    const entities = buildWorldEntities(state)

    expect(institutionTiles(state)).toEqual({ government: null, transport: null })
    expect(entities.find(({ id }) => id === 'firm-transport')!.x).toBeLessThan(-1)
    expect(entities.find(({ id }) => id === state.government.id)!.x).toBeGreaterThan(1)
  })

  it('lists the households that received a transfer today', () => {
    const base = createSimulation({ seed: DEFAULT_SEED })
    const state = {
      ...base,
      households: base.households.map((household, index) => ({
        ...household,
        transferReceivedTodayCents: index === 2 || index === 5 ? 120 : 0,
      })),
    }

    expect(getTransferRecipientIds(state)).toEqual([state.households[2]!.id, state.households[5]!.id])
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
    const household = state.households.find(
      ({ industryOutcomes }) => industryOutcomes.food.purchaseOutcomeToday === 'purchased',
    )!
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
      distancesByFirmId: spatial.distancesByFirmId,
    })
  })

  it('represents a failed purchase without inventing a firm or transaction values', () => {
    const state = stepSimulation(createSimulation({ seed: DEFAULT_SEED }))
    const household = state.households[0]!
    const failedState = {
      ...state,
      households: state.households.map((candidate) =>
        candidate.id === household.id
          ? {
              ...candidate,
              industryOutcomes: {
                ...candidate.industryOutcomes,
                food: {
                  ...candidate.industryOutcomes.food,
                  purchasedToday: false,
                  purchaseOutcomeToday: 'stockout' as const,
                  spentTodayCents: 0,
                },
              },
              spatialPurchasesToday: {
                ...candidate.spatialPurchasesToday,
                food: {
                  chosenFirmId: null,
                  distancesByFirmId: { 'firm-food-a': 3, 'firm-food-b': 7 },
                  chosenOneWayDistance: null,
                  roundTripTiles: 0,
                  productPriceCents: 0,
                  transportFeeCents: 0,
                  deliveredCostCents: 0,
                },
              },
            }
          : candidate,
      ),
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
      distancesByFirmId: { 'firm-food-a': 3, 'firm-food-b': 7 },
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
    expect(
      state.firms
        .filter(({ industryId }) => industryId !== 'transport')
        .every(({ employeeIds }) => employeeIds.length === 10),
    ).toBe(true)
    expect(state.firms.find(({ id }) => id === 'firm-transport')?.employeeIds).toHaveLength(20)
  })

  it('encodes household cash monotonically with bounded pillar height', () => {
    expect(householdWealthHeight(0)).toBe(0.18)
    expect(householdWealthHeight(2_500)).toBeLessThan(householdWealthHeight(5_000))
    expect(householdWealthHeight(5_000)).toBeLessThan(householdWealthHeight(10_000))
    expect(householdWealthHeight(1_000_000)).toBe(6)
  })

  it('puts houses in four wealth tiers with inclusive lower bounds at 85%, 95% and 105% of starting cash', () => {
    expect(houseTier(-100)).toBe(0)
    expect(houseTier(0)).toBe(0)
    expect(houseTier(4_249)).toBe(0)
    expect(houseTier(4_250)).toBe(1)
    expect(houseTier(4_749)).toBe(1)
    expect(houseTier(4_750)).toBe(2)
    expect(houseTier(5_000)).toBe(2)
    expect(houseTier(5_249)).toBe(2)
    expect(houseTier(5_250)).toBe(3)
    expect(houseTier(1_000_000)).toBe(3)
    expect(houseTier(170, 200)).toBe(1)
  })

  it('shows a spread of houses before tax and an even town after Government redistributes', () => {
    let state = createSimulation({ seed: DEFAULT_SEED })
    for (let day = 0; day < 60; day += 1) state = stepSimulation(state)
    const tiers = (measure: 'before' | 'after') =>
      new Set(buildWorldEntities(state, measure).flatMap(({ tier }) => (tier === undefined ? [] : [tier])))
    expect(tiers('before').size).toBeGreaterThanOrEqual(3)
    expect([...tiers('after')]).toEqual([2])
  })

  it('gives households a tier from the selected cash measure and leaves firms and Government without one', () => {
    let state = createSimulation({ seed: DEFAULT_SEED })
    for (let day = 0; day < 30; day += 1) state = stepSimulation(state)
    for (const measure of ['before', 'after'] as const) {
      const entities = buildWorldEntities(state, measure)
      for (const household of state.households) {
        const entity = entities.find(({ id }) => id === household.id)!
        const cash = measure === 'before' ? household.preTaxCashCents : household.postFiscalCashCents
        expect(entity.tier).toBe(houseTier(cash))
        expect(entity.height).toBe(householdWealthHeight(cash))
      }
      expect(entities.filter(({ kind }) => kind !== 'household').every(({ tier }) => tier === undefined)).toBe(true)
    }
  })
})
