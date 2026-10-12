import type { FoodLot } from '../life/types'

export type { FoodLot }

/**
 * Life 5's configuration. Lengths are whole centimetres, food and energy whole kilocalories, and wood whole kilograms,
 * so every balance is exact. Rates and costs stay per hour; a forager pays or takes them second by second.
 */
export interface ValleyConfig {
  seed: number
  /** The valley is a square this many centimetres wide, with the camp at its centre. */
  valleySizeCm: number
  thicketCount: number
  bushesPerThicket: number
  thicketRadiusCm: number
  /** Bushes in a thicket stand at least this far apart. */
  bushSpacingCm: number
  bushCapacityKcal: number
  initialBushKcal: number
  bushRegrowthKcalPerDay: number
  standCount: number
  treesPerStand: number
  standRadiusCm: number
  treeSpacingCm: number
  /** A tree's deadwood, in kilograms. The tree itself stays standing. */
  treeCapacityWood: number
  initialTreeWood: number
  treeRegrowthWoodPerDay: number
  /** Site centres lie at least this far apart, this far from the valley's edges and this far from the camp. */
  siteSpacingCm: number
  siteMarginCm: number
  campClearingCm: number
  /** Hearths lie on a square spiral around the camp's fire, this far apart. */
  hearthSpacingCm: number
  walkCmPerSecond: number
  /** A forager works a plant only within this distance of it. */
  reachCm: number
  /** A forager sees every bush and tree within this distance. */
  perceptionRadiusCm: number
  /** Foragers swap and tell terms within this distance of each other. */
  talkRadiusCm: number
  /** Daylight runs from `dawnHour` up to, but not including, `duskHour`. */
  dawnHour: number
  duskHour: number
  /** Berries picked in an hour at a skill of 100%. */
  forageKcalPerHour: number
  /** Deadwood gathered in an hour at a skill of 100%. */
  woodPerHour: number
  sleepKcalPerHour: number
  restKcalPerHour: number
  /** The cost of picking and of gathering. */
  forageCostKcalPerHour: number
  travelKcalPerHour: number
  reserveMaxKcal: number
  initialReserveKcal: number
  hungryBelowKcal: number
  satiatedAtKcal: number
  /** The number of foragers at the start. There are no births. */
  bandSize: number
  /** Carried food spoils this many hours after it was picked; 0 means it keeps. */
  shelfLifeHours: number
  /** Wood burned for an hour of warm sleep. */
  fireWoodPerHour: number
  /** An hour of sleep without a fire costs this instead of `sleepKcalPerHour`. */
  coldSleepKcalPerHour: number
  /** A forager short of wood gathers until it holds this many nights' wood. */
  woodStockNights: number
  /** A forager that has gathered wood since it left its hearth keeps gathering until it has gathered this much. */
  woodLoad: number
  /** Born skills are drawn independently from this range, in percent. */
  skillMinPercent: number
  skillMaxPercent: number
  /** Foragers may swap wood for food. */
  swapping: boolean
  /** Two foragers that could both gain from a swap tell each other the terms, even if they cannot complete it. */
  quotes: boolean
  termsMemoryHours: number
  /** Skill grows with practice and fades without it. */
  practice: boolean
  practiceDays: number
  practiceHalfHours: number
  practiceMinPercent: number
  practiceMaxPercent: number
  startPracticeHoursPerDay: number
}

export interface Point {
  x: number
  y: number
}

/** Plants of one kind, by ID: positions in centimetres and the site each belongs to. */
export interface Plants {
  count: number
  x: Int32Array
  y: Int32Array
  site: Int32Array
}

/** Every plant of one kind, bucketed into square cells `cellCm` wide. */
export interface PlantIndex {
  cellCm: number
  /** Cells along each side. */
  cells: number
  /** The plant IDs in each cell, row by row, in ID order. */
  buckets: Int32Array[]
}

/** Where everything stands. It never changes during a run, so every state shares it. */
export interface ValleyLayout {
  camp: Point
  thickets: Point[]
  stands: Point[]
  bushes: Plants
  trees: Plants
  /** Indexed by forager ID. */
  hearths: Point[]
  bushIndex: PlantIndex
  treeIndex: PlantIndex
}

export type Good = 'food' | 'wood'

export interface HeardTerms {
  kcalPerWood: number
  minute: number
}

export interface TaskSeconds {
  forage: number
  gather: number
}

/** Seconds at each task on each of a forager's last `practiceDays` days, oldest first. */
export interface PracticeLog {
  forage: number[]
  gather: number[]
}

export interface TradeTrip {
  goalSpareWood: number
}

export interface SwapTotals {
  woodSold: number
  woodBought: number
  kcalReceived: number
  kcalPaid: number
}

/** What a forager remembers of every plant of one kind: the stock it last saw and the minute it saw it. */
export interface PlantMemory {
  stock: Int32Array
  seen: Int32Array
}

export interface Forager {
  id: number
  /** Its position in whole centimetres. */
  x: number
  y: number
  hearth: Point
  energyKcal: number
  hungry: boolean
  alive: boolean
  deathMinute: number | null
  /** Oldest first. */
  carried: FoodLot[]
  wood: number
  shortOfWood: boolean
  /** Wood gathered since it last stood at its hearth. */
  tripWood: number
  targetBushId: number | null
  targetTreeId: number | null
  bushMemory: PlantMemory
  treeMemory: PlantMemory
  /** Born skills, in percent. */
  foragingSkill: number
  woodSkill: number
  /** Hourly rates for the day. It knows them. */
  forageRate: number
  woodRate: number
  practiceLog: PracticeLog
  secondsToday: TaskSeconds
  /** Every second entered in its log since minute 0. */
  loggedSeconds: TaskSeconds
  /** Every second it has spent picking and gathering. */
  secondsWorked: TaskSeconds
  heardTerms: HeardTerms | null
  trip: TradeTrip | null
  /** Remainders in 3,600ths of a unit: of picking, of gathering, and of energy owed. */
  pickRemainder: number
  gatherRemainder: number
  costRemainder: number
  /** The hour of its last fire decision, and whether that hour is warm. */
  fireHour: number
  warm: boolean
  swapTotals: SwapTotals
}

export type ForagerAction = 'sleep' | 'rest' | 'walk' | 'forage' | 'gather'

export type ActionReason =
  | 'going home'
  | 'night'
  | 'filling a load'
  | 'satiated'
  | 'waiting to swap'
  | 'too late to set out'
  | 'waiting for regrowth'
  | 'foraging'
  | 'gathering'
  | 'seeking food'
  | 'seeking wood'

/** One forager's minute. Its seconds add up to 60. */
export interface ActionEvent {
  kind: 'action'
  foragerId: number
  minute: number
  /** Forage or gather if it worked at all; otherwise walk if it walked; otherwise rest or sleep. */
  action: ForagerAction
  reason: ActionReason
  from: Point
  position: Point
  /** The good it worked for or walked towards, and whether to swap it. */
  workedFor: Good | null
  forTrade: boolean
  /** The plant it walked towards or worked, if any: a bush for food, a tree for wood. */
  targetId: number | null
  /** The plant it worked this minute, if any. */
  plantId: number | null
  walkSeconds: number
  workSeconds: number
  standSeconds: number
  sleepSeconds: number
  gatheredKcal: number
  gatheredWood: number
  spoiledKcal: number
  eatenKcal: number
  spentKcal: number
  energyAfterKcal: number
  carriedAfterKcal: number
  woodAfter: number
  tripWoodAfter: number
  burnedWood: number
  /** Asleep in a cold hour this minute. */
  sleptCold: boolean
}

export interface DeathEvent {
  kind: 'death'
  foragerId: number
  minute: number
  cause: 'starvation'
}

export interface SwapEvent {
  kind: 'swap'
  minute: number
  /** Where the forager whose turn it was stood. */
  position: Point
  sellerId: number
  buyerId: number
  wood: number
  kcal: number
  kcalPerWood: number
  sellerWoodBefore: number
  sellerRoomKcal: number
  buyerWoodBefore: number
  buyerCarriedKcal: number
}

export interface QuoteEvent {
  kind: 'quote'
  minute: number
  sellerId: number
  buyerId: number
  kcalPerWood: number
}

/** A forager's practice at midnight: yesterday's seconds entered in its log, and its rates for the new day. */
export interface PracticeEvent {
  kind: 'practice'
  minute: number
  foragerId: number
  added: TaskSeconds
  foragePercent: number
  woodPercent: number
  forageRateBefore: number
  woodRateBefore: number
  forageRate: number
  woodRate: number
}

export type ValleyEvent = ActionEvent | DeathEvent | SwapEvent | QuoteEvent | PracticeEvent

/** Seconds spent on each kind of time, summed over the band. */
export interface ActionSeconds {
  sleep: number
  rest: number
  walk: number
  forage: number
  gather: number
}

/** One day of the band. Time is in seconds, summed over every forager that acted. */
export interface DaySummary {
  day: number
  seconds: ActionSeconds
  gatheredKcal: number
  spentKcal: number
  alive: number
  deaths: number
  bushStockKcal: number
  treeWood: number
  endEnergyKcal: number[]
  spoiledKcal: number
  carriedKcal: number
  gatheredWood: number
  burnedWood: number
  /** Minutes asleep, and minutes asleep in a cold hour. */
  sleepMinutes: number
  coldSleepMinutes: number
  swaps: number
  quotes: number
  swappedWood: number
  swappedKcal: number
  /** Every forager's rates during the day. */
  forageRates: number[]
  woodRates: number[]
  /** Every forager's seconds picking, gathering and walking, and the wood it gathered, during the day. */
  forageSecondsById: number[]
  gatherSecondsById: number[]
  walkSecondsById: number[]
  gatheredWoodById: number[]
}

export interface ValleyTotals {
  /** Bush stock plus every reserve at minute 0. */
  initialKcal: number
  regrownKcal: number
  metabolizedKcal: number
  gatheredKcal: number
  spoiledKcal: number
  initialWood: number
  regrownWood: number
  gatheredWood: number
  burnedWood: number
  swappedWood: number
  swappedKcal: number
  /** The minute of the run's first swap, if any. */
  firstSwapMinute: number | null
}

export interface ValleyState {
  config: ValleyConfig
  layout: ValleyLayout
  /** The next minute to run. Minute `m` is minute `m mod 1,440` of day `floor(m / 1,440)`. */
  minute: number
  /** Every bush's berries and every tree's deadwood, by ID. */
  bushKcal: Int32Array
  treeWood: Int32Array
  foragers: Forager[]
  totals: ValleyTotals
  /** The actions of the last minute run, in turn order. */
  lastEvents: ActionEvent[]
  lastSwaps: SwapEvent[]
  lastQuotes: QuoteEvent[]
  lastPractice: PracticeEvent[]
  /** The deaths of the last minute run. */
  lastDeaths: DeathEvent[]
  /** Recent events, one array per day, oldest first, at most `EVENT_HISTORY_DAYS` days. */
  eventDays: ValleyEvent[][]
  days: DaySummary[]
  today: DaySummary
}
