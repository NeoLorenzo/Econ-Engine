# MVP 6 adaptive Government specification

## Release

`[MVP6-Government-008.1]` refines the existing MVP6 Government learner so it searches upward under inequality and downward after effective equality. The fiscal instrument, tax arithmetic, redistribution, information boundary, experiment cadence, and all MVP5 economic systems remain unchanged.

## Objective and effective equality

Government has two conditional objectives:

```text
if unequal: minimize post-fiscal Gini
if effectively equal: maintain equality while minimizing the wealth-tax rate
```

Effective equality is derived directly from integer-cent household cash: `maximumPostFiscalCashCents - minimumPostFiscalCashCents <= 1`. A range of zero or one cent is equalized; two cents is not. Gini remains an observer and equalization metric, but the former `1e-12` floating-point tie mechanism no longer exists.

## Two-mode learner

In `EQUALIZING` mode, the incumbent's realized distribution is not effectively equal. Experiments are restricted to rates above the incumbent. A higher experiment is adopted if it achieves effective equality or produces a strictly lower realized post-fiscal Gini than the recent incumbent reference. An adopted equalizing experiment remains in this mode until equality is achieved; equality transitions the incumbent to `MINIMIZING_TAX`.

In `MINIMIZING_TAX` mode, experiments are restricted to rates below the incumbent. A lower rate is adopted exactly when its realized post-fiscal distribution remains effectively equal, regardless of floating-point Gini equality. A lower experiment that creates a cash range above one cent is rejected, restoring the equalized incumbent. Normal incumbent days continually re-evaluate the cash range; if the incumbent ceases to equalize the changing economy, Government returns to `EQUALIZING`.

Both modes continue experimenting forever. Government does not enumerate tax rates, solve a counterfactual minimum, or forecast future markets.

## Experiment catalog and information boundary

The incumbent begins at 0%. After establishing a current realized reference, a dedicated seeded Government RNG substream starts experiments with probability `0.1` per day. The unchanged catalog contains incumbent `+/-1`, `+/-5`, `+/-10`, and `+/-20` percentage points plus `0%`, `25%`, `50%`, `75%`, and `100%` anchors. Directional filtering, clamping, deduplication, and incumbent removal occur before seeded selection.

Government observes current administered cash, current Gini/equality, its policies, references, outcomes, and receipts. It cannot inspect future wages, prices, purchases, RNG outcomes, or counterfactual trajectories. Firms receive none of Government's distribution information.

## Unchanged fiscal mechanics

The tax base is household cash immediately after complete payroll. Rates are integer basis points from `0` through `10_000`; liability is `floor(postPayrollCashCents * rateBps / 10_000)`. Taxes are explicit Household-to-Government transfers.

Government redistributes exactly all receipts through deterministic integer-cent poorest-first water filling. The poorest tied group is raised toward the next tier; seeded tied-group ordering allocates indivisible cents. Government cannot borrow or create money. Completed days retain firm cash `$0`, Government cash `$0`, household cash `$500`, and total money `$500`.

## Events, analytics, and UI

Existing experiment, tax, and transfer events remain. Experiment events identify policy mode and effective equality before/after, and their descriptions distinguish lower tax maintaining/breaking equality from upward Gini improvement/equalization.

Trajectory analytics add effective-equality occupancy, time in each mode, successful downward adoptions, downward equality-breaking rejections, and upward equalizing/improvement adoptions. The Government panel exposes the current search objective, effective equality, and the post-fiscal cash range. Terminal tax remains secondary to the complete trajectory.

## Scope exclusions

There is no analytical minimum-tax solver, exhaustive counterfactual search, new tax, bracket, benefit, public purchase, borrowing, monetary policy, forecast, consumption/growth/welfare objective, or change to household, firm, payroll, market, or redistribution behavior.
