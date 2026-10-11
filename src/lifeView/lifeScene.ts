import type { Group, Line, LineLoop, Mesh, MeshStandardMaterial, PointLight } from 'three'
import type { LifeState } from '../life/types'
import { campTile } from '../life/world'
import { hex, palette } from '../ui/theme'
import { woodTarget } from '../life/wood'
import {
  bundleScale,
  bushScale,
  crownScale,
  currentEvent,
  currentGifts,
  currentSwaps,
  daylightAt,
  displayedCarried,
  displayedGroveWood,
  displayedStock,
  displayedWood,
  displayHours,
  foragerColor,
  foragerPose,
  giftArcPoint,
  giftEnds,
  hearthAt,
  logScale,
  pairOffsets,
  perceptionOutline,
  seesEverything,
  sunAt,
  swapEnds,
  type DisplayPair,
} from './lifeViewModel'

type Three = typeof import('three')

const NIGHT_SKY = 0x070a12
const DAY_SKY = 0x6f97ab
const LUSH = 0x3f8f4a
const BARE = 0x7a6440
const GRASS = 0x2f5a35
const GRASS_EDGE = 0x24432a
const DEAD = 0x6b6b66
const BUNDLE = 0xb07a45
const STONE = 0x6f6a60
const FLAME = 0xffa040
const EMBER = 0x3a3330
const WOOD = 0x7a5232
const TRUNK = 0x5a3d26
const CROWN = 0x2d6b3c
/** Points along each gift's arc. */
const ARC_POINTS = 24

/** What a click picked out: a patch or grove to inspect, or a forager to follow. */
export type LifePick = { kind: 'patch'; id: number } | { kind: 'grove'; id: number } | { kind: 'forager'; id: number }

/** A site the inspector shows. */
export type LifeSite = { kind: 'patch' | 'grove'; id: number }

export interface DrawOptions {
  interpolate: boolean
  selected: LifeSite | null
  followedId: number
  nowMs: number
}

export interface LifeScene {
  /** Rebuilds the board, bushes and band for a new run. */
  setWorld(state: LifeState): void
  draw(pair: DisplayPair, options: DrawOptions): void
  dispose(): void
}

interface Bush {
  group: Group
  material: MeshStandardMaterial
}

/** A grove is a tree whose crown shrinks as its wood runs low. */
interface Tree {
  group: Group
  crown: Group
}

/** Builds the scene inside `mount`. The caller drives drawing; nothing renders until `draw` is called. */
interface Figure {
  group: Group
  body: Group
  material: MeshStandardMaterial
  /** What it carries, slung at its side. */
  bundle: Mesh
  /** The wood it holds, stacked at its other side. */
  logs: Group
  /** Its hearth at camp, shown while it sleeps: lit while it burns wood, dark when it sleeps cold. */
  hearth: Group
  hearthFlame: Mesh
}

interface Camp {
  group: Group
  flame: Mesh
  glow: PointLight
}

/** A gift's arc and the parcel travelling along it. */
interface Arc {
  line: Line
  parcel: Mesh
}

/** A swap's arc, with wood travelling from seller to buyer and food the other way. */
interface SwapArc {
  line: Line
  wood: Mesh
  food: Mesh
}

export async function createLifeScene(mount: HTMLElement, onPick: (pick: LifePick | null) => void): Promise<LifeScene> {
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
    'The band’s world. Drag to orbit, scroll to zoom, click a bush or tree to inspect it or a forager to follow it.',
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
  let trees: Tree[] = []
  let ground: Mesh | null = null
  let gridLines: InstanceType<Three['LineSegments']> | null = null
  let gridWidth = 1
  let gridHeight = 1
  const toWorld = (x: number, y: number) => ({ x: x - (gridWidth - 1) / 2, z: y - (gridHeight - 1) / 2 })

  // Shared geometry: every bush is three leafy lobes; every forager is a capsule and a head.
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

  const torsoGeometry = new THREE.CapsuleGeometry(0.14, 0.36, 4, 10)
  const headGeometry = new THREE.SphereGeometry(0.12, 16, 12)
  const bundleGeometry = new THREE.DodecahedronGeometry(0.11, 0)
  const bundleMaterial = new THREE.MeshStandardMaterial({ color: BUNDLE, roughness: 0.9, flatShading: true })
  const logGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6)
  const woodMaterial = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.9, flatShading: true })
  const trunkGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6)
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 1, flatShading: true })
  const crownGeometry = new THREE.ConeGeometry(0.32, 0.7, 7)
  const crownMaterial = new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.85, flatShading: true })
  const hearthFlameGeometry = new THREE.ConeGeometry(0.05, 0.16, 6)
  const hearthLitMaterial = new THREE.MeshStandardMaterial({
    color: FLAME,
    emissive: FLAME,
    emissiveIntensity: 1.6,
    roughness: 0.6,
  })
  const emberMaterial = new THREE.MeshStandardMaterial({ color: EMBER, roughness: 1, flatShading: true })
  let figures: Figure[] = []
  const band = new THREE.Group()
  scene.add(band)

  // The followed forager wears the accent ring at its feet; its body keeps its strategy's colour.
  const followRing = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.95 }),
  )
  followRing.rotation.x = -Math.PI / 2
  followRing.scale.setScalar(0.62)
  scene.add(followRing)

  // The camp: a ring of stones around a fire that glows at night.
  const stoneGeometry = new THREE.DodecahedronGeometry(0.07, 0)
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: STONE, roughness: 1, flatShading: true })
  const flameGeometry = new THREE.ConeGeometry(0.1, 0.32, 7)
  const flameMaterial = new THREE.MeshStandardMaterial({
    color: FLAME,
    emissive: FLAME,
    emissiveIntensity: 1.4,
    roughness: 0.6,
  })
  let camp: Camp | null = null

  // Gifts in the hour being drawn: an arc from giver to recipient, with a parcel travelling along it.
  const parcelGeometry = new THREE.DodecahedronGeometry(0.08, 0)
  const arcMaterial = new THREE.LineBasicMaterial({ color: hex(palette.positive), transparent: true, opacity: 0.9 })
  const arcs: Arc[] = []
  const arcGroup = new THREE.Group()
  scene.add(arcGroup)
  function arcAt(index: number): Arc {
    while (arcs.length <= index) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ARC_POINTS * 3), 3))
      const line = new THREE.Line(geometry, arcMaterial)
      const parcel = new THREE.Mesh(parcelGeometry, bundleMaterial)
      arcGroup.add(line, parcel)
      arcs.push({ line, parcel })
    }
    return arcs[index]!
  }

  // The followed forager's perception: the outline of every tile within its radius.
  let perception: LineLoop | null = null

  // Swaps in the hour being drawn: an arc between seller and buyer, wood going one way and food the other.
  const swapMaterial = new THREE.LineBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.9 })
  const swapArcs: SwapArc[] = []
  function swapArcAt(index: number): SwapArc {
    while (swapArcs.length <= index) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ARC_POINTS * 3), 3))
      const line = new THREE.Line(geometry, swapMaterial)
      const wood = new THREE.Mesh(logGeometry, woodMaterial)
      wood.rotation.z = Math.PI / 2
      const food = new THREE.Mesh(parcelGeometry, bundleMaterial)
      arcGroup.add(line, wood, food)
      swapArcs.push({ line, wood, food })
    }
    return swapArcs[index]!
  }

  function makeFigure(id: number): Figure {
    const material = new THREE.MeshStandardMaterial({ color: hex(palette.household), roughness: 0.7 })
    const group = new THREE.Group()
    const body = new THREE.Group()
    const torso = new THREE.Mesh(torsoGeometry, material)
    torso.position.y = 0.33
    const head = new THREE.Mesh(headGeometry, material)
    head.position.y = 0.68
    const bundle = new THREE.Mesh(bundleGeometry, bundleMaterial)
    bundle.position.set(0.17, 0.3, -0.04)
    for (const part of [torso, head, bundle]) {
      part.castShadow = true
      part.userData.foragerId = id
    }
    const logs = new THREE.Group()
    for (const [index, [x, y]] of [
      [-0.03, 0],
      [0.03, 0],
      [0, 0.055],
    ].entries()) {
      const log = new THREE.Mesh(logGeometry, woodMaterial)
      log.rotation.x = Math.PI / 2
      log.position.set(x!, y!, 0)
      log.castShadow = index === 0
      log.userData.foragerId = id
      logs.add(log)
    }
    logs.position.set(-0.19, 0.28, -0.02)
    body.add(torso, head, bundle, logs)
    group.add(body)
    // The hearth sits beside the sleeper, so it does not tip over with the body.
    const hearth = new THREE.Group()
    for (let index = 0; index < 5; index += 1) {
      const stone = new THREE.Mesh(stoneGeometry, emberMaterial)
      const angle = (index / 5) * Math.PI * 2
      stone.position.set(0.09 * Math.cos(angle), 0.03, 0.09 * Math.sin(angle))
      stone.scale.setScalar(0.6)
      hearth.add(stone)
    }
    const hearthFlame = new THREE.Mesh(hearthFlameGeometry, hearthLitMaterial)
    hearthFlame.position.y = 0.09
    hearth.add(hearthFlame)
    hearth.position.set(0.3, 0, 0.12)
    group.add(hearth)
    band.add(group)
    return { group, body, material, bundle, logs, hearth, hearthFlame }
  }

  function clearWorld() {
    for (const figure of figures) {
      figure.material.dispose()
      band.remove(figure.group)
    }
    figures = []
    if (camp) {
      scene.remove(camp.group)
      camp.glow.dispose()
      camp = null
    }
    if (perception) {
      perception.geometry.dispose()
      ;(perception.material as InstanceType<Three['LineBasicMaterial']>).dispose()
      scene.remove(perception)
      perception = null
    }
    for (const bush of bushes) {
      bush.material.dispose()
      world.remove(bush.group)
    }
    bushes = []
    for (const tree of trees) world.remove(tree.group)
    trees = []
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

    for (const grove of state.groves) {
      const group = new THREE.Group()
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
      trunk.position.y = 0.2
      const crown = new THREE.Group()
      for (const [height, scale] of [
        [0.55, 1],
        [0.85, 0.75],
      ] as const) {
        const cone = new THREE.Mesh(crownGeometry, crownMaterial)
        cone.position.y = height - 0.35
        cone.scale.setScalar(scale)
        cone.castShadow = true
        cone.userData.groveId = grove.id
        crown.add(cone)
      }
      crown.position.y = 0.35
      trunk.castShadow = true
      trunk.userData.groveId = grove.id
      group.add(trunk, crown)
      const { x, z } = toWorld(grove.tile.x, grove.tile.y)
      group.position.set(x, 0, z)
      world.add(group)
      trees.push({ group, crown })
    }

    const campAt = campTile(state.config)
    if (campAt) {
      const group = new THREE.Group()
      for (let index = 0; index < 8; index += 1) {
        const stone = new THREE.Mesh(stoneGeometry, stoneMaterial)
        const angle = (index / 8) * Math.PI * 2
        stone.position.set(0.2 * Math.cos(angle), 0.04, 0.2 * Math.sin(angle))
        stone.castShadow = true
        group.add(stone)
      }
      const flame = new THREE.Mesh(flameGeometry, flameMaterial)
      flame.position.y = 0.16
      const glow = new THREE.PointLight(FLAME, 0, 6, 1.6)
      glow.position.y = 0.5
      group.add(flame, glow)
      const { x, z } = toWorld(campAt.x, campAt.y)
      // A patch on the camp tile keeps the middle; the fire moves to a corner.
      const shared = state.patches.some((patch) => patch.tile.x === campAt.x && patch.tile.y === campAt.y)
      group.position.set(x + (shared ? -0.3 : 0), 0, z + (shared ? 0.3 : 0))
      scene.add(group)
      camp = { group, flame, glow }
    }

    figures = state.foragers.map((forager) => makeFigure(forager.id))
    const outline = perceptionOutline(state.config.perceptionRadiusTiles).flatMap(([x, y]) => [x, 0.02, y])
    const outlineGeometry = new THREE.BufferGeometry()
    outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outline, 3))
    perception = new THREE.LineLoop(
      outlineGeometry,
      new THREE.LineBasicMaterial({ color: hex(palette.accent), transparent: true, opacity: 0.55 }),
    )
    // Full information needs no outline: it would only frame the whole board.
    perception.userData.shown = !seesEverything(state)
    scene.add(perception)

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

  function draw(pair: DisplayPair, { interpolate, selected, followedId, nowMs }: DrawOptions) {
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

    for (const [id, tree] of trees.entries())
      tree.crown.scale.setScalar(crownScale(displayedGroveWood(pair, id, interpolate), config.groveCapacityWood))

    if (camp) {
      // The fire burns all the time and glows once the light fades; the flicker is only for the eye.
      const flicker = 1 + 0.12 * Math.sin(nowMs / 90) + 0.08 * Math.sin(nowMs / 37)
      camp.flame.scale.set(1, flicker, 1)
      camp.glow.intensity = (1 - light) * 2.2 * flicker
    }

    const offsets = pairOffsets(pair)
    for (const [id, figure] of figures.entries()) {
      const pose = foragerPose(pair, id, interpolate, offsets)
      const position = toWorld(pose.x + pose.offsetX, pose.y + pose.offsetY)
      // Each forager bobs out of step with the others.
      const bob = pose.walking ? Math.abs(Math.sin(nowMs / 110 + id)) * 0.04 : 0
      figure.group.position.set(position.x, bob, position.z)
      if (pose.heading !== null) figure.group.rotation.y = pose.heading
      // Lying down tips the body over at the feet.
      figure.body.rotation.x = (-Math.PI / 2) * pose.lying
      figure.body.position.y = 0.14 * pose.lying
      const forager = pair.next.foragers[id]!
      figure.material.color.set(!forager.alive ? DEAD : hex(foragerColor(config, forager)))
      const bundle = bundleScale(displayedCarried(pair, id, interpolate), config.harvestKcal)
      figure.bundle.visible = bundle > 0
      figure.bundle.scale.setScalar(Math.max(bundle, 0.01))
      const logs = logScale(displayedWood(pair, id, interpolate), woodTarget(config))
      figure.logs.visible = logs > 0
      figure.logs.scale.setScalar(Math.max(logs, 0.01))
      // The hearth shows once the forager has lain down for the night.
      const hearth = interpolate || pose.lying > 0 ? hearthAt(pair, id) : null
      figure.hearth.visible = hearth !== null && pose.lying > 0.5
      figure.hearthFlame.visible = hearth === 'lit'
      if (hearth === 'lit') figure.hearthFlame.scale.set(1, 1 + 0.15 * Math.sin(nowMs / 80 + id * 1.7), 1)
      if (id === followedId) {
        followRing.position.set(position.x, 0.02, position.z)
        if (perception) {
          // The radius is measured from the tile the forager stands on, so the outline moves with it along its path.
          const tile = toWorld(pose.x, pose.y)
          perception.position.set(tile.x, 0, tile.z)
          perception.visible = forager.alive && perception.userData.shown === true
        }
      }
    }
    followRing.visible = followedId < figures.length

    const gifts = interpolate ? currentGifts(pair) : []
    for (const [index, arc] of arcs.entries()) {
      arc.line.visible = index < gifts.length
      arc.parcel.visible = index < gifts.length
    }
    for (const [index, gift] of gifts.entries()) {
      const arc = arcAt(index)
      const { from, to } = giftEnds(gift, offsets)
      const positions = arc.line.geometry.getAttribute('position') as InstanceType<Three['BufferAttribute']>
      for (let point = 0; point < ARC_POINTS; point += 1) {
        const at = giftArcPoint(from, to, point / (ARC_POINTS - 1))
        const spot = toWorld(at.x, at.y)
        positions.setXYZ(point, spot.x, at.height, spot.z)
      }
      positions.needsUpdate = true
      arc.line.geometry.computeBoundingSphere()
      const travelling = giftArcPoint(from, to, pair.alpha)
      const parcelAt = toWorld(travelling.x, travelling.y)
      arc.parcel.position.set(parcelAt.x, travelling.height, parcelAt.z)
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
      const { from, to } = swapEnds(made, offsets)
      const positions = arc.line.geometry.getAttribute('position') as InstanceType<Three['BufferAttribute']>
      for (let point = 0; point < ARC_POINTS; point += 1) {
        const at = giftArcPoint(from, to, point / (ARC_POINTS - 1))
        const spot = toWorld(at.x, at.y)
        positions.setXYZ(point, spot.x, at.height, spot.z)
      }
      positions.needsUpdate = true
      arc.line.geometry.computeBoundingSphere()
      const woodAt = giftArcPoint(from, to, pair.alpha)
      const foodAt = giftArcPoint(from, to, 1 - pair.alpha)
      const woodSpot = toWorld(woodAt.x, woodAt.y)
      const foodSpot = toWorld(foodAt.x, foodAt.y)
      arc.wood.position.set(woodSpot.x, woodAt.height, woodSpot.z)
      arc.food.position.set(foodSpot.x, foodAt.height, foodSpot.z)
    }

    // The followed forager's target: the grove it walks to for wood, or else its patch.
    const followed = pair.next.foragers[followedId]
    const working = followed && currentEvent(pair, followedId)
    const targetTile =
      followed && working?.workedFor === 'wood' && followed.targetGroveId !== null
        ? pair.next.groves[followed.targetGroveId]!.tile
        : followed && followed.targetPatchId !== null
          ? pair.next.patches[followed.targetPatchId]!.tile
          : null
    targetRing.visible = targetTile !== null && followed!.alive
    if (targetTile) {
      const at = toWorld(targetTile.x, targetTile.y)
      targetRing.position.set(at.x, 0.02, at.z)
    }
    const selectedTile =
      selected?.kind === 'patch'
        ? pair.next.patches[selected.id]?.tile
        : selected?.kind === 'grove'
          ? pair.next.groves[selected.id]?.tile
          : undefined
    selectRing.visible = selectedTile !== undefined
    if (selectedTile) {
      const at = toWorld(selectedTile.x, selectedTile.y)
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
      [...bushes.map((bush) => bush.group), ...trees.map((tree) => tree.group), band],
      true,
    )[0]
    const foragerId = hit?.object.userData.foragerId as number | undefined
    const patchId = hit?.object.userData.patchId as number | undefined
    const groveId = hit?.object.userData.groveId as number | undefined
    onPick(
      foragerId !== undefined
        ? { kind: 'forager', id: foragerId }
        : patchId !== undefined
          ? { kind: 'patch', id: patchId }
          : groveId !== undefined
            ? { kind: 'grove', id: groveId }
            : null,
    )
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
      torsoGeometry.dispose()
      headGeometry.dispose()
      bundleGeometry.dispose()
      bundleMaterial.dispose()
      ;(followRing.material as InstanceType<Three['MeshBasicMaterial']>).dispose()
      stoneGeometry.dispose()
      stoneMaterial.dispose()
      flameGeometry.dispose()
      flameMaterial.dispose()
      for (const arc of arcs) arc.line.geometry.dispose()
      for (const arc of swapArcs) arc.line.geometry.dispose()
      parcelGeometry.dispose()
      arcMaterial.dispose()
      swapMaterial.dispose()
      logGeometry.dispose()
      woodMaterial.dispose()
      trunkGeometry.dispose()
      trunkMaterial.dispose()
      crownGeometry.dispose()
      crownMaterial.dispose()
      hearthFlameGeometry.dispose()
      hearthLitMaterial.dispose()
      emberMaterial.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
