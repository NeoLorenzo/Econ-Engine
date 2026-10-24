import { triangleHeight } from './banks'
import { describe, expect, it } from 'vitest'
import { FLAT_LAND, resolveValleyConfig } from './config'
import { BUSH_GROUNDS, HAZEL_GROUNDS, TREE_GROUNDS, generateLayout, onGround } from './layout'
import { landStats } from './theory'
import { DIRT, GRASS, STONE, cellOf, generateTerrain, heightAt, terrainOf } from './terrain'
import type { ValleyConfig } from './types'
// A small land for quick tests: 1.2 km square, fewer sites.
const SMALL: Partial<ValleyConfig> = {
  valleySizeCm: 120_000,
  thicketCount: 30,
  hazelThicketCount: 30,
  standCount: 12,
  outcropCount: 4,
  reliefWavelengthCm: 60_000,
  startAreaCm: 60_000,
  smallKettleCount: 6,
  largeKettleCount: 1,
  drumlinCount: 12,
  hummockCount: 30,
}

describe('the height field', () => {
  const config = resolveValleyConfig(SMALL)
  const terrain = terrainOf(config)

  it('is the same for the same seed and different for another', () => {
    expect(generateTerrain(config).height).toEqual(terrain.height)
    expect(generateTerrain({ ...config, seed: 1 }).height).not.toEqual(terrain.height)
  })

  it('draws recognisable landforms from independent streams', () => {
    expect(terrain.moraines).toHaveLength(config.moraineBeltCount)
    expect(terrain.drumlins).toHaveLength(config.drumlinCount)
    expect(terrain.kettles).toHaveLength(config.smallKettleCount + config.largeKettleCount)
    const fewerMoraines = generateTerrain({ ...config, moraineBeltCount: config.moraineBeltCount - 1 })
    expect(fewerMoraines.drumlins).toEqual(terrain.drumlins)
    expect(fewerMoraines.kettles).toEqual(terrain.kettles)
    for (const drumlin of terrain.drumlins)
      expect((drumlin.length * 1_000) / drumlin.width).toBeGreaterThanOrEqual(config.drumlinMinAspectPerMille)
  })

  it('retains signed relief and has no artificial north-shore ramp', () => {
    expect(Array.from(terrain.height.slice(0, terrain.cells + 1)).some((h) => h !== 0)).toBe(true)
    expect(Math.min(...terrain.height)).toBeLessThan(0)
    expect(Math.max(...terrain.height)).toBeLessThanOrEqual(
      config.reliefCm +
        config.moraineMaxHeightCm +
        config.drumlinMaxHeightCm +
        config.kameMaxHeightCm +
        config.hummockMaxHeightCm +
        config.microCoarseAmplitudeCm +
        config.microFineAmplitudeCm,
    )
  })

  it('digs each kettle deepest at its centre, an eighth of its radius deep', () => {
    for (const kettle of terrain.kettles) {
      expect(kettle.depth).toBe(
        Math.min(config.kettleMaxDepthCm, Math.floor((kettle.radius * config.kettleDepthPerMille) / 1_000)),
      )
      expect(kettle.depth).toBeLessThanOrEqual(config.kettleMaxDepthCm)
      expect(kettle.lobes.length).toBeGreaterThanOrEqual(2)
    }
    const flat = generateTerrain({
      ...config,
      reliefCm: 0,
      moraineBeltCount: 0,
      drumlinCount: 0,
      kameCount: 0,
      hummockCount: 0,
      tunnelValleyCount: 0,
      microCoarseAmplitudeCm: 0,
      microFineAmplitudeCm: 0,
    })
    const kettle = flat.kettles.find((k) => k.y > k.radius && k.x > k.radius)!
    const centre = heightAt(flat, kettle.x, kettle.y)
    expect(centre).toBeLessThan(0)
    expect(heightAt(flat, kettle.x + kettle.radius + 500, kettle.y)).toBe(0)
  })

  it('interpolates between lattice points within their heights', () => {
    const cell = terrain.cellCm
    const points = terrain.cells + 1
    for (const [i, j] of [
      [10, 20],
      [100, 150],
      [200, 30],
    ] as const) {
      const corners = [
        terrain.height[j * points + i]!,
        terrain.height[j * points + i + 1]!,
        terrain.height[(j + 1) * points + i]!,
        terrain.height[(j + 1) * points + i + 1]!,
      ]
      const h = heightAt(terrain, i * cell + 137, j * cell + 251)
      const patch = terrain.water.shore?.patches.get(j * terrain.cells + i)
      if (patch) {
        expect(h).toBe(Math.floor(triangleHeight(patch.ground, i * cell + 137, j * cell + 251)!))
        continue
      }
      if (terrain.water.body[j * terrain.cells + i]! >= 0) {
        expect(h).toBe(terrain.water.bed[j * terrain.cells + i])
        continue
      }
      expect(h).toBeGreaterThanOrEqual(Math.min(...corners))
      expect(h).toBeLessThanOrEqual(Math.max(...corners))
      expect(heightAt(terrain, i * cell, j * cell)).toBe(corners[0])
    }
  })

  it('is flat on a flat land', () => {
    const flat = terrainOf(resolveValleyConfig(FLAT_LAND))
    expect(Math.max(...flat.height)).toBe(0)
  })
})

describe('the ground', () => {
  const config = resolveValleyConfig(SMALL)
  const layout = generateLayout(config)
  const { terrain, ground } = layout

  it('is stone at outcrops, dirt on slopes and in patches, and grass elsewhere', () => {
    for (const outcrop of layout.outcrops) expect(ground[cellOf(terrain, outcrop.x, outcrop.y)]).toBe(STONE)
    const kinds = new Set(ground)
    expect(kinds).toEqual(new Set([GRASS, DIRT, STONE]))
  })

  it('carries every plant on ground its kind grows on', () => {
    for (const [plants, grounds] of [
      [layout.bushes, BUSH_GROUNDS],
      [layout.hazels, HAZEL_GROUNDS],
      [layout.trees, TREE_GROUNDS],
    ] as const)
      for (let id = 0; id < plants.count; id += 1)
        expect(onGround(terrain, layout.nav.mesh, ground, plants.x[id]!, plants.y[id]!, grounds)).toBe(true)
    for (const hearth of layout.hearths) expect(ground[cellOf(terrain, hearth.x, hearth.y)]).not.toBe(STONE)
  })

  it('is measured by the land statistics', () => {
    const stats = landStats(layout)
    const shares = Object.values(stats.groundShares).reduce((a, b) => a + b, 0)
    expect(shares).toBeCloseTo(1, 10)
    expect(stats.lowestCm).toBeLessThan(0)
    expect(stats.steeperThan5).toBeGreaterThanOrEqual(stats.steeperThan10)
  })
})
