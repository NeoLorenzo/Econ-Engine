import { LIFE0_WORLD, LIFE1_WORLD, LIFE2_WORLD, LIFE3_WORLD, LIFE_DEFAULT_CONFIG } from './config'
import { createLife, stepLife, stockAtTurn } from './engine'
import { assertLifeInvariants } from './invariants'
import { lifeTheory } from './theory'
import type { ActionEvent, ActionHours, DaySummary, LifeConfig, Patch, Strategy } from './types'
import { manhattan, patchAt } from './world'

export const EXPERIMENT_DAYS = 400
/** Days 1–20 are a warm-up; measured averages and trends start at day 21. */
export const WARMUP_DAYS = 20
export const EXPERIMENT_SEEDS = [20260813, 1, 2, 3, 4, 5, 6, 7]
/**
 * A reserve losing more than this many kilocalories a day is declining. A well-fed forager's reserve cycles between
 * the hunger thresholds, so its measured slope wanders by about 1 kcal a day either side of zero.
 */
export const DECLINE_TOLERANCE_KCAL_PER_DAY = 2
/** A radius that covers the canonical 24 × 24 grid from any tile: every forager sees every patch every hour. */
export const FULL_INFORMATION_RADIUS = 48

/** The single-patch benchmark: one tile, one patch that starts empty, so the forager stands on it from tick 0. */
export const SINGLE_PATCH_WORLD: Partial<LifeConfig> = {
  ...LIFE0_WORLD,
  gridWidth: 1,
  gridHeight: 1,
  patchCount: 1,
  initialPatchStockKcal: 0,
}

export interface LifeRunResult {
  seed: number
  regrowthKcalPerHour: number
  bandSize: number
  /** Alive at the end of the run. */
  survivors: number
  /** Every forager alive at the end: the band is intact. */
  survived: boolean
  /** Fractional days from the start, `deathTick / 24`, of the first and the last death. */
  deathDay: number | null
  lastDeathDay: number | null
  /**
   * The lowest least-squares slope of a survivor's end-of-day reserve over the measured days, or null if no forager
   * survived.
   */
  reserveTrendKcalPerDay: number | null
  /** Mean hours a day per forager on each action, over the measured days on which no forager died. */
  meanHours: ActionHours
  /** Walks that reached their target patch, and how many found it holding less than a full hour's harvest. */
  arrivals: number
  emptyArrivals: number
  /** Each forager's distance from its starting tile to the nearest patch, by forager ID. */
  startDistances: number[]
  /** Whether each forager is alive at the end, by forager ID. */
  alive: boolean[]
  /** Each forager's strategy, and the food it gave and received over the run, by forager ID. */
  strategies: Strategy[]
  givenKcal: number[]
  receivedKcal: number[]
  /** Food taken from patches, given and spoiled by the whole band over the run. */
  bandGatheredKcal: number
  bandGivenKcal: number
  bandSpoiledKcal: number
  /** Hours of foraging, and how many succeeded. */
  forageHours: number
  successfulHours: number
  /** Hungry spells that ended, in satiation or death; one still under way at the end is not counted. */
  hungrySpells: number
  /** The number alive at the end of each day. */
  aliveByDay: number[]
  /** Each forager's hourly rates, by forager ID. */
  forageRates: number[]
  woodRates: number[]
  /** Each forager's hours foraging, gathering and walking over the measured days, by forager ID. */
  forageHoursById: number[]
  gatherHoursById: number[]
  walkHoursById: number[]
  /** Foragers alive at the end of each measured day, summed. */
  livingForagerDays: number
  /** Over the measured days: swaps and quotes, wood swapped and burned, hours slept and slept cold. */
  swaps: number
  quotes: number
  swappedWood: number
  burnedWood: number
  sleepHours: number
  coldSleepHours: number
  /** The terms of every swap over the measured days, in order. */
  swapTerms: number[]
  /** Each forager's rates at 100% practice: its born rates, which are Life 3's rates. By forager ID. */
  bornForageRates: number[]
  bornWoodRates: number[]
  /** The wood each forager gathered over the measured days, by forager ID. */
  gatheredWoodById: number[]
  /** The highest own terms among living foragers over the lowest, at the end of each of `TERMS_SPREAD_DAYS`. */
  termsSpread: Record<number, number | null>
  /** The day of the run's first swap, as `tick / 24`, or null if none. */
  firstSwapDay: number | null
  /** The forager that gathered the most wood in each `LEAD_WINDOW_DAYS`-day window from day 41, ties to the lowest ID. */
  leadGatherers: number[]
  /** Each forager's hours gathering, and foraging and gathering, over days 21–210 and over days 211–400. */
  firstHalf: { gather: number[]; work: number[] }
  secondHalf: { gather: number[]; work: number[] }
}

/** The days at whose end the spread of own terms is measured. */
export const TERMS_SPREAD_DAYS = [20, 100, 400]
/** Lead gatherers are counted over windows of this many days, from day 41. */
export const LEAD_WINDOW_DAYS = 40
/** Persistence compares wood shares before and after this day. */
const HALF_DAY = 210

/** Alive at the end, intact, with no reserve declining. */
export const isSustained = (result: LifeRunResult) =>
  result.survived && result.reserveTrendKcalPerDay! >= -DECLINE_TOLERANCE_KCAL_PER_DAY

/** Some foragers survive, and none of their reserves is declining. */
export const survivorsSustained = (result: LifeRunResult) =>
  result.survivors > 0 && result.reserveTrendKcalPerDay! >= -DECLINE_TOLERANCE_KCAL_PER_DAY

function slope(values: readonly number[]) {
  const n = values.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = values.reduce((sum, value) => sum + value, 0) / n
  let numerator = 0
  let denominator = 0
  for (const [index, value] of values.entries()) {
    numerator += (index - meanX) * (value - meanY)
    denominator += (index - meanX) ** 2
  }
  return numerator / denominator
}

const ACTIONS: (keyof ActionHours)[] = ['sleep', 'rest', 'forage', 'walk', 'gather']

function meanHoursPerForager(days: readonly DaySummary[]): ActionHours {
  // On a day with no death, every forager alive at its end acted in all 24 of its hours.
  const counted = days.filter((day) => day.deaths === 0 && day.alive > 0)
  const foragerDays = counted.reduce((sum, day) => sum + day.alive, 0)
  const mean: ActionHours = { sleep: 0, rest: 0, forage: 0, walk: 0, gather: 0 }
  for (const action of ACTIONS) {
    const hours = counted.reduce((sum, day) => sum + day.hours[action], 0)
    mean[action] = foragerDays ? hours / foragerDays : 0
  }
  return mean
}

const nearestPatchDistance = (patches: readonly Patch[], tile: { x: number; y: number }) =>
  Math.min(...patches.map((patch) => manhattan(patch.tile, tile)))

// Runs are deterministic, so experiments that share a configuration share its run.
const runCache = new Map<string, LifeRunResult>()

/**
 * Runs one configuration headless, checking every invariant after every hour. A run ends early once every forager is
 * dead, since nothing but regrowth can happen after that.
 */
export function runLife(overrides: Partial<LifeConfig>, days = EXPERIMENT_DAYS): LifeRunResult {
  const key = JSON.stringify([Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)), days])
  const cached = runCache.get(key)
  if (cached) return cached
  let state = createLife(overrides)
  assertLifeInvariants(state)
  const startDistances = state.foragers.map((forager) => nearestPatchDistance(state.patches, forager.position))
  let arrivals = 0
  let emptyArrivals = 0
  let forageHours = 0
  let successfulHours = 0
  let hungrySpells = 0
  const byId = () => state.foragers.map(() => 0)
  const forageHoursById = byId()
  const gatherHoursById = byId()
  const walkHoursById = byId()
  let quotes = 0
  let sleepHours = 0
  let coldSleepHours = 0
  const swapTerms: number[] = []
  const gatheredWoodById = byId()
  const termsSpread: Record<number, number | null> = {}
  let firstSwapDay: number | null = null
  const leadGatherers: number[] = []
  let windowWood = byId()
  const firstHalf = { gather: byId(), work: byId() }
  const secondHalf = { gather: byId(), work: byId() }
  for (let hour = 0; hour < days * 24 && state.foragers.some((forager) => forager.alive); hour += 1) {
    const before = state
    state = stepLife(state)
    assertLifeInvariants(state)
    if (firstSwapDay === null && state.lastSwaps.length) firstSwapDay = hour / 24
    const day = (hour + 1) / 24
    if (TERMS_SPREAD_DAYS.includes(day)) {
      const terms = state.foragers.filter((f) => f.alive).map((f) => f.forageRate / f.woodRate)
      termsSpread[day] = terms.length ? Math.max(...terms) / Math.min(...terms) : null
    }
    if (hour >= LEAD_WINDOW_DAYS * 24) {
      for (const event of state.lastEvents) windowWood[event.foragerId]! += event.gatheredWood
      if (Number.isInteger(day) && day % LEAD_WINDOW_DAYS === 0) {
        const most = Math.max(...windowWood)
        if (most > 0) leadGatherers.push(windowWood.indexOf(most))
        windowWood = byId()
      }
    }
    if (hour >= WARMUP_DAYS * 24) {
      const half = hour < HALF_DAY * 24 ? firstHalf : secondHalf
      for (const event of state.lastEvents) {
        if (event.action === 'forage' || event.action === 'gather') half.work[event.foragerId]! += 1
        if (event.action === 'gather') half.gather[event.foragerId]! += 1
        gatheredWoodById[event.foragerId]! += event.gatheredWood
        if (event.action === 'forage') forageHoursById[event.foragerId]! += 1
        if (event.action === 'gather') gatherHoursById[event.foragerId]! += 1
        if (event.action === 'walk') walkHoursById[event.foragerId]! += 1
        if (event.action === 'sleep') sleepHours += 1
        if (event.sleptCold) coldSleepHours += 1
      }
      for (const made of state.lastSwaps) swapTerms.push(made.kcalPerWood)
      quotes += state.lastQuotes.length
    }
    for (const [index, event] of state.lastEvents.entries()) {
      if (event.action === 'forage') {
        forageHours += 1
        if (event.succeeded) successfulHours += 1
      }
      // A spell ends when the forager is satiated again, or dies.
      const wasHungry = before.foragers[event.foragerId]!.hungry
      const after = state.foragers[event.foragerId]!
      if (wasHungry && (!after.hungry || !after.alive)) hungrySpells += 1
      // A walk towards a patch clears its target exactly when it arrives. Turns after it may have foraged there since.
      if (event.action !== 'walk' || event.reason !== 'seeking food' || event.targetPatchId !== null) continue
      arrivals += 1
      const patch = patchAt(state.patches, event.position)
      if (!patch || stockAtTurn(state, index, patch.id) < state.config.harvestKcal) emptyArrivals += 1
    }
  }
  const measured = state.days.slice(WARMUP_DAYS)
  const deathDays = state.foragers.flatMap((forager) => (forager.deathTick === null ? [] : [forager.deathTick / 24]))
  const trends = state.foragers
    .filter((forager) => forager.alive)
    .map((forager) => slope(measured.map((day) => day.endEnergyKcal[forager.id]!)))
  const result: LifeRunResult = {
    seed: state.config.seed,
    regrowthKcalPerHour: state.config.patchRegrowthKcalPerHour,
    bandSize: state.config.bandSize,
    survivors: trends.length,
    survived: trends.length === state.config.bandSize,
    deathDay: deathDays.length ? Math.min(...deathDays) : null,
    lastDeathDay: deathDays.length ? Math.max(...deathDays) : null,
    reserveTrendKcalPerDay: trends.length ? Math.min(...trends) : null,
    meanHours: meanHoursPerForager(measured),
    arrivals,
    emptyArrivals,
    startDistances,
    alive: state.foragers.map((forager) => forager.alive),
    strategies: state.foragers.map((forager) => forager.strategy),
    givenKcal: state.foragers.map((forager) => forager.ledger.reduce((sum, entry) => sum + entry.givenKcal, 0)),
    receivedKcal: state.foragers.map((forager) => forager.ledger.reduce((sum, entry) => sum + entry.receivedKcal, 0)),
    bandGatheredKcal: state.totals.gatheredKcal,
    bandGivenKcal: state.totals.givenKcal,
    bandSpoiledKcal: state.totals.spoiledKcal,
    forageHours,
    successfulHours,
    hungrySpells,
    aliveByDay: state.days.map((day) => day.alive),
    forageRates: state.foragers.map((forager) => forager.forageRate),
    woodRates: state.foragers.map((forager) => forager.woodRate),
    forageHoursById,
    gatherHoursById,
    walkHoursById,
    livingForagerDays: measured.reduce((sum, day) => sum + day.alive, 0),
    swaps: swapTerms.length,
    quotes,
    swappedWood: measured.reduce((sum, day) => sum + day.swappedWood, 0),
    burnedWood: measured.reduce((sum, day) => sum + day.burnedWood, 0),
    sleepHours,
    coldSleepHours,
    swapTerms,
    bornForageRates: state.foragers.map((forager) =>
      Math.floor((state.config.forageKcalPerHour * forager.foragingSkill) / 100),
    ),
    bornWoodRates: state.foragers.map((forager) => Math.floor((state.config.woodPerHour * forager.woodSkill) / 100)),
    gatheredWoodById,
    termsSpread,
    firstSwapDay,
    leadGatherers,
    firstHalf,
    secondHalf,
  }
  runCache.set(key, result)
  return result
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index)

// Life 0's experiments, on Life 0's world.

/** Life 0 experiment 1: survival around the single-patch threshold, at every integer rate from 0.5 to 1.5 times it. */
export function singlePatchThresholdExperiment(rates?: readonly number[]) {
  const theory = lifeTheory(createLife(SINGLE_PATCH_WORLD).config)
  const threshold = theory.singlePatchThresholdKcalPerHour
  const sweep = rates ?? range(Math.ceil(threshold * 0.5), Math.floor(threshold * 1.5))
  const rows = sweep.map((rate) => {
    const result = runLife({ ...SINGLE_PATCH_WORLD, patchRegrowthKcalPerHour: rate })
    const config = createLife({ ...SINGLE_PATCH_WORLD, patchRegrowthKcalPerHour: rate }).config
    return { ...result, deathDayWindow: lifeTheory(config).deathDayWindow(rate, config.initialReserveKcal) }
  })
  const declining = rows.filter((row) => !isSustained(row)).map((row) => row.regrowthKcalPerHour)
  const sustained = rows.filter(isSustained).map((row) => row.regrowthKcalPerHour)
  return {
    threshold,
    rows,
    /** The highest rate at which the reserve still declines, and the lowest at which it does not. */
    lastDeclining: declining.length ? Math.max(...declining) : null,
    firstSustained: sustained.length ? Math.min(...sustained) : null,
  }
}

/** Life 0 experiment 2: working hours on one patch as food becomes more abundant. */
export function leisureExperiment(rates: readonly number[] = [100, 200, 400, 800]) {
  const theory = lifeTheory(createLife(SINGLE_PATCH_WORLD).config)
  return {
    expectedForageHoursPerDay: theory.forageHoursPerDay,
    rows: rates.map((rate) => runLife({ ...SINGLE_PATCH_WORLD, patchRegrowthKcalPerHour: rate })),
  }
}

/**
 * Life 0 experiment 3: Life 0's four-patch world across seeds and per-patch rates. The frontier is the lowest rate at
 * which the forager survives with a reserve that is not declining; its ratio to the lower bound is the cost of travel
 * and out-of-date knowledge.
 */
export function localKnowledgeExperiment(seeds: readonly number[] = EXPERIMENT_SEEDS, rates = range(20, 91)) {
  const lowerBound = lifeTheory(createLife(LIFE0_WORLD).config).lowerBoundPerPatchKcalPerHour
  const perSeed = seeds.map((seed) => {
    const rows = rates.map((rate) => runLife({ ...LIFE0_WORLD, seed, patchRegrowthKcalPerHour: rate }))
    const sustained = rows.find(isSustained)
    const frontier = sustained?.regrowthKcalPerHour ?? null
    return { seed, rows, frontier, frontierRatio: frontier === null ? null : frontier / lowerBound }
  })
  return { lowerBound, perSeed }
}

// Life 1's experiments.

const fnv1a = (hash: number, text: string) => {
  let next = hash
  for (let index = 0; index < text.length; index += 1) {
    next ^= text.charCodeAt(index)
    next = Math.imul(next, 16_777_619) >>> 0
  }
  return next
}

/** Forager 0's action as Life 0 recorded it, field for field. */
const life0Event = (event: ActionEvent | undefined) =>
  event && {
    kind: event.kind,
    tick: event.tick,
    action: event.action,
    reason: event.reason,
    from: { x: event.from.x, y: event.from.y },
    position: { x: event.position.x, y: event.position.y },
    targetPatchId: event.targetPatchId,
    patchId: event.patchId,
    gatheredKcal: event.gatheredKcal,
    spentKcal: event.spentKcal,
    energyAfterKcal: event.energyAfterKcal,
  }

/**
 * A checksum of forager 0's every action, every patch stock every hour, and the daily summaries, in the form Life 0's
 * code produced them. Experiment 1 compares it with checksums recorded from Life 0 before step 1.
 */
export function life0Checksum(overrides: Partial<LifeConfig>, days = EXPERIMENT_DAYS) {
  let state = createLife(overrides)
  let hash = 2_166_136_261
  for (let hour = 0; hour < days * 24; hour += 1) {
    state = stepLife(state)
    const event = state.lastEvents.find((candidate) => candidate.foragerId === 0)
    hash = fnv1a(hash, JSON.stringify(life0Event(event) ?? null))
    hash = fnv1a(
      hash,
      JSON.stringify(state.patches.map((patch) => [patch.id, patch.tile.x, patch.tile.y, patch.stockKcal])),
    )
  }
  const summaries = state.days.map((day) => [
    day.day,
    day.hours.sleep,
    day.hours.rest,
    day.hours.forage,
    day.hours.walk,
    day.gatheredKcal,
    day.spentKcal,
    day.endEnergyKcal[0],
    day.totalPatchStockKcal,
    day.alive > 0,
  ])
  return fnv1a(hash, JSON.stringify(summaries))
}

/** Seed, per-patch rate and checksum, recorded from Life 0's code. The last three runs starve or come close. */
export const LIFE0_CHECKSUMS: readonly [seed: number, rate: number, checksum: number][] = [
  [20260813, 50, 0x8308a896],
  [1, 50, 0x71578e67],
  [2, 25, 0x559e6cd0],
  [5, 90, 0x556913c4],
  [20260813, 30, 0x944b668f],
  [3, 24, 0xf06ab2ff],
  [4, 20, 0x1d3ced6f],
]

/** Life 1 experiment 1: a band of one on Life 0's world reproduces Life 0. */
export const bandOfOneExperiment = () =>
  LIFE0_CHECKSUMS.map(([seed, rate, expected]) => ({
    seed,
    rate,
    expected,
    actual: life0Checksum({ ...LIFE0_WORLD, seed, patchRegrowthKcalPerHour: rate }),
  }))

/** The largest band, among `sizes`, that is still intact at the end of the run. It searches down from the largest. */
export function largestIntactBand(overrides: Partial<LifeConfig>, sizes: readonly number[]) {
  const descending = [...sizes].sort((a, b) => b - a)
  return descending.find((bandSize) => runLife({ ...overrides, bandSize }).survived) ?? null
}

/** Life 1's canonical world's capacities, and the band sizes Life 1's experiments are built around. */
export function canonicalCapacities(overrides: Partial<LifeConfig> = {}) {
  const config = createLife({ ...LIFE1_WORLD, ...overrides, bandSize: 1 }).config
  const { carryingCapacity, searchCapacity } = lifeTheory(config)
  return {
    carryingCapacity,
    searchCapacity,
    /** At or below the search capacity. */
    smallBand: Math.floor(searchCapacity),
    /** Just above the carrying capacity. */
    fullBand: Math.ceil(carryingCapacity),
    /** About twice the carrying capacity. */
    largeBand: Math.round(2 * carryingCapacity),
  }
}

/** Life 1 experiment 2: Life 1's canonical world at the canonical radius, with the band size varied. */
export function carryingCapacityExperiment(seeds: readonly number[] = EXPERIMENT_SEEDS, sizes = range(8, 20)) {
  const capacities = canonicalCapacities()
  const perSeed = seeds.map((seed) => ({
    seed,
    small: runLife({ ...LIFE1_WORLD, seed, bandSize: capacities.smallBand }),
    full: runLife({ ...LIFE1_WORLD, seed, bandSize: capacities.fullBand }),
    large: runLife({ ...LIFE1_WORLD, seed, bandSize: capacities.largeBand }),
    largestIntact: largestIntactBand({ ...LIFE1_WORLD, seed }, sizes),
  }))
  return { ...capacities, perSeed }
}

/** Life 1 experiment 3: the bands of experiment 2 at radius 0, the canonical radius and full information. */
export function knowledgeInABandExperiment(
  seeds: readonly number[] = EXPERIMENT_SEEDS,
  radii: readonly number[] = [0, 2, FULL_INFORMATION_RADIUS],
) {
  const capacities = canonicalCapacities()
  const perRadius = radii.map((perceptionRadiusTiles) => ({
    perceptionRadiusTiles,
    perSeed: seeds.map((seed) => ({
      seed,
      small: runLife({ ...LIFE1_WORLD, seed, perceptionRadiusTiles, bandSize: capacities.smallBand }),
      large: runLife({ ...LIFE1_WORLD, seed, perceptionRadiusTiles, bandSize: capacities.largeBand }),
    })),
  }))
  return { ...capacities, perRadius }
}

/** Life 1 experiment 4: a large band at the canonical radius, with walking costing more or less. */
export function searchCostExperiment(
  seeds: readonly number[] = EXPERIMENT_SEEDS,
  travelCosts: readonly number[] = [300, 200, 90],
) {
  const { largeBand } = canonicalCapacities()
  return travelCosts.map((travelKcalPerHour) => ({
    travelKcalPerHour,
    ...canonicalCapacities({ travelKcalPerHour }),
    perSeed: seeds.map((seed) => runLife({ ...LIFE1_WORLD, seed, travelKcalPerHour, bandSize: largeBand })),
  }))
}

/** Life 1 experiment 5: who survives the collapse of a large band, and how the survivors live. */
export function whoSurvivesExperiment(seeds: readonly number[] = EXPERIMENT_SEEDS) {
  const { largeBand } = canonicalCapacities()
  const runs = seeds.map((seed) => runLife({ ...LIFE1_WORLD, seed, bandSize: largeBand }))
  const distances = (alive: boolean) =>
    runs.flatMap((run) => run.startDistances.filter((_, id) => run.alive[id] === alive))
  const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1)
  return {
    runs,
    survivorStartDistance: mean(distances(true)),
    deadStartDistance: mean(distances(false)),
    survivors: distances(true).length,
    dead: distances(false).length,
  }
}

// Life 2's experiments.

/**
 * A checksum of every forager's action every hour, every patch stock every hour, and the daily summaries, in the form
 * Life 1's code produced them. Experiment 1 compares it with checksums recorded from Life 1 before step 2.
 */
export function life1Checksum(overrides: Partial<LifeConfig>, days = EXPERIMENT_DAYS) {
  let state = createLife(overrides)
  let hash = 2_166_136_261
  for (let hour = 0; hour < days * 24; hour += 1) {
    state = stepLife(state)
    const events = state.lastEvents.map((event) => [
      event.foragerId,
      event.tick,
      event.action,
      event.reason,
      event.from.x,
      event.from.y,
      event.position.x,
      event.position.y,
      event.targetPatchId,
      event.patchId,
      event.gatheredKcal,
      event.spentKcal,
      event.energyAfterKcal,
    ])
    hash = fnv1a(hash, JSON.stringify(events))
    hash = fnv1a(
      hash,
      JSON.stringify(state.patches.map((patch) => [patch.id, patch.tile.x, patch.tile.y, patch.stockKcal])),
    )
  }
  const summaries = state.days.map((day) => [
    day.day,
    day.hours.sleep,
    day.hours.rest,
    day.hours.forage,
    day.hours.walk,
    day.gatheredKcal,
    day.spentKcal,
    day.alive,
    day.deaths,
    day.totalPatchStockKcal,
    day.endEnergyKcal,
  ])
  return fnv1a(hash, JSON.stringify(summaries))
}

/** Seed, band size and checksum on Life 1's world, recorded from Life 1's code. */
export const LIFE1_CHECKSUMS: readonly [seed: number, bandSize: number, checksum: number][] = [
  [20260813, 10, 0x5d45bbce],
  [1, 10, 0x2706f12e],
  [20260813, 40, 0xb3229d91],
  [1, 40, 0x88514433],
]

/** Experiment 1: on Life 1's world, with no camp, steady harvests and only keepers, the step reproduces Life 1. */
export const life1ReproducedExperiment = () =>
  LIFE1_CHECKSUMS.map(([seed, bandSize, expected]) => ({
    seed,
    bandSize,
    expected,
    actual: life1Checksum({ ...LIFE1_WORLD, seed, bandSize }),
  }))

/** Seeds for Life 2's ensembles: the canonical seed, then 1, 2, 3, … */
export const life2Seeds = (count: number) => [20260813, ...range(1, count - 1)]

export const WINDFALLS = [1_200, 3_600, 6_000, 9_600]

/** Bands made up entirely of one strategy, the size of the canonical band. */
export const UNIFORM_STRATEGIES: Strategy[] = ['keeper', 'sharer', 'reciprocator']

export function uniformBand(strategy: Strategy): Partial<LifeConfig> {
  const bandSize = LIFE2_WORLD.bandSize!
  return {
    ...LIFE2_WORLD,
    sharers: strategy === 'sharer' ? bandSize : 0,
    reciprocators: strategy === 'reciprocator' ? bandSize : 0,
  }
}

/**
 * The bad-luck benchmark: a lone keeper on one tile whose patch always holds a full harvest, with food that keeps.
 * Its only risk is a run of failed hours.
 */
export const BAD_LUCK_WORLD: Partial<LifeConfig> = {
  ...LIFE0_WORLD,
  gridWidth: 1,
  gridHeight: 1,
  patchCount: 1,
  patchCapacityKcal: 48_000,
  initialPatchStockKcal: 48_000,
  patchRegrowthKcalPerHour: 5_000,
  harvestKcal: 24_000,
  shelfLifeHours: 0,
}

/** Experiment 2: bad luck on a single patch, against `(1 − p)ⁿ`. */
export function badLuckExperiment(seeds: readonly number[] = life2Seeds(400)) {
  const theory = lifeTheory(createLife(BAD_LUCK_WORLD).config)
  const runs = seeds.map((seed) => runLife({ ...BAD_LUCK_WORLD, seed }))
  const sum = (pick: (run: LifeRunResult) => number) => runs.reduce((total, run) => total + pick(run), 0)
  const forageHours = sum((run) => run.forageHours)
  const successfulHours = sum((run) => run.successfulHours)
  const spells = sum((run) => run.hungrySpells)
  const deaths = sum((run) => run.bandSize - run.survivors)
  const probability = theory.harvestSuccessProbability
  const starvationRate = deaths / spells
  return {
    probability,
    forageHours,
    successRate: successfulHours / forageHours,
    successRateStandardError: Math.sqrt((probability * (1 - probability)) / forageHours),
    spells,
    deaths,
    starvationRate,
    starvationRateStandardError: Math.sqrt((starvationRate * (1 - starvationRate)) / spells),
    tries: theory.triesPerHungrySpell,
    expected: theory.starvationPerSpell(),
  }
}

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1)

/** A uniform band's runs at one windfall and shelf life, summarized across seeds. */
function uniformRow(seeds: readonly number[], strategy: Strategy, harvestKcal: number, shelfLifeHours: number) {
  const runs = seeds.map((seed) => runLife({ ...uniformBand(strategy), seed, harvestKcal, shelfLifeHours }))
  const gathered = runs.reduce((sum, run) => sum + run.bandGatheredKcal, 0)
  return {
    strategy,
    harvestKcal,
    shelfLifeHours,
    runs,
    meanSurvivors: mean(runs.map((run) => run.survivors)),
    /** Shares of all food taken from patches, over every seed. */
    givenShare: gathered ? runs.reduce((sum, run) => sum + run.bandGivenKcal, 0) / gathered : 0,
    spoiledShare: gathered ? runs.reduce((sum, run) => sum + run.bandSpoiledKcal, 0) / gathered : 0,
    carried: runs.some((run) => run.bandGivenKcal + run.bandSpoiledKcal > 0),
  }
}

/** Experiment 3: bands of keepers as windfalls grow, at the canonical shelf life. */
export const windfallRiskExperiment = (seeds: readonly number[] = life2Seeds(32), windfalls = WINDFALLS) =>
  windfalls.map((harvestKcal) => uniformRow(seeds, 'keeper', harvestKcal, LIFE_DEFAULT_CONFIG.shelfLifeHours))

/** Experiment 4: bands of each strategy as windfalls grow, at the canonical shelf life. */
export const sharingInsuranceExperiment = (seeds: readonly number[] = life2Seeds(32), windfalls = WINDFALLS) =>
  windfalls.map((harvestKcal) => ({
    harvestKcal,
    byStrategy: UNIFORM_STRATEGIES.map((strategy) =>
      uniformRow(seeds, strategy, harvestKcal, LIFE_DEFAULT_CONFIG.shelfLifeHours),
    ),
  }))

/** Experiment 5: bands of each strategy with food that keeps, lasts 48 hours or lasts 12. */
export const perishabilityExperiment = (
  seeds: readonly number[] = life2Seeds(32),
  harvestKcal = 9_600,
  shelfLives: readonly number[] = [0, 48, 12],
) =>
  shelfLives.map((shelfLifeHours) => ({
    shelfLifeHours,
    byStrategy: UNIFORM_STRATEGIES.map((strategy) => uniformRow(seeds, strategy, harvestKcal, shelfLifeHours)),
  }))

/** Experiment 6: the canonical mixed band, with each strategy's survival and the food it gave and received. */
export function whoPaysExperiment(
  seeds: readonly number[] = life2Seeds(64),
  windfalls: readonly number[] = [3_600, 6_000, 9_600],
  shelfLives: readonly number[] = [0, 48, 12],
) {
  return windfalls.flatMap((harvestKcal) =>
    shelfLives.map((shelfLifeHours) => {
      const runs = seeds.map((seed) => runLife({ ...LIFE2_WORLD, seed, harvestKcal, shelfLifeHours }))
      const byStrategy = UNIFORM_STRATEGIES.map((strategy) => {
        const members = runs.flatMap((run) =>
          run.strategies.flatMap((own, id) =>
            own === strategy
              ? [{ alive: run.alive[id]!, given: run.givenKcal[id]!, received: run.receivedKcal[id]! }]
              : [],
          ),
        )
        const aliveShare = mean(members.map((member) => (member.alive ? 1 : 0)))
        return {
          strategy,
          foragers: members.length,
          aliveShare,
          aliveShareStandardError: Math.sqrt((aliveShare * (1 - aliveShare)) / (members.length || 1)),
          meanGivenKcal: mean(members.map((member) => member.given)),
          meanReceivedKcal: mean(members.map((member) => member.received)),
        }
      })
      return { harvestKcal, shelfLifeHours, byStrategy }
    }),
  )
}

// Life 3's experiments.

/**
 * A checksum of every forager's action, reserve and carried food every hour, every gift, every patch stock every hour,
 * and the daily summaries, in the form Life 2's code produced them. Experiment 1 compares it with checksums recorded
 * from Life 2 before step 3.
 */
export function life2Checksum(overrides: Partial<LifeConfig>, days = EXPERIMENT_DAYS) {
  let state = createLife(overrides)
  let hash = 2_166_136_261
  for (let hour = 0; hour < days * 24; hour += 1) {
    state = stepLife(state)
    const events = state.lastEvents.map((event) => [
      event.foragerId,
      event.tick,
      event.action,
      event.reason,
      event.from.x,
      event.from.y,
      event.position.x,
      event.position.y,
      event.targetPatchId,
      event.patchId,
      event.succeeded,
      event.gatheredKcal,
      event.spoiledKcal,
      event.eatenKcal,
      event.spentKcal,
      event.energyAfterKcal,
      event.carriedAfterKcal,
    ])
    const gifts = state.lastGifts.map((gift) => [
      gift.tick,
      gift.giverId,
      gift.recipientId,
      gift.tile.x,
      gift.tile.y,
      gift.requestKcal,
      gift.kcal,
    ])
    hash = fnv1a(hash, JSON.stringify([events, gifts]))
    hash = fnv1a(
      hash,
      JSON.stringify(state.patches.map((patch) => [patch.id, patch.tile.x, patch.tile.y, patch.stockKcal])),
    )
  }
  const summaries = state.days.map((day) => [
    day.day,
    day.hours.sleep,
    day.hours.rest,
    day.hours.forage,
    day.hours.walk,
    day.gatheredKcal,
    day.spentKcal,
    day.alive,
    day.deaths,
    day.totalPatchStockKcal,
    day.endEnergyKcal,
    day.givenKcal,
    day.spoiledKcal,
    day.carriedKcal,
    day.aliveByStrategy,
  ])
  return fnv1a(hash, JSON.stringify(summaries))
}

/** Seed, overrides on Life 2's world and checksum, recorded from Life 2's code. */
export const LIFE2_CHECKSUMS: readonly [seed: number, overrides: Partial<LifeConfig>, checksum: number][] = [
  [20260813, {}, 0xf67031fe],
  [1, {}, 0x7911dcee],
  [20260813, { sharers: 0, reciprocators: 0, harvestKcal: 9_600 }, 0x37e97742],
]

/** Experiment 1: on Life 2's world, with no groves, warm nights, equal skills and no swaps, the step reproduces Life 2. */
export const life2ReproducedExperiment = () =>
  LIFE2_CHECKSUMS.map(([seed, overrides, expected]) => ({
    seed,
    overrides,
    expected,
    actual: life2Checksum({ ...LIFE2_WORLD, ...overrides, seed }),
  }))

/**
 * A checksum of everything that happens in every hour: every action, swap, quote and gift, and every patch and grove.
 * Two runs with the same checksum are identical hour by hour.
 */
export function hourlyChecksum(overrides: Partial<LifeConfig>, days = EXPERIMENT_DAYS) {
  let state = createLife(overrides)
  let hash = 2_166_136_261
  for (let hour = 0; hour < days * 24; hour += 1) {
    state = stepLife(state)
    hash = fnv1a(
      hash,
      JSON.stringify([
        state.lastEvents,
        state.lastSwaps,
        state.lastQuotes,
        state.lastGifts,
        state.patches,
        state.groves,
      ]),
    )
  }
  return hash
}

/** A forager's share of its foraging and gathering hours spent gathering, or null if it did neither. */
export const woodShare = (run: LifeRunResult, id: number) => {
  const working = run.forageHoursById[id]! + run.gatherHoursById[id]!
  return working ? run.gatherHoursById[id]! / working : null
}

/** Pearson's correlation, or null when either side does not vary. */
function correlation(pairs: readonly [number, number][]) {
  if (pairs.length < 2) return null
  const meanX = mean(pairs.map(([x]) => x))
  const meanY = mean(pairs.map(([, y]) => y))
  let xy = 0
  let xx = 0
  let yy = 0
  for (const [x, y] of pairs) {
    xy += (x - meanX) * (y - meanY)
    xx += (x - meanX) ** 2
    yy += (y - meanY) ** 2
  }
  return xx && yy ? xy / Math.sqrt(xx * yy) : null
}

/**
 * Across a band, the correlation between born own terms and wood share, over foragers that worked at all. Without
 * practice, born own terms are a forager's own terms throughout.
 */
export function specializationCorrelation(run: LifeRunResult) {
  const pairs = run.bornForageRates.flatMap((forageRate, id): [number, number][] => {
    const share = woodShare(run, id)
    return share === null ? [] : [[forageRate / run.bornWoodRates[id]!, share]]
  })
  return correlation(pairs)
}

/** The share of the band's wood, over the measured days, gathered by the two foragers that gathered the most. */
export function woodConcentration(run: LifeRunResult) {
  const gathered = [...run.gatheredWoodById].sort((a, b) => b - a)
  const total = gathered.reduce((sum, wood) => sum + wood, 0)
  return total ? (gathered[0]! + (gathered[1] ?? 0)) / total : 0
}

/**
 * Across a band, the correlation between each forager's wood share over days 21–210 and over days 211–400, over
 * foragers that worked in both; null if it cannot be measured.
 */
export function persistence(run: LifeRunResult) {
  const share = (half: LifeRunResult['firstHalf'], id: number) => half.gather[id]! / half.work[id]!
  const pairs = run.firstHalf.work.flatMap((work, id): [number, number][] =>
    work && run.secondHalf.work[id] ? [[share(run.firstHalf, id), share(run.secondHalf, id)]] : [],
  )
  return correlation(pairs)
}

/** The third of a band with the lowest born foraging rates, ties to the lowest ID. */
export function leastSkilledThird(run: LifeRunResult) {
  const ids = run.bornForageRates.map((_, id) => id)
  ids.sort((a, b) => run.bornForageRates[a]! - run.bornForageRates[b]! || a - b)
  return ids.slice(0, Math.floor(ids.length / 3))
}

const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0)

/** One configuration's runs across seeds, summarized by the specialization measures of the specification. */
export function specializationRow(seeds: readonly number[], overrides: Partial<LifeConfig>) {
  const runs = seeds.map((seed) => runLife({ ...overrides, seed }))
  const correlations = runs.map(specializationCorrelation).filter((value) => value !== null)
  const least = runs.flatMap((run) => leastSkilledThird(run).map((id) => (run.alive[id] ? 1 : 0)))
  const sum = (pick: (run: LifeRunResult) => number) => total(runs.map(pick))
  const livingDays = sum((run) => run.livingForagerDays)
  const burned = sum((run) => run.burnedWood)
  const slept = sum((run) => run.sleepHours)
  return {
    runs,
    meanSurvivors: mean(runs.map((run) => run.survivors)),
    leastSkilledAliveShare: mean(least),
    /** The mean of each run's correlation, or null if no run's could be measured. */
    correlation: correlations.length ? mean(correlations) : null,
    concentration: mean(runs.map(woodConcentration)),
    boughtShare: burned ? sum((run) => run.swappedWood) / burned : 0,
    coldShare: slept ? sum((run) => run.coldSleepHours) / slept : 0,
    /** Hours a day per living forager over the measured days. */
    workHoursPerDay: livingDays
      ? sum((run) => total(run.forageHoursById) + total(run.gatherHoursById)) / livingDays
      : 0,
    walkHoursPerDay: livingDays ? sum((run) => total(run.walkHoursById)) / livingDays : 0,
    swapsPerRun: mean(runs.map((run) => run.swaps)),
    quotesPerRun: mean(runs.map((run) => run.quotes)),
    /** The mean spread of own terms at the end of each of `TERMS_SPREAD_DAYS`, over runs alive then. */
    termsSpread: Object.fromEntries(
      TERMS_SPREAD_DAYS.map((day) => {
        const spreads = runs.flatMap((run) => (run.termsSpread[day] == null ? [] : [run.termsSpread[day]]))
        return [day, spreads.length ? mean(spreads) : null]
      }),
    ) as Record<number, number | null>,
    firstSwapDays: runs.map((run) => run.firstSwapDay),
    /** The mean number of different lead gatherers over a run's windows. */
    leadGatherers: mean(runs.map((run) => new Set(run.leadGatherers).size)),
    /** The mean persistence, over runs where it could be measured, or null. */
    persistence: (() => {
      const values = runs.map(persistence).filter((value) => value !== null)
      return values.length ? mean(values) : null
    })(),
    /** The mean number alive across runs at the end of each day. */
    aliveByDay: Array.from({ length: Math.max(0, ...runs.map((run) => run.aliveByDay.length)) }, (_, day) =>
      mean(runs.map((run) => run.aliveByDay[day] ?? 0)),
    ),
  }
}

/** Life 3's band with equal skills. Life 3's experiments run on `LIFE3_WORLD`. */
export const EQUAL_SKILLS: Partial<LifeConfig> = { ...LIFE3_WORLD, skillMinPercent: 100, skillMaxPercent: 100 }

/** Experiment 2: bands with equal skills, with and without swapping. */
export function woodAndColdExperiment(seeds: readonly number[] = life2Seeds(8)) {
  const nightWood = lifeTheory(createLife(EQUAL_SKILLS).config).nightWood
  return {
    off: specializationRow(seeds, { ...EQUAL_SKILLS, swapping: false }),
    on: specializationRow(seeds, EQUAL_SKILLS),
    identical: seeds.map(
      (seed) =>
        hourlyChecksum({ ...EQUAL_SKILLS, seed }) === hourlyChecksum({ ...EQUAL_SKILLS, seed, swapping: false }),
    ),
    /** Each survivor's hours gathering a day, as a share of a night's wood over its wood rate. */
    woodHoursAgainstTheory: seeds.flatMap((seed) => {
      const run = runLife({ ...EQUAL_SKILLS, seed })
      const measuredDays = run.aliveByDay.length - WARMUP_DAYS
      return run.alive.flatMap((alive, id) =>
        alive ? [run.gatherHoursById[id]! / measuredDays / (nightWood / run.woodRates[id]!)] : [],
      )
    }),
  }
}

/** Experiment 3: the canonical band with swapping off and on. */
export const comparativeAdvantageExperiment = (seeds: readonly number[] = life2Seeds(32)) => ({
  off: specializationRow(seeds, { ...LIFE3_WORLD, swapping: false }),
  on: specializationRow(seeds, LIFE3_WORLD),
})

export const SKILL_SPREADS: readonly [min: number, max: number][] = [
  [100, 100],
  [80, 120],
  [50, 150],
  [25, 175],
]

/** Experiment 4: experiment 3 at each spread of skills. */
export const skillSpreadExperiment = (seeds: readonly number[] = life2Seeds(32), spreads = SKILL_SPREADS) =>
  spreads.map(([skillMinPercent, skillMaxPercent]) => ({
    skillMinPercent,
    skillMaxPercent,
    off: specializationRow(seeds, { ...LIFE3_WORLD, skillMinPercent, skillMaxPercent, swapping: false }),
    on: specializationRow(seeds, { ...LIFE3_WORLD, skillMinPercent, skillMaxPercent }),
  }))

/** Experiment 5: experiment 3 with quotes off, with steady harvests and with windfalls. */
export function quotesExperiment(seeds: readonly number[] = life2Seeds(32), windfallKcal = 6_000) {
  const windfall = { ...LIFE3_WORLD, harvestKcal: windfallKcal }
  return {
    steady: {
      off: specializationRow(seeds, { ...LIFE3_WORLD, swapping: false }),
      noQuotes: specializationRow(seeds, { ...LIFE3_WORLD, quotes: false }),
      identical: seeds.map(
        (seed) =>
          hourlyChecksum({ ...LIFE3_WORLD, seed, quotes: false }) ===
          hourlyChecksum({ ...LIFE3_WORLD, seed, swapping: false }),
      ),
    },
    windfall: {
      off: specializationRow(seeds, { ...windfall, swapping: false }),
      noQuotes: specializationRow(seeds, { ...windfall, quotes: false }),
      quotes: specializationRow(seeds, windfall),
    },
  }
}

/** The mean and standard deviation of swap terms in the first and last quarter of each run's swaps, pooled. */
export function termsDispersion(runs: readonly LifeRunResult[]) {
  const spread = (values: readonly number[]) => {
    const average = mean(values)
    return { mean: average, sd: Math.sqrt(mean(values.map((value) => (value - average) ** 2))) }
  }
  const quarter = (run: LifeRunResult, last: boolean) => {
    const size = Math.floor(run.swapTerms.length / 4)
    return last ? run.swapTerms.slice(run.swapTerms.length - size) : run.swapTerms.slice(0, size)
  }
  return {
    first: spread(runs.flatMap((run) => quarter(run, false))),
    last: spread(runs.flatMap((run) => quarter(run, true))),
  }
}

// Life 4's experiments, on the canonical world: a band born equal, with practice.

/** Seed, overrides on Life 3's world and checksum, recorded from Life 3's code with `hourlyChecksum`. */
export const LIFE3_CHECKSUMS: readonly [seed: number, overrides: Partial<LifeConfig>, checksum: number][] = [
  [20260813, {}, 0xa1f0e585],
  [1, {}, 0x83206213],
  [20260813, { swapping: false }, 0x3fba4492],
]

/**
 * Experiment 1: on Life 3's world, with born skills from 50% to 150% and practice off, the step reproduces Life 3; and
 * practice fixed at 100% changes nothing.
 */
export const life3ReproducedExperiment = (seeds: readonly number[] = life2Seeds(2)) => ({
  checksums: LIFE3_CHECKSUMS.map(([seed, overrides, expected]) => ({
    seed,
    overrides,
    expected,
    actual: hourlyChecksum({ ...LIFE3_WORLD, ...overrides, seed }),
  })),
  unchanged: seeds.map(
    (seed) =>
      hourlyChecksum({ seed, practiceMinPercent: 100, practiceMaxPercent: 100 }) ===
      hourlyChecksum({ seed, practice: false }),
  ),
})

/** Experiment 2: equal bands with practice and without swaps, against the same bands without practice. */
export const practiceAloneExperiment = (seeds: readonly number[] = life2Seeds(32)) => ({
  withoutPractice: specializationRow(seeds, { practice: false, swapping: false }),
  practice: specializationRow(seeds, { swapping: false }),
})

/** Experiment 3: equal bands with practice, with and without swaps and telling terms; and swaps without practice. */
export const practiceAndExchangeExperiment = (seeds: readonly number[] = life2Seeds(32)) => ({
  withoutPractice: specializationRow(seeds, { practice: false }),
  noSwaps: specializationRow(seeds, { swapping: false }),
  swaps: specializationRow(seeds, {}),
  noQuotes: specializationRow(seeds, { quotes: false }),
  noQuotesIdentical: seeds.map(
    (seed) => hourlyChecksum({ seed, quotes: false }) === hourlyChecksum({ seed, swapping: false }),
  ),
})

/** Memory in days, with the half-way hours that keep two hours a day at 100%. */
export const PRACTICE_MEMORIES: readonly [days: number, halfHours: number][] = [
  [10, 20],
  [30, 60],
  [90, 180],
]

/** Experiment 4: experiment 3's band with swaps, at each length of memory. */
export const memoryExperiment = (seeds: readonly number[] = life2Seeds(32), memories = PRACTICE_MEMORIES) =>
  memories.map(([practiceDays, practiceHalfHours]) => ({
    practiceDays,
    practiceHalfHours,
    noSwaps: specializationRow(seeds, { practiceDays, practiceHalfHours, swapping: false }),
    swaps: specializationRow(seeds, { practiceDays, practiceHalfHours }),
  }))

export const PRACTICE_RANGES: readonly [min: number, max: number][] = [
  [80, 120],
  [50, 150],
  [25, 175],
]

/** Experiment 5: experiment 3's band with swaps, at each range of practice. */
export const practiceRangeExperiment = (seeds: readonly number[] = life2Seeds(32), ranges = PRACTICE_RANGES) =>
  ranges.map(([practiceMinPercent, practiceMaxPercent]) => ({
    practiceMinPercent,
    practiceMaxPercent,
    swaps: specializationRow(seeds, { practiceMinPercent, practiceMaxPercent }),
  }))

/** Experiment 6: Life 3's band, born from 50% to 150%, with practice off and on, with and without swaps. */
export const bornDifferencesExperiment = (seeds: readonly number[] = life2Seeds(32)) => ({
  noSwaps: specializationRow(seeds, { ...LIFE3_WORLD, swapping: false }),
  practiceNoSwaps: specializationRow(seeds, { ...LIFE3_WORLD, practice: true, swapping: false }),
  swaps: specializationRow(seeds, LIFE3_WORLD),
  practiceSwaps: specializationRow(seeds, { ...LIFE3_WORLD, practice: true }),
})
