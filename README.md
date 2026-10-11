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

A second, separate simulation has started beside the MVP9 economy. It begins from the economy with the fewest institutions: foragers on a landscape of food patches that deplete and regrow, each with an energy reserve, living through day and night and deciding only from what it can see and remember. There is no money and no market. Each step up the [merge document's ladder](docs/MERGE.md#the-ladder) adds one thing and one question. Life 1, the current step, is a band of 40 foragers sharing one landscape.

**[▶ Open Life 1](https://neolorenzo.github.io/Econ-Engine/life.html)**, also linked from the simulator's top bar. The simulation advances in whole hours; the view moves continuously between them, so foragers walk, forage and sleep on screen. Click a forager to follow it, and a bush to compare what a patch really holds with what that forager remembers.

![Life 1: a band of foragers on a grass board after a collapse, most lying grey where they starved, one highlighted forager walking inside the outline of what it can see, with a chart of the band falling from 40 to 6](docs/images/life1.jpg)

The results so far:

- **Life 0, alone.** A forager that knows only what it last saw survives with food supplies just 6–14% above the theoretical minimum. With no one else eating, a remembered patch can only have grown, so stale memory errs in the safe direction.
- **Life 1, a band.** The band does not settle at the number the land could feed. A band of 40, on land that could feed about 20, collapses to 4–8 within two weeks. Hungry foragers spend their days walking to patches others have emptied, and walking costs more than the land regrows. Even knowing every patch's stock does not prevent it.

Details are in the [Life 0](docs/LIFE0_SPEC.md) and [Life 1](docs/LIFE1_SPEC.md) specifications and the [lab notes](LAB_NOTES.md).

## Direction

The long-term aim is an institution-agnostic engine: markets, taxes, governments and other institutions should emerge from agents' decisions instead of being built in. The [vision document](docs/VISION.md) describes that direction. The [merge document](docs/MERGE.md) records the decision to merge Life Engine into this project and build a new core bottom-up, starting from a band of foragers. Neither is a description of the current model.
