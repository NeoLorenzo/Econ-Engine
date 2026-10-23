# Econ-Engine lab notes

[CHANGELOG.md](CHANGELOG.md) records what changed in the software. `LAB_NOTES.md` records the reasoning, experiments, observations, trade-offs, and lessons behind those changes.

## Maintenance convention

Every meaningful model, architecture, experimental, or design update should receive a newest-first entry. Use at most one base update number per Git commit. Refinements completed before that commit keep the same base number with a decimal suffix—for example, `003` and `003.1` belong to the same commit family. Allocate the next base number only for a later commit. Preserve the context, observed problem or research question, rationale, important implementation decisions, trade-offs, findings, and unresolved questions. Distinguish verified observations from hypotheses. If the original rationale is unknown, say so rather than inferring intent from the finished code.

## [LIFE12-Observer-061] - (2026-10-23)

The third re-foundation pull request cleans up the observer at the owner's request. The engine and the fingerprints are unchanged.

**Black screen.** The loading card went away as soon as the valley's state existed. The 3D view then still had to load three.js and build the terrain and water meshes, and meanwhile the empty dark page showed. The card now stays until the view reports its first drawn frame, or reports that WebGL failed.

**Panels.** The owner wanted fewer words and a clear hierarchy. The day, season, time and count of the living moved to the heading, and New run joined the controls there. The person panel now leads with the name and the task. Energy, thirst and load follow as three matching bars. Thirst runs from none to the water loss that kills, with marks at thirsty and severely thirsty. Load is full at the heavier of a wood load and a log. Skills follow as three rings: picking, wood and axe-making, each born skill times practice, filling towards the most any forager could reach. A radar chart was considered and rejected, because with three skills it is only a triangle. The rings also read apart from the need bars. The other lines are in a closed Details section, and the debugging lines (task minutes, next wake-up) are gone. The history panel keeps all its charts, by the owner's choice; its long description is replaced by an ⓘ window with the settings, the controls and the colour key.

## [LIFE12-Settings-060] - (2026-10-23)

The second re-foundation pull request adds the run settings and the forty founders.

**Settings.** The page no longer builds a valley on load. It shows the five run settings with their ranges, and Start builds the valley behind the existing loading card. Once a run starts its settings cannot change; New run discards it. The owner chose to drop Life 11's setup form, since the specification names only five run settings and the project is building features, not experiments. The page allows at most 100 founders, Life 11's observer limit, because every person is drawn as a figure; the engine still accepts 1,000.

**World size.** Measured on the first pull request's code, worlds of 1, 2 and 3 km were refused: the fixed counts of 800 thickets, 800 hazel thickets, 300 stands, 100 outcrops and the landforms cannot be placed in them. The settings now scale every one of those counts by the world's area, rounded, with at least one of each. At 4 km the configuration is exactly the default, and a 1 km world has 50 thickets and 19 stands. The engine is unchanged. Creating a 4 km valley takes about 9 s and a 10 km valley about 66 s in Node; the loading card says large worlds take up to a minute or more.

**Forty founders.** The eight-person fingerprint configurations now name `founders: 8`, and the flat test land carries eight. Their 21 hashes are unchanged, since each run sees the same configuration as before. The forty-founder default has one recorded run on seed 20260813. It passed the checker at every daily interval and takes about 45 s. A ninety-day year of forty takes about 64 s of simulation in Node, eight times the eight-founder year and far from the specification's "about a second". In the browser the map speeds run much slower than their labels. The owner accepted that this pull request has no performance pass.

## [LIFE12-Loading-059] - (2026-10-23)

Generating the valley blocks the page for 5 to 12 seconds, and without a sign of work the page looks frozen. The page now carries a static loading card that shows before any script runs; React replaces it once the first valley exists. Reset shows the same card, waits for it to be painted, then checks the layout and builds the valley. The spinner turns with a transform animation, which the browser runs off the main thread, so it keeps turning while the valley is built. In development, strict mode built the first valley twice; it is now built once. The engine and the fingerprints are unchanged.

## [LIFE12-Refoundation-058] - (2026-10-23)

Tasks 9 to 13 of the first re-foundation plan finish the first pull request.

**Cleanup.** The removed configuration keys, the per-minute types and the slope and load formula tables are gone. Validation now names the founders' range (1 to 1,000) and refuses more founders than the start area holds at the start spacing (289 at the defaults). Each founder is drawn from its own stream, so a run with nine founders starts the first eight exactly as a run with eight.

**Observer.** The view keeps one state and a continuous displayed minute. The first port ran the engine to the first whole minute at or after the displayed one. The new observer tests showed that this hides any walk shorter than a minute: the wake-up that ends the walk has already run, so the walk is never drawn. The engine now runs to the last whole minute at or before the displayed one. Every wake-up up to the drawn minute has run, and none after it, so the task drawn is the one under way. Positions come from `positionAt`, and energy from `energyAt`.

The first frame budget divided the time of the last step by its minutes. A step costs about 22 ms whatever its length, for copying the state, so that estimate settled at one minute a frame, and a day a second ran at a few minutes a second. The allowance now doubles while steps fit a 40 ms budget and halves when they do not. In the preview pane, whose frames are throttled, a month a second then measured about 250 simulated minutes a second; a visible window does better. Thickets, stands and outcrops are drawn as decoration: 12 bushes, 6 hazels or 8 rocks per place, and one tree per three logs, sharing out the place's stock in turn. The decoration uses no simulation stream.

**Fingerprints.** All 21 hashes changed, as expected from a new engine. Two runs failed the checker rather than the hash, and both faults were in the checker. In twelve-person seed 2, a person finished a cut, started another and was interrupted in the same minute. The checker keyed cuts by minute and person, so it credited the empty second task with the first one's log. Each cut record now counts once. In flat-land seed 2, a member died, the group dissolved and the survivor then died in the same minute. The dead member still names the dissolved group, which the checker rejected. Now a living member needs a standing group, and a dead member only needs to be on the group's list. The engine was not changed, and the new hashes were recorded after both runs passed the checker. Flat land has no water, so on every seed everyone dies of thirst within three days; this configuration tests the rules, not survival.

**Speed.** `node scripts/time-life.mjs 90 batch` runs a canonical ninety-day year with eight founders in about 5 to 8 seconds of simulation (8.3 s while the fingerprint suite ran beside it), with all eight alive and 17,663 wake-ups. Creating the valley takes a further 5 to 12 seconds. The specification's target of a year of eight in well under a second is not met. The likeliest costs are copying each person's memories on every step and the creation of terrain, banks and the route lattice. Both are left for a performance pass that must keep these fingerprints.

## [LIFE12-Ledger-057] - (2026-10-23)

Task 8 is implemented after the rejected checkpoint corrections. `ValleyChecker` now holds the preceding immutable state and validates an interval, without running the engine again or advancing bodies. `replay.ts` keeps separate stock, fish, body, tool, hut and withdrawal ledgers. It computes capped production from the task's rate and integer remainder, verifies body payments against lazy integration, replays regrowth at midnight, and compares the resulting records and quantities with the returned state. Task starts retain the trip's wood and load so production limits and walking times can be checked against the load actually carried, even if a later meeting changes the hearth.

Hourly world boundaries, fish regrowth (including its exact remainder) and sleep-rate changes are explicit ledger records. The checker verifies world-before-person ordering and the sequence of world hours, tracks personal and shared fire states across the interval, checks death causes and fatal minutes, hunger/thirst hysteresis, group dissolution and hearth slots, gifts, tool production and wear, and source observations against the stock ledger. Position checking follows recorded routes rather than drawing a chord or judging an old journey against a newly assigned hearth. The chunk index is refreshed from lazy positions at the interval endpoint; no body or task is advanced by that refresh. Once-only layout, water and bank geometry checks remain. Both checker modules stay within the plan's size limits.

The remaining retained Life 11 corruption cases now live in `invariants.test.ts`: sound intervals; fabricated/lost food, wood, logs, stones and tools; wrong body charges, route grade or loaded speed; wet/off-record positions; phantom huts; wrong fish remainders, drink volume or source identity, and death records; unknown or distant observations; old queue entries; invalid groups/hearths; wrong fire burn, warmth, gifts or gift locations. Each damaged-state test first checks the untouched interval passes. The canonical eight-founder run is checked at every daily interval for thirty days, with all eight alive. Analytic tests now describe aggregate food/log offers, annual shares, class-based walking and lazy daily/four-hour bodies rather than the removed formulas. The preceding entry lists every deliberate old-test removal and its replacement or specification reason.

After Task 8 the core suite passes 227 tests in 23 files. `node scripts/time-life.mjs 90 batch` runs a canonical 90-day year with eight founders in 4.75 to 5.65 seconds of simulation on the development machine (about 53 to 63 ms a day, 17,663 person wake-ups), with all eight alive; creating the valley takes a further 5 to 9 seconds. Typecheck fails only in the observer, which Task 10 ports; the old fingerprint hashes remain for Task 11. The MVP9 source is unchanged.

## [LIFE12-Review-056] - (2026-10-23)

The owner rejected the Task 7 checkpoint because routing dominated the runtime, two founders died of thirst, and retained rule coverage had been removed. This correction precedes Task 8.

The canonical starts for founders 4 and 6 were dry at the old placement resolution but had no dry connector to the 20 m route lattice. Their unchanging positions and deficits explained the deaths at minute 4,320; no threshold was lost at midnight. Start placement now rejects an unconnected draw, using the same founder stream for the replacement. A second failure selected nearby banks and food places in a disconnected component. Goal candidates now require connectivity through the person's observed nodes. The checker and search never use the global component labels to grant knowledge. These are reachability repairs, not reduced thirst or free water. The canonical thirty-day regression keeps all eight alive; the ninety-day run also keeps all eight alive.

Every immutable bank approach now has its connector node and height computed during layout creation. Exact-point connectors cache successful and failed geometry; route searches use previously validated edges without repeating water collision. A spatial tree orders bank candidates by a valid estimate bound, excludes unknown banks, and returns at most three water candidates. Only these candidates get real route searches. Food, wood and company goals choose by estimates and search one chosen route. Food scoring rejects candidates whose upper bound cannot beat the current winner, including entire fish-body searches. Repeated immutable views, place neighbourhoods, frontier results and search buffers are derived caches, while full routes and task bodies remain recorded. Cached and uncached routing, new knowledge, cloned bank memories, exhaustive candidate ordering, bank endpoints without geometry calls and interval partitioning have regression tests. A restored fire test also caught a missing daily contribution counter, now repaired.

Timing on this machine before the Task 8 ledger additions: one pure `stepValley` interval over a canonical 90-day year with eight founders took **4.371 seconds**, or **48.57 ms per simulated day** averaged across the year, with all eight alive. Layout creation took 7.264 seconds separately, including the new connector/index precomputation. This meets the owner's five-second simulation target but not the specification's well-under-one-second goal. Remaining cost includes route search, perception, goal queries and allocations; immutable bank precomputation also makes initialisation expensive. The reproducible `scripts/time-life.mjs` command reports creation and simulation separately. Final timings after Task 8 are in the next entry. Validation before Task 8: 185 core tests in 21 files passed, excluding old fingerprints, observer suites and the new checker tests. `agent:check` passes lint and reaches the expected unported-checker/observer type errors; later stages do not run.

### Coverage disposition

Fire, hut, group, source-choice, load, food and water rules have been ported to task boundaries. Checker-corruption cases move into `invariants.test.ts` in Task 8. Parameter arithmetic, skill independence, pausable making, quality and wear, three-log crowns, delivering, taking up spares, hut warmth, hearth rings, weathering and abandonment, promises, midpoint sales and inability to pay, group formation/joining/dissolution, talking-distance and group trade restrictions, personal/shared fire burning and giving, food slowdown, fishing memory, spoilage, load priorities and lazy water/body accounting remain covered. Removed minute-level assertions are replaced by task-start, task-end, body-at-minute and interval records rather than simply deleted.

These old tests are deliberately not retained with their old assertions (titles identify the Life 11 test):

| File / old test | Reason / replacement |
| --- | --- |
| social: “divides the valley into 729 places of 30 m, the last row and column cut at the edge” | The 30 m exploration-place grid is replaced by the 20 m routing lattice and resource places. Lattice and frontier tests cover the replacement. |
| social: “counts a place seen only when all of it lies in view, as it does from its centre” | Nodes and place centres are now seen within the declared sight radius; whole old exploration cells are no longer records. Perception boundary tests replace it. |
| sites: “sees across the flat valley by day and only close by at night” | The approved Life 12 fixed sight radius replaces the day/night sight switch. |
| sites: “marks every place within sight seen, and keeps the minute it first saw it” | Memory explicitly stores the latest seen minute; stock checks have a separate timestamp. A new test checks both. |
| sites: “searches the nearest thicket it has never checked before unseen ground, and both before revisiting” | The approved priority 9 chooses an unseen frontier before a 24-hour recheck. The new exploration/recheck tests pin that order. |
| engine: “walks to a bush and picks it in the same minute” | Walking and picking are distinct tasks; production is credited at a task end. Arrival and production tests replace per-second work sharing. |
| engine: “otherwise chooses the bush seen longest ago” | Source choice now uses expected one-hour returns at aggregate places; the 24-hour recheck rule handles stale observations. |
| engine: “keeps its target while it remembers it holding a minute’s work” | A recorded task persists until an allowed wake-up; at that wake-up priorities are reconsidered. Queue/task tests replace per-minute target retention. |
| carrying: “costs energy by the Pandolf equation: 222 kcal an hour unloaded, 316 under 30 kg and 341 under a log” | The spec replaces this equation with slope-class hourly costs. Load slowdown and route costs remain tested. |
| terrain: “follows Tobler’s curve to the thousandth, fastest at −5%” | Replaced by the specified three slope classes. |
| terrain: “takes grades in whole percent towards zero, held within ±60” | Old clamped grade/speed rules are replaced by endpoint slope classes. |
| terrain: “costs what the Pandolf equation with Santee’s correction gives” | Replaced by the specified class costs; new route/body tests cover them. |
| terrain: “judges a walk by its distance and its climb, as Naismith’s rule does” | Its old seconds/coefficient assertions are replaced by minute estimates with the declared climb allowance. |
| terrain: “sees across flat ground, and every place sees itself” | Old exploration-cell visibility is replaced by point/node sight-radius tests. |
| terrain: “is blocked by a hill between two points” | The approved sight model has no hill occlusion. |
| terrain: “does not spot a site hidden behind a hill” | Same removal of hill occlusion; sight-radius boundaries remain tested. |
| terrain: “give the same run whatever their size” | Chunk entries now intentionally cause wake-ups, so chunk size is part of the simulation cadence. Batch/interval equivalence remains required. |
| layout: “scatters each thicket’s bushes within its radius and apart, in thicket order” | Individual resource plants are gone. Deterministic decoration remains inside place footprints; aggregate stocks and placement are tested. |
| layout: “lists every tree, then every bush, as wood plants” | Wood is indexed by resource place, not individual wood plants. Place ordering/stocks are tested. |
| layout: “shares a year’s or a decade’s regrowth among its hours exactly” | Daily/yearly calendar shares replace hourly plant regrowth. |
| layout: “takes exactly an hour’s rate from an hour of work, minute by minute or in odd pieces” | Whole-minute tasks replace per-second work; lazy integration and interruption remainders cover the retained accounting rule. |
| layout: “charges each second at its hourly cost, and each task its own” | Replaced by exact lazy-body integration at minute boundaries, including fractional route-time remainders. |
| water: “drinks before loss, never overfills and reports the exact fatal second” | No second clock remains. Drinking, nonnegative deficit and coincident fatal-minute tests cover the new contract. |
| water: “shares travel estimates without changing per-segment rounding, ascent or return direction” | The owner explicitly replaced per-edge rounding with journey-end rounding. New pace and warm/cold route tests cover it. |
| walkEstimates: “reuses idle reachability proofs only while their position, knowledge and daylight budget agree” | The old per-minute estimate/proof implementation is removed. Current exact-point, knowledge-revision, load and bank-index cache tests cover the new caches. |
| walkEstimates: “keeps exact costs and rejection boundaries through load, hearth, terrain, knowledge and branch changes” | Same removed estimate implementation; current route and interval tests cover its retained determinism/knowledge requirements. |

The old “dead branches under standing trees only” assertion is intentionally adapted to stand-level capped deadfall, as the approved place specification requires. The tree-by-tree regrowth assertion is retained through independent three-log felling deadlines. Exact fatal-second and within-minute arriving/drinking assertions are adapted to separate whole-minute task boundaries, not retained as a hidden second clock. Old checker cases for wrong charge/speed/grade, impossible tools, unrecorded resources, wrong warmth/gifts, groups and observations are ported in Task 8 rather than discarded.

## [LIFE12-Refoundation-055] - (2026-10-23, Task 7 checkpoint)

Tasks 1 through 7 of the approved first re-foundation plan are implemented. Work stops here for the owner's review, before the interval checker (Task 8). The engine now advances an integer minute clock by queued world and person wake-ups; it records tasks, routes, observations, transfers and lazy body charges. The former per-minute engine and temporary port adapters have been removed. Eight founders and person objects with typed-array memories remain, as the first-pull-request plan directs. `wake.ts` holds the person pipeline and `summary.ts` measures daily portions of ongoing tasks without waking people; `engine.ts` stays below its 900-line limit.

### Port decisions

- **Owner decision: harvesting.** Retain Life 11's stock-dependent slowdown. Compute the skill-adjusted rate from the remembered stock fraction at task start, retain it until interruption or completion, and cap credited production at the stock then remaining. Concurrent pickers cannot overdraw a place.
- **Owner decision: walking pace.** Accumulate fractional edge durations before rounding the journey's end to a minute. Rounding each 20 m edge separately would visibly slow people. Durations use integer 1/60,000-minute arithmetic; the simulation clock still advances only in whole minutes. The final fraction after physical arrival is charged at the standing rate. Energy and activity-water time remainders survive interruptions, separately from the daily base-water remainder.
- **Routes.** A* minimises integer lattice distance, with octile priorities and node-ID ties. Ground class is sampled at a segment's start and slope from its endpoint heights. Connectors use the nearest observed dry anchor in the point's cell or eight neighbours, preventing a distant connector from crossing unseen land. Both dry and observed cardinal support are required for diagonal traversal. Collision tests include centimetre clearance so rounded displayed positions stay dry. Route-cache keys include exact endpoints, knowledge revision and load; routes are retained in the state for replay.
- **Knowledge.** Seeing a place's location and checking its stock have separate timestamps. Otherwise repeated distant sightings would postpone the one-day stock recheck indefinitely. Seen people have sight timestamps and remembered positions separate from talking-distance meetings. Unknown place stock remains optimistically full; an unknown fish stock is learned by a one-minute fishing probe, the smallest task the minute clock represents.
- **Arrivals.** A fractional chunk entry is assigned to its containing minute, including the departure minute. A mover's own entry notification refreshes the spatial index and notifies current occupants without ending the mover's task. Arrival records carry the walk's route and start minute, so stale notifications are ignored; duplicate notifications from the same walker in a minute are coalesced. Address notifications are also coalesced per recipient.
- **Trade.** Meeting and offer acceptance read a counterparty's projected body and route position at the current minute, without charging or restarting that person's task. Only the resulting goods, tools, promises and quotes are copied back; an address wake-up then lets the recipient react. This preserves exchange-before-fire-contribution ordering. Food gathered for a wood or axe purchase includes the purchase budget above the person's own reserve refill. A full wood load is returned home rather than scheduling repeated zero-output gathering tasks. Existing valuations, skill practice, promises, axe quality, durability and advantageous-exchange rules are retained.
- **Stones and axes.** Taking one stone is a one-minute `gather` task; there is no separate stone task kind. Axe work keeps its partial progress across interruptions. Axe quality uses the maker's successive axe number in its derived stream, rather than the completion minute.
- **Stands.** A stand retains one log stock. Each consecutive three-log bundle represents one former tree; its first cut adds 10 kg of crown wood. Fully harvested bundles retain their felling timestamps and regain three logs independently after twenty configured years. An incompletely harvested bundle waits until its remaining logs have been taken. This corrects the earlier Task 2 shortcut that restored only an entirely emptied stand. Crown wood may temporarily exceed the deadfall capacity; daily deadfall growth neither adds above that cap nor destroys crown wood already present.
- **Sleeping and daily accounting.** Hourly fire or hut warmth changes append a rate boundary to the ongoing sleeping task and update any body-threshold notification, without waking the sleeper. Daily summaries measure only the portion of a task inside that day; body payment and production still occur at the person's wake-up. Carried food spoils and is eaten at personal wake-ups, as the wake-up section and Task 7 require.
- **Calendar rounding.** Daily shares carry the exact annual integer allocation before capacity capping. At eight days per year a berry thicket's daily share can exceed its capacity, so capped actual growth is smaller than its nominal annual allocation. The cap is retained rather than changing resource magnitudes. Season quarter boundaries are integer day boundaries; the remaining days belong to winter.

### Validation and remaining work

Before engine changes, the three canonical seed records in `fingerprints.test.ts` passed (1,481.03 seconds for those checked Life 11 trajectories). This is a validation duration, not a canonical-year throughput measurement. Fingerprints have not been replaced; Task 11 owns their new records and the year timing.

The generated-terrain eight-founder anchoring test passes: after one day, energy, energy remainders, water, water remainders and carried lots are identical at eight and 365 days per year. Its two complete initialisations and day runs took about 62 seconds in the focused invocation; it has a 120-second timeout. This does not establish the plan's year-speed target. Fast fixtures also cover concurrent harvesting, lazy thresholds and simultaneous fatal causes, known dry routing, arrivals, same-minute exchange addresses, crafting, log delivery, crown wood, independent log regrowth, and batch-versus-minute equivalence with shared fires and crafting.

`npm run agent:check` passes lint but currently fails typecheck in the unported interval checker and observer. Those are Tasks 8 and 10, explicitly beyond this checkpoint. Its test and build stages therefore do not run. Browser acceptance awaits Task 10; the current observer is not a usable Life 12 observer. Remaining compatibility fields, old configuration names and unused terrain formulas await Task 9. Final architecture/validation/README/calibration updates and specification cleanup remain Task 12. No MVP9 source was changed. The focused core suite passed all 124 tests in 20 files (71.13 seconds), excluding old fingerprints and the observer suites. The core-suite command was `npx vitest run src/valley --exclude 'src/valley/fingerprints*.test.ts' --exclude 'src/valleyView/**' --maxWorkers 1`; the second exclusion is necessary because the first path filter also matches `src/valleyView`.

## [LIFE11-ContinuousBanks-054] - (2026-10-22)

The owner reported urgent Life lag, water clipping and animations ignoring playback speed. Spatial tiles now retain the terrain, water and bank triangles with independent camera/shadow bounds. Shrub tiles shrink from 400 m to 100 m; tree parts also use tiles, stable picking IDs and visible-plant iteration. Gestures, flags and flames use displayed simulation time, including interpolation, so speed and pause affect their phase. Before the bank refinement, the same canonical daytime camera submitted 8,824,614 triangles per frame before this rendering repair and 710,362 after, including every indexed/unindexed/instanced and shadow draw (about 92% fewer). This measures geometry, not proportional FPS or simulation throughput.

The owner confirmed smoother playback but rejected the square, stair-stepped shorelines. The original Life 11 specification required wet-cell squares, so repairing gaps alone could not correct their outline. On 2026-10-22 the owner approved continuous banks shared by rendering, collision and access. This intentionally changes geography, usable drinking points, fish capacities and trajectories; fingerprints must be refreshed rather than preserved across that rule change.

`banks.ts` refines the shore neighbourhood with shared terrain corners, edge midpoints and bed centres. Connected channel edges stay submerged; water is clipped against lake levels or interpolated river levels. Integer intersections are shared by adjoining triangles, and both wet and dry ground pieces use them. Dry-neighbour pieces must connect to a real source, preventing isolated decorative puddles. Exact doubled polygon areas retain half-square-centimetre triangles until a single final conversion to square metres. No new random streams, survival placement, weather or erosion model is added.

Observed graph centres remain coarse, but bank connectors and movement use actual water polygons. A dry approach can lie inside a surveyed shore cell and connect to a known dry centre. The checker caught inherited square-cell assumptions and movement rounding near the new contour; graph edges and connectors now preserve centimetre clearance. A compact patch mask keeps walks away from shores on the cheap path, and numeric triangle queries avoid allocating point objects in the collision loop. Individual banks are learned only from fully observed patches and approaches. Bare rectangular water remains an explicit analytic fixture, not a production configuration switch.

The original canonical fingerprints passed before engine edits. Small bank, terrain and route fixtures pass, including shared contact, real-bank access, corrupted geometry, exact collision and cold/warm route agreement. The daytime observer shows a continuous sloping lake shore; a forager reached a new bank and drank. Its console had no warnings or errors. All 21 required 30-day trajectories completed with the minute checker enabled: 18 terrain-bearing records changed and the three flat-land records stayed exact. Recording accepted only completed runs reaching the final fingerprint assertion, never invariant failures. An independent repeat matched the refreshed canonical record. `ECON_TEST_WORKERS=1 npm run agent:check -- --ci` passed lint, typecheck, every correctness test, the canonical repeat and build (test stage 785.0 s; build 2.0 s). The worker option controls concurrency only. Small contour, river-connection, terrain, routing and carrying diagnostics also passed. Remaining overlapping recording work was cancelled after all 21 distinct trajectories were collected.

## [LIFE11-Performance-053.1] - (2026-10-22)

The owner approved reducing routine CI after identifying that the full suite ran both on PRs and again after merging. Most of the cost comes from the 21 checked 30-day Life trajectories. PRs now retain every other test and only the canonical fingerprint on seed `20260813`. Full local validation and a manual Actions run retain all configurations and seeds, with no changed expected outputs or reduced invariant frequency.

The existing required `browser-check` status still gates PRs on tests, lint, typecheck, build and browser responsiveness. Post-merge Pages deployment builds and smoke-tests the actual main commit, without repeating the simulation suite; manual deployment receives the same smoke check. A shared composite action keeps browser acceptance identical across PRs, manual validation and deployment. Superseded PR runs are cancelled. This policy accepts later detection of regressions specific to another seed, configuration or merged integration. No scheduled automation was added.

Validation: `npm.cmd run agent:check -- --ci` passed lint, typecheck, all 489 PR-profile tests and build. Its test stage took 271.6 seconds (4 minutes 32 seconds), versus the full suite's 957.3 seconds. Test enumeration independently verified exactly the same 488 correctness tests in both profiles, plus one canonical fingerprint for PRs or all 21 for full validation. Workflow/action YAML and trigger/deployment wiring checks passed. GitHub execution remains to be verified after pushing. The full 21-fingerprint gate passed immediately before these CI-only changes.

## [LIFE11-Performance-053] - (2026-10-21)

### Problem and approach

The owner reported that the completed Life 11 was extremely slow. A CPU profile of its canonical first day identified repeated travel queries for unknown destinations, whole-map frontier scans, observation work and allocation. The previous full validation recorded a 3,193.6-second test stage.

This is a performance repair within the approved Life 11 specification. The simulation rules and fingerprint records stay fixed. Derived frontiers extend as ground is observed, and travel-cost buffers use generation stamps rather than clearing the map for every changed root or load. Cheap endpoint and time checks avoid return journeys that cannot affect reachability. The observer updates its ground texture and bank geometry only when the corresponding knowledge changes.

The unchanged canonical 30-day run, with its checker enabled every minute, took 872.3 seconds and reproduced the recorded daily-summary and totals fingerprints. The first cache pass reduced that workload to 577.4 seconds with the same fingerprints. Its full-run CPU profile attributed about 43% of samples to route expansion, much of it while evaluating sites. Reachability now supplies admissible outward and homeward time budgets, and preserves unfinished search frontiers when a budget is exhausted. The priority queue keeps its exact priority/cell-ID ordering in reusable numeric buffers; route searches reuse those buffers across moving roots rather than allocating queue-entry objects for every visited cell.

The owner rejected the roughly thirty-minute validation time after the first pass. Grouped route priorities passed all fingerprints but took 1,871.5 seconds in the full test stage and were removed. The retained follow-up checks homeward feasibility first and caches exact scalar estimates and budget rejections. Remembered shores use spatial rings; previous site winners establish bounds without fixing a choice. Canonical forward paths supply exact contiguous subpaths as people walk, invalidated on any knowledge change. A compact bit index skips observed ground in ascending order; distant views need only one ground observation per person and place. Idle classification reuses a reachable witness or an exhausted-budget proof under identical terrain, position, hearth, speed, climb and knowledge. A saved canonical day-13 state was used only to profile expensive later days: the two-day workload fell from roughly 35 seconds to 21.3 seconds, with identical summaries and totals. Final fingerprints still start from their original initial states.

The browser acceptance check also exposed a separate UI stall: fast playback could run hundreds of minutes in a single animation frame. Playback now stops batches between completed minutes, reserves the final adjacent state for interpolation and runs just one minute per frame after a slow tick. This is best-effort playback scheduling; headless runs retain their requested horizon. Maximum-speed playback was able to pause, step and toggle Flow, showed drinking and gathering, and had no console warnings or errors.

### Validation

Small regression checks compare warm travel calculations with explicit segment sums across changes of root, load, ascent coefficient and observed ground, including a return to an older branch. Budget checks cover exact acceptance boundaries and resuming a stopped search with the cold route and cost. Frontier checks compare incremental results with an exhaustive mask scan on diverging branches. A queue fixture checks signed priorities, ties, duplicates, buffer growth and reuse against an independently sorted list. The first performance pass's npm run agent:check passed: lint, typecheck, the complete test suite including all 21 unchanged 30-day fingerprints, and build. The test stage took 1,784.4 seconds (29 minutes 44 seconds), compared with the 3,193.6 seconds recorded for Life 11. Browser acceptance passed at maximum playback speed: Pause, Step and Flow responded, and the console was clean. The final follow-up npm run agent:check passed: lint, typecheck, all tests including the 21 unchanged fingerprints, and build. Its test stage took 957.3 seconds (15 minutes 57 seconds), about 46% less than the first pass. A failed intermediate gate exposed surveyed fixtures that change the ground mask and increment its revision directly; the unknown-cell index now validates both token and revision. All 73 tests in the affected files, including step-versus-batch equivalence, passed before the successful full rerun. The browser again passed Pause, Step and Flow at maximum speed with no console warnings or errors. These timings are validation observations; the roadmap's year-in-minutes target remains unverified.

## [LIFE11-Water-052] - (2026-10-21)

### Decisions

The owner approved implementation of [Life 11](docs/LIFE11_SPEC.md). Water now comes from the generated signed glacial terrain, with permanent spill levels and prescribed river cuts. Filling hollows assumes saturated land; it is not rainfall or groundwater simulation. Recorded drinking withdrawals come from an external reservoir and do not lower those levels.

- Wet cell squares are authoritative for placement, routes and rendering. Whole-cell observation prevents sight of one shore revealing a hidden crossing. Camps and group slots require known dry footprints; joining changes the destination while preserving the person’s position and inventory quantities.
- Fish belong to individual lakes and reaches. BigInt intermediate arithmetic preserves exact logistic growth and remainders; an optimistic first attempt at a fishless body costs a work second before teaching the person its actual stock.
- Hydration is a net water deficit with exact per-second losses, drinking before loss, hysteresis and immediate fatal crossings. Remaining seconds after death are inactive. Energy, source withdrawals and recorded causes are independently reconciled.
- Route searches share deterministic trees, use admissible heuristics and typed distance arrays and stable predecessor ties, and extend disposable searches as knowledge grows. Knowledge tokens force older or diverging states to rebuild before reuse. Early endpoint rejection and immutable cached paths avoid allocating routes for unknown destinations. Exact common-prefix travel costs avoid repeatedly sampling the same slopes when evaluating many banks. Searches reuse stamped distance buffers instead of allocating them on each moving root; a conservative local bank search avoids sorting every known shore each turn. The checker replays observation events against a separate mask.
- The observer uses real cell surfaces, banks and movement segments. Gold lines show planned dry routes; blue dots show remembered banks. Flow arrows express graph direction, with no invented velocity.

### Validation and limits

The complete Life 10 validation passed before engine edits. Small analytic fixtures exercise drainage, fish, hydration, route corners, cache independence, drinking, fatal seconds, observer interpolation and checker corruption. The required 30-day fingerprint checks also exposed an arrival on the minute's last second that inserted a zero-volume withdrawal; withdrawals are now added only after water is actually drunk, with a regression test.

The focused rule tests pass. Browser checks used the actual page with Step and Flow, plus labelled analytic fixtures for a generated lake bank, a river bank and a surveyed route around water. Each fixture advanced the real engine and passed its checker; the page and fixtures had no console errors. The long checked runs also exposed centimetre rounding beside a wet corner. Straight-route shortcuts now require a one-centimetre dry envelope, so rounding cannot turn a dry chord into a wet movement segment. Unbounded reordering of a large open frontier per candidate proved too costly. The final search directs a bounded number of moving-root queries towards their goal, then shares a zero-heuristic frontier for bulk candidates; the stable hearth root uses the latter throughout. Both modes preserve identical shortest paths and predecessor ties. Final `npm run agent:check` passed after the fingerprint refresh: lint, typecheck, the complete test suite (including all 21 required 30-day fingerprint cases), and build. The test stage took 3,193.6 seconds. Required checked 30-day trajectories take several minutes per configuration under three parallel recording workers. The same 21 regression cases are partitioned by configuration so final validation can use additional cores. Routing across extensively observed ground remains a performance limitation; this validation does not establish the roadmap’s year-in-minutes goal. No exploratory sweeps, survival tuning or year-long performance claim accompanies this feature step. The 5 m grid overstates narrow-stream barriers; permanent-water extent, river biomass, activity losses and physiological thresholds remain calibration questions. Food moisture and metabolic water remain absorbed into the net resting replacement.

## [LIFE10-GlacialRelief-051.2] - (2026-10-20)

### Problem

The 051.1 map-scale view showed coherent glacial belts, but the inhabited centre could still fall between randomly placed drumlins. The opening camera therefore showed a broad green plane even when the whole map had substantial relief. Rendering the 15 m terrain detail through a 10 m display mesh, high ambient light and a steep camera angle further softened the slopes.

### Decisions

- Keep the lowland young-moraine setting rather than add mountains. Raise landform ranges within tens-of-metres relief, move the quiet till plain south-east, and guarantee an offset, flow-aligned twelve-drumlin train across the inhabited centre before filling the rest of both drumlin fields.
- Use linear interpolation for the 60 m and 15 m zero-centred relief fields so their shoulders survive, with amplitudes of 2.5 m and 0.7 m.
- Render every 5 m terrain sample, lower the default camera, strengthen directional sunlight, reduce ambient fill, let the ground cast shadows and add only low-contrast albedo grain. Contact continues to use the exact displayed surface.

### What implementation showed

- The canonical land ranges from 0 to 36.91 m above the lake. Grass covers 81.07%, dirt 16.15% and stone 2.78%; 56.10%, 18.85% and 6.42% of cells are at least 5%, 10% and 20% steep. Mean absolute height differences are 0.84 m at 15 m, 2.53 m at 60 m and 4.10 m at 240 m.
- In the visible browser the starting forager now stands on a drumlin shoulder around 15-20 m above the lake, exposed dirt follows that slope and the aligned field is legible on the whole-land map. The stronger contact-consistent mesh remained responsive and the console had no warnings or errors.

### Left for later

- The real-data DHM/Terræn comparison remains the next quantitative calibration. Water and erosion remain Step 11; mountains remain inappropriate for this mapped lowland reference setting.

## [LIFE10-GlacialTerrain-051.1] - (2026-10-20)

### Problem and research

The 051 terrain was more varied but still read as procedural geometry: smooth capsule ridges, isolated circular hills and surface patches unrelated to the relief. Published descriptions and maps of Danish young-moraine landscapes instead show landforms as an assemblage produced by one ice history: transverse moraine fronts, flow-parallel streamlined hills, clustered dead-ice topography, kames and broad meltwater valleys, with quieter till plain between them. Terrain-generation literature likewise treats recognizable structure at several scales as more important than adding undirected noise.

### Decisions

- One regional field now supplies sixteen written ice-flow directions. Drumlin fields and dead-ice clusters constrain where their landforms occur, while a protected till-plain zone prevents uniform visual busyness.
- Moraine fronts are broken, curved polylines with unequal flanks; drumlins are elongated and aligned; kames and kettles use overlapping offset ellipses; hummocks and kettles cluster; tunnel valleys cross the map. Eleven independent named streams preserve deterministic separation between families.
- Two finer relief fields add 60 m and 15 m variation. Dirt and stone are consequences of slope and local curvature rather than a separate random paint layer.
- Observer-only fine grain changes vertex normals, never vertex positions. Nearby ground colours are blended at display vertices to avoid aliasing, while the engine retains exact grass, dirt and stone cells.

### What implementation showed

- The canonical map ranges from 0 to 30.60 m above the lake. Grass covers 90.20%, dirt 8.66% and stone 1.14%; 32.41%, 9.75% and 2.96% of cells are at least 5%, 10% and 20% steep. Mean absolute height differences are 0.54 m at 15 m, 1.61 m at 60 m and 2.99 m at 240 m.
- The visible browser check at close and whole-land scales shows continuous small relief and distinct belts instead of the earlier giant pads. The console remained free of errors. The flat-land fingerprints did not change; all terrain-bearing trajectories were deliberately recorded again.

### Left for later

- These dimensions are evidence-informed defaults, not a fit to one surveyed square. A later stable-engine comparison should sample official Danish DHM/Terræn tiles and compare elevation distributions, roughness at several baselines, slope, curvature, orientation and depression geometry across several real windows.
- Water, drainage and erosion remain Step 11. Mountains remain excluded from this lowland young-moraine setting.

## [LIFE10-TerrainVariety-051] - (2026-10-19)

### Problem

The first Life 10 terrain was smooth at only two noise scales. Its large pale sand regions also read as a second, desert-like biome. In the 3D observer, the visible ground was a decimated mesh while people and props took their height from the finer simulation lattice, so the two surfaces could disagree: a person could appear sunk into or floating above the ground.

### Decisions

- **Landforms, not more noise.** Keep the broad relief, hummocks and kettles, and add 12 long moraine ridges and 40 separate round hills. Each family has its own derived random stream, so changing ridge counts does not redraw hills or kettles. At a point the strongest ridge and strongest hill contribute, rather than every overlap adding, which keeps the declared maximum relief meaningful.
- **One grassland, three surfaces.** Grass is the default. A smooth cover field exposes coherent dirt patches, moderate slopes expose dirt, and slopes of at least 20% expose stone. Outcrops remain stone. Sand and wet ground are removed until water and vegetation can give them ecological meaning; mountains are omitted because they do not fit a 4 km young-moraine landscape.
- **One visible surface.** The observer samples the immutable simulation height field once. Those exact samples build the mesh, and bilinear interpolation between them places every visual object. Footprint-sized objects use the highest contact under them, long fallen trunks follow their endpoint slope and clear intervening rises, and ground rings, group discs and guide lines are deformed to the surface.

### What implementation showed

- Separate streams made the terrain tests more useful: changing the ridge count leaves hills and kettles exactly unchanged, while the old determinism and flat-land checks still apply.
- Sampling the visible mesh is the important contact fix. Sampling the finer simulation field more accurately was visually wrong whenever that detail was absent from the displayed mesh.
- The new land changes routes, sight and therefore every canonical Life 10 trajectory. The 21 thirty-day fingerprints were deliberately recorded again after the rule and checker tests passed.

### Left for later

- The ridge and hill counts and dimensions, dirt coverage and stone threshold remain estimates. A measured 4 km square of young moraine relief is still needed.
- Water in hollows, wet ground, soil fertility and living vegetation remain steps 11 to 13. Path finding still goes over relief in a straight line.

## [LIFE10-TerrainAndScale-050] - (2026-10-19)

### Problem

The roadmap's first step was scale, a pure speed-up, then terrain. The owner swapped them, then merged them: the land grows to a few kilometres and gains its relief in one step, with performance worked on only as far as the larger land needs.

### Decisions

The owner approved the spec. Within it:

- **4 km square, as dense as Life 9.7 by the hectare.** Each plant's yield was set from real yields by the hectare, so the density stands. The land grows enough for about 180 people against a band of 8: it is rich only because it has no winter yet.
- **Every plant individual.** About 85,000 plants are few enough to keep one by one; counting them in stands waits for vegetation.
- **Glacial relief at three scales,** generated in integers: value noise for the broad rise and fall and for hummocks, and round kettles an eighth of their radius deep.
- **Ground derived from the terrain,** not drawn on its own: wet in kettles and by the lake, rock at outcrops and on steep slopes, sand on low ground, soil elsewhere.
- **Tobler for speed, Pandolf with Santee for energy, Naismith for judging.** A forager can see the rise of the land but cannot time each step, so it judges a walk as walkers do.
- **Straight walks.** Path finding round hills is left for later; the slopes are mostly gentle.

### What the implementation showed

- **Seeing round from every place was the cost.** The first sight rule checked a line to every place within a kilometre, about 4,800 lines a place. Once foragers explored, new places came every minute and a run slowed to seconds a day. Casting rays outwards from the viewer and keeping the steepest slope seen along each, sampled every 30 m, gives the same kind of answer for a fraction of the work. The spec's step of 15 m became 30 m, and its rule for visibility became the rays.
- **Long sight from the place, every hour.** Looking round from the exact position every minute could not be kept. Long sight is reckoned from the centre of the forager's place, when it stands in a new place or after an hour, so each place's view can be worked out once and kept. Close sight now records trees and stones too, so a forager watching a tree cut sees it.
- **Searches stop when nothing further can win.** Choosing food scanned all 80,000 food plants whenever a bush ran out. Searching chunk by chunk outwards, and stopping when even a full source at the next ring's distance would lose, finds the same source. A test runs the same land with two chunk sizes and gets identical days.
- **Plants that did not fit.** A thicket next to a kettle could not fit its bushes on dry ground, so a site is now drawn only where its whole circle suits its kind. A stone near an outcrop's edge could lie in a cell outside its rock circle; that cell is rock too.
- **Regrowth stays hourly.** Settling regrowth only when a plant is read was planned but not needed: hourly regrowth of every plant costs a few seconds a year.
- **Speed.** A canonical year runs unchecked in about 2 minutes, a checked 30 days in seconds.
- **A year on the land.** On the canonical seed everyone lives on hazelnuts alone, nobody dies, and by the end of the year every forager has seen all 17,956 places. They climb about 210 m a day and spend about 1,400 kcal a day walking, most of it exploring, since a land this large always has somewhere unseen. Four groups stand with every hut whole; eight axes are made and none sold.

These are observations from single runs, not experiments.

### Open questions

- Whether foragers should keep exploring once they know enough, and what a real band's range was.
- Path finding round hills, and how much straight walks lose.
- A measured relief for a 4 km square of young moraine country; the relief, hummock, sand and rock numbers are estimates.
- The view's speed in a visible browser pane at the fastest settings has not been measured; the hidden pane draws only on screenshots.

## [LIFE-Roadmap-049] - (2026-10-19)

### Problem

The ladder's next steps after Life 9 were storage and claims, generations, and a medium of exchange, each asking an economic question. The owner wants the Life core's goal to be a realistic life first, with economics left to grow out of realism later. Comparing Life 9.7 with Life Engine in Unity also showed what the valley still lacks: danger and fleeing, sleep driven by tiredness, heat and shade by day, fuller senses, materials broken down by recipes, and a world larger than one valley.

### Decisions

The owner made each of these choices; the code is unchanged.

- **Replace the roadmap, keep the valley.** Life 9.7 stays as the starting point.
- **Realistic life is the goal.** Economic institutions are watched for, not built towards.
- **The world first, in layers.** Speed and scale first, because a landscape and individual animals depend on them; then terrain, water, seasons and weather, vegetation, plant-eaters, predators, and people living in that world. Each layer lives with or without people. Two other shapes were set aside: growing the world outward from what the band meets next, which shapes the world around people, and rebuilding the engine before any world feature, which shows nothing new for a while.
- **A landscape a few to tens of kilometres across,** **every animal an individual agent,** **runs of several years,** and **Mesolithic northern Europe** as the setting, with every number sourced.
- **Then the body, making things, and people together,** in that order: the world gives the body its cold, water, food and danger; the body gives making things a purpose; and families need fed, sheltered adults.
- **Thirst comes with water** at step 12, and the spear and bow with hunting at step 17, ahead of their areas.
- **Steps are checked against real measurements** in place of answering an economic question.

### Open questions

- How plants are represented over tens of kilometres: individual where people or animals use them, counted in stands elsewhere, is the recommendation for step 10.
- Whether runs grow long enough for generations after step 26.
- Which of Life Engine's low-poly models, now including animals, are converted for the observer.

## [LIFE9-HazelAndLake-048] - (2026-10-19)

### Problem

In Life 9.6 every forager starved within a few days of each other, about four weeks in. Two things caused it. The valley held only berries, about 1.7 million kcal a year against the band's 7 million or more, and no real Mesolithic band lived on berries. And everyone ran down together: born alike and eating from the same bushes, all eight reached zero at once, and the last bushes held less than the minute of picking the rules required before anyone could start. The owner asked to make the valley more realistic rather than change the numbers for people, and to fix the deaths all at once.

### Decisions

The owner chose hazel thickets and a fishing lake with realistic numbers, and approved the spec. Within it:

- **Hazelnuts as the staple.** Mesolithic sites such as Staosnaig and Duvensee hold roasted hazelnut shells by the tens of thousands. Wild hazel yields about 400 kg a hectare; 40 hazels on a thicket 20 m across give 477 kg a hectare, the top of the wild range. Gathering and cracking were set at about 1.4 kg an hour, from orchard hand-collection rates of 4.5 to 8 kg an hour less the time to crack them: an estimate.
- **The lake as a reserve, not a staple.** Northern lakes yield 0.2 to 43 kg of fish a hectare a year, so a 30 hectare lake gives at most 180,000 kcal a year. Its fish grow by the logistic rule, the standard model of a fish stock, so the band can fish it down. It lies beyond the north edge so that no straight walk crosses water.
- **A larger valley,** 800 m across, because 32 hazel thickets do not fit among the other sites in 600 m. The valley feeds about seven, a little less than the band.
- **Food comes more slowly as a source thins,** in proportion to what is left, and a source is worked while an hour there brings more than it costs. This replaces the minute's-worth floor, so thin sources can still be worked.
- **Born foraging skill from 75% to 125%.** Individual return rates differ widely among real foragers, and the difference decides who eats when food is short.

### What the implementation showed

- The first version weighed only the nearest bush and the nearest hazel worth working against the lake. Because a forager knows the lake from sight and expects it full, it fished rather than search hazel thickets it could see, and fished the lake to a third in 110 days. A thicket it has spotted and never checked is now expected full too, as the lake is.
- It still fished beside full hazels, because the nearest hazel worth working was usually a picked-over one. The choice now weighs every bush and hazel it remembers. This is cheap because it is made only when a forager needs a new source.
- With both corrections, on the canonical seed over a year: everyone lives on hazelnuts alone for about six months, as their rate of 3,500 kcal an hour predicts. Berries come in at about day 180, as the hazels fall below a fifth of full, and fish at about day 200. The lake is fished down to about a third by day 365. Nobody dies in the first year. By its end the members' reserves range from about 17,000 to 65,000 kcal, so hunger has started to sort the band rather than strike it all at once.
- The checker found nothing wrong in 365 checked days.

These are observations from single runs, not experiments.

### Open questions

- Who survives a long shortage, and whether the band settles at the seven the valley feeds.
- Whether the band fishes the lake out, and whether it recovers.
- Seasons: nuts ripen in autumn, hazel has mast years, fish run; food that keeps then needs storing, which is step 10.
- Hazel is the best source of sticks in a real Mesolithic wood; whether hazels should give wood.
- The rate of gathering and cracking hazelnuts, and the fish stock of a Mesolithic lake, are estimates that need better sources.

## [LIFE9-Calibrated-047] - (2026-10-19)

### Problem

The owner saw no pressure in the valley to develop anything: one-person huts were enough, berries and wood regrew almost without limit, and anyone could do everything alone, so there was no reason to store, claim land, farm or trade. They asked for every physical number to be made as realistic as possible, with sources.

### What the calibration found

The [calibration document](docs/CALIBRATION.md) compares each parameter with real measurements. Most numbers for people were close: body, sleep, rest, walking speed, picking rate, and the time to cut a log with a stone axe. The land was far too generous. Bushes produced about 19,000 kg of berries a hectare a year, more than a commercial blueberry farm and hundreds of times a wild bilberry forest. Trees regrew 2,200 kg of branches a year and grew back in 60 days. Four things about people were off: the energy reserve was a week's food against a real month or two, a load slowed a walker by a third and cost nothing, cold nights cost too much, and firewood was gathered too fast.

### Decisions

The owner chose:

- the valley is in Mesolithic northern Europe;
- every realistic number applies at once, to the current valley, letting the band shrink to what it can feed;
- berries are spread evenly over the year until seasons arrive;
- firewood is dead branches falling from trees at a realistic rate, alongside sticks from bushes;
- axes are ground stone.

Implementation choices:

- Yearly amounts are shared hour by hour over a year of 8,760 hours, so a whole year gives exactly the amount. A bush's sticks are counted by the decade, because a bush grows less than a kilogram of wood a year.
- The Pandolf rate is computed exactly in integer arithmetic and rounded down once, so it is the same on every machine.
- The hunger thresholds keep their distances below a full reserve; only the store of fat behind them grows.

### What the implementation showed

- On the canonical seed, all eight foragers starve between about day 27 and day 30, and nobody finishes an axe or a hut. The specification expected the band to shrink to the one or two the valley feeds. Instead every forager draws on the same thinning bushes at the same rate, so all their reserves run out together. When the first die, the bushes left hold less than a minute's picking each, so the survivors cannot pick them and starve too. Once everyone is dead, the bushes fill again.
- The first deaths exposed a gap in the checker. A forager could found a group with someone who starved in the same minute, and the checker wrongly reported its hearth as moved without a group. Nobody had starved in Life 9.5, so it had never happened. The engine was right; the checker was fixed.

These are observations from single runs, not experiments.

### Open questions

- Whether a picker should be able to take the last berries from a bush holding less than a minute's work, and whether picking should slow as a bush empties.
- Whether foragers should differ in body or reserve, so that hunger sorts the band instead of killing it all at once.
- Seasons and storable food, which the calibration points to next.

## [LIFE9-LogHuts-046] - (2026-10-18)

### Problem

The owner found the huts unrealistic: gaps between the logs, and logs floating in the air. Each of the 10 logs was drawn 20 cm thick and 2.7 m long, about 70 kg of wood for a 20 kg log, in rows spaced further apart than the logs were thick.

### Decisions

- **Draw a log as what 20 kg of wood is:** a dry pole 14 cm thick and 2.4 m long.
- **One plan, built as a person would build it.** A small A-frame for one sleeper: two A's first, each a log cut in two, legs dug in and tied at the top; then wall logs along the outside of both A's, from the ground up on alternate sides, each resting on the one below; a ridge log in the groove at the top; and two logs cut into posts against the back A. The front stays open, towards the fire. At every stage each piece rests on the ground or on pieces already laid. The owner approved it from a three.js preview before it went into the game.
- **The hut's size sets the logs it needs: 23**, against 10. At 3 logs a tree that is about 8 felled trees a hut, against 144 trees in the valley.
- The plan is fixed, so a configuration with another `hutLogs` shows the plan's share of a whole hut.

### What the implementation showed

- On the canonical seed, the first member's hut was whole by day 7, drawn in the browser as planned, its sleeper inside.

This is an observation from a single run, not an experiment.

## [LIFE9-CampAndFirewood-045] - (2026-10-18)

### Problem

Watching Life 9 run, the owner found five things wrong. Deadwood lay beside a stump after its tree was cut. Members kept a hearth of their own after their group lit its shared fire. Huts stood too close together. A member asleep in its hut was not wholly inside it. And huts belonged round the fire, which should warm more than a hut. The owner also did not want deadwood at all: firewood should come from bushes and the branches of trees. They asked for these changes as Life 9.5, a revision of Life 9, without changing the ladder.

### Decisions

- **Sticks from bushes, branches from trees, more branches from felling.** All three firewood sources the owner chose. Trees then bushes form one list of wood plants, so gathering, memory and the checker treat them alike.
- **A tree comes down whole.** The first log cut fells it and the rest are cut where it lies; a stump grows back after 60 days. A standing tree always holds every log, so a forager tells standing from felled by what it sees from afar, without new memory.
- **Huts on rings round the fire,** 7 m out, 8 to a ring, placed by moving the square spiral's points onto circles with integer square roots, so every slot is exact on every machine.
- **Four warmths:** fire and hut 60 kcal an hour, fire 80, hut 120, neither 150. The hut now saves food every night, not only on the 3% of night hours the fire is out.
- **Members' own hearths were a drawing left over from before Life 8.** In the engine a member has burned no wood of its own since Life 8; only the observer still drew a fire ring at each member's sleeping spot. It now draws one only for a forager without a group.

### What the implementation showed

- In the first run of the new rules, felled crowns lay untouched beside their stumps, because foragers took sticks from nearer bushes. That looked like the deadwood the owner had objected to, so a forager gathering wood now clears a felled crown it knows first, as a member finishes a felled trunk before felling another. Over 20 days on the canonical seed, gathering from trees rose from about a fifth of the wood gathered to about three quarters, and most stumps are left bare.
- Felling brings 10 kg of branches down, not the 20 first tried: with 20, crowns outlasted what the band burns.
- Over 20 days on the canonical seed every forager lives, all 8 huts are whole, and 32 trees are felled for 95 logs. Night hours are spent mostly in a hut by the fire, some by the fire alone, and a few in a hut alone or cold.

These are observations from single runs, not experiments.

### Open questions

- Fallen crowns still outlast the band's need for wood when many trees are felled at once; whether that matters can wait for experiments.
- How much food a hut saves over a year, against the work of keeping it, is now a real question, added to the specification's questions for later.

## [LIFE9-HutsAndAxes-044] - (2026-10-18)

### Problem

The ladder's step 9 adds tools and shelter and asks whether tools concentrate in the hands of those who make them, and whether making them becomes a trade. The owner set the rules: shelter is an inherent drive, basic wooden huts to start; tools are only instrumental, wanted because building needs logs and logs need an axe; axe making is a skill that grows with practice, so the skilled make axes faster and better, and better axes cut faster and last longer; axes wear out; and members may trade them. The owner also asked for stone as a resource on the map, and for more trees.

### Decisions

- **An axe is needed to cut a log.** That keeps the choice that matters, making against buying, at the centre.
- **Huts weather** a log every 10 days, or every hut is finished in the first week and nobody needs an axe again.
- **A whole hut keeps its sleeper warm** with the fire out: a real, small effect that leaves the shared fire meaningful.
- **An axe is priced at the extra energy of making it,** `forageCostKcalPerHour − restKcalPerHour` for its hours, about 1,700 kcal for a first-time maker. Priced at hours of picking forgone, it cost about 10,000 kcal, more fresh food than any buyer could carry.
- **A maker can promise an axe** to a member that asks. Without it, an asker started its own axe in the same minute a maker offered one, and almost no axe was sold.
- **Quality** is drawn uniformly from half the maker's craft to its craft, from a stream of its own.
- **Stones and logs are seen from afar** by long sight, like sites; berries and deadwood still only up close.

### What the prototype found

Before implementing, a throwaway prototype on 32 seeds over 400 days, confirmed by the implementation:

- With trade, axes are sold in 31 of 32 scattered runs and every run of a band that starts together; 22% and 45% of axes are bought.
- **Among equals, practice makes a toolmaker.** In a band that starts as one group, the leading maker makes 2.9 times an even share of the axes and sells 58% of those sold, against 1.2 times without trade. With practice fixed, no axe is ever sold: two equally able makers gain nothing by trading.
- **Talent spreads the trade.** With born craft from 50% to 150%, the gifted half sells about three quarters of the axes sold and the least gifted buys the most, but the leading maker's share falls to 1.5 to 1.9 times an even share, because several gifted members are cheap enough to sell.
- Huts are first finished on day 2 or 3 and are whole 96% of the time; bands of 8 and 12 stay intact over 400 days.

These are prototype-level observations, not experiments with tests.

### Process

Partway through, the owner asked to stop the experimenting: in this phase the aim is to get features out, and experiments belong to a later, stable version of the Life engine. The experiment tests written for this step were removed, and the workflow in `AGENTS.md` now skips prototypes, sweeps and experiment tests unless asked.

### Open questions

- The questions for later in the specification: concentration through practice, talent, and the effect of each switch, measured properly.
- Huts crowd each other at 3 m hearth spacing; a larger spacing may suit a future step with bigger shelters.

## [CI-DeployAfterValidation-043] - (2026-10-17)

### Problem

Update 040 asked whether the Pages deploy should keep re-running the whole suite on every push to `main`. After update 042 the validation workflow ran every test, split three ways, in about 1.5 minutes on each push to `main`, while the deploy ran them again on one 4-core machine, about 4 minutes, so the site went live about 5.5 minutes after a merge.

### Options considered

- **Deploy after lint, typecheck and build, trusting the pull request's checks.** Fastest, but the commit on `main` after a squash merge, or a direct push, would reach the site untested.
- **Deploy when the validation workflow passes on the same commit.** The tests still guard the site and run once.
- **Keep the tests in the deploy, split three ways.** About as fast, but the tests still run twice per push and two workflows must be kept in step.

The owner chose the second.

### Decisions

- Trigger the deploy with `workflow_run` on the validation workflow's completion, only for runs on a push to `main` that passed, and check out that run's commit rather than whatever `main` points to by then.
- Build again in the deploy rather than pass the validation workflow's build across: a rebuild takes well under a minute, and passing files between workflows needs extra permissions and steps.
- Skip a commit that is no longer `main`'s newest. With a push trigger, runs queued in push order; with `workflow_run`, a slow or re-run validation of an older commit could otherwise finish after a newer one and publish the older site.

### Open questions

- The new trigger takes effect only from the workflow file on `main`, so it is first exercised by this change's own merge.

## [CI-ShardedTests-042] - (2026-10-17)

### Problem

After update 041 CI took 4 minutes 17 seconds, all of it the tests job, while the owner wanted it shorter still. The owner chose to keep the per-minute checker on in every experiment and to split the tests across parallel CI jobs instead.

### What was measured

- On one 4-core runner the tests were bound by total computing time, and the four heaviest files ran on one core each for two to three and a half minutes. Splitting the job alone would not have helped: a file that takes three minutes takes three minutes on any machine.
- Vitest's `--shard` deals files by a hash of their paths, which could put the heaviest files on the same machine.

### Decisions

- Split the experiment files so none runs more than two sets of eight runs, at the cost of a few runs repeated across files (own fires in both halves of experiment 2).
- Deal files to three shards by measured cost, longest first, to the least loaded shard, and run the longest first within each shard.
- Three shards rather than more: with the longest file about 100 seconds on a CI core, more shards would not finish sooner.

### Open questions

- The cost table needs a line when a long test file is added; a file left out counts as short, which only makes the deal less even, never skips it.

## [CI-ParallelChecks-041] - (2026-10-17)

### Problem

After update 040, CI ran its tests in 5.6 minutes, then a browser check failed: one pause took 1,572 ms against a 1,500 ms limit, where earlier runs had measured between 695 and 1,223. The owner asked for the check to pause several times and judge the middle or the average, and for CI to be shorter still.

### Findings

- **Pausing several times found a real fault.** On the second or third pause in a run, the day shown moved forward once after the Paused label appeared, in every run tried. While running, the MVP9 page publishes a new day every 100 ms; pausing rendered the label first and published the days already computed one render later. A single pause, as the old check made, caught it only by chance. Pausing now stops the runner in the same handler, so the label and the final day render together.
- **CI's test step is bound by total computing time,** not by one file: GitHub's runner has 4 cores, each two to three times slower than the development machine, and Life 8's experiments are about 60% of the work.
- **One job did everything in sequence:** lint, the tests, the build, installing Chromium and the browser check, about a minute after the tests. It never ran the typecheck.
- Reusing a standing forager's view and a reused turn array cut a band of 12's checked run by about 9%.

### Decisions

- Run the tests and the browser check in parallel jobs, with the required `browser-check` passing only when both do. A skipped job counts as passing for a required check, so the gate always runs and checks both results.
- Judge the median of five pauses, which keeps the 1,500 ms bound meaningful on a shared runner.

### Open questions

- The remaining levers trade coverage or need the owner's choice: running the experiments without the per-minute checker, which the fingerprint and unit tests would still cover; fewer seeds; or splitting the tests across parallel jobs.

## [TESTS-FasterSuite-040] - (2026-10-16)

### Problem

Even with only Life 8 left, the owner found CI far too slow. The tests used about 970 seconds of computer time, and one file, the band of 12 over 400 days, took 238 seconds by itself, so the suite could not finish sooner however many cores ran it.

### What was measured

- **Repeated runs.** Each test file runs in its own process, so simulations shared between files ran again in each. The canonical valley's 100-day runs ran in four files and the band that starts as one group in two.
- **The longest path.** The suite's wall time was the band of 12 file, not the total.
- **Idle cores.** Vitest runs one worker fewer than the machine has cores, which leaves a quarter of a 4-core CI runner unused.
- **The engine and checker.** Profiling a 100-day run with the checker on found every forager measuring its distance to all 40 sites every minute through lookups and recomputed radii, the spiral of hearth slots rebuilt for every member every minute, and the checker building the same lookup of turns three times a minute. Fixing these cut a run by about 8%; what remains is spread thinly, mostly the memory each forager keeps of what it sees, which the model needs.
- **MVP9.** Two tests ran 10,000 days each, 39 seconds apiece, to check conservation and bounded history, whose bounds are reached by day 400.

### Decisions

- Group experiments that share runs into one file, and split the longest experiment's seeds across two.
- Run a worker on every core.
- Shorten the two MVP9 tests to 2,000 days, five times the history bound, leaving the MVP9 code unchanged.
- Keep the checker on every minute in every experiment, as the design rules and the specification require; it is half of each run's cost, but it has found real gaps before.
- Every change was checked against the fingerprint test: all 24 Life 8 runs are unchanged.

### Findings

- The tests take 87 seconds locally, against 222, and about 410 seconds of computer time, against 970.

### Open questions

- How long does CI take now on GitHub's runner?
- The Pages deploy re-runs the whole suite on every push to `main`, after the pull request has already run it. Should it only build and deploy?

## [LIFE8-OnlyLife8-039] - (2026-10-16)

### Problem

CI took about 27 minutes a run, 26 of them in tests. Profiling showed why: nearly all the time went to experiments, each a set of real simulations of up to 400 days checked every minute. A quarter was the hourly core of Life 0 to Life 4, frozen as a reference, and most of the rest the valley's Life 5, Life 6 and Life 7 experiments, re-run on every pull request though nothing in them could change. The owner decided the project should hold only the current Life step: the simulation is not interested in old experiments and what they showed, only in the current ones. The MVP9 economy stays.

### Decisions

- **Remove Life 0 to Life 7 entirely,** code, experiments, tests, presets and specifications, keeping them in git history, the changelog and the lab notes.
- **Remove every switch that existed only to recreate an earlier step,** at the owner's choice of removing all of it rather than only the tests. Each removed switch was on in Life 8, so its behaviour becomes how the valley works and its off-branch is deleted.
- **Keep the switches Life 8's own experiments use,** including `sharedFire`: with it off, every forager keeps its own fire, the comparison every Life 8 experiment makes. That configuration is exactly what Life 7 was, so every comparison in the Life 8 specification still holds, now named "own fires".
- **Prove nothing changed.** Before touching the engine, fingerprints of 24 runs (the canonical valley and seven other configurations, on three seeds over 30 days) were recorded from Life 8's code. After the change they match, with the checker on. They are kept as a test, so the next clean-up or speed-up is held to the same standard.
- **One specification.** With Life 7's specification gone, Life 8's would have described only changes to something no longer in the repository, so it was rewritten to describe the whole simulation. From now on a new step's specification replaces the current one.

### Findings

- The suite takes 222 seconds locally, against 565, on a 32-thread machine. Most of what remains is Life 8's five experiments, above all the band of 12 over 400 days, and the MVP9 tests.
- Profiling a 100-day run found the checker doubles its cost, 2.1 seconds against 1.1, and the engine spends much of its time on things that could be cheaper without changing any result: every forager measures its distance to all 40 sites every minute even after it knows them all, the checker builds the same lookups three times a minute, and small lists are rebuilt thousands of times a second. These were not changed here.

### Open questions

- Should the engine and checker be made faster? The fingerprint test now makes that safe.
- How long does CI take now on GitHub's 4-core runner, and is splitting the tests across parallel jobs still worth it?

## [LIFE8-SharedFire-038] - (2026-10-16)

### Problem

Since Life 3 every forager has burned its own wood at its own hearth, so wood has been a private good: a forager was warm if and only if it held the wood. Life 6 gave groups a flag and laid every member's hearth on a spiral a few metres round it, leaving the flag's own point free for a shared fire. The ladder's step 8 asks who feeds a fire that warms everyone at it. The owner also asked to see how much each member contributes, in wood or even food, and found selecting a group nearly useless: the members it ringed could not be found on the map.

### Decisions

- **The owner's rules, taken as given.** One fire at each group's flag replaces its members' own fires. A member adds wood if it has spare wood or the fire is low. A fire that dies has to be relit, at no cost. Members still never change group.
- **A fire is a fire.** It burns a kilogram an hour, the same as one hearth fire, however many sleep around it. This is the step's economy of scale, so the experiments vary it: 2 kg an hour, and a kilogram for each member, which saves nothing. The owner chose the fixed fire.
- **Burning before anyone acts.** Each night hour starts with every fire burning its hour or going out, so every member asleep in that hour knows whether it is warm. Relighting at no cost means a fire is lit at the first night hour it holds an hour's wood.
- **Spare and low.** Spare wood is wood above the two nights' target a forager already kept; a fire is low when it holds less than the rest of the night needs, and by day less than a night. A member feeds after swapping, at its hearth, awake or asleep.
- **Members keep Life 7's wood need.** A member still gathers below a night's wood until it holds two nights' worth. That stock is now its reserve for the fire, and it only ever falls when the member feeds a low fire or sells.
- **A forager without a group keeps its own fire,** or it would sleep cold until it met someone. A group's survivor takes back what its fire held.
- **Food.** Nothing in the valley gives food away, so the contributions table shows food paid and received for wood in swaps rather than inventing a gift.
- **Pins over members.** Rings at members' feet are too small to see from afar. Pins are buttons over the canvas, placed by projecting each member, so they keep their size at every zoom and can be clicked. The page measures the part of the view its cards leave clear; the camera frames the group in it, and pins for members out of sight wait at its edge, pointing their way.

### What the prototype found

A throwaway prototype, a copy of the valley core with the new rules, on 32 seeds over 400 days:

- **Everyone feeds the fire, in proportion to what they gather.** A member's wood goes nowhere but into the fire or a swap, so what it gives is what it gathers.
- **One fire per group needs a third of the wood,** 4.0 kg a forager-day against 11.7 in Life 7.
- **Exchange disappears, and not because wood is plentiful.** With a fire that burns a kilogram for each member, as much wood as Life 7, members still bought only 0.1% of their wood. With members giving only to a low fire, they kept their spare wood and bought 16.1% (pooled over all wood burned, as the experiments measure it, 15.4%).
- **Fires are lit 97% of night hours,** dark only in the first nights before anyone has gathered.

### Findings

From `experiments.ts` on 32 seeds over 400 days, measured over days 21 to 400, checking every invariant every minute. The implementation reproduced the prototype's numbers.

- **Who feeds the fire.** In every standing group of two or more, on every seed, every member gives; none gives less than a quarter of an even share. A group's leading giver gives 1.10 times an even share in scattered groups and 1.38 in a band that starts as one group. Giving correlates with gathering at 1.00 across members; 39% of the wood given is spare, the rest taken from stocks for a low fire.
- **How big a fire.** Members burn 4.0 kg of wood a forager-day and gather for 0.28 hours, against 11.7 kg and 0.66 hours in Life 7; with a fire of 2 kg an hour, 8.2 kg and 0.51 hours; with a kilogram an hour for each member, 11.8 kg and 0.68 hours. Members work 2.39 hours a day, against 2.85 in Life 7.
- **Spare wood and exchange.** 3 runs of 32 swap, and members buy under 0.1% of the wood they burn, against every run and 9.4% in Life 7; with a fire a member, 28 runs and 0.1%. With members giving only to a low fire, every run swaps and members buy 15.4%, and sleep cold 4.7% of night hours against 2.7%.
- **Groups.** A band that starts as one group burns 1.5 kg a forager-day and gathers for 0.12 hours, against 11.0 kg and 0.63 in Life 7, and sleeps cold 1.7% of night hours against 8.4%. Fires are lit 97% of night hours in scattered groups and 98% in one group.
- **Life 7 is reproduced exactly** with the shared fire off, against fingerprints recorded from Life 7's code before the change.
- **Capacity.** Bands of 8 and 12 are intact at day 400. A band of 16 keeps 6.0 survivors, all its deaths before day 100, against 5.8 in Life 7.

The answer to the step's question is that everyone feeds the fire, and roughly equally, because the rules leave no one able not to. A member's stock goes nowhere but into the fire or a swap, whoever is at home when the fire runs low pays from their stock, runs short, gathers a load, and comes home with spare wood that goes straight into the fire. The cost rotates with who happens to be home. The shared fire does what sharing a fire is for, a third of the wood for the same warmth, but feeding it spare wood ends the trade in wood that every step since Life 3 has found: no one holds wood to sell.

### Trade-offs

- **A path that resolved to nowhere.** The 32-seed report scripts wrote to a Git Bash path, which Node on Windows does not resolve, and nine of ten configurations ran for nothing before the mistake showed. The reports were rerun with a Windows path.
- **What the hidden preview pane can show.** It draws a frame only when a screenshot is taken, and runs no animation frames otherwise, so framing a group was first scheduled for the next frame and never happened in the checks. Framing now runs in a layout effect once the group card is on the page, which also measures the clear view correctly.
- **The clear part of a 1,024-pixel window is narrow.** Between the HUD and the group card about 240 pixels are left, and a group spread across the valley does not fit even at the camera's farthest distance. Members out of sight are then shown by pins at the edge, which point their way.
- **Test time.** Life 8's experiments add five test files beside Life 7's, which keep running with Life 7's settings.

### Open questions

- Nobody can choose not to feed the fire. Would members who decide whether to feed, remembering who fed it, free-ride, and would anyone refuse warmth to those who did not give?
- Trade ends because spare wood goes into the fire. Does exchange return once there is something else to want, such as tools (Life 9)?
- One fire saves wood but not enough food to feed a band of 16. What would a larger valley, or longer trips for wood, make of the saving?
- Would a fire's warmth draw people from other groups, if members could change group?

## [LIFE7-SightAndLoads-037] - (2026-10-13)

### Problem

Watching Life 6, the owner found the foragers' exploring robotic. They walked the valley one 30 m square at a time in a fixed order, swept the whole valley again every day though the land never changes, and saw only 25 m, far less than a person sees across open ground. They also walked off to explore with 30 kg of firewood on their backs at full speed and no extra cost. The owner asked for long sight, memory of what the land holds, less mechanical exploring, and loads that slow a walker and cost more per step, all in one step. They also asked for a way to see where each group's base is, to select a whole group, and a fix for the group band on each forager, which looked wrong. The step's question became whether foragers who see as far as people do, and check what they know instead of sweeping it, walk less, and whether seeing everyone from the first morning gathers the band into one group or splits it into more.

### Decisions

- **Two kinds of sight.** Long sight for where things are, close sight, Life 5's 25 m, for what a plant holds. A person picks out a thicket or another person hundreds of metres away, but needs to be close to judge ripe berries or deadwood.
- **Plain long sight, 1 km by day.** The owner chose no blocking by stands. In a flat, open valley 600 m across nothing is out of sight by day, so 1 km, more than the diagonal, is the honest value. At night sight shrinks to close sight.
- **Remember sites, not squares.** Thickets and stands are what a forager looks for. Places stay only to say what ground has been seen, and seen ground stays seen. Checking a site means standing within 13 m of a thicket's centre or 10 m of a stand's, where every plant in it lies in close sight. The owner plans a more realistic memory later; this one forgets nothing and expects nothing.
- **Explore unseen ground, then check stale sites; search unchecked sites first.** Idle foragers go from thicket to thicket, the irregular path the land sets, rather than square to square.
- **No randomness in the choice.** A seeded preference for nearer sites was tried in the prototype to stop group members walking in step. It was not needed and cost walking (see below), so the rule stays nearest first (design rule 20).
- **Carrying slows the walk, and costs per metre.** `v = walkCmPerSecond · 60 / (60 + load)`, with a body of 60 kg. Each second of walking costs what it did, so a metre costs `(60 + load) / 60` times as much. At that speed Pandolf's load-carriage equation gives a cost per second within 9% of unloaded walking for loads up to 30 kg, so one parameter sets both speed and cost. A small study of women with 10 kg head loads measured about 1.1 m/s, against 1.07 here.
- **A full load goes home first.** A rule rather than a calculation, as the core's decisions are priority rules: not hungry, a forager carrying a full load walks home before anything else. Central-place foraging predicts it.
- **One step, by the owner's choice.** Sight and carrying are two mechanisms; the owner chose to take them together. Each has its own switch and counterfactual.
- **The observer.** A sash that wraps from shoulder to hip; a disc of the group's colour round each base and a lettered badge that keeps its size at every zoom; group chips, a group card and rings round a selected group's members.

### What the prototype found

A throwaway prototype in the scratchpad, a copy of the valley core with the new rules, on 32 seeds over 400 days, with Life 6's settings reproducing Life 6's published numbers:

- **Seeing far splits the band.** Never one group in 32 runs, against 6 in Life 6. Sight of 100 m already gives the same split.
- **Checking saves more than half the walking:** 1.11 hours a day against 2.57.
- **Carrying costs almost nothing here:** 1.09 hours of walking a day without the cost, against 1.11 with it.
- **Taking loads home lets 20 kg loads start exchange,** in every run against 5 of 32 without.
- **A random preference for nearer sites was not needed.** Members of a group walked to the same site together in under 1% of checking minutes with or without it, because they leave home at different times. It added 0.6 hours of walking a day.

### Findings

From `experiments.ts` on 32 seeds over 400 days, measured over days 21 to 400, checking every invariant every minute. The implementation reproduced the prototype's numbers exactly.

- **Seeing far splits the band into more groups, not fewer.** Every forager is in a group within 0.31 days, on average 7.3 hours after midnight, about an hour and a quarter after the first dawn. The band forms two groups in 9 runs, three in 22 and four in 1, and never one; Life 6's band forms one group in 6 runs. With sight of 250, 100 and 25 m it forms one group in 0, 1 and 3 runs. Seeing everyone at first light, every forager sets off towards its nearest neighbour at once, and pairs form all over the valley before anyone can gather them. Short sight left foragers to bump into each other one at a time, so an early group could absorb the rest.
- **More groups, less trade.** Members buy 9.4% of the wood they burn, and a group's leading gatherer brings in 1.15 times its fair share, against 12.4% and 1.27 in Life 6. A band that starts as one group buys 18.9%, with a leader at 1.64 times, as in Life 6. Members sleep cold 2.5% of night hours, against 3.6% in Life 6, as before because they buy less of their wood.
- **Checking saves more than half the walking.** Foragers walk 1.11 hours a day, 0.96 of it checking, and work 2.85 (2.19 picking, 0.66 gathering), against 2.57 and 3.09 in Life 6. The time-use prediction with the walking measured gives 2.82 hours of work, 1% below what is measured. Without exploring they walk 0.08 hours and work 2.68; checking only every 72 hours, 0.49 and 2.75. The shortest tour through every site is about 0.54 hours of walking; a day's checks take 0.96, because nearest-first tours are longer than the shortest, and they start and end at home.
- **Walking with a load almost disappears.** Life 6's foragers walk 0.87 hours a day with a load, mostly exploring with a finished load on their backs. Life 7's walk 0.04, on the short way home from a stand. Without the rule to take loads home, 0.65.
- **Carrying costs little in this valley.** Without the carrying cost foragers walk 1.09 hours a day, and every other measure is within the noise between seeds. A 30 kg load carried 150 m home costs about 5 kcal more than walking it unloaded, about 2 kcal a day for a forager that brings home a load every two and a half days. It would matter over longer distances.
- **Taking loads home decides whether small loads start exchange.** With 20 kg loads every run swaps and members buy 11.2% of their wood; without the rule, 5 runs of 32 swap and 0.1% is bought. With 40 kg loads, 27 runs and 5.2% against 9 and 1.2%. With 30 kg loads the rule matters less: 9.4% against 8.2%. Life 5 found loads of 20 kg never started exchange in a band around one fire. Why a forager that takes its load straight home trades so much more was not tested. One likely reason is that it comes home in daylight, when members who are short of wood are there, rather than at dusk.
- **The valley feeds more.** Bands of 8 and 12 are intact at day 400. A band of 16 keeps 5.8 survivors, all its deaths before day 100, against 2.4 in Life 6 and 5.4 in Life 5; groups dissolve 107 times in 32 runs and up to 8 are founded in a run.
- **Life 6 is reproduced exactly** with the changes off, against fingerprints recorded from Life 6's code before the change.

### Trade-offs

- **Two checker gaps, found by runs.** In a band of 16, two members told each other terms early in a minute; one starved later in it, and the group dissolved, so the checker, reading groups at the end of the minute, reported a quote across groups. And in the 32-seed runs, a forager taking a load home was met by a forager without a group that founded a group at an earlier turn of the minute, which moved its hearth before it acted; the checker judged its walk against its old hearth. The engine was right both times. The checker now accepts two foragers who shared a group at the start or at the end of the minute, and works out each forager's hearth at its turn from the minute's foundings. The first gap was in Life 6's checker too, unexposed by its runs.
- **Speed.** With sight across the valley, every place is seen in the first daylight minute, after which marking places is skipped. Checking keeps foragers moving, so a canonical run of 400 days takes about 4.2 seconds, or 6.9 with the checker, against 3.7 and 6.4 for Life 6.
- **Test time.** Life 7's experiments add eight test files beside Life 6's, which keep running with Life 6's settings. The suite takes about eight minutes. MVP9's longest tests have a 30-second limit and timed out once when the machine was also running the 32-seed experiments; on an otherwise idle machine the suite passes.
- **What the observer can show.** A hidden preview pane animates only intermittently, so the browser checks stepped the page with its own Step button.

### Open questions

- Why does taking a load straight home make small loads start exchange? A test would record where and when spare wood and need meet.
- With everyone visible from the first morning, the band splits by who is nearest whom at dawn. Would a reason to join a larger group, such as a shared fire (Life 8), gather them later?
- Checking every site every day is still most of the walking. Would a memory that expects regrowth, or members telling each other what they saw, cut it, and does the owner's planned memory step need either?
- Loads cost little at 600 m. Would a larger valley, or longer trips, make load size a real choice?
- Should stands block the view when the land is no longer open?

## [LIFE6-Groups-036] - (2026-10-13)

### Problem

Life 5 put the band around one fire in the middle of the valley, with every hearth on a spiral around it. The owner found that it made no sense: nothing in the model explained why these foragers lived together. A camp had been given since Life 2, when a prototype showed that foragers wandering alone almost never met, so they could rarely give. The step's question became whether wanting company gathers a scattered band into one group or several, and whether separate groups weaken the exchange and division of work that Life 5 found around one fire.

### Decisions

- **The owner's rules, taken as given.** Foragers start scattered and know only what they have seen. Once their needs are met they explore rather than stand idle. A forager without a group wants company, below hunger and warmth and above resting. Two who meet without a group found one and plant a flag, which becomes their home and where they sleep. One that meets a member joins; members never change group. Members swap only with each other, groups do not interact, and each forager keeps its own hearth. A shared fire at the flag is Life 7.
- **Meeting is talking distance.** 20 m, the distance Life 5 already used for swaps, so the step adds no parameter for it. A forager without a group meets the nearest forager within it at the end of its own turn, at any hour.
- **The flag at the founders' midpoint, hearths on a spiral around it.** Life 5's spiral, 3 m apart in order of joining, leaving the flag's own point free for Life 7's fire.
- **The last member dissolves the group.** A group of one is not a group, and under the rule that members never change group, a survivor kept as a member could never find company again.
- **Places, not only plants.** Exploring needs a record of where one has been. The valley is cut into 400 places 30 m wide, each small enough to lie wholly in a 25 m view from its centre, so a place marked seen had every plant in it seen.
- **Explore what has not been seen for a day.** A threshold keeps exploring from being endless pacing. The owner accepted a day, knowing its cost, over 72 hours, which halves the walking.
- **Life 5 as a special case.** Four switches turn the changes off one by one; with all four off the valley runs exactly as Life 5. Each switch is also a counterfactual.
- **Only the current life is visible.** At the owner's request, the Life 4 page and its view-only code are removed. The hourly core and its tests stay.

### What the prototype found

A throwaway prototype in the scratchpad, a copy of the valley core with the new rules, on 32 seeds over 400 days:

- **Groups form within the first day, and the band usually splits.** Everyone was grouped within 1.3 days, and most bands split into two groups.
- **Searching must come before revisiting.** The first version kept Life 5's rule that a forager remembering no bush with berries goes back to the bush it saw longest ago. A forager that knew a few thickets then circled them while they were bare. Without exploring, only 5.4 of 8 survived, which looked like a finding about knowledge. It was a rule that had made sense only when every forager knew the whole valley. With searching first, every band of 8 survived, exploring or not.
- **Exploring costs food,** and **groups trade less.**

### Findings

From `experiments.ts` on 32 seeds over 400 days, measured over days 21 to 400, checking every invariant every minute.

- **Groups form fast, and a band born scattered usually splits.** Every forager is in a group within 1.31 days, on average within 9.5 hours. A band of 8 forms one group in 6 runs, two in 19, three in 6 and four in 1. Once a forager has company it stops looking, and members never change group, so whether the band ends up as one group is decided in its first hours by who happens to meet whom first.
- **Splitting weakens exchange and the division of work, the more so the more groups.** Members of scattered groups buy 12.4% of the wood they burn, and a group's leading gatherer brings in 1.27 times its fair share. A band that starts as one group around the meadow buys 18.5%, with a leading gatherer at 1.56 times. Across scattered runs, a band that formed one group bought 18.5% of its wood, two groups 12.7%, three 7.8% and four none. A split band is a set of smaller markets, and a market of two rarely holds a spare and a want at once. Strangers who may swap with anyone they meet buy 15.2%: groups lose more trade than scattered hearths do.
- **Splitting keeps people warmer.** Members of scattered groups sleep cold 3.6% of night hours, against 7.6% in one group and 7.1% in Life 5. As in Life 4 and Life 5, buying wood rather than gathering it costs warmth.
- **Exploring is costly and fast.** Every forager has seen the whole valley by the end of its second day. After that, exploring means walking the valley again every day: 2.58 hours of walking against 0.11 without exploring, paid for with 0.4 more hours of work (3.09 against 2.69). The time-use prediction with the walking measured gives 3.05 hours of work, 1.3% below what is measured. Exploring every 72 hours halves the walking.
- **Exploring speeds up the first swap.** A band that starts as one group swaps first on day 87 on average, against day 140 in Life 5. The likely reason is that exploring scatters the foragers' routines, which Life 5 found kept one forager's spare wood from meeting another's need. This has not been tested directly.
- **Exploring lowers what the valley carries.** A band of 16 falls to 2.4 survivors, all of its deaths before day 100, against 5.4 in Life 5, whose band of 16 is still whole at day 100. Groups dissolve 124 times in 32 runs, and survivors regroup, founding up to 8 groups in a run.
- **Life 5 is reproduced exactly** with the four switches off, against fingerprints recorded from Life 5's code before the change.

### Trade-offs

- **Speed.** Exploring foragers keep moving, so what they see changes every minute, and a canonical run of 400 days takes about 6 seconds against about 2.5 for Life 5. Profiling found choosing a place to explore was most of the extra at first, scanning all 400 places every idle minute. Places now keep their corners and centres in typed arrays; the search runs in rings outwards no further than the forager can still walk before dusk; and the place seen longest ago is remembered, outside the simulation's state, so a forager knows without looking that nothing is due yet.
- **Test time.** The tests take about five minutes, against three for Life 5. A band of 12 over 400 days on 8 seeds took four minutes under the full suite, inside a test with a one-minute limit; experiment 5 is now two files, and its runs happen before the tests, as the other experiments' do.
- **A checker gap found by a run.** In a band of 16, a member whose group dissolved earlier in a minute met someone later in the same minute. The engine was right, but the checker compared the forager's group with the one it held the minute before. It now replays the minute's foundings, joinings and dissolutions in order.
- **Meeting at any hour.** A forager asleep at its scattered hearth meets anyone passing within 20 m, as swaps happened between sleepers in Life 5. A forager that joins at night walks to its new hearth in the dark. It is rare and harmless, and keeps one rule for all hours.
- **What the observer can show.** A hidden preview pane does not animate, so the browser checks stepped the page minute by minute with its own Step button.

### Open questions

- Does a shared fire at the flag (Life 7) give groups a reason to grow, or to stay small?
- With one group decided by who meets whom in the first hours, would a band that starts closer together, or foragers that can see further, end up as one group?
- Groups that never trade with each other lose a third of their exchange. Would trade between groups, once allowed, recover it, and would it look different from trade within them?
- Should exploring wane once the valley is known, as real foragers revisit what matters rather than everything? It costs a band of 16 most of its members.
- Would giving, absent since Life 2, follow group lines once it returns?

## [LIFE5-RealScale-035] - (2026-10-12)

### Problem

The owner found Life too abstract: tiles 1.5 km wide, patches and groves that are pools rather than plants, and people out of scale. They wanted to watch people forage and gather at real size, as in a real-time strategy game that can be paused and sped up but not controlled. The abstraction was not only in the picture. The hourly core decides in hours on tiles, so drawing people walking between bushes would have shown things the simulation never decided. Life 3's notes had already asked whether tiles should shrink and plants become individual sources once time became finer. The step's question became whether Life 3's and Life 4's findings survive real scale.

### Decisions

- **A new core, not a new picture.** Ticks are minutes, positions whole centimetres, and food and wood individual bushes and trees. The hourly core is frozen as a reference, as MVP9 was, because its results cannot be replayed at real scale, only compared.
- **A small, dense valley.** The owner chose a valley 600 m across that a viewer can take in, over realistic sparse land with a following camera. It grows exactly what Life 4's land grew, so the two can be compared. It is far richer than real land, and that is labelled experimental.
- **Seconds inside a minute.** Bushes stand 2 to 3 m apart, so a minute may hold a short walk and then work. Spending whole minutes on two-second walks would have been an artifact of the tick.
- **Remainders instead of fractions.** Rates and costs stay per hour and are paid second by second, each forager carrying the fraction to the next minute in 3,600ths, so an hour of work at rate `r` takes exactly `r` units.
- **Deadwood, not felling.** Foragers gather dead branches under standing trees. Felling a live tree without an axe is slow and green wood burns badly, so felling waits for tools. The owner had heard "chop a tree" in the first discussion; the spec flagged the change and the owner approved it.
- **No trigonometry in the simulation.** Distances are integer square roots, which are exact in IEEE arithmetic; hearths lie on a square spiral rather than a circle, so runs are identical on every machine.
- **Loads.** See the prototype's findings below. The size, 30 kg, is a common firewood headload, chosen before its effect was known, and varied in experiment 3.
- **Nearest bush first.** At real scale people pick the nearest bush worth picking. Life's "fullest patch first" would send a forager across the valley past food.

### What the prototype found

A throwaway prototype in plain JavaScript, on 32 seeds, before the specification:

- **Exchange never started.** At minute scale a forager gathering wood stops within the minute it reaches its target, so nobody ever held spare wood, nobody could offer any, no terms were told and nothing was swapped: not once in 64 runs, even in Life 3's band born with own terms 3.7 times apart. In the hourly core, an hour of gathering overshot the target and left spare wood that no rule had planned. The lump was doing work no one had designed.
- **Loads restored it.** With a forager that brings home a full load once it has set out, which central-place foraging predicts (Orians and Pearson, 1979), exchange returned once a load was larger than the wood a forager keeps.
- **The valley fed more.** Walking fell from hours a day to minutes.

### Findings

From `experiments.ts` on 32 seeds over 400 days, measured over days 21 to 400, with Life 4's hourly core on the same seeds.

- **Real scale saves time.** Without swaps a forager works 2.67 hours a day and walks 0.10, against 3.24 and 3.56 in Life 4; the time-use prediction gives 2.65. Nobody sleeps cold.
- **No surplus, no exchange.** Without loads no forager ever holds spare wood, and nothing is swapped or quoted, whatever the skills. This is a theorem for loads up to 13 kg on the canonical settings and was found for all loads up to 24 kg in a band born equal.
- **Loads decide, but not as a threshold.** In a band born equal, exchange starts in 0 runs of 32 with loads up to 24 kg, 9 at 26 kg, 29 at 28 kg, all 32 at 30 kg, only 8 at 36 kg and all 32 at 40 kg. The dip at 36 kg was not predicted. Traced through the routine a load sets: with 36 kg a forager's wood runs 36, 24, 12, 0 and round again, so it has spare wood only on the evening it comes home, when every other forager born alike has just come home too. Trade needs a surplus and a want at the same time, and identical routines keep them apart. This explanation fits the numbers but has not been tested directly, for instance by staggering the band's starting wood. In Life 3's band, born unequal, the routines drift apart at once and every load from 26 kg starts exchange within three days.
- **The division Life 4 found survives, but much weaker and later.** With 30 kg loads every band born equal swaps, but the first swap comes on day 140 on average (latest 253) against 15.5 in Life 4. The top two gatherers bring in 36% of the wood (32% to 41%) against 53% in Life 4 and 25% without swaps; own terms spread 1.06 times by day 100 and 1.61 by day 400, against 1.86 at day 100. 18% of the wood burned is bought, against 39%. Roles turn over more (3.0 lead gatherers, persistence 0.43, against 2.2 and 0.67). Most of Life 4's early division came from luck that the hourly lumps amplified; at real scale there is little of it, and the division builds slowly from small differences.
- **Exchange still costs warmth.** Cold nights rise from none to 7% of night hours with swaps, as in Life 4.
- **The valley carries more.** Bands of 8 and 12 are intact in every run; a band of 16 falls to 5.4, 24 to 4.9 and 32 to 2.8. On Life 4's land a band of 12 falls to 4.6. As in Life 1, a band near the capacity `K` (about 16) collapses.
- **The implementation differed from the prototype.** The prototype found the first swap around day 80, the top two at 42%, and every run swapping from 30 kg up. Layouts, streams and tie-breaks differ between the two, so the numbers were expected to move; the direction of every finding held except the claim about larger loads, which the implementation corrected.

### Trade-offs

- **Speed.** A canonical run of 400 days takes about 2 seconds, and about 3 with every invariant checked every minute, against the specification's target of under 2 with invariants. The tests use 8 seeds, 100 or 30 days where an expectation holds at any horizon, and run each configuration once; they take about three minutes with the rest of the suite. Profiling showed that carried food, kept as one lot per minute picked, dominated: eating and adding lots now avoid copying and sorting, with results checked identical to Life's functions, and the checker checks every lot hourly and the oldest and newest every minute.
- **The test timeout.** With the valley's experiments loading every core, a Life 0 test that takes a second alone took over five in the full suite. The runner's limit per test was raised to 60 seconds; no test changed.
- **Quotes are many.** Foragers that could both gain tell each other terms every minute they meet, about 1.4 million times in a run. They are kept as events for the observer's last three days only; experiments keep no events.
- **The observer shares Life 4's view code.** Its colour scale and specialization chart now accept the valley's configuration, a type-only change to `src/lifeView`. The MVP9 top bar's link reads "Life 5", following earlier steps.

### Open questions

- Would staggering a band born equal, giving foragers different starting wood or hearths at different distances, remove the dip at 36 kg and make the division start sooner?
- Should a forager's own terms count the walking its work needs? At real scale its picking and gathering rates overstate what an hour of work brings home.
- With tools next, does felling with an axe make wood lumpy again, and does that bring back Life 4's quick division?
- What would realistic productivity, with the band spread over square kilometres, do to exchange when people rarely meet?

## [LIFE4-Practice-034] - (2026-10-12)

### Problem

Step 4 asks whether practice alone makes identical foragers specialize. Smith held that differences in skill follow the division of labour rather than cause it; Rosen showed that when skill is built by doing, even identical people gain by specializing completely. But Rosen's people choose careers knowing that practice pays. Life's foragers do not: each works for what it needs today at today's rates, and swaps only when terms it has heard make that quicker.

### Decisions

- **The ladder's row was split again.** Step 4's row bundled recipes, tools, shelter and practice, but its question was about practice alone. The owner chose practice as step 4 and tools and shelter as step 5.
- **Skill follows the last month's work.** A forager's practice at a task is its hours at it over its last 30 days, rising from 50% with none towards 150%, half way at 60 hours. A window of days is easy to state and to check, and forgetting by disuse comes with it. Rates change only at midnight.
- **Born skill stays beside practice.** A rate is the base rate times born skill times practice, so one rule covers a band born equal and Life 3's band of unequals, and the two can be compared.
- **A band born equal, starting at 100%.** Every forager starts with two hours a day at each task behind it, which is exactly Life 3's equal rates, so any difference comes from what happens in the run.
- **No foresight.** A forager knows its rates for the day, not that practice will change them. Nothing tells it that specializing would pay.
- **A prototype first.** It showed that practice alone leaves a band undivided, that practice with exchange divides every band, that roles change hands, and that the length of memory, not the starting skill, decides how long roles last. Starting with no practice at all, or with the same hours at both tasks, gave nearly the same results.
- **Life 3 reproduced bit for bit.** Hourly checksums of three Life 3 runs were recorded from Life 3's code before any change.
- **One line per forager became three.** The chart of own terms over time plots the band's highest, its lowest and the followed forager's, which shows the band fanning out as well as a line per forager would and stays readable for a band of 100.

### Findings

Over 400 days on the canonical world, 32 seeds, measured over days 21 to 400.

- **Practice alone does not divide work.** Without swaps, every forager in a band born equal spends 20% to 21% of its working hours gathering, and own terms stay within 11% of each other. Practice makes every forager better at foraging and worse at wood, about 106% and 74%, because foraging takes most of its working hours; its own terms rise from 50 to about 70 kcal a unit, but alike for all. Cold nights fall from 11% of night hours to 3%, probably because faster foraging leaves more daylight for wood; this has not been traced.
- **Practice with exchange divides every band.** The first swap comes within 12 to 26 days, once luck in the turn order has opened a gap between two foragers' own terms wide enough for a midpoint to fall strictly between them. From there the gap widens: a seller gathers more and gets better at it, a buyer forages more and loses its skill with wood. By day 100 the highest own terms in a band are 1.86 times the lowest. The two keenest gatherers bring in 53% of the band's wood, against 25% without swaps, and 39% of the wood burned is bought. This is Rosen's increasing returns, reached without anyone planning it.
- **The division is partial.** The keenest gatherer spends 41% of its working hours on wood, not all of them, and its wood rate rises only to about 21 units an hour, far below the 36 that full-time gathering would bring. A hungry forager still works for food first, and the band's whole need for wood is a few hours' work a day.
- **Roles are spells, not castes.** Over nine 40-day windows, 2.2 different foragers lead wood gathering on average, and the correlation between a forager's wood share in the first and second halves of a run is 0.67. With 10 days of memory roles turn over constantly (4.8 leaders, 0.10), with 90 days they barely change (1.2 leaders, 0.96). Longer memory also delays the first swap, to day 32, because skills move more slowly.
- **How much practice matters sets the depth of the division, not its extent.** With practice from 80% to 120%, own terms spread only 1.24 times, but the top two still bring in 51% of the wood; from 25% to 175%, 3.1 times and 52%. With weak practice the first swap can wait until day 82.
- **With born differences, practice deepens what birth began.** In Life 3's band, practice keeps specialization aligned with born advantage (−0.83 against −0.78) and widens own terms from 3.7 to 5.8 times. Survivors rise from 7.50 to 7.94 and the least skilled third's survival from 80% to 98%. Most of that is not specialization: without swaps, practice alone raises survivors from 6.88 to 7.75, because everyone gets better at foraging, the task each does most. Wood is less concentrated with practice (61% against 69%), which has not been explained.
- **Exchange still costs warmth.** As in Life 3, cold nights rise with swaps, from 3% to 15% of night hours.

### Trade-offs

- The Life tests still take about two minutes; the new ensembles run in parallel on 16 seeds, and the reported numbers use 32.
- The practice log is kept, and practice events recorded, with practice off too. It costs little and keeps one set of invariants.
- The MVP9 top bar's link label was changed to "Life 4" without a separate approval, following the change approved for Life 3.

### Open questions

- Why does practice make wood less concentrated in a band of born differences, when it makes it more concentrated in a band born equal?
- Would a forager that weighed its needs, rather than serving hunger first, specialize fully, as Rosen predicts?
- What happens to a band that has divided its work when its wood gatherer dies? Its buyers have lost their skill with wood.
- Would teaching, or learning by watching others, make roles last longer or turn over faster?

## [LIFE3-Foragers-033] - (2026-10-12)

### Problem

Looking at Life 3, the owner found the foragers out of proportion with their land, and asked what the point of gathering wood was. Each forager stood about 0.8 tiles tall, as tall as a full-grown tree and three times a bush. The panel said a forager was "sleeping cold, with no wood to burn" but never what that cost, so wood looked like busywork.

### Decisions

- **Half size, not true scale.** At true scale a person would be a fifth of a tree and a speck at the default zoom. Half size puts a forager at about half a tree and a little above the bushes, and keeps it easy to see and click. The scale is one constant, `FIGURE_SCALE`; hearths, the follow ring and the gift and swap arcs follow it.
- **The value of wood in the panel's own unit.** The panel states what a night's fire burns and what it saves against sleeping cold, in kilocalories, the unit everything else is measured in: 12 units saving 1,080 kcal on the canonical settings. It is computed from the configuration, so it stays right if the settings change, and it is hidden where nights are not cold. A forager that burns wood is now "sleeping warm by its fire", so warm and cold nights read differently.

### Findings

None; the simulation is unchanged. This is an observer change only.

 - (2026-10-12)

### Problem

The owner noticed that each patch was drawn as one bush, which reads as one plant, though a patch is a collection of food. The numbers agree. On Life 1's land a patch regrows 1,200 kcal a day, about 440,000 kcal a year: roughly 70 kg of nuts or most of a tonne of berries, the crop of dozens of shrubs. The same holds for a grove: 200 units of wood is a stand, not a tree.

A first attempt drew each patch as a grove of shrubs and two trees that browned as they were eaten. It was built on a copy of `main` from before Life 2, and the owner caught the flaw: Life 3 already draws wood groves as trees, so food patches with trees in them would look like wood. Browning was wrong as well, since picking fruit does not kill leaves. That attempt was set aside unmerged.

### Decisions

- **Change the picture, not the model.** The owner also suggested 100 m tiles. A tile is about 1.5 km, a scale that is only a note in the specifications, chosen so that walking 3 tiles an hour is about 4.5 km/h. Relabelling the tiles alone would have foragers walking 300 m an hour. Rescaling everything consistently would let a forager cross dozens of tiles within one hourly tick, so space would be far finer than time. Shrinking the tiles while keeping walking distances short would make walking almost free, removing the cost that drives Life 1's collapse. The owner agreed to keep the 1.5 km tiles until the model moves to finer time.
- **Fruit means food; trunks mean wood.** A patch is a thicket of low, round bushes with red berries, and a grove a stand of tall conifers. The two read apart by shape and colour at any zoom, including at 375 px, and any future scenery can be kept free of fruit.
- **Show the good itself.** The berries are the food, so they are what is picked; the bushes stay green. A stand's trees are its wood, so they are felled to stumps and grow back from them. A stump keeps an empty grove visible and clickable, as the shrunken bush and crown did before.
- **One part at a time.** A stock is shared out among its parts one after another (`fillInTurn`), so a thicket shows some bushes full and some picked rather than every berry shrinking a little, and the parts drawn add up to the stock's share of capacity. Thirty berries make each one about 800 kcal on Life 3's land; five trees make each one 40 units of wood.
- **The layout is decoration.** It comes from the site's kind and ID through the shared hash, not from the run's seed or any simulation stream, so it cannot disturb a trajectory.
- **Instancing.** Life 3's 32 thickets alone have about 580 leaf lobes and 960 berries. All leaves, berries, trunks and crowns are four instanced meshes rather than meshes per site, and picking maps an instance back to its site.

### Observations

- By day 6 of the canonical run, thickets near the camp were picked down to a few berries while far ones stayed full. Run with a single grove, the band had cut it to one standing tree among stumps by day 4. These were seen in screenshots, not measured.

### Open questions

- When the model moves to finer time, should tiles shrink and plants become individual sources of food and wood, so that a site is literally its plants?

## [LIFE3-Specialization-031] - (2026-10-11)

### Problem

Step 3 asks whether specialization and exchange emerge from differences in skill. Ricardo's comparative advantage says two producers gain by specializing and trading whenever their relative costs differ, and Smith adds the time saved by not switching between tasks. Both assume exchange already happens. Here nothing makes it happen: two foragers can swap only if they meet, one carries what the other wants, and both know a swap would pay.

### Decisions

- **The ladder's row was split.** Step 3's row bundled a second resource, conversion, recipes, tools, fire and shelter, and skills that differ and improve with practice. Following design rule 12, the owner chose wood and skill first and tools and practice as the next step, and chose to add swaps beside Life 2's food gifts rather than extend gifts to wood.
- **Wood against cold, at a hearth of one's own.** Wood's single use is warmth, so its value is measured in kilocalories saved. Each forager burns its own wood, as each family keeps its own hearth in forager camps; a shared fire would have turned the question into one about free riders, which Life 2 asked.
- **Own terms from the body alone.** A forager values a unit of wood at what it would cost it in foraging time, `g / w`, the autarky price of comparative advantage. Two foragers swap at the midpoint of their own terms, after Sugarscape's trade rule (Epstein and Axtell, 1996). No rate is posted.
- **A prototype first, and it changed the design twice.**
  - With steady harvests, no swap ever happened. A buyer must carry food, and a forager carries food only to buy wood, which it does only if it knows a swap would pay. Foragers now tell each other the terms they would accept when they could both gain.
  - Working for trade starved the band. A hungry forager that had once heard good terms kept gathering wood that nobody bought; foragers died holding 300 to 500 units, and a band of 8 fell to 1.3 survivors. A forager now gathers wood to sell only once it has sold all its spare wood, as unsold stock tells a shop to stop.
- **A band of 8.** Cold nights and trips for wood mean the land that carried Life 2's band of 12 with steady harvests carries 8; a band of 12 with equal skills collapsed on every prototype seed.
- **Steady harvests for everyone.** A forager's harvest is the larger of `harvestKcal` and its own rate, and the canonical `harvestKcal` is the slowest rate, so a slow forager does not also face windfall risk.
- **Life 2 reproduced bit for bit.** Checksums of three Life 2 runs, gifts included, were recorded from Life 2's code before any change.
- **A fix that was tried and withdrawn.** A trace showed a poor forager that heard low terms foraging all day "to buy wood", eating every harvest because its reserve was never full, never carrying food to pay with, and sleeping cold. Making the rule count the room in a forager's reserve stopped that, but then no forager ever foraged to buy, and no swap happened in 60 days. The approved rule was kept, and the behaviour is recorded below.

### Findings

Over 400 days on the canonical world, 32 seeds, measured over days 21 to 400.

- **Specialization follows comparative advantage once exchange is possible.** Without swaps, a forager relatively good at foraging spends relatively long gathering, because wood is slow for it: the correlation between own terms and the share of work spent gathering is +0.90. With swaps it is −0.78. The two foragers that gather most bring in 33% of the band's wood without swaps and 69% with them, and half the wood burned (49%) has been bought.
- **Exchange keeps more of the band alive, mostly the least skilled.** Survivors average 7.5 of 8 with swaps and 6.9 without. The third with the lowest foraging rates survives 80% of the time against 52%. The gain grows with the spread of skills: at 25–175%, survivors rise from 5.8 to 6.7 and the least skilled third's survival from 16% to 61%. At 80–120%, where no one dies, swaps cut a forager's day from 3.40 hours of work and 3.79 of walking to 3.24 and 3.29, Smith's saving of time between tasks.
- **Exchange does not start by itself.** With quotes off and steady harvests, nothing is ever swapped, and every run is identical to one without swapping. With windfalls, food carried home starts exchange without talk (651 swaps a run), but specialization stays weak (+0.86 to +0.23) and survival does not change. With talk in the same world, swaps triple, the correlation reaches −0.75 and 3.6 survive against 3.1.
- **No single rate emerges.** Each pair splits the difference between its own fixed terms, so swaps settle anywhere from about 33 to 73 kcal per unit, with a mean of 51 and a standard deviation of 14 in the first quarter of a run's swaps and 52 and 14 in the last.
- **Exchange costs some warmth.** The band sleeps cold in 16% of its night hours with swaps and 12% without. Traces show two mechanisms. A forager that hears low terms from another pair's swap forages to buy wood, but eats its harvest first; a poor forager's reserve never fills, so it never carries food to pay with. And a poor forager hungry day after day works only for food, because hunger comes first, so it never fetches wood, and cold nights make it hungrier: a poverty trap. An hour of gathering would save such a forager more energy than an hour of foraging earns, but the priority rules do not weigh one need against the other.
- **Overheard terms mislead.** A forager remembers the last terms it heard, usually another pair's. Those terms can tell a good gatherer that selling does not pay, when the buyers around it would offer more.

### Trade-offs

- The Life tests take about two minutes instead of a minute and a half. The ensemble tests run on 16 seeds; the reported numbers use 32.
- Foragers tell their true terms. Misstating them to win better terms is left out.
- Quotes are frequent, about 50,000 a run, because every pair that could gain at camp quotes every hour. They are kept in the event record for the last 30 days, like every event.

### Open questions

- Would a forager that weighed its needs, rather than serving hunger first, escape the poverty trap by gathering the wood that saves it more than foraging earns?
- Would foragers that remembered the terms each partner offered, rather than the last terms they overheard, converge on one rate for wood?
- With practice (step 4), does specialization deepen as skill follows work, and does it appear even among identical foragers?
- Which pays better against the same risks: Life 2's gifts or Life 3's swaps? Both are in the engine but have not yet been compared.

## [LIFE2-Sharing-030] - (2026-10-11)

### Problem

Step 2 asks when sharing emerges and when hoarding does. Theory points both ways. Sharing pools the risk of uneven returns (Winterhalder, 1986), and foragers share most where returns vary most and food keeps least (Kaplan and Hill, 1985). But among unconditional sharers a forager that only takes should do best, unless sharing is reciprocal (Trivers, 1971). Life 1 left a related question: could sharing smooth the hunger that sends a whole band searching at once?

### Decisions

- **A prototype first, and it changed the step.** A throwaway scratchpad version reproduced Life 1 exactly and then showed that the ladder's row ("variable yields, spoilage, the ability to give food, and memory of who gave") was not enough on its own:
  - with harvests of up to 8,000 kcal, under 1% of food was ever given, whatever the rules, because a forager's body holds up to 20,000 and simply eats the harvest;
  - with larger windfalls, foragers that wander alone almost never share a tile, so at most about 15% of food changed hands and giving barely changed who lived;
  - with a shared camp, 20–50% of food changed hands in the same conditions.
- **The owner chose a camp, competing strategies and a single step.** Fixed keepers, sharers and reciprocators make the question measurable as "which pays" without building sharing in; whether a paying strategy spreads needs inheritance, which is step 5. A band of keepers is the giving-disabled counterfactual, so the step was not split.
- **Windfalls that keep the average.** An hour succeeds with probability `g / H` and takes `H`. A patch must hold a full windfall, keeping Life 0's rule that a forager never works a patch that cannot repay it. A variant that let a thin patch pay out whatever it held killed foragers by having them work patches that returned less than they cost, so it was dropped.
- **Fullest-first stays.** Choosing the nearest patch instead looked sensible with a camp, but in the prototype every hungry forager then headed for the same few patches near camp, and even a band with steady food collapsed. The only change to patch choice is that a forager sets out only for patches it can forage and return from before dusk. A kept target is checked the same way; without that, a forager could arrive home an hour after dark, which the prototype caught.
- **The canonical world** is Life 0's 12 × 12 grid with 32 patches at Life 1's regrowth, holding up to 24,000 kcal so a patch can hold several windfalls. With steady harvests a camp band of 12 is intact on every seed; in the prototype one of 13 collapsed on a third of the seeds and one of 14 on all, so 12 is the largest band this land reliably carries.
- **Life 1 reproduced bit for bit.** Checksums of four Life 1 runs were recorded from Life 1's code before any change, and the new code matches them on `LIFE1_WORLD`.

### Findings

Over 400 days on the canonical world, 32 seeds unless stated.

- **Bad luck alone matches the theory.** A lone forager whose patch always holds a windfall of 24,000 (a 5% chance an hour) starves in 13.8% of its hungry spells, against a predicted 12.9–15.0% for the 37–40 tries its reserve allows (400 seeds). Hunger starts at 14,000 of a 20,000 reserve, so a forager has only about three days of tries.
- **Windfalls are deadly, and the deaths are steady rather than a collapse.** Bands of keepers keep 12.0, 10.5, 5.7 and 1.3 of 12 alive with windfalls of 1,200, 3,600, 6,000 and 9,600. At 6,000 the band is at 10.1, 8.5, 7.2, 6.5 and 5.7 on days 50, 100, 200, 300 and 400: runs of bad luck pick off foragers throughout the run, unlike Life 1's collapse within two weeks. With a camp, walking out and back takes up to eight daylight hours, which leaves fewer tries per day than on a single patch and makes each spell riskier.
- **Sharing keeps more of a band alive, increasingly so as windfalls grow, through a small flow of food.** Bands of sharers keep 6.9 against keepers' 5.7 at 6,000 and 2.2 against 1.3 at 9,600; reciprocators keep 6.1 and 1.8. Sharers give 0.7%, 4.4% and 10.5% of their harvest at 3,600, 6,000 and 9,600. With steady harvests nothing is ever given, because nothing is ever left over.
- **Perishability matters less than theory suggests.** At 9,600, keepers lose 0%, 1.1% and 7.5% of their harvest to spoilage with food that keeps, lasts 48 hours or lasts 12; sharers lose 0.1% and 2.1%. Survival barely moves with shelf life: sharers 2.8, 2.2 and 2.7, keepers 1.1, 1.3 and 1.1. The body is the main store: a forager eats a windfall into its reserve first and carries only the rest, which it eats within a day or two anyway.
- **Within a mixed band no strategy clearly pays.** At 6,000, 51% of keepers, 50% of sharers and 53% of reciprocators survive (standard errors about 3 points, 64 seeds); at 3,600 and 9,600 the strategies are equally close. Keepers free-ride, receiving 14,300 kcal each and giving nothing, but gain nothing measurable by it; sharers give 30,100 and receive 17,600. Reciprocators receive about as much as sharers while giving two-thirds as much, because they stop giving to anyone who has not repaid them.
- **Why sharing is nearly free (hypothesis).** A forager carries food only once its reserve is full, so a sharer gives away only what its body cannot hold at that moment. With perishable food much of that would have spoiled; with durable food it would have been eaten days later, when the sharer is not yet hungry. Either way the sharer loses little, so free riders have little to exploit and reciprocity has little to protect.

### Trade-offs

- The Life tests now take about a minute and a half instead of 20 seconds. The ensemble tests run on 16 seeds; the reported numbers use 32 and 64. The full set of experiments takes about six minutes.
- The canonical band is 12, not the 25 or so of real forager bands, because the land must carry it with a camp on a small grid. Larger bands need a larger world, where walking to camp costs more.
- The strategies are fixed rules, not choices. Theory's prediction that perishability raises sharing is about agents deciding how much to keep; here perishability can only change who loses food to rot, which is a weaker test.

### Open questions

- If foragers chose how much to keep, for example enough for the days until food spoils, would perishability then change how much is shared, as theory predicts?
- With inheritance (step 5), would any strategy spread when the payoffs are this close, or would drift decide?
- Would a forager that started foraging before it was hungry, learning a threshold from experience, avoid more bad-luck deaths than sharing does?
- Do reciprocators settle into stable partnerships? The ledgers record every pair and could show it.
- Would telling others where food is, or hunting together, pool risk more cheaply than giving food?

## [LIFE1-Band-029] - (2026-10-11)

### Problem

Step 1 of the bottom-up core puts many foragers on one landscape. Does the band settle at the land's carrying capacity, and how does competition for patches spread wellbeing? Life 0 left a sharper question: alone, out-of-date memory cost almost nothing, because a remembered patch could only have grown. With others eating, a patch remembered as full may have been emptied. Does local knowledge then become costly?

### Decisions

- **No births.** The owner agreed to leave births to step 5. A minimal birth rule would need an arbitrary threshold, and that threshold would set the population the band settles at. Without births a band can only shrink, so the question becomes whether it thins to capacity or collapses below it.
- **A fresh turn order every hour.** Foragers act one at a time in a seeded shuffle. It favours no one in the long run and keeps Life 0's rule that a forager forages only a patch it has just seen holding a full hour's harvest. The order's seed comes from the run seed and the hour, so any hour's order stands alone. Simultaneous claims split by a rule were the alternative; they would need integer rounding and would break the full-hour rule.
- **Perception as a radius over patches only.** Radius 0 is Life 0's forager, and a radius covering the grid gives full information as a free counterfactual. Other foragers are not perceived, because no rule would use them yet.
- **One new rule.** A walking forager that sees its target emptied chooses again. At radius 0 it never fires, which keeps a band of one identical to Life 0.
- **A band of one must reproduce Life 0 bit for bit.** Checksums of seven Life 0 runs were recorded from the old code before any change. The refactor reproduces all of them.
- **A prototype before the spec.** A throwaway scratchpad version found the collapse and the search-capacity bracket before the spec was written, so the spec could state them as predictions. The implementation's turn-order stream differs from the prototype's, so the exact counts moved a little; the conclusions did not.

### Findings

- **The band does not settle at carrying capacity; it collapses well below it.** On the canonical world (`K ≈ 19.8`):
  - the largest band that survives 400 days intact is 12–13 on the eight seeds;
  - a band of 20 loses 11–14 foragers;
  - a band of 40 falls to 4–8 survivors, 20–40% of `K`, all deaths coming between days 9 and 14. The survivors then live comfortably on a land that is mostly unused.
- **Searching is what kills.** Once patches thin, hungry foragers spend most of their daylight walking towards patches someone else has emptied. Walking costs 300 kcal an hour against 90 for resting, so the band burns more than the land regrows and starves with food still on the ground, spread too thinly for a full hour's harvest. In the prototype, on the day before the first deaths, 9 foragers spent 95 of their 108 daylight hours walking. Making walking as cheap as resting lets 14–16 of 40 survive instead of 4–8, which confirms the mechanism rather than just describing the outcome.
- **A simple bracket.** If every forager walked through every daylight hour, the land could feed `Kₛ = 24·n·r / (N·s + L·τ)` foragers, 10 here. On every seed, and on three other landscapes tried in the prototype, the largest intact band lay between `Kₛ` and `K`, and the survivors of a collapse numbered no more than `Kₛ`. Survivors stayed at or below `Kₛ` at every walking cost tested too.
- **Local knowledge now costs something, but more knowledge is not the cure.** Seeing only its own tile, a band of 10 walks to emptied patches on 11–24% of its walks; alone, the forager never did. With full information no walk ends at an empty patch, and the largest intact band rises only from 11–13 to 13–14. After an overshoot, full information makes the collapse worse: a mean of 3.1 survivors from 40, against 5.3 seeing only their own tile. Every hungry forager heads for the same fullest patch.
- **Who survives is luck.** Survivors started 2.6 tiles from the nearest patch on average and the dead 2.5. The prototype had suggested survivors started closer; the implementation does not bear that out. After the collapse, survivors forage 1.85–1.91 hours a day and walk 0.17–0.41, much like the lone forager. Competition decides who lives, not how well the living live.

### Trade-offs

- With 40 foragers, checking every invariant every hour costs about twice the step itself. Experiments 2 to 4 live in their own test files so they run in parallel; the Life tests take about 20 seconds.
- Dead foragers stay in the state and are drawn lying down. A long run accumulates them, which is accurate but cluttered.

### Open questions

- Would a rule that waits on a thinning patch instead of searching avoid the collapse? It needs some sense of how fast patches regrow, which suggests learning from experience (design rule 10) rather than a fixed rule.
- With births (step 5), does the band oscillate around `Kₛ` in boom and bust, or settle?
- Would telling others where food is help, or make the herding worse, as full information does here?
- Sharing food (step 2) could smooth the hunger that sends everyone searching at once. Does it raise the band the land can carry?

## [LIFE0-Forager-028] - (2026-10-11)

### Problem

Step 0 of the bottom-up core: does a forager with only local knowledge and simple rules keep itself alive wherever the land could feed it, and how much of the land's capacity does it lose to travel and out-of-date knowledge? The owner also asked for the simulation to feel continuous, as Life Engine did in Unity, rather than visibly stepping.

### Decisions

- **Hourly ticks in the model, continuous time on screen.** Unity is not continuous either; it steps per frame and per physics tick, which is why Life Engine runs cannot be replayed. Life 0 keeps deterministic hourly steps and interpolates the display between two real states, so nothing on screen is invented. An event-driven model with exact action times stays in reserve for when agents meet and timing within an hour matters.
- **Immutable hourly steps.** `stepLife` returns a new state, which lets the observer hold the states before and after the hour it is drawing. Events are kept one array per day so a step copies at most a day's events.
- **Foraging only for a full hour's harvest.** Without this rule, a hungry forager on a nearly empty patch would spend 300 kcal an hour to gather 50, and the single-patch threshold would depend on how that waste played out. With it, every foraging hour gathers exactly 1,200 kcal and the threshold has a closed form.
- **A one-tile world for the single-patch benchmark,** so the forager starts on its only patch and no opening walk distorts the predicted day of death.
- **A separate page for the observer.** It shares the visual language of the MVP9 world but no state, so the frozen core and its observer are untouched apart from one link.

### Findings

- **The threshold matches the theory.** The reserve declines at every rate up to 90 kcal/h and at none from 91, against a predicted 90.9.
- **The first prediction of the day of death was wrong.** A 5% tolerance around `E / deficit` failed: the forager died about 6% early. At death the patch may still hold food the forager never ate, up to one hour's harvest it was waiting for, plus a night's regrowth if it dies asleep. The window now runs from `(E − g − N·r) / deficit` to `E / deficit`, and every starving run falls inside it.
- **A reserve's slope needs a tolerance.** A well-fed forager's reserve cycles between the hunger thresholds, so its least-squares slope wanders by about ±1.3 kcal a day. Sign alone misclassified well-fed runs as declining; a 2 kcal-a-day tolerance separates them from a forager losing 18 kcal a day at 90 kcal/h.
- **Abundance does not raise working hours.** At 100 to 800 kcal/h the forager forages 1.81–1.82 hours a day, as predicted. It stops when fed.
- **Local knowledge costs little when the forager is alone.** On the canonical world it survives with a reserve that is not declining at 24–26 kcal/h per patch on the eight seeds, 1.06–1.14 times the lower bound that no forager could beat. At the canonical 50 kcal/h:
  - it forages 1.86–1.94 hours a day and walks 0.25–0.62;
  - of its 65–67 trips over 400 days, none ended at a patch too empty to forage.
- **Why local knowledge costs so little (hypothesis).** With no one else eating, a remembered patch can only have grown since it was last seen. Out-of-date memory therefore errs only by underestimating, which is the safe direction, and the remaining gap to the bound is mostly walking.

### Open questions

- With other foragers (step 1), memory can overestimate: a patch remembered as full may have been emptied by someone else. Does the cost of local knowledge then rise sharply, and does sharing information about patches start to pay?
- Is the near-zero cost robust to fewer, richer patches or larger distances, or specific to this landscape?

## [MVP9-Life_Engine_Merge-027] - (2026-10-10)

### Problem

The owner proposed stepping back from the MVP9 economy and returning to basics: identify the earliest economy in human history, model its agents, get it running, and only then add complexity. The engine has no target era; it models agents managing scarcity. Looking at Life Engine, a separate Unity project with embodied agents, the owner expected the two projects to converge and wanted them to: the goal is one simulation of life, with economics as one part. That raised a platform decision. The owner does not write code, so all of it is written by Claude Code, and leaned towards three.js in the browser while wondering whether Unity would be faster.

### Decisions

- **Merge into Econ-Engine; keep the browser.** Rendering speed was not decisive. Life Engine's simulation runs inside Unity's frame loop, with physics steering, raycast perception and unseeded randomness, so it cannot be replayed, run headless or repeated across seeds. Econ-Engine's core is already separate from its view. Claude Code can validate the TypeScript project headless in seconds and inspect it in a browser, whereas much of a Unity project lives in the editor. Life Engine is frozen as a design reference; its ideas are ported, not its code.
- **Bottom-up instead of top-down.** The vision planned to move MVP8's built-in institutions into a rules layer one at a time. Those institutions are the current engine, so every intermediate version would be a modern economy with parts missing. A new core starting from the economy with the fewest institutions, a forager band, reaches the vision's goal more directly. The MVP9 core stays as a reference.
- **The earliest economy as a guide, not a period.** Foraging bands are the starting point because they have no money, prices, firms or government, not because the engine models prehistory.
- **No barter assumption.** The barter-first story has little evidence behind it (Humphrey, 1985; Graeber, 2011). Agents may keep, give or swap; which prevails is an outcome.
- **The individual as the agent.** Life Engine's embodied individual replaces the household. Its hormone-level physiology is reduced to energy and fatigue until a question needs more.
- **A ladder of questions.** Seven steps, each with a question that could come out either way and a validation target from theory: survival and leisure, carrying capacity, sharing under risk and spoilage, specialization, property, Malthusian dynamics, and the emergence of a medium of exchange.

### Trade-offs

- Most of `src/sim` (firms, markets, payroll, Government) is unused by the early steps. The infrastructure carries over: RNG streams, invariants, the ledger, ensembles and the observer.
- Sugarscape already covered much of the first three steps. The new core's contribution must come from exact accounting, the causal ledger, perception-limited information and rules as data.
- The browser lacks Unity's animation, physics and terrain tooling. The simulation does not need them; the view can add web equivalents if wanted.

### Open questions

- The tick length, and whether bodily needs follow fixed priority rules, bounded learning, or both.
- The new core's directory and name, whether the observer shows both cores, and whether the MVP9 core is eventually retired.
- Whether the project should be renamed once the merged core is the main line of work.

## [MVP9-Plots-026] - (2026-10-08)

### Problem

Every firm occupied a single tile, the same as a house, and Government and Transport had no location in the model at all. The owner wanted building sizes to be more realistic: houses on one tile, firms on more tiles depending on their size, Government on the most, and a larger grid. The owner chose to make this part of the simulation rather than a display-only change, accepting that every trajectory would change.

### Decisions

- **Plot size by industry land use**, fixed for the run. Headcount was considered, but all eight consumer firms have the same headcount, so it would not have varied. Revenue changes daily, and land cannot resize or move without reshuffling the town.
- **Distance to the nearest plot tile.** It is integer, intuitive, and gives land a real economic role: a bigger plot reaches more households. An entrance tile was considered but would have made a building's facing economically meaningful. A plot-centre distance would have made plot size purely cosmetic.
- **40×40 at 1¢ per tile.** Halving the rate while doubling the grid keeps a trip across town at about its MVP8 cost, so differences from MVP8 come from plot reach rather than from more expensive travel.
- **Plots first, then houses, from the spatial seed.** Placement stays as random and neutral as MVP8's. A zoned town (Government at the centre, a commercial ring, houses outside) was rejected because it would build a systematic pattern into who lives near which firm, a new economic assumption. Government is centred because it has no economic location, so where it stands changes only the picture.
- **A one-tile gap between plots, none around houses.** Plots never merge into one block, and households may live right beside a shop.

### Findings

Over eight seeds, measuring to a plot's nearest edge shortens customer trips by about 15% and cuts the average transport fee by the same proportion. Firms recover part of that saving as higher prices, most visibly in Utilities, which has the largest plots, and in Healthcare. Needs met, inequality before redistribution, wages paid and market-share gaps are within seed-to-seed variation. The mean applied tax rate is higher (30% against 17%), but the seed ranges overlap widely. This is a hypothesis to test with a larger ensemble, not a finding.

### Open questions

- Whether the price rise is a stable consequence of plot reach or seed noise needs a larger ensemble, ideally with plot size varied alone.
- Plot sizes are a modelling choice, not derived from anything inside the model. A later version might let land use follow from a firm's own decisions.

## [MVP8-Vision-023] - (2026-10-08)

### Problem

The project had no stated long-term direction beyond the next MVP. A discussion of what to build next started from realism: every household earns the same $10 wage, so market income is identical and almost all inequality comes from location and prices. One option was firm ownership with dividends, replacing the 100% profit tax. That led to a broader question: could the same engine represent economies from feudal societies to modern ones? The owner then sharpened it. The engine should not encode any particular institution, such as serfdom or democracy. Institutions should emerge from agents' decisions, starting from a very basic economy, and the engine should later extend to politics and culture.

### Decisions

- **A vision document, not a specification.** [docs/VISION.md](docs/VISION.md) records the direction so later work has a reference point. It is explicitly non-authoritative: the MVP specifications still define behaviour, and the design rules still define method. Nothing in it is implemented.
- **Primitives, not institutions.** The engine should contain only primitives, such as control of land, need for food, cost of exit, claims on output and sanctions. Institutions are recurring combinations of those primitives. The document sets out four layers: physics and accounting fixed by the engine, rules created and enforced by agents, and agents acting within both.
- **Rules as data, using an existing grammar.** Crawford and Ostrom's (1995) institutional grammar (attributes, deontic, aim, conditions, or else) was chosen as the reference representation because one structure expresses a feudal due, a wealth tax and a minimum wage alike. It also keeps every institution inspectable, with a history.
- **Institution labels belong to the observer.** The engine never names "feudalism". An observer classifier may, which keeps institution labels as measurements (design rule 18).
- **The ownership step was set aside.** The owner asked to drop the ownership implementation from this discussion. It is not part of the vision's incremental path, which instead starts by re-expressing the existing fiscal phase as rule objects and deriving the Government's objective from household preferences.
- **Validation through theory, not aesthetics.** Emergent outcomes have no single analytical benchmark, so the document names theoretical predictions the engine should reproduce without hard-coding them, chiefly Domar's (1970) hypothesis on land abundance and bound labour, plus Malthusian dynamics.

### Trade-offs

- A small rule grammar limits what can emerge. A large one gives bounded learners a search space they cannot navigate. The document recommends starting small (design rule 12).
- Every starting point is an assumption. Keeping money fixed and given, for example, rules out histories without money. The document asks for such choices to stay visible as choices, not for all of them to be removed.

### Open questions

- What is the smallest rule grammar that can express both the current fiscal phase and a feudal due?
- How do agents learn which rules to prefer without knowing their aggregate consequences (design rule 1)?
- Births, deaths and inheritance are probably required before dynastic wealth can emerge, and may be a larger engine change than the rules layer itself. Where should they come in the sequence?
- At what point does a simulated day stop being the right unit of time?

## [MVP8-Ensembles_Showcase-022] - (2026-10-08)

### Problem

Every Research result described one seed. Seeded runs are reproducible but path-dependent, so a single trajectory cannot tell a robust effect from a seed-specific one. Separately, the README made a visitor install the project before seeing what it does.

### Decisions

- **Order independence by construction.** Floating-point sums depend on order, so even a mean could differ by an ulp if seeds were summarized in arrival order; parallel workers finish in any order. The ensemble therefore keys results by seed and always summarizes in ascending seed order. Tests check exact equality under reordering.
- **Seed sets.** The first seed is the current base seed, so an ensemble always contains the single-seed run it extends. The rest are `mixSeed(base + i)`, because the market stream feeds a raw seed straight into a linear xorshift generator, and neighbouring integers would start from nearly identical states. The seeds are shown in the per-seed table.
- **Statistics.** Mean, sample standard deviation (n − 1), type-7 interpolated p10, median and p90, and range. These are descriptive only. With 4–16 seeds, no confidence intervals or significance tests are claimed.
- **Metrics.** Each ensemble reports the outcomes its single-seed card already shows, so the two can be read side by side: completion, inequality, wealth tax and share volatility at both scales; the Government's tax rate, equality, inequality and completion against no Government; and lead changes, ties and share asymmetry across markets.
- **Parallelism.** One seed costs about 2.5 s for the scale comparison, 4 s for Government and 1.9 s for competition. A pool of up to four workers runs an 8-seed scale ensemble in about 4 s instead of about 20 s. The pure `runEnsemble` stays sequential for tests and scripts.
- **Screenshots.** Captured with the project's Playwright driving the locally installed Chrome (no browser download), at 1440×900 and 2× pixel density, after 45 simulated days on the canonical seed. The capture exposed a firm-card overflow ("of 10 × $10" spilling out of its box), which was fixed rather than cropped around.

### Observations

On 8 seeds from the canonical base seed, two findings are robust and one is strongly path-dependent:

- The 100-household economy met more needs than the 10-household one on every seed: +0.8 to +4.6 percentage points, mean +2.5.
- With the adaptive Government, mean post-fiscal inequality stayed between 0.0004 and 0.0010 on every seed.
- Without a Government, mean inequality ranged from 0.08 to 0.63, and needs met from 83% to 97%, depending on the seed.

These are descriptive results from one 8-seed set.

## [MVP8-Structure-021] - (2026-10-07)

### Problem

Phase 3 of the audit backlog was structural: no formatter or linter, a ~290-line `stepSimulation`, field names left over from earlier MVPs, quadratic per-day work, an undocumented clearing rule, and code that assumed exactly two firms per industry.

### Decisions

- **oxlint instead of ESLint (#38).** The issue named ESLint with typescript-eslint, but typescript-eslint supports only TypeScript `<6.1`. The project uses TypeScript 7, the native compiler, which exposes no JavaScript compiler API (`require('typescript').createSourceFile` is undefined), so ESLint could not parse the source. Installing a second TypeScript just for linting was rejected. oxlint parses TypeScript natively and implements the same correctness, typescript-eslint and react-hooks rules. On top of oxlint's correctness category, typescript-eslint's recommended rules are enabled explicitly; oxlint leaves some of them, such as `no-explicit-any`, outside that category. The only file exempt from `no-explicit-any` is `WorldView.tsx`, which imports Three.js from a CDN at runtime without type definitions. A deliberately broken probe file confirmed the configuration reports conditional hooks, missing effect dependencies, unused variables and explicit `any`. Four unicorn style rules were turned off as noise (`no-array-sort`, `no-array-reverse`, `consistent-function-scoping`, and `require-post-message-target-origin`, which misfires on Web Worker `postMessage`). The lint pass found real issues: unused imports and parameters, expression statements used as control flow, and React refs written during render (moved into `useState` and a layout effect).
- **Line endings.** The repository stores LF, but Git for Windows (`core.autocrlf=true`) checks files out as CRLF, which made the LF Prettier check fail locally on 72 files after a stash round-trip. Two fixes were considered. `endOfLine: auto` silences the check but stops enforcing line endings at all. A `.gitattributes` with `eol=lf` makes every checkout LF regardless of client settings, so the check stays strict. The second was chosen; it changes no repository content.
- **Explicit Prettier targets.** `prettier --check .` walks every directory before applying `.prettierignore`, so an unreadable local folder fails the check. Claude Code's protected `.claude/` folder did exactly that in agent sessions, which AGENTS.md routes through `npm run agent:check`. The scripts therefore name their targets (`src scripts .github "*.{json,ts,mjs,html}" ".*.json"`); a file-by-file comparison confirmed they cover the same 79 files that `.` matched.
- **Phases keep the RNG order (#38).** Pricing decisions draw from the market RNG between one industry's clearing and the next industry's shuffle. A separate pricing phase after all markets would have changed every trajectory, so `decidePrices` runs inside the per-industry loop.
- **Bit-for-bit verification.** Before the engine changes, complete states for six configurations were captured, including N=10, N=200 and runs with every probe and Government trial forced on. After the refactor, a normalizer mapped renamed fields back to the old shape, and every snapshot matched exactly, events included. Every sum that changed order is over integer cents. The sorted Gini computes exactly the same integer numerator, so it returns the same bits; Government compares Gini values to adopt policy, so anything less would have changed trajectories.
- **N firms (#36).** The fallback key was "distance to the other firm". The general form is the distance to the next-best firm by delivered cost, which is the other firm when there are two. A probing firm previously observed "the first other firm's" price; it now observes the lowest rival price, which is identical with two firms and is the natural anchor for a competitor-match experiment. The firm count comes from config (`firmsPerIndustry`), and employment blocks, invariants and population validation derive from it. A three-firm economy needs blocks of 14 households.
- **UI scope (#36).** The observer was designed around A vs B. Rather than a redesign, every component now maps over the firms in a market, and colours come from a slot-indexed palette whose first two entries are the existing teal and coral. The canonical display is unchanged, which was checked in the browser: tiles, cards, share bars, charts, the market map, the 3D legend and the inspector text. A three-firm market is covered by view-model tests, since the UI exposes no control for market structure. Research harnesses that are explicitly "Firm A vs Firm B" experiments on Entertainment (the competition grid, the spatial competition probe and the generalized spatial analysis) keep their two-firm definitions.
- **Clearing rationale (#40).** The MVP4 notes record why the nearest households get inventory first and why ties are seeded, but not why the overflow is ordered by distance to the alternative. The architecture guide says so rather than inventing a reason.

### Measurements

A single warm run of each, on the development machine: canonical N=100 step 1.98 → 1.67 ms; N=1,000 (40×40 grid) step 37.4 → 27.2 ms.

## [MVP8-Maintenance-020] - (2026-10-07)

### Problem

Four maintenance issues: toolchain drift from `latest` specifiers, config fields that compiled but did nothing, population errors that surfaced deep in setup, and tests that asserted on source text. They come before adding a formatter and decomposing `stepSimulation`, because text assertions would break on any reformat.

### Decisions

- **Pinning (#33).** Caret ranges of the locked versions, so `npm ci` installs exactly what it did before; a major upgrade now has to appear in `package.json`. The regenerated lockfile only gained `dev` flags. Automated upgrade PRs (Dependabot or Renovate) were left out, because they add standing repository automation and that is the owner's call.
- **Playwright in the lockfile (#33 follow-up).** The browser-check workflow installed Playwright ad hoc with `--no-save --package-lock=false`. With caret ranges in `package.json`, that hit an npm 10 crash (`Cannot read properties of null (reading 'edgesOut')` in `#loadPeerSet`, while resolving vitest's optional peers). Reproduced locally: `main`'s `latest` specifiers passed, and pinned ranges failed whether or not the tooling moved to `devDependencies`. Skipping peer resolution avoided the crash, but without a lockfile npm re-resolved the whole tree and installed newer Vite (8.3.3) and React (19.3.0) after `npm ci`, so the preview would run untested versions. Adding `playwright@1.55.0` as an exact devDependency fixes both problems. It adds only Playwright's own packages to the lockfile and runs no install script; browsers are still downloaded only by `npx playwright install`.
- **Dead config (#32).** Removing the fields lets the type checker catch stale callers. That surfaced one misleading test, the "scarce markets" grouping test, which passed `dailySupplyPerIndustry: 4` and expected scarcity that never happened. Its assertions still hold without the field. The pricing probe's result also echoed the ignored supply value, so it was dropped from the result shape.
- **Validation (#35).** The engine clamps most numeric fields for programmatic callers, but a clamped population is a different experiment, so `householdCount` now fails loudly. Grid dimensions keep their existing clamp and round, and the capacity check runs on the resolved values. The deeper checks in `assignEmployment` and `generateSpatialLayout` remain as defensive invariants.
- **Behavioral tests (#39).** Each text assertion was mapped to the behavior it protected. Absence of `Math.random` became a stub that throws; this covers every module the engine reaches, not just the four files that were scanned. The pricing-boundary regex became argument inspection of the strategy's real calls, which still catches a leak if a field is renamed or reached through a nested object. The issue counted 13 assertions; 10 remained on `main`, and all were replaced.

## [MVP8-Audit_Fixes-019] - (2026-10-07)

### Problem

An audit found five defects in the research analytics and event ledger, none of which changed simulation behavior. The analytics fixes matter before multi-seed ensembles (#3): an ensemble would aggregate the same errors across every seed.

### Decisions

- **Event trimming (#31).** `pushEvent` spliced the 1,600-event array on every push once it was full, so each day paid about 1,150 array shifts. Nothing reads `state.events` during a step, so trimming once at the end of `createSimulation` and `stepSimulation` keeps the same newest 1,600 events. Measured on the canonical seed over 1,000 days after a 300-day warm-up: 4.87 ms → 1.73 ms per step. The suite fell from about 70 s to about 30 s, mostly from the two 10,000-day tests.
- **Cash bins (#14).** Every bin is now half-open over integer cents, and labels state the inclusive upper cent (`$1–$4.99`). Exactly $50 falls in `$50+`, so the canonical day 1 is fully represented.
- **Extreme days (#15).** Richest and poorest now compare balances with that day's maximum and minimum. Fractional ranks stay in use for mean rank and top/bottom-3 fractions, where tie-averaging is the intended meaning.
- **Top-1% share (#16).** The top `p` of `N` households is `pN` households, with the boundary household counted in part. Alternatives were relabelling N=10 as "richest household" or dropping the metric at N=10. The fractional definition keeps one comparable column and leaves the top-10% values unchanged, because `0.1 × 10` and `0.1 × 100` are whole.
- **Failure counts (#30).** Failure causes are now counted when they happen and stored on `DayMetrics`. A cash failure is any affordability failure whose cheapest delivered cost is within the category budget. That matches the old event filter, because the cheapest firm would otherwise have been affordable. Over 1,000 days at N=10 and N=100 for three seeds, the new counts matched the old event-based counts exactly. Policy adoptions and rejections come from `government.policyStatus` and `lastExperimentOutcome`, which are set on the day an experiment is judged.

### Open questions

- `employmentDynamics.ts` and `governmentExperiment.ts` still classify failures from `state.events`. That is safe at N=100, but they would undercount at larger populations in the same way. They could read `purchaseFailuresByCause` or per-household outcomes instead.

## [MVP8-UI_Redesign-018.1] - (2026-10-07)

### Observations and decisions

- On day 0 every household holds $50, yet the 3D map showed visibly different pillar heights. The cause was camera perspective with a 40° field of view: nearer pillars looked taller. Height is the map's only encoding of cash, so this was misleading. The camera now uses 26° from further away.
- Post-redistribution cash is nearly uniform under the canonical Government, so a map sized by it shows almost nothing. Defaulting to pre-tax cash shows where the market alone left people; the toggle shows Government's equalizing effect.
- The household ledger depends on three identities verified across 80 simulated days with no exceptions: opening = closing − net change; opening + wage − spending = pre-tax cash; pre-tax − tax + transfer = closing. These are now covered by tests, so the ledger will flag any future accounting drift.
- The 2D market map makes the delivered-cost rule visible: dots on Firm A's side are nearly all teal, and the exceptions (stockouts, budget limits) stand out.

## [MVP8-UI_Redesign-018] - (2026-10-07)

### Problem

An audit of the observer found that it read as a lab notebook, not an instrument. Five tabs split content arbitrarily: Overview and Government repeated the same two charts, and the 3D map was buried under a 100-row table. Ticket codes and methodology prose were the primary copy. The UI had 15 font sizes, mostly 9–13px, with secondary text below AA contrast. One accent colour meant brand, selection, Food Firm A, and households at once. Two reset buttons behaved differently from what their note claimed, and experiments froze the page for about 2.7s.

### Decisions

- **Show the economy, not the ledger.** Probing a canonical run showed that by the end of each day Government returns all cash to households and firms hold nothing, so end-of-day stocks are nearly flat. The informative views are the **within-day flows** (spending, wages, profit tax, wealth tax, transfers) and the **pre-redistribution distribution**. The money-circuit diagram and the before/after distribution chart were designed around that observation.
- **Progressive disclosure.** Headline numbers are visible; explanations live in ⓘ tooltips; raw events, per-household research tables, and legacy diagnostics sit behind disclosures. Nothing was deleted from the observable surface except duplicated views.
- **One colour language.** Firm A/B keep the same two colours in every market, so "A vs B" reads the same everywhere and industries need no colours of their own. Lime is reserved for the primary action and the current selection.
- **Unified map state.** The territory industry and the inspected purchase industry were independent and could disagree; there is now one selector, and selecting a firm moves to its market.
- Experiments run in a Web Worker; large unused payloads (`observations`, terminal states) are dropped before the hand-off.

### Trade-offs and open questions

- Three.js still loads from a CDN at runtime, so the map needs a network connection; the rest of the UI works without it.
- Household pillar height still encodes post-fiscal cash, which is close to uniform under an equalizing Government. A toggle to show pre-fiscal cash on the map might be more revealing; it was left out to keep the map controls minimal.
- The highlight feed summarizes price-test outcomes, policy trials, and missed purchases; other event types remain available only in the full log.

## [MVP8-Settings_Validation-017] - (2026-10-07)

### Problem and decision

Settings parsing used `Number(value || 0)` followed by clamping. Text that is not a number became `NaN`, which `Math.max` does not clamp: Reset threw inside the click handler after pausing the run, and a non-numeric transport rate failed only on the first step. Seeds were worse because they failed silently. `normalizeSeed` remapped `NaN`, `0`, and values above 32 bits, so a run could be labeled with one seed while using another, the same provenance failure as #12.

Parsing now converts text to integer cents exactly (no floating-point rounding of typed amounts) and rejects anything it would otherwise have to clamp or remap. Valid inputs map to exactly the configuration the old parser produced, so the canonical trajectory and every previously valid setting are unchanged. Engine-side clamping for programmatic callers is deliberately left as it was.

## [MVP8-RNG_Streams-016] - (2026-10-07)

### Problem

Government was documented as having a dedicated RNG substream, but `deriveGovernmentPolicySeed` and `deriveSpatialSeed` both XORed the master seed with `0x9e3779b9`. For every non-zero seed they returned the same value (canonical `20260813` → `2667732596`). Government's experiment-probability checks, candidate selection, and water-filling remainder order therefore replayed the exact sequence that placed households and firms on the grid. Policy timing was a deterministic function of geography, which violates rule 21's stream-independence assumption and would bias seed-to-seed and ensemble comparisons.

### Decision

Choosing a different XOR constant would remove the equality but not the dependence. xorshift is linear over GF(2), so streams seeded `s ^ c1` and `s ^ c2` differ at every step by `Mⁿ(c1 ^ c2)`, a pattern that is the same for every seed. The Government seed is now the salted normalized master seed passed through `mixSeed`, the murmur3 `fmix32` finalizer: a nonlinear 32-bit bijection. Only the Government stream moves. Spatial, employment, payroll, market, and probing streams keep their derivations, so layouts and employment are identical for existing seeds.

### Impact on recorded results

All Government figures recorded under MVP6–MVP8 (008, 008.1, 009, 010.x, 011) were measured with the shared stream. They remain as historical observations of that code and are not rewritten. On canonical seed `20260813` over 1,000 days at N=100, the mean applied wealth-tax rate moved from 25.085% to 17.422%, experiments from 105 to 111, adoptions from 60 to 72, the terminal incumbent from 45% to 23%, and mean cash Gini from 0.00302 to 0.00038.

The 010.x N=10 versus N=100 comparison changes qualitatively. Mean cash Gini now falls from 0.00175 to 0.00038 instead of rising from 0.00198 to 0.00302. Effective-equality occupancy is 85.4% versus 82.6%, and equalizing-mode occupancy falls slightly (14.3% versus 13.6%) instead of rising. The mean applied wealth tax still roughly doubles (8.899% to 17.422%), experiment occupancy still rises (7.0% to 11.1%), and the corporate financing share still falls (54.217% to 35.168%). Wage and market metrics are unchanged because they precede the fiscal phase. These are single-seed results; that a single stream correction reverses the sign of the cash-Gini scaling reinforces the need for multi-seed ensembles (#3) before reading population-scaling effects as findings.

## [MVP8-Simulation_Runner-015] - (2026-09-06)

### Validation boundary

The `SimulationRunner` change solved the architectural cause of the fast-mode pause problem, but unit-level equivalence and scheduler tests alone could not permanently prove that the production browser remained responsive. A regression in React integration, production bundling, or event-loop behavior could reintroduce the user-visible failure while pure simulation tests stayed green.

A focused Playwright smoke test now treats browser responsiveness as a durable validation boundary. It loads the production build at canonical N=100, starts 100× mode, verifies visible progress, requires Pause to become observable within 1.5 seconds, and confirms the visible simulation day stops advancing afterward. The threshold is intentionally looser than the approximately 500 ms review measurement so ordinary CI variance does not turn the check into a timing-flake detector.

The browser dependency is intentionally not folded into `npm run check`: local deterministic simulation validation remains lightweight, while GitHub Actions owns the heavier production-browser regression. This update adds validation infrastructure only and does not change economic behavior.

## [MVP8-Simulation_Runner-014] - (2026-09-05)

### Problem and architecture decision

The August 14 browser validation exposed a real separation-of-concerns failure: at canonical N=100 and maximum speed, repeated `stepSimulation()` work inside React state updates could occupy the main thread long enough that automated interaction with Pause was delayed. The economic step itself was deterministic, but execution cadence and observer rendering were coupled too tightly.

`SimulationRunner` now owns runtime stepping outside React's state-updater batching. It schedules one complete economic day at a time, yields control between days, and publishes only the latest completed state at a bounded observer cadence. Pause, speed changes, reset, and teardown invalidate obsolete scheduled work. This preserves the model's sequential day semantics while making React an observer of completed states rather than the owner of the simulation clock.

### Validation and interpretation

Focused tests compare runner output with direct sequential stepping and cover cancellation, speed changes, reset synchronization, and render-cadence independence. `docs/VALIDATION.md` deliberately preserves the August 14 pause-delay result as evidence about the pre-fix architecture; it is not rewritten as if the runner had existed during that historical validation.

## [MVP8-Spatial_Affordability-013] - (2026-09-02)

### Observer correctness

Market-open affordability is an observer metric, but in a spatial market it must use the same economic cost concept that defines whether a supplier is actually reachable within a household's limits. The prior calculation compared household cash/budget with the cheapest posted sticker price. That ignored transport fees and could count a household as affordable even when every available firm's delivered cost exceeded its opening cash or category budget.

The corrected metric asks whether each household has at least one industry firm whose posted price plus household-specific transport fee fits both constraints. Purchase behavior itself already used delivered cost; the defect was therefore in measurement/interpretation rather than household choice.

### Historical boundary

Research summaries or screenshots generated before this correction should be interpreted as containing the old sticker-price affordability observer. The fix should not be used to silently reinterpret those historical measurements as delivered-cost affordability.

## [MVP8-Documentation-012] - (2026-09-01)

### Documentation source-of-truth repair

Architecture and validation documentation still mixed older N=10/MVP2 assumptions with the implemented MVP8 model. The September documentation pass made `SimulationConfig.householdCount` explicit as the population authority, documented canonical N=100 employment/production and population-derived money, described cash-constrained payroll and residual-profit taxation, and separated historical MVP2 validation statements from current runtime invariants.

This was a documentation correction rather than a model change. The value is interpretive: later readers should be able to distinguish historical stage-specific evidence from properties of the current simulation instead of treating superseded cardinalities or settlement rules as current behavior.

## [MVP8-Population_Scaling-011] - (2026-08-30)

### Research-metric correctness

The population-scaling harness is intended to report normalized statistics over the complete requested horizon, while interactive `state.metrics` is intentionally bounded to keep runtime history finite. `transportRevenuePerHouseholdCents` accidentally crossed that boundary: it was computed from retained `state.metrics`, so horizons longer than `MAX_HISTORY` summarized only the retained tail even though the rest of the scale experiment accumulated full-horizon quantities directly.

The fix uses the transport-revenue accumulator already collected during every experiment day and divides it by the requested horizon and household count. A regression explicitly runs past `MAX_HISTORY`, establishes that the retained-window average differs from the complete-horizon value, and verifies that the reported scale metric matches the complete horizon.

### Historical interpretation

The correction changes how that research metric is measured, not the underlying simulation trajectory. Results produced before 2026-08-30 retain their historical provenance and should not be described as though they were generated by the corrected full-horizon implementation.

## [MVP8-Population_Scaling-010.2] - (2026-08-17)

### Infrastructure refinement

The population-scaling implementation is behaviorally unchanged. This refinement adds an agent-oriented validation path so Codex runs retain the existing typecheck → test → build semantics without flooding the terminal with compiler, test-runner, and bundler output. Each stage writes directly to an overwritten, Git-ignored log, and the wrapper stops at the first failure while exposing only a small diagnostic excerpt and the relevant log path.

`AGENTS.md` establishes the repository workflow: use `npm run agent:check` for final validation, inspect only the failed log when diagnosing, and leave the normal human-visible `npm run check` path intact. The second TypeScript compilation inside `build` remains deliberately preserved.

### Validation and limits

`npm run agent:check` passed typechecking, the complete test suite, and the production build. Successful runs produce only stage timings and a final result in the terminal; detailed output remains available in `.agent-logs/`. No simulation behavior, tests, validation semantics, or application functionality was changed. A separate intentional failure-path test was not performed.

## [MVP8-Population_Scaling-010.1] - (2026-08-14)

### Motivation and problem

The original single-page observer worked while the model had few agents and experiments. At N=100, live markets, employment/payroll, Government, geography, repeated firm charts, long-horizon research, configuration controls, and a 100-household observer formed one vertical report. Live operation and historical diagnostics competed for attention, low-frequency initialization inputs occupied the primary control surface, and household inspection required scanning dense unfiltered output. The UI also used “Profit” for both the price learner's zero-cost revenue signal and MVP7 residual post-payroll profit.

A positional `.market-overview tbody tr:nth-child(5)` rule silently hid whichever economic row happened to render fifth. Presentation must never infer semantic identity from row position.

### Design decision and observer hierarchy

The application now uses Overview, Markets, Households & Labor, Government, and Research. Overview answers economy-wide current-state questions. Markets joins one selected industry's state, pricing intelligence, price trajectory, operating-earnings trajectory, and capacity flow. Households & Labor combines all nine firms' payroll, a bounded searchable/sortable 100-household table, and unchanged geography. Government contains live fiscal state and distribution charts. Research contains explicit user-triggered population, employment, Government, competition, and labelled legacy diagnostics.

This establishes `summary → domain detail → individual inspection → research analysis`. Hidden tabs are unmounted, preventing zero-width charts and avoiding expensive hidden household, map, and research rendering. Simulation settings are collapsible and group A/B starting prices by industry; their draft/apply-on-reset semantics are unchanged.

### Terminology and economic boundary

Observer copy calls legacy `preTaxProfit` **operating earnings**, the pre-payroll zero-cost signal used by the unchanged learner. **Residual profit** identifies revenue remaining after actual payroll and before fixed corporate-profit tax. Internal behavioral fields were not renamed.

This refinement changes React state, markup, CSS, and observer organization only. Tab selection, industry selection, settings expansion, search, and sort neither enter simulation state nor consume RNG. Economic rules, ordering, seeds, configuration parsing/clamping, fast-mode batching, accounting, and trajectories remain unchanged.

### Validation

`npm run check` passed 94 tests across 17 files, TypeScript checking, and the production build. Canonical seed `20260813` produced identical state through the reset configuration values used by the UI. Presentation coverage verified 100 households before filtering, ID/employer search, deterministic non-mutating sorting, all nine firms including fifth-row Transport, and unchanged reset-path determinism.

At 1,280px and 390px, all five tabs remained within the page width. Wide market, household, research, and map surfaces scrolled internally. The live Households & Labor surface exposed 100 household rows and 108 map entities; Simulation settings exposed all eight independent firm-price inputs on mobile. No browser console warnings or errors were recorded, and active-tab mounting produced no Recharts sizing warnings.

Fast mode remained economically unchanged and advanced to day 280 during the browser run. At that point continuous N=100 stepping could temporarily delay browser-driver interaction with the pause control, confirming the existing practical UI contention under sustained maximum speed. No batching or execution semantic was changed in this presentation refinement.

## [MVP8-Population_Scaling-010] - (2026-08-14)

### Design rationale

With N=10, one household represents 10% of consumer demand. A single location, affordability boundary, employer, or tie-break can therefore move firm market share and revenue in ten-point increments. MVP8 tests whether prior behavior survives when one household represents 1%, without adding a labor, firm-entry, capital, preference, or policy mechanism.

The number of firms remains fixed deliberately: the research question is how the same institutions serve a larger population. Employment and production scale tenfold so supply capacity per household is preserved. Total money and payroll also scale tenfold. Individual cash, budgets, wages, prices, productivity, transport cost, and desired product units do not change because this is population multiplication, not nominal recalibration.

The 20×20 grid was retained because 108 spatial entities fit uniquely. Higher density is part of the treatment. Employment remains non-spatial and deterministic through its isolated subseed.

### Experiment and observations

The canonical seed `20260813` was run for 1,000 days at N=10 and N=100 with proportional money, employment, production, and payroll. Raw totals are not treated as evidence of behavioral change; comparisons below use rates, per-capita measures, and trajectory volatility.

Purchase completion increased from 92.278% to 95.404%. Food, Utilities, and Healthcare completion rose to 96.126%, 97.426%, and 95.263%; Entertainment fell slightly from 93.290% to 92.801%. Mean purchased distance declined from 10.261 to 9.807 tiles and mean transport fee from 41.04¢ to 39.23¢.

### Finite-population results

Market-share volatility fell from 0.1956 at N=10 to 0.0560 at N=100. Exact 0%/100% firm-share observations fell from 3.725% to 0.075%. Mean tested price fell from $3.272 to $3.020 and the observed price range narrowed from $6.50 to $5.85. These measurements support the finite-population hypothesis: larger demand produced smoother shares and fewer extreme competitive outcomes, without eliminating competition or price experiments.

The result is not uniform improvement. Aggregate payroll fulfillment decreased from 88.037% to 87.200%, although incomplete firm-day occupancy fell from 41.978% to 36.289%. Per-household residual profit declined from $4.771 to $4.316 per day.

### Entertainment payroll and structural persistence

Entertainment payroll failure persisted at N=100. On the terminal observed day, Entertainment A/B fulfilled 63.00%/58.52% of payroll, while all Food, Utilities, and Healthcare firms fulfilled payroll. Transport fulfilled 77.24%. Entertainment completion remained high, but its fixed category ceiling, spatial transport component, and split competitive revenue still left firm revenue below contractual payroll.

Scaling greatly reduced extreme share swings, yet did not cure Entertainment payroll. The failure is therefore not solely an N=10 granularity artifact. Discreteness amplified competitive unevenness, while the category-revenue ceiling, delivered-cost allocation, and two-firm split remain structural constraints.

### Distribution, Government, and interpretation

Mean cash Gini moved from 0.00198 to 0.00302 and wage Gini from 0.09118 to 0.09413. Effective-equality occupancy declined from 85.8% to 79.3%. Mean applied household wealth tax rose from 9.392% to 25.085%, equalizing-mode occupancy from 12.8% to 16.5%, and experiment occupancy from 7.8% to 10.5%.

Corporate tax financed 52.916% of redistribution at N=10 but 27.391% at N=100 because wealth-tax receipts per household rose strongly. This is counterintuitive given smoother markets: finer household heterogeneity reduced competitive granularity while creating a distribution with more cent-level variation for the existing one-cent equality target and adaptive policy to manage.

### Performance and limitations

The 100-household engine remained deterministic and practical, but research runs became materially slower because each day performs roughly ten times as many household market, spatial, payroll, tax, and redistribution operations. The 1,000-day N=10/N=100 comparison completed in about 15.5 seconds in validation. The canonical 10,000-day invariant run remained within the test allowance, and interactive histories stayed bounded.

N=100 is still a finite sample on one fixed grid and firm topology. The comparison changes household coordinates and employment assignment consistently from the same seed; it is not a nested sample or causal estimate of population alone. Terminal firm fulfillment values illustrate the final day and remain secondary to full-trajectory statistics. No observed result justifies changing wages, budgets, geography, pricing, or Government behavior within MVP8.

## [MVP7-Wages_Profits-009] - (2026-08-14)

### Problem and research objective

MVP5 made production income explicit but distributed every firm's complete daily revenue as wages. That closed the monetary circuit while making revenue, labor income, and profit the same accounting quantity. MVP7 separates them without pretending that a labor market already exists:

```text
firm revenue → fixed contractual payroll → residual profit
residual profit → fixed corporate profit tax → Government
household wealth tax → Government
combined Government balance → poorest-first redistribution
```

Employment remains the fixed seeded assignment: one worker at each consumer firm and two at Transport. The update does not add hiring, firing, vacancies, job search, worker mobility, employer choice, or wage negotiation.

### Wage choice and payroll boundary

Every worker receives a fresh $10 contractual obligation each day. The value is exogenous and deliberately not calibrated after observing results. Actual payroll is bounded by current firm cash, cannot borrow against future sales, and cannot make a firm negative. Unpaid wages are therefore a daily measure of contract non-fulfillment, not a debt stock.

When a firm cannot cover multiple workers, available cents are divided as evenly as possible through the existing independently derived payroll order. This preserves reproducibility without consuming spatial, market, price-learning, or Government RNG streams.

Wages remain fixed because firms currently have bargaining agency while workers do not. Allowing profit-seeking firms to choose wages before workers can reject offers or leave employers would mechanically reward wage reductions; that would be a one-sided optimization rule rather than a labor-market result.

### Profit, taxation, and monetary closure

Residual profit is firm cash after contractual payroll. Firms cannot retain it in MVP7 because there is not yet any investment, capital purchase, input payment, dividend, or credit channel returning retained liquidity to households. Persistent retained firm cash would therefore drain the household side of the fixed $500 circuit mechanically.

Government temporarily taxes residual profit at 100%. This is an accounting-closure mechanism, not a realistic corporate-tax recommendation and not a parameter learned by Government. It makes profit independently observable while returning all residual liquidity to households. The adaptive MVP6 household wealth tax remains a separate distributional instrument and continues using post-payroll household cash as its base.

Both receipt sources enter the same deterministic poorest-first water-filling stage. Separate source accounting is retained even though Government redistributes one combined balance and ends every completed day at zero.

### Compatibility and information boundaries

The existing price learner still evaluates the same pre-payroll zero-cost operating outcome at the same lifecycle point. Its legacy `preTaxProfit` field remains behaviorally unchanged to avoid altering price trajectories under the guise of an accounting update. MVP7's new residual-profit fields are the observer-facing profit measure after payroll.

Production, household choice, transport pricing, competition, spatial layout, Government experimentation, and fixed employment are otherwise unchanged. No wage arrears, retained earnings, dividends, capital, bankruptcy, credit, or new Government objective was introduced.

### Canonical 1,000-day findings

Seed `20260813` generated $100,000.00 of contractual payroll, $88,037.35 of actual wages, and $11,962.65 of unpaid wages, for 88.037% economy-wide fulfillment. Residual profit and corporate profit tax were both $47,705.36. Household wealth tax contributed another $42,447.67, so Government redistributed $90,153.03: 52.916% financed by corporate tax and 47.084% by household wealth tax.

Consumption completion was 92.278%. Mean completed-day cash Gini was 0.00198, mean wage-income Gini was 0.09118, and effective equality occupied 85.8% of days. The applied household wealth-tax rate ranged from 0% to 100% and returned to a secondary terminal value of 0%; the trajectory, not that endpoint, is the relevant result.

Firm outcomes were heterogeneous. Food A/B fulfilled 96.588%/95.730% of payroll and produced $18,111.89/$18,568.05 of residual profit. Utilities A/B fulfilled 90.483%/92.325%; Healthcare A/B fulfilled 96.100%/94.604%. Transport fulfilled 75.746%, while Entertainment A/B fulfilled 87.435%/75.615%. Transport and both Entertainment firms had incomplete payroll on all 1,000 days and generated no residual profit; Food generated most corporate-tax receipts.

These outcomes were documented rather than used to adjust the $10 contract. They show that a uniform obligation can have sharply different realized coverage across the existing revenue structures.

### Validation, limitations, and next boundary

Same-seed 1,000-day reports reproduced exactly. Existing alternate-seed checks remained active. A 10,000-day canonical stress run conserved exactly $500, kept all balances non-negative, cleared every firm and Government balance after completed days, and retained bounded live histories. Desktop and 390-pixel mobile rendering had no page-level overflow or console errors.

The corporate tax removes all retained-firm-wealth dynamics by construction, and the fixed wage does not model bargaining, reservation wages, productivity differences, or labor reallocation. Profit is meaningful as a daily operating residual but cannot yet fund investment. The next justified expansion is a genuine labor market with symmetric worker exit/choice before firms receive wage-setting freedom; retained earnings should wait until capital or another explicit recirculation channel exists.

## [MVP6-Government-008.1] - (2026-08-14)

### Problem and objective refinement

MVP6 could test lower rates, but preferred them only when realized Gini values were equal within `1e-12`. That floating-point tie was extremely rare and did not make Government explicitly search for the minimum tax necessary to maintain equality.

008.1 replaces that behavior with:

```text
if unequal: reduce post-fiscal inequality
if effectively equal: reduce tax while preserving equality
```

Effective equality comes from the economic stock itself: maximum minus minimum post-fiscal household cash must be at most one integer cent. This avoids inventing decimal Gini precision as an equality institution.

### Dynamic policy boundary

An unequal incumbent enters `EQUALIZING` and exposes only higher candidates from the unchanged experiment magnitudes and anchors. A strictly lower realized Gini or achieved equality can be adopted. An equalized incumbent enters `MINIMIZING_TAX` and exposes only lower candidates. A lower rate is adopted whenever its realized distribution remains within the one-cent range and rejected otherwise. Normal incumbent days re-test sufficiency, so changing market/payroll outcomes can send Government upward again. No rate is analytically solved or counterfactually tested.

### Canonical 1,000-day findings

Seed `20260813` was effectively equalized on 86.6% of days. Government spent 10.0% of observations in equalizing search and 90.0% in tax-minimization search. It ran 93 experiments, adopting 52 and rejecting 41: 44 successful downward adoptions preserved equality, all 41 rejected downward experiments broke equality, and 8 upward adoptions restored equality or improved inequality.

Mean incumbent/applied tax was 41.316%/40.305%, compared with 38.799%/39.072% in 008. The rate still spanned 0–100%; occupancy was 2.3% at 0–10%, 8.1% at 10–25%, 59.7% at 25–50%, 15.1% at 50–75%, and 14.8% at 75–100%. There were 52 incumbent changes, a longest spell of 97 days, and a secondary terminal snapshot of 30% in `MINIMIZING_TAX`. The large number of successful downward moves directly demonstrates continual boundary search; it does not prove the terminal rate optimal.

Mean pre/post Gini was 0.08808/0.00333. Purchase completion and sell-through remained 92.278%, cash-affordability failures remained zero, and mean daily operating revenue/wages remained $135.74. Exact average taxes and transfers were both $201.48/day.

### Cross-seed and stress findings

Seeds 11, 77, and 123 were effectively equalized on 79.6%, 78.0%, and 85.7% of days. Their mean applied rates were 38.270%, 27.215%, and 34.196%; successful downward adoptions were 42, 33, and 35; downward equality-breaking rejections were 47, 59, and 42; and upward adoptions were 11, 14, and 14. Terminal incumbents were 45%, 25%, and 24%, all in tax-minimization mode. Same-seed summaries reproduced exactly.

The canonical 10,000-day trajectory remained invariant-safe. Effective equality occupied 81.28% of days; mode occupancy was 15.04% equalizing and 84.96% minimizing tax. Among 1,023 experiments were 386 successful downward adoptions, 494 rejected downward equality breaks, and 143 upward adoptions. Mean applied tax was 36.502%; total money remained $500 and completed-day firm/Government cash remained zero.

### Limitation

The learner still compares realized outcomes across an evolving economy rather than controlled counterfactuals. Effective equality can fail on a deliberate lower-rate experiment day even though the equalized incumbent is restored afterward, and the coarse experiment catalog can move across the sufficient boundary rather than identify it to one basis point. These are consequences of bounded experimental learning, not an analytical optimum.

## [MVP6-Government-008] - (2026-08-14)

### Motivation and narrow objective

MVP5 removed parity redistribution. The 007.1 trajectory showed high cash concentration, low-cash occupancy, cash-affordability constraints, and a wage → cash → consumption feedback. MVP6 introduces Government as an adaptive response. Its sole objective is `minimize postFiscalCashGini`; this is not a welfare, growth, or consumption objective.

### Instrument, intelligence, and redistribution

The sole instrument is a flat tax on household cash immediately after payroll: a wealth tax, not income tax. Rates are integer basis points and liabilities floor to cents. Government starts at 0%, uses an isolated seeded RNG stream, and tests ±1/5/10/20pp alternatives plus 0/25/50/75/100% anchors with 10% daily probability after establishing a current reference. It sees administered current cash and realized outcomes, never future or counterfactual state.

All receipts return by integer water filling: raise the poorest tied group toward the next tier, then continue upward. Seeded tied-group ordering allocates indivisible cents. Equal Gini within `1e-12` prefers lower tax. Government never permanently converges.

### Pre-registered hypotheses

- Government may discover very high rates.
- Redistribution may reduce cash-affordability failures.
- Greater circulation may raise consumption and firm sell-through.
- Policy may alter wage dynamics indirectly.
- The learner may cycle rather than settle.

The implementation does not force these predictions.

### Canonical 1,000-day findings

Seed `20260813` produced 98 experiments (9.8% of days), 27 adoptions, and 71 rejections. The incumbent changed 27 times; its longest spell was 119 days and mean spell was 35.7 days. Mean incumbent/applied rates were 38.799%/39.072%. Applied rates spanned 0–100%, but occupancy concentrated at 25–50% (64.8%), then 50–75% (22.3%). The terminal 25% incumbent is secondary. No lower-tax equality tie-break adoption occurred.

Mean pre/post Gini was 0.08672/0.00186, a reduction of 0.08486. Mean richest-1/2/3 shares moved from 13.253%/26.083%/36.474% pre-fiscal to 10.088%/20.143%/30.143% post-fiscal. Government collected and transferred exactly $195.32/day on average.

Against the same-seed inactive control, purchase completion was 92.278% versus 58.925%; actual-cash failures were 0 versus 15,676. Sell-through was 92.278% versus 58.925%. Mean daily operating revenue and wages were both $135.74 versus $42.19. These are controlled simulation outcomes, not external causal estimates. Category-budget and inventory failures became more visible after cash stopped binding.

### Cross-seed and stress findings

Seeds 11, 77, and 123 produced mean applied rates 35.441%, 27.150%, and 36.737%, with terminal incumbents 25%, 23%, and 40%. Mean post-fiscal Gini was 0.01282, 0.00226, and 0.01492. Two seeds retained 150–151 cash failures while seed 77 had none. The learner did not settle generically at 100%; it mostly occupied 25–50% while continuing experiments and showing path dependence.

The canonical 10,000-day run completed with 985 experiments, 272 adoptions, exact reconciliation, and terminal incumbent 24%. Mean applied tax was 36.494%, mean pre/post Gini 0.08636/0.00180, and cash failures were zero. Total money remained exactly $500 with firms and Government at $0 after completed fiscal phases.

### Limitations

The learner compares today's experiment with a recent incumbent day while the pre-fiscal distribution evolves; it has no counterfactual identification. The fiscal system is intentionally unrealistic, cent resolution creates plateaus, a 1,000-day horizon is not convergence proof, and stronger consumption shifts failures toward fixed budgets or inventory. No consumption effect enters Government's objective.

## [MVP5-Employment-007.1] - (2026-08-14)

### Observation and analytical purpose

The first employment run produced strong endogenous divergence while conserving exactly $500. Its day-1,000 range of $0.13–$395.87 and cash Gini of 0.828 were striking, but terminal values cannot characterize the preceding path. This refinement therefore observes every day from 1 through 1,000 with no burn-in and makes the day-1,000 state explicitly secondary.

The central distinction is `wealth = completed-day household cash stock`, while `income = daily wage flow`. A household can receive a volatile wage while holding little cash, or accumulate a large cash stock from a persistent income advantage. Both require separate temporal measures.

### Feedback hypothesis and fixed employment

The measured mechanism is:

```text
firm sales → operating earnings → worker wage → household cash
→ subsequent purchasing ability → future firm revenue
```

007.1 does not intervene on this loop or claim causal identification. Fixed seeded employment is useful because each household retains one employer throughout a run, allowing employer performance, wage flow, cash stock, consumption completion, and production utilization to be compared without job mobility changing the mapping.

### Consumption constraints and analytical architecture

The report separates actual-cash failures from category-budget failures and inventory/availability failures. The engine’s decision rule is unchanged; insufficient-funds events now record the already-known cash, budget, and minimum delivered cost so the observer can identify the binding affordability constraint.

The interactive 400-day metrics and 600-event caps remain unchanged. A finite harness collects compact daily observations for exactly 1,000 days and passes them to pure post-run analytics. Exact cash ties receive fractional analytical ranks, not RNG or arbitrary ID tie-breaking. Low-cash thresholds are transparent strict inequalities rather than empirical poverty lines.

### Canonical trajectory findings

For seed `20260813`, cash Gini averaged `0.799`, ranged from `0.040` to `0.873`, and was `0.828` on day 1,000. Daily wage Gini averaged `0.346`, reached `0.658`, and ended at `0.370`. The richest household held an average `75.2%` of the money stock, a maximum `95.3%`, and `79.2%` on day 1,000. The richest two averaged `91.1%`; the richest three averaged `94.1%`.

Rank persistence was highly asymmetric. The Food B worker ranked richest on 961 of 1,000 days, occupied the top three on 99.9% of days, and changed rank only seven times. The Entertainment B worker occupied the bottom three on 93.4% of days and ranked poorest on 431 days, although 534 rank changes show that lower positions were not literally frozen. The Food A worker changed rank 294 times and occupied the top three 58.3% of days, illustrating meaningful mobility below the dominant top position.

Low liquidity was persistent for several workers. The Entertainment B worker spent 97.2% of days below $5 and had a longest below-$5 spell of 760 days; it spent 99.4% below $10. Healthcare B spent 75.1% below $5 with a longest spell of 257 days. By contrast, Food B never ended a day below $10. These are model cash-occupancy statistics, not real-world poverty measures.

### Income, consumption, and unused production

Canonical purchase completion was `58.9%`. Of 16,430 failed desired purchases, 15,676 (`95.4%`) were directly constrained by actual cash, 609 (`3.7%`) by category budgets, and 145 (`0.9%`) by inventory/availability. Prior-day cash strongly stratified next-day completion descriptively: `<$1` cash corresponded to `2.4%`, `$1–$5` to `37.7%`, `$5–$10` to `74.5%`, `$10–$25` to `95.0%`, and `>$50` to `99.5%` completion.

The descriptive Pearson correlation between cumulative wages and mean cash across the ten households was `0.696`; N=10 is tiny and no significance or causal claim is attached. Food B paid $7,498.08 and its worker completed 99.9% of purchases. Entertainment B paid $1,073.05 and its worker completed 16.7%. Transport paid exactly $9,167.44 across its two workers; their combined wages reconcile exactly to its payroll.

Every consumer firm produced 5,000 units. Sell-through ranged from 80.8% at Food B to 30.3% at Entertainment B. Across industries, substantial expiration coexisted with widespread actual-cash failures: this supports the presence of a purchasing-power feedback pattern but does not by itself identify the size of a causal effect.

### Cross-seed observations and limitations

Seeds `77` and `91` also showed severe concentration. Mean cash Gini was `0.827` and `0.844`; mean richest-one shares were `85.0%` and `87.9%`; mean wage Gini was `0.354` and `0.446`; aggregate completion was `51.1%` and `40.3%`. Actual cash accounted for 19,157 of 19,572 failures in seed 77 and 23,745 of 23,880 in seed 91. The richest household identity changed with assignment, but the Food B slot occupied the dominant trajectory in all three tested seeds.

Three deterministic seeds are not a population estimate. Rank metrics describe cash ordering rather than welfare, the cash-bin relationship is descriptive, and employer outcomes jointly reflect geography, prices, household purchasing power, and the fixed assignment. No labor mobility, wage-setting, fiscal response, borrowing, or stabilizer is introduced.

## [MVP5-Employment-007] - (2026-08-14)

### Motivation

Earlier Econ-Engine versions closed the monetary circuit through an intentionally artificial Government mechanism:

```text
household spending
→ firm revenue
→ 100% Government taxation
→ household-specific transfers restoring $50 parity
```

That institution isolated consumer-market mechanics, but it prevented firm performance from affecting household income or persistent purchasing power. MVP5 replaces it with the first production-income loop:

```text
household spending
→ consumer-firm and Transport revenue
→ wages
→ households
```

The research purpose is to observe whether employer performance creates persistent income and wealth differences, whether those differences feed back into consumption and firm revenue, and whether the closed $500 circuit remains stable without parity restoration.

### Employment simplification and information boundary

Employment is deliberately fixed to isolate the income mechanism before building a labor market. Every household supplies exactly one worker; each consumer firm has one worker and Transport has two. A dedicated subseed deterministically shuffles canonically sorted household IDs into canonical employment slots. Employment is independent of spatial placement and runtime market draws and remains fixed after initialization.

There is no unemployment, vacancy, search, employer choice, hiring, firing, quitting, negotiated wage, skill, or productivity heterogeneity. Labor can currently be supplied without a modeled commute. Firms do not observe worker wealth, household income, competitor payroll, or observer inequality analytics.

### Production

Consumer production is now causal rather than exogenous:

```text
daily firm output = worker count × 5 units per worker
```

Every one-worker consumer firm produces five units at the start of the day, preserving ten potential units per two-firm industry. Production precedes consumption and emits a structured event. Unsold goods still expire daily, so each consumer firm must satisfy `produced = sold + expired`.

Transport is the explicit exception. Its two workers participate in employment and wage accounting, but Transport remains an effectively unlimited derived service. No trips-per-worker, fleet, congestion, or labor-capacity mechanism is implied.

### Wage model and pricing timing

Workers are residual claimants on their employer’s daily revenue. This is a minimal circulation mechanism, not a mature empirical wage-setting model. After all consumer markets, Transport activity, inventory closure, and pricing updates, the firm’s entire cash balance becomes its wage pool. A one-worker firm transfers the pool whole. Transport divides its pool evenly, with any indivisible cent assigned through a reproducible seed/day/firm-specific order. Every cent is transferred through an explicit wage event; firms are not cleared by balance reset.

The pricing learner continues to optimize realized pre-payroll operating earnings. In this cost-free MVP, operating earnings equal sales revenue. Wages equal operating earnings, and retained end-of-day firm profit is zero. Payroll occurs only after the learner has consumed the operating result.

### Government, persistent wealth, and circular flow

Government remains architecturally present, but the default firm tax is zero and parity restoration is disabled. Household balances carry forward as prior cash minus consumption plus wages. Wealth divergence is therefore expected and is not an invariant failure.

Category percentage limits remain behavioral constraints derived from the fixed $50 daily expenditure base. Actual cash also binds. There are no category wallets, negative balances, debt, overdrafts, welfare transfers, or guaranteed consumption. Production creates goods, not money; expiration destroys goods, not money. Purchases, Transport fees, and payroll relocate integer cents within the fixed 50,000-cent money supply.

### Canonical 1,000-day findings

For seed `20260813`, cash Gini moved from `0.040` on day 1 to `0.828` on day 1,000, averaged `0.799` across the complete trajectory, and reached a maximum of `0.873`. Day-1,000 household cash ranged from $0.13 to $395.87. Mean end-of-day household cash remained exactly $50 because completed payroll returned all 50,000 cents to households; that aggregate identity did not imply individual equality.

Employer-linked outcomes diverged strongly over the horizon. The Food B worker averaged $374.02 in cash and completed 99.9% of desired purchases. The Entertainment B worker averaged $1.71 and completed 16.7%. These are full-horizon measurements rather than an inference from the day-1,000 snapshot.

Each consumer firm produced exactly 5,000 units over 1,000 days. Food B sold 4,041 and expired 959; Food A sold 3,486 and expired 1,514; Healthcare B sold 1,926 and expired 3,074; Entertainment B sold 1,513 and expired 3,487. Transport performed 23,570 derived trips and distributed its full $9,167.44 cumulative revenue to its two workers. Every firm’s cumulative operating earnings exactly equaled its cumulative wages.

### Cross-seed observations and feedback

Seeds `77` and `91` produced different valid employment mappings and trajectories. Their mean cash Ginis were `0.827` and `0.844`; day-1,000 Ginis were `0.771` and `0.831`. A Food B worker had the highest purchase success in both runs (99.8% and 99.7%), while low-revenue Entertainment employment was associated with substantially lower consumption success.

Across the three observed seeds, employer performance changed worker income, heterogeneous cash constrained later purchases, weaker demand increased expiration, and those sales outcomes fed back into subsequent wages. This is evidence of an endogenous feedback loop over the measured horizon, not a claim of equilibrium or a population estimate.

### Validation and limitations

Same-seed runs reproduced exactly. The canonical and alternate-seed 1,000-day experiments and the 10,000-day stress run preserved non-negative cash, exact production stock-flow identities, zero completed-payroll firm balances, zero Government cash, bounded histories, and exactly $500 total money. Desktop, approximately 390-pixel mobile, and maximum-speed browser checks completed without console errors.

The model still excludes a labor market, commuting, negotiated or fixed wages, non-labor production costs, retained earnings, credit, welfare, taxes, capital, investment, and labor-constrained Transport. Strong concentration is therefore an economic result of this deliberately sparse mechanism, not a claim about a mature real economy.

## [MVP4-Spatial_Competition_Full-006.4] - (2026-08-14)

### Analytical mistake and design response

A market observed at 100/0 on day 1,000 was being described as though it had behaved as a 100/0 market throughout the experiment. This confuses a terminal observation with a temporal property of an adaptive system. A day-1,000 snapshot can coexist with a 1,000-day average near 51/49; neither fact invalidates the other, but they answer different questions.

006.4 therefore adds a permanent design rule: dynamic claims must come from trajectories. The generalized report includes every day from 1 through 1,000, with no hidden burn-in. It measures leading and tied occupancy, mean daily share, cumulative sales share, leadership transitions, leading spells, temporary 100%-share spells, posted and incumbent price distributions, and cumulative/mean zero-cost profit. Ties pause transition detection: `A → tie → B` counts once, while `A → tie → A` does not. Analytics are observer-only and consume no RNG.

### Canonical 1,000-day findings

For seed `20260813` from equal $1 starts:

| Industry | Mean daily A/B share | A/B/tie leading days | Changes | Longest A/B lead | A/B 100%-share days | Day-1,000 snapshot |
| --- | --- | --- | ---: | --- | --- | --- |
| Food | 53.7% / 46.3% | 274 / 228 / 498 | 29 | 26 / 40 | 35 / 10 | 50% / 50% |
| Utilities | 61.5% / 38.5% | 561 / 406 / 33 | 179 | 40 / 39 | 481 / 109 | 20% / 80% |
| Healthcare | 49.4% / 50.5% | 438 / 530 / 32 | 117 | 61 / 48 | 42 / 5 | 90% / 10% |
| Entertainment | 70.0% / 30.0% | 759 / 10 / 231 | 4 | 152 / 9 | 2 / 0 | 70% / 30% |

The Utilities terminal snapshot was materially misleading if read as a run-wide result: B held 80% on day 1,000, while A averaged 61.5%, led on more days, captured 61.5% of cumulative sales, and received 60.8% of industry profit. Healthcare showed the converse form: A held 90% on day 1,000, but the full trajectory was almost even in mean and cumulative share and B led on more days. Entertainment's terminal 70/30 happened to resemble its temporal average, but its 231 tied days and four leadership changes still contain information absent from the snapshot.

Mean incumbent prices in A/B order were Food $1.36/$1.42, Utilities $0.90/$0.88, Healthcare $0.99/$1.00, and Entertainment $0.90/$0.86. Because production cost remains zero, recorded profit equals realized revenue; canonical cumulative A/B profit was Food $8,208.29/$5,883.79, Utilities $5,339.15/$3,448.23, Healthcare $5,262.76/$4,590.90, and Entertainment $6,289.08/$2,511.53.

### Alternate-seed observations and limitations

Seeds `7` and `42` confirm material path and geography dependence. Seed 7 produced persistent B leadership in Food (90.7% of days), Utilities (99.7%), Healthcare (97.3%), and Entertainment (75.4%). Seed 42 was more mixed: B led Food 69.8%, Utilities 54.6%, and Entertainment 70.7% of days, while A led Healthcare 93.2%. Across the three seeds, leadership changes ranged from 2 to 179 and longest leading spells from 9 to 831 days. Temporary 100%-share occupancy ranged from zero to 48.1% for an individual firm; this is reported as occupancy, not monopoly classification.

Three seeds are a compact deterministic comparison, not a population estimate. The full window intentionally mixes early adaptation with later behavior, and no stationarity test, burn-in selection, confidence interval, or equilibrium detector is introduced. These metrics describe the observed horizon without claiming what would occur beyond day 1,000.

## [MVP4-Spatial_Competition_Full-006.3] - (2026-08-14)

### Motivation and market structure

Entertainment showed that geography can create local market power without arbitrary product differentiation. 006.3 tests whether the same friction scales across the modeled consumer economy:

```text
4 spatial competitive industries × 2 firms
+ 1 monopoly derived Transport service
```

Food, Utilities, Healthcare, and Entertainment now share the same delivered-cost, proximity-priority, fallback, finite-inventory, and same-industry public-price experiment architecture. Government and Transport remain off-map.

### Budget model and partial basket

Authoritative fixed category dollars were replaced by a distinct $50 daily expenditure flow base multiplied by integer basis-point shares. Government's $50 household target remains a monetary stock restored after trading; the expenditure base is only the flow basis for behavioral limits. They happen to match numerically but are independently configured concepts.

Food 12.9%, Utilities 6.0%, Healthcare 7.9%, and Entertainment 4.6% derive $6.45, $3.00, $3.95, and $2.30 limits using `Math.round(base × bps / 10000)`. The four shares total 31.4% and are not normalized. The remainder represents unmodeled expenditure categories. Limits are maxima, not category wallets; unused amounts remain household cash.

Transport has no share. Its demand emerges from up to four daily round trips and revenue is separately attributable to the originating industry.

### Findings

At day 300 under canonical seed 20260813, learner incumbents were Food $2.04/$2.04, Utilities $1.36/$1.42, Healthcare $1.21/$1.20, and Entertainment $1.35/$1.10. Final shares were 50/50, 100/0, 20/80, and 50/50 respectively. Industry Transport revenue was $3.52, $4.08, $5.44, and $3.96, totaling $17.00 from 40 trips and 850 round-trip tiles.

Seeds 7 and 42 produced distinct prices, shares, and travel totals. Seed 7 generated $15.44 Transport revenue across 772 tiles; seed 42 generated $15.84 across 792 tiles. The differences show geographically distinct local customer bases and path-dependent learner incumbents, not equilibria.

### Scope

No production costs, production decisions, labor, wages, income, savings behavior, housing, credit, adaptive Transport pricing, roads, congestion, relocation, land values, quality, brands, advertising, or collusion were introduced.

## [MVP4-Spatial_Competition_Full-006.2] - (2026-08-14)

### Problem and root cause

At 100 days/second the browser crashed around 500 simulated days with `DataCloneError: structuredClone ... out of memory`, leaving React's root blank. Every economic day recursively copied the entire accumulated `SimulationState`. Once the 400-metric and 600-event histories saturated, the clone remained near its maximum size and was repeated five times per 50 ms UI interval, causing excessive allocation and garbage-collection pressure.

The runtime audit found no additional unintentionally unbounded history in the interactive state. Metrics remain capped at 400 and events at 600. Per-household counters, firm pricing state, spatial analytics, and current-day records have constant size. The finite research harness intentionally accumulates selected experiment events over its requested horizon and is outside React state.

### Architectural fix

The hot path now performs targeted immutable copying. Household objects and every mutable industry outcome, firm objects and pricing states, Government, and the metric/event array containers are copied once per step. Immutable configuration, industries, fixed coordinate objects, and existing immutable metric/event records are structurally shared. Tests verify that the supplied previous state is not mutated and that shared historical records retain reference identity.

The 100-days/second path still simulates five sequential economic days before publishing one React state. Rendering frequency therefore remains 20 updates per second while every purchase, travel payment, price decision, tax, parity transfer, invariant, and RNG draw executes normally.

### Performance principle and validation

> Once bounded histories reach capacity, simulation cost should depend primarily on model size and daily activity, not on total elapsed simulation age.

The automated 10,000-day stress run completed with exact accounting and stock-flow invariants, 400 metrics, and no more than 600 events. In the test runtime it completed in approximately 1.1 seconds. A separate 1,000-day same-seed comparison produced exactly equal complete states. The real React UI ran to day 2,510 at the 100-days/second setting—five times beyond the former failure point—with $500 displayed, all map entities present, no page overflow, and no console warnings or errors. The available browser surface did not expose precise heap profiling, so validation is limited to sustained execution and the removal of catastrophic whole-state allocations rather than a claimed byte measurement. No economic mechanism changed.

## [MVP4-Spatial_Competition_Full-006.1] - (2026-08-14)

### Problem and research question

Spatial customer switching creates discrete delivered-cost thresholds. A one-cent reduction can leave customer count unchanged, reduce revenue, and be rejected even when a larger reduction would cross several household switching thresholds and raise profit.

> Can competitor-aware, multi-scale price experimentation allow bounded firms to discover profitable pricing regions that local one-cent search cannot reach?

### Information expansion

Entertainment firms may now observe the competing firm's currently advertised sticker price as plausible public market information. They still cannot observe competitor sales, profit, share, internal state, household coordinates or budgets, individual transport costs or choices, counterfactual demand, or observer analytics. Monopoly firms receive no fabricated competitor reference.

### Experiment catalog and current reference

At each sampled experiment opportunity the firm regenerates and deduplicates candidates anchored on its incumbent: ±1 cent, ±5%, ±10%, and −20%. Entertainment also adds competitor match, competitor ±1 cent, and competitor ±5%. Percentage values round to integer cents, the one-cent minimum applies, and the incumbent itself is excluded. Seeded random selection prevents fixed catalog order. Upward candidates remain important because proximity can support a higher sticker price while preserving a lower delivered price for local households.

On every locally settled, non-experimental incumbent day, realised own profit replaces the incumbent reference profit. A following experiment is adopted only when its realised profit is strictly greater than that recent reference; otherwise the incumbent is restored. Historical best profit remains useful for broad discovery but no longer blocks adaptation in a changed competitive environment.

A final 006.1 guard treats a full-stock sellout as direct evidence that a discount is not currently needed to clear available supply. Catalog generation therefore removes every price below the incumbent after a sellout, including competitor-anchored prices that would function as deductions. This does not force an increase: seeded selection may choose any remaining upward experiment, and the ordinary experiment probability is unchanged. The full downward catalog returns after a day in which the firm does not sell out.

### Findings

The broader catalog materially changed paths without producing a single endpoint. From $5/$5 starts at day 300, seeds 20260813, 7, and 42 ended at A/B learner incumbents of $1.72/$1.81, $2.72/$2.71, and $1.88/$1.44, with final shares of 70/30, 20/80, and 20/80. From $1/$8 starts they ended at $1.03/$1.62, $1.48/$2.03, and $1.90/$2.26, with final shares of 90/10, 60/40, and 100/0. Retained events included adopted −20% and competitor +1-cent experiments as well as rejected upward and competitor-anchored experiments.

For the directly comparable canonical $2/$2 start, 006.1 ended day 300 at $2.39/$2.40 with a 50/50 final share, versus the 006 observation of $4.48/$4.56. The trajectory first revisited the earlier region and later adopted broader moves into lower-price regions. These paths demonstrate that larger experiments can leave an earlier local spatial pricing plateau. They do not establish equilibrium or prove every run escapes every plateau. Outcomes remain path-dependent, seeded, and shaped by spatial pricing power.

### Scope

Firms remain bounded experimental learners. They do not know household geography or exact demand, calculate an optimum, respond to market share, observe competitor outcomes, or follow a mandatory undercut/best-response rule. Spatial choice, Transport, Government parity, and control-market institutions are unchanged.

## [MVP4-Spatial_Competition_Full-006] - (2026-08-14)

### Motivation and research question

Perfect homogeneous competition made tiny sticker-price differences dominate household choice. This update introduces travel cost as a real economic friction without changing the learner or firm intelligence.

> How does spatial distance alter competition between otherwise identical Entertainment firms when households minimize delivered cost rather than sticker price?

### Spatial design and delivered price

Ten households and Entertainment A/B occupy unique cells on a seeded, fixed 20 × 20 grid. A deterministic spatial subseed keeps placement from advancing runtime market randomness. Manhattan distance represents one-way tiles and every visit is a round trip. Pathfinding and animation are absent because they are unnecessary for this first spatial question.

```text
delivered cost = product price + (2 × Manhattan distance × $0.02)
```

A closer firm may therefore charge more and remain cheaper delivered. The full cost must fit the $5 Entertainment budget and real cash. Nearest households receive earlier inventory access, seeded ties avoid household-ID priority, and affordable fallback is considered before failure.

### Transport and government parity

Abstract one-unit daily Transport consumption was removed. Successful Entertainment travel creates a separate household-to-Transport transfer. Transport has unlimited capacity, no inventory, zero modeled cost, and an exogenous rate; it has no adaptive pricing.

Geography creates heterogeneous within-day spending. Government taxes all firm cash, including Transport, then makes explicit household-specific transfers back to $50. This artificial stabilizing institution isolates market mechanisms; it is not an empirical fiscal model. There is no hidden reset: within-day inequality, end-of-day parity, and exact money conservation are separately measured and asserted.

### Findings

At day 300, canonical seed 20260813 produced Entertainment incumbents of $4.48/$4.56, final-day shares of 50%/50%, average customer distances of 9.4/8.2 tiles, and $3.52 final-day Transport revenue ($3.57 average across retained days). Seed 7 produced $4.52/$4.32, 20%/80%, and $3.00; seed 42 produced $4.28/$4.37, 50%/50%, and $3.68; seed 99 produced $2.01/$1.97, 100%/0%, and $5.68. These seed-dependent observations show local customer bases and positive pricing power can persist, but do not establish spatial equilibrium or broad realism.

Within-day spending varied by geography, while explicit transfers restored every household to exactly $50. Firms and Government ended at zero, total money remained exactly $500, and Food, Utilities, and Healthcare retained their established pricing boundaries in the 1,000-day run.

### Scope exclusions

This version excludes spatial Food/Utilities/Healthcare, animations, pathfinding, roads, congestion, Transport capacity, adaptive Transport pricing, firm relocation, household relocation, land prices, geography, product differentiation, and competitor-price awareness.

## [MVP3-Entertainment_Competition-005.2] - (2026-08-13)

### Problem

The 005.1 grid showed that symmetric Entertainment learners could synchronize and freeze at $5/$5 even though a unilateral $4.99 test could capture substantially more demand. Accounting remained exact; the behavioral problem was the rule `converged = stop experimenting forever`, which is unsuitable when another adaptive firm changes the environment.

### Design decision

Permanent convergence was replaced with local settlement plus persistent experimentation. Broad price discovery is unchanged. Once locally settled, each firm independently has a 10% seeded probability per simulated day of scheduling a one-cent up/down probe. A probe is adopted only when the firm's own realised profit strictly exceeds its stored incumbent reference profit; otherwise the incumbent is restored. Firms receive no competitor price, profit, market-share, household-balance, or hidden-demand input.

The simulation uses a centralized xorshift32 generator with canonical seed `20260813`. It supplies every stochastic household shuffle, equal-price firm selection, probe-timing draw, and probe-direction draw. The seed and internal generator state are part of simulation state, so the same model, configuration, and seed replay exactly.

> Randomness represents uncertainty, ordering, matching, and search—not missing economic mechanisms.

### Findings

Six sampled 300-day runs covered $5/$5 and $1/$8 starts under seeds `20260813`, `7`, and `42`. The formerly frozen $5/$5 state was escaped: the canonical and seed-7 runs ended with $4.99/$4.98 incumbents, while seed 42 ended at $4.99/$4.99 with one firm temporarily testing $5.00. Thus unilateral probes can be adopted and competitive prices can continue moving; no terminal or equilibrium claim is made.

The $1/$8 runs reached $4/$4 incumbents for all three sampled seeds over 300 days. They continued to generate probe days, but sampled probes did not improve the stored incumbent references enough to be adopted. Equal-price daily sales and shares varied by seed rather than being forced to 5/5.

The four monopoly controls remained centered on their established incumbent optima—Food $15, Utilities $12, Transport $8, and Healthcare $10—while occasionally testing an adjacent cent. Seeded histories differed legitimately across seeds, while repeated canonical-seed runs were exactly identical in state, metrics, events, and cumulative outcomes.

### Stability and scope

The 1,000-day baseline retained exactly $500 total money, zero household Gini, equal $50 household balances, exact daily stock flow, cleared firm/government balances, deterministic same-seed execution, and bounded histories. The change adds no competitor observation, undercut heuristic, best response, marginal cost, product differentiation, additional firm/industry, or stabilizer.

## [MVP3-Entertainment_Competition-005.1] - (2026-08-13)

### Motivation and research question

The default equal-start UI path showed a $5/$5 learner endpoint, while the earlier $1/$8 controlled experiment produced $4/$4. That contrast suggested competitive learner endpoints may depend on initial prices even though the market, households, and pricing code are unchanged.

> How sensitive are the two Entertainment firms' learner convergence endpoints to their initial prices?

### Method

The experiment runs the full Cartesian product of Entertainment A and B starts at $1, $2, $3, $4, $5, $6, $8, and $10: 64 deterministic configurations. The horizon is 300 days. Every run holds ten households, the $5 Entertainment budget, ten units per firm, the unchanged learner and tie rule, full taxation/redistribution, and the existing control starts fixed. It records A/B endpoints and convergence days, whether both converged, final market shares/profits, private final learner states, and control endpoints.

Each `(A=X, B=Y)` result was compared with `(A=Y, B=X)` after exchanging firm labels. No observer result enters pricing strategy.

### Results

Cells show `A endpoint / B endpoint`:

| A \ B | $1 | $2 | $3 | $4 | $5 | $6 | $8 | $10 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **$1** | 5/5 | 1/1 | 2/1.98 | 2/2 | 3/2.98 | 3/3 | 4/4 | 5/5 |
| **$2** | 1/1 | 5/5 | 2/2 | 3/2.98 | 3/3 | 4/3.98 | 5/4.98 | 5/4.99 |
| **$3** | 1.98/2 | 2/2 | 5/5 | 3/3 | 4/3.98 | 4/4 | 5/5 | 5/5 |
| **$4** | 2/2 | 2.98/3 | 3/3 | 5/5 | 4/4 | 5/4.98 | 5/4.99 | 5/4.99 |
| **$5** | 2.98/3 | 3/3 | 3.98/4 | 4/4 | 5/5 | 5/5 | 5/5 | 5/5 |
| **$6** | 3/3 | 3.98/4 | 4/4 | 4.98/5 | 5/5 | 5/5 | 5/4.99 | 5/4.99 |
| **$8** | 4/4 | 4.98/5 | 5/5 | 4.99/5 | 5/5 | 4.99/5 | 5/5 | 5/4.99 |
| **$10** | 5/5 | 4.99/5 | 5/5 | 4.99/5 | 5/5 | 4.99/5 | 4.99/5 | 5/5 |

All 64 cases converged within the horizon. There were no cycles or horizon non-convergence cases. The most frequent endpoint was $5/$5 (20 cases), but the grid also produced $1/$1, $2/$2, $3/$3, $4/$4, and adjacent or near-adjacent asymmetric endpoints such as $2/$1.98 and $5/$4.99. Every equal-start diagonal case converged to $5/$5, while asymmetric starts could land substantially below the $5 demand boundary.

Swapped-start symmetry held exactly across all 64 runs after exchanging A/B labels: endpoints, convergence days, and final market shares matched. No material array-order or state-mutation asymmetry was found.

#### Symmetric starts

Every equal-start configuration—$1/$1, $2/$2, $3/$3, $4/$4, $5/$5, $6/$6, $8/$8, and $10/$10—converged to $5/$5. The observed mechanism is synchronized learning:

```text
same starting price
→ equal-price demand split
→ similar sales and realised profit
→ identical learner updates
→ continued synchronized price movement
→ $5 household affordability boundary
```

At $5/$5, deterministic ties give each firm approximately five sales, so each earns $25 daily revenue. This is a learner convergence endpoint, not evidence of competitive optimality. Under the current household-choice rule, a unilateral $4.99 price could capture substantially more demand; ten sales would yield $49.90 rather than $25. The synchronized learners do not explicitly test that deviation conditional on the competitor remaining at $5 after their private convergence criteria are satisfied.

#### Asymmetric starts

Different starts break synchronization because the cheaper firm initially captures more or all demand. The firms consequently accumulate different realised-profit histories and may stop at different deterministic endpoint regions. Representative results include $1/$3 → $2/$1.98, $1/$5 → $3/$2.98, $2/$6 → $4/$3.98, $1/$8 → $4/$4, $4/$6 → $5/$4.98, and $2/$10 → $5/$4.99.

One- and two-cent differences such as $2.98/$3, $3.98/$4, and $4.99/$5 align with the current integer-cent refinement and adjacent-price stopping behavior. They should not be over-interpreted as distinct economic optima. Swapping A/B starts produced the same results with labels exchanged, including these small differences; no material tie-order asymmetry appeared.

### Why $5/$5 is notable

The $5/$5 endpoint demonstrates that the learner's convergence flag means its own historical adjacent-price search is finished. It does not establish that no profitable competitive deviation exists. The learner was developed in a monopoly environment where realised profit could be treated approximately as a function of the firm's own tested price. Under competition:

```text
my realised profit = function(
  my price,
  competitor price,
  competitor learning path,
  relative timing of experiments
)
```

The optimization environment is no longer stationary, and the firm receives no competitor state with which to reason about conditional deviations.

### Interpretation

The grid characterizes synchronized learning under symmetric starts, divergent histories under asymmetric starts, and multiple path-dependent learner convergence endpoints. A firm's convergence signal can identify its private learning process as locally finished even when a profitable unilateral deviation may exist against the competitor's current price. This is a limitation of the current bounded learner, not an accounting failure. None of the deterministic endpoints are labelled equilibria.

### Stability

Across the experiment, total money remained conserved, household balances remained equal, Gini remained zero, per-firm stock flows remained exact, and deterministic execution remained intact. Food, Utilities, Transport, and Healthcare reached $15/$12/$8/$10 in every grid run. The finding therefore concerns behavioral and learning dynamics, not system or accounting instability.

### Scope

No pricing logic, competitive heuristic, competitor observation, best-response rule, firm information, tie behavior, or economic institution changed. This update only characterizes the existing learner.

### Validation

- 43 tests passed across five files.
- Typecheck, build, and aggregate check passed.
- Desktop and 390px populated matrix checks passed with contained scrolling and no console warnings/errors.
- No deployment was performed.

## [MVP3-Entertainment_Competition-005] - (2026-08-13)

### Context and research question

MVP 2.1 established stable industry-specific demand boundaries without disturbing household equality. Competition is the next controlled asymmetry because it makes realised firm profit mutually dependent while leaving household budgets, supply, taxation, and the pricing heuristic unchanged.

> What behavior emerges when two independently adapting firms compete for the same homogeneous household demand using only their own realised market outcomes?

Competition exists only in Entertainment. Food, Utilities, Transport, and Healthcare remain monopoly controls so unintended cross-market coupling is visible.

### Design and information boundaries

Entertainment has two firms, each with ten daily exogenous units and independent state. A household buys at most one Entertainment unit from the cheapest affordable firm with stock. If that firm is empty, the next-cheapest affordable supplier is considered. Equal prices alternate tied priority by household attempt and rotate the first firm by day, producing a reproducible balanced split without permanent array priority.

Each firm still receives only its own tested price, sales, realised profit, and private learner history. Competitor prices, profits, sales, state, and observer market share are not strategy inputs. No undercut rule or competitive convergence target was added.

System/accounting stability is required; competitive price convergence is an empirical outcome.

### Findings

The controlled experiment started Entertainment A at $1 and B at $8. A initially won all ten sales while moving upward and B moved downward through zero-sale experiments. As their prices crossed, full-market leadership alternated. Both learners identified $4 as their private best-known price: A reported convergence on day 12 and B on day 13. From day 14 onward both posted $4, tied demand split 5/5, each realised $20 daily profit, and observer market share was 50% each.

This endpoint is not the $5 affordability ceiling and is not described as a Bertrand equilibrium. It follows from the existing hill-climbers retaining earlier $40 monopoly-like best profit while later equal-price sharing produces $20. The learners nevertheless stop after their adjacent-price tests under their unchanged private rules.

### Controls and stability

| Control | Endpoint | Day |
|---|---:|---:|
| Food | $15.00 | 23 |
| Utilities | $12.00 | 19 |
| Transport | $8.00 | 12 |
| Healthcare | $10.00 | 14 |

The joint experiment ended on day 23 with every household at $50, Gini 0, and total money $500. A 1,000-day run remained invariant-safe: six non-negative firms, exact per-firm supply/sales/expiration, at most ten Entertainment purchases, zero institutional end balances, bounded histories, equal household cash, zero Gini, and deterministic repetition.

### Validation and limits

- `npm run test:run`: 38 tests passed across four files.
- `npm run typecheck`: passed.
- `npm run build`: passed with the non-failing bundle-size advisory.
- `npm run check`: passed.
- `npm run dev`: served successfully. Desktop and 390px checks confirmed the six-firm market table, populated control/competition results, separate competitor chart series, contained horizontal table scrolling, no page-level or chart overflow, and no console warnings/errors. No deployment was performed.

The market has no differentiation, costs, loyalty, geography, switching, competitor awareness, entry/exit, or stochastic behavior. Competition in additional industries is intentionally excluded.

## [MVP2-Industry_Demand_Boundaries-004.1] - (2026-08-13)

### Context and decision

MVP 2 established that five symmetric markets could preserve a deterministic stable reference economy. The first asymmetry is deliberately limited to fixed industry demand boundaries. This changes the price-learning question without introducing scarcity, household heterogeneity, differentiated taxes, or competition, all of which would add allocation or distribution feedback.

The experimental per-household budgets are Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5. They are arbitrary research parameters and sum to the unchanged $50 real cash balance. Households remain identical. On a successful day each household buys the same basket, spends the same amount, and receives the same pooled redistribution, preserving exact monetary symmetry.

Budgets now belong to industry definitions and initialize industry-keyed household outcome state. They remain behavioral constraints rather than money. Market logic and `pricingStrategy.ts` are unchanged, and firms receive no information about their boundary.

### Findings

| Industry | Start | Endpoint | Convergence day |
|---|---:|---:|---:|
| Food | $1.00 | $15.00 | 23 |
| Utilities | $2.00 | $12.00 | 19 |
| Transport | $5.00 | $8.00 | 12 |
| Healthcare | $15.00 | $10.00 | 14 |
| Entertainment | $20.00 | $5.00 | 24 |

Starts sampled both below and above relevant boundaries. All five learners independently found their own ceiling by day 24. Final household cash remained exactly $50, Gini was 0, and total money was $500. The 1,000-day run preserved those values and all stock-flow invariants. Reversing canonical industry order did not change household or firm economic outcomes; identical configurations remained deterministic.

### Limitations and validation

The budgets are fixed, homogeneous, and arbitrary. Industries otherwise retain identical demand, supply, firm strategy, tax treatment, and production assumptions. There is still no elastic demand, substitution, endogenous allocation, or competition.

- `npm run test:run`: 31 tests passed across four files.
- `npm run typecheck`: passed.
- `npm run build`: passed with the non-failing bundle-size advisory.
- `npm run check`: passed.
- `npm run dev`: served successfully. Browser verification confirmed the MVP 2.1 header, all five visible budget values in the market table, populated convergence rows at $15/$12/$8/$10/$5, and no console warnings or errors. No deployment was performed.

## [MVP2-Multi_Industry-004] - (2026-08-13)

### Context

Finite supply successfully exposed endogenous wealth divergence, path dependence, and multiple learner endpoints when supply was below demand. Stability is now the highest priority. Returning the single-market default to ten units for ten households restored the stable reference economy: every affordable household could purchase and equal redistribution restored equal balances.

The next expansion is therefore architectural rather than another destabilizing behavioral mechanism. Five simultaneous symmetric industries test whether the engine can grow in breadth while keeping causes and benchmarks legible.

### Research question

> Can Econ-Engine support several simultaneous markets and independently learning firms while preserving a deterministic, analytically known, stable reference economy?

### Main risk

Giving households only one unrestricted $50 wallet and processing markets sequentially would make later industries lose demand whenever an experimental basket exceeded available cash. Industry order would become a hidden economic institution and contaminate each firm's learning path.

### Design decision

The model uses one real household cash balance plus five fixed per-industry spending constraints. A purchase must satisfy both real-cash and industry-budget affordability. The constraints are not money stocks, never enter monetary conservation, and are not depleted by purchases in other industries. This keeps the monetary circuit explicit, makes the canonical markets independent of processing order, preserves the $10 analytical boundary, and lets each firm learn against a stable local result.

### Architecture

The core now iterates reusable `industries` and `firms` collections. Each firm owns private pricing state. Each household owns an industry-keyed outcome record with budget, daily cause, and lifetime counters. Metrics contain five reusable market records; generic events carry industry and firm identity. This avoided five hard-coded engine copies without adding a plugin framework.

A single common supply configuration is applied independently to each industry. The government remains singular: it taxes all firms, pools receipts, and redistributes the pool.

### Stable benchmark

The canonical economy has ten households, five firms, ten units supplied per firm, a $10 budget per household/industry, $50 household cash, and $500 total money. At all firms priced $10, each household spends $50, government collects and redistributes $500, every household ends at $50, and Gini is zero.

### Findings

The controlled varied-start run produced:

| Industry | Start | Endpoint | Convergence day |
|---|---:|---:|---:|
| Food | $1.00 | $10.00 | 18 |
| Utilities | $2.00 | $10.00 | 17 |
| Transport | $5.00 | $10.00 | 14 |
| Healthcare | $15.00 | $10.00 | 14 |
| Entertainment | $20.00 | $10.00 | 19 |

All learners converged by day 19 without knowing the benchmark or other firms' results. Final household minimum, median, and maximum cash were all $50; Gini was zero and total money was $500.

A 1,000-day canonical run kept all five prices at $10 after convergence, every household at $50, Gini at zero, total money at $500, and each market's stock flow balanced. Reversing industry processing order produced identical household outcomes and per-firm pricing state, sales, and revenue. No unexpected canonical instability appeared.

### Stability

The canonical baseline is deliberately stable because supply equals demand and the fixed industry constraints preserve the known affordability boundary. Lower common supply remains available and produces explicit stockouts; its wealth divergence and path dependence are valid experimental outcomes, not model breakage. No hidden lower-supply stabilizer was introduced.

### Trade-offs

- Industries are currently labels over identical mechanics.
- Spending constraints are fixed and imposed, not endogenous allocation.
- There is no within-industry competition.
- Supply remains finite but exogenous.
- Full pooled taxation and equal redistribution remain deliberately artificial.
- This is a controlled architecture/stability test rather than a realistic economy.

### Validation

- `npm run test:run`: 26 tests passed across four files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check`: passed.
- `npm run dev`: served successfully; initial desktop DOM sanity check showed the five-market overview, four charts, experiment control, household inspection, and event ledger with the expected $500 baseline values.
- Populated experiment interaction, approximately 390px viewport, and console inspection were not completed because the in-app browser's URL security policy blocked further localhost actions after the metadata refresh. This is a validation-tool limitation, not an observed application failure.
- GitHub Pages deployment was not performed.

### Lessons and open questions

Collection-based markets and keyed outcomes broaden the architecture without broadening firm knowledge. The fixed-envelope approach is analytically clean but should remain explicit as an institution. Future research can ask when industries should differ, whether household allocation should become endogenous, whether competition should enter one industry first, and how wages/income might replace the redistribution circuit. None belongs in MVP 2.

## [MVP1-Scarcity_Analysis-003.1] - (2026-08-13)

### Context

MVP 1.1 instrumented an eight-unit economy and showed that scarce allocation made household balances diverge. The resulting affordability feedback produced multiple deterministic learner convergence endpoints, including $6.70 from the $2.00 start, even though $10.00 remained the one-day optimum in the initial equal-cash state.

The default exogenous supply is now ten units—one per household—as an explicit stabilization choice. This does not change the pricing learner, reset household cash during a run, or add a hidden price rule. It changes the visible environment constraint so an affordable market can serve every household.

### Mechanism

Under the historical eight-unit configuration, if eight households purchase at price `P`, the firm receives `8P` and equal redistribution returns approximately `0.8P` to each household:

```text
buyer net cash change     = -P + 0.8P = -0.2P
non-buyer net cash change =      0.8P = +0.8P
```

With ten supplied units, every affordable household purchases. The firm receives `10P` and redistribution returns exactly `P` to each household:

```text
buyer net cash change = -P + P = 0
```

Household balances therefore remain $10.00, pre-market affordability depends only on the tested price, and the realised price→profit function is stationary across affordable default days.

### Revised research question

> Does matching finite daily supply to maximum household demand remove the stockout-driven wealth feedback and stabilize the learner's experimental environment?

### Why no behavioral fix was added

The change does not reset balances, alter pricing in response to stockouts, expose latent demand, or encode $10.00. Ten units are received through the existing explicit supply event and remain configurable. The stabilizer is therefore an overt environment assumption, not hidden strategy logic. `pricingStrategy.ts` and the `decideTomorrowPrice` boundary remain unchanged.

### Instrumentation decisions

- Minimum, median, and maximum household cash expose distributional movement concealed by a stable total.
- Gini summarizes dispersion from balances only. It is zero when balances are equal or all zero and never feeds back into behavior.
- Market-open affordability is captured before queue processing, separating the number able to pay from supply and realised sales.
- Cumulative household purchases, stockouts, and affordability failures live on household state because the event ledger is intentionally bounded.
- Pre-market and end-of-day distributions are both snapshotted so a day's causal starting condition is not confused with its result.
- The controlled experiment runner records how starting-price interventions change convergence and final household state while using the normal public engine.

### Controlled experiment methodology

The current experiment grid uses starting prices of $1.00, $2.00, $4.00, $6.00, $8.00, $9.00, $9.50, $10.00, $11.00, $15.00, and $20.00. Every run uses a $1.00 initial search step, ten daily food units, identical $10.00 household balances, the same rotating allocation, 100% taxation, equal redistribution, and the unchanged deterministic learner.

The maximum horizon was 300 days. A run stopped only when the existing learner reported convergence or the horizon was reached. Non-convergence would be returned as a distinct null result rather than converted into a price. Collected outputs included starting and converged price, days, final minimum/median/maximum cash, Gini, affordability at the final posted price, and each household's cumulative purchases and failure causes.

### Results

All eleven sampled runs converged to $10.00 within 19 days:

| Start | Converged | Days | Final cash min / median / max | Gini |
|---:|---:|---:|---:|---:|
| $1.00 | $10.00 | 18 | $10.00 / $10.00 / $10.00 | 0.000 |
| $2.00 | $10.00 | 17 | $10.00 / $10.00 / $10.00 | 0.000 |
| $4.00 | $10.00 | 15 | $10.00 / $10.00 / $10.00 | 0.000 |
| $6.00 | $10.00 | 13 | $10.00 / $10.00 / $10.00 | 0.000 |
| $8.00 | $10.00 | 11 | $10.00 / $10.00 / $10.00 | 0.000 |
| $9.00 | $10.00 | 10 | $10.00 / $10.00 / $10.00 | 0.000 |
| $9.50 | $10.00 | 11 | $10.00 / $10.00 / $10.00 | 0.000 |
| $10.00 | $10.00 | 9 | $10.00 / $10.00 / $10.00 | 0.000 |
| $11.00 | $10.00 | 10 | $10.00 / $10.00 / $10.00 | 0.000 |
| $15.00 | $10.00 | 14 | $10.00 / $10.00 / $10.00 | 0.000 |
| $20.00 | $10.00 | 19 | $10.00 / $10.00 / $10.00 | 0.000 |

Observed: every sampled start reaches the same $10.00 learner convergence endpoint. Every household ends with $10.00, Gini is zero, and cumulative consumption is equal across households within each run.

The historical eight-unit suite produced multiple endpoints ($6.70–$10.00 in the sampled grid) and positive wealth dispersion. Comparing the two fixed-supply configurations supports the explanation that stockout allocation and redistribution generated the moving affordability landscape. Ten-unit supply removes that channel in the homogeneous default world.

### Path dependence

The current ten-unit grid shows no path dependence in learner endpoints across the sampled starts. This result is specific to the stabilizing supply assumption and the current homogeneous, full-redistribution institutions. Lower configured supply still reproduces the historical path-dependent case.

### Trade-offs

- Ten households make individual histories inspectable but limit generalization.
- Deterministic rotation is one allocation institution, not a neutral market-clearing process.
- Supply is fixed, exogenous, and perishable.
- Equal redistribution stabilizes balances only because all ten households buy on affordable default days.
- The world remains a zero-cost monopolist with no production or persistent inventory.
- Results depend on the current bounded one-day-profit heuristic and its $1.00 initial step.
- Ten-unit supply removes stockout scarcity from affordable default days, although supply remains finite.

### Validation

Pure analytics tests cover even-population medians, equal and unequal Gini benchmarks, distribution summaries, and order-independent affordability. Engine-level tests verify pre-market timing, historical state boundaries, cumulative outcome increments, persistence, and reset. Experiment tests verify reproducibility, fixed non-intervention settings, explicit horizon behavior, complete cumulative histories, and the unchanged strategy boundary.

`npm run test:run` passed 41 tests across four files. `npm run typecheck`, `npm run build`, and `npm run check` passed; the build retained Vite's non-failing chunk-size advisory. The controlled ten-unit suite produced identical results on repeated execution. Desktop and populated 390-pixel mobile checks confirmed the ten-unit default, ten sales on the first affordable day, zero Gini, all eleven $10.00 experiment endpoints, no page-level overflow, and no browser console warnings or errors. GitHub Pages deployment was not attempted.

### Lessons

- A visible environment parameter can stabilize a model without modifying agent strategy.
- Matching maximum supply to homogeneous demand prevents the allocation feedback that previously moved affordability.
- Observer analytics make the stabilization testable: min/median/max remain equal and Gini remains zero.
- The historical eight-unit result remains useful as a controlled comparison rather than something to erase.

### Open questions

- How sensitive is stabilization to supply below ten?
- Would heterogeneous household demand or a different redistribution institution reintroduce wealth divergence?
- Should future comparisons treat supply quantity as the explicit intervention?

## [MVP1-Finite_Supply-003] - (2026-08-13)

### Context

MVP 0 had reached a useful baseline: the browser simulation was deterministic, monetary transfers conserved every cent, the bounded learner could be inspected through strategy state and raw events, and the unlimited-supply analytical benchmark was covered by tests. Its assumptions and failure modes were sufficiently understood to introduce one additional constraint without simultaneously changing production, household demand, taxation, or price learning.

The unlimited-food world made quantity sold a pure affordability result. If every household could pay, ten units always appeared and ten purchases occurred. That design was appropriate for isolating the first learner, but it could not represent physical scarcity or distinguish inability to pay from inability to obtain an available good.

### Research question

> How does the existing price-discovery mechanism behave when quantity sold is constrained by finite physical supply rather than only by consumer affordability?

### Why finite supply was chosen

Finite supply is the smallest environmental change that makes physical quantity constrain the market. A fixed eight-unit daily receipt creates a known gap between ten desired units and available food without requiring a theory of production. It adds one stock-flow identity and one allocation institution while leaving the firm's objective, government circuit, and household desire unchanged.

### Risks identified before implementation

- Sales could become an ambiguous signal: eight sales might mean exactly eight willing buyers or a sold-out market with additional latent attempts.
- Stockout data known by the engine could accidentally leak into the firm's strategy and give it God-view demand information.
- Persistent inventory could introduce additional path dependence and contaminate the isolated price experiment.
- Fixed household ordering could permanently advantage low-numbered households.
- Fake production costs could destroy money or add an unexplained recipient.
- A stockout response in the learner would change behavior at the same time as the environment.
- Adding workers, wages, suppliers, or quantity choice would turn one mechanism into an uncontrolled production model.
- Equal redistribution after scarce allocation could create unequal household balances even though aggregate money remains conserved.

### Decisions and rationale

#### Use fixed exogenous daily supply

The configured integer supply arrives at the start of each day through an explicit event. It is not chosen by the firm and is not described as output from workers, capital, or raw materials. Eight units is the default because it creates two physically unserved households in an otherwise affordable initial market.

#### Expire every unsold unit

Remaining stock moves explicitly to expiration after household attempts. The engine records an expiration event even when the quantity is zero, making the daily stock lifecycle visible. Ending inventory must be zero. This avoids persistent physical-state path dependence while preserving a causal destination for every unit.

#### Rotate purchasing priority

The first household advances by one ID each day and the rest follow cyclically. Across ten always-affordable days with eight units, each household encounters stockout exactly twice. The order is reproducible, explainable from the current day, and contains no unseeded randomness.

#### Separate failure causes

Each household ends the market with exactly one causal outcome. Insufficient funds is evaluated before stock availability so a household that cannot pay is not mislabeled merely because earlier buyers depleted stock. An affordable household receives a stockout outcome only when inventory is zero. This preserves the intended $10.01 benchmark classification.

#### Keep the pricing strategy unchanged and restrict its information

Inventory belongs to the environment. The pricing function still accepts only the current price, units sold, realised profit, and private learning state. It is not passed stockout-failure counts, household balances, the daily-supply parameter, or the analytical benchmark. The engine can report sold-out status in state and metrics without converting it into a new pricing rule.

#### Enforce food accounting directly

Runtime validation requires non-negative integer supply variables, sales no greater than supply, zero ending stock, exact `supply = sales + expiration`, matching household purchase and firm sales counts, and one outcome per household. Money conservation and cleared institutional balances remain unchanged.

### Expected benchmark

For the equal-cash starting state and eight units:

| Price | Sales | Revenue | Causal failures |
|---:|---:|---:|---|
| $9.99 | 8 | $79.92 | 2 stockouts |
| $10.00 | 8 | $80.00 | 2 stockouts |
| $10.01 | 0 | $0.00 | 10 insufficient-funds failures |

The initial-state revenue optimum is therefore $10.00. The learner is not given this result.

### Findings

Verified observation: finite supply caps an affordable first-day market at eight purchases. The remaining two households produce granular stockout events, no food expires, and the firm records $80.00 at a $10.00 price. At $10.01, all ten attempts fail for affordability, all eight supplied units expire, and revenue is zero.

Verified observation: the rotation removes permanent structural priority when households remain affordable. In a ten-day, one-cent scenario, every household experiences exactly two stockouts.

Verified observation: physical inventory itself has no path dependence; every completed day ends with zero available food and the next day receives exactly the configured amount.

Verified observation: household cash does become path-dependent. Equal redistribution gives buyers and non-buyers the same transfer even though only buyers spent money. Consequently, the household population no longer returns to ten identical $10.00 balances after every market.

That monetary distribution changes later affordability and makes the learner's realised one-day profit surface depend on its experiment path. The unchanged learner converges to $10.00 in the tested run beginning at $20.00, but the default $2.00/$1.00-step run converges reproducibly to $6.70. The $10.00 benchmark is still exact for the specified initial state; it is not a stationary guarantee for every subsequent state.

This result was not hidden with a balance reset, credit, purchase-correlated transfer, repeated-price averaging rule, or stockout-based heuristic because each would add or change a mechanism excluded from MVP 1.

### Trade-offs

- Supply is exogenous and says nothing about how food is produced.
- Expiration is a simplifying institution, not an empirical shelf-life model.
- Rotating queue allocation is institutional rather than price- or preference-driven.
- A sellout reveals scarcity to the firm, but MVP 1 does not provide the learner with the exact latent number of affordable attempts.
- Equal redistribution preserves aggregate money but does not restore household symmetry after scarce allocation.
- Production quantity is fixed and cannot respond to prices, sales, or stockouts.

### Validation

The expanded tests verify the analytical table, stock-flow identity, inventory bounds, zero carry-over, distinct failures, causal outcome completeness, deterministic rotation, money conservation, taxation, redistribution, raw-event preservation, historical metrics, reset behavior, and unchanged pricing-action branches.

`npm run test:run` passed 26 tests across two files. `npm run typecheck`, `npm run build`, and the combined `npm run check` all passed. The build retained Vite's non-failing chunk-size advisory. The development server became ready and returned HTTP 200. Rendered browser checks found no console warnings or errors, confirmed the day-one supply, sold/expired, failure, household, and ledger views, and found no horizontal overflow at a 390-pixel viewport. No GitHub Pages deployment was attempted in this update.

### Lessons

- Removing physical inventory carry-over does not remove all path dependence; allocation can transmit history through household balance sheets.
- An analytical one-day optimum and a repeated adaptive-market optimum are different claims and should be tested and labeled separately.
- Failure taxonomy matters for both interpretation and information boundaries: the engine can know more than the pricing agent.
- A zero-quantity expiration event can still be valuable evidence that a lifecycle phase occurred.
- Rotating order solves permanent queue priority but does not equalize economic outcomes when affordability evolves.
- Preserving an unchanged strategy can reveal that an environmental intervention invalidates the stationarity assumptions implicit in its learning path.

### Open questions / next steps

- Should persistent inventory be studied as the next isolated physical mechanism, or would it compound the already observed monetary path dependence too quickly?
- Should a future firm strategy explicitly learn from a sellout signal, and how could that be tested separately from exact latent demand?
- Should competition precede endogenous production?
- How should allocation work once households differ in income, needs, or preferences?
- How can production become endogenous later while preserving explicit physical and monetary stock-flow accounting?
- Should future price experiments hold a price for a documented observation window, and would that be a strategy change or an experimental-protocol change?

## [MVP0-UI_Refinement-002] - (2026-08-13)

### Context

MVP 0 already had a functioning deterministic economy, exact-cent transfers, runtime invariants, convergence tests, agent inspection, four charts, and a granular event ledger. The economic question remained deliberately narrow: can a bounded monopolist discover the revenue-maximising food price through realised experiments while the model conserves money exactly?

This update examined whether the dashboard made that mechanism as easy to follow as the simulation made it to verify. The implementation was economically correct, but several presentation choices obscured the temporal and causal structure of the pricing learner. The work therefore focused on instrumentation and interpretability rather than on adding another economic mechanism.

### Problems and observations

#### An important invariant occupied an analytical chart

The Money Conservation chart was technically correct but analytically uninformative. Total money is a hard invariant: a successful MVP 0 run should keep it at exactly $100.00. The expected chart was therefore a flat line. That flatness is strong validation evidence, but it does not reveal how the economy or learner changes over time.

The distinction is important: validation importance does not automatically imply analytical-visualisation importance. Money conservation still needs to fail loudly in the engine, remain covered by tests, and be visible to the user. It does not need one of four large chart positions when a compact status metric can communicate the same successful state.

#### The learner's adaptation process was not directly visible

Price and profit charts showed the results of experiments, but not how aggressively the firm was searching. The pricing process is more than a mapping from price to profit:

```text
experiment
→ observe realised profit
→ update the best-known price
→ shrink the search radius after failure
→ refine around the candidate optimum
→ test adjacent cents
→ converge
```

The strategy's step size is the search radius in this sequence. It records the transition from broad exploration to increasingly local refinement. Without that history, a user can see price oscillations but must infer why their magnitude changes.

#### One label represented two economically distinct times

At the end of a simulated day, the system contains two relevant prices:

1. the price just tested in the completed household market, which generated the displayed sales and profit;
2. the price selected after observing that result, which will be tested on the next market day.

The earlier headline metric called the second value `Posted price`. Although the supporting text said "Next market day," the main label made it easy to associate that price with the profit from the day just completed. This weakened the intended causal reading of the simulation.

#### The decision symbol did not describe the decision

The Latest Pricing Decision panel always displayed an upward arrow. The prose explanation could say that the firm lowered its price, narrowed its search, or converged, while the symbol still implied an increase. The symbol was consequently decorative rather than informative.

Deriving a correct symbol by parsing prose would introduce a second problem. Human-readable explanations are presentation text; they should be free to change without silently breaking behavioral classification in the UI.

#### Micro-level completeness overwhelmed the default ledger view

The raw event ledger correctly records each household purchase or failed purchase as a distinct causal event. Redistribution similarly produces a transfer event for every household. In a world of ten identical households, this meant that repetitive rows dominated the visible ledger and pushed pricing decisions, firm results, taxation, and convergence out of view.

This exposed a difference between simulation truth and default presentation. The model needs granular evidence for auditability, while the first-level UI needs summaries that preserve the causal sequence.

### Decisions and rationale

#### Keep conservation in validation; use the chart for Search Step

The dedicated Money Conservation chart was removed, but no conservation mechanism was weakened. Runtime checks, simulation tests, and the Total Money headline metric still establish that the closed circuit contains exactly $100.00. The metric now gives a restrained "Invariant satisfied" status.

The freed chart position now shows Search Step. This gives one of the primary analytical views to a variable that should change during learning and then flatten at one cent upon convergence. The chart exposes how the strategy responds to failed experiments and how its exploratory radius contracts.

The engine already stored `priceStepSizeCents` in each daily metric snapshot. The UI therefore reads historical simulation output directly rather than reconstructing a step history from current React state. A new test made that existing data contract explicit by checking the observed 100-, 50-, and 25-cent sequence in an actual run.

#### Make the experiment cycle explicit in the headline metrics

The metrics now present `Last tested price`, the `Daily profit` produced by that experiment, and `Next price` for tomorrow's experiment. The last tested value comes from the latest immutable daily metrics snapshot; it is not inferred from `firm.postedPriceCents`, because that field has already advanced to the next decision by the end of a day.

The intended reading is now:

```text
Last tested price
→ realised profit
→ pricing decision
→ next price
```

Before the first day, the UI reports no last experiment and shows the configured starting price as the next price. This matters because the model's governing rules require explicit time and prohibit agents from reacting to information that does not yet exist. The interface should preserve the same distinction.

#### Expose typed decision actions at the strategy boundary

The pricing strategy now returns a `PriceDecisionAction` alongside its next price, explanation, updated strategy state, and convergence signal. The supported classifications are `increase`, `decrease`, `refine`, `hold`, and `converged`.

Every existing decision branch assigns the action that describes the price decision it already made. The engine stores the latest action, and React maps it to a restrained symbol. The pricing calculations and convergence rules are unchanged.

This keeps three concerns separate:

- the strategy makes the agent decision and classifies it structurally;
- simulation state carries that truthful decision metadata;
- the UI selects a symbol and displays the strategy's prose explanation.

The UI neither reimplements strategy conditions nor parses text. Prose and symbols are downstream views of the same structured result.

#### Preserve raw events and derive grouped display events

The engine continues to emit each `HOUSEHOLD_PURCHASE`, `HOUSEHOLD_PURCHASE_FAILED`, and `TRANSFER_RECEIVED` event. No raw event is removed, coalesced, or mutated.

A pure `groupEventsForDisplay(events)` transformation now creates the visible ledger model. It groups purchase successes and failures by day into a market summary, including the tested price, number of buyers, number of failures, and total spending. It also groups per-household redistribution transfers into a daily total. Important non-repetitive events remain individual rows.

Grouped rows use native expandable details to reveal their source events. The approach follows the principle:

> Preserve micro-level evidence, summarise it at the macro level by default, and allow the user to drill back down.

This was preferred to changing the engine because presentation density is not an economic rule. It was also preferred to deleting individual events, which would sacrifice the audit trail required by the design rules.

### Implementation

The simulation types gained `PriceDecisionAction`, the strategy populated that field along its existing branches, and simulation state retained the latest action for presentation. The numerical decisions themselves were left intact.

The dashboard changed its metric ordering and reads the last tested price and realised profit from the latest `DayMetrics` snapshot. The replacement chart reads `priceStepSizeCents` from the same bounded metric history. A decision-symbol map translates typed actions into the existing visual language.

The event grouping code lives in `src/ui`, outside the simulation engine. It returns display records that retain references to their granular source events. Styling additions were limited to decision states and native expandable event details.

### Trade-offs and constraints

- The update deliberately did not add firms, competition, production, labour, wages, finite supply, price-sensitive demand, new government behaviour, or a new pricing rule.
- The Search Step chart exposes strategy state but does not by itself explain every reversal. The adjacent pricing-decision prose and Price Discovery chart remain necessary context.
- Grouping is based on the current event taxonomy and one homogeneous market per day. A future model with multiple goods, firms, or markets would need grouping keys that include those dimensions.
- Native disclosure controls keep the implementation small and accessible but provide less bespoke interaction than a custom component. That is appropriate for MVP 0.
- The visible ledger remains bounded. Granular events are preserved within the simulation's bounded raw history, not as an unlimited archival store.
- The Total Money status currently reflects the validated simulation snapshot. It is intentionally quiet because a violation should be surfaced as an engine failure rather than styled as an ordinary dashboard fluctuation.

Scope discipline was central. This refinement made the current model easier to understand before introducing more economics, consistent with the governing principle that complexity must be earned.

### Validation and result

The original economic tests continued to pass, including exact accounting, conservation over many days, determinism, convergence from below, recovery from a high-price zero-sales region, and adjacent-cent convergence.

New coverage verified that daily metrics contain the actual step history, strategy branches expose the expected structured actions without changing their next prices, grouped ledgers summarise full-success and all-failure markets correctly, mixed summaries handle success and failure counts, the grouping transformation does not mutate its input, and ten raw purchase events remain present beneath a single grouped display event.

The completed update passed 14 tests across two files, TypeScript type checking, the production build, the combined `npm run check` command, and the GitHub Pages deployment for commit `480b148`.

The resulting dashboard makes three aspects easier to inspect: how the search radius narrows, which price produced the latest profit, and which price will be tested next. The ledger gives pricing and institutional events more prominence without sacrificing household-level evidence.

### Lessons

- Invariants and analytical variables serve different interface roles. A hard invariant may deserve stronger tests and less chart space.
- Agent learning is more interpretable when the UI exposes strategy state as well as outcomes.
- Temporal labels are part of model correctness. A UI can preserve numerically correct values while still obscuring causality if it does not distinguish observed results from future decisions.
- Structured metadata should cross the simulation/UI boundary when presentation depends on the meaning of a decision. Human-readable prose is not a stable behavioral API.
- An event ledger benefits from multiple representations: granular truth for auditability and grouped summaries for routine inspection.
- Interpretability improvements can materially strengthen an experiment without increasing model complexity.

### Open questions and next steps

- Should future chart tooltips pair each search-step change with the structured reason that caused it, or would that duplicate the decision panel?
- Would a compact visual link between Last Tested Price, Daily Profit, Latest Decision, and Next Price further improve causal reading without increasing dashboard density?
- As new event types appear, what grouping contract will preserve stable macro summaries while supporting multiple firms, goods, or transaction prices?
- Should raw event histories eventually be exportable for offline audit, given that the in-browser history is intentionally bounded?
- Before adding the next economic mechanism, the current dashboard should be used to identify whether any remaining convergence behavior is difficult to explain from price, profit, step size, structured decision, and raw events alone.

## [MVP0-Initial_Build-001] - (2026-08-11)

### Context

Econ-Engine began as a blank local project intended to become the working tree for an existing, effectively empty GitHub repository. The only project artifact was a Markdown document of simulation design rules. Those rules established the core philosophy: agents observe locally, decisions follow explicit objectives and bounded strategies, transactions obey strict accounting, aggregate outcomes are derived from micro-events, and complexity is introduced only after simpler mechanisms are understood.

The first implementation therefore needed to do more than display an economic animation. It needed to test a small architectural claim:

> Can bounded economic agents interact through explicit transactions, conserve money exactly, and allow a profit-seeking firm to discover a revenue-maximising price through experimentation using only information available to that firm?

The deliberately artificial MVP world was chosen so that its accounting and expected outcome could be understood completely before production, labour, competition, credit, heterogeneous demand, or shocks were introduced.

### Research question and known benchmark

The world contains ten identical households, each starting with $10.00 and attempting to buy one food unit per simulated day. A single firm has unlimited exogenous food and zero costs. If the posted price is affordable, all ten households buy; above $10.00, none can buy. The government's only role is to collect all daily firm revenue and immediately redistribute it to households, closing the monetary circuit.

This creates an analytically known benchmark:

| Price | Sales | Revenue |
|---:|---:|---:|
| $9.99 | 10 | $99.90 |
| $10.00 | 10 | $100.00 |
| $10.01 | 0 | $0.00 |

The revenue-maximising price is therefore $10.00. This is not a competitive equilibrium: the world contains one monopolist, zero production cost, unlimited supply, and perfectly inelastic unit demand below an affordability boundary. The analytical result exists for developer validation only. Giving the result or household balances to the firm would invalidate the experiment.

### Decisions and rationale

#### Build the simulation core independently from React

The economic engine was implemented as pure TypeScript under `src/sim`, separate from rendering and browser timing. Types define agents, strategy state, events, metrics, and snapshots; the engine owns the deterministic day lifecycle and transfers; the pricing module owns the firm's learning rule; and the invariant module validates state.

This separation was necessary for two reasons. First, economic behavior needed to be tested without mounting a UI. Second, future strategy or institutional changes should not require rewriting charts and controls. React was treated as an observer and clock controller, not as the location of economic rules.

#### Represent money only as integer cents and transfers

The total initial money supply is exactly 10,000 cents. Purchases move cents from households to the firm; taxation moves firm cash to government; redistribution moves every government cent back to households. No phase silently resets a balance or corrects drift.

Runtime checks verify integer and non-negative balances, exact total money, valid price and step sizes, valid sales counts, and zero institutional balances after taxation and redistribution. This made accounting failure an engine error rather than a visual anomaly discovered later in a chart.

The 100% tax-and-redistribution circuit is not intended as a realistic tax system. It is an explicit experimental mechanism that returns purchasing power while wages, dividends, ownership, and production remain outside MVP 0. Similarly, unlimited food is an exogenous simplification, not hidden production.

#### Make phase order deterministic and causally explicit

Each simulated day follows a fixed order: post the previously selected price, process households in ascending ID order, record the firm's result, select tomorrow's price, tax the firm, redistribute government cash, validate, and snapshot.

This ordering prevents accidental foresight. Today's sales cannot change today's price retroactively; the pricing strategy acts only after observing the completed experiment and determines the next day's price. Deterministic household ordering and the absence of randomness make identical configurations reproducible by construction.

#### Let the firm learn only through realised experiments

The firm maintains its own best tested price and realised profit, current step, direction, positive-profit discovery state, adjacent-cent test state, and convergence status. It does not read household balances, inspect an analytical demand curve, or contain a hard-coded 1,000-cent target.

When a realised experiment improves profit, the firm records it as the new best and continues exploring. A non-improving experiment after positive demand has been found causes search to return around the best-known price, reverse direction, and halve the step with a one-cent floor. At the minimum step, both adjacent prices must be tested through actual market days before convergence is declared.

A special bounded rule handles starts above the demand boundary. Before any positive-profit price has been found, repeated zero-sale results cause continued downward experiments instead of false convergence on a zero-profit plateau. Starting at $20.00 can therefore eventually encounter demand and enter normal hill climbing without any privileged information about why sales were zero.

#### Preserve an event ledger as the causal history

Important state changes emit typed events instead of remaining silent mutations. The initial implementation recorded day starts and ends, posted prices, each household purchase or failure, firm results and price decisions, taxation, each redistribution transfer, and convergence.

This event-first approach supports debugging and explanation at both macro and micro levels. Daily metrics summarise the world, while events retain the actions that produced those summaries. Histories were bounded to protect long-running browser performance; MVP 0 was not designed as a permanent archival system.

#### Build the interface as a research dashboard

The dashboard was designed to expose both aggregate learning and individual agents. It included controls for running, pausing, stepping, resetting, initial price, initial search step, and speed; headline metrics for current state; charts for price discovery, profit, quantity, and money; firm and government summaries; all ten household balances and purchase states; the strategy's latest explanation; and recent raw events.

The dark neutral, lime-accented visual system was intended to read as a compact research instrument rather than a game or generic administration panel. Configuration remained deliberately narrow so that interface flexibility did not imply unsupported economic flexibility.

### Implementation

The initial build established the Vite/React/TypeScript application and the `src/sim` modules for configuration, domain types, engine phases, pricing strategy, invariants, and tests. `SimulationState` is advanced through immutable snapshots, and `DayMetrics` captures price, best-known result, step, direction, market outcome, institutional balances, total money, and convergence.

The pricing decision returned its next price and a human-readable explanation generated by the strategy itself. This allowed the UI to state why the firm changed price without reverse-engineering the reason from chart data.

Documentation formalised the model, architecture, analytical benchmark, assumptions, exclusions, and validation procedure. The governing design-rules file was preserved under the repository-friendly name `SIMULATION_DESIGN_RULES.md`. A GitHub Actions workflow ran installation, type checking, tests, and production build before deploying the static artifact to GitHub Pages.

### Trade-offs and constraints

- Unlimited zero-cost food eliminates production, scarcity, inventory, labour, and cost decisions. It isolates price discovery but cannot answer production questions.
- Homogeneous one-unit household demand creates a discontinuous affordability boundary. It is useful for an exact benchmark but is not a general consumer-demand model.
- Full redistribution keeps household purchasing power stable and closes the circuit, but it suppresses distributional dynamics and should not be interpreted as realistic fiscal policy.
- One firm removes competition and strategic interaction. The $10.00 result is a monopolist revenue optimum under the model's assumptions.
- No randomness makes runs reproducible and debugging straightforward, but the model cannot yet study uncertainty or heterogeneous paths.
- Browser-only state makes the application simple and portable but provides no persisted experiments, server-side workloads, authentication, or shared results.
- The learner is intentionally a bounded heuristic. Its value is explainability and empirical discovery, not general numerical optimisation performance.

These were accepted constraints, not missing features to approximate prematurely. The governing principle was to build the smallest economic world whose behavior could be completely understood.

### Validation and result

The initial test suite contained nine passing cases. It verified the exact $5.00, $9.99, $10.00, and $10.01 market outcomes; conservation and cleared government/firm balances across 250 days; non-negative household balances; convergence from $2.00; escape and convergence from $20.00; determinism across identical runs; and stopping after both adjacent one-cent experiments failed to improve the best result.

Type checking, the production build, and the combined validation command passed. The local repository was connected to GitHub, the existing one-line initial README commit was preserved through an unrelated-history merge, Pages was enabled with Actions as its source, and the resulting public site was verified with an HTTP `200 OK` response and the expected title.

The implementation demonstrated that the closed circuit could conserve every cent while the firm independently discovered the known benchmark from both below and above the demand boundary. Just as importantly, the result remained traceable through snapshots, agent balances, strategy explanations, and typed events.

### Lessons

- A small analytical benchmark is valuable because it tests both economics and software architecture. The expected answer is known without becoming agent knowledge.
- Exact accounting is easier to trust when every monetary change is a transfer and conservation is asserted continuously.
- A strategy can remain bounded and explainable while still handling an important failure mode such as a zero-profit plateau.
- Time ordering belongs in the model contract. Separating today's tested price from tomorrow's decision prevents accidental foresight.
- The event ledger and structured metrics serve different purposes: events explain causes; metrics support analysis.
- Explicit simplifications are more useful than partially implemented realism. The first model established extension seams without adding unused economic systems.

### Open questions and next steps

- Which single additional mechanism would change the research question enough to justify the added state and accounting burden: finite production, labour income, or competition?
- Before expanding the economy, which parts of the learner's adjustment path are difficult to interpret from the existing charts and event ledger?
- How should future stochastic mechanisms be seeded and recorded so counterfactual runs remain reproducible?
- When persistent experiment comparison becomes useful, what minimal export or run-record format would preserve configuration, model version, events, and metrics without introducing a backend prematurely?
- How should the artificial redistribution circuit be retired once an endogenous mechanism such as wages or ownership returns firm revenue to households?
