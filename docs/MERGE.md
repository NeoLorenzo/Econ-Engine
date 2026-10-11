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
| Gathering, felling and multi-output conversion | Gathering materials and converting them, with exact conservation | 3 |
| Crafting blueprints with lossless delivery | Recipes that consume exact inputs and produce exact outputs, including tools that raise productivity | 3 |
| Thermal comfort, shade, campfires as heat sources | Cold raises energy use; fire and shelter reduce it, which gives crafting a purpose | 3 |
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
| 3. Materials and tools | A second resource, conversion, recipes, tools, fire and shelter against cold, skills that differ and improve with practice | Do specialization and exchange emerge from differences in skill? | Comparative advantage predicts specialization once exchange is possible. Exact conservation through every conversion. |
| 4. Storage and claims | Durable stores, and the first objects of the rules layer: claims on stores and patches, with sanctions | Does property appear, and who ends up enforcing it? | Claims expressed in the Crawford and Ostrom (1995) grammar from the vision. Counterfactuals with claims unavailable. |
| 5. Generations | Births, ageing, deaths from age, kin, inheritance | Do living standards return towards subsistence after a productivity gain? Does advantage persist across generations? | Malthusian dynamics, as named in the vision. |
| 6. A medium of exchange | Goods that differ in how well they keep and how widely they are wanted | Does one good become accepted by agents who do not want to use it? | Kiyotaki and Wright (1989). |

Beyond step 6, in the order questions demand them: claims on land with costs of exit (which makes Domar's hypothesis from the vision testable), groups and decision procedures, enforcement capacity, prices, wages, firms and government. These are the institutions MVP9 builds in. In the new core they have to be reached from below.

## Changes to the vision

The [vision](VISION.md) stands: primitives instead of institutions, the four layers, rules as data, observer-owned labels, collective authority, sources of change, politics and culture, and its validation targets. Two things change:

- **The incremental path.** The vision planned to move MVP8's built-in institutions into a rules layer one at a time, starting with the fiscal phase. That top-down path is replaced by the ladder above. The rules layer first appears at step 4, in an economy that has never had built-in institutions, instead of being fitted onto one that has.
- **The unit of time.** The vision asked when a simulated day stops being the right unit. The answer is now: from step 0, because bodies act within a day. The step 0 specification chooses the tick.

## Risks

- **Scope.** "A simulation of life" has no natural end. The defence is the ladder: no feature without a question it makes answerable.
- **Familiar results.** Sugarscape covered much of steps 0 to 2. The contribution has to be what Sugarscape lacked: exact accounting, a causal record of every change, information limited to what agents perceive and remember, and rules as data. Steps 0 and 1 are foundations; step 2 is the first that can produce a new finding.
- **Physiological detail.** Life Engine models drives in real units. Detail that changes no answer is cost without benefit, so physiology stays coarse until a question needs more.
- **Long runs.** From step 5, runs span generations at sub-day ticks. Performance and ledger size will need attention before then.
- **Two cores in one repository.** The MVP9 core must stay runnable but unchanged, and the observer must make clear which core a view shows.

## Open decisions

The [step 0 specification](LIFE0_SPEC.md) settled the tick (one hour), how decisions are made (priority rules for now), the new core's directory (`src/life/`) and the observer (a separate page, `life.html`). Still open:

- Whether and when the MVP9 core is eventually retired.
- Whether the project is renamed, for example to Life Engine, once the merged core is the main line of work.
- Which, if any, of Life Engine's low-poly art (trees, rocks, human models) is converted to glTF for the three.js world.

## Step 1: settled

The [step 1 specification](LIFE1_SPEC.md) settled step 1's open questions:

- **Who acts first:** a seeded shuffle of the band every hour, from its own stream.
- **Births:** none until step 5. Bands start above or below capacity and can only shrink.
- **Perception:** every patch within a radius, 2 tiles by default. Other foragers are not perceived or remembered yet.
- **Carrying capacity in theory:** `K = 24·n·r / D*`, together with a search capacity `Kₛ`, the number the land could feed if every forager searched all day.
- **One forager reproduces Life 0:** a band of one matches checksums recorded from Life 0's code.
- **The observer:** it follows one forager at a time and draws up to 100 without instancing.

The answer to the step's question is that a band does not settle at `K`: it collapses below `Kₛ`, because searching for food burns more than the land regrows. The [lab notes](../LAB_NOTES.md) record the open questions this leaves for step 2.

## References

- Epstein, J. M., and Axtell, R. (1996). *Growing Artificial Societies: Social Science from the Bottom Up*. MIT Press.
- Crawford, S. E. S., and Ostrom, E. (1995). A grammar of institutions. *American Political Science Review*, 89(3), 582–600.
- Graeber, D. (2011). *Debt: The First 5,000 Years*. Melville House.
- Humphrey, C. (1985). Barter and economic disintegration. *Man*, 20(1), 48–72.
- Kaplan, H., and Hill, K. (1985). Food sharing among Ache foragers: Tests of explanatory hypotheses. *Current Anthropology*, 26(2), 223–246.
- Kiyotaki, N., and Wright, R. (1989). On money as a medium of exchange. *Journal of Political Economy*, 97(4), 927–954.
- Winterhalder, B. (1986). Diet choice, risk, and food sharing in a stochastic environment. *Journal of Anthropological Archaeology*, 5(4), 369–392.
