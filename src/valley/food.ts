import type { FoodKind, FoodLot, Forager, ValleyConfig, ValleyLayout } from './types'

/** Negative source IDs encode encountered bank IDs; nonnegative IDs identify food plants. */
export const foodOfSource = (layout: ValleyLayout, source: number): FoodKind =>
  source < 0 ? 'fish' : source < layout.bushes.count ? 'berries' : 'nuts'

/** The most a source holds. */
export const capacityOf = (config: ValleyConfig, food: FoodKind) => {
  if (food === 'fish') throw new Error('Fish capacity requires a particular water body')
  return food === 'berries' ? config.berryThicketCapacityKcal : config.hazelThicketCapacityKcal
}

/** A forager's hourly rate for a food at a full source, for the day. */
export const fullRateOf = (forager: Forager, food: FoodKind) =>
  food === 'berries' ? forager.forageRate : food === 'nuts' ? forager.nutRate : forager.fishRate

/** An hourly rate at a source holding `stock`: the full rate times the share of the source still there, rounded down. */
export const rateAtStock = (config: ValleyConfig, full: number, food: FoodKind, stock: number) => {
  const capacity = capacityOf(config, food)
  return capacity > 0 ? Math.floor((full * stock) / capacity) : 0
}

/** A source is worth working while an hour there brings more than the hour costs. */
export const worthWorking = (config: ValleyConfig, rate: number) => rate > config.pickKcalPerHour

/** Carried food is a list of lots, oldest first. Every operation returns new lists and never splits a kilocalorie. */

export const FOODS: readonly FoodKind[] = ['berries', 'nuts', 'fish']

export const carriedKcal = (lots: readonly FoodLot[]) => lots.reduce((sum, lot) => sum + lot.kcal, 0)

/** The kilocalories of each food in a list of lots. */
export function carriedByFood(lots: readonly FoodLot[]) {
  const kcal = { berries: 0, nuts: 0, fish: 0 }
  for (const lot of lots) kcal[lot.food] += lot.kcal
  return kcal
}

/** Hours a food keeps once taken; 0 means it keeps. */
export const shelfLifeOf = (config: ValleyConfig, food: FoodKind) =>
  food === 'berries'
    ? config.berryShelfLifeHours
    : food === 'nuts'
      ? config.nutShelfLifeHours
      : config.fishShelfLifeHours

/** Kilocalories of a food that weigh a kilogram. */
export const kcalPerKgOf = (config: ValleyConfig, food: FoodKind) =>
  food === 'berries' ? config.berryKcalPerKg : food === 'nuts' ? config.nutKcalPerKg : config.fishKcalPerKg

/**
 * What berries, nuts and fish weigh together, in whole kilograms rounded down once over the total: each food's
 * kilocalories over its kilocalories a kilogram, summed exactly over a common denominator.
 */
export function foodKg(config: ValleyConfig, berriesKcal: number, nutsKcal: number, fishKcal: number) {
  const b = config.berryKcalPerKg
  const n = config.nutKcalPerKg
  const f = config.fishKcalPerKg
  return Math.floor((berriesKcal * n * f + nutsKcal * b * f + fishKcal * b * n) / (b * n * f))
}

/** Whether a lot taken at `harvestTick` has spoiled by minute `minute`. */
export const spoiledBy = (config: ValleyConfig, lot: FoodLot, minute: number) => {
  const hours = shelfLifeOf(config, lot.food)
  return hours > 0 && lot.harvestTick <= minute - 60 * hours
}

/** Minutes from `minute` until the first of the lots spoils, or null if there are none or they all keep. */
export function spoilsIn(config: ValleyConfig, lots: readonly FoodLot[], minute: number) {
  let soonest: number | null = null
  for (const lot of lots) {
    const hours = shelfLifeOf(config, lot.food)
    if (hours === 0) continue
    const left = Math.max(0, lot.harvestTick + 60 * hours - minute)
    if (soonest === null || left < soonest) soonest = left
  }
  return soonest
}

/** Lots that have spoiled by minute `minute`, each by its own food's shelf life, are dropped. */
export function spoil(config: ValleyConfig, lots: FoodLot[], minute: number) {
  if (!lots.some((lot) => spoiledBy(config, lot, minute))) return { lots, spoiledKcal: 0 }
  const kept = lots.filter((lot) => !spoiledBy(config, lot, minute))
  return { lots: kept, spoiledKcal: carriedKcal(lots) - carriedKcal(kept) }
}

/** Takes up to `kcal` from the oldest lots first. Taken lots keep their food and harvest tick. */
export function takeOldest(lots: readonly FoodLot[], kcal: number) {
  const taken: FoodLot[] = []
  const rest: FoodLot[] = []
  let wanted = Math.max(0, kcal)
  for (const lot of lots) {
    const part = Math.min(wanted, lot.kcal)
    wanted -= part
    if (part > 0) taken.push({ food: lot.food, kcal: part, harvestTick: lot.harvestTick })
    if (lot.kcal > part)
      rest.push(part > 0 ? { food: lot.food, kcal: lot.kcal - part, harvestTick: lot.harvestTick } : lot)
  }
  return { taken, rest, takenKcal: carriedKcal(taken) }
}

/** Adds lots to a list, keeping it oldest first; lots with the same harvest tick keep their order. */
export function addLots(lots: FoodLot[], added: readonly FoodLot[]) {
  if (!added.length) return lots
  return [...lots, ...added].sort((a, b) => a.harvestTick - b.harvestTick)
}

export const eatCarried = (lots: FoodLot[], room: number) => {
  const eaten = takeOldest(lots, room)
  return { rest: eaten.rest, takenKcal: eaten.takenKcal }
}
