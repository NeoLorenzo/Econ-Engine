# [LIFE16-Relationships-072]

**Approved by the owner, 2026-10-29; revised for update 072.** This specification replaces the Life 15 specification and describes the whole simulation. It is step 16 of the [roadmap](ROADMAP.md), relationships, and is built under the [Life section](../SIMULATION_DESIGN_RULES.md#life-realism-and-time) of the design rules. Life 15's update history (planning by pieces, the engine in a worker, lighter wake-ups and simple wayfinding) is recorded in the changelog and the lab notes, entries 066 to 071.

Forty strangers are dropped on 4 km square of young glacial land in Mesolithic northern Europe: drumlins, moraine fronts, kames, hummocks, kettle hollows and tunnel valleys, with lakes in the hollows and rivers running downhill to the edge. The ground is grass, dirt and stone. People discover drinking banks, drink, pick berries, gather hazelnuts, fish, gather firewood, meet, form groups, exchange wood and axes for food, and build huts around shared fires. Their knowledge comes from observation and memory. Each of them is a woman or a man with a body of their own and a personality of their own. They find their way as people do: they remember the ways they walk, take them again, and plan afresh only for somewhere new. From this step each person also remembers the others they know: how much time they have spent together, what has been given between them, and what they hold against them. Someone hungry or short of wood asks the people they know for some, and those who know them well enough give.

Time is one clock in minutes. Nobody is stepped: a person is woken when their task ends, a body threshold arrives, someone enters their chunk, or someone addresses them, and their position and body at any minute follow from their task. A year has as many days as the run's settings say, from 8 to 365. Lengths are integer centimetres, food integer kilocalories, wood integer kilograms, water deficit integer millilitres, and fractional amounts accumulate in integer remainders. `stepValley` advances the state to a target minute, is pure and deterministic, and every random draw comes from a named derived stream. The observer displays real records and interpolates movement between them.

## What Life 16 makes possible

- **People know each other.** Until now a person remembered only the minute they last met someone and where. Each person now holds a **tie** to each person they have spent time with: **familiarity**, the minutes the two have spent close together; **credit**, the balance of what has been given between them, counted in minutes of the person's own work; and **grievance**, what they hold against the other. Ties are held in each person's own memory, at most `tiesRemembered` (150) of them, and fade slowly when nothing renews them.
- **Time together builds familiarity.** Two people who stay within talking distance (20 m) of each other, neither of them walking, become familiar by the minutes they spent there: a night beside neighbouring hearths, an afternoon picking the same thicket, an hour resting by the same fire. Passing on a walk counts for nothing. Co-residence and time spent together are what predict ties among foragers (Apicella et al. 2012; Hill et al. 2011).
- **People ask, and are given.** A person who is hungry with no food in hand, or short of a night's firewood with none to spare, asks the people within talking distance whom they know, the closest tie first, for some of what they visibly carry. This is demand sharing, the common way food moves among foragers (Peterson 1993). The person asked gives if their goodwill towards the asker, their familiarity scaled by their agreeableness, covers what the asker already owes them less anything they owe the asker, plus their grievance. They give what they can spare, up to what the asker lacks.
- **Gifts are remembered, and so are refusals.** A gift is credit in the giver's memory and a debt in the receiver's, each counted as the minutes the gift would take that person to gather themselves. A person who owes someone is more willing to give to them; a person who is owed a lot by someone is less willing. A refusal adds to the asker's grievance against the one who refused. Nothing in the engine says "reciprocate": it follows from each person's own ledger.
- **Why now.** Conflict (step 17) needs grievances and someone to hold them against; influence (step 18) needs each person's view of the others' generosity. Before either, people need to know one another. Sharing is the first thing ties decide, because food is what people already need daily, and gifts are what ties among foragers are built on (Gurven 2004).

This step adds ties, asking and giving. It does not change the map, how people find their way, the resources, bodies, personality, groups or the priced exchange of wood for food. Exchange stays within a group; asking and giving reach anyone a person knows.

## Checked against

| Measure | Evidence and comparison | Status |
| --- | --- | --- |
| Circles of ties | People's ties come in layers of about 5, 15, 50 and 150, each about three times the last, set by how often they meet: the closest few at least weekly, about 15 at least monthly (Zhou et al. 2005; Hill and Dunbar 2003; Sutcliffe et al. 2012). Among the Hadza, ties follow who shares a camp (Apicella et al. 2012). | Magnitudes, measured once on the canonical seed over days 30 to 89: for each person, how many others they spent time with on at least one day in seven, and on at least one day in thirty, as a median and range. With forty people only the 5 and 15 layers can show; layers of about that size, with a ratio near three, are expected. A flat result (everyone in a group equally close) is examined in the lab notes, not tuned away. |
| Reciprocity | Among foragers, what one household gives another correlates with what it receives back, moderately: dyadic correlations of roughly 0.2 to 0.6 across studies (Gurven 2004; Allen-Arave et al. 2008). Most food moves by being asked for (Peterson 1993). | Magnitudes, measured once on the canonical seed over days 30 to 89: the correlation, across pairs, between the food given one way and the other; the share of gifts that went to someone in the giver's group; and refusals against gifts. A positive, moderate correlation is expected. |
| Fading | Ties not kept up weaken over months: emotional closeness to friends falls measurably over a year and a half with less contact (Roberts and Dunbar 2011). | A unit test: a tie with no time together halves in 180 days within 1%. |
| Route choice | People rarely take the shortest path. Most commuters keep to habitual routes longer than the shortest one (Zhu and Levinson 2015); pedestrians choose by familiarity and simple rules such as "head roughly the right way" more than by distance (Golledge 1995; Hölscher et al. 2011). | Magnitudes, measured once on the canonical seed: how much longer walks on a remembered way are than the shortest path over the walker's known ground at that minute, as a median and the largest. A median within about 10% is expected; a large excess is examined in the lab notes, not tuned away. |
| Reuse | Habit: most trips go between a few familiar places along familiar routes (Golledge 1999). | Recorded once on the canonical seed: the share of walks by how they were found (a remembered way, a joined way, a coarse plan, a full plan), day by day. Most walks to places are expected to use a way after the first days. |
| New routes | People head towards the goal by the direction that points most nearly at it (Hochmair and Frank 2000), prefer a long straight first stretch (Bailenson et al. 2000), and take routes longer than the shortest (Zhu and Levinson 2015). Planning by regions before footing gives routes close to the shortest when regions are small against the trip (Botea et al. 2004). | Recorded once on the canonical seed from update 071: the share of new walks straight and steered, and how much longer each kind is than the shortest path over the walker's known ground at that minute, as a median and the largest. A median excess within about 15% is expected. |
| Adult height | Mesolithic Europe, from skeletons: men about 165 cm and women about 154 cm, each with a spread of about 6 cm (Formicola and Giannecchini 1999; Ruff 2018). The forty founders' means lie within 3 cm of these, and the sexes do not overlap much more than real ones. | Magnitudes; checked once on the canonical seed, and by a unit test over 10,000 draws. |
| Adult body mass | Mesolithic Europe, estimated from skeletons: men about 62 kg, women about 52 kg (Ruff 2018). | As above. |
| Strength | Grip strength, the standard field measure, among forager-horticulturalists (Tsimane, Hadza, Agta): men about 38 kg, women about 24 kg, with women's strength about 60% of men's (Gurven et al. 2006; Apicella 2014). | As above. |
| Body correlations | Within each sex, height with weight about 0.55, height with grip about 0.35, weight with grip about 0.40. | A unit test over 10,000 draws, each within 0.05. |
| Trait correlations | The meta-analysis of the five traits across 212 samples (van der Linden et al. 2010): openness with extraversion 0.43, conscientiousness with agreeableness 0.43, conscientiousness with neuroticism −0.43, extraversion with neuroticism −0.36, agreeableness with neuroticism −0.36, conscientiousness with extraversion 0.29, agreeableness with extraversion 0.26, openness with agreeableness 0.21, openness with conscientiousness 0.20, openness with neuroticism −0.17. | A unit test over 10,000 draws, each within 0.05. |
| What the traits do | Extraverts seek contact more (Asendorpf and Wilpers 1998); agreeable people offer fairer splits in bargaining games (Ben-Ner et al. 2004); conscientious people plan and store; neurotic people avoid risk; open people seek novelty. | Direction only: each trait's rule has a unit fixture showing the direction. The strengths of the effects are judgement, not calibration, and are listed as questions for later. |
| Carrying | Forager women carry loads of 15 to 25 kg for hours, men more; women's load capacity is closer to men's than their grip is (Hadza and !Kung loads; Lee 1979; Marlowe 2010). | Magnitudes. |
| Speed | A year of forty people in about a second, as since Life 12; in the browser, a month a second, which needs about 30 ms a simulated day. | Not met. After update 071 a day past day 50 takes about 185–205 ms in the worker. Ties must not make it noticeably slower: measured once and recorded, days 50 to 59 in 12-hour steps against update 071's, and the year's memory. More than about 10% slower is examined before this step is merged. |

## Design decisions

### Ties, asking and giving (new)

| Decision | Reason |
| --- | --- |
| A tie is held in each person's own memory, keyed by the other's id: familiarity, credit and grievance, all in minutes, with the minute their time together was last counted and the calendar day the person last asked the other. | The roadmap asks for relationships held in memory per pair. Each person keeps their own view (rule 1): what I think you owe me is my count, not yours. One unit for all three lets one rule compare them. |
| Familiarity is the minutes two people spent within talking distance, neither walking. It is counted when either wakes, from the later of their two task starts and the last minute counted in either person's tie, so no minute is counted twice, and added to both people's ties equally. | Nobody is stepped minute by minute, but a person who is not walking stands still for the whole of their task, so two people standing within 20 m when one wakes have stood there together since the later of their task starts. The count is exact for people standing still and needs nothing new tracked. Walking side by side does not count until groups travel together (step 18). |
| Credit is the minutes of the person's own work a gift stands for: kcal at their own berry-picking rate, wood at their own gathering rate. Giving adds to the giver's credit with the receiver; receiving takes from the receiver's credit with the giver. Positive credit means "they owe me". | Foragers keep account of sharing in effort, not in a currency (Gurven 2004). Each person can value a gift only by what it would cost them, which they know. The two views of one gift can differ, as they do in life. |
| Grievance grows by `refusalGrievanceMinutes` (60) each time a person is refused by someone who had something to spare. It is the only harm in this step. | Stinginess is the grievance foragers voice most (Peterson 1993; Woodburn 1998). Fights, injury and theft come at step 17 and will add to grievance then. A fixed amount per refusal is judgement, listed for later. |
| Ties fade at midnight: each of the three loses the same share a day, `tieFadePerMillion` (3,844), so that it halves in 180 days without renewal. A tie whose three values are all zero is forgotten. | Ties not kept up weaken over months (Roberts and Dunbar 2011). Day-anchored: forgetting is a matter of real time, not of the year's length. Fading credit and grievance too means old debts and old slights are let go. |
| A person holds at most `tiesRemembered` (150) ties. A new tie when full forgets the one with the least familiarity, ties by lowest id. | Dunbar's number: about 150 people a person keeps up with (Hill and Dunbar 2003). With forty founders it never binds; it bounds memory once generations arrive. |
| A person asks when hungry and carrying no food after eating, or short of one night's firewood and holding none spare. They ask, one after another, the living people within talking distance whom they know (familiarity above zero) and can see carrying food, or holding wood, closest tie first: highest familiarity less grievance, ties by id. They ask each person at most once a calendar day, and stop asking for a thing once given some of it. | Demand sharing: among foragers food is mostly given when asked for, not offered (Peterson 1993). What someone carries within 20 m is visible, so the asker acts on what they could know. Asking strangers is left out: among foragers sharing follows ties. Once a day keeps a refusal from being repeated every wake-up. |
| The person asked gives when `familiarity · trustPerMille · agreeablenessGive / 1,000,000 ≥ credit + grievance`, all from their own tie with the asker; otherwise they refuse. | Goodwill from time together must cover what the asker already owes and any grievance. A debt the giver owes the asker (negative credit) makes giving easier: reciprocity follows from the ledger, not from a rule saying "repay". `trustPerMille` (100) makes ten minutes together vouch for one minute of work: one night beside each other covers a gift of about 70 minutes' picking. Judgement, listed for later. |
| Agreeableness scales goodwill: `agreeablenessGive = clamp(1,000 + 500 · z / 1,000, 0, 2,000)`. | The roadmap gives agreeableness two parts of one job: yielding in disputes and sharing more. Agreeable people give more to others in sharing games (Ben-Ner et al. 2004). This is the trait's second rule, alongside the exchange price; both are about giving way to another. |
| A gift of food is what the giver carries beyond what they would eat to reach their own satiation, up to what the asker lacks to reach theirs, oldest lots first. A gift of wood is the giver's wood above their own stock target, up to what the asker wants. | People give what they can spare, not what they need tonight. Giving up to the asker's own satiation is the asker's own measure of need. |
| Exchange is unchanged and comes first: a person who can buy what they need asks nobody. A swap builds no credit. | A swap is paid for at the time; both sides gain and nothing is owed. Keeping exchange as it was isolates what ties add. |
| Ties, asking and giving draw nothing at random. | Who asks whom and who gives follow from memory and fixed orders; nothing is uncertain enough to need a draw. |

### Ways and planning (Life 15, unchanged)

| Decision | Reason |
| --- | --- |
| A way is the corridor of triangles a walk crossed, kept with its two end points, the minute it was planned and the person's knowledge revision then. The path is pulled tight afresh along the corridor at each use and timed for the walker's load. | The corridor is what a person remembers ("along the stream, through the gap"); pulling it tight is the walking. Keeping the corridor rather than a timed path keeps a way good under any load: a load changes speed, not the way. |
| Ways are kept only for walks to a place, a bank point or the person's hearth, never to a frontier. | Habits form between places used again. Exploring is by definition going somewhere new. |
| A way can be walked in either direction, and joined part-way: a walker standing in a triangle of a way with an end at the target walks the rest of it. | Home to thicket is also thicket to home. Joining from part-way is what makes a habit useful when a walk starts from elsewhere, for instance after an interrupted walk. |
| Joining is only from a triangle on the way itself, not from nearby. (Update 071 keeps this.) | Joining from nearby needs a small search to reach the way and a rule for how near. The exact rule is simpler and already covers walks resumed along a way. A join radius is a question for later. |
| When several ways could serve, the one used most recently wins, ties by lowest way number. | A deterministic, human rule: take the route you took last time. |
| A person keeps at most `waysRemembered` (64) ways. A new way to the same two end points replaces the old one; when full, the way used longest ago is forgotten, ties by lowest way number. | Bounds memory and work per person. People forget routes they stop using. |
| A remembered way is reconsidered when it is about to be used, if `wayRecheckMinutes` (one day) has passed since it was planned and the person's knowledge has grown since. Otherwise it is used as it is, even if a shorter path is now known. | Rules 2 and 10: local, not optimal, decisions, and learning through experience. People notice a shortcut eventually, not the instant it comes into sight. Once a day bounds re-planning per way. |
| A way whose triangles are not all still walkable and known to the person is dropped and planned afresh. | Nothing can block a way in this step, because the ground does not change and knowledge only grows; the rule is for floods, fences and palisades later, and costs one pass over the corridor. |
| An idle person who has nothing new to explore no longer tours the places they know. Once a day they walk out along a remembered way from home, the one used longest ago, and otherwise go home and rest. | Foragers spend much of the day resting and in company at camp (Hawkes et al. 1997; Marlowe 2010), and learn the state of patches while out foraging, not by inspecting every one daily. In Life 14 an idle person walked to every known place unchecked for a day, about 210 short walks a day each from day 13, which also made late days slow. A walk along a known way needs no planning, and refreshes the memory of the place at its far end. |
| A new plan is straight if the line to the target crosses only known walkable ground. (Update 071.) | People head for what they are going to when nothing they know of stands in the way (Hochmair and Frank 2000). One step per triangle crossed. |
| Otherwise a new plan is steered: an A\* over the person's pieces of known ground picks a chain, and the walker crosses it piece by piece, heading for the crossing into the next piece nearest the line to the target, straight where they can and by a fine A\* within the one piece where they cannot. (Update 071; from update 068 to 070 the fine A\* ran over a band of chunks around the whole chain; before, the coarse A\* ran over whole chunks.) | People plan by regions before footing and steer round obstacles as they meet them (Golledge 1999), rather than comparing every footing to the goal. A fine search within one 200 m piece is what a walker can see and judge on the spot. Searching the whole band expanded about twenty times the triangles of the path. |
| The crossing into the next piece is the edge between the two pieces whose midpoint is nearest the straight line from the walker's entry point to the target, ties by the lower triangle id on the walker's side. | The least-angle rule: of the ways onward, take the one pointing most nearly at the goal. It is local, needs no look further ahead, and is deterministic. |
| A person's piece is a largest set of their known walkable triangles in one chunk joined to each other by shared edges within that chunk; it is numbered by its lowest triangle id. Two pieces in different chunks are linked when a known walkable triangle in one shares an edge with one in the other. A triangle belongs to the chunk holding its centroid. The coarse cost is the distance between chunk centres, ties by piece number. | It uses only what the person knows (rule 1), and only ground they know to be joined, so the coarse plan never promises a crossing that is not there. Linking whole chunks failed whenever a chunk held two separate patches of known ground, which on day 13 sent a third of all new plans to a search of everything known. |
| Pieces are worked out from the person's knowledge when needed and not stored in the state; only the chunks holding newly learnt triangles are worked out again. | They follow from knowledge alone, so keeping them would add state that could disagree with it. Most chunks change rarely once known. |
| There is no search over all known ground, and no guard. (Update 071; from update 068 to 070 a `full` search was kept as a guard.) | A piece is joined-up known ground, so the search within a piece always succeeds, and a chain of pieces always yields a walk. |
| The still landscape is surveyed again only once the person stands `resurveyCm` (100 m) or more from where they last surveyed it. People, people-made places and the stock where the person stands are looked at every wake-up. | Ground, water, thickets and stands do not move; looking again over the same kilometre from the same spot learns almost nothing. 100 m is a tenth of the sight radius: what is missed at the edge of sight is learnt on the next move. |
| The route cache by exact end points, knowledge revision and load is removed. | Ways replace it. It was almost never reused, because a start a centimetre away or one newly seen triangle made a new key. |
| Travel estimates for choosing targets stay straight-line lower bounds. | A person judges how far a place is before walking; the way is what they then walk. |

### Bodies and personality (Life 14, unchanged)

| Decision | Reason |
| --- | --- |
| Each founder is a woman or a man, drawn half and half. | Height, weight and strength are bimodal by sex; drawing one distribution for everyone would give a population with no real counterpart. Sex is needed again for pairing at step 19. Until then it does nothing but set which body distribution is drawn. |
| Bodies are adults and fixed for life. | Nobody grows or ages before step 19. |
| Height, weight and grip are drawn together from one correlated normal draw per person, clamped to three standard deviations. | The roadmap asks for real correlations; three spreads cover 99.7% of real people and keep integer rates safe. |
| Normal draws are made in integers: the sum of twelve uniform draws from 0 to 999, less 5,994, is a standard normal in thousandths. Correlations come from a Cholesky factor computed in integers with an integer square root. | `Math.log`, `Math.cos` and the like may differ between JavaScript engines; integer arithmetic replays bit for bit everywhere. The sum of twelve uniforms has the normal's mean and spread; its tails stop at six spreads, beyond the clamp. |
| Height has no rule of its own yet. | It is drawn because weight and strength follow it; it is shown, and it is there for step 17 (reach) and for the observer's figures. |
| Strength sets the wood load: `woodLoad · (grip + referenceGrip) / (2 · referenceGrip)`. | Carrying depends on legs and back as much as hands, so women's loads are closer to men's than their grip is: an average woman carries about 26 kg, an average man about 33 kg, the weakest about 17 kg. A log stays one log for everyone: only the speed it costs differs. |
| Weight replaces the single `bodyKg`: it weighs the load against the body for walking speed, sets the thirst thresholds, and scales every kilocalorie rate. | A heavier body carries a load more easily, holds more water and burns more energy for the same work. Scaling by weight keeps strength from being free: a big strong person carries more but must eat more. |
| Five traits, each stored as a normal score in thousandths of a spread, clamped to three spreads. | Personality is measured as continuous scores with a normal spread in every population; a score in spreads lets each rule say "one spread more moves this by so much". |
| Each trait has exactly one job, attached to a decision people already make, and no trait touches another trait's decision. | Rule 13: a trait with no mechanism is cut. One job each keeps every effect traceable to one trait. Agreeableness's yielding and neuroticism's flight wait for disputes at step 17, but each already has a job now, so neither is cut. |
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

The state holds a queue of wake-ups `(minute, phase, id)`. Phases, in order within a minute: `world` (daily regrowth, spoilage, invariants at midnight; fires at each hour), then `person`, ordered by id. `stepValley(state, toMinute)` pops and runs wake-ups until the queue's head is past `toMinute`, and is pure: it returns a new state and the events of the interval. `advanceValley(state, toMinute)` runs the same loop on the state itself, for a caller that owns it, as the worker does (update 070). Cancelling a person's wake-ups marks them; a marked entry is dropped when it reaches the front.

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
| Resource and fish regrowth, spoilage of carried lots, hut weathering, practice update, ties fading | Daily at midnight, `world` phase |
| Time together, asking and giving | At the person's wake-ups |
| Group and personal fires | Hourly at night, `world` phase |
| Bodies | Lazily, at the person's wake-ups |
| Conservation checks | At every event that moves food, wood, logs, stones, axes or water |
| Full invariants | Daily at midnight, and at the end of every `stepValley` call in checked runs |

Bodies and traits are drawn once, when the founders are made, and never change.

### Days per year

`daysPerYear` is a run setting from 8 to 365, default 90. Day-anchored, unchanged by the setting: sleep, the hour of rest, picking, gathering, chopping, drinking and making rates, spoilage, firewood per night, hut weathering days, the 30-day practice window, the 24-hour memory of heard terms, the one leisure walk a day, and every trait rule (margins in minutes, distances, shares). Year-anchored, scaled by the setting: regrowth per year, fish growth per year, tree regrowth in years, and the displayed calendar. A year-anchored duration is never shorter than one day.

### Streams

Every draw comes from a stream derived from the seed and a name: the terrain and layout streams as in Life 11; the founder, skill and craft streams for starts and born skills, unchanged; `axe:<maker>:<minute>` for an axe's quality; and two new streams, each with its own salt, drawn through every founder in id order:

- **body**: per founder, one draw `randomInt(2)` for sex (0 woman, 1 man), then three standard normals for height, weight and grip;
- **traits**: per founder, five standard normals for openness, conscientiousness, extraversion, agreeableness and neuroticism, in that order.

Nothing is drawn per minute. The mesh, ways, plans, ties, asking and giving draw nothing; no stream is added by this step.

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
| Openness | Tries the unfamiliar | (a) When idle (priority 9), a person explores the nearest frontier only if it lies within `exploreRangeCm · f / 1,000` of their hearth in a straight line; otherwise they take a walk or rest, below. Exploring for water, food or wood they need is unchanged. (b) A known place whose stock they have never seen is expected to hold `capacity · g / 1,000`, with `g = clamp(750 + 250 · z / 1,000, 250, 1,000)`. | 1,000, 500, 250, 3,000 |

From Life 16, agreeableness's job, giving way, has a second rule: it scales the goodwill with which a person gives when asked, `agreeablenessGive`, under Ties. No other rule reads a trait. The trait factors and the body-derived quantities are stored with the person, and the checker recomputes them from the scores and the configuration.

## Knowledge and perception

A person remembers: places, with kind, position, the stock last seen and the minute it was seen; bank points; the triangles of the mesh it has seen; the ways it has walked, below; the point of its last survey; people it has met, with the minute; its ties, below; heard exchange terms for 24 hours; its group, flag, hearth and hut. A person knows their own body and traits, and nobody else's.

At every wake-up a person observes in two parts:

- **The still landscape**, only if the person stands `resurveyCm` (100 m) or more from their last survey point, or has never surveyed: every resource place and bank point within `sightRadiusCm` (1 km) becomes known, and every triangle whose centroid lies within the sight radius becomes known. A chunk lying wholly within the sight radius marks all its triangles at once. The person's position becomes their survey point.
- **What changes**, at every wake-up: hearths, flags and hut sites within the sight radius become known; the place the person stands at shows its stock; people within `talkRadiusCm` (20 m) are met, and people within sight are seen.

Founders survey at their first wake-up. Relief does not block sight. A stock not yet seen is expected at the openness share of capacity, above; a fish stock is learnt only by fishing. Triangle knowledge is a bit per triangle, shared with the previous state and copied only when the person learns a new triangle.

## Ties

A person's ties are a map from another person's id to a tie: `familiarity`, `credit` and `grievance`, integers in minutes (familiarity and grievance never negative; credit of either sign), `countedMinute`, the last minute counted for the pair's time together, and `askedDay`, the calendar day the person last asked the other, or −1. Each of the three values carries an integer remainder for fading. A person holds at most `tiesRemembered` ties and never one to themselves. The map is shared with the previous state and copied only when it changes.

**Time together.** At step 3 of a wake-up, after meeting, the waker `a`, if their ended task was not a walk, takes each living person `b` within talking distance whose current task is not a walk, in id order. The minutes together are `m − max(a.taskStart, b.taskStart, countedMinute)`, where `a.taskStart` is the start of the task just ended, `b.taskStart` the start of `b`'s current task, and `countedMinute` the later of the values in `a`'s tie with `b` and `b`'s tie with `a` (minus infinity where there is none). If positive, the minutes are added to familiarity in both `a`'s tie with `b` and `b`'s tie with `a`, created if absent, and `countedMinute` is set to `m` in both. A founder's first wake-up counts nothing.

**Asking.** At step 3, after exchange, a person who is hungry and carries no food, or for whom wood matters and who holds less than one night's firewood, asks. For food they ask the living people within talking distance who carry food; for wood, those holding any wood. Of these, only people with whom the asker has a tie of familiarity above zero and whose `askedDay` is not today are asked, in order of `familiarity − grievance` in the asker's tie, highest first, ties by id. Asking sets `askedDay`; everyone asked was met at this wake-up and so is already woken in the same minute. A person in need of both asks for food first. They stop asking for a thing once given some of it, and a person given food eats it at once, the meal counted with their task's eating.

**Giving.** The person asked, `g`, with their own tie to the asker `r` (all three values zero if `g` holds none), gives if

`familiarity · trustPerMille · agreeablenessGive ≥ (credit + grievance) · 1,000,000`, compared exactly in integers,

and has something to spare, which is checked first:

- **Food:** `spare = carriedKcal(g) − max(0, g.satiationKcal − g.energy)`; the gift is `min(spare, r.satiationKcal − r.energy − carriedKcal(r))` kcal, taken from `g`'s oldest lots and added to `r`'s lots with their minutes kept.
- **Wood:** `spare = g.wood − g.woodStockTarget`; the gift is `min(spare, r.woodStockTarget − r.wood)` kg.

Energy is evaluated at minute `m` by the lazy body functions. A gift of at least 1 kcal or 1 kg is a **gift**: `g`'s credit with `r` rises by the gift's value at `g`'s own rate, and `r`'s credit with `g` falls by its value at `r`'s own rate, both rounded down: `kcal · 60 / forageRate` or `kg · 60 / woodRate` minutes. If `g` would not give, or has nothing to spare, it is a **refusal**: `r`'s grievance against `g` rises by `refusalGrievanceMinutes`. A refusal for lack of anything to spare is recorded as such and adds no grievance: the asker could not know, but can see the reason when told.

**Fading.** At midnight, `world` phase, each value `v` of every tie loses `(|v| · tieFadePerMillion + remainder) / 1,000,000` rounded toward zero, the rest carried in the value's remainder, where `tieFadePerMillion` (3,844) is set so that a value halves in 180 days, as `1,000,000 · (1 − 2^(−1/180))` rounded. A tie whose three values are zero is forgotten. A new tie when `tiesRemembered` are held forgets the one with the least familiarity first, ties by lowest id.

**Who knows what.** A person knows their own ties and nobody else's, can see what people within talking distance carry, and knows their own rates and satiation. Whether to give is decided by the giver from their own tie, body and traits.

## Routes, ways and movement

A person may walk on ground triangles only. A walk's route is a **corridor**, the chain of triangles it crosses, pulled tight by the funnel algorithm into a path, which is cut at triangle edges into pieces, each with a length, a slope class from its triangle (flat below 10%, moderate to 30%, steep above), a ground class and a speed.

### Ways

A way is a corridor the person walked to a place, a bank point or their hearth, with its two end points, its number, the minute it was planned, the person's knowledge revision then, and the minute it was last used. Way numbers count up per person from 0 and are never reused. A person holds at most `waysRemembered` ways. Ways are immutable records shared between states; a person's list is copied only when it changes.

### Finding a walk's corridor

When a walk to a target starts, in this order:

1. **A remembered way.** If the target is a place, bank point or hearth, take the person's ways with an end at the target whose corridor holds the triangle the walker stands in, most recently used first, ties by lowest number. If one exists:
   - if it has a triangle that is no longer walkable or known to the person, it is forgotten and the search goes on to step 2;
   - if `wayRecheckMinutes` have passed since it was planned and the person's knowledge revision has changed since, it is planned afresh by step 2, and the new way replaces it;
   - otherwise the walk takes the part of the corridor from the walker's triangle to the target's end, reversed if the target is the way's start. It is a **way** walk if the walker stands at the way's other end, and a **joined** walk otherwise.
2. **Straight.** The straight line from the walker's position to the target is followed through the mesh from the walker's triangle, crossing at each step the edge the line leaves by. If every triangle it crosses is walkable and known to the person, and it reaches the target's triangle, the corridor is those triangles. A line that passes exactly through a vertex of the mesh, or a walker or target standing outside their route triangle (within `NEAR_CM` of it), counts as not clear. It is a **straight** walk.
3. **Steered.** Otherwise, if start and target lie in different pieces of the person's known ground, an A\* over pieces finds a chain from the start's piece to the target's, moving only between linked pieces, costed by the distance between their chunk centres, with the distance from a piece's chunk centre to the target's as the estimate, ties by piece number. If they lie in the same piece, the chain is that piece. The walker then crosses the chain piece by piece:
   - The **entry** into the first piece is the walker's position and triangle.
   - In each piece but the last, the **exit** is the crossing edge from this piece to the next, among those the mesh lists between the two pieces' chunks, whose midpoint is nearest the straight line from the entry point to the target, ties by the lower triangle id on this side. The entry into the next piece is that edge's midpoint and the triangle on its far side.
   - In the last piece, the exit is the target and its triangle.
   - Within a piece, the stretch from entry to exit is the straight line between them if every triangle it crosses belongs to this piece and it passes through no vertex; otherwise it is the fine A\* from the entry triangle to the exit triangle over this piece's triangles only.
   - The corridor is the stretches joined in order. It is a **steered** walk.
4. If the target is unknown or unreachable, the person walks to the nearest known frontier, or rests with `no known route`, as before.

**Leisure.** A person idle at their hearth (priority 9, no frontier in range), who has not set out on a leisure walk this calendar day, takes the remembered way with an end at their hearth that was used longest ago (ties by lowest number) whose far end can be reached and left for home before dusk, less their dusk margin, by the straight-line estimate. They walk it to its far end, `out for a walk`, and the walk's start records the minute in `leisureMinute`. Idle away from their hearth, they walk home, `going home to rest`. Idle at home otherwise, they rest. A person with no such way rests.

The fine A\* is Life 14's: costed by the distance between the midpoints of the edges crossed, ties by triangle id; from update 071 it runs within one piece only. Before a new plan, the person's known components of ground are compared as before; targets on another component go straight to step 4. A straight, steered or rechecked plan to a place, bank point or hearth is remembered as a way between the walk's start and the target, replacing any way with the same two end points; when the person holds `waysRemembered` ways, the one used longest ago is forgotten first, ties by lowest number. Using a way sets its last-used minute. Walks to a frontier are never remembered.

A person's pieces are found within each chunk: known walkable triangles of the chunk sharing an edge belong to one piece, numbered by its lowest triangle id. Two pieces are linked when one of the mesh's chunk-crossing edges, listed once per layout, joins a triangle of one to a triangle of the other. A triangle's chunk is the chunk holding its centroid. Pieces and links are worked out from the person's knowledge, never stored, and only for chunks where the person has learnt triangles since they were last worked out; they cannot change any result.

Speed is the person's flat loaded speed, above; moderate slopes divide it by `moderateSlowdownPerMille/1,000` uphill; steep slopes halve it uphill and divide by `steepDownSlowdownPerMille/1,000` downhill; ground multiplies time by Life 11's terrain percentages. Walking costs the person's walking rate on the flat, one and a half times that on moderate uphill and twice on steep. A walk's duration is summed in integer 1/60,000-minute units and rounded up at its end; remainders carry. The path, its pieces and their times are computed afresh for every walk from its corridor, the walker's position and their load.

Travel estimates for choosing targets use straight-line distance at the person's flat loaded speed plus `climbMinutesPerMetre`, as a lower bound.

## People

Each person is one object: sex, height, weight, grip, the five trait scores and their derived quantities; position, task record, energy and water with their remainders, carried food lots, carried wood, carried log, stones, axe, hut, group, born skills, practice and alive. Its memories are typed arrays, bitsets and maps inside it, never read by the checker as truth.

Founders are `founders` people, 40 by default, placed from their own streams within the central `startAreaCm` (800 m) on walkable grass or dirt of the main land, with Life 11's spacing when `scattered`, or at the nearest valid camp when together. Born foraging and wood skill range from 75% to 125%; born craft is 100%. Everyone starts with 66,000 kcal, no water deficit, nothing carried and no ties: they are strangers.

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
3. Observe: survey the still landscape if the person has moved far enough, and always what changes. Meet people within talking distance: count time together, found or join a group, hear terms, exchange wood for food at the agreeableness price, ask for food or wood still needed, request or promise an axe, deliver hut logs, contribute to the group's fire.
4. Update needs: hunger with the person's own satiation level, thirst with the person's own thresholds, wood need with the person's own stock target.
5. Choose the next task by the priorities below, using only memory.
6. Start it: if it is a walk, take a remembered way or plan one, as above, and remember a new way; schedule its end and its first body threshold; record the task start with how the walk was found.

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
| 9 | Neither food nor wood need | Explore the nearest frontier if it lies within the person's exploring range of home. Otherwise, at home: once a day, walk out along a remembered way from home (below); else rest. Away from home: walk home to rest. |
| 10 | Food or wood needed | Choose productive gathering or an advantageous local exchange; search if no remembered source is worth working; otherwise rest with the reason recorded. |

Food choice scores one hour's expected food at a remembered place as `3,600 * rate / (estimatedWalkSeconds + 3,600)`, from the stock last seen, or the openness share of capacity if never seen. Work must leave time to return home before dusk less the margin, except drinking under severe thirst.

## Food, wood, shelter and exchange

As Life 13, with each person's own quantities: food in timestamped lots by kind, berries spoiling after 48 hours, nuts after 4,380 and fish after 24; energy starting at 66,000 kcal, capped at 70,000, hungry below 64,000 and satisfied at the person's own level; wood need below one night's firewood, cleared at the person's own stock; loads up to the person's capacity and logs of 35 kg; groups founded by two ungrouped people within 20 m, joined by a lone person, with a flag, a common fire burning 1 kg an hour at night, and a 23-log hut per member weathering a log every 60 days; axes from one stone and 1 kg of wood, quality drawn from half to all of craft, cutting a log in 30 minutes at quality 100 and lasting 200 logs; practice over the last 30 days; wood-for-food swaps at the agreeableness price; axes asked at the maker's extra energy and bought when buying gains food energy. From this step, food and wood are also given when asked for, by the rules under Ties. There is no money, no ownership of water, no forced or unasked sharing and no planned specialisation.

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
| `tiesRemembered` | 150 | Dunbar's number (Hill and Dunbar 2003). Never binds with forty founders. |
| `trustPerMille` | 100 | Ten minutes together vouch for one minute of work. Judgement. |
| `refusalGrievanceMinutes` | 60 | A refusal weighs about as much as an hour's work given. Judgement. |
| `tieFadePerMillion` | 3,844 | A value halves in 180 days without renewal (Roberts and Dunbar 2011, magnitude). Day-anchored, unchanged by `daysPerYear`. |
| `agreeablenessGiveRule` | base 1,000, effect 500, low 0, high 2,000 | One spread more agreeable gives on half again as little familiarity; three spreads less, never. |

Parameters added by Life 15, unchanged:

| Parameter | Default | Basis |
| --- | --- | --- |
| `waysRemembered` | 64 | Enough for every place a person uses in a season and the ways between them; a person who uses more forgets the stalest. |
| `wayRecheckMinutes` | 1,440 | A day: a shortcut seen today is taken from tomorrow. Day-anchored, unchanged by `daysPerYear`. |
| `resurveyCm` | 10,000 | 100 m, a tenth of the sight radius. |

Parameters added by Life 14, unchanged:

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

All other Life 14 defaults are retained.

Validation rejects a `tiesRemembered` below 1 or above 10,000; a negative `trustPerMille` or `refusalGrievanceMinutes`; a `tieFadePerMillion` below 0 or above 1,000,000; and an `agreeablenessGiveRule` that fails the rule checks below. As in Life 15, it rejects a `waysRemembered` below 1 or above 1,000; a `wayRecheckMinutes` below 1; a `resurveyCm` below 1 or above `sightRadiusCm`. As in Life 14, it rejects non-integers, non-finite values and unsafe products; settings outside their ranges; non-positive means and spreads; a mean less three spreads that is not positive; correlations outside −999…999; a correlation matrix that is not positive definite by the integer factorisation above; a rule with `low > high`, a negative `low`, or an `effect` whose product with 3,000 is unsafe; and every check that used `bodyKg` or `woodLoad` (such as a log still being movable, and work rates exceeding resting) evaluated at the extreme person: the lightest weight, the lowest load capacity, the highest scaled rates. It also keeps every Life 13 check on the mesh, places, thresholds and placement.

## Invariants and ledger

The checker replays the events of each `stepValley` interval against the state in checked runs, validates immutable geography once, and runs the full set at every midnight.

- **The mesh, once per layout:** as Life 13: winding, areas, neighbours, shores, shore heights, shoreline and heights within tolerance, places and banks on walkable ground.
- **Bodies and traits:** every person's sex is 0 or 1; height, weight and grip lie within three spreads of their sex's mean; trait scores lie within −3,000…3,000; and the stored load capacity, rate table, thirst thresholds, company radius, exchange rule inputs, stock target, satiation level, dusk margin, exploring range and expected share equal those recomputed from the scores and the configuration. None changes during a run.
- Every wake-up's body charge equals the person's own rates for the task over its minutes, with bounded remainders; energy and water at a wake-up equal the lazy functions evaluated there.
- **Ways:** every person holds at most `waysRemembered` ways, no two with the same end points; every way's corridor is a chain of triangles each sharing an edge with the next, every one walkable and known to the person, its first and last holding its end points; numbers are below the person's next way number; last-used minutes are not in the future. Every walk recorded as a way or joined walk stays within the triangles of the way it names. No walk is recorded as `full` (update 068). The checker does not recompute the pieces, the coarse band or the recheck rule; unit fixtures cover them.
- **Leisure:** nobody sets out on two leisure walks in one calendar day, and `leisureMinute` is the start of the last one.
- **Ties:** every person holds at most `tiesRemembered` ties, none to themselves or to an id that never existed; familiarity and grievance are not negative; `countedMinute` is not in the future, and `askedDay` is not after today. Where two people each hold a tie to the other with the same familiarity remainder, both have the same familiarity, unless one of them forgot the tie and made it anew. At midnight every value replays from the day before: fading, plus the time together, gifts and refusals recorded that day.
- **Gifts:** the giver's goodwill covered their credit and grievance, and both credits changed by the gift's value at each person's own rate; food and wood conserve across it in the stock and body ledgers. Nobody asks the same person twice in a calendar day. Every refusal for want of goodwill adds exactly `refusalGrievanceMinutes`, and one for want of anything to spare adds none. The checker does not recompute a gift's amount from bodies and loads; unit fixtures cover the amounts.
- **Survey:** each observation is replayed against the rule: it is a survey exactly when the person had no survey point or stood at least `resurveyCm` from it, and the survey point changes only at a survey, to where they stood.
- No person's trip wood exceeds their load capacity.
- Every exchange's price equals the agreeableness price for its two parties, and both gained at it.
- Every person's position at every recorded minute is on walkable ground, and every route segment lies in walkable triangles the person knew when the walk started. Nobody is at two places, and the chunk index agrees with positions.
- Food, wood, logs, stones and axes conserve at every event; fish and thicket stocks replay from regrowth and takes; water withdrawals equal recorded drinks.
- The queue holds at most one task end and one threshold per living person; no wake-up is in the past; dead people have none.
- Every decision reads memory only.
- Hunger and thirst hysteresis with the person's own levels, death minute and cause, and group dissolution below two living members follow the stated order.

Events are as Life 14; a walk's start records how it was found (`plan`: `way`, `joined`, `straight` or `steered`; a walk to a frontier is straight or steered; from update 068 to 070 `coarse`, or `full` only from the guard), whether a way was dropped and planned again (`rechecked`), and the way it used (`wayId`, −1 for a new plan). An observation records whether it was a survey. New events: `together` (minute, the two ids, minutes added), `gift` (minute, giver, receiver, kind, amount, each side's credit change) and `refusal` (minute, asked, asker, kind, whether for want of goodwill or of anything to spare, grievance added). The daily summary adds, per person, the number of ties held and of people they spent time with that day, the food and wood given and received, and refusals made and met. World metrics are as Life 14.

## Observer

Label the page **Life 16 · strangers**. The engine runs in a worker thread and the page draws from view copies of its states (Life 15, update 069): the view copy keeps current memory, now including ties, only for the person followed, and keeps gift and refusal events alongside exchanges and walk records. Everything else in the settings screen, loading card, header, history panel, group card, playback and landscape is as Life 15.

- **Ties, when a person is followed.** A thin line is drawn on the ground from the followed person to each of their five closest living ties, closest by familiarity; a tie they hold a grievance in is drawn in a warmer colour.
- **Person panel.** Adds a "Ties" row ("Knows 12 · close 4"), where close counts the ties with at least `closeTieMinutes` (1,440, a day together; an observer setting, not an engine one), and a list of the five closest: name, time together, and the balance in words, "owes 2 h", "is owed 1 h" or "even", with "a grievance of 1 h" when there is one. Familiarity, credit and grievance are shown as the followed person holds them.
- **History.** The last five gifts and refusals the followed person gave, received, made or met: "Forager 3 gave Forager 1 900 kcal" or "2 kg of wood"; "Forager 5 refused Forager 1 food, unwilling", or "having none to spare" when that was the reason.

Unchanged from Life 15: the followed person's ways drawn as faint lines, the "Ways" row and the wording for how the current walk was found. Unchanged from Life 14: figures scaled to height and weight, the body line and five trait rows, and the exchange line with the price and the larger share.

## Code layout

- New `src/valley/ties.ts`: a person's ties; counting time together; choosing whom to ask; the giving rule and the gift's amount and value; refusals; fading; forgetting.
- `wake.ts`: step 3 counts time together after meeting and asks after exchange, waking the person asked as an exchange offer does.
- `world.ts`: ties fading at midnight. `engine.ts`: the daily summary's ties and companions per person (ties held, and people counted together that day), food and wood given and received, and refusals made and met.
- `types.ts`, `config.ts`: the person's ties, shared between states; the `together`, `gift` and `refusal` events; the new parameters and their validation; `agreeablenessGive` stored with the person.
- `invariants.ts`: the checks above.
- `src/valleyView/`: ties carried in the followed person's view copy, gift and refusal events kept in it, the tie lines, the panel rows, the history lines, the Life 16 label.
- `docs/LIFE15_SPEC.md` is removed: this specification replaces it.

Terrain, hydrology and mesh, routes and ways, perception, bodies and traits (`terrain.ts`, `water.ts`, `mesh.ts`, `routes.ts`, `ways.ts`, `perception.ts`, `nature.ts`) and exchange (`trade.ts`) are unchanged. The MVP9 core is unchanged.

## Tests and implementation acceptance

The Life 15 fingerprint suite passes before the engine is changed. Every trajectory changes once gifts move food and wood: this step records new fingerprints for all its configurations. The founders, their bodies and traits stay the same as Life 15's on every fingerprint seed; `life13-founders.json` still checks starts and born skills. Fingerprints are not updated to conceal a failed rule.

New unit fixtures:

1. Time together: two people resting within 20 m for an hour gain 60 minutes each when one wakes; when the other wakes later in the same spot, only the minutes since are added; a walker passing within 20 m adds nothing; two people 25 m apart add nothing.
2. Fading: a tie with no time together halves in 180 days within 1%; a tie fading to zero is forgotten.
3. Gift: a hungry person carrying no food asks a familiar person carrying spare berries and is given up to their own satiation, oldest lots first; both credits change by the gift at each person's own rate.
4. Whom to ask: a stranger within 20 m is not asked; of two familiar people the one with more familiarity less grievance is asked first; nobody is asked twice in a calendar day.
5. Refusal: a familiar person whose goodwill does not cover the asker's debt refuses, and the asker's grievance grows by 60; a person with nothing to spare refuses without adding grievance.
6. Reciprocity: a person who owes the asker gives on familiarity that would not move them otherwise.
7. Agreeableness: on the same tie, a person at +1 spread gives where one at −1 refuses.
8. Exchange first: a person who can buy the wood they need in their group buys it and asks nobody.
9. Forgetting: with `tiesRemembered` ties held, a new tie forgets the least familiar.
10. The checker rejects a tie to oneself, one tie too many, unequal familiarity in a pair, a gift larger than the rule allows, a gift given without enough goodwill, a refusal adding the wrong grievance, and a second ask in one day.

The Life 15 and Life 14 fixtures are kept, with fixtures updated only where a gift now changes what a person does.

Measured once and recorded in the lab notes, on the canonical seed: the circles of ties and the reciprocity measures in "Checked against", over days 30 to 89; gifts and refusals by day; and days 50 to 59 in 12-hour steps as the worker runs, against update 071's, with the year's memory. In the browser: a gift line in the history, a followed person's ties drawn and listed, and the console clean.

Final validation is `npm run agent:check`.

## Questions for later

- Is ten minutes together for one minute of work (`trustPerMille`) the right exchange rate between time and help, and is 60 minutes the right weight of a refusal? Both are judgement.
- Should walking together count as time together once groups travel as one (step 18)?
- Should people offer unasked, for example to someone they see hungry and close, or share a large catch with everyone at the fire (step 21)?
- Should people ask strangers, at a lower chance of being given?
- Should extraversion, the trait that starts interactions, govern asking? Here everyone in need asks.
- Should ties decide whom an ungrouped person approaches or which group they join, and whom a person trades with?
- Should contributions to the group's fire count as help to those who sat by it?
- Do the circles of ties show layers, or does everyone in a group become equally close? If equal, is it because hearths are close enough for every member to be within talking distance at night?
- Do the agreeable end up giving most and the disagreeable receiving most, and does that change who survives?
- Should grievance fade more slowly than familiarity?
- Should a person tell or show a way to someone they trust (step 24)?

The Life 15 questions about wayfinding and speed stand: joining a way from nearby, the pace of noticing shortcuts, ways by expected time, landmarks as the coarse level, dropping finished routes, the hut-building week's cost, trails, and sight blocked by ridges; and the Life 14 questions about the strength of each trait's effect, body mass and survival, strength and chopping, height and speed, the default year, and personality changing with age.

## Left out

Kinship and pairing (step 19); fights, injury, theft, yielding and fear in disputes (step 17), so grievance comes only from refusals; prestige, dominance, following and leadership (step 18); offering unasked and sharing a catch; asking strangers; ties deciding group membership, approach or exchange partners; gossip, or knowing anyone's ties but one's own; trails, shared or taught ways, ways blocked by anything, and sight blocked by relief; children, growth and ageing; illness; heat balance and clothing; skills correlated with body or traits; personality change; wading, swimming and boats; seasons and weather; herds, planting, property and recipes beyond axes and huts.

## References

- Peterson, N. (1993), *Demand sharing: reciprocity and the pressure for generosity among foragers*, American Anthropologist.
- Gurven, M. (2004), *To give and to give not: the behavioral ecology of human food transfers*, Behavioral and Brain Sciences: who shares with whom, and dyadic reciprocity.
- Allen-Arave, W., Gurven, M. and Hill, K. (2008), *Reciprocal altruism, rather than kin selection, maintains nepotistic food transfers on an Ache reservation*, Evolution and Human Behavior.
- Woodburn, J. (1998), *"Sharing is not a form of exchange": an analysis of property-sharing in immediate-return hunter-gatherer societies*, in Hann (ed.), Property Relations.
- Apicella, C., Marlowe, F., Fowler, J. and Christakis, N. (2012), *Social networks and cooperation in hunter-gatherers*, Nature.
- Hill, K. et al. (2011), *Co-residence patterns in hunter-gatherer societies show unique human social structure*, Science.
- Hill, R. and Dunbar, R. (2003), *Social network size in humans*, Human Nature.
- Zhou, W.-X., Sornette, D., Hill, R. and Dunbar, R. (2005), *Discrete hierarchical organization of social group sizes*, Proceedings of the Royal Society B.
- Sutcliffe, A., Dunbar, R., Binder, J. and Arrow, H. (2012), *Relationships and the social brain: integrating psychological and evolutionary perspectives*, British Journal of Psychology.
- Roberts, S. and Dunbar, R. (2011), *The costs of family and friends: an 18-month longitudinal study of relationship maintenance and decay*, Evolution and Human Behavior.

- Siegel, A. and White, S. (1975), *The development of spatial representations of large-scale environments*, Advances in Child Development and Behavior: landmark, route and survey knowledge.
- Golledge, R. (1995), *Path selection and route preference in human navigation: a progress report*; Golledge, R. (ed.) (1999), *Wayfinding Behavior: Cognitive Mapping and Other Spatial Processes*.
- Hölscher, C., Tenbrink, T. and Wiener, J. (2011), *Would you follow your own route description? Cognitive strategies in urban route planning*, Cognition.
- Zhu, S. and Levinson, D. (2015), *Do people use the shortest path? An empirical test of Wardrop's first principle*, PLoS ONE.
- Hochmair, H. and Frank, A. (2000), *Influence of estimation errors on wayfinding-decisions in unfamiliar street networks: analyzing the least-angle strategy*, Spatial Cognition and Computation.
- Bailenson, J., Shum, M. and Uttal, D. (2000), *The initial segment strategy: a heuristic for route selection*, Memory and Cognition.
- Botea, A., Müller, M. and Schaeffer, J. (2004), *Near optimal hierarchical path-finding*, Journal of Game Development.
- Formicola, V. and Giannecchini, M. (1999), *Evolutionary trends of stature in Upper Paleolithic and Mesolithic Europe*, Journal of Human Evolution.
- Ruff, C. (ed.) (2018), *Skeletal Variation and Adaptation in Europeans: Upper Paleolithic to the Twentieth Century*: stature and body mass estimates.
- Gurven, M. et al. (2006), on strength and physical capacity among Tsimane forager-horticulturalists; Apicella, C. (2014), *Upper-body strength predicts hunting reputation and reproductive success in Hadza hunter-gatherers*.
- van der Linden, D., te Nijenhuis, J. and Bakker, A. (2010), *The General Factor of Personality: a meta-analysis of Big Five intercorrelations*, Journal of Research in Personality.
- Asendorpf, J. and Wilpers, S. (1998), *Personality effects on social relationships*; Ben-Ner, A., Kong, F. and Putterman, L. (2004), *Share and share alike? Gender-pairing, personality, and cognitive ability as determinants of giving*.
- Lee, R. (1979), *The !Kung San*; Marlowe, F. (2010), *The Hadza*: forager loads and daily work.
- Magnitudes for walking, slopes, loads, foods, fish, wood, shelter and tools remain in [CALIBRATION.md](CALIBRATION.md), which gains the body, strength and trait magnitudes above. Terrain, water and mesh references remain those of Life 10 to 13, in the changelog and lab notes.
