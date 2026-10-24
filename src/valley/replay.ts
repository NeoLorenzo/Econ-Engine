import { positionAlong } from './routes'
import { axeLife } from './axes'
import { energyAt, waterAt } from './body'
import { dailyShare, dayOfYear, MINUTES_PER_DAY } from './calendar'
import { fishGrowth } from './fish'
import { regrowPlaces } from './places'
import type { ValleyState, TaskEvent, Axe } from './types'
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
/** An interval ledger over independent copies. Production is computed before applying the recorded amount. */
export function replayInterval(before: ValleyState, after: ValleyState) {
  const errors: string[] = [],
    fail = (message: string) => errors.push(message)
  const book = {
    config: after.config,
    layout: after.layout,
    foodStock: before.foodStock.slice(),
    woodStock: before.woodStock.slice(),
    logStock: before.logStock.slice(),
    stoneStock: before.stoneStock.slice(),
    felledMinute: before.felledMinute.slice(),
    logRegrowth: new Map([...before.logRegrowth].map(([id, list]) => [id, [...list]])),
  }
  const placeMemory = before.foragers.map((p) => p.placeStock.slice()),
    fishMemory = before.foragers.map((p) => new Map(p.fishMemory))
  const access = new Map(after.layout.nav.accessBanks.map((bank) => [bank.id, bank]))
  const rates = before.foragers.map((p) => ({
    berries: p.forageRate,
    nuts: p.nutRate,
    fish: p.fishRate,
    wood: p.woodRate,
  }))
  const fish = new Map(before.fish.map((f) => [f.bodyId, { ...f }])),
    banks = before.foragers.map((p) => new Map(p.knownBanks))
  const tasks = before.foragers.map((p) =>
    p.task ? { ...p.task, rateChanges: p.task.rateChanges?.map((c) => ({ ...c })) } : null,
  )
  const positions = before.foragers.map((p) => ({ x: p.x, y: p.y }))
  const position = (id: number, minute: number) => {
    const task = tasks[id]
    return task?.kind === 'walk'
      ? positionAlong(after.routes[task.routeId]!, minute - task.startMinute)
      : positions[id]!
  }
  const energy = before.foragers.map((p) => p.energyKcal),
    water = before.foragers.map((p) => p.waterDeficitMl)
  const energyR = before.foragers.map((p) => p.energyRemainder),
    energyT = before.foragers.map((p) => p.energyTimeRemainder)
  const waterR = before.foragers.map((p) => p.waterBaseRemainder),
    waterA = before.foragers.map((p) => p.waterActivityRemainder),
    waterT = before.foragers.map((p) => p.waterTimeRemainder)
  const pick = before.foragers.map((p) => p.pickRemainder),
    gather = before.foragers.map((p) => p.gatherRemainder)
  const lost = before.foragers.map((p) => p.waterLostMl),
    drunk = before.foragers.map((p) => p.waterDrunkMl)
  const withdrawals = new Map(before.waterWithdrawals)
  const expectedGrowth = new Map<string, unknown>(),
    actualGrowth = new Map<string, unknown>()
  const huts = before.huts.map((h) => h.logs),
    cuts = new Set<string>()
  let midnight = (Math.floor(before.minute / MINUTES_PER_DAY) + 1) * MINUTES_PER_DAY
  const tools = new Map<number, { axe: Axe; owner: number }>(
    before.foragers.flatMap((p) =>
      [p.axe, p.spareAxe].filter((a) => a !== null).map((axe) => [axe.id, { axe: { ...axe }, owner: p.id }] as const),
    ),
  )
  const crafting = before.foragers.map((p) => p.making !== null),
    craft = before.foragers.map((p) => p.craft)
  let begun = 0,
    madeCount = 0,
    wornCount = 0
  let gathered = 0,
    gatheredWood = 0,
    spent = 0,
    spoiled = 0
  const growUntil = (minute: number) => {
    while (midnight <= minute) {
      const oldFood = book.foodStock.slice(),
        oldWood = book.woodStock.slice(),
        oldLogs = book.logStock.slice()
      regrowPlaces(book, midnight)
      for (let id = 0; id < book.layout.places.count; id++) {
        const delta = {
          kcal: book.foodStock[id]! - oldFood[id]!,
          wood: book.woodStock[id]! - oldWood[id]!,
          logs: book.logStock[id]! - oldLogs[id]!,
        }
        if (delta.kcal || delta.wood || delta.logs) expectedGrowth.set(`${midnight}:place:${id}`, delta)
      }
      for (const f of fish.values()) {
        const growth = fishGrowth(
          f.capacity,
          f.stock,
          f.remainder,
          after.config.fishGrowthPercentPerYear,
          after.config.daysPerYear,
        )
        f.stock += growth.grown
        f.grown += growth.grown
        f.remainder = growth.remainder
        expectedGrowth.set(`${midnight}:fish:${f.bodyId}`, { kcal: growth.grown, remainder: growth.remainder })
      }
      midnight += MINUTES_PER_DAY
    }
  }
  const checkStart = (event: TaskEvent) => {
    const id = event.foragerId,
      t = event.task
    if (tasks[id]) fail(`person ${id}: a task started without ending its predecessor`)
    energy[id]! += event.ateKcal ?? 0
    spoiled += event.spoiledKcal ?? 0
    if (
      t.startEnergyKcal !== energy[id] ||
      t.startWaterMl !== water[id] ||
      t.startEnergyRemainder !== energyR[id] ||
      (t.startEnergyTimeRemainder ?? 0) !== energyT[id] ||
      t.startWaterRemainder !== waterR[id] ||
      t.startWaterActivityRemainder !== waterA[id] ||
      (t.startWaterTimeRemainder ?? 0) !== waterT[id]
    )
      fail(`person ${id}: task start body differs from its ledger`)
    const c = after.config
    if (t.kind !== 'sleep') {
      const rate =
        t.kind === 'walk'
          ? c.walkKcalPerHour
          : ['pick', 'nuts', 'fish'].includes(t.kind)
            ? c.pickKcalPerHour
            : t.kind === 'gather'
              ? c.gatherKcalPerHour
              : t.kind === 'cut'
                ? c.chopKcalPerHour
                : t.kind === 'make'
                  ? c.makeKcalPerHour
                  : c.restKcalPerHour
      if (t.energyPerHour !== rate) fail('Hourly energy rate differs from its task kind')
    }
    if (
      t.waterBaseMlPerDay !== c.waterBaseMlPerDay ||
      t.waterExtraMlPerKcal !== c.waterExtraMlPerKcal ||
      t.restKcalPerHour !== c.restKcalPerHour ||
      t.drinkMlPerMinute !== c.drinkMlPerSecond * 60
    )
      fail('Body task carries the wrong hydration parameters')
    if (t.kind === 'pick' || t.kind === 'nuts') {
      const cap = t.kind === 'pick' ? c.berryThicketCapacityKcal : c.hazelThicketCapacityKcal,
        full = t.kind === 'pick' ? rates[id]!.berries : rates[id]!.nuts
      const stock = placeMemory[id]![t.placeId]! < 0 ? cap : placeMemory[id]![t.placeId]!
      if (t.productionPerHour !== Math.floor((full * stock) / cap))
        fail('Food task rate does not match remembered stock')
    }
    if (t.kind === 'fish') {
      const bank = banks[id]!.get(t.placeId),
        memory = bank ? fishMemory[id]!.get(bank.bodyId) : undefined
      const rate = memory
        ? memory.capacity
          ? Math.floor((rates[id]!.fish * memory.stock) / memory.capacity)
          : 0
        : rates[id]!.fish
      if (t.productionPerHour !== rate) fail('Fishing rate does not match remembered body stock')
    }
    if (
      t.kind === 'gather' &&
      t.productionPerHour !== (after.layout.places.kind[t.placeId] === 3 ? 60 : rates[id]!.wood)
    )
      fail('Gathering rate does not match skill or stone pickup')
    if (t.startMinute !== event.minute || t.endMinute <= event.minute) fail(`person ${id}: invalid task interval`)
    if (t.kind === 'make' && !crafting[id]) {
      crafting[id] = true
      begun++
    }
    if (t.kind === 'sleep') {
      const whole = after.huts.some(
        (h) =>
          h.builderId === id &&
          h.x === event.position.x &&
          h.y === event.position.y &&
          (huts[h.id] ?? 0) >= after.config.hutLogs &&
          (h.abandonedMinute === null || h.abandonedMinute > event.minute),
      )
      if (whole !== t.wholeHut) fail('Sleeping hut status does not match its delivered logs')
    }
    tasks[id] = { ...t, rateChanges: t.rateChanges?.map((change) => ({ ...change })) }
  }
  const checkEnd = (event: TaskEvent) => {
    const id = event.foragerId,
      t = event.task,
      active = tasks[id]
    if (!active || !same(active, t)) fail(`person ${id}: task end does not match its recorded task`)
    const e = energyAt(t, event.minute, after.routes),
      w = waterAt(t, event.minute, after.routes)
    const charge = { kcal: t.startEnergyKcal - Math.max(0, e.kcal), waterLossMl: w.loss, drankMl: w.drink }
    if (!same(charge, event.paid)) fail(`person ${id}: body charge does not match its task`)
    energy[id] = Math.max(0, e.kcal) + (event.ateKcal ?? 0)
    water[id] = w.ml
    energyR[id] = e.remainder
    energyT[id] = e.timeRemainder ?? 0
    waterR[id] = w.remainder
    waterA[id] = w.activityRemainder
    waterT[id] = w.timeRemainder
    lost[id]! += w.loss
    drunk[id]! += w.drink
    spent += charge.kcal
    spoiled += event.spoiledKcal ?? 0
    const elapsed = event.minute - t.startMinute,
      produced = { kcal: 0, wood: 0, logs: 0, stones: 0 }
    if (['pick', 'nuts', 'fish'].includes(t.kind)) {
      const owed = pick[id]! + t.productionPerHour * elapsed,
        wanted = Math.floor(owed / 60)
      if (t.kind === 'fish') {
        const bank = banks[id]!.get(t.placeId),
          f = bank ? fish.get(bank.bodyId) : undefined
        if (!f) fail(`person ${id}: fishing without an observed body`)
        else {
          produced.kcal = Math.min(wanted, f.stock)
          f.stock -= produced.kcal
          f.caught += produced.kcal
          fishMemory[id]!.set(f.bodyId, { stock: f.stock, capacity: f.capacity, minute: event.minute })
          pick[id] = f.stock ? owed % 60 : 0
        }
      } else {
        produced.kcal = Math.min(wanted, book.foodStock[t.placeId]!)
        book.foodStock[t.placeId]! -= produced.kcal
        pick[id] = book.foodStock[t.placeId] ? owed % 60 : 0
      }
      gathered += produced.kcal
    }
    if (t.kind === 'gather') {
      if (book.layout.places.kind[t.placeId] === 3) {
        produced.stones = elapsed > 0 ? Math.min(1, book.stoneStock[t.placeId]!) : 0
        book.stoneStock[t.placeId]! -= produced.stones
      } else {
        const owed = gather[id]! + t.productionPerHour * elapsed
        produced.wood = Math.min(
          Math.floor(owed / 60),
          book.woodStock[t.placeId]!,
          after.config.woodLoad - (t.startTripWood ?? 0),
        )
        book.woodStock[t.placeId]! -= produced.wood
        gather[id] = book.woodStock[t.placeId] ? owed % 60 : 0
        gatheredWood += produced.wood
      }
    }
    // Each cut record belongs to one task: a cut started and interrupted in the same minute produced nothing.
    if (t.kind === 'cut' && cuts.delete(`${event.minute}:${id}`)) produced.logs = 1
    if (!same(produced, event.produced)) fail(`person ${id}: task production does not match its stock and rate`)
    tasks[id] = null
  }
  for (const event of after.lastInterval) {
    growUntil(event.minute)
    if (event.kind === 'task-start' || event.kind === 'task-end') positions[event.foragerId] = { ...event.position }
    if (event.kind === 'observe') {
      if (!same(event.origin, position(event.foragerId, event.minute)))
        fail('Observation origin differs from its recorded task position')
      for (const seen of event.seenPeople)
        if (!same(seen.position, position(seen.id, event.minute)))
          fail('Observed person differs from its lazy position')
      for (const id of event.people) {
        const point = position(id, event.minute)
        if ((point.x - event.origin.x) ** 2 + (point.y - event.origin.y) ** 2 > after.config.talkRadiusCm ** 2)
          fail('Meeting recorded beyond talking distance')
      }
      if (event.stock) {
        const stock = event.stock,
          id = stock.placeId
        const kind = after.layout.places.kind[id]!
        placeMemory[event.foragerId]![id] = kind < 2 ? stock.food : kind === 2 ? stock.wood : stock.stones
        if (
          stock.food !== book.foodStock[id] ||
          stock.wood !== book.woodStock[id] ||
          stock.logs !== book.logStock[id] ||
          stock.stones !== book.stoneStock[id]
        )
          fail('Observed stock differs from the current place ledger')
      }
      for (const bank of event.banks) {
        const source = access.get(bank.id)
        if (
          !source ||
          bank.bodyId !== source.bodyId ||
          bank.x !== source.x ||
          bank.y !== source.y ||
          bank.triangle !== source.triangle
        )
          fail('Observed bank differs from immutable geography')
        banks[event.foragerId]!.set(bank.id, bank)
      }
    }
    if (event.kind === 'task-start') checkStart(event)
    if (event.kind === 'task-end') checkEnd(event)
    if (event.kind === 'rate-change') {
      const task = tasks[event.foragerId]
      if (!task || task.kind !== 'sleep' || event.minute % 60)
        fail('A warmth rate changed outside a sleeping hourly boundary')
      else
        task.rateChanges = [...(task.rateChanges ?? []), { minute: event.minute, energyPerHour: event.energyPerHour }]
    }
    if (event.kind === 'regrowth')
      actualGrowth.set(`${event.minute}:place:${event.placeId}`, {
        kcal: event.kcal,
        wood: event.wood,
        logs: event.logs,
      })
    if (event.kind === 'fish-regrowth')
      actualGrowth.set(`${event.minute}:fish:${event.bodyId}`, { kcal: event.kcal, remainder: event.remainder })
    if (event.kind === 'practice') {
      craft[event.foragerId] = event.craft
      rates[event.foragerId] = {
        berries: event.forageRate,
        nuts: event.nutRate,
        fish: event.fishRate,
        wood: event.woodRate,
      }
    }
    if (event.kind === 'made') {
      if (
        tools.has(event.axe.id) ||
        event.craft !== craft[event.foragerId] ||
        event.axe.quality < Math.max(1, Math.floor(event.craft / 2)) ||
        event.axe.quality > event.craft ||
        event.axe.logsLeft !== axeLife(after.config, event.axe.quality)
      )
        fail('Made axe has impossible quality or identity')
      tools.set(event.axe.id, { axe: { ...event.axe }, owner: event.foragerId })
      crafting[event.foragerId] = false
      madeCount++
    }
    if (event.kind === 'sale') {
      const tool = tools.get(event.axe.id)
      if (!tool || tool.owner !== event.sellerId || !same(tool.axe, event.axe))
        fail('Axe sale does not match the seller inventory')
      if (tool) tool.owner = event.buyerId
    }
    if (event.kind === 'worn') {
      const tool = tools.get(event.axeId)
      if (!tool || tool.owner !== event.foragerId || tool.axe.logsLeft !== 0) fail('Axe worn without its last cut')
      tools.delete(event.axeId)
      wornCount++
    }
    if (event.kind === 'cut') {
      const tool = tools.get(event.axeId)
      if (
        !tool ||
        tool.owner !== event.foragerId ||
        tool.axe.quality !== event.quality ||
        event.axeLogsLeft !== tool.axe.logsLeft - 1
      )
        fail('Cut record has wrong axe quality or wear')
      if (tool) tool.axe.logsLeft--
      const id = event.treeId,
        felled = book.logStock[id]! % after.config.logsPerTree === 0
      if (event.felled !== felled || book.logStock[id]! <= 0) fail('Cut record felled the wrong stand')
      if (felled) {
        book.felledMinute[id] = event.minute
        book.woodStock[id]! += after.config.fellWood
      }
      book.logStock[id]!--
      if (book.logStock[id]! % after.config.logsPerTree === 0) {
        book.logRegrowth.set(id, [...(book.logRegrowth.get(id) ?? []), book.felledMinute[id]!])
        book.felledMinute[id] = -1
      }
      if (event.treeLogsAfter !== book.logStock[id]) fail('Cut record has the wrong remaining logs')
      cuts.add(`${event.minute}:${event.foragerId}`)
    }
    if (event.kind === 'drink') {
      const bank = banks[event.foragerId]!.get(event.bankId)
      if (!bank || bank.bodyId !== event.bodyId) fail('Drink record has the wrong body identity')
      const end = after.lastInterval.find(
        (e) => e.kind === 'task-end' && e.foragerId === event.foragerId && e.minute === event.minute,
      )
      if (
        !end ||
        end.kind !== 'task-end' ||
        end.task.kind !== 'drink' ||
        event.volumeMl !== waterAt(end.task, event.minute, after.routes).drink
      )
        fail('Drink record has the wrong withdrawal')
      withdrawals.set(event.bodyId, (withdrawals.get(event.bodyId) ?? 0) + event.volumeMl)
    }
    if (event.kind === 'delivery' && event.hutId !== null) huts[event.hutId] = (huts[event.hutId] ?? 0) + event.logs
    if (event.kind === 'weather') huts[event.hutId]!--
  }
  growUntil(after.minute)
  for (const [key, value] of expectedGrowth)
    if (!same(value, actualGrowth.get(key))) fail(`Regrowth record does not match the daily share: ${key}`)
  for (const key of actualGrowth.keys()) if (!expectedGrowth.has(key)) fail(`Unexpected regrowth record: ${key}`)
  for (const field of ['foodStock', 'woodStock', 'logStock', 'stoneStock', 'felledMinute'] as const)
    if (!same([...book[field]], [...after[field]])) fail(`${field} changed without a matching record`)
  if (!same([...book.logRegrowth], [...after.logRegrowth])) fail('Log regrowth deadlines changed without a cut record')
  for (const f of after.fish) {
    const expected = fish.get(f.bodyId)
    if (!same(expected, f)) fail(`Fish body ${f.bodyId} stock or remainder differs from its ledger`)
  }
  if (
    !same(
      huts,
      after.huts.map((h) => h.logs),
    )
  )
    fail('A hut changed without a delivery or weather record')
  if (
    !same(
      [...withdrawals].sort((a, b) => a[0] - b[0]),
      [...after.waterWithdrawals].sort((a, b) => a[0] - b[0]),
    )
  )
    fail('External water withdrawals do not add up')
  for (const p of after.foragers) {
    const id = p.id
    if (
      p.energyKcal !== energy[id] ||
      p.waterDeficitMl !== water[id] ||
      p.energyRemainder !== energyR[id] ||
      p.energyTimeRemainder !== energyT[id] ||
      p.waterBaseRemainder !== waterR[id] ||
      p.waterActivityRemainder !== waterA[id] ||
      p.waterTimeRemainder !== waterT[id] ||
      p.waterLostMl !== lost[id] ||
      p.waterDrunkMl !== drunk[id]
    )
      fail(`person ${id}: final body differs from its charged ledger`)
    if (!same(p.task, tasks[id])) fail(`person ${id}: final task differs from its event ledger`)
  }
  const actualTools = new Map(
    after.foragers.flatMap((p) =>
      [p.axe, p.spareAxe].filter((a) => a !== null).map((axe) => [axe.id, { axe, owner: p.id }] as const),
    ),
  )
  if (
    !same(
      [...tools].sort((a, b) => a[0] - b[0]),
      [...actualTools].sort((a, b) => a[0] - b[0]),
    )
  )
    fail('Tool inventory differs from its making, cutting and sale records')
  if (
    after.totals.stonesWorked - before.totals.stonesWorked !== begun ||
    after.totals.axeWood - before.totals.axeWood !== begun * after.config.axeWood ||
    after.totals.axesMade - before.totals.axesMade !== madeCount ||
    after.totals.axesWornOut - before.totals.axesWornOut !== wornCount
  )
    fail('Axe input or output counters differ from task records')
  for (const [field, total] of [
    ['gatheredKcal', gathered],
    ['gatheredWood', gatheredWood],
    ['metabolizedKcal', spent],
    ['spoiledKcal', spoiled],
  ] as const)
    if (after.totals[field] - before.totals[field] !== total) fail(`${field} differs from interval records`)
  return errors
}
/** The public calendar arithmetic is also checked independently over every configured day. */
export function annualShares(state: ValleyState) {
  return [
    state.config.berryThicketRegrowthKcalPerYear,
    state.config.hazelThicketRegrowthKcalPerYear,
    state.config.standDeadfallKgPerYear,
  ].every((amount) => {
    let total = 0
    for (let day = 0; day < state.config.daysPerYear; day++)
      total += dailyShare(amount, dayOfYear(state.config, day * MINUTES_PER_DAY), state.config.daysPerYear)
    return total === amount
  })
}
