import { describe, expect, it } from 'vitest'
import { distance } from './geometry'
import {
  cloneGroundKnowledge,
  forEachUnknownCell,
  knownDrySegment,
  knownRoute,
  knownWalkSeconds,
  observeRouteCells,
  routeCentre,
  routeFrontierCells,
  type GroundKnowledge,
} from './routes'
import { cardinalCells } from './water'

const ground = (): GroundKnowledge => ({
  cells: 7,
  cellCm: 500,
  observed: new Uint8Array(49).fill(1),
  heights: Int32Array.from({ length: 49 }, (_, id) => (id % 7) * 17 - Math.floor(id / 7) * 11),
  revision: 0,
})

describe('disposable route calculations', () => {
  it('indexes unknown cells in row order and keeps divergent snapshots independent', () => {
    const grid = ground()
    grid.observed.fill(0)
    const visit = (map: GroundKnowledge) => {
      const result: number[] = []
      forEachUnknownCell(map, 2, 5, 1, 6, (id) => result.push(id))
      const expected = Array.from({ length: 49 }, (_, id) => id).filter(
        (id) => Math.floor(id / 7) >= 1 && id % 7 >= 2 && id % 7 <= 5 && !map.observed[id],
      )
      expect(result).toEqual(expected)
    }
    visit(grid)
    const branch = cloneGroundKnowledge(grid)
    branch.observed[32] = 1
    branch.observed[31] = 2
    branch.revision += 1
    observeRouteCells(branch, [31, 32])
    visit(branch)
    branch.observed.fill(1)
    branch.revision += 1
    visit(branch)
    visit(grid)
    grid.observed[33] = 1
    grid.revision += 1
    observeRouteCells(grid, [33])
    visit(grid)
    visit(branch)
  })

  it('reuses canonical subpaths with exact connectors and ascent costs until knowledge changes', () => {
    const grid = ground()
    for (const id of [10, 17, 24, 31, 38]) grid.observed[id] = 0
    const start = routeCentre(grid, 22),
      end = routeCentre(grid, 26)
    const path = knownRoute(grid, start, end)!
    expect(path.length).toBeGreaterThan(3)
    const branch = cloneGroundKnowledge(grid)
    const verify = (map: GroundKnowledge) => {
      for (const point of path.slice(0, -1)) {
        const from = { x: point.x + 1, y: point.y - 1 }
        const cold = { ...map, observed: map.observed.slice(), heights: map.heights.slice() }
        expect(knownRoute(map, from, end)).toEqual(knownRoute(cold, from, end))
        const height = (p: { x: number; y: number }) => map.heights[Math.floor(p.y / 500) * 7 + Math.floor(p.x / 500)]!
        for (const speed of [75, 125])
          expect(knownWalkSeconds(map, from, end, speed, 6, height)).toBe(
            knownWalkSeconds(cold, from, end, speed, 6, height),
          )
      }
    }
    verify(branch)
    branch.observed[24] = 1
    branch.revision += 1
    observeRouteCells(branch, [24])
    verify(branch)
    verify(grid)
  })

  it('keeps predecessor ties equal to exhaustive Dijkstra when resolved goals and partial searches are reused', () => {
    const grid = ground()
    for (const id of [10, 17, 24, 31, 38]) grid.observed[id] = 0
    const verify = (map: GroundKnowledge) => {
      const home = routeCentre(map, 43)
      knownWalkSeconds(map, routeCentre(map, 12), home, 125, 6, () => 0, home)
      for (const root of [8, 15, 22, 12, 19, 26]) {
        const costs = new Float64Array(49).fill(Infinity)
        const parents = new Int32Array(49).fill(-1)
        const open = new Set<number>([root])
        costs[root] = 0
        while (open.size) {
          const id = [...open].sort((a, b) => costs[a]! - costs[b]! || a - b)[0]!
          open.delete(id)
          for (let next = 0; next < 49; next += 1) {
            const dx = Math.abs((next % 7) - (id % 7))
            const dy = Math.abs(Math.floor(next / 7) - Math.floor(id / 7))
            if (map.observed[next] !== 1 || dx > 1 || dy > 1 || (!dx && !dy)) continue
            if (
              dx &&
              dy &&
              (map.observed[Math.floor(id / 7) * 7 + (next % 7)] !== 1 ||
                map.observed[Math.floor(next / 7) * 7 + (id % 7)] !== 1)
            )
              continue
            const cost = costs[id]! + (dx && dy ? 707 : 500)
            if (cost === costs[next] && id < parents[next]!) parents[next] = id
            if (cost >= costs[next]!) continue
            costs[next] = cost
            parents[next] = id
            open.add(next)
          }
        }
        const start = routeCentre(map, root)
        // Query both sides of the opening in mixed order, including repeated goals and failed budgets.
        const targets =
          root % 7 < 3
            ? [12, 40, 19, 33, 26, 5, 47, 13, 41, 20, 34, 27, 6, 48, 12, 26]
            : [8, 36, 15, 29, 22, 1, 43, 7, 35, 14, 28, 21, 0, 42, 8, 22]
        for (const target of targets) {
          const end = routeCentre(map, target)
          knownWalkSeconds(map, end, home, 125, 6, () => 0, home)
          knownWalkSeconds(map, start, end, 125, 6, () => 0, undefined, 1)
          const cells = [target]
          while (cells.at(-1) !== root) cells.push(parents[cells.at(-1)!]!)
          const expected = cells.reverse().map((id) => routeCentre(map, id))
          expected.push(end)
          const direct =
            knownDrySegment(map, start, end) &&
            [-1, 1].every((dx) =>
              [-1, 1].every((dy) =>
                knownDrySegment(map, { x: start.x + dx, y: start.y + dy }, { x: end.x + dx, y: end.y + dy }),
              ),
            )
          expect(knownRoute(map, start, end)).toEqual(direct ? [end] : expected)
        }
      }
    }
    verify(grid)
    const earlier = cloneGroundKnowledge(grid)
    grid.observed[10] = 1
    grid.revision += 1
    observeRouteCells(grid, [10])
    verify(grid)
    verify(earlier)
  })

  it('resumes a budget-limited search with exactly the cold route and cost', () => {
    const grid: GroundKnowledge = {
      cells: 33,
      cellCm: 500,
      observed: new Uint8Array(33 ** 2).fill(1),
      heights: new Int32Array(33 ** 2),
      revision: 0,
    }
    for (let row = 1; row < 32; row += 1) grid.observed[row * 33 + 16] = 2
    const start = routeCentre(grid, 16 * 33 + 1)
    const end = routeCentre(grid, 16 * 33 + 31)
    const cold = { ...grid, observed: grid.observed.slice() }
    const expected = knownWalkSeconds(cold, start, end, 125, 6, () => 0)
    for (const budget of [0, 1, 30, 100, expected - 1, expected, expected + 1])
      expect(knownWalkSeconds(grid, start, end, 125, 6, () => 0, undefined, budget) <= budget).toBe(expected <= budget)
    expect(knownWalkSeconds(grid, start, end, 125, 6, () => 0)).toBe(expected)
    expect(knownRoute(grid, start, end)).toEqual(knownRoute(cold, start, end))
  })

  it('keeps exact travel costs after root, load, climb, knowledge and branch changes', () => {
    const grid = ground()
    for (const cell of [10, 17, 24, 31, 38]) grid.observed[cell] = 0
    const height = (point: { x: number; y: number }) =>
      grid.heights[Math.floor(point.y / 500) * 7 + Math.floor(point.x / 500)]!
    const verify = (map: GroundKnowledge) => {
      for (const speed of [7, 125, 83, 7])
        for (const climb of [6, 0, 9])
          for (const reverse of [false, true])
            for (const cell of [8, 15, 22]) {
              const home = routeCentre(map, cell)
              const away = routeCentre(map, 26)
              const from = reverse ? away : home
              const to = reverse ? home : away
              const route = knownRoute(map, from, to, home)!
              let expected = 0
              let previous = from
              for (const point of route) {
                expected +=
                  Math.ceil(distance(previous.x, previous.y, point.x, point.y) / speed) +
                  Math.ceil((climb * Math.max(0, height(point) - height(previous))) / 100)
                previous = point
              }
              expect(knownWalkSeconds(map, from, to, speed, climb, height, home)).toBe(expected)
              for (const budget of [0, Math.floor(expected / 2), expected - 1, expected, expected + 1]) {
                const bounded = knownWalkSeconds(map, from, to, speed, climb, height, home, budget)
                expect(bounded <= budget).toBe(expected <= budget)
                if (Number.isFinite(bounded)) expect(bounded).toBe(expected)
              }
            }
    }
    verify(grid)
    const earlier = cloneGroundKnowledge(grid)
    grid.observed[17] = 1
    grid.revision += 1
    observeRouteCells(grid, [17])
    verify(grid)
    verify(earlier)
    verify(grid)
  })

  it('keeps the observed frontier exact as new ground closes and opens edges on separate branches', () => {
    const grid = ground()
    grid.observed.fill(0)
    grid.observed[24] = 1
    const verify = (map: GroundKnowledge) => {
      const expected: number[] = []
      for (let id = 0; id < map.observed.length; id += 1)
        if (map.observed[id] === 1 && cardinalCells(map.cells, id).some((next) => map.observed[next] === 0))
          expected.push(id)
      expect([...routeFrontierCells(map)].sort((a, b) => a - b)).toEqual(expected)
    }
    verify(grid)
    const earlier = cloneGroundKnowledge(grid)
    const added = [17, 23, 25, 31]
    for (const cell of added) grid.observed[cell] = 1
    grid.revision += 1
    observeRouteCells(grid, added)
    verify(grid)
    verify(earlier)
    earlier.observed[18] = 2
    earlier.revision += 1
    observeRouteCells(earlier, [18])
    verify(earlier)
    verify(grid)
  })
})
