# MVP 5 employment specification

## Release

`[MVP5-Employment-007]`

MVP5 replaces the artificial tax-and-parity circuit with the first direct production-income loop: household consumption pays firms, and firms distribute all daily revenue to their workers as wages. Government remains an agent but defaults to a zero-percent firm tax, no parity transfers, and zero cash.

## Fixed seeded employment

Ten canonical employment slots match the ten households exactly. Each of the eight consumer firms employs one worker; Transport employs two. Household IDs and firm slots are canonically sorted before a dedicated employment subseed shuffles household IDs, so assignment is independent of input array order, reproducible for the same seed, and isolated from spatial and runtime market RNG streams. Employment never changes during a run.

Labor is non-spatial in this MVP. Workers supply labor without a modeled commute, work travel, geography, skills, search, unemployment, vacancies, hiring, firing, or employer choice.

## Production lifecycle

At the start of each day every consumer firm produces `employee count × 5 units`. Its five units become finite daily inventory before any household purchases. Market choice, proximity ordering, delivered-cost affordability, product/Transport payment separation, competition, and pricing experiments remain MVP4 mechanisms. Unsold output expires at market closure, with the exact identity `units produced = units sold + units expired`.

Transport is an explicit exception: it has two employees for employment and wage accounting, while its derived service remains effectively unlimited. Transport has no production-unit or worker-capacity model.

## Operating earnings and payroll

Sales revenue is the zero-cost operating result consumed by the unchanged pricing learner before payroll. After all consumer markets, inventory closure, Transport activity, and price updates, each firm’s entire cash balance becomes its wage pool. A one-worker firm pays the entire pool to that worker. Transport pays each worker `floor(pool / 2)` and assigns any indivisible cent using a deterministic order derived from seed, day, and firm ID. Every wage is an explicit `WAGE_PAID` transfer; total wages equal the pool and retained firm profit/cash is zero.

## Persistent household wealth and conservation

Households start with $50 each and thereafter carry cash forward: prior cash minus consumption plus wages. Category percentage ceilings remain behavioral constraints over the fixed $50 daily expenditure base; actual cash affordability also binds, and no category wallets exist. Wealth divergence, insolvency without negative cash, affordability failures, and unequal wages are intended outcomes.

Production creates goods, never money. Purchases, Transport fees, and payroll are exact integer-cent transfers. Total household, firm, and Government cash is always $500; after completed payroll households hold the full $500 and all firms and Government hold zero.

## Events, analytics, and information boundaries

`EMPLOYMENT_ASSIGNED`, `FIRM_PRODUCED`, and `WAGE_PAID` expose causal employment, production, and income accounting. Household state records employer, daily and cumulative wages, daily spending, and net cash change. Firm state records employees, applicable productivity, production, wage pool, wages paid, and mean wage. Daily observer metrics include the cash distribution and Gini, mean wage, wage Gini, total wages, and spending. These measurements are not behavioral inputs. Firms still observe their own operating outcomes and same-industry advertised competitor price only.

## Scope exclusions

MVP5 deliberately excludes labor-market search and mobility, unemployment, vacancies, negotiated or fixed wages, minimum wages, skills, commuting, production inputs, non-labor costs, retained earnings, debt, credit, welfare, income tax, positive firm tax, capital, investment, and labor-constrained Transport capacity.

## 007.1 Employment / Wealth Dynamics analysis

`[MVP5-Employment-007.1]` is observational only and does not change the economy. A finite experiment harness collects compact observations for every day 1–1,000 outside the bounded interactive history, then pure functions analyze cash and wage inequality, top-1/2/3 concentration, fractional tie-aware wealth ranks, rank mobility, strict low-cash occupancy and spells, employer-worker outcomes, purchase completion, three distinct failure causes, production utilization, and prior-cash-bin subsequent completion. Wealth is the completed-day cash stock; income is the daily wage flow. Terminal snapshots remain secondary.

Insufficient-funds events expose the cash available at the purchase attempt, category ceiling, and cheapest delivered cost. This observer data distinguishes an actual-cash constraint from a category-budget constraint without changing selection, affordability, RNG draws, or accounting. Exact ties are represented analytically and consume no RNG. The report includes a descriptive Pearson cumulative-wage/mean-cash correlation across N=10 with no significance or causal interpretation.
