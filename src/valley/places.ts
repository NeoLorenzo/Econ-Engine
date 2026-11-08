import { dailyShare, dayOfYear, MINUTES_PER_DAY, windowDayIndex, yearOf, yearsToDays } from './calendar'
import { deriveHarvestSeed } from './layout'
import { randomInt } from '../sim/rng'
import type {
  CropClass,
  Harvest,
  HarvestEvent,
  PlaceKind,
  PlaceTable,
  Point,
  ValleyConfig,
  ValleyLayout,
  ValleyState,
} from './types'

export function buildPlaces(config: ValleyConfig, sites: readonly (readonly Point[])[]): PlaceTable {
  const count = sites.reduce((total, points) => total + points.length, 0)
  const table: PlaceTable = {
    count,
    kind: new Uint8Array(count),
    x: new Int32Array(count),
    y: new Int32Array(count),
    chunk: new Int32Array(count),
    radiusCm: new Int32Array(count),
  }
  const radii = [config.thicketRadiusCm, config.hazelThicketRadiusCm, config.standRadiusCm, config.outcropRadiusCm]
  const chunks = Math.floor(config.valleySizeCm / config.chunkCm) + 1
  let id = 0
  for (const [kind, points] of sites.entries())
    for (const point of points) {
      table.kind[id] = kind
      table.x[id] = point.x
      table.y[id] = point.y
      table.chunk[id] = Math.floor(point.y / config.chunkCm) * chunks + Math.floor(point.x / config.chunkCm)
      table.radiusCm[id] = radii[kind]!
      id += 1
    }
  return table
}

/** A thicket's crop in a year of class factor `factor` per mille: day-anchored, its yearly crop per 365 days. */
export const cropOf = (config: ValleyConfig, kind: 0 | 1, factor: number): number =>
  Math.floor(
    ((kind === 0 ? config.berryThicketKcalPerYear : config.hazelThicketKcalPerYear) * config.daysPerYear * factor) /
      (365 * 1_000),
  )

/** The most a thicket holds: its good-year crop, at least 1 kcal. */
export const thicketCapacity = (config: ValleyConfig, kind: 0 | 1): number =>
  Math.max(1, cropOf(config, kind, (kind === 0 ? config.berryYearPerMille : config.hazelYearPerMille).good))

export const capacityOf = (config: ValleyConfig, kind: PlaceKind): number =>
  kind === 'berry thicket'
    ? thicketCapacity(config, 0)
    : kind === 'hazel thicket'
      ? thicketCapacity(config, 1)
      : kind === 'stand'
        ? config.standWoodKg
        : config.outcropStones

/** The class of a draw from 0 to 999: poor below the poor chance, good at or above 1,000 less the good chance. */
export const cropClassOf = (config: ValleyConfig, draw: number): CropClass =>
  draw < config.poorYearPerMille ? 'poor' : draw >= 1_000 - config.goodYearPerMille ? 'good' : 'normal'

const harvests = new Map<string, Harvest>()
/** A calendar year's crop classes, berries then hazel, from its `harvest:<year>` stream. */
export function harvestOf(config: ValleyConfig, year: number): Harvest {
  const key = `${config.seed}:${config.poorYearPerMille}:${config.goodYearPerMille}:${year}`
  const saved = harvests.get(key)
  if (saved) return saved
  const berries = randomInt(deriveHarvestSeed(config.seed, year), 1_000),
    hazel = randomInt(berries.state, 1_000)
  const harvest: Harvest = {
    year,
    berries: cropClassOf(config, berries.value),
    hazel: cropClassOf(config, hazel.value),
  }
  if (harvests.size > 10_000) harvests.clear()
  harvests.set(key, harvest)
  return harvest
}

/** The year's `harvest` event: its classes and their factors. */
export const harvestEvent = (config: ValleyConfig, minute: number, harvest: Harvest): HarvestEvent => ({
  kind: 'harvest',
  minute,
  ...harvest,
  berryFactor: config.berryYearPerMille[harvest.berries],
  hazelFactor: config.hazelYearPerMille[harvest.hazel],
})

const vicinityCache = new WeakMap<ValleyLayout, Map<string, number[]>>()
export function placesWithin(layout: ValleyLayout, x: number, y: number, radiusCm: number): number[] {
  let cache = vicinityCache.get(layout)
  if (!cache) {
    cache = new Map()
    vicinityCache.set(layout, cache)
  }
  const key = `${x},${y}:${radiusCm}`,
    saved = cache.get(key)
  if (saved) return saved
  const { places, placeIndex } = layout
  const { cellCm, cells } = placeIndex
  const ids: number[] = []
  for (
    let row = Math.max(0, Math.floor((y - radiusCm) / cellCm));
    row <= Math.min(cells - 1, Math.floor((y + radiusCm) / cellCm));
    row += 1
  )
    for (
      let col = Math.max(0, Math.floor((x - radiusCm) / cellCm));
      col <= Math.min(cells - 1, Math.floor((x + radiusCm) / cellCm));
      col += 1
    )
      for (const id of layout.placeChunks[row * cells + col]!)
        if ((places.x[id]! - x) ** 2 + (places.y[id]! - y) ** 2 <= radiusCm ** 2) ids.push(id)
  ids.sort((a, b) => a - b)
  cache.set(key, ids)
  return ids
}

/** The widest place's radius, by layout: a place contains a point only within it. */
const widestRadius = new WeakMap<ValleyLayout, number>()
export function placeAt(layout: ValleyLayout, x: number, y: number): number {
  let radius = widestRadius.get(layout)
  if (radius === undefined) {
    radius = 0
    for (const value of layout.places.radiusCm) radius = Math.max(radius, value)
    widestRadius.set(layout, radius)
  }
  for (const id of placesWithin(layout, x, y, radius))
    if ((layout.places.x[id]! - x) ** 2 + (layout.places.y[id]! - y) ** 2 <= layout.places.radiusCm[id]! ** 2) return id
  return -1
}

export function takeFrom(stock: Int32Array, id: number, wanted: number): number {
  const taken = Math.min(Math.max(0, Math.floor(wanted)), stock[id]!)
  stock[id] -= taken
  return taken
}

/** What one place lost, grew and turned away above capacity at a midnight. */
export interface PlaceGrowth {
  kcal: number
  lost: number
  overflow: number
  wood: number
  logs: number
}

/**
 * A midnight on the land: each thicket first loses its share to animals and rot, then, inside its window, gains its
 * day's share of the year's crop, capped at capacity; stands' deadfall and logs regrow by the year. `onPlace` hears
 * every place that changed or turned food away.
 */
export function regrowPlaces(
  state: Pick<ValleyState, 'config' | 'layout' | 'foodStock' | 'woodStock' | 'logStock' | 'logRegrowth'>,
  minute: number,
  onPlace?: (id: number, growth: PlaceGrowth) => void,
) {
  const config = state.config
  const day = dayOfYear(config, minute)
  const share = (yearly: number) => dailyShare(yearly, day, config.daysPerYear)
  const harvest = harvestOf(config, yearOf(config, minute))
  const seasons = [0, 1].map((kind) => {
    const window = windowDayIndex(config, kind === 0 ? config.berrySeason : config.nutSeason, minute)
    const crop = cropOf(
      config,
      kind as 0 | 1,
      kind === 0 ? config.berryYearPerMille[harvest.berries] : config.hazelYearPerMille[harvest.hazel],
    )
    return {
      gain:
        window.index < 0
          ? 0
          : Math.floor((crop * (window.index + 1)) / window.days) - Math.floor((crop * window.index) / window.days),
      capacity: thicketCapacity(config, kind as 0 | 1),
      loss: kind === 0 ? config.berryLossPerMille : config.nutLossPerMille,
    }
  })
  const grown = { kcal: 0, wood: 0, logs: 0, lost: [0, 0], crop: [0, 0], overflow: [0, 0] }
  const add = (stock: Int32Array, id: number, amount: number, capacity: number) => {
    const gain = Math.max(0, Math.min(amount, capacity - stock[id]!))
    stock[id] += gain
    return gain
  }
  for (let id = 0; id < state.layout.places.count; id += 1) {
    const kind = state.layout.places.kind[id]!
    const growth: PlaceGrowth = { kcal: 0, lost: 0, overflow: 0, wood: 0, logs: 0 }
    if (kind === 0 || kind === 1) {
      const season = seasons[kind]!
      growth.lost = Math.floor((state.foodStock[id]! * season.loss) / 1_000)
      state.foodStock[id] -= growth.lost
      growth.kcal = add(state.foodStock, id, season.gain, season.capacity)
      growth.overflow = season.gain - growth.kcal
      grown.lost[kind] += growth.lost
      grown.crop[kind] += growth.kcal
      grown.overflow[kind] += growth.overflow
      grown.kcal += growth.kcal
    }
    if (kind === 0)
      growth.wood = add(state.woodStock, id, share(config.berryThicketWoodRegrowthKgPerYear), config.berryThicketWoodKg)
    else if (kind === 2) {
      growth.wood = add(state.woodStock, id, share(config.standDeadfallKgPerYear), config.standWoodKg)
      const pending = state.logRegrowth.get(id)
      if (pending) {
        const delay = yearsToDays(config, config.treeRegrowthYears) * MINUTES_PER_DAY
        const ready = pending.filter((felled) => minute - felled >= delay)
        growth.logs = add(state.logStock, id, ready.length * config.logsPerTree, config.standLogs)
        const remaining = pending.filter((felled) => minute - felled < delay)
        if (remaining.length) state.logRegrowth.set(id, remaining)
        else state.logRegrowth.delete(id)
      }
    }
    grown.wood += growth.wood
    grown.logs += growth.logs
    if (growth.kcal || growth.lost || growth.overflow || growth.wood || growth.logs) onPlace?.(id, growth)
  }
  return grown
}
