import { heightAt } from './terrain'
import { cardinalCells, CellHeap } from './water'
import { knownRoute, routeCell, routeCentre, observeRouteCells } from './routes'
import type { Forager, Point, ValleyConfig, ValleyLayout } from './types'

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
  for (let y = y0; y <= y1; y += 1)
    for (let x = x0; x <= x1; x += 1) {
      const id = y * grid.cells + x
      if (grid.observed[id]) continue
      const corners = [
        { x: x * grid.cellCm, y: y * grid.cellCm },
        { x: (x + 1) * grid.cellCm, y: y * grid.cellCm },
        { x: x * grid.cellCm, y: (y + 1) * grid.cellCm },
        { x: (x + 1) * grid.cellCm, y: (y + 1) * grid.cellCm },
      ]
      if (!corners.every((p) => (p.x - origin.x) ** 2 + (p.y - origin.y) ** 2 <= radius ** 2 && visible(p))) continue
      grid.observed[id] = water.body[id]! < 0 ? 1 : 2
      const centre = routeCentre(grid, id)
      grid.heights[id] = heightAt(layout.terrain, centre.x, centre.y)
      newlySeen.push(id)
    }
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
const frontiers = new WeakMap<Forager['groundKnowledge'], { revision: number; cells: number[] }>()
export function frontier(
  person: Forager,
  target: Point,
  allowed: (point: Point) => boolean = () => true,
): readonly Point[] | null {
  const grid = person.groundKnowledge
  let cached = frontiers.get(grid)
  if (cached?.revision !== grid.revision) {
    const cells: number[] = []
    for (let id = 0; id < grid.observed.length; id += 1)
      if (grid.observed[id] === 1 && cardinalCells(grid.cells, id).some((next) => grid.observed[next] === 0))
        cells.push(id)
    cached = { revision: grid.revision, cells }
    frontiers.set(grid, cached)
  }
  const candidates: { id: number; distance: number }[] = []
  for (const id of cached.cells) {
    const p = routeCentre(grid, id)
    if (p.x === person.x && p.y === person.y) continue
    candidates.push({ id, distance: (p.x - target.x) ** 2 + (p.y - target.y) ** 2 })
  }
  candidates.sort((a, b) => a.distance - b.distance || a.id - b.id)
  for (const candidate of candidates) {
    const path = knownRoute(grid, person, routeCentre(grid, candidate.id))
    if (path && allowed(routeCentre(grid, candidate.id))) return path
  }
  return null
}

const bankCells = new WeakMap<
  Forager['knownBanks'],
  { size: number; cells: Map<number, import('./types').BankMemory[]> }
>()
/** Visit accessible banks locally before considering distant shores. Uses only observed cells and remembered banks.
 * A dry straight shortcut has a cardinal cell-centre staircase no longer than twice its length plus four cells;
 * other routes already use cell centres. This conservative bound includes every bank able to beat the current limit.
 */
export function* nearestKnownBanks(
  person: Pick<Forager, 'groundKnowledge' | 'knownBanks' | 'x' | 'y'>,
  limitCm: () => number,
) {
  if (!person.knownBanks.size) return
  const grid = person.groundKnowledge
  const first = routeCell(grid, person)
  if (first < 0 || grid.observed[first] !== 1) return
  let index = bankCells.get(person.knownBanks)
  if (index?.size !== person.knownBanks.size) {
    index = { size: person.knownBanks.size, cells: new Map() }
    for (const bank of person.knownBanks.values()) {
      const at = index.cells.get(bank.dryCell) ?? []
      at.push(bank)
      index.cells.set(bank.dryCell, at)
    }
    bankCells.set(person.knownBanks, index)
  }
  const heap = new CellHeap()
  heap.push(first, 0)
  const costs = new Map([[first, 0]]),
    closed = new Set<number>()
  const diagonal = Math.floor(Math.sqrt(2 * grid.cellCm ** 2))
  while (heap.length && heap.minPriority <= 2 * limitCm() + 4 * grid.cellCm) {
    const { id, priority } = heap.pop()
    if (closed.has(id) || costs.get(id) !== priority) continue
    closed.add(id)
    for (const bank of index.cells.get(id) ?? []) yield bank
    const x = id % grid.cells,
      y = Math.floor(id / grid.cells)
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= grid.cells || y + dy >= grid.cells) continue
        const next = (y + dy) * grid.cells + x + dx
        if (
          grid.observed[next] !== 1 ||
          closed.has(next) ||
          (dx && dy && (grid.observed[y * grid.cells + x + dx] !== 1 || grid.observed[(y + dy) * grid.cells + x] !== 1))
        )
          continue
        const cost = priority + (dx && dy ? diagonal : grid.cellCm)
        if (cost >= (costs.get(next) ?? Infinity)) continue
        costs.set(next, cost)
        heap.push(next, cost)
      }
  }
}
