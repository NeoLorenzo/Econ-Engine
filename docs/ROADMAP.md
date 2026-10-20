# Roadmap: a realistic life

This is a direction document, not a specification. It records the roadmap the owner set on 2026-10-19 for the Life core, and replaces the ladder in the [merge document](MERGE.md#the-ladder) from step 10 on. Each step still gets its own specification, which the owner approves before it is built; a specification may change, split or merge the steps below, and this document is updated when it does. The [simulation design rules](../SIMULATION_DESIGN_RULES.md) remain authoritative for how every step is built.

## Goal

The Life core's goal is to model a realistic life. Economic institutions are not built towards: property, trade, specialisation and money are expected to grow out of realism, if they grow at all, and are watched for rather than designed in (see [What we watch for](#what-we-watch-for)).

The old ladder asked an economic question at each step. Its next steps were storage and claims, generations, and a medium of exchange. The owner dropped them because each added an institution before the life beneath it was realistic: the valley had no seasons to store against, no animals to hunt, and no children to inherit.

## Setting

- **Place and time.** Mesolithic northern Europe, as in Life 9.6: the glacial landscape of southern Scandinavia and the North European Plain, around 9,000 to 6,000 years ago. Every species, climate figure and physical number comes from that setting, with its source and trust recorded in the [calibration document](CALIBRATION.md).
- **Size.** The world grows from the 800 m valley of Life 9.7 into a generated landscape a few to tens of kilometres across.
- **Life in it.** Plants, animals and people. Every animal is an individual agent, with a body, needs, senses and memory, as the foragers are.
- **Length of a run.** Several years: long enough for seasons to repeat, herds to rise and fall, and a lake or a wood to be used up and recover. Whole generations are left for later.

## Principles

- **The world comes first.** The steps build the world in layers, from the ground up, and each layer lives with or without people. The foragers of Life 9.7 keep living by their rules while the world is built around them, and each layer reaches them on its own: winter is cold and has no berries whether or not their rules know it.
- **Checked against the real world.** A specification opens with what the step makes realistic and the real measurements it is checked against, in place of the old step's economic question. Validation compares the simulation with those measurements.
- **The design rules hold.** Determinism, integer quantities, invariants checked every tick, one named stream for every random draw, and agents, animals included, that know only what they have perceived or remember.
- **Features before experiments.** The Life core stays in its feature-building phase: experiments wait for a later, stable version, and each specification lists its questions for later.
- **Speed is a feature.** A run of five years is about 2.6 million minutes, over a large landscape with many animals. Speed arrives with the larger land in step 10, and every later step must keep a year's run fast.

## The steps

Life 9.7 is the starting point. Steps 0 to 9 are recorded in the [merge document](MERGE.md#the-ladder), git history, the changelog and the lab notes. On 2026-10-19 the owner merged the first two steps, scale and terrain, into one, step 10, so that the land grows and gains its relief together; the later steps moved up by one.

### The world

| Step | Adds | Checked against |
| --- | --- | --- |
| 10. Terrain and scale | A generated landscape a few kilometres across, shaped as one glacial assemblage: broken moraine fronts, flow-aligned drumlins, kames, clustered dead-ice hummocks and kettles, tunnel valleys and quiet till plain, within one grassland of grass, exposed dirt and stone. Slopes cost energy and slow walking; relief blocks sight. The land is held in chunks so that each agent looks only at what is near it, and the minute is made faster to match. Settles how plants are represented across a large landscape (see [Open decisions](#open-decisions)). | The relief and organization of young moraine landscapes in southern Scandinavia and northern Germany, with later quantitative comparison to official Danish DHM/Terræn. Walking speed on slopes by Tobler's hiking function, and its cost by the Pandolf equation with its grade term and terrain factors. A year of the larger land runs in minutes. |
| 11. Water | Rivers that run downhill and lakes in hollows, in place of the lake on the valley's edge, with fish in both. Thirst: every body needs to drink. | River and lake sizes in that landscape. Human daily water needs. |
| 12. Seasons and weather | Day length by latitude; temperature through the year and the day; rain, snow and frost. Plants fruit in their seasons, bilberries in late summer and hazelnuts in autumn, so food must last the winter. | Climate reconstructions for the Mesolithic. Fruiting calendars. |
| 13. Vegetation | Woodland that grows where ground, water and climate allow: birch, pine, hazel, oak, lime, and alder by water. Clearings, regrowth and seeds that spread. | Pollen records of Mesolithic woodland. Growth and regrowth rates. |
| 14. Plant-eaters | Red deer, roe deer, wild boar, elk and aurochs, each an agent with a body, hunger, thirst, senses and memory, living in herds, breeding in their season and dying. Boar compete with people for hazelnuts. | Population densities, herd sizes, home ranges and breeding calendars. |
| 15. Predators | Wolf packs, brown bears and lynx, which hunt the plant-eaters and hold territories. People perceive danger and flee, as in Life Engine. | Predator densities, pack sizes and kill rates. |
| 16. People in the living world | People hunt and fish in that world, butcher what they kill, keep its meat, which spoils, and its hides, and run from predators. Brings the spear and the bow ahead of the general recipes of step 19. | Mesolithic hunting returns, and diets from bones and isotopes. |

### The body

| Step | Adds | Checked against |
| --- | --- | --- |
| 17. Heat and tiredness | The temperature of the body by day as well as by night: hot and cold, shade, wind and wet, as in Life Engine's thermal comfort. Sleep driven by tiredness instead of the clock, with naps and the short nights of summer. | Human heat balance; sleep research. |
| 18. Health | Injuries from falls and animals, and wounds that heal or fester. Illness from bad water or spoiled meat. Fitness that rises and falls with food and rest. | Healing times and illness rates; Mesolithic skeletons. |

### Making things

| Step | Adds | Checked against |
| --- | --- | --- |
| 19. Materials and recipes | Recipes as data, in place of the two built into Life 9. Materials broken down, as in Life Engine's conversions: flint knapped into blades, wood split, hides scraped, bark and sinew made into cord. A kit of tools. | Experimental archaeology: times and yields of knapping, scraping and cord-making. |
| 20. Fire and cooking | Fires lit, not only fed. Cooking, which gives more energy from food. Roasting nuts, and smoking and drying meat and fish, so food keeps through winter. | The energy gain from cooking; how long preserved food keeps. |
| 21. Clothing and shelter | Hide clothing that changes how cold a body gets; better and seasonal shelters; stores and pits for food. | The insulation of hide and fur; Mesolithic dwellings. |

### People together

| Step | Adds | Checked against |
| --- | --- | --- |
| 22. Families | Pairing, pregnancy and birth, and children who must be fed and carried until they can forage. | Forager birth spacing, child growth and child survival. |
| 23. Ageing and death | Bodies that age and weaken, and death from old age; children growing up within a run. | Forager life tables. |
| 24. Learning from others | Teaching and copying skills, and telling others where food and danger are. | Studies of how forager children learn. |
| 25. Moving through the year | Bands that move camp with the seasons, and several bands in one landscape that meet. | Mesolithic seasonal rounds. |

The order follows what each area needs. The world gives the body its cold, water, food and danger; a realistic body gives making things its purpose, since cold calls for clothing and winter for food that keeps; and families need fed, healthy, sheltered adults to raise children through a winter. Thirst arrives with water at step 11, not with the body, because water means something only once someone must drink it.

## What we watch for

Economic behaviour may emerge on its own from a realistic life. It is recorded when it appears, not built towards:

- Sharing meat from a large kill, and who receives it.
- Trade, such as the swaps of wood and sales of axes Life 9 already allows, and whether new goods are traded.
- Specialisation: whether some members hunt, make tools or gather more than others.
- Claims on good places: a hazel thicket, a fishing spot, a camp.
- Storage for winter, and who controls a store.

Life 9's questions for later, on whether axe making concentrates with practice or talent and on its counterfactual switches, are kept here for the stable version.

## Open decisions

- **How plants are represented.** A landscape tens of kilometres across holds millions of trees, too many to simulate one by one. Step 10 settles it for now: its land holds about 85,000 plants, few enough to keep every one individual. When vegetation arrives at step 13 and woodland covers the land, the recommendation is to keep plants individual where people or animals use them and count them in stands elsewhere.
- **Generations.** Runs of several years show children born and growing, but not generations. Whether runs grow longer is left for after step 25.
- **The art.** Which of Life Engine's low-poly models, of trees, rocks, people and now animals, are converted to glTF for the observer, as the merge document left open.
