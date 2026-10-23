import { measureTask } from './summary'
import type { WakeEntry, WakeKind } from './clock'
import { MINUTES_PER_DAY, minuteOfDay } from './calendar'
import { atHearth, chooseTask, isDaylight, routeFor, routeKey, nextHungry } from './forager'
import { energyAt, waterAt, firstThresholdMinute, waterThresholds } from './body'
import { startTask, positionAt } from './tasks'
import { nearestFrontier, chunkOf } from './routes'
import { observeAt, reindexPeople, scheduleArrivals, peopleInChunk } from './perception'
import { carriedKcal, spoil, addLots, eatCarried } from './food'
import { takeFrom } from './places'
import { nextShortOfWood, swap } from './trade'
import { meet, dissolveIfAlone } from './social'
import { layLog, leaveHutIfMoved, hutWhole } from './huts'
import { feedFire } from './fire'
import { warmthOf, tendFire } from './work'
import { beginAxe, workAxe, cutAt, logCut, exchangeAxes } from './axes'
import type { Forager, ValleyEvent, ValleyState } from './types'

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
function scheduleTask(state: ValleyState, person: Forager, minute: number) {
  let choice = chooseTask(state, person, minute),
    routeId = -1
  let end = minute + 60
  if (choice.kind === 'walk' && choice.target) {
    let route = routeFor(state, person, choice.target)
    if (!route) {
      const frontier = nearestFrontier(state.layout.lattice, person.knowledge, person)
      if (frontier) {
        route = routeFor(state, person, frontier)
        choice = { ...choice, target: frontier, placeId: -1 }
      }
    }
    if (route?.segments.length) {
      const endpoint = route.segments[route.segments.length - 1]!
      const key = routeKey(state, person, { x: endpoint.x1, y: endpoint.y1 }),
        saved = person.routeCache.get(key)
      routeId = saved ?? state.routes.length
      if (saved === undefined) {
        state.routes.push(route)
        person.routeCache.set(key, routeId)
      }
      end = minute + route.minutes
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
    const net = state.config.drinkMlPerSecond * 60 - state.config.waterBaseMlPerDay / 1_440
    end = minute + Math.max(1, Math.ceil((person.waterDeficitMl - state.config.drinkStopMl) / net))
  }
  if (choice.kind === 'pick' || choice.kind === 'nuts' || choice.kind === 'fish' || choice.kind === 'gather') {
    const rate = choice.productionPerHour ?? 0,
      stock = choice.expectedStock ?? 0
    const room =
      choice.kind === 'gather'
        ? state.config.woodLoad - person.tripWood
        : Math.max(
            0,
            state.config.reserveMaxKcal -
              person.energyKcal -
              carriedKcal(person.carried) +
              (choice.desiredCarriedKcal ?? 0),
          )
    const net = choice.kind === 'gather' ? rate : rate - state.config.pickKcalPerHour
    const duration = Math.min(Math.ceil((stock * 60) / Math.max(1, rate)), Math.ceil((room * 60) / Math.max(1, net)))
    const home = atHearth(person) ? 0 : (routeFor(state, person, person.hearth)?.minutes ?? 0)
    end = minute + Math.max(1, Math.min(duration, state.config.duskHour * 60 - minuteOfDay(minute) - home))
  }
  const beforeEvents: ValleyEvent[] = []
  if (choice.kind === 'make') {
    if (!person.making) beginAxe(state, person)
    end =
      minute +
      Math.max(
        1,
        Math.min(
          Math.ceil((person.making!.needed - person.making!.worked) / 60),
          state.config.duskHour * 60 - minuteOfDay(minute),
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
          state.config.duskHour * 60 - minuteOfDay(minute) - (routeFor(state, person, person.hearth)?.minutes ?? 0),
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
  const fire = person.groupId === null ? person.warm : state.groups[person.groupId]!.fireLit
  const warmth = warmthOf(fire, hutWhole(state, person))
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
  person.task.wholeHut = hutWhole(state, person)
  person.task.productionPerHour = choice.productionPerHour ?? 0
  state.queue.schedule({ minute: person.task.endMinute, phase: 1, id: person.id, kind: 'end' })
  const threshold = firstThresholdMinute(state.config, person.task, state.routes)
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
    events.push({ kind: 'walk', minute, foragerId: person.id, routeId })
    scheduleArrivals(state, person.id, state.routes[routeId]!, minute)
  }
  return events
}
function creditTask(state: ValleyState, person: Forager, minute: number, events: ValleyEvent[]) {
  measureTask(state, person, minute)
  const task = person.task!,
    elapsed = minute - task.startMinute,
    produced = { kcal: 0, wood: 0, logs: 0, stones: 0 }
  if (task.kind === 'pick' || task.kind === 'nuts' || task.kind === 'fish') {
    const owed = person.pickRemainder + task.productionPerHour * elapsed,
      wanted = Math.floor(owed / 60)
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
          food: task.kind === 'pick' ? 'berries' : task.kind === 'nuts' ? 'nuts' : 'fish',
          kcal: produced.kcal,
          harvestTick: minute,
        },
      ])
    state.totals.gatheredKcal += produced.kcal
    state.today.gatheredKcal += produced.kcal
    if (task.kind === 'pick') state.today.gatheredBerriesKcal += produced.kcal
    if (task.kind === 'nuts') state.today.gatheredNutsKcal += produced.kcal
    if (task.kind === 'fish') state.today.gatheredFishKcal += produced.kcal
    person.secondsToday.forage += elapsed * 60
    person.secondsWorked.forage += elapsed * 60
  }
  if (task.kind === 'make' && person.making) {
    const result = workAxe(state, person, elapsed * 60, minute)
    if (result.made) events.push(result.made)
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
      Math.min(Math.floor(owed / 60), state.config.woodLoad - person.tripWood),
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
export function personWake(state: ValleyState, id: number, minute: number, _kind: WakeKind): ValleyEvent[] {
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
  }
  person.task = null
  person.lastWakeMinute = minute
  state.totals.wakeUps += 1
  state.today.wakeUpsById[id]! += 1
  if (person.energyKcal <= 0 || person.waterDeficitMl >= waterThresholds(state.config).fatal) {
    state.today.deaths += 1
    if (person.energyKcal <= 0) state.today.starvationDeaths += 1
    if (person.waterDeficitMl >= waterThresholds(state.config).fatal) state.today.dehydrationDeaths += 1
    person.alive = false
    person.deathMinute = minute
    person.deathSecond = 0
    person.deathCauses = [
      ...(person.energyKcal <= 0 ? ['starvation' as const] : []),
      ...(person.waterDeficitMl >= waterThresholds(state.config).fatal ? ['dehydration' as const] : []),
    ]
    events.push({
      kind: 'death',
      minute,
      foragerId: id,
      second: 0,
      cause: person.deathCauses.length === 2 ? 'starvation and dehydration' : person.deathCauses[0]!,
    })
    if (person.groupId !== null) {
      const dissolved = dissolveIfAlone(state, person.groupId, minute)
      if (dissolved) {
        state.today.dissolutions += 1
        events.push({ ...dissolved, kind: 'group-dissolved' })
        if (dissolved.survivorId !== null) address(state, dissolved.survivorId, minute)
      }
    }
    reindexPeople(state, minute)
    return events
  }
  const spoiled = spoil(state.config, person.carried, minute)
  person.carried = spoiled.lots
  state.totals.spoiledKcal += spoiled.spoiledKcal
  state.today.spoiledKcal += spoiled.spoiledKcal
  const eaten = eatCarried(person.carried, state.config.reserveMaxKcal - person.energyKcal)
  person.carried = eaten.rest
  person.energyKcal += eaten.takenKcal
  const ended = events.find((event) => event.kind === 'task-end')
  if (ended?.kind === 'task-end') {
    ended.ateKcal = eaten.takenKcal
    ended.spoiledKcal = spoiled.spoiledKcal
  }
  person.hungry = nextHungry(state.config, person.energyKcal, person.hungry)
  person.shortOfWood = nextShortOfWood(state.config, person.wood, person.shortOfWood)
  if (person.waterDeficitMl >= waterThresholds(state.config).thirsty) person.thirsty = true
  else if (person.waterDeficitMl <= state.config.drinkStopMl) person.thirsty = false
  if (atHearth(person)) person.tripWood = 0
  reindexPeople(state, minute)
  const observation = observeAt(state, person, minute)
  events.push(observation)
  const meeting = meet(state, person, minute)
  if (meeting) {
    if (meeting.kind === 'found') state.today.foundings += 1
    else state.today.joinings += 1
    events.push({ ...meeting, kind: meeting.kind === 'found' ? 'group-founded' : 'group-joined' })
    const members = meeting.kind === 'found' ? meeting.founderIds : [meeting.metId]
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
  // Acceptance reads the counterparty's body at this minute without ending its task or paying it twice.
  const views = state.foragers.map((other) => {
    const point = positionAt(state, other, minute)
    const energy = other.task ? Math.max(0, energyAt(other.task, minute, state.routes).kcal) : other.energyKcal
    const water = other.task ? waterAt(other.task, minute, state.routes).ml : other.waterDeficitMl
    return {
      ...other,
      ...point,
      energyKcal: energy,
      waterDeficitMl: water,
      alive: other.alive && energy > 0 && water < waterThresholds(state.config).fatal,
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
    if (event.kind === 'sale') address(state, event.sellerId === id ? event.buyerId : event.sellerId, minute)
  }
  for (const view of views) {
    const owner = state.foragers[view.id]!
    owner.carried = view.carried
    owner.wood = view.wood
    owner.swapTotals = view.swapTotals
    owner.heardTerms = view.heardTerms
    owner.axe = view.axe
    owner.spareAxe = view.spareAxe
    owner.heardAsk = view.heardAsk
    owner.promised = view.promised
    owner.axeTotals = view.axeTotals
  }
  if (atHearth(person)) {
    const logs = person.log
    if (layLog(state, person, minute))
      events.push({ kind: 'delivery', minute, foragerId: id, logs, hutId: person.hutId })
    if (person.groupId !== null) {
      const fed = feedFire(state, state.groups[person.groupId]!, person, minute)
      if (fed) events.push(fed)
    }
  }
  person.hungry = nextHungry(state.config, person.energyKcal, person.hungry)
  person.shortOfWood = nextShortOfWood(state.config, person.wood, person.shortOfWood)
  const started = scheduleTask(state, person, minute)
  if (!ended) {
    const first = started.find((event) => event.kind === 'task-start')
    if (first?.kind === 'task-start') {
      first.ateKcal = eaten.takenKcal
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
    reindexPeople(state, entry.minute)
    for (const id of peopleInChunk(state, entry.chunk!))
      if (id !== entry.id) {
        const person = state.foragers[id]!
        if (
          !person.alive ||
          (person.task?.kind === 'sleep' &&
            waterAt(person.task, entry.minute, state.routes).ml < waterThresholds(state.config).urgent)
        )
          continue
        if (person.arrivalFrom[entry.id] === entry.minute) continue
        state.queue.schedule({ ...entry, id })
      }
    return false
  }
  const person = state.foragers[entry.id]!
  if (chunkOf(state.layout.lattice, positionAt(state, person, entry.minute)) !== entry.chunk) return false
  if (person.arrivalFrom[entry.walkerId] === entry.minute) return false
  person.arrivalFrom[entry.walkerId] = entry.minute
  return (
    person.task?.kind !== 'sleep' ||
    waterAt(person.task, entry.minute, state.routes).ml >= waterThresholds(state.config).urgent
  )
}

function address(state: ValleyState, id: number, minute: number) {
  if (!state.foragers[id]!.alive) return
  state.queue.cancelPerson(id, 'address')
  state.queue.schedule({ minute, phase: 1, id, kind: 'address' })
}
