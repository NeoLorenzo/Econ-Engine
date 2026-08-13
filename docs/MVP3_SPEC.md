# MVP 3 competition specification

This specification is subordinate to the [simulation design rules](../SIMULATION_DESIGN_RULES.md) and extends the [MVP 2 specification](MVP2_SPEC.md) only by introducing homogeneous-product competition in Entertainment.

## Research question

> What behavior emerges when two independently adapting firms compete for the same homogeneous household demand using only their own realised market outcomes?

## Market structure

Food, Utilities, Transport, and Healthcare retain one firm and their existing $15/$12/$8/$10 household demand boundaries. Entertainment retains its $5 household budget but has exactly two firms: `firm-entertainment-a` and `firm-entertainment-b`.

Every firm receives ten explicit exogenous units per day, owns independent cash, inventory, outcome fields, and pricing state, and uses the unchanged pricing learner. Unsold supply expires separately for each firm:

```text
firm supply = firm sales + firm expiration
```

Total Entertainment household demand remains at most ten units per day even though aggregate firm supply is twenty.

## Household supplier choice

Each household wants at most one unit per industry. For Entertainment it considers every firm sharing the industry ID and chooses the cheapest firm satisfying real-cash affordability, the $5 Entertainment budget, and positive inventory. If the cheapest affordable firm is empty, the household considers the next-cheapest affordable firm.

Only after all alternatives are considered does the engine record affordability failure or stockout/unavailability. A successful event identifies the actual household, industry, and firm counterparty.

Household arrival order is shuffled independently for each market/day. Equal-price available firms are selected with seeded random tie-breaking, so a day may split 6/4 or 3/7 rather than being forced to 5/5. All draws use the simulation's centralized xorshift32 state; `Math.random()` is not used. The same configuration and seed reproduce the same full run.

## Firm information boundary

Each firm receives only its own tested price, own units sold, own realised zero-cost profit, and own private pricing state. It does not receive competitor prices, sales, profits, strategy state, market share, household balances, exact affordability, latent demand, or future information. Competition affects learning only through realised local results. No undercut or best-response rule was added.

## Government and monetary stability

The one government taxes all six firms, pools receipts, and redistributes the full pool equally across ten households. Money remains exactly 50,000 cents. Under full access, homogeneous households transact at the same winning price or equal tied price, so balances remain equal and Gini remains zero.

## Observer metrics

Every firm retains tested/next/incumbent price, supply, sales, expiration, revenue/profit, and learner-status metrics. After broad discovery reaches local settlement, a firm independently samples a 10%-per-day chance to test one adjacent cent. It adopts only a strictly better own realised profit and otherwise restores its incumbent; it remains capable of future probes forever. Derived competitive fields add market share, total industry sales, and actual transaction prices. These observer fields never feed strategy.

## Stability and benchmark distinction

System/accounting stability is required: exact money, non-negative balances/inventory, per-firm stock flows, bounded histories, seeded reproducibility, and household equality. Competitive prices may keep adapting. The four monopoly controls must retain their established incumbent benchmarks despite temporary adjacent-cent probes.

## Scope exclusions

MVP 3 excludes competition outside Entertainment, additional firms, differentiation, quality, loyalty, advertising, geography, switching costs, competitor awareness, market-share strategies, explicit undercutting, costs, wages, ownership, entry/exit, bankruptcy, investment, heterogeneous households, elastic quantity demand, differentiated taxes, and credit. Seeded randomness is limited to ordering, matching, and experimentation timing/direction.
