import type * as ThreeModule from 'three'
import type { BufferGeometry, Color, MeshStandardMaterial } from 'three'
import type { IndustryId } from '../../sim/types'
import { hex, palette } from '../theme'
import type { HouseTier, WorldEntity } from '../worldViewModel'

export type Three = typeof ThreeModule
export type MergeGeometries = (geometries: BufferGeometry[], useGroups?: boolean) => BufferGeometry | null

/** One building type: a house tier, an industry's firm building, or Government. */
export type ArchetypeId = `house-${HouseTier}` | IndustryId | 'government'

export const ARCHETYPES: readonly ArchetypeId[] = [
  'house-0',
  'house-1',
  'house-2',
  'house-3',
  'food',
  'utilities',
  'healthcare',
  'entertainment',
  'transport',
  'government',
]

/** Widest a building may be, in tiles, so neighbours never overlap. */
export const HOUSE_FOOTPRINT = 0.5
export const BUILDING_FOOTPRINT = 0.8

export function buildingArchetype(entity: Pick<WorldEntity, 'id' | 'kind' | 'industryId' | 'tier'>): ArchetypeId {
  if (entity.kind === 'household') return `house-${entity.tier ?? 0}`
  if (entity.kind === 'government') return 'government'
  if (!entity.industryId) throw new Error(`Firm ${entity.id} has no industry to choose a building for`)
  return entity.industryId
}

/**
 * Which way a building faces, in radians: one of four quarter-turns, picked from a hash of the entity ID so it is
 * scattered across the town but never changes between days. Quarter-turns keep every footprint square to its tile.
 */
export function buildingRotation(entityId: string) {
  return (stableHash(entityId) % 4) * (Math.PI / 2)
}

/** A stable unsigned 32-bit FNV-1a hash, for decoration that must look random but never change between frames. */
export function stableHash(text: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const COLORS = {
  wall: hex(palette.household),
  shackWall: 0xb9ab8a,
  roof: 0x8c5a43,
  shackRoof: 0x6e5040,
  window: 0xf2d27c,
  door: 0x4a3a2e,
  plot: 0x252d29,
  pavement: 0x2b3330,
  stone: 0xd9d3c4,
  concrete: 0xa9b0ac,
  steel: 0xb7bfbb,
  chimney: 0x7c8480,
  clinic: 0xe9ecea,
  clinicRoof: 0xcfd5d2,
  cinema: 0x6b6f7d,
  cinemaRoof: 0x50535f,
  depot: 0x9aa29e,
  bus: hex(palette.warning),
  tyre: 0x1c2120,
  glass: 0x7fa9b5,
  darkGlass: 0x3b4340,
  civic: 0xe3deef,
  civicStep: 0xcfc9dc,
  column: 0xf1eef7,
  crate: 0x9b7a4f,
  produce: hex(palette.positive),
  pool: 0x4fa3c7,
} as const

/** Firm and Government buildings are stretched upwards so they stand above the houses around them. */
const LANDMARK_STRETCH = 1.25

interface Placement {
  x?: number
  y?: number
  z?: number
  rx?: number
  ry?: number
  rz?: number
}

/** Collects primitive parts, each placed and coloured, and merges them into one geometry. */
export class Builder {
  private readonly parts: { geometry: BufferGeometry; color: number; accent: boolean }[] = []

  constructor(readonly THREE: Three) {}

  /** Adds a part built around the origin, rotated and then moved so its centre sits at (x, y, z). */
  add(geometry: BufferGeometry, color: number, at: Placement = {}, accent = false) {
    if (at.rx) geometry.rotateX(at.rx)
    if (at.ry) geometry.rotateY(at.ry)
    if (at.rz) geometry.rotateZ(at.rz)
    geometry.translate(at.x ?? 0, at.y ?? 0, at.z ?? 0)
    this.parts.push({ geometry, color, accent })
  }

  /** A box whose base sits at `bottom`. */
  box(w: number, h: number, d: number, x: number, bottom: number, z: number, color: number, accent = false) {
    this.add(new this.THREE.BoxGeometry(w, h, d), color, { x, y: bottom + h / 2, z }, accent)
  }

  /** An upright cylinder whose base sits at `bottom`. */
  cylinder(radius: number, h: number, x: number, bottom: number, z: number, color: number, accent = false) {
    this.add(new this.THREE.CylinderGeometry(radius, radius, h, 14), color, { x, y: bottom + h / 2, z }, accent)
  }

  /** A square pyramid roof, `w` wide and `d` deep, whose eaves sit at `bottom`. */
  hipRoof(w: number, h: number, d: number, x: number, bottom: number, z: number, color: number, accent = false) {
    const geometry = new this.THREE.ConeGeometry(Math.SQRT1_2, 1, 4)
    geometry.rotateY(Math.PI / 4)
    geometry.scale(w, h, d)
    this.add(geometry, color, { x, y: bottom + h / 2, z }, accent)
  }

  /** A gable roof whose ridge runs along x, `length` long and `d` deep, with its eaves at `bottom`. */
  gableRoof(length: number, h: number, d: number, x: number, bottom: number, z: number, color: number, accent = false) {
    // A three-sided cylinder turned on its side: the apex points up and the base spans z.
    const geometry = new this.THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2)
    geometry.rotateZ(Math.PI / 2)
    geometry.scale(length, h / 1.5, d / Math.sqrt(3))
    this.add(geometry, color, { x, y: bottom + h / 3, z }, accent)
  }

  /** A half sphere resting on `bottom`. */
  dome(radius: number, x: number, bottom: number, z: number, color: number, accent = false) {
    const geometry = new this.THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    this.add(geometry, color, { x, y: bottom, z }, accent)
  }

  /**
   * Merges every part into one geometry with a vertex `color` and an `accent` flag (1 where the per-entity accent
   * colour shows). `userData.top` is the roof height.
   */
  build(mergeGeometries: MergeGeometries, stretch = 1): BufferGeometry {
    const THREE = this.THREE
    const color = new THREE.Color()
    const flat = this.parts.map((part) => {
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry
      if (geometry !== part.geometry) part.geometry.dispose()
      geometry.deleteAttribute('uv')
      const count = geometry.getAttribute('position').count
      // Accent parts are white, so the accent colour replaces them exactly.
      color.setHex(part.accent ? 0xffffff : part.color)
      const colors = new Float32Array(count * 3)
      for (let index = 0; index < count; index += 1) colors.set([color.r, color.g, color.b], index * 3)
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geometry.setAttribute('accent', new THREE.BufferAttribute(new Float32Array(count).fill(part.accent ? 1 : 0), 1))
      return geometry
    })
    const merged = mergeGeometries(flat)
    flat.forEach((geometry) => geometry.dispose())
    if (!merged) throw new Error('Unable to merge building parts')
    if (stretch !== 1) merged.scale(1, stretch, 1)
    merged.computeBoundingBox()
    merged.computeBoundingSphere()
    merged.userData.top = merged.boundingBox!.max.y
    return merged
  }
}

/** Front windows and doors sit just proud of the wall they belong to. */
const PROUD = 0.006

function house(b: Builder, tier: HouseTier) {
  if (tier === 0) {
    // Shack: one small room under a low roof.
    b.box(0.46, 0.04, 0.46, 0, 0, 0, COLORS.plot)
    b.box(0.3, 0.22, 0.28, 0, 0.04, 0, COLORS.shackWall)
    b.hipRoof(0.36, 0.14, 0.34, 0, 0.26, 0, COLORS.shackRoof)
    b.box(0.07, 0.12, 0.01, 0.05, 0.04, 0.14 + PROUD, COLORS.door)
    return
  }
  if (tier === 1) {
    // Cottage: a chimney and two lit windows.
    b.box(0.48, 0.04, 0.48, 0, 0, 0, COLORS.plot)
    b.box(0.36, 0.3, 0.32, 0, 0.04, 0, COLORS.wall)
    b.hipRoof(0.42, 0.2, 0.38, 0, 0.34, 0, COLORS.roof)
    b.box(0.05, 0.16, 0.05, 0.1, 0.42, -0.06, COLORS.chimney)
    b.box(0.07, 0.14, 0.01, 0, 0.04, 0.16 + PROUD, COLORS.door)
    for (const x of [-0.11, 0.11]) b.box(0.06, 0.06, 0.01, x, 0.18, 0.16 + PROUD, COLORS.window)
    return
  }
  if (tier === 2) {
    // Two-storey house under a gable roof.
    b.box(0.5, 0.04, 0.5, 0, 0, 0, COLORS.plot)
    b.box(0.38, 0.52, 0.34, 0, 0.04, 0, COLORS.wall)
    b.gableRoof(0.42, 0.2, 0.4, 0, 0.56, 0, COLORS.roof)
    b.box(0.07, 0.14, 0.01, 0, 0.04, 0.17 + PROUD, COLORS.door)
    for (const bottom of [0.2, 0.4]) {
      for (const x of [-0.11, 0.11]) b.box(0.07, 0.07, 0.01, x, bottom, 0.17 + PROUD, COLORS.window)
      b.box(0.01, 0.07, 0.07, 0.19 + PROUD, bottom, 0, COLORS.window)
      b.box(0.01, 0.07, 0.07, -0.19 - PROUD, bottom, 0, COLORS.window)
    }
    return
  }
  // Villa: a tower, a lower wing and a pool.
  b.box(0.5, 0.04, 0.5, 0, 0, 0, COLORS.plot)
  b.box(0.3, 0.6, 0.3, -0.08, 0.04, -0.06, COLORS.wall)
  b.hipRoof(0.34, 0.2, 0.34, -0.08, 0.64, -0.06, COLORS.roof)
  b.box(0.22, 0.32, 0.22, 0.12, 0.04, 0.08, COLORS.wall)
  b.box(0.24, 0.03, 0.24, 0.12, 0.36, 0.08, COLORS.roof)
  b.box(0.16, 0.012, 0.12, -0.14, 0.04, 0.17, COLORS.pool)
  b.box(0.07, 0.14, 0.01, 0.12, 0.04, 0.19 + PROUD, COLORS.door)
  for (const bottom of [0.24, 0.46]) b.box(0.07, 0.08, 0.01, -0.15, bottom, 0.09 + PROUD, COLORS.window)
  b.box(0.01, 0.08, 0.07, -0.23 - PROUD, 0.46, -0.06, COLORS.window)
  b.box(0.01, 0.08, 0.07, 0.23 + PROUD, 0.16, 0.08, COLORS.window)
}

function firm(b: Builder, id: ArchetypeId) {
  b.box(0.8, 0.05, 0.8, 0, 0, 0, COLORS.pavement)
  if (id === 'food') {
    // Market hall: an awning over a shop window, crates of produce out front.
    b.box(0.62, 0.42, 0.46, 0, 0.05, -0.08, COLORS.stone)
    b.gableRoof(0.68, 0.2, 0.52, 0, 0.47, -0.08, COLORS.stone, true)
    b.add(new b.THREE.BoxGeometry(0.62, 0.03, 0.18), COLORS.stone, { y: 0.36, z: 0.23, rx: 0.35 }, true)
    b.box(0.4, 0.18, 0.01, 0, 0.1, 0.15 + PROUD, COLORS.glass)
    b.box(0.09, 0.08, 0.09, -0.24, 0.05, 0.3, COLORS.crate)
    b.box(0.09, 0.08, 0.09, 0.24, 0.05, 0.3, COLORS.crate)
    b.box(0.07, 0.02, 0.07, -0.24, 0.13, 0.3, COLORS.produce)
  } else if (id === 'utilities') {
    // Plant: a hall, a tall chimney and a storage tank.
    b.box(0.44, 0.4, 0.5, -0.14, 0.05, 0, COLORS.concrete)
    b.box(0.46, 0.04, 0.52, -0.14, 0.45, 0, COLORS.concrete, true)
    b.box(0.3, 0.06, 0.01, -0.14, 0.3, 0.25 + PROUD, COLORS.glass)
    b.cylinder(0.055, 1.1, 0.22, 0.05, -0.2, COLORS.chimney)
    b.cylinder(0.062, 0.08, 0.22, 0.98, -0.2, COLORS.chimney, true)
    b.cylinder(0.13, 0.34, 0.2, 0.05, 0.18, COLORS.steel)
    b.dome(0.13, 0.2, 0.39, 0.18, COLORS.steel, true)
  } else if (id === 'healthcare') {
    // Clinic: a white block with a cross on the roof and over the door.
    b.box(0.6, 0.5, 0.5, 0, 0.05, -0.04, COLORS.clinic)
    b.box(0.62, 0.04, 0.52, 0, 0.55, -0.04, COLORS.clinicRoof)
    b.box(0.26, 0.05, 0.08, 0, 0.59, -0.04, COLORS.clinic, true)
    b.box(0.08, 0.05, 0.26, 0, 0.59, -0.04, COLORS.clinic, true)
    b.box(0.12, 0.04, 0.01, 0, 0.4, 0.21 + PROUD, COLORS.clinic, true)
    b.box(0.04, 0.12, 0.01, 0, 0.36, 0.21 + PROUD, COLORS.clinic, true)
    b.box(0.14, 0.18, 0.01, 0, 0.05, 0.21 + PROUD, COLORS.glass)
    b.box(0.26, 0.03, 0.12, 0, 0.24, 0.27, COLORS.clinicRoof)
    for (const x of [-0.19, 0.19])
      for (const bottom of [0.14, 0.32]) b.box(0.12, 0.08, 0.01, x, bottom, 0.21 + PROUD, COLORS.glass)
  } else if (id === 'entertainment') {
    // Cinema: a dark hall, a lit marquee and a tall sign.
    b.box(0.62, 0.62, 0.5, 0, 0.05, -0.06, COLORS.cinema)
    b.box(0.64, 0.04, 0.52, 0, 0.67, -0.06, COLORS.cinemaRoof)
    b.box(0.66, 0.1, 0.16, 0, 0.32, 0.27, COLORS.cinema, true)
    b.box(0.08, 0.34, 0.05, 0.2, 0.42, 0.215, COLORS.cinema, true)
    b.box(0.3, 0.2, 0.01, 0, 0.05, 0.19 + PROUD, COLORS.darkGlass)
    for (const x of [-0.24, 0.24]) b.box(0.08, 0.16, 0.01, x, 0.08, 0.19 + PROUD, COLORS.window)
  } else if (id === 'transport') {
    // Depot: a garage hall with two doors and a bus on the forecourt.
    b.box(0.7, 0.36, 0.4, 0, 0.05, -0.18, COLORS.depot)
    b.gableRoof(0.72, 0.14, 0.42, 0, 0.41, -0.18, COLORS.depot, true)
    for (const x of [-0.17, 0.17]) b.box(0.22, 0.24, 0.01, x, 0.05, 0.02 + PROUD, COLORS.darkGlass)
    b.box(0.4, 0.13, 0.14, 0, 0.09, 0.24, COLORS.bus)
    b.box(0.34, 0.04, 0.146, 0, 0.15, 0.24, COLORS.glass)
    for (const x of [-0.13, 0.13])
      b.add(new b.THREE.CylinderGeometry(0.035, 0.035, 0.15, 12), COLORS.tyre, {
        x,
        y: 0.085,
        z: 0.24,
        rx: Math.PI / 2,
      })
  }
}

function government(b: Builder) {
  // A civic hall on steps, with a colonnade and a dome.
  b.box(0.8, 0.05, 0.8, 0, 0, 0, COLORS.civicStep)
  b.box(0.7, 0.05, 0.7, 0, 0.05, 0, COLORS.civicStep)
  b.box(0.56, 0.42, 0.4, 0, 0.1, -0.08, COLORS.civic)
  for (const x of [-0.24, -0.12, 0, 0.12, 0.24]) b.cylinder(0.025, 0.38, x, 0.1, 0.2, COLORS.column)
  b.box(0.6, 0.04, 0.18, 0, 0.48, 0.17, COLORS.civic)
  b.box(0.58, 0.04, 0.42, 0, 0.52, -0.08, COLORS.civic)
  b.cylinder(0.19, 0.08, 0, 0.56, -0.08, COLORS.civic)
  b.dome(0.17, 0, 0.64, -0.08, COLORS.civic, true)
  b.cylinder(0.015, 0.1, 0, 0.8, -0.08, COLORS.civic, true)
}

export interface BuildingKit {
  /** The shared geometry for a building type, built on first use. Meshes must never dispose it themselves. */
  geometry(id: ArchetypeId): BufferGeometry
  /** A new material for one building. `setAccent` tints its accent surfaces (roof, awning, marquee, cross, dome). */
  material(): MeshStandardMaterial & { userData: { accent: Color } }
  /** Disposes every cached geometry. */
  dispose(): void
}

/** Sets a building material's accent colour. */
export function setAccent(material: ReturnType<BuildingKit['material']>, color: number) {
  material.userData.accent.setHex(color)
}

/**
 * Procedural low-poly buildings. Each type is merged into one geometry and cached, so every house of a tier shares
 * one geometry and each entity costs one mesh and one material.
 */
export function createBuildingKit(THREE: Three, mergeGeometries: MergeGeometries): BuildingKit {
  const cache = new Map<ArchetypeId, BufferGeometry>()
  return {
    geometry(id) {
      let geometry = cache.get(id)
      if (geometry) return geometry
      const builder = new Builder(THREE)
      if (id.startsWith('house-')) {
        house(builder, Number(id.slice('house-'.length)) as HouseTier)
        geometry = builder.build(mergeGeometries)
      } else if (id === 'government') {
        government(builder)
        geometry = builder.build(mergeGeometries, LANDMARK_STRETCH)
      } else {
        firm(builder, id)
        geometry = builder.build(mergeGeometries, LANDMARK_STRETCH)
      }
      cache.set(id, geometry)
      return geometry
    },
    material() {
      const accent = new THREE.Color(0xffffff)
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 })
      material.userData.accent = accent
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uAccent = { value: accent }
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float accent;\nvarying float vAccent;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAccent = accent;')
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uAccent;\nvarying float vAccent;')
          .replace(
            '#include <color_fragment>',
            '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uAccent, vAccent);',
          )
      }
      // Every building shares one shader program; only the uniform differs.
      material.customProgramCacheKey = () => 'econ-building'
      return material as ReturnType<BuildingKit['material']>
    },
    dispose() {
      for (const geometry of cache.values()) geometry.dispose()
      cache.clear()
    },
  }
}
