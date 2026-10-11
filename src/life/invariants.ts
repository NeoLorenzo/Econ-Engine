import { isDaylight, manhattan } from './world'
import type { LifeState } from './types'

/** Returns every invariant the state breaks; an empty list means the state is sound. */
export function lifeInvariantViolations(state: LifeState): string[] {
  const { config, patches, foragers, totals, lastEvents } = state
  const violations: string[] = []
  const stock = patches.reduce((sum, patch) => sum + patch.stockKcal, 0)
  const reserves = foragers.reduce((sum, forager) => sum + forager.energyKcal, 0)
  const held = stock + reserves + totals.metabolizedKcal
  const supplied = totals.initialKcal + totals.regrownKcal
  if (held !== supplied)
    violations.push(`Energy is not conserved: stock + reserves + metabolized = ${held}, start + regrown = ${supplied}`)
  for (const patch of patches) {
    if (patch.stockKcal < 0 || patch.stockKcal > config.patchCapacityKcal)
      violations.push(`Patch ${patch.id} stock ${patch.stockKcal} is outside 0–${config.patchCapacityKcal}`)
  }

  const lastTick = state.tick - 1
  for (const forager of foragers) {
    const name = `Forager ${forager.id}`
    if (forager.energyKcal < 0 || forager.energyKcal > config.reserveMaxKcal)
      violations.push(`${name}'s reserve ${forager.energyKcal} is outside 0–${config.reserveMaxKcal}`)
    if (!forager.alive && forager.energyKcal !== 0) violations.push(`${name} is dead but has a reserve`)
    const { x, y } = forager.position
    if (x < 0 || y < 0 || x >= config.gridWidth || y >= config.gridHeight)
      violations.push(`${name} is off the grid at ${x},${y}`)
    if (forager.targetPatchId !== null && !patches[forager.targetPatchId])
      violations.push(`${name}'s target ${forager.targetPatchId} is not a patch`)
    for (const [id, memory] of forager.memory.entries()) {
      if (memory.observedTick > state.tick) violations.push(`${name}'s memory of patch ${id} is from the future`)
    }
  }

  if (state.tick > 0) {
    // Everyone alive at the start of the hour took exactly one turn: the living, and those who died this hour.
    const actors = foragers.filter((forager) => forager.alive || forager.deathTick === lastTick).map(({ id }) => id)
    const acted = new Set(lastEvents.map((event) => event.foragerId))
    if (acted.size !== lastEvents.length) violations.push('A forager took two turns in one hour')
    if (acted.size !== actors.length || actors.some((id) => !acted.has(id)))
      violations.push('The hour’s turns do not match the foragers alive at its start')
  }

  // Walking back through the hour's turns, `takenSince[p]` is what this turn and later ones took from patch `p`, so the
  // stock at the start of this turn was the stock now plus that.
  const takenSince = patches.map(() => 0)
  for (let index = lastEvents.length - 1; index >= 0; index -= 1) {
    const event = lastEvents[index]!
    if (event.patchId !== null) takenSince[event.patchId]! += event.gatheredKcal
    const forager = foragers[event.foragerId]!
    if (event.tick !== lastTick) violations.push(`Forager ${forager.id}'s last action is not from the last hour`)
    for (const patch of patches) {
      if (manhattan(patch.tile, event.from) > config.perceptionRadiusTiles) continue
      const memory = forager.memory[patch.id]!
      if (memory.observedTick !== event.tick || memory.stockKcal !== patch.stockKcal + takenSince[patch.id]!)
        violations.push(`Forager ${forager.id}'s memory of patch ${patch.id} does not match what it saw`)
    }
    if (event.action === 'forage') {
      if (!isDaylight(config, event.tick)) violations.push(`Forager ${forager.id} foraged at night`)
      const memory = event.patchId === null ? undefined : forager.memory[event.patchId]
      if (!memory || memory.observedTick !== event.tick || memory.stockKcal < config.forageKcalPerHour)
        violations.push(`Forager ${forager.id} foraged a patch it had not seen holding a full hour’s harvest`)
    }
  }
  return violations
}

export function assertLifeInvariants(state: LifeState) {
  const violations = lifeInvariantViolations(state)
  if (violations.length) throw new Error(`Life invariants violated at tick ${state.tick}: ${violations.join('; ')}`)
}
