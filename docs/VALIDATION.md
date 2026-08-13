# Validation

MVP 2 validation combines analytical benchmarks, runtime invariants, deterministic black-box tests, a controlled five-firm experiment, and browser checks. The [design rules](../SIMULATION_DESIGN_RULES.md) remain authoritative.

## Analytical benchmark

For any industry with ten households, ten supplied units, and household budget `B`:

| Price | Sales | Expired | Stockouts | Affordability failures | Firm revenue |
|---:|---:|---:|---:|---:|---:|
| B − $0.01 | 10 | 0 | 0 | 0 | 10(B − $0.01) |
| B | 10 | 0 | 0 | 0 | 10B |
| B + $0.01 | 0 | 10 | 0 | 10 | $0.00 |

Default budgets and firm optima are Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5. Their sum is $50, so total revenue/tax/redistribution at the joint benchmark is $500. Every household spends and receives $50, ends at $50, and Gini is zero.

## Runtime invariants

- Five unique industries, exactly one firm per industry, and ten households.
- Every household has a $10 constraint/outcome record for every industry; cumulative causes sum to the day count.
- `total household cash + total firm cash + government cash = 50,000 cents`; budget fields are excluded.
- Every market satisfies `daily supply = units sold + units expired`, non-negative inventory, no carry-over, and sales no greater than supply or household count.
- Each household has at most one purchase and exactly one causal outcome per industry/day.
- All firm cash is taxed and the government pool is fully redistributed at day end.

## Automated coverage

The suite covers industry and firm cardinality, independent pricing states, household cash/budgets/outcomes, budget non-monetization, finite stock per market, affordability/stockout distinctions, five-purchase days, cross-market budget independence, full tax pooling, equal redistribution, long-run balance/Gini/money stability, varied-start convergence, learner isolation, determinism, industry-order independence, lower-supply stockouts, cumulative counters, reset, generic event identity/grouping, observer boundaries, and bounded histories.

## Observed five-firm convergence

With starts Food $1, Utilities $2, Transport $5, Healthcare $15, Entertainment $20; initial step $1; supply ten each; and horizon 300:

| Industry | Endpoint | Convergence day |
|---|---:|---:|
| Food | $15.00 | 23 |
| Utilities | $12.00 | 19 |
| Transport | $8.00 | 12 |
| Healthcare | $10.00 | 14 |
| Entertainment | $5.00 | 24 |

The joint run ended on day 24 with every household at $50, Gini 0, and total money $500. A 1,000-day run held every firm at its own industry ceiling after convergence, all household balances at $50, Gini at zero, and total money at $500.

Forward and reversed industry processing orders produced identical canonical household states and per-firm price, search, sales, and revenue results. Identical runs produced identical full state, metrics, events, and cumulative outcomes.

Lower common supply remains an explicitly different scarcity configuration: it produces valid stockout events and can retain wealth divergence/path dependence. It is not forced into canonical stability.

## Validation commands

```bash
npm run test:run
npm run typecheck
npm run build
npm run check
```

Final command and browser results are recorded in the newest changelog and lab-note entries. Validation establishes accounting, causality, reproducibility, and the known controlled benchmark; it does not establish realism, welfare, or general equilibrium.

The development server and normal desktop dashboard were verified for MVP 2.1. The market table displayed all five configured household budgets, the populated experiment displayed the observed distinct endpoints/days, and the browser console contained no warnings or errors. A new 390px mobile check was not requested or performed for this deliberately small table/configuration update.
