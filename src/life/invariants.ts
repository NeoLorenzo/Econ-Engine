import { isDaylight, sameTile } from './world'
import type { LifeState } from './types'

/** Returns every invariant the state breaks; an empty list means the state is sound. */
export function lifeInvariantViolations(state: LifeState): string[] {
  const { config, patches, forager, totals, lastEvent } = state
  const violations: string[] = []
  const stock = patches.reduce((sum, patch) => sum + patch.stockKcal, 0)
  const held = stock + forager.energyKcal + totals.metabolizedKcal
  const supplied = totals.initialKcal + totals.regrownKcal
  if (held !== supplied)
    violations.push(`Energy is not conserved: stock + reserve + metabolized = ${held}, start + regrown = ${supplied}`)
  for (const patch of patches) {
    if (patch.stockKcal < 0 || patch.stockKcal > config.patchCapacityKcal)
      violations.push(`Patch ${patch.id} stock ${patch.stockKcal} is outside 0–${config.patchCapacityKcal}`)
  }
  if (forager.energyKcal < 0 || forager.energyKcal > config.reserveMaxKcal)
    violations.push(`Reserve ${forager.energyKcal} is outside 0–${config.reserveMaxKcal}`)
  if (!forager.alive) {
    if (forager.energyKcal !== 0) violations.push('A dead forager has a reserve')
    if (lastEvent && lastEvent.tick !== forager.deathTick) violations.push('A dead forager acted')
  }
  const { x, y } = forager.position
  if (x < 0 || y < 0 || x >= config.gridWidth || y >= config.gridHeight)
    violations.push(`The forager is off the grid at ${x},${y}`)
  if (forager.targetPatchId !== null && !patches[forager.targetPatchId])
    violations.push(`Target ${forager.targetPatchId} is not a patch`)
  if (lastEvent?.action === 'forage') {
    if (!isDaylight(config, lastEvent.tick)) violations.push('The forager foraged at night')
    const memory = lastEvent.patchId === null ? undefined : forager.memory[lastEvent.patchId]
    if (!memory || memory.observedTick !== lastEvent.tick || memory.stockKcal < config.forageKcalPerHour)
      violations.push('The forager foraged a patch it had not seen holding a full hour’s harvest')
  }
  for (const [id, memory] of forager.memory.entries()) {
    if (memory.observedTick > state.tick) violations.push(`Memory of patch ${id} is from the future`)
  }
  if (forager.alive && lastEvent && lastEvent.tick === state.tick - 1) {
    const here = patches.find((patch) => sameTile(patch.tile, lastEvent.from))
    if (here) {
      // Observation comes after regrowth and before foraging, so the stock seen is what is left plus what was taken.
      const seen = here.stockKcal + (lastEvent.patchId === here.id ? lastEvent.gatheredKcal : 0)
      const memory = forager.memory[here.id]!
      if (memory.observedTick !== lastEvent.tick || memory.stockKcal !== seen)
        violations.push(`The forager's memory of patch ${here.id} does not match what it stood on`)
    }
  }
  return violations
}

export function assertLifeInvariants(state: LifeState) {
  const violations = lifeInvariantViolations(state)
  if (violations.length) throw new Error(`Life invariants violated at tick ${state.tick}: ${violations.join('; ')}`)
}
