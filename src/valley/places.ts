import { dailyShare, dayOfYear, MINUTES_PER_DAY, yearsToDays } from './calendar'
import type { PlaceKind, PlaceTable, Point, ValleyConfig, ValleyLayout, ValleyState } from './types'

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

export const capacityOf = (config: ValleyConfig, kind: PlaceKind): number =>
  kind === 'berry thicket'
    ? config.berryThicketCapacityKcal
    : kind === 'hazel thicket'
      ? config.hazelThicketCapacityKcal
      : kind === 'stand'
        ? config.standWoodKg
        : config.outcropStones

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

export function regrowPlaces(
  state: Pick<ValleyState, 'config' | 'layout' | 'foodStock' | 'woodStock' | 'logStock' | 'logRegrowth'>,
  minute: number,
) {
  const config = state.config
  const day = dayOfYear(config, minute)
  const share = (yearly: number) => dailyShare(yearly, day, config.daysPerYear)
  const grown = { kcal: 0, wood: 0, logs: 0 }
  const add = (stock: Int32Array, id: number, amount: number, capacity: number) => {
    const gain = Math.max(0, Math.min(amount, capacity - stock[id]!))
    stock[id] += gain
    return gain
  }
  for (let id = 0; id < state.layout.places.count; id += 1) {
    const kind = state.layout.places.kind[id]!
    if (kind === 0) {
      grown.kcal += add(
        state.foodStock,
        id,
        share(config.berryThicketRegrowthKcalPerYear),
        config.berryThicketCapacityKcal,
      )
      grown.wood += add(state.woodStock, id, share(config.berryThicketWoodRegrowthKgPerYear), config.berryThicketWoodKg)
    } else if (kind === 1) {
      grown.kcal += add(
        state.foodStock,
        id,
        share(config.hazelThicketRegrowthKcalPerYear),
        config.hazelThicketCapacityKcal,
      )
    } else if (kind === 2) {
      grown.wood += add(state.woodStock, id, share(config.standDeadfallKgPerYear), config.standWoodKg)
      const pending = state.logRegrowth.get(id)
      if (pending) {
        const delay = yearsToDays(config, config.treeRegrowthYears) * MINUTES_PER_DAY
        const ready = pending.filter((felled) => minute - felled >= delay)
        grown.logs += add(state.logStock, id, ready.length * config.logsPerTree, config.standLogs)
        const remaining = pending.filter((felled) => minute - felled < delay)
        if (remaining.length) state.logRegrowth.set(id, remaining)
        else state.logRegrowth.delete(id)
      }
    }
  }
  return grown
}
