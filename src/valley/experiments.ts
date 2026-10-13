import { specializationRow } from '../life/experiments'
import type { LifeConfig } from '../life/types'
import { LIFE3_BAND, LIFE5_VALLEY, LIFE6_VALLEY } from './config'
import { createValley, runValley } from './engine'
import { MINUTES_PER_DAY } from './forager'
import { ValleyChecker } from './invariants'
import { placeCount } from './social'
import { valleyTheory } from './theory'
import { spareWood } from './trade'
import type { ActionReason, DaySummary, ValleyConfig } from './types'

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
  /** The first minute at whose end every living forager was in a group, if any. */
  allGroupedMinute: number | null
  groupsFounded: number
  dissolutions: number
  /** The living members of each group standing at the end. */
  standingGroupSizes: number[]
  /** For each group of two or more, its leading gatherer's share of the group's wood times the group's size. */
  groupLeads: number[]
  /** The day each forager had first seen every place, or null. */
  allSeenDays: (number | null)[]
  /** Over the measured days, the band's seconds walked for each reason, and walked with a load. */
  walkSecondsByReason: Partial<Record<ActionReason, number>>
  loadedWalkSeconds: number
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
  let allGroupedMinute: number | null = null
  const walkSecondsByReason: Partial<Record<ActionReason, number>> = {}
  const measuredFrom = WARMUP_DAYS * MINUTES_PER_DAY
  const end = runValley(start, days * MINUTES_PER_DAY, {
    recordEvents: false,
    stopWhenAllDead: true,
    onMinute(state) {
      checker.assert(state)
      if (state.minute > measuredFrom)
        for (const event of state.lastEvents)
          if (event.walkSeconds)
            walkSecondsByReason[event.reason] = (walkSecondsByReason[event.reason] ?? 0) + event.walkSeconds
      for (const forager of state.foragers) maxSpareWood = Math.max(maxSpareWood, spareWood(state.config, forager))
      if (
        allGroupedMinute === null &&
        state.config.groups &&
        state.foragers.every((forager) => !forager.alive || forager.groupId !== null)
      )
        allGroupedMinute = state.minute - 1
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
  // Without groups, the whole band counts as one group.
  const memberships = end.config.groups ? end.groups.map((group) => group.members) : [end.foragers.map((f) => f.id)]
  const groupLeads = memberships
    .filter((members) => members.length >= 2)
    .flatMap((members) => {
      const wood = members.map((id) => gatheredWoodById[id]!)
      const all = wood.reduce((a, b) => a + b, 0)
      return all ? [(Math.max(...wood) / all) * members.length] : []
    })
  const places = placeCount(end.config)
  const allSeenDays = end.foragers.map((forager) => {
    const day = end.days.findIndex((summary) => summary.placesSeenById[forager.id] === places)
    return day < 0 ? null : day
  })
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
    allGroupedMinute,
    groupsFounded: end.groups.length,
    dissolutions: end.groups.filter((group) => group.dissolvedMinute !== null).length,
    standingGroupSizes: end.groups
      .filter((group) => group.dissolvedMinute === null)
      .map((group) => group.members.filter((id) => end.foragers[id]!.alive && end.foragers[id]!.groupId === group.id))
      .map((living) => living.length),
    groupLeads,
    allSeenDays,
    walkSecondsByReason,
    loadedWalkSeconds: sumOf((day) => day.loadedWalkSecondsById.reduce((a, b) => a + b, 0)),
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
    groupLead: mean(runs.flatMap((run) => run.groupLeads)),
    groupsFounded: mean(runs.map((run) => run.groupsFounded)),
    dissolutions: sum((run) => run.dissolutions),
    /** Groups standing at the end, on average. */
    meanGroups: mean(runs.map((run) => run.standingGroupSizes.length)),
    loadedWalkHoursPerDay: hoursPerDay(sum((run) => run.loadedWalkSeconds)),
    walkHoursByReason: Object.fromEntries(
      [...new Set(runs.flatMap((run) => Object.keys(run.walkSecondsByReason)))].map((reason) => [
        reason,
        hoursPerDay(sum((run) => run.walkSecondsByReason[reason as ActionReason] ?? 0)),
      ]),
    ) as Partial<Record<ActionReason, number>>,
  }
}

/** Life 5's valley with `overrides`: the band around the camp that knows the valley, rests and swaps with anyone. */
export const life5 = (overrides: Partial<ValleyConfig> = {}): Partial<ValleyConfig> => ({
  ...LIFE5_VALLEY,
  ...overrides,
})

/** Life 4's runs on the same seeds, from the hourly core, for comparison. */
export const life4Row = (seeds: readonly number[], overrides: Partial<LifeConfig> = {}) =>
  specializationRow(seeds, overrides)

/** Life 5's experiment 1: time at real scale, without swaps, beside Life 4. */
export function timeAtRealScaleExperiment(seeds: readonly number[], days = EXPERIMENT_DAYS) {
  const valley = valleyRow(seeds, life5({ swapping: false }), days)
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

/** Life 5's experiment 2: with no loads, no surplus and so no exchange, in a band born equal and in Life 3's band. */
export const noSurplusExperiment = (seeds: readonly number[], days = EXPERIMENT_DAYS) => ({
  equal: valleyRow(seeds, life5({ woodLoad: 0 }), days),
  born: valleyRow(seeds, life5({ ...LIFE3_BAND, woodLoad: 0 }), days),
})

export const LOADS = [0, 20, 24, 26, 28, 30, 36, 40]

/** Life 5's experiment 3: the two bands at each load, with swapping on: born equal, and Life 3's band born unequal. */
export const loadsExperiment = (
  seeds: readonly number[],
  loads: readonly number[] = LOADS,
  bands: readonly ('equal' | 'born')[] = ['equal', 'born'],
  days = EXPERIMENT_DAYS,
) =>
  loads.map((woodLoad) => ({
    woodLoad,
    equal: bands.includes('equal') ? valleyRow(seeds, life5({ woodLoad }), days) : null,
    born: bands.includes('born') ? valleyRow(seeds, life5({ ...LIFE3_BAND, woodLoad }), days) : null,
  }))

/** Life 5's experiment 4: Life 4's practice and exchange in the valley, with its counterfactuals, beside Life 4. */
export function practiceAndExchangeExperiment(seeds: readonly number[]) {
  const noSwaps = valleyRow(seeds, life5({ swapping: false }))
  const noQuotes = valleyRow(seeds, life5({ quotes: false }))
  return {
    swaps: valleyRow(seeds, life5()),
    noSwaps,
    noQuotes,
    noQuotesIdentical: noQuotes.runs.map((run, index) => run.fingerprint === noSwaps.runs[index]!.fingerprint),
    noPractice: valleyRow(seeds, life5({ practice: false })),
    life4: { swaps: life4Row(seeds), noSwaps: life4Row(seeds, { swapping: false }) },
  }
}

export const BAND_SIZES = [8, 12, 16, 24, 32]
export const LIFE4_BAND_SIZES = [8, 12, 16]

/** Life 5's experiment 5: how many the valley feeds, beside Life 4's land. */
export function capacityExperiment(
  seeds: readonly number[],
  sizes: readonly number[] = BAND_SIZES,
  life4Sizes: readonly number[] = LIFE4_BAND_SIZES,
) {
  const theory = valleyTheory(createValley().config)
  return {
    valley: sizes.map((bandSize) => ({ bandSize, row: valleyRow(seeds, life5({ bandSize })) })),
    life4: life4Sizes.map((bandSize) => ({ bandSize, row: life4Row(seeds, { bandSize }) })),
    /** K for a forager at 100% that gathers a night's wood a day and walks a tenth of an hour. */
    capacity: theory.carryingCapacity(theory.dailyNeedKcal(1_200, theory.gatherHoursPerDay(18), 0.1)),
  }
}

// Life 6's experiments, in Life 6's valley: scattered foragers who know only what they have seen, explore, and form
// groups when they meet.

/** Life 6's valley with `overrides`: short sight, sweeping places, and loads carried at no cost. */
export const life6 = (overrides: Partial<ValleyConfig> = {}): Partial<ValleyConfig> => ({
  ...LIFE6_VALLEY,
  ...overrides,
})

/** How many runs ended with 1, 2, 3, … groups standing. */
export function groupCountsOf(runs: readonly ValleyRunResult[]) {
  const counts = runs.map((run) => run.standingGroupSizes.length)
  return Object.fromEntries(
    [...new Set(counts)].sort((a, b) => a - b).map((count) => [count, counts.filter((c) => c === count).length]),
  ) as Record<number, number>
}

const allGroupedDaysOf = (runs: readonly ValleyRunResult[]) =>
  runs.map((run) => (run.allGroupedMinute === null ? null : (run.allGroupedMinute + 1) / MINUTES_PER_DAY))

/** Life 6's experiment 1: groups from a scattered start. */
export function groupsFromScatteredExperiment(seeds: readonly number[], days = EXPERIMENT_DAYS) {
  const row = valleyRow(seeds, life6(), days)
  return {
    row,
    allGroupedDays: allGroupedDaysOf(row.runs),
    groupCounts: groupCountsOf(row.runs),
    mostGroups: valleyTheory(createValley().config).mostGroups(createValley().config.bandSize),
  }
}

/** Life 6's experiment 2: knowing and exploring, with exploring off and with places worth exploring after 72 hours. */
export function knowingExperiment(seeds: readonly number[], days = EXPERIMENT_DAYS) {
  const explore = valleyRow(seeds, life6(), days)
  const theory = valleyTheory(createValley(life6()).config)
  const rates = explore.runs.flatMap((run) => run.forageRates)
  const predictedForageHours = theory.forageHoursPerDay(mean(rates), explore.gatherHoursPerDay, explore.walkHoursPerDay)
  return {
    explore,
    noExplore: valleyRow(seeds, life6({ explore: false }), days),
    slowExplore: valleyRow(seeds, life6({ exploreAfterHours: 72 }), days),
    predictedWorkHours: predictedForageHours + explore.gatherHoursPerDay,
    sweepHours: theory.sweepHours,
    sweepCostKcal: theory.sweepCostKcal,
  }
}

export const EXCHANGE_ROWS = ['groups', 'together', 'strangers', 'life5'] as const

/**
 * Life 6's experiment 3: groups and exchange, against one group from the start, strangers who may swap with anyone,
 * and Life 5. Only the rows asked for are run.
 */
export function groupsAndExchangeExperiment(
  seeds: readonly number[],
  rows: readonly (typeof EXCHANGE_ROWS)[number][] = EXCHANGE_ROWS,
  days = EXPERIMENT_DAYS,
) {
  const overrides = {
    groups: life6(),
    together: life6({ scattered: false }),
    strangers: life6({ groups: false }),
    life5: life5(),
  }
  return Object.fromEntries(rows.map((row) => [row, valleyRow(seeds, overrides[row], days)])) as Partial<
    Record<(typeof EXCHANGE_ROWS)[number], ReturnType<typeof valleyRow>>
  >
}

export const LIFE6_BAND_SIZES = [8, 12, 16]

/** Life 6's experiment 5: how many the valley feeds with groups and exploring, beside Life 5 unless told not to. */
export const groupsCapacityExperiment = (
  seeds: readonly number[],
  sizes: readonly number[] = LIFE6_BAND_SIZES,
  days = EXPERIMENT_DAYS,
  beside = true,
) => ({
  groups: sizes.map((bandSize) => ({ bandSize, row: valleyRow(seeds, life6({ bandSize }), days) })),
  life5: beside ? sizes.map((bandSize) => ({ bandSize, row: valleyRow(seeds, life5({ bandSize }), days) })) : [],
})

// Life 7's experiments, in the canonical valley: foragers who see across the valley, check the sites they know, walk
// more slowly under a load, and take a full load home.

export const SIGHTS_CM = [2_500, 10_000, 25_000]

/** Life 7's experiment 1: seeing far, at the canonical sight and shorter ones, beside Life 6. */
export function seeingFarExperiment(
  seeds: readonly number[],
  days = EXPERIMENT_DAYS,
  sights: readonly number[] = SIGHTS_CM,
) {
  const canonical = valleyRow(seeds, {}, days)
  const config = createValley().config
  return {
    canonical,
    allGroupedDays: allGroupedDaysOf(canonical.runs),
    groupCounts: groupCountsOf(canonical.runs),
    sights: sights.map((sightRadiusCm) => {
      const row = valleyRow(seeds, { sightRadiusCm }, days)
      return { sightRadiusCm, row, groupCounts: groupCountsOf(row.runs) }
    }),
    life6: valleyRow(seeds, life6(), days),
    mostGroups: valleyTheory(config).mostGroups(config.bandSize),
  }
}

/** Life 7's experiment 2: walking and checking, with exploring off, sites checked every 72 hours, and Life 6. */
export function walkingExperiment(seeds: readonly number[], days = EXPERIMENT_DAYS, beside = true) {
  const canonical = valleyRow(seeds, {}, days)
  const theory = valleyTheory(createValley().config)
  const rates = canonical.runs.flatMap((run) => run.forageRates)
  const predictedForageHours = theory.forageHoursPerDay(
    mean(rates),
    canonical.gatherHoursPerDay,
    canonical.walkHoursPerDay,
  )
  return {
    canonical,
    noExplore: valleyRow(seeds, { explore: false }, days),
    slowChecks: beside ? valleyRow(seeds, { exploreAfterHours: 72 }, days) : null,
    life6: beside ? valleyRow(seeds, life6(), days) : null,
    predictedWorkHours: predictedForageHours + canonical.gatherHoursPerDay,
    shortestCheckTourHours: theory.shortestCheckTourHours,
  }
}

export const CARRYING_ROWS = {
  canonical: {},
  noCarry: { carryCost: false },
  noHome: { loadHome: false },
  neither: { carryCost: false, loadHome: false },
  load20: { woodLoad: 20 },
  load20NoHome: { woodLoad: 20, loadHome: false },
  load40: { woodLoad: 40 },
  load40NoHome: { woodLoad: 40, loadHome: false },
} as const satisfies Record<string, Partial<ValleyConfig>>

/** Life 7's experiment 3: carrying, with the carrying cost and taking loads home each off, and other loads. */
export function carryingExperiment(
  seeds: readonly number[],
  rows: readonly (keyof typeof CARRYING_ROWS)[] = Object.keys(CARRYING_ROWS) as (keyof typeof CARRYING_ROWS)[],
  days = EXPERIMENT_DAYS,
) {
  const theory = valleyTheory(createValley().config)
  return {
    rows: Object.fromEntries(rows.map((row) => [row, valleyRow(seeds, CARRYING_ROWS[row], days)])) as Partial<
      Record<keyof typeof CARRYING_ROWS, ReturnType<typeof valleyRow>>
    >,
    speedWithLoad: theory.speedForLoad(createValley().config.woodLoad),
    /** What carrying a full load 150 m home costs beyond walking it unloaded. */
    loadHomeCostKcal: theory.carryCostKcal(15_000, createValley().config.woodLoad),
  }
}

/** Life 7's experiment 4: groups and exchange, against the band as one group from the start. */
export const sightExchangeExperiment = (seeds: readonly number[], days = EXPERIMENT_DAYS) => ({
  groups: valleyRow(seeds, {}, days),
  together: valleyRow(seeds, { scattered: false }, days),
})

export const LIFE7_BAND_SIZES = [8, 12, 16]

/** Life 7's experiment 6: how many the valley feeds, beside Life 6 unless told not to. */
export const sightCapacityExperiment = (
  seeds: readonly number[],
  sizes: readonly number[] = LIFE7_BAND_SIZES,
  days = EXPERIMENT_DAYS,
  beside = true,
) => ({
  canonical: sizes.map((bandSize) => ({ bandSize, row: valleyRow(seeds, { bandSize }, days) })),
  life6: beside ? sizes.map((bandSize) => ({ bandSize, row: valleyRow(seeds, life6({ bandSize }), days) })) : [],
})
