# MVP 1 finite-supply specification

This document is subordinate to the repository's [governing simulation design rules](../SIMULATION_DESIGN_RULES.md). [MVP0_SPEC.md](MVP0_SPEC.md) remains the historical unlimited-supply specification.

## Research question

> How does the existing price-discovery mechanism behave when quantity sold is constrained by finite physical supply rather than only by consumer affordability?

## World and configuration

The world retains ten households, one firm, one government, one food good, 10,000 total integer cents, zero food cost, 100% firm-revenue taxation, and equal redistribution. Each household desires at most one unit per day.

The reset configuration contains starting price, initial search step, and non-negative integer `dailyFoodSupply`. Supply defaults to ten units and is fixed for the run. It is exogenous: MVP 1 contains no workers, suppliers, machinery, inputs, costs, or firm quantity choice.

Ten units match the ten households' maximum daily desired consumption. This is an explicit stabilizing experimental assumption: on an affordable day all households buy, full redistribution returns each household's spending, and household cash remains equal. Configurations below ten remain supported for scarcity analysis.

## Exact day lifecycle

1. Advance the day and clear daily outcome fields.
2. Receive exactly the configured exogenous food supply and emit `FOOD_SUPPLY_RECEIVED`.
3. Post the price selected using information available through yesterday.
4. Process each household once in deterministic rotating order.
5. For each attempt, record a purchase, insufficient-funds failure, or stockout failure.
6. Expire all unsold stock through `FOOD_EXPIRED`; carry-over becomes exactly zero.
7. Record units sold, revenue, and zero-cost pre-tax profit.
8. Give the unchanged pricing strategy only its existing realised-result inputs; select tomorrow's price.
9. Tax the firm's full cash balance and redistribute the full government balance.
10. Derive metrics, validate money and food invariants, and end the day.

## Allocation and outcomes

Day 1 starts at household 1, day 2 at household 2, and so on, wrapping after household 10. The remaining household order is cyclic. No randomness is used.

Affordability is evaluated before stock availability for each attempt. A household below the posted price receives `insufficient_funds`, including when inventory is also zero. An affordable household receives `stockout` only when no food remains. This makes the $10.01 all-unaffordable benchmark causal rather than order-dependent.

## Food accounting

Food has an explicit source and destination:

```text
exogenous receipt → household purchase or expiration
```

For every completed day:

```text
dailyFoodSupply = unitsSold + unitsExpired
unitsSold <= dailyFoodSupply
availableFoodToday = 0
```

Expiration is an explicit simplifying institution. There is no persistent inventory.

## Firm boundary and pricing

The engine records supply, remaining stock, sellout status, and household failure causes. The pricing strategy still receives only current price, units sold, realised profit, and its private learning state. It receives no stockout-attempt count, balances, willingness to pay, benchmark, or future information. No `if stockout then raise price` rule exists.

## Metrics and events

Historical daily metrics include food supplied, units sold, units expired, stockout failures, affordability failures, sold-out status, pricing state, revenue/profit, institutional balances, and total money.

MVP 1.1 adds observer-only market-open affordability; pre-market and end-of-day minimum, median, maximum, and Gini household cash; and cumulative per-household purchases and failure causes. These measurements describe existing state and events. They do not alter the MVP 1 economy or cross the pricing-strategy boundary.

A controlled research utility runs a finite starting-price grid through the same public engine using the current ten-unit default. Only starting price varies within a suite; non-convergence at the 300-day horizon is reported as null rather than converted into a result.

The causal event taxonomy adds `FOOD_SUPPLY_RECEIVED`, `HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS`, `HOUSEHOLD_PURCHASE_FAILED_STOCKOUT`, and `FOOD_EXPIRED`. Raw household events remain inspectable beneath display-only market summaries.

## Exclusions

MVP 1 excludes persistent inventory, endogenous production, production costs, labour, wages, suppliers, investment, capital, multiple firms or goods, price-sensitive demand beyond affordability, borrowing, ownership, shocks, heterogeneous preferences, forecasting, and stockout-based pricing heuristics.
