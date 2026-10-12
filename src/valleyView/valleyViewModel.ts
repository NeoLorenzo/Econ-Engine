import { carriedKcal } from '../life/food'
import { mixSeed, randomDraw } from '../sim/rng'
import { lastEventOf } from '../valley/engine'
import { MINUTES_PER_DAY } from '../valley/forager'
import { practicePercents } from '../valley/practice'
import { knownTerms, nightHours, nightWood, woodMatters, woodTarget } from '../valley/trade'
import type { ActionEvent, SwapEvent, ValleyConfig, ValleyState } from '../valley/types'
import { foragerColor, formatHours } from '../lifeView/lifeViewModel'

export { clockLabel, daylightAt, foragerName, formatKcal, sunAt, TERMS_COLORS } from '../lifeView/lifeViewModel'
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

export type Gesture = 'walk' | 'pick' | 'gather' | 'stand' | 'sleep' | 'dead'

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
  const plants = event.workedFor === 'food' ? next.layout.bushes : next.layout.trees
  const facing =
    event.plantId === null
      ? null
      : headingOf(plants.x[event.plantId]! - position.x, plants.y[event.plantId]! - position.y)
  const gesture: Gesture = event.workSeconds
    ? event.workedFor === 'food'
      ? 'pick'
      : 'gather'
    : event.action === 'sleep'
      ? 'sleep'
      : 'stand'
  return { x: position.x, y: position.y, heading: facing, gesture, lying }
}

/** A plant's stock, part of the way through the minute. */
export function displayedStock(pair: DisplayPair, kind: 'bush' | 'tree', id: number, interpolate = true) {
  const before = kind === 'bush' ? pair.previous.bushKcal[id]! : pair.previous.treeWood[id]!
  const after = kind === 'bush' ? pair.next.bushKcal[id]! : pair.next.treeWood[id]!
  return interpolate ? lerp(before, after, pair.alpha) : after
}

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

export function describeActivity(pair: DisplayPair, foragerId: number) {
  const event = currentEvent(pair, foragerId)
  const state = pair.next
  if (!state.foragers[foragerId]!.alive && !event) return 'Dead of starvation'
  if (!event) return 'Waiting to start'
  const toSwap = event.forTrade ? ' to swap' : ''
  if (event.reason === 'going home') return 'Walking home to its hearth'
  if (event.action === 'sleep') {
    if (event.energyAfterKcal === 0) return 'Starved in its sleep'
    if (event.sleptCold) return 'Sleeping cold, with no wood to burn'
    return woodMatters(state.config) ? 'Sleeping warm by its fire' : 'Sleeping through the night'
  }
  if (event.reason === 'satiated') return 'Resting, well fed'
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
  // An observation made during minute `m` is "this minute" until minute `m + 1` begins.
  const ago = state.minute - 1 - seen
  return seen === 0 ? 'at the start' : ago <= 0 ? 'this minute' : `${formatMinutes(ago)} ago`
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
    remembered: memory.stock[id]!,
    seen: seenLabel(state, memory.seen[id]!),
    difference: stock - memory.stock[id]!,
  }
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
  }))

/** The swaps made in the minute being drawn. */
export const currentSwaps = ({ previous, next }: DisplayPair): SwapEvent[] =>
  next.lastSwaps.filter((made) => made.minute === previous.minute)

/** Whether a forager's hearth burns in the minute being drawn, is dark because it sleeps cold, or is not in use. */
export function hearthAt(pair: DisplayPair, foragerId: number): 'lit' | 'cold' | null {
  const event = currentEvent(pair, foragerId)
  if (event?.action !== 'sleep') return null
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
