import { describe, expect, it } from 'vitest'
import { createValley } from './engine'
import { FLAT_LAND } from './config'
import { observeAt } from './perception'
import { chooseTask } from './forager'

describe('place knowledge and rechecking', () => {
  it('keeps unknown stock optimistic, learning stock only at the place', () => {
    const state = createValley({ ...FLAT_LAND, bandSize: 1 }),
      person = state.foragers[0]!
    observeAt(state, person, 600)
    expect([...person.knownPlaces].some((m) => m === 600)).toBe(true)
    expect([...person.placeStock].filter((stock) => stock >= 0).length).toBeLessThanOrEqual(1)
  })
  it('rechecks a remembered place after a day when no frontier remains', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 }),
      person = state.foragers[0]!
    person.wood = 24
    person.shortOfWood = false
    person.knowledge.nodes.fill(1)
    person.knownPlaces.fill(600)
    person.placeStock.fill(0)
    person.placeCheckedMinute.fill(600)
    person.hutId = 0
    person.axe = { id: 0, makerId: 0, madeMinute: 0, quality: 100, logsLeft: 200 }
    state.huts.push({ id: 0, builderId: 0, x: person.x, y: person.y, logs: 23, begunMinute: 0, abandonedMinute: null })
    expect(chooseTask(state, person, 600 + 1_440).reason).toBe('checking')
  })
})
