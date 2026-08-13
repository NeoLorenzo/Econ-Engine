# Validation

MVP 2 validation combines analytical benchmarks, runtime invariants, deterministic black-box tests, a controlled five-firm experiment, and browser checks. The [design rules](../SIMULATION_DESIGN_RULES.md) remain authoritative.

## Analytical benchmark

For every industry with ten households, ten supplied units, and a $10 household industry budget:

| Price | Sales | Expired | Stockouts | Affordability failures | Firm revenue |
|---:|---:|---:|---:|---:|---:|
| $9.99 | 10 | 0 | 0 | 0 | $99.90 |
| $10.00 | 10 | 0 | 0 | 0 | $100.00 |
| $10.01 | 0 | 10 | 0 | 10 | $0.00 |

At $10 across five firms, total revenue/tax/redistribution is $500. Every household spends and receives $50, ends at $50, and Gini is zero.

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
| Food | $10.00 | 18 |
| Utilities | $10.00 | 17 |
| Transport | $10.00 | 14 |
| Healthcare | $10.00 | 14 |
| Entertainment | $10.00 | 19 |

The joint run ended on day 19 with every household at $50, Gini 0, and total money $500. A 1,000-day canonical run held all prices at $10 after convergence, all household balances at $50, Gini at zero, and total money at $500.

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

The development server and initial desktop dashboard DOM were verified. The in-app browser subsequently blocked further localhost actions under its URL security policy, so populated interaction, the 390px viewport, and browser-console inspection remain genuine manual follow-ups.
