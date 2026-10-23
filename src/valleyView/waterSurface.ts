import { drySurfaceHeightAt, type GroundSurface } from './groundSurface'

/** Shared terrain-clipped wet polygons; standalone rectangular fixtures retain explicit skirts. */
export function waterSurface(surface: GroundSurface) {
  const size = surface.sizeCm / 100
  const water = surface.water
  const waterBodyByFace: number[] = []
  const vertices: number[] = []
  const bedVertices: number[] = []
  const quad = (into: number[], a: number[], b: number[], c: number[], d: number[]) =>
    into.push(...a, ...c, ...b, ...b, ...c, ...d)
  if (water.shore) {
    for (let id = 0; id < water.body.length; id += 1) {
      const patch = water.shore.patches.get(id)
      if (patch) {
        for (let triangle = 0; triangle < patch.water.length; triangle += 9) {
          // Core triangles use clockwise map coordinates; reverse them for an upward-facing scene normal.
          for (const offset of [0, 6, 3]) {
            const p = triangle + offset
            vertices.push(
              patch.water[p]! / 100 - size / 2,
              patch.water[p + 2]! / 100,
              patch.water[p + 1]! / 100 - size / 2,
            )
          }
          waterBodyByFace.push(patch.body)
        }
      } else if (water.body[id]! >= 0) {
        const x = ((id % water.cells) * water.cellCm) / 100 - size / 2
        const y = (Math.floor(id / water.cells) * water.cellCm) / 100 - size / 2
        const w = water.cellCm / 100,
          h = water.level[id]! / 100
        quad(vertices, [x, h, y], [x + w, h, y], [x, h, y + w], [x + w, h, y + w])
        waterBodyByFace.push(water.body[id]!, water.body[id]!)
      }
    }
    return { vertices, bedVertices, waterBodyByFace }
  }
  for (let id = 0; id < water.body.length; id += 1) {
    if (water.body[id]! < 0) continue
    const x = ((id % water.cells) * water.cellCm) / 100 - size / 2
    const z = (Math.floor(id / water.cells) * water.cellCm) / 100 - size / 2
    const width = water.cellCm / 100
    const level = water.level[id]! / 100
    const bed = water.bed[id]! / 100
    quad(vertices, [x, level, z], [x + width, level, z], [x, level, z + width], [x + width, level, z + width])
    waterBodyByFace.push(water.body[id]!, water.body[id]!)
    quad(bedVertices, [x, bed, z], [x + width, bed, z], [x, bed, z + width], [x + width, bed, z + width])
    const corners = [
      [x, z],
      [x + width, z],
      [x + width, z + width],
      [x, z + width],
    ]
    for (let edge = 0; edge < 4; edge += 1) {
      const column = id % water.cells
      const row = Math.floor(id / water.cells)
      const neighbour = [
        row > 0 ? id - water.cells : -1,
        column + 1 < water.cells ? id + 1 : -1,
        row + 1 < water.cells ? id + water.cells : -1,
        column > 0 ? id - 1 : -1,
      ][edge]!
      const a = corners[edge]!
      const b = corners[(edge + 1) % 4]!
      if (neighbour >= 0 && water.body[neighbour]! >= 0) {
        const lower = water.level[neighbour]! / 100
        if (level > lower) {
          // Join the recorded river steps instead of exposing a slit into the channel bed.
          quad(vertices, [a[0]!, lower, a[1]!], [b[0]!, lower, b[1]!], [a[0]!, level, a[1]!], [b[0]!, level, b[1]!])
          waterBodyByFace.push(water.body[id]!, water.body[id]!)
        }
        continue
      }
      quad(
        bedVertices,
        [a[0]!, bed, a[1]!],
        [b[0]!, bed, b[1]!],
        [a[0]!, drySurfaceHeightAt(surface, (a[0]! + size / 2) * 100, (a[1]! + size / 2) * 100) / 100, a[1]!],
        [b[0]!, drySurfaceHeightAt(surface, (b[0]! + size / 2) * 100, (b[1]! + size / 2) * 100) / 100, b[1]!],
      )
    }
  }
  return { vertices, bedVertices, waterBodyByFace }
}
