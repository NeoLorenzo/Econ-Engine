import { addTestLake } from './ruleFixtures'
import { describe, expect, it } from 'vitest'
import { advanceValley, createValley, stepValley, cloneValley } from './engine'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'

function at(minute: number) {
  const state = createValley({ ...FLAT_LAND, founders: 1 })
  state.minute = minute
  state.queue = new WakeQueue()
  state.queue.schedule({ minute, phase: 1, id: 0, kind: 'end' })
  state.queue.schedule({ minute: (Math.floor(minute / 60) + 1) * 60, phase: 0, id: 0, kind: 'world' })
  state.foragers[0]!.knowledge.triangles.fill(255)
  return state
}
describe('wake-up engine', () => {
  it('preserves interval partitioning with meetings, crafting and shared fires', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, founders: 2 })
    for (const person of state.foragers) {
      person.wood = 36
      person.stone = 1
      person.knowledge.triangles.fill(255)
    }
    const before = cloneValley(state)
    const batch = stepValley(state, 1_440)
    let single = state
    for (let minute = 1; minute <= 1_440; minute += 1) single = stepValley(single, minute)
    batch.lastInterval = []
    single.lastInterval = []
    expect(batch).toEqual(single)
    expect(state).toEqual(before)
  })
  it('sleeps from dusk to dawn as one task', () => {
    const state = at(1_080)
    const asleep = stepValley(state, 1_081)
    expect(asleep.foragers[0]!.task).toMatchObject({ kind: 'sleep', startMinute: 1_080, endMinute: 1_800 })
    const night = stepValley(asleep, 1_799)
    expect(night.foragers[0]!.task).toEqual(asleep.foragers[0]!.task)
    expect(night.totals.wakeUps).toBe(1)
  })
  it('walks home as one task and arrives at its recorded minute', () => {
    const state = at(1_080),
      person = state.foragers[0]!
    person.x = person.hearth.x - 20_000
    const walking = stepValley(state, 1_081)
    const task = walking.foragers[0]!.task!
    expect(task.kind).toBe('walk')
    const arrived = stepValley(walking, task.endMinute)
    expect(arrived.foragers[0]!.x).toBe(person.hearth.x)
    expect(arrived.foragers[0]!.y).toBe(person.hearth.y)
    expect(arrived.lastInterval).toContainEqual(expect.objectContaining({ kind: 'task-end', minute: task.endMinute }))
  })
  it('midnight regrowth leaves person queue entries unchanged', () => {
    const state = stepValley(at(1_080), 1_439)
    const pending = state.queue.entriesOf(0)
    const after = stepValley(state, 1_440)
    expect(after.queue.entriesOf(0)).toEqual(pending)
  })
  it('advancing a day at once equals advancing minute by minute and preserves its input', () => {
    const state = createValley({ ...FLAT_LAND, founders: 1 }),
      before = cloneValley(state)
    const batch = stepValley(state, 1_440)
    let single = state
    for (let minute = 1; minute <= 1_440; minute += 1) single = stepValley(single, minute)
    batch.lastInterval = []
    single.lastInterval = []
    expect(batch).toEqual(single)
    expect(state).toEqual(before)
  })
  it('advancing a state in place equals stepping copies of it', () => {
    const owned = createValley(FLAT_LAND)
    let stepped = cloneValley(owned)
    for (const minute of [1, 60, 61, 600, 1_440, 2_000, 2_880]) {
      expect(advanceValley(owned, minute)).toBe(owned)
      stepped = stepValley(stepped, minute)
      expect(owned).toEqual(stepped)
    }
  })
})

describe('food, water and wood tasks', () => {
  it('two pickers cannot overdraw a thicket', () => {
    const state = createValley({ ...FLAT_LAND, founders: 2 })
    state.minute = 600
    state.queue = new WakeQueue()
    state.foodStock.fill(0)
    state.foodStock[0] = 1_000
    for (const person of state.foragers) {
      person.x = state.layout.places.x[0]!
      person.y = state.layout.places.y[0]!
      person.hearth = { x: person.x, y: person.y }
      person.energyKcal = 63_000
      person.hungry = true
      person.knownPlaces.fill(0)
      person.placeStock.fill(0)
      person.placeStock[0] = 1_000
      person.knowledge.triangles.fill(255)
      state.queue.schedule({ minute: 600, phase: 1, id: person.id, kind: 'end' })
    }
    const next = stepValley(state, 900)
    expect(next.foodStock[0]).toBeGreaterThanOrEqual(0)
    expect(next.totals.gatheredKcal).toBe(1_000)
  })
  it('walks to a known bank and drinks to the stop threshold', () => {
    const state = at(600),
      bank = addTestLake(state),
      person = state.foragers[0]!
    person.x = bank.x
    person.y = bank.y + 5_000
    person.hearth = { x: person.x, y: person.y }
    person.waterDeficitMl = 700
    person.thirsty = true
    const next = stepValley(state, 630)
    expect(next.lastInterval.some((event) => event.kind === 'drink')).toBe(true)
    expect(next.foragers[0]!.waterDrunkMl).toBeGreaterThan(0)
    const drink = next.lastInterval.find((event) => event.kind === 'drink')!
    if (drink.kind === 'drink') expect(drink.deficitAfterMl).toBeLessThanOrEqual(next.config.drinkStopMl)
  })
  it('severe thirst wakes a sleeper', () => {
    const state = at(1_080),
      person = state.foragers[0]!
    addTestLake(state)
    person.waterDeficitMl = person.thirstThresholds.urgent - 10
    person.thirsty = true
    const next = stepValley(state, 1_090)
    expect(next.totals.wakeUps).toBeGreaterThan(1)
    expect(next.foragers[0]!.task?.kind).not.toBe('sleep')
  })
  it('takes a full wood load home', () => {
    const state = at(600),
      person = state.foragers[0]!
    person.x -= 20_000
    person.wood = person.loadCapacityKg
    person.tripWood = person.loadCapacityKg
    person.hungry = false
    const next = stepValley(state, 601)
    expect(next.foragers[0]!.task).toMatchObject({ kind: 'walk', reason: 'taking a load home' })
  })
  it('keeps a day of bodies and meals identical at 8 and 365 days per year', () => {
    const runs = [8, 365].map((daysPerYear) => stepValley(createValley({ founders: 8, daysPerYear }), 1_440))
    const body = (s: ReturnType<typeof createValley>) =>
      s.foragers.map((p) => ({
        energy: p.energyKcal,
        remainder: p.energyRemainder,
        time: p.energyTimeRemainder,
        water: p.waterDeficitMl,
        base: p.waterBaseRemainder,
        activity: p.waterActivityRemainder,
        carried: p.carried,
      }))
    expect(body(runs[0]!)).toEqual(body(runs[1]!))
  }, 120_000)
})

it('keeps all eight canonical founders alive without thirst deaths for thirty days', () => {
  const state = stepValley(createValley({ founders: 8 }), 30 * 1_440)
  expect(
    state.foragers
      .filter((p) => p.deathCauses.includes('dehydration'))
      .map((p) => ({ id: p.id, minute: p.deathMinute })),
  ).toEqual([])
  expect(state.foragers.every((p) => p.alive)).toBe(true)
}, 120_000)
