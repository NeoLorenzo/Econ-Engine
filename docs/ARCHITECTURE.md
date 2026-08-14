# Architecture

Econ-Engine separates economic rules, agent strategies, state, events, observer analytics, experiments, and React presentation so causal boundaries remain inspectable.

## Simulation core

`types.ts` defines household, firm, Government, event, and bounded daily metric state. `engine.ts` performs immutable daily steps: labor-derived production, spatial consumer markets and Transport payments, inventory expiration, firm pricing decisions, complete payroll, and finally Government tax/transfer policy. `invariants.ts` validates entity structure and exact stock/flow accounting after each completed day.

Ten households each have one fixed seeded employer. Eight consumer firms employ one worker each; monopoly Transport employs two. Consumer output is worker count times five. Households choose available suppliers by delivered cost under percentage expenditure budgets. Firm cash is complete daily operating revenue and is fully paid to workers after the pricing learner observes it.

## Strategy boundaries and RNG

`pricingStrategy.ts` owns private firm learning. Firms receive their own realized operating outcomes and public same-industry advertised prices; they do not receive household wealth, Gini, Government references, or future information.

`government.ts` owns the bounded Government learner and fiscal rules. Government sees current administered post-payroll cash and its realized policy history. It cannot inspect future markets or simulate counterfactual futures. Market ordering, geography, employment, payroll remainder, firm probing, and Government policy use deterministic seeds; Government has a dedicated substream so its experiments do not perturb unrelated stochastic sequences.

## Fiscal accounting

The authoritative tax rate is integer basis points. Wealth-tax liabilities floor to integer cents and are explicit Household → Government transfers. Deterministic water filling returns the exact pool through Government → Household transfers. Seeded tied-group ordering allocates indivisible remainder cents. After the fiscal phase firms and Government hold zero, households hold 50,000 cents, and total money is exactly 50,000 cents.

Household state distinguishes pre-tax cash, gross tax, gross transfer, net fiscal transfer, post-fiscal cash, and cumulative fiscal positions. Government state retains incumbent/applied rates, current reference, experiment category/outcome, receipts, transfers, and pre/post Gini.

## Observer analytics and experiments

Live event and metric histories are bounded. `employmentDynamics.ts` preserves the MVP5 007.1 complete finite trajectory analysis. `governmentExperiment.ts` collects compact complete observations over an explicit horizon and compares adaptive Government with an inactive same-seed baseline. It reports policy occupancy/spells, pre/post inequality and concentration, consumption failures, sell-through, revenue, and wages. Observer computations never enter household, firm, or Government decisions.

## Interface boundary

React controls configuration and time and renders Government, household fiscal positions, markets, trajectories, and experiment reports. Horizontal table scrolling preserves compact mobile layouts. No economic rule exists in React.
# MVP7 settlement boundary

After markets and the unchanged price-learning evaluation, firms pay fixed cash-constrained contractual payroll. Residual cash is explicit profit and is transferred to Government as fixed 100% corporate profit tax. Government then collects its independently adaptive household wealth tax and redistributes the combined balance once. Monetary amounts use integer cents; payroll remainder ordering is derived independently from stable seed/day/entity identities.
