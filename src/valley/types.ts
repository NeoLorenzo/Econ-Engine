export interface HydrationConfig {
  waterBaseMlPerDay: number
  waterExtraMlPerKcal: number
  thirstBodyPerMille: number
  urgentThirstBodyPerMille: number
  fatalWaterLossBodyPerMille: number
  initialWaterDeficitMl: number
  drinkStopMl: number
  drinkMlPerSecond: number
  referenceBodyKg: number
  restKcalPerHour: number
}

export interface Hydration {
  waterDeficitMl: number
  waterBaseRemainder: number
  waterActivityRemainder: number
  waterLostMl: number
  waterDrunkMl: number
  thirsty: boolean
}

import type { ObservationEvent } from './perception'
import type { Knowledge, NavMap, Route } from './routes'
import type { Terrain } from './terrain'
import type { FishStock } from './fish'
import type { WakeQueue } from './clock'

export interface BankMemory extends Point {
  /** The shore half-edge of the walkable triangle it was set back from. */
  id: number
  bodyId: number
  /** The walkable triangle holding the bank point. */
  triangle: number
  minute: number
}

export interface DrinkEvent {
  kind: 'drink'
  minute: number
  foragerId: number
  bankId: number
  bodyId: number
  seconds: number
  volumeMl: number
  deficitBeforeMl: number
  deficitAfterMl: number
  lossMl: number
}

export interface RouteFailureEvent {
  kind: 'route failure'
  minute: number
  foragerId: number
  destination: Point
  knowledgeRevision: number
}

export type WaterEvent = DrinkEvent | RouteFailureEvent

/** The three foods: berries from bushes, hazelnuts from hazels, and fish from the lake. */
export type FoodKind = 'berries' | 'nuts' | 'fish'

/** Carried food in a lot of one food taken in one minute: its food, its kilocalories and the minute it was taken. */
export interface FoodLot {
  food: FoodKind
  kcal: number
  harvestTick: number
}

export interface TraitRule {
  base: number
  effect: number
  low: number
  high: number
}
export interface NatureConfig {
  womanHeightCm: number
  manHeightCm: number
  heightSdCm: number
  womanWeightKg: number
  manWeightKg: number
  weightSdKg: number
  womanGripKg: number
  manGripKg: number
  gripSdKg: number
  heightWeightPerMille: number
  heightGripPerMille: number
  weightGripPerMille: number
  traitCorrelationsPerMille: number[]
  referenceGripKg: number
  companyRadiusCm: number
  duskMarginMinutes: number
  exploreRangeCm: number
  /** The most ways a person remembers; past it, the way used longest ago is forgotten. */
  waysRemembered: number
  /** A way is reconsidered when used this long after it was planned, if new ground has been seen since. */
  wayRecheckMinutes: number
  /** The still landscape is surveyed again once a person stands this far from their last survey. */
  resurveyCm: number
  extraversionRule: TraitRule
  agreeablenessRule: TraitRule
  conscientiousnessRule: TraitRule
  neuroticismRule: TraitRule
  opennessRule: TraitRule
  opennessExpectRule: TraitRule
}
export interface Personality {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}
export interface PersonNature {
  sex: 0 | 1
  heightCm: number
  weightKg: number
  gripKg: number
  traits: Personality
  loadCapacityKg: number
  rates: Record<EnergyRateKey, number>
  thirstThresholds: { thirsty: number; urgent: number; fatal: number }
  companyRadiusCm: number
  sellerShareInput: number
  woodStockTarget: number
  satiationKcal: number
  duskMarginMinutes: number
  exploringRangeCm: number
  expectedStockPerMille: number
}
export type EnergyRateKey =
  | 'walkKcalPerHour'
  | 'moderateWalkKcalPerHour'
  | 'steepWalkKcalPerHour'
  | 'pickKcalPerHour'
  | 'gatherKcalPerHour'
  | 'chopKcalPerHour'
  | 'makeKcalPerHour'
  | 'restKcalPerHour'
  | 'sleepKcalPerHour'
  | 'fireSleepKcalPerHour'
  | 'hutSleepKcalPerHour'
  | 'coldSleepKcalPerHour'
/** Integer configuration; task costs and production rates are per hour and settled at wake-ups. */
export interface ValleyConfig extends HydrationConfig, NatureConfig {
  daysPerYear: number
  /** The ground mesh: its largest relief square, how far its heights and shores may stray from the terrain's. */
  meshMaxEdgeCm: number
  meshHeightToleranceCm: number
  shoreToleranceCm: number
  walkKcalPerHour: number
  moderateSlowdownPerMille: number
  steepDownSlowdownPerMille: number
  climbMinutesPerMetre: number
  berryThicketCapacityKcal: number
  berryThicketRegrowthKcalPerYear: number
  berryThicketWoodKg: number
  berryThicketWoodRegrowthKgPerYear: number
  hazelThicketCapacityKcal: number
  hazelThicketRegrowthKcalPerYear: number
  standWoodKg: number
  standDeadfallKgPerYear: number
  standLogs: number
  outcropStones: number
  treeRegrowthYears: number
  riverCatchmentM2: number
  riverDepthCm: number
  drinkBankHeightCm: number
  fishMinAreaM2: number
  fishKgPerHectare: number
  fishGrowthPercentPerYear: number
  seed: number
  /** The land is a square this many centimetres wide, with the camp at its centre and the lake beyond its north edge. */
  valleySizeCm: number
  /** Heights are held on a lattice this far apart; the land is cut into chunks this wide for searches. */
  terrainCellCm: number
  chunkCm: number
  /** The broad rise and fall: up to `reliefCm` high, its hills `reliefWavelengthCm` apart. */
  reliefCm: number
  reliefWavelengthCm: number
  /** Regional ice-flow controls: their spacing and the greatest turn between neighbours, in sixteenths of a circle. */
  iceFlowControlCm: number
  iceFlowTurnSteps: number
  /** Curved, broken moraine belts, with changing half-widths and heights. */
  moraineBeltCount: number
  moraineMinHalfWidthCm: number
  moraineMaxHalfWidthCm: number
  moraineMinHeightCm: number
  moraineMaxHeightCm: number
  moraineMinControlCm: number
  moraineMaxControlCm: number
  /** Streamlined hills aligned with the ice-flow field. */
  drumlinCount: number
  drumlinMinLengthCm: number
  drumlinMaxLengthCm: number
  drumlinMinWidthCm: number
  drumlinMaxWidthCm: number
  drumlinMinHeightCm: number
  drumlinMaxHeightCm: number
  drumlinMinAspectPerMille: number
  /** Irregular kames and clustered dead-ice hummocks. */
  kameCount: number
  kameMinRadiusCm: number
  kameMaxRadiusCm: number
  kameMinHeightCm: number
  kameMaxHeightCm: number
  hummockClusterCount: number
  hummockCount: number
  hummockMinWidthCm: number
  hummockMaxWidthCm: number
  hummockMinHeightCm: number
  hummockMaxHeightCm: number
  /** Small and large irregular kettle hollows; centre depth is limited below. */
  smallKettleCount: number
  largeKettleCount: number
  smallKettleMinRadiusCm: number
  smallKettleMaxRadiusCm: number
  largeKettleMinRadiusCm: number
  largeKettleMaxRadiusCm: number
  kettleDepthPerMille: number
  kettleMaxDepthCm: number
  /** Broad, branching meltwater valleys. */
  tunnelValleyCount: number
  tunnelValleyMinWidthCm: number
  tunnelValleyMaxWidthCm: number
  tunnelValleyMinDepthCm: number
  tunnelValleyMaxDepthCm: number
  tunnelValleyMinControlCm: number
  tunnelValleyMaxControlCm: number
  /** Two zero-centred microrelief fields, coarse and fine. */
  microCoarseWavelengthCm: number
  microCoarseAmplitudeCm: number
  microFineWavelengthCm: number
  microFineAmplitudeCm: number
  /** The land rises from the lake over this distance. */
  /** Moderate slopes or sharp local curvature expose dirt; steeper slopes expose stone. */
  dirtSlopePercent: number
  stoneSlopePercent: number
  dirtCurvatureCm: number
  /** Scattered starts lie within the square this wide round the land's centre. */
  startAreaCm: number
  thicketCount: number
  thicketRadiusCm: number
  /** Hazel thickets, a fourth kind of site, of hazels holding nuts, gathered and cracked by hand. */
  hazelThicketCount: number
  hazelThicketRadiusCm: number
  /** Nuts gathered and cracked in an hour at a full hazel at a skill of 100%. */
  nutKcalPerHour: number
  /** Carried nuts, in their shells, weigh a kilogram for every this many kilocalories. */
  nutKcalPerKg: number
  nutShelfLifeHours: number
  /** The lake beyond the valley's north edge: its area, its fish at capacity, and their yearly logistic growth rate. */
  /** Fish caught in an hour at a full lake at a skill of 100%. */
  fishKcalPerHour: number
  /** Carried fish weigh a kilogram for every this many kilocalories. */
  fishKcalPerKg: number
  fishShelfLifeHours: number
  standCount: number
  standRadiusCm: number
  /** Branches a tree's crown brings down when it is felled, in kilograms. */
  fellWood: number
  /** Site centres lie at least this far apart, this far from the valley's edges and this far from the camp. */
  siteSpacingCm: number
  siteMarginCm: number
  campClearingCm: number
  /** A group's huts stand on rings round its fire: ring `k` is `k · hutRingCm` from it and holds `8k` huts. */
  hutRingCm: number
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
  /** Berries picked in an hour at a full bush at a skill of 100%. */
  berryKcalPerHour: number
  /** Wood, sticks or branches, gathered in an hour at a skill of 100%. */
  woodPerHour: number
  /** An hour asleep in a whole hut by a lit fire, the warmest night. */
  sleepKcalPerHour: number
  restKcalPerHour: number
  /** What an hour of each task costs: picking, gathering wood or fetching a stone, cutting a log, making an axe. */
  pickKcalPerHour: number
  gatherKcalPerHour: number
  chopKcalPerHour: number
  makeKcalPerHour: number
  /** The Pandolf terrain factor of each ground for walking, in percent: 100 for a road, 120 for light brush. */
  grassTerrainPercent: number
  dirtTerrainPercent: number
  stoneTerrainPercent: number
  /** Walking speed falls by this many thousandths for each body mass carried. */
  loadSlowdownPerMille: number
  reserveMaxKcal: number
  initialReserveKcal: number
  hungryBelowKcal: number
  satiatedAtKcal: number
  /** The number of foragers at the start. There are no births. */
  founders: number
  /** Carried berries spoil this many hours after they were picked; 0 means they keep. */
  berryShelfLifeHours: number
  /** Wood burned for an hour of warm sleep. */
  fireWoodPerHour: number
  /** An hour asleep by a lit fire without a hut, in a whole hut without a fire, and with neither. */
  fireSleepKcalPerHour: number
  hutSleepKcalPerHour: number
  coldSleepKcalPerHour: number
  /** A forager short of wood gathers until it holds this many nights' wood. */
  woodStockNights: number
  /** A forager that has gathered wood since it left its hearth keeps gathering until it has gathered this much. */
  woodLoad: number
  /** Born skills are drawn independently from this range, in percent. */
  skillMinPercent: number
  skillMaxPercent: number
  /** How long a forager remembers the terms it last heard. */
  termsMemoryHours: number
  /** Skill grows with practice over this many days and fades without it. */
  practiceDays: number
  practiceHalfHours: number
  practiceMinPercent: number
  practiceMaxPercent: number
  startPracticeHoursPerDay: number
  /** Foragers start at scattered points, each its own hearth, rather than as one group around the camp. */
  scattered: boolean
  /** Scattered starts lie at least this far apart. */
  startSpacingCm: number
  /** A thicket or stand not checked for this many hours is worth checking again. */
  /** By day a forager sees thickets, stands, other foragers and flags this far; at night only `perceptionRadiusCm`. */
  sightRadiusCm: number
  /** Carried berries weigh a kilogram for every this many kilocalories. */
  berryKcalPerKg: number
  /** Wood a group's fire burns in a night hour. */
  campfireWoodPerHour: number
  /** Outcrops, a third kind of site, each with stone spots holding stones that never come back. */
  outcropCount: number
  outcropRadiusCm: number
  /**
   * Logs a standing tree holds. Cutting the first fells it whole, and the rest are cut from the trunk where it lies. A
   * felled tree comes back to its stand `treeRegrowthYears` after it fell.
   */
  logsPerTree: number
  /** A log's weight, carried one at a time, and the minutes it takes to cut one with an axe of quality 100. */
  logKg: number
  logChopMinutes: number
  /** A hut is whole with this many logs, and loses one every `hutLogDays` days. */
  hutLogs: number
  hutLogDays: number
  /** Making an axe takes `axeHours` at craft 100% and uses `axeWood` kg; an axe of quality 100 lasts `axeLogs` logs. */
  axeHours: number
  axeLogs: number
  axeWood: number
  /** Born craft skills are drawn from this range, in percent. */
  craftSkillMinPercent: number
  craftSkillMaxPercent: number
  /** Members may ask for, promise and sell axes. */
  axeTrade: boolean
  /** Craft grows with practice; off, practice at making axes is fixed at 100%. */
  craftPractice: boolean
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
export const PLACE_KINDS = ['berry thicket', 'hazel thicket', 'stand', 'outcrop'] as const
export type PlaceKind = (typeof PLACE_KINDS)[number]
export interface PlaceTable {
  count: number
  kind: Uint8Array
  x: Int32Array
  y: Int32Array
  chunk: Int32Array
  radiusCm: Int32Array
}

export interface ValleyLayout {
  places: PlaceTable
  /** The ground mesh as people walk it, with the bank points along its shores. */
  nav: NavMap
  placeChunks: Int32Array[]
  placeIndex: PlantIndex
  camp: Point
  /** The land's heights, and the ground of each terrain cell with every outcrop's circle laid as stone. */
  terrain: Terrain
  ground: Uint8Array
  /** Every site's centre as a point, by site ID, with an index for close sight. */
  sitePoints: Plants
  siteIndex: PlantIndex
  /** The food and wood plants listed by chunk, for searches outwards from a forager. */
  foodChunks: PlantIndex
  woodChunks: PlantIndex
  treeChunks: PlantIndex
  stoneChunks: PlantIndex
  thickets: Point[]
  hazelThickets: Point[]
  stands: Point[]
  outcrops: Point[]
  bushes: Plants
  /** Hazels, by hazel ID, each belonging to a hazel thicket. */
  hazels: Plants
  /** Every plant that holds food: the bushes, by ID, then the hazels, food plant `bushes.count + h` being hazel `h`. */
  foodPlants: Plants
  trees: Plants
  /** Every plant that holds wood: the trees, by ID, then the bushes, wood plant `trees.count + b` being bush `b`. */
  woodPlants: Plants
  /** Stone spots, by ID, each belonging to an outcrop. */
  stones: Plants
  /** Each forager's starting hearth, by forager ID. A forager's hearth moves when it joins a group. */
  hearths: Point[]
  /** The bushes and the hazels by food plant ID, each kind on its own, and every food plant together. */
  bushIndex: PlantIndex
  hazelIndex: PlantIndex
  foodIndex: PlantIndex
  treeIndex: PlantIndex
  woodIndex: PlantIndex
  stoneIndex: PlantIndex
}

export type Good = 'food' | 'wood'

/** A group: its flag, when it was founded and dissolved, and its members in order of joining. */
export interface Group {
  id: number
  flag: Point
  foundedMinute: number
  dissolvedMinute: number | null
  /** Every forager that ever joined, in order of joining; slot `i` of the rings round the flag went to `members[i]`. */
  members: number[]
  hearthSlots: number[]
  /** The wood in its fire, and whether the fire is lit this hour. */
  fireWood: number
  fireLit: boolean
  /** The wood each member has put into the fire, in the order of `members`. */
  given: number[]
  /** Wood its fire has burned, and the night hours it was lit and out, since it was founded. */
  fireBurned: number
  litHours: number
  darkHours: number
}

export interface HeardTerms {
  kcalPerWood: number
  minute: number
}

export interface TaskSeconds {
  forage: number
  gather: number
  /** Making axes. */
  make: number
}

/** Seconds at each task on each of a forager's last `practiceDays` days, oldest first. */
export interface PracticeLog {
  forage: number[]
  gather: number[]
  make: number[]
}

/** An axe: its quality, the logs it has left to cut, who made it and when. */
export interface Axe {
  id: number
  quality: number
  logsLeft: number
  makerId: number
  madeMinute: number
}

/** An axe being made: the seconds worked and needed, and whether it is for sale. Its stone and wood are in it. */
export interface AxeMaking {
  worked: number
  needed: number
  forSale: boolean
}

/** The best asking price for an axe a forager has heard: from whom, for what quality, whether it is made, and when. */
export interface HeardAsk {
  sellerId: number
  price: number
  quality: number
  ready: boolean
  minute: number
}

/** A hut, standing where it was begun, with the logs it holds. */
export interface Hut {
  id: number
  builderId: number
  x: number
  y: number
  logs: number
  begunMinute: number
  /** The minute its builder's hearth moved away from it, or null. */
  abandonedMinute: number | null
}

export interface AxeTotals {
  madeOwn: number
  madeForSale: number
  sold: number
  bought: number
  wornOut: number
  kcalReceived: number
  kcalPaid: number
  logsCut: number
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

export type TaskKind = 'sleep' | 'rest' | 'walk' | 'pick' | 'nuts' | 'fish' | 'drink' | 'gather' | 'cut' | 'make'
export interface TaskRecord {
  startTripWood?: number
  startLoadKg?: number
  kind: TaskKind
  startMinute: number
  endMinute: number
  placeId: number
  routeId: number
  energyPerHour: number
  waterPerHour: number
  waterBaseMlPerDay: number
  waterExtraMlPerKcal: number
  restKcalPerHour: number
  drinkMlPerMinute: number
  startEnergyKcal: number
  startEnergyRemainder: number
  startEnergyTimeRemainder?: number
  startWaterTimeRemainder?: number
  startWaterMl: number
  startWaterRemainder: number
  startWaterActivityRemainder: number
  reason: ActionReason
  productionPerHour: number
  groupId?: number | null
  wholeHut?: boolean
  rateChanges?: { minute: number; energyPerHour: number }[]
}

/** A corridor of triangles a person walked between two points, from `a` to `b`; immutable. */
export interface Way {
  id: number
  a: Point
  b: Point
  corridor: Int32Array
  plannedMinute: number
  revision: number
  usedMinute: number
}
/** How a walk's corridor was found. */
export type WalkPlan = 'way' | 'joined' | 'straight' | 'steered'
export interface Forager extends Hydration, PersonNature {
  task: TaskRecord | null
  knowledge: Knowledge
  knownPlaces: Int32Array
  placeCheckedMinute: Int32Array
  seenMinute: Int32Array
  placeStock: Int32Array
  placeWood: Int32Array
  placeLogs: Int32Array
  metMinute: Int32Array
  metPosition: Map<number, Point>
  arrivalFrom: Int32Array
  /** Ways walked to places, banks and home, never changed in place: a change makes a new list. */
  ways: readonly Way[]
  nextWayId: number
  /** When the person last set out on a leisure walk, or -1. */
  leisureMinute: number
  /** Where the still landscape was last surveyed, or null before the first survey. */
  survey: Point | null
  energyTimeRemainder: number
  waterTimeRemainder: number
  lastWakeMinute: number
  energyRemainder: number
  knownBanks: Map<number, BankMemory>
  fishMemory: Map<number, { stock: number; capacity: number; minute: number }>
  deathSecond: number | null
  deathCauses: ('starvation' | 'dehydration')[]
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
  /** Born skills, in percent. */
  foragingSkill: number
  woodSkill: number
  craftSkill: number
  /** Its craft for the day, in percent: born craft skill times practice. */
  craft: number
  /** Whether it carries a log, and the stones it holds. */
  log: number
  stone: number
  /** Its hut, by ID, while it stands at its hearth; null if it has none. */
  hutId: number | null
  axe: Axe | null
  spareAxe: Axe | null
  making: AxeMaking | null
  /** The part of a log it has cut, in seconds times quality. */
  chopRemainder: number
  promised: boolean
  heardAsk: HeardAsk | null
  axeTotals: AxeTotals
  /** Minutes asleep in its whole hut. */
  hutSleepMinutes: number
  /** Hourly rates for the day at full sources: berries, nuts, fish and wood. It knows them. */
  forageRate: number
  nutRate: number
  fishRate: number
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
  /** The hour of its last fire decision, and whether it has a fire of its own that hour. */
  fireHour: number
  warm: boolean
  /** The wood it has put into any group's fire, and the minutes it has slept warm by one. */
  fireGiven: number
  warmByFireMinutes: number
  swapTotals: SwapTotals
  /** Its group, or null if it has none, and the minute it joined or founded it. */
  groupId: number | null
  joinedMinute: number | null
  /** The groups whose flags it has seen and not since found gone. */
  knownFlags: number[]
}

/** How warm a forager sleeps: by a lit fire in its whole hut, by the fire alone, in its hut alone, or with neither. */
export type Warmth = 'fire and hut' | 'fire' | 'hut' | 'cold'

export type ForagerAction = 'sleep' | 'rest' | 'walk' | 'forage' | 'gather' | 'cut' | 'make'

/** Work for a hut: cutting a log, picking up a stone, or making an axe. */
export type HutTask = 'cut' | 'stone' | 'make'

export type ActionReason =
  | 'drinking'
  | 'seeking water'
  | 'no known route'
  | 'going home'
  | 'night'
  | 'filling a load'
  | 'satiated'
  | 'waiting to swap'
  | 'too late to set out'
  | 'waiting for regrowth'
  | 'foraging'
  | 'gathering nuts'
  | 'fishing'
  | 'gathering'
  | 'seeking food'
  | 'seeking wood'
  | 'seeking company'
  | 'waiting for company'
  | 'exploring'
  | 'searching'
  | 'out for a walk'
  | 'going home to rest'
  | 'taking a load home'
  | 'taking a log home'
  | 'making an axe'
  | 'going home to make an axe'
  | 'cutting a log'
  | 'seeking a tree'
  | 'waiting for an axe being made'
  | 'going home to wait for an axe'
  | 'picking food to buy an axe'
  | 'taking food home to buy an axe'
  | 'waiting to buy an axe'
  | 'fetching a stone'
  | 'picking up a stone'

/** A log cut from a tree. */
export interface CutEvent {
  kind: 'cut'
  minute: number
  foragerId: number
  treeId: number
  axeId: number
  quality: number
  axeLogsLeft: number
  treeLogsAfter: number
  /** Whether this cut felled the tree, bringing its crown's branches down. */
  felled: boolean
}

/** An axe finished. */
export interface MadeEvent {
  kind: 'made'
  minute: number
  foragerId: number
  axe: Axe
  craft: number
  forSale: boolean
}

/** An axe worn out and thrown away. */
export interface WornEvent {
  kind: 'worn'
  minute: number
  foragerId: number
  axeId: number
  makerId: number
}

/** A maker promised to make an axe for sale to a member that asked for one. */
export interface PromiseEvent {
  kind: 'promise'
  minute: number
  promiserId: number
  askerId: number
  ask: number
  quality: number
}

/** An axe sold for food. */
export interface SaleEvent {
  kind: 'sale'
  minute: number
  sellerId: number
  buyerId: number
  axe: Axe
  price: number
  /** The seller's ask and the axe's worth to the buyer, between which the price lies. */
  ask: number
  worth: number
}

export type AxeEvent = CutEvent | MadeEvent | WornEvent | PromiseEvent | SaleEvent

/** A hut lost a log to the weather. */
export interface WeatherEvent {
  kind: 'weather'
  minute: number
  hutId: number
  logsAfter: number
}

/** A hut left behind when its builder's hearth moved. */
export interface AbandonEvent {
  kind: 'abandon'
  minute: number
  hutId: number
  foragerId: number
  logs: number
}

export type HutEvent = WeatherEvent | AbandonEvent

export interface DeathEvent {
  kind: 'death'
  foragerId: number
  minute: number
  cause: 'starvation' | 'dehydration' | 'starvation and dehydration'
  second: number
}

export interface SwapEvent {
  sellerSharePerMille: number
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
  nutRate: number
  fishRate: number
  woodRate: number
  makePercent: number
  craftBefore: number
  craft: number
}

/** Two foragers without a group met and founded one, the forager whose turn it was first. */
export interface FoundEvent {
  kind: 'found'
  minute: number
  groupId: number
  flag: Point
  founderIds: [number, number]
  hearths: [Point, Point]
}

/** A forager without a group met a member and joined its group. */
export interface JoinEvent {
  kind: 'join'
  minute: number
  groupId: number
  foragerId: number
  /** The member it met. */
  metId: number
  hearth: Point
}

/** A group left with one living member dissolved after a death. */
export interface DissolveEvent {
  kind: 'dissolve'
  minute: number
  groupId: number
  survivorId: number | null
  /** The wood its survivor took back from the fire. */
  fireWood: number
}

export type GroupEvent = FoundEvent | JoinEvent | DissolveEvent

/** A group's fire at the start of a night hour: it burned its hour's wood and is lit, or held too little and is out. */
export interface FireEvent {
  kind: 'fire'
  minute: number
  groupId: number
  burned: number
  lit: boolean
  fireWoodAfter: number
}

/** A member at its hearth put wood into its group's fire. */
export interface FeedEvent {
  kind: 'feed'
  minute: number
  groupId: number
  foragerId: number
  wood: number
  /** Of that wood, what was spare: above its target of `woodStockNights` nights. The rest came from its stock. */
  spareWood: number
  /** Whether the fire held less than it would burn in the rest of the night, or by day in a whole night. */
  low: boolean
  woodBefore: number
  /** What the fire burns in a night hour, which sets what the rest of the night needs. */
  burnPerHour: number
  fireWoodBefore: number
  fireWoodAfter: number
}

export interface TaskEvent {
  kind: 'task-start' | 'task-end'
  minute: number
  foragerId: number
  task: TaskRecord
  position: Point
  produced?: { kcal: number; wood: number; logs: number; stones: number }
  paid?: { kcal: number; waterLossMl: number; drankMl: number }
  ateKcal?: number
  spoiledKcal?: number
}
export type WakeEvent =
  | { kind: 'world'; minute: number }
  | TaskEvent
  | ObservationEvent
  | {
      kind: 'walk'
      minute: number
      foragerId: number
      routeId: number
      /** How the corridor was found; `wayId` is the way walked or joined, else -1. */
      plan: WalkPlan
      rechecked: boolean
      wayId: number
    }
  | { kind: 'regrowth'; minute: number; placeId: number; kcal: number; wood: number; logs: number }
  | { kind: 'fish-regrowth'; minute: number; bodyId: number; kcal: number; remainder: number }
  | { kind: 'rate-change'; minute: number; foragerId: number; energyPerHour: number }
export type ValleyEvent =
  | WakeEvent
  | (Omit<FoundEvent, 'kind'> & { kind: 'group-founded' })
  | (Omit<JoinEvent, 'kind'> & { kind: 'group-joined' })
  | (Omit<DissolveEvent, 'kind'> & { kind: 'group-dissolved' })
  | (Omit<SwapEvent, 'kind'> & { kind: 'exchange' })
  | { kind: 'meet'; minute: number; foragerId: number; otherId: number }
  | { kind: 'axe-request'; minute: number; foragerId: number; otherId: number }
  | { kind: 'delivery'; minute: number; foragerId: number; logs: number; hutId: number | null }
  | { kind: 'fire'; minute: number; foragerId: number; burned: number; lit: boolean }
  | WaterEvent
  | DeathEvent
  | SwapEvent
  | QuoteEvent
  | PracticeEvent
  | GroupEvent
  | FireEvent
  | FeedEvent
  | AxeEvent
  | HutEvent

/** Seconds spent on each kind of time, summed over the band. */
export interface ActionSeconds {
  sleep: number
  rest: number
  walk: number
  forage: number
  gather: number
  /** Cutting logs; and fetching stones and making axes. */
  cut: number
  make: number
}

/** One day of the band. Time is in seconds, summed over every forager that acted. */
export interface DaySummary {
  wakeUpsById: number[]
  drinkingMlById: number[]
  waterLossMlById: number[]
  maxDeficitMlById: number[]
  endDeficitMlById: number[]
  thirstySecondsById: number[]
  seekingWaterSecondsById: number[]
  drinkingSecondsById: number[]
  dehydrationDeaths: number
  starvationDeaths: number
  fishCatchByBody: Record<number, number>
  day: number
  seconds: ActionSeconds
  gatheredKcal: number
  spentKcal: number
  alive: number
  deaths: number
  /** Berries on bushes, nuts on hazels and fish in the lake. */
  bushStockKcal: number
  hazelStockKcal: number
  fishKcal: number
  /** Food taken during the day, of each kind. */
  gatheredBerriesKcal: number
  gatheredNutsKcal: number
  gatheredFishKcal: number
  woodStock: number
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
  /** Every forager's height climbed and energy spent walking during the day. */
  climbedCmById: number[]
  walkKcalById: number[]
  /** Groups standing and foragers alive without a group at the end of the day. */
  groupsStanding: number
  loners: number
  foundings: number
  joinings: number
  dissolutions: number
  /** Every forager's count of places ever seen, at the end of the day. */
  placesSeenById: number[]
  /** Every forager's seconds walked with a load during the day, its sites known, and the sites it checked that day. */
  loadedWalkSecondsById: number[]
  sitesKnownById: number[]
  sitesCheckedById: number[]
  /** Every forager's wood put into fires during the day; wood burned in groups' fires; night hours fires were lit and out. */
  fireGivenById: number[]
  campfireBurnedWood: number
  fireLitHours: number
  fireDarkHours: number
  /** Logs cut, axes made (and of them for sale), sold and worn out during the day. */
  logsCut: number
  axesMade: number
  axesMadeForSale: number
  axesSold: number
  axesWornOut: number
  /** Living member-minutes, those with the member's hut whole, and minutes asleep in a whole hut. */
  memberMinutes: number
  hutWholeMinutes: number
  hutSleepMinutes: number
  /** Huts whole at the end of the day. */
  hutsWhole: number
  /**
   * Every forager's seconds cutting and making, logs cut, axes made, sold and bought during the day; its craft for the
   * day; and the logs in its hut at the end of it.
   */
  cutSecondsById: number[]
  makeSecondsById: number[]
  logsCutById: number[]
  axesMadeById: number[]
  axesSoldById: number[]
  axesBoughtById: number[]
  craftById: number[]
  hutLogsById: number[]
}

export interface ValleyTotals {
  wakeUps: number
  /** Food on plants and in the lake, plus every reserve, at minute 0. */
  initialKcal: number
  /** Berries and nuts regrown, and fish grown in the lake. */
  regrownKcal: number
  fishGrownKcal: number
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
  /** Branches brought down by felling trees. */
  fellenWood: number
  /** Logs on trees at minute 0, regrown, cut and rotted. */
  initialLogs: number
  regrownLogs: number
  logsCut: number
  rottedLogs: number
  /** Stones on the ground at minute 0; stones and wood put into axes begun; axes made, worn out and sold. */
  initialStones: number
  stonesWorked: number
  axeWood: number
  axesMade: number
  axesWornOut: number
  axeSales: number
  axeSalesKcal: number
}

export interface ValleyState {
  founderMetrics: ReturnType<typeof import('./nature').founderMetrics>
  queue: WakeQueue
  routes: Route[]
  peopleByChunk: Int32Array[]
  /** Each person's chunk when people were last located, or -1 for the dead: `peopleByChunk` by person. */
  personChunk: Int32Array
  lastInterval: ValleyEvent[]
  logStock: Int32Array
  felledMinute: Int32Array
  logRegrowth: Map<number, number[]> // felling minutes of fully harvested three-log bundles
  fish: FishStock[]
  waterWithdrawals: Map<number, number>
  config: ValleyConfig
  layout: ValleyLayout
  /** The next minute to run. Minute `m` is minute `m mod 1,440` of day `floor(m / 1,440)`. */
  minute: number
  /** Every food plant's berries or nuts, and every wood plant's sticks or branches, by ID. */
  foodStock: Int32Array
  woodStock: Int32Array
  /** The lake's fish in kilocalories, and the growth owed it, in units of `100 · capacity · 8,760`. */
  fishKcal: number
  stoneStock: Int32Array
  foragers: Forager[]
  /** Every hut ever begun, by ID. */
  huts: Hut[]
  /** Every group ever founded, by ID. */
  groups: Group[]
  totals: ValleyTotals
  lastSwaps: SwapEvent[]
  lastQuotes: QuoteEvent[]
  lastPractice: PracticeEvent[]
  /** The deaths of the last minute run. */
  lastDeaths: DeathEvent[]
  /** The foundings, joinings and dissolutions of the last minute run. */
  lastGroupEvents: GroupEvent[]
  /** The fires burned or out at the start of the last minute, and the wood put into them during it. */
  lastFires: FireEvent[]
  lastFeeds: FeedEvent[]
  /** Logs cut, axes made and worn out, promises and sales, and huts weathered or abandoned in the last minute. */
  lastAxeEvents: AxeEvent[]
  lastHutEvents: HutEvent[]
  /** Recent events, one array per day, oldest first, at most `EVENT_HISTORY_DAYS` days. */
  eventDays: ValleyEvent[][]
  days: DaySummary[]
  today: DaySummary
}
