import { randomInt } from '../sim/rng'
import { addLots, carriedKcal, takeOldest } from './food'
import { walkSpeed } from './forager'
import { minuteOfDay } from './calendar'
import { distance } from './geometry'
import { wantsLogs } from './huts'
import { deriveAxeSeed } from './layout'
import { SECONDS_PER_HOUR } from './practice'
import { mayTrade, roomKcal, withinTalk } from './trade'
import type {
  Axe,
  AxeEvent,
  CutEvent,
  Forager,
  HeardAsk,
  MadeEvent,
  SaleEvent,
  ValleyConfig,
  ValleyState,
  WornEvent,
} from './types'

// Life 9's axes: made at the hearth from a stone and wood, at a speed and quality set by craft; worn out by cutting
// logs; and asked for, promised and sold for food between members of a group.

/** Seconds of work an axe takes at craft `craft`: `axeHours · 100 / craft` hours, rounded up. */
export const makeSeconds = (config: ValleyConfig, craft: number) =>
  Math.ceil((SECONDS_PER_HOUR * config.axeHours * 100) / craft)

/**
 * What making an axe costs at craft `craft`, in kilocalories: the extra energy of making instead of resting, for the
 * seconds it takes. It is a maker's asking price.
 */
export const askOf = (config: ValleyConfig, craft: number) =>
  Math.ceil((makeSeconds(config, craft) * (config.makeKcalPerHour - config.restKcalPerHour)) / SECONDS_PER_HOUR)

/** The quality a forager at craft `craft` expects to make: three quarters of its craft, at least 1. */
export const expectedQuality = (craft: number) => Math.max(1, Math.floor((3 * craft) / 4))

/** What an axe of quality `quality` is worth to a forager: its own cost, scaled by quality over what it would make. */
export const worthTo = (config: ValleyConfig, forager: Forager, quality: number) =>
  Math.floor((askOf(config, forager.craft) * quality) / expectedQuality(forager.craft))

/** The logs an axe of quality `quality` cuts before it wears out. */
export const axeLife = (config: ValleyConfig, quality: number) =>
  Math.max(1, Math.floor((config.axeLogs * quality) / 100))

/** The cut a log takes, in seconds times quality. */
export const logCut = (config: ValleyConfig) => 6_000 * config.logChopMinutes

/** A member that needs logs and holds no axe, spare or axe in the making. */
export const needsAxe = (state: Pick<ValleyState, 'huts' | 'config'>, forager: Forager) =>
  wantsLogs(state, forager) && !forager.axe && !forager.spareAxe && !forager.making

/** An ask a forager remembers that makes buying worth it: heard within `termsMemoryHours`, worth more than its price. */
export function usableAsk(state: Pick<ValleyState, 'config'>, forager: Forager, minute: number) {
  const { config } = state
  const heard = forager.heardAsk
  if (!config.axeTrade || !heard || minute - heard.minute > 60 * config.termsMemoryHours) return null
  return worthTo(config, forager, heard.quality) > heard.price ? heard : null
}

/** The price of a sale at an ask and a worth: the midpoint, rounded down. */
export const salePrice = (ask: number, worth: number) => Math.floor((ask + worth) / 2)

export type HutPlan =
  | { kind: 'make' }
  | { kind: 'cut'; treeId: number }
  | { kind: 'stone'; stoneId: number }
  | { kind: 'await axe' }
  | { kind: 'buy food' }
  | { kind: 'await sale' }

/**
 * Rules 7 to 10 for a member with no need: finish an axe begun; cut a log if its hut is not whole and it holds an axe;
 * buy an axe it has heard of, if one is worth it; or make one, for its hut or for a promise, fetching a stone first.
 * Returns null when none applies or finds anything it can reach, so the next rule decides.
 */
export function planHut(
  state: ValleyState,
  forager: Forager,
  minute: number,
  _speed = walkSpeed(state.config, forager),
): HutPlan | null {
  const { config, layout } = state
  if (forager.making) return { kind: 'make' }
  const needLogs = wantsLogs(state, forager)
  const nearest = (kind: number, fallen = false) => {
    let best = -1,
      bestDistance = Infinity
    for (let id = 0; id < layout.places.count; id += 1) {
      if (forager.knownPlaces[id]! < 0 || layout.places.kind[id] !== kind) continue
      const remembered = kind === 2 ? forager.placeLogs[id]! : forager.placeStock[id]!
      const amount = remembered < 0 ? (kind === 2 ? config.standLogs : config.outcropStones) : remembered
      if (amount <= 0 || (kind === 2 && amount < config.standLogs !== fallen)) continue
      const point = { x: layout.places.x[id]!, y: layout.places.y[id]! },
        cm = distance(forager.x, forager.y, point.x, point.y)
      if (cm / Math.max(1, _speed * 60) + 1 > config.duskHour * 60 - minuteOfDay(minute)) continue
      if (cm < bestDistance) {
        best = id
        bestDistance = cm
      }
    }
    return best
  }
  if (needLogs && forager.axe) {
    const fallen = nearest(2, true),
      stand = fallen >= 0 ? fallen : nearest(2)
    if (stand >= 0) return { kind: 'cut', treeId: stand }
  }
  const lacksAxe = needLogs && !forager.axe
  if (lacksAxe) {
    const ask = usableAsk(state, forager, minute)
    if (ask) {
      if (!ask.ready) return { kind: 'await axe' }
      const price = salePrice(ask.price, worthTo(config, forager, ask.quality))
      return carriedKcal(forager.carried) < price ? { kind: 'buy food' } : { kind: 'await sale' }
    }
  }
  if (!lacksAxe && !forager.promised) return null
  if (forager.stone < 1) {
    const spot = nearest(3)
    return spot < 0 ? null : { kind: 'stone', stoneId: spot }
  }
  return forager.wood >= config.axeWood ? { kind: 'make' } : null
}

/**
 * Begins an axe at the hearth: its stone and wood go into it. It is for sale unless the forager needs it for its own
 * hut. Changes the working copies in place.
 */
export function beginAxe(state: ValleyState, forager: Forager) {
  const { config } = state
  forager.stone -= 1
  forager.wood -= config.axeWood
  state.totals.stonesWorked += 1
  state.totals.axeWood += config.axeWood
  forager.making = {
    worked: 0,
    needed: makeSeconds(config, forager.craft),
    forSale: !(wantsLogs(state, forager) && !forager.axe),
  }
}

/**
 * `seconds` of work on the axe being made, no more than it still needs; when done, its quality is drawn from the axe
 * stream, uniformly from half the forager's craft to its craft. Changes the working copies in place; returns the
 * seconds worked and the event of a finished axe.
 */
export function workAxe(state: ValleyState, forager: Forager, seconds: number, minute: number) {
  const { config } = state
  const making = forager.making!
  const worked = Math.min(seconds, making.needed - making.worked)
  forager.secondsToday.make += worked
  forager.secondsWorked.make += worked
  if (making.worked + worked < making.needed) {
    forager.making = { ...making, worked: making.worked + worked }
    return { worked, made: null }
  }
  const low = Math.floor(forager.craft / 2)
  const draw = randomInt(
    deriveAxeSeed(config.seed, forager.axeTotals.madeOwn + forager.axeTotals.madeForSale, forager.id),
    forager.craft - low + 1,
  )
  const quality = Math.max(1, low + draw.value)
  const axe: Axe = {
    id: state.totals.axesMade,
    quality,
    logsLeft: axeLife(config, quality),
    makerId: forager.id,
    madeMinute: minute,
  }
  state.totals.axesMade += 1
  forager.making = null
  if (making.forSale) {
    forager.spareAxe = axe
    forager.promised = false
    forager.axeTotals = { ...forager.axeTotals, madeForSale: forager.axeTotals.madeForSale + 1 }
  } else {
    forager.axe = axe
    forager.axeTotals = { ...forager.axeTotals, madeOwn: forager.axeTotals.madeOwn + 1 }
  }
  const made: MadeEvent = {
    kind: 'made',
    minute,
    foragerId: forager.id,
    axe,
    craft: forager.craft,
    forSale: making.forSale,
  }
  return { worked, made }
}

/**
 * `seconds` cutting at tree `treeId` with the forager's axe: its cut grows by the seconds times the axe's quality, and
 * a log comes off when it reaches a log's cut. The first log cut from a standing tree fells it whole, bringing its
 * crown's `fellWood` of branches down where it lies. An axe with no logs left is thrown away, and the cut so far is
 * lost. Changes the working copies in place; returns the events.
 */
export function cutAt(state: ValleyState, forager: Forager, treeId: number, seconds: number, minute: number) {
  const { config } = state
  const axe = forager.axe!
  if (!axe || state.logStock[treeId]! <= 0) return { cut: null, worn: null }
  let cut: CutEvent | null = null
  let worn: WornEvent | null = null
  forager.chopRemainder += seconds * axe.quality
  if (forager.chopRemainder < logCut(config)) return { cut, worn }
  forager.chopRemainder -= logCut(config)
  const felled = state.logStock[treeId]! % 3 === 0
  if (felled) {
    state.felledMinute[treeId] = minute
    // Each three-log bundle represents one of the stand's former trees.
    state.woodStock[treeId]! += config.fellWood
    state.totals.fellenWood += config.fellWood
  }
  state.logStock[treeId]! -= 1
  if (state.logStock[treeId]! % 3 === 0) {
    const regrowth = state.logRegrowth.get(treeId) ?? []
    state.logRegrowth.set(treeId, [...regrowth, state.felledMinute[treeId]!])
    state.felledMinute[treeId] = -1
  }
  forager.log = 1
  state.totals.logsCut += 1
  forager.axeTotals = { ...forager.axeTotals, logsCut: forager.axeTotals.logsCut + 1 }
  const used = { ...axe, logsLeft: axe.logsLeft - 1 }
  cut = {
    kind: 'cut',
    minute,
    foragerId: forager.id,
    treeId,
    axeId: axe.id,
    quality: axe.quality,
    axeLogsLeft: used.logsLeft,
    treeLogsAfter: state.logStock[treeId]!,
    felled,
  }
  if (used.logsLeft > 0) forager.axe = used
  else {
    forager.axe = null
    forager.chopRemainder = 0
    state.totals.axesWornOut += 1
    forager.axeTotals = { ...forager.axeTotals, wornOut: forager.axeTotals.wornOut + 1 }
    worn = { kind: 'worn', minute, foragerId: forager.id, axeId: axe.id, makerId: axe.makerId }
  }
  return { cut, worn }
}

const betterAsk = (a: HeardAsk, b: HeardAsk) =>
  a.ready !== b.ready ? a.ready : a.price !== b.price ? a.price < b.price : a.quality > b.quality

/** A forager hears an ask: it keeps it if it is the same seller's, better, or what it remembered is an hour old. */
function hear(forager: Forager, ask: HeardAsk) {
  const old = forager.heardAsk
  if (!old || old.sellerId === ask.sellerId || ask.minute - old.minute > 60 || betterAsk(ask, old))
    forager.heardAsk = ask
}

/** A sale of the seller's spare axe to the buyer, if both gain and the food can change hands. */
function trySale(state: ValleyState, seller: Forager, buyer: Forager, minute: number): SaleEvent | null {
  const { config } = state
  const axe = seller.spareAxe!
  const ask = askOf(config, seller.craft)
  const worth = worthTo(config, buyer, axe.quality)
  if (worth <= ask) return null
  const price = salePrice(ask, worth)
  if (carriedKcal(buyer.carried) < price || roomKcal(config, seller) < price) return null
  const { taken, rest } = takeOldest(buyer.carried, price)
  seller.carried = addLots(seller.carried, taken)
  buyer.carried = rest
  buyer.axe = axe
  buyer.heardAsk = null
  seller.spareAxe = null
  seller.axeTotals = {
    ...seller.axeTotals,
    sold: seller.axeTotals.sold + 1,
    kcalReceived: seller.axeTotals.kcalReceived + price,
  }
  buyer.axeTotals = {
    ...buyer.axeTotals,
    bought: buyer.axeTotals.bought + 1,
    kcalPaid: buyer.axeTotals.kcalPaid + price,
  }
  state.totals.axeSales += 1
  state.totals.axeSalesKcal += price
  return { kind: 'sale', minute, sellerId: seller.id, buyerId: buyer.id, axe, price, ask, worth }
}

/**
 * The trader's exchange of axes with members of its group within talking distance, with `axeTrade` on: it forgets an
 * ask whose seller stands by with nothing to sell; tells its ask for a spare, or for an axe it promised; sells its
 * spare to a member that needs one; and, needing one itself, asks, draws a promise from the cheapest maker that would
 * gain it one, and buys a spare. Changes the working copies in place; returns the promises and sales.
 */
export function exchangeAxes(state: ValleyState, trader: Forager, minute: number): AxeEvent[] {
  const { config } = state
  if (!config.axeTrade || trader.groupId === null) return []
  const events: AxeEvent[] = []
  const near = state.foragers.filter(
    (other) => other.alive && other.id !== trader.id && mayTrade(other, trader) && withinTalk(config, other, trader),
  )
  const heard = trader.heardAsk
  if (heard) {
    const seller = state.foragers[heard.sellerId]!
    if (near.includes(seller) && !seller.spareAxe && !seller.promised) trader.heardAsk = null
  }
  if (trader.spareAxe) {
    const ask = askOf(config, trader.craft)
    const { quality } = trader.spareAxe
    for (const other of near) hear(other, { sellerId: trader.id, price: ask, quality, ready: true, minute })
    for (const other of near) {
      if (!needsAxe(state, other)) continue
      const sale = trySale(state, trader, other, minute)
      if (sale) {
        events.push(sale)
        break
      }
    }
  } else if (trader.promised) {
    const ask = askOf(config, trader.craft)
    const quality = expectedQuality(trader.craft)
    for (const other of near) hear(other, { sellerId: trader.id, price: ask, quality, ready: false, minute })
  }
  if (!needsAxe(state, trader)) return events
  if (!near.some((other) => other.spareAxe || other.promised)) {
    const makers = near
      .filter(
        (other) =>
          !wantsLogs(state, other) &&
          !other.making &&
          !other.promised &&
          !other.spareAxe &&
          worthTo(config, trader, expectedQuality(other.craft)) > askOf(config, other.craft),
      )
      .sort((a, b) => askOf(config, a.craft) - askOf(config, b.craft) || a.id - b.id)
    const promiser = makers[0]
    if (promiser) {
      promiser.promised = true
      const ask = askOf(config, promiser.craft)
      const quality = expectedQuality(promiser.craft)
      hear(trader, { sellerId: promiser.id, price: ask, quality, ready: false, minute })
      events.push({ kind: 'promise', minute, promiserId: promiser.id, askerId: trader.id, ask, quality })
    }
  }
  for (const other of near) {
    if (!other.spareAxe) continue
    const ask = askOf(config, other.craft)
    hear(trader, { sellerId: other.id, price: ask, quality: other.spareAxe.quality, ready: true, minute })
    const sale = trySale(state, other, trader, minute)
    if (sale) {
      events.push(sale)
      break
    }
  }
  return events
}
