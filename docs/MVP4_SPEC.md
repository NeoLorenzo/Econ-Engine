# MVP 4 spatial Entertainment specification

This specification is subordinate to [SIMULATION_DESIGN_RULES.md](../SIMULATION_DESIGN_RULES.md) and extends MVP 3/005.2 without changing its pricing learner or persistent-probe mechanism.

## Release

`[MVP4-Spatial_Entertainment-006]`

Pricing-intelligence refinement: `[MVP4-Spatial_Entertainment-006.1]`.

## 006.1 public prices and experiment catalogs

Entertainment firms may observe only the currently advertised sticker price of the other Entertainment firm. Competitor sales, profit, share, strategy state, household geography, budgets, travel quotes, choices, and counterfactual demand remain hidden. Monopoly firms receive no competitor input.

At each locally settled experiment opportunity, a catalog is regenerated from incumbent `P`: `P ± 1 cent`, `P × 1.05`, `P × 0.95`, `P × 1.10`, `P × 0.90`, and `P × 0.80`. Entertainment adds competitor `C`, `C ± 1 cent`, `C × 1.05`, and `C × 0.95`. Percentage prices round to integer cents; candidates are clamped to the one-cent minimum, deduplicated, and cannot equal the incumbent. The existing seeded probability is unchanged and a seeded draw selects a candidate without fixed ordering.

If the firm sold its entire finite stock on the just-completed day, every candidate below its incumbent is removed before seeded selection. This applies by resulting price, not merely category name, so a competitor match or competitor-anchored candidate is also masked when it would reduce price. Upward candidates remain available. When the firm did not sell out, the full catalog remains eligible.

On each ordinary locally settled incumbent-price day, the firm's own realised profit refreshes `incumbentProfitCents`. A subsequent experiment compares its realised profit strictly against that recent reference. A strict improvement adopts the candidate; otherwise the engine restores the incumbent. This prevents profit earned under a stale competitor environment from permanently vetoing current experiments while avoiding forecasting or analytic optimization.

Structured experiment types and events expose the candidate's origin, observed public competitor price, incumbent and tested prices, recent reference profit, and experimental profit to observers. These fields do not expand the firm's behavioral input beyond advertised price and its own outcomes.

## World and RNG

The canonical world is a fixed 20 × 20 integer grid containing ten households and Entertainment Firms A and B on twelve unique in-bounds cells. A deterministic spatial subseed is derived from the master seed using a fixed 32-bit mixing constant. Placement consumes only this derived stream; runtime market randomness begins from the normalized master seed exactly as before. Positions never change during a run and no plotted or intermediate position exists for Food, Utilities, Healthcare, Transport, or Government. `Math.random()` remains prohibited.

## Entertainment travel and choice

One-way distance is Manhattan distance. A purchase requires a conceptual round trip of exactly twice that distance. At the canonical exogenous rate of 2 cents per tile, the delivered cost is:

```text
firm sticker price + (2 × Manhattan distance × 2 cents)
```

Households rank available firms by delivered cost, require the complete delivered cost to fit both the $5 Entertainment budget and real cash, and use seeded tie-breaking. Each household buys at most one unit. Households preferring a firm are served nearest-first with seeded equal-distance ties; if stock disappears, remaining affordable inventory at the alternative firm may be used before a final failure is recorded.

## Transactions and Transport

The product component is transferred from the household to the chosen Entertainment firm. The travel component is separately transferred to the existing Transport firm and separately recorded. Transport is therefore an unlimited-capacity, inventory-free, zero-cost derived service. The former abstract one-unit-per-household daily Transport consumer market is removed. Transport has no adaptive price; its per-tile rate is an exogenous configuration parameter.

## Pricing information boundary

The 005.2 `decideTomorrowPrice` learner is unchanged. Entertainment firms still receive only their own tested price, realised unit sales, zero-cost profit, and private pricing state. Coordinates, delivered costs, competitor prices and profits, market share, customer distances, and latent demand remain observer-only.

## Government parity institution

After markets, Government taxes 100% of every firm's cash, including Transport. It then makes an explicit household-specific transfer equal to the configured target ($50.00) less that household's current cash. The government must hold exactly the sum required. No balance is reset or corrected. End-of-day invariants require every household at $50.00, every firm at zero, Government at zero, and total money at $500.00. This deliberately artificial stabilizer isolates within-day market mechanisms; it is not an empirical fiscal model.

## Observer surface

Household state exposes coordinates, distances, chosen firm, chosen distance, round-trip tiles, product price, travel fee, and delivered cost. Firm metrics expose location, tested price, sales, profit, share, and average customer distance. Daily metrics expose trips, tiles, Transport revenue, average fee, pre-parity Gini, post-parity Gini, and total money. Purchase and travel events retain enough causal fields to reconstruct both transfers.

## Scope exclusions

This release excludes spatial Food/Utilities/Healthcare, animations, pathfinding, roads, congestion, Transport capacity, adaptive Transport pricing, firm or household relocation, land prices, geography, product differentiation, and competitor-price awareness.
