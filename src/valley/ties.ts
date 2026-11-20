import { energyAt } from './body'
import { dayOf, MINUTES_PER_DAY } from './calendar'
import { addLots, carriedKcal, countEaten, eatCarried, takeOldest } from './food'
import { nightWood, woodMatters } from './trade'
import { ageOf } from './lifecycle'
import { areKin, closeness, livesWithParent, relatedness } from './kin'
import type { PairedEvent } from './types'
import type { Forager, GiftEvent, GiftGood, RefusalEvent, Tie, TieEvent, TogetherEvent, ValleyState } from './types'

/** A tie not yet held: nothing together, given or held against. */
export const NO_TIE: Tie = {
  familiarity: 0,
  credit: 0,
  grievance: 0,
  familiarityRemainder: 0,
  creditRemainder: 0,
  grievanceRemainder: 0,
  countedMinute: -1,
  askedDay: -1,
}

export const tieOf = (person: Forager, otherId: number): Tie => person.ties.get(otherId) ?? NO_TIE

/**
 * Sets the tie with `otherId` in `ties`. A new tie when `cap` are held forgets the least familiar first, ties by lowest
 * id. Tie records are never changed in place.
 */
export function putTie(ties: Map<number, Tie>, cap: number, otherId: number, tie: Tie) {
  if (!ties.has(otherId) && ties.size >= cap) {
    let weakest = -1,
      least = Infinity
    for (const [id, held] of ties)
      if (held.familiarity < least || (held.familiarity === least && id < weakest)) {
        least = held.familiarity
        weakest = id
      }
    ties.delete(weakest)
  }
  ties.set(otherId, tie)
}
const setTie = (state: ValleyState, person: Forager, otherId: number, tie: Tie) =>
  putTie(person.ties, state.config.tiesRemembered, otherId, tie)

/** Whether a task keeps its holder in one place: anything but a walk. */
const standing = (person: Forager) => person.task !== null && person.task.kind !== 'walk'

/**
 * Counts the time the waking person, whose task `ended` has just ended, spent with each person within talking distance
 * (`near`, in id order) who is not walking: from the later of their task starts and the last minute counted for the
 * pair, added to both their ties.
 */
export function countTogether(
  state: ValleyState,
  person: Forager,
  ended: Forager['task'],
  near: readonly number[],
  minute: number,
): TogetherEvent[] {
  const events: TogetherEvent[] = []
  if (!ended || ended.kind === 'walk') return events
  for (const otherId of near) {
    const other = state.foragers[otherId]!
    if (!other.alive || !standing(other)) continue
    const mine = tieOf(person, otherId),
      theirs = tieOf(other, person.id)
    const minutes =
      minute - Math.max(ended.startMinute, other.task!.startMinute, mine.countedMinute, theirs.countedMinute)
    if (minutes <= 0) continue
    setTie(state, person, otherId, { ...mine, familiarity: mine.familiarity + minutes, countedMinute: minute })
    setTie(state, other, person.id, { ...theirs, familiarity: theirs.familiarity + minutes, countedMinute: minute })
    events.push({ kind: 'together', minute, foragerId: person.id, otherId, minutes })
  }
  return events
}

/**
 * Whether `giver`, from its own tie with the asker and their closeness per mille (Life 19: relatedness, or 500 for a
 * partner), has goodwill enough to give: kin add `kinGoodwillMinutes` of familiarity for each whole relatedness.
 */
export const goodwillCovers = (state: ValleyState, giver: Forager, tie: Tie, kin = 0) =>
  tie.familiarity * state.config.trustPerMille * giver.giveGoodwillPerMille +
    state.config.kinGoodwillMinutes * kin * 1_000 >=
  (tie.credit + tie.grievance) * 1_000_000

/** Minutes of `person`'s own work a gift stands for. */
export const giftMinutes = (person: Forager, good: GiftGood, amount: number) =>
  Math.floor((amount * 60) / Math.max(1, good === 'food' ? person.forageRate : person.woodRate))

const energyNow = (state: ValleyState, person: Forager, minute: number) =>
  person.task ? Math.max(0, energyAt(person.task, minute, state.routes).kcal) : person.energyKcal

/** What `giver` can spare of a good at `minute`: food beyond what it would eat to reach satiation; wood above its stock. */
export function spareOf(state: ValleyState, giver: Forager, good: GiftGood, minute: number) {
  if (good === 'wood') return Math.max(0, giver.wood - giver.woodStockTarget)
  return Math.max(0, carriedKcal(giver.carried) - Math.max(0, giver.satiationKcal - energyNow(state, giver, minute)))
}

/** What the asker still lacks of a good. */
export const lackOf = (asker: Forager, good: GiftGood) =>
  good === 'wood'
    ? Math.max(0, asker.woodStockTarget - asker.wood)
    : Math.max(0, asker.satiationKcal - asker.energyKcal - carriedKcal(asker.carried))

/** Whether the asker needs to ask for a good: hungry with no food, or holding less than a night's firewood. */
export function needs(state: ValleyState, asker: Forager, good: GiftGood, minute = 0) {
  if (good === 'food')
    return (
      asker.hungry &&
      carriedKcal(asker.carried) === 0 &&
      ageOf(state.config, asker, minute) >= state.config.solidFoodMilliYears
    )
  // A child living with a parent sleeps by the parent's fire and asks for no wood (Life 19).
  return woodMatters(state.config) && asker.wood < nightWood(state.config) && !livesWithParent(state, asker)
}

/**
 * The waking person asks the people within talking distance it knows, closest tie first, for food and then wood it
 * needs, each person at most once a calendar day, until given some. Each decides from its own tie with the asker; a gift moves food or
 * wood and credit, a refusal for want of goodwill adds grievance. The asker eats what it is given, and the kcal eaten are returned.
 */
export function ask(state: ValleyState, asker: Forager, near: readonly number[], minute: number) {
  const events: TieEvent[] = []
  const today = dayOf(minute)
  for (const good of ['food', 'wood'] as const) {
    if (!needs(state, asker, good, minute)) continue
    // Kin and a partner are asked first, closest first; then others by tie, as before.
    const close = (id: number) => closeness(state.foragers, asker, state.foragers[id]!)
    const asked = near
      .filter((id) => {
        const other = state.foragers[id]!,
          tie = tieOf(asker, id)
        return (
          other.alive &&
          (tie.familiarity > 0 || close(id) > 0) &&
          tie.askedDay !== today &&
          (good === 'food' ? carriedKcal(other.carried) > 0 : other.wood > 0)
        )
      })
      .sort((a, b) => {
        const x = tieOf(asker, a),
          y = tieOf(asker, b)
        return close(b) - close(a) || y.familiarity - y.grievance - (x.familiarity - x.grievance) || a - b
      })
    for (const giverId of asked) {
      if (!needs(state, asker, good, minute)) break
      const giver = state.foragers[giverId]!
      setTie(state, asker, giverId, { ...tieOf(asker, giverId), askedDay: today })
      events.push(give(state, giver, asker, good, minute))
    }
  }
  if (!events.some((event) => event.kind === 'gift' && event.good === 'food')) return { events, ateKcal: 0 }
  const eaten = eatCarried(asker.carried, asker.reserveMaxKcal - asker.energyKcal)
  asker.carried = eaten.rest
  asker.energyKcal += eaten.takenKcal
  countEaten(state.today, eaten.taken)
  return { events, ateKcal: eaten.takenKcal }
}

/** `giver`, asked by `asker` for a good, gives or refuses. Changes both in place. */
export function give(
  state: ValleyState,
  giver: Forager,
  asker: Forager,
  good: GiftGood,
  minute: number,
): GiftEvent | RefusalEvent {
  const tie = tieOf(giver, asker.id)
  const kinPerMille = closeness(state.foragers, giver, asker)
  const amount = Math.min(spareOf(state, giver, good, minute), lackOf(asker, good))
  const refused = (reason: 'goodwill' | 'spare'): RefusalEvent => {
    const grievance = reason === 'goodwill' ? state.config.refusalGrievanceMinutes : 0
    if (grievance) {
      const held = tieOf(asker, giver.id)
      setTie(state, asker, giver.id, { ...held, grievance: held.grievance + grievance })
    }
    state.today.refusalsMadeById[giver.id]! += 1
    state.today.refusalsMetById[asker.id]! += 1
    return { kind: 'refusal', minute, foragerId: giver.id, askerId: asker.id, good, reason, grievance, kinPerMille }
  }
  if (amount < 1) return refused('spare')
  if (!goodwillCovers(state, giver, tie, kinPerMille)) return refused('goodwill')
  if (good === 'food') {
    const { taken, rest } = takeOldest(giver.carried, amount)
    giver.carried = rest
    asker.carried = addLots(asker.carried, taken)
    state.today.giftKcalGivenById[giver.id]! += amount
    state.today.giftKcalReceivedById[asker.id]! += amount
  } else {
    giver.wood -= amount
    asker.wood += amount
    state.today.giftWoodGivenById[giver.id]! += amount
    state.today.giftWoodReceivedById[asker.id]! += amount
  }
  const giverCredit = giftMinutes(giver, good, amount),
    receiverCredit = -giftMinutes(asker, good, amount)
  setTie(state, giver, asker.id, { ...tieOf(giver, asker.id), credit: tie.credit + giverCredit })
  const owed = tieOf(asker, giver.id)
  setTie(state, asker, giver.id, { ...owed, credit: owed.credit + receiverCredit })
  return {
    kind: 'gift',
    minute,
    giverId: giver.id,
    receiverId: asker.id,
    good,
    amount,
    giverCredit,
    receiverCredit,
    kinPerMille,
  }
}

/** Whether a person may pair: living, unpaired, and at least `pairFromYears` old. */
export const mayPair = (state: ValleyState, person: Forager, minute: number) =>
  person.alive && person.partnerId === null && ageOf(state.config, person, minute) >= state.config.pairFromYears * 1_000

/**
 * The person's most familiar eligible partner among their ties: of the other sex, free to pair, not kin, with
 * familiarity at least `pairFamiliarityMinutes`; ties go to the lower id. Null if none.
 */
export function mostFamiliarMate(state: ValleyState, person: Forager, minute: number): Forager | null {
  let best: Forager | null = null,
    bestFamiliarity = -1
  for (const [otherId, tie] of person.ties) {
    const other = state.foragers[otherId]!
    if (
      other.sex === person.sex ||
      tie.familiarity < state.config.pairFamiliarityMinutes ||
      !mayPair(state, other, minute) ||
      areKin(state.foragers, person, other)
    )
      continue
    if (tie.familiarity > bestFamiliarity || (tie.familiarity === bestFamiliarity && otherId < best!.id)) {
      best = other
      bestFamiliarity = tie.familiarity
    }
  }
  return best
}

/**
 * Pairing at a wake-up (Life 19): the waking person and someone within talking distance pair when each is the other's
 * most familiar eligible person. Changes both in place.
 */
export function pairAt(state: ValleyState, person: Forager, near: readonly number[], minute: number): PairedEvent[] {
  if (!mayPair(state, person, minute)) return []
  const mate = mostFamiliarMate(state, person, minute)
  if (!mate || !near.includes(mate.id) || mostFamiliarMate(state, mate, minute)?.id !== person.id) return []
  person.partnerId = mate.id
  mate.partnerId = person.id
  state.today.pairings += 1
  return [{ kind: 'paired', minute, foragerId: person.id, otherId: mate.id }]
}

/** Whether a gift or refusal's closeness agrees with the family records: relatedness, or 500 between partners. */
export const closenessHolds = (state: ValleyState, a: number, b: number, kin: number) => {
  const x = state.foragers[a]!,
    y = state.foragers[b]!
  const r = relatedness(state.foragers, x, y)
  return kin === r || (kin === 500 && (x.partnerId === b || !x.alive || !y.alive || paired(state, a, b)))
}
const paired = (state: ValleyState, a: number, b: number) =>
  state.lastInterval.some(
    (e) => e.kind === 'paired' && ((e.foragerId === a && e.otherId === b) || (e.foragerId === b && e.otherId === a)),
  )

/** A value faded by a day: it loses `tieFadePerMillion` of its size, the rest carried in its remainder. */
export function fadeValue(value: number, remainder: number, perMillion: number) {
  const loss = Math.abs(value) * perMillion + remainder
  const whole = Math.floor(loss / 1_000_000)
  return { value: value - Math.sign(value) * whole, remainder: loss - whole * 1_000_000 }
}

/** Fades every tie of every living person by a day; a tie with nothing left is forgotten. */
export function fadeTies(state: ValleyState) {
  for (const person of state.foragers) if (person.alive) fadeMap(person.ties, state.config.tieFadePerMillion)
}
/** Fades the ties in `ties` by a day, in place. */
export function fadeMap(ties: Map<number, Tie>, perMillion: number) {
  for (const [id, tie] of ties) {
    const familiarity = fadeValue(tie.familiarity, tie.familiarityRemainder, perMillion),
      credit = fadeValue(tie.credit, tie.creditRemainder, perMillion),
      grievance = fadeValue(tie.grievance, tie.grievanceRemainder, perMillion)
    if (!familiarity.value && !credit.value && !grievance.value) ties.delete(id)
    else
      ties.set(id, {
        ...tie,
        familiarity: familiarity.value,
        familiarityRemainder: familiarity.remainder,
        credit: credit.value,
        creditRemainder: credit.remainder,
        grievance: grievance.value,
        grievanceRemainder: grievance.remainder,
      })
  }
}

/** The people `person` spent time with in the day ending at `midnight`. */
export const companionsOn = (person: Forager, midnight: number) => {
  let count = 0
  for (const tie of person.ties.values())
    if (tie.countedMinute > midnight - MINUTES_PER_DAY && tie.countedMinute <= midnight) count += 1
  return count
}

/**
 * Replays the ties of an interval from its events: time together, asking, gifts, refusals and fading at each midnight.
 * Checks each gift and refusal against the giver's goodwill and the credit and grievance rules, and each ask against
 * once a calendar day, and returns the violations with the ties replayed.
 */
export function replayTies(before: ValleyState, after: ValleyState) {
  const errors: string[] = [],
    { config } = after
  // People born during the interval start with no ties, alive, at the rates they were born with.
  const ties = after.foragers.map((p) => new Map(before.foragers[p.id]?.ties ?? []))
  const alive = after.foragers.map((p) => before.foragers[p.id]?.alive ?? true)
  const rates = after.foragers.map((p) => {
    const was = before.foragers[p.id]
    return was ? { forageRate: was.forageRate, woodRate: was.woodRate } : { forageRate: 0, woodRate: 0 }
  })
  const tie = (id: number, otherId: number) => ties[id]!.get(otherId) ?? NO_TIE
  const put = (id: number, otherId: number, value: Tie) => putTie(ties[id]!, config.tiesRemembered, otherId, value)
  const asks = (giverId: number, askerId: number, minute: number) => {
    const held = tie(askerId, giverId)
    if (held.askedDay === dayOf(minute)) errors.push(`person ${askerId}: asked person ${giverId} twice in a day`)
    put(askerId, giverId, { ...held, askedDay: dayOf(minute) })
  }
  const goodwill = (giverId: number, askerId: number, kin = 0) => {
    const held = tie(giverId, askerId)
    if (!closenessHolds(after, giverId, askerId, kin)) errors.push(`person ${giverId}: closeness differs from kin`)
    return goodwillCovers(after, after.foragers[giverId]!, held, kin)
  }
  for (const event of after.lastInterval) {
    if (event.kind === 'world' && event.minute % MINUTES_PER_DAY === 0)
      ties.forEach((map, id) => {
        if (alive[id]) fadeMap(map, config.tieFadePerMillion)
      })
    if (event.kind === 'death') alive[event.foragerId] = false
    if (event.kind === 'skills') rates[event.foragerId] = { forageRate: event.forageRate, woodRate: event.woodRate }
    if (event.kind === 'born') {
      const child = after.foragers[event.foragerId]!
      rates[event.foragerId] = { forageRate: child.forageRate, woodRate: child.woodRate }
    }
    if (event.kind === 'together') {
      const mine = tie(event.foragerId, event.otherId),
        theirs = tie(event.otherId, event.foragerId)
      if (event.minutes <= 0 || event.minute - event.minutes < Math.max(mine.countedMinute, theirs.countedMinute))
        errors.push(`person ${event.foragerId}: time together counted twice`)
      put(event.foragerId, event.otherId, {
        ...mine,
        familiarity: mine.familiarity + event.minutes,
        countedMinute: event.minute,
      })
      put(event.otherId, event.foragerId, {
        ...theirs,
        familiarity: theirs.familiarity + event.minutes,
        countedMinute: event.minute,
      })
    }
    if (event.kind === 'gift') {
      const { giverId, receiverId: askerId } = event
      asks(giverId, askerId, event.minute)
      if (event.amount < 1 || !goodwill(giverId, askerId, event.kinPerMille ?? 0))
        errors.push(`person ${giverId}: gave without enough goodwill`)
      const minutes = (id: number) =>
        -Math.floor(
          (event.amount * 60) / Math.max(1, event.good === 'food' ? rates[id]!.forageRate : rates[id]!.woodRate),
        )
      if (event.giverCredit !== -minutes(giverId) || event.receiverCredit !== minutes(askerId))
        errors.push(`person ${giverId}: a gift's credit differs from its value`)
      const given = tie(giverId, askerId)
      put(giverId, askerId, { ...given, credit: given.credit + event.giverCredit })
      const owed = tie(askerId, giverId)
      put(askerId, giverId, { ...owed, credit: owed.credit + event.receiverCredit })
    }
    if (event.kind === 'refusal') {
      const { foragerId: giverId, askerId } = event
      asks(giverId, askerId, event.minute)
      const expected = event.reason === 'goodwill' ? config.refusalGrievanceMinutes : 0
      if (
        event.grievance !== expected ||
        (event.reason === 'goodwill' && goodwill(giverId, askerId, event.kinPerMille ?? 0))
      )
        errors.push(`person ${giverId}: a refusal differs from the giving rule`)
      const held = tie(askerId, giverId)
      if (expected) put(askerId, giverId, { ...held, grievance: held.grievance + expected })
    }
  }
  after.foragers.forEach((p, id) => {
    const replayed = ties[id]!
    if (replayed.size !== p.ties.size) errors.push(`person ${id}: ties differ from their records`)
    else
      for (const [otherId, value] of p.ties) {
        const expected = replayed.get(otherId)
        if (!expected || JSON.stringify(expected) !== JSON.stringify(value)) {
          errors.push(`person ${id}: ties differ from their records`)
          break
        }
      }
  })
  return errors
}

/** Violations of the standing rules on every person's ties. */
export function tieViolations(state: ValleyState) {
  const errors: string[] = [],
    { config } = state,
    today = dayOf(state.minute)
  for (const p of state.foragers) {
    if (p.ties.size > config.tiesRemembered) errors.push(`person ${p.id}: too many ties`)
    for (const [otherId, tie] of p.ties) {
      if (otherId === p.id || !Number.isSafeInteger(otherId) || otherId < 0 || otherId >= state.foragers.length)
        errors.push(`person ${p.id}: a tie to an impossible person`)
      if (
        tie.familiarity < 0 ||
        tie.grievance < 0 ||
        tie.countedMinute > state.minute ||
        tie.askedDay > today ||
        ![tie.familiarity, tie.credit, tie.grievance, tie.countedMinute, tie.askedDay].every(Number.isSafeInteger)
      )
        errors.push(`person ${p.id}: an impossible tie`)
      const theirs = state.foragers[otherId]?.ties.get(p.id)
      if (
        theirs &&
        theirs.familiarityRemainder === tie.familiarityRemainder &&
        (theirs.familiarity !== tie.familiarity || theirs.countedMinute !== tie.countedMinute)
      )
        errors.push(`person ${p.id}: time together differs from person ${otherId}'s`)
    }
  }
  return errors
}
