# Validation

Validation combines an analytical benchmark, runtime assertions and black-box simulation tests. The governing [design rules](../SIMULATION_DESIGN_RULES.md) require both known invariants and known predictions.

| Posted price | Expected sales | Expected revenue |
|---:|---:|---:|
| $9.99 | 10 | $99.90 |
| $10.00 | 10 | $100.00 |
| $10.01 | 0 | $0.00 |

The benchmark follows from homogeneous 1,000-cent household balances and one-unit demand. It is validation information, not firm knowledge.

`engine.test.ts` verifies exact purchase accounting, taxation, redistribution, non-negative balances and the 10,000-cent invariant over many days. It runs the actual learner from $2.00 and $20.00, expecting both paths to discover and converge at $10.00. A high-price run must descend through equal zero-profit experiments until it observes positive demand. Duplicate configured runs must produce identical snapshots and events. A convergence test confirms that both adjacent cents are realised experiments and that the firm then holds its best price.

Runtime checks additionally require integer money, ten households, price and step of at least one cent, zero to ten daily sales, an empty firm after tax, and an empty government after redistribution.

The dashboard keeps total money as a headline invariant rather than a dedicated flat chart. Its fourth research chart shows the recorded daily search-step history as the learner narrows toward one cent. Display-grouping tests verify that repeated household events become concise market summaries without mutating or removing the underlying raw events.

Run all checks with:

```bash
npm run check
```

Future scenarios should state an analytical or accounting prediction first, construct the smallest initial state that isolates it, exercise the public engine rather than internal transitions, and test both agent outcomes and conservation. MVP 0 does not validate realism, welfare, competitive equilibrium or behaviour outside its deliberately artificial assumptions.
