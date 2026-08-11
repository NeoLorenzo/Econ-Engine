# Architecture

Econ-Engine separates five concerns so the economy remains inspectable.

## Simulation core

`src/sim/types.ts` defines concrete agent, strategy, event and metric records. `engine.ts` owns the deterministic phase order and explicit transfers. Its public functions create, step and batch-run immutable snapshots; the module has no React or browser dependency.

`pricingStrategy.ts` is replaceable agent strategy. It receives only the firm's current experiment and its private learning state, then returns tomorrow's price plus structured reasoning. Economic rules do not leak into the learner, and the UI does not reconstruct explanations.

`invariants.ts` measures the money stock and throws on fractional or negative balances, invalid price/step values, invalid quantities, money creation or destruction, and uncleared end-of-day institutional balances. Invalid state is never silently repaired.

Every material action emits a typed event. Events distinguish causal flows from current state and make individual transfers auditable. Daily metrics are measurements derived from underlying state, including the strategy's historical search-step size. Both histories are bounded in memory.

## Interface boundary

React owns controls, clock scheduling and presentation. A step calls the pure engine and renders the returned snapshot. Charts read metrics; agent tables read agent balances. The visible ledger applies a pure display transformation that groups repetitive household purchases and redistribution while retaining the granular source events behind expandable details. No purchase, tax, redistribution or price-learning rule exists in a component.

There is no backend because MVP 0 has no shared persistence, identity or external data. A static bundle is sufficient and makes deterministic experiments easy to reproduce.

## Extension seams

Future economic mechanisms should add explicit state, events, invariants and tests before UI. A production module, for example, can replace exogenous supply without rewriting pricing strategy or charts. New strategies can conform to the same observation/decision boundary. Aggregate statistics should continue to be derived measurements, never hidden control variables.
