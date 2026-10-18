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

Pushes to `main` are validated, and once validation passes the static Vite bundle is deployed to [GitHub Pages](https://neolorenzo.github.io/Econ-Engine/).

## Current limits

Government is deliberately narrow and stylized: one flat cash-wealth tax, one Gini objective, no forecasting, and one equalizing transfer rule. There are no other taxes, benefits, public purchases, borrowing, money creation, monetary policy, or welfare/consumption objectives.

## Life: the bottom-up core

A second, separate simulation runs beside the MVP9 economy. It starts from the economy with the fewest institutions: foragers in a valley of bushes and trees that deplete and regrow, each with an energy reserve, living through day and night and deciding only from what they can see and remember. There is no money and no market. Life 9.5, a revision of Life 9, is the current and only version; each step up the [merge document's ladder](docs/MERGE.md#the-ladder) replaces it with the next. In a valley 600 m across, simulated minute by minute, people start scattered and want company: two who meet found a group and plant a flag, anyone who meets a member joins, and members sleep on a ring round their flag, keep one shared fire and swap wood for food only with each other. Firewood is sticks from bushes and branches from trees. New in Life 9, every member wants a hut of its own: a small A-frame hut of 23 logs on the ring round its group's fire. A hut keeps its sleeper a little warm, the fire more, and both together most. Logs can only be cut with an axe: the first cut fells a tree whole, the rest of its logs are cut where it lies, and its stump grows back, and nobody wants an axe for its own sake, only for the logs. An axe is made at home from a stone, picked up at one of the valley's rocky outcrops, and a kilogram of wood. The more axes someone has made lately, the faster they make them and the better they come out, and better axes cut faster and last longer. Axes wear out, and huts lose a log to the weather every ten days, so the need never ends. A member who needs an axe can ask around: a better maker may promise one and sell it for food.

**[▶ Open Life 9.5](https://neolorenzo.github.io/Econ-Engine/life.html)**, also linked from the simulator's top bar. It works like a strategy game you watch but do not control: pause, step a minute, or run from real time up to a day a second; drag to pan, scroll or pinch to zoom from the whole valley down to one person, and right-drag or press Q and E to turn. Everything is drawn at true size: people walk between bushes, pick berries, gather sticks and branches, fell trees and cut them up where they lie, carry logs home on their shoulders, kneel to make axes, and sleep inside huts that rise log by log on a ring round their group's fire. Click a person to follow them and see their hut, their axe and who made it, their craft and what an axe costs them, and the axes they have made, sold and bought. Click a bush, tree, stone heap or hut to inspect it. Click a group's chip, flag or badge to select the group: the camera frames it, each member gets a numbered pin, and a card shows what each member gives the fire and a table of each member's axes and hut.

Details are in the [Life 9 specification](docs/LIFE9_SPEC.md) and the [lab notes](LAB_NOTES.md).

## Direction

The long-term aim is an institution-agnostic engine: markets, taxes, governments and other institutions should emerge from agents' decisions instead of being built in. The [vision document](docs/VISION.md) describes that direction. The [merge document](docs/MERGE.md) records the decision to merge Life Engine into this project and build a new core bottom-up, starting from a band of foragers. Neither is a description of the current model.
