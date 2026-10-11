import { addLots, carriedKcal, takeOldest } from './food'
import { spareWood, wantedWood, woodMatters } from './wood'
import { sameTile } from './world'
import type { Forager, LifeConfig, QuoteEvent, SwapEvent } from './types'

/**
 * A forager's own terms: what a unit of wood costs it in food, `g / w` kilocalories, since an hour of its work makes
 * either. Every comparison is made exactly by cross-multiplying whole numbers.
 */
export const ownTerms = (forager: Forager) => forager.forageRate / forager.woodRate

/** Negative when `a`'s own terms are lower than `b`'s: `a` is relatively better at gathering wood. */
export const compareOwnTerms = (a: Forager, b: Forager) => a.forageRate * b.woodRate - b.forageRate * a.woodRate

/** The midpoint of two foragers' own terms, rounded down, in whole kilocalories per unit of wood. */
export const pairTerms = (seller: Forager, buyer: Forager) =>
  Math.floor(
    (seller.forageRate * buyer.woodRate + buyer.forageRate * seller.woodRate) / (2 * seller.woodRate * buyer.woodRate),
  )

/** Both gain at these terms only if they lie strictly between the seller's own terms and the buyer's. */
export const bothGain = (seller: Forager, buyer: Forager, kcalPerWood: number) =>
  kcalPerWood * seller.woodRate > seller.forageRate && kcalPerWood * buyer.woodRate < buyer.forageRate

/** At these terms, an hour of gathering would buy the forager more food than an hour of foraging. */
export const sellingPays = (forager: Forager, kcalPerWood: number) =>
  forager.woodRate * kcalPerWood > forager.forageRate

/** Room in a forager's reserve for food, counting what it already carries. */
export const roomKcal = (config: LifeConfig, forager: Forager) =>
  Math.max(0, config.reserveMaxKcal - forager.energyKcal - carriedKcal(forager.carried))

/** At these terms, an hour of foraging would buy the forager more wood than an hour of gathering. */
export const buyingPays = (forager: Forager, kcalPerWood: number) => forager.forageRate > forager.woodRate * kcalPerWood

/** The terms a forager remembers, if swapping is on and it heard them within `termsMemoryHours`. */
export function knownTerms(config: LifeConfig, forager: Forager, tick: number) {
  const heard = forager.heardTerms
  if (!config.swapping || !heard || tick - heard.tick > config.termsMemoryHours) return null
  return heard.kcalPerWood
}

/**
 * Who a forager trades with, in order, among the living foragers on its tile. With spare wood it offers to those that
 * want wood and whose own terms are higher, the highest first; wanting wood, it asks those with spare wood and lower own
 * terms, the lowest first. Ties go to the lowest ID.
 */
export function tradePartners(config: LifeConfig, trader: Forager, foragers: readonly Forager[]) {
  const selling = spareWood(config, trader) > 0
  const buying = wantedWood(config, trader) > 0
  if (!selling && !buying) return { selling, partners: [] }
  const partners = foragers.filter(
    (other) =>
      other.alive &&
      other.id !== trader.id &&
      sameTile(other.position, trader.position) &&
      (selling
        ? wantedWood(config, other) > 0 && compareOwnTerms(other, trader) > 0
        : spareWood(config, other) > 0 && compareOwnTerms(other, trader) < 0),
  )
  partners.sort((a, b) => (selling ? compareOwnTerms(b, a) : compareOwnTerms(a, b)) || a.id - b.id)
  return { selling, partners }
}

/** How much wood a pair can swap at these terms: limited by spare, want, the buyer's food and the seller's room. */
export const swapWood = (config: LifeConfig, seller: Forager, buyer: Forager, kcalPerWood: number) =>
  Math.min(
    spareWood(config, seller),
    wantedWood(config, buyer),
    Math.floor(carriedKcal(buyer.carried) / kcalPerWood),
    Math.floor(roomKcal(config, seller) / kcalPerWood),
  )

/**
 * The trader swaps with its partners in turn. `foragers` are this hour's copies; partners and everyone who hears terms
 * are updated in it. With quotes on, a pair that could both gain remembers the terms even if it cannot swap now.
 * Everyone living on the tile hears the terms of a swap.
 */
export function swap(config: LifeConfig, trader: Forager, foragers: Forager[], tick: number) {
  let current = trader
  const swaps: SwapEvent[] = []
  const quotes: QuoteEvent[] = []
  if (!config.swapping || !woodMatters(config)) return { trader: current, swaps, quotes }
  const { selling, partners } = tradePartners(config, current, foragers)
  const hear = (forager: Forager, kcalPerWood: number): Forager => ({ ...forager, heardTerms: { kcalPerWood, tick } })
  for (const { id } of partners) {
    const partner = foragers[id]!
    const seller = selling ? current : partner
    const buyer = selling ? partner : current
    const kcalPerWood = pairTerms(seller, buyer)
    if (!bothGain(seller, buyer, kcalPerWood)) continue
    const wood = swapWood(config, seller, buyer, kcalPerWood)
    if (wood < 1) {
      if (config.quotes) {
        quotes.push({ kind: 'quote', tick, sellerId: seller.id, buyerId: buyer.id, kcalPerWood })
        current = hear(current, kcalPerWood)
        foragers[id] = hear(partner, kcalPerWood)
      }
      continue
    }
    const kcal = wood * kcalPerWood
    const { taken, rest } = takeOldest(buyer.carried, kcal)
    const traded = {
      seller: {
        ...seller,
        wood: seller.wood - wood,
        carried: addLots(seller.carried, taken),
        swapTotals: {
          ...seller.swapTotals,
          woodSold: seller.swapTotals.woodSold + wood,
          kcalReceived: seller.swapTotals.kcalReceived + kcal,
        },
      },
      buyer: {
        ...buyer,
        wood: buyer.wood + wood,
        carried: rest,
        swapTotals: {
          ...buyer.swapTotals,
          woodBought: buyer.swapTotals.woodBought + wood,
          kcalPaid: buyer.swapTotals.kcalPaid + kcal,
        },
      },
    }
    current = hear(selling ? traded.seller : traded.buyer, kcalPerWood)
    foragers[id] = selling ? traded.buyer : traded.seller
    for (const other of foragers)
      if (other.alive && other.id !== current.id && sameTile(other.position, current.position))
        foragers[other.id] = hear(foragers[other.id]!, kcalPerWood)
    swaps.push({
      kind: 'swap',
      tick,
      tile: { ...current.position },
      sellerId: seller.id,
      buyerId: buyer.id,
      wood,
      kcal,
      kcalPerWood,
      sellerWoodBefore: seller.wood,
      sellerRoomKcal: roomKcal(config, seller),
      buyerWoodBefore: buyer.wood,
      buyerCarriedKcal: carriedKcal(buyer.carried),
    })
    const done = selling
      ? !spareWood(config, current) || !roomKcal(config, current)
      : !wantedWood(config, current) || !carriedKcal(current.carried)
    if (done) break
  }
  return { trader: current, swaps, quotes }
}
