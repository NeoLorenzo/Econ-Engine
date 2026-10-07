import { useMemo, useState } from 'react'
import { INITIAL_HOUSEHOLD_CASH_CENTS } from '../../sim/config'
import type { SimulationState } from '../../sim/types'
import { DistributionChart } from '../charts'
import { EmptyState, Icon, Section, Stat } from '../components'
import { completionRate, CONSUMER_INDUSTRIES } from '../economyModel'
import { firmName, householdNumber, INDUSTRY_NAMES, money, percent } from '../format'
import { filterAndSortHouseholds, type HouseholdSort } from '../households'
import { palette } from '../theme'

const COLUMNS: { id: HouseholdSort; label: string; numeric?: boolean }[] = [
  { id: 'household', label: 'Household' },
  { id: 'employer', label: 'Works at' },
  { id: 'cash', label: 'Cash', numeric: true },
  { id: 'wage', label: 'Wage', numeric: true },
  { id: 'tax', label: 'Wealth tax', numeric: true },
  { id: 'transfer', label: 'Transfer', numeric: true },
  { id: 'net', label: 'Net change', numeric: true },
]

const signed = (cents: number) => `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${money(Math.abs(cents))}`

export function HouseholdsView({ state, onShowOnMap }: { state: SimulationState; onShowOnMap: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<HouseholdSort>('household')
  const [ascending, setAscending] = useState(true)
  const latest = state.metrics.at(-1)
  const startingCents = INITIAL_HOUSEHOLD_CASH_CENTS
  const rows = useMemo(
    () => filterAndSortHouseholds(state.households, query, sort, ascending),
    [state.households, query, sort, ascending],
  )
  const distribution = useMemo(
    () =>
      [...state.households]
        .sort((a, b) => a.preTaxCashCents - b.preTaxCashCents || a.id.localeCompare(b.id, undefined, { numeric: true }))
        .map((household, index) => ({
          rank: index + 1,
          id: household.id,
          before: household.preTaxCashCents,
          after: household.postFiscalCashCents,
        })),
    [state.households],
  )
  const before = distribution.map((household) => household.before)
  const unpaid = latest?.totalUnpaidWagesCents ?? 0

  const sortBy = (column: HouseholdSort) => {
    if (column === sort) setAscending((value) => !value)
    else {
      setSort(column)
      setAscending(column === 'household' || column === 'employer')
    }
  }

  return (
    <div className="view">
      <div className="stat-row">
        <Stat
          label="Typical cash"
          value={latest ? money(latest.householdCashMedianCents) : money(startingCents)}
          detail={`Everyone started with ${money(startingCents)}`}
          spark={state.metrics.map((metric) => metric.householdCashMedianCents)}
          sparkColor={palette.household}
        />
        <Stat
          label="Spread before redistribution"
          value={latest ? `${money(Math.min(...before))} – ${money(Math.max(...before))}` : '—'}
          detail="poorest to richest, before tax and transfers"
          info="What the market alone left each household with today, after wages and shopping but before Government's wealth tax and transfers."
        />
        <Stat
          label="Needs met"
          value={latest ? percent(completionRate(latest, state.households.length)) : '—'}
          detail="of purchases completed"
          spark={state.metrics.map((metric) => completionRate(metric, state.households.length))}
          sparkColor={palette.positive}
        />
        <Stat
          label="Average wage"
          value={latest ? money(latest.meanDailyWageCents) : '—'}
          detail={unpaid > 0 ? `${money(unpaid)} of promised wages went unpaid` : 'All promised wages paid'}
          tone={unpaid > 0 ? 'warning' : undefined}
          spark={state.metrics.map((metric) => metric.meanDailyWageCents)}
          sparkColor={palette.firmA}
        />
      </div>

      <Section
        title="Who has what"
        subtitle="Each bar is one household. Bars show cash before Government steps in; the line shows what each ends the day with."
        info="The dashed line marks the starting cash. When the line is flat, the wealth tax and transfers have fully evened households out."
      >
        {latest ? (
          <DistributionChart data={distribution} startingCents={startingCents} />
        ) : (
          <EmptyState>Run the simulation to see how cash spreads out between households.</EmptyState>
        )}
      </Section>

      <Section
        title="All households"
        subtitle={`${rows.length} of ${state.households.length} shown · today's figures · click a household to see it on the map`}
        actions={
          <label className="search-field">
            <Icon name="search" size={14} />
            <input
              type="search"
              aria-label="Search households"
              placeholder="Search by number or employer"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        }
      >
        <div className="table-wrap table-wrap--tall">
          <table className="data-table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    className={column.numeric ? 'num' : undefined}
                    aria-sort={sort === column.id ? (ascending ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" onClick={() => sortBy(column.id)}>
                      {column.label}
                      <span className="sort-mark" aria-hidden="true">
                        {sort === column.id ? (ascending ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  </th>
                ))}
                <th>Bought today</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((household) => (
                <tr key={household.id}>
                  <td>
                    <button
                      type="button"
                      className="link"
                      title="Show on the map"
                      onClick={() => onShowOnMap(household.id)}
                    >
                      H{householdNumber(household.id)}
                    </button>
                  </td>
                  <td>{firmName(household.employerFirmId)}</td>
                  <td className="num">{money(household.postFiscalCashCents)}</td>
                  <td className="num">
                    {money(household.wageTodayCents)}
                    {household.unpaidWageTodayCents > 0 && (
                      <small className="warn"> −{money(household.unpaidWageTodayCents)}</small>
                    )}
                  </td>
                  <td className="num">{money(household.taxPaidTodayCents)}</td>
                  <td className="num">{money(household.transferReceivedTodayCents)}</td>
                  <td
                    className={`num ${household.netCashChangeTodayCents < 0 ? 'neg' : household.netCashChangeTodayCents > 0 ? 'pos' : ''}`}
                  >
                    {signed(household.netCashChangeTodayCents)}
                  </td>
                  <td>
                    <span className="needs">
                      {CONSUMER_INDUSTRIES.map((industryId) => {
                        const outcome = household.industryOutcomes[industryId].purchaseOutcomeToday
                        const label = `${INDUSTRY_NAMES[industryId]}: ${outcome === 'purchased' ? 'bought' : outcome === 'insufficient_funds' ? "couldn't afford" : outcome === 'stockout' ? 'sold out' : 'not yet'}`
                        return (
                          <i
                            key={industryId}
                            className={`need need--${outcome ?? 'none'}`}
                            title={label}
                            aria-label={label}
                            role="img"
                          />
                        )
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-key">
          <span className="needs">
            <i className="need need--purchased" />
          </span>{' '}
          bought{' '}
          <span className="needs">
            <i className="need need--insufficient_funds" />
          </span>{' '}
          couldn't afford{' '}
          <span className="needs">
            <i className="need need--stockout" />
          </span>{' '}
          sold out — in order: food, utilities, healthcare, entertainment.
        </p>
      </Section>
    </div>
  )
}
