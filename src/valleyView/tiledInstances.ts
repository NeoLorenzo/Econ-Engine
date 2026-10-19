import type { BufferGeometry, Group, InstancedMesh, Material, Matrix4 } from 'three'

type Three = typeof import('three')

/**
 * Instances of one plant mesh, cut into square tiles of the land, so that tiles far from the camera are not drawn and
 * each tile is culled on its own. It is addressed as one mesh: instance `i` belongs to plant `floor(i / perPlant)`,
 * whose position decides its tile.
 */
export class TiledInstances {
  readonly group: Group
  readonly tiles: InstancedMesh[]
  private readonly tileOf: Int32Array
  private readonly localOf: Int32Array
  /** For each tile, the global index of each of its instances. */
  private readonly globalOf: Int32Array[]
  private readonly centres: { x: number; z: number }[]
  private readonly tileM: number
  private readonly tileOfPlant: Int32Array
  /** Tiles whose matrices changed since they were last marked for upload. */
  private readonly dirty = new Set<number>()

  /**
   * `plantX` and `plantZ` give each plant's position in metres in the scene, `perPlant` its instances, `sizeM` the
   * land's width and `tileM` a tile's.
   */
  constructor(
    THREE: Three,
    geometry: BufferGeometry,
    material: Material,
    perPlant: number,
    plantX: Float32Array,
    plantZ: Float32Array,
    sizeM: number,
    tileM: number,
  ) {
    const plants = plantX.length
    const across = Math.max(1, Math.ceil(sizeM / tileM))
    this.tileM = tileM
    const tileOfPlant = new Int32Array(plants)
    this.tileOfPlant = tileOfPlant
    const counts = new Int32Array(across * across)
    for (let plant = 0; plant < plants; plant += 1) {
      const column = Math.min(across - 1, Math.max(0, Math.floor((plantX[plant]! + sizeM / 2) / tileM)))
      const row = Math.min(across - 1, Math.max(0, Math.floor((plantZ[plant]! + sizeM / 2) / tileM)))
      tileOfPlant[plant] = row * across + column
      counts[row * across + column]! += perPlant
    }
    const count = plants * perPlant
    this.tileOf = new Int32Array(count)
    this.localOf = new Int32Array(count)
    this.globalOf = Array.from(counts, (n) => new Int32Array(n))
    const filled = new Int32Array(counts.length)
    for (let index = 0; index < count; index += 1) {
      const tile = tileOfPlant[Math.floor(index / perPlant)]!
      this.tileOf[index] = tile
      this.localOf[index] = filled[tile]!
      this.globalOf[tile]![filled[tile]!] = index
      filled[tile]! += 1
    }
    this.group = new THREE.Group()
    this.tiles = Array.from(counts, (n) => {
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, n))
      mesh.count = n
      this.group.add(mesh)
      return mesh
    })
    this.centres = Array.from(counts, (_, tile) => ({
      x: ((tile % across) + 0.5) * tileM - sizeM / 2,
      z: (Math.floor(tile / across) + 0.5) * tileM - sizeM / 2,
    }))
  }

  setMatrixAt(index: number, matrix: Matrix4) {
    const tile = this.tileOf[index]!
    this.tiles[tile]!.setMatrixAt(this.localOf[index]!, matrix)
    this.dirty.add(tile)
  }

  /** Whether a plant's tile is drawn. */
  shows(plant: number) {
    return this.tiles[this.tileOfPlant[plant]!]!.visible
  }

  /** Setting `needsUpdate` marks the tiles whose matrices changed for upload, as on one mesh. */
  readonly instanceMatrix: { needsUpdate: boolean } = (() => {
    const tiles = () => this.tiles
    const dirty = () => this.dirty
    return {
      get needsUpdate() {
        return false
      },
      set needsUpdate(value: boolean) {
        if (!value) return
        for (const tile of dirty()) tiles()[tile]!.instanceMatrix.needsUpdate = true
        dirty().clear()
      },
    }
  })()

  markChanged() {
    for (const tile of this.tiles) tile.instanceMatrix.needsUpdate = true
  }

  set castShadow(value: boolean) {
    for (const tile of this.tiles) tile.castShadow = value
  }

  set receiveShadow(value: boolean) {
    for (const tile of this.tiles) tile.receiveShadow = value
  }

  computeBoundingSphere() {
    for (const tile of this.tiles) tile.computeBoundingSphere()
  }

  /** The global index of an instance hit in one of its tiles, or null if the object is not one of them. */
  indexOf(object: unknown, instance: number | undefined): number | null {
    if (instance === undefined) return null
    const tile = this.tiles.indexOf(object as InstancedMesh)
    return tile < 0 ? null : (this.globalOf[tile]![instance] ?? null)
  }

  /** Draws only the tiles with a point within `radius` metres of `(x, z)`. */
  showNear(x: number, z: number, radius: number) {
    const half = this.tileM / 2
    for (const [tile, centre] of this.centres.entries()) {
      const dx = Math.max(0, Math.abs(centre.x - x) - half)
      const dz = Math.max(0, Math.abs(centre.z - z) - half)
      this.tiles[tile]!.visible = dx * dx + dz * dz <= radius * radius
    }
  }

  dispose() {
    for (const tile of this.tiles) tile.dispose()
  }
}
