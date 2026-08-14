# [MVP8-Population_Scaling-010]

MVP8 scales the canonical economy from 10 to 100 households without adding an economic mechanism. Every household still begins with $50, so expected money is derived as `household count × 5,000 cents`: $5,000 canonically.

The firm set, Government, 20×20 grid, individual budgets, $10 wage, five-unit worker productivity, prices, transport rate, market rules, MVP7 settlement, and MVP6 wealth-tax learner are unchanged. Population is configurable in complete ten-household blocks so the research harness can compare N=10 and N=100.

Employment slots scale proportionally through the isolated employment subseed. Each of eight consumer firms has `N/10` workers and Transport has `N/5`; canonical counts are 10 and 20. Each consumer firm consequently produces 50 units and owes $100 payroll per day. Transport owes $200 and remains service-capacity unconstrained.

Household IDs, placement, employment, creation, invariants, money supply, analytics, and observer surfaces derive from configured population. Spatial coordinates remain unique on the 20×20 grid. Live metrics and events remain bounded; the event bound is 1,600 so a complete 100-household day remains inspectable.

The population-scale experiment runs the same seed at N=10 and N=100 and reports raw totals separately from per-capita/rate measures for consumption, prices, competition, space, payroll, taxation, distribution, and Government behavior. No scale result changes agent behavior.
