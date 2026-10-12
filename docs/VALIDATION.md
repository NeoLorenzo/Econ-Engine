# Validation

## MVP8.1 UI/refactor validation

The 010.1 validation covers default Overview rendering, all five tab surfaces, active-tab-only charts, all nine payroll rows, all 100 household rows before filtering, household ID/employer search, deterministic non-mutating sorting, settings apply-on-reset semantics, terminology boundaries, and absence of positional economic-row hiding. Canonical seed `20260813` is compared through the values constructed by the UI reset path to confirm identical state and trajectory output.

Responsive browser checks exercise every tab at approximately 1280px and 390px, including internal table/map scrolling, settings usability, page-level overflow, console output, Recharts sizing, research triggers, and fast-mode practicality.

Verified on 2026-08-14: `npm run check` passed 94 tests across 17 files, typecheck, and production build. At 1280px and 390px, every tab had no page-level horizontal overflow; tables and the 20×20 map scrolled internally. The household table exposed all 100 households before filtering, geography exposed 108 entities, settings exposed eight firm-price inputs, and the browser console contained no warning/error entries. Fast mode advanced to day 280, although sustained N=100 stepping temporarily delayed automated pause interaction; execution batching was left unchanged.

Issue #2 follow-up (2026-09-05): runtime stepping is now owned by `SimulationRunner` rather than repeated `stepSimulation()` calls inside a React state updater. The runner schedules one simulation day at a time so the browser regains control between days, publishes only the latest completed state at a bounded observer cadence, and cancels obsolete scheduled work on pause, speed changes, reset, or teardown. Focused regression coverage checks exact-state equivalence with direct sequential stepping, cancellation, non-overlapping speed changes, reset synchronization, and render-cadence independence. The historical pause-delay observation above is retained as the pre-fix browser result.

Issue #8 makes the browser-level regression check durable. `.github/workflows/fast-mode-browser-validation.yml` builds the production application and runs `scripts/validate-fast-mode.mjs` in headless Chromium on pull requests targeting `main` and pushes to `main`. The smoke test verifies canonical N=100, confirms that 100× fast mode advances, requires Pause to become observable within 1.5 seconds, and verifies that the visible simulation day does not continue advancing after Pause. The bound is intentionally looser than the original 500 ms review measurement to reduce CI flakiness while still detecting the original main-thread-stall failure mode.

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

The durable browser check runs through `.github/workflows/fast-mode-browser-validation.yml` from a production build. It intentionally remains separate from the local `npm run check` command because it installs Chromium and is meant as focused browser-level CI coverage.

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

# Life 0

Runtime invariants, checked after every hour of every test and experiment run: exact energy conservation (patch stock + reserve + energy metabolized = starting stock and reserve + energy regrown), stocks within capacity, the reserve within its bounds and 0 once dead, a dead forager taking no action, the forager on the grid with a target that is a patch, foraging only in daylight on a patch observed to hold a full hour's harvest, and memory that matches what the forager stood on.

The three experiments of the [specification](LIFE0_SPEC.md#experiments) are tests:

- **Single-patch threshold.** On one tile with an empty patch, at every rate from 46 to 136 kcal/h for 400 days, the forager starves at 81 kcal/h or less, inside the predicted window for its day of death, and survives at 100 or more. Its reserve declines by more than 2 kcal a day at every rate up to 90 and at none from 91, matching `r* ≈ 90.9`.
- **Leisure.** At 100, 200, 400 and 800 kcal/h it forages 1.81–1.82 hours a day over days 21–400, against a predicted 1.818, and sleeps 12.
- **Local knowledge.** On the canonical four-patch world, it dies on all eight seeds at 20 kcal/h per patch, below the lower bound of 22.7, and survives on all of them at 50. The lowest sustained rate is 24–26 kcal/h per patch, 1.06–1.14 times the bound.

Unit tests cover configuration validation, layout, regrowth, each priority rule, hunger hysteresis, both patch-choice rules and tie-breaks, movement through the night, starvation, daily summaries, the 30-day event window and determinism. The observer's view model is tested for the display clock, light, the forager's path, posture at dusk and dawn, bush interpolation and the inspector.

In the browser, the forager was checked walking, foraging and sleeping, the inspector and chart were checked on desktop, the layout at 375px, and both pages had no console errors.

# Life 1

Runtime invariants, checked after every hour of every test and experiment run, extend Life 0's to the band: exact energy conservation (patch stock + every reserve + energy metabolized = starting stock and reserves + energy regrown), stocks within capacity, every reserve within its bounds and 0 once dead, every forager on the grid with a target that is a patch, exactly one turn for each forager alive at the start of the hour, foraging only in daylight on a patch the forager saw holding a full hour's harvest in its own turn, and every patch within a forager's perception radius remembered with the stock it held at the start of that forager's turn.

The experiments of the [specification](LIFE1_SPEC.md#experiments) are tests, on eight seeds over 400 days:

- **A band of one is Life 0.** Seven Life 0 runs, five that survive and two that starve, reproduce checksums recorded from Life 0's code before the change. Life 0's three experiments pass unchanged on `LIFE0_WORLD`.
- **Carrying capacity.** On the canonical world (`K ≈ 19.8`, `Kₛ = 10`), a band of 10 stays intact with a reserve that is not declining, and a band of 20 loses foragers. The largest intact band, searched from 20 down to 8, is 12–13, between `Kₛ` and `K`. A band of 40 collapses to 4–8 survivors, at most `Kₛ`, with every death before day 30 (the last between days 9 and 14), and no survivor's reserve declining.
- **Local knowledge in a band.** Seeing only its own tile, a band of 10 walks to emptied patches (11–24% of walks). With full information no walk ends at an empty patch, yet a band of 40 still collapses to at most `Kₛ`.
- **The cost of searching.** With walking costing 90 kcal an hour instead of 300, more of a band of 40 survive on every seed (14–16 against 4–8). At each cost the survivors number at most the smaller of `K` and that cost's `Kₛ`.

Unit tests cover the new configuration rules, starting tiles (forager 0 where Life 0's started, shared tiles allowed), the turn order (deterministic, different each hour, everyone eventually first), perception exactly at and beyond the radius, two foragers on a one-hour patch (the first forages, the second sees it gone), choosing again when a target is seen emptied and walking on when it is not seen, death within a band, determinism and the invariants every hour of a 60-day canonical run. The observer's view model is tested for standing apart on a shared tile, moving between standing places, stepping through the living band, the perception outline and the inspector for the followed forager.

In the browser, the collapse from 40, following a forager by click and by button, the inspector, setup validation (a band over 100 is refused) and the 375px layout were checked, with no console errors.

# Life 2

Runtime invariants, checked after every hour of every test and experiment run, extend Life 1's:

- exact energy conservation counting carried and spoiled food (patch stock + every reserve + all carried food + energy metabolized + food spoiled = starting stock and reserves + energy regrown);
- every carried lot positive, harvested in the past and not yet due to spoil, and nothing carried by the dead;
- foraging only on a patch the forager saw holding a full harvest, with luck matching the forager's stream for that hour, taking exactly `harvestKcal` on success and nothing on failure;
- every gift positive, no larger than the recipient asked, from a forager that is not a keeper to a living forager on the same tile at that point in the hour, and from a reciprocator only to a forager that owed it nothing before the gift;
- ledgers that agree on both sides of every pair and add up to all food given;
- with a camp, every living forager on the camp tile at the end of every night hour.

The experiments of the [specification](LIFE2_SPEC.md#experiments) are tests. Experiments 3 to 5 use the first 16 seeds in the tests; the numbers below come from `experiments.ts` on 32 seeds (64 for experiment 6), over 400 days.

- **Life 1 reproduced.** On `LIFE1_WORLD`, four runs (bands of 10 and 40 on two seeds) reproduce checksums recorded from Life 1's code before the change, field for field. Life 0's and Life 1's experiments pass unchanged on their worlds.
- **Bad luck on a single patch.** A lone keeper whose patch always holds a windfall of 24,000 (`p = 0.05`), over 400 seeds: 4.99% of foraging hours succeed (standard error 0.10%), and 13.8% of 2,878 hungry spells end in starvation (standard error 0.6%), inside the theoretical 12.9–15.0% for 37 to 40 tries.
- **Windfalls bring risk.** Bands of 12 keepers keep 12.0, 10.5, 5.7 and 1.3 survivors on average with windfalls of 1,200, 3,600, 6,000 and 9,600. With steady harvests the band is intact on every seed and nothing is ever carried.
- **Sharing as insurance.** Bands of sharers keep 6.9 against keepers' 5.7 at 6,000, and 2.2 against 1.3 at 9,600. Sharers give 0.7%, 4.4% and 10.5% of the harvest at 3,600, 6,000 and 9,600; reciprocators 0.5%, 3.3% and 7.7%. Nothing is given with steady harvests.
- **Perishability.** At 9,600, keepers lose 0%, 1.1% and 7.5% of their harvest to spoilage with food that keeps, lasts 48 hours or lasts 12; sharers lose 0.1% and 2.1% at the two finite shelf lives.
- **Who pays.** In mixed bands keepers receive gifts and give none. Survival by strategy is reported in the [lab notes](../LAB_NOTES.md): no strategy clearly leads.

Unit tests cover the new configuration rules; the camp tile and starting there; strategies by ID; the luck stream (deterministic, always successful when a harvest is one hour's food, and near its expected rate otherwise); a successful harvest eaten up to a full reserve with the rest carried, a failed hour, eating carried food oldest first and spoiling exactly on time; heading home exactly when the walk takes every daylight hour left, setting out only for patches reachable in time, dropping a target that is no longer reachable, and the whole band at camp every night of a 30-day run; requests; each strategy's order of service, including a reciprocator refusing until it is repaid in full; gifts at camp, capped by what the giver carries, eaten at the recipient's next turn; and the invariants catching a keeper's gift and ledgers that disagree. The observer's view model is tested for bundle sizes, the hour's gifts and their arcs on the gift's tile, the HUD's summary of a forager's strategy, food and gifts, and the walk home.

In the browser, the camp at night with its fire, bundles, a gift's arc at camp, the new HUD lines and charts, setup validation of strategy counts and the 375px layout were checked, with no console errors from the page.

# Life 3

Runtime invariants, checked after every hour of every test and experiment run, extend Life 2's:

- exact wood conservation (grove wood + the wood every forager holds, living or dead + wood burned = starting grove wood + wood regrown), alongside Life 2's exact energy conservation, with cold sleep metabolized like any other cost;
- every grove within 0 and its capacity, and every forager holding a whole, non-negative number of units;
- gathering only in daylight, at a grove the forager saw holding an hour's wood in its own turn, taking exactly its rate;
- wood burned only while sleeping and only where wood matters, a fire's worth at a time, and sleeping cold exactly when no wood was burned and cold sleep costs more;
- every swap and quote at the rounded-down midpoint of the two foragers' own terms, strictly between them, the seller's the lower; every swap of at least a unit, paid in full at those terms, from spare wood to a forager below its target, leaving neither past its target, taking no more food than the buyer carried or the seller had room for, and made on the tile where both stood;
- remembered terms from the past, and terms heard in the last hour agreed in a swap or quote that hour;
- swap totals that agree across the band with all the wood and food swapped.

The experiments of the [specification](LIFE3_SPEC.md#experiments) are tests. Experiments 3 to 5 use the first 16 seeds in the tests; the numbers below come from `experiments.ts` on 32 seeds (8 for experiment 2), over 400 days, with measures over days 21 to 400.

- **Life 2 reproduced.** On `LIFE2_WORLD`, three runs (the canonical mixed band on two seeds and a band of keepers at 9,600) reproduce checksums recorded from Life 2's code before the change, field for field, gifts included. Life 0's, Life 1's and Life 2's experiments pass unchanged on their worlds.
- **Wood and cold.** With equal skills no swap or quote happens, and every hour of the run with swapping on is identical to the run with it off. The band of 8 is intact on every seed and sleeps cold in 11% of its night hours; survivors gather for 85–94% of `nightWood / w` hours a day.
- **Comparative advantage.** Without swaps the correlation between a forager's own terms and its share of hours gathering averages +0.90; with swaps, −0.78. The two foragers that gather most bring in 33% of the band's wood without swaps and 69% with them, and 49% of the wood burned has been bought. Survivors average 7.5 with swaps and 6.9 without; the least skilled third survives 80% of the time against 52%. Cold nights rise from 12% to 16%.
- **The spread of skills.** With equal skills nothing is swapped. At every wider spread the correlation turns from positive (+0.90 to +0.94) to negative (−0.72 to −0.84). At 80–120% no one dies either way, and swaps cut a living forager's day from 3.40 hours of work and 3.79 of walking to 3.24 and 3.29. At 25–175%, survivors rise from 5.8 to 6.7 and the least skilled third's survival from 16% to 61%.
- **Telling terms.** With quotes off and steady harvests, nothing is ever swapped and every run is identical to one without swapping. With windfalls of 6,000, swaps start without quotes (651 a run), but the correlation only falls from +0.86 to +0.23 and survivors do not change (3.1 and 3.0); with quotes, 2,096 swaps, −0.75 and 3.6 survivors.

Unit tests cover the new configuration rules; groves in the layout after the patches; skills from their own stream, within range, with 100% giving Life 2's rates; each forager's own harvest; wood need with hysteresis, spare and wanted wood; burning a unit an hour and sleeping cold without one; gathering only an hour's wood, and only at a grove reachable in time; terms at the midpoint and strictly between own terms; partners served best terms first, on the same tile and alive; swap quantities limited by spare wood, want, the buyer's food and the seller's room; the seller eating what it received at once; everyone on the tile hearing a swap and only the pair a quote; quotes off teaching nothing; choosing work for trade, including trips, unsold wood and forgotten terms; and the invariants catching wood that is not conserved and a swap outside the two own terms. The observer's view model is tested for sites laid out inside their tile the same way every run, berries picked and trees felled one at a time in proportion to what a site holds, log sizes, colours by own terms, a swap's arc on its tile, lit and dark hearths, sleeping warm or cold, what a night's fire burns and saves, the HUD's trade summary and specialization points, and the grove inspector.

In the browser, trees, logs, lit and dark hearths at camp, a swap's arc with its log and parcel, the specialization chart and daily charts, the new HUD lines, the setup's switches and its validation of the skill range, and the 375px layout were checked, with no console errors.

# Life 4

Runtime invariants, checked after every hour of every test and experiment run, extend Life 3's:

- every forager's practice log holding exactly `practiceDays` days per task, each a whole number of hours from 0 to 24;
- every forager's hours worked at each task equal to the hours it has entered in its log plus its hours today, and a living forager's hours today no more than the hours of the day so far;
- every forager's rates equal to the ones its born skills and log give, with practice at 100% when it is off;
- practice only in the first hour of a day after the first, exactly once for each forager alive at its start, with the rates it recorded still in force and its log ending with the hours it added.

The experiments of the [specification](LIFE4_SPEC.md#experiments) are tests. They use the first 16 seeds in the tests; the numbers below come from `experiments.ts` on 32 seeds, over 400 days, with measures over days 21 to 400.

- **Life 3 reproduced.** On `LIFE3_WORLD`, three runs (the canonical band on two seeds and with swapping off on one) reproduce hourly checksums recorded from Life 3's code before the change. Life 0's to Life 3's experiments pass unchanged on their worlds. A band born equal with practice fixed at 100% is identical, hour by hour, to the same band with practice off.
- **Practice alone.** Without swaps nothing is swapped or quoted. In every run the highest wood share in the band is within 0.014 of the lowest (20% to 21%), and the highest own terms are within 11% of the lowest at day 100. Every forager settles at about 1,270 kcal and 18 units an hour, about 106% and 74%. Every band is intact. Cold nights fall from 11% of night hours without practice to 3%.
- **Practice and exchange.** Without practice, or without telling terms, nothing is swapped, and with quotes off every run is identical to the run without swapping. With practice and swaps every run divides: the first swap comes on day 15.5 on average (latest 25.7), own terms spread 1.86 times by day 100 (lowest 1.45), and the top two gatherers bring in 53% of the wood (47% to 63%), against 25% to 26% without swaps. 39% of the wood burned is bought. Every band is intact. Cold nights rise from 3% to 15%; work falls from 3.24 to 3.18 hours a day and walking from 3.56 to 3.31. 2.2 different foragers lead wood gathering over nine 40-day windows, and persistence is 0.67.
- **How long skill lasts.** With 10, 30 and 90 days of memory, persistence is 0.10, 0.67 and 0.96, the number of lead gatherers 4.8, 2.2 and 1.2, the top two's share of the wood 37% (lowest 32%), 53% and 57%, and the first swap comes on day 9.9, 15.5 and 32.4 on average.
- **How much practice matters.** With practice from 80% to 120%, 50% to 150% and 25% to 175%, own terms spread 1.24, 1.86 and 3.09 times by day 100, while the top two's share stays at 51%, 53% and 52% (lowest 45%, 47% and 39%). Every run swaps; at 80% to 120% the first swap waits until day 29 on average, and as late as day 82.
- **Practice and born differences.** In Life 3's band, born from 50% to 150%, with swaps: the correlation between born own terms and wood share is −0.78 without practice and −0.83 with it; own terms spread 3.73 and 5.80 times by day 100; survivors average 7.50 and 7.94, and the least skilled third survives 80% and 98% of the time. The top two gather 69% and 61% of the wood. Without swaps, practice raises survivors from 6.88 to 7.75 and the least skilled third's survival from 52% to 88%.

Unit tests cover the new configuration rules; the practice percentage at no hours, half way and far beyond, and the steady percentages of the specification's table; every forager starting at 100%; rates from born skill and practice, rounded down, and Life 3's rates with practice off whatever the log; the midnight update, which enters yesterday's hours, drops the oldest day, sets the rates and restarts the day's hours; rates changing only at midnight while the dead are left alone; and the invariants catching a rate that does not match the log, an hour missing from the log, and practice away from midnight. The observer's view model is tested for the colour scale over born skill and practice, the HUD's practice percentages, hours and rate changes, and the chart of own terms by day.

In the browser, the HUD's practice lines and rate changes, the chart of own terms fanning out from one line, the colours drifting apart, the setup's practice switch and fields and its validation of the practice range, and the 375px layout were checked, with no console errors.
