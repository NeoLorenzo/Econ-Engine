# [LIFE2-Sharing-030]

Life 2 is step 2 of the bottom-up core described in the [merge document](MERGE.md#the-ladder). The band of [Life 1](LIFE1_SPEC.md) gets a camp where it sleeps, harvests that come as rare windfalls, food that can be carried and spoils, and the ability to give food. Each forager follows one of three sharing strategies (keep, share, reciprocate) and remembers who gave it food. There are still no births, no exchange of different goods, and no learning.

Everything in Life 1 that this document does not change still holds.

## Question

When harvests are uneven and food spoils, does sharing keep more of a band alive? And does it pay the forager who shares, or does the forager who keeps everything do better by living off the others?

Theory points both ways. Sharing pools risk: a forager that comes home empty-handed eats from another's windfall, so fewer starve from a run of bad luck (Winterhalder, 1986). Foragers share most where returns vary most and food keeps least (Kaplan and Hill, 1985). But a forager that only takes is a free rider, and among unconditional sharers it should do best. Reciprocity, giving only to those who give back, is the classic defence against free riders (Trivers, 1971; Axelrod, 1984). Which of these the engine produces is the step's finding.

## What the prototype found first

A throwaway prototype of this step, run before this document was written, reproduced Life 1 exactly and showed three things that shaped the design:

- **Ordinary harvests leave nothing to share.** A forager's body holds up to 20,000 kcal. With harvests of up to 8,000, under 1% of food was ever given, whatever the rules. Sharing needs windfalls bigger than one forager can eat before they spoil.
- **Wandering foragers rarely meet.** Even with large windfalls, at most about 15% of food changed hands when foragers could give only to those they happened to meet. Giving barely changed who survived. A shared camp, where everyone sleeps, raised sharing to 20–50% of food in the same conditions.
- **Large windfalls are deadly.** A forager whose hours of foraging each succeed 1 time in 10 can go three days without luck and starve sitting on a patch full of food. That is the risk sharing insures against.

The owner chose a shared camp, competing strategies and a single step.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Where foragers meet | A camp at the centre of the grid. Every forager starts there, walks home before dark and sleeps there. | Sharing needs meeting. Forager bands share at camp, and the prototype found sharing almost absent without one. |
| Uneven harvests | An hour of foraging either succeeds and takes a full harvest of `harvestKcal`, or gathers nothing. It succeeds with probability `forageKcalPerHour / harvestKcal`, so the expected harvest per hour is unchanged. A patch can be foraged only while it holds a full harvest. | One parameter varies risk while keeping the average return. Requiring a full harvest keeps Life 0's rule that a forager never works a patch that cannot repay it. A harvest equal to `forageKcalPerHour` is Life 1. |
| Carrying | Food a forager harvests but cannot eat is carried. A forager eats from what it carries whenever its reserve has room. | A windfall can then outlast the meal, and there is something to give. The body stays the first store, as in Life 0. |
| Spoilage | Carried food spoils `shelfLifeHours` after it was harvested. A shelf life of 0 means food keeps. | It is the simplest form of perishability, exact in whole kilocalories, and it makes what is carried worth less the longer it is kept. |
| Giving | A forager may give carried food to hungry foragers on its own tile. A hungry forager asks for what would satiate it. | Asking is communication, which design rule 1 allows. Giving on a shared tile needs no new movement rule; at the camp it reaches everyone. |
| Strategies | Each forager is a **keeper** (never gives), a **sharer** (gives to any hungry forager), or a **reciprocator** (gives to hungry foragers who owe it nothing). Strategies are fixed for the run. | The question is which pays. Fixed strategies make that measurable without building sharing in. Whether a paying strategy spreads needs births and inheritance, which belong to step 5. |
| Memory of who gave | Each forager keeps a record of the food it has given to and received from every other forager. | Reciprocators need it. It is also the first social memory in the engine. |
| Patch choice | Life 1's rule, plus one constraint with a camp: a forager sets out only for a patch it can reach, forage for an hour, and walk home from before dusk. | Walking out only to turn back would be inexplicable. In the prototype, choosing the nearest patch instead of the fullest crowded the patches near camp and collapsed even a band with steady food, so fullest-first stays. |
| Life 1 | Reproduced bit for bit with the camp off, harvests of `forageKcalPerHour` and every forager a keeper. | It makes the generalization a verifiable refactor. |

## World

The world is Life 1's: a grid of patches, daylight from `dawnHour` to `duskHour`, and patches that regrow.

### The camp

With `hasCamp`, the camp is the tile `(floor(gridWidth / 2), floor(gridHeight / 2))`. It may hold a patch. Without a camp the band behaves as in Life 1.

### Layout

1. Patches are placed as in Life 0.
2. With a camp, every forager starts on the camp tile and no starting tiles are drawn. Without one, starting tiles are drawn as in Life 1.

### Strategies

Foragers `0` to `bandSize − sharers − reciprocators − 1` are keepers, the next `sharers` are sharers and the last `reciprocators` are reciprocators. With a camp every forager starts on the same tile and the turn order is shuffled every hour, so a forager's ID gives it no advantage.

### The luck stream

Whether an hour of foraging succeeds comes from its own stream. The seed for forager `i` in hour `t` is derived from the run seed, a salt for the luck stream, `t` and `i` with `mixSeed`, so any forager's luck in any hour can be reproduced on its own and adding the stream changes neither the layout nor the turn order. The hour succeeds if `randomInt(harvestKcal) < forageKcalPerHour`. With `harvestKcal = forageKcalPerHour` it always succeeds.

## The forager

A forager keeps Life 1's state and adds:

| State | Meaning |
| --- | --- |
| `strategy` | Keeper, sharer or reciprocator |
| `carried` | The food it carries, as lots: each lot's kilocalories and the tick it was harvested, oldest first |
| `ledger` | For every other forager: the food it has given them and received from them |

## Hourly step

Each tick runs Life 1's phases: regrowth, the turn order, each living forager's turn in that order, and the record. A turn now has these phases.

1. **Spoilage.** Every lot harvested at or before `tick − shelfLifeHours` spoils and is recorded as spoiled. With a shelf life of 0 nothing spoils.
2. **Eating.** The forager eats from what it carries, oldest lot first, up to `reserveMaxKcal − energyKcal`.
3. **Observation,** as in Life 1.
4. **Decision.** Life 1's hunger update, then the first rule that applies:

   | Priority | Condition | Action | Reason recorded |
   | --- | --- | --- | --- |
   | 1 | There is a camp, the forager is away from it, and it is night or walking home would take every remaining daylight hour: `ceil(d / tilesPerHour) ≥ duskHour − hour` | Walk to camp | `going home` |
   | 2 | It is night | Sleep | `night` |
   | 3 | Not hungry | Rest | `satiated` |
   | 4 | Standing on a patch holding at least `harvestKcal` | Forage | `foraging` |
   | 5 | Some other patch it can reach in time | Walk towards the target patch | `seeking food` |
   | 6 | Otherwise | Rest | `too late to set out` if there is a camp and another patch, otherwise `waiting for regrowth` |

   A patch `p` can be reached in time from tile `x` at hour `h` if `ceil(d(x, p) / v) + 1 + ceil(d(p, camp) / v) ≤ duskHour − h`, where `v` is `tilesPerHour`. Without a camp every patch can.

   Because a forager walks only towards a patch it can reach in time, it can always get home by dusk: rule 1 fires no later than the hour that leaves exactly enough daylight, and the forager sleeps at camp every night. Rule 1 also covers a forager caught away at night, which these rules prevent.
5. **Action.**
   - **Forage:** the hour succeeds or fails by the luck stream. On success the forager takes `harvestKcal` from the patch, eats as much as its reserve has room for, and carries the rest as a new lot. On failure nothing changes but the energy cost.
   - **Walk:** to camp under rule 1. Otherwise as in Life 1: the forager keeps its target until it reaches it, unless it sees the target holding less than a full harvest or can no longer reach it in time. It then chooses a new target by Life 0's patch choice, with "a full hour's harvest" read as `harvestKcal`, among the patches it can reach in time.
   - **Rest** and **sleep** change nothing but the energy cost.
6. **Giving.** If the forager carries food, it may give some to the hungry living foragers on its tile, according to its strategy (see [Giving](#giving)).
7. **Metabolism,** as in Life 1. A forager whose reserve reaches 0 dies.

The order matters for gifts. A gift made in one forager's turn is eaten by the recipient at the start of its next turn, which may be later in the same hour.

### Giving

A forager is hungry if its hunger mode, as last updated in its own turn, says so. A hungry forager asks for what would satiate it: `satiatedAtKcal − energyKcal − its carried food`. If that is not positive it asks for nothing.

- A **keeper** never gives.
- A **sharer** gives to every hungry forager on its tile, the lowest reserve first, then the lowest ID.
- A **reciprocator** gives only to a hungry forager that owes it nothing: one from which it has received at least as much as it has given. A stranger owes nothing, so a reciprocator's first gift to anyone is free; after that, it gives again only once the gift has been returned. It serves those that have given it the most net food first, then the lowest reserve, then the lowest ID.

Each gift is the smaller of what the giver carries and what the recipient asks for. The giver hands over its oldest lots first, and each lot keeps its harvest tick, so it spoils when it would have spoiled with the giver. Both foragers record the gift in their ledgers.

A forager carries food only after eating its fill, so a giver gives away what its body cannot hold at that moment. With durable food it would have eaten that food later; with perishable food, perhaps not.

## Defaults

The canonical world for step 2 is smaller than Life 1's, because every forager walks home each night. Patches hold more, so they can hold a windfall.

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `gridWidth × gridHeight` | 12 × 12 | Life 0's grid; the camp is at (6, 6), at most four hours' walk from any tile |
| `patchCount` | 32 | |
| `patchCapacityKcal`, `initialPatchStockKcal` | 24,000 | Room for four windfalls of 6,000 |
| `hasCamp` | true | |
| `harvestKcal` | 6,000 | An hour of foraging succeeds 1 time in 5 |
| `shelfLifeHours` | 48 | |
| `bandSize` | 12 | |
| `sharers`, `reciprocators` | 4, 4 | And 4 keepers |

Life 1's other defaults are unchanged, including a regrowth of 50 kcal an hour per patch. With steady harvests, a camp band of 12 survives 400 days intact on all 32 prototype seeds, a band of 13 collapses on 10 of them and a band of 14 on all, so 12 is the largest band this land reliably carries without windfalls. Like Life 1's largest intact band, it lies between `Kₛ` and `K`.

`LIFE1_WORLD` is the set of overrides that gives back Life 1: a 24 × 24 grid, 36 patches holding 8,000 kcal, a band of 40, no camp, harvests of 1,200 and no sharers or reciprocators. `LIFE0_WORLD` builds on it as before. Life 0's and Life 1's experiments run on these worlds.

`createLife` also refuses a configuration unless:

- every numeric value is an integer, and `hasCamp` is a boolean;
- `forageKcalPerHour ≤ harvestKcal ≤ patchCapacityKcal`, so that a patch can hold a full harvest;
- `shelfLifeHours ≥ 0`;
- `sharers ≥ 0`, `reciprocators ≥ 0` and `sharers + reciprocators ≤ bandSize`.

The rule that `forageKcalPerHour ≤ patchCapacityKcal` is now implied by the second.

## Invariants

Life 1's invariants still hold, with these changes and additions, checked after every tick:

- **Energy is conserved exactly.** Total patch stock + every reserve + all carried food + all energy metabolized + all food spoiled = total starting stock + every starting reserve + all energy regrown.
- Every carried lot is positive and has not yet reached its spoiling tick. A dead forager carries nothing.
- A forage happened only in daylight, on a patch the forager observed in its own turn holding at least `harvestKcal`. A successful hour took exactly `harvestKcal`; a failed one took nothing.
- Every gift went from a living forager to a hungry living forager on the same tile, was positive, and was no larger than the recipient asked for. Keepers never gave. A reciprocator gave only to a forager that owed it nothing before the gift.
- Ledgers agree: what `i` records as given to `j` equals what `j` records as received from `i`, and the total of all gifts equals the total recorded.
- With a camp, every living forager is on the camp tile at the end of every night hour. (Rule 1 sends it home before dusk; this checks that it gets there.)

## Theory

`theory.ts` keeps Life 1's predictions and adds the risk of windfalls. Let `p = g / H` be the chance an hour of foraging succeeds, where `H` is `harvestKcal`.

- **Bad luck alone.** A lone forager standing on a patch that always holds a full harvest tries every daylight hour once it is hungry. Starting just under `hungryBelowKcal`, it can try `n` times before its reserve runs out, where `n` depends on the hour hunger began; `theory.ts` finds the smallest and largest `n` by stepping through the costs. Each hungry spell ends in starvation with probability `(1 − p)ⁿ`. With the defaults `n` is 37 to 40. A windfall of 6,000 then kills about once in 4,000–8,000 spells, 12,000 about once in 50–70, and 24,000 once in 7–8.
- **Commuting raises the risk.** With a camp, a forager whose patch is `d` tiles away spends `2·ceil(d / v)` daylight hours walking and has that many fewer tries a day. Reported, not tested.
- **When there is surplus.** A forager that first becomes hungry has room for at least `reserveMaxKcal − hungryBelowKcal` (6,000 by default) in its reserve. A smaller windfall is eaten whole unless the forager is still hungry above the threshold. Most gifts therefore need `H` above 6,000.
- **When carried food spoils.** A forager with a full reserve eats what it carries as fast as it burns energy: 60 kcal an hour asleep and 90 resting. Over a shelf life of `S` hours it can therefore use only about `75·S` kcal of what it carries; a keeper's surplus beyond that spoils. With the defaults that is about 3,600 kcal for a 48-hour shelf life and 900 for 12 hours.
- Life 1's carrying capacity `K` and search capacity `Kₛ` still apply: on the canonical world `K ≈ 17.6` and `Kₛ ≈ 8.9`.

### Predictions

First seen in the prototype and confirmed by the experiments, whose numbers are quoted here:

- **Windfalls are deadly even without competition for patches.** A band of keepers that survives intact with steady harvests loses about one forager in eight at 3,600, half at 6,000 and almost all at 9,600 within 400 days.
- **Sharing keeps more of the band alive, and more so the larger the windfall.** Bands of sharers outlive bands of keepers: 6.9 survivors against 5.7 on average at 6,000 with a 48-hour shelf life, and 2.2 against 1.3 at 9,600. Reciprocators fall in between. Under 1% of food is given at 3,600, 4% at 6,000 and 11% at 9,600, so a small flow of food makes the difference.
- **Perishability matters less than expected,** because the body is the main store. With a 12-hour shelf life, a band of keepers loses about 2% of its harvest to spoilage at 6,000 and 8% at 9,600; sharing cuts that by 70–90%. With 48 hours spoilage is about 1% or less.
- **Within a mixed band, no strategy clearly pays.** Keepers receive gifts and give nothing, but they survive at about the same rate as sharers and reciprocators. A sharer gives only food its body cannot hold, so sharing costs it almost nothing, and free riding gains a keeper almost nothing. Sharing helps the band without giving any forager an edge.

They are findings for this world, not theorems.

## Experiments

All experiments are deterministic, run headless in `src/life/experiments.ts`, and check every invariant every hour. Runs last 400 days, or end early once every forager is dead. Seeds are `20260813` followed by `1, 2, 3, …`, as many as each experiment names. To keep the test suite to about a minute and a half, the tests run experiments 3 to 5 on the first 16 seeds and experiment 6 on 8; every tested expectation holds on both.

### 1. Life 1 reproduced

The step's code, with `LIFE1_WORLD`, reproduces Life 1 exactly.

- Checksums of every forager's action and every patch stock in every hour, and of the daily summaries, over 400 days, are compared with checksums recorded from Life 1's code before this step. The configurations are Life 1's band of 10 and band of 40 on two seeds each, and Life 0's world on the seven configurations Life 1 recorded.
- Life 0's and Life 1's experiments still pass, unchanged except that they run on `LIFE0_WORLD` and `LIFE1_WORLD`.

### 2. Bad luck on a single patch

A lone keeper on a one-tile world with no camp and food that keeps. Its patch holds 48,000 kcal and regrows 5,000 an hour, so it always holds a full harvest. Windfalls of 24,000 (`p = 0.05`). 400 seeds.

Expected:

- The share of foraging hours that succeed is within 3 standard errors of `p`.
- The share of hungry spells ending in starvation lies within the theoretical range `(1 − p)^nmax` to `(1 − p)^nmin` (12.9–15.0%), widened by 3 standard errors. Measured: 13.8% of 2,878 spells (standard error 0.6%), with 4.99% of hours succeeding (standard error 0.10%). The prototype had measured 11.8%, with 5.2% of its hours succeeding by chance.

### 3. Windfalls bring risk

Bands of 12 keepers on the canonical world, with windfalls of 1,200 (steady), 3,600, 6,000 and 9,600 kcal at the canonical shelf life of 48 hours. 32 seeds. These are also experiment 4's keeper bands.

Expected:

- With steady harvests the band is intact at day 400 on every seed, and nothing is carried.
- The mean number of survivors falls as the windfall grows. Measured: 12.0, 10.5, 5.7 and 1.3.

### 4. Sharing as insurance

Bands of 12, all keepers, all sharers or all reciprocators, with the same windfalls at the canonical shelf life of 48 hours. 32 seeds.

Expected:

- With steady harvests no food is given.
- At 6,000 and 9,600, bands of sharers have more survivors on average than bands of keepers. Measured: 6.9 against 5.7, and 2.2 against 1.3.
- The share of harvested food that is given rises with the windfall, for sharers and for reciprocators. Measured: 0.7%, 4.4% and 10.5% for sharers, and 0.5%, 3.3% and 7.7% for reciprocators, at 3,600, 6,000 and 9,600.

Reported, not tested: reciprocators' survivors (6.1 and 1.8), and the survivors over time, to show when the deaths happen (design rule 28).

### 5. Perishability

Experiment 4's bands at 9,600, with food that keeps and shelf lives of 48 and 12 hours. 32 seeds.

Expected:

- A band of keepers loses a larger share of its harvest to spoilage the shorter the shelf life. Measured: 0%, 1.1% and 7.5%.
- At each finite shelf life, a band of sharers loses a smaller share than a band of keepers. Measured: 0.1% against 1.1%, and 2.1% against 7.5%.

Reported, not tested: survivors at each shelf life. Sharers kept 2.8, 2.2 and 2.7 alive with food that keeps, lasts 48 hours or lasts 12; keepers 1.1, 1.3 and 1.1.

### 6. Who pays

Mixed bands of 4 keepers, 4 sharers and 4 reciprocators, with windfalls of 3,600, 6,000 and 9,600 and food that keeps, lasts 48 hours or lasts 12. 64 seeds.

Expected: keepers receive gifts and give none.

Reported, not tested: each strategy's share alive at day 400 with its standard error, and the food each strategy gives and receives. No strategy clearly wins. At a 48-hour shelf life, 91% of keepers, 90% of sharers and 90% of reciprocators survived at 3,600; 51%, 50% and 53% at 6,000; and 15%, 12% and 16% at 9,600, with standard errors of 2–3 points. Per forager at 6,000, keepers received 14,300 kcal and gave nothing; sharers gave 30,100 and received 17,600; reciprocators gave 19,700 and received 18,000. The other shelf lives give the same picture.

## Ledger and metrics

- **Events.** Action events add the forage hour's outcome (succeeded or failed), what the forager ate from what it carried, what spoiled, and what it carries afterwards. A new gift event records the tick, the giver, the recipient, the tile, what the recipient asked for and the kilocalories given, and follows the giver's action event. The state keeps the last hour's gifts in `lastGifts`, beside `lastEvents`.
- **Daily summaries** add food given, food spoiled, food carried by the band at the end of the day, and the number alive of each strategy.
- **Totals** add all food spoiled and all food given.

## Observer

The page stays `life.html` and is retitled "Life 2 · sharing".

- **World.** The camp is drawn as a fire on its tile. Foragers sleeping at camp lie around it. A forager carrying food shows a bundle sized by what it carries. A gift is drawn as an arc from giver to recipient during the hour it happens, with a parcel travelling along it. The arc stands on the tile where the gift was made, so a giver walking home is not drawn handing food across the board. Each forager wears its strategy's colour, and the followed forager an accent ring at its feet.
- **Following a forager,** as in Life 1. The HUD adds its strategy, the food it carries and when the oldest lot spoils, and what it has given and received in total.
- **Inspector.** Clicking a patch, as in Life 1.
- **Charts.** The number alive of each strategy each day; and the food given and spoiled each day.
- **Controls.** The setup adds the windfall size, the shelf life (with "keeps" for 0), and the number of sharers and reciprocators; the rest are keepers. The observer always has a camp.
- The page works at 375 px wide.

## Code layout

| File | Change |
| --- | --- |
| `types.ts` | The new configuration, strategies, carried lots, ledgers, gift events and the new summary fields |
| `config.ts` | The new defaults, `LIFE1_WORLD` and the new validation rules |
| `world.ts` | The camp tile, starting at camp, and the luck stream |
| `food.ts` (new) | Carried lots: eating, spoiling, and handing over the oldest first |
| `sharing.ts` (new) | Requests, the three strategies and the ledgers |
| `forager.ts` | The new priority rules and patch choice within reach |
| `engine.ts` | The turn's new phases |
| `invariants.ts` | The new invariants |
| `theory.ts` | The bad-luck range and spoilage estimates |
| `experiments.ts` | Experiments 1 to 6, and Life 0's and Life 1's experiments on their worlds |
| `windfall.test.ts`, `sharing.test.ts`, `spoilage.test.ts` (new) | Experiments 2 to 6 as tests, in their own files so they run in parallel |
| `food.test.ts`, `camp.test.ts`, `giving.test.ts` (new) | Unit tests of carried food and luck, the camp, and giving |
| `src/lifeView/` | The camp, bundles, gifts, strategy colours, the new HUD, charts and setup fields |

`src/sim` is still untouched.

## Tests

- Configuration validation for the new rules.
- Layout: with a camp every forager starts on the camp tile; without one, starting tiles are Life 1's. Strategies follow IDs as specified.
- Luck: deterministic for a seed, hour and forager; a harvest equal to `forageKcalPerHour` always succeeds; a success takes exactly `harvestKcal` and a failure nothing.
- Food: eating takes the oldest lot first and stops when the reserve is full; a lot spoils exactly `shelfLifeHours` after its harvest; a shelf life of 0 never spoils; given lots keep their harvest tick.
- Decisions: heading home leaves exactly enough daylight to arrive by dusk; a forager does not set out for a patch it could not forage and return from in time; every living forager is at camp at night.
- Giving: a keeper never gives; a sharer serves the lowest reserve first; a reciprocator gives a stranger a first gift, refuses a forager that has not returned one, and gives again once it has; a gift never exceeds the request; a forager that is not hungry receives nothing; ledgers on both sides agree.
- Determinism: two runs with the same configuration produce identical events and summaries.
- The expectations of experiments 1 to 6.
- Observer: the camp, a bundle sized by carried food, a gift's arc, strategy colours, the new HUD lines, and the setup's validation of strategy counts.

## Not in step 2

Births and inheritance of strategies; learning or changing strategy; telling others where food is; moving the camp; a shared store at camp; taking food without consent; kin; exchange of different goods; and a second kind of food. Each arrives with the step whose question needs it.

## Documentation on implementation

A changelog entry; a lab-notes entry with the findings of experiments 2 to 6, including the prototype's findings about meeting and windfall size; Life 2 sections in the architecture notes and the validation guide; the README's section updated with a new screenshot; and the merge document's step 2 row marked as settled.

## References

- Axelrod, R. (1984). *The Evolution of Cooperation*. Basic Books.
- Kaplan, H., and Hill, K. (1985). Food sharing among Ache foragers: Tests of explanatory hypotheses. *Current Anthropology*, 26(2), 223–246.
- Trivers, R. L. (1971). The evolution of reciprocal altruism. *The Quarterly Review of Biology*, 46(1), 35–57.
- Winterhalder, B. (1986). Diet choice, risk, and food sharing in a stochastic environment. *Journal of Anthropological Archaeology*, 5(4), 369–392.
