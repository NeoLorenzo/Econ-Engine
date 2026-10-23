import type { Terrain } from './terrain'
import type { Hydration, HydrationConfig } from './hydration'
import type { GroundKnowledge } from './routes'
import type { FishStock } from './fish'

export interface BankMemory extends Point {
  segmentId?: number
  id: number
  bodyId: number
  wetCell: number
  dryCell: number
  minute: number
}

export interface MovementSegment {
  target: Point
  from: Point
  to: Point
  seconds: number
  grade: number
  speed: number
  terrainPercent: number
  rate: number
}

export interface BodySecond {
  deficitMl: number
  thirsty: boolean
  rate: number
  drink: number
  loss: number
  spent: number
}

export interface WaterObservationEvent {
  kind: 'water observation'
  minute: number
  foragerId: number
  origin: Point
  radiusCm: number
  cells: number[]
  banks: BankMemory[]
  far: boolean
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

export type WaterEvent = WaterObservationEvent | DrinkEvent | RouteFailureEvent

/** The three foods: berries from bushes, hazelnuts from hazels, and fish from the lake. */
export type FoodKind = 'berries' | 'nuts' | 'fish'

/** Carried food in a lot of one food taken in one minute: its food, its kilocalories and the minute it was taken. */
export interface FoodLot {
  food: FoodKind
  kcal: number
  harvestTick: number
}

/**
 * The valley's configuration. Lengths are whole centimetres, food and energy whole kilocalories, and wood whole
 * kilograms, so every balance is exact. Rates and costs stay per hour; a forager pays or takes them second by second.
 */
export interface ValleyConfig extends HydrationConfig {
  daysPerYear: number
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
  /** A forager's eye above the ground, and the step at which a line of sight is checked against the ground. */
  eyeHeightCm: number
  sightStepCm: number
  /** Scattered starts lie within the square this wide round the land's centre. */
  startAreaCm: number
  thicketCount: number
  bushesPerThicket: number
  thicketRadiusCm: number
  /** Bushes in a thicket stand at least this far apart. */
  bushSpacingCm: number
  bushCapacityKcal: number
  initialBushKcal: number
  /** Berries a bush grows in a year, spread evenly over the year. */
  bushRegrowthKcalPerYear: number
  /** Sticks a bush holds, in kilograms, gathered by hand like the dead branches under a tree. */
  bushCapacityWood: number
  initialBushWood: number
  /** Sticks a bush grows in a decade, spread evenly over it: a bush grows less than a kilogram of wood a year. */
  bushRegrowthWoodPerDecade: number
  /** Hazel thickets, a fourth kind of site, of hazels holding nuts, gathered and cracked by hand. */
  hazelThicketCount: number
  hazelsPerThicket: number
  hazelThicketRadiusCm: number
  hazelSpacingCm: number
  hazelCapacityKcal: number
  initialHazelKcal: number
  /** Nuts a hazel grows in a year, spread evenly over the year. */
  hazelRegrowthKcalPerYear: number
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
  treesPerStand: number
  standRadiusCm: number
  treeSpacingCm: number
  /** Dead branches lying under a standing tree, in kilograms, gathered by hand. A felled tree gains none. */
  treeCapacityWood: number
  initialTreeWood: number
  /** Dead branches a standing tree drops in a year, spread evenly over the year. */
  treeDeadfallWoodPerYear: number
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
  /** A forager judges a walk's climb at this many seconds a metre, by Naismith's rule. */
  climbSecondsPerMetre: number
  /** Walking speed falls by this many thousandths for each body mass carried. */
  loadSlowdownPerMille: number
  reserveMaxKcal: number
  initialReserveKcal: number
  hungryBelowKcal: number
  satiatedAtKcal: number
  /** The number of foragers at the start. There are no births. */
  bandSize: number
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
  /** The valley is divided into square places this wide, which a forager remembers having seen. */
  placeCm: number
  /** A thicket or stand not checked for this many hours is worth checking again. */
  exploreAfterHours: number
  /** By day a forager sees thickets, stands, other foragers and flags this far; at night only `perceptionRadiusCm`. */
  sightRadiusCm: number
  /** A forager's body, against which its load is weighed. */
  bodyKg: number
  /** Carried berries weigh a kilogram for every this many kilocalories. */
  berryKcalPerKg: number
  /** Wood a group's fire burns in a night hour. */
  campfireWoodPerHour: number
  /** Outcrops, a third kind of site, each with stone spots holding stones that never come back. */
  outcropCount: number
  stonesPerOutcrop: number
  outcropRadiusCm: number
  stoneSpacingCm: number
  stonesPerSpot: number
  /**
   * Logs a standing tree holds. Cutting the first fells it whole, and the rest are cut from the trunk where it lies. A
   * stump, with no logs or branches left, stands again whole at the first midnight `treeRegrowthDays` after it fell.
   */
  logsPerTree: number
  treeRegrowthDays: number
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

/** What a forager remembers of every plant of one kind: the stock it last saw and the minute it saw it. */
export interface PlantMemory {
  stock: Int32Array
  seen: Int32Array
}

export interface Forager extends Hydration {
  waterObservations: WaterObservationEvent[]
  groundKnowledge: GroundKnowledge
  knownBanks: Map<number, BankMemory>
  fishMemory: Map<number, { stock: number; capacity: number; minute: number }>
  route: Point[]
  routeRevision: number
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
  /** The food plant it works for food, or a negative encoded bank ID for fishing. */
  targetFoodId: number | null
  targetWoodId: number | null
  /** For each food plant, the berries or nuts it last saw there. */
  foodMemory: PlantMemory
  woodMemory: PlantMemory
  /** The logs on each tree and the stones on each stone spot, as it last saw them from afar. */
  logMemory: PlantMemory
  stoneMemory: PlantMemory
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
  costRemainder: number
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
  /** For each place, the first minute it lay wholly in view, or −1 if never. */
  placeSeen: Int32Array
  /** How many places it has ever seen. */
  placesSeen: number
  /** The groups whose flags it has seen and not since found gone. */
  knownFlags: number[]
  /** The place it is walking to explore or search, if any. */
  exploreTarget: number | null
  /** For each site, thickets, stands then outcrops, 1 if it has spotted it. */
  siteKnown: Uint8Array
  /** For each site, the last minute it stood close enough to see every plant in it, or −1 if never. */
  siteChecked: Int32Array
  /** The place it last looked round from by long sight, or −1 since dark, and the minute it did. */
  farPlace: number
  farMinute: number
  /** The height it has climbed since minute 0, in whole centimetres. */
  climbedCm: number
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
  | 'checking'
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

/** One forager's minute. Its seconds add up to 60. */
export interface ActionEvent {
  fishBodyId: number | null
  fishBankId: number | null
  fishExpectedRate: number
  waterDeficitBeforeMl: number
  waterDeficitAfterMl: number
  drinkSeconds: number
  observations: WaterObservationEvent[]
  routeFailed: boolean
  segments: MovementSegment[]
  bodySeconds: BodySecond[]
  drinkBankId: number | null
  waterLostMl: number
  waterDrunkMl: number
  inactiveSeconds: number
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
  /** What it walked towards or worked, if any: a food plant or a negative encoded bank ID for fishing, a wood plant for wood. */
  targetId: number | null
  /** What it worked this minute, if any. */
  plantId: number | null
  /** The food it worked for this minute, if it worked for food, and the stock of its source as it began. */
  food: FoodKind | null
  sourceStockBefore: number
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
  /** Asleep with neither a lit fire nor a whole hut, when that costs more. */
  sleptCold: boolean
  /** How warm it slept, or null if it did not sleep. */
  warmth: Warmth | null
  /** Its group at the end of its turn. */
  groupId: number | null
  /** The place it walked towards to explore, search or seek company, if any. */
  placeId: number | null
  /** The site it walked towards to check or search, if any. */
  siteId: number | null
  /** What it carried at the start of its action: the wood of its trip, and its food of each kind in kilocalories. */
  loadWood: number
  loadBerriesKcal: number
  loadNutsKcal: number
  loadFishKcal: number
  /** The point it walked towards, if it walked. */
  walkTarget: Point | null
  /** Its speed for that load on the flat, and its walking speed on the grade it walked, in centimetres a second. */
  loadSpeedCmPerSecond: number
  speedCmPerSecond: number
  /** The grade ahead of it as it set out, in whole percent; the terrain factor of the ground it set out from; the height it climbed. */
  gradePercent: number
  terrainPercent: number
  climbCm: number
  /** The group whose fire it slept by, if it slept as a member; null if it tended its own fire or did not sleep. */
  fireGroupId: number | null
  /** Its log at the start of its action, which slows it at `logKg`. */
  loadLog: number
  /** Work for its hut this minute, and the tree or stone spot it worked or walked towards. */
  task: HutTask | null
  treeId: number | null
  stoneId: number | null
  /** A log it cut and whether that cut felled the tree, a stone it picked up, and a log it laid in its hut this minute. */
  cutLog: boolean
  felled: boolean
  tookStone: boolean
  laidLog: boolean
  /** Asleep in its whole hut. */
  inHut: boolean
}

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

export type ValleyEvent =
  | WaterEvent
  | ActionEvent
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
  logStock: Int32Array
  felledMinute: Int32Array
  lastWaterEvents: WaterEvent[]
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
  /** Every tree's logs, the minute it was felled or −1 while it stands, and every stone spot's stones, by ID. */
  treeLogs: Int32Array
  treeFelledMinute: Int32Array
  stoneStock: Int32Array
  foragers: Forager[]
  /** Every hut ever begun, by ID. */
  huts: Hut[]
  /** Every group ever founded, by ID. */
  groups: Group[]
  totals: ValleyTotals
  /** The actions of the last minute run, in turn order. */
  lastEvents: ActionEvent[]
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
