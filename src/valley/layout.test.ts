import { FLAT_LAND } from './config'
import { describe, expect, it } from 'vitest'
import { resolveValleyConfig } from './config'
import { distance, distanceSq, distanceUp, stepTowards, walkSeconds } from './geometry'
import { drawStarts, forEachPlantWithin, generateLayout, nearestPlant } from './layout'

const config = resolveValleyConfig(FLAT_LAND)
const layout = generateLayout(config)

describe('layout', () => {
  it('is the same for the same seed and differs for another', () => {
    const again = generateLayout(config)
    expect(Array.from(again.bushes.x)).toEqual(Array.from(layout.bushes.x))
    expect(Array.from(again.trees.y)).toEqual(Array.from(layout.trees.y))
    const other = generateLayout(resolveValleyConfig({ ...FLAT_LAND, seed: 1 }))
    expect(Array.from(other.bushes.x)).not.toEqual(Array.from(layout.bushes.x))
  })

  it('places sites apart, inside the margins and clear of the camp', () => {
    const centres = [...layout.thickets, ...layout.stands]
    expect(centres).toHaveLength(config.thicketCount + config.standCount)
    for (const [index, centre] of centres.entries()) {
      expect(distanceSq(centre.x, centre.y, layout.camp.x, layout.camp.y)).toBeGreaterThanOrEqual(
        config.campClearingCm ** 2,
      )
      for (const coordinate of [centre.x, centre.y]) {
        expect(coordinate).toBeGreaterThanOrEqual(config.siteMarginCm)
        expect(coordinate).toBeLessThanOrEqual(config.valleySizeCm - config.siteMarginCm)
      }
      for (const other of centres.slice(index + 1))
        expect(distanceSq(centre.x, centre.y, other.x, other.y)).toBeGreaterThanOrEqual(config.siteSpacingCm ** 2)
    }
  })

  it('places one resource record at each site centre', () => {
    expect(layout.places.count).toBe(
      config.thicketCount + config.hazelThicketCount + config.standCount + config.outcropCount,
    )
    const centres = [...layout.thickets, ...layout.hazelThickets, ...layout.stands, ...layout.outcrops]
    for (const [id, centre] of centres.entries()) {
      expect(layout.places.x[id]).toBe(centre.x)
      expect(layout.places.y[id]).toBe(centre.y)
    }
  })

  it('puts the hearths on a ring round the camp in a band that starts as one group', () => {
    const camp = generateLayout(resolveValleyConfig({ ...FLAT_LAND, scattered: false }))
    // The first ring holds eight huts 7 m from the fire, evenly round it.
    expect(camp.hearths[0]).toEqual({ x: camp.camp.x - 494, y: camp.camp.y - 494 })
    expect(camp.hearths[3]).toEqual({ x: camp.camp.x + 700, y: camp.camp.y })
    for (const hearth of camp.hearths)
      expect(Math.abs(Math.hypot(hearth.x - camp.camp.x, hearth.y - camp.camp.y) - 700)).toBeLessThan(2)
  })

  it('lists every tree, then every bush, as wood plants', () => {
    expect(layout.woodPlants.count).toBe(layout.trees.count + layout.bushes.count)
    expect(layout.woodPlants.x[3]).toBe(layout.trees.x[3])
    expect(layout.woodPlants.y[layout.trees.count + 5]).toBe(layout.bushes.y[5])
    expect(layout.woodPlants.site[layout.trees.count + 5]).toBe(layout.bushes.site[5])
  })

  it('scatters the starts apart, from a stream of their own, leaving the plants where a band around the camp has them', () => {
    expect(layout.hearths).toEqual(drawStarts(config))
    for (const [index, start] of layout.hearths.entries()) {
      expect(start.x).toBeGreaterThanOrEqual(0)
      expect(start.y).toBeLessThanOrEqual(config.valleySizeCm)
      for (const other of layout.hearths.slice(0, index))
        expect(distanceSq(start.x, start.y, other.x, other.y)).toBeGreaterThanOrEqual(config.startSpacingCm ** 2)
    }
    const camp = generateLayout(resolveValleyConfig({ ...FLAT_LAND, scattered: false }))
    expect(Array.from(camp.bushes.x)).toEqual(Array.from(layout.bushes.x))
    expect(Array.from(camp.trees.y)).toEqual(Array.from(layout.trees.y))
    expect(drawStarts(resolveValleyConfig({ ...FLAT_LAND, seed: 1 }))).not.toEqual(layout.hearths)
  })

  it('finds the plants within a radius, as a search of every plant would', () => {
    const { bushes } = layout
    const [x, y] = [bushes.x[10]! + 500, bushes.y[10]! - 700]
    const found: number[] = []
    forEachPlantWithin(layout.bushIndex, bushes, x, y, config.perceptionRadiusCm, (id) => found.push(id))
    const all = Array.from({ length: bushes.count }, (_, id) => id).filter(
      (id) => distanceSq(bushes.x[id]!, bushes.y[id]!, x, y) <= config.perceptionRadiusCm ** 2,
    )
    expect(found.sort((a, b) => a - b)).toEqual(all)
  })

  it('finds the nearest accepted plant, ties to the lowest ID, as a search of every plant would', () => {
    const { bushes } = layout
    for (const [x, y] of [
      [0, 0],
      [30_000, 30_000],
      [bushes.x[5]!, bushes.y[5]!],
      [59_000, 12_345],
    ] as const) {
      const accept = (id: number) => id % 7 !== 0
      let best = -1
      let bestSq = Infinity
      for (let id = 0; id < bushes.count; id += 1) {
        const sq = distanceSq(bushes.x[id]!, bushes.y[id]!, x, y)
        if (accept(id) && sq < bestSq) [best, bestSq] = [id, sq]
      }
      expect(nearestPlant(layout.bushIndex, bushes, x, y, accept)).toBe(best)
    }
    expect(nearestPlant(layout.bushIndex, bushes, 0, 0, () => false)).toBeNull()
  })
})

describe('geometry', () => {
  it('rounds distances down and up to whole centimetres', () => {
    expect(distance(0, 0, 3, 4)).toBe(5)
    expect(distanceUp(0, 0, 3, 4)).toBe(5)
    expect(distance(0, 0, 1, 1)).toBe(1)
    expect(distanceUp(0, 0, 1, 1)).toBe(2)
  })

  it('walks in whole seconds', () => {
    expect(walkSeconds(0, 125)).toBe(0)
    expect(walkSeconds(125, 125)).toBe(1)
    expect(walkSeconds(126, 125)).toBe(2)
  })

  it('steps towards a point without overshooting it', () => {
    expect(stepTowards({ x: 0, y: 0 }, { x: 100, y: 0 }, 7_500)).toEqual({ x: 100, y: 0 })
    const step = stepTowards({ x: 0, y: 0 }, { x: 30_000, y: 40_000 }, 7_500)
    expect(step).toEqual({ x: 4_500, y: 6_000 })
    for (const [x, y] of [
      [12_345, -6_789],
      [-1, 99_999],
      [7_501, 1],
    ] as const) {
      const next = stepTowards({ x: 0, y: 0 }, { x, y }, 7_500)
      expect(distance(0, 0, next.x, next.y)).toBeLessThanOrEqual(7_500)
      expect(distanceSq(next.x, next.y, x, y)).toBeLessThan(distanceSq(0, 0, x, y))
    }
  })
})
