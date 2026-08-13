# Econ-Engine

Econ-Engine is a browser-based agent economic simulation built to make every outcome inspectable. MVP 0 asks one narrow question: can bounded agents transact with exact accounting while a firm discovers a revenue-maximising price using only its own realised results?

The answer is explored through a deterministic world of ten households, one zero-cost food firm, and one government. There is no backend, database, authentication, external data, or server-side simulation.

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

- Ten households start with $10.00 each and attempt to buy one unit of food per day when affordable.
- One firm starts with no cash, posts one price, has unlimited exogenous food and no costs, and learns only from its own price, sales, and realised profit history.
- One government taxes 100% of the firm's daily revenue and immediately redistributes every cent across households.
- Every monetary change is an integer-cent transfer. Runtime invariants enforce the constant $100.00 money supply.
- Daily phases are deterministic: post price, process households, record results, choose tomorrow's price, tax, redistribute, validate, snapshot.

The analytically known **MVP 0 benchmark optimum** is $10.00: all ten households buy, yielding $100.00 revenue. At $10.01 none can buy. This is a monopolist price-discovery benchmark with perfectly inelastic unit demand below an affordability constraint—not a competitive-market equilibrium. The benchmark is used for validation and is never available to the firm's strategy.

Unlimited supply and 100% redistribution are explicit experimental simplifications. Redistribution closes the monetary circuit while production, wages, ownership and dividends remain out of scope.

## Architecture

The pure TypeScript core in `src/sim` owns domain state, daily phases, events, pricing strategy and invariant checks. React consumes immutable snapshots and controls time; it does not contain economic rules. Chart and event histories are bounded for long-running browser performance.

Read the full [MVP specification](docs/MVP0_SPEC.md), [architecture notes](docs/ARCHITECTURE.md), [validation guide](docs/VALIDATION.md), and the governing [simulation design rules](SIMULATION_DESIGN_RULES.md).

Project evolution is recorded in the [changelog](CHANGELOG.md), while the [lab notes](LAB_NOTES.md) preserve design rationale, observations, trade-offs, and lessons.

## Deployment

Pushes to `main` run validation and deploy the static `dist` bundle through GitHub Pages. Vite uses relative assets so both localhost and the `/Econ-Engine/` project path work.

If Pages is not yet enabled, open the repository's **Settings → Pages** and set **Source** to **GitHub Actions**.

## Current limits and roadmap

MVP 0 deliberately excludes production, inventory, labour, wages, ownership, credit, competition, multiple goods, heterogeneous households, shocks and policy optimisation. Future versions will add one mechanism at a time only after its accounting, predictions and failure modes are understood—beginning with production constraints and then competition.
