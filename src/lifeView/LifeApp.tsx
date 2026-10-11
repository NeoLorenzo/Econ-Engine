import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { LIFE_DEFAULT_CONFIG, lifeConfigErrors } from '../life/config'
import { createLife, stepLife } from '../life/engine'
import type { LifeConfig } from '../life/types'
import { TimeChart } from '../ui/charts'
import { Icon } from '../ui/components'
import { palette } from '../ui/theme'
import { createLifeScene, type LifeScene } from './lifeScene'
import {
  advanceClock,
  clockLabel,
  currentEvent,
  describeActivity,
  displayedEnergy,
  displayHours,
  formatKcal,
  LIFE_SPEEDS,
  patchInspection,
  type DisplayPair,
} from './lifeViewModel'

type Setup = Pick<LifeConfig, 'seed' | 'patchCount' | 'patchRegrowthKcalPerHour'>

const DEFAULT_SETUP: Setup = {
  seed: LIFE_DEFAULT_CONFIG.seed,
  patchCount: LIFE_DEFAULT_CONFIG.patchCount,
  patchRegrowthKcalPerHour: LIFE_DEFAULT_CONFIG.patchRegrowthKcalPerHour,
}

const startPair = (setup: Setup): DisplayPair => {
  const previous = createLife(setup)
  return { previous, next: stepLife(previous), alpha: 0 }
}

/** What the HUD shows, refreshed a few times a second rather than every frame. */
interface Snapshot {
  pair: DisplayPair
  energyKcal: number
  hours: number
}

const HUD_INTERVAL_MS = 100

export default function LifeApp() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<LifeScene | null>(null)
  const [initialPair] = useState(() => startPair(DEFAULT_SETUP))
  const pairRef = useRef<DisplayPair>(initialPair)
  const [running, setRunning] = useState(true)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [selectedPatchId, setSelectedPatchId] = useState<number | null>(null)
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP)
  const [draft, setDraft] = useState<Record<keyof Setup, string>>(() => stringify(DEFAULT_SETUP))
  const [setupError, setSetupError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snap(initialPair, true))
  const [sceneError, setSceneError] = useState(false)
  // History starts open on wide screens and folded on phones, where it would cover the world.
  const [historyOpen, setHistoryOpen] = useState(() => window.matchMedia?.('(min-width: 721px)').matches ?? true)

  const runningRef = useRef(running)
  const speedRef = useRef(LIFE_SPEEDS[speedIndex]!)
  const selectedRef = useRef(selectedPatchId)
  // The animation loop reads the latest controls through refs, so changing them never restarts it.
  useEffect(() => {
    runningRef.current = running
    speedRef.current = LIFE_SPEEDS[speedIndex]!
    selectedRef.current = selectedPatchId
  }, [running, speedIndex, selectedPatchId])

  // One loop advances the clock and draws; React only refreshes the HUD.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let frame = 0
    let lastFrame = performance.now()
    let lastHud = 0
    createLifeScene(mount, (patchId) => setSelectedPatchId(patchId))
      .then((scene) => {
        if (disposed) return scene.dispose()
        sceneRef.current = scene
        scene.setWorld(pairRef.current.next)
        const loop = (now: number) => {
          const elapsed = (now - lastFrame) / 1000
          lastFrame = now
          const speed = speedRef.current
          if (runningRef.current) {
            const clock = advanceClock(pairRef.current.alpha, elapsed, speed.hoursPerSecond)
            let { previous, next } = pairRef.current
            for (let step = 0; step < clock.steps; step += 1) {
              previous = next
              next = stepLife(next)
            }
            pairRef.current = { previous, next, alpha: clock.alpha }
          }
          scene.draw(pairRef.current, {
            interpolate: speed.interpolate,
            selectedPatchId: selectedRef.current,
            nowMs: now,
          })
          if (now - lastHud >= HUD_INTERVAL_MS) {
            lastHud = now
            setSnapshot(snap(pairRef.current, speed.interpolate))
          }
          frame = requestAnimationFrame(loop)
        }
        frame = requestAnimationFrame(loop)
      })
      .catch(() => setSceneError(true))
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  const reset = useCallback((nextSetup: Setup) => {
    pairRef.current = startPair(nextSetup)
    sceneRef.current?.setWorld(pairRef.current.next)
    setSelectedPatchId(null)
    setSnapshot(snap(pairRef.current, true))
  }, [])

  /** Finishes the hour in progress, then shows the next one from its start. */
  const stepHour = useCallback(() => {
    const { next } = pairRef.current
    pairRef.current = { previous: next, next: stepLife(next), alpha: 0 }
    setSnapshot(snap(pairRef.current, true))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      if (event.code === 'Space') {
        event.preventDefault()
        setRunning((value) => !value)
      } else if (event.key === 'Escape') setSelectedPatchId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const applySetup = (event: FormEvent) => {
    event.preventDefault()
    const parsed: Setup = {
      seed: Number(draft.seed),
      patchCount: Number(draft.patchCount),
      patchRegrowthKcalPerHour: Number(draft.patchRegrowthKcalPerHour),
    }
    const errors = lifeConfigErrors({ ...LIFE_DEFAULT_CONFIG, ...parsed })
    if (errors.length) {
      setSetupError(errors[0]!)
      return
    }
    setSetupError(null)
    setSetup(parsed)
    reset(parsed)
  }

  const { pair, energyKcal, hours } = snapshot
  const state = pair.next
  const { config, forager } = state
  const event = currentEvent(pair)
  const inspection = selectedPatchId === null ? null : patchInspection(state, selectedPatchId)
  const days = state.days.map((day) => ({
    day: day.day + 1,
    reserve: day.endEnergyKcal,
    stock: day.totalPatchStockKcal,
  }))
  const percent = (value: number) => `${(value / config.reserveMaxKcal) * 100}%`

  return (
    <div className="life-app">
      <main className="life-world" ref={mountRef}>
        {sceneError && <p className="life-fallback">The 3D view needs WebGL, which this browser could not start.</p>}
      </main>

      <header className="life-topbar">
        <a className="brand" href="./">
          <span className="brand-mark" aria-hidden="true" />
          Econ Engine
        </a>
        <span className="life-title">Life 0 · one forager</span>
        <div className="life-controls" role="group" aria-label="Simulation controls">
          <button
            type="button"
            className="primary run-button"
            aria-label={running ? 'Pause' : 'Run'}
            title={`${running ? 'Pause' : 'Run'} (Space)`}
            onClick={() => setRunning((value) => !value)}
          >
            <Icon name={running ? 'pause' : 'play'} size={14} />
            <span className="life-run-label">{running ? 'Pause' : 'Run'}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Step one hour"
            title="Step one hour"
            disabled={running}
            onClick={stepHour}
          >
            <Icon name="step" />
          </button>
          <select
            className="speed"
            aria-label="Speed"
            title="Simulated time per real second"
            value={speedIndex}
            onChange={(change) => setSpeedIndex(Number(change.target.value))}
          >
            {LIFE_SPEEDS.map((speed, index) => (
              <option key={speed.label} value={index}>
                {speed.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="life-card life-hud" aria-label="The forager">
        <div className="life-clock num">{clockLabel(hours)}</div>
        <p className={`life-activity${forager.alive ? '' : ' is-dead'}`} aria-live="polite">
          {describeActivity(pair)}
        </p>
        <div className="life-energy">
          <div className="life-energy-head">
            <span>Energy reserve</span>
            <span className="num">{formatKcal(energyKcal)}</span>
          </div>
          <div
            className="life-energy-bar"
            role="meter"
            aria-label="Energy reserve"
            aria-valuemin={0}
            aria-valuemax={config.reserveMaxKcal}
            aria-valuenow={Math.round(energyKcal)}
          >
            <div className="life-energy-fill" style={{ width: percent(energyKcal) }} />
            <div className="life-energy-mark" style={{ left: percent(config.hungryBelowKcal) }} title="Hungry below" />
            <div className="life-energy-mark" style={{ left: percent(config.satiatedAtKcal) }} title="Satiated at" />
          </div>
          <div className="life-energy-legend">
            <span>{forager.hungry ? 'Hungry' : 'Not hungry'}</span>
            <span className="num">
              hungry below {formatKcal(config.hungryBelowKcal)} · full at {formatKcal(config.satiatedAtKcal)}
            </span>
          </div>
        </div>
        {event?.action === 'forage' && (
          <p className="life-note">Gathering {formatKcal(event.gatheredKcal)} this hour</p>
        )}
      </section>

      {inspection && (
        <section className="life-card life-inspector" aria-label={inspection.name}>
          <header>
            <h2>{inspection.name}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelectedPatchId(null)}>
              <Icon name="close" />
            </button>
          </header>
          <dl>
            <dt>Actually holds</dt>
            <dd className="num">
              {inspection.trueStockKcal.toLocaleString('en-US')} of {formatKcal(inspection.capacityKcal)}
            </dd>
            <dt>The forager remembers</dt>
            <dd className="num">{formatKcal(inspection.rememberedStockKcal)}</dd>
            <dt>Last seen</dt>
            <dd>{inspection.seen}</dd>
          </dl>
          <p className="life-note">
            {inspection.differenceKcal === 0
              ? 'Its memory is up to date.'
              : `It knows only what it last saw, so it ${inspection.differenceKcal > 0 ? 'underestimates' : 'overestimates'} this patch by ${formatKcal(Math.abs(inspection.differenceKcal))}.`}
          </p>
        </section>
      )}

      <section className="life-card life-history" aria-label="History">
        <details open={historyOpen} onToggle={(toggle) => setHistoryOpen(toggle.currentTarget.open)}>
          <summary>History and setup</summary>
          {days.length > 1 ? (
            <TimeChart
              data={days}
              height={150}
              format={(value) => `${Math.round(value / 1000)}k`}
              series={[
                { key: 'reserve', name: 'Reserve at day’s end', color: palette.household },
                { key: 'stock', name: 'Food on all patches', color: palette.positive, dashed: true },
              ]}
            />
          ) : (
            <p className="life-note">The chart starts after the first full day.</p>
          )}
          <form className="life-setup" onSubmit={applySetup}>
            <label>
              Seed
              <input
                inputMode="numeric"
                value={draft.seed}
                onChange={(change) => setDraft({ ...draft, seed: change.target.value })}
              />
            </label>
            <label>
              Patches
              <input
                inputMode="numeric"
                value={draft.patchCount}
                onChange={(change) => setDraft({ ...draft, patchCount: change.target.value })}
              />
            </label>
            <label>
              Regrowth, kcal/h
              <input
                inputMode="numeric"
                value={draft.patchRegrowthKcalPerHour}
                onChange={(change) => setDraft({ ...draft, patchRegrowthKcalPerHour: change.target.value })}
              />
            </label>
            <button type="submit">Reset</button>
          </form>
          {setupError && (
            <p className="life-error" role="alert">
              {setupError}
            </p>
          )}
          <p className="life-note">
            Running seed {setup.seed} with {setup.patchCount} patches regrowing {setup.patchRegrowthKcalPerHour} kcal an
            hour each.
          </p>
        </details>
      </section>
    </div>
  )
}

function stringify(setup: Setup): Record<keyof Setup, string> {
  return {
    seed: String(setup.seed),
    patchCount: String(setup.patchCount),
    patchRegrowthKcalPerHour: String(setup.patchRegrowthKcalPerHour),
  }
}

function snap(pair: DisplayPair, interpolate: boolean): Snapshot {
  return {
    pair,
    energyKcal: displayedEnergy(pair, interpolate),
    hours: interpolate ? displayHours(pair) : pair.next.tick,
  }
}
