import type { Forager, PracticeEvent, PracticeLog, TaskSeconds, ValleyConfig } from './types'

export const SECONDS_PER_HOUR = 3_600

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

/**
 * A practice percentage from the seconds spent at a task over the last `practiceDays` days: the minimum with none,
 * rising towards the maximum, half way at `practiceHalfHours`, rounded down. At whole hours it equals Life 4's.
 */
export const practicePercent = (config: ValleyConfig, seconds: number) =>
  config.practiceMinPercent +
  Math.floor(
    ((config.practiceMaxPercent - config.practiceMinPercent) * seconds) /
      (seconds + SECONDS_PER_HOUR * config.practiceHalfHours),
  )

export function practicePercents(config: ValleyConfig, log: PracticeLog) {
  if (!config.practice) return { forage: 100, gather: 100 }
  return { forage: practicePercent(config, sum(log.forage)), gather: practicePercent(config, sum(log.gather)) }
}

/** Hourly rates: the base rate times born skill times practice, rounded down, as in Life 4. */
export function ratesOf(config: ValleyConfig, foragingSkill: number, woodSkill: number, log: PracticeLog) {
  const percent = practicePercents(config, log)
  return {
    forageRate: Math.floor((config.forageKcalPerHour * foragingSkill * percent.forage) / 10_000),
    woodRate: Math.floor((config.woodPerHour * woodSkill * percent.gather) / 10_000),
  }
}

export function startingLog(config: ValleyConfig): PracticeLog {
  const day = () =>
    Array.from({ length: config.practiceDays }, () => config.startPracticeHoursPerDay * SECONDS_PER_HOUR)
  return { forage: day(), gather: day() }
}

export const noTaskSeconds = (): TaskSeconds => ({ forage: 0, gather: 0 })

/** Midnight for one living forager: yesterday's seconds enter its log, the oldest day drops out, and rates are set. */
export function practiceDay(config: ValleyConfig, forager: Forager, minute: number) {
  const added = forager.secondsToday
  const practiceLog: PracticeLog = {
    forage: [...forager.practiceLog.forage.slice(1), added.forage],
    gather: [...forager.practiceLog.gather.slice(1), added.gather],
  }
  const rates = ratesOf(config, forager.foragingSkill, forager.woodSkill, practiceLog)
  const percent = practicePercents(config, practiceLog)
  const event: PracticeEvent = {
    kind: 'practice',
    minute,
    foragerId: forager.id,
    added: { ...added },
    foragePercent: percent.forage,
    woodPercent: percent.gather,
    forageRateBefore: forager.forageRate,
    woodRateBefore: forager.woodRate,
    ...rates,
  }
  forager.practiceLog = practiceLog
  forager.forageRate = rates.forageRate
  forager.woodRate = rates.woodRate
  forager.secondsToday = noTaskSeconds()
  forager.loggedSeconds = {
    forage: forager.loggedSeconds.forage + added.forage,
    gather: forager.loggedSeconds.gather + added.gather,
  }
  return event
}
