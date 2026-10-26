import { MINUTES_PER_DAY } from './calendar'
import { energyAt, waterAt } from './body'
import type { Forager, ValleyState } from './types'
/** Measurements of the part of a task within the current day; no person is advanced. */
export function measureTask(state: ValleyState, person: Forager, minute: number) {
  const task = person.task
  if (!task) return
  const from = Math.max(task.startMinute, state.today.day * MINUTES_PER_DAY),
    to = Math.min(minute, task.endMinute)
  if (to <= from) return
  const before = energyAt(task, from, state.routes),
    after = energyAt(task, to, state.routes)
  const wetBefore = waterAt(task, from, state.routes),
    wetAfter = waterAt(task, to, state.routes)
  const spent = Math.max(0, before.kcal) - Math.max(0, after.kcal),
    minutes = to - from,
    seconds = minutes * 60,
    id = person.id
  state.today.spentKcal += spent
  state.today.waterLossMlById[id]! += wetAfter.loss - wetBefore.loss
  state.today.drinkingMlById[id]! += wetAfter.drink - wetBefore.drink
  state.today.maxDeficitMlById[id] = Math.max(state.today.maxDeficitMlById[id]!, wetBefore.ml, wetAfter.ml)
  const action =
    task.kind === 'pick' || task.kind === 'nuts' || task.kind === 'fish'
      ? 'forage'
      : task.kind === 'drink'
        ? 'rest'
        : task.kind
  state.today.seconds[action] += seconds
  if (task.kind === 'walk') {
    state.today.walkSecondsById[id]! += seconds
    state.today.walkKcalById[id]! += spent
  }
  if (task.kind === 'pick' || task.kind === 'nuts' || task.kind === 'fish')
    state.today.forageSecondsById[id]! += seconds
  if (task.kind === 'gather') state.today.gatherSecondsById[id]! += seconds
  if (task.kind === 'cut') state.today.cutSecondsById[id]! += seconds
  if (task.kind === 'make') state.today.makeSecondsById[id]! += seconds
  if (task.groupId !== null && task.groupId !== undefined) state.today.memberMinutes += minutes
  if (task.wholeHut) state.today.hutWholeMinutes += minutes
  if (task.reason === 'seeking water') state.today.seekingWaterSecondsById[id]! += seconds
  if (task.kind === 'drink') state.today.drinkingSecondsById[id]! += seconds
  if (task.kind === 'sleep') {
    state.today.sleepMinutes += minutes
    let cursor = from,
      rate = task.energyPerHour
    const add = (until: number) => {
      if (rate === person.rates.coldSleepKcalPerHour) state.today.coldSleepMinutes += until - cursor
      if (rate === person.rates.hutSleepKcalPerHour || rate === person.rates.sleepKcalPerHour)
        state.today.hutSleepMinutes += until - cursor
      cursor = until
    }
    for (const change of task.rateChanges ?? []) {
      if (change.minute <= from) {
        rate = change.energyPerHour
        continue
      }
      if (change.minute >= to) break
      add(change.minute)
      rate = change.energyPerHour
    }
    add(to)
  }
}
