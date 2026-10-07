import type { ReactNode } from 'react'
import { Spinner, Stat } from '../components'
import type { ExperimentKind, ExperimentResults, ExperimentState } from '../experiments'
import { firmName, householdNumber, INDUSTRY_NAMES, money, percent } from '../format'

const pct = (value: number) => percent(value)

function CompareTable({ columns, rows }: { columns: string[]; rows: [string, ...ReactNode[]][] }) {
  return (
    <div className="table-wrap">
      <table className="data-table compare-table">
        <thead>
          <tr>
            <th />
            {columns.map((column) => (
              <th key={column} className="num">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, ...cells]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {cells.map((cell, index) => (
                <td key={index} className="num">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PopulationResult({ result }: { result: ExperimentResults['population'] }) {
  const reports = [result.n10, result.n100]
  return (
    <>
      <CompareTable
        columns={['10 households', '100 households']}
        rows={[
          ['Needs met', ...reports.map((report) => percent(report.normalized.purchaseCompletionRate, 2))],
          ['Wages paid', ...reports.map((report) => percent(report.normalized.payrollFulfillmentRate, 2))],
          ['Average inequality (Gini)', ...reports.map((report) => report.normalized.meanCashGini.toFixed(4))],
          [
            'Average wealth tax',
            ...reports.map((report) => `${(report.normalized.meanWealthTaxRateBps / 100).toFixed(2)}%`),
          ],
          ['Market-share volatility', ...reports.map((report) => report.normalized.marketShareVolatility.toFixed(4))],
          ['Total money', ...reports.map((report) => money(report.totalMoneyCents))],
        ]}
      />
      <p className="result-note">
        Averages over all {result.n10.horizonDays.toLocaleString()} days, scaled per household so the two sizes are
        comparable.
      </p>
    </>
  )
}

function EmploymentResult({ result }: { result: ExperimentResults['employment'] }) {
  const failures = result.economy.failureTotals
  const failureTotal = failures.cash + failures.category_budget + failures.inventory
  return (
    <>
      <div className="stat-row stat-row--compact">
        <Stat
          label="Average inequality"
          value={result.economy.meanCashGini.toFixed(3)}
          detail={`peak ${result.economy.maximumCashGini.toFixed(3)}`}
        />
        <Stat
          label="Wage inequality"
          value={result.economy.meanWageGini.toFixed(3)}
          detail={`peak ${result.economy.maximumWageGini.toFixed(3)}`}
        />
        <Stat
          label="Richest household's share"
          value={pct(result.economy.richest1.mean)}
          detail={`peak ${pct(result.economy.richest1.maximum)}`}
        />
        <Stat
          label="Needs met"
          value={pct(result.economy.purchaseCompletionFraction)}
          detail={`${failureTotal.toLocaleString()} missed purchases`}
        />
      </div>
      <CompareTable
        columns={['Missed purchases', 'Share']}
        rows={[
          ['Not enough cash', failures.cash.toLocaleString(), pct(failureTotal ? failures.cash / failureTotal : 0)],
          [
            'Over category budget',
            failures.category_budget.toLocaleString(),
            pct(failureTotal ? failures.category_budget / failureTotal : 0),
          ],
          ['Sold out', failures.inventory.toLocaleString(), pct(failureTotal ? failures.inventory / failureTotal : 0)],
        ]}
      />
      <details className="disclosure">
        <summary>Every household ({result.households.length})</summary>
        <div className="table-wrap table-wrap--tall">
          <table className="data-table">
            <thead>
              <tr>
                <th>Household</th>
                <th>Works at</th>
                <th className="num">Average cash</th>
                <th className="num">Average wage</th>
                <th className="num">Needs met</th>
                <th className="num">Days under $5</th>
                <th className="num">Average rank</th>
                <th className="num">Final cash</th>
              </tr>
            </thead>
            <tbody>
              {result.households.map((household) => (
                <tr key={household.householdId}>
                  <td>H{householdNumber(household.householdId)}</td>
                  <td>{firmName(household.employerFirmId)}</td>
                  <td className="num">{money(household.meanCashCents)}</td>
                  <td className="num">{money(household.meanWageCents)}</td>
                  <td className="num">{pct(household.purchaseCompletionFraction)}</td>
                  <td className="num">{pct(household.lowCash[500].fraction)}</td>
                  <td className="num">{household.meanWealthRank.toFixed(1)}</td>
                  <td className="num">{money(household.terminalCashCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="disclosure">
        <summary>Every employer ({result.firms.length})</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Firm</th>
                <th className="num">Workers</th>
                <th className="num">Made</th>
                <th className="num">Sold</th>
                <th className="num">Spoiled</th>
                <th className="num">Sell-through</th>
                <th className="num">Revenue</th>
                <th className="num">Wages</th>
              </tr>
            </thead>
            <tbody>
              {result.firms.map((firm) => {
                const transport = firm.industryId === 'transport'
                return (
                  <tr key={firm.firmId}>
                    <td>{firmName(firm.firmId)}</td>
                    <td className="num">{firm.workerIds.length}</td>
                    <td className="num">{transport ? '—' : firm.cumulativeProduction.toLocaleString()}</td>
                    <td className="num">{firm.cumulativeSales.toLocaleString()}</td>
                    <td className="num">{transport ? '—' : firm.cumulativeExpiration.toLocaleString()}</td>
                    <td className="num">{transport ? '—' : pct(firm.sellThroughRate)}</td>
                    <td className="num">{money(firm.cumulativeOperatingEarningsCents)}</td>
                    <td className="num">{money(firm.cumulativeWagesCents)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
      <p className="result-note">
        Correlation between a household's total wages and its average cash:{' '}
        {result.cumulativeWageMeanCashPearson?.toFixed(3) ?? 'n/a'} (descriptive only).
      </p>
    </>
  )
}

function GovernmentResult({ result }: { result: ExperimentResults['government'] }) {
  const reports = [result.adaptive, result.baseline]
  return (
    <>
      <CompareTable
        columns={['Adaptive Government', 'No Government']}
        rows={[
          [
            'Average tax rate',
            ...reports.map((report) => `${(report.government.meanAppliedRateBps / 100).toFixed(1)}%`),
          ],
          ['Days effectively equal', ...reports.map((report) => pct(report.government.effectiveEqualityFraction))],
          [
            'Inequality before → after',
            ...reports.map(
              (report) =>
                `${report.distribution.meanPreGini.toFixed(3)} → ${report.distribution.meanPostGini.toFixed(3)}`,
            ),
          ],
          ['Needs met', ...reports.map((report) => pct(report.consumption.completionFraction))],
          ['Missed for lack of cash', ...reports.map((report) => report.consumption.cashFailures.toLocaleString())],
          [
            'Tax rate changes',
            ...reports.map(
              (report) =>
                `${report.government.taxRateChanges} (${report.government.adopted} of ${report.government.experiments} trials kept)`,
            ),
          ],
        ]}
      />
    </>
  )
}

function CompetitionResult({ result }: { result: ExperimentResults['competition'] }) {
  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Market</th>
              <th className="num">Average share A / B</th>
              <th className="num">Days leading A / B</th>
              <th className="num">Lead changes</th>
              <th className="num">Average price A / B</th>
              <th className="num">Total revenue A / B</th>
            </tr>
          </thead>
          <tbody>
            {result.industries.map(({ industryId, analytics }) => (
              <tr key={industryId}>
                <td>{INDUSTRY_NAMES[industryId as keyof typeof INDUSTRY_NAMES] ?? industryId}</td>
                <td className="num">
                  {pct(analytics.firmA.meanDailyMarketShare)} / {pct(analytics.firmB.meanDailyMarketShare)}
                </td>
                <td className="num">
                  {pct(analytics.firmA.fractionDaysLeading)} / {pct(analytics.firmB.fractionDaysLeading)}
                </td>
                <td className="num">{analytics.leadershipChanges}</td>
                <td className="num">
                  {money(analytics.firmA.meanIncumbentPriceCents)} / {money(analytics.firmB.meanIncumbentPriceCents)}
                </td>
                <td className="num">
                  {money(analytics.firmA.cumulativeProfitCents)} / {money(analytics.firmB.cumulativeProfitCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="result-note">
        Every day from 1 to 1,000 counts equally; the final day is not treated as the answer.
      </p>
    </>
  )
}

function PricingProbeResult({ result }: { result: ExperimentResults['pricingProbe'] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Firm</th>
            <th className="num">Started at</th>
            <th className="num">Day {result.horizonDays} price</th>
            <th className="num">Settled price</th>
            <th className="num">Settled on day</th>
            <th className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {result.firms.map((firm) => (
            <tr key={firm.firmId}>
              <td>{firmName(firm.firmId)}</td>
              <td className="num">{money(firm.startingPriceCents)}</td>
              <td className="num">{money(firm.finalPriceCents)}</td>
              <td className="num">
                {firm.convergedPriceCents === null ? 'Still searching' : money(firm.convergedPriceCents)}
              </td>
              <td className="num">{firm.daysToConvergence ?? `>${result.horizonDays}`}</td>
              <td className="num">{percent(firm.finalMarketShare, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StartingPriceGridResult({ result }: { result: ExperimentResults['startingPriceGrid'] }) {
  return (
    <div className="table-wrap">
      <table className="data-table matrix">
        <thead>
          <tr>
            <th>A starts \ B starts</th>
            {result.startingPricesCents.map((start) => (
              <th key={start} className="num">
                {money(start)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.startingPricesCents.map((aStart) => (
            <tr key={aStart}>
              <th scope="row">{money(aStart)}</th>
              {result.startingPricesCents.map((bStart) => {
                const cell = result.results.find(
                  (item) => item.firmAStartCents === aStart && item.firmBStartCents === bStart,
                )!
                return (
                  <td key={bStart} className="num">
                    {cell.bothConverged
                      ? `${money(cell.firmAEndpointCents!)} / ${money(cell.firmBEndpointCents!)}`
                      : `Searching at day ${result.horizonDays}`}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ExperimentDefinition<K extends ExperimentKind> {
  kind: K
  title: string
  question: string
  description: string
  render: (result: ExperimentResults[K]) => ReactNode
}

const define = <K extends ExperimentKind>(definition: ExperimentDefinition<K>) => definition

const MAIN = [
  define({
    kind: 'government',
    title: 'Does the Government matter?',
    question: 'Policy',
    description: 'Runs the same 1,000 days twice: once with the adaptive wealth tax, once with no tax at all.',
    render: (result) => <GovernmentResult result={result} />,
  }),
  define({
    kind: 'competition',
    title: 'Who wins each market?',
    question: 'Competition',
    description:
      'Follows both firms in every market for 1,000 days: how often each leads, and how often the lead changes hands.',
    render: (result) => <CompetitionResult result={result} />,
  }),
  define({
    kind: 'employment',
    title: 'Jobs and wealth over time',
    question: 'Households',
    description:
      'Tracks every household and employer for 1,000 days: who stays poor, who gets ahead, and why purchases fail.',
    render: (result) => <EmploymentResult result={result} />,
  }),
  define({
    kind: 'population',
    title: 'Small vs large economy',
    question: 'Scale',
    description:
      "Compares a 10-household economy with the full 100-household one to check results don't depend on size.",
    render: (result) => <PopulationResult result={result} />,
  }),
]

const LEGACY = [
  define({
    kind: 'pricingProbe',
    title: '300-day pricing probe',
    question: 'Legacy',
    description: 'Entertainment Firm A starts at $1 and Firm B at $8; where do they end up after 300 days?',
    render: (result) => <PricingProbeResult result={result} />,
  }),
  define({
    kind: 'startingPriceGrid',
    title: 'Starting-price grid',
    question: 'Legacy',
    description: 'Every pairing of $1, $5 and $8 starting prices, run for 300 days.',
    render: (result) => <StartingPriceGridResult result={result} />,
  }),
]

function ExperimentCard<K extends ExperimentKind>({
  definition,
  entry,
  seed,
  onRun,
}: {
  definition: ExperimentDefinition<K>
  entry: ExperimentState[K]
  seed: number
  onRun: () => void
}) {
  const running = entry?.status === 'running'
  const hasResult = entry?.status === 'done'
  return (
    <article className={`card experiment${hasResult ? ' experiment--done' : ''}`} aria-busy={running}>
      <header className="experiment-head">
        <div>
          <span className="eyebrow">{definition.question}</span>
          <h3>{definition.title}</h3>
          <p>{definition.description}</p>
        </div>
        <button type="button" className="secondary" onClick={onRun} disabled={running}>
          {running ? (
            <>
              <Spinner /> Running…
            </>
          ) : hasResult ? (
            'Run again'
          ) : (
            'Run'
          )}
        </button>
      </header>
      {entry?.status === 'error' && <p className="error-text">This experiment failed: {entry.error}</p>}
      {hasResult && (
        <div className="experiment-result">
          {entry.seed !== seed && (
            <p className="result-note">
              Ran with seed {entry.seed}; the current seed is {seed}.
            </p>
          )}
          {definition.render(entry.result as ExperimentResults[K])}
        </div>
      )}
    </article>
  )
}

export function ExperimentsView({
  seed,
  experiments,
  onRun,
}: {
  seed: number
  experiments: ExperimentState
  onRun: (kind: ExperimentKind) => void
}) {
  return (
    <div className="view">
      <div className="intro intro--plain">
        <p>
          <strong>Longer-run questions.</strong> Each experiment replays the economy from day 0 using seed {seed}, in
          the background. They never change the live simulation.
        </p>
      </div>
      <div className="experiment-grid">
        {MAIN.map((definition) => (
          <ExperimentCard
            key={definition.kind}
            definition={definition as ExperimentDefinition<ExperimentKind>}
            entry={experiments[definition.kind]}
            seed={seed}
            onRun={() => onRun(definition.kind)}
          />
        ))}
      </div>
      <details className="disclosure legacy">
        <summary>Older diagnostics</summary>
        <p className="muted">Kept for comparison with earlier versions. They report the final day only.</p>
        <div className="experiment-grid">
          {LEGACY.map((definition) => (
            <ExperimentCard
              key={definition.kind}
              definition={definition as ExperimentDefinition<ExperimentKind>}
              entry={experiments[definition.kind]}
              seed={seed}
              onRun={() => onRun(definition.kind)}
            />
          ))}
        </div>
      </details>
    </div>
  )
}
