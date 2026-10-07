import { useEffect, useMemo, useRef, useState } from 'react'
import type { SimulationState } from '../sim/types'
import { Icon, InfoTip, Segmented } from './components'
import { CONSUMER_INDUSTRIES, householdCashSteps } from './economyModel'
import { entityName, firmName, firmShortName, firmVariant, householdName, INDUSTRY_NAMES, money } from './format'
import { hex, palette } from './theme'
import { buildMarketTerritory, buildWorldEntities, getEmploymentNetworkObservation, getHouseholdChoiceObservation, type CashMeasure, type CompetitiveIndustryId, type EmploymentNetworkObservation, type HouseholdChoiceObservation } from './worldViewModel'

const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm'

type LinkMode = 'purchases' | 'jobs'

// A narrow field of view keeps perspective from exaggerating near pillars, so height reads as cash.
const FIELD_OF_VIEW = 26
const MIN_RADIUS = 14
const MAX_RADIUS = 95

const COLORS = {
  background: hex(palette.bg),
  ground: 0x0f1412,
  gridMajor: 0x2a332f,
  gridMinor: 0x1a201d,
  household: hex(palette.household),
  firmA: hex(palette.firmA),
  firmB: hex(palette.firmB),
  idleFirm: 0x46514c,
  transport: hex(palette.government),
  selected: hex(palette.accent),
  jobs: hex(palette.positive),
}

const variantColor = (variant: 'a' | 'b') => variant === 'a' ? COLORS.firmA : COLORS.firmB

type Runtime = {
  THREE: any
  scene: any
  camera: any
  renderer: any
  entities: Map<string, any>
  territoryMeshes: any[]
  territoryKey: string | null
  links: any[]
  linksKey: string | null
  ground: any | null
  grid: any | null
  gridWidth: number
  gridHeight: number
  frame: number | null
  /** Set whenever the scene changes; the render loop only draws dirty frames. */
  dirty: boolean
  resizeObserver: ResizeObserver
  disposeControls: () => void
  controls: { target: any; radius: number; theta: number; phi: number }
}

interface SceneView {
  selectedId: string | null
  industry: CompetitiveIndustryId
  linkMode: LinkMode
  measure: CashMeasure
}

function disposeObject(object: any) {
  object.geometry?.dispose?.()
  if (Array.isArray(object.material)) object.material.forEach((material: any) => material.dispose?.())
  else object.material?.dispose?.()
}

function applyCamera(runtime: Runtime) {
  const { camera, controls } = runtime
  const sinPhi = Math.sin(controls.phi)
  camera.position.set(
    controls.target.x + controls.radius * sinPhi * Math.sin(controls.theta),
    controls.target.y + controls.radius * Math.cos(controls.phi),
    controls.target.z + controls.radius * sinPhi * Math.cos(controls.theta),
  )
  camera.lookAt(controls.target)
  runtime.dirty = true
}

function resetCamera(runtime: Runtime) {
  runtime.controls.target.set(0, 0, 0)
  runtime.controls.radius = 46
  runtime.controls.theta = Math.PI / 4
  runtime.controls.phi = 0.88
  applyCamera(runtime)
}

function syncGround(runtime: Runtime, state: SimulationState) {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  if (runtime.gridWidth === width && runtime.gridHeight === height) return
  for (const object of [runtime.ground, runtime.grid]) {
    if (!object) continue
    runtime.scene.remove(object)
    disposeObject(object)
  }
  const THREE = runtime.THREE
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1, metalness: 0 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  ground.receiveShadow = true
  runtime.scene.add(ground)
  const grid = new THREE.GridHelper(Math.max(width, height), Math.max(width, height), COLORS.gridMajor, COLORS.gridMinor)
  grid.position.y = 0.01
  runtime.scene.add(grid)
  Object.assign(runtime, { ground, grid, gridWidth: width, gridHeight: height })
}

function selectedHouseholdChoice(state: SimulationState, selectedId: string | null, industry: CompetitiveIndustryId) {
  if (!selectedId || !state.households.some(({ id }) => id === selectedId)) return null
  return getHouseholdChoiceObservation(state, selectedId, industry)
}

function selectedEmployment(state: SimulationState, selectedId: string | null): EmploymentNetworkObservation | null {
  if (!selectedId) return null
  if (!state.households.some(({ id }) => id === selectedId) && !state.firms.some(({ id }) => id === selectedId)) return null
  return getEmploymentNetworkObservation(state, selectedId)
}

function syncEntities(runtime: Runtime, state: SimulationState, view: SceneView, related: Set<string>) {
  const descriptors = buildWorldEntities(state, view.measure)
  const liveIds = new Set(descriptors.map(({ id }) => id))
  for (const [id, mesh] of runtime.entities) {
    if (liveIds.has(id)) continue
    runtime.scene.remove(mesh)
    disposeObject(mesh)
    runtime.entities.delete(id)
  }

  for (const descriptor of descriptors) {
    let mesh = runtime.entities.get(descriptor.id)
    const isHousehold = descriptor.kind === 'household'
    if (!mesh) {
      mesh = new runtime.THREE.Mesh(
        new runtime.THREE.BoxGeometry(isHousehold ? 0.46 : 0.86, 1, isHousehold ? 0.46 : 0.86),
        new runtime.THREE.MeshStandardMaterial({ roughness: isHousehold ? 0.75 : 0.45, metalness: isHousehold ? 0.02 : 0.1 }),
      )
      mesh.userData.entityId = descriptor.id
      mesh.castShadow = true
      mesh.receiveShadow = true
      runtime.scene.add(mesh)
      runtime.entities.set(descriptor.id, mesh)
    }

    const selected = descriptor.id === view.selectedId
    const linked = related.has(descriptor.id)
    const inFocus = descriptor.industryId === view.industry
    let color = COLORS.household
    if (!isHousehold) color = descriptor.industryId === 'transport' ? COLORS.transport : inFocus ? variantColor(descriptor.firmVariant ?? 'a') : COLORS.idleFirm
    mesh.material.color.setHex(color)
    const scale = selected ? 1.25 : linked ? 1.15 : 1
    mesh.position.set(descriptor.x, descriptor.height / 2, descriptor.z)
    mesh.scale.set(scale, descriptor.height, scale)
    mesh.material.emissive.setHex(selected ? COLORS.selected : linked || (inFocus && !isHousehold) ? color : 0x000000)
    mesh.material.emissiveIntensity = selected ? 0.55 : linked ? 0.45 : inFocus && !isHousehold ? 0.18 : 0
  }
}

function territoryKey(state: SimulationState, industry: CompetitiveIndustryId) {
  return [industry, state.config.gridWidth ?? 20, state.config.gridHeight ?? 20, state.config.transportCostPerTileCents ?? 0,
    ...state.firms.filter((firm) => firm.industryId === industry).flatMap((firm) => [firm.id, firm.postedPriceCents, firm.coordinate?.x, firm.coordinate?.y])].join('|')
}

function syncTerritory(runtime: Runtime, state: SimulationState, industry: CompetitiveIndustryId) {
  const key = territoryKey(state, industry)
  if (runtime.territoryKey === key) return
  for (const mesh of runtime.territoryMeshes) {
    runtime.scene.remove(mesh)
    disposeObject(mesh)
  }
  runtime.territoryMeshes = []
  const THREE = runtime.THREE
  const territory = buildMarketTerritory(state, industry)
  for (const variant of ['a', 'b'] as const) {
    const cells = territory.cells.filter((cell) => cell.ownerVariant === variant)
    if (!cells.length) continue
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.94, 0.02, 0.94),
      new THREE.MeshStandardMaterial({ color: variantColor(variant), transparent: true, opacity: 0.2, roughness: 1, metalness: 0, depthWrite: false }),
      cells.length,
    )
    mesh.renderOrder = -1
    const dummy = new THREE.Object3D()
    cells.forEach((cell, index) => {
      dummy.position.set(cell.x, 0.012, cell.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    runtime.scene.add(mesh)
    runtime.territoryMeshes.push(mesh)
  }
  runtime.territoryKey = key
}

function clearLinks(runtime: Runtime) {
  for (const line of runtime.links) {
    runtime.scene.remove(line)
    disposeObject(line)
  }
  runtime.links = []
  runtime.linksKey = null
}

/** Draws schematic relationship lines: the selected household's supplier, or an employer and its workers. */
function syncLinks(runtime: Runtime, state: SimulationState, view: SceneView) {
  const THREE = runtime.THREE
  const segments: { from: any; to: any; color: number; dashed: boolean }[] = []
  if (view.linkMode === 'purchases') {
    const choice = selectedHouseholdChoice(state, view.selectedId, view.industry)
    const household = choice && runtime.entities.get(choice.householdId)
    const firm = choice?.chosenFirmId ? runtime.entities.get(choice.chosenFirmId) : null
    if (household && firm) segments.push({ from: household, to: firm, color: variantColor(firmVariant(choice!.chosenFirmId!) ?? 'a'), dashed: true })
  } else {
    const employment = selectedEmployment(state, view.selectedId)
    const firm = employment && runtime.entities.get(employment.firmId)
    if (employment && firm) for (const workerId of employment.workerIds) {
      const worker = runtime.entities.get(workerId)
      if (worker) segments.push({ from: firm, to: worker, color: COLORS.jobs, dashed: false })
    }
  }

  const key = segments.map(({ from, to }) => [from.userData.entityId, to.userData.entityId, from.position.y, to.position.y].join(':')).join('|') + view.linkMode
  if (runtime.linksKey === key) return
  clearLinks(runtime)
  for (const { from, to, color, dashed } of segments) {
    const start = new THREE.Vector3(from.position.x, from.position.y * 2 + 0.25, from.position.z)
    const end = new THREE.Vector3(to.position.x, to.position.y * 2 + 0.25, to.position.z)
    const mid = start.clone().lerp(end, 0.5)
    mid.y = Math.max(start.y, end.y) + start.distanceTo(end) * 0.18
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32))
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.32, gapSize: 0.18, transparent: true, opacity: 0.95 })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })
    const line = new THREE.Line(geometry, material)
    if (dashed) line.computeLineDistances()
    line.renderOrder = 4
    runtime.scene.add(line)
    runtime.links.push(line)
  }
  runtime.linksKey = key
}

function attachControls(runtime: Runtime, onSelect: (id: string | null) => void, onHover: (id: string | null, x: number, y: number) => void) {
  const canvas = runtime.renderer.domElement
  const THREE = runtime.THREE
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let dragging = false
  let moved = 0
  let mode: 'orbit' | 'pan' = 'orbit'
  let lastX = 0
  let lastY = 0

  const pick = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, runtime.camera)
    const hit = raycaster.intersectObjects(Array.from(runtime.entities.values()), false)[0]
    return { id: (hit?.object?.userData?.entityId as string | undefined) ?? null, x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const clampTarget = () => {
    const xBound = Math.max(2, runtime.gridWidth / 2)
    const zBound = Math.max(2, runtime.gridHeight / 2)
    runtime.controls.target.x = Math.max(-xBound, Math.min(xBound, runtime.controls.target.x))
    runtime.controls.target.z = Math.max(-zBound, Math.min(zBound, runtime.controls.target.z))
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 2) return
    dragging = true
    moved = 0
    mode = event.button === 2 || event.shiftKey ? 'pan' : 'orbit'
    lastX = event.clientX
    lastY = event.clientY
    canvas.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) {
      const { id, x, y } = pick(event)
      canvas.style.cursor = id ? 'pointer' : 'grab'
      onHover(id, x, y)
      return
    }
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    moved += Math.abs(dx) + Math.abs(dy)
    lastX = event.clientX
    lastY = event.clientY
    onHover(null, 0, 0)
    canvas.style.cursor = 'grabbing'
    if (mode === 'orbit') {
      runtime.controls.theta -= dx * 0.009
      runtime.controls.phi = Math.max(0.26, Math.min(1.46, runtime.controls.phi + dy * 0.009))
    } else {
      const scale = runtime.controls.radius * 0.0018
      const right = new THREE.Vector3().setFromMatrixColumn(runtime.camera.matrixWorld, 0)
      right.y = 0
      right.normalize()
      const forward = new THREE.Vector3().subVectors(runtime.controls.target, runtime.camera.position)
      forward.y = 0
      forward.normalize()
      runtime.controls.target.addScaledVector(right, -dx * scale)
      runtime.controls.target.addScaledVector(forward, dy * scale)
      clampTarget()
    }
    applyCamera(runtime)
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!dragging) return
    dragging = false
    canvas.style.cursor = 'grab'
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (moved < 6 && event.button === 0) onSelect(pick(event).id)
  }

  const onPointerLeave = () => onHover(null, 0, 0)

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    runtime.controls.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, runtime.controls.radius * Math.exp(event.deltaY * 0.001)))
    applyCamera(runtime)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === '+' || event.key === '=') runtime.controls.radius = Math.max(MIN_RADIUS, runtime.controls.radius * 0.9)
    else if (event.key === '-') runtime.controls.radius = Math.min(MAX_RADIUS, runtime.controls.radius * 1.1)
    else if (event.key === 'ArrowLeft') runtime.controls.theta += 0.12
    else if (event.key === 'ArrowRight') runtime.controls.theta -= 0.12
    else if (event.key === 'ArrowUp') runtime.controls.phi = Math.max(0.26, runtime.controls.phi - 0.08)
    else if (event.key === 'ArrowDown') runtime.controls.phi = Math.min(1.46, runtime.controls.phi + 0.08)
    else if (event.key === 'Escape') onSelect(null)
    else return
    event.preventDefault()
    applyCamera(runtime)
  }

  const preventMenu = (event: MouseEvent) => event.preventDefault()
  const listeners: [string, any, any?][] = [
    ['pointerdown', onPointerDown], ['pointermove', onPointerMove], ['pointerup', onPointerUp], ['pointercancel', onPointerUp],
    ['pointerleave', onPointerLeave], ['wheel', onWheel, { passive: false }], ['keydown', onKeyDown], ['contextmenu', preventMenu],
  ]
  for (const [type, handler, options] of listeners) canvas.addEventListener(type, handler, options)
  canvas.style.cursor = 'grab'
  return () => { for (const [type, handler] of listeners) canvas.removeEventListener(type, handler) }
}

function outcomeLabel(outcome: HouseholdChoiceObservation['outcome']) {
  if (outcome === 'purchased') return 'Bought'
  if (outcome === 'insufficient_funds') return "Couldn't afford"
  if (outcome === 'stockout') return 'Sold out'
  return 'Not yet'
}

function HouseholdInspector({ state, householdId, industry, onIndustry, onSelect }: {
  state: SimulationState
  householdId: string
  industry: CompetitiveIndustryId
  onIndustry: (industry: CompetitiveIndustryId) => void
  onSelect: (id: string) => void
}) {
  const household = state.households.find(({ id }) => id === householdId)!
  const choices = CONSUMER_INDUSTRIES.map((id) => getHouseholdChoiceObservation(state, householdId, id))
  const active = choices.find((choice) => choice.industryId === industry)!
  const unpaid = household.unpaidWageTodayCents
  return <>
    <p className="inspector-sub">Works at <button type="button" className="link" onClick={() => onSelect(household.employerFirmId)}>{firmName(household.employerFirmId)}</button></p>
    <h4>Where its cash went today</h4>
    <ol className="cash-steps">
      {householdCashSteps(household).map((step) => <li key={step.label} className={`cash-step cash-step--${step.kind}`}>
        <span>{step.label}{step.label === 'Wage' && unpaid > 0 && <small> ({money(unpaid)} short)</small>}</span>
        <span className="num">{step.kind === 'in' ? '+' : step.kind === 'out' ? '−' : ''}{money(step.amountCents)}</span>
      </li>)}
    </ol>
    <h4>Today's purchases</h4>
    <ul className="purchase-list">
      {choices.map((choice) => <li key={choice.industryId}>
        <button type="button" aria-pressed={choice.industryId === industry} onClick={() => onIndustry(choice.industryId)}>
          <span>{INDUSTRY_NAMES[choice.industryId]}</span>
          <span className={`outcome outcome--${choice.outcome}`}>{choice.chosenFirmId ? firmShortName(choice.chosenFirmId) : outcomeLabel(choice.outcome)}</span>
          <span className="num">{choice.deliveredCostCents === null ? '—' : money(choice.deliveredCostCents)}</span>
        </button>
      </li>)}
    </ul>
    {active.chosenFirmId && <p className="inspector-note">
      {INDUSTRY_NAMES[industry]}: paid {money(active.productPriceCents ?? 0)} + {money(active.transportFeeCents ?? 0)} transport for a {active.roundTripTiles}-tile round trip to {firmShortName(active.chosenFirmId)}. Firm A is {active.distanceToA} tiles away, Firm B {active.distanceToB}.
    </p>}
  </>
}

function FirmInspector({ state, firmId, linkMode, onSelect }: { state: SimulationState; firmId: string; linkMode: LinkMode; onSelect: (id: string) => void }) {
  const firm = state.firms.find(({ id }) => id === firmId)!
  const market = state.metrics.at(-1)?.markets.find((item) => item.firmId === firmId)
  const isTransport = firm.industryId === 'transport'
  return <>
    <p className="inspector-sub">{isTransport ? 'Monopoly · has no location, so it sits off the grid' : `Competes in ${INDUSTRY_NAMES[firm.industryId]}`}</p>
    <dl className="inspector-stats">
      <div><dt>{isTransport ? 'Rate' : 'Price'}</dt><dd>{isTransport ? `${money(state.config.transportCostPerTileCents ?? 0)}/tile` : money(market?.postedPriceCents ?? firm.postedPriceCents)}</dd></div>
      <div><dt>{isTransport ? 'Trips sold' : 'Share'}</dt><dd>{isTransport ? firm.unitsSoldToday : `${Math.round((market?.marketShare ?? 0) * 100)}%`}</dd></div>
      <div><dt>Revenue</dt><dd>{money(firm.revenueTodayCents)}</dd></div>
      <div><dt>Wages paid</dt><dd>{Math.round(firm.payrollFulfillmentRate * 100)}%</dd></div>
    </dl>
    {!isTransport && <p className="inspector-note">Sold {firm.unitsSoldToday} of {firm.unitsProducedToday} units made today. Tomorrow's price: {money(firm.postedPriceCents)}.</p>}
    <h4>{firm.employeeIds.length} workers {linkMode !== 'jobs' && <span className="muted">· switch to Jobs to see links</span>}</h4>
    <div className="worker-grid">
      {firm.employeeIds.map((workerId) => <button type="button" key={workerId} onClick={() => onSelect(workerId)}>{workerId.replace('household-', 'H')}</button>)}
    </div>
  </>
}

export function WorldView({ state, selectedId, onSelect, industry, onIndustry }: {
  state: SimulationState
  selectedId: string | null
  onSelect: (id: string | null) => void
  industry: CompetitiveIndustryId
  onIndustry: (industry: CompetitiveIndustryId) => void
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<Runtime | null>(null)
  const stateRef = useRef(state)
  const [linkMode, setLinkMode] = useState<LinkMode>('purchases')
  const [measure, setMeasure] = useState<CashMeasure>('before')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [query, setQuery] = useState('')
  const view: SceneView = { selectedId, industry, linkMode, measure }
  const viewRef = useRef(view)
  stateRef.current = state
  viewRef.current = view

  const select = (id: string | null) => {
    onSelect(id)
    const firm = id ? stateRef.current.firms.find((candidate) => candidate.id === id) : null
    if (firm && firm.industryId !== 'transport') onIndustry(firm.industryId)
  }
  const selectRef = useRef(select)
  selectRef.current = select

  const related = useMemo(() => {
    const ids = new Set<string>()
    if (linkMode === 'purchases') {
      const choice = selectedHouseholdChoice(state, selectedId, industry)
      if (choice?.chosenFirmId) ids.add(choice.chosenFirmId)
    } else {
      const employment = selectedEmployment(state, selectedId)
      if (employment) [employment.firmId, ...employment.workerIds].forEach((id) => ids.add(id))
    }
    if (selectedId) ids.delete(selectedId)
    return ids
  }, [state, selectedId, industry, linkMode])

  const territory = useMemo(() => buildMarketTerritory(state, industry), [state, industry])
  const searchOptions = useMemo(() => [...state.firms.map(({ id }) => ({ id, label: firmName(id) })), ...state.households.map(({ id }) => ({ id, label: householdName(id) }))], [state.firms, state.households])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let cancelled = false

    const initialize = async () => {
      try {
        const THREE = await import(/* @vite-ignore */ THREE_MODULE_URL)
        if (cancelled) return
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(COLORS.background)
        scene.fog = new THREE.Fog(COLORS.background, 60, 140)
        const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 260)
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.domElement.tabIndex = 0
        renderer.domElement.setAttribute('aria-label', 'Economy map. Drag to orbit, shift-drag or right-drag to pan, scroll or press plus and minus to zoom, arrow keys to rotate, Escape to clear the selection.')
        mount.appendChild(renderer.domElement)
        scene.add(new THREE.HemisphereLight(0xdfe9e4, 0x161b19, 1.5))
        const key = new THREE.DirectionalLight(0xffffff, 2.3)
        key.position.set(10, 22, 8)
        key.castShadow = true
        key.shadow.mapSize.set(1024, 1024)
        scene.add(key)

        const runtime: Runtime = {
          THREE, scene, camera, renderer, entities: new Map(), territoryMeshes: [], territoryKey: null, links: [], linksKey: null,
          ground: null, grid: null, gridWidth: 0, gridHeight: 0, frame: null, dirty: true, resizeObserver: null as unknown as ResizeObserver, disposeControls: () => {},
          controls: { target: new THREE.Vector3(0, 0, 0), radius: 46, theta: Math.PI / 4, phi: 0.88 },
        }
        const resize = () => {
          const width = Math.max(1, mount.clientWidth)
          const height = Math.max(1, mount.clientHeight)
          renderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          runtime.dirty = true
        }
        runtime.resizeObserver = new ResizeObserver(resize)
        runtime.resizeObserver.observe(mount)
        runtime.disposeControls = attachControls(
          runtime,
          (id) => selectRef.current(id),
          (id, x, y) => {
            setHoverId(id)
            const tooltip = tooltipRef.current
            if (tooltip) tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`
          },
        )
        runtimeRef.current = runtime
        syncGround(runtime, stateRef.current)
        syncTerritory(runtime, stateRef.current, viewRef.current.industry)
        syncEntities(runtime, stateRef.current, viewRef.current, new Set())
        syncLinks(runtime, stateRef.current, viewRef.current)
        resetCamera(runtime)
        resize()
        const render = () => {
          if (runtime.dirty) {
            renderer.render(scene, camera)
            runtime.dirty = false
          }
          runtime.frame = requestAnimationFrame(render)
        }
        render()
        setStatus('ready')
      } catch (error) {
        console.error('Unable to initialize the Three.js world view', error)
        if (!cancelled) setStatus('error')
      }
    }
    void initialize()

    return () => {
      cancelled = true
      const runtime = runtimeRef.current
      if (!runtime) return
      if (runtime.frame !== null) cancelAnimationFrame(runtime.frame)
      runtime.disposeControls()
      runtime.resizeObserver.disconnect()
      clearLinks(runtime)
      for (const mesh of [...runtime.territoryMeshes, ...runtime.entities.values()]) {
        runtime.scene.remove(mesh)
        disposeObject(mesh)
      }
      if (runtime.ground) disposeObject(runtime.ground)
      if (runtime.grid) disposeObject(runtime.grid)
      runtime.renderer.dispose()
      runtime.renderer.domElement.remove()
      runtimeRef.current = null
    }
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    syncGround(runtime, state)
    syncTerritory(runtime, state, industry)
    const current = { selectedId, industry, linkMode, measure }
    syncEntities(runtime, state, current, related)
    syncLinks(runtime, state, current)
    runtime.dirty = true
  }, [state, selectedId, industry, linkMode, measure, related, status])

  const selectedHousehold = selectedId?.startsWith('household-') ? selectedId : null
  const selectedFirm = selectedId && state.firms.some(({ id }) => id === selectedId) ? selectedId : null
  const [firmAId, firmBId] = territory.firmIds
  const firmA = state.firms.find(({ id }) => id === firmAId)!
  const firmB = state.firms.find(({ id }) => id === firmBId)!
  const hovered = hoverId && hoverId !== selectedId ? hoverId : null
  const hoveredHousehold = hovered ? state.households.find(({ id }) => id === hovered) : null
  const hoveredFirm = hovered ? state.firms.find(({ id }) => id === hovered) : null

  const onSearch = (value: string) => {
    setQuery(value)
    const match = searchOptions.find((option) => option.label.toLowerCase() === value.trim().toLowerCase())
    if (match) { select(match.id); setQuery('') }
  }

  return <section className="card world" aria-labelledby="world-title">
    <header className="card-head world-head">
      <div>
        <h2 id="world-title">The economy map<InfoTip label="About the map">
          Each pillar is a household; taller means more cash. Switch between cash before and after Government's tax and transfers at the bottom of the map. The larger blocks are firms. The shaded floor shows which firm offers the cheapest delivered price (price plus round-trip transport) at every spot for the selected market. Transport is a monopoly with no location, so it sits just off the grid.
        </InfoTip></h2>
        <p>Each pillar is a household; taller means more cash. Click anything to inspect it.</p>
      </div>
      <div className="world-tools">
        <Segmented label="Market shown on the map" size="sm" value={industry} onChange={onIndustry} options={CONSUMER_INDUSTRIES.map((id) => ({ id, label: INDUSTRY_NAMES[id] }))} />
        <Segmented label="Relationship lines" size="sm" value={linkMode} onChange={setLinkMode} options={[{ id: 'purchases', label: 'Purchases' }, { id: 'jobs', label: 'Jobs' }]} />
      </div>
    </header>

    <div className="world-stage">
      <div className="world-canvas" data-status={status}>
        <div ref={mountRef} className="world-canvas-mount" />
        {status === 'loading' && <div className="world-status">Loading the 3D map…</div>}
        {status === 'error' && <div className="world-status world-status--error">The 3D map couldn't load (it needs WebGL and an internet connection). Everything else still works.</div>}
        <div ref={tooltipRef} className={`world-tooltip${hovered ? ' is-visible' : ''}`} aria-hidden="true">
          {hoveredHousehold && <><strong>{householdName(hoveredHousehold.id)}</strong><span>{money(hoveredHousehold.preTaxCashCents)} before tax → {money(hoveredHousehold.postFiscalCashCents)} after</span><span>Works at {firmName(hoveredHousehold.employerFirmId)}</span></>}
          {hoveredFirm && <><strong>{firmName(hoveredFirm.id)}</strong><span>{hoveredFirm.industryId === 'transport' ? `${hoveredFirm.employeeIds.length} workers` : `${money(hoveredFirm.postedPriceCents)} tomorrow · ${hoveredFirm.employeeIds.length} workers`}</span></>}
        </div>
        <div className="world-overlay world-overlay--top">
          <label className="world-search">
            <Icon name="search" size={14} />
            <input list="world-entities" placeholder="Find a household or firm" aria-label="Find a household or firm" value={query} onChange={(event) => onSearch(event.target.value)} />
          </label>
          <datalist id="world-entities">{searchOptions.map((option) => <option key={option.id} value={option.label} />)}</datalist>
          <button type="button" className="icon-button" aria-label="Reset camera" title="Reset camera" disabled={status !== 'ready'} onClick={() => runtimeRef.current && resetCamera(runtimeRef.current)}><Icon name="camera" /></button>
        </div>
        <div className="world-overlay world-overlay--bottom world-legend">
          <span className="legend-height">Height
            <Segmented label="Pillar height shows" size="sm" value={measure} onChange={setMeasure} options={[{ id: 'before', label: 'Before tax' }, { id: 'after', label: 'After tax' }]} />
          </span>
          <span><i className="swatch swatch--a" />{firmShortName(firmA.id)} · {money(firmA.postedPriceCents)} · {territory.cellCounts[firmA.id] ?? 0} tiles</span>
          <span><i className="swatch swatch--b" />{firmShortName(firmB.id)} · {money(firmB.postedPriceCents)} · {territory.cellCounts[firmB.id] ?? 0} tiles</span>
        </div>
      </div>

      {selectedId && (selectedHousehold || selectedFirm) && <aside className="inspector" aria-live="polite" aria-label="Selection details">
        <header>
          <h3>{entityName(selectedId)}</h3>
          <button type="button" className="icon-button" aria-label="Close details" onClick={() => onSelect(null)}><Icon name="close" /></button>
        </header>
        {selectedHousehold && <HouseholdInspector state={state} householdId={selectedHousehold} industry={industry} onIndustry={onIndustry} onSelect={select} />}
        {selectedFirm && <FirmInspector state={state} firmId={selectedFirm} linkMode={linkMode} onSelect={select} />}
        <p className="inspector-foot">{linkMode === 'purchases' ? 'Dashed line: who this household bought from in the selected market.' : 'Green lines: employment links.'} Lines show relationships, not travel routes.</p>
      </aside>}
    </div>
  </section>
}
