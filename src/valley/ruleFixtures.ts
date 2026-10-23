import { buildLattice } from './routes'
import { reindexPeople } from './perception'
import { bankWaterHeight } from './banks'
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
    for (let id = 0; id < person.groundKnowledge.observed.length; id += 1) {
      const water = state.layout.terrain.water
      const point = {
        x: ((id % water.cells) + 0.5) * water.cellCm,
        y: (Math.floor(id / water.cells) + 0.5) * water.cellCm,
      }
      person.groundKnowledge.observed[id] = water.shore
        ? bankWaterHeight(water.shore, point, water.level) === null
          ? 1
          : 2
        : water.body[id]! < 0
          ? 1
          : 2
      person.groundKnowledge.heights[id] = state.layout.terrain.water.bed[id]!
    }
    person.groundKnowledge.revision += 1
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
  }
  for (const person of state.foragers) {
    person.knowledge.nodes.fill(1)
    person.knowledge.revision += 1
    person.groundKnowledge.shore = water.shore
    for (let id = 0; id < bed.length; id += 1) person.groundKnowledge.observed[id] = water.body[id]! < 0 ? 1 : 2
    person.groundKnowledge.revision += 1
  }
  state.foragers[0]!.knownBanks.set(bank.id, bank)
  reindexPeople(state, state.minute)
  return bank
}
