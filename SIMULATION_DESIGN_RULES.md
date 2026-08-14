# Agent Econ — Simulation Design Rules

This document defines the core design principles for Agent Econ.

The purpose of the simulation is not to reproduce a real economy in every detail. It is to construct an interpretable artificial economy in which macroeconomic outcomes emerge from the decisions and interactions of bounded agents.

The simulation should prioritize **causal clarity, interpretability, emergence, and internal consistency** over superficial realism.

---

## 1. Agents may only act on information they could plausibly possess

No agent should have a God's-eye view of the simulation unless that information would realistically be available to that type of agent.

An agent's decision should depend only on:

- its own internal state;
- its own historical observations;
- public information available to it;
- information explicitly communicated to it by other agents or institutions.

### Examples

A firm may know:

- its own prices;
- its own sales;
- its own costs;
- its own inventory;
- its own cash;
- its own workers;
- prices publicly advertised by competitors, where appropriate.

A firm should not automatically know:

- every household's willingness to pay;
- the complete demand curve;
- every household's cash balance;
- competitors' private costs;
- the future behaviour of other agents.

A household may know:

- its own income and wealth;
- its own needs;
- prices it can observe in the market;
- firms or products it has encountered;
- public information accessible to households.

A government may have access to substantially more aggregate information through:

- tax receipts;
- benefit systems;
- employment records;
- regulated reporting;
- official statistics.

However, governments should still only observe information they plausibly collect. Where useful, government information should be aggregated, delayed, noisy, or incomplete rather than perfectly real-time.

**Agent knowledge and true simulation state must remain conceptually separate.**

---

## 2. Agents should make decisions locally, not solve the entire economy

Agents should generally respond to their own situation rather than calculate globally optimal outcomes.

A firm trying to determine its price should ask:

> "Did changing my price improve my profit?"

It should not ask:

> "What is the analytical market-clearing equilibrium price?"

Households, firms, banks, and governments should use bounded decision rules based on observable information.

The simulation may know the true optimum for testing purposes. The agents should not.

---

## 3. Objectives must be explicit

Every decision-making agent must have a clearly defined objective or set of objectives.

Examples:

- household → satisfy needs subject to budget constraints;
- firm → maximize long-run profit;
- worker → obtain desirable employment;
- bank → maximize risk-adjusted returns;
- government → pursue explicitly specified policy objectives.

Agents should not make decisions merely because a developer believes that decision would make the economy behave better.

If an action cannot be traced back to an agent objective, constraint, or institutional rule, it probably should not exist.

---

## 4. Behaviour should emerge from incentives rather than be directly imposed

Where possible, macroeconomic outcomes should arise from micro-level behaviour.

Do not directly program:

> "Higher prices reduce demand."

Instead, give households budgets, needs, preferences, and purchasing rules from which lower demand at sufficiently high prices can emerge.

Do not directly program:

> "Competition lowers prices."

Instead, allow households to choose between competing firms and let firms observe the resulting changes in sales and profits.

Do not directly program:

> "A recession begins."

Create shocks or conditions from which declining production, employment, income, and spending may emerge.

Prefer:

**rules about agents**

over:

**rules about outcomes**.

---

## 5. Money must obey explicit conservation rules

Unless money creation or destruction is itself an explicitly modelled mechanism, money may only move between agents.

For every monetary transaction:

\[
\Delta M_{sender} + \Delta M_{receiver} = 0
\]

The total money supply should therefore satisfy:

\[
M_t = M_0
\]

for all \(t\), unless an explicitly modelled institution changes it.

Taxes do not destroy money.

Government spending does not create money.

Purchases do not destroy money.

Wages do not create money.

They transfer money from one balance sheet to another.

The engine should continuously verify monetary conservation as an invariant.

If money creation is later introduced through central banking, commercial bank credit, default, or another mechanism, the resulting change must be explicit and separately measurable.

---

## 6. Every stock and flow must have an identifiable source and destination

The same accounting discipline should extend beyond money.

Examples include:

- food;
- inventories;
- labour;
- debt;
- productive capital;
- ownership claims.

Whenever something appears, disappears, or changes ownership, the simulation should be able to explain why.

Temporary simplifications are allowed—for example, an MVP firm may have infinite exogenous food—but these must be clearly labelled as exogenous assumptions rather than disguised as endogenous production.

Nothing should appear "because the model needed it."

---

## 7. Every state change must have a causal explanation

For any variable at any tick, it should be possible to answer:

> "Why did this value change?"

For example:

> Firm 3 raised its price from 4.20 to 4.40 because its previous upward price experiment increased realized profit.

or:

> Household 7's balance fell by 3.00 because it purchased one unit of food from Firm 1.

The system should favour mechanisms that permit this kind of causal trace.

A graph behaving strangely should be an invitation to inspect the causal chain, not something requiring guesswork about dozens of simultaneous hidden feedback loops.

---

## 8. Time and causality must be explicit

The order of events within each simulation tick must be deterministic and documented.

Agents cannot react to information that does not yet exist.

For example, if firms set prices at the beginning of Day 20, they cannot use Day 20 sales to determine that price. They can only use observations available through Day 19.

This prevents accidental foresight.

Each major mechanism should specify:

1. what the agent knows;
2. when it knows it;
3. when it acts;
4. when the consequences become observable.

---

## 9. Agents cannot use future information

No behaviour rule may use:

- future prices;
- future sales;
- future policy changes;
- future shocks;
- future employment;
- future aggregate statistics;

unless the agent is explicitly forming a forecast.

Forecasts themselves must be based on information available at the time.

The simulation engine may know future scheduled events. Agents do not automatically know them.

---

## 10. Learning must happen through experience

Where agents adapt, they should learn from observations rather than instantly discover correct behaviour.

A firm may:

- experiment with a price;
- observe profit;
- compare it with previous outcomes;
- adjust its future strategy.

It should not immediately derive the globally optimal price from hidden simulation variables.

This allows:

- mistakes;
- overshooting;
- adjustment periods;
- path dependence;
- imperfect adaptation.

These are desirable features when they arise from the model rather than being artificially injected.

---

## 11. Imperfect behaviour is acceptable; inexplicable behaviour is not

Agents do not have to behave optimally.

They may:

- use heuristics;
- learn slowly;
- possess incomplete information;
- make locally rational mistakes;
- become stuck in suboptimal states.

However, their behaviour must remain explainable from their information and decision rules.

"Boundedly rational" is acceptable.

"Random because the graph looked better" is not.

---

## 12. Complexity must be earned

New mechanisms should be introduced one at a time.

A new layer should only be added when the simpler model:

- runs reliably;
- satisfies its accounting invariants;
- produces behaviour that can be explained;
- has appropriate tests;
- has known failure modes.

For example:

1. fixed-price food market;
2. adaptive pricing;
3. competing firms;
4. production constraints;
5. labour;
6. wages;
7. government taxation and spending;
8. investment;
9. credit;
10. multiple industries.

Do not solve a problem in Model N by immediately adding the mechanisms planned for Model N+5.

---

## 13. Every mechanism should justify its existence

Before introducing a feature, answer:

1. What real or theoretical mechanism does this represent?
2. What behaviour is impossible to study without it?
3. What new state variables does it require?
4. What new parameters does it introduce?
5. How will we know whether it works?
6. What assumptions does it make?

If these questions cannot be answered clearly, the mechanism is probably premature.

---

## 14. Never add hidden stabilizers merely to make graphs look sensible

Do not introduce arbitrary:

- price floors;
- price ceilings;
- cash injections;
- forced redistribution;
- inventory resets;
- emergency hiring;
- automatic bailouts;
- artificial trend corrections;

solely because the simulation becomes unstable.

Instability may be a legitimate consequence of the current rules.

If an artificial stabilizer is necessary for an experimental world, it must be represented as an explicit institution or exogenous mechanism and visible in the model.

The simulation should not secretly push itself toward desirable-looking outcomes.

---

## 15. Do not calibrate by aesthetics

A realistic-looking graph is not evidence that the underlying model is correct.

Parameters should not be adjusted merely because they produce lines resembling real economic data.

Calibration should eventually use:

- empirical targets;
- theoretical constraints;
- measured distributions;
- documented assumptions.

Until then, arbitrary parameters should be clearly labelled as experimental.

A strange but explainable result is more valuable than a realistic-looking result produced by opaque tuning.

---

## 16. Separate economic rules from agent strategies

The environment and the agents should be conceptually distinct.

### Economic/institutional rules

Examples:

- ownership determines who receives dividends;
- purchases transfer money and goods;
- taxes apply at specified rates;
- debt contracts require repayment;
- firms cannot sell inventory they do not possess.

### Agent strategies

Examples:

- how a household chooses a firm;
- how a firm changes its price;
- how a worker searches for employment;
- how a bank evaluates a loan.

This distinction makes strategies replaceable without rewriting the economy itself.

---

## 17. Policies should alter rules, constraints, prices, or incentives—not directly dictate outcomes

A policy experiment should intervene on mechanisms.

Good:

> Set corporate tax to 30%.

Good:

> Introduce a minimum wage of 8.

Good:

> Pay unemployed households 4 per day.

Bad:

> Reduce inequality by 10%.

Bad:

> Increase GDP by 5%.

Bad:

> Lower unemployment to 4%.

The policy sets conditions. The simulation determines the consequences.

---

## 18. Aggregate metrics should be measurements, not control variables

GDP, unemployment, inflation, inequality, average wages, consumption, and similar macroeconomic statistics should ordinarily be calculated **from the underlying agent states and transactions**.

They should not themselves drive behaviour unless an agent genuinely observes and responds to that published statistic.

For example, a central bank may react to measured inflation.

An ordinary food firm should not automatically alter prices because the engine's hidden `inflation_rate` variable changed.

---

## 19. Heterogeneity should be introduced only when it represents something

Agents do not need random differences merely to make the simulation appear organic.

Heterogeneity should correspond to meaningful differences such as:

- income;
- wealth;
- productivity;
- preferences;
- household size;
- reservation wage;
- risk tolerance;
- geography;
- information;
- expectations.

Begin with homogeneous agents where possible.

Introduce heterogeneity when the research question requires it.

---

## 20. Randomness must represent uncertainty, not substitute for mechanisms

Randomness may represent:

- search;
- imperfect information;
- idiosyncratic preferences;
- stochastic shocks;
- matching;
- uncertain outcomes.

It should not be used to obscure the absence of a behavioural rule.

Where randomness exists, its role and distribution should be documented.

---

## 21. Runs must be reproducible

All stochastic behaviour must originate from a seeded random-number generator.

Given:

- the same model version;
- the same configuration;
- the same seed;
- the same policy schedule;

the simulation should produce the same outcome.

This is essential for debugging and counterfactual experiments.

---

## 22. Counterfactual experiments should differ only in the intervention being tested

When comparing:

> baseline vs. 20% corporate tax

both runs should use the same:

- initial conditions;
- agent characteristics;
- random seed;
- exogenous shocks;
- simulation length;

with only the intervention changed.

This makes differences between runs causally interpretable.

---

## 23. Every model should have known invariants and known predictions

Before running a model, identify things that **must** be true if the implementation is correct.

Examples:

### Accounting invariant

\[
\text{Total Money}_t = \text{Total Money}_0
\]

### Transaction invariant

A household cannot spend more money than it possesses unless borrowing is explicitly allowed.

### Inventory invariant

A firm cannot sell more goods than it possesses unless unlimited/exogenous supply is explicitly enabled.

Models should also have simple benchmark scenarios where the expected result can be calculated analytically.

For MVP 0, for example:

- 10 households;
- each begins every cycle effectively possessing 10 money;
- each demands one food if affordable;
- firm has unlimited zero-cost food;
- all firm revenue is redistributed equally;
- consumers have no price sensitivity other than affordability.

The known revenue-maximizing price is 10.

The agent's learning algorithm should discover approximately that price without being given the answer.

---

## 24. Failed experiments are part of the simulation

A firm may make a bad pricing decision.

A household may fail to purchase something.

A business may fail.

A government policy may produce unintended effects.

Agents should not automatically be protected from consequences simply because their failure makes the simulation less orderly.

Failure states are information.

---

## 25. The engine should preserve an event ledger

Important economic actions should generate explicit events such as:

```text
HOUSEHOLD_PURCHASE
FIRM_PRICE_CHANGED
WAGE_PAID
TAX_PAID
TRANSFER_RECEIVED
WORKER_HIRED
WORKER_FIRED
LOAN_CREATED
LOAN_REPAID
FIRM_BANKRUPT
```

Each event should contain enough information to reconstruct what happened.

This creates a clean distinction between:

**state**

and

**events that changed state**.

It also makes debugging, visualization, statistical analysis, and later model auditing substantially easier.

---

## 26. The simulation should be inspectable from both the micro and macro level

For any interesting aggregate result, it should be possible to descend into the agents responsible for it.

If inflation rises, we should be able to inspect:

- which firms changed prices;
- when they changed them;
- what information they observed;
- what decision rule caused the change.

If unemployment rises, we should be able to inspect:

- which workers lost jobs;
- which firms fired them;
- why those firms changed employment.

Macroeconomic graphs should be summaries of an inspectable world, not the primary reality of the model.

---

## 27. Simplicity is preferred until additional realism changes the question being studied

A mechanism should not be added merely because real economies contain it.

Real economies contain almost everything.

The relevant question is:

> Does including this mechanism materially affect the phenomenon currently being investigated?

If not, leave it out.

An obviously simplified model whose assumptions are explicit is preferable to an apparently realistic model whose behaviour cannot be understood.

---

## 28. Dynamic behavior must be evaluated over time, not inferred from terminal snapshots

A simulation state at the end of an experiment represents only the state of the economy at that moment. When a variable can fluctuate, cycle, switch regimes, or adapt over time, conclusions about its behavior must be based on its trajectory across the experimental horizon.

Terminal values may be reported as the current state at the observation horizon, but must not be treated as evidence that the system behaved that way throughout the run.

**Experiments should summarize temporal occupancy, averages, and transitions.** For competitive markets, report how much simulated time firms spend leading, tied, or dominated; average market shares and prices over time; cumulative sales and profit; leadership transitions; and dominance-spell duration where useful.

Do not label a market as monopolized, balanced, converged, dominated, or otherwise characterize its long-run behavior solely from the terminal snapshot. This rule applies equally to prices, profits, shortages, inequality, transport utilization, unemployment, output, firm dominance, market share, and any other dynamic state.

---

# Core Philosophy

Agent Econ should follow a simple hierarchy:

**Agents observe locally.**

**Agents decide according to explicit objectives and bounded strategies.**

**Transactions change state according to strict accounting rules.**

**Macro outcomes are measured from those interactions.**

**Complexity is introduced only after simpler mechanisms are understood.**

The goal is not to force the simulation to resemble an economy.

The goal is to define understandable economic mechanisms and then allow the economy to reveal what follows from them.
# MVP7 accounting distinction

Observer-facing accounting must distinguish revenue, contractual labor income, unpaid contractual obligation, residual profit, corporate taxation, and redistribution. MVP7's fixed 100% corporate profit tax closes the current no-capital monetary circuit and is not a learned policy or normative recommendation.
