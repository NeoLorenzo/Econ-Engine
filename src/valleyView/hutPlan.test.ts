import { describe, expect, it } from 'vitest'
import { VALLEY_DEFAULT_CONFIG } from '../valley/config'
import { LOG_LENGTH, LOG_RADIUS, type HutPiece, hutPlan, pieceLength } from './hutPlan'

const pointAt = (piece: HutPiece, t: number) => piece.from.map((from, axis) => from + (piece.to[axis]! - from) * t)

/** The closest two points on two pieces' axes come within this distance, sampled finely along both. */
function gap(a: HutPiece, b: HutPiece) {
  let best = Infinity
  for (let i = 0; i <= 200; i += 1)
    for (let j = 0; j <= 200; j += 1) {
      const p = pointAt(a, i / 200)
      const q = pointAt(b, j / 200)
      best = Math.min(best, Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!))
    }
  return best
}

describe('the hut plan', () => {
  const plan = hutPlan()

  it('has a piece list for every log a whole hut needs', () => {
    expect(plan.length).toBe(VALLEY_DEFAULT_CONFIG.hutLogs)
  })

  it('cuts no log into more wood than it holds', () => {
    for (const pieces of plan)
      expect(pieces.reduce((sum, piece) => sum + pieceLength(piece), 0)).toBeLessThanOrEqual(LOG_LENGTH + 1e-9)
  })

  it('rests every piece on the ground or on a piece laid before it', () => {
    const laid: HutPiece[] = []
    for (const pieces of plan) {
      for (const piece of pieces) {
        const onGround = Math.min(piece.from[1], piece.to[1]) <= LOG_RADIUS
        const touching = laid.some((other) => gap(piece, other) <= 2 * LOG_RADIUS + 0.01)
        expect(onGround || touching).toBe(true)
      }
      laid.push(...pieces)
    }
  })
})
