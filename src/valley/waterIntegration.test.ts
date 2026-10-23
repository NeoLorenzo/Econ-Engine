import { describe, expect, it } from 'vitest'
import { createValley, stepValley } from './engine'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'
import { addTestLake } from './ruleFixtures'
import { startTask } from './tasks'

describe('water at wake-ups', () => {
  function atBank() {
    const state = createValley({ ...FLAT_LAND, bandSize: 1 }),
      bank = addTestLake(state),
      person = state.foragers[0]!
    state.minute = 600
    state.queue = new WakeQueue()
    person.x = bank.x
    person.y = bank.y
    person.hearth = { x: bank.x, y: bank.y }
    person.knowledge.nodes.fill(1)
    person.waterDeficitMl = 700
    person.thirsty = true
    state.queue.schedule({ minute: 600, phase: 1, id: 0, kind: 'end' })
    return { state, bank, person }
  }
  it('records withdrawals from the encountered source exactly', () => {
    const { state, bank } = atBank(),
      next = stepValley(state, 605)
    const drinks = next.lastInterval.filter((e) => e.kind === 'drink')
    expect(drinks.length).toBeGreaterThan(0)
    const volume = drinks.reduce((sum, e) => sum + e.volumeMl, 0)
    expect(next.waterWithdrawals.get(bank.bodyId)).toBe(volume)
    expect(next.foragers[0]!.waterDrunkMl).toBe(volume)
    expect(next.foragers[0]!.waterDeficitMl).toBeLessThanOrEqual(next.config.drinkStopMl)
  })
  it('records coincident fatal causes and never charges a dead body again', () => {
    const state = createValley({ ...FLAT_LAND, bandSize: 1 }),
      person = state.foragers[0]!
    state.minute = 600
    state.queue = new WakeQueue()
    person.knowledge.nodes.fill(1)
    person.energyKcal = 1
    person.waterDeficitMl = 5_999
    person.task = startTask(state.config, person, 'rest', 600, 660, -1, -1, 'no known route')
    state.queue.schedule({ minute: 601, phase: 1, id: 0, kind: 'threshold' })
    const dead = stepValley(state, 601),
      later = stepValley(dead, 900)
    expect(dead.lastInterval).toContainEqual(
      expect.objectContaining({ kind: 'death', minute: 601, cause: 'starvation and dehydration' }),
    )
    expect(later.foragers[0]!.energyKcal).toBe(dead.foragers[0]!.energyKcal)
    expect(later.foragers[0]!.waterLostMl).toBe(dead.foragers[0]!.waterLostMl)
    expect(later.queue.entriesOf(0)).toEqual([])
  })
  it('charges an initial minute to learn that an unknown fish body is empty', () => {
    const { state, bank, person } = atBank()
    person.thirsty = false
    person.waterDeficitMl = 0
    person.energyKcal = 63_000
    person.hungry = true
    person.knownPlaces.fill(0)
    person.placeStock.fill(0)
    const fish = state.fish.find((f) => f.bodyId === bank.bodyId)!
    fish.stock = 0
    state.fishKcal = 0
    const next = stepValley(state, 602)
    expect(next.foragers[0]!.fishMemory.get(bank.bodyId)?.stock).toBe(0)
    expect(next.totals.gatheredKcal).toBe(0)
    expect(next.foragers[0]!.secondsWorked.forage).toBe(60)
  })
})

it('records no withdrawal at the wake-up spent arriving before the drinking task', () => {
  const state = createValley({ ...FLAT_LAND, bandSize: 1 }),
    bank = addTestLake(state),
    p = state.foragers[0]!
  state.minute = 600
  state.queue = new WakeQueue()
  state.queue.schedule({ minute: 600, phase: 1, id: 0, kind: 'end' })
  p.x = bank.x
  p.y = bank.y + 5000
  p.hearth = { x: p.x, y: p.y }
  p.waterDeficitMl = 700
  p.thirsty = true
  const walking = stepValley(state, 601),
    walk = walking.lastInterval.find((e) => e.kind === 'task-start' && e.task.kind === 'walk')!
  if (walk.kind !== 'task-start') throw new Error('Expected a recorded walk')
  const arrived = walk.task.endMinute === walking.minute ? walking : stepValley(walking, walk.task.endMinute)
  expect(arrived.foragers[0]!.task?.kind).toBe('drink')
  expect(arrived.lastInterval.some((e) => e.kind === 'drink')).toBe(false)
  expect(arrived.waterWithdrawals.size).toBe(0)
})
