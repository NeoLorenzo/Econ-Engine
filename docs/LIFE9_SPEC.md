# [LIFE9-HazelAndLake-048]

Life 9 is the bottom-up core described in the [merge document](MERGE.md#the-ladder), and the only version of it in the repository. Earlier steps built it one mechanism at a time and live on in git history; this document describes the whole simulation as it stands.

A band of foragers lives in a small valley above a lake, simulated minute by minute in whole centimetres, kilocalories and kilograms. They pick berries bush by bush, gather hazelnuts, fish from the shore, gather sticks from bushes and dead branches from under trees, eat, carry food that spoils, burn wood against cold nights, swap wood for food, and get better at what they practise. They start scattered and know only what they have seen. By day they see across the valley, and they check the thickets, stands and outcrops they know when their needs are met. A load costs them energy and slows them a little, and they take a full load home before anything else. Those without a group look for company; two who meet found a group and plant a flag, and anyone who meets a member joins. Each group keeps one fire at its flag, which warms every member asleep on the ring of huts round it.

New in Life 9: every member wants a hut of its own. A hut is built of logs, and logs can only be cut from trees with an axe: the first cut fells a tree whole, and the rest of its logs are cut from the trunk where it lies. Nobody wants an axe for itself; a member makes or buys one only because its hut needs logs. An axe is made at the hearth from a stone picked up at an outcrop and a kilogram of wood. A forager who has made more axes lately makes them faster and better, and better axes cut faster and last longer. Axes wear out, and huts weather, so the need for logs, and so for axes, never ends. Members may sell axes to each other for food.

Life 9.5 revises Life 9 without moving up the ladder, after the owner watched it run. There is no deadwood: firewood is sticks from bushes and branches from trees, and a felled tree's crown brings more branches down. A tree comes down whole and grows back from its stump. A group's huts stand on a ring round its fire, far enough apart to walk between, each facing the flames, and a member sleeps inside its hut. A hut keeps its sleeper a little warm, the fire more, and both together most. Only a forager without a group has a fire of its own.

Life 9.6 revises Life 9.5 without moving up the ladder: every physical number is set from real-world measurements, recorded with their sources in the [calibration document](CALIBRATION.md). The valley is in temperate northern Europe in the Mesolithic: bilberries, birch and flint, with cool nights. A bush gives about 1.5 kg of berries a year, spread evenly over the year for now, so the valley feeds one or two people, not eight. Implemented, the band does not shrink to that: all its members run down their reserves together and starve within a few days of each other, about four weeks in. Bodies carry a realistic store of fat, so hunger takes weeks to kill. A load costs energy by the Pandolf equation and hardly slows a walker. Each task costs its own energy. Firewood is mostly dead branches fallen beneath trees. Trees take 20 years to grow back, axes are ground stone and take days of work to make, and huts last years.

Life 9.7 revises Life 9.6 without moving up the ladder. Life 9.6 starved every forager because the valley offered only berries, which no real Mesolithic band lived on. The owner chose to change the land, not the bodies: the valley gains the two foods that fed Mesolithic northern Europe best, hazelnuts and fish, with every number set from real measurements or marked as an estimate. Hazel thickets give far more food an hour than berries, and the nuts keep for months. A lake along the valley's north shore holds a stock of fish that regrows fastest when half fished out, so it can be fished down. To make room for the hazel the valley grows from 600 m to 800 m across. All together the valley feeds about seven, a little less than the band. Life 9.7 also ends the way the whole band died at once in Life 9.6: food comes more slowly as a source thins, so thin sources can still be worked by whoever gains from them, and foragers are born with different foraging skill, so when food runs short the least able go hungry first instead of everyone together. Implemented, the band lives on hazelnuts for about half a year, turns to berries and fish as the hazels thin, and by the end of a year its members' reserves have spread far apart instead of falling together.

## Question

Do tools concentrate in the hands of those who make them, and does making them become a trade?

It could go either way. Every member needs an axe from time to time, and an axe takes only hours to make, so everyone could simply make their own, as everyone gathers their own wood. But a member who has made axes lately makes them faster and better, so whoever happens to make the most could become cheap enough that the others would rather buy from it, and keep it practised by buying. Or the trade could follow born talent instead of practice, and the gifted would make axes while the clumsy buy. And trade could fail altogether: an axe costs hours of work, which must be paid in fresh food carried at the moment of sale.

## What a quick prototype showed

Before the design was settled, a throwaway prototype showed that two rules are needed for axes to change hands at all. Without a promise, a member whose axe wore out started making its own in the same minute that others offered to make one, so almost no axe was ever sold. And priced at hours of picking forgone, an axe cost more fresh food than a buyer could carry. Both rules below come from that. In the implemented valley, axes are sold in nearly every run, and a band that starts as one group tends to end up with one member making most of its axes. Measuring this properly is left for later (see [Questions for later](#questions-for-later)).

## Why the band died, and what Life 9.7 changes

Two things killed the whole band in Life 9.6, and they need different fixes.

**The land fed two, not eight.** The valley's 36 hectares held only berries: about 1.7 million kcal a year against the band's 7 million or more. Real Mesolithic people in northern Europe did not live on berries. Their camps are full of roasted hazelnut shells, tens of thousands at a time at Staosnaig [S1] and Duvensee [S2], where nuts gave very high returns for the work, and they lived beside lakes, rivers and coasts and fished. So Life 9.7 adds hazel and a lake, at realistic yields. The lake turns out to matter far less than the hazel: lakes in a northern climate yield only a few to a few tens of kilograms of fish a hectare a year [S5], so a lake is a reserve that can be fished down in a bad time, not a staple. The hazel needs room, so the valley grows to 800 m across.

**Everyone ran down together.** Born alike and eating from the same bushes, all eight foragers lost weight at the same rate and reached zero within days of each other. When the first died, the bushes left held less than a minute's picking, which the rules did not let anyone take, so the rest starved beside the last berries. In real famines people do not die together: some find food better than others, and the food the dead no longer eat keeps the rest alive. Life 9.7 makes both true:

- **Food comes more slowly as a source thins.** A picker among sparse berries, or a fisher in a fished-out lake, takes less in an hour. A forager's rate at a bush, hazel or the lake is its full rate times the share of the source still there, and there is no longer a minute's worth it must find before it may start. It stops working a source when an hour there would give less than the hour costs, so a little is always left to regrow.
- **Foragers are born with different foraging skill,** from 75% to 125% of the base rate. Individual returns differ widely among real foragers [S8]. When food is short, the least able get less of it, go hungry first and, if it stays short, die first, and the band shrinks to what the valley feeds instead of vanishing.

These fixes are not a guarantee that someone survives. A valley that feeds nobody still kills everyone; the change is that a valley that feeds some lets those some live.

## The new numbers

Each is measured, derived from measurements, or an estimate, as in the [calibration document](CALIBRATION.md), which gains these rows when Life 9.7 is implemented.

| Parameter | Value | Real world | Trust |
| --- | --- | --- | --- |
| `nutKcalPerKg` | 2,500 kcal a kg of nuts in their shells | Hazelnut kernels 628 kcal per 100 g [S3]; about 250 per 100 g weighed with shells [S4], the kernel being 35 to 45% of the weight | Measured |
| `hazelRegrowthKcalPerYear` | 3,750, 1.5 kg of nuts in their shells | Wild woodland hazel about 400 kg a hectare [S6]; varieties in trials 126 to 448 kg a hectare [S6]; garden bushes 2 to 5 kg, alternating heavy and light years [S7] | Measured, then derived: 40 bushes on a thicket 20 m in radius are 318 a hectare, giving 477 kg a hectare, at the top of the wild range |
| `hazelCapacityKcal` | 1,875, half a year's nuts | Fallen nuts lie for months, but rodents take many | Estimate |
| `nutKcalPerHour` | 3,500 at a full bush | Hand collection from the ground 4.5 to 8 kg an hour in orchards [S9]; wild bushes are sparser, and the nuts must be cracked. About 1.4 kg in their shells an hour, gathered and cracked | Derived from orchard rates, then estimate |
| `nutShelfLifeHours` | 4,380, half a year | Dry hazelnuts in their shells keep for months | Estimate |
| `lakeHectares` | 30, the water along the valley's north shore, 800 m by 375 m | | Choice |
| `lakeFishKgPerHectare` | 100 kg a hectare, 1,800,000 kcal for the lake | Perch alone 16 to 44 kg a hectare in a Finnish lake [S10]; a whole fish community up to about 540 kg a hectare in a rich reservoir [S10] | Measured, then estimate |
| Fish yield | `lakeGrowthPercentPerYear` 40: at most 10 kg a hectare a year, at half the stock | 166 northern Finnish lakes yielded 0.2 to 43 kg a hectare a year [S5] | Measured, then derived |
| `fishKcalPerKg` | 600 kcal a kg of whole fish | Raw perch and pike flesh about 900 kcal a kg [S3]; about two thirds of a fish is eaten with its roe and liver | Measured, then estimate |
| `fishKcalPerHour` | 600 at a full lake, 1 kg of fish | Anglers after perch catch 4 to 7 fish an hour [S11], about 0.5 to 1 kg | Measured, then derived |
| `fishShelfLifeHours` | 24 | Fresh fish spoils within a day unchilled | Estimate |
| Work at either | `pickKcalPerHour`, 200 | Fishing from a bank and gathering nuts are light work, as picking fruit is | Estimate |
| `skillMinPercent`, `skillMaxPercent` | 75, 125 | Return rates differ widely between individual foragers of the same age and sex [S8] | Measured, qualitative |

## Design decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| The drive for shelter | Every member wants a **hut** at its hearth, whole. A member's hearth is its slot on the ring round its group's fire, where its hut stands and it sleeps; it has no fire of its own there. Wanting logs for it comes after hunger and wood for the fire, and before exploring, checking and rest. Foragers without a group build nothing: they seek company first, and joining a group moves their hearth. | The owner's rule: shelter is an inherent drive. A hearth is fixed only once a forager belongs to a group. |
| Calibration | Every physical number comes from the [calibration document](CALIBRATION.md), which gives its source and how far it can be trusted. All of them apply at once. | The owner's rule: the numbers should be as realistic as possible. Realistic scarcity is what gives storage, land and trade a point. |
| Change the land, not the bodies | Life 9.7 adds hazel and a lake and enlarges the valley, and keeps every number for people from Life 9.6. | The owner's rule for Life 9.7. In Life 9.6 the owner chose to let the band shrink to what berries feed, and every forager starved. Berries alone are not a real Mesolithic diet. |
| Berries all year | A bush regrows `bushRegrowthKcalPerYear`, 900 kcal (1.5 kg at `berryKcalPerKg`, 600), spread evenly over the year. It holds at most `bushCapacityKcal`, 52, three weeks of ripening, and starts full. | Wild blueberry bushes give 1 to 2 kg a year. Real bushes ripen in one season; the owner chose to spread the yield evenly until seasons arrive. A ripe berry stays on the bush for a few weeks, so a bush holds about three weeks' yield at once. |
| Hazel thickets | A fourth kind of site: `hazelThicketCount`, 32, thickets of `hazelsPerThicket`, 40, hazel bushes, within `hazelThicketRadiusCm`, 2,000, and at least `hazelSpacingCm`, 400, apart. A hazel regrows `hazelRegrowthKcalPerYear`, 3,750 kcal of nuts, spread evenly over the year, holds at most `hazelCapacityKcal`, 1,875, and starts full. Nuts are seen only up close, like berries. A hazel gives no sticks. | Hazelnuts were the staple plant food of Mesolithic northern Europe. Spread evenly until seasons arrive, as berries are. Hazel sticks are left out to keep wood unchanged; they are a question for later. |
| Nuts keep | Nuts are gathered at `nutKcalPerHour`, 3,500, at a full bush, weigh 1 kg for every `nutKcalPerKg`, 2,500, carried, and spoil after `nutShelfLifeHours`, 4,380. | Nuts in their shells keep for months. Gathering and cracking together are counted as one rate. Food that keeps is what storage at step 10 will build on, but Life 9.7 adds no store: a forager still carries only what it picked beyond a full reserve. |
| A lake on the north shore | The water beyond the valley's north edge is a lake of `lakeHectares`, 30. Its shore is the whole north edge, and a forager fishes standing on it at its own `x`. Nobody walks on the water. | Mesolithic camps sat by water. A lake along one edge needs no paths round it, since every straight walk inside the valley stays on land. |
| Fish | The lake holds one stock of fish in kilocalories, at most `lakeHectares · lakeFishKgPerHectare · fishKcalPerKg`, 1,800,000, and starts full. It regrows by the logistic rule, `lakeGrowthPercentPerYear`, 40, of the stock times the share of capacity still empty, each year, shared hour by hour. Fish are caught at `fishKcalPerHour`, 600, at a full lake, weigh 1 kg for every `fishKcalPerKg`, 600, and spoil after `fishShelfLifeHours`, 24. | Fish breed: a full lake gains nothing, a lake fished to half gains most, and an empty lake gains nothing. That is the standard model of a fish stock, and it makes fishing a lake out possible, as a berry bush's steady regrowth does not. At its best the lake gives 180,000 kcal a year, about 70 days of food for one forager: a reserve, not a staple. Fishing gear is not modelled. |
| Food comes slower as a source thins | A forager's hourly rate at a bush, a hazel or the lake is its full rate for that food times the stock there over the source's capacity, rounded down, and it never takes more than the source holds. A source is **worth working** while that rate is more than `pickKcalPerHour`. | A picker among sparse berries finds fewer an hour, and so does a fisher in a thin lake. In Life 9.6 a bush with less than a minute's picking could not be picked at all, and the last foragers starved beside the last berries. Working only where it gains more than it spends is what any forager would do. |
| Choosing where to get food | A forager working for food weighs every bush and hazel it remembers as worth working and can reach in time, the nearest thicket and the nearest hazel thicket it has spotted and never checked, and the lake if it knows it, remembers it worth working and can reach the shore in time. It goes to whichever promises most food for the time: an hour there at its expected rate, over the walk there plus that hour. | A forager weighs a richer source further away against a poorer one nearby, as foraging theory expects. Implementation showed that weighing only the nearest bush and hazel worth working sent foragers to fish beside full hazels further off, so every remembered plant is weighed; the choice is made only when a forager needs a new source. |
| What a forager expects where it has not looked | It cannot see fish. It remembers the stock it found when it last fished, and before it has fished expects a full lake. It knows the lake once it sees any of its shore. A thicket it has spotted from afar and never checked it expects full, at its full rate for that food. | Information it could plausibly have (design rule 1): a fisher learns a lake by fishing it, and anyone knows a hazel thicket when they see one. Implementation showed that without the second rule, a forager that knew the lake fished it rather than look into hazel thickets it could see. |
| Born foraging skill differs | Each forager's born foraging and wood skills are drawn from `skillMinPercent`, 75, to `skillMaxPercent`, 125. One foraging skill serves berries, nuts and fish. | The heterogeneity represents something real (design rule 19): foragers differ in how much they get, and that decides who eats when food is short. Born alike, the whole band starved together. |
| A larger valley | `valleySizeCm`, 80,000: 800 m square, 64 hectares. | 32 hazel thickets do not fit among the other sites in 600 m. |
| A store of fat | `reserveMaxKcal` 70,000, about 9 kg of fat; a forager starts at 66,000, is hungry below 64,000 and satiated at 68,000. | A lean adult survives one to two months without food. The hunger thresholds keep their distances from a full reserve, so a forager still eats every day; only the store behind them grows. |
| Work by task | Each task costs its own energy: picking `pickKcalPerHour` 200, gathering wood and fetching stones `gatherKcalPerHour` 250, cutting logs `chopKcalPerHour` 360, and making axes `makeKcalPerHour` 150. | Measured costs: picking fruit is 3 to 3.5 MET and chopping wood 6 MET. In Life 9.5 every task cost 300. |
| Carrying | Walking under a load of `L` kg at `v` cm a second costs the Pandolf rate, `0.86 · (1.5 W + 2 (W + L) (L / W)² + η (W + L) · 1.5 (v / 100)²)` kilocalories an hour, with `W` = `bodyKg` and `η` = `walkTerrainPercent` / 100, 1.2 for light brush. Speed falls by `loadSlowdownPerMille`, 75, thousandths for each body mass carried: 3% under 40% of body mass. | Walkers carrying 40% of their body mass slow by only 3%; the load costs energy instead. In Life 9.5 a load slowed a forager by a third and cost nothing. Unloaded, walking costs 222 kcal an hour; under a 35 kg log, 341. |
| Warmth | Four costs of an hour asleep: `sleepKcalPerHour`, 60, in a whole hut by a lit fire; `fireSleepKcalPerHour`, 70, by a lit fire without a hut; `hutSleepKcalPerHour`, 75, in a whole hut without a fire; `coldSleepKcalPerHour`, 90, with neither. A member's fire is its group's; a forager without a group burns its own, hut or not. | The owner's rule: a hut keeps warm a little, the fire more. People sleeping out near freezing raise their metabolism by up to about half, not two and a half times as in Life 9.5. |
| Huts round the fire | Slot `i` round a flag is point `i` of the square spiral, on ring `k`, moved along its direction onto the circle `k · hutRingCm` from the flag, `hutRingCm` 700: the first ring holds 8 huts 7 m from the fire, evenly round it, the second 16 at 14 m. | The owner's rule: huts are built round the fire, because it warms more. Life 9's square spiral 3 m apart crowded the huts against each other. Integer square roots keep every slot exact on every machine. |
| What a hut is made of | `hutLogs`, 23 logs, each carried home from a tree and laid at the hearth. A hut is whole when it holds 23. | The owner's rule: basic wooden huts, built as real ones would be, for one sleeper. A log is a pole 14 cm thick and 2.4 m long, and a small A-frame of such poles takes 23: two A's of a log each, 9 wall logs a side resting on each other, a ridge log and two logs cut into posts to close the back. |
| Huts weather | Each hut loses a log every `hutLogDays`, 60 days; the log rots away, so a hut lasts about 4 years. A hut short of a log is not whole until it is repaired. | Untreated poles last a few years. Without weathering nobody would need an axe again once every hut stood. |
| Felling | A standing tree holds `logsPerTree`, 3 logs. The first log cut from it fells it whole: it lies where it fell, its crown's branches with `fellWood`, 10 kg, more brought down, and its other logs are cut from the trunk where it lies. A felled tree's branches do not regrow. | The owner's rule: a tree comes down whole in one go, then is broken down into logs and branches. In Life 9 a tree gave up its logs one by one while it stood. |
| Stumps grow back | A felled tree with no logs left stands again whole, with every log, at the first midnight `treeRegrowthDays`, 7,300 (20 years), after it fell. Branches still lying there become dead branches under the new tree. | A 14 cm pole takes 15 to 25 years to grow. Keeping the leftover branches conserves wood without a rule for rotting. |
| Firewood | Each standing tree has up to `treeCapacityWood`, 25 kg, of dead branches lying beneath it, added to by `treeDeadfallWoodPerYear`, 5 kg; each bush holds up to `bushCapacityWood`, 2 kg, of sticks, regrowing `bushRegrowthWoodPerDecade`, 2 kg a decade. Both are spread evenly over their period and gathered by hand at `woodPerHour`, 15 kg. Trees and bushes together are the **wood plants**, and a thicket holds wood as well as berries. | The owner's rule from Life 9.6: real firewood is mostly dead wood, so dead branches fall from trees at a realistic rate, alongside sticks from bushes and the crowns of felled trees. A tree of about 85 kg grows only a few kilograms of wood a year. Women gathering a 24 kg headload take about two hours. Sticks are counted by the decade because a bush grows less than a kilogram a year. |
| Clearing crowns first | A forager gathering wood takes from the nearest felled crown it knows with a minute's work, before any plant still growing. | Without it, felled crowns lay untouched beside their stumps while foragers took sticks from nearer bushes. It is the same rule as finishing a felled trunk before felling another tree. |
| More trees | 12 stands of 12 trees, against 8 of 8. | The owner asked for more trees. The prototype's huts used about a tenth of the logs on offer at any time. |
| Cutting | A member cuts at the nearest tree it knows lying felled with a log, and fells the nearest standing tree only when there is none it can reach in time. It tells them apart from afar: a standing tree holds every log. | One tree at a time is cut up before the next comes down. |
| An axe is needed to cut a log | Without an axe, no log. Cutting a log takes `logChopMinutes`, 30 minutes, with an axe of quality 100, and proportionally longer with a worse one. | The owner's rule: the drive for tools comes from the need for wood. Requiring the axe keeps the choice that matters, making against buying, at the centre. Polished stone axes fell a 20 cm tree in 30 to 90 minutes, and a 14 cm trunk has half the area. |
| Carrying a log | A log weighs `logKg`, 35 kg, freshly cut. A forager carries one at a time and takes it home before anything else. | A fresh birch pole 14 cm by 2.4 m weighs about 35 kg. One log a trip makes the distance to the trees matter. |
| Stones | **Outcrops** are a third kind of site, like thickets and stands: `outcropCount`, 4, each with `stonesPerOutcrop`, 12, stone spots holding `stonesPerSpot`, 5, stones. Stones never come back. | The owner asked for stone as a resource on the map, like trees and bushes. 240 stones are far more than ground axes use. |
| Making an axe | One stone and `axeWood`, 1 kg of the member's wood, worked at its hearth. Making takes `axeHours`, 50 hours, at craft 100%, and `50 · 100 / craft` hours at any other craft. Work can stop for hunger or night and go on later. | The owner's rules: the more skilled make axes faster, and axes are ground stone. Grinding a flint axe smooth takes about 60 hours. Making at the hearth keeps the work where the materials are kept. |
| Craft | A member's craft is its born craft skill times its practice, from the seconds it has spent making axes over its last `practiceDays` days, by the same practice curve as picking and gathering. Nobody starts with practice, so a first axe is made at half one's born skill. | The owner's rule: skill comes from making. Practice is how skill already works in the valley. |
| Born craft skill | Drawn for each forager from `craftSkillMinPercent` to `craftSkillMaxPercent`, 100 to 100 by default: born alike. The setup can draw them from a range, such as 50% to 150%. | The step's question is whether practice alone concentrates axe making, so craft is born alike unless the setup asks for talent (design rule 19). Foraging and wood skills differ from birth from Life 9.7. |
| Quality | When an axe is finished its quality is drawn uniformly from half the maker's craft to its whole craft. Quality multiplies the speed of cutting, and an axe lasts `axeLogs`, 200, logs times its quality over 100, at least one. | The owner's rule: the more skilled are more likely to make a good axe, the less skilled more likely a shoddy one, and better axes cut faster and wear out more slowly. Ground axes last far longer than flaked ones; no count of logs was found, so 200 is an estimate. |
| What an axe costs to make | `axeHours · 100 / craft` hours times the difference between making and resting, `makeKcalPerHour − restKcalPerHour`, 60 kcal an hour. | Members are at rest most of the day, so an hour spent making costs the extra energy of working, not food it would otherwise have picked. Priced at picking, an axe cost more food than a buyer can carry fresh. |
| What an axe is worth | To a member who needs one, an axe of quality `q` is worth what making its own would cost it, times `q` over the quality it would expect to make, three quarters of its craft. | A buyer's alternative to buying is making its own. A better axe than it could make is worth more; a worse one, less. |
| Buying or making | A member that needs an axe buys if it has heard of an axe for sale that is worth more to it than its asking price, and makes its own otherwise. | Local, bounded choice (design rule 2): it compares what it heard with its own cost. |
| Asking and promising | A member that needs an axe and has none tells the members within talking distance. The cheapest maker among them that does not need logs itself, if its axe would be worth more to the asker than its own cost, promises to make one for sale; the asker hears the promise and waits at its hearth. A promise binds nobody: the axe is sold to whoever needs one when it is finished. | Without it, an asker starts its own axe in the same minute a maker offers to make one, and trade never happens. A promise is what a band does when someone asks around for an axe. It is information, not a claim; claims arrive with step 10. |
| Selling | A member with a spare axe tells members within talking distance its asking price, its own cost of making one. It sells to a member that needs one when the axe is worth more to the buyer than the ask, at the midpoint, paid in carried food, if the buyer carries enough and the seller has room to eat it. | The same rule as swapping wood for food: both must gain, and food changes hands only as far as it can be eaten. A buyer that has heard a worthwhile ask picks food to pay with, then waits at its hearth. |
| A maker's own axe | A maker whose own axe wears out uses its spare. | A spare is its own until sold. |
| Counterfactuals | `axeTrade` (off: no member may sell, ask or promise), `craftPractice` (off: practice is fixed at 100%) and `scattered`. Neither Life 9.6 nor Life 9.7 adds a switch to recreate the step before. | Each switch is a comparison for later. Earlier numbers, and a band born alike in foraging and wood skill, are configurations, not modes. |

## World

The valley is a square `valleySizeCm` wide. Everything is drawn from the layout stream, seeded from the run seed and the layout salt with `mixSeed`; every draw is `randomInt` over whole centimetres.

1. **Sites.** Site centres are drawn uniformly over the valley, at least `siteMarginCm` from its edges. A draw is rejected if it lies within `campClearingCm` of the camp, the valley's centre, or within `siteSpacingCm` of an earlier centre. The first `thicketCount` centres are berry thickets, the next `hazelThicketCount` are hazel thickets, the next `standCount` are stands and the next `outcropCount` are outcrops, with IDs from 0 in draw order.
2. **Bushes.** For each berry thicket in turn, bushes are drawn uniformly in the square around its centre and kept if they lie within `thicketRadiusCm` of it and at least `bushSpacingCm` from the thicket's earlier bushes, until it has `bushesPerThicket`. Bush IDs run from 0 across thickets in order.
3. **Hazels.** The same for each hazel thicket, with `hazelThicketRadiusCm`, `hazelSpacingCm` and `hazelsPerThicket`. Hazel IDs run from 0.
4. **Trees.** The same for each stand, with `standRadiusCm`, `treeSpacingCm` and `treesPerStand`.
5. **Stones.** The same for each outcrop, with `outcropRadiusCm`, `stoneSpacingCm` and `stonesPerOutcrop`.
6. **Starts.** With `scattered` on, each forager's start, which is its first hearth, is drawn from a start stream of its own, uniformly over the valley in forager ID order, rejecting a draw within `startSpacingCm` of an earlier start. With it off, the band starts as one group, its flag at the camp and its hearths on the rings round it.

The wood plants are the trees, by ID, then the bushes: wood plant `treeCount + b` is bush `b`. A bush holds up to `bushCapacityKcal` of berries and `bushCapacityWood` of sticks, a hazel up to `hazelCapacityKcal` of nuts, and a standing tree up to `treeCapacityWood` of dead branches beneath it. In the first minute of every hour after minute 0, each gains its share of its period's regrowth, up to capacity: in hour `h` of a period of `P` hours, counted from minute 0, an amount `a` a period gives `floor(a · (h + 1) / P) − floor(a · h / P)`, so a whole period gives exactly `a`. Berries, nuts and dead branches have a year of 8,760 hours, sticks a decade of 87,600. A felled tree gains no dead branches, and a crown above capacity keeps what it has. A standing tree holds `logsPerTree` logs; it is felled by the first log cut from it, and the minute it fell is kept until it stands again. A stone spot holds `stonesPerSpot` stones, which never regrow. `createValley` refuses a configuration whose layout or starts cannot be drawn in 10,000 draws.

**The lake.** The lake lies beyond the north edge, `y < 0`, and is not part of the valley's square. Its shore is the edge `y = 0`; a forager fishing stands at `(x, 0)` for its own `x`, and walks there straight north. Its stock `F` starts at its capacity `K = lakeHectares · lakeFishKgPerHectare · fishKcalPerKg`. In the first minute of every hour after minute 0 it gains `g`, the whole kilocalories of `lakeGrowthRemainder + lakeGrowthPercentPerYear · F · (K − F)`, owed in units of `100 · K · 8,760`; the rest stays in `lakeGrowthRemainder`. Growth owed is never lost, only carried in the remainder: held at half the stock for a year, the lake gains `lakeGrowthPercentPerYear / 400` of `K`, and a full or empty lake gains nothing. A forager sees the lake when any point of its shore lies within its long sight.

**Places.** Place `p` covers column `p mod n` and row `floor(p / n)`, where `n = ceil(valleySizeCm / placeCm)`: a square `placeCm` wide, cut at the valley's edge. A place lies wholly within sight when all four of its corners do.

**Skills.** Each forager's born foraging, wood and craft skills are drawn from the skill stream: foraging and wood uniformly from `skillMinPercent` to `skillMaxPercent`, and craft from a stream of its own, so that drawing it leaves the other skills as they were, uniformly from `craftSkillMinPercent` to `craftSkillMaxPercent`. Its rates for a day are the base rate times born skill times practice, rounded down; its craft is born craft skill times practice over 100, rounded down, at least 1. Its practice at a task is the seconds `s` it spent at it over its last `practiceDays` days, giving

`P(s) = practiceMinPercent + floor((practiceMaxPercent − practiceMinPercent) · s / (s + 3,600 · practiceHalfHours))`.

Every day of the starting log holds `3,600 · startPracticeHoursPerDay` seconds at picking and gathering, and none at making axes. With `craftPractice` off, craft practice is 100% whatever the log.

## The forager

| State | Meaning |
| --- | --- |
| `x`, `y`, `hearth` | Its position and its hearth, in whole centimetres |
| `energyKcal`, `hungry` | Its reserve, its store of fat and food eaten together, and hunger with hysteresis: hungry below `hungryBelowKcal`, until it reaches `satiatedAtKcal` |
| `carried` | Food it carries, as lots of one food, berries, nuts or fish, taken in one minute, oldest first; a lot spoils its food's shelf life after it was taken |
| `wood`, `shortOfWood`, `tripWood` | Wood it holds, wood need with hysteresis, and wood gathered since it last stood at its hearth |
| `log`, `stone` | Whether it carries a log, and the stones it holds |
| `bushMemory`, `hazelMemory`, `lakeMemory`, `woodMemory` | For each bush, the berries it last saw there; for each hazel, its nuts; the lake's stock when it last fished there; and for each wood plant its sticks or branches; each with the minute, or never |
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
1. **Regrowth.** In the first minute of every hour after minute 0: berries, nuts, sticks and dead branches, each its share of its period, and the lake's fish by the logistic rule.
2. **Fires.** At the start of every hour: if it is night, each standing group's fire burns `campfireWoodPerHour` and is lit if it holds that much, and is out otherwise. By day every fire is unlit.
3. **Turn order.** A seeded shuffle of the band, from a stream derived from the run seed and the minute.
4. **Turns.** Each living forager in that order:
   1. **Spoilage** and **eating** from what it carries, oldest first, up to the room in its reserve.
   2. **Observation.** It records the berries on every bush, the nuts on every hazel and the wood on every wood plant within close sight, `perceptionRadiusCm`. Its long sight is `sightRadiusCm` by day and close sight at night: within it, it spots every site, records the logs on every tree and the stones on every stone spot, which can be seen from afar, marks every place never seen before as seen, learns of the lake if it sees its shore, learns every standing flag and forgets every known flag whose spot holds none. It checks every site whose centre lies within `perceptionRadiusCm` less the site's radius.
   3. **Decision.** Hunger and wood need are updated; then the first rule that applies (see [Rules](#rules)). Its speed this minute is set by the load it carries as it sets out.
   4. **Action.** The minute's 60 seconds.
   5. **Meeting.** A forager without a group meets the nearest living forager within `talkRadiusCm`, if any: it joins a member's group, taking the next slot round its flag, or the two found a new group with the flag at their midpoint.
   6. **Exchange.** Swaps and quotes of wood with members of its own group within `talkRadiusCm`; then asking, promising and selling axes.
   7. **Feeding.** A member at its hearth feeds its group's fire.
   8. **Building.** A member at its hearth carrying a log lays it in its hut.
   9. **Eating again** and **metabolism.** Each second's hourly cost is added to its cost remainder and the whole kilocalories are paid. At 0 it dies of starvation; if that leaves its group with one living member or none, the group dissolves, and its survivor takes back the fire's wood. What a dead forager held, its log, stones and axes, stays with it.
5. **Record.** Events, the day's summary, and the invariants.

### Rules

Let `D` be the daylight seconds left in the minute, 0 at night. A forager's load `L` is its trip's wood, its log at `logKg`, and its carried berries, nuts and fish at `berryKcalPerKg`, `nutKcalPerKg` and `fishKcalPerKg`, in whole kilograms rounded down once over the total. Its speed under it is `max(1, floor(walkCmPerSecond · (1,000 · bodyKg − loadSlowdownPerMille · L) / (1,000 · bodyKg)))` centimetres a second, and each second of walking costs the Pandolf rate for `L` at that speed, computed exactly in integers and rounded down once to 3,600ths of a kilocalorie. A plant, stone spot, point or the shore can be reached in time if walking there, a minute's work there, and walking home take at most `D` seconds.

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
| 14 | It remembers no source of the good worth working that it can reach in time, and knows a site of that kind it has never checked, or a place it has never seen, that it can reach and return from before dusk | Walk towards the nearest such site, or else the nearest such place | `searching` |
| 15 | No source of the good that it can reach in time | Rest | `too late to set out` or `waiting for regrowth` |
| 16 | Otherwise | Work at its target, walking to it first if needed | `foraging`, `gathering nuts`, `fishing`, `gathering`, `seeking food` or `seeking wood` |

A rule from 7 to 10 that finds nothing it can reach in time, no tree with a log or no stone, falls through to the next. Rule 10 needs `axeWood` in hand; a member short of it is short of wood, and gathers.

**The choice of work.** A hungry forager works for food, unless terms it remembers make selling wood pay, when it gathers wood to sell enough for the food it lacks. A forager short of wood gathers wood, unless terms it remembers make buying pay, when it picks food to buy wood with, or waits if it already carries enough. A forager's own terms are its foraging rate over its wood rate.

**Food sources.** A forager's full rate for a food is the food's base rate, `berryKcalPerHour`, `nutKcalPerHour` or `fishKcalPerHour`, times its born foraging skill times its practice at foraging, rounded down; practice counts seconds at all three foods together. Its rate at a source holding `s` of capacity `c` is `floor(full · s / c)`, and the source is worth working while that is more than `pickKcalPerHour`; its expected rate uses the stock it remembers, a full lake if it has never fished. Working for food, it keeps its target while the target is worth working by what it last saw or caught there and it can reach it in time. Otherwise its candidates are, in this order: every bush, then every hazel, by ID, that it remembers as worth working; the nearest thicket, then the nearest hazel thicket, it has spotted and never checked and can reach and return from before dusk, at its full rate for that food; and the lake's shore below it, if it knows the lake and remembers it worth working. Of those it can reach in time, it chooses the one with the most food for its time, `3,600 · rate / (walk + 3,600)`, with `walk` the seconds to walk there, compared exactly by cross-multiplying, ties to the first. A thicket chosen is walked to as a search (rule 14). With none and nothing left to search, it takes the bush or hazel it saw longest ago.

**Wood plants.** It keeps its target unless it has just seen the plant holding less than a minute's work, `ceil(rate / 60)`, or can no longer reach it in time. Otherwise, it chooses the nearest felled tree it saw from afar and remembers holding a minute's work of branches; then the nearest plant it remembers holding a minute's work, ties to the lowest ID; and, with nothing left to search, the one it saw longest ago. Searching for wood goes to thickets as well as stands, when bushes hold sticks.

**Swaps.** Two members within talking distance swap when one has spare wood and the other wants wood, each at terms that pay it: the midpoint of their own terms, as whole kilocalories a kilogram. The amount is the least of the seller's spare wood, the buyer's wanted wood, what the buyer's carried food can pay for, and what the seller has room to eat. When nothing can change hands, they tell each other the terms, and every member within talking distance of a swap hears its terms.

**Axes.** Let `c` be a member's craft. Making takes `ceil(3,600 · axeHours · 100 / c)` seconds and costs it `ceil(seconds · (makeKcalPerHour − restKcalPerHour) / 3,600)` kilocalories: its **ask**. It expects to make an axe of quality `floor(3c / 4)`, and an axe of quality `q` is worth `floor(ask · q / floor(3c / 4))` to it. In its exchange, with `axeTrade` on:

- A member with a spare axe tells every member within talking distance its ask and the axe's quality. A member hearing it keeps the best: a made axe over one promised, then the lowest ask, then the better axe.
- It sells the spare to the first member within talking distance, in ID order, that needs an axe, holds none and is making none, if the axe is worth more to that member than the ask: at the midpoint, rounded down, paid in the buyer's oldest carried food, if the buyer carries that much and the seller has room to eat it.
- A member that needs an axe, holds none and is making none tells every member within talking distance. If none of them holds a spare or has promised one, the one with the lowest ask that does not need logs itself, is making no axe, and whose expected axe is worth more to the asker than its ask, ties to the lowest ID, promises to make one. The asker hears the promise as an ask for an axe not made yet, of the promiser's expected quality.
- It buys from any member within talking distance holding a spare worth more to it than the ask, on the same terms.

A heard ask is remembered for `termsMemoryHours`, and replaced by a better one or by any ask heard an hour later. A member forgets an ask when it stands within talking distance of the seller and the seller has neither a spare nor a promise.

### The 60 seconds

A forager walks towards its hearth, a place or site, another forager, a stone spot, the shore below it, or a point `reachCm` short of its plant, at its speed, and arrives within the minute if it can. Having arrived at a wood plant holding a minute's work, or at a bush, hazel or the shore worth working, it works the seconds left: its remainder for the task grows by its hourly rate there times the seconds, and it takes the whole units, never more than the source holds. Its rate at a food source is set by the stock at the start of its work that minute. Food taken is eaten until the reserve is full and the rest carried as a lot of that food. A forager at the shore remembers the lake's stock as it found it, whether or not the lake is worth fishing. Gathered wood adds to its wood and its trip.

Cutting, it works the seconds left at the tree: its cut grows by the seconds times its axe's quality, and when it reaches `6,000 · logChopMinutes` a log comes off the tree, the rest carries over, it carries the log, and its axe has one log fewer left. If the tree stood, it falls: `fellWood` from its crown is added to its branches. An axe with none left is worn out and thrown away; the cut so far is lost. At a stone spot it takes one stone in the seconds left. Making, it puts its stone and `axeWood` into the axe when it begins, and works the seconds left at its hearth; when the seconds worked reach the seconds needed, the axe's quality is drawn from the axe stream for that forager and minute, uniformly from `floor(c / 2)` to `c`, and it becomes the member's axe, or its spare if made for sale, which ends its promise.

Otherwise it stands. Asleep, a member is warmed by its group's fire if it is lit; a forager without a group burns `fireWoodPerHour` at the start of each hour it sleeps if it holds that much, and has no fire otherwise. Either sleeps in its hut if a whole one stands at its hearth. Picking berries, gathering nuts and fishing cost `pickKcalPerHour`, gathering and fetching stones `gatherKcalPerHour`, cutting `chopKcalPerHour`, making `makeKcalPerHour`, walking the Pandolf rate for its load and speed, standing `restKcalPerHour`, and sleeping the cost of its warmth: `sleepKcalPerHour` with fire and hut, `fireSleepKcalPerHour` with a fire alone, `hutSleepKcalPerHour` in a hut alone, and `coldSleepKcalPerHour` with neither.

## Defaults

| Parameter | Canonical value | Parameter | Canonical value |
| --- | --- | --- | --- |
| `valleySizeCm` | **80,000** | `bandSize` | 8 |
| `thicketCount`, `bushesPerThicket` | 32, 60 | `berryShelfLifeHours` | 48 |
| **`hazelThicketCount`, `hazelsPerThicket`** | **32, 40** | **`hazelThicketRadiusCm`, `hazelSpacingCm`** | **2,000, 400** |
| **`hazelCapacityKcal`, `initialHazelKcal`** | **1,875, 1,875** | **`hazelRegrowthKcalPerYear`** | **3,750** |
| **`nutKcalPerHour`, `nutKcalPerKg`** | **3,500, 2,500** | **`nutShelfLifeHours`** | **4,380** |
| **`lakeHectares`, `lakeFishKgPerHectare`** | **30, 100** | **`lakeGrowthPercentPerYear`** | **40** |
| **`fishKcalPerHour`, `fishKcalPerKg`** | **600, 600** | **`fishShelfLifeHours`** | **24** |
| `thicketRadiusCm`, `bushSpacingCm` | 1,200, 200 | `fireWoodPerHour`, `coldSleepKcalPerHour` | 1, **90** |
| `bushCapacityWood`, `bushRegrowthWoodPerDecade` | 2, **2** | `fireSleepKcalPerHour`, `hutSleepKcalPerHour` | **70, 75** |
| `bushCapacityKcal`, `bushRegrowthKcalPerYear` | **52, 900** | `woodStockNights`, `woodLoad` | 2, 30 |
| `standCount`, `treesPerStand` | 12, 12 | `skillMinPercent`, `skillMaxPercent` | **75, 125** |
| `standRadiusCm`, `treeSpacingCm` | 1,500, 400 | `termsMemoryHours` | 24 |
| `treeCapacityWood`, `treeDeadfallWoodPerYear`, `fellWood` | 25, **5**, 10 | `practiceDays`, `practiceHalfHours` | 30, 60 |
| `siteSpacingCm`, `siteMarginCm`, `campClearingCm` | 5,000, 3,000, 4,000 | `practiceMinPercent`, `practiceMaxPercent` | 50, 150 |
| `hutRingCm`, `walkCmPerSecond`, `reachCm` | 700, 125, 100 | `startPracticeHoursPerDay` | 2 |
| `perceptionRadiusCm`, `talkRadiusCm`, `sightRadiusCm` | 2,500, 2,000, 100,000 | `scattered` | true |
| `dawnHour`, `duskHour` | 6, 18 | `startSpacingCm`, `placeCm` | 5,000, 3,000 |
| `berryKcalPerHour`, `woodPerHour` | 1,200, 15 | `exploreAfterHours` | 24 |
| `sleepKcalPerHour`, `restKcalPerHour` | 60, 90 | `bodyKg`, `berryKcalPerKg` | 60, **600** |
| `pickKcalPerHour`, `gatherKcalPerHour` | **200, 250** | `chopKcalPerHour`, `makeKcalPerHour` | **360, 150** |
| `walkTerrainPercent`, `loadSlowdownPerMille` | **120, 75** | `campfireWoodPerHour` | 1 |
| `reserveMaxKcal`, `initialReserveKcal` | **70,000, 66,000** | `hungryBelowKcal`, `satiatedAtKcal` | **64,000, 68,000** |
| `outcropCount`, `stonesPerOutcrop` | 4, 12 | `outcropRadiusCm`, `stoneSpacingCm` | 1,000, 300 |
| `stonesPerSpot` | 5 | `logsPerTree`, `treeRegrowthDays` | 3, **7,300** |
| `logKg`, `logChopMinutes` | **35**, 30 | `hutLogs`, `hutLogDays` | 23, **60** |
| `axeHours`, `axeLogs`, `axeWood` | **50, 200**, 1 | `craftSkillMinPercent`, `craftSkillMaxPercent` | 100, 100 |
| `axeTrade`, `craftPractice` | true, true | `initialTreeWood`, `initialBushWood`, `initialBushKcal` | 25, 2, **52** |

Values in bold are new or changed in Life 9.7. `forageKcalPerHour` is renamed `berryKcalPerHour`, and `shelfLifeHours` `berryShelfLifeHours`.

`createValley` refuses a configuration with a value that is not an integer or a switch that is not a boolean; sizes, counts, rates and radii that are not positive, or amounts that are negative; a reach as long as close sight; starting stocks above capacity, a lake included; hours, hunger thresholds or costs out of order, including any task that costs no more than resting and sleep costs out of the order fire and hut, fire, hut, neither; a terrain factor below 100%; no logs on a tree; skill, craft or practice ranges out of order, or wood rates that round to nothing or exceed what a plant holds in a minute, a bush that holds sticks included; a food whose full rate at the lowest skill and practice is no more than `pickKcalPerHour`, so that no full source would be worth working; a lake whose growth could overflow exact integer arithmetic; a log heavier than a forager can carry at walking speed 1 by the load rule; a band around the camp whose huts would not fit in its clearing, or of fewer than two; a place too large to see whole from its centre; long sight shorter than close sight; and a site too wide to check from inside close sight.

## Invariants

Checked after every minute of every checked run, by `src/valley/invariants.ts`:

- **Energy is conserved exactly.** Berries on bushes, nuts on hazels, fish in the lake, reserves, carried food, food eaten and spoiled equal the food at minute 0 plus regrowth and the lake's growth, through swaps of wood and sales of axes alike. The lake's growth each hour is replayed from its stock and remainder.
- **Wood is conserved exactly.** Sticks on bushes and dead branches under trees, wood held by foragers and in fires, wood burned, and wood in axes made, equals the wood at minute 0 plus regrowth and deadfall plus branches brought down by felling.
- **Logs are conserved exactly.** Logs on trees, carried, in huts, rotted and abandoned equal the logs at minute 0 plus regrowth.
- **Stones are conserved exactly.** Stones on the ground and held, plus axes ever made, equal the stones at minute 0; axes held, as axes or spares, plus axes worn out, equal axes ever made.
- Every plant's, hazel's and stone spot's stock, and the lake's, is replayed from regrowth and recorded work, and every tree's fall and regrowth: a tree falls only at its first cut, which finds it holding every log, and stands again only as a stump on its day.
- Every second is charged the cost of its task, of its warmth asleep, or the Pandolf rate for the recorded load and speed, and the energy paid equals the cost owed, to the 3,600th.
- One turn per living forager each minute; its seconds add up to 60; it moves no further than its walking seconds at the speed its recorded load allows, and its load is no more than the wood of its trip, its log and the weight of the food it carries; it never stands on the lake.
- Work only in daylight, at a wood plant within reach holding a minute's work, at a bush or hazel within reach or on the shore while it is worth working, taking food at its rate there and no more than the source holds, at a tree within reach holding a log, at a stone spot within reach holding a stone, or at its own hearth; memory of the plant or spot worked or targeted, and every hour of everything in view, matches what it saw.
- Places first marked seen lie wholly within sight; every site within sight is known, and checked exactly when the forager stood close enough; a walk to a place or site aims at one worth it and ends no further from it.
- A forager not hungry with a full load or carrying a log never idles, explores, checks, seeks company or makes axes, and only one with a log or a full load takes it home, towards the hearth it had while it acted.
- Groups, replayed through each minute's foundings, joinings and dissolutions in turn order, as in Life 8; swaps, quotes, asks, promises and sales stay within a group.
- Fires burn and are fed as in Life 8; every sleeper's warmth names its hut exactly when it sleeps in a whole one, a member's names the fire exactly when its group's fire is lit, a forager that burned wood has its fire, and only a sleeper with neither sleeps cold.
- A hut gains a log only from its builder standing at it carrying one, and loses one only on its day; a whole hut holds `hutLogs` logs.
- An axe's quality lies between half its maker's craft and its craft when made; its logs left start at `max(1, floor(axeLogs · q / 100))` and fall by one with each log cut. Every sale is from a member holding a spare to a member that needs an axe and holds none, at a price between the seller's ask and the axe's worth to the buyer, and agrees on both sides.
- Carried lots are whole, of one food, unspoiled by that food's shelf life and in order; practice logs, rates and craft follow from born skills and seconds worked, and change only at midnight; swaps pay both sides and agree on both sides.

## Theory

`src/valley/theory.ts`:

- **Time use, speed, checking, what a fire saves and gathering,** as in Life 8, with the new costs.
- **Walking.** Unloaded, a forager walks at 125 cm a second for 222 kcal an hour; under 30 kg of wood at 120 cm a second for 316; under a 35 kg log at 119 cm a second for 341.
- **What warmth saves.** Against sleeping cold, 12 night hours save 180 kcal in a hut alone, 240 by a fire alone, and 360 with both.
- **What a first hut takes.** A first axe is made at half one's craft: 100 hours, more than eight days of daylight, of quality 25 to 50, lasting 50 to 100 logs. Twenty-three logs at quality 37 take about 31 hours of cutting, plus 23 trips to the trees under 35 kg.
- **What an axe costs.** At craft `c`, `3,000 · 100 / c` kilocalories: 6,000 at craft 50%, 3,000 at 100%, 2,000 at 150%. Between two equally able members an axe is worth exactly its ask, so neither gains by trading; trade needs a difference in craft.
- **What huts need.** Each hut loses a log every 60 days. An axe of quality 45 lasts 90 logs, so once huts stand a member wears out an axe about every 15 years; the demand for axes comes almost wholly from building.
- **Logs on offer.** 144 standing trees hold 432 logs, and regrow at most 0.06 logs a day. Eight huts take 184 logs, 61 trees, to build.
- **Wood on offer.** The valley starts with 7,440 kg of sticks and dead branches and adds about 1,100 kg a year; a group's fire burns about 4,400 kg a year.
- **Capacity.** A year, the bushes regrow 1,728,000 kcal of berries and the hazels 4,800,000 of nuts, and the lake at half its stock grows 180,000 of fish: 6,708,000 kcal, 18,378 a day. A forager needs about 2,500 kcal a day, so the valley feeds about 7. It starts with 99,840 kcal of berries, 2,400,000 of nuts and 1,800,000 of fish, and each forager with 66,000 in its body. A band of 8 eating past what regrows draws these stocks down by about 1,600 kcal a day, so a band that finds its food well would not run short for years; starvation within the first year comes from where food is, who finds it and who is quick at taking it.
- **What an hour of work brings.** At full sources and practice 100%, an average forager takes 1,200 kcal of berries, 3,500 of nuts or 600 of fish an hour. A bush is worth working until a sixth of its berries remain, a hazel until 6% of its nuts, and the lake until a third of its fish: fished harder than its most productive stock, half, the lake can be fished down.
- **Who goes hungry first.** Born foraging skill runs from 75% to 125%, so with equal practice the quickest forager takes two thirds more an hour than the slowest, and can still gain from a source the slowest has given up.
- **In the implemented valley,** on the canonical seed over a year, every forager lives on hazelnuts alone for about six months, as their rate predicts; berries come in as the hazels fall below a fifth of full, and fish after about 200 days. Nobody dies in the first year, but by its end the members' reserves range from about 17,000 to 65,000 kcal: hunger has started to sort the band rather than strike it all at once.

## Questions for later

Experiments wait for a stable version of the Life engine, so this step has none. The questions it is built to answer:

- Do axes concentrate with whoever makes the most, through practice alone, in a band born alike?
- Does trade follow born talent instead, when craft differs from birth (`craftSkillMinPercent` 50, `craftSkillMaxPercent` 150)?
- What changes with `axeTrade` off, or `craftPractice` off?
- How many can the valley feed with huts and axes to keep up?
- How much food does a hut save a member over a year, against the work of keeping it whole?
- How many does the valley end up feeding, and who survives: the scattered or the grouped, the skilled or the lucky?
- What changes once berries ripen in one season, as in the real valley, and food can be stored?
- Do bands fish the lake down, and does it recover?
- Who survives a shortage, and does the band settle at what the valley feeds?
- What changes once berries and nuts ripen in their seasons, hazel has mast years, and fish run, so that food must be stored?
- Hazel is the best source of sticks in a real Mesolithic wood; should hazels give wood too?
- The numbers the calibration document marks as estimates need sources, above all the berries a bush holds at once, the dead branches under a tree, how long an axe lasts, the rate of gathering and cracking hazelnuts, and the fish stock of a Mesolithic lake.


## Ledger and metrics

- **Events.** As in Life 8, with: each forager's action also recording the food it worked, berries, nuts or fish, and the lake's stock; an hourly **growth** event for the lake; each forager's action every minute also recording the log or stone it took or laid and the axe work it did; a **cut** event for each log, with the tree, the axe's quality and logs left; a **made** event for each axe, with the maker, its craft, the quality drawn, and whether for sale; a **worn** event for each axe thrown away; **promise** and **sale** events, a sale recording the price, the seller's ask and the axe's worth to the buyer; a **weather** event for each log a hut loses; and an **abandon** event when a hut is left behind.
- **Daily summaries,** for the band: as in Life 8, with nuts on hazels, fish in the lake and food taken of each kind, logs cut, axes made, sold and worn out, huts whole and member-minutes asleep in a whole hut; and for each forager: as in Life 8, with seconds at each food, food taken of each kind, its born foraging skill, seconds cutting and making, logs cut, axes made, sold and bought, its craft, and the logs in its hut.

## Observer

`life.html` is "Life 9.7 · hazel and a lake". It works like a strategy game that can be paused and sped up but not controlled.

- **The valley.** As in Life 8, with: hazel thickets of tall, many-stemmed bushes, their nuts shown as a brown cluster that shrinks as they are gathered; the lake beyond the north edge, reaching to the edge of the scene, with a forager fishing standing on the shore holding a line; standing trees, each with dead branches lying beneath it that grow and shrink with its stock; a felled tree lying where it fell beside its stump, its trunk shortening as logs are cut from it and its crown, flat on the ground at the far end, shrinking as its branches are gathered, until only the stump is left; outcrops of grey stones that shrink as they are taken; a hut at each member's slot on the ring round its group's fire, built to one plan, an A-frame 2.4 m long, about 1.5 m wide and 1.2 m tall with its open end towards the flames: first the two A's, then the walls from the ground up, the ridge and the posts across the back, each log shown once laid and resting on the ground or on logs laid before it, and the last laid the first to go when a log rots; a member asleep lying inside its hut, feet towards the fire, with its wood stacked beside the hut; a fire of its own, in a ring of stones, only for a forager without a group; a forager carrying a log on its shoulder, swinging an axe at a tree, and kneeling at its hearth making an axe. There is no deadwood away from the trees.
- **Following a forager.** The HUD shows, as well as Life 8's: its born foraging skill and its carried food by kind; its reserve as days of food left at its recent rate of spending; its craft and practice at making axes, the axe it holds and its spare, each with quality and logs left and who made it, the axe it is making and how far along, any promise, the ask it last heard, its hut's logs, and the axes it has made, sold and bought.
- **Selecting a group.** As in Life 8, and the group card gains a table of axes: one row per member, with axes made for itself and for sale, sold and bought, food received and paid, its craft, and the quality of its axe. A sentence names the member who has made the most axes for others, if anyone has.
- **Inspecting** a bush shows its berries and sticks; a hazel its nuts; the lake its fish, as a share of a full lake; a tree the dead branches beneath it, its logs, whether it stands, lies felled or is a stump, and when it grows back; a stone spot its stones; a hut its logs and the day it next weathers.
- **History and setup.** As in Life 8, with charts of food on offer and taken by kind, of the lake's fish, of axes made, sold and worn out each day, of huts whole, and of foragers alive; the setup's numbers, with a link to the calibration document for their sources, and the switches.

## Code layout

| File | Contents |
| --- | --- |
| `src/valley/types.ts`, `config.ts` | State, configuration, defaults and validation |
| `src/valley/layout.ts`, `geometry.ts` | The layout, plant and stone indexes, streams and integer geometry |
| `src/valley/forager.ts`, `food.ts`, `work.ts`, `practice.ts` | A forager's observation, needs, choices, carried food, work and practice |
| `src/valley/lake.ts` | The lake: its shore, its growth and fishing |
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
- Foods: a rate falls with the stock and takes the last kilocalorie; a source stops being worth working below the cost of work; the choice between a near poor source and a far rich one; nuts and fish carried, weighed and spoiled by their own numbers; a forager fishes from the shore below it and remembers the stock it found; the lake's growth is zero at empty and full, greatest at half, and loses nothing to rounding.
- Calibration: the hourly shares of a yearly or decade amount add up to exactly that amount over its period; the Pandolf rate unloaded, under 30 kg and under a log matches [Theory](#theory); speed under a load; each task charged its own cost; dead branches gather under standing trees only.
- Huts: on rings round the fire, 8 on the first and 16 on the second; a log laid at the hearth only, whole at `hutLogs`, weathering on its day, abandonment when the hearth moves.
- Trees and firewood: the first cut fells a tree and brings its crown down, the rest are cut where it lies, a felled tree is finished before another is felled, a stump grows back on its day, and sticks are gathered from bushes.
- Axes: making takes the seconds its craft gives and can be interrupted; quality within its range; cutting at the speed quality gives; wear and throwing away; a maker taking up its spare.
- Trade: an ask heard and kept; a promise only from the cheapest maker that gains the asker; a sale only when both gain, paid in carried food within the seller's room; nothing sold, asked or promised with `axeTrade` off or outside a group.
- Determinism and purity: `stepValley` never changes its input, and `n` steps equal one run of `n` minutes.
- The invariants catch damage to each kind of record, including fish or nuts made from nothing, food taken faster than the source's stock allows, a forager on the water, energy charged at the wrong cost for a task or load, a tree felled without a record, a warmth that does not match the fire, a log or stone lost or made from nothing, a hut that grows away from its builder, an axe of impossible quality, and a sale at a price outside the two sides' terms.
- **Fingerprints.** Life 9.7 runs exactly as recorded: 30 days on three seeds for the canonical valley, a band that starts together, practice off, born talent, a band of 12 and a band born alike in foraging and wood skill match recorded fingerprints of their daily summaries and totals.
- Observer: drawing between minutes, plants, hazels, the lake and a forager fishing, standing and felled trees, stones, the hut plan (a piece list for every log, no log cut into more wood than it holds, and every piece resting on the ground or on one laid before it), huts turned to the fire, the camera, groups and what a forager knows, the axes table. The huts, sleepers in them, felled trees and logs carried are checked in the browser.

## Not in Life 9

Other tools and recipes; shelter shared by a group, or huts for foragers without one; huts that must be torn down or moved; claims on trees, stones or huts, or stealing them; lending or renting axes; promises that bind, or debts; teaching; hunting; fishing gear, boats, traps and weirs; smoking or drying fish and roasting nuts; seasons; fires that warm other groups or strangers; choosing not to feed the fire; cooking; giving food; members changing group; stands blocking the view; telling others where food is; and caches of food. Each arrives with the step whose question needs it.

## References

- The sources of every physical number are listed in the [calibration document](CALIBRATION.md#sources). Those new in Life 9.7:
  - [S1] Mithen, S., et al. (2001). Plant use in the Mesolithic: evidence from Staosnaig, Isle of Colonsay, Scotland. *Journal of Archaeological Science*, 28(3), 223–234. Summarised in ScARF, Mesolithic activities: https://scarf.scot/?p=1817
  - [S2] Holst, D. (2010). Hazelnut economy of early Holocene hunter-gatherers: a case study from Mesolithic Duvensee, northern Germany. *Journal of Archaeological Science*, 37(11), 2871–2880. https://en.wikipedia.org/wiki/Duvensee_archaeological_sites
  - [S3] USDA FoodData Central: hazelnuts (FDC 2707502), 628 kcal per 100 g; raw perch and pike about 90 kcal per 100 g. https://fdc.nal.usda.gov/ (via https://getfoodfacts.com/food/hazelnuts-2707502)
  - [S4] Hazelnuts, kernel only, weighed with shells, 247 kcal per 100 g. https://www.caloriecounter.com.au/?p=617699
  - [S5] Ranta, E., and Lindström, K. (1998). Fish yields of 166 northern Finnish lakes, 0.2 to 43 kg a hectare a year. *Annales Zoologici Fennici*, 35. https://www.annzool.net/PDF/anzf35/anzf35-095p.pdf
  - [S6] Wild hazel in Arasbaran forest, Iran, about 395 kg a hectare: https://www.magiran.com/paper/865071/?lang=en; hazel varieties in Ukrainian trials, 126 to 448 kg a hectare: https://journal.udau.edu.ua/assets/files/88/agro/angl/17.pdf
  - [S7] Garden hazel bushes, 2 to 5 kg a bush, alternating heavy and light years; 1 kg of whole nuts gives about 350 g of kernels. Anecdotal: https://permies.com/mobile/t/40/27229/Hazelnuts-harvest-processing-propagation
  - [S8] Koster, J., et al. (2020). The life history of human foraging: cross-cultural and individual variation. *Science Advances*, 6(26), eaax9070.
  - [S9] Traditional hand harvesting of hazelnuts, 4.5 to 5.3 kg an hour: https://journals.tubitak.gov.tr/agriculture/vol40/iss3/1; manual collection from the ground, 6 to 8 kg an hour: https://fsantos.utad.pt/Bibliografia/04TarragPap0615.pdf
  - [S10] Perch biomass 16.1 to 44.2 kg a hectare over 20 years in a Finnish humic lake: https://jukuri.luke.fi/bitstreams/436ea40c-cadf-40f5-a5eb-b4d71634d13f/download; a whole fish community about 537 kg a hectare in a Polish reservoir: https://czasopisma.pan.pl/Content/89902
  - [S11] Sodus Bay creel survey: anglers after yellow perch caught 4.4 to 7.1 perch an hour. https://extapps.dec.ny.gov/docs/fish_marine_pdf/sbaycreel.pdf
- Charnov, E. L. (1976). Optimal foraging, the marginal value theorem. *Theoretical Population Biology*, 9(2), 129–136.
- Schaefer, M. B. (1954). Some aspects of the dynamics of populations important to the management of the commercial marine fisheries. *Bulletin of the Inter-American Tropical Tuna Commission*, 1(2), 27–56.
- Arrow, K. J. (1962). The economic implications of learning by doing. *Review of Economic Studies*, 29(3), 155–173.
- Beardwood, J., Halton, J. H., and Hammersley, J. M. (1959). The shortest path through many points. *Mathematical Proceedings of the Cambridge Philosophical Society*, 55(4), 299–327.
- Rosen, S. (1983). Specialization and human capital. *Journal of Labor Economics*, 1(1), 43–49.
- Smith, A. (1776). *An Inquiry into the Nature and Causes of the Wealth of Nations*, book I, chapters 1–3.
- Wiessner, P. W. (2014). Embers of society: Firelight talk among the Ju/'hoansi Bushmen. *Proceedings of the National Academy of Sciences*, 111(39), 14027–14035.
