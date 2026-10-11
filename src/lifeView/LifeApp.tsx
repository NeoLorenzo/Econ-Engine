import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { LIFE_DEFAULT_CONFIG, lifeConfigErrors } from '../life/config'
import { createLife, stepLife } from '../life/engine'
import type { LifeConfig } from '../life/types'
import { TimeChart } from '../ui/charts'
import { Icon } from '../ui/components'
import { palette } from '../ui/theme'
import { createLifeScene, type LifePick, type LifeScene } from './lifeScene'
import {
  advanceClock,
  aliveCount,
  clockLabel,
  currentEvent,
  describeActivity,
  displayedEnergy,
  displayHours,
  foragerName,
  foragerSummary,
  formatHours,
  formatKcal,
  LIFE_SPEEDS,
  patchInspection,
  seesEverything,
  stepFollowed,
  STRATEGY_COLORS,
  type DisplayPair,
} from './lifeViewModel'

type Setup = Pick<
  LifeConfig,
  | 'seed'
  | 'bandSize'
  | 'sharers'
  | 'reciprocators'
  | 'harvestKcal'
  | 'shelfLifeHours'
  | 'perceptionRadiusTiles'
  | 'patchCount'
  | 'patchRegrowthKcalPerHour'
>

const SETUP_FIELDS: { key: keyof Setup; label: string }[] = [
  { key: 'seed', label: 'Seed' },
  { key: 'bandSize', label: 'Foragers' },
  { key: 'sharers', label: 'Sharers' },
  { key: 'reciprocators', label: 'Reciprocators' },
  { key: 'harvestKcal', label: 'Windfall, kcal' },
  { key: 'shelfLifeHours', label: 'Keeps, h (0 = ∞)' },
  { key: 'perceptionRadiusTiles', label: 'Sight, tiles' },
  { key: 'patchCount', label: 'Patches' },
  { key: 'patchRegrowthKcalPerHour', label: 'Regrowth, kcal/h' },
]

const DEFAULT_SETUP = Object.fromEntries(SETUP_FIELDS.map(({ key }) => [key, LIFE_DEFAULT_CONFIG[key]])) as Setup

/** Every forager is drawn as its own figure, which stays smooth up to about this many. */
const MAX_BAND = 100

const startPair = (setup: Setup): DisplayPair => {
  const previous = createLife(setup)
  return { previous, next: stepLife(previous), alpha: 0 }
}

/** What the HUD shows, refreshed a few times a second rather than every frame. */
interface Snapshot {
  pair: DisplayPair
  /** The forager the HUD describes. */
  followed: number
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
  const [followedId, setFollowedId] = useState(0)
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP)
  const [draft, setDraft] = useState<Record<keyof Setup, string>>(() => stringify(DEFAULT_SETUP))
  const [setupError, setSetupError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snap(initialPair, 0, true))
  const [sceneError, setSceneError] = useState(false)
  // History starts open on wide screens and folded on phones, where it would cover the world.
  const [historyOpen, setHistoryOpen] = useState(() => window.matchMedia?.('(min-width: 721px)').matches ?? true)

  const runningRef = useRef(running)
  const speedRef = useRef(LIFE_SPEEDS[speedIndex]!)
  const selectedRef = useRef(selectedPatchId)
  const followedRef = useRef(followedId)
  // The animation loop reads the latest controls through refs, so changing them never restarts it.
  useEffect(() => {
    runningRef.current = running
    speedRef.current = LIFE_SPEEDS[speedIndex]!
    selectedRef.current = selectedPatchId
    followedRef.current = followedId
  }, [running, speedIndex, selectedPatchId, followedId])

  // One loop advances the clock and draws; React only refreshes the HUD.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let frame = 0
    let lastFrame = performance.now()
    let lastHud = 0
    const onPick = (pick: LifePick | null) => {
      if (pick?.kind === 'forager') {
        followedRef.current = pick.id
        setFollowedId(pick.id)
      } else setSelectedPatchId(pick?.id ?? null)
    }
    createLifeScene(mount, onPick)
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
            followedId: followedRef.current,
            nowMs: now,
          })
          if (now - lastHud >= HUD_INTERVAL_MS) {
            lastHud = now
            setSnapshot(snap(pairRef.current, followedRef.current, speed.interpolate))
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
    followedRef.current = 0
    setFollowedId(0)
    setSnapshot(snap(pairRef.current, 0, true))
  }, [])

  /** Follows another forager and refreshes the HUD at once, even while paused. */
  const follow = useCallback((id: number) => {
    followedRef.current = id
    setFollowedId(id)
    setSnapshot(snap(pairRef.current, id, true))
  }, [])

  /** Finishes the hour in progress, then shows the next one from its start. */
  const stepHour = useCallback(() => {
    const { next } = pairRef.current
    pairRef.current = { previous: next, next: stepLife(next), alpha: 0 }
    setSnapshot(snap(pairRef.current, followedRef.current, true))
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
    const parsed = Object.fromEntries(SETUP_FIELDS.map(({ key }) => [key, Number(draft[key])])) as Setup
    const errors = lifeConfigErrors({ ...LIFE_DEFAULT_CONFIG, ...parsed })
    if (!errors.length && parsed.bandSize > MAX_BAND) errors.push(`The observer shows at most ${MAX_BAND} foragers`)
    if (errors.length) {
      setSetupError(errors[0]!)
      return
    }
    setSetupError(null)
    setSetup(parsed)
    reset(parsed)
  }

  const { pair, energyKcal, hours, followed } = snapshot
  const state = pair.next
  const { config } = state
  const forager = state.foragers[followed]!
  const event = currentEvent(pair, followed)
  const name = foragerName(followed)
  const inspection = selectedPatchId === null ? null : patchInspection(state, selectedPatchId, followed)
  const summary = foragerSummary(state, followed)
  const keepers = config.bandSize - config.sharers - config.reciprocators
  const days = state.days.map((day) => ({
    day: day.day + 1,
    keepers: day.aliveByStrategy.keeper,
    sharers: day.aliveByStrategy.sharer,
    reciprocators: day.aliveByStrategy.reciprocator,
    given: day.givenKcal,
    spoiled: day.spoiledKcal,
    reserve: day.endEnergyKcal[followed]!,
    stock: day.totalPatchStockKcal / config.patchCount,
  }))
  const odds = Math.round(config.harvestKcal / config.forageKcalPerHour)
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
        <span className="life-title">Life 2 · sharing</span>
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

      <section className="life-card life-hud" aria-label={`The band, following ${name}`}>
        <div className="life-hud-head">
          <div className="life-clock num">{clockLabel(hours)}</div>
          <div className="life-band num">
            {aliveCount(state)} of {config.bandSize} alive
          </div>
        </div>
        <div className="life-follow" role="group" aria-label="Followed forager">
          <button
            type="button"
            className="icon-button"
            aria-label="Follow the previous forager"
            title="Previous forager"
            onClick={() => follow(stepFollowed(state, followed, -1))}
          >
            ‹
          </button>
          <span className="life-follow-name">
            <span
              className="life-strategy-dot"
              aria-hidden="true"
              style={{ background: STRATEGY_COLORS[forager.strategy] }}
            />
            {name} · {summary.strategy}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Follow the next forager"
            title="Next forager"
            onClick={() => follow(stepFollowed(state, followed, 1))}
          >
            ›
          </button>
        </div>
        <p className={`life-activity${forager.alive ? '' : ' is-dead'}`} aria-live="polite">
          {describeActivity(pair, followed)}
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
            <span>{!forager.alive ? 'Dead' : forager.hungry ? 'Hungry' : 'Not hungry'}</span>
            <span className="num">
              hungry below {formatKcal(config.hungryBelowKcal)} · full at {formatKcal(config.satiatedAtKcal)}
            </span>
          </div>
        </div>
        <dl className="life-food">
          <dt>Carries</dt>
          <dd className="num">
            {summary.carriedKcal ? formatKcal(summary.carriedKcal) : 'nothing'}
            {summary.carriedKcal > 0 &&
              (summary.spoilsInHours === null
                ? ', which keeps'
                : summary.spoilsInHours === 0
                  ? ', some spoiling this hour'
                  : `, oldest spoils in ${formatHours(summary.spoilsInHours)}`)}
          </dd>
          <dt>Has given</dt>
          <dd className="num">{formatKcal(summary.givenKcal)}</dd>
          <dt>Has received</dt>
          <dd className="num">{formatKcal(summary.receivedKcal)}</dd>
        </dl>
        <p className="life-note">
          {summary.strategy}: {summary.rule}.
          {event?.action === 'forage' && event.succeeded && ` It took a windfall of ${formatKcal(event.gatheredKcal)}.`}
        </p>
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
            <dt>{name} remembers</dt>
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
            <>
              <TimeChart
                data={days}
                height={100}
                format={(value) => String(Math.round(value))}
                domain={[0, 'auto']}
                series={[
                  { key: 'keepers', name: 'Keepers alive', color: STRATEGY_COLORS.keeper },
                  { key: 'sharers', name: 'Sharers alive', color: STRATEGY_COLORS.sharer },
                  { key: 'reciprocators', name: 'Reciprocators alive', color: STRATEGY_COLORS.reciprocator },
                ]}
              />
              <TimeChart
                data={days}
                height={100}
                format={(value) => `${Math.round(value / 1000)}k`}
                domain={[0, 'auto']}
                series={[
                  { key: 'given', name: 'Food given each day', color: palette.positive },
                  { key: 'spoiled', name: 'Food spoiled each day', color: palette.negative, dashed: true },
                ]}
              />
              <TimeChart
                data={days}
                height={120}
                format={(value) => `${Math.round(value / 1000)}k`}
                series={[
                  { key: 'reserve', name: `${name}’s reserve at day’s end`, color: palette.accent },
                  { key: 'stock', name: 'Food per patch, on average', color: palette.positive, dashed: true },
                ]}
              />
            </>
          ) : (
            <p className="life-note">The chart starts after the first full day.</p>
          )}
          <form className="life-setup" onSubmit={applySetup}>
            {SETUP_FIELDS.map(({ key, label }) => (
              <label key={key}>
                {label}
                <input
                  inputMode="numeric"
                  value={draft[key]}
                  onChange={(change) => setDraft({ ...draft, [key]: change.target.value })}
                />
              </label>
            ))}
            <button type="submit">Reset</button>
          </form>
          {setupError && (
            <p className="life-error" role="alert">
              {setupError}
            </p>
          )}
          <p className="life-note">
            Running seed {setup.seed}: {keepers} keepers, {setup.sharers} sharers and {setup.reciprocators}{' '}
            reciprocators, who see{' '}
            {seesEverything(state)
              ? 'every patch'
              : setup.perceptionRadiusTiles === 0
                ? 'only their own tile'
                : `${setup.perceptionRadiusTiles} tiles around them`}
            , on {setup.patchCount} patches regrowing {setup.patchRegrowthKcalPerHour} kcal an hour each. An hour of
            foraging {odds === 1 ? 'always yields' : `yields, about one time in ${odds},`}{' '}
            {formatKcal(setup.harvestKcal)}; carried food{' '}
            {setup.shelfLifeHours === 0 ? 'keeps' : `spoils after ${formatHours(setup.shelfLifeHours)}`}.
          </p>
        </details>
      </section>
    </div>
  )
}

function stringify(setup: Setup) {
  return Object.fromEntries(SETUP_FIELDS.map(({ key }) => [key, String(setup[key])])) as Record<keyof Setup, string>
}

function snap(pair: DisplayPair, followed: number, interpolate: boolean): Snapshot {
  return {
    pair,
    followed,
    energyKcal: displayedEnergy(pair, followed, interpolate),
    hours: interpolate ? displayHours(pair) : pair.next.tick,
  }
}
