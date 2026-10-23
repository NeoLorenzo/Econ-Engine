import { bankApproach, bankWaterHeight } from './banks'
import { heightAt } from './terrain'
import { cardinalCells } from './water'
import { buildIndex } from './layout'
import {
  knownRoute,
  routeAnchor,
  routeCentre,
  observeRouteCells,
  routeFrontierCells,
  forEachUnknownCell,
} from './routes'
import type { BankMemory, Forager, PlantIndex, Point, ValleyConfig, ValleyLayout } from './types'

/** Observe complete cell footprints, never expand an observation into a complete body's outline. */
export function observeGround(
  config: ValleyConfig,
  layout: ValleyLayout,
  person: Forager,
  minute: number,
  origin: Point,
  radius: number,
  visible: (point: Point) => boolean,
  far = false,
) {
  const grid = person.groundKnowledge
  const water = layout.terrain.water
  const x0 = Math.max(0, Math.floor((origin.x - radius) / grid.cellCm))
  const x1 = Math.min(grid.cells - 1, Math.floor((origin.x + radius) / grid.cellCm))
  const y0 = Math.max(0, Math.floor((origin.y - radius) / grid.cellCm))
  const y1 = Math.min(grid.cells - 1, Math.floor((origin.y + radius) / grid.cellCm))
  const newlySeen: number[] = []
  forEachUnknownCell(grid, x0, x1, y0, y1, (id) => {
    const x = id % grid.cells
    const y = Math.floor(id / grid.cells)
    const left = x * grid.cellCm
    const right = left + grid.cellCm
    const top = y * grid.cellCm
    const bottom = top + grid.cellCm
    const dx = Math.max(Math.abs(left - origin.x), Math.abs(right - origin.x))
    const dy = Math.max(Math.abs(top - origin.y), Math.abs(bottom - origin.y))
    if (
      dx * dx + dy * dy > radius * radius ||
      !visible({ x: left, y: top }) ||
      !visible({ x: right, y: top }) ||
      !visible({ x: left, y: bottom }) ||
      !visible({ x: right, y: bottom })
    )
      return
    const centre = routeCentre(grid, id)
    grid.observed[id] = water.shore
      ? bankWaterHeight(water.shore, centre, water.level) === null
        ? 1
        : 2
      : water.body[id]! < 0
        ? 1
        : 2
    grid.heights[id] = heightAt(layout.terrain, centre.x, centre.y)
    newlySeen.push(id)
  })
  if (!newlySeen.length) return
  grid.revision += 1
  observeRouteCells(grid, newlySeen)
  const observation = {
    kind: 'water observation' as const,
    minute,
    foragerId: person.id,
    origin: { x: origin.x, y: origin.y },
    radiusCm: radius,
    cells: newlySeen,
    banks: [] as import('./types').BankMemory[],
    far,
  }
  if (water.shore) {
    const patches = new Set<number>()
    for (const cell of newlySeen) {
      const x = cell % grid.cells,
        y = Math.floor(cell / grid.cells)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < 0 || y + dy < 0 || x + dx >= grid.cells || y + dy >= grid.cells) continue
          const neighbour = (y + dy) * grid.cells + x + dx
          if (grid.observed[neighbour]) patches.add(neighbour)
        }
    }
    for (const cell of patches)
      for (const segment of water.shore.patches.get(cell)?.segments ?? []) {
        if (person.knownBanks.has(segment.id)) continue
        const bank = bankApproach(
          water.shore,
          segment,
          config.reachCm,
          config.drinkBankHeightCm,
          (x, y) => heightAt(layout.terrain, x, y),
          water.bodies[segment.body]!.id,
          minute,
        )
        if (!bank || !grid.observed[bank.dryCell]) continue
        person.knownBanks.set(bank.id, bank)
        observation.banks.push(bank)
      }
    person.waterObservations.push(observation)
    return
  }
  const edges = new Set<number>()
  for (const id of newlySeen) {
    if (grid.observed[id] === 2) edges.add(id)
    for (const neighbour of cardinalCells(grid.cells, id)) if (grid.observed[neighbour] === 2) edges.add(neighbour)
  }
  for (const wetCell of edges) {
    const wet = routeCentre(grid, wetCell)
    for (const dryCell of cardinalCells(grid.cells, wetCell)) {
      if (grid.observed[dryCell] !== 1) continue
      const dry = routeCentre(grid, dryCell)
      const inset = Math.min(50, config.reachCm)
      const x = Math.floor((wet.x + dry.x) / 2) + inset * Math.sign(dry.x - wet.x)
      const y = Math.floor((wet.y + dry.y) / 2) + inset * Math.sign(dry.y - wet.y)
      const edge = dryCell === wetCell - grid.cells ? 0 : dryCell === wetCell - 1 ? 1 : dryCell === wetCell + 1 ? 2 : 3
      const id = wetCell * 4 + edge
      if (heightAt(layout.terrain, x, y) - water.level[wetCell]! > config.drinkBankHeightCm) continue
      if (person.knownBanks.has(id)) continue
      const bank = {
        id,
        x,
        y,
        wetCell,
        dryCell,
        minute,
        bodyId: water.bodies[water.body[wetCell]!]!.id,
      }
      person.knownBanks.set(id, bank)
      observation.banks.push(bank)
    }
  }
  person.waterObservations.push(observation)
}

/** A reachable frontier comes from observed cells only; unknown connectivity cannot influence its choice. */
export function frontier(
  person: Forager,
  target: Point,
  allowed: (point: Point) => boolean = () => true,
): readonly Point[] | null {
  const grid = person.groundKnowledge
  const candidates: { id: number; distance: number }[] = []
  for (const id of routeFrontierCells(grid)) {
    const p = routeCentre(grid, id)
    if (p.x === person.x && p.y === person.y) continue
    candidates.push({ id, distance: (p.x - target.x) ** 2 + (p.y - target.y) ** 2 })
  }
  candidates.sort((a, b) => a.distance - b.distance || a.id - b.id)
  for (const candidate of candidates) {
    const point = routeCentre(grid, candidate.id)
    const path = knownRoute(grid, person, point)
    if (path && allowed(point)) return path
  }
  return null
}

const bankCells = new WeakMap<Forager['knownBanks'], { size: number; banks: BankMemory[]; chunks: PlantIndex }>()

/** The bank index is immutable until a new bank is learned, so state clones can share it. */
export function cloneKnownBanks(banks: Forager['knownBanks']) {
  const cloned = new Map(banks)
  const index = bankCells.get(banks)
  if (index) bankCells.set(cloned, index)
  return cloned
}

/** Visit remembered banks in spatial rings. Routing still decides whether each bank is accessible.
 * The ring floor bounds Chebyshev distance, which never exceeds a route's integer segment lengths.
 */
export function* knownBanksInChunks(
  person: Pick<Forager, 'groundKnowledge' | 'knownBanks' | 'x' | 'y'>,
  goOn: (floorCm: number) => boolean,
) {
  if (!person.knownBanks.size) return
  const grid = person.groundKnowledge
  const first = routeAnchor(grid, person)
  if (first < 0 || grid.observed[first] !== 1) return
  let index = bankCells.get(person.knownBanks)
  if (index?.size !== person.knownBanks.size) {
    const banks = [...person.knownBanks.values()]
    const points = {
      count: banks.length,
      x: Int32Array.from(banks, (bank) => bank.x),
      y: Int32Array.from(banks, (bank) => bank.y),
    }
    index = {
      size: banks.length,
      banks,
      chunks: buildIndex(points, 16 * grid.cellCm, grid.cells * grid.cellCm),
    }
    bankCells.set(person.knownBanks, index)
  }
  const { cellCm, cells, buckets } = index.chunks
  const cx = Math.min(cells - 1, Math.max(0, Math.floor(person.x / cellCm)))
  const cy = Math.min(cells - 1, Math.max(0, Math.floor(person.y / cellCm)))
  const rings = Math.max(cx, cy, cells - 1 - cx, cells - 1 - cy)
  for (let ring = 0; ring <= rings; ring += 1) {
    if (!goOn(Math.max(0, (ring - 1) * cellCm))) break
    for (let row = cy - ring; row <= cy + ring; row += 1) {
      if (row < 0 || row >= cells) continue
      const edge = row === cy - ring || row === cy + ring
      for (let column = cx - ring; column <= cx + ring; column += edge ? 1 : 2 * ring) {
        if (column >= 0 && column < cells) for (const id of buckets[row * cells + column]!) yield index.banks[id]!
        if (ring === 0) break
      }
    }
  }
}

/** Every potential winner is within this conservative distance bound; no extra grid search is needed. */
export function* nearestKnownBanks(
  person: Pick<Forager, 'groundKnowledge' | 'knownBanks' | 'x' | 'y'>,
  limitCm: () => number,
) {
  yield* knownBanksInChunks(person, (floor) => floor <= 2 * limitCm() + 4 * person.groundKnowledge.cellCm)
}
