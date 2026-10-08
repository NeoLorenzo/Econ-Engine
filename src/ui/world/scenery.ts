import type { BufferGeometry, Mesh } from 'three'
import type { WorldEntity } from '../worldViewModel'
import { Builder, stableHash, type MergeGeometries, type Three } from './buildings'

/** Tiles of countryside around the grid, where the forest is thickest. */
export const SCENERY_MARGIN = 5
/** How far a tree or bush may sit from its tile centre, so it never reaches a building on the next tile. */
export const SCENERY_JITTER = 0.25

export type SceneryKind = 'pine' | 'oak' | 'bush'

export interface SceneryItem {
  kind: SceneryKind
  x: number
  z: number
  rotation: number
  scale: number
}

export interface GrassTile {
  x: number
  z: number
  /** 0–1, varies the grass colour from tile to tile. */
  shade: number
  inside: boolean
}

export interface SceneryLayout {
  items: SceneryItem[]
  tiles: GrassTile[]
  /** The island's extent in world units, edge to edge. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

/** A small seeded generator (mulberry32), so each tile draws the same numbers on every rebuild. */
function generator(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/**
 * Where grass, trees and bushes go. Decoration only: it is derived from the seed and tile, never from the simulation
 * state, so nothing moves between days. Nothing grows on a house's tile or on any tile of a plot; trees
 * are sparse among the houses and thicken into a forest across the margin.
 */
export function sceneryLayout({
  width,
  height,
  seed,
  entities,
}: {
  width: number
  height: number
  seed: number
  entities: readonly Pick<WorldEntity, 'x' | 'z' | 'footprint'>[]
}): SceneryLayout {
  const offsetX = (width - 1) / 2
  const offsetZ = (height - 1) / 2
  // Every tile a house stands on or a plot covers.
  const occupied = new Set<string>()
  for (const { x, z, footprint } of entities) {
    const left = Math.round(x + offsetX - (footprint.width - 1) / 2)
    const top = Math.round(z + offsetZ - (footprint.depth - 1) / 2)
    for (let j = top; j < top + footprint.depth; j += 1)
      for (let i = left; i < left + footprint.width; i += 1) occupied.add(`${i},${j}`)
  }
  const items: SceneryItem[] = []
  const tiles: GrassTile[] = []
  for (let j = -SCENERY_MARGIN; j < height + SCENERY_MARGIN; j += 1) {
    for (let i = -SCENERY_MARGIN; i < width + SCENERY_MARGIN; i += 1) {
      const draw = generator(stableHash(`${seed}:${i}:${j}`))
      const inside = i >= 0 && i < width && j >= 0 && j < height
      const x = i - offsetX
      const z = j - offsetZ
      tiles.push({ x, z, shade: draw(), inside })
      if (occupied.has(`${i},${j}`)) continue
      // Tiles beyond the grid's edge; 0 inside it.
      const out = Math.max(0, -i, i - (width - 1), -j, j - (height - 1))
      const treeChance = inside ? 0.16 : Math.min(0.75, 0.35 + out * 0.1)
      const bushChance = inside ? 0.1 : 0.12
      const roll = draw()
      let kind: SceneryKind | null = null
      if (roll < treeChance) kind = draw() < (inside ? 0.4 : 0.6) ? 'pine' : 'oak'
      else if (roll < treeChance + bushChance) kind = 'bush'
      if (!kind) continue
      items.push({
        kind,
        x: x + (draw() - 0.5) * 2 * SCENERY_JITTER,
        z: z + (draw() - 0.5) * 2 * SCENERY_JITTER,
        rotation: draw() * Math.PI * 2,
        scale: inside ? 0.8 + draw() * 0.3 : 0.9 + draw() * 0.5,
      })
    }
  }
  return {
    items,
    tiles,
    bounds: {
      minX: -offsetX - 0.5 - SCENERY_MARGIN,
      maxX: offsetX + 0.5 + SCENERY_MARGIN,
      minZ: -offsetZ - 0.5 - SCENERY_MARGIN,
      maxZ: offsetZ + 0.5 + SCENERY_MARGIN,
    },
  }
}

const COLORS = {
  trunk: 0x6b4a32,
  pine: [0x2c5f35, 0x316b3b, 0x377541],
  oak: [0x4c8a3d, 0x5a9a46],
  bush: [0x52803a, 0x5e8f42],
  earth: 0x4a3a2a,
} as const

/** Grass colours: the town's tiles are a little lighter than the countryside around them. */
function grassColor(tile: GrassTile) {
  const [r, g, b] = tile.inside ? [0x3d, 0x68, 0x35] : [0x34, 0x5c, 0x2f]
  const lift = Math.round((tile.shade - 0.5) * 14)
  return ((r + lift) << 16) | ((g + lift) << 8) | (b + lift)
}

/** Low-poly tree and bush geometries, each standing on the ground at the origin. */
export function sceneryGeometry(THREE: Three, mergeGeometries: MergeGeometries, kind: SceneryKind): BufferGeometry {
  const b = new Builder(THREE)
  const cone = (radius: number, h: number, bottom: number, color: number) =>
    b.add(new THREE.ConeGeometry(radius, h, 7), color, { y: bottom + h / 2 })
  const blob = (radius: number, x: number, y: number, z: number, color: number) =>
    b.add(new THREE.IcosahedronGeometry(radius, 0), color, { x, y, z })
  if (kind === 'pine') {
    b.cylinder(0.035, 0.12, 0, 0, 0, COLORS.trunk)
    cone(0.2, 0.28, 0.08, COLORS.pine[0])
    cone(0.15, 0.24, 0.2, COLORS.pine[1])
    cone(0.1, 0.2, 0.32, COLORS.pine[2])
  } else if (kind === 'oak') {
    b.cylinder(0.035, 0.18, 0, 0, 0, COLORS.trunk)
    blob(0.19, 0, 0.3, 0, COLORS.oak[0])
    blob(0.12, 0.08, 0.4, -0.05, COLORS.oak[1])
  } else {
    blob(0.11, 0, 0.06, 0, COLORS.bush[0])
    blob(0.08, 0.08, 0.05, 0.04, COLORS.bush[1])
  }
  const geometry = b.build(mergeGeometries)
  // An icosahedron's lowest point sits below its centre; nothing may sink under the grass.
  const lift = -geometry.boundingBox!.min.y
  if (lift > 0) {
    geometry.translate(0, lift, 0)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }
  return geometry
}

/** The island under the town: one grass tile per tile, with earth sides down to `ISLAND_DEPTH`. */
export const ISLAND_DEPTH = 0.6
/** The grass sits just below the grid lines and territory tiles, and above the plain ground it covers. */
export const GRASS_Y = -0.008

function islandGeometry(THREE: Three, mergeGeometries: MergeGeometries, layout: SceneryLayout) {
  const b = new Builder(THREE)
  for (const tile of layout.tiles)
    b.add(new THREE.PlaneGeometry(1, 1), grassColor(tile), { x: tile.x, y: GRASS_Y, z: tile.z, rx: -Math.PI / 2 })
  const { minX, maxX, minZ, maxZ } = layout.bounds
  const width = maxX - minX
  const depth = maxZ - minZ
  const y = GRASS_Y - ISLAND_DEPTH / 2
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  b.add(new THREE.PlaneGeometry(width, ISLAND_DEPTH), COLORS.earth, { x: cx, y, z: maxZ })
  b.add(new THREE.PlaneGeometry(width, ISLAND_DEPTH), COLORS.earth, { x: cx, y, z: minZ, ry: Math.PI })
  b.add(new THREE.PlaneGeometry(depth, ISLAND_DEPTH), COLORS.earth, { x: maxX, y, z: cz, ry: Math.PI / 2 })
  b.add(new THREE.PlaneGeometry(depth, ISLAND_DEPTH), COLORS.earth, { x: minX, y, z: cz, ry: -Math.PI / 2 })
  return b.build(mergeGeometries)
}

/** Builds the island, trees and bushes as one group: one mesh for the island and one instanced mesh per kind. */
export function createScenery(THREE: Three, mergeGeometries: MergeGeometries, layout: SceneryLayout) {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  })
  const island = new THREE.Mesh(islandGeometry(THREE, mergeGeometries, layout), material)
  island.receiveShadow = true
  group.add(island)

  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  for (const kind of ['pine', 'oak', 'bush'] as const) {
    const items = layout.items.filter((item) => item.kind === kind)
    if (!items.length) continue
    const mesh = new THREE.InstancedMesh(sceneryGeometry(THREE, mergeGeometries, kind), material, items.length)
    items.forEach((item, index) => {
      position.set(item.x, GRASS_Y, item.z)
      rotation.setFromAxisAngle(up, item.rotation)
      scale.setScalar(item.scale)
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.castShadow = true
    group.add(mesh)
  }

  return {
    group,
    dispose() {
      group.traverse((object) => (object as Mesh).geometry?.dispose())
      material.dispose()
    },
  }
}
