import { MINUTES_PER_DAY } from './calendar'
import type { ValleyConfig } from './types'

/** A person's age in thousandths of a year at `minute`; year-anchored. */
export const ageMilli = (config: Pick<ValleyConfig, 'daysPerYear'>, birthMinute: number, minute: number) =>
  Math.floor((1_000 * (minute - birthMinute)) / (MINUTES_PER_DAY * config.daysPerYear))

/** Whole years of an age in thousandths. */
export const ageYears = (age: number) => Math.floor(age / 1_000)

/**
 * A table indexed by whole years from `first`, interpolated linearly within the year by the thousandths and rounded
 * down; before its first year it takes the first entry, past its end the last.
 */
export function atAge(table: readonly number[], age: number, first = 0) {
  const years = ageYears(age) - first
  if (years < 0) return table[0]!
  if (years >= table.length - 1) return table.at(-1)!
  const low = table[years]!,
    high = table[years + 1]!
  return low + Math.floor(((high - low) * (age % 1_000)) / 1_000)
}

/** How far from their hearth a person of this age may choose a target, in cm; -1 for no limit. */
export function rangeAt(config: Pick<ValleyConfig, 'rangeByAge'>, age: number) {
  const table = config.rangeByAge
  if (!table.length || ageYears(age) - 3 >= table.length) return -1
  return atAge(table, age, 3)
}

/** Every per-mille factor of age that the body follows. */
export function ageFactors(config: ValleyConfig, age: number) {
  return {
    weight: atAge(config.growthByAge.weight, age),
    height: atAge(config.growthByAge.height, age),
    grip: atAge(config.growthByAge.grip, age),
    metabolism: atAge(config.metabolismByAge, age),
    walk: atAge(config.walkByAge, age),
    work: atAge(config.workByAge, age),
  }
}

/** Whether a body of this age still grows: every factor reaches its adult value at the tables' last year. */
export const growing = (config: ValleyConfig, age: number) =>
  ageYears(age) < Math.max(config.growthByAge.weight.length, config.metabolismByAge.length, config.workByAge.length) - 1

/**
 * A child's day of food: `storeKcalPerDay` for their grown weight and metabolism. Used for a parent's family food
 * target and store target.
 */
export const dayNeed = (config: ValleyConfig, grownWeightKg: number, age: number) =>
  Math.floor(
    (config.storeKcalPerDay * grownWeightKg * atAge(config.metabolismByAge, age)) / (config.referenceBodyKg * 1_000),
  )

/** The yearly hazard of a death drawn at this age, per million. */
export const deathHazard = (config: ValleyConfig, age: number) =>
  config.deathPerMillionByAge[Math.min(ageYears(age), config.deathPerMillionByAge.length - 1)]!
