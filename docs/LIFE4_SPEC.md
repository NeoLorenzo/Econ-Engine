# [LIFE4-Practice-034]

Life 4 is step 4 of the bottom-up core described in the [merge document](MERGE.md#the-ladder). The band of [Life 3](LIFE3_SPEC.md) still lives through cold nights on wood and food, and may still swap one for the other. What changes is where skill comes from. In Life 3 each forager was born good or bad at foraging and at gathering wood, and stayed so. Now a forager gets better at what it does and worse at what it stops doing. The canonical band starts out identical.

Everything in Life 3 that this document does not change still holds.

## Question

When skill grows with practice and fades without it, do foragers that start out identical come to specialize, and does any division of work that forms last?

Theory says it can. Adam Smith held that the division of labour comes first and differences in skill follow from it: the porter and the philosopher differ less by nature than by habit (Smith, 1776). Rosen showed that when skill is built by doing, a small early difference repays deepening, so even identical people gain by specializing completely (Rosen, 1983). But Rosen's people choose their careers knowing that practice pays. Life's foragers know nothing of the kind. Each works for what it needs today at the rates it has today, and swaps only when terms it has heard make that quicker. Whether identical foragers drift apart, stay alike, or swap roles back and forth, is the step's finding.

## What the prototype found first

A throwaway prototype of this step, run before this document was written, showed four things that shaped the design and the experiments:

- **Practice alone does not divide work.** Identical foragers with practice but without swaps stay alike. Each spends about a fifth of its working hours on wood, and the gap between the highest and lowest own terms in a band stays under 10%.
- **Practice with exchange does.** With swaps, identical bands split into one or two wood gatherers and foragers who buy from them, in every one of 32 seeds. The first swap comes within 12 to 26 days, from differences that luck in the turn order opens up.
- **Roles are spells, not castes.** The forager that leads wood gathering holds the role for months, then hands it on. How long a role lasts depends on how long skill lasts: with 10 days of memory, roles turn over constantly; with 90 days, they barely change.
- **Starting skill matters little; how long skill is remembered matters a lot.** Starting bands with no practice at all, or with the same hours at both tasks, gave nearly the same results. Changing how many days of work a skill reflects changed whether roles lasted.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| What practice changes | A forager's two rates, for foraging and for gathering wood. Nothing else. | Life 3 already turns rates into specialization through own terms and swaps. Practice only has to change the rates for its effect to show. |
| How skill follows work | A forager's practice at a task is the hours it spent at it over its last `practiceDays` days. Its practice percentage is `practiceMinPercent` with no hours, rising towards `practiceMaxPercent` with more, half way at `practiceHalfHours`. | Learning by doing with diminishing returns, and forgetting by disuse. A window of recent days is easy to state and to check: "it foraged 78 hours in the last 30 days, so it forages at 106%". |
| Born skill and practice | Life 3's drawn skills stay, as born skill. A rate is the base rate times born skill times practice. | One rule covers both a band of equals and Life 3's band of unequals, so the two can be compared. |
| The canonical band | Identical: every born skill is 100%. | The question is whether practice alone divides work. Born differences would answer a different one. |
| Starting practice | Every forager starts with `startPracticeHoursPerDay` hours a day at each task behind it, 2 by default, which puts both skills at exactly 100%. | The band starts at Life 3's equal skills, so any difference that appears comes from what the foragers do in the run. |
| When skill changes | Once a day, at midnight, from the day just ended. Rates are fixed within a day. | A forager's rate for an hour is then known before the hour, and every check of an hour's work uses one rate. |
| Knowledge of skill | A forager knows its current rates, as in Life 3. It does not know that practice will change them. | Design rules 2 and 10: it compares the rates it has today with terms it has heard. Nothing tells it that specializing would pay later. |
| Everything else | Life 3's rules for choosing work, swapping and telling terms are unchanged. | The step adds one thing (design rule 12). |
| Life 3 | Reproduced bit for bit with practice off and Life 3's spread of born skills | It makes the generalization a verifiable refactor. |

## World

The world is Life 3's: patches, groves, a camp, cold nights.

### Born skills

As in Life 3: each forager's foraging and wood skills, now called born skills, are drawn from their own stream between `skillMinPercent` and `skillMaxPercent`. In the canonical band both bounds are 100, so every forager is born the same.

### Practice

Each forager keeps a practice log: for each of the two tasks, the hours it spent at it on each of its last `practiceDays` days, oldest first. At tick 0 every entry is `startPracticeHoursPerDay`.

A forager's practice at a task is the sum of that task's log, `h` hours. Its practice percentage is

`P(h) = practiceMinPercent + floor((practiceMaxPercent − practiceMinPercent) · h / (h + practiceHalfHours))`.

With practice on, forager `i`'s rates are

- `gᵢ = floor(forageKcalPerHour · foragingSkill · P(foraging hours) / 10,000)` kilocalories an hour;
- `wᵢ = floor(woodPerHour · woodSkill · P(gathering hours) / 10,000)` units an hour.

With practice off they are Life 3's: `floor(forageKcalPerHour · foragingSkill / 100)` and `floor(woodPerHour · woodSkill / 100)`. With a practice percentage of 100 the two agree.

The canonical defaults give these practice percentages:

| Hours a day at a task, over 30 days | 0 | 0.5 | 1 | 2 | 3 | 4 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Practice percentage | 50 | 70 | 83 | 100 | 110 | 116 | 125 |

### The luck stream

As in Life 3, with the forager's rate for the day. Its harvest is `Hᵢ = max(harvestKcal, gᵢ)`.

## The forager

A forager keeps Life 3's state and adds:

| State | Meaning |
| --- | --- |
| `foragingSkill`, `woodSkill` | Its born skills, in percent |
| `practiceLog` | Its hours foraging and gathering on each of its last `practiceDays` days, oldest first |
| `hoursToday` | Its hours foraging and gathering since midnight |

`forageRate` and `woodRate` remain, and now change at midnight. A dead forager's log and rates stay as they were when it died.

## Hourly step

Each tick runs Life 3's phases, with one new phase first:

0. **Practice.** In the first hour of every day after the first, each living forager adds yesterday's hours at each task to its log, drops the oldest day, sets its rates from the log, and starts `hoursToday` again from zero.

Then regrowth, the turn order, each living forager's turn and the record, as in Life 3. In a turn, an hour of foraging or gathering adds one to that task's `hoursToday`.

Decisions, swaps, telling terms, eating and metabolism are all Life 3's, with the day's rates.

## Defaults

The canonical world for step 4 is Life 3's with the band born equal and practice on.

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `skillMinPercent`, `skillMaxPercent` | 100, 100 | Every forager born the same |
| `practice` | true | |
| `practiceDays` | 30 | Skill reflects the last month's work |
| `practiceHalfHours` | 60 | Two hours a day keeps a skill at 100% |
| `practiceMinPercent`, `practiceMaxPercent` | 50, 150 | Life 3's range of skill: foraging 600–1,800 kcal an hour, wood 12–36 units |
| `startPracticeHoursPerDay` | 2 | Both skills start at 100% |

Life 3's other defaults are unchanged, including the band of 8 keepers, `harvestKcal` of 600 (still the lowest possible foraging rate, so every harvest is steady), swapping and telling terms.

`LIFE3_WORLD` is the set of overrides that gives back Life 3: born skills from 50% to 150% and practice off. `LIFE2_WORLD`, `LIFE1_WORLD` and `LIFE0_WORLD` now build on it.

`createLife` refuses a configuration unless, in addition to Life 3's rules:

- `practice` is a boolean;
- `practiceDays ≥ 1`, `practiceHalfHours ≥ 1` and `0 ≤ startPracticeHoursPerDay ≤ 24`;
- `1 ≤ practiceMinPercent ≤ practiceMaxPercent`;
- with practice on, Life 3's rules on the lowest and largest rates hold with the practice range included: `floor(forageKcalPerHour · skillMinPercent · practiceMinPercent / 10,000) ≥ 1`, the same for wood, a patch can hold the largest harvest at `skillMaxPercent · practiceMaxPercent`, and a grove the largest hour of gathering.

## Invariants

Life 3's invariants still hold, checked after every tick, with these additions:

- Every forager's practice log holds exactly `practiceDays` entries per task, each a whole number from 0 to 24, and its `hoursToday` are whole numbers that sum to at most the hours of the day so far.
- Every living forager's rates are the ones its born skills and log give, by the formula above; with practice off, Life 3's.
- Rates change only in the first hour of a day.
- A forager's total hours at a task since tick 0 equal the hours it has added to its log since tick 0 plus its `hoursToday`, so no hour is lost or invented between the day it was worked and the log that remembers it.

## Theory

`theory.ts` keeps Life 3's predictions and adds:

- **Practice that changes nothing changes nothing.** With `practiceMinPercent = practiceMaxPercent = 100`, every rate equals Life 3's, and the run is identical to one with practice off.
- **Steady practice.** A forager that works `d` hours a day at a task, every day, settles at `P(practiceDays · d)`. The table under [Practice](#practice) gives the canonical values.
- **Practice alone makes everyone alike, and worse at wood.** Without exchange, a forager spends its hours as Life 3's autarky rule says: mostly foraging, under an hour a day on wood. Its skills settle where those hours put them, about 106% at foraging and 75% at wood, so its own terms rise from 50 to about 70 kcal a unit. Every forager in an equal band faces the same land and rules, so all settle alike, apart from luck in the turn order. Practice without exchange is expected to leave the band undivided.
- **Exchange makes practice self-reinforcing.** A forager that sells wood gathers more, so its wood skill rises and its foraging skill falls; its own terms fall, and selling pays more. A forager that buys wood gathers less and forages more, and its own terms rise, so buying pays more. Any gap between two foragers' own terms therefore tends to widen once they swap. This is Rosen's increasing returns, reached without foresight.
- **No first difference, no first swap.** As in Life 3, foragers with equal own terms cannot swap or quote. In an equal band, the first swap waits for practice to open a gap wide enough that the rounded-down midpoint lies strictly between two foragers' own terms. With `quotes` off and steady harvests, Life 3's theorem still holds: no swap ever happens, and the run is identical to one without swapping.
- **Memory sets how long a role lasts.** A skill reflects only the last `practiceDays` days. A forager that stops gathering for that long loses its whole advantage, and one that starts can build one in as long. Longer memory should make roles last longer, and shorter memory make them turn over faster.

### Predictions

First seen in the prototype and confirmed by the experiments, whose numbers are quoted here, on 32 seeds and the canonical world unless stated. The prototype's numbers were the same to the last digit quoted.

- **Practice alone does not divide work.** Without swaps, every forager in an equal band spends 20% to 21% of its working hours on wood, and the highest own terms in a band are within 8% of the lowest at day 100. Practice settles foraging at about 106% and wood at about 75% for everyone. Cold nights fall from 11% of night hours without practice to 3%, probably because faster foraging leaves more daylight for wood; this has not been traced.
- **Practice with exchange does.** With swaps, every band divides. The first swap comes on day 16 on average (12 to 26). By day 100 the highest own terms in a band are 1.9 times the lowest. The two foragers that gather the most bring in 53% of the band's wood, against 25% without swaps; the keenest gatherer spends 41% of its working hours on wood and the least keen 7%, and 39% of the wood burned has been bought. Every forager survives either way.
- **Exchange still has its cost.** As in Life 3, swapping raises cold nights, from 3% of night hours to 15%, and lowers working hours only slightly, from 3.24 to 3.18 a day.
- **Roles are spells.** Over days 41 to 400, split into nine 40-day windows, 2.2 different foragers lead wood gathering on average. Across a band, the correlation between a forager's wood share over days 21–210 and over days 211–400 is 0.67.
- **Memory decides whether roles last.** With 10 days of memory (and `practiceHalfHours` 20, so skills still start at 100%), 4.8 different foragers lead, the correlation between halves is 0.10, and the top two gather 37% of the wood. With 90 days (`practiceHalfHours` 180), 1.2 lead, the correlation is 0.96, and the top two gather 57%. The first swap then waits longer, until day 32 on average.
- **How much practice matters sets the depth, not the split.** With practice from 80% to 120%, the top two still gather 51% of the wood, but own terms spread only 1.24 times by day 100, and the first swap waits longer: day 29 on average, and as late as day 82. From 25% to 175%, they spread 3.1 times, with the top two at 52%.
- **Practice on top of born differences.** In Life 3's band, born from 50% to 150%, practice keeps specialization aligned with born advantage (the correlation between born own terms and wood share is −0.83 with practice and −0.78 without), widens own terms from 3.7 times to 5.8 times by day 100, and keeps more alive: 7.94 against 7.50, and 98% of the least skilled third against 80%. But wood is less concentrated, the top two gathering 61% against 69%. Most of the survival gain is not specialization: without swaps, practice raises survivors from 6.88 to 7.75, because every forager gets better at foraging, the task it does most.

They are findings for this world, not theorems.

## Experiments

All experiments are deterministic, run headless in `src/life/experiments.ts`, and check every invariant every hour. Runs last 400 days, or end early once every forager is dead. Seeds are `20260813` followed by `1, 2, 3, …`, as many as each experiment names. Measures over a run use days 21 to 400, as in Life 3. The tests run experiments on 16 seeds where the experiment names 32, and every tested expectation must hold on both.

Life 3's measures stay: wood share, concentration, the share of wood bought, cold nights, hours of work and walking. Step 4 adds:

- the **spread of own terms**, the highest own terms among living foragers divided by the lowest, at days 20, 100 and 400;
- the **first swap**, the day of a run's first swap;
- the **lead gatherer** of each 40-day window from day 41, the forager that gathered the most wood in it, and the number of different lead gatherers over the nine windows;
- **persistence**, the correlation across a band between each forager's wood share over days 21 to 210 and over days 211 to 400, averaged over runs.

### 1. Life 3 reproduced

The step's code, with `LIFE3_WORLD`, reproduces Life 3 exactly.

- Hourly checksums over 400 days are compared with checksums recorded from Life 3's code before this step, for Life 3's canonical band on two seeds and with swapping off on one.
- Life 0's to Life 3's experiments still pass, unchanged except that they run on their worlds.
- An equal band with `practiceMinPercent = practiceMaxPercent = 100` is identical, hour by hour, to the same band with practice off.

### 2. Practice alone

Equal bands with practice on and swapping off. 32 seeds.

Expected:

- No swap or quote happens.
- In every run, the highest wood share in the band is within 0.05 of the lowest, and the spread of own terms at day 100 is below 1.25.
- The band is intact at day 400 on every seed.

Reported: each forager's settled rates against the steady-practice prediction, and cold nights against the band without practice.

### 3. Practice and exchange

Equal bands with practice on, with swapping on and off, and with swapping on but `quotes` off; and with practice off and swapping on. 32 seeds.

Expected:

- With practice off, no swap happens, as in Life 3's experiment 2.
- With `quotes` off, no swap happens, and every run is identical to the run with swapping off.
- With practice and swaps, every run swaps, the first swap comes within 30 days, the spread of own terms at day 100 is above 1.3, and the top two gatherers bring in more than 40% of the band's wood, against at most 30% without swaps. In the prototype the lowest of these across 32 seeds were a spread of 1.45 and a share of 47%, against at most 26% without swaps.

Reported: survivors over time (design rule 28), swaps per day, cold nights, hours of work and walking, the lead gatherers and persistence.

### 4. How long skill lasts

Experiment 3's band with practice and swaps, with `practiceDays` of 10, 30 and 90 and `practiceHalfHours` of 20, 60 and 180, so that skills always start at 100%. 32 seeds.

Expected:

- Every band divides at every memory length: every run swaps, and the top two bring in more than 30% of the wood, against 25% to 26% without swaps. In the prototype the lowest was 32%, with 10 days of memory.
- Mean persistence rises with memory, and the mean number of different lead gatherers falls.

Reported: the first swap, concentration and persistence at each length.

### 5. How much practice matters

Experiment 3's band with practice and swaps, with practice from 80% to 120%, 50% to 150% and 25% to 175%. 32 seeds.

Expected:

- Every band divides at every range: every run swaps, and the top two bring in more than 30% of the wood.
- The mean spread of own terms at day 100 rises with the range.

Reported: concentration, hours of work and survivors at each range.

### 6. Practice and born differences

Life 3's band, born from 50% to 150%, with practice off and on, and with swapping off and on. 32 seeds.

Expected:

- With swaps, the correlation between born own terms and wood share is negative with practice as without it.
- With swaps, the spread of own terms at day 100 is wider with practice.
- With swaps, at least as many survive with practice as without.

Reported: concentration, the least skilled third's survival, and the same measures without swaps, to separate what practice does through specialization from what it does by making everyone better at foraging.

## Ledger and metrics

- **Events.** A new practice event, in the first hour of each day, records for each living forager the hours added to its log, its practice at each task, and its rates before and after. The invariants check the rates against it. The log is kept, and the events recorded, with practice off too; the rates then never change. Practice events go to `lastPractice` and open each day's events.
- **Daily summaries** add each forager's rates during the day, which the observer's chart of own terms reads.
- **Totals** are Life 3's.

## Observer

The page stays `life.html` and is retitled "Life 4 · practice".

- **Colour.** As in Life 3, each forager is coloured by its own terms, now on a log scale over the range born skill and practice allow. In an equal band they all start the same colour and drift apart as roles form, so the division of work shows on the land.
- **Following a forager.** The HUD shows its two skills as practice percentages with the hours behind them ("106% from 78 h in 30 days"), beside its rates, and how each changed at the last midnight.
- **Charts.** A new chart of own terms over time: the highest and lowest in the band each day, and the followed forager's. In an equal band the three start as one line and fan out as the band divides. (The draft planned a line per forager; three lines say the same and stay readable for a band of 100.) Life 3's charts stay: wood share against own terms, now over the range born skill and practice allow, wood swapped, cold nights and foragers alive, and the followed forager's reserve.
- **Controls.** The setup adds a switch for practice, the memory in days, and the practice range.
- The page works at 375 px wide.

## Code layout

| File | Change |
| --- | --- |
| `types.ts` | The new configuration, born skills, the practice log, hours today, the practice event and the rates in daily summaries |
| `config.ts` | The new defaults, `LIFE3_WORLD` and the new validation rules |
| `practice.ts` (new) | The practice percentage, rates from born skill and practice, and the midnight update |
| `world.ts` | Born skills from the skill stream, in place of fixed rates |
| `engine.ts` | The practice phase and counting hours today |
| `invariants.ts` | The new invariants |
| `theory.ts` | Steady practice and the autarky skills |
| `experiments.ts` | Experiments 1 to 6, and the earlier experiments on their worlds |
| `practice.test.ts` (new) | Unit tests of practice and rates; experiment 2 |
| `division.test.ts`, `memory.test.ts`, `born.test.ts` (new) | Experiments 3 and 5, 4, and 6 as tests, in their own files so they run in parallel |
| `src/lifeView/` | Skills in the HUD, the chart of own terms over time, and the setup fields |

`src/sim` is still untouched.

## Tests

- Configuration validation for the new rules.
- Practice: the percentage at 0 hours, at `practiceHalfHours` and far beyond; the starting log gives 100%; rates from born skill and practice, rounded down; the same rates as Life 3 at a practice percentage of 100.
- The midnight update: yesterday's hours enter the log, the oldest day drops out, rates change only then, dead foragers are left alone, and `hoursToday` restarts.
- The invariants catch a rate that does not match the log, a rate changed mid-day, and an hour missing from the log.
- Determinism: two runs with the same configuration produce identical events and summaries.
- The expectations of experiments 1 to 6.
- Observer: skills and hours in the HUD, the chart of own terms over time, and the setup's validation of the practice fields.

## Not in step 4

Tools, recipes and shelter, which are the next step; foragers that choose to specialize knowing practice will pay; learning from others or teaching; Smith's time lost passing from one task to another; ageing and skill lost to age; a third good; and a market or posted price. Each arrives with the step whose question needs it.

## Documentation on implementation

A changelog entry; a lab-notes entry with the findings of experiments 2 to 6 and the prototype's findings about memory; Life 4 sections in the architecture notes and the validation guide; the README's section updated with a new screenshot; and the merge document's ladder updated: step 4 becomes "Practice", a new step 5, "Tools and shelter", takes recipes, tools and shelter, and later steps move down by one.

## References

- Rosen, S. (1983). Specialization and human capital. *Journal of Labor Economics*, 1(1), 43–49.
- Smith, A. (1776). *An Inquiry into the Nature and Causes of the Wealth of Nations*. W. Strahan and T. Cadell. Book I, chapter II.
