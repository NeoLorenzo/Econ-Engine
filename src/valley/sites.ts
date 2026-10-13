import { isDaylight, reachableAndBack, walkSpeed } from './forager'
import { distanceSq } from './geometry'
import type { Forager, Good, Point, ValleyConfig, ValleyLayout } from './types'

// Life 7: thickets and stands as sites, which a forager spots from afar, checks up close, and walks to when it checks
// what it knows or searches for food or wood.

/** Sites are numbered thickets first, in layout order, then stands. */
export const siteCount = (config: ValleyConfig) => config.thicketCount + config.standCount

/** The good a site holds: berries in a thicket, deadwood in a stand. */
export const siteGood = (config: ValleyConfig, site: number): Good => (site < config.thicketCount ? 'food' : 'wood')

export const siteCentre = (config: ValleyConfig, layout: ValleyLayout, site: number): Point =>
  site < config.thicketCount ? layout.thickets[site]! : layout.stands[site - config.thicketCount]!

export const siteRadius = (config: ValleyConfig, site: number) =>
  site < config.thicketCount ? config.thicketRadiusCm : config.standRadiusCm

/** Within this distance of a site's centre, every plant in it lies in close sight. */
export const checkRadius = (config: ValleyConfig, site: number) => config.perceptionRadiusCm - siteRadius(config, site)

/** How far a forager sees in minute `minute`: long sight by day, close sight at night. */
export const sightOf = (config: ValleyConfig, minute: number) =>
  isDaylight(config, minute) ? config.sightRadiusCm : config.perceptionRadiusCm

/** Spots every site whose centre is within sight, and checks every site it stands close enough to see all of. */
export function observeSites(config: ValleyConfig, layout: ValleyLayout, forager: Forager, minute: number) {
  if (!config.checkSites) return
  const sight = sightOf(config, minute)
  for (let site = 0; site < siteCount(config); site += 1) {
    const centre = siteCentre(config, layout, site)
    const sq = distanceSq(forager.x, forager.y, centre.x, centre.y)
    if (sq <= sight * sight) forager.siteKnown[site] = 1
    const close = checkRadius(config, site)
    if (sq <= close * close) forager.siteChecked[site] = minute
  }
}

/** Checking goes to known sites not checked for `exploreAfterHours` or never; searching only to sites never checked. */
export type SiteSearch = 'check' | 'search'

export function siteWanted(config: ValleyConfig, forager: Forager, site: number, minute: number, why: SiteSearch) {
  if (!forager.siteKnown[site]) return false
  const checked = forager.siteChecked[site]!
  if (checked < 0) return true
  return why === 'check' && minute - checked >= 60 * config.exploreAfterHours
}

/**
 * The nearest site a forager wants to check or search, of the good's kind when one is given, among those it can reach
 * and return home from before dusk, by the distance to its centre, ties to the lowest ID; or null.
 */
export function chooseSite(
  config: ValleyConfig,
  layout: ValleyLayout,
  forager: Forager,
  minute: number,
  why: SiteSearch,
  good: Good | null,
): number | null {
  const speed = walkSpeed(config, forager)
  let best: number | null = null
  let bestSq = Infinity
  for (let site = 0; site < siteCount(config); site += 1) {
    if (good !== null && siteGood(config, site) !== good) continue
    if (!siteWanted(config, forager, site, minute, why)) continue
    const centre = siteCentre(config, layout, site)
    const sq = distanceSq(forager.x, forager.y, centre.x, centre.y)
    if (sq < bestSq && reachableAndBack(config, forager, centre.x, centre.y, minute, speed)) {
      best = site
      bestSq = sq
    }
  }
  return best
}

/** How many sites a forager knows. */
export function sitesKnown(forager: Forager) {
  let count = 0
  for (const known of forager.siteKnown) count += known
  return count
}

/** How many sites a forager has checked at or after minute `since`. */
export function sitesCheckedSince(forager: Forager, since: number) {
  let count = 0
  for (const checked of forager.siteChecked) if (checked >= since) count += 1
  return count
}
