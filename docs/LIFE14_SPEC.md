# [LIFE14-Bodies-064]

**Approved for implementation by the owner on 2026-10-26.** This specification replaces the Life 13 specification and describes the whole simulation. It is step 14 of the [roadmap](ROADMAP.md), bodies and personality, and is built under the [Life section](../SIMULATION_DESIGN_RULES.md#life-realism-and-time) of the design rules. It is implemented as one pull request.

Forty strangers are dropped on 4 km square of young glacial land in Mesolithic northern Europe: drumlins, moraine fronts, kames, hummocks, kettle hollows and tunnel valleys, with lakes in the hollows and rivers running downhill to the edge. The ground is grass, dirt and stone. People discover drinking banks, drink, pick berries, gather hazelnuts, fish, gather firewood, meet, form groups, exchange wood and axes for food, and build huts around shared fires. Their knowledge comes from observation and memory. From this step each of them is a woman or a man with a body of their own and a personality of their own.

Time is one clock in minutes. Nobody is stepped: a person is woken when their task ends, a body threshold arrives, someone enters their chunk, or someone addresses them, and their position and body at any minute follow from their task. A year has as many days as the run's settings say, from 8 to 365. Lengths are integer centimetres, food integer kilocalories, wood integer kilograms, water deficit integer millilitres, and fractional amounts accumulate in integer remainders. `stepValley` advances the state to a target minute, is pure and deterministic, and every random draw comes from a named derived stream. The observer displays real records and interpolates movement between them.

## What Life 14 makes possible

- **People differ in body.** Until now every person weighed 60 kg and carried 30 kg. Now each founder is a woman or a man with a height, a weight and a strength drawn together, as they go together in real people: taller people are heavier, heavier people stronger. A strong person carries more wood per trip; a heavy person walks better under a load but burns more food. Strength is what later decides fights (step 16).
- **People differ in temperament.** Each founder has the five traits psychologists measure in every population studied, drawn with their real correlations. Each trait has one job in the engine, attached to a decision people already make:
  - **Extraversion** starts interactions: how far a person will walk to approach someone they see.
  - **Agreeableness** gives way: how much of an exchange's gain a person leaves to the other side. With disputes (step 16) it also decides who yields.
  - **Conscientiousness** plans ahead: how much wood a person stocks and how full they eat before stopping work.
  - **Neuroticism** sets the fear threshold: how early a person turns home before dark. With conflict (step 16) it also sets when they flee.
  - **Openness** tries the unfamiliar: how far from home a person explores when idle, and how much they expect of a place they have never checked.
- **The groundwork for the chief.** Relationships (15), conflict (16) and influence (17) need people who differ. Nothing in this step makes anyone a leader.

This step changes who people are. It does not change the map, the routes, the resources or what people can do.

## Checked against

| Measure | Evidence and comparison | Status |
| --- | --- | --- |
| Adult stature | Mesolithic Europe, from skeletons: men about 165 cm and women about 154 cm, each with a spread of about 6 cm (Formicola and Giannecchini 1999; Ruff 2018). The forty founders' means lie within 3 cm of these, and the sexes do not overlap much more than real ones. | Magnitudes; checked once on the canonical seed, and by a unit test over 10,000 draws. |
| Adult body mass | Mesolithic Europe, estimated from skeletons: men about 62 kg, women about 52 kg (Ruff 2018). | As above. |
| Strength | Grip strength, the standard field measure, among forager-horticulturalists (Tsimane, Hadza, Agta): men about 38 kg, women about 24 kg, with women's strength about 60% of men's (Gurven et al. 2006; Apicella 2014). | As above. |
| Body correlations | Within each sex, height with weight about 0.55, height with grip about 0.35, weight with grip about 0.40. | A unit test over 10,000 draws, each within 0.05. |
| Trait correlations | The meta-analysis of the five traits across 212 samples (van der Linden et al. 2010): openness with extraversion 0.43, conscientiousness with agreeableness 0.43, conscientiousness with neuroticism −0.43, extraversion with neuroticism −0.36, agreeableness with neuroticism −0.36, conscientiousness with extraversion 0.29, agreeableness with extraversion 0.26, openness with agreeableness 0.21, openness with conscientiousness 0.20, openness with neuroticism −0.17. | A unit test over 10,000 draws, each within 0.05. |
| What the traits do | Extraverts seek contact more (Asendorpf and Wilpers 1998); agreeable people offer fairer splits in bargaining games (Ben-Ner et al. 2004); conscientious people plan and store; neurotic people avoid risk; open people seek novelty. | Direction only: each trait's rule has a unit fixture showing the direction. The strengths of the effects are judgement, not calibration, and are listed as questions for later. |
| Carrying | Forager women carry loads of 15 to 25 kg for hours, men more; women's load capacity is closer to men's than their grip is (Hadza and !Kung loads; Lee 1979; Marlowe 2010). | Magnitudes. |
| Speed | A year of forty people in about a second, as Life 13. | Not met: the canonical ninety-day year of forty took 852.90 s with an 8 GB Node heap; the default 4 GB attempt exhausted memory. Life 13 already missed the time target. Details are in update 064 of the lab notes. |

## Design decisions

| Decision | Reason |
| --- | --- |
| Each founder is a woman or a man, drawn half and half. | Height, weight and strength are bimodal by sex; drawing one distribution for everyone would give a population with no real counterpart. Sex is needed again for pairing at step 18. In this step it does nothing but set which body distribution is drawn. |
| Bodies are adults and fixed for life. | Nobody grows or ages before step 18. |
| Height, weight and grip are drawn together from one correlated normal draw per person, clamped to three standard deviations. | The roadmap asks for real correlations; three spreads cover 99.7% of real people and keep integer rates safe. |
| Normal draws are made in integers: the sum of twelve uniform draws from 0 to 999, less 5,994, is a standard normal in thousandths. Correlations come from a Cholesky factor computed in integers with an integer square root. | `Math.log`, `Math.cos` and the like may differ between JavaScript engines; integer arithmetic replays bit for bit everywhere. The sum of twelve uniforms has the normal's mean and spread; its tails stop at six spreads, beyond the clamp. |
| Height has no rule of its own in this step. | It is drawn because weight and strength follow it; it is shown, and it is there for step 16 (reach) and for the observer's figures. |
| Strength sets the wood load: `woodLoad · (grip + referenceGrip) / (2 · referenceGrip)`. | Carrying depends on legs and back as much as hands, so women's loads are closer to men's than their grip is: an average woman carries about 26 kg, an average man about 33 kg, the weakest about 17 kg. A log stays one log for everyone: only the speed it costs differs. |
| Weight replaces the single `bodyKg`: it weighs the load against the body for walking speed, sets the thirst thresholds, and scales every kilocalorie rate. | A heavier body carries a load more easily, holds more water and burns more energy for the same work. Scaling by weight keeps strength from being free: a big strong person carries more but must eat more. |
| Five traits, each stored as a normal score in thousandths of a spread, clamped to three spreads. | Personality is measured as continuous scores with a normal spread in every population; a score in spreads lets each rule say "one spread more moves this by so much". |
| Each trait has exactly one job, attached to a decision people already make, and no trait touches another trait's decision. | Rule 13: a trait with no mechanism is cut. One job each keeps every effect traceable to one trait. Agreeableness's yielding and neuroticism's flight wait for disputes at step 16, but each already has a job now, so neither is cut. |
| Every trait rule is a person's own threshold or share. No trait sets an outcome. | Rule 4: behaviour emerges from incentives. A trait shifts where a person draws a line; whether that pays is left to the world. |
| An average person behaves close to Life 13, but not exactly. | Life 13's rules had no margin before dusk and treated unseen stocks as full. The average person now keeps half an hour before dusk and expects three quarters of an unseen stock. Keeping Life 13 exactly for the average would need rules that only matter at the extremes. |
| Bodies and traits come from their own streams. | The founder, skill and craft streams draw exactly as before, so a person's start and skills on a seed are unchanged. |

## World

### Terrain, water and ground

Terrain heights on the 5 m `terrainCellCm` lattice, ground classes per cell, drainage, lakes, river reaches and their levels are generated exactly as in Life 12 and 13, from the same eleven terrain streams and the same parameters, over a square `valleySizeCm` across. The world size setting sets `valleySizeCm` in whole kilometres from 1 to 10; landform counts scale with area, rounded, so that density is the same at every size. The hydrology's shoreline, where each cell's ground meets its water level, is the mesh's input. Water remains an external reservoir: drinking withdrawals are recorded and lower nothing.

The land is held in chunks of `chunkCm` (200 m). A chunk indexes its places, its bank points, its triangles and the people currently in it.

### The ground mesh

Unchanged from Life 13. The mesh is built once per layout, in this order:

1. **Shorelines.** The hydrology's shore segments are joined into polylines, each ending on itself or on the valley's edge, and simplified by Douglas–Peucker to `shoreToleranceCm`. A simplification is rejected, keeping the vertex, if the new edge would cross or touch another shore edge. A polyline closing on itself keeps at least three vertices. Every shore vertex has integer coordinates and its water level as its height.
2. **Relief vertices.** The valley is divided into squares of `meshMaxEdgeCm` (40 m). A square is split into four while it is larger than one terrain cell and, at any 5 m lattice point inside it, either of its two triangulations strays from the generated height by more than `meshHeightToleranceCm`. The corners of every resulting square are vertices, with their generated heights. Vertices inside water take the water's level as their height and keep the bed height below it as their depth. Vertices within `shoreToleranceCm` of a kept shore edge are dropped.
3. **Triangulation.** All vertices are triangulated by a constrained Delaunay triangulation with every simplified shore edge and the valley's edge as constraints, vertices sorted by `y` then `x` before insertion. Delaunator 5.1.0 and Constrainautor 4.1.0, pinned. A dry 5 m lattice point whose triangle still strays by more than `meshHeightToleranceCm` becomes a vertex and the triangulation is rebuilt, until no dry point strays.
4. **Area types.** Each triangle takes the hydrology at its centroid: `lake` or `river` with its body's id, otherwise `ground`. Each kept shore edge knows its water side from a vote of the hydrology's shore segments beside it, and the triangles on either side take that side's type. Every edge between a ground and a water triangle is a shore edge. A ground triangle takes the ground class of the terrain cell holding its centroid.
5. **Index.** Each triangle records its vertices counter-clockwise, its neighbours, area type, body, ground class, plane and chunk. A grid of 20 m buckets lists the triangles overlapping each bucket.
6. **Regions.** Walkable triangles connected through shared edges form regions, numbered by their lowest triangle id. The largest by area is the main land.

Height at any point is the plane of the triangle holding it, rounded down. A point on a shared edge or vertex belongs to the lowest-numbered triangle holding it. Slope is the triangle's gradient.

### Places

A place is a thing someone can decide to go to. Each has an id, a kind, a position on walkable ground, a chunk, and for resource places one stock. Kinds:

| Kind | Stock | Count on 4 km |
| --- | --- | --- |
| Berry thicket | kcal of berries, wood in dead stems | 800 |
| Hazel thicket | kcal of nuts | 800 |
| Tree stand | kg of deadfall wood, standing logs | 300 |
| Outcrop | stones | 100 |
| Drinking bank, fishing bank | none; the water body holds the fish | from the mesh's shore edges |
| Hearth, flag, hut site | the group's fire wood; the hut's logs | made by people |

Places are laid out by the layout stream with Life 11's spacing, their footprints wholly on walkable triangles. A berry thicket holds up to 3,120 kcal and regrows 54,000 kcal a year; a hazel thicket 75,000 kcal and 150,000 a year; a stand 300 kg of wood, 60 kg of deadfall a year and 36 logs, with 10 kg of crown wood per felled tree; an outcrop 60 stones. Picking retains Life 11's stock-dependent slowdown: the skill-adjusted full rate is multiplied by the remembered fraction of capacity remaining, rounded down, when the task starts, fixed until the next wake-up; production is capped at the stock remaining when credited.

Bank points come from the mesh: each shore edge between a walkable and a water triangle gives at most one bank point, set back half a metre (or `reachCm`, if less) from the edge's midpoint into the walkable side and kept by Life 11's approach rule. Its id is the edge's half-edge number.

### Stocks, fish and regrowth

Once a day at midnight, each resource place receives its day's share of its yearly regrowth, `floor(a*(d+1)/D) - floor(a*d/D)` for yearly amount `a` on day `d` of a `D`-day year, capped at capacity. Felled stands regain a tree's logs after `treeRegrowthYears`. Fish per lake and reach keep Life 11's capacity and logistic growth, applied once a day with an exact carried remainder; a depleted body is not reseeded. Hut weathering is day-anchored: one log every `hutLogDays`.

## Time

### The clock

The run starts at minute 0, midnight of day 0 of year 0. A day is 1,440 minutes; dawn is minute 360 and dusk minute 1,080; a year is `daysPerYear` days. Day and year are derived from the minute; nothing stores them.

### Wake-ups

The state holds a queue of wake-ups `(minute, phase, id)`. Phases, in order within a minute: `world` (daily regrowth, spoilage, invariants at midnight; fires at each hour), then `person`, ordered by id. `stepValley(state, toMinute)` pops and runs wake-ups until the queue's head is past `toMinute`, and is pure: it returns a new state and the events of the interval.

A person's wake-up is scheduled by:

- **task end**: a walk arrives, a load is full, a thicket is emptied at the current rate, an axe or hut log is finished, sleep ends at dawn, a rest ends after an hour;
- **body threshold**: when a task starts, the minute at which energy or water will cross the person's next threshold (hungry, thirsty, severely thirsty, fatal) is computed from the task's rates and scheduled if it falls before the task's end;
- **arrival in the chunk**: a walker whose route enters a chunk wakes every person in that chunk whose task is interruptible at the minute of entry;
- **address**: a meeting, an exchange offer, an axe request or a delivery wakes the addressee in the same minute, after the addresser.

A wake-up removes the person's other pending entries; a person has at most one future task end and one future threshold in the queue.

### Between wake-ups

A person's record holds the task, its start minute, its route (for a walk) and the body at its start. Position at minute `m` is the point along the route at the distance walked by `m`; for other tasks it is the place. Energy and water at `m` are the start values less the person's rates for the task over `m - start`, with the start's remainders. The observer and perception read these functions; nothing stores a per-minute body.

### Cadences

| System | Cadence |
| --- | --- |
| Resource and fish regrowth, spoilage of carried lots, hut weathering, practice update | Daily at midnight, `world` phase |
| Group and personal fires | Hourly at night, `world` phase |
| Bodies | Lazily, at the person's wake-ups |
| Conservation checks | At every event that moves food, wood, logs, stones, axes or water |
| Full invariants | Daily at midnight, and at the end of every `stepValley` call in checked runs |

Bodies and traits are drawn once, when the founders are made, and never change.

### Days per year

`daysPerYear` is a run setting from 8 to 365, default 90. Day-anchored, unchanged by the setting: sleep, the hour of rest, picking, gathering, chopping, drinking and making rates, spoilage, firewood per night, hut weathering days, the 30-day practice window, the 24-hour memory of heard terms, the 24-hour recheck of sites, and every trait rule (margins in minutes, distances, shares). Year-anchored, scaled by the setting: regrowth per year, fish growth per year, tree regrowth in years, and the displayed calendar. A year-anchored duration is never shorter than one day.

### Streams

Every draw comes from a stream derived from the seed and a name: the terrain and layout streams as in Life 11; the founder, skill and craft streams for starts and born skills, unchanged; `axe:<maker>:<minute>` for an axe's quality; and two new streams, each with its own salt, drawn through every founder in id order:

- **body**: per founder, one draw `randomInt(2)` for sex (0 woman, 1 man), then three standard normals for height, weight and grip;
- **traits**: per founder, five standard normals for openness, conscientiousness, extraversion, agreeableness and neuroticism, in that order.

Nothing is drawn per minute. The mesh draws nothing.

## Bodies and personality

### Integer normal draws

A standard normal in thousandths is `z = u1 + u2 + … + u12 − 5,994`, each `u` drawn by `randomInt(1,000)` from the stream, then clamped to −3,000…3,000.

A correlation matrix `C` in per mille (1,000 on the diagonal) gives a lower-triangular factor `L` in per mille, computed in integers once per configuration:

- `L[i][j] = trunc((1,000 · C[i][j] − Σ_{k<j} L[i][k] · L[j][k]) / L[j][j])` for `j < i`, rounding toward zero;
- `L[i][i] = isqrt(1,000,000 − Σ_{k<i} L[i][k]²)`, where `isqrt` is the integer square root, rounded down.

Configuration validation rejects a matrix whose diagonal term under the root is not positive. Correlated scores are `x[i] = trunc(Σ_{j≤i} L[i][j] · z[j] / 1,000)`, then clamped again to −3,000…3,000. On the default matrices `L` is about:

| Body | height | weight | grip |
| --- | --- | --- | --- |
| height | 1,000 | | |
| weight | 550 | 835 | |
| grip | 350 | 248 | 903 |

| Traits | O | C | E | A | N |
| --- | --- | --- | --- | --- | --- |
| O | 1,000 | | | | |
| C | 200 | 980 | | | |
| E | 430 | 208 | 878 | | |
| A | 210 | 396 | 99 | 888 | |
| N | −170 | −404 | −231 | −159 | 854 |

### Bodies

From a body score `x` in thousandths, a quantity is `mean + floor(sd · x / 1,000)` with the sex's mean and the spread:

| Quantity | Woman | Man | Spread | Unit |
| --- | --- | --- | --- | --- |
| Height | 154 | 165 | 6 | cm |
| Weight | 52 | 62 | 6 | kg |
| Grip | 24 | 38 | 6 | kg |

From these, fixed for life:

- **Load capacity** `loadKg = floor(woodLoad · (gripKg + referenceGripKg) / (2 · referenceGripKg))`. It replaces `woodLoad` everywhere a person's wood load is compared: filling a load, taking a full load home, and the gathering task's end. A log is carried whole by anyone.
- **Walking under load**: the flat loaded speed is `max(1, floor(walkCmPerSecond · (1,000 · weightKg − loadSlowdownPerMille · loadKg) / (1,000 · weightKg)))` with the person's own weight.
- **Thirst thresholds**: thirsty, severely thirsty and fatal water deficits are the person's weight times `thirstBodyPerMille`, `urgentThirstBodyPerMille` and `fatalWaterLossBodyPerMille`.
- **Energy rates**: every kilocalorie rate a task charges (walking on each slope class, picking, gathering, chopping, making, drinking, resting, and each kind of sleep) is the configured rate times `weightKg / referenceBodyKg`, rounded down, computed once for the person and held in a table. The water allowance per kilocalorie above resting uses the person's own rates. The energy reserve and its thresholds stay as configured: they describe stores, not size.

### Personality

A person's five traits are stored as scores in thousandths of a spread, −3,000 to 3,000. Each rule turns a score `z` into a person's own factor `f(z) = clamp(base + effect · z / 1,000, low, high)` in per mille, rounded down, computed once and stored with the person. Each trait has exactly one job:

| Trait | Job | Rule | base, effect, low, high |
| --- | --- | --- | --- |
| Extraversion | Starts interactions | An ungrouped person approaches a seen person, or a known flag, only if it lies within `companyRadiusCm · f / 1,000` in a straight line, capped at the sight radius. Meeting within talking distance is unchanged, so an introvert who is approached still meets. | 1,000, 500, 0, 2,000 |
| Agreeableness | Gives way | In a wood-for-food exchange, the wood seller's share of the gain is `s = clamp(500 + 250 · (zA_buyer − zA_seller) / 1,000, 100, 900)` per mille, and the price in kcal per kg is `floor((seller.forageRate · buyer.woodRate · (1,000 − s) + buyer.forageRate · seller.woodRate · s) / (1,000 · seller.woodRate · buyer.woodRate))`. At equal agreeableness this is Life 13's midpoint. The swap still happens only if both gain at that price. The more agreeable side leaves more of the gain to the other. | as stated |
| Conscientiousness | Plans ahead | The wood a person stocks to is `max(nightWood + 1, floor(woodStockNights · nightWood · f / 1,000))`; the energy at which they stop food work is `min(reserveMaxKcal, hungryBelowKcal + floor((satiatedAtKcal − hungryBelowKcal) · f / 1,000))`. Short of wood below one night, and hungry below `hungryBelowKcal`, are unchanged. | 1,000, 250, 500, 1,750 |
| Neuroticism | Fear threshold | A person keeps `duskMarginMinutes · f / 1,000` minutes, at least 1, before dusk: they go home when the walk home would end later than dusk less the margin, and choose no work, check or water whose walk there and home would. Severe thirst ignores the margin, as it ignores dusk. | 1,000, 500, 0, 4,000 |
| Openness | Tries the unfamiliar | (a) When idle (priority 9), a person explores the nearest frontier only if it lies within `exploreRangeCm · f / 1,000` of their hearth in a straight line; otherwise they recheck a place or rest. Exploring for water, food or wood they need is unchanged. (b) A known place whose stock they have never seen is expected to hold `capacity · g / 1,000`, with `g = clamp(750 + 250 · z / 1,000, 250, 1,000)`. | 1,000, 500, 250, 3,000 |

No other rule reads a trait. The trait factors and the body-derived quantities are stored with the person, and the checker recomputes them from the scores and the configuration.

## Knowledge and perception

A person remembers: places, with kind, position, the stock last seen and the minute it was seen; bank points; the triangles of the mesh it has seen; people it has met, with the minute; heard exchange terms for 24 hours; its group, flag, hearth and hut. A person knows their own body and traits, and nobody else's.

At every wake-up a person observes: every place and bank point within `sightRadiusCm` (1 km) becomes known; the place it stands at shows its stock; every triangle whose centroid lies within the sight radius becomes known; people within `talkRadiusCm` (20 m) are met. A chunk lying wholly within the sight radius marks all its triangles at once. Relief does not block sight. A stock not yet seen is expected at the openness share of capacity, above; a fish stock is learnt only by fishing. Triangle knowledge is a bit per triangle, shared with the previous state and copied only when the person learns a new triangle.

## Routes and movement

A person may walk on ground triangles only. A route is found when a walk starts: A\* over the triangles the person knows and may walk on, costed by the distance between the midpoints of the edges crossed, ties by triangle id; if the target is unknown or unreachable, the person walks to the nearest known frontier, or rests with `no known route`. The funnel algorithm pulls the corridor tight; the path is cut at triangle edges into pieces, each with a length, a slope class from its triangle (flat below 10%, moderate to 30%, steep above), a ground class and a speed.

Speed is the person's flat loaded speed, above; moderate slopes divide it by `moderateSlowdownPerMille/1,000` uphill; steep slopes halve it uphill and divide by `steepDownSlowdownPerMille/1,000` downhill; ground multiplies time by Life 11's terrain percentages. Walking costs the person's walking rate on the flat, one and a half times that on moderate uphill and twice on steep. A walk's duration is summed in integer 1/60,000-minute units and rounded up at its end; remainders carry. Routes are cached per person by endpoints, knowledge revision and load.

Travel estimates for choosing targets use straight-line distance at the person's flat loaded speed plus `climbMinutesPerMetre`, as a lower bound.

## People

Each person is one object: sex, height, weight, grip, the five trait scores and their derived quantities; position, task record, energy and water with their remainders, carried food lots, carried wood, carried log, stones, axe, hut, group, born skills, practice and alive. Its memories are typed arrays, bitsets and maps inside it, never read by the checker as truth.

Founders are `founders` people, 40 by default, placed from their own streams within the central `startAreaCm` (800 m) on walkable grass or dirt of the main land, with Life 11's spacing when `scattered`, or at the nearest valid camp when together. Born foraging and wood skill range from 75% to 125%; born craft is 100%. Everyone starts with 66,000 kcal, no water deficit, nothing carried and no relationships.

## Tasks

| Task | Ends when | Rates per hour (kcal, ml) |
| --- | --- | --- |
| Walk | Route's last segment arrives | the person's walking rates |
| Pick berries, gather nuts, fish | Carried reserve room is full, the stock at the current rate is exhausted, or the person's return before dusk is due | the person's picking rate |
| Drink | Deficit is below `drinkStopMl` | the person's resting rate |
| Gather wood | The person's load is full or the stock is exhausted | the person's gathering rate |
| Cut a log | `logChopMinutes` scaled by axe quality | the person's chopping rate |
| Make an axe | `axeHours` scaled by craft, pausable | the person's making rate |
| Rest | One hour, or an interruption | the person's resting rate |
| Sleep | Dawn, or severe thirst | by hut and fire, as Life 11, scaled by weight |

Water loss is `waterBaseMlPerDay/1,440` a minute plus `waterExtraMlPerKcal` per kcal above the person's resting rate, with Life 11's exact remainders. Eating happens at wake-ups, oldest lots first, up to reserve capacity.

## A wake-up

1. Pay the body for the minutes since the last wake-up, at the ended task's rates for this person; credit what the task produced; record the task's events. If a fatal threshold was crossed, record the death at that minute and stop.
2. Spoil carried lots past their life; eat oldest first up to reserve capacity.
3. Observe. Meet people within talking distance: found or join a group, hear terms, exchange wood for food at the agreeableness price, request or promise an axe, deliver hut logs, contribute to the group's fire.
4. Update needs: hunger with the person's own satiation level, thirst with the person's own thresholds, wood need with the person's own stock target.
5. Choose the next task by the priorities below, using only memory.
6. Start it: search its route if it is a walk, schedule its end and its first body threshold, record the task start.

## Priorities

Choose the first applicable rule. "Before dusk" means before dusk less the person's margin.

| Priority | Condition | Action |
| --- | --- | --- |
| 1 | Severe thirst, day or night | Drink at a reachable bank, else walk to the nearest known accessible bank, else explore for water. No margin applies. |
| 2 | Away from home and night, or the walk home would end after dusk less the margin | Walk home by the known route; explore to recover one if there is none. |
| 3 | Night | Sleep. Ordinary thirst waits; severe thirst wakes. |
| 4 | Thirsty in daylight | Drink or seek water, leaving time to return before dusk; if no eligible bank is known, search a frontier; if too late, return home or rest. |
| 5 | Carrying a log | Take it home. |
| 6 | Not hungry and filling or carrying a wood load | Finish the person's load, or take a full load home. |
| 7 | Neither hungry nor short of wood, without a group | Approach the nearest seen person, or else the nearest known flag, within the person's company radius; otherwise go on to priority 9. |
| 8 | A member with neither food nor wood need | Finish an axe; otherwise cut hut logs if equipped; otherwise buy a worthwhile known axe or make one, fetching a stone and wood first. |
| 9 | Neither food nor wood need | Explore the nearest frontier if it lies within the person's exploring range of home; otherwise recheck a reachable place after 24 hours; rest when none is available. |
| 10 | Food or wood needed | Choose productive gathering or an advantageous local exchange; search if no remembered source is worth working; otherwise rest with the reason recorded. |

Food choice scores one hour's expected food at a remembered place as `3,600 * rate / (estimatedWalkSeconds + 3,600)`, from the stock last seen, or the openness share of capacity if never seen. Work must leave time to return home before dusk less the margin, except drinking under severe thirst.

## Food, wood, shelter and exchange

As Life 13, with each person's own quantities: food in timestamped lots by kind, berries spoiling after 48 hours, nuts after 4,380 and fish after 24; energy starting at 66,000 kcal, capped at 70,000, hungry below 64,000 and satisfied at the person's own level; wood need below one night's firewood, cleared at the person's own stock; loads up to the person's capacity and logs of 35 kg; groups founded by two ungrouped people within 20 m, joined by a lone person, with a flag, a common fire burning 1 kg an hour at night, and a 23-log hut per member weathering a log every 60 days; axes from one stone and 1 kg of wood, quality drawn from half to all of craft, cutting a log in 30 minutes at quality 100 and lasting 200 logs; practice over the last 30 days; wood-for-food swaps at the agreeableness price; axes asked at the maker's extra energy and bought when buying gains food energy. There is no money, no ownership of water, no forced sharing and no planned specialisation.

## Defaults and configuration validation

Run settings are unchanged:

| Setting | Default | Range |
| --- | --- | --- |
| `seed` | 20260813 | any integer |
| `daysPerYear` | 90 | 8 to 365 |
| `worldKm` | 4 | 1 to 10 |
| `founders` | 40 | 1 to 1,000; the page allows 1 to 100 |
| `scattered` | true | |

New parameters:

| Parameter | Default | Basis |
| --- | --- | --- |
| `womanHeightCm`, `manHeightCm`, `heightSdCm` | 154, 165, 6 | Mesolithic European stature. |
| `womanWeightKg`, `manWeightKg`, `weightSdKg` | 52, 62, 6 | Mesolithic European body mass. |
| `womanGripKg`, `manGripKg`, `gripSdKg` | 24, 38, 6 | Forager-horticulturalist grip strength. |
| `heightWeightPerMille`, `heightGripPerMille`, `weightGripPerMille` | 550, 350, 400 | Within-sex body correlations. |
| `traitCorrelationsPerMille` | the ten values in "Checked against", in the order O–C, O–E, O–A, O–N, C–E, C–A, C–N, E–A, E–N, A–N | van der Linden et al. 2010. |
| `referenceBodyKg` | 60 | The single body of Life 13, against which energy rates are stated. |
| `referenceGripKg` | 31 | The adult mean grip, halfway between the sexes; a person of this grip carries `woodLoad`. |
| `companyRadiusCm` | 60,000 | An average person approaches someone seen up to 600 m away; one spread more extravert, 900 m. |
| `duskMarginMinutes` | 30 | An average person turns home half an hour before dusk; one spread more neurotic, 45 minutes. |
| `exploreRangeCm` | 150,000 | An average person explores idle up to 1.5 km from home; one spread more open, 2.25 km. |

The base, effect, low and high of each trait rule are the values in the personality table, held in the configuration as `extraversionRule`, `agreeablenessRule`, `conscientiousnessRule`, `neuroticismRule`, `opennessRule` and `opennessExpectRule`, each `{ base, effect, low, high }` in per mille.

Removed: `bodyKg`, replaced by each person's weight and `referenceBodyKg`. All other Life 13 defaults are retained.

Validation rejects non-integers, non-finite values and unsafe products; settings outside their ranges; non-positive means and spreads; a mean less three spreads that is not positive; correlations outside −999…999; a correlation matrix that is not positive definite by the integer factorisation above; a rule with `low > high`, a negative `low`, or an `effect` whose product with 3,000 is unsafe; and every check that used `bodyKg` or `woodLoad` (such as a log still being movable, and work rates exceeding resting) evaluated at the extreme person: the lightest weight, the lowest load capacity, the highest scaled rates. It also keeps every Life 13 check on the mesh, places, thresholds and placement.

## Invariants and ledger

The checker replays the events of each `stepValley` interval against the state in checked runs, validates immutable geography once, and runs the full set at every midnight.

- **The mesh, once per layout:** as Life 13: winding, areas, neighbours, shores, shore heights, shoreline and heights within tolerance, places and banks on walkable ground.
- **Bodies and traits:** every person's sex is 0 or 1; height, weight and grip lie within three spreads of their sex's mean; trait scores lie within −3,000…3,000; and the stored load capacity, rate table, thirst thresholds, company radius, exchange rule inputs, stock target, satiation level, dusk margin, exploring range and expected share equal those recomputed from the scores and the configuration. None changes during a run.
- Every wake-up's body charge equals the person's own rates for the task over its minutes, with bounded remainders; energy and water at a wake-up equal the lazy functions evaluated there.
- No person's trip wood exceeds their load capacity.
- Every exchange's price equals the agreeableness price for its two parties, and both gained at it.
- Every person's position at every recorded minute is on walkable ground, and every route segment lies in walkable triangles the person knew when the walk started. Nobody is at two places, and the chunk index agrees with positions.
- Food, wood, logs, stones and axes conserve at every event; fish and thicket stocks replay from regrowth and takes; water withdrawals equal recorded drinks.
- The queue holds at most one task end and one threshold per living person; no wake-up is in the past; dead people have none.
- Every decision reads memory only.
- Hunger and thirst hysteresis with the person's own levels, death minute and cause, and group dissolution below two living members follow the stated order.

Events are as Life 13; an exchange records its price and the seller's share. Daily summaries per person and per group as Life 13. World metrics add, once per run, the founders' body and trait means and spreads by sex.

## Observer

Label the page **Life 14 · strangers**. Everything else in the settings screen, loading card, header, history panel, group card, playback and landscape is as Life 13.

- **Figures.** Each person's figure is scaled to their height, and widened slightly with weight, so the founders visibly differ. Women and men differ only by this; no other marker.
- **Person panel.** Adds a body line, for example "Woman · 157 cm · 51 kg · grip 25 kg · carries 26 kg", and five trait rows, each a small bar from −3 to +3 spreads with a word: *very low* below −1.5, *low* to −0.5, *average* to 0.5, *high* to 1.5, *very high* above. The words are the observer's, not the engine's.
- **Exchange history.** An exchange line shows the price and which side took the larger share.

## Code layout

- New `src/valley/nature.ts`: integer normal draws, the integer Cholesky factor, drawing bodies and traits from their streams, the trait rule factors, and each person's derived quantities and rate table.
- `layout.ts`: the body and traits stream salts beside the skill and craft salts; founders take their bodies and traits from `nature.ts`.
- `types.ts`, `config.ts`: the person's body, traits and derived quantities; the new parameters, their defaults and validation; `bodyKg` removed.
- `body.ts`: thirst thresholds per person.
- `forager.ts`, `routes.ts`, `tasks.ts`, `wake.ts`: speed, rates, load capacity and dusk margin per person; priorities 7 and 9 and the unseen-stock expectation by trait.
- `trade.ts`: the agreeableness price, which replaces `pairTerms`' midpoint; the person's own wood target.
- `invariants.ts`, `replay.ts`: the checks above.
- `src/valleyView/`: figure scale, the person panel's body and traits, the exchange line, the Life 14 label.
- `docs/LIFE13_SPEC.md` is removed: this specification replaces it.

The terrain, hydrology and mesh (`terrain.ts`, `water.ts`, `mesh.ts`) are unchanged. The MVP9 core is unchanged.

## Tests and implementation acceptance

The Life 13 fingerprint suite passes before engine edits. Every trajectory changes, because bodies change speeds, loads and rates and traits change choices: this step records new fingerprints for all its configurations. The founder, skill and craft draws must be the same as Life 13's on every fingerprint seed; a test asserts this. Fingerprints are not updated to conceal a failed rule.

Unit fixtures:

1. Normals: 10,000 integer normals have mean within 0.03 spreads of 0 and spread within 0.03 of 1, and none outside the clamp.
2. Factorisation: the integer factor of the default body and trait matrices matches the tables above within 1 per mille; a matrix that is not positive definite is rejected.
3. Bodies: 10,000 drawn bodies per sex have means within 1 unit of their configured means, spreads within 0.5, and the three correlations within 0.05.
4. Traits: 10,000 drawn trait sets have the ten correlations within 0.05.
5. Body rules: a heavier person walks a fixture load faster, burns more kcal in an hour of picking, and has higher thirst thresholds; a stronger person's wood load is larger and their gathering ends later.
6. Extraversion: an introvert at −2 spreads does not walk to a person seen 300 m away; an extravert at +1 does; both meet someone within talking distance.
7. Agreeableness: at equal scores the price is Life 13's midpoint; a more agreeable seller gets a lower price; no swap happens when the price leaves either side without gain.
8. Conscientiousness: a conscientious person stocks more wood and stops eating work at a higher energy; the stock target never falls to one night.
9. Neuroticism: a neurotic person turns home earlier on the same fixture afternoon; severe thirst ignores the margin.
10. Openness: an idle person at −2 spreads does not explore a frontier 1 km from home, one at +1 does; an open person ranks an unseen thicket above a seen half-full one where a closed person does not.
11. The checker rejects a weight outside three spreads, a stored load capacity that disagrees with grip, a trip load above capacity, a body charge at the reference rate instead of the person's, an exchange off the agreeableness price, and the Life 13 corruptions.
12. Streams: the founder positions and born skills on the canonical seed equal Life 13's.
13. The existing queue, lazy-body, places, mesh, routes, food, fire, hut, axe, trade and group tests, with their fixtures given explicit bodies and traits where they depend on them (an average person: reference weight and grip, all scores 0).

Final validation is `npm run agent:check`. Measured once and recorded in the lab notes: the forty founders' body means by sex and the largest gap between a measured and a target correlation, against the tables above; and the year of forty. In the browser: the person panel of a woman and a man, figures of visibly different heights, an exchange line with its price, and the console clean.

## Questions for later

- How strong should each trait's effect be? The effects here are judgement; there is no field measure of how far an extravert walks to meet a stranger.
- Does the mean body mass, by scaling energy, change survival at forty founders compared with Life 13?
- Do strong people end up gathering most of the wood, and do agreeable people end up poorer?
- Should height affect walking speed (longer legs), or only weight and load?
- Should strength also speed chopping and log carrying?
- What default year, within 60 to 120 days, makes seasons long enough to matter?
- Should personality drift with age and experience, once people age at step 18?

## Left out

Children, growth, ageing and pairing (step 18); fights, injury, yielding and fear in disputes (step 16); relationships (step 15); prestige and leadership (step 17); illness; heat balance and clothing; skills correlated with body or traits; personality change; any trait used by more than one rule; wading, swimming and boats; seasons and weather; herds, planting, property and recipes beyond axes and huts.

## References

- Formicola, V. and Giannecchini, M. (1999), *Evolutionary trends of stature in Upper Paleolithic and Mesolithic Europe*, Journal of Human Evolution.
- Ruff, C. (ed.) (2018), *Skeletal Variation and Adaptation in Europeans: Upper Paleolithic to the Twentieth Century*: stature and body mass estimates.
- Gurven, M. et al. (2006), on strength and physical capacity among Tsimane forager-horticulturalists; Apicella, C. (2014), *Upper-body strength predicts hunting reputation and reproductive success in Hadza hunter-gatherers*.
- van der Linden, D., te Nijenhuis, J. and Bakker, A. (2010), *The General Factor of Personality: a meta-analysis of Big Five intercorrelations*, Journal of Research in Personality.
- Asendorpf, J. and Wilpers, S. (1998), *Personality effects on social relationships*; Ben-Ner, A., Kong, F. and Putterman, L. (2004), *Share and share alike? Gender-pairing, personality, and cognitive ability as determinants of giving*.
- Lee, R. (1979), *The !Kung San*; Marlowe, F. (2010), *The Hadza*: forager loads and daily work.
- Magnitudes for walking, slopes, loads, foods, fish, wood, shelter and tools remain in [CALIBRATION.md](CALIBRATION.md), which gains the body, strength and trait magnitudes above. Terrain, water and mesh references remain those of Life 10 to 13, in the changelog and lab notes.
