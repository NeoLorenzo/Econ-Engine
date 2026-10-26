import { personConfig } from './nature'
import { loadKg, loadOf } from './forager'
import { positionAlong } from './routes'
import type { ValleyState, Point } from './types'
import { sleepCostOf } from './work'
import type { ActionReason, Forager, TaskKind, TaskRecord, ValleyConfig, Warmth } from './types'

export function taskRates(config: ValleyConfig, person: Forager, kind: TaskKind, warmth: Warmth) {
  config = personConfig(config, person)
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
    startTripWood: person.tripWood,
    startLoadKg: loadKg(config, loadOf(person)),
    startMinute: minute,
    endMinute,
    placeId,
    routeId,
    reason,
    ...taskRates(config, person, kind, warmth),
    waterBaseMlPerDay: config.waterBaseMlPerDay,
    waterExtraMlPerKcal: config.waterExtraMlPerKcal,
    restKcalPerHour: person.rates.restKcalPerHour,
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

export function positionAt(state: Pick<ValleyState, 'routes'>, person: Forager, minute: number): Point {
  const task = person.task
  if (task?.kind === 'walk') {
    const route = state.routes[task.routeId]
    if (route?.segments.length) return positionAlong(route, minute - task.startMinute)
  }
  return { x: person.x, y: person.y }
}
