import { daysToWindow, MINUTES_PER_DAY } from './calendar'
import { carriedKcal, spoil, takeOldest } from './food'
import { traitFactor } from './nature'
import type { FoodLot, Forager, StoredEvent, ValleyConfig } from './types'

/** Every person keeps one store of food at their hearth. Only its owner puts in or takes out; it spoils lot by lot. */

export const storeKcal = (person: Pick<Forager, 'store'>) => carriedKcal(person.store)

/**
 * The food a person plans to store: a day's food for their weight from today to the next berry season, scaled by
 * their conscientiousness, `floor(storeKcalPerDay · weightKg · daysToBerries · f_C / (referenceBodyKg · 1,000))`.
 */
export function storeTarget(config: ValleyConfig, person: Pick<Forager, 'weightKg' | 'traits'>, minute: number) {
  const plans = traitFactor(config.conscientiousnessRule, person.traits.conscientiousness)
  return Math.floor(
    (config.storeKcalPerDay * person.weightKg * daysToWindow(config, config.berrySeason, minute) * plans) /
      (config.referenceBodyKg * 1_000),
  )
}

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
