# MVP 0 formal specification

> Historical specification: this describes MVP 0's unlimited-supply environment. The current model is [MVP 1 finite supply](MVP1_SPEC.md).

This document is subordinate to the repository's [governing simulation design rules](../SIMULATION_DESIGN_RULES.md).

## World and starting conditions

The world contains exactly 12 agents: households `household-1` through `household-10`, `firm-1`, and `government-1`. Each household begins with 1,000 cents. The firm and government begin with zero. Total money is therefore exactly 10,000 cents. All money is integer cents.

Food is an exogenous, unlimited, zero-cost good with no inventory. Each household wants one unit each day and buys it if and only if its own cash is at least the publicly posted price. Households are processed in ascending ID order; there is no randomness, borrowing, saving choice, utility model or heterogeneity.

The single firm posts one price for all households. Its explicit objective is to maximise realised daily pre-tax profit, which equals revenue because production cost is zero. It observes only its own tested prices, units sold, profits and strategy state. It cannot access household balances, the analytical demand function or the benchmark answer.

The government observes transactions needed for taxation. After the market it transfers 100% of firm cash to itself, then transfers the full receipt to households. It has no pricing influence. The equal quotient is paid to each household; any remainder cents go deterministically to the lowest IDs.

## Exact day lifecycle

1. The price chosen from information available through yesterday is posted.
2. Each household attempts one purchase; affordable purchases explicitly transfer cash to the firm.
3. Units, failed purchases, revenue and pre-tax profit are recorded.
4. The pricing strategy observes only that realised firm result and selects tomorrow's price.
5. The firm's full cash balance is explicitly transferred to government as tax.
6. Government explicitly redistributes its full balance to households.
7. Invariants are validated, metrics are snapshotted and the day ends.

## Implemented price learner

The configurable defaults are a 200-cent opening price and 100-cent step. Minimum price and step are one cent. The learner stores best tested price, best realised profit, current step, direction, whether positive profit has been found, adjacent-cent test flags, and convergence.

- A strictly better experiment becomes the best known result, and search continues in the current direction.
- A worse or equal result after positive profit has been found restores search around the best price, reverses direction and halves the integer step (floor, minimum one cent).
- Before any positive-profit result, a zero-sale result causes another downward price experiment. This lets high starting prices escape the zero-demand plateau using only realised sales and profit.
- At a one-cent step, the strategy tests both immediate neighbours of the best price. If neither strictly improves realised profit, it marks convergence and posts the best price indefinitely.

## Benchmark and exclusions

For prices up to 1,000 cents all households buy, so revenue is ten times price. At 1,001 cents no household can buy. The unique MVP benchmark optimum is therefore 1,000 cents, ten units and 10,000 cents daily pre-tax profit. This is not a competitive equilibrium.

Intentionally absent: finite supply, inventories, production, workers, wages, ownership, dividends, competitors, banks, debt, central banking, multiple goods, geography, price elasticity beyond affordability, heterogeneous households, stochastic shocks, external data and AI agents.
