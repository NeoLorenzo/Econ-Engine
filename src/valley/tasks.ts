import { sleepCostOf } from './work'
import type { ActionReason, Forager, TaskKind, TaskRecord, ValleyConfig, Warmth } from './types'

export function taskRates(config: ValleyConfig, _person: Forager, kind: TaskKind, warmth: Warmth) {
  const energyPerHour =
    kind === 'sleep'
      ? sleepCostOf(config, warmth)
      : kind === 'walk'
        ? config.walkKcalPerHour
        : kind === 'pick' || kind === 'nuts' || kind === 'fish'
          ? config.pickKcalPerHour
          : kind === 'gather'
            ? config.gatherKcalPerHour
            : kind === 'cut'
              ? config.chopKcalPerHour
              : kind === 'make'
                ? config.makeKcalPerHour
                : config.restKcalPerHour
  return {
    energyPerHour,
    waterPerHour:
      config.waterBaseMlPerDay / 24 + config.waterExtraMlPerKcal * Math.max(0, energyPerHour - config.restKcalPerHour),
  }
}

export function startTask(
  config: ValleyConfig,
  person: Forager,
  kind: TaskKind,
  minute: number,
  endMinute: number,
  placeId: number,
  routeId: number,
  reason: ActionReason,
  warmth: Warmth = 'cold',
): TaskRecord {
  if (!Number.isSafeInteger(endMinute) || endMinute <= minute)
    throw new Error('A task must end at a later safe integer minute')
  return {
    kind,
    startMinute: minute,
    endMinute,
    placeId,
    routeId,
    reason,
    ...taskRates(config, person, kind, warmth),
    waterBaseMlPerDay: config.waterBaseMlPerDay,
    waterExtraMlPerKcal: config.waterExtraMlPerKcal,
    restKcalPerHour: config.restKcalPerHour,
    drinkMlPerMinute: config.drinkMlPerSecond * 60,
    startEnergyKcal: person.energyKcal,
    startEnergyRemainder: person.energyRemainder,
    startEnergyTimeRemainder: person.energyTimeRemainder,
    startWaterTimeRemainder: person.waterTimeRemainder,
    startWaterMl: person.waterDeficitMl,
    startWaterRemainder: person.waterBaseRemainder,
    startWaterActivityRemainder: person.waterActivityRemainder,
    productionPerHour: 0,
  }
}
