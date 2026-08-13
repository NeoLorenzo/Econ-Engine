# Architecture

Econ-Engine separates simulation environment, agent strategy, state, events, observer analytics, experiments, metrics, and interface so causal boundaries remain inspectable.

## Simulation core

`src/sim/types.ts` defines agent, configuration, strategy, event, outcome, and metric records. `engine.ts` owns the deterministic daily phase order and explicit money and food transitions. Its public functions create, step, and batch-run immutable snapshots without React or browser dependencies.

Finite supply is an environment rule. At the start of a day the engine creates exactly `dailyFoodSupply` units through a `FOOD_SUPPLY_RECEIVED` event. Affordable purchases decrement available stock. After every household has attempted once, all remaining stock moves to expiration through `FOOD_EXPIRED`; available stock is then zero. Inventory logic never enters the pricing module.

Household attempts use a rotating order whose first index is `(day - 1) mod 10`. This is deterministic, uses no future information, and gives each household equal structural priority over a ten-day cycle. Household state records one of `purchased`, `insufficient_funds`, or `stockout` for inspection.

`pricingStrategy.ts` remains the replaceable MVP 0 agent strategy. Its function signature and inputs are unchanged: current price, units sold, realised profit, and private pricing state. The engine knows failure causes and stockout attempts, but does not pass latent unmet demand, household balances, or the food configuration to the strategy.

`invariants.ts` verifies exact money conservation and finite-supply stock-flow accounting. Completed days require non-negative integer inventory, sales no greater than supply, zero carry-over, `dailyFoodSupply = unitsSold + unitsExpired`, matching household and firm purchase counts, and one causal outcome per household.

Every material action emits a typed event. Daily metrics derive historical food supply, sales, expiration, causal failures, sellout status, firm results, strategy state, institutional balances, and total money from the completed simulation state. Both histories remain bounded in memory.

## Observer analytics

`analytics.ts` contains pure measurements over household balance arrays. It calculates minimum, median, maximum, Gini, and affordability counts without reading or mutating agent strategy. Gini is zero for equal balances (and for an all-zero distribution); otherwise it uses the mean absolute difference divided by twice the mean balance.

The engine snapshots household distribution twice: immediately before purchasing and after redistribution. It also counts households able to afford the tested price at market open, before queue order or transactions can change balances. These values are written only to `DayMetrics`.

Cumulative household purchase, stockout, and affordability counters live on household state because raw event history is intentionally bounded. Each counter increments in the same branch that emits its causal event. Runtime validation requires the three counters for each household to sum to the simulation day.

`scarcityExperiment.ts` is a deterministic research utility over the public engine. It constructs a fresh simulation per starting price, holds initial step and daily supply fixed, stops at convergence or a documented finite horizon, and returns convergence plus final distribution and per-household cumulative outcomes. It neither reaches into engine internals nor changes the strategy.

The current default and default experiment suite use ten exogenous units for ten households. This makes stabilization a visible environment configuration rather than strategy logic: the engine, observer analytics, event taxonomy, and pricing boundary are unchanged. Eight-unit and other lower-supply scenarios remain available through configuration.

## Interface boundary

React owns reset configuration, clock scheduling, and presentation only. The daily-supply input creates a new simulation; it cannot mutate an active run's supply. Charts read historical metrics, agent inspection reads snapshot state, and the ledger applies a pure display transformation that groups repetitive market and redistribution events while retaining granular source events.

The Market Capacity chart overlays market-open affordability, supplied, sold, and expired quantities. The wealth chart shows end-of-day minimum, median, and maximum cash without plotting ten overlapping series. A latest-day causal strip connects tested price, pre-market distribution, affordability, market result, profit, and next decision. Household rows add cumulative outcomes, and the experiment panel invokes the pure controlled runner. No inventory, allocation, failure, tax, transfer, metric, experiment, or price-learning rule exists in React.

## Information boundary

The engine and observer have true market state, including wealth distribution, affordability, and the count and identity of stockout attempts. The firm plausibly observes its posted price, units sold, and realised revenue/profit. MVP 1.1 adds analytical measurements but deliberately leaves the pricing function and its input signature unchanged. Gini, median cash, affordability counts, cumulative outcomes, and experiment results cannot feed back into the firm.

## Extension seams

Persistent inventory or endogenous production would require a separate model update with new sources, destinations, decisions, and invariants. They should not be introduced by reinterpreting MVP 1's exogenous supply. A future strategy may explicitly observe sellout signals, but that would be a behavioral experiment rather than an inventory-accounting change.
