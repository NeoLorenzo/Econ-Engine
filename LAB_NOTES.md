# Econ-Engine lab notes

[CHANGELOG.md](CHANGELOG.md) records what changed in the software. `LAB_NOTES.md` records the reasoning, experiments, observations, trade-offs, and lessons behind those changes.

## Maintenance convention

Every meaningful model, architecture, experimental, or design update should receive a newest-first entry. Preserve the context, observed problem or research question, rationale, important implementation decisions, trade-offs, findings, and unresolved questions. Distinguish verified observations from hypotheses. If the original rationale is unknown, say so rather than inferring intent from the finished code.

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
