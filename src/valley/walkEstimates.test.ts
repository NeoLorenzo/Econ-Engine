import { describe, expect, it } from 'vitest'
import { FLAT_LAND, resolveValleyConfig } from './config'
import {
  cloneWalkEstimates,
  estimateKnownWalk,
  idleReason,
  reachableInTime,
  walkSpeed,
  daylightSecondsLeft,
} from './forager'
import { createValley } from './engine'
import { buildIndex, nearestPlant } from './layout'
import { cloneGroundKnowledge, knownWalkSeconds, observeRouteCells, routeCentre, type GroundKnowledge } from './routes'
import { heightAt, terrainOf } from './terrain'

describe('exact walk estimate cache', () => {
  it('reuses idle reachability proofs only while their position, knowledge and daylight budget agree', () => {
    const config = resolveValleyConfig({ ...FLAT_LAND, walkCmPerSecond: 10 })
    const initial = createValley(config).foragers[0]!
    const grid: GroundKnowledge = {
      cells: 7,
      cellCm: 500,
      observed: new Uint8Array(49).fill(1),
      heights: new Int32Array(49),
      revision: 0,
    }
    const person = { ...initial, x: 750, y: 1750, hearth: { x: 750, y: 1750 }, groundKnowledge: grid }
    const plants = { count: 2, x: Int32Array.of(2750, 2750), y: Int32Array.of(1750, 2250), site: Int32Array.of(0, 0) }
    const chunks = buildIndex(plants, 500, 3500)
    const verify = () => {
      for (const minute of [
        config.duskHour * 60 - 2,
        config.duskHour * 60 - 1,
        config.dawnHour * 60,
        config.duskHour * 60 - 1,
      ]) {
        const cold = {
          ...person,
          groundKnowledge: { ...person.groundKnowledge, observed: person.groundKnowledge.observed.slice() },
        }
        const left = daylightSecondsLeft(config, minute),
          speed = walkSpeed(config, cold)
        const found = nearestPlant(
          chunks,
          plants,
          cold.x,
          cold.y,
          (id) => reachableInTime(config, cold, plants.x[id]!, plants.y[id]!, left, speed),
          left * speed,
        )
        expect(idleReason(config, person, plants, chunks, minute)).toBe(
          found === null ? 'too late to set out' : 'waiting for regrowth',
        )
      }
    }
    verify()
    const earlier = cloneGroundKnowledge(grid)
    cloneWalkEstimates(grid, earlier)
    for (let row = 0; row < 7; row += 1) grid.observed[row * 7 + 3] = 2
    grid.revision += 1
    observeRouteCells(grid, [3, 10, 17, 24, 31, 38, 45])
    verify()
    person.groundKnowledge = earlier
    person.x = 1250
    person.hearth = { x: 1250, y: 1750 }
    verify()
  })

  it('keeps exact costs and rejection boundaries through load, hearth, terrain, knowledge and branch changes', () => {
    const config = resolveValleyConfig(FLAT_LAND)
    const grid: GroundKnowledge = {
      cells: 7,
      cellCm: 500,
      observed: new Uint8Array(49).fill(1),
      heights: new Int32Array(49),
      revision: 0,
    }
    for (const id of [10, 17, 24, 31, 38]) grid.observed[id] = 0
    const start = routeCentre(grid, 22)
    const end = routeCentre(grid, 26)
    const person = { groundKnowledge: grid, hearth: end }
    const verify = (subject: typeof person) => {
      for (const cfg of [config, { ...config, climbSecondsPerMetre: 10 }]) {
        const terrain = terrainOf(cfg)
        for (const speed of [125, 75, 125]) {
          const cold = { ...subject.groundKnowledge, observed: subject.groundKnowledge.observed.slice() }
          const expected = knownWalkSeconds(
            cold,
            start,
            end,
            speed,
            cfg.climbSecondsPerMetre,
            (p) => heightAt(terrain, p.x, p.y),
            subject.hearth,
          )
          for (const budget of [1, 3, expected - 1, expected, expected + 1, 0, Infinity]) {
            const actual = estimateKnownWalk(cfg, subject, start, end, speed, budget)
            expect(actual <= budget).toBe(expected <= budget)
            if (Number.isFinite(actual)) expect(actual).toBe(expected)
          }
        }
      }
    }
    verify(person)
    const earlier = { ...person, groundKnowledge: cloneGroundKnowledge(grid) }
    cloneWalkEstimates(grid, earlier.groundKnowledge)
    grid.observed[24] = 1
    grid.revision += 1
    observeRouteCells(grid, [24])
    verify(person)
    verify(earlier)
    verify({ ...person, hearth: start })
    verify(person)
  })
})
