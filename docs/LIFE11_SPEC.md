# [LIFE11-Water-052]

**Approved for implementation by the owner on 2026-10-20.** Life 11 replaces Life 10 as the current simulation specification.

A band of eight adult foragers lives on 4 km square of young glacial land in Mesolithic southern Scandinavia and the North European Plain, around 9,000 to 6,000 years ago. Drumlins, moraine fronts, kames, hummocks, kettle hollows and tunnel valleys share one glacial history. The ground is grass, exposed dirt and stone. Water occupies hollows and follows drainage routes towards the boundary. People discover drinking banks, drink, pick berries, gather hazelnuts, fish, gather firewood, meet, form groups and exchange wood and axes for food. They build individual huts around shared fires. Their knowledge comes from observation and memory.

The simulation advances in minutes, with 60 seconds of activity per living person. Lengths and heights are integer centimetres, food integer kilocalories, wood integer kilograms, and body-water deficit integer millilitres. Fractional work, energy and water loss accumulate in integer remainders. `stepValley` is pure and deterministic; every random draw comes from a named derived stream. The observer displays real states and interpolates movement between them.

## What Life 11 makes realistic

- **Water belongs to the land.** Replace the unlimited straight shore beyond the north edge with lakes in depressions and connected river reaches running downhill. Lakes have individual fish stocks; rivers have stocks by reach.
- **Water is a bodily need.** A person loses water while resting, sleeping and working. Drinking takes time at a discovered bank. Failure to find water can kill even when food is plentiful.
- **Water changes access.** A person walks around water on ground it has observed. A thicket visible across a lake is not necessarily reachable. Hearths, huts, plants and stone spots stand on dry ground.

This step builds permanent freshwater geography and drinking. It does not simulate rainfall, groundwater, drought, seasonal floods, infection or individual fish. These boundaries keep water useful now without implementing the later weather, health and animal steps.

## Checked against

| Measure | Evidence and comparison | Status |
| --- | --- | --- |
| Lakes in glacial hollows | GEUS describes dead-ice hollows and drainage in the Sakskøbing young-moraine landscape [W1]. Compare generated lake area, maximum depth, shore length and basin distribution with mapped lakes in the same landscape. | Geographic basis; generated dimensions remain estimates until measured against a selected real window. |
| Streams | Danish stream research documents a landscape dominated by small streams [W2]. Compare length per square kilometre, width distribution, catchment area and connections between lakes and outlets. | The 5 m lattice cannot resolve the many sub-5 m streams faithfully. The first implementation represents larger channels; it must report this resolution limit. |
| Drainage | Priority-Flood establishes depression spill levels and drainage connectivity on a height grid [W3]. | Algorithmic reference, not proof that every depression contains permanent water. |
| Daily water need | EFSA gives adequate **total** water intakes of 2.0 L/day for adult women and 2.5 L/day for adult men under moderate conditions, including food moisture [W4]. | Reference range, not a direct drinking requirement or a measurement of active Mesolithic foragers. |
| Drinking and activity | Report drinking per person-day alongside activity, deficit and time spent seeking water. The net resting replacement is 2 L/day, with an explicit activity allowance. | Simplification: food moisture and metabolic water are absorbed into that net requirement, not separately simulated. |
| Fish | The existing calibration records northern lake fish biomass and yields, with 100 kg/ha capacity and 40% annual logistic growth used as estimates. | Retain those lake estimates. Applying them to river reaches is provisional, not measured river calibration. |
| Speed | Geography is generated once; a minute updates bodies and fish without scanning the water grid. | Preserve the aim of a canonical year in minutes. Record ordinary validation timings; no benchmark sweep or long experimental run is required. |

No fitted lake-size distribution, measured river discharge or validated dehydration survival time is claimed. Real-data comparison and parameter experiments wait for the stable engine. Sources and the distinction between measurements and choices must enter `CALIBRATION.md` when implemented.

## Design decisions

| Decision | Reason |
| --- | --- |
| Derive drainage from the generated terrain; remove the north-shore ramp and external lake. | Water should explain where people can drink and fish, rather than being an arbitrary world edge. |
| Use fixed water levels and a drainage graph. | This supplies permanent geography without a weather model. Flow arrows mean downstream direction, not a computed velocity or discharge. |
| Treat permanent water as an explicitly external reservoir. | Drinking withdrawals are recorded, but cannot lower a lake in this step. There is no hidden finite stock or unrecorded replenishment. |
| Fill depressions to their spill levels under a stated saturated-land assumption. | This is a reproducible first approximation. It may produce too many ponds; do not conceal that with survival-driven placement or aesthetic tuning. |
| No swimming, boats, bridges or wading yet. | A wet cell blocks walking. This overstates the barrier posed by small streams, but is unambiguous and does not require depth-dependent movement or danger. |
| Route through observed dry ground. | Routing around water is necessary now; agents must not receive a hidden map of the whole drainage network. |
| Give fish a stock per lake or river reach. | Fishing in one lake must not reduce every other lake. River reaches provide local depletion without individual fish or migration. |
| Express hydration as a deficit from the body's normal state. | This records water balance without pretending to model kidneys, blood volume or a separate drinkable reserve. |
| Let severe thirst interrupt returning home and sleeping. | A person must be able to seek water at night rather than obey the clock until death. |
| Keep starts dry but do not place water near every start or guarantee access. | Geography can create hardship; it must not be regenerated merely because someone would die. |

## World

### Terrain and drainage

The square uses `x` east and `y` south from the north-west corner. Height is relative to a fixed world datum, no longer to an external lake. Retain the current eleven terrain streams: `terrain:flow`, `terrain:zones`, `terrain:broad`, `terrain:moraines`, `terrain:drumlins`, `terrain:kames`, `terrain:hummocks`, `terrain:kettles`, `terrain:valleys`, `terrain:micro-coarse` and `terrain:micro-fine`.

The regional sixteen-direction ice-flow field and zone masks organise three broken asymmetric moraine belts, 56 aligned drumlins including the central train, 18 irregular kames, 240 clustered hummocks, 76 irregular kettles and two tunnel valleys. Quiet till plain remains in the south-east. Broad relief and two scales of microrelief complete the surface. Retain the existing dimensions in the defaults below. Add the positive landform contributions, subtract kettle and tunnel-valley depths, and retain signed heights: remove both the north-edge ramp and the old clamp to zero. This is a change of terrain generation, not a vertical translation of the old map.

Derive hydrology before placing resources or people:

1. Sample the terrain at each 5 m cell centre, rounded down to centimetres. Use four cardinal neighbours, with cell IDs increasing across rows. Boundary cells are open outlets; no sea or incoming catchment is invented beyond the map.
2. Run Priority-Flood from all boundary cells. The priority is `(spillHeightCm, cellId)`. Assign each newly visited cell an already visited downstream parent and a flood level equal to the greater of its bed height and its parent's flood level. Record a deterministic visitation rank. Parent links strictly decrease rank, making flats acyclic without inventing a visible slope.
3. A cell whose flood level exceeds its bed height belongs to standing water. Cardinally connected flooded cells at the same level form a lake, including small ponds. Its ID is its smallest cell ID. Its depth is flood level minus bed height; its area is its cell count times cell area. Its outlet follows the parent graph through the spill. Store lake membership separately from the drainage parents.
4. Accumulate contributing cell area in reverse rank order, including each cell's own area. Outside lakes, a cell whose contributing area reaches `riverCatchmentM2` is a river cell. Continue its downstream path to a lake or boundary even where a later classification would otherwise interrupt it. A lake's drainage can continue as a river where the catchment threshold is met.
5. A river occupies one cell in width. Its water surface is the flood level; its bed is cut to `riverDepthCm` below that level. This one-time channel cut is a prescribed channel shape, not simulated erosion or a sediment balance. Downstream water surfaces never rise; level spillways are permitted and use the graph's direction. Do not add decorative uphill branches.
6. Divide river cells into reaches at junctions, lake boundaries and world outlets. Every river cell belongs to exactly one reach; junction cells belong to the downstream reach. Assign reach IDs in increasing minimum-cell-ID order after lake IDs. Areas never overlap. A source cell that is already in a lake counts only towards that lake.

There is no extra random hydrology stream: geometry and IDs are deterministic consequences of terrain and configuration. Persist enough immutable data to inspect basin areas, levels, depths, parent links, reaches and outlets. Tiny puddles are represented honestly at the grid resolution; the fish-area threshold below does not erase their water or their obstruction.

The authoritative wet footprint is the union of wet cell squares. Terrain and water rendering must respect it, including its stair-stepped resolution. Channel beds and banks must agree with collision geometry; the display may soften colour and normals, but cannot draw a dry crossing over blocked water. Dry terrain retains bilinear heights. Wet geometry uses the recorded bed and water level; no floating water plane over neighbouring dry land.

### Ground, resources and starts

On dry cells, stone follows slopes of at least 30% and outcrops; otherwise dirt follows slopes of at least 10% or curvature of at least 40 cm; otherwise grass. Recompute exposure after the channel cut. No wetland vegetation or soil-moisture growth bonus is added.

Place berry thickets, hazel thickets, tree stands and outcrops from the layout stream, rejecting footprints intersecting water or unsuitable ground. Plants grow on grass or dirt; stones lie on dry outcrop ground. Retain site spacing, plant spacing and bounded rejection sampling. Starts use each person's named stream within the central 800 m, on dry grass or dirt, with their existing spacing. A failed layout after 10,000 attempts for an item reports the failed constraint; do not silently shrink counts.

For a band starting together, choose the nearest valid dry camp to the centre, ordered by squared distance then cell ID, with room for its initial hearth slots. Scattered starts need no access guarantee. When people found or join groups, choose flag and hut positions only on dry, observed ground reachable by the people moving there. Try the existing ring slots in deterministic ring/slot order; if none fits within the observed area, defer founding or joining. Never move someone, their hut or supplies across unknown water. This check also applies to later hut repairs and observer sleeper offsets.

### Plants and fish

Each berry bush, hazel and tree is an individual. At the first minute of every hour after minute zero, add its integer share of annual or decadal regrowth, capped at capacity. For amount `a` in `P` hours, hour `h` receives `floor(a*(h+1)/P) - floor(a*h/P)`. Felled trees gain no deadfall. An emptied stump regrows at the first midnight at least 7,300 days after felling.

For each lake and river reach of area at least `fishMinAreaM2`, fish capacity is `floor(areaM2 * fishKgPerHectare * fishKcalPerKg / 10,000)`. Smaller bodies have zero capacity. Start eligible bodies full. At each hourly regrowth, for capacity `K > 0`, stock `F` and remainder `R`, set `owed = R + fishGrowthPercentPerYear * F * (K-F)`, divide by `100*K*8,760`, and carry the remainder. Cap actual growth at room in the stock and discard excess fractional growth at capacity. Zero-capacity bodies have zero stock and remainder. A depleted body is not reseeded.

All banks of a lake draw on that lake; all banks of a reach draw on that reach. No fish transfers occur between bodies, including at confluences. Body IDs identify accounting units, not information granted to agents. Fishing costs the same energy as picking, uses foraging skill and practice, and has expected/actual hourly rate `floor(fullFishRate * remembered/actualStock / capacity)`. A fisher learns stock only by attempting to fish. Unknown stock is initially expected full, without consulting hidden capacity; a first attempt at a zero-capacity body yields nothing and records an expected rate of zero. Catch never exceeds actual stock. The net-return test remains rate greater than the picking energy rate; allow a first attempt based on the optimistic expectation even when actual stock is empty.

## Knowledge and movement

Close perception covers 25 m every minute. Long sight covers up to 1 km by day from the current 30 m place's centre, on entering a new place or after an hour. Retain terrain-occluded rays, the 30 m ray step and eye height 160 cm. Long sight records visible sites, standing flags, logs and stones; close sight additionally records food and wood stocks. Place coverage remains distinct from knowledge of individual cells.

Water observation records **only visible wet cells and bank segments**, with minute and position. Seeing one piece of shore does not reveal the body's hidden outline, its outlet, all its banks, its fish stock or the other side's route. A usable bank is a dry point within `reachCm` of a wet cell edge, at most `drinkBankHeightCm` above its water surface. Place the approach point 50 cm inland, or `reachCm` inland when smaller, and store bank candidates with stable IDs based on wet-cell edge and dry approach. Drinking and fishing both require such access.

Keep an observed dry-cell mask and observed heights, updated through close sight and the existing long-sight visibility rule. A cell is routeable only when its whole footprint is observed dry. The current cell and exact start/hearth are initially known through local observation. A previously traversed route stays remembered. Water geography is static, so these memories do not expire.

Use deterministic A* on observed dry cells with eight neighbours; diagonal movement requires both adjoining cardinal cells to be dry and known. The cost is integer distance (500 cm cardinal and 707 cm diagonal at the default resolution); a bounded number of moving-root goals use the admissible integer octile heuristic, then bulk queries use a zero heuristic to share settled distances and the open frontier. A separate zero-heuristic search is rooted at the remembered hearth. Typed arrays hold distances and predecessor IDs without changing path costs. Heap ties use cell ID; equal-distance parents use the smaller predecessor ID. This finds a short known route, not a globally optimal energy route. Include start/end connector segments and reject any segment intersecting wet squares. Cache by endpoints and the person's knowledge revision, never by hidden world connectivity. Clones may share derived searches while their observed masks agree; newly observed dry cells extend disposable derived searches and reopen affected neighbours. Knowledge tokens invalidate those searches before an older or diverging state can reuse them. A warm and a cold search must return the same route.

Walk estimates sum flat loaded travel time and positive climb along route segments, with 6 seconds added per metre ascended. Cache common cell-centre prefix sums by speed, climb coefficient and direction; preserve each edge’s rounding and invalidate sums when knowledge changes. A straight segment entirely through known dry ground may bypass grid waypoints when its one-centimetre envelope is dry too; integer movement rounding must not clip a wet corner. Targets without a complete known route are not declared globally unreachable: exploration approaches the nearest reachable observed frontier, reveals more ground, and retries. If no frontier or route exists, rest with `no known route`; thirst continues. Candidates and ties use estimated journey time, then source ID and bank ID. Chunk pruning must use an admissible lower bound, not straight distance as though it were the complete route cost.

Travel still uses load slowdown, Tobler speed and Pandolf/Santee energy. Break a minute at waypoint arrivals, recompute grade and ground for each walking segment, and record segment seconds, endpoints, grade, speed, ground and cost. Sum climb across segments, rather than using only the minute's endpoints. No path smoothing or interpolation may cut a water corner. A dry segment's grade calculation must not sample beyond the next waypoint.

## The body and drinking

Each person keeps `waterDeficitMl`, `thirsty`, integer water-loss and drinking remainders, known banks, fish observations by encountered body, a route and its knowledge revision, and daily drinking/loss totals. Initial deficit is zero. Retain positions, hearth, energy reserve, hunger, carried food lots, wood and load, log, stones, food/wood/log/stone memories, known sites/places/flags, group, hut, axes, craft work, promises, heard exchange terms and practice records.

Water is a **net replacement budget**, not total body water. There are no separate moisture values in berries, nuts or fish yet, and eating grants no hydration event. This under-represents differences between diets and must remain explicit.

- Base net loss is `waterBaseMlPerDay / 86,400` ml each second.
- Additional loss is `waterExtraMlPerKcal` times the energy cost above resting over that second, never negative. Use the exact integer energy-cost numerator before rounding paid kilocalories, with its own remainder; do not derive loss from already rounded energy or charge base loss twice.
- At default costs, a wholly resting day loses exactly 2,000 ml. Four hours picking instead of resting add 440 ml. Heat, humidity and cold do not modify loss yet.
- Thirst begins at a deficit of `floor(bodyKg * 1,000 * thirstBodyPerMille / 1,000)` ml, 600 ml by default, and remains until deficit is at most `drinkStopMl`, 100 ml.
- Severe thirst begins at 1,800 ml; death occurs at 6,000 ml. These are coarse model thresholds at 1%, 3% and 10% of body mass, not clinically validated boundaries or guaranteed survival durations.
- At a usable bank, drink up to `drinkMlPerSecond`, bounded by the current deficit. Drinking costs resting energy, takes action seconds, works day or night, and cannot be combined with fishing or other work. Do not overfill the body. Once the stop target is reached, use the remainder of the minute resting; decide again next minute.
- Each second applies drinking first, then net loss, then checks the death threshold. A person who reaches it dies immediately; remaining seconds of that minute are inactive. Retain starvation and group dissolution, and record both conditions if energy and dehydration reach their lethal thresholds in the same second. Stop future metabolism and water loss for dead people.

The exact body balance is `deficitEnd = deficitStart + recordedLoss - recordedDrink`. A drink event records person, bank, water body, seconds, volume and before/after deficit. Each withdrawal is an input from the external freshwater reservoir and an equal reduction of body deficit. Water lost goes to the unmodelled environment. No finite lake-volume conservation is claimed; no weather, rainfall or physical discharge values are invented to disguise the boundary. For fixed integer rate numerators, accumulate base loss with denominator 86,400 and activity loss in the exact energy-cost units; carry both remainders separately across tasks, days and drinks.

## The minute and priorities

0. At midnight after the first day: update practice from yesterday, weather huts and regrow eligible stumps.
1. At each hour after minute zero: grow plant stocks and each water body's fish independently.
2. At every hour: decide group and personal fires for the coming hour; daytime fires are unlit.
3. Shuffle living-person turn order using the stream derived from run seed and minute.
4. For each living person: spoil carried lots; eat oldest first up to reserve capacity; observe; update needs and choose an action; execute up to 60 seconds with energy and water accounting; if still alive, meet, exchange, feed the fire, deliver hut logs and eat newly obtained food. Record death and dissolve groups of fewer than two living members as necessary.
5. Record events and daily metrics and check invariants.

Within action execution, eating newly acquired food before charging its second's energy preserves the opportunity to survive by foraging. All action segments, losses and death timing must be replayable. Instantaneous meeting, exchange and delivery occur only for survivors after action; no dead person trades.

Choose the first applicable rule:

| Priority | Condition | Action |
| --- | --- | --- |
| 1 | Severe thirst, day or night | Drink at a reachable bank, else walk to the nearest known accessible bank, else explore a reachable frontier for water. This interrupts any load or journey. |
| 2 | Away from home and night, or route home uses remaining daylight | Walk home along the known route. If there is no known route, explore to recover one; do not teleport. |
| 3 | Night | Sleep. Ordinary thirst waits; severe thirst wakes the person. |
| 4 | Thirsty in daylight | Drink or seek water as above, normally allowing time to return before dusk. If no eligible bank is known, search a frontier; if too late, return home or rest there. |
| 5 | Carrying a log | Take it home. |
| 6 | Not hungry and filling/carrying a wood load | Finish gathering the load, or take a full load home. |
| 7 | Neither hungry nor short of wood, without a group | Approach a seen person or a reachable known flag; otherwise explore. |
| 8 | A member with neither food nor wood need | Finish an axe; otherwise cut hut logs if equipped; otherwise buy a worthwhile known axe or make one, fetching a stone and wood first. An unavailable plan falls through. |
| 9 | Neither food nor wood need | Explore the nearest reachable unseen frontier or recheck a site after 24 hours; rest when none is available. |
| 10 | Food or wood needed | Choose productive gathering or an advantageous local exchange; search if no remembered source is worth working; otherwise rest with the reason recorded. |

Ordinary thirst overrides economic work, but not dusk return. Severe thirst overrides both. A request for water never reads the complete bank list as knowledge. Unknown terrain and inaccessible banks can cause delay or death.

Food choice compares remembered worthwhile bushes, hazels and encountered fish bodies, plus visible unchecked thickets expected full. Score one hour's expected food as `3,600 * rate / (estimatedWalkSeconds + 3,600)`. Use a known accessible bank for each fish candidate. Work must leave time to return home before dusk, except drinking under severe thirst. Selection uses only memories; actual stock is read at work and observed there. Fishing consumes the remaining action seconds after arrival, but a drinking action does not also fish.

## Food, wood, shelter and exchange

Food is held in timestamped lots by kind. Berries spoil after 48 hours, nuts after 4,380 hours and fish after 24 hours, including in transit or after exchange. Eat oldest first; transfers preserve age. Energy starts at 66,000 kcal, is capped at 70,000, triggers hunger below 64,000 and clears it at 68,000. Production, eating, spoilage, energy expenditure and food retained on death all remain accounted for.

Load is trip wood, one 35 kg log and carried food at its kind's kcal/kg, rounded down once over the sum. Loaded speed is `max(1, floor(baseSpeed * (1,000*bodyKg - loadSlowdownPerMille*loadKg)/(1,000*bodyKg)))`. Tobler's integer table applies the grade multiplier `exp(-3.5*abs(G/100+0.05)+0.175)` at integer grades from -60% to 60%. Pandolf uses body mass, load, speed, grade and terrain factor; retain Santee's downhill correction and the resting-cost floor.

Wood need starts below one night's personal firewood and clears at two nights. Gather known felled crowns with at least a minute's work before standing plants. Full loads are 30 kg. A group burns 1 kg/hour at night if its stock can pay; members contribute at their hearths towards the group's night supply, and lone people use their own firewood. A whole hut and lit fire cost 60 kcal/hour asleep; fire alone 70; hut alone 75; neither 90.

Two ungrouped people meeting within 20 m can found a group; a lone person can join a member's group. Joining relocates the hearth only by a valid known dry journey, using the dry placement rule. Groups have a flag and common fire; each member builds its own 23-log hut. A hut loses one log every 60 days. The first log cut fells a tree, adds 10 kg of crown wood and leaves its remaining logs at that tree. Every tree has three logs; empty stumps regrow after 20 years.

An axe needs one stone and 1 kg wood, committed when making begins at home. Work takes `ceil(3,600 * axeHours * 100 / craft)` seconds and can pause. Born foraging and wood skill range from 75% to 125%; born craft defaults to 100%. For each task, practice percentage is `minPercent + floor((maxPercent-minPercent)*seconds/(seconds + 3,600*practiceHalfHours))` over the last 30 days. Forage practice serves berries, nuts and fish; drinking grants no skill. Born skill times practice determines rates. Initial practice is two hours/day in foraging and wood, none in axe making.

Finished axe quality is drawn from half to all of craft, with a minimum of one, on its named maker/axe stream. Quality 100 cuts a log in 30 minutes and lasts 200 logs; time scales inversely with quality and lifetime proportionally. A member needs an axe because its hut needs logs or it has promised an axe to another member.

Members within talking distance can swap spare wood for carried food when both gain at the midpoint of their own food/wood production ratios. Quantities are bounded by spare wood, the buyer's wood need and food, and the seller's reserve room. Heard terms expire after 24 hours. People may gather the good that buys the other more cheaply, but no central prices or allocations exist.

A maker's axe ask is its extra energy making rather than resting. A buyer values quality against the quality it expects to make, three quarters of its craft, and pays the midpoint of ask and value only if buying gains it food energy. Requests and promises are local; an unfinished promise is not a transferable asset. Axe payments transfer oldest food lots, preserving spoilage. There is no money, ownership of water, water trade, forced sharing or planned specialisation.

## Defaults and configuration validation

The following water defaults are explicit estimates and choices, not measured constants:

| Parameter | Default | Basis |
| --- | --- | --- |
| `riverCatchmentM2` | 250,000 | Choice: 0.25 km² upstream area begins a represented channel. |
| River width | One terrain cell: 500 cm | Resolution limit; do not present this as a natural width distribution. |
| `riverDepthCm` | 50 | Prescribed channel estimate, not computed flow depth. |
| `drinkBankHeightCm` | 100 | Reachable vertical bank difference; approximation. |
| `fishMinAreaM2` | 1,000 | Choice excluding very small pools and reaches from a fish stock. |
| `fishKgPerHectare`, `fishGrowthPercentPerYear` | 100, 40 | Existing lake estimates, provisionally shared by rivers. |
| `waterBaseMlPerDay` | 2,000 | Net resting replacement estimate. |
| `waterExtraMlPerKcal` | 1 | Activity allowance above resting energy; estimate. |
| `thirstBodyPerMille`, `urgentThirstBodyPerMille`, `fatalWaterLossBodyPerMille` | 10, 30, 100 | Coarse model choices, converted to ml using body mass. |
| `initialWaterDeficitMl`, `drinkStopMl` | 0, 100 | Initially hydrated; hysteresis avoids repeated tiny drinks. |
| `drinkMlPerSecond` | 10 | 600 ml/minute while crouching at a bank; estimate. |

Remove `lakeHectares`, `shoreRampCm`, the north-edge shore helper and the single global lake stock and memory. Rename the lake-only biomass/growth settings to the body-neutral names above. There is no `thirstEnabled` or legacy edge-lake switch. Retain `axeTrade`, `craftPractice` and `scattered`, which are meaningful strategy/initial-condition variations. Small flat tests use explicit water fixtures where needed, not a mode recreating an earlier Life step.

All remaining terrain, plant, body and craft defaults are listed below.

| Parameter | Canonical value | Parameter | Canonical value |
| --- | --- | --- | --- |
| `valleySizeCm` | 400,000 | `bandSize` | 8 |
| `thicketCount`, `bushesPerThicket` | 800, 60 | `hazelThicketCount`, `hazelsPerThicket` | 800, 40 |
| `standCount`, `treesPerStand` | 300, 12 | `outcropCount`, `stonesPerOutcrop` | 100, 12 |
| `terrainCellCm`, `chunkCm` | 500, 20,000 | `startAreaCm` | 80,000 |
| `reliefCm`, `reliefWavelengthCm` | 3,500, 120,000 | `iceFlowControlCm`, `iceFlowTurnSteps` | 100,000, 2 |
| `moraineBeltCount`, `moraineMinHeightCm`, `moraineMaxHeightCm` | 3, 800, 2,200 | `moraineMinHalfWidthCm`, `moraineMaxHalfWidthCm` | 5,000, 18,000 |
| `moraineMinControlCm`, `moraineMaxControlCm` | 15,000, 30,000 | `drumlinCount` | 56 |
| `drumlinMinLengthCm`, `drumlinMaxLengthCm` | 20,000, 70,000 | `drumlinMinWidthCm`, `drumlinMaxWidthCm` | 5,000, 18,000 |
| `drumlinMinHeightCm`, `drumlinMaxHeightCm` | 500, 1,800 | `drumlinMinAspectPerMille` | 3,000 |
| `kameCount`, `kameMinRadiusCm`, `kameMaxRadiusCm` | 18, 4,000, 12,000 | `kameMinHeightCm`, `kameMaxHeightCm` | 500, 1,500 |
| `hummockClusterCount`, `hummockCount` | 4, 240 | `hummockMinWidthCm`, `hummockMaxWidthCm` | 1,500, 5,000 |
| `hummockMinHeightCm`, `hummockMaxHeightCm` | 200, 700 | `smallKettleCount`, `largeKettleCount` | 64, 12 |
| `smallKettleMinRadiusCm`, `smallKettleMaxRadiusCm` | 1,500, 5,500 | `largeKettleMinRadiusCm`, `largeKettleMaxRadiusCm` | 6,000, 20,000 |
| `kettleDepthPerMille`, `kettleMaxDepthCm` | 125, 1,200 | `tunnelValleyCount` | 2 |
| `tunnelValleyMinWidthCm`, `tunnelValleyMaxWidthCm` | 12,000, 35,000 | `tunnelValleyMinDepthCm`, `tunnelValleyMaxDepthCm` | 600, 2,000 |
| `tunnelValleyMinControlCm`, `tunnelValleyMaxControlCm` | 20,000, 40,000 | `microCoarseWavelengthCm`, `microCoarseAmplitudeCm` | 6,000, 250 |
| `microFineWavelengthCm`, `microFineAmplitudeCm` | 1,500, 70 | | |
| `dirtSlopePercent`, `stoneSlopePercent`, `dirtCurvatureCm` | 10, 30, 40 | `grassTerrainPercent`, `dirtTerrainPercent` | 120, 120 |
| `stoneTerrainPercent` | 150 | `climbSecondsPerMetre` | 6 |
| `eyeHeightCm`, `sightStepCm` | 160, 3,000 | | |
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

Validation rejects non-integers, non-finite values and unsafe products; invalid time or threshold ordering; negative stock/rate/count parameters; empty positive-unit denominators; unsupported terrain sizes or allocations (at most 2,000 cells per side, 512 MB of observed-ground memory and two million plants); and impossible placement constraints. Require `0 <= initialWaterDeficitMl < thirstThresholdMl`, `0 <= drinkStopMl < thirstThresholdMl < urgentThresholdMl < fatalThresholdMl`; positive base water loss and drinking rate; nonnegative activity allowance; positive channel depth and catchment threshold; nonnegative bank-height allowance; and a positive fish-area threshold. Validate rounded body thresholds, not just their per-mille inputs.

Retain terrain constraints: land width divisible by cell size; positive lattice wavelengths, chunk and sight-step sizes; minimum dimensions no greater than maximums; ice-flow turn at most four steps; drumlin aspect at least one; kettle depth at most 1,000 per mille; dirt slope no greater than stone slope; sight step no longer than a place; terrain factors at least 100%; start area no larger than land. Signed terrain heights are now valid. Account for all landform contributions and channel cuts in height bounds.

Large fish-growth products must use exact arithmetic, such as `BigInt` intermediates, or a proven equivalent reduction before multiplication. Convert back only after checking bounds. Reject configurations whose stored stocks, cumulative counters, grids or allocations exceed supported limits with a specific message. Zero fish capacity is valid and never divides by zero. Dry maps are valid test inputs; nobody receives automatic water.

## Invariants and ledger

The checker runs every minute in checked runs. Replay touched records each minute, every fish stock at regrowth, and complete totals at midnight; validate immutable geography once. Existing food, energy, wood, log, stone, tool, practice, group, fire and exchange checks remain.

- Every downstream edge decreases rank and never increases water-surface height. Every route terminates at a boundary; lakes have a single constant surface and correct spill connectivity.
- Wet-cell membership is unique. Areas, fish capacities and the union of lake/reach footprints agree exactly. A junction cannot duplicate fish habitat.
- Every site footprint, plant, start, flag, hearth and hut footprint is dry. Every walked segment, including connectors and diagonals, avoids water.
- Every route decision uses known ground and every learned bank is justified by perception. Hidden body geometry and fish stocks cannot enter decisions.
- Each body's fish balance is `initial + growth - catch = current`. Replaying growth, remainder and catches reproduces stock; fishing one body cannot modify another.
- Each person's water balance is `initial deficit + loss - drink = current deficit`. No drink exceeds deficit, occurs out of reach, shares seconds with work or continues after death.
- External water withdrawals equal recorded drinking, globally and by source. Body loss is a separate environmental outflow, not a withdrawal from a lake.
- Task seconds plus inactive seconds after death sum to 60. Every walking segment and action has the correct energy and water charge; carried remainders are bounded.
- Hunger/thirst hysteresis, severity, death minute/second and group dissolution follow the stated order. Neither starvation nor dehydration is silently relabelled as the other.

Add events for drinking, water observations, route failure and dehydration death; extend movement records with segments and fish events with body IDs. Record water loss as a per-turn accounting record even when there is no drink. Daily summaries include drinking, net loss, maximum/end deficit, time thirsty, time seeking/drinking, starvation/dehydration deaths and catch by lake/reach. World metrics include water area, lake size/depth distribution, river length, drainage density, boundary exits and fish biomass/growth/catch. Observer metrics never feed agent decisions.

## Observer

Label the page **Life 11 · water**. Show the true recorded lake surfaces and river channels at their own levels, banks on the same contact geometry as movement, and downstream arrows on request. The whole-land map shows water and dry access; a followed person's knowledge overlay reveals only observed cells and banks. Distinguish true fish stock from the person's last fishing observation.

The person panel shows water deficit in ml and as a share of body mass, thirst, drinking today, current drinking destination, route and reason for delay. Show drinking as a bank-side action and death cause explicitly. Existing food, wood, craft, hut, group, slope and activity inspection remains.

Do not animate flow at an invented physical speed or show floating people. Interpolate through the recorded movement segments, not across the straight chord between minute endpoints. Camera, cosmetic ripples and lighting do not mutate simulation state. Check a lake shore, river, drinking person and route around water in a visible preview, using Step when the pane is hidden, and inspect the console once.

High-speed playback budgets its work between completed minutes and uses one minute per frame after a slow tick. Speeds are best effort under load. The displayed pair remains two adjacent real states; the playback budget changes only how many consecutive ticks run before rendering and handling input.

## Code layout

- `src/valley/types.ts`, `config.ts`: water geography, per-body fish stocks, hydration state/events, defaults, removal of edge-lake configuration and validation.
- `terrain.ts`, new `water.ts`: terrain assembly, channel beds, Priority-Flood, lake/reach IDs, wet footprints, bank access and immutable spatial indexes.
- New `routes.ts`: knowledge-limited dry routes, estimates, deterministic ties and cache invalidation. `layout.ts` and `social.ts`: dry resources, starts, camps and hearths.
- Replace `lake.ts` with body-based fish functions, preferably `fish.ts`; keep food lots in `food.ts`. New `hydration.ts`: integer loss, drinking, hysteresis and death checks.
- `sight.ts`, `forager.ts`, `engine.ts`, `work.ts`: observation, priorities, segmented movement, action costs and second-resolved death accounting.
- `invariants.ts`, `theory.ts`: independent replay, accounting and analytic water examples. Existing fire, hut, axe, trade and practice modules retain their roles.
- `src/valleyView/groundSurface.ts`, `valleyScene.ts`, `valleyViewModel.ts`, `LandMap.tsx`, `ValleyApp.tsx`: water surfaces, bank contact, segmented interpolation, map and inspection.

Keep immutable geography and reproducible memoisation outside mutable state; cache warmth or history must never change results. No changes to the frozen MVP9 core, except continuing to import its pure RNG helpers.

Performance maintenance may reuse observed-ground frontiers and an unknown-cell bit index, lazily invalidate travel-cost entries and reject destinations already excluded by known-ground or time bounds. Exact travel estimates and failed-budget proofs may be reused only for matching endpoints, hearth, speed, ascent coefficient, terrain and knowledge revision. Check the shared homeward trip first; previous site winners may establish an early exact bound but must not change the final comparison. Spatial bank indexes contain only remembered banks, and their pruning bounds must include every possible winner. Repeated sight from an already observed place must refresh resource memories but need not rescan immutable ground. A forward canonical shortest path may supply contiguous subpaths and their exact per-edge travel sums until knowledge changes; direct shortcuts and endpoint connectors are still checked first. Idle classification may reuse a reachable plant witness or a proof that none is reachable under the same terrain, position, hearth, speed, climb and knowledge, with a no-larger daylight budget. Reachability searches may stop when their admissible distance bound exceeds the remaining travel-time budget, preserving the unfinished frontier for a later query. Such changes must preserve exact routes, per-edge rounding, tie ordering and all recorded Life 11 fingerprints. Observer knowledge textures and bank geometry need refreshing only when their source knowledge changes.

## Tests and implementation acceptance

The Life 10 fingerprint suite passed before engine edits. Record Life 11 fingerprints for the existing canonical configurations; changes are expected from geography, travel and thirst. Do not update fingerprints to conceal a failed rule or invariant.

Small analytic unit fixtures cover:

1. A slope, bowl with a spill, flat and confluence: deterministic outlet graph, level lake, downstream non-rise, unique areas and no cycle. Changing chunk size cannot change geography or trajectories.
2. Two separate waters: catching fish from one leaves the other unchanged; hourly growth/remainders, zero stock/capacity and catch bounds are exact.
3. A resting body loses exactly 2,000 ml/day; four hours of picking add exactly 440 ml; drinking reduces deficit without overfill. Test hysteresis, severe-thirst night interruption and the exact fatal crossing.
4. A lake between person and target: route bends around it, diagonal corners cannot cross it, a hidden route is not used, and observing a new bank enables access. Visible water must not reveal hidden fish or shoreline.
5. A dry start, crowded bank and group formed beside water: invalid footprints are rejected, no member teleports, and bounded placement failure is explicit.
6. Corrupt a drinking amount, body ID, fish remainder, downstream link, movement segment and death record: the checker must reject each.
7. Retain purity, repeatability and existing food/fire/tool/trade rule tests. Add an observer check that interpolated route points and bank contacts remain dry and agree with displayed geometry.

These are rule checks, not experiments or multi-seed tuning. Final implementation validation is `npm run agent:check`; inspect only a failed stage's smallest relevant log excerpt. Then make the brief browser check above.

Calibration, architecture, validation, README, changelog and lab notes accompany the implementation under this update ID.

## Questions for later

- How much does the saturated-depression assumption overstate permanent water in young-moraine country? Which hollows should instead be seasonal or groundwater-fed?
- What real 4 km reference windows and measurements should set catchment threshold, lake area/depth and river width? When should channels become narrower than the terrain lattice?
- How much does forbidding shallow crossings change travel, group formation and resource access?
- How should diet moisture, heat and exertion alter drinking, and should dehydration impair work before death?
- What biomass, recruitment and catch rates fit local rivers? When should fish migrate between reaches or become individual agents?
- Does local water access change camp placement, time budgets, encounters and exchanges without a built-in attraction-to-water rule?

## Left out

Rain, evaporation and groundwater budgets; changing lake levels, flooding, drought, freezing and seasonal flow; dynamic erosion and sediment; wetlands and aquatic vegetation; swimming, wading, boats, bridges and paths worn by walking; drinking containers, carried water, water sharing or claims; waterborne disease and purification; food-specific hydration, thermal physiology and gradual dehydration impairment; fish species, age structure, migration and fishing gear; woodland succession, animal agents, hunting, recipes beyond axes/huts, cooking, food preservation, births, ageing and intergenerational learning.

The roadmap keeps seasons/weather at 12, vegetation at 13, animal agents from 14, hunting at 16, body heat/tiredness at 17 and illness at 18. Earlier notes that placed erosion in step 11 are narrowed here to the prescribed generation-time channel cut; a dynamic erosion model has no scheduled step.

## References

- [W1] Pedersen, Rasmussen and Fredericia (2015), [Geological map of Denmark 1:50,000, Sakskøbing](https://eng.geus.dk/media/13287/map6_p01-42.pdf), GEUS Map Series 6. Regional setting and glacial drainage evidence.
- [W2] M. L. Pedersen, [Danish stream research thesis](https://www2.dmu.dk/1_Viden/2_Publikationer/3_ovrige/rapporter/PhD_MLP_Web.pdf), National Environmental Research Institute. Stream size and habitat context; not a fitted Mesolithic channel model.
- [W3] Barnes, Lehman and Mulla (2014), [Priority-Flood: An Optimal Depression-Filling and Watershed-Labeling Algorithm for Digital Elevation Models](https://rbarnes.org/sci/2014_depressions.pdf), *Computers & Geosciences* 62, 117–127.
- [W4] EFSA NDA Panel (2010), [Scientific Opinion on Dietary Reference Values for water](https://efsa.onlinelibrary.wiley.com/doi/abs/10.2903/j.efsa.2010.1459); values also in EFSA's [2017 summary report](https://www.efsa.europa.eu/sites/default/files/2017_09_DRVs_summary_report.pdf). Reference total intakes do not directly determine this model's net drinking loss or lethal threshold.
- Existing terrain, walking, foods, fish, wood, shelter and tool evidence remains in [CALIBRATION.md](CALIBRATION.md). Estimates in this specification do not acquire measured status by association with those references.
