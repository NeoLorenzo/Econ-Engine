# Architecture

Econ-Engine separates economic rules, agent strategies, state, events, observer analytics, experiments, and React presentation so causal boundaries remain inspectable.

## MVP8.1 observer architecture

React conditionally mounts Overview, Markets, Households & Labor, Government, and Research. Persistent controls own execution and draft initialization values. Tabs, selected industry, settings disclosure, household query, and deterministic sort order are local UI state only; none enters `stepSimulation` or an RNG source. Hidden charts and large observers are unmounted rather than visually concealed.

Overview provides economy-wide state; domain tabs provide detailed live state; Research hosts explicit independent experiment harnesses. Markets calls legacy `preTaxProfit` operating earnings, while payroll tables call `residualProfit` residual profit. Tables select agents semantically in React and never hide rows by CSS position.

## Simulation core

`types.ts` defines household, firm, Government, event, and bounded daily metric state. `engine.ts` performs immutable daily steps: labor-derived production, spatial consumer markets and Transport payments, inventory expiration, firm pricing decisions, cash-constrained contractual payroll, and finally Government tax/transfer policy. `invariants.ts` validates entity structure and exact stock/flow accounting after each completed day.

`SimulationConfig.householdCount` is the population authority. The canonical MVP8 economy has `N=100` households, while research configurations use complete ten-household blocks, including `N=10`. It has five industries and nine firms: two each in Food, Utilities, Healthcare, and Entertainment, plus one Transport firm. Each non-Transport consumer firm employs `N/10` workers and Transport employs `N/5`; canonically those counts are 10 and 20. Consumer output is employee count times `laborProductivityUnitsPerWorker`; at the default productivity of five, each consumer firm produces 50 units per day at `N=100`. Transport does not use consumer-production units. Households choose available suppliers by delivered cost under percentage expenditure budgets.

## Strategy boundaries and RNG

`pricingStrategy.ts` owns private firm learning. Firms receive their own realized operating outcomes and public same-industry advertised prices; they do not receive household wealth, Gini, Government references, or future information.

`government.ts` owns the bounded Government learner and fiscal rules. Government sees current administered post-payroll cash and its realized policy history. It cannot inspect future markets or simulate counterfactual futures. Market ordering, geography, employment, payroll remainder, firm probing, and Government policy use deterministic seeds; Government has a dedicated substream so its experiments do not perturb unrelated stochastic sequences.

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

`SimulationConfig.householdCount` is the population authority. Canonical MVP8 uses 100; the scale harness also uses 10. Initial money, household generation, spatial entities, employment slots, production, payroll, demand denominators, and invariants derive from that value. Employment permits complete ten-household blocks, assigning `N/10` workers to every consumer firm and `N/5` to Transport through its isolated subseed.
