# Multi-tile plots: design

Status: implemented. Date: 2026-10-08. Model version: MVP9. The model specification is [docs/MVP9_SPEC.md](../../MVP9_SPEC.md).

## Goal

Buildings should take realistic amounts of land. Houses keep one tile. Every firm and Government stands on a rectangular plot whose size depends on what it is, on a larger grid. This is a model change: plots are part of the simulation, and a household's trip to a firm is measured to the firm's plot.

### Success criteria

- Every firm and Government has a plot in the simulation state, of its industry's size, inside the grid, with no overlaps.
- A household's one-way distance to a firm is the Manhattan distance to the nearest tile of the firm's plot. The engine, the territory map and the 2D market map all use this one rule.
- The canonical economy runs on a 40×40 grid at 1¢ per tile, conserves money exactly, and keeps every invariant.
- The 3D world draws each firm and Government across its whole plot.
- `npm run agent:check` and the fast-mode browser check pass.

### Out of scope

- Firms growing, shrinking or moving during a run.
- Roads, routes or congestion.
- Zoning (commercial or residential areas).
- Any economic role for Government's or Transport's location.

## Decisions

| Question | Decision |
| --- | --- |
| Display only, or the simulation? | The simulation. |
| What sets a plot's size? | Industry land use, fixed for the run. |
| Where is a trip measured to? | The nearest tile of the plot. |
| Grid and rate | 40×40, with the transport rate halved from 2¢ to 1¢ per tile, so a trip across town costs about what it did on the 20×20 grid. |
| Placement | Seeded plots first, then households on the remaining tiles. |

Alternatives considered for placement:

- **A zoned town** (Government at the centre, firms in a commercial ring, houses outside). Rejected: it builds a systematic pattern into who lives near which firm, a new economic assumption that would confound comparison with MVP8.
- **Scaling up the MVP8 layout** (each old tile becomes a 2×2 block). Rejected: 3- and 4-tile plots do not fit 2×2 blocks, so neighbours would collide and need ad hoc nudging.

## Spatial model

### Plots

`Plot` is `{ x, y, width, height }`: the plot's lowest-numbered tile and its size in tiles. `Firm.coordinate` is replaced by `Firm.plot`, which every firm, including Transport, now has. `Government` gains `plot`. Households keep a single `coordinate`.

| Owner | Plot (width × height) |
| --- | --- |
| Utilities firm | 4 × 4 |
| Food firm | 3 × 3 |
| Entertainment firm | 3 × 3 |
| Healthcare firm | 3 × 2 |
| Transport | 4 × 3 |
| Government | 5 × 5 |

Plots that are not square may be turned 90°.

### Placement

All placement draws come from the spatial seed, which is separate from every other random stream. Market, probe, Government and employment draws are therefore unaffected by the layout.

1. Government's plot is centred: `x = floor((width − 5) / 2)`, `y = floor((height − 5) / 2)`.
2. The firm plots are placed in descending area, then by firm ID. For each plot that is not square, one draw picks its orientation. The plot then goes at a position drawn uniformly from every position where it lies inside the grid and leaves at least one empty tile between it and every plot already placed. If no position fits the drawn orientation, the other orientation is tried. If neither fits, setup throws an error naming `gridWidth × gridHeight`.
3. Households are shuffled onto the tiles that no plot covers, as in MVP8. A house may stand right next to a plot.

### Distance

`plotDistance(coordinate, plot)` is `max(0, plot.x − x, x − (plot.x + plot.width − 1)) + max(0, plot.y − y, y − (plot.y + plot.height − 1))`. It is 0 on the plot and 1 next to an edge, and for a 1×1 plot it equals the MVP8 Manhattan distance. `transportQuote(coordinate, plot, rate)` uses it: the round trip is twice the one-way distance, and the fee is the round trip times the rate.

### Defaults and validation

- `gridWidth = gridHeight = 40`, and `transportCostPerTileCents = 1`.
- Validation refuses a grid that cannot hold the plots with their gaps plus one tile per household. The capacity check counts each plot as `(width + 1) × (height + 1)` tiles. Placement can still fail on an awkward grid, and then throws the same kind of error.

### Invariants

- Household coordinates are unique, inside the grid, and not on any plot.
- Every plot lies inside the grid, has its owner's size in either orientation, and is at least one tile from every other plot.

## 3D world and UI

- **Grid and camera:** one tile is one world unit. The default camera radius, zoom-out limit, fog and far plane scale with the grid size. Locate stays further out for bigger plots (30 for a house, plus 6 for each tile of a plot's longer side beyond the first).
- **Plot buildings:**
  - Each firm and Government stands on a pavement slab covering its plot.
  - The building is scaled to the plot, inset from the slab's edge, and its height grows with the square root of the plot's area.
  - On a plot that is not square, the building keeps its seeded quarter-turn facing, and its stretch along x and z is swapped to fit the plot.
  - A selected plot building grows by about a quarter of a tile rather than a quarter of its size, and glows more softly than a house.
  - Houses are unchanged.
- **Scenery:** trees and bushes avoid every tile of every plot.
- **Picking and lines:** clicking anywhere on a plot selects its owner. Relationship lines end above the plot's centre.
- **Territory:** the overlay and the 2D market map compute each tile's cheapest firm with `plotDistance`, so each firm's area grows out from its plot's edges. A plot's own tiles are coloured by the same rule; there is no special case.
- **Institutions:** `institutionTiles` is removed, because Government and Transport have real plots. Transport's plot does not affect its fees.
- **2D market map:** draws the 40×40 grid with plots as rectangles.
- **Text:**
  - The inspector and the Markets panel describe trips as measured to the nearest edge of the firm's plot.
  - Settings default to 1¢ per tile.
  - The README and the docs describe the 40×40 town.

## Validation

- New tests cover:
  - `plotDistance`;
  - deterministic, non-overlapping, gapped, in-bounds placement with every plot at its owner's size and Government centred;
  - no household on a plot;
  - capacity validation;
  - RNG isolation of every non-spatial stream;
  - money conservation and the invariants.
- Tests that assert behaviour keep their assertions. Tests that pin exact values from the canonical layout are re-baselined; the changelog lists each one, with its old and new value and the reason. Tests on small hand-made grids get grids big enough for the plots. No test is deleted to make the suite pass.
- An 8-seed comparison of MVP8 and MVP9 covers prices, market shares, territory, needs met, inequality, wages paid and the tax rate. It is recorded in `docs/MVP9_SPEC.md` and the lab notes.
- Docs: `docs/MVP9_SPEC.md`, `docs/ARCHITECTURE.md` (placement order and draws), `docs/VALIDATION.md`, `CHANGELOG.md` (entry 026) and the README.
