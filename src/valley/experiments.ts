import { createValley, runValley } from './engine'
import { MINUTES_PER_DAY } from './forager'
import { ValleyChecker } from './invariants'
import { valleyTheory } from './theory'
import type { DaySummary, ValleyConfig } from './types'

// Life 8's experiments: each group keeps one fire at its flag, which warms every member and which members feed.

export const EXPERIMENT_DAYS = 400
/** Days 1–20 are a warm-up; measures use days 21 to 400. */
export const WARMUP_DAYS = 20

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
  swappedWood: number
  burnedWood: number
  sleepMinutes: number
  coldSleepMinutes: number
  /** Over the whole run. */
  totalSwaps: number
  firstSwapDay: number | null
  /** A fingerprint of every daily summary, so two runs can be compared day for day. */
  fingerprint: string
  groupsFounded: number
  dissolutions: number
  /** The living members of each group standing at the end. */
  standingGroupSizes: number[]
  /** For each group of two or more, its leading gatherer's share of the group's wood times the group's size. */
  groupLeads: number[]
  /** Over the measured days, by forager ID: wood put into fires, and the part of it that was spare. */
  fireGivenById: number[]
  fireSpareById: number[]
  /** Over the measured days: wood burned in groups' fires, and night hours fires were lit and out. */
  campfireBurnedWood: number
  fireLitHours: number
  fireDarkHours: number
  /**
   * For each group of two or more standing at the end: its leading giver's share of the wood its living members gave
   * over the measured days, times their number; and how many of them gave less than a quarter of an even share.
   */
  giveLeads: number[]
  lowGivers: number
  givingMembers: number
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
  const measuredFrom = WARMUP_DAYS * MINUTES_PER_DAY
  const fireSpareById = start.foragers.map(() => 0)
  const end = runValley(start, days * MINUTES_PER_DAY, {
    recordEvents: false,
    stopWhenAllDead: true,
    onMinute(state) {
      checker.assert(state)
      if (state.minute > measuredFrom)
        for (const feed of state.lastFeeds) fireSpareById[feed.foragerId]! += feed.spareWood
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
  const fireGivenById = byId()
  for (const day of measured) {
    add(forageSecondsById, day.forageSecondsById)
    add(gatherSecondsById, day.gatherSecondsById)
    add(walkSecondsById, day.walkSecondsById)
    add(gatheredWoodById, day.gatheredWoodById)
    add(fireGivenById, day.fireGivenById)
  }
  const sumOf = (pick: (day: DaySummary) => number) => measured.reduce((total, day) => total + pick(day), 0)
  const firstSwap = end.totals.firstSwapMinute
  const groupLeads = end.groups
    .filter((group) => group.members.length >= 2)
    .flatMap((group) => {
      const wood = group.members.map((id) => gatheredWoodById[id]!)
      const all = wood.reduce((a, b) => a + b, 0)
      return all ? [(Math.max(...wood) / all) * group.members.length] : []
    })
  const giveLeads: number[] = []
  let lowGivers = 0
  let givingMembers = 0
  for (const group of end.groups) {
    if (group.dissolvedMinute !== null) continue
    const living = group.members.filter((id) => end.foragers[id]!.alive && end.foragers[id]!.groupId === group.id)
    const gifts = living.map((id) => fireGivenById[id]!)
    const all = gifts.reduce((a, b) => a + b, 0)
    if (living.length < 2 || !all) continue
    giveLeads.push((Math.max(...gifts) / all) * living.length)
    givingMembers += living.length
    lowGivers += gifts.filter((gift) => gift < all / living.length / 4).length
  }
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
    swappedWood: sumOf((day) => day.swappedWood),
    burnedWood: sumOf((day) => day.burnedWood),
    sleepMinutes: sumOf((day) => day.sleepMinutes),
    coldSleepMinutes: sumOf((day) => day.coldSleepMinutes),
    totalSwaps: end.days.reduce((total, day) => total + day.swaps, 0),
    firstSwapDay: firstSwap === null ? null : firstSwap / MINUTES_PER_DAY,
    fingerprint: fingerprintOf(end.days),
    groupsFounded: end.groups.length,
    dissolutions: end.groups.filter((group) => group.dissolvedMinute !== null).length,
    standingGroupSizes: end.groups
      .filter((group) => group.dissolvedMinute === null)
      .map((group) => group.members.filter((id) => end.foragers[id]!.alive && end.foragers[id]!.groupId === group.id))
      .map((living) => living.length),
    groupLeads,
    fireGivenById,
    fireSpareById,
    campfireBurnedWood: sumOf((day) => day.campfireBurnedWood),
    fireLitHours: sumOf((day) => day.fireLitHours),
    fireDarkHours: sumOf((day) => day.fireDarkHours),
    giveLeads,
    lowGivers,
    givingMembers,
  }
  runCache.set(key, result)
  return result
}

const mean = (values: readonly number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
const total = (values: readonly number[]) => values.reduce((a, b) => a + b, 0)

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
  const litAndDark = sum((run) => run.fireLitHours + run.fireDarkHours)
  const given = sum((run) => total(run.fireGivenById))
  const givingMembers = sum((run) => run.givingMembers)
  return {
    runs,
    meanSurvivors: mean(runs.map((run) => run.survivors)),
    swappingRuns: runs.filter((run) => run.totalSwaps > 0).length,
    boughtShare: burned ? sum((run) => run.swappedWood) / burned : 0,
    coldShare: slept ? sum((run) => run.coldSleepMinutes) / slept : 0,
    workHoursPerDay: hoursPerDay(sum((run) => total(run.forageSecondsById) + total(run.gatherSecondsById))),
    forageHoursPerDay: hoursPerDay(sum((run) => total(run.forageSecondsById))),
    gatherHoursPerDay: hoursPerDay(sum((run) => total(run.gatherSecondsById))),
    walkHoursPerDay: hoursPerDay(sum((run) => total(run.walkSecondsById))),
    restHoursPerDay: hoursPerDay(sum((run) => run.restSeconds)),
    sleepHoursPerDay: hoursPerDay(sum((run) => run.sleepSeconds)),
    firstSwapDays: runs.map((run) => run.firstSwapDay),
    aliveByDay: Array.from({ length: Math.max(0, ...runs.map((run) => run.aliveByDay.length)) }, (_, day) =>
      mean(runs.map((run) => run.aliveByDay[day] ?? 0)),
    ),
    groupLead: mean(runs.flatMap((run) => run.groupLeads)),
    groupsFounded: mean(runs.map((run) => run.groupsFounded)),
    dissolutions: sum((run) => run.dissolutions),
    /** Groups standing at the end, on average. */
    meanGroups: mean(runs.map((run) => run.standingGroupSizes.length)),
    burnedWoodPerDay: livingDays ? burned / livingDays : 0,
    gatheredWoodPerDay: livingDays ? sum((run) => total(run.gatheredWoodById)) / livingDays : 0,
    giveLead: mean(runs.flatMap((run) => run.giveLeads)),
    lowGiverShare: givingMembers ? sum((run) => run.lowGivers) / givingMembers : 0,
    /** The correlation across each band's foragers between wood given to fires and wood gathered, over the runs. */
    giveGatherCorrelation: mean(
      runs.flatMap((run) => {
        const r = correlation(run.fireGivenById.map((gift, id) => [run.gatheredWoodById[id]!, gift]))
        return r === null ? [] : [r]
      }),
    ),
    /** The share of wood given to fires that was spare, rather than taken from a stock for a low fire. */
    spareGivenShare: given ? sum((run) => total(run.fireSpareById)) / given : 0,
    litShare: litAndDark ? sum((run) => run.fireLitHours) / litAndDark : 0,
  }
}

/** Every forager burning its own wood at its own hearth: the shared fire's counterfactual. */
export const OWN_FIRES: Partial<ValleyConfig> = { sharedFire: false }

/** Experiment 1: who feeds the fire, in scattered groups and in a band that starts as one group. */
export const whoFeedsExperiment = (seeds: readonly number[], days = EXPERIMENT_DAYS) => ({
  groups: valleyRow(seeds, {}, days),
  together: valleyRow(seeds, { scattered: false }, days),
})

export const FIRE_SIZE_ROWS = {
  canonical: {},
  larger: { campfireWoodPerHour: 2 },
  perMember: { campfirePerMember: true },
  ownFires: OWN_FIRES,
} as const satisfies Record<string, Partial<ValleyConfig>>

/** Experiment 2: how big a fire, from the canonical fire to one a member, beside every forager keeping its own. */
export function fireSizeExperiment(
  seeds: readonly number[],
  rows: readonly (keyof typeof FIRE_SIZE_ROWS)[] = Object.keys(FIRE_SIZE_ROWS) as (keyof typeof FIRE_SIZE_ROWS)[],
  days = EXPERIMENT_DAYS,
) {
  const theory = valleyTheory(createValley().config)
  return {
    rows: Object.fromEntries(rows.map((row) => [row, valleyRow(seeds, FIRE_SIZE_ROWS[row], days)])) as Partial<
      Record<keyof typeof FIRE_SIZE_ROWS, ReturnType<typeof valleyRow>>
    >,
    campfireNightWood: theory.campfireNightWood,
  }
}

/** Experiment 3: spare wood and exchange, with members that give only to a low fire. */
export const spareWoodExperiment = (seeds: readonly number[], days = EXPERIMENT_DAYS) => ({
  canonical: valleyRow(seeds, {}, days),
  lowOnly: valleyRow(seeds, { feedSpare: false }, days),
})

/** Experiment 4: groups, scattered and as one from the start, each beside every forager keeping its own fire. */
export const fireGroupsExperiment = (seeds: readonly number[], days = EXPERIMENT_DAYS, beside = true) => ({
  groups: valleyRow(seeds, {}, days),
  together: valleyRow(seeds, { scattered: false }, days),
  ownFires: beside ? valleyRow(seeds, OWN_FIRES, days) : null,
  ownFiresTogether: beside ? valleyRow(seeds, { ...OWN_FIRES, scattered: false }, days) : null,
})

export const BAND_SIZES = [8, 12, 16]

/** Experiment 5: how many the valley feeds with shared fires, beside every forager keeping its own unless told not to. */
export const fireCapacityExperiment = (
  seeds: readonly number[],
  sizes: readonly number[] = BAND_SIZES,
  days = EXPERIMENT_DAYS,
  beside = true,
) => ({
  canonical: sizes.map((bandSize) => ({ bandSize, row: valleyRow(seeds, { bandSize }, days) })),
  ownFires: beside
    ? sizes.map((bandSize) => ({ bandSize, row: valleyRow(seeds, { ...OWN_FIRES, bandSize }, days) }))
    : [],
})
