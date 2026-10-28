# [LIFE15-Wayfinding-071]

**Updates up to 071 approved by the owner, 2026-10-28.** This specification replaced the Life 14 specification at update 066 and describes the whole simulation. It is step 15 of the [roadmap](ROADMAP.md), habitual routes, inserted before relationships, and is built under the [Life section](../SIMULATION_DESIGN_RULES.md#life-realism-and-time) of the design rules. Update 068 revised how a new route is planned. Update 069, below, moves the engine off the page's main thread; it changes only the observer. Update 070 makes wake-ups cheaper without changing any result. Update 071, below, replaces the detailed route search with the simple rules people use to find their way.

Forty strangers are dropped on 4 km square of young glacial land in Mesolithic northern Europe: drumlins, moraine fronts, kames, hummocks, kettle hollows and tunnel valleys, with lakes in the hollows and rivers running downhill to the edge. The ground is grass, dirt and stone. People discover drinking banks, drink, pick berries, gather hazelnuts, fish, gather firewood, meet, form groups, exchange wood and axes for food, and build huts around shared fires. Their knowledge comes from observation and memory. Each of them is a woman or a man with a body of their own and a personality of their own. From this step they find their way as people do: they remember the ways they walk, take them again, and plan afresh only for somewhere new, or now and then to notice a shortcut.

Time is one clock in minutes. Nobody is stepped: a person is woken when their task ends, a body threshold arrives, someone enters their chunk, or someone addresses them, and their position and body at any minute follow from their task. A year has as many days as the run's settings say, from 8 to 365. Lengths are integer centimetres, food integer kilocalories, wood integer kilograms, water deficit integer millilitres, and fractional amounts accumulate in integer remainders. `stepValley` advances the state to a target minute, is pure and deterministic, and every random draw comes from a named derived stream. The observer displays real records and interpolates movement between them.

## What Life 15 makes possible

- **People walk the ways they know.** Until now every walk was planned from nothing, as the best path over all the ground the person had ever seen, as if they studied a perfect map before every step. Real people learn a few routes between the places they use, take them again, and join a familiar route when they find themselves on it (Siegel and White 1975; Golledge 1999). Each person now remembers **ways**: the line of ground they walked from a starting point to a place, a bank or home. A walk to the same place, or back from it, takes the remembered way, or the rest of a way they are standing on.
- **People head straight for where they are going.** When no way is known and the straight line there crosses only ground the person knows they can walk, they walk it (update 071).
- **Otherwise they plan coarsely and steer.** A person picks a chain of pieces of known land, each within a 200 m square, that leads there, as someone thinks "over the ridge, round the lake", then heads for each crossing into the next piece in turn, going round what is in the way only within the piece they are crossing. Because each piece is ground the person knows to be joined up, the chain always holds a path (updates 068 and 071).
- **People notice shortcuts slowly.** A remembered way is reconsidered at most once a day, and only if the person has seen new ground since they planned it. Until then they keep to it, even if a better path has just come into view.
- **People look again only when they have moved.** The still landscape in sight (ground, banks, thickets, stands, outcrops) is surveyed again only once the person has moved 100 m from where they last surveyed it. People, fires, flags and huts, and the stock where the person stands are noticed at every wake-up, as before.
- **Why now.** In the canonical run, the engine is about 400 times slower per simulated hour on day 12 than on day 2: in four midday hours of day 12 people searched 1,675 routes, every one planned anew, none repeating an earlier search (update 065). Planning every walk from scratch is both unrealistic and the largest single cost of a late day. Fixing it now, before relationships add more walking, keeps later steps runnable.
- **The groundwork for trails.** Ways are the first thing a person keeps because they used it, not because they chose it fresh. Trails worn by many feet, and showing someone the way (step 24, making and teaching), can build on them later. Nothing in this step wears a trail or shares a way.

This step changes how people find and keep their way, and how often they look around. It does not change the map, the ground anyone may walk, walking speeds, the resources, bodies, personality or what people can do.

## Update 071: simple wayfinding

**The problem.** After update 070 a simulated day past day 50 takes about 195 ms, against about 33 ms for a month a second. Finding routes is the largest part, about 30%. Of about 400 walks a day, about 80 are planned afresh, at about 1 ms each: to find a path about 150 triangles long, the fine A\* expands about 3,400 triangles, more than twenty times the path. It is also not how people find their way. The fine A\* finds the shortest path over every triangle in a band of known ground, as if the walker compared thousands of footings before setting off.

**How people find their way.** People do not compute shortest paths. They head roughly towards the goal, choosing at each choice point the direction that points most nearly at it (the least-angle strategy, Hochmair and Frank 2000); they prefer routes whose first stretch is long and straight (Bailenson et al. 2000); they keep and reuse familiar routes (Golledge 1999); and they go round an obstacle when they reach it rather than planning the detour from afar. The routes they take are commonly longer than the shortest ones (Zhu and Levinson 2015).

**The change.** A walk that has no remembered way to take is found by the first of two rules that applies:

1. **Straight there.** If the straight line from the walker to the target crosses only triangles that are walkable and known to the person, the walk follows it. Checking costs one step per triangle crossed: tens, not thousands.
2. **Steered through pieces.** Otherwise the coarse A\* over the person's pieces of known ground picks the chain as now (update 068). The walker then crosses the chain piece by piece. From where they enter a piece, they head for the crossing into the next piece that is nearest the line to the target, straight if that line stays within the piece, and otherwise by the fine A\* limited to that one piece, never more than one 200 m square. The walk's corridor is these stretches joined, pulled tight as every corridor is.

The band, the fine A\* over a band and the full search over all known ground are removed. A piece is joined-up known ground, so the search within a piece always succeeds, and a chain of pieces always yields a walk: no guard is needed.

Remembered ways, joining a way part-way, rechecking a way once a day and forgetting are unchanged; a recheck plans afresh by the two rules above. Ways are now remembered from straight and steered walks.

**Expected, and measured.** The work of a new plan was expected to fall from about 3,400 triangles expanded to the triangles crossed by straight lines plus small searches within the few pieces where a line is blocked, and a day past day 50 from about 195 ms to roughly 130–150 ms. Measured, it did not. A straight plan costs about 4 µs, but only about one new plan in four is straight past day 20. A steered plan costs about 0.5 ms, and its corridor of some 340 triangles makes the route cut along it no cheaper than before. Over 60 days in 12-hour steps (single runs, against update 070): the hut week, days 11–19, takes 7.3 s instead of 9.1 s; days 1–10 take about the same; days 20–60 take about 185–205 ms a day instead of 172. Per wake-up the cost is the same as before; the run differs from 070's and has about 9% more wake-ups past day 50. So this update makes walks lifelike and the busy first weeks faster, but not ordinary days. The speed-ups that change no result (the inner loops, ground heights at places, the water search for people who know many banks, fewer short-lived objects) remain for separate updates; a month a second needs more still.

**Who notices.** Paths are less perfect: a steered walk can be a little longer than the shortest path over known ground, going through the crossing nearest the goal rather than the best one, and round the near side of a lake. A median excess within about 15% is expected and examined in the lab notes, not tuned away. Every run's trajectory changes, including on the flat land, where straight lines replace searched paths. The person panel's wording for a new walk changes. Nothing else about people changes.

## Update 070: lighter wake-ups

**The problem.** After update 069, 1 month/s reaches about 4 simulated days a second, against 30 wanted. On the canonical forty past day 50 a simulated day costs about 230 ms of engine time: a thousand wake-ups that end in "keep resting" take 37 ms, four hundred walk decisions 140 ms, and the rest is the step's own copies and about 45 ms of garbage collection over 270 MB of short-lived objects a day.

**The change.** Six speed-ups. None changes a result: every fingerprint stays the same.

- **The exchange check.** A wake-up offers exchanges within the person's group. Group members who are dead or beyond talking distance can take no part, so they are no longer copied into the exchange's working views, and views nobody changed are not copied back.
- **Looking around.** The people, fires and stock checks at each wake-up scan the nearby chunks directly, without building lists of candidates first; only walkers have their position worked out from their route, as everyone else stands where they are recorded.
- **Route chunk crossings.** The chunks a walk crosses, which decide who is woken by someone arriving, are found with one reused buffer in place of temporary lists for every route.
- **The wake-up queue cancels lazily.** Every wake-up cancels the person's pending wake-ups, which rebuilt the whole queue. Cancelled entries are now marked and dropped when they reach the front, or all at once when they outnumber the rest. Live entries leave in exactly the same order.
- **The worker advances its state in place.** `stepValley` stays pure: it copies the state, then runs it on. The worker owns its state and keeps only the view copies it sends, so it calls `advanceValley`, the same loop without the copy. Nothing else may call `advanceValley` on a state someone else holds. The view copy now takes its own snapshot of the followed person's memory, since the engine's is changed in place.
- **The daily summary counts known places without copying them.**

**Measured.** In Node, on the canonical forty, seed 20260813, as the worker runs at 1 month/s (12-hour strides, a view copy and its changes each step), days 50 to 59 take 175–200 ms a simulated day against 235–275 ms before, about 27% faster: roughly 5.7 days a second of engine time against 4.2. Garbage collection falls from about 46 to 29 ms a day. Walk decisions (planning routes, choosing water, leisure walks) are now about 60% of a day and are the next thing to make cheaper.

## Update 069: the engine in a worker thread

**The problem.** The engine runs on the page's main thread, between frames, for up to 40 ms a frame. Drawing, the panels and the controls share that thread, so at high speeds the page manages about 16 frames a second, and a slow day (days 12 to 14 take 1.9–2.5 s) holds every frame it spans to the budget. At 1 month/s the page reaches 3.2 days a second, and the engine already takes about 70% of each second.

**The change.** The engine runs in a worker thread with a state of its own. The main thread keeps the clock, draws, and handles the controls; it never runs `stepValley`.

- **Building.** Both threads build the valley from the run's settings with `createValley`, which is pure, so they start from the same state. The layout (about 190 MB, mostly terrain) is never sent between them: copying it takes about 3 s.
- **Running.** Each frame the main thread advances its clock as before and tells the worker a whole minute to run to, the *goal*: the clock plus 0.1 s at the speed shown, so a state is already waiting at each minute the clock reaches. The worker runs towards the goal in slices of at most 50 ms, sends a view copy every *stride* minutes (the speed over 60, at least 1: about one copy a frame) and at the end of each slice, and reads new messages between slices, so a new goal or followed person takes effect within one slice. It never runs past the goal.
- **Drawing.** The main thread keeps the copies it has received and not yet passed. It draws the newest at or before the clock, at a minute less than one minute after it, so the rule is unchanged: every wake-up at or before the drawn minute has been processed, and none after it. When the worker is behind, the clock waits within the newest state's minute. People are drawn from the task records of the state drawn, as before.
- **Step, Pause and speed.** Step asks for the next whole minute and shows it once the worker has sent it. Paused, the worker still keeps its 0.1 s lead. On a change of speed the clock moves on to the newest copy received, so copies sent a stride apart for a fast speed are not shown at a slow one; what is skipped is at most 0.1 s at the old speed.
- **The view copy.** Copying the whole state takes 1.5–10 s past the first days, almost all of it in what the screen never reads: every route ever walked (27,000 by day 45, of which the screen needs the few under way), the engine's event records, and every person's memory: what they know of the ground, their ways, and their memory of places, banks, fish and people (together about 600 kB a copy on day 13), which the screen reads only for the person followed. The worker sends a copy that has:
  - only the routes of walks under way;
  - each person's next wake-up in place of the wake-up queue;
  - only exchanges and walk records among the recent events;
  - current memory only for the followed person; everyone else's memory is kept as the last copy held it, so it is not sent again, and what the main thread holds of it is stale and never read;
  - everything else as in the engine's state.

  Only what has changed since the last copy is sent. A part that is the same object as in the last copy is skipped at once; the engine shares knowledge, ways, bank memory, routes, huts and finished days between states until they change. A part the engine recopied, as it does each person's small tables every step, is compared by content and skipped if equal. The main thread applies the changes to its previous copy, and unchanged parts keep their identity there.
- **New run, Settings.** A new run ends the worker and starts another.

**Expected.** Frames no longer wait for the engine: at every speed the page draws as fast as the renderer allows, and a slow day stops the clock, not the page; camera, panels and controls stay responsive. The engine gets a whole core, less the cost of the copies, so 1 month/s was expected to rise from 3.2 to roughly 4–5 days a second. Measured, the page draws 52–60 frames a second at 1 month/s where it drew 15–19, but the engine still runs about 3 days a second (2.9 against 3.3 before, single runs). This update does not reach a month a second; that needs cheaper behaviour or a simpler model at map speeds, which are the owner's decisions for a later update.

**Who notices.** Only the observer changes. The engine, every trajectory and every fingerprint stay the same, and a run stepped in the worker is identical to the same run stepped in a test.

## Update 068: planning by pieces of known ground

**The problem.** The owner's goal is a month a second, which needs the engine to run a simulated day in about 30 ms. After update 067 an ordinary day (20 to 45) takes about 190–410 ms, and days 11 to 17, when people are building huts and still exploring, take 1.2–4.6 s. Counted on the canonical run:

| Day | Time | New plans | Band searches that failed | Triangles searched in bands | Triangles searched in full searches |
| --- | --- | --- | --- | --- | --- |
| 5 | 124 ms | 56 | 0 | 14,567 | 0 |
| 12 | 2.0 s | 733 | 86 | 0.77 million | 1.48 million |
| 13 | 4.6 s | 980 | 328 | 2.46 million | 11.26 million |
| 16 | 1.7 s | 307 | 128 | 0.75 million | 5.16 million |
| 30 | 347 ms | 110 | 18 | 0.14 million | 0.43 million |

On every day from 12, most of the route-search work is the full search, run after a band search finds no path. On day 13, 268 of the 328 failures were walks to a frontier, exploring. The band fails because the coarse plan links two 200 m squares whenever the person knows ground on both sides of any edge between them, without asking whether that ground is joined up inside the square. Near the edge of what a person knows, and around lakes and streams, a square often holds two or more separate patches of known ground: the chain passes through the square on paper, but no path does. The person then searches everything they know, about 34,000 triangles on average on day 13.

**The change.** The coarse plan moves from squares to **pieces**: the patches of joined-up known ground within each square. Two pieces are linked when known ground in one shares an edge with known ground in the other. A chain of linked pieces is a path on known ground by construction, so the fine search in the band around it always succeeds, and the full search is no longer needed. People still plan "over the ridge, round the lake" first; they now plan only through land they know they can cross, which is closer to how people reason about routes they know (Golledge 1999) and to hierarchical path planning over connected regions (Botea et al. 2004).

**What was expected, and what was measured.** The full searches, 11.3 million triangles on day 13 and 0.43 million on day 30, go; the walks they served are planned in a band instead. The slow days were expected to fall to roughly 1–1.5 s; measured, days 11 to 17 take 0.4–2.5 s (day 13: 4.6 → 2.5 s), and ordinary days gained about a quarter (day 30: 347 → 249 ms). Day 12 barely changed, because its cost was hut-building walks and the band searches themselves, not failures. This update does not by itself reach 30 ms a day.

**Who notices.** Walks that used to be planned over everything known are now planned in a band, and may be slightly longer than the shortest known path, as coarse plans already are. Every run's trajectory changes except on the open flat land, where no chunk is ever split; nothing else about people changes.

### Speed work

After the behaviour change and its new fingerprints, each further speed-up must leave every fingerprint unchanged and be kept only if it measurably helps. They are chosen from the profiles at days 13 and 30, not in advance. None of them changes what people do. Measured: after the change, days 12–13 spend 32% of the time in route search, 25% in observation, 10% in garbage collection and 9% choosing tasks. Skipping chunks beyond sight in a survey and reusing the A\* heap left the fingerprints unchanged but did not measurably help, so neither was kept. The remaining cost is the work people do, not waste in doing it.

## Checked against

| Measure | Evidence and comparison | Status |
| --- | --- | --- |
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
| Speed | A year of forty people in about a second, as since Life 12; in the browser, a month a second, which needs about 30 ms a simulated day. | Not met by this step. After update 068, in whole-day steps, days 11 to 17 take 0.4–2.5 s and days 20 to 45 about 180–420 ms; in off-screen Chrome at 1 month/s, 3.2 days a second. Measured once and recorded: each of the canonical first 45 days' time, the canonical year's time and memory, and profiles of days 13 and 30 against update 067's. |

## Design decisions

### Ways and planning (new)

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
| Resource and fish regrowth, spoilage of carried lots, hut weathering, practice update | Daily at midnight, `world` phase |
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

Nothing is drawn per minute. The mesh, ways and plans draw nothing.

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

No other rule reads a trait. The trait factors and the body-derived quantities are stored with the person, and the checker recomputes them from the scores and the configuration.

## Knowledge and perception

A person remembers: places, with kind, position, the stock last seen and the minute it was seen; bank points; the triangles of the mesh it has seen; the ways it has walked, below; the point of its last survey; people it has met, with the minute; heard exchange terms for 24 hours; its group, flag, hearth and hut. A person knows their own body and traits, and nobody else's.

At every wake-up a person observes in two parts:

- **The still landscape**, only if the person stands `resurveyCm` (100 m) or more from their last survey point, or has never surveyed: every resource place and bank point within `sightRadiusCm` (1 km) becomes known, and every triangle whose centroid lies within the sight radius becomes known. A chunk lying wholly within the sight radius marks all its triangles at once. The person's position becomes their survey point.
- **What changes**, at every wake-up: hearths, flags and hut sites within the sight radius become known; the place the person stands at shows its stock; people within `talkRadiusCm` (20 m) are met, and people within sight are seen.

Founders survey at their first wake-up. Relief does not block sight. A stock not yet seen is expected at the openness share of capacity, above; a fish stock is learnt only by fishing. Triangle knowledge is a bit per triangle, shared with the previous state and copied only when the person learns a new triangle.

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
3. Observe: survey the still landscape if the person has moved far enough, and always what changes. Meet people within talking distance: found or join a group, hear terms, exchange wood for food at the agreeableness price, request or promise an axe, deliver hut logs, contribute to the group's fire.
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

Validation rejects a `waysRemembered` below 1 or above 1,000; a `wayRecheckMinutes` below 1; a `resurveyCm` below 1 or above `sightRadiusCm`. As in Life 14, it rejects non-integers, non-finite values and unsafe products; settings outside their ranges; non-positive means and spreads; a mean less three spreads that is not positive; correlations outside −999…999; a correlation matrix that is not positive definite by the integer factorisation above; a rule with `low > high`, a negative `low`, or an `effect` whose product with 3,000 is unsafe; and every check that used `bodyKg` or `woodLoad` (such as a log still being movable, and work rates exceeding resting) evaluated at the extreme person: the lightest weight, the lowest load capacity, the highest scaled rates. It also keeps every Life 13 check on the mesh, places, thresholds and placement.

## Invariants and ledger

The checker replays the events of each `stepValley` interval against the state in checked runs, validates immutable geography once, and runs the full set at every midnight.

- **The mesh, once per layout:** as Life 13: winding, areas, neighbours, shores, shore heights, shoreline and heights within tolerance, places and banks on walkable ground.
- **Bodies and traits:** every person's sex is 0 or 1; height, weight and grip lie within three spreads of their sex's mean; trait scores lie within −3,000…3,000; and the stored load capacity, rate table, thirst thresholds, company radius, exchange rule inputs, stock target, satiation level, dusk margin, exploring range and expected share equal those recomputed from the scores and the configuration. None changes during a run.
- Every wake-up's body charge equals the person's own rates for the task over its minutes, with bounded remainders; energy and water at a wake-up equal the lazy functions evaluated there.
- **Ways:** every person holds at most `waysRemembered` ways, no two with the same end points; every way's corridor is a chain of triangles each sharing an edge with the next, every one walkable and known to the person, its first and last holding its end points; numbers are below the person's next way number; last-used minutes are not in the future. Every walk recorded as a way or joined walk stays within the triangles of the way it names. No walk is recorded as `full` (update 068). The checker does not recompute the pieces, the coarse band or the recheck rule; unit fixtures cover them.
- **Leisure:** nobody sets out on two leisure walks in one calendar day, and `leisureMinute` is the start of the last one.
- **Survey:** each observation is replayed against the rule: it is a survey exactly when the person had no survey point or stood at least `resurveyCm` from it, and the survey point changes only at a survey, to where they stood.
- No person's trip wood exceeds their load capacity.
- Every exchange's price equals the agreeableness price for its two parties, and both gained at it.
- Every person's position at every recorded minute is on walkable ground, and every route segment lies in walkable triangles the person knew when the walk started. Nobody is at two places, and the chunk index agrees with positions.
- Food, wood, logs, stones and axes conserve at every event; fish and thicket stocks replay from regrowth and takes; water withdrawals equal recorded drinks.
- The queue holds at most one task end and one threshold per living person; no wake-up is in the past; dead people have none.
- Every decision reads memory only.
- Hunger and thirst hysteresis with the person's own levels, death minute and cause, and group dissolution below two living members follow the stated order.

Events are as Life 14; a walk's start records how it was found (`plan`: `way`, `joined`, `straight` or `steered`; a walk to a frontier is straight or steered; from update 068 to 070 `coarse`, or `full` only from the guard), whether a way was dropped and planned again (`rechecked`), and the way it used (`wayId`, −1 for a new plan). An observation records whether it was a survey. Daily summaries and world metrics are as Life 14.

## Observer

Label the page **Life 15 · strangers**. Everything else in the settings screen, loading card, header, history panel, group card, playback and landscape is as Life 14, except that from update 069 the engine runs in a worker thread and the page draws from view copies of its states, as described there.

- **Ways.** When a person is followed, their remembered ways are drawn as faint lines on the ground, from the corridors pulled tight, the most recently used strongest; the current walk is drawn as before.
- **Person panel.** Adds a "Ways" row ("Knows 23"), and the current walk says how it was found: "on a known way", "joining a known way", "heading straight there" or "finding a way through" (from update 071; before, "planning a new way").

Unchanged from Life 14:

- **Figures.** Each person's figure is scaled to their height, and widened slightly with weight, so the founders visibly differ. Women and men differ only by this; no other marker.
- **Person panel.** Adds a body line, for example "Woman · 157 cm · 51 kg · grip 25 kg · carries 26 kg", and five trait rows, each a small bar from −3 to +3 spreads with a word: *very low* below −1.5, *low* to −0.5, *average* to 0.5, *high* to 1.5, *very high* above. The words are the observer's, not the engine's.
- **Exchange history.** An exchange line shows the price and which side took the larger share.

## Code layout

- New `src/valley/ways.ts`: a person's ways, finding one for a walk, joining, rechecking, remembering and forgetting.
- `routes.ts`: corridors from a way; the chunk-crossing edges in the nav map, the coarse A\* over pieces, the straight-line corridor, and the fine A\* limited to one piece (update 071); `knownRoute` split into finding a corridor and timing a path along it.
- `forager.ts`: `routeFor` uses ways, straight and steered plans in that order; the route cache and `routeKey` are removed; the idle rule takes a leisure walk or goes home to rest in place of rechecking places, and `exploreAfterHours` is removed.
- `wake.ts`: a walk's start remembers its way and records how it was found.
- `perception.ts`: the survey point; the still landscape surveyed only after moving `resurveyCm`; people-made places and people every wake-up.
- `types.ts`, `config.ts`, `engine.ts`: the person's ways, next way number and survey point, shared between states; the new parameters and their validation.
- `invariants.ts`: the checks above.
- `src/valleyView/`: the followed person's ways, the panel wording, the Life 15 label.
- `docs/LIFE14_SPEC.md` is removed: this specification replaces it.

Bodies and traits (`nature.ts`), the terrain, hydrology and mesh (`terrain.ts`, `water.ts`, `mesh.ts`) are unchanged. The MVP9 core is unchanged.

Update 068 changes `routes.ts` only for behaviour: a person's pieces, worked out per chunk from knowledge and cached by knowledge like the known pieces of ground; the coarse A\* over pieces in place of chunks; the full search kept as the guard. `invariants.ts` rejects a `full` walk. The speed work that follows may touch any engine file, but none of it changes a result. The observer is unchanged.

Update 069 touches only `src/valleyView/`: a new `engineWorker.ts` that builds the valley, runs towards the goal in slices and posts view copies; a new `engineLink.ts`, the page's end of the worker, which starts it and turns the changes received into states; a new `viewCopy.ts` that makes a view copy, finds its changes from the last one in the worker, and applies them on the page; playback in `valleyViewModel.ts` (`advancePlayback`, `receiveState`, `stepPlayback`, `changeSpeed`) in place of stepping the engine within a frame budget, used by `ValleyApp.tsx`; and `LifePage.tsx` starting the worker before building the page's own valley, so the two builds run at once. The engine is unchanged.

Update 071 changes `routes.ts`: a straight-line corridor through the mesh; the chain of pieces kept as a list of pieces; the crossings between pieces; the fine A\* limited to one piece in place of a band; the band and the full search removed. `ways.ts` and `types.ts` name the plans `straight` and `steered` in place of `coarse` and `full`; `invariants.ts` drops the `full` check and adds the checks below; the panel wording in `valleyViewModel.ts`. `knownRoute`, the shortest path over all known ground, stays for tests and measurement only.

Update 070 changes no result: `wake.ts` skips absent group members in an exchange; `perception.ts` scans nearby chunks without temporary lists and finds route crossings with a reused buffer; `clock.ts` cancels lazily; `engine.ts` adds `advanceValley` and counts known places without copying; the worker advances its state in place, and `viewCopy.ts` snapshots the followed person's memory.

## Tests and implementation acceptance

The Life 14 fingerprint suite passes before engine edits. Every trajectory changes, because reused ways and coarse plans give different paths and the survey rule changes what people know when: this step records new fingerprints for all its configurations. The founders, their bodies and traits stay the same as Life 14's on every fingerprint seed, because the code that draws them is untouched; `life13-founders.json` still checks starts and born skills. Fingerprints are not updated to conceal a failed rule.

New unit fixtures:

1. Reuse: a second walk from home to a thicket follows the first walk's corridor; a walk back from the thicket follows it reversed.
2. Joining: a walk starting in a triangle of a way to the target follows the rest of that way and is recorded as joined; a walk starting one triangle off it is planned.
3. Recheck: on a fixture where new ground opens a shorter path, the way is kept within a day of planning, replaced after a day, and kept after a day when nothing new was seen.
4. Forgetting: with `waysRemembered` ways held, a new way forgets the one used longest ago; a new way between the same end points replaces the old one.
5. Load: the same way walked loaded and unloaded has the same corridor and different times.
6. Replaced at update 071 by its fixtures 1 and 2, below.
7. Pieces and links: a chunk whose known ground is split by unknown or unwalkable ground holds two pieces; two pieces are linked only when the person knows walkable triangles on both sides of a crossing edge; a chain never passes from one piece of a chunk to another inside it.
8. Replaced at update 071 by its fixture 6, below.
9. Replaced at update 071 by its fixture 7, below.
10. Survey: a person who has moved less than 100 m learns no new triangles; after moving 100 m they learn what came into sight.
11. The checker rejects a way through an unknown triangle, a corridor with a gap, one way too many, and a survey recorded against the rule.
12. Leisure: an idle person at home with nothing to explore walks out along the way from home used longest ago, once a calendar day; away from home they walk home to rest; with no time to return before dusk they rest.

Life 14 fixtures, kept:

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
11. The checker rejects a weight outside three spreads, a stored load capacity that disagrees with grip, a trip load above capacity, a body charge at the reference rate instead of the person's, an exchange off the agreeableness price, and the earlier corruptions.
12. The existing queue, lazy-body, places, mesh, routes, food, fire, hut, axe, trade, group and playback tests, with route fixtures updated where a reused way or a coarse plan now gives a different path.

**Update 068.** `fingerprints.test.ts` passes before the engine is changed. Planning by pieces changes every trajectory but the flat land's, so new fingerprints are recorded once for it; the founders, bodies and traits stay the same. Every speed-up after that leaves those new fingerprints unchanged, whole and in 15-minute slices. Measured once and recorded in the lab notes, on the canonical seed: the walks of each kind on days 5, 12, 13, 16 and 30, with no full walk; the median and largest excess of coarse plans over the shortest known path; each of the first 45 days' time in whole-day steps; profiles of days 13 and 30; and, in off-screen Chrome as in update 067, frames and days a second at 1 month/s past day 35. In the browser: a walk planned around a lake, and the console clean.

**Update 069.** The engine is unchanged, so every fingerprint stays the same. A few fast unit tests: applying the changes of a short run's states, one after another and copied as between threads, gives each state's view copy exactly, at strides from 1 to 1,440 minutes and across a change of the person followed; the copy keeps only the routes, wake-ups and events above, and current memory only for the person followed; a state the engine recopied unchanged sends nothing; and the playback rule never goes back, draws less than a minute after the state it draws from, asks no further ahead than the lead, runs at the speed shown when the engine keeps up, waits when it does not, and shows Step's minute once it arrives. Measured once and recorded in the lab notes, in off-screen Chrome as in update 067: frames a second at 1 min/s, 1 day/s and 1 month/s, the longest frame across days 12 to 14, and days a second at 1 month/s past day 35, before and after; and the time the copies take in the worker and on the main thread. In the browser: people walk smoothly at 1 min/s, the Step button and pause work, a new run from Settings starts cleanly, and the console is clean.

**Update 070.** Every fingerprint stays the same. A few fast unit tests: advancing a state in place equals stepping copies of it, minute by minute and across days; and the view-copy tests run on a state advanced in place, checking each copy equals the one made from a pure copy of the run. Measured once and recorded in the lab notes: days 50 to 59 at 1 month/s in Node, before and after.

**Update 071.** `fingerprints.test.ts` passes before the engine is changed. Every trajectory changes, so new fingerprints are recorded once for all 22; the founders, bodies and traits stay the same. Fixtures 6, 8 and 9 above are replaced, and route fixtures elsewhere updated where a straight or steered walk now takes a different path. New unit fixtures:

1. Straight: on open known ground a walk's corridor is exactly the triangles its line crosses, and the walk is recorded as straight.
2. Blocked line: with a strip of unknown ground across the straight line, the walk is steered round it, and no triangle of its corridor is unknown.
3. A line through a vertex counts as blocked, and the walk is steered.
4. Crossings: between two pieces with two crossing edges, the walker takes the one whose midpoint is nearer the line to the target.
5. Within a piece: where a lake inside one chunk blocks the line between entry and exit, the stretch goes round it within that piece, and the corridor never leaves the chain's pieces.
6. Same chunk, two pieces: a walk between two pieces of one chunk, joined only through a neighbouring chunk, is steered and goes round.
7. The checker rejects a way remembered from a straight walk that is not the triangles its line crosses, and a new way holding a triangle twice.

Measured once and recorded in the lab notes, on the canonical seed: the walks of each kind on days 5, 13, 30 and 55; the median and largest excess of straight and steered walks over the shortest known path; each of the first 60 days' time in 12-hour steps as the worker runs, against update 070's; and a profile of days 50 to 60. In the browser: a walk steered round a lake, the panel's wording, and the console clean.

Final validation is `npm run agent:check`. Measured once at update 066 and recorded in the lab notes, on the canonical seed: the walks of each kind by day; the median and largest excess of way walks over the shortest known path; the share of new plans needing the full search; the year of forty's time and memory; and a profile of day 12 against update 065's. In the browser: a followed person's ways drawn, the panel's wording during a walk, 1 month/s against the 8 frames a second of update 065, and the console clean.

## Questions for later

- Should people join a way from nearby, not only from on it, and how near?
- Is once a day the right pace for noticing a shortcut, and should it depend on openness?
- Should ways be chosen by expected time, with slopes and ground, rather than distance?
- Should the coarse level be landmarks (places, banks, the hearth) rather than pieces of squares of land?
- Joining a remembered way from nearby, rather than only from a triangle on it, and chaining ways through the places they share ("back to camp, then out along the other way"): how near, and does it make walks more lifelike than a steered plan? (Update 071 leaves both out.)
- After update 070, which still reaches about 6 days a second at 1 month/s, which way to a month a second: cheaper route planning and water choice, which change no result, or people thinking less often (surveying and replanning less), or a simpler model of daily movement at map speeds? The last two change what people do.
- The hut-building week (days 11 to 17 on the canonical run) takes 0.5 to 3.3 s a simulated day against about 0.25 s later, from its many cutting and log-carrying walks. What would make it affordable at a month a second?
- Every route ever walked stays in the state, 27,000 by day 45. Should finished routes be dropped once no task or record refers to them?
- A way is rechecked whenever a day has passed and the person has learnt anything, which after the first days is almost always. Should only new ground near the way count?
- Do shared ways wear trails that make walking faster, and do trails gather people and places along them?
- Should a person tell or show a way to someone they trust (steps 16 and 24)?
- Does sight need to stop at ridges once surveys are rarer?
- How strong should each trait's effect be? The effects here are judgement; there is no field measure of how far an extravert walks to meet a stranger.
- Does the mean body mass, by scaling energy, change survival at forty founders compared with Life 13?
- Do strong people end up gathering most of the wood, and do agreeable people end up poorer?
- Should height affect walking speed (longer legs), or only weight and load?
- Should strength also speed chopping and log carrying?
- What default year, within 60 to 120 days, makes seasons long enough to matter?
- Should personality drift with age and experience, once people age at step 19?

## Left out

Trails, shared or taught ways, ways blocked by anything, and sight blocked by relief; children, growth, ageing and pairing (step 19); fights, injury, yielding and fear in disputes (step 17); relationships (step 16); prestige and leadership (step 18); illness; heat balance and clothing; skills correlated with body or traits; personality change; any trait used by more than one rule; wading, swimming and boats; seasons and weather; herds, planting, property and recipes beyond axes and huts.

## References

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
