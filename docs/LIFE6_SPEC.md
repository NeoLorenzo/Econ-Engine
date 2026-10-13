# [LIFE6-Groups-036]

Life 6 is step 6 of the bottom-up core described in the [merge document](MERGE.md#the-ladder). It is built on the valley core of [Life 5](LIFE5_SPEC.md). In Life 5 the band lived around one fire in the middle of the valley, but nothing explained why its members lived together. In Life 6 nothing holds the band together at the start. Foragers start scattered across the valley and know only what they have seen. They explore when their needs are met, and they want company. Two foragers without a group who meet form one and plant a flag that becomes their home. A forager without a group that meets a member joins that member's group. Members swap only with each other.

Everything in Life 5's canonical world that this document does not change still holds: the valley and its plants, minutes and centimetres, the band of 8 born alike, hearths and cold nights, carried food that spoils, loads of firewood, swapping wood for food with terms told and remembered, and skill that grows with practice.

## Question

Does wanting company gather a scattered band into one group or into several, and does living in separate groups weaken the exchange and division of work that Life 5 found around one fire?

It could go either way. If foragers meet often, the first group may absorb everyone before a second can form, and the band ends up as Life 5's camp, reached from below instead of given. If they meet rarely, pairs found groups apart from each other and the band splits. Splitting could then weaken exchange, since each group is a smaller market. It could also make no difference, because in Life 5 swaps mostly happened between a few foragers anyway.

## What the prototype found first

A throwaway prototype of this step, run on 32 seeds over 400 days before this document was written, showed four things that shaped the design:

- **Groups form within the first day, and the band usually splits.** Every forager was in a group within 1.3 days on every seed, on average within 9 hours. The band formed one group in 6 runs of 32, two in 19, three in 6 and four in 1.
- **Searching must come before revisiting.** In the first version, a hungry forager that remembered no bush with berries went back to the bush it had seen longest ago, as in Life 5. A forager that knew only a few thickets then circled them while they were bare, and without exploring only 5.4 of 8 survived. A forager now first searches ground it has never seen, and only then revisits what it knows. With that rule every band of 8 survived, with or without exploring.
- **Exploring costs food.** A forager that walks the valley instead of resting walks about 2.6 hours a day instead of 0.1, which costs about 550 kcal a day more. It works about 0.4 hours a day more to pay for it. A band of 8 or 12 is intact at day 400, but a band of 16 falls to 2.8 survivors, against 5.4 in Life 5.
- **Groups trade less.** Members bought 10.5% of the wood they burned, against 17.8% in a band that starts as one group around the camp. The leading gatherer of a group brought in 1.32 times its fair share, against 1.64 times in a single group.

The implementation confirmed all four. Its numbers, under [Predictions](#predictions), differ a little from the prototype's: groups bought 12.4% of their wood rather than 10.5%, and a band of 16 fell to 2.4 survivors rather than 2.8.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Where foragers start | Scattered over the valley, at points drawn from a start stream, at least `startSpacingCm` (50 m) apart. A forager's start point is its hearth until it joins a group. | The owner asked for foragers that start scattered. 50 m is beyond sight, so nobody starts in company. The start stream is separate from the layout stream, so the plants stand where Life 5 put them on the same seed. |
| No camp | No central fire. The clearing in the middle of the valley stays as an open meadow. | Nothing explained the camp. Keeping the clearing keeps the layout identical to Life 5's, so the two can be compared seed by seed. |
| What a forager knows | Only what it has seen. Its memory of plants starts empty: a plant is known once it has been within its perception radius. | The owner asked for it. Life 5 gave every forager the whole valley at minute 0. |
| Places | The valley is divided into square places `placeCm` (30 m) wide, 400 in all. A forager remembers the last minute each place lay wholly within its view. | Exploring needs a record of where one has been, not only of plants. A place 30 m wide lies wholly within a 25 m view from its centre, so a place marked seen had every plant in it seen. |
| Exploring | A forager whose needs are met walks to the nearest place it has not seen for `exploreAfterHours` (24) or has never seen, among those it can reach and return home from before dusk. With none left, it rests where it stands, as in Life 5. | The owner asked that foragers explore instead of standing idle. A threshold keeps exploring from becoming endless pacing, and a day keeps the valley fresh in memory. 72 hours would halve the walking; the cost is reported in experiment 2. |
| Searching | A forager working for food or wood that remembers no plant worth a minute's work first searches: it walks to the nearest place it has never seen. Only once it has seen every place it can reach does it fall back on Life 5's rule, the plant seen longest ago. | Without it, foragers that knew a few thickets starved circling them (see the prototype). |
| Company | A forager without a group, whose hunger and wood need are met, seeks others. It ranks below hunger and warmth, including filling a load, and above exploring and resting. | The owner's order. |
| Seeking company | In order: walk towards the nearest forager it sees; otherwise to the nearest flag it knows, and wait there; otherwise explore. | People look for others where they have seen them or where they live. Waiting at a flag finds members when they come home. |
| Meeting | Two foragers meet when they stand within `talkRadiusCm`, 20 m, at the end of the turn of one without a group, at any time of day. A forager without a group meets the nearest forager within that distance, ties to the lowest ID. | Meeting means being within talking distance, the distance Life 5 already uses for swaps. It needs no new parameter. |
| Forming and joining | Meeting a member, the forager joins its group. Meeting another forager without a group, the two found a new group. A member never leaves or joins another group. | The owner's rules. |
| The flag | Planted where the two founders meet, at the midpoint between them, rounded down. It is seen from within `perceptionRadiusCm`. | A home base marks the spot where the group began. A midpoint favours neither founder. |
| Hearths around the flag | A member's hearth moves to the next point of a square spiral around the flag, `hearthSpacingCm` (3 m) apart: the 8 points of the first ring, then the 16 of the second, and so on, in order of joining. The forager whose turn it was is the first founder. Slots are not reused. A hearth that would lie outside the valley is moved to its edge. | Each forager keeps its own hearth, as the owner asked. Life 5 already arranged hearths on this spiral around its camp. The flag's own point stays clear for Life 7's shared fire. |
| Sleeping | At its hearth, as in Life 5: a member around its flag, a forager without a group at its start point. | Members sleep at their base, as the owner asked. |
| Exchange | Swaps and quotes only between members of the same group. Terms are heard only from members of one's own group. A forager without a group neither swaps nor hears terms. | The owner's rule: groups do not interact at all yet. |
| The last member | When a group has one living member left, it dissolves at once, after the turn in which its other member died: its flag is taken down and the survivor is without a group again. It keeps its hearth, seeks company again, and may found or join another group. A forager that next sees the empty spot forgets the flag. | A group of one is not a group. Under the rule that members never change groups, a survivor kept as a member could never find company again. |
| Life 5 as a special case | Four switches: `groups`, `scattered`, `explore` and `knowValley`. With groups, scattering and exploring off and the valley known, the valley runs exactly as Life 5. With groups on and scattering off, the band starts as one group with its flag at the meadow's centre and Life 5's hearths. | It keeps Life 5 testable bit for bit, and gives each change its own counterfactual. |
| The Life 4 page | Removed: `life4.html`, its build entry, the link from the Life 6 page, and the observer code only it used. The hourly core in `src/life/` and its tests stay. | The owner asked that only the current life be visible. The hourly core still runs in tests and in Life 5's comparison experiments. |

## World

### Layout

As in Life 5, with one change. When `scattered` is on, each forager's start point is drawn from the start stream, seeded from the run seed and its own salt with `mixSeed`. Points are drawn uniformly over the whole valley in whole centimetres, in forager ID order, and a draw is rejected if it lies within `startSpacingCm` of an earlier start. `createValley` refuses a configuration whose starts cannot be drawn in 10,000 draws. When `scattered` is off, hearths lie on Life 5's spiral around the meadow's centre.

### Places

Place `p` covers columns `px = p mod n` and rows `py = floor(p / n)`, where `n = ceil(valleySizeCm / placeCm)`: the square from `(px · placeCm, py · placeCm)` to the next multiple, cut at the valley's edge. Its centre is the midpoint of its corners, rounded down. A place lies wholly within view when all four of its corners lie within `perceptionRadiusCm` of the forager.

### Groups

A group has an ID from 0 in order of founding, a flag, the minute it was founded, its members in order of joining, the number of hearth slots it has given out, and the minute it dissolved, if it has.

## The forager

A forager keeps Life 5's state, with these changes:

| State | Meaning |
| --- | --- |
| `hearth` | Its start point, or its slot around its group's flag |
| `groupId` | Its group, or none |
| `bushMemory`, `treeMemory` | As in Life 5, with "never seen" for plants it has not seen |
| `placeSeen` | For each place, the last minute it lay wholly in view, or never |
| `knownFlags` | The groups whose flags it has seen and not since found gone |
| `exploreTarget` | The place it is walking to explore or search, if any |
| `joinedMinute` | The minute it joined or founded its group, for the observer |

With `knowValley` on, a forager starts as in Life 5, having seen every plant and every place at minute 0.

## The minute

The phases of Life 5's minute, with these changes:

3. **Turns.** Each living forager in turn order:
   3. **Observation.** As in Life 5, and it also marks every place wholly in view as seen this minute, learns every flag within its perception radius, and forgets every known flag whose spot is within that radius and holds no flag.
   4. **Decision.** The first rule that applies (see [Rules](#rules)).
   5. **Action.** As in Life 5. Walking to explore, search or seek company is walking.
   6. **Meeting.** A forager without a group meets the nearest forager within `talkRadiusCm`, if any, and joins or founds a group.
   7. **Exchange.** Life 5's swaps and quotes, between members of the same group only.
   8. **Dissolving.** If it died and left its group with one living member, the group dissolves.
4. **Record.** As in Life 5.

### Rules

Life 5's rules, with new ones in the middle and searching added to the last:

| Priority | Condition | Action | Reason recorded |
| --- | --- | --- | --- |
| 1 | Away from its hearth, and it is night or walking home takes at least `D` | Walk home | `going home` |
| 2 | It is night | Sleep | `night` |
| 3 | Not hungry, and filling a load | Work for wood | `filling a load` |
| 4 | Neither hungry nor short of wood, and without a group | Walk towards the nearest forager it sees, or to its nearest known flag it can reach and return from before dusk, or explore | `seeking company`, or `waiting for company` at the flag |
| 5 | Neither hungry nor short of wood, and a place to explore | Walk towards it | `exploring` |
| 6 | Neither hungry nor short of wood | Rest | `satiated` |
| 7 | Life 3's choice of work says wait | Rest | `waiting to swap` |
| 8 | It remembers no plant of the good worth a minute's work that it can reach in time, and a place it has never seen that it can reach and return from before dusk | Walk towards the nearest such place | `searching` |
| 9 | No plant of the good that it can reach in time | Rest | `too late to set out` or `waiting for regrowth` |
| 10 | Otherwise | Work at its target plant, walking to it first if needed | as in Life 5 |

Rule 4 with no forager in sight, no flag known and no place to explore falls through to rule 6. With `explore` off, rule 5 never applies, but a forager without a group still explores under rule 4.

**The place to explore.** It keeps its target place while the place is still unseen for `exploreAfterHours` and it can still reach it and return home before dusk. Otherwise it chooses the nearest such place by the distance to its centre, ties to the lowest ID. Searching chooses the same way among places never seen.

**Choosing a plant.** Life 5's rule, among plants it has seen: the nearest remembered as holding a minute's work, then, only when rule 8 does not apply, the one seen longest ago.

## Defaults

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `groups` | true | |
| `scattered` | true | |
| `explore` | true | |
| `knowValley` | false | |
| `startSpacingCm` | 5,000 | 50 m |
| `placeCm` | 3,000 | 400 places of 30 m |
| `exploreAfterHours` | 24 | |

Life 5's other defaults are unchanged.

`createValley` refuses a configuration unless, besides Life 5's rules:

- the four switches are booleans, and `startSpacingCm`, `placeCm` and `exploreAfterHours` are positive integers;
- a place fits in a view: `placeCm² ≤ 2 · perceptionRadiusCm²`, so standing at a place's centre sees all of it;
- the starts can be drawn, when scattered;
- the hearths fit in the camp's clearing, as in Life 5, only when not scattered.

## Invariants

Life 5's invariants still hold, with these changes and additions:

- A forager's memory of a plant it has never seen says so. A plant within its perception radius at the start of its turn is remembered as Life 5 requires. A place marked seen at a minute lay wholly within its view at that minute.
- Every member's group stands, with its flag up, and has at least two living members at the end of every minute. A group that dissolved has at most one living member, and none of them names it.
- A member's group never changes. A forager without a group becomes a member only by joining or founding at its own turn, within `talkRadiusCm` of the forager it met, and a group's members are exactly the foragers that name it.
- At the end of its turn, a forager without a group has no living forager within `talkRadiusCm`.
- A member's hearth is its slot on the spiral around its flag, moved to the valley's edge if needed.
- Every swap and quote is between members of the same group, and a forager hears terms only from its group.
- An exploring or searching forager walked towards the centre of a place it had not seen for `exploreAfterHours`, or never.
- With `knowValley` on and `groups`, `scattered` and `explore` off, every run equals Life 5's on the same seed.

## Theory

`src/valley/theory.ts` keeps Life 5's predictions where they still apply, and adds:

- **How many groups.** Every standing group has at least two living members, so at most `floor(n / 2)` groups stand at once in a band of `n` living foragers: 4 for the canonical band. Without deaths no group dissolves, and the groups founded never exceed 4.
- **Loners never trade.** A forager without a group neither swaps nor hears terms.
- **What exploring costs.** Walking the 400 places of the valley once is about 400 × 30 m = 12 km, about 2.7 hours at walking speed. A forager that refreshes everything it has not seen for a day walks about that much each day instead of resting. Walking costs `travelKcalPerHour − restKcalPerHour` = 210 kcal an hour more than resting, about 560 kcal a day.
- **Time use.** Life 5's time-use prediction still holds with the walking measured: each extra hour of walking adds `(φ − ρ) / (g − φ + ρ)` ≈ 0.21 hours of foraging, so about 2.5 extra hours of walking adds about 0.5 hours of work, against 2.65 hours a day in Life 5.
- **Capacity.** Each forager needs about 2,940 kcal a day instead of 2,380, so the valley's capacity `K` falls from about 16 to about 13.

### Predictions

From the prototype, on 32 seeds over 400 days, measured over days 21 to 400. They are findings for this world, not theorems, and the implementation will correct them.

The figures below are the implementation's. The prototype's are in [What the prototype found first](#what-the-prototype-found-first).

- **Groups form fast, and the band usually splits.** Everyone is in a group within 1.31 days on every seed, on average within 9.5 hours. The band forms one group in 6 runs, two in 19, three in 6 and four in 1, and no group dissolves. Every forager has seen the whole valley by the end of its second day.
- **Exploring keeps foragers on the move.** Foragers walk 2.58 hours a day and work 3.09 (2.43 picking, 0.66 gathering), against 0.11 and 2.69 without exploring. Exploring again only after 72 hours halves the walking to 1.56 hours, with 2.92 hours of work. The time-use prediction with the walking measured gives 3.05 hours of work, 1.3% below what is measured. Bands of 8 and 12 are intact at day 400.
- **Groups trade less and divide less, the more so the more groups.** With scattered groups, 30 runs in 32 swap, the first swap comes on day 100 on average (latest 228), members buy 12.4% of the wood they burn, and a group's leading gatherer brings in 1.27 times its fair share. In one group from the start the figures are 32 runs, day 87 (latest 178), 18.5% and 1.56. Strangers who may swap with anyone they meet buy 15.2%, and Life 5's band 17.5%. Across the scattered runs, bands that formed one group bought 18.5% of their wood, two groups 12.7%, three 7.8% and four none.
- **Exploring shortens the wait for the first swap.** One group from the start swaps first on day 87 on average, against day 140 in Life 5. The likely reason, not yet tested, is that exploring breaks up the shared routine that Life 5 found kept spare wood and need apart.
- **Groups sleep warmer.** Members of scattered groups sleep cold 3.6% of night hours, against 7.6% in one group and 7.1% in Life 5, because they buy less of their wood.
- **Exploring lowers what the valley carries.** A band of 16 falls to 2.4 survivors on average, all of its deaths before day 100, against 5.4 in Life 5, whose band of 16 is still whole at day 100. Groups dissolve as their members die, 124 times in 32 runs, and survivors regroup: up to 8 groups are founded in a run.

## Experiments

All experiments are deterministic, run headless in `src/valley/experiments.ts`, and check every invariant every minute. Runs last 400 days, or end early once every forager is dead. Seeds are `20260813` followed by `1, 2, 3, …`. Measures use days 21 to 400. The tests run each experiment on 8 seeds over the shortest horizon at which its expectation holds; the reported numbers use 32.

### 1. Groups from a scattered start

The canonical valley.

Expected:

- Every forager is in a group by the end of day 2 on every seed.
- No more than 4 groups are ever founded, and none dissolves.

Reported: the minute everyone is grouped, the number of groups, their sizes, and how they formed (who met whom, where, and when).

### 2. Knowing and exploring

The canonical valley, with exploring off, and with `exploreAfterHours` of 72.

Expected:

- The band is intact at day 400 on every seed, in each.
- With exploring, foragers walk more than 2 hours a day; without, less than half an hour.
- Hours of work per forager-day are within 5% of the time-use prediction, with the measured walking hours put into it.

Reported: work, walking, rest and sleep; cold nights; and how soon each forager has seen the whole valley.

### 3. Groups and exchange

The canonical valley; the band as one group from the start (`scattered` off); strangers who may swap with anyone they meet (`groups` off); and Life 5.

Expected:

- With groups, no forager without a group ever swaps or quotes.
- Averaged over the seeds, members of scattered groups buy a smaller share of the wood they burn than the band that starts as one group, and a group's leading gatherer brings in a smaller multiple of its fair share.

Reported: runs that swap, the first swap, the share of wood bought, the leading gatherer's multiple of its fair share in each group, cold nights, and the same against the number of groups a run formed.

### 4. Life 5 is a special case

The valley with groups, scattering and exploring off and the valley known, beside Life 5's core.

Expected: daily summaries and totals equal fingerprints recorded from Life 5's code on the same seeds. Life 5's own experiments and tests keep running with these settings.

### 5. How many the valley feeds

The canonical valley with bands of 8, 12 and 16, beside Life 5's.

Expected:

- Bands of 8 and 12 are intact at day 400 on every seed.
- A band of 16 has fewer survivors on average than Life 5's band of 16. The test compares them at day 100, when Life 5's band is still whole.
- Some group dissolves, and no group ever has fewer than two living members.

Reported: survivors over time (design rule 28), groups standing over time, and dissolutions.

## Ledger and metrics

- **Events.** Life 5's events, and: a founding (minute, group, flag, the two founders and their new hearths), a joining (minute, group, forager, the member it met, its new hearth), and a dissolution (minute, group, the survivor if any). Action events record the forager's group and its place target.
- **Daily summaries,** as in Life 5, plus the groups standing, foragers without a group, foundings, joinings and dissolutions, and each forager's seen places at the end of the day.

## Observer

`life.html` becomes "Life 6 · groups".

- **No camp fire.** The meadow in the middle stays open.
- **Flags.** A flag on a pole about 2.5 m tall stands at each group's base, its cloth in the group's colour. It rises when the group is founded and comes down when it dissolves. Groups are named by letter, A, B, C and so on, in order of founding.
- **Hearths.** Each forager's hearth is drawn where it is: at its start point while it is without a group, and around its flag once it has joined, moving there at the minute it joins.
- **Belonging.** A member wears a band of its group's colour across its chest; a forager without a group wears none. A forager's body keeps Life 5's colour for what it is relatively good at.
- **What the followed forager knows.** Places it has never seen are drawn darker on the ground, like the unexplored map of a strategy game, and places it has not seen for `exploreAfterHours` a little darker. Its perception circle is drawn as before.
- **HUD and inspector.** Life 5's, plus the followed forager's group, its fellow members and when it joined, and how much of the valley it has seen. Clicking a flag shows its group, members and when it was founded. The reasons for exploring, searching and seeking company appear as actions.
- **Charts.** Life 5's charts, plus groups and foragers without a group by day.
- **Controls.** The setup adds the four switches and the time before a place is worth exploring again.
- **Links.** No link to Life 4. The MVP9 observer's top bar links to Life 6.

## Code layout

| File | Contents |
| --- | --- |
| `src/valley/social.ts` | Places, exploring and searching, flags, meeting, founding, joining and dissolving |
| `src/valley/types.ts`, `config.ts`, `layout.ts`, `forager.ts`, `trade.ts`, `engine.ts` | The new state, defaults and validation, starts, rules, exchange within groups, and the minute's new phases |
| `src/valley/invariants.ts`, `theory.ts`, `experiments.ts` | The invariants, theory and experiments above |
| `src/valley/*.test.ts` | Unit tests (`social`), and experiments 1 to 5 in files of their own so they run in parallel. Life 5's tests run with Life 5's settings. |
| `src/valleyView/` | The observer |

Removed: `life4.html` and its entry in `vite.config.ts`, and `src/lifeView`'s page and scene (`main.tsx`, `LifeApp.tsx`, `lifeScene.ts`). `lifeViewModel.ts`, its test, `SpecializationChart.tsx` and `life.css` stay, because the valley's observer uses them. The draft listed `life.css` for removal. Nothing under `src/sim` or `src/life` changes, so MVP9 and Life 0 to Life 4 keep their trajectories bit for bit.

**Speed.** A canonical run of 400 days took about 7 seconds in the prototype without invariants, against about 2 for Life 5, mostly in choosing places to explore. The implementation keeps every place's corners and centre in typed arrays, searches places in rings outwards no further than the forager can still walk before dusk, and remembers which place it saw longest ago, so it need not look at every place to know none is due. A canonical run takes about 6 seconds, with or without the checker, against about 2.5 for Life 5. The rest of the cost is real: exploring foragers keep moving, so what they see changes every minute.

## Tests

- Configuration validation, one case per new rule, including starts that cannot be drawn.
- Starts: deterministic for a seed, spaced as configured, and the plants' layout identical to Life 5's on the same seed.
- Places: a place is marked seen only when all four corners are in view; the forager standing at a place's centre sees it; the nearest stale place, with its tie-break; keeping and dropping the target.
- Searching before revisiting, and the fallback once every reachable place has been seen.
- Meeting: two foragers without a group found a group, with the flag at their midpoint and hearths on the spiral; one without a group joins a member's group; the nearest is met first; a member never changes group; meeting beyond talking distance does not happen.
- Exchange only within a group, and terms heard only from it.
- Dissolution: the last living member of a group is without a group again, keeps its hearth, and the flag is forgotten by those who see its spot.
- Determinism and purity, as in Life 5.
- The invariants catch a member without a standing group, a group of one, a swap between groups, a loner left beside another forager, and a hearth off its slot.
- The expectations of experiments 1 to 5.
- Observer: group names, a forager's group, fellows and when it joined, a flag's inspector, the shading of the explored ground, the inspector of a plant never seen, and the new activities. Flags rising and coming down, hearths moving at joining and group colours are checked in the browser.

## Not in step 6

A shared campfire at the flag, fed with wood and able to go out, which is Life 7; any interaction between groups, whether trade, conflict or avoidance; leaving a group; choosing whom to join; kin; groups moving their base; and any reason for company beyond its being wanted. Each arrives with the step whose question needs it.

## Documentation on implementation

A changelog entry; a lab-notes entry with the prototype's findings and the findings of experiments 1 to 5; Life 6 sections in the architecture notes and the validation guide; the README's section updated, with Life 4's link removed and a new screenshot; `AGENTS.md` updated for the removed page; and the merge document's ladder updated, with step 6 "Groups", step 7 "A shared fire", tools and shelter moving to step 8, and later steps moving down by two.

## References

- Life 5: the [Life 5 specification](LIFE5_SPEC.md).
- Orians, G. H., and Pearson, N. E. (1979). On the theory of central place foraging. In D. J. Horn, R. D. Mitchell and G. R. Stairs (eds.), *Analysis of Ecological Systems* (pp. 155–177). Ohio State University Press.
