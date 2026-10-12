import { describe, expect, it } from 'vitest'
import { LIFE3_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import { createLife, runLifeHours, stepLife } from './engine'
import { life2Seeds, practiceAloneExperiment, woodShare } from './experiments'
import { lifeInvariantViolations } from './invariants'
import { practiceDay, practicePercent, ratesOf, startingLog } from './practice'
import { lifeTheory } from './theory'
import type { LifeConfig, PracticeLog } from './types'

// The canonical Life 4 world: practice over 30 days, from 50% to 150%, half way at 60 hours.
const config: LifeConfig = LIFE_DEFAULT_CONFIG
const log = (forage: number, gather: number): PracticeLog => ({
  forage: Array.from({ length: config.practiceDays }, (_, day) => (day === 0 ? forage : 0)),
  gather: Array.from({ length: config.practiceDays }, (_, day) => (day === 0 ? gather : 0)),
})

describe('practice', () => {
  it('rises from the minimum towards the maximum, half way at practiceHalfHours', () => {
    expect(practicePercent(config, 0)).toBe(50)
    expect(practicePercent(config, 60)).toBe(100)
    expect(practicePercent(config, 30)).toBe(83)
    expect(practicePercent(config, 1_000_000)).toBe(149)
  })

  it('settles at the percentage the hours worked each day give', () => {
    const theory = lifeTheory(config)
    expect([0, 0.5, 1, 2, 3, 4, 6].map(theory.steadyPracticePercent)).toEqual([50, 70, 83, 100, 110, 116, 125])
  })

  it('starts every forager at 100%, Life 3’s equal rates', () => {
    expect(ratesOf(config, 100, 100, startingLog(config))).toEqual({ forageRate: 1_200, woodRate: 24 })
    expect(createLife().foragers.every((f) => f.forageRate === 1_200 && f.woodRate === 24)).toBe(true)
  })

  it('multiplies the base rate by born skill and practice, rounding down', () => {
    // floor(1,200 × 77 × 83 / 10,000) = floor(766.92); floor(24 × 133 × 50 / 10,000) = floor(15.96).
    expect(ratesOf(config, 77, 133, log(30, 0))).toEqual({ forageRate: 766, woodRate: 15 })
  })

  it('gives Life 3’s born rates with practice off, whatever the log', () => {
    const life3 = { ...config, ...LIFE3_WORLD }
    expect(ratesOf(life3, 77, 133, log(30, 0))).toEqual({ forageRate: 924, woodRate: 31 })
  })
})

describe('midnight', () => {
  it('adds yesterday’s hours to the log, drops the oldest day and sets the day’s rates', () => {
    const forager = {
      ...createLife().foragers[0]!,
      hoursToday: { forage: 5, gather: 0 },
      hoursWorked: { forage: 5, gather: 0 },
    }
    const { forager: after, event } = practiceDay(config, forager, 24)
    expect(after.practiceLog.forage).toEqual([...Array(29).fill(2), 5])
    expect(after.practiceLog.gather).toEqual([...Array(29).fill(2), 0])
    // 63 hours foraging give 101%; 58 gathering give 99%.
    expect(after).toMatchObject({ forageRate: 1_212, woodRate: 23, hoursToday: { forage: 0, gather: 0 } })
    expect(after.loggedHours).toEqual({ forage: 5, gather: 0 })
    expect(event).toMatchObject({
      kind: 'practice',
      tick: 24,
      added: { forage: 5, gather: 0 },
      foragePercent: 101,
      woodPercent: 99,
      forageRateBefore: 1_200,
      woodRateBefore: 24,
      forageRate: 1_212,
      woodRate: 23,
    })
  })

  it('changes rates only in the first hour of a day, and leaves the dead alone', () => {
    let state = createLife()
    const dead = { ...state.foragers[1]!, alive: false, energyKcal: 0, deathTick: 0 }
    state = { ...state, foragers: state.foragers.map((forager) => (forager.id === 1 ? dead : forager)) }
    let rates = state.foragers.map((forager) => [forager.forageRate, forager.woodRate])
    let changedAtMidnight = 0
    for (let hour = 0; hour < 72; hour += 1) {
      state = stepLife(state)
      const now = state.foragers.map((forager) => [forager.forageRate, forager.woodRate])
      const changed = now.some((pair, id) => pair[0] !== rates[id]![0] || pair[1] !== rates[id]![1])
      if (changed) {
        expect(hour % 24).toBe(0)
        changedAtMidnight += 1
      }
      expect(state.lastPractice.length).toBe(hour > 0 && hour % 24 === 0 ? 7 : 0)
      rates = now
    }
    expect(changedAtMidnight).toBeGreaterThan(0)
    expect(state.foragers[1]!.practiceLog).toEqual(dead.practiceLog)
    expect(state.foragers[1]!.forageRate).toBe(dead.forageRate)
  })

  it('is caught by the invariants when a rate, an hour or a midnight is wrong', () => {
    const state = runLifeHours(createLife(), 30)
    expect(lifeInvariantViolations(state)).toEqual([])
    const breakForager = (change: object) => ({
      ...state,
      foragers: state.foragers.map((forager) => (forager.id === 0 ? { ...forager, ...change } : forager)),
    })
    const first = state.foragers[0]!
    expect(lifeInvariantViolations(breakForager({ forageRate: first.forageRate + 1 }))).toContain(
      "Forager 0's rates do not match its born skills and practice",
    )
    expect(
      lifeInvariantViolations(
        breakForager({ loggedHours: { ...first.loggedHours, forage: first.loggedHours.forage - 1 } }),
      ),
    ).toContain("Forager 0's forage hours worked do not match its log and its hours today")
    const practice = stepLife(runLifeHours(createLife(), 24)).lastPractice
    expect(lifeInvariantViolations({ ...state, lastPractice: practice })).toContain(
      'Foragers practised other than at midnight',
    )
  })
})

describe('Life 4 experiment 2: practice alone', () => {
  const result = practiceAloneExperiment(life2Seeds(16))

  it('swaps and quotes nothing', () => {
    expect(result.practice.swapsPerRun).toBe(0)
    expect(result.practice.quotesPerRun).toBe(0)
  })

  it('leaves every band undivided', () => {
    for (const run of result.practice.runs) {
      const shares = run.forageHoursById.map((_, id) => woodShare(run, id)!)
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThan(0.05)
      expect(run.termsSpread[100]!).toBeLessThan(1.25)
    }
  })

  it('keeps every band intact', () => {
    expect(result.practice.runs.every((run) => run.survived)).toBe(true)
  })

  it('settles every forager better at foraging and worse at wood, alike', () => {
    for (const run of result.practice.runs) {
      for (const rate of run.forageRates) expect(rate).toBeGreaterThan(1_200)
      for (const rate of run.woodRates) expect(rate).toBeLessThan(24)
    }
    expect(result.practice.coldShare).toBeLessThan(result.withoutPractice.coldShare)
  })
})
