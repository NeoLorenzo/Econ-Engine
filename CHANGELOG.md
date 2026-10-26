# Econ-Engine changelog

All notable changes to Econ-Engine are documented here. The changelog records what changed in each update. Design rationale, experiments, observations, and lessons are documented separately in [Lab Notes](LAB_NOTES.md).

## [LIFE14-Bodies-064] - (2026-10-26)

- Adults now have sex, correlated height, weight and grip, and five correlated personality scores, drawn by integer arithmetic from isolated streams. Founder positions and born skills retain their Life 13 draws.
- Individual bodies set wood capacity, loaded walking speed, energy rates and thirst thresholds. Personality sets approach distance, exchange gain share, wood stocks and satiation, the return-before-dusk margin, and idle exploration and unseen-stock expectations.
- The checker recomputes personal quantities, verifies charges and historical exchange prices, and rejects changes to bodies or traits. Added distribution, rule, stream and corruption fixtures; Life 14 replaces the Life 13 spec and fingerprints.
- Life 14's observer shows scaled figures, body measurements, five trait bars and recent exchange prices/shares. Terrain, hydrology, mesh generation and the MVP9 core are unchanged.

## [LIFE13-Mesh-063] - (2026-10-24)

### Added

- Life 13, a new roadmap step before bodies and personality: a ground mesh over the whole valley. It is a constrained Delaunay triangulation whose edges follow every shore within 1 m, and whose heights stay within 1 m of the terrain at every dry 5 m point. Triangles are ground, lake or river, so later steps can let people wade, swim or sail without a new map.
- People walk any known ground triangle. Routes are found over triangles and pulled straight through them, so a person walks round a pond by its own width, and along a 5 m strip of land the old 20 m grid could not use.
- A bank point on the ground side of every shore edge.
- Founders start on the main land, the largest walkable region.
- The 3D view and the land map draw the ground and water from the mesh: flat-shaded triangles, each ground triangle in its ground's colour, water coloured by depth.
- Mesh checks: winding, areas, neighbours, shores, heights and shoreline against the terrain and hydrology.

### Changed

- People remember the triangles they have seen instead of 20 m lattice nodes. A copy of the valley shares this memory until a person learns something new.
- Configuration: `routeCellCm` is replaced by `meshMaxEdgeCm` (40 m), `meshHeightToleranceCm` (1 m) and `shoreToleranceCm` (1 m).
- Starting a walk no longer counts as entering the chunk it starts in, so it no longer wakes everyone there. A group cutting logs near home had been re-planning each other about ten times a minute.
- Rechecking a remembered place now skips places that cannot be reached over known ground, such as a grove seen across water. People who had explored all their land were choosing such a place, failing to route to it, and choosing it again at every wake-up.
- Faster simulation without changing any run: route search first checks that start and target are on the same piece of known ground; those pieces, and the edge of the known ground, are extended as people see new triangles rather than rebuilt; route caches are shared between copies of the valley until written. Thirty days of forty founders take about 2.5 minutes instead of 12.5.
- Every fingerprint is re-recorded, because every route changes.
- Roadmap steps 13 to 24 become 14 to 25.

### Removed

- The 20 m route lattice, and the grid-based ground and water drawing.

## [LIFE12-Speed-062] - (2026-10-24)

### Changed

- A step no longer copies every person's bank memory. A copy shares its original's memory, and a person's memory is copied only when they first learn a new bank. Copying the valley for a step falls from about 140 ms to 2 ms with forty founders, so 1 h / s now runs at its label. The fingerprints are unchanged.

## [LIFE12-Observer-061] - (2026-10-23)

### Changed

- The loading card stays until the valley's first frame is drawn, so no blank page shows while the 3D view starts.
- The page heading shows the day, season, time and the number alive, and holds New run.
- The person panel shows the name, then what they are doing, then bars for energy, thirst and load, then rings for picking, wood and axe-making skill. The rest is in a Details section, closed by default.
- The history panel is titled History and holds only its charts. The run's settings, the controls and the colour key are in an ⓘ window; the long description is removed.

## [LIFE12-Settings-060] - (2026-10-23)

### Added

- The Life page opens on a settings screen: seed, days per year (8 to 365), world size (1 to 10 km), founders (1 to 100) and a scattered or together start, each with its range, and a Start button. Start shows the loading card while the valley is built. The settings are fixed for the run; the history panel states them, and New run returns to the settings screen, prefilled.
- A world of another size than 4 km scales its counts of places and landforms with its area, so worlds of 1 to 3 km can be laid out.
- Record a fingerprint for the forty-founder default on seed 20260813.

### Changed

- Forty founders by default. The eight-person fingerprint configurations and the flat test land name eight founders, so their 21 fingerprints are unchanged.
- Remove Life 11's setup form and Reset; its other parameters are configuration only.

## [LIFE12-Loading-059] - (2026-10-23)

### Added

- Show a loading screen while the valley is generated: on page load before the first valley exists, and after Reset while the new one is built. The first valley is built once, even where development runs state initialisers twice.

## [LIFE12-Refoundation-058] - (2026-10-23)

### Changed

- Remove the per-minute representation: the old configuration keys, movement segments, per-second body records, plant memories and the Tobler and Pandolf tables. Validate the founders' range and start area, stands holding whole trees, and a minute's work at every place.
- Port the observer to the wake-up engine. People are drawn from their task records at the displayed minute, which stays within the minute the state has reached. Map speeds, from a day a second, hide people. Places are drawn as decoration sharing out their stock. The person panel shows the task, its reason and the next wake-up, and the header shows the calendar. The page is **Life 12 · strangers**.
- Each frame runs the engine once, and the minutes a frame may run double or halve with the frame budget.
- Fix two checker faults found by the fingerprint runs: a cut started and interrupted in the same minute was credited with the previous cut's log, and a dead member of a group that later dissolved was reported as having no standing group.
- Record new fingerprints for all 21 configurations and seeds. Delete the Life 11 specification, and update the architecture, validation, calibration and README documents for Life 12.

## [LIFE12-Ledger-057] - (2026-10-23)

- Replace the minute checker with interval replay of bodies, stocks, observations, tools, huts and external water withdrawals, plus physical routes, queues, event order, group/fire and regrowth checks.
- Record world boundaries, fish growth and sleeping warmth changes; retain task-start loads for validating production and travel. Refresh the derived chunk index at interval endpoints.
- Port the retained corruption cases and analytic examples. Check a canonical thirty-day run at daily intervals with all eight founders alive. Tasks 9–13 remain pending.

## [LIFE12-Review-056] - (2026-10-23)

- Cache shoreline connectors, index estimated bank candidates, bound real water-route searches to three, and reuse immutable perception/route calculations.
- Reject founder draws without a route connector and choose sources connected through observed ground. All eight canonical founders survive thirty and ninety days; no thirst thresholds or resource amounts are relaxed.
- Restore retained Life 11 fire, hut, social, food, carrying and water rule coverage, including the daily fire-contribution counter it exposed. List every deliberate removal and replacement in the lab notes.
- Before Task 8, the canonical 90-day simulation takes 4.371 s (48.57 ms/day averaged); creation takes 7.264 s separately. The specification's subsecond goal remains unmet.

## [LIFE12-Refoundation-055] - (2026-10-23, Task 7 checkpoint)

### Changed

- Implement the first seven tasks of the approved Life 12 re-foundation: configurable calendar, aggregate resource places, deterministic wake-up queue, lazy bodies and tasks, known dry lattice routes, and perception at wake-ups.
- Port sleep, exploration, harvesting, drinking, loads, meetings, groups, shared fires, huts, axes and exchange into the wake-up pipeline. Preserve the owner's decisions on stock-dependent picking and configured walking pace.
- Record interval events and daily summaries without advancing every person each minute. Retain independent three-log regrowth schedules within aggregate stands.
- Stop before Task 8 for review. Lint passes; the full gate is blocked by the checker and observer ports scheduled in Tasks 8 and 10. Fingerprints, browser acceptance and canonical-year timing remain later plan tasks. See the matching lab-notes entry for every port choice and checkpoint limitations.

## [LIFE11-ContinuousBanks-054] - (2026-10-22)

### Changed

- Replace square-cell shores with continuous slopes and terrain-clipped water contours. The owner approved this Life 11 refinement on 2026-10-22.
- Use the same immutable bank triangles for rendering, ground contact, water collision, dry placement and drinking/fishing access. Observed routes can connect safely to dry bank approaches inside shore cells; all edges retain centimetre rounding clearance.
- Compute fish habitat areas from non-overlapping water polygons, summing exact doubled square-centimetre areas before rounding once to square metres.
- Retain terrain/water/vegetation visibility tiling and simulation-time animation from the performance repair. Bank contact and tile picking have regression fixtures.
- Validate all 21 required 30-day trajectories with the minute checker: refresh 18 terrain-bearing fingerprints and retain the three flat-land records. The CI implementation gate passes, including an independent repeat of the canonical trajectory. A worker-limit environment option bounds local validation memory without reducing coverage.

## [LIFE11-Performance-053.1] - (2026-10-22)

### Changed

- PR CI runs correctness tests and one canonical 30-day fingerprint, with the required `browser-check` status preserved.
- Merging runs only the Pages build and browser smoke check before deployment; it no longer repeats the simulation suite.
- Manual validation and local full commands retain all 21 fingerprints. Added `test:ci` and `agent:check -- --ci` for the PR profile.
- Validation: the PR-profile gate passed lint, typecheck, 489 tests and build; tests took 4m 32s locally. Selection checks retain all 488 non-fingerprint tests and all 21 fingerprints in full mode. Workflow YAML checks passed; hosted CI awaits a push.

## [LIFE11-Performance-053] - (2026-10-21)

### Changed

- Reuse observed-ground frontiers and travel-cost buffers instead of repeatedly scanning or clearing the whole map. Reject unknown or too-distant destinations before calculating return journeys.
- Bound trip and food-score searches, check shared homeward routes first, and reuse exact travel estimates and failed-budget proofs. Search remembered shores through spatial rings.
- Reuse canonical route subpaths, skip observed cells through a compact bit index, and remember completed distant ground views. Cache idle reachability witnesses and budget proofs; previous site winners establish bounds without changing selection.
- Keep fast playback responsive by budgeting batches between completed minutes and running one tick per frame after a slow tick. Simulation time still advances through consecutive real states.
- Refresh the observer's ground overlay and remembered banks only when their underlying knowledge changes, and avoid rescanning unchanged hourly ground views.
- Life 11's rules, random streams, integer accounting and recorded fingerprints remain unchanged.
- Validation: npm run agent:check passed with all 21 fingerprints unchanged. The test stage took 957.3 seconds (15m 57s), down from the first pass's 29m 44s and Life 11's original 53m 14s. The two-day canonical profile fell from roughly 35 seconds to 21.3 seconds with unchanged output. Maximum-speed browser controls passed with a clean console.

## [LIFE11-Water-052] - (2026-10-21)

### Changed

- **Water follows the land:** deterministic drainage fills hollows to their spills and cuts river channels, replacing the external north-edge lake and shore ramp. Each lake and river reach has its own fish stock.
- **People need to drink:** observed dry banks supply water, resting and work cause exact integer water losses, and severe thirst interrupts sleep or returning home. Drinking, withdrawals and dehydration deaths are recorded and checked every tick.
- **Known dry routes:** people walk around water using observed ground, explore incomplete routes and occupy dry camps without teleporting when groups form. Starts have separate named random streams.
- **The observer shows the new world:** exact wet footprints, optional downstream arrows, remembered banks, planned routes, segmented movement, drinking and water-body inspection. Hydration and death causes appear in the person panel.
- The current specification, calibration limits, architecture, validation and README describe Life 11. Earlier specifications remain in Git history.
- Validation: `npm run agent:check` passed, including all 21 refreshed 30-day fingerprints; browser checks passed. Large-map routing remains slow.

## [LIFE10-GlacialRelief-051.2] - (2026-10-20)

### Changed

- **Relief that is visible where play begins:** stronger evidence-bounded landform heights, sharper two-scale microrelief, a south-eastern quiet till plain, and an offset train of twelve flow-aligned drumlins through the inhabited centre replace the chance flat gap around the starting view.
- **A terrain-first observer:** the ground now renders the full 5 m lattice, uses stronger directional light, casts its own shadows, adds restrained albedo grain, and starts from a lower camera angle. Visual detail still leaves mesh positions unchanged, so people, plants and structures remain on the same contact surface.
- Terrain measurements, deterministic fingerprints, specification, calibration, architecture, validation and lab notes are updated.

## [LIFE10-GlacialTerrain-051.1] - (2026-10-20)

### Changed

- **A coherent glacial landscape:** the geometric ridges, circular hills and independent surface patches are replaced by a shared regional ice-flow field, terrain zones, three broken asymmetric moraine belts, 56 aligned drumlins, 18 irregular kames, 240 clustered hummocks, 76 irregular kettles, two broad tunnel valleys, quiet till plain and two finer scales of relief. Each family keeps its own named random stream.
- **Relief-derived ground:** the whole map remains grassland; dirt now follows moderate slopes and sharp local curvature, stone follows the steepest slopes, and the observer softly blends cell colours without changing their simulation types.
- **Close-up detail without contact errors:** fine visual grain perturbs lighting normals only. The mesh vertices and every person, structure, plant, marker and prop still use the same sampled surface, so detail cannot make objects float or sink.
- Terrain configuration, validation, metrics, unit tests, all non-flat fingerprints, the specification, calibration, architecture, validation, roadmap, README and observer text are updated.

## [LIFE10-TerrainVariety-051] - (2026-10-19)

### Changed

- **More varied terrain:** the broad relief now carries 12 long moraine ridges and 40 separate round hills, each from its own named random stream, before hummocks and kettle hollows are applied. Overlapping ridges and hills use the strongest contribution of each kind, keeping the relief bounded while giving it recognisable landforms.
- **One grassland:** wet, sand, soil and rock ground are replaced by grass, coherent patches of exposed dirt, and exposed stone on outcrops and the steepest slopes. Plants and starts use grass or dirt; terrain factors are 120 for grass and dirt and 150 for stone.
- **Ground contact:** the observer now builds one sampled display surface for both the visible mesh and object placement. People, including displaced sleepers, huts, hearths, flags, rocks, plants, fallen trees, crowns and ground markers use that surface; rings, group discs and guide lines follow its relief instead of cutting through a flat plane.
- Configuration validation, terrain and observer-surface unit tests, the canonical fingerprints, the Life 10 specification, calibration, architecture, validation, roadmap and README are updated for the new land.

## [LIFE10-TerrainAndScale-050] - (2026-10-19)

### Added

- **Life 10: terrain and scale.** The 800 m valley becomes a generated stretch of young moraine country 4 km square, falling to a lake along its north edge: a broad rise and fall of up to 30 m, hummocks up to 8 m high and 200 m apart, and 80 kettle hollows 20 m to 60 m in radius. Heights are held on a 5 m lattice in whole centimetres (`src/valley/terrain.ts`).
- **Ground:** each 5 m cell is wet (inside kettles and along the shore), rock (at outcrops and on slopes of 20% or more), sand (on low ground) or soil. Berry bushes grow on sand or soil, hazels on soil, trees anywhere but rock, and outcrops on dry ground; a site's centre is drawn only where its whole circle suits its kind.
- **Walking on slopes:** speed follows Tobler's hiking function for the grade ahead, as a table of thousandths; energy follows the Pandolf equation with its grade term, Santee's correction downhill, and the terrain factor of the ground underfoot (soil 120, sand 150, rock 150, wet 180). Each walking minute records its target, grade, terrain factor and climb.
- **Judging a walk by Naismith's rule:** every rule about time uses the flat walk plus 6 seconds for every metre climbed.
- **Hills block long sight:** by day a forager sees within 1 km of its place's centre only into places reached by rays from its eye over the ground, worked out once per place and kept (`src/valley/sight.ts`). It looks round by long sight when it stands in a new place or after an hour; close sight, every minute, also records trees and stones.
- **Chunks:** food, wood, trees and stones are indexed by 200 m chunk, and searches for the best or nearest go outwards ring by ring until nothing further could win, giving the same result as a search of everything (`forEachRingOutwards`).
- `FLAT_LAND`, a flat 800 m land with Life 9.7's sites, on which tests of rules that need no terrain run. `landStats` measures the generated land. `terrain.test.ts`.
- **Observer:** the ground is a mesh of the height field coloured by ground, with everything at its height and the followed forager's knowledge laid over it; bushes and hazels are drawn in 400 m tiles near the camera; a map of the whole land in a corner, which moves the camera when clicked; the HUD shows the ground underfoot, its height, the slope walked and the climb today. "Life 10 · terrain".
- The [calibration document](docs/CALIBRATION.md#terrain) gains a section for terrain, with nine sources.

### Changed

- **Defaults:** 800 berry thickets, 800 hazel thickets, 300 stands and 100 outcrops (25 times Life 9.7's), a lake of 150 hectares, starts within the middle 800 m (`startAreaCm`). `walkTerrainPercent` is replaced by four terrain factors. The camera pulls back to 5 km.
- **The roadmap** merges scale and terrain into step 10; the later steps move up by one.
- Daily summaries record each forager's height climbed and energy spent walking.
- The checker replays sites in close sight every minute and every site every hour, and checks the layout's ground once.
- Fingerprints are recorded anew for seven configurations, the flat land among them.
- `docs/LIFE10_SPEC.md` replaces `docs/LIFE9_SPEC.md`.

## [LIFE-Roadmap-049] - (2026-10-19)

### Added

- **A new roadmap for the Life core,** [docs/ROADMAP.md](docs/ROADMAP.md). Its goal is a realistic life in Mesolithic northern Europe, built world first: scale (Life 10), terrain, water, seasons and weather, vegetation, plant-eaters and predators as individual agents, and people hunting in that world (to Life 17); then the body (18 to 19), making things (20 to 22) and people together (23 to 26). Each step is checked against real measurements. Economic behaviour is watched for, not built towards.

### Changed

- **The merge document's ladder** now records steps 0 to 9 and points to the roadmap; its steps 10 to 12 (storage and claims, generations, a medium of exchange) are removed.
- `AGENTS.md` points Life work at the roadmap, and a step's specification opens with what it makes realistic and the measurements it is checked against, in place of its question. The README, the vision document and the Life 9 specification point to the roadmap instead of the ladder's later steps.

## [LIFE9-HazelAndLake-048] - (2026-10-19)

### Added

- **Life 9.7: hazel thickets and a lake.** 32 hazel thickets of 40 hazels, a fourth kind of site, each hazel growing 1.5 kg of nuts in their shells (3,750 kcal) a year and holding half that. Nuts are gathered and cracked at 3,500 kcal an hour at a full hazel, weigh a kilogram for 2,500 kcal and keep half a year. Hazels are food plants after the bushes (`foodStock`, `foodMemory`, `targetFoodId` replace `bushKcal`, `bushMemory`, `targetBushId`).
- **A lake of 30 hectares beyond the valley's north edge,** fished from the shore straight north of the fisher. Its fish, 100 kg a hectare (1.8 million kcal) at most, grow by the logistic rule at 40% a year, counted exactly with a remainder, so a lake fished to half grows most and one fished out recovers slowly. Fish are caught at 600 kcal an hour at a full lake, weigh a kilogram for 600 kcal and spoil in a day. A forager knows the lake once it sees the shore and learns its stock only by fishing.
- `src/valley/lake.ts`, and food helpers in `food.ts`: food kinds, weights, shelf lives and the rate at a source.
- Every new number is sourced in a new section of the [calibration document](docs/CALIBRATION.md#hazel-and-the-lake).

### Changed

- **Food comes more slowly as a source thins:** the rate at a bush, hazel or the lake is the full rate times the share left, and a source is worked while an hour there brings more than the 200 kcal it costs. The minute's-worth floor for food is gone.
- **Choosing food:** a forager weighs every bush and hazel it remembers as worth working, the nearest unchecked thicket of each kind (expected full) and the lake, and goes where an hour brings most food for the walk.
- **Born foraging and wood skills** run from 75% to 125% (were 100%). One foraging skill and practice serve berries, nuts and fish (`nutRate`, `fishRate`).
- **The valley is 800 m across** (was 600 m), with 80 sites and 729 places.
- Carried food is held in lots of one food each, spoiling by that food's shelf life and weighed by its own kilocalories a kilogram; action events record the food, its source's stock and the load of each food.
- Renamed `forageKcalPerHour` to `berryKcalPerHour` and `shelfLifeHours` to `berryShelfLifeHours`. The rule that a bush must hold a minute of picking is replaced by one that each food, full, must be worth working to the slowest forager; a lake too large to count exactly is refused.
- **Observer.** "Life 9.7 · hazel and a lake": tall hazels whose nut clusters shrink as they are gathered, the lake beyond the north edge, a fisher holding a rod at the shore, inspectors for a hazel and the lake, the followed forager's born skill, rates for each food and carried food by kind, and charts of food taken by kind and of nuts and fish left.

### Validation

- The checker replays nuts on hazels and fish in the lake, including the lake's growth, and checks that food is taken only from a source worth working, at its rate there, within reach, and that a fisher remembers the stock it found. New unit tests cover loads of three foods, the lake's growth, rates by stock, the choice of food, fishing, spoilage by food, configuration rules and the checker catching fish made from nothing, food taken too fast and a forager on the water. New fingerprints for Life 9.7; the band with unequal skills is replaced by a band born alike.

## [LIFE9-Calibrated-047] - (2026-10-19)

### Changed

- **Life 9.6: every physical number is set from real measurements.** The new [calibration document](docs/CALIBRATION.md) compares each parameter with real-world figures and lists their sources. The valley is placed in Mesolithic northern Europe.
- **Berries.** A bush yields 900 kcal (1.5 kg) a year, spread evenly over the year, holds at most three weeks' yield (52 kcal), and berries carry 600 kcal a kilogram. The valley now feeds about two people, not fifteen.
- **Bodies.** A forager's reserve holds 70,000 kcal, a store of fat, and it starts at 66,000; hunger thresholds keep their distances from a full reserve.
- **Work costs by task:** picking 200 kcal an hour, gathering wood and fetching stones 250, cutting logs 360, making axes 150 (`forageCostKcalPerHour` is removed).
- **Carrying.** Walking costs the Pandolf rate for the load and speed, 222 kcal an hour unloaded on light brush, and a load slows a walker by only 3% at 40% of body mass (`walkTerrainPercent`, `loadSlowdownPerMille`; `travelKcalPerHour` is removed).
- **Cold nights** cost 90 kcal an hour asleep with neither fire nor hut, 75 in a hut alone and 70 by a fire alone.
- **Firewood is dead wood.** Dead branches gather under standing trees at 5 kg a year (`treeDeadfallWoodPerYear`), and bushes grow 2 kg of sticks a decade (`bushRegrowthWoodPerDecade`). Wood is gathered at 15 kg an hour.
- **Trees, axes and huts.** A felled tree grows back in 20 years, a fresh log weighs 35 kg, a ground stone axe takes 50 hours to make and lasts 200 logs at quality 100, and a hut loses a log every 60 days.
- **Observer.** "Life 9.6 · a realistic valley": dead branches lie beneath each standing tree, the followed forager's card shows its days of food left at its recent rate, and the setup links to the calibration document.

### Fixed

- The checker no longer reports a hearth moved without joining a group when a forager founds or joins a group that dissolves in the same minute because a member starves.

### Validation

- A new invariant checks that every second is charged the cost of its task, warmth or load. New unit tests cover yearly and decade regrowth, the Pandolf rate and speed under a load, task costs, dead branches, days of food left and a group founded and dissolved in one minute. New fingerprints for Life 9.6.

## [LIFE9-LogHuts-046] - (2026-10-18)

### Changed

- **Huts are built like real log huts.** A hut is a small A-frame for one sleeper, 2.4 m long, about 1.5 m wide and 1.2 m tall, its open end towards the fire: two A's of a log each, 9 wall logs a side each resting on the one below, a ridge log, and two logs cut into posts closing the back. Every log is drawn as a 20 kg pole, 14 cm thick and 2.4 m long, touching the ground or the logs laid before it, with no gaps and nothing in the air. The log carried home rides on one shoulder, pointing the way its carrier walks.
- **A whole hut takes 23 logs** instead of 10 (`hutLogs`).

### Validation

- New fingerprints for the 23-log hut; unit tests for the hut plan check every log's pieces fit in one log and every piece rests on the ground or on one laid before it.

## [LIFE9-CampAndFirewood-045] - (2026-10-18)

### Changed

- **Life 9.5, a revision of Life 9.** The ladder is unchanged.
- **Firewood comes from living plants.** There is no deadwood. Bushes hold 2 kg of sticks each and trees hold branches, both gathered by hand; thickets now hold wood as well as berries. A forager gathering wood clears a felled tree's crown it knows before taking from anything still growing.
- **Trees come down whole.** The first log cut from a standing tree fells it, bringing 10 kg more branches down with its crown, and its other logs are cut from the trunk where it lies. A member finishes a felled tree before felling another. A stump grows back into a whole tree 60 days after it fell, replacing the log a tree regrew every 30 days.
- **Huts stand on a ring round the fire.** The first ring holds 8 huts 7 m from the fire and the second 16 at 14 m, replacing Life 9's square spiral 3 m apart (`hutRingCm` replaces `hearthSpacingCm`).
- **Warmth comes in four steps.** An hour asleep costs 60 kcal in a whole hut by a lit fire, 80 by the fire alone, 120 in a hut alone and 150 with neither (new `fireSleepKcalPerHour` and `hutSleepKcalPerHour`). In Life 9 a whole hut was as warm as the fire. A forager without a group now tends its own fire in its hut too.
- **The observer** shows felled trees lying beside their stumps, trunks shortening as they are cut up and crowns shrinking as their branches are gathered; huts turned with their length towards the fire, long enough for their builder to sleep inside, feet to the flames; members' wood stacked beside their huts, and a fire of its own only for a forager without a group. The inspector shows a bush's sticks and a tree's state; the followed person's activity names sticks, branches, felling and its warmth.

### Validation

- New fingerprints for Life 9.5. The invariants replay every tree's fall and regrowth and check every sleeper's warmth; new unit tests cover felling, stumps, sticks, branches, rings, warmth, and the observer's trees and hut facing.

## [LIFE9-HutsAndAxes-044] - (2026-10-18)

### Added

- **Life 9: huts and axes.** Every member wants a hut of its own, 10 logs at its sleeping spot, and a whole hut keeps it warm at night even when the fire is out. Logs are cut from standing trees, which regrow a log every 30 days, and only with an axe. An axe is made at the hearth from a stone, picked up at one of 4 new rocky outcrops, and a kilogram of wood. Craft at making axes grows with practice: the more practised make axes faster and better, and better axes cut faster and last longer. Axes wear out, and huts lose a log every 10 days.
- **Trading axes.** A member that needs an axe asks the members around it; the cheapest maker that would gain it one promises to make one, and sells it for food at the midpoint of what it costs the maker and what it is worth to the buyer.
- **More trees:** 12 stands of 12 trees, against 8 of 8.
- **The observer** shows trees shrinking to stumps, stone heaps, huts rising log by log, logs carried on the shoulder, axes swung at trees and axes being made. The HUD shows the followed person's hut, axe, craft and axe trades; the group card gains a table of axes and huts; stones and huts can be inspected; a chart shows axes made and sold and huts whole.
- Two switches, `axeTrade` and `craftPractice`, and a range for born craft.

### Changed

- The Life workflow in `AGENTS.md` is lighter for the current feature-building phase: no throwaway prototypes, multi-seed sweeps or experiment tests unless the owner asks.

### Removed

- Life 8's experiments, their tests and `experiments.ts`, and the switches `sharedFire`, `campfirePerMember` and `feedSpare`, which only recreated Life 8's comparisons.

### Validation

- New fingerprints for Life 9; unit tests for huts, axes and trade.

## [CI-DeployAfterValidation-043] - (2026-10-17)

### Changed

- **The site deploys once validation passes.** The Pages deploy no longer runs lint, the typecheck and the whole test suite itself. It starts when "Validate fast-mode browser responsiveness" finishes on a push to `main`, deploys only if that run passed, and then only builds the same commit and publishes it. The tests run once per push, split across three machines, rather than twice.
- **An older commit cannot replace a newer site.** The deploy skips a commit that is no longer the newest on `main`, such as a validation of an older commit that is re-run or finishes late.
- A manual run of the deploy still builds and publishes the commit it is run on.
- The README and validation guide describe the new order.

### Validation

- `npm run agent:check` passes.
- The new trigger can only be seen working on GitHub after this change is on `main`: its own merge should deploy about a minute after the validation run finishes.

## [CI-ShardedTests-042] - (2026-10-17)

### Changed

- **CI runs the tests on three machines at once.** The tests job is a matrix of three shards. A custom sequencer in `vite.config.ts` deals the test files to shards by their cost on a CI core, longest first, each to the shard with the least work so far, rather than by a hash of their names, which could put the long files together. Every file runs in exactly one shard, and `browser-check` still passes only when every shard and the browser job do.
- **No test file runs more than two sets of eight runs.** Experiment 2 is split between `fireSizeShared.test.ts` (the shared fire against own fires) and `fireSizePerMember.test.ts` (a fire for each member against own fires), experiment 3 has its own file again (`spareWood.test.ts`), and experiment 5's eight 400-day runs are spread over four files. Long files also start first, so no worker is left finishing one alone.
- `AGENTS.md` asks new steps to keep experiment files short and to list long files' costs.

### Validation

- The three shards ran 14, 15 and 15 files and 198, 89 and 128 tests: all 44 files and 415 tests, each once. Each shard took 42 to 43 seconds locally.
- `npm run agent:check` passes.

## [CI-ParallelChecks-041] - (2026-10-17)

### Changed

- **The pull-request check runs in parallel.** The tests run in one job, and lint, the typecheck, the build and the browser check in another; `browser-check`, the status `main` requires, now passes only when both jobs succeed. The typecheck was not run in CI before.
- **The fast-mode browser check pauses five times** and judges the median pause, rather than one pause on a noisy shared runner. Each time it also checks that the day shown does not move after Pause.
- **The valley engine and checker:** a forager standing still reuses its last view of the plants around it, and the checker keeps each minute's turn order in a reused array rather than a new map.

### Fixed

- **The MVP9 page's day could jump after Pause.** While running, the page shows a new day only every 100 ms, and pausing published the last days computed one render after the Paused label, so the day shown moved forward once after pausing. Pausing now publishes them in the same update. The MVP9 simulation is unchanged.

### Validation

- All 24 Life 8 fingerprints match.
- The browser check passed five runs in a row locally, each of five pauses, with median pauses of 103 to 190 ms.
- `npm run agent:check` passes; the tests take 80 seconds locally.

## [TESTS-FasterSuite-040] - (2026-10-16)

### Changed

- **Life 8's experiment tests share their runs.** Each test file runs in its own process, so a simulation two files need is run twice. Experiments 1 and 4 now share a file (`feedingAndGroups.test.ts`), as do 2 and 3 (`fireSizeAndSpare.test.ts`): 6 runs of 8 seeds instead of 9.
- **The longest runs are split.** Experiment 5's eight 400-day runs of a band of 12, which alone set how long the suite took, are split across `feedsFire1.test.ts` and `feedsFire2.test.ts`.
- **Every core runs tests.** The test runner uses a worker on every core rather than the default of one fewer, a third more on a 4-core CI runner.
- **Two MVP9 tests run 2,000 days instead of 10,000.** They check that money stays conserved and that stored history stays within its bounds of 400 days and 1,600 events; 2,000 days exercises the bounds five times over. The MVP9 code is unchanged.
- **The valley engine and checker do less needless work,** with every trajectory unchanged: each site's centre and check radius are kept in typed arrays rather than looked up and recomputed for every forager every minute; the spiral of hearth slots is computed once rather than rebuilt for each member each minute; and the checker builds each minute's lookup of turns once rather than three times.

### Validation

- The fingerprints of all 24 Life 8 runs match, so no trajectory changed.
- `npm run agent:check` passes. The tests take 87 seconds locally, against 222 after update 039 and 565 before it; the suite uses about 410 seconds of computer time, against 7,800 before update 039.

## [LIFE8-OnlyLife8-039] - (2026-10-16)

### Removed

- **Life 0 to Life 7.** The repository now holds only the current Life step. The hourly core (`src/life/`) and its observer code (`src/lifeView/`) are deleted, with every Life 0 to Life 4 experiment and test. The valley's Life 5, Life 6 and Life 7 experiments and tests are deleted, with their presets (`LIFE5_VALLEY`, `LIFE6_VALLEY`, `LIFE7_VALLEY`, `LIFE3_BAND`) and the specifications `docs/LIFE0_SPEC.md` to `docs/LIFE7_SPEC.md`. All remain in git history; this changelog and the lab notes keep their records.
- **Switches that only recreated earlier steps:** `groups`, `explore`, `knowValley`, `checkSites`, `carryCost`, `loadHome`, `swapping`, `quotes` and `practice`. Each behaviour is now simply how the valley works. Four switches remain, each one of Life 8's counterfactuals: `scattered`, `sharedFire`, `campfirePerMember` and `feedSpare`.
- The observer's setup offers only those four switches, and drops the descriptions of what the removed ones did.

### Changed

- **The Life 8 specification stands alone.** It now describes the whole simulation: the valley, the forager, the minute, the rules, the defaults, the invariants, the theory and the experiments. Where it compared with Life 7, it compares with every forager keeping its own fire (`sharedFire` off), which is the same configuration. Experiment 5, Life 7 as a special case, is gone; how many the valley feeds becomes experiment 5.
- What the valley borrowed from the hourly core moved into it: carried food (`src/valley/food.ts`), the display helpers and colour scale (`src/valleyView/display.ts`), the specialization chart and the stylesheet.
- `AGENTS.md`, the README, the merge document's ladder, and the architecture and validation guides describe only Life 8, and a new step now replaces the current spec and removes the previous step's experiments.

### Added

- **`fingerprints.test.ts`.** Life 8 runs exactly as recorded: 30 days on three seeds for the canonical valley and each configuration the experiments use match fingerprints of their daily summaries and totals, recorded from Life 8's code before this change, with every invariant checked every minute. A refactor or speed-up that changes any trajectory fails it.

### Validation

- Every Life 8 configuration runs exactly as before the change: the fingerprints of 24 runs, eight configurations on three seeds, match.
- `npm run agent:check` passes. The test suite takes 222 seconds locally, against 565 before, and about a third as much computer time.

## [LIFE8-SharedFire-038] - (2026-10-16)

### Added

- **Life 8, a shared fire.** The valley core implements the [Life 8 specification](docs/LIFE8_SPEC.md):
  - **one fire per group:** each standing group keeps a fire at its flag's point, in place of its members' own; a forager without a group keeps its own fire, as in Life 7;
  - **burning:** at the start of every night hour, before anyone acts, each fire burns `campfireWoodPerHour`, 1 kg, however many sleep at it, if it holds that much, and is lit for the hour; otherwise it is out, and it relights at no cost at the first night hour it holds an hour's wood;
  - **warmth:** a member asleep at its hearth is warm exactly when its group's fire is lit, whether or not it gave, and burns no wood of its own;
  - **feeding:** after swapping, a member at its hearth puts its spare wood, above two nights' worth, into the fire, and when the fire holds less than the rest of the night needs (by day, a whole night) adds wood from its stock up to what the fire lacks;
  - **dissolution:** a group's survivor takes back the wood left in its fire;
  - **contributions:** each group records the wood each member has given its fire, and each forager the wood it has given and the time it has slept warm by a group's fire.

  One switch, `sharedFire`, turns the change off. `LIFE7_VALLEY` sets it to give Life 7 exactly, which a test checks against fingerprints recorded from Life 7's code; `LIFE6_VALLEY` and `LIFE5_VALLEY` include it, and Life 5's, Life 6's and Life 7's experiments and tests run with their own settings. Two more switches give the experiments' counterfactuals: `campfirePerMember`, a fire that burns a kilogram an hour for each living member, and `feedSpare` off, members who give only to a low fire.
- **Events and summaries.** Fire events for each standing group at the start of every night hour, feed events for every gift, the wood a survivor takes back on a dissolve event, and the group whose fire a member slept by on its action event. Daily summaries add every forager's wood given, the wood burned in shared fires, and night hours fires were lit and out.
- **Invariants.** Wood is conserved through fires; each fire burns exactly its hour's wood, only at the start of a night hour and only with that much, and every standing fire is tended; every gift comes from a member at its hearth into its own group's fire, in exactly the amount the rule gives; a sleeping member's warmth matches its fire and it burns none of its own wood; a survivor takes back exactly what the fire held; and the records of gifts match what fires burned and hold.
- **Theory.** The wood a fire burns in a night and each member's share of it.
- **Experiments.** Who feeds the fire, in scattered groups and in a band that starts as one; how big a fire, with fires of 2 kg an hour and of a kilogram a member, beside Life 7; spare wood and exchange, with members who give only to a low fire; groups beside Life 7; Life 7 as a special case; and how many the valley feeds. Per-run measures add wood given and given spare, wood burned in shared fires, hours lit and out, each group's leading giver and members giving less than a quarter of an even share, and the correlation of giving with gathering.
- **The observer.** `life.html` shows Life 8:
  - each group's fire burns at its flag, its flame sized by the nights of wood it holds, with its wood stacked beside it and ashes when it is out; members' own hearths no longer show flames;
  - selecting a group frames it in the part of the view the cards leave clear; each living member gets a numbered pin in the group's colour that keeps its size at every zoom, held at the edge of the clear view and pointing towards members out of sight; lines run from the flag to members away from home, and everyone outside the group fades;
  - the group card shows the fire's state and a table of what each member who ever joined has given the fire, its share, what it gave today, what it gathered and swapped and how long it slept warm, with a sentence on who gave most and whether anyone gave nothing; hovering a member brightens its pin;
  - the HUD shows the followed member's group fire and what it has given; the setup adds the shared fire switch and the fire's wood an hour.

### Changed

- **Selecting a group.** Picking a group's flag, badge or base now frames the group, as its chip does, and the group card is wider and scrolls within the screen.
- The merge document's ladder describes step 8 as built. The MVP9 top bar's link reads "Life 8".

### Validation

- **Who feeds the fire.** In every standing group of two or more, on every seed, every member gives; none gives less than a quarter of an even share. A group's leading giver gives 1.10 times an even share in scattered groups and 1.38 in a band that starts as one group. Giving correlates with gathering at 1.00 across members; 39% of the wood given is spare, the rest taken from stocks for a low fire.
- **How big a fire.** Members burn 4.0 kg of wood a forager-day and gather for 0.28 hours, against 11.7 kg and 0.66 hours in Life 7; with a fire of 2 kg an hour, 8.2 kg and 0.51 hours; with a kilogram an hour for each member, 11.8 kg and 0.68 hours. Members work 2.39 hours a day, against 2.85 in Life 7.
- **Spare wood and exchange.** 3 runs of 32 swap, and members buy under 0.1% of the wood they burn, against every run and 9.4% in Life 7; with a fire a member, 28 runs and 0.1%. With members giving only to a low fire, every run swaps and members buy 15.4%, and sleep cold 4.7% of night hours against 2.7%.
- **Groups.** A band that starts as one group burns 1.5 kg a forager-day and gathers for 0.12 hours, against 11.0 kg and 0.63 in Life 7, and sleeps cold 1.7% of night hours against 8.4%. Fires are lit 97% of night hours in scattered groups and 98% in one group.
- **Life 7 is a special case.** With `LIFE7_VALLEY`, the daily summaries and totals of six runs, for the band born equal and Life 3's band on three seeds over 30 days, match fingerprints recorded from Life 7's code. Life 6's and Life 5's fingerprints still match with their settings.
- **Capacity.** Bands of 8 and 12 are intact at day 400. A band of 16 keeps 6.0 survivors, all its deaths before day 100, against 5.8 in Life 7.

## [LIFE7-SightAndLoads-037] - (2026-10-13)

### Added

- **Life 7, sight and loads.** The valley core implements the [Life 7 specification](docs/LIFE7_SPEC.md):
  - **long sight:** by day a forager sees thickets, stands of trees, other foragers and flags 1 km away, across the whole valley; at night it sees only the 25 m of close sight, which also stays the distance at which it reads what a bush or tree holds;
  - **memory of the land:** each forager remembers the thickets and stands it has spotted and the last minute it checked each one, standing close enough to see every plant in it; ground once seen stays seen;
  - **exploring by sites:** a forager whose needs are met walks to the nearest ground it has never seen, then to the nearest thicket or stand it has not checked for a day; it never sweeps seen ground again;
  - **searching by sites:** a forager that remembers no plant worth a minute's work walks to the nearest thicket or stand of that kind it has never checked, then to unseen ground, before revisiting;
  - **carrying:** a forager's load is the wood of its trip and its berries at 500 kcal a kilogram; it walks at `walkCmPerSecond · 60 / (60 + load)`, 3.0 km/h with 30 kg, and each second of walking costs what it did, so each metre costs more;
  - **taking a load home:** a forager that is not hungry and carries a full load walks home before doing anything else.

  Three switches, `checkSites`, `carryCost` and `loadHome`, and `sightRadiusCm` turn the changes off. `LIFE6_VALLEY` sets them to give Life 6 exactly, which a test checks against fingerprints recorded from Life 6's code; `LIFE5_VALLEY` includes it, and Life 5's and Life 6's experiments and tests run with their own settings.
- **Invariants.** The checker also checks every walk against the speed its load allowed, sites spotted only within sight and checked only from close enough, places seen within long sight and kept seen, walks to check or search a site worth it, and that no forager with a full load idles, explores, checks or seeks company when not hungry.
- **Theory.** Speed and the cost of carrying a load, and the shortest tour through every site.
- **Experiments.** Seeing far, at 1 km, 250, 100 and 25 m, beside Life 6; walking and checking, with exploring off and checks every 72 hours; carrying, with its cost and taking loads home each off, and loads of 20 and 40 kg; groups and exchange against one group from the start; Life 6 as a special case; and how many the valley feeds. Per-run measures add walking by reason and walking with a load.
- **The observer.** `life.html` shows Life 7:
  - each standing group's base has a disc of ground in its colour round its hearths and a badge with its letter above the flag, the same size on screen at every zoom;
  - the HUD has a chip for each standing group; a chip, flag, badge or disc selects the group, rings its living members at their feet, and opens a group card with when it was founded, what its members hold, its swaps over the last day and each member's activity and load, with members to click and follow and a button to frame the group;
  - the HUD shows the followed forager's load and walking speed and the thickets and stands it knows; a ring marks each one, bright if it checked it in the last day; activities for checking, searching a site and taking a load home;
  - the setup adds sight in metres and the three switches.

### Changed

- **The sash.** The band across a member's chest was a ring turned front to back through the body, which looked like a necktie from the front and a hook through the chest from the side. It now wraps the torso from one shoulder to the other hip, drawn smooth.
- Ground the followed forager has seen no longer shades as stale when foragers check sites, since seen ground stays seen.
- The merge document's ladder inserts step 7, "Sight and loads"; the shared fire becomes step 8 and later steps move down by one. The MVP9 top bar's link reads "Life 7".

### Fixed

- **Two checker gaps, found by runs.** A swap or quote between two members early in a minute was reported as crossing groups when a death later in the minute dissolved their group; two foragers now share a group if they did at the start of the minute or at its end. A forager's hearth while it acts is now worked out from the minute's foundings in turn order, since one met by a founder at an earlier turn has its hearth moved before it acts. Neither changes any trajectory.

### Validation

- **Seeing far:** on 32 seeds every forager is in a group within 0.31 days; the band forms two groups in 9 runs, three in 22 and four in 1, never one, against one group in 6 runs of Life 6.
- **Walking:** foragers walk 1.11 hours a day, 0.96 of it checking, and work 2.85, against 2.57 and 3.09 in Life 6; walking with a load falls from 0.87 hours a day to 0.04.
- **Carrying:** without its cost foragers walk 1.09 hours a day; with 20 kg loads every run swaps with taking loads home, and 5 of 32 without.
- **Exchange:** members buy 9.4% of the wood they burn, against 12.4% in Life 6 and 18.9% in a band that starts as one group.
- **Capacity:** bands of 8 and 12 are intact at day 400; a band of 16 keeps 5.8 survivors, against 2.4 in Life 6.
- **Life 6 reproduced:** with `LIFE6_VALLEY`, six runs match Life 6's recorded fingerprints day for day, and Life 5's six still match.
- Nothing under `src/sim/` or `src/life/` changed. `npm run agent:check` passes. In the browser, groups forming at first light, the group chips and card, framing a group, member rings, the base's disc and badge, the sash from three sides, the load and speed in the HUD, the rings of known sites, the whole-valley view and the 375px layout were checked by stepping the page, with no console errors.

## [LIFE6-Groups-036] - (2026-10-13)

### Added

- **Life 6, groups.** The valley core in `src/valley/` implements the [Life 6 specification](docs/LIFE6_SPEC.md):
  - there is no camp: foragers start scattered across the valley, at least 50 m apart, each at its own hearth, and know only what they have seen;
  - the valley is divided into 400 places 30 m wide; a forager remembers when each lay wholly in its view, and whose needs are met explores the nearest place it has not seen for a day;
  - a forager that remembers no bush or tree worth a minute's work searches ground it has never seen before going back to plants it found bare;
  - a forager without a group seeks company, below hunger and warmth and above exploring and resting: it walks towards anyone it sees, or to a flag it knows and waits there, or explores;
  - two foragers without a group who come within talking distance found a group and plant its flag at their midpoint; one that meets a member joins its group; members never leave or change group, and their hearths move onto a spiral 3 m apart around the flag;
  - members swap and tell terms only with each other; a forager without a group neither swaps nor hears terms;
  - a group left with one living member dissolves, its flag comes down, and the survivor keeps its hearth and seeks company again.

  Four switches, `groups`, `scattered`, `explore` and `knowValley`, turn each change off. With all four set as `LIFE5_VALLEY` gives, the valley runs exactly as Life 5, which a test checks against fingerprints recorded from Life 5's code. Life 5's experiments and tests run with those settings.
- **Invariants.** The checker also checks places marked seen against what lay in view, walks to places worth exploring or searching, memories of plants never seen, how every founding and joining met the nearest forager within talking distance, flags at the founders' midpoint, groups that stand with two or more living members, hearths on their slots around the flag, no change of group without meeting or dissolving, no forager without a group left beside another, and swaps, quotes and terms only within a group.
- **Theory.** The most groups a band can hold, and what a daily sweep of the valley costs in walking.
- **Experiments.** Groups from a scattered start; knowing and exploring, with exploring off and every 72 hours; groups and exchange, against one group from the start, strangers who may swap with anyone, and Life 5; Life 5 as a special case; and how many the valley feeds with groups and exploring.
- **The observer for groups.** `life.html` shows Life 6: a flag in its group's colour at each group's base, raised when the group is founded and taken down when it dissolves; each forager's hearth where it sleeps, moving to the flag when it joins; a band across each member's chest in its group's colour; ground the followed forager has never seen drawn darkest, and ground it has not seen for a day a little dark; the followed forager's group, fellows and share of the valley seen in the HUD; a flag inspector; a chart of groups and foragers without one; and switches for the four changes and the hours before a place is worth exploring again.

### Changed

- The camp's fire is gone; the clearing in the middle of the valley stays as an open meadow, so plants stand where Life 5 put them on the same seed.
- **Only the current life is visible.** `life4.html`, its build entry, the link to it, and `src/lifeView`'s page and scene are removed. The hourly core in `src/life/` and its tests stay, and Life 5's experiments still run Life 4 beside the valley. The MVP9 top bar's link reads "Life 6".
- The merge document's ladder inserts step 6, "Groups", and step 7, "A shared fire"; tools and shelter become step 8 and later steps move down by two. `AGENTS.md` no longer mentions the Life 4 page.

### Validation

- **Groups:** on 32 seeds every forager is in a group within 1.31 days; the band forms one group in 6 runs, two in 19, three in 6 and four in 1, and none dissolves.
- **Exploring:** foragers walk 2.58 hours a day and work 3.09, against 0.11 and 2.69 without exploring; bands of 8 and 12 are intact at day 400.
- **Exchange:** members of scattered groups buy 12.4% of the wood they burn and their leading gatherer brings in 1.27 times a fair share, against 18.5% and 1.56 in a band that starts as one group; the more groups a band forms, the less it buys.
- **Capacity:** a band of 16 falls to 2.4 survivors, against 5.4 in Life 5, with groups dissolving and survivors regrouping.
- **Life 5 reproduced:** with Life 6's switches off, six runs match Life 5's recorded fingerprints day for day.
- Nothing under `src/sim/` or `src/life/` changed, so MVP9 and Life 0 to Life 4 keep their trajectories. `npm run agent:check` passes; the tests take about five minutes. In the browser, a band founding Group A and sleeping round its flag, a member's band, the shaded ground, the flag inspector, the HUD, the charts, the whole-valley view and the 375px layout were checked by stepping the page, with no console errors after Vite's first load.

## [LIFE5-RealScale-035] - (2026-10-12)

### Added

- **Life 5, real scale.** A new core in `src/valley/` implements the [Life 5 specification](docs/LIFE5_SPEC.md):
  - the band lives in a valley 600 m across, in one-minute ticks, with positions in whole centimetres and straight-line walking at 4.5 km/h;
  - food is berries on 1,920 individual bushes in 32 thickets, and wood is deadwood under 64 individual trees in 8 stands, growing exactly what Life 4's land grew;
  - a minute may hold a short walk and then work, and hourly rates and costs are paid second by second with exact remainders;
  - foragers see 25 m, work within 1 m, swap and tell terms within 20 m, sleep at hearths on a spiral around the camp's fire, choose the nearest bush or tree worth working, and bring firewood home in loads of 30 kg;
  - Life 4's rules for hunger, wood, choosing work, trips for trade, swaps, terms and practice carry over, with practice counted in seconds.

  A checker replays every minute's regrowth and recorded work onto its own copy of every plant and checks exact energy and wood conservation, movement, reach, memory, sleep, loads, practice and swaps every minute.
- **Theory.** `src/valley/theory.ts` predicts time use with walking at real scale, the valley's capacity, and the loads that can never leave a forager with spare wood.
- **Experiments.** Time at real scale; no surplus, no exchange; loads from 0 to 40 kg in a band born equal and in Life 3's band; Life 4's practice and exchange in the valley with its counterfactuals; and how many the valley feeds, each beside Life 4's hourly core on the same seeds.
- **The observer at real scale.** `life.html` shows the valley: people about 1.75 m tall who walk, pick, stoop to gather deadwood and lie down at their hearths, bushes whose berries are picked one by one, trees with piles of deadwood at their feet, a bundle on a forager's back for the load it is gathering and a stack by its hearth for the rest. A strategy-game camera pans, zooms from the whole valley to a few metres, rotates, tilts towards eye level close in, and follows a forager. Time runs from real time to a day a second, and steps a minute at a time.

### Changed

- The hourly Life core in `src/life/` is frozen as a reference. Its observer moves, unchanged, to `life4.html`. The MVP9 top bar's link reads "Life 5".
- `src/lifeView`'s colour scale and specialization chart accept any configuration with the fields they read, and the chart names its unit of wood; Life 4's page is unchanged.
- The test runner's limit per test is 60 seconds rather than 5, because the valley's experiments load every core and slowed an unchanged Life 0 test past the old limit.
- The merge document's ladder inserts step 5, "Real scale"; tools and shelter become step 6 and later steps move down by one. `AGENTS.md` points new Life work at `src/valley/` and `src/valleyView/`.

### Validation

- **No surplus, no exchange:** without loads, no forager in any of 64 runs ever holds spare wood, and nothing is swapped or quoted, whether the band is born equal or unequal.
- **Loads:** a band born equal never swaps with loads up to 24 kg, swaps in every run at 30 and 40 kg, but in only 8 of 32 at 36 kg; Life 3's band swaps in every run from 26 kg.
- **Practice and exchange:** with 30 kg loads every band born equal divides, but the first swap comes on day 140 on average against 15.5 in Life 4, and the top two gatherers bring in 36% of the wood against 53%. Without swaps, or without telling terms, or without practice, nothing is swapped.
- **Capacity:** the valley keeps a band of 12 intact in every run, which Life 4's land does not; a band of 16 falls to 5.4.
- Nothing under `src/sim/` or `src/life/` changed, so MVP9 and Life 0 to Life 4 keep their trajectories. `npm run agent:check` passes; the tests take about three minutes. In the browser, walking, picking, gathering and sleeping, following, the inspector, the HUD, the charts, the whole-valley view, the 375px layout and `life4.html` were checked, with no console errors.

## [LIFE4-Practice-034] - (2026-10-12)

### Added

- **Life 4, practice.** The Life core implements the [Life 4 specification](docs/LIFE4_SPEC.md):
  - a forager's skill at a task now follows its work: its practice is its hours at the task over its last 30 days, which give a percentage from 50% with no hours towards 150%, 100% at two hours a day;
  - a rate is the base rate times the forager's born skill times its practice, set at midnight from the day just ended and fixed for the day;
  - the canonical band is born equal, and starts at exactly Life 3's equal rates;
  - a forager knows its rates for the day but not that practice will change them. Choosing work, swapping and telling terms are Life 3's.

  The invariants also check every forager's practice log, that its hours worked add up to the hours in its log and its hours today, that its rates are the ones its born skills and log give, and that practice happens only at midnight.
- **Theory.** `theory.ts` adds the practice percentage a forager settles at by working a given number of hours a day at a task.
- **Experiments.** Life 3 reproduced from recorded checksums, with practice fixed at 100% changing nothing; practice alone; practice and exchange, with swaps, telling terms and practice each switched off; how long skill lasts, at 10, 30 and 90 days of memory; how much practice matters, from 80–120% to 25–175%; and practice in Life 3's band of born differences.
- **The observer shows practice.** The HUD shows each practice percentage with the hours behind it, and how each rate changed at the last midnight. A new chart plots the band's highest and lowest own terms each day, with the followed forager's: in a band born equal the three start as one line and fan out. Colours, and the specialization chart, span the range born skill and practice allow, so a band born equal starts one colour and drifts apart. Setup adds a switch for practice, the memory in days, the hours half way and the practice range.

### Changed

- The default configuration is the Life 4 world: Life 3's, with every born skill at 100% and practice on. `LIFE3_WORLD` gives back Life 3 (born skills from 50% to 150%, practice off), and `LIFE2_WORLD` now builds on it. Life 3's experiments run on `LIFE3_WORLD`.
- `drawRates` gives way to `drawSkills`, which draws born skills from the same stream; `practice.ts` turns them into rates. Foragers add born skills, a practice log, hours today and hours entered in the log; a new practice event goes to `lastPractice` and opens each day's events; daily summaries add every forager's rates.
- Experiment measures read born rates for own terms and the least skilled third, and the wood each forager actually gathered for concentration; for Life 3, where rates never change, these are the same as before. Runs also record the spread of own terms, the first swap, the lead gatherer of each 40-day window and wood shares in each half of the run.
- `life.html` is retitled "Life 4 · Econ Engine". The README's Life section covers Life 4, with a new screenshot replacing Life 3's. As in Life 3, the MVP9 top bar's link to the Life page now reads "Life 4"; it changes no simulation.
- The merge document's ladder splits step 4: "Practice" is step 4 and "Tools and shelter" a new step 5; later steps move down by one. It records step 4 as settled.

### Validation

- **Life 3 reproduced:** three Life 3 runs match hourly checksums recorded before the change, and Life 0's to Life 3's experiments pass unchanged on their worlds. A band born equal with practice fixed at 100% is identical, hour by hour, to one with practice off.
- **Practice alone:** over 32 seeds without swaps, every forager spends 20–21% of its work on wood and the band stays undivided.
- **Practice and exchange:** with swaps every band divides; the first swap comes by day 26 at the latest, own terms spread 1.86 times by day 100, and the two keenest gatherers bring in 53% of the wood against 25% without swaps. Every band is intact.
- **Memory:** persistence of roles rises from 0.10 at 10 days of memory to 0.67 at 30 and 0.96 at 90.
- No file under `src/sim/` changed. `npm run agent:check` passes; the Life tests take about two minutes. In the browser, the HUD's practice lines, the chart of own terms, the colours, setup validation and the 375px layout were checked, with no console errors.

## [LIFE3-Foragers-033] - (2026-10-12)

### Changed

- **Foragers are drawn at half their old size,** about half as tall as a full-grown tree, so the band is in proportion to its land. Their hearths, the ring around the followed forager and the arcs of gifts and swaps shrink with them.
- **The point of wood is on screen.** The followed forager's panel adds "A night's fire": the wood a night's fire burns and the food it saves against sleeping cold (12 units saving 1,080 kcal on the canonical settings), from `fireSaving` in the view model. Where nights are cold, a forager burning wood is described as "Sleeping warm by its fire" rather than "Sleeping through the night".
- The README's Life 3 screenshot is retaken with the smaller foragers and the new panel line, with the history panel closed so the grove being cut stays in view. The Life 3 specification's observer section, the architecture and the validation docs describe the changes.

### Validation

- The simulation is unchanged; every Life test and checksum passes as before.
- New view-model tests: a night's fire burns 12 units and saves 1,080 kcal on the canonical settings and is absent where nights are not cold; a forager burning wood sleeps warm by its fire.
- Checked in the browser on desktop and at 375 px, with no console errors.

## [LIFE3-Thickets-032] - (2026-10-12)

### Changed

- **Food and wood are drawn as many plants, told apart by fruit and trunks.** In the Life observer:
  - each patch is a thicket of six low bushes spread across its tile. Its food is shown as red berries, 30 to a thicket, picked bare bush by bush from the outside in as it is eaten and ripening again as it regrows. The bushes stay green throughout. This replaces a single bush that shrank and browned;
  - each grove is a stand of five conifers. As its wood is cut, trees are felled to stumps one at a time, and they grow back from the stump as the wood regrows. This replaces a single tree whose crown shrank.

  The berries and trees drawn are always proportional to what a site holds. A site's layout is fixed by its kind and ID. All leaves, berries, trunks and crowns are four instanced meshes, and clicking any bush or tree still opens its site in the inspector. On a camp tile the thicket draws in towards the corner away from the fire.
- `bushScale` and `crownScale` are replaced by `sitePlants`, `fillInTurn`, `berryFills` and `treeFills` in `lifeViewModel.ts`.
- The README's Life 3 screenshot is retaken at midday with thickets and stands, and its text describes them. The Life 3 specification's observer section, the architecture and the validation docs describe them too.

### Validation

- The simulation is unchanged; every Life test and checksum passes as before.
- New view-model tests: sites stand inside their tile with the same layout every run, differing by kind and ID; stocks are shared out part by part in proportion to capacity; berries are picked from the outer bushes first; trees are felled one at a time.
- Checked in the browser: full and part-picked thickets, a single-grove run cut down to one standing tree among stumps, clicking a stand to open its grove, the camp tile, 375 px wide, and the console.

## [LIFE3-Specialization-031] - (2026-10-11)

### Added

- **Life 3, specialization.** The Life core implements the [Life 3 specification](docs/LIFE3_SPEC.md):
  - nights are cold: a forager sleeping without a fire burns 150 kcal an hour instead of 60, and burns a unit of wood an hour at its own hearth to sleep warm;
  - wood grows in 8 groves that deplete and regrow, and a forager short of wood (below one night's 12 units) gathers until it holds two nights' worth;
  - each forager has a foraging skill and a wood skill, drawn from 50% to 150% from a stream of their own and fixed for the run;
  - at camp, two foragers may swap wood for food at the midpoint of what wood costs each of them in working time, only when both gain; foragers who could both gain tell each other the terms, and remember the last terms they heard for a day;
  - a hungry forager gathers wood to sell when the terms it remembers pay better than foraging, but only once all its spare wood has sold, and a forager short of wood forages to buy it when that pays better than gathering.

  Wood is conserved exactly beside energy. The invariants also check every swap and quote against the two foragers' own terms and every swap against what each held, gathering and burning against their rules, and remembered terms against the hour's swaps and quotes.
- **Theory.** `theory.ts` adds a night's wood, what a unit of wood saves and costs, the hours a forager spends gathering without trade, and the share of its work it spends gathering, which rises with its own terms without trade; comparative advantage predicts the opposite with it.
- **Experiments.** Life 2 reproduced from recorded checksums; wood and cold with equal skills; comparative advantage with swapping off and on; the spread of skills; and telling terms, with steady harvests and with windfalls.
- **The observer shows specialization.** Groves are trees whose crowns shrink as they are cut. A stack of logs shows a forager's wood, and each sleeper has its own hearth, lit while it burns wood and dark when it sleeps cold. A swap is an arc with a log and a parcel crossing it. Foragers are coloured from cyan, relatively good at gathering, to gold, relatively good at foraging. The HUD adds a forager's skills, what wood costs it, its wood, the terms it heard and what it has swapped; the inspector shows groves. A new chart plots each forager's share of work spent gathering against what wood costs it; another shows wood swapped, hours slept cold and the band alive each day. Setup adds the skill range, groves, and switches for swapping and telling terms.

### Changed

- The default configuration is the Life 3 world: 8 keepers on Life 2's land, with groves, cold nights, skills from 50% to 150%, steady harvests (`harvestKcal` 600, the slowest rate) and swapping. `LIFE2_WORLD` gives back Life 2, and `LIFE1_WORLD` now builds on it.
- A forager's harvest is the larger of `harvestKcal` and its own rate, and `forageSucceeds` takes that rate. Life 2's rule `forageKcalPerHour ≤ harvestKcal ≤ patchCapacityKcal` gives way to rules that a patch holds the largest harvest and a grove the largest hour of gathering.
- `decide` and `walkTarget` take the groves, and `walkTarget` the good the forager works for; `choosePatch` takes the forager's harvest, and `chooseGrove` shares its logic. Action events add wood gathered and burned, whether the forager slept cold, the good it worked for, whether for trade, and its wood afterwards. New swap and quote events, `lastSwaps` and `lastQuotes`, and daily totals of wood gathered, burned and swapped, cold hours and swaps.
- A turn ends with exchange (swaps, then gifts) and eating again, in which a seller eats the food it received. This changes nothing in Life 2, where a forager that still carries food has a full reserve.
- `life.html` is retitled "Life 3 · Econ Engine". The README's Life section covers Life 3, with a new screenshot replacing Life 2's.
- The MVP9 top bar's link to the Life page now reads "Life 3". The owner approved this one change to the frozen MVP9 observer; it changes no simulation.
- The merge document's ladder splits step 3: "Wood and skill" is step 3 and "Tools and practice" a new step 4; later steps move down by one. It records step 3 as settled.

### Validation

- **Life 2 reproduced:** three Life 2 runs match their checksums exactly, gifts included, and Life 0's, Life 1's and Life 2's experiments pass unchanged on their worlds.
- **Wood and cold:** with equal skills nothing is swapped, every hour is identical with swapping on and off, and the band of 8 is intact on every seed, sleeping cold 11% of its night hours.
- **Comparative advantage:** over 32 seeds, the correlation between own terms and time spent gathering turns from +0.90 to −0.78 with swaps; the two best gatherers' share of the band's wood rises from 33% to 69%; survivors average 7.5 against 6.9, and the least skilled third survives 80% of the time against 52%.
- **Telling terms:** with quotes off and steady harvests no swap ever happens; with windfalls swaps start, but specialization stays weak.
- No file under `src/sim/` changed. `npm run agent:check` passes; the Life tests now take about two minutes. In the browser, trees, logs, hearths, a swap's arc, the new charts and HUD, setup validation and the 375px layout were checked, with no console errors.

## [LIFE2-Sharing-030] - (2026-10-11)

### Added

- **Life 2, sharing.** The Life core implements the [Life 2 specification](docs/LIFE2_SPEC.md):
  - the band sleeps at a camp in the middle of the land, walks home before dark, and sets out only for patches it can forage and return from before dusk;
  - an hour of foraging either succeeds and takes a windfall (`harvestKcal`, 6,000 kcal by default) or gathers nothing, with the same expected harvest as before; luck comes from a new stream seeded by the run, the hour and the forager;
  - food a forager cannot eat is carried, eaten as its reserve has room, and spoils `shelfLifeHours` after the harvest (48 by default; 0 keeps);
  - hungry foragers ask for what would satiate them, and each forager follows a strategy: keepers never give, sharers give to anyone hungry on their tile, and reciprocators give only to those who owe them nothing;
  - every forager keeps a ledger of what it has given to and received from every other.

  Energy is conserved exactly, counting carried and spoiled food. The invariants also check every gift against its rules and its giver's strategy, the ledgers on both sides, luck against its stream, and the whole band at camp every night.
- **Theory.** `theory.ts` adds the chance of a windfall, the 37 to 40 tries a hungry forager has before it starves, the resulting risk per hungry spell `(1 − p)ⁿ`, the room a hungry forager has for a windfall, and how much carried food a forager can use before it spoils.
- **Experiments.** Life 1 reproduced from recorded checksums; bad luck on a single patch against theory; windfalls with and without sharing; perishability; and who pays in a mixed band.
- **The observer shows sharing.** The camp is a fire that glows at night. Foragers wear their strategy's colour, with an accent ring under the followed one. Bundles show what each carries, and an arc shows each gift as it is made. The HUD adds the followed forager's strategy, what it carries and when it spoils, and what it has given and received. The charts show each strategy's survivors and the food given and spoiled each day. Setup adds the numbers of sharers and reciprocators, the windfall size and the shelf life.

### Changed

- The default configuration is the Life 2 world: 12 foragers (4 keepers, 4 sharers, 4 reciprocators) on a 12 × 12 grid with 32 patches holding up to 24,000 kcal. `LIFE1_WORLD` gives back Life 1, and `LIFE0_WORLD` now builds on it.
- `choosePatch` takes the hour, so it can exclude patches out of reach before dusk. `walkTarget` returns the tile to walk to and the patch, if any.
- Action events add the forage hour's outcome, what was eaten from carried food, what spoiled, and what is carried afterwards. A new gift event, `lastGifts`, and daily totals of food given, spoiled and carried, with survivors by strategy.
- Experiment runs end once every forager is dead.
- The energy legend in the HUD wraps rather than widening the card, which it had done by about 14 px since Life 0.
- `life.html` is retitled "Life 2 · Econ Engine". The README's Life section covers Life 2, with a new screenshot replacing Life 1's.
- The merge document records step 2 as settled.
- The MVP9 top bar's link to the Life page now reads "Life 2". The owner approved this one change to the frozen MVP9 observer; it changes no simulation.

### Validation

- **Life 1 reproduced:** four Life 1 runs (bands of 10 and 40 on two seeds) match their checksums exactly, and Life 0's and Life 1's experiments pass unchanged on their worlds.
- **Bad luck:** 13.8% of 2,878 hungry spells end in starvation against a theoretical 12.9–15.0%.
- **Windfalls and sharing:** over 32 seeds, bands of keepers keep 12.0, 10.5, 5.7 and 1.3 of 12 alive as windfalls grow from 1,200 to 9,600; bands of sharers keep 6.9 at 6,000 and 2.2 at 9,600, against keepers' 5.7 and 1.3. The share of food given rises with the windfall.
- **Spoilage:** a 12-hour shelf life costs keepers 7.5% of their harvest at 9,600 and sharers 2.1%.
- No file under `src/sim/` changed. `npm run agent:check` passes; the Life tests now take about a minute and a half. In the browser, the camp and fire at night, bundles, a gift's arc, the new HUD and charts, setup validation and the 375px layout were checked, with no console errors from the page.

## [LIFE1-Band-029] - (2026-10-11)

### Added

- **Life 1, a band.** The Life core implements the [Life 1 specification](docs/LIFE1_SPEC.md):
  - many foragers share one landscape, 40 by default on a 24×24 grid with 36 patches;
  - each hour, the living foragers take turns in a seeded random order drawn afresh for that hour, from a new turn-order stream;
  - each forager sees every patch within a perception radius (2 tiles by default) and updates its memory of them;
  - a walking forager that sees its target emptied chooses again;
  - there are no births, so a band can only shrink.

  Energy is conserved exactly across the band and checked every hour, along with one turn per living forager and memories that match what each forager saw at the start of its turn.
- **Theory.** `theory.ts` adds the carrying capacity `K = 24·n·r / D*` (19.8 foragers on the canonical world) and the search capacity `Kₛ`, the number the land could feed if every forager walked all day (10.0).
- **Experiments.** A band of one reproduces Life 0, checked against checksums recorded from Life 0's code. Four new experiments cover carrying capacity, the cost of local knowledge in a band, the cost of searching, and who survives.
- **The observer follows one forager.** Click a forager, or use the previous and next buttons, to follow it:
  - the followed forager is drawn in the accent colour, with its target and the outline of what it can see;
  - the HUD shows how many of the band are alive and the followed forager's activity and reserve;
  - the inspector compares a patch with that forager's memory;
  - charts show the number alive and the forager's reserve.

  Foragers sharing a tile stand apart, and the dead lie where they fell. Setup adds the band size, up to 100, and the perception radius.

### Changed

- The default configuration is the Life 1 world. `LIFE0_WORLD` gives back Life 0, and Life 0's experiments run on it unchanged.
- `stepLife` records every action of the hour in `lastEvents`, in turn order, in place of a single `lastEvent`. Events carry the forager's ID. Daily summaries count the living and the dead and keep every forager's end-of-day reserve.
- `life.html` is retitled "Life 1 · Econ Engine". The README's Life section covers both steps, with a new screenshot replacing Life 0's.
- The merge document's step 1 open questions are marked settled.
- The MVP9 top bar's link to the Life page now reads "Life 1". The owner approved this one change to the frozen MVP9 observer; it changes no simulation.

### Validation

- **A band of one is Life 0:** seven Life 0 runs, five that survive and two that starve, reproduce their checksums exactly.
- **Carrying capacity:** on all eight seeds, a band of 10 stays intact and a band of 20 does not. The largest intact band is 12–13, between `Kₛ` and `K`. A band of 40 collapses to 4–8 by day 14 and stays there.
- **Local knowledge:** seeing only its own tile, a band of 10 walks to emptied patches on 11–24% of its walks. With full information no walk ends at an empty patch, but a band of 40 still collapses.
- **Searching:** with walking as cheap as resting, 14–16 of 40 survive instead of 4–8.
- No file under `src/sim/` changed. `npm run agent:check` passes. In the browser, the collapse, following a forager by click and by button, the inspector, setup validation and the 375px layout were checked, with no console errors.

## [LIFE0-Forager-028] - (2026-10-11)

### Added

- **Life 0, the first step of the bottom-up core.** A new simulation in `src/life/`, independent of the MVP9 economy, implements the [Life 0 specification](docs/LIFE0_SPEC.md):
  - one forager on a 12×12 grid with four food patches that deplete and regrow;
  - an energy reserve in whole kilocalories;
  - hourly ticks with day and night;
  - priority rules: sleep at night, rest when fed, forage where a full hour's harvest is available, otherwise walk to the patch remembered as fullest or seen longest ago;
  - a forager that knows only its own tile and what it last saw at each patch.

  Energy is conserved exactly and checked every hour.
- **Theory and experiments.** `theory.ts` derives the single-patch survival threshold (about 90.9 kcal/h), the foraging hours a day the forager needs (about 1.82), its predicted day of death below the threshold, and the four-patch lower bound (about 22.7 kcal/h per patch). `experiments.ts` runs the three experiments of the spec headless.
- **The Life 0 observer.** A separate page, `life.html`, linked from the simulator's top bar and the README:
  - The simulation advances in whole hours, and the view interpolates between hourly states: the forager walks its path tile by tile, lies down at dusk and gets up at dawn, bushes shrink and grow and change colour with their stock, and the sun and sky move continuously.
  - A HUD shows the clock, the forager's activity and its reserve against the hunger thresholds.
  - Clicking a bush compares what a patch really holds with what the forager remembers.
  - A chart shows the end-of-day reserve and food on all patches; setup changes the seed, the number of patches and the regrowth rate.
  - Speeds run from one hour per three seconds to ten days per second.
- `.claude/launch.json` starts the dev server for browser previews.

### Changed

- The Life 0 specification now gives the day-of-death window with one night's regrowth allowed for, and defines a declining reserve with a 2 kcal-a-day tolerance; both came from running the experiments. Experiment 1 sweeps 46 to 136 kcal/h.
- `vite.config.ts` builds both pages. The MVP9 top bar gains a "Life 0" link after its panel tabs.

### Validation

- All three experiments match the theory:
  - **Threshold:** the forager starves at or below 81 kcal/h inside the predicted window, survives at or above 100, and its reserve stops declining exactly between 90 and 91.
  - **Leisure:** it forages 1.81–1.82 hours a day at every abundance, against a predicted 1.818.
  - **Local knowledge:** on the canonical world it dies on all eight seeds below the lower bound and survives on all of them at the canonical rate.
- No file under `src/sim/` changed, so the MVP9 canonical trajectory is unchanged.
- `npm run agent:check` passes. In the browser, walking, foraging, sleeping, the inspector, the chart and the 375px layout were checked, with no console errors on either page.

## [MVP9-Life_Engine_Merge-027] - (2026-10-10)

### Added

- **Merge document.** [docs/MERGE.md](docs/MERGE.md) records the decision to merge Life Engine (a Unity project with embodied agents) into Econ-Engine and to keep TypeScript and three.js as the platform. A new simulation core will be built bottom-up, starting from a band of foragers, beside the frozen MVP9 core. The document sets out what carries over from each project, a seven-step ladder with a question and a validation target for each step, the risks and the open decisions. It replaces the vision's incremental path; VISION.md and the README now point to it. It is a direction document only; no simulation behaviour changed.

## [MVP9-Plots-026] - (2026-10-08)

### Changed

- **Multi-tile plots (model change).** Every firm and Government now stands on a plot of land sized by what it is: Utilities 4×4, Food 3×3, Entertainment 3×3, Healthcare 3×2, Transport 4×3 and Government 5×5. Households keep one tile. `Firm.coordinate` is replaced by `Firm.plot`, which Transport now has too, and `Government` gains `plot`. See [docs/MVP9_SPEC.md](docs/MVP9_SPEC.md).
- **Distance to the nearest edge.** A household's trip to a firm is measured to the nearest tile of the firm's plot, so a bigger plot reaches more households. Delivered cost, the fallback order, affordability, purchase records, market metrics, the territory overlay and the 2D market map all use this one rule.
- **A bigger town.** The default grid is 40×40 instead of 20×20, and the transport rate is 1¢ per tile instead of 2¢, so a trip across town costs about what it did. The Settings drawer's default rate now follows the model default.
- **Placement** comes from the spatial seed alone:
  - Government's plot is centred.
  - Firm plots are placed largest first, each at a random position that keeps a one-tile gap from other plots; a plot that is not square may be turned 90°.
  - Households are shuffled onto the remaining tiles.
  - The market, probe, Government and employment random streams are unchanged.
- **Validation and invariants:** a grid must hold every plot with its gap plus one tile per household; invariants check plot sizes, bounds and gaps, and that no household stands on a plot.
- **3D world:**
  - Each firm and Government building fills its plot and is raised with the square root of the plot's area.
  - The camera's default distance, zoom limit and fog scale with the grid.
  - Locate stays further out for bigger plots, and big buildings glow more softly when selected.
  - Scenery avoids every plot tile.
  - The display-only `institutionTiles` is removed.
- The inspector and the Markets panel explain that trips are measured to the nearest edge of a firm's plot. README, architecture, validation and lab notes are updated.

### Validation

- The canonical trajectory changes, as intended. Across eight seeds over days 101–400:
  - one-way customer trips shorten by about 15% (9.64 to 8.24 MVP8 tiles), and the average transport fee falls from 38.5¢ to 33.0¢;
  - Utilities and Healthcare prices rise by about 6% and 5%;
  - needs met, inequality before redistribution, wages paid and market-share gaps stay within the range seen across seeds.
  Full table in the MVP9 spec.
- New tests cover plot distance, layouts, orientation, capacity errors, RNG isolation, plot reach in the territory map, plot-sized buildings and Locate distance. No existing simulation test needed a new expected value. Re-baselined or changed tests:
  - the grid-capacity message and limits: 400 households now fit, so the overflow case uses 1,500;
  - the "exactly enough cells" case, now a 20×20 grid that still fits every plot;
  - hand-made territory tests, whose firms now have one-tile plots;
  - the two institution-tile tests, replaced by plot-centre tests;
  - scenery tests sized for the 40×40 town.
- `npm run agent:check` and the fast-mode browser check (pause latency 256 ms) pass. The town, the overlay, scenery, plot picking, Locate, the 2D map and 375px were checked in the browser with no console errors.

## [MVP8-Town_Models-025] - (2026-10-08)

### Changed

- **A town instead of pillars.** The 3D world draws procedural low-poly buildings. Each household is a house in one of four wealth tiers, depending on its cash relative to the $50 start: a shack below 85%, a cottage from 85%, a two-storey house from 95% and a villa from 105%. The cash shown can be before or after tax. Each consumer industry has its own firm building (a market hall, a plant, a clinic and a cinema), Transport is a depot with a bus, and Government is a domed civic hall. A firm's roof, awning, marquee or cross takes its slot colour (Firm A cyan, Firm B orange), greyed outside the market shown. Each building faces one of four directions, picked from a hash of its ID, so the town looks varied but a building never turns between days.
- **Data overlay.** A new "Data overlay" switch in the map tools adds today's territory tiles and a translucent cash pillar around every house, with the same heights as before. It is off by default. Opening Government switches it on, with after-tax cash, because redistribution reads best as pillar heights. Firm and Government pillars are gone, because their heights were fixed and showed no data.
- **Scenery.** The town stands on a grass island with earth sides. Trees and bushes are scattered among the houses and thicken into a forest across a five-tile margin around the grid. Nothing grows on or against a tile that a household, firm or institution occupies. Placement comes from the seed and the tile, so it never changes between days. A "Scenery" switch in the map tools hides it all and restores the plain board. It is on by default and no panel changes it. Trees and bushes are three instanced meshes, and the shadow camera now covers the margin.
- Relationship lines end above the rooftops, or above the pillars while the overlay is on. Clicking a pillar selects its household.
- The height control is now "Cash shown", because it sets house tiers as well as pillar heights. On phones, the overlay switch and this control stay visible.
- **The day-0 intro card is removed.** The HUD summary now also gives the firm count, the explanation opens the Overview panel, and the top bar's Run button replaces "Run the economy".
- `src/ui/world/buildings.ts` builds each building type once, merges it into one geometry with vertex colours, and shares it. Each entity is one mesh with its own material, whose accent colour comes from a small shader hook. The shadow camera now covers the whole grid.

### Validation

- New tests cover every building type's footprint, ground contact, attributes and accent surfaces, geometry caching, per-building materials, house tier boundaries, tiers under both cash measures, and the overlay in the starting focus and Government's focus, and the scenery layout: determinism, one grass tile per tile, nothing on or touching an occupied tile, items staying in their tiles, a denser forest outside the town than inside it, and the tree and bush sizes.
- The canonical trajectory is unchanged: no file under `src/sim/` changed.
- Browser checks covered the town at day 0 and later, the overlay on and off, picking houses and pillars, purchase lines to rooftops and pillar tops, Government switching the overlay on, the 375px layout, and a clean console on the production build. `docs/images/overview.png` was recaptured at day 46.

## [MVP8-World_First_UI-024] - (2026-10-08)

### Changed

- **3D-first interface.** The app opens on a full-screen 3D world instead of the Overview page. The world stays mounted for the whole session. The top bar, a HUD with the four headline numbers, the map tools and the household and firm inspector float over it.
- **Sections are panels.** Overview, Markets, Households and Government open as a panel docked on the right; Experiments opens as a wide sheet; on screens narrower than 860px every panel is a bottom sheet. Esc, the close button or clicking the section again returns to the world. URL hashes (`#markets` and the others) still open their sections, and no hash shows the world.
- **The world follows the panel.** Opening Markets or Households shows purchase links, and opening Government shows pillar heights after tax. Each panel sets this once, so the map tools can still change it.
- **Locate.** "Show on map" is now "Locate". It selects the household or firm and flies the camera to it, without closing the panel. It lands in the middle of the part of the world that the panel, the headline numbers, the inspector and the map tools leave uncovered. With reduced motion, the camera jumps instead.
- The world is not synced or drawn while Experiments covers it or the browser tab is hidden.
- If the 3D world cannot start, the Overview panel opens so every figure stays reachable.
- **Three.js is bundled** from npm (`three@0.180.0`, in its own lazily loaded chunk) instead of being loaded from jsDelivr at runtime.
- `src/ui/WorldView.tsx` is split into `src/ui/world/` (scene runtime, camera maths, map tools, inspector, stage) and `src/ui/shell/` (navigation and focus, panel, HUD).

### Validation

- New tests cover panel hashes, the starting focus each panel sets, selection rules, stale selections, fly-to easing and zoom, mid-flight replanning, and the view offset for docked panels and bottom sheets.
- The canonical trajectory is unchanged: no file under `src/sim/` changed, and the day-46 screenshot shows the same figures as before.
- The fast-mode browser check passed three times (pause latency 234–338 ms). Browser checks covered every panel, focus on opening, Locate centring beside the panel, resizing across 860px, a deep link to Experiments, reduced motion and the WebGL fallback.

## [MVP8-Vision-023] - (2026-10-08)

### Added

- **Vision document.** [docs/VISION.md](docs/VISION.md) sets out the long-term direction: an institution-agnostic engine in which institutions emerge from agents' decisions instead of being hard-coded, with rules represented as inspectable data, Government's objective derived from households, and later extensions to politics and culture. It lists what MVP8 currently hard-codes, the risks, validation targets from known theory, and an incremental path. It is a direction document only; no simulation behaviour changed.

## [MVP8-Ensembles_Showcase-022] - (2026-10-08)

### Added

- **Multi-seed ensembles (#3).** The Experiments section has a new "Across many seeds" area. The scale, Government and competition questions can each run on 4, 8 or 16 seeds. Each outcome is reported with its mean, sample standard deviation, middle 80% (p10–p90) and range, with a table of every seed's values. Results are labelled as a spread across seeds, not one trajectory, and keep the seed set they were built from if the live seed changes.
- `src/sim/ensemble.ts`: a pure ensemble harness (`ensembleSeeds`, `ensembleSeedMetrics`, `summarizeEnsemble`, `runEnsemble`). Seeds are validated and always reported in ascending order.
- The browser runs ensemble seeds in parallel on a small Web Worker pool (one fewer than the CPU cores, at most four), with per-seed progress. An 8-seed scale ensemble takes about 4 seconds.

### Changed

- **README (#4).** It now opens with a link to the live simulator and current screenshots of the Overview, Markets and an ensemble result (`docs/images/`). It summarizes the five sections and the research questions, and links to the specification, architecture notes and validation guide.
- Firm cards put a stat's qualifier ("of 10 × $10") on its own line, so it no longer overflows its box at common desktop widths.

### Validation

- Tests cover the summary statistics against hand-computed values, deterministic seed sets, rejection of invalid seed sets, exact replay and seed-order independence for all three ensembles, agreement with the single-seed harnesses, isolation from a live simulation, and the ensemble labelling in the UI.
- In the browser, all three 8-seed ensembles ran with progress updates, the page stayed responsive, and the console showed no errors apart from the long-standing missing `favicon.ico`.

## [MVP8-Structure-021] - (2026-10-07)

### Changed

- **Formatting and linting (#38):** Prettier (`printWidth` 120) formats the source, and oxlint checks the ESLint correctness rules, typescript-eslint's recommended rules and React hooks rules. `npm run lint` runs both and is part of `npm run check`, `npm run agent:check` and both CI workflows. Applying the formatter was a separate formatting-only commit.
- **Line endings:** a new `.gitattributes` (`* text=auto eol=lf`) checks out every text file with LF on every platform, so the Prettier check enforces LF strictly and can't be defeated by local Git settings. Repository contents are unchanged, because they were already LF.
- **Daily step (#38):** `stepSimulation` is now an ordered list of named phases: `startDay`, `produce`, `runMarkets` (`clearMarket`, then `decidePrices`, for each industry), `runPayroll`, `runFiscalPhase`, `buildDayMetrics` and `closeDay`. The causal order and RNG draw sequence are unchanged.
- **Market structure (#36):** consumer industries are no longer limited to two firms. `SimulationConfig.firmsPerIndustry` (default 2) sets the number. The fallback queue orders overflow by distance to each household's next-best firm, a probing firm observes the lowest price its rivals advertised, and each purchase records `distancesByFirmId` instead of `distanceToA`/`distanceToB`. Firm IDs are built and parsed only by `consumerFirmId` and `firmSlot`, including in the research harnesses that pin Entertainment starting prices. The observer derives Firm A, B, C… and their colours from that slot rather than from `-a`/`-b` suffixes, and its cards, charts, share bars and maps render every firm in a market.
- **Renames (#34):** `DayMetrics.entertainmentTrips` is now `transportTrips` (it counts trips for all four consumer industries), and `householdCashGiniBeforeParity` is now `householdCashGiniAfterMarkets`. `Household.entertainmentToday` is removed, because `spatialPurchasesToday.entertainment` holds the same data. `HouseholdEntertainmentMetrics` is now `HouseholdSpatialPurchase`.
- **Performance (#37):** payroll and invariant checks look households up through an ID map, each market's customer statistics come from one pass over households, and the Gini coefficient uses a sorted O(n log n) formula that returns the same bits for integer inputs. The canonical step fell from about 2.0 ms to 1.7 ms, and a 1,000-household step from about 37 ms to 27 ms.
- **Documentation (#40):** `docs/ARCHITECTURE.md` describes the daily phases and the full market-clearing order: the seeded shuffle, preferred-firm assignment with seeded ties, proximity priority, the fallback queue, and the RNG draw order.

### Validation

- The canonical trajectory is bit-for-bit unchanged. Complete states (households, firms, Government, metrics and the event log) at days 0, 1, 2, 50 and 400 matched a baseline captured before the refactor for six configurations: canonical, an alternate seed, every probe and Government trial forced on, N=10, N=200, and Government disabled.
- New tests cover one-firm and three-firm industries (clearing, money conservation, per-firm distances, every firm selling, and competitor observation of the lowest rival price), the observer models for a three-firm market, rejected market structures, and Gini equality with the pairwise formula on 300 random integer vectors.

## [MVP8-Maintenance-020] - (2026-10-07)

### Changed

- **Dependencies** are pinned to caret ranges of the versions already in `package-lock.json` instead of `latest`. Vite, TypeScript and the React plugin moved to `devDependencies`, and `engines.node` is `>=22.12` (the floor Vite 8 requires; CI uses Node 22). Installed versions are unchanged (#33).
- **Browser check:** Playwright is now an exact devDependency (`1.55.0`, the version CI already used), installed by `npm ci`. The ad-hoc `npm install --no-save --package-lock=false playwright` step is removed: once versions were pinned it crashed with an npm peer-resolution bug, and without a lockfile it could also replace the locked Vite and React versions before the preview server ran.
- **Configuration:** removed `SimulationConfig` fields the engine ignored (`dailySupplyPerIndustry`, `targetHouseholdCashCents`, `firmTaxRateBps`, `householdParityEnabled`) and the unused `countAffordableAtPrice` helper. The multi-industry pricing probe no longer accepts or reports a `dailySupplyPerIndustry` option that had no effect. The UI reads the starting household cash from `INITIAL_HOUSEHOLD_CASH_CENTS` (#32).
- **Config validation:** `createSimulation` rejects a `householdCount` that is not a whole multiple of 10 of at least 10, and a grid with fewer cells than households plus consumer firms or a non-finite dimension, with messages naming the field. Previously, values such as `15` threw deep inside employment assignment and values such as `5` or `100.5` were silently clamped or rounded (#35).

### Validation

- Replaced the source-text assertions (`?raw` imports) with behavioral tests (#39):
  - `Math.random` is stubbed to throw while every stochastic mechanism runs for 60 days.
  - Pass-through spies check that nothing handed to the pricing strategy carries competitor profit, sales, market share, coordinates or household data.
  - The consumer pricing learner's next state is reproduced from price × units sold.
  - Effective equality is checked on a near-zero-Gini distribution.
  - The whole-state-clone guard relies on the existing structural-sharing test.
- Added tests for rejected and boundary population and grid configurations.

## [MVP8-Audit_Fixes-019] - (2026-10-07)

### Fixed

- **Transport events** now name the consumer industry that caused the trip ("tiles of Food travel") instead of always saying Entertainment (#13).
- **Employment / Wealth Dynamics cash bins** are half-open `[min, max)` ranges labelled `<$1`, `$1–$4.99`, `$5–$9.99`, `$10–$24.99`, `$25–$49.99` and `$50+`. Exactly $50 was previously in no bin, which dropped all 100 day-1 observations (#14).
- **Richest and poorest days** count every household tied for that day's highest or lowest balance. Tied leaders were previously never counted as richest, and poorest days were compared with day 1's tie structure (#15).
- **Top-1% wealth share** in the population-scale comparison now has the same meaning at N=10 and N=100: a boundary household counts in proportion, so at N=10 it is one tenth of the richest household's share rather than the richest 10%. The top-10% share is unchanged (#16).
- **Population-scale failure and policy counts** come from complete day metrics and Government state instead of the bounded event ledger, which would silently undercount above about 140 households. Results at N=10 and N=100 are unchanged (#30).

### Changed

- `DayMetrics.purchaseFailuresByCause` records each day's failed consumer purchases by cause (`cash`, `category_budget`, `inventory`).
- The event ledger is trimmed once at the end of each day instead of on every event, which cut the canonical step from about 4.9 ms to 1.7 ms. The same newest 1,600 events are retained, with the same IDs and order (#31).

### Validation

- Added tests for event retention, transport-event descriptions, cash-bin boundaries and exhaustiveness, tied extremes, fractional population shares, and failure counts in a 200-household economy whose days overflow the event ledger.
- The full test suite now runs in about 30 s, down from about 70 s.

## [MVP8-UI_Redesign-018.1] - (2026-10-07)

### Changed

- **Market map:** Markets now opens with a top-down "Who's cheapest where" map for the selected market. Shading shows the cheaper firm once the round trip is paid. Each household is a dot coloured by the firm it actually bought from today, and households that missed out are shown as red rings.
- **Household cash ledger:** the map inspector shows a household's day as a ledger: opening cash, wage (with any shortfall), shopping and transport, wealth tax, Government transfer, and closing cash.
- **Pillar height:** a Before tax / After tax toggle on the map, defaulting to before tax, because cash after redistribution is nearly uniform. Height now scales with the cube of cash relative to the starting amount, so few-dollar gaps are visible. The camera uses a narrower field of view, so perspective no longer makes nearer pillars look richer.
- **Cross-links:** household IDs in the Households table, the firm cards in Markets, and the firm markers on the market map open the selection on the economy map. The map and Markets now share one selected market and selection, so switching tabs no longer loses the selection.
- **Overview:** day 0 replaces the four empty "—" stats with a single "Run the economy" call to action. Feed items about a specific market open that market. The markets list has column headers, and "served" now reads "of households bought".
- **Hover tooltips:** households show cash before and after tax plus their employer; firms show tomorrow's price and headcount.
- Chart subtitles note the visible day range once the bounded 400-day history has dropped early days.
- The 3D map now redraws only when something changes, instead of rendering every frame while idle.

### Fixed

- Industry tiles overflowed the page horizontally at phone width.

### Validation

- Added tests showing that each household ledger reconciles exactly (opening + wage − spending = pre-tax cash; pre-tax − tax + transfer = closing) and opens with the previous day's closing cash. Added tests for the history-window note and the before/after pillar height.

## [MVP8-UI_Redesign-018] - (2026-10-07)

### Changed

- Redesigned the whole observer UI. Economic behavior, the simulation core, and the canonical trajectory are unchanged.
- **Shell:** a sticky top bar holds the five sections (Overview, Markets, Households, Government, Experiments) and the run controls (Run/Pause, Step, Speed, Restart, Scenario). Space runs or pauses. Tabs support arrow keys and are reflected in the URL hash. A footer states the seed, household count, and whether money was conserved.
- **Overview:** four headline stats with history sparklines (needs met, inequality, wealth tax, wages paid), the 3D map as the centerpiece, a "where the money went today" circuit diagram whose line widths scale with each flow, a plain-language feed of notable changes (with the full event log behind a disclosure), and a markets-at-a-glance list.
- **Markets:** four industry tiles act as the selector; the chosen market shows Firm A and Firm B side by side with plain-language learner status, then price, market share, earnings, and supply/sales charts. Firm A is always teal and Firm B always coral.
- **Households:** a ranked distribution of cash before redistribution against cash after, and a searchable, sortable table with a per-industry "bought today" indicator.
- **Government:** current rate and what the policy is trying to do in one sentence, today's fiscal stats, inequality before/after, and the tax rate over time.
- **Experiments:** each harness is a card with a plain question and description. Runs happen in a Web Worker (with a main-thread fallback), so the page stays responsive. Legacy diagnostics sit under "Older diagnostics".
- **3D map:** one market selector now drives both the territory floor and the household purchase details; firms outside the selected market are dimmed; hovering shows a tooltip; a search box selects any household or firm; the inspector is an overlay panel. Selecting a firm switches the map to its market.
- **Scenario settings** moved into a modal drawer with explanations per field and a single **Apply & restart**. The top-bar **Restart** always restarts the last applied scenario, so the two reset actions no longer overlap.
- Replaced the stylesheet with design tokens, a six-step type scale with a 12px minimum, and secondary text that meets WCAG AA contrast. Money is formatted as `$5,000.00` rather than `US$5,000.00`.
- Split `App.tsx` into `src/ui/views/*`, shared components, chart wrappers, and pure view-model helpers (`economyModel.ts`, `format.ts`, `households.ts`).
- Updated the page title and social metadata, and pointed the fast-mode browser check at the new `.scenario-summary` element.

### Removed

- Internal ticket codes from on-screen titles, duplicated charts on Overview and Government, the separate "Recent event ledger" panel, the budget strip under the 3D view, and unused legacy CSS.

### Validation

- Added `economyModel.test.ts`, covering completion rate, the daily money-circuit identities, industry snapshots, firm series alignment, plain-language firm status, and the highlight feed.
- Checked every section in the browser at phone, tablet, and desktop widths, including a phone-width layout with no horizontal page scroll, and measured that a 1,000-day experiment no longer blocks the main thread.

## [MVP8-Settings_Validation-017] - (2026-10-07)

### Fixed

- Fixed Reset throwing an unhandled exception when a firm starting price or the price-learning step held text that is not a number, and the first step failing on a non-numeric transport rate (#28).
- Fixed a non-numeric, zero, or out-of-range seed being silently replaced (for example `abc` became `1831565813`) while the run appeared to use the typed value.

### Changed

- Moved settings parsing into `src/ui/simulationSettings.ts`. Amounts must be dollar values with at most two decimal places. Prices and the step must be at least $0.01; the transport rate and expenditure base may be $0.00. Seeds must be whole numbers from 1 to 4294967295.
- Invalid fields are marked `aria-invalid` and listed with their reason above **Reset with values**, which is disabled until every field is valid. The control-bar Reset leaves the current run untouched and opens the settings panel instead of pausing or replacing the economy.

### Validation

- Added parser coverage for non-numeric, empty, negative, malformed, sub-cent, zero, and out-of-range inputs, plus equivalence with the previous parsing for valid inputs.
- The canonical-trajectory UI test now builds its configuration through the real settings parser.

## [MVP8-RNG_Streams-016] - (2026-10-07)

### Fixed

- Fixed the Government policy RNG seed being identical to the spatial-layout seed for every non-zero master seed. Both derivations XORed the seed with `0x9e3779b9`, so Government experiment draws replayed the draws that placed households and firms (#27).
- Government now derives its seed from the normalized master seed, a dedicated salt, and the new `mixSeed` helper (murmur3 `fmix32`) in `rng.ts`. A plain distinct XOR constant was rejected because xorshift is linear over GF(2): it would leave every Government draw a fixed, seed-independent XOR offset of the spatial draws.

### Changed

- Government experiment timing, adopted rates, and fiscal trajectories change for every seed. Spatial layout, employment assignment, payroll order, market ordering, and firm probing draws are unchanged.

### Validation

- Added regression coverage that market, spatial, employment, and Government seeds are pairwise distinct for the canonical seed, edge seeds, and 500 generated seeds, and that the Government seed is not a fixed XOR offset of any other stream.
- Confirmed the new tests fail against both the previous derivation and a distinct-XOR-constant-only variant.

## [MVP8-Simulation_Runner-015] - (2026-09-06)

### Added

- Added a durable production-browser fast-mode regression check in `scripts/validate-fast-mode.mjs` using headless Chromium.
- Added `.github/workflows/fast-mode-browser-validation.yml` so pull requests targeting `main` and pushes to `main` build the production application and exercise canonical fast-mode responsiveness automatically.

### Validation

- The browser check verifies canonical N=100, confirms 100× fast mode advances, requires Pause to become observable within 1.5 seconds, and verifies that the visible day stops advancing after Pause.
- The CI path runs the unit suite and production build before the focused browser check; the browser dependency remains intentionally separate from local `npm run check`.

## [MVP8-Simulation_Runner-014] - (2026-09-05)

### Changed

- Moved runtime simulation stepping out of React state-updater batching into `SimulationRunner`.
- The runner advances one economic day at a time, yields browser control between days, publishes the latest completed state at a bounded observer cadence, and cancels obsolete scheduled work on pause, speed changes, reset, or teardown.
- Preserved sequential simulation semantics while decoupling economic stepping frequency from React rendering frequency.

### Validation

- Added focused regression coverage for exact-state equivalence with direct sequential stepping, cancellation, non-overlapping speed changes, reset synchronization, and render-cadence independence.
- Retained the August 14 fast-mode pause-delay observation in `docs/VALIDATION.md` as the pre-fix browser result rather than rewriting it as though the runner had already been present.

## [MVP8-Spatial_Affordability-013] - (2026-09-02)

### Fixed

- Corrected `householdsAffordableAtMarketOpen` to test whether at least one supplier's delivered cost—posted price plus household-specific transport fee—fits both the household's industry budget and current cash.
- Removed the prior observer calculation that compared only the minimum posted sticker price against household limits and could therefore classify spatially unaffordable households as affordable.

### Validation

- Added regression cases where sticker price fits but every delivered cost exceeds the opening limit, and where exactly one supplier's delivered cost fits.
- The correction changes observer/research measurement only; household purchase choice already used delivered cost.

## [MVP8-Documentation-012] - (2026-09-01)

### Changed

- Aligned `docs/ARCHITECTURE.md` and `docs/VALIDATION.md` with the implemented MVP8 population model, nine-firm structure, cash-constrained payroll, residual-profit taxation, population-derived money supply, and current runtime invariants.
- Reclassified older N=10/MVP2 validation material as historical where appropriate instead of presenting it as the current canonical model.

## [MVP8-Population_Scaling-011] - (2026-08-30)

### Fixed

- Corrected population-scale `transportRevenuePerHouseholdCents` to use transport revenue accumulated across the complete requested experiment horizon.
- The previous calculation averaged only `state.metrics`, whose bounded retention window truncates older days once the horizon exceeds `MAX_HISTORY`.

### Validation

- Added a regression that deliberately runs beyond retained metric history, proves the retained-window value differs from the full-horizon value, and verifies the experiment reports the full-horizon result.
- Historical population-scale results produced before this correction remain historical outputs; this change does not retroactively relabel them as post-fix measurements.

## [MVP8-Population_Scaling-010.2] - (2026-08-17)

### Added

- Added `npm run agent:check`, a cross-platform Node validation wrapper that runs typecheck, tests, and build sequentially while routing full output to `.agent-logs/typecheck.log`, `.agent-logs/tests.log`, and `.agent-logs/build.log`.
- Added concise terminal PASS/FAIL summaries, bounded failure excerpts, first-failure stopping, and root-level Codex validation guidance in `AGENTS.md`.

### Changed

- Added `.agent-logs/` to `.gitignore`; existing `check`, `typecheck`, `test:run`, and `build` commands remain unchanged.

### Validation

- `npm run agent:check` passed TypeScript checking, all tests, and the production build. Full stage output was captured in the ignored logs.

## [MVP8-Population_Scaling-010.1] - (2026-08-14)

### Added

- Added persistent Overview, Markets, Households & Labor, Government, and Research tabs with active-tab-only observer rendering.
- Added collapsible Simulation settings, an industry-focused market observer, household search and deterministic sorting, and a user-triggered N=10/N=100 Research panel.
- Added presentation regression coverage for 100-household availability, search, sorting, nine-firm inclusion, and canonical UI-configuration determinism.

### Changed

- Reorganized live summary, market, labor, geography, fiscal, event, and research surfaces into a summary-to-detail hierarchy.
- Moved initialization parameters out of primary run controls; draft values still apply only through reset.
- Renamed the legacy `preTaxProfit` observer signal to operating earnings while reserving residual profit for post-payroll accounting.

### Fixed

- Removed the positional fifth-row CSS rule that could hide legitimate economic agents from reused market tables.

### Validation

- Passed `npm run check`: 94 tests across 17 files, TypeScript checking, and the production build.
- Verified canonical UI-configuration equivalence, all five tabs at 1,280 and 390 pixels, 100 household rows, 108 map markers, no page overflow, and no browser console warnings/errors.

## [MVP8-Population_Scaling-010] - (2026-08-14)

### Added

- Added configurable household population in complete ten-household blocks and a dedicated normalized N=10/N=100 scale-comparison experiment.
- Added per-capita, rate, volatility, extreme-share, percentage-concentration, spatial, payroll, taxation, distribution, and Government scale metrics.
- Added canonical 100-household employment, production, money, determinism, comparison, and long-run invariant coverage.

### Changed

- Scaled the canonical population from 10 to 100 households and total money from $500 to $5,000 while retaining $50 per household.
- Scaled fixed employment to 10 workers per consumer firm and 20 at Transport; consumer production is now 50 units per firm and 100 per industry.
- Derived household generation, spatial placement, employment slots, expected money, demand limits, and invariant cardinalities from configured population.
- Increased the bounded event history to 1,600 entries so a complete 100-household day remains inspectable.
- Compacted household map markers and bounded household observer tables while retaining individual inspection data.

### Validation

- Canonical seed `20260813` 1,000-day N=100 and N=10/N=100 comparison runs reproduced exactly.
- The canonical 10,000-day N=100 stress run conserved exactly $5,000 with non-negative balances, zero completed-day firm/Government cash, and bounded histories.
- `npm run check`, desktop/mobile rendering, console, overflow, and interactive performance validation completed successfully.

## [MVP7-Wages_Profits-009] - (2026-08-14)

### Added

- Added a fixed 1,000-cent contractual daily wage for every worker, contractual-payroll obligations, cash-constrained wage payments, unpaid-wage observations, and payroll-fulfillment measures.
- Added residual post-payroll firm profit and explicit `CORPORATE_PROFIT_TAX_PAID` Firm-to-Government transfers at a fixed, non-adaptive 10,000-basis-point corporate profit-tax rate.
- Added separate Government corporate-profit-tax receipts, household wealth-tax receipts, combined receipts, redistribution, and ending-balance accounting.
- Added firm- and economy-level payroll, profit, corporate-tax, Government-funding-share, incomplete-payroll-spell, and industry trajectory analytics.
- Added dashboard fields for the complete wage/profit/tax circuit, a formal [MVP7 specification](docs/MVP7_SPEC.md), and payroll/profit/fiscal invariant coverage.

### Changed

- Replaced complete-revenue payroll with `min(firm cash, contractual payroll)` while retaining deterministic seed/day/firm/employee remainder ordering.
- Changed household wage income to actual contractual wages received; unpaid wages remain daily observations and are not carried as debt.
- Changed fiscal settlement so payroll precedes fixed corporate-profit taxation, the household wealth-tax base remains post-payroll cash, and both receipt sources enter one poorest-first redistribution stage.
- Preserved fixed employment, production, price learning, the learner information boundary, the adaptive household wealth-tax learner, and unrelated RNG trajectories.
- Retained legacy market `preTaxProfit` as the unchanged price-learning signal; new residual-profit fields are authoritative for MVP7 accounting.

### Validation

- Passed `npm run check`: 87 tests across 15 files, TypeScript checking, and the production build.
- Reproduced the canonical seed `20260813` 1,000-day trajectory exactly and retained alternate-seed coverage.
- Recorded $100,000.00 contractual payroll, $88,037.35 wages, $11,962.65 unpaid wages, $47,705.36 corporate tax, $42,447.67 wealth tax, and $90,153.03 redistribution in the canonical trajectory.
- Passed the 10,000-day stress test with exactly $500 conserved, non-negative balances, zero completed-day firm/Government cash, and bounded histories.
- Validated 1,280-pixel desktop and 390-pixel mobile layouts with no page-level overflow or browser console errors/warnings.

## [MVP6-Government-008.1] - (2026-08-14)

### Changed

- Replaced the `1e-12` Gini tie mechanism with effective equality defined by a post-fiscal integer cash range of at most one cent.
- Added explicit `EQUALIZING` and `MINIMIZING_TAX` policy modes: experiments search only upward under inequality and only downward under effective equality.
- Lower rates are adopted whenever effective equality survives and rejected when the cash range exceeds one cent; incumbent days return to upward search if equality later breaks.
- Added policy-mode/equality event fields, Government-panel objective/range status, and trajectory occupancy plus directional adoption/rejection analytics.
- Updated learner, catalog, reproducibility, lifecycle, accounting, trajectory, and UI regression coverage.

## [MVP6-Government-008] - (2026-08-14)

### Added

- Added an adaptive Government with a flat 0–100% household post-payroll wealth tax, integer-basis-point policy state, and a narrow post-fiscal cash-Gini objective.
- Added seeded ±1/5/10/20 percentage-point and 0/25/50/75/100% anchor experiments, current references, deterministic adoption/rejection, and a `1e-12` equal-Gini lower-tax tie-breaker.
- Added explicit poorest-first integer-cent water-filling redistribution of all receipts, including seeded fair remainder allocation.
- Added fiscal policy, household tax/transfer, adoption/rejection events, household fiscal accounting, pre/post Gini, rate occupancy, and policy-spell analytics.
- Added a same-seed 1,000-day inactive-Government comparison, cross-seed harness, Government UI, household fiscal fields, pre/post Gini chart, and comprehensive tests.

### Changed

- Government now acts after unchanged complete payroll. The default starts at the MVP5 0% baseline and learns through realized experiments; retained MVP5 probes explicitly use inactive controls.

### Validation

- Canonical 1,000-day and 10,000-day adaptive runs conserved exactly $500, reconciled every tax cent to transfers, and left all firms and Government at $0 after completed days.

## [MVP5-Employment-007.1] - (2026-08-14)

### Added

- Added a pure 1,000-day Employment / Wealth Dynamics report using compact complete observations outside the bounded interactive history.
- Added household cash and wage trajectories, cash and wage Gini trajectories, and mean/maximum/terminal richest-1, richest-2, and richest-3 money concentration.
- Added tie-aware fractional wealth ranks, richest/poorest and top/bottom-three occupancy, mean rank, and rank-change mobility statistics.
- Added strict `<$1`, `<$5`, and `<$10` low-cash occupancy, spell count, mean spell duration, and longest-spell analysis.
- Added household and industry purchase completion plus separate actual-cash, category-budget, and inventory/availability failure counts.
- Added employer-worker wage, operating-earnings, wealth, consumption, Transport split-payroll, production, sell-through, expiration, and prior-cash-bin next-day consumption analysis.
- Added canonical and alternate-seed reporting, secondary day-1,000 snapshots, descriptive Pearson wage/mean-cash correlation, and dashboard tables for the analytical results.
- Added synthetic inequality, concentration, tied-rank, low-cash boundary/spell, trajectory, accounting, reproducibility, state-purity, RNG-isolation, and continuation-equivalence tests.

### Changed

- Enriched insufficient-funds observer events with already-known actual cash, category budget, and minimum delivered cost so analysis can distinguish cash from budget constraints without changing purchase decisions or RNG behavior.

### Validation

- Preserved all MVP5 economic behavior and accounting invariants; the update changes observer data and analysis only.

## [MVP5-Employment-007] - (2026-08-14)

### Added

- Made all ten households fixed workers through a dedicated deterministic employment subseed: one worker at each of the eight consumer firms and two at Transport.
- Added explicit `EMPLOYMENT_ASSIGNED`, `FIRM_PRODUCED`, and `WAGE_PAID` events with causal employment, production, revenue, employee-count, and integer-cent transfer data.
- Added household employer, daily wage, cumulative wage income, daily spending, and net cash-change state and analytics.
- Added firm employee, worker-count, applicable productivity, units-produced, wage-pool, wages-paid, mean-wage, and retained-cash state and analytics.
- Added economy-wide household cash distribution, cash Gini, mean daily wage, wage-income Gini, total wages, and household spending metrics.
- Added a focused 1,000-day employment experiment and employment, production, payroll, fiscal-policy, affordability, determinism, conservation, and long-run regression coverage.

### Changed

- Replaced exogenous consumer inventory with explicit labor-derived production at five units per consumer worker per day. Each consumer firm therefore produces five units and each two-firm industry can produce ten.
- Changed daily inventory closure to enforce `units produced = units sold + units expired` while preserving non-persistent inventory.
- Distributed every firm’s complete end-of-market cash balance to its employees as wages. One-worker firms transfer the full pool; Transport splits its pool across two workers with reproducible integer-cent remainder allocation.
- Preserved the MVP4 pricing learner and made its operating-performance evaluation explicitly occur before payroll, so zero retained firm cash does not erase the learner’s revenue signal.
- Disabled the default 100% firm tax and household parity restoration while retaining Government as an inactive architectural agent with zero default cash.
- Made household cash persistent across days and allowed household wealth to diverge while retaining category expenditure ceilings, actual-cash affordability, non-negative balances, and one real cash stock per household.
- Kept Transport effectively unlimited-capacity and inventory-free; its two workers affect employment and payroll accounting but not service output.
- Updated the dashboard to display the exact MVP label, labor productivity, inactive fiscal loop, employment mapping, production, operating earnings, wages, retained cash, persistent wealth, and cash/wage inequality.

### Validation

- Passed 64 automated tests, type checking, production build, the combined project check, and `git diff --check`.
- Passed exact same-seed replay, canonical and alternate-seed 1,000-day experiments, and the 10,000-day bounded-history invariant stress test with exactly $500 conserved.
- Validated desktop, approximately 390-pixel mobile, and 100-days/second browser operation with no console errors or page-level horizontal overflow.

## [MVP4-Spatial_Competition_Full-006.4] - (2026-08-14)

- Added a permanent design rule requiring dynamic behavior to be evaluated from trajectories rather than inferred from terminal snapshots.
- Changed generalized spatial competition reports to analyze all days 1–1,000 with no implicit burn-in.
- Added leadership/tie occupancy, mean and cumulative sales shares, leadership transitions, and leading-spell duration.
- Added temporary 100%-share occupancy and spell metrics without classifying those days as monopoly.
- Added posted/incumbent price ranges and means plus cumulative, mean, and industry-share zero-cost profit.
- Reframed retained end-of-horizon values as secondary day-1,000 terminal snapshots.
- Added synthetic trajectory, tie-transition, spell, aggregation, purity, and seeded 1,000-day reproducibility tests.

## Maintenance convention

Every meaningful software update should receive a newest-first entry with a readable update identifier and date. Use at most one base update number per Git commit. Refinements completed before that commit keep the same base number with a decimal suffix—for example, `003` and `003.1` belong to the same commit family. Allocate the next base number only for a later commit. Record the update's scope, additions, changes or fixes, and relevant validation. Include only headings that apply. Keep entries factual and implementation-focused; if a change or validation result cannot be verified, omit it or label it uncertain rather than reconstructing it.

## [MVP4-Spatial_Competition_Full-006.3] - (2026-08-14)

### Added

- Added Food A/B, Utilities A/B, and Healthcare A/B alongside Entertainment A/B, producing four two-firm spatial consumer markets plus the single derived Transport monopoly.
- Added seeded unique coordinates for all eight consumer firms and all ten households, generalized delivered-cost clearing, proximity inventory priority, fallback, and competitor-aware experiment catalogs across every consumer industry.
- Added integer basis-point expenditure shares—Food 1290, Utilities 600, Healthcare 790, Entertainment 460—plus a separate configurable daily expenditure base and deterministic integer-cent derivation.
- Added per-household spatial outcomes by industry, per-firm delivered-cost and travel metrics, Transport revenue by originating industry, a generalized map, budget summary, competitive-pricing inspection, experiments, and regression coverage.

### Changed

- All modeled consumer purchases now generate separate product and Transport transfers. Transport remains unlimited-capacity, fixed-rate, non-adaptive, and without a household expenditure share.
- Fixed authoritative dollar category limits were replaced by derived limits from the daily expenditure base and shares. The modeled shares intentionally total 31.4% and unused limits remain ordinary household cash.
- Generalized Entertainment-specific spatial terminology and clearing code while preserving Government parity, exact money conservation, finite inventory, seeded RNG streams, and the 006.2 structural-sharing step architecture.

## [MVP4-Spatial_Competition_Full-006.2] - (2026-08-14)

### Changed

- Removed `structuredClone(previous)` from the daily simulation hot path and replaced it with targeted immutable copies of households/outcomes, firms/pricing state, Government, and history array containers.
- Existing immutable configuration, industries, spatial coordinates, daily metric records, and ledger event records are now structurally shared between consecutive states.
- Retained the existing five-day batching per React publication at 100 days/second; every economic day still executes sequentially.

### Validation

- Added previous-state immutability and historical-reference-sharing tests, exact 1,000-day same-seed replay, and a 10,000-day stress regression with 400 metrics, no more than 600 events, and exact terminal invariants.

## [MVP4-Spatial_Competition_Full-006.1] - (2026-08-14)

### Added

- Added public same-industry competitor sticker-price observation for Entertainment firms only.
- Added seeded dynamic price-experiment catalogs containing incumbent-anchored one-cent, 5%, 10%, and 20% moves plus competitor match, adjacent-cent, and 5% anchors.
- Added structured experiment categories and `PRICE_EXPERIMENT_STARTED`, `PRICE_EXPERIMENT_ADOPTED`, and `PRICE_EXPERIMENT_REJECTED` observer events with incumbent, experimental, competitor, and profit-reference fields.
- Added a compact Entertainment pricing-intelligence panel and catalog, information-boundary, reference-refresh, adoption/rejection, sequence, and long-run regression coverage.

### Changed

- Locally settled firms now choose experiments randomly from a regenerated, deduplicated catalog instead of limiting persistent exploration to adjacent cents.
- Experiment profit is compared strictly against profit from the most recent normal incumbent-price day, rather than a potentially stale historical maximum.
- Firms that sold their entire stock on the just-completed day now mask every below-incumbent catalog candidate; upward experiments remain available, and discounts return when the firm does not sell out.
- Monopoly controls receive incumbent-anchored candidates only; Transport, spatial household choice, parity restoration, and transaction accounting are unchanged.

## [MVP4-Spatial_Competition_Full-006] - (2026-08-14)

### Added

- Added a seeded static 20 × 20 integer grid with unique fixed coordinates for ten households and Entertainment Firms A and B, generated from an isolated derived spatial RNG stream.
- Added Manhattan round-trip travel, a configurable 2-cent-per-tile rate, delivered-cost choice, seeded ties, proximity priority, and affordable inventory fallback.
- Added separate product and Transport transfers, spatial events/analytics, explicit parity transfers, pre/post-parity Gini, and a multi-seed experiment.
- Added a responsive static tile map with household numbers, distinct A/B markers, coordinate and delivered-quote tooltips.
- Added `docs/MVP4_SPEC.md` and spatial, accounting, determinism, experiment, and 1,000-day stability coverage.

### Changed

- Removed abstract daily Transport-unit consumption. Transport is now an unlimited-capacity, inventory-free derived Entertainment travel service with an exogenous rate and no adaptive pricing.
- Entertainment budgets and cash checks now apply to delivered cost. Food, Utilities, and Healthcare remain non-spatial with unchanged learners and demand boundaries.
- Replaced equal redistribution with explicit household-specific transfers restoring the configured $50 target after 100% taxation of every firm, including Transport.
- Preserved the 005.2 pricing strategy and private information boundary unchanged.

## [MVP3-Entertainment_Competition-005.2] - (2026-08-13)

Replaced artificial ordering and terminal learner convergence with reproducible seeded sampling and persistent local price exploration. No new market mechanism or competitor information was added.

### Added

- Central xorshift32 seeded RNG (canonical seed `20260813`) with reusable draw, shuffle, selection, and probability utilities; the UI exposes the run seed.
- Seeded household arrival shuffles for every market/day and seeded equal-price firm selection.
- Independently sampled 10%-per-day one-cent probes for locally settled firms, with explicit incumbent/reference profit, probe direction/state, and `PRICE_PROBE_STARTED`, `PRICE_PROBE_ADOPTED`, and `PRICE_PROBE_REJECTED` events.

### Changed

- Terminal pricing convergence is now local settlement: firms retain broad discovery, then remain capable of probing indefinitely and adopt only probes that improve their own realised profit.
- Dashboard status distinguishes searching, locally settled, and probing, and displays tested, next, and incumbent prices.
- Competition experiments run through their configured horizon and accept a seed so post-settlement behavior remains observable.

### Validation

- Added seeded replay, seeded tie/shuffle, probe lifecycle, persistent exploration, accounting, 1,000-day stability, and bounded-history coverage; obsolete exact 5/5 and permanent-price assumptions were removed.

## [MVP3-Entertainment_Competition-005.1] - (2026-08-13)

### Summary

Added deterministic starting-price sensitivity analysis for the existing Entertainment competition model without changing economic or pricing behavior.

### Added

- Full 8×8 Cartesian grid over $1/$2/$3/$4/$5/$6/$8/$10 Entertainment A/B starts with a 300-day horizon.
- Per-combination endpoints, convergence days, convergence status, terminal shares/profits, terminal pricing state, and control endpoints.
- Full-grid swapped-start symmetry regression and horizon/non-mutation/control/observer-boundary tests.
- Compact matrix in the existing dashboard with A starts as rows, B starts as columns, and A/B endpoints in each cell.

### Validation

- All 64 combinations converged within 300 days; multiple deterministic endpoint regions were observed.
- Equal-price starts remained synchronized and converged to $5/$5; asymmetric starts produced path-dependent endpoints ranging from $1/$1 through $5/$5, including one- and two-cent endpoint differences.
- Swapped starts were exactly symmetric after exchanging firm labels, including endpoints, convergence timing, and terminal shares.
- Food/Utilities/Transport/Healthcare remained at $15/$12/$8/$10 in every run.
- 43 tests passed across five files; typecheck, build, aggregate check, and browser validation passed.
- No simulation behavior, pricing logic, firm information, tie-breaking, or experiment parameter changed during final documentation and validation.

## [MVP3-Entertainment_Competition-005] - (2026-08-13)

### Summary

Added homogeneous-product competition in Entertainment while retaining the other four industries as monopoly controls.

### Added

- A second independently learning Entertainment firm with its own cash, inventory, outcomes, and pricing state.
- Generic cheapest-affordable-available supplier choice with fallback after stockout.
- Deterministic equal-price demand splitting with rotating daily first priority.
- Per-firm market share, total industry sales, and truthful transaction-price observer metrics.
- Competitive $1/$8 starting-price experiment with price, sales, profit, share, convergence, and final learner-state results.
- `docs/MVP3_SPEC.md` and competition regressions covering choice, ties, fallback, failure semantics, events, taxation, controls, determinism, and 1,000-day stability.

### Changed

- Generalized industry processing and invariants from exactly one firm to configured one-or-more firm collections.
- Government now taxes and pools receipts from six firms.
- Price/profit charts and market table identify both Entertainment firms separately; the table displays observer market share.
- Grouped Entertainment events retain granular firm counterparties.
- Pricing strategy and firm information inputs remain unchanged.

### Validation

- 38 tests passed across four files; typecheck, build, and aggregate check passed.
- Food/Utilities/Transport/Healthcare retained $15/$12/$8/$10 control endpoints.
- Entertainment A/B converged to an observed $4 learner endpoint on days 12/13; equal-price days split demand 5/5.
- The 1,000-day run retained $500 total money, $50 equal household balances, zero Gini, exact stock flows, bounded histories, and deterministic output.
- Desktop and 390px browser checks passed with populated experiment data, contained table scrolling, no page/chart overflow, and no console warnings or errors.

## [MVP2-Industry_Demand_Boundaries-004.1] - (2026-08-13)

### Summary

Introduced the first controlled industry asymmetry through distinct fixed household demand boundaries while preserving the stable $500 monetary circuit.

### Added

- Industry-defined household budgets: Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5.
- Boundary regressions for purchase at the exact budget and affordability failure one cent above it.
- Distinct-optimum convergence coverage, long-run stability, and cross-industry isolation checks.

### Changed

- Household industry outcomes now initialize budgets from reusable industry definitions rather than one shared constant.
- Market overview now displays each industry's household budget beside tested/next price, sales, profit, and convergence.
- Varied-start experiment expectations and current documentation now reflect five distinct analytical optima.
- Pricing strategy, supply, taxation, redistribution, household symmetry, and information boundaries remain unchanged.

### Validation

- 31 tests passed across four files; typecheck, production build, and aggregate check passed.
- Food/Utilities/Transport/Healthcare/Entertainment converged to $15/$12/$8/$10/$5 on days 23/19/12/14/24.
- The 1,000-day run retained $50 household balances, zero Gini, $500 total money, and valid independent stock flows.
- Determinism and canonical industry-processing-order independence passed.
- Development-server browser verification confirmed visible per-industry budgets, populated distinct convergence results, and no console warnings or errors.

## [MVP2-Multi_Industry-004] - (2026-08-13)

### Summary

Generalized the deterministic finite-supply economy from one food market to five symmetric industries while preserving the analytically stable reference circuit.

### Added

- Food, Utilities, Transport, Healthcare, and Entertainment definitions with one independently learning firm each.
- Industry-keyed household budgets, daily outcomes, and lifetime causal counters.
- Generic market events carrying industry, firm, and household identity.
- Per-market historical metrics, compact five-market dashboard, selected-market capacity chart, and five-line price/profit comparisons.
- Deterministic varied-start five-firm convergence experiment and `docs/MVP2_SPEC.md`.
- Regression coverage for independent stock flows, pooled taxation, budget non-monetization, long-run stability, determinism, and industry processing order.

### Changed

- Raised default household cash from $10 to $50 and total closed-circuit money from $100 to $500.
- Replaced the single `firm`/`pricing` state with iterable industry and firm collections; the pricing heuristic itself remains materially unchanged.
- Applied one common configurable daily supply independently to all five markets, defaulting to ten units each.
- Generalized supply, expiration, firm-result, pricing, tax, and display-grouping paths across markets.
- Government now taxes all five firms, pools receipts, and redistributes the complete pool equally.
- Updated README, architecture, validation, and research notes for the MVP 2 model.

### Validation

- 26 automated tests passed across four files.
- TypeScript typecheck passed.
- Production build and aggregate check passed.
- Varied starts $1/$2/$5/$15/$20 converged independently to $10 on days 18/17/14/14/19.
- A 1,000-day canonical run retained $50 household balances, zero Gini, $500 total money, and valid per-industry stock flows.
- Forward and reversed canonical industry orders produced identical economic outcomes.
- Development server and initial desktop dashboard DOM sanity check passed; populated/mobile/console browser follow-ups remain pending because the browser URL policy blocked subsequent localhost interaction.

## [MVP1-Scarcity_Analysis-003.1] - (2026-08-13)

### Summary

Added household-distribution analysis and deterministic starting-price experiments, then changed the visible default finite exogenous daily supply from eight to ten units to stabilize the baseline economy. The firm's pricing strategy and information inputs remain unchanged.

### Added

- Added pure minimum, median, maximum, Gini, and affordability measurements derived from household cash balances.
- Added pre-market and end-of-day household distribution fields to historical daily metrics.
- Added `householdsAffordableAtMarketOpen`, captured before queue processing or purchases.
- Added lifetime purchases, stockout failures, and affordability failures to household state so cumulative analysis is independent of bounded event retention.
- Added runtime validation that every household's cumulative outcomes are non-negative integers and account for every simulated day.
- Added a deterministic starting-price experiment utility with the required 11-price grid, fixed $1.00 step, ten-unit default supply, 300-day horizon, explicit non-convergence results, final wealth distribution, affordability, and per-household cumulative outcomes.
- Added a latest-day causal diagnostic linking tested price, market-open cash distribution, affordability, market result, profit, and next price.
- Added a household wealth-distribution chart, current Gini metric, market-capacity chart, cumulative household outcome columns, and an on-demand experiment chart/table.
- Added precise analytics and controlled-experiment tests, including known Gini distributions and observer/strategy boundary checks.

### Experiment results

- Under ten-unit supply, all 11 sampled starting prices converged to the $10.00 learner endpoint in 9–19 days.
- Every run ended with equal $10.00 household balances, zero Gini, and equal cumulative consumption within that run.
- The former eight-unit grid remains documented in lab notes as the historical scarcity comparison that produced multiple learner endpoints.

### Changed

- Extended the former food stock-flow chart to compare affordable households at market open with supply, sales, and expiration.
- Updated household inspection to expose long-run food access without changing household behavior.
- Changed the default and default experiment supply from eight to ten exogenous units, matching one desired unit for each household.
- Made the stabilizing role explicit: affordable default markets serve every household, full redistribution restores each balance exactly, and stockout-driven wealth divergence does not arise.
- Updated README, architecture, MVP 1 specification, validation documentation, page metadata, and lab notes for the MVP 1.1 analysis layer.
- Left `pricingStrategy.ts`, the `decideTomorrowPrice` signature, and all existing firm inputs unchanged.

### Validation

- `npm run test:run`: 41 tests passed across 4 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite retained its non-failing chunk-size advisory.
- `npm run check`: passed.
- The controlled 11-price suite ran twice identically; every sampled start converged to $10.00 within 19 days.
- `npm run dev`: the local application loaded successfully in the browser.
- Desktop checks verified daily causal diagnostics, all 11 experiment rows, cumulative outcomes for all 10 households, the common $10.00 endpoint, and zero console warnings/errors.
- Mobile checks at a 390-pixel viewport verified both normal and populated-experiment layouts with no page-level horizontal overflow.
- GitHub Pages deployment was not performed as part of this local update.

## [MVP1-Finite_Supply-003] - (2026-08-13)

### Summary

Introduced a fixed exogenous daily food supply as MVP 1's single economic mechanism, with explicit stock-flow accounting, causal scarcity outcomes, deterministic allocation, historical metrics, dashboard inspection, and runtime validation. The firm's MVP 0 pricing strategy and its input boundary remain unchanged.

### Added

- Added configurable non-negative integer `dailyFoodSupply`, defaulting to eight units and applied only when a run is created or reset.
- Added daily firm stock, expiration, and sold-out state plus household `purchased`, `insufficient_funds`, and `stockout` outcomes.
- Added explicit `FOOD_SUPPLY_RECEIVED`, `HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS`, `HOUSEHOLD_PURCHASE_FAILED_STOCKOUT`, and `FOOD_EXPIRED` events.
- Added deterministic rotating household purchase priority, advancing the first household by one each day and wrapping after household 10.
- Added historical food-supplied, units-sold, units-expired, stockout-failure, affordability-failure, and sold-out metrics.
- Added runtime food invariants for non-negative integer stock, the sales cap, exact supply-to-sale/expiration accounting, zero carry-over, matching household/firm sales, and complete causal outcomes.
- Added dashboard supply configuration, food stock-flow chart, scarcity headline metrics, firm supply/expiration inspection, and household-level failure causes.
- Added an MVP 1 specification and updated architecture, validation, README, and historical-spec routing.
- Expanded automated coverage for supply caps, exact eight-unit sales, expiration, stock-flow conservation, no carry-over, inventory bounds, causal failures, rotation fairness, determinism, money, taxation, redistribution, event grouping, historical metrics, reset behavior, and learner behavior.

### Changed

- Replaced unlimited food with a new exogenous receipt at the start of every simulated day.
- Replaced fixed household priority with cyclic day-based priority without introducing randomness.
- Replaced generic purchase failures with separate affordability and stockout event causes.
- Replaced the Quantity Sold chart with a supplied/sold/expired stock-flow chart.
- Updated the ledger's market summaries to report purchases, affordability failures, stockout failures, and spending while preserving raw source events.
- Made expiration explicit even when zero units expire; inventory is never silently reset.
- Kept `decideTomorrowPrice` behaviorally and structurally unchanged: neither stockouts nor latent unmet demand became new strategy inputs.

### Observed behavior

- The equal-cash one-day benchmark remains exact: $9.99 yields eight sales and $79.92, $10.00 yields eight sales and $80.00, and $10.01 yields no sales.
- Finite allocation makes later affordability path-dependent because equal redistribution does not erase the cash difference between buyers and non-buyers. With the unchanged learner, the tested $20.00 path converges to $10.00, while the default $2.00 path deterministically converges to $6.70. This behavior is documented rather than corrected with an excluded stabilizer or pricing heuristic.

### Validation

- `npm run test:run`: 26 tests passed across 2 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite reported its existing non-failing chunk-size advisory.
- `npm run check`: passed.
- `npm run dev`: Vite became ready and the local application returned HTTP 200.
- Browser smoke tests confirmed the MVP 1 controls, one-day scarcity metrics, supply and expiration ledger events, household stockout outcomes, zero console warnings/errors, and no horizontal overflow at a 390-pixel responsive viewport.
- GitHub Pages deployment was not performed as part of this local update.

## [MVP0-UI_Refinement-002] - (2026-08-13)

### Summary

Refined the MVP 0 research dashboard to make the firm's experiment cycle and event history easier to interpret without changing the underlying economic model or pricing algorithm.

### Added

- Added a Search Step chart backed by each day's stored `priceStepSizeCents` metric, with currency-formatted axis values and tooltips.
- Added `PriceDecisionAction`, a structured decision classification with `increase`, `decrease`, `refine`, `hold`, and `converged` actions.
- Added `latestDecisionAction` to simulation state and returned an action from every existing pricing-strategy decision path.
- Added dynamic decision indicators for upward movement, downward movement, refinement, holding, and convergence.
- Added `groupEventsForDisplay`, a UI transformation that derives grouped market and redistribution summaries from raw simulation events.
- Added expandable grouped-event details using native disclosure controls so the underlying household-level events remain inspectable.
- Added tests for historical search-step snapshots, structured pricing actions, full-purchase grouping, all-failed grouping, mixed-market grouping, input immutability, and preservation of raw purchase events.

### Changed

- Replaced the dedicated Money Conservation chart with the Search Step chart. Money conservation remains enforced by runtime invariants and tests and remains visible in the Total Money headline metric as a satisfied invariant.
- Reworked the headline metric sequence to distinguish the last tested price and its realised profit from the next price selected for tomorrow's experiment. Day 0 now reports that no experiment has occurred.
- Renamed Price Discovery chart terminology from "posted price" to "tested price" where it refers to a completed market experiment.
- Replaced the permanently fixed upward decision arrow with a symbol selected from structured strategy metadata rather than human-readable text.
- Grouped repetitive household purchase, purchase-failure, and redistribution events in the visible ledger while leaving the simulation's granular raw event stream unchanged.
- Updated ledger, decision-indicator, and expandable-detail styling within the existing visual system.
- Updated architecture and validation documentation to describe search-step history and display-only event grouping.

### Validation

- `npm run test:run`: 14 tests passed across 2 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check`: passed.
- GitHub Pages build and deployment completed successfully for commit `480b148` (`Refine price discovery dashboard`).

## [MVP0-Initial_Build-001] - (2026-08-11)

### Summary

Built the first complete Econ-Engine MVP 0 as a deterministic, browser-based agent economic simulation and research dashboard, with a pure TypeScript simulation core, adaptive firm pricing, exact monetary accounting, automated validation, documentation, and static GitHub Pages deployment.

### Added

- Created the React, TypeScript, and Vite application with no backend, database, authentication, server-side simulation, or external economic-data dependency.
- Implemented the 12-agent MVP world: ten households, one firm, and one government.
- Implemented integer-cent monetary transfers, a fixed 10,000-cent money supply, deterministic household ordering, and the documented seven-phase daily lifecycle.
- Implemented household affordability purchases, unlimited exogenous zero-cost food, 100% firm-profit taxation, equal household redistribution, and deterministic remainder handling.
- Added a bounded adaptive hill-climbing pricing strategy with configurable starting price and step, high-price zero-sales recovery, step reduction after failed experiments, adjacent-cent testing, and convergence at the best realised price.
- Added typed simulation events for daily phases, purchases and failures, firm results and decisions, taxation, transfers, convergence, and day completion.
- Added bounded daily metrics and event histories, structured pricing explanations, and runtime invariant checks that fail on invalid accounting or state.
- Added Run, Pause, Step, and Reset controls; starting-price, initial-step, and speed configuration; headline metrics; four analytical charts; firm, government, and household inspection; and a recent-event ledger.
- Added Vitest coverage for accounting boundaries, taxation, redistribution, conservation, non-negative balances, determinism, normal convergence, high-price convergence, and adjacent-cent stopping behavior.
- Added the root README, formal MVP specification, architecture guide, validation guide, GitHub Pages workflow, and a project-specific Open Graph image.
- Preserved and renamed the governing design document as `SIMULATION_DESIGN_RULES.md`, with references from project documentation.

### Changed

- Connected the local project to `https://github.com/NeoLorenzo/Econ-Engine`, retained the repository's existing initial README commit through an unrelated-history merge, and established `main` as the tracked branch.
- Configured Vite with relative production assets for both local use and the `/Econ-Engine/` GitHub Pages path.
- Enabled GitHub Pages with GitHub Actions as the deployment source.

### Validation

- Initial `npm run test:run`: 9 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check`: passed before publication.
- Verified convergence to the 1,000-cent benchmark from both 200-cent and 2,000-cent starting prices.
- Verified the published GitHub Pages site returned HTTP `200 OK` with the expected page title.
