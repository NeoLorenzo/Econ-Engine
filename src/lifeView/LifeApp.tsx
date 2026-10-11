import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { LIFE_DEFAULT_CONFIG, lifeConfigErrors } from '../life/config'
import { createLife, stepLife } from '../life/engine'
import type { LifeConfig } from '../life/types'
import { TimeChart } from '../ui/charts'
import { Icon } from '../ui/components'
import { palette } from '../ui/theme'
import { createLifeScene, type LifePick, type LifeScene, type LifeSite } from './lifeScene'
import {
  advanceClock,
  aliveCount,
  clockLabel,
  describeActivity,
  displayedEnergy,
  displayHours,
  foragerColor,
  foragerName,
  foragerSummary,
  formatHours,
  formatKcal,
  groveInspection,
  LIFE_SPEEDS,
  patchInspection,
  seesEverything,
  specializationPoints,
  stepFollowed,
  TERMS_COLORS,
  tradeSummary,
  type DisplayPair,
} from './lifeViewModel'
import { SpecializationChart } from './SpecializationChart'

type NumericSetup = Pick<
  LifeConfig,
  | 'seed'
  | 'bandSize'
  | 'skillMinPercent'
  | 'skillMaxPercent'
  | 'sharers'
  | 'reciprocators'
  | 'harvestKcal'
  | 'shelfLifeHours'
  | 'perceptionRadiusTiles'
  | 'patchCount'
  | 'patchRegrowthKcalPerHour'
  | 'groveCount'
>
type Setup = NumericSetup & Pick<LifeConfig, 'swapping' | 'quotes'>

const SETUP_FIELDS: { key: keyof NumericSetup; label: string }[] = [
  { key: 'seed', label: 'Seed' },
  { key: 'bandSize', label: 'Foragers' },
  { key: 'skillMinPercent', label: 'Skill from, %' },
  { key: 'skillMaxPercent', label: 'Skill to, %' },
  { key: 'sharers', label: 'Sharers' },
  { key: 'reciprocators', label: 'Reciprocators' },
  { key: 'harvestKcal', label: 'Harvest, kcal' },
  { key: 'shelfLifeHours', label: 'Keeps, h (0 = ∞)' },
  { key: 'perceptionRadiusTiles', label: 'Sight, tiles' },
  { key: 'patchCount', label: 'Patches' },
  { key: 'patchRegrowthKcalPerHour', label: 'Regrowth, kcal/h' },
  { key: 'groveCount', label: 'Groves' },
]

const SETUP_SWITCHES: { key: 'swapping' | 'quotes'; label: string }[] = [
  { key: 'swapping', label: 'Swapping' },
  { key: 'quotes', label: 'Telling terms' },
]

const DEFAULT_SETUP = Object.fromEntries(
  [...SETUP_FIELDS, ...SETUP_SWITCHES].map(({ key }) => [key, LIFE_DEFAULT_CONFIG[key]]),
) as Setup

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

const formatUnits = (units: number) => `${units.toLocaleString('en-US')} ${units === 1 ? 'unit' : 'units'}`

export default function LifeApp() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<LifeScene | null>(null)
  const [initialPair] = useState(() => startPair(DEFAULT_SETUP))
  const pairRef = useRef<DisplayPair>(initialPair)
  const [running, setRunning] = useState(true)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [selected, setSelected] = useState<LifeSite | null>(null)
  const [followedId, setFollowedId] = useState(0)
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP)
  const [draft, setDraft] = useState<Record<keyof NumericSetup, string>>(() => stringify(DEFAULT_SETUP))
  const [switches, setSwitches] = useState({ swapping: DEFAULT_SETUP.swapping, quotes: DEFAULT_SETUP.quotes })
  const [setupError, setSetupError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snap(initialPair, 0, true))
  const [sceneError, setSceneError] = useState(false)
  // History starts open on wide screens and folded on phones, where it would cover the world.
  const [historyOpen, setHistoryOpen] = useState(() => window.matchMedia?.('(min-width: 721px)').matches ?? true)

  const runningRef = useRef(running)
  const speedRef = useRef(LIFE_SPEEDS[speedIndex]!)
  const selectedRef = useRef(selected)
  const followedRef = useRef(followedId)
  // The animation loop reads the latest controls through refs, so changing them never restarts it.
  useEffect(() => {
    runningRef.current = running
    speedRef.current = LIFE_SPEEDS[speedIndex]!
    selectedRef.current = selected
    followedRef.current = followedId
  }, [running, speedIndex, selected, followedId])

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
      } else setSelected(pick)
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
            selected: selectedRef.current,
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
    setSelected(null)
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
      } else if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const applySetup = (event: FormEvent) => {
    event.preventDefault()
    const parsed = {
      ...(Object.fromEntries(SETUP_FIELDS.map(({ key }) => [key, Number(draft[key])])) as NumericSetup),
      ...switches,
    }
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
  const name = foragerName(followed)
  const patch = selected?.kind === 'patch' ? patchInspection(state, selected.id, followed) : null
  const grove = selected?.kind === 'grove' ? groveInspection(state, selected.id, followed) : null
  const summary = foragerSummary(state, followed)
  const trade = tradeSummary(state, followed)
  const gifting = config.sharers + config.reciprocators > 0
  const days = state.days.map((day) => ({
    day: day.day + 1,
    alive: day.alive,
    swappedWood: day.swappedWood,
    coldHours: day.coldSleepHours,
    reserve: day.endEnergyKcal[followed]!,
    stock: day.totalPatchStockKcal / config.patchCount,
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
        <span className="life-title">Life 3 · specialization</span>
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
              style={{ background: foragerColor(config, forager) }}
            />
            {name}
            {gifting && ` · ${summary.strategy}`}
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
          <dt>Skills</dt>
          <dd className="num">
            {formatKcal(trade.forageRate)}/h · {trade.woodRate} wood/h
          </dd>
          <dt>Wood costs it</dt>
          <dd className="num">{Math.round(trade.ownTerms)} kcal a unit</dd>
          <dt>Holds</dt>
          <dd className="num">
            {formatUnits(trade.wood)} of wood{trade.wood < trade.woodTarget && ` (wants ${trade.woodTarget})`}
          </dd>
          <dt>Carries</dt>
          <dd className="num">
            {summary.carriedKcal ? formatKcal(summary.carriedKcal) : 'no food'}
            {summary.carriedKcal > 0 &&
              (summary.spoilsInHours === null
                ? ', which keeps'
                : summary.spoilsInHours === 0
                  ? ', some spoiling this hour'
                  : `, oldest spoils in ${formatHours(summary.spoilsInHours)}`)}
          </dd>
          <dt>Terms it heard</dt>
          <dd className="num">
            {trade.heardTerms === null
              ? 'none it remembers'
              : `${trade.heardTerms} kcal a unit, ${trade.heardHoursAgo ? `${formatHours(trade.heardHoursAgo)} ago` : 'this hour'}`}
          </dd>
          <dt>Has swapped</dt>
          <dd className="num">
            sold {formatUnits(trade.woodSold)}, bought {formatUnits(trade.woodBought)}
          </dd>
          {gifting && (
            <>
              <dt>Gifts</dt>
              <dd className="num">
                gave {formatKcal(summary.givenKcal)}, got {formatKcal(summary.receivedKcal)}
              </dd>
            </>
          )}
        </dl>
        {gifting && (
          <p className="life-note">
            {summary.strategy}: {summary.rule}.
          </p>
        )}
      </section>

      {(patch || grove) && (
        <section className="life-card life-inspector" aria-label={(patch ?? grove)!.name}>
          <header>
            <h2>{(patch ?? grove)!.name}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
          </header>
          {patch && (
            <>
              <dl>
                <dt>Actually holds</dt>
                <dd className="num">
                  {patch.trueStockKcal.toLocaleString('en-US')} of {formatKcal(patch.capacityKcal)}
                </dd>
                <dt>{name} remembers</dt>
                <dd className="num">{formatKcal(patch.rememberedStockKcal)}</dd>
                <dt>Last seen</dt>
                <dd>{patch.seen}</dd>
              </dl>
              <p className="life-note">
                {patch.differenceKcal === 0
                  ? 'Its memory is up to date.'
                  : `It knows only what it last saw, so it ${patch.differenceKcal > 0 ? 'underestimates' : 'overestimates'} this patch by ${formatKcal(Math.abs(patch.differenceKcal))}.`}
              </p>
            </>
          )}
          {grove && (
            <>
              <dl>
                <dt>Actually holds</dt>
                <dd className="num">
                  {grove.wood} of {formatUnits(grove.capacity)}
                </dd>
                <dt>{name} remembers</dt>
                <dd className="num">{formatUnits(grove.rememberedWood)}</dd>
                <dt>Last seen</dt>
                <dd>{grove.seen}</dd>
              </dl>
              <p className="life-note">
                {grove.difference === 0
                  ? 'Its memory is up to date.'
                  : `It knows only what it last saw, so it ${grove.difference > 0 ? 'underestimates' : 'overestimates'} this grove by ${formatUnits(Math.abs(grove.difference))}.`}
              </p>
            </>
          )}
        </section>
      )}

      <section className="life-card life-history" aria-label="History">
        <details open={historyOpen} onToggle={(toggle) => setHistoryOpen(toggle.currentTarget.open)}>
          <summary>History and setup</summary>
          <SpecializationChart points={specializationPoints(state)} config={config} followed={followed} />
          {days.length > 1 ? (
            <>
              <TimeChart
                data={days}
                height={100}
                format={(value) => String(Math.round(value))}
                domain={[0, 'auto']}
                series={[
                  { key: 'swappedWood', name: 'Wood swapped each day', color: palette.accent },
                  { key: 'coldHours', name: 'Hours slept cold each day', color: palette.firmA, dashed: true },
                  { key: 'alive', name: 'Alive', color: palette.household },
                ]}
              />
              <TimeChart
                data={days}
                height={110}
                format={(value) => `${Math.round(value / 1000)}k`}
                series={[
                  { key: 'reserve', name: `${name}’s reserve at day’s end`, color: palette.accent },
                  { key: 'stock', name: 'Food per patch, on average', color: palette.positive, dashed: true },
                ]}
              />
            </>
          ) : (
            <p className="life-note">The charts over time start after the first full day.</p>
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
            {SETUP_SWITCHES.map(({ key, label }) => (
              <label key={key} className="life-switch">
                <input
                  type="checkbox"
                  checked={switches[key]}
                  onChange={(change) => setSwitches({ ...switches, [key]: change.target.checked })}
                />
                {label}
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
            Running seed {setup.seed}: {setup.bandSize} foragers with skills from {setup.skillMinPercent}% to{' '}
            {setup.skillMaxPercent}%, coloured from{' '}
            <span style={{ color: TERMS_COLORS.gatherer }}>relatively good at gathering wood</span> to{' '}
            <span style={{ color: TERMS_COLORS.forager }}>relatively good at foraging</span>. They{' '}
            {setup.swapping
              ? `swap wood for food at camp${setup.quotes ? ', telling each other their terms' : ', without telling terms'}`
              : 'never swap'}
            , and see{' '}
            {seesEverything(state)
              ? 'every patch'
              : setup.perceptionRadiusTiles === 0
                ? 'only their own tile'
                : `${setup.perceptionRadiusTiles} tiles around them`}
            . There are {setup.patchCount} patches regrowing {setup.patchRegrowthKcalPerHour} kcal an hour each and{' '}
            {setup.groveCount} groves; carried food{' '}
            {setup.shelfLifeHours === 0 ? 'keeps' : `spoils after ${formatHours(setup.shelfLifeHours)}`}.
          </p>
        </details>
      </section>
    </div>
  )
}

function stringify(setup: Setup) {
  return Object.fromEntries(SETUP_FIELDS.map(({ key }) => [key, String(setup[key])])) as Record<
    keyof NumericSetup,
    string
  >
}

function snap(pair: DisplayPair, followed: number, interpolate: boolean): Snapshot {
  return {
    pair,
    followed,
    energyKcal: displayedEnergy(pair, followed, interpolate),
    hours: interpolate ? displayHours(pair) : pair.next.tick,
  }
}
