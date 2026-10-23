import { expect, it } from 'vitest'
import * as THREE from 'three'
import { TiledInstances } from './tiledInstances'

it('visits only visible plants once and preserves picking IDs across tiles', () => {
  const plants = new TiledInstances(
    THREE,
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial(),
    2,
    new Float32Array([-150, 150, -140]),
    new Float32Array([-150, 150, -140]),
    400,
    100,
  )
  plants.showNear(-150, -150, 20)
  expect([...plants.visiblePlants()]).toEqual([0, 2])
  const matrix = new THREE.Matrix4().makeTranslation(10, 20, 30)
  plants.setMatrixAt(4, matrix)
  const tile = plants.tiles.find((mesh) => mesh.count === 4)!
  expect(plants.indexOf(tile, 2)).toBe(4)
  plants.instanceMatrix.needsUpdate = true
  expect(tile.boundingSphere!.containsPoint(new THREE.Vector3(10, 20, 30))).toBe(true)
  plants.showNear(150, 150, 20)
  expect([...plants.visiblePlants()]).toEqual([1])
  plants.showNear(-150, -150, 20)
  const actual = new THREE.Matrix4()
  tile.getMatrixAt(2, actual)
  expect(actual.elements).toEqual(matrix.elements)
  expect([...plants.visiblePlants()]).toEqual([0, 2])
})
