# [LIFE7-SightAndLoads-037]

Life 7 is step 7 of the bottom-up core described in the [merge document](MERGE.md#the-ladder). It is built on the valley core of [Life 6](LIFE6_SPEC.md). In Life 6 a forager sees only 25 m. It explores by walking from one 30 m square of ground to the next, in a fixed order, and it sweeps the whole valley again every day, though the land never changes. It also walks off to explore with 30 kg of firewood on its back, at full speed and at no extra cost. In Life 7 a forager sees as far as a person does across open ground. It remembers where the thickets and stands of trees are and what ground it has already seen. When idle it checks the thickets and stands it knows, rather than sweeping ground. A load slows it down and makes every metre cost more, and it takes a full load home before doing anything else.

Everything in Life 6's canonical world that this document does not change still holds: the valley and its plants, minutes and centimetres, the band of 8 born alike and scattered, carried food that spoils, loads of firewood, cold nights, swaps within a group with terms told and remembered, skill that grows with practice, and groups that form when foragers meet.

## Question

When foragers see across the valley and check what they know instead of sweeping it, do they walk less, and does seeing everyone from the first morning gather the band into one group or split it into more? And does making loads heavy to carry change how the band works and trades?

It could go either way. Long sight could gather the band, because a forager sees others from afar and walks straight to them rather than bumping into them by chance. It could also split it further, because every forager sets off towards its nearest neighbour at the same moment and pairs form all over the valley at once. Checking known places could save most of Life 6's walking, or it could cost nearly as much, since every thicket and stand still needs a visit to learn what it holds. A carrying cost could tax the foragers who gather wood, and so weaken the division of work, or it could be too small to matter over a valley's short distances.

## What the prototype found first

A throwaway prototype of this step, run on 32 seeds over 400 days before this document was written, showed six things that shaped the design:

- **Seeing far splits the band more.** With sight across the whole valley, every forager was in a group within an hour and a half of the first dawn on every seed. The band formed two groups in 9 runs, three in 22 and four in 1, and never one group, against one group in 6 runs of Life 6. Sight of 100 m already gave the same result. With the new rules but Life 6's 25 m sight, the band formed one group in 3 runs.
- **Checking instead of sweeping saves more than half the walking.** Foragers walked 1.11 hours a day, against 2.57 in Life 6, almost all of it checking thickets and stands (1.03 hours). They worked 2.85 hours a day, against 3.09.
- **Carrying costs almost nothing in this valley.** With the carrying cost turned off, foragers walked 1.09 hours a day instead of 1.11. A load travels only from a stand to a hearth, typically about 150 m.
- **Taking loads home is what lets small loads start exchange.** With 20 kg loads every run swapped, and members bought 11.2% of the wood they burned. Without the rule only 5 runs in 32 swapped, and 0.1% of wood was bought. Life 6 with 20 kg loads never swapped. With 30 kg loads the rule made little difference (9.4% bought, against 8.2% without it).
- **Group members do not walk in step.** A seeded random preference for nearer thickets was tried, to stop members of a group from checking the same places together. It was not needed: in a shorter run, members walked together in under 1% of checking minutes with or without it, and it added 0.6 hours of walking a day. The rule stays nearest first, with no randomness.
- **The valley feeds more, and groups trade less.** A band of 16 kept 5.8 survivors on average, against 2.4 in Life 6 and 5.4 in Life 5. Members of scattered groups bought 9.4% of the wood they burned, against 12.4% in Life 6, and 18.9% in a band that starts as one group.

The implementation confirmed all six, with the prototype's numbers exactly: it implements the same rules. Its runs, which check every invariant every minute, found two gaps in the checker, described under [Invariants](#invariants), and none in the engine.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Two kinds of sight | **Long sight**, `sightRadiusCm`: where things are, meaning thickets, stands, other foragers and flags. **Close sight**, Life 5's `perceptionRadiusCm` of 25 m: what a bush or tree holds. | A person easily makes out a thicket, a stand of trees or another person hundreds of metres away across open ground. Judging whether berries are ripe or how much deadwood lies under a tree takes being close. |
| How far long sight reaches | 1 km, more than the valley's diagonal of 849 m, in daylight. At night long sight shrinks to close sight. | The valley is flat and open, and the owner chose plain long sight, with no stands blocking the view. A thicket 24 m across, seen from 850 m, spans more than a degree and a half. Nothing in the valley is out of sight by day. The prototype found 100 m and 250 m give much the same answer, and the experiments vary it. |
| What a forager remembers of the land | Every thicket and stand it has spotted, and the last minute it **checked** each one, meaning it stood close enough to see every plant in it. Ground it has seen stays seen. | The land never changes. Bushes and trees never appear or vanish, so there is nothing to rediscover. Only what each plant holds changes, and only checking learns it. A memory more realistic than this, such as telling others or expecting regrowth, waits for the step that needs it. |
| Checking a site | A site is checked in a minute when its centre lies within `perceptionRadiusCm − r` of the forager, where `r` is the thicket's or stand's radius, so every plant in it is in close sight. Checking also records every plant's stock, as Life 5's observation does. | 13 m from a thicket's centre and 10 m from a stand's. A forager working inside a thicket usually checks it without trying. |
| Exploring | A forager whose needs are met first walks towards the nearest place it has never seen, if any. Otherwise it walks to the nearest site it knows and has not checked for `exploreAfterHours` (24), among those it can reach and return home from before dusk. It never re-explores ground. | Unseen ground may hold a thicket, but seen ground never changes. Sites change, so checking them is worth a walk. Within a day's sight this means walking from thicket to thicket, the irregular path the land itself sets, rather than square by square. |
| Searching | A forager working for food or wood that remembers no plant worth a minute's work first walks to the nearest site of that kind it knows but has never checked. Then it walks towards the nearest place it has never seen. Only then does it fall back on Life 5's rule, the plant seen longest ago. | Life 6's finding still holds: search before revisiting. A thicket spotted from afar is the obvious place to look. |
| No randomness in where to go | Nearest first, ties to the lowest site or place ID. | The prototype found no need for it (design rule 20). |
| Load | What a forager carries: the wood gathered on this trip, `min(tripWood, wood)`, plus its carried berries at `berryKcalPerKg` (500 kcal a kilogram, rounded down). Wood waiting at its hearth is not carried. | Berries are about 0.5 kcal a gram. `tripWood` is already the wood on its back; it is set down at the hearth. A swap can only take wood from what it holds, hence the minimum. |
| Walking speed under a load | `floor(walkCmPerSecond · bodyKg / (bodyKg + load))` centimetres a second, with `bodyKg` 60: 4.5 km/h unloaded, 3.9 km/h with 10 kg, 3.0 km/h with 30 kg. | A load slows a walker. One small study of women walking with a 10 kg head load measured about 1.1 m/s, against 1.07 m/s here. Together with the cost below, the rule matches Pandolf's equation, so one parameter, the body's mass, sets both. |
| Cost of walking under a load | Each second of walking costs `travelKcalPerHour`, loaded or not, so each metre costs `(bodyKg + load) / bodyKg` times as much: 1.5 times with 30 kg. | Pandolf's equation for load carriage (1977), at the speed above, gives a cost per second within 9% of unloaded walking for loads up to 30 kg, and 14% higher at 40 kg. The cost of carrying is the slower walk, paid in seconds at the walking rate. It keeps the energy budget per second unchanged. |
| Taking a load home | A forager that is not hungry and carries a full load, `tripWood ≥ woodLoad > 0`, walks home before doing anything else. | People do not wander off to explore with a headload. They take it home and set it down, as central-place foraging predicts (Orians and Pearson, 1979). Life 6 had no such rule, so a forager that finished a load went exploring with it. |
| Speed in plans | Every walking time a forager plans with uses its speed at the start of its turn: whether it can reach a plant or place and come home before dusk, and when it must set out for home. | It knows how heavy its load is. A load grows by at most a kilogram in a minute of gathering, and the rule for going home is checked every minute at the true speed. |
| Life 6 as a special case | Three switches and one length: `checkSites`, `carryCost`, `loadHome`, and `sightRadiusCm`. With all three switches off and sight equal to close sight, the valley runs exactly as Life 6. | It keeps Life 6 testable bit for bit, and gives each change its own counterfactual. |

## World

As in Life 6. A **site** is a thicket or a stand. Sites are numbered from 0, thickets first in their layout order, then stands. A site's centre and radius are its thicket's or stand's.

## The forager

A forager keeps Life 6's state, with these additions:

| State | Meaning |
| --- | --- |
| `siteKnown` | For each site, whether it has spotted it |
| `siteChecked` | For each site, the last minute it checked it, or never |

With `knowValley` on, a forager starts having spotted and checked every site at minute 0, as well as every plant and place.

## The minute

The phases of Life 6's minute, with these changes:

3. **Turns.** Each living forager in turn order:
   3. **Observation.** Its sight is `sightRadiusCm` in daylight and `perceptionRadiusCm` at night. As in Life 6 it records the stock of every plant within close sight. It also spots every site whose centre is within sight, and checks every site whose centre is within `perceptionRadiusCm − r`. It marks every place wholly within sight as seen, and learns and forgets flags within sight.
   4. **Decision.** The first rule that applies (see [Rules](#rules)).
   5. **Action.** As in Life 6, at its speed for the load it carries at the start of the action. Walking to take a load home or to check a site is walking.

The other phases are unchanged. Metabolism is unchanged: walking, working, standing and sleeping each cost what they cost in Life 6.

### Rules

Life 6's rules, with one new rule and new targets for exploring and searching:

| Priority | Condition | Action | Reason recorded |
| --- | --- | --- | --- |
| 1 | Away from its hearth, and it is night or walking home at its speed takes at least `D` | Walk home | `going home` |
| 2 | It is night | Sleep | `night` |
| 3 | Not hungry, and filling a load | Work for wood | `filling a load` |
| 4 | **Not hungry, and carrying a full load** | **Walk home** | **`taking a load home`** |
| 5 | Neither hungry nor short of wood, and without a group | Walk towards the nearest forager it sees, or to its nearest known flag it can reach and return from before dusk, or explore | `seeking company`, or `waiting for company` at the flag |
| 6 | Neither hungry nor short of wood, and somewhere to explore | Walk towards the nearest place never seen, or else to the nearest site not checked for `exploreAfterHours` | `exploring` or `checking` |
| 7 | Neither hungry nor short of wood | Rest | `satiated` |
| 8 | Life 3's choice of work says wait | Rest | `waiting to swap` |
| 9 | It remembers no plant of the good worth a minute's work that it can reach in time, and knows a site of that kind it has never checked, or a place it has never seen, that it can reach and return from before dusk | Walk towards the nearest such site, or else the nearest such place | `searching` |
| 10 | No plant of the good that it can reach in time | Rest | `too late to set out` or `waiting for regrowth` |
| 11 | Otherwise | Work at its target plant, walking to it first if needed | as in Life 5 |

The rules from 5 on are Life 6's rules 4 to 10, renumbered. A forager seeking company with no one in sight and no flag known explores under rule 6's choice, as in Life 6. Rule 6 with `checkSites` off is Life 6's rule 5. A forager walks to a site's centre. A place target is kept as in Life 6. A site target is chosen afresh each minute. Walking towards the nearest site, a forager turns aside only for a site that has become nearer on the way.

## Defaults

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `sightRadiusCm` | 100,000 | 1 km |
| `checkSites` | true | |
| `carryCost` | true | |
| `loadHome` | true | |
| `bodyKg` | 60 | |
| `berryKcalPerKg` | 500 | |

Life 6's other defaults are unchanged. `exploreAfterHours` keeps its value of 24, and with `checkSites` on it means the hours before a site is worth checking again.

`LIFE6_VALLEY` sets `checkSites`, `carryCost` and `loadHome` off and `sightRadiusCm` to 2,500.

`createValley` refuses a configuration unless, besides Life 6's rules:

- the three switches are booleans, and `sightRadiusCm`, `bodyKg` and `berryKcalPerKg` are positive integers;
- long sight reaches at least as far as close sight: `sightRadiusCm ≥ perceptionRadiusCm`;
- with `checkSites` on, a site can be checked: `perceptionRadiusCm > max(thicketRadiusCm, standRadiusCm)`.

## Invariants

Life 6's invariants still hold, with these changes and additions:

- A forager moved at most its walking seconds times its speed for the load it carried at the start of its action.
- A site is known only if its centre was within the forager's sight at some turn. A site marked checked at a minute had its centre within `perceptionRadiusCm − r` of the forager at that minute. A place marked seen lay wholly within the forager's sight at that minute.
- With `checkSites` on, a forager explores only towards a place it has never seen, and checks only a site it knows that was not checked for `exploreAfterHours`. It searches only towards a site of the good's kind it has never checked, or a place it has never seen.
- With `loadHome` on, no forager that is not hungry and carries a full load explores, checks, seeks company or rests away from its hearth. A forager taking a load home walks towards the hearth it had while it acted. The checker works that hearth out from the minute's foundings in turn order: a forager met by a founder at an earlier turn of the minute has its hearth moved before it acts, while one that founds or joins at its own turn moves it only after its action.
- Two foragers share a group for a swap or quote if they did at the start of the minute or do at its end, since a death later in the minute may dissolve the group they shared. Life 6's checker read groups only at the end of the minute, a gap its runs never exposed.
- With `carryCost` off, every forager walks at `walkCmPerSecond`.
- With `checkSites`, `carryCost` and `loadHome` off and `sightRadiusCm` equal to `perceptionRadiusCm`, every run equals Life 6's on the same seed.

## Theory

`src/valley/theory.ts` keeps Life 6's predictions where they still apply, and adds:

- **Speed and cost under a load.** `v(L) = floor(125 · 60 / (60 + L))` centimetres a second: 107 at 10 kg, 93 at 20 kg, 83 at 30 kg. Walking `d` centimetres takes `ceil(d / v(L))` seconds, at `travelKcalPerHour` each.
- **What carrying costs.** Carrying a 30 kg load 150 m home takes 181 seconds instead of 120, about 5 kcal more. A forager brings home a load about every two and a half days, so carrying costs it about 2 kcal a day, under 0.1% of what it needs. The cost would matter over longer distances or heavier loads.
- **Seeing everyone.** With sight across the valley, every forager without a group sees every other from the first daylight minute. Each walks towards its nearest, so groups form within the first hours of light, and at most `floor(n / 2)` of them, as in Life 6.
- **What checking costs.** 40 sites spread over the 540 m square that site centres can occupy. The shortest tour through them is about `0.7124 · √(n · A)`, about 2.4 km or 0.54 hours of walking (Beardwood, Halton and Hammersley, 1959). Nearest-first tours run about a quarter longer, and trips out from and back to the hearth add more. A forager that checks every site once a day therefore walks at least about 0.7 hours a day, against Life 6's sweep of about 2.7.
- **Time use.** Life 5's and Life 6's time-use prediction, with the measured walking: 1.1 hours of walking instead of 2.6 lowers work by about 0.3 hours a day.
- **Capacity.** Each forager needs about 2,380 + (1.1 − 0.1) · 210 ≈ 2,590 kcal a day, so `K` rises from about 13 in Life 6 to about 15.

### Predictions

From the implementation, on 32 seeds over 400 days, measured over days 21 to 400; the prototype's were the same. They are findings for this world, not theorems.

- **Seeing far splits the band.** Everyone is in a group within 0.31 days on every seed, on average within 7.3 hours of midnight, 1.3 hours after the first dawn. The band forms two groups in 9 runs, three in 22, four in 1, and never one. With sight of 25, 100 and 250 m it forms one group in 3, 1 and 0 runs. No group dissolves in a band of 8.
- **Walking falls by more than half.** Foragers walk 1.11 hours a day (1.03 of it checking) and work 2.85 (2.19 picking, 0.66 gathering), against 2.57 and 3.09 in Life 6. Without exploring they walk 0.08 hours and work 2.68. Checking sites again only after 72 hours halves walking to 0.49 hours. Every forager has seen every place in the first daylight minute.
- **Carrying costs little, and taking loads home matters for small loads.** Without the carrying cost foragers walk 1.09 hours a day rather than 1.11, and everything else is within the noise between seeds. Walking with a load takes 0.04 hours a day, against 0.87 in Life 6, whose foragers explore with finished loads on their backs. Without taking loads home foragers walk 1.38 hours, 0.65 of them with a load. With 20 kg loads every run swaps and members buy 11.2% of their wood, against 5 runs and 0.1% without the rule. With 40 kg loads 27 runs swap and members buy 5.2%, against 9 runs and 1.2% without it.
- **More groups, less trade.** Every run swaps. The first swap comes on day 88 on average (latest 220). Members buy 9.4% of the wood they burn, and a group's leading gatherer brings in 1.15 times its fair share, against 12.4% and 1.27 in Life 6. A band that starts as one group buys 18.9%, with a leader at 1.64 times. Members sleep cold 2.5% of night hours, against 3.6% in Life 6.
- **The valley feeds more.** Bands of 8 and 12 are intact at day 400 on every seed. A band of 16 keeps 5.8 survivors on average, all its deaths before day 100, against 2.4 in Life 6 and 5.4 in Life 5.

## Experiments

All experiments are deterministic, run headless in `src/valley/experiments.ts`, and check every invariant every minute. Runs last 400 days, or end early once every forager is dead. Seeds are `20260813` followed by `1, 2, 3, …`. Measures use days 21 to 400. The tests run each experiment on 8 seeds over the shortest horizon at which its expectation holds; the reported numbers use 32.

### 1. Seeing far

The canonical valley; sight of 25, 100 and 250 m; and Life 6.

Expected:

- Every forager is in a group by the end of day 1 on every seed.
- Averaged over the seeds, the canonical band stands in more groups than Life 6's, and no more than 4 groups are ever founded.

Reported: the minute everyone is grouped, the number of groups at each sight, and how they formed.

### 2. Walking and checking

The canonical valley; exploring off; `exploreAfterHours` of 72; and Life 6.

Expected:

- The band is intact at day 400 on every seed, in each.
- Foragers walk less than 1.5 hours a day, against more than 2 in Life 6; with exploring off, less than half an hour.
- Hours of work per forager-day are within 5% of the time-use prediction, with the measured walking hours put into it.
- Every forager has seen every place by the end of day 0.

Reported: work, walking by reason, rest and sleep; cold nights; and how often each site is checked.

### 3. Carrying

The canonical valley; carrying cost off; taking loads home off; both off; and loads of 20 and 40 kg, with and without taking loads home.

Expected:

- With the carrying cost, a forager carrying 30 kg walks at 83 cm/s, and walking hours differ from those without it by less than 0.1 hours a day.
- With 20 kg loads, more runs swap with taking loads home than without.

Reported: walking, work, runs that swap, the first swap, the share of wood bought, the leading gatherer's multiple, cold nights, and the walking done with a load.

### 4. Groups and exchange

The canonical valley, and the band as one group from the start (`scattered` off).

Expected: averaged over the seeds, members of scattered groups buy a smaller share of the wood they burn than the band that starts as one group, and a group's leading gatherer brings in a smaller multiple of its fair share.

Reported: as in Life 6's experiment 3, and against the number of groups a run formed.

### 5. Life 6 is a special case

The valley with `LIFE6_VALLEY`, beside Life 6's core.

Expected: daily summaries and totals equal fingerprints recorded from Life 6's code on the same seeds. Life 6's own experiments and tests keep running with these settings, and Life 5's with Life 5's settings added.

### 6. How many the valley feeds

The canonical valley with bands of 8, 12 and 16, beside Life 6's.

Expected:

- Bands of 8 and 12 are intact at day 400 on every seed.
- A band of 16 has more survivors at day 100 on average than Life 6's band of 16.

Reported: survivors over time (design rule 28), groups standing over time, and dissolutions.

## Ledger and metrics

- **Events.** Life 6's events. Action events also record the forager's load at the start of its action and its speed, and the site it walked towards to check or search, if any.
- **Daily summaries,** as in Life 6, plus each forager's seconds walked with a load, its count of sites known, and the number of sites it checked during the day.

## Observer

`life.html` becomes "Life 7 · sight and loads".

- **The group band.** The band across a member's chest is drawn as a sash: it wraps around the torso and runs from one shoulder down to the opposite hip. In Life 6's observer the ring was turned the wrong way. It ran front to back through the body, so it looked like a necktie from the front and a hook through the chest from the side. It is drawn smooth and a little wider than the torso.
- **Bases.** Each standing group's base shows:
  - its flag, as in Life 6;
  - a soft disc on the ground in the group's colour, around the hearths;
  - a badge with the group's letter, which floats above the flag and keeps the same size on screen at every zoom, so every base can be found from the whole-valley view.
- **Groups to choose from.** The HUD shows a chip for each standing group, in its colour. Clicking a chip, a badge, a disc or a flag selects the group.
- **A selected group:**
  - every living member has a ring in the group's colour at its feet;
  - a group card replaces Life 6's flag inspector. It shows when the group was founded, each member with what it is doing and what it carries (clicking a member follows it), and the wood and food the group holds and the swaps among its members over the last day;
  - a "Show group" button moves the camera to take in the base and every member;
  - closing the card, or selecting something else, clears it.
- **Loads.** A forager carrying a load walks more slowly, as the states say. The HUD shows what the followed forager carries and how fast it walks, for example "30 kg on its back · walks at 3.0 km/h".
- **What the followed forager knows.** Ground it has never seen is drawn darker, as in Life 6. Ground does not grow stale, so Life 6's lighter shading for ground not seen lately is gone. A thin ring marks every thicket and stand it knows: bright if checked within `exploreAfterHours`, faint if not. The close-sight circle is drawn as before. The long-sight circle is drawn only when it is smaller than the valley.
- **HUD and inspector.** Life 6's, plus the followed forager's load and speed, how many sites it knows, and how many it has checked lately. The new reasons, checking and taking a load home, appear as actions.
- **Controls.** The setup adds sight in metres and the switches for checking sites, the carrying cost and taking loads home.
- **Links.** The MVP9 observer's top bar links to Life 7.

## Code layout

| File | Contents |
| --- | --- |
| `src/valley/sites.ts` | Sites: spotting, checking and choosing a site to check or search |
| `src/valley/forager.ts` | Load and speed, and speed in reachability and going home |
| `src/valley/social.ts` | Sight in place marking, flags and seeking company; exploring with sites |
| `src/valley/types.ts`, `config.ts`, `engine.ts` | The new state, defaults, `LIFE6_VALLEY` and validation, and the new rule and observation |
| `src/valley/invariants.ts`, `theory.ts`, `experiments.ts` | The invariants, theory and experiments above |
| `src/valley/*.test.ts` | Unit tests (`sites`, `carrying`), and experiments 1 to 6 in files of their own so they run in parallel (`seeingFar`, `walking`, `carryingCost`, `carryingLoads`, `sightExchange`, `life6`, `feedsSight`, `feedsSightSixteen`). Life 6's tests run with Life 6's settings; `life5.test.ts` also leaves out the fields Life 7 adds to a day's summary. |
| `src/valleyView/` | The observer |

Nothing under `src/sim` or `src/life` changes, so MVP9 and Life 0 to Life 4 keep their trajectories bit for bit.

**Speed.** With sight across the valley, every place is seen in the first daylight minute. Once a forager has seen every place, marking places is skipped. A canonical run of 400 days takes about 4.2 seconds, or 6.9 with the checker, against 3.7 and 6.4 for Life 6 on the same machine: checking keeps foragers on the move, so what they see changes every minute, and the checker looks at every site for every forager every minute.

## Tests

- Configuration validation, one case per new rule.
- Sight: a site is spotted within long sight by day and only within close sight at night. It is checked only within `perceptionRadiusCm − r`. Places are marked seen within long sight. Flags and foragers are seen within long sight.
- Exploring: the nearest place never seen comes first, then the nearest site not checked lately, with their tie-breaks. Seen ground is never explored again.
- Searching: the nearest never-checked site of the good comes before unseen ground, and both before revisiting.
- Loads: the load counts trip wood and carried berries. A 30 kg load walks at 83 cm/s. A walk's seconds cost the same loaded or not. Reaching in time and going home use the loaded speed.
- Taking a load home: a forager that is not hungry with a full load walks home before exploring or seeking company; a hungry one works for food.
- Determinism and purity, as in Life 6.
- The invariants catch a walk faster than the load allows, a load not carried, a site checked from too far, a site spotted beyond sight, exploring towards seen ground, checking with a full load and taking home a load not carried; and they pass a walk home whose hearth moved when its forager was met.
- The expectations of experiments 1 to 6.
- Observer: the group chips and the group card, a member's activity and load, the HUD's load and speed, and the rings of known sites. The sash, badges, discs, member rings, framing the group and loaded walking are checked in the browser.

## Not in step 7

Stands or thickets blocking the view; telling others where food is, or what a thicket held; expecting regrowth from what was seen; choosing how big a load to carry; caches of food at a hearth; ground that is not flat; and a shared fire, which becomes step 8. Each arrives with the step whose question needs it. The owner plans a more realistic memory later.

## Documentation on implementation

- A changelog entry and a lab-notes entry, with the prototype's findings and the findings of experiments 1 to 6.
- Life 7 sections in the architecture notes and the validation guide.
- The README's section updated, with a new screenshot.
- The merge document's ladder updated, which this specification already does: step 7 is "Sight and loads", and the shared fire and later steps move down by one.

## References

- Life 6: the [Life 6 specification](LIFE6_SPEC.md).
- Beardwood, J., Halton, J. H., and Hammersley, J. M. (1959). The shortest path through many points. *Mathematical Proceedings of the Cambridge Philosophical Society*, 55(4), 299–327.
- Orians, G. H., and Pearson, N. E. (1979). On the theory of central place foraging. In D. J. Horn, R. D. Mitchell and G. R. Stairs (eds.), *Analysis of Ecological Systems* (pp. 155–177). Ohio State University Press.
- Pandolf, K. B., Givoni, B., and Goldman, R. F. (1977). Predicting energy expenditure with loads while standing or walking very slowly. *Journal of Applied Physiology*, 43(4), 577–581.
