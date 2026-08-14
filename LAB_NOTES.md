# Econ-Engine lab notes

[CHANGELOG.md](CHANGELOG.md) records what changed in the software. `LAB_NOTES.md` records the reasoning, experiments, observations, trade-offs, and lessons behind those changes.

## Maintenance convention

Every meaningful model, architecture, experimental, or design update should receive a newest-first entry. Use at most one base update number per Git commit. Refinements completed before that commit keep the same base number with a decimal suffix—for example, `003` and `003.1` belong to the same commit family. Allocate the next base number only for a later commit. Preserve the context, observed problem or research question, rationale, important implementation decisions, trade-offs, findings, and unresolved questions. Distinguish verified observations from hypotheses. If the original rationale is unknown, say so rather than inferring intent from the finished code.

## [MVP5-Employment-007.1] - (2026-08-14)

### Observation and analytical purpose

The first employment run produced strong endogenous divergence while conserving exactly $500. Its day-1,000 range of $0.13–$395.87 and cash Gini of 0.828 were striking, but terminal values cannot characterize the preceding path. This refinement therefore observes every day from 1 through 1,000 with no burn-in and makes the day-1,000 state explicitly secondary.

The central distinction is `wealth = completed-day household cash stock`, while `income = daily wage flow`. A household can receive a volatile wage while holding little cash, or accumulate a large cash stock from a persistent income advantage. Both require separate temporal measures.

### Feedback hypothesis and fixed employment

The measured mechanism is:

```text
firm sales → operating earnings → worker wage → household cash
→ subsequent purchasing ability → future firm revenue
```

007.1 does not intervene on this loop or claim causal identification. Fixed seeded employment is useful because each household retains one employer throughout a run, allowing employer performance, wage flow, cash stock, consumption completion, and production utilization to be compared without job mobility changing the mapping.

### Consumption constraints and analytical architecture

The report separates actual-cash failures from category-budget failures and inventory/availability failures. The engine’s decision rule is unchanged; insufficient-funds events now record the already-known cash, budget, and minimum delivered cost so the observer can identify the binding affordability constraint.

The interactive 400-day metrics and 600-event caps remain unchanged. A finite harness collects compact daily observations for exactly 1,000 days and passes them to pure post-run analytics. Exact cash ties receive fractional analytical ranks, not RNG or arbitrary ID tie-breaking. Low-cash thresholds are transparent strict inequalities rather than empirical poverty lines.

### Canonical trajectory findings

For seed `20260813`, cash Gini averaged `0.799`, ranged from `0.040` to `0.873`, and was `0.828` on day 1,000. Daily wage Gini averaged `0.346`, reached `0.658`, and ended at `0.370`. The richest household held an average `75.2%` of the money stock, a maximum `95.3%`, and `79.2%` on day 1,000. The richest two averaged `91.1%`; the richest three averaged `94.1%`.

Rank persistence was highly asymmetric. The Food B worker ranked richest on 961 of 1,000 days, occupied the top three on 99.9% of days, and changed rank only seven times. The Entertainment B worker occupied the bottom three on 93.4% of days and ranked poorest on 431 days, although 534 rank changes show that lower positions were not literally frozen. The Food A worker changed rank 294 times and occupied the top three 58.3% of days, illustrating meaningful mobility below the dominant top position.

Low liquidity was persistent for several workers. The Entertainment B worker spent 97.2% of days below $5 and had a longest below-$5 spell of 760 days; it spent 99.4% below $10. Healthcare B spent 75.1% below $5 with a longest spell of 257 days. By contrast, Food B never ended a day below $10. These are model cash-occupancy statistics, not real-world poverty measures.

### Income, consumption, and unused production

Canonical purchase completion was `58.9%`. Of 16,430 failed desired purchases, 15,676 (`95.4%`) were directly constrained by actual cash, 609 (`3.7%`) by category budgets, and 145 (`0.9%`) by inventory/availability. Prior-day cash strongly stratified next-day completion descriptively: `<$1` cash corresponded to `2.4%`, `$1–$5` to `37.7%`, `$5–$10` to `74.5%`, `$10–$25` to `95.0%`, and `>$50` to `99.5%` completion.

The descriptive Pearson correlation between cumulative wages and mean cash across the ten households was `0.696`; N=10 is tiny and no significance or causal claim is attached. Food B paid $7,498.08 and its worker completed 99.9% of purchases. Entertainment B paid $1,073.05 and its worker completed 16.7%. Transport paid exactly $9,167.44 across its two workers; their combined wages reconcile exactly to its payroll.

Every consumer firm produced 5,000 units. Sell-through ranged from 80.8% at Food B to 30.3% at Entertainment B. Across industries, substantial expiration coexisted with widespread actual-cash failures: this supports the presence of a purchasing-power feedback pattern but does not by itself identify the size of a causal effect.

### Cross-seed observations and limitations

Seeds `77` and `91` also showed severe concentration. Mean cash Gini was `0.827` and `0.844`; mean richest-one shares were `85.0%` and `87.9%`; mean wage Gini was `0.354` and `0.446`; aggregate completion was `51.1%` and `40.3%`. Actual cash accounted for 19,157 of 19,572 failures in seed 77 and 23,745 of 23,880 in seed 91. The richest household identity changed with assignment, but the Food B slot occupied the dominant trajectory in all three tested seeds.

Three deterministic seeds are not a population estimate. Rank metrics describe cash ordering rather than welfare, the cash-bin relationship is descriptive, and employer outcomes jointly reflect geography, prices, household purchasing power, and the fixed assignment. No labor mobility, wage-setting, fiscal response, borrowing, or stabilizer is introduced.

## [MVP5-Employment-007] - (2026-08-14)

### Motivation

Earlier Econ-Engine versions closed the monetary circuit through an intentionally artificial Government mechanism:

```text
household spending
→ firm revenue
→ 100% Government taxation
→ household-specific transfers restoring $50 parity
```

That institution isolated consumer-market mechanics, but it prevented firm performance from affecting household income or persistent purchasing power. MVP5 replaces it with the first production-income loop:

```text
household spending
→ consumer-firm and Transport revenue
→ wages
→ households
```

The research purpose is to observe whether employer performance creates persistent income and wealth differences, whether those differences feed back into consumption and firm revenue, and whether the closed $500 circuit remains stable without parity restoration.

### Employment simplification and information boundary

Employment is deliberately fixed to isolate the income mechanism before building a labor market. Every household supplies exactly one worker; each consumer firm has one worker and Transport has two. A dedicated subseed deterministically shuffles canonically sorted household IDs into canonical employment slots. Employment is independent of spatial placement and runtime market draws and remains fixed after initialization.

There is no unemployment, vacancy, search, employer choice, hiring, firing, quitting, negotiated wage, skill, or productivity heterogeneity. Labor can currently be supplied without a modeled commute. Firms do not observe worker wealth, household income, competitor payroll, or observer inequality analytics.

### Production

Consumer production is now causal rather than exogenous:

```text
daily firm output = worker count × 5 units per worker
```

Every one-worker consumer firm produces five units at the start of the day, preserving ten potential units per two-firm industry. Production precedes consumption and emits a structured event. Unsold goods still expire daily, so each consumer firm must satisfy `produced = sold + expired`.

Transport is the explicit exception. Its two workers participate in employment and wage accounting, but Transport remains an effectively unlimited derived service. No trips-per-worker, fleet, congestion, or labor-capacity mechanism is implied.

### Wage model and pricing timing

Workers are residual claimants on their employer’s daily revenue. This is a minimal circulation mechanism, not a mature empirical wage-setting model. After all consumer markets, Transport activity, inventory closure, and pricing updates, the firm’s entire cash balance becomes its wage pool. A one-worker firm transfers the pool whole. Transport divides its pool evenly, with any indivisible cent assigned through a reproducible seed/day/firm-specific order. Every cent is transferred through an explicit wage event; firms are not cleared by balance reset.

The pricing learner continues to optimize realized pre-payroll operating earnings. In this cost-free MVP, operating earnings equal sales revenue. Wages equal operating earnings, and retained end-of-day firm profit is zero. Payroll occurs only after the learner has consumed the operating result.

### Government, persistent wealth, and circular flow

Government remains architecturally present, but the default firm tax is zero and parity restoration is disabled. Household balances carry forward as prior cash minus consumption plus wages. Wealth divergence is therefore expected and is not an invariant failure.

Category percentage limits remain behavioral constraints derived from the fixed $50 daily expenditure base. Actual cash also binds. There are no category wallets, negative balances, debt, overdrafts, welfare transfers, or guaranteed consumption. Production creates goods, not money; expiration destroys goods, not money. Purchases, Transport fees, and payroll relocate integer cents within the fixed 50,000-cent money supply.

### Canonical 1,000-day findings

For seed `20260813`, cash Gini moved from `0.040` on day 1 to `0.828` on day 1,000, averaged `0.799` across the complete trajectory, and reached a maximum of `0.873`. Day-1,000 household cash ranged from $0.13 to $395.87. Mean end-of-day household cash remained exactly $50 because completed payroll returned all 50,000 cents to households; that aggregate identity did not imply individual equality.

Employer-linked outcomes diverged strongly over the horizon. The Food B worker averaged $374.02 in cash and completed 99.9% of desired purchases. The Entertainment B worker averaged $1.71 and completed 16.7%. These are full-horizon measurements rather than an inference from the day-1,000 snapshot.

Each consumer firm produced exactly 5,000 units over 1,000 days. Food B sold 4,041 and expired 959; Food A sold 3,486 and expired 1,514; Healthcare B sold 1,926 and expired 3,074; Entertainment B sold 1,513 and expired 3,487. Transport performed 23,570 derived trips and distributed its full $9,167.44 cumulative revenue to its two workers. Every firm’s cumulative operating earnings exactly equaled its cumulative wages.

### Cross-seed observations and feedback

Seeds `77` and `91` produced different valid employment mappings and trajectories. Their mean cash Ginis were `0.827` and `0.844`; day-1,000 Ginis were `0.771` and `0.831`. A Food B worker had the highest purchase success in both runs (99.8% and 99.7%), while low-revenue Entertainment employment was associated with substantially lower consumption success.

Across the three observed seeds, employer performance changed worker income, heterogeneous cash constrained later purchases, weaker demand increased expiration, and those sales outcomes fed back into subsequent wages. This is evidence of an endogenous feedback loop over the measured horizon, not a claim of equilibrium or a population estimate.

### Validation and limitations

Same-seed runs reproduced exactly. The canonical and alternate-seed 1,000-day experiments and the 10,000-day stress run preserved non-negative cash, exact production stock-flow identities, zero completed-payroll firm balances, zero Government cash, bounded histories, and exactly $500 total money. Desktop, approximately 390-pixel mobile, and maximum-speed browser checks completed without console errors.

The model still excludes a labor market, commuting, negotiated or fixed wages, non-labor production costs, retained earnings, credit, welfare, taxes, capital, investment, and labor-constrained Transport. Strong concentration is therefore an economic result of this deliberately sparse mechanism, not a claim about a mature real economy.

## [MVP4-Spatial_Competition_Full-006.4] - (2026-08-14)

### Analytical mistake and design response

A market observed at 100/0 on day 1,000 was being described as though it had behaved as a 100/0 market throughout the experiment. This confuses a terminal observation with a temporal property of an adaptive system. A day-1,000 snapshot can coexist with a 1,000-day average near 51/49; neither fact invalidates the other, but they answer different questions.

006.4 therefore adds a permanent design rule: dynamic claims must come from trajectories. The generalized report includes every day from 1 through 1,000, with no hidden burn-in. It measures leading and tied occupancy, mean daily share, cumulative sales share, leadership transitions, leading spells, temporary 100%-share spells, posted and incumbent price distributions, and cumulative/mean zero-cost profit. Ties pause transition detection: `A → tie → B` counts once, while `A → tie → A` does not. Analytics are observer-only and consume no RNG.

### Canonical 1,000-day findings

For seed `20260813` from equal $1 starts:

| Industry | Mean daily A/B share | A/B/tie leading days | Changes | Longest A/B lead | A/B 100%-share days | Day-1,000 snapshot |
| --- | --- | --- | ---: | --- | --- | --- |
| Food | 53.7% / 46.3% | 274 / 228 / 498 | 29 | 26 / 40 | 35 / 10 | 50% / 50% |
| Utilities | 61.5% / 38.5% | 561 / 406 / 33 | 179 | 40 / 39 | 481 / 109 | 20% / 80% |
| Healthcare | 49.4% / 50.5% | 438 / 530 / 32 | 117 | 61 / 48 | 42 / 5 | 90% / 10% |
| Entertainment | 70.0% / 30.0% | 759 / 10 / 231 | 4 | 152 / 9 | 2 / 0 | 70% / 30% |

The Utilities terminal snapshot was materially misleading if read as a run-wide result: B held 80% on day 1,000, while A averaged 61.5%, led on more days, captured 61.5% of cumulative sales, and received 60.8% of industry profit. Healthcare showed the converse form: A held 90% on day 1,000, but the full trajectory was almost even in mean and cumulative share and B led on more days. Entertainment's terminal 70/30 happened to resemble its temporal average, but its 231 tied days and four leadership changes still contain information absent from the snapshot.

Mean incumbent prices in A/B order were Food $1.36/$1.42, Utilities $0.90/$0.88, Healthcare $0.99/$1.00, and Entertainment $0.90/$0.86. Because production cost remains zero, recorded profit equals realized revenue; canonical cumulative A/B profit was Food $8,208.29/$5,883.79, Utilities $5,339.15/$3,448.23, Healthcare $5,262.76/$4,590.90, and Entertainment $6,289.08/$2,511.53.

### Alternate-seed observations and limitations

Seeds `7` and `42` confirm material path and geography dependence. Seed 7 produced persistent B leadership in Food (90.7% of days), Utilities (99.7%), Healthcare (97.3%), and Entertainment (75.4%). Seed 42 was more mixed: B led Food 69.8%, Utilities 54.6%, and Entertainment 70.7% of days, while A led Healthcare 93.2%. Across the three seeds, leadership changes ranged from 2 to 179 and longest leading spells from 9 to 831 days. Temporary 100%-share occupancy ranged from zero to 48.1% for an individual firm; this is reported as occupancy, not monopoly classification.

Three seeds are a compact deterministic comparison, not a population estimate. The full window intentionally mixes early adaptation with later behavior, and no stationarity test, burn-in selection, confidence interval, or equilibrium detector is introduced. These metrics describe the observed horizon without claiming what would occur beyond day 1,000.

## [MVP4-Spatial_Competition_Full-006.3] - (2026-08-14)

### Motivation and market structure

Entertainment showed that geography can create local market power without arbitrary product differentiation. 006.3 tests whether the same friction scales across the modeled consumer economy:

```text
4 spatial competitive industries × 2 firms
+ 1 monopoly derived Transport service
```

Food, Utilities, Healthcare, and Entertainment now share the same delivered-cost, proximity-priority, fallback, finite-inventory, and same-industry public-price experiment architecture. Government and Transport remain off-map.

### Budget model and partial basket

Authoritative fixed category dollars were replaced by a distinct $50 daily expenditure flow base multiplied by integer basis-point shares. Government's $50 household target remains a monetary stock restored after trading; the expenditure base is only the flow basis for behavioral limits. They happen to match numerically but are independently configured concepts.

Food 12.9%, Utilities 6.0%, Healthcare 7.9%, and Entertainment 4.6% derive $6.45, $3.00, $3.95, and $2.30 limits using `Math.round(base × bps / 10000)`. The four shares total 31.4% and are not normalized. The remainder represents unmodeled expenditure categories. Limits are maxima, not category wallets; unused amounts remain household cash.

Transport has no share. Its demand emerges from up to four daily round trips and revenue is separately attributable to the originating industry.

### Findings

At day 300 under canonical seed 20260813, learner incumbents were Food $2.04/$2.04, Utilities $1.36/$1.42, Healthcare $1.21/$1.20, and Entertainment $1.35/$1.10. Final shares were 50/50, 100/0, 20/80, and 50/50 respectively. Industry Transport revenue was $3.52, $4.08, $5.44, and $3.96, totaling $17.00 from 40 trips and 850 round-trip tiles.

Seeds 7 and 42 produced distinct prices, shares, and travel totals. Seed 7 generated $15.44 Transport revenue across 772 tiles; seed 42 generated $15.84 across 792 tiles. The differences show geographically distinct local customer bases and path-dependent learner incumbents, not equilibria.

### Scope

No production costs, production decisions, labor, wages, income, savings behavior, housing, credit, adaptive Transport pricing, roads, congestion, relocation, land values, quality, brands, advertising, or collusion were introduced.

## [MVP4-Spatial_Competition_Full-006.2] - (2026-08-14)

### Problem and root cause

At 100 days/second the browser crashed around 500 simulated days with `DataCloneError: structuredClone ... out of memory`, leaving React's root blank. Every economic day recursively copied the entire accumulated `SimulationState`. Once the 400-metric and 600-event histories saturated, the clone remained near its maximum size and was repeated five times per 50 ms UI interval, causing excessive allocation and garbage-collection pressure.

The runtime audit found no additional unintentionally unbounded history in the interactive state. Metrics remain capped at 400 and events at 600. Per-household counters, firm pricing state, spatial analytics, and current-day records have constant size. The finite research harness intentionally accumulates selected experiment events over its requested horizon and is outside React state.

### Architectural fix

The hot path now performs targeted immutable copying. Household objects and every mutable industry outcome, firm objects and pricing states, Government, and the metric/event array containers are copied once per step. Immutable configuration, industries, fixed coordinate objects, and existing immutable metric/event records are structurally shared. Tests verify that the supplied previous state is not mutated and that shared historical records retain reference identity.

The 100-days/second path still simulates five sequential economic days before publishing one React state. Rendering frequency therefore remains 20 updates per second while every purchase, travel payment, price decision, tax, parity transfer, invariant, and RNG draw executes normally.

### Performance principle and validation

> Once bounded histories reach capacity, simulation cost should depend primarily on model size and daily activity, not on total elapsed simulation age.

The automated 10,000-day stress run completed with exact accounting and stock-flow invariants, 400 metrics, and no more than 600 events. In the test runtime it completed in approximately 1.1 seconds. A separate 1,000-day same-seed comparison produced exactly equal complete states. The real React UI ran to day 2,510 at the 100-days/second setting—five times beyond the former failure point—with $500 displayed, all map entities present, no page overflow, and no console warnings or errors. The available browser surface did not expose precise heap profiling, so validation is limited to sustained execution and the removal of catastrophic whole-state allocations rather than a claimed byte measurement. No economic mechanism changed.

## [MVP4-Spatial_Competition_Full-006.1] - (2026-08-14)

### Problem and research question

Spatial customer switching creates discrete delivered-cost thresholds. A one-cent reduction can leave customer count unchanged, reduce revenue, and be rejected even when a larger reduction would cross several household switching thresholds and raise profit.

> Can competitor-aware, multi-scale price experimentation allow bounded firms to discover profitable pricing regions that local one-cent search cannot reach?

### Information expansion

Entertainment firms may now observe the competing firm's currently advertised sticker price as plausible public market information. They still cannot observe competitor sales, profit, share, internal state, household coordinates or budgets, individual transport costs or choices, counterfactual demand, or observer analytics. Monopoly firms receive no fabricated competitor reference.

### Experiment catalog and current reference

At each sampled experiment opportunity the firm regenerates and deduplicates candidates anchored on its incumbent: ±1 cent, ±5%, ±10%, and −20%. Entertainment also adds competitor match, competitor ±1 cent, and competitor ±5%. Percentage values round to integer cents, the one-cent minimum applies, and the incumbent itself is excluded. Seeded random selection prevents fixed catalog order. Upward candidates remain important because proximity can support a higher sticker price while preserving a lower delivered price for local households.

On every locally settled, non-experimental incumbent day, realised own profit replaces the incumbent reference profit. A following experiment is adopted only when its realised profit is strictly greater than that recent reference; otherwise the incumbent is restored. Historical best profit remains useful for broad discovery but no longer blocks adaptation in a changed competitive environment.

A final 006.1 guard treats a full-stock sellout as direct evidence that a discount is not currently needed to clear available supply. Catalog generation therefore removes every price below the incumbent after a sellout, including competitor-anchored prices that would function as deductions. This does not force an increase: seeded selection may choose any remaining upward experiment, and the ordinary experiment probability is unchanged. The full downward catalog returns after a day in which the firm does not sell out.

### Findings

The broader catalog materially changed paths without producing a single endpoint. From $5/$5 starts at day 300, seeds 20260813, 7, and 42 ended at A/B learner incumbents of $1.72/$1.81, $2.72/$2.71, and $1.88/$1.44, with final shares of 70/30, 20/80, and 20/80. From $1/$8 starts they ended at $1.03/$1.62, $1.48/$2.03, and $1.90/$2.26, with final shares of 90/10, 60/40, and 100/0. Retained events included adopted −20% and competitor +1-cent experiments as well as rejected upward and competitor-anchored experiments.

For the directly comparable canonical $2/$2 start, 006.1 ended day 300 at $2.39/$2.40 with a 50/50 final share, versus the 006 observation of $4.48/$4.56. The trajectory first revisited the earlier region and later adopted broader moves into lower-price regions. These paths demonstrate that larger experiments can leave an earlier local spatial pricing plateau. They do not establish equilibrium or prove every run escapes every plateau. Outcomes remain path-dependent, seeded, and shaped by spatial pricing power.

### Scope

Firms remain bounded experimental learners. They do not know household geography or exact demand, calculate an optimum, respond to market share, observe competitor outcomes, or follow a mandatory undercut/best-response rule. Spatial choice, Transport, Government parity, and control-market institutions are unchanged.

## [MVP4-Spatial_Competition_Full-006] - (2026-08-14)

### Motivation and research question

Perfect homogeneous competition made tiny sticker-price differences dominate household choice. This update introduces travel cost as a real economic friction without changing the learner or firm intelligence.

> How does spatial distance alter competition between otherwise identical Entertainment firms when households minimize delivered cost rather than sticker price?

### Spatial design and delivered price

Ten households and Entertainment A/B occupy unique cells on a seeded, fixed 20 × 20 grid. A deterministic spatial subseed keeps placement from advancing runtime market randomness. Manhattan distance represents one-way tiles and every visit is a round trip. Pathfinding and animation are absent because they are unnecessary for this first spatial question.

```text
delivered cost = product price + (2 × Manhattan distance × $0.02)
```

A closer firm may therefore charge more and remain cheaper delivered. The full cost must fit the $5 Entertainment budget and real cash. Nearest households receive earlier inventory access, seeded ties avoid household-ID priority, and affordable fallback is considered before failure.

### Transport and government parity

Abstract one-unit daily Transport consumption was removed. Successful Entertainment travel creates a separate household-to-Transport transfer. Transport has unlimited capacity, no inventory, zero modeled cost, and an exogenous rate; it has no adaptive pricing.

Geography creates heterogeneous within-day spending. Government taxes all firm cash, including Transport, then makes explicit household-specific transfers back to $50. This artificial stabilizing institution isolates market mechanisms; it is not an empirical fiscal model. There is no hidden reset: within-day inequality, end-of-day parity, and exact money conservation are separately measured and asserted.

### Findings

At day 300, canonical seed 20260813 produced Entertainment incumbents of $4.48/$4.56, final-day shares of 50%/50%, average customer distances of 9.4/8.2 tiles, and $3.52 final-day Transport revenue ($3.57 average across retained days). Seed 7 produced $4.52/$4.32, 20%/80%, and $3.00; seed 42 produced $4.28/$4.37, 50%/50%, and $3.68; seed 99 produced $2.01/$1.97, 100%/0%, and $5.68. These seed-dependent observations show local customer bases and positive pricing power can persist, but do not establish spatial equilibrium or broad realism.

Within-day spending varied by geography, while explicit transfers restored every household to exactly $50. Firms and Government ended at zero, total money remained exactly $500, and Food, Utilities, and Healthcare retained their established pricing boundaries in the 1,000-day run.

### Scope exclusions

This version excludes spatial Food/Utilities/Healthcare, animations, pathfinding, roads, congestion, Transport capacity, adaptive Transport pricing, firm relocation, household relocation, land prices, geography, product differentiation, and competitor-price awareness.

## [MVP3-Entertainment_Competition-005.2] - (2026-08-13)

### Problem

The 005.1 grid showed that symmetric Entertainment learners could synchronize and freeze at $5/$5 even though a unilateral $4.99 test could capture substantially more demand. Accounting remained exact; the behavioral problem was the rule `converged = stop experimenting forever`, which is unsuitable when another adaptive firm changes the environment.

### Design decision

Permanent convergence was replaced with local settlement plus persistent experimentation. Broad price discovery is unchanged. Once locally settled, each firm independently has a 10% seeded probability per simulated day of scheduling a one-cent up/down probe. A probe is adopted only when the firm's own realised profit strictly exceeds its stored incumbent reference profit; otherwise the incumbent is restored. Firms receive no competitor price, profit, market-share, household-balance, or hidden-demand input.

The simulation uses a centralized xorshift32 generator with canonical seed `20260813`. It supplies every stochastic household shuffle, equal-price firm selection, probe-timing draw, and probe-direction draw. The seed and internal generator state are part of simulation state, so the same model, configuration, and seed replay exactly.

> Randomness represents uncertainty, ordering, matching, and search—not missing economic mechanisms.

### Findings

Six sampled 300-day runs covered $5/$5 and $1/$8 starts under seeds `20260813`, `7`, and `42`. The formerly frozen $5/$5 state was escaped: the canonical and seed-7 runs ended with $4.99/$4.98 incumbents, while seed 42 ended at $4.99/$4.99 with one firm temporarily testing $5.00. Thus unilateral probes can be adopted and competitive prices can continue moving; no terminal or equilibrium claim is made.

The $1/$8 runs reached $4/$4 incumbents for all three sampled seeds over 300 days. They continued to generate probe days, but sampled probes did not improve the stored incumbent references enough to be adopted. Equal-price daily sales and shares varied by seed rather than being forced to 5/5.

The four monopoly controls remained centered on their established incumbent optima—Food $15, Utilities $12, Transport $8, and Healthcare $10—while occasionally testing an adjacent cent. Seeded histories differed legitimately across seeds, while repeated canonical-seed runs were exactly identical in state, metrics, events, and cumulative outcomes.

### Stability and scope

The 1,000-day baseline retained exactly $500 total money, zero household Gini, equal $50 household balances, exact daily stock flow, cleared firm/government balances, deterministic same-seed execution, and bounded histories. The change adds no competitor observation, undercut heuristic, best response, marginal cost, product differentiation, additional firm/industry, or stabilizer.

## [MVP3-Entertainment_Competition-005.1] - (2026-08-13)

### Motivation and research question

The default equal-start UI path showed a $5/$5 learner endpoint, while the earlier $1/$8 controlled experiment produced $4/$4. That contrast suggested competitive learner endpoints may depend on initial prices even though the market, households, and pricing code are unchanged.

> How sensitive are the two Entertainment firms' learner convergence endpoints to their initial prices?

### Method

The experiment runs the full Cartesian product of Entertainment A and B starts at $1, $2, $3, $4, $5, $6, $8, and $10: 64 deterministic configurations. The horizon is 300 days. Every run holds ten households, the $5 Entertainment budget, ten units per firm, the unchanged learner and tie rule, full taxation/redistribution, and the existing control starts fixed. It records A/B endpoints and convergence days, whether both converged, final market shares/profits, private final learner states, and control endpoints.

Each `(A=X, B=Y)` result was compared with `(A=Y, B=X)` after exchanging firm labels. No observer result enters pricing strategy.

### Results

Cells show `A endpoint / B endpoint`:

| A \ B | $1 | $2 | $3 | $4 | $5 | $6 | $8 | $10 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **$1** | 5/5 | 1/1 | 2/1.98 | 2/2 | 3/2.98 | 3/3 | 4/4 | 5/5 |
| **$2** | 1/1 | 5/5 | 2/2 | 3/2.98 | 3/3 | 4/3.98 | 5/4.98 | 5/4.99 |
| **$3** | 1.98/2 | 2/2 | 5/5 | 3/3 | 4/3.98 | 4/4 | 5/5 | 5/5 |
| **$4** | 2/2 | 2.98/3 | 3/3 | 5/5 | 4/4 | 5/4.98 | 5/4.99 | 5/4.99 |
| **$5** | 2.98/3 | 3/3 | 3.98/4 | 4/4 | 5/5 | 5/5 | 5/5 | 5/5 |
| **$6** | 3/3 | 3.98/4 | 4/4 | 4.98/5 | 5/5 | 5/5 | 5/4.99 | 5/4.99 |
| **$8** | 4/4 | 4.98/5 | 5/5 | 4.99/5 | 5/5 | 4.99/5 | 5/5 | 5/4.99 |
| **$10** | 5/5 | 4.99/5 | 5/5 | 4.99/5 | 5/5 | 4.99/5 | 4.99/5 | 5/5 |

All 64 cases converged within the horizon. There were no cycles or horizon non-convergence cases. The most frequent endpoint was $5/$5 (20 cases), but the grid also produced $1/$1, $2/$2, $3/$3, $4/$4, and adjacent or near-adjacent asymmetric endpoints such as $2/$1.98 and $5/$4.99. Every equal-start diagonal case converged to $5/$5, while asymmetric starts could land substantially below the $5 demand boundary.

Swapped-start symmetry held exactly across all 64 runs after exchanging A/B labels: endpoints, convergence days, and final market shares matched. No material array-order or state-mutation asymmetry was found.

#### Symmetric starts

Every equal-start configuration—$1/$1, $2/$2, $3/$3, $4/$4, $5/$5, $6/$6, $8/$8, and $10/$10—converged to $5/$5. The observed mechanism is synchronized learning:

```text
same starting price
→ equal-price demand split
→ similar sales and realised profit
→ identical learner updates
→ continued synchronized price movement
→ $5 household affordability boundary
```

At $5/$5, deterministic ties give each firm approximately five sales, so each earns $25 daily revenue. This is a learner convergence endpoint, not evidence of competitive optimality. Under the current household-choice rule, a unilateral $4.99 price could capture substantially more demand; ten sales would yield $49.90 rather than $25. The synchronized learners do not explicitly test that deviation conditional on the competitor remaining at $5 after their private convergence criteria are satisfied.

#### Asymmetric starts

Different starts break synchronization because the cheaper firm initially captures more or all demand. The firms consequently accumulate different realised-profit histories and may stop at different deterministic endpoint regions. Representative results include $1/$3 → $2/$1.98, $1/$5 → $3/$2.98, $2/$6 → $4/$3.98, $1/$8 → $4/$4, $4/$6 → $5/$4.98, and $2/$10 → $5/$4.99.

One- and two-cent differences such as $2.98/$3, $3.98/$4, and $4.99/$5 align with the current integer-cent refinement and adjacent-price stopping behavior. They should not be over-interpreted as distinct economic optima. Swapping A/B starts produced the same results with labels exchanged, including these small differences; no material tie-order asymmetry appeared.

### Why $5/$5 is notable

The $5/$5 endpoint demonstrates that the learner's convergence flag means its own historical adjacent-price search is finished. It does not establish that no profitable competitive deviation exists. The learner was developed in a monopoly environment where realised profit could be treated approximately as a function of the firm's own tested price. Under competition:

```text
my realised profit = function(
  my price,
  competitor price,
  competitor learning path,
  relative timing of experiments
)
```

The optimization environment is no longer stationary, and the firm receives no competitor state with which to reason about conditional deviations.

### Interpretation

The grid characterizes synchronized learning under symmetric starts, divergent histories under asymmetric starts, and multiple path-dependent learner convergence endpoints. A firm's convergence signal can identify its private learning process as locally finished even when a profitable unilateral deviation may exist against the competitor's current price. This is a limitation of the current bounded learner, not an accounting failure. None of the deterministic endpoints are labelled equilibria.

### Stability

Across the experiment, total money remained conserved, household balances remained equal, Gini remained zero, per-firm stock flows remained exact, and deterministic execution remained intact. Food, Utilities, Transport, and Healthcare reached $15/$12/$8/$10 in every grid run. The finding therefore concerns behavioral and learning dynamics, not system or accounting instability.

### Scope

No pricing logic, competitive heuristic, competitor observation, best-response rule, firm information, tie behavior, or economic institution changed. This update only characterizes the existing learner.

### Validation

- 43 tests passed across five files.
- Typecheck, build, and aggregate check passed.
- Desktop and 390px populated matrix checks passed with contained scrolling and no console warnings/errors.
- No deployment was performed.

## [MVP3-Entertainment_Competition-005] - (2026-08-13)

### Context and research question

MVP 2.1 established stable industry-specific demand boundaries without disturbing household equality. Competition is the next controlled asymmetry because it makes realised firm profit mutually dependent while leaving household budgets, supply, taxation, and the pricing heuristic unchanged.

> What behavior emerges when two independently adapting firms compete for the same homogeneous household demand using only their own realised market outcomes?

Competition exists only in Entertainment. Food, Utilities, Transport, and Healthcare remain monopoly controls so unintended cross-market coupling is visible.

### Design and information boundaries

Entertainment has two firms, each with ten daily exogenous units and independent state. A household buys at most one Entertainment unit from the cheapest affordable firm with stock. If that firm is empty, the next-cheapest affordable supplier is considered. Equal prices alternate tied priority by household attempt and rotate the first firm by day, producing a reproducible balanced split without permanent array priority.

Each firm still receives only its own tested price, sales, realised profit, and private learner history. Competitor prices, profits, sales, state, and observer market share are not strategy inputs. No undercut rule or competitive convergence target was added.

System/accounting stability is required; competitive price convergence is an empirical outcome.

### Findings

The controlled experiment started Entertainment A at $1 and B at $8. A initially won all ten sales while moving upward and B moved downward through zero-sale experiments. As their prices crossed, full-market leadership alternated. Both learners identified $4 as their private best-known price: A reported convergence on day 12 and B on day 13. From day 14 onward both posted $4, tied demand split 5/5, each realised $20 daily profit, and observer market share was 50% each.

This endpoint is not the $5 affordability ceiling and is not described as a Bertrand equilibrium. It follows from the existing hill-climbers retaining earlier $40 monopoly-like best profit while later equal-price sharing produces $20. The learners nevertheless stop after their adjacent-price tests under their unchanged private rules.

### Controls and stability

| Control | Endpoint | Day |
|---|---:|---:|
| Food | $15.00 | 23 |
| Utilities | $12.00 | 19 |
| Transport | $8.00 | 12 |
| Healthcare | $10.00 | 14 |

The joint experiment ended on day 23 with every household at $50, Gini 0, and total money $500. A 1,000-day run remained invariant-safe: six non-negative firms, exact per-firm supply/sales/expiration, at most ten Entertainment purchases, zero institutional end balances, bounded histories, equal household cash, zero Gini, and deterministic repetition.

### Validation and limits

- `npm run test:run`: 38 tests passed across four files.
- `npm run typecheck`: passed.
- `npm run build`: passed with the non-failing bundle-size advisory.
- `npm run check`: passed.
- `npm run dev`: served successfully. Desktop and 390px checks confirmed the six-firm market table, populated control/competition results, separate competitor chart series, contained horizontal table scrolling, no page-level or chart overflow, and no console warnings/errors. No deployment was performed.

The market has no differentiation, costs, loyalty, geography, switching, competitor awareness, entry/exit, or stochastic behavior. Competition in additional industries is intentionally excluded.

## [MVP2-Industry_Demand_Boundaries-004.1] - (2026-08-13)

### Context and decision

MVP 2 established that five symmetric markets could preserve a deterministic stable reference economy. The first asymmetry is deliberately limited to fixed industry demand boundaries. This changes the price-learning question without introducing scarcity, household heterogeneity, differentiated taxes, or competition, all of which would add allocation or distribution feedback.

The experimental per-household budgets are Food $15, Utilities $12, Healthcare $10, Transport $8, and Entertainment $5. They are arbitrary research parameters and sum to the unchanged $50 real cash balance. Households remain identical. On a successful day each household buys the same basket, spends the same amount, and receives the same pooled redistribution, preserving exact monetary symmetry.

Budgets now belong to industry definitions and initialize industry-keyed household outcome state. They remain behavioral constraints rather than money. Market logic and `pricingStrategy.ts` are unchanged, and firms receive no information about their boundary.

### Findings

| Industry | Start | Endpoint | Convergence day |
|---|---:|---:|---:|
| Food | $1.00 | $15.00 | 23 |
| Utilities | $2.00 | $12.00 | 19 |
| Transport | $5.00 | $8.00 | 12 |
| Healthcare | $15.00 | $10.00 | 14 |
| Entertainment | $20.00 | $5.00 | 24 |

Starts sampled both below and above relevant boundaries. All five learners independently found their own ceiling by day 24. Final household cash remained exactly $50, Gini was 0, and total money was $500. The 1,000-day run preserved those values and all stock-flow invariants. Reversing canonical industry order did not change household or firm economic outcomes; identical configurations remained deterministic.

### Limitations and validation

The budgets are fixed, homogeneous, and arbitrary. Industries otherwise retain identical demand, supply, firm strategy, tax treatment, and production assumptions. There is still no elastic demand, substitution, endogenous allocation, or competition.

- `npm run test:run`: 31 tests passed across four files.
- `npm run typecheck`: passed.
- `npm run build`: passed with the non-failing bundle-size advisory.
- `npm run check`: passed.
- `npm run dev`: served successfully. Browser verification confirmed the MVP 2.1 header, all five visible budget values in the market table, populated convergence rows at $15/$12/$8/$10/$5, and no console warnings or errors. No deployment was performed.

## [MVP2-Multi_Industry-004] - (2026-08-13)

### Context

Finite supply successfully exposed endogenous wealth divergence, path dependence, and multiple learner endpoints when supply was below demand. Stability is now the highest priority. Returning the single-market default to ten units for ten households restored the stable reference economy: every affordable household could purchase and equal redistribution restored equal balances.

The next expansion is therefore architectural rather than another destabilizing behavioral mechanism. Five simultaneous symmetric industries test whether the engine can grow in breadth while keeping causes and benchmarks legible.

### Research question

> Can Econ-Engine support several simultaneous markets and independently learning firms while preserving a deterministic, analytically known, stable reference economy?

### Main risk

Giving households only one unrestricted $50 wallet and processing markets sequentially would make later industries lose demand whenever an experimental basket exceeded available cash. Industry order would become a hidden economic institution and contaminate each firm's learning path.

### Design decision

The model uses one real household cash balance plus five fixed per-industry spending constraints. A purchase must satisfy both real-cash and industry-budget affordability. The constraints are not money stocks, never enter monetary conservation, and are not depleted by purchases in other industries. This keeps the monetary circuit explicit, makes the canonical markets independent of processing order, preserves the $10 analytical boundary, and lets each firm learn against a stable local result.

### Architecture

The core now iterates reusable `industries` and `firms` collections. Each firm owns private pricing state. Each household owns an industry-keyed outcome record with budget, daily cause, and lifetime counters. Metrics contain five reusable market records; generic events carry industry and firm identity. This avoided five hard-coded engine copies without adding a plugin framework.

A single common supply configuration is applied independently to each industry. The government remains singular: it taxes all firms, pools receipts, and redistributes the pool.

### Stable benchmark

The canonical economy has ten households, five firms, ten units supplied per firm, a $10 budget per household/industry, $50 household cash, and $500 total money. At all firms priced $10, each household spends $50, government collects and redistributes $500, every household ends at $50, and Gini is zero.

### Findings

The controlled varied-start run produced:

| Industry | Start | Endpoint | Convergence day |
|---|---:|---:|---:|
| Food | $1.00 | $10.00 | 18 |
| Utilities | $2.00 | $10.00 | 17 |
| Transport | $5.00 | $10.00 | 14 |
| Healthcare | $15.00 | $10.00 | 14 |
| Entertainment | $20.00 | $10.00 | 19 |

All learners converged by day 19 without knowing the benchmark or other firms' results. Final household minimum, median, and maximum cash were all $50; Gini was zero and total money was $500.

A 1,000-day canonical run kept all five prices at $10 after convergence, every household at $50, Gini at zero, total money at $500, and each market's stock flow balanced. Reversing industry processing order produced identical household outcomes and per-firm pricing state, sales, and revenue. No unexpected canonical instability appeared.

### Stability

The canonical baseline is deliberately stable because supply equals demand and the fixed industry constraints preserve the known affordability boundary. Lower common supply remains available and produces explicit stockouts; its wealth divergence and path dependence are valid experimental outcomes, not model breakage. No hidden lower-supply stabilizer was introduced.

### Trade-offs

- Industries are currently labels over identical mechanics.
- Spending constraints are fixed and imposed, not endogenous allocation.
- There is no within-industry competition.
- Supply remains finite but exogenous.
- Full pooled taxation and equal redistribution remain deliberately artificial.
- This is a controlled architecture/stability test rather than a realistic economy.

### Validation

- `npm run test:run`: 26 tests passed across four files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check`: passed.
- `npm run dev`: served successfully; initial desktop DOM sanity check showed the five-market overview, four charts, experiment control, household inspection, and event ledger with the expected $500 baseline values.
- Populated experiment interaction, approximately 390px viewport, and console inspection were not completed because the in-app browser's URL security policy blocked further localhost actions after the metadata refresh. This is a validation-tool limitation, not an observed application failure.
- GitHub Pages deployment was not performed.

### Lessons and open questions

Collection-based markets and keyed outcomes broaden the architecture without broadening firm knowledge. The fixed-envelope approach is analytically clean but should remain explicit as an institution. Future research can ask when industries should differ, whether household allocation should become endogenous, whether competition should enter one industry first, and how wages/income might replace the redistribution circuit. None belongs in MVP 2.

## [MVP1-Scarcity_Analysis-003.1] - (2026-08-13)

### Context

MVP 1.1 instrumented an eight-unit economy and showed that scarce allocation made household balances diverge. The resulting affordability feedback produced multiple deterministic learner convergence endpoints, including $6.70 from the $2.00 start, even though $10.00 remained the one-day optimum in the initial equal-cash state.

The default exogenous supply is now ten units—one per household—as an explicit stabilization choice. This does not change the pricing learner, reset household cash during a run, or add a hidden price rule. It changes the visible environment constraint so an affordable market can serve every household.

### Mechanism

Under the historical eight-unit configuration, if eight households purchase at price `P`, the firm receives `8P` and equal redistribution returns approximately `0.8P` to each household:

```text
buyer net cash change     = -P + 0.8P = -0.2P
non-buyer net cash change =      0.8P = +0.8P
```

With ten supplied units, every affordable household purchases. The firm receives `10P` and redistribution returns exactly `P` to each household:

```text
buyer net cash change = -P + P = 0
```

Household balances therefore remain $10.00, pre-market affordability depends only on the tested price, and the realised price→profit function is stationary across affordable default days.

### Revised research question

> Does matching finite daily supply to maximum household demand remove the stockout-driven wealth feedback and stabilize the learner's experimental environment?

### Why no behavioral fix was added

The change does not reset balances, alter pricing in response to stockouts, expose latent demand, or encode $10.00. Ten units are received through the existing explicit supply event and remain configurable. The stabilizer is therefore an overt environment assumption, not hidden strategy logic. `pricingStrategy.ts` and the `decideTomorrowPrice` boundary remain unchanged.

### Instrumentation decisions

- Minimum, median, and maximum household cash expose distributional movement concealed by a stable total.
- Gini summarizes dispersion from balances only. It is zero when balances are equal or all zero and never feeds back into behavior.
- Market-open affordability is captured before queue processing, separating the number able to pay from supply and realised sales.
- Cumulative household purchases, stockouts, and affordability failures live on household state because the event ledger is intentionally bounded.
- Pre-market and end-of-day distributions are both snapshotted so a day's causal starting condition is not confused with its result.
- The controlled experiment runner records how starting-price interventions change convergence and final household state while using the normal public engine.

### Controlled experiment methodology

The current experiment grid uses starting prices of $1.00, $2.00, $4.00, $6.00, $8.00, $9.00, $9.50, $10.00, $11.00, $15.00, and $20.00. Every run uses a $1.00 initial search step, ten daily food units, identical $10.00 household balances, the same rotating allocation, 100% taxation, equal redistribution, and the unchanged deterministic learner.

The maximum horizon was 300 days. A run stopped only when the existing learner reported convergence or the horizon was reached. Non-convergence would be returned as a distinct null result rather than converted into a price. Collected outputs included starting and converged price, days, final minimum/median/maximum cash, Gini, affordability at the final posted price, and each household's cumulative purchases and failure causes.

### Results

All eleven sampled runs converged to $10.00 within 19 days:

| Start | Converged | Days | Final cash min / median / max | Gini |
|---:|---:|---:|---:|---:|
| $1.00 | $10.00 | 18 | $10.00 / $10.00 / $10.00 | 0.000 |
| $2.00 | $10.00 | 17 | $10.00 / $10.00 / $10.00 | 0.000 |
| $4.00 | $10.00 | 15 | $10.00 / $10.00 / $10.00 | 0.000 |
| $6.00 | $10.00 | 13 | $10.00 / $10.00 / $10.00 | 0.000 |
| $8.00 | $10.00 | 11 | $10.00 / $10.00 / $10.00 | 0.000 |
| $9.00 | $10.00 | 10 | $10.00 / $10.00 / $10.00 | 0.000 |
| $9.50 | $10.00 | 11 | $10.00 / $10.00 / $10.00 | 0.000 |
| $10.00 | $10.00 | 9 | $10.00 / $10.00 / $10.00 | 0.000 |
| $11.00 | $10.00 | 10 | $10.00 / $10.00 / $10.00 | 0.000 |
| $15.00 | $10.00 | 14 | $10.00 / $10.00 / $10.00 | 0.000 |
| $20.00 | $10.00 | 19 | $10.00 / $10.00 / $10.00 | 0.000 |

Observed: every sampled start reaches the same $10.00 learner convergence endpoint. Every household ends with $10.00, Gini is zero, and cumulative consumption is equal across households within each run.

The historical eight-unit suite produced multiple endpoints ($6.70–$10.00 in the sampled grid) and positive wealth dispersion. Comparing the two fixed-supply configurations supports the explanation that stockout allocation and redistribution generated the moving affordability landscape. Ten-unit supply removes that channel in the homogeneous default world.

### Path dependence

The current ten-unit grid shows no path dependence in learner endpoints across the sampled starts. This result is specific to the stabilizing supply assumption and the current homogeneous, full-redistribution institutions. Lower configured supply still reproduces the historical path-dependent case.

### Trade-offs

- Ten households make individual histories inspectable but limit generalization.
- Deterministic rotation is one allocation institution, not a neutral market-clearing process.
- Supply is fixed, exogenous, and perishable.
- Equal redistribution stabilizes balances only because all ten households buy on affordable default days.
- The world remains a zero-cost monopolist with no production or persistent inventory.
- Results depend on the current bounded one-day-profit heuristic and its $1.00 initial step.
- Ten-unit supply removes stockout scarcity from affordable default days, although supply remains finite.

### Validation

Pure analytics tests cover even-population medians, equal and unequal Gini benchmarks, distribution summaries, and order-independent affordability. Engine-level tests verify pre-market timing, historical state boundaries, cumulative outcome increments, persistence, and reset. Experiment tests verify reproducibility, fixed non-intervention settings, explicit horizon behavior, complete cumulative histories, and the unchanged strategy boundary.

`npm run test:run` passed 41 tests across four files. `npm run typecheck`, `npm run build`, and `npm run check` passed; the build retained Vite's non-failing chunk-size advisory. The controlled ten-unit suite produced identical results on repeated execution. Desktop and populated 390-pixel mobile checks confirmed the ten-unit default, ten sales on the first affordable day, zero Gini, all eleven $10.00 experiment endpoints, no page-level overflow, and no browser console warnings or errors. GitHub Pages deployment was not attempted.

### Lessons

- A visible environment parameter can stabilize a model without modifying agent strategy.
- Matching maximum supply to homogeneous demand prevents the allocation feedback that previously moved affordability.
- Observer analytics make the stabilization testable: min/median/max remain equal and Gini remains zero.
- The historical eight-unit result remains useful as a controlled comparison rather than something to erase.

### Open questions

- How sensitive is stabilization to supply below ten?
- Would heterogeneous household demand or a different redistribution institution reintroduce wealth divergence?
- Should future comparisons treat supply quantity as the explicit intervention?

## [MVP1-Finite_Supply-003] - (2026-08-13)

### Context

MVP 0 had reached a useful baseline: the browser simulation was deterministic, monetary transfers conserved every cent, the bounded learner could be inspected through strategy state and raw events, and the unlimited-supply analytical benchmark was covered by tests. Its assumptions and failure modes were sufficiently understood to introduce one additional constraint without simultaneously changing production, household demand, taxation, or price learning.

The unlimited-food world made quantity sold a pure affordability result. If every household could pay, ten units always appeared and ten purchases occurred. That design was appropriate for isolating the first learner, but it could not represent physical scarcity or distinguish inability to pay from inability to obtain an available good.

### Research question

> How does the existing price-discovery mechanism behave when quantity sold is constrained by finite physical supply rather than only by consumer affordability?

### Why finite supply was chosen

Finite supply is the smallest environmental change that makes physical quantity constrain the market. A fixed eight-unit daily receipt creates a known gap between ten desired units and available food without requiring a theory of production. It adds one stock-flow identity and one allocation institution while leaving the firm's objective, government circuit, and household desire unchanged.

### Risks identified before implementation

- Sales could become an ambiguous signal: eight sales might mean exactly eight willing buyers or a sold-out market with additional latent attempts.
- Stockout data known by the engine could accidentally leak into the firm's strategy and give it God-view demand information.
- Persistent inventory could introduce additional path dependence and contaminate the isolated price experiment.
- Fixed household ordering could permanently advantage low-numbered households.
- Fake production costs could destroy money or add an unexplained recipient.
- A stockout response in the learner would change behavior at the same time as the environment.
- Adding workers, wages, suppliers, or quantity choice would turn one mechanism into an uncontrolled production model.
- Equal redistribution after scarce allocation could create unequal household balances even though aggregate money remains conserved.

### Decisions and rationale

#### Use fixed exogenous daily supply

The configured integer supply arrives at the start of each day through an explicit event. It is not chosen by the firm and is not described as output from workers, capital, or raw materials. Eight units is the default because it creates two physically unserved households in an otherwise affordable initial market.

#### Expire every unsold unit

Remaining stock moves explicitly to expiration after household attempts. The engine records an expiration event even when the quantity is zero, making the daily stock lifecycle visible. Ending inventory must be zero. This avoids persistent physical-state path dependence while preserving a causal destination for every unit.

#### Rotate purchasing priority

The first household advances by one ID each day and the rest follow cyclically. Across ten always-affordable days with eight units, each household encounters stockout exactly twice. The order is reproducible, explainable from the current day, and contains no unseeded randomness.

#### Separate failure causes

Each household ends the market with exactly one causal outcome. Insufficient funds is evaluated before stock availability so a household that cannot pay is not mislabeled merely because earlier buyers depleted stock. An affordable household receives a stockout outcome only when inventory is zero. This preserves the intended $10.01 benchmark classification.

#### Keep the pricing strategy unchanged and restrict its information

Inventory belongs to the environment. The pricing function still accepts only the current price, units sold, realised profit, and private learning state. It is not passed stockout-failure counts, household balances, the daily-supply parameter, or the analytical benchmark. The engine can report sold-out status in state and metrics without converting it into a new pricing rule.

#### Enforce food accounting directly

Runtime validation requires non-negative integer supply variables, sales no greater than supply, zero ending stock, exact `supply = sales + expiration`, matching household purchase and firm sales counts, and one outcome per household. Money conservation and cleared institutional balances remain unchanged.

### Expected benchmark

For the equal-cash starting state and eight units:

| Price | Sales | Revenue | Causal failures |
|---:|---:|---:|---|
| $9.99 | 8 | $79.92 | 2 stockouts |
| $10.00 | 8 | $80.00 | 2 stockouts |
| $10.01 | 0 | $0.00 | 10 insufficient-funds failures |

The initial-state revenue optimum is therefore $10.00. The learner is not given this result.

### Findings

Verified observation: finite supply caps an affordable first-day market at eight purchases. The remaining two households produce granular stockout events, no food expires, and the firm records $80.00 at a $10.00 price. At $10.01, all ten attempts fail for affordability, all eight supplied units expire, and revenue is zero.

Verified observation: the rotation removes permanent structural priority when households remain affordable. In a ten-day, one-cent scenario, every household experiences exactly two stockouts.

Verified observation: physical inventory itself has no path dependence; every completed day ends with zero available food and the next day receives exactly the configured amount.

Verified observation: household cash does become path-dependent. Equal redistribution gives buyers and non-buyers the same transfer even though only buyers spent money. Consequently, the household population no longer returns to ten identical $10.00 balances after every market.

That monetary distribution changes later affordability and makes the learner's realised one-day profit surface depend on its experiment path. The unchanged learner converges to $10.00 in the tested run beginning at $20.00, but the default $2.00/$1.00-step run converges reproducibly to $6.70. The $10.00 benchmark is still exact for the specified initial state; it is not a stationary guarantee for every subsequent state.

This result was not hidden with a balance reset, credit, purchase-correlated transfer, repeated-price averaging rule, or stockout-based heuristic because each would add or change a mechanism excluded from MVP 1.

### Trade-offs

- Supply is exogenous and says nothing about how food is produced.
- Expiration is a simplifying institution, not an empirical shelf-life model.
- Rotating queue allocation is institutional rather than price- or preference-driven.
- A sellout reveals scarcity to the firm, but MVP 1 does not provide the learner with the exact latent number of affordable attempts.
- Equal redistribution preserves aggregate money but does not restore household symmetry after scarce allocation.
- Production quantity is fixed and cannot respond to prices, sales, or stockouts.

### Validation

The expanded tests verify the analytical table, stock-flow identity, inventory bounds, zero carry-over, distinct failures, causal outcome completeness, deterministic rotation, money conservation, taxation, redistribution, raw-event preservation, historical metrics, reset behavior, and unchanged pricing-action branches.

`npm run test:run` passed 26 tests across two files. `npm run typecheck`, `npm run build`, and the combined `npm run check` all passed. The build retained Vite's non-failing chunk-size advisory. The development server became ready and returned HTTP 200. Rendered browser checks found no console warnings or errors, confirmed the day-one supply, sold/expired, failure, household, and ledger views, and found no horizontal overflow at a 390-pixel viewport. No GitHub Pages deployment was attempted in this update.

### Lessons

- Removing physical inventory carry-over does not remove all path dependence; allocation can transmit history through household balance sheets.
- An analytical one-day optimum and a repeated adaptive-market optimum are different claims and should be tested and labeled separately.
- Failure taxonomy matters for both interpretation and information boundaries: the engine can know more than the pricing agent.
- A zero-quantity expiration event can still be valuable evidence that a lifecycle phase occurred.
- Rotating order solves permanent queue priority but does not equalize economic outcomes when affordability evolves.
- Preserving an unchanged strategy can reveal that an environmental intervention invalidates the stationarity assumptions implicit in its learning path.

### Open questions / next steps

- Should persistent inventory be studied as the next isolated physical mechanism, or would it compound the already observed monetary path dependence too quickly?
- Should a future firm strategy explicitly learn from a sellout signal, and how could that be tested separately from exact latent demand?
- Should competition precede endogenous production?
- How should allocation work once households differ in income, needs, or preferences?
- How can production become endogenous later while preserving explicit physical and monetary stock-flow accounting?
- Should future price experiments hold a price for a documented observation window, and would that be a strategy change or an experimental-protocol change?

## [MVP0-UI_Refinement-002] - (2026-08-13)

### Context

MVP 0 already had a functioning deterministic economy, exact-cent transfers, runtime invariants, convergence tests, agent inspection, four charts, and a granular event ledger. The economic question remained deliberately narrow: can a bounded monopolist discover the revenue-maximising food price through realised experiments while the model conserves money exactly?

This update examined whether the dashboard made that mechanism as easy to follow as the simulation made it to verify. The implementation was economically correct, but several presentation choices obscured the temporal and causal structure of the pricing learner. The work therefore focused on instrumentation and interpretability rather than on adding another economic mechanism.

### Problems and observations

#### An important invariant occupied an analytical chart

The Money Conservation chart was technically correct but analytically uninformative. Total money is a hard invariant: a successful MVP 0 run should keep it at exactly $100.00. The expected chart was therefore a flat line. That flatness is strong validation evidence, but it does not reveal how the economy or learner changes over time.

The distinction is important: validation importance does not automatically imply analytical-visualisation importance. Money conservation still needs to fail loudly in the engine, remain covered by tests, and be visible to the user. It does not need one of four large chart positions when a compact status metric can communicate the same successful state.

#### The learner's adaptation process was not directly visible

Price and profit charts showed the results of experiments, but not how aggressively the firm was searching. The pricing process is more than a mapping from price to profit:

```text
experiment
→ observe realised profit
→ update the best-known price
→ shrink the search radius after failure
→ refine around the candidate optimum
→ test adjacent cents
→ converge
```

The strategy's step size is the search radius in this sequence. It records the transition from broad exploration to increasingly local refinement. Without that history, a user can see price oscillations but must infer why their magnitude changes.

#### One label represented two economically distinct times

At the end of a simulated day, the system contains two relevant prices:

1. the price just tested in the completed household market, which generated the displayed sales and profit;
2. the price selected after observing that result, which will be tested on the next market day.

The earlier headline metric called the second value `Posted price`. Although the supporting text said "Next market day," the main label made it easy to associate that price with the profit from the day just completed. This weakened the intended causal reading of the simulation.

#### The decision symbol did not describe the decision

The Latest Pricing Decision panel always displayed an upward arrow. The prose explanation could say that the firm lowered its price, narrowed its search, or converged, while the symbol still implied an increase. The symbol was consequently decorative rather than informative.

Deriving a correct symbol by parsing prose would introduce a second problem. Human-readable explanations are presentation text; they should be free to change without silently breaking behavioral classification in the UI.

#### Micro-level completeness overwhelmed the default ledger view

The raw event ledger correctly records each household purchase or failed purchase as a distinct causal event. Redistribution similarly produces a transfer event for every household. In a world of ten identical households, this meant that repetitive rows dominated the visible ledger and pushed pricing decisions, firm results, taxation, and convergence out of view.

This exposed a difference between simulation truth and default presentation. The model needs granular evidence for auditability, while the first-level UI needs summaries that preserve the causal sequence.

### Decisions and rationale

#### Keep conservation in validation; use the chart for Search Step

The dedicated Money Conservation chart was removed, but no conservation mechanism was weakened. Runtime checks, simulation tests, and the Total Money headline metric still establish that the closed circuit contains exactly $100.00. The metric now gives a restrained "Invariant satisfied" status.

The freed chart position now shows Search Step. This gives one of the primary analytical views to a variable that should change during learning and then flatten at one cent upon convergence. The chart exposes how the strategy responds to failed experiments and how its exploratory radius contracts.

The engine already stored `priceStepSizeCents` in each daily metric snapshot. The UI therefore reads historical simulation output directly rather than reconstructing a step history from current React state. A new test made that existing data contract explicit by checking the observed 100-, 50-, and 25-cent sequence in an actual run.

#### Make the experiment cycle explicit in the headline metrics

The metrics now present `Last tested price`, the `Daily profit` produced by that experiment, and `Next price` for tomorrow's experiment. The last tested value comes from the latest immutable daily metrics snapshot; it is not inferred from `firm.postedPriceCents`, because that field has already advanced to the next decision by the end of a day.

The intended reading is now:

```text
Last tested price
→ realised profit
→ pricing decision
→ next price
```

Before the first day, the UI reports no last experiment and shows the configured starting price as the next price. This matters because the model's governing rules require explicit time and prohibit agents from reacting to information that does not yet exist. The interface should preserve the same distinction.

#### Expose typed decision actions at the strategy boundary

The pricing strategy now returns a `PriceDecisionAction` alongside its next price, explanation, updated strategy state, and convergence signal. The supported classifications are `increase`, `decrease`, `refine`, `hold`, and `converged`.

Every existing decision branch assigns the action that describes the price decision it already made. The engine stores the latest action, and React maps it to a restrained symbol. The pricing calculations and convergence rules are unchanged.

This keeps three concerns separate:

- the strategy makes the agent decision and classifies it structurally;
- simulation state carries that truthful decision metadata;
- the UI selects a symbol and displays the strategy's prose explanation.

The UI neither reimplements strategy conditions nor parses text. Prose and symbols are downstream views of the same structured result.

#### Preserve raw events and derive grouped display events

The engine continues to emit each `HOUSEHOLD_PURCHASE`, `HOUSEHOLD_PURCHASE_FAILED`, and `TRANSFER_RECEIVED` event. No raw event is removed, coalesced, or mutated.

A pure `groupEventsForDisplay(events)` transformation now creates the visible ledger model. It groups purchase successes and failures by day into a market summary, including the tested price, number of buyers, number of failures, and total spending. It also groups per-household redistribution transfers into a daily total. Important non-repetitive events remain individual rows.

Grouped rows use native expandable details to reveal their source events. The approach follows the principle:

> Preserve micro-level evidence, summarise it at the macro level by default, and allow the user to drill back down.

This was preferred to changing the engine because presentation density is not an economic rule. It was also preferred to deleting individual events, which would sacrifice the audit trail required by the design rules.

### Implementation

The simulation types gained `PriceDecisionAction`, the strategy populated that field along its existing branches, and simulation state retained the latest action for presentation. The numerical decisions themselves were left intact.

The dashboard changed its metric ordering and reads the last tested price and realised profit from the latest `DayMetrics` snapshot. The replacement chart reads `priceStepSizeCents` from the same bounded metric history. A decision-symbol map translates typed actions into the existing visual language.

The event grouping code lives in `src/ui`, outside the simulation engine. It returns display records that retain references to their granular source events. Styling additions were limited to decision states and native expandable event details.

### Trade-offs and constraints

- The update deliberately did not add firms, competition, production, labour, wages, finite supply, price-sensitive demand, new government behaviour, or a new pricing rule.
- The Search Step chart exposes strategy state but does not by itself explain every reversal. The adjacent pricing-decision prose and Price Discovery chart remain necessary context.
- Grouping is based on the current event taxonomy and one homogeneous market per day. A future model with multiple goods, firms, or markets would need grouping keys that include those dimensions.
- Native disclosure controls keep the implementation small and accessible but provide less bespoke interaction than a custom component. That is appropriate for MVP 0.
- The visible ledger remains bounded. Granular events are preserved within the simulation's bounded raw history, not as an unlimited archival store.
- The Total Money status currently reflects the validated simulation snapshot. It is intentionally quiet because a violation should be surfaced as an engine failure rather than styled as an ordinary dashboard fluctuation.

Scope discipline was central. This refinement made the current model easier to understand before introducing more economics, consistent with the governing principle that complexity must be earned.

### Validation and result

The original economic tests continued to pass, including exact accounting, conservation over many days, determinism, convergence from below, recovery from a high-price zero-sales region, and adjacent-cent convergence.

New coverage verified that daily metrics contain the actual step history, strategy branches expose the expected structured actions without changing their next prices, grouped ledgers summarise full-success and all-failure markets correctly, mixed summaries handle success and failure counts, the grouping transformation does not mutate its input, and ten raw purchase events remain present beneath a single grouped display event.

The completed update passed 14 tests across two files, TypeScript type checking, the production build, the combined `npm run check` command, and the GitHub Pages deployment for commit `480b148`.

The resulting dashboard makes three aspects easier to inspect: how the search radius narrows, which price produced the latest profit, and which price will be tested next. The ledger gives pricing and institutional events more prominence without sacrificing household-level evidence.

### Lessons

- Invariants and analytical variables serve different interface roles. A hard invariant may deserve stronger tests and less chart space.
- Agent learning is more interpretable when the UI exposes strategy state as well as outcomes.
- Temporal labels are part of model correctness. A UI can preserve numerically correct values while still obscuring causality if it does not distinguish observed results from future decisions.
- Structured metadata should cross the simulation/UI boundary when presentation depends on the meaning of a decision. Human-readable prose is not a stable behavioral API.
- An event ledger benefits from multiple representations: granular truth for auditability and grouped summaries for routine inspection.
- Interpretability improvements can materially strengthen an experiment without increasing model complexity.

### Open questions and next steps

- Should future chart tooltips pair each search-step change with the structured reason that caused it, or would that duplicate the decision panel?
- Would a compact visual link between Last Tested Price, Daily Profit, Latest Decision, and Next Price further improve causal reading without increasing dashboard density?
- As new event types appear, what grouping contract will preserve stable macro summaries while supporting multiple firms, goods, or transaction prices?
- Should raw event histories eventually be exportable for offline audit, given that the in-browser history is intentionally bounded?
- Before adding the next economic mechanism, the current dashboard should be used to identify whether any remaining convergence behavior is difficult to explain from price, profit, step size, structured decision, and raw events alone.

## [MVP0-Initial_Build-001] - (2026-08-11)

### Context

Econ-Engine began as a blank local project intended to become the working tree for an existing, effectively empty GitHub repository. The only project artifact was a Markdown document of simulation design rules. Those rules established the core philosophy: agents observe locally, decisions follow explicit objectives and bounded strategies, transactions obey strict accounting, aggregate outcomes are derived from micro-events, and complexity is introduced only after simpler mechanisms are understood.

The first implementation therefore needed to do more than display an economic animation. It needed to test a small architectural claim:

> Can bounded economic agents interact through explicit transactions, conserve money exactly, and allow a profit-seeking firm to discover a revenue-maximising price through experimentation using only information available to that firm?

The deliberately artificial MVP world was chosen so that its accounting and expected outcome could be understood completely before production, labour, competition, credit, heterogeneous demand, or shocks were introduced.

### Research question and known benchmark

The world contains ten identical households, each starting with $10.00 and attempting to buy one food unit per simulated day. A single firm has unlimited exogenous food and zero costs. If the posted price is affordable, all ten households buy; above $10.00, none can buy. The government's only role is to collect all daily firm revenue and immediately redistribute it to households, closing the monetary circuit.

This creates an analytically known benchmark:

| Price | Sales | Revenue |
|---:|---:|---:|
| $9.99 | 10 | $99.90 |
| $10.00 | 10 | $100.00 |
| $10.01 | 0 | $0.00 |

The revenue-maximising price is therefore $10.00. This is not a competitive equilibrium: the world contains one monopolist, zero production cost, unlimited supply, and perfectly inelastic unit demand below an affordability boundary. The analytical result exists for developer validation only. Giving the result or household balances to the firm would invalidate the experiment.

### Decisions and rationale

#### Build the simulation core independently from React

The economic engine was implemented as pure TypeScript under `src/sim`, separate from rendering and browser timing. Types define agents, strategy state, events, metrics, and snapshots; the engine owns the deterministic day lifecycle and transfers; the pricing module owns the firm's learning rule; and the invariant module validates state.

This separation was necessary for two reasons. First, economic behavior needed to be tested without mounting a UI. Second, future strategy or institutional changes should not require rewriting charts and controls. React was treated as an observer and clock controller, not as the location of economic rules.

#### Represent money only as integer cents and transfers

The total initial money supply is exactly 10,000 cents. Purchases move cents from households to the firm; taxation moves firm cash to government; redistribution moves every government cent back to households. No phase silently resets a balance or corrects drift.

Runtime checks verify integer and non-negative balances, exact total money, valid price and step sizes, valid sales counts, and zero institutional balances after taxation and redistribution. This made accounting failure an engine error rather than a visual anomaly discovered later in a chart.

The 100% tax-and-redistribution circuit is not intended as a realistic tax system. It is an explicit experimental mechanism that returns purchasing power while wages, dividends, ownership, and production remain outside MVP 0. Similarly, unlimited food is an exogenous simplification, not hidden production.

#### Make phase order deterministic and causally explicit

Each simulated day follows a fixed order: post the previously selected price, process households in ascending ID order, record the firm's result, select tomorrow's price, tax the firm, redistribute government cash, validate, and snapshot.

This ordering prevents accidental foresight. Today's sales cannot change today's price retroactively; the pricing strategy acts only after observing the completed experiment and determines the next day's price. Deterministic household ordering and the absence of randomness make identical configurations reproducible by construction.

#### Let the firm learn only through realised experiments

The firm maintains its own best tested price and realised profit, current step, direction, positive-profit discovery state, adjacent-cent test state, and convergence status. It does not read household balances, inspect an analytical demand curve, or contain a hard-coded 1,000-cent target.

When a realised experiment improves profit, the firm records it as the new best and continues exploring. A non-improving experiment after positive demand has been found causes search to return around the best-known price, reverse direction, and halve the step with a one-cent floor. At the minimum step, both adjacent prices must be tested through actual market days before convergence is declared.

A special bounded rule handles starts above the demand boundary. Before any positive-profit price has been found, repeated zero-sale results cause continued downward experiments instead of false convergence on a zero-profit plateau. Starting at $20.00 can therefore eventually encounter demand and enter normal hill climbing without any privileged information about why sales were zero.

#### Preserve an event ledger as the causal history

Important state changes emit typed events instead of remaining silent mutations. The initial implementation recorded day starts and ends, posted prices, each household purchase or failure, firm results and price decisions, taxation, each redistribution transfer, and convergence.

This event-first approach supports debugging and explanation at both macro and micro levels. Daily metrics summarise the world, while events retain the actions that produced those summaries. Histories were bounded to protect long-running browser performance; MVP 0 was not designed as a permanent archival system.

#### Build the interface as a research dashboard

The dashboard was designed to expose both aggregate learning and individual agents. It included controls for running, pausing, stepping, resetting, initial price, initial search step, and speed; headline metrics for current state; charts for price discovery, profit, quantity, and money; firm and government summaries; all ten household balances and purchase states; the strategy's latest explanation; and recent raw events.

The dark neutral, lime-accented visual system was intended to read as a compact research instrument rather than a game or generic administration panel. Configuration remained deliberately narrow so that interface flexibility did not imply unsupported economic flexibility.

### Implementation

The initial build established the Vite/React/TypeScript application and the `src/sim` modules for configuration, domain types, engine phases, pricing strategy, invariants, and tests. `SimulationState` is advanced through immutable snapshots, and `DayMetrics` captures price, best-known result, step, direction, market outcome, institutional balances, total money, and convergence.

The pricing decision returned its next price and a human-readable explanation generated by the strategy itself. This allowed the UI to state why the firm changed price without reverse-engineering the reason from chart data.

Documentation formalised the model, architecture, analytical benchmark, assumptions, exclusions, and validation procedure. The governing design-rules file was preserved under the repository-friendly name `SIMULATION_DESIGN_RULES.md`. A GitHub Actions workflow ran installation, type checking, tests, and production build before deploying the static artifact to GitHub Pages.

### Trade-offs and constraints

- Unlimited zero-cost food eliminates production, scarcity, inventory, labour, and cost decisions. It isolates price discovery but cannot answer production questions.
- Homogeneous one-unit household demand creates a discontinuous affordability boundary. It is useful for an exact benchmark but is not a general consumer-demand model.
- Full redistribution keeps household purchasing power stable and closes the circuit, but it suppresses distributional dynamics and should not be interpreted as realistic fiscal policy.
- One firm removes competition and strategic interaction. The $10.00 result is a monopolist revenue optimum under the model's assumptions.
- No randomness makes runs reproducible and debugging straightforward, but the model cannot yet study uncertainty or heterogeneous paths.
- Browser-only state makes the application simple and portable but provides no persisted experiments, server-side workloads, authentication, or shared results.
- The learner is intentionally a bounded heuristic. Its value is explainability and empirical discovery, not general numerical optimisation performance.

These were accepted constraints, not missing features to approximate prematurely. The governing principle was to build the smallest economic world whose behavior could be completely understood.

### Validation and result

The initial test suite contained nine passing cases. It verified the exact $5.00, $9.99, $10.00, and $10.01 market outcomes; conservation and cleared government/firm balances across 250 days; non-negative household balances; convergence from $2.00; escape and convergence from $20.00; determinism across identical runs; and stopping after both adjacent one-cent experiments failed to improve the best result.

Type checking, the production build, and the combined validation command passed. The local repository was connected to GitHub, the existing one-line initial README commit was preserved through an unrelated-history merge, Pages was enabled with Actions as its source, and the resulting public site was verified with an HTTP `200 OK` response and the expected title.

The implementation demonstrated that the closed circuit could conserve every cent while the firm independently discovered the known benchmark from both below and above the demand boundary. Just as importantly, the result remained traceable through snapshots, agent balances, strategy explanations, and typed events.

### Lessons

- A small analytical benchmark is valuable because it tests both economics and software architecture. The expected answer is known without becoming agent knowledge.
- Exact accounting is easier to trust when every monetary change is a transfer and conservation is asserted continuously.
- A strategy can remain bounded and explainable while still handling an important failure mode such as a zero-profit plateau.
- Time ordering belongs in the model contract. Separating today's tested price from tomorrow's decision prevents accidental foresight.
- The event ledger and structured metrics serve different purposes: events explain causes; metrics support analysis.
- Explicit simplifications are more useful than partially implemented realism. The first model established extension seams without adding unused economic systems.

### Open questions and next steps

- Which single additional mechanism would change the research question enough to justify the added state and accounting burden: finite production, labour income, or competition?
- Before expanding the economy, which parts of the learner's adjustment path are difficult to interpret from the existing charts and event ledger?
- How should future stochastic mechanisms be seeded and recorded so counterfactual runs remain reproducible?
- When persistent experiment comparison becomes useful, what minimal export or run-record format would preserve configuration, model version, events, and metrics without introducing a backend prematurely?
- How should the artificial redistribution circuit be retired once an endogenous mechanism such as wages or ownership returns firm revenue to households?
