# Econ-Engine — [MVP5-Employment-007]

Econ-Engine is a deterministic browser-based agent economic simulation built to make outcomes inspectable. MVP5 gives every household a fixed seeded job, derives consumer production from labor, distributes firm revenue as wages, and allows persistent household wealth to diverge inside an exact $500 closed circuit.

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
- Food, Utilities, Transport, and Healthcare each retain one firm. Entertainment has two homogeneous-product firms. Every firm receives ten exogenous units per day.
- Each household attempts one unit per industry daily. Fixed behavioral spending constraints are Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5; these experimental parameters sum to $50.
- Industry budgets are not wallets or money. Purchases reduce the household's shared real cash; spending in one market does not consume another market's budget.
- Every firm owns independent state for the unchanged local price learner. Entertainment households choose the cheapest affordable available supplier; equal-price ties split deterministically with rotating first priority.
- Unsold units explicitly expire. Each market satisfies `supply = sold + expired` with no carry-over.
- One government taxes 100% of all firm revenue, pools receipts, and redistributes every cent equally.
- Money uses integer cents and remains exactly $500. Observer analytics and raw events do not enter firm decisions.
- Common daily supply remains configurable, so lower-supply scarcity and path dependence remain available.

The monopoly control incumbents remain Food $15, Utilities $12, Healthcare $10, and Transport $8, with occasional one-cent probe days. Entertainment has no universal convergence price: seeded, persistent local experiments can escape formerly frozen states such as $5/$5, while histories remain exactly reproducible for a fixed seed. These are learner dynamics, not claims of competitive equilibrium.

## Architecture

The pure TypeScript core in `src/sim` owns industries, firms, household industry outcomes, finite-supply markets, pooled government transfers, pricing, events, metrics, experiments, and invariants. The engine iterates collections rather than duplicating industry logic. React owns controls and presentation only.

Read the current [MVP 5 specification](docs/MVP5_SPEC.md), historical [MVP 4 specification](docs/MVP4_SPEC.md), [architecture notes](docs/ARCHITECTURE.md), [validation guide](docs/VALIDATION.md), and authoritative [simulation design rules](SIMULATION_DESIGN_RULES.md). Project evolution is recorded in the [changelog](CHANGELOG.md) and [lab notes](LAB_NOTES.md).

## Deployment

Pushes to `main` validate and deploy the static Vite bundle through GitHub Pages. Relative assets preserve localhost and `/Econ-Engine/` compatibility. No deployment is performed by this update.

## Current limits

Only Entertainment contains competition, and its firms differ only by identity and private learning history. There is no differentiation, competitor awareness, explicit undercutting, endogenous household budget allocation, elastic demand, substitution, persistent inventory, production, costs, labour, wages, ownership, credit, household heterogeneity, or shocks.
