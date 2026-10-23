import { describe, expect, it } from 'vitest'
import { createValley, stepValley } from './engine'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'
import { beginAxe, workAxe, cutAt, askOf, worthTo, exchangeAxes } from './axes'
import { layLog, weatherHuts, leaveHutIfMoved } from './huts'

describe('axes and huts at task boundaries', () => {
  it('keeps pausable axe work and draws quality from the maker stream', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 }),
      person = state.foragers[0]!
    person.craft = 100
    person.stone = 1
    person.wood = 1
    beginAxe(state, person)
    expect(person.stone).toBe(0)
    expect(person.wood).toBe(0)
    expect(workAxe(state, person, 1_800, 600).made).toBeNull()
    expect(person.making!.worked).toBe(1_800)
    const made = workAxe(state, person, person.making!.needed - 1_800, 700).made!
    expect(made.axe.quality).toBeGreaterThanOrEqual(50)
    expect(made.axe.quality).toBeLessThanOrEqual(100)
  })
  it('takes one log, one axe use and a tree crown at the appropriate boundary', () => {
    const state = createValley(FLAT_LAND),
      person = state.foragers[0]!,
      stand = 64
    person.axe = { id: 0, makerId: 0, madeMinute: 0, quality: 100, logsLeft: 2 }
    const cut = cutAt(state, person, stand, 1_800, 600).cut!
    expect(cut).not.toBeNull()
    expect(state.logStock[stand]).toBe(35)
    expect(person.axe!.logsLeft).toBe(1)
    expect(person.log).toBe(1)
    expect(state.woodStock[stand]).toBe(310)
    person.log = 0
    cutAt(state, person, stand, 1_800, 630)
    expect(state.logStock[stand]).toBe(34)
    expect(state.woodStock[stand]).toBe(310)
    expect(person.axe).toBeNull()
    person.log = 0
    person.axe = { id: 1, makerId: 0, madeMinute: 630, quality: 100, logsLeft: 2 }
    cutAt(state, person, stand, 1_800, 660)
    person.log = 0
    cutAt(state, person, stand, 1_800, 690)
    expect(state.logRegrowth.get(stand)).toEqual([600])
    expect(state.felledMinute[stand]).toBe(690)
    expect(state.logStock[stand]).toBe(32)
    expect(state.woodStock[stand]).toBe(320)
  })
  it('delivers a carried log, weathers it by day, and leaves a hut when the hearth moves', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 }),
      person = state.foragers[0]!
    person.log = 1
    expect(layLog(state, person, 600)).toBe(true)
    expect(state.huts[0]!.logs).toBe(1)
    weatherHuts(state, 60 * 1_440)
    expect(state.huts[0]!.logs).toBe(0)
    person.hearth = { x: person.x + 1_000, y: person.y }
    expect(leaveHutIfMoved(state, person, 601)).not.toBeNull()
    expect(person.hutId).toBeNull()
  })
  it('chooses crafting at its hearth when it has the inputs', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 }),
      person = state.foragers[0]!
    state.minute = 600
    state.queue = new WakeQueue()
    person.wood = 36
    person.stone = 1
    person.shortOfWood = false
    person.knowledge.nodes.fill(1)
    state.queue.schedule({ minute: 600, phase: 1, id: 0, kind: 'end' })
    const next = stepValley(state, 601)
    expect(next.foragers[0]!.task?.kind).toBe('make')
    expect(next.foragers[0]!.making).not.toBeNull()
  })
  it('sells an axe at the midpoint of ask and worth, conserving food', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, bandSize: 2 }),
      [seller, buyer] = state.foragers
    seller!.craft = 150
    buyer!.craft = 50
    seller!.hutId = 0
    state.huts.push({
      id: 0,
      builderId: 0,
      x: seller!.x,
      y: seller!.y,
      logs: 23,
      begunMinute: 0,
      abandonedMinute: null,
    })
    seller!.spareAxe = { id: 0, makerId: 0, madeMinute: 0, quality: 100, logsLeft: 200 }
    seller!.energyKcal = 60_000
    buyer!.carried = [{ food: 'nuts', kcal: 10_000, harvestTick: 0 }]
    const events = exchangeAxes(state, buyer!, 0),
      sale = events.find((e) => e.kind === 'sale')!
    expect(sale).toBeDefined()
    if (sale.kind === 'sale')
      expect(sale.price).toBe(Math.floor((askOf(state.config, 150) + worthTo(state.config, buyer!, 100)) / 2))
    expect([...seller!.carried, ...buyer!.carried].reduce((sum, lot) => sum + lot.kcal, 0)).toBe(10_000)
  })
})
