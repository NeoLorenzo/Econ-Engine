# [LIFE10-GlacialRelief-051.2]

Life 10 is the first step of the [roadmap](ROADMAP.md) towards a realistic life, and the only version of the Life core in the repository. Earlier steps built it one mechanism at a time and live on in git history, the changelog and the lab notes; this document describes the whole simulation as it stands.

A band of foragers lives on a stretch of glacial land 4 km across, sloping down to a lake, simulated minute by minute in whole centimetres, kilocalories and kilograms. The terrain shares one ice-flow history: streamlined drumlins run with the former ice, broken moraine fronts cross it, hummocky dead-ice ground and kettle hollows cluster behind those fronts, kames interrupt the lower ground, and broad tunnel valleys cut through the assemblage. Quiet till plain separates the busier belts. The whole land is one grassland biome for now, with grassy ground, exposed dirt on disturbed slopes and valley cuts, and rare exposed stone. The foragers pick berries bush by bush, gather hazelnuts, fish from the shore, gather sticks from bushes and dead branches from under trees, eat, carry food that spoils, burn wood against cold nights, swap wood for food, and get better at what they practise. They start scattered near the middle of the land and know only what they have seen. By day they see up to a kilometre, but not through hills, and they check the thickets, stands and outcrops they know when their needs are met. Walking uphill is slow and costly, gently downhill quick and cheap, and stony ground is harder going than grass or dirt. A load costs them energy and slows them a little, and they take a full load home before anything else. Those without a group look for company; two who meet found a group and plant a flag, and anyone who meets a member joins. Each group keeps one fire at its flag, which warms every member asleep on the ring of huts round it.

Every member wants a hut of its own, built of 23 logs. Logs can only be cut from trees with an axe: the first cut fells a tree whole, and the rest of its logs are cut from the trunk where it lies. A member makes or buys an axe only because its hut needs logs. An axe is ground at the hearth from a stone picked up at an outcrop and a kilogram of wood, over days of work. A forager who has made more axes lately makes them faster and better, and better axes cut faster and last longer. Axes wear out and huts weather, so the need for logs, and so for axes, never ends. Members may sell axes to each other for food.

Every physical number comes from real-world measurements, recorded with their sources and how far they can be trusted in the [calibration document](CALIBRATION.md). The land is in Mesolithic northern Europe: bilberries, hazel, birch, flint and a fishing lake, with cool nights. Life 9.6 set the numbers for people and plants, and Life 9.7 added hazel and the lake and gave foragers different born foraging skill, so that when food runs short the least able go hungry first.

**New in Life 10.** The flat 800 m valley becomes a generated landscape 4 km across, 25 times the area, shaped like the young moraine country that the last ice sheet left across Denmark, Scania and northern Germany. Its relief is a linked glacial assemblage rather than independent noise, round hills and straight capsules. A regional ice-flow field organises curved moraine belts, aligned drumlins, clustered dead-ice hummocks and kettles, irregular kames and a few broad tunnel valleys. Two microrelief scales break up their otherwise mathematical slopes while protected till plain leaves a quieter part of the map. It does not contain mountains: mountains would be out of scale for both this 4 km land and its setting. The surface is grass by default, exposed dirt where relief exposes it and stone only at outcrops and unusually steep cuts; sand and wet ground wait for water and vegetation to make them meaningful. Each plant grows on grass or dirt and not exposed stone. Slopes slow walking, by Tobler's hiking function, and cost energy, by the Pandolf equation's grade term with Santee's correction downhill; the ground underfoot sets the Pandolf terrain factor; hills block long sight. Foragers judge a walk by its distance and its climb, as Naismith's rule does. The land is held in chunks, so that each forager looks only at what is near it, and the minute is rebuilt to be fast over the larger land: a year of the canonical land runs in minutes.

## What Life 10 makes realistic

- **The shape of the land.** A forager walking from its hearth to a hazel thicket now crosses landforms that belong together: quiet till plain, drumlin trains, transverse moraine belts, clustered hummocks and kettles, kames and broad dry tunnel valleys. The same ice-flow history explains their direction and placement. A thicket behind high ground cannot be seen from the hearth. Where things grow follows the surface: plants grow on grass and dirt, not exposed stone.
- **Walking.** Speed falls on slopes and peaks on a gentle descent, as measured walkers' does. The energy of walking rises steeply uphill, falls on gentle descents and rises again on steep ones, and is higher on stony ground.
- **Room.** The band's land is no longer a valley it can see across in its first hour. It must explore it, and the parts it never visits stay unknown.

It leaves the band's way of life as it was: the rules for food, wood, fire, huts, axes and groups are Life 9.7's, applied on the new land.

## Checked against

| What | Real measurement | Life 10 |
| --- | --- | --- |
| Landform assemblage | GEUS maps the Sakskøbing young-moraine landscape as a crescentic end-moraine complex, a field of streamlined drumlins parallel to ice movement, a moraine plateau, esker and dead-ice complexes, and a linear drainage system [T1]. Around Jelling, hummocky moraine and a few steep-sided, consistently directed tunnel valleys interrupt the plateau [T10]. | One regional ice-flow field organises every seed. Three broken moraine belts cross it; drumlins lie in two fields with their long axes near it, including an offset train across the inhabited centre; hummocks and kettles cluster in dead-ice zones; two tunnel valleys cross several zones. A large south-eastern till plain remains subdued. |
| Relief at several scales | The Sakskøbing moraine plateau lies mostly 6-12 m above sea level; its kame complex rises about 8 m above the plateau, while the wider mapped area reaches about 30 m [T1]. South-Swedish hummocks are commonly 2-5 m high and 15-50 m wide, clustered rather than evenly spaced [T11]. | Broad relief contributes at most 35 m; moraine fronts 8-22 m, drumlins 5-18 m, kames 5-15 m and hummocks 2-7 m. Microrelief adds bounded 2.5 m and 0.7 m fields at 60 m and 15 m wavelengths. The final canonical land is measured at 15 m, 60 m and 240 m baselines rather than only by its total height range. |
| Hollows | Schleswig-Holstein holds 39,712 mapped depressions, 63.88% of them 1 ha or less, mainly in the young moraine [T2]; GEUS maps dead-ice hollows from small depressions to about 1 km across inside one complex [T1]. | 64 small kettles 15-55 m in radius and 12 large kettles 60-200 m in radius, clustered with the hummocky ground. Offset overlapping lobes make them irregular; depth is an eighth of radius but never more than 12 m. |
| Direction and shape | Drumlins lie beside one another in streamlined fields, with long axes parallel to ice movement; end-moraine ridges form curved complexes around former ice lobes [T1]. | Drumlin length is 200-700 m, width 50-180 m and length at least three times width, with its crest shifted up-flow. Moraine fronts are multi-segment curves with unequal flanks, changing height and width and gaps; kames and kettles use offset lobes rather than single circles. |
| Procedural realism | Established terrain workflows connect features with masks and apply detail at large, middle and small scales [T12]; process-based terrain research likewise finds that coherent networks and watersheds are more plausible than independent fractal features [T13]. | Landform zones mask where each family may occur; each family has its own named stream; regional, landform and microrelief scales are composed in that order. A tunnel-valley skeleton provides coherent drainage relief, while flowing water and hydrological erosion remain Step 11. |
| Speed on slopes | Tobler's hiking function: `6 · exp(−3.5 · |S + 0.05|)` km an hour on grade `S`, 5 km an hour on the flat and fastest, 6 km an hour, on a descent of 5% [T4] | The same curve, scaled to the forager's speed on the flat, 125 cm a second |
| Energy on slopes | The Pandolf equation's grade term, `η (W + L) · 0.35 V G` watts uphill [T5]; Santee's correction for descents, which makes gentle descents cheapest, about −10% [T6, T7] | Both, exactly in integers |
| Ground | Terrain factors `η`: 1.0 for a road, 1.2 light brush and 1.5 heavy brush [T8] | 1.2 on grass and exposed dirt, and 1.5 on exposed stone; grass, dirt and stone are surfaces within one grassland biome, not three biomes |
| Judging a walk | Naismith's rule: an hour for every 5 km, and an hour more for every 600 m climbed [T9] | A forager's estimate of a walk: its time on the flat, and 6 seconds more for every metre climbed |
| Speed of the engine | | A year of the canonical land, unchecked, in a few minutes on an ordinary computer: about 2 minutes as built |

## The new numbers

Each is measured, derived from measurements, an estimate, or a choice, as in the [calibration document](CALIBRATION.md), which gains a section for terrain when Life 10 is implemented.

| Parameter | Value | Real world | Trust |
| --- | --- | --- | --- |
| `valleySizeCm` | 400,000: 4 km square, 1,600 hectares | A few kilometres across, as the roadmap asks | Choice |
| Site counts | 800 berry thickets, 800 hazel thickets, 300 stands, 100 outcrops | 25 times Life 9.7's, so each kind is as dense as it was, by the hectare | Derived |
| `lakeHectares` | 150, the water along the whole north edge, 4 km by 375 m | | Choice: the lake keeps Life 9.7's depth from shore to far side; water arrives at step 11 |
| `reliefCm`, `reliefWavelengthCm` | 3,500 over 120,000: broad relief up to 35 m at a 1.2 km wavelength | Moraine plateau and wider relief in the Sakskøbing mapping [T1] | Range derived from the mapped example; exact distribution remains a calibration target |
| Ice-flow field | One of 16 regional directions, bent locally by at most two direction steps over 1 km controls | Drumlins follow ice movement, while their orientation may curve across a field [T1] | Direction chosen per seed; bend is a conservative procedural estimate |
| Moraine belts | 3 fronts, each 8-22 m high, with half-widths of 50-180 m and 150-300 m control spacing | Curved, multiple end-moraine ridges round a former ice lobe [T1] | Heights remain within the wider mapped relief; count, widths and spacing are estimates |
| Drumlins | 56, 200-700 m long, 50-180 m wide, 5-18 m high, aspect ratio at least 3:1 | Streamlined hills occur beside one another with their axes parallel to ice movement [T1] | Shape and direction measured qualitatively; ranges are estimates to be checked against DHM/Terrain [T14] |
| Kames | 18, 40-120 m in radius and 5-15 m high | The mapped Birket kame complex rises about 8 m over its plateau [T1] | The range allows individual crests above the mapped complex mean; count and radii are estimates |
| Hummock clusters and hummocks | 4 clusters holding 240 hummocks, 15-50 m across and 2-7 m high | South-Swedish hummocks are commonly 15-50 m wide and 2-5 m high and non-uniformly clustered [T11] | The upper tail is widened so clustered overlaps remain legible at the 5 m lattice |
| Kettles | 64 small at 15-55 m radius and 12 large at 60-200 m radius; depth 125 per mille of radius, capped at 12 m | Size distribution from Schleswig-Holstein [T2], with larger dead-ice hollows present in the GEUS complex [T1] | Small/large split and cap are choices within those measurements |
| Tunnel valleys | 2, 120-350 m wide and 6-20 m deep | Steep-sided tunnel valleys are the largest glacial variation around Jelling [T10]; the Sakskøbing plateau has several linear systems [T1] | Count and dimensions are estimates for a 4 km window |
| Microrelief | Up to 2.5 m at 60 m wavelength and 0.7 m at 15 m wavelength, linearly interpolated | Real relief has structure at multiple scales; multi-scale passes are standard terrain practice [T12] | Visual and geometric choice, bounded below named landform heights |
| `shoreRampCm` | 40,000: the land rises from the lake over 400 m | The lake remains at the low edge of the land until water is built in step 11 | Estimate |
| `dirtSlopePercent`, `stoneSlopePercent`, `dirtCurvatureCm` | 10, 30 and 40: dirt follows moderate slopes and strongly curved cuts or shoulders; stone needs an outcrop or an unusually steep cut | Surface exposure should follow relief rather than an unrelated colour field | Estimates; shares are reported, not tuned to a target colour percentage |
| Terrain factors | Grass 120, dirt 120 and stone 150, in percent | Light brush 1.2 and heavy brush 1.5 [T8] | Grass measured as light brush; dirt held equal until evidence supports a difference; stone is an estimate |
| Tobler's curve | Speed times `exp(−3.5 · |G / 100 + 0.05|) / exp(−0.175)` for a grade of `G` percent | [T4] | Measured |
| Grade cost | Pandolf's `0.35 V G` term uphill, with Santee's correction downhill | [T5], [T6] | Measured |
| `climbSecondsPerMetre` | 6 | Naismith: an hour for every 600 m climbed [T9] | Measured, a rule of thumb |
| `eyeHeightCm`, `sightStepCm` | 160, 3,000 | The eye of an adult standing; the step resolves hills 200 m apart | Measured; the step is a choice |
| `startAreaCm` | 80,000: foragers start scattered over the middle 800 m | The size of Life 9.7's valley, so the band still meets | Choice |

## Design decisions

### New in Life 10

| Decision | Choice | Reason |
| --- | --- | --- |
| Terrain and scale together | One step makes the land large and gives it its relief. | The owner's rule: step 10, scale, was merged into terrain, so that the land is built once at its new size. |
| How large | 4 km square. Every kind of site is as dense, by the hectare, as in Life 9.7, so the land holds about 85,000 plants and feeds about 180 people a year, far more than the band of 8. | Each plant's yield was set from real yields by the hectare, and hazel was one of the commonest shrubs of Mesolithic woodland, so its density stands. The land is rich only because it has no winter yet: seasons, at step 12, bring the hungry months. |
| Every plant stays individual | All 85,000 plants are simulated one by one, held in chunks. | Few enough to keep, which settles the roadmap's open decision for now. Counting plants in stands is left for vegetation, at step 13, when woodland covers the land with millions of trees. |
| A glacial height field | The land's height is held on a lattice every `terrainCellCm`, 500, in whole centimetres above the lake, and between lattice points by bilinear interpolation, rounded down. Named derived streams first create a regional ice-flow field and landform-zone masks. Broad relief, curved moraine fronts, aligned asymmetric drumlins, clustered irregular kames and hummocks, clustered kettles, tunnel valleys and two bounded microrelief scales are then composed in geological order (see [World](#world)). | A shared direction and clustered zones make the forms read as one history rather than unrelated objects. Three spatial scales prevent both featureless smoothness and undirected high-frequency noise. Integers keep it the same on every machine. |
| No generic hills or capsules | The former round hills and straight two-ended ridge capsules are removed. Moraine fronts are broken multi-segment curves with unequal flanks; drumlins are elongated and aligned; kames and kettles use offset lobes, while hummocks vary in orientation and proportion. | Perfect circles, domes and capsules were the main visible sign that the first pass was synthetic. Real mapped forms vary, merge and break while retaining a regional direction [T1]. |
| Quiet and busy ground | A large south-eastern mask excludes drumlins, kames, hummocks and kettles to preserve subdued till plain. Drumlin fields and dead-ice clusters organise the busier ground; the first twelve drumlins form an offset train through the inhabited centre. Bounded microrelief crosses every zone. | Real glacial maps contain plains and plateaus as well as complexes. Empty ground makes the organised belts legible, while a guaranteed central train prevents the initial observer view landing in a chance gap between landforms. |
| The lake stays on the north edge | The land falls to the lake: its height is 0 along the shore and rises over `shoreRampCm`. The lake is the water beyond the whole north edge, `lakeHectares` 150. | Lakes in hollows and rivers are step 11's. Keeping the lake on one edge keeps every straight walk on land. |
| One grassland, three surfaces | Each terrain cell is grass, dirt or stone. Stone has precedence at an outcrop and otherwise occurs only where slope is at least `stoneSlopePercent`. Dirt occurs below that threshold where slope is at least `dirtSlopePercent`, or where the absolute four-neighbour curvature is at least `dirtCurvatureCm`; grass lies everywhere else. A band configured to start together has already worked naturally exposed stone inside its camp clearing into dirt, after natural sites are placed. The former independent dirt-patch field is removed. There is no sand or wet surface in Life 10. | The owner wants one grassland rather than desert-like regions. Dirt and stone now reveal the shape of the land instead of looking painted across it, while a shared camp remains habitable on a central drumlin shoulder. Inland water and wetland arrive in step 11; living vegetation arrives in step 13. |
| Plants follow the surface | Berry bushes, hazels and trees grow on grass or dirt and not exposed stone. Outcrop centres may lie on grass, dirt or stone, after which their cells become stone. A site's centre is drawn only where every cell within its radius suits its kind, and each of its plants must lie on suitable ground. Starts lie on grass or dirt. | Exposed rock cannot carry these plants; distinguishing fertility within the grassland waits for vegetation in step 13. |
| Slopes slow walking | A forager's speed in a minute is its speed for its load times Tobler's curve for the grade ahead of it, rounded down, at least 1. The grade is the rise from where it stands to where a minute's walk at its load speed would take it, or its destination if nearer, in whole percent towards zero, held between −60 and 60. The curve is a table of whole thousandths, one for each whole percent, written out in the code. | Tobler's function is the standard measure of walking speed on slopes. A minute's walk is at most about 90 m, short against hills 200 m apart, so one grade for the minute is a fair account of the slope. A table written out is the same on every machine, as `Math.exp` is not guaranteed to be. |
| Slopes and ground cost energy | Each second of walking costs the Pandolf rate for its load, speed and grade `G`, `0.86 · (1.5 W + 2 (W + L) (L / W)² + η (W + L) (1.5 V² + 0.35 V G))` kilocalories an hour, less Santee's correction `η ((G (W + L) V) / 3.5 − (W + L)(G + 6)² / W + 25 − V²)` when `G` is negative, and never less than standing. `η` is the terrain factor of the ground where the forager stood at the start of the minute. | The Pandolf equation with its grade term is what the roadmap names, and it over-rewards descents; Santee's correction is its standard fix. Walking unloaded on grass costs 222 kcal an hour on the flat, 340 up a 10% slope, and 165 down one. |
| Ground cost by kind | Terrain factors `grassTerrainPercent` 120, `dirtTerrainPercent` 120 and `stoneTerrainPercent` 150. | Grass and dirt share the former light-brush factor until a real difference is justified; stony ground remains the estimate for heavy going. Ground costs energy, not speed: Tobler's curve sets speed. |
| Judging a walk | Every rule that asks how long a walk takes, whether a place can be reached in time, whether a forager must turn for home, and how far food is in time, uses its estimate: the flat walk at its load speed, plus `climbSecondsPerMetre` for every metre the walk's end lies above its start, rounded up. | A forager can see the rise of the land but cannot time each step of a walk before taking it; Naismith's rule is how walkers have long judged one. Its estimate is usually a little slow downhill and a little quick over hummocks, so a forager may get home somewhat after dusk, which rule 1 already handles. Endpoint heights keep it cheap. |
| Paths | Foragers still walk straight towards where they are going, over hills and through hollows. | Routes round hills need path finding over the whole land, a question for later. Slopes on this land are mostly gentle, so a straight walk is usually close to the quickest. |
| Hills block long sight | By day a forager sees, within `sightRadiusCm` of its place's centre, only what lies in places visible from its place. Rays run from an eye `eyeHeightCm` above the ground at the place's centre over the ground, sampled every `sightStepCm`; a place is visible when a ray reaches a point in it where an eye would see back, and its own place always is. It looks round by long sight when it stands in a new place by day, and at least every hour. Close sight, `perceptionRadiusCm`, is never blocked, and records everything within it every minute. | Rule 1 of the design rules: a forager knows what it could see, and a hummock hides what lies behind it. Implementation showed that a line to every place within sight, from wherever the forager stood every minute, cost seconds a simulated day once foragers explored. Rays from each place's centre are worked out once and kept, and resolve hills 200 m across. |
| Chunks | The land is cut into chunks `chunkCm`, 20,000, wide. Plants, sites and places are listed by chunk, and every search for something near a forager looks through the chunks near it first, outwards, and stops when nothing further could be better. Results never depend on the chunk size. | The roadmap's scale step: each agent looks only at what is near it. A search that stops only when nothing further can win gives exactly the answer of a search through everything. |
| A faster minute | The view from each place is worked out the first time someone stands in it and kept outside the state; searches go outwards by chunk; and the checker replays the plants worked every minute and every plant every hour, the sites in close sight every minute and every site every hour. Regrowth stays hourly. | They are what lets a year of the larger land run in minutes. Settling regrowth only when a plant is read was planned, but hourly regrowth of every plant costs only a few seconds a year. |
| Starting near the middle | With `scattered` on, starts are drawn within `startAreaCm` of the land's centre, 800 m square; the camp is the land's centre. | A band scattered over 16 km² would take weeks to meet. Starting where Life 9.7's valley was keeps the band's first days like Life 9.7's. |
| No flat switch | There is no switch for a flat land. Setting every landform count and every relief height to 0 gives one, as a configuration. | The design rule for steps: switches whose only purpose is to recreate an earlier step are removed. |

### Carried from Life 9

| Decision | Choice | Reason |
| --- | --- | --- |
| The drive for shelter | Every member wants a **hut** at its hearth, whole. A member's hearth is its slot on the ring round its group's fire, where its hut stands and it sleeps; it has no fire of its own there. Wanting logs for it comes after hunger and wood for the fire, and before exploring, checking and rest. Foragers without a group build nothing: they seek company first, and joining a group moves their hearth. | The owner's rule: shelter is an inherent drive. A hearth is fixed only once a forager belongs to a group. |
| Calibration | Every physical number comes from the [calibration document](CALIBRATION.md), which gives its source and how far it can be trusted. All of them apply at once. | The owner's rule: the numbers should be as realistic as possible. |
| Berries all year | A bush regrows `bushRegrowthKcalPerYear`, 900 kcal (1.5 kg at `berryKcalPerKg`, 600), spread evenly over the year. It holds at most `bushCapacityKcal`, 52, three weeks of ripening, and starts full. | Wild bilberry bushes give 1 to 2 kg a year. The yield is spread evenly until seasons arrive. |
| Hazel thickets | `hazelThicketCount` thickets of `hazelsPerThicket`, 40, hazel bushes, within `hazelThicketRadiusCm`, 2,000, and at least `hazelSpacingCm`, 400, apart. A hazel regrows `hazelRegrowthKcalPerYear`, 3,750 kcal of nuts, spread evenly over the year, holds at most `hazelCapacityKcal`, 1,875, and starts full. Nuts are seen only up close, like berries. A hazel gives no sticks. | Hazelnuts were the staple plant food of Mesolithic northern Europe. |
| Nuts keep | Nuts are gathered at `nutKcalPerHour`, 3,500, at a full bush, weigh 1 kg for every `nutKcalPerKg`, 2,500, carried, and spoil after `nutShelfLifeHours`, 4,380. | Nuts in their shells keep for months. There is still no store: a forager carries only what it picked beyond a full reserve. |
| Fish | The lake holds one stock of fish in kilocalories, at most `lakeHectares · lakeFishKgPerHectare · fishKcalPerKg`, and starts full. It regrows by the logistic rule, `lakeGrowthPercentPerYear`, 40, of the stock times the share of capacity still empty, each year, shared hour by hour. Fish are caught at `fishKcalPerHour`, 600, at a full lake, weigh 1 kg for every `fishKcalPerKg`, 600, and spoil after `fishShelfLifeHours`, 24. A forager fishes standing on the shore at its own `x`. | The standard model of a fish stock: a lake can be fished down. Fishing gear is not modelled. |
| Food comes slower as a source thins | A forager's hourly rate at a bush, a hazel or the lake is its full rate for that food times the stock there over the source's capacity, rounded down, and it never takes more than the source holds. A source is **worth working** while that rate is more than `pickKcalPerHour`. | A picker among sparse berries finds fewer an hour, and so does a fisher in a thin lake. |
| Choosing where to get food | A forager working for food weighs every bush and hazel it remembers as worth working and can reach in time, the nearest thicket and the nearest hazel thicket it has spotted and never checked, and the lake if it knows it, remembers it worth working and can reach the shore in time. It goes to whichever promises most food for the time: an hour there at its expected rate, over its estimate of the walk there plus that hour. | A forager weighs a richer source further away, or uphill, against a poorer one nearby, as foraging theory expects. |
| What a forager expects where it has not looked | It cannot see fish. It remembers the stock it found when it last fished, and before it has fished expects a full lake. It knows the lake once it sees any of its shore. A thicket it has spotted from afar and never checked it expects full, at its full rate for that food. | Information it could plausibly have (design rule 1). |
| Born foraging skill differs | Each forager's born foraging and wood skills are drawn from `skillMinPercent`, 75, to `skillMaxPercent`, 125. One foraging skill serves berries, nuts and fish. | Foragers differ in how much they get, and that decides who eats when food is short (design rule 19). |
| A store of fat | `reserveMaxKcal` 70,000, about 9 kg of fat; a forager starts at 66,000, is hungry below 64,000 and satiated at 68,000. | A lean adult survives one to two months without food. |
| Work by task | Each task costs its own energy: picking, nut gathering and fishing `pickKcalPerHour` 200, gathering wood and fetching stones `gatherKcalPerHour` 250, cutting logs `chopKcalPerHour` 360, and making axes `makeKcalPerHour` 150. | Measured costs of each kind of work. |
| Carrying | Speed falls by `loadSlowdownPerMille`, 75, thousandths for each body mass carried, before Tobler's curve. A load adds to the Pandolf cost of walking. | Walkers carrying 40% of their body mass slow by only 3%; the load costs energy instead. |
| Warmth | Four costs of an hour asleep: `sleepKcalPerHour`, 60, in a whole hut by a lit fire; `fireSleepKcalPerHour`, 70, by a lit fire without a hut; `hutSleepKcalPerHour`, 75, in a whole hut without a fire; `coldSleepKcalPerHour`, 90, with neither. A member's fire is its group's; a forager without a group burns its own, hut or not. | A hut keeps warm a little, the fire more. |
| Huts round the fire | Slot `i` round a flag is point `i` of the square spiral, on ring `k`, moved along its direction onto the circle `k · hutRingCm` from the flag, `hutRingCm` 700. A hut stands at the ground's height at its slot, on whatever ground is there. | Huts are built round the fire, because it warms more. |
| What a hut is made of | `hutLogs`, 23 logs, each a pole 14 cm thick and 2.4 m long, carried home from a tree and laid at the hearth. | A small A-frame for one sleeper. |
| Huts weather | Each hut loses a log every `hutLogDays`, 60 days. | Untreated poles last a few years. |
| Felling | A standing tree holds `logsPerTree`, 3 logs. The first log cut from it fells it whole: its crown's branches with `fellWood`, 10 kg, more brought down, and its other logs are cut from the trunk where it lies. A felled tree's branches do not regrow. | A tree comes down whole, then is broken down. |
| Stumps grow back | A felled tree with no logs left stands again whole at the first midnight `treeRegrowthDays`, 7,300 (20 years), after it fell. | A 14 cm pole takes 15 to 25 years to grow. |
| Firewood | Each standing tree has up to `treeCapacityWood`, 25 kg, of dead branches beneath it, added to by `treeDeadfallWoodPerYear`, 5 kg; each bush holds up to `bushCapacityWood`, 2 kg, of sticks, regrowing `bushRegrowthWoodPerDecade`, 2 kg a decade. Both are gathered by hand at `woodPerHour`, 15 kg. | Real firewood is mostly dead wood. |
| Clearing crowns first | A forager gathering wood takes from the nearest felled crown it knows with a minute's work, before any plant still growing. | Without it, felled crowns lay untouched. |
| Cutting | A member cuts at the nearest tree it knows lying felled with a log, and fells the nearest standing tree only when there is none it can reach in time. | One tree at a time is cut up before the next comes down. |
| An axe is needed to cut a log | Cutting a log takes `logChopMinutes`, 30 minutes, with an axe of quality 100, and proportionally longer with a worse one. | The drive for tools comes from the need for wood. |
| Carrying a log | A log weighs `logKg`, 35 kg. A forager carries one at a time and takes it home before anything else. | One log a trip makes the distance, and now the climb, to the trees matter. |
| Stones | **Outcrops** of `stonesPerOutcrop`, 12, stone spots holding `stonesPerSpot`, 5, stones. Stones never come back. | Stone as a resource on the map. |
| Making an axe | One stone and `axeWood`, 1 kg of wood, worked at its hearth for `axeHours · 100 / craft` hours, `axeHours` 50. Work can stop and go on later. | Ground stone axes take days of work. |
| Craft | Born craft skill times practice, from seconds spent making axes over the last `practiceDays` days. Born craft skill is drawn from `craftSkillMinPercent` to `craftSkillMaxPercent`, 100 to 100 by default. | Skill comes from making. |
| Quality | Drawn uniformly from half the maker's craft to its whole craft. Quality multiplies the speed of cutting, and an axe lasts `axeLogs`, 200, logs times its quality over 100, at least one. | The more skilled make better axes. |
| What an axe costs, is worth, and buying | An axe costs its maker `axeHours · 100 / craft` hours times `makeKcalPerHour − restKcalPerHour`; it is worth to a buyer what making its own would cost it, times its quality over the quality the buyer expects to make. A member buys an axe it has heard of that is worth more to it than the ask, and makes its own otherwise. | Local, bounded choice (design rule 2). |
| Asking, promising and selling | As in [Axes](#rules): a member needing an axe asks those within talking distance, the cheapest maker that gains the asker promises one, and a spare is sold at the midpoint of ask and worth, paid in carried food. | Without a promise, trade never happens. |
| Counterfactuals | `axeTrade`, `craftPractice` and `scattered`. | Each is a comparison for later. |

## World

The land is a square `valleySizeCm` wide; `x` runs east and `y` south from its north-west corner, so the north edge is `y = 0`. Heights are whole centimetres above the lake. Everything is drawn from seeded streams with `mixSeed` and `randomInt`.

1. **Terrain.** Eleven named streams are derived independently from the terrain seed, so changing one family does not redraw the others:
   - **Ice flow.** `terrain:flow` chooses one of a written table of 16 integer direction vectors for the regional flow. On a 1 km control lattice, every vector lies within `iceFlowTurnSteps` of the base direction, so the field bends without reversing. A landform uses the direction of the control cell holding its centre.
   - **Landform zones.** `terrain:zones` draws two broad drumlin-field masks, four dead-ice cluster masks and one protected, contiguous south-eastern till-plain mask. Later random drumlin, hummock and kettle centres are accepted only in their corresponding zone and outside the protected mask. These are placement masks, not biome boundaries.
   - **Broad relief.** `terrain:broad` gives value noise from 0 to `reliefCm` at `reliefWavelengthCm`, interpolated by integer smoothstep.
   - **Moraine fronts.** `terrain:moraines` draws `moraineBeltCount` polylines broadly perpendicular to the regional ice flow. Width and crest height change by segment. One flank is narrower and squared; the other is wider and cubed. About one segment in five is omitted. At a lattice point only the greatest moraine contribution is used.
   - **Drumlins.** `terrain:drumlins` first lays an offset train of twelve across the inhabited centre, then draws the remaining centres inside the drumlin masks, all with their long axes on the local ice-flow direction. A drumlin's length is at least three times its width, its crest is displaced towards its up-flow head, and its elliptic cross-profile has a squared falloff. At a lattice point only the greatest drumlin contribution is used.
   - **Kames.** `terrain:kames` draws each kame outside the protected till plain as the greatest of three to five overlapping, offset elliptic lobes. The lobes share no required axis, so the footprint and crest are irregular rather than circular.
   - **Hummocks.** `terrain:hummocks` assigns `hummockCount` independently oriented elliptic mounds among the four dead-ice clusters. At a lattice point only the greatest hummock contribution is used.
   - **Kettles.** `terrain:kettles` assigns the small and large kettles among the same dead-ice clusters, away from `campClearingCm`. Each depression is the greatest of two or three offset elliptic lobes. Its depth is `min(kettleMaxDepthCm, floor(radius * kettleDepthPerMille / 1,000))`.
   - **Tunnel valleys.** `terrain:valleys` draws `tunnelValleyCount` multi-segment centre lines from beyond the north edge to beyond the south edge. Width and depth change by segment and a squared cross-profile gives a broad trough. At a lattice point only the deepest valley contribution is used. These are dry landforms; their water and drainage behaviour wait for Step 11.
   - **Microrelief.** `terrain:micro-coarse` and `terrain:micro-fine` supply zero-centred, linearly interpolated value noise at 60 m and 15 m. The linear shoulders retain small-scale breaks instead of smoothing every patch into a pillow.

   At each terrain lattice point, every `terrainCellCm`, the broad relief, greatest moraine, greatest drumlin, greatest kame or hummock and the two microrelief values are added; the tunnel-valley and kettle depths are subtracted. The result is then scaled by `min(1, y / shoreRampCm)`, rounded down, and held at 0 or more. Stored contributions and final heights are integers. A point between lattice points takes the bilinear interpolation of the four around it, rounded down once.
2. **Ground.** For each terrain cell, slope is the greatest absolute grade from its centre to the centres of its four cardinal neighbours. Curvature is the absolute difference between its centre height and the rounded-down mean of those neighbours. A cell is **stone** if its slope is at least `stoneSlopePercent`; else **dirt** if its slope is at least `dirtSlopePercent` or its curvature is at least `dirtCurvatureCm`; else **grass**. Once the outcrops are drawn, every cell whose centre lies within `outcropRadiusCm` of an outcrop's centre, and every cell holding one of its stone spots, is stone.
3. **Sites.** From the layout stream, site centres are drawn uniformly over the land, at least `siteMarginCm` from its edges. A draw is rejected if it lies within `campClearingCm` of the camp, within `siteSpacingCm` of an earlier centre, or where the cell holding it, or any cell whose centre lies within the site's radius, is ground its kind does not grow on. The first `thicketCount` centres are berry thickets, the next `hazelThicketCount` hazel thickets, the next `standCount` stands and the next `outcropCount` outcrops, with IDs from 0 in draw order.
4. **Plants and stones.** For each berry thicket in turn, bushes are drawn uniformly in the square around its centre and kept if they lie within `thicketRadiusCm` of it, at least `bushSpacingCm` from the thicket's earlier bushes, and on grass or dirt, until it has `bushesPerThicket`. Hazels and trees use the same two surfaces; stones lie within each outcrop. IDs run from 0 across sites in order.
5. **Starts.** With `scattered` on, each forager's start, which is its first hearth, is drawn from a start stream of its own, uniformly within the square `startAreaCm` wide round the land's centre, in forager ID order, rejecting a draw within `startSpacingCm` of an earlier start or on stone. With it off, the band starts as one group, its flag at the camp, the land's centre, and its hearths on the rings round it.

`createValley` refuses a configuration whose terrain, zone layout, landforms, layout or starts cannot be drawn in 10,000 draws for any one zone layout, landform, site, plant or start.

The wood plants are the trees, by ID, then the bushes. A bush holds up to `bushCapacityKcal` of berries and `bushCapacityWood` of sticks, a hazel up to `hazelCapacityKcal` of nuts, and a standing tree up to `treeCapacityWood` of dead branches beneath it. Each gains its share of its period's regrowth in the first minute of every hour after minute 0, up to capacity: in hour `h` of a period of `P` hours, an amount `a` a period gives `floor(a · (h + 1) / P) − floor(a · h / P)`. Berries, nuts and dead branches have a year of 8,760 hours, sticks a decade of 87,600. A felled tree gains no dead branches, and a crown above capacity keeps what it has. Trees, logs and stones are as in Life 9.

**The lake.** The lake lies beyond the north edge, `y < 0`. Its shore is the edge `y = 0`, at height 0; a forager fishing stands at `(x, 0)` for its own `x`, and walks there straight north. Its stock and its logistic growth, with its remainder, are as in Life 9.7. A forager sees the lake when a point of its shore lies within its long sight.

**Places.** Place `p` covers column `p mod n` and row `floor(p / n)`, where `n = ceil(valleySizeCm / placeCm)`: a square `placeCm` wide, cut at the land's edge.

**Visibility.** From place `p`, with centre `c` and eye `h₀ = h(c) + eyeHeightCm`, a ray runs towards each point `c + (offset · placeCm, ±R)` and `c + (±R, offset · placeCm)`, for every whole `offset` from `−r` to `r − 1`, with `r = ceil(sightRadiusCm / placeCm) + 1` and `R = r · placeCm`. Along a ray, sample `k` lies `d = k · sightStepCm` from `c`, out to `sightRadiusCm`, at `c` plus the ray's direction times `d`, in whole centimetres towards zero; a ray leaving the land takes one last sample where it crosses the edge, and stops. With `s` the steepest `(h(j) − h₀) / d_j` of the samples before it, compared by cross-multiplying, sample `k` is seen when there is none before it or when `(h(k) + eyeHeightCm − h₀) / d ≥ s`, and so is the place that holds it. Place `q` is **visible** from `p` when some ray sees a sample in it, or `q` is `p`. A place's view is worked out the first time a forager stands in it by day and kept, outside the state, for the run.

A thing at a point lies **within long sight** of a forager when it is within `sightRadiusCm` of the centre of the forager's place and its place is visible from there; a place lies **wholly within sight** when all four of its corners are within `sightRadiusCm` of that centre and it is visible. Close sight, within `perceptionRadiusCm` of the forager itself, is never blocked.

**Chunks.** Chunk `c` covers column `c mod k` and row `floor(c / k)`, with `k = ceil(valleySizeCm / chunkCm)`. Plants, stone spots, sites and places are listed by the chunk that holds them. Every search for the nearest, or the best, of something looks through chunks in rings outwards from the forager's own, and stops once the nearest point of the next ring is too far for anything in it to beat what it has found, so it finds exactly what a search through everything finds, ties included.

**Skills.** As in Life 9.7: each forager's born foraging, wood and craft skills are drawn from the skill stream, and its rates for a day are the base rate times born skill times practice, rounded down, with practice

`P(s) = practiceMinPercent + floor((practiceMaxPercent − practiceMinPercent) · s / (s + 3,600 · practiceHalfHours))`.

## The forager

| State | Meaning |
| --- | --- |
| `x`, `y`, `hearth` | Its position and its hearth, in whole centimetres |
| `energyKcal`, `hungry` | Its reserve, and hunger with hysteresis: hungry below `hungryBelowKcal`, until it reaches `satiatedAtKcal` |
| `carried` | Food it carries, as lots of one food, berries, nuts or fish, taken in one minute, oldest first; a lot spoils its food's shelf life after it was taken |
| `wood`, `shortOfWood`, `tripWood` | Wood it holds, wood need with hysteresis, and wood gathered since it last stood at its hearth |
| `log`, `stone` | Whether it carries a log, and the stones it holds |
| `foodMemory`, `lakeMemory`, `woodMemory` | For each bush and hazel, the food it last saw there; the lake's stock when it last fished there; and for each wood plant its sticks or branches; each with the minute, or never. Held by chunk. |
| `logMemory`, `stoneMemory` | For each tree, the logs it last saw on it, and for each stone spot its stones, with the minute, or never. Held by chunk. |
| `placeSeen`, `siteKnown`, `siteChecked` | For each place, the first minute it lay wholly in sight; for each site, whether it has spotted it and the last minute it checked it |
| `groupId`, `knownFlags`, `exploreTarget` | Its group, the flags it has seen and not since found gone, and the place it is walking to |
| `practiceLog`, rates, `craft` | Its seconds at picking, gathering and making axes on each of its last `practiceDays` days, its rates and its craft for the day |
| `hut`, `axe`, `spareAxe`, `making`, `chopRemainder`, `promised` | Its hut, axes, axe work and promise, as in Life 9 |
| `heardTerms`, `heardAsk`, `trip` | The last terms for wood it heard, the best ask for an axe it heard, and a trip to gather wood to sell |
| remainders, `fireHour`, `warm` | Remainders in 3,600ths of picking, gathering and energy owed; the hour of its last fire decision and whether a fire warms it that hour |
| `fireGiven`, `warmByFireMinutes`, axe totals | As in Life 9 |
| `climbedCm` | The height it has climbed, in whole centimetres, summed over every minute's rise |
| `farPlace`, `farMinute` | The place it last looked round from by long sight, or none since dark, and the minute it did |

A forager starts at its hearth with `initialReserveKcal`, nothing carried, no wood, no stone, log, axe or hut, and having seen nothing. Groups and huts are as in Life 9.

## The minute

Each minute runs these phases in order.

0. **Practice and weathering.** In the first minute of every day after the first, each living forager enters yesterday's seconds in its log, drops the oldest day, and takes its rates and craft for the day. Every hut whose day has come loses a log. Every felled tree with no logs left that fell at least `treeRegrowthDays` ago stands again whole.
1. **Regrowth.** In the first minute of every hour after minute 0: berries, nuts, sticks and dead branches, each its share of its period, and the lake's fish by the logistic rule.
2. **Fires.** At the start of every hour: if it is night, each standing group's fire burns `campfireWoodPerHour` and is lit if it holds that much, and is out otherwise. By day every fire is unlit.
3. **Turn order.** A seeded shuffle of the band, from a stream derived from the run seed and the minute.
4. **Turns.** Each living forager in that order:
   1. **Spoilage** and **eating** from what it carries, oldest first, up to the room in its reserve.
   2. **Observation.** Within close sight, every minute, it records the food on every bush and hazel, the wood on every wood plant, the logs on every tree and the stones on every stone spot; spots every site; marks every place wholly in close sight as seen; and learns of the lake if it sees its shore. It checks every site whose centre lies within `perceptionRadiusCm` less the site's radius. By day, when it stands in a place other than the one it last looked round from, or last looked round an hour or more ago, it looks round by long sight: within long sight it spots every site, records the logs on every tree and the stones on every stone spot, marks every place never seen that lies wholly in sight, and learns of the lake if it sees its shore. Every minute it learns every standing flag it sees and forgets every known flag whose spot it sees holding none.
   3. **Decision.** Hunger and wood need are updated; then the first rule that applies (see [Rules](#rules)). Its grade and speed this minute are set by where it is going, the ground it stands on and the load it carries as it sets out.
   4. **Action.** The minute's 60 seconds.
   5. **Meeting.** A forager without a group meets the nearest living forager within `talkRadiusCm`, if any: it joins a member's group, or the two found a new group with the flag at their midpoint.
   6. **Exchange.** Swaps and quotes of wood with members of its own group within `talkRadiusCm`; then asking, promising and selling axes.
   7. **Feeding.** A member at its hearth feeds its group's fire.
   8. **Building.** A member at its hearth carrying a log lays it in its hut.
   9. **Eating again** and **metabolism.** Each second's hourly cost is added to its cost remainder and the whole kilocalories are paid. At 0 it dies of starvation; if that leaves its group with one living member or none, the group dissolves.
5. **Record.** Events, the day's summary, and the invariants.

### Rules

Let `D` be the daylight seconds left in the minute, 0 at night. A forager's load `L` is its trip's wood, its log at `logKg`, and its carried food at each food's kilocalories a kilogram, in whole kilograms rounded down once over the total. Its **load speed** is `max(1, floor(walkCmPerSecond · (1,000 · bodyKg − loadSlowdownPerMille · L) / (1,000 · bodyKg)))` centimetres a second.

Its **estimate** of a walk from `a` to `b` is `ceil(distance / loadSpeed) + ceil(climbSecondsPerMetre · max(0, h(b) − h(a)) / 100)` seconds. A plant, stone spot, point or the shore can be **reached in time** if its estimates of walking there and walking home, plus a minute's work there, take at most `D` seconds; it can be **reached and left before dusk** if the walks there and home take at most `D`.

| Priority | Condition | Action | Reason recorded |
| --- | --- | --- | --- |
| 1 | Away from its hearth, and it is night or its estimate of walking home is at least `D` | Walk home | `going home` |
| 2 | It is night | Sleep | `night` |
| 3 | Carrying a log | Walk home | `taking a log home` |
| 4 | Not hungry, and filling a load: `0 < tripWood < woodLoad` | Work for wood | `filling a load` |
| 5 | Not hungry, and carrying a full load | Walk home | `taking a load home` |
| 6 | Neither hungry nor short of wood, and without a group | Walk towards the nearest forager it sees, or to its nearest known flag it can reach and leave before dusk, or explore | `seeking company`, or `waiting for company` at the flag |
| 7 | A member neither hungry nor short of wood, making an axe | Walk home and work on it | `making an axe`, or `going home to make an axe` |
| 8 | A member neither hungry nor short of wood, its hut not whole, and holding an axe (or a spare, which it takes up) | Cut a log at the nearest felled tree it knows holds one and can reach in time, else the nearest standing tree, walking to it first if needed | `cutting a log` or `seeking a tree` |
| 9 | A member neither hungry nor short of wood, its hut not whole, holding no axe, and it has heard of an axe for sale worth more to it than the ask | If the axe is not made yet, wait at its hearth. Otherwise pick food until it carries the price at the midpoint, then wait at its hearth | `waiting for an axe being made`, `picking food to buy an axe`, `taking food home to buy an axe` or `waiting to buy an axe` |
| 10 | A member neither hungry nor short of wood, whose hut is not whole and who holds no axe, or who has promised an axe | Make an axe: fetch a stone from the nearest stone spot it knows holds one and can reach in time, if it holds none; then, holding `axeWood`, begin at its hearth | `fetching a stone`, `picking up a stone`, `making an axe` |
| 11 | Neither hungry nor short of wood, and somewhere to explore | Walk towards the nearest place never seen, or else to the nearest site not checked for `exploreAfterHours` | `exploring` or `checking` |
| 12 | Neither hungry nor short of wood | Rest | `satiated` |
| 13 | The choice of work says wait | Rest | `waiting to swap` |
| 14 | It remembers no source of the good worth working that it can reach in time, and knows a site of that kind it has never checked, or a place it has never seen, that it can reach and leave before dusk | Walk towards the nearest such site, or else the nearest such place | `searching` |
| 15 | No source of the good that it can reach in time | Rest | `too late to set out` or `waiting for regrowth` |
| 16 | Otherwise | Work at its target, walking to it first if needed | `foraging`, `gathering nuts`, `fishing`, `gathering`, `seeking food` or `seeking wood` |

"Nearest" is by straight distance, as in Life 9; "in time" is by the estimate. A rule from 7 to 10 that finds nothing it can reach in time falls through to the next. Rule 10 needs `axeWood` in hand; a member short of it is short of wood, and gathers.

**The choice of work, food sources, wood plants, swaps and axes** are as in Life 9.7, except that the walk in a food source's worth, `3,600 · rate / (walk + 3,600)`, is the forager's estimate of the walk there. Food sources and wood plants are searched by chunk, which finds the same source a search of every plant finds.

### The 60 seconds

A walking forager takes its **grade** `G` for the minute: with `a` the point a walk of `60 · loadSpeed` would reach towards its destination, or the destination if nearer, `G` is `100 · (h(a) − h(here)) / distance(here, a)` in whole percent towards zero, held between −60 and 60, and 0 if `a` is where it stands. Its **speed** is `max(1, floor(loadSpeed · tobler(G) / 1,000))`, with `tobler` the table of `round(1,000 · exp(−3.5 · |G / 100 + 0.05| + 0.175))`. It walks towards its destination at that speed and arrives within the minute if it can. Each second of walking costs the Pandolf rate for its load, speed and grade, with Santee's correction for a negative grade and the terrain factor of the ground where it stood when the minute began, computed exactly in integers, rounded down once to 3,600ths of a kilocalorie and never less than `restKcalPerHour`. Its `climbedCm` grows by any rise between where it started the minute and where it ended it.

Work, cutting, fetching stones, making axes, standing and sleeping are as in Life 9: having arrived at a wood plant holding a minute's work, or at a bush, hazel or the shore worth working, it works the seconds left, taking whole units by its rate there and never more than the source holds. Picking, gathering nuts and fishing cost `pickKcalPerHour`, gathering and fetching stones `gatherKcalPerHour`, cutting `chopKcalPerHour`, making `makeKcalPerHour`, standing `restKcalPerHour`, and sleeping the cost of its warmth.

## Defaults

| Parameter | Canonical value | Parameter | Canonical value |
| --- | --- | --- | --- |
| **`valleySizeCm`** | **400,000** | `bandSize` | 8 |
| **`thicketCount`**, `bushesPerThicket` | **800**, 60 | **`hazelThicketCount`**, `hazelsPerThicket` | **800**, 40 |
| **`standCount`**, `treesPerStand` | **300**, 12 | **`outcropCount`**, `stonesPerOutcrop` | **100**, 12 |
| **`lakeHectares`**, `lakeFishKgPerHectare` | **150**, 100 | `lakeGrowthPercentPerYear` | 40 |
| **`terrainCellCm`, `chunkCm`** | **500, 20,000** | **`startAreaCm`** | **80,000** |
| **`reliefCm`, `reliefWavelengthCm`** | **3,500, 120,000** | **`iceFlowControlCm`, `iceFlowTurnSteps`** | **100,000, 2** |
| **`moraineBeltCount`, `moraineMinHeightCm`, `moraineMaxHeightCm`** | **3, 800, 2,200** | **`moraineMinHalfWidthCm`, `moraineMaxHalfWidthCm`** | **5,000, 18,000** |
| **`moraineMinControlCm`, `moraineMaxControlCm`** | **15,000, 30,000** | **`drumlinCount`** | **56** |
| **`drumlinMinLengthCm`, `drumlinMaxLengthCm`** | **20,000, 70,000** | **`drumlinMinWidthCm`, `drumlinMaxWidthCm`** | **5,000, 18,000** |
| **`drumlinMinHeightCm`, `drumlinMaxHeightCm`** | **500, 1,800** | **`drumlinMinAspectPerMille`** | **3,000** |
| **`kameCount`, `kameMinRadiusCm`, `kameMaxRadiusCm`** | **18, 4,000, 12,000** | **`kameMinHeightCm`, `kameMaxHeightCm`** | **500, 1,500** |
| **`hummockClusterCount`, `hummockCount`** | **4, 240** | **`hummockMinWidthCm`, `hummockMaxWidthCm`** | **1,500, 5,000** |
| **`hummockMinHeightCm`, `hummockMaxHeightCm`** | **200, 700** | **`smallKettleCount`, `largeKettleCount`** | **64, 12** |
| **`smallKettleMinRadiusCm`, `smallKettleMaxRadiusCm`** | **1,500, 5,500** | **`largeKettleMinRadiusCm`, `largeKettleMaxRadiusCm`** | **6,000, 20,000** |
| **`kettleDepthPerMille`, `kettleMaxDepthCm`** | **125, 1,200** | **`tunnelValleyCount`** | **2** |
| **`tunnelValleyMinWidthCm`, `tunnelValleyMaxWidthCm`** | **12,000, 35,000** | **`tunnelValleyMinDepthCm`, `tunnelValleyMaxDepthCm`** | **600, 2,000** |
| **`tunnelValleyMinControlCm`, `tunnelValleyMaxControlCm`** | **20,000, 40,000** | **`microCoarseWavelengthCm`, `microCoarseAmplitudeCm`** | **6,000, 250** |
| **`microFineWavelengthCm`, `microFineAmplitudeCm`** | **1,500, 70** | **`shoreRampCm`** | **40,000** |
| **`dirtSlopePercent`, `stoneSlopePercent`, `dirtCurvatureCm`** | **10, 30, 40** | **`grassTerrainPercent`, `dirtTerrainPercent`** | **120, 120** |
| **`stoneTerrainPercent`** | **150** | **`climbSecondsPerMetre`** | **6** |
| **`eyeHeightCm`, `sightStepCm`** | **160, 3,000** | | |
| `hazelThicketRadiusCm`, `hazelSpacingCm` | 2,000, 400 | `hazelCapacityKcal`, `initialHazelKcal`, `hazelRegrowthKcalPerYear` | 1,875, 1,875, 3,750 |
| `nutKcalPerHour`, `nutKcalPerKg`, `nutShelfLifeHours` | 3,500, 2,500, 4,380 | `fishKcalPerHour`, `fishKcalPerKg`, `fishShelfLifeHours` | 600, 600, 24 |
| `thicketRadiusCm`, `bushSpacingCm` | 1,200, 200 | `berryShelfLifeHours` | 48 |
| `bushCapacityKcal`, `bushRegrowthKcalPerYear`, `initialBushKcal` | 52, 900, 52 | `bushCapacityWood`, `bushRegrowthWoodPerDecade`, `initialBushWood` | 2, 2, 2 |
| `standRadiusCm`, `treeSpacingCm` | 1,500, 400 | `treeCapacityWood`, `treeDeadfallWoodPerYear`, `fellWood`, `initialTreeWood` | 25, 5, 10, 25 |
| `siteSpacingCm`, `siteMarginCm`, `campClearingCm` | 5,000, 3,000, 4,000 | `outcropRadiusCm`, `stoneSpacingCm`, `stonesPerSpot` | 1,000, 300, 5 |
| `hutRingCm`, `walkCmPerSecond`, `reachCm` | 700, 125, 100 | `loadSlowdownPerMille`, `bodyKg` | 75, 60 |
| `perceptionRadiusCm`, `talkRadiusCm`, `sightRadiusCm` | 2,500, 2,000, 100,000 | `startSpacingCm`, `placeCm` | 5,000, 3,000 |
| `dawnHour`, `duskHour` | 6, 18 | `exploreAfterHours` | 24 |
| `berryKcalPerHour`, `berryKcalPerKg`, `woodPerHour` | 1,200, 600, 15 | `fireWoodPerHour`, `campfireWoodPerHour` | 1, 1 |
| `sleepKcalPerHour`, `fireSleepKcalPerHour`, `hutSleepKcalPerHour`, `coldSleepKcalPerHour` | 60, 70, 75, 90 | `restKcalPerHour`, `pickKcalPerHour`, `gatherKcalPerHour` | 90, 200, 250 |
| `chopKcalPerHour`, `makeKcalPerHour` | 360, 150 | `woodStockNights`, `woodLoad` | 2, 30 |
| `reserveMaxKcal`, `initialReserveKcal` | 70,000, 66,000 | `hungryBelowKcal`, `satiatedAtKcal` | 64,000, 68,000 |
| `skillMinPercent`, `skillMaxPercent` | 75, 125 | `craftSkillMinPercent`, `craftSkillMaxPercent` | 100, 100 |
| `practiceDays`, `practiceHalfHours` | 30, 60 | `practiceMinPercent`, `practiceMaxPercent`, `startPracticeHoursPerDay` | 50, 150, 2 |
| `logsPerTree`, `treeRegrowthDays` | 3, 7,300 | `logKg`, `logChopMinutes` | 35, 30 |
| `hutLogs`, `hutLogDays` | 23, 60 | `axeHours`, `axeLogs`, `axeWood` | 50, 200, 1 |
| `termsMemoryHours` | 24 | `axeTrade`, `craftPractice`, `scattered` | true, true, true |

Values in bold are new or changed in Life 10. `walkTerrainPercent` is replaced by the three terrain factors. The code keeps the name `valleySizeCm` for the land's width.

`createValley` refuses everything Life 9.7 refused, and also: a land whose width is not a whole number of terrain cells; the lattice wavelengths, cell, chunk and sight step sizes not positive; heights, depths and counts that are negative; any configured minimum above its maximum; an ice-flow turn above four direction steps; a drumlin aspect ratio below 1; a kettle depth over a thousand per mille; `dirtSlopePercent` above `stoneSlopePercent`; a negative curvature threshold; a shore ramp wider than the land; a sight step longer than a place; a terrain factor below 100%; a start area wider than the land or too small for the band's starts; and values whose products or total possible height could exceed exact integer arithmetic.

## Invariants

Checked after every minute of every checked run, by `src/valley/invariants.ts`. Each minute replays what its records touch; at each midnight every stock, memory and total is recounted in full.

- **Energy, wood, logs and stones are conserved exactly,** as in Life 9.7.
- Every plant's, hazel's and stone spot's stock, and the lake's, is replayed from regrowth and recorded work, and every tree's fall and regrowth.
- **Walking follows the land.** Each walking minute's recorded grade is the grade from where it started towards its destination, its speed is its load speed times Tobler's table for that grade, its terrain factor is that of the ground where it started, every second is charged the Pandolf rate with Santee's correction for that load, speed, grade and factor, and its climb is the rise it made.
- **Sight follows the land.** Every site spotted, place first marked seen, flag learned, tree or stone spot recorded from afar, and shore seen by long sight lies within `sightRadiusCm` in a place visible from the forager's place; one seen by close sight lies within `perceptionRadiusCm`.
- **The layout follows the ground.** Every site's centre, plant and stone spot lies on ground its kind permits, and every start lies on grass or dirt.
- Every second is charged the cost of its task, of its warmth asleep, or of its walk, and the energy paid equals the cost owed, to the 3,600th.
- One turn per living forager each minute; its seconds add up to 60; it moves no further than its walking seconds at its recorded speed; its load is no more than the wood of its trip, its log and the weight of the food it carries; it never stands on the lake or off the land.
- Work only in daylight, at a source within reach and worth working, taking food at its rate there and no more than the source holds, as in Life 9.7; memory of what it worked or targeted, and of everything in view, matches what it saw.
- Places first marked seen lie wholly within sight; every site within sight is known, and checked exactly when the forager stood close enough.
- Groups, fires, warmth, huts, axes, sales, carried lots, practice and swaps as in Life 9.7.

## Theory

`src/valley/theory.ts`, with the figures for the canonical land:

- **Walking.** Unloaded on grass or dirt a forager walks at 125 cm a second on the flat for 222 kcal an hour; at 88 cm a second up a 10% slope for 340; at 148 down 5%, the fastest; and at 125 down 10% for 165, the cheapest. On flat stone it costs 258 kcal an hour and on a road it would cost 198. Under a 35 kg log it walks at 119 cm a second on flat grass for 341.
- **Judging a walk.** Naismith's estimate of 100 m up a 10% slope is 140 seconds against Tobler's 114: a forager judges climbs a little slowly.
- **The land.** Its height range, ground shares, area steeper than 5%, 10% and 20%, mean absolute height difference at 15 m, 60 m and 240 m, and the counts and size distributions of its landform families are computed from the generated land and recorded in the [validation document](VALIDATION.md). A later stable-engine calibration will take the same relief, slope, curvature and orientation measures from selected 4 km squares of Denmark's 0.4 m DHM/Terrain, resampled to 5 m [T14], and compare the generated land with observed ranges rather than tune it to one exact map.
- **Capacity.** A year, the bushes regrow 43,200,000 kcal of berries and the hazels 120,000,000 of nuts, and the lake at half its stock grows 900,000 of fish: 164,100,000 kcal, about 450,000 a day, enough for about 180 foragers. The land starts with 2,496,000 kcal of berries, 60,000,000 of nuts and 9,000,000 of fish. A band of 8 cannot run short; where it lives, and how far it walks and climbs for food, is what the land now decides.
- **Wood, logs and stones.** 3,600 trees hold 10,800 logs and 90,000 kg of dead branches, and the bushes 96,000 kg of sticks; together they add about 27,600 kg a year. 1,200 stone spots hold 6,000 stones.
- **What warmth saves, what a first hut takes, what an axe costs, and what huts need,** as in Life 9.7, with walks now longer and uphill for some.
- **After implementation,** the canonical land's measured height range, surface shares, slope shares and multi-scale roughness replace the earlier figures in the validation document. The new fingerprints record the changed trajectories; they are not targets to tune towards. A one-year run remains deferred under the no-experiment rule.

## Questions for later

Experiments wait for a stable version of the Life engine, so this step has none. The questions it leaves:

- Where does the band settle on a varied land: by the hazel, by the lake, on the high ground, or where it happened to meet?
- How much of its walking energy goes on climbing, and do foragers prefer sources on their own level?
- Would foragers be better off walking round hills than over them, and how far do they lose by walking straight?
- Life 9's question, kept for the stable version: do axes concentrate in the hands of those who make them, through practice alone, in a band born alike? Does trade follow born talent instead (`craftSkillMinPercent` 50, `craftSkillMaxPercent` 150)? What changes with `axeTrade` or `craftPractice` off?
- How many can the land feed with huts and axes to keep up, once seasons make food short?
- Which young-moraine reference windows should become the long-term calibration set once more than the first Danish DHM/Terrain examples are measured.
- Whether Step 11's water flow should erode the fixed terrain or only occupy its tunnel valleys and hollows; Life 10 shapes the drainage skeleton but does not simulate erosion through time.

## Ledger and metrics

- **Events.** As in Life 9.7, with each forager's action also recording its grade, the terrain factor underfoot and the height it climbed.
- **Daily summaries,** for the band: as in Life 9.7, with the metres climbed; and for each forager: as in Life 9.7, with metres climbed and the energy spent walking.

## Observer

`life.html` is "Life 10 · terrain". It works like a strategy game that can be paused and sped up but not controlled.

- **The land.** The ground is drawn at the full 5 m height-field lattice, lit by stronger directional daylight so that its regional grain, broken crests, asymmetric slopes and small gullies remain legible, and coloured as one grassland: subdued green grass, brown earth following exposed slopes and cuts, and rare grey stone. Low-contrast multi-scale albedo and deterministic sub-cell normal detail add surface grain but never displace the mesh, so they cannot make a person float or sink. The default camera sits lower than before so slopes read in profile as well as on the map. The lake lies beyond the north edge, at height 0, reaching to the edge of the scene. Bushes and hazels are drawn in tiles 400 m wide within about 500 m of what the camera looks at, more as it pulls back, and the land beyond as ground only. Everything else is drawn as in Life 9.7.
- **One rendered surface.** The observer builds one sampled display surface and uses its interpolation both for the visible mesh and for every visual ground contact. This removes the present disagreement between a decimated mesh and objects positioned against the full simulation lattice. Standing and walking figures sample under both feet and remain upright; a sleeper samples at its displaced position and lies along the local surface; huts use the highest ground under their footprint while keeping their walls upright; fires, flags, wood piles, stones, plants, fallen trunks and crowns sample at their own contact points. Perception, sight, selection and site rings, group discs and lines are draped over the display surface instead of being flat at one height. Small clearance offsets prevent z-fighting but do not make objects float.
- **A map.** A small map of the whole land in a corner shows its relief and ground, the foragers and flags, and the part the camera shows; clicking it moves the camera there.
- **Following a forager.** The HUD shows, as well as Life 9.7's, the ground it stands on, its height, the grade it walks and its speed, and the metres it has climbed today. What it knows is shaded on the ground as before, so places hidden behind hills stay dark until it has seen them.
- **History and setup.** As in Life 9.7, with the terrain's numbers and the land's shares of each ground.

The observer only draws between real states: a forager between two minutes is drawn at the shared rendered surface under its interpolated position. The display surface is a deterministic sampling of the immutable simulation height field, not additional terrain state.

## Code layout

| File | Contents |
| --- | --- |
| `src/valley/types.ts`, `config.ts` | State, configuration, defaults and validation |
| `src/valley/terrain.ts` | The height field and its composition; ice flow, zones and glacial landform records; ground, grade and Tobler's table |
| `src/valley/sight.ts` | The view from each place by rays over the ground, worked out when first needed and kept, and a forager's observation by close and long sight |
| `src/valley/layout.ts`, `geometry.ts` | The layout on the ground, plant and stone indexes for close sight and by chunk, the ring search outwards, streams and integer geometry |
| `src/valley/forager.ts`, `food.ts`, `work.ts`, `practice.ts` | A forager's observation, needs, estimates, walking cost, choices, carried food, work and practice |
| `src/valley/lake.ts`, `sites.ts`, `social.ts`, `trade.ts`, `fire.ts`, `huts.ts`, `axes.ts` | As in Life 9.7 |
| `src/valley/engine.ts` | The minute |
| `src/valley/invariants.ts`, `theory.ts` | The invariants and theory above |
| `src/valley/*.test.ts` | Unit tests, including `terrain.test.ts` and `fingerprints.test.ts` |
| `src/valleyView/` | The observer: a small pure ground-surface helper samples the same mesh used for contact; `valleyScene.ts` draws the land and ground-contact objects, `tiledInstances.ts` the bushes and hazels in tiles, `LandMap.tsx` the map |

Nothing under `src/sim` changes, so MVP9 keeps its trajectory bit for bit.

## Tests

- Configuration validation, one case per new rule.
- Terrain: the height field is the same for the same seed and different for another; changing the moraine count leaves drumlin and kettle records unchanged; configured feature counts and drumlin aspect ratios hold; height is 0 along the shore, never below it and stays under the declared contribution bound; kettle depths follow their radii and cap and use multiple lobes; interpolation between lattice points stays between their heights; a zero-landform configuration is flat.
- Ground: stone at outcrops and on the steepest cells, dirt on moderate slopes and cells over the curvature threshold, grass elsewhere; an independent cover field cannot change ground; sand and wet never occur; every plant lies on grass or dirt.
- Walking: Tobler's table matches its formula to the thousandth and peaks at −5%; grade towards a destination uphill and downhill; speed under a load on a slope; the Pandolf rate with its grade term and Santee's correction matches [Theory](#theory) at each grade; the terrain factor of each ground; climb recorded.
- Estimates: Naismith's estimate of a walk with and without a climb; a forager turning home in time by its estimate.
- Sight: a hill between two places hides one from the other, flat ground does not, a place sees itself, and close sight sees through hills; a forager does not spot a site behind a hill and does once it climbs it.
- Chunks: a search by chunk finds the same nearest and best source as a search of everything, ties included; the same run with two chunk sizes matches exactly.
- Settled regrowth: a plant read after hours untouched holds what hourly regrowth would give it.
- The rules of Life 9.7, kept: foods, wood, fire, huts, trees, axes and trade, on a flat configuration where they need one.
- Determinism and purity: `stepValley` never changes its input, and `n` steps equal one run of `n` minutes.
- The invariants catch damage to each kind of record, as in Life 9.7, and a grade, speed, terrain factor or climb that does not match the land, a site spotted through a hill, and a plant on the wrong ground.
- **Fingerprints.** Life 10 runs exactly as recorded: 30 days on three seeds for the canonical land, a band that starts together, practice off, born talent, a band of 12, a band born alike in foraging and wood skill, and the flat land match recorded fingerprints of their daily summaries and totals.
- Observer: the sampled display surface gives exactly the vertices of the ground mesh and its interpolation between them; every tested contact point is on or just above that same surface; the displaced sleeper samples its displaced position; rings and lines are draped; the grass, dirt and stone colours, map and camera frame, and Life 9.7's observer tests. Regional grain, quieter till plain, broken moraine crests, aligned elongated hills, clustered dead-ice ground, tunnel valleys, close-scale roughness, contacts and the whole map are checked in the visible browser, with no console errors.

## Not in Life 10

Mountains; flowing water, hydrological erosion, rivers, ponds in the hollows, wetlands and lakes inside the land, and thirst (step 11); seasons, weather, snow and frost (step 12); woodland that grows where the ground allows, and plants counted in stands (step 13); animals (from step 14); paths round hills, trails worn by walking, and falls on steep ground; ground that changes with rain or season; sight blocked by trees; soil fertility that changes how fast plants regrow; and everything Life 9.7 left out: other tools and recipes, shared shelter, claims, lending, binding promises, teaching, hunting, fishing gear, preserving food, cooking, giving food, changing group, telling others where food is, and caches.

## References

- The sources of every physical number are listed in the [calibration document](CALIBRATION.md#sources). Those new in Life 10:
  - [T1] Pedersen, S. A. S., Rasmussen, L. A., and Fredericia, J. (2015). *Geological map of Denmark 1:50,000, Sakskøbing 1411 I and 1412 II Syd*. GEUS Map Series 6. The mapped landscape contains a crescentic end-moraine complex, streamlined drumlin fields parallel to ice movement, a moraine plateau, esker and dead-ice complexes, linear drainage, hummocky ground and dead-ice hollows. https://eng.geus.dk/media/13287/map6_p01-42.pdf
  - [T2] 39,712 topographic depressions mapped in Schleswig-Holstein, 63.88% of them 0.01 km² or less, mainly in young moraine landscapes. *E&G Quaternary Science Journal*, 65, 24 (2016). https://egqsj.copernicus.org/articles/65/24/2016/egqsj-65-24-2016.pdf
  - [T3] Ukleisee, a Weichselian kettle lake in Ostholstein, 17.0 m deep at most and 7.5 m on average. https://en.wikipedia.org/wiki/Ukleisee
  - [T4] Tobler, W. (1993). *Three presentations on geographical analysis and modeling*. NCGIA Technical Report 93-1. Summarised in the movecost documentation: https://www.rdocumentation.org/packages/movecost/versions/3.0.0/topics/mc_cost_functions
  - [T5] Pandolf, K. B., Givoni, B., and Goldman, R. F. (1977). Predicting energy expenditure with loads while standing or walking very slowly. *Journal of Applied Physiology*, 43(4), 577–581. https://en.wikipedia.org/wiki/Pandolf_equation
  - [T6] Santee, W. R., Allison, W. F., Blanchard, L. A., and Small, M. G. (2001). A proposed model for load carriage on sloped terrain. *Aviation, Space, and Environmental Medicine*, 72(6), 562–566. Its correction for descents is summarised at https://en.wikipedia.org/wiki/Pandolf_equation
  - [T7] Minetti, A. E., et al. (2002). Energy cost of walking and running at extreme uphill and downhill slopes. *Journal of Applied Physiology*, 93(3), 1039–1046: walking costs least at about −10%.
  - [T8] Soule, R. G., and Goldman, R. F. (1972). Terrain coefficients for energy cost prediction. *Journal of Applied Physiology*, 32(5), 706–708. Reviewed in: Terrain factors for predicting walking and load carriage energy costs: review and refinement. https://jhp-ojs-tamucc.tdl.org/jhp/article/view/67
  - [T9] Naismith, W. W. (1892). Naismith's rule: an hour for every three miles, and an hour more for every 2,000 feet of ascent. https://en.wikipedia.org/wiki/Naismith%27s_rule
  - [T10] Pedersen, S. A. S. (2023). Geological development of the landscape at Jelling: geological setting, glacial dynamics and Quaternary history. The area combines moraine plateau, hummocky terrain and steep-sided tunnel valleys trending mainly east-west. https://pub.geus.dk/en/publications/geological-development-of-the-landscape-at-jelling-geological-set/
  - [T11] Möller, P. (2010). Melt-out till and ribbed moraine formation, a case study from south Sweden. *Sedimentary Geology*, 232(3-4), 161-180. Hummocks in the studied terrain are usually 2-5 m high and 15-50 m wide, non-uniformly spaced and clustered. https://doi.org/10.1016/j.sedgeo.2009.11.003
  - [T12] SideFX (2026). *Erosion*, Houdini 22 documentation. A typical realistic workflow uses masked large-, middle- and small-feature passes; flow maps connect relief and surface treatment. https://www.sidefx.com/docs/houdini/heightfields_cop/erosion.html
  - [T13] Cordonnier, G., et al. (2016). Large scale terrain generation from tectonic uplift and fluvial erosion. *Computer Graphics Forum*, 35(2), 165-175. Process-derived stream graphs produce coherent drainage, watersheds and ridges instead of unrelated fractal forms. https://onlinelibrary.wiley.com/doi/10.1111/cgf.12820
  - [T14] Klimadatastyrelsen. *Danmarks Højdemodel - Terræn (DHM/Terræn)*: a nationwide bare-earth elevation model from airborne LiDAR, available at 0.4 m grid spacing and suitable for landscape analysis. Reference windows are resampled to the Life lattice for calibration. https://dataforsyningen.dk/data?filter=99%3Btag-103&view=gallery
- The references of Life 9 and Life 9.7, kept in the calibration document and in git history.
