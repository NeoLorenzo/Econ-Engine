# [LIFE3-Specialization-031]

Life 3 is step 3 of the bottom-up core described in the [merge document](MERGE.md#the-ladder). The band of [Life 2](LIFE2_SPEC.md) now lives through cold nights. A forager stays warm only by burning wood, which grows in groves, a second resource on the land. Foragers differ in how well they forage and how well they gather wood, and two foragers at camp may swap wood for food. There are still no tools, recipes or improvement with practice; they are the next step.

Everything in Life 2 that this document does not change still holds.

## Question

When foragers differ in skill and can swap one good for another, does each come to specialize in what it is relatively good at, and does exchange appear and keep more of the band alive?

Theory says yes. Ricardo's comparative advantage holds that two producers both gain by specializing and trading whenever their relative costs differ, even if one is better at everything (Ricardo, 1817). Adam Smith adds that a specialist also saves the time lost passing from one task to another (Smith, 1776). But theory assumes that exchange already happens. Here nothing makes it happen. Two foragers can swap only if they meet, one carries what the other wants, and both know a swap would pay. A forager working for trade must also trust that someone will take what it brings home, while its own hunger does not wait. Whether specialization and exchange emerge under those frictions, and from what, is the step's finding.

## What the prototype found first

A throwaway prototype of this step, run before this document was written, reproduced Life 2 exactly and showed three things that shaped the design:

- **With steady harvests, exchange never starts on its own.** A swap needs a buyer carrying food, and with steady harvests no forager ever carries any: it eats each harvest before its reserve is full. A forager would carry food only to buy wood, and it would do that only if it already knew a swap would pay. In the prototype, no swap took place in any run until foragers at camp could tell each other the terms they would accept.
- **Working for trade can starve a band.** In the first version, a hungry forager that had once heard good terms for wood kept gathering wood to sell, whether or not anyone was buying. Foragers starved holding 300 to 500 units of wood that no one wanted, and a band of 8 fell to 1.3 survivors, against 6.9 without swaps. A forager now sets out to gather wood for trade only once it has sold all its spare wood. Unsold stock tells it that demand is met, as unsold stock tells a shop.
- **Cold and wood make the land carry fewer.** The 12 × 12 land that carried Life 2's camp band of 12 on steady harvests carries a band of 8 once nights are cold and wood must be fetched. A band of 12 with equal skills collapsed in every seed.

The owner chose wood and skill as this step, with tools, recipes and practice as the next, and swaps added beside Life 2's food gifts.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| The second good | Wood, gathered from groves that deplete and regrow like patches, in whole units | A second resource on the land, conserved exactly. It has one use, so its value is easy to state. |
| Why wood matters | Nights are cold. A forager that sleeps without a fire burns `coldSleepKcalPerHour` instead of `sleepKcalPerHour`. Burning `fireWoodPerHour` units for an hour of sleep keeps it warm. | The merge document's purpose for crafting is warmth against cold. Burning is the one conversion. Its value is measured in kilocalories saved, the unit everything else uses. |
| Whose fire | Each forager burns its own wood at its own hearth at camp | In forager camps each family keeps its own hearth. A shared fire would make wood a public good and turn the question into one about free riders, which Life 2 already asked. |
| Skills | Each forager has a foraging skill and a wood skill, percentages drawn uniformly and independently from `skillMinPercent` to `skillMaxPercent`, fixed for the run. A forager's hourly rates are its skill times `forageKcalPerHour` and `woodPerHour`, rounded down. | Comparative advantage needs relative costs that differ. Equal skills are the counterfactual. Improvement with practice is the next step's question. |
| Knowledge of skill | A forager knows its own rates. | A forager knows what it is good at, as a person does. Learning one's own skill from experience arrives with practice. |
| A forager's own terms | What a unit of wood costs it in food: its foraging rate divided by its wood rate, `pᵢ = gᵢ / wᵢ` kilocalories per unit. Both take the same hour of work. | This is the autarky price of comparative advantage, built only from the forager's own body. It is not a price anyone posts. |
| Swaps | At camp or anywhere two foragers share a tile, one with more wood than it wants and one with less may swap. They swap at the midpoint of their own terms, rounded down. A swap happens only if both gain. | Bilateral trade at the midpoint of two valuations follows Sugarscape's trade rule (Epstein and Axtell, 1996). No market, auctioneer or posted price exists. |
| Telling terms | Two foragers that could both gain from a swap tell each other the terms, even if neither can complete it now (`quotes`). Everyone on the tile hears the terms of a swap that does happen. | Telling is communication, which design rule 1 allows. The prototype found exchange never starts with steady harvests without it. Turning it off is an experiment. |
| Remembered terms | A forager remembers the last terms it heard, for `termsMemoryHours` hours. | Terms heard long ago may no longer hold. Forgetting is how a forager stops working for trade that has dried up. |
| Working for trade | A hungry forager works at gathering wood to sell if the terms it remembers make an hour of gathering buy more food than an hour of foraging, and only once it has sold all its spare wood. A forager short of wood forages food to buy wood if the terms make that quicker than gathering. | The forager compares its own rates with terms it has heard (design rule 2). Unsold wood stops it producing for a demand that is not there. Nothing tells it to specialize. |
| Gifts | Life 2's gifts stay, for food only. The canonical band is all keepers. | The owner chose to add swaps and leave gifts as they are. Keepers isolate swaps. Comparing gifts with swaps is left for later. |
| Harvests | A forager's harvest is the larger of `harvestKcal` and its own foraging rate, and an hour succeeds with probability `rate / harvest`. The canonical `harvestKcal` is the lowest possible rate, so every forager's harvests are steady. | With the same harvest for all, a slow forager would face windfall risk, mixing Life 2's question into this one. |
| Life 2 | Reproduced bit for bit with no groves, warm nights, equal skills and no swaps | It makes the generalization a verifiable refactor. |

## World

The world is Life 2's: a grid of patches, a camp in the middle, daylight from `dawnHour` to `duskHour`, and patches that regrow.

### Groves

There are `groveCount` groves, each on its own tile with no patch. A grove holds whole units of wood, up to `groveCapacityWood`, and gains `groveRegrowthWoodPerHour` units every hour, up to its capacity. Every grove starts with `initialGroveWood`.

### Layout

1. Tiles are shuffled as in Life 0. The first `patchCount` tiles hold patches, as before, and the next `groveCount` hold groves, with grove IDs from 0 in shuffle order.
2. Foragers start at camp, as in Life 2; without a camp, starting tiles are drawn as in Life 1. Adding groves changes neither patches nor starting tiles.

### Skills

Skills come from their own stream, seeded from the run seed and a salt for skills with `mixSeed`. For forager 0, 1, 2 and so on, it draws the foraging skill and then the wood skill, each with `randomInt` over the `skillMaxPercent − skillMinPercent + 1` values from `skillMinPercent`. Forager `i`'s rates are:

- `gᵢ = floor(forageKcalPerHour · foragingSkill / 100)` kilocalories an hour;
- `wᵢ = floor(woodPerHour · woodSkill / 100)` units an hour.

With `skillMinPercent = skillMaxPercent = 100` every forager has Life 2's rate.

### The luck stream

As in Life 2, with the forager's own rate. Forager `i`'s harvest is `Hᵢ = max(harvestKcal, gᵢ)`, and its hour succeeds if `randomInt(Hᵢ) < gᵢ`.

## The forager

A forager keeps Life 2's state and adds:

| State | Meaning |
| --- | --- |
| `forageRate`, `woodRate` | `gᵢ` and `wᵢ` |
| `wood` | The wood it holds, in units. Wood keeps. |
| `shortOfWood` | Wood need, with hysteresis |
| `targetGroveId`, `groveMemory` | The grove it is walking to, and what it last saw at each grove, as for patches |
| `heardTerms` | The last terms it heard, in kilocalories per unit, and the tick it heard them, if any |
| `trip` | A trip for trade under way, with the spare wood it set out to gather, if any |
| `swapTotals` | The wood it has sold and bought, and the food it has received and paid for it |
| `hoursWorked` | Its hours foraging and gathering, which the observer's chart reads |

At tick 0 a forager holds no wood, remembers every grove's starting stock, has heard no terms, and is short of wood if wood matters (below).

### Wood need

Wood matters when there are groves and `coldSleepKcalPerHour > sleepKcalPerHour`; otherwise a forager never wants wood. A night's wood is `nightWood = (24 − (duskHour − dawnHour)) · fireWoodPerHour` units, and a forager's target is `woodTarget = woodStockNights · nightWood`. Like hunger, wood need has hysteresis: a forager becomes short of wood when it holds less than one night's wood and stays short until it holds its target.

Its spare wood is what it holds above its target. It wants wood up to its target.

## Hourly step

Each tick runs Life 2's phases: regrowth of patches and now groves, the turn order, each living forager's turn, and the record. A turn now has these phases.

1. **Spoilage,** as in Life 2.
2. **Eating,** as in Life 2.
3. **Observation.** As in Life 1, for groves as for patches.
4. **Decision.** Life 1's hunger update and the wood-need update, then the first rule that applies:

   | Priority | Condition | Action | Reason recorded |
   | --- | --- | --- | --- |
   | 1 | Life 2's rule 1 | Walk to camp | `going home` |
   | 2 | It is night | Sleep | `night` |
   | 3 | Neither hungry nor short of wood | Rest | `satiated` |
   | 4 | It chooses a good to work for (see [Choosing work](#choosing-work)), or chooses to wait | Rest if waiting | `waiting to swap` |
   | 5 | Standing on a site of that good holding a full hour's work: a patch with at least `Hᵢ`, or a grove with at least `wᵢ` | Forage or gather | `foraging` or `gathering` |
   | 6 | Some other site of that good it can reach in time | Walk towards it | `seeking food` or `seeking wood` |
   | 7 | Otherwise | Rest | As in Life 2 |

   Rules 5 to 7 are Life 2's rules 4 to 6, applied to whichever good the forager works for. Reaching a grove in time means reaching it, gathering for an hour and walking home before dusk, as for a patch. The forager keeps a target grove as it keeps a target patch, and chooses a grove by Life 0's patch choice, with "a full hour's harvest" read as `wᵢ`.

5. **Action.**
   - **Forage,** as in Life 2, with the forager's own rate and harvest.
   - **Gather:** the forager takes `wᵢ` units from the grove and adds them to its wood.
   - **Sleep:** if wood matters and the forager holds at least `fireWoodPerHour` units, it burns that many and sleeps warm. Otherwise it sleeps cold.
   - **Walk** and **rest,** as in Life 2.
6. **Exchange.** Swaps (see [Swapping](#swapping)), then Life 2's giving.
7. **Eating again.** The forager eats from what it carries, oldest first, up to the room in its reserve. It eats food it received in a swap at once. In Life 2, a forager carrying food always has a full reserve at this point, so this phase changes nothing there.
8. **Metabolism,** as in Life 2, except that an hour of sleep costs `coldSleepKcalPerHour` if the forager slept cold. Gathering costs `forageCostKcalPerHour`.

### Choosing work

A forager knows terms `T` if `swapping` is on and it heard terms within the last `termsMemoryHours` hours. Selling wood pays if `wᵢ · T > gᵢ`: an hour of gathering would buy more food than an hour of foraging. Buying wood pays if `gᵢ > wᵢ · T`: an hour of foraging would buy more wood than an hour of gathering.

- **A hungry forager** works for food. If selling wood pays, it gathers wood to sell instead:
  - it continues a trip for trade begun today, until it holds the spare wood the trip set out for;
  - otherwise, if it holds no spare wood, it begins a trip, setting out to hold `ceil(request / T)` spare units, where `request` is what it would ask for under Life 2's rule;
  - otherwise it forages: it still has unsold wood, so it does not make more.
- **A forager only short of wood** works for wood. If buying wood pays, it forages food to buy wood instead, until it carries `(woodTarget − wood) · T` kilocalories; once it does, it rests, waiting to swap.

A trip for trade ends at night, when it has gathered what it set out for, or when the forager is no longer hungry. A forager foraging to buy wood eats its harvest until its reserve is full, as always, and carries the rest.

### Swapping

A forager swaps only if `swapping` is on and wood matters. In the exchange phase, the forager whose turn it is:

- **if it holds spare wood,** offers it to the living foragers on its tile that hold less wood than their target and whose own terms are higher than its own, highest own terms first;
- **if it holds less wood than its target,** asks the living foragers on its tile that hold spare wood and whose own terms are lower than its own, lowest own terms first.

Ties go to the lowest ID. With each partner in turn, the seller `s` (the one with spare wood) and the buyer `b` compute the terms

`T = floor((g_s · w_b + g_b · w_s) / (2 · w_s · w_b))`

kilocalories per unit, the midpoint of their own terms rounded down. If `T` is not strictly between `p_s` and `p_b`, they move on. Otherwise, with `quotes` on, both remember `T`. They then swap

`q = min(spare wood of s, b's target − b's wood, floor(food b carries / T), floor(room in s's reserve / T))`

units of wood for `q · T` kilocalories, where room is `reserveMaxKcal − energyKcal − carried food`. The buyer pays with its oldest lots first. If `q` is at least 1, every living forager on the tile, the two included, remembers `T`. The forager stops when it has no spare wood left to sell, or no food left to pay with or no more wood to want.

A swap happens only when both gain at their own terms: the seller receives more food than the hour of work the wood cost it would have foraged, and the buyer pays less food than the wood would have cost it in foraging time. Nobody else's terms enter the calculation, and no rate is posted.

## Defaults

The canonical world for step 3 keeps Life 2's land and adds groves, cold and skills. A band of 8 keepers lives on it.

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `bandSize` | 8 | With equal skills and no swaps, intact on all 32 prototype seeds; 12 collapses |
| `sharers`, `reciprocators` | 0, 0 | All keepers, so gifts never happen |
| `harvestKcal` | 600 | The lowest possible rate, so every harvest is steady |
| `groveCount` | 8 | |
| `groveCapacityWood`, `initialGroveWood` | 200, 200 | |
| `groveRegrowthWoodPerHour` | 2 | 384 units a day across the groves, four times the band's need |
| `woodPerHour` | 24 | A forager of skill 100% gathers two nights' wood in an hour |
| `fireWoodPerHour` | 1 | 12 units a night |
| `coldSleepKcalPerHour` | 150 | A cold night costs 1,080 kcal more than a warm one |
| `woodStockNights` | 2 | Short below 12 units, satisfied at 24 |
| `skillMinPercent`, `skillMaxPercent` | 50, 150 | Foraging 600–1,800 kcal an hour, wood 12–36 units |
| `swapping`, `quotes` | true, true | |
| `termsMemoryHours` | 24 | |

Life 2's other defaults are unchanged.

`LIFE2_WORLD` is the set of overrides that gives back Life 2: a band of 12 with 4 sharers and 4 reciprocators, windfalls of 6,000, no groves, `coldSleepKcalPerHour` equal to `sleepKcalPerHour`, skills of 100% and no swapping. `LIFE1_WORLD` and `LIFE0_WORLD` now build on it.

`createLife` refuses a configuration unless, in addition to Life 2's rules:

- every numeric value is an integer, and `hasCamp`, `swapping` and `quotes` are booleans;
- `patchCount + groveCount` is at most the number of tiles;
- `0 ≤ initialGroveWood ≤ groveCapacityWood`, `groveRegrowthWoodPerHour ≥ 0` and `fireWoodPerHour ≥ 1`;
- `coldSleepKcalPerHour ≥ sleepKcalPerHour`;
- `1 ≤ skillMinPercent ≤ skillMaxPercent`, and the lowest rates are at least 1: `floor(forageKcalPerHour · skillMinPercent / 100) ≥ 1` and `floor(woodPerHour · skillMinPercent / 100) ≥ 1`;
- a patch can hold the largest harvest, `max(harvestKcal, floor(forageKcalPerHour · skillMaxPercent / 100)) ≤ patchCapacityKcal`, and, with groves, a grove can hold the largest hour of gathering, `floor(woodPerHour · skillMaxPercent / 100) ≤ groveCapacityWood`;
- `harvestKcal ≥ 1`, `woodStockNights ≥ 1` and `termsMemoryHours ≥ 0`.

Life 2's rule that `forageKcalPerHour ≤ harvestKcal ≤ patchCapacityKcal` is replaced by the harvest rules above.

## Invariants

Life 2's invariants still hold, checked after every tick, with these additions:

- **Wood is conserved exactly.** Total grove wood + the wood every forager holds, living or dead + all wood burned = total starting grove wood + all wood regrown. A dead forager's wood stays with it, unused.
- **Energy** is conserved exactly as in Life 2. Cold sleep costs more, and that cost is metabolized like any other.
- Every grove holds between 0 and `groveCapacityWood`. Every forager holds a whole, non-negative number of units.
- A gathering hour happened only in daylight, on a grove the forager observed in its own turn holding at least `wᵢ`, and took exactly `wᵢ`.
- A forager burned wood only while sleeping and only where wood matters, exactly `fireWoodPerHour` at a time. It slept cold exactly when it burned nothing and `coldSleepKcalPerHour > sleepKcalPerHour`, so a cold world without groves sleeps cold every night.
- Every swap was between two living foragers on the same tile, with at least 1 unit of wood and `q · T` kilocalories. `T` was the rounded-down midpoint of their own terms and strictly between them, the seller's own terms being the lower. Before the swap, the seller held spare wood and the buyer less than its target. The swap left the seller at or above its target and the buyer at or below it, took no more food than the buyer carried, and gave the seller no more than its room.
- Every forager's remembered terms come from a tick that has already happened, and terms heard in the last hour were agreed in a swap or quote that hour.
- The wood every forager has sold and bought both equal all wood swapped, and the food received and paid both equal all food swapped.

## Theory

`theory.ts` keeps Life 2's predictions and adds:

- **Wood is always worth burning.** A unit burned saves `coldSleepKcalPerHour − sleepKcalPerHour` (90) kilocalories. Gathering it costs `(forageCostKcalPerHour − restKcalPerHour) / wᵢ` (6 to 18) kilocalories more than resting, plus the walk.
- **Wood hours without trade.** A forager that burns a night's wood every night spends `nightWood / wᵢ` daylight hours a day gathering: 20 minutes to an hour for the canonical skills.
- **The sign of specialization.** Without trade, a forager's share of its working hours spent gathering is `(nightWood / wᵢ) / (nightWood / wᵢ + F / gᵢ)`, where `F` is its daily food need. This rises with its own terms `pᵢ = gᵢ / wᵢ`: a forager that is relatively good at foraging spends relatively long on wood, because wood is slow for it. Comparative advantage predicts the opposite sign once exchange is possible: foragers with low own terms gather wood for those with high ones. The correlation across a band between own terms and the share of hours spent gathering should therefore turn from positive to negative when swapping is switched on.
- **No gains, no exchange.** With equal skills every forager's own terms are equal, no terms lie strictly between them, and no swap or quote can happen. The run is then identical to one without swapping.
- **No surplus, no first swap.** With `quotes` off and steady harvests, a forager carries food only to buy wood, and it does that only once it has heard terms. It can hear terms only from a swap, so no swap ever happens, and the run is identical to one without swapping.

### Predictions

First seen in the prototype and confirmed by the experiments, whose numbers are quoted here, on 32 seeds and the canonical world unless stated:

- **Specialization follows comparative advantage.** Without swaps, the correlation between own terms and the share of hours spent gathering averages +0.90; with swaps, −0.78. The two foragers that gather the most bring in 33% of the band's wood without swaps and 69% with them. Half the wood burned (49%) has been bought.
- **Exchange keeps more of the band alive, mostly the least skilled.** A band of 8 keeps 7.5 alive with swaps against 6.9 without. The third of each band with the lowest foraging rates survives 80% of the time with swaps and 52% without. Most deaths come in the first 50 days either way.
- **Exchange has a cost: more cold nights.** The band sleeps cold in 16% of its night hours with swaps and 12% without. Traces show two ways it happens. A forager that heard low terms forages to buy wood, but eats its harvest until its reserve is full; a poor forager may never fill it, so it never carries food to pay with, and sleeps cold. And a poor forager that is hungry day after day works only for food, because hunger comes first, so it never fetches wood; cold nights then make it hungrier.
- **The gain grows with the spread of skills.** With skills from 80% to 120% no one dies either way, and swaps cut a forager's daily walking from 3.8 hours to 3.3 and its working hours from 3.4 to 3.2. With skills from 25% to 175%, survivors rise from 5.8 to 6.7 and the least skilled third's survival from 16% to 61%.
- **Telling terms is what starts exchange.** With `quotes` off and steady harvests, nothing is ever swapped. With windfalls of 6,000, swaps start from the food foragers carry home, about 650 per run over the measured days, but specialization stays weak: the correlation falls only from +0.86 to +0.23, and survival does not change (3.1 survivors). With quotes on in the same world, swaps triple, the correlation reaches −0.75 and 3.6 survive.
- **Terms do not converge.** Swaps settle anywhere between about 33 and 73 kcal per unit. In the first quarter of a run's swaps the terms average 51 kcal per unit with a standard deviation of 14; in the last quarter, 52 and 14. Each pair splits the difference between its own fixed terms, and no forager learns from the terms others got. One going rate for wood does not emerge.

They are findings for this world, not theorems.

## Experiments

All experiments are deterministic, run headless in `src/life/experiments.ts`, and check every invariant every hour. Runs last 400 days, or end early once every forager is dead. Seeds are `20260813` followed by `1, 2, 3, …`, as many as each experiment names. Measures over a run use days 21 to 400, after Life 0's warm-up, and hours a day are per living forager. The tests run experiments 3 to 5 on the first 16 seeds; every tested expectation holds on both. With them, the Life tests take about two minutes.

Specialization is measured by:

- a forager's **wood share**, the share of its foraging and gathering hours spent gathering;
- the **correlation** across a band, within each run, between own terms and wood share, averaged over runs;
- the **concentration** of wood, the share of the band's wood gathered by the two foragers that gathered the most;
- the share of wood burned that was **bought** in swaps.

### 1. Life 2 reproduced

The step's code, with `LIFE2_WORLD`, reproduces Life 2 exactly.

- Checksums of every forager's action, reserve and carried food in every hour, of every gift, and of the daily summaries over 400 days are compared with checksums recorded from Life 2's code before this step. The configurations are Life 2's canonical band on two seeds and its band of keepers at 9,600 on one, plus the four Life 1 runs Life 2 already checks.
- Life 0's, Life 1's and Life 2's experiments still pass, unchanged except that they run on their worlds.

### 2. Wood and cold

Bands of 8 with equal skills on the canonical world, with and without swapping. 8 seeds.

Expected:

- With equal skills, no swap or quote happens, and every hour of the run with swapping on is identical to the run with it off.
- The band is intact at day 400 on every seed.
- The band sleeps cold in fewer than a quarter of its night hours.

Reported: the share of night hours slept cold, 11%, mostly by foragers whose hunger took the day before they could fetch wood; and each survivor's hours gathering against `nightWood / wᵢ`, 85% to 94% of it (89% on average), the rest being nights slept cold.

### 3. Comparative advantage

Bands of 8 on the canonical world, with swapping off and on. 32 seeds.

Expected:

- Without swaps the correlation between own terms and wood share is positive on average, and with swaps it is negative.
- Wood is more concentrated with swaps than without.
- With swaps, more of the least skilled third survive on average, and at least as many foragers survive overall.

Reported: survivors over time (design rule 28), swaps per day, the share of wood bought, the share of nights slept cold, and hours of work and walking per survivor.

### 4. The spread of skills

Experiment 3 with skills from 100% to 100%, 80% to 120%, 50% to 150% and 25% to 175%. 32 seeds.

Expected:

- At 100% to 100%, no swap happens.
- At every wider spread the correlation turns from positive to negative.
- At 80% to 120%, swaps lower a forager's mean hours of work and walking a day.

Reported: survivors and the least skilled third's survival at each spread, which the prototype found rising with the spread.

### 5. Telling terms

Experiment 3 with `quotes` off, with steady harvests and with windfalls of 6,000. 32 seeds.

Expected:

- With steady harvests no swap happens, and every run is identical to the run with swapping off.
- With windfalls, swaps happen.

Reported: with windfalls, the correlation, survivors and swaps per run, against the same band with quotes on.

## Ledger and metrics

- **Events.** Action events add the gathering outcome (wood gathered), wood burned, whether the forager slept cold, whether the action was for trade, and the wood held afterwards. A new swap event records the tick, the tile, the seller and buyer, the wood and kilocalories exchanged, the terms, and what each held just before: the seller's wood and room for food, the buyer's wood and carried food. The invariants check each swap against them. A new quote event records the tick, the two foragers and the terms. Swap and quote events follow the action event of the forager whose turn it was. The state keeps the last hour's swaps in `lastSwaps`.
- **Daily summaries** add hours of gathering, wood gathered, wood burned, hours slept cold, the number of swaps, and the wood and food swapped.
- **Totals** add grove wood at the start, wood regrown, wood burned, and the wood and food swapped.

## Observer

The page stays `life.html` and is retitled "Life 3 · specialization".

- **World.** A patch is a thicket of six bushes whose berries are its food, and a grove a stand of five trees. Berries are picked and trees felled to stumps one at a time as a site runs low, and both grow back; the bushes stay green throughout. (Update 032 replaced the single bush per patch, and the single tree per grove whose crown shrank, so that food and wood are told apart by fruit and trunks.) A forager holding wood shows a small stack of logs, sized by what it holds, beside any bundle of food. Each forager sleeping at camp has its own small hearth beside it, lit while it burns wood and dark when it sleeps cold. A swap is drawn as two parcels crossing between the two foragers during the hour it happens, wood one way and food the other.
- **Colour.** Each forager is coloured by its own terms, on a scale from those relatively best at gathering to those relatively best at foraging. Life 2's strategy colours give way, since the canonical band is all keepers; a forager's strategy is still in the HUD.
- **Following a forager,** as in Life 2. The HUD adds its two rates and its own terms, the wood it holds, the terms it remembers and when it heard them, whether it is working for trade, and what it has sold and bought in total.
- **Inspector.** Clicking a grove shows its wood and what the followed forager remembers of it, as for a patch.
- **Charts.** Each forager's share of working hours spent gathering, against its own terms, so specialization shows as a falling line of points; the wood swapped, hours slept cold and foragers alive each day; and the followed forager's reserve, as before. The HUD shows a forager's strategy, and its gifts, only when the band has sharers or reciprocators.
- **Controls.** The setup adds the skill range and switches for swapping and for telling terms.
- The page works at 375 px wide.

## Code layout

| File | Change |
| --- | --- |
| `types.ts` | The new configuration, groves, skills, wood, remembered terms, trips, swap and quote events and the new summary fields |
| `config.ts` | The new defaults, `LIFE2_WORLD` and the new validation rules |
| `world.ts` | Groves in the layout, the skill stream, and each forager's harvest and luck |
| `wood.ts` (new) | Wood need, targets, spare wood and burning |
| `trade.ts` (new) | Own terms, the terms of a pair, whom a forager offers to or asks, quotes and swaps |
| `forager.ts` | Choosing work, the priority rules for two goods, and choosing a grove |
| `engine.ts` | The turn's new phases |
| `invariants.ts` | The new invariants |
| `theory.ts` | Wood's value, wood hours without trade and the autarky wood share |
| `experiments.ts` | Experiments 1 to 5, and the earlier experiments on their worlds |
| `specialization.test.ts`, `spread.test.ts`, `quotes.test.ts` (new) | Experiments 3 to 5 as tests, in their own files so they run in parallel |
| `wood.test.ts`, `trade.test.ts` (new) | Unit tests of wood, cold, skills, choosing work, quotes and swaps; experiment 2 runs in `wood.test.ts` and experiment 1 in `experiments.test.ts` |
| `src/lifeView/` | Groves, logs, hearths, swaps, colours by own terms, the new HUD, charts and setup fields; the specialization chart in `SpecializationChart.tsx` (new) |

`src/sim` is still untouched.

## Tests

- Configuration validation for the new rules.
- Layout: groves follow patches in the shuffle; with no groves the layout is Life 2's. Skills are deterministic for a seed, within range, and 100% gives Life 2's rate.
- Harvests: a forager's harvest is the larger of `harvestKcal` and its rate; a forager faster than `harvestKcal` always succeeds.
- Wood: becoming short below a night's wood and satisfied at the target; gathering takes exactly `wᵢ` from a grove holding at least that; sleeping burns `fireWoodPerHour` and is warm, or is cold with less; a forager does not set out for a grove it could not gather at and return from in time.
- Choosing work: a hungry forager gathers to sell only when selling pays and it holds no spare wood, continues a trip until its goal, and forages while it holds unsold wood; a forager short of wood forages to buy only when buying pays, and waits once it carries enough; forgotten terms return it to working for itself.
- Swapping: terms are the rounded-down midpoint and strictly between the two own terms; no swap or quote with equal skills; a seller serves the highest own terms first and a buyer the lowest; quantities respect spare wood, wants, the buyer's food and the seller's room; the seller eats what it received at once; everyone on the tile hears a swap and only the pair hears a quote; with `quotes` off, failed matches teach nothing.
- The invariants catch a swap outside the two own terms and wood that is not conserved.
- Determinism: two runs with the same configuration produce identical events and summaries.
- The expectations of experiments 1 to 5.
- Observer: groves and their stocks, logs sized by wood, hearths lit or dark, a swap's parcels, colours by own terms, the new HUD lines, and the setup's validation of the skill range.

## Not in step 3

Tools, recipes and improvement with practice, which are the next step; a shared fire; seasons; shelter; gifts of wood; credit or delayed repayment; foragers misstating their terms; learning one's own skills; limits on what a forager can carry; storage at camp; and a market or posted price. Each arrives with the step whose question needs it.

## Documentation on implementation

A changelog entry; a lab-notes entry with the findings of experiments 2 to 5 and the prototype's findings about telling terms and unsold stock; Life 3 sections in the architecture notes and the validation guide; the README's section updated with a new screenshot; and the merge document's ladder updated: step 3 becomes "Wood and skill", a new step 4, "Tools and practice", takes tools, recipes and improvement with practice, and later steps move down by one.

## References

- Epstein, J. M., and Axtell, R. (1996). *Growing Artificial Societies: Social Science from the Bottom Up*. MIT Press. Chapter IV, "Sugar and Spice: Trade Comes to the Sugarscape".
- Ricardo, D. (1817). *On the Principles of Political Economy and Taxation*. John Murray.
- Smith, A. (1776). *An Inquiry into the Nature and Causes of the Wealth of Nations*. W. Strahan and T. Cadell.
