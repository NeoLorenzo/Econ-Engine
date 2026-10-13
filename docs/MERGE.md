# Merge: Life Engine into Econ-Engine

This is a direction document, not a specification. Nothing in it is implemented. It records a decision the owner made on 2026-10-10 and the plan that follows from it. The current MVP specifications remain authoritative for what the engine does, and the [simulation design rules](../SIMULATION_DESIGN_RULES.md) remain authoritative for how it must be built. It extends the [vision document](VISION.md) and replaces that document's incremental path.

## Decision

1. **Life Engine merges into Econ-Engine.** [Life Engine 3D](https://github.com/NeoLorenzo/Life-Engine-3D) is a Unity project in which human agents with bodily needs, perception and memory gather resources and craft tools. Econ-Engine is a deterministic economic simulation with exact accounting. The owner's goal is one simulation of life in which economics, the management of scarcity, is one part. The two projects are working on two halves of it.
2. **Econ-Engine is the home, and the platform stays TypeScript and three.js in the browser.** Life Engine is frozen as a design reference. Its ideas are ported, not its code.
3. **Development goes bottom-up.** A new simulation core starts from the simplest economy there is and adds complexity one validated step at a time. The current engine (MVP9) stays in the repository, frozen and runnable, as a reference.

## Why merge

The two projects are complementary:

| | Life Engine | Econ-Engine |
| --- | --- | --- |
| Unit of agency | An individual with a body | A household with a budget |
| Strength | Physiology, perception, memory, gathering, crafting, day and night | Determinism, exact conservation, causal ledger, bounded information, multi-seed experiments |
| Missing | Reproducibility, headless runs, economic interaction between agents | Bodies, a physical environment, anything before money and markets |

Life Engine supplies the individual that a basic economy needs. Econ-Engine supplies the discipline that turns a simulation into research. Life Engine's perception and memory are also a natural way to enforce design rule 1: an agent knows only what it has seen or remembers.

## Why the browser

The deciding question was not rendering speed but where the simulation lives.

- **Life Engine's simulation is inside the renderer.** Agents decide every frame in `Update()`, move with Rigidbody physics and NavMesh, perceive with raycasts, and draw from unseeded `UnityEngine.Random`. A run cannot be replayed exactly, run headless, run faster than the frame loop allows, or repeated across seeds. Those are prerequisites for every research question in the vision.
- **Econ-Engine already separates the simulation from the view.** The core in `src/sim` is pure TypeScript; the 3D town only displays it. The merged project needs that separation on any platform.
- **Speed is not the bottleneck.** Unity's engine core is C++, but project code is C#. Neither is meaningfully faster than JIT-compiled TypeScript for agents with simple decision rules. Typed arrays and Web Workers handle thousands to tens of thousands of agents, and three.js instancing draws them. WebAssembly and WebGPU compute remain available if scale ever demands them.
- **All code is written by Claude Code, which works far better in this stack.** `npm run agent:check` validates the whole project headless in seconds, and the app can be opened and inspected in a browser. Much of a Unity project lives in the editor, as scenes and prefabs stored as YAML with internal IDs, and batch-mode runs are slow and fragile. Life Engine's root folder holds about ten leftover validation logs from that struggle.

What the browser gives up is Unity's built-in character animation, physics, NavMesh, terrain tools and asset pipeline. A research simulation mostly does not need them: agents move on a grid inside the simulation, and the view only has to show it. Where they are wanted, glTF animated models and the Rapier physics engine are the web equivalents.

## The starting point

The vision asks the engine to start "from a very basic economy". The earliest economy in human history is the best guide to what that means, not because the engine models a period, but because it is the economy with the fewest institutions. Econ-Engine has no target era. It models agents managing scarcity, and those agents could live at any time.

That economy was a small band of foragers:

- **Scarcity is physical.** Bodies need energy; food grows in patches that deplete and regrow; yields vary.
- **Time is the budget.** Foraging, travelling, resting and sleeping compete for the same hours.
- **Food spoils.** A surplus cannot be saved, but it can be given away in exchange for a later claim. This is the leading explanation of why foragers shared widely.
- **There is no money, no prices, no firms, no government** and little private property.
- **Exchange was gift and reciprocity, not barter.** The textbook story that barter came first and money second has little evidence behind it (Humphrey, 1985; Graeber, 2011). The engine must not build barter in either. Agents should be able to keep, give or swap, and whichever pays should prevail.

The engine's agent becomes an individual with a body, a location, perception and memory, instead of a household with a budget. Households, if they appear, are groups of individuals.

## What carries over from Econ-Engine

| Kept | Notes |
| --- | --- |
| The [simulation design rules](../SIMULATION_DESIGN_RULES.md) | All of them, unchanged. They are what keeps a simulation of life from becoming a game. |
| Seeded random streams | The pure functions in `src/sim/rng.ts`, with one derived stream per purpose, as the spatial seed is today. |
| Exact conservation | Integer cents become integer quantities of goods. Food is counted in whole kilocalories, so every tick satisfies an exact balance: produced = eaten + carried + stored + spoiled. |
| Invariants and the event ledger | Every change has a cause and a record. |
| Experiments and ensembles | `src/sim/ensemble.ts` and the experiment worker, generalized to the new core's metrics. |
| The observer | The world-first React shell and the three.js world (`src/ui/world`), with the simulation stepped independently of rendering. |
| Project conventions | A specification per step, the changelog, the lab notes and `npm run agent:check`. |

Firms, posted-price markets, employment and payroll, Government and fiscal transfers, money and plots are not used by the new core's early steps. They stay in `src/sim` as the MVP9 reference. A long-term test of the whole approach is whether the bottom-up core can grow something comparable to them without being given them.

## What comes from Life Engine

| Life Engine system | In the merged engine | First step |
| --- | --- | --- |
| Hunger (ghrelin in pg/mL) and sleep pressure (adenosine in nM) | An energy reserve in kilocalories. Sleep follows the night; a fatigue level is added when a question needs it. Hormone units are dropped until a question needs them (design rule 27). | 0 |
| Day and night cycle, diurnal temperature curve | Simulated time of day, with light and temperature as functions of it | 0 |
| Priority behaviour tree | Priority-ordered needs, with the reason for each action recorded in the ledger | 0 |
| Perception: 15 m radius, 200° view, occlusion | A perception radius on the grid. Field of view and occlusion only if a question needs them. | 1 |
| Memory: threat positions that expire | Memory of food patches, other agents and past exchanges, with forgetting | 1 |
| Gathering, felling and multi-output conversion | Gathering materials and converting them, with exact conservation | 3 (gathering), 4 (conversion) |
| Crafting blueprints with lossless delivery | Recipes that consume exact inputs and produce exact outputs, including tools that raise productivity | 4 |
| Thermal comfort, shade, campfires as heat sources | Cold raises energy use; fire and shelter reduce it, which gives crafting a purpose | 3 (cold and fire), 4 (shelter) |
| Rigidbody steering, NavMesh, raycasts, camera modes, Unity asset pipeline | Left behind. Movement is a simulation of distance on the grid, and the view interpolates it. | — |

## Architecture of the new core

- **A new core beside the old.** The bottom-up engine gets its own directory under `src/` with its own state, step function, invariants and tests. It shares the RNG, ensemble and observer infrastructure. The MVP9 core is not modified.
- **Discrete ticks.** Time advances in fixed ticks, never per frame. Bodily needs, sleep, and day and night all act within a day, so the tick is shorter than Econ-Engine's day. An hour is the expected default; the step 0 specification settles it.
- **A grid landscape.** Space is a grid of tiles, as in MVP9, carrying resources rather than plots. Movement costs time and energy in proportion to distance.
- **Information through perception.** An agent's decisions read only its own state, what it currently perceives, and what it remembers. True state and agent knowledge stay separate (design rule 1).
- **Death is physics.** An agent whose energy reaches zero dies. That is the first real consequence of scarcity in the engine.

## The ladder

Each step adds one thing, answers one question that could come out either way, and is validated before the next begins (design rule 12). Each will get its own specification.

| Step | Adds | Question | Validation |
| --- | --- | --- | --- |
| 0. One forager | One agent, one food that regrows on patches, an energy reserve, day and night; actions: forage, eat, rest, sleep, move | Does a bounded agent keep itself alive, and does it stop working once its needs are met? | Exact energy conservation every tick. Analytical survival thresholds: the agent survives above the patch's sustainable yield and dies below it. |
| 1. A band | Many agents on one landscape, perception and memory of patches | Does the population settle at the land's carrying capacity, and how does competition for patches spread wellbeing? | Deaths and steady-state population against the analytical carrying capacity; Sugarscape (Epstein and Axtell, 1996) as a reference. |
| 2. Sharing | Variable yields, spoilage, the ability to give food, and memory of who gave | When does sharing emerge, and when does hoarding? | Theory predicts more sharing where yields are variable and food perishable (Kaplan and Hill, 1985; Winterhalder, 1986). Ensembles vary each factor alone, with a giving-disabled counterfactual. |
| 3. Wood and skill | A second resource, wood, burned against cold nights; skills that differ; swapping one good for another | Do specialization and exchange emerge from differences in skill? | Comparative advantage predicts specialization once exchange is possible. Exact conservation of wood. A counterfactual with swapping off. |
| 4. Practice | Skills that grow with practice and fade without it | Does practice alone make identical foragers specialize? | Learning by doing (Smith, 1776; Rosen, 1983). Life 3 reproduced with practice off. |
| 5. Real scale | Minutes and centimetres in a small valley: individual bushes and trees, walking real distances, firewood carried home in loads | Do Life 3's and Life 4's findings survive real scale: does exchange start, and does practice still divide a band born equal? | Exact conservation every minute. Life 4's experiments repeated beside the hourly core on the same seeds. A theorem that loads too small leave no surplus to trade. |
| 6. Groups | Foragers who start scattered, know only what they have seen, explore, and want company; groups that form when they meet, with a flag at home, and swap only within themselves | Does wanting company gather a scattered band into one group or several, and do separate groups weaken exchange and the division of work? | Life 5 reproduced exactly with the changes switched off. Counterfactuals with the band as one group from the start, and with no groups. |
| 7. Sight and loads | Long sight across open ground and close sight for what plants hold; memory of the sites and ground already seen, with idle foragers checking sites instead of sweeping ground; loads that slow walking, and full loads taken home | When foragers see as far as people do and check what they know instead of sweeping it, do they walk less, and does seeing everyone from the first morning gather the band into one group or split it into more? Does making loads heavy to carry change how the band works and trades? | Life 6 reproduced exactly with the changes switched off. Counterfactuals with each change off, and sight varied. |
| 8. A shared fire | A campfire at a group's flag, fed with wood and able to go out | Who feeds a fire that warms everyone at it? | Exact conservation of wood through the shared fire. |
| 9. Tools and shelter | Recipes that convert materials into tools that raise productivity, and shelter | Do tools concentrate in the hands of those who make them, and does making them become a trade? | Exact conservation through every conversion. |
| 10. Storage and claims | Durable stores, and the first objects of the rules layer: claims on stores and patches, with sanctions | Does property appear, and who ends up enforcing it? | Claims expressed in the Crawford and Ostrom (1995) grammar from the vision. Counterfactuals with claims unavailable. |
| 11. Generations | Births, ageing, deaths from age, kin, inheritance | Do living standards return towards subsistence after a productivity gain? Does advantage persist across generations? | Malthusian dynamics, as named in the vision. |
| 12. A medium of exchange | Goods that differ in how well they keep and how widely they are wanted | Does one good become accepted by agents who do not want to use it? | Kiyotaki and Wright (1989). |

Step 3's original row bundled a second resource, conversion, recipes, tools, fire and shelter, and skills that differ and improve with practice. On 2026-10-11 the owner split it in two, following design rule 12: wood and skill first, then tools and practice. Later steps moved down by one. On 2026-10-12 the owner split tools and practice in two the same way: practice first, because the ladder's question for it was about practice alone, then tools and shelter. Later steps moved down by one again. Later on 2026-10-12 the owner asked to see people work at real size rather than on 1.5 km tiles, and chose to make it a step of its own: "Real scale" became step 5, tools and shelter step 6, and later steps moved down by one again. On 2026-10-13 the owner found Life 5's camp unexplained: nothing said why the band lived together. "Groups" became step 6 and "A shared fire", a campfire at a group's flag fed with wood, step 7. Tools and shelter became step 8, and later steps moved down by two. Later on 2026-10-13 the owner found Life 6's foragers short-sighted and their exploring mechanical, and asked that loads cost something to carry. "Sight and loads" became step 7, the shared fire step 8, and later steps moved down by one. The questions of step 8 and later are provisional until their specifications are written.

Beyond step 12, in the order questions demand them: claims on land with costs of exit (which makes Domar's hypothesis from the vision testable), decision procedures within groups, enforcement capacity, prices, wages, firms and government. These are the institutions MVP9 builds in. In the new core they have to be reached from below.

## Changes to the vision

The [vision](VISION.md) stands: primitives instead of institutions, the four layers, rules as data, observer-owned labels, collective authority, sources of change, politics and culture, and its validation targets. Two things change:

- **The incremental path.** The vision planned to move MVP8's built-in institutions into a rules layer one at a time, starting with the fiscal phase. That top-down path is replaced by the ladder above. The rules layer first appears at step 10, in an economy that has never had built-in institutions, instead of being fitted onto one that has.
- **The unit of time.** The vision asked when a simulated day stops being the right unit. The answer is now: from step 0, because bodies act within a day. The step 0 specification chooses the tick.

## Risks

- **Scope.** "A simulation of life" has no natural end. The defence is the ladder: no feature without a question it makes answerable.
- **Familiar results.** Sugarscape covered much of steps 0 to 2. The contribution has to be what Sugarscape lacked: exact accounting, a causal record of every change, information limited to what agents perceive and remember, and rules as data. Steps 0 and 1 are foundations; step 2 is the first that can produce a new finding.
- **Physiological detail.** Life Engine models drives in real units. Detail that changes no answer is cost without benefit, so physiology stays coarse until a question needs more.
- **Long runs.** From step 11, runs span generations at sub-day ticks. From step 5 the tick is a minute, so a run of 400 days is already 576,000 ticks. Performance and ledger size will need attention before then.
- **Two cores in one repository.** The MVP9 core must stay runnable but unchanged, and the observer must make clear which core a view shows.

## Open decisions

The [step 0 specification](LIFE0_SPEC.md) settled the tick (one hour), how decisions are made (priority rules for now), the new core's directory (`src/life/`) and the observer (a separate page, `life.html`). Still open:

- Whether and when the MVP9 core is eventually retired.
- Whether the project is renamed, for example to Life Engine, once the merged core is the main line of work.
- Which, if any, of Life Engine's low-poly art (trees, rocks, human models) is converted to glTF for the three.js world.

## Step 1: settled

The [step 1 specification](LIFE1_SPEC.md) settled step 1's open questions:

- **Who acts first:** a seeded shuffle of the band every hour, from its own stream.
- **Births:** none until step 5 (now step 11). Bands start above or below capacity and can only shrink.
- **Perception:** every patch within a radius, 2 tiles by default. Other foragers are not perceived or remembered yet.
- **Carrying capacity in theory:** `K = 24·n·r / D*`, together with a search capacity `Kₛ`, the number the land could feed if every forager searched all day.
- **One forager reproduces Life 0:** a band of one matches checksums recorded from Life 0's code.
- **The observer:** it follows one forager at a time and draws up to 100 without instancing.

The answer to the step's question is that a band does not settle at `K`: it collapses below `Kₛ`, because searching for food burns more than the land regrows. The [lab notes](../LAB_NOTES.md) record the open questions this leaves for step 2.

## Step 2: settled

The [step 2 specification](LIFE2_SPEC.md) settled step 2's design. A prototype showed that the ladder's row needed two things it did not name:

- **A meeting place.** Foragers that wander alone almost never share a tile, so they can rarely give. The band now sleeps at a camp in the middle of the land, where everyone meets each night.
- **Windfalls larger than a body.** A forager's reserve holds up to 20,000 kcal, so ordinary harvests are simply eaten. Variable yields are windfalls: an hour of foraging succeeds with probability `forageKcalPerHour / harvestKcal` and then takes `harvestKcal`, so the average is unchanged.

Its other choices:

- **Who gives:** three fixed strategies compete, keepers, sharers and reciprocators. Whether a strategy that pays spreads needs births and inheritance, so it waits for step 5 (now step 11).
- **Memory of who gave:** every forager keeps a ledger of what it gave to and received from every other.
- **Patch choice:** Life 1's fullest-first rule, limited to patches a forager can reach and return from before dark. Nearest-first crowded the patches around camp and starved even a band with steady harvests.
- **One step, not two:** the run with giving switched off, a band of keepers, is the counterfactual.

The answer to the step's question is that windfalls are deadly and sharing keeps more of a band alive, increasingly so as windfalls grow, though only a few percent of food changes hands. Perishability matters less than theory suggests, because the body is the main store. Within a mixed band no strategy clearly pays: keepers free-ride, but a sharer gives only what its body cannot hold, so sharing costs it almost nothing. The [lab notes](../LAB_NOTES.md) record the open questions this leaves.

## Step 3: settled

The [step 3 specification](LIFE3_SPEC.md) settled step 3's design. The owner split the ladder's row and chose to add swaps beside Life 2's food gifts. A prototype showed what else the step needed:

- **Telling terms.** With steady harvests no forager carries spare food, so no swap can start. Two foragers at camp who could both gain tell each other the terms, and remember the last terms they heard for a day.
- **Unsold stock stops production.** A hungry forager that once heard good terms kept gathering wood nobody bought, and starved. A forager now gathers wood to sell only once its spare wood has all been sold.
- **A smaller band.** Cold nights and trips for wood mean Life 2's land carries a band of 8, not 12.

Its other choices: each forager burns wood at its own hearth, so wood is not a public good; skills are drawn for each forager and fixed; a forager knows its own skills; and two foragers swap at the midpoint of what wood costs each of them in working time, after Sugarscape's trade rule.

The answer to the step's question is that specialization follows comparative advantage once exchange is possible, and keeps more of the least skilled alive, but exchange has to be started by talk: without it, and with steady harvests, no swap ever happens. Terms never settle on one rate. The [lab notes](../LAB_NOTES.md) record the open questions this leaves.

## Step 4: settled

The [step 4 specification](LIFE4_SPEC.md) settled step 4's design. The owner split the ladder's row and chose practice alone for this step. A prototype showed that practice alone does not divide work, that practice with exchange does, and that how long skill is remembered decides how long roles last.

Its choices:

- **How skill follows work:** a forager's practice at a task is its hours at it over its last 30 days, giving a percentage from 50% with no hours towards 150%, 100% at two hours a day.
- **Born skill stays:** a rate is the base rate times born skill times practice, so Life 3's band of unequals can be compared with a band born equal.
- **The canonical band is born equal,** and starts at exactly Life 3's equal rates.
- **No foresight:** a forager knows its rates for the day, not that practice will change them.

The answer to the step's question is that practice alone does not make identical foragers specialize, but practice with exchange does, in every band: one or two become wood gatherers and the rest buy from them, from differences that luck in the turn order opens. Roles are spells rather than castes; they last as long as skill is remembered. With born differences, practice keeps specialization aligned with born advantage and widens it. The [lab notes](../LAB_NOTES.md) record the open questions this leaves.

## Step 5: settled

The [step 5 specification](LIFE5_SPEC.md) settled step 5's design. The owner asked to watch people forage and gather at real size, like a strategy game that can be paused and sped up but not controlled, and chose a small, dense valley over realistic sparse land. Its choices:

- **A new core.** The valley core in `src/valley/` works in one-minute ticks and whole centimetres, with 1,920 bushes and 64 trees that together grow what Life 4's land grew. The hourly core in `src/life/` is frozen as a reference, and its observer moves to `life4.html`. This replaces the grid of tiles in the [architecture](#architecture-of-the-new-core) above.
- **Seconds within a minute.** A forager may walk to the next bush and pick it in the same minute, and hourly rates are paid second by second with exact remainders.
- **Deadwood, not felling.** Foragers gather dead branches under standing trees; felling waits for the axes of the next step.
- **Loads.** A prototype showed that at real scale nobody ever has wood to spare, so exchange never starts. Foragers now bring firewood home in loads of 30 kg, a common headload, and the load's size is an experiment.

The answer to the step's question is that Life 4's finding survives, weakened. Exchange needs a surplus, which at real scale only loads provide, and loads larger than what a forager keeps do not always provide one: identical routines can keep every forager's surplus and every forager's need apart. With 30 kg loads every band born equal divides its work, but the first swap comes around day 140 rather than day 15, and the top two gatherers bring in about a third of the wood rather than half. Walking costs minutes instead of hours, so the valley feeds a band of 12 that Life 4's land could not. The [lab notes](../LAB_NOTES.md) record the open questions this leaves.

## Step 6: settled

The [step 6 specification](LIFE6_SPEC.md) settled step 6's design. The owner set its rules: foragers start scattered and know only what they have seen, explore once their needs are met, and want company below hunger and warmth and above resting; two without a group who meet found one and plant a flag where they sleep; one that meets a member joins; members never change group and swap only with each other; each keeps its own hearth. A prototype showed that a hungry forager must search ground it has never seen before revisiting plants it found bare, or foragers that know little starve circling a few thickets. Its other choices:

- **Meeting:** within talking distance, 20 m, at the end of the turn of a forager without a group, at any hour, with the nearest forager.
- **The flag and hearths:** the flag at the founders' midpoint, and members' hearths on Life 5's spiral around it, 3 m apart in order of joining, leaving the flag's point for the shared fire, now step 8.
- **The last member:** a group left with one living member dissolves; the survivor keeps its hearth and seeks company again.
- **Places:** the valley is cut into 400 places 30 m wide, and a forager explores the nearest place it has not seen for a day.
- **Life 5 as a special case:** four switches turn the changes off, and with all four off the valley runs exactly as Life 5. The camp's clearing stays as a meadow, so plants stand where Life 5 put them.
- **Only the current life is visible:** the Life 4 page and its view-only code are removed; the hourly core and its tests stay.

The answer to the step's question is that a scattered band forms groups within its first day but usually splits, into two groups in most runs, because whoever has company stops looking. Splitting weakens exchange and the division of work, the more so the more groups: members of scattered groups buy 12.4% of the wood they burn against 18.5% in a band that starts as one group. Exploring costs about two and a half hours of walking a day, which a band of 8 or 12 can pay but a band of 16 cannot. The [lab notes](../LAB_NOTES.md) record the open questions this leaves.

## Step 7: settled

The [step 7 specification](LIFE7_SPEC.md) settled step 7's design. The owner found Life 6's foragers short-sighted and their exploring mechanical, and asked that loads slow a walker and cost more per step. They chose to take sight and carrying together, plain long sight with nothing blocking the view, and a more realistic memory later. Its choices:

- **Two kinds of sight:** long sight, 1 km by day and across the whole valley, for where thickets, stands, people and flags are; close sight, 25 m as before, for what a plant holds, and all a forager sees at night.
- **Sites, not squares:** a forager remembers the thickets and stands it has spotted and when it last checked each up close; ground once seen stays seen. Idle, it explores unseen ground, then checks the nearest site it has not checked for a day; searching for food or wood, it goes to the nearest site of that kind it has never checked. A random preference among sites was tried and not needed.
- **Carrying:** a load of trip wood and berries slows a walker to `walkCmPerSecond · 60 / (60 + load)`, 3.0 km/h with 30 kg, while each second of walking costs what it did, after Pandolf's equation; and a forager that is not hungry takes a full load home before anything else.
- **Life 6 as a special case:** three switches and the length of sight turn the changes off, and with them off the valley runs exactly as Life 6.
- **The observer:** a sash that wraps from shoulder to hip; each base marked by a disc of its group's colour and a lettered badge visible at any zoom; groups to select, with their members ringed, listed in a card and framed by the camera.

The answer to the step's question is that foragers who see far and check what they know walk less than half as much, 1.1 hours a day against 2.6, so the valley keeps 5.8 of a band of 16 alive against 2.4. Seeing everyone at first light splits the band into more groups, not fewer: a band of 8 never forms one group, against one in 6 runs of 32 in Life 6, and trades less (9.4% of wood bought against 12.4%). Carrying costs little over the valley's short distances, but taking a full load straight home decides whether small loads start exchange: with 20 kg loads every run swaps with the rule, and 5 in 32 without. The [lab notes](../LAB_NOTES.md) record the open questions this leaves.

## References

- Epstein, J. M., and Axtell, R. (1996). *Growing Artificial Societies: Social Science from the Bottom Up*. MIT Press.
- Crawford, S. E. S., and Ostrom, E. (1995). A grammar of institutions. *American Political Science Review*, 89(3), 582–600.
- Graeber, D. (2011). *Debt: The First 5,000 Years*. Melville House.
- Humphrey, C. (1985). Barter and economic disintegration. *Man*, 20(1), 48–72.
- Kaplan, H., and Hill, K. (1985). Food sharing among Ache foragers: Tests of explanatory hypotheses. *Current Anthropology*, 26(2), 223–246.
- Kiyotaki, N., and Wright, R. (1989). On money as a medium of exchange. *Journal of Political Economy*, 97(4), 927–954.
- Ricardo, D. (1817). *On the Principles of Political Economy and Taxation*. John Murray.
- Rosen, S. (1983). Specialization and human capital. *Journal of Labor Economics*, 1(1), 43–49.
- Smith, A. (1776). *An Inquiry into the Nature and Causes of the Wealth of Nations*. W. Strahan and T. Cadell.
- Winterhalder, B. (1986). Diet choice, risk, and food sharing in a stochastic environment. *Journal of Anthropological Archaeology*, 5(4), 369–392.
