# Architecture

Econ-Engine separates economic rules, agent strategies, state, events, observer analytics, experiments, and React presentation so causal boundaries remain inspectable.

## MVP8.1 observer architecture

React conditionally mounts Overview, Markets, Households & Labor, Government, and Research. Persistent controls own execution and draft initialization values. Tabs, selected industry, settings disclosure, household query, and deterministic sort order are local UI state only; none enters `stepSimulation` or an RNG source. Hidden charts and large observers are unmounted rather than visually concealed.

Overview provides economy-wide state; domain tabs provide detailed live state; Research hosts explicit independent experiment harnesses. Markets calls legacy `preTaxProfit` operating earnings, while payroll tables call `residualProfit` residual profit. Tables select agents semantically in React and never hide rows by CSS position.

## Simulation core

`types.ts` defines household, firm, Government, event, and bounded daily metric state. `engine.ts` performs immutable daily steps: labor-derived production, spatial consumer markets and Transport payments, inventory expiration, firm pricing decisions, cash-constrained contractual payroll, and finally Government tax/transfer policy. `invariants.ts` validates entity structure and exact stock/flow accounting after each completed day.

`SimulationConfig.householdCount` is the population authority. The canonical MVP8 economy has `N=100` households, while research configurations use complete ten-household blocks, including `N=10`. It has five industries and nine firms: two each in Food, Utilities, Healthcare, and Entertainment, plus one Transport firm. `SimulationConfig.firmsPerIndustry` (default 2) sets how many firms compete in each consumer industry; other values exist to test market structure. Firm IDs follow one scheme, `firm-<industry>-<slot letter>`, built and parsed only by `consumerFirmId` and `firmSlot` in `config.ts`, so no engine or UI logic depends on there being exactly two firms or on particular ID suffixes. The research harnesses that compare Entertainment Firm A with Firm B (the starting-price grid, the spatial competition probe and the generalized spatial analysis) build their own canonical two-firm economies and remain pairwise by design. Each non-Transport consumer firm employs `N/10` workers and Transport employs `N/5`; canonically those counts are 10 and 20. Consumer output is employee count times `laborProductivityUnitsPerWorker`; at the default productivity of five, each consumer firm produces 50 units per day at `N=100`. Transport does not use consumer-production units. Households choose available suppliers by delivered cost under percentage expenditure budgets.

## Daily step

`stepSimulation` copies the previous state (structurally sharing history) and runs named phases in a fixed causal order:

1. `startDay` clears every daily field and records `DAY_STARTED`.
2. `produce` sets each consumer firm's output from its workers' productivity.
3. `runMarkets` opens each consumer industry in turn. For each one, `clearMarket` executes the purchases and `decidePrices` expires unsold stock, books revenue, and runs the pricing strategy for tomorrow.
4. `runPayroll` pays contractual wages from revenue (pro rata when short) and then the 100% corporate profit tax.
5. `runFiscalPhase` lets Government trial a wealth-tax rate, collects the tax, redistributes by water filling, and judges the trial.
6. `buildDayMetrics` and `closeDay` record the bounded metrics, check every invariant, and close the event ledger.

The market RNG is drawn in this exact sequence: each industry's shuffle, then two draws per household for its preferred firm and tie-break number, then one draw per successful purchase, then that industry's price-probe draws, before the next industry opens. Pricing decisions therefore stay inside the per-industry loop rather than running as a separate phase after all markets.

## Market clearing order

Households do not simply buy in random order. For each consumer industry, `clearMarket` builds the purchasing order as follows.

1. **Seeded shuffle.** All households are shuffled with the market RNG.
2. **Preferred firm.** In shuffled order, each household ranks the industry's firms by delivered cost (posted price plus round-trip transport fee) and prefers the cheapest. An exact tie is broken by a seeded draw over the tied firms. Each household then draws a seeded tie-break number, so the RNG consumes two draws per household in shuffled order.
3. **Proximity priority.** At each firm, in firm-ID order, the households that prefer it are queued nearest first (ties by the tie-break number). The first households up to the firm's available stock form the primary queue.
4. **Fallback.** Households beyond a firm's stock form the overflow. The overflow from every firm is ordered by one-way distance to that household's next-best alternative, the cheapest firm by delivered cost other than its preferred one, with ties by the tie-break number. With two firms the alternative is simply the other firm.
5. **Purchase.** The primary queue buys first, then the overflow. Each household buys from the cheapest affordable firm that still has stock (within both its category budget and its cash), choosing among exact ties with a seeded draw. That draw happens for every successful purchase, even when only one firm is cheapest, so the market stream advances once per purchase. A household that can afford no firm records an affordability failure, classified as `category_budget` when even the cheapest delivered cost exceeds its budget and `cash` otherwise. A household that can afford a firm but finds none with stock records a stockout.

**Why.** The MVP4 lab notes record the intent: the nearest households receive earlier inventory access, seeded ties avoid giving priority by household ID, and an affordable fallback is tried before a purchase fails. They do not record why the overflow is ordered by distance to the alternative; in effect it gives the households closest to their second choice the first chance at it. Every step is explicit and seeded from the market stream (rules 7, 8 and 21), so the order is exactly reproducible.

## Strategy boundaries and RNG

`pricingStrategy.ts` owns private firm learning. Firms receive their own realized operating outcomes and, when they run a competitor-anchored experiment, the lowest price a rival in their industry advertised that morning; they do not receive rival sales or profit, household wealth, Gini, Government references, or future information.

`government.ts` owns the bounded Government learner and fiscal rules. Government sees current administered post-payroll cash and its realized policy history. It cannot inspect future markets or simulate counterfactual futures. Market ordering, geography, employment, payroll remainder, firm probing, and Government policy use deterministic seeds; Government has a dedicated substream so its experiments do not perturb unrelated stochastic sequences. Its seed is the salted master seed passed through the nonlinear `mixSeed` bijection, so it is neither equal to nor a fixed XOR offset of the market, spatial, or employment seeds under the linear xorshift generator.

## Fiscal accounting

The authoritative tax rate is integer basis points. Contractual payroll is cash-constrained, so firms can leave wages unpaid. After payroll, each firm's residual profit is explicitly transferred to Government as the fixed 100% corporate-profit tax. Independently, wealth-tax liabilities floor to integer cents and are explicit Household → Government transfers. Deterministic water filling returns the combined Government pool through Government → Household transfers; seeded tied-group ordering allocates indivisible remainder cents. After a completed day, firms and Government hold zero cash, while households collectively hold the full population-derived supply: `householdCount × 5,000 cents` (500,000 cents at canonical `N=100`).

Household state distinguishes pre-tax cash, gross tax, gross transfer, net fiscal transfer, post-fiscal cash, and cumulative fiscal positions. Government state retains incumbent/applied rates, current reference, experiment category/outcome, receipts, transfers, and pre/post Gini.

## Observer analytics and experiments

Live event and metric histories are bounded. `employmentDynamics.ts` preserves the MVP5 007.1 complete finite trajectory analysis. `governmentExperiment.ts` collects compact complete observations over an explicit horizon and compares adaptive Government with an inactive same-seed baseline. It reports policy occupancy/spells, pre/post inequality and concentration, consumption failures, sell-through, revenue, and wages. Observer computations never enter household, firm, or Government decisions.

`ensemble.ts` runs a harness across an explicit seed set and summarizes the spread of its decision-relevant outcomes (mean, sample standard deviation, interpolated 10th, 50th and 90th percentiles, and range). Each seed builds its own economies, so an ensemble never reads or advances a live simulation or its RNG. Results are keyed by seed and reported in ascending seed order, so neither the supplied order nor the order in which parallel workers finish can change a value. `ensembleSeeds(base, n)` starts with the base seed and derives the rest through the Murmur3 finalizer, so adjacent seeds do not feed nearly identical states to the linear xorshift market generator. In the browser, a small pool of Web Workers (one fewer than the CPU cores, at most four) runs seeds in parallel; the pure `runEnsemble` runs them sequentially for tests and scripts.

## Interface boundary

React controls configuration and time and renders Government, household fiscal positions, markets, trajectories, and experiment reports. Horizontal table scrolling preserves compact mobile layouts. No economic rule exists in React.
## Retained MVP7 settlement boundary

After markets and the unchanged price-learning evaluation, firms pay fixed cash-constrained contractual payroll. Residual cash is explicit profit and is transferred to Government as fixed 100% corporate profit tax. Government then collects its independently adaptive household wealth tax and redistributes the combined balance once. Monetary amounts use integer cents; payroll remainder ordering is derived independently from stable seed/day/entity identities.
## MVP8 configurable population

`SimulationConfig.householdCount` is the population authority. Canonical MVP8 uses 100; the scale harness also uses 10. Initial money, household generation, spatial entities, employment slots, production, payroll, demand denominators, and invariants derive from that value. Employment permits complete blocks of one worker per consumer firm plus two for Transport (ten households in the canonical economy), assigning `N/10` workers to every consumer firm and `N/5` to Transport through its isolated subseed. `createSimulation` validates the population, grid and market structure before building any agent.

## MVP9 plots and town layout

`spatial.ts` owns land. Households stand on single tiles (`Household.coordinate`); every firm and Government stands on a `Plot`, a rectangle of tiles whose size comes from `PLOT_SIZES` and `GOVERNMENT_PLOT_SIZE` in `config.ts`. `generateTownLayout` builds the whole town from the spatial seed, which no other stream shares:

1. Government's plot is centred.
2. Firm plots go in descending area, then by ID. A plot that is not square draws its orientation first, then draws its position uniformly from every position that keeps a one-tile gap from the plots already placed. If the drawn orientation fits nowhere, the other is tried.
3. Households are shuffled onto the tiles no plot covers.

The draw sequence is therefore: one orientation draw per non-square plot, one position draw per firm plot, then one draw per household.

`plotDistance` measures from a household's tile to the nearest tile of a plot, and `transportQuote` prices the round trip from it. The engine's delivered-cost ranking, the fallback order and affordability use `transportQuote(household.coordinate, firm.plot, rate)`, as do the observer's territory map and 2D market map, so the display cannot disagree with the model. `validatePopulationConfig` refuses a grid without room for every plot, its gap and one tile per household, and `invariants.ts` checks plot sizes, bounds and gaps and that no household stands on a plot.

The 3D world draws each firm and Government across its plot: `buildingScale` stretches the building model to the plot, less a 0.1-tile inset, and raises it with the square root of the plot's area. The camera's default distance, zoom-out limit, fog and far plane scale with the grid, and Locate stays further out for bigger plots.

## Life 12 checkpoint: through Task 8

The current core follows [LIFE12_SPEC.md](LIFE12_SPEC.md): one integer minute clock, queued world/person wake-ups, aggregate resource places, cached known-ground lattice routes, and recorded lazy tasks/bodies. `wake.ts` applies personal wake-ups; `world.ts` owns hourly and midnight work; `perception.ts` observes at wake-ups. Bank connectors and the spatial bank index are built once with the immutable layout. Goal estimates choose candidates before route search; water searches at most three candidates.

`invariants.ts` checks intervals against the preceding immutable state. `replay.ts` keeps copied stock/body/tool/hut ledgers, applies recorded transfers and scheduled regrowth, and checks final balances and memory traces. World, fish-growth and sleeping-rate records make cadence and changing warmth replayable. Geography is checked once. The observer port (Task 10), representation cleanup (Task 9) and fingerprint refresh (Task 11) are still pending; eight founders remain in this first pull request.

### Life 11 architecture reference, pending the Task 12 document replacement


`src/valley/` is the independent Life core described by [LIFE11_SPEC.md](LIFE11_SPEC.md). It imports only the pure RNG helpers from the frozen MVP9 core. Lengths and heights are integer centimetres, food integer kilocalories, wood integer kilograms and water deficit integer millilitres. The engine remains pure and deterministic.

- `terrain.ts` builds the glacial landscape from eleven named streams. Signed heights replace the north-edge ramp. `water.ts` samples cell beds, runs deterministic Priority-Flood, groups level depressions into lakes, accumulates catchments and cuts one-cell river channels. Parents decrease visitation rank; junctions and outlets split non-overlapping river reaches. Banks affect dry-ground exposure. Geography is generated once and shared outside mutable state.
- `layout.ts` rejects wet resource footprints and starts, and chooses a dry camp for a band starting together. `social.ts` assigns observed, reachable dry hut slots in ring order; founding or joining can be deferred. Moving a hearth does not move its owner or supplies.
- `sight.ts` and `waterKnowledge.ts` record visible cell footprints and individual bank edges. Place coverage remains separate from cell knowledge. Seeing a bank does not reveal a complete shoreline, drainage graph or fish stock.
- `routes.ts` searches observed dry cells with deterministic A* with admissible octile/zero heuristics, stamped reusable distance arrays and shared searches rooted at the current cell and remembered hearth, cardinal/diagonal integer distances and no diagonal corner crossing. Connector segments are checked too. A few moving-root goals use the octile heuristic; bulk queries and the stable hearth root share zero-heuristic frontiers. Heap ties use cell ID and equal-distance predecessors use the smaller ID. Canonical forward paths also supply exact subpaths as the person walks, while knowledge stays unchanged. Travel estimates share the exact per-edge rounding and ascent sums of common route prefixes, avoiding repeated waypoint allocation and terrain sampling; knowledge changes invalidate those sums. Route and connectivity caches depend on exact endpoints and knowledge revision; cache history cannot affect results. Newly observed cells extend disposable searches, with knowledge tokens invalidating reuse by an older or diverging state; equal-distance predecessors use the smaller cell ID. Exploration advances through observed frontiers. Bank selection visits an immutable spatial index of remembered shores, shared across state clones. Conservative distance and food-score bounds prune rings; exact routing still rejects disconnected or late trips.
- `fish.ts` holds one stock per lake or river reach. Capacity follows its own area; growth uses exact `BigInt` intermediates and an integer remainder. Small pools remain physical barriers even when their fish capacity is zero. Fish knowledge comes from attempts at discovered banks; an unsuccessful first attempt still costs a second of fishing.
- `hydration.ts` accounts for each living second: drinking, net resting/activity loss, thirst hysteresis and the fatal crossing. Separate integer remainders preserve fractional loss. Drinking is an explicit external reservoir withdrawal; fixed lake levels do not claim a finite water budget.
- `engine.ts` runs the documented minute phases. Walks break at waypoints, and each segment records grade, speed, terrain factor and cost. Production precedes its second's energy charge. Death stops the action immediately, leaving inactive seconds; only survivors meet, exchange and deliver. `food.ts`, `work.ts`, `fire.ts`, `huts.ts`, `axes.ts`, `trade.ts` and `practice.ts` retain their food, material, tool and learning roles.
- `invariants.ts` replays fish, water, energy, movement and the existing accounts. `waterKnowledgeChecker.ts` reconstructs an independent observed-ground map from observation events and checks routes against it. Immutable geography is validated once; touched records are checked each minute and complete stock/memory comparisons occur at their stated hourly boundaries. Water withdrawals are checked globally and by source.
- Daily summaries include drinking, loss, deficit, thirst and water-seeking time, deaths by cause and catch by body. `theory.ts` supplies land and water measurements; these aggregates never control decisions.

Tests include analytic water fixtures and corruption checks, existing economic/body/material rules on explicit fixtures, observer contact/interpolation checks and seven fingerprint partitions. `ruleFixtures.ts` is imported only by tests: surveyed ground and small explicit lakes isolate rules without changing production starts. No experiment tests are added.

Performance maintenance keeps these rules fixed. The numeric priority queue retains its priority/cell-ID ordering and reuses buffers across moving roots. An unknown-cell bit index skips already observed ground in ascending cell order; its knowledge token and revision prevent reuse after ground changes or on a diverging branch. Distant ground views are observed once per person and place, while resource memories still refresh. Observed frontier cells are maintained beside the disposable route caches and shared across clones until knowledge diverges; only newly observed cells and their neighbours need updating. Travel-prefix entries use generation stamps, so a changed root, speed or climb coefficient invalidates them without clearing a map-sized buffer. Reachability rejects unknown endpoints and impossible geometric budgets, then tests the shared homeward search before expanding from the moving position. Exact scalar estimates and failed-budget proofs are cached by endpoints, hearth, speed, ascent coefficient, terrain and knowledge revision. Previous site winners only change evaluation order, allowing an early exact bound; they never pin a choice. Idle classification reuses a reachable witness or an exhausted-budget proof only while terrain, position, hearth, speed, climb and knowledge match. Admissible outward and homeward bounds limit route expansion to the time available; an interrupted search retains its frontier and can resume for a larger budget. Observer ground textures depend on the knowledge revision, and bank geometry on the remembered bank count, rather than the minute clock.

`banks.ts` assembles immutable bank patches after hydrology: shared corners, bed centres and channel edge midpoints form clipped terrain/water triangles. Exact polygon areas supply physical habitat sizes. Height, footprint and segment queries share these triangles; a compact patch mask avoids geometric work away from shores. Observation records dry centres and exact contour approaches within fully surveyed cells. The route graph rejects unsafe edges, while checked connectors reach dry portions of shore cells. `WaterKnowledgeChecker` replays those observations and access points independently. Bare `deriveWater` grids are drainage/rectangular analytic fixtures; production terrain always assembles bank geometry.

`src/valleyView/` displays these same continuous water contours, channel beds and bank slopes. The dry mesh and every contact query use the same lattice. `valleyViewModel.ts` interpolates recorded movement segments; `LandMap.tsx` displays actual water, while the followed person's overlay uses observed cells. The inspector distinguishes true per-body fish stocks from fishing memories. The person panel shows hydration and death cause; optional arrows show downstream direction, not a physical velocity or discharge.

Playback budgets simulation work between completed minutes. It reserves the final adjacent state for interpolation and falls back to one minute per frame after a slow tick. High speeds are best effort; the renderer and controls get time between batches, and simulation time advances through consecutive real states. The engine batch stop callback controls only batch length and is unused by ordinary headless runs.

Observer maintenance: `tiledSurface.ts` partitions immutable terrain, water and bank triangles and attributes into meshes with local camera and shadow bounds. Tree parts use `TiledInstances` with stable global picking IDs; visible-tile iteration refreshes appearances on camera re-entry. Bank triangles share the core contact surface, and water picking maps local tile faces back to a source face-to-body table. Knowledge shading stays coplanar with depth bias. Cosmetic phases use displayed simulation time, including interpolation.
