import { LIFE0_WORLD, LIFE1_WORLD, LIFE_DEFAULT_CONFIG } from './config'
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
}

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

const ACTIONS: (keyof ActionHours)[] = ['sleep', 'rest', 'forage', 'walk']

function meanHoursPerForager(days: readonly DaySummary[]): ActionHours {
  // On a day with no death, every forager alive at its end acted in all 24 of its hours.
  const counted = days.filter((day) => day.deaths === 0 && day.alive > 0)
  const foragerDays = counted.reduce((sum, day) => sum + day.alive, 0)
  const mean: ActionHours = { sleep: 0, rest: 0, forage: 0, walk: 0 }
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
  for (let hour = 0; hour < days * 24 && state.foragers.some((forager) => forager.alive); hour += 1) {
    const before = state
    state = stepLife(state)
    assertLifeInvariants(state)
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
  const { bandSize } = LIFE_DEFAULT_CONFIG
  return {
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
  const runs = seeds.map((seed) => runLife({ seed, harvestKcal, shelfLifeHours, ...uniformBand(strategy) }))
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
      const runs = seeds.map((seed) => runLife({ seed, harvestKcal, shelfLifeHours }))
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
