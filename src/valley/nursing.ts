import { ageOf } from './lifecycle'
import { personConfig } from './nature'
import { waterThresholds } from './body'
import { nextHungry } from './forager'
import { distanceSq } from './geometry'
import { positionAt } from './tasks'
import type { FedEvent, Forager, ValleyState } from './types'

// Life 19's nursing: a child under weaning age who is hungry or thirsty takes from their mother's body, a transfer
// between two real ledgers at one minute. The child wakes, finds their mother within reach and addresses her; at her
// wake-up, her body paid to that minute, the feed moves kcal and the water in milk, and the child is addressed back to
// choose what to do next.

/** Whether a person is under weaning age. */
export const nursling = (state: Pick<ValleyState, 'config'>, person: Forager, minute: number) =>
  ageOf(state.config, person, minute) < state.config.weaningMilliYears

/** Whether a person is under solid-food age: they neither eat a food lot nor drink at a bank. */
export const milkOnly = (state: Pick<ValleyState, 'config'>, person: Forager, minute: number) =>
  ageOf(state.config, person, minute) < state.config.solidFoodMilliYears

/** A person's living mother within talking distance at `minute`, not on a walk; else null. */
export function motherInReach(state: ValleyState, child: Forager, minute: number): Forager | null {
  if (child.motherId === null) return null
  const mother = state.foragers[child.motherId]!
  if (!mother.alive || mother.task?.kind === 'walk') return null
  const a = positionAt(state, mother, minute),
    b = positionAt(state, child, minute)
  return distanceSq(a.x, a.y, b.x, b.y) <= state.config.talkRadiusCm ** 2 ? mother : null
}

/**
 * Whether a child, their body paid at this wake-up, wants a feed: under weaning age, hungry or thirsty, their mother
 * living and within reach, and not yet fed this minute.
 */
export function wantsFeed(state: ValleyState, child: Forager, minute: number) {
  if (child.lastFedMinute === minute || !nursling(state, child, minute)) return false
  const thirsty = child.waterDeficitMl >= waterThresholds(personConfig(state.config, child)).thirsty
  const hungry = nextHungry(personConfig(state.config, child), child.energyKcal, child.hungry)
  if (!hungry && !thirsty) return false
  return motherInReach(state, child, minute) !== null
}

/** The kcal and ml of a feed: as much as brings the child to their satiation, at most `feedKcal` and her energy. */
export function feedAmount(state: Pick<ValleyState, 'config'>, mother: Forager, child: Forager) {
  const kcal = Math.max(0, Math.min(state.config.feedKcal, child.satiationKcal - child.energyKcal, mother.energyKcal))
  const ml = Math.min(child.waterDeficitMl, Math.floor((kcal * state.config.milkMlPerThousandKcal) / 1_000))
  return { kcal, ml }
}

/**
 * At a mother's wake-up, her body paid: feeds each of her children who woke this minute wanting a feed and waits for
 * it. Moves energy and water from her body to theirs and returns the events and the children to address.
 */
export function feedChildren(state: ValleyState, mother: Forager, minute: number) {
  const events: FedEvent[] = [],
    waiting: number[] = []
  for (const child of state.foragers) {
    if (
      child.motherId !== mother.id ||
      !child.alive ||
      child.task !== null ||
      child.lastWakeMinute !== minute ||
      child.lastFedMinute === minute
    )
      continue
    waiting.push(child.id)
    if (!wantsFeed(state, child, minute)) continue
    const { kcal, ml } = feedAmount(state, mother, child)
    child.lastFedMinute = minute
    mother.energyKcal -= kcal
    child.energyKcal += kcal
    child.waterDeficitMl -= ml
    mother.waterDeficitMl += ml
    state.today.nursedKcal += kcal
    events.push({ kind: 'fed', minute, foragerId: child.id, motherId: mother.id, kcal, waterMl: ml })
  }
  return { events, waiting }
}
