# Calibration of the Life core

This document records measurements, derivations, estimates and proposals for the Life core. The current specification gives implemented defaults; earlier tables retain the context in which their evidence was gathered. It follows [design rule 15](../SIMULATION_DESIGN_RULES.md#15-do-not-calibrate-by-aesthetics): parameters come from documented measurements, not from how the run looks.

Each real-world figure is marked by how far it can be trusted:

- **Measured:** the source reports the number.
- **Derived:** computed here from a measured number; the working is shown.
- **Estimate:** no source was found, so the figure is reasoned and needs a source before it is final.

The reference body is a 60 kg adult, as in the current `bodyKg`. One MET is taken as 1 kcal per kilogram per hour, so 60 kcal an hour for this body.

## The headline

The current valley gives far more than any real land would.

- **Berries.** Each bush regrows 20 kcal a day all year, about 15 kg of berries a year. A wild blueberry bush gives 1 to 2 kg a year, in one season of a few weeks. The thickets produce about **19,000 kg a hectare a year**: more than a commercial blueberry farm, and 300 to 900 times a good wild bilberry forest.
- **Firewood.** A bush regrows 1 kg of sticks a day, 365 kg a year, and a tree 6 kg of branches a day, about 2,200 kg a year. A whole 15 cm tree weighs about 85 kg.
- **Trees** grow back from the stump in 60 days. A pole 14 cm thick takes **15 to 25 years** to grow.
- **Huts** lose a log every 10 days, so a whole hut rots away in 230 days. Untreated poles last a few years.

The numbers for people are mostly close to real ones: body, sleep, rest, walking speed, picking rate, and the time to cut a log with a stone axe. Four are off: the body's energy reserve is too small, carrying a load slows a walker far too much while costing nothing extra, cold nights cost too much, and firewood is gathered too fast.

With realistic production, the valley's 36 hectares of berries would feed one or two people a year, not eight. Realistic numbers alone therefore create the scarcity the engine lacks. They also mean the band would starve unless the valley grows, its diet widens, or seasons and storage arrive. See [What realistic numbers imply](#what-realistic-numbers-imply).

## Food

| Parameter | Now | Real world | Trust | Proposal |
| --- | --- | --- | --- | --- |
| `berryKcalPerKg` | 500 | Raw blueberries 570 to 640 kcal per kg [1] | Measured | **600** |
| Yield of a bush | `bushRegrowthKcalPerDay` 20, about 15 kg a year, all year | Wild lowbush blueberry clones 0.2 to 4.8 kg a bush a year, averaging 1.1 to 2.2 kg by year [2]; cultivated highbush 2.3 to 4.5 kg [3] | Measured | **About 1.5 kg a year (900 kcal), ripening over a season of 4 to 8 weeks** |
| Yield of land | About 19,000 kg a hectare a year in the thickets | Bilberry forest 4 to 65 kg a hectare a year [4]; an exceptional huckleberry field in an exceptional year about 630 kg a hectare (112 US gallons an acre [5], at an estimated 0.6 kg a litre) | Measured, then derived | Follows from the bush yield |
| `bushCapacityKcal` | 400 (0.8 kg ripe at once) | At the peak of the season, most of a bush's 1 to 2 kg is ripe at once [2] | Derived | **900** (1.5 kg) in season |
| `forageKcalPerHour` | 1,200 | An experienced picker in the best huckleberry patch picks about 1 US gallon an hour [6], about 2.3 kg or 1,400 kcal | Derived | **1,200 to 1,400 at a full bush.** Picking should slow as a bush empties, since a sparse bush takes longer per berry |
| `shelfLifeHours` | 48 | Fresh berries keep 2 to 4 days unrefrigerated | Estimate | **Keep 48 to 72** |

## The body

| Parameter | Now | Real world | Trust | Proposal |
| --- | --- | --- | --- | --- |
| `bodyKg` | 60 | Hadza adults weigh about 43 to 51 kg [7] | Measured | **Keep 60**, a lean modern adult |
| `walkCmPerSecond` | 125 | Self-chosen walking speed 1.32 m/s [8] | Measured | **Keep 125**, allowing for rough ground |
| `sleepKcalPerHour` | 60 | Basal metabolism of a 60 kg adult man is about 1,600 kcal a day, 66 kcal an hour (FAO/WHO/UNU: 15.3 × 60 + 679) [9] | Derived | **Keep 60 to 65** |
| `restKcalPerHour` | 90 | Standing at rest is about 1.5 × body mass in watts [10], 77 kcal an hour; sitting and light tasks 1.3 to 1.5 MET | Derived | **Keep 80 to 90** |
| `forageCostKcalPerHour` | 300 (all work) | Picking fruit 3.0 to 3.5 MET [11], 180 to 210 kcal an hour; chopping wood 6 MET [11], 360 kcal an hour | Measured | **Split by task:** picking 200, gathering sticks 250 (estimate), chopping 360, making an axe 150 (estimate, seated grinding) |
| Daily total | Not yet measured from a run | Hadza men use about 2,600 kcal a day, women 1,900 [7] | Measured | A check on the whole budget, not a parameter |
| `reserveMaxKcal`, `initialReserveKcal` | 20,000, 16,000: a forager starves in about a week | A lean 60 kg adult holds about 9 kg of fat, about 70,000 kcal at 7,700 kcal a kilogram; people survive one to two months without food [12] | Derived | **Reserve of about 70,000 to 80,000**, so scarcity shows as weight lost over weeks before death |
| `hungryBelowKcal`, `satiatedAtKcal` | 14,000, 18,000 | People feel hungry daily, long before their fat runs low | Estimate | **Hunger set by a day's shortfall below the full reserve**, not by a fixed fraction of a small one |

## Carrying loads

Now a load slows the walker and costs nothing extra: speed falls to `bodyKg / (bodyKg + L)`, so a 30 kg load slows a 60 kg forager by a third, and walking costs 300 kcal an hour whatever the load.

Real people barely slow down. In a 2022 study, walkers carrying 20% of their body mass kept the same pace, and at 40% slowed by only 3% [8]. The load costs energy instead. The Pandolf equation [10] gives the metabolic rate `M` in watts for body mass `W`, load `L`, speed `V` in m/s and terrain factor `η` (1.2 for light brush):

`M = 1.5 W + 2.0 (W + L) (L / W)² + η (W + L) (1.5 V²)`

For a 60 kg forager at 1.25 m/s in light brush, converted at 0.86 kcal per watt-hour:

| Load | Now: speed, cost | Pandolf: speed, cost |
| --- | --- | --- |
| None | 125 cm/s, 300 kcal/h | 125 cm/s, **223 kcal/h** |
| 20 kg log | 93 cm/s, 300 kcal/h | about 125 cm/s, **286 kcal/h** |
| 30 kg of wood | 83 cm/s, 300 kcal/h | about 122 cm/s, **334 kcal/h** |

**Proposal:** walking costs follow Pandolf, computed in integers, and speed falls only slightly, about 3% at 40% of body mass. A load then costs food, not time. Pandolf is known to underpredict somewhat for heavy loads [10], so these costs are on the low side.

## Warmth at night

| Parameter | Now | Real world | Trust | Proposal |
| --- | --- | --- | --- | --- |
| `coldSleepKcalPerHour` | 150, 2.5 times sleeping metabolism | Australian Aboriginal men sleeping without fire at 0 to 5 °C kept their metabolism near resting; unacclimatised men shivered and raised it [13]; Arctic Indian men's oxygen use rose about 30% overnight in moderate cold [13] | Measured, qualitative | **About 80 to 100** in a cool climate. Much more only in freezing weather, which needs seasons |
| `hutSleepKcalPerHour`, `fireSleepKcalPerHour` | 120, 80 | Between cold sleep and sleeping metabolism | Estimate | **Scale them to the new cold cost**, keeping the order: fire and hut, fire, hut, neither |

How much cold costs depends on the climate. The owner chose a cool northern climate: see [Decisions](#decisions).

## Wood and trees

| Parameter | Now | Real world | Trust | Proposal |
| --- | --- | --- | --- | --- |
| `logKg` | 20 | A pole 14 cm thick and 2.4 m long is 0.037 m³. Seasoned birch is about 700 kg/m³ [14], so 26 kg; freshly cut wood is roughly half water, about 35 kg | Derived | **About 35 kg freshly cut**, drying towards 25 kg |
| Tree size | 3 logs and 25 kg of branches, about 85 kg | Trees 14 to 20 cm thick are what the felling experiments cut [15] | Derived | **Keep** |
| `treeRegrowthDays` | 60 | Coppiced hazel gives thin poles in 7 to 10 years, and oak and ash poles in 20 to 25 [16] | Measured | **About 20 years** (7,300 days) for a 14 cm pole, from the stump or from seed |
| `treeRegrowthWoodPerDay` | 6 kg a day, about 2,200 kg a year | A tree of about 85 kg grows a few kilograms of wood a year | Estimate | **About 5 kg a year**, and a living tree drops only part of that as dead branches |
| `bushRegrowthWoodPerDay` | 1 kg a day, 365 kg a year | A berry bush grows well under 1 kg of wood a year | Estimate | **About 0.2 kg a year** |
| `woodPerHour` | 24 kg | Women in Ciskei gathered a 24 kg headload in a little over two hours [17], so about 10 to 12 kg an hour including walking | Derived | **About 15 kg an hour** of actual gathering |
| `woodLoad` | 30 kg | Headloads of 24 kg [17] and 33 kg [18] | Measured | **Keep 30** |
| `campfireWoodPerHour`, `fireWoodPerHour` | 1 kg, 12 kg a night | A three-stone fire burns roughly 0.4 to 0.75 kg an hour (the abstract's units are unclear) [19]; a fireplace at least 3.3 kg an hour [20]; households use about 9 kg a day [18] | Measured | **Keep 1** |

Most real firewood is dead wood: branches a tree has shed and trees that have died. Living plants cannot regrow kilograms of sticks a day. Under the owner's rule of firewood from living plants only, a realistic valley could not keep a fire burning. See [Decisions](#decisions).

## Felling and cutting logs with a stone axe

| Parameter | Now | Real world | Trust | Proposal |
| --- | --- | --- | --- | --- |
| `logChopMinutes` | 30 a log, the first felling the tree | With polished stone axes, a 20 cm willow fell in 30 to 60 minutes and a 20 cm ash in 60 to 90 [15]. In Denmark three men felled more than 100 small birches in 4 hours [21], about 7 minutes per tree per man. The work grows with the cut's area, so a 14 cm trunk takes about half as long as a 20 cm one | Measured, then derived | **About 20 to 30 minutes to fell, and 15 to 25 for each cross-cut**, so 30 a log on average is close |
| Felling cost | 300 kcal an hour | Chopping wood 6 MET [11] | Measured | **360 kcal an hour** |

## Making an axe

There are two kinds of stone axe.

- **A flaked axe** is knapped from a flint nodule. An experienced knapper makes a hand-axe in about 20 minutes, by a widely quoted but unchecked figure [22].
- **A ground axe** is roughed out by flaking, then ground smooth. Grinding a flint axe takes about 60 hours [23]. A good handle also needs a long period of scraping and drying [15].

In the Scandinavian experiments, ground axes lasted much longer than flaked ones [23].

| Parameter | Now | Real world | Trust | Proposal |
| --- | --- | --- | --- | --- |
| `axeHours` | 4 | Flaked: under an hour. Ground: tens of hours of grinding, plus the handle | Measured, roughly | **Flaked, 1 hour; or ground, 40 to 60 hours** |
| `axeLogs` | 40 | A ground axe outlasts a flaked one many times over [23]; no count per log was found | Estimate | **Flaked, about 10 logs; ground, a few hundred, with resharpening** |
| `axeWood` | 1 kg | A haft of about 0.5 to 1 kg of seasoned wood | Estimate | **Keep 1** |

## Huts

| Parameter | Now | Real world | Trust | Proposal |
| --- | --- | --- | --- | --- |
| `hutLogs` | 23 | Set by the hut plan in update 046 | Derived | **Keep 23** |
| `hutLogDays` | 10: a whole hut rots in 230 days | Mud huts last 1 to 2 years [24]; untreated poles in the ground last a few years | Measured roughly, plus estimate | **About 60 days a log**, so a hut lasts about 4 years, with the poles in the ground going first |

## Hazel and the lake

Added in Life 9.7, after every forager starved in Life 9.6's valley of berries alone. The owner chose to change the land, not the bodies: Mesolithic people in northern Europe lived largely on hazelnuts [25, 26] and beside water, and the valley gains both. The valley grows from 600 m to 800 m across to make room for 32 hazel thickets, and the lake lies beyond its north edge.

| Parameter | Value | Real world | Trust |
| --- | --- | --- | --- |
| `nutKcalPerKg` | 2,500 kcal a kg of nuts in their shells | Hazelnut kernels 628 kcal per 100 g [27]; about 250 per 100 g weighed with shells [28], the kernel being 35 to 45% of the weight | Measured |
| `hazelRegrowthKcalPerYear` | 3,750, 1.5 kg of nuts in their shells | Wild woodland hazel about 400 kg a hectare [30]; varieties in trials 126 to 448 kg a hectare [30]; garden bushes 2 to 5 kg, alternating heavy and light years [31] | Measured, then derived: 40 bushes on a thicket 20 m in radius are 318 a hectare, giving 477 kg a hectare, at the top of the wild range |
| `hazelCapacityKcal` | 1,875, half a year's nuts | Fallen nuts lie for months, but rodents take many | Estimate |
| `nutKcalPerHour` | 3,500 at a full bush | Hand collection from the ground 4.5 to 8 kg an hour in orchards [33]; wild bushes are sparser, and the nuts must be cracked. About 1.4 kg in their shells an hour, gathered and cracked | Derived from orchard rates, then estimate |
| `nutShelfLifeHours` | 4,380, half a year | Dry hazelnuts in their shells keep for months | Estimate |
| `fishKgPerHectare` | 100 kg a hectare, 1,800,000 kcal for the lake | Perch alone 16 to 44 kg a hectare in a Finnish lake [34]; a whole fish community up to about 540 kg a hectare in a rich reservoir [34] | Measured, then estimate |
| Fish yield | `fishGrowthPercentPerYear` 40: at most 10 kg a hectare a year, at half the stock | 166 northern Finnish lakes yielded 0.2 to 43 kg a hectare a year [29] | Measured, then derived |
| `fishKcalPerKg` | 600 kcal a kg of whole fish | Raw perch and pike flesh about 900 kcal a kg [27]; about two thirds of a fish is eaten with its roe and liver | Measured, then estimate |
| `fishKcalPerHour` | 600 at a full lake, 1 kg of fish | Anglers after perch catch 4 to 7 fish an hour [35], about 0.5 to 1 kg | Measured, then derived |
| `fishShelfLifeHours` | 24 | Fresh fish spoils within a day unchilled | Estimate |
| Work at either | `pickKcalPerHour`, 200 | Fishing from a bank and gathering nuts are light work, as picking fruit is | Estimate |
| `skillMinPercent`, `skillMaxPercent` | 75, 125 | Return rates differ widely between individual foragers of the same age and sex [32] | Measured, qualitative |

Lakes in a northern climate yield little fish for their area, so the lake gives at most 180,000 kcal a year, about 70 days of food for one forager: a reserve that can be fished down, not a staple. The hazels give 4.8 million kcal a year, and with the berries and the lake the valley feeds about seven. Hazel yields swing between heavy and light years [31], and nuts ripen in one season; both are spread evenly over the year until seasons arrive.

## Terrain

Added in Life 10, which merges the roadmap's scale and terrain steps. The valley becomes a generated stretch of young moraine country 4 km square, with every kind of site as dense by the hectare as in Life 9.7. Life 11 retains those landforms with signed datum heights and terrain-derived water.

| Parameter | Value | Real world | Trust |
| --- | --- | --- | --- |
| `valleySizeCm` | 400,000: 4 km square, 1,600 hectares | A few kilometres across, as the roadmap asks | Choice |
| Site counts | 800 berry thickets, 800 hazel thickets, 300 stands, 100 outcrops | 25 times Life 9.7's, as dense by the hectare | Derived |
| `reliefCm`, `reliefWavelengthCm` | 3,500 over 120,000: broad relief up to 35 m, varying over 1.2 km | Young moraine country has irregular relief of end moraines, kames, till plains and meltwater valleys, with numerous lakes [36]; Denmark's highest point is 171 m | Estimate; the planned DHM/Terræn comparison will test it |
| Ice flow and moraine belts | A 1 km direction lattice; 3 broken belts, half-width 50 m to 180 m and height 8 m to 22 m | End moraines form long, irregular fronts transverse to ice movement [36, 44] | Structure from mapped geology; dimensions are estimates |
| Drumlins and kames | 56 drumlins 200 m to 700 m long, 5 m to 18 m high and at least 3:1, the first 12 in an offset central train; 18 irregular kames 40 m to 120 m in radius and 5 m to 15 m high | Streamlined subglacial hills align with ice flow; kames interrupt dead-ice terrain [44, 45] | Form from literature; counts and ranges are estimates |
| Dead-ice hummocks | 4 clusters containing 240 hummocks, 15 m to 50 m wide and 2 m to 7 m high | Hummocky moraine forms clustered knobs and kettles rather than uniform noise [36, 45] | Upper tail widened for legibility at the 5 m lattice |
| Small and large kettles | 64 at 15 m to 55 m radius and 12 at 60 m to 200 m | 39,712 depressions mapped in Schleswig-Holstein, about 2.5 a km², 64% of them 1 ha or less, mainly in young moraine [37] | Mixed sizes correct the earlier all-small distribution; counts are estimates |
| Kettle depth | One eighth of radius, capped at 12 m | The kettle lake Ukleisee averages 7.5 m deep [38] | Estimate |
| Tunnel valleys | 2 broad dry valleys, 120 m to 350 m wide and 6 m to 20 m deep | Meltwater valleys are a characteristic large-scale element of the assemblage [36, 44] | Count and dimensions are estimates; Life 11 adds drainage and water |
| Microrelief | Linearly interpolated 60 m / 2.5 m and 15 m / 0.7 m noise scales | Realistic terrain retains structure at several spatial scales rather than one smooth octave [46, 47] | Visual and structural choice, to be tested against DHM/Terræn [48] |
| `dirtSlopePercent`, `stoneSlopePercent`, `dirtCurvatureCm` | 10, 30 and 40 cm | Fine soil is exposed on disturbed slopes and sharp local breaks; stone is rare | Estimate |
| `grassTerrainPercent`, `dirtTerrainPercent` | 120, 120 | Pandolf terrain factor for light brush is 1.2 [39] | Grass measured as light brush; dirt held equal until evidence supports a difference |
| `stoneTerrainPercent` | 150 | Pandolf's heavy-brush factor is 1.5 [39]; rough stony ground lies between firm ground and loose sand | Estimate |
| Speed on slopes | Speed on the flat times `exp(−3.5 · |G / 100 + 0.05|) / exp(−0.175)`, as a table of thousandths | Tobler's hiking function: 5 km an hour on the flat, fastest, 6 km an hour, on a 5% descent [40] | Measured |
| Energy on slopes | Pandolf's grade term `η (W + L) · 0.35 V G` watts [10], less Santee's correction on descents | Santee's correction for downhill walking [41]; walking costs least at about −10% [42] | Measured |
| `climbSecondsPerMetre` | 6 | Naismith's rule: an hour for every 5 km, and an hour more for every 600 m climbed [43] | Measured, a rule of thumb |
| `eyeHeightCm`, `sightStepCm` | 160, 3,000 | The eye of an adult standing; the step resolves hills 200 m apart | Measured; the step is a choice |
| `startAreaCm` | 80,000: starts within the middle 800 m | The size of Life 9.7's valley, so the band still meets | Choice |

For a 60 kg forager unloaded on grass, the integer rule gives 125 cm a second and 222 kcal an hour on the flat, 88 cm a second and 340 kcal an hour up a 10% slope, and 125 cm a second and 165 kcal an hour down one. A kilometre costs about 49 kcal on the flat, 107 up a 10% slope and 37 down it.

The land is rich: as dense by the hectare as Life 9.7's valley, it grows about 164 million kcal a year, enough for about 180 people, against a band of 8. Real Mesolithic densities were far lower, about 0.1 to 1 person a square kilometre, because of winter, which this land does not yet have. Seasons, at step 12, bring the hungry months.

## Water and drinking — Life 11

Permanent water now follows the generated land. The former north-edge lake area and terrain ramp are removed. Existing lake biomass/growth evidence is retained per body, while applying it to river reaches is explicitly provisional. The earlier 30 ha example above is a historical calculation, not a fixed current lake.

| Parameter or mechanism | Current value | Evidence and limits | Trust |
| --- | --- | --- | --- |
| Lakes and drainage | Priority-Flood, four cardinal neighbours, open boundary outlets; connected filled cells at one spill level form a lake | [Priority-Flood, Barnes et al. 2014](https://rbarnes.org/sci/2014_depressions.pdf) establishes drainage connectivity. Filling every depression assumes saturated land; it is not a groundwater or rainfall model. | Algorithmic reference plus explicit physical approximation |
| Glacial water setting | Lakes in hollows and connected downhill reaches | [GEUS Sakskøbing map and description](https://eng.geus.dk/media/13287/map6_p01-42.pdf) supports the regional setting. Generated sizes/depths still need a selected real comparison window. | Geographic basis; dimensions uncalibrated |
| `riverCatchmentM2`, `riverDepthCm` | 250,000 m²; 50 cm prescribed depth | [Danish stream research](https://www2.dmu.dk/1_Viden/2_Publikationer/3_ovrige/rapporter/PhD_MLP_Web.pdf) supplies stream/habitat context. The threshold and depth are not measured discharge or fitted channel dimensions. | Choice and estimate |
| Represented width | One 5 m terrain cell | Many real streams are narrower. Width is a resolution limit; channels block walking because there is no wading yet. | Explicit discretisation limit |
| `fishMinAreaM2` | 1,000 m² | Smaller pools remain water but contain no modelled fish stock. Eligible bodies start full; empty stocks are not reseeded. | Choice |
| `fishKgPerHectare`, `fishGrowthPercentPerYear` | 100; 40 | Existing northern-lake evidence above supports the order of magnitude. A separate stock belongs to each lake/reach. River values remain provisional. | Lake estimates, provisionally extended |
| `waterBaseMlPerDay` | 2,000 ml net resting replacement | [EFSA 2010](https://efsa.onlinelibrary.wiley.com/doi/abs/10.2903/j.efsa.2010.1459) gives adequate total intake of 2.0 L/day for adult women and 2.5 L/day for adult men under moderate conditions, including food moisture. Those values do not directly establish this net drinking requirement. | Reference range plus model estimate |
| `waterExtraMlPerKcal` | 1 ml per kcal above resting expenditure | Food moisture and metabolic water are absorbed into the net requirement; heat and humidity are not modelled. Four hours picking instead of resting add 440 ml. | Estimate and exact model consequence |
| Thirst, urgent thirst, fatal deficit | 10, 30, 100 per mille of body mass: 600, 1,800, 6,000 ml for 60 kg | Coarse behavioural/death thresholds, not clinically validated boundaries or guaranteed survival times. | Model choices |
| `drinkMlPerSecond`, `drinkStopMl`, `drinkBankHeightCm` | 10 ml/s; stop at 100 ml deficit; bank at most 100 cm above water | Drinking takes action time and records an external withdrawal without lowering fixed levels. | Estimates and hysteresis choice |

`waterStats` reports generated water area, lake area/depth distribution, river length/density and exits. These are measurements of this model, not empirical validation. Rainfall, evaporation, groundwater, seasonal water, infection, containers and fish migration remain outside this step. No survival-driven placement or lake-size fitting is used.
## What realistic numbers imply

These are worked out from the proposals above, not from runs.

- **Food.** 1,920 bushes at 1.5 kg a year give about 2,900 kg, or 1.7 million kcal a year. Eight people need about 8 million. Berries would feed one or two people, and only for a few weeks of the year. Foragers live at about 0.1 to 1 person a square kilometre; the valley is 0.36 km².
- **Firewood.** Trees and bushes would grow about 1,100 kg of wood a year, and one group's fire burns about 4,400. Fire would draw down the valley's wood.
- **Logs.** 144 trees regrowing in 20 years give about 22 logs a year. Eight huts take 184 logs to build and about 46 a year to repair. The stands would be cleared within a few years.
- **Time.** A day's food would take most of the daylight to gather in season, and could not be had at all out of season.

So realism gives the pressures the engine lacks: food and wood that run short, land that matters, and work worth sharing out. It would also starve the band unless something else changes at the same time.

## Decisions

The owner decided on 2026-10-19:

1. **The valley is in temperate northern Europe in the Mesolithic:** bilberry, hazel, birch and flint, with a real winter.
2. **Every realistic number applies at once, to the current valley.** The band is not rescued by a larger valley or new foods; it shrinks to what the valley can feed.
3. **Dead branches fall from trees at a realistic rate** and are firewood, alongside sticks from bushes and the crowns of felled trees. This replaces the Life 9.5 rule of firewood from living plants only.
4. **Axes are ground stone axes:** 40 to 60 hours to make, lasting a few hundred logs.

Later on 2026-10-19, after every forager starved in the implemented Life 9.6, the owner revised the second decision: **change the land, not the bodies.** The valley gains hazel thickets and a lake, at realistic yields, and grows to 800 m across to hold them (see [Hazel and the lake](#hazel-and-the-lake)).

## Sources

1. USDA FoodData Central, "Blueberries, raw" (FDC 171711, 2263889, 2709275), 57 to 64 kcal per 100 g. https://fdc.nal.usda.gov/ (via https://getfoodfacts.com/food/blueberries-raw-171711)
2. Yields of wild lowbush blueberry clones in Latvia, 2015 to 2019. Estonian University of Life Sciences, *Agronomy Research*. https://agronomy.emu.ee/tag/one-berry-weigth
3. Iowa State University Extension, "What kind of yield can I expect from blueberries?" https://yardandgarden.extension.iastate.edu/faq/what-kind-yield-can-i-expect-blueberries
4. Raatikainen, M., and Raatikainen, T. (1983), and Raatikainen et al. (1984), bilberry yields in central Finland, cited in *Silva Fennica*. https://silvafennica.fi/article/5180
5. Minore, D. (1972). *The wild huckleberries of Oregon and Washington: a dwindling resource*. USDA Forest Service Research Paper PNW-143. https://research.fs.usda.gov/treesearch/26265
6. Stark, N., and Baker, S. (1992), cited in Barney, D. L. (2003). Prospects for domesticating western huckleberries. https://wildhuckleberry.com/wp-content/uploads/2020/05/Barney-2003-Prospects-for-Domesticating-Western-Huckleberries.pdf
7. Pontzer, H., et al. (2012). Hunter-gatherer energetics and human obesity. *PLoS ONE*, 7(7), e40503. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0040503
8. Middleton, K. J., et al. (2022). Mechanical differences between men and women during overground load carriage at self-selected walking speeds. *IJERPH*, 19(7), 3927. https://pmc.ncbi.nlm.nih.gov/articles/PMC8997774/
9. FAO/WHO/UNU (1985). *Energy and protein requirements*. WHO Technical Report Series 724.
10. Pandolf, K. B., Givoni, B., and Goldman, R. F. (1977). Predicting energy expenditure with loads while standing or walking very slowly. *Journal of Applied Physiology*, 43(4), 577–581. Summary and terrain factors: https://en.wikipedia.org/wiki/Pandolf_equation
11. Ainsworth, B. E., et al. *Compendium of Physical Activities*. https://pacompendium.com/
12. Rough survival times without food: https://www.medicinenet.com/how_long_does_it_take_to_die_if_you_dont_eat/article.htm. The fat store is derived from about 15% body fat at 7,700 kcal a kilogram.
13. Scholander, P. F., et al. (1958), and Hammel, H. T. (1959), on Australian Aboriginal men sleeping in the cold, reviewed in Leppäluoto, J., and Hassi, J.; and the overnight response of Arctic Indian men. https://pmc.ncbi.nlm.nih.gov/articles/PMC1359946, https://openpolar.no/Record/ftdtic:AD0261234/Details
14. Engineering ToolBox, "Wood species: moisture content and weight". https://www.engineeringtoolbox.com/weigt-wood-d_821.html
15. French Ministry of Culture, *Palafittes*: "Felling trees" with polished stone axes in antler sleeves. https://archeologie.culture.gouv.fr/palafittes/en/felling-trees
16. *Conservation Handbooks*, coppice species and growth. https://conservationhandbooks.com/?p=379
17. Fuelwood headloads in Ciskei, South Africa (1990). Southern Cross University. https://researchportal.scu.edu.au/esploro/outputs/doctoral/What-is-free-about-fuelwood-A/991012821125202368
18. Headloads in Uttarakhand, India, and household use in Malawi. https://krishi.icar.gov.in/jspui/handle/123456789/39131?mode=full, https://microdata.fao.org/index.php/catalog/1910/variable/V99
19. Characterization of conventional cooking stoves in south-eastern Nigeria. *CIGR Journal*. https://cigrjournal.org/index.php/Ejounral/article/view/3037
20. Sacramento Metropolitan Air Quality Management District, Rule 417 comments. https://www.airquality.org/ProgramCoordination/Documents/Rule417%20WrittenComments%20102606%20Item21.pdf
21. Iversen, J. (1956). Forest clearance in the Stone Age. *Scientific American*, 194; and Steensberg, A. (1979). *Draved*. Summary: https://bactra.org/reviews/natures-keepers/stone-axes.html
22. Miles, D. *The Tale of the Axe*, as quoted at https://www.greaterwrong.com/posts/bkjqfhKd8ZWHK9XqF/should-you-make-stone-tools/comment/TsYzcSL3oFfPtnqzJ. Unverified.
23. "Testing times: examining insights from experimental archaeology". *The Past*. https://the-past.com/feature/testing-times-examining-insights-from-experimental-archaeology
24. "African round hut". Wikipedia. https://en.wikipedia.org/wiki/African_round_hut
25. Mithen, S., et al. (2001). Plant use in the Mesolithic: evidence from Staosnaig, Isle of Colonsay, Scotland. *Journal of Archaeological Science*, 28(3), 223–234. Summarised in ScARF, Mesolithic activities: https://scarf.scot/?p=1817
26. Holst, D. (2010). Hazelnut economy of early Holocene hunter-gatherers: a case study from Mesolithic Duvensee, northern Germany. *Journal of Archaeological Science*, 37(11), 2871–2880. https://en.wikipedia.org/wiki/Duvensee_archaeological_sites
27. USDA FoodData Central: hazelnuts (FDC 2707502), 628 kcal per 100 g; raw perch and pike about 90 kcal per 100 g. https://fdc.nal.usda.gov/ (via https://getfoodfacts.com/food/hazelnuts-2707502)
28. Hazelnuts, kernel only, weighed with shells, 247 kcal per 100 g. https://www.caloriecounter.com.au/?p=617699
29. Ranta, E., and Lindström, K. (1998). Fish yields of 166 northern Finnish lakes, 0.2 to 43 kg a hectare a year. *Annales Zoologici Fennici*, 35. https://www.annzool.net/PDF/anzf35/anzf35-095p.pdf
30. Wild hazel in Arasbaran forest, Iran, about 395 kg a hectare: https://www.magiran.com/paper/865071/?lang=en; hazel varieties in Ukrainian trials, 126 to 448 kg a hectare: https://journal.udau.edu.ua/assets/files/88/agro/angl/17.pdf
31. Garden hazel bushes, 2 to 5 kg a bush, alternating heavy and light years; 1 kg of whole nuts gives about 350 g of kernels. Anecdotal: https://permies.com/mobile/t/40/27229/Hazelnuts-harvest-processing-propagation
32. Koster, J., et al. (2020). The life history of human foraging: cross-cultural and individual variation. *Science Advances*, 6(26), eaax9070.
33. Traditional hand harvesting of hazelnuts, 4.5 to 5.3 kg an hour: https://journals.tubitak.gov.tr/agriculture/vol40/iss3/1; manual collection from the ground, 6 to 8 kg an hour: https://fsantos.utad.pt/Bibliografia/04TarragPap0615.pdf
34. Perch biomass 16.1 to 44.2 kg a hectare over 20 years in a Finnish humic lake: https://jukuri.luke.fi/bitstreams/436ea40c-cadf-40f5-a5eb-b4d71634d13f/download; a whole fish community about 537 kg a hectare in a Polish reservoir: https://czasopisma.pan.pl/Content/89902
35. Sodus Bay creel survey: anglers after yellow perch caught 4.4 to 7.1 perch an hour. https://extapps.dec.ny.gov/docs/fish_marine_pdf/sbaycreel.pdf
36. Old and Young Drift: the area of the last glaciation is recognisable by its irregular relief and numerous lakes, with end moraines, kames, till plains and meltwater valleys. https://en.wikipedia.org/wiki/Old_and_Young_Drift
37. 39,712 topographic depressions mapped in Schleswig-Holstein, 63.88% of them 0.01 km² or less, mainly in young moraine landscapes. *E&G Quaternary Science Journal*, 65, 24 (2016). https://egqsj.copernicus.org/articles/65/24/2016/egqsj-65-24-2016.pdf
38. Ukleisee, a Weichselian kettle lake in Ostholstein, 17.0 m deep at most and 7.5 m on average. https://en.wikipedia.org/wiki/Ukleisee
39. Soule, R. G., and Goldman, R. F. (1972). Terrain coefficients for energy cost prediction. *Journal of Applied Physiology*, 32(5), 706–708. Reviewed in: Terrain factors for predicting walking and load carriage energy costs: review and refinement. https://jhp-ojs-tamucc.tdl.org/jhp/article/view/67
40. Tobler, W. (1993). *Three presentations on geographical analysis and modeling*. NCGIA Technical Report 93-1. Summarised in the movecost documentation: https://www.rdocumentation.org/packages/movecost/versions/3.0.0/topics/mc_cost_functions
41. Santee, W. R., Allison, W. F., Blanchard, L. A., and Small, M. G. (2001). A proposed model for load carriage on sloped terrain. *Aviation, Space, and Environmental Medicine*, 72(6), 562–566. Its correction is summarised at https://en.wikipedia.org/wiki/Pandolf_equation
42. Minetti, A. E., et al. (2002). Energy cost of walking and running at extreme uphill and downhill slopes. *Journal of Applied Physiology*, 93(3), 1039–1046.
43. Naismith's rule: an hour for every three miles, and an hour more for every 2,000 feet of ascent (1892). https://en.wikipedia.org/wiki/Naismith%27s_rule
44. Pedersen, S. A. S., Rasmussen, L. A., and Fredericia, J. (2015). *Geological map of Denmark 1:50,000, Sakskøbing 1411 I and 1412 II Syd*. GEUS Map Series 6. https://eng.geus.dk/media/13287/map6_p01-42.pdf
45. Möller, P. (2010). Melt-out till and ribbed moraine formation, a case study from south Sweden. *Sedimentary Geology*, 232(3–4), 161–180. https://doi.org/10.1016/j.sedgeo.2009.11.003
46. SideFX. *HeightField Erode 2.0*: terrain structure from interacting erosion, deposition and material layers at multiple scales. https://www.sidefx.com/docs/houdini/heightfields_cop/erosion.html
47. Cordonnier, G., et al. (2016). Large scale terrain generation from tectonic uplift and fluvial erosion. *Computer Graphics Forum*, 35(2), 165–175. https://onlinelibrary.wiley.com/doi/10.1111/cgf.12820
48. Klimadatastyrelsen. *Danmarks Højdemodel – Terræn (DHM/Terræn)*, nationwide bare-earth elevation data from airborne LiDAR. https://dataforsyningen.dk/data?filter=99%3Btag-103&view=gallery
