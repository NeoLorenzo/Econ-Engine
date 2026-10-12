/** Every quantity of food or energy is a whole number of kilocalories, so conservation is exact. */
export interface LifeConfig {
  seed: number
  gridWidth: number
  gridHeight: number
  patchCount: number
  patchCapacityKcal: number
  patchRegrowthKcalPerHour: number
  initialPatchStockKcal: number
  /** Daylight runs from `dawnHour` up to, but not including, `duskHour`. */
  dawnHour: number
  duskHour: number
  tilesPerHour: number
  /** The expected food gathered in an hour of foraging. */
  forageKcalPerHour: number
  sleepKcalPerHour: number
  restKcalPerHour: number
  forageCostKcalPerHour: number
  travelKcalPerHour: number
  reserveMaxKcal: number
  initialReserveKcal: number
  hungryBelowKcal: number
  satiatedAtKcal: number
  /** The number of foragers at the start. There are no births. */
  bandSize: number
  /** A forager sees every patch within this Manhattan distance of its tile; 0 is its own tile only. */
  perceptionRadiusTiles: number
  /** The band sleeps at a camp in the middle of the grid, walks home before dark and shares food there. */
  hasCamp: boolean
  /**
   * A successful hour of foraging takes this much. An hour succeeds with probability `forageKcalPerHour / harvestKcal`,
   * so the expected harvest per hour is `forageKcalPerHour` whatever the windfall's size.
   */
  harvestKcal: number
  /** Carried food spoils this many hours after it was harvested; 0 means it keeps. */
  shelfLifeHours: number
  /** How many of the band are sharers and reciprocators. The rest are keepers. */
  sharers: number
  reciprocators: number
  /** Groves of wood, on tiles without patches. With none, or with warm nights, wood never matters. */
  groveCount: number
  groveCapacityWood: number
  initialGroveWood: number
  groveRegrowthWoodPerHour: number
  /** The wood a forager of skill 100% gathers in an hour. */
  woodPerHour: number
  /** The wood burned for an hour of warm sleep. */
  fireWoodPerHour: number
  /** An hour of sleep without a fire costs this instead of `sleepKcalPerHour`. */
  coldSleepKcalPerHour: number
  /** A forager short of wood gathers until it holds this many nights' wood. */
  woodStockNights: number
  /** Each forager's born skills at foraging and at gathering wood are drawn independently from this range, in percent. */
  skillMinPercent: number
  skillMaxPercent: number
  /** Foragers may swap wood for food. */
  swapping: boolean
  /** Two foragers that could both gain from a swap tell each other the terms, even if they cannot complete it. */
  quotes: boolean
  /** A forager forgets terms it heard this many hours ago. */
  termsMemoryHours: number
  /** Skill grows with practice and fades without it. Off, every rate is the born rate. */
  practice: boolean
  /** A forager's practice at a task is its hours at it over this many days. */
  practiceDays: number
  /** Practice percentages run from the minimum with no hours towards the maximum, half way at these hours. */
  practiceHalfHours: number
  practiceMinPercent: number
  practiceMaxPercent: number
  /** Every day of a forager's practice log starts with this many hours at each task. */
  startPracticeHoursPerDay: number
}

export interface Tile {
  x: number
  y: number
}

export interface Patch {
  id: number
  tile: Tile
  stockKcal: number
}

/** A grove holds whole units of wood. */
export interface Grove {
  id: number
  tile: Tile
  wood: number
}

/** What a forager last saw at a patch. It never learns a stock it did not observe. */
export interface PatchMemory {
  stockKcal: number
  observedTick: number
}

/** What a forager last saw at a grove. */
export interface GroveMemory {
  wood: number
  observedTick: number
}

/** The two goods a forager can work for. */
export type Good = 'food' | 'wood'

/** Terms of a swap, in kilocalories per unit of wood, and the tick a forager heard them. */
export interface HeardTerms {
  kcalPerWood: number
  tick: number
}

/** Hours at each task: foraging and gathering wood. */
export interface TaskHours {
  forage: number
  gather: number
}

/** A forager's hours at each task on each of its last `practiceDays` days, oldest first. */
export interface PracticeLog {
  forage: number[]
  gather: number[]
}

/** A trip to gather wood for trade, and the spare wood it set out to hold. */
export interface TradeTrip {
  goalSpareWood: number
}

export type ForagerAction = 'sleep' | 'rest' | 'forage' | 'walk' | 'gather'

export type ActionReason =
  | 'night'
  | 'satiated'
  | 'foraging'
  | 'seeking food'
  | 'waiting for regrowth'
  | 'going home'
  | 'too late to set out'
  | 'gathering'
  | 'seeking wood'
  | 'waiting to swap'

/** A keeper never gives; a sharer gives to anyone hungry; a reciprocator gives to those who owe it nothing. */
export type Strategy = 'keeper' | 'sharer' | 'reciprocator'

/** Carried food: whole kilocalories, and the tick they were harvested, which decides when they spoil. */
export interface FoodLot {
  kcal: number
  harvestTick: number
}

/** What a forager has given to one other forager, and received from it. */
export interface LedgerEntry {
  givenKcal: number
  receivedKcal: number
}

export interface Forager {
  /** Its index in the band. */
  id: number
  position: Tile
  energyKcal: number
  hungry: boolean
  targetPatchId: number | null
  /** Indexed by patch ID. */
  memory: PatchMemory[]
  alive: boolean
  deathTick: number | null
  strategy: Strategy
  /** Oldest first. */
  carried: FoodLot[]
  /** Indexed by forager ID; its own entry stays empty. */
  ledger: LedgerEntry[]
  /** Its born skills at foraging and at gathering wood, in percent. */
  foragingSkill: number
  woodSkill: number
  /** Its hourly rates for the day: kilocalories foraging, units of wood gathering. It knows them. */
  forageRate: number
  woodRate: number
  /** Its hours at each task on each of its last `practiceDays` days. */
  practiceLog: PracticeLog
  /** Its hours at each task since midnight. */
  hoursToday: TaskHours
  /** Every hour it has added to its log since tick 0. */
  loggedHours: TaskHours
  /** The wood it holds, in units. Wood keeps. */
  wood: number
  /** Wood need, with hysteresis. */
  shortOfWood: boolean
  targetGroveId: number | null
  /** Indexed by grove ID. */
  groveMemory: GroveMemory[]
  /** The last terms it heard, if any. */
  heardTerms: HeardTerms | null
  /** A trip for trade under way today, if any. */
  trip: TradeTrip | null
  /** Everything it has swapped: wood sold and bought, and food received and paid for it. */
  swapTotals: SwapTotals
  /** Hours it has spent foraging and gathering. */
  hoursWorked: TaskHours
}

export interface SwapTotals {
  woodSold: number
  woodBought: number
  kcalReceived: number
  kcalPaid: number
}

export interface ActionEvent {
  kind: 'action'
  foragerId: number
  tick: number
  action: ForagerAction
  reason: ActionReason
  from: Tile
  position: Tile
  targetPatchId: number | null
  /** The patch foraged this hour, if any. */
  patchId: number | null
  /** Whether an hour of foraging succeeded; null for any other action. */
  succeeded: boolean | null
  /** Taken from the patch: `harvestKcal` on success, nothing on failure. */
  gatheredKcal: number
  /** What spoiled, and what the forager ate from what it carried, at the start of its turn. */
  spoiledKcal: number
  eatenKcal: number
  spentKcal: number
  energyAfterKcal: number
  /** What it carries at the end of its turn, after any gifts. */
  carriedAfterKcal: number
  /** Taken from a grove in an hour of gathering. `patchId` is the grove's. */
  gatheredWood: number
  /** Burned for an hour of warm sleep, and whether it slept cold. */
  burnedWood: number
  sleptCold: boolean
  /** The good it worked for, or walked towards, and whether to swap it. */
  workedFor: Good | null
  forTrade: boolean
  /** The wood it holds at the end of its turn. */
  woodAfter: number
}

export interface GiftEvent {
  kind: 'gift'
  tick: number
  giverId: number
  recipientId: number
  tile: Tile
  /** What the recipient asked for, and what it was given. */
  requestKcal: number
  kcal: number
}

export interface DeathEvent {
  kind: 'death'
  foragerId: number
  tick: number
  cause: 'starvation'
}

/** Wood swapped for food at terms between the two foragers' own. */
export interface SwapEvent {
  kind: 'swap'
  tick: number
  tile: Tile
  sellerId: number
  buyerId: number
  wood: number
  kcal: number
  kcalPerWood: number
  /** What each held just before: the seller's wood and room for food, the buyer's wood and carried food. */
  sellerWoodBefore: number
  sellerRoomKcal: number
  buyerWoodBefore: number
  buyerCarriedKcal: number
}

/** Terms two foragers told each other, without completing a swap. */
export interface QuoteEvent {
  kind: 'quote'
  tick: number
  sellerId: number
  buyerId: number
  kcalPerWood: number
}

/** A forager's practice at midnight: yesterday's hours entered in its log, and its rates for the new day. */
export interface PracticeEvent {
  kind: 'practice'
  tick: number
  foragerId: number
  /** Yesterday's hours at each task, added to the log. */
  added: TaskHours
  /** Its practice percentage at each task for the new day. */
  foragePercent: number
  woodPercent: number
  forageRateBefore: number
  woodRateBefore: number
  forageRate: number
  woodRate: number
}

export type LifeEvent = ActionEvent | GiftEvent | DeathEvent | SwapEvent | QuoteEvent | PracticeEvent

export type ActionHours = Record<ForagerAction, number>

/** One day of the band. Hours, food and energy are summed over every forager that acted. */
export interface DaySummary {
  day: number
  hours: ActionHours
  gatheredKcal: number
  spentKcal: number
  /** Foragers alive at the end of the day, and how many died during it. */
  alive: number
  deaths: number
  totalPatchStockKcal: number
  /** Every forager's reserve at the end of the day, indexed by forager ID. */
  endEnergyKcal: number[]
  givenKcal: number
  spoiledKcal: number
  /** Food carried by the band at the end of the day. */
  carriedKcal: number
  /** Foragers of each strategy alive at the end of the day. */
  aliveByStrategy: Record<Strategy, number>
  gatheredWood: number
  burnedWood: number
  coldSleepHours: number
  swaps: number
  swappedWood: number
  swappedKcal: number
  /** Every forager's rates during the day, indexed by forager ID. */
  forageRates: number[]
  woodRates: number[]
}

export interface EnergyTotals {
  /** Patch stock plus every reserve at tick 0. */
  initialKcal: number
  regrownKcal: number
  metabolizedKcal: number
  gatheredKcal: number
  spoiledKcal: number
  givenKcal: number
  /** Grove wood at tick 0. */
  initialWood: number
  regrownWood: number
  burnedWood: number
  swappedWood: number
  swappedKcal: number
}

export interface LifeState {
  config: LifeConfig
  /** The next tick to run. Tick `t` covers hour `t mod 24` of day `floor(t / 24)`. */
  tick: number
  patches: Patch[]
  groves: Grove[]
  /** Indexed by forager ID. Dead foragers stay in the band. */
  foragers: Forager[]
  totals: EnergyTotals
  /** The actions taken in the last tick run, in turn order; empty before the first tick and once all are dead. */
  lastEvents: ActionEvent[]
  /** The gifts made in the last tick run, in the order they were made. */
  lastGifts: GiftEvent[]
  /** The swaps and quotes of the last tick run, in the order they were made. */
  lastSwaps: SwapEvent[]
  lastQuotes: QuoteEvent[]
  /** The practice of the last tick run: one event per living forager in the first hour of a day, otherwise none. */
  lastPractice: PracticeEvent[]
  /** Recent events, one array per day, oldest first, at most `EVENT_HISTORY_DAYS` days. */
  eventDays: LifeEvent[][]
  /** Every completed day. */
  days: DaySummary[]
  /** The day in progress, summarized so far. */
  today: DaySummary
}
