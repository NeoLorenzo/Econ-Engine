export interface HydrationConfig {
  waterBaseMlPerDay: number
  waterExtraMlPerKcal: number
  thirstBodyPerMille: number
  urgentThirstBodyPerMille: number
  fatalWaterLossBodyPerMille: number
  initialWaterDeficitMl: number
  drinkStopMl: number
  drinkMlPerSecond: number
  bodyKg: number
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

export const waterThresholds = (config: HydrationConfig) => ({
  thirsty: Math.floor(config.bodyKg * config.thirstBodyPerMille),
  urgent: Math.floor(config.bodyKg * config.urgentThirstBodyPerMille),
  fatal: Math.floor(config.bodyKg * config.fatalWaterLossBodyPerMille),
})

export function newHydration(config: HydrationConfig): Hydration {
  return {
    waterDeficitMl: config.initialWaterDeficitMl,
    waterBaseRemainder: 0,
    waterActivityRemainder: 0,
    waterLostMl: 0,
    waterDrunkMl: 0,
    thirsty: false,
  }
}

export function updateThirst(config: HydrationConfig, body: Hydration) {
  if (body.waterDeficitMl >= waterThresholds(config).thirsty) body.thirsty = true
  else if (body.waterDeficitMl <= config.drinkStopMl) body.thirsty = false
}

/** One living second: drinking, net loss, hysteresis, then fatal crossing. Energy rate is in kcal/hour. */
export function waterSecond(config: HydrationConfig, body: Hydration, energyRate: number, drinking: boolean) {
  const drink = drinking ? Math.min(body.waterDeficitMl, config.drinkMlPerSecond) : 0
  body.waterDeficitMl -= drink
  const base = body.waterBaseRemainder + config.waterBaseMlPerDay
  const activity =
    body.waterActivityRemainder + config.waterExtraMlPerKcal * Math.max(0, energyRate - config.restKcalPerHour)
  const loss = Math.floor(base / 86_400) + Math.floor(activity / 3_600)
  body.waterBaseRemainder = base % 86_400
  body.waterActivityRemainder = activity % 3_600
  body.waterDeficitMl += loss
  body.waterLostMl += loss
  body.waterDrunkMl += drink
  updateThirst(config, body)
  return { drink, loss, fatal: body.waterDeficitMl >= waterThresholds(config).fatal }
}
