# [LIFE18-Seasons-076]

**Approved by the owner on 2026-11-03.** This specification replaces the Life 17 specification and describes the whole simulation. It is step 18 of the [roadmap](ROADMAP.md), seasons and stores, which the owner moved ahead of the chief and generations on 2026-11-02, after deferring conflict until the valley knows scarcity. It is built under the [Life section](../SIMULATION_DESIGN_RULES.md#life-realism-and-time) of the design rules. Life 17's update history (skills and techniques, the skill card and strip, and the free-route fix) is recorded in the changelog and the lab notes, entries 074 and 075.

Forty strangers are dropped on 4 km square of young glacial land in Mesolithic northern Europe: drumlins, moraine fronts, kames, hummocks, kettle hollows and tunnel valleys, with lakes in the hollows and rivers running downhill to the edge. The ground is grass, dirt and stone. They arrive in high summer, as the bilberries ripen. People discover drinking banks, drink, pick berries, gather hazelnuts, fish, gather firewood, meet, form groups, exchange wood and axes for food, and build huts around shared fires. Their knowledge comes from observation and memory. Each of them is a woman or a man with a body and a personality of their own. They find their way by the ways they remember, and they know the others they have spent time with, ask them for food or wood, and give when they know the asker well enough. Each person carries a working life of experience, talents, ideas and techniques. From this step the year turns: **berries ripen in late summer and hazelnuts fall in early autumn**, each for a few weeks; what is not gathered is eaten by animals or rots; **some years the crop is good and some years it fails**; and people **store nuts at home** to carry them through the long months when nothing ripens.

Time is one clock in minutes. Nobody is stepped: a person is woken when their task ends, a body threshold arrives, someone enters their chunk, or someone addresses them, and their position and body at any minute follow from their task. A year has as many days as the run's settings say, from 8 to 365. Lengths are integer centimetres, food integer kilocalories, wood integer kilograms, water deficit integer millilitres, experience integer seconds, and fractional amounts accumulate in integer remainders. `stepValley` advances the state to a target minute, is pure and deterministic, and every random draw comes from a named derived stream. The observer displays real records and interpolates movement between them.

## What Life 18 makes possible

- **The valley grows what real land grows.** Until now a berry thicket regrew about 2,000 kg of berries a hectare a year, 30 to 500 times a wild bilberry patch, and every thicket and hazel regrew evenly all year round. Berry thickets now yield what a good wild patch does, about 200 kg a hectare. Hazel thickets keep their yield, already at the top of the wild range. The valley's food in a full-length year falls from enough for about 180 people to enough for about 135 if every berry and nut were gathered, and far fewer once the seasons, animals and failed years take their share.
- **Food is grown by the day, not by the year.** The days-per-year setting compresses the calendar so that skills, seasons and, later, lives pass quickly. Until now it compressed the land's growth too: at the default 90-day year the land regrew a full year's food every 90 days while people still ate every day, so it fed four times as many people as it would in life. The food the land grows is now day-anchored, like eating: a thicket grows as much food in a day whatever the length of the year. A short year has short seasons, not a richer valley.
- **Seasons.** Bilberries ripen from mid-July to the end of August and hazelnuts fall from September to mid-October, as in northern Europe. Outside those weeks the thickets grow nothing. Fish can be caught all year. The rest of the year, about nine months, nothing new can be gathered from the land.
- **Animals and rot take what people leave.** Ripe berries and fallen nuts are lost day by day: half of what lies on a thicket is gone within two weeks. A thicket nobody visits in its season gives nobody anything.
- **Good years and bad years.** Each year's crop of berries and of nuts is drawn for the whole valley: in a poor year hazel gives less than a third of its usual crop, in a good year half as much again. People learn which kind of year it is only by seeing the thickets.
- **Stores.** Each person keeps a store of nuts at their hearth. Adults know the calendar: in the nut season, a person who is neither hungry nor short of wood gathers nuts in loads and carries them home until their store would last them to the next berry season. The conscientious plan for all of it, the careless for part. Through the lean months people eat from their stores, fish, and draw on their bodies' reserves. Nuts keep for about a year.
- **Scarcity, from the land.** Nobody is told to save or to share. Hunger comes from the calendar, the crop and how much each person put by. A person who stored too little, or a valley hit by a failed hazel year, meets the end of winter short of food, and that is where asking, giving, exchange and, later, conflict and influence begin to matter.
- **Why now.** In Life 17's canonical year all forty people were alive at day 365, and people seldom carried food beyond what they ate. The owner deferred conflict and moved seasons ahead of the chief and generations, because neither leadership nor growth means much where there is nothing to run short of.

This step changes the land's food, the calendar, how people expect food at places, and adds stores and the work of filling them. It does not change the map, wood, trees, logs, huts, fires, how people find their way, bodies, personality, skills, ties, asking and giving, groups or exchange. Day length, cold winters, weather, drying and smoking, shared stores and claims on stores wait for later steps.

## Checked against

| Measure | Evidence and comparison | Status |
| --- | --- | --- |
| Berry yield | Wild bilberry forest yields 4 to 65 kg a hectare a year; an exceptional huckleberry field in an exceptional year about 630 (calibration, Food). | Arithmetic: a berry thicket's yearly crop at a normal year is 200 kg a hectare of its footprint, within 1%. |
| Hazel yield and good and bad years | Wild woodland hazel about 400 kg a hectare (calibration, Hazel and the lake); hazel bears heavy and light crops in alternating years (calibration [31]), and nut crops of most trees swing widely from year to year, synchronised over whole regions. | A unit fixture: each year's crop follows its drawn class. Recorded once on the canonical seed: the class of every year run. |
| Seasons | In northern Europe bilberries ripen from mid-July to late August and hazelnuts fall from September to mid-October. | A unit fixture: the windows at 90, 365 and 8 days a year. |
| Loss to animals | Rodents and birds take most fallen hazelnuts: in a seed-fate study of a related hazel in temperate forest, 99% of released nuts were eaten, with a median removal time of about 14 days (Global Ecology and Conservation, 2024). Ripe berries left on the bush drop, rot or are eaten by birds within weeks. | A unit fixture: a stock nobody gathers halves in 14 days within 1%. Recorded once on the canonical seed: the share of each year's crop gathered by people and the share lost. |
| Storage | Mesolithic people gathered and processed hazelnuts in bulk: a single pit at Staosnaig on Colonsay held hundreds of thousands of burnt shells from one year's harvest, about 6000 BC (Mithen et al. 2001); roasting pits at Duvensee and elsewhere point to nuts processed for keeping. | Recorded once on the canonical seed: each person's store at the end of each nut season against their target and conscientiousness. Stores worth weeks to months of food are expected; nobody storing would mean the rule fails. |
| The lean season | Foragers and subsistence farmers lose weight in their lean season, commonly a few per cent of body weight, and regain it at harvest (Jenike 2001). | Recorded once on the canonical seed over three years: the median and range of energy reserves by day of the year; deaths by cause, day of the year and the year's crop. Reserves falling through late winter and spring and recovering at the berry season are expected; deaths, if any, in the lean season and after poor years. |
| What the valley carries | Temperate foragers lived at about 0.05 to 0.5 people a square kilometre (Binford 2001; Kelly 2013), on game as well as plants. This valley has no game yet and unusually dense hazel, so it is not expected to match; how many it carries is recorded, not tuned. | Recorded once on the canonical seed: the living at the end of each of three years. |
| Power law of practice | Across skills, time per task falls as a power of practice: each extra hour adds less than the one before (Newell and Rosenbloom 1981). | A unit test: skill rises with experience, each further block of hours adding less; skill is half way between floor and ceiling at the half-experience. |
| Adult foraging returns | Forager return rates keep rising slowly into the 30s and later, long after strength peaks, because skill takes decades (Kaplan et al. 2000; Koster et al. 2020). | Magnitudes, measured once on the canonical seed: each founder's foraging skill at day 0 and day 365 (a year of 90 days counts as a full year, below), as a median and range. A gain of a few per cent a year for an average founder is expected; most founders still improving at the end. |
| Craft learning | Knapping takes hundreds of hours to learn well: novices given about ninety hours of expert training still failed to make good handaxes (Pargeter et al. 2019; Pargeter et al. 2020); stone adze makers in Irian Jaya trained for years (Stout 2002). Novices' flakes overshoot and fail far more often than a mentor's (Eren et al. 2011). Earlier craft experience helped novices most (Khreisheh 2013). | Unit fixtures: an average-talent novice reaches a technique's half-way skill after `craftHalfHours` (300) of its own experience; a novice's attempts fail more often than an expert's. Recorded once on the canonical seed: attempts and failures by technique and proficiency. Most novice attempts at a new technique are expected to fail. |
| Skill decay | Skills unused fade over months and years, motor skills more slowly than knowledge (Arthur et al. 1998). | A unit test: experience with no work halves in `experienceHalfYears` (10) years within 1%. |
| Talent | Practice explains a minority of the differences in skill between people; the rest is in large part how fast they learn (Macnamara et al. 2014). | Magnitudes: the spread of founders' starting skills is similar to the 75% to 125% of born skill it replaces; recorded once on the canonical seed. |
| Ground and flaked axes | A flaked axe is knapped in under an hour; a ground axe needs about 60 hours of grinding and lasts many times longer (calibration, Making an axe). | Magnitudes; the tranchet axe's numbers are an estimate between the two. |
| Invention | Openness is the strongest and most consistent Big Five predictor of creativity and creative achievement; conscientiousness is mixed, higher among creative scientists and lower among artists (Feist 1998). New techniques are rare: most people use what they learnt. | Recorded once on the canonical seed: every idea, by invention or from an axe, with the person's openness and conscientiousness. A few ideas a year, nearly all from the most open people, are expected. |
| Practice | Conscientiousness predicts sustained effort and performance more than any other trait (Zell and Lesick 2022); conscientious people spend more time working and studying (Rohrer and Lucas 2018). | Recorded once on the canonical seed: hours practised per person against conscientiousness. |
| Specialisation | Among mobile foragers specialisation is modest: most adults do most tasks, and a few are known for a craft; full-time specialists appear in larger, settled societies (Marlowe 2010). | Recorded once on the canonical seed at day 365: how many people made the axes, and the spread of craft experience. A few people making most axes is expected; rigid specialists within a season would mean the learning rules are too strong. |
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
| Speed | A year of forty people in about a second, as since Life 12; in the browser, a month a second, which needs about 30 ms a simulated day. | Not met since update 072. Seasons and stores must not make it noticeably slower: measured once and recorded, days 50 to 59 in 12-hour steps against update 074's. More than about 10% slower is examined before this step is merged. Measured: days 51 to 60 first took 3.3 s a day against 267 ms, as hungry people fish in short stints and choose food far more often; a speed-up that keeps every fingerprint brought it to about 0.5 s, within the browser's second for a day (see the lab notes). |

## Design decisions

### Seasons, harvests and stores (new)

| Decision | Reason |
| --- | --- |
| **The land's food is day-anchored.** A thicket's yearly crop and a lake's yearly fish growth are stated per 365 days; in a year of `daysPerYear` days the land grows `daysPerYear / 365` of it. The windows in which food ripens stay year-anchored, as fractions of the year. Rule 9 of the design rules is amended to say so. | Eating is day-anchored, so the food that feeds it must be too, or a short year multiplies the land: at 90 days a year the valley fed four times what it would in life. With food grown by the day, a short year has short seasons, short lean months and small crops, in proportion, and a year's balance of food against mouths is the same at any setting. This is the one declared compression applied consistently, not a new one. |
| Wood, deadfall and tree regrowth stay year-anchored in this step. | The valley's woodland, 300 stands of 15 m on 16 km², is a small fraction of the forest that covered Mesolithic northern Europe. Anchoring wood by the day without also giving the valley its real woodland would make fuel short for a reason that is not real (realism rule 5). Wood and woodland are a question for a later step. |
| **Berries ripen from 330‰ to 450‰ of the year and hazelnuts fall from 450‰ to 580‰**, counted from the spring equinox; at 365 days, from about 19 July to 31 August and from 31 August to 20 October. Each window is at least one day. Fish are caught all year. | Bilberry and hazel seasons in northern Europe. Nothing else grows in this valley yet, so the windows are the year. |
| **Founders arrive at 330‰ of the year**, the first day of the berry season. The run's minute 0 is that day; the calendar counts from the spring equinox. | Strangers dropped in spring would have no food on the land for about four months, more than their bodies hold: everyone would die before the first berry, which says nothing about the valley. Arriving at the start of the season gives them one harvest to prepare. |
| A berry thicket yields `berryThicketKcalPerYear` 5,400 kcal (9 kg) a normal year, 200 kg a hectare of its 452 m² footprint. A hazel thicket keeps 150,000 kcal (60 kg in shells), renamed `hazelThicketKcalPerYear`. | 200 kg a hectare is a good wild bilberry patch, between forest averages of 4 to 65 and an exceptional field's 630; a thicket is a patch worth walking to, so it sits towards the top. The old 54,000 kcal was ten times this. Hazel's 477 kg a hectare was already calibrated against wild woodland and is kept. |
| **Each year's crop is drawn for the whole valley**, once for berries and once for hazel, at the start of each calendar year and at the founders' arrival for year 0: a poor year with chance `poorYearPerMille` (250), a good year with `goodYearPerMille` (250), else normal. Berries give 500‰, 1,000‰ or 1,400‰ of a normal crop; hazel 300‰, 1,000‰ or 1,600‰. | Nut crops swing widely and in step over whole regions, and hazel bears heavy and light years. A per-thicket draw would add noise with no mechanism behind it. Three classes are the simplest form that gives famine years; the means are close to a normal year, so poor years are not offset by a rule. The sizes are judgement within the observed swing. |
| A year's crop at a place is `floor(kcalPerYear · daysPerYear · factor / (365 · 1,000))`, delivered over the window's days by the exact daily share, added at midnight and capped at the place's capacity. Capacity is the good-year crop, at least 1 kcal. | The same exact sharing as before, now over the window. Capacity bounds a stock without binding in practice, since losses keep a thicket below a full crop. Picking still slows as a thicket empties against its capacity, as since Life 11. |
| **Losses:** at midnight, before the day's crop, a berry or hazel place loses `floor(stock · lossPerMille / 1,000)`: `berryLossPerMille` and `nutLossPerMille`, 48 each, so half of what lies there is gone in 14 days. Losses are recorded per day in the world's ledger as eaten by animals or rotted. | A related hazel's fallen nuts were removed with a median of about 14 days; berries rot or are taken within weeks. Without losses a crop would wait on the thicket for the whole year and seasons would only delay food, not limit it. Day-anchored, like spoilage. |
| Nuts keep `nutShelfLifeHours` 8,760, a year, in a store or carried. Berries (48 hours) and fish (24) are unchanged and are never stored. | Dry hazelnuts in their shells keep for about a year, and Mesolithic people roasted them, which keeps them longer. Half a year, as before, would spoil a store before the next harvest at a full-length year. Drying berries and smoking fish are recipes for a later step. |
| **Everyone knows the calendar.** A person knows the windows of each food, as an adult forager knows when bilberries ripen, but not this year's crop. | Rule 1: what a person could plausibly know. Founders are adults with fifteen years of foraging behind them. The year's crop is learnt only by seeing thickets. |
| **Expected stock follows the calendar.** A person expects a seasonal place to hold what they last saw if they saw it since the start of its most recent window, grown since by a normal crop's daily shares while the window is open; else, while its window is open, the openness share of what a normal crop has grown so far; else nothing. | Someone who saw a thicket full in August does not walk to it in February. Before this step the remembered stock was trusted all year, which seasons would make foolish. The openness share for an unseen place is unchanged. |
| **Each person has one store, at their hearth.** It holds food lots with their minutes, spoiling as carried lots do. Arriving home, a person first eats as before, then puts every carried nut lot into the store. Only the owner takes from it. A store outlives its owner's death and spoils there untouched. | A pit or cache at camp, as foragers who store keep them. Personal stores keep the rule local and the books simple. Taking from someone else's store is theft, and sharing a store is property or group decision: both wait for later steps. |
| **A store target, planned by the conscientious:** `floor(storeKcalPerDay · weightKg · daysToBerries · f_C / (referenceBodyKg · 1,000))`, where `daysToBerries` is the number of days from today to the start of the next berry window and `f_C` the person's conscientiousness factor (Life 14's "plans ahead", 500 to 1,750 per mille). A person has a **store need** when their store holds less than the target and they expect some nuts at a remembered hazel place. | The target is the food that would carry the person from now to the next fresh food. Conscientiousness's job is already planning ahead, for wood and for when to stop food work; this is the same job applied to the winter. A person at the low end plans for half the lean season and leans on their body, fish and others for the rest. |
| **Filling the store.** A person with a store need, neither hungry nor short of wood, gathers nuts at the best expected hazel place, keeps gathering until the nuts they carry weigh their load capacity, the stock runs out, or they must turn for home, then carries the load home. Store need ranks with food and wood need, ahead of company, axes, practice and leisure. | Gathering for later is work, like gathering wood, and is carried in loads the same way. The load capacity from Life 14 applies: about 30 kg of nuts in shells, about 75,000 kcal. Putting company and craft below storing is what people with a winter ahead do; the hungry still eat first. |
| **Eating from the store.** The store is a food source at the person's hearth, scored like any other, with the walk home and `storeKcalPerHour` 6,000, the rate at which stored nuts are cracked and eaten. Taking is a task at the hearth that ends when the reserve is full or the store empty. | Cracking a stored nut takes time, as gathering includes cracking. A store at home competes with fresh food by the same reckoning as everything else, so a hungry person near a ripe thicket eats there and one far from any food goes home. Rationing is left as a question. |
| Asking and giving still move only carried food and wood, and food to pay for an axe or wood is gathered, never taken from a store. | Giving or paying from a store is sharing a store, which waits with property and group decisions. (Implementation showed the rule was needed: a person picking food to buy an axe chose their own store, took a minute's nuts into the hand and put them straight back at the next wake-up, thousands of times a day.) |

### Skills and techniques (Life 17, unchanged)

| Decision | Reason |
| --- | --- |
| Each person holds **experience** for foraging, for wood and for each technique they know, in integer seconds of work with an integer remainder. The 30-day practice log, born skills and the `craftPractice` switch are removed. | Skill built over a working life needs a memory longer than a month. One quantity per skill, in the unit work is already counted in, keeps the books simple and checkable. The switch only recreated Life 9's fixed craft. |
| Skill follows from experience by `skill = floor + (ceiling − floor) · E / (E + H)`, with floor 50%, ceiling 150% and a half-experience `H` per skill, rounded down. | The power law of practice: fast gains early, slow gains late (Newell and Rosenbloom 1981). This saturating curve has that shape in integer arithmetic, with no logarithms, and keeps Life 9's floor and ceiling. A person at the half-experience works at the base rate. |
| Rates are the base rate times skill: foraging for berries, nuts and fish; wood for gathering. A technique's skill, its **proficiency**, sets its making time and the axe's quality as craft did. | Each rate keeps its Life 13 meaning at 100%. |
| Experience is **year-anchored**: each second worked adds `365 / daysPerYear` seconds of experience, scaled by talent. | The roadmap lists skill mastery as year-anchored: becoming an expert takes years of a life, and a short year compresses it as it compresses growth and seasons. Work rates stay day-anchored: an hour's picking still takes an hour. |
| Experience fades at midnight by the share that halves it in `experienceHalfYears` (10) years: `fadePerMillion = round(693,147 / (experienceHalfYears · daysPerYear))`. | Skills unused decay over years (Arthur et al. 1998). Year-anchored like the gain. Fading lets an old skill go and bounds experience; because skill saturates, a long working life loses little. The first-order rate `ln 2 / days` is within half a per cent of the exact share even at the shortest year, and needs no powers. |
| **Talent** is a normal score per person for foraging, wood and craft, in thousandths of a spread, clamped to three spreads. It scales the experience each second gives: `learn = clamp(1,000 + 250 · z / 1,000, 250, 1,750)` per mille. | Talent as speed of learning (Macnamara et al. 2014). One spread more learns a quarter faster; the slowest learn a quarter as fast as average, the fastest three quarters faster. The strength is judgement, listed for later. |
| Founders arrive with experience behind them: `founderForageHours` (16,425, fifteen years at three hours a day), `founderWoodHours` (5,475, fifteen years at an hour a day) and `founderCraftHours` (150) in each technique they know, each times their talent. Every founder knows the flaked axe; a founder knows the tranchet axe with `founderTranchetPerMille` (250) and the ground axe with `founderGroundPerMille` (100). | Founders are adults who learnt at their own talent. Their spread of starting skills then comes from talent, not from a separate draw, and is like the 75% to 125% it replaces. The half-experience equals about an average founder's, so the average founder works at the base rate, as before. Knowing the flaked axe is common to every Mesolithic adult; the other two are not. |
| Three **techniques**, held as data: flaked (needs nothing, 1 hour, 10 logs at quality 100), tranchet (needs flaked, 2 hours, 30 logs) and ground (needs flaked, 50 hours, 200 logs). All take one stone and `axeWood` of wood. | The calibration document's flaked and ground axes. The tranchet axe, the Mesolithic way of re-edging a flaked axe by a sideways blow, sits between them; its numbers are an estimate. A branching tree rather than a ladder: both better axes start from flaking. |
| A technique's proficiency uses its own experience plus `transferPerMille` (300) of the experience in every other technique: `P = skill(E_t + 300 · (G − E_t) / 1,000, craftHalfHours)`, where `G` is the sum of a person's technique experience, their **general craft**. | Craft experience transfers: novices with other craft experience learnt knapping better (Khreisheh 2013), but the specific skill still has to be learnt. General craft is derived, not stored, so it cannot disagree with the techniques. |
| `craftHalfHours` 300: an average novice reaches the base rate in a technique after 300 hours of their own experience. `forageHalfHours` 16,000 and `woodHalfHours` 5,000 are near the average founder's experience. | Knapping skill takes hundreds of hours (Pargeter et al. 2020; Stout 2002). The foraging and wood half-points keep average founders at the base rates and leave adults improving slowly, as forager returns do into the 30s (Kaplan et al. 2000). |
| A person holds, per technique, whether they have its **idea** and whether they **know** it. Everyone has the idea of and knows the flaked axe. An idea lets them try; knowing means they have once made one that worked. | Knowing that a thing can be made, being able to make it, and being good at it are three different things. The person, not the engine, finds out what can be made. |
| **Every axe is an attempt.** At its start the attempt is drawn to succeed with chance `success(P) = 1,000 · d² / (d² + attemptHalfPercent²)` per mille, `d = P − skillFloorPercent`, `attemptHalfPercent` 15; a failed one breaks at a point drawn uniformly through its work. A break loses the stone and the work done; the wood, not yet hafted, is kept. Every second worked, on a success or a failure, adds experience. | Novices fail often and experts rarely (Eren et al. 2011; Pargeter et al. 2019). At proficiency 63, a novice who flakes well trying a tranchet axe, about two in five attempts work; at 83, a founder's flaked axe, five in six; at 120, twenty-four in twenty-five. The square makes success climb quickly once someone is past the beginner's stage. The strength is judgement. |
| **Inventing.** For each technique they have no idea of, whose `needs` they know, a person draws at the end of every stint of axe work: the idea comes with chance `seconds · inventPerMillionPerHour · (365 / daysPerYear) · opennessInvent / (3,600 · 1,000)` per million, from `invent:<person>:<minute>`. | Ideas come to people who work the material, and build on what they can already do (the adjacent possible): nobody thinks of grinding an axe who has never made one. Year-anchored like experience. Openness has the job: a person a spread above average twice as often, two spreads three times, and one a spread below never (Feist 1998). Conscientiousness acts only through the hours practised. |
| **An idea from an axe.** A person who acquires an axe, by buying it, gains the idea of its technique. | The axe shows what was done to it. This is the only way ideas spread for now; teaching and watching are left for step 24. |
| **Practice.** A person at their hearth with nothing needed (priority 9) practises before a walk, up to `practiceMinutesPerDay` (60) times their conscientiousness factor each calendar day: an attempt at an axe by a technique they have the idea of but do not know, else by the technique they would choose for an axe. An unfinished practice axe waits for the next practice; a finished one is kept or sold like any axe. | Free time is spent on something, and skill is built by practice. Conscientiousness's job, planning ahead, includes working now for a skill later (Zell and Lesick 2022; Rohrer and Lucas 2018): a person a spread above average practises 1¾ hours a day, two spreads 2½, and one 1⅓ spreads below not at all. A day-anchored budget needs no draw and can be checked. |
| A person's experience in a technique starts when they first try it; proficiency comes from general craft at first. A technique once known, or an idea once had, is not forgotten while the person lives. | Knowing how and being good at it are different things. The fading experience is what an unused technique loses. |
| A person about to make an axe they need chooses the known technique with the least `1,000 · (makeSeconds + stoneSeconds) / (success · expectedLogs)`, compared exactly in integers, ties by technique order; `stoneSeconds` is 0 when they hold a spare stone besides the one the axe will use, else the straight-line estimate there and back to the nearest known outcrop with stones; `success` is the attempt's chance; `expectedLogs` is the technique's logs at their expected quality. An axe begun keeps its technique. Techniques they only have the idea of are tried in practice, not for an axe they need. | A person weighs work, and the work a failure wastes, against how long the axe will serve, from what they know. A flaked axe pays when stones are close or skill at grinding low; a ground axe when stones are far or a long working life is ahead. Nothing in the engine says which is better. |
| Axe trade values an axe by the logs it will still cut: a buyer's worth is their own making cost per log, by their own best technique, times the axe's logs left. The seller's ask is their extra energy to make one by the technique they would use. | Life 9's make-or-buy comparison, extended to axes of different lives. A ground axe sells for more than a flaked one because it serves longer. |
| Talent draws come from a new `talent` stream; the skill and craft streams are no longer drawn. Attempts and inventions draw from streams named by person and minute. | Founders' places, bodies and traits stay as Life 16's on every seed. |
### Ties, asking and giving (Life 16, unchanged)

| Decision | Reason |
| --- | --- |
| A tie is held in each person's own memory, keyed by the other's id: familiarity, credit and grievance, all in minutes, with the minute their time together was last counted and the calendar day the person last asked the other. | The roadmap asks for relationships held in memory per pair. Each person keeps their own view (rule 1): what I think you owe me is my count, not yours. One unit for all three lets one rule compare them. |
| Familiarity is the minutes two people spent within talking distance, neither walking. It is counted when either wakes, from the later of their two task starts and the last minute counted in either person's tie, so no minute is counted twice, and added to both people's ties equally. | Nobody is stepped minute by minute, but a person who is not walking stands still for the whole of their task, so two people standing within 20 m when one wakes have stood there together since the later of their task starts. The count is exact for people standing still and needs nothing new tracked. Walking side by side does not count until groups travel together (step 20). |
| Credit is the minutes of the person's own work a gift stands for: kcal at their own berry-picking rate, wood at their own gathering rate. Giving adds to the giver's credit with the receiver; receiving takes from the receiver's credit with the giver. Positive credit means "they owe me". | Foragers keep account of sharing in effort, not in a currency (Gurven 2004). Each person can value a gift only by what it would cost them, which they know. The two views of one gift can differ, as they do in life. |
| Grievance grows by `refusalGrievanceMinutes` (60) each time a person is refused by someone who had something to spare. It is the only harm in this step. | Stinginess is the grievance foragers voice most (Peterson 1993; Woodburn 1998). Fights, injury and theft come with conflict, deferred until the valley knows scarcity, and will add to grievance then. A fixed amount per refusal is judgement, listed for later. |
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
| Height has no rule of its own yet. | It is drawn because weight and strength follow it; it is shown, and it is there for conflict (reach) and for the observer's figures. |
| Strength sets the wood load: `woodLoad · (grip + referenceGrip) / (2 · referenceGrip)`. | Carrying depends on legs and back as much as hands, so women's loads are closer to men's than their grip is: an average woman carries about 26 kg, an average man about 33 kg, the weakest about 17 kg. A log stays one log for everyone: only the speed it costs differs. |
| Weight replaces the single `bodyKg`: it weighs the load against the body for walking speed, sets the thirst thresholds, and scales every kilocalorie rate. | A heavier body carries a load more easily, holds more water and burns more energy for the same work. Scaling by weight keeps strength from being free: a big strong person carries more but must eat more. |
| Five traits, each stored as a normal score in thousandths of a spread, clamped to three spreads. | Personality is measured as continuous scores with a normal spread in every population; a score in spreads lets each rule say "one spread more moves this by so much". |
| Each trait has exactly one job, attached to a decision people already make, and no trait touches another trait's decision. | Rule 13: a trait with no mechanism is cut. One job each keeps every effect traceable to one trait. Agreeableness's yielding and neuroticism's flight wait for disputes, when conflict is built, but each already has a job now, so neither is cut. |
| Every trait rule is a person's own threshold or share. No trait sets an outcome. | Rule 4: behaviour emerges from incentives. A trait shifts where a person draws a line; whether that pays is left to the world. |
| An average person behaves close to Life 13, but not exactly. | Life 13's rules had no margin before dusk and treated unseen stocks as full. The average person now keeps half an hour before dusk and expects three quarters of an unseen stock. Keeping Life 13 exactly for the average would need rules that only matter at the extremes. |
| Bodies and traits come from their own streams. | The founder stream draws exactly as before, so a person's start, body and traits on a seed are unchanged. |

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

Places are laid out by the layout stream with Life 11's spacing, their footprints wholly on walkable triangles. A berry thicket yields `berryThicketKcalPerYear` (5,400 kcal) in a normal year and a hazel thicket `hazelThicketKcalPerYear` (150,000), each per 365 days and only in its window, below; a stand holds 300 kg of wood, 60 kg of deadfall a year and 36 logs, with 10 kg of crown wood per felled tree; an outcrop 60 stones. A berry thicket's dead stems give wood as before. Picking retains Life 11's stock-dependent slowdown: the skill-adjusted full rate is multiplied by the remembered fraction of capacity remaining, rounded down, when the task starts, fixed until the next wake-up; production is capped at the stock remaining when credited.

Bank points come from the mesh: each shore edge between a walkable and a water triangle gives at most one bank point, set back half a metre (or `reachCm`, if less) from the edge's midpoint into the walkable side and kept by Life 11's approach rule. Its id is the edge's half-edge number.

Every person's **store** lies at their hearth. It is not a place others can use; it is drawn by the observer.

### Seasons, crops and losses

The calendar counts days of the year from the spring equinox. The run's minute 0 is day `arrivalDay = floor(arrivalPerMille · daysPerYear / 1,000)` of year 0, so `dayOfYear(minute) = (day + arrivalDay) mod daysPerYear` and `yearOf(minute) = floor((day + arrivalDay) / daysPerYear)`, where `day = floor(minute / 1,440)`. A window `[startPerMille, endPerMille)` covers days `floor(start · D / 1,000)` up to but not including `max(that + 1, floor(end · D / 1,000))`: the berry window is `berrySeason` (330‰ to 450‰) and the nut window `nutSeason` (450‰ to 580‰). At 90 days a year arrival is day 29, berries ripen on days 29 to 39 and nuts fall on days 40 to 51; at 365 days, days 120 to 163 and 164 to 210; at 8 days, day 2 and day 3.

Once a year, at the first midnight of each calendar year and at minute 0 for year 0, the world draws the year's class for berries and then for hazel from the `harvest:<year>` stream, below. A place's crop for the year is `crop = floor(kcalPerYear · D · factor / (365 · 1,000))`, with `factor` the class's per mille for its kind. Its capacity is `max(1, floor(kcalPerYear · D · goodFactor / (365 · 1,000)))`.

Once a day at midnight, in this order, each berry and hazel place:

1. loses `floor(stock · lossPerMille / 1,000)` to animals and rot;
2. if the day lies in its window, at window day `i` of `w`, gains `floor(crop · (i + 1) / w) − floor(crop · i / w)`, capped at capacity.

Stands' deadfall and logs regrow as before, year-anchored. Fish per lake and reach keep Life 11's capacity and logistic growth, applied once a day with an exact carried remainder, now at `fishGrowthPercentPerYear` per 365 days whatever the year's length; a depleted body is not reseeded. Hut weathering is day-anchored: one log every `hutLogDays`. The day's losses, crops, overflow above capacity and fish growth are recorded as world ledger totals.

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
| Losses and crops on thickets, fish growth, deadfall and log regrowth, spoilage of carried and stored lots, hut weathering, experience and skills, ties fading | Daily at midnight, `world` phase |
| The year's crop classes | At minute 0 and the first midnight of each calendar year, `world` phase, before the day's losses and crops |
| Time together, asking and giving | At the person's wake-ups |
| An attempt's success, inventing | When an axe is begun; when a stint of axe work ends |
| Group and personal fires | Hourly at night, `world` phase |
| Bodies | Lazily, at the person's wake-ups |
| Conservation checks | At every event that moves food, wood, logs, stones, axes or water |
| Full invariants | Daily at midnight, and at the end of every `stepValley` call in checked runs |

Bodies, traits and talents are drawn once, when the founders are made, and never change.

### Days per year

`daysPerYear` is a run setting from 8 to 365, default 90. Day-anchored, unchanged by the setting: sleep, the hour of rest, picking, gathering, chopping, drinking and making rates, spoilage, firewood per night, hut weathering days, the 24-hour memory of heard terms, the one leisure walk a day, the daily practice budget, every trait rule (margins in minutes, distances, shares), and, from this step, **the food the land grows**: thicket crops and fish growth per 365 days, losses to animals, and the store's daily need. Year-anchored, scaled by the setting: the season windows and the founders' arrival, as fractions of the year; wood deadfall per year and tree regrowth in years; experience gained per second worked and its fading; the chance of an idea per hour of axe work; and the displayed calendar. A year-anchored duration is never shorter than one day.

What turns strange at short years: at 90 days a year each hour worked counts about four hours of experience, so a novice reaches the base rate in a technique after about 75 hours at the hearth; at 8 days a year each hour counts about 46, and a novice becomes competent in a few days. Founders' fifteen years of experience are counted in full-length years whatever the setting, so they start the same. Seasons shrink with the year but a body's reserve does not: at 90 days the lean months last about 67 days, and a full reserve of about 28 days of food bridges more than a third of them, where at 365 days it bridges a tenth of the 275-day lean season. Stores therefore matter less at short years than in life, and the measurements below are taken at the default year and noted as such.

### Streams

Every draw comes from a stream derived from the seed and a name: the terrain and layout streams as in Life 11; the founder stream for starts, unchanged; `axe:<maker>:<minute>` for an axe's quality; the body, traits and talent streams, unchanged; the attempt and invent streams of Life 17, unchanged; and from this step one new name, with its own salt:

- **body**: per founder, one draw `randomInt(2)` for sex (0 woman, 1 man), then three standard normals for height, weight and grip;
- **traits**: per founder, five standard normals for openness, conscientiousness, extraversion, agreeableness and neuroticism, in that order;
- **talent**: per founder in id order, three standard normals for foraging, wood and craft talent, then `randomInt(1,000)` for knowing the tranchet axe and `randomInt(1,000)` for knowing the ground axe, known when below the founder share;
- **`attempt:<person>:<minute>`**: when an axe is begun, `randomInt(1,000)` against its success chance; for a failure, `randomInt(needed)` for the second of work at which it breaks;
- **`invent:<person>:<minute>`**: when a stint of axe work ends, one `randomInt(1,000,000)` per technique the person could think of, in technique order;
- **`harvest:<year>`** (new): two draws `randomInt(1,000)`, for berries then hazel; a draw below `poorYearPerMille` is a poor year, one at or above `1,000 − goodYearPerMille` a good year, any other a normal year.

Nothing is drawn per minute. The mesh, ways, plans, ties, asking, giving, practice, losses and stores draw nothing.

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
| Conscientiousness | Plans ahead | The wood a person stocks to is `max(nightWood + 1, floor(woodStockNights · nightWood · f / 1,000))`; the energy at which they stop food work is `min(reserveMaxKcal, hungryBelowKcal + floor((satiatedAtKcal − hungryBelowKcal) · f / 1,000))`. Short of wood below one night, and hungry below `hungryBelowKcal`, are unchanged. From Life 17, a second rule, `conscientiousnessPractice`, sets the daily practice budget, below. | 1,000, 250, 500, 1,750 |
| Neuroticism | Fear threshold | A person keeps `duskMarginMinutes · f / 1,000` minutes, at least 1, before dusk: they go home when the walk home would end later than dusk less the margin, and choose no work, check or water whose walk there and home would. Severe thirst ignores the margin, as it ignores dusk. | 1,000, 500, 0, 4,000 |
| Openness | Tries the unfamiliar | (a) When idle (priority 9), a person explores the nearest frontier only if it lies within `exploreRangeCm · f / 1,000` of their hearth in a straight line; otherwise they practise, take a walk or rest, below. Exploring for water, food or wood they need is unchanged. (b) A known place whose stock they have never seen is expected to hold `capacity · g / 1,000`, with `g = clamp(750 + 250 · z / 1,000, 250, 1,000)`. (c) From Life 17, `opennessInvent` scales the chance of an idea, under Skills and techniques. | 1,000, 500, 250, 3,000 |

From Life 16, agreeableness's job, giving way, has a second rule: it scales the goodwill with which a person gives when asked, `agreeablenessGive`, under Ties. From Life 17, conscientiousness's job has a second rule, `conscientiousnessPractice` (base 1,000, effect 750, low 0, high 3,000), and openness's a third, `opennessInvent` (base 1,000, effect 1,000, low 0, high 3,000). No other rule reads a trait.

The five scores are drawn as real ones spread: on the three fingerprint seeds' 120 founders each trait's spread is 0.91 to 0.98 of a standard deviation, about one person in six lies a spread or more above average on any one trait, and openness and conscientiousness correlate at 0.19 against the 0.20 of the meta-analysis. A person a spread or more above average on both is rare, a few in a hundred, and none of those 120 is. Differences between people show through the strength of each rule, not a wider draw. The trait factors and the body-derived quantities are stored with the person, and the checker recomputes them from the scores and the configuration.

## Knowledge and perception

A person remembers: places, with kind, position, the stock last seen and the minute it was seen; bank points; the triangles of the mesh it has seen; the ways it has walked, below; the point of its last survey; people it has met, with the minute; its ties, below; its own experience, skills, talents, and the ideas and techniques it knows, under Skills and techniques; heard exchange terms for 24 hours; its group, flag, hearth and hut. A person knows their own body and traits, and nobody else's.

At every wake-up a person observes in two parts:

- **The still landscape**, only if the person stands `resurveyCm` (100 m) or more from their last survey point, or has never surveyed: every resource place and bank point within `sightRadiusCm` (1 km) becomes known, and every triangle whose centroid lies within the sight radius becomes known. A chunk lying wholly within the sight radius marks all its triangles at once. The person's position becomes their survey point.
- **What changes**, at every wake-up: hearths, flags and hut sites within the sight radius become known; the place the person stands at shows its stock; people within `talkRadiusCm` (20 m) are met, and people within sight are seen.

Founders survey at their first wake-up. Relief does not block sight. A person knows the calendar: the berry and nut windows and where today falls. A berry or hazel place is **expected** to hold the stock last seen if it was seen at or after the start of its kind's most recent window, plus a normal crop's daily shares from the day it was seen to today while the window is open, capped at capacity; else, if that window is open today at window day `i` of `w`, the openness share of `floor(normal · (i + 1) / w)`, where `normal` is a normal year's crop, capped at capacity; else nothing. (Implementation showed the first draft's rule wrong: expecting an unseen thicket at the openness share of its capacity on the first day of its window sent everyone walking to thickets that held one day's crop, and a stock seen early in the window was never expected to grow, so nobody returned to it.) Other places are expected at the stock last seen, or the openness share of capacity if never seen; a fish stock is learnt only by fishing. A person knows their own store exactly. Triangle knowledge is a bit per triangle, shared with the previous state and copied only when the person learns a new triangle.

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

**Leisure.** A person idle at their hearth (priority 9, no frontier in range), who has not set out on a leisure walk in the last `leisureWalkDays` calendar days (default 7; added by the owner after the first measurement to save computation, the walk having been daily), takes the remembered way with an end at their hearth that was used longest ago (ties by lowest number) whose far end can be reached and left for home before dusk, less their dusk margin, by the straight-line estimate. They walk it to its far end, `out for a walk`, and the walk's start records the minute in `leisureMinute`. Idle away from their hearth, they walk home, `going home to rest`. Idle at home otherwise, they rest. A person with no such way rests.

The fine A\* is Life 14's: costed by the distance between the midpoints of the edges crossed, ties by triangle id; from update 071 it runs within one piece only. Before a new plan, the person's known components of ground are compared as before; targets on another component go straight to step 4. A straight, steered or rechecked plan to a place, bank point or hearth is remembered as a way between the walk's start and the target, replacing any way with the same two end points; when the person holds `waysRemembered` ways, the one used longest ago is forgotten first, ties by lowest number. Using a way sets its last-used minute. Walks to a frontier are never remembered.

A person's pieces are found within each chunk: known walkable triangles of the chunk sharing an edge belong to one piece, numbered by its lowest triangle id. Two pieces are linked when one of the mesh's chunk-crossing edges, listed once per layout, joins a triangle of one to a triangle of the other. A triangle's chunk is the chunk holding its centroid. Pieces and links are worked out from the person's knowledge, never stored, and only for chunks where the person has learnt triangles since they were last worked out; they cannot change any result.

Speed is the person's flat loaded speed, above; moderate slopes divide it by `moderateSlowdownPerMille/1,000` uphill; steep slopes halve it uphill and divide by `steepDownSlowdownPerMille/1,000` downhill; ground multiplies time by Life 11's terrain percentages. Walking costs the person's walking rate on the flat, one and a half times that on moderate uphill and twice on steep. A walk's duration is summed in integer 1/60,000-minute units and rounded up at its end; remainders carry. The path, its pieces and their times are computed afresh for every walk from its corridor, the walker's position and their load.

Travel estimates for choosing targets use straight-line distance at the person's flat loaded speed plus `climbMinutesPerMetre`, as a lower bound.

## Skills and techniques

A person holds `experience`, integer seconds each with an integer remainder: `forage`, `wood`, and one per technique. They hold `ideas`, the set of techniques they can try, and `known`, those they have made one of that worked, always within `ideas`; three talents, `forageLearn`, `woodLearn` and `craftLearn`, per mille; and `practicedToday`, minutes of practice this calendar day. Skills, rates and proficiencies are stored with the person and recomputed only at midnight and when an idea is gained; the checker recomputes them from experience.

**The curve.** For experience `E` seconds and half-experience `H` hours, `skill(E, H) = skillFloorPercent + floor((skillCeilingPercent − skillFloorPercent) · E / (E + 3,600 · H))`, with floor 50 and ceiling 150.

**Skills and rates.**

- Foraging skill `skill(E_forage, forageHalfHours)`; `forageRate`, `nutRate` and `fishRate` are `floor(base · skill / 100)` of `berryKcalPerHour`, `nutKcalPerHour` and `fishKcalPerHour`.
- Wood skill `skill(E_wood, woodHalfHours)`; `woodRate = floor(woodPerHour · skill / 100)`.
- General craft `G`, the sum of technique experience; its skill `skill(G, craftHalfHours)` is shown, and used by nothing else.
- Proficiency in a technique `t` they have the idea of: `skill(E_t + floor(transferPerMille · (G − E_t) / 1,000), craftHalfHours)`; 0 for one they have no idea of.

**Techniques.**

| Technique | Needs | Hours at proficiency 100 | Logs at quality 100 |
| --- | --- | --- | --- |
| Flaked | — | 1 | 10 |
| Tranchet | Flaked | 2 | 30 |
| Ground | Flaked | 50 | 200 |

Making an axe by `t` takes `ceil(3,600 · hours_t · 100 / P_t)` seconds of work, pausable as in Life 9, one stone and `axeWood` kg. **An attempt.** When it is begun, the attempt draws from `attempt:<person>:<minute>`: it succeeds if `randomInt(1,000) < success(P_t)`, with `success(P) = floor(1,000 · d² / (d² + attemptHalfPercent²))`, `d = max(0, P − skillFloorPercent)`; otherwise it breaks after `1 + randomInt(needed)` seconds of work, and the draw is stored with the axe in progress. A break ends the making: the stone is lost, the wood returned to the person, and a `broke` event records the person, the technique and the seconds worked. On finishing a success, its quality is drawn from the axe stream uniformly from `floor(P_t / 2)` to `P_t`, at least 1, and it cuts `max(1, floor(logs_t · quality / 100))` logs; a log's cut takes `logChopMinutes · 100 / quality` minutes, as in Life 9, whatever the technique. The expected quality is `max(1, floor(3 · P_t / 4))`. An axe records its technique. The first success by a technique the person did not know makes it known, and a `learnt` event records it.

**Choosing a technique.** When a person starts an axe they need (priority 8), they take the known technique with the least `1,000 · (makeSeconds_t + stoneSeconds) / (success_t · expectedLogs_t)`, compared as the cross products in integers, ties by technique order. `stoneSeconds` is 0 if they hold a spare stone besides the one the axe will use (corrected in implementation: a person beginning an axe always holds one, so "holds a stone" would never count the walk); otherwise twice the straight-line walking estimate from their hearth to the nearest outcrop they remember holding stones. `expectedLogs_t` uses the expected quality.

**Midnight.** For each living person, in id order, in the `world` phase after spoilage: each experience `E` first fades by `(E · fadePerMillion + remainder) / 1,000,000` rounded down, the rest carried; then gains `(seconds · 365 · learn + remainder) / (daysPerYear · 1,000)` rounded down, the rest carried, from the seconds worked that day at foraging (picking, nuts and fishing), at gathering wood, or at making by that technique, broken attempts and practice included, with the matching talent. `practicedToday` is cleared. Then skills, rates and proficiencies are set, and a `skills` event records each experience before and after, the seconds worked, and the new skills. Chopping logs and delivering them are not counted as experience, as in Life 9.

**Inventing.** When a stint of axe work of `S` seconds ends (the making task ends, is interrupted, finishes or breaks), for each technique `s` the person has no idea of and whose `needs` they know, in technique order, they draw `randomInt(1,000,000)` from `invent:<person>:<minute>`; below `min(1,000,000, floor(S · inventPerMillionPerHour · 365 · opennessInvent / (3,600 · daysPerYear · 1,000)))` they gain the idea of `s`, and an `idea` event records the person, the technique and `invented`. `opennessInvent = clamp(1,000 + 1,000 · z / 1,000, 0, 3,000)` from openness.

**An idea from an axe.** A person who buys an axe by a technique they have no idea of gains its idea, and an `idea` event records `from an axe` and the maker.

**Practice.** A person at their hearth under priority 9, with no frontier in their exploring range, practises if `practicedToday` is below their budget `floor(practiceMinutesPerDay · conscientiousnessPractice / 1,000)`, `conscientiousnessPractice = clamp(1,000 + 750 · z / 1,000, 0, 3,000)` from conscientiousness. They continue a practice axe in progress; else they begin one, by the lowest-numbered technique they have the idea of and do not know, else by the technique they would choose for an axe, if they hold a stone and `axeWood`. A practice stint is a making task that ends when the budget is spent, at the latest; `practicedToday` adds its minutes. Lacking a stone, they fetch one from the nearest known outcrop with stones within their exploring range if they can be back before dusk less their margin, as for an axe; otherwise, and once the budget is spent, they take their walk or rest as under Leisure. A finished practice axe is held as their axe if they have none, else as a spare for sale; if they hold both, they take it apart, `dismantled`, and its stone and `axeWood` are back in hand for the next try. A dismantled axe counts as an attempt that worked: it gives experience, can make its technique known and can bring an idea. (Added by the owner after the first measurement, in which practice stopped once a person held an axe and a spare, as an implementation rule had it, so that people practised two to four hours a year. A member who comes to need an axe for their hut while a practice axe is in progress finishes it under priority 8, outside the budget, rather than leaving its stone and wood stranded.)


**Founders.** At creation each founder's experience is `founderForageHours · 3,600 · forageLearn / 1,000` for foraging, likewise for wood, and `founderCraftHours · 3,600 · craftLearn / 1,000` in each technique known; every founder knows the flaked axe, and the tranchet and ground axes by the talent stream's draws; a founder has the idea of every technique they know and of no other. Skills, rates and proficiencies are then set as at midnight.

**Who knows what.** A person knows their own experience, skills, ideas, techniques and talents, and nobody else's. They see an axe's technique when they acquire it.

## People

Each person is one object: sex, height, weight, grip, the five trait scores and their derived quantities; three talents; position, task record, energy and water with their remainders, carried food lots, carried wood, carried log, stones, axe with its technique, hut, group, experience with its remainders, the ideas and techniques known, minutes practised today, the seconds worked today, skills, rates and proficiencies, the **store**'s food lots, and alive. Its memories are typed arrays, bitsets and maps inside it, never read by the checker as truth.

Founders are `founders` people, 40 by default, placed from their own streams within the central `startAreaCm` (800 m) on walkable grass or dirt of the main land, with Life 11's spacing when `scattered`, or at the nearest valid camp when together. They arrive on the first day of the berry season with fifteen years of foraging and wood experience and the axe techniques they know, as under Skills and techniques. Everyone starts with 66,000 kcal, no water deficit, nothing carried, an empty store and no ties: they are strangers.

## Tasks

| Task | Ends when | Rates per hour (kcal, ml) |
| --- | --- | --- |
| Walk | Route's last segment arrives | the person's walking rates |
| Pick berries, gather nuts, fish | Carried reserve room is full, the stock at the current rate is exhausted, or the person's return before dusk is due | the person's picking rate |
| Gather nuts for the store | The nuts carried weigh the person's load capacity at `nutKcalPerKg`, the stock at the current rate is exhausted, or the person's return before dusk is due | the person's picking rate |
| Eat from the store | Carried reserve room is full or the store is empty; at the hearth only | the person's resting rate |
| Drink | Deficit is below `drinkStopMl` | the person's resting rate |
| Gather wood | The person's load is full or the stock is exhausted | the person's gathering rate |
| Cut a log | `logChopMinutes` scaled by axe quality | the person's chopping rate |
| Make an axe | The technique's hours scaled by the maker's proficiency, pausable; a failed attempt ends at its break; a practice stint ends when the day's practice budget is spent | the person's making rate |
| Rest | One hour, or an interruption | the person's resting rate |
| Sleep | Dawn, or severe thirst | by hut and fire, as Life 11, scaled by weight |

Gathering nuts for the store produces at the person's nut rate, as gathering to eat does. Eating from the store moves `storeKcalPerHour` an hour from the store's oldest lots into the person's carried lots, which are eaten at the next wake-up. Water loss is `waterBaseMlPerDay/1,440` a minute plus `waterExtraMlPerKcal` per kcal above the person's resting rate, with Life 11's exact remainders. Eating happens at wake-ups, oldest lots first, up to reserve capacity.

## A wake-up

1. Pay the body for the minutes since the last wake-up, at the ended task's rates for this person; credit what the task produced and the seconds worked; record the task's events. A finished axe draws its quality; a broken one loses its stone; either may give an idea. If a fatal threshold was crossed, record the death at that minute and stop.
2. Spoil carried lots past their life; eat oldest first up to reserve capacity.
3. At the hearth, put every carried nut lot into the store, recording it.
4. Observe: survey the still landscape if the person has moved far enough, and always what changes. Meet people within talking distance: count time together, found or join a group, hear terms, exchange wood for food at the agreeableness price, ask for food or wood still needed, request or promise an axe, deliver hut logs, contribute to the group's fire.
5. Update needs: hunger with the person's own satiation level, thirst with the person's own thresholds, wood need with the person's own stock target, store need with the person's own store target.
6. Choose the next task by the priorities below, using only memory; a new axe chooses its technique and draws whether the attempt will work.
7. Start it: if it is a walk, take a remembered way or plan one, and remember a new way; schedule its end and its first body threshold; record the task start with how the walk was found.

## Priorities

Choose the first applicable rule. "Before dusk" means before dusk less the person's margin. "No need" means not hungry, not short of wood and no store need.

| Priority | Condition | Action |
| --- | --- | --- |
| 1 | Severe thirst, day or night | Drink at a reachable bank, else walk to the nearest known accessible bank, else explore for water. No margin applies. |
| 2 | Away from home and night, or the walk home would end after dusk less the margin | Walk home by the known route; explore to recover one if there is none. |
| 3 | Night | Sleep. Ordinary thirst waits; severe thirst wakes. |
| 4 | Thirsty in daylight | Drink or seek water, leaving time to return before dusk; if no eligible bank is known, search a frontier; if too late, return home or rest. |
| 5 | Carrying a log | Take it home. |
| 6 | Not hungry and filling or carrying a wood load or a store load | Finish the person's load, or take a full load home. |
| 7 | No need, without a group | Approach the nearest seen person, or else the nearest known flag, within the person's company radius; otherwise go on to priority 9. |
| 8 | A member with no need | Finish an axe; otherwise cut hut logs if equipped; otherwise buy a worthwhile known axe or make one by the known technique that costs least work per log, fetching a stone and wood first. |
| 9 | No need | Explore the nearest frontier if it lies within the person's exploring range of home. Otherwise, at home: practise while today's practice budget lasts (under Skills and techniques); then, once a day, walk out along a remembered way from home (below); else rest. Away from home: walk home to rest. |
| 10 | Food, wood or store needed | Hungry or short of wood: choose productive gathering, the store (for food) or an advantageous local exchange; search if no remembered source is worth working; otherwise rest with the reason recorded. Otherwise, with a store need: gather nuts for the store at the best expected hazel place; if no hazel place is worth working, the store need does not hold the person, and rules 7 to 9 decide. |

Food choice scores one hour's expected food at a remembered place as `3,600 * rate / (estimatedWalkSeconds + 3,600)`, from the place's expected stock, under Knowledge and perception. The person's store is scored the same way, at the walk home and `storeKcalPerHour`, if it holds food and the food is to eat, not to pay with. A store load is chosen by the same score at the person's nut rate among hazel places expected to hold nuts. Work must leave time to return home before dusk less the margin, except drinking under severe thirst.

## Food, wood, shelter and exchange

As Life 13, with each person's own quantities: food in timestamped lots by kind, berries spoiling after 48 hours, nuts after `nutShelfLifeHours` (8,760) and fish after 24, in the hand or in a store; energy starting at 66,000 kcal, capped at 70,000, hungry below 64,000 and satisfied at the person's own level; wood need below one night's firewood, cleared at the person's own stock; store need below the person's own store target, under Seasons, harvests and stores; loads up to the person's capacity and logs of 35 kg; groups founded by two ungrouped people within 20 m, joined by a lone person, with a flag, a common fire burning 1 kg an hour at night, and a 23-log hut per member weathering a log every 60 days; axes attempted by technique from one stone and 1 kg of wood, a broken attempt losing its stone, cutting a log in 30 minutes at quality 100, as under Skills and techniques; rates from experience; wood-for-food swaps at the agreeableness price; axes asked at the maker's extra energy and valued by the logs they will still cut. Since Life 16, food and wood are also given when asked for, by the rules under Ties, from what is carried, never from a store. There is no money, no ownership of water, no forced or unasked sharing, no taking from another's store and no planned specialisation.

## Defaults and configuration validation

Run settings are unchanged:

| Setting | Default | Range |
| --- | --- | --- |
| `seed` | 20260813 | any integer |
| `daysPerYear` | 90 | 8 to 365 |
| `worldKm` | 4 | 1 to 10 |
| `founders` | 40 | 1 to 1,000; the page allows 1 to 100 |
| `scattered` | true | |

New and changed parameters:

| Parameter | Default | Basis |
| --- | --- | --- |
| `arrivalPerMille` | 330 | Founders arrive about 19 July, the first day of the berry season. Year-anchored. |
| `berrySeason` | 330 to 450 per mille | Bilberries ripen from mid-July to late August in northern Europe. Year-anchored. |
| `nutSeason` | 450 to 580 per mille | Hazelnuts fall from September to mid-October. Year-anchored. |
| `berryThicketKcalPerYear` | 5,400 | 9 kg on 452 m², 200 kg a hectare: a good wild bilberry patch (calibration, Food). Per 365 days. Replaces `berryThicketRegrowthKcalPerYear` (54,000). |
| `hazelThicketKcalPerYear` | 150,000 | 60 kg in shells on 0.126 ha, 477 kg a hectare (calibration, Hazel and the lake). Per 365 days. Replaces `hazelThicketRegrowthKcalPerYear`, same value. |
| `poorYearPerMille`, `goodYearPerMille` | 250, 250 | A poor and a good year each about one year in four. Judgement. |
| `berryYearPerMille` | poor 500, normal 1,000, good 1,400 | Berry crops vary less than nut crops. Judgement. |
| `hazelYearPerMille` | poor 300, normal 1,000, good 1,600 | Hazel's heavy and light years (calibration [31]). Judgement within the observed swing. |
| `berryLossPerMille`, `nutLossPerMille` | 48, 48 | Half of what lies on a thicket is gone in 14 days (median removal of fallen hazelnuts, about 14 days). Day-anchored. |
| `nutShelfLifeHours` | 8,760 | A year: dry hazelnuts in their shells keep about that long. Was 4,380. |
| `storeKcalPerDay` | 2,500 | A day's food for the 60 kg reference body, scaled by weight. Day-anchored. |
| `storeKcalPerHour` | 6,000 | Cracking and eating stored nuts, about 2.4 kg in shells an hour, faster than gathering them. Judgement. |

`fishGrowthPercentPerYear` (40) keeps its value, now per 365 days. Removed: `berryThicketCapacityKcal` and `hazelThicketCapacityKcal`, now derived from the good-year crop, and the two regrowth parameters above.

Parameters added by Life 17, unchanged:

| Parameter | Default | Basis |
| --- | --- | --- |
| `skillFloorPercent`, `skillCeilingPercent` | 50, 150 | Life 9's practice range, now the range of the experience curve. |
| `forageHalfHours` | 16,000 | About an average founder's fifteen years of foraging: the average founder picks at the base rate. |
| `woodHalfHours` | 5,000 | As above, for an hour of wood a day. |
| `craftHalfHours` | 300 | Hundreds of hours to learn knapping (Pargeter et al. 2020; Stout 2002). |
| `transferPerMille` | 300 | A third of other craft experience helps a technique (Khreisheh 2013, direction). Judgement. |
| `experienceHalfYears` | 10 | Skill decay over years (Arthur et al. 1998, magnitude). Year-anchored. |
| `talentRule` | base 1,000, effect 250, low 250, high 1,750 | One spread more talented learns a quarter faster. Judgement. |
| `founderForageHours`, `founderWoodHours`, `founderCraftHours` | 16,425, 5,475, 150 | Fifteen years at three hours and one hour a day; about a hundred axes made in a life before. |
| `founderTranchetPerMille`, `founderGroundPerMille` | 250, 100 | Some founders bring the better techniques with them. Judgement. |
| `axeTechniques` | flaked 1 h, 10 logs; tranchet 2 h, 30 logs, needs flaked; ground 50 h, 200 logs, needs flaked | Calibration, Making an axe; the tranchet axe is an estimate. |
| `attemptHalfPercent` | 15 | Half of attempts work at 15 points above the skill floor; five in six at a founder's flaked axe. Judgement. |
| `inventPerMillionPerHour` | 556 | About one idea in 1,800 hours of axe work, year-anchored, at average openness. Judgement. |
| `opennessInventRule` | base 1,000, effect 1,000, low 0, high 3,000 | One spread more open has ideas twice as often; one spread less, never (Feist 1998, direction). |
| `practiceMinutesPerDay` | 60 | An average person practises an hour a day when nothing is needed. Day-anchored. Judgement. |
| `conscientiousnessPracticeRule` | base 1,000, effect 750, low 0, high 3,000 | One spread more conscientious practises 1¾ hours (Zell and Lesick 2022, direction). |

Parameters added by Life 16, unchanged:

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
| `leisureWalkDays` | 7 | A leisure walk at most once a week, set by the owner to save computation. Judgement. |
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

Validation rejects an `arrivalPerMille` outside 0…999; a season whose start is not below its end or whose end is above 1,000; a berry or hazel yield below 0 or whose product with 365 days and the good factor is unsafe; a poor or good chance below 0, or summing above 1,000; year factors below 0, or not rising from poor to good; a loss per mille outside 0…1,000; a `nutShelfLifeHours` below 1; a `storeKcalPerDay` below 0 or whose product with 365 days, the heaviest body and the highest conscientiousness factor is unsafe; and a `storeKcalPerHour` below 1. As in Life 17, it rejects a `skillFloorPercent` below 1 or above `skillCeilingPercent`; a half-experience below 1 hour; a `transferPerMille` outside 0…1,000; an `experienceHalfYears` below 1; founder hours below 0 and founder shares outside 0…1,000; an `attemptHalfPercent` below 1; an `inventPerMillionPerHour` below 0 or whose lifetime product is unsafe; a `practiceMinutesPerDay` outside 0…1,440; `axeTechniques` that are not the three above in order with positive hours and logs, or whose needs do not name an earlier technique; and a `talentRule`, `opennessInventRule` or `conscientiousnessPracticeRule` that fails the rule checks below, or a `talentRule` with `low` below 1. It checks that work rates at the skill floor still exceed resting, as it did at the lowest skill and practice, and that no experience product of a lifetime (a hundred years of full days at the highest talent) is unsafe. As in Life 16, it rejects a `tiesRemembered` below 1 or above 10,000; a negative `trustPerMille` or `refusalGrievanceMinutes`; a `tieFadePerMillion` below 0 or above 1,000,000; and an `agreeablenessGiveRule` that fails the rule checks. As in Life 15, it rejects a `waysRemembered` below 1 or above 1,000; a `wayRecheckMinutes` below 1; a `resurveyCm` below 1 or above `sightRadiusCm`. As in Life 14, it rejects non-integers, non-finite values and unsafe products; settings outside their ranges; non-positive means and spreads; a mean less three spreads that is not positive; correlations outside −999…999; a correlation matrix that is not positive definite by the integer factorisation above; a rule with `low > high`, a negative `low`, or an `effect` whose product with 3,000 is unsafe; and every check that used `bodyKg` or `woodLoad` (such as a log still being movable, and work rates exceeding resting) evaluated at the extreme person: the lightest weight, the lowest load capacity, the highest scaled rates. It also keeps every Life 13 check on the mesh, places, thresholds and placement.

## Invariants and ledger

The checker replays the events of each `stepValley` interval against the state in checked runs, validates immutable geography once, and runs the full set at every midnight.

- **The mesh, once per layout:** as Life 13: winding, areas, neighbours, shores, shore heights, shoreline and heights within tolerance, places and banks on walkable ground.
- **Bodies and traits:** every person's sex is 0 or 1; height, weight and grip lie within three spreads of their sex's mean; trait scores lie within −3,000…3,000; and the stored load capacity, rate table, thirst thresholds, company radius, exchange rule inputs, stock target, satiation level, dusk margin, exploring range and expected share equal those recomputed from the scores and the configuration. None changes during a run.
- Every wake-up's body charge equals the person's own rates for the task over its minutes, with bounded remainders; energy and water at a wake-up equal the lazy functions evaluated there.
- **Ways:** every person holds at most `waysRemembered` ways, no two with the same end points; every way's corridor is a chain of triangles each sharing an edge with the next, every one walkable and known to the person, its first and last holding its end points; numbers are below the person's next way number; last-used minutes are not in the future. Every walk recorded as a way or joined walk stays within the triangles of the way it names. No walk is recorded as `full` (update 068). The checker does not recompute the pieces, the coarse band or the recheck rule; unit fixtures cover them.
- **Leisure:** nobody sets out on two leisure walks fewer than `leisureWalkDays` calendar days apart, and `leisureMinute` is the start of the last one.
- **Ties:** every person holds at most `tiesRemembered` ties, none to themselves or to an id that never existed; familiarity and grievance are not negative; `countedMinute` is not in the future, and `askedDay` is not after today. Where two people each hold a tie to the other with the same familiarity remainder, both have the same familiarity, unless one of them forgot the tie and made it anew. At midnight every value replays from the day before: fading, plus the time together, gifts and refusals recorded that day.
- **Gifts:** the giver's goodwill covered their credit and grievance, and both credits changed by the gift's value at each person's own rate; food and wood conserve across it in the stock and body ledgers. Nobody asks the same person twice in a calendar day. Every refusal for want of goodwill adds exactly `refusalGrievanceMinutes`, and one for want of anything to spare adds none. The checker does not recompute a gift's amount from bodies and loads; unit fixtures cover the amounts.
- **Skills:** every experience and remainder is non-negative and every remainder below its divisor; every talent, `opennessInvent` and `conscientiousnessPractice` equals the one recomputed from the scores; at midnight each experience replays from the day before: fading, plus the seconds worked that day at the matching task times the gain (corrected in implementation: the checker does not recount the seconds worked from the day's task records; it checks that craft seconds by technique sum to the day's making seconds, and replays every midnight within an interval in order, since a checked interval may span many days); and every stored skill, rate and proficiency equals the one recomputed from experience. Experience outside midnight never changes.
- **Ideas and techniques:** every known technique is among the person's ideas; the flaked axe is known by everyone; a technique becomes known only at a successful attempt by it, recorded by `learnt`; an idea is gained only by a founder, by an `idea` event whose invention draw, replayed from its stream and the stint's seconds, fell below the chance, or by buying an axe of that technique. Neither is ever lost while the person lives.
- **Attempts and practice:** every axe begun records its attempt draw, which the checker replays from its stream and proficiency; a broken attempt ends at its break second, loses exactly its stone and returns its wood; an axe in progress by a technique the person does not know is a practice attempt; `practicedToday` never exceeds the person's budget and is cleared at midnight.
- **Axes:** every axe in progress or made is by a technique its maker had the idea of when it was begun; its making time is that technique's at the maker's proficiency then; its quality lies within `floor(P/2)…P` and its logs follow from technique and quality. Every exchange of an axe values it by its logs left.
- **Survey:** each observation is replayed against the rule: it is a survey exactly when the person had no survey point or stood at least `resurveyCm` from it, and the survey point changes only at a survey, to where they stood.
- No person's trip wood exceeds their load capacity.
- Every exchange's price equals the agreeableness price for its two parties, and both gained at it.
- Every person's position at every recorded minute is on walkable ground, and every route segment lies in walkable triangles the person knew when the walk started. Nobody is at two places, and the chunk index agrees with positions.
- Food, wood, logs, stones and axes conserve at every event; fish and thicket stocks replay from losses, crops and takes; water withdrawals equal recorded drinks.
- **Seasons and crops:** each year's crop classes replay from the `harvest:<year>` stream; at every midnight each berry and hazel place's stock equals the day before, less its loss by the rule, plus its window share of the year's crop, capped at capacity, less what people took that day; nothing grows outside a window; capacity equals the good-year crop. Fish growth replays at the 365-day rate.
- **Stores:** every store's lots sum to what was put in, less what was taken and what spoiled, and every lot is younger than its shelf life; a lot enters a store only at its owner's hearth, from what they carried, and leaves only by its owner's eating from the store, or by spoiling; nobody else's event touches it. A dead person's store only spoils.
- **Expectation and store need:** every choice of a seasonal place reads its expected stock by the calendar rule, and every store load and store need follow from the store target recomputed from weight, conscientiousness and the calendar. The checker recomputes the target at each store load; unit fixtures cover the choices.
- The queue holds at most one task end and one threshold per living person; no wake-up is in the past; dead people have none.
- Every decision reads memory only.
- Hunger and thirst hysteresis with the person's own levels, death minute and cause, and group dissolution below two living members follow the stated order.

Events are as Life 17. New events: `harvest` (minute, year, the berry and hazel classes and their factors); `stored` (minute, person, the lots put into the store and its total after); `fromStore` (minute, person, kcal moved from the store to the hand); `storeSpoiled` (minute, person, kcal). A store-load task start records the person's store target and store. The daily summary adds each person's store and store target, and world totals of the day's crops, losses, overflow and fish growth by kind, the food standing on the land by kind, and the food held in stores. It also adds the day's kcal eaten, by source (berries, fresh nuts, nuts from a store, fish), and the day's kcal burned, summed over the living. A lot moved from a store into a person's hand keeps a mark that it came from a store, through gifts too, so eating it counts as "nuts from a store"; the mark changes nothing else. Eaten and burned counts are bookkeeping only and never feed a decision.

## Observer

Label the page **Life 18 · strangers**. The engine runs in a worker thread and the page draws from view copies of its states (update 069): the view copy carries each person's store total and target, the year's crop classes and the day's land totals, and keeps `harvest`, `stored` and `fromStore` events alongside gifts, refusals and exchanges. Everything else in the settings screen, loading card, header and playback is as Life 17.

Crop classes and seasons are named by the observer, never the engine: "a poor hazel year", "a good berry year"; "berry season", "nut season" and "the lean months" from the calendar windows, beside the existing spring, summer, autumn and winter.

- **Header.** The date reads with the season and what is in season: "Day 34 of year 0 · summer · berry season"; in the lean months, "the lean months". From the first nut day, the year's hazel class is shown: "a poor hazel year".
- **Landscape.** Berry and hazel thickets are drawn bare outside their windows and fuller as their stock rises, as now by stock; a hearth whose owner's store holds food shows a small pile, larger with the store.
- **Sky and foliage.** Drawn from the displayed minute's place in the year, counted from the spring equinox, so any year length works. The sun follows the solar declination at 52° N, Mesolithic northern Europe: `δ = 23.44° · sin(2π · yearFraction)`, `sin(altitude) = sin φ sin δ + cos φ cos δ cos H`, with the hour angle `H` zero at the middle of the simulation's day and ±π at `dawnHour` and `duskHour`, so at the equinoxes the sun rises and sets on them. Noon stands at about 61° at the summer solstice, 38° at the equinoxes and 15° at the winter solstice; days last about 16½, 12 and 7½ hours. The sun's direction, its strength, the ambient light and the sky colour (paler in winter, warm while the sun is low) follow it, so winter nights are long and summer evenings light. Only the picture changes: people still keep the simulation's fixed day. Leaves blend through the year: bilberry, hazel and the birches (about half the trees, picked by a hash of the tree's number) open fresh green through April and May, stay green through summer, turn from mid-September (bilberry red, hazel and birch yellow), go brown and fall through October and November, and stand bare from late November to early April as thinner crowns of grey-brown twigs, or bilberry's green stems. Pines stay green. Grass is a little greener in spring and duller and browner from late autumn through winter. Colours and crown sizes are shared uniforms of the leaf materials, recoloured when the year has moved a tenth of a day, so nothing is rebuilt as the year turns.
- **Person panel.** A "Store" row: "Store · 41,000 kcal of nuts, about 16 days (target 72,000)"; the task line reads "gathering nuts for the store" and "eating from the store".
- **History.** "A poor hazel year"; "Forager 7 stored 30 kg of nuts"; deaths keep their cause, with the season: "Forager 12 starved in the lean months".
- **Over time.** The pane is split into four sections, in this order: **Food**, **People** (alive, groups, without a group), **Craft** (axes made by technique, axes sold, huts whole, attempts broken) and **Exchange** (wood costs, wood swapped, hours slept cold). The People, Craft and Exchange charts are Life 17's, regrouped. The Food section replaces "Berries per bush", the nuts, berries and fish taken each day, and the hazel and fish stock percentages:
  1. **Where eaten food comes from.** A pie of kcal eaten by source: berries, fresh nuts, nuts from a store, fish. A choice above it sets the period: this season, this year or the whole run. Each slice is labelled with its share.
  2. **Food eaten each day.** A stacked area of kcal eaten per day by the same four sources, in the pie's colours, with a line for the kcal people burned that day. Where the area falls below the line, the valley is living off its bodies.
  3. **Where the food is.** Lines of food on the land, in stores and in bodies (the energy reserves of the living), by day.
  4. **Energy reserves.** The median reserve of the living by day, a shaded band from the lowest to the highest, and the followed person's reserve as a dashed line; each death is a mark on the time axis, coloured by cause.
  5. **Each year's crop.** One bar per year and kind, berries and hazel: the kcal grown, split into gathered by people, lost on the land, and still standing at the year's end; for hazel, nuts that spoiled in stores are a fourth part, taken from the gathered share.

Unchanged from Life 17: skill levels, the skill card and strip, technique rows, practice and attempts in the panel and history. Unchanged from Life 16: the followed person's tie lines and "Ties" rows, gifts and refusals in the history, and the relationship graph. Unchanged from Life 15: ways drawn as faint lines and the wording for how a walk was found. Unchanged from Life 14: figures scaled to height and weight, the body line and five trait rows, and the exchange line.

## Code layout

- `calendar.ts`: the arrival offset in `dayOfYear` and `yearOf`; season windows; days to the next window.
- `places.ts`: the year's crop, derived capacities, the daily loss and window share; fish growth per 365 days.
- New `src/valley/stores.ts`: the store, its target and need, putting in, eating from and spoiling.
- `perception.ts` or `forager.ts`: expected stock by the calendar rule; store need in the priorities; store loads and the store as a food source in food choice.
- `food.ts`, `tasks.ts`, `wake.ts`: the two new tasks, the weight of carried nuts against load capacity, putting nuts in the store at the hearth.
- `world.ts`, `engine.ts`, `summary.ts`: the `harvest` draw at each year's start, the new events and daily totals.
- `types.ts`, `config.ts`: the person's store, the year's classes in the state, the new parameters, their validation, and the removed ones.
- `invariants.ts`, `replay.ts`: the checks above.
- `src/valleyView/`: the view copy's stores and land totals, season and crop names, the header, bare thickets and store piles, the panel row, the history lines, the Over time pane in four sections with the Food charts (a pie chart and stacked area chart join the shared chart components if they have none), the Life 18 label.
- `SIMULATION_DESIGN_RULES.md`, rule 9, and `docs/ROADMAP.md`, Time: the land's food is day-anchored.
- `docs/CALIBRATION.md`: berry thicket yield, seasons, losses, year classes and nut shelf life.
- `docs/ROADMAP.md`: seasons and stores as step 18, the chief and generations after it.
- `docs/LIFE17_SPEC.md` is removed: this specification replaces it.

Terrain, hydrology and mesh, routes and ways, bodies and traits, skills and axes, ties, and exchange of wood for food (`terrain.ts`, `water.ts`, `mesh.ts`, `routes.ts`, `ways.ts`, `nature.ts`, `skills.ts`, `axes.ts`, `ties.ts`, `trade.ts`) are unchanged. The MVP9 core is unchanged.

## Tests and implementation acceptance

The Life 17 fingerprint suite passes before the engine is changed. Every trajectory changes once the calendar, crops and stores do: this step records new fingerprints for all its configurations. The founders' places, bodies, traits and talents stay as Life 17's on every fingerprint seed. Fingerprints are not updated to conceal a failed rule.

New unit fixtures:

1. Calendar: arrival, berry and nut windows at 90, 365 and 8 days a year, as under Seasons, crops and losses; every window at least one day; days to the next berry window from any day.
2. Day-anchoring: a hazel thicket's crop over a normal year at 90 days a year is 90/365 of its crop at 365, within 1 kcal; a window day grows about as much at either length.
3. Year classes: a draw below the poor chance gives the poor factor, at or above 1,000 less the good chance the good factor; the same seed gives the same classes.
4. Losses: a stock nobody takes halves in 14 days within 1%; nothing grows outside a window.
5. Expectation: an unseen thicket is expected empty outside its window and at the openness share of a normal crop's growth so far inside it; one seen before the window's start is forgotten; one seen since the start is expected as seen, grown by a normal crop's daily shares while the window is open.
6. Store target: grows with days to the next berry season, weight and conscientiousness; the least conscientious target half of the average's.
7. Storing: a person not hungry, with wood and a store below target in the nut season, gathers nuts until their load is full, carries them home and stores them; at the target they stop; outside the nut season with no nuts expected, nobody gathers for the store.
8. Eating from the store: a hungry person with no fresh food worth working walks home and eats from the store; a hungry person beside a full ripe thicket eats there; stored nuts spoil after `nutShelfLifeHours`; nuts eaten from the store, also when given on, count as "nuts from a store", and the day's eaten kcal by source sum to what the living ate.
9. Giving: a person asked for food gives only from what they carry, never from their store.
10. The checker rejects a stock that grew outside its window or by more than its share, a loss that does not follow the rule, a crop class that does not replay from its stream, a store holding food that was never put in, food taken from another person's store, and a stored lot past its shelf life.

The Life 17, 16, 15 and 14 fixtures are kept, with fixtures updated only where seasons now change what a person does: a fixture that needs food on a thicket sets its day inside the window.

Measured once and recorded in the lab notes, on the canonical seed, at the default year, over three years: the year classes drawn; each year's crop by kind and the shares gathered by people and lost; each person's store at the end of each nut season against their target and conscientiousness; the median and range of energy reserves by day of the year; deaths by cause, day of the year and the year's classes; the living at the end of each year; asks, gifts and refusals by season; and days 50 to 59 in 12-hour steps as the worker runs, against update 074's. In the browser: the season and crop in the header, bare thickets in the lean months, a high summer sun and green crowns, yellow-brown birches and hazels in autumn, low winter sun with long shadows and bare birches beside green pines, a store pile at a hearth, the "Store" row and "gathering nuts for the store", a harvest line in the history, the Over time pane's four sections with the Food pie changing with its period choice, and the console clean.

Final validation is `npm run agent:check`.

## Questions for later

- Should wood be day-anchored too, once the valley has its real woodland?
- The valley has none of the spring foods real foragers had: roots, greens, eggs, birds and game. Its lean months are harsher than life until herds (and perhaps roots) arrive. Should roots come with herds, or sooner?
- Are a 14-day half-life for losses, poor and good years one in four each, and hazel's 300‰ to 1,600‰ the right magnitudes?
- Do people ration a store, eating fresh food first and the store only when they must, or do they empty it in autumn? The store competes with fresh food by the same score as everything else.
- Should the store target count the body's reserve, fish and a margin for a poor year? Here it is the days to the next berry season at a day's food, scaled by conscientiousness.
- Should group members share a store, or give from it when asked, and should taking from another's store be possible, as theft? Both wait for conflict and property.
- How dense should hazel be? Here thickets cover about 6% of the valley, which makes it a rich valley for Mesolithic foragers without game.
- Should the default year change now that seasons exist? At 90 days the nut season is twelve days long.
- Day length, cold winters and the extra food and wood a winter night costs: when do they explain something?

The Life 17 questions stand: the strengths of talent, transfer, attempts, invention and practice; breaks early or late; learning by watching or being taught; talent and personality; splitting foraging; chopping and building as craft; specialisation and the spread of techniques; cutting speed by technique; whether a ground axe pays. So do the Life 16 questions on ties, giving and grievance, the Life 15 questions on wayfinding and speed, and the Life 14 questions on the strength of each trait's effect, body mass and survival, strength and chopping, height and speed, and personality changing with age.

## Left out

Day length that changes with the season; cold winters, heat balance and clothing; weather; drying berries and smoking fish, and recipes beyond axes and huts (step 24); roots, greens and game (game at step 21); shared or group stores, giving from a store, taking from another's store, inheritance of a store, and any claim on a thicket (property, step 23, and conflict, deferred); wood anchored by the day and the valley's real woodland; ice on lakes; foraging split into finding, picking speed and judgement; deliberate teaching and children learning (steps 19 and 24); prestige and influence (step 20); kinship and pairing (step 19); offering unasked and sharing a catch; asking strangers; ties deciding group membership, approach or exchange partners; gossip, or knowing anyone's ties, skills or stores but one's own; trails, shared or taught ways, ways blocked by anything, and sight blocked by relief; illness; personality change; wading, swimming and boats; planting.
## References
- Mithen, S. et al. (2001), *Plant use in the Mesolithic: evidence from Staosnaig, Isle of Colonsay, Scotland*, Journal of Archaeological Science: hundreds of thousands of burnt hazelnut shells from one year's harvest.
- Jenike, M. R. (2001), Nutritional ecology: diet, physical activity and body size, in Panter-Brick, C., Layton, R. H. and Rowley-Conwy, P. (eds), *Hunter-Gatherers: An Interdisciplinary Perspective*, Cambridge University Press, pp. 205–238: seasonal weight loss among foragers.
- Binford, L. (2001), *Constructing Frames of Reference*; Kelly, R. (2013), *The Lifeways of Hunter-Gatherers*: forager population densities.
- A seed-fate study of *Corylus mandshurica* in temperate forest (Global Ecology and Conservation, October 2024): 99% of released nuts eaten, median removal about 14 days. To be cited in full in the calibration document.

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
