# Econ-Engine

Econ-Engine is a browser-based agent economic simulation built to make every outcome inspectable. MVP 1.1 includes observer analytics for household wealth, affordability, food access, and deterministic price-learning experiments.

The deterministic world contains ten households, one zero-cost food firm, and one government. There is no backend, database, authentication, external data, or server-side simulation.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

```bash
npm run test:run   # simulation tests
npm run typecheck  # static type validation
npm run build      # production bundle
npm run preview    # preview the bundle
npm run check      # all validation
```

## Model at a glance

- Ten households start with $10.00 each and attempt to buy one food unit per day.
- Ten units of exogenous food arrive at the firm at the start of each day by default—one for each household. The integer daily supply remains configurable at reset and never adapts during a run.
- Households are processed in a deterministic rotating order. An attempt can succeed, fail for insufficient funds, or fail because affordable stock has sold out.
- Unsold food explicitly expires after the market. No inventory persists: `food supplied = units sold + units expired` on every completed day.
- The firm has zero production cost and uses the unchanged MVP 0 learner. It receives only its tested price, units sold, realised profit, and private strategy history; stockout attempts and household balances are not pricing inputs.
- Government taxes 100% of daily firm revenue and redistributes every cent equally across households.
- Money uses integer cents and remains exactly $100.00. Food and money invariants are checked at runtime.
- Observer-only daily metrics record market-open affordability, minimum/median/maximum household cash, and the household-balance Gini coefficient. These measurements never enter firm decisions.
- Each household retains cumulative purchases, stockout failures, and affordability failures independently of the bounded event ledger.
- A deterministic 11-start experiment compares price-learning paths while holding step size, ten-unit supply, households, allocation, and institutions fixed.

The analytical benchmark is $10.00: at $9.99 ten sales yield $99.90, at $10.00 ten sales yield $100.00, and at $10.01 no household can afford food. This benchmark is validation information, not firm knowledge.

The ten-unit default is an explicit stabilizing assumption. When the price is affordable, all ten households buy and equal redistribution returns each household's spending exactly. Balances therefore remain equal, Gini remains zero, and the learner faces a stationary price→profit relationship. Lower configured supplies still expose the scarcity-driven wealth divergence documented by MVP 1.1; the historical eight-unit experiment remains covered by tests and lab notes.

## Architecture

The pure TypeScript core in `src/sim` owns domain state, finite-supply phases, observer analytics, controlled experiments, events, pricing strategy, and invariant checks. React consumes immutable snapshots and controls time; it does not contain economic rules. Chart and event histories are bounded for browser performance.

Read the current [MVP 1 specification](docs/MVP1_SPEC.md), historical [MVP 0 specification](docs/MVP0_SPEC.md), [architecture notes](docs/ARCHITECTURE.md), [validation guide](docs/VALIDATION.md), and governing [simulation design rules](SIMULATION_DESIGN_RULES.md).

Project evolution is recorded in the [changelog](CHANGELOG.md); [lab notes](LAB_NOTES.md) preserve rationale, observations, trade-offs, and lessons.

## Deployment

Pushes to `main` run validation and deploy the static `dist` bundle through GitHub Pages. Vite uses relative assets so localhost and the `/Econ-Engine/` project path both work.

If Pages is not enabled, open the repository's **Settings → Pages** and set **Source** to **GitHub Actions**.

## Current limits

MVP 1 deliberately excludes persistent inventory, endogenous production, costs, workers, wages, ownership, credit, competition, multiple goods, heterogeneous preferences, shocks, and stockout-based pricing rules. The ten daily units are finite exogenous supply, not modeled production.
