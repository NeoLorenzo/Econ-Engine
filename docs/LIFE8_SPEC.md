# [LIFE8-SharedFire-038]

Life 8 is the bottom-up core described in the [merge document](MERGE.md#the-ladder), and the only version of it in the repository. Earlier steps built it one mechanism at a time; update 039 removed them, and this document describes the whole simulation as it stands.

A band of foragers lives in a small valley, simulated minute by minute in whole centimetres, kilocalories and kilograms. They pick berries bush by bush and gather deadwood under trees, eat, carry food that spoils, burn wood against cold nights, swap wood for food, and get better at what they practise. They start scattered and know only what they have seen. By day they see across the valley, and they check the thickets and stands they know when their needs are met. A load slows them down, and they take a full load home before anything else. Those without a group look for company; two who meet found a group and plant a flag, and anyone who meets a member joins. Each group keeps one fire at its flag, which warms every member asleep around it, whoever fed it. Members put wood into it, and it goes out when it runs dry.

## Question

Who feeds a fire that warms everyone at it?

It could go either way. Each member feeds the fire from its own wood, and is warm whether or not it gave. Members who happen to be at home when the fire runs low could end up feeding it for everyone, while those who come home late are warmed for nothing. The cost could also spread evenly, because whoever gives today runs short and gathers, and comes home tomorrow with wood to spare. And a fire shared by a group needs far less wood than one fire per member, so the shared fire could make wood so plentiful that exchange disappears.

## What the prototype found first

A throwaway prototype, a copy of the valley core with the rules below, run on 32 seeds over 400 days before the shared fire was built, showed four things that shaped the design. "Own fires" means every forager keeping its own fire, as before the shared fire.

- **Everyone feeds the fire, roughly in proportion to what they gather.** No member gave less than a quarter of an even share. A group's most generous member gave 1.11 times an even share in scattered groups and 1.38 times in a band that starts as one group. Because a member's wood goes nowhere but into the fire or a swap, what it gives is almost exactly what it gathers.
- **One fire per group needs far less wood.** With the shared fire burning a kilogram an hour, the same as one hearth fire, members burned 4.0 kg of wood a day each against 11.7 with own fires, and spent 0.28 hours a day gathering against 0.66. In a band of 8 that starts as one group they burned 1.5 kg and gathered for 0.12 hours.
- **Exchange disappears, because spare wood goes into the fire.** Members bought under 0.1% of the wood they burned, against 9.5% with own fires. It is not that wood became plentiful: with a fire that burns a kilogram an hour for every member, as much wood as own fires, members still bought only 0.1%. Spare wood goes into the fire as soon as its gatherer is home, so no member holds wood to sell. With the rule that a member gives only when the fire is low, members kept their spare wood and bought 16.1% of what they burned.
- **The fire rarely goes out.** Fires were lit for 97% of night hours, and once lit almost never went out for want of wood. The dark hours came in the first nights, before members had gathered any wood.

The implementation confirmed all four, with the prototype's numbers: it implements the same rules. Its experiments measure the share of wood bought over all the wood a configuration burns, rather than averaging each run's share as the prototype did, so members who give only to a low fire buy 15.4% rather than 16.1%.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| One fire per group | Each standing group has a **fire** at its flag's point; its members' hearths lie on a spiral round it. Members keep no fires of their own. A forager without a group keeps its own hearth fire. | The owner's rule. A fire belongs to the group that sleeps around it. A forager without a group has no one to share with, and would otherwise sleep cold until it meets someone. |
| How much a fire burns | `campfireWoodPerHour`, 1 kg in every night hour, however many members sleep at it. | A fire is a fire: a forager's own fire burns a kilogram an hour, and one fire of that size is what the group keeps. This is the main economy, and the experiments vary it: a fire of 2 kg an hour, and one that burns a kilogram an hour for every living member, which saves no wood at all. |
| Who is warmed | A member sleeping at its hearth in an hour when its group's fire is lit sleeps warm, whether or not it gave. | The owner's rule: the fire warms everyone at it. Sleep happens only at a forager's hearth, so every sleeping member is at the fire. |
| Burning | At the start of every night hour, before turns, each standing group's fire burns `campfireWoodPerHour` if it holds that much, and is lit for the hour. Otherwise it burns nothing and is **out** for the hour. | Deciding before turns means every member asleep in that hour knows whether it is warm. |
| Going out and relighting | A fire that holds less than an hour's wood at the start of a night hour is out. It is relit, at no cost, at the start of the next night hour at which it holds an hour's wood. | The owner's rule: a dead fire must be relit, at no extra cost. Wood left in a fire that is out stays there, so every kilogram is accounted for. |
| Feeding | In its turn, after swapping, a member standing at its hearth puts into the fire its **spare** wood, everything above its target of `woodStockNights` nights. If the fire is **low**, holding less than it will burn in the rest of the night, or by day in a whole night, the member also gives from its stock, up to what the fire lacks or all it holds. Members feed awake or asleep. | The owner's rule: a member adds wood if it has spare wood or the fire is low. Feeding at the hearth means a member feeds only the fire it is at. A sleeper wakes enough to put a log on a dying fire. |
| What a member keeps | A member is short of wood below one night's wood and gathers until it holds `woodStockNights` nights' worth. Its stock is its reserve for the fire. | It gives the rule for a low fire something to draw on. A member's stock falls only when it feeds a low fire or sells. |
| Swaps | A member short of wood may buy from one with spare, within its group. Swaps come before feeding in a turn. | Swapping first lets a member sell spare wood before it puts it into the fire, if anyone nearby wants it. |
| A group that dissolves | Its survivor takes back the wood left in the fire, and keeps its own fire again. If no member survives, the wood stays in the cold fire. | A group of one is not a group, and its fire becomes the survivor's hearth fire. Every kilogram is accounted for. |
| What each member gave | The group records the wood each member has put into its fire, and each forager the wood it has put into any fire. | The owner asked to see who contributes. Contributions are what the question asks about, so they are measured, not inferred. |
| Food | Nothing in the valley gives food away, so no member contributes food to the group. The group card shows the food each member paid or received for wood in swaps within the group. | Showing swaps keeps the food side visible without inventing a transfer. |
| Counterfactuals | Four switches: `scattered`, `sharedFire`, `campfirePerMember` and `feedSpare`. | Each gives one experiment its comparison. Everything else in the valley is fixed. |

## World

The valley is a square `valleySizeCm` wide. Everything is drawn from the layout stream, seeded from the run seed and the layout salt with `mixSeed`; every draw is `randomInt` over whole centimetres.

1. **Sites.** Site centres are drawn uniformly over the valley, at least `siteMarginCm` from its edges. A draw is rejected if it lies within `campClearingCm` of the camp, the valley's centre, or within `siteSpacingCm` of an earlier centre. The first `thicketCount` centres are thickets and the next `standCount` are stands, with IDs from 0 in draw order.
2. **Bushes.** For each thicket in turn, bushes are drawn uniformly in the square around its centre and kept if they lie within `thicketRadiusCm` of it and at least `bushSpacingCm` from the thicket's earlier bushes, until it has `bushesPerThicket`. Bush IDs run from 0 across thickets in order.
3. **Trees.** The same for each stand, with `standRadiusCm`, `treeSpacingCm` and `treesPerStand`.
4. **Starts.** With `scattered` on, each forager's start, which is its first hearth, is drawn from a start stream of its own, uniformly over the valley in forager ID order, rejecting a draw within `startSpacingCm` of an earlier start. With it off, the band starts as one group, its flag at the camp and its hearths on the square spiral round it.

A bush holds up to `bushCapacityKcal` of berries and a tree up to `treeCapacityWood` of deadwood; each regrows its share of a day's regrowth in the first minute of every hour, up to capacity. `createValley` refuses a configuration whose layout or starts cannot be drawn in 10,000 draws.

**Places.** Place `p` covers column `p mod n` and row `floor(p / n)`, where `n = ceil(valleySizeCm / placeCm)`: a square `placeCm` wide, cut at the valley's edge. A place lies wholly within sight when all four of its corners do.

**Skills.** Each forager's born foraging and wood skills are drawn from the skill stream, uniformly from `skillMinPercent` to `skillMaxPercent`. Its rates for a day are the base rate times born skill times practice, rounded down. Its practice at a task is the seconds `s` it spent at it over its last `practiceDays` days, giving

`P(s) = practiceMinPercent + floor((practiceMaxPercent − practiceMinPercent) · s / (s + 3,600 · practiceHalfHours))`.

Every day of the starting log holds `3,600 · startPracticeHoursPerDay` seconds at each task.

## The forager

| State | Meaning |
| --- | --- |
| `x`, `y`, `hearth` | Its position and its hearth, in whole centimetres |
| `energyKcal`, `hungry` | Its reserve, and hunger with hysteresis: hungry below `hungryBelowKcal`, until it reaches `satiatedAtKcal` |
| `carried` | Food it carries, as lots picked in one minute, oldest first; a lot picked `shelfLifeHours` ago spoils |
| `wood`, `shortOfWood`, `tripWood` | Wood it holds, wood need with hysteresis, and wood gathered since it last stood at its hearth |
| `bushMemory`, `treeMemory` | For each plant, the stock it last saw there and the minute, or never |
| `placeSeen`, `siteKnown`, `siteChecked` | For each place, the first minute it lay wholly in sight; for each thicket and stand, whether it has spotted it and the last minute it checked it |
| `groupId`, `knownFlags`, `exploreTarget` | Its group, the flags it has seen and not since found gone, and the place it is walking to |
| `practiceLog`, rates | Its seconds at each task on each of its last `practiceDays` days, and its rates for the day |
| `heardTerms`, `trip` | The last terms it heard, remembered for `termsMemoryHours`, and a trip to gather wood to sell |
| remainders, `fireHour`, `warm` | Remainders in 3,600ths of picking, gathering and energy owed; its own fire's hour and warmth |
| `fireGiven`, `warmByFireMinutes` | The wood it has put into any group's fire, and the minutes it has slept warm by one |

A forager starts at its hearth with `initialReserveKcal`, nothing carried, no wood, and having seen nothing.

A group has an ID from 0 in order of founding, a flag, the minute it was founded and dissolved, its members in order of joining (member `i` sleeps on slot `i` of the spiral round the flag, `hearthSpacingCm` apart), and its fire: `fireWood`, `fireLit`, the wood each member has `given`, and the wood burned and night hours lit and out.

## The minute

Each minute runs these phases in order.

0. **Practice.** In the first minute of every day after the first, each living forager enters yesterday's seconds in its log, drops the oldest day, and takes its rates for the day.
1. **Regrowth.** In the first minute of every hour after minute 0.
2. **Fires.** At the start of every hour: if it is night, each standing group's fire burns `campfireWoodPerHour` (or that for each living member, with `campfirePerMember`) and is lit if it holds that much, and is out otherwise. By day every fire is unlit.
3. **Turn order.** A seeded shuffle of the band, from a stream derived from the run seed and the minute.
4. **Turns.** Each living forager in that order:
   1. **Spoilage** and **eating** from what it carries, oldest first, up to the room in its reserve.
   2. **Observation.** It records the stock of every bush and tree within close sight, `perceptionRadiusCm`. Its long sight is `sightRadiusCm` by day and close sight at night: within it, it spots every site and marks every place never seen before as seen, learns every standing flag and forgets every known flag whose spot holds none. It checks every site whose centre lies within `perceptionRadiusCm` less the site's radius.
   3. **Decision.** Hunger and wood need are updated; then the first rule that applies (see [Rules](#rules)). Its speed this minute is set by the load it carries as it sets out.
   4. **Action.** The minute's 60 seconds.
   5. **Meeting.** A forager without a group meets the nearest living forager within `talkRadiusCm`, if any: it joins a member's group, taking the next slot round its flag, or the two found a new group with the flag at their midpoint.
   6. **Exchange.** Swaps and quotes with members of its own group within `talkRadiusCm`.
   7. **Feeding.** A member at its hearth feeds its group's fire.
   8. **Eating again** and **metabolism.** Each second's hourly cost is added to its cost remainder and the whole kilocalories are paid. At 0 it dies of starvation; if that leaves its group with one living member or none, the group dissolves, and its survivor takes back the fire's wood.
5. **Record.** Events, the day's summary, and the invariants.

### Rules

Let `D` be the daylight seconds left in the minute, 0 at night. A forager's speed under a load of `L` kilograms, its trip's wood and its berries at `berryKcalPerKg`, is `floor(walkCmPerSecond · bodyKg / (bodyKg + L))` centimetres a second; each second of walking costs `travelKcalPerHour` whatever the load. A plant or point can be reached in time if walking there, a minute's work at a plant, and walking home take at most `D` seconds.

| Priority | Condition | Action | Reason recorded |
| --- | --- | --- | --- |
| 1 | Away from its hearth, and it is night or walking home takes at least `D` | Walk home | `going home` |
| 2 | It is night | Sleep | `night` |
| 3 | Not hungry, and filling a load: `0 < tripWood < woodLoad` | Work for wood | `filling a load` |
| 4 | Not hungry, and carrying a full load | Walk home | `taking a load home` |
| 5 | Neither hungry nor short of wood, and without a group | Walk towards the nearest forager it sees, or to its nearest known flag it can reach and return from before dusk, or explore | `seeking company`, or `waiting for company` at the flag |
| 6 | Neither hungry nor short of wood, and somewhere to explore | Walk towards the nearest place never seen, or else to the nearest site not checked for `exploreAfterHours` | `exploring` or `checking` |
| 7 | Neither hungry nor short of wood | Rest | `satiated` |
| 8 | The choice of work says wait | Rest | `waiting to swap` |
| 9 | It remembers no plant of the good worth a minute's work that it can reach in time, and knows a site of that kind it has never checked, or a place it has never seen, that it can reach and return from before dusk | Walk towards the nearest such site, or else the nearest such place | `searching` |
| 10 | No plant of the good that it can reach in time | Rest | `too late to set out` or `waiting for regrowth` |
| 11 | Otherwise | Work at its target plant, walking to it first if needed | `foraging`, `gathering`, `seeking food` or `seeking wood` |

**The choice of work.** A hungry forager works for food, unless terms it remembers make selling wood pay, when it gathers wood to sell enough for the food it lacks. A forager short of wood gathers wood, unless terms it remembers make buying pay, when it picks food to buy wood with, or waits if it already carries enough. A forager's own terms are its foraging rate over its wood rate.

**The target plant.** It keeps its target unless it has just seen the plant holding less than a minute's work, `ceil(rate / 60)`, or can no longer reach it in time. Otherwise it chooses the nearest plant it remembers holding a minute's work, ties to the lowest ID; and, with nothing left to search, the one it saw longest ago.

**Swaps.** Two members within talking distance swap when one has spare wood and the other wants wood, each at terms that pay it: the midpoint of their own terms, as whole kilocalories a kilogram. The amount is the least of the seller's spare wood, the buyer's wanted wood, what the buyer's carried food can pay for, and what the seller has room to eat. When nothing can change hands, they tell each other the terms, and every member within talking distance of a swap hears its terms.

### The 60 seconds

A forager walks towards its hearth, a place or site, another forager, or a point `reachCm` short of its plant, at its speed, and arrives within the minute if it can. Having arrived at a plant holding a minute's work, it works the seconds left: its remainder for the task grows by its hourly rate times the seconds, and it takes the whole units. Picked food is eaten until the reserve is full and the rest carried; gathered wood adds to its wood and its trip. Otherwise it stands. Asleep, a member is warm if its group's fire is lit; a forager without a group burns `fireWoodPerHour` at the start of each hour it sleeps if it holds that much, and sleeps cold otherwise. Picking and gathering cost `forageCostKcalPerHour`, walking `travelKcalPerHour`, standing `restKcalPerHour`, and sleeping `sleepKcalPerHour`, or `coldSleepKcalPerHour` in a cold hour.

## Defaults

| Parameter | Canonical value | Parameter | Canonical value |
| --- | --- | --- | --- |
| `valleySizeCm` | 60,000 | `bandSize` | 8 |
| `thicketCount`, `bushesPerThicket` | 32, 60 | `shelfLifeHours` | 48 |
| `thicketRadiusCm`, `bushSpacingCm` | 1,200, 200 | `fireWoodPerHour`, `coldSleepKcalPerHour` | 1, 150 |
| `bushCapacityKcal`, `bushRegrowthKcalPerDay` | 400, 20 | `woodStockNights`, `woodLoad` | 2, 30 |
| `standCount`, `treesPerStand` | 8, 8 | `skillMinPercent`, `skillMaxPercent` | 100, 100 |
| `standRadiusCm`, `treeSpacingCm` | 1,500, 400 | `termsMemoryHours` | 24 |
| `treeCapacityWood`, `treeRegrowthWoodPerDay` | 25, 6 | `practiceDays`, `practiceHalfHours` | 30, 60 |
| `siteSpacingCm`, `siteMarginCm`, `campClearingCm` | 5,000, 3,000, 4,000 | `practiceMinPercent`, `practiceMaxPercent` | 50, 150 |
| `hearthSpacingCm`, `walkCmPerSecond`, `reachCm` | 300, 125, 100 | `startPracticeHoursPerDay` | 2 |
| `perceptionRadiusCm`, `talkRadiusCm`, `sightRadiusCm` | 2,500, 2,000, 100,000 | `scattered` | true |
| `dawnHour`, `duskHour` | 6, 18 | `startSpacingCm`, `placeCm` | 5,000, 3,000 |
| `forageKcalPerHour`, `woodPerHour` | 1,200, 24 | `exploreAfterHours` | 24 |
| `sleepKcalPerHour`, `restKcalPerHour` | 60, 90 | `bodyKg`, `berryKcalPerKg` | 60, 500 |
| `forageCostKcalPerHour`, `travelKcalPerHour` | 300, 300 | `sharedFire` | true |
| `reserveMaxKcal`, `initialReserveKcal` | 20,000, 16,000 | `campfireWoodPerHour` | 1 |
| `hungryBelowKcal`, `satiatedAtKcal` | 14,000, 18,000 | `campfirePerMember`, `feedSpare` | false, true |

`createValley` refuses a configuration with a value that is not an integer or a switch that is not a boolean; sizes, counts, rates and radii that are not positive, or amounts that are negative; a reach as long as close sight; starting stocks above capacity; hours, hunger thresholds or costs out of order; skill or practice ranges out of order, or rates that round to nothing or exceed what a plant holds in a minute; a band around the camp whose hearths would not fit in its clearing, or of fewer than two; a place too large to see whole from its centre; long sight shorter than close sight; and a site too wide to check from inside close sight.

## Invariants

Checked after every minute of every test and experiment run, by `src/valley/invariants.ts`:

- **Energy and wood are conserved exactly.** Bush stock, reserves, carried food, food eaten and spoiled equal the food at minute 0 plus regrowth. Wood on trees, held by foragers and in fires, plus wood burned, equals the wood at minute 0 plus regrowth. Every plant's stock is replayed from regrowth and recorded work.
- One turn per living forager each minute; its seconds add up to 60; it moves no further than its walking seconds at the speed its recorded load allows, and its load is no more than the wood of its trip.
- Work only in daylight, on a plant within reach holding a minute's work; memory of the plant worked or targeted, and every hour of everything in view, matches what it saw.
- Places first marked seen lie wholly within sight; every site within sight is known, and checked exactly when the forager stood close enough; a walk to a place or site aims at one worth it and ends no further from it.
- A forager not hungry with a full load never idles, explores, checks or seeks company, and only one with a full load takes it home, towards the hearth it had while it acted.
- Groups, replayed through each minute's foundings, joinings and dissolutions in turn order: each forager without a group meets the nearest forager within talking distance; flags lie at the founders' midpoint and hearths on their slots; no group stands with fewer than two living members; swaps, quotes and terms stay within a group.
- A fire burns only at the start of a night hour, exactly its hour's wood and only if it held that much, and is lit for the hour if and only if it burned; every standing fire is tended at the start of every night hour.
- A member asleep by its group's fire burns none of its own wood and is warm if and only if the fire is lit; a forager without a group burns a fire's wood at most once an hour of sleep.
- Every gift comes from a member at its hearth into its own group's fire, in exactly the amount the rule gives; a survivor takes back exactly what the fire held; each group's record of gifts adds up to what its fire has burned and holds, and each forager's gifts to the minute's.
- Carried lots are whole, unspoiled and in order; practice logs and rates follow from born skills and seconds worked, and change only at midnight; swaps pay both sides and agree on both sides.

## Theory

`src/valley/theory.ts`:

- **Time use.** Each hour of work or walking replaces an hour of rest, and foraging must pay for the whole day, so a forager at rate `g` forages `(F + gatherHours · (c_work − c_rest) + walkHours · (c_walk − c_rest)) / (g − (c_work − c_rest))` hours a day, where `F` is sleeping warm all night and resting all day.
- **Speed and cost under a load.** `v(L) = floor(125 · 60 / (60 + L))` centimetres a second: 107 at 10 kg, 93 at 20 kg, 83 at 30 kg. Carrying 30 kg 150 m home costs about 5 kcal more than walking it unloaded.
- **Checking.** The shortest tour through every site is about `0.7124 · √(n · A)` (Beardwood, Halton and Hammersley, 1959), about 0.54 hours of walking.
- **What a fire saves.** A group's fire burns `12 · campfireWoodPerHour` = 12 kg a night, whatever its size, against 12 kg for each forager with own fires. A group of `n` members needs `12 / n` kg a member each night: 4 kg in a group of 3, 1.5 kg in a group of 8.
- **Gathering.** At 24 kg an hour, a member of a group of `n` needs `0.5 / n` hours of gathering a day, against 0.5 with own fires, plus walking to the stands.
- **Who gives.** Wood a member holds goes only into the fire or to another member in a swap. Over a long run, then, what a member gives equals what it gathers, plus what it bought, minus what it sold, minus the change in its stock. Without swaps, giving and gathering are the same number.
- **Feeding keeps the fire at the rest of the night.** By day a fire is topped up to a night's wood by the first member home with wood; through the night it holds what the rest of the night needs. Members' stocks of 12 to 24 kg each hold several nights of a shared fire, so it goes out only before anyone has gathered.
- **Capacity.** The valley regrows 38,400 kcal a day; a forager needs about 2,500 kcal a day, so it feeds about 15.

### Predictions

From the implementation, on 32 seeds over 400 days, measured over days 21 to 400; the prototype's were the same. They are findings for this world, not theorems.

- **Everyone gives.** In every standing group of two or more, every member gives at least a quarter of an even share. The leading giver gives 1.10 times an even share in scattered groups, and 1.38 times in a band that starts as one group. Giving and gathering correlate at 1.00 across members, and at 0.89 when members give only to a low fire. 39% of the wood that goes into fires is spare; the rest is taken from members' stocks when a fire runs low.
- **Wood and gathering fall.** Members burn 4.0 kg of wood a forager-day and gather for 0.28 hours, against 11.7 kg and 0.66 hours with own fires. In a band that starts as one group, 1.5 kg and 0.12 hours, against 11.0 kg and 0.63. A fire of 2 kg an hour burns 8.2 kg a forager-day; one that burns a kilogram a member, 11.8.
- **Exchange disappears.** 3 runs of 32 swap after day 20, and members buy under 0.1% of their wood, against every run and 9.4% with own fires. With a fire that burns a kilogram a member, 28 runs swap but members still buy only 0.1%. With members giving only when the fire is low, every run swaps and members buy 15.4%.
- **Warmth.** Members sleep cold 2.7% of night hours, against 2.5% with own fires; in a band that starts as one group, 1.7% against 8.4%. With members giving only to a low fire, 4.7%. Fires are lit 97% of night hours.
- **Work falls.** Members work 2.39 hours a day, against 2.85 with own fires, and walk 1.01 hours against 1.11.
- **The band stays whole.** Bands of 8 and 12 are intact at day 400. A band of 16 keeps 6.0 survivors, all its deaths before day 100, against 5.8 with own fires: the fire saves wood, not food enough to feed more.

## Experiments

All experiments are deterministic, run headless in `src/valley/experiments.ts`, and check every invariant every minute. Runs last 400 days, or end early once every forager is dead. Seeds are `20260813` followed by `1, 2, 3, …`. Measures use days 21 to 400. The tests run each experiment on 8 seeds over the shortest horizon at which its expectation holds; the reported numbers use 32.

### 1. Who feeds the fire

The canonical valley, and the band as one group from the start (`scattered` off).

Expected:

- In every standing group of two or more, every member has given wood to the fire since day 20.
- Across members, wood given correlates with wood gathered at more than 0.9.

Reported: each group's leading giver as a multiple of an even share; the share of members giving less than a quarter of an even share; giving against gathering, buying and selling; and who gives when the fire is low, against who gives spare wood.

### 2. How big a fire

The canonical valley; fires of 2 kg an hour; fires that burn a kilogram an hour for every living member; and own fires (`sharedFire` off).

Expected:

- Members burn less than half the wood a forager-day with the canonical fire than with own fires, and about as much with a fire that burns a kilogram a member.
- Members gather fewer hours a day with the canonical fire than with own fires.

Reported: wood burned and gathered, hours of gathering, cold nights, hours lit, and the share of wood bought.

### 3. Spare wood and exchange

The canonical valley, and members that give only when the fire is low (`feedSpare` off).

Expected: members buy a larger share of their wood when they give only when the fire is low, and give only from their stocks.

Reported: runs that swap, the share of wood bought, the leading gatherer's multiple, cold nights, and giving as in experiment 1.

### 4. Groups

The canonical valley and the band as one group from the start, each beside own fires.

Expected: averaged over the seeds, a band that starts as one group burns less wood a member than scattered groups, and fires are lit in more than 90% of night hours.

Reported: groups formed, wood a member against group size, cold nights.

### 5. How many the valley feeds

The canonical valley with bands of 8, 12 and 16, beside own fires.

Expected: bands of 8 and 12 are intact at day 400 on every seed.

Reported: survivors over time (design rule 28), groups standing, dissolutions, and fires out.

## Ledger and metrics

- **Events.** Each forager's action every minute (what it did and why, where it went, its seconds, what it gathered, ate, spent and burned, its load and speed, the place or site it walked to, and the group whose fire it slept by); deaths; swaps and quotes; practice at midnight; foundings, joinings and dissolutions, a dissolution recording the wood its survivor took back; a **fire** event for each standing group at the start of every night hour, saying whether it burned and the wood left; and a **feed** event for every gift, with the wood and the part of it that was spare, whether the fire was low, the member's and the fire's wood before, what the fire burns an hour, and the fire's wood after.
- **Daily summaries,** for the band: seconds at each kind of time, food gathered, spent and spoiled, plant stocks, deaths, wood gathered and burned, sleep and cold sleep, swaps, groups standing and foragers without one, foundings, joinings and dissolutions, wood burned in shared fires and night hours fires were lit and out; and for each forager: its rates, reserve, seconds picking, gathering and walking, wood gathered, places seen, seconds walked with a load, sites known and checked, and wood given to fires.

## Observer

`life.html` is "Life 8 · a shared fire". It works like a strategy game that can be paused and sped up but not controlled.

- **The valley.** Bushes with berries, trees with deadwood at their feet, people about 1.75 m tall who walk, pick, gather, carry a bundle of wood and lie down at night, each coloured by its own terms and wearing a sash in its group's colour. Each group's base has its fire, a flag, ground in its colour and a lettered badge that keeps its size at every zoom.
- **The fire.** A flame whose size follows the wood the fire holds, a pile of wood beside it, and grey ashes when it is out. A forager without a group has its own hearth fire.
- **Following a forager.** The HUD shows the followed forager's activity, reserve, group, what it has seen and knows, load and speed, skills and practice, the wood it holds and has given its group's fire, the fire's state, what it carries, the terms it heard and what it has swapped. Ground it has never seen is drawn darker, and a ring marks every thicket and stand it knows, bright if checked lately.
- **Selecting a group shows where its members are:**
  - selecting a group, by its chip, flag, badge or base, frames its base and every living member at once, in the part of the view the cards leave clear;
  - every living member gets a **pin** in the group's colour, a marker with its number that floats above it and keeps the same size on screen at every zoom; pins for members standing together are stacked;
  - a member off screen, or hidden under a card, gets a pin at the edge of the clear part of the view, pointing towards it;
  - a thin line on the ground runs from the flag to each member away from home;
  - foragers outside the group are faded;
  - hovering a member in the card brightens its pin, and clicking a pin or a member follows it.
- **What each member gives.** The group card shows the fire (burning, banked for the night or out, the wood it holds and how many nights that is, and the night hours it has been out since the group was founded), and a table with one row per member who ever joined: wood put into the fire since it joined, as kilograms and as a share of all the group's fire wood, and into fires today; wood gathered; wood bought and sold, with the food paid and received; and the time it has slept warm by a group's fire. A sentence says who has given the most, and whether anyone has given nothing.
- **Inspecting a plant** compares what a bush or tree holds with what the followed forager remembers.
- **History and setup.** Charts of own terms, wood swapped, cold hours, survivors, groups and reserves over the days; the setup's numbers and the four switches.

## Code layout

| File | Contents |
| --- | --- |
| `src/valley/types.ts`, `config.ts` | State, configuration, defaults and validation |
| `src/valley/layout.ts`, `geometry.ts` | The layout, plant index, streams and integer geometry |
| `src/valley/forager.ts`, `food.ts`, `work.ts`, `practice.ts` | A forager's observation, needs, choices, carried food, work and practice |
| `src/valley/sites.ts`, `social.ts` | Sites, places, exploring and searching, flags and groups |
| `src/valley/trade.ts`, `fire.ts` | Wood need, swaps and quotes, and the shared fire |
| `src/valley/engine.ts` | The minute |
| `src/valley/invariants.ts`, `theory.ts`, `experiments.ts` | The invariants, theory and experiments above |
| `src/valley/*.test.ts` | Unit tests, `fingerprints.test.ts`, and experiments 1 to 5: 1 and 4 share a file and their runs (`feedingAndGroups`), as do 2 and 3 (`fireSizeAndSpare`), and experiment 5's seeds are split across two files (`feedsFire1`, `feedsFire2`) so the longest runs proceed in parallel |
| `src/valleyView/` | The observer |

Nothing under `src/sim` changes, so MVP9 keeps its trajectory bit for bit.

## Tests

- Configuration validation, one case per rule.
- The layout and its streams; a forager's minute, choosing a plant, eating, spoilage and swaps; places, meeting, founding, joining and dissolving; sight, sites, exploring and searching; loads, speed and taking a load home.
- Burning: a fire burns at the start of a night hour only, exactly its rate, and goes out with less; it relights once fed; a fire never burns by day.
- Warmth: a sleeping member is warm exactly when its fire is lit, whether or not it gave; a forager without a group tends its own fire.
- Feeding: spare wood goes in at the hearth; a low fire takes from a member's stock up to what it lacks; nothing is given away from the hearth or with `feedSpare` off.
- Dissolution: the survivor takes back the fire's wood. Contributions: what a group records as given matches what went into its fire.
- Determinism and purity: `stepValley` never changes its input, and `n` steps equal one run of `n` minutes.
- The invariants catch damage to each kind of record, including wood lost from a fire, a fire burning by day or the wrong amount, a member warm by a dark fire, and a gift away from the hearth or of the wrong amount.
- **Fingerprints.** Life 8 runs exactly as recorded: 30 days on three seeds for the canonical valley and each configuration the experiments use match recorded fingerprints of their daily summaries and totals.
- The expectations of experiments 1 to 5.
- Observer: drawing between minutes, plants and the camera, groups and what a forager knows, the fire's look, the contributions table, the clear part of the view and pins held at its edge. The pins at every zoom, the faded foragers, framing and the fire's flame are checked in the browser, at desktop width and at 375 px.

## Not in Life 8

Fires that warm members of other groups or strangers; choosing not to feed the fire; remembering who fed it, or refusing warmth to those who did not; cooking; a fire's light or safety; giving food; members changing group; fires that need work to relight; stands blocking the view; telling others where food is; and caches of food at a hearth. Each arrives with the step whose question needs it.

## References

- Beardwood, J., Halton, J. H., and Hammersley, J. M. (1959). The shortest path through many points. *Mathematical Proceedings of the Cambridge Philosophical Society*, 55(4), 299–327.
- Ostrom, E. (1990). *Governing the Commons: The Evolution of Institutions for Collective Action*. Cambridge University Press.
- Pandolf, K. B., Givoni, B., and Goldman, R. F. (1977). Predicting energy expenditure with loads while standing or walking very slowly. *Journal of Applied Physiology*, 43(4), 577–581.
- Wiessner, P. W. (2014). Embers of society: Firelight talk among the Ju/'hoansi Bushmen. *Proceedings of the National Academy of Sciences*, 111(39), 14027–14035.
