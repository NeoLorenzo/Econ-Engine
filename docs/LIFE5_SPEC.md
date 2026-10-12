# [LIFE5-RealScale-035]

Life 5 is a new step on the ladder of the [merge document](MERGE.md#the-ladder), inserted before tools and shelter. It adds no new good, need or rule of exchange. What changes is the scale of everything. Life 0 to Life 4 work in hours on tiles 1.5 km wide, where a patch is a pool of food and a grove a pool of wood. In Life 5 the band lives in a small valley 600 m across, in minutes and centimetres. Food is berries on individual bushes and wood is deadwood on individual trees. A forager walks from bush to bush, picks each one, and breaks dead branches off a tree, at the speed and size of a real person. The observer works like a real-time strategy game that the viewer watches but does not control: it can be paused, sped up, and zoomed from the whole valley down to one person picking one bush.

Everything in Life 4's canonical world that this document does not change still holds: the band of 8 born alike, the camp, cold nights, hearths, carried food that spoils, swapping wood for food with terms told and remembered, and skill that grows with practice.

## Question

Do Life 3's and Life 4's findings survive real scale? Does exchange start, and does practice still divide a band born equal, when work is done minute by minute on single plants at real distances?

It could go either way. In the hourly core, work comes in lumps: an hour of gathering brings in 18 to 36 units of wood at once, and an hour of walking crosses three tiles. Nobody designed those lumps as a mechanism, but they may be doing work. At real scale a forager can stop the moment it has enough, walking between bushes costs seconds rather than hours, and the luck of who reaches a patch first has less room to act. If the lumps were what started exchange, real scale will show it.

## What the prototype found first

A throwaway prototype of this step, run on 32 seeds before this document was written, showed three things that shaped the design:

- **At real scale, exchange never starts on its own.** A forager short of wood gathers until it holds its two nights' wood and stops within the minute it gets there. Nobody ever holds wood beyond its target, so nobody has anything to offer, no terms are ever told, and no swap ever happens. This held for the band born equal and for Life 3's band born with very different skills: in 64 runs over 400 days, not a single swap. In the hourly core, swapping started because an hour of gathering overshot the target, which left foragers with spare wood that nobody planned.
- **Loads restore it, and the size of a load decides.** People who walk out for firewood do not come home with one stick. They bring a full load, because the walk is the cost (central-place foraging; Orians and Pearson, 1979). With a forager that brings home at least a full load once it sets out, exchange returns, but only once a load is larger than the wood a forager keeps. In a band born equal, loads of up to 24 kg never produced a swap; 26 kg did in about half the runs; 30 kg and more did in every run.
- **The valley carries more people.** Walking falls from about 3.3 hours a day in Life 4 to about 0.1, so each forager needs less food. The valley, which grows exactly what Life 4's land grows, keeps a band of 12 alive in every run, where Life 4's land loses most of a band of 12.

The step therefore adds loads, as part of what real scale means rather than as a new good or rule, and makes their size an experiment.

The implementation confirmed the first and third findings and qualified the second. Its numbers, under [Predictions](#predictions), differ from the prototype's: the division forms later and is weaker, and loads larger than 30 kg do not always start exchange, because foragers born alike fall into the same routine.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Time | One tick is one minute. Tick 0 is midnight of day 0. A day has 1,440 ticks. | A person walks about 75 m in a minute, so motion drawn between minute states looks continuous. Bodily needs, practice and the day keep their meaning. One-second ticks would be 60 times slower and change no answer. |
| Seconds within a minute | A minute may hold a short walk and then work: if the next bush or tree is reached within the minute, the forager works the rest of it there. | Bushes in a thicket are 2 to 3 m apart, a two-second walk. Spending a whole minute on it would be an artifact of the tick, not of the world. |
| Space | A flat square valley `valleySizeCm` wide. Positions are whole centimetres. Foragers walk in straight lines. Distance is Euclidean, rounded down to a whole centimetre. | Real distances without a grid. Integer square roots of integers are exact in IEEE arithmetic, so runs are identical on every machine. No trigonometry is used anywhere in the simulation, for the same reason. |
| The valley | 600 m square, with the camp in the middle. | The owner chose a small, dense valley that a viewer can take in and watch people work in. |
| Food | 32 thickets of 60 bushes. Each bush holds berries, in whole kilocalories, up to 400 kcal, and regrows 20 kcal a day. | A bush is a real object about 1.5 m across. The totals equal Life 4's land exactly: 32 patches of 24,000 kcal regrowing 1,200 kcal a day each. |
| Wood | 8 stands of 8 trees. A tree carries deadwood, in whole kilograms, up to 25 kg, and gains 6 kg a day as branches die and fall. Foragers gather deadwood from the tree and around its foot. The tree itself stays standing. | Foragers burn deadwood. Green wood burns badly, and felling a live tree is slow without an axe. Felling arrives with tools, the next step. The totals equal Life 4's 8 groves of 200 units regrowing 48 a day. A unit of wood is now 1 kg, and a night's fire burns 1 kg an hour. |
| How dense the valley is | Experimental, and far richer than real land | The valley grows what Life 4's 324 km² grew, on 0.36 km². Keeping the totals equal makes Life 4 and Life 5 comparable. Real productivity is a calibration for later (design rule 15). |
| Regrowth | Once an hour. A plant gains its daily regrowth in exact whole-unit shares, `floor(R·(h+1)/24) − floor(R·h/24)` in hour `h`, up to capacity. | Integer and exact: a day's shares add up to `R`. Regrowing 1,984 plants every minute would cost much and change nothing. |
| Hourly rates at minute scale | Rates and costs stay per hour. A forager keeps a remainder, in 3,600ths of a unit, for each rate it works at and for its energy cost, and takes or pays only whole units. | Picking 1,200 kcal an hour is 1/3 kcal a second, and resting costs 1.5 kcal a minute. Remainders make every hour's total exact without fractional food or energy. |
| Reach | A forager works a plant only within `reachCm`, 1 m. | Picking and gathering need hands on the plant. |
| Perception | Every bush and tree within `perceptionRadiusCm`, 25 m. | Life Engine used 15 m with a field of view. A thicket fits inside 25 m, so a forager in a thicket sees all of it, and none outside it. Field of view and occlusion wait for a question that needs them. |
| Exchange range | Foragers swap and tell terms within `talkRadiusCm`, 20 m. | Life's "on the same tile" becomes "within talking distance". The whole camp is within it, and so is one thicket. |
| Hearths | Each forager's hearth is a fixed point at camp, on a square spiral 3 m apart around the central fire. A forager sleeps at its hearth. | Every forager is home at its own hearth, as in Life 3. A spiral needs no trigonometry. |
| Choosing a plant | The nearest plant remembered as holding at least a minute's work, among those it can reach in time. Failing that, the one seen longest ago. | At real scale people pick the nearest bush worth picking. Life's rule of "the fullest patch first" would walk a forager past a bush with food to reach a fuller one across the valley. Life's rule for when nothing is remembered is unchanged. |
| Loads | A forager that has gathered wood since it left its hearth keeps gathering until it has gathered at least `woodLoad` kilograms on that trip, unless hunger calls it to food. `woodLoad` is 30 kg. | People carry firewood home in loads, commonly 20 to 40 kg on the head or back, because the walk is the cost. The prototype showed this is what makes surplus, and so exchange, possible at real scale. Its size is experimental and is varied in experiment 3. |
| Gifts and windfalls | Left out | Life 4's canonical band is all keepers with steady harvests. Life 2's sharers, reciprocators and windfalls (an abstraction of hunting luck) would need their own real-scale design. They come back when a question needs them. |
| The hourly core | Frozen as a reference, as MVP9 was. The valley is a new core in `src/valley/`. | Life 0 to Life 4 cannot be reproduced at real scale bit for bit. Their findings are compared, not replayed. Keeping the hourly core runnable keeps the comparison possible. |
| Everything else | Life 4's rules for hunger, wood need, choosing work, trips for trade, swaps, terms and practice, with hours read as minutes or seconds as stated below | The step changes one thing, scale (design rule 12). |

## World

### Layout

Everything is drawn from the layout stream, seeded from the run seed and the layout salt with `mixSeed`, as in Life 0. Every draw is `randomInt` over whole centimetres.

1. **Sites.** Site centres are drawn uniformly over the valley, at least `siteMarginCm` from its edges. A draw is rejected if it lies within `campClearingCm` of the camp or within `siteSpacingCm` of an earlier centre. The first `thicketCount` centres are thickets and the next `standCount` are stands, with IDs from 0 in draw order.
2. **Bushes.** For each thicket in turn, bushes are drawn uniformly in the square around its centre and kept if they lie within `thicketRadiusCm` of it and at least `bushSpacingCm` from the thicket's earlier bushes, until it has `bushesPerThicket`. Bush IDs run from 0 across thickets in order.
3. **Trees.** The same for each stand, with `standRadiusCm`, `treeSpacingCm` and `treesPerStand`.
4. **Hearths.** The camp is the valley's centre, where the fire burns. Forager `i`'s hearth is the `i`-th point of a square spiral around it, `hearthSpacingCm` apart: the 8 points of the first ring, then the 16 of the second, and so on, each ring walked from its top-left corner clockwise.

`createValley` refuses a configuration whose layout cannot be drawn: if a site or plant has not found a place after 10,000 draws.

### Skills

As in Life 4: born skills from the skill stream, rates from born skill times practice.

## The forager

A forager keeps Life 4's state, with these changes:

| State | Meaning |
| --- | --- |
| `x`, `y` | Its position, in whole centimetres |
| `hearth` | Its hearth's position |
| `targetBushId`, `targetTreeId` | The plant it is walking to or working, if any |
| `bushMemory`, `treeMemory` | For each plant, what it last saw there and the minute it saw it |
| `pickRemainder`, `gatherRemainder`, `costRemainder` | Remainders in 3,600ths of a unit |
| `tripWood` | Wood it has gathered since it last stood at its hearth |
| `fireHour`, `warm` | The hour of its current fire decision, and whether that hour is warm |
| `practiceLog`, `secondsToday` | Seconds at each task on each of its last `practiceDays` days, and today |

A forager starts at its hearth. It remembers every plant's starting stock, seen at minute 0, as it remembered every patch in Life 1.

## The minute

Each tick runs these phases in order.

0. **Practice.** In the first minute of every day after the first, as in Life 4, with seconds in place of hours.
1. **Regrowth.** In the first minute of every hour after minute 0, every bush and tree gains its share of the day's regrowth, up to capacity.
2. **Turn order.** A seeded shuffle of the band, from a stream derived from the run seed and the minute.
3. **Turns.** Each living forager in that order:
   1. **Spoilage.** Lots harvested `shelfLifeHours · 60` minutes ago or earlier spoil.
   2. **Eating.** It eats from what it carries, oldest first, up to the room in its reserve.
   3. **Observation.** It records the stock of every bush and tree within `perceptionRadiusCm` of where it stands, and the minute.
   4. **Decision.** Hunger and wood need are updated as in Life 3. Then the first rule that applies (see [Rules](#rules)).
   5. **Action.** The minute's 60 seconds (see [The 60 seconds](#the-60-seconds)).
   6. **Exchange.** Life 3's swaps and quotes, with every forager within `talkRadiusCm` in place of every forager on the tile.
   7. **Eating again.** As in Life 3.
   8. **Metabolism.** It adds each second's hourly cost to its cost remainder and pays the whole kilocalories it holds, as far as its reserve allows. At 0 it dies of starvation.
4. **Record.** Events, the day's summary, and the invariants.

### Rules

Let `D` be the daylight seconds left: `3,600 · duskHour − 60 · m` in minute `m` of a daylight day, and 0 at night. Walking a distance `d` takes `ceil(d / walkCmPerSecond)` seconds. A plant can be reached in time if walking to it, a minute's work and walking from it to the hearth take at most `D` seconds.

| Priority | Condition | Action | Reason recorded |
| --- | --- | --- | --- |
| 1 | Away from its hearth, and it is night or walking home takes at least `D` | Walk home | `going home` |
| 2 | It is night | Sleep | `night` |
| 3 | Not hungry, and filling a load: `0 < tripWood < woodLoad` | Work for wood | `filling a load` |
| 4 | Neither hungry nor short of wood | Rest | `satiated` |
| 5 | Life 3's choice of work says wait | Rest | `waiting to swap` |
| 6 | No plant of the good it works for that it can reach in time | Rest | `too late to set out` or `waiting for regrowth` |
| 7 | Otherwise | Work at its target plant, walking to it first if needed | `foraging`, `gathering`, `seeking food` or `seeking wood` |

Rule 3 is the only new rule. `tripWood` returns to 0 whenever the forager stands at its hearth. A trip for trade (Life 3) still ends when it has gathered the spare wood it set out for.

**The target.** A forager keeps its target plant for the good it works for unless it has just seen the plant holding less than a minute's work, or can no longer reach it in time. Otherwise it chooses again among the plants it can reach in time:

1. If any is remembered as holding at least a minute's work, it chooses the nearest. Ties go to the lowest ID.
2. Otherwise it chooses the one it saw longest ago, leaving out those it has seen this minute. Ties go to the nearest, then the lowest ID.

A minute's work is `ceil(rate / 60)` units at the forager's rate for that good, `gᵢ` or `wᵢ` per hour.

### The 60 seconds

- **Walking home** or **walking to a plant out of reach:** the forager moves up to `60 · walkCmPerSecond` centimetres along the straight line towards its hearth or plant, stopping at its hearth or `reachCm` from the plant. A step of `s` centimetres from `p` towards `q` at distance `d` moves to `p + trunc((q − p) · s / d)`.
- **Arriving within the minute:** if the walk takes `k < 60` seconds, the forager arrives after `k` seconds. If the plant then holds a minute's work, it works the remaining `60 − k` seconds. Otherwise it stands for them, at the cost of rest.
- **Working `k` seconds** at hourly rate `r`: its remainder for that task grows by `r · k`. It takes the whole units it now holds, `floor(remainder / 3,600)`, from the plant, and the remainder keeps the rest. Because it works only a plant holding a minute's work, the plant always holds what it takes. Picked food is eaten until the reserve is full, and the rest is carried as a lot harvested this minute. Gathered wood adds to its wood and to `tripWood`. Each second counts towards the day's practice at that task.
- **Sleeping:** in the first minute of each hour it sleeps, it decides that hour's fire. If wood matters and it holds `fireWoodPerHour`, it burns it and sleeps warm for the hour. Otherwise it sleeps cold.
- **Resting:** it stays where it is.

Walking, picking and gathering cost `travelKcalPerHour` and `forageCostKcalPerHour` for each second spent at them. Resting and standing cost `restKcalPerHour`, and sleeping costs `sleepKcalPerHour`, or `coldSleepKcalPerHour` in a cold hour.

### Practice

As in Life 4, counting seconds. A forager's practice at a task is the seconds `s` in its log, and its percentage is

`P(s) = practiceMinPercent + floor((practiceMaxPercent − practiceMinPercent) · s / (s + 3,600 · practiceHalfHours))`,

which equals Life 4's at whole hours. Only working seconds count, not walking between plants. Every day of the starting log holds `3,600 · startPracticeHoursPerDay` seconds at each task.

## Defaults

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `valleySizeCm` | 60,000 | 600 m square |
| `thicketCount`, `bushesPerThicket` | 32, 60 | 1,920 bushes |
| `thicketRadiusCm`, `bushSpacingCm` | 1,200, 200 | Bushes about 2.5 m apart within a thicket 24 m across |
| `bushCapacityKcal`, `initialBushKcal` | 400, 400 | About 800 g of ripe berries |
| `bushRegrowthKcalPerDay` | 20 | |
| `standCount`, `treesPerStand` | 8, 8 | 64 trees |
| `standRadiusCm`, `treeSpacingCm` | 1,500, 400 | |
| `treeCapacityWood`, `initialTreeWood` | 25, 25 | Kilograms of deadwood |
| `treeRegrowthWoodPerDay` | 6 | |
| `siteSpacingCm`, `siteMarginCm`, `campClearingCm` | 5,000, 3,000, 4,000 | |
| `hearthSpacingCm` | 300 | |
| `walkCmPerSecond` | 125 | 4.5 km/h, Life's three 1.5 km tiles an hour |
| `reachCm` | 100 | |
| `perceptionRadiusCm` | 2,500 | |
| `talkRadiusCm` | 2,000 | |
| `woodLoad` | 30 | Kilograms |

Life 4's other defaults are unchanged: daylight from 6 to 18, 1,200 kcal and 24 kg an hour at 100%, the costs, reserve and thresholds, the band of 8 born alike, a shelf life of 48 hours, 1 kg of wood for an hour's fire, cold sleep at 150 kcal an hour, a target of two nights' wood, swapping and quotes on, terms remembered for 24 hours, and practice from 50% to 150% over 30 days, half way at 60 hours.

Life 4's grid, patch, grove, tile, camp-switch, windfall and strategy parameters do not exist in the valley.

`createValley` refuses a configuration unless:

- every value is an integer, and the switches are booleans;
- every count, size, radius, spacing, capacity and speed is positive, `reachCm < perceptionRadiusCm`, and initial stocks lie between 0 and capacity;
- the layout can be drawn (see [Layout](#layout));
- the band's hearths fit inside the camp clearing: the spiral's outermost hearth lies within `campClearingCm − max(thicketRadiusCm, standRadiusCm)` of the camp;
- `woodLoad ≥ 0`;
- Life 4's rules on hours, costs, thresholds, skills, practice and wood hold, read for plants in place of patches and groves: a bush must hold a minute's picking at the fastest rate, and a tree a minute's gathering.

## Invariants

Checked after every minute by a checker that keeps its own copy of every plant's stock and replays each minute's regrowth and recorded work onto it. The plants worked are compared with it every minute and every plant every hour. A forager's memory of the plant it worked or walked towards is checked every minute, and of every plant in its view in the first minute of every hour. Logs and rates are checked in full at midnight and for change in every other minute.

- **Energy is conserved exactly.** Bush stock + reserves + carried food + energy metabolized + food spoiled = starting stock + starting reserves + food regrown. **Wood is conserved exactly.** Tree stock + wood held + wood burned = starting wood + wood regrown. Stock totals are kept as running sums, which every minute's events must account for, and are recounted from every plant every hour.
- Every plant's stock lies between 0 and its capacity. A plant's stock changed this minute only by regrowth (in the first minute of an hour) and by the work recorded against it.
- Every remainder lies between 0 and 3,599.
- Every forager is inside the valley. It moved at most `walkCmPerSecond` times its walking seconds, towards its hearth or target. Its walking, working, standing and sleeping seconds add up to 60.
- It worked only in daylight, only within `reachCm` of the plant, and only at a plant that held a minute's work when it started.
- Every memory entry was seen at or before this minute, and the plants within its perception radius at the start of its turn are remembered with the stock they held then.
- At every night minute, every living forager is at its hearth or walking home, and only a forager at its hearth sleeps. Wood burns only in the first minute of an hour of sleep.
- `tripWood` is 0 at the hearth, and work for wood under rule 3 happens only while `0 < tripWood < woodLoad`.
- Life 4's invariants on turns, swaps, quotes, terms, carried lots, spoilage, practice and rates, read in minutes and seconds.

## Theory

`src/valley/theory.ts` keeps Life 0's to Life 4's predictions where they still apply, with walking costs at real scale, and adds:

- **Time use.** With `W` hours of walking, `G` of gathering wood and foraging rate `g`, a forager forages `f = (F + (G + W)(φ − ρ)) / (g − φ + ρ)` hours a day, where `F = N·s + L·ρ` as in Life 0. On the canonical settings, `G` is two-thirds of an hour (12 kg a night at 18 kg an hour once practised) and `W` is about 0.1, so `f` is about 2.0 and the day's work about 2.7 hours, against 3.2 in Life 4.
- **Capacity.** The valley grows `thicketCount · bushesPerThicket · bushRegrowthKcalPerDay` = 38,400 kcal a day, and a forager needs about 2,380 kcal a day, so `K` is about 16. As in Life 1, a band near `K` is expected to collapse, because it cannot harvest everything that regrows.
- **No surplus, no exchange.** A forager starts gathering for itself only when it holds less than one night's wood, `nightWood`, and stops once it holds its target and has gathered a full load on the trip. With wood rates of at most 60 an hour it gathers at most 1 kg a minute, so it overshoots by nothing. Its spare wood after a trip is therefore at most `max(0, nightWood − 1 + woodLoad − woodTarget)`. If `woodLoad ≤ woodTarget − nightWood + 1` (13 on the canonical settings), no forager ever holds spare wood. Nobody can offer wood or tell terms, so no swap or quote ever happens, whatever the skills.
- **Spare per trip.** A forager that sets out holding `W₀` kg, less than a night's wood, comes home with `max(0, W₀ + woodLoad − woodTarget)` spare: from 6 to 17 kg on the canonical settings. With loads of at most `woodTarget`, a forager that burns a night's wood every night always sets out with nothing, and so never has spare wood: its wood runs 24, 12, 0 and round again. Spare wood is what makes quotes, and so exchange, possible.
- **Life 3's theorems still hold.** With `quotes` off and steady harvests, no swap ever happens, and the run is identical to one without swapping. Foragers with equal own terms cannot swap.
- **Practice alone keeps a band born equal equal.** Without exchange, every forager faces the same valley and rules. At minute scale, little is left of the luck that separated foragers in the hourly core.
- **Routines in step trade nothing.** A swap needs one forager with spare wood and another short of it at the same time and place. A forager's wood follows a routine set by its load: with 36 kg it runs 36, 24, 12, 0 and round again, so it has spare wood only on the evening it comes home. In a band born equal, everyone keeps the same routine at the same time, so whenever one has spare wood the others have just fetched theirs. Loads whose routine drifts, such as 30 kg (30, 18, 6, then a trip to 36, 24, 12, 0), let spares and needs meet.

### Predictions

From the experiments, on 32 seeds over 400 days, measured over days 21 to 400. Life 4's numbers come from the hourly core on the same seeds. They are findings for this world, not theorems.

- **Real scale costs less time.** Without swaps, every forager works 2.67 hours a day (2.00 picking, 0.67 gathering) and walks 0.10, against 3.24 and 3.56 in Life 4. The time-use prediction gives 2.65. Nobody sleeps cold, against 3% of night hours in Life 4. About two-thirds of the berries the valley can hold are on the bushes at day 400.
- **Practice alone does not divide.** Without swaps, the band stays equal: in every run, wood shares differ by less than 0.002, and own terms by at most 6% at day 100.
- **No surplus, no exchange.** Without loads, no forager ever holds spare wood, and nothing is swapped or quoted, in a band born equal or in Life 3's band born unequal, whose own terms spread 3.7 times.
- **Loads decide, but not as a threshold.** In a band born equal, loads of up to 24 kg never start exchange. Loads of 26 kg start it in 9 runs out of 32, 28 kg in 29, 30 kg in all 32, 36 kg in only 8, and 40 kg in all 32. The first swap comes around day 140 to 210. In Life 3's band, loads of 20 and 24 kg start exchange in 15 runs, and loads of 26 kg and more in every run, within the first three days, after which the top two gatherers bring in about half the wood (51% at 30 kg, against 25% without swaps) and a third of the wood burned is bought.
- **With 30 kg loads, practice and exchange divide a band born equal, much more slowly and less sharply than in Life 4.** The first swap comes on day 140 on average (at the latest day 253), against day 15.5 in Life 4. The two keenest gatherers bring in 36% of the band's wood (32% to 41%), against 53% in Life 4 and 25% without swaps. Own terms spread only 1.06 times by day 100 and 1.61 times by day 400, against 1.86 at day 100 in Life 4. 18% of the wood burned is bought, against 39%. Roles are spells: 3.0 different foragers lead wood gathering over nine 40-day windows, and persistence is 0.43, against 2.2 and 0.67.
- **Exchange still costs warmth.** With swaps, foragers sleep cold 7% of night hours, against none without swaps, as in Life 4 (15% against 3%).
- **The valley carries more.** Bands of 8 and 12 are intact at day 400 in every run. A band of 16 falls to 5.4 survivors on average, 24 to 4.9 and 32 to 2.8. On Life 4's land a band of 12 falls to 4.6 and a band of 16 to 4.5. The capacity `K` is about 16.

## Experiments

All experiments are deterministic, run headless in `src/valley/experiments.ts`, and check every invariant every minute. Runs last 400 days, or end early once every forager is dead. Seeds are `20260813` followed by `1, 2, 3, …`. Measures over a run use days 21 to 400, as in Life 3 and Life 4. The tests run each experiment on 8 seeds, and every tested expectation must hold on both 8 and 32. The reported numbers use 32. Life 4's numbers come from running the hourly core in `src/life/` on the same seeds.

The tests run over shorter horizons wherever the expectation holds at any horizon: 100 days for experiment 1, experiment 2, experiment 3 at 24 kg and experiment 4's counterfactuals, and 30 days for experiment 3 in Life 3's band, whose swaps start within days. Each configuration is run once: the band without swaps of experiment 4 is experiment 1's, and the canonical band of experiment 5 is experiment 4's.

### 1. Time at real scale

The canonical valley without swaps, beside Life 4's canonical world without swaps.

Expected:

- The band is intact at day 400 on every seed.
- Hours of work per forager-day are within 5% of the time-use prediction, with the measured walking hours put into it.
- Walking is under half an hour per forager-day.

Reported: work, walking, rest and sleep in both cores; settled rates; cold nights; and the bushes' total stock over time.

### 2. No surplus, no exchange

The band born equal, with practice, and Life 3's band born from 50% to 150% without practice, both with `woodLoad` of 0 and swapping on.

Expected: no forager ever holds spare wood, and no swap or quote happens on any seed.

### 3. Loads

The two bands of experiment 2, with swapping on, at `woodLoad` of 0, 20, 24, 26, 28, 30, 36 and 40.

Expected:

- For the band born equal, no swap happens on any seed at 24 or below, and every run swaps at 30 and at 40.
- For Life 3's band, every run swaps at 26 and at 30, within its first ten days.

The tests run only these loads; the sweep is reported. The draft expected every run to swap from 30 kg up; at 36 kg most runs do not (see [Theory](#theory)).

Reported: the share of runs that swap, the first swap, the top two's share of the wood, the share of wood bought and cold nights, at each load.

### 4. Practice and exchange at real scale

Life 4's experiments 2 and 3 in the valley: the band born equal with `woodLoad` of 30, with swapping on and off, with swapping on but `quotes` off, and with practice off and swapping on.

Expected:

- Without swaps, in every run the highest wood share in the band is within 0.05 of the lowest, and own terms spread less than 1.25 times at day 100.
- With `quotes` off, no swap happens, and every run is identical to the run without swapping.
- With practice off, no swap happens.
- With practice and swaps, every run swaps within the 400 days, and the top two gatherers bring in more than 30% of the band's wood, against at most 26% without swaps. The lowest across 32 seeds was 32%. The draft expected the first swap by day 150 and more than 35%, from the prototype; the implementation's first swaps come as late as day 253.

Reported, beside Life 4's: the first swap, the spread of own terms at days 20, 100 and 400, concentration, the share bought, cold nights, hours of work and walking, lead gatherers and persistence.

### 5. How many the valley feeds

The canonical valley with bands of 8, 12, 16, 24 and 32, beside Life 4's canonical world with bands of 8, 12 and 16.

Expected:

- In the valley, bands of 8 and 12 are intact at day 400 on every seed.
- A band of 16 has fewer than 8 survivors on average.
- On Life 4's land, a band of 12 is not intact on average.

The tests run bands of 8, 12 and 16, and Life 4's band of 12.

Reported: survivors over time in both cores (design rule 28), and the capacity `K` beside them.

## Ledger and metrics

- **Events.** One action event per living forager per minute: the minute, action and reason, its position before and after, its target, the plant it worked, its walking, working, standing and sleeping seconds, the food or wood it took, what it ate, spent and spoiled, its reserve, carried food and wood afterwards, `tripWood`, and whether it slept warm. Swaps, quotes, practice and deaths as in Life 4. The observer keeps the last 3 days of events, about 35,000 actions for a band of 8, with the quotes of those days. Experiments read daily summaries and run without keeping events.
- **Daily summaries,** kept for the whole run, as in Life 4, with time in seconds, plus each forager's walking seconds and the plants' total stocks at the end of the day.
- **Totals** as in Life 4, for bushes and trees.

## Observer

`life.html` becomes "Life 5 · real scale" and shows the valley. Life 4's hourly observer moves, unchanged, to `life4.html`, linked from the new page.

- **Real sizes.** Everything is drawn at true size in metres: foragers about 1.7 m tall, bushes about 1.2 m high and 1.5 m across, trees 9 to 12 m tall, hearths about 1 m across, and the valley 600 m square. Heights and shapes that the simulation does not set, such as a tree's height, follow from the plant's ID alone, so they look the same in every run and draw nothing from the simulation's streams.
- **Food and wood.** Each bush shows berries in proportion to its stock, which disappear as they are picked. Each tree stands with a pile of deadwood at its foot in proportion to its stock, which shrinks as it is gathered and grows back as branches fall.
- **People at work.** A walking forager walks. A forager working a bush bends and picks, and one working a tree breaks and gathers branches. A forager asleep lies at its hearth, beside a fire that burns in its warm hours and is dark in its cold ones. A bundle on its back shows the wood gathered on the trip under way, and a stack by its hearth the rest of the wood it holds; one carrying food carries a parcel at its hip. Gestures loop while the simulation says the forager is doing that work, and never otherwise. In a minute that holds a walk and then work, the forager walks for the walking seconds and then works.
- **Continuous display.** As in Life 0, the display draws between two real states, now a minute apart. Positions follow straight lines at walking speed, stocks change through the minute, and the light follows the time of day.
- **Camera.** Like a real-time strategy game: drag or the arrow and WASD keys to pan, the wheel or a pinch to zoom from the whole valley down to about 5 m across, and a right-drag, two fingers, or Q and E to rotate. Close in, the camera tilts towards eye level, so people are seen from the side rather than from above. Clicking a forager follows it with the camera. Panning stops following, and a button returns to the followed forager.
- **Time.** Pause, step a minute, and speeds of real time, 10 times, 1 minute a second, 10 minutes a second, 1 hour a second and 1 day a second. The fastest draws without interpolation.
- **HUD and inspector.** Life 4's HUD for the followed forager, with time to the minute, its wood and how much of a load it has gathered on this trip. Clicking a bush or tree shows its true stock beside what the followed forager remembers and when it saw it. The followed forager's perception is drawn as a circle on the ground.
- **Charts.** Life 4's charts, by day.
- **Controls.** The setup has the seed, band size, load, practice, swapping and quotes switches, the skill range and practice memory.
- **Drawing.** Bushes, berries, trees and deadwood piles are instanced meshes, and only plants whose stock changed are redrawn. A 50 m grid on the ground helps judge distances. The page works at 375 px wide.
- **The MVP9 observer's top bar** links to Life 5, as it linked to Life 4.

## Code layout

| File | Contents |
| --- | --- |
| `src/valley/types.ts` | Configuration, state, events and summaries |
| `src/valley/config.ts` | Defaults and validation |
| `src/valley/layout.ts` | Sites, bushes, trees and hearths; a spatial index of plants |
| `src/valley/geometry.ts` | Integer distance, walking time and straight-line steps |
| `src/valley/forager.ts` | Observation, hunger and wood need, the rules, choice of work and of a plant |
| `src/valley/work.ts` | The 60 seconds: walking, working with remainders, sleeping and fires, metabolism |
| `src/valley/trade.ts` | Life 3's own terms, swaps and quotes, within talking distance |
| `src/valley/practice.ts` | Practice in seconds |
| `src/valley/engine.ts` | `createValley`, `stepValley` and `runValley` |
| `src/valley/invariants.ts` | The invariants above |
| `src/valley/theory.ts` | The predictions above |
| `src/valley/experiments.ts` | Experiments 1 to 5 |
| `src/valley/*.test.ts` | Unit tests (`config`, `layout`, `engine`), and the experiments in files of their own so they run in parallel (`time`, `surplus`, `loads`, `loadsBorn`, `exchange`, `counterfactual`, `feeds`, `feedsSixteen`) |
| `src/valleyView/` | The observer |
| `life4.html` | A Vite entry for the unchanged `src/lifeView/` |

`src/valley` imports the random-number functions from `src/sim/rng.ts` and carried-food lots from `src/life/food.ts`, and nothing else from either core. Its experiments import `src/life` to run Life 4 beside it. Nothing under `src/sim` or `src/life` changes, so MVP9 and Life 0 to Life 4 keep their trajectories bit for bit.

**Purity and speed.** `stepValley(previous)` never changes the state it is given: it copies the state and advances the copy one minute. `runValley(state, minutes)` copies once and advances its copy minute by minute, checking invariants each minute when asked to. Both are pure at their boundary. Inside a run, a minute changes only the plants and foragers it touches. Observation reuses a forager's list of plants in view while it stands still. Target choice searches the spatial index outwards rather than every plant. Carried food is eaten and added without copying or sorting lots needlessly, with the same result as Life's `takeOldest` and `addLots`. The draft aimed for a canonical run of 400 days in under 2 seconds with invariants on. It takes about 2 seconds without them and about 3 with them, so the tests use 8 seeds, shorter horizons where they can, and run only the configurations they check. The valley's tests load every core, so the test runner's time limit per test is raised from 5 to 60 seconds, which a Life 0 test that takes a second alone needed in the full suite.

## Tests

- Configuration validation, one case per rule, including a layout that cannot be drawn.
- Layout: deterministic for a seed; spacing and radii respected; bushes in thicket order; hearths on the spiral.
- Geometry: integer distances, walking times, and steps that never overshoot or leave the valley.
- Regrowth: daily shares add up to the daily rate, and stop at capacity.
- Remainders: an hour of work at rate `r` takes exactly `r` units, and an hour at cost `c` pays exactly `c` kilocalories.
- The 60 seconds: walking, arriving and working in the same minute, and sleeping warm and cold. Standing at an empty plant is left to the invariants, which check every minute's seconds.
- Each rule, with loads: filling a load, the hunger that interrupts it, and `tripWood` returning to 0 at the hearth.
- Choosing a plant: nearest worthwhile, then seen longest ago, with their tie-breaks; keeping and dropping a target.
- Exchange within talking distance, and not beyond it.
- Determinism: two runs with the same configuration produce identical events and summaries, `runValley` over `n` minutes equals `n` calls to `stepValley`, and neither changes the state it is given.
- Eating carried food gives exactly what Life's `takeOldest` gives.
- The invariants catch a broken balance, a plant changed without a record, a step too long, work out of reach, and a sleeper away from its hearth.
- The expectations of experiments 1 to 5.
- Observer: the view model's interpolation within a minute that holds a walk and then work, gestures that follow actions, the wood on a forager's back and by its hearth, berries shared out bush by bush, the inspector, the clock, and the camera's limits and tilt. The setup's validation is the configuration's, checked in the browser.

## Not in step 5

Felling trees, axes and other tools, which are the next step; stone and mining; hills, water and paths around obstacles; people and plants blocking one another; seasons; real productivity; limits on what a forager can carry besides a load of wood; Life 2's sharers, reciprocators and windfalls; field of view and occlusion; a minimap; and giving the viewer control of anyone. Each arrives with the step whose question needs it.

## Documentation on implementation

A changelog entry; a lab-notes entry with the findings of experiments 1 to 5 and the prototype's finding about surplus; Life 5 sections in the architecture notes and the validation guide; the README's section updated with a new screenshot; `AGENTS.md` pointed at `src/valley/` and `src/valleyView/` as where new work goes; and the merge document's ladder updated, with step 5 "Real scale" inserted, tools and shelter moving to step 6, and later steps moving down by one.

## References

- Orians, G. H., and Pearson, N. E. (1979). On the theory of central place foraging. In D. J. Horn, R. D. Mitchell and G. R. Stairs (eds.), *Analysis of Ecological Systems* (pp. 155–177). Ohio State University Press.
- Life 0 to Life 4: the [Life 0](LIFE0_SPEC.md), [Life 1](LIFE1_SPEC.md), [Life 2](LIFE2_SPEC.md), [Life 3](LIFE3_SPEC.md) and [Life 4](LIFE4_SPEC.md) specifications.
