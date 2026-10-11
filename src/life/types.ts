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

/** What a forager last saw at a patch. It never learns a stock it did not observe. */
export interface PatchMemory {
  stockKcal: number
  observedTick: number
}

export type ForagerAction = 'sleep' | 'rest' | 'forage' | 'walk'

export type ActionReason =
  'night' | 'satiated' | 'foraging' | 'seeking food' | 'waiting for regrowth' | 'going home' | 'too late to set out'

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

export type LifeEvent = ActionEvent | GiftEvent | DeathEvent

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
}

export interface EnergyTotals {
  /** Patch stock plus every reserve at tick 0. */
  initialKcal: number
  regrownKcal: number
  metabolizedKcal: number
  gatheredKcal: number
  spoiledKcal: number
  givenKcal: number
}

export interface LifeState {
  config: LifeConfig
  /** The next tick to run. Tick `t` covers hour `t mod 24` of day `floor(t / 24)`. */
  tick: number
  patches: Patch[]
  /** Indexed by forager ID. Dead foragers stay in the band. */
  foragers: Forager[]
  totals: EnergyTotals
  /** The actions taken in the last tick run, in turn order; empty before the first tick and once all are dead. */
  lastEvents: ActionEvent[]
  /** The gifts made in the last tick run, in the order they were made. */
  lastGifts: GiftEvent[]
  /** Recent events, one array per day, oldest first, at most `EVENT_HISTORY_DAYS` days. */
  eventDays: LifeEvent[][]
  /** Every completed day. */
  days: DaySummary[]
  /** The day in progress, summarized so far. */
  today: DaySummary
}
