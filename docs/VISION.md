# Vision: an institution-agnostic engine

This is a direction document, not a specification. Nothing in it is implemented. The current MVP specifications remain authoritative for what the engine does, and the [simulation design rules](../SIMULATION_DESIGN_RULES.md) remain authoritative for how it must be built. This document describes where the engine is meant to go, so later work has a reference point.

## Purpose

Econ-Engine should be able to start from a very basic economy and let institutions emerge from the decisions of individual agents. The engine should not contain a definition of serfdom, a market economy, a tax system or a democracy. Those should be patterns that appear, persist, change or disappear because agents with needs, limited information and bounded learning find them worthwhile, or cannot escape them.

The research questions this serves are:

- Where does institutional change come from?
- Which conditions produce concentrated wealth and coercive labour, and which produce broad prosperity?
- How do collective decisions, such as which policies a government adopts, follow from what individual agents want?

Economics is the first domain because it is the most tractable. The same approach should later extend to politics and culture. Throughout, the engine simulates micro actors and the decisions they take. Each extension gives agents more kinds of decisions, not more scripted outcomes.

## Primitives, not institutions

An institution-agnostic engine contains only primitives. An institution is a recurring combination of them.

Serfdom, for example, breaks down into:

- one agent controls land;
- other agents need land to produce food;
- leaving is costly or prohibited;
- the controller claims a share of output and can sanction anyone who refuses.

None of those primitives is serfdom, but together they are. In the same way, a tax is a transfer demanded by an agent able to enforce it, and a democracy is a group that settles collective decisions by counting preferences.

The central design question is therefore which primitives are fixed by the engine and which are created by agents.

The closest precedent is Sugarscape (Epstein and Axtell, 1996), in which trade, inheritance, culture and conflict emerge from simple agent rules on a landscape. Econ-Engine's contribution would be the same ambition with its existing discipline: exact accounting, bounded agent information and a causal record of every change.

## Layers

| Layer | Contents | Controlled by |
| --- | --- | --- |
| Physics | Scarcity, geography, production technology, bodily needs, births and deaths | The engine, fixed |
| Accounting | Conservation of money and goods; every transfer has a source and a destination | The engine, fixed |
| Rules | Claims, obligations, permissions and sanctions, stored as data | Agents: created, changed and enforced |
| Agents | Needs, beliefs, bounded learning and actions | Act within physics and the current rules |

The engine already enforces the accounting layer strictly. Its main departure from this picture is that several institutions currently sit in the physics layer as hard-coded mechanisms (see [Where the engine stands today](#where-the-engine-stands-today)). Moving them into the rules layer, one at a time, is what makes the engine institution-agnostic.

## Rules as data

Rules should be represented as inspectable data, not as code paths. A suitable representation already exists: the institutional grammar of Crawford and Ostrom (1995). Every rule has five components:

| Component | Meaning | Example |
| --- | --- | --- |
| Attributes | Who the rule applies to | Cultivators of a plot |
| Deontic | May, must, or must not | Must |
| Aim | The action | Deliver 30% of the harvest to the landholder |
| Conditions | When or where it applies | Each season |
| Or else | The sanction for breaking it | Loss of access to the plot |

That example is a feudal due, but the engine would not know that. It is one rule object. The same structure expresses a wealth tax, a tithe, a minimum wage or an inheritance law.

Representing rules this way has three consequences:

- **Institutions stay interpretable.** Every rule has a history: who proposed it, when, through which decision procedure, and with what support. This extends design rules 7 (every state change has a causal explanation) and 25 (the event ledger).
- **Labels belong to the observer.** The engine never says "feudalism". An observer classifier can say that a rule set resembles serfdom because dues are high, exit is prohibited and land is concentrated. This is design rule 18: aggregate descriptions are measurements, not control variables.
- **Policy changes rules, not outcomes.** This is design rule 17 applied to every institution, not only to Government.

## Collective authority

If government is not built in, it has to emerge. That requires three capabilities:

1. **Groups.** Agents can form associations, join or leave them, and delegate decisions to them.
2. **Enforcement capacity.** Some agent or group must be able to impose a rule's sanction. Without enforcement, a rule is only a suggestion. Property itself is a rule that needs enforcing.
3. **Decision procedures.** A group needs a way to choose rules: a single ruler, a council, majority voting, or the strongest faction. A decision procedure is itself a rule about how rules are made, so it can change too.

Voting fits this structure directly. Households hold preferences over rules, a decision procedure aggregates them, and whoever holds enforcement capacity implements the result. Running the same preferences through different procedures produces different policy, which is a comparison worth studying on its own.

## Sources of change

The engine should record why each rule changed, using a small set of causes:

- **External shocks:** harvests, disease, new technology, population pressure.
- **Learning:** agents adapt through reinforcement, or by imitating neighbours who do better.
- **Innovation:** an agent occasionally proposes a new rule. This is legitimate randomness, because it represents uncertainty about ideas (design rule 20).
- **Selection:** groups whose rules work better grow, retain members, or prevail in conflict.

Tagging every rule change with its cause makes "where does change come from?" something the observer can measure.

## Politics and culture

Politics and culture extend the same agent model:

- **Politics** is the part of the rules layer concerned with decision procedures and enforcement: who may propose rules, how proposals are decided, and who carries them out.
- **Culture** is beliefs and norms spreading through a social network by imitation, in the spirit of Axelrod (1997). In this framing, culture is mainly what agents believe about which rules are legitimate. That belief affects whether they comply, resist or leave.

Neither needs a separate engine. Each adds agent state and decisions that interact with the same rules layer.

## Relationship to the design rules

The vision follows from the existing design rules and does not relax any of them:

| Rule | How the vision applies it |
| --- | --- |
| 1. Plausible information | Agents know the rules that apply to them and what they observe, not the whole rule set or its consequences |
| 4. Emergence from incentives | Institutions emerge from incentives instead of being imposed |
| 5–6. Conservation and traceability | Every rule-driven transfer is an explicit, conserved transfer |
| 12. Earned complexity | The rule grammar starts small and grows only when each part is understood |
| 16. Rules separate from strategies | Rules become data that strategies act within and act upon |
| 17. Policies change rules | Generalized from Government to every institution |
| 18. Metrics are measurements | Institution labels are observer classifications |
| 21–22. Reproducibility and clean counterfactuals | Rule innovation and adoption are seeded; counterfactuals vary one rule or one condition |
| 27. Simplicity until realism changes the question | Each step is justified by a question it makes answerable |

## Where the engine stands today

The current engine (MVP8) hard-codes several institutions that this vision would move into the rules layer:

- **Markets.** Consumer goods are sold only through posted-price retail markets with fixed clearing rules.
- **Employment.** Every household is employed permanently by an assigned firm at the same contractual wage.
- **Profit.** Residual profit is taxed at a fixed 100%.
- **Government.** A single Government exists by definition. It acts after payroll, and its wealth-tax learner judges trial rates by an objective defined in terms of the Gini coefficient, which is imposed from outside rather than derived from what households want.
- **Redistribution.** The Government returns all receipts through one fixed means-tested rule.
- **Money.** Money exists from the start and its total is fixed.

Some of these, money in particular, may reasonably stay fixed for a long time. The point is that each one is a choice that should be visible as a choice.

## Risks and constraints

- **Too much freedom, nothing emerges.** If agents can propose any rule, bounded learners cannot find rules that work, and the result is noise. The grammar should start with a few aims (transfer, access, exit), a few sanctions and a few decision procedures, and grow only when each part is understood (design rule 12).
- **Every starting point is an assumption.** Even "the most basic economy" builds something in. Fixed money, markets or property rights each rule out the histories in which they do not exist. Primitives should be chosen so that they do not smuggle in the institutions the engine is meant to show emerging. Money can also emerge (Kiyotaki and Wright, 1989), but that is a distant step.
- **Timescale.** Institutions change over generations, not days. Dynastic wealth, central to feudal economies, requires births, deaths and inheritance as engine physics. This is likely a larger change than the rules layer itself.
- **Validation.** Emergent outcomes cannot be checked against a single analytical benchmark. They need theoretical predictions that the engine either reproduces or fails to reproduce (see below), and failures should be recorded as results (design rule 24).

## Validation targets

Known theory gives testable predictions without hard-coding the outcome:

- **Domar's hypothesis (1970).** Free land, free peasants and a non-working landowning class cannot all coexist: when land is abundant and labour scarce, landowners can only extract income by restricting exit. If bound labour emerges under those conditions, and not when land is scarce, without serfdom being defined anywhere in the engine, that is a strong result.
- **Malthusian dynamics.** With population growth and fixed land, living standards should return towards subsistence after productivity gains.
- **Behaviour-preserving refactors.** When an existing hard-coded mechanism is re-expressed as rule data, the canonical trajectory must match bit-for-bit, as in the MVP8 structural refactor.

## Incremental path

No rewrite is required. Each step moves one hard-coded institution into the rules layer and gets its own specification and validation:

1. **Express the fiscal phase as rule objects.** The wealth tax and the equalizing transfer become data interpreted by the engine. Behaviour must stay bit-for-bit identical, so this is a verifiable refactor that proves the representation.
2. **Derive the Government's objective from households.** Replace the imposed Gini objective with household preferences over rules, aggregated by an explicit decision procedure such as voting.
3. **Let agents propose amendments** to the fiscal rules, with seeded innovation and recorded support.
4. **Add demography and inheritance**, so wealth and position can persist across generations.
5. **Make enforcement and exit agent choices**, which makes Domar-style questions testable.

Steps 1 and 2 are small, testable, and already within the spirit of the whole vision.

## Open questions

- What is the smallest rule grammar that can express both the current fiscal phase and a feudal due?
- Should rules be enforced automatically once adopted, or only when an agent with enforcement capacity chooses to act?
- How do agents learn which rules to prefer without knowing their aggregate consequences (design rule 1)?
- Which decision procedure should the first emergent Government use, and should the procedure itself be amendable from the start?
- At what point does a simulated day stop being the right unit of time?
- How should the observer classify rule sets into recognizable institutions without that classification feeding back into agent behaviour?

## References

- Axelrod, R. (1997). The dissemination of culture: A model with local convergence and global polarization. *Journal of Conflict Resolution*, 41(2), 203–226.
- Crawford, S. E. S., and Ostrom, E. (1995). A grammar of institutions. *American Political Science Review*, 89(3), 582–600.
- Domar, E. D. (1970). The causes of slavery or serfdom: A hypothesis. *Journal of Economic History*, 30(1), 18–32.
- Epstein, J. M., and Axtell, R. (1996). *Growing Artificial Societies: Social Science from the Bottom Up*. MIT Press.
- Kiyotaki, N., and Wright, R. (1989). On money as a medium of exchange. *Journal of Political Economy*, 97(4), 927–954.
- Zheng, S., Trott, A., Srinivasa, S., et al. (2020). The AI Economist: Improving equality and productivity with AI-driven tax policies. arXiv:2004.13332. A contrasting approach: a learned planner with an imposed objective.
