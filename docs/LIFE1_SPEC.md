# [LIFE1-Band-029]

Life 1 is step 1 of the bottom-up core described in the [merge document](MERGE.md#the-ladder). The lone forager of [Life 0](LIFE0_SPEC.md) becomes a band. Many foragers share one landscape and its patches, and each sees the patches within a perception radius. There is still no carrying, giving, exchange or birth.

Everything in Life 0 that this document does not change still holds.

## Question

When several foragers share the land, does the band settle at the land's carrying capacity? How does competition for patches spread wellbeing among its members?

Alone, a forager lived on land supplying just 6–14% more than the theoretical minimum, because a remembered patch could only have grown since it was last seen. With others eating, a patch remembered as full may have been emptied, and every hungry forager pays to walk to it. The band might fill the land to its capacity, or competition might waste so much in searching that the land feeds far fewer foragers than it could. That is the step's finding.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Turn order | Each hour, the living foragers act one at a time in a seeded random order drawn afresh for that hour. | Whoever acts first can take a patch. A fresh shuffle each hour favours no forager in the long run, and it keeps Life 0's rule that a forager forages only a patch it has just seen holding a full hour's harvest. |
| Births | None. Bands start above or below capacity and can only shrink. | Births belong to step 5 with ageing, kin and inheritance. A minimal birth rule brought forward would need an arbitrary birth threshold, and that threshold would set the population it settles at. Without births, the question becomes whether a band thins to capacity or collapses below it. |
| Perception | A forager sees every patch within `perceptionRadiusTiles` tiles, by Manhattan distance, and updates its memory of each. A radius of 0 is Life 0's forager, which saw only its own tile. A radius covering the grid gives full information. | A radius is the simplest form of Life Engine's perception and gives the counterfactual of full information for free. |
| Other foragers | Not perceived or remembered. Several foragers may stand on one tile. | No decision in step 1 would use them (design rule 27). They become necessary in step 2, where a forager remembers who gave. |
| Decision rules | Life 0's rules, plus one: a walking forager that sees its target holding less than a full hour's harvest chooses again. | Walking on towards a patch it can see is empty would be inexplicable. At radius 0 the rule never fires, because the forager first sees its target on arrival. |
| A band of one | Reproduces Life 0 bit for bit. | It makes the generalization a verifiable refactor. |

## World

The world is Life 0's: a grid of tiles with `patchCount` food patches, and daylight from `dawnHour` to `duskHour`.

### Layout

1. Patches are placed as in Life 0, by shuffling every tile with the layout seed.
2. The foragers' starting tiles are then drawn one after another from the same stream, each uniformly from every tile with `randomInt`. Forager 0 is drawn first, so it starts where Life 0's forager did. Foragers may start on a patch or on the same tile.

### Turn order

The order of turns in hour `t` comes from its own stream. Its seed is derived from the run seed, a salt for the turn-order stream and `t` with `mixSeed`. The order is a `seededShuffle` of every forager's ID; dead foragers in it are skipped. Because the seed depends on the hour rather than on the previous hour's draws, any hour's order can be reproduced on its own. The layout stream is untouched, so adding the turn-order stream changes no layout.

## The band

The state holds a list of foragers. Each has Life 0's state (position, reserve, hunger mode, target, memory, alive, time of death) and an `id`, its index in the list. A dead forager stays in the list with a reserve of 0.

Every forager starts with `initialReserveKcal` and with memory of every patch's starting stock, observed at tick 0, as in Life 0.

## Hourly step

Each tick runs these phases in order.

1. **Regrowth,** as in Life 0.
2. **Turn order.** The hour's order is drawn (see [Turn order](#turn-order)).
3. **Turns.** Each living forager, in that order, takes Life 0's phases 2 to 5:
   1. **Observation.** It records the stock of every patch within `perceptionRadiusTiles` of its tile, with this tick.
   2. **Decision.** Life 0's hunger update and priority rules.
   3. **Action.** Life 0's actions. A walking forager keeps its target until it reaches it, unless it observed the target this turn holding less than `forageKcalPerHour`, in which case it chooses again by Life 0's [patch choice](LIFE0_SPEC.md#choosing-a-patch).
   4. **Metabolism.** It pays for its action and dies if its reserve reaches 0.

   A forager's turn sees everything the turns before it changed. A patch foraged earlier in the hour is observed with its stock reduced.
4. **Record.** One action event per forager that took a turn, in turn order, and a death event after the action event of each forager that died. The daily summary is updated and the invariants are checked.

## Defaults

The canonical world for step 1 is larger than Life 0's, so a band has room to spread out. Life 0's other defaults are unchanged.

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `gridWidth × gridHeight` | 24 × 24 | |
| `patchCount` | 36 | One tile in 16 is a patch |
| `bandSize` | 40 | About twice the carrying capacity |
| `perceptionRadiusTiles` | 2 | About 3 km if a tile is 1.5 km |

`LIFE0_WORLD` is the set of overrides that gives back Life 0: a 12 × 12 grid, 4 patches, a band of 1 and a radius of 0. Life 0's experiments run on it.

`createLife` also refuses a configuration unless `bandSize ≥ 1` and `perceptionRadiusTiles ≥ 0`, both integers. The observer limits the band to 100 foragers.

## Invariants

Life 0's invariants, generalized to the band, are checked after every tick:

- **Energy is conserved exactly.** Total patch stock + every forager's reserve + all energy metabolized = total starting stock + every starting reserve + all energy regrown.
- Every patch's stock is between 0 and its capacity.
- Every reserve is between 0 and `reserveMaxKcal`. A dead forager has a reserve of 0 and takes no turn after the one in which it died.
- Every forager is inside the grid, and every target is a patch.
- The hour has exactly one action event for each forager alive at the start of the hour, and no forager acts twice.
- A forage happened only in daylight, on a patch the forager observed in its own turn holding at least `forageKcalPerHour`.
- Every memory entry was observed at or before the current tick. Every forager that took a turn remembers every patch within its perception radius of where it started that turn as observed this hour.

## Theory

`theory.ts` keeps Life 0's predictions and adds two capacities. Let `n` be the number of patches, `r` the regrowth rate per patch, `D*` one forager's daily need, and `τ` the cost of an hour's walking. The other symbols are Life 0's.

- **Carrying capacity:** `K = 24·n·r / D*`. Ignoring travel, the land cannot feed more foragers than this for long, however they behave.
- **Search capacity:** `Kₛ = 24·n·r / (N·s + L·τ)`. This is how many foragers the land could feed if each of them walked through every daylight hour. A forager searching all day costs `N·s + L·τ`, so a band that searches more than this burns more than the land regrows.

With the defaults, `D* ≈ 2,182` kcal and a day of searching costs `720 + 3,600 = 4,320` kcal, about twice as much. On the canonical world, `K ≈ 19.8` and `Kₛ = 10.0`.

Expected behaviour, first seen in a prototype and confirmed by the experiments:

- **A band at or below `Kₛ` survives intact.** Its members rarely compete hard enough to search all day.
- **A band near `K` does not.** As patches empty, hungry foragers spend most of their daylight walking to patches that others have emptied. The walking burns more than the land regrows, and foragers starve while food is still on the land, spread too thinly for a full hour's harvest.
- **A band starting above capacity collapses below `Kₛ`.** Every death happens within the first few weeks, and the land is then underused for the rest of the run.

These are predictions, not theorems; the experiments test them.

## Experiments

All experiments are deterministic, run headless in `src/life/experiments.ts`, and check every invariant every hour. Seeds are Life 0's eight: 20260813 and 1 to 7. Runs last 400 days.

### 1. A band of one is Life 0

The step's code, with `LIFE0_WORLD`, reproduces Life 0 exactly.

- Checksums of forager 0's action and every patch stock in every hour, and of the daily summaries, over 400 days are compared with checksums recorded from Life 0's code before this step. There are seven configurations: five in which the forager survives and two in which it starves.
- Life 0's three experiments still pass, unchanged except that they run on `LIFE0_WORLD`.

### 2. Carrying capacity

The canonical world at the canonical radius, with the band size varied.

Expected:

- A band of 10 (`Kₛ`) is alive and intact at day 400 on every seed.
- A band of 20 (just above `K`) loses foragers on every seed.
- On every seed, the largest band that stays intact for 400 days, searched from 8 to 20, lies between `Kₛ` and `K`. Measured: 12–13.
- Starting from 40, every death happens before day 30, and the survivors at day 400 number no more than `Kₛ`. Measured: 4–8 survivors, 20–40% of `K`, with the last death between days 9 and 14. Every survivor's reserve is not declining by Life 0's 2-kcal-a-day test.

Reported, not tested: the survivors as a share of `K`, the day of the last death, and the survivors' hours a day on each action, to compare with Life 0's lone forager.

### 3. The cost of local knowledge with others

Experiment 2's bands of 10 and 40 at radius 0, 2 and full information (a radius of 48, which covers the grid).

Expected:

- At radius 0, a band of 10 has walks that end at a patch too empty to forage, unlike the lone forager, which never had one. Measured: 11–24% of walks.
- With full information, no walk ends at an empty patch, because a forager sees its target emptied and chooses again.
- With full information, a band of 40 still collapses to no more than `Kₛ` on every seed. Knowing every stock does not prevent the collapse.

Reported, not tested: the largest intact band and the survivors from 40 at each radius. More information lets a slightly larger band survive intact (11–13 at radius 0, 12–13 at radius 2, 13–14 with full information) but deepens the collapse from 40 (a mean of 5.3 survivors at radius 0 and 5.8 at radius 2, against 3.1 with full information). With full information every hungry forager heads for the same fullest patch.

### 4. The cost of searching

A band of 40 at the canonical radius, with walking costing 300 (the default), 200 and 90 kcal an hour. At 90, walking costs the same as resting.

Expected:

- On every seed, more foragers survive at 90 than at 300.
- At each cost, the survivors number no more than the smaller of `K` and that cost's `Kₛ` (10.0, 13.8 and 24.0).

This experiment tests the explanation, not just the outcome: if searching is what kills, cheaper searching should save foragers. Measured: 4–8 survivors at 300, 7–10 at 200 and 14–16 at 90.

### 5. Who survives

Reported, not tested. Starting from 40 on the canonical world, the mean distance from each forager's starting tile to its nearest patch, for survivors and for the dead. Measured: 2.6 tiles for the 46 survivors across the eight seeds and 2.5 for the 274 dead, so starting near food gives no advantage and surviving the collapse is luck. After the collapse, survivors forage 1.85–1.91 hours a day and walk 0.17–0.41, much like Life 0's lone forager.

## Ledger and metrics

- **Events.** Life 0's action and death events, each with the forager's ID. The live observer keeps the last 30 days.
- **Daily summaries,** kept for the whole run: the number alive at the end of the day and the deaths that day; hours on each action, summed over the band; food gathered and energy spent by the band; total patch stock; and every forager's reserve at the end of the day.

## Observer

The page stays `life.html` and is retitled "Life 1 · a band".

- **World.** Every forager is drawn as Life 0's figure. Foragers on the same tile stand evenly around it, and the view moves each one between its places in two real states. A dead forager lies where it died, greyed out. A band of up to 100 is drawn without instancing.
- **Following a forager.** One forager is followed at a time, at first forager 1. Clicking a forager follows it, and previous and next buttons step through the living band (through everyone once all are dead). The followed forager is drawn in the accent colour, with its target ring and the outline of the tiles within its perception radius. With full information the outline is hidden, since it would only frame the whole board.
- **HUD.** The day and hour, the number alive out of the band, and the followed forager's Life 0 HUD: its reserve with the hunger thresholds, and its action and reason in plain words.
- **Inspector.** Clicking a patch shows its true stock beside what the followed forager remembers and when it last saw it.
- **Charts.** The number alive each day; and the followed forager's end-of-day reserve beside the average food per patch, which share a scale.
- **Controls.** Life 0's controls, with the setup adding the band size and the perception radius.
- The page works at 375 px wide.

## Code layout

The files stay as in Life 0; their contents generalize.

| File | Change |
| --- | --- |
| `types.ts` | `bandSize` and `perceptionRadiusTiles` in the configuration; `foragers` replaces `forager`; forager IDs on foragers and events; the band-level daily summary |
| `config.ts` | The new defaults, `LIFE0_WORLD` and the new validation rules |
| `world.ts` | Starting tiles for the band and the turn-order stream |
| `forager.ts` | Observation within the radius and the choice of a new target when the old one is seen empty |
| `engine.ts` | Turns in order within each hour |
| `invariants.ts` | The band's invariants |
| `theory.ts` | `K` and `Kₛ` |
| `experiments.ts` | Life 0's experiments on `LIFE0_WORLD`, and experiments 1 to 5 |
| `capacity.test.ts`, `search.test.ts` | Experiments 2 to 4 as tests, in their own files so they run in parallel |
| `src/lifeView/` | Following a forager, the band's HUD and chart, and the new setup fields |

`src/sim` is still untouched.

## Tests

- Configuration validation for the new rules.
- Layout: forager 0 starts where Life 0's forager did; starting tiles are deterministic; foragers may share a tile.
- Turn order: deterministic for a seed and hour, different across hours, and every forager eventually acts first.
- Perception: a patch exactly at the radius is seen, one beyond it is not, and radius 0 sees only the forager's own tile.
- Competition: when two foragers stand on a patch holding one hour's harvest, the first in turn order forages and the second sees the patch emptied and does not.
- Choosing again: a walking forager that sees its target emptied picks a new target; at radius 0 it walks on.
- Death within a band: a dead forager takes no further turn and the others continue.
- Determinism: two runs with the same configuration produce identical events and summaries.
- The expectations of experiments 1 to 4, and Life 0's experiments on `LIFE0_WORLD`.
- Observer: the followed forager's pose and HUD, stepping through the band, standing apart on a shared tile, and the inspector comparing a patch with the followed forager's memory.

## Not in step 1

Births, perceiving or remembering other foragers, telling others about patches, carrying, storage, spoilage, variable yields, giving and exchange, learning a better search rule, and territory. Each arrives with the step whose question needs it.

## Documentation on implementation

A changelog entry; a lab-notes entry with the findings of experiments 2 to 5; Life 1 sections in the architecture notes and the validation guide; the README's section updated with a new screenshot; and the merge document's step 1 open questions marked as settled.
