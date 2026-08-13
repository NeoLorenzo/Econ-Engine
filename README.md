# Econ-Engine

Econ-Engine is a deterministic browser-based agent economic simulation built to make outcomes inspectable. MVP 2.1 gives five independently learning industries distinct fixed demand boundaries while retaining the stable finite-supply reference economy.

## Run locally

```bash
npm install
npm run dev
npm run test:run
npm run typecheck
npm run build
npm run check
```

## Model at a glance

- Ten households start with one real $50 cash balance.
- Food, Utilities, Transport, Healthcare, and Entertainment each have one firm and ten exogenous units per day by default.
- Each household attempts one unit per industry daily. Fixed behavioral spending constraints are Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5; these experimental parameters sum to $50.
- Industry budgets are not wallets or money. Purchases reduce the household's shared real cash; spending in one market does not consume another market's budget.
- Every firm owns independent state for the unchanged local price learner.
- Unsold units explicitly expire. Each market satisfies `supply = sold + expired` with no carry-over.
- One government taxes 100% of all firm revenue, pools receipts, and redistributes every cent equally.
- Money uses integer cents and remains exactly $500. Observer analytics and raw events do not enter firm decisions.
- Common daily supply remains configurable, so lower-supply scarcity and path dependence remain available.

The canonical firm benchmarks are the corresponding industry budgets: Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5. At those prices every firm sells ten units, total revenue is $500, each household spends $50 and receives $50, household cash remains $50, and Gini remains zero. One cent above an industry's budget rejects that purchase. Firms learn their boundaries from their own realised results; the answers are never hard-coded into the strategy.

## Architecture

The pure TypeScript core in `src/sim` owns industries, firms, household industry outcomes, finite-supply markets, pooled government transfers, pricing, events, metrics, experiments, and invariants. The engine iterates collections rather than duplicating industry logic. React owns controls and presentation only.

Read the current [MVP 2 specification](docs/MVP2_SPEC.md), historical [MVP 1 specification](docs/MVP1_SPEC.md), [architecture notes](docs/ARCHITECTURE.md), [validation guide](docs/VALIDATION.md), and authoritative [simulation design rules](SIMULATION_DESIGN_RULES.md). Project evolution is recorded in the [changelog](CHANGELOG.md) and [lab notes](LAB_NOTES.md).

## Deployment

Pushes to `main` validate and deploy the static Vite bundle through GitHub Pages. Relative assets preserve localhost and `/Econ-Engine/` compatibility. No deployment is performed by this update.

## Current limits

Industries currently differ only by identity and fixed experimental household budget. There is no within-industry competition, endogenous household budget allocation, elastic demand, substitution, persistent inventory, production, costs, labour, wages, ownership, credit, household heterogeneity, or shocks. Exogenous supply and full redistribution are controlled institutions for this stability experiment, not claims of realism.
