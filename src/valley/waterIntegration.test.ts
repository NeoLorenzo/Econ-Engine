import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { stepValley, cloneValley } from './engine'
import { ValleyChecker } from './invariants'
import { createSurveyedValley, addTestLake } from './ruleFixtures'
import { foragerPose } from '../valleyView/valleyViewModel'
import { knownDrySegment } from './routes'

function loneBody() {
  const state = createSurveyedValley({ ...FLAT_LAND, bandSize: 1, scattered: true })
  state.minute = 1201
  return state
}

describe('water in the running simulation', () => {
  it('takes fish from one observed body and charges a first attempt at a fishless pool', () => {
    for (const fishMinAreaM2 of [1000, 1001]) {
      const before = createSurveyedValley({ ...FLAT_LAND, bandSize: 1, scattered: true, fishMinAreaM2 })
      before.minute = 601
      const bank = addTestLake(before, true)
      const person = before.foragers[0]!
      Object.assign(person, { x: bank.x, y: bank.y, energyKcal: 60000, hungry: true })
      person.foodMemory.stock.fill(0)
      person.foodMemory.seen.fill(5)
      person.siteKnown.fill(1)
      person.siteChecked.fill(5)
      before.totals.initialKcal -= 6000
      const checker = new ValleyChecker(before)
      const after = stepValley(before)
      const event = after.lastEvents[0]!
      expect(event.fishBodyId).toBe(before.fish[0]!.bodyId)
      expect(after.fish[1]).toEqual(before.fish[1])
      if (fishMinAreaM2 === 1000) expect(event.gatheredKcal).toBeGreaterThan(0)
      else {
        expect(event).toMatchObject({ workSeconds: 1, gatheredKcal: 0 })
        expect(after.foragers[0]!.fishMemory.get(bank.bodyId)).toMatchObject({ capacity: 0, stock: 0 })
      }
      expect(checker.check(after)).toEqual([])
    }
  })

  it('wakes a severely thirsty person, spends seconds drinking and records the external source', () => {
    const before = loneBody()
    const bank = addTestLake(before)
    const person = before.foragers[0]!
    Object.assign(person, {
      x: bank.x,
      y: bank.y,
      hearth: { x: bank.x, y: bank.y },
      waterDeficitMl: 1800,
      waterLostMl: 1800,
      thirsty: true,
    })
    const checker = new ValleyChecker(before)
    const after = stepValley(before)
    const event = after.lastEvents[0]!
    expect(event).toMatchObject({
      reason: 'drinking',
      waterDrunkMl: 600,
      drinkSeconds: 60,
      workSeconds: 0,
      sleepSeconds: 0,
    })
    expect(after.waterWithdrawals.get(bank.bodyId)).toBe(600)
    expect(after.foragers[0]!.waterDeficitMl).toBe(1201)
    expect(after.lastWaterEvents.some((record) => record.kind === 'drink' && record.bodyId === bank.bodyId)).toBe(true)
    expect(checker.check(after)).toEqual([])
    expect(before.foragers[0]!.waterDeficitMl).toBe(1800)
  })

  it('stops at the fatal second with food energy left and never charges the dead body again', () => {
    const before = loneBody()
    Object.assign(before.foragers[0]!, {
      waterDeficitMl: 5999,
      waterLostMl: 5999,
      waterBaseRemainder: 84400,
      thirsty: true,
    })
    const checker = new ValleyChecker(before)
    const after = stepValley(before)
    expect(after.lastEvents[0]).toMatchObject({ inactiveSeconds: 59, waterLostMl: 1 })
    expect(after.lastDeaths[0]).toMatchObject({ cause: 'dehydration', second: 0 })
    expect(after.foragers[0]!.energyKcal).toBeGreaterThan(0)
    expect(checker.check(after)).toEqual([])
    const next = stepValley(after)
    expect(next.foragers[0]!.waterLostMl).toBe(after.foragers[0]!.waterLostMl)
    expect(next.lastEvents).toEqual([])
    expect(checker.check(next)).toEqual([])
  })

  it('records no withdrawal when the final second is spent arriving at a bank', () => {
    const before = createSurveyedValley({
      ...FLAT_LAND,
      bandSize: 1,
      scattered: true,
      walkCmPerSecond: 1,
      loadSlowdownPerMille: 0,
    })
    before.minute = 1201
    const bank = addTestLake(before)
    Object.assign(before.foragers[0]!, {
      x: bank.x + 60,
      y: bank.y,
      waterDeficitMl: 1800,
      waterLostMl: 1800,
      thirsty: true,
    })
    const after = stepValley(before)
    expect(after.lastEvents[0]).toMatchObject({ walkSeconds: 60, drinkSeconds: 0, waterDrunkMl: 0 })
    expect(after.waterWithdrawals.size).toBe(0)
    expect(new ValleyChecker(before).check(after)).toEqual([])
  })

  it('rejects corrupted drink volumes, body identities, fish remainders and death records', () => {
    const before = loneBody()
    const bank = addTestLake(before)
    Object.assign(before.foragers[0]!, {
      x: bank.x,
      y: bank.y,
      hearth: { x: bank.x, y: bank.y },
      waterDeficitMl: 1800,
      waterLostMl: 1800,
      thirsty: true,
    })
    const after = stepValley(before)
    for (const damage of [
      (state: typeof after) => {
        state.lastEvents[0]!.waterDrunkMl += 1
      },
      (state: typeof after) => {
        state.foragers[0]!.knownBanks.set(bank.id, { ...bank, bodyId: -999 })
      },
      (state: typeof after) => {
        state.fish[0]!.remainder += 1
      },
    ]) {
      const broken = structuredClone(after)
      damage(broken)
      expect(new ValleyChecker(before).check(broken).length).toBeGreaterThan(0)
    }
    const fatal = loneBody()
    Object.assign(fatal.foragers[0]!, {
      waterDeficitMl: 5999,
      waterLostMl: 5999,
      waterBaseRemainder: 84400,
      thirsty: true,
    })
    const broken = stepValley(fatal)
    broken.foragers[0]!.deathSecond = 59
    expect(new ValleyChecker(fatal).check(broken).join()).toContain('death record')
  })

  it('interpolates along recorded dry segments rather than across a water corner', () => {
    const before = loneBody()
    const person = before.foragers[0]!
    const after = cloneValley(before)
    const from = { x: 250, y: 250 }
    const corner = { x: 750, y: 250 }
    const to = { x: 750, y: 750 }
    const template = stepValley(before).lastEvents[0]!
    Object.assign(after.foragers[0]!, to)
    after.minute += 1
    after.lastEvents = [
      {
        ...template,
        from,
        position: to,
        walkSeconds: 20,
        segments: [
          { from, to: corner, target: corner, seconds: 10, grade: 0, speed: 50, terrainPercent: 120, rate: 100 },
          { from: corner, to, target: to, seconds: 10, grade: 0, speed: 50, terrainPercent: 120, rate: 100 },
        ],
      },
    ]
    person.groundKnowledge.observed[person.groundKnowledge.cells] = 2
    for (const alpha of [0, 5 / 60, 10 / 60, 15 / 60, 20 / 60]) {
      const pose = foragerPose({ previous: before, next: after, alpha }, 0)
      expect(knownDrySegment(person.groundKnowledge, pose, pose)).toBe(true)
    }
    expect(foragerPose({ previous: before, next: after, alpha: 10 / 60 }, 0)).toMatchObject(corner)
  })
})
