import { askOf, expectedQuality, usableAsk } from '../valley/axes'
import { carriedKcal } from '../valley/food'
import { mixSeed, randomDraw } from '../sim/rng'
import { spiralOffsets } from '../valley/config'
import { lastEventOf } from '../valley/engine'
import { campfireBurn } from '../valley/fire'
import { MINUTES_PER_DAY, isDaylight, loadKg, loadOf, speedForLoad } from '../valley/forager'
import { hutOf, hutWhole, weathersOn } from '../valley/huts'
import { practicePercents } from '../valley/practice'
import { siteCentre, siteCount, siteRadius, sitesKnown } from '../valley/sites'
import { livingMembers, placeCount, placesPerSide } from '../valley/social'
import { knownTerms, nightHours, nightWood, woodMatters, woodTarget } from '../valley/trade'
import type { ActionEvent, Group, SwapEvent, ValleyConfig, ValleyState } from '../valley/types'
import { foragerColor, foragerName, formatHours } from './display'

export { clockLabel, daylightAt, foragerName, formatKcal, sunAt, TERMS_COLORS } from './display'
export { foragerColor, formatHours }

/**
 * The simulation advances in whole minutes; the display does not. It keeps the states before and after the minute in
 * progress and draws the world `alpha` of the way between them. It only ever interpolates between two real states.
 */
export interface DisplayPair {
  previous: ValleyState
  next: ValleyState
  /** 0–1 through the minute that turns `previous` into `next`. */
  alpha: number
}

export interface ValleySpeed {
  label: string
  minutesPerSecond: number
  /** The fastest speed draws whole minutes only. */
  interpolate: boolean
}

export const VALLEY_SPEEDS: ValleySpeed[] = [
  { label: 'Real time', minutesPerSecond: 1 / 60, interpolate: true },
  { label: '10×', minutesPerSecond: 1 / 6, interpolate: true },
  { label: '1 min / s', minutesPerSecond: 1, interpolate: true },
  { label: '10 min / s', minutesPerSecond: 10, interpolate: true },
  { label: '1 h / s', minutesPerSecond: 60, interpolate: true },
  { label: '1 day / s', minutesPerSecond: MINUTES_PER_DAY, interpolate: false },
]

/** The speed the page opens at: fast enough to see people move, slow enough to watch them work. */
export const DEFAULT_SPEED_INDEX = 2

/**
 * A long gap between frames (a background tab, a stall) counts as this many seconds at most, so returning to the page
 * resumes where it left off instead of leaping ahead.
 */
export const MAX_FRAME_SECONDS = 0.25

/** How many whole minutes to run this frame, and how far into the next minute the display then stands. */
export function advanceClock(alpha: number, elapsedSeconds: number, minutesPerSecond: number) {
  const target = alpha + Math.min(MAX_FRAME_SECONDS, Math.max(0, elapsedSeconds)) * minutesPerSecond
  const steps = Math.floor(target)
  return { steps, alpha: target - steps }
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** The minute in progress: what a forager is doing between `previous` and `next`, if it is alive to do anything. */
export function currentEvent({ previous, next }: DisplayPair, foragerId: number): ActionEvent | null {
  const event = lastEventOf(next, foragerId)
  return event && event.minute === previous.minute ? event : null
}

/** Minutes since midnight of day 0, continuously. */
export const displayMinutes = (pair: DisplayPair, interpolate = true) =>
  interpolate ? pair.previous.minute + pair.alpha : pair.next.minute

/** Valley centimetres to world metres, with the valley centred on the origin; y becomes z. */
export const toMetres = (config: ValleyConfig, x: number, y: number) => ({
  x: (x - config.valleySizeCm / 2) / 100,
  z: (y - config.valleySizeCm / 2) / 100,
})

export type Gesture = 'walk' | 'pick' | 'gather' | 'chop' | 'make' | 'stand' | 'sleep' | 'dead'

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

/** How much of the minute lying down or getting up takes on screen. */
const POSTURE_FRACTION = 0.25

const headingOf = (dx: number, dy: number) => (dx === 0 && dy === 0 ? null : Math.atan2(dx, dy))

/**
 * Where a forager is drawn and what it is doing. A minute may hold a walk and then work: the forager walks along the
 * straight line from where it was to where it arrived during the walking seconds, then works or stands for the rest.
 */
export function foragerPose(pair: DisplayPair, foragerId: number, interpolate = true): ForagerPose {
  const { previous, next } = pair
  const alpha = interpolate ? pair.alpha : 1
  const event = currentEvent(pair, foragerId)
  const after = next.foragers[foragerId]!
  const lyingBefore = lastEventOf(previous, foragerId)?.action === 'sleep' || !previous.foragers[foragerId]!.alive
  const lyingAfter = event ? event.action === 'sleep' : !after.alive
  const transition = Math.min(1, alpha / POSTURE_FRACTION)
  const lying = lyingBefore === lyingAfter ? (lyingAfter ? 1 : 0) : lyingAfter ? transition : 1 - transition
  if (!event) return { x: after.x, y: after.y, heading: null, gesture: after.alive ? 'stand' : 'dead', lying }
  const seconds = alpha * 60
  const { from, position } = event
  if (event.walkSeconds > 0 && seconds < event.walkSeconds) {
    const t = seconds / event.walkSeconds
    return {
      x: lerp(from.x, position.x, t),
      y: lerp(from.y, position.y, t),
      heading: headingOf(position.x - from.x, position.y - from.y),
      gesture: 'walk',
      lying,
    }
  }
  const { layout } = next
  const plants = event.workedFor === 'food' ? layout.bushes : layout.trees
  const toward = (xs: Int32Array, ys: Int32Array, id: number | null) =>
    id === null ? null : headingOf(xs[id]! - position.x, ys[id]! - position.y)
  const facing =
    event.task === 'cut'
      ? toward(layout.trees.x, layout.trees.y, event.treeId)
      : event.task === 'stone'
        ? toward(layout.stones.x, layout.stones.y, event.stoneId)
        : toward(plants.x, plants.y, event.plantId)
  const gesture: Gesture = event.workSeconds
    ? event.task === 'cut'
      ? 'chop'
      : event.task === 'make'
        ? 'make'
        : event.task === 'stone' || event.workedFor === 'wood'
          ? 'gather'
          : 'pick'
    : event.action === 'sleep'
      ? 'sleep'
      : 'stand'
  return { x: position.x, y: position.y, heading: facing, gesture, lying }
}

/**
 * Whether a forager carries a log on its shoulder in the minute being drawn: one it set out with, until it lays it in
 * its hut at the end of its walk home, or one it cut this minute, once it is cut.
 */
export function carriesLog(pair: DisplayPair, foragerId: number, interpolate = true) {
  const event = currentEvent(pair, foragerId)
  if (!event) return pair.next.foragers[foragerId]!.log > 0
  const seconds = (interpolate ? pair.alpha : 1) * 60
  if (event.cutLog) return seconds >= 60 - event.workSeconds / 4
  if (!event.loadLog) return false
  return !event.laidLog || seconds < event.walkSeconds
}

/** Whether a forager holds an axe in the minute being drawn. */
export const holdsAxe = (pair: DisplayPair, foragerId: number) => {
  const event = currentEvent(pair, foragerId)
  return pair.next.foragers[foragerId]!.axe !== null || event?.task === 'cut'
}

/** A plant's stock, part of the way through the minute. */
export function displayedStock(pair: DisplayPair, kind: 'bush' | 'tree', id: number, interpolate = true) {
  const before = kind === 'bush' ? pair.previous.bushKcal[id]! : pair.previous.treeWood[id]!
  const after = kind === 'bush' ? pair.next.bushKcal[id]! : pair.next.treeWood[id]!
  return interpolate ? lerp(before, after, pair.alpha) : after
}

/**
 * How tall a tree stands for the logs it holds: whole when full, lower as logs are cut, and a stump with none, drawn
 * as a share of its full height. A log comes off at the end of the minute it is cut.
 */
export const treeStanding = (logs: number, logsPerTree: number) =>
  logs <= 0 ? 0 : 0.55 + (0.45 * logs) / Math.max(1, logsPerTree)

/**
 * Shares `amount` out among `count` parts one after another, each from 0 (empty) to 1 (full). The fills add up to the
 * amount's share of capacity, so what is drawn stays proportional to what is there. The last parts empty first.
 */
export const fillInTurn = (amount: number, capacity: number, count: number) =>
  Array.from({ length: count }, (_, index) =>
    Math.min(1, Math.max(0, (Math.max(0, amount) / capacity) * count - index)),
  )

/** Berries drawn on each bush, and dead branches in each tree's pile. */
export const BERRIES_PER_BUSH = 10
export const LOGS_PER_PILE = 6

/** How a plant looks: fixed by its kind and ID, so it looks the same in every run, and drawn from no simulation stream. */
export interface PlantLook {
  /** Relative size, about 1. */
  size: number
  /** A turn about its own axis. */
  turn: number
}

const LOOK_SALT = { bush: 0x4255_5348, tree: 0x5452_4545 } as const

export function plantLook(kind: 'bush' | 'tree', id: number): PlantLook {
  const first = randomDraw(mixSeed((id ^ LOOK_SALT[kind]) >>> 0))
  const second = randomDraw(first.state)
  return { size: 0.85 + first.value * 0.3, turn: second.value * Math.PI * 2 }
}

export const displayedEnergy = (pair: DisplayPair, foragerId: number, interpolate = true) =>
  interpolate
    ? lerp(pair.previous.foragers[foragerId]!.energyKcal, pair.next.foragers[foragerId]!.energyKcal, pair.alpha)
    : pair.next.foragers[foragerId]!.energyKcal

/** The wood a forager holds and the food it carries, part of the way through the minute. */
export function displayedLoad(pair: DisplayPair, foragerId: number, interpolate = true) {
  const before = pair.previous.foragers[foragerId]!
  const after = pair.next.foragers[foragerId]!
  const t = interpolate ? pair.alpha : 1
  const wood = lerp(before.wood, after.wood, t)
  // The wood gathered on this trip is on its back; the rest of what it holds is stacked by its hearth.
  const onBack = Math.min(wood, lerp(before.tripWood, after.tripWood, t))
  return {
    onBack,
    atHearth: wood - onBack,
    carriedKcal: lerp(carriedKcal(before.carried), carriedKcal(after.carried), t),
  }
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

/** What a night's fire burns in wood and saves in food, or null where nights are not cold. */
export function fireSaving(config: ValleyConfig) {
  if (!woodMatters(config)) return null
  return { wood: nightWood(config), kcal: nightHours(config) * (config.coldSleepKcalPerHour - config.sleepKcalPerHour) }
}

/** People count bushes, trees and foragers from 1. */
export const bushName = (state: ValleyState, id: number) => `a bush in thicket ${state.layout.bushes.site[id]! + 1}`
export const treeName = (state: ValleyState, id: number) => `a tree in stand ${state.layout.trees.site[id]! + 1}`
export const stoneName = (state: ValleyState, id: number) => `outcrop ${state.layout.stones.site[id]! + 1}`
/** A site by name, as bushes and trees name theirs: thickets, stands and outcrops each counted from 1. */
export function siteName(config: ValleyConfig, site: number) {
  if (site < config.thicketCount) return `thicket ${site + 1}`
  const stand = site - config.thicketCount
  return stand < config.standCount ? `stand ${stand + 1}` : `outcrop ${stand - config.standCount + 1}`
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

export function describeActivity(pair: DisplayPair, foragerId: number) {
  const event = currentEvent(pair, foragerId)
  const state = pair.next
  if (!state.foragers[foragerId]!.alive && !event) return 'Dead of starvation'
  if (!event) return 'Waiting to start'
  const toSwap = event.forTrade ? ' to swap' : ''
  if (event.reason === 'going home') return 'Walking home to its hearth'
  if (event.reason === 'taking a load home') return `Taking ${event.loadWood} kg of firewood home`
  if (event.reason === 'taking a log home')
    return event.laidLog ? 'Laying a log in its hut' : 'Carrying a log home for its hut'
  if (event.action === 'sleep') {
    if (event.energyAfterKcal === 0) return 'Starved in its sleep'
    if (event.inHut) return 'Sleeping in its hut'
    if (event.fireGroupId !== null)
      return event.sleptCold ? 'Sleeping cold: its group’s fire is out' : 'Sleeping warm by its group’s fire'
    if (event.sleptCold) return 'Sleeping cold, with no wood to burn'
    return woodMatters(state.config) ? 'Sleeping warm by its fire' : 'Sleeping through the night'
  }
  if (event.reason === 'satiated') return 'Resting, well fed'
  if (event.reason === 'cutting a log')
    return event.cutLog
      ? `Cutting a log from ${treeName(state, event.treeId!)}`
      : `Swinging its axe at ${treeName(state, event.treeId!)}`
  if (event.reason === 'seeking a tree') return 'Walking to a tree to cut a log for its hut'
  if (event.reason === 'fetching a stone')
    return `Walking to ${stoneName(state, event.stoneId!)} for a stone to make an axe`
  if (event.reason === 'picking up a stone') return `Picking up a stone at ${stoneName(state, event.stoneId!)}`
  if (event.reason === 'making an axe') {
    const forager = state.foragers[foragerId]!
    const making = forager.making
    const forSale = making ? making.forSale : forager.spareAxe !== null && forager.axe === null
    return `Making an axe${forSale ? ' to sell' : ' for itself'}`
  }
  if (event.reason === 'going home to make an axe') return 'Walking home to make an axe'
  if (event.reason === 'waiting for an axe being made') return 'Waiting for an axe someone promised to make'
  if (event.reason === 'going home to wait for an axe') return 'Walking home to wait for a promised axe'
  if (event.reason === 'picking food to buy an axe')
    return event.workSeconds ? `Picking berries to buy an axe` : 'Looking for berries to buy an axe'
  if (event.reason === 'taking food home to buy an axe') return 'Taking food home to buy an axe'
  if (event.reason === 'waiting to buy an axe') return 'Waiting at home with food to buy an axe'
  if (event.reason === 'exploring') {
    if (event.action !== 'walk') return 'Looking around'
    return 'Exploring ground it has never seen'
  }
  if (event.reason === 'checking' && event.siteId !== null) {
    const site = siteName(state.config, event.siteId)
    return event.action === 'walk' ? `Walking to ${site} to see what it holds` : `Looking over ${site}`
  }
  if (event.reason === 'seeking company') return event.action === 'walk' ? 'Looking for company' : 'Hoping for company'
  if (event.reason === 'waiting for company') return 'Waiting for company at a flag'
  if (event.reason === 'searching') {
    const where = event.siteId === null ? 'new ground' : siteName(state.config, event.siteId)
    return event.workedFor === 'wood' ? `Searching ${where} for deadwood` : `Searching ${where} for berries`
  }
  if (event.reason === 'waiting to swap') return 'Resting, carrying food to swap for wood'
  if (event.reason === 'too late to set out') return 'Too late in the day to set out'
  if (event.reason === 'waiting for regrowth')
    return event.workedFor === 'wood' ? 'Short of wood, waiting for deadwood to fall' : 'Hungry, waiting for berries'
  if (event.action === 'forage') return `Picking berries${toSwap} from ${bushName(state, event.plantId!)}`
  if (event.action === 'gather') {
    const where = treeName(state, event.plantId!)
    return event.reason === 'filling a load'
      ? `Gathering deadwood under ${where} to fill a load`
      : `Gathering deadwood${toSwap} under ${where}`
  }
  if (event.action === 'walk')
    return event.workedFor === 'wood' ? `Walking to a tree for wood${toSwap}` : `Walking to a bush${toSwap}`
  return event.workedFor === 'wood' ? 'Looking for deadwood' : 'Looking for berries'
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
  // An observation made during minute `m` is "this minute" until minute `m + 1` begins.
  const ago = state.minute - 1 - seen
  return ago <= 0 ? 'this minute' : `${formatMinutes(ago)} ago`
}

/** What the inspector shows for a bush or tree: the truth beside what the followed forager believes. */
export function plantInspection(state: ValleyState, kind: 'bush' | 'tree', id: number, foragerId: number) {
  const forager = state.foragers[foragerId]!
  const memory = kind === 'bush' ? forager.bushMemory : forager.treeMemory
  const stock = kind === 'bush' ? state.bushKcal[id]! : state.treeWood[id]!
  return {
    name:
      kind === 'bush'
        ? `Bush in thicket ${state.layout.bushes.site[id]! + 1}`
        : `Tree in stand ${state.layout.trees.site[id]! + 1}`,
    stock,
    capacity: kind === 'bush' ? state.config.bushCapacityKcal : state.config.treeCapacityWood,
    /** Null if it has never seen the plant. */
    remembered: memory.seen[id]! < 0 ? null : memory.stock[id]!,
    seen: seenLabel(state, memory.seen[id]!),
    difference: stock - memory.stock[id]!,
    /** A tree's logs, and what the followed forager last saw of them. */
    logs: kind === 'tree' ? state.treeLogs[id]! : null,
    logsCapacity: state.config.logsPerTree,
    logsRemembered: kind === 'tree' && forager.logMemory.seen[id]! >= 0 ? forager.logMemory.stock[id]! : null,
  }
}

/** What the inspector shows for a stone spot: its stones beside what the followed forager last saw. */
export function stoneInspection(state: ValleyState, id: number, foragerId: number) {
  const forager = state.foragers[foragerId]!
  const seen = forager.stoneMemory.seen[id]!
  return {
    name: `Stones at ${stoneName(state, id)}`,
    stones: state.stoneStock[id]!,
    capacity: state.config.stonesPerSpot,
    remembered: seen < 0 ? null : forager.stoneMemory.stock[id]!,
    seen: seenLabel(state, seen),
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

/** A hut's logs, as drawn: a log appears when its builder lays it, at the end of its walk home. */
export const displayedHutLogs = (pair: DisplayPair, hutId: number) =>
  pair.next.huts[hutId]?.logs ?? pair.previous.huts[hutId]?.logs ?? 0

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
 * How a group's fire looks in the minute being drawn: burning in a night hour it is lit; banked by day while it holds
 * wood; out at night when it is not lit, or by day with no wood. Its size follows the nights of wood it holds.
 */
export function campfireAt(pair: DisplayPair, groupId: number) {
  const fire = campfireOf(pair.next, groupId)
  if (!fire) return null
  const minute = pair.previous.minute
  const look: 'burning' | 'banked' | 'out' = fire.lit
    ? 'burning'
    : isDaylight(pair.next.config, minute) && fire.wood > 0
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
      madeOwn: forager.axeTotals.madeOwn,
      madeForSale: forager.axeTotals.madeForSale,
      sold: forager.axeTotals.sold,
      bought: forager.axeTotals.bought,
      kcalReceived: forager.axeTotals.kcalReceived,
      kcalPaid: forager.axeTotals.kcalPaid,
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
 * wood and food its members hold, the swaps among them over the last day, its fire, and its axes.
 */
export function groupInspection(pair: DisplayPair, groupId: number) {
  const state = pair.next
  const group = state.groups[groupId]!
  const living = livingMembers(state, group)
  const members = living.map((id) => {
    const load = loadOf(state.foragers[id]!)
    return {
      id,
      name: foragerName(id),
      color: foragerColor(state.config, state.foragers[id]!),
      activity: describeActivity(pair, id),
      loadKg: loadKg(state.config, load.wood, load.berriesKcal, load.log),
    }
  })
  const since = state.minute - MINUTES_PER_DAY
  const inGroup = new Set(living)
  let swaps = 0
  for (const day of state.eventDays.slice(-2))
    for (const made of day)
      if (made.kind === 'swap' && made.minute >= since && inGroup.has(made.sellerId) && inGroup.has(made.buyerId))
        swaps += 1
  const contributions = groupContributions(state, groupId)
  const axes = groupAxes(state, groupId)
  return {
    name: groupName(groupId),
    color: groupColor(groupId),
    founded: group.foundedMinute,
    foundedAgo: Math.max(0, state.minute - 1 - group.foundedMinute),
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

/** How far the coloured ground round a group's base reaches: past the farthest hearth on its spiral, in centimetres. */
export function baseRadiusCm(config: ValleyConfig, group: Group) {
  const [dx, dy] = spiralOffsets(Math.max(1, group.members.length)).at(-1)!
  return Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * config.hearthSpacingCm * Math.SQRT2) + 250
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

/** The thickets and stands the followed forager knows, and whether it checked each lately. */
export function siteRings(state: ValleyState, foragerId: number): SiteRing[] {
  const { config, layout } = state
  const forager = state.foragers[foragerId]!
  const minute = Math.max(0, state.minute - 1)
  const rings: SiteRing[] = []
  for (let site = 0; site < siteCount(config); site += 1) {
    if (!forager.siteKnown[site]) continue
    const checked = forager.siteChecked[site]!
    const fresh = checked >= 0 && minute - checked < 60 * config.exploreAfterHours
    rings.push({ site, ...siteCentre(config, layout, site), radiusCm: siteRadius(config, site), fresh })
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
  const oldest = forager.carried[0]
  const load = loadOf(forager)
  const kg = loadKg(config, load.wood, load.berriesKcal, load.log)
  const hut = hutOf(state, forager)
  const ask = usableAsk(state, forager, state.minute) ?? forager.heardAsk
  return {
    forageRate: forager.forageRate,
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
    woodTarget: woodTarget(config),
    tripWood: forager.tripWood,
    carriedKcal: carriedKcal(forager.carried),
    /** Minutes until its oldest food spoils; null if it carries none or food keeps. */
    spoilsInMinutes:
      oldest && config.shelfLifeHours > 0
        ? Math.max(0, oldest.harvestTick + 60 * config.shelfLifeHours - state.minute)
        : null,
    heardTerms: terms,
    heardMinutesAgo: terms === null ? null : Math.max(0, state.minute - 1 - forager.heardTerms!.minute),
    ...forager.swapTotals,
    groupId: forager.groupId,
    /** Its fellow living members, by name. */
    fellows:
      forager.groupId === null
        ? []
        : livingMembers(state, state.groups[forager.groupId]!)
            .filter((id) => id !== foragerId)
            .map(foragerName),
    joinedMinutesAgo: forager.joinedMinute === null ? null : Math.max(0, state.minute - 1 - forager.joinedMinute),
    /** The share of the valley's places it has ever seen. */
    seenShare: forager.placesSeen / placeCount(config),
    /** What it carries, in kilograms, and how fast that lets it walk, in km/h. */
    loadKg: kg,
    speedKmh: (speedForLoad(config, kg) * 36) / 1_000,
    sitesKnown: sitesKnown(forager),
    sitesTotal: siteCount(config),
    /** Sites it has checked within `exploreAfterHours`. */
    sitesCheckedLately: forager.siteChecked.filter(
      (checked) => checked >= 0 && Math.max(0, state.minute - 1) - checked < 60 * config.exploreAfterHours,
    ).length,
    /** The wood it has put into fires, and its group's fire, if it sleeps by one. */
    fireGiven: forager.fireGiven,
    groupFire: forager.groupId === null ? null : campfireOf(state, forager.groupId),
    /** Its craft, practice at making axes and the hours behind it, and what an axe costs it and is worth to it. */
    craft: forager.craft,
    craftSkill: forager.craftSkill,
    makePercent: percent.make,
    makeHours: Math.round(sum(forager.practiceLog.make) / 3_600),
    ask: askOf(config, forager.craft),
    expectedQuality: expectedQuality(forager.craft),
    axe: forager.axe ? axePhrase(forager.axe, foragerId) : null,
    spareAxe: forager.spareAxe ? axePhrase(forager.spareAxe, foragerId) : null,
    /** How far along an axe in the making is, 0–1, and whether it is for sale. */
    making: forager.making
      ? { done: forager.making.worked / forager.making.needed, forSale: forager.making.forSale }
      : null,
    promised: forager.promised,
    heardAsk:
      ask && state.minute - 1 - ask.minute <= 60 * config.termsMemoryHours
        ? { ...ask, from: foragerName(ask.sellerId), minutesAgo: Math.max(0, state.minute - 1 - ask.minute) }
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
    stock: day.bushStockKcal / state.layout.bushes.count,
    groups: day.groupsStanding,
    loners: day.loners,
    axesMade: day.axesMade,
    axesSold: day.axesSold,
    axesWornOut: day.axesWornOut,
    hutsWhole: day.hutsWhole,
  }))

/**
 * How dark to draw each place on the ground for what a forager knows, row by row from the valley's first row: places it
 * has never seen dark, and the rest clear, since seen ground stays seen. Values are 0–255.
 */
export function knowledgeShades(state: ValleyState, foragerId: number) {
  const forager = state.foragers[foragerId]!
  const shades = new Uint8Array(placesPerSide(state.config) ** 2)
  for (let place = 0; place < shades.length; place += 1) shades[place] = forager.placeSeen[place]! < 0 ? 150 : 0
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

/** The swaps made in the minute being drawn. */
export const currentSwaps = ({ previous, next }: DisplayPair): SwapEvent[] =>
  next.lastSwaps.filter((made) => made.minute === previous.minute)

/**
 * Whether a forager's own hearth burns in the minute being drawn, is dark because it sleeps cold, or is not in use. A
 * member asleep by its group's fire does not use its own.
 */
export function hearthAt(pair: DisplayPair, foragerId: number): 'lit' | 'cold' | null {
  const event = currentEvent(pair, foragerId)
  if (event?.action !== 'sleep' || event.fireGroupId !== null) return null
  return event.sleptCold ? 'cold' : pair.next.foragers[foragerId]!.warm ? 'lit' : null
}

/** A point on a swap's arc, `t` of the way from one end to the other, rising highest halfway. In metres. */
export const arcPoint = (from: { x: number; z: number }, to: { x: number; z: number }, t: number) => ({
  x: lerp(from.x, to.x, t),
  z: lerp(from.z, to.z, t),
  y: 1.2 + 0.8 * Math.sin(Math.PI * t),
})

/** The RTS camera's limits: from the whole valley down to about five metres across. */
export const CAMERA_LIMITS = { nearest: 4, farthest: 900, lowestPitch: 0.25, highestPitch: 1.45 }

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
