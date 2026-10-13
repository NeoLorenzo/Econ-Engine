import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { SpecializationChart } from '../lifeView/SpecializationChart'
import { TimeChart } from '../ui/charts'
import { Icon } from '../ui/components'
import { palette } from '../ui/theme'
import { VALLEY_DEFAULT_CONFIG, valleyConfigErrors } from '../valley/config'
import { createValley, runValley, stepValley } from '../valley/engine'
import { layoutError } from '../valley/layout'
import type { ValleyConfig } from '../valley/types'
import { createValleyScene, type ValleyPick, type ValleyScene, type ValleySelection } from './valleyScene'
import {
  advanceClock,
  aliveCount,
  clockLabel,
  daySeries,
  DEFAULT_SPEED_INDEX,
  describeActivity,
  displayedEnergy,
  displayMinutes,
  fireSaving,
  flagInspection,
  foragerColor,
  foragerName,
  foragerSummary,
  formatKcal,
  formatHours,
  formatMinutes,
  groupColor,
  groupName,
  ownTermsByDay,
  plantInspection,
  specializationPoints,
  stepFollowed,
  TERMS_COLORS,
  VALLEY_SPEEDS,
  type DisplayPair,
} from './valleyViewModel'

type NumericSetup = Pick<
  ValleyConfig,
  | 'seed'
  | 'bandSize'
  | 'woodLoad'
  | 'skillMinPercent'
  | 'skillMaxPercent'
  | 'practiceDays'
  | 'practiceHalfHours'
  | 'practiceMinPercent'
  | 'practiceMaxPercent'
  | 'exploreAfterHours'
>
type SwitchKey = 'groups' | 'scattered' | 'explore' | 'knowValley' | 'swapping' | 'quotes' | 'practice'
type Setup = NumericSetup & Pick<ValleyConfig, SwitchKey>

const SETUP_FIELDS: { key: keyof NumericSetup; label: string }[] = [
  { key: 'seed', label: 'Seed' },
  { key: 'bandSize', label: 'Foragers' },
  { key: 'woodLoad', label: 'Load, kg' },
  { key: 'skillMinPercent', label: 'Skill from, %' },
  { key: 'skillMaxPercent', label: 'Skill to, %' },
  { key: 'practiceDays', label: 'Practice, days' },
  { key: 'practiceHalfHours', label: 'Half way, h' },
  { key: 'practiceMinPercent', label: 'Practice from, %' },
  { key: 'practiceMaxPercent', label: 'Practice to, %' },
  { key: 'exploreAfterHours', label: 'Explore after, h' },
]

const SETUP_SWITCHES: { key: SwitchKey; label: string }[] = [
  { key: 'groups', label: 'Groups' },
  { key: 'scattered', label: 'Start scattered' },
  { key: 'explore', label: 'Explore' },
  { key: 'knowValley', label: 'Know the valley' },
  { key: 'practice', label: 'Practice' },
  { key: 'swapping', label: 'Swapping' },
  { key: 'quotes', label: 'Telling terms' },
]

const DEFAULT_SETUP = Object.fromEntries(
  [...SETUP_FIELDS, ...SETUP_SWITCHES].map(({ key }) => [key, VALLEY_DEFAULT_CONFIG[key]]),
) as Setup

/** Every forager is drawn as its own figure, which stays smooth up to about this many. */
const MAX_BAND = 100

const startPair = (setup: Setup): DisplayPair => {
  const previous = createValley(setup)
  return { previous, next: stepValley(previous), alpha: 0 }
}

/** What the HUD shows, refreshed a few times a second rather than every frame. */
interface Snapshot {
  pair: DisplayPair
  followed: number
  energyKcal: number
  minutes: number
}

const HUD_INTERVAL_MS = 100

const formatChange = (change: number) =>
  change ? ` (${change > 0 ? '+' : '−'}${Math.abs(change).toLocaleString('en-US')})` : ''

const formatKg = (kg: number) => `${kg.toLocaleString('en-US')} kg`

export default function ValleyApp() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<ValleyScene | null>(null)
  const [initialPair] = useState(() => startPair(DEFAULT_SETUP))
  const pairRef = useRef<DisplayPair>(initialPair)
  const [running, setRunning] = useState(true)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const [selected, setSelected] = useState<ValleySelection | null>(null)
  const [followedId, setFollowedId] = useState(0)
  const [following, setFollowing] = useState(true)
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP)
  const [draft, setDraft] = useState<Record<keyof NumericSetup, string>>(() => stringify(DEFAULT_SETUP))
  const [switches, setSwitches] = useState<Pick<Setup, SwitchKey>>(
    () => Object.fromEntries(SETUP_SWITCHES.map(({ key }) => [key, DEFAULT_SETUP[key]])) as Pick<Setup, SwitchKey>,
  )
  const [setupError, setSetupError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snap(initialPair, 0, true))
  const [sceneError, setSceneError] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(() => window.matchMedia?.('(min-width: 721px)').matches ?? true)

  const runningRef = useRef(running)
  const speedRef = useRef(VALLEY_SPEEDS[speedIndex]!)
  const selectedRef = useRef(selected)
  const followedRef = useRef(followedId)
  const followingRef = useRef(following)
  // The animation loop reads the latest controls through refs, so changing them never restarts it.
  useEffect(() => {
    runningRef.current = running
    speedRef.current = VALLEY_SPEEDS[speedIndex]!
    selectedRef.current = selected
    followedRef.current = followedId
    followingRef.current = following
  }, [running, speedIndex, selected, followedId, following])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let frame = 0
    let lastFrame = performance.now()
    let lastHud = 0
    const onPick = (pick: ValleyPick | null) => {
      if (pick?.kind === 'forager') {
        followedRef.current = pick.id
        followingRef.current = true
        setFollowedId(pick.id)
        setFollowing(true)
      } else setSelected(pick)
    }
    const onPan = () => {
      if (!followingRef.current) return
      followingRef.current = false
      setFollowing(false)
    }
    createValleyScene(mount, { onPick, onPan })
      .then((scene) => {
        if (disposed) return scene.dispose()
        sceneRef.current = scene
        scene.setWorld(pairRef.current.next)
        const loop = (now: number) => {
          const elapsed = (now - lastFrame) / 1000
          lastFrame = now
          const speed = speedRef.current
          if (runningRef.current) {
            const clock = advanceClock(pairRef.current.alpha, elapsed, speed.minutesPerSecond)
            let { previous, next } = pairRef.current
            if (clock.steps > 0) {
              // Only the last minute is drawn between two states; any before it run in one go.
              previous = clock.steps > 1 ? runValley(next, clock.steps - 1, { recordEvents: false }) : next
              next = stepValley(previous)
            }
            pairRef.current = { previous, next, alpha: clock.alpha }
          }
          scene.draw(pairRef.current, {
            interpolate: speed.interpolate,
            selected: selectedRef.current,
            followedId: followedRef.current,
            following: followingRef.current,
            nowMs: now,
            elapsedSeconds: elapsed,
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
    followingRef.current = true
    setFollowedId(0)
    setFollowing(true)
    setSnapshot(snap(pairRef.current, 0, true))
  }, [])

  const follow = useCallback((id: number) => {
    followedRef.current = id
    followingRef.current = true
    setFollowedId(id)
    setFollowing(true)
    setSnapshot(snap(pairRef.current, id, true))
  }, [])

  /** Finishes the minute in progress, then shows the next one from its start. */
  const stepMinute = useCallback(() => {
    const { next } = pairRef.current
    pairRef.current = { previous: next, next: stepValley(next), alpha: 0 }
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
    const config = { ...VALLEY_DEFAULT_CONFIG, ...parsed }
    const errors = valleyConfigErrors(config)
    if (!errors.length && parsed.bandSize > MAX_BAND) errors.push(`The observer shows at most ${MAX_BAND} foragers`)
    if (!errors.length) {
      const unplaceable = layoutError(config)
      if (unplaceable) errors.push(unplaceable)
    }
    if (errors.length) {
      setSetupError(errors[0]!)
      return
    }
    setSetupError(null)
    setSetup(parsed)
    reset(parsed)
  }

  const { pair, energyKcal, minutes, followed } = snapshot
  const state = pair.next
  const { config } = state
  const forager = state.foragers[followed]!
  const name = foragerName(followed)
  const plant =
    selected && selected.kind !== 'flag' ? plantInspection(state, selected.kind, selected.id, followed) : null
  const flag = selected?.kind === 'flag' ? flagInspection(state, selected.id) : null
  const summary = foragerSummary(state, followed)
  const fire = fireSaving(config)
  const days = daySeries(state, followed)
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
        <span className="life-title">Life 6 · groups</span>
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
            aria-label="Step one minute"
            title="Step one minute"
            disabled={running}
            onClick={stepMinute}
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
            {VALLEY_SPEEDS.map((speed, index) => (
              <option key={speed.label} value={index}>
                {speed.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="life-card life-hud" aria-label={`The band, following ${name}`}>
        <div className="life-hud-head">
          <div className="life-clock num">{clockLabel(minutes / 60)}</div>
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
        {!following && (
          <button type="button" className="valley-goto" onClick={() => follow(followed)}>
            Go to {name}
          </button>
        )}
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
          {config.groups && (
            <>
              <dt>Group</dt>
              <dd>
                {summary.groupId === null ? (
                  'none yet, looking for company'
                ) : (
                  <>
                    <span
                      className="life-strategy-dot"
                      aria-hidden="true"
                      style={{ background: groupColor(summary.groupId) }}
                    />
                    {groupName(summary.groupId)}
                    {summary.joinedMinutesAgo !== null &&
                      `, joined ${summary.joinedMinutesAgo ? `${formatMinutes(summary.joinedMinutesAgo)} ago` : 'this minute'}`}
                    {summary.fellows.length > 0 && ` with ${summary.fellows.join(', ')}`}
                  </>
                )}
              </dd>
            </>
          )}
          <dt>Has seen</dt>
          <dd className="num">{Math.round(summary.seenShare * 100)}% of the valley</dd>
          <dt>Skills</dt>
          <dd className="num">
            {formatKcal(summary.forageRate)}/h{formatChange(summary.forageRateChange)} · {summary.woodRate} kg/h
            {formatChange(summary.woodRateChange)}
          </dd>
          {config.practice && (
            <>
              <dt>Picking practice</dt>
              <dd className="num">
                {summary.foragePercent}% from {summary.forageHours} h in {config.practiceDays} days
              </dd>
              <dt>Wood practice</dt>
              <dd className="num">
                {summary.woodPercent}% from {summary.gatherHours} h in {config.practiceDays} days
              </dd>
            </>
          )}
          <dt>Wood costs it</dt>
          <dd className="num">{Math.round(summary.ownTerms)} kcal a kg</dd>
          <dt>Holds</dt>
          <dd className="num">
            {formatKg(summary.wood)} of wood{summary.wood < summary.woodTarget && ` (wants ${summary.woodTarget})`}
          </dd>
          {summary.tripWood > 0 && (
            <>
              <dt>This trip</dt>
              <dd className="num">
                {formatKg(summary.tripWood)} gathered of a {formatKg(config.woodLoad)} load
              </dd>
            </>
          )}
          {fire && (
            <>
              <dt>A night’s fire</dt>
              <dd className="num">
                {formatKg(fire.wood)} of wood saves {formatKcal(fire.kcal)}
              </dd>
            </>
          )}
          <dt>Carries</dt>
          <dd className="num">
            {summary.carriedKcal ? formatKcal(summary.carriedKcal) : 'no food'}
            {summary.carriedKcal > 0 &&
              summary.spoilsInMinutes !== null &&
              `, oldest spoils in ${formatMinutes(summary.spoilsInMinutes)}`}
          </dd>
          <dt>Terms it heard</dt>
          <dd className="num">
            {summary.heardTerms === null
              ? 'none it remembers'
              : `${summary.heardTerms} kcal a kg, ${summary.heardMinutesAgo ? `${formatMinutes(summary.heardMinutesAgo)} ago` : 'this minute'}`}
          </dd>
          <dt>Has swapped</dt>
          <dd className="num">
            sold {formatKg(summary.woodSold)}, bought {formatKg(summary.woodBought)}
          </dd>
        </dl>
      </section>

      {plant && (
        <section className="life-card life-inspector" aria-label={plant.name}>
          <header>
            <h2>{plant.name}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
          </header>
          <dl>
            <dt>Actually holds</dt>
            <dd className="num">
              {selected!.kind === 'bush'
                ? `${plant.stock.toLocaleString('en-US')} of ${formatKcal(plant.capacity)}`
                : `${plant.stock} of ${formatKg(plant.capacity)} of deadwood`}
            </dd>
            <dt>{name} remembers</dt>
            <dd className="num">
              {plant.remembered === null
                ? 'nothing'
                : selected!.kind === 'bush'
                  ? formatKcal(plant.remembered)
                  : formatKg(plant.remembered)}
            </dd>
            <dt>Last seen</dt>
            <dd>{plant.seen}</dd>
          </dl>
          <p className="life-note">
            {plant.remembered === null
              ? `${name} has never seen this ${selected!.kind}, so it does not know it is here.`
              : plant.difference === 0
                ? 'Its memory is up to date.'
                : `It knows only what it last saw, so it ${plant.difference > 0 ? 'underestimates' : 'overestimates'} this ${selected!.kind} by ${selected!.kind === 'bush' ? formatKcal(Math.abs(plant.difference)) : formatKg(Math.abs(plant.difference))}.`}
          </p>
        </section>
      )}

      {flag && (
        <section className="life-card life-inspector" aria-label={flag.name}>
          <header>
            <h2>
              <span className="life-strategy-dot" aria-hidden="true" style={{ background: flag.color }} />
              {flag.name}
            </h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
          </header>
          <dl>
            <dt>Founded</dt>
            <dd className="num">
              {flag.foundedAgo ? `${formatMinutes(flag.foundedAgo)} ago` : 'this minute'}, on day{' '}
              {Math.floor(flag.founded / 1_440) + 1}
            </dd>
            <dt>Members</dt>
            <dd>{flag.members.length ? flag.members.join(', ') : 'none alive'}</dd>
          </dl>
          <p className="life-note">
            {flag.dissolved
              ? 'The group dissolved when only one of its members was left alive, and its flag came down.'
              : `Its members sleep at their hearths around this flag and swap only with each other. ${flag.joinedEver} have joined it.`}
          </p>
        </section>
      )}

      <section className="life-card life-history" aria-label="History">
        <details open={historyOpen} onToggle={(toggle) => setHistoryOpen(toggle.currentTarget.open)}>
          <summary>History and setup</summary>
          <SpecializationChart points={specializationPoints(state)} config={config} followed={followed} woodUnit="kg" />
          {days.length > 1 ? (
            <>
              <TimeChart
                data={ownTermsByDay(state, followed)}
                height={100}
                format={(value) => String(Math.round(value))}
                domain={[0, 'auto']}
                series={[
                  { key: 'highest', name: 'Wood costs, highest', color: TERMS_COLORS.forager },
                  { key: 'lowest', name: 'Wood costs, lowest', color: TERMS_COLORS.gatherer },
                  { key: 'followed', name: `Wood costs ${name}`, color: palette.accent, dashed: true },
                ]}
              />
              <TimeChart
                data={days}
                height={100}
                format={(value) => String(Math.round(value))}
                domain={[0, 'auto']}
                series={[
                  { key: 'swappedWood', name: 'Wood swapped each day, kg', color: palette.accent },
                  { key: 'coldHours', name: 'Hours slept cold each day', color: palette.firmA, dashed: true },
                  { key: 'alive', name: 'Alive', color: palette.household },
                ]}
              />
              {config.groups && (
                <TimeChart
                  data={days}
                  height={90}
                  format={(value) => String(Math.round(value))}
                  domain={[0, 'auto']}
                  series={[
                    { key: 'groups', name: 'Groups', color: palette.accent },
                    { key: 'loners', name: 'Without a group', color: palette.firmA, dashed: true },
                  ]}
                />
              )}
              <TimeChart
                data={days}
                height={110}
                format={(value) => (value >= 1_000 ? `${Math.round(value / 1000)}k` : String(Math.round(value)))}
                series={[
                  { key: 'reserve', name: `${name}’s reserve at day’s end`, color: palette.accent },
                  { key: 'stock', name: 'Berries per bush, kcal', color: palette.positive, dashed: true },
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
            Running seed {setup.seed}: {setup.bandSize} foragers in a valley {config.valleySizeCm / 100} m across,{' '}
            {setup.scattered ? 'who start scattered' : 'who start around the meadow in the middle'},{' '}
            {setup.knowValley ? 'knowing the whole valley' : 'knowing only what they have seen'}, and{' '}
            {setup.explore
              ? `explore places they have not seen for ${formatHours(setup.exploreAfterHours)} when their needs are met`
              : 'rest when their needs are met'}
            .{' '}
            {setup.groups
              ? 'Those without a group look for company: two who meet found a group and plant its flag, and anyone who meets a member joins. Members sleep around their flag and swap only with each other.'
              : 'There are no groups: anyone may swap with anyone they meet.'}{' '}
            They are born with skills{' '}
            {setup.skillMinPercent === setup.skillMaxPercent
              ? `of ${setup.skillMinPercent}%`
              : `from ${setup.skillMinPercent}% to ${setup.skillMaxPercent}%`}
            {setup.practice
              ? `, which grow with practice over ${setup.practiceDays} days from ${setup.practiceMinPercent}% towards ${setup.practiceMaxPercent}%`
              : ', fixed for life'}
            . They pick berries bush by bush, gather deadwood under the trees and bring it home in loads of{' '}
            {formatKg(setup.woodLoad)}, and{' '}
            {setup.swapping
              ? `swap wood for food${setup.quotes ? ', telling each other their terms' : ', without telling terms'}`
              : 'never swap'}
            . Each is coloured by what wood costs it, from{' '}
            <span style={{ color: TERMS_COLORS.gatherer }}>relatively good at gathering wood</span> to{' '}
            <span style={{ color: TERMS_COLORS.forager }}>relatively good at picking</span>, and wears a band in its
            group’s colour. Ground the followed person has never seen is darkest, and ground it has not seen lately a
            little dark. Drag to pan, scroll or pinch to zoom, right-drag or Q and E to turn; click a person to follow
            them, and a bush, tree or flag to inspect it.
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
    minutes: displayMinutes(pair, interpolate),
  }
}
