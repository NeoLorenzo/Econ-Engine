import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { SimulationState } from '../../sim/types'
import { bps, firmName, householdName, money } from '../format'
import { focusForSelection, selectedEntityKind, type WorldFocus } from '../shell/navigation'
import type { ViewInset } from './cameraMath'
import { Inspector } from './Inspector'
import { MapTools } from './MapTools'
import {
  createRuntime,
  disposeRuntime,
  flyTo,
  resetCamera,
  selectedEmployment,
  selectedHouseholdChoice,
  selectedTransfers,
  syncEntities,
  syncGround,
  syncLinks,
  syncTerritory,
  setViewInset,
  type Runtime,
} from './scene'

export type WorldStatus = 'loading' | 'ready' | 'error'

/** The inspector's column on wide screens: `.inspector { left: 12px; width: 320px }` plus a 12px gap. */
const INSPECTOR_COLUMN = 344

/**
 * Screen space the top bar and HUD cover at the top, the inspector at the left and the map tools at the bottom,
 * so Locate can land clear of them. Locate always selects, so on wide screens the inspector is about to be
 * showing. On narrow screens the inspector is hidden while a panel is open, and the bottom sheet covers the tools.
 */
function coveredByChrome() {
  const style = getComputedStyle(document.documentElement)
  const px = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0
  const narrow = window.matchMedia('(max-width: 860px)').matches
  const panelOpen = document.querySelector('.panel') !== null
  return {
    top: px('--topbar-h') + px('--hud-h') + 24,
    left: narrow ? 0 : INSPECTOR_COLUMN,
    bottom: narrow && panelOpen ? 0 : px('--tools-h') + 12,
  }
}

/** What the rest of the app may ask of the world. `locate` returns whether the camera could move. */
export interface WorldController {
  locate(id: string): boolean
  resetCamera(): void
}

/** The full-viewport 3D world. It is mounted once and stays mounted while panels open and close over it. */
export function WorldStage({
  state,
  focus,
  onFocus,
  inset,
  paused,
  controllerRef,
  onStatus,
}: {
  state: SimulationState
  focus: WorldFocus
  onFocus: (next: WorldFocus) => void
  inset: ViewInset
  paused: boolean
  controllerRef: RefObject<WorldController | null>
  onStatus: (status: WorldStatus) => void
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<Runtime | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [status, setStatus] = useState<WorldStatus>('loading')
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')
  // Nothing is synced or drawn while the world is covered (Experiments) or the browser tab is hidden.
  const asleep = paused || hidden
  const { selectedId, industry, linkMode, measure } = focus

  const select = (id: string | null) => onFocus(focusForSelection(state, focus, id))
  const selectRef = useRef(select)
  const onStatusRef = useRef(onStatus)
  // The Three.js runtime's event handlers read the latest props through these refs.
  useLayoutEffect(() => {
    selectRef.current = select
    onStatusRef.current = onStatus
  })

  useImperativeHandle(
    controllerRef,
    () => ({
      locate: (id) => {
        selectRef.current(id)
        const runtime = runtimeRef.current
        if (!runtime) return false
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        return flyTo(runtime, id, reducedMotion, coveredByChrome())
      },
      resetCamera: () => {
        if (runtimeRef.current) resetCamera(runtimeRef.current)
      },
    }),
    [],
  )

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // These also run when `status` becomes 'ready', to configure the runtime that has just been built.
  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.paused = asleep
    runtime.dirty = true
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [asleep, status])

  useEffect(() => {
    if (runtimeRef.current) setViewInset(runtimeRef.current, inset)
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [inset, status])

  // A selection can outlive its entity, for example after Apply settings shrinks the population.
  useEffect(() => {
    if (selectedId && !selectedEntityKind(state, selectedId)) onFocus({ ...focus, selectedId: null })
  }, [state, selectedId, focus, onFocus])

  const related = useMemo(() => {
    const ids = new Set<string>()
    const recipients = selectedTransfers(state, selectedId)
    if (recipients) recipients.forEach((id) => ids.add(id))
    else if (linkMode === 'purchases') {
      const choice = selectedHouseholdChoice(state, selectedId, industry)
      if (choice?.chosenFirmId) ids.add(choice.chosenFirmId)
    } else {
      const employment = selectedEmployment(state, selectedId)
      if (employment) [employment.firmId, ...employment.workerIds].forEach((id) => ids.add(id))
    }
    if (selectedId) ids.delete(selectedId)
    return ids
  }, [state, selectedId, industry, linkMode])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let cancelled = false
    createRuntime(mount, {
      onSelect: (id) => selectRef.current(id),
      onHover: (id, x, y) => {
        setHoverId(id)
        const tooltip = tooltipRef.current
        if (tooltip) tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`
      },
    }).then(
      (runtime) => {
        if (cancelled) return disposeRuntime(runtime)
        runtimeRef.current = runtime
        setStatus('ready')
        onStatusRef.current('ready')
      },
      (error) => {
        console.error('Unable to initialize the Three.js world view', error)
        if (cancelled) return
        setStatus('error')
        onStatusRef.current('error')
      },
    )
    return () => {
      cancelled = true
      if (runtimeRef.current) disposeRuntime(runtimeRef.current)
      runtimeRef.current = null
    }
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime || asleep) return
    syncGround(runtime, state)
    syncTerritory(runtime, state, industry)
    const current = { selectedId, industry, linkMode, measure }
    syncEntities(runtime, state, current, related)
    syncLinks(runtime, state, current)
    runtime.dirty = true
    // `status` is not read here, but its change to 'ready' must re-sync the scene the runtime has just built.
    // Waking from `asleep` re-syncs to the latest state.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [state, selectedId, industry, linkMode, measure, related, status, asleep])

  const hovered = hoverId && hoverId !== selectedId ? hoverId : null
  const hoveredHousehold = hovered ? state.households.find(({ id }) => id === hovered) : null
  const hoveredFirm = hovered ? state.firms.find(({ id }) => id === hovered) : null
  const hoveredGovernment = hovered === state.government.id ? state.government : null

  return (
    <div className="stage" data-status={status}>
      <div ref={mountRef} className="stage-canvas" />
      {status === 'loading' && <div className="world-status">Loading the 3D world…</div>}
      {status === 'error' && (
        <div className="world-status world-status--error">
          The 3D world couldn't load (it needs WebGL). Everything else still works.
        </div>
      )}
      <div ref={tooltipRef} className={`world-tooltip${hovered ? ' is-visible' : ''}`} aria-hidden="true">
        {hoveredHousehold && (
          <>
            <strong>{householdName(hoveredHousehold.id)}</strong>
            <span>
              {money(hoveredHousehold.preTaxCashCents)} before tax → {money(hoveredHousehold.postFiscalCashCents)} after
            </span>
            <span>Works at {firmName(hoveredHousehold.employerFirmId)}</span>
          </>
        )}
        {hoveredFirm && (
          <>
            <strong>{firmName(hoveredFirm.id)}</strong>
            <span>
              {hoveredFirm.industryId === 'transport'
                ? `${hoveredFirm.employeeIds.length} workers`
                : `${money(hoveredFirm.postedPriceCents)} tomorrow · ${hoveredFirm.employeeIds.length} workers`}
            </span>
          </>
        )}
        {hoveredGovernment && (
          <>
            <strong>Government</strong>
            <span>
              {bps(hoveredGovernment.appliedWealthTaxRateBps)} wealth tax ·{' '}
              {money(hoveredGovernment.redistributedTodayCents)} paid out today
            </span>
          </>
        )}
      </div>
      <MapTools
        state={state}
        focus={focus}
        onFocus={onFocus}
        onSelect={select}
        onResetCamera={() => runtimeRef.current && resetCamera(runtimeRef.current)}
        ready={status === 'ready'}
      />
      <Inspector
        state={state}
        focus={focus}
        onSelect={select}
        onIndustry={(next) => onFocus({ ...focus, industry: next })}
      />
    </div>
  )
}
