import { lastEventOf } from '../life/engine'
import { carriedKcal } from '../life/food'
import type { ActionEvent, GiftEvent, LifeState, Patch, Strategy, Tile } from '../life/types'
import { campTile, sameTile, walkPath } from '../life/world'
import { palette } from '../ui/theme'

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

/** The hour in progress: what a forager is doing between `previous` and `next`, if it is alive to do anything. */
export function currentEvent({ previous, next }: DisplayPair, foragerId: number): ActionEvent | null {
  const event = lastEventOf(next, foragerId)
  return event && event.tick === previous.tick ? event : null
}

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
  /** The forager's position in tiles. */
  x: number
  y: number
  /** Where it stands on its tile, beside the bush and apart from others sharing the tile, in tiles. */
  offsetX: number
  offsetY: number
  /** 0 standing, 1 lying down. */
  lying: number
  /** Direction of travel in radians, or null when standing still. */
  heading: number | null
  walking: boolean
}

/** How much of the hour lying down or getting up takes on screen. */
const POSTURE_FRACTION = 0.25

/** A lone forager stands this far from its tile's centre, diagonally, so it is beside the bush rather than in it. */
const STAND_RADIUS = 0.42
/** Above this many foragers on one tile, the ring they stand on widens, up to the edge of the tile. */
const RING_CAPACITY = 8

export interface StandingOffset {
  x: number
  y: number
}

/**
 * Where each forager stands on its tile in a state: foragers sharing a tile stand evenly around a ring, in ID order.
 * It depends only on positions, so the display moves each forager between its places in two real states.
 */
export function standingOffsets(state: LifeState): StandingOffset[] {
  const byTile = new Map<string, number[]>()
  for (const forager of state.foragers) {
    const key = `${forager.position.x},${forager.position.y}`
    const ids = byTile.get(key)
    if (ids) ids.push(forager.id)
    else byTile.set(key, [forager.id])
  }
  const offsets: StandingOffset[] = state.foragers.map(() => ({ x: 0, y: 0 }))
  for (const ids of byTile.values()) {
    const radius = Math.min(0.48, STAND_RADIUS * Math.max(1, ids.length / RING_CAPACITY))
    for (const [rank, id] of ids.entries()) {
      const angle = Math.PI / 4 + (2 * Math.PI * rank) / ids.length
      offsets[id] = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
    }
  }
  return offsets
}

/** The standing offsets of both states of a pair, which a frame drawing the whole band computes once. */
export const pairOffsets = (pair: DisplayPair) => ({
  previous: standingOffsets(pair.previous),
  next: standingOffsets(pair.next),
})

/**
 * Where a forager is drawn. A walk follows the simulated path tile by tile at the forager's walking speed, so a
 * walk shorter than the hour's limit ends early and the forager stands for the rest of the hour.
 */
export function foragerPose(
  pair: DisplayPair,
  foragerId: number,
  interpolate = true,
  offsets = pairOffsets(pair),
): ForagerPose {
  const { previous, next } = pair
  const alpha = interpolate ? pair.alpha : 1
  const event = currentEvent(pair, foragerId)
  const before = previous.foragers[foragerId]!
  const after = next.foragers[foragerId]!
  const lyingBefore = lastEventOf(previous, foragerId)?.action === 'sleep' || !before.alive
  const lyingAfter = event ? event.action === 'sleep' : !after.alive
  const transition = Math.min(1, alpha / POSTURE_FRACTION)
  const lying = lyingBefore === lyingAfter ? (lyingAfter ? 1 : 0) : lyingAfter ? transition : 1 - transition
  const offset = {
    offsetX: lerp(offsets.previous[foragerId]!.x, offsets.next[foragerId]!.x, alpha),
    offsetY: lerp(offsets.previous[foragerId]!.y, offsets.next[foragerId]!.y, alpha),
  }

  if (event?.action !== 'walk') {
    const { x, y } = after.position
    return { x, y, ...offset, lying, heading: null, walking: false }
  }
  const path = [event.from, ...walkPath(event.from, event.position, previous.config.tilesPerHour)]
  const travelled = Math.min(path.length - 1, alpha * previous.config.tilesPerHour)
  const index = Math.min(path.length - 2, Math.floor(travelled))
  if (index < 0) return { ...event.from, ...offset, lying, heading: null, walking: false }
  const from = path[index]!
  const to = path[index + 1]!
  const t = travelled - index
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    ...offset,
    lying,
    heading: Math.atan2(to.x - from.x, to.y - from.y),
    walking: travelled < path.length - 1,
  }
}

/**
 * The outline of every tile within `radius` of a tile, by Manhattan distance, as a closed staircase of corner points
 * relative to the tile's centre, in tiles. It runs down the right-hand side and back up the left.
 */
export function perceptionOutline(radius: number): [number, number][] {
  const points: [number, number][] = []
  for (let dy = -radius; dy <= radius; dy += 1) {
    const reach = radius - Math.abs(dy) + 0.5
    points.push([reach, dy - 0.5], [reach, dy + 0.5])
  }
  for (let dy = radius; dy >= -radius; dy -= 1) {
    const reach = radius - Math.abs(dy) + 0.5
    points.push([-reach, dy + 0.5], [-reach, dy - 0.5])
  }
  return points
}

/** Whether a radius takes in the whole grid from any tile, so every forager sees every patch. */
export const seesEverything = (state: LifeState) =>
  state.config.perceptionRadiusTiles >= state.config.gridWidth + state.config.gridHeight - 2

/** A patch's stock, part of the way through the hour. */
export function displayedStock(pair: DisplayPair, patchId: number, interpolate = true) {
  const before = pair.previous.patches[patchId]!.stockKcal
  const after = pair.next.patches[patchId]!.stockKcal
  return interpolate ? lerp(before, after, pair.alpha) : after
}

/** A bush never vanishes: an empty patch is still a patch, drawn as a small bare shrub. */
export const bushScale = (stockKcal: number, capacityKcal: number) =>
  0.3 + 0.7 * Math.sqrt(Math.max(0, stockKcal) / capacityKcal)

export const displayedEnergy = (pair: DisplayPair, foragerId: number, interpolate = true) =>
  interpolate
    ? lerp(pair.previous.foragers[foragerId]!.energyKcal, pair.next.foragers[foragerId]!.energyKcal, pair.alpha)
    : pair.next.foragers[foragerId]!.energyKcal

export const aliveCount = (state: LifeState) => state.foragers.filter((forager) => forager.alive).length

/** Forager IDs count from 0; people count from 1. */
export const foragerName = (foragerId: number) => `Forager ${foragerId + 1}`

/**
 * The forager to follow after `current` in `direction` (1 forward, −1 back), wrapping around. It steps through the
 * living; once all are dead, through everyone.
 */
export function stepFollowed(state: LifeState, current: number, direction: 1 | -1) {
  const count = state.foragers.length
  const anyAlive = state.foragers.some((forager) => forager.alive)
  for (let step = 1; step <= count; step += 1) {
    const id = (((current + direction * step) % count) + count) % count
    if (!anyAlive || state.foragers[id]!.alive) return id
  }
  return current
}

export function describeActivity(pair: DisplayPair, foragerId: number) {
  const event = currentEvent(pair, foragerId)
  if (!pair.next.foragers[foragerId]!.alive && !event) return 'Dead of starvation'
  if (!event) return 'Waiting to start'
  const patch = (id: number | null) => `patch ${(id ?? 0) + 1}`
  switch (event.action) {
    case 'sleep':
      return event.energyAfterKcal === 0 ? 'Starved in its sleep' : 'Sleeping through the night'
    case 'rest':
      if (event.reason === 'satiated') return 'Resting, well fed'
      if (event.reason === 'too late to set out') return 'Hungry, but too late in the day to set out'
      return `Hungry, waiting for ${patchAtTile(pair, event.position)} to regrow`
    case 'forage':
      return event.succeeded
        ? `Foraging at ${patch(event.patchId)}, and striking lucky`
        : `Foraging at ${patch(event.patchId)}, without luck this hour`
    case 'walk':
      if (event.reason === 'going home') return 'Walking home to camp'
      return event.targetPatchId === null
        ? `Walking to ${patchAtTile(pair, event.position)}`
        : `Walking to ${patch(event.targetPatchId)}`
  }
}

const patchLabel = (patch: Patch | undefined) => (patch ? `patch ${patch.id + 1}` : 'open ground')

const patchAtTile = (pair: DisplayPair, tile: Tile) =>
  patchLabel(pair.next.patches.find((patch) => sameTile(patch.tile, tile)))

/** What the inspector shows for a patch: the truth beside what the followed forager believes. */
export function patchInspection(state: LifeState, patchId: number, foragerId: number) {
  const patch = state.patches[patchId]!
  const memory = state.foragers[foragerId]!.memory[patchId]!
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

export const STRATEGY_LABELS: Record<Strategy, string> = {
  keeper: 'Keeper',
  sharer: 'Sharer',
  reciprocator: 'Reciprocator',
}

/** What each strategy does, in a few words for the HUD. */
export const STRATEGY_RULES: Record<Strategy, string> = {
  keeper: 'never gives',
  sharer: 'gives to anyone hungry',
  reciprocator: 'gives to those who owe it nothing',
}

export const STRATEGY_COLORS: Record<Strategy, string> = {
  keeper: palette.firmB,
  sharer: palette.positive,
  reciprocator: palette.firmA,
}

/** Food a forager carries, part of the way through the hour. */
export function displayedCarried(pair: DisplayPair, foragerId: number, interpolate = true) {
  const before = carriedKcal(pair.previous.foragers[foragerId]!.carried)
  const after = carriedKcal(pair.next.foragers[foragerId]!.carried)
  return interpolate ? lerp(before, after, pair.alpha) : after
}

/** A bundle's size beside a forager: none when it carries nothing, full size for a whole windfall or more. */
export const bundleScale = (carried: number, harvestKcal: number) =>
  carried <= 0 ? 0 : 0.5 + 0.5 * Math.min(1, Math.sqrt(carried / harvestKcal))

/** The gifts made in the hour being drawn. */
export const currentGifts = ({ previous, next }: DisplayPair): GiftEvent[] =>
  next.lastGifts.filter((gift) => gift.tick === previous.tick)

/** A point on a gift's arc, `t` of the way from giver to recipient, rising highest halfway. In tiles; `height` in world units. */
export function giftArcPoint(from: { x: number; y: number }, to: { x: number; y: number }, t: number) {
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), height: 0.75 + 0.45 * Math.sin(Math.PI * t) }
}

/**
 * Where a gift's arc runs: from the giver to the recipient on the tile where the gift was made, each at its place
 * there by the hour's end. A giver walking home hands over its food on arrival, not from where it set out.
 */
export function giftEnds(gift: GiftEvent, offsets: { next: StandingOffset[] }) {
  const at = (foragerId: number) => ({
    x: gift.tile.x + offsets.next[foragerId]!.x,
    y: gift.tile.y + offsets.next[foragerId]!.y,
  })
  return { from: at(gift.giverId), to: at(gift.recipientId) }
}

/** Whether a tile is the camp. */
export const isCamp = (state: LifeState, tile: Tile) => {
  const camp = campTile(state.config)
  return camp !== null && sameTile(camp, tile)
}

/** What the HUD says about a forager's strategy, food and gifts. */
export function foragerSummary(state: LifeState, foragerId: number) {
  const forager = state.foragers[foragerId]!
  const oldest = forager.carried[0]
  const { shelfLifeHours } = state.config
  return {
    strategy: STRATEGY_LABELS[forager.strategy],
    rule: STRATEGY_RULES[forager.strategy],
    carriedKcal: carriedKcal(forager.carried),
    /** Hours until its oldest food spoils at the start of its turn; 0 means in the coming hour. Null if it keeps. */
    spoilsInHours: oldest && shelfLifeHours > 0 ? Math.max(0, oldest.harvestTick + shelfLifeHours - state.tick) : null,
    givenKcal: forager.ledger.reduce((sum, entry) => sum + entry.givenKcal, 0),
    receivedKcal: forager.ledger.reduce((sum, entry) => sum + entry.receivedKcal, 0),
  }
}
