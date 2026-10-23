import { describe, it, expect, vi } from 'vitest'
import * as banks from './banks'
import { nearestBanks, knownComponents } from './bankSearch'
import { createSurveyedValley, addTestLake } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { cloneValley } from './engine'
import { cachedHeight, estimateMinutes, nodePoint, knownRoute } from './routes'
function fixture() {
  const s = createSurveyedValley({ ...FLAT_LAND, bandSize: 1 })
  addTestLake(s)
  const p = s.foragers[0]!
  for (const b of s.layout.lattice.accessBanks) p.knownBanks.set(b.id, b)
  return { s, p }
}
describe('estimated bank candidates', () => {
  it('matches exhaustive estimate ordering around obstructing water', () => {
    const { s, p } = fixture(),
      l = s.layout.lattice,
      labels = knownComponents(l, p.knowledge)
    const expected = [...p.knownBanks.values()]
      .filter((b) => b.connectorNode !== undefined && labels[b.connectorNode]! >= 0)
      .map((bank) => ({
        bank,
        minutes: estimateMinutes(
          s.config,
          p,
          bank,
          7500,
          cachedHeight(s.layout.terrain, bank.x, bank.y) - cachedHeight(s.layout.terrain, p.x, p.y),
        ),
      }))
      .sort((a, b) => a.minutes - b.minutes || a.bank.id - b.bank.id)
      .slice(0, 3)
    expect(nearestBanks(l, s.layout.terrain, s.config, p, 7500, 3)).toEqual(expected)
  })
  it('updates after a clone learns a new bank and does not change the original memory', () => {
    const { s, p } = fixture(),
      all = [...p.knownBanks.values()]
    p.knownBanks.clear()
    p.knownBanks.set(all.at(-1)!.id, all.at(-1)!)
    const n = cloneValley(s),
      q = n.foragers[0]!
    q.knownBanks.set(all[0]!.id, all[0]!)
    expect(p.knownBanks.size).toBe(1)
    expect(q.knownBanks.size).toBe(2)
    const result = nearestBanks(n.layout.lattice, n.layout.terrain, n.config, q, 7500, 3)
    expect(result.length).toBe(2)
  })
  it('searches to a precomputed bank endpoint without shoreline geometry', () => {
    const { s, p } = fixture(),
      l = s.layout.lattice,
      b = l.accessBanks[0]!,
      origin = nodePoint(l, b.connectorNode!)
    const spy = vi.spyOn(banks, 'bankSegmentWet')
    try {
      expect(
        knownRoute(l, p.knowledge, s.layout.terrain, s.layout.ground, l.banks, s.config, 0, origin, b),
      ).not.toBeNull()
      expect(spy.mock.calls.length).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })
})
