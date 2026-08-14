# [MVP7-Wages_Profits-009]

MVP7 separates labor income from firm profit without introducing a labor market. The seeded permanent employment map is unchanged: eight consumer firms employ one worker each and Transport employs two.

## Daily settlement

Every worker has a fresh contractual wage of 1,000 integer cents per day. A firm's contractual payroll is `workers × 1,000`; actual payroll is `min(cash, contractual payroll)`. Available payroll is divided evenly in cents using the existing seed/day/firm/employee deterministic ordering. Unpaid wages are an observation only and never become debt.

The unchanged price learner evaluates its existing zero-cost operating signal before settlement. Observer accounting then distinguishes revenue, contractual payroll, wages paid, unpaid wages, and residual profit. Residual profit is cash remaining after payroll.

Government collects every cent of residual profit through explicit Firm-to-Government transfers at the fixed 10,000-basis-point corporate profit-tax rate. This rate is non-adaptive and separate from the MVP6 adaptive household wealth-tax rate. The household wealth-tax base remains household cash after payroll. Both receipt sources form one Government balance, redistributed once with the existing deterministic poorest-first integer-cent water filling.

Completed days therefore satisfy: total money = 50,000 cents, every firm cash balance = 0, and Government cash = 0. There are no retained earnings, wage arrears, borrowing, hiring, firing, mobility, or adaptive wages.

## Observer fields

Firm state exposes worker count, contractual wage/payroll, actual and unpaid wages, fulfillment, residual pre-tax profit, corporate tax, and ending cash. Household state exposes contractual/actual/unpaid wage, cumulative wage income, wealth tax, transfers, and cash. Government state preserves corporate receipts, wealth-tax receipts, combined receipts, redistribution, and closure.

The legacy `preTaxProfit` market field remains the price learner's pre-payroll zero-cost operating signal for behavioral compatibility. New `residualProfit` fields are the authoritative MVP7 accounting profit.
