# [MVP9-Plots-026]

MVP9 gives buildings realistic land. Households still stand on single tiles. Every firm and Government now stands on a rectangular plot whose size depends on what it is, on a 40×40 grid. Plots are part of the simulation: a household's trip to a firm is measured to the nearest tile of the firm's plot. Nothing else changes: the population, firms, budgets, wages, productivity, pricing learner, market rules, payroll, taxation and Government learner are those of MVP8.

## Plots

A plot is `{ x, y, width, height }`: its lowest-numbered tile and its size in tiles. `Firm.plot` replaces MVP8's `Firm.coordinate`, and every firm has one, including Transport. `Government.plot` is new. Households keep a single `coordinate`.

| Owner | Plot (width × height) |
| --- | --- |
| Utilities firm | 4 × 4 |
| Food firm | 3 × 3 |
| Entertainment firm | 3 × 3 |
| Healthcare firm | 3 × 2 |
| Transport | 4 × 3 |
| Government | 5 × 5 |

Plots that are not square may be turned 90°. Sizes are fixed by industry for the whole run; a firm's plot never grows, shrinks or moves.

Government's and Transport's plots have no economic effect. Government's location plays no part in taxation or transfers, and Transport charges the per-tile rate wherever its depot stands.

## Placement

The layout comes from the spatial seed, `deriveSpatialSeed(seed)`, which no other random stream shares. Market, probe, Government and employment draws are therefore identical whatever the layout.

1. Government's plot is centred at `x = floor((gridWidth − 5) / 2)`, `y = floor((gridHeight − 5) / 2)`.
2. Firm plots are placed in descending area, then by firm ID:
   - A plot that is not square draws its orientation first.
   - It then draws its position uniformly from every position that lies inside the grid and leaves at least one empty tile between it and every plot already placed.
   - If the drawn orientation fits nowhere, the other orientation is tried. If neither fits, setup throws an error naming `gridWidth × gridHeight`.
3. Households are shuffled onto the tiles that no plot covers, exactly as MVP8 shuffled every entity onto the grid. A house may stand right next to a plot.

## Distance and transport

`plotDistance(coordinate, plot)` is the Manhattan distance from the household's tile to the nearest tile of the plot: 0 on the plot, 1 next to an edge. For a one-tile plot it equals MVP8's Manhattan distance. The round trip is twice the one-way distance, and the transport fee is the round trip times `transportCostPerTileCents`. The delivered cost a household compares, the fallback order, the purchase record (`distancesByFirmId`, `chosenOneWayDistance`) and the market metrics (`averageCustomerDistance`) all use this distance.

## Defaults and validation

- `gridWidth = gridHeight = 40`, and `transportCostPerTileCents = 1`. Each MVP9 tile is half as wide as an MVP8 tile, so the rate is halved and a trip across town costs about what it did in MVP8.
- `createSimulation` refuses a grid that cannot hold one tile per household plus every plot and its gap. Each plot counts as `(width + 1) × (height + 1)` tiles; the canonical economy needs 194 cells of plot land plus 100 households. Placement can still fail on an awkward grid, and then throws the same kind of error.
- The Settings drawer's default transport rate is derived from the model default, so the observer's default run is the canonical run.

## Invariants

- Household coordinates are unique, inside the grid, and on no plot.
- Every plot lies inside the grid, has its owner's size in either orientation, and keeps at least one empty tile from every other plot.

## MVP8 and MVP9 compared

Eight seeds (`20260813` and 1–7), 400 days each, averaged over days 101–400 (after the opening price search). The tables give each measure's mean across seeds, with the lowest and highest seed in brackets. Distances are in MVP8 tiles, so MVP9's tile counts are halved for comparison.

| Measure | MVP8 (20×20, 2¢) | MVP9 (40×40, 1¢) |
| --- | --- | --- |
| Needs met | 96.1% [95.1, 96.9] | 96.5% [95.8, 97.1] |
| Customer trip, one way (MVP8 tiles) | 9.64 [9.09, 9.94] | 8.24 [7.68, 8.64] |
| Average transport fee | 38.5¢ [36.4, 39.8] | 33.0¢ [30.7, 34.5] |
| Cash Gini before redistribution | 0.023 [0.018, 0.029] | 0.025 [0.022, 0.030] |
| Wages paid | 88.8% [87.3, 90.3] | 87.4% [85.2, 88.9] |
| Applied wealth-tax rate | 17.1% [11.4, 24.4] | 30.5% [13.0, 48.3] |

| Market | Price, MVP8 | Price, MVP9 | Share gap A–B, MVP8 | Share gap A–B, MVP9 |
| --- | --- | --- | --- | --- |
| Food | $5.52 | $5.54 | 5.8 pp | 5.8 pp |
| Utilities | $2.16 | $2.29 | 3.0 pp | 2.2 pp |
| Healthcare | $3.04 | $3.20 | 3.7 pp | 4.1 pp |
| Entertainment | $1.51 | $1.57 | 4.7 pp | 3.8 pp |

Measuring trips to a plot's nearest edge shortens them by about 15%, and transport fees fall by the same proportion. Firms take back part of that saving as higher prices, most clearly in Utilities (+6%, the largest plots) and Healthcare (+5%). Needs met, pre-redistribution inequality, wages paid and market-share gaps stay within the range seen across seeds. The mean tax rate is higher, but its seed range overlaps MVP8's: Government's trial-and-error learner settles at very different rates from seed to seed, so this is not a demonstrated shift.
