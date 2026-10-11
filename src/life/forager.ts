import { campTile, isDaylight, manhattan, mustGoHome, reachableInTime, sameTile } from './world'
import type { ActionReason, Forager, ForagerAction, LifeConfig, Patch, PatchMemory, Tile } from './types'

/** Hunger with hysteresis: it starts below one threshold and lasts until the reserve reaches the other. */
export function nextHungerMode(config: LifeConfig, energyKcal: number, hungry: boolean) {
  if (energyKcal < config.hungryBelowKcal) return true
  if (energyKcal >= config.satiatedAtKcal) return false
  return hungry
}

/**
 * The forager records the stock of every patch within its perception radius, and the tick. At radius 0 it sees only
 * its own tile, as Life 0's forager did. It does not perceive other foragers.
 */
export function observe(config: LifeConfig, forager: Forager, patches: readonly Patch[], tick: number): PatchMemory[] {
  let memory: PatchMemory[] | null = null
  for (const patch of patches) {
    if (manhattan(patch.tile, forager.position) > config.perceptionRadiusTiles) continue
    memory ??= [...forager.memory]
    memory[patch.id] = { stockKcal: patch.stockKcal, observedTick: tick }
  }
  return memory ?? forager.memory
}

/**
 * The first rule that applies, in priority order. `forager.hungry` must already be updated for this tick.
 * With a camp, a forager away from it heads home in time to arrive by dusk. Foraging starts only where a full harvest
 * is available, so the forager never works a patch that could not repay it. With a camp, it sets out only for a patch
 * it can forage and come home from before dark.
 */
export function decide(
  config: LifeConfig,
  forager: Forager,
  patches: readonly Patch[],
  tick: number,
): { action: ForagerAction; reason: ActionReason } {
  if (mustGoHome(config, forager.position, tick)) return { action: 'walk', reason: 'going home' }
  if (!isDaylight(config, tick)) return { action: 'sleep', reason: 'night' }
  if (!forager.hungry) return { action: 'rest', reason: 'satiated' }
  const here = patches.find((patch) => sameTile(patch.tile, forager.position))
  if (here && here.stockKcal >= config.harvestKcal) return { action: 'forage', reason: 'foraging' }
  const others = patches.filter((patch) => patch !== here)
  if (others.some((patch) => reachableInTime(config, forager.position, patch.tile, tick)))
    return { action: 'walk', reason: 'seeking food' }
  if (campTile(config) && others.length) return { action: 'rest', reason: 'too late to set out' }
  return { action: 'rest', reason: 'waiting for regrowth' }
}

/**
 * Where a walking forager heads this hour. Going home, it heads for camp. Otherwise it keeps its target until it
 * reaches it, unless it has just seen the target holding less than a full harvest or can no longer reach it in time;
 * then, as on arrival, it chooses again. At radius 0 a forager first sees its target on arrival.
 */
export function walkTarget(
  config: LifeConfig,
  forager: Forager,
  patches: readonly Patch[],
  tick: number,
): { tile: Tile; patch: Patch | null } | null {
  const camp = campTile(config)
  if (camp && mustGoHome(config, forager.position, tick)) return { tile: camp, patch: null }
  const current = forager.targetPatchId === null ? null : patches[forager.targetPatchId]!
  if (
    current &&
    !sameTile(current.tile, forager.position) &&
    reachableInTime(config, forager.position, current.tile, tick)
  ) {
    const seen = forager.memory[current.id]!
    if (seen.observedTick !== tick || seen.stockKcal >= config.harvestKcal)
      return { tile: current.tile, patch: current }
  }
  const chosen = choosePatch(config, forager.position, patches, forager.memory, tick)
  return chosen && { tile: chosen.tile, patch: chosen }
}

/**
 * Chooses where to walk from memory alone, among the patches it can reach in time. A patch remembered as holding a
 * full harvest wins, the fullest first. Failing that, the forager tries the patch it saw longest ago, which has had
 * the longest to recover; it does not know regrowth rates. Ties go to the nearest patch, then the lowest ID.
 */
export function choosePatch(
  config: LifeConfig,
  position: Tile,
  patches: readonly Patch[],
  memory: readonly PatchMemory[],
  tick: number,
) {
  const candidates = patches.filter(
    (patch) => !sameTile(patch.tile, position) && reachableInTime(config, position, patch.tile, tick),
  )
  if (!candidates.length) return null
  const nearestThenId = (a: Patch, b: Patch) => manhattan(position, a.tile) - manhattan(position, b.tile) || a.id - b.id
  const promising = candidates.filter((patch) => memory[patch.id]!.stockKcal >= config.harvestKcal)
  if (promising.length)
    return [...promising].sort((a, b) => memory[b.id]!.stockKcal - memory[a.id]!.stockKcal || nearestThenId(a, b))[0]!
  return [...candidates].sort(
    (a, b) => memory[a.id]!.observedTick - memory[b.id]!.observedTick || nearestThenId(a, b),
  )[0]!
}
