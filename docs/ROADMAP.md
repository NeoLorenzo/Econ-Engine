# Roadmap: civilization from strangers

This is a direction document, not a specification. It records the roadmap the owner set on 2026-10-23 for the Life core, and replaces the roadmap of 2026-10-19 from step 12 on. Each step still gets its own specification, which the owner approves before it is built; a specification may change, split or merge the steps below, and this document is updated when it does. The [simulation design rules](../SIMULATION_DESIGN_RULES.md) remain authoritative for how every step is built, and their [Life section](../SIMULATION_DESIGN_RULES.md#life-realism-and-time) holds the rules below.

## Goal

The Life core's goal is civilization emerging from strangers dropped on a generated landscape, watchable at any speed. Nothing above the individual is scripted: no leader, village, property, group or border exists in the code. Each appears, if it does, because people with bodies, needs, memories and relationships made it. The project has the scope of a god game, with real mechanisms underneath.

The previous roadmap's goal was a realistic life, built world first, with civilization watched for. The owner replaced it because the world was being made realistic for its own sake: slope formulas, per-second water accounting and individual bushes, none of which explains anything a person does, while the systems that make history, generations, relationships, surplus and power, had no step before step 22. Realism is kept, but only where it explains a mechanism.

## Realism rules

1. **A mechanism must explain something that happens.** Before adding anything, name the behaviour that is impossible without it. Evaporation explains nothing a person does; thirst explains where they walk. Heat balance explains nothing until clothing exists; cold nights that cost energy explain why people want huts and fire.
2. **Numbers need the right order of magnitude, not precision.** A walk of two kilometres takes about half an hour; it does not need a hiking function and a load equation. The [calibration document](CALIBRATION.md) records magnitudes and their sources, not formulas.
3. **Detail stops where decisions stop.** Model a thing to the resolution at which someone decides about it. Nobody decides anything about one hazel bush; they decide about a thicket. Nobody decides anything about a deer's hunger; they decide about a herd they saw yesterday. People are the only things modelled as individuals with full state.
4. **One declared compression, never many fudges.** When time is compressed, it is through the days-per-year setting and the anchoring rule below, written once. Nothing is shortened on its own.
5. **Realism serves emergence, not the other way round.** A realistic detail that makes the simulation harder to understand or slower without changing what emerges goes. An unrealistic simplification that makes something emerge which would not in life goes too, because the result would be a lie.
6. **Checked against patterns, not instruments.** Validation compares the simulation with known shapes of human life: group sizes, how often leaders change, how unequal camps get, population growth rates, how often settlements fail. Not litres of water a day.

## Time

- **One clock.** Time is counted in minutes from the start of the run. Every event, record and position has a minute. There is no second time system and no second rule set: the slowest playback and the fastest are the same simulation, differing only in how many minutes advance per frame.
- **Nothing runs every minute.** The engine keeps a queue of wake-ups ordered by minute, then phase, then person id. A person is woken only when their task ends, a body threshold arrives (computed once when the task starts, since needs fall at a known rate during a known task), something enters their perception (a mover entering a chunk wakes the people watching it), or someone addresses them. Between wake-ups a person has a task, a route and a start minute, from which their position and body at any minute follow. Nobody is stepped.
- **Each system declares its cadence.** Plant and fish stocks and relationship decay update daily; weather, when it exists, hourly or daily; bodies lazily. Conservation is checked at every event that moves a quantity; the full invariant set runs once a day.
- **Days per year is a run setting**, from 8 to 365. Every duration is classified once as **day-anchored**, fixed in hours and minutes (sleep, meals, thirst, walking, a day's work, firewood for a night, meat spoiling), or **year-anchored**, a fraction of the year (seasons, pregnancy, childhood, ageing, plant and tree growth, herd breeding, skill mastery), never below one day. Anything measured per year is divided by the setting. Each specification lists what turns strange at short years so that it is a known choice.
- **Speed is a pattern, not a benchmark.** A few hundred people run a year in about a second and a thousand in a few seconds, in plain TypeScript with typed-array state. Rust or WebAssembly is a later optimisation of the hot loop if profiling asks for it, never a plan.
- **The observer only interpolates between real states.** At any playback speed it asks the engine for positions at the displayed minute and interpolates walks along recorded routes; above a threshold speed it stops drawing individuals and shows the map state. The states are task records, not per-minute snapshots.

## Setting

The landscape, species and climate stay those of Mesolithic northern Europe, as generated since Life 10: young glacial relief, lakes in hollows, rivers that run downhill, berries, hazel, birch and pine, fish, and later red deer, boar and aurochs. The setting gives the physical numbers their magnitudes; it is not the goal, and the engine models no period. The world grows from a few kilometres across towards tens as the population needs it.

## The steps

Life 11 is the starting point. Steps 0 to 9 are recorded in the [merge document](MERGE.md#the-ladder), 10 and 11 in the changelog and the lab notes, and all of them in git history. The order is social first: the chief is the first milestone because it proves the social machinery, since influence concentrating in someone without a line of code saying "leader" means bodies, personality, relationships and violence are working together. Generations follow, because kinship is a relationship the social system already holds. Surplus and property come after, because hierarchy is what will seize them; storage nobody can command is what Life 9.6 found and nobody used. Milestones are in bold.

| Step | Adds | Checked against |
| --- | --- | --- |
| **12. Re-foundation** | The minute clock with wake-ups, places and routes over the existing terrain and water, thickets and stands instead of individual plants, days-per-year as a setting, the observer drawing from task records. About forty strangers instead of eight, keeping what Life 11's people can do: forage, fish, drink, gather wood, make axes, build huts, share a fire, exchange. | A year of forty people in about a second. The founders survive and settle at roughly the rate Life 11's eight do. |
| 13. Ground mesh | A walking mesh over the whole valley: triangles that follow every shore and slope, so people can walk any dry land, however narrow, and water is meshed for swimming and boats later. The terrain is drawn from the same low-poly triangles. | Walking routes against straight-line distance; the mesh's heights and shores against the terrain's within a metre. |
| 14. Bodies and personality | Height, weight and strength, drawn with their real correlations; strength matters for carrying and later for fights. Five traits, each with one job: extraversion starts interactions, agreeableness yields in disputes and shares more, conscientiousness finishes work and plans ahead, neuroticism sets the fear threshold, openness tries unfamiliar places and later unfamiliar recipes. A trait with no mechanism is cut. | Adult size and strength distributions; the known correlations between the five traits. |
| 15. Habitual routes | Each person remembers the ways they walk between places, takes them again, joins one when standing on it, and plans afresh only for somewhere new, coarsely by region first, then in detail; a known way is reconsidered at most once a day when new ground has been seen. The still landscape is looked over again only after moving. | How people choose routes: familiar rather than shortest. The step also restores speed lost to planning every walk from scratch. |
| 16. Relationships | Per pair, held in each person's memory: familiarity from time together, credit from help and food given, grievance from harm. Talking, sharing and helping from being in the same place. Slow decay. | The layered sizes of human social circles, about 5, 15 and 50; reciprocity patterns among foragers. |
| 17. Conflict | Disputes over a thicket, a bank, a hut, an axe. Fights decided by strength, health and who is nearby; injuries, yielding, fear, grudges. | Violence in forager societies: frequent disputes, rare deaths. |
| **18. Influence: the chief** | Each person's estimate of others' prestige, from skill seen and generosity received, and dominance, from fights seen won. Group decisions, where to camp and who gets the shared catch, weighted by it; following, so a camp moves as one. The observer measures concentration of say and labels a chief; the engine never does. | Forager leadership: informal, prestige-led, leaders change; a dominance route exists and is resisted. |
| 19. Generations | Pairing from relationships, pregnancy, children who must be fed and carried, growth, ageing, death. Kinship as a relationship type. | Forager fertility, birth spacing, child survival, near-zero growth. |
| 20. Seasons and stores | A yearly curve: day length, cold, fruiting seasons, good and bad years. Food that keeps (dried, smoked, nuts) and stores that spoil. The first possibility of surplus. | The seasonal diet of foragers; how often famine years come. |
| 21. Herds and hunting | Herds as units with size, range and yield, not individual animals. Group hunts where strength and cooperation count. Meat to share. | Hunting returns; who gets meat from a large kill. |
| 22. Planting | Seeds in the ground, fields, yield per day of labour. Nobody is told to farm; it happens where it beats foraging. | Early farming yields against foraging; how quickly people settle once they farm. |
| 23. Property | Claims on stores, fields and places, held in memory and respected or violated; inheritance through kinship. Inequality. | Inequality in early villages; how often early villages fail. |
| 24. Making and teaching | Recipes as data, skills learnt by watching and practice, knowledge that spreads along relationships and dies with people. | How forager children learn; how techniques spread and are lost. |
| 25. Several groups | A larger map and more founders; group identity from dense ties; between groups, exchange, marriage and raiding. | Band and village sizes; groups splitting and merging. |
| **26. Borders** | Territory a group claims and defends, palisades, war. | Settlement size distributions; how often early settlements fought. |

The previous roadmap's individual animals, predators as agents, heat balance, illness, fire-lighting and clothing are no longer steps. Each returns only if a later step needs it to explain something: clothing may return with cold at step 20, and injuries exist from step 17.

## What we watch for

Economic and political behaviour is recorded when it appears, not built towards:

- Sharing meat from a large kill, and who receives it.
- Trade, such as the swaps of wood and sales of axes Life 9 already allows, and whether new goods are traded.
- Specialisation: whether some members hunt, make tools or gather more than others.
- Claims on good places: a hazel thicket, a fishing spot, a camp.
- Storage for winter, and who controls a store.
- A village: people who stop moving because fields and stores hold them.
- A chief who takes part of the surplus.

Life 9's questions for later, on whether axe making concentrates with practice or talent and on its counterfactual switches, are kept here for the stable version.

## Run settings

A small set of values anyone can change at the start of a run, shown on the Life page before the first minute. The rest of the configuration stays in code as defaults.

- Seed.
- Days per year, 8 to 365.
- World size, in kilometres across.
- Founders: how many strangers are dropped, and whether they land scattered or together.

Playback speed is a control, not a setting, from one minute a second upward. Validation rejects anything outside range. Every setting is part of the run's fingerprint, so two runs with the same settings and seed match bit for bit.

The observer owns the labels. Group, chief, village and border are measurements the observer makes from state and shows; none is a word in the engine. The engine stays honest, and a label can change without touching a fingerprint.

## Open decisions

- **The default year.** Step 12 proposes 90 days. The trade is between history that runs quickly and seasons long enough to feel like seasons; 60 to 120 is the range to choose within.
- **How plants are represented at scale.** Step 12 replaces individual plants with one stock per thicket or stand. When woodland matters, the recommendation stands: keep stands individual where people use them and count them per cell elsewhere.
- **Generations and run length.** Runs now span generations by design. Whether the engine ever aggregates households for populations in the tens of thousands is left until a run reaches them.
- **The art.** Which of Life Engine's low-poly models are converted to glTF for the observer, as the merge document left open.
