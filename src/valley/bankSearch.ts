import { cachedHeight, estimateMinutes, routeNode, type RouteLattice, type Knowledge } from './routes'
import type { BankMemory, Forager, ValleyConfig } from './types'
import type { Terrain } from './terrain'
interface Tree {
  x0: number
  y0: number
  x1: number
  y1: number
  height: number
  points?: BankMemory[]
  left?: Tree
  right?: Tree
}
export interface BankIndex {
  all: Tree | null
  bodies: Map<number, Tree>
}
export function indexBanks(points: BankMemory[], terrain: Terrain): BankIndex {
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
      height = Math.min(height, cachedHeight(terrain, p.x, p.y))
    }
    if (list.length <= 12) return { x0, y0, x1, y1, height, points: list }
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
const componentCache = new WeakMap<Knowledge, { revision: number; labels: Int32Array }>()
export function knownComponents(lattice: RouteLattice, knowledge: Knowledge) {
  const saved = componentCache.get(knowledge)
  if (saved?.revision === knowledge.revision) return saved.labels
  const labels = new Int32Array(lattice.dry.length).fill(-1),
    n = lattice.cells
  const dirs = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const
  let label = 0
  for (let root = 0; root < labels.length; root++) {
    if (!lattice.dry[root] || !knowledge.nodes[root] || labels[root]! >= 0) continue
    const todo = [root]
    labels[root] = label
    for (let i = 0; i < todo.length; i++) {
      const id = todo[i]!
      for (let d = 0; d < 8; d++) {
        if (!(lattice.edges[id]! & (1 << d))) continue
        const [dx, dy] = dirs[d]!,
          next = id + dy * n + dx
        if (dx && dy && (!knowledge.nodes[id + dx] || !knowledge.nodes[id + dy * n])) continue
        if (knowledge.nodes[next] && labels[next]! < 0) {
          labels[next] = label
          todo.push(next)
        }
      }
    }
    label++
  }
  componentCache.set(knowledge, { revision: knowledge.revision, labels })
  return labels
}
const bodyCache = new WeakMap<Map<number, BankMemory>, { size: number; ids: number[] }>()
export function knownBodies(banks: Map<number, BankMemory>) {
  let value = bodyCache.get(banks)
  if (!value || value.size !== banks.size) {
    value = { size: banks.size, ids: [...new Set([...banks.values()].map((b) => b.bodyId))] }
    bodyCache.set(banks, value)
  }
  return value.ids
}
/** Branch bounds use only geometry of already known candidates; the predicate enforces observed connectivity. */
const queryCache = new WeakMap<Forager, Map<string, { bank: BankMemory; minutes: number }[]>>()
export function nearestBanks(
  lattice: RouteLattice,
  terrain: Terrain,
  config: ValleyConfig,
  person: Forager,
  speed: number,
  count: number,
  bodyId?: number,
) {
  let cache = queryCache.get(person)
  if (!cache) {
    cache = new Map()
    queryCache.set(person, cache)
  }
  const key = `${person.x},${person.y}:${speed}:${count}:${bodyId}:${person.knowledge.revision}:${person.knownBanks.size}`
  const saved = cache.get(key)
  if (saved) return saved
  const root = bodyId === undefined ? lattice.bankIndex.all : lattice.bankIndex.bodies.get(bodyId)
  const results: { bank: BankMemory; minutes: number }[] = []
  if (!root) return results
  const labels = knownComponents(lattice, person.knowledge),
    anchor = routeNode(lattice, person.knowledge, person)
  if (anchor < 0) return results
  const height = cachedHeight(terrain, person.x, person.y)
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
      for (const bank of tree.points) {
        if (!person.knownBanks.has(bank.id)) continue
        const node = bank.connectorNode ?? routeNode(lattice, person.knowledge, bank)
        if (node < 0 || labels[node] !== labels[anchor]) continue
        const minutes = estimateMinutes(config, person, bank, speed, cachedHeight(terrain, bank.x, bank.y) - height)
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
  if (person.knownBanks.size < 100) cache.set(key, results)
  return results
}
