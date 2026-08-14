# Architecture

MVP5 adds a dedicated employment subseed and a fixed household-to-firm relation. Consumer inventory is produced explicitly from worker count and productivity at day start. After market closure and pre-payroll pricing evaluation, firms transfer their complete cash balances to employees as explicit wages. Government remains present with inactive default fiscal policy. Household cash is persistent, and observer histories measure rather than correct its distribution.

Econ-Engine separates environment rules, agent strategies, state, events, observer analytics, experiments, and interface so causal boundaries remain inspectable.

## Simulation core

`types.ts` defines configurable industries, firms, industry-keyed household outcomes, government, generic market events, per-firm metrics, and economy-wide metrics. `config.ts` maps every industry to one-or-more firm IDs: Entertainment has two and the controls have one. `engine.ts` iterates each industry's firm collection through one reusable deterministic market lifecycle.

Each `Firm` owns its `PricingState`; there is no shared singleton learner. Each `Household` owns one real cash stock plus an `industryOutcomes` record containing behavioral budget, daily cause, and cumulative counters for every industry. Budget fields never enter `totalMoney`.

The engine accepts one common supply setting, applied independently to every firm. Households choose the cheapest affordable available firm within an industry, with deterministic rotating tie priority. Every firm receives explicit exogenous units, sells only available stock, and expires the remainder. Industry processing order is stored in configuration primarily to support regression testing.

After all markets close, the one government taxes all six firms, pools receipts, and redistributes the entire pool. `invariants.ts` validates 50,000 conserved cents, configured firm membership, complete household outcomes, independent per-firm stock flows, total industry demand caps, and cleared institutional balances.

## Strategy boundary

`pricingStrategy.ts` remains unchanged. Each call receives one firm's current price, units sold, realised zero-cost profit, and private pricing state. The engine does not pass competitor price, sales, profit, market share, household balances or budgets, causal failure counts, aggregate affordability, Gini, or future information.

## Observer analytics and experiments

`analytics.ts` measures household cash distributions and affordability without mutating simulation or strategy state. Each `DayMetrics` holds five `MarketMetrics` records plus economy-wide wealth and monetary fields. Raw events carry industry, firm, and household identity; display grouping keeps the source events underneath summaries.

`scarcityExperiment.ts` now runs one deterministic six-firm world with deliberately varied control starts and Entertainment starts of $1/$8. It records price, sales, profit, market-share trajectories, convergence, and final learner state through the public engine.

## Interface boundary

React controls reset configuration and time. The dashboard uses a compact five-row market overview, multi-line price/profit charts, a selected-industry capacity chart, wealth analytics, experiment results, household aggregate inspection, and grouped ledger. No economic rule exists in React.

## Extension seams

Additional symmetric industries can be configured by extending the industry definition and keyed types, without copying market logic. Economic heterogeneity, within-industry competition, endogenous budgets, production, or labour would each require a separate explicit model update with new information rules and invariants.
