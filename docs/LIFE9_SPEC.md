# [LIFE9-LogHuts-046]

Life 9 is the bottom-up core described in the [merge document](MERGE.md#the-ladder), and the only version of it in the repository. Earlier steps built it one mechanism at a time and live on in git history; this document describes the whole simulation as it stands.

A band of foragers lives in a small valley, simulated minute by minute in whole centimetres, kilocalories and kilograms. They pick berries bush by bush, gather sticks from bushes and branches from trees, eat, carry food that spoils, burn wood against cold nights, swap wood for food, and get better at what they practise. They start scattered and know only what they have seen. By day they see across the valley, and they check the thickets, stands and outcrops they know when their needs are met. A load slows them down, and they take a full load home before anything else. Those without a group look for company; two who meet found a group and plant a flag, and anyone who meets a member joins. Each group keeps one fire at its flag, which warms every member asleep on the ring of huts round it.

New in Life 9: every member wants a hut of its own. A hut is built of logs, and logs can only be cut from trees with an axe: the first cut fells a tree whole, and the rest of its logs are cut from the trunk where it lies. Nobody wants an axe for itself; a member makes or buys one only because its hut needs logs. An axe is made at the hearth from a stone picked up at an outcrop and a kilogram of wood. A forager who has made more axes lately makes them faster and better, and better axes cut faster and last longer. Axes wear out, and huts weather, so the need for logs, and so for axes, never ends. Members may sell axes to each other for food.

Life 9.5 revises Life 9 without moving up the ladder, after the owner watched it run. There is no deadwood: firewood is sticks from bushes and branches from trees, and a felled tree's crown brings more branches down. A tree comes down whole and grows back from its stump. A group's huts stand on a ring round its fire, far enough apart to walk between, each facing the flames, and a member sleeps inside its hut. A hut keeps its sleeper a little warm, the fire more, and both together most. Only a forager without a group has a fire of its own.

## Question

Do tools concentrate in the hands of those who make them, and does making them become a trade?

It could go either way. Every member needs an axe from time to time, and an axe takes only hours to make, so everyone could simply make their own, as everyone gathers their own wood. But a member who has made axes lately makes them faster and better, so whoever happens to make the most could become cheap enough that the others would rather buy from it, and keep it practised by buying. Or the trade could follow born talent instead of practice, and the gifted would make axes while the clumsy buy. And trade could fail altogether: an axe costs hours of work, which must be paid in fresh food carried at the moment of sale.

## What a quick prototype showed

Before the design was settled, a throwaway prototype showed that two rules are needed for axes to change hands at all. Without a promise, a member whose axe wore out started making its own in the same minute that others offered to make one, so almost no axe was ever sold. And priced at hours of picking forgone, an axe cost more fresh food than a buyer could carry. Both rules below come from that. In the implemented valley, axes are sold in nearly every run, and a band that starts as one group tends to end up with one member making most of its axes. Measuring this properly is left for later (see [Questions for later](#questions-for-later)).

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| The drive for shelter | Every member wants a **hut** at its hearth, whole. A member's hearth is its slot on the ring round its group's fire, where its hut stands and it sleeps; it has no fire of its own there. Wanting logs for it comes after hunger and wood for the fire, and before exploring, checking and rest. Foragers without a group build nothing: they seek company first, and joining a group moves their hearth. | The owner's rule: shelter is an inherent drive. A hearth is fixed only once a forager belongs to a group. |
| Warmth | Four costs of an hour asleep: `sleepKcalPerHour`, 60, in a whole hut by a lit fire; `fireSleepKcalPerHour`, 80, by a lit fire without a hut; `hutSleepKcalPerHour`, 120, in a whole hut without a fire; `coldSleepKcalPerHour`, 150, with neither. A member's fire is its group's; a forager without a group burns its own, hut or not. | The owner's rule: a hut keeps warm a little, the fire more. In Life 9 a whole hut was as warm as the fire, and mattered only on the 3% of night hours the fire was out; now it saves food every night. |
| Huts round the fire | Slot `i` round a flag is point `i` of the square spiral, on ring `k`, moved along its direction onto the circle `k · hutRingCm` from the flag, `hutRingCm` 700: the first ring holds 8 huts 7 m from the fire, evenly round it, the second 16 at 14 m. | The owner's rule: huts are built round the fire, because it warms more. Life 9's square spiral 3 m apart crowded the huts against each other. Integer square roots keep every slot exact on every machine. |
| What a hut is made of | `hutLogs`, 23 logs, each carried home from a tree and laid at the hearth. A hut is whole when it holds 23. | The owner's rule: basic wooden huts, built as real ones would be, for one sleeper. A 20 kg log is a pole of dry wood 14 cm thick and 2.4 m long, and a small A-frame of such poles takes 23: two A's of a log each, 9 wall logs a side resting on each other, a ridge log and two logs cut into posts to close the back. |
| Huts weather | Each hut loses a log every `hutLogDays`, 10 days; the log rots away. A hut short of a log is not whole until it is repaired. | Without weathering every hut is finished in the first week and nobody needs an axe again, so the question could only be asked in the first week. |
| Felling | A standing tree holds `logsPerTree`, 3 logs. The first log cut from it fells it whole: it lies where it fell, its crown's branches with `fellWood`, 10 kg, more brought down, and its other logs are cut from the trunk where it lies. A felled tree's branches do not regrow. | The owner's rule: a tree comes down whole in one go, then is broken down into logs and branches. In Life 9 a tree gave up its logs one by one while it stood. |
| Stumps grow back | A felled tree with no logs left stands again whole, with every log, at the first midnight `treeRegrowthDays`, 60, after it fell. Branches still lying there become its new crown's. | Trees must come back or the valley runs out of logs. Keeping the leftover branches conserves wood without a rule for rotting. |
| Firewood | No deadwood. Each bush holds up to `bushCapacityWood`, 2 kg, of sticks, regrowing `bushRegrowthWoodPerDay`, 1 kg; each standing tree up to `treeCapacityWood`, 25 kg, of branches, regrowing `treeRegrowthWoodPerDay`, 6 kg. Both are gathered by hand at `woodPerHour`. Trees and bushes together are the **wood plants**, and a thicket holds wood as well as berries. | The owner's rule: firewood comes from harvesting bushes and the branches of trees, not from dead wood on the ground. |
| Clearing crowns first | A forager gathering wood takes from the nearest felled crown it knows with a minute's work, before any plant still growing. | Without it, felled crowns lay untouched beside their stumps while foragers took sticks from nearer bushes. It is the same rule as finishing a felled trunk before felling another tree. |
| More trees | 12 stands of 12 trees, against 8 of 8. | The owner asked for more trees. The prototype's huts used about a tenth of the logs on offer at any time. |
| Cutting | A member cuts at the nearest tree it knows lying felled with a log, and fells the nearest standing tree only when there is none it can reach in time. It tells them apart from afar: a standing tree holds every log. | One tree at a time is cut up before the next comes down. |
| An axe is needed to cut a log | Without an axe, no log. Cutting a log takes `logChopMinutes`, 30 minutes, with an axe of quality 100, and proportionally longer with a worse one. | The owner's rule: the drive for tools comes from the need for wood. Requiring the axe keeps the choice that matters, making against buying, at the centre. |
| Carrying a log | A log weighs `logKg`, 20 kg. A forager carries one at a time, takes it home before anything else, and walks more slowly under it. | Loads already slow walking. One log a trip makes the distance to the trees matter. |
| Stones | **Outcrops** are a third kind of site, like thickets and stands: `outcropCount`, 4, each with `stonesPerOutcrop`, 12, stone spots holding `stonesPerSpot`, 5, stones. Stones never come back. | The owner asked for stone as a resource on the map, like trees and bushes. 240 stones are several times what 400 days use. |
| Making an axe | One stone and `axeWood`, 1 kg of the member's wood, worked at its hearth. Making takes `axeHours`, 4 hours, at craft 100%, and `4 · 100 / craft` hours at any other craft. Work can stop for hunger or night and go on later. | The owner's rule: the more skilled make axes faster. Making at the hearth keeps the work where the materials are kept. |
| Craft | A member's craft is its born craft skill times its practice, from the seconds it has spent making axes over its last `practiceDays` days, by the same practice curve as picking and gathering. Nobody starts with practice, so a first axe is made at half one's born skill. | The owner's rule: skill comes from making. Practice is how skill already works in the valley. |
| Born craft skill | Drawn for each forager from `craftSkillMinPercent` to `craftSkillMaxPercent`, 100 to 100 by default: born alike. The setup can draw them from a range, such as 50% to 150%. | Foragers are born alike in every other skill, so differences in craft come from practice unless the setup asks for talent (design rule 19). |
| Quality | When an axe is finished its quality is drawn uniformly from half the maker's craft to its whole craft. Quality multiplies the speed of cutting, and an axe lasts `axeLogs`, 40, logs times its quality over 100, at least one. | The owner's rule: the more skilled are more likely to make a good axe, the less skilled more likely a shoddy one, and better axes cut faster and wear out more slowly. |
| What an axe costs to make | `axeHours · 100 / craft` hours times the difference between working and resting, `forageCostKcalPerHour − restKcalPerHour`, 210 kcal an hour. | Members are at rest most of the day, so an hour spent making costs the extra energy of working, not food it would otherwise have picked. Priced at picking, an axe cost more food than a buyer can carry fresh. |
| What an axe is worth | To a member who needs one, an axe of quality `q` is worth what making its own would cost it, times `q` over the quality it would expect to make, three quarters of its craft. | A buyer's alternative to buying is making its own. A better axe than it could make is worth more; a worse one, less. |
| Buying or making | A member that needs an axe buys if it has heard of an axe for sale that is worth more to it than its asking price, and makes its own otherwise. | Local, bounded choice (design rule 2): it compares what it heard with its own cost. |
| Asking and promising | A member that needs an axe and has none tells the members within talking distance. The cheapest maker among them that does not need logs itself, if its axe would be worth more to the asker than its own cost, promises to make one for sale; the asker hears the promise and waits at its hearth. A promise binds nobody: the axe is sold to whoever needs one when it is finished. | Without it, an asker starts its own axe in the same minute a maker offers to make one, and trade never happens. A promise is what a band does when someone asks around for an axe. It is information, not a claim; claims arrive with step 10. |
| Selling | A member with a spare axe tells members within talking distance its asking price, its own cost of making one. It sells to a member that needs one when the axe is worth more to the buyer than the ask, at the midpoint, paid in carried food, if the buyer carries enough and the seller has room to eat it. | The same rule as swapping wood for food: both must gain, and food changes hands only as far as it can be eaten. A buyer that has heard a worthwhile ask picks food to pay with, then waits at its hearth. |
| A maker's own axe | A maker whose own axe wears out uses its spare. | A spare is its own until sold. |
| Counterfactuals | Two new switches: `axeTrade` (off: no member may sell, ask or promise) and `craftPractice` (off: practice is fixed at 100%). `scattered` stays. `sharedFire`, `campfirePerMember` and `feedSpare` are removed. | Each new switch is a comparison for later. Life 8's fire switches only recreated Life 8's comparisons. |

## World

The valley is a square `valleySizeCm` wide. Everything is drawn from the layout stream, seeded from the run seed and the layout salt with `mixSeed`; every draw is `randomInt` over whole centimetres.

1. **Sites.** Site centres are drawn uniformly over the valley, at least `siteMarginCm` from its edges. A draw is rejected if it lies within `campClearingCm` of the camp, the valley's centre, or within `siteSpacingCm` of an earlier centre. The first `thicketCount` centres are thickets, the next `standCount` are stands and the next `outcropCount` are outcrops, with IDs from 0 in draw order.
2. **Bushes.** For each thicket in turn, bushes are drawn uniformly in the square around its centre and kept if they lie within `thicketRadiusCm` of it and at least `bushSpacingCm` from the thicket's earlier bushes, until it has `bushesPerThicket`. Bush IDs run from 0 across thickets in order.
3. **Trees.** The same for each stand, with `standRadiusCm`, `treeSpacingCm` and `treesPerStand`.
4. **Stones.** The same for each outcrop, with `outcropRadiusCm`, `stoneSpacingCm` and `stonesPerOutcrop`.
5. **Starts.** With `scattered` on, each forager's start, which is its first hearth, is drawn from a start stream of its own, uniformly over the valley in forager ID order, rejecting a draw within `startSpacingCm` of an earlier start. With it off, the band starts as one group, its flag at the camp and its hearths on the rings round it.

The wood plants are the trees, by ID, then the bushes: wood plant `treeCount + b` is bush `b`. A bush holds up to `bushCapacityKcal` of berries and `bushCapacityWood` of sticks, and a standing tree up to `treeCapacityWood` of branches; each regrows its share of a day's regrowth in the first minute of every hour, up to capacity, except a felled tree's branches, and a crown above capacity keeps what it has. A standing tree holds `logsPerTree` logs; it is felled by the first log cut from it, and the minute it fell is kept until it stands again. A stone spot holds `stonesPerSpot` stones, which never regrow. `createValley` refuses a configuration whose layout or starts cannot be drawn in 10,000 draws.

**Places.** Place `p` covers column `p mod n` and row `floor(p / n)`, where `n = ceil(valleySizeCm / placeCm)`: a square `placeCm` wide, cut at the valley's edge. A place lies wholly within sight when all four of its corners do.

**Skills.** Each forager's born foraging, wood and craft skills are drawn from the skill stream: foraging and wood uniformly from `skillMinPercent` to `skillMaxPercent`, and craft from a stream of its own, so that drawing it leaves the other skills as they were, uniformly from `craftSkillMinPercent` to `craftSkillMaxPercent`. Its rates for a day are the base rate times born skill times practice, rounded down; its craft is born craft skill times practice over 100, rounded down, at least 1. Its practice at a task is the seconds `s` it spent at it over its last `practiceDays` days, giving

`P(s) = practiceMinPercent + floor((practiceMaxPercent − practiceMinPercent) · s / (s + 3,600 · practiceHalfHours))`.

Every day of the starting log holds `3,600 · startPracticeHoursPerDay` seconds at picking and gathering, and none at making axes. With `craftPractice` off, craft practice is 100% whatever the log.

## The forager

| State | Meaning |
| --- | --- |
| `x`, `y`, `hearth` | Its position and its hearth, in whole centimetres |
| `energyKcal`, `hungry` | Its reserve, and hunger with hysteresis: hungry below `hungryBelowKcal`, until it reaches `satiatedAtKcal` |
| `carried` | Food it carries, as lots picked in one minute, oldest first; a lot picked `shelfLifeHours` ago spoils |
| `wood`, `shortOfWood`, `tripWood` | Wood it holds, wood need with hysteresis, and wood gathered since it last stood at its hearth |
| `log`, `stone` | Whether it carries a log, and the stones it holds |
| `bushMemory`, `woodMemory` | For each bush, the berries it last saw there, and for each wood plant its sticks or branches, with the minute, or never |
| `logMemory`, `stoneMemory` | For each tree, the logs it last saw on it, and for each stone spot its stones, with the minute, or never |
| `placeSeen`, `siteKnown`, `siteChecked` | For each place, the first minute it lay wholly in sight; for each thicket, stand and outcrop, whether it has spotted it and the last minute it checked it |
| `groupId`, `knownFlags`, `exploreTarget` | Its group, the flags it has seen and not since found gone, and the place it is walking to |
| `practiceLog`, rates, `craft` | Its seconds at picking, gathering and making axes on each of its last `practiceDays` days, its rates and its craft for the day |
| `hut` | The hearth its hut stands at and the logs it holds, or none |
| `axe`, `spareAxe` | The axe it uses and an axe it made for sale, each with its quality, the logs it has left and its maker, or none |
| `making`, `chopRemainder` | An axe it is making, with the seconds worked and needed and whether it is for sale; the part of a log it has cut |
| `promised` | Whether it has promised to make an axe for sale |
| `heardTerms`, `heardAsk`, `trip` | The last terms for wood it heard; the best asking price for an axe it heard, the axe's quality, whether it is made yet, and the minute; and a trip to gather wood to sell |
| remainders, `fireHour`, `warm` | Remainders in 3,600ths of picking, gathering and energy owed; the hour of its last fire decision and whether a fire warms it that hour |
| `fireGiven`, `warmByFireMinutes` | The wood it has put into any group's fire, and the minutes it has slept warm by one |
| axe totals | Axes made, for itself and for sale, sold, bought and worn out; food received and paid for axes; logs cut; minutes asleep in its whole hut |

A forager starts at its hearth with `initialReserveKcal`, nothing carried, no wood, no stone, log, axe or hut, and having seen nothing.

A group has an ID from 0 in order of founding, a flag, the minute it was founded and dissolved, its members in order of joining (member `i` sleeps in its hut on slot `i` of the rings round the flag), and its fire: `fireWood`, `fireLit`, the wood each member has `given`, and the wood burned and night hours lit and out.

A hut stands where it was begun. If its builder's hearth moves, because it joins a group after the one it built with dissolved, the hut is abandoned where it stands and rots there; its logs are counted as abandoned.

## The minute

Each minute runs these phases in order.

0. **Practice and weathering.** In the first minute of every day after the first, each living forager enters yesterday's seconds in its log, drops the oldest day, and takes its rates and craft for the day. Every hut, standing or abandoned, whose day has come loses a log: forager `i`'s hut on days where `(day + i) mod hutLogDays = 0`. Every felled tree with no logs left that fell at least `treeRegrowthDays` ago stands again whole.
1. **Regrowth.** In the first minute of every hour after minute 0.
2. **Fires.** At the start of every hour: if it is night, each standing group's fire burns `campfireWoodPerHour` and is lit if it holds that much, and is out otherwise. By day every fire is unlit.
3. **Turn order.** A seeded shuffle of the band, from a stream derived from the run seed and the minute.
4. **Turns.** Each living forager in that order:
   1. **Spoilage** and **eating** from what it carries, oldest first, up to the room in its reserve.
   2. **Observation.** It records the berries on every bush and the wood on every wood plant within close sight, `perceptionRadiusCm`. Its long sight is `sightRadiusCm` by day and close sight at night: within it, it spots every site, records the logs on every tree and the stones on every stone spot, which can be seen from afar, marks every place never seen before as seen, learns every standing flag and forgets every known flag whose spot holds none. It checks every site whose centre lies within `perceptionRadiusCm` less the site's radius.
   3. **Decision.** Hunger and wood need are updated; then the first rule that applies (see [Rules](#rules)). Its speed this minute is set by the load it carries as it sets out.
   4. **Action.** The minute's 60 seconds.
   5. **Meeting.** A forager without a group meets the nearest living forager within `talkRadiusCm`, if any: it joins a member's group, taking the next slot round its flag, or the two found a new group with the flag at their midpoint.
   6. **Exchange.** Swaps and quotes of wood with members of its own group within `talkRadiusCm`; then asking, promising and selling axes.
   7. **Feeding.** A member at its hearth feeds its group's fire.
   8. **Building.** A member at its hearth carrying a log lays it in its hut.
   9. **Eating again** and **metabolism.** Each second's hourly cost is added to its cost remainder and the whole kilocalories are paid. At 0 it dies of starvation; if that leaves its group with one living member or none, the group dissolves, and its survivor takes back the fire's wood. What a dead forager held, its log, stones and axes, stays with it.
5. **Record.** Events, the day's summary, and the invariants.

### Rules

Let `D` be the daylight seconds left in the minute, 0 at night. A forager's speed under a load of `L` kilograms, its trip's wood, its log at `logKg` and its berries at `berryKcalPerKg`, is `floor(walkCmPerSecond · bodyKg / (bodyKg + L))` centimetres a second; each second of walking costs `travelKcalPerHour` whatever the load. A plant, stone spot or point can be reached in time if walking there, a minute's work there, and walking home take at most `D` seconds.

| Priority | Condition | Action | Reason recorded |
| --- | --- | --- | --- |
| 1 | Away from its hearth, and it is night or walking home takes at least `D` | Walk home | `going home` |
| 2 | It is night | Sleep | `night` |
| 3 | Carrying a log | Walk home | `taking a log home` |
| 4 | Not hungry, and filling a load: `0 < tripWood < woodLoad` | Work for wood | `filling a load` |
| 5 | Not hungry, and carrying a full load | Walk home | `taking a load home` |
| 6 | Neither hungry nor short of wood, and without a group | Walk towards the nearest forager it sees, or to its nearest known flag it can reach and return from before dusk, or explore | `seeking company`, or `waiting for company` at the flag |
| 7 | A member neither hungry nor short of wood, making an axe | Walk home and work on it | `making an axe`, or `going home to make an axe` |
| 8 | A member neither hungry nor short of wood, its hut not whole, and holding an axe (or a spare, which it takes up) | Cut a log at the nearest felled tree it knows holds one and can reach in time, else the nearest standing tree, walking to it first if needed | `cutting a log` or `seeking a tree` |
| 9 | A member neither hungry nor short of wood, its hut not whole, holding no axe, and it has heard of an axe for sale worth more to it than the ask | If the axe is not made yet, wait at its hearth. Otherwise pick food until it carries the price at the midpoint, then wait at its hearth | `waiting for an axe being made`, `picking food to buy an axe`, `taking food home to buy an axe` or `waiting to buy an axe` |
| 10 | A member neither hungry nor short of wood, whose hut is not whole and who holds no axe, or who has promised an axe | Make an axe: fetch a stone from the nearest stone spot it knows holds one and can reach in time, if it holds none; then, holding `axeWood`, begin at its hearth | `fetching a stone`, `picking up a stone`, `making an axe` |
| 11 | Neither hungry nor short of wood, and somewhere to explore | Walk towards the nearest place never seen, or else to the nearest site not checked for `exploreAfterHours` | `exploring` or `checking` |
| 12 | Neither hungry nor short of wood | Rest | `satiated` |
| 13 | The choice of work says wait | Rest | `waiting to swap` |
| 14 | It remembers no plant of the good worth a minute's work that it can reach in time, and knows a site of that kind it has never checked, or a place it has never seen, that it can reach and return from before dusk | Walk towards the nearest such site, or else the nearest such place | `searching` |
| 15 | No plant of the good that it can reach in time | Rest | `too late to set out` or `waiting for regrowth` |
| 16 | Otherwise | Work at its target plant, walking to it first if needed | `foraging`, `gathering`, `seeking food` or `seeking wood` |

A rule from 7 to 10 that finds nothing it can reach in time, no tree with a log or no stone, falls through to the next. Rule 10 needs `axeWood` in hand; a member short of it is short of wood, and gathers.

**The choice of work.** A hungry forager works for food, unless terms it remembers make selling wood pay, when it gathers wood to sell enough for the food it lacks. A forager short of wood gathers wood, unless terms it remembers make buying pay, when it picks food to buy wood with, or waits if it already carries enough. A forager's own terms are its foraging rate over its wood rate.

**The target plant.** It keeps its target unless it has just seen the plant holding less than a minute's work, `ceil(rate / 60)`, or can no longer reach it in time. Otherwise, working for wood, it chooses the nearest felled tree it saw from afar and remembers holding a minute's work of branches; then the nearest plant it remembers holding a minute's work, ties to the lowest ID; and, with nothing left to search, the one it saw longest ago. Searching for wood goes to thickets as well as stands, when bushes hold sticks.

**Swaps.** Two members within talking distance swap when one has spare wood and the other wants wood, each at terms that pay it: the midpoint of their own terms, as whole kilocalories a kilogram. The amount is the least of the seller's spare wood, the buyer's wanted wood, what the buyer's carried food can pay for, and what the seller has room to eat. When nothing can change hands, they tell each other the terms, and every member within talking distance of a swap hears its terms.

**Axes.** Let `c` be a member's craft. Making takes `ceil(3,600 · axeHours · 100 / c)` seconds and costs it `ceil(seconds · (forageCostKcalPerHour − restKcalPerHour) / 3,600)` kilocalories: its **ask**. It expects to make an axe of quality `floor(3c / 4)`, and an axe of quality `q` is worth `floor(ask · q / floor(3c / 4))` to it. In its exchange, with `axeTrade` on:

- A member with a spare axe tells every member within talking distance its ask and the axe's quality. A member hearing it keeps the best: a made axe over one promised, then the lowest ask, then the better axe.
- It sells the spare to the first member within talking distance, in ID order, that needs an axe, holds none and is making none, if the axe is worth more to that member than the ask: at the midpoint, rounded down, paid in the buyer's oldest carried food, if the buyer carries that much and the seller has room to eat it.
- A member that needs an axe, holds none and is making none tells every member within talking distance. If none of them holds a spare or has promised one, the one with the lowest ask that does not need logs itself, is making no axe, and whose expected axe is worth more to the asker than its ask, ties to the lowest ID, promises to make one. The asker hears the promise as an ask for an axe not made yet, of the promiser's expected quality.
- It buys from any member within talking distance holding a spare worth more to it than the ask, on the same terms.

A heard ask is remembered for `termsMemoryHours`, and replaced by a better one or by any ask heard an hour later. A member forgets an ask when it stands within talking distance of the seller and the seller has neither a spare nor a promise.

### The 60 seconds

A forager walks towards its hearth, a place or site, another forager, a stone spot, or a point `reachCm` short of its plant, at its speed, and arrives within the minute if it can. Having arrived at a plant holding a minute's work, it works the seconds left: its remainder for the task grows by its hourly rate times the seconds, and it takes the whole units. Picked food is eaten until the reserve is full and the rest carried; gathered wood adds to its wood and its trip.

Cutting, it works the seconds left at the tree: its cut grows by the seconds times its axe's quality, and when it reaches `6,000 · logChopMinutes` a log comes off the tree, the rest carries over, it carries the log, and its axe has one log fewer left. If the tree stood, it falls: `fellWood` is added to its branches. An axe with none left is worn out and thrown away; the cut so far is lost. At a stone spot it takes one stone in the seconds left. Making, it puts its stone and `axeWood` into the axe when it begins, and works the seconds left at its hearth; when the seconds worked reach the seconds needed, the axe's quality is drawn from the axe stream for that forager and minute, uniformly from `floor(c / 2)` to `c`, and it becomes the member's axe, or its spare if made for sale, which ends its promise.

Otherwise it stands. Asleep, a member is warmed by its group's fire if it is lit; a forager without a group burns `fireWoodPerHour` at the start of each hour it sleeps if it holds that much, and has no fire otherwise. Either sleeps in its hut if a whole one stands at its hearth. Picking, gathering, cutting, fetching stones and making cost `forageCostKcalPerHour`, walking `travelKcalPerHour`, standing `restKcalPerHour`, and sleeping the cost of its warmth: `sleepKcalPerHour` with fire and hut, `fireSleepKcalPerHour` with a fire alone, `hutSleepKcalPerHour` in a hut alone, and `coldSleepKcalPerHour` with neither.

## Defaults

| Parameter | Canonical value | Parameter | Canonical value |
| --- | --- | --- | --- |
| `valleySizeCm` | 60,000 | `bandSize` | 8 |
| `thicketCount`, `bushesPerThicket` | 32, 60 | `shelfLifeHours` | 48 |
| `thicketRadiusCm`, `bushSpacingCm` | 1,200, 200 | `fireWoodPerHour`, `coldSleepKcalPerHour` | 1, 150 |
| `bushCapacityWood`, `bushRegrowthWoodPerDay` | **2, 1** | `fireSleepKcalPerHour`, `hutSleepKcalPerHour` | **80, 120** |
| `bushCapacityKcal`, `bushRegrowthKcalPerDay` | 400, 20 | `woodStockNights`, `woodLoad` | 2, 30 |
| `standCount`, `treesPerStand` | **12, 12** | `skillMinPercent`, `skillMaxPercent` | 100, 100 |
| `standRadiusCm`, `treeSpacingCm` | 1,500, 400 | `termsMemoryHours` | 24 |
| `treeCapacityWood`, `treeRegrowthWoodPerDay`, `fellWood` | 25, 6, **10** | `practiceDays`, `practiceHalfHours` | 30, 60 |
| `siteSpacingCm`, `siteMarginCm`, `campClearingCm` | 5,000, 3,000, 4,000 | `practiceMinPercent`, `practiceMaxPercent` | 50, 150 |
| `hutRingCm`, `walkCmPerSecond`, `reachCm` | **700**, 125, 100 | `startPracticeHoursPerDay` | 2 |
| `perceptionRadiusCm`, `talkRadiusCm`, `sightRadiusCm` | 2,500, 2,000, 100,000 | `scattered` | true |
| `dawnHour`, `duskHour` | 6, 18 | `startSpacingCm`, `placeCm` | 5,000, 3,000 |
| `forageKcalPerHour`, `woodPerHour` | 1,200, 24 | `exploreAfterHours` | 24 |
| `sleepKcalPerHour`, `restKcalPerHour` | 60, 90 | `bodyKg`, `berryKcalPerKg` | 60, 500 |
| `forageCostKcalPerHour`, `travelKcalPerHour` | 300, 300 | `campfireWoodPerHour` | 1 |
| `reserveMaxKcal`, `initialReserveKcal` | 20,000, 16,000 | `hungryBelowKcal`, `satiatedAtKcal` | 14,000, 18,000 |
| `outcropCount`, `stonesPerOutcrop` | 4, 12 | `outcropRadiusCm`, `stoneSpacingCm` | 1,000, 300 |
| `stonesPerSpot` | 5 | `logsPerTree`, `treeRegrowthDays` | 3, **60** |
| `logKg`, `logChopMinutes` | 20, 30 | `hutLogs`, `hutLogDays` | **23**, 10 |
| `axeHours`, `axeLogs`, `axeWood` | 4, 40, 1 | `craftSkillMinPercent`, `craftSkillMaxPercent` | 100, 100 |
| `axeTrade`, `craftPractice` | true, true | `initialTreeWood`, `initialBushWood` | 25, 2 |

`createValley` refuses a configuration with a value that is not an integer or a switch that is not a boolean; sizes, counts, rates and radii that are not positive, or amounts that are negative; a reach as long as close sight; starting stocks above capacity; hours, hunger thresholds or costs out of order, including working that costs no more than resting and sleep costs out of the order fire and hut, fire, hut, neither; no logs on a tree; skill, craft or practice ranges out of order, or rates that round to nothing or exceed what a plant holds in a minute, a bush that holds sticks included; a log heavier than a forager can carry at walking speed 1; a band around the camp whose huts would not fit in its clearing, or of fewer than two; a place too large to see whole from its centre; long sight shorter than close sight; and a site too wide to check from inside close sight.

## Invariants

Checked after every minute of every checked run, by `src/valley/invariants.ts`:

- **Energy is conserved exactly.** Bush stock, reserves, carried food, food eaten and spoiled equal the food at minute 0 plus regrowth, through swaps of wood and sales of axes alike.
- **Wood is conserved exactly.** Sticks on bushes and branches on trees, wood held by foragers and in fires, wood burned, and wood in axes made, equals the wood at minute 0 plus regrowth plus branches brought down by felling.
- **Logs are conserved exactly.** Logs on trees, carried, in huts, rotted and abandoned equal the logs at minute 0 plus regrowth.
- **Stones are conserved exactly.** Stones on the ground and held, plus axes ever made, equal the stones at minute 0; axes held, as axes or spares, plus axes worn out, equal axes ever made.
- Every plant's and stone spot's stock is replayed from regrowth and recorded work, and every tree's fall and regrowth: a tree falls only at its first cut, which finds it holding every log, and stands again only as a stump on its day.
- One turn per living forager each minute; its seconds add up to 60; it moves no further than its walking seconds at the speed its recorded load allows, and its load is no more than the wood of its trip and its log.
- Work only in daylight, on a plant within reach holding a minute's work, at a tree within reach holding a log, at a stone spot within reach holding a stone, or at its own hearth; memory of the plant or spot worked or targeted, and every hour of everything in view, matches what it saw.
- Places first marked seen lie wholly within sight; every site within sight is known, and checked exactly when the forager stood close enough; a walk to a place or site aims at one worth it and ends no further from it.
- A forager not hungry with a full load or carrying a log never idles, explores, checks, seeks company or makes axes, and only one with a log or a full load takes it home, towards the hearth it had while it acted.
- Groups, replayed through each minute's foundings, joinings and dissolutions in turn order, as in Life 8; swaps, quotes, asks, promises and sales stay within a group.
- Fires burn and are fed as in Life 8; every sleeper's warmth names its hut exactly when it sleeps in a whole one, a member's names the fire exactly when its group's fire is lit, a forager that burned wood has its fire, and only a sleeper with neither sleeps cold.
- A hut gains a log only from its builder standing at it carrying one, and loses one only on its day; a whole hut holds `hutLogs` logs.
- An axe's quality lies between half its maker's craft and its craft when made; its logs left start at `max(1, floor(axeLogs · q / 100))` and fall by one with each log cut. Every sale is from a member holding a spare to a member that needs an axe and holds none, at a price between the seller's ask and the axe's worth to the buyer, and agrees on both sides.
- Carried lots are whole, unspoiled and in order; practice logs, rates and craft follow from born skills and seconds worked, and change only at midnight; swaps pay both sides and agree on both sides.

## Theory

`src/valley/theory.ts`:

- **Time use, speed, checking, what a fire saves and gathering,** as in Life 8.
- **What a first hut takes.** A first axe is made at half one's craft: 8 hours, of quality 25 to 50. Ten logs at quality 37 take about 13.5 hours of cutting, plus 10 trips to the trees under 20 kg, at 93 cm a second.
- **What an axe costs.** At craft `c`, `840 · 100 / c` kilocalories: 1,680 at craft 50%, 840 at 100%, 560 at 150%. Between two equally able members an axe is worth exactly its ask, so neither gains by trading; trade needs a difference in craft.
- **What huts need.** Each hut loses a log every 10 days: 0.1 logs a member-day. An axe of quality 45 lasts 18 logs, so once huts stand a member wears out an axe about every 180 days. First axes are worse and huts take 23 logs, so a band of 8 makes about 32 axes over 400 days.
- **Logs on offer.** 144 standing trees hold 432 logs; felled and cut up at once, they could regrow at most 7.2 logs a day, against 0.8 a day that 8 huts weather away.
- **Capacity.** The valley regrows 38,400 kcal a day; a forager needs about 2,500 kcal a day, so it feeds about 15.

## Questions for later

Experiments wait for a stable version of the Life engine, so this step has none. The questions it is built to answer:

- Do axes concentrate with whoever makes the most, through practice alone, in a band born alike?
- Does trade follow born talent instead, when craft differs from birth (`craftSkillMinPercent` 50, `craftSkillMaxPercent` 150)?
- What changes with `axeTrade` off, or `craftPractice` off?
- How many can the valley feed with huts and axes to keep up?
- How much food does a hut save a member over a year, against the work of keeping it whole?


## Ledger and metrics

- **Events.** As in Life 8, with: each forager's action every minute also recording the log or stone it took or laid and the axe work it did; a **cut** event for each log, with the tree, the axe's quality and logs left; a **made** event for each axe, with the maker, its craft, the quality drawn, and whether for sale; a **worn** event for each axe thrown away; **promise** and **sale** events, a sale recording the price, the seller's ask and the axe's worth to the buyer; a **weather** event for each log a hut loses; and an **abandon** event when a hut is left behind.
- **Daily summaries,** for the band: as in Life 8, with logs cut, axes made, sold and worn out, huts whole and member-minutes asleep in a whole hut; and for each forager: as in Life 8, with seconds cutting and making, logs cut, axes made, sold and bought, its craft, and the logs in its hut.

## Observer

`life.html` is "Life 9.5 · huts round the fire". It works like a strategy game that can be paused and sped up but not controlled.

- **The valley.** As in Life 8, with: standing trees whose crowns fill out with their branches; a felled tree lying where it fell beside its stump, its trunk shortening as logs are cut from it and its crown, flat on the ground at the far end, shrinking as its branches are gathered, until only the stump is left; outcrops of grey stones that shrink as they are taken; a hut at each member's slot on the ring round its group's fire, built to one plan, an A-frame 2.4 m long, about 1.5 m wide and 1.2 m tall with its open end towards the flames: first the two A's, then the walls from the ground up, the ridge and the posts across the back, each log shown once laid and resting on the ground or on logs laid before it, and the last laid the first to go when a log rots; a member asleep lying inside its hut, feet towards the fire, with its wood stacked beside the hut; a fire of its own, in a ring of stones, only for a forager without a group; a forager carrying a log on its shoulder, swinging an axe at a tree, and kneeling at its hearth making an axe. There is no deadwood anywhere.
- **Following a forager.** The HUD shows, as well as Life 8's: its craft and practice at making axes, the axe it holds and its spare, each with quality and logs left and who made it, the axe it is making and how far along, any promise, the ask it last heard, its hut's logs, and the axes it has made, sold and bought.
- **Selecting a group.** As in Life 8, and the group card gains a table of axes: one row per member, with axes made for itself and for sale, sold and bought, food received and paid, its craft, and the quality of its axe. A sentence names the member who has made the most axes for others, if anyone has.
- **Inspecting** a bush shows its berries and sticks; a tree its branches, its logs, whether it stands, lies felled or is a stump, and when it grows back; a stone spot its stones; a hut its logs and the day it next weathers.
- **History and setup.** As in Life 8, with charts of axes made, sold and worn out each day and of huts whole; the setup's numbers and the switches.

## Code layout

| File | Contents |
| --- | --- |
| `src/valley/types.ts`, `config.ts` | State, configuration, defaults and validation |
| `src/valley/layout.ts`, `geometry.ts` | The layout, plant and stone indexes, streams and integer geometry |
| `src/valley/forager.ts`, `food.ts`, `work.ts`, `practice.ts` | A forager's observation, needs, choices, carried food, work and practice |
| `src/valley/sites.ts`, `social.ts` | Sites, places, exploring and searching, flags and groups |
| `src/valley/trade.ts`, `fire.ts` | Wood need, swaps and quotes, and the shared fire |
| `src/valley/huts.ts`, `axes.ts` | Huts, logs and weathering; making, cutting, wear, asks, promises and sales of axes |
| `src/valley/engine.ts` | The minute |
| `src/valley/invariants.ts`, `theory.ts` | The invariants and theory above |
| `src/valley/*.test.ts` | Unit tests, including `huts.test.ts` for huts, axes and trade, and `fingerprints.test.ts` |
| `src/valleyView/` | The observer |

Nothing under `src/sim` changes, so MVP9 keeps its trajectory bit for bit.

## Tests

- Configuration validation, one case per rule.
- The layout and its streams, including outcrops and stones, and that drawing craft leaves the other skills unchanged; a forager's minute, choosing a plant, eating, spoilage and swaps; places, meeting, founding, joining and dissolving; sight, sites, exploring and searching; loads, speed and taking a load or log home.
- Fires and feeding as in Life 8; the four warmths, from a whole hut by a lit fire to neither, and what each costs.
- Huts: on rings round the fire, 8 on the first and 16 on the second; a log laid at the hearth only, whole at `hutLogs`, weathering on its day, abandonment when the hearth moves.
- Trees and firewood: the first cut fells a tree and brings its crown down, the rest are cut where it lies, a felled tree is finished before another is felled, a stump grows back on its day, branches regrow on standing trees only, and sticks are gathered from bushes.
- Axes: making takes the seconds its craft gives and can be interrupted; quality within its range; cutting at the speed quality gives; wear and throwing away; a maker taking up its spare.
- Trade: an ask heard and kept; a promise only from the cheapest maker that gains the asker; a sale only when both gain, paid in carried food within the seller's room; nothing sold, asked or promised with `axeTrade` off or outside a group.
- Determinism and purity: `stepValley` never changes its input, and `n` steps equal one run of `n` minutes.
- The invariants catch damage to each kind of record, including a tree felled without a record, a warmth that does not match the fire, a log or stone lost or made from nothing, a hut that grows away from its builder, an axe of impossible quality, and a sale at a price outside the two sides' terms.
- **Fingerprints.** Life 9.5 runs exactly as recorded: 30 days on three seeds for the canonical valley, a band that starts together, practice off, born talent, a band of 12 and unequal skills match recorded fingerprints of their daily summaries and totals.
- Observer: drawing between minutes, plants, standing and felled trees, stones, the hut plan (a piece list for every log, no log cut into more wood than it holds, and every piece resting on the ground or on one laid before it), huts turned to the fire, the camera, groups and what a forager knows, the axes table. The huts, sleepers in them, felled trees and logs carried are checked in the browser.

## Not in Life 9

Other tools and recipes; shelter shared by a group, or huts for foragers without one; huts that must be torn down or moved; claims on trees, stones or huts, or stealing them; lending or renting axes; promises that bind, or debts; teaching; hunting; fires that warm other groups or strangers; choosing not to feed the fire; cooking; giving food; members changing group; stands blocking the view; telling others where food is; and caches of food. Each arrives with the step whose question needs it.

## References

- Arrow, K. J. (1962). The economic implications of learning by doing. *Review of Economic Studies*, 29(3), 155–173.
- Beardwood, J., Halton, J. H., and Hammersley, J. M. (1959). The shortest path through many points. *Mathematical Proceedings of the Cambridge Philosophical Society*, 55(4), 299–327.
- Rosen, S. (1983). Specialization and human capital. *Journal of Labor Economics*, 1(1), 43–49.
- Smith, A. (1776). *An Inquiry into the Nature and Causes of the Wealth of Nations*, book I, chapters 1–3.
- Wiessner, P. W. (2014). Embers of society: Firelight talk among the Ju/'hoansi Bushmen. *Proceedings of the National Academy of Sciences*, 111(39), 14027–14035.
