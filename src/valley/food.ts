import type { FoodLot } from './types'

/** Carried food is a list of lots, oldest first. Every operation returns new lists and never splits a kilocalorie. */

export const carriedKcal = (lots: readonly FoodLot[]) => lots.reduce((sum, lot) => sum + lot.kcal, 0)

/** Lots harvested at or before `tick − shelfLifeHours` spoil at the start of the holder's turn in hour `tick`. */
export function spoil(lots: FoodLot[], tick: number, shelfLifeHours: number) {
  if (shelfLifeHours === 0 || !lots.length) return { lots, spoiledKcal: 0 }
  const kept = lots.filter((lot) => lot.harvestTick > tick - shelfLifeHours)
  return kept.length === lots.length
    ? { lots, spoiledKcal: 0 }
    : { lots: kept, spoiledKcal: carriedKcal(lots) - carriedKcal(kept) }
}

/** Takes up to `kcal` from the oldest lots first. Taken lots keep their harvest tick. */
export function takeOldest(lots: readonly FoodLot[], kcal: number) {
  const taken: FoodLot[] = []
  const rest: FoodLot[] = []
  let wanted = Math.max(0, kcal)
  for (const lot of lots) {
    const part = Math.min(wanted, lot.kcal)
    wanted -= part
    if (part > 0) taken.push({ kcal: part, harvestTick: lot.harvestTick })
    if (lot.kcal > part) rest.push(part > 0 ? { kcal: lot.kcal - part, harvestTick: lot.harvestTick } : lot)
  }
  return { taken, rest, takenKcal: carriedKcal(taken) }
}

/** Adds lots to a list, keeping it oldest first; lots with the same harvest tick keep their order. */
export function addLots(lots: FoodLot[], added: readonly FoodLot[]) {
  if (!added.length) return lots
  return [...lots, ...added].sort((a, b) => a.harvestTick - b.harvestTick)
}
