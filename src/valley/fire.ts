import { MINUTES_PER_DAY, isDaylight } from './forager'
import { livingMembers } from './social'
import { nightHours, woodTarget } from './trade'
import type { FeedEvent, FireEvent, Forager, Group, ValleyConfig, ValleyState } from './types'

// Life 8: one fire at each group's flag, which warms every member asleep at the group's hearths, burns at the start of
// every night hour, goes out when it holds too little, and is fed by members at their hearths.

/** The wood a group's fire burns in a night hour: `campfireWoodPerHour`, or that for each living member. */
export const campfireBurn = (state: Pick<ValleyState, 'config' | 'foragers'>, group: Group) =>
  state.config.campfirePerMember
    ? state.config.campfireWoodPerHour * livingMembers(state, group).length
    : state.config.campfireWoodPerHour

/** The night hours after the one minute `minute` falls in, or a whole night by day. */
export function nightHoursLeft(config: ValleyConfig, minute: number) {
  if (isDaylight(config, minute)) return nightHours(config)
  const hour = Math.floor((minute % MINUTES_PER_DAY) / 60)
  return hour >= config.duskHour ? 24 - hour - 1 + config.dawnHour : config.dawnHour - hour - 1
}

/**
 * What a member at its hearth puts into a fire that burns `burn` an hour: its spare wood, with `feedSpare`; and, if
 * the fire holds less than the rest of the night needs, wood from its stock up to what the fire lacks, as far as it
 * holds. Returns the wood given, the part of it that was spare, and whether the fire was low.
 */
export function feedAmount(config: ValleyConfig, wood: number, fireWood: number, burn: number, minute: number) {
  const need = burn * nightHoursLeft(config, minute)
  const spare = config.feedSpare ? Math.max(0, wood - woodTarget(config)) : 0
  const low = fireWood < need
  const given = low ? Math.max(spare, Math.min(wood, need - fireWood)) : spare
  return { wood: given, spareWood: Math.min(given, spare), low }
}

/**
 * The fires at the start of minute `minute`, run at the start of every hour before turns. At night each standing
 * group's fire burns its hour's wood and is lit if it holds that much, and is out otherwise; by day every fire is
 * unlit. Changes the groups in place and returns the night's fire events.
 */
export function burnFires(state: ValleyState, minute: number): FireEvent[] {
  const night = !isDaylight(state.config, minute)
  const fires: FireEvent[] = []
  for (const group of state.groups) {
    if (group.dissolvedMinute !== null) continue
    if (!night) {
      group.fireLit = false
      continue
    }
    const burn = campfireBurn(state, group)
    const lit = group.fireWood >= burn
    if (lit) {
      group.fireWood -= burn
      group.fireBurned += burn
      group.litHours += 1
    } else group.darkHours += 1
    group.fireLit = lit
    fires.push({
      kind: 'fire',
      minute,
      groupId: group.id,
      burned: lit ? burn : 0,
      lit,
      fireWoodAfter: group.fireWood,
    })
  }
  return fires
}

/** A member at its hearth feeds its group's fire. Changes the working copies in place; null if it gives nothing. */
export function feedFire(state: ValleyState, group: Group, forager: Forager, minute: number): FeedEvent | null {
  const { config } = state
  const burnPerHour = campfireBurn(state, group)
  const amount = feedAmount(config, forager.wood, group.fireWood, burnPerHour, minute)
  if (amount.wood <= 0) return null
  const event: FeedEvent = {
    kind: 'feed',
    minute,
    groupId: group.id,
    foragerId: forager.id,
    wood: amount.wood,
    spareWood: amount.spareWood,
    low: amount.low,
    woodBefore: forager.wood,
    burnPerHour,
    fireWoodBefore: group.fireWood,
    fireWoodAfter: group.fireWood + amount.wood,
  }
  forager.wood -= amount.wood
  forager.fireGiven += amount.wood
  group.fireWood += amount.wood
  const slot = group.members.indexOf(forager.id)
  group.given = group.given.map((given, index) => (index === slot ? given + amount.wood : given))
  return event
}

/** Whether a forager sleeps by its group's fire rather than its own: with `sharedFire`, while it has a group. */
export const sleepsByGroupFire = (config: ValleyConfig, forager: Forager) =>
  config.sharedFire && forager.groupId !== null
