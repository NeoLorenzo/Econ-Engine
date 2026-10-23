import type { BufferGeometry, Material } from 'three'

/** Split an immutable surface without changing any vertex, normal or triangle. Bounds are local to each tile. */
export function tiledSurface(
  THREE: typeof import('three'),
  source: BufferGeometry,
  material: Material,
  tileM = 100,
  trackFaces = false,
) {
  const root = new THREE.Mesh(new THREE.BufferGeometry(), material)
  const position = source.getAttribute('position')
  const index = source.getIndex()
  const count = index?.count ?? position.count
  const tiles = new Map<string, number[]>()
  const faces = new Map<string, number[]>()
  for (let triangle = 0; triangle < count; triangle += 3) {
    const ids = [0, 1, 2].map((offset) => (index ? index.getX(triangle + offset) : triangle + offset))
    const x = ids.reduce((sum, id) => sum + position.getX(id), 0) / 3
    const z = ids.reduce((sum, id) => sum + position.getZ(id), 0) / 3
    const key = `${Math.floor(x / tileM)}:${Math.floor(z / tileM)}`
    let entries = tiles.get(key)
    if (!entries) tiles.set(key, (entries = []))
    entries.push(...ids)
    if (trackFaces) {
      let list = faces.get(key)
      if (!list) faces.set(key, (list = []))
      list.push(triangle / 3)
    }
  }
  for (const [key, entries] of tiles) {
    const unique = [...new Set(entries)]
    const local = new Map(unique.map((id, slot) => [id, slot]))
    const geometry = new THREE.BufferGeometry()
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const data = new Float32Array(unique.length * attribute.itemSize)
      for (const [slot, id] of unique.entries())
        for (let component = 0; component < attribute.itemSize; component += 1)
          data[slot * attribute.itemSize + component] = attribute.getComponent(id, component)
      geometry.setAttribute(name, new THREE.BufferAttribute(data, attribute.itemSize))
    }
    geometry.setIndex(entries.map((id) => local.get(id)!))
    geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, material)
    if (trackFaces) mesh.userData.sourceFaces = new Uint32Array(faces.get(key)!)
    root.add(mesh)
  }
  return root
}
