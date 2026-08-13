import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DEFAULT_INDUSTRIES, TOTAL_MONEY_CENTS } from './sim/config'
import { createSimulation, stepSimulation } from './sim/engine'
import { MULTI_INDUSTRY_STARTING_PRICES_CENTS, runMultiIndustryExperiment, type MultiIndustryExperimentResult } from './sim/scarcityExperiment'
import type { IndustryId, SimulationConfig, SimulationState } from './sim/types'
import { groupEventsForDisplay } from './ui/groupEventsForDisplay'

const money = (cents: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(cents / 100)
const colors: Record<IndustryId, string> = { food: '#deff75', utilities: '#65bfa1', transport: '#97a3ff', healthcare: '#d6a866', entertainment: '#d47c9b' }
const chartTooltip = { background: '#111715', border: '1px solid #28322e', borderRadius: 8, color: '#f4f7f5' }

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return <div className={`metric ${accent ? 'metric--accent' : ''}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

function PriceChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((metric) => Object.fromEntries([['day', metric.day], ...metric.markets.map((market) => [market.industryId, market.postedPriceCents / 100])]))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -12 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" /><YAxis stroke="#69756f" tickFormatter={(value) => `$${value}`} /><Tooltip contentStyle={chartTooltip} formatter={(value) => money(Number(value) * 100)} labelFormatter={(value) => `Day ${value}`} />{DEFAULT_INDUSTRIES.map((industry) => <Line key={industry.id} type="monotone" dataKey={industry.id} name={industry.name} stroke={colors[industry.id]} dot={false} strokeWidth={1.8} />)}</LineChart></ResponsiveContainer>
}

function ProfitChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((metric) => Object.fromEntries([['day', metric.day], ...metric.markets.map((market) => [market.industryId, market.preTaxProfitCents])]))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -4 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" /><YAxis stroke="#69756f" tickFormatter={(value) => `$${Number(value) / 100}`} /><Tooltip contentStyle={chartTooltip} formatter={(value) => money(Number(value))} labelFormatter={(value) => `Day ${value}`} />{DEFAULT_INDUSTRIES.map((industry) => <Line key={industry.id} type="monotone" dataKey={industry.id} name={industry.name} stroke={colors[industry.id]} dot={false} strokeWidth={1.8} />)}</LineChart></ResponsiveContainer>
}

function MarketFlowChart({ state, industryId }: { state: SimulationState; industryId: IndustryId }) {
  const data = state.metrics.map((metric) => { const market = metric.markets.find((item) => item.industryId === industryId)!; return { day: metric.day, affordable: market.householdsAffordableAtMarketOpen, supplied: market.unitsSupplied, sold: market.unitsSold, expired: market.unitsExpired } })
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -16 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" /><YAxis stroke="#69756f" allowDecimals={false} /><Tooltip contentStyle={chartTooltip} labelFormatter={(value) => `Day ${value}`} /><Line dataKey="affordable" name="Affordable" stroke="#65bfa1" dot={false} /><Line dataKey="supplied" name="Supplied" stroke="#97a3ff" dot={false} strokeDasharray="5 5" /><Line dataKey="sold" name="Sold" stroke="#d6a866" dot={false} /><Line dataKey="expired" name="Expired" stroke="#d47c6b" dot={false} /></LineChart></ResponsiveContainer>
}

function WealthChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((metric) => ({ day: metric.day, minimum: metric.householdCashMinimumCents, median: metric.householdCashMedianCents, maximum: metric.householdCashMaximumCents }))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -4 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" /><YAxis stroke="#69756f" tickFormatter={(value) => `$${Number(value) / 100}`} /><Tooltip contentStyle={chartTooltip} formatter={(value) => money(Number(value))} labelFormatter={(value) => `Day ${value}`} /><Line dataKey="minimum" name="Minimum" stroke="#d47c6b" dot={false} /><Line dataKey="median" name="Median" stroke="#deff75" dot={false} strokeWidth={2} /><Line dataKey="maximum" name="Maximum" stroke="#97a3ff" dot={false} /></LineChart></ResponsiveContainer>
}

export default function App() {
  const [draft, setDraft] = useState({ startingPrice: '2.00', step: '1.00', dailySupply: '10' })
  const [state, setState] = useState(() => createSimulation())
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryId>('food')
  const [experiment, setExperiment] = useState<MultiIndustryExperimentResult | null>(null)
  const step = () => setState((current) => stepSimulation(current))
  const reset = () => {
    const config: SimulationConfig = { startingPriceCents: Math.max(1, Math.round(Number(draft.startingPrice || 0) * 100)), initialStepCents: Math.max(1, Math.round(Number(draft.step || 0) * 100)), dailySupplyPerIndustry: Math.max(0, Math.round(Number(draft.dailySupply || 0))) }
    setRunning(false); setState(createSimulation(config))
  }
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setState((current) => { let next = current; for (let index = 0; index < (speed === 100 ? 5 : 1); index += 1) next = stepSimulation(next); return next }), speed === 100 ? 50 : 1000 / speed)
    return () => window.clearInterval(timer)
  }, [running, speed])
  const latest = state.metrics.at(-1)
  const recentEvents = useMemo(() => groupEventsForDisplay(state.events).reverse().slice(0, 30), [state.events])
  const convergedCount = state.firms.filter(({ pricing }) => pricing.converged).length

  return <main>
    <header className="hero"><div className="eyebrow">MVP 2.1 · Industry-Specific Demand Boundaries</div><div className="hero-row"><div><h1>Econ<span>—</span>Engine</h1><p>Five independently learning firms discover distinct fixed demand boundaries while household symmetry preserves the stable monetary circuit.</p></div><div className="system-note"><i />Deterministic · $500 closed circuit</div></div></header>
    <section className="control-bar panel"><div className="run-controls"><button className="primary" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : 'Run simulation'}</button><button onClick={step} disabled={running}>Step one day</button><button onClick={reset}>Reset</button></div><div className="config-controls"><label>Common start $<input value={draft.startingPrice} onChange={(event) => setDraft({ ...draft, startingPrice: event.target.value })} /></label><label>Initial step $<input value={draft.step} onChange={(event) => setDraft({ ...draft, step: event.target.value })} /></label><label>Supply each<input value={draft.dailySupply} onChange={(event) => setDraft({ ...draft, dailySupply: event.target.value })} /></label><label>Speed<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[1, 5, 20, 100].map((value) => <option key={value} value={value}>{value} days/sec</option>)}</select></label></div></section>

    <section className="baseline panel"><div><span>Baseline configuration</span><strong>10 households · 5 industries · 5 firms</strong></div><div><span>Supply</span><strong>{state.config.dailySupplyPerIndustry} each</strong></div><div><span>Industry budgets</span><strong>$15 · $12 · $10 · $8 · $5</strong></div><div><span>Initial household cash</span><strong>$50</strong></div></section>
    <section className="metrics-grid"><Metric label="Current day" value={String(state.day)} detail={running ? 'Running' : 'Paused'} /><Metric label="Daily revenue" value={money(latest?.totalRevenueCents ?? 0)} detail="Across five firms" /><Metric label="Household cash" value={latest ? `${money(latest.householdCashMinimumCents)}–${money(latest.householdCashMaximumCents)}` : '$50.00'} detail="Minimum–maximum" /><Metric label="Cash Gini" value={(latest?.householdCashGini ?? 0).toFixed(3)} detail="Observer metric" /><Metric label="Total money" value={money(latest?.totalMoneyCents ?? TOTAL_MONEY_CENTS)} detail="✓ Budgets excluded" accent /><Metric label="Firms converged" value={`${convergedCount} / 5`} detail="Independent learners" accent={convergedCount === 5} /></section>

    <section className="panel market-overview"><div className="panel-heading"><div><h2>Market overview</h2><p>Fixed household budget is each market's experimental demand boundary</p></div></div><div className="market-table-wrap"><table><thead><tr><th>Industry</th><th>Household budget</th><th>Tested</th><th>Next</th><th>Sold / supplied</th><th>Profit</th><th>Convergence</th></tr></thead><tbody>{state.firms.map((firm) => { const result = latest?.markets.find(({ industryId }) => industryId === firm.industryId); const industry = state.industries.find(({ id }) => id === firm.industryId)!; return <tr key={firm.id}><td><i style={{ background: colors[firm.industryId] }} />{industry.name}</td><td>{money(industry.householdBudgetCents)}</td><td>{result ? money(result.postedPriceCents) : '—'}</td><td>{money(firm.postedPriceCents)}</td><td>{result ? `${result.unitsSold} / ${result.unitsSupplied}` : '—'}</td><td>{money(result?.preTaxProfitCents ?? 0)}</td><td>{firm.pricing.converged ? 'Converged' : `Exploring · ${money(firm.pricing.stepSizeCents)}`}</td></tr> })}</tbody></table></div></section>

    <section className="charts-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Price trajectories</h2><p>All five independent learners</p></div></div><div className="chart-wrap"><PriceChart state={state} /></div></section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Profit trajectories</h2><p>Zero-cost realised revenue by firm</p></div></div><div className="chart-wrap"><ProfitChart state={state} /></div></section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Selected market capacity</h2><p>Affordability, finite supply, sales, and expiration</p></div><select value={selectedIndustry} onChange={(event) => setSelectedIndustry(event.target.value as IndustryId)}>{DEFAULT_INDUSTRIES.map((industry) => <option key={industry.id} value={industry.id}>{industry.name}</option>)}</select></div><div className="chart-wrap"><MarketFlowChart state={state} industryId={selectedIndustry} /></div></section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Household wealth</h2><p>End-of-day minimum, median, and maximum cash</p></div></div><div className="chart-wrap"><WealthChart state={state} /></div></section></section>

    <section className="panel experiment-panel"><div className="panel-heading"><div><h2>Five-firm convergence experiment</h2><p>Varied starts, $1 step, 10 units per market, 300-day horizon</p></div><button onClick={() => setExperiment(runMultiIndustryExperiment())}>{experiment ? 'Run again' : 'Run experiment'}</button></div>{experiment ? <div className="market-table-wrap"><table><thead><tr><th>Industry</th><th>Start</th><th>Endpoint</th><th>Convergence day</th></tr></thead><tbody>{experiment.firms.map((firm) => <tr key={firm.firmId}><td>{firm.industryId}</td><td>{money(firm.startingPriceCents)}</td><td>{firm.convergedPriceCents === null ? 'No convergence' : money(firm.convergedPriceCents)}</td><td>{firm.daysToConvergence ?? `>${experiment.horizonDays}`}</td></tr>)}</tbody></table><p className="experiment-result">Final cash {money(experiment.finalHouseholdCashMinimumCents)} / {money(experiment.finalHouseholdCashMedianCents)} / {money(experiment.finalHouseholdCashMaximumCents)} · Gini {experiment.finalHouseholdCashGini.toFixed(3)} · total money {money(experiment.totalMoneyCents)}</p></div> : <div className="experiment-empty">Starts: {Object.entries(MULTI_INDUSTRY_STARTING_PRICES_CENTS).map(([id, price]) => `${id} ${money(price)}`).join(' · ')}. The benchmark is validation information, never firm knowledge.</div>}</section>

    <section className="inspection-grid"><section className="panel agent-panel"><div className="panel-heading"><div><h2>Household inspection</h2><p>One real cash balance; industry-keyed daily and lifetime outcomes</p></div></div><div className="households"><div className="table-head"><span>Household</span><span>Cash</span><span>Today</span><span>Lifetime totals</span></div>{state.households.map((household) => { const outcomes = Object.values(household.industryOutcomes); return <div className="household-row" key={household.id}><span>{household.id.replace('household-', 'H')}</span><strong>{money(household.cashCents)}</strong><span>{state.day === 0 ? 'Waiting' : `${outcomes.filter(({ purchasedToday }) => purchasedToday).length}/5 purchased`}</span><span>{outcomes.reduce((sum, item) => sum + item.lifetimeUnitsPurchased, 0)} bought · {outcomes.reduce((sum, item) => sum + item.lifetimeStockoutFailures, 0)}S · {outcomes.reduce((sum, item) => sum + item.lifetimeAffordabilityFailures, 0)}A</span></div> })}</div></section><section className="panel ledger"><div className="panel-heading"><div><h2>Recent event ledger</h2><p>Market summaries retain granular raw events</p></div></div><div className="event-list">{recentEvents.map((event) => <div className="event" key={event.key}><span>D{event.day}</span><div><strong>{event.type}</strong><p>{event.description}</p>{event.grouped && <details><summary>Show {event.details.length} raw events</summary><div className="event-details">{event.details.map((detail) => <p key={detail.id}>{detail.description}</p>)}</div></details>}</div></div>)}</div></section></section>
    <footer><p><strong>Stable demand-boundary benchmark.</strong> At $15 / $12 / $10 / $8 / $5, each household spends $50 and receives $50 from pooled taxes.</p><span>Industry budgets are fixed experimental constraints, not wallets or monetary assets.</span></footer>
  </main>
}
