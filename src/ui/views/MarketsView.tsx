import type { SimulationState } from '../../sim/types'
import { ShareChart, TimeChart } from '../charts'
import { FirmDot, Icon, InfoTip, MultiSparkline, Section, ShareBar } from '../components'
import {
  CONSUMER_INDUSTRIES,
  firmChartSeries,
  firmSeries,
  historyNote,
  industrySnapshot,
  type FirmSnapshot,
} from '../economyModel'
import { money, percent } from '../format'
import { MarketMap } from '../MarketMap'
import { palette } from '../theme'
import type { CompetitiveIndustryId } from '../worldViewModel'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
const units = (value: number) => String(Math.round(value))

function FirmCard({ firm, onShowOnMap }: { firm: FirmSnapshot; onShowOnMap: () => void }) {
  return (
    <article className="firm-card" style={{ borderTopColor: firm.color }}>
      <header>
        <span className="firm-card-name">
          <FirmDot color={firm.color} />
          {firm.label}
        </span>
        <span className={`chip chip--${firm.status.tone}`}>{firm.status.label}</span>
      </header>
      <div className="firm-card-price">
        {money(firm.todayPriceCents ?? firm.nextPriceCents)}
        <small>price today</small>
      </div>
      <p className="firm-card-status">{firm.status.detail}</p>
      <dl className="mini-stats">
        <div>
          <dt>Market share</dt>
          <dd>{percent(firm.share, 0)}</dd>
        </div>
        <div>
          <dt>Sold / made</dt>
          <dd>
            {firm.sold} / {firm.produced}
          </dd>
        </div>
        <div>
          <dt>Earnings today</dt>
          <dd>{money(firm.earningsCents)}</dd>
        </div>
        <div>
          <dt>Wages paid</dt>
          <dd>
            {percent(firm.payrollRate, 0)}
            <small> of {firm.workers} × $10</small>
          </dd>
        </div>
      </dl>
      <footer className="firm-card-foot">
        <span>
          {firm.nextPriceCents !== firm.todayPriceCents && firm.todayPriceCents !== null
            ? `Tomorrow: ${money(firm.nextPriceCents)}`
            : ''}
        </span>
        <button type="button" className="ghost" onClick={onShowOnMap}>
          Show on map <Icon name="arrow" size={14} />
        </button>
      </footer>
    </article>
  )
}

export function MarketsView({
  state,
  industry,
  onIndustry,
  onShowOnMap,
}: {
  state: SimulationState
  industry: CompetitiveIndustryId
  onIndustry: (industry: CompetitiveIndustryId) => void
  onShowOnMap: (id: string) => void
}) {
  const snapshot = industrySnapshot(state, industry)
  const prices = firmSeries(state, industry, (market) => market.postedPriceCents)
  const shares = firmSeries(state, industry, (market) => market.marketShare)
  const earnings = firmSeries(state, industry, (market) => market.preTaxProfitCents)
  const series = firmChartSeries(state, industry)
  const supply = state.metrics.map((metric) => {
    const markets = metric.markets.filter((market) => market.industryId === industry)
    return {
      day: metric.day,
      produced: markets.reduce((sum, market) => sum + market.unitsProduced, 0),
      sold: markets.reduce((sum, market) => sum + market.unitsSold, 0),
      expired: markets.reduce((sum, market) => sum + market.unitsExpired, 0),
      affordable: Math.max(0, ...markets.map((market) => market.householdsAffordableAtMarketOpen)),
    }
  })
  const transport = state.firms.find(({ industryId }) => industryId === 'transport')
  const latest = state.metrics.at(-1)
  const dailyBudget = state.config.dailyExpenditureBudgetCents ?? 5_000
  const span = historyNote(state)

  return (
    <div className="view">
      <div className="industry-tiles" role="group" aria-label="Choose a market">
        {CONSUMER_INDUSTRIES.map((industryId) => {
          const tile = industrySnapshot(state, industryId)
          const history = firmSeries(state, industryId, (market) => market.postedPriceCents)
          return (
            <button
              type="button"
              key={industryId}
              className="industry-tile"
              aria-pressed={industryId === industry}
              onClick={() => onIndustry(industryId)}
            >
              <span className="industry-tile-head">
                <strong>{tile.name}</strong>
                <small>{percent(tile.householdsServed, 0)} of households bought</small>
              </span>
              <span className="industry-tile-prices">
                {tile.firms.map((firm) => (
                  <span key={firm.id}>
                    <FirmDot color={firm.color} />
                    {money(firm.todayPriceCents ?? firm.nextPriceCents)}
                  </span>
                ))}
              </span>
              <ShareBar firms={tile.firms} />
              <MultiSparkline
                height={30}
                series={tile.firms.map((firm) => ({
                  values: history.map((row) => row[firm.id] ?? 0),
                  color: firm.color,
                }))}
              />
            </button>
          )
        })}
      </div>

      <section className="market-detail" aria-labelledby="market-title">
        <header className="market-detail-head">
          <div>
            <h2 id="market-title">{snapshot.name}</h2>
            <p>
              Households set aside {percent(snapshot.budgetShare)} of their {money(dailyBudget)} daily budget (
              {money(Math.round(dailyBudget * snapshot.budgetShare))}) for {snapshot.name.toLowerCase()}. They buy from
              whichever firm is cheapest once the trip there is included.
            </p>
          </div>
          <div className="market-detail-summary">
            <div>
              <strong>{snapshot.sold}</strong>
              <small>sold today</small>
            </div>
            <div>
              <strong>{snapshot.produced}</strong>
              <small>made</small>
            </div>
            <div>
              <strong>{snapshot.expired}</strong>
              <small>went unsold</small>
            </div>
          </div>
        </header>

        <div className="market-overview-row">
          <Section
            title="Who's cheapest where"
            subtitle="Shading: the cheaper firm once the round trip is paid. Dots: who each household bought from today."
            className="market-map-card"
          >
            <MarketMap state={state} industry={industry} onSelectFirm={onShowOnMap} />
          </Section>
          <div className="firm-pair">
            {snapshot.firms.map((firm) => (
              <FirmCard key={firm.id} firm={firm} onShowOnMap={() => onShowOnMap(firm.id)} />
            ))}
          </div>
        </div>

        <div className="chart-grid">
          <Section title="Prices" subtitle={`Price each firm charged, by day${span}`}>
            <TimeChart data={prices} format={dollars} series={series} />
          </Section>
          <Section title="Market share" subtitle={`Share of the day's sales${span}`}>
            <ShareChart data={shares} series={series} height={220} />
          </Section>
          <Section
            title="Earnings"
            subtitle={`Daily sales revenue each firm learns from${span}`}
            info="Firms judge a price by the revenue it brings in that day. Making goods costs nothing beyond wages, which are fixed, so more revenue is always better for the firm."
          >
            <TimeChart data={earnings} format={dollars} series={series} />
          </Section>
          <Section
            title="Supply and sales"
            subtitle={`All firms combined${span}`}
            info="Each firm's 10 workers make 50 units a day. Anything not sold that day spoils. 'Could afford' counts households with enough cash and budget for the cheapest option when the market opened."
          >
            <TimeChart
              data={supply}
              format={units}
              series={[
                { key: 'produced', name: 'Made', color: palette.text3, dashed: true },
                { key: 'sold', name: 'Sold', color: palette.positive },
                { key: 'affordable', name: 'Could afford', color: palette.household },
                { key: 'expired', name: 'Spoiled', color: palette.negative },
              ]}
            />
          </Section>
        </div>
      </section>

      {transport && (
        <div className="transport-note">
          <strong>Transport</strong>
          <span>
            Every trip to a shop is paid to a single transport company at{' '}
            {money(state.config.transportCostPerTileCents ?? 0)} per tile, round trip.
          </span>
          <span className="num">
            {money(latest?.totalTransportRevenueCents ?? 0)} earned today · {transport.employeeIds.length} workers
          </span>
          <InfoTip label="About transport">
            Transport has a fixed rate and no location; it never competes. It is the reason distance matters: a cheaper
            shop far away can cost more than a pricier one next door.
          </InfoTip>
        </div>
      )}
    </div>
  )
}
