import { LandMap } from './LandMap'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { SpecializationChart } from './SpecializationChart'
import { TimeChart } from '../ui/charts'
import { Icon } from '../ui/components'
import { palette } from '../ui/theme'
import { VALLEY_DEFAULT_CONFIG, valleyConfigErrors } from '../valley/config'
import { createValley, stepValley } from '../valley/engine'
import { isDaylight } from '../valley/forager'
import { layoutError } from '../valley/layout'
import type { ValleyConfig } from '../valley/types'
import { createValleyScene, type ValleyPick, type ValleyScene, type ValleySelection } from './valleyScene'
import {
  advanceClock,
  advancePlayback,
  aliveCount,
  clearView,
  clockLabel,
  daySeries,
  daysOfFoodLeft,
  DEFAULT_SPEED_INDEX,
  describeActivity,
  displayedEnergy,
  displayMinutes,
  fireSaving,
  foragerColor,
  foragerName,
  foragerSummary,
  formatKcal,
  formatHours,
  formatMinutes,
  groupColor,
  groupInspection,
  groupName,
  hutInspection,
  lakeInspection,
  ownTermsByDay,
  plantInspection,
  stoneInspection,
  specializationPoints,
  stepFollowed,
  TERMS_COLORS,
  VALLEY_SPEEDS,
  type ClearView,
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
  | 'sightRadiusCm'
  | 'campfireWoodPerHour'
  | 'craftSkillMinPercent'
  | 'craftSkillMaxPercent'
>
type SwitchKey = 'scattered' | 'axeTrade' | 'craftPractice'
type Setup = NumericSetup & Pick<ValleyConfig, SwitchKey>

/** A field is typed in its own unit: `unit` of the configuration's units make one of it. */
const SETUP_FIELDS: { key: keyof NumericSetup; label: string; unit?: number }[] = [
  { key: 'seed', label: 'Seed' },
  { key: 'bandSize', label: 'Foragers' },
  { key: 'woodLoad', label: 'Load, kg' },
  { key: 'skillMinPercent', label: 'Skill from, %' },
  { key: 'skillMaxPercent', label: 'Skill to, %' },
  { key: 'practiceDays', label: 'Practice, days' },
  { key: 'practiceHalfHours', label: 'Half way, h' },
  { key: 'practiceMinPercent', label: 'Practice from, %' },
  { key: 'practiceMaxPercent', label: 'Practice to, %' },
  { key: 'exploreAfterHours', label: 'Check after, h' },
  { key: 'sightRadiusCm', label: 'Sight, m', unit: 100 },
  { key: 'campfireWoodPerHour', label: 'Group fire, kg/h' },
  { key: 'craftSkillMinPercent', label: 'Craft from, %' },
  { key: 'craftSkillMaxPercent', label: 'Craft to, %' },
]

const SETUP_SWITCHES: { key: SwitchKey; label: string }[] = [
  { key: 'scattered', label: 'Start scattered' },
  { key: 'axeTrade', label: 'Axes can be sold' },
  { key: 'craftPractice', label: 'Craft grows with practice' },
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

/** The part of the valley's view the cards over it leave clear, measured from the page. */
function measureClear(mount: HTMLElement | null): ClearView | null {
  if (!mount) return null
  const view = mount.getBoundingClientRect()
  const cards = [...document.querySelectorAll('.life-card')].map((card) => {
    const rect = card.getBoundingClientRect()
    return {
      left: rect.left - view.left,
      top: rect.top - view.top,
      right: rect.right - view.left,
      bottom: rect.bottom - view.top,
    }
  })
  return clearView(view.width, view.height, cards)
}

/** A fire's state in a few words: lit, banked by day, or out, with the wood it holds. */
const fireLabel = (fire: { lit: boolean; wood: number; nights: number }, daylight: boolean) =>
  `${fire.lit ? 'burning' : daylight && fire.wood > 0 ? 'banked for the night' : 'out'}, ${formatKg(fire.wood)} of wood${fire.wood ? ` (${fire.nights.toFixed(1)} nights)` : ''}`

export default function ValleyApp() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<ValleyScene | null>(null)
  const [initialPair] = useState(() => startPair(DEFAULT_SETUP))
  const pairRef = useRef<DisplayPair>(initialPair)
  const [running, setRunning] = useState(true)
  const [showFlow, setShowFlow] = useState(false)
  const flowRef = useRef(false)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const [selected, setSelected] = useState<ValleySelection | null>(null)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [followedId, setFollowedId] = useState(0)
  const [following, setFollowing] = useState(true)
  const [mapView, setMapView] = useState<ReturnType<ValleyScene['view']> | null>(null)
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
  const highlightedRef = useRef(highlightedId)
  const clearRef = useRef<ClearView | null>(null)
  /** A group to frame once its card is on the page, so the camera can fit it into the part of the view left clear. */
  const frameRef = useRef<number | null>(null)
  const followedRef = useRef(followedId)
  const followingRef = useRef(following)
  // The animation loop reads the latest controls through refs, so changing them never restarts it.
  useEffect(() => {
    runningRef.current = running
    flowRef.current = showFlow
    speedRef.current = VALLEY_SPEEDS[speedIndex]!
    selectedRef.current = selected
    highlightedRef.current = highlightedId
    followedRef.current = followedId
    followingRef.current = following
  }, [running, speedIndex, selected, highlightedId, followedId, following, showFlow])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let frame = 0
    let lastFrame = performance.now()
    let lastHud = 0
    let lastStepMs = 0
    const onPick = (pick: ValleyPick | null) => {
      if (pick?.kind === 'forager') {
        followedRef.current = pick.id
        followingRef.current = true
        setFollowedId(pick.id)
        setFollowing(true)
      } else if (pick?.kind === 'group') {
        // Picking a group's flag, base or badge frames the group, as its chip does.
        setSelected(pick)
        followingRef.current = false
        setFollowing(false)
        frameRef.current = pick.id
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
            const advanced = advancePlayback(pairRef.current, clock.steps, clock.alpha, lastStepMs)
            pairRef.current = advanced.pair
            lastStepMs = advanced.lastStepMs
          }
          scene.draw(pairRef.current, {
            showFlow: flowRef.current,
            interpolate: speed.interpolate,
            selected: selectedRef.current,
            highlightedId: highlightedRef.current,
            clear: clearRef.current,
            followedId: followedRef.current,
            following: followingRef.current,
            nowMs: now,
            elapsedSeconds: elapsed,
          })
          if (now - lastHud >= HUD_INTERVAL_MS) {
            lastHud = now
            clearRef.current = measureClear(mount)
            setSnapshot(snap(pairRef.current, followedRef.current, speed.interpolate))
            setMapView(scene.view())
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

  /** Selects a group and moves the camera to take in its base and members, which stops following a forager. */
  const showGroup = useCallback((id: number) => {
    setSelected({ kind: 'group', id })
    followingRef.current = false
    setFollowing(false)
    frameRef.current = id
  }, [])

  // The group card opens with the selection, so the camera frames the group only once the card is laid out.
  useLayoutEffect(() => {
    const id = frameRef.current
    if (id === null) return
    frameRef.current = null
    const clear = measureClear(mountRef.current)
    clearRef.current = clear
    sceneRef.current?.showGroup(id, clear)
  })

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
      ...(Object.fromEntries(
        SETUP_FIELDS.map(({ key, unit = 1 }) => [key, Number(draft[key]) * unit]),
      ) as NumericSetup),
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
    selected && (selected.kind === 'bush' || selected.kind === 'hazel' || selected.kind === 'tree')
      ? plantInspection(state, selected.kind, selected.id, followed)
      : null
  const lake = selected?.kind === 'lake' ? lakeInspection(state, followed, selected.id) : null
  const stone = selected?.kind === 'stone' ? stoneInspection(state, selected.id, followed) : null
  const hut = selected?.kind === 'hut' && state.huts[selected.id] ? hutInspection(state, selected.id) : null
  const group = selected?.kind === 'group' && state.groups[selected.id] ? groupInspection(pair, selected.id) : null
  const standing = state.groups.filter((made) => made.dissolvedMinute === null)
  const summary = foragerSummary(state, followed)
  const fire = fireSaving(config)
  const days = daySeries(state, followed)
  const percent = (value: number) => `${(value / config.reserveMaxKcal) * 100}%`
  const foodLeft = daysOfFoodLeft(state, followed)

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
        <span className="life-title">Life 11 · water</span>
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
          <button
            type="button"
            aria-pressed={showFlow}
            onClick={() => setShowFlow((value) => !value)}
            title="Downstream direction; no discharge or velocity is simulated"
          >
            Flow
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
        {standing.length > 0 && (
          <div className="valley-groups" role="group" aria-label="Groups">
            {standing.map((made) => (
              <button
                key={made.id}
                type="button"
                className={`valley-group-chip${selected?.kind === 'group' && selected.id === made.id ? ' is-selected' : ''}`}
                style={{ borderColor: groupColor(made.id) }}
                aria-label={`Show ${groupName(made.id)}`}
                aria-pressed={selected?.kind === 'group' && selected.id === made.id}
                onClick={() => showGroup(made.id)}
              >
                <span className="life-strategy-dot" aria-hidden="true" style={{ background: groupColor(made.id) }} />
                {groupName(made.id).replace('Group ', '')}
              </button>
            ))}
          </div>
        )}
        <p className={`life-activity${forager.alive ? '' : ' is-dead'}`} aria-live="polite">
          {describeActivity(pair, followed)}
        </p>
        <p>
          Water deficit: {forager.waterDeficitMl.toLocaleString()} ml (
          {((100 * forager.waterDeficitMl) / (config.bodyKg * 1000)).toFixed(2)}% of body mass) ·{' '}
          {forager.waterDeficitMl >= config.bodyKg * config.urgentThirstBodyPerMille
            ? 'Severely thirsty'
            : forager.thirsty
              ? 'Thirsty'
              : 'Hydrated'}
        </p>
        <p>
          Drunk today: {state.today.drinkingMlById[followed]!.toLocaleString()} ml · net loss today:{' '}
          {state.today.waterLossMlById[followed]!.toLocaleString()} ml
          {forager.deathCauses.length > 0 && ` · ${forager.deathCauses.join(' and ')}`}
        </p>
        {forager.alive && forager.route.length > 0 && (
          <p>
            {state.lastEvents.find((event) => event.foragerId === followed)?.reason === 'seeking water'
              ? 'Drinking destination'
              : 'Destination'}
            : {Math.round(forager.route.at(-1)!.x / 100)} m east, {Math.round(forager.route.at(-1)!.y / 100)} m south ·
            gold line shows the known dry route; blue dots mark remembered banks.
          </p>
        )}
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
            <span>
              {!forager.alive ? 'Dead' : forager.hungry ? 'Hungry' : 'Not hungry'}
              {foodLeft !== null && ` · about ${Math.round(foodLeft)} days of food left at its recent rate`}
            </span>
            <span className="num">
              hungry below {formatKcal(config.hungryBelowKcal)} · full at {formatKcal(config.satiatedAtKcal)}
            </span>
          </div>
        </div>
        <dl className="life-food">
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
          <dt>Has seen</dt>
          <dd className="num">
            {summary.seenShare === 1 ? 'the whole land' : `${Math.round(summary.seenShare * 100)}% of the land`}
          </dd>
          <dt>Knows</dt>
          <dd className="num">
            {summary.sitesKnown} of {summary.sitesTotal} thickets, stands and outcrops, {summary.sitesCheckedLately}{' '}
            checked in the last {config.exploreAfterHours} h
          </dd>
          <dt>Hut</dt>
          <dd className="num">
            {summary.hutLogs === null
              ? summary.groupId === null
                ? 'none: it builds once it has a group'
                : 'not begun'
              : `${summary.hutLogs} of ${config.hutLogs} logs${summary.hutWhole ? ', whole' : ''}`}
            {summary.log > 0 && ' · carrying a log'}
          </dd>
          <dt>Axe</dt>
          <dd className="num">
            {summary.axe ?? 'none'}
            {summary.spareAxe && ` · spare to sell: ${summary.spareAxe}`}
            {summary.making &&
              ` · making one ${summary.making.forSale ? 'to sell' : 'for itself'}, ${Math.round(summary.making.done * 100)}% done`}
            {summary.promised && !summary.making && ' · has promised one'}
            {summary.stone > 0 && ` · holds ${summary.stone} stone`}
          </dd>
          <dt>Craft</dt>
          <dd className="num">
            {summary.craft}% ({summary.makePercent}% practice from {summary.makeHours} h) · an axe costs it{' '}
            {formatKcal(summary.ask)}, expects quality {summary.expectedQuality}
          </dd>
          <dt>Axes</dt>
          <dd className="num">
            made {summary.madeOwn + summary.madeForSale} ({summary.madeForSale} to sell), sold {summary.sold}, bought{' '}
            {summary.bought}, worn out {summary.wornOut}
            {summary.heardAsk &&
              ` · heard ${summary.heardAsk.from} ${summary.heardAsk.ready ? 'sells' : 'will make'} one for ${formatKcal(summary.heardAsk.price)}`}
          </dd>
          <dt>Load</dt>
          <dd className="num">
            {summary.loadKg ? formatKg(summary.loadKg) : 'none'} · walks at {summary.speedKmh.toFixed(1)} km/h on the
            flat
          </dd>
          <dt>Ground</dt>
          <dd className="num">
            {summary.ground}, {summary.heightM.toFixed(1)} m above the datum
            {summary.walk &&
              ` · walking ${summary.walk.gradePercent > 0 ? 'up' : summary.walk.gradePercent < 0 ? 'down' : 'on'} a ${Math.abs(summary.walk.gradePercent)}% slope at ${summary.walk.speedKmh.toFixed(1)} km/h`}
            {` · climbed ${Math.round(summary.climbedTodayM)} m today`}
          </dd>
          <dt>Skills</dt>
          <dd className="num">
            born a {summary.foragingSkill}% forager · berries {formatKcal(summary.forageRate)}/h
            {formatChange(summary.forageRateChange)} · nuts {formatKcal(summary.nutRate)}/h · fish{' '}
            {formatKcal(summary.fishRate)}/h · {summary.woodRate} kg/h
            {formatChange(summary.woodRateChange)}
          </dd>
          <dt>Picking practice</dt>
          <dd className="num">
            {summary.foragePercent}% from {summary.forageHours} h in {config.practiceDays} days
          </dd>
          <dt>Wood practice</dt>
          <dd className="num">
            {summary.woodPercent}% from {summary.gatherHours} h in {config.practiceDays} days
          </dd>
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
          {summary.groupFire ? (
            <>
              <dt>Group’s fire</dt>
              <dd className="num">{fireLabel(summary.groupFire, isDaylight(config, Math.floor(minutes)))}</dd>
              <dt>Gave the fire</dt>
              <dd className="num">{formatKg(summary.fireGiven)} of wood</dd>
            </>
          ) : (
            fire && (
              <>
                <dt>A night’s fire</dt>
                <dd className="num">
                  {formatKg(fire.wood)} of wood saves {formatKcal(fire.kcal)}
                </dd>
              </>
            )
          )}
          <dt>Carries</dt>
          <dd className="num">
            {summary.carriedKcal ? carriedPhrase(summary.carriedByFood) : 'no food'}
            {summary.carriedKcal > 0 &&
              summary.spoilsInMinutes !== null &&
              `, the first spoils in ${formatMinutes(summary.spoilsInMinutes)}`}
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
              {selected!.kind === 'bush' || selected!.kind === 'hazel'
                ? `${plant.stock.toLocaleString('en-US')} of ${formatKcal(plant.capacity)} of ${selected!.kind === 'bush' ? 'berries' : 'nuts'}`
                : plant.treeState === 'standing'
                  ? `${plant.stock} of ${formatKg(plant.capacity)} of dead branches beneath it`
                  : `${formatKg(plant.stock)} of branches on the ground`}
            </dd>
            {plant.sticks !== null && (
              <>
                <dt>Sticks</dt>
                <dd className="num">
                  {plant.sticks} of {formatKg(plant.sticksCapacity)}
                </dd>
              </>
            )}
            <dt>{name} remembers</dt>
            <dd className="num">
              {plant.remembered === null
                ? 'nothing'
                : selected!.kind === 'tree'
                  ? formatKg(plant.remembered)
                  : formatKcal(plant.remembered)}
            </dd>
            <dt>Last seen</dt>
            <dd>{plant.seen}</dd>
            {plant.logs !== null && (
              <>
                <dt>Logs to cut</dt>
                <dd className="num">
                  {plant.logs} of {plant.logsCapacity}
                  {plant.treeState === 'standing'
                    ? ', standing'
                    : plant.logs > 0
                      ? ', lying where it fell'
                      : `, ${plant.treeState === 'stump' ? 'a stump' : 'all cut'}`}
                </dd>
                {plant.regrowsInDays !== null && (
                  <>
                    <dt>Grows back</dt>
                    <dd className="num">
                      {plant.logs > 0
                        ? 'once its logs are cut'
                        : `in ${plant.regrowsInDays} day${plant.regrowsInDays === 1 ? '' : 's'}`}
                    </dd>
                  </>
                )}
              </>
            )}
          </dl>
          <p className="life-note">
            {plant.remembered === null
              ? `${name} has never seen this ${selected!.kind}, so it does not know it is here.`
              : plant.difference === 0
                ? 'Its memory is up to date.'
                : `It knows only what it last saw, so it ${plant.difference > 0 ? 'underestimates' : 'overestimates'} this ${selected!.kind} by ${selected!.kind === 'tree' ? formatKg(Math.abs(plant.difference)) : formatKcal(Math.abs(plant.difference))}.`}
          </p>
        </section>
      )}

      {lake && (
        <section className="life-card life-inspector" aria-label={lake.name}>
          <header>
            <h2>{lake.name}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
          </header>
          <dl>
            <dt>Fish</dt>
            <dd className="num">
              {formatKcal(lake.stock)}, {Math.round((100 * lake.stock) / Math.max(1, lake.capacity))}% of a full lake
            </dd>
            <dt>{name} found</dt>
            <dd className="num">
              {lake.remembered === null
                ? lake.known
                  ? 'never fished here; expects it full'
                  : 'has not seen the lake'
                : `${Math.round((100 * lake.remembered) / Math.max(1, lake.capacity))}% of a full lake, ${lake.fished}`}
            </dd>
          </dl>
          <p className="life-note">
            {`A water body of ${lake.hectares} hectares. Water levels are fixed; drinking is recorded as an external withdrawal. Fish cannot be seen: a fisher learns the stock by what it catches. A full or empty lake gains no fish; a lake fished to half its stock gains most.`}
          </p>
        </section>
      )}

      {stone && (
        <section className="life-card life-inspector" aria-label={stone.name}>
          <header>
            <h2>{stone.name}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
          </header>
          <dl>
            <dt>Stones</dt>
            <dd className="num">
              {stone.stones} of {stone.capacity}
            </dd>
            <dt>{name} remembers</dt>
            <dd className="num">{stone.remembered === null ? 'nothing' : stone.remembered}</dd>
            <dt>Last seen</dt>
            <dd>{stone.seen}</dd>
          </dl>
          <p className="life-note">Each axe takes one stone. Stones never come back.</p>
        </section>
      )}

      {hut && (
        <section className="life-card life-inspector" aria-label={hut.name}>
          <header>
            <h2>{hut.name}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
          </header>
          <dl>
            <dt>Logs</dt>
            <dd className="num">
              {hut.logs} of {hut.capacity}
              {hut.whole ? ', whole' : ''}
              {hut.abandoned ? ', left behind' : ''}
            </dd>
            <dt>Weathers</dt>
            <dd className="num">
              {hut.weathersInDays === null
                ? 'nothing left to lose'
                : `loses a log in ${hut.weathersInDays} day${hut.weathersInDays === 1 ? '' : 's'}`}
            </dd>
          </dl>
          <p className="life-note">
            A whole hut keeps its builder a little warm at night when the fire is out; in its hut by the lit fire it
            sleeps warmest.
          </p>
        </section>
      )}

      {group && selected?.kind === 'group' && (
        <section className="life-card life-inspector valley-group-card" aria-label={group.name}>
          <header>
            <h2>
              <span className="life-strategy-dot" aria-hidden="true" style={{ background: group.color }} />
              {group.name}
            </h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
          </header>
          <dl>
            <dt>Founded</dt>
            <dd className="num">
              {group.foundedAgo ? `${formatMinutes(group.foundedAgo)} ago` : 'this minute'}, on day{' '}
              {Math.floor(group.founded / 1_440) + 1}
            </dd>
            {!group.dissolved && (
              <>
                <dt>Holds</dt>
                <dd className="num">
                  {formatKg(group.wood)} of wood, {formatKcal(group.foodKcal)} of food
                </dd>
                <dt>Swaps</dt>
                <dd className="num">{group.swapsLastDay} among its members in the last day</dd>
                {group.fire && (
                  <>
                    <dt>Its fire</dt>
                    <dd className="num">
                      {fireLabel(group.fire, isDaylight(config, Math.floor(minutes)))}; out {group.darkHours} of{' '}
                      {group.litHours + group.darkHours} night hours since it was founded
                    </dd>
                  </>
                )}
              </>
            )}
          </dl>
          {group.members.length > 0 && (
            <ul className="valley-members" aria-label="Members" style={{ ['--group-color' as string]: group.color }}>
              {group.members.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => follow(member.id)}
                    onPointerEnter={() => setHighlightedId(member.id)}
                    onPointerLeave={() => setHighlightedId(null)}
                    onFocus={() => setHighlightedId(member.id)}
                    onBlur={() => setHighlightedId(null)}
                    aria-label={`Follow ${member.name}`}
                  >
                    <span className="valley-member-name">
                      <span className="valley-pin-badge" aria-hidden="true">
                        {member.id + 1}
                      </span>
                      {member.name}
                      {member.loadKg > 0 && <span className="num"> · {formatKg(member.loadKg)}</span>}
                    </span>
                    <span className="valley-member-activity">{member.activity}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!group.dissolved && (
            <button type="button" onClick={() => showGroup(selected.id)}>
              Show group
            </button>
          )}
          {group.contributions.length > 0 && (
            <section className="valley-contributions" aria-label="What each member gives">
              <h3>What each member gives</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Into the fire</th>
                    <th scope="col">Gathered, warm</th>
                  </tr>
                </thead>
                <tbody>
                  {group.contributions.map((row) => (
                    <tr key={row.id} className={row.member ? undefined : 'is-gone'}>
                      <th scope="row">
                        <button
                          type="button"
                          className="valley-contribution-name"
                          disabled={!row.alive}
                          onClick={() => follow(row.id)}
                          onPointerEnter={() => setHighlightedId(row.id)}
                          onPointerLeave={() => setHighlightedId(null)}
                        >
                          {row.name}
                        </button>
                        {!row.alive ? ' · dead' : !row.member ? ' · left' : ''}
                        <span className="valley-contribution-sub num">
                          {row.woodBought || row.woodSold
                            ? `bought ${formatKg(row.woodBought)} for ${formatKcal(row.kcalPaid)} · sold ${formatKg(row.woodSold)} for ${formatKcal(row.kcalReceived)}`
                            : 'no swaps'}
                        </span>
                      </th>
                      <td>
                        <span className="num">
                          {formatKg(row.given)} · {Math.round(row.share * 100)}%
                        </span>
                        <span className="valley-share" aria-hidden="true">
                          <span style={{ width: `${row.share * 100}%`, background: group.color }} />
                        </span>
                        <span className="valley-contribution-sub num">{formatKg(row.givenToday)} today</span>
                      </td>
                      <td className="num">
                        {formatKg(row.gathered)}
                        <span className="valley-contribution-sub">{formatHours(Math.round(row.warmHours))} warm</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {group.contributionNote && <p className="life-note">{group.contributionNote}</p>}
            </section>
          )}
          {group.axes.length > 0 && (
            <section className="valley-contributions" aria-label="Axes">
              <h3>Axes and huts</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Axes made, sold, bought</th>
                    <th scope="col">Craft, hut</th>
                  </tr>
                </thead>
                <tbody>
                  {group.axes.map((row) => (
                    <tr key={row.id} className={row.member ? undefined : 'is-gone'}>
                      <th scope="row">
                        {row.name}
                        {!row.alive ? ' · dead' : !row.member ? ' · left' : ''}
                        <span className="valley-contribution-sub num">
                          {row.axeQuality === null ? 'no axe' : `axe of quality ${row.axeQuality}`}
                        </span>
                      </th>
                      <td className="num">
                        {row.madeOwn + row.madeForSale} · {row.sold} · {row.bought}
                        <span className="valley-contribution-sub">
                          {row.sold || row.bought
                            ? `got ${formatKcal(row.kcalReceived)}, paid ${formatKcal(row.kcalPaid)}`
                            : 'no sales'}
                        </span>
                      </td>
                      <td className="num">
                        {row.craft}%
                        <span className="valley-contribution-sub">
                          {row.hutLogs} of {config.hutLogs} logs
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="life-note">{group.axesNote}</p>
              <p className="life-note">
                Nobody gives food away, so food enters only as payment for wood in swaps. Warm is the time each has
                slept by a group’s fire while it burned.
              </p>
            </section>
          )}
          <p className="life-note">
            {group.dissolved
              ? 'The group dissolved when only one of its members was left alive, and its flag came down.'
              : `Its members sleep in their huts on a ring round its flag${group.fire ? ', all warmed by its one fire,' : ''} and swap only with each other. ${group.joinedEver} have joined it. A numbered pin marks each member; click one to follow it.`}
          </p>
        </section>
      )}

      <LandMap
        state={snapshot.pair.next}
        view={mapView}
        onPick={(x, y) => {
          followingRef.current = false
          setFollowing(false)
          sceneRef.current?.lookAt(x, y)
        }}
      />

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
              <TimeChart
                data={days}
                height={90}
                format={(value) => String(Math.round(value))}
                domain={[0, 'auto']}
                series={[
                  { key: 'axesMade', name: 'Axes made each day', color: palette.accent },
                  { key: 'axesSold', name: 'Axes sold each day', color: palette.positive },
                  { key: 'hutsWhole', name: 'Huts whole', color: palette.firmA, dashed: true },
                ]}
              />
              <TimeChart
                data={days}
                height={110}
                format={(value) => (value >= 1_000 ? `${Math.round(value / 1000)}k` : String(Math.round(value)))}
                series={[
                  { key: 'reserve', name: `${name}’s reserve at day’s end`, color: palette.accent },
                  { key: 'stock', name: 'Berries per bush, kcal', color: palette.positive, dashed: true },
                ]}
              />
              <TimeChart
                data={days}
                height={100}
                format={(value) => (value >= 1_000 ? `${Math.round(value / 1000)}k` : String(Math.round(value)))}
                domain={[0, 'auto']}
                series={[
                  { key: 'nutsTaken', name: 'Nuts taken each day, kcal', color: palette.accent },
                  { key: 'berriesTaken', name: 'Berries taken each day, kcal', color: palette.positive },
                  { key: 'fishTaken', name: 'Fish taken each day, kcal', color: palette.household, dashed: true },
                ]}
              />
              <TimeChart
                data={days}
                height={90}
                format={(value) => `${Math.round(value)}%`}
                domain={[0, 100]}
                series={[
                  { key: 'hazelPercent', name: 'Nuts on the hazels, % of full', color: palette.accent },
                  {
                    key: 'fishPercent',
                    name: 'Fish in inland water, % of full',
                    color: palette.household,
                    dashed: true,
                  },
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
            Running seed {setup.seed}: {setup.bandSize} foragers on a stretch of glacial land{' '}
            {config.valleySizeCm / 100} m across, with broken moraine fronts, flow-aligned drumlins, clustered hummocks,
            irregular hollows, lakes and connected river reaches,{' '}
            {setup.scattered ? 'who start scattered' : 'who start as one group around the meadow in the middle'},
            knowing only what they have seen. By day they see {setup.sightRadiusCm / 100} m, but not through hills, and
            berries and firewood up close. The whole land is grassland, with grass, exposed dirt and stone; slopes slow
            them and cost them energy, and stone is harder going. When their needs are met they explore ground they have
            never seen, then check the thickets and stands they have not checked for{' '}
            {formatHours(setup.exploreAfterHours)}. A load costs them energy and slows them a little, and they take a
            full load home before anything else. Those without a group look for company: two who meet found a group and
            plant its flag, and anyone who meets a member joins. Members sleep on a ring round their flag and swap wood
            for food only with each other, telling each other their terms.{' '}
            {`Each group keeps one fire at its flag, burning ${formatKg(setup.campfireWoodPerHour)} an hour at night and warming every member. Every member wants a hut of ${config.hutLogs} logs on the ring round the fire, cut from trees it fells with an axe it makes from a stone and wood${setup.axeTrade ? ' or buys from another member for food' : ''}; skill at making axes ${setup.craftPractice ? 'grows with practice' : 'stays fixed'}. A hut keeps its sleeper a little warm, the fire more, and both together most.`}{' '}
            They are born with skills{' '}
            {setup.skillMinPercent === setup.skillMaxPercent
              ? `of ${setup.skillMinPercent}%`
              : `from ${setup.skillMinPercent}% to ${setup.skillMaxPercent}%`}
            , which grow with practice over {setup.practiceDays} days from {setup.practiceMinPercent}% towards{' '}
            {setup.practiceMaxPercent}%. They pick berries bush by bush, gather hazelnuts and fish discovered water at
            discovered banks, taking less an hour as a source thins, and go where an hour brings most food for the walk.
            They gather sticks from bushes and dead branches from under trees, bringing them home in loads of{' '}
            {formatKg(setup.woodLoad)}. Each is coloured by what wood costs it, from{' '}
            <span style={{ color: TERMS_COLORS.gatherer }}>relatively good at gathering wood</span> to{' '}
            <span style={{ color: TERMS_COLORS.forager }}>relatively good at picking</span>, and wears a sash in its
            group’s colour; each group’s base has a fire, a flag, coloured ground and a lettered badge. Ground the
            followed person has never seen is darkest, and a ring marks each thicket and stand it knows, bright if it
            checked it lately. Drag to pan, scroll or pinch to zoom, right-drag or Q and E to turn; click a person to
            follow them, a bush, hazel, tree or the lake to inspect it, and a flag, badge or group to see the group.
          </p>
          <p className="life-note">
            Measurements, derived quantities and explicit estimates are distinguished in the{' '}
            <a href="https://github.com/NeoLorenzo/Econ-Engine/blob/main/docs/CALIBRATION.md">calibration document</a>{' '}
            with the source and trust of each choice.
          </p>
        </details>
      </section>
    </div>
  )
}

/** Carried food by kind, as a phrase: "1,200 kcal of nuts and 300 of fish". */
function carriedPhrase(food: { berries: number; nuts: number; fish: number }) {
  const parts = (['nuts', 'berries', 'fish'] as const).filter((kind) => food[kind] > 0)
  return parts
    .map((kind, index) => `${index === 0 ? formatKcal(food[kind]) : food[kind].toLocaleString('en-US')} of ${kind}`)
    .join(' and ')
}

function stringify(setup: Setup) {
  return Object.fromEntries(SETUP_FIELDS.map(({ key, unit = 1 }) => [key, String(setup[key] / unit)])) as Record<
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
