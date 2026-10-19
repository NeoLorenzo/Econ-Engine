import { describe, expect, it } from 'vitest'
import { askOf, axeLife, exchangeAxes, expectedQuality, logCut, makeSeconds, worthTo } from './axes'
import { cloneValley, createValley, lastEventOf, regrowWood, stepValley } from './engine'
import { ValleyChecker } from './invariants'
import { drawSkills } from './layout'
import { hearthAround } from './social'
import { valleyTheory } from './theory'
import { sleepCostOf } from './work'
import type { Axe, Forager, ValleyConfig, ValleyState } from './types'

const TEN_AM = 600
const EIGHT_PM = 20 * 60

/**
 * The band as one group around the camp at minute `minute`, every member at its hearth holding two nights' wood, so
 * that it has no need and turns to its hut. The wood added goes into the valley's starting totals.
 */
function band(minute: number, overrides: Partial<ValleyConfig> = {}) {
  const state = cloneValley(createValley({ scattered: false, ...overrides }))
  state.minute = minute
  for (const forager of state.foragers) {
    forager.wood = 24
    forager.shortOfWood = false
    state.totals.initialWood += 24
  }
  return state
}

const axe = (state: ValleyState, makerId: number, quality: number, logsLeft = axeLife(state.config, quality)): Axe => ({
  id: state.totals.axesMade++,
  quality,
  logsLeft,
  makerId,
  madeMinute: 0,
})

/** Gives a forager a stone, taken from the valley's starting stones so the balance holds. */
function giveStone(state: ValleyState, forager: Forager) {
  forager.stone += 1
  const spot = state.stoneStock.findIndex((stones) => stones > 0)
  state.stoneStock[spot]! -= 1
}

/** Gives a forager a whole hut at its hearth, of logs cut from trees felled at minute 0 out of the starting logs. */
function giveHut(state: ValleyState, forager: Forager, logs = state.config.hutLogs) {
  state.huts.push({
    id: state.huts.length,
    builderId: forager.id,
    x: forager.hearth.x,
    y: forager.hearth.y,
    logs,
    begunMinute: 0,
    abandonedMinute: null,
  })
  forager.hutId = state.huts.length - 1
  for (let id = 0, left = logs; left > 0; id += 1) {
    const taken = Math.min(left, state.treeLogs[id]!)
    state.treeLogs[id]! -= taken
    state.treeFelledMinute[id] = 0
    state.totals.logsCut += taken
    left -= taken
  }
}

describe('the layout', () => {
  it('draws outcrops of stone spots, each within its outcrop', () => {
    const { config, layout, stoneStock } = createValley()
    expect(layout.outcrops).toHaveLength(config.outcropCount)
    expect(layout.stones.count).toBe(config.outcropCount * config.stonesPerOutcrop)
    for (let id = 0; id < layout.stones.count; id += 1) {
      const centre = layout.outcrops[layout.stones.site[id]!]!
      expect(Math.hypot(layout.stones.x[id]! - centre.x, layout.stones.y[id]! - centre.y)).toBeLessThanOrEqual(
        config.outcropRadiusCm,
      )
    }
    expect([...stoneStock].every((stones) => stones === config.stonesPerSpot)).toBe(true)
  })

  it('draws craft from a stream of its own, leaving the other skills as they were', () => {
    const born = createValley({ craftSkillMinPercent: 50, craftSkillMaxPercent: 150, skillMinPercent: 90 })
    expect(drawSkills(born.config)).toEqual(drawSkills({ ...born.config, craftSkillMinPercent: 100 }))
    expect(new Set(born.foragers.map((forager) => forager.craftSkill)).size).toBeGreaterThan(1)
  })

  it('gives each tree its logs and starts craft at half for those who have never made an axe', () => {
    const state = createValley()
    expect([...state.treeLogs].every((logs) => logs === state.config.logsPerTree)).toBe(true)
    expect(state.foragers.every((forager) => forager.craft === 50)).toBe(true)
    expect(createValley({ craftPractice: false }).foragers.every((forager) => forager.craft === 100)).toBe(true)
  })
})

describe('making an axe', () => {
  it('takes fifty hours at craft 100% and costs the extra energy of making', () => {
    const { config } = createValley()
    expect(makeSeconds(config, 100)).toBe(180_000)
    expect(makeSeconds(config, 50)).toBe(360_000)
    expect(askOf(config, 50)).toBe(6_000)
    expect(askOf(config, 100)).toBe(3_000)
    expect(expectedQuality(50)).toBe(37)
    expect(axeLife(config, 45)).toBe(90)
    expect(axeLife(config, 1)).toBe(2)
    expect(axeLife({ ...config, axeLogs: 40 }, 1)).toBe(1)
  })

  it('fetches a stone first, when a member with no need has no axe for its hut', () => {
    const after = stepValley(band(TEN_AM))
    expect(lastEventOf(after, 0)).toMatchObject({ reason: 'fetching a stone', task: 'stone' })
  })

  it('begins at its hearth with a stone and wood, which go into the axe', () => {
    const state = band(TEN_AM)
    giveStone(state, state.foragers[0]!)
    const after = stepValley(state)
    const forager = after.foragers[0]!
    expect(lastEventOf(after, 0)).toMatchObject({ reason: 'making an axe', task: 'make', workSeconds: 60 })
    // Its stone and a kilogram of wood went into the axe; the fire, empty by day, took 12 kg of the rest.
    expect(forager).toMatchObject({ stone: 0, wood: 11, making: { worked: 60, needed: 360_000, forSale: false } })
    expect(after.totals).toMatchObject({ stonesWorked: 1, axeWood: 1 })
  })

  it('keeps its work when interrupted, and finishes an axe of quality between half its craft and its craft', () => {
    const state = band(TEN_AM)
    state.foragers[0]!.making = { worked: 360_000 - 30, needed: 360_000, forSale: false }
    state.totals.stonesWorked += 1
    state.totals.axeWood += 1
    state.totals.initialWood += 1
    giveStone(state, state.foragers[1]!)
    state.foragers[1]!.stone -= 1
    const after = stepValley(state)
    const forager = after.foragers[0]!
    expect(lastEventOf(after, 0)).toMatchObject({ workSeconds: 30, standSeconds: 30 })
    expect(forager.making).toBeNull()
    expect(forager.axe!.quality).toBeGreaterThanOrEqual(25)
    expect(forager.axe!.quality).toBeLessThanOrEqual(50)
    expect(forager.axe!.logsLeft).toBe(axeLife(after.config, forager.axe!.quality))
    expect(after.lastAxeEvents).toContainEqual(expect.objectContaining({ kind: 'made', foragerId: 0, forSale: false }))
  })
})

describe('cutting and building', () => {
  /** Member 0 standing at tree 0 with an axe of quality `quality` and its cut `remainder` along. */
  function atTree(quality: number, remainder: number, logsLeft?: number) {
    const state = band(TEN_AM)
    const forager = state.foragers[0]!
    forager.axe = axe(state, 0, quality, logsLeft)
    state.totals.stonesWorked += 1
    state.totals.axeWood += 1
    state.totals.initialWood += 1
    giveStone(state, state.foragers[1]!)
    state.foragers[1]!.stone -= 1
    forager.x = state.layout.trees.x[0]!
    forager.y = state.layout.trees.y[0]!
    forager.chopRemainder = remainder
    return state
  }

  it('cuts at a speed its axe’s quality sets', () => {
    const after = stepValley(atTree(80, 0))
    expect(lastEventOf(after, 0)).toMatchObject({ reason: 'cutting a log', task: 'cut', treeId: 0, workSeconds: 60 })
    expect(after.foragers[0]!.chopRemainder).toBe(60 * 80)
  })

  it('takes a log off when the cut is done, and wears its axe by one log', () => {
    const after = stepValley(atTree(100, logCut(createValley().config) - 6_000))
    expect(after.foragers[0]).toMatchObject({ log: 1, chopRemainder: 0, axe: { logsLeft: 199 } })
    expect(after.treeLogs[0]).toBe(2)
    expect(lastEventOf(after, 0)).toMatchObject({ cutLog: true })
  })

  it('fells a standing tree whole with its first log, bringing its branches down, and cuts the rest where it lies', () => {
    const state = atTree(100, logCut(createValley().config) - 6_000)
    const branches = state.woodStock[0]!
    const felled = stepValley(state)
    expect(felled.treeFelledMinute[0]).toBe(TEN_AM)
    expect(felled.woodStock[0]).toBe(branches + felled.config.fellWood)
    expect(felled.totals.fellenWood).toBe(felled.config.fellWood)
    expect(felled.lastAxeEvents).toContainEqual(expect.objectContaining({ kind: 'cut', treeId: 0, felled: true }))
    // The next log comes off the trunk where it lies, bringing nothing more down.
    const next = cloneValley(felled)
    const forager = next.foragers[0]!
    forager.log = 0
    next.treeLogs[1]! -= 1
    next.treeFelledMinute[1] = 0
    forager.chopRemainder = logCut(next.config) - 6_000
    const after = stepValley(next)
    expect(after.treeLogs[0]).toBe(1)
    expect(after.treeFelledMinute[0]).toBe(TEN_AM)
    expect(after.lastAxeEvents).toContainEqual(expect.objectContaining({ kind: 'cut', treeId: 0, felled: false }))
  })

  it('finishes a felled tree before felling a nearer one', () => {
    const state = atTree(100, 0)
    const forager = state.foragers[0]!
    const { trees } = state.layout
    // Tree 1 lies felled with logs left; tree 0, where the forager stands, still stands.
    state.treeLogs[1]! -= 1
    state.treeFelledMinute[1] = 0
    forager.logMemory.stock.set(state.treeLogs)
    expect(Math.hypot(trees.x[1]! - forager.x, trees.y[1]! - forager.y)).toBeGreaterThan(0)
    expect(lastEventOf(stepValley(state), 0)).toMatchObject({ task: 'cut', treeId: 1 })
  })

  it('throws away an axe with no logs left, losing the cut so far', () => {
    const after = stepValley(atTree(100, logCut(createValley().config) - 6_000, 1))
    expect(after.foragers[0]).toMatchObject({ log: 1, axe: null, chopRemainder: 0 })
    expect(after.lastAxeEvents).toContainEqual(expect.objectContaining({ kind: 'worn', foragerId: 0 }))
  })

  it('takes a log home before anything else, and lays it in a hut it begins at its hearth', () => {
    const state = band(TEN_AM)
    const forager = state.foragers[0]!
    forager.log = 1
    state.treeLogs[0]! -= 1
    state.totals.logsCut += 1
    forager.x += 500
    const walking = stepValley(state)
    expect(lastEventOf(walking, 0)).toMatchObject({ reason: 'taking a log home', loadLog: 1, laidLog: true })
    expect(walking.huts).toEqual([
      {
        id: 0,
        builderId: 0,
        x: forager.hearth.x,
        y: forager.hearth.y,
        logs: 1,
        begunMinute: TEN_AM,
        abandonedMinute: null,
      },
    ])
    expect(walking.foragers[0]).toMatchObject({ log: 0, hutId: 0 })
  })

  it('takes up its spare when its hut needs logs and it holds no axe', () => {
    const state = band(TEN_AM)
    state.foragers[0]!.spareAxe = axe(state, 0, 60)
    state.totals.stonesWorked += 1
    state.totals.axeWood += 1
    state.totals.initialWood += 1
    giveStone(state, state.foragers[1]!)
    state.foragers[1]!.stone -= 1
    const after = stepValley(state)
    expect(after.foragers[0]).toMatchObject({ spareAxe: null, axe: { quality: 60 } })
  })
})

describe('huts', () => {
  it('keeps a member asleep in its whole hut a little warm with the fire out, and leaves one without a hut cold', () => {
    const state = band(EIGHT_PM)
    giveHut(state, state.foragers[0]!)
    giveHut(state, state.foragers[1]!, 9)
    const after = stepValley(state)
    expect(lastEventOf(after, 0)).toMatchObject({ inHut: true, sleptCold: false, warmth: 'hut' })
    expect(lastEventOf(after, 1)).toMatchObject({ inHut: false, sleptCold: true, warmth: 'cold' })
    expect(after.foragers[0]!.hutSleepMinutes).toBe(1)
  })

  it('warms a member most in its whole hut by a lit fire', () => {
    const state = band(EIGHT_PM)
    giveHut(state, state.foragers[0]!)
    state.groups[0]!.fireWood = 12
    state.totals.initialWood += 12
    const after = stepValley(state)
    expect(lastEventOf(after, 0)).toMatchObject({ inHut: true, warmth: 'fire and hut' })
    expect(lastEventOf(after, 1)).toMatchObject({ inHut: false, warmth: 'fire' })
    const { config } = after
    expect(sleepCostOf(config, 'fire and hut')).toBeLessThan(sleepCostOf(config, 'fire'))
    expect(sleepCostOf(config, 'fire')).toBeLessThan(sleepCostOf(config, 'hut'))
    expect(sleepCostOf(config, 'hut')).toBeLessThan(sleepCostOf(config, 'cold'))
  })

  it('puts the huts on rings round the fire: eight on the first, sixteen further out on the second', () => {
    const { config } = createValley()
    const flag = { x: 30_000, y: 30_000 }
    const from = (slot: number) => {
      const hut = hearthAround(config, flag, slot)
      return Math.hypot(hut.x - flag.x, hut.y - flag.y)
    }
    for (let slot = 0; slot < 8; slot += 1) expect(Math.abs(from(slot) - config.hutRingCm)).toBeLessThan(2)
    for (let slot = 8; slot < 24; slot += 1) expect(Math.abs(from(slot) - 2 * config.hutRingCm)).toBeLessThan(2)
  })

  it('leaves a member with a whole hut to explore or rest instead of building', () => {
    const state = band(TEN_AM)
    giveHut(state, state.foragers[0]!)
    expect(lastEventOf(stepValley(state), 0)!.task).toBeNull()
  })

  it('weathers each hut by a log on its day', () => {
    const state = band(60 * 1_440)
    giveHut(state, state.foragers[0]!)
    giveHut(state, state.foragers[3]!)
    const after = stepValley(state)
    const whole = state.config.hutLogs
    expect(after.huts[0]!.logs).toBe(whole - 1)
    expect(after.huts[1]!.logs).toBe(whole)
    expect(after.totals.rottedLogs).toBe(1)
    expect(after.lastHutEvents).toEqual([{ kind: 'weather', minute: 60 * 1_440, hutId: 0, logsAfter: whole - 1 }])
  })

  it('leaves a hut behind when its builder’s hearth moves', () => {
    const state = band(TEN_AM)
    giveHut(state, state.foragers[0]!, 4)
    state.foragers[0]!.hearth = { x: state.foragers[0]!.hearth.x + 300, y: state.foragers[0]!.hearth.y }
    const after = stepValley(state)
    expect(after.foragers[0]!.hutId).toBeNull()
    expect(after.huts[0]).toMatchObject({ logs: 4, abandonedMinute: TEN_AM })
    expect(after.lastHutEvents[0]).toMatchObject({ kind: 'abandon', hutId: 0, foragerId: 0, logs: 4 })
  })

  it('grows a stump back into a whole tree at the first midnight 20 years after it fell', () => {
    const state = band(7_300 * 1_440 - 1)
    state.treeLogs[0] = 0
    state.treeFelledMinute[0] = 0
    state.totals.logsCut += 3
    // Tree 1 fell later and still lies with a log: neither grows back yet.
    state.treeLogs[1] = 1
    state.treeFelledMinute[1] = 10
    state.totals.logsCut += 2
    const after = stepValley(stepValley(state))
    expect(after.treeLogs[0]).toBe(3)
    expect(after.treeFelledMinute[0]).toBe(-1)
    expect(after.treeLogs[1]).toBe(1)
    expect(after.totals.regrownLogs).toBe(3)
  })

  it('gathers sticks from a bush as firewood', () => {
    const state = cloneValley(createValley())
    state.minute = TEN_AM
    const forager = state.foragers[0]!
    forager.x = state.layout.bushes.x[0]!
    forager.y = state.layout.bushes.y[0]!
    const after = stepValley(state)
    expect(lastEventOf(after, 0)).toMatchObject({
      reason: 'gathering',
      workedFor: 'wood',
      plantId: state.layout.trees.count,
    })
  })

  it('drops dead branches under standing trees only, and grows sticks on bushes', () => {
    const state = cloneValley(createValley())
    const trees = state.layout.trees.count
    state.woodStock.fill(0)
    state.treeFelledMinute[1] = 0
    // 5 kg a year falls a kilogram at a time, the first in hour 1,751; the first of a bush's 2 kg a decade in hour 43,799.
    expect(regrowWood(state, 1_750)).toBe(0)
    expect(regrowWood(state, 1_751)).toBe(trees - 1)
    expect(state.woodStock[0]).toBe(1)
    expect(state.woodStock[1]).toBe(0)
    expect(state.woodStock[trees]).toBe(0)
    expect(regrowWood(state, 43_799)).toBe(trees - 1 + state.layout.bushes.count)
    expect(state.woodStock[0]).toBe(2)
    expect(state.woodStock[trees]).toBe(1)
  })
})

describe('trading axes', () => {
  /** At night, every member asleep at its hearth: member 1 a practised maker with a whole hut, member 0 needing an axe. */
  function night(overrides: Partial<ValleyConfig> = {}) {
    const state = band(EIGHT_PM, overrides)
    const maker = state.foragers[1]!
    maker.craft = 100
    giveHut(state, maker)
    return state
  }

  it('values an axe at its own cost, scaled by quality over what it would make', () => {
    const state = night()
    expect(worthTo(state.config, state.foragers[0]!, 37)).toBe(6_000)
    expect(worthTo(state.config, state.foragers[0]!, 50)).toBe(8_108)
  })

  it('draws a promise from the cheapest maker that would gain the asker one', () => {
    const after = stepValley(night())
    expect(after.lastAxeEvents).toContainEqual({
      kind: 'promise',
      minute: EIGHT_PM,
      promiserId: 1,
      askerId: expect.any(Number) as number,
      ask: 3_000,
      quality: 75,
    })
    expect(after.foragers[1]!.promised).toBe(true)
  })

  it('sells a spare for food when both gain, at the midpoint of ask and worth', () => {
    const state = night()
    const maker = state.foragers[1]!
    maker.spareAxe = axe(state, 1, 50)
    state.totals.stonesWorked += 1
    state.totals.axeWood += 1
    state.totals.initialWood += 1
    giveStone(state, state.foragers[2]!)
    state.foragers[2]!.stone -= 1
    for (const forager of state.foragers) if (forager.id !== 1) forager.axe = null
    // A full reserve, so it keeps the food it carries; and a seller with room to eat the price.
    state.totals.initialKcal += 6_000 + state.config.reserveMaxKcal - state.foragers[0]!.energyKcal
    state.foragers[0]!.energyKcal = state.config.reserveMaxKcal
    state.foragers[0]!.carried = [{ food: 'berries' as const, kcal: 6_000, harvestTick: EIGHT_PM - 60 }]
    state.totals.initialKcal -= maker.energyKcal - 60_000
    maker.energyKcal = 60_000
    const after = stepValley(state)
    const sale = after.lastAxeEvents.find((made) => made.kind === 'sale')
    expect(sale).toMatchObject({ sellerId: 1, ask: 3_000 })
    expect(sale!.kind === 'sale' && sale!.price).toBe(Math.floor((3_000 + (sale as { worth: number }).worth) / 2))
    expect(after.foragers[1]!.spareAxe).toBeNull()
  })

  it('sells nothing when the buyer cannot pay', () => {
    const state = night()
    state.foragers[1]!.spareAxe = axe(state, 1, 50)
    state.totals.stonesWorked += 1
    state.totals.axeWood += 1
    state.totals.initialWood += 1
    giveStone(state, state.foragers[2]!)
    state.foragers[2]!.stone -= 1
    const after = stepValley(state)
    expect(after.lastAxeEvents.some((made) => made.kind === 'sale')).toBe(false)
    expect(after.foragers[0]!.heardAsk).toMatchObject({ sellerId: 1, ready: true, price: 3_000 })
  })

  it('asks, promises and sells nothing with trade off or outside a group', () => {
    expect(stepValley(night({ axeTrade: false })).lastAxeEvents).toEqual([])
    const scattered = cloneValley(createValley())
    expect(exchangeAxes(scattered, scattered.foragers[0]!, 0)).toEqual([])
  })
})

describe('theory', () => {
  it('prices an axe at the extra energy of making', () => {
    const theory = valleyTheory(createValley().config)
    expect(theory.axeAsk(50)).toBe(6_000)
    expect(theory.firstAxeHours).toBe(100)
    expect(theory.logsOnOffer).toBe(432)
    expect(theory.logsRegrownPerDay).toBeCloseTo(432 / 7_300, 10)
    expect(theory.hutLogsPerMemberDay).toBeCloseTo(1 / 60, 10)
    expect(theory.woodOnOffer).toBe(7_440)
    expect(theory.woodRegrownPerYear).toBeCloseTo(1_104, 10)
  })

  it('feeds about seven from berries, nuts and the lake at its most productive', () => {
    const theory = valleyTheory(createValley().config)
    expect(theory.yearlyBerriesKcal).toBe(1_728_000)
    expect(theory.yearlyNutsKcal).toBe(4_800_000)
    expect(theory.yearlyFishKcal).toBe(180_000)
    expect(theory.yearlyRegrowthKcal).toBe(6_708_000)
    expect(theory.carryingCapacity(2_500)).toBeCloseTo(7.35, 2)
    expect(theory.initialFoodKcal).toBe(99_840 + 2_400_000 + 1_800_000)
    // At full rates of 1,200, 3,500 and 600, a bush is worth working down to a sixth, a hazel to 6% and the lake to a third.
    expect(theory.worthWorkingBelow(1_200)).toBeCloseTo(1 / 6, 10)
    expect(theory.worthWorkingBelow(3_500)).toBeCloseTo(0.057, 3)
    expect(theory.worthWorkingBelow(600)).toBeCloseTo(1 / 3, 10)
  })
})

describe('the checker', () => {
  function damaged(base: ValleyState, damage: (after: ValleyState) => void) {
    const checker = new ValleyChecker(base)
    const after = stepValley(base)
    damage(after)
    return checker.check(after).join('\n')
  }

  it('finds nothing wrong in sound minutes', () => {
    expect(damaged(band(TEN_AM), () => {})).toBe('')
    const state = band(EIGHT_PM)
    giveHut(state, state.foragers[0]!)
    expect(damaged(state, () => {})).toBe('')
  })

  it('catches a tree felled or stood up again without a record', () => {
    expect(damaged(band(TEN_AM), (after) => (after.treeFelledMinute[0] = TEN_AM))).toMatch('without a record')
  })

  it('catches a log or stone lost or made from nothing', () => {
    expect(damaged(band(TEN_AM), (after) => (after.treeLogs[0]! -= 1))).toMatch('logs are not conserved')
    expect(damaged(band(TEN_AM), (after) => (after.stoneStock[0]! += 1))).toMatch('stones are not conserved')
  })

  it('catches a hut that grows without its builder laying a log', () => {
    const state = band(TEN_AM)
    giveHut(state, state.foragers[0]!, 4)
    expect(damaged(state, (after) => (after.huts[0] = { ...after.huts[0]!, logs: 5 }))).toMatch(
      'changed without a record',
    )
  })

  it('catches an axe of impossible quality', () => {
    const state = band(TEN_AM)
    state.foragers[0]!.making = { worked: 360_000 - 30, needed: 360_000, forSale: false }
    state.totals.stonesWorked += 1
    state.totals.axeWood += 1
    state.totals.initialWood += 1
    giveStone(state, state.foragers[1]!)
    state.foragers[1]!.stone -= 1
    expect(
      damaged(state, (after) => {
        const made = after.lastAxeEvents.find((event) => event.kind === 'made')!
        if (made.kind === 'made') made.axe = { ...made.axe, quality: 90 }
      }),
    ).toMatch('out of its maker')
  })
})
