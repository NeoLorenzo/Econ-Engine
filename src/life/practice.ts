import type { Forager, LifeConfig, PracticeEvent, PracticeLog, TaskHours } from './types'

const sum = (hours: readonly number[]) => hours.reduce((total, value) => total + value, 0)

/**
 * A practice percentage from the hours spent at a task over the last `practiceDays` days: the minimum with no hours,
 * rising towards the maximum, half way at `practiceHalfHours`, rounded down.
 */
export const practicePercent = (config: LifeConfig, hours: number) =>
  config.practiceMinPercent +
  Math.floor(((config.practiceMaxPercent - config.practiceMinPercent) * hours) / (hours + config.practiceHalfHours))

/** A forager's practice percentages, from its log; 100 at both tasks with practice off. */
export function practicePercents(config: LifeConfig, log: PracticeLog) {
  if (!config.practice) return { forage: 100, gather: 100 }
  return { forage: practicePercent(config, sum(log.forage)), gather: practicePercent(config, sum(log.gather)) }
}

/**
 * A forager's hourly rates: the base rate times its born skill times its practice, rounded down. With practice at
 * 100%, as with practice off, these are Life 3's rates.
 */
export function ratesOf(config: LifeConfig, foragingSkill: number, woodSkill: number, log: PracticeLog) {
  const percent = practicePercents(config, log)
  return {
    forageRate: Math.floor((config.forageKcalPerHour * foragingSkill * percent.forage) / 10_000),
    woodRate: Math.floor((config.woodPerHour * woodSkill * percent.gather) / 10_000),
  }
}

/** The log every forager starts with: `startPracticeHoursPerDay` at each task on every day. */
export function startingLog(config: LifeConfig): PracticeLog {
  const day = () => Array.from({ length: config.practiceDays }, () => config.startPracticeHoursPerDay)
  return { forage: day(), gather: day() }
}

export const noTaskHours = (): TaskHours => ({ forage: 0, gather: 0 })

/**
 * Midnight for one living forager: yesterday's hours enter its log and the oldest day drops out, its rates are set
 * from the log for the new day, and its hours today start again from zero.
 */
export function practiceDay(config: LifeConfig, forager: Forager, tick: number) {
  const added = forager.hoursToday
  const practiceLog: PracticeLog = {
    forage: [...forager.practiceLog.forage.slice(1), added.forage],
    gather: [...forager.practiceLog.gather.slice(1), added.gather],
  }
  const rates = ratesOf(config, forager.foragingSkill, forager.woodSkill, practiceLog)
  const percent = practicePercents(config, practiceLog)
  const event: PracticeEvent = {
    kind: 'practice',
    tick,
    foragerId: forager.id,
    added: { ...added },
    foragePercent: percent.forage,
    woodPercent: percent.gather,
    forageRateBefore: forager.forageRate,
    woodRateBefore: forager.woodRate,
    ...rates,
  }
  return {
    forager: {
      ...forager,
      practiceLog,
      ...rates,
      hoursToday: noTaskHours(),
      loggedHours: {
        forage: forager.loggedHours.forage + added.forage,
        gather: forager.loggedHours.gather + added.gather,
      },
    },
    event,
  }
}
