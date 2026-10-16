# [LIFE8-SharedFire-038]

Life 8 is step 8 of the bottom-up core described in the [merge document](MERGE.md#the-ladder). It is built on the valley core of [Life 7](LIFE7_SPEC.md). In Life 7 every forager burns its own wood at its own hearth, so wood is a private good: a forager is warm at night if, and only if, it holds the wood. Members of a group sleep side by side around their flag, each beside a small fire of its own. In Life 8 each group keeps one fire at its flag, which replaces its members' own fires. It warms every member who sleeps at the group's hearths, whoever fed it. Members put wood into it, and it goes out when it runs dry.

Everything in Life 7's canonical world that this document does not change still holds: the valley and its plants, minutes and centimetres, the band of 8 born alike and scattered, carried food that spoils, loads of firewood carried home, cold nights, swaps within a group with terms told and remembered, skill that grows with practice, groups that form when foragers meet, long sight, and checking known sites.

## Question

Who feeds a fire that warms everyone at it?

It could go either way. Each member feeds the fire from its own wood, and is warm whether or not it gave. Members who happen to be at home when the fire runs low could end up feeding it for everyone, while those who come home late are warmed for nothing. The cost could also spread evenly, because whoever gives today runs short and gathers, and comes home tomorrow with wood to spare. And a fire shared by a group needs far less wood than one fire per member, so the shared fire could make wood so plentiful that exchange, which every step since Life 3 has found, disappears.

## What the prototype found first

A throwaway prototype of this step, a copy of the valley core with the rules below, run on 32 seeds over 400 days before this document was written, showed four things that shaped the design:

- **Everyone feeds the fire, roughly in proportion to what they gather.** No member gave less than a quarter of an even share. A group's most generous member gave 1.11 times an even share in scattered groups and 1.38 times in a band that starts as one group. Because a member's wood goes nowhere but into the fire or a swap, what it gives is almost exactly what it gathers.
- **One fire per group needs far less wood.** With the shared fire burning a kilogram an hour, the same as one hearth fire, members burned 4.0 kg of wood a day each against 11.7 in Life 7, and spent 0.28 hours a day gathering against 0.66. In a band of 8 that starts as one group they burned 1.5 kg and gathered for 0.12 hours.
- **Exchange disappears, because spare wood goes into the fire.** Members bought under 0.1% of the wood they burned, against 9.5% in Life 7. It is not that wood became plentiful: with a fire that burns a kilogram an hour for every member, as much wood as Life 7, members still bought only 0.1%. Spare wood goes into the fire as soon as its gatherer is home, so no member holds wood to sell. With the rule that a member gives only when the fire is low, members kept their spare wood and bought 16.1% of what they burned, more than in Life 7.
- **The fire rarely goes out.** Fires were lit for 97% of night hours, and once lit almost never went out for want of wood. The dark hours came in the first nights, before members had gathered any wood.

The implementation confirmed all four, with the prototype's numbers: it implements the same rules. Its experiments measure the share of wood bought over all the wood a configuration burns, rather than averaging each run's share as the prototype did, so members who give only to a low fire buy 15.4% rather than 16.1%. Its runs, which check every invariant every minute, found no gap in the engine.

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| One fire per group | Each standing group has a **fire** at its flag, the point Life 6 left free for it. Members no longer keep fires of their own. A forager without a group keeps its own hearth fire, as in Life 7. | The owner's rule. A fire belongs to the group that sleeps around it, and Life 6 put every member's hearth within a few metres of the flag. A forager without a group has no one to share with, and would otherwise sleep cold until it meets someone. |
| How much a fire burns | `campfireWoodPerHour`, 1 kg in every night hour, however many members sleep at it. | A fire is a fire: Life 3's hearth fire burns a kilogram an hour, and one fire of that size is what the group keeps. This is the step's main economy, and the experiments vary it: a fire of 2 kg an hour, and one that burns a kilogram an hour for every living member, which saves no wood at all. |
| Who is warmed | A member sleeping at its hearth in an hour when its group's fire is lit sleeps warm, whether or not it gave. | The owner's rule: the fire warms everyone at it. Sleep happens only at a forager's hearth, so every sleeping member is at the fire. |
| Burning | At the start of every night hour, before turns, each standing group's fire burns `campfireWoodPerHour` if it holds that much, and is lit for the hour. Otherwise it burns nothing and is **out** for the hour. | Life 7's fires are decided once an hour too. Deciding before turns means every member asleep in that hour knows whether it is warm. |
| Going out and relighting | A fire that holds less than an hour's wood at the start of a night hour is out. It is relit, at no cost, at the start of the next night hour at which it holds an hour's wood. | The owner's rule: a dead fire must be relit, at no extra cost. Wood left in a fire that is out stays there, so every kilogram is accounted for. |
| Feeding | In its turn, after swapping, a member standing at its hearth puts into the fire its **spare** wood, everything above its target of `woodStockNights` nights. If the fire is **low**, holding less than it will burn in the rest of the night, or by day in a whole night, the member also gives from its stock, up to what the fire lacks or all it holds. Members feed awake or asleep. | The owner's rule: a member adds wood if it has spare wood or the fire is low. Feeding at the hearth means a member feeds only the fire it is at. A sleeper wakes enough to put a log on a dying fire. |
| What a member keeps | Life 7's wood need is unchanged: a member is short of wood below one night's wood and gathers until it holds `woodStockNights` nights' worth. Its stock is now its reserve for the fire. | It keeps one rule for wood across steps, and gives the rule for a low fire something to draw on. A member's stock falls only when it feeds a low fire or sells. |
| Swaps | Unchanged. A member short of wood may buy from one with spare, within its group. Swaps come before feeding in a turn. | Exchange is Life 3's finding. Swapping first lets a member sell spare wood before it puts it into the fire, if anyone nearby wants it. |
| A group that dissolves | Its survivor takes back the wood left in the fire, and keeps its own fire again. If no member survives, the wood stays in the cold fire. | A group of one is not a group (Life 6), and its fire becomes the survivor's hearth fire. Every kilogram is accounted for. |
| What each member gave | The group records the wood each member has put into its fire, and each forager the wood it has put into any fire. | The owner asked to see who contributes. Contributions are what the step's question asks about, so they are measured, not inferred. |
| Food | Nothing in the valley gives food away, so no member contributes food to the group. The group card shows the food each member paid or received for wood in swaps within the group. | Giving food was Life 2's mechanism and has not returned. Showing swaps keeps the food side visible without inventing a transfer. |
| Life 7 as a special case | One switch, `sharedFire`. With it off, the valley runs exactly as Life 7. | It keeps Life 7 testable bit for bit, and gives the step its counterfactual. |

## The fire

A group gains this state:

| State | Meaning |
| --- | --- |
| `fireWood` | Wood in the fire, in whole kilograms |
| `fireLit` | Whether the fire is lit this hour |
| `given` | For each member, in order of joining, the wood it has put into the fire |
| `fireBurned`, `litHours`, `darkHours` | Wood burned, and night hours lit and out since it was founded |

A forager gains `fireGiven`, the wood it has put into any fire, and `warmByFireMinutes`, the minutes it has slept warm by a group's fire.

## The minute

The phases of Life 7's minute, with these changes:

1. **Practice and regrowth,** as in Life 7.
2. **Fires.** At the start of every hour: if it is night, each standing group's fire burns `campfireWoodPerHour` and is lit if it holds that much, and is out otherwise. By day every fire is unlit.
3. **Turns.** Each living forager in turn order, as in Life 7, except:
   - **Sleep.** A member that sleeps is warm if its group's fire is lit this hour. It burns no wood of its own. A forager without a group tends its own fire, as in Life 7.
   - **Feeding.** After swapping, a member at its hearth feeds its group's fire, as above.
   - **Dissolution.** When a death dissolves a group, its survivor takes back the fire's wood.

### Rules

Life 7's rules are unchanged. Feeding is not a choice of action: it happens at the end of a turn spent at the hearth, as setting down a load does.

## Defaults

| Parameter | Canonical value | Notes |
| --- | --- | --- |
| `sharedFire` | true | |
| `campfireWoodPerHour` | 1 | Life 7's `fireWoodPerHour` |
| `campfirePerMember` | false | With it on, a fire burns `campfireWoodPerHour` for each living member: experiment 2's counterfactual |
| `feedSpare` | true | With it off, members give only to a low fire: experiment 3's counterfactual |

Life 7's other defaults are unchanged. `fireWoodPerHour` still sets what a forager without a group burns.

`LIFE7_VALLEY` sets `sharedFire` off. `LIFE6_VALLEY` and `LIFE5_VALLEY` include it.

`createValley` refuses a configuration unless, besides Life 7's rules, `sharedFire`, `campfirePerMember` and `feedSpare` are booleans and `campfireWoodPerHour` is a positive integer.

## Invariants

Life 7's invariants still hold, with these changes and additions:

- **Wood is conserved through the fires.** Every minute, the wood on trees, held by foragers and in fires equals the wood at minute 0 plus what has regrown, minus what has burned.
- A fire burns only at the start of a night hour, exactly `campfireWoodPerHour`, and only if it held that much; it is lit for the hour if and only if it burned.
- A member burns no wood of its own while its group stands. A member asleep in an hour sleeps warm if and only if its group's fire is lit that hour.
- Only a member at its hearth puts wood into a fire, and only into its own group's. What it gives is at least its spare wood, and no more than its spare wood plus what the fire lacked, and never more than it held.
- The wood a group records as given by its members equals the wood that has gone into its fire, and each forager's `fireGiven` equals the sum over the groups it has belonged to.
- A dissolved group's fire holds no wood if it had a survivor.
- With `sharedFire` off, every run equals Life 7's on the same seed.

## Theory

`src/valley/theory.ts` keeps Life 7's predictions where they still apply, and adds:

- **What a fire saves.** A group's fire burns `12 · campfireWoodPerHour` = 12 kg a night, whatever its size, against 12 kg for each member in Life 7. A group of `n` members needs `12 / n` kg a member each night: 4 kg in a group of 3, 1.5 kg in a group of 8.
- **Gathering.** At 24 kg an hour, a member of a group of `n` needs `0.5 / n` hours of gathering a day, against 0.5 in Life 7, plus walking to the stands. Most of Life 7's 0.66 hours of gathering disappear.
- **Who gives.** Wood a member holds goes only into the fire or to another member in a swap. Over a long run, then, what a member gives equals what it gathers, plus what it bought, minus what it sold, minus the change in its stock. Without swaps, giving and gathering are the same number.
- **Feeding keeps the fire at the rest of the night.** By day a fire is topped up to a night's wood by the first member home with wood; through the night it holds what the rest of the night needs. Members' stocks of 12 to 24 kg each hold several nights of a shared fire, so it goes out only before anyone has gathered.
- **Capacity.** Less gathering lowers what a forager needs a day by about `0.4 · (300 − 90)` ≈ 80 kcal, under 4%, so `K` rises a little above Life 7's.

### Predictions

From the implementation, on 32 seeds over 400 days, measured over days 21 to 400; the prototype's were the same. They are findings for this world, not theorems.

- **Everyone gives.** In every standing group of two or more, every member gives at least a quarter of an even share. The leading giver gives 1.10 times an even share in scattered groups, and 1.38 times in a band that starts as one group. Giving and gathering correlate at 1.00 across members, and at 0.89 when members give only to a low fire. 39% of the wood that goes into fires is spare; the rest is taken from members' stocks when a fire runs low.
- **Wood and gathering fall.** Members burn 4.0 kg of wood a forager-day and gather for 0.28 hours, against 11.7 kg and 0.66 hours in Life 7. In a band that starts as one group, 1.5 kg and 0.12 hours, against 11.0 kg and 0.63. A fire of 2 kg an hour burns 8.2 kg a forager-day; one that burns a kilogram a member, 11.8.
- **Exchange disappears.** 3 runs of 32 swap after day 20, and members buy under 0.1% of their wood, against every run and 9.4% in Life 7. With a fire that burns a kilogram a member, 28 runs swap but members still buy only 0.1%. With members giving only when the fire is low, every run swaps and members buy 15.4%.
- **Warmth.** Members sleep cold 2.7% of night hours, against 2.5% in Life 7; in a band that starts as one group, 1.7% against 8.4%. With members giving only to a low fire, 4.7%. Fires are lit 97% of night hours.
- **Work falls.** Members work 2.39 hours a day, against 2.85 in Life 7, and walk 1.01 hours against 1.11.
- **The band stays whole.** Bands of 8 and 12 are intact at day 400. A band of 16 keeps 6.0 survivors, all its deaths before day 100, against 5.8 in Life 7: the fire saves wood, not food enough to feed more.

## Experiments

All experiments are deterministic, run headless in `src/valley/experiments.ts`, and check every invariant every minute. Runs last 400 days, or end early once every forager is dead. Seeds are `20260813` followed by `1, 2, 3, …`. Measures use days 21 to 400. The tests run each experiment on 8 seeds over the shortest horizon at which its expectation holds; the reported numbers use 32.

### 1. Who feeds the fire

The canonical valley, and the band as one group from the start (`scattered` off).

Expected:

- In every standing group of two or more at day 400, every member has given wood to the fire since day 20.
- Across members, wood given correlates with wood gathered at more than 0.9.

Reported: each group's leading giver as a multiple of an even share; the share of members giving less than a quarter of an even share; giving against gathering, buying and selling; and who gives when the fire is low, against who gives spare wood.

### 2. How big a fire

The canonical valley; fires of 2 kg an hour; fires that burn a kilogram an hour for every living member; and Life 7.

Expected:

- Members burn less wood a forager-day with the canonical fire than in Life 7, and about as much with a fire that burns a kilogram a member.
- Members gather fewer hours a day with the canonical fire than in Life 7.

Reported: wood burned and gathered, hours of gathering, cold nights, hours lit, and the share of wood bought.

### 3. Spare wood and exchange

The canonical valley, and members that give only when the fire is low.

Expected: members buy a larger share of their wood when they give only when the fire is low.

Reported: runs that swap, the share of wood bought, the leading gatherer's multiple, cold nights, and giving as in experiment 1.

### 4. Groups

The canonical valley and the band as one group from the start, each beside Life 7.

Expected: averaged over the seeds, a band that starts as one group burns less wood a member than scattered groups.

Reported: groups formed, wood a member against group size, cold nights.

### 5. Life 7 is a special case

The valley with `LIFE7_VALLEY`, beside Life 7's core.

Expected: daily summaries and totals equal fingerprints recorded from Life 7's code on the same seeds. Life 7's own experiments and tests keep running with these settings, and Life 6's and Life 5's with theirs.

### 6. How many the valley feeds

The canonical valley with bands of 8, 12 and 16, beside Life 7's.

Expected: bands of 8 and 12 are intact at day 400 on every seed.

Reported: survivors over time (design rule 28), groups standing, dissolutions, and fires out.

## Ledger and metrics

- **Events.** Life 7's events, plus:
  - a **feed** event when a member puts wood into its fire: the group, the member, the wood and the part of it that was spare, whether the fire was low, the member's wood and the fire's wood before, what the fire burns an hour, and the fire's wood after;
  - a **fire** event for each standing group at the start of every night hour: whether it burned, and the wood left.
  - Dissolve events record the wood the survivor took back, and action events the group whose fire a member slept by (`fireGroupId`).
- **Daily summaries,** as in Life 7, plus each forager's wood given to fires during the day, the wood burned in shared fires, and the night hours fires were lit and out.

## Observer

`life.html` becomes "Life 8 · a shared fire".

- **The fire.** Each standing group's flag has a fire beside it: a flame whose size follows the wood it holds, a pile of wood beside it, and grey ashes when it is out. Members' hearths no longer show their own flames; a forager without a group still does.
- **Selecting a group shows where its members are.** In Life 7 a selected group's members got a small ring at their feet. From the whole-valley view the rings were too small to see, and the camera did not move, so the card listed members that could not be found on the map. In Life 8:
  - selecting a group, by its chip, flag, badge or base, frames its base and every living member at once, in the part of the view the cards leave clear;
  - every living member gets a **pin** in the group's colour, a marker with its number that floats above it and keeps the same size on screen at every zoom, drawn over trees and other foragers, as the group badges are; pins for members standing together are stacked;
  - a member off screen, or hidden under a card, gets a pin at the edge of the clear part of the view, pointing towards it;
  - a thin line on the ground runs from the flag to each member away from home;
  - foragers outside the group are faded;
  - hovering a member in the card brightens its pin, and clicking a pin or a member follows it;
  - the member list uses the group's colour.
- **What each member gives.** The group card adds:
  - the fire: burning, banked for the night or out, the wood it holds and how many nights that is, and the night hours it has been out since the group was founded;
  - a **contributions** table, one row per member who ever joined: wood put into the fire since it joined, as kilograms and as a bar showing its share of all the group's fire wood, and into fires today; wood gathered; wood bought and sold, and the food paid and received for it; and the time it has slept warm by a group's fire;
  - a sentence saying who has given the most, and whether anyone has given nothing.
- **HUD and inspector.** The followed forager shows the wood it has given to its group's fire, and its group's fire's state. The fire's state replaces Life 7's line about what a night's fire saves for members.
- **Controls.** The setup adds the shared fire switch and the fire's wood an hour.
- **Links.** The MVP9 observer's top bar links to Life 8.

## Code layout

| File | Contents |
| --- | --- |
| `src/valley/fire.ts` | Burning, feeding and the fire's state |
| `src/valley/types.ts`, `config.ts`, `engine.ts`, `social.ts` | The new state, defaults, `LIFE7_VALLEY` and validation, the fire phase, sleep and feeding in the turn, and dissolution |
| `src/valley/invariants.ts`, `theory.ts`, `experiments.ts` | The invariants, theory and experiments above |
| `src/valley/*.test.ts` | Unit tests (`fire`), and experiments 1 to 6 in files of their own so they run in parallel (`whoFeeds`, `fireSize`, `spareWood`, `fireGroups`, `life7`, `feedsFire`). Life 7's experiments run with Life 7's settings (`life7()` in `experiments.ts`), and Life 5's and Life 6's fingerprint tests leave out the fields Life 8 adds to a day's summary. |
| `src/valleyView/` | The observer |

Nothing under `src/sim` or `src/life` changes, so MVP9 and Life 0 to Life 4 keep their trajectories bit for bit.

## Tests

- Configuration validation, one case per new rule.
- Burning: a fire burns at the start of a night hour only, exactly its rate, and goes out with less; it relights once fed; a fire never burns by day.
- Warmth: a sleeping member is warm exactly when its fire is lit, whether or not it gave; a forager without a group tends its own fire.
- Feeding: spare wood goes in at the hearth; a low fire takes from a member's stock up to what it lacks; nothing is given away from the hearth or to another group's fire; swaps come first.
- Dissolution: the survivor takes back the fire's wood.
- Contributions: what a group records as given matches what went into its fire.
- Determinism and purity, as in Life 7.
- The invariants catch wood lost or made in a fire, a fire burning by day or without the wood, a member warm by a dark fire, a gift away from the hearth, and a gift larger than allowed.
- The expectations of experiments 1 to 6.
- Observer: the fire's state, the contributions table, the member pins and their colours, and the HUD's fire line. The pins at every zoom, pins at the edge of the view, the faded foragers, framing and the fire's flame are checked in the browser, at desktop width and at 375 px.

## Not in step 8

Fires that warm members of other groups or strangers; choosing not to feed the fire; remembering who fed it, or refusing warmth to those who did not; cooking; a fire's light or safety; giving food; members changing group; and fires that need work to relight. Each arrives with the step whose question needs it.

## Documentation on implementation

- A changelog entry and a lab-notes entry, with the prototype's findings and the findings of experiments 1 to 6.
- Life 8 sections in the architecture notes and the validation guide.
- The README's section updated, with a new screenshot.
- The merge document's step 8 row and a "Step 8: settled" section.

## References

- Life 7: the [Life 7 specification](LIFE7_SPEC.md).
- Ostrom, E. (1990). *Governing the Commons: The Evolution of Institutions for Collective Action*. Cambridge University Press.
- Wiessner, P. W. (2014). Embers of society: Firelight talk among the Ju/'hoansi Bushmen. *Proceedings of the National Academy of Sciences*, 111(39), 14027–14035.
