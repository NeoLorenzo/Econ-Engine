import { describe, expect, it } from 'vitest'
import { FLAT_LAND, resolveValleyConfig } from './config'
import { cloneValley, createValley, lastEventOf, runValley, stepValley } from './engine'
import { estimateWalk } from './forager'
import { ValleyChecker } from './invariants'
import { BUSH_GROUNDS, HAZEL_GROUNDS, TREE_GROUNDS, generateLayout, onGround } from './layout'
import { lineClear, placeOf, viewFrom } from './sight'
import { landStats, valleyTheory } from './theory'
import {
  DIRT,
  GRASS,
  STONE,
  TOBLER_PER_MILLE,
  cellOf,
  generateTerrain,
  gradeOf,
  heightAt,
  speedOnGrade,
  terrainOf,
  toblerPerMille,
  walkCost,
} from './terrain'
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
        expect(onGround(terrain, ground, plants.x[id]!, plants.y[id]!, grounds)).toBe(true)
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

describe('walking on slopes', () => {
  const config = resolveValleyConfig()

  it('follows Tobler’s curve to the thousandth, fastest at −5%', () => {
    expect(TOBLER_PER_MILLE).toHaveLength(121)
    for (let grade = -60; grade <= 60; grade += 1)
      expect(toblerPerMille(grade)).toBe(Math.round(1_000 * Math.exp(-3.5 * Math.abs(grade / 100 + 0.05) + 0.175)))
    expect(Math.max(...TOBLER_PER_MILLE)).toBe(toblerPerMille(-5))
    expect(toblerPerMille(0)).toBe(1_000)
  })

  it('takes grades in whole percent towards zero, held within ±60', () => {
    expect(gradeOf(1_000, 10_000)).toBe(10)
    expect(gradeOf(-999, 10_000)).toBe(-9)
    expect(gradeOf(100_000, 10_000)).toBe(60)
    expect(gradeOf(5, 0)).toBe(0)
    expect(speedOnGrade(125, 10)).toBe(88)
    expect(speedOnGrade(125, -5)).toBe(148)
  })

  it('costs what the Pandolf equation with Santee’s correction gives', () => {
    const theory = valleyTheory(config)
    expect(theory.walkOnGrade(0, 0)).toEqual({ speed: 125, kcalPerHour: 222 })
    expect(theory.walkOnGrade(0, 10)).toEqual({ speed: 88, kcalPerHour: 340 })
    expect(theory.walkOnGrade(0, -10)).toEqual({ speed: 125, kcalPerHour: 165 })
    expect(theory.walkOnGrade(0, -20).kcalPerHour).toBeGreaterThan(theory.walkOnGrade(0, -10).kcalPerHour)
    expect(theory.walkOnGrade(35, 0)).toEqual({ speed: 119, kcalPerHour: 341 })
    // Each ground's terrain factor.
    expect(walkCost(config, 0, 125, 0, 100)).toBe(198)
    expect(walkCost(config, 0, 125, 0, 150)).toBe(258)
    // Never less than standing.
    expect(walkCost(config, 0, 1, -60, 100)).toBeGreaterThanOrEqual(config.restKcalPerHour)
  })

  it('judges a walk by its distance and its climb, as Naismith’s rule does', () => {
    const flat = resolveValleyConfig(FLAT_LAND)
    expect(estimateWalk(flat, 0, 0, 12_500, 0, 125)).toBe(100)
    const theory = valleyTheory(config)
    expect(theory.estimateSeconds(10_000, 1_000)).toBe(80 + 60)
  })

  it('records grade, speed, ground and climb, which the checker replays', () => {
    const state = cloneValley(createValley(SMALL))
    const checker = new ValleyChecker(state)
    let climbed = 0
    let sloped = 0
    runValley(state, 1_440, {
      onMinute: (s) => {
        checker.assert(s)
        for (const event of s.lastEvents) {
          climbed += event.climbCm
          if (event.walkSeconds && event.gradePercent !== 0) sloped += 1
        }
      },
    })
    expect(climbed).toBeGreaterThan(0)
    expect(sloped).toBeGreaterThan(0)
  })

  it('catches a walk at a grade the land does not give', () => {
    const start = createValley(SMALL)
    const checker = new ValleyChecker(start)
    let state = runValley(start, 400, { onMinute: (s) => checker.assert(s) })
    while (!state.lastEvents.some((event) => event.walkSeconds > 0)) {
      state = stepValley(state)
      checker.assert(state)
    }
    const next = stepValley(state)
    const walker = next.lastEvents.find((event) => event.walkSeconds > 0)
    if (!walker) return
    walker.gradePercent += 7
    expect(checker.check(next).some((message) => message.includes('grade or speed'))).toBe(true)
  })
})

describe('sight over the land', () => {
  const config = resolveValleyConfig({ ...FLAT_LAND })
  const layout = generateLayout(config)

  it('sees across flat ground, and every place sees itself', () => {
    const view = viewFrom(config, layout, placeOf(config, 40_000, 40_000))
    expect(view.whole.length).toBeGreaterThan(0)
    expect([...view.visible]).toContain(placeOf(config, 40_000, 40_000))
    expect(lineClear(config, layout.terrain, { x: 5_000, y: 5_000 }, { x: 75_000, y: 75_000 })).toBe(true)
  })

  it('is blocked by a hill between two points', () => {
    const hilly = resolveValleyConfig(SMALL)
    const terrain = terrainOf(hilly)
    // Raise a ridge across the middle of a copy of the land.
    const ridge = { ...terrain, height: terrain.height.slice() }
    const points = terrain.cells + 1
    for (let j = 0; j < points; j += 1) for (let i = 116; i <= 124; i += 1) ridge.height[j * points + i] = 100_000
    expect(lineClear(hilly, ridge, { x: 50_000, y: 60_000 }, { x: 70_000, y: 60_000 })).toBe(false)
    expect(lineClear(hilly, ridge, { x: 50_000, y: 60_000 }, { x: 55_000, y: 60_000 })).toBe(true)
  })

  it('does not spot a site hidden behind a hill', () => {
    const hilly = resolveValleyConfig(SMALL)
    const land = generateLayout(hilly)
    // From somewhere, some site within long sight is hidden.
    let hidden = false
    for (let place = 0; place < 1_600 && !hidden; place += 37) {
      const view = viewFrom(hilly, land, place)
      const centreX = (place % 40) * hilly.placeCm + hilly.placeCm / 2
      const centreY = Math.floor(place / 40) * hilly.placeCm + hilly.placeCm / 2
      for (let site = 0; site < land.sitePoints.count; site += 1) {
        const dx = land.sitePoints.x[site]! - centreX
        const dy = land.sitePoints.y[site]! - centreY
        if (dx * dx + dy * dy < hilly.sightRadiusCm ** 2 && !view.sites.includes(site)) hidden = true
      }
    }
    expect(hidden).toBe(true)
  })
})

describe('chunks', () => {
  it('give the same run whatever their size', () => {
    const a = runValley(createValley({ ...SMALL, chunkCm: 20_000 }), 1_440, { recordEvents: false })
    const b = runValley(createValley({ ...SMALL, chunkCm: 7_000 }), 1_440, { recordEvents: false })
    expect(b.days).toEqual(a.days)
    expect(b.totals).toEqual(a.totals)
    expect(lastEventOf(b, 0)).toEqual(lastEventOf(a, 0))
  })
})
