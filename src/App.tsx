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

function SimpleChart({ state, field, color, formatter = (v) => String(v) }: { state: SimulationState; field: 'preTaxProfitCents' | 'unitsSold' | 'priceStepSizeCents'; color: string; formatter?: (value: number) => string }) {
  const data = state.metrics.map((m) => ({ day: m.day, value: m[field] }))
  const name = field === 'unitsSold' ? 'Units' : field === 'priceStepSizeCents' ? 'Search step' : 'Profit'
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}><CartesianGrid stroke="#202825" vertical={false} /><XAxis dataKey="day" stroke="#69756f" tickLine={false} axisLine={false} /><YAxis stroke="#69756f" tickFormatter={formatter} domain={['auto', 'auto']} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} formatter={(v) => formatter(Number(v ?? 0))} labelFormatter={(v) => `Day ${v}`} /><Line type="monotone" dataKey="value" name={name} stroke={color} dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer>
}

export default function App() {
  const [draft, setDraft] = useState({ startingPrice: '2.00', step: '1.00' })
  const [speed, setSpeed] = useState(5)
  const [running, setRunning] = useState(false)
  const [state, setState] = useState(() => createSimulation())

  const step = () => setState((current) => stepSimulation(current))
  const reset = () => {
    const config: SimulationConfig = {
      startingPriceCents: Math.max(1, Math.round(Number(draft.startingPrice || 0) * 100)),
      initialStepCents: Math.max(1, Math.round(Number(draft.step || 0) * 100)),
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
      <div className="eyebrow">MVP 0 · Price Discovery</div>
      <div className="hero-row"><div><h1>Econ<span>—</span>Engine</h1><p>A bounded monopolist learns the revenue-maximizing food price through repeated market experiments.</p></div><div className="system-note"><i />No backend · Deterministic · $100 closed circuit</div></div>
    </header>

    <section className="control-bar panel">
      <div className="run-controls"><button className="primary" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : 'Run simulation'}</button><button onClick={step} disabled={running}>Step one day</button><button onClick={reset}>Reset</button></div>
      <div className="config-controls"><label>Starting price <span>$</span><input inputMode="decimal" value={draft.startingPrice} onChange={(e) => setDraft({ ...draft, startingPrice: e.target.value })} /></label><label>Initial step <span>$</span><input inputMode="decimal" value={draft.step} onChange={(e) => setDraft({ ...draft, step: e.target.value })} /></label><label>Simulation speed<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{SPEEDS.map((value) => <option key={value} value={value}>{value} day{value > 1 ? 's' : ''}/sec</option>)}</select></label></div>
    </section>

    <section className="metrics-grid">
      <Metric label="Current day" value={String(state.day)} detail={running ? 'Simulation running' : 'Simulation paused'} />
      <Metric label="Last tested price" value={latest ? money(latest.postedPriceCents) : '—'} detail={latest ? `Produced ${money(latest.preTaxProfitCents)} profit` : 'No experiment yet'} />
      <Metric label="Daily profit" value={money(latest?.preTaxProfitCents ?? 0)} detail={latest ? 'From last tested price' : 'No result yet'} />
      <Metric label="Next price" value={money(state.firm.postedPriceCents)} detail="Tomorrow’s experiment" />
      <Metric label="Best-known price" value={state.pricing.bestProfitCents < 0 ? '—' : money(state.pricing.bestPriceCents)} detail="From realized profit" accent />
      <Metric label="Search step" value={money(state.pricing.stepSizeCents)} detail={`Direction: ${state.pricing.direction}`} />
      <Metric label="Total money" value={money(latest?.totalMoneyCents ?? 10_000)} detail="✓ Invariant satisfied" />
      <Metric label="Discovery status" value={status} detail={state.pricing.converged ? 'Adjacent cents tested' : 'Learning from experiments'} accent={state.pricing.converged} />
    </section>

    <section className="decision panel"><div className={`decision-mark decision-mark--${state.latestDecisionAction}`} aria-label={`Decision action: ${state.latestDecisionAction}`}>{DECISION_SYMBOLS[state.latestDecisionAction]}</div><div><span>Latest pricing decision</span><p>{state.latestDecisionReason}</p></div></section>

    <section className="charts-grid">
      <ChartPanel title="Price discovery" subtitle="Tested price versus the firm’s best realized price"><PriceChart state={state} /></ChartPanel>
      <ChartPanel title="Daily profit" subtitle="Realized revenue; production cost is zero"><SimpleChart state={state} field="preTaxProfitCents" color="#65bfa1" formatter={money} /></ChartPanel>
      <ChartPanel title="Quantity sold" subtitle="Affordability makes the demand boundary visible"><SimpleChart state={state} field="unitsSold" color="#d6a866" /></ChartPanel>
      <ChartPanel title="Search step" subtitle="How aggressively the firm is exploring around its best-known price"><SimpleChart state={state} field="priceStepSizeCents" color="#97a3ff" formatter={money} /></ChartPanel>
    </section>

    <section className="inspection-grid">
      <div className="panel agent-panel"><div className="panel-heading"><div><h2>Agent inspection</h2><p>Macro outcomes, traced back to individual balances</p></div></div><div className="agent-summary"><article><span>Firm</span><strong>{money(state.firm.cashCents)}</strong><dl><div><dt>Today’s sales</dt><dd>{state.firm.unitsSoldToday}</dd></div><div><dt>Today’s profit</dt><dd>{money(state.firm.preTaxProfitTodayCents)}</dd></div><div><dt>Best realized</dt><dd>{state.pricing.bestProfitCents < 0 ? '—' : money(state.pricing.bestProfitCents)}</dd></div></dl></article><article><span>Government</span><strong>{money(state.government.cashCents)}</strong><dl><div><dt>Tax collected</dt><dd>{money(state.government.taxCollectedTodayCents)}</dd></div><div><dt>Redistributed</dt><dd>{money(state.government.redistributedTodayCents)}</dd></div><div><dt>End balance</dt><dd>{money(state.government.cashCents)}</dd></div></dl></article></div><div className="households"><div className="table-head"><span>Household</span><span>Balance</span><span>Today</span></div>{state.households.map((household) => <div className="household-row" key={household.id}><span>H{household.id.split('-')[1]}</span><strong>{money(household.cashCents)}</strong><span className={household.purchasedToday ? 'success' : state.day ? 'failed' : ''}>{state.day === 0 ? 'Waiting' : household.purchasedToday ? `Bought · ${money(household.spentTodayCents)}` : 'No purchase'}</span></div>)}</div></div>
      <div className="panel ledger"><div className="panel-heading"><div><h2>Recent event ledger</h2><p>Grouped causes, with granular detail preserved</p></div><span>{recentEvents.length} shown</span></div><div className="event-list">{recentEvents.length === 0 ? <div className="empty">Run or step the simulation to inspect its causal ledger.</div> : recentEvents.map((event) => <div className="event" key={event.key}><span>D{event.day}</span><div><strong>{event.type}</strong><p>{event.description}</p>{event.grouped && <details><summary>Show {event.details.length} underlying events</summary><div className="event-details">{event.details.map((detail) => <p key={detail.id}>{detail.description}</p>)}</div></details>}</div></div>)}</div></div>
    </section>

    <footer><p><strong>Benchmark, not equilibrium.</strong> In this deliberately bounded world, $10.00 maximizes realized revenue: ten households can each afford one unit; at $10.01 none can. The firm is never given that answer.</p><span>Unlimited food and 100% redistribution are explicit MVP simplifications.</span></footer>
  </main>
}
