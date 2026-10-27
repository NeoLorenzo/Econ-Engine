import { personConfig } from '../valley/nature'
import { askOf, expectedQuality, usableAsk } from '../valley/axes'
import { energyAt } from '../valley/body'
import { dayOfYear, MINUTES_PER_DAY, seasonOf, yearOf, yearsToDays } from '../valley/calendar'
import { carriedByFood, carriedKcal, spoilsIn } from '../valley/food'
import { mixSeed, randomDraw } from '../sim/rng'
import { ringOf, fishCapacityKcal } from '../valley/config'
import { stepValley } from '../valley/engine'
import { campfireBurn } from '../valley/fire'
import { isDaylight, loadKg, loadOf, speedForLoad } from '../valley/forager'
import { hutOf, hutWhole, weathersOn } from '../valley/huts'
import { practicePercents } from '../valley/practice'
import { capacityOf } from '../valley/places'
import { knows, positionAlong } from '../valley/routes'
import { triangleAt } from '../valley/mesh'
import { siteKindOf } from '../valley/sites'
import { livingMembers } from '../valley/social'
import { positionAt } from '../valley/tasks'
import { GROUND_NAMES, cellOf, heightAt } from '../valley/terrain'
import { knownTerms, nightHours, nightWood, woodMatters } from '../valley/trade'
import { PLACE_KINDS } from '../valley/types'
import type { Group, Plants, Point, ValleyConfig, ValleyLayout, ValleyState } from '../valley/types'
import { decorPoints, foragerColor, foragerName, formatHours } from './display'

export { clockLabel, daylightAt, foragerName, formatKcal, sunAt, TERMS_COLORS } from './display'
export { foragerColor, formatHours }

/**
 * The simulation advances from wake-up to wake-up; the display does not. It keeps the state of the last `stepValley`
 * and a continuous minute less than one minute after it, and draws each person from their task record at that minute.
 * Every wake-up at or before the drawn minute has been processed, and none after it, so the task drawn is the task under
 * way.
 */
export interface Display {
  state: ValleyState
  /** The minute drawn, continuously: `state.minute <= minute < state.minute + 1`. */
  minute: number
}

export const startDisplay = (state: ValleyState): Display => ({ state, minute: state.minute })

export interface ValleySpeed {
  label: string
  minutesPerSecond: number
  /** At map speeds people are not drawn; stocks, groups and huts are redrawn as the clock advances. */
  map: boolean
}

/** From this speed up the valley is shown as a map of stocks, groups and huts, without people. */
export const mapSpeedMinutesPerSecond = MINUTES_PER_DAY

export const VALLEY_SPEEDS: ValleySpeed[] = [
  { label: '1 min / s', minutesPerSecond: 1, map: false },
  { label: '10 min / s', minutesPerSecond: 10, map: false },
  { label: '1 h / s', minutesPerSecond: 60, map: false },
  { label: '1 day / s', minutesPerSecond: MINUTES_PER_DAY, map: true },
  { label: '1 month / s', minutesPerSecond: 30 * MINUTES_PER_DAY, map: true },
  { label: '1 year / s', minutesPerSecond: 90 * MINUTES_PER_DAY, map: true },
]

/** The speed the page opens at: a person's walk is continuous, and work can be watched. */
export const DEFAULT_SPEED_INDEX = 0

/**
 * A long gap between frames (a background tab, a stall) counts as this many seconds at most, so returning to the page
 * resumes where it left off instead of leaping ahead.
 */
export const MAX_FRAME_SECONDS = 0.25

/**
 * High speeds are best effort: the engine gets about this long a frame, so the controls and renderer can run. At map
 * speeds no people are drawn, so a slower frame rate is acceptable.
 */
export const SIMULATION_FRAME_BUDGET_MS = 40

/**
 * A frame runs the engine in steps of at most this many minutes, checking its budget between them, so no frame runs far
 * past its budget. Early in a run a step takes about a millisecond; later, as people know more ground and plan longer
 * routes, an hour can take hundreds, so steps are short.
 */
export const SIMULATION_SLICE_MINUTES = 15

/**
 * Advances the displayed minute by the wall time elapsed at `speed`, running the engine up to the last whole minute at
 * or before it. When the engine cannot keep up within `budgetMs`, it stops at the last step finished, and the clock
 * advances less.
 */
export function advanceDisplay(
  display: Display,
  elapsedSeconds: number,
  speed: Pick<ValleySpeed, 'minutesPerSecond'>,
  budgetMs = SIMULATION_FRAME_BUDGET_MS,
  now: () => number = () => performance.now(),
): Display {
  const target = display.minute + Math.min(MAX_FRAME_SECONDS, Math.max(0, elapsedSeconds)) * speed.minutesPerSecond
  const toMinute = Math.floor(target)
  if (toMinute <= display.state.minute) return { state: display.state, minute: target }
  const started = now()
  let state = display.state
  do state = stepValley(state, Math.min(toMinute, state.minute + SIMULATION_SLICE_MINUTES))
  while (state.minute < toMinute && now() - started < budgetMs)
  return { state, minute: state.minute < toMinute ? state.minute : target }
}

/** Runs the engine to the next whole minute and shows it. */
export function stepDisplay(display: Display): Display {
  const state = stepValley(display.state, Math.floor(display.minute) + 1)
  return { ...display, state, minute: state.minute }
}

/** Minutes since midnight of day 0, continuously. */
export const displayMinutes = (display: Display) => display.minute

/** "Day 12 of year 1 · summer", counting days and years from 1. */
export function calendarLabel(config: ValleyConfig, minute: number) {
  const whole = Math.floor(minute)
  const season = ['spring', 'summer', 'autumn', 'winter'][seasonOf(config, whole)]
  return `Day ${dayOfYear(config, whole) + 1} of year ${yearOf(config, whole) + 1} · ${season}`
}

/** Valley centimetres to world metres, with the valley centred on the origin; y becomes z. */
export const toMetres = (config: ValleyConfig, x: number, y: number) => ({
  x: (x - config.valleySizeCm / 2) / 100,
  z: (y - config.valleySizeCm / 2) / 100,
})

export type Gesture = 'walk' | 'pick' | 'fish' | 'drink' | 'gather' | 'chop' | 'make' | 'stand' | 'sleep' | 'dead'

export interface ForagerPose {
  /** Its position in valley centimetres. */
  x: number
  y: number
  /** The way it faces, in radians about the vertical, or null to keep its last heading. */
  heading: number | null
  gesture: Gesture
  /** 0 standing, 1 lying down. */
  lying: number
}

/** How many minutes lying down takes on screen. */
const POSTURE_MINUTES = 0.25

const headingOf = (dx: number, dy: number) => (dx === 0 && dy === 0 ? null : Math.atan2(dx, dy))

const GESTURES: Record<string, Gesture> = {
  walk: 'walk',
  pick: 'pick',
  nuts: 'pick',
  fish: 'fish',
  drink: 'drink',
  gather: 'gather',
  cut: 'chop',
  make: 'make',
  sleep: 'sleep',
  rest: 'stand',
}

/**
 * Where a person is drawn and what they are doing at the displayed minute: along the recorded route while walking, and
 * at their place otherwise. Only the task record is read; nothing is stored per minute.
 */
export function foragerPose(display: Display, foragerId: number): ForagerPose {
  const { state } = display
  const person = state.foragers[foragerId]!
  const task = person.task
  if (!person.alive || !task) return { x: person.x, y: person.y, heading: null, gesture: 'dead', lying: 1 }
  const minute = Math.min(display.minute, task.endMinute)
  const at = positionAt(state, person, minute)
  const gesture = GESTURES[task.kind] ?? 'stand'
  let heading: number | null = null
  if (task.kind === 'walk') {
    const route = state.routes[task.routeId]
    if (route?.segments.length) {
      const ahead = positionAlong(route, minute - task.startMinute + 0.05)
      heading = headingOf(ahead.x - at.x, ahead.y - at.y)
    }
  } else if (task.placeId >= 0 && task.placeId < state.layout.places.count)
    heading = headingOf(state.layout.places.x[task.placeId]! - at.x, state.layout.places.y[task.placeId]! - at.y)
  const lying = task.kind === 'sleep' ? Math.min(1, Math.max(0, (minute - task.startMinute) / POSTURE_MINUTES)) : 0
  return { ...at, heading, gesture, lying }
}

/** The points of the route a person is walking, from its start to its end, or none. */
export function routePoints(state: ValleyState, foragerId: number): Point[] {
  const task = state.foragers[foragerId]!.task
  const route = task?.kind === 'walk' ? state.routes[task.routeId] : undefined
  if (!route?.segments.length) return []
  return [{ x: route.segments[0]!.x0, y: route.segments[0]!.y0 }, ...route.segments.map((s) => ({ x: s.x1, y: s.y1 }))]
}

/** Whether a person carries a log on their shoulder. */
export const carriesLog = (display: Display, foragerId: number) => display.state.foragers[foragerId]!.log > 0

/** Whether a person holds an axe. */
export const holdsAxe = (display: Display, foragerId: number) => {
  const person = display.state.foragers[foragerId]!
  return person.axe !== null || person.task?.kind === 'cut'
}

/** Decoration drawn for each place: bushes in a thicket, hazels in a hazel thicket, trees in a stand. */
export const BUSHES_PER_THICKET = 12
export const HAZELS_PER_THICKET = 6
export const ROCKS_PER_OUTCROP = 8

/**
 * Decoration plants: points within each place, with the place they stand in as `site` and their rank within it. They
 * are drawn from no simulation stream, and the engine reads none of them.
 */
export interface DecorPlants extends Plants {
  rank: Int32Array
  /** Plants drawn in each place of this kind. */
  per: number
}

export interface Decor {
  bushes: DecorPlants
  hazels: DecorPlants
  /** Bushes, then hazels. */
  foodPlants: DecorPlants
  trees: DecorPlants
  /** One stone heap at each outcrop's centre. */
  stones: DecorPlants
  /** The first decoration plant of each place, by place ID, in its kind's table. */
  firstOf: Int32Array
}

function decorTable(layout: ValleyLayout, kind: number, per: number, centred = false): DecorPlants {
  const { places } = layout
  const ids: number[] = []
  for (let id = 0; id < places.count; id += 1) if (places.kind[id] === kind) ids.push(id)
  const count = ids.length * per
  const table = {
    count,
    per,
    x: new Int32Array(count),
    y: new Int32Array(count),
    site: new Int32Array(count),
    rank: new Int32Array(count),
  }
  for (const [index, id] of ids.entries()) {
    const place = { id, x: places.x[id]!, y: places.y[id]!, radiusCm: places.radiusCm[id]! }
    const points = centred ? [{ x: place.x, y: place.y }] : decorPoints(place, per)
    for (const [rank, point] of points.entries()) {
      const slot = index * per + rank
      table.x[slot] = point.x
      table.y[slot] = point.y
      table.site[slot] = id
      table.rank[slot] = rank
    }
  }
  return table
}

const joinDecor = (a: DecorPlants, b: DecorPlants): DecorPlants => {
  const join = <T extends Int32Array>(p: T, q: T) => {
    const out = new Int32Array(p.length + q.length)
    out.set(p)
    out.set(q, p.length)
    return out
  }
  return {
    count: a.count + b.count,
    per: a.per,
    x: join(a.x, b.x),
    y: join(a.y, b.y),
    site: join(a.site, b.site),
    rank: join(a.rank, b.rank),
  }
}

const decorCache = new WeakMap<ValleyLayout, Decor>()

export function decorOf(state: Pick<ValleyState, 'config' | 'layout'>): Decor {
  const saved = decorCache.get(state.layout)
  if (saved) return saved
  const { layout, config } = state
  const bushes = decorTable(layout, 0, BUSHES_PER_THICKET)
  const hazels = decorTable(layout, 1, HAZELS_PER_THICKET)
  const trees = decorTable(layout, 2, Math.max(1, Math.floor(config.standLogs / config.logsPerTree)))
  const stones = decorTable(layout, 3, 1, true)
  const firstOf = new Int32Array(layout.places.count).fill(-1)
  for (const table of [bushes, hazels, trees, stones])
    for (let slot = table.count - 1; slot >= 0; slot -= 1) firstOf[table.site[slot]!] = slot
  const decor = { bushes, hazels, foodPlants: joinDecor(bushes, hazels), trees, stones, firstOf }
  decorCache.set(layout, decor)
  return decor
}

/** A plant the inspector can show, by its decoration ID: a bush, a hazel (by food plant ID) or a tree. */
export type PlantKind = 'bush' | 'hazel' | 'tree'

/** The place a decoration plant stands in. */
export function placeOfPlant(state: ValleyState, kind: PlantKind | 'stone', id: number) {
  const decor = decorOf(state)
  const table = kind === 'tree' ? decor.trees : kind === 'stone' ? decor.stones : decor.foodPlants
  return table.site[id]!
}

/**
 * How full a bush's berries or a hazel's nuts are drawn, 0–1: the place's stock shared out among its plants in turn,
 * so what is drawn stays proportional to what is there. `id` counts bushes, or hazels, from 0.
 */
export function plantFill(display: Display, kind: 'bush' | 'hazel', id: number) {
  const { state } = display
  const table = kind === 'bush' ? decorOf(state).bushes : decorOf(state).hazels
  const place = table.site[id]!
  const share = state.foodStock[place]! / Math.max(1, capacityOf(state.config, PLACE_KINDS[kind === 'bush' ? 0 : 1]))
  return Math.min(1, Math.max(0, share * table.per - table.rank[id]!))
}

/** The logs a tree in a stand holds: the stand's logs shared out, so the last trees are cut first. */
function treeLogs(state: ValleyState, tree: number) {
  const { trees } = decorOf(state)
  const per = state.config.logsPerTree
  return Math.min(per, Math.max(0, state.logStock[trees.site[tree]!]! - trees.rank[tree]! * per))
}

/**
 * How a tree is drawn. A standing tree's crown is whole, and the dead branches beneath it, `deadwood` of a full share,
 * follow its stand's wood. A felled tree lies beside its stump, its trunk as long as the logs left in it.
 */
export function treeShape(display: Display, tree: number) {
  const { state } = display
  const { config } = state
  const logs = treeLogs(state, tree)
  if (logs >= config.logsPerTree) {
    const wood = state.woodStock[decorOf(state).trees.site[tree]!]!
    return { felled: false, trunk: 1, crown: 1, deadwood: Math.min(1, wood / Math.max(1, config.standWoodKg)) }
  }
  return { felled: true, deadwood: 0, trunk: logs / config.logsPerTree, crown: logs > 0 ? 0.6 : 0 }
}

/** A tree as the inspector names it: standing, lying felled with logs left, or a bare stump. */
export function treeState(state: ValleyState, tree: number): 'standing' | 'felled' | 'stump' {
  const logs = treeLogs(state, tree)
  return logs >= state.config.logsPerTree ? 'standing' : logs > 0 ? 'felled' : 'stump'
}

/** Stones drawn on an outcrop's heap: its stones' share of full, out of `ROCKS_PER_OUTCROP`. */
export const rocksShown = (state: ValleyState, spot: number) =>
  Math.ceil(
    (ROCKS_PER_OUTCROP * state.stoneStock[decorOf(state).stones.site[spot]!]!) /
      Math.max(1, state.config.outcropStones),
  )

/**
 * A forager's three skills today, born skill times practice, in percent, each with the most any forager could reach
 * (the top of its born range times the top of practice), so the HUD can draw them on one scale.
 */
export function skillLevels(state: ValleyState, id: number) {
  const { config } = state
  const forager = state.foragers[id]!
  const percent = practicePercents(config, forager.practiceLog)
  const top = (bornMax: number, practice: boolean) => (bornMax * (practice ? config.practiceMaxPercent : 100)) / 100
  return [
    {
      key: 'picking',
      label: 'Picking',
      percent: Math.round((forager.foragingSkill * percent.forage) / 100),
      max: top(config.skillMaxPercent, true),
    },
    {
      key: 'wood',
      label: 'Wood',
      percent: Math.round((forager.woodSkill * percent.gather) / 100),
      max: top(config.skillMaxPercent, true),
    },
    { key: 'axes', label: 'Axes', percent: forager.craft, max: top(config.craftSkillMaxPercent, config.craftPractice) },
  ]
}

/** A forager's thirst on a scale from none to the water loss that kills, with the thirsty and urgent marks on it. */
export function thirstLevel(state: ValleyState, id: number) {
  const { config } = state
  const forager = state.foragers[id]!
  const ml = (perMille: number) => forager.weightKg * perMille
  const urgent = ml(config.urgentThirstBodyPerMille)
  return {
    ml: forager.waterDeficitMl,
    maxMl: ml(config.fatalWaterLossBodyPerMille),
    thirstyMl: ml(config.thirstBodyPerMille),
    urgentMl: urgent,
    label: forager.waterDeficitMl >= urgent ? 'Severely thirsty' : forager.thirsty ? 'Thirsty' : 'Not thirsty',
    level: forager.waterDeficitMl >= urgent ? 'urgent' : forager.thirsty ? 'thirsty' : 'fine',
  }
}

/**
 * How many days a forager's reserve would last at the rate it has been losing it, over up to the last three whole
 * days: null while it holds steady or gains, or before two days have ended.
 */
export function daysOfFoodLeft(state: ValleyState, id: number) {
  const forager = state.foragers[id]
  if (!forager?.alive) return null
  const recent = state.days.slice(-4)
  if (recent.length < 2) return null
  const lossPerDay =
    (recent[0]!.endEnergyKcal[id]! - recent[recent.length - 1]!.endEnergyKcal[id]!) / (recent.length - 1)
  return lossPerDay > 0 ? forager.energyKcal / lossPerDay : null
}

/**
 * Shares `amount` out among `count` parts one after another, each from 0 (empty) to 1 (full). The fills add up to the
 * amount's share of capacity, so what is drawn stays proportional to what is there. The last parts empty first.
 */
export const fillInTurn = (amount: number, capacity: number, count: number) =>
  Array.from({ length: count }, (_, index) =>
    Math.min(1, Math.max(0, (Math.max(0, amount) / capacity) * count - index)),
  )

/** Berries drawn on each bush, and clusters of nuts on each hazel. */
export const BERRIES_PER_BUSH = 10
export const NUTS_PER_HAZEL = 8

/** How a plant looks: fixed by its kind and ID, so it looks the same in every run, and drawn from no simulation stream. */
export interface PlantLook {
  /** Relative size, about 1. */
  size: number
  /** A turn about its own axis. */
  turn: number
}

const LOOK_SALT = { bush: 0x4255_5348, hazel: 0x4841_5a45, tree: 0x5452_4545 } as const

export function plantLook(kind: PlantKind, id: number): PlantLook {
  const first = randomDraw(mixSeed((id ^ LOOK_SALT[kind]) >>> 0))
  const second = randomDraw(first.state)
  return { size: 0.85 + first.value * 0.3, turn: second.value * Math.PI * 2 }
}

/** A person's energy at the displayed minute, from their task record. */
export function displayedEnergy(display: Display, foragerId: number) {
  const person = display.state.foragers[foragerId]!
  if (!person.alive || !person.task) return person.energyKcal
  const minute = Math.max(person.task.startMinute, Math.floor(display.minute))
  return Math.max(0, energyAt(person.task, minute, display.state.routes).kcal)
}

/** The wood a forager holds and the food it carries. */
export function displayedLoad(display: Display, foragerId: number) {
  const person = display.state.foragers[foragerId]!
  // The wood gathered on this trip is on its back; the rest of what it holds is stacked by its hearth or hut.
  const onBack = Math.min(person.wood, person.tripWood)
  return { onBack, atHearth: person.wood - onBack, carriedKcal: carriedKcal(person.carried) }
}

/** A bundle of firewood on a forager's back, or a stack by its hearth: none without wood, full size at `full`. */
export const bundleScale = (wood: number, load: number) =>
  wood <= 0 ? 0 : 0.35 + 0.65 * Math.min(1, Math.sqrt(wood / Math.max(1, load)))

/** A parcel of food at a forager's hip: none without food, full size from 2,000 kcal. */
export const parcelScale = (kcal: number) => (kcal <= 0 ? 0 : 0.4 + 0.6 * Math.min(1, Math.sqrt(kcal / 2_000)))

export const aliveCount = (state: ValleyState) => state.foragers.filter((forager) => forager.alive).length

/** The forager to follow after `current` in `direction`, wrapping around, through the living while any live. */
export function stepFollowed(state: ValleyState, current: number, direction: 1 | -1) {
  const count = state.foragers.length
  const anyAlive = state.foragers.some((forager) => forager.alive)
  for (let step = 1; step <= count; step += 1) {
    const id = (((current + direction * step) % count) + count) % count
    if (!anyAlive || state.foragers[id]!.alive) return id
  }
  return current
}

/** What a night by one's own fire burns in wood and saves in food, or null where nights are not cold. */
export function fireSaving(config: ValleyConfig) {
  if (!woodMatters(config)) return null
  return {
    wood: nightWood(config),
    kcal: nightHours(config) * (config.coldSleepKcalPerHour - config.fireSleepKcalPerHour),
  }
}

/** A site by name: thickets, hazel thickets, stands and outcrops each counted from 1. */
export function siteName(config: ValleyConfig, site: number) {
  const { kind, index } = siteKindOf(config, site)
  return `${kind === 'hazel' ? 'hazel thicket' : kind} ${index + 1}`
}

/** An axe in a phrase: its quality, the logs it has left, and who made it. */
export const axePhrase = (axe: { quality: number; logsLeft: number; makerId: number }, holderId: number) =>
  `quality ${axe.quality}, ${axe.logsLeft} log${axe.logsLeft === 1 ? '' : 's'} left, made by ${axe.makerId === holderId ? 'itself' : foragerName(axe.makerId)}`

/** Groups are named by letter in order of founding: A to Z, then A2 to Z2, and so on. */
export const groupName = (id: number) =>
  `Group ${String.fromCharCode(65 + (id % 26))}${id >= 26 ? Math.floor(id / 26) + 1 : ''}`

/** Flag colours, distinct from the cyan-to-gold scale that colours each forager by what it is good at. */
export const GROUP_COLORS = ['#e4572e', '#9b5de5', '#f15bb5', '#3a86ff', '#f5f5f5', '#a3e635', '#8d5a3b', '#ff006e']

export const groupColor = (id: number) => GROUP_COLORS[id % GROUP_COLORS.length]!

const REASONS: Partial<Record<string, string>> = {
  drinking: 'Drinking',
  'seeking water': 'Seeking drinking water on known ground',
  'no known route': 'No known route; resting and looking for access',
  'going home': 'Walking home to its hearth',
  night: 'Sleeping through the night',
  'filling a load': 'Gathering wood to fill a load',
  satiated: 'Resting, well fed',
  'waiting to swap': 'Resting, carrying food to swap for wood',
  'too late to set out': 'Too late in the day to set out',
  'waiting for regrowth': 'Waiting for food or wood to grow',
  foraging: 'Picking berries',
  'gathering nuts': 'Gathering hazelnuts',
  fishing: 'Fishing from the shore',
  gathering: 'Gathering firewood',
  'seeking food': 'Walking to food',
  'seeking wood': 'Walking to gather firewood',
  'seeking company': 'Looking for company',
  'waiting for company': 'Waiting for company at a flag',
  exploring: 'Exploring ground it has never seen',
  searching: 'Searching for food or wood',
  checking: 'Checking what a place holds',
  'taking a load home': 'Taking firewood home',
  'taking a log home': 'Carrying a log home for its hut',
  'making an axe': 'Making an axe',
  'going home to make an axe': 'Walking home to make an axe',
  'cutting a log': 'Cutting a log',
  'seeking a tree': 'Walking to a tree to cut a log for its hut',
  'waiting for an axe being made': 'Waiting for an axe someone promised to make',
  'going home to wait for an axe': 'Walking home to wait for a promised axe',
  'picking food to buy an axe': 'Gathering food to buy an axe',
  'taking food home to buy an axe': 'Taking food home to buy an axe',
  'waiting to buy an axe': 'Waiting at home with food to buy an axe',
  'fetching a stone': 'Walking to an outcrop for a stone to make an axe',
  'picking up a stone': 'Picking up a stone',
}

/** What a person is doing, in a few words, from their task. */
export function describeActivity(display: Display, foragerId: number) {
  const { state } = display
  const person = state.foragers[foragerId]!
  if (!person.alive) return `Dead of ${person.deathCauses.join(' and ')}`
  const task = person.task
  if (!task) return 'Waiting to start'
  const place =
    task.placeId >= 0 && task.placeId < state.layout.places.count ? siteName(state.config, task.placeId) : null
  const what = REASONS[task.reason] ?? task.reason
  if (task.kind === 'sleep') {
    if (task.wholeHut) return task.groupId != null ? 'Sleeping in its hut by its group’s fire' : 'Sleeping in its hut'
    return person.warm ? 'Sleeping warm by a fire' : 'Sleeping cold, with no fire'
  }
  return place && task.kind !== 'walk' ? `${what} at ${place}` : what
}

/** The followed person's task and next wake-up, for the person panel. */
export function taskSummary(state: ValleyState, foragerId: number) {
  const task = state.foragers[foragerId]!.task
  const next = state.queue.entriesOf(foragerId).sort((a, b) => a.minute - b.minute)[0] ?? null
  return task
    ? {
        kind: task.kind,
        reason: task.reason,
        startMinute: task.startMinute,
        endMinute: task.endMinute,
        nextWake: next && { minute: next.minute, kind: next.kind },
      }
    : null
}

/** Minutes as a short phrase: "40 min", "3 h 5 min", "2 d 4 h". */
export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours >= 24) return formatHours(hours)
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

const seenLabel = (state: ValleyState, seen: number) => {
  if (seen < 0) return 'never'
  const ago = state.minute - seen
  return ago <= 0 ? 'this minute' : `${formatMinutes(ago)} ago`
}

/** What the inspector shows for a bush, hazel or tree: its place's truth beside what the followed forager believes. */
export function plantInspection(state: ValleyState, kind: PlantKind, id: number, foragerId: number) {
  const forager = state.foragers[foragerId]!
  const { config } = state
  const place = placeOfPlant(state, kind, id)
  const tree = kind === 'tree'
  const stock = tree ? state.woodStock[place]! : state.foodStock[place]!
  const checked = forager.placeCheckedMinute[place]!
  const remembered = checked < 0 ? null : tree ? forager.placeWood[place]! : forager.placeStock[place]!
  const felled = tree ? state.logRegrowth.get(place) : undefined
  const regrowMinute = felled?.length
    ? Math.min(...felled) + yearsToDays(config, config.treeRegrowthYears) * MINUTES_PER_DAY
    : null
  return {
    /** A thicket's sticks, and a tree's state: standing, felled, or a stump whose stand grows back in some days. */
    sticks: kind === 'bush' ? state.woodStock[place]! : null,
    sticksCapacity: config.berryThicketWoodKg,
    treeState: tree ? treeState(state, id) : null,
    regrowsInDays:
      regrowMinute === null ? null : Math.max(1, Math.ceil((regrowMinute - state.minute) / MINUTES_PER_DAY)),
    name: `${kind === 'bush' ? 'Bush' : kind === 'hazel' ? 'Hazel' : 'Tree'} in ${siteName(config, place)}`,
    stock,
    capacity: tree ? config.standWoodKg : capacityOf(config, PLACE_KINDS[kind === 'bush' ? 0 : 1]),
    /** Null if it has never checked the place. */
    remembered,
    seen: seenLabel(state, checked),
    difference: remembered === null ? 0 : stock - remembered,
    /** A stand's logs, and what the followed forager last saw of them. */
    logs: tree ? state.logStock[place]! : null,
    logsCapacity: config.standLogs,
    logsRemembered: tree && checked >= 0 ? forager.placeLogs[place]! : null,
  }
}

/** What the inspector shows for the lake: its fish, beside what the followed forager found when it last fished. */
export function lakeInspection(state: ValleyState, foragerId: number, bodyIndex = 0) {
  const forager = state.foragers[foragerId]!
  const body = state.layout.terrain.water.bodies[bodyIndex]
  const stock = state.fish[bodyIndex]
  const memory = body ? forager.fishMemory.get(body.id) : undefined
  return {
    name: body ? `${body.kind === 'lake' ? 'Lake' : 'River reach'} ${body.id}` : 'Water',
    stock: stock?.stock ?? 0,
    capacity: stock?.capacity ?? 0,
    hectares: (body?.areaM2 ?? 0) / 10_000,
    known: [...forager.knownBanks.values()].some((bank) => bank.bodyId === body?.id),
    /** Null if it has never fished here. */
    remembered: memory?.stock ?? null,
    fished: seenLabel(state, memory?.minute ?? -1),
  }
}

/** What the inspector shows for an outcrop: its stones beside what the followed forager last saw. */
export function stoneInspection(state: ValleyState, id: number, foragerId: number) {
  const forager = state.foragers[foragerId]!
  const place = placeOfPlant(state, 'stone', id)
  const checked = forager.placeCheckedMinute[place]!
  return {
    name: `Stones at ${siteName(state.config, place)}`,
    stones: state.stoneStock[place]!,
    capacity: state.config.outcropStones,
    remembered: checked < 0 ? null : forager.placeStock[place]!,
    seen: seenLabel(state, checked),
  }
}

/** What the inspector shows for a hut: whose it is, its logs, and when it next loses one to the weather. */
export function hutInspection(state: ValleyState, hutId: number) {
  const hut = state.huts[hutId]!
  const day = Math.floor(state.minute / MINUTES_PER_DAY)
  let next = day + 1
  while (!weathersOn(state, hut, next)) next += 1
  return {
    name: `${foragerName(hut.builderId)}’s hut`,
    logs: hut.logs,
    capacity: state.config.hutLogs,
    whole: hut.logs >= state.config.hutLogs,
    abandoned: hut.abandonedMinute !== null,
    /** Days until it next loses a log, if it has one to lose. */
    weathersInDays: hut.logs > 0 ? next - day : null,
  }
}

/** A hut's logs, as drawn. */
export const displayedHutLogs = (display: Display, hutId: number) => display.state.huts[hutId]?.logs ?? 0

/** What a group's fire holds and whether it burns, or null without shared fires or once the group has dissolved. */
export function campfireOf(state: ValleyState, groupId: number) {
  const group = state.groups[groupId]!
  if (group.dissolvedMinute !== null) return null
  const burn = campfireBurn(state.config)
  return {
    wood: group.fireWood,
    lit: group.fireLit,
    /** Nights of burning in the wood it holds. */
    nights: group.fireWood / (burn * nightHours(state.config)),
    burnPerHour: burn,
  }
}

/**
 * How a group's fire looks at the displayed minute: burning while it is lit; banked by day while it holds wood; out at
 * night when it is not lit, or by day with no wood. Its size follows the nights of wood it holds.
 */
export function campfireAt(display: Display, groupId: number) {
  const fire = campfireOf(display.state, groupId)
  if (!fire) return null
  const minute = Math.floor(display.minute)
  const look: 'burning' | 'banked' | 'out' = fire.lit
    ? 'burning'
    : isDaylight(display.state.config, minute) && fire.wood > 0
      ? 'banked'
      : 'out'
  return { look, wood: fire.wood, size: Math.min(1, fire.nights) }
}

export interface Contribution {
  id: number
  name: string
  color: string
  /** Alive and still in the group. */
  member: boolean
  alive: boolean
  /** Wood it has put into the group's fire since it joined, and into fires today. */
  given: number
  givenToday: number
  /** Its share of all the wood the group's fire has been given. */
  share: number
  /** Wood it has gathered since the run began. */
  gathered: number
  woodBought: number
  woodSold: number
  kcalPaid: number
  kcalReceived: number
  /** Hours it has slept warm by a group's fire. */
  warmHours: number
}

/** Each forager that ever joined a group: what it has given the group's fire, gathered, swapped and been warmed by. */
export function groupContributions(state: ValleyState, groupId: number): Contribution[] {
  const group = state.groups[groupId]!
  const total = sum(group.given)
  return group.members.map((id, slot) => {
    const forager = state.foragers[id]!
    const gathered = sum(state.days.map((day) => day.gatheredWoodById[id]!)) + state.today.gatheredWoodById[id]!
    return {
      id,
      name: foragerName(id),
      color: foragerColor(state.config, forager),
      member: forager.alive && forager.groupId === groupId,
      alive: forager.alive,
      given: group.given[slot]!,
      givenToday: state.today.fireGivenById[id]!,
      share: total ? group.given[slot]! / total : 0,
      gathered,
      ...forager.swapTotals,
      warmHours: forager.warmByFireMinutes / 60,
    }
  })
}

/** One sentence on who feeds a group's fire: who has given the most, and who, if anyone, has given nothing. */
export function contributionNote(contributions: readonly Contribution[]) {
  const total = sum(contributions.map((row) => row.given))
  if (!total) return 'No one has put wood into its fire yet.'
  const top = contributions.reduce((best, row) => (row.given > best.given ? row : best))
  const even = total / contributions.length
  const nothing = contributions.filter((row) => row.given === 0).map((row) => row.name)
  const lead = `${top.name} has given the most, ${Math.round(top.share * 100)}% of its wood (${(top.given / even).toFixed(1)} times an even share).`
  if (!nothing.length) return `${lead} Everyone has given some.`
  return `${lead} ${nothing.join(', ')} ${nothing.length === 1 ? 'has' : 'have'} given nothing.`
}

export interface AxeRow {
  id: number
  name: string
  color: string
  member: boolean
  alive: boolean
  madeOwn: number
  madeForSale: number
  sold: number
  bought: number
  kcalReceived: number
  kcalPaid: number
  craft: number
  /** The quality of the axe it holds, or null. */
  axeQuality: number | null
  hutLogs: number
}

/** Each forager that ever joined a group: the axes it has made, sold and bought, its craft and its axe. */
export function groupAxes(state: ValleyState, groupId: number): AxeRow[] {
  return state.groups[groupId]!.members.map((id) => {
    const forager = state.foragers[id]!
    const hut = hutOf(state, forager)
    return {
      id,
      name: foragerName(id),
      color: foragerColor(state.config, forager),
      member: forager.alive && forager.groupId === groupId,
      alive: forager.alive,
      ...forager.axeTotals,
      craft: forager.craft,
      axeQuality: forager.axe?.quality ?? null,
      hutLogs: hut?.logs ?? 0,
    }
  })
}

/** One sentence on who makes the group's axes for others, if anyone has sold one. */
export function axesNote(rows: readonly AxeRow[]) {
  const sold = sum(rows.map((row) => row.sold))
  if (!sold) return 'No one has sold an axe yet: everyone has made their own.'
  const top = rows.reduce((best, row) => (row.sold > best.sold ? row : best))
  const buyers = rows.filter((row) => row.bought > 0).length
  return `${top.name} has made the most axes for others, ${top.sold} of the ${sold} sold, to ${buyers} buyer${buyers === 1 ? '' : 's'}.`
}

/**
 * What the group card shows: when the group was founded, each living member with what it is doing and carrying, the
 * wood and food its members hold, the exchanges among them over the last day, its fire, and its axes.
 */
export function groupInspection(display: Display, groupId: number) {
  const { state } = display
  const group = state.groups[groupId]!
  const living = livingMembers(state, group)
  const members = living.map((id) => ({
    id,
    name: foragerName(id),
    color: foragerColor(state.config, state.foragers[id]!),
    activity: describeActivity(display, id),
    loadKg: loadKg(state.config, loadOf(state.foragers[id]!)),
  }))
  const since = state.minute - MINUTES_PER_DAY
  const inGroup = new Set(living)
  let swaps = 0
  for (const day of state.eventDays.slice(-2))
    for (const made of day)
      if (made.kind === 'exchange' && made.minute >= since && inGroup.has(made.sellerId) && inGroup.has(made.buyerId))
        swaps += 1
  const contributions = groupContributions(state, groupId)
  const axes = groupAxes(state, groupId)
  return {
    name: groupName(groupId),
    color: groupColor(groupId),
    founded: group.foundedMinute,
    foundedAgo: Math.max(0, state.minute - group.foundedMinute),
    dissolved: group.dissolvedMinute !== null,
    members,
    joinedEver: group.members.length,
    wood: sum(living.map((id) => state.foragers[id]!.wood)),
    foodKcal: sum(living.map((id) => carriedKcal(state.foragers[id]!.carried))),
    swapsLastDay: swaps,
    fire: campfireOf(state, groupId),
    /** Night hours its fire has burned and been out since the group was founded. */
    litHours: group.litHours,
    darkHours: group.darkHours,
    contributions,
    contributionNote: contributions.length ? contributionNote(contributions) : null,
    axes,
    axesNote: axesNote(axes),
    hutsWhole: living.filter((id) => hutWhole(state, state.foragers[id]!)).length,
  }
}

/**
 * The direction from a member's hut to its group's fire, as a unit vector in metres, or null for a forager whose hut
 * is not on a ring round a flag. The hut's door faces the fire, and its builder sleeps with its feet towards it.
 */
export function towardFire(state: ValleyState, foragerId: number, x: number, y: number) {
  const forager = state.foragers[foragerId]!
  const group = forager.groupId === null ? null : state.groups[forager.groupId]!
  if (!group) return null
  const dx = group.flag.x - x
  const dy = group.flag.y - y
  const length = Math.hypot(dx, dy)
  return length === 0 ? null : { x: dx / length, z: dy / length }
}

/** How far the coloured ground round a group's base reaches: past the outer ring of its huts, in centimetres. */
export function baseRadiusCm(config: ValleyConfig, group: Group) {
  return ringOf(Math.max(1, group.members.length) - 1) * config.hutRingCm + 350
}

/** The middle of a group's flag and living members, and how far from it the farthest lies, to frame the group. */
export function groupFrame(state: ValleyState, groupId: number) {
  const group = state.groups[groupId]!
  const points = [group.flag, ...livingMembers(state, group).map((id) => state.foragers[id]!)]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = (Math.min(...xs) + Math.max(...xs)) / 2
  const y = (Math.min(...ys) + Math.max(...ys)) / 2
  const farthest = Math.max(...points.map((point) => Math.hypot(point.x - x, point.y - y)))
  return { x, y, radiusCm: Math.max(baseRadiusCm(state.config, group), farthest) }
}

export interface SiteRing {
  site: number
  x: number
  y: number
  radiusCm: number
  /** Checked within `exploreAfterHours`. */
  fresh: boolean
}

/** The places the followed forager knows, and whether it checked each lately. */
export function siteRings(state: ValleyState, foragerId: number): SiteRing[] {
  const { config, layout } = state
  const forager = state.foragers[foragerId]!
  const rings: SiteRing[] = []
  for (let site = 0; site < layout.places.count; site += 1) {
    if (forager.knownPlaces[site]! < 0) continue
    const checked = forager.placeCheckedMinute[site]!
    const fresh = checked >= 0 && state.minute - checked < 60 * config.exploreAfterHours
    rings.push({
      site,
      x: layout.places.x[site]!,
      y: layout.places.y[site]!,
      radiusCm: layout.places.radiusCm[site]!,
      fresh,
    })
  }
  return rings
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

/** What the HUD says about a forager's skills, practice, wood, load, food and swaps. */
export function foragerSummary(state: ValleyState, foragerId: number) {
  const forager = state.foragers[foragerId]!
  const { config } = state
  const terms = knownTerms(config, forager, state.minute)
  const percent = practicePercents(config, forager.practiceLog)
  const yesterday = state.days.at(-1)
  const kg = loadKg(config, loadOf(forager))
  const hut = hutOf(state, forager)
  const ask = usableAsk(state, forager, state.minute) ?? forager.heardAsk
  const known = forager.knownPlaces.filter((minute) => minute >= 0).length
  return {
    forageRate: forager.forageRate,
    nutRate: forager.nutRate,
    fishRate: forager.fishRate,
    woodRate: forager.woodRate,
    forageRateChange: yesterday ? forager.forageRate - yesterday.forageRates[foragerId]! : 0,
    woodRateChange: yesterday ? forager.woodRate - yesterday.woodRates[foragerId]! : 0,
    foragePercent: percent.forage,
    woodPercent: percent.gather,
    /** Hours behind each practice percentage, over the last `practiceDays` days. */
    forageHours: Math.round(sum(forager.practiceLog.forage) / 3_600),
    gatherHours: Math.round(sum(forager.practiceLog.gather) / 3_600),
    ownTerms: forager.forageRate / forager.woodRate,
    wood: forager.wood,
    woodTarget: forager.woodStockTarget,
    tripWood: forager.tripWood,
    carriedKcal: carriedKcal(forager.carried),
    /** Its carried food by kind, in kilocalories. */
    carriedByFood: carriedByFood(forager.carried),
    /** Minutes until the first of its food spoils; null if it carries none or what it carries keeps. */
    spoilsInMinutes: spoilsIn(config, forager.carried, state.minute),
    /** Its born foraging skill, in percent. */
    foragingSkill: forager.foragingSkill,
    heardTerms: terms,
    heardMinutesAgo: terms === null ? null : Math.max(0, state.minute - forager.heardTerms!.minute),
    ...forager.swapTotals,
    groupId: forager.groupId,
    /** Its fellow living members, by name. */
    fellows:
      forager.groupId === null
        ? []
        : livingMembers(state, state.groups[forager.groupId]!)
            .filter((id) => id !== foragerId)
            .map(foragerName),
    joinedMinutesAgo: forager.joinedMinute === null ? null : Math.max(0, state.minute - forager.joinedMinute),
    /** The share of the valley's places it knows. */
    seenShare: known / Math.max(1, state.layout.places.count),
    /** What it carries, in kilograms, and how fast that lets it walk on the flat, in km/h. */
    loadKg: kg,
    speedKmh: (speedForLoad(config, kg) * 36) / 1_000,
    /** The ground it stands on and its height above the lake in metres. */
    ground: GROUND_NAMES[state.layout.ground[cellOf(state.layout.terrain, forager.x, forager.y)]!]!,
    heightM: heightAt(state.layout.terrain, forager.x, forager.y) / 100,
    sitesKnown: known,
    sitesTotal: state.layout.places.count,
    /** Places it has checked within `exploreAfterHours`. */
    sitesCheckedLately: forager.placeCheckedMinute.filter(
      (checked) => checked >= 0 && state.minute - checked < 60 * config.exploreAfterHours,
    ).length,
    /** The wood it has put into fires, and its group's fire, if it sleeps by one. */
    fireGiven: forager.fireGiven,
    groupFire: forager.groupId === null ? null : campfireOf(state, forager.groupId),
    /** Its craft, practice at making axes and the hours behind it, and what an axe costs it and is worth to it. */
    craft: forager.craft,
    craftSkill: forager.craftSkill,
    makePercent: percent.make,
    makeHours: Math.round(sum(forager.practiceLog.make) / 3_600),
    ask: askOf(personConfig(config, forager), forager.craft),
    expectedQuality: expectedQuality(forager.craft),
    axe: forager.axe ? axePhrase(forager.axe, foragerId) : null,
    spareAxe: forager.spareAxe ? axePhrase(forager.spareAxe, foragerId) : null,
    /** How far along an axe in the making is, 0–1, and whether it is for sale. */
    making: forager.making
      ? { done: forager.making.worked / forager.making.needed, forSale: forager.making.forSale }
      : null,
    promised: forager.promised,
    heardAsk:
      ask && state.minute - ask.minute <= 60 * config.termsMemoryHours
        ? { ...ask, from: foragerName(ask.sellerId), minutesAgo: Math.max(0, state.minute - ask.minute) }
        : null,
    hutLogs: hut?.logs ?? null,
    hutWhole: hutWhole(state, forager),
    log: forager.log,
    stone: forager.stone,
    ...forager.axeTotals,
  }
}

/** The band's highest and lowest own terms each day, and the followed forager's, for the chart over time. */
export function ownTermsByDay(state: ValleyState, foragerId: number) {
  return state.days.flatMap((day) => {
    const terms = day.forageRates.flatMap((rate, id) => (day.endEnergyKcal[id]! > 0 ? [rate / day.woodRates[id]!] : []))
    if (!terms.length) return []
    const followed = day.endEnergyKcal[foragerId]! > 0 ? day.forageRates[foragerId]! / day.woodRates[foragerId]! : null
    return [{ day: day.day + 1, highest: Math.max(...terms), lowest: Math.min(...terms), followed }]
  })
}

/** Each forager's own terms and share of working time spent gathering, for the specialization chart. */
export const specializationPoints = (state: ValleyState) =>
  state.foragers.flatMap((forager) => {
    const worked = forager.secondsWorked.forage + forager.secondsWorked.gather
    return worked
      ? [
          {
            id: forager.id,
            ownTerms: forager.forageRate / forager.woodRate,
            woodShare: forager.secondsWorked.gather / worked,
            alive: forager.alive,
            color: foragerColor(state.config, forager),
          },
        ]
      : []
  })

/** The day-by-day series the charts plot. */
export const daySeries = (state: ValleyState, foragerId: number) =>
  state.days.map((day) => ({
    day: day.day + 1,
    alive: day.alive,
    swappedWood: day.swappedWood,
    coldHours: day.coldSleepMinutes / 60,
    reserve: day.endEnergyKcal[foragerId]!,
    stock: day.bushStockKcal / Math.max(1, state.config.thicketCount),
    /** Nuts in the hazel thickets and fish in the water, as shares of full, in percent; and food taken by kind. */
    hazelPercent:
      (100 * day.hazelStockKcal) / Math.max(1, state.config.hazelThicketCount * state.config.hazelThicketCapacityKcal),
    fishPercent: (100 * day.fishKcal) / Math.max(1, fishCapacityKcal(state.config)),
    berriesTaken: day.gatheredBerriesKcal,
    nutsTaken: day.gatheredNutsKcal,
    fishTaken: day.gatheredFishKcal,
    groups: day.groupsStanding,
    loners: day.loners,
    axesMade: day.axesMade,
    axesSold: day.axesSold,
    axesWornOut: day.axesWornOut,
    hutsWhole: day.hutsWhole,
  }))

/**
 * How dark to draw each terrain cell for what a forager knows, row by row from the valley's first row: cells whose
 * mesh triangle it has never seen dark, and the rest clear, since known ground stays known. Values are 0–255.
 */
export function knowledgeShades(state: ValleyState, foragerId: number) {
  const { terrain, nav } = state.layout
  const knowledge = state.foragers[foragerId]!.knowledge
  const shades = new Uint8Array(terrain.cells * terrain.cells)
  for (let row = 0; row < terrain.cells; row += 1)
    for (let col = 0; col < terrain.cells; col += 1) {
      const t = triangleAt(nav.mesh, (col + 0.5) * terrain.cellCm, (row + 0.5) * terrain.cellCm)
      shades[row * terrain.cells + col] = t >= 0 && knows(knowledge, t) ? 0 : 150
    }
  return shades
}

/** The part of the view, in pixels from its top left, that the cards over it leave clear. */
export interface ClearView {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Where a pin over a point on screen goes, in pixels: where the point is while it lies in the clear part of the view,
 * or else held at the clear part's edge, on the line from its centre towards the point. A point behind the camera
 * projects mirrored through the centre of the view, so it is mirrored back first. At the edge, `angle` is the way the
 * pin points, in radians clockwise from the screen's right.
 */
export function pinPlacement(
  x: number,
  y: number,
  behind: boolean,
  clear: ClearView,
  view: { width: number; height: number },
) {
  const inside = !behind && x >= clear.left && x <= clear.right && y >= clear.top && y <= clear.bottom
  if (inside) return { x, y, edge: false, angle: 0 }
  const cx = (clear.left + clear.right) / 2
  const cy = (clear.top + clear.bottom) / 2
  let dx = behind ? view.width - x - cx : x - cx
  let dy = behind ? view.height - y - cy : y - cy
  if (dx === 0 && dy === 0) dy = 1
  const scale = Math.min(
    dx ? (dx > 0 ? clear.right - cx : clear.left - cx) / dx : Infinity,
    dy ? (dy > 0 ? clear.bottom - cy : clear.top - cy) / dy : Infinity,
  )
  dx *= scale
  dy *= scale
  return { x: cx + dx, y: cy + dy, edge: true, angle: Math.atan2(dy, dx) }
}

/**
 * The clear part of a view `width` by `height` pixels, given the cards laid over it: a tall, narrow card at a side
 * takes that side, and any other card, wide as on a phone or short as a folded panel, takes the top or bottom.
 * `margin` pixels more are left at every edge. A view left with less than `least` pixels across or down keeps its
 * middle third that way instead.
 */
export function clearView(
  width: number,
  height: number,
  cards: readonly { left: number; top: number; right: number; bottom: number }[],
  margin = 24,
  least = 120,
): ClearView {
  let left = 0
  let right = width
  let top = 0
  let bottom = height
  for (const card of cards) {
    if (card.right <= card.left || card.bottom <= card.top) continue
    const side = card.right - card.left < width * 0.45 && card.bottom - card.top >= height * 0.4
    if (side) {
      if ((card.left + card.right) / 2 < width / 2) left = Math.max(left, card.right)
      else right = Math.min(right, card.left)
    } else if ((card.top + card.bottom) / 2 < height / 2) top = Math.max(top, card.bottom)
    else bottom = Math.min(bottom, card.top)
  }
  if (right - left - 2 * margin < least) {
    left = width / 3
    right = (2 * width) / 3
  }
  if (bottom - top - 2 * margin < least) {
    top = height / 3
    bottom = (2 * height) / 3
  }
  return { left: left + margin, top: top + margin, right: right - margin, bottom: bottom - margin }
}

/** The groups whose flags stand, with where and in what colour. */
export const standingFlags = (state: ValleyState) =>
  state.groups.filter((group) => group.dissolvedMinute === null).map((group) => ({ id: group.id, flag: group.flag }))

/** The exchanges made at the start of the minute drawn, with how far each one's arc has travelled, 0–1. */
export function currentSwaps(display: Display) {
  const swaps: { sellerId: number; buyerId: number; progress: number }[] = []
  for (const made of display.state.lastInterval) {
    const progress = display.minute - made.minute
    if (made.kind === 'exchange' && progress >= 0 && progress < 1)
      swaps.push({ sellerId: made.sellerId, buyerId: made.buyerId, progress })
  }
  return swaps
}

/**
 * Whether a forager's own hearth burns at the displayed minute, is dark because it sleeps cold, or is not in use. A
 * member asleep by its group's fire does not use its own.
 */
export function hearthAt(display: Display, foragerId: number): 'lit' | 'cold' | null {
  const person = display.state.foragers[foragerId]!
  if (!person.alive || person.task?.kind !== 'sleep' || person.task.groupId != null) return null
  return person.warm ? 'lit' : 'cold'
}

/** A point on a swap's arc, `t` of the way from one end to the other, rising highest halfway. In metres. */
export const arcPoint = (from: { x: number; z: number }, to: { x: number; z: number }, t: number) => ({
  x: from.x + (to.x - from.x) * t,
  z: from.z + (to.z - from.z) * t,
  y: 1.2 + 0.8 * Math.sin(Math.PI * t),
})

/** The RTS camera's limits: from the whole valley down to about five metres across. */
export const CAMERA_LIMITS = { nearest: 4, farthest: 5_000, lowestPitch: 0.25, highestPitch: 1.45 }

/**
 * How far the camera tilts down from its pitch towards eye level close in: 0.6 radians at the nearest, nothing from 60 m
 * out, on a log scale between.
 */
export function closeTilt(distance: number) {
  const far = 60
  const t = Math.log(Math.max(CAMERA_LIMITS.nearest, Math.min(far, distance)) / CAMERA_LIMITS.nearest)
  return 0.6 * (1 - t / Math.log(far / CAMERA_LIMITS.nearest))
}

/** Keeps a camera distance within its limits. */
export const clampDistance = (distance: number) =>
  Math.min(CAMERA_LIMITS.farthest, Math.max(CAMERA_LIMITS.nearest, distance))

/** Keeps a point the camera looks at inside the valley, with a margin. */
export const clampTarget = (config: ValleyConfig, x: number, z: number) => {
  const half = config.valleySizeCm / 200 + 50
  return { x: Math.min(half, Math.max(-half, x)), z: Math.min(half, Math.max(-half, z)) }
}
