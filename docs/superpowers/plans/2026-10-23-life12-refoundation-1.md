# Life 12 Re-foundation, pull request 1: clock, places, routes and observer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Life core's per-minute loop with one minute clock driven by wake-ups, places with one stock each, routes on a 20 m lattice and lazy bodies, keeping Life 11's eight people and every behaviour they have, so that a year of eight runs in well under a second and the observer draws them continuously at any speed.

**Architecture:** New modules `calendar.ts`, `places.ts`, `clock.ts`, `tasks.ts`, `body.ts` and `perception.ts` in `src/valley/` carry the new representation; `routes.ts` is rewritten on the lattice; `engine.ts` becomes a wake-up pipeline with `stepValley(state, toMinute)`; `forager.ts`, `work.ts`, `social.ts`, `huts.ts`, `axes.ts`, `trade.ts` and `fire.ts` keep their rules and are called from wake-ups; `sight.ts`, `hydration.ts`, `walkEstimates.ts`, `waterKnowledge.ts` and the Tobler and Pandolf tables are deleted; `invariants.ts` checks intervals; the view asks for positions at the displayed minute. People stay objects; their memories (places seen, stocks seen, lattice nodes, people met) become typed arrays, which is where the size is. A full struct-of-arrays person state is deferred until profiling asks for it, and Task 12 corrects the spec's "typed-array person state" line to say so. The second pull request (run settings and forty founders) is planned separately.

**Tech Stack:** TypeScript, Vitest, React 19, three.js, Vite; `npm run agent:check` for final validation.

**Spec:** `docs/LIFE12_SPEC.md` (approved 2026-10-23). Read it first; this plan argues from it and does not repeat its rules.

## Global Constraints

- The step function is pure and deterministic; every random draw comes from a named derived stream; no draw per minute.
- Quantities are integers: centimetres, kilocalories, kilograms, millilitres; fractions live in integer remainders.
- Agents read only their memory and the current wake-up's observation; the checker reads truth.
- The MVP9 core in `src/sim/` is not touched.
- Keep Life 11's rules where the spec says "as Life 11"; port, do not redesign. When a port must choose, choose the simplest reading of the spec and note it in the lab notes.
- `fingerprints.test.ts` must pass before engine edits (Task 0) and be re-recorded once at the end (Task 11); never re-recorded to hide a failed rule.
- Work on branch `life/12-refoundation-1` from `origin/main`. Commit per task. No Claude attribution in commits or pull requests.
- Prettier formatting (`npm run lint`), oxlint clean, `tsc -b` clean.
- Durations are day-anchored unless the spec lists them as year-anchored: regrowth per year, fish growth per year, `treeRegrowthYears`.
- Default `daysPerYear` is 90; the eight canonical configurations keep `founders: 8`.

## Review Focus

Spec-implied conditions no task's main tests exercise; each has a pinning test added to the task named.

1. A walk whose route crosses a chunk boundary in the same minute it starts must still wake the people in the entered chunk (Task 6: `wakes people in a chunk entered at the departure minute`).
2. A person whose energy and water both cross fatal thresholds in one task dies at the earlier minute with both causes if equal, as Life 11 records (Task 4: `records both causes when the fatal minutes coincide`).
3. `stepValley(state, toMinute)` with `toMinute` equal to the current minute must return an equal state and no events (Task 3: `advancing zero minutes changes nothing`).
4. A thicket emptied by two people in overlapping tasks must never go negative: the second task's credit is capped at what remains when it ends (Task 7: `two pickers cannot overdraw a thicket`).
5. Regrowth at midnight must not wake sleepers or reschedule anyone (Task 7: `midnight regrowth leaves the queue's person entries unchanged`).

---

### Task 0: Baseline

**Files:**
- None modified.

- [ ] **Step 1: Create the branch**

```bash
git fetch origin && git switch -c life/12-refoundation-1 origin/main
```

- [ ] **Step 2: Run the recorded fingerprints**

Run: `npx vitest run src/valley/fingerprints.test.ts`
Expected: PASS for every recorded configuration.

---

### Task 1: Calendar

**Files:**
- Create: `src/valley/calendar.ts`, `src/valley/calendar.test.ts`
- Modify: `src/valley/types.ts` (`ValleyConfig`), `src/valley/config.ts` (default and validation)

**Interfaces:**
- Produces: `MINUTES_PER_DAY = 1_440` (moved here from `forager.ts`, re-exported there); `dayOf(minute): number`; `yearOf(config, minute): number`; `dayOfYear(config, minute): number`; `seasonOf(config, minute): 0 | 1 | 2 | 3` (quarters of the year, rounding the first three down); `dailyShare(amountPerYear, dayOfYear, daysPerYear): number` = `floor(a*(d+1)/D) - floor(a*d/D)`; `yearsToDays(config, years): number` = `max(1, years * daysPerYear)`; `yearlyToDailyRemainder` is not needed: callers use `dailyShare`.
- Config: `daysPerYear: number` with default 90; `valleyConfigErrors` rejects values outside 8..365 or non-integers with the message `daysPerYear must be an integer from 8 to 365`.

- [ ] **Step 1: Write the failing tests** in `calendar.test.ts`

```ts
it('sums daily shares exactly to the yearly amount', () => {
  for (const D of [8, 90, 365]) {
    let total = 0
    for (let d = 0; d < D; d += 1) total += dailyShare(54_000, d, D)
    expect(total).toBe(54_000)
  }
})
it('derives day, year and season from the minute', () => {
  const config = resolveValleyConfig({ daysPerYear: 8 })
  expect(dayOf(1_439)).toBe(0)
  expect(yearOf(config, 8 * 1_440)).toBe(1)
  expect(dayOfYear(config, 9 * 1_440)).toBe(1)
  expect(seasonOf(config, 2 * 1_440)).toBe(1)
})
it('never converts years to fewer than one day', () => {
  expect(yearsToDays(resolveValleyConfig({ daysPerYear: 8 }), 0)).toBe(1)
  expect(yearsToDays(resolveValleyConfig({ daysPerYear: 8 }), 20)).toBe(160)
})
it('rejects years outside 8 to 365', () => {
  expect(valleyConfigErrors(resolveValleyConfig({ daysPerYear: 7 }))).toContain('daysPerYear must be an integer from 8 to 365')
})
```

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/valley/calendar.test.ts` Expected: FAIL, module not found.
- [ ] **Step 3: Implement `calendar.ts` and the config field.** Move `MINUTES_PER_DAY` and `minuteOfDay` here; keep `forager.ts` exporting them by re-export so no other file changes yet.
- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run src/valley/calendar.test.ts src/valley/config.test.ts` Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(life12): add the calendar and days per year"`

---

### Task 2: Places

**Files:**
- Create: `src/valley/places.ts`, `src/valley/places.test.ts`
- Modify: `src/valley/types.ts` (`ValleyLayout`, `ValleyConfig`, `ValleyState` stocks), `src/valley/layout.ts`, `src/valley/config.ts`, `src/valley/fish.ts`, `src/valley/fish.test.ts`, `src/valleyView/display.ts`, `src/valleyView/display.test.ts`, `src/valleyView/valleyScene.ts` (plant drawing only), `src/valleyView/valleyViewModel.ts` (`displayedStock`)

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export const PLACE_KINDS = ['berry thicket', 'hazel thicket', 'stand', 'outcrop'] as const
  export type PlaceKind = (typeof PLACE_KINDS)[number]
  export interface PlaceTable { count: number; kind: Uint8Array; x: Int32Array; y: Int32Array; chunk: Int32Array; radiusCm: Int32Array }
  ```
  `ValleyLayout.places: PlaceTable` and `ValleyLayout.placeChunks: Int32Array[]` (place ids per chunk, in id order). The per-plant fields `bushes`, `hazels`, `trees`, `stones`, `foodPlants`, `woodPlants`, `thickets`, `hazelThickets`, `stands`, `outcrops` and their indexes are removed from `ValleyLayout`; the view reads `places`.
- View decoration, so the app keeps rendering from this task: `decorPoints(place: { x; y; radiusCm; id }, count: number): Point[]` in `src/valleyView/display.ts`, deterministic from the place id (a hashed jitter inside the radius, no stream), used by `valleyScene.ts` in place of `layout.bushes` and friends with the former counts (60, 40, 12, 60). `displayedStock` in the view model returns the place stock; the scene fills `round(count * stock / capacity)` of the points. Terrain, water and bank drawing are untouched.
- `fish.ts`: `fishGrowth(capacity, stock, remainder, percentPerYear, periodsPerYear)` replaces the hourly constant; the engine calls it once a day with `periodsPerYear = daysPerYear`.
- `ValleyState` stocks become per place: `foodStock: Int32Array` (kcal, berry and hazel thickets), `woodStock: Int32Array` (kg, thickets' dead stems and stands' deadfall), `logStock: Int32Array` (stands), `felledMinute: Int32Array` (stands, −1 while whole), `stoneStock: Int32Array` (outcrops). `treeLogs` and `treeFelledMinute` are removed.
- Config replaces per-plant parameters with per-place ones: `berryThicketCapacityKcal 3_120`, `berryThicketRegrowthKcalPerYear 54_000`, `berryThicketWoodKg 120`, `berryThicketWoodRegrowthKgPerYear 12`, `hazelThicketCapacityKcal 75_000`, `hazelThicketRegrowthKcalPerYear 150_000`, `standWoodKg 300`, `standDeadfallKgPerYear 60`, `standLogs 36`, `fellWood 10` (kept), `outcropStones 60`, `treeRegrowthYears 20`. Removed: `bushesPerThicket`, `hazelsPerThicket`, `treesPerStand`, `stonesPerOutcrop`, `stonesPerSpot`, `bushSpacingCm`, `hazelSpacingCm`, `treeSpacingCm`, `stoneSpacingCm`, `bushCapacityKcal`, `bushRegrowthKcalPerYear`, `initialBushKcal`, `bushCapacityWood`, `bushRegrowthWoodPerDecade`, `initialBushWood`, `hazelCapacityKcal`, `initialHazelKcal`, `hazelRegrowthKcalPerYear`, `treeCapacityWood`, `treeDeadfallWoodPerYear`, `initialTreeWood`, `logsPerTree`, `treeRegrowthDays`.
- `places.ts`: `buildPlaces(config, layout sites): PlaceTable`; `placesWithin(layout, x, y, radiusCm): number[]` (ids in increasing order, via `placeChunks`); `regrowPlaces(state, minute): { kcal: number; wood: number; logs: number }` applying `dailyShare` per place for the minute's day of year, capping at capacity, and restoring a felled stand's `standLogs` once `minute - felledMinute >= yearsToDays(config, treeRegrowthYears) * MINUTES_PER_DAY`; `capacityOf(config, kind): number`; `takeFrom(stock: Int32Array, id, wanted): number` returning `min(wanted, stock[id])` and subtracting it.

- [ ] **Step 1: Write the failing tests** in `places.test.ts`

```ts
it('lays out one place per former site with the summed capacity', () => {
  const state = createValley()
  const { places } = state.layout
  expect(places.count).toBe(800 + 800 + 300 + 100)
  expect(state.foodStock[firstOfKind(places, 'berry thicket')]).toBe(3_120)
  expect(state.logStock[firstOfKind(places, 'stand')]).toBe(36)
})
it('regrows each place its exact daily share', () => {
  const state = createValley({ daysPerYear: 90 })
  state.foodStock.fill(0)
  let total = 0
  for (let d = 0; d < 90; d += 1) total += regrowPlaces(state, d).kcal
  expect(total).toBe(800 * 54_000 + 800 * 150_000)
})
it('finds places within a radius in id order', () => {
  const state = createValley()
  const ids = placesWithin(state.layout, state.layout.camp.x, state.layout.camp.y, 100_000)
  expect(ids).toEqual([...ids].sort((a, b) => a - b))
  for (const id of ids) expect(distance(...)).toBeLessThanOrEqual(100_000)
})
it('empties a thicket over the same hours as sixty bushes', () => {
  // 3_120 kcal at pickKcalPerHour (Life 11's hourly take) → ceil(3_120 / rate) hours, the Life 11 figure
  let hours = 0; const stock = Int32Array.of(3_120)
  while (stock[0] > 0) { takeFrom(stock, 0, config.pickKcalPerHour); hours += 1 }
  expect(hours).toBe(Math.ceil(3_120 / config.pickKcalPerHour))
})
it('restores a felled stand after treeRegrowthYears', () => {
  const state = createValley({ daysPerYear: 8 })
  const stand = firstOfKind(state.layout.places, 'stand')
  state.logStock[stand] = 0; state.felledMinute[stand] = 0
  regrowPlaces(state, 159 * 1_440); expect(state.logStock[stand]).toBe(0)
  regrowPlaces(state, 160 * 1_440); expect(state.logStock[stand]).toBe(36)
})
it('grows fish by the yearly percentage spread over the periods', () => {
  // one period of a one-period year, half-full body of 1,000 at 20 % a year: logistic gain 1,000 × 0.2 / 4 = 50
  expect(fishGrowth(1_000, 500, 0, 20, 1).stock).toBe(550)
})
it('scatters decoration inside the place and the same way every time', () => {
  const points = decorPoints({ id: 7, x: 0, y: 0, radiusCm: 1_000 }, 60)
  expect(points).toEqual(decorPoints({ id: 7, x: 0, y: 0, radiusCm: 1_000 }, 60))
  for (const p of points) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1_000)
})
```

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/valley/places.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement.** `layout.ts` keeps site placement (spacing, dry footprint rejection, counts) and no longer places individual plants; `buildPlaces` numbers places berry thickets, hazel thickets, stands, outcrops, in site order. `createValley` fills the stock arrays from capacities. Leave `engine.ts` compiling by adapting `regrowFood`/`regrowWood` to call `regrowPlaces` daily (temporary; Task 7 rewrites the loop). Update `config.test.ts` and `layout.test.ts` for the removed parameters.
- [ ] **Step 4: Run.** Run: `npx vitest run src/valley/places.test.ts src/valley/layout.test.ts src/valley/config.test.ts` Expected: PASS. (`fingerprints.test.ts` is expected to fail from here until Task 11; do not run it.)
- [ ] **Step 5: Commit.** `git commit -am "feat(life12): represent thickets, stands and outcrops as places"`

---

### Task 3: The wake-up queue and `stepValley(state, toMinute)`

**Files:**
- Create: `src/valley/clock.ts`, `src/valley/clock.test.ts`
- Modify: `src/valley/types.ts` (`ValleyState.queue`), `src/valley/engine.ts` (signature only)

**Interfaces:**
- Produces, in `clock.ts`:
  ```ts
  export type WakePhase = 0 | 1 // 0 world, 1 person
  export type WakeKind = 'world' | 'end' | 'threshold' | 'arrival' | 'address'
  export interface WakeEntry { minute: number; phase: WakePhase; id: number; kind: WakeKind }
  export class WakeQueue {
    schedule(entry: WakeEntry): void
    cancelPerson(id: number, kind?: WakeKind): void
    peek(): WakeEntry | null
    pop(): WakeEntry | null
    entriesOf(id: number): WakeEntry[]
    clone(): WakeQueue
    size: number
  }
  export const WAKE_ORDER: readonly WakeKind[] = ['world', 'end', 'threshold', 'arrival', 'address']
  ```
  Ordering: minute, then phase, then id, then `WAKE_ORDER` index. A binary heap over a packed `Float64Array`-free plain array of entries is sufficient; determinism comes from the comparator, never insertion order.
- `engine.ts`: `export function stepValley(state: ValleyState, toMinute: number): ValleyState` (pure; clones, runs entries with `minute <= toMinute`, sets `state.minute = toMinute`, stores the interval's events in `state.lastInterval`); `export const runValley = (state, minutes, options?) => stepValley(state, state.minute + minutes)` keeps its name for tests and fingerprints; `runValleyDays` unchanged. Until Task 7 the body of `stepValley` calls the old `advance` once per minute, so everything still runs. `ValleyState.queue: WakeQueue` is added now and left empty until Task 7.

- [ ] **Step 1: Write the failing tests** in `clock.test.ts`

```ts
it('pops by minute, then phase, then id, then kind', () => {
  const queue = new WakeQueue()
  queue.schedule({ minute: 5, phase: 1, id: 3, kind: 'end' })
  queue.schedule({ minute: 5, phase: 0, id: 0, kind: 'world' })
  queue.schedule({ minute: 5, phase: 1, id: 3, kind: 'threshold' })
  queue.schedule({ minute: 4, phase: 1, id: 7, kind: 'end' })
  expect([queue.pop(), queue.pop(), queue.pop(), queue.pop()].map((e) => `${e!.minute}:${e!.phase}:${e!.id}:${e!.kind}`))
    .toEqual(['4:1:7:end', '5:0:0:world', '5:1:3:end', '5:1:3:threshold'])
})
it('is independent of insertion order', () => { /* same entries shuffled; same pops */ })
it('cancels one person without touching others', () => { /* cancelPerson(3) leaves id 7 */ })
it('advancing zero minutes changes nothing and never mutates its input', () => {
  const state = createValley()
  const before = JSON.stringify(state)
  const same = stepValley(state, state.minute)
  expect(same.minute).toBe(state.minute)
  expect(same.lastInterval).toEqual([])
  expect(JSON.stringify(state)).toBe(before)
})
```

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/valley/clock.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement `clock.ts`; change the `stepValley` signature** and every caller (`fingerprintRuns.ts`, tests, `valleyViewModel.ts` via `runValley`). `cloneValley` clones the queue.
- [ ] **Step 4: Run.** Run: `npx vitest run src/valley/clock.test.ts src/valley/engine.test.ts` Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(life12): add the wake-up queue and stepValley to a minute"`

---

### Task 4: Tasks and lazy bodies

**Files:**
- Create: `src/valley/tasks.ts`, `src/valley/body.ts`, `src/valley/tasks.test.ts`, `src/valley/body.test.ts`
- Modify: `src/valley/types.ts`, `src/valley/config.ts` (`walkKcalPerHour 250`, `moderateSlowdownPerMille 1_300`, `steepDownSlowdownPerMille 1_300`, `climbMinutesPerMetre 1`; remove `climbSecondsPerMetre`)

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export type TaskKind = 'sleep' | 'rest' | 'walk' | 'pick' | 'nuts' | 'fish' | 'drink' | 'gather' | 'cut' | 'make'
  export interface TaskRecord {
    kind: TaskKind
    startMinute: number
    endMinute: number           // planned; a threshold may wake earlier
    placeId: number             // −1 for a walk; the bank id for drink and fish
    routeId: number             // index into state.routes, −1 unless walking
    energyPerHour: number       // kcal, constant for the task
    waterPerHour: number        // ml, constant for the task, including the base loss
    startEnergyKcal: number; startEnergyRemainder: number   // remainder in 60ths of a kcal
    startWaterMl: number; startWaterRemainder: number       // remainder in 60ths of a ml
    reason: ActionReason
  }
  ```
  `Forager.task: TaskRecord | null` (null only before the first wake-up and after death) and `Forager.lastWakeMinute: number` are added; `Forager.route`, `Forager.movement` and every per-second body field go.
- `tasks.ts`: `taskRates(config, person, kind, warmth): { energyPerHour; waterPerHour }` (sleep by warmth as Life 11; rest/drink at `restKcalPerHour`; pick/nuts/fish at `pickKcalPerHour`; gather `gatherKcalPerHour`; cut `chopKcalPerHour`; make `makeKcalPerHour`; walk by slope class, set per segment by Task 5 and averaged exactly into the record as a per-hour integer plus a remainder is **not** done: a walk record holds its route id and `positionAt`/`energyAt` integrate per segment); `startTask(config, person, kind, minute, endMinute, placeId, routeId, reason): TaskRecord`.
- `body.ts`: `energyAt(task, minute, routes?): { kcal: number; remainder: number }`; `waterAt(task, minute, routes?): { ml: number; remainder: number }`; `firstThresholdMinute(config, task, routes?): { minute: number; crossing: 'hungry' | 'thirsty' | 'severe' | 'fatal energy' | 'fatal water' } | null` returning the earliest crossing strictly after `startMinute` and at or before `endMinute`; `waterThresholds(config)` moves here from `hydration.ts`. Energy owed over `m` minutes at rate `r`: `floor((r*m + rem)/60)`, new remainder `(r*m + rem) % 60`; water the same with `waterPerHour`.

- [ ] **Step 1: Write the failing tests** in `body.test.ts`

```ts
it('equals minute-by-minute accumulation with the same remainders', () => {
  const task = startTask(config, person, 'pick', 0, 600, placeId, -1, 'food')
  let kcal = 66_000, rem = 0
  for (let m = 1; m <= 600; m += 1) { const owed = 200 + rem; kcal -= Math.floor(owed / 60); rem = owed % 60
    expect(energyAt(task, m)).toEqual({ kcal, remainder: rem }) }
})
it('finds the exact minute of the first threshold', () => {
  // energy 64_010 at start, pick at 200 kcal/h: hungry (<64_000) after ceil(11*60/200) = 4 minutes
  expect(firstThresholdMinute(config, task)!.minute).toBe(4)
})
it('records both causes when the fatal minutes coincide', () => { /* construct rates so both cross at minute 30 */ })
it('a resting body loses 2,000 ml a day', () => { expect(waterAt(restTask, 1_440).ml).toBe(2_000) })
```

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/valley/body.test.ts src/valley/tasks.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** `tasks.ts` and `body.ts`. Do not wire them into `engine.ts` yet.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(life12): add task records and lazy bodies"`

---

### Task 5: Routes on the 20 m lattice

**Files:**
- Rewrite: `src/valley/routes.ts`, `src/valley/routes.test.ts`
- Delete: `src/valley/walkEstimates.test.ts` and the estimate code it covers in `forager.ts` (`estimateKnownWalk`, `knownWalkSeconds`, `cloneWalkEstimates`)
- Modify: `src/valley/types.ts`, `src/valley/config.ts` (`routeCellCm 2_000`; validation `routeCellCm % terrainCellCm === 0`, `chunkCm % routeCellCm === 0`), `src/valley/terrain.ts` (delete `TOBLER_PER_MILLE`, `toblerPerMille`, `speedOnGrade`, `walkCost`, `MAX_GRADE_PERCENT`)

**Interfaces:**
- Produces:
  ```ts
  export interface RouteLattice { cellCm: number; cells: number; dry: Uint8Array; edges: Uint8Array /* 8 bits per node: dry edge to each neighbour */ }
  export function buildLattice(config, terrain, banks: BankGeometry): RouteLattice   // in layout, once
  export interface Knowledge { nodes: Uint8Array /* 1 if seen */; revision: number }
  export type SlopeClass = 0 | 1 | 2  // flat, moderate, steep
  export interface RouteSegment { x0; y0; x1; y1; lengthCm; slope: SlopeClass; uphill: boolean; ground: Ground; minutes: number; kcal: number }
  export interface Route { segments: RouteSegment[]; minutes: number; kcal: number }
  export function knownRoute(lattice, knowledge, terrain, ground, banks, config, loadKg, from: Point, to: Point): Route | null
  export function nearestFrontier(lattice, knowledge, from: Point): Point | null
  export function estimateMinutes(config, from: Point, to: Point, speedCmPerMinute: number, climbCm: number): number  // straight line at flat speed + climbMinutesPerMetre * climb
  export function segmentMinutes(config, lengthCm, slope, uphill, ground, speedCmPerSecond): number  // ceil
  export function segmentKcal(config, minutes, slope, uphill): number
  export function slopeClassOf(config, terrain, a: Point, b: Point): { slope: SlopeClass; uphill: boolean }
  export function positionAlong(route: Route, elapsedMinutes: number): Point   // start of the first segment at 0, end of the last at route.minutes, linear within a segment at that segment's speed
  ```
  Node dry: `bankCircleWet(banks, centre, cellCm / 2)` is false. Edge dry: both nodes dry, `bankSegmentWet(banks, a, b)` false, and for a diagonal both adjoining cardinal nodes dry. Connectors from `from` and to `to` use the nearest known dry node whose connector segment is dry. A* with integer octile heuristic, ties by node id, over known nodes only. `ValleyState.routes: Route[]` holds routes by id, appended as walks start (not pruned in this pull request). Cache: `Forager.routeCache: Map<string, number>` from `${fromNode}:${toNode}:${knowledge.revision}` to a route id; `knownRoute` is given the cache and consults it first; `cloneValley` copies it.

- [ ] **Step 1: Write the failing tests** in `routes.test.ts` using `createSurveyedValley` and `addTestLake` from `ruleFixtures.ts`

```ts
it('bends around a known lake', () => { /* route from west of lake to east has minutes > straight-line minutes and no segment wet */ })
it('does not use a dry crossing it has not seen', () => { /* knowledge without the isthmus nodes: route null or longer; after observing them: shorter */ })
it('times segments by slope class', () => {
  expect(segmentMinutes(config, 12_500, 0, false, GRASS, 125)).toBe(2)   // 125 m flat at 1.25 m/s, ×1.2 grass → 120 s
  expect(segmentMinutes(config, 12_500, 1, true, GRASS, 125)).toBe(3)    // ÷1.3
  expect(segmentMinutes(config, 12_500, 2, true, GRASS, 125)).toBe(4)    // halved
})
it('costs walking by class', () => { expect(segmentKcal(config, 60, 1, true)).toBe(375); expect(segmentKcal(config, 60, 2, false)).toBe(250) })
it('places a walker on its route at every minute', () => {
  const route = knownRoute(/* a two-segment route */)!
  expect(positionAlong(route, 0)).toEqual({ x: route.segments[0].x0, y: route.segments[0].y0 })
  expect(positionAlong(route, route.minutes)).toEqual({ x: lastSegment.x1, y: lastSegment.y1 })
  for (let m = 1; m < route.minutes; m += 1) expect(distanceToPolyline(route, positionAlong(route, m))).toBeLessThanOrEqual(1)
})
```

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/valley/routes.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement the rewrite.** Keep the file under 600 lines; the old observed-cell search, `GroundKnowledge`, `routeFrontierCells`, `forEachUnknownCell`, `observeRouteCells`, `knownDryFootprint`, `knownDrySegment` and `routeAnchor` go. `forager.ts` compiles against stubs that Task 7 replaces: `Forager.knowledge` is typed as `Knowledge` and walks are read from `Forager.task` (Task 4).
- [ ] **Step 4: Run.** Expected: PASS for `routes.test.ts`; other suites may fail until Task 7.
- [ ] **Step 5: Commit.** `git commit -am "feat(life12): route on a 20 m lattice of known dry ground"`

---

### Task 6: Perception at wake-ups

**Files:**
- Create: `src/valley/perception.ts`, `src/valley/perception.test.ts`
- Delete: `src/valley/sight.ts`, `src/valley/waterKnowledge.ts`, `src/valley/waterKnowledgeChecker.ts` and their tests
- Modify: `src/valley/types.ts` (`Forager` memory fields)

**Interfaces:**
- `Forager` memory: `knownPlaces: Int32Array` (minute last seen, −1 never), `placeStock: Int32Array` (stock last seen; −1 unseen means "expected full"), `knownBanks: Map<number, BankMemory>` (kept), `fishMemory` (kept), `knowledge: Knowledge` (lattice nodes), `metMinute: Int32Array` (per person, −1 never), `heardTerms`, `knownFlags` (kept). Removed: `placeSeen`, `placesSeen`, `siteKnown`, `siteChecked`, `farPlace`, `farMinute`, `foodMemory`, `woodMemory`, `logMemory`, `stoneMemory`, `waterObservations`.
- `perception.ts`: `observeAt(state, person, minute): ObservationEvent` marks places within `sightRadiusCm` known, records the stock of the place the person stands at (`placeAt(layout, x, y)`: the place whose circle contains the point, else −1), marks lattice nodes within the sight radius known (per-chunk `fullyKnown` flags on `Knowledge` skip chunks already complete), adds bank points within the radius, and lists people within `talkRadiusCm`. `peopleInChunk(state, chunk): number[]`. `chunksOfRoute(lattice, route): number[]` in order of first entry with the entry minute.
- Arrival wake-ups: `scheduleArrivals(state, walkerId, route, startMinute)` schedules `{ minute: entryMinute, phase: 1, id, kind: 'arrival' }` for every person in each entered chunk whose task is interruptible (not `sleep`, unless severely thirsty), including a chunk entered at `startMinute`.

- [ ] **Step 1: Write the failing tests** in `perception.test.ts`

```ts
it('learns places within sight and the stock only where it stands', () => { /* placeStock of far thicket stays −1; of the one stood at equals truth */ })
it('sees nothing beyond the sight radius', () => { /* a place 1,001 m away stays unknown */ })
it('wakes a rester, not a sleeper, when a walker enters its chunk', () => { /* queue has an arrival entry for the rester at the entry minute and none for the sleeper */ })
it('wakes people in a chunk entered at the departure minute', () => { /* route starts in chunk A and crosses into B within minute 0 */ })
```

- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.** The chunk index of people: `ValleyState.peopleByChunk: Int32Array[]`, maintained when a task starts and ends (a walker belongs to the chunk of its position at its last wake-up; arrivals re-index it).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(life12): observe at wake-ups and wake on arrivals"`

---

### Task 7: The wake-up pipeline (engine and priorities)

This is the largest task and is split into three commits. It replaces `advance` and `takeTurn` in `engine.ts` with the pipeline of the spec's "A wake-up" section, and ports `forager.ts` from minutes to tasks.

**Files:**
- Rewrite: `src/valley/engine.ts` (target under 900 lines; move the world phase to a new `src/valley/world.ts`), `src/valley/forager.ts` (priorities and food choice), `src/valley/work.ts` (delete `minuteCost`, `workSeconds`, per-second costs; keep `warmthOf`, `sleepCostOf`, `tendFire`)
- Delete: `src/valley/hydration.ts` (thresholds moved to `body.ts` in Task 4), `src/valley/carrying.test.ts` (loads are now tested in `tasks.test.ts`)
- Modify: `src/valley/social.ts`, `huts.ts`, `axes.ts`, `trade.ts`, `fire.ts`, `practice.ts` (call sites only: they receive a person and a minute from a wake-up instead of a turn), `src/valley/engine.test.ts`, `food.test.ts`, `fire.test.ts`, `huts.test.ts`, `social.test.ts`, `sites.test.ts`, `banks.test.ts`, `water.test.ts`, `waterIntegration.test.ts`

**Interfaces:**
- `engine.ts`: `createValley(overrides)` seeds the queue with every founder's first wake-up at minute 0 and one world entry `{ minute: 60, phase: 0, id: 0, kind: 'world' }`; each world wake-up reschedules itself one hour on, so the queue always holds exactly one. Midnight work is detected by `minute % 1_440 === 0`. `stepValley` pops entries; `world.ts` exports `worldWake(state, minute): ValleyEvent[]` (midnight: `practiceDay`, `weatherHuts`, `regrowPlaces`, `fishGrowth` once per body with `periodsPerYear = daysPerYear`; every hour at night: `burnFires`); `personWake(state, id, minute, kind): ValleyEvent[]` runs the six steps of the spec's "A wake-up" (spoiling and eating in step 2 happen at the person's own wake-ups, not at midnight). Produced food is credited at task end: `pick`, `nuts`, `fish`, `gather` records hold the rate; the credit is `takeFrom(stock, placeId, rate × minutes / 60)` at the end minute, so an emptied place credits what was left.
- `forager.ts`: `chooseTask(state, person, minute): { kind: TaskKind; placeId: number; target: Point | null; reason: ActionReason }` implementing the ten priorities over memory; `foodGoal` scores `3_600 * rate / (estimateMinutes * 60 + 3_600)`; `mustGoHome` uses `estimateMinutes` of the known route home. A target with no known route is approached through `nearestFrontier`; with no frontier the person rests with reason `no known route`.
- `ValleyState` loses `lastWaterEvents` and the per-minute `lastEvents`; it keeps `eventDays` and `today`, and gains `lastInterval: ValleyEvent[]` (the events of the last `stepValley` call). `ValleyEvent` kinds: `task-start`, `task-end` (with `produced: { kcal; wood; logs; stones }`), `walk` (route id), `observe`, `meet`, `exchange`, `axe-request`, `promise`, `delivery`, `drink`, `death` (cause), `group-founded`, `group-joined`, `group-dissolved`, `fire`, `regrowth` (per place), each with `minute` and the person id where one applies. `totals.wakeUps` counts person wake-ups; the daily summary per person records `wakeUps` for the day.

- [ ] **Step 1 (commit a): sleep, rest and walk only.** Write failing tests in `engine.test.ts`: `a person sleeps from dusk to dawn as one task`, `a person walks home as one task and arrives at the route's minute`, `midnight regrowth leaves the queue's person entries unchanged`, `advancing a day at once equals advancing minute by minute` (`stepValley(s, 1_440)` deep-equals the result of 1,440 single-minute calls, both with `lastInterval` cleared). Implement the pipeline with a `chooseTask` that handles only priorities 2, 3 and 9 (rest when idle). Run: `npx vitest run src/valley/engine.test.ts` Expected: PASS. Commit: `feat(life12): run people by wake-ups`.
- [ ] **Step 2 (commit b): food, water and wood.** Write failing tests: `two pickers cannot overdraw a thicket`, `a thirsty person walks to a known bank and drinks until the stop`, `severe thirst wakes a sleeper`, `a full wood load goes home`, `a day of sleep and meals is identical at 8 and 365 days a year` (after one canonical day, every person's energy, remainders, water and carried lots are equal between `daysPerYear` 8 and 365; only place stocks may differ), and port `food.test.ts`, `water.test.ts`, `waterIntegration.test.ts`, `banks.test.ts` to tasks. Implement priorities 1, 4, 5, 6, 10 and `foodGoal`. Run those suites. Commit: `feat(life12): forage, drink and gather by tasks`.
- [ ] **Step 3 (commit c): groups, fires, huts, axes and exchange.** Port `social.test.ts`, `fire.test.ts`, `huts.test.ts`, `sites.test.ts`, `axes` and trade tests to wake-ups. Implement priorities 7 and 8 and the meeting step (found, join, swap, request, promise, deliver, contribute). Address wake-ups: an exchange or request schedules `{ kind: 'address' }` for the counterparty in the same minute. Run: `npx vitest run src/valley` (fingerprints excluded by `--exclude src/valley/fingerprints*.test.ts`). Expected: PASS. Commit: `feat(life12): meet, group, build and exchange at wake-ups`.

---

### Task 8: Invariants and the ledger

**Files:**
- Rewrite: `src/valley/invariants.ts` (target under 900 lines; split the replay into `src/valley/replay.ts` if it passes 600), `src/valley/invariants.test.ts` (new; takes the checker cases from `engine.test.ts`, `water.test.ts` and `huts.test.ts`), `src/valley/theory.ts` (analytic lazy-body examples)

**Interfaces:**
- `ValleyChecker` keeps `constructor(state)`, `check(state): string[]`, `assert(state)`. `check` is called after each `stepValley` in checked runs and replays `state.lastInterval` against the previous state it holds. Checks, each a named private method returning messages: `bodyCharges` (every task end's charge equals `energyAt`/`waterAt`), `positions` (every recorded position dry, on its route, one chunk), `conservation` (food, wood, logs, stones, axes, water withdrawals), `queue` (at most one `end` and one `threshold` per living person; no past entries; none for the dead), `memoryOnly` (every place, bank or node a decision used was observed at an earlier recorded wake-up), `order` (hysteresis, death minute and cause, dissolution), `regrowth` (never above capacity, daily shares sum).

- [ ] **Step 1: Write the failing tests** in `invariants.test.ts`: corrupt, one at a time, a task end's `produced.kcal`, a person's `x` to a wet point, a route segment into water, a queue entry in the past, a `placeStock` memory for a place never observed, and a `foodStock` above capacity; `expect(checker.check(state)).not.toEqual([])` for each, and `toEqual([])` for a clean 30-day run of the canonical valley.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.** Delete every per-minute and per-second check; keep `layoutViolations`, `waterViolations`, `bankViolations` as the once-only geography checks.
- [ ] **Step 4: Run.** Run: `npx vitest run src/valley/invariants.test.ts` Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(life12): check intervals, lazy bodies and the queue"`

---

### Task 9: Remove the rest of the old representation

**Files:**
- Delete: any file left that only served the per-minute loop (`cellHeap.test.ts` if `CellHeap` is now used only by `water.ts`, keep it there).
- Modify: `src/valley/config.ts` (final parameter table matching the spec's defaults section), `src/valley/config.test.ts`, `src/valley/types.ts` (no dead types), `src/valley/layout.ts` (streams)

**Interfaces:**
- `bandSize` becomes `founders`, default **8 in this pull request** (the spec's 40 arrives with the settings panel in pull request 2), range 1 to 1,000; `valleyConfigErrors` rejects more founders than the start area holds at the start spacing with `founders: the start area holds at most N people at startSpacingCm`.
- Streams: each founder's start and born skills come from `deriveStream(seed, 'founder:' + id)`; `deriveStartSeed`, `deriveTurnOrderSeed` and `turnOrder` are deleted. Axes keep `axe:<maker>:<n>`.

- [ ] **Step 1: Write the failing tests** in `config.test.ts`: `rejects more founders than the start area holds` (expects the message above with its computed N) and in `layout.test.ts`: `draws each founder from its own stream` (changing `founders` from 8 to 9 leaves the first eight starts unchanged).
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement, then grep for the dead.** Run: `rg -n "toblerPerMille|walkCost|BodySecond|MovementSegment|groundKnowledge|placeSeen|siteChecked|bushesPerThicket|treeRegrowthDays|climbSecondsPerMetre|bandSize|deriveTurnOrderSeed" src` Expected: no matches in `src/valley`; hits in `src/valleyView` are noted for Task 10.
- [ ] **Step 4: Typecheck, lint and run the valley suite.** Run: `npm run typecheck && npm run lint && npx vitest run src/valley --exclude "src/valley/fingerprints*.test.ts"` Expected: clean and PASS.
- [ ] **Step 5: Commit.** `git commit -am "chore(life12): remove the per-minute representation"`

---

### Task 10: The observer

**Files:**
- Modify: `src/valleyView/valleyViewModel.ts` (target under 700 lines), `valleyViewModel.test.ts`, `playback.test.ts`, `ValleyApp.tsx`, `valleyScene.ts` (people and stock drawing only), `LandMap.tsx`, `display.ts`, `life.css` as needed

**Interfaces:**
- `DisplayPair` becomes `Display { state: ValleyState; minute: number }` (the state at or after `minute` with `state.minute >= minute >= state.minute - interval`; the view keeps the state of the last `stepValley` and a continuous displayed minute inside its interval). Replace `advancePlayback` with `advanceDisplay(display, elapsedSeconds, speed, budgetMs): Display` which calls `stepValley(state, floor(targetMinute))` in one call per frame and sets `minute = targetMinute`.
- `VALLEY_SPEEDS` starts at `1 min / s` (the real-time 1/60 entry is removed; `DEFAULT_SPEED_INDEX` points at `1 min / s`) and gains `{ label: '1 day / s', minutesPerSecond: 1_440, map: true }`, `{ label: '1 month / s', minutesPerSecond: 30 * 1_440, map: true }`, `{ label: '1 year / s', minutesPerSecond: 90 * 1_440, map: true }`; `mapSpeedMinutesPerSecond = 1_440` exported; at map speeds `ValleyApp` passes `drawPeople: false` to the scene and redraws stocks, groups and huts once per advanced interval.
- `foragerPose(display, id)` uses `positionAlong(route, minute - task.startMinute)` from `routes.ts` for a walk and the person's position otherwise; gesture from `task.kind`.
- `displayedStock` and `decorPoints` from Task 2 stay; nothing per bush is read anywhere in the view. `BERRIES_PER_BUSH`, `NUTS_PER_HAZEL` stay as look constants.
- Header shows `day d of year y · <season name>` from `calendar.ts` (names: spring, summer, autumn, winter) and `minutes / s` of wall time measured over the last second; the person panel shows task kind, start, planned end, next wake-up and its kind, from `state.queue.entriesOf(id)`.

- [ ] **Step 1: Write the failing tests** in `valleyViewModel.test.ts` and `playback.test.ts`: `positions lie on the recorded route at every displayed minute` (sample 100 minutes of a walk; each point within 1 cm of the segment polyline), `the display never shows a minute the state has not reached`, `map speeds stop drawing people`.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep `valleyScene.ts` edits to the people and stock paths; do not touch terrain, water, bank or tile code.
- [ ] **Step 4: Run.** Run: `npx vitest run src/valleyView` Expected: PASS.
- [ ] **Step 5: Browser check.** Start the dev server by its launch name `econ-engine`, open `/life.html`, show the pane. At `1 min / s`: a person walks continuously, no jump. At `1 day / s`: the same walk compressed. At `1 year / s`: the map updates, no people drawn, console clean. Take one screenshot at each of the first and last.
- [ ] **Step 6: Commit.** `git commit -am "feat(life12): draw people from task records at any speed"`

---

### Task 11: Fingerprints

**Files:**
- Modify: `src/valley/fingerprintRuns.ts` (`twelve: { founders: 12 }`), `fingerprints*.test.ts`

- [ ] **Step 1: Run the fingerprint suite once to see every recorded hash fail.** Run: `npx vitest run src/valley/fingerprints.test.ts` Expected: FAIL on hashes only, no exceptions.
- [ ] **Step 2: Re-record** every configuration and seed with the tool the file documents (the printed hashes on failure); paste into `RECORDED`.
- [ ] **Step 3: Run again.** Expected: PASS. Run twice to confirm determinism: the second run must not print a differing hash.
- [ ] **Step 4: Time a canonical year.** Run: `node --import tsx -e "..."` or a vitest `it.skip`-free timing in `engine.test.ts` printing `minutes per second`; record the number for the lab notes. Expected: a year of eight in well under a second.
- [ ] **Step 5: Commit.** `git commit -am "test(life12): record fingerprints for the wake-up engine"`

---

### Task 12: Documents

**Files:**
- Modify: `CHANGELOG.md`, `LAB_NOTES.md` (newest-first entries `[LIFE12-Refoundation-055]`), `docs/ARCHITECTURE.md` (replace the Life 11 section with "Life 12: clock, places and routes"), `docs/VALIDATION.md` (Life section: interval checker, fingerprints, timing), `README.md` (Life paragraph: **Life 12 · strangers**, eight people until pull request 2), `docs/CALIBRATION.md` (reduce Terrain, Carrying loads and Water sections to magnitudes and sources; delete the formula tables), `docs/LIFE12_SPEC.md` (correct wherever implementation proved it wrong, in place)
- Delete: `docs/LIFE11_SPEC.md`

- [ ] **Step 1: Write the entries and edits.** The lab-notes entry records: the measured minutes per second before and after, which rules needed a choice during the port and what was chosen, and what the fingerprints changed.
- [ ] **Step 2: Run the whole check.** Run: `npm run agent:check` Expected: PASS; inspect only a failed stage's smallest log excerpt.
- [ ] **Step 3: Commit.** `git commit -am "docs(life12): record the re-foundation"`

---

### Task 13: Finish

- [ ] **Step 1: Review the branch** with `git diff origin/main --stat` and confirm no file under `src/sim/` changed.
- [ ] **Step 2: Suggest the pull request** titled `feat(life12): re-found the Life core on a minute clock with wake-ups` with a body summarising the spec sections implemented, the timing, and that run settings and forty founders follow in pull request 2. Do not open it unless the owner asks.
