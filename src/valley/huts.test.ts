import { bandAt, giveHut, testAxe } from './ruleTestFixtures'
import { planHut, makeSeconds, expectedQuality, axeLife, logCut } from './axes'
import { drawSkills } from './layout'
import { chooseTask } from './forager'
import { hearthAround } from './social'
import { sleepCostOf } from './work'
import { regrowPlaces } from './places'
import { describe, expect, it } from 'vitest'
import { createValley, stepValley } from './engine'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'
import { beginAxe, workAxe, cutAt, askOf, worthTo, exchangeAxes } from './axes'
import { layLog, weatherHuts, leaveHutIfMoved } from './huts'

describe('axes and huts at task boundaries', () => {
  it('keeps pausable axe work and draws quality from the maker stream', () => {
    const state = createValley({ ...FLAT_LAND, scattered: false, founders: 2 }),
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
    const state = createValley({ ...FLAT_LAND, scattered: false, founders: 2 }),
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
    const state = createValley({ ...FLAT_LAND, scattered: false, founders: 2 }),
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
    const state = createValley({ ...FLAT_LAND, scattered: false, founders: 2 }),
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

describe('ported Life 11 axe and shelter rules', () => {
  it('gives aggregate outcrops their sixty stones within their dry footprints', () => {
    const s = bandAt()
    for (let id = 0; id < s.layout.places.count; id++)
      if (s.layout.places.kind[id] === 3) {
        expect(s.stoneStock[id]).toBe(60)
        expect(s.layout.places.radiusCm[id]).toBe(s.config.outcropRadiusCm)
      }
  })
  it('draws craft independently of the other born skills', () => {
    const s = bandAt(600, { craftSkillMinPercent: 50, craftSkillMaxPercent: 150 })
    expect(drawSkills(s.config)).toEqual(drawSkills({ ...s.config, craftSkillMinPercent: 100 }))
    expect(new Set(s.foragers.map((p) => p.craftSkill)).size).toBeGreaterThan(1)
  })
  it('starts craft at half mastery and gives every stand thirty-six logs', () => {
    const s = bandAt()
    expect(s.foragers.every((p) => p.craft === 50)).toBe(true)
    expect(s.logStock[64]).toBe(36)
    expect(bandAt(600, { craftPractice: false }).foragers.every((p) => p.craft === 100)).toBe(true)
  })
  it('takes fifty hours at craft one hundred and prices its extra energy', () => {
    const c = bandAt().config
    expect(makeSeconds(c, 100)).toBe(180000)
    expect(makeSeconds(c, 50)).toBe(360000)
    expect(askOf(c, 50)).toBe(6000)
    expect(askOf(c, 100)).toBe(3000)
    expect(expectedQuality(50)).toBe(37)
    expect(axeLife(c, 45)).toBe(90)
    expect(axeLife(c, 1)).toBe(2)
    expect(axeLife({ ...c, axeLogs: 40 }, 1)).toBe(1)
  })
  it('fetches a stone first when a member needs an axe for its hut', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    expect(planHut(s, p, 600)?.kind).toBe('stone')
    expect(chooseTask(s, p, 600).reason).toBe('picking up a stone')
  })
  it('spends a stone and wood when beginning an axe', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.stone = 1
    beginAxe(s, p)
    expect(p.stone).toBe(0)
    expect(p.wood).toBe(23)
    expect(s.totals).toMatchObject({ stonesWorked: 1, axeWood: 1 })
    expect(p.making).toMatchObject({ worked: 0, needed: 360000, forSale: false })
  })
  it('cuts at the speed set by axe quality', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.axe = testAxe(80)
    cutAt(s, p, 64, 60, 601)
    expect(p.chopRemainder).toBe(4800)
    expect(p.log).toBe(0)
  })
  it('finishes a felled bundle before felling a nearer stand', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.axe = testAxe()
    p.x = s.layout.places.x[64]!
    p.y = s.layout.places.y[64]!
    p.placeLogs[64] = 36
    p.placeLogs[65] = 35
    p.placeLogs[66] = 0
    p.placeLogs[67] = 0
    p.placeLogs[68] = 0
    p.placeLogs[69] = 0
    p.placeLogs[70] = 0
    p.placeLogs[71] = 0
    p.placeLogs[72] = 0
    p.placeLogs[73] = 0
    p.placeLogs[74] = 0
    p.placeLogs[75] = 0
    expect(planHut(s, p, 600)).toEqual({ kind: 'cut', treeId: 65 })
  })
  it('throws away a worn axe and loses the remaining cut', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.axe = testAxe(100, 1)
    p.chopRemainder = logCut(s.config) - 6000
    const result = cutAt(s, p, 64, 60, 601)
    expect(result.worn).toMatchObject({ kind: 'worn', foragerId: 0 })
    expect(p.axe).toBeNull()
    expect(p.chopRemainder).toBe(0)
    expect(p.log).toBe(1)
  })
  it('takes a log home before building and lays it at its hearth', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.x += 5000
    p.log = 1
    const n = stepValley(s, 601)
    expect(n.lastInterval).toContainEqual(
      expect.objectContaining({
        kind: 'task-start',
        foragerId: 0,
        task: expect.objectContaining({ reason: 'taking a log home' }),
      }),
    )
    const arrived = n
    expect(arrived.foragers[0]!.log).toBe(0)
    expect(arrived.huts[0]).toMatchObject({ builderId: 0, logs: 1, x: p.hearth.x, y: p.hearth.y })
    expect(arrived.lastInterval.some((e) => e.kind === 'delivery')).toBe(true)
  })
  it('takes up its spare axe when its hut needs logs', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.spareAxe = testAxe(60)
    chooseTask(s, p, 600)
    expect(p.spareAxe).toBeNull()
    expect(p.axe?.quality).toBe(60)
  })
  it('sleeps warmer in a whole hut than an unfinished hut with the fire out', () => {
    const s = bandAt(1200)
    giveHut(s, s.foragers[0]!)
    giveHut(s, s.foragers[1]!, 9)
    for (const p of s.foragers) p.wood = 0
    const n = stepValley(s, 1201)
    expect(n.foragers[0]!.task!.energyPerHour).toBe(s.config.hutSleepKcalPerHour)
    expect(n.foragers[1]!.task!.energyPerHour).toBe(s.config.coldSleepKcalPerHour)
  })
  it('warms a member most with a whole hut and a lit fire', () => {
    const s = bandAt(1200)
    giveHut(s, s.foragers[0]!)
    s.groups[0]!.fireLit = true
    const n = stepValley(s, 1201)
    expect(n.foragers[0]!.task!.energyPerHour).toBe(sleepCostOf(s.config, 'fire and hut'))
    expect(n.foragers[1]!.task!.energyPerHour).toBe(sleepCostOf(s.config, 'fire'))
    expect(sleepCostOf(s.config, 'fire and hut')).toBeLessThan(sleepCostOf(s.config, 'fire'))
  })
  it('puts eight hearths on the first ring and sixteen on the second', () => {
    const c = bandAt().config,
      flag = { x: 40000, y: 40000 }
    for (let i = 0; i < 24; i++) {
      const p = hearthAround(c, flag, i)
      expect(Math.round(Math.hypot(p.x - flag.x, p.y - flag.y) / c.hutRingCm)).toBe(i < 8 ? 1 : 2)
    }
  })
  it('leaves a member with a whole hut to explore instead of building', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    giveHut(s, p)
    expect(planHut(s, p, 600)).toBeNull()
    expect(chooseTask(s, p, 600).kind).not.toBe('cut')
  })
  it('weathers each standing or abandoned hut on its own day', () => {
    const s = bandAt()
    giveHut(s, s.foragers[0]!)
    giveHut(s, s.foragers[1]!)
    s.huts[1] = { ...s.huts[1]!, abandonedMinute: 1 }
    weatherHuts(s, 59 * 1440)
    expect(s.huts.map((h) => h.logs)).toEqual([23, 22])
    weatherHuts(s, 60 * 1440)
    expect(s.huts.map((h) => h.logs)).toEqual([22, 22])
  })
  it('grows a harvested bundle at the first midnight twenty years after felling', () => {
    const s = bandAt(600, { daysPerYear: 8 })
    s.logStock[64] = 33
    s.logRegrowth.set(64, [600])
    regrowPlaces(s, 160 * 1440)
    expect(s.logStock[64]).toBe(33)
    regrowPlaces(s, 161 * 1440)
    expect(s.logStock[64]).toBe(36)
  })
  it('gathers sticks from thickets as firewood', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.x = s.layout.places.x[0]!
    p.y = s.layout.places.y[0]!
    p.wood = 0
    p.shortOfWood = true
    const n = stepValley(s, 601)
    expect(n.foragers[0]!.task).toMatchObject({ kind: 'gather', placeId: 0 })
    const end = n.foragers[0]!.task!.endMinute
    expect(stepValley(n, end).totals.gatheredWood).toBeGreaterThan(0)
  })
  it('regrows deadfall at capped places without removing a felled crown', () => {
    const s = bandAt()
    s.woodStock[64] = 0
    s.woodStock[0] = 0
    s.woodStock[65] = 310
    regrowPlaces(s, 1440)
    expect(s.woodStock[64]).toBeGreaterThan(0)
    expect(s.woodStock[0]).toBeGreaterThanOrEqual(0)
    expect(s.woodStock[65]).toBe(310)
  })
  it('values an axe at own making cost scaled by its expected quality', () => {
    const s = bandAt(),
      p = s.foragers[0]!
    p.craft = 100
    expect(worthTo(s.config, p, expectedQuality(100))).toBe(askOf(s.config, 100))
  })
  it('draws a promise from the cheapest mutually worthwhile maker', () => {
    const s = bandAt(600, { founders: 3 }),
      [buyer, a, b] = s.foragers
    giveHut(s, a!)
    giveHut(s, b!)
    buyer!.craft = 50
    a!.craft = 100
    b!.craft = 150
    const promises = exchangeAxes(s, buyer!, 600).filter((e) => e.kind === 'promise')
    expect(promises).toHaveLength(1)
    expect(promises[0]).toMatchObject({ promiserId: 2, askerId: 0 })
    expect(b!.promised).toBe(true)
  })
  it('sells nothing when the buyer cannot pay', () => {
    const s = bandAt(),
      [a, b] = s.foragers
    giveHut(s, a!)
    a!.spareAxe = testAxe()
    a!.craft = 150
    b!.craft = 50
    expect(exchangeAxes(s, b!, 600).some((e) => e.kind === 'sale')).toBe(false)
    expect(a!.spareAxe).not.toBeNull()
  })
  it.each([{ axeTrade: false }, { scattered: true }])(
    'asks, promises and sells nothing with disabled trade or outside a group: %j',
    (overrides) => {
      const s = bandAt(600, overrides),
        [a, b] = s.foragers
      giveHut(s, a!)
      a!.spareAxe = testAxe()
      a!.craft = 150
      b!.craft = 50
      expect(exchangeAxes(s, b!, 600)).toEqual([])
    },
  )
})
