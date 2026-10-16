# Econ-Engine

A deterministic agent-based economy you can watch and inspect in the browser: 100 households, nine firms and a Government, with every cent accounted for. Every run is reproducible from its seed.

**[▶ Open the live simulator](https://neolorenzo.github.io/Econ-Engine/)**. It runs entirely in your browser; there is nothing to install.

Current model: MVP9, multi-tile plots. The [changelog](CHANGELOG.md) records every update.

![The 3D world: a town where each house is a household and bigger houses hold more cash, each firm's building shows its industry, trees and fields surround the town, and the headline numbers float above it](docs/images/overview.png)

## What you can explore

The simulator opens on a 3D town. Each house is a household, from a shack to a villa as its cash grows. Each firm's building fills its plot of land and shows its industry (a market hall for Food, a plant for Utilities, a clinic for Healthcare, a cinema for Entertainment), and its roof shows which firm it is. The Transport depot has its own plot, and Government's domed hall, on the largest plot, stands at the centre. Grass, trees and a ring of forest surround the town; the Scenery switch hides them. The Data overlay switch adds a translucent cash pillar around every house and colours the floor by which firm is cheapest where. Headline numbers float above it. Click anything to inspect it. Each section opens as a panel over the world, which stays live beside it, and "Locate" in a panel flies the camera to that household or firm.

| Section | What it shows |
| --- | --- |
| **Overview** | The day's money circuit between households, firms and Government, a plain-language feed of notable changes, and every market at a glance. |
| **Markets** | The four consumer markets (Food, Utilities, Healthcare, Entertainment): each firm's price, share, sales and wages, a top-down map of who bought where, and price, share and earnings over time. |
| **Households** | Every household's cash before and after redistribution, wages, purchases and employer, searchable and sortable. |
| **Government** | The current wealth-tax rate and how the Government's trials moved it, what it collected and paid back, and inequality before and after. |
| **Experiments** | Longer-run research questions, replayed from day 0 in a background worker without touching the live run. |

![The Markets section: each firm's price and share, the map of which firm is cheapest where, and the firm cards](docs/images/markets.png)

### Research questions

The Experiments section answers each question for the current seed:

- **Does the Government matter?** The adaptive wealth tax against no Government, over 1,000 days.
- **Who wins each market?** How often market leadership changes hands, and each firm's share, price and revenue over 1,000 days.
- **Jobs and wealth over time.** Every household's and employer's 1,000-day trajectory: who stays poor, who gets ahead, and why purchases fail.
- **Small vs large economy.** The same seed at 10 and 100 households, compared per household.

**Across many seeds.** One seed is one random path. The ensembles rerun the scale, Government and competition questions on 4, 8 or 16 seeds in parallel. They report the mean, standard deviation, middle 80% and range of each outcome, with every seed's value one click away.

![An ensemble result: the Government question summarized across 8 seeds](docs/images/ensembles.png)

How each mechanism works and how it was validated is in the [MVP 8 specification](docs/MVP8_SPEC.md), the [architecture notes](docs/ARCHITECTURE.md) and the [validation guide](docs/VALIDATION.md).

## Run locally

```bash
npm install
npm run dev
npm run lint      # oxlint and the Prettier check
npm run format    # apply Prettier
npm run test:run
npm run typecheck
npm run build
npm run check     # lint, typecheck, tests, and build
```

## Model at a glance

- One hundred households have fixed seeded employment and persistent cash.
- Eight competitive consumer firms each employ ten workers and produce 50 units per day; monopoly Transport employs 20 workers.
- The town is a 40×40 grid. Each household lives on one tile; each firm and Government stands on a plot sized by what it is, from 3×2 for a clinic to 5×5 for Government. A trip to a shop is measured to the nearest edge of its plot and costs 1¢ per tile, round trip.
- Households choose by delivered cost within percentage expenditure budgets. Purchases pay firms; contractual payroll is capped by cash and residual profit is taxed explicitly.
- Government acts only after payroll, starts at 0%, and tests seeded 0–100% wealth-tax alternatives.
- Tax rates use integer basis points; liabilities use floor-to-cent rounding.
- Every receipt returns explicitly through deterministic means-tested water filling. Government cannot borrow or create money.
- Money uses integer cents and remains exactly household count × $50 ($5,000 canonically). Live histories remain bounded; finite research harnesses retain full trajectory observations separately.

## Architecture

The pure TypeScript core in `src/sim` owns markets, employment/payroll, Government policy and fiscal transfers, events, metrics, experiments, ensembles, and invariants. React owns controls and presentation only, so the UI never changes economic behavior.

Read the current [MVP 8 specification](docs/MVP8_SPEC.md), [architecture notes](docs/ARCHITECTURE.md), [validation guide](docs/VALIDATION.md), and authoritative [simulation design rules](SIMULATION_DESIGN_RULES.md). Project evolution is recorded in the [changelog](CHANGELOG.md) and [lab notes](LAB_NOTES.md).

## Deployment

Pushes to `main` validate and deploy the static Vite bundle to [GitHub Pages](https://neolorenzo.github.io/Econ-Engine/).

## Current limits

Government is deliberately narrow and stylized: one flat cash-wealth tax, one Gini objective, no forecasting, and one equalizing transfer rule. There are no other taxes, benefits, public purchases, borrowing, money creation, monetary policy, or welfare/consumption objectives.

## Life: the bottom-up core

A second, separate simulation runs beside the MVP9 economy. It starts from the economy with the fewest institutions: foragers in a valley of bushes and trees that deplete and regrow, each with an energy reserve, living through day and night and deciding only from what they can see and remember. There is no money and no market. Life 8 is the current and only version; each step up the [merge document's ladder](docs/MERGE.md#the-ladder) replaces it with the next. In a valley 600 m across, simulated minute by minute, people start scattered and want company: two who meet found a group and plant a flag, anyone who meets a member joins, and members sleep around their flag and swap wood for food only with each other. Each group now keeps a single fire at its flag in place of its members' own. It burns through the night and warms everyone sleeping around it, whoever fed it, and goes out if it runs dry. Members put in any wood beyond the two nights' worth they keep, and wood from their own stock when the fire runs low. By day people see across the whole valley, check the thickets and stands they know rather than sweep the ground, walk more slowly under a load and take a full load home first. They pick berries bush by bush, gather deadwood under the trees, and get better at what they do.

**[▶ Open Life 8](https://neolorenzo.github.io/Econ-Engine/life.html)**, also linked from the simulator's top bar. It works like a strategy game you watch but do not control: pause, step a minute, or run from real time up to a day a second; drag to pan, scroll or pinch to zoom from the whole valley down to one person, and right-drag or press Q and E to turn. Everything is drawn at true size: people about 1.75 m tall walk between bushes, reach into them to pick, stoop under the trees for deadwood, carry a bundle home on their backs and lie down by their hearths at night. Each person is coloured by what they are relatively good at, from cyan for gathering wood to gold for picking, and wears a sash in their group's colour. Each group's base has its fire, a flag, a patch of ground in its colour and a lettered badge you can find from the whole-valley view. Click a person to follow them and see their group, what they carry and how fast it lets them walk, the thickets and stands they know (ringed on the ground, brighter if checked lately), and how practised they are at each task. Click a bush or tree to compare what it really holds with what that person remembers. Click a group's chip, flag or badge to select the whole group: the camera frames it, each member gets a numbered pin you can see at any zoom (held at the edge of the view, pointing the way, for anyone out of sight), everyone else fades, and a card lists what each member is doing, how much wood each has put into the fire and what share of it that is, what each has gathered and swapped, and how long each has slept warm. Only the current step exists; earlier steps live on in git history.

![Life 8 at night: Group A selected and framed, its members asleep round the group's one fire at the flag, each marked by a numbered pin in the group's colour; the followed forager's panel with its group's fire and the wood it has given, and the group card with the fire's state, each member's activity and the start of the table of what each member gives](docs/images/life8.jpg)

**What Life 8 finds.** Everyone feeds the fire, roughly in proportion to what they gather: no member of any group gives less than a quarter of an even share, and the most generous gives about 1.1 times an even share in scattered groups. One fire per group burns a third of the wood that a fire per person did, so people spend less than half as long gathering. But trade in wood almost disappears: spare wood goes into the fire as soon as its gatherer is home, so nobody has any left to sell. When people give only to a fire that is running low, they keep their spare wood, and buy 15% of the wood they burn, more than in Life 7.

Details are in the [Life 8 specification](docs/LIFE8_SPEC.md) and the [lab notes](LAB_NOTES.md).

## Direction

The long-term aim is an institution-agnostic engine: markets, taxes, governments and other institutions should emerge from agents' decisions instead of being built in. The [vision document](docs/VISION.md) describes that direction. The [merge document](docs/MERGE.md) records the decision to merge Life Engine into this project and build a new core bottom-up, starting from a band of foragers. Neither is a description of the current model.
