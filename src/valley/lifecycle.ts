import { randomInt } from '../sim/rng'
import { dayOf, MINUTES_PER_DAY } from './calendar'
import { newHydration, energyAt } from './body'
import { ageMilli, ageYears, deathHazard, growing } from './growth'
import { deriveBirthSeed, deriveConceiveSeed, deriveFateSeed } from './layout'
import { bodyFactor, deriveNature, drawNature, NatureDraws, personalityFactor } from './nature'
import { knowledgeBytes, chunkOf } from './routes'
import { learnOf, noTaskSeconds, skillsOf } from './skills'
import { woodMatters } from './trade'
import { distanceSq } from './geometry'
import { positionAt } from './tasks'
import type {
  BornEvent,
  ConceivedEvent,
  Forager,
  PersonNature,
  Point,
  Talents,
  ValleyConfig,
  ValleyEvent,
  ValleyLayout,
  ValleyState,
} from './types'

export interface NewPerson {
  id: number
  /** People in the valley once this one has joined, the size of every per-person array. */
  count: number
  nature: PersonNature
  skills: ReturnType<typeof personSkills>
  hearth: Point
  at: Point
  energyKcal: number
  waterDeficitMl: number
  birthMinute: number
  motherId: number | null
  fatherId: number | null
  minute: number
}

/** Talents, experience, techniques and the skills that follow, for a person with the given experience and techniques. */
export function personSkills(
  config: ValleyConfig,
  talents: Talents,
  start: { experience: number[]; fadeRemainder: number[]; gainRemainder: number[] },
  known: number,
  work: number,
) {
  return {
    talents,
    learn: learnOf(config, talents),
    ...start,
    ideas: known,
    known,
    practicedToday: 0,
    ...skillsOf(config, start.experience, known, work),
    craftToday: config.axeTechniques.map(() => 0),
  }
}

/** A person as they join the valley, founder or newborn: every field a person has. */
export function newPerson(config: ValleyConfig, layout: ValleyLayout, p: NewPerson): Forager {
  return {
    ...newHydration(config),
    waterDeficitMl: p.waterDeficitMl,
    ...p.nature,
    task: null,
    knownPlaces: new Int32Array(layout.places.count).fill(-1),
    placeCheckedMinute: new Int32Array(layout.places.count).fill(-1),
    seenMinute: new Int32Array(p.count).fill(-1),
    placeStock: new Int32Array(layout.places.count).fill(-1),
    placeWood: new Int32Array(layout.places.count).fill(-1),
    placeLogs: new Int32Array(layout.places.count).fill(-1),
    metMinute: new Int32Array(p.count).fill(-1),
    metPosition: new Map(),
    ties: new Map(),
    arrivalFrom: new Int32Array(p.count).fill(-1),
    knowledge: { triangles: new Uint8Array(knowledgeBytes(layout.nav.mesh)), revision: 0 },
    ways: [],
    nextWayId: 0,
    leisureMinute: -1,
    survey: null,
    energyTimeRemainder: 0,
    waterTimeRemainder: 0,
    lastWakeMinute: p.minute,
    energyRemainder: 0,
    knownBanks: new Map(),
    fishMemory: new Map(),
    deathSecond: null,
    deathCauses: [],
    id: p.id,
    x: p.at.x,
    y: p.at.y,
    hearth: p.hearth,
    energyKcal: p.energyKcal,
    hungry: p.energyKcal < p.nature.hungryBelowKcal,
    alive: true,
    deathMinute: null,
    carried: [],
    store: [],
    storeTrip: false,
    wood: 0,
    shortOfWood: woodMatters(config),
    tripWood: 0,
    groupId: null,
    joinedMinute: null,
    knownFlags: [],
    ...p.skills,
    log: 0,
    stone: 0,
    hutId: null,
    axe: null,
    spareAxe: null,
    making: null,
    chopRemainder: 0,
    promised: false,
    heardAsk: null,
    axeTotals: {
      madeOwn: 0,
      madeForSale: 0,
      sold: 0,
      bought: 0,
      wornOut: 0,
      kcalReceived: 0,
      kcalPaid: 0,
      logsCut: 0,
    },
    hutSleepMinutes: 0,
    secondsToday: noTaskSeconds(),
    secondsWorked: noTaskSeconds(),
    heardTerms: null,
    trip: null,
    pickRemainder: 0,
    gatherRemainder: 0,
    fireHour: -1,
    warm: false,
    fireGiven: 0,
    warmByFireMinutes: 0,
    swapTotals: { woodSold: 0, woodBought: 0, kcalReceived: 0, kcalPaid: 0 },
    birthMinute: p.birthMinute,
    motherId: p.motherId,
    fatherId: p.fatherId,
    partnerId: null,
    pregnancy: null,
    lastFedMinute: -1,
    natureMinute: p.minute,
    childKg: 0,
  }
}

/** A person's age now, in thousandths of a year. */
export const ageOf = (config: ValleyConfig, person: Forager, minute: number) =>
  ageMilli(config, person.birthMinute, minute)

/** A pregnancy's days, at least one. */
export const pregnancyDays = (config: ValleyConfig) =>
  Math.max(1, Math.floor((config.pregnancyMilliYears * config.daysPerYear) / 1_000))

/** The chance of conceiving on one night, per million. */
export const conceiveChance = (config: ValleyConfig) =>
  Math.min(1_000_000, Math.floor((config.fecundPerMillePerCycle * 12_000) / config.daysPerYear))

/** Whether a pregnancy comes to term at this minute: the midnight of its last day. */
export const birthDue = (config: ValleyConfig, person: Forager, minute: number) =>
  person.alive &&
  person.pregnancy !== null &&
  minute % MINUTES_PER_DAY === 0 &&
  dayOf(minute) >= person.pregnancy.day + pregnancyDays(config)

/** A person's nature recomputed for their age at `minute` and their pregnancy. */
export const natureAt = (config: ValleyConfig, person: Forager, minute: number) =>
  deriveNature(config, { ...person, ageMilli: bodyAge(config, person, minute), pregnant: person.pregnancy !== null })

/** The age a body is grown to at a minute: the age at the last midnight, or at birth if later (Life 19). */
export const bodyAge = (config: ValleyConfig, person: Pick<Forager, 'birthMinute'>, minute: number) =>
  ageMilli(config, person.birthMinute, Math.max(person.birthMinute, minute - (minute % MINUTES_PER_DAY)))

/** Sets a person's nature, recording the minute its rates changed. Changes the person in place. */
export function setNature(person: Forager, nature: PersonNature, minute: number) {
  Object.assign(person, nature)
  person.natureMinute = minute
}

/** Whether two people stand within talking distance at `minute`. */
export const withinTalk = (state: ValleyState, a: Forager, b: Forager, minute: number) => {
  const p = positionAt(state, a, minute),
    q = positionAt(state, b, minute)
  return distanceSq(p.x, p.y, q.x, q.y) <= state.config.talkRadiusCm ** 2
}

/**
 * Whether a woman can conceive at this midnight, every condition but the draw: living, aged from `pairFromYears` to
 * below `lastBirthYears`, paired with a living partner, not pregnant, no child of hers younger than
 * `amenorrheaMilliYears` born or fed from her in the last day, her energy at least her grown fecund reserve, and both she
 * and her partner asleep within talking distance.
 */
export function canConceive(state: ValleyState, woman: Forager, minute: number) {
  const { config } = state
  if (!woman.alive || woman.sex !== 0 || woman.pregnancy !== null || woman.partnerId === null) return false
  const age = ageOf(config, woman, minute)
  if (ageYears(age) < config.pairFromYears || age >= config.lastBirthYears * 1_000) return false
  const partner = state.foragers[woman.partnerId]!
  if (!partner.alive || woman.task?.kind !== 'sleep' || partner.task?.kind !== 'sleep') return false
  if (!withinTalk(state, woman, partner, minute)) return false
  const energy = woman.task ? energyAt(woman.task, minute, state.routes).kcal : woman.energyKcal
  if (energy < woman.fecundReserveKcal) return false
  for (const child of state.foragers)
    if (
      child.alive &&
      child.motherId === woman.id &&
      ageOf(config, child, minute) < config.amenorrheaMilliYears &&
      (child.birthMinute > minute - MINUTES_PER_DAY ||
        (child.lastFedMinute >= 0 && child.lastFedMinute > minute - MINUTES_PER_DAY))
    )
      return false
  return true
}

/** Grows every per-person array and index of the state for a person just added. Changes the state in place. */
export function addPerson(state: ValleyState, person: Forager) {
  const grow = (array: Int32Array) => {
    const next = new Int32Array(array.length + 1).fill(-1)
    next.set(array)
    return next
  }
  for (const other of state.foragers) {
    other.seenMinute = grow(other.seenMinute)
    other.metMinute = grow(other.metMinute)
    other.arrivalFrom = grow(other.arrivalFrom)
  }
  state.foragers.push(person)
  const chunk = chunkOf(state.layout.nav, person)
  state.personChunk = grow(state.personChunk)
  state.personChunk[person.id] = chunk
  state.peopleByChunk[chunk] = Int32Array.from([...state.peopleByChunk[chunk]!, person.id])
  const today = state.today as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(today))
    if (Array.isArray(value) && (key.endsWith('ById') || key === 'endEnergyKcal')) value.push(0)
  state.today.forageRates.push(person.forageRate)
  state.today.woodRates.push(person.woodRate)
  state.today.endEnergyKcal[person.id] = person.energyKcal
}

/**
 * A newborn as born, from their birth event alone: sex, body, traits and talents drawn from `birth:<mother>:<day>`, no
 * experience and the flaked axe's idea, the event's kcal of reserve, no water deficit, at the event's position and
 * hearth, in its group. The checker rebuilds a newborn's first record with it.
 */
export function newborn(config: ValleyConfig, layout: ValleyLayout, born: BornEvent): Forager {
  const draws = new NatureDraws(deriveBirthSeed(config.seed, born.motherId, dayOf(born.minute)))
  const nature = drawNature(config, draws, draws, bodyFactor(config), personalityFactor(config), 0)
  const talents: Talents = { forage: draws.normal(), wood: draws.normal(), craft: draws.normal() }
  const slots = 2 + config.axeTechniques.length
  const zero = () => Array.from({ length: slots }, () => 0)
  const skills = personSkills(
    config,
    talents,
    { experience: zero(), fadeRemainder: zero(), gainRemainder: zero() },
    1,
    nature.workPerMille,
  )
  const child = newPerson(config, layout, {
    id: born.foragerId,
    count: born.foragerId + 1,
    nature,
    skills,
    hearth: born.hearth,
    at: born.position,
    energyKcal: born.kcal,
    waterDeficitMl: 0,
    birthMinute: born.minute,
    motherId: born.motherId,
    fatherId: born.fatherId,
    minute: born.minute,
  })
  if (born.groupId !== null) {
    child.groupId = born.groupId
    child.joinedMinute = born.minute
    child.knownFlags = [born.groupId]
  }
  return child
}

/**
 * A birth at the mother's wake-up at the midnight her pregnancy comes to term: a new person with her as mother and her
 * partner at conception as father, at her position and hearth, in her group, with the newborn's reserve taken from her
 * body, as much as a newborn of their size starts with. Changes the state in place and returns the event.
 */
export function deliver(state: ValleyState, mother: Forager, minute: number): BornEvent {
  const { config } = state
  const pregnancy = mother.pregnancy!
  const draws = new NatureDraws(deriveBirthSeed(config.seed, mother.id, dayOf(minute)))
  const sized = drawNature(config, draws, draws, bodyFactor(config), personalityFactor(config), 0)
  const kcal = Math.min(sized.initialReserveKcal, mother.energyKcal)
  mother.energyKcal -= kcal
  const born: BornEvent = {
    kind: 'born',
    minute,
    foragerId: state.foragers.length,
    motherId: mother.id,
    fatherId: pregnancy.fatherId,
    sex: sized.sex,
    kcal,
    position: { x: mother.x, y: mother.y },
    hearth: mother.hearth,
    groupId: mother.groupId,
  }
  const child = newborn(config, state.layout, born)
  if (mother.groupId !== null) {
    const group = state.groups[mother.groupId]!
    const slot = group.hearthSlots[group.members.lastIndexOf(mother.id)]!
    group.members = [...group.members, child.id]
    group.hearthSlots = [...group.hearthSlots, slot]
    group.given = [...group.given, 0]
  }
  addPerson(state, child)
  mother.pregnancy = null
  setNature(mother, natureAt(config, mother, minute), minute)
  state.today.births += 1
  state.queue.schedule({ minute, phase: 1, id: child.id, kind: 'address' })
  return born
}

/**
 * Each person as their nature was at a minute of the interval from `before` to `after` (Life 19): a body changes only
 * at a midnight, by growth to the age at that midnight, by a conception or by a birth, so the nature at a minute is
 * the one derived for the age at the last midnight and whether the person was pregnant then. People whose nature last
 * changed at or before the minute are returned as they are in `after`.
 */
export function natureHistory(before: ValleyState, after: ValleyState) {
  const cache = new Map<string, Forager>()
  const life = after.lastInterval.filter((e) => e.kind === 'conceived' || e.kind === 'born' || e.kind === 'death') as (
    ConceivedEvent | BornEvent | { kind: 'death'; minute: number; foragerId: number }
  )[]
  return (id: number, minute: number): Forager => {
    const person = after.foragers[id]!
    if (person.natureMinute <= minute) return person
    let pregnant = (before.foragers[id]?.pregnancy ?? null) !== null
    for (const e of life) {
      if (e.minute > minute) break
      if (e.kind === 'conceived' && e.foragerId === id) pregnant = true
      if ((e.kind === 'born' && e.motherId === id) || (e.kind === 'death' && e.foragerId === id)) pregnant = false
    }
    const midnight = minute - (minute % MINUTES_PER_DAY)
    const key = `${id}:${midnight}:${pregnant}`
    let then = cache.get(key)
    if (!then) {
      then = {
        ...person,
        ...deriveNature(after.config, {
          ...person,
          ageMilli: bodyAge(after.config, person, minute),
          pregnant,
        }),
      }
      cache.set(key, then)
    }
    return then
  }
}

/** `before` with the people born during the interval to `after` added as they were born, so per-person replays cover them. */
export function withNewborns(before: ValleyState, after: ValleyState): ValleyState {
  if (after.foragers.length === before.foragers.length) return before
  const born = after.lastInterval.filter((e): e is BornEvent => e.kind === 'born')
  return { ...before, foragers: [...before.foragers, ...born.map((e) => newborn(after.config, after.layout, e))] }
}

/**
 * The `fate:<day>` draws at a midnight, by person id: one for each person living as the lifecycle began, in id order.
 * Read from any later state, since birth and death minutes never change.
 */
export function fateDraws(state: Pick<ValleyState, 'config' | 'foragers'>, minute: number) {
  let fate = deriveFateSeed(state.config.seed, dayOf(minute))
  const draws = new Map<number, number>()
  for (const person of state.foragers) {
    if (person.birthMinute >= minute || (person.deathMinute !== null && person.deathMinute < minute)) continue
    const draw = randomInt(fate, 1_000_000 * state.config.daysPerYear)
    fate = draw.state
    draws.set(person.id, draw.value)
  }
  return draws
}

/**
 * The lifecycle at midnight, after the day's land, spoilage, skills and ties (Life 19), in order: growth, deaths drawn,
 * births due, conceptions, so that everyone woken at midnight has the body grown for that day. `wake` wakes a person at once, dying of illness when given the draw; `address` wakes them
 * later in the same minute.
 */
export function lifecycle(
  state: ValleyState,
  minute: number,
  wake: (id: number, fate?: number) => ValleyEvent[],
  address: (id: number) => void,
): ValleyEvent[] {
  const { config } = state
  const events: ValleyEvent[] = []
  const day = dayOf(minute)
  const count = state.foragers.length
  for (const person of state.foragers) {
    if (!person.alive || !growing(config, person.ageMilli)) continue
    const next = natureAt(config, person, minute)
    if (next.ageMilli === person.ageMilli) continue
    setNature(person, next, minute)
    address(person.id)
  }
  for (const [id, draw] of fateDraws(state, minute))
    if (draw < deathHazard(config, ageOf(config, state.foragers[id]!, minute))) events.push(...wake(id, draw))
  for (let id = 0; id < count; id += 1) if (birthDue(config, state.foragers[id]!, minute)) events.push(...wake(id))
  let conceive = deriveConceiveSeed(config.seed, day)
  const chance = conceiveChance(config)
  for (let id = 0; id < state.foragers.length; id += 1) {
    const woman = state.foragers[id]!
    if (!canConceive(state, woman, minute)) continue
    const draw = randomInt(conceive, 1_000_000)
    conceive = draw.state
    if (draw.value >= chance) continue
    const event: ConceivedEvent = {
      kind: 'conceived',
      minute,
      foragerId: id,
      fatherId: woman.partnerId!,
      draw: draw.value,
    }
    events.push(event)
    woman.pregnancy = { day, fatherId: woman.partnerId! }
    setNature(woman, natureAt(config, woman, minute), minute)
    state.today.conceptions += 1
    address(id)
  }
  return events
}
