import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { expectedTotalMoneyCents, TOTAL_MONEY_CENTS } from './sim/config'
import { createSimulation, stepSimulation } from './sim/engine'
import { SimulationRunner } from './sim/simulationRunner'
import type { SimulationConfig, SimulationState } from './sim/types'
import { Icon } from './ui/components'
import { useExperiments } from './ui/experiments'
import { money } from './ui/format'
import { SettingsDrawer } from './ui/SettingsDrawer'
import { DEFAULT_SETTINGS_DRAFT, parseSimulationSettings } from './ui/simulationSettings'
import { ExperimentsView } from './ui/views/ExperimentsView'
import { GovernmentView } from './ui/views/GovernmentView'
import { HouseholdsView } from './ui/views/HouseholdsView'
import { MarketsView } from './ui/views/MarketsView'
import { OverviewView } from './ui/views/OverviewView'
import type { CompetitiveIndustryId } from './ui/worldViewModel'

type AppTab = 'overview' | 'markets' | 'households' | 'government' | 'experiments'
const TABS: { id: AppTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'markets', label: 'Markets' },
  { id: 'households', label: 'Households' },
  { id: 'government', label: 'Government' },
  { id: 'experiments', label: 'Experiments' },
]
const SPEEDS = [1, 5, 20, 100]

const tabFromHash = (): AppTab => {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1)
  return TABS.some(({ id }) => id === hash) ? (hash as AppTab) : 'overview'
}

export default function App() {
  const [state, setState] = useState(() => createSimulation())
  const runnerRef = useRef<SimulationRunner<SimulationState> | null>(null)
  if (runnerRef.current === null) runnerRef.current = new SimulationRunner(state, stepSimulation, setState)
  const runner = runnerRef.current
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [tab, setTab] = useState<AppTab>(tabFromHash)
  // Shared between the map and the Markets page, so both always show the same market and selection.
  const [industry, setIndustry] = useState<CompetitiveIndustryId>('food')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState(DEFAULT_SETTINGS_DRAFT)
  const [appliedDraft, setAppliedDraft] = useState(DEFAULT_SETTINGS_DRAFT)
  const [appliedConfig, setAppliedConfig] = useState<SimulationConfig | undefined>(undefined)
  const { experiments, run: runExperiment } = useExperiments()
  const tabRefs = useRef(new Map<AppTab, HTMLButtonElement>())

  useEffect(() => {
    if (!running) {
      runner.stop()
      return
    }
    runner.start(speed)
    return () => runner.stop(false)
  }, [runner, running, speed])
  useEffect(() => () => runner.destroy(), [runner])

  const toggleRunning = useCallback(() => setRunning((value) => !value), [])
  const restart = () => {
    setRunning(false)
    runner.reset(createSimulation(appliedConfig))
  }
  const applySettings = () => {
    const parsed = parseSimulationSettings(draft)
    if (!parsed.ok) return
    setAppliedDraft(draft)
    setAppliedConfig(parsed.config)
    setSettingsOpen(false)
    setRunning(false)
    runner.reset(createSimulation(parsed.config))
  }
  const closeSettings = () => {
    setSettingsOpen(false)
    setDraft(appliedDraft)
  }

  const navigate = useCallback((next: AppTab) => {
    setTab(next)
    if (window.location.hash.slice(1) !== next) window.history.replaceState(null, '', `#${next}`)
  }, [])
  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Space runs or pauses, unless the user is typing or operating another control.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || settingsOpen) return
      const target = event.target as HTMLElement
      if (
        target !== document.body &&
        target.closest('input, select, textarea, button, a, canvas, [contenteditable], summary')
      )
        return
      event.preventDefault()
      toggleRunning()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, toggleRunning])

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex(({ id }) => id === tab)
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : -1
    if (next < 0) return
    event.preventDefault()
    navigate(TABS[next].id)
    tabRefs.current.get(TABS[next].id)?.focus()
  }

  const openMarket = (next: CompetitiveIndustryId) => {
    setIndustry(next)
    navigate('markets')
    window.scrollTo({ top: 0 })
  }
  const showOnMap = (id: string) => {
    setSelectedId(id)
    const firm = state.firms.find((candidate) => candidate.id === id)
    if (firm && firm.industryId !== 'transport') setIndustry(firm.industryId)
    navigate('overview')
    setTimeout(() => document.getElementById('world-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const settingsChanged = JSON.stringify(appliedDraft) !== JSON.stringify(DEFAULT_SETTINGS_DRAFT)
  const totalMoney = state.metrics.at(-1)?.totalMoneyCents ?? TOTAL_MONEY_CENTS
  const seed = state.config.seed ?? Number(appliedDraft.seed)
  const conserved = totalMoney === expectedTotalMoneyCents(state.households.length)

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            href="#overview"
            onClick={(event) => {
              event.preventDefault()
              navigate('overview')
            }}
          >
            <span className="brand-mark" aria-hidden="true" />
            Econ Engine
          </a>
          <nav className="tabs" role="tablist" aria-label="Sections">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                ref={(element) => {
                  if (element) tabRefs.current.set(id, element)
                  else tabRefs.current.delete(id)
                }}
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => navigate(id)}
                onKeyDown={onTabKey}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="controls" role="group" aria-label="Simulation controls">
            <span className={`run-status${running ? ' is-running' : ''}`}>
              <span className="run-indicator">{running ? 'Running' : 'Paused'}</span>
              <span className="control-day">Day {state.day}</span>
            </span>
            <button
              type="button"
              className="primary run-button"
              aria-label={running ? 'Pause' : 'Run simulation'}
              title={`${running ? 'Pause' : 'Run'} (Space)`}
              onClick={toggleRunning}
            >
              <Icon name={running ? 'pause' : 'play'} size={14} />
              <span>{running ? 'Pause' : 'Run'}</span>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Step one day"
              title="Step one day"
              disabled={running}
              onClick={() => runner.stepOnce()}
            >
              <Icon name="step" />
            </button>
            <select
              className="speed"
              aria-label="Speed"
              title="Days simulated per second"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              {SPEEDS.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              aria-label="Restart from day 0"
              title="Restart from day 0"
              onClick={restart}
            >
              <Icon name="restart" />
            </button>
            <button
              type="button"
              className={`icon-button${settingsChanged ? ' has-dot' : ''}`}
              aria-label={settingsChanged ? 'Scenario settings (customized)' : 'Scenario settings'}
              title="Scenario settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Icon name="settings" />
            </button>
          </div>
        </div>
      </header>

      <main className="content" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && (
          <OverviewView
            state={state}
            running={running}
            onRun={() => setRunning(true)}
            onOpenMarket={openMarket}
            selectedId={selectedId}
            onSelect={setSelectedId}
            industry={industry}
            onIndustry={setIndustry}
          />
        )}
        {tab === 'markets' && (
          <MarketsView state={state} industry={industry} onIndustry={setIndustry} onShowOnMap={showOnMap} />
        )}
        {tab === 'households' && <HouseholdsView state={state} onShowOnMap={showOnMap} />}
        {tab === 'government' && <GovernmentView state={state} />}
        {tab === 'experiments' && (
          <ExperimentsView seed={seed} experiments={experiments} onRun={(kind) => runExperiment(kind, seed)} />
        )}
      </main>

      <footer className="statusbar">
        <span className="scenario-summary">
          Seed {seed} · {state.households.length} households · {money(totalMoney)} in circulation
        </span>
        <span className={`conservation${conserved ? '' : ' is-broken'}`}>
          <Icon name={conserved ? 'check' : 'close'} size={13} />
          {conserved ? 'Money conserved exactly' : 'Money not conserved'}
        </span>
      </footer>

      <SettingsDrawer
        open={settingsOpen}
        draft={draft}
        onDraft={setDraft}
        onApply={applySettings}
        onClose={closeSettings}
      />
    </div>
  )
}
