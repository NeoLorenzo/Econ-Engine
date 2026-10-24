import { describe, expect, it } from 'vitest'
import { createValley } from './engine'
import { FLAT_LAND } from './config'
import { observeAt, reindexPeople, scheduleArrivals } from './perception'
import { startTask } from './tasks'
import { knownRoute } from './routes'

describe('wake-up perception', () => {
  it('schedules later chunk entries at their derived minute', () => {
    const state = createValley(FLAT_LAND)
    const [walker, rester] = state.foragers
    walker!.x = 1_000
    walker!.y = 21_000
    rester!.x = 61_000
    rester!.y = 21_000
    rester!.task = startTask(state.config, rester!, 'rest', 0, 60, -1, -1, 'satiated')
    walker!.knowledge.triangles.fill(255)
    reindexPeople(state, 0)
    const route = knownRoute(state.layout.nav, walker!.knowledge, state.config, 0, walker!, rester!)!
    scheduleArrivals(state, walker!.id, route, 0)
    expect(state.queue.entriesOf(rester!.id).filter((entry) => entry.kind === 'arrival')[0]!.minute).toBeGreaterThan(0)
  })
  it('does not wake people in the chunk a walk starts from', () => {
    const state = createValley(FLAT_LAND)
    const [walker, rester] = state.foragers
    walker!.x = 21_000
    walker!.y = 21_000
    rester!.x = 21_500
    rester!.y = 21_000
    rester!.task = startTask(state.config, rester!, 'rest', 0, 60, -1, -1, 'satiated')
    walker!.knowledge.triangles.fill(255)
    reindexPeople(state, 0)
    const route = knownRoute(state.layout.nav, walker!.knowledge, state.config, 0, walker!, { x: 23_000, y: 21_000 })!
    scheduleArrivals(state, walker!.id, route, 0)
    expect(state.queue.entriesOf(rester!.id).filter((entry) => entry.kind === 'arrival')).toEqual([])
  })
  it('learns place locations but stock only where it stands', () => {
    const state = createValley(FLAT_LAND)
    const person = state.foragers[0]!
    person.x = state.layout.places.x[0]!
    person.y = state.layout.places.y[0]!
    observeAt(state, person, 1)
    expect(person.knownPlaces[0]).toBe(1)
    expect(person.placeStock[0]).toBe(state.foodStock[0])
    const another = [...person.knownPlaces].findIndex((minute, id) => minute >= 0 && id !== 0)
    expect(another).toBeGreaterThan(0)
    expect(person.placeStock[another]).toBe(-1)
  })
  it('sees nothing beyond its sight radius', () => {
    const state = createValley({ ...FLAT_LAND, sightRadiusCm: 3_000 })
    const person = state.foragers[0]!
    person.x = state.layout.places.x[0]! + 3_001
    person.y = state.layout.places.y[0]!
    observeAt(state, person, 0)
    expect(person.knownPlaces[0]).toBe(-1)
  })
  it('wakes a rester but not a sleeper, including entry in departure minute', () => {
    const state = createValley(FLAT_LAND)
    const [walker, rester, sleeper] = state.foragers
    walker!.x = 19_950
    walker!.y = 21_000
    rester!.x = 20_100
    rester!.y = 21_000
    sleeper!.x = 20_200
    sleeper!.y = 21_000
    rester!.task = startTask(state.config, rester!, 'rest', 0, 60, -1, -1, 'satiated')
    sleeper!.task = startTask(state.config, sleeper!, 'sleep', 0, 360, -1, -1, 'night')
    walker!.knowledge.triangles.fill(255)
    reindexPeople(state, 0)
    const route = knownRoute(state.layout.nav, walker!.knowledge, state.config, 0, walker!, { x: 23_000, y: 21_000 })!
    scheduleArrivals(state, walker!.id, route, 0)
    expect(state.queue.entriesOf(rester!.id)).toContainEqual(expect.objectContaining({ minute: 0, kind: 'arrival' }))
    expect(state.queue.entriesOf(sleeper!.id).filter((entry) => entry.kind === 'arrival')).toEqual([])
  })
})
