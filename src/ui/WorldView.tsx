import { useEffect, useMemo, useRef, useState } from 'react'
import type { IndustryId, SimulationState } from '../sim/types'
import { buildMarketTerritory, buildWorldEntities, getEmploymentNetworkObservation, getHouseholdChoiceObservation, type CompetitiveIndustryId, type EmploymentNetworkObservation, type HouseholdChoiceObservation } from './worldViewModel'

const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm'

const INDUSTRY_COLORS: Record<CompetitiveIndustryId, { a: number; b: number }> = {
  food: { a: 0xdeff75, b: 0xf09a63 },
  utilities: { a: 0x65bfa1, b: 0x63b9d5 },
  healthcare: { a: 0xd6a866, b: 0xb997e8 },
  entertainment: { a: 0xd47c9b, b: 0xf09a63 },
}

const TRANSPORT_COLOR = 0x97a3ff
type RelationshipMode = 'purchases' | 'employment'

function firmDisplayColor(industryId: IndustryId, variant: 'a' | 'b' = 'a') {
  return industryId === 'transport' ? TRANSPORT_COLOR : INDUSTRY_COLORS[industryId][variant]
}

const COMPETITIVE_INDUSTRIES: { id: CompetitiveIndustryId; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'entertainment', label: 'Entertainment' },
]

type Runtime = {
  THREE: any
  scene: any
  camera: any
  renderer: any
  entities: Map<string, any>
  territoryMeshes: any[]
  territoryKey: string | null
  choiceLine: any | null
  choiceLineKey: string | null
  employmentLines: any[]
  employmentKey: string | null
  ground: any | null
  grid: any | null
  gridWidth: number
  gridHeight: number
  frame: number | null
  resizeObserver: ResizeObserver
  disposeControls: () => void
  controls: {
    target: any
    radius: number
    theta: number
    phi: number
  }
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
}

function resetCamera(runtime: Runtime) {
  runtime.controls.target.set(0, 0, 0)
  runtime.controls.radius = 28
  runtime.controls.theta = Math.PI / 4
  runtime.controls.phi = 0.92
  applyCamera(runtime)
}

function syncGround(runtime: Runtime, state: SimulationState) {
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  if (runtime.gridWidth === width && runtime.gridHeight === height) return

  if (runtime.ground) {
    runtime.scene.remove(runtime.ground)
    disposeObject(runtime.ground)
  }
  if (runtime.grid) {
    runtime.scene.remove(runtime.grid)
    disposeObject(runtime.grid)
  }

  const ground = new runtime.THREE.Mesh(
    new runtime.THREE.PlaneGeometry(width, height),
    new runtime.THREE.MeshStandardMaterial({ color: 0x0d1411, roughness: 0.95, metalness: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  ground.receiveShadow = true
  runtime.scene.add(ground)

  const grid = new runtime.THREE.GridHelper(Math.max(width, height), Math.max(width, height), 0x52605a, 0x27322d)
  grid.position.y = 0.01
  runtime.scene.add(grid)

  runtime.ground = ground
  runtime.grid = grid
  runtime.gridWidth = width
  runtime.gridHeight = height
}

function syncEntities(
  runtime: Runtime,
  state: SimulationState,
  selectedId: string | null,
  territoryIndustry: CompetitiveIndustryId,
  chosenFirmId: string | null,
  employment: EmploymentNetworkObservation | null,
  relationshipMode: RelationshipMode,
) {
  const descriptors = buildWorldEntities(state)
  const liveIds = new Set(descriptors.map(({ id }) => id))

  for (const [id, mesh] of runtime.entities) {
    if (liveIds.has(id)) continue
    runtime.scene.remove(mesh)
    disposeObject(mesh)
    runtime.entities.delete(id)
  }

  for (const descriptor of descriptors) {
    let mesh = runtime.entities.get(descriptor.id)
    if (!mesh) {
      const isHousehold = descriptor.kind === 'household'
      const color = isHousehold
        ? 0xdfff74
        : firmDisplayColor(descriptor.industryId!, descriptor.firmVariant ?? 'a')
      mesh = new runtime.THREE.Mesh(
        new runtime.THREE.BoxGeometry(isHousehold ? 0.46 : 0.82, 1, isHousehold ? 0.46 : 0.82),
        new runtime.THREE.MeshStandardMaterial({
          color,
          roughness: isHousehold ? 0.7 : 0.48,
          metalness: isHousehold ? 0.05 : 0.12,
        }),
      )
      mesh.userData.entityId = descriptor.id
      mesh.userData.kind = descriptor.kind
      mesh.castShadow = true
      mesh.receiveShadow = true
      runtime.scene.add(mesh)
      runtime.entities.set(descriptor.id, mesh)
    }

    const selected = descriptor.id === selectedId
    const chosenFirm = relationshipMode === 'purchases' && descriptor.id === chosenFirmId
    const employmentLinked = relationshipMode === 'employment' && employment !== null
      && (descriptor.id === employment.firmId || employment.workerIds.includes(descriptor.id))
    const territoryFirm = descriptor.kind === 'firm' && descriptor.industryId === territoryIndustry
    const visualHeight = descriptor.height
    const horizontalScale = selected ? 1.22 : employmentLinked ? 1.18 : chosenFirm ? 1.18 : territoryFirm ? 1.1 : 1
    mesh.position.set(descriptor.x, visualHeight / 2, descriptor.z)
    mesh.scale.set(horizontalScale, visualHeight, horizontalScale)
    const entityColor = descriptor.kind === 'firm' && descriptor.industryId
      ? firmDisplayColor(descriptor.industryId, descriptor.firmVariant ?? 'a')
      : 0x78d1a8
    mesh.material.emissive?.setHex(selected ? 0x596528 : employmentLinked ? 0x47735f : chosenFirm ? entityColor : territoryFirm ? entityColor : 0x000000)
    mesh.material.emissiveIntensity = selected ? 0.75 : employmentLinked ? 0.75 : chosenFirm ? 0.8 : territoryFirm ? 0.22 : 0
  }
}

function territoryRenderKey(state: SimulationState, industryId: CompetitiveIndustryId) {
  const firms = state.firms
    .filter((firm) => firm.industryId === industryId && firm.coordinate)
    .sort((a, b) => a.id.localeCompare(b.id))
  return [
    industryId,
    state.config.gridWidth ?? 20,
    state.config.gridHeight ?? 20,
    state.config.transportCostPerTileCents ?? 0,
    ...firms.flatMap((firm) => [firm.id, firm.postedPriceCents, firm.coordinate!.x, firm.coordinate!.y]),
  ].join('|')
}

function clearTerritory(runtime: Runtime) {
  for (const mesh of runtime.territoryMeshes) {
    runtime.scene.remove(mesh)
    disposeObject(mesh)
  }
  runtime.territoryMeshes = []
}

function syncTerritory(runtime: Runtime, state: SimulationState, industryId: CompetitiveIndustryId) {
  const nextKey = territoryRenderKey(state, industryId)
  if (runtime.territoryKey === nextKey) return

  clearTerritory(runtime)
  const territory = buildMarketTerritory(state, industryId)
  const THREE = runtime.THREE

  for (const variant of ['a', 'b'] as const) {
    const cells = territory.cells.filter((cell) => cell.ownerVariant === variant)
    if (!cells.length) continue

    const geometry = new THREE.BoxGeometry(0.94, 0.025, 0.94)
    const material = new THREE.MeshStandardMaterial({
      color: INDUSTRY_COLORS[industryId][variant],
      transparent: true,
      opacity: 0.3,
      roughness: 0.95,
      metalness: 0,
      depthWrite: false,
    })
    const mesh = new THREE.InstancedMesh(geometry, material, cells.length)
    mesh.renderOrder = -1
    const dummy = new THREE.Object3D()
    cells.forEach((cell, index) => {
      dummy.position.set(cell.x, 0.0125, cell.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    runtime.scene.add(mesh)
    runtime.territoryMeshes.push(mesh)
  }

  runtime.territoryKey = nextKey
}

function clearChoiceConnection(runtime: Runtime) {
  if (!runtime.choiceLine) {
    runtime.choiceLineKey = null
    return
  }
  runtime.scene.remove(runtime.choiceLine)
  disposeObject(runtime.choiceLine)
  runtime.choiceLine = null
  runtime.choiceLineKey = null
}

function selectedHouseholdChoice(
  state: SimulationState,
  selectedId: string | null,
  industryId: CompetitiveIndustryId,
): HouseholdChoiceObservation | null {
  if (!selectedId || !state.households.some(({ id }) => id === selectedId)) return null
  return getHouseholdChoiceObservation(state, selectedId, industryId)
}

function syncChoiceConnection(
  runtime: Runtime,
  state: SimulationState,
  selectedId: string | null,
  industryId: CompetitiveIndustryId,
) {
  const choice = selectedHouseholdChoice(state, selectedId, industryId)
  if (!choice?.chosenFirmId) {
    clearChoiceConnection(runtime)
    return
  }

  const householdMesh = runtime.entities.get(choice.householdId)
  const firmMesh = runtime.entities.get(choice.chosenFirmId)
  if (!householdMesh || !firmMesh) {
    clearChoiceConnection(runtime)
    return
  }

  const nextKey = [
    choice.householdId,
    industryId,
    choice.chosenFirmId,
    householdMesh.position.x,
    householdMesh.position.z,
    firmMesh.position.x,
    firmMesh.position.z,
  ].join('|')
  if (runtime.choiceLineKey === nextKey) return

  clearChoiceConnection(runtime)
  const THREE = runtime.THREE
  const start = new THREE.Vector3(householdMesh.position.x, Math.max(0.45, householdMesh.position.y + 0.35), householdMesh.position.z)
  const end = new THREE.Vector3(firmMesh.position.x, Math.max(0.75, firmMesh.position.y + 0.45), firmMesh.position.z)
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end])
  const variant = choice.chosenFirmId.endsWith('-b') ? 'b' : 'a'
  const material = new THREE.LineDashedMaterial({
    color: INDUSTRY_COLORS[industryId][variant],
    dashSize: 0.34,
    gapSize: 0.2,
    transparent: true,
    opacity: 0.95,
  })
  const line = new THREE.Line(geometry, material)
  line.computeLineDistances()
  line.renderOrder = 4
  runtime.scene.add(line)
  runtime.choiceLine = line
  runtime.choiceLineKey = nextKey
}

function clearEmploymentConnections(runtime: Runtime) {
  for (const line of runtime.employmentLines) {
    runtime.scene.remove(line)
    disposeObject(line)
  }
  runtime.employmentLines = []
  runtime.employmentKey = null
}

function selectedEmploymentObservation(
  state: SimulationState,
  selectedId: string | null,
): EmploymentNetworkObservation | null {
  if (!selectedId) return null
  if (!state.households.some(({ id }) => id === selectedId) && !state.firms.some(({ id }) => id === selectedId)) return null
  return getEmploymentNetworkObservation(state, selectedId)
}

function syncEmploymentConnections(
  runtime: Runtime,
  state: SimulationState,
  selectedId: string | null,
) {
  const employment = selectedEmploymentObservation(state, selectedId)
  if (!employment) {
    clearEmploymentConnections(runtime)
    return
  }

  const firmMesh = runtime.entities.get(employment.firmId)
  if (!firmMesh) {
    clearEmploymentConnections(runtime)
    return
  }

  const workerMeshes = employment.workerIds
    .map((workerId) => [workerId, runtime.entities.get(workerId)] as const)
    .filter((entry): entry is readonly [string, any] => Boolean(entry[1]))

  const nextKey = [
    employment.selectedEntityId,
    employment.firmId,
    ...workerMeshes.flatMap(([workerId, mesh]) => [workerId, mesh.position.x, mesh.position.y, mesh.position.z]),
  ].join('|')
  if (runtime.employmentKey === nextKey) return

  clearEmploymentConnections(runtime)
  const THREE = runtime.THREE
  for (const [, workerMesh] of workerMeshes) {
    const start = new THREE.Vector3(firmMesh.position.x, Math.max(0.75, firmMesh.position.y + 0.4), firmMesh.position.z)
    const end = new THREE.Vector3(workerMesh.position.x, Math.max(0.4, workerMesh.position.y + 0.3), workerMesh.position.z)
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end])
    const material = new THREE.LineBasicMaterial({ color: 0x78d1a8, transparent: true, opacity: 0.68 })
    const line = new THREE.Line(geometry, material)
    line.renderOrder = 4
    runtime.scene.add(line)
    runtime.employmentLines.push(line)
  }
  runtime.employmentKey = nextKey
}

function attachCameraControls(runtime: Runtime, onSelect: (id: string | null) => void) {
  const canvas = runtime.renderer.domElement
  const THREE = runtime.THREE
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let dragging = false
  let moved = 0
  let mode: 'orbit' | 'pan' = 'orbit'
  let lastX = 0
  let lastY = 0

  const clampTarget = () => {
    const xBound = Math.max(2, runtime.gridWidth / 2)
    const zBound = Math.max(2, runtime.gridHeight / 2)
    runtime.controls.target.x = Math.max(-xBound, Math.min(xBound, runtime.controls.target.x))
    runtime.controls.target.z = Math.max(-zBound, Math.min(zBound, runtime.controls.target.z))
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 2) return
    dragging = true
    moved = 0
    mode = event.button === 2 || event.shiftKey ? 'pan' : 'orbit'
    lastX = event.clientX
    lastY = event.clientY
    canvas.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    moved += Math.abs(dx) + Math.abs(dy)
    lastX = event.clientX
    lastY = event.clientY

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

  const pickEntity = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, runtime.camera)
    const hit = raycaster.intersectObjects(Array.from(runtime.entities.values()), false)[0]
    onSelect(hit?.object?.userData?.entityId ?? null)
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragging) return
    dragging = false
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (moved < 6 && event.button === 0) pickEntity(event)
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    runtime.controls.radius = Math.max(8, Math.min(62, runtime.controls.radius * Math.exp(event.deltaY * 0.001)))
    applyCamera(runtime)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === '+' || event.key === '=') runtime.controls.radius = Math.max(8, runtime.controls.radius * 0.9)
    else if (event.key === '-') runtime.controls.radius = Math.min(62, runtime.controls.radius * 1.1)
    else if (event.key === 'ArrowLeft') runtime.controls.theta += 0.12
    else if (event.key === 'ArrowRight') runtime.controls.theta -= 0.12
    else if (event.key === 'ArrowUp') runtime.controls.phi = Math.max(0.26, runtime.controls.phi - 0.08)
    else if (event.key === 'ArrowDown') runtime.controls.phi = Math.min(1.46, runtime.controls.phi + 0.08)
    else return
    event.preventDefault()
    applyCamera(runtime)
  }

  const preventMenu = (event: MouseEvent) => event.preventDefault()
  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerup', handlePointerUp)
  canvas.addEventListener('pointercancel', handlePointerUp)
  canvas.addEventListener('wheel', handleWheel, { passive: false })
  canvas.addEventListener('keydown', handleKeyDown)
  canvas.addEventListener('contextmenu', preventMenu)

  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown)
    canvas.removeEventListener('pointermove', handlePointerMove)
    canvas.removeEventListener('pointerup', handlePointerUp)
    canvas.removeEventListener('pointercancel', handlePointerUp)
    canvas.removeEventListener('wheel', handleWheel)
    canvas.removeEventListener('keydown', handleKeyDown)
    canvas.removeEventListener('contextmenu', preventMenu)
  }
}

function displayMoney(cents: number) {
  return (cents / 100).toLocaleString('en-GB', { style: 'currency', currency: 'USD' })
}

function HouseholdDetails({ household }: { household: SimulationState['households'][number] }) {
  return <dl className="world-inspector-data">
    <div><dt>Coordinate</dt><dd>({household.coordinate.x}, {household.coordinate.y})</dd></div>
    <div><dt>Current cash</dt><dd>{displayMoney(household.postFiscalCashCents)}</dd></div>
    <div><dt>Employer</dt><dd>{household.employerFirmId.replace('firm-', '')}</dd></div>
    <div><dt>Contractual wage</dt><dd>{displayMoney(household.contractualWageTodayCents)}</dd></div>
    <div><dt>Wage paid today</dt><dd>{displayMoney(household.wageTodayCents)}</dd></div>
    <div><dt>Unpaid wage</dt><dd>{displayMoney(household.unpaidWageTodayCents)}</dd></div>
    <div><dt>Cumulative wages</dt><dd>{displayMoney(household.cumulativeWagesCents)}</dd></div>
    <div><dt>Tax today</dt><dd>{displayMoney(household.taxPaidTodayCents)}</dd></div>
    <div><dt>Transfer today</dt><dd>{displayMoney(household.transferReceivedTodayCents)}</dd></div>
  </dl>
}

function FirmDetails({ firm }: { firm: SimulationState['firms'][number] }) {
  return <dl className="world-inspector-data">
    <div><dt>Industry</dt><dd>{firm.industryId}</dd></div>
    <div><dt>Coordinate</dt><dd>{firm.coordinate ? `(${firm.coordinate.x}, ${firm.coordinate.y})` : '—'}</dd></div>
    <div><dt>Posted price</dt><dd>{displayMoney(firm.postedPriceCents)}</dd></div>
    <div><dt>Employees</dt><dd>{firm.employeeIds.length}</dd></div>
    <div><dt>Productivity / worker</dt><dd>{firm.productivityPerWorker ?? 'Service capacity unconstrained'}</dd></div>
    <div><dt>Units produced today</dt><dd>{firm.industryId === 'transport' ? '—' : firm.unitsProducedToday}</dd></div>
    <div><dt>Contractual payroll</dt><dd>{displayMoney(firm.contractualPayrollTodayCents)}</dd></div>
    <div><dt>Wages paid</dt><dd>{displayMoney(firm.wagesPaidTodayCents)}</dd></div>
    <div><dt>Unpaid wages</dt><dd>{displayMoney(firm.unpaidWagesTodayCents)}</dd></div>
    <div><dt>Payroll fulfilled</dt><dd>{(firm.payrollFulfillmentRate * 100).toFixed(1)}%</dd></div>
    <div><dt>Mean wage</dt><dd>{displayMoney(firm.meanWageTodayCents)}</dd></div>
    <div><dt>Residual profit</dt><dd>{displayMoney(firm.residualProfitTodayCents)}</dd></div>
  </dl>
}

function EmploymentDetails({
  state,
  employment,
  selectedFirm,
  selectedHousehold,
  onSelect,
}: {
  state: SimulationState
  employment: EmploymentNetworkObservation
  selectedFirm: SimulationState['firms'][number] | null
  selectedHousehold: SimulationState['households'][number] | null
  onSelect: (id: string) => void
}) {
  const employer = state.firms.find(({ id }) => id === employment.firmId)!
  return <section className="employment-inspector">
    <div className="choice-heading">
      <span>Employment network</span>
      <strong className="employment-count">{selectedFirm ? `${employment.workerIds.length} workers` : 'Employer link'}</strong>
    </div>
    <p className="choice-note">
      {selectedFirm
        ? `${employer.id.replace('firm-', '')} is connected to its authoritative employeeIds. Select a worker to inspect that household.`
        : `${selectedHousehold?.id.replace('household-', 'Household ')} is connected only to its authoritative employer, ${employer.id.replace('firm-', '')}.`}
    </p>
    {selectedFirm && <div className="employment-workers" aria-label={`Workers employed by ${selectedFirm.id}`}>
      {employment.workerIds.map((workerId) => {
        const worker = state.households.find(({ id }) => id === workerId)!
        return <button type="button" key={workerId} onClick={() => onSelect(workerId)}>
          <strong>{workerId.replace('household-', 'H')}</strong>
          <span>{displayMoney(worker.wageTodayCents)} wage</span>
          <small>{displayMoney(worker.postFiscalCashCents)} cash</small>
        </button>
      })}
    </div>}
    <p className="choice-note">Green lines are schematic employment relationships, not commuting or travel routes.</p>
  </section>
}

function choiceOutcomeLabel(outcome: HouseholdChoiceObservation['outcome']) {
  if (outcome === 'purchased') return 'Purchased'
  if (outcome === 'insufficient_funds') return 'Insufficient funds'
  if (outcome === 'stockout') return 'Stockout'
  return 'Not processed'
}

function formatChoiceMoney(cents: number | null) {
  return cents === null ? '—' : displayMoney(cents)
}

function HouseholdChoiceDetails({
  choice,
  choices,
  industryId,
  onIndustryChange,
}: {
  choice: HouseholdChoiceObservation
  choices: HouseholdChoiceObservation[]
  industryId: CompetitiveIndustryId
  onIndustryChange: (industryId: CompetitiveIndustryId) => void
}) {
  const industry = COMPETITIVE_INDUSTRIES.find(({ id }) => id === industryId)!
  return <section className="household-choice-inspector">
    <div className="choice-tabs" aria-label="Household industry choices">
      {COMPETITIVE_INDUSTRIES.map(({ id, label }) => {
        const observation = choices.find((candidate) => candidate.industryId === id)!
        return <button
          type="button"
          key={id}
          className={industryId === id ? 'active' : ''}
          aria-pressed={industryId === id}
          onClick={() => onIndustryChange(id)}
        >
          <span>{label}</span>
          <small>{choiceOutcomeLabel(observation.outcome)}</small>
        </button>
      })}
    </div>
    <div className="choice-heading">
      <span>{industry.label} · Day outcome</span>
      <strong className={`choice-outcome choice-outcome--${choice.outcome}`}>{choiceOutcomeLabel(choice.outcome)}</strong>
    </div>
    <dl className="world-inspector-data">
      <div><dt>Chosen firm</dt><dd>{choice.chosenFirmId?.replace('firm-', '') ?? 'None'}</dd></div>
      <div><dt>Product price</dt><dd>{formatChoiceMoney(choice.productPriceCents)}</dd></div>
      <div><dt>One-way distance</dt><dd>{choice.oneWayDistance === null ? '—' : `${choice.oneWayDistance} tiles`}</dd></div>
      <div><dt>Round trip</dt><dd>{choice.roundTripTiles === null ? '—' : `${choice.roundTripTiles} tiles`}</dd></div>
      <div><dt>Transport fee</dt><dd>{formatChoiceMoney(choice.transportFeeCents)}</dd></div>
      <div><dt>Delivered cost</dt><dd>{formatChoiceMoney(choice.deliveredCostCents)}</dd></div>
      <div><dt>Distance to Firm A</dt><dd>{choice.distanceToA === null ? '—' : `${choice.distanceToA} tiles`}</dd></div>
      <div><dt>Distance to Firm B</dt><dd>{choice.distanceToB === null ? '—' : `${choice.distanceToB} tiles`}</dd></div>
    </dl>
    {choice.chosenFirmId
      ? <p className="choice-note">Dashed line = schematic household-to-supplier relationship. It is not a simulated travel route.</p>
      : <p className="choice-note">No supplier link is drawn because this household did not purchase in this industry on the presented day.</p>}
  </section>
}


export function WorldView({ state }: { state: SimulationState }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<Runtime | null>(null)
  const stateRef = useRef(state)
  const selectedIdRef = useRef<string | null>(null)
  const territoryIndustryRef = useRef<CompetitiveIndustryId>('food')
  const choiceIndustryRef = useRef<CompetitiveIndustryId>('food')
  const relationshipModeRef = useRef<RelationshipMode>('purchases')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [territoryIndustry, setTerritoryIndustry] = useState<CompetitiveIndustryId>('food')
  const [choiceIndustry, setChoiceIndustry] = useState<CompetitiveIndustryId>('food')
  const [relationshipMode, setRelationshipMode] = useState<RelationshipMode>('purchases')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  stateRef.current = state
  selectedIdRef.current = selectedId
  territoryIndustryRef.current = territoryIndustry
  choiceIndustryRef.current = choiceIndustry
  relationshipModeRef.current = relationshipMode

  const worldFirms = useMemo(() => state.firms.filter((firm) => firm.coordinate), [state.firms])
  const selectedHousehold = selectedId ? state.households.find(({ id }) => id === selectedId) ?? null : null
  const selectedFirm = selectedId ? worldFirms.find(({ id }) => id === selectedId) ?? null : null
  const selectedChoice = useMemo(
    () => selectedHousehold ? getHouseholdChoiceObservation(state, selectedHousehold.id, choiceIndustry) : null,
    [state, selectedHousehold, choiceIndustry],
  )
  const allSelectedChoices = useMemo(
    () => selectedHousehold ? COMPETITIVE_INDUSTRIES.map(({ id }) => getHouseholdChoiceObservation(state, selectedHousehold.id, id)) : [],
    [state, selectedHousehold],
  )
  const territory = useMemo(() => buildMarketTerritory(state, territoryIndustry), [state, territoryIndustry])
  const territoryFirms = useMemo(() => worldFirms.filter((firm) => firm.industryId === territoryIndustry).sort((a, b) => a.id.localeCompare(b.id)), [worldFirms, territoryIndustry])
  const employment = useMemo(
    () => relationshipMode === 'employment' && selectedId ? selectedEmploymentObservation(state, selectedId) : null,
    [state, selectedId, relationshipMode],
  )

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let cancelled = false

    const initialize = async () => {
      try {
        const THREE = await import(/* @vite-ignore */ THREE_MODULE_URL)
        if (cancelled) return

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0f0d)
        scene.fog = new THREE.Fog(0x0a0f0d, 28, 72)

        const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 160)
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.domElement.tabIndex = 0
        renderer.domElement.setAttribute('aria-label', '3D Econ Engine world. Drag to orbit, Shift-drag or right-drag to pan, and use the mouse wheel or plus and minus keys to zoom.')
        mount.appendChild(renderer.domElement)

        const ambient = new THREE.HemisphereLight(0xdcece4, 0x1c211f, 1.55)
        scene.add(ambient)
        const key = new THREE.DirectionalLight(0xffffff, 2.4)
        key.position.set(10, 20, 8)
        key.castShadow = true
        key.shadow.mapSize.set(1024, 1024)
        scene.add(key)

        const runtime: Runtime = {
          THREE,
          scene,
          camera,
          renderer,
          entities: new Map<string, any>(),
          territoryMeshes: [],
          territoryKey: null,
          choiceLine: null,
          choiceLineKey: null,
          employmentLines: [],
          employmentKey: null,
          ground: null,
          grid: null,
          gridWidth: 0,
          gridHeight: 0,
          frame: null,
          resizeObserver: null as unknown as ResizeObserver,
          disposeControls: () => {},
          controls: {
            target: new THREE.Vector3(0, 0, 0),
            radius: 28,
            theta: Math.PI / 4,
            phi: 0.92,
          },
        }

        const resize = () => {
          const width = Math.max(1, mount.clientWidth)
          const height = Math.max(320, mount.clientHeight)
          renderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
        }
        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(mount)
        runtime.resizeObserver = resizeObserver
        runtime.disposeControls = attachCameraControls(runtime, setSelectedId)
        runtimeRef.current = runtime

        syncGround(runtime, stateRef.current)
        syncTerritory(runtime, stateRef.current, territoryIndustryRef.current)
        const initialChoice = relationshipModeRef.current === 'purchases'
          ? selectedHouseholdChoice(stateRef.current, selectedIdRef.current, choiceIndustryRef.current)
          : null
        const initialEmployment = relationshipModeRef.current === 'employment'
          ? selectedEmploymentObservation(stateRef.current, selectedIdRef.current)
          : null
        syncEntities(runtime, stateRef.current, selectedIdRef.current, territoryIndustryRef.current, initialChoice?.chosenFirmId ?? null, initialEmployment, relationshipModeRef.current)
        if (relationshipModeRef.current === 'purchases') syncChoiceConnection(runtime, stateRef.current, selectedIdRef.current, choiceIndustryRef.current)
        else syncEmploymentConnections(runtime, stateRef.current, selectedIdRef.current)
        resetCamera(runtime)
        resize()

        const render = () => {
          renderer.render(scene, camera)
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
      clearChoiceConnection(runtime)
      clearEmploymentConnections(runtime)
      clearTerritory(runtime)
      for (const mesh of runtime.entities.values()) {
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
    const choice = relationshipMode === 'purchases' ? selectedHouseholdChoice(state, selectedId, choiceIndustry) : null
    const employmentObservation = relationshipMode === 'employment' ? selectedEmploymentObservation(state, selectedId) : null
    syncGround(runtime, state)
    syncTerritory(runtime, state, territoryIndustry)
    syncEntities(runtime, state, selectedId, territoryIndustry, choice?.chosenFirmId ?? null, employmentObservation, relationshipMode)
    if (relationshipMode === 'purchases') {
      clearEmploymentConnections(runtime)
      syncChoiceConnection(runtime, state, selectedId, choiceIndustry)
    } else {
      clearChoiceConnection(runtime)
      syncEmploymentConnections(runtime, state, selectedId)
    }
  }, [state, selectedId, territoryIndustry, choiceIndustry, relationshipMode])

  const selectedLabel = selectedHousehold
    ? selectedHousehold.id.replace('household-', 'Household ')
    : selectedFirm
      ? selectedFirm.id.replace('firm-', '').replaceAll('-', ' ')
      : 'No entity selected'

  return <section className="panel world-panel">
    <div className="panel-heading world-heading">
      <div><h2>3D Econ Engine World View</h2><p>{state.households.length} households · {worldFirms.length} employers · 8 consumer competitors + Transport · household height encodes current cash</p></div>
      <div className="world-actions">
        <label>Relationship overlay<select aria-label="Relationship overlay" value={relationshipMode} onChange={(event) => setRelationshipMode(event.target.value as RelationshipMode)}>
          <option value="purchases">Household choices</option>
          <option value="employment">Employment network</option>
        </select></label>
        <label>Market territory<select aria-label="Market territory industry" value={territoryIndustry} onChange={(event) => setTerritoryIndustry(event.target.value as CompetitiveIndustryId)}>
          {COMPETITIVE_INDUSTRIES.map((industry) => <option key={industry.id} value={industry.id}>{industry.label}</option>)}
        </select></label>
        <label>Inspect entity<select aria-label="Inspect world entity" value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value || null)}>
          <option value="">None</option>
          <optgroup label="Firms">{worldFirms.map((firm) => <option key={firm.id} value={firm.id}>{firm.id.replace('firm-', '')}</option>)}</optgroup>
          <optgroup label="Households">{state.households.map((household) => <option key={household.id} value={household.id}>{household.id.replace('household-', 'Household ')}</option>)}</optgroup>
        </select></label>
        <button type="button" onClick={() => runtimeRef.current && resetCamera(runtimeRef.current)} disabled={status !== 'ready'}>Reset camera</button>
      </div>
    </div>

    <div className="world-layout">
      <div>
        <div className="world-canvas" data-status={status} role="group" aria-label="Interactive three-dimensional view of the current Econ Engine spatial economy">
          <div ref={mountRef} className="world-canvas-mount" />
          {status === 'loading' && <div className="world-status">Loading Three.js world…</div>}
          {status === 'error' && <div className="world-status world-status--error">3D renderer unavailable. Entity inspection remains available.</div>}
        </div>
        <div className="world-legend" aria-label="World legend">
          <span><i className="world-swatch household" />Households · height = cash</span>
          {relationshipMode === 'employment' && <span><i className="world-swatch transport" />Employment links · Transport employer included</span>}
          {territoryFirms.map((firm, index) => {
            const variant = index === 0 ? 'a' : 'b'
            const count = territory.cellCounts[firm.id] ?? 0
            return <span key={firm.id}><i className="world-swatch" style={{ background: `#${INDUSTRY_COLORS[territoryIndustry][variant].toString(16).padStart(6, '0')}` }} />{COMPETITIVE_INDUSTRIES.find(({ id }) => id === territoryIndustry)?.label} Firm {variant.toUpperCase()} · {count} cells · {(firm.postedPriceCents / 100).toLocaleString('en-GB', { style: 'currency', currency: 'USD' })}</span>
          })}
        </div>
        <p className="world-help">Territory = lowest posted price + round-trip Manhattan transport cost at each grid cell. Exact ties go to the lexicographically earlier firm ID (Firm A in the canonical economy); this is observer-only. {territory.tieCount} tied cell{territory.tieCount === 1 ? '' : 's'} currently.</p>
        <p className="world-help">Drag to orbit · Shift-drag/right-drag to pan · wheel or +/- to zoom · click a pillar/building to inspect.</p>
      </div>

      <aside className="world-inspector" aria-live="polite">
        <span className="eyebrow">Selected entity</span>
        <h3>{selectedLabel}</h3>
        {selectedHousehold && <HouseholdDetails household={selectedHousehold} />}
        {relationshipMode === 'purchases' && selectedHousehold && selectedChoice && <HouseholdChoiceDetails choice={selectedChoice} choices={allSelectedChoices} industryId={choiceIndustry} onIndustryChange={setChoiceIndustry} />}
        {selectedFirm && <FirmDetails firm={selectedFirm} />}
        {relationshipMode === 'employment' && employment && <EmploymentDetails state={state} employment={employment} selectedFirm={selectedFirm} selectedHousehold={selectedHousehold} onSelect={setSelectedId} />}
        {!selectedHousehold && !selectedFirm && <p>Select a household or firm in the world or from the entity selector. The renderer reads the current presented simulation snapshot only.</p>}
      </aside>
    </div>
  </section>
}
