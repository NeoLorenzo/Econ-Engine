import type { Point } from './types'

/**
 * Distances are whole centimetres. The square root of a whole number below 2⁵² is correctly rounded in IEEE
 * arithmetic, so the floor below is the exact integer square root on every machine.
 */
export const isqrt = (n: number) => Math.floor(Math.sqrt(n))

export const distanceSq = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2

/** The straight-line distance, rounded down to a whole centimetre. */
export const distance = (ax: number, ay: number, bx: number, by: number) => isqrt(distanceSq(ax, ay, bx, by))

/** The straight-line distance, rounded up to a whole centimetre. */
export function distanceUp(ax: number, ay: number, bx: number, by: number) {
  const sq = distanceSq(ax, ay, bx, by)
  const root = isqrt(sq)
  return root * root === sq ? root : root + 1
}

/** Whole seconds to walk `cm` centimetres. */
export const walkSeconds = (cm: number, walkCmPerSecond: number) => Math.ceil(cm / walkCmPerSecond)

/**
 * A step of up to `step` centimetres from `from` towards `to`, whose distance is `d`: the point itself if it is no
 * further, otherwise `from + trunc((to − from) · step / d)`. It never overshoots.
 */
export function stepTowards(from: Point, to: Point, step: number): Point {
  const d = distance(from.x, from.y, to.x, to.y)
  if (d <= step) return { x: to.x, y: to.y }
  return { x: from.x + Math.trunc(((to.x - from.x) * step) / d), y: from.y + Math.trunc(((to.y - from.y) * step) / d) }
}
