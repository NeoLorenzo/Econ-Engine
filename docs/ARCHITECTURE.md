# Architecture

Econ-Engine separates environment rules, agent strategies, state, events, observer analytics, experiments, and interface so causal boundaries remain inspectable.

## Simulation core

`types.ts` defines configurable industries, firms, industry-keyed household outcomes, government, generic market events, per-market metrics, and economy-wide metrics. `config.ts` contains the five symmetric default industries and stable monetary assumptions. `engine.ts` creates and iterates the collections through one reusable deterministic market lifecycle.

Each `Firm` owns its `PricingState`; there is no shared singleton learner. Each `Household` owns one real cash stock plus an `industryOutcomes` record containing behavioral budget, daily cause, and cumulative counters for every industry. Budget fields never enter `totalMoney`.

The engine accepts one common supply setting, applied independently to each market. Every firm receives explicit exogenous units, sells only available stock, and expires the remainder. Industry processing order is stored in configuration primarily to support regression testing.

After all markets close, the one government taxes each firm, pools receipts, and redistributes the entire pool. `invariants.ts` validates 50,000 conserved cents, one firm per industry, complete household outcomes, independent stock flows, sales caps, and cleared institutional balances.

## Strategy boundary

`pricingStrategy.ts` is unchanged in substance. Each call receives one firm's current price, units sold, realised zero-cost profit, and private pricing state. The engine does not pass household balances or budgets, other firms' state, causal failure counts, aggregate affordability, Gini, or future information.

## Observer analytics and experiments

`analytics.ts` measures household cash distributions and affordability without mutating simulation or strategy state. Each `DayMetrics` holds five `MarketMetrics` records plus economy-wide wealth and monetary fields. Raw events carry industry, firm, and household identity; display grouping keeps the source events underneath summaries.

`scarcityExperiment.ts` runs one deterministic five-firm world with deliberately varied starting prices and records independent convergence endpoints/days. Lower common supply remains supported through the same public engine.

## Interface boundary

React controls reset configuration and time. The dashboard uses a compact five-row market overview, multi-line price/profit charts, a selected-industry capacity chart, wealth analytics, experiment results, household aggregate inspection, and grouped ledger. No economic rule exists in React.

## Extension seams

Additional symmetric industries can be configured by extending the industry definition and keyed types, without copying market logic. Economic heterogeneity, within-industry competition, endogenous budgets, production, or labour would each require a separate explicit model update with new information rules and invariants.
