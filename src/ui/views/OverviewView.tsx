import { Fragment, useMemo } from 'react'
import { DEFAULT_FIRMS_PER_INDUSTRY } from '../../sim/config'
import type { SimulationState } from '../../sim/types'
import { EmptyState, FirmDot, Icon, MultiSparkline, Section, ShareBar } from '../components'
import { buildHighlights, CONSUMER_INDUSTRIES, dailyFlows, industrySnapshot, type FirmSnapshot } from '../economyModel'
import { money, moneyWhole, percent } from '../format'
import { groupEventsForDisplay } from '../groupEventsForDisplay'
import { MoneyFlow } from '../MoneyFlow'
import type { CompetitiveIndustryId } from '../worldViewModel'

export function OverviewView({
  state,
  running,
  onOpenMarket,
}: {
  state: SimulationState
  running: boolean
  onOpenMarket: (industry: CompetitiveIndustryId) => void
}) {
  const latest = state.metrics.at(-1)
  const firmsPerIndustry = state.config.firmsPerIndustry ?? DEFAULT_FIRMS_PER_INDUSTRY
  const flows = dailyFlows(latest)
  const highlights = useMemo(() => buildHighlights(state.events), [state.events])
  const rawEvents = useMemo(() => groupEventsForDisplay(state.events).reverse().slice(0, 60), [state.events])
  return (
    <div className="view">
      <Section
        title="Where the money went today"
        subtitle={
          latest
            ? `Day ${latest.day} · total money stays at ${moneyWhole(latest.totalMoneyCents)}`
            : 'Flows appear after the first day'
        }
        info="The economy is a closed loop: no money is created or destroyed. Households spend at firms, firms pay wages and a 100% tax on any profit, and Government returns all tax as transfers."
      >
        <MoneyFlow flows={flows} animate={running} />
      </Section>
      <Section title="What's happening" subtitle="Notable changes, newest first" className="highlights-card">
        {highlights.length === 0 ? (
          <EmptyState>
            Price changes, tax decisions and shortages will show up here once the simulation runs.
          </EmptyState>
        ) : (
          <ol className="highlights">
            {highlights.map((item) => {
              const body = (
                <>
                  <span className="highlight-day">D{item.day}</span>
                  <div>
                    <strong>{item.title}</strong>
                    {item.detail && <p>{item.detail}</p>}
                  </div>
                </>
              )
              const industryId = item.industryId && item.industryId !== 'transport' ? item.industryId : null
              return (
                <li key={item.key} className={`highlight highlight--${item.tone}`}>
                  {industryId ? (
                    <button
                      type="button"
                      className="highlight-link"
                      onClick={() => onOpenMarket(industryId)}
                      title={`Open the ${industryId} market`}
                    >
                      {body}
                    </button>
                  ) : (
                    body
                  )}
                </li>
              )
            })}
          </ol>
        )}
        {rawEvents.length > 0 && (
          <details className="raw-log">
            <summary>Full event log</summary>
            <ol>
              {rawEvents.map((event) => (
                <li key={event.key}>
                  <span>D{event.day}</span>
                  <div>
                    <strong>{event.type.toLowerCase()}</strong>
                    <p>{event.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        )}
      </Section>

      <Section
        title="Markets at a glance"
        subtitle={
          firmsPerIndustry === 2
            ? 'Two firms compete in each market. Teal is Firm A, coral is Firm B.'
            : `${firmsPerIndustry} firms compete in each market, each in its own colour.`
        }
        actions={
          <button type="button" className="ghost" onClick={() => onOpenMarket('food')}>
            All markets <Icon name="arrow" size={14} />
          </button>
        }
      >
        <div className="market-rows">
          <div className="market-row market-row--head" aria-hidden="true">
            <span>Market</span>
            <span>Firm A</span>
            <span>Share of today's sales</span>
            <span>{firmsPerIndustry === 2 ? 'Firm B' : 'Other firms'}</span>
            <span className="market-row-trend">Price trend</span>
            <span className="market-row-served">Bought</span>
          </div>
          {CONSUMER_INDUSTRIES.map((industryId) => {
            const snapshot = industrySnapshot(state, industryId)
            const [first, ...others] = snapshot.firms
            const prices = state.metrics.map((metric) =>
              metric.markets.filter((market) => market.industryId === industryId),
            )
            const price = (firm: FirmSnapshot) => (
              <Fragment key={firm.id}>
                <FirmDot color={firm.color} />
                {money(firm.todayPriceCents ?? firm.nextPriceCents)}
              </Fragment>
            )
            return (
              <button type="button" key={industryId} className="market-row" onClick={() => onOpenMarket(industryId)}>
                <span className="market-row-name">
                  {snapshot.name}
                  <small>{percent(snapshot.budgetShare)} of budget</small>
                </span>
                <span className="market-row-price">{first && price(first)}</span>
                <span className="market-row-share">
                  <ShareBar firms={snapshot.firms} />
                  <small>{snapshot.firms.map((firm) => `${Math.round(firm.share * 100)}%`).join(' · ')}</small>
                </span>
                <span className="market-row-price">{others.map(price)}</span>
                <span className="market-row-trend">
                  <MultiSparkline
                    height={28}
                    series={snapshot.firms.map((firm) => ({
                      values: prices.map(
                        (day) => day.find((market) => market.firmId === firm.id)?.postedPriceCents ?? 0,
                      ),
                      color: firm.color,
                    }))}
                  />
                </span>
                <span className="market-row-served">
                  {percent(snapshot.householdsServed, 0)}
                  <small>of households</small>
                </span>
              </button>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
