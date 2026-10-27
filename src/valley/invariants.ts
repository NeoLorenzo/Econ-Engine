import { personConfig, natureViolations } from './nature'
import { bankViolations } from './banks'
import { GROUND_AREA, meshViolations } from './mesh'
import { waterViolations } from './water'
import { BUSH_GROUNDS, HAZEL_GROUNDS, TREE_GROUNDS, onGround } from './layout'
import { STONE, cellOf } from './terrain'
import { positionAt } from './tasks'
import {
  positionAlong,
  chunkOf,
  knows,
  meshSettings,
  NEAR_CM,
  onWalkableGround,
  segmentEnergyRate,
  segmentSlope,
  triangleDistanceSq,
  TIME_UNITS_PER_MINUTE,
} from './routes'
import { energyAt, waterAt, firstThresholdMinute, waterThresholds } from './body'
import { loadKg, loadOf, speedForLoad, nextHungry, isDaylight } from './forager'
import { carriedKcal } from './food'
import { MINUTES_PER_DAY } from './calendar'
import { axeLife } from './axes'
import { hearthAround, livingMembers } from './social'
import { sleepCostOf, warmthOf } from './work'
import { feedAmount } from './fire'
import { replayInterval, annualShares } from './replay'
import type { Point, ValleyState, TaskEvent } from './types'
const sum = (values: Iterable<number>) => {
  let total = 0
  for (const value of values) total += value
  return total
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const pointEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y
/** Every bank point stands on walkable ground within reach of its water. */
function bankPointViolations(state: ValleyState) {
  const { mesh, accessBanks } = state.layout.nav,
    errors: string[] = []
  for (const bank of accessBanks) {
    const t = Math.floor(bank.id / 3),
      e = bank.id % 3,
      a = mesh.tv[3 * t + e]!,
      b = mesh.tv[3 * t + ((e + 1) % 3)]!
    const other = mesh.tn[bank.id]!
    if (
      !onWalkableGround(mesh, bank) ||
      mesh.area[bank.triangle] !== GROUND_AREA ||
      !mesh.shore[bank.id] ||
      other < 0 ||
      mesh.area[other] === GROUND_AREA ||
      triangleDistanceSq(mesh, bank.triangle, bank.x, bank.y) !== 0
    )
      errors.push(`Bank ${bank.id} is not on walkable ground beside its water`)
    const dx = mesh.vx[b]! - mesh.vx[a]!,
      dy = mesh.vy[b]! - mesh.vy[a]!,
      s = Math.max(0, Math.min(1, ((bank.x - mesh.vx[a]!) * dx + (bank.y - mesh.vy[a]!) * dy) / (dx * dx + dy * dy)))
    if ((bank.x - mesh.vx[a]! - s * dx) ** 2 + (bank.y - mesh.vy[a]! - s * dy) ** 2 > state.config.reachCm ** 2)
      errors.push(`Bank ${bank.id} is out of reach of its water`)
  }
  return errors
}
export function layoutViolations(state: ValleyState): string[] {
  const { config, layout } = state
  const { terrain, ground } = layout
  const violations: string[] = []
  const kinds = [
    [layout.thickets, layout.bushes, BUSH_GROUNDS, 'berry bush'],
    [layout.hazelThickets, layout.hazels, HAZEL_GROUNDS, 'hazel'],
    [layout.stands, layout.trees, TREE_GROUNDS, 'tree'],
  ] as const
  for (const [centres, plants, grounds, name] of kinds) {
    for (const [id, centre] of centres.entries())
      if (!onGround(terrain, layout.nav.mesh, ground, centre.x, centre.y, grounds))
        violations.push(`The site of ${name} ${id} lies on the wrong ground`)
    for (let id = 0; id < plants.count; id += 1)
      if (!onGround(terrain, layout.nav.mesh, ground, plants.x[id]!, plants.y[id]!, grounds))
        violations.push(`A ${name}, ${id}, grows on the wrong ground`)
  }
  for (let id = 0; id < layout.stones.count; id += 1)
    if (ground[cellOf(terrain, layout.stones.x[id]!, layout.stones.y[id]!)] !== STONE)
      violations.push(`Stone spot ${id} lies off stone`)
  if (config.outcropCount && !layout.outcrops.every((centre) => ground[cellOf(terrain, centre.x, centre.y)] === STONE))
    violations.push('An outcrop does not lie on stone')
  for (const [id, hearth] of layout.hearths.entries())
    if (ground[cellOf(terrain, hearth.x, hearth.y)] === STONE) violations.push(`Forager ${id} starts on stone`)
  return violations
}

/** Holds the previous immutable state and checks the next interval without advancing anybody. */
export class ValleyChecker {
  private previous: ValleyState
  private geography: string[]
  constructor(state: ValleyState) {
    this.previous = state
    this.geography = [
      ...layoutViolations(state),
      ...waterViolations(state.layout.terrain.water),
      ...(state.layout.terrain.water.shore
        ? bankViolations(state.layout.terrain.water.shore, state.layout.terrain.water)
        : []),
      ...meshViolations(state.layout.nav.mesh, state.layout.terrain, meshSettings(state.config)),
      ...bankPointViolations(state),
    ]
    if (!annualShares(state)) this.geography.push('Calendar shares do not sum to the yearly allocation')
  }
  check(state: ValleyState): string[] {
    const found = [...this.geography]
    this.geography = []
    if (state.minute < this.previous.minute) return ['An interval moved backwards']
    for (const check of [
      this.bodyCharges,
      this.positions,
      this.conservation,
      this.queue,
      this.memoryOnly,
      this.order,
      this.regrowth,
      this.ways,
    ]) {
      try {
        found.push(...check.call(this, state))
      } catch (error) {
        found.push(`Malformed interval record: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    this.previous = state
    return [...new Set(found)]
  }
  assert(state: ValleyState) {
    const errors = this.check(state)
    if (errors.length) throw new Error(`Valley invariants violated: ${errors.slice(0, 8).join('; ')}`)
  }
  /** Every way is a known walkable corridor between its ends; walks on ways keep to them; surveys follow the rule. */
  private ways(state: ValleyState) {
    const errors: string[] = [],
      mesh = state.layout.nav.mesh,
      config = state.config
    for (const p of state.foragers) {
      const before = this.previous.foragers[p.id]!
      if (p.ways.length > config.waysRemembered) errors.push(`person ${p.id}: too many ways`)
      const ends = new Set<string>()
      for (const way of p.ways) {
        const key = [`${way.a.x},${way.a.y}`, `${way.b.x},${way.b.y}`].sort().join(':')
        if (ends.has(key)) errors.push(`person ${p.id}: two ways between the same ends`)
        ends.add(key)
        if (way.id < 0 || way.id >= p.nextWayId || way.usedMinute > state.minute || way.plannedMinute > way.usedMinute)
          errors.push(`person ${p.id}: way ${way.id} has an invalid number or minute`)
        const c = way.corridor
        if (
          !c.length ||
          triangleDistanceSq(mesh, c[0]!, way.a.x, way.a.y) > NEAR_CM ** 2 ||
          triangleDistanceSq(mesh, c[c.length - 1]!, way.b.x, way.b.y) > NEAR_CM ** 2
        )
          errors.push(`person ${p.id}: way ${way.id} does not hold its ends`)
        for (let i = 0; i < c.length; i++) {
          const t = c[i]!
          if (mesh.area[t] !== GROUND_AREA || !knows(p.knowledge, t))
            errors.push(`person ${p.id}: way ${way.id} crosses unknown or wet ground`)
          if (i && ![0, 1, 2].some((e) => mesh.tn[3 * c[i - 1]! + e] === t))
            errors.push(`person ${p.id}: way ${way.id} has a gap`)
        }
      }
      const known = new Map([...before.ways, ...p.ways].map((w) => [w.id, w]))
      let survey = before.survey,
        leisure = before.leisureMinute
      for (const e of state.lastInterval) {
        if (!('foragerId' in e) || e.foragerId !== p.id) continue
        if (e.kind === 'task-start' && e.task.reason === 'out for a walk' && e.task.startMinute === e.minute) {
          if (leisure >= 0 && Math.floor(leisure / MINUTES_PER_DAY) === Math.floor(e.minute / MINUTES_PER_DAY))
            errors.push(`person ${p.id}: two leisure walks in a day`)
          leisure = e.minute
        }
        if (e.kind === 'walk' && (e.plan === 'way' || e.plan === 'joined')) {
          const way = known.get(e.wayId)
          if (way) {
            const triangles = new Set(way.corridor)
            if (state.routes[e.routeId]!.segments.some((segment) => !triangles.has(segment.triangle)))
              errors.push(`person ${p.id}: a walk left the way it took`)
          } else if (e.wayId < before.nextWayId) errors.push(`person ${p.id}: a walk took an unknown way`)
        }
        if (e.kind === 'observe') {
          const due = !survey || (survey.x - e.origin.x) ** 2 + (survey.y - e.origin.y) ** 2 >= config.resurveyCm ** 2
          if (due !== e.surveyed) errors.push(`person ${p.id}: survey taken against the rule`)
          if (due) survey = e.origin
        }
      }
      if (survey !== p.survey && !(survey && p.survey && pointEqual(survey, p.survey)))
        errors.push(`person ${p.id}: survey point changed without a survey`)
      if (leisure !== p.leisureMinute) errors.push(`person ${p.id}: leisure walk not recorded`)
    }
    return errors
  }
  private bodyCharges(state: ValleyState) {
    return replayInterval(this.previous, state)
  }
  private positions(state: ValleyState) {
    const errors: string[] = [],
      nav = state.layout.nav,
      mesh = nav.mesh
    const dry = (point: Point) =>
      Number.isSafeInteger(point.x) && Number.isSafeInteger(point.y) && onWalkableGround(mesh, point)
    const used = new Set<number>(),
      owners = new Map<number, number>()
    for (const p of state.foragers) if (p.task?.kind === 'walk') owners.set(p.task.routeId, p.id)
    for (const e of state.lastInterval)
      if ((e.kind === 'task-start' || e.kind === 'task-end') && e.task.kind === 'walk') {
        if (owners.has(e.task.routeId) && owners.get(e.task.routeId) !== e.foragerId)
          errors.push('Route shared between people')
        owners.set(e.task.routeId, e.foragerId)
      }
    for (let id = this.previous.routes.length; id < state.routes.length; id++) used.add(id)
    for (const p of state.foragers) {
      if (!dry(p) || !dry(positionAt(state, p, state.minute))) errors.push(`person ${p.id}: position is wet or invalid`)
      const lastPosition = state.lastInterval
        .filter((e) => (e.kind === 'task-start' || e.kind === 'task-end') && e.foragerId === p.id)
        .at(-1)
      const expectedPosition =
        lastPosition && (lastPosition.kind === 'task-start' || lastPosition.kind === 'task-end')
          ? lastPosition.position
          : this.previous.foragers[p.id]!
      if (!pointEqual(p, expectedPosition)) errors.push('Position changed without a task record')
      if (p.task?.kind === 'walk') used.add(p.task.routeId)
      const buckets = state.peopleByChunk
        .map((ids, index) => (ids.includes(p.id) ? index : -1))
        .filter((index) => index >= 0)
      if (
        p.alive
          ? buckets.length !== 1 || buckets[0] !== chunkOf(nav, positionAt(state, p, state.minute))
          : buckets.length !== 0
      )
        errors.push(`person ${p.id}: chunk index is inconsistent`)
    }
    for (const id of used) {
      const route = state.routes[id]
      if (!route) {
        errors.push('Missing recorded route')
        continue
      }
      const owner = owners.get(id)
      if (owner === undefined) {
        errors.push(`route ${id}: no recorded walker`)
        continue
      }
      const personal = personConfig(state.config, state.foragers[owner]!)
      let units = 0,
        energy = 0
      for (let i = 0; i < route.segments.length; i++) {
        const segment = route.segments[i]!,
          a = { x: segment.x0, y: segment.y0 },
          b = { x: segment.x1, y: segment.y1 }
        if (
          !dry(a) ||
          !dry(b) ||
          mesh.area[segment.triangle] !== GROUND_AREA ||
          triangleDistanceSq(mesh, segment.triangle, a.x, a.y) > NEAR_CM ** 2 ||
          triangleDistanceSq(mesh, segment.triangle, b.x, b.y) > NEAR_CM ** 2
        )
          errors.push(`route ${id}: segment enters water`)
        if (i && !pointEqual(a, { x: route.segments[i - 1]!.x1, y: route.segments[i - 1]!.y1 }))
          errors.push(`route ${id}: disconnected polyline`)
        const slope = segmentSlope(mesh, segment)
        if (
          slope.slope !== segment.slope ||
          slope.uphill !== segment.uphill ||
          segment.energyPerHour !== segmentEnergyRate(personal, slope.slope, slope.uphill)
        )
          errors.push(`route ${id}: wrong grade or energy cost`)
        if (segment.timeUnits <= 0 || !Number.isSafeInteger(segment.timeUnits))
          errors.push(`route ${id}: invalid duration`)
        units += segment.timeUnits
        energy += segment.timeUnits * segment.energyPerHour
      }
      if (
        route.timeUnits !== units ||
        route.minutes !== Math.ceil(units / TIME_UNITS_PER_MINUTE) ||
        route.kcal !== Math.floor(energy / (60 * TIME_UNITS_PER_MINUTE))
      )
        errors.push(`route ${id}: totals do not match its segments`)
    }
    for (const event of state.lastInterval)
      if (event.kind === 'task-start' || event.kind === 'task-end') {
        if (!dry(event.position)) errors.push('Recorded task position is wet')
        if (event.task.kind === 'walk') {
          const route = state.routes[event.task.routeId]!
          if (!pointEqual(event.position, positionAlong(route, event.minute - event.task.startMinute)))
            errors.push('Recorded position lies off its route')
          const speed = speedForLoad(
            personConfig(state.config, state.foragers[event.foragerId]!),
            event.task.startLoadKg ?? 0,
          )
          for (const s of route.segments) {
            if (
              s.energyPerHour !==
              segmentEnergyRate(personConfig(state.config, state.foragers[event.foragerId]!), s.slope, s.uphill)
            )
              errors.push('Route energy differs from person')
            let factor = 1000
            if (s.slope === 1 && s.uphill) factor = state.config.moderateSlowdownPerMille
            if (s.slope === 2) factor = s.uphill ? 2000 : state.config.steepDownSlowdownPerMille
            const terrain =
              s.ground === 0
                ? state.config.grassTerrainPercent
                : s.ground === 1
                  ? state.config.dirtTerrainPercent
                  : state.config.stoneTerrainPercent
            if (s.timeUnits !== Math.ceil((s.lengthCm * terrain * factor) / (speed * 100)))
              errors.push('A walk is faster or slower than its recorded load allows')
          }
        }
      }
    return errors
  }
  private conservation(state: ValleyState) {
    const errors: string[] = [],
      t = state.totals
    const energy =
      sum(state.foragers.map((p) => p.energyKcal + carriedKcal(p.carried))) + sum(state.foodStock) + state.fishKcal
    if (energy !== t.initialKcal + t.regrownKcal + t.fishGrownKcal - t.metabolizedKcal - t.spoiledKcal)
      errors.push('Food energy is not conserved')
    const wood =
      sum(state.woodStock) + sum(state.foragers.map((p) => p.wood)) + sum(state.groups.map((g) => g.fireWood))
    if (wood !== t.initialWood + t.regrownWood + t.fellenWood - t.burnedWood - t.axeWood)
      errors.push('Wood is not conserved')
    if (
      sum(state.logStock) + sum(state.foragers.map((p) => p.log)) + sum(state.huts.map((h) => h.logs)) !==
      t.initialLogs + t.regrownLogs - t.rottedLogs
    )
      errors.push('Logs are not conserved')
    if (sum(state.stoneStock) + sum(state.foragers.map((p) => p.stone)) + t.stonesWorked !== t.initialStones)
      errors.push('Stones are not conserved')
    if (sum(state.fish.map((f) => f.stock)) !== state.fishKcal) errors.push('Fish total differs from bodies')
    const tools = state.foragers.flatMap((p) => [p.axe, p.spareAxe]).filter((a) => a !== null)
    const beforeTools = this.previous.foragers.flatMap((p) => [p.axe, p.spareAxe]).filter((a) => a !== null).length
    const made = state.lastInterval.filter((e) => e.kind === 'made').length,
      worn = state.lastInterval.filter((e) => e.kind === 'worn').length
    if (tools.length !== beforeTools + made - worn) errors.push('Axes changed without a making or wear record')
    const ids = new Set<number>()
    for (const axe of tools) {
      if (
        ids.has(axe.id) ||
        axe.quality < 1 ||
        axe.quality > Math.floor((state.config.craftSkillMaxPercent * state.config.practiceMaxPercent) / 100) ||
        axe.logsLeft < 1 ||
        axe.logsLeft > axeLife(state.config, axe.quality)
      )
        errors.push('Impossible or duplicated axe')
      ids.add(axe.id)
    }
    for (const p of state.foragers) {
      errors.push(...natureViolations(state.config, p))
      for (const key of ['sex', 'heightCm', 'weightKg', 'gripKg', 'traits'] as const)
        if (!same(p[key], this.previous.foragers[p.id]![key])) errors.push(`Person nature changed: ${key}`)
      if (
        p.wood < 0 ||
        p.tripWood < 0 ||
        p.tripWood > p.loadCapacityKg ||
        p.tripWood > p.wood ||
        p.log < 0 ||
        p.log > 1 ||
        p.stone < 0 ||
        !Number.isSafeInteger(loadKg(state.config, loadOf(p)))
      )
        errors.push(`person ${p.id}: invalid carried load`)
    }
    return errors
  }
  private queue(state: ValleyState) {
    const errors: string[] = [],
      q = state.queue.clone(),
      entries = []
    while (q.peek()) entries.push(q.pop()!)
    const worlds = entries.filter((e) => e.phase === 0)
    if (
      worlds.length !== 1 ||
      worlds[0]!.kind !== 'world' ||
      worlds[0]!.minute % 60 ||
      worlds[0]!.minute <= state.minute
    )
      errors.push('Queue must hold exactly one future world hour')
    for (const e of entries) {
      if (e.minute < state.minute) errors.push('Queue entry is in the past')
      if (e.phase === 1 && !state.foragers[e.id]?.alive) errors.push('A dead person has a wake-up')
    }
    for (const p of state.foragers) {
      const pending = state.queue.entriesOf(p.id)
      for (const kind of ['end', 'threshold'])
        if (pending.filter((e) => e.kind === kind).length > 1) errors.push(`person ${p.id}: duplicate ${kind}`)
      if (!p.alive) continue
      if (!p.task) {
        if (state.minute !== 0) errors.push('Living person has no task')
        continue
      }
      if (!pending.some((e) => e.kind === 'end' && e.minute === p.task!.endMinute))
        errors.push('Missing task-end wake-up')
      const threshold = firstThresholdMinute(personConfig(state.config, p), p.task, state.routes)
      if (
        threshold &&
        threshold.minute < p.task.endMinute &&
        threshold.minute > state.minute &&
        !pending.some((e) => e.kind === 'threshold' && e.minute === threshold.minute)
      )
        errors.push('Missing body threshold wake-up')
    }
    return errors
  }
  private memoryOnly(state: ValleyState) {
    const errors: string[] = [],
      before = this.previous
    const memory = before.foragers.map((p) => ({
      places: p.knownPlaces.slice(),
      stock: p.placeStock.slice(),
      wood: p.placeWood.slice(),
      logs: p.placeLogs.slice(),
      checked: p.placeCheckedMinute.slice(),
      triangles: p.knowledge.triangles.slice(),
      banks: new Map(p.knownBanks),
    }))
    for (const event of state.lastInterval) {
      if (event.kind === 'observe') {
        const m = memory[event.foragerId]!,
          radius = state.config.sightRadiusCm
        for (const id of event.places) {
          if (
            (state.layout.places.x[id]! - event.origin.x) ** 2 + (state.layout.places.y[id]! - event.origin.y) ** 2 >
            radius ** 2
          )
            errors.push('Place observed beyond sight')
          m.places[id] = event.minute
        }
        const mesh = state.layout.nav.mesh
        for (const t of event.triangles) {
          if ((mesh.cx[t]! - event.origin.x) ** 2 + (mesh.cy[t]! - event.origin.y) ** 2 > radius ** 2)
            errors.push('Triangle observed beyond sight')
          m.triangles[t >> 3]! |= 1 << (t & 7)
        }
        for (const bank of event.banks) {
          if ((bank.x - event.origin.x) ** 2 + (bank.y - event.origin.y) ** 2 > radius ** 2)
            errors.push('Bank observed beyond sight')
          m.banks.set(bank.id, bank)
        }
        if (event.stock) {
          const s = event.stock,
            id = s.placeId,
            kind = state.layout.places.kind[id]!
          if (
            (state.layout.places.x[id]! - event.origin.x) ** 2 + (state.layout.places.y[id]! - event.origin.y) ** 2 >
            state.layout.places.radiusCm[id]! ** 2
          )
            errors.push('Stock checked from too far away')
          m.stock[id] = kind < 2 ? s.food : kind === 2 ? s.wood : s.stones
          m.wood[id] = s.wood
          m.logs[id] = s.logs
          m.checked[id] = event.minute
        }
      }
      if (event.kind === 'task-start') {
        const m = memory[event.foragerId]!,
          t = event.task
        if (['pick', 'nuts', 'gather', 'cut'].includes(t.kind) && m.places[t.placeId]! < 0)
          errors.push('A decision used an unobserved place')
        if ((t.kind === 'drink' || t.kind === 'fish') && !m.banks.has(t.placeId))
          errors.push('A decision used an unknown bank')
        if (t.kind === 'walk') {
          const route = state.routes[t.routeId]!,
            knowledge = { triangles: m.triangles, revision: 0 }
          for (const segment of route.segments)
            if (!knows(knowledge, segment.triangle)) errors.push('A route used unseen ground')
        }
      }
    }
    for (const p of state.foragers) {
      const m = memory[p.id]!
      for (const [actual, expected] of [
        [p.knownPlaces, m.places],
        [p.placeStock, m.stock],
        [p.placeWood, m.wood],
        [p.placeLogs, m.logs],
        [p.placeCheckedMinute, m.checked],
        [p.knowledge.triangles, m.triangles],
      ] as const)
        if (!same([...actual], [...expected])) errors.push(`person ${p.id}: memory changed without an observation`)
      if (!same([...p.knownBanks], [...m.banks])) errors.push('Bank memory changed without an observation')
      for (let id = 0; id < p.placeStock.length; id++)
        if (p.knownPlaces[id]! < 0 && p.placeStock[id]! >= 0) errors.push('Stock memory belongs to an unobserved place')
    }
    return errors
  }
  private order(state: ValleyState) {
    const errors: string[] = [],
      before = this.previous
    let last = before.minute
    const alive = before.foragers.map((p) => p.alive),
      hungry = before.foragers.map((p) => p.hungry),
      thirsty = before.foragers.map((p) => p.thirsty),
      positions = before.foragers.map((p) => ({ x: p.x, y: p.y })),
      hearths = before.foragers.map((p) => ({ ...p.hearth })),
      members = before.foragers.map((p) => p.groupId)
    const fires = before.groups.map((g) => ({ wood: g.fireWood, lit: g.fireLit })),
      gift = before.foragers.map((p) => p.fireGiven),
      personalFire = before.foragers.map((p) => p.warm),
      active = before.foragers.map((p) => p.task),
      hutLogs = before.huts.map((h) => h.logs)
    const worlds: number[] = []
    let personPhaseMinute = -1
    for (const e of state.lastInterval) {
      if (e.kind === 'world') {
        if (personPhaseMinute === e.minute) errors.push('World phase followed a person in the same minute')
        worlds.push(e.minute)
      }
      if (e.kind === 'task-start' || e.kind === 'task-end' || e.kind === 'death' || e.kind === 'observe')
        personPhaseMinute = e.minute
      if (isDaylight(state.config, e.minute)) for (const fire of fires) if (fire) fire.lit = false
      if (e.kind === 'delivery' && e.hutId !== null) hutLogs[e.hutId] = (hutLogs[e.hutId] ?? 0) + e.logs
      if (e.kind === 'weather') hutLogs[e.hutId]!--
      if (e.kind === 'rate-change') {
        const task = active[e.foragerId],
          g = members[e.foragerId]
        const whole = state.huts.some(
          (h) =>
            h.builderId === e.foragerId &&
            pointEqual(h, hearths[e.foragerId]!) &&
            (hutLogs[h.id] ?? 0) >= state.config.hutLogs &&
            (h.abandonedMinute === null || h.abandonedMinute > e.minute),
        )
        const fire = g === null ? personalFire[e.foragerId]! : (fires[g!]?.lit ?? false)
        if (
          task?.kind !== 'sleep' ||
          e.energyPerHour !==
            sleepCostOf(personConfig(state.config, state.foragers[e.foragerId]!), warmthOf(fire, whole))
        )
          errors.push('Warmth boundary differs from fire and hut records')
      }
      if (e.kind === 'task-end') active[e.foragerId] = null
      if (e.kind === 'task-start') active[e.foragerId] = e.task
      if (e.kind === 'fire' && 'foragerId' in e) personalFire[e.foragerId] = e.lit
      if (e.minute < last || e.minute < before.minute || e.minute > state.minute)
        errors.push('Events are out of interval order')
      last = e.minute
      if (e.kind === 'task-end' || e.kind === 'task-start') {
        if (!alive[e.foragerId]) errors.push('Dead person acted')
        positions[e.foragerId] = { ...e.position }
        if (e.kind === 'task-start') {
          hungry[e.foragerId] = nextHungry(
            personConfig(state.config, state.foragers[e.foragerId]!),
            e.task.startEnergyKcal,
            hungry[e.foragerId]!,
          )
          if (e.task.startWaterMl >= waterThresholds(personConfig(state.config, state.foragers[e.foragerId]!)).thirsty)
            thirsty[e.foragerId] = true
          else if (e.task.startWaterMl <= state.config.drinkStopMl) thirsty[e.foragerId] = false
          const severe =
            e.task.startWaterMl >= waterThresholds(personConfig(state.config, state.foragers[e.foragerId]!)).urgent
          if (severe && !['drink', 'walk', 'rest'].includes(e.task.kind))
            errors.push('Severe thirst did not interrupt work')
          if (e.task.kind === 'sleep') {
            const g = members[e.foragerId],
              fire = g === null ? personalFire[e.foragerId]! : (fires[g!]?.lit ?? false)
            // Hut weathering can change a continuing sleeper at a recorded rate boundary.
            const expected = sleepCostOf(
              personConfig(state.config, state.foragers[e.foragerId]!),
              warmthOf(fire, e.task.wholeHut ?? false),
            )
            if (e.task.energyPerHour !== expected) errors.push('Sleeping warmth does not match hut and fire')
          }
          if (
            e.task.kind === 'walk' &&
            ['exploring', 'out for a walk', 'seeking company'].includes(e.task.reason) &&
            !hungry[e.foragerId] &&
            (e.task.startTripWood ?? 0) >= state.foragers[e.foragerId]!.loadCapacityKg
          )
            errors.push('Exploring with a full wood load')
          if (e.task.reason === 'taking a load home' && (e.task.startTripWood ?? 0) <= 0)
            errors.push('Taking home a load not carried')
        }
      }
      if (e.kind === 'death') {
        const end = state.lastInterval.find(
          (event) => event.kind === 'task-end' && event.foragerId === e.foragerId && event.minute === e.minute,
        ) as TaskEvent | undefined
        const energy = end ? energyAt(end.task, e.minute, state.routes).kcal : before.foragers[e.foragerId]!.energyKcal
        const water = end ? waterAt(end.task, e.minute, state.routes).ml : before.foragers[e.foragerId]!.waterDeficitMl
        const causes = [
          ...(energy <= 0 ? ['starvation'] : []),
          ...(water >= waterThresholds(personConfig(state.config, state.foragers[e.foragerId]!)).fatal
            ? ['dehydration']
            : []),
        ]
        if (!alive[e.foragerId] || !causes.length || e.cause !== causes.join(' and '))
          errors.push('Wrong death minute or cause')
        if (end) {
          const threshold = firstThresholdMinute(
            personConfig(state.config, state.foragers[e.foragerId]!),
            end.task,
            state.routes,
          )
          if (threshold && threshold.minute < e.minute) errors.push('A fatal threshold was missed')
        }
        alive[e.foragerId] = false
      }
      if (e.kind === 'group-founded') {
        fires[e.groupId] = { wood: 0, lit: false }
        for (let i = 0; i < 2; i++) {
          members[e.founderIds[i]!] = e.groupId
          hearths[e.founderIds[i]!] = e.hearths[i]!
        }
      }
      if (e.kind === 'group-joined') {
        members[e.foragerId] = e.groupId
        hearths[e.foragerId] = e.hearth
      }
      if (e.kind === 'group-dissolved') {
        if (e.survivorId !== null) members[e.survivorId] = null
        if (fires[e.groupId]) {
          fires[e.groupId]!.wood -= e.fireWood
          fires[e.groupId]!.lit = false
        }
      }
      if (e.kind === 'fire' && 'groupId' in e) {
        const f = fires[e.groupId]!
        if (e.minute % 60 || isDaylight(state.config, e.minute))
          errors.push('Fire burned outside the start of a night hour')
        const expected = f.wood >= state.config.campfireWoodPerHour ? state.config.campfireWoodPerHour : 0
        if (e.burned !== expected || e.lit !== expected > 0 || e.fireWoodAfter !== f.wood - expected)
          errors.push('Fire burned the wrong amount')
        f.wood -= e.burned
        f.lit = e.lit
      }
      if (e.kind === 'feed') {
        const f = fires[e.groupId],
          amount = feedAmount(
            state.config,
            e.woodBefore,
            e.fireWoodBefore,
            e.burnPerHour,
            e.minute,
            state.foragers[e.foragerId]!.woodStockTarget,
          )
        if (!pointEqual(positions[e.foragerId]!, hearths[e.foragerId]!)) errors.push('Gift given away from its hearth')
        if (
          !f ||
          f.wood !== e.fireWoodBefore ||
          e.wood !== amount.wood ||
          e.spareWood !== amount.spareWood ||
          e.low !== amount.low ||
          e.fireWoodAfter !== e.fireWoodBefore + e.wood
        )
          errors.push('Gift has the wrong amount')
        if (f) f.wood += e.wood
        gift[e.foragerId]! += e.wood
      }
      if (e.kind === 'exchange' || e.kind === 'sale')
        if (members[e.sellerId] === null || members[e.sellerId] !== members[e.buyerId])
          errors.push('Exchange occurred between groups')
    }
    const oldQueue = before.queue.clone()
    let nextWorld: number | undefined
    while (oldQueue.peek()) {
      const entry = oldQueue.pop()!
      if (entry.phase === 0) {
        nextWorld = entry.minute
        break
      }
    }
    const expectedWorlds: number[] = []
    if (nextWorld !== undefined)
      for (let minute = nextWorld; minute <= state.minute; minute += 60) expectedWorlds.push(minute)
    if (!same(worlds, expectedWorlds)) errors.push('Missing or duplicate world phase')
    for (const p of state.foragers) {
      if (p.alive !== alive[p.id] || p.hungry !== hungry[p.id] || p.thirsty !== thirsty[p.id])
        errors.push('Life or hunger flag differs from its wake-up records')
      if (p.fireGiven !== gift[p.id]) errors.push('Gifts do not add up')
      if (!p.alive) {
        const death = state.lastInterval.find((e) => e.kind === 'death' && e.foragerId === p.id)
        if (before.foragers[p.id]!.alive && (!death || p.deathMinute !== death.minute))
          errors.push('Death has no matching record')
      }
      if (p.groupId !== null) {
        const g = state.groups[p.groupId]
        // The dead keep the group they died in, which may since have dissolved.
        if (!g || (p.alive && g.dissolvedMinute !== null) || !g.members.includes(p.id))
          errors.push('Member has no standing group')
        else if (g.dissolvedMinute === null) {
          const slot = g.hearthSlots[g.members.indexOf(p.id)]!
          if (!pointEqual(p.hearth, hearthAround(state.config, g.flag, slot)))
            errors.push('Hearth is off its group slot')
        }
      }
    }
    for (const g of state.groups) {
      if (g.dissolvedMinute === null && livingMembers(state, g).length < 2)
        errors.push('Standing group has fewer than two living members')
      if (g.fireWood !== fires[g.id]?.wood) errors.push('Fire wood changed without a record')
    }
    return errors
  }
  private regrowth(state: ValleyState) {
    const errors: string[] = [],
      c = state.config
    for (let id = 0; id < state.layout.places.count; id++) {
      const kind = state.layout.places.kind[id]!,
        food = state.foodStock[id]!,
        logs = state.logStock[id]!,
        stones = state.stoneStock[id]!,
        wood = state.woodStock[id]!
      const capacity = kind === 0 ? c.berryThicketCapacityKcal : kind === 1 ? c.hazelThicketCapacityKcal : 0
      if (
        !Number.isSafeInteger(food) ||
        food < 0 ||
        food > capacity ||
        !Number.isSafeInteger(wood) ||
        wood < 0 ||
        logs < 0 ||
        logs > c.standLogs ||
        stones < 0 ||
        stones > c.outcropStones
      )
        errors.push('Place stock is negative, fractional or above capacity')
    }
    for (const f of state.fish)
      if (f.stock < 0 || f.stock > f.capacity || !Number.isSafeInteger(f.stock) || f.remainder < 0)
        errors.push('Invalid fish stock or remainder')
    return errors
  }
}
