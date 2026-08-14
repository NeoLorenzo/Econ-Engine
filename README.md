# Econ-Engine — [MVP6-Government-008.1]

Econ-Engine is a deterministic browser-based agent economic simulation built to make outcomes inspectable. MVP8 scales the canonical MVP7 economy to 100 households and $5,000 while preserving its per-capita structure and fixed institutions.

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

- Ten households have fixed seeded employment and persistent cash.
- Eight competitive consumer firms each employ one worker and produce five units per day; monopoly Transport employs two workers.
- Households choose by delivered cost within percentage expenditure budgets. Purchases pay firms; contractual payroll is capped by cash and residual profit is taxed explicitly.
- Government acts only after payroll, starts at 0%, and tests seeded 0–100% wealth-tax alternatives.
- Tax rates use integer basis points; liabilities use floor-to-cent rounding.
- Every receipt returns explicitly through deterministic means-tested water filling. Government cannot borrow or create money.
- Money uses integer cents and remains exactly household count × $50 ($5,000 canonically). Live histories remain bounded; finite research harnesses retain full trajectory observations separately.

## Architecture

The pure TypeScript core in `src/sim` owns markets, employment/payroll, Government policy and fiscal transfers, events, metrics, experiments, and invariants. React owns controls and presentation only.

Read the current [MVP 6 specification](docs/MVP6_SPEC.md), preserved [MVP 5 specification](docs/MVP5_SPEC.md), [architecture notes](docs/ARCHITECTURE.md), [validation guide](docs/VALIDATION.md), and authoritative [simulation design rules](SIMULATION_DESIGN_RULES.md). Project evolution is recorded in the [changelog](CHANGELOG.md) and [lab notes](LAB_NOTES.md).

## Deployment

Pushes to `main` validate and deploy the static Vite bundle through GitHub Pages. No deployment is performed by this update.

## Current limits

Government is deliberately narrow and stylized: one flat cash-wealth tax, one Gini objective, no forecasting, and one equalizing transfer rule. There are no other taxes, benefits, public purchases, borrowing, money creation, monetary policy, or welfare/consumption objectives.
