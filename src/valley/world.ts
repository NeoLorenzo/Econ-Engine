import { fadeTies } from './ties'
import { personConfig } from './nature'
import { burnFires } from './fire'
import { isDaylight, atHearth } from './forager'
import { tendFire, warmthOf, sleepCostOf } from './work'
import { hutWhole } from './huts'
import { firstThresholdMinute } from './body'
import { MINUTES_PER_DAY } from './calendar'
import { regrowPlaces } from './places'
import { fishGrowth } from './fish'
import { practiceDay } from './practice'
import { weatherHuts } from './huts'
import type { ValleyState, ValleyEvent } from './types'
export function worldWake(state: ValleyState, minute: number): ValleyEvent[] {
  const events: ValleyEvent[] = [{ kind: 'world', minute }]
  if (minute % MINUTES_PER_DAY === 0) {
    for (const person of state.foragers) if (person.alive) events.push(practiceDay(state.config, person, minute))
    fadeTies(state)
    events.push(...weatherHuts(state, minute))
    const beforeFood = state.foodStock.slice(),
      beforeWood = state.woodStock.slice(),
      beforeLogs = state.logStock.slice()
    const grown = regrowPlaces(state, minute)
    state.totals.regrownKcal += grown.kcal
    state.totals.regrownWood += grown.wood
    state.totals.regrownLogs += grown.logs
    for (let id = 0; id < state.layout.places.count; id += 1) {
      const kcal = state.foodStock[id]! - beforeFood[id]!,
        wood = state.woodStock[id]! - beforeWood[id]!,
        logs = state.logStock[id]! - beforeLogs[id]!
      if (kcal || wood || logs) events.push({ kind: 'regrowth', minute, placeId: id, kcal, wood, logs })
    }
    for (const fish of state.fish) {
      const growth = fishGrowth(
        fish.capacity,
        fish.stock,
        fish.remainder,
        state.config.fishGrowthPercentPerYear,
        state.config.daysPerYear,
      )
      fish.stock += growth.grown
      fish.grown += growth.grown
      fish.remainder = growth.remainder
      state.fishKcal += growth.grown
      state.totals.fishGrownKcal += growth.grown
      events.push({
        kind: 'fish-regrowth',
        minute,
        bodyId: fish.bodyId,
        kcal: growth.grown,
        remainder: growth.remainder,
      })
    }
  }
  const fires = burnFires(state, minute)
  events.push(...fires)
  for (const fire of fires) {
    state.totals.burnedWood += fire.burned
    state.today.burnedWood += fire.burned
  }
  for (const person of state.foragers) {
    const task = person.task
    if (!person.alive || task?.kind !== 'sleep') continue
    if (!isDaylight(state.config, minute) && person.groupId === null && atHearth(person)) {
      const burned = tendFire(state.config, person, minute)
      state.totals.burnedWood += burned
      state.today.burnedWood += burned
      events.push({ kind: 'fire', minute, foragerId: person.id, burned, lit: person.warm })
    }
    const fire = person.groupId === null ? person.warm : state.groups[person.groupId]!.fireLit
    const rate = sleepCostOf(personConfig(state.config, person), warmthOf(fire, hutWhole(state, person)))
    const previous = task.rateChanges?.at(-1)?.energyPerHour ?? task.energyPerHour
    if (rate !== previous) {
      task.rateChanges = [...(task.rateChanges ?? []), { minute, energyPerHour: rate }]
      events.push({ kind: 'rate-change', minute, foragerId: person.id, energyPerHour: rate })
      state.queue.cancelPerson(person.id, 'threshold')
      const threshold = firstThresholdMinute(personConfig(state.config, person), task, state.routes)
      if (threshold && threshold.minute < task.endMinute)
        state.queue.schedule({ minute: Math.max(minute, threshold.minute), phase: 1, id: person.id, kind: 'threshold' })
    }
  }
  return events
}
