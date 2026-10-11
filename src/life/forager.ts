import { isDaylight, manhattan, sameTile } from './world'
import type { ActionReason, Forager, ForagerAction, LifeConfig, Patch, PatchMemory, Tile } from './types'

/** Hunger with hysteresis: it starts below one threshold and lasts until the reserve reaches the other. */
export function nextHungerMode(config: LifeConfig, energyKcal: number, hungry: boolean) {
  if (energyKcal < config.hungryBelowKcal) return true
  if (energyKcal >= config.satiatedAtKcal) return false
  return hungry
}

/** The forager sees only its own tile. Standing on a patch, it records that patch's stock and the tick. */
export function observe(forager: Forager, patches: readonly Patch[], tick: number): PatchMemory[] {
  const here = patches.find((patch) => sameTile(patch.tile, forager.position))
  if (!here) return forager.memory
  const memory = [...forager.memory]
  memory[here.id] = { stockKcal: here.stockKcal, observedTick: tick }
  return memory
}

/**
 * The first rule that applies, in priority order. `forager.hungry` must already be updated for this tick.
 * Foraging starts only where a full hour's harvest is available, so the forager never spends more on an hour of
 * foraging than a nearly empty patch would return.
 */
export function decide(
  config: LifeConfig,
  forager: Forager,
  patches: readonly Patch[],
  tick: number,
): { action: ForagerAction; reason: ActionReason } {
  if (!isDaylight(config, tick)) return { action: 'sleep', reason: 'night' }
  if (!forager.hungry) return { action: 'rest', reason: 'satiated' }
  const here = patches.find((patch) => sameTile(patch.tile, forager.position))
  if (here && here.stockKcal >= config.forageKcalPerHour) return { action: 'forage', reason: 'foraging' }
  if (patches.some((patch) => patch !== here)) return { action: 'walk', reason: 'seeking food' }
  return { action: 'rest', reason: 'waiting for regrowth' }
}

/**
 * Chooses where to walk from memory alone. A patch remembered as holding a full hour's harvest wins, the fullest
 * first. Failing that, the forager tries the patch it saw longest ago, which has had the longest to recover; it does
 * not know regrowth rates. Ties go to the nearest patch, then the lowest ID.
 */
export function choosePatch(
  config: LifeConfig,
  position: Tile,
  patches: readonly Patch[],
  memory: readonly PatchMemory[],
) {
  const candidates = patches.filter((patch) => !sameTile(patch.tile, position))
  if (!candidates.length) return null
  const nearestThenId = (a: Patch, b: Patch) => manhattan(position, a.tile) - manhattan(position, b.tile) || a.id - b.id
  const promising = candidates.filter((patch) => memory[patch.id]!.stockKcal >= config.forageKcalPerHour)
  if (promising.length)
    return [...promising].sort((a, b) => memory[b.id]!.stockKcal - memory[a.id]!.stockKcal || nearestThenId(a, b))[0]!
  return [...candidates].sort(
    (a, b) => memory[a.id]!.observedTick - memory[b.id]!.observedTick || nearestThenId(a, b),
  )[0]!
}
