import { GROUND_AREA, planeHeight, triangleAt, type GroundMesh } from '../valley/mesh'

/** Small, fixed brightness change per triangle id, so neighbouring facets read apart without any random draw. */
export function facetShade(t: number) {
  const h = Math.imul(t ^ 0x9e3779b9, 0x85ebca6b) >>> 0
  return 0.94 + (((h >>> 8) % 1000) / 1000) * 0.12
}

/** The visible ground's height at simulation coordinates, in centimetres: the bed under water, the mesh elsewhere. */
export function surfaceHeightAt(mesh: GroundMesh, x: number, y: number) {
  const px = Math.max(0, Math.min(mesh.sizeCm, x)),
    py = Math.max(0, Math.min(mesh.sizeCm, y))
  const t = triangleAt(mesh, px, py)
  return t < 0 ? 0 : planeHeight(mesh, t, px, py, mesh.area[t] !== GROUND_AREA)
}

/**
 * The mesh as flat-shaded triangles in scene metres, centred on the valley: every ground triangle in its ground's
 * colour, every water triangle as its bed, and a second list of the water's surface coloured by depth.
 */
export function meshSurfaces(
  mesh: GroundMesh,
  groundOf: Uint8Array,
  groundColours: readonly [number, number, number][],
  bedColour: [number, number, number],
  shallow: [number, number, number],
  deep: [number, number, number],
) {
  const half = mesh.sizeCm / 200
  let wet = 0
  let highest = 1
  for (let t = 0; t < mesh.triangles; t++) if (mesh.area[t] !== GROUND_AREA) wet++
  for (const h of mesh.vh) highest = Math.max(highest, h)
  const groundPositions = new Float32Array(mesh.triangles * 9),
    groundColoursOut = new Float32Array(mesh.triangles * 9),
    waterPositions = new Float32Array(wet * 9),
    waterColours = new Float32Array(wet * 9),
    waterBodyByFace: number[] = []
  let w = 0
  for (let t = 0; t < mesh.triangles; t++) {
    const water = mesh.area[t] !== GROUND_AREA
    const shade = facetShade(t)
    let height = 0,
      depth = 0
    for (let e = 0; e < 3; e++) {
      const v = mesh.tv[3 * t + e]!
      height += mesh.vh[v]! / 3
      depth += mesh.vdepth[v]! / 3
    }
    const base = water ? bedColour : groundColours[groundOf[t]!]!
    // A little shading by height, as before, so hills still read from above.
    const lift = water ? 1 : 0.7 + (0.6 * height) / highest
    // Scene faces wind counter-clockwise seen from above, the reverse of map order with y pointing south.
    for (const [slot, e] of [0, 2, 1].entries()) {
      const v = mesh.tv[3 * t + e]!
      const o = 9 * t + 3 * slot
      groundPositions[o] = mesh.vx[v]! / 100 - half
      groundPositions[o + 1] = (mesh.vh[v]! - (water ? mesh.vdepth[v]! : 0)) / 100
      groundPositions[o + 2] = mesh.vy[v]! / 100 - half
      for (let c = 0; c < 3; c++) groundColoursOut[o + c] = base[c]! * lift * shade
    }
    if (!water) continue
    const f = Math.min(1, depth / 200)
    for (const [slot, e] of [0, 2, 1].entries()) {
      const v = mesh.tv[3 * t + e]!
      const o = 9 * w + 3 * slot
      waterPositions[o] = mesh.vx[v]! / 100 - half
      waterPositions[o + 1] = mesh.vh[v]! / 100
      waterPositions[o + 2] = mesh.vy[v]! / 100 - half
      for (let c = 0; c < 3; c++) waterColours[o + c] = (shallow[c]! * (1 - f) + deep[c]! * f) * shade
    }
    waterBodyByFace.push(mesh.body[t]!)
    w++
  }
  return { groundPositions, groundColours: groundColoursOut, waterPositions, waterColours, waterBodyByFace }
}
