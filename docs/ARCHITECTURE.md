# Architecture

Econ-Engine separates economic rules, agent strategies, state, events, observer analytics, experiments, and React presentation so causal boundaries remain inspectable.

## MVP8.1 observer architecture

React conditionally mounts Overview, Markets, Households & Labor, Government, and Research. Persistent controls own execution and draft initialization values. Tabs, selected industry, settings disclosure, household query, and deterministic sort order are local UI state only; none enters `stepSimulation` or an RNG source. Hidden charts and large observers are unmounted rather than visually concealed.

Overview provides economy-wide state; domain tabs provide detailed live state; Research hosts explicit independent experiment harnesses. Markets calls legacy `preTaxProfit` operating earnings, while payroll tables call `residualProfit` residual profit. Tables select agents semantically in React and never hide rows by CSS position.

## Simulation core

`types.ts` defines household, firm, Government, event, and bounded daily metric state. `engine.ts` performs immutable daily steps: labor-derived production, spatial consumer markets and Transport payments, inventory expiration, firm pricing decisions, cash-constrained contractual payroll, and finally Government tax/transfer policy. `invariants.ts` validates entity structure and exact stock/flow accounting after each completed day.

`SimulationConfig.householdCount` is the population authority. The canonical MVP8 economy has `N=100` households, while research configurations use complete ten-household blocks, including `N=10`. It has five industries and nine firms: two each in Food, Utilities, Healthcare, and Entertainment, plus one Transport firm. `SimulationConfig.firmsPerIndustry` (default 2) sets how many firms compete in each consumer industry; other values exist to test market structure. Firm IDs follow one scheme, `firm-<industry>-<slot letter>`, built and parsed only by `consumerFirmId` and `firmSlot` in `config.ts`, so no engine or UI logic depends on there being exactly two firms or on particular ID suffixes. The research harnesses that compare Entertainment Firm A with Firm B (the starting-price grid, the spatial competition probe and the generalized spatial analysis) build their own canonical two-firm economies and remain pairwise by design. Each non-Transport consumer firm employs `N/10` workers and Transport employs `N/5`; canonically those counts are 10 and 20. Consumer output is employee count times `laborProductivityUnitsPerWorker`; at the default productivity of five, each consumer firm produces 50 units per day at `N=100`. Transport does not use consumer-production units. Households choose available suppliers by delivered cost under percentage expenditure budgets.

## Daily step

`stepSimulation` copies the previous state (structurally sharing history) and runs named phases in a fixed causal order:

1. `startDay` clears every daily field and records `DAY_STARTED`.
2. `produce` sets each consumer firm's output from its workers' productivity.
3. `runMarkets` opens each consumer industry in turn. For each one, `clearMarket` executes the purchases and `decidePrices` expires unsold stock, books revenue, and runs the pricing strategy for tomorrow.
4. `runPayroll` pays contractual wages from revenue (pro rata when short) and then the 100% corporate profit tax.
5. `runFiscalPhase` lets Government trial a wealth-tax rate, collects the tax, redistributes by water filling, and judges the trial.
6. `buildDayMetrics` and `closeDay` record the bounded metrics, check every invariant, and close the event ledger.

The market RNG is drawn in this exact sequence: each industry's shuffle, then two draws per household for its preferred firm and tie-break number, then one draw per successful purchase, then that industry's price-probe draws, before the next industry opens. Pricing decisions therefore stay inside the per-industry loop rather than running as a separate phase after all markets.

## Market clearing order

Households do not simply buy in random order. For each consumer industry, `clearMarket` builds the purchasing order as follows.

1. **Seeded shuffle.** All households are shuffled with the market RNG.
2. **Preferred firm.** In shuffled order, each household ranks the industry's firms by delivered cost (posted price plus round-trip transport fee) and prefers the cheapest. An exact tie is broken by a seeded draw over the tied firms. Each household then draws a seeded tie-break number, so the RNG consumes two draws per household in shuffled order.
3. **Proximity priority.** At each firm, in firm-ID order, the households that prefer it are queued nearest first (ties by the tie-break number). The first households up to the firm's available stock form the primary queue.
4. **Fallback.** Households beyond a firm's stock form the overflow. The overflow from every firm is ordered by one-way distance to that household's next-best alternative, the cheapest firm by delivered cost other than its preferred one, with ties by the tie-break number. With two firms the alternative is simply the other firm.
5. **Purchase.** The primary queue buys first, then the overflow. Each household buys from the cheapest affordable firm that still has stock (within both its category budget and its cash), choosing among exact ties with a seeded draw. That draw happens for every successful purchase, even when only one firm is cheapest, so the market stream advances once per purchase. A household that can afford no firm records an affordability failure, classified as `category_budget` when even the cheapest delivered cost exceeds its budget and `cash` otherwise. A household that can afford a firm but finds none with stock records a stockout.

**Why.** The MVP4 lab notes record the intent: the nearest households receive earlier inventory access, seeded ties avoid giving priority by household ID, and an affordable fallback is tried before a purchase fails. They do not record why the overflow is ordered by distance to the alternative; in effect it gives the households closest to their second choice the first chance at it. Every step is explicit and seeded from the market stream (rules 7, 8 and 21), so the order is exactly reproducible.

## Strategy boundaries and RNG

`pricingStrategy.ts` owns private firm learning. Firms receive their own realized operating outcomes and, when they run a competitor-anchored experiment, the lowest price a rival in their industry advertised that morning; they do not receive rival sales or profit, household wealth, Gini, Government references, or future information.

`government.ts` owns the bounded Government learner and fiscal rules. Government sees current administered post-payroll cash and its realized policy history. It cannot inspect future markets or simulate counterfactual futures. Market ordering, geography, employment, payroll remainder, firm probing, and Government policy use deterministic seeds; Government has a dedicated substream so its experiments do not perturb unrelated stochastic sequences. Its seed is the salted master seed passed through the nonlinear `mixSeed` bijection, so it is neither equal to nor a fixed XOR offset of the market, spatial, or employment seeds under the linear xorshift generator.

## Fiscal accounting

The authoritative tax rate is integer basis points. Contractual payroll is cash-constrained, so firms can leave wages unpaid. After payroll, each firm's residual profit is explicitly transferred to Government as the fixed 100% corporate-profit tax. Independently, wealth-tax liabilities floor to integer cents and are explicit Household → Government transfers. Deterministic water filling returns the combined Government pool through Government → Household transfers; seeded tied-group ordering allocates indivisible remainder cents. After a completed day, firms and Government hold zero cash, while households collectively hold the full population-derived supply: `householdCount × 5,000 cents` (500,000 cents at canonical `N=100`).

Household state distinguishes pre-tax cash, gross tax, gross transfer, net fiscal transfer, post-fiscal cash, and cumulative fiscal positions. Government state retains incumbent/applied rates, current reference, experiment category/outcome, receipts, transfers, and pre/post Gini.

## Observer analytics and experiments

Live event and metric histories are bounded. `employmentDynamics.ts` preserves the MVP5 007.1 complete finite trajectory analysis. `governmentExperiment.ts` collects compact complete observations over an explicit horizon and compares adaptive Government with an inactive same-seed baseline. It reports policy occupancy/spells, pre/post inequality and concentration, consumption failures, sell-through, revenue, and wages. Observer computations never enter household, firm, or Government decisions.

## Interface boundary

React controls configuration and time and renders Government, household fiscal positions, markets, trajectories, and experiment reports. Horizontal table scrolling preserves compact mobile layouts. No economic rule exists in React.
## Retained MVP7 settlement boundary

After markets and the unchanged price-learning evaluation, firms pay fixed cash-constrained contractual payroll. Residual cash is explicit profit and is transferred to Government as fixed 100% corporate profit tax. Government then collects its independently adaptive household wealth tax and redistributes the combined balance once. Monetary amounts use integer cents; payroll remainder ordering is derived independently from stable seed/day/entity identities.
## MVP8 configurable population

`SimulationConfig.householdCount` is the population authority. Canonical MVP8 uses 100; the scale harness also uses 10. Initial money, household generation, spatial entities, employment slots, production, payroll, demand denominators, and invariants derive from that value. Employment permits complete blocks of one worker per consumer firm plus two for Transport (ten households in the canonical economy), assigning `N/10` workers to every consumer firm and `N/5` to Transport through its isolated subseed. `createSimulation` validates the population, grid and market structure before building any agent.
