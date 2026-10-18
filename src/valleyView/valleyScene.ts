import type {
  DataTexture,
  Group,
  InstancedMesh,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Sprite,
} from 'three'
import { isDaylight } from '../valley/forager'
import { siteCount } from '../valley/sites'
import { livingMembers, placesPerSide } from '../valley/social'
import { woodTarget } from '../valley/trade'
import type { ValleyState } from '../valley/types'
import { hex, palette } from '../ui/theme'
import { LOG_LENGTH, LOG_RADIUS, hutPlan, pieceLength } from './hutPlan'
import {
  BERRIES_PER_BUSH,
  closeTilt,
  CAMERA_LIMITS,
  arcPoint,
  baseRadiusCm,
  bundleScale,
  campfireAt,
  carriesLog,
  clampDistance,
  clampTarget,
  currentEvent,
  currentSwaps,
  daylightAt,
  displayMinutes,
  displayedHutLogs,
  displayedLoad,
  displayedStock,
  fillInTurn,
  foragerColor,
  foragerPose,
  groupColor,
  groupFrame,
  groupName,
  hearthAt,
  holdsAxe,
  knowledgeShades,
  parcelScale,
  pinPlacement,
  type ClearView,
  plantLook,
  siteRings,
  sunAt,
  toMetres,
  towardFire,
  treeShape,
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
const FIREWOOD = 0x8a6a48
const STONE = 0x6f6a60
const FLAME = 0xffa040
const POLE = 0x6b4f35
const EMBER = 0x3a3330
const ASH = 0x9a9590
const BUNDLE = 0xb07a45
const DEAD = 0x6b6b66
const SKIN = 0xc79a74
const HUT_LOG = 0x7a5536
/** Two more barks, so a hut's logs are not all one colour, and a log's sawn ends. */
const HUT_LOG_SHADES = [HUT_LOG, 0x6e4c30, 0x84603d]
const LOG_END = 0xc9a26b
const ROCK = 0x8c877c
const AXE_HEAD = 0x55524c
/** Points along each swap's arc. */
const ARC_POINTS = 24
/** Grid lines every this many metres, so distances can be judged at any zoom. */
const GRID_STEP_M = 50

/** A group's badge, as a share of the view's height: the same size at every zoom. */
const BADGE_SCALE = 0.05
/** The sash's tilt from level, towards one shoulder, in radians. */
const SASH_TILT = 0.85
/** How see-through foragers outside a selected group are drawn. */
const FADED_OPACITY = 0.25
/** Where a flag's pole stands beside its group's fire, in metres from the flag's point. */
const POLE_OFFSET = { x: -1.1, z: -0.7 }

/**
 * What a click picked out: a bush, tree, stone spot or hut to inspect, a group by its flag, base or badge, or a forager
 * to follow.
 */
export type ValleyPick = ValleySelection | { kind: 'forager'; id: number }
export type ValleyPlant = { kind: 'bush' | 'tree' | 'stone' | 'hut'; id: number }
/** A plant, or a group by its ID. */
export type ValleySelection = ValleyPlant | { kind: 'group'; id: number }

export interface DrawOptions {
  interpolate: boolean
  selected: ValleySelection | null
  /** A member of the selected group to pick out, as the viewer points at it in the group card. */
  highlightedId: number | null
  /** The part of the view the cards leave clear, where pins for members out of sight are held. */
  clear: ClearView | null
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
  /** Moves the camera to take in a group's base and every living member, as last drawn, in the clear part of the view. */
  showGroup(groupId: number, clear?: ClearView | null): void
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
/** Dead branches drawn under a standing tree when its share is full. */
const DEADWOOD_STICKS = 6
/** How far a sleeper's feet lie from its hut's middle, towards the door. */
const SLEEPER_FEET = 0.95

interface Figure {
  root: Group
  body: Group
  hips: Group
  torso: Group
  legs: [Group, Group]
  arms: [Group, Group]
  material: MeshStandardMaterial
  /** Its own skin, so it can fade with the rest of it. */
  skin: MeshStandardMaterial
  /** Drawn see-through, outside a selected group. */
  faded: boolean
  /** A band across the chest in its group's colour. */
  sash: Mesh
  sashMaterial: MeshStandardMaterial
  bundle: Group
  parcel: Mesh
  /** A log on its shoulder, and an axe in its right hand. */
  shoulderLog: Mesh
  axe: Group
  heading: number
}

/** A hut: an A-frame of logs, each shown once laid. */
interface HutModel {
  group: Group
  logs: Group[]
}

/** How each tree was last drawn, so only trees that change are redrawn. */
interface TreeDrawn {
  felled: boolean
  trunk: number
  crown: number
  deadwood: number
}

/**
 * Where a forager sleeps and keeps its wood. A forager without a group has a fire of its own there, in a ring of
 * stones; a member keeps only its stack of wood, beside its hut on the ring round its group's fire.
 */
interface Hearth {
  group: Group
  /** The ring of stones and the flame of its own fire. */
  ring: Group
  flame: Mesh
  /** The wood its forager holds beyond what it carries on its back. */
  pile: Group
  /** Where it is drawn, in valley centimetres: its forager's hearth moves when it joins a group. */
  x: number
  y: number
}

interface Flag {
  group: Group
  cloth: Mesh
  /** The ground around the base, in the group's colour. */
  disc: Mesh
  /** The group's letter above its flag, the same size on screen at every zoom. */
  badge: Sprite
  /** The group's fire at its flag: a flame, the wood it holds, and ashes when it is out. */
  fire: Group
  fireFlame: Mesh
  firePile: Group
  fireAsh: Mesh
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
  const firewoodMaterial = new THREE.MeshStandardMaterial({ color: FIREWOOD, roughness: 0.95, flatShading: true })
  const deadwoodGeometry = new THREE.CylinderGeometry(0.035, 0.045, 1, 5)
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
  const ashMaterial = new THREE.MeshStandardMaterial({ color: ASH, roughness: 1 })
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
  const logEndMaterial = new THREE.MeshStandardMaterial({ color: LOG_END, roughness: 0.9, flatShading: true })
  const barkMaterials = HUT_LOG_SHADES.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }),
  )
  const hutLogMaterial = barkMaterials[0]!
  // Every hut is built to the same plan, so each piece's shape and place are worked out once.
  const hutPieces = hutPlan().map((pieces) =>
    pieces.map((piece) => {
      const from = new THREE.Vector3(...piece.from)
      const to = new THREE.Vector3(...piece.to)
      return {
        geometry: new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, pieceLength(piece), 8),
        position: from.clone().add(to).multiplyScalar(0.5),
        quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize()),
      }
    }),
  )
  const shoulderLogGeometry = new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 8)
  shoulderLogGeometry.rotateX(Math.PI / 2)
  const rockGeometry = new THREE.DodecahedronGeometry(0.28, 0)
  const rockMaterial = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 1, flatShading: true })
  const axeHandleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5)
  const axeHeadGeometry = new THREE.BoxGeometry(0.16, 0.08, 0.05)
  const axeHeadMaterial = new THREE.MeshStandardMaterial({ color: AXE_HEAD, roughness: 0.8, flatShading: true })
  const poleGeometry = new THREE.CylinderGeometry(0.035, 0.045, 2.6, 6)
  poleGeometry.translate(0, 1.3, 0)
  const poleMaterial = new THREE.MeshStandardMaterial({ color: POLE, roughness: 0.9, flatShading: true })
  const clothGeometry = new THREE.PlaneGeometry(0.9, 0.55, 6, 1)
  clothGeometry.translate(0.45, 0, 0)
  const discGeometry = new THREE.CircleGeometry(1, 48)
  discGeometry.rotateX(-Math.PI / 2)
  // A sash: a ring wrapped around the torso and tilted in the body's front plane, so it runs from one shoulder down to
  // the other hip. It is drawn as a unit ring stretched to an ellipse whose shadow on the ground is a circle just wider
  // than the torso, 0.18 m across the chest and back, so it lies on the body all the way round.
  const sashGeometry = new THREE.TorusGeometry(1, 0.1, 8, 40)
  sashGeometry.scale(0.18 / Math.cos(SASH_TILT), 0.18, 0.22)
  sashGeometry.rotateX(Math.PI / 2)
  sashGeometry.rotateZ(SASH_TILT)

  const matrix = new THREE.Matrix4()
  const scale = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const position = new THREE.Vector3()
  const yAxis = new THREE.Vector3(0, 1, 0)
  const fallAlong = new THREE.Vector3()
  const fallAcross = new THREE.Vector3()

  let ground: Mesh | null = null
  let outside: Mesh | null = null
  let grid: InstanceType<Three['LineSegments']> | null = null
  let leaves: InstancedMesh | null = null
  let berryMesh: InstancedMesh | null = null
  let trunks: InstancedMesh | null = null
  let crowns: InstancedMesh | null = null
  let stumps: InstancedMesh | null = null
  let deadwood: InstancedMesh | null = null
  let rocks: InstancedMesh | null = null
  let hutModels: HutModel[] = []
  const hutGroup = new THREE.Group()
  scene.add(hutGroup)
  let hearths: Hearth[] = []
  let flags: Flag[] = []
  const flagGroup = new THREE.Group()
  scene.add(flagGroup)
  let figures: Figure[] = []
  /** The fill last drawn for each bush and tree, so only plants that changed are redrawn. */
  let bushFill = new Float32Array(0)
  let treeDrawn: TreeDrawn[] = []
  /** The stones last drawn on each stone spot. */
  let rockFill = new Int32Array(0)
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

  // What the followed forager knows: places it has never seen, or not seen lately, are darker on the ground.
  let knowledge: Mesh | null = null
  let knowledgeTexture: DataTexture | null = null
  let knowledgeKey = ''

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
  // Its long sight, drawn only when it does not reach across the whole valley.
  const sight: LineLoop = new THREE.LineLoop(
    circleGeometry,
    new THREE.LineBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.3 }),
  )
  scene.add(sight)
  // The thickets and stands it knows: a ring round each, bright if it checked it lately and faint if not.
  const freshSiteMaterial = new THREE.LineBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.7 })
  const staleSiteMaterial = new THREE.LineBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.2 })
  let siteLoops: LineLoop[] = []
  let sitesKey = ''

  // Rings at the feet of a selected group's living members, in the group's colour.
  const memberRings: Mesh[] = []
  function memberRingAt(index: number) {
    while (memberRings.length <= index) {
      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false }),
      )
      ring.rotation.x = -Math.PI / 2
      scene.add(ring)
      memberRings.push(ring)
    }
    return memberRings[index]!
  }
  /** The state last drawn, which `showGroup` frames. */
  let drawn: ValleyState | null = null

  // Lines on the ground from a selected group's flag to each member away from home, in the group's colour.
  const memberLines: InstanceType<Three['Line']>[] = []
  function memberLineAt(index: number) {
    while (memberLines.length <= index) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3))
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }),
      )
      line.renderOrder = 3
      scene.add(line)
      memberLines.push(line)
    }
    return memberLines[index]!
  }

  // Pins over a selected group's members: buttons laid over the view, the same size at every zoom, held at the edge of
  // the view and pointing towards a member that is off screen.
  const pinLayer = document.createElement('div')
  pinLayer.className = 'valley-pins'
  mount.appendChild(pinLayer)
  const pins: { button: HTMLButtonElement; label: HTMLSpanElement; arrow: HTMLSpanElement; id: number }[] = []
  function pinAt(index: number) {
    while (pins.length <= index) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'valley-pin'
      const label = document.createElement('span')
      label.className = 'valley-pin-label'
      const arrow = document.createElement('span')
      arrow.className = 'valley-pin-arrow'
      arrow.setAttribute('aria-hidden', 'true')
      button.append(arrow, label)
      const pin = { button, label, arrow, id: -1 }
      button.addEventListener('click', () => callbacks.onPick({ kind: 'forager', id: pin.id }))
      pinLayer.appendChild(button)
      pins.push(pin)
    }
    return pins[index]!
  }
  const projected = new THREE.Vector3()

  const swapMaterial = new THREE.LineBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.9 })
  const swapArcs: SwapArc[] = []
  const arcGroup = new THREE.Group()
  scene.add(arcGroup)
  function swapArcAt(index: number): SwapArc {
    while (swapArcs.length <= index) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ARC_POINTS * 3), 3))
      const line = new THREE.Line(geometry, swapMaterial)
      const wood = new THREE.Mesh(bundleLogGeometry, firewoodMaterial)
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
    const skin = skinMaterial.clone()
    const sashMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
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
    const head = new THREE.Mesh(headGeometry, skin)
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
    // A log on one shoulder, pointing the way it walks, and an axe held in the right hand.
    const shoulderLog = new THREE.Mesh(shoulderLogGeometry, [hutLogMaterial, logEndMaterial, logEndMaterial])
    shoulderLog.position.set(0.12, 0.62, 0.1)
    shoulderLog.rotation.x = -0.12
    shoulderLog.castShadow = true
    const axe = new THREE.Group()
    const handle = new THREE.Mesh(axeHandleGeometry, bundleMaterial)
    const blade = new THREE.Mesh(axeHeadGeometry, axeHeadMaterial)
    blade.position.set(0.06, -0.24, 0)
    axe.add(handle, blade)
    axe.position.set(0, -0.6, 0.05)
    axe.rotation.x = Math.PI / 2
    arms[1].add(axe)
    // A sash in its group's colour, from one shoulder down to the other hip.
    const sash = new THREE.Mesh(sashGeometry, sashMaterial)
    sash.position.set(0, 0.36, 0)
    sash.castShadow = true
    for (const part of [chest, head, parcel, sash, shoulderLog, ...bundle.children]) part.userData.foragerId = id
    torso.add(chest, head, bundle, parcel, sash, shoulderLog)
    hips.add(torso)
    body.add(hips)
    root.add(body)
    band.add(root)
    return {
      root,
      body,
      hips,
      torso,
      legs,
      arms,
      material,
      skin,
      faded: false,
      sash,
      sashMaterial,
      bundle,
      parcel,
      shoulderLog,
      axe,
      heading: 0,
    }
  }

  /**
   * A hut at its builder's sleeping spot, built to the plan: an A-frame 2.4 m long, about 1.5 m wide and 1.2 m tall, its
   * logs shown in the order they were laid. Its open end faces the group's fire, `toward`; a hut left behind keeps the
   * way it faced.
   */
  function makeHut(id: number, x: number, z: number, toward: { x: number; z: number } | null): HutModel {
    const group = new THREE.Group()
    const hutLogs = hutPieces.map((pieces, index) => {
      const log = new THREE.Group()
      for (const piece of pieces) {
        const mesh = new THREE.Mesh(piece.geometry, [
          barkMaterials[index % barkMaterials.length]!,
          logEndMaterial,
          logEndMaterial,
        ])
        mesh.position.copy(piece.position)
        mesh.quaternion.copy(piece.quaternion)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.hutId = id
        log.add(mesh)
      }
      group.add(log)
      return log
    })
    group.position.set(x, 0, z)
    // The hut's length runs along its local x, which turns to point at the fire.
    if (toward) group.rotation.y = Math.atan2(-toward.z, toward.x)
    hutGroup.add(group)
    return { group, logs: hutLogs }
  }

  /** A round badge in a group's colour with its letter, dark or light to stand out on the colour. */
  function badgeTexture(id: number) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    const color = groupColor(id)
    context.fillStyle = color
    context.strokeStyle = 'rgba(10, 14, 20, 0.85)'
    context.lineWidth = 8
    context.beginPath()
    context.arc(64, 64, 56, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16))
    context.fillStyle = 0.299 * r! + 0.587 * g! + 0.114 * b! > 150 ? '#10141a' : '#ffffff'
    context.font = 'bold 64px system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(groupName(id).replace('Group ', ''), 64, 68)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  /**
   * A group's base: its fire at the flag's point, in a ring of stones, with the wood it holds stacked beside it; a flag
   * on a pole about 2.6 m tall beside the fire, with a cloth in the group's colour, on a few stones; a disc of that
   * colour on the ground around its hearths; and a badge with its letter above the flag.
   */
  function makeFlag(id: number, x: number, z: number): Flag {
    const group = new THREE.Group()
    const disc = new THREE.Mesh(
      discGeometry,
      new THREE.MeshBasicMaterial({ color: hex(groupColor(id)), transparent: true, opacity: 0.2, depthWrite: false }),
    )
    disc.position.y = 0.015
    disc.renderOrder = 2
    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: badgeTexture(id), sizeAttenuation: false, depthTest: false, depthWrite: false }),
    )
    badge.scale.setScalar(BADGE_SCALE)
    badge.position.set(POLE_OFFSET.x, 3.4, POLE_OFFSET.z)
    badge.renderOrder = 10
    group.add(disc, badge)
    const fire = new THREE.Group()
    for (let index = 0; index < 8; index += 1) {
      const stone = new THREE.Mesh(stoneGeometry, emberMaterial)
      const angle = (index / 8) * Math.PI * 2
      stone.position.set(0.55 * Math.cos(angle), 0.07, 0.55 * Math.sin(angle))
      stone.scale.setScalar(1.3)
      stone.castShadow = true
      fire.add(stone)
    }
    const fireFlame = new THREE.Mesh(flameGeometry, flameMaterial)
    fireFlame.position.y = 0.3
    const fireAsh = new THREE.Mesh(discGeometry, ashMaterial)
    fireAsh.scale.setScalar(0.4)
    fireAsh.position.y = 0.02
    const firePile = new THREE.Group()
    for (const [x0, y0] of [
      [-0.12, 0.05],
      [0, 0.05],
      [0.12, 0.05],
      [-0.06, 0.13],
      [0.06, 0.13],
      [0, 0.21],
    ] as const) {
      const log = new THREE.Mesh(bundleLogGeometry, firewoodMaterial)
      log.rotation.x = Math.PI / 2
      log.position.set(x0, y0, 0)
      log.castShadow = true
      firePile.add(log)
    }
    firePile.position.set(1, 0, 0.3)
    fire.add(fireFlame, fireAsh, firePile)
    group.add(fire)
    const pole = new THREE.Mesh(poleGeometry, poleMaterial)
    pole.position.set(POLE_OFFSET.x, 0, POLE_OFFSET.z)
    pole.castShadow = true
    // Each cloth has its own geometry, since it waves.
    const cloth = new THREE.Mesh(
      clothGeometry.clone(),
      new THREE.MeshStandardMaterial({ color: hex(groupColor(id)), roughness: 0.8, side: THREE.DoubleSide }),
    )
    cloth.position.set(POLE_OFFSET.x, 2.3, POLE_OFFSET.z)
    cloth.castShadow = true
    group.add(pole, cloth)
    for (let index = 0; index < 4; index += 1) {
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial)
      const angle = (index / 4) * Math.PI * 2 + 0.4
      stone.position.set(POLE_OFFSET.x + 0.16 * Math.cos(angle), 0.07, POLE_OFFSET.z + 0.16 * Math.sin(angle))
      group.add(stone)
    }
    group.traverse((part) => (part.userData.groupId = id))
    group.position.set(x, 0, z)
    flagGroup.add(group)
    return { group, cloth, disc, badge, fire, fireFlame, firePile, fireAsh }
  }

  /** Sways a flag's cloth along its length, more towards the free end. */
  function wave(cloth: Mesh, nowMs: number, id: number) {
    const positions = cloth.geometry.getAttribute('position') as InstanceType<Three['BufferAttribute']>
    for (let index = 0; index < positions.count; index += 1) {
      const along = positions.getX(index)
      positions.setZ(index, 0.08 * along * Math.sin(nowMs / 260 + along * 5 + id))
    }
    positions.needsUpdate = true
  }

  function makeHearth(hearthX: number, hearthY: number): Hearth {
    const group = new THREE.Group()
    // Its own fire sits a little to the side of where it sleeps.
    const ring = new THREE.Group()
    ring.position.set(0.7, 0, 0.4)
    for (let index = 0; index < 6; index += 1) {
      const stone = new THREE.Mesh(stoneGeometry, emberMaterial)
      const angle = (index / 6) * Math.PI * 2
      stone.position.set(0.35 * Math.cos(angle), 0.06, 0.35 * Math.sin(angle))
      stone.castShadow = true
      ring.add(stone)
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
      const log = new THREE.Mesh(bundleLogGeometry, firewoodMaterial)
      log.rotation.x = Math.PI / 2
      log.position.set(x0, y0, 0)
      log.castShadow = true
      pile.add(log)
    }
    ring.add(flame)
    group.add(ring, pile)
    scene.add(group)
    const hearth = { group, ring, flame, pile, x: hearthX, y: hearthY }
    placeHearth(hearth, hearthX, hearthY, null)
    return hearth
  }

  /**
   * A forager's own fire sits a little to the side of where it sleeps, with its wood beside it. A member has no fire
   * of its own: its wood is stacked beside its hut, to one side of the line to the group's fire.
   */
  function placeHearth(hearth: Hearth, x: number, y: number, toward: { x: number; z: number } | null) {
    const spot = at(x, y)
    hearth.group.position.set(spot.x, 0, spot.z)
    hearth.ring.visible = toward === null
    if (toward) hearth.pile.position.set(-toward.z * 1.5, 0, toward.x * 1.5)
    else hearth.pile.position.set(1.45, 0, 0.3)
    hearth.x = x
    hearth.y = y
  }

  function clearWorld() {
    for (const figure of figures) {
      figure.material.dispose()
      figure.skin.dispose()
      figure.sashMaterial.dispose()
      band.remove(figure.root)
    }
    figures = []
    for (const hearth of hearths) scene.remove(hearth.group)
    hearths = []
    for (const flag of flags) {
      ;(flag.cloth.material as MeshStandardMaterial).dispose()
      flag.cloth.geometry.dispose()
      ;(flag.disc.material as MeshBasicMaterial).dispose()
      flag.badge.material.map?.dispose()
      flag.badge.material.dispose()
      flagGroup.remove(flag.group)
    }
    flags = []
    for (const hut of hutModels) hutGroup.remove(hut.group)
    hutModels = []
    for (const ring of siteLoops) world.remove(ring)
    siteLoops = []
    if (knowledge) {
      knowledge.geometry.dispose()
      ;(knowledge.material as MeshBasicMaterial).dispose()
      knowledgeTexture?.dispose()
      world.remove(knowledge)
      knowledge = null
      knowledgeTexture = null
      knowledgeKey = ''
    }
    for (const mesh of [leaves, berryMesh, trunks, crowns, stumps, deadwood, rocks]) {
      if (!mesh) continue
      mesh.dispose()
      world.remove(mesh)
    }
    leaves = berryMesh = trunks = crowns = stumps = deadwood = rocks = null
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

  /**
   * Draws a tree. Standing, its crown is whole, with dead branches beneath it as many as its share of wood. Felled, it lies on the ground where it fell, beside
   * a stump: its trunk shortens from the butt as logs are cut from it, and its crown lies at the far end, shrinking as
   * its branches are gathered, until only the stump is left.
   */
  function placeTree(tree: number, shape: TreeDrawn) {
    const { x, z } = at(layout!.trees.x[tree]!, layout!.trees.y[tree]!)
    const look = plantLook('tree', tree)
    const size = look.size
    const cones = CROWN_CONES.length
    if (!shape.felled) {
      trunks!.setMatrixAt(
        tree,
        matrix
          .makeRotationY(look.turn)
          .scale(scale.set(size, TRUNK_HEIGHT * size, size))
          .setPosition(x, 0, z),
      )
      stumps!.setMatrixAt(tree, matrix.makeScale(1e-5, 1e-5, 1e-5).setPosition(x, 0, z))
      placeDeadwood(tree, x, z, look.turn, size, shape.deadwood)
      for (const [cone, [coneHeight, radius, tall]] of CROWN_CONES.entries()) {
        const r = radius * size * shape.crown
        crowns!.setMatrixAt(
          tree * cones + cone,
          matrix
            .makeRotationY(look.turn)
            .scale(scale.set(r, tall * size * shape.crown, r))
            .setPosition(x, coneHeight * size, z),
        )
      }
      return
    }
    // It fell away from its stump in a direction of its own: its length runs along \`along\`, flat on the ground, with
    // \`up\` still up and \`across\` level beside it.
    const dx = Math.cos(look.turn)
    const dz = Math.sin(look.turn)
    fallAlong.set(dx, 0, dz)
    fallAcross.set(-dz, 0, dx)
    stumps!.setMatrixAt(tree, matrix.makeScale(size * 1.15, 0.4, size * 1.15).setPosition(x, 0, z))
    placeDeadwood(tree, x, z, look.turn, size, 0)
    // The trunk lies out from the stump and shortens from its far end as logs are cut from it.
    const length = Math.max(1e-5, TRUNK_HEIGHT * size * shape.trunk)
    const thick = shape.trunk > 0 ? size : 1e-5
    trunks!.setMatrixAt(
      tree,
      matrix
        .makeBasis(fallAcross, fallAlong, yAxis)
        .scale(scale.set(thick, length, thick))
        .setPosition(x + dx * 0.5, 0.24 * size, z + dz * 0.5),
    )
    // The crown lies at the far end, flattened against the ground, shrinking as its branches are gathered.
    for (const [cone, [coneHeight, radius, tall]] of CROWN_CONES.entries()) {
      const r = Math.max(1e-5, radius * size * shape.crown)
      const out = 0.5 + coneHeight * size
      crowns!.setMatrixAt(
        tree * cones + cone,
        matrix
          .makeBasis(fallAcross, fallAlong, yAxis)
          .scale(scale.set(r, Math.max(1e-5, tall * size * shape.crown), r * 0.4))
          .setPosition(x + dx * out, r * 0.4, z + dz * out),
      )
    }
  }

  /** Lays the dead branches under a standing tree on the ground round its trunk, `fill` of them shown. */
  function placeDeadwood(tree: number, x: number, z: number, turn: number, size: number, fill: number) {
    const shown = Math.round(fill * DEADWOOD_STICKS)
    for (let stick = 0; stick < DEADWOOD_STICKS; stick += 1) {
      const index = tree * DEADWOOD_STICKS + stick
      if (stick >= shown) {
        deadwood!.setMatrixAt(index, matrix.makeScale(1e-5, 1e-5, 1e-5).setPosition(x, 0, z))
        continue
      }
      const around = turn + stick * 1.05 + 0.3
      const out = (0.75 + 0.3 * (stick % 3)) * size
      // Lying flat, at an angle of its own to the trunk.
      quaternion.setFromEuler(euler.set(Math.PI / 2, around + 0.9 + 0.4 * stick, 0, 'YXZ'))
      position.set(x + Math.cos(around) * out, 0.05, z + Math.sin(around) * out)
      scale.set(1, (0.7 + 0.12 * (stick % 4)) * size, 1)
      deadwood!.setMatrixAt(index, matrix.compose(position, quaternion, scale))
    }
  }

  /** Lays a stone spot's stones in a little heap, each shown while it is there. */
  function placeRocks(spot: number, stones: number) {
    const { x, z } = at(layout!.stones.x[spot]!, layout!.stones.y[spot]!)
    const per = config!.stonesPerSpot
    for (let slot = 0; slot < per; slot += 1) {
      const angle = spot * 1.7 + slot * 2.4
      const out = slot === 0 ? 0 : 0.35
      const size = slot < stones ? 0.8 + ((spot * 7 + slot * 3) % 5) * 0.1 : 1e-5
      quaternion.setFromAxisAngle(yAxis, angle)
      rocks!.setMatrixAt(
        spot * per + slot,
        matrix.compose(
          position.set(x + Math.cos(angle) * out, 0.12 + (slot === 0 ? 0.1 : 0), z + Math.sin(angle) * out),
          quaternion,
          scale.set(size, size * 0.75, size),
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

    // Trees: a trunk and two crown cones each, and a stump once felled. The crown of a standing tree is drawn full at
    // first, for the bounds; each tree is redrawn as it is when the first minute is drawn.
    trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.count)
    crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, trees.count * CROWN_CONES.length)
    stumps = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.count)
    deadwood = new THREE.InstancedMesh(deadwoodGeometry, firewoodMaterial, trees.count * DEADWOOD_STICKS)
    treeDrawn = Array.from({ length: trees.count }, () => ({ felled: false, trunk: 1, crown: 1, deadwood: 1 }))
    for (let tree = 0; tree < trees.count; tree += 1) placeTree(tree, treeDrawn[tree]!)
    // Stone spots: a heap of grey stones each.
    const { stones } = state.layout
    rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, Math.max(1, stones.count * state.config.stonesPerSpot))
    rockFill = new Int32Array(stones.count).fill(state.config.stonesPerSpot)
    for (let spot = 0; spot < stones.count; spot += 1) placeRocks(spot, state.config.stonesPerSpot)
    // Bounds are taken with every berry ripe and every pile whole, the largest the plants can be.
    bushFill = new Float32Array(bushes.count).fill(-1)
    const ripe = fillInTurn(1, 1, BERRIES_PER_BUSH)
    for (let bush = 0; bush < bushes.count; bush += 1) placeBerries(bush, ripe)
    for (const mesh of [leaves, berryMesh, trunks, crowns, stumps, deadwood, rocks]) {
      mesh.castShadow = true
      mesh.receiveShadow = mesh === leaves || mesh === rocks
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      world.add(mesh)
    }

    // Each forager's hearth, where it sleeps: its own fire until it joins a group, then its stack of wood by its hut.
    hearths = state.foragers.map((forager) => makeHearth(forager.hearth.x, forager.hearth.y))
    figures = state.foragers.map((forager) => makeFigure(forager.id))

    // The ground the followed forager knows: one texel per place, laid over the grass.
    const n = placesPerSide(state.config)
    knowledgeTexture = new THREE.DataTexture(new Uint8Array(n * n * 4), n, n, THREE.RGBAFormat)
    knowledgeTexture.magFilter = THREE.NearestFilter
    knowledgeTexture.minFilter = THREE.NearestFilter
    const placesSize = (n * state.config.placeCm) / 100
    knowledge = new THREE.Mesh(
      new THREE.PlaneGeometry(placesSize, placesSize),
      new THREE.MeshBasicMaterial({ map: knowledgeTexture, transparent: true, depthWrite: false }),
    )
    knowledge.rotation.x = -Math.PI / 2
    knowledge.position.set((placesSize - size) / 2, 0.01, (placesSize - size) / 2)
    knowledge.renderOrder = 1
    world.add(knowledge)

    camera.near = 0.1
    const start = at(state.foragers[0]!.x, state.foragers[0]!.y)
    controls.target = { x: start.x, z: start.z }
    controls.distance = 60
    controls.yaw = Math.PI / 5
    controls.pitch = 0.9
    perception.scale.setScalar(state.config.perceptionRadiusCm / 100)
    sight.scale.setScalar(state.config.sightRadiusCm / 100)
    siteLoops = Array.from({ length: siteCount(state.config) }, () => {
      const ring = new THREE.LineLoop(circleGeometry, staleSiteMaterial)
      ring.visible = false
      world.add(ring)
      return ring
    })
    sitesKey = ''
    applyCamera()
  }

  function showGroup(groupId: number, clear: ClearView | null = null) {
    if (!drawn?.groups[groupId] || !config) return
    const frame = groupFrame(drawn, groupId)
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    const area = clear ?? { left: 0, top: 0, right: width, bottom: height }
    // The camera's field of view is 40° high, so a span fills the view's height from about 1.4 times its width away;
    // the group must fit the clear part of the view, which may be narrower or shorter.
    const shrink = Math.min((area.right - area.left) / width, (area.bottom - area.top) / height, 1)
    controls.distance = clampDistance(Math.max(30, ((frame.radiusCm / 100) * 3) / Math.max(0.2, shrink)))
    controls.target = at(frame.x, frame.y)
    applyCamera()
    // Then move the camera so the group sits in the middle of the clear part rather than of the whole view.
    const perPixel = (2 * controls.distance * Math.tan((camera.fov * Math.PI) / 360)) / height
    const offsetX = (area.left + area.right) / 2 - width / 2
    const offsetY = (area.top + area.bottom) / 2 - height / 2
    pan(-offsetX * perPixel, (offsetY * perPixel) / Math.max(0.3, Math.sin(controls.pitch)))
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
    } else if (pose.gesture === 'chop') {
      // Both hands swing the axe from over the shoulder down into the trunk.
      bend = 0.15 + 0.15 * Math.max(0, Math.sin(phase * 6))
      reach = -1.6 + 1.3 * Math.sin(phase * 6)
    } else if (pose.gesture === 'make') {
      // Kneeling over its work, knocking the stone into shape.
      bend = 0.7
      reach = -0.9 + 0.25 * Math.sin(phase * 9)
    }
    const kneel = pose.gesture === 'make'
    figure.legs[0].rotation.x = kneel ? -1.4 : legSwing
    figure.legs[1].rotation.x = kneel ? -0.2 : -legSwing
    figure.hips.position.y = kneel ? 0.55 : 0.92
    figure.torso.rotation.x = bend
    if (pose.gesture === 'chop' || pose.gesture === 'make') {
      figure.arms[0].rotation.x = reach
      figure.arms[1].rotation.x = reach
    } else if (pose.gesture === 'pick' || pose.gesture === 'gather') {
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
    drawn = state
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
    // Trees stand, or lie felled as they are cut up, and stone spots show the stones left on them.
    let treesChanged = false
    for (let tree = 0; tree < layout.trees.count; tree += 1) {
      const shape = treeShape(pair, tree, interpolate)
      const drawnBefore = treeDrawn[tree]!
      if (
        shape.felled === drawnBefore.felled &&
        shape.trunk === drawnBefore.trunk &&
        Math.abs(shape.crown - drawnBefore.crown) < 0.002 &&
        Math.round(shape.deadwood * DEADWOOD_STICKS) === Math.round(drawnBefore.deadwood * DEADWOOD_STICKS)
      )
        continue
      treeDrawn[tree] = shape
      placeTree(tree, shape)
      treesChanged = true
    }
    if (treesChanged) {
      trunks!.instanceMatrix.needsUpdate = true
      crowns!.instanceMatrix.needsUpdate = true
      stumps!.instanceMatrix.needsUpdate = true
      deadwood!.instanceMatrix.needsUpdate = true
    }
    let rocksChanged = false
    for (let spot = 0; spot < layout.stones.count; spot += 1) {
      const stones = state.stoneStock[spot]!
      if (stones === rockFill[spot]) continue
      rockFill[spot] = stones
      placeRocks(spot, stones)
      rocksChanged = true
    }
    if (rocksChanged) rocks!.instanceMatrix.needsUpdate = true
    // Huts, each made the first time it is drawn, show the logs laid in them.
    for (const hut of state.huts) {
      if (!hutModels[hut.id]) {
        const spot = at(hut.x, hut.y)
        const builder = state.foragers[hut.builderId]!
        const home = builder.hearth.x === hut.x && builder.hearth.y === hut.y
        hutModels[hut.id] = makeHut(
          hut.id,
          spot.x,
          spot.z,
          home ? towardFire(state, hut.builderId, hut.x, hut.y) : null,
        )
      }
      // The plan's logs stand for the hut's share of its whole, should `hutLogs` differ from the plan.
      const logs = hutModels[hut.id]!.logs
      const shown = Math.floor((displayedHutLogs(pair, hut.id) * logs.length) / config.hutLogs)
      for (const [index, log] of logs.entries()) log.visible = index < shown
    }

    // Flags stand while their groups do; a flag is made the first time its group is drawn.
    for (const group of state.groups) {
      if (!flags[group.id]) {
        const spot = at(group.flag.x, group.flag.y)
        flags[group.id] = makeFlag(group.id, spot.x, spot.z)
      }
      const flag = flags[group.id]!
      flag.group.visible = group.dissolvedMinute === null
      if (!flag.group.visible) continue
      wave(flag.cloth, nowMs, group.id)
      flag.disc.scale.setScalar(baseRadiusCm(config, group) / 100)
      // The group's fire: a flame that grows with the nights of wood it holds, wood stacked beside it, ashes when out.
      const fire = campfireAt(pair, group.id)
      flag.fire.visible = fire !== null
      if (!fire) continue
      flag.fireFlame.visible = fire.look === 'burning'
      if (fire.look === 'burning') {
        const size = 1 + 1.6 * fire.size
        flag.fireFlame.scale.set(size, size * (1 + 0.18 * Math.sin(nowMs / 70 + group.id * 2.3)), size)
      }
      flag.fireAsh.visible = fire.look === 'out'
      const pile = bundleScale(fire.wood, 2 * config.campfireWoodPerHour * 12)
      flag.firePile.visible = pile > 0
      flag.firePile.scale.setScalar(Math.max(pile, 0.01) * 1.4)
    }

    // The thickets and stands the followed forager knows, redrawn only when the minute or forager changes.
    const ringsKey = `${followedId}:${state.minute}`
    if (followed && ringsKey !== sitesKey) {
      sitesKey = ringsKey
      for (const loop of siteLoops) loop.visible = false
      for (const ring of siteRings(state, followedId)) {
        const loop = siteLoops[ring.site]
        if (!loop) continue
        const spot = at(ring.x, ring.y)
        loop.visible = true
        loop.material = ring.fresh ? freshSiteMaterial : staleSiteMaterial
        loop.position.set(spot.x, 0.06, spot.z)
        loop.scale.setScalar(ring.radiusCm / 100 + 1.5)
      }
    }

    // Shades the ground for what the followed forager knows, redrawn only when the minute or forager changes.
    const key = `${followedId}:${state.minute}`
    if (knowledgeTexture && key !== knowledgeKey && followed) {
      knowledgeKey = key
      const n = placesPerSide(config)
      const shades = knowledgeShades(state, followedId)
      const data = knowledgeTexture.image.data as Uint8Array
      for (let place = 0; place < shades.length; place += 1) {
        // The plane's first texel row lies at the valley's far edge.
        const texel = ((n - 1 - Math.floor(place / n)) * n + (place % n)) * 4
        data[texel] = 4
        data[texel + 1] = 8
        data[texel + 2] = 12
        data[texel + 3] = shades[place]!
      }
      knowledgeTexture.needsUpdate = true
    }

    const poses = figures.map((_, id) => foragerPose(pair, id, interpolate))
    // With a group selected, foragers outside it are drawn see-through.
    const selectedGroup = options.selected?.kind === 'group' ? state.groups[options.selected.id] : undefined
    const members = selectedGroup ? livingMembers(state, selectedGroup) : []
    const inSelected = new Set(members)
    for (const [id, figure] of figures.entries()) {
      const faded = selectedGroup !== undefined && !inSelected.has(id)
      if (faded !== figure.faded) {
        figure.faded = faded
        for (const material of [figure.material, figure.skin, figure.sashMaterial]) {
          material.transparent = faded
          material.opacity = faded ? FADED_OPACITY : 1
          material.depthWrite = !faded
          material.needsUpdate = true
        }
        figure.root.traverse((part) => (part.castShadow = !faded))
      }
    }
    for (const [id, figure] of figures.entries()) {
      const pose = poses[id]!
      const forager = state.foragers[id]!
      const spot = at(pose.x, pose.y)
      figure.root.position.set(spot.x, 0, spot.z)
      if (pose.heading !== null) figure.heading = pose.heading
      // A member lies down in its hut with its feet towards the fire and its head at the back, the hut's length.
      const toward =
        pose.lying > 0 && pose.x === forager.hearth.x && pose.y === forager.hearth.y
          ? towardFire(state, id, pose.x, pose.y)
          : null
      if (toward) {
        figure.root.position.set(
          spot.x + toward.x * SLEEPER_FEET * pose.lying,
          0,
          spot.z + toward.z * SLEEPER_FEET * pose.lying,
        )
        figure.heading = Math.atan2(toward.x, toward.z)
      }
      figure.root.rotation.y = figure.heading
      poseFigure(figure, pose, id, nowMs)
      figure.material.color.set(!forager.alive ? DEAD : hex(foragerColor(config, forager)))
      figure.sash.visible = forager.groupId !== null
      if (forager.groupId !== null) figure.sashMaterial.color.set(hex(groupColor(forager.groupId)))
      const load = displayedLoad(pair, id, interpolate)
      const bundle = bundleScale(load.onBack, Math.max(config.woodLoad, 1))
      figure.bundle.visible = bundle > 0
      figure.bundle.scale.setScalar(Math.max(bundle, 0.01))
      const parcel = parcelScale(load.carriedKcal)
      figure.parcel.visible = parcel > 0
      figure.parcel.scale.setScalar(Math.max(parcel, 0.01))
      figure.shoulderLog.visible = forager.alive && carriesLog(pair, id, interpolate)
      figure.axe.visible = forager.alive && holdsAxe(pair, id) && pose.lying < 0.5
      const hearth = hearths[id]
      if (hearth) {
        placeHearth(
          hearth,
          forager.hearth.x,
          forager.hearth.y,
          towardFire(state, id, forager.hearth.x, forager.hearth.y),
        )
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
        // Long sight reaches across the valley's diagonal by day on the canonical settings, so it is rarely drawn.
        const diagonal = Math.SQRT2 * config.valleySizeCm
        sight.position.set(spot.x, 0.05, spot.z)
        sight.visible =
          forager.alive &&
          config.sightRadiusCm > config.perceptionRadiusCm &&
          config.sightRadiusCm < diagonal &&
          isDaylight(config, Math.floor(minutes))
      }
    }
    followRing.visible = followedId < figures.length

    // A selected group's living members each stand in a ring of its colour, with a line from the flag to each one
    // away from home, and a pin over each that stays the same size at every zoom.
    for (const [index, ring] of memberRings.entries()) ring.visible = index < members.length
    for (const line of memberLines) line.visible = false
    const color = selectedGroup ? groupColor(selectedGroup.id) : ''
    let lines = 0
    for (const [index, id] of members.entries()) {
      const ring = memberRingAt(index)
      const pose = poses[id]!
      const spot = at(pose.x, pose.y)
      ring.visible = true
      ;(ring.material as MeshBasicMaterial).color.set(hex(color))
      ring.position.set(spot.x, 0.04, spot.z)
      ring.scale.setScalar(0.75)
      const flag = selectedGroup!.flag
      if (Math.hypot(pose.x - flag.x, pose.y - flag.y) > baseRadiusCm(config, selectedGroup!)) {
        const line = memberLineAt(lines)
        lines += 1
        const home = at(flag.x, flag.y)
        const positions = line.geometry.getAttribute('position') as InstanceType<Three['BufferAttribute']>
        positions.setXYZ(0, home.x, 0.08, home.z)
        positions.setXYZ(1, spot.x, 0.08, spot.z)
        positions.needsUpdate = true
        line.geometry.computeBoundingSphere()
        ;(line.material as InstanceType<Three['LineBasicMaterial']>).color.set(hex(color))
        line.visible = true
      }
    }
    camera.updateMatrixWorld()
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const clear = options.clear ?? { left: 24, top: 24, right: width - 24, bottom: height - 24 }
    for (const [index, pin] of pins.entries()) pin.button.hidden = index >= members.length
    // Pins that would cover one another, for members standing together, are stacked.
    const placed: { x: number; y: number }[] = []
    for (const [index, id] of members.entries()) {
      const pin = pinAt(index)
      const pose = poses[id]!
      const spot = at(pose.x, pose.y)
      projected.set(spot.x, 2.4, spot.z).applyMatrix4(camera.matrixWorldInverse)
      const behind = projected.z > 0
      projected.set(spot.x, 2.4, spot.z).project(camera)
      const place = pinPlacement(((projected.x + 1) / 2) * width, ((1 - projected.y) / 2) * height, behind, clear, {
        width,
        height,
      })
      pin.id = id
      pin.button.hidden = false
      pin.label.textContent = String(id + 1)
      pin.button.setAttribute('aria-label', `Follow Forager ${id + 1}`)
      pin.button.style.setProperty('--pin-color', color)
      const covered = placed.filter((other) => Math.abs(other.x - place.x) < 24 && Math.abs(other.y - place.y) < 24)
      placed.push({ x: place.x, y: place.y })
      // Stacked downwards, so pins held at a side of the clear view stay inside it.
      pin.button.style.transform = `translate(${place.x}px, ${place.y + covered.length * 30}px)`
      pin.button.classList.toggle('is-edge', place.edge)
      pin.button.classList.toggle('is-highlighted', options.highlightedId === id)
      pin.arrow.style.transform = `rotate(${place.angle}rad)`
    }

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
      followed && event?.workedFor === 'wood' && followed.targetWoodId !== null
        ? { kind: 'tree' as const, id: followed.targetWoodId }
        : followed && event?.workedFor === 'food' && followed.targetBushId !== null
          ? { kind: 'bush' as const, id: followed.targetBushId }
          : null
    const ringAt = (ring: Mesh, chosen: ValleySelection | null) => {
      ring.visible = chosen !== null && (ring !== targetRing || followed!.alive)
      if (!chosen) return
      let spot: { x: number; z: number }
      if (chosen.kind === 'group') {
        const flag = state.groups[chosen.id]!.flag
        spot = at(flag.x, flag.y)
      } else if (chosen.kind === 'hut') {
        const hut = state.huts[chosen.id]
        if (!hut) {
          ring.visible = false
          return
        }
        spot = at(hut.x, hut.y)
      } else {
        const plants =
          chosen.kind === 'bush' ? layout!.bushes : chosen.kind === 'stone' ? layout!.stones : layout!.trees
        spot = at(plants.x[chosen.id]!, plants.y[chosen.id]!)
      }
      ring.position.set(spot.x, ring === selectRing ? 0.04 : 0.035, spot.z)
      ring.scale.setScalar(
        chosen.kind === 'bush'
          ? 1.1
          : chosen.kind === 'group'
            ? 0.7
            : chosen.kind === 'hut'
              ? 2
              : chosen.kind === 'stone'
                ? 0.9
                : 1.8,
      )
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
    if (object === stumps) return { kind: 'tree', id: instance }
    if (object === deadwood) return { kind: 'tree', id: Math.floor(instance / DEADWOOD_STICKS) }
    if (object === rocks) return { kind: 'stone', id: Math.floor(instance / config!.stonesPerSpot) }
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
    const plants = [leaves, berryMesh, trunks, crowns, stumps, deadwood, rocks].filter((mesh) => mesh !== null)
    const shown = (object: { visible: boolean; parent: unknown } | null): boolean =>
      !object || (object.visible && shown(object.parent as typeof object))
    const hit = raycaster
      .intersectObjects([band, flagGroup, hutGroup, ...plants], true)
      .find((found) => shown(found.object))
    const foragerId = hit?.object.userData.foragerId as number | undefined
    const groupId = hit?.object.userData.groupId as number | undefined
    const hutId = hit?.object.userData.hutId as number | undefined
    callbacks.onPick(
      foragerId !== undefined
        ? { kind: 'forager', id: foragerId }
        : groupId !== undefined
          ? { kind: 'group', id: groupId }
          : hutId !== undefined
            ? { kind: 'hut', id: hutId }
            : plantOf(hit?.object, hit?.instanceId),
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
    showGroup,
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
        firewoodMaterial,
        deadwoodGeometry,
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
        poleGeometry,
        poleMaterial,
        clothGeometry,
        discGeometry,
        sashGeometry,
        ...hutPieces.flat().map((piece) => piece.geometry),
        ...barkMaterials,
        logEndMaterial,
        shoulderLogGeometry,
        rockGeometry,
        rockMaterial,
        axeHandleGeometry,
        axeHeadGeometry,
        axeHeadMaterial,
        circleGeometry,
        swapMaterial,
        freshSiteMaterial,
        staleSiteMaterial,
      ])
        disposable.dispose()
      for (const ring of [followRing, targetRing, selectRing, ...memberRings])
        (ring.material as InstanceType<Three['MeshBasicMaterial']>).dispose()
      for (const line of memberLines) {
        line.geometry.dispose()
        ;(line.material as InstanceType<Three['LineBasicMaterial']>).dispose()
      }
      ashMaterial.dispose()
      pinLayer.remove()
      for (const loop of [perception, sight]) (loop.material as InstanceType<Three['LineBasicMaterial']>).dispose()
      for (const arc of swapArcs) arc.line.geometry.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
