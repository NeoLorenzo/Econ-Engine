import { CellHeap } from './water'
import type { Point } from './types'
import { distance } from './geometry'

export interface GroundKnowledge {
  cells: number
  cellCm: number
  /** 0 unknown, 1 observed dry, 2 observed wet. */
  observed: Uint8Array
  heights: Int32Array
  revision: number
}

interface Components {
  token: object
  revision: number
  parent: Int32Array
  size: Uint32Array
}
const componentCache = new WeakMap<GroundKnowledge, Components>()
const frontierCache = new WeakMap<GroundKnowledge, { revision: number; cells: Set<number> }>()

function isFrontier(grid: GroundKnowledge, cell: number) {
  if (grid.observed[cell] !== 1) return false
  const n = grid.cells
  return (
    (cell >= n && grid.observed[cell - n] === 0) ||
    (cell % n > 0 && grid.observed[cell - 1] === 0) ||
    ((cell % n) + 1 < n && grid.observed[cell + 1] === 0) ||
    (cell + n < grid.observed.length && grid.observed[cell + n] === 0)
  )
}

/** Only observed dry cells next to unknown ground; shared snapshots are never updated in place. */
export function routeFrontierCells(grid: GroundKnowledge): ReadonlySet<number> {
  let cached = frontierCache.get(grid)
  if (cached?.revision !== grid.revision) {
    const cells = new Set<number>()
    for (let cell = 0; cell < grid.observed.length; cell += 1) if (isFrontier(grid, cell)) cells.add(cell)
    cached = { revision: grid.revision, cells }
    frontierCache.set(grid, cached)
  }
  return cached.cells
}

function extendFrontier(grid: GroundKnowledge, added: readonly number[]) {
  const cached = frontierCache.get(grid)
  if (!cached || cached.revision !== grid.revision - 1) return
  const cells = new Set(cached.cells)
  const update = (cell: number) => {
    if (isFrontier(grid, cell)) cells.add(cell)
    else cells.delete(cell)
  }
  for (const cell of added) {
    update(cell)
    if (cell >= grid.cells) update(cell - grid.cells)
    if (cell % grid.cells > 0) update(cell - 1)
    if ((cell % grid.cells) + 1 < grid.cells) update(cell + 1)
    if (cell + grid.cells < grid.observed.length) update(cell + grid.cells)
  }
  frontierCache.set(grid, { revision: grid.revision, cells })
}
const knowledgeTokens = new WeakMap<GroundKnowledge, object>()
const unknownCells = new WeakMap<GroundKnowledge, { token: object; revision: number; words: Uint32Array }>()

/** Skip whole runs of already observed ground, retaining ascending cell order. */
export function forEachUnknownCell(
  grid: GroundKnowledge,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  visit: (id: number) => void,
) {
  let cached = unknownCells.get(grid)
  if (cached?.token !== tokenOf(grid) || cached.revision !== grid.revision) {
    const words = new Uint32Array(Math.ceil(grid.observed.length / 32))
    for (let id = 0; id < grid.observed.length; id += 1) if (!grid.observed[id]) words[id >>> 5]! |= 1 << (id & 31)
    cached = { token: tokenOf(grid), revision: grid.revision, words }
    unknownCells.set(grid, cached)
  }
  for (let y = y0; y <= y1; y += 1) {
    const first = y * grid.cells + x0,
      last = y * grid.cells + x1
    for (let word = first >>> 5; word <= last >>> 5; word += 1) {
      let bits = cached.words[word]!
      if (word === first >>> 5) bits &= 0xffff_ffff << (first & 31)
      if (word === last >>> 5) bits &= 0xffff_ffff >>> (31 - (last & 31))
      while (bits) {
        const bit = 31 - Math.clz32(bits & -bits)
        visit(word * 32 + bit)
        bits &= bits - 1
      }
    }
  }
}
function tokenOf(grid: GroundKnowledge) {
  let token = knowledgeTokens.get(grid)
  if (!token) {
    token = {}
    knowledgeTokens.set(grid, token)
  }
  return token
}
function rootOf(components: Components, cell: number) {
  const parent = components.parent
  if (parent[cell]! < 0) return -1
  let root = cell
  while (parent[root] !== root) root = parent[root]!
  while (cell !== root) {
    const next = parent[cell]!
    parent[cell] = root
    cell = next
  }
  return root
}
function join(components: Components, a: number, b: number) {
  let first = rootOf(components, a)
  let second = rootOf(components, b)
  if (first < 0 || second < 0 || first === second) return
  if (components.size[first]! < components.size[second]!) [first, second] = [second, first]
  components.parent[second] = first
  components.size[first]! += components.size[second]!
}
function addCells(grid: GroundKnowledge, components: Components, cells: readonly number[]) {
  for (const cell of cells) {
    if (grid.observed[cell] !== 1) continue
    components.parent[cell] = cell
    components.size[cell] = 1
  }
  for (const cell of cells) {
    if (grid.observed[cell] !== 1) continue
    if (cell >= grid.cells) join(components, cell, cell - grid.cells)
    if (cell % grid.cells) join(components, cell, cell - 1)
    if ((cell % grid.cells) + 1 < grid.cells) join(components, cell, cell + 1)
    if (cell + grid.cells < grid.observed.length) join(components, cell, cell + grid.cells)
  }
  components.revision = grid.revision
}
/** Warm connectivity is extended only by newly observed cells; a cold cache is derived from the same mask. */
export function observeRouteCells(grid: GroundKnowledge, cells: readonly number[]) {
  extendFrontier(grid, cells)
  const previousToken = tokenOf(grid)
  knowledgeTokens.set(grid, {})
  const unknown = unknownCells.get(grid)
  if (unknown?.token === previousToken && unknown.revision === grid.revision - 1) {
    for (const cell of cells) unknown.words[cell >>> 5]! &= ~(1 << (cell & 31))
    unknown.token = tokenOf(grid)
    unknown.revision = grid.revision
  }
  const cached = componentCache.get(grid)
  if (cached && cached.revision === grid.revision - 1 && cached.token === previousToken) {
    addCells(grid, cached, cells)
    cached.token = tokenOf(grid)
  }
  extendSearchTrees(grid, cells, previousToken)
}
function componentsOf(grid: GroundKnowledge) {
  let cached = componentCache.get(grid)
  if (cached?.revision === grid.revision && cached.token === tokenOf(grid)) return cached
  cached = {
    token: tokenOf(grid),
    revision: grid.revision,
    parent: new Int32Array(grid.observed.length).fill(-1),
    size: new Uint32Array(grid.observed.length),
  }
  for (let cell = 0; cell < grid.observed.length; cell += 1) {
    if (grid.observed[cell] !== 1) continue
    cached.parent[cell] = cell
    cached.size[cell] = 1
  }
  for (let cell = 0; cell < grid.observed.length; cell += 1) {
    if (grid.observed[cell] !== 1) continue
    if (cell >= grid.cells) join(cached, cell, cell - grid.cells)
    if (cell % grid.cells) join(cached, cell, cell - 1)
  }
  componentCache.set(grid, cached)
  return cached
}

export const routeCell = (grid: Pick<GroundKnowledge, 'cells' | 'cellCm'>, point: Point) =>
  point.x < 0 || point.y < 0 || point.x > grid.cells * grid.cellCm || point.y > grid.cells * grid.cellCm
    ? -1
    : Math.min(grid.cells - 1, Math.floor(point.y / grid.cellCm)) * grid.cells +
      Math.min(grid.cells - 1, Math.floor(point.x / grid.cellCm))

export const routeCentre = (grid: Pick<GroundKnowledge, 'cells' | 'cellCm'>, cell: number): Point => ({
  x: (cell % grid.cells) * grid.cellCm + Math.floor(grid.cellCm / 2),
  y: Math.floor(cell / grid.cells) * grid.cellCm + Math.floor(grid.cellCm / 2),
})

/** Conservative footprint for a hut and its displaced sleeper, entirely on observed dry cells. */
export function knownDryFootprint(grid: GroundKnowledge, point: Point, radiusCm = 250) {
  const size = grid.cells * grid.cellCm
  if (point.x - radiusCm < 0 || point.y - radiusCm < 0 || point.x + radiusCm > size || point.y + radiusCm > size)
    return false
  for (
    let y = Math.floor((point.y - radiusCm) / grid.cellCm);
    y <= Math.min(grid.cells - 1, Math.floor((point.y + radiusCm) / grid.cellCm));
    y += 1
  )
    for (
      let x = Math.floor((point.x - radiusCm) / grid.cellCm);
      x <= Math.min(grid.cells - 1, Math.floor((point.x + radiusCm) / grid.cellCm));
      x += 1
    ) {
      const nx = Math.max(x * grid.cellCm, Math.min((x + 1) * grid.cellCm, point.x))
      const ny = Math.max(y * grid.cellCm, Math.min((y + 1) * grid.cellCm, point.y))
      if ((nx - point.x) ** 2 + (ny - point.y) ** 2 <= radiusCm ** 2 && grid.observed[y * grid.cells + x] !== 1)
        return false
    }
  return true
}

/** Exact grid traversal, including both sides when the segment touches an edge or corner. */
export function knownDrySegment(grid: GroundKnowledge, a: Point, b: Point) {
  if (routeCell(grid, a) < 0 || routeCell(grid, b) < 0) return false
  const c = grid.cellCm
  const dx = b.x - a.x
  const dy = b.y - a.y
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  const sx = Math.sign(dx)
  const sy = Math.sign(dy)
  let x = Math.floor(a.x / c)
  let y = Math.floor(a.y / c)
  const endX = Math.floor(b.x / c)
  const endY = Math.floor(b.y / c)
  const dry = (i: number, j: number) =>
    i < 0 || j < 0 || i >= grid.cells || j >= grid.cells || grid.observed[j * grid.cells + i] === 1
  const atPoint = (p: Point) => {
    const i = Math.floor(p.x / c)
    const j = Math.floor(p.y / c)
    return (
      dry(i, j) &&
      (p.x % c !== 0 || dry(i - 1, j)) &&
      (p.y % c !== 0 || dry(i, j - 1)) &&
      (p.x % c !== 0 || p.y % c !== 0 || dry(i - 1, j - 1))
    )
  }
  if (!atPoint(a) || !atPoint(b)) return false
  let nextX = sx > 0 ? (x + 1) * c - a.x : a.x - x * c
  let nextY = sy > 0 ? (y + 1) * c - a.y : a.y - y * c
  for (let step = 0; step <= 2 * grid.cells + 2; step += 1) {
    if (!dry(x, y) || (!dx && a.x % c === 0 && !dry(x - 1, y)) || (!dy && a.y % c === 0 && !dry(x, y - 1))) return false
    if (x === endX && y === endY) return true
    const tx = dx ? nextX * ay : Infinity
    const ty = dy ? nextY * ax : Infinity
    if (tx === ty) {
      if (!dry(x + sx, y) || !dry(x, y + sy)) return false
      x += sx
      y += sy
      nextX += c
      nextY += c
    } else if (tx < ty) {
      x += sx
      nextX += c
    } else {
      y += sy
      nextY += c
    }
  }
  return false
}
interface RouteTree {
  token: object
  home: boolean
  goal: number
  queries: number
  root: number
  generation: number
  seen: Uint32Array
  cost: Float64Array
  parent: Int32Array
  closed: Uint32Array
  heap: CellHeap
  travel?: {
    speed: number
    climb: number
    reverse: boolean
    version: number
    seen: Uint32Array
    seconds: Float64Array
  }
}
const trees = new WeakMap<GroundKnowledge, { revision: number; forward?: RouteTree; home?: RouteTree }>()

/** New dry cells can shorten old routes, including diagonals beside an already known cell. */
function extendSearchTrees(grid: GroundKnowledge, cells: readonly number[], previousToken: object) {
  const previous = trees.get(grid)
  if (!previous || previous.revision !== grid.revision - 1) return
  const cache = { revision: grid.revision, forward: previous.forward, home: previous.home }
  trees.set(grid, cache)
  const affected = new Set<number>()
  for (const cell of cells) {
    if (grid.observed[cell] !== 1) continue
    const x = cell % grid.cells
    const y = Math.floor(cell / grid.cells)
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1)
        if (x + dx >= 0 && y + dy >= 0 && x + dx < grid.cells && y + dy < grid.cells)
          affected.add((y + dy) * grid.cells + x + dx)
  }
  const ordered = [...affected].sort((a, b) => a - b)
  for (const tree of [cache.forward, cache.home]) {
    if (!tree || tree.token !== previousToken) continue
    tree.token = tokenOf(grid)
    tree.goal = -2
    if (tree.travel) tree.travel.speed = -1
    for (const cell of ordered) {
      const cost = tree.cost[cell]!
      if (tree.seen[cell] !== tree.generation) continue
      tree.closed[cell] = 0
      tree.heap.push(cell, cost)
    }
  }
  cache.revision = grid.revision
}

/** A few moving-root goals use octile A*; bulk queries and the stable home root share a zero-heuristic search. */
function treeOf(grid: GroundKnowledge, root: number, home: boolean) {
  let cache = trees.get(grid)
  if (cache?.revision !== grid.revision) {
    cache = { revision: grid.revision }
    trees.set(grid, cache)
  }
  const slot = home ? 'home' : 'forward'
  let tree = cache[slot]
  if (!tree || tree.cost.length !== grid.observed.length) {
    tree = {
      token: tokenOf(grid),
      home,
      goal: -2,
      queries: 0,
      root: -1,
      heap: new CellHeap(),
      generation: 0,
      seen: new Uint32Array(grid.observed.length),
      cost: new Float64Array(grid.observed.length),
      parent: new Int32Array(grid.observed.length),
      closed: new Uint32Array(grid.observed.length),
    }
    cache[slot] = tree
  }
  if (tree.root !== root || tree.token !== tokenOf(grid)) {
    if (tree.generation === 0xffff_ffff) {
      tree.seen.fill(0)
      tree.closed.fill(0)
      tree.generation = 0
    }
    tree.generation += 1
    tree.goal = -2
    tree.queries = 0
    tree.root = root
    tree.token = tokenOf(grid)
    tree.heap.clear()
    tree.cost[root] = 0
    tree.seen[root] = tree.generation
    tree.closed[root] = 0
    tree.heap.push(root, 0)
    if (tree.travel) tree.travel.speed = -1
  }
  return tree
}
function expandTo(grid: GroundKnowledge, tree: RouteTree, target: number, limitCm: number) {
  const { heap, cost, parent, closed, seen, generation } = tree
  const diagonal = Math.floor(Math.sqrt(2 * grid.cellCm ** 2))
  const goal = !tree.home && tree.queries < 8 ? target : -1
  const heuristic = (id: number) => {
    if (goal < 0) return 0
    const dx = Math.abs((id % grid.cells) - (goal % grid.cells))
    const dy = Math.abs(Math.floor(id / grid.cells) - Math.floor(goal / grid.cells))
    return Math.min(dx, dy) * diagonal + Math.abs(dx - dy) * grid.cellCm
  }
  if (tree.goal !== goal) {
    if (goal >= 0) tree.queries += 1
    heap.reprioritize((id) =>
      closed[id] === generation || seen[id] !== generation ? undefined : cost[id]! + heuristic(id),
    )
    tree.goal = goal
  }
  // Include the entire equal-cost frontier so predecessor ties do not depend on previous queries or the heuristic.
  while (
    heap.length &&
    heap.minPriority <= limitCm &&
    (closed[target] !== generation || heap.minPriority <= cost[target]!)
  ) {
    const priority = heap.minPriority
    const id = heap.popId()
    if (closed[id] === generation || seen[id] !== generation || priority !== cost[id]! + heuristic(id)) continue
    closed[id] = generation
    const x = id % grid.cells
    const y = Math.floor(id / grid.cells)
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= grid.cells || y + dy >= grid.cells) continue
        const next = (y + dy) * grid.cells + x + dx
        if (grid.observed[next] !== 1) continue
        if (
          dx &&
          dy &&
          (grid.observed[y * grid.cells + x + dx] !== 1 || grid.observed[(y + dy) * grid.cells + x] !== 1)
        )
          continue
        const nextCost = cost[id]! + (dx && dy ? diagonal : grid.cellCm)
        const previous = seen[next] === generation ? cost[next]! : Infinity
        if (nextCost === previous && id < parent[next]!) parent[next] = id
        if (nextCost >= previous) continue
        seen[next] = generation
        cost[next] = nextCost
        parent[next] = id
        closed[next] = 0
        heap.push(next, nextCost + heuristic(next))
      }
  }
  return closed[target] === generation && cost[target]! <= limitCm
}

interface SavedPath {
  token: object
  cells: number[]
  indices: Map<number, number>
  times: Map<string, Float64Array>
}
const savedPaths = new WeakMap<GroundKnowledge, SavedPath>()

function planRoute(grid: GroundKnowledge, start: Point, end: Point, reverse: boolean, limitCm = Infinity) {
  const first = routeCell(grid, start)
  const last = routeCell(grid, end)
  if (first < 0 || last < 0 || grid.observed[first] !== 1 || grid.observed[last] !== 1) return null
  // Integer movement may round a point by less than one centimetre in either axis. Keep that envelope dry too.
  if (
    knownDrySegment(grid, start, end) &&
    [-1, 1].every((dx) =>
      [-1, 1].every((dy) =>
        knownDrySegment(grid, { x: start.x + dx, y: start.y + dy }, { x: end.x + dx, y: end.y + dy }),
      ),
    )
  )
    return { direct: true as const }
  const connectivity = componentsOf(grid)
  if (rootOf(connectivity, first) !== rootOf(connectivity, last)) return null
  const fromCentre = routeCentre(grid, first)
  const toCentre = routeCentre(grid, last)
  if (!knownDrySegment(grid, start, fromCentre) || !knownDrySegment(grid, toCentre, end)) return null
  const saved = savedPaths.get(grid)
  if (!reverse && saved?.token === tokenOf(grid)) {
    const fromIndex = saved.indices.get(first)
    const toIndex = saved.indices.get(last)
    // A subpath of the canonical shortest path has the same shortest-distance and predecessor ties.
    if (fromIndex !== undefined && toIndex !== undefined && fromIndex <= toIndex)
      return { direct: false as const, first, last, saved, fromIndex, toIndex }
  }
  const root = reverse ? last : first
  const target = reverse ? first : last
  const tree = treeOf(grid, root, reverse)
  if (!expandTo(grid, tree, target, limitCm)) return null
  return { direct: false as const, first, last, root, target, tree }
}

function findKnownRoute(grid: GroundKnowledge, start: Point, end: Point, reverse: boolean): Point[] | null {
  const plan = planRoute(grid, start, end, reverse)
  if (!plan) return null
  if (plan.direct) return [{ x: end.x, y: end.y }]
  if (plan.saved) {
    const route = plan.saved.cells.slice(plan.fromIndex, plan.toIndex + 1).map((cell) => routeCentre(grid, cell))
    route.push({ x: end.x, y: end.y })
    return route
  }
  const { root, target, tree } = plan
  const cells = [target]
  let cursor = target
  while (cursor !== root) {
    cursor = tree.parent[cursor]!
    cells.push(cursor)
  }
  if (!reverse) cells.reverse()
  if (!reverse)
    savedPaths.set(grid, {
      token: tokenOf(grid),
      cells,
      indices: new Map(cells.map((cell, index) => [cell, index])),
      times: new Map(),
    })
  const route = cells.map((cell) => routeCentre(grid, cell))
  route.push({ x: end.x, y: end.y })
  return route
}
/** Exact estimates along the selected route, sharing the costs of common cell-centre prefixes. */
export function knownWalkSeconds(
  grid: GroundKnowledge,
  start: Point,
  end: Point,
  speed: number,
  climb: number,
  pointHeight: (point: Point) => number,
  home?: Point,
  maxSeconds = Infinity,
) {
  const reverse = home !== undefined && end.x === home.x && end.y === home.y
  // Grid distance alone already costs this much time, before connectors, rounding and ascent.
  // Keep the unfinished frontier available for a later query with a larger budget.
  const plan = planRoute(grid, start, end, reverse, maxSeconds * speed)
  if (!plan) return Infinity
  const connector = (a: Point, b: Point) =>
    Math.ceil(distance(a.x, a.y, b.x, b.y) / speed) +
    Math.ceil((climb * Math.max(0, pointHeight(b) - pointHeight(a))) / 100)
  if (plan.direct) return connector(start, end)
  if (plan.saved) {
    const { saved, fromIndex, toIndex, first, last } = plan
    const key = `${speed}:${climb}`
    let times = saved.times.get(key)
    if (!times) {
      times = new Float64Array(saved.cells.length)
      const diagonal = Math.floor(Math.sqrt(2 * grid.cellCm ** 2))
      for (let index = 1; index < saved.cells.length; index += 1) {
        const cell = saved.cells[index]!,
          previous = saved.cells[index - 1]!
        const diagonalStep =
          cell % grid.cells !== previous % grid.cells &&
          Math.floor(cell / grid.cells) !== Math.floor(previous / grid.cells)
        times[index] =
          times[index - 1]! +
          Math.ceil((diagonalStep ? diagonal : grid.cellCm) / speed) +
          Math.ceil((climb * Math.max(0, grid.heights[cell]! - grid.heights[previous]!)) / 100)
      }
      if (saved.times.size >= 4) saved.times.delete(saved.times.keys().next().value!)
      saved.times.set(key, times)
    }
    return (
      connector(start, routeCentre(grid, first)) +
      times[toIndex]! -
      times[fromIndex]! +
      connector(routeCentre(grid, last), end)
    )
  }
  const { tree, root, target, first, last } = plan
  let travel = tree.travel
  if (!travel) {
    travel = {
      speed: -1,
      climb,
      reverse,
      version: 0,
      seen: new Uint32Array(grid.observed.length),
      seconds: new Float64Array(grid.observed.length),
    }
    tree.travel = travel
  }
  if (travel.speed !== speed || travel.climb !== climb || travel.reverse !== reverse) {
    if (travel.version === 0xffff_ffff) {
      travel.seen.fill(0)
      travel.version = 0
    }
    travel.version += 1
    travel.seen[root] = travel.version
    travel.seconds[root] = 0
    travel.speed = speed
    travel.climb = climb
    travel.reverse = reverse
  }
  const pending: number[] = []
  let cursor = target
  while (travel.seen[cursor] !== travel.version) {
    pending.push(cursor)
    cursor = tree.parent[cursor]!
  }
  const diagonal = Math.floor(Math.sqrt(2 * grid.cellCm ** 2))
  for (let index = pending.length - 1; index >= 0; index -= 1) {
    const cell = pending[index]!,
      parent = tree.parent[cell]!
    const diagonalStep =
      cell % grid.cells !== parent % grid.cells && Math.floor(cell / grid.cells) !== Math.floor(parent / grid.cells)
    const rise = (grid.heights[cell]! - grid.heights[parent]!) * (reverse ? -1 : 1)
    travel.seconds[cell] =
      travel.seconds[parent]! +
      Math.ceil((diagonalStep ? diagonal : grid.cellCm) / speed) +
      Math.ceil((climb * Math.max(0, rise)) / 100)
    travel.seen[cell] = travel.version
  }
  return connector(start, routeCentre(grid, first)) + travel.seconds[target]! + connector(routeCentre(grid, last), end)
}

const routeCache = new WeakMap<GroundKnowledge, { revision: number; paths: Map<string, Point[] | null> }>()

/** Derived caches are disposable. Tokens invalidate an older branch before any extended search can be reused there. */
export function cloneGroundKnowledge(grid: GroundKnowledge): GroundKnowledge {
  const cloned = { ...grid, observed: grid.observed.slice(), heights: grid.heights.slice() }
  knowledgeTokens.set(cloned, tokenOf(grid))
  const unknown = unknownCells.get(grid)
  if (unknown) unknownCells.set(cloned, unknown)
  const components = componentCache.get(grid)
  if (components) componentCache.set(cloned, components)
  const search = trees.get(grid)
  if (search) trees.set(cloned, { ...search })
  const paths = routeCache.get(grid)
  if (paths) routeCache.set(cloned, paths)
  const frontier = frontierCache.get(grid)
  if (frontier) frontierCache.set(cloned, frontier)
  const saved = savedPaths.get(grid)
  if (saved) savedPaths.set(cloned, saved)
  return cloned
}

/** Cache identity includes exact connector endpoints and the observer's knowledge revision. */
export function knownRoute(grid: GroundKnowledge, start: Point, end: Point, home?: Point): readonly Point[] | null {
  const first = routeCell(grid, start)
  const last = routeCell(grid, end)
  if (first < 0 || last < 0 || grid.observed[first] !== 1 || grid.observed[last] !== 1) return null
  let cache = routeCache.get(grid)
  if (cache?.revision !== grid.revision) {
    cache = { revision: grid.revision, paths: new Map() }
    routeCache.set(grid, cache)
  }
  const reverse = home !== undefined && end.x === home.x && end.y === home.y
  const key = `${reverse ? 1 : 0}:${start.x},${start.y}:${end.x},${end.y}`
  const previous = cache.paths.get(key)
  if (previous !== undefined) return previous
  const route = findKnownRoute(grid, start, end, reverse)
  if (cache.paths.size >= 512) cache.paths.delete(cache.paths.keys().next().value!)
  cache.paths.set(key, route)
  return route
}
