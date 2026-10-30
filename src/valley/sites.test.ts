import { bandAt, giveHut, testAxe } from './ruleTestFixtures'
import { reindexPeople } from './perception'
import { nearestFrontier } from './routes'
import { describe, expect, it } from 'vitest'
import { createValley } from './engine'
import { FLAT_LAND } from './config'
import { observeAt } from './perception'
import { chooseTask } from './forager'
import { findWalk, rememberWalk } from './ways'

describe('place knowledge and rechecking', () => {
  it('keeps unknown stock optimistic, learning stock only at the place', () => {
    const state = createValley({ ...FLAT_LAND, founders: 1 }),
      person = state.foragers[0]!
    observeAt(state, person, 600)
    expect([...person.knownPlaces].some((m) => m === 600)).toBe(true)
    expect([...person.placeStock].filter((stock) => stock >= 0).length).toBeLessThanOrEqual(1)
  })
})

/** An idle person at home with nothing left to explore, holding ways to two places, the first used longest ago. */
function idleAtHome() {
  const s = bandAt(),
    p = s.foragers[0]!,
    places = s.layout.places
  giveHut(s, p)
  p.axe = testAxe()
  p.x = p.hearth.x
  p.y = p.hearth.y
  p.knowledge.triangles.fill(255)
  p.knowledge.revision++
  p.knownPlaces.fill(600)
  p.placeStock.fill(0)
  p.placeCheckedMinute.fill(600)
  const far = [0, 40].map((id) => ({ x: places.x[id]!, y: places.y[id]! }))
  far.forEach((point, i) => rememberWalk(s, p, findWalk(s, p, point, true, 0)!, 500 + i))
  return { s, p, far }
}

describe('ported place and exploration rules', () => {
  it('numbers thickets then hazels then stands then outcrops', () => {
    const s = bandAt()
    expect([...s.layout.places.kind]).toEqual([
      ...Array(32).fill(0),
      ...Array(32).fill(1),
      ...Array(12).fill(2),
      ...Array(4).fill(3),
    ])
  })
  it('checks stock only inside the place footprint', () => {
    const s = bandAt(),
      p = s.foragers[0]!,
      places = s.layout.places
    p.x = places.x[0]! + places.radiusCm[0]! + 1
    p.y = places.y[0]!
    observeAt(s, p, 600)
    expect(p.placeCheckedMinute[0]).toBe(-1)
    p.x = places.x[0]!
    observeAt(s, p, 601)
    expect(p.placeCheckedMinute[0]).toBe(601)
    expect(p.placeStock[0]).toBe(s.foodStock[0])
  })
  it('records latest place sightings separately from stock checks', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    observeAt(s, p, 600)
    const id = p.knownPlaces.findIndex((m) => m === 600)
    // A sighting is taken again at the next survey.
    p.survey = null
    observeAt(s, p, 601)
    expect(p.knownPlaces[id]).toBe(601)
    expect(p.placeCheckedMinute[id]).toBe(-1)
  })
  it('walks towards a person seen three hundred metres away', () => {
    const s = bandAt(600, { scattered: true }),
      p = s.foragers[0]!,
      other = s.foragers[1]!
    p.x = 20000
    p.y = 20000
    other.x = 50000
    other.y = 20000
    reindexPeople(s, 600)
    observeAt(s, p, 600)
    expect(chooseTask(s, p, 600)).toMatchObject({
      kind: 'walk',
      reason: 'seeking company',
      target: { x: 50000, y: 20000 },
    })
  })
  it('takes a walk once a week along the way from home used longest ago, then goes home to rest', () => {
    const { s, p, far } = idleAtHome()
    expect(chooseTask(s, p, 600)).toMatchObject({ kind: 'walk', reason: 'out for a walk', target: far[0] })
    p.leisureMinute = 600
    expect(chooseTask(s, p, 700).kind).toBe('rest')
    p.x = far[0]!.x
    p.y = far[0]!.y
    expect(chooseTask(s, p, 700)).toMatchObject({ kind: 'walk', reason: 'going home to rest', target: p.hearth })
    p.x = p.hearth.x
    p.y = p.hearth.y
    expect(chooseTask(s, p, 600 + 6 * 1_440).kind).toBe('rest')
    expect(chooseTask(s, p, 600 + 7 * 1_440).reason).toBe('out for a walk')
  })
  it('walks out only when there is time to return before dusk', () => {
    const { s, p } = idleAtHome()
    expect(chooseTask(s, p, 1079).kind).toBe('rest')
  })
  it('explores unknown ground before revisiting exhausted places', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    giveHut(s, p)
    p.axe = testAxe()
    p.knowledge.triangles.fill(0)
    p.knowledge.revision++
    observeAt(s, p, 600)
    // The analytic valley is smaller than sight: no frontier remains once it has all been surveyed.
    expect(nearestFrontier(s.layout.nav, p.knowledge, p)).toBeNull()
    const last = s.layout.nav.mesh.triangles - 1
    p.knowledge.triangles[last >> 3]! &= ~(1 << (last & 7))
    p.knowledge.revision++
    expect(nearestFrontier(s.layout.nav, p.knowledge, p)).not.toBeNull()
    expect(chooseTask(s, p, 600).reason).toBe('exploring')
  })
})
