import { buildBanks } from './banks'
import { buildNav } from './routes'
import { reindexPeople } from './perception'
import { createValley } from './engine'
import { deriveWater } from './water'
import { fishCapacity } from './fish'
import type { ValleyConfig, ValleyState } from './types'

/** Economic rule fixtures explicitly start with surveyed dry ground. Production starts do not. */
export function createSurveyedValley(overrides: Partial<ValleyConfig> = {}, withWater = false) {
  const state = createValley(overrides)
  for (const person of state.foragers) {
    person.knowledge.triangles.fill(255)
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
  water.shore = buildBanks(water, terrain.height)
  for (const [index, body] of water.bodies.entries()) body.areaM2 = Math.floor(water.shore.area2[index]! / 20_000)
  // A fresh terrain object, so the mesh is built again with the lake in it.
  const wet = { ...terrain, water }
  state.layout = { ...state.layout, terrain: wet, nav: buildNav(state.config, wet, state.layout.ground) }
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
  // The mesh's bank on the first lake nearest its western end.
  const banks = state.layout.nav.accessBanks.filter((b) => b.bodyId === water.bodies[0]!.id)
  const bank = {
    ...banks.reduce((best, b) =>
      (b.x - 750) ** 2 + (b.y - 1_050) ** 2 < (best.x - 750) ** 2 + (best.y - 1_050) ** 2 ? b : best,
    ),
    minute: state.minute,
  }
  for (const person of state.foragers) {
    person.knowledge.triangles.fill(255)
    person.knowledge.revision += 1
  }
  state.foragers[0]!.knownBanks.set(bank.id, bank)
  reindexPeople(state, state.minute)
  return bank
}
