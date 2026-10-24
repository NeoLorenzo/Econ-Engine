import { describe, it, expect, vi } from 'vitest'
import * as banks from './banks'
import { nearestBanks } from './bankSearch'
import { createSurveyedValley, addTestLake } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { cloneValley } from './engine'
import { learnBank } from './perception'
<<<<<<< Updated upstream
import { cachedHeight, estimateMinutes, nodePoint, knownRoute } from './routes'
=======
import { cachedHeight, estimateMinutes, knownComponents, knownRoute, routeTriangle } from './routes'
>>>>>>> Stashed changes
function fixture() {
  const s = createSurveyedValley({ ...FLAT_LAND, founders: 1 })
  addTestLake(s)
  const p = s.foragers[0]!
  for (const b of s.layout.nav.accessBanks) p.knownBanks.set(b.id, b)
  return { s, p }
}
describe('estimated bank candidates', () => {
  it('matches exhaustive estimate ordering around obstructing water', () => {
    const { s, p } = fixture(),
      nav = s.layout.nav,
      componentOf = knownComponents(nav, p.knowledge),
      home = componentOf(routeTriangle(nav, p.knowledge, p))
    const expected = [...p.knownBanks.values()]
      .filter((b) => componentOf(routeTriangle(nav, p.knowledge, b)) === home)
      .map((bank) => ({
        bank,
        minutes: estimateMinutes(
          s.config,
          p,
          bank,
          7500,
          cachedHeight(nav.mesh, bank.x, bank.y) - cachedHeight(nav.mesh, p.x, p.y),
        ),
      }))
      .sort((a, b) => a.minutes - b.minutes || a.bank.id - b.bank.id)
      .slice(0, 3)
    expect(expected.length).toBe(3)
    expect(nearestBanks(nav, s.config, p, 7500, 3)).toEqual(expected)
  })
  it('updates after a clone learns a new bank and does not change the original memory', () => {
    const { s, p } = fixture(),
      all = [...p.knownBanks.values()]
    p.knownBanks.clear()
    p.knownBanks.set(all.at(-1)!.id, all.at(-1)!)
    const n = cloneValley(s),
      q = n.foragers[0]!
    expect(q.knownBanks).toBe(p.knownBanks)
    learnBank(q, { ...all[0]!, minute: 0 })
    expect(q.knownBanks).not.toBe(p.knownBanks)
    expect(p.knownBanks.size).toBe(1)
    expect(q.knownBanks.size).toBe(2)
    const result = nearestBanks(n.layout.nav, n.config, q, 7500, 3)
    expect(result.length).toBe(2)
  })
  it('routes to a precomputed bank point without shoreline geometry', () => {
    const { s, p } = fixture(),
      b = s.layout.nav.accessBanks[0]!
    const spy = vi.spyOn(banks, 'bankSegmentWet')
    try {
      expect(knownRoute(s.layout.nav, p.knowledge, s.config, 0, p, b)).not.toBeNull()
      expect(spy.mock.calls.length).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })
})
