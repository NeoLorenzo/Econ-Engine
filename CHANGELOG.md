# Econ-Engine changelog

All notable changes to Econ-Engine are documented here. The changelog records what changed in each update. Design rationale, experiments, observations, and lessons are documented separately in [Lab Notes](LAB_NOTES.md).

## [MVP4-Spatial_Competition_Full-006.4] - (2026-08-14)

- Added a permanent design rule requiring dynamic behavior to be evaluated from trajectories rather than inferred from terminal snapshots.
- Changed generalized spatial competition reports to analyze all days 1–1,000 with no implicit burn-in.
- Added leadership/tie occupancy, mean and cumulative sales shares, leadership transitions, and leading-spell duration.
- Added temporary 100%-share occupancy and spell metrics without classifying those days as monopoly.
- Added posted/incumbent price ranges and means plus cumulative, mean, and industry-share zero-cost profit.
- Reframed retained end-of-horizon values as secondary day-1,000 terminal snapshots.
- Added synthetic trajectory, tie-transition, spell, aggregation, purity, and seeded 1,000-day reproducibility tests.

## Maintenance convention

Every meaningful software update should receive a newest-first entry with a readable update identifier and date. Use at most one base update number per Git commit. Refinements completed before that commit keep the same base number with a decimal suffix—for example, `003` and `003.1` belong to the same commit family. Allocate the next base number only for a later commit. Record the update's scope, additions, changes or fixes, and relevant validation. Include only headings that apply. Keep entries factual and implementation-focused; if a change or validation result cannot be verified, omit it or label it uncertain rather than reconstructing it.

## [MVP4-Spatial_Competition_Full-006.3] - (2026-08-14)

### Added

- Added Food A/B, Utilities A/B, and Healthcare A/B alongside Entertainment A/B, producing four two-firm spatial consumer markets plus the single derived Transport monopoly.
- Added seeded unique coordinates for all eight consumer firms and all ten households, generalized delivered-cost clearing, proximity inventory priority, fallback, and competitor-aware experiment catalogs across every consumer industry.
- Added integer basis-point expenditure shares—Food 1290, Utilities 600, Healthcare 790, Entertainment 460—plus a separate configurable daily expenditure base and deterministic integer-cent derivation.
- Added per-household spatial outcomes by industry, per-firm delivered-cost and travel metrics, Transport revenue by originating industry, a generalized map, budget summary, competitive-pricing inspection, experiments, and regression coverage.

### Changed

- All modeled consumer purchases now generate separate product and Transport transfers. Transport remains unlimited-capacity, fixed-rate, non-adaptive, and without a household expenditure share.
- Fixed authoritative dollar category limits were replaced by derived limits from the daily expenditure base and shares. The modeled shares intentionally total 31.4% and unused limits remain ordinary household cash.
- Generalized Entertainment-specific spatial terminology and clearing code while preserving Government parity, exact money conservation, finite inventory, seeded RNG streams, and the 006.2 structural-sharing step architecture.

## [MVP4-Spatial_Competition_Full-006.2] - (2026-08-14)

### Changed

- Removed `structuredClone(previous)` from the daily simulation hot path and replaced it with targeted immutable copies of households/outcomes, firms/pricing state, Government, and history array containers.
- Existing immutable configuration, industries, spatial coordinates, daily metric records, and ledger event records are now structurally shared between consecutive states.
- Retained the existing five-day batching per React publication at 100 days/second; every economic day still executes sequentially.

### Validation

- Added previous-state immutability and historical-reference-sharing tests, exact 1,000-day same-seed replay, and a 10,000-day stress regression with 400 metrics, no more than 600 events, and exact terminal invariants.

## [MVP4-Spatial_Competition_Full-006.1] - (2026-08-14)

### Added

- Added public same-industry competitor sticker-price observation for Entertainment firms only.
- Added seeded dynamic price-experiment catalogs containing incumbent-anchored one-cent, 5%, 10%, and 20% moves plus competitor match, adjacent-cent, and 5% anchors.
- Added structured experiment categories and `PRICE_EXPERIMENT_STARTED`, `PRICE_EXPERIMENT_ADOPTED`, and `PRICE_EXPERIMENT_REJECTED` observer events with incumbent, experimental, competitor, and profit-reference fields.
- Added a compact Entertainment pricing-intelligence panel and catalog, information-boundary, reference-refresh, adoption/rejection, sequence, and long-run regression coverage.

### Changed

- Locally settled firms now choose experiments randomly from a regenerated, deduplicated catalog instead of limiting persistent exploration to adjacent cents.
- Experiment profit is compared strictly against profit from the most recent normal incumbent-price day, rather than a potentially stale historical maximum.
- Firms that sold their entire stock on the just-completed day now mask every below-incumbent catalog candidate; upward experiments remain available, and discounts return when the firm does not sell out.
- Monopoly controls receive incumbent-anchored candidates only; Transport, spatial household choice, parity restoration, and transaction accounting are unchanged.

## [MVP4-Spatial_Competition_Full-006] - (2026-08-14)

### Added

- Added a seeded static 20 × 20 integer grid with unique fixed coordinates for ten households and Entertainment Firms A and B, generated from an isolated derived spatial RNG stream.
- Added Manhattan round-trip travel, a configurable 2-cent-per-tile rate, delivered-cost choice, seeded ties, proximity priority, and affordable inventory fallback.
- Added separate product and Transport transfers, spatial events/analytics, explicit parity transfers, pre/post-parity Gini, and a multi-seed experiment.
- Added a responsive static tile map with household numbers, distinct A/B markers, coordinate and delivered-quote tooltips.
- Added `docs/MVP4_SPEC.md` and spatial, accounting, determinism, experiment, and 1,000-day stability coverage.

### Changed

- Removed abstract daily Transport-unit consumption. Transport is now an unlimited-capacity, inventory-free derived Entertainment travel service with an exogenous rate and no adaptive pricing.
- Entertainment budgets and cash checks now apply to delivered cost. Food, Utilities, and Healthcare remain non-spatial with unchanged learners and demand boundaries.
- Replaced equal redistribution with explicit household-specific transfers restoring the configured $50 target after 100% taxation of every firm, including Transport.
- Preserved the 005.2 pricing strategy and private information boundary unchanged.

## [MVP3-Entertainment_Competition-005.2] - (2026-08-13)

Replaced artificial ordering and terminal learner convergence with reproducible seeded sampling and persistent local price exploration. No new market mechanism or competitor information was added.

### Added

- Central xorshift32 seeded RNG (canonical seed `20260813`) with reusable draw, shuffle, selection, and probability utilities; the UI exposes the run seed.
- Seeded household arrival shuffles for every market/day and seeded equal-price firm selection.
- Independently sampled 10%-per-day one-cent probes for locally settled firms, with explicit incumbent/reference profit, probe direction/state, and `PRICE_PROBE_STARTED`, `PRICE_PROBE_ADOPTED`, and `PRICE_PROBE_REJECTED` events.

### Changed

- Terminal pricing convergence is now local settlement: firms retain broad discovery, then remain capable of probing indefinitely and adopt only probes that improve their own realised profit.
- Dashboard status distinguishes searching, locally settled, and probing, and displays tested, next, and incumbent prices.
- Competition experiments run through their configured horizon and accept a seed so post-settlement behavior remains observable.

### Validation

- Added seeded replay, seeded tie/shuffle, probe lifecycle, persistent exploration, accounting, 1,000-day stability, and bounded-history coverage; obsolete exact 5/5 and permanent-price assumptions were removed.

## [MVP3-Entertainment_Competition-005.1] - (2026-08-13)

### Summary

Added deterministic starting-price sensitivity analysis for the existing Entertainment competition model without changing economic or pricing behavior.

### Added

- Full 8×8 Cartesian grid over $1/$2/$3/$4/$5/$6/$8/$10 Entertainment A/B starts with a 300-day horizon.
- Per-combination endpoints, convergence days, convergence status, terminal shares/profits, terminal pricing state, and control endpoints.
- Full-grid swapped-start symmetry regression and horizon/non-mutation/control/observer-boundary tests.
- Compact matrix in the existing dashboard with A starts as rows, B starts as columns, and A/B endpoints in each cell.

### Validation

- All 64 combinations converged within 300 days; multiple deterministic endpoint regions were observed.
- Equal-price starts remained synchronized and converged to $5/$5; asymmetric starts produced path-dependent endpoints ranging from $1/$1 through $5/$5, including one- and two-cent endpoint differences.
- Swapped starts were exactly symmetric after exchanging firm labels, including endpoints, convergence timing, and terminal shares.
- Food/Utilities/Transport/Healthcare remained at $15/$12/$8/$10 in every run.
- 43 tests passed across five files; typecheck, build, aggregate check, and browser validation passed.
- No simulation behavior, pricing logic, firm information, tie-breaking, or experiment parameter changed during final documentation and validation.

## [MVP3-Entertainment_Competition-005] - (2026-08-13)

### Summary

Added homogeneous-product competition in Entertainment while retaining the other four industries as monopoly controls.

### Added

- A second independently learning Entertainment firm with its own cash, inventory, outcomes, and pricing state.
- Generic cheapest-affordable-available supplier choice with fallback after stockout.
- Deterministic equal-price demand splitting with rotating daily first priority.
- Per-firm market share, total industry sales, and truthful transaction-price observer metrics.
- Competitive $1/$8 starting-price experiment with price, sales, profit, share, convergence, and final learner-state results.
- `docs/MVP3_SPEC.md` and competition regressions covering choice, ties, fallback, failure semantics, events, taxation, controls, determinism, and 1,000-day stability.

### Changed

- Generalized industry processing and invariants from exactly one firm to configured one-or-more firm collections.
- Government now taxes and pools receipts from six firms.
- Price/profit charts and market table identify both Entertainment firms separately; the table displays observer market share.
- Grouped Entertainment events retain granular firm counterparties.
- Pricing strategy and firm information inputs remain unchanged.

### Validation

- 38 tests passed across four files; typecheck, build, and aggregate check passed.
- Food/Utilities/Transport/Healthcare retained $15/$12/$8/$10 control endpoints.
- Entertainment A/B converged to an observed $4 learner endpoint on days 12/13; equal-price days split demand 5/5.
- The 1,000-day run retained $500 total money, $50 equal household balances, zero Gini, exact stock flows, bounded histories, and deterministic output.
- Desktop and 390px browser checks passed with populated experiment data, contained table scrolling, no page/chart overflow, and no console warnings or errors.

## [MVP2-Industry_Demand_Boundaries-004.1] - (2026-08-13)

### Summary

Introduced the first controlled industry asymmetry through distinct fixed household demand boundaries while preserving the stable $500 monetary circuit.

### Added

- Industry-defined household budgets: Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5.
- Boundary regressions for purchase at the exact budget and affordability failure one cent above it.
- Distinct-optimum convergence coverage, long-run stability, and cross-industry isolation checks.

### Changed

- Household industry outcomes now initialize budgets from reusable industry definitions rather than one shared constant.
- Market overview now displays each industry's household budget beside tested/next price, sales, profit, and convergence.
- Varied-start experiment expectations and current documentation now reflect five distinct analytical optima.
- Pricing strategy, supply, taxation, redistribution, household symmetry, and information boundaries remain unchanged.

### Validation

- 31 tests passed across four files; typecheck, production build, and aggregate check passed.
- Food/Utilities/Transport/Healthcare/Entertainment converged to $15/$12/$8/$10/$5 on days 23/19/12/14/24.
- The 1,000-day run retained $50 household balances, zero Gini, $500 total money, and valid independent stock flows.
- Determinism and canonical industry-processing-order independence passed.
- Development-server browser verification confirmed visible per-industry budgets, populated distinct convergence results, and no console warnings or errors.

## [MVP2-Multi_Industry-004] - (2026-08-13)

### Summary

Generalized the deterministic finite-supply economy from one food market to five symmetric industries while preserving the analytically stable reference circuit.

### Added

- Food, Utilities, Transport, Healthcare, and Entertainment definitions with one independently learning firm each.
- Industry-keyed household budgets, daily outcomes, and lifetime causal counters.
- Generic market events carrying industry, firm, and household identity.
- Per-market historical metrics, compact five-market dashboard, selected-market capacity chart, and five-line price/profit comparisons.
- Deterministic varied-start five-firm convergence experiment and `docs/MVP2_SPEC.md`.
- Regression coverage for independent stock flows, pooled taxation, budget non-monetization, long-run stability, determinism, and industry processing order.

### Changed

- Raised default household cash from $10 to $50 and total closed-circuit money from $100 to $500.
- Replaced the single `firm`/`pricing` state with iterable industry and firm collections; the pricing heuristic itself remains materially unchanged.
- Applied one common configurable daily supply independently to all five markets, defaulting to ten units each.
- Generalized supply, expiration, firm-result, pricing, tax, and display-grouping paths across markets.
- Government now taxes all five firms, pools receipts, and redistributes the complete pool equally.
- Updated README, architecture, validation, and research notes for the MVP 2 model.

### Validation

- 26 automated tests passed across four files.
- TypeScript typecheck passed.
- Production build and aggregate check passed.
- Varied starts $1/$2/$5/$15/$20 converged independently to $10 on days 18/17/14/14/19.
- A 1,000-day canonical run retained $50 household balances, zero Gini, $500 total money, and valid per-industry stock flows.
- Forward and reversed canonical industry orders produced identical economic outcomes.
- Development server and initial desktop dashboard DOM sanity check passed; populated/mobile/console browser follow-ups remain pending because the browser URL policy blocked subsequent localhost interaction.

## [MVP1-Scarcity_Analysis-003.1] - (2026-08-13)

### Summary

Added household-distribution analysis and deterministic starting-price experiments, then changed the visible default finite exogenous daily supply from eight to ten units to stabilize the baseline economy. The firm's pricing strategy and information inputs remain unchanged.

### Added

- Added pure minimum, median, maximum, Gini, and affordability measurements derived from household cash balances.
- Added pre-market and end-of-day household distribution fields to historical daily metrics.
- Added `householdsAffordableAtMarketOpen`, captured before queue processing or purchases.
- Added lifetime purchases, stockout failures, and affordability failures to household state so cumulative analysis is independent of bounded event retention.
- Added runtime validation that every household's cumulative outcomes are non-negative integers and account for every simulated day.
- Added a deterministic starting-price experiment utility with the required 11-price grid, fixed $1.00 step, ten-unit default supply, 300-day horizon, explicit non-convergence results, final wealth distribution, affordability, and per-household cumulative outcomes.
- Added a latest-day causal diagnostic linking tested price, market-open cash distribution, affordability, market result, profit, and next price.
- Added a household wealth-distribution chart, current Gini metric, market-capacity chart, cumulative household outcome columns, and an on-demand experiment chart/table.
- Added precise analytics and controlled-experiment tests, including known Gini distributions and observer/strategy boundary checks.

### Experiment results

- Under ten-unit supply, all 11 sampled starting prices converged to the $10.00 learner endpoint in 9–19 days.
- Every run ended with equal $10.00 household balances, zero Gini, and equal cumulative consumption within that run.
- The former eight-unit grid remains documented in lab notes as the historical scarcity comparison that produced multiple learner endpoints.

### Changed

- Extended the former food stock-flow chart to compare affordable households at market open with supply, sales, and expiration.
- Updated household inspection to expose long-run food access without changing household behavior.
- Changed the default and default experiment supply from eight to ten exogenous units, matching one desired unit for each household.
- Made the stabilizing role explicit: affordable default markets serve every household, full redistribution restores each balance exactly, and stockout-driven wealth divergence does not arise.
- Updated README, architecture, MVP 1 specification, validation documentation, page metadata, and lab notes for the MVP 1.1 analysis layer.
- Left `pricingStrategy.ts`, the `decideTomorrowPrice` signature, and all existing firm inputs unchanged.

### Validation

- `npm run test:run`: 41 tests passed across 4 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite retained its non-failing chunk-size advisory.
- `npm run check`: passed.
- The controlled 11-price suite ran twice identically; every sampled start converged to $10.00 within 19 days.
- `npm run dev`: the local application loaded successfully in the browser.
- Desktop checks verified daily causal diagnostics, all 11 experiment rows, cumulative outcomes for all 10 households, the common $10.00 endpoint, and zero console warnings/errors.
- Mobile checks at a 390-pixel viewport verified both normal and populated-experiment layouts with no page-level horizontal overflow.
- GitHub Pages deployment was not performed as part of this local update.

## [MVP1-Finite_Supply-003] - (2026-08-13)

### Summary

Introduced a fixed exogenous daily food supply as MVP 1's single economic mechanism, with explicit stock-flow accounting, causal scarcity outcomes, deterministic allocation, historical metrics, dashboard inspection, and runtime validation. The firm's MVP 0 pricing strategy and its input boundary remain unchanged.

### Added

- Added configurable non-negative integer `dailyFoodSupply`, defaulting to eight units and applied only when a run is created or reset.
- Added daily firm stock, expiration, and sold-out state plus household `purchased`, `insufficient_funds`, and `stockout` outcomes.
- Added explicit `FOOD_SUPPLY_RECEIVED`, `HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS`, `HOUSEHOLD_PURCHASE_FAILED_STOCKOUT`, and `FOOD_EXPIRED` events.
- Added deterministic rotating household purchase priority, advancing the first household by one each day and wrapping after household 10.
- Added historical food-supplied, units-sold, units-expired, stockout-failure, affordability-failure, and sold-out metrics.
- Added runtime food invariants for non-negative integer stock, the sales cap, exact supply-to-sale/expiration accounting, zero carry-over, matching household/firm sales, and complete causal outcomes.
- Added dashboard supply configuration, food stock-flow chart, scarcity headline metrics, firm supply/expiration inspection, and household-level failure causes.
- Added an MVP 1 specification and updated architecture, validation, README, and historical-spec routing.
- Expanded automated coverage for supply caps, exact eight-unit sales, expiration, stock-flow conservation, no carry-over, inventory bounds, causal failures, rotation fairness, determinism, money, taxation, redistribution, event grouping, historical metrics, reset behavior, and learner behavior.

### Changed

- Replaced unlimited food with a new exogenous receipt at the start of every simulated day.
- Replaced fixed household priority with cyclic day-based priority without introducing randomness.
- Replaced generic purchase failures with separate affordability and stockout event causes.
- Replaced the Quantity Sold chart with a supplied/sold/expired stock-flow chart.
- Updated the ledger's market summaries to report purchases, affordability failures, stockout failures, and spending while preserving raw source events.
- Made expiration explicit even when zero units expire; inventory is never silently reset.
- Kept `decideTomorrowPrice` behaviorally and structurally unchanged: neither stockouts nor latent unmet demand became new strategy inputs.

### Observed behavior

- The equal-cash one-day benchmark remains exact: $9.99 yields eight sales and $79.92, $10.00 yields eight sales and $80.00, and $10.01 yields no sales.
- Finite allocation makes later affordability path-dependent because equal redistribution does not erase the cash difference between buyers and non-buyers. With the unchanged learner, the tested $20.00 path converges to $10.00, while the default $2.00 path deterministically converges to $6.70. This behavior is documented rather than corrected with an excluded stabilizer or pricing heuristic.

### Validation

- `npm run test:run`: 26 tests passed across 2 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite reported its existing non-failing chunk-size advisory.
- `npm run check`: passed.
- `npm run dev`: Vite became ready and the local application returned HTTP 200.
- Browser smoke tests confirmed the MVP 1 controls, one-day scarcity metrics, supply and expiration ledger events, household stockout outcomes, zero console warnings/errors, and no horizontal overflow at a 390-pixel responsive viewport.
- GitHub Pages deployment was not performed as part of this local update.

## [MVP0-UI_Refinement-002] - (2026-08-13)

### Summary

Refined the MVP 0 research dashboard to make the firm's experiment cycle and event history easier to interpret without changing the underlying economic model or pricing algorithm.

### Added

- Added a Search Step chart backed by each day's stored `priceStepSizeCents` metric, with currency-formatted axis values and tooltips.
- Added `PriceDecisionAction`, a structured decision classification with `increase`, `decrease`, `refine`, `hold`, and `converged` actions.
- Added `latestDecisionAction` to simulation state and returned an action from every existing pricing-strategy decision path.
- Added dynamic decision indicators for upward movement, downward movement, refinement, holding, and convergence.
- Added `groupEventsForDisplay`, a UI transformation that derives grouped market and redistribution summaries from raw simulation events.
- Added expandable grouped-event details using native disclosure controls so the underlying household-level events remain inspectable.
- Added tests for historical search-step snapshots, structured pricing actions, full-purchase grouping, all-failed grouping, mixed-market grouping, input immutability, and preservation of raw purchase events.

### Changed

- Replaced the dedicated Money Conservation chart with the Search Step chart. Money conservation remains enforced by runtime invariants and tests and remains visible in the Total Money headline metric as a satisfied invariant.
- Reworked the headline metric sequence to distinguish the last tested price and its realised profit from the next price selected for tomorrow's experiment. Day 0 now reports that no experiment has occurred.
- Renamed Price Discovery chart terminology from "posted price" to "tested price" where it refers to a completed market experiment.
- Replaced the permanently fixed upward decision arrow with a symbol selected from structured strategy metadata rather than human-readable text.
- Grouped repetitive household purchase, purchase-failure, and redistribution events in the visible ledger while leaving the simulation's granular raw event stream unchanged.
- Updated ledger, decision-indicator, and expandable-detail styling within the existing visual system.
- Updated architecture and validation documentation to describe search-step history and display-only event grouping.

### Validation

- `npm run test:run`: 14 tests passed across 2 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check`: passed.
- GitHub Pages build and deployment completed successfully for commit `480b148` (`Refine price discovery dashboard`).

## [MVP0-Initial_Build-001] - (2026-08-11)

### Summary

Built the first complete Econ-Engine MVP 0 as a deterministic, browser-based agent economic simulation and research dashboard, with a pure TypeScript simulation core, adaptive firm pricing, exact monetary accounting, automated validation, documentation, and static GitHub Pages deployment.

### Added

- Created the React, TypeScript, and Vite application with no backend, database, authentication, server-side simulation, or external economic-data dependency.
- Implemented the 12-agent MVP world: ten households, one firm, and one government.
- Implemented integer-cent monetary transfers, a fixed 10,000-cent money supply, deterministic household ordering, and the documented seven-phase daily lifecycle.
- Implemented household affordability purchases, unlimited exogenous zero-cost food, 100% firm-profit taxation, equal household redistribution, and deterministic remainder handling.
- Added a bounded adaptive hill-climbing pricing strategy with configurable starting price and step, high-price zero-sales recovery, step reduction after failed experiments, adjacent-cent testing, and convergence at the best realised price.
- Added typed simulation events for daily phases, purchases and failures, firm results and decisions, taxation, transfers, convergence, and day completion.
- Added bounded daily metrics and event histories, structured pricing explanations, and runtime invariant checks that fail on invalid accounting or state.
- Added Run, Pause, Step, and Reset controls; starting-price, initial-step, and speed configuration; headline metrics; four analytical charts; firm, government, and household inspection; and a recent-event ledger.
- Added Vitest coverage for accounting boundaries, taxation, redistribution, conservation, non-negative balances, determinism, normal convergence, high-price convergence, and adjacent-cent stopping behavior.
- Added the root README, formal MVP specification, architecture guide, validation guide, GitHub Pages workflow, and a project-specific Open Graph image.
- Preserved and renamed the governing design document as `SIMULATION_DESIGN_RULES.md`, with references from project documentation.

### Changed

- Connected the local project to `https://github.com/NeoLorenzo/Econ-Engine`, retained the repository's existing initial README commit through an unrelated-history merge, and established `main` as the tracked branch.
- Configured Vite with relative production assets for both local use and the `/Econ-Engine/` GitHub Pages path.
- Enabled GitHub Pages with GitHub Actions as the deployment source.

### Validation

- Initial `npm run test:run`: 9 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check`: passed before publication.
- Verified convergence to the 1,000-cent benchmark from both 200-cent and 2,000-cent starting prices.
- Verified the published GitHub Pages site returned HTTP `200 OK` with the expected page title.
