# Validation

## CI policy

Pull requests targeting `main` run all non-fingerprint correctness tests and one checked 30-day Life fingerprint: canonical configuration, seed `20260813`. Lint, typecheck, production build and the browser smoke check run alongside the tests. The required status remains `browser-check`, which succeeds only after both jobs succeed. Superseded PR checks are cancelled.

Merging triggers only the Pages workflow: it builds and browser-smoke-tests the actual main commit before publishing. It does not repeat the simulation suite. This accepts that integration or other-seed regressions may be discovered later instead of checking every combination after each merge.

Run **Validate fast-mode browser responsiveness** manually in Actions for the full test suite, split across three shards, including all 21 Life fingerprints. Local `npm run test:run` and `npm run agent:check` remain full checks. `npm run test:ci` selects the PR profile; `npm run agent:check -- --ci` runs that profile with logged lint, typecheck and build stages. The profile changes test selection only; it does not shorten runs, alter expected fingerprints or disable minute-by-minute invariants. No recurring full run is scheduled.

## MVP8.1 UI/refactor validation

The 010.1 validation covers default Overview rendering, all five tab surfaces, active-tab-only charts, all nine payroll rows, all 100 household rows before filtering, household ID/employer search, deterministic non-mutating sorting, settings apply-on-reset semantics, terminology boundaries, and absence of positional economic-row hiding. Canonical seed `20260813` is compared through the values constructed by the UI reset path to confirm identical state and trajectory output.

Responsive browser checks exercise every tab at approximately 1280px and 390px, including internal table/map scrolling, settings usability, page-level overflow, console output, Recharts sizing, research triggers, and fast-mode practicality.

Verified on 2026-08-14: `npm run check` passed 94 tests across 17 files, typecheck, and production build. At 1280px and 390px, every tab had no page-level horizontal overflow; tables and the 20×20 map scrolled internally. The household table exposed all 100 households before filtering, geography exposed 108 entities, settings exposed eight firm-price inputs, and the browser console contained no warning/error entries. Fast mode advanced to day 280, although sustained N=100 stepping temporarily delayed automated pause interaction; execution batching was left unchanged.

Issue #2 follow-up (2026-09-05): runtime stepping is now owned by `SimulationRunner` rather than repeated `stepSimulation()` calls inside a React state updater. The runner schedules one simulation day at a time so the browser regains control between days, publishes only the latest completed state at a bounded observer cadence, and cancels obsolete scheduled work on pause, speed changes, reset, or teardown. Focused regression coverage checks exact-state equivalence with direct sequential stepping, cancellation, non-overlapping speed changes, reset synchronization, and render-cadence independence. The historical pause-delay observation above is retained as the pre-fix browser result.

Issue #8 introduced the durable browser regression check, `scripts/validate-fast-mode.mjs`, run in headless Chromium against a production build. Its current CI triggers follow the policy above. The smoke test verifies canonical N=100, then runs and pauses 100× fast mode five times: each time it confirms the simulation advanced, that the visible day does not move after Pause, and it records how long Pause took to become observable, requiring the median of the five to be within 1.5 seconds. Pausing once was noisy on shared runners; pausing repeatedly also exposed that the day shown could jump forward just after the Paused label appeared, because the last days computed were published a render later. Pausing now publishes them in the same update. The bound is intentionally looser than the original 500 ms review measurement to reduce CI flakiness while still detecting the original main-thread-stall failure mode.

MVP2 historical validation combines analytical benchmarks, runtime invariants from that stage, deterministic black-box tests, a controlled five-firm experiment, and browser checks. The [design rules](../SIMULATION_DESIGN_RULES.md) remain authoritative.

## Historical MVP2 analytical benchmark (N=10)

For any industry with ten households, ten supplied units, and household budget `B`:

| Price | Sales | Expired | Stockouts | Affordability failures | Firm revenue |
|---:|---:|---:|---:|---:|---:|
| B − $0.01 | 10 | 0 | 0 | 0 | 10(B − $0.01) |
| B | 10 | 0 | 0 | 0 | 10B |
| B + $0.01 | 0 | 10 | 0 | 10 | $0.00 |

Default budgets and firm optima are Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5. Their sum is $50, so total revenue/tax/redistribution at the joint benchmark is $500. Every household spends and receives $50, ends at $50, and Gini is zero.

## Current runtime invariants (MVP8)

- There are five unique industries and nine firms: Food, Utilities, Healthcare, and Entertainment each have two firms; Transport has one.
- `SimulationConfig.householdCount` sets the configured population; canonical MVP8 uses `N=100`, and supported research populations are complete ten-household blocks.
- Every non-Transport consumer firm employs `N/10` workers; Transport employs `N/5`. At canonical `N=100`, consumer firms have 10 workers and Transport has 20.
- Each consumer firm's daily production equals its employee count times `laborProductivityUnitsPerWorker`; at default productivity, that is 50 units per consumer firm at canonical `N=100`. Transport has no consumer-production units.
- Every household has budget/outcome state and exactly one causal purchase outcome per completed day for each of the four non-Transport consumer industries. A purchase cannot exceed its behavioral budget; industry sales reconcile with those purchase outcomes.
- Consumer stock flow reconciles as `unitsProducedToday = unitsSoldToday + unitsExpiredToday`; inventory is non-negative, sales cannot exceed finite production or household count, and no consumer inventory carries over.
- `total household cash + total firm cash + Government cash = householdCount × 5,000 cents`; the canonical `N=100` total is 500,000 cents.
- Contractual payroll, paid wages, and unpaid wages reconcile; paid wages cannot exceed contractual payroll. Each firm's residual profit reconciles exactly to its corporate-profit tax.
- Government receipts reconcile as corporate-profit tax plus independently collected household wealth tax. Its complete combined pool is redistributed, household tax and transfer events reconcile to receipts and outlays, and after a completed day every firm and Government hold zero cash while households hold the full money supply.
- Live daily metrics and events are bounded.

## Current and historical automated coverage

Historical MVP2 coverage includes independent pricing states, five-purchase days, cross-market budget independence, learner isolation, seeded tie choice, probe adoption/restoration, persistent probing, and lower-supply stockouts. Current coverage includes industry and firm cardinality, household cash/budgets/outcomes, budget non-monetization, finite stock per consumer market, affordability/stockout distinctions, full tax pooling, equal redistribution, long-run balance/Gini/money stability, same-seed determinism, different-seed sampling, cumulative counters, reset, generic event identity/grouping, observer boundaries, and bounded histories.

## Historical MVP2 observed local settlement and continued exploration (N=10)

With starts Food $1, Utilities $2, Transport $5, Healthcare $15, Entertainment $20; initial step $1; supply ten each; and horizon 300:

| Industry | Endpoint | Convergence day |
|---|---:|---:|
| Food | $15.00 | 23 |
| Utilities | $12.00 | 19 |
| Transport | $8.00 | 12 |
| Healthcare | $10.00 | 14 |
| Entertainment A | $4.00 | 12 |
| Entertainment B | $4.00 | 13 |

Entertainment A started at $1 and B at $8. Broad discovery still locally settles around $4/$4, after which seeded probes continue; equal-price demand is no longer forced to split 5/5. In sampled 300-day runs with seeds `20260813`, `7`, and `42`, incumbents remained $4/$4 while probe days continued.

For $5/$5 starts, all three sampled seeds escaped the formerly frozen state. After 300 days the incumbents were $4.99/$4.98 for seeds `20260813` and `7`, and $4.99/$4.99 for seed `42`. These are sampled learner states, not competitive equilibria or hard-coded targets.

The joint run ended on day 23 after Food reached $15; Utilities, Transport, and Healthcare retained $12/$8/$10. Every household held $50, Gini was 0, and total money was $500.

A 1,000-day run kept total money at $500, all household balances equal at $50, Gini at zero, all six firms non-negative, every per-firm stock flow balanced, total Entertainment sales at or below ten, control incumbents at $15/$12/$8/$10, and histories bounded. Identical-seed long runs were deterministic.

Changing industry processing order remains a different configured causal ordering and can consume the seeded stream differently. Both tested orders preserve accounting and control incumbents. Identical configurations and seeds produce identical full state, metrics, events, and cumulative outcomes.

Lower common supply remains an explicitly different scarcity configuration: it produces valid stockout events and can retain wealth divergence/path dependence. It is not forced into canonical stability.

## Validation commands

```bash
npm run lint
npm run test:run
npm run typecheck
npm run build
npm run check
```

The durable browser check runs from a production build through the shared `.github/actions/browser-smoke/action.yml` action. It remains separate from local `npm run check` because it installs Chromium. PR/manual validation and the Pages workflow both use this action. Pages builds and smoke-tests the actual main commit before uploading its deployment artifact, without rerunning simulation tests.

Final command and browser results are recorded in the newest changelog and lab-note entries. Validation establishes accounting, causality, reproducibility, and the known controlled benchmark; it does not establish realism, welfare, or general equilibrium.

Desktop and 390px browser checks passed with the populated six-firm experiment. Both tables used contained horizontal scrolling at mobile width, charts stayed within their panels, the page had no horizontal overflow, and the console contained no warnings or errors.
# Historical MVP7 validation

The MVP7 N=10 validation reconciled contractual payroll, actual and unpaid wages, residual profit, corporate tax, split Government receipts, combined redistribution, zero firm/Government closure, and exact 50,000-cent conservation. A dedicated 10,000-day test also checked non-negative balances and bounded live histories.

Canonical seed `20260813`, days 1–1,000: contractual payroll $100,000.00; wages $88,037.35; unpaid wages $11,962.65; fulfillment 88.04%; residual profit/corporate tax $47,705.36; household wealth tax $42,447.67; combined redistribution $90,153.03; effective-equality occupancy 85.8%; mean cash Gini 0.00198; mean wage Gini 0.09118; consumption completion 92.28%. Corporate tax financed 52.92% of redistribution. Transport and both Entertainment firms had incomplete payroll on all 1,000 days, while Food firms fulfilled payroll on more than 93% of days; this variation is reported, not wage-tuned.
# MVP8 population scaling

Canonical invariants are 100 households, 100 unique employment assignments, 10 workers and 50 units per consumer firm, 20 Transport workers, and exactly 500,000 cents. The N=100 10,000-day stress path clears every firm and Government balance, prevents negative balances, and retains bounded histories.

The seed `20260813` N=10/N=100 comparison over 1,000 days measured consumption completion of 92.278%/95.404%, market-share volatility of 0.1956/0.0560, extreme-share occupancy of 3.725%/0.075%, payroll fulfillment of 88.037%/87.200%, effective-equality occupancy of 85.8%/79.3%, and mean applied wealth-tax rates of 9.392%/25.085%.

# MVP9 plots

Runtime invariants add: household coordinates are unique, in bounds and on no plot; every plot lies in bounds, has its owner's size in either orientation, and keeps at least one empty tile from every other plot. Money is still conserved exactly at 500,000 cents.

Tests cover `plotDistance` (0 on a plot, 1 beside an edge, corners, and equality with Manhattan distance for a one-tile plot), deterministic layouts, Government centred, plot sizes, bounds and gaps across seeds, both orientations of a non-square plot, no household on a plot, capacity errors, and that the market, probe, Government and employment streams are unchanged by the layout. A territory test checks that a wider plot reaches further.

No existing simulation test needed a new expected value: they assert behaviour rather than layout-specific numbers. Tests that set hand-made firm locations now give those firms one-tile plots, and the grid-capacity tests use the new message and limits.

The eight-seed MVP8/MVP9 comparison is in [MVP9_SPEC.md](MVP9_SPEC.md#mvp8-and-mvp9-compared). The fast-mode browser check passed with a pause latency of 256 ms. In the browser, the 40×40 town, plot buildings, the overlay and scenery, clicking a plot, Locate, the 2D market map and the 375px layout were checked with no console errors.

# Life 12 checkpoint: through Task 8

Use `npm run agent:check` as the implementation gate. At this intermediate checkpoint lint passes; observer type errors still block its later stages until Task 10. Old Life fingerprints are intentionally not accepted as Life 12 records; Task 11 refreshes them after rule validation.

The focused core suite excludes the old fingerprints and the observer path (the `src/valley` filter also matches `src/valleyView`). It covers retained fire, hut, tool, social, food, water and load rules at task boundaries, canonical thirty-day survival, and an interval checker run after every canonical day. Corruption fixtures first accept an intact interval, then require a named checker failure after damaging production, body charges, resources, observations, geometry, queues, transfers, groups or death records. Layout/water/bank checks run once per checker. Small cache fixtures compare cold/warm routes, observed connectivity, exhaustive bank-estimate ordering and clone isolation.

`node scripts/time-life.mjs 1 batch` measures a canonical day; `node scripts/time-life.mjs 90 batch` measures a ninety-day year with eight founders. Creation is reported separately. The benchmark excludes rendering and invariant checking; the checked thirty-day regression verifies the same core with the ledger enabled. Timings and deliberately removed old assertions are documented in [LAB_NOTES.md](../LAB_NOTES.md).

## Life 11 validation reference, pending the Task 12 document replacement

[Life 11](LIFE11_SPEC.md) adds terrain-derived permanent water and drinking. Calibration evidence and estimates remain distinguished in [CALIBRATION.md](CALIBRATION.md). `npm run agent:check` is the final implementation gate. On memory-constrained machines, `ECON_TEST_WORKERS=1` serializes workers without reducing test selection or checker coverage.

The minute checker retains food, energy, wood, log, stone, tool, practice, group, fire and exchange accounting. It additionally checks:

- unique lake/reach membership, exact continuous polygon areas, shared bank contact, depths, outlets, contributing areas and an acyclic downstream graph with non-rising surfaces;
- dry resource/start/structure placement, observed dry routes, diagonal/connector safety, segment endpoints, grade, speed, terrain cost and summed climb;
- water observations against visibility and an independently replayed cell/bank memory;
- each body's `initial + growth - catch = stock`, its exact growth remainder and source-specific fishing attempts;
- each person's `initial deficit + loss - drink = deficit`, per-second loss and hysteresis, bank access, action seconds and immediate death;
- external withdrawals globally and by source, with no further metabolism, work or exchange after death.

`banks.test.ts` checks centimetre contours against sloped ground, physical point/segment/footprint collision, reachable bank approaches, corrupted polygon records and submerged connections along river drainage. Small analytic tests also cover a slope, bowl/spill, flat and confluence; exact fish arithmetic including large products and zero capacity; 2,000 ml resting loss per day and 440 ml extra from four hours picking; drinking before loss and the fatal second; known routes around water and blocked diagonal corners. Integration tests cover night drinking, independent fish bodies, a first attempt at a fishless pool, corruption of water/fish/death records and dry observer interpolation. Existing rules use explicit surveyed-ground/water fixtures where those details are outside the rule under test. Fixture waits are bounded so death cannot turn a test into an endless search for later work.

The existing 21 fingerprints remain checked 30-day runs, partitioned by configuration for parallel validation: three seeds for canonical, together, no-practice, craft-talent, twelve-person, equal-skill and flat configurations. Geography and thirst intentionally change trajectories in this step. Fingerprints are recorded only with the checker enabled, after the rule checks pass; they are never a substitute for those checks.

Pure Life 11 performance repairs retain all 21 fingerprints. The owner-approved continuous-bank geometry received 18 new fingerprints after its rule and checker fixtures passed; the three flat-land fingerprints remained unchanged. All 21 records were generated with the minute checker enabled, and the refreshed canonical record passed an independent repeat in the CI implementation gate. `routes.test.ts` additionally compares cached estimates against explicit per-segment time and climb sums after changes of root, speed, climb coefficient and knowledge, including older branches. Budget-limited searches must resume with the same route and cost as cold searches, including budgets immediately below and at the exact travel time. Its frontier regression compares incremental candidates with a complete independent mask scan on diverging branches. An independent exhaustive Dijkstra fixture compares complete predecessor paths in both directions across changing goals, failed budgets, new corner connections and older branches. `walkEstimates.test.ts` checks cached rejection boundaries and exact costs through speed, hearth, terrain and knowledge changes. Unknown-cell fixtures cross word boundaries and divergent snapshots. Canonical subpath fixtures compare routes and ascent sums with cold searches before and after new knowledge. Idle-classification fixtures compare cached proofs with exhaustive nearest-plant reachability across daylight resets, position, hearth and ground changes. Shore fixtures cover chunk boundaries and a clone learning another bank. These are small correctness fixtures; timing a canonical workload diagnoses performance without changing rules or disabling invariant checks.

`waterStats` reports water area, lake sizes/depths, represented river length, drainage density and exits. One-cell channels are a 5 m resolution limit, and filled depressions assume saturated land. These dimensions are estimates pending comparison with a selected mapped reference window. River fish calibration, dehydration thresholds and food moisture remain unresolved. No multi-seed calibration sweep, long experiment or claimed year-scale benchmark is added during feature building.

The browser acceptance check inspects lake and river contact, a drinking person, routing/interpolation and the console. Camera, arrows and shading do not change simulation state.

Playback fixtures exercise a stopped batch, a slow atomic tick, an affordable batch and interpolation without stepping. Each result matches its exact simulation prefix, preserves the input state and leaves adjacent states for drawing. The browser check also verifies that maximum-speed playback can pause, step and toggle Flow with a clean console.

Observer repair fixtures verify preserved triangles/attributes and local tile bounds, visible-plant iteration and picking IDs, and dry bank-lip heights at wet-owned boundaries. Browser acceptance compares canonical camera geometry, inspects lake/river contact, checks high-speed pause/step/Flow, and verifies fixed simulation time holds cosmetic phases.

Continuous-bank fixtures cover a lake clipped across sloping ground, connected channels, shared integer contours, physical point/segment/footprint collision, dry bank connectors, area replay and rejection of corrupted triangle coordinates. The old canonical fingerprints pass before geometry edits; refreshed records must retain minute-by-minute checking. Browser acceptance includes a substantial lake shore, a river, real water access and a clean console.
