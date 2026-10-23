import { expect, it } from 'vitest'
import * as THREE from 'three'
import { tiledSurface } from './tiledSurface'

it('preserves all triangles and attributes while giving surface tiles separate bounds', () => {
  const source = new THREE.BufferGeometry()
  source.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 2, 0, 5, 3, 0, 0, 4, 5, 200, 6, 0, 205, 7, 0, 200, 8, 5], 3),
  )
  source.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 2))
  source.setIndex([0, 2, 1, 3, 5, 4])
  source.computeVertexNormals()
  const material = new THREE.MeshBasicMaterial()
  const tiled = tiledSurface(THREE, source, material, 100, true)
  expect(tiled.children).toHaveLength(2)
  expect(tiled.children.map((mesh) => [...mesh.userData.sourceFaces])).toEqual([[0], [1]])
  const actual: number[][] = []
  for (const child of tiled.children) {
    const mesh = child as THREE.Mesh
    expect(mesh.material).toBe(material)
    expect(mesh.geometry.boundingSphere!.radius).toBeLessThan(5)
    for (const id of mesh.geometry.index!.array) {
      const position = mesh.geometry.getAttribute('position')
      const uv = mesh.geometry.getAttribute('uv')
      actual.push([position.getX(id), position.getY(id), position.getZ(id), uv.getX(id), uv.getY(id)])
    }
  }
  expect(actual).toEqual(
    [0, 2, 1, 3, 5, 4].map((id) => {
      const position = source.getAttribute('position')
      const uv = source.getAttribute('uv')
      return [position.getX(id), position.getY(id), position.getZ(id), uv.getX(id), uv.getY(id)]
    }),
  )
})
