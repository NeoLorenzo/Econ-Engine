import { describe, expect, it } from 'vitest'
import { deriveWater, waterViolations } from './water'
import { fishCapacity, fishGrowth } from './fish'
import { newHydration, waterSecond, type HydrationConfig } from './hydration'
import { distance, stepTowards } from './geometry'
import { nearestKnownBanks } from './waterKnowledge'
import type { BankMemory } from './types'
import {
  cloneGroundKnowledge,
  knownRoute,
  knownWalkSeconds,
  knownDrySegment,
  observeRouteCells,
  type GroundKnowledge,
} from './routes'

describe('Life 11 water rules', () => {
  it('keeps rounded movement clear of a wet corner even when the exact chord narrowly misses it', () => {
    const grid: GroundKnowledge = {
      cells: 5,
      cellCm: 500,
      observed: new Uint8Array(25).fill(1),
      heights: new Int32Array(25),
      revision: 0,
    }
    grid.observed[12] = 2
    let from = { x: 750, y: 1249 }
    const end = { x: 1249, y: 750 }
    expect(knownDrySegment(grid, from, end)).toBe(true)
    const route = knownRoute(grid, from, end)!
    expect(route.length).toBeGreaterThan(1)
    for (const target of route) {
      const origin = from
      for (let cm = 1; cm <= distance(origin.x, origin.y, target.x, target.y); cm += 1) {
        const next = stepTowards(origin, target, cm)
        expect(knownDrySegment(grid, origin, next)).toBe(true)
        expect(knownDrySegment(grid, from, next)).toBe(true)
        from = next
      }
      from = target
    }
  })
  it('fills a bowl to its spill, with acyclic drainage and unique water area', () => {
    const heights = Int32Array.from([
      10, 10, 10, 10, 10, 10, 2, 2, 2, 10, 10, 2, 0, 2, 5, 10, 2, 2, 2, 10, 10, 10, 10, 10, 10,
    ])
    const grid = deriveWater(5, 500, heights, 100_000, 50)
    expect(waterViolations(grid)).toEqual([])
    expect(grid.bodies).toHaveLength(1)
    expect(grid.bodies[0]).toMatchObject({ id: 6, kind: 'lake', areaM2: 225, maxDepthCm: 5 })
    expect(grid.level[12]).toBe(5)
    expect(deriveWater(5, 500, heights, 100_000, 50)).toEqual(grid)
    const corrupt = { ...grid, parent: grid.parent.slice() }
    corrupt.parent[12] = 12
    expect(waterViolations(corrupt)).toContain('Invalid downstream edge 12')
  })

  it('keeps slopes and flats dry below the threshold and partitions a confluence without overlap', () => {
    const flat = new Int32Array(25)
    expect(deriveWater(5, 500, flat, 100_000, 50).bodies).toEqual([])
    const slope = Int32Array.from({ length: 25 }, (_, id) => Math.floor(id / 5) * 100)
    const grid = deriveWater(5, 500, slope, 50, 50)
    expect(waterViolations(grid)).toEqual([])
    expect(grid.bodies.length).toBeGreaterThan(0)
    expect(grid.bodies.every((body) => body.kind === 'river')).toBe(true)
    expect(grid.bodies.reduce((area, body) => area + body.areaM2, 0)).toBe(
      grid.body.filter((id) => id >= 0).length * 25,
    )
  })

  it('uses exact fish growth even when the multiplication exceeds safe number arithmetic', () => {
    const capacity = fishCapacity(1_000_000, 1_000, 100, 600)
    const half = capacity / 2
    const result = fishGrowth(capacity, half, 0, 40)
    const unit = BigInt(capacity) * 876_000n
    const owed = 40n * BigInt(half) ** 2n
    expect(result).toEqual({ grown: Number(owed / unit), remainder: Number(owed % unit) })
    expect(fishGrowth(0, 0, 0, 40)).toEqual({ grown: 0, remainder: 0 })
    expect(fishGrowth(capacity, 0, 0, 40)).toEqual({ grown: 0, remainder: 0 })
    expect(fishCapacity(975, 1_000, 100, 600)).toBe(0)
  })

  const config: HydrationConfig = {
    waterBaseMlPerDay: 2_000,
    waterExtraMlPerKcal: 1,
    thirstBodyPerMille: 10,
    urgentThirstBodyPerMille: 30,
    fatalWaterLossBodyPerMille: 100,
    initialWaterDeficitMl: 0,
    drinkStopMl: 100,
    drinkMlPerSecond: 10,
    bodyKg: 60,
    restKcalPerHour: 90,
  }

  it('loses exactly 2 L per resting day and adds 440 ml for four hours picking', () => {
    const rest = newHydration(config)
    const picking = newHydration(config)
    for (let second = 0; second < 86_400; second += 1) {
      waterSecond(config, rest, 90, false)
      waterSecond(config, picking, second < 14_400 ? 200 : 90, false)
    }
    expect(rest.waterDeficitMl).toBe(2_000)
    expect(picking.waterDeficitMl).toBe(2_440)
  })

  it('drinks before loss, never overfills and reports the exact fatal second', () => {
    const body = newHydration(config)
    body.waterDeficitMl = 6
    expect(waterSecond(config, body, 90, true).drink).toBe(6)
    expect(body.waterDeficitMl).toBe(0)
    body.waterDeficitMl = 5_999
    body.waterBaseRemainder = 84_400
    expect(waterSecond(config, body, 90, false).fatal).toBe(true)
    expect(body.waterDeficitMl).toBe(6_000)
    body.waterDeficitMl = 600
    waterSecond(config, body, 90, false)
    expect(body.thirsty).toBe(true)
    body.waterDeficitMl = 105
    waterSecond(config, body, 90, true)
    expect(body.thirsty).toBe(false)
  })

  it('routes around known water and refuses hidden routes and diagonal corner crossings', () => {
    const grid: GroundKnowledge = {
      cells: 5,
      cellCm: 500,
      observed: new Uint8Array(25).fill(1),
      heights: new Int32Array(25),
      revision: 0,
    }
    for (const id of [7, 12, 17]) grid.observed[id] = 2
    const start = { x: 250, y: 1_250 }
    const end = { x: 2_250, y: 1_250 }
    const route = knownRoute(grid, start, end)!
    expect(route.length).toBeGreaterThan(1)
    const cellsOf = (points: readonly { x: number; y: number }[]) =>
      points
        .map((point) => Math.floor(point.y / 500) * 5 + Math.floor(point.x / 500))
        .filter((cell, index, cells) => index === 0 || cell !== cells[index - 1])
    expect(cellsOf(route)).toEqual(cellsOf(knownRoute(grid, end, start, start)!).reverse())
    let from = start
    for (const to of route) {
      expect(knownDrySegment(grid, from, to)).toBe(true)
      from = to
    }
    grid.observed[2] = 0
    grid.observed[22] = 0
    grid.revision += 1
    expect(knownRoute(grid, start, end)).toBeNull()
    expect(knownDrySegment(grid, { x: 750, y: 750 }, { x: 1_250, y: 250 })).toBe(false)
  })

  it('finds the same route with a warm search after observing a shorter passage', () => {
    const grid: GroundKnowledge = {
      cells: 7,
      cellCm: 500,
      observed: new Uint8Array(49).fill(1),
      heights: new Int32Array(49),
      revision: 0,
    }
    for (const cell of [10, 17, 24, 31, 38]) grid.observed[cell] = 0
    const start = { x: 750, y: 1750 }
    const end = { x: 2750, y: 1750 }
    knownRoute(grid, start, end, end)
    const earlier = cloneGroundKnowledge(grid)
    grid.observed[17] = 1
    grid.revision += 1
    observeRouteCells(grid, [17])
    const warm = knownRoute(grid, start, end, end)
    expect(warm).toEqual(knownRoute({ ...grid, observed: grid.observed.slice() }, start, end, end))
    const otherEnd = { x: 2750, y: 2250 }
    expect(knownRoute(earlier, start, otherEnd, end)).toEqual(
      knownRoute({ ...earlier, observed: earlier.observed.slice() }, start, otherEnd, end),
    )
    grid.observed[24] = 1
    grid.revision += 1
    observeRouteCells(grid, [24])
    expect(knownRoute(grid, start, end, end)).toEqual(
      knownRoute({ ...grid, observed: grid.observed.slice() }, start, end, end),
    )
  })

  it('uses the same shortest path and ties for distant forward and home searches', () => {
    const grid: GroundKnowledge = {
      cells: 41,
      cellCm: 500,
      observed: new Uint8Array(41 ** 2).fill(1),
      heights: new Int32Array(41 ** 2),
      revision: 0,
    }
    for (let y = 1; y < 40; y += 1) grid.observed[y * 41 + 20] = 2
    const start = { x: 750, y: 10250 },
      end = { x: 19750, y: 10250 }
    const forward = knownRoute(grid, start, end)!
    for (let row = 2; row < 39; row += 3) knownRoute(grid, start, { x: 19750, y: row * 500 + 250 })
    const fresh = { ...grid, observed: grid.observed.slice() }
    const nextGoal = { x: 19250, y: 18750 }
    expect(knownRoute(grid, start, nextGoal)).toEqual(knownRoute(fresh, start, nextGoal))
    const backward = knownRoute(grid, end, start, start)!
    const cellsOf = (points: readonly { x: number; y: number }[]) =>
      points
        .map((p) => Math.floor(p.y / 500) * 41 + Math.floor(p.x / 500))
        .filter((cell, index, cells) => index === 0 || cell !== cells[index - 1])
    expect(cellsOf(forward)).toEqual(cellsOf(backward).reverse())
  })

  it('shares travel estimates without changing per-segment rounding, ascent or return direction', () => {
    const grid: GroundKnowledge = {
      cells: 5,
      cellCm: 500,
      observed: new Uint8Array(25).fill(1),
      heights: new Int32Array(25),
      revision: 0,
    }
    const height = (point: { x: number; y: number }) => Math.floor(point.x / 500) * 17 - Math.floor(point.y / 500) * 11
    for (let cell = 0; cell < 25; cell += 1)
      grid.heights[cell] = height({ x: (cell % 5) * 500 + 250, y: Math.floor(cell / 5) * 500 + 250 })
    for (const cell of [7, 12, 17]) grid.observed[cell] = 2
    const home = { x: 251, y: 1251 }
    for (const speed of [7, 125, 7])
      for (const reverse of [false, true]) {
        const away = { x: 2249, y: 1251 }
        const from = reverse ? away : home,
          to = reverse ? home : away
        let previous = from,
          expected = 0
        for (const point of knownRoute(grid, from, to, home)!) {
          expected +=
            Math.ceil(distance(previous.x, previous.y, point.x, point.y) / speed) +
            Math.ceil((6 * Math.max(0, height(point) - height(previous))) / 100)
          previous = point
        }
        expect(knownWalkSeconds(grid, from, to, speed, 6, height, home)).toBe(expected)
      }
  })

  it('finds the same drinking bank locally as an exhaustive search around an obstructing lake', () => {
    const grid: GroundKnowledge = {
      cells: 5,
      cellCm: 500,
      observed: new Uint8Array(25).fill(1),
      heights: new Int32Array(25),
      revision: 0,
    }
    for (const cell of [7, 12, 17]) grid.observed[cell] = 2
    const banks: BankMemory[] = [
      { id: 49, bodyId: 7, dryCell: 11, wetCell: 12, x: 950, y: 1250, minute: 0 },
      { id: 50, bodyId: 7, dryCell: 13, wetCell: 12, x: 1550, y: 1250, minute: 0 },
      { id: 28, bodyId: 7, dryCell: 2, wetCell: 7, x: 1250, y: 450, minute: 0 },
    ]
    for (const start of [
      { x: 750, y: 1250 },
      { x: 2250, y: 1250 },
      { x: 750, y: 250 },
    ]) {
      const person = { ...start, groundKnowledge: grid, knownBanks: new Map(banks.map((bank) => [bank.id, bank])) }
      const seconds = (bank: BankMemory) => knownWalkSeconds(grid, start, bank, 125, 0, () => 0)
      const expected = [...banks].sort((a, b) => seconds(a) - seconds(b) || a.id - b.id)[0]!
      let best = Infinity,
        selected = -1
      for (const bank of nearestKnownBanks(person, () => best * 125)) {
        const time = seconds(bank)
        if (time < best || (time === best && bank.id < selected)) {
          best = time
          selected = bank.id
        }
      }
      expect(selected).toBe(expected.id)
    }
  })
})
