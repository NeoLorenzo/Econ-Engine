export interface RandomDraw { value: number; state: number }

export function normalizeSeed(seed: number): number {
  const normalized = Math.round(seed) >>> 0
  return normalized === 0 ? 0x6d2b79f5 : normalized
}

export function randomDraw(state: number): RandomDraw {
  let next = normalizeSeed(state)
  next ^= next << 13
  next ^= next >>> 17
  next ^= next << 5
  next >>>= 0
  return { value: next / 0x1_0000_0000, state: next }
}

export function randomInt(state: number, maximumExclusive: number): { value: number; state: number } {
  if (!Number.isInteger(maximumExclusive) || maximumExclusive <= 0) throw new Error('Random selection requires a positive integer range')
  const draw = randomDraw(state)
  return { value: Math.floor(draw.value * maximumExclusive), state: draw.state }
}

export function probabilityCheck(state: number, probability: number): { value: boolean; state: number } {
  const draw = randomDraw(state)
  return { value: draw.value < Math.max(0, Math.min(1, probability)), state: draw.state }
}

export function seededShuffle<T>(values: readonly T[], state: number): { values: T[]; state: number } {
  const shuffled = [...values]
  let nextState = state
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selected = randomInt(nextState, index + 1)
    nextState = selected.state
    ;[shuffled[index], shuffled[selected.value]] = [shuffled[selected.value], shuffled[index]]
  }
  return { values: shuffled, state: nextState }
}
