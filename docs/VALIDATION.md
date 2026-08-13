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

- Five unique industries, six configured firms (two in Entertainment and one in each control), and ten households.
- Every household has a $10 constraint/outcome record for every industry; cumulative causes sum to the day count.
- `total household cash + total firm cash + government cash = 50,000 cents`; budget fields are excluded.
- Every market satisfies `daily supply = units sold + units expired`, non-negative inventory, no carry-over, and sales no greater than supply or household count.
- Each household has at most one purchase and exactly one causal outcome per industry/day.
- All firm cash is taxed and the government pool is fully redistributed at day end.

## Automated coverage

The suite covers industry and firm cardinality, independent pricing states, household cash/budgets/outcomes, budget non-monetization, finite stock per market, affordability/stockout distinctions, five-purchase days, cross-market budget independence, full tax pooling, equal redistribution, long-run balance/Gini/money stability, varied-start convergence, learner isolation, determinism, industry-order independence, lower-supply stockouts, cumulative counters, reset, generic event identity/grouping, observer boundaries, and bounded histories.

## Observed control and competitive convergence

With starts Food $1, Utilities $2, Transport $5, Healthcare $15, Entertainment $20; initial step $1; supply ten each; and horizon 300:

| Industry | Endpoint | Convergence day |
|---|---:|---:|
| Food | $15.00 | 23 |
| Utilities | $12.00 | 19 |
| Transport | $8.00 | 12 |
| Healthcare | $10.00 | 14 |
| Entertainment A | $4.00 | 12 |
| Entertainment B | $4.00 | 13 |

Entertainment A started at $1 and B at $8. Full-market leadership alternated as their experimental prices crossed. A converged to a $4 best-known price on day 12 and B on day 13. From day 14 both posted $4 and deterministic ties produced 5/5 sales, $20 profit per firm, and 50% observer market share. This is the implemented learner endpoint, not an encoded competitive target.

The joint run ended on day 23 after Food reached $15; Utilities, Transport, and Healthcare retained $12/$8/$10. Every household held $50, Gini was 0, and total money was $500.

A 1,000-day run kept total money at $500, all household balances equal at $50, Gini at zero, all six firms non-negative, every per-firm stock flow balanced, total Entertainment sales at or below ten, and histories bounded. Identical long runs were deterministic.

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

Desktop and 390px browser checks passed with the populated six-firm experiment. Both tables used contained horizontal scrolling at mobile width, charts stayed within their panels, the page had no horizontal overflow, and the console contained no warnings or errors.
