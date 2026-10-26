import { bandAt } from './ruleTestFixtures'
import { burnFires } from './fire'
import { dissolveIfAlone } from './social'
import { describe, expect, it } from 'vitest'
import { stepValley } from './engine'
import { createSurveyedValley as createValley } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'
import { worldWake } from './world'
import { energyAt } from './body'
import { feedAmount, nightHoursLeft } from './fire'

describe('fires on their hourly cadence', () => {
  it('burns shared wood once per night hour and none by day', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, founders: 2 })
    state.groups[0]!.fireWood = 3
    worldWake(state, 1_080)
    expect(state.groups[0]!.fireWood).toBe(2)
    worldWake(state, 1_140)
    expect(state.groups[0]!.fireWood).toBe(1)
    worldWake(state, 360)
    expect(state.groups[0]!.fireWood).toBe(1)
    expect(state.groups[0]!.fireLit).toBe(false)
    expect(state.totals.burnedWood).toBe(2)
  })
  it('changes sleeping energy at the fire boundary without hourly person wake-ups', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, founders: 2 })
    state.minute = 1_080
    state.queue = new WakeQueue()
    state.groups[0]!.fireWood = 1
    state.queue.schedule({ minute: 1_080, phase: 0, id: 0, kind: 'world' })
    for (const person of state.foragers) state.queue.schedule({ minute: 1_080, phase: 1, id: person.id, kind: 'end' })
    const next = stepValley(state, 1_200),
      task = next.foragers[0]!.task!
    expect(task.kind).toBe('sleep')
    expect(energyAt(task, 1_200, next.routes).kcal).toBe(66_000 - 70 - 90)
    expect(next.totals.wakeUps).toBe(2)
  })
  it('keeps the existing contribution rule and night-hour counts', () => {
    const { config } = createValley(FLAT_LAND)
    expect(nightHoursLeft(config, 600)).toBe(12)
    expect(nightHoursLeft(config, 1_080)).toBe(11)
    expect(feedAmount(config, 30, 12, 1, 600).wood).toBe(6)
    expect(feedAmount(config, 10, 0, 1, 600).wood).toBe(10)
  })
})

describe('ported Life 11 fire rules', () => {
  it('goes out below one hour of wood and relights at the next hour', () => {
    const s = bandAt(1200)
    s.groups[0]!.fireWood = 0
    expect(burnFires(s, 1200)[0]).toMatchObject({ lit: false, burned: 0 })
    s.groups[0]!.fireWood = 3
    expect(burnFires(s, 1260)[0]).toMatchObject({ lit: true, burned: 1, fireWoodAfter: 2 })
  })
  it('saves wood: twelve kilograms per night for eight members', () => {
    const s = bandAt(1080, { founders: 8 })
    s.groups[0]!.fireWood = 12
    for (let h = 18; h < 30; h++) burnFires(s, h * 60)
    expect(s.groups[0]!.fireBurned).toBe(12)
    expect(s.groups[0]!.fireBurned / 8).toBe(1.5)
  })
  it('warms every sleeping member by a lit shared fire without burning personal wood', () => {
    const s = bandAt(1200)
    s.groups[0]!.fireWood = 12
    s.groups[0]!.fireLit = true
    const n = stepValley(s, 1201)
    expect(n.foragers.every((p) => p.task?.energyPerHour === s.config.fireSleepKcalPerHour)).toBe(true)
    expect(n.totals.burnedWood).toBe(0)
  })
  it('leaves every member cold by a fire that is out', () => {
    const s = bandAt(1200)
    for (const p of s.foragers) p.wood = 0
    const n = stepValley(s, 1201)
    expect(n.foragers.every((p) => p.task?.energyPerHour === s.config.coldSleepKcalPerHour)).toBe(true)
  })
  it('leaves a forager without a group to tend its own fire', () => {
    const s = bandAt(1200, { scattered: true, founders: 1 })
    s.foragers[0]!.wood = 5
    const n = stepValley(s, 1201)
    expect(n.foragers[0]!.warm).toBe(true)
    expect(n.foragers[0]!.wood).toBe(4)
    expect(n.lastInterval).toContainEqual(expect.objectContaining({ kind: 'fire', foragerId: 0, burned: 1 }))
  })
  it('counts the hours after the current night hour', () => {
    const c = bandAt().config
    expect(nightHoursLeft(c, 1201)).toBe(9)
    expect(nightHoursLeft(c, 300)).toBe(0)
  })
  it('gives spare wood above two nights and covers the remaining night', () => {
    const c = bandAt().config
    expect(feedAmount(c, 40, 20, 1, 1201)).toEqual({ wood: 16, spareWood: 16, low: false })
    expect(feedAmount(c, 10, 3, 1, 1201)).toEqual({ wood: 6, spareWood: 0, low: true })
    expect(feedAmount(c, 30, 0, 1, 1201)).toEqual({ wood: 9, spareWood: 6, low: true })
    expect(feedAmount(c, 4, 0, 1, 1201)).toEqual({ wood: 4, spareWood: 0, low: true })
    expect(feedAmount(c, 20, 20, 1, 600).wood).toBe(0)
  })
  it('records the giver and transfers its wood into the fire', () => {
    const s = bandAt(1201)
    s.foragers[0]!.wood = 30
    s.foragers[1]!.wood = 0
    s.groups[0]!.fireWood = 3
    const n = stepValley(s, 1202)
    expect(n.lastInterval).toContainEqual(
      expect.objectContaining({ kind: 'feed', foragerId: 0, wood: 6, spareWood: 6, fireWoodAfter: 9 }),
    )
    expect(n.foragers[0]!.fireGiven).toBe(6)
    expect(n.groups[0]!.given[0]).toBe(6)
    expect(n.today.fireGivenById[0]).toBe(6)
  })
  it('gives nothing away from the hearth', () => {
    const s = bandAt(1201)
    s.foragers[0]!.x += 20000
    const n = stepValley(s, 1202)
    expect(n.lastInterval.some((e) => e.kind === 'feed' && e.foragerId === 0)).toBe(false)
  })
  it('returns fire wood to the last survivor without moving its hearth', () => {
    const s = bandAt()
    s.groups[0]!.fireWood = 7
    s.foragers[0]!.wood = 2
    s.foragers[1]!.alive = false
    const hearth = { ...s.foragers[0]!.hearth }
    expect(dissolveIfAlone(s, 0, 600)).toMatchObject({ survivorId: 0, fireWood: 7 })
    expect(s.foragers[0]!.wood).toBe(9)
    expect(s.foragers[0]!.hearth).toEqual(hearth)
  })
})
