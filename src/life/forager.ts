import { carriedKcal } from './food'
import { buyingPays, knownTerms, sellingPays } from './trade'
import { spareWood, wantedWood } from './wood'
import { campTile, harvestOf, isDaylight, manhattan, mustGoHome, reachableInTime, sameTile } from './world'
import type {
  ActionReason,
  Forager,
  ForagerAction,
  Good,
  Grove,
  GroveMemory,
  LifeConfig,
  Patch,
  PatchMemory,
  Tile,
} from './types'

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

/** The wood of every grove within the perception radius, as for patches. */
export function observeGroves(
  config: LifeConfig,
  forager: Forager,
  groves: readonly Grove[],
  tick: number,
): GroveMemory[] {
  let memory: GroveMemory[] | null = null
  for (const grove of groves) {
    if (manhattan(grove.tile, forager.position) > config.perceptionRadiusTiles) continue
    memory ??= [...forager.groveMemory]
    memory[grove.id] = { wood: grove.wood, observedTick: tick }
  }
  return memory ?? forager.groveMemory
}

/** What a forager works for this hour, and whether to swap it; or waiting to swap; or nothing. */
export type Work = { good: Good; forTrade: boolean; trip: Forager['trip'] } | 'wait' | null

/**
 * A hungry forager works for food and one only short of wood works for wood, unless terms it remembers make the other
 * good the quicker way to what it needs. It gathers wood to sell only once its spare wood has all been sold, and then
 * keeps at it until it holds the spare wood it set out for. It forages to buy wood until it carries enough to pay,
 * and then waits.
 */
export function chooseWork(config: LifeConfig, forager: Forager, tick: number): Work {
  if (!forager.hungry && !forager.shortOfWood) return null
  const terms = knownTerms(config, forager, tick)
  const carried = carriedKcal(forager.carried)
  if (forager.hungry) {
    if (terms !== null && sellingPays(forager, terms)) {
      const spare = spareWood(config, forager)
      if (forager.trip && spare < forager.trip.goalSpareWood)
        return { good: 'wood', forTrade: true, trip: forager.trip }
      if (spare === 0) {
        // What it would ask for under Life 2's rule.
        const request = Math.max(0, config.satiatedAtKcal - forager.energyKcal - carried)
        const goalSpareWood = Math.ceil(request / terms)
        if (goalSpareWood > 0) return { good: 'wood', forTrade: true, trip: { goalSpareWood } }
      }
    }
    return { good: 'food', forTrade: false, trip: null }
  }
  if (terms !== null && buyingPays(forager, terms)) {
    if (carried < wantedWood(config, forager) * terms) return { good: 'food', forTrade: true, trip: null }
    return 'wait'
  }
  return { good: 'wood', forTrade: false, trip: null }
}

export interface Decision {
  action: ForagerAction
  reason: ActionReason
  /** The good it works for or walks towards, and whether to swap it, with any trip for trade it is on. */
  good: Good | null
  forTrade: boolean
  trip: Forager['trip']
}

/**
 * The first rule that applies, in priority order. `forager.hungry` and `forager.shortOfWood` must already be updated
 * for this tick. With a camp, a forager away from it heads home in time to arrive by dusk. Work starts only where a full
 * hour's work is available, so the forager never works a site that could not repay it. With a camp, it sets out only
 * for a site it can work and come home from before dark.
 */
export function decide(
  config: LifeConfig,
  forager: Forager,
  patches: readonly Patch[],
  groves: readonly Grove[],
  tick: number,
): Decision {
  const idle = { good: null, forTrade: false, trip: null }
  if (mustGoHome(config, forager.position, tick)) return { action: 'walk', reason: 'going home', ...idle }
  if (!isDaylight(config, tick)) return { action: 'sleep', reason: 'night', ...idle }
  const work = chooseWork(config, forager, tick)
  if (work === null) return { action: 'rest', reason: 'satiated', ...idle }
  if (work === 'wait') return { action: 'rest', reason: 'waiting to swap', ...idle }
  const { good, forTrade, trip } = work
  const working = { good, forTrade, trip }
  const sites: readonly { tile: Tile }[] = good === 'food' ? patches : groves
  const here = sites.find((site) => sameTile(site.tile, forager.position))
  if (good === 'food') {
    const patch = here as Patch | undefined
    if (patch && patch.stockKcal >= harvestOf(config, forager.forageRate))
      return { action: 'forage', reason: 'foraging', ...working }
  } else {
    const grove = here as Grove | undefined
    if (grove && grove.wood >= forager.woodRate) return { action: 'gather', reason: 'gathering', ...working }
  }
  const others = sites.filter((site) => site !== here)
  if (others.some((site) => reachableInTime(config, forager.position, site.tile, tick)))
    return { action: 'walk', reason: good === 'food' ? 'seeking food' : 'seeking wood', ...working }
  if (campTile(config) && others.length) return { action: 'rest', reason: 'too late to set out', ...working }
  return { action: 'rest', reason: 'waiting for regrowth', ...working }
}

/**
 * Where a walking forager heads this hour. Going home, it heads for camp. Otherwise it keeps its target site for the
 * good it works for until it reaches it, unless it has just seen the target holding less than a full hour's work or
 * can no longer reach it in time; then, as on arrival, it chooses again. At radius 0 a forager first sees its target on
 * arrival.
 */
export function walkTarget(
  config: LifeConfig,
  forager: Forager,
  patches: readonly Patch[],
  groves: readonly Grove[],
  tick: number,
  good: Good | null,
): { tile: Tile; patch: Patch | null; grove: Grove | null } | null {
  const camp = campTile(config)
  if (camp && (good === null || mustGoHome(config, forager.position, tick)))
    return { tile: camp, patch: null, grove: null }
  const keeps = (tile: Tile, seen: { observedTick: number }, stock: number, threshold: number) =>
    !sameTile(tile, forager.position) &&
    reachableInTime(config, forager.position, tile, tick) &&
    (seen.observedTick !== tick || stock >= threshold)
  if (good === 'wood') {
    const current = forager.targetGroveId === null ? null : groves[forager.targetGroveId]!
    const seen = current && forager.groveMemory[current.id]!
    if (current && seen && keeps(current.tile, seen, seen.wood, forager.woodRate))
      return { tile: current.tile, patch: null, grove: current }
    const chosen = chooseGrove(config, forager.position, groves, forager.groveMemory, tick, forager.woodRate)
    return chosen && { tile: chosen.tile, patch: null, grove: chosen }
  }
  const harvest = harvestOf(config, forager.forageRate)
  const current = forager.targetPatchId === null ? null : patches[forager.targetPatchId]!
  const seen = current && forager.memory[current.id]!
  if (current && seen && keeps(current.tile, seen, seen.stockKcal, harvest))
    return { tile: current.tile, patch: current, grove: null }
  const chosen = choosePatch(config, forager.position, patches, forager.memory, tick, harvest)
  return chosen && { tile: chosen.tile, patch: chosen, grove: null }
}

/**
 * Chooses where to walk from memory alone, among the sites it can reach in time. A site remembered as holding a full
 * hour's work wins, the fullest first. Failing that, the forager tries the site it saw longest ago, which has had the
 * longest to recover; it does not know regrowth rates. Ties go to the nearest site, then the lowest ID.
 */
function chooseSite<Site extends { id: number; tile: Tile }>(
  config: LifeConfig,
  position: Tile,
  sites: readonly Site[],
  remembered: (id: number) => { stock: number; observedTick: number },
  tick: number,
  threshold: number,
) {
  const candidates = sites.filter(
    (site) => !sameTile(site.tile, position) && reachableInTime(config, position, site.tile, tick),
  )
  if (!candidates.length) return null
  const nearestThenId = (a: Site, b: Site) => manhattan(position, a.tile) - manhattan(position, b.tile) || a.id - b.id
  const promising = candidates.filter((site) => remembered(site.id).stock >= threshold)
  if (promising.length)
    return [...promising].sort((a, b) => remembered(b.id).stock - remembered(a.id).stock || nearestThenId(a, b))[0]!
  return [...candidates].sort(
    (a, b) => remembered(a.id).observedTick - remembered(b.id).observedTick || nearestThenId(a, b),
  )[0]!
}

/** Life 0's patch choice, with a full hour's harvest read as the forager's own harvest. */
export const choosePatch = (
  config: LifeConfig,
  position: Tile,
  patches: readonly Patch[],
  memory: readonly PatchMemory[],
  tick: number,
  harvestKcal: number,
) =>
  chooseSite(
    config,
    position,
    patches,
    (id) => ({ stock: memory[id]!.stockKcal, observedTick: memory[id]!.observedTick }),
    tick,
    harvestKcal,
  )

/** The same choice among groves, with a full hour's work read as the forager's own wood rate. */
export const chooseGrove = (
  config: LifeConfig,
  position: Tile,
  groves: readonly Grove[],
  memory: readonly GroveMemory[],
  tick: number,
  woodRate: number,
) =>
  chooseSite(
    config,
    position,
    groves,
    (id) => ({ stock: memory[id]!.wood, observedTick: memory[id]!.observedTick }),
    tick,
    woodRate,
  )
