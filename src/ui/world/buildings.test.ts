import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../../sim/config'
import { createSimulation } from '../../sim/engine'
import { buildWorldEntities } from '../worldViewModel'
import {
  ARCHETYPES,
  BUILDING_FOOTPRINT,
  buildingArchetype,
  buildingRotation,
  buildingScale,
  createBuildingKit,
  HOUSE_FOOTPRINT,
  PLOT_INSET,
  setAccent,
} from './buildings'

const EPSILON = 1e-6

describe('buildingArchetype', () => {
  it('gives each household its tier of house, each firm its industry building and Government the civic hall', () => {
    const entities = buildWorldEntities(createSimulation({ seed: DEFAULT_SEED }))
    for (const entity of entities) {
      const archetype = buildingArchetype(entity)
      if (entity.kind === 'household') expect(archetype).toBe(`house-${entity.tier}`)
      else if (entity.kind === 'government') expect(archetype).toBe('government')
      else expect(archetype).toBe(entity.industryId)
    }
    expect(buildingArchetype({ id: 'firm-transport', kind: 'firm', industryId: 'transport' })).toBe('transport')
    for (const tier of [0, 1, 2, 3] as const)
      expect(buildingArchetype({ id: 'household-1', kind: 'household', tier })).toBe(`house-${tier}`)
    expect(new Set(entities.map(buildingArchetype).filter((id) => !id.startsWith('house-')))).toEqual(
      new Set(['food', 'utilities', 'healthcare', 'entertainment', 'transport', 'government']),
    )
  })

  it('refuses a firm with no industry', () => {
    expect(() => buildingArchetype({ id: 'firm-x', kind: 'firm' })).toThrow(/no industry/)
  })
})

describe('buildingRotation', () => {
  it('turns each building a stable quarter-turn, spread across all four directions', () => {
    const entities = buildWorldEntities(createSimulation({ seed: DEFAULT_SEED }))
    const turns = entities.map(({ id }) => buildingRotation(id) / (Math.PI / 2))
    expect(turns.every((turn) => Number.isInteger(turn) && turn >= 0 && turn < 4)).toBe(true)
    expect(entities.map(({ id }) => buildingRotation(id))).toEqual(entities.map(({ id }) => buildingRotation(id)))
    const counts = [0, 1, 2, 3].map((turn) => turns.filter((value) => value === turn).length)
    // 110 buildings: every direction is well used, none dominates.
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(15)
  })
})

describe('buildingScale', () => {
  const close = (actual: { x: number; y: number; z: number }, expected: { x: number; y: number; z: number }) => {
    for (const axis of ['x', 'y', 'z'] as const) expect(actual[axis]).toBeCloseTo(expected[axis], 9)
  }

  it('keeps a house its own size, growing it by the emphasis factor', () => {
    close(buildingScale('household', { width: 1, depth: 1 }, Math.PI / 2), { x: 1, y: 1, z: 1 })
    close(buildingScale('household', { width: 1, depth: 1 }, 0, 1.25), { x: 1.25, y: 1.25, z: 1.25 })
  })

  it('stretches a plot building to its plot, less the inset, and raises it with the square root of the area', () => {
    const across = (tiles: number) => (tiles - PLOT_INSET) / BUILDING_FOOTPRINT
    close(buildingScale('firm', { width: 3, depth: 3 }, 0), { x: across(3), y: 0.75 * 3, z: across(3) })
    close(buildingScale('government', { width: 5, depth: 5 }, Math.PI), { x: across(5), y: 0.75 * 5, z: across(5) })
    // Government's 5×5 hall is about 1.7 times as tall as a 3×3 market hall, and stays inside its plot.
    expect(
      buildingScale('government', { width: 5, depth: 5 }, 0).y / buildingScale('firm', { width: 3, depth: 3 }, 0).y,
    ).toBeCloseTo(5 / 3, 9)
    expect(across(5) * BUILDING_FOOTPRINT).toBeLessThan(5)
  })

  it('swaps the stretch for a quarter-turned model on a plot that is not square', () => {
    const across = (tiles: number) => (tiles - PLOT_INSET) / BUILDING_FOOTPRINT
    const footprint = { width: 3, depth: 2 }
    close(buildingScale('firm', footprint, 0), { x: across(3), y: 0.75 * Math.sqrt(6), z: across(2) })
    close(buildingScale('firm', footprint, Math.PI), { x: across(3), y: 0.75 * Math.sqrt(6), z: across(2) })
    close(buildingScale('firm', footprint, Math.PI / 2), { x: across(2), y: 0.75 * Math.sqrt(6), z: across(3) })
    close(buildingScale('firm', footprint, (3 * Math.PI) / 2), { x: across(2), y: 0.75 * Math.sqrt(6), z: across(3) })
  })

  it('grows a selected plot building by about a quarter of a tile, not a quarter of its size', () => {
    const plain = buildingScale('firm', { width: 4, depth: 4 }, 0)
    const selected = buildingScale('firm', { width: 4, depth: 4 }, 0, 1.25)
    expect((selected.x - plain.x) * BUILDING_FOOTPRINT).toBeCloseTo((0.25 * (4 - PLOT_INSET)) / 4, 9)
    expect(selected.x * BUILDING_FOOTPRINT).toBeLessThan(4 + 1)
  })
})

describe('createBuildingKit', () => {
  const kit = createBuildingKit(THREE, mergeGeometries)

  for (const id of ARCHETYPES) {
    it(`builds ${id} on the ground, inside its footprint, with colour and accent attributes`, () => {
      const geometry = kit.geometry(id)
      const box = geometry.boundingBox!
      const footprint = id.startsWith('house-') ? HOUSE_FOOTPRINT : BUILDING_FOOTPRINT
      expect(Math.abs(box.min.y)).toBeLessThan(EPSILON)
      expect(box.max.x - box.min.x).toBeLessThanOrEqual(footprint + EPSILON)
      expect(box.max.z - box.min.z).toBeLessThanOrEqual(footprint + EPSILON)
      expect(Math.max(Math.abs(box.min.x), box.max.x, Math.abs(box.min.z), box.max.z)).toBeLessThanOrEqual(
        footprint / 2 + EPSILON,
      )
      expect(box.max.y).toBeLessThanOrEqual(3.5)
      expect(geometry.userData.top).toBe(box.max.y)
      for (const name of ['position', 'normal', 'color', 'accent'])
        expect(geometry.getAttribute(name)?.count).toBe(geometry.getAttribute('position').count)
      const accent = Array.from(geometry.getAttribute('accent').array as Float32Array)
      expect(accent.every((value) => value === 0 || value === 1)).toBe(true)
      if (id.startsWith('house-')) expect(accent.some((value) => value === 1)).toBe(false)
      else expect(accent.some((value) => value === 1)).toBe(true)
    })
  }

  it('grows houses with their tier', () => {
    const tops = ([0, 1, 2, 3] as const).map((tier) => kit.geometry(`house-${tier}`).userData.top as number)
    expect([...tops].sort((a, b) => a - b)).toEqual(tops)
    expect(new Set(tops).size).toBe(4)
  })

  it('shares one cached geometry per building type until disposed', () => {
    const local = createBuildingKit(THREE, mergeGeometries)
    const first = local.geometry('food')
    expect(local.geometry('food')).toBe(first)
    local.dispose()
    expect(local.geometry('food')).not.toBe(first)
    local.dispose()
  })

  it('gives each building its own material and accent colour, sharing one shader program', () => {
    const a = kit.material()
    const b = kit.material()
    expect(a).not.toBe(b)
    setAccent(a, 0x5ec9d8)
    expect(a.userData.accent.getHex()).toBe(0x5ec9d8)
    expect(b.userData.accent.getHex()).toBe(0xffffff)
    expect(a.vertexColors).toBe(true)
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey())
    a.dispose()
    b.dispose()
  })
})
