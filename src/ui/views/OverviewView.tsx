import { useMemo } from 'react'
import type { SimulationState } from '../../sim/types'
import { EmptyState, FirmDot, Icon, MultiSparkline, Section, ShareBar, Stat } from '../components'
import { buildHighlights, completionRate, CONSUMER_INDUSTRIES, dailyFlows, industrySnapshot } from '../economyModel'
import { bps, gini, money, moneyWhole, percent } from '../format'
import { groupEventsForDisplay } from '../groupEventsForDisplay'
import { MoneyFlow } from '../MoneyFlow'
import { palette } from '../theme'
import { WorldView } from '../WorldView'
import type { CompetitiveIndustryId } from '../worldViewModel'

export function OverviewView({ state, running, onRun, onOpenMarket, selectedId, onSelect, industry, onIndustry }: {
  state: SimulationState
  running: boolean
  onRun: () => void
  onOpenMarket: (industry: CompetitiveIndustryId) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  industry: CompetitiveIndustryId
  onIndustry: (industry: CompetitiveIndustryId) => void
}) {
  const latest = state.metrics.at(-1)
  const households = state.households.length
  const history = state.metrics
  const flows = dailyFlows(latest)
  const highlights = useMemo(() => buildHighlights(state.events), [state.events])
  const rawEvents = useMemo(() => groupEventsForDisplay(state.events).reverse().slice(0, 60), [state.events])
  const policyText = state.government.policyMode === 'equalizing' ? 'Raising tax to restore equality' : 'Lowest rate that keeps households equal'

  return <div className="view">
    {state.day === 0 && <div className="intro intro--start">
      <div>
        <p className="intro-title">{households} households, 9 firms and a government share a fixed {moneyWhole(households * 5_000)}.</p>
        <p>Firms learn their prices from what sells, households buy from whichever shop is cheapest once the trip is paid, and Government taxes wealth to keep everyone roughly equal. Nobody is told the answer; it emerges day by day.</p>
      </div>
      <button type="button" className="primary intro-cta" onClick={onRun}><Icon name="play" size={14} />Run the economy</button>
    </div>}

    {state.day > 0 && <div className="stat-row">
      <Stat
        label="Needs met"
        value={latest ? percent(completionRate(latest, households)) : '—'}
        detail="of household purchases completed today"
        spark={history.map((metric) => completionRate(metric, households))}
        sparkColor={palette.positive}
        info="Every household tries to buy one unit each of food, utilities, healthcare and entertainment each day. This is the share of those purchases that succeeded."
      />
      <Stat
        label="Inequality"
        value={latest ? gini(latest.postFiscalCashGini) : '—'}
        detail={latest ? <>{gini(latest.preFiscalCashGini)} before redistribution</> : 'Gini coefficient of household cash'}
        spark={history.map((metric) => metric.postFiscalCashGini)}
        sparkColor={palette.household}
        info="Gini coefficient of household cash: 0 means everyone holds the same amount, 1 means one household holds everything. The smaller number is what the market produced before Government's tax and transfers."
      />
      <Stat
        label="Wealth tax"
        value={latest ? bps(latest.appliedWealthTaxRateBps) : '—'}
        detail={policyText}
        spark={history.map((metric) => metric.appliedWealthTaxRateBps)}
        sparkColor={palette.government}
        info="A flat tax on household cash. Government adjusts it by trial and error, and every dollar collected is paid back out to the households with the least."
      />
      <Stat
        label="Wages paid"
        value={latest ? percent(latest.payrollFulfillmentRate) : '—'}
        detail={latest ? `${moneyWhole(latest.totalWagesPaidCents)} of ${moneyWhole(latest.totalContractualPayrollCents)} owed` : 'share of promised wages paid'}
        spark={history.map((metric) => metric.payrollFulfillmentRate)}
        sparkColor={palette.firmA}
        info="Every worker is promised $10 a day. Firms can only pay out of the cash their sales brought in, so a weak day for a firm means a short paycheck for its workers."
      />
    </div>}

    <div className="overview-grid">
      <WorldView state={state} selectedId={selectedId} onSelect={onSelect} industry={industry} onIndustry={onIndustry} />
      <div className="overview-side">
        <Section title="Where the money went today" subtitle={latest ? `Day ${latest.day} · total money stays at ${moneyWhole(latest.totalMoneyCents)}` : 'Flows appear after the first day'} info="The economy is a closed loop: no money is created or destroyed. Households spend at firms, firms pay wages and a 100% tax on any profit, and Government returns all tax as transfers.">
          <MoneyFlow flows={flows} animate={running} />
        </Section>
        <Section title="What's happening" subtitle="Notable changes, newest first" className="highlights-card">
          {highlights.length === 0
            ? <EmptyState>Price changes, tax decisions and shortages will show up here once the simulation runs.</EmptyState>
            : <ol className="highlights">
              {highlights.map((item) => {
                const body = <><span className="highlight-day">D{item.day}</span><div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}</div></>
                const industryId = item.industryId && item.industryId !== 'transport' ? item.industryId : null
                return <li key={item.key} className={`highlight highlight--${item.tone}`}>
                  {industryId ? <button type="button" className="highlight-link" onClick={() => onOpenMarket(industryId)} title={`Open the ${industryId} market`}>{body}</button> : body}
                </li>
              })}
            </ol>}
          {rawEvents.length > 0 && <details className="raw-log">
            <summary>Full event log</summary>
            <ol>{rawEvents.map((event) => <li key={event.key}><span>D{event.day}</span><div><strong>{event.type.toLowerCase()}</strong><p>{event.description}</p></div></li>)}</ol>
          </details>}
        </Section>
      </div>
    </div>

    <Section title="Markets at a glance" subtitle="Two firms compete in each market. Teal is Firm A, coral is Firm B." actions={<button type="button" className="ghost" onClick={() => onOpenMarket('food')}>All markets <Icon name="arrow" size={14} /></button>}>
      <div className="market-rows">
        <div className="market-row market-row--head" aria-hidden="true">
          <span>Market</span><span>Firm A</span><span>Share of today's sales</span><span>Firm B</span><span className="market-row-trend">Price trend</span><span className="market-row-served">Bought</span>
        </div>
        {CONSUMER_INDUSTRIES.map((industryId) => {
          const snapshot = industrySnapshot(state, industryId)
          const [a, b] = snapshot.firms
          const prices = state.metrics.map((metric) => metric.markets.filter((market) => market.industryId === industryId))
          return <button type="button" key={industryId} className="market-row" onClick={() => onOpenMarket(industryId)}>
            <span className="market-row-name">{snapshot.name}<small>{percent(snapshot.budgetShare)} of budget</small></span>
            <span className="market-row-price"><FirmDot variant="a" />{money(a.todayPriceCents ?? a.nextPriceCents)}</span>
            <span className="market-row-share"><ShareBar a={a.sold} b={b.sold} /><small>{Math.round(a.share * 100)}% · {Math.round(b.share * 100)}%</small></span>
            <span className="market-row-price"><FirmDot variant="b" />{money(b.todayPriceCents ?? b.nextPriceCents)}</span>
            <span className="market-row-trend">
              <MultiSparkline height={28} series={[
                { values: prices.map((day) => day.find((market) => market.firmId === a.id)?.postedPriceCents ?? 0), color: palette.firmA },
                { values: prices.map((day) => day.find((market) => market.firmId === b.id)?.postedPriceCents ?? 0), color: palette.firmB },
              ]} />
            </span>
            <span className="market-row-served">{percent(snapshot.householdsServed, 0)}<small>of households</small></span>
          </button>
        })}
      </div>
    </Section>
  </div>
}
