# [LIFE13-Mesh-063]

**Approved for implementation by the owner on 2026-10-24.** This specification replaces the Life 12 specification and describes the whole simulation. It is a new step of the [roadmap](ROADMAP.md), inserted before bodies and personality, and is built under the [Life section](../SIMULATION_DESIGN_RULES.md#life-realism-and-time) of the design rules. It is implemented as one pull request.

Forty strangers are dropped on 4 km square of young glacial land in Mesolithic northern Europe: drumlins, moraine fronts, kames, hummocks, kettle hollows and tunnel valleys, with lakes in the hollows and rivers running downhill to the edge. The ground is grass, dirt and stone. People discover drinking banks, drink, pick berries, gather hazelnuts, fish, gather firewood, meet, form groups, exchange wood and axes for food, and build huts around shared fires. Their knowledge comes from observation and memory.

Time is one clock in minutes. Nobody is stepped: a person is woken when their task ends, a body threshold arrives, someone enters their chunk, or someone addresses them, and their position and body at any minute follow from their task. A year has as many days as the run's settings say, from 8 to 365. Lengths are integer centimetres, food integer kilocalories, wood integer kilograms, water deficit integer millilitres, and fractional amounts accumulate in integer remainders. `stepValley` advances the state to a target minute, is pure and deterministic, and every random draw comes from a named derived stream. The observer displays real records and interpolates movement between them.

## What Life 13 makes possible

- **People can walk on all the dry land.** Life 12 routed people over a 20 m lattice whose nodes counted as wet if any water touched them. That lattice broke the valley into 561 sealed pockets, the largest holding 21% of the dry land, and placed every founder outside it; within hours each person had explored their pocket and rested with `no known route`, hour after hour. Measured at the 5 m resolution of the water, 99.2% of the dry land is one connected piece. This step routes over that land.
- **One ground for everything.** The terrain, the water, the walkable area and the drawn landscape become one triangle mesh. What a person walks on, the slope that slows them, the shore they drink at and the ground on screen are the same triangles, so the simulation and the picture cannot disagree.
- **Water is part of the map.** Lakes and rivers are triangles of the mesh with an area type, a surface level and a depth. In this step nobody may enter them; later steps can add wading, swimming and boats by allowing those areas, without a new map.

This step changes how the ground is represented and how routes are found. It does not change what people want or how they decide.

## Checked against

| Measure | Evidence and comparison | Status |
| --- | --- | --- |
| Connectivity | On the canonical seed, the largest walkable region of the mesh holds at least 95% of the dry area, as the 5 m water grid does (99.2%), and every founder starts in it. | Measured once on the canonical seed; no sweep. |
| Being stuck | Over the first four days of the canonical forty-founder run, rests recorded as `no known route` fall from Life 12's 60 to 135 per person to a few, for people who are not on an island. | Pattern comparison, measured once. |
| Shoreline | Every point of the mesh's shoreline lies within `shoreToleranceCm` of the shoreline the hydrology produces, and every water body keeps its area within 5%. | Geometry check, once per layout. |
| Relief | At every 5 m terrain point, the mesh's height lies within `meshHeightToleranceCm` of the generated height. | Geometry check, once per layout. |
| Speed | A year of eight people in well under a second and of forty in about a second, on an ordinary laptop in Node. | Pattern target, not a benchmark; not met by Life 12 (about 64 s for a year of forty). This step reports the year of forty, the creation time and the mesh's size, and must not make creation slower than Life 12's by more than 5 s at 4 km. |
| Walking | About 4.5 km/h on the flat, halved on steep ground, slowed by load: the magnitudes in [CALIBRATION.md](CALIBRATION.md). | Magnitudes, not formulas. |
| Continuity | At a minute a second, no person jumps: every displayed position lies on a recorded route between recorded minutes. | Observer check. |

## Design decisions

| Decision | Reason |
| --- | --- |
| One triangle mesh over the whole valley, land and water, built once when the valley is created. | Unity's NavMesh and surveyors' triangulated irregular networks follow ground of any shape with few triangles: large ones on flat land, small ones on bumps and along shores. One mesh for routes, heights, water and drawing removes the four separate approximations Life 12 kept, and the disagreement between them that made the pockets. |
| Each triangle carries an area type: ground (with grass, dirt or stone), lake or river. Walking may use ground only. | As Unity's area masks: a later step allows water for wading, swimming or boats by changing the mask and a cost, not the map. |
| The mesh is built from the existing generated heights, ground and hydrology, which are unchanged. | The landforms, drainage and lakes of Life 10 and 11 are kept; only their representation changes. |
| Shorelines are simplified to `shoreToleranceCm` (1 m). | The hydrology's shoreline has 245,000 segments of up to 5 m, about 600 km of shore in 16 km², mostly round small ponds. Kept whole it would give millions of triangles. Nobody decides anything about a shoreline's metre (realism rule 3). |
| Relief is refined by a quadtree from 40 m squares down to the 5 m terrain cells, splitting while heights stray more than `meshHeightToleranceCm` (1 m). | Walking speed needs the slope's magnitude, not centimetres (realism rule 2). About a third of the land needs triangles finer than 20 m to stay within 50 cm; the rest is flat enough for 40 m. |
| Routes: A\* over known walkable triangles, then the funnel algorithm pulls the path tight. | The standard navigation-mesh method (as Recast, which Unity's NavMesh is built on). Paths are straight lines that turn only at real corners, rather than 20 m lattice steps. |
| Knowledge is kept per triangle, seen within the sight radius, with chunks seen whole marked at once. | People still route only over ground they have seen; the knowledge unit becomes the mesh's own. |
| A person's triangle knowledge is shared between steps until it changes, as bank memory is. | Copying a knowledge array for every person at every step would be the same fixed cost that made Life 12's 1 h/s run at a sixth of its label. |
| Founders start in the largest walkable region. | Even on the 5 m water grid, two of Life 12's forty founders begin off the main land; a stranger dropped on an island cannot found anything. Islands remain, with whatever grows on them. |
| The landscape is drawn flat-shaded, one colour per triangle. | The drawn triangles are the simulation's triangles. Smooth shading of the same mesh remains possible later. |

## World

### Terrain, water and ground

Terrain heights on the 5 m `terrainCellCm` lattice, ground classes per cell, drainage, lakes, river reaches and their levels are generated exactly as in Life 12, from the same eleven terrain streams and the same parameters, over a square `valleySizeCm` across. The world size setting sets `valleySizeCm` in whole kilometres from 1 to 10; landform counts scale with area, rounded, so that density is the same at every size. The hydrology's shoreline, where each cell's ground meets its water level, is computed as Life 11 and 12 computed the continuous bank surface, and is the mesh's input. Water remains an external reservoir: drinking withdrawals are recorded and lower nothing.

The land is held in chunks of `chunkCm` (200 m). A chunk indexes its places, its bank points, its triangles and the people currently in it.

### The ground mesh

The mesh is built once per layout, in this order:

1. **Shorelines.** The hydrology's shore segments are joined into polylines, each ending on itself or on the valley's edge, and simplified by Douglas–Peucker to `shoreToleranceCm`. A simplification is rejected, keeping the vertex, if the new edge would cross or touch another shore edge, so no two shores merge. A polyline closing on itself keeps at least three vertices. Every shore vertex has integer coordinates and its water level as its height.
2. **Relief vertices.** The valley is divided into squares of `meshMaxEdgeCm` (40 m). A square is split into four while it is larger than one terrain cell and, at any 5 m lattice point inside it, either of its two triangulations (cut along either diagonal) strays from the generated height by more than `meshHeightToleranceCm`. The corners of every resulting square are vertices, with their generated heights. Vertices that fall inside water take the water's level as their height and keep the bed height below it as their depth. Vertices within `shoreToleranceCm` of a kept shore edge are dropped.
3. **Triangulation.** All vertices are triangulated by a constrained Delaunay triangulation with every simplified shore edge and the valley's edge as constraints, with vertices sorted by `y` then `x` before insertion so the result does not depend on generation order. The libraries are pinned to exact versions: Delaunator 5.1.0 and Constrainautor 4.1.0. **Height refinement:** a dry 5 m lattice point whose triangle's plane still strays by more than `meshHeightToleranceCm`, which happens where the Delaunay cut differs from the quadtree's, becomes a vertex, and the triangulation is rebuilt; this repeats until no dry point strays.
4. **Area types.** Each triangle takes the hydrology at its centroid: inside a body's water it is that body's `lake` or `river`, with its id; otherwise `ground`. Each kept shore edge then knows its water side from a vote of the hydrology's own shore segments beside it, and the triangles on either side of it take that side's type. A flood fill bounded by shore edges was rejected, because a gap anywhere in a shore would leak water over the land. Every edge between a ground and a water triangle is then a shore edge, whether or not it is a constraint. A ground triangle takes the ground class of the terrain cell holding its centroid.
5. **Index.** Each triangle records its three vertices counter-clockwise, its three neighbours across its edges (or none at the valley's edge), its area type, body, ground class, plane (height gradient) and chunk. A grid of 20 m buckets lists the triangles overlapping each bucket, for locating points.
6. **Regions.** Walkable triangles connected through shared edges form regions, numbered by their lowest triangle id. The largest by area is the main land.

Height at any point is the plane of the triangle holding it, from its vertices' heights, rounded down. A point on a shared edge or vertex belongs to the lowest-numbered triangle holding it. Slope is the triangle's gradient, exact for the whole triangle.

### Places

A place is a thing someone can decide to go to. Each has an id, a kind, a position on walkable ground, a chunk, and for resource places one stock. Kinds:

| Kind | Stock | Count on 4 km | From Life 11 |
| --- | --- | --- | --- |
| Berry thicket | kcal of berries, wood in dead stems | 800 | 60 bushes |
| Hazel thicket | kcal of nuts | 800 | 40 hazels |
| Tree stand | kg of deadfall wood, standing logs | 300 | 12 trees |
| Outcrop | stones | 100 | 12 spots of 5 stones |
| Drinking bank, fishing bank | none; the water body holds the fish | from the mesh's shore edges | as Life 11 |
| Hearth, flag, hut site | the group's fire wood; the hut's logs | made by people | as Life 11 |

Places are laid out by the layout stream with Life 11's spacing; a place's footprint must lie wholly on walkable triangles, which replaces the dry-footprint test against wet polygons. A thicket's capacity, initial stock and yearly regrowth are the sums over its former individuals: a berry thicket holds up to 3,120 kcal and regrows 54,000 kcal a year; a hazel thicket 75,000 kcal and 150,000 a year; a stand 300 kg of wood, 60 kg of deadfall a year and 36 logs, with 10 kg of crown wood per felled tree; an outcrop 60 stones. Picking retains Life 11's stock-dependent slowdown: the skill-adjusted full rate is multiplied by the remembered fraction of capacity remaining, rounded down, when the task starts. That rate stays fixed until the next wake-up; production is capped at the stock remaining when credited.

Bank points come from the mesh: each shore edge between a walkable triangle and a water triangle gives at most one bank point, set back half a metre (or `reachCm`, if less) from the edge's midpoint into the walkable side and kept by Life 11's approach rule (within `reachCm` of the water, no higher above it than `drinkBankHeightCm`). It carries its body, the triangle holding it, and as its id the edge's half-edge number, three times its triangle plus the edge.

### Stocks, fish and regrowth

Once a day at midnight, each resource place receives its day's share of its yearly regrowth, `floor(a*(d+1)/D) - floor(a*d/D)` for yearly amount `a` on day `d` of a `D`-day year, capped at capacity. Felled stands regain a tree's logs after `treeRegrowthYears`, converted to days by the setting. Fish per lake and reach keep Life 11's capacity and logistic growth, applied once a day with the yearly percentage divided over `D` days and an exact carried remainder; a depleted body is not reseeded. Hut weathering is day-anchored: one log every `hutLogDays`.

## Time

### The clock

The run starts at minute 0, midnight of day 0 of year 0. A day is 1,440 minutes; dawn is minute 360 and dusk minute 1,080 of each day; a year is `daysPerYear` days. Day and year are derived from the minute; nothing stores them.

### Wake-ups

The state holds a queue of wake-ups `(minute, phase, id)`. Phases, in order within a minute: `world` (daily regrowth, spoilage, invariants at midnight; fires at each hour), then `person`, ordered by id. `stepValley(state, toMinute)` pops and runs wake-ups until the queue's head is past `toMinute`, and is pure: it returns a new state and the events of the interval.

A person's wake-up is scheduled by:

- **task end**: a walk arrives, a load is full, a thicket is emptied at the current rate, an axe or hut log is finished, sleep ends at dawn, a rest ends after an hour;
- **body threshold**: when a task starts, the minute at which energy or water will cross the next threshold (hungry, thirsty, severely thirsty, fatal) is computed from the task's rates and scheduled if it falls before the task's end;
- **arrival in the chunk**: a walker whose route enters a chunk wakes every person in that chunk whose task is interruptible (anything but sleep without severe thirst) at the minute of entry; the chunk a walk starts in is not entered;
- **address**: a meeting, an exchange offer, an axe request or a delivery at the end of the addresser's wake-up wakes the addressee in the same minute, in the `person` phase after the addresser.

A wake-up removes the person's other pending entries; a person has at most one future task end and one future threshold in the queue.

### Between wake-ups

A person's record holds the task, its start minute, its route (for a walk) and the body at its start. Position at minute `m` is the point along the route at the distance walked by `m` at each segment's speed; for other tasks it is the place. Energy and water at `m` are the start values less the task's rates over `m - start`, with the start's remainders. The observer and perception read these functions; nothing stores a per-minute body.

### Cadences

| System | Cadence |
| --- | --- |
| Resource and fish regrowth, spoilage of carried lots, hut weathering, practice update | Daily at midnight, `world` phase |
| Group and personal fires | Hourly at night, `world` phase |
| Bodies | Lazily, at the person's wake-ups |
| Conservation checks | At every event that moves food, wood, logs, stones, axes or water |
| Full invariants | Daily at midnight, and at the end of every `stepValley` call in checked runs |

### Days per year

`daysPerYear` is a run setting from 8 to 365, default 90. Every duration and rate in the configuration is classified:

- **Day-anchored**, unchanged by the setting: sleep (dusk to dawn), the hour of rest, picking, gathering, chopping, drinking and making rates, spoilage of berries, nuts and fish, firewood per night, hut weathering days, the 30-day practice window, the 24-hour memory of heard terms and the 24-hour recheck of sites.
- **Year-anchored**, scaled by the setting: regrowth of berries, nuts, wood and deadfall per year, fish growth per year, tree regrowth in years, and the displayed calendar.

A year-anchored duration is never shorter than one day. At 8 days a year a stand regrows its logs in 160 days and a hazel thicket its whole stock in a week; nothing else changes in this step.

### Streams

Every draw comes from a stream derived from the seed and a name: the terrain and layout streams as in Life 11; `founder:<id>` for a founder's start and born skills; `axe:<maker>:<n>` for an axe's quality. Nothing is drawn per minute. The mesh draws nothing. Turn order needs no stream.

## Knowledge and perception

A person remembers: places, with kind, position, the stock last seen and the minute it was seen; bank points; the triangles of the mesh it has seen, land or water; people it has met, with the minute; heard exchange terms for 24 hours; its group, flag, hearth and hut.

At every wake-up a person observes: every place and bank point within `sightRadiusCm` (1 km) of its position becomes known, with position and kind; the place it stands at shows its stock; every triangle whose centroid lies within the sight radius becomes known, with its area type; people within `talkRadiusCm` (20 m) are met. A chunk lying wholly within the sight radius marks all its triangles at once and is remembered as seen whole. Relief does not block sight. A stock not yet seen is expected full; a fish stock is learnt only by fishing.

Triangle knowledge is a bit per triangle. It is shared with the previous state and copied only when the person learns a new triangle, as bank memory is. A walker observes at its wake-ups only, so it learns the land along its route at arrival, not continuously; what it saw at departure and what it sees at arrival are both recorded.

## Routes and movement

A person may walk on triangles whose area type its walking mask allows; in this step the mask is `ground` alone for everyone. Water triangles are part of the map and of knowledge but cannot be entered. People are points: a route may run along a shore edge or through a shore vertex, and the closed walkable triangles are walkable ground.

A route from a start to a target is found when a walk starts:

1. **Corridor.** A\* over the triangles the person knows and may walk on, from the triangle holding the start to the one holding the target, stepping between neighbours across their shared edge. A step's cost is the distance between the midpoints of the edges crossed (the start and target points at the ends), the heuristic the straight-line distance to the target, ties by triangle id. If the target's triangle is unknown or unreachable, the person walks to the nearest known frontier, a known walkable triangle with an unknown neighbour, by straight-line distance, ties by triangle id; with no frontier it rests with `no known route` recorded.
2. **Path.** The funnel algorithm pulls the corridor tight into the shortest polyline within it, from the start through corridor vertices to the target. Its corners are mesh vertices, so they are integers.
3. **Segments.** The polyline is cut wherever it crosses a triangle edge, so each piece lies in one flat triangle. A cut point is rounded to whole centimetres, and kept at least 1 cm from the ends of the edge it lies on, so it stays inside the corridor. Each piece has a length, a slope from its triangle's plane along its direction (flat below 10%, moderate to 30%, steep above), its triangle's ground class, and a speed.

Flat loaded speed is `max(1, floor(walkCmPerSecond * (1,000*bodyKg - loadSlowdownPerMille*loadKg) / (1,000*bodyKg)))`; moderate slopes divide it by `moderateSlowdownPerMille/1,000` uphill and cost nothing extra downhill; steep slopes halve it uphill and divide by `steepDownSlowdownPerMille/1,000` downhill. Ground multiplies time by Life 11's terrain percentages. Walking costs `walkKcalPerHour` on the flat, one and a half times that on moderate uphill and twice on steep; downhill costs the flat rate. A walk's duration is summed over its segments in integer 1/60,000-minute units and rounded up to a whole minute only at its end; the fraction after arrival is charged at the standing rate, and energy and activity-water accounting carry the integer duration remainders. Routes are cached per person by endpoints, knowledge revision and load, and kept in the state for replay.

Travel estimates for choosing targets use straight-line distance at flat speed plus a climb allowance of `climbMinutesPerMetre`, as a lower bound, with heights from the mesh; the chosen target's real route is then searched.

## People

Each person is one object: position, task record, energy and water with their remainders, carried food lots, carried wood, carried log, stones, axe, hut, group, born skills, practice and alive. Its memories (places, their stocks and check times, triangles seen, bank points, people met) are typed arrays, bitsets and maps inside it, never read by the checker as truth.

Founders are `founders` people, 40 by default, placed from their own streams within the central `startAreaCm` (800 m) on walkable grass or dirt of the main land with Life 11's spacing when `scattered`, or at the nearest valid camp of the main land with room for their hearth slots when together. Born foraging and wood skill range from 75% to 125%; born craft is 100%. Everyone starts with 66,000 kcal, no water deficit, nothing carried and no relationships.

## Tasks

| Task | Ends when | Rates per hour (kcal, ml) |
| --- | --- | --- |
| Walk | Route's last segment arrives | by slope class above; water as Life 11's activity allowance |
| Pick berries, gather nuts, fish | Carried reserve room is full, the stock at the current rate is exhausted, or dusk return is due | `pickKcalPerHour` |
| Drink | Deficit is below `drinkStopMl` | `restKcalPerHour` |
| Gather wood | Load is full or the stock is exhausted | `gatherKcalPerHour` |
| Cut a log | `logChopMinutes` scaled by axe quality | `chopKcalPerHour` |
| Make an axe | `axeHours` scaled by craft, pausable | `makeKcalPerHour` |
| Rest | One hour, or an interruption | `restKcalPerHour` |
| Sleep | Dawn, or severe thirst | by hut and fire, as Life 11 |

Water loss is `waterBaseMlPerDay/1,440` a minute plus `waterExtraMlPerKcal` per kcal above resting, with the exact remainders of Life 11. A task's rates are constant for its length, which is what lets thresholds be computed at its start. Eating happens at wake-ups: oldest lots first, up to reserve capacity, before the next task is chosen; food picked during a task is credited at its end.

## A wake-up

1. Pay the body for the minutes since the last wake-up, at the ended task's rates; credit what the task produced; record the task's events. If a fatal threshold was crossed, record the death at that minute and stop.
2. Spoil carried lots past their life; eat oldest first up to reserve capacity.
3. Observe, as above. Meet people within talking distance: found or join a group, hear terms, exchange wood for food, request or promise an axe, deliver hut logs, contribute to the group's fire, as Life 11's meeting phase does.
4. Update needs: hunger, thirst and wood need with Life 11's thresholds and hysteresis.
5. Choose the next task by the priorities below, using only memory.
6. Start it: search its route if it is a walk, schedule its end and its first body threshold, record the task start.

## Priorities

Choose the first applicable rule.

| Priority | Condition | Action |
| --- | --- | --- |
| 1 | Severe thirst, day or night | Drink at a reachable bank, else walk to the nearest known accessible bank, else explore a reachable frontier for water. Interrupts any load or journey. |
| 2 | Away from home and night, or the route home uses the remaining daylight | Walk home by the known route; explore to recover one if there is none. |
| 3 | Night | Sleep. Ordinary thirst waits; severe thirst wakes. |
| 4 | Thirsty in daylight | Drink or seek water, leaving time to return before dusk; if no eligible bank is known, search a frontier; if too late, return home or rest. |
| 5 | Carrying a log | Take it home. |
| 6 | Not hungry and filling or carrying a wood load | Finish the load, or take a full load home. |
| 7 | Neither hungry nor short of wood, without a group | Approach a seen person or a reachable known flag; otherwise explore. |
| 8 | A member with neither food nor wood need | Finish an axe; otherwise cut hut logs if equipped; otherwise buy a worthwhile known axe or make one, fetching a stone and wood first. |
| 9 | Neither food nor wood need | Explore the nearest reachable unseen frontier, or recheck a reachable place after 24 hours; rest when none is available. |
| 10 | Food or wood needed | Choose productive gathering or an advantageous local exchange; search if no remembered source is worth working; otherwise rest with the reason recorded. |

Food choice scores one hour's expected food at a remembered place as `3,600 * rate / (estimatedWalkSeconds + 3,600)`, from the stock last seen and the estimate above; fish candidates need a known accessible bank. Work must leave time to return home before dusk, except drinking under severe thirst.

## Food, wood, shelter and exchange

As Life 11: food in timestamped lots by kind, berries spoiling after 48 hours, nuts after 4,380 and fish after 24; energy starting at 66,000 kcal, capped at 70,000, hungry below 64,000 and satisfied at 68,000; wood need below one night's firewood, cleared at two; loads of 30 kg and logs of 35 kg; groups founded by two ungrouped people within 20 m, joined by a lone person, with a flag, a common fire burning 1 kg an hour at night, and a 23-log hut per member weathering a log every 60 days; axes from one stone and 1 kg of wood, quality drawn from half to all of craft, cutting a log in 30 minutes at quality 100 and lasting 200 logs; practice over the last 30 days; wood-for-food swaps at the midpoint of the two parties' production ratios; axes asked at the maker's extra energy and bought when buying gains food energy. There is no money, no ownership of water, no forced sharing and no planned specialisation.

## Defaults and configuration validation

Run settings, read from the Life page before the first minute and otherwise from the configuration:

| Setting | Default | Range |
| --- | --- | --- |
| `seed` | 20260813 | any integer |
| `daysPerYear` | 90 | 8 to 365 |
| `worldKm` | 4 | 1 to 10 |
| `founders` | 40 | 1 to 1,000; the page allows 1 to 100 |
| `scattered` | true | |

`worldKm` sets `valleySizeCm`. A world of another size than 4 km keeps the density of places and landforms: every count of thickets, hazel thickets, stands, outcrops and landforms is scaled by the area, rounded, with at least one of each.

New and changed parameters:

| Parameter | Default | Basis |
| --- | --- | --- |
| `meshMaxEdgeCm` | 4,000 | The largest relief square, 40 m: small enough that a triangle's seen centroid stands for all of it, and divides every whole-kilometre world. |
| `meshHeightToleranceCm` | 100 | Heights within a metre keep every slope class right on the gentle and moderate ground people mostly cross; the measured triangle count is reported at implementation. |
| `shoreToleranceCm` | 100 | A shore within a metre of the hydrology's; drinking needs only `reachCm`. |

Removed: `routeCellCm` and the route lattice. All other Life 12 defaults are retained with their values.

Validation rejects non-integers, non-finite values and unsafe products; settings outside their ranges; `meshMaxEdgeCm` that is not `terrainCellCm` times a power of two or does not divide `valleySizeCm`; `chunkCm` that is not a multiple of `meshMaxEdgeCm`; tolerances that are not positive; negative stocks, rates or counts; invalid threshold ordering; and impossible placement. Building the layout, which needs the mesh, rejects a start area whose main land cannot hold the founders at the start spacing, or with no main land at all, with a specific message. Year-anchored amounts are converted with exact arithmetic and carried remainders.

## Invariants and ledger

The checker replays the events of each `stepValley` interval against the state in checked runs, validates immutable geography once, and runs the full set at every midnight.

- **The mesh, once per layout:** triangles are counter-clockwise and non-degenerate, their areas sum to the valley's, neighbours are mutual, every shore edge has a water triangle on one side and a ground triangle on the other, and every edge between ground and water is a shore edge, every shore vertex's height is its water's level, the shoreline lies within `shoreToleranceCm` of the hydrology's and heights within `meshHeightToleranceCm` of the terrain's, and every place footprint and bank point lies on walkable ground.
- Every wake-up's body charge equals the task's rates over its minutes, with bounded remainders; energy and water at a wake-up equal the lazy functions evaluated there.
- Every person's position at every recorded minute is on walkable ground, and every route segment lies in walkable triangles the person knew when the walk started. Nobody is at two places, and the chunk index agrees with positions.
- Food, wood, logs, stones and axes conserve at every event: produced equals eaten plus carried plus stored plus spoiled plus retained on death; fish and thicket stocks replay from regrowth and takes; water withdrawals equal recorded drinks.
- The queue holds at most one task end and one threshold per living person; no wake-up is in the past; dead people have none.
- Every decision reads memory only: a known place, bank or triangle was observed at a recorded wake-up before it was used.
- Hunger and thirst hysteresis, death minute and cause, and group dissolution below two living members follow the stated order.

Events: task start and end with produced amounts, walk with its route id, observation, meeting, exchange, axe request, promise, delivery, drink, death with cause, group founded, joined and dissolved, fire decisions, and daily regrowth per place. Daily summaries per person and per group as Life 11, with the day's wake-up count. World metrics add wake-ups per day and minutes advanced per second of wall time.

## Observer

Label the page **Life 13 · strangers**. The settings screen, loading card, header, history panel, person panel, group card and playback are as Life 12: playback from one minute a second upward, one state and a continuous displayed minute, people hidden from a day a second up, places drawn as decoration in proportion to their stock.

The landscape is the mesh. Ground triangles are drawn flat-shaded at their vertices' heights, one colour per triangle from its ground class, with a small fixed variation per triangle from its id so neighbouring triangles read apart; the variation uses no simulation stream. Water triangles are drawn at their surface level, coloured by depth. Everything placed on the ground, people, bushes, trees, rocks, huts and flags, takes its height from the mesh. The land map draws the same triangles from above. A person's route is drawn as its polyline. The Flow overlay and the remembered banks keep Life 12's meaning.

## Code layout

- New `src/valley/mesh.ts`: shoreline simplification, the relief quadtree, the constrained triangulation, area types, neighbours, the bucket index, regions, height and point location, and the mesh checks. It replaces the bank patches of `banks.ts`, which keeps the hydrology's shoreline extraction and the bank-approach rule.
- `routes.ts`: triangle A\*, the funnel, segment cutting and timing, frontiers; the 20 m lattice is removed. `perception.ts`: triangle knowledge and its copy-on-write. `layout.ts`, `social.ts`, `forager.ts`, `bankSearch.ts`: walkability, heights and banks from the mesh; founders on the main land.
- `types.ts`, `config.ts`: the mesh in the immutable layout, triangle knowledge in each person, the new parameters and their validation.
- `invariants.ts`, `replay.ts`: the mesh checks and walkable-ground checks above.
- `src/valleyView/`: the scene's ground and water built from the mesh, flat-shaded; ground contact for objects from the mesh; the land map from the mesh. The sampled ground and water surfaces it replaces are removed.

The terrain and hydrology generators (`terrain.ts`, `water.ts`) are unchanged. The MVP9 core is unchanged. Immutable geography and caches live outside mutable state; cache warmth never changes a result.

## Tests and implementation acceptance

The Life 12 fingerprint suite passes before engine edits. Every trajectory changes, because routes, banks and place layout change: this step records new fingerprints for all its configurations. Fingerprints are not updated to conceal a failed rule.

Unit fixtures:

1. Mesh: a fixture terrain with one lake and one river gives triangles covering the square exactly, lake triangles flat at the lake's level, shore edges as constraints with water on their wet side, and a flat field of 40 m triangles; a bump raises the vertex count only round it.
2. Small water: a 5 m pond beside a straight walk bends the route only by the pond's width, where Life 12's lattice blocked a 20 m cell.
3. Routes: a lake between person and target bends the route round its shore through shore vertices; an unseen dry crossing is not used; seeing new triangles shortens the next route; a route never enters a water triangle; the funnel path is no longer than the corridor's midpoint path.
4. Segments: a walk over a fixture hill is cut at triangle edges, its pieces take the slope classes and times stated, and every cut point lies on its edge, within the corridor.
5. Height: the mesh's height equals the vertices' heights at vertices and is linear within a triangle.
6. Knowledge: a person sees the triangles within the sight radius and nothing beyond; a clone shares the knowledge until a new triangle is seen, and the original never changes.
7. Founders start on the main land; bank points lie on walkable ground within reach of their water.
8. The checker rejects a route through water, a position on a water triangle, a shore edge with the same area type on both sides, and the Life 12 corruptions: a body charge, a position off a route, a stale queue entry, a decision using an unobserved place, a regrowth that overshoots.
9. The existing queue, lazy-body, places, anchoring, interruption, food, fire, hut, axe, trade and group tests, on the mesh.

Final validation is `npm run agent:check`. Measured once and recorded in the lab notes: the mesh's vertex and triangle counts and build time at 4 km and 10 km, the main land's share, founders on it, rests with `no known route` over four days against Life 12, and the year of forty. In the browser: the low-poly landscape at a minute a second with a person walking a straight line past small ponds, a lake shore, then the map at a year in seconds; the console clean.

## Questions for later

- What costs and depths should wading, swimming and boats have, and which area types and depths does each allow?
- Should the landscape be drawn smooth-shaded, from the same mesh, once the art is chosen?
- Does midpoint A\* choose a noticeably longer corridor than the shortest in open land, and is a better corridor search worth its cost?
- Does losing relief-blocked sight change exploration and encounter patterns enough to bring occlusion back at the chunk level?
- How do survival, grouping and hut building at forty founders compare with eight, by the same patterns?
- What default year, within 60 to 120 days, makes seasons long enough to matter?
- At what population does triangle knowledge, not the wake-up, become the cost?

## Left out

Wading, swimming and boats; paths worn by walking; obstacles that change the mesh during a run (huts, felled trees); people with a width; relief-blocked sight; seasons, weather and varying day length; bodies and personality beyond born skill; relationships, conflict and influence; births, ageing and death from age; herds, hunting and planting; property; recipes beyond axes and huts. Rust or WebAssembly is not planned.

## References

- Garland, M. and Heckbert, P. (1995), *Fast polygonal approximation of terrains and height fields*: triangulated irregular networks that refine where relief demands.
- Chew, L. P. (1987), *Constrained Delaunay triangulations*: triangulating points with required edges, here the shores.
- Mononen, M. (2010), the "simple stupid funnel algorithm", and Recast & Detour, the navigation-mesh library Unity's NavMesh derives from: corridor search over polygons, then the funnel.
- Douglas, D. and Peucker, T. (1973): line simplification for the shorelines.
- Magnitudes for walking, slopes, loads, foods, fish, wood, shelter and tools remain in [CALIBRATION.md](CALIBRATION.md). Terrain and water references remain those of Life 10 and Life 11, in the changelog and lab notes.
