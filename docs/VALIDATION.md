# Validation

## MVP8.1 UI/refactor validation

The 010.1 validation covers default Overview rendering, all five tab surfaces, active-tab-only charts, all nine payroll rows, all 100 household rows before filtering, household ID/employer search, deterministic non-mutating sorting, settings apply-on-reset semantics, terminology boundaries, and absence of positional economic-row hiding. Canonical seed `20260813` is compared through the values constructed by the UI reset path to confirm identical state and trajectory output.

Responsive browser checks exercise every tab at approximately 1280px and 390px, including internal table/map scrolling, settings usability, page-level overflow, console output, Recharts sizing, research triggers, and fast-mode practicality.

Verified on 2026-08-14: `npm run check` passed 94 tests across 17 files, typecheck, and production build. At 1280px and 390px, every tab had no page-level horizontal overflow; tables and the 20×20 map scrolled internally. The household table exposed all 100 households before filtering, geography exposed 108 entities, settings exposed eight firm-price inputs, and the browser console contained no warning/error entries. Fast mode advanced to day 280, although sustained N=100 stepping temporarily delayed automated pause interaction; execution batching was left unchanged.

Issue #2 follow-up (2026-09-05): runtime stepping is now owned by `SimulationRunner` rather than repeated `stepSimulation()` calls inside a React state updater. The runner schedules one simulation day at a time so the browser regains control between days, publishes only the latest completed state at a bounded observer cadence, and cancels obsolete scheduled work on pause, speed changes, reset, or teardown. Focused regression coverage checks exact-state equivalence with direct sequential stepping, cancellation, non-overlapping speed changes, reset synchronization, and render-cadence independence. The historical pause-delay observation above is retained as the pre-fix browser result.

Issue #8 makes the browser-level regression check durable. `.github/workflows/fast-mode-browser-validation.yml` builds the production application and runs `scripts/validate-fast-mode.mjs` in headless Chromium on pull requests targeting `main` and pushes to `main`. The smoke test verifies canonical N=100, then runs and pauses 100× fast mode five times: each time it confirms the simulation advanced, that the visible day does not move after Pause, and it records how long Pause took to become observable, requiring the median of the five to be within 1.5 seconds. Pausing once was noisy on shared runners; pausing repeatedly also exposed that the day shown could jump forward just after the Paused label appeared, because the last days computed were published a render later. Pausing now publishes them in the same update. The bound is intentionally looser than the original 500 ms review measurement to reduce CI flakiness while still detecting the original main-thread-stall failure mode.

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

The durable browser check runs through `.github/workflows/fast-mode-browser-validation.yml` from a production build. It intentionally remains separate from the local `npm run check` command because it installs Chromium and is meant as focused browser-level CI coverage. The Pages deploy, `.github/workflows/deploy-pages.yml`, waits for this workflow to pass on a push to `main` and then only builds and deploys that commit, so the site is never published from a commit whose tests or browser check failed, and the tests are not run a second time.

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

# Life 8

Life 8 is the only Life step in the repository; earlier steps, and their validation records, were removed in update 039 and remain in git history. Runtime invariants, checked after every minute of every test and experiment run:

- exact energy conservation, with every plant's stock replayed from regrowth and recorded work, and exact wood conservation with the wood in every group's fire counted: trees, foragers' wood and fires, plus wood burned, equal the starting wood plus regrowth;
- one turn per living forager each minute, 60 seconds in each turn, movement no further than its walking seconds at the speed its recorded load allows, and the load no more than the wood of the trip;
- work only in daylight, on a plant within reach holding a minute's work, and memory of the plant worked or targeted, and every hour of everything in view, matching what the forager saw;
- every place first marked seen lying wholly within sight, and every place within sight seen; every site within sight known, and checked exactly when the forager stood close enough to see all of it; every walk to a place or site aimed at one worth it and no further from it than before;
- a forager not hungry with a full load never idling, exploring, checking or seeking company, and only one with a full load taking it home, towards the hearth it had while it acted;
- groups replayed through each minute's foundings, joinings and dissolutions in turn order: each forager without a group meeting the nearest forager within talking distance, flags at the founders' midpoint, hearths on their slots, no standing group with fewer than two living members, and swaps, quotes and terms only between members of one group;
- every standing group's fire tended at the start of every night hour and at no other time, burning exactly its hour's wood (`campfireWoodPerHour`, or that for each living member at the start of the minute) if and only if it held that much, and lit for the hour exactly when it burned;
- every gift from a member standing at its slot on its group's spiral, into its own group's fire, of exactly the amount the rule gives, and the fire's wood following from its burning, its gifts and a dissolution's take-back;
- a member asleep by its group's fire burning none of its own wood, and warm exactly when the fire is lit; a forager without a group burning a fire's wood once an hour of sleep at most;
- every group's record of gifts adding up to what its fire has burned and holds, and every forager's gifts to the minute's; carried lots, practice logs and rates, swaps that pay both sides, and swap totals agreeing on both sides.

The experiments of the [specification](LIFE8_SPEC.md#experiments) are tests, on the first 8 seeds: who feeds the fire, how big a fire, spare wood and exchange, and groups over 100 days, and the band of 12 over 400. `fingerprints.test.ts` checks that Life 8 runs exactly as recorded over 30 days on three seeds, for the canonical valley and each configuration the experiments use. The numbers below come from 32 seeds over 400 days, measured over days 21 to 400; "own fires" means every forager keeping its own fire (`sharedFire` off).

- **Who feeds the fire.** In every standing group of two or more, on every seed, every member gives; none gives less than a quarter of an even share. A group's leading giver gives 1.10 times an even share in scattered groups and 1.38 in a band that starts as one group. Giving correlates with gathering at 1.00 across members; 39% of the wood given is spare, the rest taken from stocks for a low fire.
- **How big a fire.** Members burn 4.0 kg of wood a forager-day and gather for 0.28 hours, against 11.7 kg and 0.66 hours with own fires; with a fire of 2 kg an hour, 8.2 kg and 0.51 hours; with a kilogram an hour for each member, 11.8 kg and 0.68 hours. Members work 2.39 hours a day, against 2.85 with own fires.
- **Spare wood and exchange.** 3 runs of 32 swap, and members buy under 0.1% of the wood they burn, against every run and 9.4% with own fires; with a fire a member, 28 runs and 0.1%. With members giving only to a low fire, every run swaps and members buy 15.4%, and sleep cold 4.7% of night hours against 2.7%.
- **Groups.** A band that starts as one group burns 1.5 kg a forager-day and gathers for 0.12 hours, against 11.0 kg and 0.63 with own fires, and sleeps cold 1.7% of night hours against 8.4%. Fires are lit 97% of night hours in scattered groups and 98% in one group.
- **Capacity.** Bands of 8 and 12 are intact at day 400. A band of 16 keeps 6.0 survivors, all its deaths before day 100, against 5.8 with own fires.

Unit tests cover configuration validation; the layout and its streams; a forager's minute, choosing a plant, eating, spoilage and swaps; places, meeting, founding, joining and dissolving; sight, sites, exploring and searching; loads, speed and taking a load home; burning, going out and relighting, warmth, the night hours left, gifts of spare wood and of stock to a low fire, the record of who gave and a survivor taking back the fire's wood; and the checker catching damage to each kind of record. The view model is tested for drawing between minutes, plants and the camera, groups and what a forager knows, the fire's look by day and night, the contributions table and its sentence, the clear part of the view between cards on a desktop and a phone, and pins held at its edge.

In the browser, the group's fire burning at night with its members ringed and pinned around it, banked by day and drawn at the flag, the HUD's fire line and the wood the followed forager gave, selecting a group by its chip framing its members in the part of the view the cards leave clear, pins for members out of sight held at its edge, lines from the flag to members away, the group card's fire line and contributions table with its sentence, and the 375px layout with the group card scrolling and no sideways scroll, were checked by stepping the page; the console showed no errors after a fresh load.
