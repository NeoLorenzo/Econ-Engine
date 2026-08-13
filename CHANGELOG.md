# Econ-Engine changelog

All notable changes to Econ-Engine are documented here. The changelog records what changed in each update. Design rationale, experiments, observations, and lessons are documented separately in [Lab Notes](LAB_NOTES.md).

## Maintenance convention

Every meaningful software update should receive a newest-first entry with a readable update identifier and date. Record the update's scope, additions, changes or fixes, and relevant validation. Include only headings that apply. Keep entries factual and implementation-focused; if a change or validation result cannot be verified, omit it or label it uncertain rather than reconstructing it.

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
