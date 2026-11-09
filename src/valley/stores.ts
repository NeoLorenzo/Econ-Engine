import { daysToWindow, MINUTES_PER_DAY } from './calendar'
import { carriedKcal, spoil, takeOldest } from './food'
import { traitFactor } from './nature'
import { childrenAtHome } from './kin'
import { ageMilli, dayNeed } from './growth'
import type { FoodLot, Forager, StoredEvent, ValleyConfig, ValleyState } from './types'

/** Every person keeps one store of food at their hearth. Only its owner puts in or takes out; it spoils lot by lot. */

export const storeKcal = (person: Pick<Forager, 'store'>) => carriedKcal(person.store)

/**
 * The food a person plans to store: a day's food for their weight, and from Life 19 their family's day of food
 * (`family`, kcal), from today to the next berry season, scaled by their conscientiousness:
 * `floor(daysToBerries · f_C · (storeKcalPerDay · weightKg + family · referenceBodyKg) / (referenceBodyKg · 1,000))`.
 */
export function storeTarget(
  config: ValleyConfig,
  person: Pick<Forager, 'weightKg' | 'traits'>,
  minute: number,
  family = 0,
) {
  const plans = traitFactor(config.conscientiousnessRule, person.traits.conscientiousness)
  return Math.floor(
    (daysToWindow(config, config.berrySeason, minute) *
      plans *
      (config.storeKcalPerDay * person.weightKg + family * config.referenceBodyKg)) /
      (config.referenceBodyKg * 1_000),
  )
}

/**
 * The day of food a person provides for (Life 19): for each child at home, their day of food for their grown weight
 * and age, less the share their own work earns, `floor(dayNeed · (1,000 − work) / 1,000)`; children under solid-food age
 * only when `babies`. A pregnancy adds `pregnancyKcalPerDay` when `pregnancy` is set.
 */
export function familyDayKcal(
  state: Pick<ValleyState, 'foragers' | 'config'>,
  person: Forager,
  minute: number,
  babies: boolean,
  pregnancy: boolean,
) {
  const { config } = state
  let total = pregnancy && person.pregnancy !== null ? config.pregnancyKcalPerDay : 0
  for (const child of childrenAtHome(state, person)) {
    const age = ageMilli(config, child.birthMinute, minute)
    if (!babies && age < config.solidFoodMilliYears) continue
    total += Math.floor((dayNeed(config, child.weightKg, age) * (1_000 - child.workPerMille)) / 1_000)
  }
  return total
}

/** A person's store target with their family. */
export const familyStoreTarget = (state: Pick<ValleyState, 'foragers' | 'config'>, person: Forager, minute: number) =>
  storeTarget(state.config, person, minute, familyDayKcal(state, person, minute, true, true))

/** Puts every carried nut lot into the person's store, at their hearth. Null when they carry no nuts. */
export function putIntoStore(person: Forager, minute: number): StoredEvent | null {
  const nuts = person.carried.filter((lot) => lot.food === 'nuts')
  if (!nuts.length) return null
  const lots: FoodLot[] = nuts.map((lot) => ({ food: lot.food, kcal: lot.kcal, harvestTick: lot.harvestTick }))
  person.carried = person.carried.filter((lot) => lot.food !== 'nuts')
  person.store = [...person.store, ...lots].sort((a, b) => a.harvestTick - b.harvestTick)
  return {
    kind: 'stored',
    minute,
    foragerId: person.id,
    position: { x: person.x, y: person.y },
    lots,
    storeKcal: storeKcal(person),
  }
}

/** Takes up to `kcal` from the store's oldest lots, marked as from a store. */
export function takeFromStore(person: Forager, kcal: number) {
  const { taken, rest, takenKcal } = takeOldest(person.store, kcal)
  person.store = rest
  return { lots: taken.map((lot): FoodLot => ({ ...lot, fromStore: true })), kcal: takenKcal }
}

/** Drops the stored lots that have spoiled by `minute`, returning their kilocalories. */
export function spoilStore(config: ValleyConfig, person: Forager, minute: number) {
  const spoiled = spoil(config, [...person.store], minute)
  if (spoiled.spoiledKcal) person.store = spoiled.lots
  return spoiled.spoiledKcal
}

/** Days of food a store holds for its owner, at `storeKcalPerDay` scaled by weight. */
export const storeDays = (config: ValleyConfig, person: Pick<Forager, 'weightKg' | 'store'>) =>
  Math.floor((storeKcal(person) * config.referenceBodyKg) / Math.max(1, config.storeKcalPerDay * person.weightKg))

/** The minute of the last midnight at or before `minute`. */
export const lastMidnight = (minute: number) => minute - (minute % MINUTES_PER_DAY)
