import type { ValleyConfig } from './types'

/**
 * The canonical Life 8 valley: 600 m square, with 32 thickets of 60 bushes and 8 stands of 8 trees, and a band of 8
 * born alike, who bring firewood home in loads of 30 kg, swap wood for food and get better at what they practise.
 * They start scattered and form groups when they meet. By day they see across the valley, check the thickets and
 * stands they know when idle, walk more slowly under a load, and take a full load home. Each group keeps one fire at
 * its flag, which warms every member and which members feed.
 */
export const VALLEY_DEFAULT_CONFIG: ValleyConfig = {
  seed: 20260813,
  valleySizeCm: 60_000,
  thicketCount: 32,
  bushesPerThicket: 60,
  thicketRadiusCm: 1_200,
  bushSpacingCm: 200,
  bushCapacityKcal: 400,
  initialBushKcal: 400,
  bushRegrowthKcalPerDay: 20,
  standCount: 8,
  treesPerStand: 8,
  standRadiusCm: 1_500,
  treeSpacingCm: 400,
  treeCapacityWood: 25,
  initialTreeWood: 25,
  treeRegrowthWoodPerDay: 6,
  siteSpacingCm: 5_000,
  siteMarginCm: 3_000,
  campClearingCm: 4_000,
  hearthSpacingCm: 300,
  walkCmPerSecond: 125,
  reachCm: 100,
  perceptionRadiusCm: 2_500,
  talkRadiusCm: 2_000,
  dawnHour: 6,
  duskHour: 18,
  forageKcalPerHour: 1_200,
  woodPerHour: 24,
  sleepKcalPerHour: 60,
  restKcalPerHour: 90,
  forageCostKcalPerHour: 300,
  travelKcalPerHour: 300,
  reserveMaxKcal: 20_000,
  initialReserveKcal: 16_000,
  hungryBelowKcal: 14_000,
  satiatedAtKcal: 18_000,
  bandSize: 8,
  shelfLifeHours: 48,
  fireWoodPerHour: 1,
  coldSleepKcalPerHour: 150,
  woodStockNights: 2,
  woodLoad: 30,
  skillMinPercent: 100,
  skillMaxPercent: 100,
  termsMemoryHours: 24,
  practiceDays: 30,
  practiceHalfHours: 60,
  practiceMinPercent: 50,
  practiceMaxPercent: 150,
  startPracticeHoursPerDay: 2,
  scattered: true,
  startSpacingCm: 5_000,
  placeCm: 3_000,
  exploreAfterHours: 24,
  sightRadiusCm: 100_000,
  bodyKg: 60,
  berryKcalPerKg: 500,
  sharedFire: true,
  campfireWoodPerHour: 1,
  campfirePerMember: false,
  feedSpare: true,
}

const BOOLEAN_KEYS = new Set(['scattered', 'sharedFire', 'campfirePerMember', 'feedSpare'])

/** The points of the square spiral around the camp: the 8 of the first ring, then the 16 of the second, and so on. */
export function spiralOffsets(count: number) {
  const points: [number, number][] = []
  for (let ring = 1; points.length < count; ring += 1) {
    for (let x = -ring; x <= ring; x += 1) points.push([x, -ring])
    for (let y = -ring + 1; y <= ring; y += 1) points.push([ring, y])
    for (let x = ring - 1; x >= -ring; x -= 1) points.push([x, ring])
    for (let y = ring - 1; y >= -ring + 1; y -= 1) points.push([-ring, y])
  }
  return points.slice(0, count)
}

/** Returns every rule the configuration breaks, except whether its layout can be drawn, which `createValley` finds. */
export function valleyConfigErrors(config: ValleyConfig): string[] {
  const errors: string[] = []
  for (const [key, value] of Object.entries(config)) {
    if (BOOLEAN_KEYS.has(key)) {
      if (typeof value !== 'boolean') errors.push(`${key} must be true or false`)
    } else if (!Number.isInteger(value)) errors.push(`${key} must be an integer`)
  }
  if (errors.length) return errors
  const positive: (keyof ValleyConfig)[] = [
    'valleySizeCm',
    'thicketCount',
    'bushesPerThicket',
    'thicketRadiusCm',
    'bushSpacingCm',
    'bushCapacityKcal',
    'standRadiusCm',
    'treeSpacingCm',
    'treeCapacityWood',
    'siteSpacingCm',
    'campClearingCm',
    'hearthSpacingCm',
    'walkCmPerSecond',
    'reachCm',
    'perceptionRadiusCm',
    'talkRadiusCm',
    'forageKcalPerHour',
    'woodPerHour',
    'bandSize',
    'fireWoodPerHour',
    'woodStockNights',
    'practiceDays',
    'practiceHalfHours',
    'startSpacingCm',
    'placeCm',
    'exploreAfterHours',
    'sightRadiusCm',
    'bodyKg',
    'berryKcalPerKg',
    'campfireWoodPerHour',
  ]
  for (const key of positive) if ((config[key] as number) <= 0) errors.push(`${key} must be positive`)
  const notNegative: (keyof ValleyConfig)[] = [
    'bushRegrowthKcalPerDay',
    'standCount',
    'treesPerStand',
    'treeRegrowthWoodPerDay',
    'siteMarginCm',
    'sleepKcalPerHour',
    'restKcalPerHour',
    'forageCostKcalPerHour',
    'travelKcalPerHour',
    'shelfLifeHours',
    'woodLoad',
    'termsMemoryHours',
  ]
  for (const key of notNegative) if ((config[key] as number) < 0) errors.push(`${key} must not be negative`)
  if (errors.length) return errors
  if (config.reachCm >= config.perceptionRadiusCm) errors.push('reachCm must be less than perceptionRadiusCm')
  if (config.initialBushKcal < 0 || config.initialBushKcal > config.bushCapacityKcal)
    errors.push('initialBushKcal must be between 0 and bushCapacityKcal')
  if (config.initialTreeWood < 0 || config.initialTreeWood > config.treeCapacityWood)
    errors.push('initialTreeWood must be between 0 and treeCapacityWood')
  if (config.dawnHour < 0 || config.dawnHour >= config.duskHour || config.duskHour > 24)
    errors.push('Hours must satisfy 0 ≤ dawnHour < duskHour ≤ 24')
  if (
    config.hungryBelowKcal <= 0 ||
    config.hungryBelowKcal >= config.satiatedAtKcal ||
    config.satiatedAtKcal > config.reserveMaxKcal
  )
    errors.push('Thresholds must satisfy 0 < hungryBelowKcal < satiatedAtKcal ≤ reserveMaxKcal')
  if (config.initialReserveKcal <= 0 || config.initialReserveKcal > config.reserveMaxKcal)
    errors.push('initialReserveKcal must be between 1 and reserveMaxKcal')
  if (config.coldSleepKcalPerHour < config.sleepKcalPerHour)
    errors.push('coldSleepKcalPerHour must be at least sleepKcalPerHour')
  if (config.startPracticeHoursPerDay < 0 || config.startPracticeHoursPerDay > 24)
    errors.push('startPracticeHoursPerDay must be between 0 and 24')
  const practiceRangeOk = config.practiceMinPercent >= 1 && config.practiceMinPercent <= config.practiceMaxPercent
  if (!practiceRangeOk) errors.push('Practice must satisfy 1 ≤ practiceMinPercent ≤ practiceMaxPercent')
  const skillRangeOk = config.skillMinPercent >= 1 && config.skillMinPercent <= config.skillMaxPercent
  if (!skillRangeOk) errors.push('Skills must satisfy 1 ≤ skillMinPercent ≤ skillMaxPercent')
  if (practiceRangeOk && skillRangeOk) {
    const low = config.practiceMinPercent
    const high = config.practiceMaxPercent
    const lowest = (base: number) => Math.floor((base * config.skillMinPercent * low) / 10_000)
    const highest = (base: number) => Math.floor((base * config.skillMaxPercent * high) / 10_000)
    if (lowest(config.forageKcalPerHour) < 1 || lowest(config.woodPerHour) < 1)
      errors.push('The lowest picking and gathering rates must be at least 1')
    // A minute's work at the fastest rate must fit on a plant, or no full plant could ever be worked.
    if (Math.ceil(highest(config.forageKcalPerHour) / 60) > config.bushCapacityKcal)
      errors.push('A bush must hold a minute of picking at the fastest rate')
    if (Math.ceil(highest(config.woodPerHour) / 60) > config.treeCapacityWood)
      errors.push('A tree must hold a minute of gathering at the fastest rate')
  }
  // A band that starts around the camp must have its hearths in the camp's clearing, clear of every plant.
  if (!config.scattered) {
    const [outerX, outerY] = spiralOffsets(config.bandSize).at(-1)!
    const outer = Math.max(Math.abs(outerX), Math.abs(outerY)) * config.hearthSpacingCm
    const clear = config.campClearingCm - Math.max(config.thicketRadiusCm, config.standRadiusCm)
    if (2 * outer * outer > clear * clear) errors.push('The band’s hearths must fit inside the camp’s clearing')
    if (config.bandSize < 2) errors.push('A band that starts as one group needs at least two foragers')
  }
  // Standing at a place's centre must show all of it, or exploring could never see it.
  if (config.placeCm ** 2 > 2 * config.perceptionRadiusCm ** 2)
    errors.push('A place must fit in a forager’s view: placeCm² ≤ 2 · perceptionRadiusCm²')
  if (config.sightRadiusCm < config.perceptionRadiusCm)
    errors.push('Long sight must reach at least as far as close sight: sightRadiusCm ≥ perceptionRadiusCm')
  // A site is checked from within perceptionRadiusCm − its radius of its centre, which must leave room to stand.
  if (config.perceptionRadiusCm <= Math.max(config.thicketRadiusCm, config.standRadiusCm))
    errors.push('A site must fit in close sight to be checked: perceptionRadiusCm > thicketRadiusCm and standRadiusCm')
  if (2 * config.siteMarginCm >= config.valleySizeCm) errors.push('siteMarginCm must leave room for sites')
  return errors
}

export function resolveValleyConfig(overrides: Partial<ValleyConfig> = {}): ValleyConfig {
  const config = { ...VALLEY_DEFAULT_CONFIG, ...overrides }
  const errors = valleyConfigErrors(config)
  if (errors.length) throw new Error(`Invalid valley configuration: ${errors.join('; ')}`)
  return config
}
