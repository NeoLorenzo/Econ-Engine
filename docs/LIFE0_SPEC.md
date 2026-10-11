# [LIFE0-Forager-028]

Life 0 is step 0 of the bottom-up core described in the [merge document](MERGE.md). One forager lives on a small landscape of food patches that deplete and regrow. It has a body that burns energy, it sleeps at night, and it decides each hour what to do using only what it can see and remember. There are no other agents, no money, no prices and no exchange.

The core is new. It lives in `src/life/`, beside the MVP9 core in `src/sim/`, which does not change.

## Question

Does a forager with only local knowledge and simple rules keep itself alive wherever the land could feed it, and how much of the land's theoretical capacity does it lose to travel and out-of-date knowledge?

The answer could go either way. A forager that only knows what it last saw may walk to empty patches, leave patches that would soon have recovered, and starve on land that a perfectly informed forager could live on. How large that gap is, and whether it closes, is the step's finding.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Time | One tick is one hour. Tick 0 is midnight of day 0. | Bodily needs, sleep and daylight all act within a day. |
| Space | A grid of tiles. Movement follows Manhattan paths. | The same geometry as MVP9, so distance and the observer carry over. |
| Units | Energy and food in whole kilocalories. | Integers make conservation exact, as integer cents do in MVP9. |
| The body | One energy reserve. No fatigue. | With a fixed 12-hour night, a fatigue level would never bind. It is added when a question needs it (design rule 27). |
| Sleep | The forager sleeps through every night hour. | Night is when foraging is impossible; nothing else needs deciding. |
| Eating | Food is eaten as it is gathered. | Carrying, storing and spoiling are what make sharing possible, so they arrive with step 2. |
| Decisions | Fixed priority rules, after Life Engine's behaviour tree. | They are readable and every action has a recorded reason. Bounded learning comes when a decision has no obvious rule. |
| Knowledge | The forager knows where its patches are, sees only its own tile, and remembers what it last saw at each patch. | A forager knows its home range (design rule 1). It does not know regrowth rates or current stocks elsewhere. |
| Randomness | Only the layout is random. | Yields are constant in step 0. Variability is step 2's subject. |

## World

- The grid is `gridWidth × gridHeight` tiles.
- There are `patchCount` food patches, each on its own tile. A patch has a stock in kilocalories, a capacity, and a regrowth rate in kilocalories per hour. Every patch has the same capacity and rate.
- The hour of day is `tick mod 24` and the day is `floor(tick / 24)`. Hours from `dawnHour` up to, but not including, `duskHour` are daylight. The rest are night.

### Layout

The layout uses a layout seed derived from the run seed with `mixSeed` from `src/sim/rng.ts`. No other stream exists in step 0.

1. All tiles are shuffled with `seededShuffle`. The first `patchCount` tiles hold patches. Patch IDs follow the shuffle order, starting at 0.
2. The forager's starting tile is then drawn uniformly from every tile with `randomInt`, so it may start on a patch. On a one-tile world it always does.

## The forager

| State | Meaning |
| --- | --- |
| `position` | Current tile |
| `energyKcal` | Energy reserve, from 0 to `reserveMaxKcal` |
| `hungry` | Hunger mode, with hysteresis |
| `targetPatchId` | The patch it is walking to, if any |
| `memory` | For each patch: the stock it last saw there and the tick it saw it |
| `alive`, `deathTick` | Whether it is alive, and when it died |

At tick 0 the forager's memory holds every patch's true starting stock, observed at tick 0. Its hunger mode starts as `energyKcal < hungryBelowKcal`.

## Hourly step

Each tick runs these phases in order.

1. **Regrowth.** Every patch's stock becomes `min(capacity, stock + regrowth)`. The amount actually added is recorded as regrown.
2. **Observation.** If the forager is alive and stands on a patch, it records that patch's current stock and the tick in its memory. It observes nothing else.
3. **Decision.** The hunger mode is updated: it becomes true if `energyKcal < hungryBelowKcal`, false if `energyKcal ≥ satiatedAtKcal`, and otherwise stays as it was. The forager then takes the first action whose condition holds:

   | Priority | Condition | Action | Reason recorded |
   | --- | --- | --- | --- |
   | 1 | It is night | Sleep | `night` |
   | 2 | Not hungry | Rest | `satiated` |
   | 3 | Standing on a patch with stock of at least `forageKcalPerHour` | Forage | `foraging` |
   | 4 | Some other patch exists | Walk towards the target patch | `seeking food` |
   | 5 | Otherwise | Rest | `waiting for regrowth` |

   The forager starts an hour of foraging only where it can gather a full hour's worth. This keeps it from spending more energy than a nearly empty patch returns.

4. **Action.**
   - **Forage:** the forager gathers `min(forageKcalPerHour, stock, reserveMaxKcal − energyKcal)` from the patch and eats it at once.
   - **Walk:** if it has no target, or has reached its target, it chooses one (see [Choosing a patch](#choosing-a-patch)). It then moves up to `tilesPerHour` tiles towards the target, along x first and then y, and stops on arrival. A target is kept until it is reached, including through the night.
   - **Rest** and **sleep** change nothing but the energy cost.
5. **Metabolism.** The hour's cost depends on the action: sleeping costs `sleepKcalPerHour`, resting `restKcalPerHour`, foraging `forageCostKcalPerHour` and walking `travelKcalPerHour`. The forager pays `min(energyKcal, cost)`. If its reserve reaches 0, it dies of starvation.
6. **Record.** One event is written to the ledger (see [Ledger and metrics](#ledger-and-metrics)), and the invariants are checked.

A dead forager takes no part in phases 2 to 5. The patches keep regrowing.

### Choosing a patch

The candidates are every patch except the one on the forager's current tile.

1. If any candidate's remembered stock is at least `forageKcalPerHour`, the forager chooses the one with the highest remembered stock.
2. Otherwise it chooses the candidate it saw longest ago, because that patch has had the longest to recover. It does not know the regrowth rate, only that patches recover.

Ties go to the nearest patch by Manhattan distance, then to the lowest patch ID. With one patch and the forager standing on it, there is no candidate, so a hungry forager waits there (priority 5).

## Defaults

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `seed` | 20260813 | The MVP canonical seed |
| `gridWidth × gridHeight` | 12 × 12 | |
| `patchCount` | 4 | |
| `patchCapacityKcal` | 8,000 | |
| `patchRegrowthKcalPerHour` | 50 | 1,200 kcal a day per patch |
| `initialPatchStockKcal` | 8,000 | Patches start full |
| `dawnHour`, `duskHour` | 6, 18 | 12 hours of daylight |
| `tilesPerHour` | 3 | About 4.5 km/h if a tile is 1.5 km |
| `forageKcalPerHour` | 1,200 | Food gathered in a full hour |
| `sleepKcalPerHour` | 60 | |
| `restKcalPerHour` | 90 | |
| `forageCostKcalPerHour` | 300 | |
| `travelKcalPerHour` | 300 | |
| `reserveMaxKcal` | 20,000 | |
| `initialReserveKcal` | 16,000 | |
| `hungryBelowKcal` | 14,000 | |
| `satiatedAtKcal` | 18,000 | |

These give a daily need of about 2,200 kcal, close to a typical adult's. A real body stores far more than 20,000 kcal. The reserve is kept small so that starvation happens on a timescale the observer can show. It is a parameter, not a claim about bodies.

With these values the reserve cap never limits a harvest: hunger stops at 18,000 kcal, and one more hour's harvest reaches at most 19,200.

`createLife` refuses a configuration unless:

- every value is an integer;
- the grid is at least 1 × 1, and `1 ≤ patchCount ≤ gridWidth × gridHeight`;
- `forageKcalPerHour ≤ patchCapacityKcal`, so that a patch can ever be foraged;
- `0 ≤ initialPatchStockKcal ≤ patchCapacityKcal`;
- `0 ≤ dawnHour < duskHour ≤ 24`;
- `tilesPerHour ≥ 1`, rates and capacities are positive, and costs are non-negative;
- `0 < hungryBelowKcal < satiatedAtKcal ≤ reserveMaxKcal`, and `0 < initialReserveKcal ≤ reserveMaxKcal`.

## Invariants

Checked after every tick:

- **Energy is conserved exactly.** Total patch stock + the forager's reserve + all energy metabolized so far = total starting stock + the starting reserve + all energy regrown so far.
- Every patch's stock is between 0 and its capacity.
- The reserve is between 0 and `reserveMaxKcal`. A dead forager has a reserve of 0 and takes no action.
- The forager's position is inside the grid, and its target, if any, is a patch.
- A forage action happened only in daylight, on a patch whose observed stock was at least `forageKcalPerHour`.
- Every memory entry was observed at or before the current tick. While the forager is alive and stands on a patch, its memory of that patch matches the patch's stock as observed this tick.

## Theory

`src/life/theory.ts` computes what the forager's rules imply, so experiments can compare measured behaviour with it. The forager does not use it.

Let `N` be night hours, `L` daylight hours, `s`, `ρ`, `φ` the sleep, rest and forage costs per hour, and `g` the food gathered per foraging hour. On a single patch, the forager never walks, sleeps every night hour, and rests every daylight hour it does not forage.

- **Fixed daily cost:** `F = N·s + L·ρ`.
- **Foraging hours needed per day:** `f* = F / (g − φ + ρ)`. Each foraging hour replaces an hour of rest, so it adds `φ − ρ` to the day's cost.
- **Single-patch threshold:** the regrowth rate below which the forager must starve, `r* = g·F / (24·(g − φ + ρ))`. In steady state the forager eats everything that regrows, `24·r` per day.
- **Daily deficit below the threshold:** `F − 24·r·(g − φ + ρ) / g`. Starting from a reserve `E` and an empty patch, the forager dies between day `(E − g − N·r) / deficit` and day `E / deficit`. It dies before the upper bound because, at death, the patch may still hold food it never ate: up to one hour's harvest it was waiting for, plus one night's regrowth if it dies in its sleep.
- **Multi-patch lower bound:** no forager, however well informed, can survive when `patchCount · r < r*`. Walking only adds cost.

With the defaults: `F = 1,800` kcal, `f* ≈ 1.82` hours a day, a daily need of about 2,182 kcal, and `r* ≈ 90.9` kcal per hour. The four-patch lower bound is about 22.7 kcal per hour per patch, so the canonical 50 is about 2.2 times the bound.

## Experiments

All three experiments are deterministic and run headless in `src/life/experiments.ts`. Every run checks the invariants at every tick.

### 1. The single-patch threshold

A 1 × 1 world with one patch that starts empty, run for 400 days at every integer regrowth rate from 46 to 136 (0.5 to 1.5 times `r*`).

Expected:

- At `r ≤ 81` (0.9 `r*`) the forager dies within 400 days, inside the predicted window for its day of death.
- At `r ≥ 100` (1.1 `r*`) it is alive at day 400.
- The end-of-day reserve over days 21 to 400 declines, by more than 2 kcal a day, at every rate below `r*` and at no rate above it. A well-fed forager's reserve cycles between the hunger thresholds, so its measured slope wanders by about 1 kcal a day either side of zero; the 2 kcal tolerance covers that.

### 2. Leisure

The same world at regrowth rates of 100, 200, 400 and 800 kcal per hour, run for 400 days.

Expected: over days 21 to 400, the forager forages `f*` hours a day on average (within 2%), rests the other daylight hours, and sleeps 12 hours. Its working hours do not rise with abundance, because it stops when its needs are met.

### 3. The cost of local knowledge

The canonical four-patch world on eight seeds (20260813 and 1 to 7), at every integer regrowth rate per patch from 20 to 91, run for 400 days.

Expected:

- At `r ≤ 20`, which is below the lower bound, the forager dies on every seed. Physics guarantees this. A survivor would mean an accounting error.
- At the canonical `r = 50`, the forager survives on every seed. If it does not, the canonical rate is raised before step 0 is accepted, and the failure is recorded in the lab notes.

Reported, not tested:

- For each seed, the smallest rate at which the forager survives with a reserve that is not declining (by the same 2 kcal tolerance), and its ratio to the lower bound. The ratio measures the cost of travel and out-of-date knowledge.
- At the canonical rate: foraging, walking, resting and sleeping hours per day, and the share of walks that ended at a patch too empty to forage.

## Ledger and metrics

- **Events.** One event per tick: the tick, action, reason, position, target, food gathered, energy spent and reserve afterwards. A death adds an event with its cause. The live observer keeps the last 30 days of events.
- **Daily summaries,** kept for the whole run: hours spent on each action, food gathered, energy spent, the reserve at the end of the day, total patch stock, and whether the forager is alive.

## Observer

Life 0 has its own page, `life.html`, a second Vite entry, linked from the README and the MVP9 observer's top bar. It shares the visual language of the MVP9 world but no state with it.

- **World.** The grid as a grass board. Each patch is a bush whose size follows its stock. The forager is a simple figure that walks between tiles and lies down at night. The light follows the hour, from day to night.
- **Continuous display.** The simulation advances in whole hours; the display does not. It keeps the state before and after the current hour and draws the world part of the way between them, so time on screen flows continuously:
  - the forager walks its path tile by tile through the hour instead of jumping;
  - the sun moves and the light fades continuously through dusk and dawn;
  - a bush shrinks while the forager gathers from it, and grows as it regrows;
  - the forager lies down at dusk and gets up at dawn.

  The display only interpolates between two real states. It never invents a position or a value the simulation did not produce. At the slowest speed, one simulated hour takes about three seconds on screen; faster speeds advance more hours per second while staying smooth, and the fastest skips interpolation. Experiments never draw.
- **HUD.** The day and hour, the energy reserve as a bar with the hunger and satiation thresholds marked, the current action with its reason in plain words, and whether the forager is alive.
- **Inspector.** Clicking a patch shows its true stock and capacity next to what the forager remembers and when it last saw it. This makes the difference between true state and agent knowledge (design rule 1) visible.
- **Chart.** The end-of-day reserve and total patch stock over time.
- **Controls.** Play, pause and speed, and a reset with the seed, patch count and regrowth rate. Other parameters stay at their defaults in the observer.
- The page works at 375 px wide.

## Code layout

| File | Contents |
| --- | --- |
| `src/life/types.ts` | Configuration, state, events and summaries |
| `src/life/config.ts` | Defaults and validation |
| `src/life/world.ts` | Layout and regrowth |
| `src/life/forager.ts` | Observation, decision rules and patch choice |
| `src/life/engine.ts` | `createLife` and `stepLife` |
| `src/life/invariants.ts` | The invariants above |
| `src/life/theory.ts` | The analytical predictions |
| `src/life/experiments.ts` | The three experiments |
| `src/lifeView/` | The observer page |

`src/life` imports the random number functions from `src/sim/rng.ts` and nothing else from `src/sim`. Nothing under `src/sim` changes, so the MVP9 canonical trajectory stays bit-for-bit identical.

## Tests

- Configuration validation, one case per rule.
- Layout: deterministic for a seed, patches on distinct tiles, and the forager allowed to start on a patch.
- Regrowth stops at capacity and records only what was added.
- Each priority rule, the hunger hysteresis, and both patch-choice rules with their tie-breaks.
- Movement: x before y, at most `tilesPerHour` tiles, stopping on arrival, and resuming after night.
- Metabolism and death: a reserve that cannot cover the hour's cost goes to 0 and the forager dies.
- Determinism: two runs with the same configuration produce identical events and summaries.
- Conservation and the other invariants every tick, in every experiment run.
- The expectations of experiments 1 to 3.
- Observer: the page's view model (bush sizes, day and night light, the HUD text) and the inspector's comparison of true and remembered stock.

## Not in step 0

Other agents, carrying, storage, spoilage, variable yields, giving and exchange, fatigue, temperature and shelter, seasons, learning, births and ageing, money and prices. Each arrives with the step whose question needs it.

## Documentation on implementation

When step 0 is built: a changelog entry, a lab-notes entry with the findings of experiment 3, a section on the new core in the architecture notes and the validation guide, and a README section with a screenshot of the observer.
