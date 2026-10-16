import { addLots, carriedKcal, takeOldest } from './food'
import { distanceSq } from './geometry'
import type { Forager, QuoteEvent, SwapEvent, ValleyConfig } from './types'

// Wood need and the rules of exchange: two foragers within talking distance, members of the same group, swap wood for
// food when both gain, and tell each other the terms when they cannot complete the swap.

export const nightHours = (config: ValleyConfig) => 24 - (config.duskHour - config.dawnHour)

/** The wood a forager burns to sleep warm through one night. */
export const nightWood = (config: ValleyConfig) => nightHours(config) * config.fireWoodPerHour

export const woodTarget = (config: ValleyConfig) => config.woodStockNights * nightWood(config)

/** Wood matters when there are trees and a night without a fire costs more than one with it. */
export const woodMatters = (config: ValleyConfig) =>
  config.standCount * config.treesPerStand > 0 && config.coldSleepKcalPerHour > config.sleepKcalPerHour

export const spareWood = (config: ValleyConfig, forager: Forager) => Math.max(0, forager.wood - woodTarget(config))

export const wantedWood = (config: ValleyConfig, forager: Forager) => Math.max(0, woodTarget(config) - forager.wood)

/** Wood need with hysteresis: short below one night's wood, until it holds its target. */
export function nextShortOfWood(config: ValleyConfig, wood: number, shortOfWood: boolean) {
  if (!woodMatters(config)) return false
  if (wood < nightWood(config)) return true
  if (wood >= woodTarget(config)) return false
  return shortOfWood
}

/** Room in a forager's reserve for food, counting what it carries. */
export const roomKcal = (config: ValleyConfig, forager: Forager) =>
  Math.max(0, config.reserveMaxKcal - forager.energyKcal - carriedKcal(forager.carried))

/** Negative when `a` is relatively better at gathering wood than `b`. */
export const compareOwnTerms = (a: Forager, b: Forager) => a.forageRate * b.woodRate - b.forageRate * a.woodRate

export const pairTerms = (seller: Forager, buyer: Forager) =>
  Math.floor(
    (seller.forageRate * buyer.woodRate + buyer.forageRate * seller.woodRate) / (2 * seller.woodRate * buyer.woodRate),
  )

export const bothGain = (seller: Forager, buyer: Forager, kcalPerWood: number) =>
  kcalPerWood * seller.woodRate > seller.forageRate && kcalPerWood * buyer.woodRate < buyer.forageRate

export const sellingPays = (forager: Forager, kcalPerWood: number) =>
  forager.woodRate * kcalPerWood > forager.forageRate

export const buyingPays = (forager: Forager, kcalPerWood: number) => forager.forageRate > forager.woodRate * kcalPerWood

/** The terms a forager remembers, if swapping is on and it heard them within `termsMemoryHours`. */
export function knownTerms(config: ValleyConfig, forager: Forager, minute: number) {
  const heard = forager.heardTerms
  if (!heard || minute - heard.minute > 60 * config.termsMemoryHours) return null
  return heard.kcalPerWood
}

/** Whether two foragers stand within talking distance. */
export const withinTalk = (config: ValleyConfig, a: Forager, b: Forager) =>
  distanceSq(a.x, a.y, b.x, b.y) <= config.talkRadiusCm ** 2

/** Whether two foragers may swap and tell terms: only members of the same group. */
export const mayTrade = (a: Forager, b: Forager) => a.groupId !== null && a.groupId === b.groupId

/** A trader's partners, among the living foragers within talking distance that it may trade with. */
export function tradePartners(config: ValleyConfig, trader: Forager, foragers: readonly Forager[]) {
  const selling = spareWood(config, trader) > 0
  const buying = wantedWood(config, trader) > 0
  if (!selling && !buying) return { selling, partners: [] }
  const partners = foragers.filter(
    (other) =>
      other.alive &&
      other.id !== trader.id &&
      mayTrade(other, trader) &&
      withinTalk(config, other, trader) &&
      (selling
        ? wantedWood(config, other) > 0 && compareOwnTerms(other, trader) > 0
        : spareWood(config, other) > 0 && compareOwnTerms(other, trader) < 0),
  )
  partners.sort((a, b) => (selling ? compareOwnTerms(b, a) : compareOwnTerms(a, b)) || a.id - b.id)
  return { selling, partners }
}

export const swapWood = (config: ValleyConfig, seller: Forager, buyer: Forager, kcalPerWood: number) =>
  Math.min(
    spareWood(config, seller),
    wantedWood(config, buyer),
    Math.floor(carriedKcal(buyer.carried) / kcalPerWood),
    Math.floor(roomKcal(config, seller) / kcalPerWood),
  )

/**
 * The trader swaps with its partners in turn. `foragers` are this minute's working copies and are
 * changed in place. Everyone living within talking distance of the trader that may trade with it hears the terms of a
 * swap.
 */
export function swap(config: ValleyConfig, trader: Forager, foragers: Forager[], minute: number) {
  const swaps: SwapEvent[] = []
  const quotes: QuoteEvent[] = []
  if (!woodMatters(config)) return { swaps, quotes }
  const { selling, partners } = tradePartners(config, trader, foragers)
  const hear = (forager: Forager, kcalPerWood: number) => {
    forager.heardTerms = { kcalPerWood, minute }
  }
  for (const partner of partners) {
    const seller = selling ? trader : partner
    const buyer = selling ? partner : trader
    const kcalPerWood = pairTerms(seller, buyer)
    if (!bothGain(seller, buyer, kcalPerWood)) continue
    const wood = swapWood(config, seller, buyer, kcalPerWood)
    if (wood < 1) {
      quotes.push({ kind: 'quote', minute, sellerId: seller.id, buyerId: buyer.id, kcalPerWood })
      hear(trader, kcalPerWood)
      hear(partner, kcalPerWood)
      continue
    }
    const kcal = wood * kcalPerWood
    const made: SwapEvent = {
      kind: 'swap',
      minute,
      position: { x: trader.x, y: trader.y },
      sellerId: seller.id,
      buyerId: buyer.id,
      wood,
      kcal,
      kcalPerWood,
      sellerWoodBefore: seller.wood,
      sellerRoomKcal: roomKcal(config, seller),
      buyerWoodBefore: buyer.wood,
      buyerCarriedKcal: carriedKcal(buyer.carried),
    }
    const { taken, rest } = takeOldest(buyer.carried, kcal)
    seller.carried = addLots(seller.carried, taken)
    buyer.carried = rest
    seller.wood -= wood
    buyer.wood += wood
    seller.swapTotals = {
      ...seller.swapTotals,
      woodSold: seller.swapTotals.woodSold + wood,
      kcalReceived: seller.swapTotals.kcalReceived + kcal,
    }
    buyer.swapTotals = {
      ...buyer.swapTotals,
      woodBought: buyer.swapTotals.woodBought + wood,
      kcalPaid: buyer.swapTotals.kcalPaid + kcal,
    }
    hear(trader, kcalPerWood)
    for (const other of foragers)
      if (other.alive && mayTrade(other, trader) && withinTalk(config, other, trader)) hear(other, kcalPerWood)
    swaps.push(made)
    const done = selling
      ? !spareWood(config, trader) || !roomKcal(config, trader)
      : !wantedWood(config, trader) || !carriedKcal(trader.carried)
    if (done) break
  }
  return { swaps, quotes }
}
