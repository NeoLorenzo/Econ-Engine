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

# Life 15

Use `npm run agent:check` as the implementation gate. On memory-constrained machines, `ECON_TEST_WORKERS=1` serializes the test workers.

`ValleyChecker` checks every interval that `stepValley` returns against the preceding immutable state, without running the engine again. `replay.ts` replays stocks, fish, bodies, tools, huts and water withdrawals from the recorded events and scheduled regrowth, and the checker compares the result with the returned state. It also checks positions and route segments against walkable, known mesh triangles, the order of wake-ups (world before people, no wake-up in the past), groups, hearths, fires and gifts, deaths and their causes, and observations against what could be seen. For ways it checks the count against `waysRemembered`, unique ends, ids and minutes, that each corridor holds its ends, has no gap and crosses only known ground, that walks on a way stay within its triangles, and that surveys happen exactly when the rule says. It also checks that nobody sets out on two leisure walks in a day and that `leisureMinute` matches the last one. Geography is checked once, including the mesh: winding, areas summing to the valley, mutual neighbours, shore edges parting ground from water, heights within `meshHeightToleranceCm` and the hydrology's shoreline within `shoreToleranceCm`. `invariants.test.ts` breaks one record at a time (fabricated or lost food, wood, logs, stones and tools; wrong body charges; wet or off-route positions; old queue entries; invalid groups) and expects the checker to catch it, after first checking that the untouched interval passes.

Rule tests use small explicit fixtures. A canonical thirty-day run is checked at daily intervals with all eight founders alive. Observer tests check that people are drawn on their recorded route at every displayed minute, that the drawn minute stays within the minute the state has reached, that the playback clock never goes back, asks no further ahead than its 0.1 s lead, runs at the speed shown when the engine keeps up and waits when it does not, that Step's minute is shown once it arrives, and that map speeds hide people. `viewCopy.test.ts` rebuilds each state's view copy from its changes alone, copied as between threads, at strides from 1 to 1,440 minutes and across a change of the person followed; checks that a copy keeps only the routes under way, each person's next wake-up, exchanges and walk records, and current memory only for the person followed; and that a state the engine recopied unchanged sends nothing. The worker leaves the engine unchanged, so update 069 keeps every fingerprint.

The 22 fingerprints are checked thirty-day runs, partitioned by configuration for parallel validation: three seeds each for the eight-person canonical, together, no-practice, craft-talent, equal-skill and flat configurations and the twelve-person one, and one run of the forty-founder default on seed 20260813 (about three to four minutes). Life 14 fingerprints passed before the engine changed. Life 15 re-records all 22 after the rule and checker tests pass, because remembered ways and fewer surveys change routes and so trajectories. A refactor or speed-up must leave them all unchanged. `runSettings.test.ts` checks the page's ranges, including 7 and 366 days rejected, and that a 1 km world can be laid out.

`node scripts/time-life.mjs 90 batch` times a canonical ninety-day year with the default forty founders; creation is reported separately. The benchmark excludes rendering and invariant checking. Life 14's ninety-day daily-interval measurement required `node --max-old-space-size=8192 scripts/time-life.mjs 90 daily`; the default 4 GB Node heap exhausted memory. It completed in 852.90 s with all forty founders alive. The speed target and long-run memory use remain unresolved.

`mesh.test.ts` checks a flat field of 40 m triangles, a fixture lake flat at its level and walled by shore edges, and heights linear within a triangle; `routes.test.ts` checks routes round a lake and a 5 m pond, unseen ground, and segments cut inside their triangles.

The browser check looks at the settings screen rejecting 7 and 366 days, Start showing the loading card, the low-poly ground and water, walking at 1 min / s, stepping, the task panel and the map at month-per-second speed, and the console.

Life 14 adds bounded-normal moments, integer factorisation and positive-definiteness checks, 10,000 draws per sex for body magnitudes and correlations, and 10,000 trait sets for all ten correlations. Small fixtures verify carrying, loaded speed, energy and thirst, each trait's direction, and checker rejection of damaged bodies, derived quantities, task charges and exchange prices. Rule fixtures explicitly supply a reference-weight/reference-grip body and neutral traits when old numeric assertions need them. `life13-founders.json` freezes starts and born skills on all three fingerprint seeds; those streams must remain unchanged.

`sites.test.ts` checks that an idle person at home with nothing to explore walks out along the way used longest ago, once a day, goes home to rest afterwards, and stays in when there is no time to return before dusk. `ways.test.ts` checks walking a way again and back the other way, joining one part-way and planning afresh from off it, the recheck after a day with new ground, forgetting the least recently used way and replacing one between the same ends, the same corridor at a slower pace under load, a coarse plan staying in its band, a coarse plan going round a wall of unknown ground, a chunk split into two pieces where its known ground is not joined, a plan between two pieces of one chunk going through the next chunk, chunks linked only across known ground, the 100 m survey rule, and the checker rejecting a way through unknown ground, a way with a gap, too many ways, a survey against the rule and a walk that needed the full search.

Browser acceptance covers the followed person's remembered ways drawn as lines, the task line naming the kind of walk, the "Ways" row, and the console. Earlier steps' acceptance covered a woman's and a man's person panels, five trait bars, figures scaled by height and weight, minute stepping and an exchange line with its price and gain share. Results and the single canonical year measurement are recorded in update 064's lab notes.
