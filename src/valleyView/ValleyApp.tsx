import { TRAITS } from '../valley/nature'
import { LandMap } from './LandMap'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SpecializationChart } from './SpecializationChart'
import { TimeChart } from '../ui/charts'
import { Icon } from '../ui/components'
import { palette } from '../ui/theme'
import { isDaylight } from '../valley/forager'
import type { ValleyState } from '../valley/types'
import { createValleyScene, type ValleyPick, type ValleyScene, type ValleySelection } from './valleyScene'
import type { EngineLink } from './engineLink'
import {
  advancePlayback,
  changeSpeed,
  aliveCount,
  clearView,
  calendarLabel,
  clockLabel,
  daySeries,
  daysOfFoodLeft,
  DEFAULT_SPEED_INDEX,
  describeActivity,
  displayedEnergy,
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
  skillLevels,
  stoneInspection,
  specializationPoints,
  thirstLevel,
  receiveState,
  startDisplay,
  startPlayback,
  stepFollowed,
  stepPlayback,
  strideOf,
  taskSummary,
  TERMS_COLORS,
  VALLEY_SPEEDS,
  type ClearView,
  type Display,
  type Playback,
} from './valleyViewModel'

/** What the HUD shows, refreshed a few times a second rather than every frame. */
interface Snapshot {
  pair: Display
  /** Simulated minutes per wall-clock second, measured over the last second. */
  minutesPerSecond: number
  followed: number
  energyKcal: number
  minutes: number
}

const HUD_INTERVAL_MS = 100
/** At map speeds no one walks on screen, and refreshing the panels had taken a quarter of the page's time. */
const MAP_HUD_INTERVAL_MS = 500

const formatChange = (change: number) =>
  change ? ` (${change > 0 ? '+' : '−'}${Math.abs(change).toLocaleString('en-US')})` : ''

const formatKg = (kg: number) => `${kg.toLocaleString('en-US')} kg`

/** `value` as a CSS share of `max`, kept within the bar. */
const share = (value: number, max: number) => `${Math.min(100, Math.max(0, (value / max) * 100))}%`

const RING_RADIUS = 18
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/** A forager's skills as rings: each fills towards the most any forager could reach, with today's percent inside. */
function SkillRings({ skills }: { skills: ReturnType<typeof skillLevels> }) {
  return (
    <div className="life-skills" role="group" aria-label="Skills">
      {skills.map((skill) => (
        <figure key={skill.key} className={`life-skill is-${skill.key}`}>
          <svg viewBox="0 0 44 44" role="img" aria-label={`${skill.label} ${skill.percent}%`}>
            <circle className="life-skill-track" cx="22" cy="22" r={RING_RADIUS} />
            <circle
              className="life-skill-fill"
              cx="22"
              cy="22"
              r={RING_RADIUS}
              strokeDasharray={`${(Math.min(1, skill.percent / skill.max) * RING_LENGTH).toFixed(1)} ${RING_LENGTH.toFixed(1)}`}
              transform="rotate(-90 22 22)"
            />
            <text x="22" y="26" textAnchor="middle" className="num">
              {skill.percent}
            </text>
          </svg>
          <figcaption>{skill.label}</figcaption>
        </figure>
      ))}
    </div>
  )
}

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

/**
 * Plays the run that `engine` runs; its settings are fixed, and `onNewRun` leaves it for the settings screen.
 * `onReady` is called once the valley's first frame is drawn, or the 3D view has failed to start.
 */
export default function ValleyApp({
  engine,
  onNewRun,
  onReady,
}: {
  engine: EngineLink
  onNewRun: () => void
  onReady: () => void
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<ValleyScene | null>(null)
  const [initialPair] = useState(() => startDisplay(engine.first))
  const pairRef = useRef<Display>(initialPair)
  const playbackRef = useRef<Playback>(startPlayback(engine.first))
  const [running, setRunning] = useState(true)
  const [showFlow, setShowFlow] = useState(false)
  const flowRef = useRef(false)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const [selected, setSelected] = useState<ValleySelection | null>(null)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [followedId, setFollowedId] = useState(0)
  const [following, setFollowing] = useState(true)
  const [mapView, setMapView] = useState<ReturnType<ValleyScene['view']> | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snap(initialPair, 0))
  const [sceneError, setSceneError] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(() => window.matchMedia?.('(min-width: 721px)').matches ?? true)
  const aboutRef = useRef<HTMLDialogElement | null>(null)
  const readyRef = useRef(onReady)
  const engineRef = useRef(engine)
  useEffect(() => {
    readyRef.current = onReady
  }, [onReady])

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
    if (speedRef.current !== VALLEY_SPEEDS[speedIndex]) playbackRef.current = changeSpeed(playbackRef.current)
    speedRef.current = VALLEY_SPEEDS[speedIndex]!
    selectedRef.current = selected
    highlightedRef.current = highlightedId
    followedRef.current = followedId
    followingRef.current = following
  }, [running, speedIndex, selected, highlightedId, followedId, following, showFlow])

  useEffect(() => {
    return engine.listen((state) => {
      playbackRef.current = receiveState(playbackRef.current, state)
    })
  }, [engine])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let frame = 0
    let lastFrame = performance.now()
    let lastHud = 0
    let rate = { atMs: performance.now(), minute: pairRef.current.minute, perSecond: 0 }
    let asked = { goal: -1, stride: 0, followedId: -1 }
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
        scene.setWorld(pairRef.current.state)
        let drawn = false
        const loop = (now: number) => {
          const elapsed = (now - lastFrame) / 1000
          lastFrame = now
          const speed = speedRef.current
          const advanced = advancePlayback(playbackRef.current, elapsed, speed, runningRef.current)
          playbackRef.current = advanced.playback
          pairRef.current = advanced.display
          const goal = advanced.playback.goal,
            stride = strideOf(speed),
            followed = followedRef.current
          if (goal !== asked.goal || stride !== asked.stride || followed !== asked.followedId) {
            asked = { goal, stride, followedId: followed }
            engineRef.current.ask(goal, stride, followed)
          }
          scene.draw(pairRef.current, {
            showFlow: flowRef.current,
            drawPeople: !speed.map,
            selected: selectedRef.current,
            highlightedId: highlightedRef.current,
            clear: clearRef.current,
            followedId: followedRef.current,
            following: followingRef.current,
            elapsedSeconds: elapsed,
          })
          if (!drawn) {
            drawn = true
            // The loading card stays until the engine's thread has built its valley too.
            void engineRef.current.ready.then(() => readyRef.current())
          }
          if (now - lastHud >= (speed.map ? MAP_HUD_INTERVAL_MS : HUD_INTERVAL_MS)) {
            lastHud = now
            clearRef.current = measureClear(mount)
            if (now - rate.atMs >= 1_000)
              rate = {
                atMs: now,
                minute: pairRef.current.minute,
                perSecond: ((pairRef.current.minute - rate.minute) * 1_000) / (now - rate.atMs),
              }
            setSnapshot(snap(pairRef.current, followedRef.current, rate.perSecond))
            setMapView(scene.view())
          }
          frame = requestAnimationFrame(loop)
        }
        frame = requestAnimationFrame(loop)
      })
      .catch(() => {
        setSceneError(true)
        readyRef.current()
      })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  const follow = useCallback((id: number) => {
    followedRef.current = id
    followingRef.current = true
    setFollowedId(id)
    setFollowing(true)
    setSnapshot(snap(pairRef.current, id))
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

  /** Finishes the minute in progress, then shows the next one from its start once the engine has run it. */
  const stepMinute = useCallback(() => {
    playbackRef.current = stepPlayback(playbackRef.current)
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

  const { pair, energyKcal, minutes, followed } = snapshot
  const state = pair.state
  const task = taskSummary(state, followed)
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
  const percent = (value: number) => `${(value / config.reserveMaxKcal) * 100}%`
  const foodLeft = daysOfFoodLeft(state, followed)
  const thirst = thirstLevel(state, followed)
  /** The load bar is full at the heavier of a load of wood and a log. */
  const fullLoadKg = Math.max(forager.loadCapacityKg, config.logKg)

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
        <span className="life-title">Life 15</span>
        <div className="life-status num">
          <span title={`${Math.round(snapshot.minutesPerSecond).toLocaleString('en-US')} min / s`}>
            {calendarLabel(config, minutes)} · {clockLabel(minutes / 60).split(' · ')[1]}
          </span>
          <span>
            {aliveCount(state)} of {config.founders} alive
          </span>
        </div>
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
          <button type="button" onClick={onNewRun}>
            New run
          </button>
        </div>
      </header>

      <section className="life-card life-hud" aria-label={`The band, following ${name}`}>
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
          {forager.deathCauses.length > 0 && <span className="life-cause">{forager.deathCauses.join(' and ')}</span>}
        </p>
        <div className="life-needs">
          <div className="life-energy">
            <div className="life-energy-head">
              <span>Energy</span>
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
              <div
                className="life-energy-mark"
                style={{ left: percent(config.hungryBelowKcal) }}
                title="Hungry below"
              />
              <div className="life-energy-mark" style={{ left: percent(forager.satiationKcal) }} title="Satiated at" />
            </div>
            <div className="life-energy-legend">
              <span>
                {!forager.alive ? 'Dead' : forager.hungry ? 'Hungry' : 'Not hungry'}
                {foodLeft !== null && ` · about ${Math.round(foodLeft)} days of food left`}
              </span>
            </div>
          </div>
          <div className="life-energy">
            <div className="life-energy-head">
              <span>Thirst</span>
              <span className="num">{thirst.label}</span>
            </div>
            <div
              className="life-energy-bar"
              role="meter"
              aria-label="Thirst"
              aria-valuemin={0}
              aria-valuemax={thirst.maxMl}
              aria-valuenow={thirst.ml}
              title={`${thirst.ml.toLocaleString('en-US')} ml short of water`}
            >
              <div
                className={`life-energy-fill life-thirst-fill is-${thirst.level}`}
                style={{ width: share(thirst.ml, thirst.maxMl) }}
              />
              <div
                className="life-energy-mark"
                style={{ left: share(thirst.thirstyMl, thirst.maxMl) }}
                title="Thirsty"
              />
              <div
                className="life-energy-mark"
                style={{ left: share(thirst.urgentMl, thirst.maxMl) }}
                title="Severely thirsty"
              />
            </div>
          </div>
          <div className="life-energy">
            <div className="life-energy-head">
              <span>Load</span>
              <span className="num">{summary.loadKg ? formatKg(Math.round(summary.loadKg * 10) / 10) : 'nothing'}</span>
            </div>
            <div
              className="life-energy-bar"
              role="meter"
              aria-label="Load carried"
              aria-valuemin={0}
              aria-valuemax={fullLoadKg}
              aria-valuenow={summary.loadKg}
              title={`Walks at ${summary.speedKmh.toFixed(1)} km/h on the flat`}
            >
              <div className="life-energy-fill life-load-fill" style={{ width: share(summary.loadKg, fullLoadKg) }} />
            </div>
          </div>
        </div>
        <p className="life-body">
          {forager.sex === 0 ? 'Woman' : 'Man'} · {forager.heightCm} cm · {forager.weightKg} kg · grip {forager.gripKg}{' '}
          kg · carries {forager.loadCapacityKg} kg
        </p>
        <div className="life-traits">
          {TRAITS.map((key) => {
            const score = forager.traits[key]
            const word =
              score < -1500
                ? 'very low'
                : score < -500
                  ? 'low'
                  : score <= 500
                    ? 'average'
                    : score <= 1500
                      ? 'high'
                      : 'very high'
            return (
              <div className="life-trait" key={key}>
                <span>{key}</span>
                <meter
                  min={-3000}
                  max={3000}
                  value={score}
                  aria-label={key}
                  title={`${(score / 1000).toFixed(2)} spreads`}
                />
                <span>{word}</span>
              </div>
            )
          })}
        </div>
        <details className="life-details">
          <summary>Recent exchanges</summary>
          <ul>
            {state.eventDays
              .flat()
              .filter(
                (event) => event.kind === 'exchange' && (event.sellerId === followed || event.buyerId === followed),
              )
              .slice(-5)
              .map(
                (event, index) =>
                  event.kind === 'exchange' && (
                    <li key={index}>
                      {event.wood} kg for {event.kcal} kcal · {event.kcalPerWood} kcal/kg ·{' '}
                      {event.sellerSharePerMille === 500
                        ? 'equal shares'
                        : event.sellerSharePerMille > 500
                          ? 'seller took the larger share'
                          : 'buyer took the larger share'}
                    </li>
                  ),
              )}
          </ul>
        </details>
        <SkillRings skills={skillLevels(state, followed)} />
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
        <details className="life-details">
          <summary>Details</summary>
          <dl className="life-food">
            <dt>Group</dt>
            <dd>
              {summary.groupId === null ? (
                'none yet'
              ) : (
                <>
                  <span
                    className="life-strategy-dot"
                    aria-hidden="true"
                    style={{ background: groupColor(summary.groupId) }}
                  />
                  {groupName(summary.groupId)}
                  {summary.fellows.length > 0 && ` with ${summary.fellows.length} others`}
                </>
              )}
            </dd>
            {forager.alive && task && (
              <>
                <dt>Task</dt>
                <dd>
                  {task.kind}, {task.reason}
                  {task.way && `, ${task.way}`}
                </dd>
              </>
            )}
            <dt>Has seen</dt>
            <dd className="num">
              {Math.round(summary.seenShare * 100)}% of the land, {summary.sitesKnown} sites
            </dd>
            <dt>Ways</dt>
            <dd className="num">Knows {forager.ways.length}</dd>
            <dt>Carries</dt>
            <dd className="num">
              {summary.carriedKcal ? carriedPhrase(summary.carriedByFood) : 'no food'}
              {summary.log > 0 && ', a log'}
              {summary.stone > 0 && `, ${summary.stone} stone`}
            </dd>
            <dt>Wood</dt>
            <dd className="num">
              {formatKg(summary.wood)} of {formatKg(summary.woodTarget)} wanted
            </dd>
            <dt>Hut</dt>
            <dd className="num">
              {summary.hutLogs === null
                ? 'none'
                : `${summary.hutLogs} of ${config.hutLogs} logs${summary.hutWhole ? ', whole' : ''}`}
            </dd>
            <dt>Axe</dt>
            <dd className="num">
              {summary.axe ?? 'none'}
              {summary.making && `, making one (${Math.round(summary.making.done * 100)}%)`}
            </dd>
            {summary.groupFire ? (
              <>
                <dt>Fire</dt>
                <dd className="num">{fireLabel(summary.groupFire, isDaylight(config, Math.floor(minutes)))}</dd>
              </>
            ) : (
              fire && (
                <>
                  <dt>A night’s fire</dt>
                  <dd className="num">
                    {formatKg(fire.wood)} saves {formatKcal(fire.kcal)}
                  </dd>
                </>
              )
            )}
            <dt>Per hour</dt>
            <dd className="num">
              berries {formatKcal(summary.forageRate)}
              {formatChange(summary.forageRateChange)}, wood {summary.woodRate} kg
              {formatChange(summary.woodRateChange)}
            </dd>
            <dt>Wood costs it</dt>
            <dd className="num">{Math.round(summary.ownTerms)} kcal a kg</dd>
            <dt>Traded</dt>
            <dd className="num">
              wood {formatKg(summary.woodSold)} sold, {formatKg(summary.woodBought)} bought · axes {summary.sold} sold,{' '}
              {summary.bought} bought
            </dd>
            <dt>Water today</dt>
            <dd className="num">{state.today.drinkingMlById[followed]!.toLocaleString('en-US')} ml drunk</dd>
          </dl>
        </details>
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
        state={snapshot.pair.state}
        view={mapView}
        onPick={(x, y) => {
          followingRef.current = false
          setFollowing(false)
          sceneRef.current?.lookAt(x, y)
        }}
      />

      <section className="life-card life-history" aria-label="History">
        <details open={historyOpen} onToggle={(toggle) => setHistoryOpen(toggle.currentTarget.open)}>
          <summary>
            History
            <button
              type="button"
              className="icon-button life-info"
              aria-label="About this run"
              title="About this run"
              onClick={(click) => {
                click.preventDefault()
                aboutRef.current?.showModal()
              }}
            >
              i
            </button>
          </summary>
          <SpecializationChart points={specializationPoints(state)} config={config} followed={followed} woodUnit="kg" />
          <HistoryCharts state={state} followed={followed} name={name} />
        </details>
      </section>

      <dialog
        className="life-about"
        ref={aboutRef}
        aria-label="About this run"
        onClick={(click) => click.target === click.currentTarget && click.currentTarget.close()}
      >
        <header>
          <h2>About this run</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={() => aboutRef.current?.close()}>
            ×
          </button>
        </header>
        <dl className="life-food">
          <dt>Seed</dt>
          <dd className="num">{config.seed}</dd>
          <dt>Founders</dt>
          <dd className="num">
            {config.founders}, starting {config.scattered ? 'scattered' : 'together'}
          </dd>
          <dt>World</dt>
          <dd className="num">{config.valleySizeCm / 100_000} km across</dd>
          <dt>Year</dt>
          <dd className="num">{config.daysPerYear} days</dd>
        </dl>
        <p className="life-note">
          Drag to pan, scroll or pinch to zoom, right-drag or Q and E to turn. Click a person to follow them, a plant,
          lake or stone to inspect it, and a flag to see its group.
        </p>
        <p className="life-note">
          Each person is coloured from <span style={{ color: TERMS_COLORS.gatherer }}>good at gathering wood</span> to{' '}
          <span style={{ color: TERMS_COLORS.forager }}>good at picking</span>. Ground the followed person has never
          seen is darkest.
        </p>
        <p className="life-note">
          Sources for every number are in the{' '}
          <a href="https://github.com/NeoLorenzo/Econ-Engine/blob/main/docs/CALIBRATION.md">calibration document</a>.
        </p>
      </dialog>
    </div>
  )
}

/**
 * The run's history charts. They show finished days only, so they are drawn again only when a day ends, the followed
 * forager changes or a new run starts, not at every refresh of the panels.
 */
const HistoryCharts = memo(
  function HistoryCharts({ state, followed, name }: { state: ValleyState; followed: number; name: string }) {
    const days = daySeries(state, followed)
    if (days.length <= 1) return null
    return (
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
    )
  },
  (before, after) =>
    before.followed === after.followed &&
    before.name === after.name &&
    before.state.layout === after.state.layout &&
    before.state.days.length === after.state.days.length,
)

/** Carried food by kind, as a phrase: "1,200 kcal of nuts and 300 of fish". */
function carriedPhrase(food: { berries: number; nuts: number; fish: number }) {
  const parts = (['nuts', 'berries', 'fish'] as const).filter((kind) => food[kind] > 0)
  return parts
    .map((kind, index) => `${index === 0 ? formatKcal(food[kind]) : food[kind].toLocaleString('en-US')} of ${kind}`)
    .join(' and ')
}

function snap(pair: Display, followed: number, minutesPerSecond = 0): Snapshot {
  return {
    pair,
    followed,
    minutesPerSecond,
    energyKcal: displayedEnergy(pair, followed),
    minutes: pair.minute,
  }
}
