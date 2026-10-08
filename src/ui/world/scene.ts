import type { SimulationState } from '../../sim/types'
import { firmSlot } from '../format'
import { firmColor, hex, palette } from '../theme'
import {
  buildMarketTerritory,
  buildWorldEntities,
  getEmploymentNetworkObservation,
  getHouseholdChoiceObservation,
  getTransferRecipientIds,
  type CashMeasure,
  type CompetitiveIndustryId,
  type EmploymentNetworkObservation,
  type LinkMode,
  type WorldEntity,
} from '../worldViewModel'
import {
  buildingArchetype,
  buildingRotation,
  createBuildingKit,
  setAccent,
  type BuildingKit,
  type MergeGeometries,
} from './buildings'
import { createScenery, SCENERY_MARGIN, sceneryLayout } from './scenery'
import {
  groundShiftForScreenOffset,
  NO_INSET,
  planFlight,
  poseAt,
  viewOffset,
  type Flight,
  type ViewInset,
} from './cameraMath'

// A narrow field of view keeps perspective from exaggerating near pillars, so height reads as cash.
export const FIELD_OF_VIEW = 26
export const MIN_RADIUS = 14
export const MAX_RADIUS = 95
/** Overlay pillars are a little wider than a house, so they wrap it. */
const PILLAR_WIDTH = 0.56

export const COLORS = {
  background: hex(palette.bg),
  ground: 0x0f1412,
  gridMajor: 0x2a332f,
  gridMinor: 0x1a201d,
  household: hex(palette.household),
  idleFirm: 0x46514c,
  transport: hex(palette.text2),
  government: hex(palette.government),
  selected: hex(palette.accent),
  jobs: hex(palette.positive),
}

const slotColor = (slot: number | undefined | null) => hex(firmColor(slot ?? 0))
export const firmIdColor = (firmId: string) => slotColor(firmSlot(firmId))

export type Runtime = {
  THREE: any
  scene: any
  camera: any
  renderer: any
  keyLight: any
  kit: BuildingKit
  /** One building mesh per entity. Their geometry belongs to `kit`, so only their materials are disposed. */
  entities: Map<string, any>
  /** Household cash pillars, present only while the data overlay is on. They share `pillarGeometry`. */
  pillars: Map<string, any>
  pillarGeometry: any
  mergeGeometries: MergeGeometries
  /** Grass, trees and bushes, built when first shown and kept while hidden; rebuilt only when the map changes. */
  scenery: ReturnType<typeof createScenery> | null
  sceneryKey: string | null
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
  /** A camera move in progress, eased frame by frame. Any manual camera input cancels it. */
  flight: (Flight & { startedAt: number }) | null
  /** The part of the canvas an open panel covers; the projection is shifted to keep the target in view. */
  inset: ViewInset
  viewport: { width: number; height: number }
  /** While paused (covered or hidden), nothing is drawn. */
  paused: boolean
}

export interface SceneView {
  selectedId: string | null
  industry: CompetitiveIndustryId
  linkMode: LinkMode
  measure: CashMeasure
  overlay: boolean
  scenery: boolean
}

export function disposeObject(object: any) {
  object.geometry?.dispose?.()
  if (Array.isArray(object.material)) object.material.forEach((material: any) => material.dispose?.())
  else object.material?.dispose?.()
}

export function applyCamera(runtime: Runtime) {
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

export function resetCamera(runtime: Runtime) {
  runtime.controls.target.set(0, 0, 0)
  runtime.controls.radius = 46
  runtime.controls.theta = Math.PI / 4
  runtime.controls.phi = 0.88
  applyCamera(runtime)
}

export function syncGround(runtime: Runtime, state: SimulationState) {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  if (runtime.gridWidth === width && runtime.gridHeight === height) return
  for (const object of [runtime.ground, runtime.grid]) {
    if (!object) continue
    runtime.scene.remove(object)
    disposeObject(object)
  }
  const THREE = runtime.THREE
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1, metalness: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  ground.receiveShadow = true
  runtime.scene.add(ground)
  const grid = new THREE.GridHelper(
    Math.max(width, height),
    Math.max(width, height),
    COLORS.gridMajor,
    COLORS.gridMinor,
  )
  grid.position.y = 0.01
  runtime.scene.add(grid)
  // The shadow camera covers the grid and the scenery around it, so everything casts shadows, not just the centre.
  const half = Math.max(width, height) / 2 + SCENERY_MARGIN + 1
  Object.assign(runtime.keyLight.shadow.camera, { left: -half, right: half, top: half, bottom: -half })
  runtime.keyLight.shadow.camera.updateProjectionMatrix()
  Object.assign(runtime, { ground, grid, gridWidth: width, gridHeight: height })
}

export function selectedHouseholdChoice(
  state: SimulationState,
  selectedId: string | null,
  industry: CompetitiveIndustryId,
) {
  if (!selectedId || !state.households.some(({ id }) => id === selectedId)) return null
  return getHouseholdChoiceObservation(state, selectedId, industry)
}

export function selectedEmployment(
  state: SimulationState,
  selectedId: string | null,
): EmploymentNetworkObservation | null {
  if (!selectedId) return null
  if (!state.households.some(({ id }) => id === selectedId) && !state.firms.some(({ id }) => id === selectedId))
    return null
  return getEmploymentNetworkObservation(state, selectedId)
}

/** Removes a building. Its geometry is shared through the kit, so only its own material is disposed. */
function removeBuilding(runtime: Runtime, mesh: any) {
  runtime.scene.remove(mesh)
  mesh.material.dispose()
}

/** Keeps one building per entity in step with the simulation, and returns the entities it drew. */
export function syncEntities(
  runtime: Runtime,
  state: SimulationState,
  view: SceneView,
  related: Set<string>,
): WorldEntity[] {
  const descriptors = buildWorldEntities(state, view.measure)
  const liveIds = new Set(descriptors.map(({ id }) => id))
  for (const [id, mesh] of runtime.entities) {
    if (liveIds.has(id)) continue
    removeBuilding(runtime, mesh)
    runtime.entities.delete(id)
  }

  for (const descriptor of descriptors) {
    // A household that changes wealth tier swaps to another house.
    const geometry = runtime.kit.geometry(buildingArchetype(descriptor))
    let mesh = runtime.entities.get(descriptor.id)
    if (!mesh) {
      mesh = new runtime.THREE.Mesh(geometry, runtime.kit.material())
      mesh.userData.entityId = descriptor.id
      mesh.rotation.y = buildingRotation(descriptor.id)
      mesh.castShadow = true
      mesh.receiveShadow = true
      runtime.scene.add(mesh)
      runtime.entities.set(descriptor.id, mesh)
    } else if (mesh.geometry !== geometry) mesh.geometry = geometry

    const selected = descriptor.id === view.selectedId
    const linked = related.has(descriptor.id)
    // Houses have no accent surface; a firm's accent shows its slot, greyed outside the focused market.
    let accent = COLORS.household
    if (descriptor.kind === 'government') accent = COLORS.government
    else if (descriptor.kind === 'firm')
      accent =
        descriptor.industryId === 'transport'
          ? COLORS.transport
          : descriptor.industryId === view.industry
            ? slotColor(descriptor.firmSlot)
            : COLORS.idleFirm
    setAccent(mesh.material, accent)
    const scale = selected ? 1.25 : linked ? 1.15 : 1
    mesh.position.set(descriptor.x, 0, descriptor.z)
    mesh.scale.setScalar(scale)
    mesh.userData.top = geometry.userData.top * scale
    mesh.material.emissive.setHex(selected ? COLORS.selected : linked ? accent : 0x000000)
    mesh.material.emissiveIntensity = selected ? 0.45 : linked ? 0.35 : 0
  }
  return descriptors
}

/** While the data overlay is on, keeps a translucent cash pillar around every house; otherwise removes them. */
export function syncPillars(runtime: Runtime, descriptors: WorldEntity[], view: SceneView, related: Set<string>) {
  const households = view.overlay ? descriptors.filter(({ kind }) => kind === 'household') : []
  const liveIds = new Set(households.map(({ id }) => id))
  for (const [id, pillar] of runtime.pillars) {
    if (liveIds.has(id)) continue
    runtime.scene.remove(pillar)
    pillar.material.dispose()
    runtime.pillars.delete(id)
  }

  for (const descriptor of households) {
    let pillar = runtime.pillars.get(descriptor.id)
    if (!pillar) {
      pillar = new runtime.THREE.Mesh(
        runtime.pillarGeometry,
        new runtime.THREE.MeshStandardMaterial({
          color: COLORS.household,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          roughness: 0.6,
          metalness: 0,
        }),
      )
      pillar.userData.entityId = descriptor.id
      pillar.renderOrder = 2
      runtime.scene.add(pillar)
      runtime.pillars.set(descriptor.id, pillar)
    }
    const selected = descriptor.id === view.selectedId
    const linked = related.has(descriptor.id)
    const width = PILLAR_WIDTH * (selected ? 1.25 : linked ? 1.15 : 1)
    pillar.position.set(descriptor.x, descriptor.height / 2, descriptor.z)
    pillar.scale.set(width, descriptor.height, width)
    pillar.userData.top = descriptor.height
    pillar.material.emissive.setHex(selected ? COLORS.selected : linked ? COLORS.household : 0x000000)
    pillar.material.emissiveIntensity = selected ? 0.55 : linked ? 0.45 : 0
  }
}

function territoryKey(state: SimulationState, industry: CompetitiveIndustryId) {
  return [
    industry,
    state.config.gridWidth ?? 20,
    state.config.gridHeight ?? 20,
    state.config.transportCostPerTileCents ?? 0,
    ...state.firms
      .filter((firm) => firm.industryId === industry)
      .flatMap((firm) => [firm.id, firm.postedPriceCents, firm.coordinate?.x, firm.coordinate?.y]),
  ].join('|')
}

/**
 * Shows or hides the grass island, trees and bushes. Their layout depends only on the grid, the seed and where
 * entities stand, so it is rebuilt only when one of those changes, such as after Apply settings.
 */
export function syncScenery(runtime: Runtime, state: SimulationState, entities: WorldEntity[], enabled: boolean) {
  if (!enabled) {
    if (runtime.scenery) runtime.scenery.group.visible = false
    return
  }
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  const seed = state.config.seed ?? 0
  const key = [width, height, seed, ...entities.map(({ x, z }) => `${x},${z}`)].join('|')
  if (runtime.sceneryKey !== key) {
    if (runtime.scenery) {
      runtime.scene.remove(runtime.scenery.group)
      runtime.scenery.dispose()
    }
    runtime.scenery = createScenery(
      runtime.THREE,
      runtime.mergeGeometries,
      sceneryLayout({ width, height, seed, entities }),
    )
    runtime.scene.add(runtime.scenery.group)
    runtime.sceneryKey = key
  }
  runtime.scenery!.group.visible = true
}

function clearTerritory(runtime: Runtime) {
  for (const mesh of runtime.territoryMeshes) {
    runtime.scene.remove(mesh)
    disposeObject(mesh)
  }
  runtime.territoryMeshes = []
  runtime.territoryKey = null
}

/** Draws which firm is cheapest on each tile, only while the data overlay is on. */
export function syncTerritory(
  runtime: Runtime,
  state: SimulationState,
  industry: CompetitiveIndustryId,
  overlay: boolean,
) {
  if (!overlay) return clearTerritory(runtime)
  const key = territoryKey(state, industry)
  if (runtime.territoryKey === key) return
  clearTerritory(runtime)
  const THREE = runtime.THREE
  const territory = buildMarketTerritory(state, industry)
  for (const firmId of territory.firmIds) {
    const cells = territory.cells.filter((cell) => cell.ownerFirmId === firmId)
    if (!cells.length) continue
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.94, 0.02, 0.94),
      new THREE.MeshStandardMaterial({
        color: firmIdColor(firmId),
        transparent: true,
        opacity: 0.2,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      }),
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

export function clearLinks(runtime: Runtime) {
  for (const line of runtime.links) {
    runtime.scene.remove(line)
    disposeObject(line)
  }
  runtime.links = []
  runtime.linksKey = null
}

/** Households that received a transfer today while Government is selected, otherwise null. */
export function selectedTransfers(state: SimulationState, selectedId: string | null) {
  return selectedId === state.government.id ? getTransferRecipientIds(state) : null
}

/**
 * Draws schematic relationship lines: Government's transfer recipients, the selected household's supplier, or an
 * employer and its workers.
 */
export function syncLinks(runtime: Runtime, state: SimulationState, view: SceneView) {
  const THREE = runtime.THREE
  const segments: { from: string; to: string; color: number; dashed: boolean }[] = []
  const recipients = selectedTransfers(state, view.selectedId)
  if (recipients) {
    for (const householdId of recipients)
      segments.push({ from: state.government.id, to: householdId, color: COLORS.government, dashed: false })
  } else if (view.linkMode === 'purchases') {
    const choice = selectedHouseholdChoice(state, view.selectedId, view.industry)
    if (choice?.chosenFirmId)
      segments.push({
        from: choice.householdId,
        to: choice.chosenFirmId,
        color: firmIdColor(choice.chosenFirmId),
        dashed: true,
      })
  } else {
    const employment = selectedEmployment(state, view.selectedId)
    if (employment)
      for (const workerId of employment.workerIds)
        segments.push({ from: employment.firmId, to: workerId, color: COLORS.jobs, dashed: false })
  }

  // A line ends just above the household's pillar while the overlay draws one, and otherwise above the rooftop.
  const endpoint = (id: string) => {
    const mesh = runtime.entities.get(id)
    if (!mesh) return null
    const top: number = runtime.pillars.get(id)?.userData.top ?? mesh.userData.top
    return new THREE.Vector3(mesh.position.x, top + 0.15, mesh.position.z)
  }
  const lines = segments.flatMap(({ from, to, color, dashed }) => {
    const start = endpoint(from)
    const end = endpoint(to)
    return start && end ? [{ start, end, color, dashed }] : []
  })

  const key =
    lines.map(({ start, end }) => [start.x, start.y, start.z, end.x, end.y, end.z].join(':')).join('|') + view.linkMode
  if (runtime.linksKey === key) return
  clearLinks(runtime)
  for (const { start, end, color, dashed } of lines) {
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

export function attachControls(
  runtime: Runtime,
  onSelect: (id: string | null) => void,
  onHover: (id: string | null, x: number, y: number) => void,
) {
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
    const hit = raycaster.intersectObjects([...runtime.entities.values(), ...runtime.pillars.values()], false)[0]
    return {
      id: (hit?.object?.userData?.entityId as string | undefined) ?? null,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const clampTarget = () => {
    const xBound = Math.max(2, runtime.gridWidth / 2)
    const zBound = Math.max(2, runtime.gridHeight / 2)
    runtime.controls.target.x = Math.max(-xBound, Math.min(xBound, runtime.controls.target.x))
    runtime.controls.target.z = Math.max(-zBound, Math.min(zBound, runtime.controls.target.z))
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 2) return
    runtime.flight = null
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
    runtime.flight = null
    runtime.controls.radius = Math.max(
      MIN_RADIUS,
      Math.min(MAX_RADIUS, runtime.controls.radius * Math.exp(event.deltaY * 0.001)),
    )
    applyCamera(runtime)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === '+' || event.key === '=')
      runtime.controls.radius = Math.max(MIN_RADIUS, runtime.controls.radius * 0.9)
    else if (event.key === '-') runtime.controls.radius = Math.min(MAX_RADIUS, runtime.controls.radius * 1.1)
    else if (event.key === 'ArrowLeft') runtime.controls.theta += 0.12
    else if (event.key === 'ArrowRight') runtime.controls.theta -= 0.12
    else if (event.key === 'ArrowUp') runtime.controls.phi = Math.max(0.26, runtime.controls.phi - 0.08)
    else if (event.key === 'ArrowDown') runtime.controls.phi = Math.min(1.46, runtime.controls.phi + 0.08)
    else if (event.key === 'Escape') onSelect(null)
    else return
    event.preventDefault()
    runtime.flight = null
    applyCamera(runtime)
  }

  const preventMenu = (event: MouseEvent) => event.preventDefault()
  const listeners: [string, any, any?][] = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerUp],
    ['pointercancel', onPointerUp],
    ['pointerleave', onPointerLeave],
    ['wheel', onWheel, { passive: false }],
    ['keydown', onKeyDown],
    ['contextmenu', preventMenu],
  ]
  for (const [type, handler, options] of listeners) canvas.addEventListener(type, handler, options)
  canvas.style.cursor = 'grab'
  return () => {
    for (const [type, handler] of listeners) canvas.removeEventListener(type, handler)
  }
}

/** Builds the scene, camera, lights, controls and render loop inside `mount`. The caller syncs the simulation in. */
export async function createRuntime(
  mount: HTMLElement,
  handlers: {
    onSelect: (id: string | null) => void
    onHover: (id: string | null, x: number, y: number) => void
  },
): Promise<Runtime> {
  const [THREE, { mergeGeometries }] = await Promise.all([
    import('three'),
    import('three/examples/jsm/utils/BufferGeometryUtils.js'),
  ])
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.background)
  scene.fog = new THREE.Fog(COLORS.background, 60, 140)
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 260)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.tabIndex = 0
  renderer.domElement.setAttribute(
    'aria-label',
    'Economy map. Drag to orbit, shift-drag or right-drag to pan, scroll or press plus and minus to zoom, arrow keys to rotate, Escape to clear the selection.',
  )
  mount.appendChild(renderer.domElement)
  scene.add(new THREE.HemisphereLight(0xdfe9e4, 0x161b19, 1.5))
  const key = new THREE.DirectionalLight(0xffffff, 2.3)
  key.position.set(10, 22, 8)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0005
  key.shadow.normalBias = 0.02
  scene.add(key)

  const runtime: Runtime = {
    THREE,
    scene,
    camera,
    renderer,
    keyLight: key,
    kit: createBuildingKit(THREE, mergeGeometries),
    mergeGeometries,
    scenery: null,
    sceneryKey: null,
    entities: new Map(),
    pillars: new Map(),
    pillarGeometry: new THREE.BoxGeometry(1, 1, 1),
    territoryMeshes: [],
    territoryKey: null,
    links: [],
    linksKey: null,
    ground: null,
    grid: null,
    gridWidth: 0,
    gridHeight: 0,
    frame: null,
    dirty: true,
    resizeObserver: null as unknown as ResizeObserver,
    disposeControls: () => {},
    controls: { target: new THREE.Vector3(0, 0, 0), radius: 46, theta: Math.PI / 4, phi: 0.88 },
    flight: null,
    inset: NO_INSET,
    viewport: { width: 1, height: 1 },
    paused: false,
  }
  const resize = () => {
    const width = Math.max(1, mount.clientWidth)
    const height = Math.max(1, mount.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    runtime.viewport = { width, height }
    setViewInset(runtime, runtime.inset)
  }
  runtime.resizeObserver = new ResizeObserver(resize)
  runtime.resizeObserver.observe(mount)
  runtime.disposeControls = attachControls(runtime, handlers.onSelect, handlers.onHover)
  resetCamera(runtime)
  resize()
  const render = () => {
    const flight = runtime.flight
    if (flight) {
      const elapsed = performance.now() - flight.startedAt
      const pose = poseAt(flight, elapsed)
      runtime.controls.target.x = pose.x
      runtime.controls.target.z = pose.z
      runtime.controls.radius = pose.radius
      applyCamera(runtime)
      if (elapsed >= flight.durationMs) runtime.flight = null
    }
    if (runtime.dirty && !runtime.paused) {
      renderer.render(scene, camera)
      runtime.dirty = false
    }
    runtime.frame = requestAnimationFrame(render)
  }
  render()
  return runtime
}

export function disposeRuntime(runtime: Runtime) {
  if (runtime.frame !== null) cancelAnimationFrame(runtime.frame)
  runtime.disposeControls()
  runtime.resizeObserver.disconnect()
  clearLinks(runtime)
  clearTerritory(runtime)
  for (const mesh of runtime.entities.values()) removeBuilding(runtime, mesh)
  for (const pillar of runtime.pillars.values()) pillar.material.dispose()
  runtime.pillarGeometry.dispose()
  runtime.kit.dispose()
  runtime.scenery?.dispose()
  if (runtime.ground) disposeObject(runtime.ground)
  if (runtime.grid) disposeObject(runtime.grid)
  runtime.renderer.dispose()
  runtime.renderer.domElement.remove()
}

/** Shifts the projection so the camera target sits in the middle of the area a panel leaves uncovered. */
export function setViewInset(runtime: Runtime, inset: ViewInset) {
  runtime.inset = inset
  const offset = viewOffset(inset)
  const { width, height } = runtime.viewport
  if (offset) runtime.camera.setViewOffset(width, height, offset.x, offset.y, width, height)
  else runtime.camera.clearViewOffset()
  runtime.camera.updateProjectionMatrix()
  runtime.dirty = true
}

/**
 * Starts a camera move to an entity. `chrome` is the screen space the HUD (top), inspector (left) and map tools
 * (bottom) cover beyond
 * the panel inset; the entity lands in the middle of what is left. Returns false when the entity has no mesh.
 */
export function flyTo(
  runtime: Runtime,
  entityId: string,
  reducedMotion: boolean,
  chrome: { top: number; left: number; bottom: number } = { top: 0, left: 0, bottom: 0 },
) {
  const mesh = runtime.entities.get(entityId)
  if (!mesh) return false
  const { target, radius, theta, phi } = runtime.controls
  const flight = planFlight(
    { x: target.x, z: target.z, radius },
    { x: mesh.position.x, z: mesh.position.z },
    reducedMotion,
  )
  const shift = groundShiftForScreenOffset(
    { theta, phi, radius: flight.to.radius, fovDeg: FIELD_OF_VIEW, viewportHeight: runtime.viewport.height },
    { dx: chrome.left / 2, dy: (chrome.top - chrome.bottom) / 2 },
  )
  const to = { ...flight.to, x: flight.to.x + shift.x, z: flight.to.z + shift.z }
  runtime.flight = { ...flight, to, startedAt: performance.now() }
  runtime.dirty = true
  return true
}
