import type { Good, Point, ValleyConfig, ValleyLayout } from './types'
// Thickets, hazel thickets, stands and outcrops as sites, which a forager spots from afar, checks up close, and walks
// to when it checks what it knows or searches for food or wood.

/** Sites are numbered thickets first, in layout order, then hazel thickets, then stands, then outcrops. */
export const siteCount = (config: ValleyConfig) =>
  config.thicketCount + config.hazelThicketCount + config.standCount + config.outcropCount

/** What kind a site is: a thicket of berry bushes, a thicket of hazels, a stand of trees, an outcrop of stones. */
export type SiteKind = 'thicket' | 'hazel' | 'stand' | 'outcrop'

/** A site's kind, and its number among the sites of that kind. */
export function siteKindOf(config: ValleyConfig, site: number): { kind: SiteKind; index: number } {
  let index = site
  if (index < config.thicketCount) return { kind: 'thicket', index }
  index -= config.thicketCount
  if (index < config.hazelThicketCount) return { kind: 'hazel', index }
  index -= config.hazelThicketCount
  if (index < config.standCount) return { kind: 'stand', index }
  return { kind: 'outcrop', index: index - config.standCount }
}

export const siteKind = (config: ValleyConfig, site: number) => siteKindOf(config, site).kind

/** Whether a site holds a good: food in a thicket or hazel thicket; wood in a stand, and in a thicket whose bushes hold sticks. */
export const siteHolds = (config: ValleyConfig, site: number, good: Good) => {
  const kind = siteKind(config, site)
  if (good === 'food') return kind === 'thicket' || kind === 'hazel'
  return kind === 'stand' || (kind === 'thicket' && config.berryThicketWoodKg > 0)
}

export function siteCentre(config: ValleyConfig, layout: ValleyLayout, site: number): Point {
  const { kind, index } = siteKindOf(config, site)
  if (kind === 'thicket') return layout.thickets[index]!
  if (kind === 'hazel') return layout.hazelThickets[index]!
  return kind === 'stand' ? layout.stands[index]! : layout.outcrops[index]!
}

export function siteRadius(config: ValleyConfig, site: number) {
  const kind = siteKind(config, site)
  if (kind === 'thicket') return config.thicketRadiusCm
  if (kind === 'hazel') return config.hazelThicketRadiusCm
  return kind === 'stand' ? config.standRadiusCm : config.outcropRadiusCm
}

/** Within this distance of a site's centre, every plant in it lies in close sight. */
export const checkRadius = (config: ValleyConfig, site: number) => config.perceptionRadiusCm - siteRadius(config, site)

/** How far a forager sees in minute `minute`: long sight by day, close sight at night. */
export const sightOf = (config: ValleyConfig, _minute: number) => config.sightRadiusCm
