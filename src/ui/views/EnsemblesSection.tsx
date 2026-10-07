import { useState } from 'react'
import { ENSEMBLE_METRICS, type EnsembleMetric, type MetricSummary } from '../../sim/ensemble'
import { Segmented, Spinner } from '../components'
import {
  ENSEMBLE_SIZES,
  type EnsembleKind,
  type AnyEnsembleResult,
  type EnsembleSize,
  type EnsembleState,
} from '../ensembles'
import { percent } from '../format'

type Format = (value: number) => string
const share: Format = (value) => percent(value, 1)
const gini: Format = (value) => value.toFixed(4)
const rate: Format = (bps) => `${(bps / 100).toFixed(1)}%`
const count: Format = (value) => value.toFixed(1)
const points: Format = (value) => `${value >= 0 ? '+' : '−'}${(Math.abs(value) * 100).toFixed(2)} pts`
/** A spread of a percentage-point difference is itself in points, without a sign. */
const pointsSpread: Format = (value) => `${(value * 100).toFixed(2)} pts`

type MetricInfo = { label: string; format: Format; spread?: Format }
const volatility: Format = (value) => value.toFixed(4)

const METRICS: { [K in EnsembleKind]: Record<EnsembleMetric<K>, MetricInfo> } = {
  population: {
    n10Completion: { label: 'Needs met, 10 households', format: share },
    n100Completion: { label: 'Needs met, 100 households', format: share },
    completionGap: { label: 'Difference (100 − 10)', format: points, spread: pointsSpread },
    n10MeanCashGini: { label: 'Average inequality, 10 households', format: gini },
    n100MeanCashGini: { label: 'Average inequality, 100 households', format: gini },
    n10MeanWealthTaxRateBps: { label: 'Average wealth tax, 10 households', format: rate },
    n100MeanWealthTaxRateBps: { label: 'Average wealth tax, 100 households', format: rate },
    n10ShareVolatility: { label: 'Market-share volatility, 10 households', format: volatility },
    n100ShareVolatility: { label: 'Market-share volatility, 100 households', format: volatility },
  },
  government: {
    adaptiveMeanTaxRateBps: { label: 'Average tax rate (adaptive)', format: rate },
    adaptiveEqualityFraction: { label: 'Days effectively equal (adaptive)', format: share },
    adaptiveMeanPostGini: { label: 'Inequality after tax, adaptive Government', format: gini },
    baselineMeanPostGini: { label: 'Inequality, no Government', format: gini },
    adaptiveCompletion: { label: 'Needs met, adaptive Government', format: share },
    baselineCompletion: { label: 'Needs met, no Government', format: share },
    adaptiveTaxRateChanges: { label: 'Tax-rate changes (adaptive)', format: count },
  },
  competition: {
    meanLeadershipChanges: { label: 'Lead changes per market', format: count },
    meanTiedDayFraction: { label: 'Days the firms tie', format: share },
    meanFirmAShare: { label: "Firm A's average share", format: share },
    meanShareAsymmetry: { label: 'Average gap between the firms’ shares', format: share },
  },
}

const DEFINITIONS: { kind: EnsembleKind; title: string; question: string; description: string }[] = [
  {
    kind: 'population',
    title: 'Small vs large economy, across seeds',
    question: 'Scale',
    description: 'Is the gap between a 10- and a 100-household economy a real effect or the luck of one seed?',
  },
  {
    kind: 'government',
    title: 'Does the Government matter, across seeds?',
    question: 'Policy',
    description: 'The adaptive wealth tax against no Government at all, repeated on every seed.',
  },
  {
    kind: 'competition',
    title: 'Who wins each market, across seeds',
    question: 'Competition',
    description: 'How often market leadership changes hands, and how lopsided markets become, from seed to seed.',
  },
]

function SummaryTable({ result }: { result: AnyEnsembleResult }) {
  const metrics = METRICS[result.kind] as Record<string, MetricInfo>
  const summaries = result.summary as Record<string, MetricSummary>
  return (
    <div className="table-wrap">
      <table className="data-table ensemble-table">
        <thead>
          <tr>
            <th>Outcome</th>
            <th className="num">Mean</th>
            <th className="num">Std. dev.</th>
            <th className="num">Middle 80% (p10–p90)</th>
            <th className="num">Range</th>
          </tr>
        </thead>
        <tbody>
          {ENSEMBLE_METRICS[result.kind].map((metric) => {
            const { label, format, spread = format } = metrics[metric]!
            const summary = summaries[metric]!
            return (
              <tr key={metric}>
                <th scope="row">{label}</th>
                <td className="num">{format(summary.mean)}</td>
                <td className="num">{spread(summary.standardDeviation)}</td>
                <td className="num">
                  {format(summary.p10)} – {format(summary.p90)}
                </td>
                <td className="num">
                  {format(summary.minimum)} – {format(summary.maximum)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PerSeedTable({ result }: { result: AnyEnsembleResult }) {
  const metrics = METRICS[result.kind] as Record<string, MetricInfo>
  const keys = ENSEMBLE_METRICS[result.kind]
  return (
    <details className="disclosure">
      <summary>Each seed ({result.seeds.length})</summary>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Seed</th>
              {keys.map((metric) => (
                <th key={metric} className="num">
                  {metrics[metric]!.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.perSeed.map(({ seed, metrics: values }) => (
              <tr key={seed}>
                <td className="num">{seed}</td>
                {keys.map((metric) => (
                  <td key={metric} className="num">
                    {metrics[metric]!.format((values as Record<string, number>)[metric]!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function EnsembleCard({
  definition,
  entry,
  seed,
  onRun,
}: {
  definition: (typeof DEFINITIONS)[number]
  entry: EnsembleState[EnsembleKind]
  seed: number
  onRun: (size: EnsembleSize) => void
}) {
  const [size, setSize] = useState<EnsembleSize>(8)
  const running = entry?.status === 'running'
  return (
    <article
      className={`card experiment experiment--ensemble${entry?.status === 'done' ? ' experiment--done' : ''}`}
      aria-busy={running}
    >
      <header className="experiment-head">
        <div>
          <span className="eyebrow">{definition.question} · ensemble</span>
          <h3>{definition.title}</h3>
          <p>{definition.description}</p>
        </div>
        <div className="ensemble-controls">
          <Segmented
            label="Number of seeds"
            size="sm"
            value={String(size) as `${EnsembleSize}`}
            onChange={(value) => setSize(Number(value) as EnsembleSize)}
            options={ENSEMBLE_SIZES.map((option) => ({
              id: String(option) as `${EnsembleSize}`,
              label: `${option} seeds`,
            }))}
          />
          <button type="button" className="secondary" onClick={() => onRun(size)} disabled={running}>
            {running ? (
              <>
                <Spinner /> {entry.done} of {entry.seeds.length}
              </>
            ) : entry?.status === 'done' ? (
              'Run again'
            ) : (
              'Run'
            )}
          </button>
        </div>
      </header>
      {entry?.status === 'error' && <p className="error-text">This ensemble failed: {entry.error}</p>}
      {entry?.status === 'done' && (
        <div className="experiment-result">
          <p className="result-note ensemble-badge">
            Summary across {entry.result.seeds.length} seeds, each run for {entry.result.horizonDays.toLocaleString()}{' '}
            days. This is the spread of outcomes, not one trajectory.
            {entry.base !== seed && ` Seed set built from seed ${entry.base}; the current seed is ${seed}.`}
          </p>
          <SummaryTable result={entry.result} />
          <PerSeedTable result={entry.result} />
        </div>
      )}
    </article>
  )
}

export function EnsemblesSection({
  seed,
  ensembles,
  onRun,
}: {
  seed: number
  ensembles: EnsembleState
  onRun: (kind: EnsembleKind, size: EnsembleSize) => void
}) {
  return (
    <section className="ensembles" aria-labelledby="ensembles-title">
      <div className="intro intro--plain">
        <h2 id="ensembles-title">Across many seeds</h2>
        <p>
          One run follows one random path: who shops first, where everyone lives, which prices firms try. These run the
          same experiment on several seeds, starting with seed {seed}, and show how much the answer moves. Seeds run in
          parallel in the background and never touch the live simulation.
        </p>
      </div>
      <div className="experiment-grid">
        {DEFINITIONS.map((definition) => (
          <EnsembleCard
            key={definition.kind}
            definition={definition}
            entry={ensembles[definition.kind]}
            seed={seed}
            onRun={(size) => onRun(definition.kind, size)}
          />
        ))}
      </div>
    </section>
  )
}
