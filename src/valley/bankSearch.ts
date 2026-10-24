import { cachedHeight, estimateMinutes, knownComponents, routeTriangle, type NavMap } from './routes'
import type { GroundMesh } from './mesh'
import type { BankMemory, Forager, ValleyConfig } from './types'
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
  nav: NavMap,
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
      for (const bank of tree.points) {
        if (!person.knownBanks.has(bank.id)) continue
        const triangle = routeTriangle(nav, person.knowledge, bank)
        if (triangle < 0 || componentOf(triangle) !== home) continue
        const minutes = estimateMinutes(config, person, bank, speed, cachedHeight(nav.mesh, bank.x, bank.y) - height)
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
