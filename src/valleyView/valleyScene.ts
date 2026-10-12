import type { Group, InstancedMesh, LineLoop, Mesh, MeshStandardMaterial, PerspectiveCamera } from 'three'
import { woodTarget } from '../valley/trade'
import type { ValleyState } from '../valley/types'
import { hex, palette } from '../ui/theme'
import {
  BERRIES_PER_BUSH,
  closeTilt,
  CAMERA_LIMITS,
  LOGS_PER_PILE,
  arcPoint,
  bundleScale,
  clampDistance,
  clampTarget,
  currentEvent,
  currentSwaps,
  daylightAt,
  displayMinutes,
  displayedLoad,
  displayedStock,
  fillInTurn,
  foragerColor,
  foragerPose,
  hearthAt,
  parcelScale,
  plantLook,
  sunAt,
  toMetres,
  type DisplayPair,
  type ForagerPose,
} from './valleyViewModel'

type Three = typeof import('three')

const NIGHT_SKY = 0x070a12
const DAY_SKY = 0x7fa6b8
const GRASS = 0x3b6b3e
const OUTSIDE = 0x2c4a30
const GRID = 0x355f39
const LEAF = 0x2f7a3c
const BERRY = 0xc8243f
const TRUNK = 0x5a3d26
const CROWN = 0x2a6236
const DEADWOOD = 0x8a6a48
const STONE = 0x6f6a60
const FLAME = 0xffa040
const EMBER = 0x3a3330
const BUNDLE = 0xb07a45
const DEAD = 0x6b6b66
const SKIN = 0xc79a74
/** Points along each swap's arc. */
const ARC_POINTS = 24
/** Grid lines every this many metres, so distances can be judged at any zoom. */
const GRID_STEP_M = 50

/** What a click picked out: a bush or tree to inspect, or a forager to follow. */
export type ValleyPick = { kind: 'bush' | 'tree'; id: number } | { kind: 'forager'; id: number }
export type ValleyPlant = { kind: 'bush' | 'tree'; id: number }

export interface DrawOptions {
  interpolate: boolean
  selected: ValleyPlant | null
  followedId: number
  /** The camera keeps the followed forager in the middle of the view. */
  following: boolean
  nowMs: number
  elapsedSeconds: number
}

export interface ValleyScene {
  /** Rebuilds the valley, its plants and its band for a new run. */
  setWorld(state: ValleyState): void
  draw(pair: DisplayPair, options: DrawOptions): void
  dispose(): void
}

/** A bush's three leafy lobes: offset across, height and offset along, and radius, in metres. */
const BUSH_LOBES: [number, number, number, number][] = [
  [0, 0.62, 0, 0.6],
  [0.42, 0.48, 0.25, 0.45],
  [-0.38, 0.45, -0.3, 0.42],
]
const BERRY_RADIUS = 0.06
/** A tree's trunk height, and its two crown cones: height of each centre, radius and height. */
const TRUNK_HEIGHT = 5.5
const CROWN_CONES: [number, number, number][] = [
  [6.2, 2.4, 5.2],
  [8.8, 1.7, 4],
]

interface Figure {
  root: Group
  body: Group
  hips: Group
  torso: Group
  legs: [Group, Group]
  arms: [Group, Group]
  material: MeshStandardMaterial
  bundle: Group
  parcel: Mesh
  heading: number
}

interface Hearth {
  group: Group
  flame: Mesh
  /** The wood its forager holds beyond what it carries on its back. */
  pile: Group
}

interface SwapArc {
  line: InstanceType<Three['Line']>
  wood: Mesh
  food: Mesh
}

export interface SceneCallbacks {
  onPick(pick: ValleyPick | null): void
  /** The viewer moved the camera by hand, which stops it following a forager. */
  onPan(): void
}

/** Builds the scene inside `mount`. The caller drives drawing; nothing renders until `draw` is called. */
export async function createValleyScene(mount: HTMLElement, callbacks: SceneCallbacks): Promise<ValleyScene> {
  const THREE: Three = await import('three')
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(NIGHT_SKY)
  scene.fog = new THREE.Fog(NIGHT_SKY, 400, 2_000)
  const camera: PerspectiveCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 5_000)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.tabIndex = 0
  renderer.domElement.setAttribute(
    'aria-label',
    'The valley. Drag or use the arrow keys to pan, scroll or pinch to zoom, right-drag or Q and E to rotate; click a bush or tree to inspect it, or a forager to follow it.',
  )
  mount.appendChild(renderer.domElement)

  const hemisphere = new THREE.HemisphereLight(0xdfe9e4, 0x161b19, 1)
  scene.add(hemisphere)
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.04
  scene.add(sun, sun.target)
  const moon = new THREE.DirectionalLight(0x8aa4ff, 0)
  moon.position.set(-300, 600, -200)
  scene.add(moon)

  const world = new THREE.Group()
  scene.add(world)
  let config: ValleyState['config'] | null = null
  let layout: ValleyState['layout'] | null = null
  const at = (x: number, y: number) => toMetres(config!, x, y)

  // Shared geometry and materials.
  const leafGeometry = new THREE.IcosahedronGeometry(1, 1)
  const leafMaterial = new THREE.MeshStandardMaterial({ color: LEAF, roughness: 0.85, flatShading: true })
  const berryGeometry = new THREE.IcosahedronGeometry(1, 0)
  const berryMaterial = new THREE.MeshStandardMaterial({ color: BERRY, roughness: 0.4 })
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.26, 1, 7)
  trunkGeometry.translate(0, 0.5, 0)
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 1, flatShading: true })
  const crownGeometry = new THREE.ConeGeometry(1, 1, 8)
  const crownMaterial = new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.85, flatShading: true })
  const logGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1, 6)
  logGeometry.rotateZ(Math.PI / 2)
  const deadwoodMaterial = new THREE.MeshStandardMaterial({ color: DEADWOOD, roughness: 0.95, flatShading: true })
  const stoneGeometry = new THREE.DodecahedronGeometry(0.12, 0)
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: STONE, roughness: 1, flatShading: true })
  const emberMaterial = new THREE.MeshStandardMaterial({ color: EMBER, roughness: 1, flatShading: true })
  const flameGeometry = new THREE.ConeGeometry(0.18, 0.5, 7)
  const flameMaterial = new THREE.MeshStandardMaterial({
    color: FLAME,
    emissive: FLAME,
    emissiveIntensity: 1.6,
    roughness: 0.6,
  })
  const ringGeometry = new THREE.RingGeometry(0.9, 1, 48)
  const legGeometry = new THREE.CapsuleGeometry(0.075, 0.72, 4, 8)
  legGeometry.translate(0, -0.43, 0)
  const armGeometry = new THREE.CapsuleGeometry(0.055, 0.5, 4, 8)
  armGeometry.translate(0, -0.3, 0)
  const torsoGeometry = new THREE.CapsuleGeometry(0.16, 0.38, 4, 10)
  torsoGeometry.translate(0, 0.33, 0)
  const headGeometry = new THREE.SphereGeometry(0.115, 16, 12)
  const skinMaterial = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 })
  const bundleLogGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.75, 6)
  const bundleMaterial = new THREE.MeshStandardMaterial({ color: BUNDLE, roughness: 0.9, flatShading: true })
  const parcelGeometry = new THREE.DodecahedronGeometry(0.12, 0)

  const matrix = new THREE.Matrix4()
  const scale = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const yAxis = new THREE.Vector3(0, 1, 0)

  let ground: Mesh | null = null
  let outside: Mesh | null = null
  let grid: InstanceType<Three['LineSegments']> | null = null
  let leaves: InstancedMesh | null = null
  let berryMesh: InstancedMesh | null = null
  let trunks: InstancedMesh | null = null
  let crowns: InstancedMesh | null = null
  let logs: InstancedMesh | null = null
  let campGroup: Group | null = null
  let campFlame: Mesh | null = null
  let campGlow: InstanceType<Three['PointLight']> | null = null
  let hearths: Hearth[] = []
  let figures: Figure[] = []
  /** The fill last drawn for each bush and tree, so only plants that changed are redrawn. */
  let bushFill = new Float32Array(0)
  let treeFill = new Float32Array(0)
  const band = new THREE.Group()
  scene.add(band)

  const accentRing = (opacity: number) => {
    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({ color: hex(palette.accent), transparent: true, opacity, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    scene.add(ring)
    return ring
  }
  const followRing = accentRing(0.95)
  const targetRing = accentRing(0.85)
  const selectRing = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
  )
  selectRing.rotation.x = -Math.PI / 2
  scene.add(selectRing)

  // The followed forager's perception: a circle on the ground.
  const circle: number[] = []
  for (let index = 0; index < 96; index += 1) {
    const angle = (index / 96) * Math.PI * 2
    circle.push(Math.cos(angle), 0, Math.sin(angle))
  }
  const circleGeometry = new THREE.BufferGeometry()
  circleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(circle, 3))
  const perception: LineLoop = new THREE.LineLoop(
    circleGeometry,
    new THREE.LineBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.6 }),
  )
  scene.add(perception)

  const swapMaterial = new THREE.LineBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.9 })
  const swapArcs: SwapArc[] = []
  const arcGroup = new THREE.Group()
  scene.add(arcGroup)
  function swapArcAt(index: number): SwapArc {
    while (swapArcs.length <= index) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ARC_POINTS * 3), 3))
      const line = new THREE.Line(geometry, swapMaterial)
      const wood = new THREE.Mesh(bundleLogGeometry, deadwoodMaterial)
      wood.rotation.z = Math.PI / 2
      const food = new THREE.Mesh(parcelGeometry, bundleMaterial)
      arcGroup.add(line, wood, food)
      swapArcs.push({ line, wood, food })
    }
    return swapArcs[index]!
  }

  /** A person about 1.75 m tall: legs and arms that swing from hips and shoulders, and a torso that bends. */
  function makeFigure(id: number): Figure {
    const material = new THREE.MeshStandardMaterial({ color: hex(palette.household), roughness: 0.7 })
    const root = new THREE.Group()
    const body = new THREE.Group()
    const hips = new THREE.Group()
    hips.position.y = 0.92
    const leg = (side: number) => {
      const pivot = new THREE.Group()
      pivot.position.x = 0.1 * side
      const mesh = new THREE.Mesh(legGeometry, material)
      mesh.castShadow = true
      mesh.userData.foragerId = id
      pivot.add(mesh)
      hips.add(pivot)
      return pivot
    }
    const legs: [Group, Group] = [leg(-1), leg(1)]
    const torso = new THREE.Group()
    const chest = new THREE.Mesh(torsoGeometry, material)
    chest.castShadow = true
    const head = new THREE.Mesh(headGeometry, skinMaterial)
    head.position.y = 0.83
    head.castShadow = true
    const arm = (side: number) => {
      const pivot = new THREE.Group()
      pivot.position.set(0.22 * side, 0.6, 0)
      const mesh = new THREE.Mesh(armGeometry, material)
      mesh.castShadow = true
      mesh.userData.foragerId = id
      pivot.add(mesh)
      torso.add(pivot)
      return pivot
    }
    const arms: [Group, Group] = [arm(-1), arm(1)]
    // Firewood rides on the back; food hangs at the hip.
    const bundle = new THREE.Group()
    for (const [x, y] of [
      [-0.07, 0],
      [0.07, 0],
      [0, 0.08],
    ] as const) {
      const log = new THREE.Mesh(bundleLogGeometry, bundleMaterial)
      log.rotation.z = Math.PI / 2
      log.position.set(x, y, 0)
      log.castShadow = true
      bundle.add(log)
    }
    bundle.position.set(0, 0.45, -0.24)
    const parcel = new THREE.Mesh(parcelGeometry, bundleMaterial)
    parcel.position.set(0.24, 0.05, 0.05)
    for (const part of [chest, head, parcel, ...bundle.children]) part.userData.foragerId = id
    torso.add(chest, head, bundle, parcel)
    hips.add(torso)
    body.add(hips)
    root.add(body)
    band.add(root)
    return { root, body, hips, torso, legs, arms, material, bundle, parcel, heading: 0 }
  }

  function makeHearth(x: number, z: number): Hearth {
    const group = new THREE.Group()
    for (let index = 0; index < 6; index += 1) {
      const stone = new THREE.Mesh(stoneGeometry, emberMaterial)
      const angle = (index / 6) * Math.PI * 2
      stone.position.set(0.35 * Math.cos(angle), 0.06, 0.35 * Math.sin(angle))
      stone.castShadow = true
      group.add(stone)
    }
    const flame = new THREE.Mesh(flameGeometry, flameMaterial)
    flame.position.y = 0.25
    flame.scale.setScalar(0.6)
    const pile = new THREE.Group()
    for (const [x0, y0] of [
      [-0.1, 0.05],
      [0, 0.05],
      [0.1, 0.05],
      [-0.05, 0.13],
      [0.05, 0.13],
      [0, 0.21],
    ] as const) {
      const log = new THREE.Mesh(bundleLogGeometry, deadwoodMaterial)
      log.rotation.x = Math.PI / 2
      log.position.set(x0, y0, 0)
      log.castShadow = true
      pile.add(log)
    }
    pile.position.set(0.75, 0, -0.1)
    group.add(flame, pile)
    group.position.set(x, 0, z)
    scene.add(group)
    return { group, flame, pile }
  }

  function clearWorld() {
    for (const figure of figures) {
      figure.material.dispose()
      band.remove(figure.root)
    }
    figures = []
    for (const hearth of hearths) scene.remove(hearth.group)
    hearths = []
    if (campGroup) scene.remove(campGroup)
    campGlow?.dispose()
    campGroup = null
    campFlame = null
    campGlow = null
    for (const mesh of [leaves, berryMesh, trunks, crowns, logs]) {
      if (!mesh) continue
      mesh.dispose()
      world.remove(mesh)
    }
    leaves = berryMesh = trunks = crowns = logs = null
    for (const mesh of [ground, outside]) {
      if (!mesh) continue
      mesh.geometry.dispose()
      ;(mesh.material as MeshStandardMaterial).dispose()
      world.remove(mesh)
    }
    ground = outside = null
    if (grid) {
      grid.geometry.dispose()
      ;(grid.material as InstanceType<Three['LineBasicMaterial']>).dispose()
      world.remove(grid)
      grid = null
    }
  }

  /** Where each berry hangs, by bush: on the upper sides of its lobes, spread around it. */
  let berrySpots = new Float32Array(0)

  function placeBerries(bush: number, fills: number[]) {
    for (let slot = 0; slot < BERRIES_PER_BUSH; slot += 1) {
      const index = bush * BERRIES_PER_BUSH + slot
      const radius = Math.max(1e-5, BERRY_RADIUS * fills[slot]!)
      berryMesh!.setMatrixAt(
        index,
        matrix
          .makeScale(radius, radius, radius)
          .setPosition(berrySpots[index * 3]!, berrySpots[index * 3 + 1]!, berrySpots[index * 3 + 2]!),
      )
    }
  }

  /** Lays a tree's dead branches around its foot, each drawn by its fill: whole at 1, gone at 0. */
  function placeLogs(tree: number, fills: number[]) {
    const { x, z } = at(layout!.trees.x[tree]!, layout!.trees.y[tree]!)
    const look = plantLook('tree', tree)
    for (let slot = 0; slot < LOGS_PER_PILE; slot += 1) {
      const angle = look.turn + slot * 1.05
      const fill = fills[slot]!
      const length = Math.max(1e-5, 1.4 * fill)
      quaternion.setFromAxisAngle(yAxis, angle + 1.2)
      logs!.setMatrixAt(
        tree * LOGS_PER_PILE + slot,
        matrix.compose(
          position.set(x + Math.cos(angle) * 1.1, 0.06 + (slot % 2) * 0.1, z + Math.sin(angle) * 1.1),
          quaternion,
          scale.set(length, fill > 0 ? 1 : 1e-5, fill > 0 ? 1 : 1e-5),
        ),
      )
    }
  }

  function setWorld(state: ValleyState) {
    clearWorld()
    config = state.config
    layout = state.layout
    const size = state.config.valleySizeCm / 100
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: GRASS, roughness: 0.95 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    outside = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 8, size * 8),
      new THREE.MeshStandardMaterial({ color: OUTSIDE, roughness: 1 }),
    )
    outside.rotation.x = -Math.PI / 2
    outside.position.y = -0.05
    world.add(outside, ground)

    const points: number[] = []
    for (let line = 0; line <= size; line += GRID_STEP_M) {
      const offset = line - size / 2
      points.push(offset, 0.02, -size / 2, offset, 0.02, size / 2, -size / 2, 0.02, offset, size / 2, 0.02, offset)
    }
    const gridGeometry = new THREE.BufferGeometry()
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    grid = new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: GRID }))
    world.add(grid)

    // Bushes: three leafy lobes each, with berries on their upper sides.
    const { bushes, trees } = state.layout
    leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, bushes.count * BUSH_LOBES.length)
    berryMesh = new THREE.InstancedMesh(berryGeometry, berryMaterial, bushes.count * BERRIES_PER_BUSH)
    berrySpots = new Float32Array(bushes.count * BERRIES_PER_BUSH * 3)
    for (let bush = 0; bush < bushes.count; bush += 1) {
      const { x, z } = at(bushes.x[bush]!, bushes.y[bush]!)
      const look = plantLook('bush', bush)
      const cos = Math.cos(look.turn)
      const sin = Math.sin(look.turn)
      const lobes = BUSH_LOBES.map(([dx, height, dz, radius]) => ({
        x: x + (dx * cos - dz * sin) * look.size,
        y: height * look.size,
        z: z + (dx * sin + dz * cos) * look.size,
        radius: radius * look.size,
      }))
      for (const [index, lobe] of lobes.entries())
        leaves.setMatrixAt(
          bush * BUSH_LOBES.length + index,
          matrix.makeScale(lobe.radius, lobe.radius * 0.85, lobe.radius).setPosition(lobe.x, lobe.y, lobe.z),
        )
      for (let slot = 0; slot < BERRIES_PER_BUSH; slot += 1) {
        const lobe = lobes[slot % lobes.length]!
        const around = look.turn + slot * 2.4
        const up = 0.25 + 0.4 * (slot % 3) * 0.5
        const reach = lobe.radius * 0.97
        const index = (bush * BERRIES_PER_BUSH + slot) * 3
        berrySpots[index] = lobe.x + Math.cos(up) * Math.cos(around) * reach
        berrySpots[index + 1] = lobe.y + Math.sin(up) * reach * 0.85
        berrySpots[index + 2] = lobe.z + Math.cos(up) * Math.sin(around) * reach
      }
    }

    // Trees: a trunk and two crown cones each, with a pile of deadwood at the foot.
    trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.count)
    crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, trees.count * CROWN_CONES.length)
    logs = new THREE.InstancedMesh(logGeometry, deadwoodMaterial, trees.count * LOGS_PER_PILE)
    for (let tree = 0; tree < trees.count; tree += 1) {
      const { x, z } = at(trees.x[tree]!, trees.y[tree]!)
      const look = plantLook('tree', tree)
      trunks.setMatrixAt(
        tree,
        matrix
          .makeRotationY(look.turn)
          .scale(scale.set(look.size, TRUNK_HEIGHT * look.size, look.size))
          .setPosition(x, 0, z),
      )
      for (const [cone, [height, radius, tall]] of CROWN_CONES.entries())
        crowns.setMatrixAt(
          tree * CROWN_CONES.length + cone,
          matrix
            .makeRotationY(look.turn)
            .scale(scale.set(radius * look.size, tall * look.size, radius * look.size))
            .setPosition(x, height * look.size, z),
        )
    }
    // Bounds are taken with every berry ripe and every pile whole, the largest the plants can be.
    bushFill = new Float32Array(bushes.count).fill(-1)
    treeFill = new Float32Array(trees.count).fill(-1)
    const ripe = fillInTurn(1, 1, BERRIES_PER_BUSH)
    for (let bush = 0; bush < bushes.count; bush += 1) placeBerries(bush, ripe)
    const whole = fillInTurn(1, 1, LOGS_PER_PILE)
    for (let tree = 0; tree < trees.count; tree += 1) placeLogs(tree, whole)
    for (const mesh of [leaves, berryMesh, trunks, crowns, logs]) {
      mesh.castShadow = true
      mesh.receiveShadow = mesh === leaves
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      world.add(mesh)
    }

    // The camp: a ring of stones around a fire that glows at night, and each forager's own hearth around it.
    campGroup = new THREE.Group()
    for (let index = 0; index < 10; index += 1) {
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial)
      const angle = (index / 10) * Math.PI * 2
      stone.position.set(0.8 * Math.cos(angle), 0.08, 0.8 * Math.sin(angle))
      stone.scale.setScalar(1.3)
      stone.castShadow = true
      campGroup.add(stone)
    }
    campFlame = new THREE.Mesh(flameGeometry, flameMaterial)
    campFlame.scale.setScalar(1.6)
    campFlame.position.y = 0.4
    campGlow = new THREE.PointLight(FLAME, 0, 40, 1.6)
    campGlow.position.y = 1.5
    campGroup.add(campFlame, campGlow)
    const campAt = at(state.layout.camp.x, state.layout.camp.y)
    campGroup.position.set(campAt.x, 0, campAt.z)
    scene.add(campGroup)
    // A hearth sits a little to the side of where its forager sleeps.
    hearths = state.layout.hearths.map((hearth) => {
      const spot = at(hearth.x, hearth.y)
      return makeHearth(spot.x + 0.7, spot.z + 0.4)
    })
    figures = state.foragers.map((forager) => makeFigure(forager.id))

    camera.near = 0.1
    controls.target = { x: campAt.x, z: campAt.z }
    controls.distance = 60
    controls.yaw = Math.PI / 5
    controls.pitch = 0.9
    perception.scale.setScalar(state.config.perceptionRadiusCm / 100)
    applyCamera()
  }

  // The RTS camera: a point on the ground it looks at, a distance, a turn about the vertical and a pitch.
  const controls = { target: { x: 0, z: 0 }, distance: 60, yaw: Math.PI / 5, pitch: 0.9 }
  function applyCamera() {
    if (config) {
      const clamped = clampTarget(config, controls.target.x, controls.target.z)
      controls.target = clamped
    }
    controls.distance = clampDistance(controls.distance)
    controls.pitch = Math.min(CAMERA_LIMITS.highestPitch, Math.max(CAMERA_LIMITS.lowestPitch, controls.pitch))
    const { target, distance, yaw } = controls
    // Close in, the camera tilts towards eye level, as in a strategy game, and looks at a person's chest.
    const pitch = Math.max(0.12, controls.pitch - closeTilt(distance))
    const lookHeight = 1.2 * Math.max(0, 1 - distance / 40)
    camera.position.set(
      target.x + distance * Math.cos(pitch) * Math.sin(yaw),
      lookHeight + distance * Math.sin(pitch),
      target.z + distance * Math.cos(pitch) * Math.cos(yaw),
    )
    camera.lookAt(target.x, lookHeight, target.z)
    // Near things need a near plane close in; the whole valley needs a far one.
    camera.near = Math.max(0.05, distance / 200)
    camera.far = Math.max(2_000, distance * 8)
    camera.updateProjectionMatrix()
    const fog = scene.fog as InstanceType<Three['Fog']>
    fog.near = Math.max(300, distance * 2)
    fog.far = Math.max(1_500, distance * 6)
  }

  /** Moves the target by a step across the screen: right and up, in metres. */
  function pan(right: number, forward: number) {
    const { yaw } = controls
    controls.target = {
      x: controls.target.x + right * Math.cos(yaw) - forward * Math.sin(yaw),
      z: controls.target.z - right * Math.sin(yaw) - forward * Math.cos(yaw),
    }
    applyCamera()
  }

  const night = new THREE.Color(NIGHT_SKY)
  const day = new THREE.Color(DAY_SKY)
  const sky = new THREE.Color()
  const keys = new Set<string>()

  function poseFigure(figure: Figure, pose: ForagerPose, id: number, nowMs: number) {
    const phase = nowMs / 1000 + id * 0.7
    let legSwing = 0
    let armSwing = 0
    let bend = 0
    let reach = 0
    if (pose.gesture === 'walk') {
      legSwing = 0.55 * Math.sin(phase * 7)
      armSwing = -0.45 * Math.sin(phase * 7)
    } else if (pose.gesture === 'pick') {
      bend = 0.25
      reach = -1.25 + 0.25 * Math.sin(phase * 5)
    } else if (pose.gesture === 'gather') {
      bend = 0.95 + 0.1 * Math.sin(phase * 3)
      reach = -0.6 + 0.35 * Math.sin(phase * 4)
    }
    figure.legs[0].rotation.x = legSwing
    figure.legs[1].rotation.x = -legSwing
    figure.torso.rotation.x = bend
    if (pose.gesture === 'pick' || pose.gesture === 'gather') {
      figure.arms[0].rotation.x = reach
      figure.arms[1].rotation.x = pose.gesture === 'pick' ? -0.3 : reach * 0.8
    } else {
      figure.arms[0].rotation.x = armSwing
      figure.arms[1].rotation.x = -armSwing
    }
    // Lying down tips the whole body over at the feet.
    figure.body.rotation.x = (-Math.PI / 2) * pose.lying
    figure.body.position.y = 0.16 * pose.lying
  }

  function draw(pair: DisplayPair, options: DrawOptions) {
    if (!config || !layout) return
    const { interpolate, nowMs, followedId } = options
    const state = pair.next
    const minutes = displayMinutes(pair, interpolate)
    const hourOfDay = (minutes / 60) % 24
    const light = daylightAt(hourOfDay, config.dawnHour, config.duskHour)
    const { elevation, azimuth } = sunAt(hourOfDay, config.dawnHour, config.duskHour)
    sky.copy(night).lerp(day, light)
    ;(scene.background as InstanceType<Three['Color']>).copy(sky)
    ;(scene.fog as InstanceType<Three['Fog']>).color.copy(sky)
    hemisphere.intensity = 0.3 + 1.2 * light
    moon.intensity = 0.35 * (1 - light)

    // Keys pan and turn the camera smoothly, at a pace that follows the zoom.
    const step = Math.min(0.1, options.elapsedSeconds) * controls.distance
    let moved = false
    const right = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0)
    const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
    if (right || forward) {
      pan(right * step, forward * step)
      moved = true
    }
    const turn = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0)
    if (turn) {
      controls.yaw += turn * Math.min(0.1, options.elapsedSeconds) * 1.6
      applyCamera()
    }
    if (moved) callbacks.onPan()

    const followed = state.foragers[followedId]
    if (options.following && followed && !moved) {
      const pose = foragerPose(pair, followedId, interpolate)
      const spot = at(pose.x, pose.y)
      // Ease towards the forager rather than jump, so the view stays steady.
      const ease = Math.min(1, options.elapsedSeconds * 6)
      controls.target = {
        x: controls.target.x + (spot.x - controls.target.x) * ease,
        z: controls.target.z + (spot.z - controls.target.z) * ease,
      }
      applyCamera()
    }

    // The sun's shadows cover the part of the valley in view, so they stay sharp at any zoom.
    const span = Math.min(400, Math.max(15, controls.distance * 0.9))
    const { target } = controls
    sun.target.position.set(target.x, 0, target.z)
    sun.position.set(target.x + azimuth * span * 1.5, Math.max(0.15, elevation) * span * 2 + 10, target.z + span * 0.6)
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: span * 6 })
    sun.shadow.camera.updateProjectionMatrix()
    sun.intensity = 2.4 * light * Math.max(0.2, elevation)
    sun.color.setHSL(0.1, 0.6, 0.6 + 0.35 * Math.max(0, elevation))

    // Only plants whose drawn fill changed are redrawn.
    let berriesChanged = false
    for (let bush = 0; bush < layout.bushes.count; bush += 1) {
      const fill = displayedStock(pair, 'bush', bush, interpolate) / config.bushCapacityKcal
      if (Math.abs(fill - bushFill[bush]!) < 0.002) continue
      bushFill[bush] = fill
      placeBerries(bush, fillInTurn(fill, 1, BERRIES_PER_BUSH))
      berriesChanged = true
    }
    if (berriesChanged) berryMesh!.instanceMatrix.needsUpdate = true
    let logsChanged = false
    for (let tree = 0; tree < layout.trees.count; tree += 1) {
      const fill = displayedStock(pair, 'tree', tree, interpolate) / config.treeCapacityWood
      if (Math.abs(fill - treeFill[tree]!) < 0.002) continue
      treeFill[tree] = fill
      placeLogs(tree, fillInTurn(fill, 1, LOGS_PER_PILE))
      logsChanged = true
    }
    if (logsChanged) logs!.instanceMatrix.needsUpdate = true

    const flicker = 1 + 0.12 * Math.sin(nowMs / 90) + 0.08 * Math.sin(nowMs / 37)
    if (campFlame && campGlow) {
      campFlame.scale.set(1.6, 1.6 * flicker, 1.6)
      campGlow.intensity = (1 - light) * 30 * flicker
    }

    const poses = figures.map((_, id) => foragerPose(pair, id, interpolate))
    for (const [id, figure] of figures.entries()) {
      const pose = poses[id]!
      const forager = state.foragers[id]!
      const spot = at(pose.x, pose.y)
      figure.root.position.set(spot.x, 0, spot.z)
      if (pose.heading !== null) figure.heading = pose.heading
      figure.root.rotation.y = figure.heading
      poseFigure(figure, pose, id, nowMs)
      figure.material.color.set(!forager.alive ? DEAD : hex(foragerColor(config, forager)))
      const load = displayedLoad(pair, id, interpolate)
      const bundle = bundleScale(load.onBack, Math.max(config.woodLoad, 1))
      figure.bundle.visible = bundle > 0
      figure.bundle.scale.setScalar(Math.max(bundle, 0.01))
      const parcel = parcelScale(load.carriedKcal)
      figure.parcel.visible = parcel > 0
      figure.parcel.scale.setScalar(Math.max(parcel, 0.01))
      const hearth = hearths[id]
      if (hearth) {
        const pile = bundleScale(load.atHearth, woodTarget(config))
        hearth.pile.visible = pile > 0
        hearth.pile.scale.setScalar(Math.max(pile, 0.01))
        const lit = hearthAt(pair, id) === 'lit'
        hearth.flame.visible = lit
        if (lit) hearth.flame.scale.set(0.6, 0.6 * (1 + 0.15 * Math.sin(nowMs / 80 + id * 1.7)), 0.6)
      }
      if (id === followedId) {
        followRing.position.set(spot.x, 0.03, spot.z)
        followRing.scale.setScalar(0.6)
        perception.position.set(spot.x, 0.05, spot.z)
        perception.visible = forager.alive
      }
    }
    followRing.visible = followedId < figures.length

    const swaps = interpolate ? currentSwaps(pair) : []
    for (const [index, arc] of swapArcs.entries()) {
      const shown = index < swaps.length
      arc.line.visible = shown
      arc.wood.visible = shown
      arc.food.visible = shown
    }
    for (const [index, made] of swaps.entries()) {
      const arc = swapArcAt(index)
      const seller = poses[made.sellerId]!
      const buyer = poses[made.buyerId]!
      const from = at(seller.x, seller.y)
      const to = at(buyer.x, buyer.y)
      const positions = arc.line.geometry.getAttribute('position') as InstanceType<Three['BufferAttribute']>
      for (let point = 0; point < ARC_POINTS; point += 1) {
        const spot = arcPoint(from, to, point / (ARC_POINTS - 1))
        positions.setXYZ(point, spot.x, spot.y, spot.z)
      }
      positions.needsUpdate = true
      arc.line.geometry.computeBoundingSphere()
      const woodAt = arcPoint(from, to, pair.alpha)
      const foodAt = arcPoint(from, to, 1 - pair.alpha)
      arc.wood.position.set(woodAt.x, woodAt.y, woodAt.z)
      arc.food.position.set(foodAt.x, foodAt.y, foodAt.z)
    }

    // The followed forager's target: the tree it works for wood, or else its bush.
    const event = followed ? currentEvent(pair, followedId) : null
    const targetPlant =
      followed && event?.workedFor === 'wood' && followed.targetTreeId !== null
        ? { kind: 'tree' as const, id: followed.targetTreeId }
        : followed && event?.workedFor === 'food' && followed.targetBushId !== null
          ? { kind: 'bush' as const, id: followed.targetBushId }
          : null
    const ringAt = (ring: Mesh, plant: { kind: 'bush' | 'tree'; id: number } | null) => {
      ring.visible = plant !== null && (ring !== targetRing || followed!.alive)
      if (!plant) return
      const plants = plant.kind === 'bush' ? layout!.bushes : layout!.trees
      const spot = at(plants.x[plant.id]!, plants.y[plant.id]!)
      ring.position.set(spot.x, ring === selectRing ? 0.04 : 0.035, spot.z)
      ring.scale.setScalar(plant.kind === 'bush' ? 1.1 : 1.8)
    }
    ringAt(targetRing, targetPlant)
    ringAt(selectRing, options.selected)
    renderer.render(scene, camera)
  }

  /** The plant an instance of a bush's or tree's mesh belongs to. */
  function plantOf(object: unknown, instance: number | undefined): ValleyPlant | null {
    if (instance === undefined) return null
    if (object === leaves) return { kind: 'bush', id: Math.floor(instance / BUSH_LOBES.length) }
    if (object === berryMesh) return { kind: 'bush', id: Math.floor(instance / BERRIES_PER_BUSH) }
    if (object === trunks) return { kind: 'tree', id: instance }
    if (object === crowns) return { kind: 'tree', id: Math.floor(instance / CROWN_CONES.length) }
    if (object === logs) return { kind: 'tree', id: Math.floor(instance / LOGS_PER_PILE) }
    return null
  }

  // Drag to pan, right-drag to rotate, wheel or pinch to zoom, two fingers to rotate, click to pick.
  const canvas = renderer.domElement
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pointers = new Map<number, { x: number; y: number; button: number }>()
  let moved = 0
  let pinch: { distance: number; angle: number } | null = null
  const twoFingers = () => {
    const [a, b] = [...pointers.values()] as unknown as [{ x: number; y: number }, { x: number; y: number }]
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x) }
  }
  const onPointerDown = (event: PointerEvent) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, button: event.button })
    if (pointers.size === 1) moved = 0
    if (pointers.size === 2) pinch = twoFingers()
    canvas.setPointerCapture(event.pointerId)
    canvas.focus()
  }
  const onPointerMove = (event: PointerEvent) => {
    const last = pointers.get(event.pointerId)
    if (!last) return
    const dx = event.clientX - last.x
    const dy = event.clientY - last.y
    last.x = event.clientX
    last.y = event.clientY
    moved += Math.abs(dx) + Math.abs(dy)
    if (pointers.size === 2 && pinch) {
      const now = twoFingers()
      controls.distance *= pinch.distance / Math.max(1, now.distance)
      controls.yaw -= now.angle - pinch.angle
      pinch = now
      applyCamera()
      return
    }
    if (last.button === 2 || event.shiftKey) {
      controls.yaw -= dx * 0.006
      controls.pitch += dy * 0.004
      applyCamera()
      return
    }
    if (moved > 4) {
      // A drag moves the ground under the pointer, about one-for-one at any zoom.
      const perPixel = (2 * controls.distance * Math.tan((camera.fov * Math.PI) / 360)) / canvas.clientHeight
      pan(-dx * perPixel, (dy * perPixel) / Math.max(0.3, Math.sin(controls.pitch)))
      callbacks.onPan()
    }
  }
  const onPointerUp = (event: PointerEvent) => {
    const last = pointers.get(event.pointerId)
    pointers.delete(event.pointerId)
    if (pointers.size < 2) pinch = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (!last || last.button !== 0 || moved > 4 || pointers.size > 0) return
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const plants = [leaves, berryMesh, trunks, crowns, logs].filter((mesh) => mesh !== null)
    const hit = raycaster.intersectObjects([band, ...plants], true)[0]
    const foragerId = hit?.object.userData.foragerId as number | undefined
    callbacks.onPick(
      foragerId !== undefined ? { kind: 'forager', id: foragerId } : plantOf(hit?.object, hit?.instanceId),
    )
  }
  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    controls.distance *= Math.exp(event.deltaY * 0.0012)
    applyCamera()
  }
  const onContextMenu = (event: Event) => event.preventDefault()
  const typing = (event: KeyboardEvent) =>
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement
  const CAMERA_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])
  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    if (typing(event) || !CAMERA_KEYS.has(key) || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    keys.add(key)
  }
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase())
  const onBlur = () => keys.clear()
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
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
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      clearWorld()
      for (const disposable of [
        leafGeometry,
        leafMaterial,
        berryGeometry,
        berryMaterial,
        trunkGeometry,
        trunkMaterial,
        crownGeometry,
        crownMaterial,
        logGeometry,
        deadwoodMaterial,
        stoneGeometry,
        stoneMaterial,
        emberMaterial,
        flameGeometry,
        flameMaterial,
        ringGeometry,
        legGeometry,
        armGeometry,
        torsoGeometry,
        headGeometry,
        skinMaterial,
        bundleLogGeometry,
        bundleMaterial,
        parcelGeometry,
        circleGeometry,
        swapMaterial,
      ])
        disposable.dispose()
      for (const ring of [followRing, targetRing, selectRing])
        (ring.material as InstanceType<Three['MeshBasicMaterial']>).dispose()
      ;(perception.material as InstanceType<Three['LineBasicMaterial']>).dispose()
      for (const arc of swapArcs) arc.line.geometry.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
