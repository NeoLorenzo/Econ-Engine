import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { expectedTotalMoneyCents, TOTAL_MONEY_CENTS } from './sim/config'
import { createSimulation, stepSimulation } from './sim/engine'
import { SimulationRunner } from './sim/simulationRunner'
import type { SimulationConfig, SimulationState } from './sim/types'
import { Icon } from './ui/components'
import { useEnsembles } from './ui/ensembles'
import { useExperiments } from './ui/experiments'
import { SettingsDrawer } from './ui/SettingsDrawer'
import { Hud, IntroCard } from './ui/shell/Hud'
import {
  focusForPanel,
  hashForPanel,
  INITIAL_FOCUS,
  panelFromHash,
  PANELS,
  type PanelId,
  type WorldFocus,
} from './ui/shell/navigation'
import { Panel } from './ui/shell/Panel'
import { useHeightVar } from './ui/shell/useHeightVar'
import { DEFAULT_SETTINGS_DRAFT, parseSimulationSettings } from './ui/simulationSettings'
import { ExperimentsView } from './ui/views/ExperimentsView'
import { GovernmentView } from './ui/views/GovernmentView'
import { HouseholdsView } from './ui/views/HouseholdsView'
import { MarketsView } from './ui/views/MarketsView'
import { OverviewView } from './ui/views/OverviewView'
import { NO_INSET, type ViewInset } from './ui/world/cameraMath'
import { WorldStage, type WorldController, type WorldStatus } from './ui/world/WorldStage'
import type { CompetitiveIndustryId } from './ui/worldViewModel'

const SPEEDS = [1, 5, 20, 100]

const panelFromLocation = () => (typeof window === 'undefined' ? null : panelFromHash(window.location.hash))

export default function App() {
  const [state, setState] = useState(() => createSimulation())
  const [runner] = useState(() => new SimulationRunner<SimulationState>(state, stepSimulation, setState))
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [panel, setPanel] = useState<PanelId | null>(panelFromLocation)
  // One focus drives the world; panels and the map tools both change it, so they always agree.
  const [focus, setFocus] = useState<WorldFocus>(() => focusForPanel(panelFromLocation(), INITIAL_FOCUS))
  const [inset, setInset] = useState<ViewInset>(NO_INSET)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState(DEFAULT_SETTINGS_DRAFT)
  const [appliedDraft, setAppliedDraft] = useState(DEFAULT_SETTINGS_DRAFT)
  const [appliedConfig, setAppliedConfig] = useState<SimulationConfig | undefined>(undefined)
  const { experiments, run: runExperiment } = useExperiments()
  const { ensembles, run: runEnsemble } = useEnsembles()
  const tabRefs = useRef(new Map<PanelId, HTMLButtonElement>())
  const worldRef = useRef<WorldController | null>(null)
  const topbarRef = useRef<HTMLElement | null>(null)
  useHeightVar(topbarRef, '--topbar-h')

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

  // Opening a panel sets its starting world focus once; the user can change the map tools afterwards.
  const showPanel = useCallback(
    (next: PanelId | null) => {
      if (next && next !== panel) setFocus((current) => focusForPanel(next, current))
      setPanel(next)
      const hash = hashForPanel(next)
      if (window.location.hash !== hash)
        window.history.replaceState(null, '', hash || window.location.pathname + window.location.search)
    },
    [panel],
  )
  const closePanel = useCallback(() => {
    if (!panel) return
    showPanel(null)
    tabRefs.current.get(panel)?.focus()
  }, [panel, showPanel])
  const togglePanel = (next: PanelId) => (next === panel ? closePanel() : showPanel(next))

  useEffect(() => {
    const onHash = () => {
      const next = panelFromLocation()
      setPanel(next)
      if (next) setFocus((current) => focusForPanel(next, current))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Without the world, the panels are the whole app, so open one. The hash always mirrors the open panel.
  const onWorldStatus = useCallback(
    (status: WorldStatus) => {
      if (status === 'error' && !panelFromLocation()) showPanel('overview')
    },
    [showPanel],
  )

  // Space runs or pauses, unless the user is typing or operating another control. Escape closes the panel,
  // unless the map already used it to clear the selection.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (settingsOpen) return
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return
        closePanel()
        return
      }
      if (event.code !== 'Space' || event.repeat) return
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
  }, [settingsOpen, toggleRunning, closePanel])

  // Arrow keys move between section buttons without opening their panels.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, id: PanelId) => {
    const index = PANELS.findIndex((candidate) => candidate.id === id)
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % PANELS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + PANELS.length) % PANELS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? PANELS.length - 1
              : -1
    if (next < 0) return
    event.preventDefault()
    tabRefs.current.get(PANELS[next].id)?.focus()
  }

  const setIndustry = (industry: CompetitiveIndustryId) => setFocus((current) => ({ ...current, industry }))
  const openMarket = (industry: CompetitiveIndustryId) => {
    setIndustry(industry)
    showPanel('markets')
  }
  const locate = (id: string) => worldRef.current?.locate(id)

  const settingsChanged = JSON.stringify(appliedDraft) !== JSON.stringify(DEFAULT_SETTINGS_DRAFT)
  const totalMoney = state.metrics.at(-1)?.totalMoneyCents ?? TOTAL_MONEY_CENTS
  const seed = state.config.seed ?? Number(appliedDraft.seed)
  const conserved = totalMoney === expectedTotalMoneyCents(state.households.length)
  const openPanel = PANELS.find(({ id }) => id === panel)

  return (
    // Overlays on the world keep clear of an open docked panel.
    <div className={`app${panel ? ' has-panel' : ''}`} style={{ '--inset-right': `${inset.right}px` } as CSSProperties}>
      <main className="world-main" aria-label="Economy world">
        <WorldStage
          state={state}
          focus={focus}
          onFocus={setFocus}
          inset={inset}
          paused={panel === 'experiments'}
          controllerRef={worldRef}
          onStatus={onWorldStatus}
        />
        <Hud state={state} seed={seed} totalMoney={totalMoney} conserved={conserved} />
        <IntroCard state={state} onRun={() => setRunning(true)} />
      </main>

      <header ref={topbarRef} className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            href="#"
            onClick={(event) => {
              event.preventDefault()
              closePanel()
            }}
          >
            <span className="brand-mark" aria-hidden="true" />
            Econ Engine
          </a>
          <nav className="tabs" aria-label="Sections">
            {PANELS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                ref={(element) => {
                  if (element) tabRefs.current.set(id, element)
                  else tabRefs.current.delete(id)
                }}
                aria-expanded={panel === id}
                aria-controls={panel === id ? `panel-${id}` : undefined}
                onClick={() => togglePanel(id)}
                onKeyDown={(event) => onTabKey(event, id)}
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

      {openPanel && (
        <Panel
          key={openPanel.id}
          id={openPanel.id}
          label={openPanel.label}
          layout={openPanel.layout}
          onClose={closePanel}
          onInset={setInset}
        >
          {openPanel.id === 'overview' && <OverviewView state={state} running={running} onOpenMarket={openMarket} />}
          {openPanel.id === 'markets' && (
            <MarketsView state={state} industry={focus.industry} onIndustry={setIndustry} onLocate={locate} />
          )}
          {openPanel.id === 'households' && <HouseholdsView state={state} onLocate={locate} />}
          {openPanel.id === 'government' && <GovernmentView state={state} />}
          {openPanel.id === 'experiments' && (
            <ExperimentsView
              seed={seed}
              experiments={experiments}
              onRun={(kind) => runExperiment(kind, seed)}
              ensembles={ensembles}
              onRunEnsemble={(kind, size) => runEnsemble(kind, seed, size)}
            />
          )}
        </Panel>
      )}

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
