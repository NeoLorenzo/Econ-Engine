import { MINUTES_PER_DAY, isDaylight, minuteOfWork, plantsInView } from './forager'
import { distance, distanceSq } from './geometry'
import { ratesOf } from './practice'
import { hearthAround, livingMembers, placeCentre, placeCount, placeInView, placeWanted, placesPerSide } from './social'
import { bothGain } from './trade'
import { hourlyShare } from './work'
import type { Point, ValleyState } from './types'

const inRemainderRange = (remainder: number) => Number.isInteger(remainder) && remainder >= 0 && remainder < 3_600

const sum = (values: Int32Array) => {
  let total = 0
  for (const value of values) total += value
  return total
}

/**
 * Checks every invariant of the specification after every minute of a run. It keeps its own copy of every plant's
 * stock and replays each minute's regrowth and recorded work onto it, so a stock that changed without a record, or a
 * record that does not match the stock, is caught: the plants worked are compared every minute and every plant every
 * hour. Plants in a forager's view are checked against its memory in full in the first minute of every hour, and the
 * plant it worked or walked towards every minute.
 */
export class ValleyChecker {
  private bushes: Int32Array
  private trees: Int32Array
  private bushTotal: number
  private treeTotal: number
  private aliveBefore: boolean[]
  private burnHour: number[]
  private rates: [number, number][]
  private turns: Int32Array
  private practised: Int32Array
  /** Each forager's group and hearth at the end of the minute before. */
  private groupBefore: (number | null)[]
  private hearthBefore: Point[]

  constructor(state: ValleyState) {
    this.bushes = state.bushKcal.slice()
    this.trees = state.treeWood.slice()
    this.bushTotal = sum(this.bushes)
    this.treeTotal = sum(this.trees)
    this.aliveBefore = state.foragers.map((forager) => forager.alive)
    this.burnHour = state.foragers.map(() => -1)
    this.rates = state.foragers.map((forager) => [forager.forageRate, forager.woodRate])
    this.turns = new Int32Array(state.foragers.length)
    this.practised = new Int32Array(state.foragers.length)
    this.groupBefore = state.foragers.map((forager) => forager.groupId)
    this.hearthBefore = state.foragers.map((forager) => forager.hearth)
  }

  /** Every invariant the minute just run breaks; an empty list means it is sound. */
  check(state: ValleyState): string[] {
    const { config, layout, totals } = state
    const minute = state.minute - 1
    const violations: string[] = []
    const fail = (message: string) => violations.push(`Minute ${minute}: ${message}`)

    if (minute > 0 && minute % 60 === 0) {
      const hour = (minute / 60) % 24
      const berries = hourlyShare(config.bushRegrowthKcalPerDay, hour)
      const deadwood = hourlyShare(config.treeRegrowthWoodPerDay, hour)
      for (let id = 0; id < this.bushes.length; id += 1) {
        const after = Math.min(config.bushCapacityKcal, this.bushes[id]! + berries)
        this.bushTotal += after - this.bushes[id]!
        this.bushes[id] = after
      }
      for (let id = 0; id < this.trees.length; id += 1) {
        const after = Math.min(config.treeCapacityWood, this.trees[id]! + deadwood)
        this.treeTotal += after - this.trees[id]!
        this.trees[id] = after
      }
    }

    // Practice happens in the first minute of a day after the first, once for each forager alive at its start, and
    // every forager alive at the start of a minute takes exactly one turn in it.
    const midnight = minute > 0 && minute % MINUTES_PER_DAY === 0
    const turns = this.turns.fill(0)
    const practised = this.practised.fill(0)
    for (const event of state.lastEvents) turns[event.foragerId]! += 1
    for (const event of state.lastPractice) practised[event.foragerId]! += 1
    for (let id = 0; id < this.aliveBefore.length; id += 1) {
      const alive = this.aliveBefore[id]!
      if (turns[id] !== (alive ? 1 : 0)) fail(`forager ${id} did not take exactly one turn`)
      if (practised[id] !== (alive && midnight ? 1 : 0)) fail(`forager ${id} did not practise exactly once at midnight`)
    }

    // The plants worked this minute, compared with the replay once every event has been applied.
    const touchedBushes: number[] = []
    const touchedTrees: number[] = []
    const fullView = minute % 60 === 0
    const daylight = isDaylight(config, minute)
    const reach2 = config.reachCm ** 2
    for (const event of state.lastEvents) {
      const forager = state.foragers[event.foragerId]!
      const { from, position } = event
      const total = event.walkSeconds + event.workSeconds + event.standSeconds + event.sleepSeconds
      if (total !== 60) fail(`forager ${forager.id}'s seconds add up to ${total}`)
      if (position.x < 0 || position.y < 0 || position.x > config.valleySizeCm || position.y > config.valleySizeCm)
        fail(`forager ${forager.id} left the valley`)
      if (distance(from.x, from.y, position.x, position.y) > event.walkSeconds * config.walkCmPerSecond)
        fail(`forager ${forager.id} moved further than it walked`)
      const food = event.workedFor === 'food'
      const plants = food ? layout.bushes : layout.trees
      const stocks = food ? this.bushes : this.trees
      const memory = food ? forager.bushMemory : forager.treeMemory
      // What it remembers matches what it saw at the start of its turn, before its own work.
      const target = event.targetId
      if (
        target !== null &&
        (plants.x[target]! - from.x) ** 2 + (plants.y[target]! - from.y) ** 2 <= config.perceptionRadiusCm ** 2 &&
        (memory.seen[target] !== minute || memory.stock[target] !== stocks[target])
      )
        fail(`forager ${forager.id}'s memory of its target does not match what it saw`)
      if (fullView) {
        for (const [kindPlants, kindIndex, kindStocks, kindMemory] of [
          [layout.bushes, layout.bushIndex, this.bushes, forager.bushMemory],
          [layout.trees, layout.treeIndex, this.trees, forager.treeMemory],
        ] as const) {
          for (const id of plantsInView(config, kindIndex, kindPlants, from.x, from.y)) {
            if (kindMemory.seen[id] !== minute || kindMemory.stock[id] !== kindStocks[id])
              fail(`forager ${forager.id}'s memory of a plant in view does not match what it saw`)
          }
        }
      }
      if (event.workSeconds) {
        if (!daylight) fail(`forager ${forager.id} worked at night`)
        if (event.plantId === null) fail(`forager ${forager.id} worked no plant`)
        else {
          const id = event.plantId
          if ((plants.x[id]! - position.x) ** 2 + (plants.y[id]! - position.y) ** 2 > reach2)
            fail(`forager ${forager.id} worked a plant out of reach`)
          const rate = food ? forager.forageRate : forager.woodRate
          if (stocks[id]! < minuteOfWork(rate))
            fail(`forager ${forager.id} worked a plant holding less than a minute's work`)
          const taken = food ? event.gatheredKcal : event.gatheredWood
          if (taken > stocks[id]!) fail(`forager ${forager.id} took more than the plant held`)
          stocks[id]! -= taken
          if (food) {
            this.bushTotal -= taken
            touchedBushes.push(id)
          } else {
            this.treeTotal -= taken
            touchedTrees.push(id)
          }
        }
      } else if (event.gatheredKcal || event.gatheredWood)
        fail(`forager ${forager.id} took from a plant without working`)
      // Its hearth while it acted: a forager that joins a group moves its hearth only after its action.
      const hearth = this.hearthBefore[forager.id]!
      if (event.sleepSeconds) {
        if (daylight) fail(`forager ${forager.id} slept in daylight`)
        if (from.x !== hearth.x || from.y !== hearth.y) fail(`forager ${forager.id} slept away from its hearth`)
      }
      if (!daylight && forager.alive && event.reason !== 'going home' && event.reason !== 'night')
        fail(`forager ${forager.id} is up at night`)
      if (event.burnedWood) {
        const hour = Math.floor(minute / 60)
        if (!event.sleepSeconds) fail(`forager ${forager.id} burned wood awake`)
        if (this.burnHour[forager.id] === hour) fail(`forager ${forager.id} burned wood twice in an hour`)
        if (event.burnedWood !== config.fireWoodPerHour) fail(`forager ${forager.id} burned the wrong amount of wood`)
        this.burnHour[forager.id] = hour
      }
      if (position.x === hearth.x && position.y === hearth.y && event.tripWoodAfter !== 0)
        fail(`forager ${forager.id} is at its hearth with a load still counted`)
      if (event.reason === 'filling a load') {
        const before = event.tripWoodAfter - event.gatheredWood
        if (before <= 0 || before >= config.woodLoad) fail(`forager ${forager.id} filled a load it was not carrying`)
      }
    }
    for (const id of touchedBushes)
      if (state.bushKcal[id] !== this.bushes[id]) fail(`bush ${id} holds ${state.bushKcal[id]}, not ${this.bushes[id]}`)
    // Work only ever takes, and regrowth stops at capacity, so every stock the replay holds stays in range.
    for (const id of touchedTrees)
      if (state.treeWood[id] !== this.trees[id]) fail(`tree ${id} holds ${state.treeWood[id]}, not ${this.trees[id]}`)
    if (minute % 60 === 0) {
      for (let id = 0; id < this.bushes.length; id += 1)
        if (state.bushKcal[id] !== this.bushes[id]) fail(`bush ${id} changed without a record`)
      for (let id = 0; id < this.trees.length; id += 1)
        if (state.treeWood[id] !== this.trees[id]) fail(`tree ${id} changed without a record`)
    }

    // One pass over the band sums what the balances need.
    let reserves = 0
    let carried = 0
    let wood = 0
    let woodSold = 0
    let woodBought = 0
    let kcalReceived = 0
    let kcalPaid = 0
    for (const forager of state.foragers) {
      reserves += forager.energyKcal
      for (const lot of forager.carried) carried += lot.kcal
      wood += forager.wood
      woodSold += forager.swapTotals.woodSold
      woodBought += forager.swapTotals.woodBought
      kcalReceived += forager.swapTotals.kcalReceived
      kcalPaid += forager.swapTotals.kcalPaid
    }
    const held = this.bushTotal + reserves + carried + totals.metabolizedKcal + totals.spoiledKcal
    if (held !== totals.initialKcal + totals.regrownKcal)
      fail(`energy is not conserved: ${held} held, ${totals.initialKcal + totals.regrownKcal} supplied`)
    if (this.treeTotal + wood + totals.burnedWood !== totals.initialWood + totals.regrownWood)
      fail('wood is not conserved')
    if (
      woodSold !== totals.swappedWood ||
      woodBought !== totals.swappedWood ||
      kcalReceived !== totals.swappedKcal ||
      kcalPaid !== totals.swappedKcal
    )
      fail('swap totals disagree')

    const minuteInDay = minute % MINUTES_PER_DAY
    const agreed =
      state.lastSwaps.length || state.lastQuotes.length
        ? [...state.lastSwaps, ...state.lastQuotes].map((made) => made.kcalPerWood)
        : []
    // With groups, every swap and quote is between members of one group, and terms are heard only within it.
    const agreedByGroup = new Map<number, number[]>()
    if (config.groups)
      for (const made of [...state.lastSwaps, ...state.lastQuotes]) {
        const seller = state.foragers[made.sellerId]!
        const buyer = state.foragers[made.buyerId]!
        if (seller.groupId === null || seller.groupId !== buyer.groupId) fail('a swap or quote crossed groups')
        else agreedByGroup.set(seller.groupId, [...(agreedByGroup.get(seller.groupId) ?? []), made.kcalPerWood])
      }
    for (const forager of state.foragers) {
      if (forager.energyKcal < 0 || forager.energyKcal > config.reserveMaxKcal)
        fail(`forager ${forager.id}'s reserve is out of range`)
      if (!forager.alive && forager.energyKcal !== 0) fail(`forager ${forager.id} is dead but has a reserve`)
      if (!inRemainderRange(forager.pickRemainder) || !inRemainderRange(forager.gatherRemainder))
        fail(`forager ${forager.id} has a remainder out of range`)
      if (!inRemainderRange(forager.costRemainder)) fail(`forager ${forager.id} has a remainder out of range`)
      if (!Number.isInteger(forager.wood) || forager.wood < 0) fail(`forager ${forager.id} holds ${forager.wood} wood`)
      // Carried lots are checked one by one every hour, and every minute at their ends: the oldest must not have
      // spoiled and the newest must not be from the future.
      const lots = forager.carried
      if (lots.length) {
        for (const lot of fullView ? lots : [lots[0]!, lots[lots.length - 1]!]) {
          if (!Number.isInteger(lot.kcal) || lot.kcal <= 0)
            fail(`forager ${forager.id} carries a lot of ${lot.kcal} kcal`)
          if (lot.harvestTick > minute) fail(`forager ${forager.id} carries food picked in the future`)
          if (config.shelfLifeHours > 0 && lot.harvestTick <= minute - 60 * config.shelfLifeHours)
            fail(`forager ${forager.id} carries food that should have spoiled`)
        }
        if (fullView)
          for (let index = 1; index < lots.length; index += 1)
            if (lots[index]!.harvestTick < lots[index - 1]!.harvestTick)
              fail(`forager ${forager.id}'s lots are out of order`)
      }
      const heard = forager.heardTerms
      if (heard && heard.minute > minute) fail(`forager ${forager.id} remembers terms from the future`)
      if (heard?.minute === minute && !agreed.includes(heard.kcalPerWood))
        fail(`forager ${forager.id} remembers terms no one agreed this minute`)
      if (heard?.minute === minute && config.groups) {
        const ownGroup = (agreedByGroup.get(forager.groupId ?? -1) ?? []).includes(heard.kcalPerWood)
        if (!ownGroup) fail(`forager ${forager.id} heard terms from outside its group`)
      }
      const log = forager.practiceLog
      const today = forager.secondsToday
      if (forager.alive && today.forage + today.gather > 60 * (minuteInDay + 1))
        fail(`forager ${forager.id} worked more seconds today than have passed`)
      if (forager.loggedSeconds.forage + today.forage !== forager.secondsWorked.forage)
        fail(`forager ${forager.id}'s practice lost or invented seconds at foraging`)
      if (forager.loggedSeconds.gather + today.gather !== forager.secondsWorked.gather)
        fail(`forager ${forager.id}'s practice lost or invented seconds at gathering`)
      // Logs and rates change only at midnight: they are checked in full then, and for change every other minute.
      const rates = this.rates[forager.id]!
      if (midnight || minute === 0) {
        if (log.forage.length !== config.practiceDays || log.gather.length !== config.practiceDays)
          fail(`forager ${forager.id}'s practice log has the wrong length`)
        for (const seconds of [...log.forage, ...log.gather])
          if (!Number.isInteger(seconds) || seconds < 0 || seconds > 86_400)
            fail(`forager ${forager.id}'s practice log is out of range`)
        if (forager.alive) {
          const expected = ratesOf(config, forager.foragingSkill, forager.woodSkill, log)
          if (expected.forageRate !== forager.forageRate || expected.woodRate !== forager.woodRate)
            fail(`forager ${forager.id}'s rates do not follow from its skills and practice`)
        }
      } else if (forager.forageRate !== rates[0] || forager.woodRate !== rates[1])
        fail(`forager ${forager.id}'s rates changed mid-day`)
      rates[0] = forager.forageRate
      rates[1] = forager.woodRate
    }
    for (const made of state.lastSwaps) {
      const seller = state.foragers[made.sellerId]!
      const buyer = state.foragers[made.buyerId]!
      if (!bothGain(seller, buyer, made.kcalPerWood)) fail('a swap did not pay both sides')
      if (made.kcal !== made.wood * made.kcalPerWood || made.wood < 1) fail('a swap does not add up')
    }
    this.checkKnowledge(state, minute, midnight || minute === 0, fail)
    this.checkGroups(state, fail)
    for (const forager of state.foragers) this.aliveBefore[forager.id] = forager.alive
    this.groupBefore = state.foragers.map((forager) => forager.groupId)
    this.hearthBefore = state.foragers.map((forager) => forager.hearth)
    return violations
  }

  /**
   * What a forager knows: places near where it stood are marked seen this minute exactly when they lay wholly in view;
   * a place it walked towards was worth exploring or searching; and, in full at midnight, plants never seen say so and
   * its count of places seen is right.
   */
  private checkKnowledge(state: ValleyState, minute: number, full: boolean, fail: (message: string) => void) {
    const { config, layout } = state
    const n = placesPerSide(config)
    const r = config.perceptionRadiusCm
    for (const event of state.lastEvents) {
      const forager = state.foragers[event.foragerId]!
      const { from } = event
      const column0 = Math.max(0, Math.floor((from.x - r) / config.placeCm))
      const column1 = Math.min(n - 1, Math.floor((from.x + r) / config.placeCm))
      const row0 = Math.max(0, Math.floor((from.y - r) / config.placeCm))
      const row1 = Math.min(n - 1, Math.floor((from.y + r) / config.placeCm))
      for (let row = row0; row <= row1; row += 1)
        for (let column = column0; column <= column1; column += 1) {
          const place = row * n + column
          // Knowing the valley, a forager has seen every place at minute 0.
          const seenNow = forager.placeSeen[place] === minute && !(config.knowValley && minute === 0)
          if (seenNow !== placeInView(config, place, from.x, from.y) && !(config.knowValley && minute === 0))
            fail(`forager ${forager.id}'s memory of place ${place} does not match what it saw`)
        }
      if (event.placeId !== null) {
        const why = event.reason === 'searching' ? 'search' : 'explore'
        if (!placeWanted(config, forager, event.placeId, minute, why))
          fail(`forager ${forager.id} walked to a place it did not need to see`)
        const centre = placeCentre(config, event.placeId)
        const before = distanceSq(from.x, from.y, centre.x, centre.y)
        if (distanceSq(event.position.x, event.position.y, centre.x, centre.y) > before)
          fail(`forager ${forager.id} walked away from the place it set out to see`)
      }
    }
    if (!full) return
    for (const forager of state.foragers) {
      let seenPlaces = 0
      for (const seen of forager.placeSeen) {
        if (seen > minute || seen < -1) fail(`forager ${forager.id} remembers a place out of time`)
        if (seen >= 0) seenPlaces += 1
      }
      if (seenPlaces !== forager.placesSeen || forager.placesSeen > placeCount(config))
        fail(`forager ${forager.id}'s count of places seen is wrong`)
      for (const [plants, memory] of [
        [layout.bushes, forager.bushMemory],
        [layout.trees, forager.treeMemory],
      ] as const)
        for (let id = 0; id < plants.count; id += 1) {
          const seen = memory.seen[id]!
          if (seen > minute || seen < -1 || (seen < 0 && memory.stock[id] !== 0))
            fail(`forager ${forager.id}'s memory of a plant it has never seen is not empty`)
        }
    }
  }

  /**
   * Groups: who belongs to which, how they met, where their hearths lie, and that no forager without a group is left
   * within talking distance of another at the end of its turn.
   */
  private checkGroups(state: ValleyState, fail: (message: string) => void) {
    const { config } = state
    if (!config.groups) {
      if (state.groups.length || state.foragers.some((forager) => forager.groupId !== null))
        fail('there are groups with groups off')
      return
    }
    // Where each forager stood at each turn of the minute, or null if it was dead: after its own turn once it has had
    // one, and where it started the minute before.
    const turnIndex = new Map(state.lastEvents.map((event, index) => [event.foragerId, index]))
    const died = new Set(state.lastDeaths.map((death) => death.foragerId))
    const standing = (id: number, atTurn: number) => {
      const index = turnIndex.get(id)
      if (index === undefined) return null
      const event = state.lastEvents[index]!
      if (index < atTurn) return died.has(id) ? null : event.position
      return event.from
    }
    const nearestAt = (id: number, atTurn: number, at: Point) => {
      let best: number | null = null
      let bestSq = config.talkRadiusCm ** 2
      for (const other of state.foragers) {
        if (other.id === id) continue
        const spot = standing(other.id, atTurn)
        if (!spot) continue
        const sq = distanceSq(at.x, at.y, spot.x, spot.y)
        if (sq < bestSq || (sq === bestSq && (best === null || other.id < best))) {
          best = other.id
          bestSq = sq
        }
      }
      return best
    }
    // The minute's foundings, joinings and dissolutions, replayed in order from each forager's group the minute before.
    const current = [...this.groupBefore]
    for (const made of state.lastGroupEvents) {
      if (made.kind === 'dissolve') {
        if (made.survivorId !== null) {
          if (current[made.survivorId] !== made.groupId) fail(`forager ${made.survivorId} survived a group not its own`)
          current[made.survivorId] = null
        }
        continue
      }
      const id = made.kind === 'found' ? made.founderIds[0] : made.foragerId
      const met = made.kind === 'found' ? made.founderIds[1] : made.metId
      const index = turnIndex.get(id)!
      const at = state.lastEvents[index]!.position
      if (nearestAt(id, index, at) !== met)
        fail(`forager ${id} did not meet the nearest forager within talking distance`)
      if (current[id] !== null) fail(`forager ${id} joined a group though it had one`)
      current[id] = made.groupId
      if (made.kind === 'found') {
        const other = standing(met, index)!
        const flag = { x: Math.floor((at.x + other.x) / 2), y: Math.floor((at.y + other.y) / 2) }
        if (made.flag.x !== flag.x || made.flag.y !== flag.y)
          fail(`group ${made.groupId}'s flag is not at the midpoint`)
        if (current[met] !== null) fail(`forager ${met} founded a group though it had one`)
        current[met] = made.groupId
      } else if (current[met] !== made.groupId) fail(`forager ${id} joined a group the forager it met was not in`)
    }
    for (const forager of state.foragers) {
      const before = this.groupBefore[forager.id]
      if (current[forager.id] !== forager.groupId)
        fail(`forager ${forager.id} changed group without meeting or dissolving`)
      if (forager.groupId !== null) {
        const group = state.groups[forager.groupId]
        if (!group || !group.members.includes(forager.id)) fail(`forager ${forager.id} names a group it is not in`)
        else if (forager.alive) {
          if (group.dissolvedMinute !== null) fail(`forager ${forager.id} belongs to a dissolved group`)
          const hearth = hearthAround(config, group.flag, group.members.indexOf(forager.id))
          if (forager.hearth.x !== hearth.x || forager.hearth.y !== hearth.y)
            fail(`forager ${forager.id}'s hearth is not its slot around the flag`)
        }
      } else if (before === null && forager.hearth !== this.hearthBefore[forager.id])
        fail(`forager ${forager.id} moved its hearth without joining a group`)
    }
    for (const group of state.groups) {
      const living = livingMembers(state, group).length
      if (group.dissolvedMinute === null) {
        if (living < 2) fail(`group ${group.id} stands with ${living} living members`)
        for (const id of group.members) if (state.foragers[id]!.groupId !== group.id) fail(`forager ${id} left a group`)
      } else if (living > 0) fail(`dissolved group ${group.id} still has living members`)
    }
    // At the end of its turn, a forager without a group stands within talking distance of no living forager.
    for (const [index, event] of state.lastEvents.entries()) {
      if (event.groupId !== null || died.has(event.foragerId)) continue
      if (nearestAt(event.foragerId, index + 1, event.position) !== null)
        fail(`forager ${event.foragerId} is without a group beside another forager`)
    }
  }

  /** Checks the minute just run and throws on the first violations found. */
  assert(state: ValleyState) {
    const violations = this.check(state)
    if (violations.length) throw new Error(`Valley invariants violated: ${violations.slice(0, 5).join('; ')}`)
  }
}
