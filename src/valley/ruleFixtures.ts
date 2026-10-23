import { indexBanks } from './bankSearch'
import { buildLattice, routeNode } from './routes'
import { reindexPeople } from './perception'
import { createValley } from './engine'
import { deriveWater } from './water'
import { fishCapacity } from './fish'
import type { ValleyConfig, ValleyState } from './types'

/** Economic rule fixtures explicitly start with surveyed dry ground. Production starts do not. */
export function createSurveyedValley(overrides: Partial<ValleyConfig> = {}, withWater = false) {
  const state = createValley(overrides)
  for (const person of state.foragers) {
    person.knowledge.nodes.fill(1)
    person.knownPlaces.fill(0)
  }
  if (withWater) {
    const bank = addTestLake(state)
    for (const person of state.foragers) person.knownBanks.set(bank.id, bank)
  }
  return state
}

/** A surveyed 1000 m² bowl in the otherwise unused northern margin of a flat rule fixture. */
export function addTestLake(state: ValleyState, two = false) {
  const terrain = state.layout.terrain
  const bed = new Int32Array(terrain.cells ** 2)
  for (let x = 1; x <= 40; x += 1) bed[terrain.cells + x] = -100
  if (two) for (let x = 80; x < 120; x += 1) bed[terrain.cells + x] = -100
  const water = deriveWater(
    terrain.cells,
    terrain.cellCm,
    bed,
    state.config.riverCatchmentM2,
    state.config.riverDepthCm,
  )
  state.layout = {
    ...state.layout,
    terrain: { ...terrain, water },
    lattice: buildLattice(state.config, { ...terrain, water }),
  }
  state.totals.initialKcal -= state.fishKcal
  state.fish = water.bodies.map((body) => {
    const capacity = fishCapacity(
      body.areaM2,
      state.config.fishMinAreaM2,
      state.config.fishKgPerHectare,
      state.config.fishKcalPerKg,
    )
    return { bodyId: body.id, capacity, stock: capacity, remainder: 0, grown: 0, caught: 0 }
  })
  state.fishKcal = state.fish.reduce((sum, body) => sum + body.stock, 0)
  state.totals.initialKcal += state.fishKcal
  const wetCell = terrain.cells + 1
  const bank = {
    id: wetCell * 4 + 3,
    bodyId: water.bodies[0]!.id,
    wetCell,
    dryCell: 2 * terrain.cells + 1,
    x: 750,
    y: 1_050,
    minute: state.minute,
    connectorNode: -1,
  }
  bank.connectorNode = routeNode(
    state.layout.lattice,
    { nodes: state.layout.lattice.dry, revision: 0 },
    { x: bank.x, y: bank.y },
  )
  // Register the explicit analytic access point in the same index used by production layouts.
  state.layout.lattice.accessBanks.push(bank)
  state.layout.lattice.bankIndex = indexBanks(state.layout.lattice.accessBanks, state.layout.terrain)
  for (const person of state.foragers) {
    person.knowledge.nodes.fill(1)
    person.knowledge.revision += 1
  }
  state.foragers[0]!.knownBanks.set(bank.id, bank)
  reindexPeople(state, state.minute)
  return bank
}
