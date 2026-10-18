import { describe, expect, it } from 'vitest'
import { resolveValleyConfig } from './config'
import { distance, distanceSq, distanceUp, stepTowards, walkSeconds } from './geometry'
import { drawStarts, forEachPlantWithin, generateLayout, nearestPlant } from './layout'
import { hourlyShare, minuteCost, workSeconds } from './work'

const config = resolveValleyConfig()
const layout = generateLayout(config)

describe('layout', () => {
  it('is the same for the same seed and differs for another', () => {
    const again = generateLayout(config)
    expect(Array.from(again.bushes.x)).toEqual(Array.from(layout.bushes.x))
    expect(Array.from(again.trees.y)).toEqual(Array.from(layout.trees.y))
    const other = generateLayout(resolveValleyConfig({ seed: 1 }))
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

  it('scatters each thicket’s bushes within its radius and apart, in thicket order', () => {
    const { bushes } = layout
    expect(bushes.count).toBe(config.thicketCount * config.bushesPerThicket)
    for (let id = 0; id < bushes.count; id += 1) {
      expect(bushes.site[id]).toBe(Math.floor(id / config.bushesPerThicket))
      const centre = layout.thickets[bushes.site[id]!]!
      expect(distanceSq(bushes.x[id]!, bushes.y[id]!, centre.x, centre.y)).toBeLessThanOrEqual(
        config.thicketRadiusCm ** 2,
      )
      for (let other = id + 1; other < bushes.count && bushes.site[other] === bushes.site[id]; other += 1)
        expect(distanceSq(bushes.x[id]!, bushes.y[id]!, bushes.x[other]!, bushes.y[other]!)).toBeGreaterThanOrEqual(
          config.bushSpacingCm ** 2,
        )
    }
    expect(layout.trees.count).toBe(config.standCount * config.treesPerStand)
  })

  it('puts the hearths on a ring round the camp in a band that starts as one group', () => {
    const camp = generateLayout(resolveValleyConfig({ scattered: false }))
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
    const camp = generateLayout(resolveValleyConfig({ scattered: false }))
    expect(Array.from(camp.bushes.x)).toEqual(Array.from(layout.bushes.x))
    expect(Array.from(camp.trees.y)).toEqual(Array.from(layout.trees.y))
    expect(drawStarts(resolveValleyConfig({ seed: 1 }))).not.toEqual(layout.hearths)
  })

  it('finds the plants within a radius, as a search of every plant would', () => {
    const { bushes } = layout
    const [x, y] = [bushes.x[100]! + 500, bushes.y[100]! - 700]
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
      [bushes.x[500]!, bushes.y[500]!],
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

describe('regrowth and remainders', () => {
  it('shares a day’s regrowth among its hours exactly', () => {
    for (const perDay of [0, 6, 20, 25, 1_200]) {
      const shares = Array.from({ length: 24 }, (_, hour) => hourlyShare(perDay, hour))
      expect(shares.reduce((a, b) => a + b, 0)).toBe(perDay)
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1)
    }
  })

  it('takes exactly an hour’s rate from an hour of work, minute by minute or in odd pieces', () => {
    for (const rate of [17, 24, 1_188, 1_200]) {
      let remainder = 0
      let units = 0
      for (let minute = 0; minute < 60; minute += 1) {
        const due = workSeconds(remainder, rate, 60)
        remainder = due.remainder
        units += due.units
      }
      expect(units).toBe(rate)
      expect(remainder).toBe(0)
      remainder = 0
      units = 0
      for (const seconds of [7, 53, 1_200, 2_340]) {
        const due = workSeconds(remainder, rate, seconds)
        remainder = due.remainder
        units += due.units
      }
      expect(units).toBe(rate)
    }
  })

  it('charges each second at its hourly cost', () => {
    expect(minuteCost(config, { walk: 60, work: 0, stand: 0, sleep: 0 }, null)).toBe(60 * 300)
    expect(minuteCost(config, { walk: 10, work: 20, stand: 30, sleep: 0 }, null)).toBe(10 * 300 + 20 * 300 + 30 * 90)
    expect(minuteCost(config, { walk: 0, work: 0, stand: 0, sleep: 60 }, 'cold')).toBe(60 * 150)
  })
})
