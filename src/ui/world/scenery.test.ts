import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../../sim/config'
import { createSimulation } from '../../sim/engine'
import { buildWorldEntities } from '../worldViewModel'
import { createScenery, SCENERY_JITTER, SCENERY_MARGIN, sceneryGeometry, sceneryLayout } from './scenery'

const EPSILON = 1e-6

function canonicalLayout(seed = DEFAULT_SEED) {
  const state = createSimulation({ seed })
  const entities = buildWorldEntities(state)
  return { entities, layout: sceneryLayout({ width: 20, height: 20, seed, entities }) }
}

describe('sceneryLayout', () => {
  it('is the same every time for the same seed and map', () => {
    expect(canonicalLayout().layout).toEqual(canonicalLayout().layout)
  })

  it('covers the grid and its margin with exactly one grass tile each', () => {
    const { layout } = canonicalLayout()
    const side = 20 + 2 * SCENERY_MARGIN
    expect(layout.tiles).toHaveLength(side * side)
    expect(layout.tiles.filter(({ inside }) => inside)).toHaveLength(400)
    expect(layout.bounds).toEqual({
      minX: -10 - SCENERY_MARGIN,
      maxX: 10 + SCENERY_MARGIN,
      minZ: -10 - SCENERY_MARGIN,
      maxZ: 10 + SCENERY_MARGIN,
    })
    expect(layout.tiles.every(({ shade }) => shade >= 0 && shade < 1)).toBe(true)
  })

  it('never grows anything on a tile a household, firm or institution stands on, or near enough to touch it', () => {
    const { entities, layout } = canonicalLayout()
    for (const item of layout.items)
      for (const entity of entities)
        expect(Math.max(Math.abs(item.x - entity.x), Math.abs(item.z - entity.z))).toBeGreaterThan(0.5)
  })

  it('keeps each item within its tile and inside the island', () => {
    const { layout } = canonicalLayout()
    const { minX, maxX, minZ, maxZ } = layout.bounds
    for (const item of layout.items) {
      const tileX = Math.round(item.x - 0.5) + 0.5
      const tileZ = Math.round(item.z - 0.5) + 0.5
      expect(Math.abs(item.x - tileX)).toBeLessThanOrEqual(SCENERY_JITTER + EPSILON)
      expect(Math.abs(item.z - tileZ)).toBeLessThanOrEqual(SCENERY_JITTER + EPSILON)
      expect(item.x).toBeGreaterThan(minX)
      expect(item.x).toBeLessThan(maxX)
      expect(item.z).toBeGreaterThan(minZ)
      expect(item.z).toBeLessThan(maxZ)
      expect(item.scale).toBeGreaterThan(0.75)
      expect(item.scale).toBeLessThan(1.45)
    }
  })

  it('scatters trees among the houses and grows a denser forest around the town', () => {
    const { layout } = canonicalLayout()
    const inside = layout.items.filter(({ x, z }) => Math.abs(x) < 10 && Math.abs(z) < 10)
    const outside = layout.items.filter(({ x, z }) => Math.abs(x) > 10 || Math.abs(z) > 10)
    const insideTrees = inside.filter(({ kind }) => kind !== 'bush')
    const outsideTrees = outside.filter(({ kind }) => kind !== 'bush')
    expect(insideTrees.length).toBeGreaterThan(20)
    expect(insideTrees.length / (400 - 110)).toBeLessThan(0.3)
    expect(outsideTrees.length / (30 * 30 - 400)).toBeGreaterThan(insideTrees.length / (400 - 110))
    expect(new Set(layout.items.map(({ kind }) => kind))).toEqual(new Set(['pine', 'oak', 'bush']))
  })

  it('differs between seeds', () => {
    expect(canonicalLayout(1).layout.items).not.toEqual(canonicalLayout(2).layout.items)
  })
})

describe('scenery geometry', () => {
  for (const kind of ['pine', 'oak', 'bush'] as const) {
    it(`builds a ${kind} standing on the ground, small enough for its tile`, () => {
      const geometry = sceneryGeometry(THREE, mergeGeometries, kind)
      const box = geometry.boundingBox!
      expect(Math.abs(box.min.y)).toBeLessThan(EPSILON)
      // At the largest scale (1.4) and the full jitter, it still stays clear of a building on the next tile.
      const reach = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) * 1.4 + SCENERY_JITTER
      expect(reach).toBeLessThan(0.6)
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count)
      geometry.dispose()
    })
  }

  it('builds the island and one instanced mesh per kind, with an instance for every item', () => {
    const { layout } = canonicalLayout()
    const scenery = createScenery(THREE, mergeGeometries, layout)
    const [island, ...instanced] = scenery.group.children as [THREE.Mesh, ...THREE.InstancedMesh[]]
    expect(island.receiveShadow).toBe(true)
    expect(instanced.map((mesh) => mesh.count).reduce((sum, count) => sum + count, 0)).toBe(layout.items.length)
    expect(instanced.every((mesh) => mesh.isInstancedMesh && mesh.castShadow)).toBe(true)
    scenery.dispose()
  })
})
