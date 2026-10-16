import type { FoodLot } from '../life/types'

export type { FoodLot }

/**
 * Life 5's configuration, with Life 6's groups, scattered starts and exploring, Life 7's sight and loads, and Life 8's
 * shared fire. Lengths
 * are whole centimetres, food and energy whole kilocalories, and wood whole kilograms, so every balance is exact.
 * Rates and costs stay per hour; a forager pays or takes them second by second.
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
  /** Foragers without a group seek company, form groups when they meet, and swap only within their group. */
  groups: boolean
  /** Foragers start at scattered points, each its own hearth, rather than on a spiral around the camp. */
  scattered: boolean
  /** Foragers whose needs are met explore places they have not seen for `exploreAfterHours`. */
  explore: boolean
  /** Foragers start having seen every plant and place, as in Life 5. */
  knowValley: boolean
  /** Scattered starts lie at least this far apart. */
  startSpacingCm: number
  /** The valley is divided into square places this wide, which a forager remembers having seen. */
  placeCm: number
  /**
   * A place not seen for this many hours is worth exploring again; with `checkSites`, a site not checked for this long
   * is worth checking again.
   */
  exploreAfterHours: number
  /** By day a forager sees thickets, stands, other foragers and flags this far; at night only `perceptionRadiusCm`. */
  sightRadiusCm: number
  /** Foragers remember thickets and stands, check them when idle, search them first, and never re-explore ground. */
  checkSites: boolean
  /** A load slows a forager's walk, so each metre walked costs more. */
  carryCost: boolean
  /** A forager's body, against which its load slows it. */
  bodyKg: number
  /** Carried berries weigh a kilogram for every this many kilocalories. */
  berryKcalPerKg: number
  /** A forager that is not hungry takes a full load home before anything else. */
  loadHome: boolean
  /** Each group keeps one fire at its flag, which warms its members and replaces their own fires. */
  sharedFire: boolean
  /** Wood a group's fire burns in a night hour. */
  campfireWoodPerHour: number
  /** A group's fire burns `campfireWoodPerHour` for each living member, rather than once. */
  campfirePerMember: boolean
  /** A member at its hearth puts its spare wood into the fire, as well as wood from its stock when the fire is low. */
  feedSpare: boolean
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
  /** Each forager's starting hearth, by forager ID. A forager's hearth moves when it joins a group. */
  hearths: Point[]
  bushIndex: PlantIndex
  treeIndex: PlantIndex
}

export type Good = 'food' | 'wood'

/** A group: its flag, when it was founded and dissolved, and its members in order of joining. */
export interface Group {
  id: number
  flag: Point
  foundedMinute: number
  dissolvedMinute: number | null
  /** Every forager that ever joined, in order of joining; slot `i` of the spiral around the flag went to `members[i]`. */
  members: number[]
  /** With `sharedFire`: the wood in its fire, and whether the fire is lit this hour. */
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
  /** The wood it has put into any group's fire, and the minutes it has slept warm by one. */
  fireGiven: number
  warmByFireMinutes: number
  swapTotals: SwapTotals
  /** Its group, or null if it has none, and the minute it joined or founded it. */
  groupId: number | null
  joinedMinute: number | null
  /** For each place, the last minute it lay wholly in view (with `checkSites`, the first), or −1 if never. */
  placeSeen: Int32Array
  /** How many places it has ever seen. */
  placesSeen: number
  /** The groups whose flags it has seen and not since found gone. */
  knownFlags: number[]
  /** The place it is walking to explore or search, if any. */
  exploreTarget: number | null
  /** For each site, thickets then stands, 1 if it has spotted it. */
  siteKnown: Uint8Array
  /** For each site, the last minute it stood close enough to see every plant in it, or −1 if never. */
  siteChecked: Int32Array
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
  | 'seeking company'
  | 'waiting for company'
  | 'exploring'
  | 'searching'
  | 'checking'
  | 'taking a load home'

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
  /** Its group at the end of its turn. */
  groupId: number | null
  /** The place it walked towards to explore, search or seek company, if any. */
  placeId: number | null
  /** The site it walked towards to check or search, if any. */
  siteId: number | null
  /** What it carried at the start of its action: the wood of its trip, and its berries in kilocalories. */
  loadWood: number
  loadBerriesKcal: number
  /** Its walking speed for that load, in centimetres a second. */
  speedCmPerSecond: number
  /** The group whose fire it slept by, if it slept as a member; null if it tended its own fire or did not sleep. */
  fireGroupId: number | null
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
  ActionEvent | DeathEvent | SwapEvent | QuoteEvent | PracticeEvent | GroupEvent | FireEvent | FeedEvent

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
  /** Recent events, one array per day, oldest first, at most `EVENT_HISTORY_DAYS` days. */
  eventDays: ValleyEvent[][]
  days: DaySummary[]
  today: DaySummary
}
