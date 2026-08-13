import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { createSimulation, stepSimulation } from './sim/engine'
import { runStartingPriceExperiments, SCARCITY_EXPERIMENT_STARTING_PRICES_CENTS, type ScarcityExperimentSuite } from './sim/scarcityExperiment'
import type { PriceDecisionAction, SimulationConfig, SimulationState } from './sim/types'
import { groupEventsForDisplay } from './ui/groupEventsForDisplay'

const money = (cents: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(cents / 100)
const SPEEDS = [1, 5, 20, 100]
const DECISION_SYMBOLS: Record<PriceDecisionAction, string> = {
  increase: '↑',
  decrease: '↓',
  refine: '◇',
  hold: '—',
  converged: '✓',
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return <div className={`metric ${accent ? 'metric--accent' : ''}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="panel chart-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="chart-wrap">{children}</div></section>
}

const chartTooltip = { background: '#111715', border: '1px solid #28322e', borderRadius: 8, color: '#f4f7f5' }

function PriceChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((m) => ({ day: m.day, posted: m.postedPriceCents / 100, best: m.bestKnownPriceCents / 100 }))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" tickLine={false} axisLine={false} /><YAxis stroke="#69756f" tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} formatter={(v) => money(Number(v ?? 0) * 100)} labelFormatter={(v) => `Day ${v}`} /><Line type="monotone" dataKey="posted" name="Tested price" stroke="#deff75" dot={false} strokeWidth={2} /><Line type="stepAfter" dataKey="best" name="Best known" stroke="#65bfa1" dot={false} strokeWidth={1.5} strokeDasharray="5 5" /></LineChart></ResponsiveContainer>
}

function SimpleChart({ state, field, color, formatter = (v) => String(v) }: { state: SimulationState; field: 'preTaxProfitCents' | 'priceStepSizeCents'; color: string; formatter?: (value: number) => string }) {
  const data = state.metrics.map((m) => ({ day: m.day, value: m[field] }))
  const name = field === 'priceStepSizeCents' ? 'Search step' : 'Profit'
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" tickLine={false} axisLine={false} /><YAxis stroke="#69756f" tickFormatter={formatter} domain={['auto', 'auto']} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} formatter={(v) => formatter(Number(v ?? 0))} labelFormatter={(v) => `Day ${v}`} /><Line type="monotone" dataKey="value" name={name} stroke={color} dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer>
}

function FoodFlowChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((m) => ({ day: m.day, affordable: m.householdsAffordableAtMarketOpen, supplied: m.foodSupplied, sold: m.unitsSold, expired: m.unitsExpired }))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" tickLine={false} axisLine={false} /><YAxis stroke="#69756f" domain={[0, 10]} allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} labelFormatter={(v) => `Day ${v}`} /><Line type="monotone" dataKey="affordable" name="Affordable at open" stroke="#65bfa1" dot={false} strokeWidth={2} /><Line type="stepAfter" dataKey="supplied" name="Supplied" stroke="#97a3ff" dot={false} strokeWidth={1.5} strokeDasharray="5 5" /><Line type="monotone" dataKey="sold" name="Sold" stroke="#d6a866" dot={false} strokeWidth={2} /><Line type="monotone" dataKey="expired" name="Expired" stroke="#d47c6b" dot={false} strokeWidth={1.25} /></LineChart></ResponsiveContainer>
}

function WealthDistributionChart({ state }: { state: SimulationState }) {
  const data = state.metrics.map((m) => ({ day: m.day, minimum: m.householdCashMinimumCents, median: m.householdCashMedianCents, maximum: m.householdCashMaximumCents }))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" tickLine={false} axisLine={false} /><YAxis stroke="#69756f" tickFormatter={(v) => `$${Number(v) / 100}`} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} formatter={(v) => money(Number(v ?? 0))} labelFormatter={(v) => `End of day ${v}`} /><Line type="monotone" dataKey="minimum" name="Minimum cash" stroke="#d47c6b" dot={false} strokeWidth={1.25} /><Line type="monotone" dataKey="median" name="Median cash" stroke="#deff75" dot={false} strokeWidth={2} /><Line type="monotone" dataKey="maximum" name="Maximum cash" stroke="#97a3ff" dot={false} strokeWidth={1.25} /></LineChart></ResponsiveContainer>
}

function ExperimentChart({ suite }: { suite: ScarcityExperimentSuite }) {
  const data = suite.results.map((result) => ({ start: result.startingPriceCents / 100, converged: result.convergedPriceCents === null ? null : result.convergedPriceCents / 100 }))
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 16, left: -6, bottom: 0 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="start" type="number" domain={['dataMin', 'dataMax']} stroke="#69756f" tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} /><YAxis stroke="#69756f" tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} formatter={(v) => v === null ? 'No convergence' : money(Number(v) * 100)} labelFormatter={(v) => `Starting price ${money(Number(v) * 100)}`} /><Line type="linear" dataKey="converged" name="Converged price" stroke="#deff75" dot={{ r: 3, fill: '#deff75' }} strokeWidth={2} connectNulls={false} /></LineChart></ResponsiveContainer>
}

export default function App() {
  const [draft, setDraft] = useState({ startingPrice: '2.00', step: '1.00', dailySupply: '10' })
  const [speed, setSpeed] = useState(5)
  const [running, setRunning] = useState(false)
  const [state, setState] = useState(() => createSimulation())
  const [experimentSuite, setExperimentSuite] = useState<ScarcityExperimentSuite | null>(null)

  const step = () => setState((current) => stepSimulation(current))
  const reset = () => {
    const config: SimulationConfig = {
      startingPriceCents: Math.max(1, Math.round(Number(draft.startingPrice || 0) * 100)),
      initialStepCents: Math.max(1, Math.round(Number(draft.step || 0) * 100)),
      dailyFoodSupply: Math.max(0, Math.round(Number(draft.dailySupply || 0))),
    }
    setRunning(false)
    setState(createSimulation(config))
  }

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      setState((current) => {
        let next = current
        const batch = speed === 100 ? 5 : 1
        for (let index = 0; index < batch; index += 1) next = stepSimulation(next)
        return next
      })
    }, speed === 100 ? 50 : 1000 / speed)
    return () => window.clearInterval(interval)
  }, [running, speed])

  const latest = state.metrics.at(-1)
  const status = state.pricing.converged ? 'Converged' : state.pricing.stepSizeCents < state.config.initialStepCents ? 'Refining' : 'Exploring'
  const recentEvents = useMemo(() => groupEventsForDisplay(state.events).reverse().slice(0, 28), [state.events])

  return <main>
    <header className="hero">
      <div className="eyebrow">MVP 1.1 · Scarcity Analysis</div>
      <div className="hero-row"><div><h1>Econ<span>—</span>Engine</h1><p>Ten finite daily units stabilize the baseline while observer analytics preserve the ability to inspect lower-supply scarcity experiments.</p></div><div className="system-note"><i />Explicit stabilizer · Deterministic · $100 closed circuit</div></div>
    </header>

    <section className="control-bar panel">
      <div className="run-controls"><button className="primary" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : 'Run simulation'}</button><button onClick={step} disabled={running}>Step one day</button><button onClick={reset}>Reset</button></div>
      <div className="config-controls"><label>Starting price <span>$</span><input inputMode="decimal" value={draft.startingPrice} onChange={(e) => setDraft({ ...draft, startingPrice: e.target.value })} /></label><label>Initial step <span>$</span><input inputMode="decimal" value={draft.step} onChange={(e) => setDraft({ ...draft, step: e.target.value })} /></label><label>Daily supply <input inputMode="numeric" min="0" step="1" value={draft.dailySupply} onChange={(e) => setDraft({ ...draft, dailySupply: e.target.value })} /></label><label>Simulation speed<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{SPEEDS.map((value) => <option key={value} value={value}>{value} day{value > 1 ? 's' : ''}/sec</option>)}</select></label></div>
    </section>

    <section className="metrics-grid">
      <Metric label="Current day" value={String(state.day)} detail={running ? 'Simulation running' : 'Simulation paused'} />
      <Metric label="Last tested price" value={latest ? money(latest.postedPriceCents) : '—'} detail={latest ? `Produced ${money(latest.preTaxProfitCents)} profit` : 'No experiment yet'} />
      <Metric label="Daily profit" value={money(latest?.preTaxProfitCents ?? 0)} detail={latest ? 'From last tested price' : 'No result yet'} />
      <Metric label="Next price" value={money(state.firm.postedPriceCents)} detail="Tomorrow’s experiment" />
      <Metric label="Best-known price" value={state.pricing.bestProfitCents < 0 ? '—' : money(state.pricing.bestPriceCents)} detail="From realized profit" accent />
      <Metric label="Search step" value={money(state.pricing.stepSizeCents)} detail={`Direction: ${state.pricing.direction}`} />
      <Metric label="Food supplied" value={String(latest?.foodSupplied ?? state.config.dailyFoodSupply)} detail="Exogenous units per day" />
      <Metric label="Sold / expired" value={latest ? `${latest.unitsSold} / ${latest.unitsExpired}` : '—'} detail={latest ? `Sold out: ${latest.soldOut ? 'yes' : 'no'}` : 'No market yet'} />
      <Metric label="Purchase failures" value={latest ? `${latest.stockoutFailures} / ${latest.affordabilityFailures}` : '—'} detail="Stockout / affordability" />
      <Metric label="Cash Gini" value={(latest?.householdCashGini ?? 0).toFixed(3)} detail="End-of-day dispersion" />
      <Metric label="Total money" value={money(latest?.totalMoneyCents ?? 10_000)} detail="✓ Invariant satisfied" />
      <Metric label="Discovery status" value={status} detail={state.pricing.converged ? 'Adjacent cents tested' : 'Learning from experiments'} accent={state.pricing.converged} />
    </section>

    <section className="decision panel"><div className={`decision-mark decision-mark--${state.latestDecisionAction}`} aria-label={`Decision action: ${state.latestDecisionAction}`}>{DECISION_SYMBOLS[state.latestDecisionAction]}</div><div><span>Latest pricing decision</span><p>{state.latestDecisionReason}</p></div></section>

    <section className="causal-strip panel" aria-label="Latest day causal diagnostics">
      {latest ? <>
        <div><span>Tested price</span><strong>{money(latest.postedPriceCents)}</strong></div><b>→</b>
        <div><span>Cash at market open</span><strong>{money(latest.householdCashMinimumAtMarketOpenCents)} / {money(latest.householdCashMedianAtMarketOpenCents)} / {money(latest.householdCashMaximumAtMarketOpenCents)}</strong><small>Minimum / median / maximum</small></div><b>→</b>
        <div><span>Affordable</span><strong>{latest.householdsAffordableAtMarketOpen} / 10</strong></div><b>→</b>
        <div><span>Market result</span><strong>{latest.foodSupplied} supplied · {latest.unitsSold} sold</strong><small>{latest.stockoutFailures} stockout · {latest.affordabilityFailures} affordability failures</small></div><b>→</b>
        <div><span>Realised profit</span><strong>{money(latest.preTaxProfitCents)}</strong></div><b>→</b>
        <div><span>Next price</span><strong>{money(state.firm.postedPriceCents)}</strong></div>
      </> : <p>Step the simulation to reveal the price → wealth → affordability → market → profit feedback chain.</p>}
    </section>

    <section className="charts-grid">
      <ChartPanel title="Price discovery" subtitle="Tested price versus the firm’s best realized price"><PriceChart state={state} /></ChartPanel>
      <ChartPanel title="Daily profit" subtitle="Realized revenue; production cost is zero"><SimpleChart state={state} field="preTaxProfitCents" color="#65bfa1" formatter={money} /></ChartPanel>
      <ChartPanel title="Market capacity" subtitle="Affordable households at open versus supplied, sold, and expired units"><FoodFlowChart state={state} /></ChartPanel>
      <ChartPanel title="Search step" subtitle="How aggressively the firm is exploring around its best-known price"><SimpleChart state={state} field="priceStepSizeCents" color="#97a3ff" formatter={money} /></ChartPanel>
      <ChartPanel title="Household wealth distribution" subtitle="End-of-day minimum, median, and maximum cash"><WealthDistributionChart state={state} /></ChartPanel>
    </section>

    <section className="panel experiment-panel">
      <div className="panel-heading"><div><h2>Controlled starting-price experiment</h2><p>Only starting price varies; step = $1.00, daily supply = 10, horizon = 300 days</p></div><button onClick={() => setExperimentSuite(runStartingPriceExperiments())}>{experimentSuite ? 'Run again' : 'Run 11-price grid'}</button></div>
      {experimentSuite ? <div className="experiment-content">
        <div className="experiment-chart"><ExperimentChart suite={experimentSuite} /></div>
        <div className="experiment-table-wrap"><table><thead><tr><th>Start</th><th>Converged</th><th>Days</th><th>Final cash min / median / max</th><th>Gini</th><th>Food bought range</th></tr></thead><tbody>{experimentSuite.results.map((result) => {
          const minFood = Math.min(...result.cumulativeFoodConsumptionByHousehold)
          const maxFood = Math.max(...result.cumulativeFoodConsumptionByHousehold)
          return <tr key={result.startingPriceCents}><td>{money(result.startingPriceCents)}</td><td>{result.convergedPriceCents === null ? 'No convergence' : money(result.convergedPriceCents)}</td><td>{result.daysToConvergence ?? `>${experimentSuite.horizonDays}`}</td><td>{money(result.finalHouseholdCashMinimumCents)} / {money(result.finalHouseholdCashMedianCents)} / {money(result.finalHouseholdCashMaximumCents)}</td><td>{result.finalHouseholdCashGini.toFixed(3)}</td><td>{minFood}–{maxFood} units</td></tr>
        })}</tbody></table></div>
      </div> : <div className="experiment-empty">Run the deterministic grid ({SCARCITY_EXPERIMENT_STARTING_PRICES_CENTS.map((price) => money(price)).join(', ')}) to inspect starting price → convergence time → household distribution. Results are observer-only and never enter the live firm's strategy.</div>}
    </section>

    <section className="inspection-grid">
      <div className="panel agent-panel"><div className="panel-heading"><div><h2>Agent inspection</h2><p>Current cash, daily cause, and cumulative food access</p></div></div><div className="agent-summary"><article><span>Firm</span><strong>{money(state.firm.cashCents)}</strong><dl><div><dt>Supply / sold</dt><dd>{state.day ? `${state.config.dailyFoodSupply} / ${state.firm.unitsSoldToday}` : '—'}</dd></div><div><dt>Expired</dt><dd>{state.day ? state.firm.unitsExpiredToday : '—'}</dd></div><div><dt>Sold out</dt><dd>{state.day ? (state.firm.soldOutToday ? 'Yes' : 'No') : '—'}</dd></div><div><dt>Today’s profit</dt><dd>{money(state.firm.preTaxProfitTodayCents)}</dd></div></dl></article><article><span>Government</span><strong>{money(state.government.cashCents)}</strong><dl><div><dt>Tax collected</dt><dd>{money(state.government.taxCollectedTodayCents)}</dd></div><div><dt>Redistributed</dt><dd>{money(state.government.redistributedTodayCents)}</dd></div><div><dt>End balance</dt><dd>{money(state.government.cashCents)}</dd></div></dl></article></div><div className="households"><div className="table-head"><span>Household</span><span>Balance</span><span>Today</span><span>Lifetime outcomes</span></div>{state.households.map((household) => <div className="household-row" key={household.id}><span>H{household.id.split('-')[1]}</span><strong>{money(household.cashCents)}</strong><span className={household.purchasedToday ? 'success' : state.day ? 'failed' : ''}>{state.day === 0 ? 'Waiting' : household.purchaseOutcomeToday === 'purchased' ? `Bought · ${money(household.spentTodayCents)}` : household.purchaseOutcomeToday === 'stockout' ? 'Stockout' : 'Insufficient funds'}</span><span>{household.lifetimeUnitsPurchased} bought · {household.lifetimeStockoutFailures}S · {household.lifetimeAffordabilityFailures}A</span></div>)}</div></div>
      <div className="panel ledger"><div className="panel-heading"><div><h2>Recent event ledger</h2><p>Grouped causes, with granular detail preserved</p></div><span>{recentEvents.length} shown</span></div><div className="event-list">{recentEvents.length === 0 ? <div className="empty">Run or step the simulation to inspect its causal ledger.</div> : recentEvents.map((event) => <div className="event" key={event.key}><span>D{event.day}</span><div><strong>{event.type}</strong><p>{event.description}</p>{event.grouped && <details><summary>Show {event.details.length} underlying events</summary><div className="event-details">{event.details.map((detail) => <p key={detail.id}>{detail.description}</p>)}</div></details>}</div></div>)}</div></div>
    </section>

    <footer><p><strong>Stabilized benchmark, not equilibrium.</strong> With ten daily units, every affordable household can buy; $10.00 yields $100.00 and $10.01 yields no sales. The firm is never given that answer.</p><span>Ten-unit supply is an explicit stabilizing assumption. Supply remains fixed and exogenous.</span></footer>
  </main>
}
