import { bandAt, giveHut, testAxe } from './ruleTestFixtures'
import { reindexPeople } from './perception'
import { nearestFrontier } from './routes'
import { describe, expect, it } from 'vitest'
import { createValley } from './engine'
import { FLAT_LAND } from './config'
import { observeAt } from './perception'
import { chooseTask } from './forager'

describe('place knowledge and rechecking', () => {
  it('keeps unknown stock optimistic, learning stock only at the place', () => {
    const state = createValley({ ...FLAT_LAND, founders: 1 }),
      person = state.foragers[0]!
    observeAt(state, person, 600)
    expect([...person.knownPlaces].some((m) => m === 600)).toBe(true)
    expect([...person.placeStock].filter((stock) => stock >= 0).length).toBeLessThanOrEqual(1)
  })
  it('rechecks a remembered place after a day when no frontier remains', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, founders: 2 }),
      person = state.foragers[0]!
    person.wood = 24
    person.shortOfWood = false
    person.knowledge.triangles.fill(255)
    person.knownPlaces.fill(600)
    person.placeStock.fill(0)
    person.placeCheckedMinute.fill(600)
    person.hutId = 0
    person.axe = { id: 0, makerId: 0, madeMinute: 0, quality: 100, logsLeft: 200 }
    state.huts.push({ id: 0, builderId: 0, x: person.x, y: person.y, logs: 23, begunMinute: 0, abandonedMinute: null })
    expect(chooseTask(state, person, 600 + 1_440).reason).toBe('checking')
  })
})

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
  it('checks only known sites that leave time to return before dusk', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    giveHut(s, p)
    p.axe = testAxe()
    p.knownPlaces.fill(-1)
    p.placeCheckedMinute.fill(-1)
    expect(chooseTask(s, p, 600).reason).not.toBe('checking')
    p.knownPlaces.fill(0)
    expect(chooseTask(s, p, 1079).reason).not.toBe('checking')
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
