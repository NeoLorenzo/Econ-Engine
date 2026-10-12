import { specializationRow } from '../life/experiments'
import type { LifeConfig } from '../life/types'
import { LIFE3_BAND } from './config'
import { createValley, runValley } from './engine'
import { MINUTES_PER_DAY } from './forager'
import { ValleyChecker } from './invariants'
import { valleyTheory } from './theory'
import { spareWood } from './trade'
import type { DaySummary, ValleyConfig } from './types'

export const EXPERIMENT_DAYS = 400
/** Days 1–20 are a warm-up; measures use days 21 to 400. */
export const WARMUP_DAYS = 20
/** The days at whose end the spread of own terms is measured. */
export const TERMS_SPREAD_DAYS = [20, 100, 400]
export const LEAD_WINDOW_DAYS = 40
const HALF_DAY = 210

export const valleySeeds = (count: number) => [20260813, ...Array.from({ length: count - 1 }, (_, index) => index + 1)]

export interface ValleyRunResult {
  seed: number
  bandSize: number
  survivors: number
  survived: boolean
  alive: boolean[]
  aliveByDay: number[]
  /** Over the measured days, by forager ID: seconds picking, gathering and walking, and wood gathered. */
  forageSecondsById: number[]
  gatherSecondsById: number[]
  walkSecondsById: number[]
  gatheredWoodById: number[]
  /** Over the measured days, for the band. */
  livingForagerDays: number
  restSeconds: number
  sleepSeconds: number
  swaps: number
  quotes: number
  swappedWood: number
  burnedWood: number
  sleepMinutes: number
  coldSleepMinutes: number
  /** Over the whole run. */
  totalSwaps: number
  totalQuotes: number
  /** The most spare wood any forager held at the end of any minute. */
  maxSpareWood: number
  firstSwapDay: number | null
  termsSpread: Record<number, number | null>
  leadGatherers: number[]
  firstHalf: { gather: number[]; work: number[] }
  secondHalf: { gather: number[]; work: number[] }
  /** Each forager's born own terms, its foraging skill over its wood skill. */
  bornOwnTerms: number[]
  /** Rates at the end of the run, by forager ID. */
  forageRates: number[]
  woodRates: number[]
  /** The bushes' total stock at the end of each day. */
  bushStockByDay: number[]
  /** A fingerprint of every daily summary, so two runs can be compared day for day. */
  fingerprint: string
}

const runCache = new Map<string, ValleyRunResult>()

function fingerprintOf(days: readonly DaySummary[]) {
  let hash = 0x811c9dc5
  const text = JSON.stringify(days)
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return `${(hash >>> 0).toString(16)}:${text.length}`
}

/**
 * Runs one configuration headless for `days` days, checking every invariant after every minute, and ends early once
 * every forager is dead. Runs are deterministic, so experiments that share a configuration share its run.
 */
export function runValleyExperiment(overrides: Partial<ValleyConfig>, days = EXPERIMENT_DAYS): ValleyRunResult {
  const key = JSON.stringify([Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)), days])
  const cached = runCache.get(key)
  if (cached) return cached
  const start = createValley(overrides)
  const checker = new ValleyChecker(start)
  let maxSpareWood = 0
  const end = runValley(start, days * MINUTES_PER_DAY, {
    recordEvents: false,
    stopWhenAllDead: true,
    onMinute(state) {
      checker.assert(state)
      for (const forager of state.foragers) maxSpareWood = Math.max(maxSpareWood, spareWood(state.config, forager))
    },
  })
  const n = end.foragers.length
  const byId = () => Array.from({ length: n }, () => 0)
  const measured = end.days.slice(WARMUP_DAYS)
  const add = (target: number[], source: readonly number[]) => source.forEach((value, id) => (target[id]! += value))
  const forageSecondsById = byId()
  const gatherSecondsById = byId()
  const walkSecondsById = byId()
  const gatheredWoodById = byId()
  const firstHalf = { gather: byId(), work: byId() }
  const secondHalf = { gather: byId(), work: byId() }
  for (const day of measured) {
    add(forageSecondsById, day.forageSecondsById)
    add(gatherSecondsById, day.gatherSecondsById)
    add(walkSecondsById, day.walkSecondsById)
    add(gatheredWoodById, day.gatheredWoodById)
    const half = day.day < HALF_DAY ? firstHalf : secondHalf
    add(half.gather, day.gatherSecondsById)
    add(half.work, day.gatherSecondsById)
    add(half.work, day.forageSecondsById)
  }
  const leadGatherers: number[] = []
  for (let from = LEAD_WINDOW_DAYS; from + LEAD_WINDOW_DAYS <= end.days.length; from += LEAD_WINDOW_DAYS) {
    const wood = byId()
    for (const day of end.days.slice(from, from + LEAD_WINDOW_DAYS)) add(wood, day.gatheredWoodById)
    const most = Math.max(...wood)
    if (most > 0) leadGatherers.push(wood.indexOf(most))
  }
  const termsSpread: Record<number, number | null> = {}
  for (const dayNumber of TERMS_SPREAD_DAYS) {
    const day = end.days[dayNumber - 1]
    if (!day) continue
    const terms = day.forageRates.flatMap((g, id) => (day.endEnergyKcal[id]! > 0 ? [g / day.woodRates[id]!] : []))
    termsSpread[dayNumber] = terms.length ? Math.max(...terms) / Math.min(...terms) : null
  }
  const sumOf = (pick: (day: DaySummary) => number) => measured.reduce((total, day) => total + pick(day), 0)
  const firstSwap = end.totals.firstSwapMinute
  const result: ValleyRunResult = {
    seed: end.config.seed,
    bandSize: n,
    survivors: end.foragers.filter((forager) => forager.alive).length,
    survived: end.foragers.every((forager) => forager.alive),
    alive: end.foragers.map((forager) => forager.alive),
    aliveByDay: end.days.map((day) => day.alive),
    forageSecondsById,
    gatherSecondsById,
    walkSecondsById,
    gatheredWoodById,
    livingForagerDays: sumOf((day) => day.alive),
    restSeconds: sumOf((day) => day.seconds.rest),
    sleepSeconds: sumOf((day) => day.seconds.sleep),
    swaps: sumOf((day) => day.swaps),
    quotes: sumOf((day) => day.quotes),
    swappedWood: sumOf((day) => day.swappedWood),
    burnedWood: sumOf((day) => day.burnedWood),
    sleepMinutes: sumOf((day) => day.sleepMinutes),
    coldSleepMinutes: sumOf((day) => day.coldSleepMinutes),
    totalSwaps: end.days.reduce((total, day) => total + day.swaps, 0),
    totalQuotes: end.days.reduce((total, day) => total + day.quotes, 0),
    maxSpareWood,
    firstSwapDay: firstSwap === null ? null : firstSwap / MINUTES_PER_DAY,
    termsSpread,
    leadGatherers,
    firstHalf,
    secondHalf,
    bornOwnTerms: end.foragers.map((forager) => forager.foragingSkill / forager.woodSkill),
    forageRates: end.foragers.map((forager) => forager.forageRate),
    woodRates: end.foragers.map((forager) => forager.woodRate),
    bushStockByDay: end.days.map((day) => day.bushStockKcal),
    fingerprint: fingerprintOf(end.days),
  }
  runCache.set(key, result)
  return result
}

const mean = (values: readonly number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
const total = (values: readonly number[]) => values.reduce((a, b) => a + b, 0)

/** The share of a run's wood gathered by the two foragers that gathered the most. */
export function topTwo(run: { gatheredWoodById: readonly number[] }) {
  const gathered = [...run.gatheredWoodById].sort((a, b) => b - a)
  const all = total(gathered)
  return all ? (gathered[0]! + (gathered[1] ?? 0)) / all : 0
}

/** Each forager's share of its working seconds spent gathering, or null if it did not work. */
export function woodShares(run: ValleyRunResult) {
  return run.forageSecondsById.map((forage, id) => {
    const work = forage + run.gatherSecondsById[id]!
    return work ? run.gatherSecondsById[id]! / work : null
  })
}

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

/** The correlation across a band between wood shares over days 21–210 and over days 211–400. */
export function persistence(run: ValleyRunResult) {
  const share = (half: ValleyRunResult['firstHalf'], id: number) => half.gather[id]! / half.work[id]!
  const pairs = run.firstHalf.work.flatMap((work, id): [number, number][] =>
    work && run.secondHalf.work[id] ? [[share(run.firstHalf, id), share(run.secondHalf, id)]] : [],
  )
  return correlation(pairs)
}

/** One configuration's runs across seeds, summarized by the measures of the specification. */
export const valleyRow = (seeds: readonly number[], overrides: Partial<ValleyConfig>, days = EXPERIMENT_DAYS) =>
  summarizeRuns(seeds.map((seed) => runValleyExperiment({ ...overrides, seed }, days)))

/** The measures of a set of runs of one configuration. */
export function summarizeRuns(runs: ValleyRunResult[]) {
  const sum = (pick: (run: ValleyRunResult) => number) => total(runs.map(pick))
  const livingDays = sum((run) => run.livingForagerDays)
  const hoursPerDay = (seconds: number) => (livingDays ? seconds / 3_600 / livingDays : 0)
  const burned = sum((run) => run.burnedWood)
  const slept = sum((run) => run.sleepMinutes)
  const persistences = runs.map(persistence).filter((value) => value !== null)
  const spreads = (day: number) => runs.flatMap((run) => (run.termsSpread[day] == null ? [] : [run.termsSpread[day]]))
  return {
    runs,
    meanSurvivors: mean(runs.map((run) => run.survivors)),
    swappingRuns: runs.filter((run) => run.totalSwaps > 0).length,
    concentration: mean(runs.map(topTwo)),
    boughtShare: burned ? sum((run) => run.swappedWood) / burned : 0,
    coldShare: slept ? sum((run) => run.coldSleepMinutes) / slept : 0,
    workHoursPerDay: hoursPerDay(sum((run) => total(run.forageSecondsById) + total(run.gatherSecondsById))),
    forageHoursPerDay: hoursPerDay(sum((run) => total(run.forageSecondsById))),
    gatherHoursPerDay: hoursPerDay(sum((run) => total(run.gatherSecondsById))),
    walkHoursPerDay: hoursPerDay(sum((run) => total(run.walkSecondsById))),
    restHoursPerDay: hoursPerDay(sum((run) => run.restSeconds)),
    sleepHoursPerDay: hoursPerDay(sum((run) => run.sleepSeconds)),
    swapsPerRun: mean(runs.map((run) => run.totalSwaps)),
    quotesPerRun: mean(runs.map((run) => run.totalQuotes)),
    firstSwapDays: runs.map((run) => run.firstSwapDay),
    termsSpread: Object.fromEntries(
      TERMS_SPREAD_DAYS.map((day) => [day, spreads(day).length ? mean(spreads(day)) : null]),
    ) as Record<number, number | null>,
    leadGatherers: mean(runs.map((run) => new Set(run.leadGatherers).size)),
    persistence: persistences.length ? mean(persistences) : null,
    aliveByDay: Array.from({ length: Math.max(0, ...runs.map((run) => run.aliveByDay.length)) }, (_, day) =>
      mean(runs.map((run) => run.aliveByDay[day] ?? 0)),
    ),
  }
}

/** Life 4's runs on the same seeds, from the hourly core, for comparison. */
export const life4Row = (seeds: readonly number[], overrides: Partial<LifeConfig> = {}) =>
  specializationRow(seeds, overrides)

/** Experiment 1: time at real scale, without swaps, beside Life 4. */
export function timeAtRealScaleExperiment(seeds: readonly number[], days = EXPERIMENT_DAYS) {
  const valley = valleyRow(seeds, { swapping: false }, days)
  const theory = valleyTheory(createValley().config)
  // The prediction, with the measured walking and gathering and the band's mean foraging rate at the end.
  const rates = valley.runs.flatMap((run) => run.forageRates)
  const predictedForageHours = theory.forageHoursPerDay(mean(rates), valley.gatherHoursPerDay, valley.walkHoursPerDay)
  return {
    valley,
    life4: life4Row(seeds, { swapping: false }),
    predictedWorkHours: predictedForageHours + valley.gatherHoursPerDay,
  }
}

/** Experiment 2: with no loads, no surplus and so no exchange, in a band born equal and in Life 3's band. */
export const noSurplusExperiment = (seeds: readonly number[], days = EXPERIMENT_DAYS) => ({
  equal: valleyRow(seeds, { woodLoad: 0 }, days),
  born: valleyRow(seeds, { ...LIFE3_BAND, woodLoad: 0 }, days),
})

export const LOADS = [0, 20, 24, 26, 28, 30, 36, 40]

/** Experiment 3: the two bands at each load, with swapping on: the band born equal and Life 3's band born unequal. */
export const loadsExperiment = (
  seeds: readonly number[],
  loads: readonly number[] = LOADS,
  bands: readonly ('equal' | 'born')[] = ['equal', 'born'],
  days = EXPERIMENT_DAYS,
) =>
  loads.map((woodLoad) => ({
    woodLoad,
    equal: bands.includes('equal') ? valleyRow(seeds, { woodLoad }, days) : null,
    born: bands.includes('born') ? valleyRow(seeds, { ...LIFE3_BAND, woodLoad }, days) : null,
  }))

/** Experiment 4: Life 4's practice and exchange in the valley, with its counterfactuals, beside Life 4. */
export function practiceAndExchangeExperiment(seeds: readonly number[]) {
  const noSwaps = valleyRow(seeds, { swapping: false })
  const noQuotes = valleyRow(seeds, { quotes: false })
  return {
    swaps: valleyRow(seeds, {}),
    noSwaps,
    noQuotes,
    noQuotesIdentical: noQuotes.runs.map((run, index) => run.fingerprint === noSwaps.runs[index]!.fingerprint),
    noPractice: valleyRow(seeds, { practice: false }),
    life4: { swaps: life4Row(seeds), noSwaps: life4Row(seeds, { swapping: false }) },
  }
}

export const BAND_SIZES = [8, 12, 16, 24, 32]
export const LIFE4_BAND_SIZES = [8, 12, 16]

/** Experiment 5: how many the valley feeds, beside Life 4's land. */
export function capacityExperiment(
  seeds: readonly number[],
  sizes: readonly number[] = BAND_SIZES,
  life4Sizes: readonly number[] = LIFE4_BAND_SIZES,
) {
  const theory = valleyTheory(createValley().config)
  return {
    valley: sizes.map((bandSize) => ({ bandSize, row: valleyRow(seeds, { bandSize }) })),
    life4: life4Sizes.map((bandSize) => ({ bandSize, row: life4Row(seeds, { bandSize }) })),
    /** K for a forager at 100% that gathers a night's wood a day and walks a tenth of an hour. */
    capacity: theory.carryingCapacity(theory.dailyNeedKcal(1_200, theory.gatherHoursPerDay(18), 0.1)),
  }
}
