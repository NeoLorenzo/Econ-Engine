// How a hut is built, log by log: a small A-frame for one sleeper. A log is a pole of dry wood 14 cm thick and 2.4 m
// long, about 20 kg. In the hut's own frame, metres, x runs along the hut with its open end at +x, y is up and z across.

/** A log's length and radius. */
export const LOG_LENGTH = 2.4
export const LOG_RADIUS = 0.07
/** Half the spread of each A's feet, the height where its legs meet, and how far each A stands from the middle. */
const FOOT = 0.55
const APEX = 1
const END = 1.05

/** A piece of a log, from one end of its axis to the other. */
export interface HutPiece {
  from: [number, number, number]
  to: [number, number, number]
}

/**
 * The hut's logs in the order they are laid, each a list of the pieces it is cut into. First the two A's, each a log
 * cut in two, its legs dug in at the feet and tied at the top. Then the walls, logs along the hut on the outside of both
 * A's, laid from the ground up on alternate sides, each resting on the one below. Then a ridge log in the groove
 * between the top two, and last two logs cut into posts stood up against the back A. The front is the door.
 */
export function hutPlan(): HutPiece[][] {
  const plan: HutPiece[][] = []
  for (const x of [END, -END]) plan.push([1, -1].map((side) => ({ from: [x, 0, side * FOOT], to: [x, APEX, 0] })))
  // Along the +z leg, and outward from it, in (z, y).
  const leg = Math.hypot(FOOT, APEX)
  const up = [-FOOT / leg, APEX / leg] as const
  const out = [APEX / leg, FOOT / leg] as const
  // Wall logs touch the legs and each other, the first on the ground, up to where the two sides meet.
  const walls: [number, number][] = []
  for (let s = ((LOG_RADIUS - 2 * LOG_RADIUS * out[1]) * leg) / APEX; ; s += 2 * LOG_RADIUS) {
    const z = FOOT + s * up[0] + 2 * LOG_RADIUS * out[0]
    if (z < LOG_RADIUS) break
    walls.push([z, s * up[1] + 2 * LOG_RADIUS * out[1]])
  }
  const along = (y: number, z: number): HutPiece => ({ from: [-LOG_LENGTH / 2, y, z], to: [LOG_LENGTH / 2, y, z] })
  for (const [z, y] of walls) plan.push([along(y, -z)], [along(y, z)])
  const [topZ, topY] = walls[walls.length - 1]!
  plan.push([along(topY + Math.sqrt((2 * LOG_RADIUS) ** 2 - topZ ** 2), 0)])
  // Posts across the back, each leaning a little onto the back A and reaching up under the walls beside it.
  const posts: HutPiece[] = []
  const x = -END - 2 * LOG_RADIUS
  for (let z = -FOOT + LOG_RADIUS; z <= FOOT - LOG_RADIUS + 1e-9; z += 2 * LOG_RADIUS) {
    const top = APEX * (1 - Math.abs(z) / FOOT) + LOG_RADIUS
    posts.push({ from: [x, 0, z], to: [x + 0.04, top, z] })
  }
  const half = Math.ceil(posts.length / 2)
  plan.push(posts.slice(0, half), posts.slice(half))
  return plan
}

/** A piece's length. */
export const pieceLength = (piece: HutPiece) =>
  Math.hypot(piece.to[0] - piece.from[0], piece.to[1] - piece.from[1], piece.to[2] - piece.from[2])
