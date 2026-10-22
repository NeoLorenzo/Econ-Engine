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
npm run test:ci   # PR profile: correctness tests plus one canonical Life fingerprint
npm run typecheck
npm run build
npm run check     # lint, typecheck, tests, and build
npm run agent:check -- --ci # the PR profile through the logged validation gate
```

In PowerShell, use `npm.cmd run agent:check -- --ci` to preserve the profile argument.

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

PRs run correctness tests, one canonical 30-day Life fingerprint, lint, typecheck, build and the browser smoke check. After merging, `main` is built and smoke-tested before deployment to [GitHub Pages](https://neolorenzo.github.io/Econ-Engine/); the simulation suite is not repeated.

For thorough validation, open **Actions → Validate fast-mode browser responsiveness → Run workflow**. A manual run checks the full suite, including all 21 Life fingerprints, across three test shards. Local `npm run test:run`, `npm run check` and `npm run agent:check` also retain the full suite. Other-seed or configuration-specific regressions may therefore be found during thorough validation rather than on every PR.

## Current limits

Government is deliberately narrow and stylized: one flat cash-wealth tax, one Gini objective, no forecasting, and one equalizing transfer rule. There are no other taxes, benefits, public purchases, borrowing, money creation, monetary policy, or welfare/consumption objectives.

## Life: the bottom-up core

A separate Life core runs beside the frozen MVP9 economy. **Life 11 · water** is the current step of the [roadmap](docs/ROADMAP.md): eight adult foragers live on a generated 4 km square of Mesolithic young-moraine country. Lakes fill hollows and rivers follow the land downhill. People discover banks, drink, fish, gather berries, nuts and wood, form groups, keep shared fires, build huts and make or exchange axes. Every decision uses their own needs, observations and memories.

Water blocks walking. People route through ground they have observed, discover further access by exploring, and can die of dehydration even with food left. Severe thirst can wake a sleeper. Each lake and river reach has its own fish stock. Fixed water levels are an explicit approximation; rainfall, seasons, swimming, water storage and waterborne illness come later. Evidence and estimates are distinguished in the [calibration document](docs/CALIBRATION.md).

**[▶ Open Life 11](https://neolorenzo.github.io/Econ-Engine/life.html)**. Pause, step one minute or change speed; drag to pan, scroll to zoom, and use the whole-land map to move the camera. Follow a person to inspect food, hydration, route, tools, hut and group. Click water to compare its true fish stock with the person's last fishing observation. The knowledge overlay shows observed cells, and **Flow** toggles downstream arrows. People interpolate along recorded route segments, so the display cannot draw a crossing through blocked water.

Fast speeds are best effort: playback yields between minutes to keep the camera and controls responsive. Every minute still follows the same simulation rules.

Details are in the [Life 11 specification](docs/LIFE11_SPEC.md), [validation notes](docs/VALIDATION.md#life-11) and [lab notes](LAB_NOTES.md).
## Direction

The long-term aim is an institution-agnostic engine: markets, taxes, governments and other institutions should emerge from agents' decisions instead of being built in. The [vision document](docs/VISION.md) describes that direction. The [merge document](docs/MERGE.md) records the decision to merge Life Engine into this project and build a new core bottom-up, starting from a band of foragers, and the [roadmap](docs/ROADMAP.md) sets that core's goal: a realistic life, built world first. None of them is a description of the current model.
