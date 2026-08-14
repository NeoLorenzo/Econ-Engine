# MVP 6 adaptive Government specification

## Release

`[MVP6-Government-008]` turns Government into a bounded adaptive actor. This is a stylized tax-and-transfer experiment, not a realistic fiscal system. MVP5 employment, production, markets, pricing, Transport, payroll, persistent household cash, and the exact $500 money stock remain intact.

## Objective and instrument

Government minimizes realized post-fiscal household cash Gini. When outcomes are equal within `1e-12`, it prefers the lower statutory rate. It has no GDP, consumption, employment, revenue, wage, profit, or welfare objective. Its sole instrument is one flat household wealth-tax rate represented as integer basis points from `0` through `10_000`.

The tax base is each household's cash immediately after payroll. Tax is `floor(postPayrollCashCents * rateBps / 10_000)`: liabilities round down to a whole cent, never exceed cash, and move explicitly from Household to Government.

## Information boundary and learner

Government observes current taxable cash, current pre-fiscal Gini, its prior policies, its recent incumbent outcome, realized experimental outcomes, and its receipts. It cannot inspect future wages, prices, purchases, RNG, or counterfactual trajectories. Firms gain none of Government's distributional information.

The incumbent starts at 0%. A normal incumbent day refreshes the realized Gini reference. After the first reference, a dedicated seeded Government RNG substream starts an experiment with default probability `0.1` per day. The catalog is incumbent `+/-1`, `+/-5`, `+/-10`, and `+/-20` percentage points plus anchors `0%`, `25%`, `50%`, `75%`, and `100%`; candidates are clamped, deduplicated, and the incumbent is removed.

An experiment is adopted if its post-fiscal Gini is lower than the recent incumbent reference by more than `1e-12`, or if the two are within that tolerance and its tax rate is lower. Otherwise it is rejected. There is no permanent convergence state.

## Means-tested redistribution

Government redistributes exactly all receipts through deterministic integer-cent water filling. The currently poorest tied group is raised to the next cash tier when the pool can cover it; otherwise the pool is divided evenly over that group. A dedicated seeded shuffle allocates indivisible cents among ties, so no cent is lost or created. At 100%, ordinary collection and water filling—not a special reset—produce $50 each when equality is cent-divisible.

## Lifecycle, events, and analytics

The established phases remain production, spatial markets, inventory expiration, firm pricing, and complete payroll. The fiscal phase then captures pre-fiscal cash/Gini, chooses incumbent or experiment, collects tax, redistributes all receipts, captures post-fiscal cash/Gini, and updates the learner. End of day requires firm cash `$0`, Government cash `$0`, household cash `$500`, and total money `$500`.

The ledger records `GOVERNMENT_POLICY_EXPERIMENT_STARTED`, `WEALTH_TAX_PAID`, `MEANS_TESTED_TRANSFER_PAID`, `GOVERNMENT_POLICY_EXPERIMENT_ADOPTED`, and `GOVERNMENT_POLICY_EXPERIMENT_REJECTED`. Daily metrics retain incumbent/applied rate, status/category, pre/post Gini and reduction, taxes/transfers, payer/recipient counts, mean transfer, and maximum transfer. Household state retains daily and cumulative gross tax, gross transfer, net fiscal transfer, pre-tax cash, and post-fiscal cash.

The 1,000-day harness compares adaptive Government with an inactive 0% same-seed control using complete compact observations outside bounded live history. It reports rate occupancy and spells, experiments/outcomes, pre/post concentration, purchase/failure trajectories, sell-through, revenue, wages, and accounting. Terminal policy is secondary.

## Scope exclusions

There is no income/payroll/corporate/sales tax, statutory bracket, deduction, avoidance, earmarked program, public purchase/service, subsidy, borrowing, deficit, money creation, monetary policy, unemployment reaction, welfare utility, consumption objective, labor mobility, wage bargaining, or marginal cost.
