# [LIFE12-Refoundation-055]

**Approved for implementation by the owner on 2026-10-23.** This specification replaces the Life 11 specification and describes the whole simulation. It is the first step of the [roadmap](ROADMAP.md) of 2026-10-23 and is built under the [Life section](../SIMULATION_DESIGN_RULES.md#life-realism-and-time) of the design rules. It is implemented as two pull requests under this one specification: first the clock, places, routes and observer with Life 11's eight people; then the run settings and the forty founders.

Forty strangers are dropped on 4 km square of young glacial land in Mesolithic northern Europe: drumlins, moraine fronts, kames, hummocks, kettle hollows and tunnel valleys, with lakes in the hollows and rivers running downhill to the edge. The ground is grass, dirt and stone. People discover drinking banks, drink, pick berries, gather hazelnuts, fish, gather firewood, meet, form groups, exchange wood and axes for food, and build huts around shared fires. Their knowledge comes from observation and memory.

Time is one clock in minutes. Nobody is stepped: a person is woken when their task ends, a body threshold arrives, someone enters their chunk, or someone addresses them, and their position and body at any minute follow from their task. A year has as many days as the run's settings say, from 8 to 365. Lengths are integer centimetres, food integer kilocalories, wood integer kilograms, water deficit integer millilitres, and fractional amounts accumulate in integer remainders. `stepValley` advances the state to a target minute, is pure and deterministic, and every random draw comes from a named derived stream. The observer displays real records and interpolates movement between them.

## What Life 12 makes possible

- **Any speed, one simulation.** The same run can be watched at a minute a second, with people walking continuously, or at years a second showing the map. There is no second rule set.
- **History-length runs.** A year of forty people runs in about a second, so the generations, seasons and groups of the later steps have room to happen.
- **Compressed time without fudges.** Days per year is one setting; every duration is day-anchored or year-anchored, and the engine applies the setting in one place.
- **A founding population.** Forty strangers who start with no relationships, so that whatever structure the later social steps produce was made inside the run.

This step changes how time, space and plants are represented. It does not change what people want or how they decide: Life 11's priorities, food, wood, shelter, axes, groups and exchange carry over, simplified where the realism rules remove formulas. It adds no new behaviour, so that the fingerprints of the second pull request can be compared with Life 11's trajectories by pattern.

## Checked against

| Measure | Evidence and comparison | Status |
| --- | --- | --- |
| Speed | A year of eight people in well under a second and of forty in about a second, on an ordinary laptop in Node, measured by the existing validation timings. | Pattern target, not a benchmark; no sweep. Not met by the first pull request: a canonical year of eight takes about 5 to 8 seconds, and creating the valley 5 to 12 more (see the lab notes). |
| Survival and settlement | Over Life 11's canonical year, the share of founders alive, the number of groups and the number of finished huts are of the same order as Life 11's. | Pattern comparison; an exact match is impossible and not sought. |
| Continuity | At a minute a second, no person jumps: every displayed position lies on a recorded route between recorded minutes. | Observer check. |
| Lazy bodies | Energy and water at any minute, computed from the task, equal what stepping the task minute by minute would give. | Unit test. |
| Anchoring | A run at 8 days a year and a run at 365 have the same sleep, meals and walks per day, and regrowth per year within rounding. | Unit test. |
| Walking | About 4.5 km/h on the flat, halved on steep ground, slowed by load: the magnitudes in [CALIBRATION.md](CALIBRATION.md). | Magnitudes, not formulas. |

## Design decisions

| Decision | Reason |
| --- | --- |
| One clock in minutes with wake-ups, not a tick per minute. | The minute keeps motion continuous and every record timestamped; computing only at wake-ups is what makes a year cheap. One rule set at every speed is the roadmap's time principle. |
| Order wake-ups by minute, phase, then person id. | Fully deterministic without a per-minute shuffle. Fairness between people comes from their own thresholds, not from turn order. |
| Thickets, stands and outcrops carry one stock each. | Nobody decides anything about one bush (realism rule 3). Capacities and regrowth are the sums of Life 11's individuals, so magnitudes are unchanged. |
| Routes on a 20 m lattice of known dry ground, computed when a task starts. | Water still has to be walked around and agents still get no hidden map; the lattice is sixteen times smaller than the 5 m one and searched once per journey, not every minute. |
| Walking cost by three slope classes and a load factor. | The magnitudes Tobler and Pandolf give, without the formulas (realism rule 2). |
| Sleep by the clock, dusk to dawn. | As Life 11. Tiredness-driven sleep explains nothing until nights change length at step 18. |
| Perception at wake-ups: places in sight become known, the place one stands at shows its stock, and a walker entering a chunk wakes the people in it. | Agents still know only what they have seen; interruption by arrivals keeps meeting and approaching possible without stepping anyone. |
| Days per year as a run setting with one anchoring rule. | Realism rule 4. In this step only regrowth, fish growth, tree regrowth and the displayed calendar depend on it; seasons arrive at step 18. |
| Keep Life 11's priorities, body thresholds, food lots, spoilage, groups, fires, huts, axes and exchange. | The step changes representation, not behaviour, so that its effect can be seen. |
| Founders are forty, scattered, with Life 11's born-skill spread. | Enough for the cliques and rivals of steps 13 to 16, few enough to watch; scattered so that every relationship starts at zero. |

## World

### Terrain, water and ground

Terrain, drainage, lakes, river reaches, the continuous bank surface, wet polygons, bank points and ground classes are generated exactly as in Life 11, from the same eleven terrain streams and the same parameters, over a square `valleySizeCm` across. The world size setting sets `valleySizeCm` in whole kilometres from 1 to 10; landform counts scale with area, rounded down, so that density is the same at every size. Water remains an external reservoir: drinking withdrawals are recorded and lower nothing.

The land is held in chunks of `chunkCm` (200 m). A chunk indexes its places, its bank points and the people currently in it.

### Places

A place is a thing someone can decide to go to. Each has an id, a kind, a position on dry ground, a chunk, and for resource places one stock. Kinds:

| Kind | Stock | Count on 4 km | From Life 11 |
| --- | --- | --- | --- |
| Berry thicket | kcal of berries, wood in dead stems | 800 | 60 bushes |
| Hazel thicket | kcal of nuts | 800 | 40 hazels |
| Tree stand | kg of deadfall wood, standing logs | 300 | 12 trees |
| Outcrop | stones | 100 | 12 spots of 5 stones |
| Drinking bank, fishing bank | none; the water body holds the fish | from geometry | as Life 11 |
| Hearth, flag, hut site | the group's fire wood; the hut's logs | made by people | as Life 11 |

Places are laid out by the layout stream with Life 11's spacing and dry-footprint rejection. A thicket's capacity, initial stock and yearly regrowth are the sums over its former individuals: a berry thicket holds up to 3,120 kcal and regrows 54,000 kcal a year; a hazel thicket 75,000 kcal and 150,000 a year; a stand 300 kg of wood, 60 kg of deadfall a year and 36 logs, with 10 kg of crown wood per felled tree; an outcrop 60 stones. Picking retains Life 11's stock-dependent slowdown: the skill-adjusted full rate is multiplied by the remembered fraction of capacity remaining, rounded down, when the task starts. That rate stays fixed until the next wake-up; production is capped at the stock remaining when credited. The owner confirmed this reading during implementation on 2026-10-23.

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
- **arrival in the chunk**: a walker whose route enters a chunk wakes every person in that chunk whose task is interruptible (anything but sleep without severe thirst) at the minute of entry;
- **address**: a meeting, an exchange offer, an axe request or a delivery at the end of the addresser's wake-up wakes the addressee in the same minute, in the `person` phase after the addresser.

A wake-up removes the person's other pending entries; a person has at most one future task end and one future threshold in the queue.

### Between wake-ups

A person's record holds the task, its start minute, its route (for a walk) and the body at its start. Position at minute `m` is the point along the route at the distance walked by `m` at the segment's speed; for other tasks it is the place. Energy and water at `m` are the start values less the task's rates over `m - start`, with the start's remainders. The observer and perception read these functions; nothing stores a per-minute body.

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

A year-anchored duration is never shorter than one day. At 8 days a year a stand regrows its logs in 160 days and a hazel thicket its whole stock in a week; nothing else changes in this step. From step 17 on, pregnancy, childhood and ageing join the year-anchored list, and short years make lives short in days while nights stay eight hours; each later specification lists what turns strange.

### Streams

Every draw comes from a stream derived from the seed and a name: the terrain and layout streams as in Life 11; `founder:<id>` for a founder's start and born skills; `axe:<maker>:<n>` for an axe's quality. Nothing is drawn per minute. Turn order needs no stream.

## Knowledge and perception

A person remembers: places, with kind, position, the stock last seen and the minute it was seen; bank points; the dry or wet state of route-lattice nodes it has seen; people it has met, with the minute; heard exchange terms for 24 hours; its group, flag, hearth and hut.

At every wake-up a person observes: every place and bank point within `sightRadiusCm` (1 km) of its position becomes known, with position and kind; the place it stands at shows its stock; route-lattice nodes within the sight radius become known dry or wet; people within `talkRadiusCm` (20 m) are met. Relief does not block sight in this step (it did in Life 11; the loss is listed under questions for later). A stock not yet seen is expected full; a fish stock is learnt only by fishing.

A walker observes at its wake-ups only, so it learns the land along its route at arrival, not continuously; what it saw at departure and what it sees at arrival are both recorded.

## Routes and movement

Routes run on a lattice of `routeCellCm` (20 m) nodes. A node is dry if its footprint is free of wet polygons; a diagonal edge needs both adjoining cardinal nodes dry. A person routes only over nodes it knows to be dry, by deterministic A* with an integer octile heuristic, ties by node id, computed when a walk starts and cached by endpoints and the person's knowledge revision. A target with no known route is approached through the nearest known frontier, as in Life 11; a person with no frontier rests with `no known route` recorded.

A route is a polyline of node centres with a connector at each end. Each segment has a length, a slope class from the terrain heights at its ends (flat below 10%, moderate to 30%, steep above), a ground class, and a speed. Flat loaded speed is `max(1, floor(walkCmPerSecond * (1,000*bodyKg - loadSlowdownPerMille*loadKg) / (1,000*bodyKg)))`; moderate slopes divide it by `moderateSlowdownPerMille/1,000` uphill and cost nothing extra downhill; steep slopes halve it uphill and divide by `steepDownSlowdownPerMille/1,000` downhill. Ground multiplies time by Life 11's terrain percentages. Walking costs `walkKcalPerHour` on the flat, one and a half times that on moderate uphill and twice on steep; downhill costs the flat rate. Route edges retain integer fixed-point fractions of a minute; their travel time is accumulated and the journey's end is rounded up once. The owner approved preserving the configured walking pace during implementation on 2026-10-23: rounding each 20 m edge up to a minute would make a flat 1 km grass walk take 50 minutes rather than 16. The route retains every edge for collision and interpolation. The fraction between physical arrival and the rounded wake-up is standing time. Energy and activity-water accounting carry the additional integer duration remainders.

A walk’s duration is summed over its segments in integer 1/60,000-minute units and rounded up to a whole minute only at its end, so the 20 m edges do not each round up and slow people; the fraction after arrival is charged at the standing rate.

Travel estimates for choosing targets use straight-line distance at flat speed plus a climb allowance of `climbMinutesPerMetre`, as a lower bound; the chosen target's real route is then searched. There is no per-second accounting, no grade table and no energy equation.

## People

Each person is one object: position, task record, energy and water with their remainders, carried food lots, carried wood, carried log, stones, axe, hut, group, born skills, practice and alive. Its memories (places, their stocks and check times, route-lattice nodes, people met) are typed arrays and maps inside it, never read by the checker as truth. Column storage indexed by id is left until a later step needs it.

Founders are `founders` people, 8 by default in the first pull request and 40 from the second, placed from their own streams within the central `startAreaCm` (800 m) on dry grass or dirt with Life 11's spacing when `scattered`, or at the nearest valid dry camp with room for their hearth slots when together. Born foraging and wood skill range from 75% to 125%; born craft is 100%. Everyone starts with 66,000 kcal, no water deficit, nothing carried and no relationships: the people they have met is an empty list.

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
| 9 | Neither food nor wood need | Explore the nearest reachable unseen frontier, or recheck a place after 24 hours; rest when none is available. |
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
| `founders` | 8 (40 from the second pull request) | 1 to 1,000 |
| `scattered` | true | |

New and changed parameters:

| Parameter | Default | Basis |
| --- | --- | --- |
| `routeCellCm` | 2,000 | Route lattice; 20 m resolves the water bodies the 5 m lattice did at a sixteenth of the nodes. |
| `moderateSlowdownPerMille`, `steepDownSlowdownPerMille` | 1,300, 1,300 | Magnitudes of slope slowdown from Tobler's function at 10 to 30% and at steep descents. |
| `walkKcalPerHour` | 250 | Flat loaded walking, the magnitude Pandolf gives for 60 kg at 4.5 km/h. |
| `climbMinutesPerMetre` | 1 | Estimate allowance per metre of climb; `climbSecondsPerMetre` is removed. |
| `treeRegrowthYears` | 20 | Replaces `treeRegrowthDays`. |
| Thicket, stand and outcrop stocks | the sums above | Replace per-bush, per-hazel, per-tree and per-stone capacities, initial stocks and regrowth. |

Removed: `terrainCellCm` as a movement resolution (it remains the hydrology lattice), `eyeHeightCm`, `sightStepCm`, `climbSecondsPerMetre`, `treeRegrowthDays`, `bushesPerThicket`, `hazelsPerThicket`, `treesPerStand`, `stonesPerOutcrop`, `bushSpacingCm`, `hazelSpacingCm`, `treeSpacingCm`, `stoneSpacingCm`, `stonesPerSpot`, and the Tobler and Pandolf tables. `bandSize` becomes `founders`. `logsPerTree` (3) is kept: a stand’s log stock counts in bundles of three logs, each a former tree with its own felling minute and regrowth, and the first cut of a bundle adds its crown wood. All other Life 11 defaults are retained with their values.

Validation rejects non-integers, non-finite values and unsafe products; settings outside their ranges; `routeCellCm` not a multiple of `terrainCellCm` and `chunkCm` not a multiple of `routeCellCm`; negative stocks, rates or counts; invalid threshold ordering; impossible placement; and more founders than the start area can hold at the start spacing, with a specific message. Year-anchored amounts are converted with exact arithmetic and carried remainders; no per-day amount is rounded before accumulation.

## Invariants and ledger

The checker replays the events of each `stepValley` interval against the state in checked runs, validates immutable geography once, and runs the full set at every midnight.

- Every wake-up's body charge equals the task's rates over its minutes, with bounded remainders; energy and water at a wake-up equal the lazy functions evaluated there.
- Every person's position at every recorded minute is on dry ground, and every route segment avoids water. Nobody is at two places, and the chunk index agrees with positions.
- Food, wood, logs, stones and axes conserve at every event: produced equals eaten plus carried plus stored plus spoiled plus retained on death; fish and thicket stocks replay from regrowth and takes; water withdrawals equal recorded drinks.
- The queue holds at most one task end and one threshold per living person; no wake-up is in the past; dead people have none.
- Every decision reads memory only: a known place, bank or node was observed at a recorded wake-up before it was used.
- Hunger and thirst hysteresis, death minute and cause, and group dissolution below two living members follow the stated order.

Events: task start and end with produced amounts, walk with its route id, observation, meeting, exchange, axe request, promise, delivery, drink, death with cause, group founded, joined and dissolved, fire decisions, and daily regrowth per place. Daily summaries per person and per group as Life 11, with the day's wake-up count. World metrics add wake-ups per day and minutes advanced per second of wall time.

## Observer

Label the page **Life 12 · strangers**. The header shows the day, year and season name (the four quarters of the year). The run settings with their ranges and a Start button, fixed after the first minute, arrive with the second pull request; the first keeps Life 11’s setup form and Reset.

Playback runs from one minute a second upward. The view keeps one state and a continuous displayed minute within the minute that state has reached: every wake-up up to the drawn minute has run and none after it, so each person is drawn from the task under way, at the position its route gives, never along the chord. Each frame runs the engine once; the minutes a frame may run double while steps fit the frame budget and halve when they do not, because copying the state is a fixed cost of every step. From `mapSpeedMinutesPerSecond` (a day a second) up, the view stops drawing people and gestures and shows the map with places, stocks, groups and huts. Places are drawn as decoration, a fixed number of bushes, hazels, trees or rocks per place that share out its stock in turn, so what is drawn stays in proportion to what is there; the decoration uses no simulation stream.

The person panel shows the current task, its start and expected end, the route, energy, water deficit and thirst, carried lots, skills, group, hut, the last wake-up's reason and the next scheduled one. The group card and the land map keep Life 11's content. Labels stay the observer's: "group" is a measurement of flags and members, and the engine stores no name for anything above the person.

## Code layout

- `src/valley/types.ts`, `config.ts`: run settings, places, typed-array person state, the queue, task records, removal of per-plant and formula parameters.
- `terrain.ts`, `water.ts`, `layout.ts`: unchanged generation; layout places thickets, stands and outcrops as places. New `places.ts`: kinds, stocks, chunk index.
- New `clock.ts`: the queue, phases, `stepValley(state, toMinute)`, day and year from minutes. New `calendar.ts`: day- and year-anchored conversion from the setting.
- New `tasks.ts`: task kinds, rates, ends, lazy position and body functions, threshold scheduling. `body.ts` replaces `hydration.ts` and the per-second accounting.
- `routes.ts`: the 20 m lattice, known-dry A*, slope classes, segment times; `walkEstimates.ts` and `sight.ts` are removed. New `perception.ts`: observation at wake-ups and chunk arrival. `waterKnowledge.ts` folds into memory.
- `forager.ts`: priorities and food choice, reading memory. `work.ts`, `food.ts`, `fire.ts`, `huts.ts`, `axes.ts`, `trade.ts`, `social.ts`, `practice.ts`: as Life 11, called from wake-ups.
- `invariants.ts`, `theory.ts`: replay of intervals, lazy-body checks, analytic examples.
- `src/valleyView/`: a settings panel, positions by displayed minute, route interpolation, the map mode above the threshold speed, per-place stock drawing, calendar in the header.

The MVP9 core is unchanged. Immutable geography and caches live outside mutable state; cache warmth never changes a result.

## Tests and implementation acceptance

The Life 11 fingerprint suite passes before engine edits. The first pull request records new fingerprints for the eight-person canonical configurations; the second adds the forty-founder canonical run and the settings. Fingerprints are not updated to conceal a failed rule.

Unit fixtures:

1. The queue: wake-ups in the same minute run in phase then id order; `stepValley` to a minute is the same as stepping through every intermediate minute; a person never holds two task ends.
2. Lazy bodies: for each task, energy and water from the task functions at ten minutes equal a minute-by-minute accumulation with the same remainders; the first threshold minute is exact, including the fatal one.
3. Routes: a lake between person and target bends the route, a hidden dry crossing is not used, observing new nodes shortens the next route, and segment minutes by slope class are as stated.
4. Places: a thicket emptied at the hourly rate takes the same hours as Life 11's bushes; daily regrowth sums exactly to the yearly amount at 8, 90 and 365 days a year; a stand regains logs after `treeRegrowthYears`.
5. Anchoring: a day's sleep, meals and spoilage are identical at 8 and 365 days a year.
6. Perception and interruption: a walker entering a chunk wakes a resting person there in the entry minute, not a sleeper; the resting person sees the walker and nothing beyond the sight radius.
7. The checker rejects a corrupted body charge, a position off a route, a route through water, a stale queue entry, a decision using an unobserved place, and a regrowth that overshoots.
8. Purity, repeatability and the existing food, fire, hut, axe, trade and group rule tests, called from wake-ups.

Final validation is `npm run agent:check`. In the browser: a person walking continuously at a minute a second, a day in a few seconds showing the same walk, then the map at a year in seconds; the settings panel rejecting 7 and 366 days; the console clean.

## Questions for later

- Does losing relief-blocked sight change exploration and encounter patterns enough to bring occlusion back at the chunk level?
- Does the 20 m lattice reject passages that matter, such as narrow strips between a lake and a hill?
- How do survival, grouping and hut building at forty founders compare with eight, by the same patterns?
- What default year, within 60 to 120 days, makes seasons long enough to matter at step 18?
- At what population does the queue, not the wake-up, become the cost?

## Left out

Seasons, weather and varying day length; bodies and personality that differ beyond born skill; relationships, conflict and influence; births, ageing and death from age; herds, hunting and planting; property; recipes beyond axes and huts; relief-blocked sight; swimming, boats and paths; and every item of Life 11's left-out list. Rust or WebAssembly is not planned; the typed-array state keeps a later port possible.

## References

Magnitudes for walking, slopes, loads, foods, fish, wood, shelter and tools remain in [CALIBRATION.md](CALIBRATION.md), which this step reduces to magnitudes and sources. Terrain and water references remain those of Life 10 and Life 11, now recorded in the changelog and lab notes.
