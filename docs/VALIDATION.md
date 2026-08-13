# Validation

Validation combines an initial-state analytical benchmark, runtime assertions, and black-box simulation tests. The governing [design rules](../SIMULATION_DESIGN_RULES.md) require known invariants and known predictions.

With ten households holding 1,000 cents each and ten supplied units:

| Posted price | Expected sales | Expected expiration | Stockouts | Affordability failures | Revenue |
|---:|---:|---:|---:|---:|---:|
| $9.99 | 10 | 0 | 0 | 0 | $99.90 |
| $10.00 | 10 | 0 | 0 | 0 | $100.00 |
| $10.01 | 0 | 10 | 0 | 10 | $0.00 |

The initial-state revenue-maximising price is therefore $10.00. This is developer validation information and is never exposed to the firm.

## Runtime invariants

Every snapshot requires integer, non-negative money; ten households; valid price and step; non-negative integer daily supply, available stock, and expiration; sales no greater than household count or supply; and exactly 10,000 conserved cents.

Every completed day additionally requires:

```text
dailyFoodSupply = unitsSold + unitsExpired
availableFoodToday = 0
purchases + affordability failures + stockout failures = 10
```

Firm cash must be zero after tax, government cash must be zero after redistribution, household purchase flags must agree with causal outcomes, and the number of purchasing households must match firm sales.

## Automated coverage

`engine.test.ts` exercises default and configured supply, the analytical price table, sales caps, non-negative/zero ending inventory, explicit supply and expiration events, stock-flow conservation, no carry-over, distinct failure categories, complete household outcomes, rotating priority over ten days, determinism, money conservation, taxation, redistribution, historical snapshots, reset sanitization, pricing actions, high-price recovery, and adjacent-cent convergence. Display tests verify that raw purchase and failure events remain available beneath summaries which distinguish stockout and affordability causes.

`analytics.test.ts` verifies the even-population median, equal and known unequal Gini values, minimum/median/maximum summaries, queue-independent affordability counts, market-open timing, correct historical day boundaries, cumulative outcome increments, multi-day retention, and reset behavior.

`scarcityExperiment.test.ts` verifies the required starting-price grid, reproducibility, fixed non-intervention configuration, explicit horizon non-convergence, cumulative history independent of bounded events, and unchanged pricing outputs when observer-only values exist.

## Stabilized default and historical scarcity case

Ten daily units equal the ten households' maximum desired quantity. On every affordable default market, all ten households buy and the government redistributes the firm's full `10P` revenue as exactly `P` per household. Each household therefore ends with its opening cash, Gini remains zero, and the price→profit relationship remains stationary. This stabilization is an explicit, configurable environment assumption rather than a pricing rule or hidden balance reset.

The earlier eight-unit configuration remains a tested scarcity case. At eight units, buyers and non-buyers receive equal transfers but only buyers spend; household balances diverge, later affordability becomes path-dependent, and the $2.00 start converges to the historical $6.70 learner endpoint. This lower-supply result is retained for comparison, not used as the current default.

This distinction is central to interpreting validation:

- the one-day $10.00 benchmark passes exactly;
- the pricing algorithm remains structurally unchanged and deterministic;
- the ten-unit default produces a stationary repeated price-to-profit function;
- lower configured supplies can still produce the documented path-dependent dynamics.

## Controlled starting-price grid

The current MVP 1.1 research suite uses a $1.00 price-search step, ten daily units, identical household initial state, deterministic rotating allocation, and a 300-day maximum horizon. Only starting price varies. All eleven sampled runs converge to the same $10.00 learner endpoint:

| Start | Converged | Days |
|---:|---:|---:|
| $1.00 | $10.00 | 18 |
| $2.00 | $10.00 | 17 |
| $4.00 | $10.00 | 15 |
| $6.00 | $10.00 | 13 |
| $8.00 | $10.00 | 11 |
| $9.00 | $10.00 | 10 |
| $9.50 | $10.00 | 11 |
| $10.00 | $10.00 | 9 |
| $11.00 | $10.00 | 10 |
| $15.00 | $10.00 | 14 |
| $20.00 | $10.00 | 19 |

Every final household balance is $10.00 and every final Gini is zero. These are deterministic observations under the explicit ten-unit stabilizing assumption, not targets encoded in the learner.

The reported values are learner convergence endpoints, not claims of economic equilibrium or a universal long-run optimum. The known $10.00 result remains the one-day revenue optimum for the initial equal-cash state.

## Observer and agent information

Distribution metrics, Gini, market-open affordability, cumulative household outcomes, and controlled-experiment results are observer analytics. Tests confirm that the pricing strategy returns identical decisions for identical existing inputs regardless of observer-only measurements. `decideTomorrowPrice` continues to receive only current price, units sold, realised profit, and private pricing state.

## Current validation baseline

- `npm run test:run`: 41 tests passed across four files.
- `npm run typecheck`: passed.
- `npm run build`: passed with the existing non-failing Vite bundle-size advisory.
- `npm run check`: passed.
- Desktop and 390-pixel mobile layouts passed with populated experiment results and no browser console warnings or errors.
- GitHub Pages deployment was not performed for MVP 1.1.

Run all checks with:

```bash
npm run check
```

MVP 1 validates accounting, causality, reproducibility, and known scenarios. It does not validate welfare, realism, equilibrium, or a general optimizer.
