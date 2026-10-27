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

## Life 15: habitual routes, bodies, clock and ground mesh

`src/valley/` is the independent Life core described by [LIFE15_SPEC.md](LIFE15_SPEC.md). It imports only the pure RNG helpers from the frozen MVP9 core. Quantities are integers: centimetres, kilocalories, kilograms, millilitres and minutes. `stepValley(state, toMinute)` is pure and deterministic: it clones the state, runs every queued wake-up up to `toMinute` and sets the clock there.

- **Bodies and personality.** `nature.ts` draws bounded integer normals and applies integer Cholesky factors to body and Big Five correlations. `layout.ts` owns isolated body and traits streams; founder positions, skills and craft draws are unchanged. Each person stores immutable body measurements, trait scores, derived thresholds, load and rates. `personConfig` supplies a cached personal view to shared body, route and task helpers; run settings stay separate. Founder means and spreads by sex are recorded once, in thousandths. State copies copy the small body/trait records independently.
- **Clock and queue.** `clock.ts` holds the wake-up queue, ordered by minute, then world before people, then person id. `calendar.ts` turns a minute into a day, a season and a year of `daysPerYear` days. `world.ts` owns hourly and midnight work: regrowth, fish growth, fires and daily summaries. `wake.ts` handles a person's wake-up: it settles the task that ended, perceives, chooses the next task by priority and queues the next wake-up.
- **Places.** `places.ts` and `layout.ts` place berry and hazel thickets, wood stands and stone outcrops as aggregate stocks, indexed by place id, with their own regrowth (`logRegrowth` keeps each felled tree's schedule). The terrain, water, shore geometry and fish of Life 11 (`terrain.ts`, `water.ts`, `banks.ts`, `fish.ts`) are kept unchanged.
- **Ground mesh.** `mesh.ts` builds, once per layout, a constrained Delaunay triangulation (Delaunator and Constrainautor, pinned) over the whole valley: the hydrology's shorelines simplified to within `shoreToleranceCm`, relief vertices from a quadtree of squares from `meshMaxEdgeCm` down to one terrain cell, and refinement until every dry 5 m point is within `meshHeightToleranceCm` of the terrain. Each triangle has an area type (ground, lake or river), neighbours, a chunk and a region; the largest walkable region is the main land, where founders start. The mesh is cached per terrain and checked once by `meshViolations`.
- **Knowledge and routes.** `perception.ts` records what a person sees at a wake-up: mesh triangles, places with their stock, bank points and other people. Triangle knowledge is a bitset shared between a state and its copy until its holder learns something. `routes.ts` runs A\* over known ground triangles, pulls the path straight through the corridor with the funnel algorithm, and cuts it at triangle edges into segments with their slope and walking time. Bank points sit on the ground side of each shore edge. A new route is planned coarse to fine: an A* over the mesh's chunks, linked only across ground the person knows on both sides (`ChunkLinks`, precomputed per mesh), gives a band of chunks, and the triangle search stays inside it, falling back to the whole known ground when the band holds no path. The still landscape is surveyed again only after moving `resurveyCm` (100 m) from the last survey point; stock at the person's place, people and fires are seen at every wake-up.
- **Ways.** `ways.ts` keeps each person's remembered ways: immutable corridors of triangles between two ends (the hearth, a place, a known bank point), at most `waysRemembered` (64), the least recently used forgotten first. A walk to such an end takes a way that holds the walker's triangle, whole or joined part-way, in either direction; the route is pulled straight along the way's corridor at the walker's current load. A way is planned again once a day has passed and the person has seen new ground since, or at once if it crosses ground no longer known. Walk events record whether the walk used a way, joined one or planned a new one. An idle person with nothing to explore takes one leisure walk a day along the way from home used longest ago (`leisureMinute`), goes home when away, and otherwise rests.
- **Tasks and lazy bodies.** `tasks.ts` builds a `TaskRecord` (kind, start and end minute, place, route, reason, starting body and load). `body.ts` gives energy and water at any minute of a task in closed form (`energyAt`, `waterAt`), and `positionAt` gives the position along its route. Nobody is advanced minute by minute. Food, wood, fire, huts, axes, trade and practice (`food.ts`, `work.ts`, `fire.ts`, `huts.ts`, `axes.ts`, `trade.ts`, `practice.ts`, `social.ts`) apply their rules when a task settles or two people meet.
- **Checker.** `invariants.ts` checks each interval against the preceding immutable state. `replay.ts` keeps separate stock, fish, body, tool, hut and water ledgers, replays recorded transfers and regrowth, and compares them with the returned state. Geography is checked once.

`ruleFixtures.ts` is imported only by tests: surveyed ground and small explicit lakes isolate rules without changing production starts.

The page opens on `LifePage.tsx`, which shows the settings screen (`RunSettingsScreen.tsx`) until Start and then a `ValleyApp` for the run it built. `runSettings.ts` is pure: it turns the five run settings into a configuration, scaling the counts of places and landforms with the world's area, and returns the first thing wrong with them. A running `ValleyApp` never changes its settings; New run returns to the settings screen. `LifePage` keeps the loading card up until `ValleyApp` calls `onReady`, after the 3D view has drawn its first frame or failed to start.

The observer, `src/valleyView/`, keeps one state and a continuous displayed minute within the minute that state has reached. Every wake-up up to the drawn minute has run, and none after it, so each person is drawn from the task actually under way: position from `positionAt`, a gesture from the task's kind, energy from `energyAt`. Below a day per second people walk continuously. From a day per second up, people are hidden and the valley is drawn as a map of stocks, groups and huts. Each frame runs the engine in steps of at most 15 minutes, checking its 40 ms budget between steps and always running at least one. When the budget runs out first, the drawn minute stops at the last step finished, so the clock runs slower than asked rather than freezing the view. Plants and ground are drawn in 500 m tiles near the camera, and the followed forager's overlays are redrawn at most every 250 ms. Thickets, stands and outcrops are drawn as decoration: a fixed number of bushes, hazels, trees or rocks per place, sharing out the place's stock in turn, so what is drawn stays in proportion to what is there. The decoration uses no simulation stream.

The person panel shows body measurements and five trait bars; figures scale with height and weight. Recent exchange lines show kcal per kilogram and which party received the larger share.
