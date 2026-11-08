import { cachedHeight, estimateMinutes, knownComponents, routeTriangle, type NavMap } from './routes'
import type { GroundMesh } from './mesh'
import { distance } from './geometry'
import type { BankMemory, Forager, ValleyConfig } from './types'
interface Tree {
  x0: number
  y0: number
  x1: number
  y1: number
  height: number
  points?: BankMemory[]
  /** Each point's ground height, in the order of `points`. */
  heights?: number[]
  left?: Tree
  right?: Tree
}
export interface BankIndex {
  all: Tree | null
  bodies: Map<number, Tree>
}
export function indexBanks(points: BankMemory[], mesh: GroundMesh): BankIndex {
  const build = (list: BankMemory[], depth = 0): Tree | null => {
    if (!list.length) return null
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity,
      height = Infinity
    for (const p of list) {
      x0 = Math.min(x0, p.x)
      x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y)
      y1 = Math.max(y1, p.y)
      height = Math.min(height, cachedHeight(mesh, p.x, p.y))
    }
    if (list.length <= 12)
      return { x0, y0, x1, y1, height, points: list, heights: list.map((p) => cachedHeight(mesh, p.x, p.y)) }
    const axis = depth % 2 ? 'y' : 'x'
    list.sort((a, b) => a[axis] - b[axis] || a.id - b.id)
    const middle = list.length >> 1
    return {
      x0,
      y0,
      x1,
      y1,
      height,
      left: build(list.slice(0, middle), depth + 1)!,
      right: build(list.slice(middle), depth + 1)!,
    }
  }
  const byBody = new Map<number, BankMemory[]>()
  for (const p of points) {
    const list = byBody.get(p.bodyId) ?? []
    list.push(p)
    byBody.set(p.bodyId, list)
  }
  return { all: build([...points]), bodies: new Map([...byBody].map(([id, list]) => [id, build(list)!])) }
}
const bodyCache = new WeakMap<Map<number, BankMemory>, { size: number; seen: Set<number>; ids: number[] }>()
/** The bodies of a person's known banks, in the order their first bank was learned. */
export function knownBodies(banks: Map<number, BankMemory>) {
  let value = bodyCache.get(banks)
  if (!value || value.size !== banks.size) {
    const seen = new Set([...banks.values()].map((b) => b.bodyId))
    value = { size: banks.size, seen, ids: [...seen] }
    bodyCache.set(banks, value)
  }
  return value.ids
}
/** The bodies of a person's known banks, as a set. */
export function knownBodySet(banks: Map<number, BankMemory>): ReadonlySet<number> {
  knownBodies(banks)
  return bodyCache.get(banks)!.seen
}
/**
 * Keeps `knownBodies` current as one new bank of `bodyId` joins `to`, a map that is `from` or a copy of it, so that it
 * is not worked out again from tens of thousands of banks. When `from`'s bodies are not current, nothing is kept and
 * `knownBodies` works them out when next asked.
 */
export function noteKnownBody(from: Map<number, BankMemory>, to: Map<number, BankMemory>, bodyId: number) {
  const value = bodyCache.get(from)
  if (!value || value.size !== to.size - 1) return
  // The lists are never changed in place, since `from` may still be in use.
  const ids = value.seen.has(bodyId) ? value.ids : [...value.ids, bodyId]
  const seen = from === to ? value.seen : new Set(value.seen)
  seen.add(bodyId)
  bodyCache.set(to, { size: to.size, seen, ids })
}
/**
 * Branch bounds use only geometry of already known candidates; the predicate enforces observed connectivity. Answers
 * are kept for the person's current position, knowledge and banks only, since banks are only ever added.
 */
interface QueryCache {
  x: number
  y: number
  revision: number
  size: number
  /** Answers by speed, then by body (-1 for any) and count. */
  answers: Map<number, Map<number, { bank: BankMemory; minutes: number }[]>>
}
const queryCache = new WeakMap<Forager, QueryCache>()
export function nearestBanks(
  nav: NavMap,
  config: ValleyConfig,
  person: Forager,
  speed: number,
  count: number,
  bodyId?: number,
) {
  let cache = queryCache.get(person)
  if (
    !cache ||
    cache.x !== person.x ||
    cache.y !== person.y ||
    cache.revision !== person.knowledge.revision ||
    cache.size !== person.knownBanks.size
  ) {
    cache = {
      x: person.x,
      y: person.y,
      revision: person.knowledge.revision,
      size: person.knownBanks.size,
      answers: new Map(),
    }
    queryCache.set(person, cache)
  }
  let bySpeed = cache.answers.get(speed)
  if (!bySpeed) cache.answers.set(speed, (bySpeed = new Map()))
  // Counts are small; a larger one is not kept.
  const key = count < 1_024 ? ((bodyId ?? -1) + 1) * 1_024 + count : -1
  const saved = bySpeed.get(key)
  if (saved) return saved
  const root = bodyId === undefined ? nav.bankIndex.all : nav.bankIndex.bodies.get(bodyId)
  const results: { bank: BankMemory; minutes: number }[] = []
  if (!root) return results
  const componentOf = knownComponents(nav, person.knowledge),
    anchor = routeTriangle(nav, person.knowledge, person)
  if (anchor < 0) return results
  const home = componentOf(anchor),
    height = cachedHeight(nav.mesh, person.x, person.y)
  const bound = (tree: Tree) =>
    estimateMinutes(
      config,
      person,
      { x: Math.max(tree.x0, Math.min(tree.x1, person.x)), y: Math.max(tree.y0, Math.min(tree.y1, person.y)) },
      speed,
      tree.height - height,
    )
  const visit = (tree: Tree) => {
    if (results.length === count && bound(tree) > results.at(-1)!.minutes) return
    if (tree.points)
      for (let i = 0; i < tree.points.length; i++) {
        const bank = tree.points[i]!
        if (!person.knownBanks.has(bank.id)) continue
        const triangle = routeTriangle(nav, person.knowledge, bank)
        if (triangle < 0 || componentOf(triangle) !== home) continue
        const minutes = estimateMinutes(config, person, bank, speed, tree.heights![i]! - height)
        if (
          results.length === count &&
          (minutes > results.at(-1)!.minutes ||
            (minutes === results.at(-1)!.minutes && bank.id > results.at(-1)!.bank.id))
        )
          continue
        results.push({ bank: person.knownBanks.get(bank.id)!, minutes })
        results.sort((a, b) => a.minutes - b.minutes || a.bank.id - b.bank.id)
        if (results.length > count) results.pop()
      }
    else {
      const a = tree.left!,
        b = tree.right!
      if (bound(a) <= bound(b)) {
        visit(a)
        visit(b)
      } else {
        visit(b)
        visit(a)
      }
    }
  }
  visit(root)
  if (key >= 0) bySpeed.set(key, results)
  return results
}
export interface BodyGrid {
  x0: number
  y0: number
  sizeCm: number
  columns: number
  /** Each square cell, row by row, lists every body whose box around its banks meets the cell. */
  cells: number[][]
}
const bodyGrids = new WeakMap<NavMap, BodyGrid>()
/** Every body with banks on a grid of 32 by 32 square cells over all banks, worked out once per map. */
export function bodyGrid(nav: NavMap): BodyGrid {
  let grid = bodyGrids.get(nav)
  if (grid) return grid
  const columns = 32,
    all = nav.bankIndex.all
  if (!all) grid = { x0: 0, y0: 0, sizeCm: 1, columns, cells: Array.from({ length: columns * columns }, () => []) }
  else {
    const sizeCm = Math.max(1, Math.ceil((Math.max(all.x1 - all.x0, all.y1 - all.y0) + 1) / columns))
    grid = { x0: all.x0, y0: all.y0, sizeCm, columns, cells: Array.from({ length: columns * columns }, () => []) }
    const cell = (v: number, origin: number) => Math.min(columns - 1, Math.floor((v - origin) / sizeCm))
    for (const [bodyId, tree] of nav.bankIndex.bodies)
      for (let r = cell(tree.y0, all.y0); r <= cell(tree.y1, all.y0); r += 1)
        for (let c = cell(tree.x0, all.x0); c <= cell(tree.x1, all.x0); c += 1)
          grid.cells[r * columns + c]!.push(bodyId)
  }
  bodyGrids.set(nav, grid)
  return grid
}
/** The straight-line distance from a point to the box around a body's banks; Infinity for a body with no banks. */
export function bodyDistanceBound(nav: NavMap, from: { x: number; y: number }, bodyId: number) {
  const tree = nav.bankIndex.bodies.get(bodyId)
  if (!tree) return Infinity
  return distance(
    from.x,
    from.y,
    Math.max(tree.x0, Math.min(tree.x1, from.x)),
    Math.max(tree.y0, Math.min(tree.y1, from.y)),
  )
}
/** A lower bound on the minutes from the person to any bank of a body; Infinity for a body with no banks. */
export function bodyMinutesBound(nav: NavMap, config: ValleyConfig, person: Forager, speed: number, bodyId: number) {
  const tree = nav.bankIndex.bodies.get(bodyId)
  if (!tree) return Infinity
  return estimateMinutes(
    config,
    person,
    { x: Math.max(tree.x0, Math.min(tree.x1, person.x)), y: Math.max(tree.y0, Math.min(tree.y1, person.y)) },
    speed,
    tree.height - cachedHeight(nav.mesh, person.x, person.y),
  )
}
