import { carriedKcal } from './food'
import { ratesOf } from './practice'
import { bothGain, pairTerms } from './trade'
import { woodMatters, woodTarget } from './wood'
import { campTile, forageSucceeds, harvestOf, isDaylight, manhattan, sameTile } from './world'
import type { LifeState, Tile } from './types'

/** Returns every invariant the state breaks; an empty list means the state is sound. */
export function lifeInvariantViolations(state: LifeState): string[] {
  const { config, patches, foragers, totals, lastEvents } = state
  const violations: string[] = []
  const stock = patches.reduce((sum, patch) => sum + patch.stockKcal, 0)
  const reserves = foragers.reduce((sum, forager) => sum + forager.energyKcal, 0)
  const carried = foragers.reduce((sum, forager) => sum + carriedKcal(forager.carried), 0)
  const held = stock + reserves + carried + totals.metabolizedKcal + totals.spoiledKcal
  const supplied = totals.initialKcal + totals.regrownKcal
  if (held !== supplied)
    violations.push(
      `Energy is not conserved: stock + reserves + carried + metabolized + spoiled = ${held}, start + regrown = ${supplied}`,
    )
  for (const patch of patches) {
    if (patch.stockKcal < 0 || patch.stockKcal > config.patchCapacityKcal)
      violations.push(`Patch ${patch.id} stock ${patch.stockKcal} is outside 0–${config.patchCapacityKcal}`)
  }
  const groveWood = state.groves.reduce((sum, grove) => sum + grove.wood, 0)
  const heldWood = foragers.reduce((sum, forager) => sum + forager.wood, 0)
  const woodNow = groveWood + heldWood + totals.burnedWood
  if (woodNow !== totals.initialWood + totals.regrownWood)
    violations.push(
      `Wood is not conserved: groves + held + burned = ${woodNow}, start + regrown = ${totals.initialWood + totals.regrownWood}`,
    )
  for (const grove of state.groves) {
    if (!Number.isInteger(grove.wood) || grove.wood < 0 || grove.wood > config.groveCapacityWood)
      violations.push(`Grove ${grove.id} wood ${grove.wood} is outside 0–${config.groveCapacityWood}`)
  }

  const lastTick = state.tick - 1
  const camp = campTile(config)
  for (const forager of foragers) {
    const name = `Forager ${forager.id}`
    if (forager.energyKcal < 0 || forager.energyKcal > config.reserveMaxKcal)
      violations.push(`${name}'s reserve ${forager.energyKcal} is outside 0–${config.reserveMaxKcal}`)
    if (!forager.alive && forager.energyKcal !== 0) violations.push(`${name} is dead but has a reserve`)
    if (!forager.alive && forager.carried.length) violations.push(`${name} is dead but carries food`)
    const { x, y } = forager.position
    if (x < 0 || y < 0 || x >= config.gridWidth || y >= config.gridHeight)
      violations.push(`${name} is off the grid at ${x},${y}`)
    if (forager.targetPatchId !== null && !patches[forager.targetPatchId])
      violations.push(`${name}'s target ${forager.targetPatchId} is not a patch`)
    for (const [id, memory] of forager.memory.entries()) {
      if (memory.observedTick > state.tick) violations.push(`${name}'s memory of patch ${id} is from the future`)
    }
    if (!Number.isInteger(forager.wood) || forager.wood < 0) violations.push(`${name} holds ${forager.wood} wood`)
    const heard = forager.heardTerms
    if (heard && heard.tick > lastTick) violations.push(`${name} remembers terms from the future`)
    if (
      heard?.tick === lastTick &&
      ![...state.lastSwaps, ...state.lastQuotes].some((made) => made.kcalPerWood === heard.kcalPerWood)
    )
      violations.push(`${name} remembers terms no one agreed this hour`)
    for (const lot of forager.carried) {
      if (!Number.isInteger(lot.kcal) || lot.kcal <= 0) violations.push(`${name} carries a lot of ${lot.kcal} kcal`)
      if (lot.harvestTick > lastTick) violations.push(`${name} carries food harvested in the future`)
      if (config.shelfLifeHours > 0 && lot.harvestTick <= lastTick - config.shelfLifeHours)
        violations.push(`${name} carries food that should have spoiled`)
    }
    if (camp && forager.alive && state.tick > 0 && !isDaylight(config, lastTick) && !sameTile(forager.position, camp))
      violations.push(`${name} is away from camp at night`)
    for (const [other, entry] of forager.ledger.entries()) {
      if (entry.givenKcal !== foragers[other]!.ledger[forager.id]!.receivedKcal)
        violations.push(`Forager ${forager.id} and forager ${other} disagree about what was given`)
    }
  }
  const swapped = (pick: (forager: (typeof foragers)[number]) => number) =>
    foragers.reduce((sum, forager) => sum + pick(forager), 0)
  if (
    swapped((f) => f.swapTotals.woodSold) !== totals.swappedWood ||
    swapped((f) => f.swapTotals.woodBought) !== totals.swappedWood ||
    swapped((f) => f.swapTotals.kcalReceived) !== totals.swappedKcal ||
    swapped((f) => f.swapTotals.kcalPaid) !== totals.swappedKcal
  )
    violations.push('Foragers’ swap totals do not add up to the wood and food swapped')
  const recorded = foragers.reduce((sum, f) => sum + f.ledger.reduce((total, entry) => total + entry.givenKcal, 0), 0)
  if (recorded !== totals.givenKcal) violations.push(`Ledgers record ${recorded} kcal given, gifts ${totals.givenKcal}`)

  if (state.tick > 0) {
    // Everyone alive at the start of the hour took exactly one turn: the living, and those who died this hour.
    const actors = foragers.filter((forager) => forager.alive || forager.deathTick === lastTick).map(({ id }) => id)
    const acted = new Set(lastEvents.map((event) => event.foragerId))
    if (acted.size !== lastEvents.length) violations.push('A forager took two turns in one hour')
    if (acted.size !== actors.length || actors.some((id) => !acted.has(id)))
      violations.push('The hour’s turns do not match the foragers alive at its start')
  }

  // Walking back through the hour's turns, `takenSince[p]` is what this turn and later ones took from patch `p`, so the
  // stock at the start of this turn was the stock now plus that.
  const takenSince = patches.map(() => 0)
  const woodSince = state.groves.map(() => 0)
  for (let index = lastEvents.length - 1; index >= 0; index -= 1) {
    const event = lastEvents[index]!
    if (event.action === 'forage') takenSince[event.patchId!]! += event.gatheredKcal
    if (event.action === 'gather') woodSince[event.patchId!]! += event.gatheredWood
    const forager = foragers[event.foragerId]!
    if (event.tick !== lastTick) violations.push(`Forager ${forager.id}'s last action is not from the last hour`)
    for (const patch of patches) {
      if (manhattan(patch.tile, event.from) > config.perceptionRadiusTiles) continue
      const memory = forager.memory[patch.id]!
      if (memory.observedTick !== event.tick || memory.stockKcal !== patch.stockKcal + takenSince[patch.id]!)
        violations.push(`Forager ${forager.id}'s memory of patch ${patch.id} does not match what it saw`)
    }
    for (const grove of state.groves) {
      if (manhattan(grove.tile, event.from) > config.perceptionRadiusTiles) continue
      const memory = forager.groveMemory[grove.id]!
      if (memory.observedTick !== event.tick || memory.wood !== grove.wood + woodSince[grove.id]!)
        violations.push(`Forager ${forager.id}'s memory of grove ${grove.id} does not match what it saw`)
    }
    if (event.action === 'gather') {
      const memory = event.patchId === null ? undefined : forager.groveMemory[event.patchId]
      if (!isDaylight(config, event.tick)) violations.push(`Forager ${forager.id} gathered at night`)
      if (!memory || memory.observedTick !== event.tick || memory.wood < forager.woodRate)
        violations.push(`Forager ${forager.id} gathered at a grove it had not seen holding an hour's wood`)
      if (event.gatheredWood !== forager.woodRate)
        violations.push(`Forager ${forager.id} gathered ${event.gatheredWood} wood in an hour`)
    } else if (event.gatheredWood !== 0) violations.push(`Forager ${forager.id} gathered wood without gathering`)
    if (event.burnedWood !== 0 && (event.action !== 'sleep' || event.burnedWood !== config.fireWoodPerHour))
      violations.push(`Forager ${forager.id} burned ${event.burnedWood} wood while it took the action ${event.action}`)
    if (event.burnedWood && !woodMatters(config))
      violations.push(`Forager ${forager.id} burned wood that does not matter`)
    const cold = event.action === 'sleep' && !event.burnedWood && config.coldSleepKcalPerHour > config.sleepKcalPerHour
    if (event.sleptCold !== cold) violations.push(`Forager ${forager.id} slept cold wrongly`)
    if (event.action === 'forage') {
      if (!isDaylight(config, event.tick)) violations.push(`Forager ${forager.id} foraged at night`)
      const memory = event.patchId === null ? undefined : forager.memory[event.patchId]
      const harvest = harvestOf(config, forager.forageRate)
      if (!memory || memory.observedTick !== event.tick || memory.stockKcal < harvest)
        violations.push(`Forager ${forager.id} foraged a patch it had not seen holding a full harvest`)
      if (event.succeeded !== forageSucceeds(config, event.tick, forager.id, forager.forageRate))
        violations.push(`Forager ${forager.id}'s luck does not match its stream`)
      if (event.gatheredKcal !== (event.succeeded ? harvest : 0))
        violations.push(`Forager ${forager.id} took ${event.gatheredKcal} kcal in an hour of foraging`)
    } else if (event.succeeded !== null || event.gatheredKcal !== 0)
      violations.push(`Forager ${forager.id} gathered food without foraging`)
  }

  violations.push(...giftViolations(state), ...swapViolations(state), ...practiceViolations(state))
  return violations
}

/** Every forager's practice log, hours and rates agree, and practice happened only at midnight. */
function practiceViolations(state: LifeState): string[] {
  const { config, foragers, lastEvents, lastPractice } = state
  const violations: string[] = []
  // Hours of the current day already run: a whole day once the last hour of a day has run.
  const hoursOfDay = state.tick === 0 ? 0 : ((state.tick - 1) % 24) + 1
  for (const forager of foragers) {
    const name = `Forager ${forager.id}`
    for (const task of ['forage', 'gather'] as const) {
      const log = forager.practiceLog[task]
      if (log.length !== config.practiceDays) violations.push(`${name}'s ${task} log has ${log.length} days`)
      if (log.some((hours) => !Number.isInteger(hours) || hours < 0 || hours > 24))
        violations.push(`${name}'s ${task} log holds an impossible day`)
      if (forager.hoursWorked[task] !== forager.loggedHours[task] + forager.hoursToday[task])
        violations.push(`${name}'s ${task} hours worked do not match its log and its hours today`)
    }
    const today = forager.hoursToday.forage + forager.hoursToday.gather
    if (
      !Number.isInteger(today) ||
      forager.hoursToday.forage < 0 ||
      forager.hoursToday.gather < 0 ||
      // A dead forager's hours stay as they were on the day it died.
      (forager.alive && today > hoursOfDay)
    )
      violations.push(`${name} worked ${today} hours in the ${hoursOfDay} hours of today`)
    const rates = ratesOf(config, forager.foragingSkill, forager.woodSkill, forager.practiceLog)
    if (forager.forageRate !== rates.forageRate || forager.woodRate !== rates.woodRate)
      violations.push(`${name}'s rates do not match its born skills and practice`)
  }
  const lastTick = state.tick - 1
  const midnight = lastTick > 0 && lastTick % 24 === 0
  if (lastPractice.length && !midnight) violations.push('Foragers practised other than at midnight')
  if (midnight) {
    const practised = new Set(lastPractice.map((event) => event.foragerId))
    const actors = new Set(lastEvents.map((event) => event.foragerId))
    if (
      practised.size !== lastPractice.length ||
      practised.size !== actors.size ||
      [...actors].some((id) => !practised.has(id))
    )
      violations.push('Midnight’s practice does not match the foragers alive at its start')
  }
  for (const event of lastPractice) {
    const forager = foragers[event.foragerId]!
    if (event.tick !== lastTick) violations.push(`Forager ${event.foragerId}'s practice is not from the last hour`)
    if (event.forageRate !== forager.forageRate || event.woodRate !== forager.woodRate)
      violations.push(`Forager ${event.foragerId}'s rates changed after midnight`)
    if (
      event.added.forage !== forager.practiceLog.forage.at(-1) ||
      event.added.gather !== forager.practiceLog.gather.at(-1)
    )
      violations.push(`Forager ${event.foragerId}'s log does not end with the hours practice added`)
  }
  return violations
}

/** Every swap and quote of the last hour obeyed the rules of swapping. */
function swapViolations(state: LifeState): string[] {
  const { config, foragers, lastEvents, lastSwaps, lastQuotes } = state
  const violations: string[] = []
  if ((lastSwaps.length || lastQuotes.length) && (!config.swapping || !woodMatters(config)))
    violations.push('Foragers swapped or quoted where swapping is off')
  if (lastQuotes.length && !config.quotes) violations.push('Foragers quoted terms with quotes off')
  const target = woodTarget(config)
  const acted = new Map(lastEvents.map((event) => [event.foragerId, event]))
  for (const made of [...lastSwaps, ...lastQuotes]) {
    const seller = foragers[made.sellerId]!
    const buyer = foragers[made.buyerId]!
    const name = `Forager ${made.sellerId}'s ${made.kind} with forager ${made.buyerId}`
    if (made.kcalPerWood !== pairTerms(seller, buyer) || !bothGain(seller, buyer, made.kcalPerWood))
      violations.push(`${name} was not at the midpoint of their own terms, strictly between them`)
    for (const forager of [seller, buyer]) {
      if (!acted.has(forager.id)) violations.push(`${name} involved a forager that took no turn`)
      else if (!forager.alive && forager.deathTick !== made.tick) violations.push(`${name} involved the dead`)
    }
  }
  for (const made of lastSwaps) {
    const name = `Forager ${made.sellerId}'s swap with forager ${made.buyerId}`
    if (made.wood < 1 || made.kcal !== made.wood * made.kcalPerWood) violations.push(`${name} broke its quantities`)
    if (made.sellerWoodBefore - made.wood < target || made.buyerWoodBefore + made.wood > target)
      violations.push(`${name} sold wood the seller could not spare or the buyer did not want`)
    if (made.kcal > made.buyerCarriedKcal || made.kcal > made.sellerRoomKcal)
      violations.push(`${name} took more food than the buyer carried or the seller had room for`)
    for (const id of [made.sellerId, made.buyerId]) {
      const event = acted.get(id)
      if (event && !sameTile(made.tile, event.position) && !sameTile(made.tile, event.from))
        violations.push(`${name} was made away from forager ${id}`)
    }
  }
  return violations
}

/** Every gift of the last hour obeyed the rules of giving and its giver's strategy. */
function giftViolations(state: LifeState): string[] {
  const { foragers, lastEvents, lastGifts } = state
  const violations: string[] = []
  const turnIndex = new Map(lastEvents.map((event, index) => [event.foragerId, index]))
  // Each ledger as it stood before the hour's gifts, replayed gift by gift.
  const before = new Map<string, { givenKcal: number; receivedKcal: number }>()
  const entry = (from: number, to: number) => {
    const key = `${from}>${to}`
    if (!before.has(key)) {
      let { givenKcal, receivedKcal } = foragers[from]!.ledger[to]!
      for (const gift of lastGifts) {
        if (gift.giverId === from && gift.recipientId === to) givenKcal -= gift.kcal
        if (gift.giverId === to && gift.recipientId === from) receivedKcal -= gift.kcal
      }
      before.set(key, { givenKcal, receivedKcal })
    }
    return before.get(key)!
  }
  const positionAt = (foragerId: number, giverIndex: number): Tile | null => {
    const index = turnIndex.get(foragerId)
    if (index === undefined) return null
    const event = lastEvents[index]!
    return index < giverIndex ? event.position : event.from
  }
  for (const gift of lastGifts) {
    const name = `Forager ${gift.giverId}'s gift to forager ${gift.recipientId}`
    const giver = foragers[gift.giverId]!
    const recipient = foragers[gift.recipientId]!
    const giverIndex = turnIndex.get(gift.giverId)
    if (giverIndex === undefined || !sameTile(lastEvents[giverIndex]!.position, gift.tile))
      violations.push(`${name} was not made where the giver stood`)
    if (gift.giverId === gift.recipientId) violations.push(`${name} went to itself`)
    if (gift.kcal <= 0 || gift.kcal > gift.requestKcal)
      violations.push(`${name} of ${gift.kcal} kcal broke its request`)
    if (!recipient.alive && recipient.deathTick !== gift.tick) violations.push(`${name} went to the dead`)
    const where = giverIndex === undefined ? null : positionAt(gift.recipientId, giverIndex)
    if (!where || !sameTile(where, gift.tile)) violations.push(`${name} went to a forager on another tile`)
    if (giver.strategy === 'keeper') violations.push(`${name} was made by a keeper`)
    const given = entry(gift.giverId, gift.recipientId)
    if (giver.strategy === 'reciprocator' && given.receivedKcal < given.givenKcal)
      violations.push(`${name} went to a forager that owed the reciprocator`)
    given.givenKcal += gift.kcal
    entry(gift.recipientId, gift.giverId).receivedKcal += gift.kcal
  }
  return violations
}

export function assertLifeInvariants(state: LifeState) {
  const violations = lifeInvariantViolations(state)
  if (violations.length) throw new Error(`Life invariants violated at tick ${state.tick}: ${violations.join('; ')}`)
}
