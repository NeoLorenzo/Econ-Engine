import type { ActionEvent, LifeState, Patch } from '../life/types'
import { walkPath } from '../life/world'

/**
 * The simulation advances in whole hours; the display does not. It keeps the state before and after the hour in
 * progress and draws the world `alpha` of the way between them. It only ever interpolates between two real states.
 */
export interface DisplayPair {
  previous: LifeState
  next: LifeState
  /** 0–1 through the hour that turns `previous` into `next`. */
  alpha: number
}

export interface LifeSpeed {
  label: string
  hoursPerSecond: number
  /** The fastest speed draws whole hours only. */
  interpolate: boolean
}

export const LIFE_SPEEDS: LifeSpeed[] = [
  { label: '1 h / 3 s', hoursPerSecond: 1 / 3, interpolate: true },
  { label: '1 h / s', hoursPerSecond: 1, interpolate: true },
  { label: '6 h / s', hoursPerSecond: 6, interpolate: true },
  { label: '1 day / s', hoursPerSecond: 24, interpolate: true },
  { label: '10 days / s', hoursPerSecond: 240, interpolate: false },
]

/**
 * A long gap between frames (a background tab, a stall) counts as this many seconds at most, so returning to the page
 * resumes where it left off instead of leaping ahead.
 */
export const MAX_FRAME_SECONDS = 0.25

/** How many whole hours to run this frame, and how far into the next hour the display then stands. */
export function advanceClock(alpha: number, elapsedSeconds: number, hoursPerSecond: number) {
  const target = alpha + Math.min(MAX_FRAME_SECONDS, Math.max(0, elapsedSeconds)) * hoursPerSecond
  const steps = Math.floor(target)
  return { steps, alpha: target - steps }
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** The hour in progress: what the forager is doing between `previous` and `next`, if it is alive to do anything. */
export const currentEvent = ({ previous, next }: DisplayPair): ActionEvent | null =>
  next.lastEvent && next.lastEvent.tick === previous.tick ? next.lastEvent : null

/** Hours since midnight of day 0, continuously. */
export const displayHours = ({ previous, alpha }: DisplayPair) => previous.tick + alpha

export function clockLabel(hours: number) {
  const day = Math.floor(hours / 24)
  const minutes = Math.floor((hours - day * 24) * 60)
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `Day ${day + 1} · ${hh}:${mm}`
}

/**
 * 0 at night, 1 in full daylight, easing over the half hour either side of dawn and dusk. Only the picture fades; the
 * simulation's night still starts exactly at dusk.
 */
export function daylightAt(hourOfDay: number, dawnHour: number, duskHour: number) {
  const smooth = (edge: number, t: number) => {
    const x = Math.min(1, Math.max(0, (t - (edge - 0.5)) / 1))
    return x * x * (3 - 2 * x)
  }
  return Math.min(smooth(dawnHour, hourOfDay), 1 - smooth(duskHour, hourOfDay))
}

/** The sun's height (−1 to 1) and direction, rising at dawn in the east and setting at dusk in the west. */
export function sunAt(hourOfDay: number, dawnHour: number, duskHour: number) {
  const angle = ((hourOfDay - dawnHour) / (duskHour - dawnHour)) * Math.PI
  return { elevation: Math.sin(angle), azimuth: Math.cos(angle) }
}

export interface ForagerPose {
  x: number
  y: number
  /** 0 standing, 1 lying down. */
  lying: number
  /** Direction of travel in radians, or null when standing still. */
  heading: number | null
  walking: boolean
}

/** How much of the hour lying down or getting up takes on screen. */
const POSTURE_FRACTION = 0.25

/**
 * Where the forager is drawn. A walk follows the simulated path tile by tile at the forager's walking speed, so a
 * walk shorter than the hour's limit ends early and the forager stands for the rest of the hour.
 */
export function foragerPose(pair: DisplayPair, interpolate = true): ForagerPose {
  const { previous, next } = pair
  const alpha = interpolate ? pair.alpha : 1
  const event = currentEvent(pair)
  const lyingBefore = previous.lastEvent?.action === 'sleep' || !previous.forager.alive
  const lyingAfter = event ? event.action === 'sleep' : !next.forager.alive
  const transition = Math.min(1, alpha / POSTURE_FRACTION)
  const lying = lyingBefore === lyingAfter ? (lyingAfter ? 1 : 0) : lyingAfter ? transition : 1 - transition

  if (event?.action !== 'walk') {
    const { x, y } = next.forager.position
    return { x, y, lying, heading: null, walking: false }
  }
  const path = [event.from, ...walkPath(event.from, event.position, previous.config.tilesPerHour)]
  const travelled = Math.min(path.length - 1, alpha * previous.config.tilesPerHour)
  const index = Math.min(path.length - 2, Math.floor(travelled))
  if (index < 0) return { ...event.from, lying, heading: null, walking: false }
  const from = path[index]!
  const to = path[index + 1]!
  const t = travelled - index
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    lying,
    heading: Math.atan2(to.x - from.x, to.y - from.y),
    walking: travelled < path.length - 1,
  }
}

/** A patch's stock, part of the way through the hour. */
export function displayedStock(pair: DisplayPair, patchId: number, interpolate = true) {
  const before = pair.previous.patches[patchId]!.stockKcal
  const after = pair.next.patches[patchId]!.stockKcal
  return interpolate ? lerp(before, after, pair.alpha) : after
}

/** A bush never vanishes: an empty patch is still a patch, drawn as a small bare shrub. */
export const bushScale = (stockKcal: number, capacityKcal: number) =>
  0.3 + 0.7 * Math.sqrt(Math.max(0, stockKcal) / capacityKcal)

export const displayedEnergy = (pair: DisplayPair, interpolate = true) =>
  interpolate
    ? lerp(pair.previous.forager.energyKcal, pair.next.forager.energyKcal, pair.alpha)
    : pair.next.forager.energyKcal

export function describeActivity(pair: DisplayPair) {
  const event = currentEvent(pair)
  if (!pair.next.forager.alive && !event) return 'Dead of starvation'
  if (!event) return 'Waiting to start'
  const patch = (id: number | null) => `patch ${(id ?? 0) + 1}`
  switch (event.action) {
    case 'sleep':
      return event.energyAfterKcal === 0 ? 'Starved in its sleep' : 'Sleeping through the night'
    case 'rest':
      return event.reason === 'satiated' ? 'Resting, well fed' : `Hungry, waiting for ${patchHere(pair)} to regrow`
    case 'forage':
      return `Foraging at ${patch(event.patchId)}`
    case 'walk':
      return event.targetPatchId === null
        ? `Walking to ${patchAtTile(pair, event.position)}`
        : `Walking to ${patch(event.targetPatchId)}`
  }
}

const patchLabel = (patch: Patch | undefined) => (patch ? `patch ${patch.id + 1}` : 'open ground')

const patchHere = (pair: DisplayPair) =>
  patchLabel(
    pair.next.patches.find(
      (patch) => patch.tile.x === pair.next.forager.position.x && patch.tile.y === pair.next.forager.position.y,
    ),
  )

const patchAtTile = (pair: DisplayPair, tile: { x: number; y: number }) =>
  patchLabel(pair.next.patches.find((patch) => patch.tile.x === tile.x && patch.tile.y === tile.y))

/** What the inspector shows for a patch: the truth beside what the forager believes. */
export function patchInspection(state: LifeState, patchId: number) {
  const patch = state.patches[patchId]!
  const memory = state.forager.memory[patchId]!
  // An observation made during hour `t` is "this hour" until hour `t + 1` begins.
  const hoursAgo = state.tick - 1 - memory.observedTick
  return {
    name: `Patch ${patch.id + 1}`,
    trueStockKcal: patch.stockKcal,
    capacityKcal: state.config.patchCapacityKcal,
    rememberedStockKcal: memory.stockKcal,
    // Tick 0 is the forager's home-range knowledge, and its first look if it starts on a patch.
    seen: memory.observedTick === 0 ? 'at the start' : hoursAgo <= 0 ? 'this hour' : `${formatHours(hoursAgo)} ago`,
    differenceKcal: patch.stockKcal - memory.stockKcal,
  }
}

export function formatHours(hours: number) {
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest ? `${days} d ${rest} h` : `${days} d`
}

export const formatKcal = (kcal: number) => `${Math.round(kcal).toLocaleString('en-US')} kcal`
