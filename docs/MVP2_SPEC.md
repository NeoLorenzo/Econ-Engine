# MVP 2 multi-industry specification

This document is subordinate to the repository's [governing simulation design rules](../SIMULATION_DESIGN_RULES.md). [MVP1_SPEC.md](MVP1_SPEC.md) remains the historical finite single-market specification.

## Research question

> Can Econ-Engine support several simultaneous markets and independently learning firms while preserving a deterministic, analytically known, stable reference economy?

## Agents and industries

The default world contains ten homogeneous households, one government, and exactly five industries: Food, Utilities, Transport, Healthcare, and Entertainment. Each industry has exactly one zero-cost firm. Industries are currently identities over symmetric mechanics, not realistic product bundles.

Each household starts with one real `cashCents` balance of 5,000 cents. Firms and government start with zero. Total initial money is therefore 50,000 cents.

## Cash and industry budgets

Every household has a fixed daily 1,000-cent spending constraint for each industry. A purchase requires both:

```text
household cash >= posted price
posted price <= that industry's household budget
```

Industry budgets are behavioral constraints, not wallets, deposits, assets, transfers, or additional money. They never enter monetary accounting. Spending in one industry does not consume another industry's budget, but every successful purchase reduces the same real household cash balance.

## Supply, demand, and allocation

Each firm receives the configured finite exogenous supply at day start; the default common supply is ten units per industry. Each household attempts at most one unit per industry per day. Markets use the existing deterministic rotating household order. Unsold units expire after each market, and no inventory persists.

For each firm and completed day:

```text
daily supply = units sold + units expired
units sold <= daily supply
ending available units = 0
```

Lower common supply remains configurable for scarcity research. No hidden stabilization is applied to those runs.

## Daily lifecycle

1. Advance the day and reset daily household, firm, and government outcome fields.
2. Snapshot opening household wealth for observer analytics.
3. For each configured industry, receive finite supply and post the price selected yesterday.
4. Process every household once in deterministic rotating order; distinguish affordability and stockout failures.
5. Expire that market's remaining units and record its zero-cost result.
6. Give that firm's unchanged pricing strategy only its own tested price, units sold, realised profit, and private state; select tomorrow's price.
7. Tax every firm's full revenue and pool all receipts in the one government.
8. Redistribute the full pool equally, assigning indivisible-cent remainders deterministically.
9. Snapshot observer metrics and validate money, goods, outcomes, and institutional balances.
10. End the day.

Industry processing order is configurable for regression testing. Under the canonical affordable, full-supply baseline it does not change household or firm economic results.

## Pricing and information boundaries

Every firm owns a separate instance of the existing pricing state. The pricing heuristic is not given the analytical optimum and was not redesigned. A firm receives only its own current price, own units sold, own realised profit, and own private search history. It does not receive household balances or budgets, latent demand, stockout failures, other firms' results or strategy state, observer analytics, or future information.

## Government and money

Purchases transfer real cash from households to firms. Government taxes 100% of all firm revenue, pools it, then redistributes all government cash equally across ten households. At every validated boundary:

```text
household cash + firm cash + government cash = 50,000 cents
```

At day end every firm and government has zero cash.

## Metrics and events

Daily metrics contain a reusable record for each industry/firm: tested and next price, supply, sales, expiration, causal failures, revenue/profit, pricing search state, and convergence. Economy-wide metrics retain opening and ending household distributions, Gini, institutional transfers, aggregate revenue, and total money.

Generic market events carry `industryId`, `firmId`, and `householdId` where applicable. Display grouping is an observer transformation; raw events remain granular and bounded.

## Analytical stable benchmark

With ten households, ten units per market, a $10 budget per industry, and $50 cash per household, a $10 price produces ten sales and $100 revenue in each industry. Five firms produce $500 total revenue. Every household spends $50 and receives $50 from pooled redistribution, so all end at $50 and Gini remains zero. At $10.01, that industry's behavioral affordability constraint rejects all purchases.

The benchmark is validation information, not firm knowledge. The five independent learners discover it from experience.

## Invariants

- Exactly five default industries and one firm per industry.
- Exactly ten households, each with one outcome per industry per completed day.
- Money remains 50,000 integer cents; budgets are excluded.
- A household purchases at most one unit per industry per day.
- Every firm's finite stock flow balances independently.
- Firm and government cash clear after tax and redistribution.
- Histories remain bounded and deterministic.

## Scope exclusions

MVP 2 excludes within-industry competition, substitution, complements, heterogeneous preferences or budgets, endogenous allocation, production, costs, workers, wages, capital, persistent inventory, borrowing, banking, ownership, differentiated taxes, subsidies, price indexes, macro policy, random shocks, and new pricing heuristics.
