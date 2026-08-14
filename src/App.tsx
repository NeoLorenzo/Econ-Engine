import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DEFAULT_INDUSTRIES, DEFAULT_SEED, TOTAL_MONEY_CENTS } from './sim/config'
import { createSimulation, stepSimulation } from './sim/engine'
import { runMultiIndustryExperiment, type MultiIndustryExperimentResult } from './sim/scarcityExperiment'
import { runCompetitionStartingPriceGrid, type CompetitionGridSuite } from './sim/competitionGridExperiment'
import type { IndustryId, SimulationConfig, SimulationState } from './sim/types'
import { groupEventsForDisplay } from './ui/groupEventsForDisplay'
import { transportQuote } from './sim/spatial'

const money = (cents: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(cents / 100)
const colors: Record<IndustryId, string> = { food: '#deff75', utilities: '#65bfa1', transport: '#97a3ff', healthcare: '#d6a866', entertainment: '#d47c9b' }
const firmColor = (firmId: string, industryId: IndustryId) => firmId === 'firm-entertainment-b' ? '#f09a63' : colors[industryId]
const chartTooltip = { background: '#111715', border: '1px solid #28322e', borderRadius: 8, color: '#f4f7f5' }
const DEFAULT_FIRM_START_DRAFT: Record<string, string> = {
  'firm-food': '2.00',
  'firm-utilities': '2.00',
  'firm-healthcare': '2.00',
  'firm-entertainment-a': '2.00',
  'firm-entertainment-b': '2.00',
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return <div className={`metric ${accent ? 'metric--accent' : ''}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

function PriceChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((metric) => Object.fromEntries([['day', metric.day], ...metric.markets.map((market) => [market.firmId, market.postedPriceCents / 100])]))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -12 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" /><YAxis stroke="#69756f" tickFormatter={(value) => `$${value}`} /><Tooltip contentStyle={chartTooltip} formatter={(value) => money(Number(value) * 100)} labelFormatter={(value) => `Day ${value}`} />{state.firms.filter(({ industryId }) => industryId !== 'transport').map((firm) => <Line key={firm.id} type="monotone" dataKey={firm.id} name={firm.id.replace('firm-', '')} stroke={firmColor(firm.id, firm.industryId)} dot={false} strokeWidth={1.8} />)}</LineChart></ResponsiveContainer>
}

function ProfitChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((metric) => Object.fromEntries([['day', metric.day], ...metric.markets.map((market) => [market.firmId, market.preTaxProfitCents])]))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -4 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" /><YAxis stroke="#69756f" tickFormatter={(value) => `$${Number(value) / 100}`} /><Tooltip contentStyle={chartTooltip} formatter={(value) => money(Number(value))} labelFormatter={(value) => `Day ${value}`} />{state.firms.filter(({ industryId }) => industryId !== 'transport').map((firm) => <Line key={firm.id} type="monotone" dataKey={firm.id} name={firm.id.replace('firm-', '')} stroke={firmColor(firm.id, firm.industryId)} dot={false} strokeWidth={1.8} />)}</LineChart></ResponsiveContainer>
}

function MarketFlowChart({ state, industryId }: { state: SimulationState; industryId: IndustryId }) {
  const data = state.metrics.map((metric) => { const markets = metric.markets.filter((item) => item.industryId === industryId); return { day: metric.day, affordable: Math.max(...markets.map((market) => market.householdsAffordableAtMarketOpen)), supplied: markets.reduce((sum, market) => sum + market.unitsSupplied, 0), sold: markets.reduce((sum, market) => sum + market.unitsSold, 0), expired: markets.reduce((sum, market) => sum + market.unitsExpired, 0) } })
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -16 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" /><YAxis stroke="#69756f" allowDecimals={false} /><Tooltip contentStyle={chartTooltip} labelFormatter={(value) => `Day ${value}`} /><Line dataKey="affordable" name="Affordable" stroke="#65bfa1" dot={false} /><Line dataKey="supplied" name="Supplied" stroke="#97a3ff" dot={false} strokeDasharray="5 5" /><Line dataKey="sold" name="Sold" stroke="#d6a866" dot={false} /><Line dataKey="expired" name="Expired" stroke="#d47c6b" dot={false} /></LineChart></ResponsiveContainer>
}

function WealthChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((metric) => ({ day: metric.day, minimum: metric.householdCashMinimumCents, median: metric.householdCashMedianCents, maximum: metric.householdCashMaximumCents }))
  const first = data[0]
  const isDynamic = first !== undefined && data.some(({ minimum, median, maximum }) => minimum !== maximum || minimum !== first.minimum || median !== first.median || maximum !== first.maximum)
  if (!isDynamic) return <div className="wealth-chart--hidden" aria-hidden="true" />
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -4 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" /><YAxis stroke="#69756f" tickFormatter={(value) => `$${Number(value) / 100}`} /><Tooltip contentStyle={chartTooltip} formatter={(value) => money(Number(value))} labelFormatter={(value) => `Day ${value}`} /><Line dataKey="minimum" name="Minimum" stroke="#d47c6b" dot={false} /><Line dataKey="median" name="Median" stroke="#deff75" dot={false} strokeWidth={2} /><Line dataKey="maximum" name="Maximum" stroke="#97a3ff" dot={false} /></LineChart></ResponsiveContainer>
}

function SpatialGrid({ state }: { state: SimulationState }) {
  const firms = state.firms.filter(({ industryId }) => industryId === 'entertainment')
  const entities = [...state.households, ...firms]
  return <section className="panel spatial-panel"><div className="panel-heading"><div><h2>Entertainment spatial world</h2><p>Fixed seeded coordinates · Manhattan round trips · no intermediate movement</p></div><div className="map-legend"><span>Households</span><span>Firm A</span><span>Firm B</span></div></div><div className="spatial-scroll"><div className="spatial-grid" style={{ gridTemplateColumns: `repeat(${state.config.gridWidth}, 1fr)`, gridTemplateRows: `repeat(${state.config.gridHeight}, 1fr)` }}>{entities.map((entity) => {
    const isHousehold = entity.id.startsWith('household-'); const coordinate = entity.coordinate!
    const label = isHousehold ? entity.id.replace('household-', '') : entity.id.endsWith('-a') ? 'A' : 'B'
    let title = `${entity.id} (${coordinate.x}, ${coordinate.y})`
    if (isHousehold) { const h = entity as SimulationState['households'][number]; const a = transportQuote(h.coordinate, firms[0].coordinate!, state.config.transportCostPerTileCents!); const b = transportQuote(h.coordinate, firms[1].coordinate!, state.config.transportCostPerTileCents!); title += ` · A ${a.oneWayDistance} tiles / ${money(firms[0].postedPriceCents + a.transportFeeCents)} delivered · B ${b.oneWayDistance} tiles / ${money(firms[1].postedPriceCents + b.transportFeeCents)} delivered · today ${h.entertainmentToday?.chosenFirmId ?? 'none'}` }
    return <button key={entity.id} className={`map-entity ${isHousehold ? 'map-household' : entity.id.endsWith('-a') ? 'map-firm-a' : 'map-firm-b'}`} title={title} aria-label={title} style={{ gridColumn: coordinate.x + 1, gridRow: coordinate.y + 1 }}>{label}</button>
  })}</div></div></section>
}

export default function App() {
  const [draft, setDraft] = useState({ firmStarts: DEFAULT_FIRM_START_DRAFT, step: '1.00', dailySupply: '10', seed: String(DEFAULT_SEED), transportRate: '0.02' })
  const [state, setState] = useState(() => createSimulation())
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryId>('food')
  const [experiment, setExperiment] = useState<MultiIndustryExperimentResult | null>(null)
  const [competitionGrid, setCompetitionGrid] = useState<CompetitionGridSuite | null>(null)
  const step = () => setState((current) => stepSimulation(current))
  const reset = () => {
    const firmStartingPricesCents = Object.fromEntries(Object.entries(draft.firmStarts).map(([firmId, value]) => [firmId, Math.max(1, Math.round(Number(value || 0) * 100))]))
    const config: SimulationConfig = { startingPriceCents: 200, firmStartingPricesCents, initialStepCents: Math.max(1, Math.round(Number(draft.step || 0) * 100)), dailySupplyPerIndustry: Math.max(0, Math.round(Number(draft.dailySupply || 0))), seed: Math.round(Number(draft.seed || DEFAULT_SEED)), transportCostPerTileCents: Math.max(0, Math.round(Number(draft.transportRate || 0) * 100)) }
    setRunning(false); setState(createSimulation(config))
  }
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setState((current) => { let next = current; for (let index = 0; index < (speed === 100 ? 5 : 1); index += 1) next = stepSimulation(next); return next }), speed === 100 ? 50 : 1000 / speed)
    return () => window.clearInterval(timer)
  }, [running, speed])
  const latest = state.metrics.at(-1)
  const recentEvents = useMemo(() => groupEventsForDisplay(state.events).reverse().slice(0, 30), [state.events])
  const settledCount = state.firms.filter(({ industryId, pricing }) => industryId !== 'transport' && pricing.locallySettled).length

  return <main>
    <header className="hero"><div className="eyebrow">MVP 4 · Spatial Entertainment</div><div className="hero-row"><div><h1>Econ<span>—</span>Engine</h1><p>Households choose between two Entertainment firms by delivered cost while Food, Utilities, and Healthcare remain non-spatial controls.</p></div><div className="system-note"><i />Deterministic · $500 closed circuit</div></div></header>
    <section className="control-bar panel">
      <div className="run-controls"><button className="primary" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : 'Run simulation'}</button><button onClick={step} disabled={running}>Step one day</button><button onClick={reset}>Reset with values</button></div>
      <div className="configuration">
        <div className="firm-starts"><span>Adaptive firm starting prices</span>{state.firms.filter(({ industryId }) => industryId !== 'transport').map((firm) => <label key={firm.id}>{firm.id.replace('firm-', '').replace('entertainment-', 'ent. ')} <span>$</span><input inputMode="decimal" aria-label={`${firm.id} starting price`} value={draft.firmStarts[firm.id] ?? '2.00'} onChange={(event) => setDraft({ ...draft, firmStarts: { ...draft.firmStarts, [firm.id]: event.target.value } })} /></label>)}</div>
        <div className="config-controls"><label>Initial step <span>$</span><input inputMode="decimal" value={draft.step} onChange={(event) => setDraft({ ...draft, step: event.target.value })} /></label><label>Supply each<input inputMode="numeric" value={draft.dailySupply} onChange={(event) => setDraft({ ...draft, dailySupply: event.target.value })} /></label><label>Transport / tile <span>$</span><input inputMode="decimal" value={draft.transportRate} onChange={(event) => setDraft({ ...draft, transportRate: event.target.value })} /></label><label>Seed<input inputMode="numeric" aria-label="Random seed" value={draft.seed} onChange={(event) => setDraft({ ...draft, seed: event.target.value })} /></label><label>Speed<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[1, 5, 20, 100].map((value) => <option key={value} value={value}>{value} days/sec</option>)}</select></label></div>
      </div>
    </section>

    <section className="baseline panel"><div><span>Spatial world</span><strong>{state.config.gridWidth} × {state.config.gridHeight} tiles</strong></div><div><span>Entertainment supply</span><strong>{state.config.dailySupplyPerIndustry} per firm</strong></div><div><span>Travel rate</span><strong>{money(state.config.transportCostPerTileCents!)} / tile</strong></div><div><span>Parity target</span><strong>$50 per household</strong></div></section>
    <section className="metrics-grid"><Metric label="Current day" value={String(state.day)} detail={running ? 'Running' : 'Paused'} /><Metric label="Transport revenue" value={money(latest?.totalTransportRevenueCents ?? 0)} detail={`${latest?.totalTilesTravelled ?? 0} tiles`} /><Metric label="Pre-parity Gini" value={(latest?.householdCashGiniBeforeParity ?? 0).toFixed(3)} detail="Geographic spending" /><Metric label="Post-parity Gini" value={(latest?.householdCashGini ?? 0).toFixed(3)} detail="Explicit transfers" /><Metric label="Total money" value={money(latest?.totalMoneyCents ?? TOTAL_MONEY_CENTS)} detail="✓ Exact closed circuit" accent /><Metric label="Locally settled" value={`${settledCount} / 5`} detail={`Seed ${state.config.seed}`} accent={settledCount === 5} /></section>
    <SpatialGrid state={state} />

    <section className="panel market-overview"><div className="panel-heading"><div><h2>Market overview</h2><p>Entertainment rows expose competition; market share is observer-only</p></div></div><div className="market-table-wrap"><table><thead><tr><th>Industry / firm</th><th>Budget</th><th>Tested</th><th>Next</th><th>Incumbent</th><th>Sold / supplied</th><th>Profit</th><th>Share</th><th>Learner status</th></tr></thead><tbody>{state.firms.map((firm) => { const result = latest?.markets.find(({ firmId }) => firmId === firm.id); const industry = state.industries.find(({ id }) => id === firm.industryId)!; const status = firm.pricing.probing ? `Probing ${firm.pricing.probeDirection}` : firm.pricing.locallySettled ? 'Locally settled' : `Searching · ${money(firm.pricing.stepSizeCents)}`; return <tr key={firm.id}><td><i style={{ background: firmColor(firm.id, firm.industryId) }} />{industry.name} · {firm.id.replace(`firm-${firm.industryId}`, '') || 'sole'}</td><td>{money(industry.householdBudgetCents)}</td><td>{result ? money(result.postedPriceCents) : '—'}</td><td>{money(firm.postedPriceCents)}</td><td>{money(firm.pricing.incumbentPriceCents)}</td><td>{result ? `${result.unitsSold} / ${result.unitsSupplied}` : '—'}</td><td>{money(result?.preTaxProfitCents ?? 0)}</td><td>{result ? `${(result.marketShare * 100).toFixed(0)}%` : '—'}</td><td>{status}</td></tr> })}</tbody></table></div></section>

    <section className="charts-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Price trajectories</h2><p>All five independent learners</p></div></div><div className="chart-wrap"><PriceChart state={state} /></div></section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Profit trajectories</h2><p>Zero-cost realised revenue by firm</p></div></div><div className="chart-wrap"><ProfitChart state={state} /></div></section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Selected market capacity</h2><p>Affordability, finite supply, sales, and expiration</p></div><select value={selectedIndustry} onChange={(event) => setSelectedIndustry(event.target.value as IndustryId)}>{DEFAULT_INDUSTRIES.map((industry) => <option key={industry.id} value={industry.id}>{industry.name}</option>)}</select></div><div className="chart-wrap"><MarketFlowChart state={state} industryId={selectedIndustry} /></div></section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Household wealth</h2><p>End-of-day minimum, median, and maximum cash</p></div></div><div className="chart-wrap"><WealthChart state={state} /></div></section></section>

    <section className="panel experiment-panel"><div className="panel-heading"><div><h2>Competition experiment</h2><p>Entertainment A starts $1; B starts $8; seeded probes continue for 300 days</p></div><button onClick={() => setExperiment(runMultiIndustryExperiment({ seed: state.config.seed }))}>{experiment ? 'Run again' : 'Run experiment'}</button></div>{experiment ? <div className="market-table-wrap"><table><thead><tr><th>Firm</th><th>Start</th><th>Tested price</th><th>Incumbent</th><th>Settled day</th><th>Final sales</th><th>Share</th></tr></thead><tbody>{experiment.firms.map((firm) => <tr key={firm.firmId}><td>{firm.firmId}</td><td>{money(firm.startingPriceCents)}</td><td>{money(firm.finalPriceCents)}</td><td>{firm.convergedPriceCents === null ? 'Still searching' : money(firm.convergedPriceCents)}</td><td>{firm.daysToConvergence ?? `>${experiment.horizonDays}`}</td><td>{firm.finalUnitsSold}</td><td>{(firm.finalMarketShare * 100).toFixed(0)}%</td></tr>)}</tbody></table><p className="experiment-result">Seed {state.config.seed} · final cash {money(experiment.finalHouseholdCashMinimumCents)} / {money(experiment.finalHouseholdCashMedianCents)} / {money(experiment.finalHouseholdCashMaximumCents)} · Gini {experiment.finalHouseholdCashGini.toFixed(3)} · total money {money(experiment.totalMoneyCents)}</p></div> : <div className="experiment-empty">Entertainment competitors learn only from their own realised sales and profit. Local settlement never disables future probes.</div>}</section>
    <section className="panel experiment-panel grid-experiment"><div className="panel-heading"><div><h2>Seeded starting-price sample</h2><p>$1, $5, $8 A/B subset · cell = incumbents after 300 days</p></div><button onClick={() => setCompetitionGrid(runCompetitionStartingPriceGrid({ startingPricesCents: [100, 500, 800], seed: state.config.seed }))}>{competitionGrid ? 'Run sample again' : 'Run 3×3 sample'}</button></div>{competitionGrid ? <div className="competition-matrix-wrap"><table><thead><tr><th>A \ B</th>{competitionGrid.startingPricesCents.map((start) => <th key={start}>{money(start)}</th>)}</tr></thead><tbody>{competitionGrid.startingPricesCents.map((aStart) => <tr key={aStart}><th>{money(aStart)}</th>{competitionGrid.startingPricesCents.map((bStart) => { const result = competitionGrid.results.find((item) => item.firmAStartCents === aStart && item.firmBStartCents === bStart)!; return <td key={bStart} title={`A settled day ${result.firmAConvergenceDay ?? '—'} · B settled day ${result.firmBConvergenceDay ?? '—'}`}>{result.bothConverged ? `${money(result.firmAEndpointCents!)} / ${money(result.firmBEndpointCents!)}` : `Still searching at D${competitionGrid.horizonDays}`}</td> })}</tr>)}</tbody></table></div> : <div className="experiment-empty">Runs $5/$5 and $1/$8 within a compact seeded subset. All firms remain capable of probing after local settlement.</div>}</section>

    <section className="inspection-grid"><section className="panel agent-panel"><div className="panel-heading"><div><h2>Household inspection</h2><p>One real cash balance; industry-keyed daily and lifetime outcomes</p></div></div><div className="households"><div className="table-head"><span>Household</span><span>Cash</span><span>Today</span><span>Lifetime totals</span></div>{state.households.map((household) => { const outcomes = Object.values(household.industryOutcomes); return <div className="household-row" key={household.id}><span>{household.id.replace('household-', 'H')}</span><strong>{money(household.cashCents)}</strong><span>{state.day === 0 ? 'Waiting' : `${outcomes.filter(({ purchasedToday }) => purchasedToday).length}/5 purchased`}</span><span>{outcomes.reduce((sum, item) => sum + item.lifetimeUnitsPurchased, 0)} bought · {outcomes.reduce((sum, item) => sum + item.lifetimeStockoutFailures, 0)}S · {outcomes.reduce((sum, item) => sum + item.lifetimeAffordabilityFailures, 0)}A</span></div> })}</div></section><section className="panel ledger"><div className="panel-heading"><div><h2>Recent event ledger</h2><p>Market summaries retain granular raw events</p></div></div><div className="event-list">{recentEvents.map((event) => <div className="event" key={event.key}><span>D{event.day}</span><div><strong>{event.type}</strong><p>{event.description}</p>{event.grouped && <details><summary>Show {event.details.length} raw events</summary><div className="event-details">{event.details.map((detail) => <p key={detail.id}>{detail.description}</p>)}</div></details>}</div></div>)}</div></section></section>
    <footer><p><strong>Stable controls, emergent competition.</strong> Four monopoly firms retain $15 / $12 / $10 / $8 benchmarks; Entertainment prices emerge from realised competitive outcomes.</p><span>Market share and competitor comparisons are observer analytics, never firm inputs.</span></footer>
  </main>
}
