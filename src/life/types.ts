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
  /** Food gathered in a full hour of foraging. */
  forageKcalPerHour: number
  sleepKcalPerHour: number
  restKcalPerHour: number
  forageCostKcalPerHour: number
  travelKcalPerHour: number
  reserveMaxKcal: number
  initialReserveKcal: number
  hungryBelowKcal: number
  satiatedAtKcal: number
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

/** What the forager last saw at a patch. It never learns a stock it did not observe. */
export interface PatchMemory {
  stockKcal: number
  observedTick: number
}

export type ForagerAction = 'sleep' | 'rest' | 'forage' | 'walk'

export type ActionReason = 'night' | 'satiated' | 'foraging' | 'seeking food' | 'waiting for regrowth'

export interface Forager {
  position: Tile
  energyKcal: number
  hungry: boolean
  targetPatchId: number | null
  /** Indexed by patch ID. */
  memory: PatchMemory[]
  alive: boolean
  deathTick: number | null
}

export interface ActionEvent {
  kind: 'action'
  tick: number
  action: ForagerAction
  reason: ActionReason
  from: Tile
  position: Tile
  targetPatchId: number | null
  /** The patch foraged this hour, if any. */
  patchId: number | null
  gatheredKcal: number
  spentKcal: number
  energyAfterKcal: number
}

export interface DeathEvent {
  kind: 'death'
  tick: number
  cause: 'starvation'
}

export type LifeEvent = ActionEvent | DeathEvent

export type ActionHours = Record<ForagerAction, number>

export interface DaySummary {
  day: number
  hours: ActionHours
  gatheredKcal: number
  spentKcal: number
  endEnergyKcal: number
  totalPatchStockKcal: number
  alive: boolean
}

export interface EnergyTotals {
  /** Patch stock plus the reserve at tick 0. */
  initialKcal: number
  regrownKcal: number
  metabolizedKcal: number
  gatheredKcal: number
}

export interface LifeState {
  config: LifeConfig
  /** The next tick to run. Tick `t` covers hour `t mod 24` of day `floor(t / 24)`. */
  tick: number
  patches: Patch[]
  forager: Forager
  totals: EnergyTotals
  /** The action taken in the last tick run, or null before the first. */
  lastEvent: ActionEvent | null
  /** Recent events, one array per day, oldest first, at most `EVENT_HISTORY_DAYS` days. */
  eventDays: LifeEvent[][]
  /** Every completed day. */
  days: DaySummary[]
  /** The day in progress, summarized so far. */
  today: DaySummary
}
