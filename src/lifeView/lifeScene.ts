import type { Group, Mesh, MeshStandardMaterial } from 'three'
import type { LifeState } from '../life/types'
import { hex, palette } from '../ui/theme'
import {
  bushScale,
  daylightAt,
  displayedStock,
  displayHours,
  foragerPose,
  sunAt,
  type DisplayPair,
} from './lifeViewModel'

type Three = typeof import('three')

const NIGHT_SKY = 0x070a12
const DAY_SKY = 0x6f97ab
const LUSH = 0x3f8f4a
const BARE = 0x7a6440
const GRASS = 0x2f5a35
const GRASS_EDGE = 0x24432a
const FORAGER_OFFSET = 0.3

export interface LifeScene {
  /** Rebuilds the board and bushes for a new run. */
  setWorld(state: LifeState): void
  draw(pair: DisplayPair, options: { interpolate: boolean; selectedPatchId: number | null; nowMs: number }): void
  dispose(): void
}

interface Bush {
  group: Group
  material: MeshStandardMaterial
}

/** Builds the scene inside `mount`. The caller drives drawing; nothing renders until `draw` is called. */
export async function createLifeScene(
  mount: HTMLElement,
  onSelectPatch: (patchId: number | null) => void,
): Promise<LifeScene> {
  const THREE: Three = await import('three')
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(NIGHT_SKY)
  scene.fog = new THREE.Fog(NIGHT_SKY, 30, 70)
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.tabIndex = 0
  renderer.domElement.setAttribute(
    'aria-label',
    'The forager’s world. Drag to orbit, scroll to zoom, click a bush to inspect its patch.',
  )
  mount.appendChild(renderer.domElement)

  const hemisphere = new THREE.HemisphereLight(0xdfe9e4, 0x161b19, 1)
  scene.add(hemisphere)
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)
  const moon = new THREE.DirectionalLight(0x8aa4ff, 0)
  moon.position.set(-6, 10, -4)
  scene.add(moon)

  const world = new THREE.Group()
  scene.add(world)
  let bushes: Bush[] = []
  let ground: Mesh | null = null
  let gridLines: InstanceType<Three['LineSegments']> | null = null
  let gridWidth = 1
  let gridHeight = 1
  const toWorld = (x: number, y: number) => ({ x: x - (gridWidth - 1) / 2, z: y - (gridHeight - 1) / 2 })

  // Shared geometry: every bush is three leafy lobes; the forager is a capsule and a head.
  const lobe = new THREE.IcosahedronGeometry(0.3, 1)
  const ringGeometry = new THREE.RingGeometry(0.42, 0.5, 40)
  const targetRing = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.85 }),
  )
  targetRing.rotation.x = -Math.PI / 2
  const selectRing = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
  )
  selectRing.rotation.x = -Math.PI / 2
  selectRing.scale.setScalar(1.15)
  scene.add(targetRing, selectRing)

  const forager = new THREE.Group()
  const body = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: hex(palette.household), roughness: 0.7 })
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.36, 4, 10), skin)
  torso.position.y = 0.33
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin)
  head.position.y = 0.68
  for (const part of [torso, head]) part.castShadow = true
  body.add(torso, head)
  forager.add(body)
  scene.add(forager)

  function clearWorld() {
    for (const bush of bushes) {
      bush.material.dispose()
      world.remove(bush.group)
    }
    bushes = []
    if (ground) {
      ground.geometry.dispose()
      ;(ground.material as MeshStandardMaterial).dispose()
      world.remove(ground)
      ground = null
    }
    if (gridLines) {
      gridLines.geometry.dispose()
      ;(gridLines.material as InstanceType<Three['LineBasicMaterial']>).dispose()
      world.remove(gridLines)
      gridLines = null
    }
  }

  // The distance that frames the board in a landscape window, times a zoom the wheel changes.
  const controls = { baseRadius: 22, zoom: 1, theta: Math.PI / 4, phi: 0.95 }
  /** A tall, narrow window needs the camera further back to fit the board across its width. */
  const aspectFit = () => (camera.aspect < 1.2 ? (1.2 / camera.aspect) ** 0.75 : 1)
  const applyCamera = () => {
    const radius = controls.baseRadius * controls.zoom * aspectFit()
    const sinPhi = Math.sin(controls.phi)
    camera.position.set(
      radius * sinPhi * Math.sin(controls.theta),
      radius * Math.cos(controls.phi),
      radius * sinPhi * Math.cos(controls.theta),
    )
    camera.lookAt(0, 0, 0)
  }

  function setWorld(state: LifeState) {
    clearWorld()
    gridWidth = state.config.gridWidth
    gridHeight = state.config.gridHeight
    const margin = 1
    ground = new THREE.Mesh(
      new THREE.BoxGeometry(gridWidth + margin * 2, 0.4, gridHeight + margin * 2),
      new THREE.MeshStandardMaterial({ color: GRASS, roughness: 0.95 }),
    )
    ground.position.y = -0.2
    ground.receiveShadow = true
    world.add(ground)

    const points: number[] = []
    const halfW = gridWidth / 2
    const halfH = gridHeight / 2
    for (let x = 0; x <= gridWidth; x += 1) points.push(x - halfW, 0.005, -halfH, x - halfW, 0.005, halfH)
    for (let y = 0; y <= gridHeight; y += 1) points.push(-halfW, 0.005, y - halfH, halfW, 0.005, y - halfH)
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    gridLines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: GRASS_EDGE, transparent: true, opacity: 0.6 }),
    )
    world.add(gridLines)

    for (const patch of state.patches) {
      const material = new THREE.MeshStandardMaterial({ color: LUSH, roughness: 0.8, flatShading: true })
      const group = new THREE.Group()
      const offsets: [number, number, number][] = [
        [0, 0.28, 0],
        [0.22, 0.2, 0.1],
        [-0.17, 0.18, -0.14],
      ]
      for (const [x, y, z] of offsets) {
        const mesh = new THREE.Mesh(lobe, material)
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        mesh.userData.patchId = patch.id
        group.add(mesh)
      }
      const { x, z } = toWorld(patch.tile.x, patch.tile.y)
      group.position.set(x, 0, z)
      group.userData.patchId = patch.id
      world.add(group)
      bushes.push({ group, material })
    }

    const extent = Math.max(gridWidth, gridHeight)
    controls.baseRadius = Math.max(6, extent * 1.3 + 3)
    controls.zoom = 1
    scene.fog = new THREE.Fog(NIGHT_SKY, controls.baseRadius * 1.4, controls.baseRadius * 5)
    const shadowSpan = extent / 2 + 2
    Object.assign(sun.shadow.camera, {
      left: -shadowSpan,
      right: shadowSpan,
      top: shadowSpan,
      bottom: -shadowSpan,
      near: 0.5,
      far: extent * 4 + 20,
    })
    sun.shadow.camera.updateProjectionMatrix()
    applyCamera()
  }

  const night = new THREE.Color(NIGHT_SKY)
  const day = new THREE.Color(DAY_SKY)
  const sky = new THREE.Color()
  const lush = new THREE.Color(LUSH)
  const bare = new THREE.Color(BARE)

  function draw(
    pair: DisplayPair,
    { interpolate, selectedPatchId, nowMs }: { interpolate: boolean; selectedPatchId: number | null; nowMs: number },
  ) {
    const { config } = pair.next
    const hours = interpolate ? displayHours(pair) : pair.next.tick
    const hourOfDay = hours % 24
    const light = daylightAt(hourOfDay, config.dawnHour, config.duskHour)
    const { elevation, azimuth } = sunAt(hourOfDay, config.dawnHour, config.duskHour)

    sky.copy(night).lerp(day, light)
    ;(scene.background as InstanceType<Three['Color']>).copy(sky)
    ;(scene.fog as InstanceType<Three['Fog']>).color.copy(sky)
    hemisphere.intensity = 0.35 + 1.15 * light
    const extent = Math.max(gridWidth, gridHeight)
    sun.position.set(azimuth * extent * 1.2, Math.max(0.15, elevation) * extent * 1.5 + 2, extent * 0.5)
    sun.intensity = 2.4 * light * Math.max(0.2, elevation)
    sun.color.setHSL(0.1, 0.6, 0.6 + 0.35 * Math.max(0, elevation))
    moon.intensity = 0.35 * (1 - light)

    for (const [id, bush] of bushes.entries()) {
      const stock = displayedStock(pair, id, interpolate)
      bush.group.scale.setScalar(bushScale(stock, config.patchCapacityKcal))
      bush.material.color.copy(bare).lerp(lush, Math.min(1, stock / config.patchCapacityKcal) ** 0.6)
    }

    const pose = foragerPose(pair, interpolate)
    const position = toWorld(pose.x, pose.y)
    const bob = pose.walking ? Math.abs(Math.sin(nowMs / 110)) * 0.04 : 0
    // Drawn a little off its tile's centre, so it stands beside a bush rather than inside it.
    forager.position.set(position.x + FORAGER_OFFSET, bob, position.z + FORAGER_OFFSET)
    if (pose.heading !== null) forager.rotation.y = pose.heading
    // Lying down tips the body over at the feet.
    body.rotation.x = (-Math.PI / 2) * pose.lying
    body.position.y = 0.14 * pose.lying
    skin.color.set(pair.next.forager.alive ? hex(palette.household) : 0x6b6b66)

    const target = pair.next.forager.targetPatchId
    targetRing.visible = target !== null && pair.next.forager.alive
    if (target !== null) {
      const tile = pair.next.patches[target]!.tile
      const at = toWorld(tile.x, tile.y)
      targetRing.position.set(at.x, 0.02, at.z)
    }
    selectRing.visible = selectedPatchId !== null && bushes[selectedPatchId] !== undefined
    if (selectedPatchId !== null && pair.next.patches[selectedPatchId]) {
      const tile = pair.next.patches[selectedPatchId]!.tile
      const at = toWorld(tile.x, tile.y)
      selectRing.position.set(at.x, 0.015, at.z)
    }
    renderer.render(scene, camera)
  }

  // Orbit by dragging, zoom with the wheel, click a bush to select its patch.
  const canvas = renderer.domElement
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let dragging = false
  let moved = 0
  let lastX = 0
  let lastY = 0
  const onPointerDown = (event: PointerEvent) => {
    dragging = true
    moved = 0
    lastX = event.clientX
    lastY = event.clientY
    canvas.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    moved += Math.abs(dx) + Math.abs(dy)
    lastX = event.clientX
    lastY = event.clientY
    controls.theta -= dx * 0.008
    controls.phi = Math.min(1.45, Math.max(0.2, controls.phi - dy * 0.006))
    applyCamera()
  }
  const onPointerUp = (event: PointerEvent) => {
    if (!dragging) return
    dragging = false
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (moved > 5) return
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(
      bushes.map((bush) => bush.group),
      true,
    )[0]
    onSelectPatch((hit?.object.userData.patchId as number | undefined) ?? null)
  }
  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    controls.zoom = Math.min(3, Math.max(0.2, controls.zoom * Math.exp(event.deltaY * 0.001)))
    applyCamera()
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.style.cursor = 'grab'
  canvas.style.touchAction = 'none'

  const resize = () => {
    const width = Math.max(1, mount.clientWidth)
    const height = Math.max(1, mount.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    applyCamera()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(mount)
  resize()
  applyCamera()

  return {
    setWorld,
    draw,
    dispose() {
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      clearWorld()
      lobe.dispose()
      ringGeometry.dispose()
      ;(targetRing.material as InstanceType<Three['MeshBasicMaterial']>).dispose()
      ;(selectRing.material as InstanceType<Three['MeshBasicMaterial']>).dispose()
      torso.geometry.dispose()
      head.geometry.dispose()
      skin.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
