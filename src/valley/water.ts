/** Immutable drainage. Cell IDs increase across rows; all boundary cells are open outlets. */
export interface WaterBody {
  id: number
  kind: 'lake' | 'river'
  cells: number[]
  areaM2: number
  maxDepthCm: number
  outlet: number
}

export interface WaterGrid {
  cells: number
  cellCm: number
  bed: Int32Array
  level: Int32Array
  parent: Int32Array
  rank: Int32Array
  order: Int32Array
  catchmentM2: Float64Array
  /** Index into bodies, or -1 for dry ground. */
  body: Int32Array
  bodies: WaterBody[]
}

/** A stable integer-priority heap, shared by drainage and route search. */
export class CellHeap {
  private ids = new Uint32Array(64)
  private priorities = new Float64Array(64)
  private count = 0

  get length() {
    return this.count
  }

  get minPriority() {
    return this.count ? this.priorities[0]! : Infinity
  }

  clear() {
    this.count = 0
  }

  reprioritize(priorityOf: (id: number) => number | undefined) {
    const ids = new Set<number>()
    for (let index = 0; index < this.count; index += 1) ids.add(this.ids[index]!)
    this.clear()
    for (const id of ids) {
      const priority = priorityOf(id)
      if (priority !== undefined) this.push(id, priority)
    }
  }

  push(id: number, priority: number) {
    if (this.count === this.ids.length) {
      const ids = new Uint32Array(2 * this.count)
      const priorities = new Float64Array(2 * this.count)
      ids.set(this.ids)
      priorities.set(this.priorities)
      this.ids = ids
      this.priorities = priorities
    }
    const ids = this.ids
    const priorities = this.priorities
    let i = this.count++
    while (i > 0) {
      const p = (i - 1) >> 1
      const parentPriority = priorities[p]!
      if (priority > parentPriority || (priority === parentPriority && id >= ids[p]!)) break
      ids[i] = ids[p]!
      priorities[i] = parentPriority
      i = p
    }
    ids[i] = id
    priorities[i] = priority
  }

  pop() {
    const priority = this.minPriority
    return { id: this.popId(), priority }
  }

  /** Numeric searches read minPriority before popping, avoiding an allocation per visited cell. */
  popId() {
    if (!this.count) throw new Error('Cannot pop an empty cell heap')
    const ids = this.ids
    const priorities = this.priorities
    const first = ids[0]!
    this.count -= 1
    const lastId = ids[this.count]!
    const lastPriority = priorities[this.count]!
    if (this.count) {
      let i = 0
      while (2 * i + 1 < this.count) {
        let child = 2 * i + 1
        if (
          child + 1 < this.count &&
          (priorities[child + 1]! < priorities[child]! ||
            (priorities[child + 1] === priorities[child] && ids[child + 1]! < ids[child]!))
        )
          child += 1
        const childPriority = priorities[child]!
        if (childPriority > lastPriority || (childPriority === lastPriority && ids[child]! >= lastId)) break
        ids[i] = ids[child]!
        priorities[i] = childPriority
        i = child
      }
      ids[i] = lastId
      priorities[i] = lastPriority
    }
    return first
  }
}

export function cardinalCells(cells: number, id: number): number[] {
  const neighbours: number[] = []
  if (id >= cells) neighbours.push(id - cells)
  if (id % cells > 0) neighbours.push(id - 1)
  if ((id % cells) + 1 < cells) neighbours.push(id + 1)
  if (id + cells < cells * cells) neighbours.push(id + cells)
  return neighbours
}

export function deriveWater(
  cells: number,
  cellCm: number,
  heights: Int32Array,
  riverCatchmentM2: number,
  riverDepthCm: number,
): WaterGrid {
  if (
    !Number.isInteger(cells) ||
    cells < 1 ||
    cells > 2_000 ||
    !Number.isInteger(cellCm) ||
    cellCm < 100 ||
    cellCm % 100 !== 0 ||
    heights.length !== cells * cells ||
    !Number.isSafeInteger(riverCatchmentM2) ||
    riverCatchmentM2 <= 0 ||
    !Number.isSafeInteger(riverDepthCm) ||
    riverDepthCm <= 0 ||
    heights.some((height) => height - riverDepthCm < -2_147_483_648)
  )
    throw new Error('Unsupported water grid, catchment threshold or channel depth')
  const count = heights.length
  const bed = heights.slice()
  const level = heights.slice()
  const parent = new Int32Array(count).fill(-1)
  const rank = new Int32Array(count)
  const order = new Int32Array(count)
  const visited = new Uint8Array(count)
  const heap = new CellHeap()
  for (let id = 0; id < count; id += 1) {
    if (id < cells || id >= count - cells || id % cells === 0 || id % cells === cells - 1) {
      visited[id] = 1
      heap.push(id, level[id]!)
    }
  }
  let nextRank = 0
  while (heap.length) {
    const id = heap.popId()
    rank[id] = nextRank
    order[nextRank++] = id
    for (const neighbour of cardinalCells(cells, id)) {
      if (visited[neighbour]) continue
      visited[neighbour] = 1
      parent[neighbour] = id
      level[neighbour] = Math.max(bed[neighbour]!, level[id]!)
      heap.push(neighbour, level[neighbour]!)
    }
  }
  const cellArea = (cellCm / 100) ** 2
  const catchmentM2 = new Float64Array(count).fill(cellArea)
  for (let i = count - 1; i >= 0; i -= 1) {
    const id = order[i]!
    if (parent[id]! >= 0) catchmentM2[parent[id]!]! += catchmentM2[id]!
  }
  const body = new Int32Array(count).fill(-1)
  const bodies: WaterBody[] = []
  for (let id = 0; id < count; id += 1) {
    if (level[id]! <= bed[id]! || body[id]! >= 0) continue
    const index = bodies.length
    const members = [id]
    body[id] = index
    for (let j = 0; j < members.length; j += 1) {
      for (const neighbour of cardinalCells(cells, members[j]!)) {
        if (body[neighbour]! < 0 && level[neighbour] === level[id] && level[neighbour]! > bed[neighbour]!) {
          body[neighbour] = index
          members.push(neighbour)
        }
      }
    }
    const outlet = members.reduce((best, cell) => (rank[cell]! < rank[best]! ? cell : best), id)
    bodies.push({
      id,
      kind: 'lake',
      cells: members,
      areaM2: members.length * cellArea,
      maxDepthCm: members.reduce((depth, cell) => Math.max(depth, level[cell]! - bed[cell]!), 0),
      outlet: parent[outlet]!,
    })
  }
  const river = new Uint8Array(count)
  const incoming = new Uint8Array(count)
  for (let id = 0; id < count; id += 1) {
    if (body[id]! < 0 && catchmentM2[id]! >= riverCatchmentM2) river[id] = 1
  }
  for (let id = 0; id < count; id += 1) {
    const downstream = parent[id]!
    if (river[id] && downstream >= 0 && river[downstream]) incoming[downstream]! += 1
  }
  const reaches: number[][] = []
  // A reach starts at a source, a lake exit or a junction; junctions belong to their downstream reach.
  for (let id = 0; id < count; id += 1) {
    if (!river[id] || incoming[id] === 1) continue
    const members: number[] = []
    let cursor = id
    while (cursor >= 0 && river[cursor]) {
      members.push(cursor)
      const next = parent[cursor]!
      if (next < 0 || !river[next] || incoming[next] !== 1) break
      cursor = next
    }
    reaches.push(members)
  }
  const minimum = (members: number[]) => members.reduce((a, b) => Math.min(a, b))
  reaches.sort((a, b) => minimum(a) - minimum(b))
  let reachId = bodies.length ? bodies[bodies.length - 1]!.id + 1 : 0
  for (const members of reaches) {
    const index = bodies.length
    for (const cell of members) {
      body[cell] = index
      bed[cell] = level[cell]! - riverDepthCm
    }
    bodies.push({
      id: reachId++,
      kind: 'river',
      cells: members,
      areaM2: members.length * cellArea,
      maxDepthCm: riverDepthCm,
      outlet: parent[members[members.length - 1]!]!,
    })
  }
  return { cells, cellCm, bed, level, parent, rank, order, catchmentM2, body, bodies }
}

/** Independent structural checks; called once for immutable geography. */
export function waterViolations(grid: WaterGrid): string[] {
  const errors: string[] = []
  const { cells, parent, rank, level, bed, body, bodies } = grid
  const membership = new Int32Array(body.length).fill(-1)
  const ranks = new Uint8Array(body.length)
  const catchment = new Float64Array(body.length).fill((grid.cellCm / 100) ** 2)
  for (let index = grid.order.length - 1; index >= 0; index -= 1) {
    const cell = grid.order[index]!
    if (rank[cell] !== index || ranks[cell]) errors.push('Drainage ranks are not a permutation')
    ranks[cell] = 1
    const p = parent[cell]!
    if (p >= 0 && p < body.length) catchment[p]! += catchment[cell]!
  }
  for (let i = 0; i < body.length; i += 1) {
    const p = parent[i]!
    if (catchment[i] !== grid.catchmentM2[i]) errors.push(`Invalid contributing area ${i}`)
    if (p === -1) {
      if (!(i < cells || i >= cells * (cells - 1) || i % cells === 0 || i % cells === cells - 1))
        errors.push(`Interior outlet ${i}`)
    } else if (!cardinalCells(cells, i).includes(p) || rank[p]! >= rank[i]! || level[p]! > level[i]!)
      errors.push(`Invalid downstream edge ${i}`)
  }
  const bodyIds = new Set<number>()
  for (const [index, water] of bodies.entries()) {
    if (!water.cells.length) {
      errors.push(`Empty water body ${water.id}`)
      continue
    }
    const minimum = water.cells.reduce((a, b) => Math.min(a, b), Infinity)
    const depth = water.cells.reduce((maximum, cell) => Math.max(maximum, level[cell]! - bed[cell]!), 0)
    if (water.kind === 'lake' && water.id !== minimum) errors.push(`Invalid lake ID ${water.id}`)
    if (water.maxDepthCm !== depth) errors.push(`Invalid depth ${water.id}`)
    if (bodyIds.has(water.id)) errors.push(`Duplicate body ID ${water.id}`)
    bodyIds.add(water.id)
    if (water.kind === 'lake') {
      const first = water.cells.reduce((best, cell) => (rank[cell]! < rank[best]! ? cell : best))
      if (water.outlet !== parent[first] || (water.outlet >= 0 && body[water.outlet] === index))
        errors.push(`Invalid lake spill ${water.id}`)
    } else {
      if (water.outlet !== parent[water.cells.at(-1)!]) errors.push(`Invalid reach outlet ${water.id}`)
      for (let cell = 1; cell < water.cells.length; cell += 1)
        if (parent[water.cells[cell - 1]!] !== water.cells[cell]) errors.push(`Disconnected reach ${water.id}`)
    }
    if (water.areaM2 !== water.cells.length * (grid.cellCm / 100) ** 2) errors.push(`Invalid area ${water.id}`)
    for (const cell of water.cells) {
      if (membership[cell] !== -1 || body[cell] !== index || bed[cell]! >= level[cell]!)
        errors.push(`Invalid wet membership ${cell}`)
      membership[cell] = index
      if (water.kind === 'lake' && level[cell] !== level[water.cells[0]!]) errors.push(`Uneven lake ${water.id}`)
    }
  }
  for (let i = 0; i < body.length; i += 1) if (membership[i] !== body[i]) errors.push(`Missing wet membership ${i}`)
  return errors
}
