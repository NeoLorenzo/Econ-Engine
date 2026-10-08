import { useRef } from 'react'
import type { SimulationState } from '../../sim/types'
import { Icon, Stat } from '../components'
import { completionRate } from '../economyModel'
import { bps, gini, money, moneyWhole, percent } from '../format'
import { palette } from '../theme'
import { useHeightVar } from './useHeightVar'

/** Headline measurements and the scenario status, floating over the world. */
export function Hud({
  state,
  seed,
  totalMoney,
  conserved,
}: {
  state: SimulationState
  seed: number
  totalMoney: number
  conserved: boolean
}) {
  const hudRef = useRef<HTMLDivElement | null>(null)
  useHeightVar(hudRef, '--hud-h')
  const latest = state.metrics.at(-1)
  const households = state.households.length
  const history = state.metrics
  const policyText =
    state.government.policyMode === 'equalizing'
      ? 'Raising tax to restore equality'
      : 'Lowest rate that keeps households equal'
  return (
    <div ref={hudRef} className="hud">
      {state.day > 0 && (
        <>
          <Stat
            compact
            label="Needs met"
            value={latest ? percent(completionRate(latest, households)) : '—'}
            detail="of household purchases completed today"
            spark={history.map((metric) => completionRate(metric, households))}
            sparkColor={palette.positive}
            info="Every household tries to buy one unit each of food, utilities, healthcare and entertainment each day. This is the share of those purchases that succeeded."
          />
          <Stat
            compact
            label="Inequality"
            value={latest ? gini(latest.postFiscalCashGini) : '—'}
            detail={
              latest ? (
                <>{gini(latest.preFiscalCashGini)} before redistribution</>
              ) : (
                'Gini coefficient of household cash'
              )
            }
            spark={history.map((metric) => metric.postFiscalCashGini)}
            sparkColor={palette.household}
            info="Gini coefficient of household cash: 0 means everyone holds the same amount, 1 means one household holds everything. The smaller number is what the market produced before Government's tax and transfers."
          />
          <Stat
            compact
            label="Wealth tax"
            value={latest ? bps(latest.appliedWealthTaxRateBps) : '—'}
            detail={policyText}
            spark={history.map((metric) => metric.appliedWealthTaxRateBps)}
            sparkColor={palette.government}
            info="A flat tax on household cash. Government adjusts it by trial and error, and every dollar collected is paid back out to the households with the least."
          />
          <Stat
            compact
            label="Wages paid"
            value={latest ? percent(latest.payrollFulfillmentRate) : '—'}
            detail={
              latest
                ? `${moneyWhole(latest.totalWagesPaidCents)} of ${moneyWhole(latest.totalContractualPayrollCents)} owed`
                : 'share of promised wages paid'
            }
            spark={history.map((metric) => metric.payrollFulfillmentRate)}
            sparkColor={palette.firmA}
            info="Every worker is promised $10 a day. Firms can only pay out of the cash their sales brought in, so a weak day for a firm means a short paycheck for its workers."
          />
        </>
      )}
      <div className="hud-status">
        <span className="scenario-summary">
          Seed {seed} · {households} households · {state.firms.length} firms · {money(totalMoney)} in circulation
        </span>
        <span className={`conservation${conserved ? '' : ' is-broken'}`}>
          <Icon name={conserved ? 'check' : 'close'} size={13} />
          {conserved ? 'Money conserved exactly' : 'Money not conserved'}
        </span>
      </div>
    </div>
  )
}
