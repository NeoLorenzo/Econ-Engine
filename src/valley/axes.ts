import { personConfig } from './nature'
import { randomInt } from '../sim/rng'
import { addLots, carriedKcal, takeOldest } from './food'
import { walkSpeed } from './forager'
import { minuteOfDay } from './calendar'
import { distance } from './geometry'
import { wantsLogs } from './huts'
import { deriveAttemptSeed, deriveAxeSeed } from './layout'
import { SECONDS_PER_HOUR, gainIdea, hasIdea, knows, successOf } from './skills'
import { mayTrade, roomKcal, withinTalk } from './trade'
import type {
  Axe,
  AxeEvent,
  BrokeEvent,
  DismantledEvent,
  CutEvent,
  Forager,
  HeardAsk,
  IdeaEvent,
  LearntEvent,
  MadeEvent,
  SaleEvent,
  ValleyConfig,
  ValleyState,
  WornEvent,
} from './types'

// Life 9's axes, made by Life 17's techniques: attempted at the hearth from a stone and wood, at a speed, chance of
// working and quality set by the maker's proficiency in the technique; worn out by cutting logs; and asked for,
// promised and sold for food between members of a group, valued by the logs they will cut.

/** Seconds of work an axe by `technique` takes at proficiency `proficiency`: its hours · 100 / proficiency, rounded up. */
export const makeSeconds = (config: ValleyConfig, technique: number, proficiency: number) =>
  Math.ceil((SECONDS_PER_HOUR * config.axeTechniques[technique]!.hours * 100) / Math.max(1, proficiency))

/**
 * What making an axe by `technique` costs at proficiency `proficiency`, in kilocalories: the extra energy of making
 * instead of resting, for the seconds it takes. It is a maker's asking price.
 */
export const askOf = (config: ValleyConfig, technique: number, proficiency: number) =>
  Math.ceil(
    (makeSeconds(config, technique, proficiency) * (config.makeKcalPerHour - config.restKcalPerHour)) /
      SECONDS_PER_HOUR,
  )

/** The quality a maker at proficiency `proficiency` expects: three quarters of it, at least 1. */
export const expectedQuality = (proficiency: number) => Math.max(1, Math.floor((3 * proficiency) / 4))

/** The logs an axe by `technique` of quality `quality` cuts before it wears out. */
export const axeLife = (config: ValleyConfig, technique: number, quality: number) =>
  Math.max(1, Math.floor((config.axeTechniques[technique]!.logs * quality) / 100))

/** The logs a maker expects an axe by `technique` to cut at proficiency `proficiency`. */
export const expectedLogs = (config: ValleyConfig, technique: number, proficiency: number) =>
  axeLife(config, technique, expectedQuality(proficiency))

/**
 * The known technique with the least work per log expected, `(makeSeconds + stoneSeconds) / (success · expectedLogs)`,
 * compared by cross products; ties go to the earlier technique.
 */
export function bestTechnique(config: ValleyConfig, person: Forager, stoneSeconds = 0) {
  let best = 0,
    bestSeconds = 0,
    bestLogs = 0
  for (let t = 0; t < config.axeTechniques.length; t += 1) {
    if (!knows(person, t)) continue
    const proficiency = person.proficiency[t]!
    const seconds = makeSeconds(config, t, proficiency) + stoneSeconds
    const logs = successOf(config, proficiency) * expectedLogs(config, t, proficiency)
    if (logs > 0 && (bestLogs === 0 || seconds * bestLogs < bestSeconds * logs)) {
      best = t
      bestSeconds = seconds
      bestLogs = logs
    }
  }
  return best
}

/** What a person would ask for an axe by `technique`: their extra energy to make one at their proficiency in it. */
export const askFor = (config: ValleyConfig, person: Forager, technique: number) =>
  askOf(personConfig(config, person), technique, person.proficiency[technique]!)

/** What a person would ask to make an axe now, by the technique they would use, and the logs it would cut. */
export function offerOf(config: ValleyConfig, person: Forager) {
  const technique = bestTechnique(config, person)
  return {
    ask: askFor(config, person, technique),
    logs: expectedLogs(config, technique, person.proficiency[technique]!),
  }
}

/** What an axe that will cut `logs` logs is worth to a person: their own making cost per log, times the logs. */
export function worthTo(config: ValleyConfig, person: Forager, logs: number) {
  const technique = bestTechnique(config, person)
  return Math.floor(
    (askFor(config, person, technique) * logs) / expectedLogs(config, technique, person.proficiency[technique]!),
  )
}

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
  return worthTo(config, forager, heard.logs) > heard.price ? heard : null
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
  const needLogs = wantsLogs(state, forager)
  // An axe begun as practice is finished here only by someone who needs it for their hut.
  if (forager.making && (!forager.making.practice || (needLogs && !forager.axe))) return { kind: 'make' }
  if (forager.making) return null
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
      if (
        (cm + distance(point.x, point.y, forager.hearth.x, forager.hearth.y)) / Math.max(1, _speed * 60) + 1 >
        config.duskHour * 60 - forager.duskMarginMinutes - minuteOfDay(minute)
      )
        continue
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
      const price = salePrice(ask.price, worthTo(config, forager, ask.logs))
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
 * The seconds a person counts for the stone an axe uses: none while they hold another, else twice the straight-line
 * walk from their hearth to the nearest outcrop they remember holding stones.
 */
export function stoneFetchSeconds(state: ValleyState, person: Forager) {
  const { config, layout } = state
  if (person.stone > 1) return 0
  let best = Infinity
  for (let id = 0; id < layout.places.count; id += 1) {
    if (person.knownPlaces[id]! < 0 || layout.places.kind[id] !== 3 || person.placeStock[id] === 0) continue
    best = Math.min(best, distance(person.hearth.x, person.hearth.y, layout.places.x[id]!, layout.places.y[id]!))
  }
  return best === Infinity ? 0 : Math.ceil((2 * best) / Math.max(1, walkSpeed(config, person)))
}

/** The technique a person practises: the first they have the idea of and have not made, else the one they would use. */
export function practiceTechnique(state: ValleyState, person: Forager) {
  const { config } = state
  for (let t = 0; t < config.axeTechniques.length; t += 1) if (hasIdea(person, t) && !knows(person, t)) return t
  return bestTechnique(config, person, stoneFetchSeconds(state, person))
}

/**
 * The attempt at an axe by `technique` begun at `minute` at proficiency `proficiency`, from the attempt stream: the
 * draw, and the second of work it breaks at, or -1 if it works.
 */
export function attemptOf(
  config: ValleyConfig,
  person: Forager,
  technique: number,
  proficiency: number,
  minute: number,
) {
  const needed = makeSeconds(config, technique, proficiency)
  const draw = randomInt(deriveAttemptSeed(config.seed, minute, person.id), 1_000)
  if (draw.value < successOf(config, proficiency)) return { needed, draw: draw.value, breakAt: -1 }
  return { needed, draw: draw.value, breakAt: 1 + randomInt(draw.state, needed).value }
}

/**
 * Begins an axe at the hearth: as practice, by the technique practised; otherwise by the technique that costs least
 * work per log. Its stone and wood go into it, and the attempt draws whether it will work. A needed axe is for sale
 * unless the forager needs it for its own hut. Changes the working copies in place.
 */
export function beginAxe(state: ValleyState, forager: Forager, minute: number, practice = false) {
  const { config } = state
  const technique = practice
    ? practiceTechnique(state, forager)
    : bestTechnique(config, forager, stoneFetchSeconds(state, forager))
  const proficiency = forager.proficiency[technique]!
  forager.stone -= 1
  forager.wood -= config.axeWood
  state.totals.stonesWorked += 1
  state.totals.axeWood += config.axeWood
  state.today.attemptsByTechnique[technique]! += 1
  forager.making = {
    technique,
    worked: 0,
    ...attemptOf(config, forager, technique, proficiency, minute),
    forSale: !practice && !(wantsLogs(state, forager) && !forager.axe),
    beganMinute: minute,
    proficiency,
    practice,
  }
}

/**
 * `seconds` of work on the axe being made, no more than it still needs or until it breaks. A broken attempt loses its
 * stone and returns its wood. A finished one draws its quality from the axe stream, uniformly from half the maker's
 * proficiency in its technique to that proficiency, and the first by a technique makes it known. A practice axe is
 * held as the maker's axe, or as a spare if they have one, or taken apart if they hold both. Changes the working
 * copies in place; returns the seconds worked and the events of a broken, finished, dismantled or first axe.
 */
export function workAxe(state: ValleyState, forager: Forager, seconds: number, minute: number) {
  const { config } = state
  const making = forager.making!
  const end = making.breakAt >= 0 ? making.breakAt : making.needed
  const worked = Math.min(seconds, end - making.worked)
  const { technique } = making
  forager.secondsToday.make += worked
  forager.secondsWorked.make += worked
  forager.craftToday = forager.craftToday.map((value, t) => (t === technique ? value + worked : value))
  const none = {
    made: null as MadeEvent | null,
    broke: null as BrokeEvent | null,
    dismantled: null as DismantledEvent | null,
    learnt: null as LearntEvent | null,
  }
  if (making.worked + worked < end) {
    forager.making = { ...making, worked: making.worked + worked }
    return { worked, ...none }
  }
  forager.making = null
  if (making.breakAt >= 0) {
    forager.wood += config.axeWood
    state.totals.axeWood -= config.axeWood
    state.today.breaksByTechnique[technique]! += 1
    const broke: BrokeEvent = {
      kind: 'broke',
      minute,
      foragerId: forager.id,
      technique,
      worked: end,
      practice: making.practice,
      beganMinute: making.beganMinute,
      proficiency: making.proficiency,
      draw: making.draw,
    }
    return { worked, ...none, broke }
  }
  const first = !knows(forager, technique)
  if (first) forager.known |= 1 << technique
  const learnt: LearntEvent | null = first ? { kind: 'learnt', minute, foragerId: forager.id, technique } : null
  if (making.practice && forager.axe && forager.spareAxe) {
    // A practice axe with nowhere to go is taken apart: its stone and wood are back in hand for the next try.
    forager.stone += 1
    forager.wood += config.axeWood
    state.totals.stonesWorked -= 1
    state.totals.axeWood -= config.axeWood
    const dismantled: DismantledEvent = {
      kind: 'dismantled',
      minute,
      foragerId: forager.id,
      technique,
      beganMinute: making.beganMinute,
      proficiency: making.proficiency,
      draw: making.draw,
    }
    return { worked, ...none, dismantled, learnt }
  }
  const proficiency = forager.proficiency[technique]!
  const low = Math.floor(proficiency / 2)
  const draw = randomInt(
    deriveAxeSeed(config.seed, forager.axeTotals.madeOwn + forager.axeTotals.madeForSale, forager.id),
    proficiency - low + 1,
  )
  const quality = Math.max(1, low + draw.value)
  const axe: Axe = {
    id: state.totals.axesMade,
    technique,
    quality,
    logsLeft: axeLife(config, technique, quality),
    makerId: forager.id,
    madeMinute: minute,
  }
  state.totals.axesMade += 1
  const forSale = making.practice ? forager.axe !== null : making.forSale
  if (forSale) {
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
    proficiency,
    forSale,
    beganMinute: making.beganMinute,
    beganProficiency: making.proficiency,
    draw: making.draw,
    practice: making.practice,
  }
  return { worked, ...none, made, learnt }
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
  const felled = state.logStock[treeId]! % config.logsPerTree === 0
  if (felled) {
    state.felledMinute[treeId] = minute
    // Each bundle of `logsPerTree` logs represents one of the stand's former trees.
    state.woodStock[treeId]! += config.fellWood
    state.totals.fellenWood += config.fellWood
  }
  state.logStock[treeId]! -= 1
  if (state.logStock[treeId]! % config.logsPerTree === 0) {
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
  a.ready !== b.ready ? a.ready : a.price !== b.price ? a.price < b.price : a.logs > b.logs

/** A forager hears an ask: it keeps it if it is the same seller's, better, or what it remembered is an hour old. */
function hear(forager: Forager, ask: HeardAsk) {
  const old = forager.heardAsk
  if (!old || old.sellerId === ask.sellerId || ask.minute - old.minute > 60 || betterAsk(ask, old))
    forager.heardAsk = ask
}

/**
 * A sale of the seller's spare axe to the buyer, if both gain and the food can change hands. A buyer with no idea of
 * the axe's technique gains it.
 */
function trySale(state: ValleyState, seller: Forager, buyer: Forager, minute: number): (SaleEvent | IdeaEvent)[] {
  const { config } = state
  const axe = seller.spareAxe!
  const ask = askFor(config, seller, axe.technique)
  const worth = worthTo(config, buyer, axe.logsLeft)
  if (worth <= ask) return []
  const price = salePrice(ask, worth)
  if (carriedKcal(buyer.carried) < price || roomKcal(config, seller) < price) return []
  const { taken, rest } = takeOldest(buyer.carried, price)
  seller.carried = addLots(seller.carried, taken)
  buyer.carried = rest
  buyer.axe = axe
  buyer.heardAsk = null
  const events: (SaleEvent | IdeaEvent)[] = [
    { kind: 'sale', minute, sellerId: seller.id, buyerId: buyer.id, axe, price, ask, worth },
  ]
  if (!hasIdea(buyer, axe.technique)) {
    gainIdea(config, buyer, axe.technique)
    events.push({
      kind: 'idea',
      minute,
      foragerId: buyer.id,
      technique: axe.technique,
      how: 'from an axe',
      fromId: axe.makerId,
      seconds: 0,
      chance: 0,
      draw: 0,
    })
  }
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
  return events
}

/**
 * The trader's exchange of axes with members of its group within talking distance, with `axeTrade` on: it forgets an
 * ask whose seller stands by with nothing to sell; tells its ask for a spare, or for an axe it promised; sells its
 * spare to a member that needs one; and, needing one itself, asks, draws a promise from the cheapest maker that would
 * gain it one, and buys a spare. Changes the working copies in place; returns the promises and sales.
 */
export function exchangeAxes(state: ValleyState, trader: Forager, minute: number): (AxeEvent | IdeaEvent)[] {
  const { config } = state
  if (!config.axeTrade || trader.groupId === null) return []
  const events: (AxeEvent | IdeaEvent)[] = []
  const near = state.foragers.filter(
    (other) => other.alive && other.id !== trader.id && mayTrade(other, trader) && withinTalk(config, other, trader),
  )
  const heard = trader.heardAsk
  if (heard) {
    const seller = state.foragers[heard.sellerId]!
    if (near.includes(seller) && !seller.spareAxe && !seller.promised) trader.heardAsk = null
  }
  if (trader.spareAxe) {
    const ask = askFor(config, trader, trader.spareAxe.technique)
    const logs = trader.spareAxe.logsLeft
    for (const other of near) hear(other, { sellerId: trader.id, price: ask, logs, ready: true, minute })
    for (const other of near) {
      if (!needsAxe(state, other)) continue
      const sale = trySale(state, trader, other, minute)
      if (sale.length) {
        events.push(...sale)
        break
      }
    }
  } else if (trader.promised) {
    const { ask, logs } = offerOf(config, trader)
    for (const other of near) hear(other, { sellerId: trader.id, price: ask, logs, ready: false, minute })
  }
  if (!needsAxe(state, trader)) return events
  if (!near.some((other) => other.spareAxe || other.promised)) {
    const makers = near
      .filter((other) => !wantsLogs(state, other) && !other.making && !other.promised && !other.spareAxe)
      .map((other) => ({ other, ...offerOf(config, other) }))
      .filter((offer) => worthTo(config, trader, offer.logs) > offer.ask)
      .sort((a, b) => a.ask - b.ask || a.other.id - b.other.id)
    const offer = makers[0]
    if (offer) {
      const { other: promiser, ask, logs } = offer
      promiser.promised = true
      hear(trader, { sellerId: promiser.id, price: ask, logs, ready: false, minute })
      events.push({ kind: 'promise', minute, promiserId: promiser.id, askerId: trader.id, ask, logs })
    }
  }
  for (const other of near) {
    if (!other.spareAxe) continue
    const ask = askFor(config, other, other.spareAxe.technique)
    hear(trader, { sellerId: other.id, price: ask, logs: other.spareAxe.logsLeft, ready: true, minute })
    const sale = trySale(state, other, trader, minute)
    if (sale.length) {
      events.push(...sale)
      break
    }
  }
  return events
}
