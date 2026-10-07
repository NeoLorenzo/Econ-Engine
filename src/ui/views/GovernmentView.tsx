import type { SimulationState } from '../../sim/types'
import { TimeChart } from '../charts'
import { Section, Stat } from '../components'
import { historyNote } from '../economyModel'
import { bps, gini, money } from '../format'
import { palette } from '../theme'

export function GovernmentView({ state }: { state: SimulationState }) {
  const government = state.government
  const latest = state.metrics.at(-1)
  const equalizing = government.policyMode === 'equalizing'
  const testing = government.policyStatus === 'experiment' && government.experimentRateBps !== null
  const inequality = state.metrics.map((metric) => ({
    day: metric.day,
    before: metric.preFiscalCashGini,
    after: metric.postFiscalCashGini,
  }))
  const rates = state.metrics.map((metric) => ({
    day: metric.day,
    applied: metric.appliedWealthTaxRateBps / 100,
    kept: metric.incumbentWealthTaxRateBps / 100,
  }))

  return (
    <div className="view">
      <section className="policy-hero card">
        <div className="policy-rate">
          <span className="eyebrow">Wealth tax</span>
          <strong>{bps(government.appliedWealthTaxRateBps)}</strong>
          <span className={`chip ${equalizing ? 'chip--testing' : 'chip--settled'}`}>
            {equalizing ? 'Reducing inequality' : 'Keeping equality cheaply'}
          </span>
        </div>
        <div className="policy-story">
          <p>
            {equalizing
              ? 'Households have drifted apart, so Government is trying higher tax rates and keeps any that reduce inequality.'
              : 'Households are effectively equal, so Government is trying lower tax rates and keeps any that preserve that equality.'}
          </p>
          <p className="muted">
            {testing
              ? `Today it is trialling ${bps(government.experimentRateBps!)} against its usual ${bps(government.incumbentWealthTaxRateBps)}.`
              : government.lastExperimentOutcome
                ? `Its last trial was ${government.lastExperimentOutcome === 'adopted' ? 'kept' : 'dropped'}.`
                : 'It has not trialled a new rate yet.'}{' '}
            Every dollar it collects is paid straight back to the households with the least cash.
          </p>
        </div>
      </section>

      <div className="stat-row">
        <Stat
          label="Collected today"
          value={money(government.totalReceiptsTodayCents)}
          detail={`${money(government.wealthTaxCollectedTodayCents)} wealth tax · ${money(government.corporateTaxCollectedTodayCents)} profit tax`}
          info="Firms pay 100% of any profit left after wages; this rule is fixed. The wealth tax is the only thing Government adjusts."
        />
        <Stat
          label="Paid back"
          value={money(government.redistributedTodayCents)}
          detail={`to ${government.householdsReceivingTransfers} households · largest ${money(government.maximumTransferCents)}`}
        />
        <Stat
          label="Inequality after"
          value={gini(government.postFiscalCashGini)}
          detail={`down from ${gini(government.preFiscalCashGini)} before redistribution`}
          tone={government.effectiveEquality ? 'positive' : 'warning'}
        />
        <Stat
          label="Cash range after"
          value={`${money(government.postFiscalCashMinimumCents)} – ${money(government.postFiscalCashMaximumCents)}`}
          detail={government.effectiveEquality ? 'Effectively equal' : 'Not yet equal'}
          tone={government.effectiveEquality ? 'positive' : 'warning'}
        />
      </div>

      <div className="chart-grid">
        <Section
          title="Inequality before and after"
          subtitle={`Gini of household cash. Lower is more equal.${historyNote(state)}`}
          info="The gap between the two lines is how much Government's tax and transfers reduced inequality that day."
        >
          {latest ? (
            <TimeChart
              data={inequality}
              format={gini}
              domain={[0, 'auto']}
              series={[
                { key: 'before', name: 'Before redistribution', color: palette.household, dashed: true },
                { key: 'after', name: 'After', color: palette.accent },
              ]}
            />
          ) : (
            <p className="muted">Appears after the first day.</p>
          )}
        </Section>
        <Section
          title="Tax rate over time"
          subtitle={`The rate in force, and spikes where Government trialled another${historyNote(state)}`}
        >
          {latest ? (
            <TimeChart
              data={rates}
              format={(value) => `${value.toFixed(0)}%`}
              domain={[0, 'auto']}
              series={[
                { key: 'applied', name: 'Applied that day', color: palette.government, width: 1.5, step: true },
                { key: 'kept', name: 'Kept rate', color: palette.text2, dashed: true, step: true },
              ]}
            />
          ) : (
            <p className="muted">Appears after the first day.</p>
          )}
        </Section>
      </div>

      <p className="footnote">
        This Government is deliberately simple: one flat tax on cash, one goal (equality), no borrowing and no money
        creation.
      </p>
    </div>
  )
}
