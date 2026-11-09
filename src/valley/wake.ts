import { personConfig } from './nature'
import { measureTask } from './summary'
import type { WakeEntry, WakeKind } from './clock'
import { MINUTES_PER_DAY, minuteOfDay } from './calendar'
import { atHearth, chooseTask, isDaylight, routeFor, nextHungry, nutRoomKcal, walkSpeed } from './forager'
import { energyAt, waterAt, firstThresholdMinute, waterThresholds } from './body'
import { startTask, positionAt } from './tasks'
import { nearestFrontier, chunkOf, estimateMinutes } from './routes'
import { observeAt, locatePeople, scheduleArrivals, peopleInChunk } from './perception'
import { rememberWalk, type WalkFound } from './ways'
import { carriedKcal, spoil, addLots, eatCarried, countEaten } from './food'
import { familyDayKcal, putIntoStore, storeKcal, storeTarget, takeFromStore } from './stores'
import { distanceSq } from './geometry'
import { takeFrom } from './places'
import { nextShortOfWood, swap } from './trade'
import { meet, dissolveIfAlone } from './social'
import { ask, countTogether, pairAt } from './ties'
import { layLog, leaveHutIfMoved, shelteredAt } from './huts'
import { feedFire } from './fire'
import { warmthOf, tendFire } from './work'
import { beginAxe, workAxe, cutAt, logCut, exchangeAxes } from './axes'
import { inventAfter, practiceBudget } from './skills'
import { ageOf, birthDue, deliver } from './lifecycle'
import { feedChildren, milkOnly, wantsFeed } from './nursing'
import { canWalk, carrierOf, fireWarms } from './kin'
import type { Forager, ValleyEvent, ValleyState } from './types'
import type { TaskChoice } from './forager'

function bodyWake(state: ValleyState, person: Forager, minute: number) {
  const task = person.task
  if (!task) return { spent: 0, loss: 0, drink: 0 }
  const energy = energyAt(task, minute, state.routes),
    water = waterAt(task, minute, state.routes)
  const spent = person.energyKcal - Math.max(0, energy.kcal)
  person.energyKcal = Math.max(0, energy.kcal)
  person.energyRemainder = energy.remainder
  person.energyTimeRemainder = energy.timeRemainder ?? 0
  person.waterDeficitMl = water.ml
  person.waterBaseRemainder = water.remainder
  person.waterActivityRemainder = water.activityRemainder
  person.waterTimeRemainder = water.timeRemainder
  person.waterLostMl += water.loss
  person.waterDrunkMl += water.drink
  state.totals.metabolizedKcal += spent
  return { spent, loss: water.loss, drink: water.drink }
}
/** Whether a walk goes to a place, a bank point or home, the ends a person keeps ways to. */
function habitualTarget(state: ValleyState, person: Forager, choice: TaskChoice) {
  const target = choice.target!,
    { places } = state.layout
  if (target.x === person.hearth.x && target.y === person.hearth.y) return true
  if (choice.placeId < 0) return false
  const bank = person.knownBanks.get(choice.placeId)
  if (bank && bank.x === target.x && bank.y === target.y) return true
  return choice.placeId < places.count && places.x[choice.placeId] === target.x && places.y[choice.placeId] === target.y
}
function scheduleTask(state: ValleyState, person: Forager, minute: number) {
  let choice = chooseTask(state, person, minute),
    routeId = -1,
    found: WalkFound | null = null
  let end = minute + 60
  if (choice.kind === 'walk' && choice.target) {
    let walk = choice.walk ?? routeFor(state, person, choice.target, habitualTarget(state, person, choice))
    if (!walk) {
      const frontier = nearestFrontier(state.layout.nav, person.knowledge, person)
      if (frontier) {
        walk = routeFor(state, person, frontier)
        choice = { ...choice, target: frontier, placeId: -1 }
      }
    }
    if (walk?.route.segments.length) {
      rememberWalk(state, person, walk, minute)
      if (choice.reason === 'out for a walk') person.leisureMinute = minute
      found = walk
      routeId = state.routes.length
      state.routes.push(walk.route)
      end = minute + walk.route.minutes
    } else choice = { kind: 'rest', placeId: -1, target: null, reason: 'no known route' }
  }
  if (choice.kind === 'sleep')
    end =
      minute -
      minuteOfDay(minute) +
      (minuteOfDay(minute) < state.config.dawnHour * 60 ? 0 : MINUTES_PER_DAY) +
      state.config.dawnHour * 60
  if (choice.kind === 'rest' && isDaylight(state.config, minute))
    end = Math.min(end, minute - minuteOfDay(minute) + state.config.duskHour * 60)
  if (choice.kind === 'drink') {
    const net = state.config.drinkMlPerSecond * 60 - person.waterBaseMlPerDay / 1_440
    end = minute + Math.max(1, Math.ceil((person.waterDeficitMl - state.config.drinkStopMl) / net))
  }
  if (
    choice.kind === 'pick' ||
    choice.kind === 'nuts' ||
    choice.kind === 'fish' ||
    choice.kind === 'gather' ||
    choice.kind === 'store'
  ) {
    const rate = choice.productionPerHour ?? 0,
      stock = choice.expectedStock ?? 0
    const room =
      choice.kind === 'gather'
        ? person.loadCapacityKg - person.tripWood
        : choice.kind === 'store'
          ? nutRoomKcal(state.config, person)
          : Math.max(
              0,
              person.reserveMaxKcal -
                person.energyKcal -
                carriedKcal(person.carried) +
                (choice.desiredCarriedKcal ?? 0),
            )
    const net = choice.kind === 'gather' || choice.kind === 'store' ? rate : rate - person.rates.pickKcalPerHour
    const duration = Math.min(Math.ceil((stock * 60) / Math.max(1, rate)), Math.ceil((room * 60) / Math.max(1, net)))
    const home = atHearth(person)
      ? 0
      : estimateMinutes(state.config, person, person.hearth, walkSpeed(state.config, person) * 60, 0)
    end =
      minute +
      Math.max(
        1,
        Math.min(duration, state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute) - home),
      )
  }
  if (choice.kind === 'eat store') {
    // Taking from the store moves food to the hand, eaten at the next wake-up; it ends when the reserve would be full.
    const rate = state.config.storeKcalPerHour,
      room = Math.max(0, person.reserveMaxKcal - person.energyKcal - carriedKcal(person.carried))
    end =
      minute +
      Math.max(
        1,
        Math.min(
          Math.ceil((storeKcal(person) * 60) / rate),
          Math.ceil((room * 60) / Math.max(1, rate - person.rates.restKcalPerHour)),
        ),
      )
  }
  const beforeEvents: ValleyEvent[] = []
  if (choice.kind === 'make') {
    if (!person.making) beginAxe(state, person, minute, choice.practice === true)
    const making = person.making!
    const left = (making.breakAt >= 0 ? making.breakAt : making.needed) - making.worked
    end =
      minute +
      Math.max(
        1,
        Math.min(
          Math.ceil(left / 60),
          state.config.duskHour * 60 - person.duskMarginMinutes - minuteOfDay(minute),
          choice.practice ? practiceBudget(state.config, person) - person.practicedToday : Infinity,
        ),
      )
  }
  if (choice.kind === 'cut')
    end =
      minute +
      Math.max(
        1,
        Math.min(
          Math.ceil((logCut(state.config) - person.chopRemainder) / (person.axe!.quality * 60)),
          state.config.duskHour * 60 -
            person.duskMarginMinutes -
            minuteOfDay(minute) -
            estimateMinutes(state.config, person, person.hearth, walkSpeed(state.config, person) * 60, 0),
        ),
      )
  if (choice.kind === 'gather' && state.layout.places.kind[choice.placeId] === 3) end = minute + 1
  if (choice.kind === 'sleep' && person.groupId === null) {
    const burned = tendFire(state.config, person, minute)
    if (burned) {
      state.totals.burnedWood += burned
      state.today.burnedWood += burned
      beforeEvents.push({ kind: 'fire', minute, foragerId: person.id, burned, lit: person.warm })
    }
  }
  const fire = fireWarms(state, person)
  const warmth = warmthOf(fire, shelteredAt(state, person))
  person.task = startTask(
    state.config,
    person,
    choice.kind,
    minute,
    Math.max(minute + 1, end),
    choice.kind === 'walk' ? -1 : choice.placeId,
    routeId,
    choice.reason,
    warmth,
  )
  person.task.groupId = person.groupId
  person.task.wholeHut = shelteredAt(state, person)
  person.task.productionPerHour = choice.productionPerHour ?? 0
  if (choice.kind === 'store') {
    person.task.familyKcal = familyDayKcal(state, person, minute, true, true)
    person.task.storeTarget = storeTarget(state.config, person, minute, person.task.familyKcal)
    person.task.storeKcal = storeKcal(person)
    person.task.roomKcal = nutRoomKcal(state.config, person)
  }
  if (choice.kind === 'make') {
    person.task.technique = person.making!.technique
    person.task.practice = choice.practice === true
  }
  state.queue.schedule({ minute: person.task.endMinute, phase: 1, id: person.id, kind: 'end' })
  const threshold = firstThresholdMinute(personConfig(state.config, person), person.task, state.routes)
  if (threshold && threshold.minute < person.task.endMinute)
    state.queue.schedule({ minute: threshold.minute, phase: 1, id: person.id, kind: 'threshold' })
  const events: ValleyEvent[] = [
    ...beforeEvents,
    {
      kind: 'task-start',
      minute,
      foragerId: person.id,
      task: { ...person.task },
      position: { x: person.x, y: person.y },
    },
  ]
  if (choice.kind === 'walk' && routeId >= 0) {
    events.push({
      kind: 'walk',
      minute,
      foragerId: person.id,
      routeId,
      plan: found!.plan,
      rechecked: found!.rechecked,
      wayId: found!.way?.id ?? -1,
    })
    scheduleArrivals(state, person.id, state.routes[routeId]!, minute)
  }
  return events
}
function creditTask(state: ValleyState, person: Forager, minute: number, events: ValleyEvent[]) {
  measureTask(state, person, minute)
  const task = person.task!,
    elapsed = minute - task.startMinute,
    produced = { kcal: 0, wood: 0, logs: 0, stones: 0 }
  if (task.kind === 'pick' || task.kind === 'nuts' || task.kind === 'fish' || task.kind === 'store') {
    const owed = person.pickRemainder + task.productionPerHour * elapsed,
      wanted = Math.min(Math.floor(owed / 60), task.kind === 'store' ? (task.roomKcal ?? 0) : Infinity)
    if (task.kind === 'fish') {
      const bank = person.knownBanks.get(task.placeId)!,
        fish = state.fish.find((body) => body.bodyId === bank.bodyId)!
      produced.kcal = Math.min(wanted, fish.stock)
      fish.stock -= produced.kcal
      fish.caught += produced.kcal
      state.fishKcal -= produced.kcal
      person.fishMemory.set(bank.bodyId, { stock: fish.stock, capacity: fish.capacity, minute })
      state.today.fishCatchByBody[bank.bodyId] = (state.today.fishCatchByBody[bank.bodyId] ?? 0) + produced.kcal
      person.pickRemainder = fish.stock ? owed % 60 : 0
    } else {
      produced.kcal = takeFrom(state.foodStock, task.placeId, wanted)
      person.pickRemainder = state.foodStock[task.placeId] ? owed % 60 : 0
    }
    if (produced.kcal)
      person.carried = addLots(person.carried, [
        {
          food: task.kind === 'pick' ? 'berries' : task.kind === 'fish' ? 'fish' : 'nuts',
          kcal: produced.kcal,
          harvestTick: minute,
        },
      ])
    state.totals.gatheredKcal += produced.kcal
    state.today.gatheredKcal += produced.kcal
    if (task.kind === 'pick') state.today.gatheredBerriesKcal += produced.kcal
    if (task.kind === 'nuts' || task.kind === 'store') state.today.gatheredNutsKcal += produced.kcal
    if (task.kind === 'fish') state.today.gatheredFishKcal += produced.kcal
    person.secondsToday.forage += elapsed * 60
    person.secondsWorked.forage += elapsed * 60
  }
  if (task.kind === 'eat store') {
    const taken = takeFromStore(person, Math.floor((state.config.storeKcalPerHour * elapsed) / 60))
    if (taken.kcal) {
      person.carried = addLots(person.carried, taken.lots)
      events.push({ kind: 'fromStore', minute, foragerId: person.id, kcal: taken.kcal })
    }
  }
  if (task.kind === 'make' && person.making) {
    const result = workAxe(state, person, elapsed * 60, minute)
    if (task.practice) person.practicedToday += elapsed
    if (result.made) {
      events.push(result.made)
      state.today.axesMade += 1
      if (result.made.forSale) state.today.axesMadeForSale += 1
      state.today.axesMadeById[person.id]! += 1
      state.today.axesMadeByTechnique[result.made.axe.technique]! += 1
    }
    if (result.broke) events.push(result.broke)
    if (result.dismantled) events.push(result.dismantled)
    if (result.learnt) events.push(result.learnt)
    events.push(...inventAfter(state.config, person, result.worked, minute))
  }
  if (task.kind === 'cut') {
    const result = cutAt(state, person, task.placeId, elapsed * 60, minute)
    if (result.cut) {
      produced.logs = 1
      events.push(result.cut)
    }
    if (result.worn) events.push(result.worn)
  }
  if (task.kind === 'gather' && state.layout.places.kind[task.placeId] === 3) {
    if (elapsed > 0) {
      produced.stones = takeFrom(state.stoneStock, task.placeId, 1)
      person.stone += produced.stones
    }
    return produced
  }
  if (task.kind === 'gather') {
    const owed = person.gatherRemainder + task.productionPerHour * elapsed
    produced.wood = takeFrom(
      state.woodStock,
      task.placeId,
      Math.min(Math.floor(owed / 60), person.loadCapacityKg - person.tripWood),
    )
    person.gatherRemainder = state.woodStock[task.placeId] ? owed % 60 : 0
    person.wood += produced.wood
    person.tripWood += produced.wood
    state.totals.gatheredWood += produced.wood
    state.today.gatheredWood += produced.wood
    state.today.gatheredWoodById[person.id]! += produced.wood
    person.secondsToday.gather += elapsed * 60
    person.secondsWorked.gather += elapsed * 60
  }
  return produced
}
/** The waking person offers and asks for wood and axes among the people it may trade with. */
/** A group member out of the trader's reach: dead to every exchange rule, and in no group. */
const ABSENT = { id: -1, alive: false, groupId: null } as unknown as Forager
function exchange(state: ValleyState, id: number, minute: number, events: ValleyEvent[]) {
  // Acceptance reads the counterparty's body at this minute without ending its task or paying it twice. Only living
  // members of the trader's group within talking distance may trade with it or hear its terms, so everyone else is
  // passed as they are, or, for members out of reach, as an absent member that no rule reads past.
  const groupId = state.foragers[id]!.groupId,
    at = positionAt(state, state.foragers[id]!, minute)
  const views = state.foragers.map((other) => {
    if (other.groupId !== groupId) return other
    const point = positionAt(state, other, minute)
    if (other.id !== id && (!other.alive || distanceSq(point.x, point.y, at.x, at.y) > state.config.talkRadiusCm ** 2))
      return ABSENT
    const energy = other.task ? Math.max(0, energyAt(other.task, minute, state.routes).kcal) : other.energyKcal
    const water = other.task ? waterAt(other.task, minute, state.routes).ml : other.waterDeficitMl
    return {
      ...other,
      ...point,
      energyKcal: energy,
      waterDeficitMl: water,
      alive: other.alive && energy > 0 && water < waterThresholds(personConfig(state.config, other)).fatal,
    }
  })
  const trader = views[id]!
  const exchanged = swap(state.config, trader, views, minute)
  events.push(...exchanged.quotes)
  for (const trade of exchanged.swaps) {
    events.push({ ...trade, kind: 'exchange' })
    state.totals.swappedWood += trade.wood
    state.totals.swappedKcal += trade.kcal
    state.today.swaps += 1
    state.today.swappedWood += trade.wood
    state.today.swappedKcal += trade.kcal
    state.totals.firstSwapMinute ??= minute
    address(state, trade.sellerId === id ? trade.buyerId : trade.sellerId, minute)
  }
  for (const event of exchangeAxes({ ...state, foragers: views }, trader, minute)) {
    events.push(event)
    if (event.kind === 'promise') {
      events.push({ kind: 'axe-request', minute, foragerId: event.askerId, otherId: event.promiserId })
      address(state, event.promiserId, minute)
    }
    if (event.kind === 'sale') {
      state.today.axesSold += 1
      state.today.axesSoldById[event.sellerId]! += 1
      state.today.axesBoughtById[event.buyerId]! += 1
      address(state, event.sellerId === id ? event.buyerId : event.sellerId, minute)
    }
  }
  for (const view of views) {
    if (view === ABSENT || view === state.foragers[view.id]) continue
    const owner = state.foragers[view.id]!
    owner.carried = view.carried
    owner.wood = view.wood
    owner.swapTotals = view.swapTotals
    owner.heardTerms = view.heardTerms
    owner.axe = view.axe
    owner.spareAxe = view.spareAxe
    owner.ideas = view.ideas
    owner.proficiency = view.proficiency
    owner.heardAsk = view.heardAsk
    owner.promised = view.promised
    owner.axeTotals = view.axeTotals
  }
}
/**
 * A person's wake-up. `fate`, given only by the midnight lifecycle, is the `fate:<day>` draw that fell below their
 * hazard: they die of illness once their body is paid, unless hunger or thirst kills them first.
 */
export function personWake(
  state: ValleyState,
  id: number,
  minute: number,
  _kind: WakeKind,
  fate?: number,
): ValleyEvent[] {
  const person = state.foragers[id]!
  if (!person.alive) return []
  state.queue.cancelPerson(id)
  const events: ValleyEvent[] = [],
    task = person.task
  if (task) {
    const charge = bodyWake(state, person, minute)
    if (task.kind === 'drink' && charge.drink > 0) {
      const bank = person.knownBanks.get(task.placeId)!
      state.waterWithdrawals.set(bank.bodyId, (state.waterWithdrawals.get(bank.bodyId) ?? 0) + charge.drink)
      events.push({
        kind: 'drink',
        minute,
        foragerId: id,
        bankId: bank.id,
        bodyId: bank.bodyId,
        seconds: (minute - task.startMinute) * 60,
        volumeMl: charge.drink,
        deficitBeforeMl: task.startWaterMl,
        deficitAfterMl: person.waterDeficitMl,
        lossMl: charge.loss,
      })
    }
    const produced = creditTask(state, person, minute, events)
    const point = positionAt(state, person, minute)
    person.x = point.x
    person.y = point.y
    events.push({
      kind: 'task-end',
      minute,
      foragerId: id,
      task: { ...task },
      position: point,
      produced,
      paid: { kcal: charge.spent, waterLossMl: charge.loss, drankMl: charge.drink },
    })
    // The children carried on a walk wake when it ends, at its end or earlier.
    if (task.kind === 'walk') for (const child of task.carriedIds ?? []) address(state, child, minute)
    if (task.kind === 'carried') state.today.carriedMinutes += minute - task.startMinute
  }
  person.task = null
  person.lastWakeMinute = minute
  state.totals.wakeUps += 1
  state.today.wakeUpsById[id]! += 1
  if (birthDue(state.config, person, minute)) events.push(deliver(state, person, minute))
  const starved = person.energyKcal <= 0,
    parched = person.waterDeficitMl >= waterThresholds(personConfig(state.config, person)).fatal
  if (starved || parched || fate !== undefined) {
    const illness = !starved && !parched
    state.today.deaths += 1
    if (starved) state.today.starvationDeaths += 1
    if (parched) state.today.dehydrationDeaths += 1
    if (illness) state.today.illnessDeaths += 1
    person.alive = false
    person.deathMinute = minute
    person.deathSecond = 0
    person.deathCauses = [...(starved ? ['starvation' as const] : []), ...(parched ? ['dehydration' as const] : [])]
    events.push({
      kind: 'death',
      minute,
      foragerId: id,
      second: 0,
      cause: illness
        ? 'illness'
        : person.deathCauses.length === 2
          ? 'starvation and dehydration'
          : person.deathCauses[0]!,
      ...(illness ? { draw: fate } : {}),
      ageMilli: ageOf(state.config, person, minute),
    })
    // A death ends a pairing and a pregnancy; children waiting for a feed from the dead choose again.
    if (person.partnerId !== null) state.foragers[person.partnerId]!.partnerId = null
    person.partnerId = null
    person.pregnancy = null
    for (const child of state.foragers)
      if (child.motherId === id && child.alive && child.task === null && child.lastWakeMinute === minute)
        address(state, child.id, minute)
    if (person.groupId !== null) {
      const dissolved = dissolveIfAlone(state, person.groupId, minute)
      if (dissolved) {
        state.today.dissolutions += 1
        events.push({ ...dissolved, kind: 'group-dissolved' })
        if (dissolved.survivorId !== null) address(state, dissolved.survivorId, minute)
      }
    }
    locatePeople(state, minute)
    return events
  }
  const spoiled = spoil(state.config, person.carried, minute)
  person.carried = spoiled.lots
  state.totals.spoiledKcal += spoiled.spoiledKcal
  state.today.spoiledKcal += spoiled.spoiledKcal
  const eaten = milkOnly(state, person, minute)
    ? { rest: person.carried, takenKcal: 0, taken: [] }
    : eatCarried(person.carried, person.reserveMaxKcal - person.energyKcal)
  person.carried = eaten.rest
  person.energyKcal += eaten.takenKcal
  countEaten(state.today, eaten.taken)
  if (atHearth(person)) {
    const stored = putIntoStore(person, minute)
    if (stored) events.push(stored)
    person.storeTrip = false
  }
  const ended = events.find((event) => event.kind === 'task-end')
  if (ended?.kind === 'task-end') {
    ended.ateKcal = eaten.takenKcal
    ended.spoiledKcal = spoiled.spoiledKcal
  }
  // The hunger and thirst flags follow the body a task starts with; a feed changes it, so they are set again after it.
  const wasHungry = person.hungry,
    wasThirsty = person.thirsty
  const setFlags = () => {
    person.hungry = nextHungry(personConfig(state.config, person), person.energyKcal, wasHungry)
    person.thirsty = wasThirsty
    if (person.waterDeficitMl >= waterThresholds(personConfig(state.config, person)).thirsty) person.thirsty = true
    else if (person.waterDeficitMl <= state.config.drinkStopMl) person.thirsty = false
  }
  setFlags()
  person.shortOfWood = nextShortOfWood(state.config, person.wood, person.shortOfWood, person.woodStockTarget)
  if (atHearth(person)) person.tripWood = 0
  // A child under weaning age who wants a feed waits for it: their mother is woken, feeds them and wakes them again.
  if (wantsFeed(state, person, minute)) {
    address(state, person.motherId!, minute)
    // No task starts while waiting: the flags are set when one does, after the feed.
    person.hungry = wasHungry
    person.thirsty = wasThirsty
    return events
  }
  const feeds = feedChildren(state, person, minute)
  events.push(...feeds.events)
  for (const child of feeds.waiting) address(state, child, minute)
  if (feeds.events.length) setFlags()
  locatePeople(state, minute)
  const observation = observeAt(state, person, minute)
  events.push(observation)
  const meeting = meet(state, person, minute)
  if (meeting) {
    if (meeting.kind === 'found') state.today.foundings += 1
    else state.today.joinings += 1
    events.push(meeting.kind === 'found' ? { ...meeting, kind: 'group-founded' } : { ...meeting, kind: 'group-joined' })
    const members = [...(meeting.kind === 'found' ? meeting.founderIds : [meeting.metId]), ...(meeting.children ?? [])]
    for (const otherId of members) if (otherId !== id) address(state, otherId, minute)
  }
  const abandoned = leaveHutIfMoved(state, person, minute)
  if (abandoned) events.push(abandoned)
  for (const otherId of observation.people) {
    events.push({ kind: 'meet', minute, foragerId: id, otherId })
    const other = state.foragers[otherId]!,
      point = positionAt(state, other, minute)
    other.x = point.x
    other.y = point.y
    if (other.lastWakeMinute !== minute) address(state, otherId, minute)
  }
  events.push(...countTogether(state, person, task, observation.people, minute))
  events.push(...pairAt(state, person, observation.people, minute))
  // Exchange needs another living member of the trader's group; without one, neither wood nor axes change hands.
  if (
    person.groupId !== null &&
    state.foragers.some((other) => other.id !== id && other.alive && other.groupId === person.groupId)
  )
    exchange(state, id, minute, events)
  // Everyone asked was met above, and so is already woken this minute.
  const asked = ask(state, person, observation.people, minute)
  events.push(...asked.events)
  if (ended?.kind === 'task-end') ended.ateKcal = (ended.ateKcal ?? 0) + asked.ateKcal
  if (atHearth(person)) {
    const logs = person.log
    if (layLog(state, person, minute))
      events.push({ kind: 'delivery', minute, foragerId: id, logs, hutId: person.hutId })
    if (person.groupId !== null) {
      const fed = feedFire(state, state.groups[person.groupId]!, person, minute)
      if (fed) {
        events.push(fed)
        state.today.fireGivenById[id]! += fed.wood
      }
    }
  }
  person.hungry = nextHungry(personConfig(state.config, person), person.energyKcal, person.hungry)
  person.shortOfWood = nextShortOfWood(state.config, person.wood, person.shortOfWood, person.woodStockTarget)
  const carrier = carrying(state, person, minute)
  const started = carrier ? carried(state, person, carrier, minute) : carryAndSchedule(state, person, minute)
  if (!ended) {
    const first = started.find((event) => event.kind === 'task-start')
    if (first?.kind === 'task-start') {
      first.ateKcal = eaten.takenKcal + asked.ateKcal
      first.spoiledKcal = spoiled.spoiledKcal
    }
  }
  events.push(...started)
  return events
}
export function arrival(state: ValleyState, entry: WakeEntry): boolean {
  if (entry.walkerId === undefined) return true
  const walker = state.foragers[entry.walkerId]!
  if (
    !walker.alive ||
    walker.task?.kind !== 'walk' ||
    walker.task.routeId !== entry.routeId ||
    walker.task.startMinute !== entry.walkStartMinute
  )
    return false
  if (entry.id === entry.walkerId) {
    locatePeople(state, entry.minute)
    for (const id of peopleInChunk(state, entry.chunk!))
      if (id !== entry.id) {
        const person = state.foragers[id]!
        if (
          !person.alive ||
          (person.task?.kind === 'sleep' &&
            waterAt(person.task, entry.minute, state.routes).ml <
              waterThresholds(personConfig(state.config, person)).urgent)
        )
          continue
        if (person.arrivalFrom[entry.id] === entry.minute) continue
        state.queue.schedule({ ...entry, id })
      }
    return false
  }
  const person = state.foragers[entry.id]!
  if (chunkOf(state.layout.nav, positionAt(state, person, entry.minute)) !== entry.chunk) return false
  if (person.arrivalFrom[entry.walkerId] === entry.minute) return false
  person.arrivalFrom[entry.walkerId] = entry.minute
  return (
    person.task?.kind !== 'sleep' ||
    waterAt(person.task, entry.minute, state.routes).ml >= waterThresholds(personConfig(state.config, person)).urgent
  )
}

/** The carrier of a person who cannot walk, when that carrier is on a walk that carries them and has not ended. */
function carrying(state: ValleyState, person: Forager, minute: number): Forager | null {
  if (canWalk(state, person)) return null
  const carrier = carrierOf(state, person)
  const task = carrier?.task
  if (!carrier || task?.kind !== 'walk' || !task.carriedIds?.includes(person.id) || task.endMinute <= minute)
    return null
  return carrier
}

/** Starts a carried task: the person rides on the carrier's walk at the resting rate until it ends. */
function carried(state: ValleyState, person: Forager, carrier: Forager, minute: number): ValleyEvent[] {
  const walk = carrier.task!
  person.childKg = 0
  person.task = startTask(state.config, person, 'carried', minute, walk.endMinute, -1, walk.routeId, 'carried')
  person.task.carrierId = carrier.id
  person.task.walkStartMinute = walk.startMinute
  person.task.groupId = person.groupId
  person.task.wholeHut = shelteredAt(state, person)
  state.queue.schedule({ minute: walk.endMinute, phase: 1, id: person.id, kind: 'end' })
  const threshold = firstThresholdMinute(personConfig(state.config, person), person.task, state.routes)
  if (threshold && threshold.minute < walk.endMinute)
    state.queue.schedule({ minute: threshold.minute, phase: 1, id: person.id, kind: 'threshold' })
  return [
    { kind: 'carried', minute, foragerId: person.id, carrierId: carrier.id, endMinute: walk.endMinute },
    {
      kind: 'task-start',
      minute,
      foragerId: person.id,
      task: { ...person.task },
      position: { x: person.x, y: person.y },
    },
  ]
}

/**
 * Chooses and starts a person's next task with the children they would carry counted in their load; a walk takes those
 * children along, and each is woken to ride on it.
 */
function carryAndSchedule(state: ValleyState, person: Forager, minute: number): ValleyEvent[] {
  const children = carriedBy(state, person, minute)
  person.childKg = children.reduce((total, child) => total + child.weightKg, 0)
  const started = scheduleTask(state, person, minute)
  const task = person.task!
  if (task.kind === 'walk' && children.length) {
    task.carriedIds = children.map((child) => child.id)
    task.childKg = person.childKg
    // The walk's start record carries the children it takes along.
    for (const e of started)
      if (e.kind === 'task-start' && e.foragerId === person.id && e.minute === minute)
        e.task = { ...e.task, carriedIds: task.carriedIds, childKg: task.childKg }
    for (const child of children) address(state, child.id, minute)
  }
  return started
}

/**
 * The children a person would carry now: living, unable to walk, within talking distance, whose carrier they are, in id
 * order while their weights together fit the person's load capacity.
 */
function carriedBy(state: ValleyState, person: Forager, minute: number): Forager[] {
  if (!canWalk(state, person)) return []
  const children: Forager[] = []
  let kg = 0
  for (const child of state.foragers) {
    if (!child.alive || child.id === person.id || canWalk(state, child)) continue
    const at = positionAt(state, child, minute)
    if (distanceSq(at.x, at.y, person.x, person.y) > state.config.talkRadiusCm ** 2) continue
    if (carrierOf(state, child)?.id !== person.id || kg + child.weightKg > person.loadCapacityKg) continue
    kg += child.weightKg
    children.push(child)
  }
  return children
}

function address(state: ValleyState, id: number, minute: number) {
  if (!state.foragers[id]!.alive) return
  state.queue.cancelPerson(id, 'address')
  state.queue.schedule({ minute, phase: 1, id, kind: 'address' })
}
